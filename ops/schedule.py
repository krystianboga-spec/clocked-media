#!/usr/bin/env python3
"""Clocked monthly schedule generator (pure Python 3 standard library).

Usage:
  python3 ops/schedule.py YYYY-MM --manifest manifest.json [--start-day 1]
      --best-times best-times.json [--used-tiktok N] [--used-instagram N] [--exclude tiktok:ID --exclude instagram:ID]
      [--block-evening YYYY-MM-DD ...] [--out-dir DIR] [--no-validate]

Reads a manifest of the month's assets (see ops/manifest.example.json) and writes
  schedule-YYYY-MM.json   (posts + the exact Metricool createScheduledPost call for each, draft true)
  schedule-YYYY-MM.md     (summary table for Krystian)
Each post goes at the platform's top Metricool best hour for its weekday (minute 00); if that hour is in a blocked
evening the next hour in the list is used. Rules (see ops/RUNBOOK.md and ops/rules.md): at most 10 posts per platform per month,
one per platform per day, the same asset never on both platforms the same day,
payday assets on Thu/Fri, no evening posts on US federal holidays or big national nights.
"""
import argparse, calendar, datetime as dt, json, os, re, sys

BRAND_ID = "7724856"
TZ = "America/Chicago"
RAW = "https://raw.githubusercontent.com/krystianboga-spec/clocked-media/main/"
MONTHLY_CAP = 10  # per platform on the Metricool free plan (20 total)
EVENING = "17:00"

def load_best(path):
    """best-times.json -> {platform: {iso weekday int: [hours]}} (validated)."""
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    out = {}
    for plat in ("tiktok", "instagram"):
        out[plat] = {}
        for wd in range(1, 8):
            hrs = raw[plat][str(wd)]
            if not hrs or any(not isinstance(h, int) or not 0 <= h <= 23 for h in hrs):
                raise SystemExit(f"best-times.json: bad hours for {plat} weekday {wd}")
            out[plat][wd] = hrs
    return out


def slot_reason(rank, wd_name):
    return f"Metricool best time #{rank + 1} for {wd_name}"


# ---------------------------------------------------------------- calendar helpers
def nth_weekday(y, m, wd, n):
    d = dt.date(y, m, 1)
    d += dt.timedelta(days=(wd - d.weekday()) % 7)
    return d + dt.timedelta(weeks=n - 1)


def last_weekday(y, m, wd):
    d = dt.date(y, m, calendar.monthrange(y, m)[1])
    return d - dt.timedelta(days=(d.weekday() - wd) % 7)


def observed(d):
    return d - dt.timedelta(days=1) if d.weekday() == 5 else d + dt.timedelta(days=1) if d.weekday() == 6 else d


def federal_holidays(y):
    fixed = [(1, 1, "New Year's Day"), (6, 19, "Juneteenth"), (7, 4, "Independence Day"),
             (11, 11, "Veterans Day"), (12, 25, "Christmas Day")]
    out = {}
    for m, d, name in fixed:
        dd = dt.date(y, m, d)
        out[dd] = name
        if observed(dd) != dd:
            out[observed(dd)] = name + " (observed)"
    out[nth_weekday(y, 1, 0, 3)] = "Martin Luther King Jr. Day"
    out[nth_weekday(y, 2, 0, 3)] = "Presidents Day"
    out[last_weekday(y, 5, 0)] = "Memorial Day"
    out[nth_weekday(y, 9, 0, 1)] = "Labor Day"
    out[nth_weekday(y, 10, 0, 2)] = "Columbus / Indigenous Peoples Day"
    out[nth_weekday(y, 11, 3, 4)] = "Thanksgiving"
    return out


# Super Bowl Sundays. VERIFY and extend this table each year (add the next one when you see it announced).
SUPER_BOWLS = {dt.date(2026, 2, 8): "Super Bowl LX", dt.date(2027, 2, 14): "Super Bowl LXI"}


def evening_blocks(y, m, extra=()):
    """date -> reason, for dates whose evening (17:00 on) must stay empty."""
    out = {}
    for yy in (y - 1, y, y + 1):  # observed holidays can cross a year boundary
        for d, name in federal_holidays(yy).items():
            out[d] = name
    if y % 2 == 0:  # general elections are in even years
        out[nth_weekday(y, 11, 0, 1) + dt.timedelta(days=1)] = "Election Day"
    out[dt.date(y, 12, 24)] = "Christmas Eve"
    out[dt.date(y, 12, 31)] = "New Year's Eve"
    for d, name in SUPER_BOWLS.items():
        out[d] = name
    for e in extra:
        out[dt.date.fromisoformat(e)] = "extra block"
    return {d: n for d, n in out.items() if d.year == y and d.month == m}


def dst_offset(d, hh):
    """US Central offset in hours (-5 CDT / -6 CST) for a local date and hour."""
    start = nth_weekday(d.year, 3, 6, 2)
    end = nth_weekday(d.year, 11, 6, 1)
    if start < d < end or (d == start and hh >= 3) or (d == end and hh < 1):
        return -5
    return -6


# ---------------------------------------------------------------- manifest
def load_manifest(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def media_url(p):
    return p if p.startswith("http") else RAW + p.lstrip("/")


BANNED = ["search clocked", "coming soon", "guarantee", "ai-powered", "ai powered", "app store", "google play",
          "download", "take-home", "take home", "after tax", "after-tax", "net pay", "tax calculator", "track tips",
          "tip tracking", "tracks your tips", "users love", "thousands of", "rated", "#1 ", "best app",
          "sync your", "syncs", "direct deposit", "never miss", "scan the qr", "link in comments"]
IMPORT_OK_WORDS = ("building", "not ready", "next")


def validate(manifest):
    errs = []
    for a in manifest["assets"]:
        for plat in ("tiktok", "instagram"):
            p = a.get(plat)
            if not p:
                errs.append(f"{a['id']}: missing {plat} block")
                continue
            cap = p.get("caption", "")
            low = cap.lower()
            tags = re.findall(r"#\w+", cap)
            if len(tags) > 5:
                errs.append(f"{a['id']}/{plat}: {len(tags)} hashtags (max 5)")
            if plat == "tiktok" and ("\n" in cap):
                errs.append(f"{a['id']}/tiktok: caption must be a single line")
            if plat == "tiktok" and not p.get("title"):
                errs.append(f"{a['id']}/tiktok: tiktokData.title is required")
            if plat == "tiktok" and len(p.get("title", "")) > 90:
                errs.append(f"{a['id']}/tiktok: title over 90 characters")
            if plat == "instagram" and "(link in bio)" not in low:
                errs.append(f"{a['id']}/instagram: caption needs '(link in bio)'")
            if "clocked.space" not in low:
                errs.append(f"{a['id']}/{plat}: caption must include clocked.space")
            if any(ch in cap or ch in p.get("title", "") for ch in (chr(0x2014), chr(0x2013))):
                errs.append(f"{a['id']}/{plat}: em or en dash found")
            for b in BANNED:
                if b in low:
                    errs.append(f"{a['id']}/{plat}: banned phrase '{b}'")
            if re.search(r"\bimport", low) and not any(w in low for w in IMPORT_OK_WORDS):
                errs.append(f"{a['id']}/{plat}: 'import' only allowed as 'building this next'")
            if "$" in cap and "before taxes" not in low and "example" not in low:
                errs.append(f"{a['id']}/{plat}: pay figure needs 'example' and 'before taxes'")
            if not p.get("media"):
                errs.append(f"{a['id']}/{plat}: no media")
        if a["type"] not in ("video", "photo"):
            errs.append(f"{a['id']}: type must be video or photo")
    return errs


# ---------------------------------------------------------------- planning
def interleave(videos, photos, n):
    v, p = len(videos), len(photos)
    if v + p == 0:
        return []
    n = min(n, v + p)
    kv = min(v, round(n * v / (v + p)))
    kp = min(p, n - kv)
    kv = min(v, n - kp)
    vs, ps, out = videos[:kv], photos[:kp], []
    total = kv + kp
    vi = pi = 0
    for i in range(total):  # spread photos evenly among videos
        if (i + 1) * kp // total > i * kp // total:
            out.append(ps[pi]); pi += 1
        else:
            out.append(vs[vi]); vi += 1
    return out


def pick_days(avail, n):
    L = len(avail)
    return sorted({avail[min(L - 1, int((i + 0.5) * L / n))] for i in range(n)})


def plan_platform(platform, assets, month_days, start_day, used, blocks, other_dates, excluded, warnings, best):
    y, m = month_days
    last = calendar.monthrange(y, m)[1]

    def allowed(d, payday=False):
        """Hours (as 'HH:00') usable on d, best first; evenings (17:00 on) dropped on blocked dates."""
        ts = [f"{h:02d}:00" for h in best[platform][d.isoweekday()]]
        if d in blocks:
            ts = [t for t in ts if t < EVENING]
        return ts

    avail = [dt.date(y, m, k) for k in range(max(1, start_day), last + 1) if allowed(dt.date(y, m, k))]
    quota = max(0, MONTHLY_CAP - used)
    pool = [a for a in assets if a["id"] not in excluded]
    pd_days_avail = sum(1 for d in avail if d.weekday() in (3, 4))
    keep, dropped = [], []
    npd = 0
    for a in pool:  # payday assets only go where a Thu/Fri evening slot exists
        if a.get("payday"):
            if npd < min(pd_days_avail, 3):
                keep.append(a); npd += 1
            else:
                dropped.append(a["id"])
        else:
            keep.append(a)
    if dropped:
        warnings.append(f"{platform}: payday assets left for another run (no free Thu/Fri day): {', '.join(dropped)}")
    pool = keep
    n = min(quota, len(avail), len(pool))
    if n < MONTHLY_CAP:
        warnings.append(f"{platform}: only {n} posts planned (quota left {quota}, usable days {len(avail)}, assets {len(pool)})")
    if n == 0:
        return []
    chosen = interleave([a for a in pool if a["type"] == "video"], [a for a in pool if a["type"] == "photo"], n)
    chosen = chosen[:n]
    S = pick_days(avail, n)

    def is_pd(d):
        return d.weekday() in (3, 4) and bool(allowed(d))

    pds = [a for a in chosen if a.get("payday")]
    # make room for payday assets on Thu/Fri days
    while sum(is_pd(d) for d in S) < len(pds):
        cands = [d for d in avail if d not in S and is_pd(d)]
        removable = [s for s in S if not is_pd(s)]
        if not cands or not removable:
            warnings.append(f"{platform}: not enough Thu/Fri days for all payday assets")
            break
        d = max(cands, key=lambda c: min(abs((c - s).days) for s in S))
        r = min(removable, key=lambda s: abs((s - d).days))
        S.remove(r); S.append(d); S.sort()
    pd_days = [d for d in S if is_pd(d)]
    assign = {}
    k = len(pds)
    if k and pd_days:
        idx = sorted({min(len(pd_days) - 1, int((i + 0.5) * len(pd_days) / k)) for i in range(k)})
        for a, i in zip(pds, idx):
            assign[pd_days[i]] = a
        for a in pds[len(idx):]:  # more payday assets than Thu/Fri days
            for d in pd_days:
                if d not in assign:
                    assign[d] = a; break
    placed = {a["id"] for a in assign.values()}
    rest = [a for a in chosen if a["id"] not in placed]
    rot = (3 if platform == "instagram" else 0) % len(rest) if rest else 0
    rest = rest[rot:] + rest[:rot]
    free = [d for d in S if d not in assign]
    for d, a in zip(free, rest):
        assign[d] = a
    # never the same asset on both platforms the same day
    def conflict(d, a):
        return other_dates.get(a["id"]) == d

    def ok(d, a):
        if conflict(d, a):
            return False
        return (not a.get("payday")) or is_pd(d)

    days = sorted(assign)
    for d in days:
        if not conflict(d, assign[d]):
            continue
        for e in days:
            if e != d and ok(e, assign[d]) and ok(d, assign[e]):
                assign[d], assign[e] = assign[e], assign[d]
                break
        else:
            warnings.append(f"{platform}: could not separate {assign[d]['id']} from its other-platform post on {d}")
    posts = []
    for i, d in enumerate(sorted(assign)):
        a = assign[d]
        pay = bool(a.get("payday"))
        t = allowed(d)[0]
        full = [f"{h:02d}:00" for h in best[platform][d.isoweekday()]]
        posts.append({"platform": platform, "date": d, "time": t, "asset": a, "payday": pay, "rank": full.index(t)})
    return posts


def build_call(post, manifest):
    a, plat = post["asset"], post["platform"]
    p = a[plat]
    d, t = post["date"], post["time"]
    hh = int(t[:2])
    off = dst_offset(d, hh)
    iso_local = f"{d.isoformat()}T{t}:00"
    voiced = bool(a.get("voiced"))
    ai = bool(a.get("ai_voice", voiced))
    info = {
        "autoPublish": True,
        "draft": True,
        "providers": [{"network": plat}],
        "publicationDate": {"dateTime": iso_local, "timezone": TZ},
        "text": p["caption"],
        "media": [media_url(x) for x in p["media"]],
        "mediaAltText": [],
        "descendants": [],
        "firstCommentText": p.get("first_comment", ""),
        "hasNotReadNotes": False,
        "shortener": False,
        "smartLinkData": {"ids": []},
    }
    if plat == "tiktok":
        td = {"title": p["title"], "privacyOption": "PUBLIC_TO_EVERYONE", "disableComment": False,
              "disableDuet": False, "disableStitch": False, "commercialContentThirdParty": False,
              "commercialContentOwnBrand": False}
        if a["type"] == "video":
            info["autoPublish"] = voiced      # silent video: push notification so Krystian adds a commercial-library sound
            td["isAigc"] = ai
        else:
            td["autoAddMusic"] = True
            td["photoCoverIndex"] = 0
        info["tiktokData"] = td
    else:
        info["autoPublish"] = True
        info["instagramData"] = {"type": "REEL" if a["type"] == "video" else "POST", "showReelOnFeed": True,
                                 "isAiGenerated": ai if a["type"] == "video" else bool(a.get("ai_images", False))}
    if a["type"] == "video" and plat == "instagram" and p.get("cover_ms") is not None:
        info["videoCoverMilliseconds"] = p["cover_ms"]
    return {"blogId": str(manifest.get("brand_id", BRAND_ID)),
            "date": f"{iso_local}{off:+03d}:00", "info": info}


def md_table(posts, month, warnings, blocks, leftover):
    L = [f"# Clocked posts for {month}: summary for approval", "",
         "All times Central. Every post is loaded as a DRAFT until Krystian says yes.", "",
         "| # | Platform | Date | Day | Time CT | Asset | Type | Sound | autoPublish | Why this slot |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for i, p in enumerate(posts, 1):
        a = p["asset"]; info = p["call"]["info"]
        sound = ("AI voice (labeled)" if a.get("voiced") and a.get("ai_voice", True) else "voiced") if a.get("voiced") \
            else ("add sound on phone" if p["platform"] == "tiktok" and a["type"] == "video"
                  else "auto music" if p["platform"] == "tiktok" else "none")
        L.append(f"| {i} | {p['platform']} | {p['date']} | {p['date'].strftime('%a')} | {p['time']} | {a['id']} | "
                 f"{a['type']} | {sound} | {str(info['autoPublish']).lower()} | {p['reason']} |")
    if blocks:
        L += ["", "Evenings kept empty: " + "; ".join(f"{d} ({n})" for d, n in sorted(blocks.items()))]
    if leftover:
        L += ["", "Assets not scheduled this run: " + ", ".join(leftover)]
    for w in warnings:
        L.append(f"- WARNING: {w}")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("month", help="YYYY-MM")
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--start-day", type=int, default=1)
    ap.add_argument("--best-times", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "best-times.json"),
                    help="Metricool best hours per ISO weekday (default ops/best-times.json)")
    ap.add_argument("--used-tiktok", type=int, default=0)
    ap.add_argument("--used-instagram", type=int, default=0)
    ap.add_argument("--exclude", action="append", default=[], help="platform:asset-id already posted")
    ap.add_argument("--block-evening", action="append", default=[], help="extra YYYY-MM-DD with no evening posts")
    ap.add_argument("--out-dir", default=".")
    ap.add_argument("--no-validate", action="store_true")
    args = ap.parse_args()
    y, m = map(int, args.month.split("-"))
    manifest = load_manifest(args.manifest)
    if not args.no_validate:
        errs = validate(manifest)
        if errs:
            print("MANIFEST VALIDATION FAILED:\n" + "\n".join(" - " + e for e in errs), file=sys.stderr)
            sys.exit(2)
    ids = [a["id"] for a in manifest["assets"]]
    if len(ids) != len(set(ids)):
        print("duplicate asset ids", file=sys.stderr); sys.exit(2)
    best = load_best(args.best_times)
    blocks = evening_blocks(y, m, args.block_evening)
    excl = {"tiktok": set(), "instagram": set()}
    for e in args.exclude:
        pl, i = e.split(":", 1); excl[pl].add(i)
    warnings = []
    tt = plan_platform("tiktok", manifest["assets"], (y, m), args.start_day, args.used_tiktok, blocks, {}, excl["tiktok"], warnings, best)
    tt_dates = {p["asset"]["id"]: p["date"] for p in tt}
    ig = plan_platform("instagram", manifest["assets"], (y, m), args.start_day, args.used_instagram, blocks, tt_dates, excl["instagram"], warnings, best)
    posts = sorted(tt + ig, key=lambda p: (p["date"], p["time"], p["platform"]))
    for p in posts:
        p["call"] = build_call(p, manifest)
        p["reason"] = slot_reason(p["rank"], p["date"].strftime("%A")) + ("; payday asset on Thu/Fri" if p["payday"] else "")
    used_ids = {p["asset"]["id"] for p in posts}
    leftover = [i for i in ids if i not in used_ids]
    out = {"month": args.month, "timezone": TZ, "brand_id": manifest.get("brand_id", BRAND_ID),
           "counts": {"tiktok": len(tt), "instagram": len(ig)}, "warnings": warnings,
           "evening_blocks": {str(d): n for d, n in sorted(blocks.items())}, "unscheduled_assets": leftover,
           "posts": [{"n": i, "platform": p["platform"], "asset": p["asset"]["id"], "type": p["asset"]["type"],
                      "date": p["date"].isoformat(), "weekday": p["date"].strftime("%a"), "time": p["time"],
                      "payday": p["payday"], "reason": p["reason"], "createScheduledPost": p["call"]}
                     for i, p in enumerate(posts, 1)]}
    os.makedirs(args.out_dir, exist_ok=True)
    jp = os.path.join(args.out_dir, f"schedule-{args.month}.json")
    mp = os.path.join(args.out_dir, f"schedule-{args.month}.md")
    with open(jp, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    table = md_table(posts, args.month, warnings, blocks, leftover)
    with open(mp, "w", encoding="utf-8") as f:
        f.write(table)
    print(table)
    print(f"wrote {jp} and {mp}")


if __name__ == "__main__":
    main()

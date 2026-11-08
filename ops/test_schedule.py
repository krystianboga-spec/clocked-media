#!/usr/bin/env python3
"""Invariant tests for schedule.py. Run: python3 ops/test_schedule.py (standard library only)."""
import datetime as dt, json, os, subprocess, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import schedule as S

MANIFEST = os.path.join(HERE, "manifest.example.json")


def run(month, *extra):
    d = tempfile.mkdtemp()
    subprocess.run([sys.executable, os.path.join(HERE, "schedule.py"), month, "--manifest", MANIFEST, "--out-dir", d, *extra],
                   check=True, capture_output=True)
    with open(os.path.join(d, f"schedule-{month}.json"), encoding="utf-8") as f:
        return json.load(f)


class T(unittest.TestCase):
    def check(self, out, tt, ig):
        posts = out["posts"]
        self.assertEqual(sum(p["platform"] == "tiktok" for p in posts), tt)
        self.assertEqual(sum(p["platform"] == "instagram" for p in posts), ig)
        y, m = map(int, out["month"].split("-"))
        blocks = {dt.date.fromisoformat(k) for k in out["evening_blocks"]}
        seen, byasset = set(), {}
        for p in posts:
            d = dt.date.fromisoformat(p["date"])
            self.assertEqual((d.year, d.month), (y, m))
            self.assertNotIn((p["platform"], d), seen)
            seen.add((p["platform"], d))
            byasset.setdefault((p["asset"], p["date"]), set()).add(p["platform"])
            if d in blocks:
                self.assertLess(p["time"], "17:00")
            if p["payday"]:
                self.assertIn(d.weekday(), (3, 4))
            call = p["createScheduledPost"]
            self.assertTrue(call["info"]["draft"])
            self.assertEqual(call["blogId"], "7724856")
            self.assertEqual(call["info"]["publicationDate"]["timezone"], "America/Chicago")
        for k, v in byasset.items():
            self.assertEqual(len(v), 1, f"{k} on both platforms same day")
        # video/photo mix per platform at 10 posts: 6 + 4
        if tt == 10:
            types = [p["type"] for p in posts if p["platform"] == "tiktok"]
            self.assertEqual((types.count("video"), types.count("photo")), (6, 4))

    def test_dec(self):
        self.check(run("2026-12"), 10, 10)

    def test_feb(self):
        self.check(run("2027-02"), 10, 10)

    def test_late_start_and_used(self):
        out = run("2026-12", "--start-day", "20", "--used-tiktok", "3", "--used-instagram", "5")
        self.check(out, 7, 5)

    def test_nov_2026_election(self):
        out = run("2026-11")
        self.assertIn("2026-11-03", out["evening_blocks"])
        self.check(out, 10, 10)
        self.assertIn("2026-11-26", out["evening_blocks"])

    def test_holidays(self):
        self.assertEqual(S.nth_weekday(2026, 11, 3, 4), dt.date(2026, 11, 26))
        self.assertIn(dt.date(2027, 2, 14), S.evening_blocks(2027, 2))

    def test_top_best_hour(self):
        best = S.load_best(os.path.join(HERE, "best-times.json"))
        out = run("2026-12")
        for p in out["posts"]:
            d = dt.date.fromisoformat(p["date"])
            hours = best[p["platform"]][d.isoweekday()]
            blocked = p["date"] in out["evening_blocks"]
            usable = [h for h in hours if not (blocked and h >= 17)]
            self.assertEqual(p["time"], f"{usable[0]:02d}:00")

    def test_offset(self):
        self.assertEqual(S.dst_offset(dt.date(2026, 12, 5), 21), -6)
        self.assertEqual(S.dst_offset(dt.date(2026, 7, 5), 21), -5)


if __name__ == "__main__":
    unittest.main(verbosity=2)

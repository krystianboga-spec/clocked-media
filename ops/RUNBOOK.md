# Monthly runbook: Clocked organic social (TikTok + Instagram)

You are a fresh Claude session. You have this repo and the Metricool connector, nothing else. Follow every step in order. Do not skip the review step or the approval wait.

Goal each month: 20 posts on Metricool's free plan, 10 on TikTok and 10 on Instagram (the plan caps at 20 per calendar month, counted once per network). That is 6 NEW videos and 4 NEW photo sets. Each video is posted once on TikTok and once on Instagram; each photo set likewise, with platform-specific captions. At most one post per platform per day.

Facts you need: Metricool brand id 7724856, timezone America/Chicago, accounts TikTok and Instagram (clockedai). YouTube is not connected. Repo (public): https://github.com/krystianboga-spec/clocked-media. Media URL pattern: `https://raw.githubusercontent.com/krystianboga-spec/clocked-media/main/<path>`.

## Hard rules (read first, never break)

1. Nothing goes live without Krystian's explicit yes in THIS session, after you showed him the summary table. A yes from an earlier session or month does not count.
2. All 20 posts are created as drafts (`"draft": true`). Only after the yes do you flip them with `updateScheduledPost` (`draft: false`).
3. Never post anything directly, create accounts, or sign in anywhere. You only write files and use the Metricool tools.
4. Follow ops/rules.md. Real features only. No user counts, reviews, ratings, testimonials, invented stats. Every pay figure is an example, adds up, and says "before taxes".
5. No em dashes or en dashes in any file, caption, title or on-screen text.
6. Never reuse a concept id or hook listed in ops/used-concepts.json.
7. Never post partial claims: if an asset fails to render, its captions or math fail review, or media does not load, drop that asset and report it. Do not swap in an unreviewed replacement at the last minute.
8. Never `git push --force`. Commit media and ops files to `main` (or follow what Krystian says about pushing). Do not edit engine/ code except to run it.
9. Media must be reachable at its public raw.githubusercontent.com URL before you create a draft. Check each URL returns HTTP 200 (`curl -sI`).
10. The Metricool free plan cap is a hard stop. Never schedule more than 10 per platform in a calendar month, counting posts already in Metricool for that month.

## Step 0. Set up

```
git clone https://github.com/krystianboga-spec/clocked-media.git && cd clocked-media   # or git pull if it exists
python3 --version        # 3.9+ needed for schedule.py and tests
python3 ops/test_schedule.py   # must say OK
```
Read in full: ops/rules.md, ops/concepts.md, ops/used-concepts.json, engine/README.md (if engine/README.md is missing, read engine/render.cjs and engine/specs/*.json to learn the spec format and command). Decide the target month `YYYY-MM` (the next calendar month unless Krystian said otherwise) and today's date.

## Step 1. Check what Metricool already holds

Call `getScheduledPosts` for the target month (blogId 7724856). Count posts per network already there (published, scheduled, and drafts). If this is a mid-month run, set `--start-day` to at least tomorrow and `--used-tiktok` / `--used-instagram` to those counts. If drafts from an earlier failed run exist for this month, tell Krystian and ask whether to reuse or ignore them; do not delete anything.

## Step 1b. Trend research: the best AI-made short videos this month

Before picking concepts, study what is working right now so this month's set is not a rerun of last month's.

1. Search the web (WebSearch, or Firecrawl search/scrape) for the best AI-generated short-form videos and AI video ads of the last 30 to 45 days. Useful angles: "best AI video ads <month year>", "viral AI generated TikTok <month year>", "AI animation trend", "AI commercial breakdown", brand case studies, AI film festival or award winners, roundups from marketing and creator newsletters, and the format trends TikTok and Instagram themselves publish. Search several angles in the same turn. Skip anything older than 3 months.
2. Pick the 5 to 8 strongest examples. For each one, write down only: link, who made it, what makes it work (hook in the first 2 seconds, visual style, pacing, structure, sound approach, length, loop), and why it fits or does not fit a pay tracker for hourly workers aged 16 to 30.
3. Turn the best 3 to 5 into NEW Clocked concepts ("our own version"): same technique or format, entirely Clocked content. Append them to ops/concepts.md with new ids (prefix `t-YYYY-MM-`), and make at least 2 of this month's 6 videos from them. Each must still be renderable by engine/ (painted p5.brush scenes, 3D, kinetic type, slides); if a technique needs a tool we do not have, translate it into one we do.
4. Save the notes to `ops/research/YYYY-MM.md` (examples table, what we borrowed, which concepts came from it) and commit it with the month's media.

What "our own version" may borrow: format, structure, pacing, camera moves, transition style, color treatment, a general visual style, a trending sound category (never the sound itself). What it may never borrow: another creator's footage, frames, characters, mascots, logos, voice, script lines, music or audio, or a look so close a viewer would think it is theirs or that they endorse Clocked. Never download, re-upload, stitch, duet or remix another video. Never name or tag the original creator or brand in captions. If a trend depends on a real person, a celebrity voice, or another brand's IP, skip it.

## Step 2. Pick concepts

From ops/concepts.md pick **6 video** and **4 photo** concepts whose ids are NOT in ops/used-concepts.json. Rules for the pick:

- Include the month's seasonal hooks (concepts.md lists them by month) for 1 or 2 slots, and at least 1 payday-themed asset (Thu/Fri slot), at most 3.
- Cover at least 3 different features (projected pay, overtime, payday reminder, more than one job) and at least one no-money humor or education piece.
- At most one "email schedule import" teaser, and only if the used log shows none in the last two weeks.
- Vary setting, palette and format against the last two months' entries (`style` in used-concepts.json). If the concepts bank is nearly exhausted, invent new ones in the same shape and add them to concepts.md.
- Re-verify every example calculation with Python before writing it into a spec.

## Step 3. Write the specs

Write `media/YYYY-MM/specs/<id>.json` (video) or `<id>.md` (photo set) for each of the 10 assets. Follow the spec format in engine/README.md for videos. Each spec states: id, hook, on-screen text frame by frame, example math with the sum shown, feature shown, voiced yes/no, the end card, and the TikTok title and the two captions (TikTok single line, Instagram with line breaks). Voice is optional: if engine/README.md says TTS is available and it works, you may voice up to a few videos; if it is unavailable or errors, make them silent. Silent is fine.

## Step 4. Render videos

Use the engine commands in engine/README.md (do not guess them). Render each video once as a clean master (no watermark, no other app's logo); the same file goes to both platforms unless the engine produces separate TikTok and Instagram safe-zone versions. Check each output: duration 3 s to 60 s, vertical 1080x1920, plays, text readable, inside the safe zone, final frame is the end card. Extract 4 frames (`ffmpeg`) and look at them. A video that fails twice is dropped (see Failures).

## Step 5. Make the photo sets

For each of the 4 photo concepts, produce two image sets from the same content: TikTok photo mode 1080x1920 PNG/JPG (3 to 6 slides) and Instagram carousel 1080x1350 (3 to 6 slides, the end card on the last slide). Use the engine's still/slide tooling if engine/README.md has it; otherwise render HTML slides with a headless browser or Pillow using the fonts and colors in ops/rules.md. Same look as the videos. Name files `media/YYYY-MM/<id>/tt-1.png ...` and `ig-1.png ...`. View every slide.

## Step 6. Independent review (separate subagent, mandatory)

Spawn a SEPARATE subagent that did not make the assets. Give it: ops/rules.md, the 10 specs and captions, the manifest draft, and the rendered frames or slides. Ask it to check and return PASS or a numbered fail list for each asset:

- Claims: only the 3 real features; nothing about tips, taxes, net pay, email import working, user counts, ratings, downloads or app stores.
- Math: recompute every figure in Python or by hand; sums add up; "example" and "before taxes" are on screen and in captions; overtime uses 1.5x after 40 hours.
- Captions: TikTok one line, at most 5 hashtags, title present and at most 90 characters; Instagram at most 5 hashtags and "(link in bio)"; CTA wording per rules.md; the two platform captions differ; no em or en dashes; no banned phrases.
- Visuals: safe zone, readable, end card, no faces, no logos of other apps, no QR code, no watermark.
- Slots: no payday asset outside Thu/Fri, nothing in a blocked evening, same asset never both platforms same day, the mix is 6 video + 4 photo per platform.

Fix every failure and re-run the review until it returns PASS. Drop any asset that cannot be fixed.

## Step 7. Commit the media

Write `ops/runs/YYYY-MM/manifest.json` (format: ops/manifest.example.json) with the final captions and repo paths. Add the 10 new entries to ops/used-concepts.json (id, type, month, files, hook, feature, style, math). Commit:
```
git add media/YYYY-MM ops/used-concepts.json ops/runs/YYYY-MM ops/research ops/concepts.md
git commit -m "Add YYYY-MM media and manifest"
git push origin main      # normal push only; if it fails, stop and tell Krystian
```
Then verify every media URL with `curl -sI <url>` (200 and the right content type). If you are not allowed to push, say so and stop before loading drafts, because Metricool needs public URLs.

## Step 8. Get Metricool's best times

Call `getBestTimeToPostByNetwork` for `tiktok` and for `instagram` (blogId 7724856, a one-week range starting next Monday or the target week, timezone America/Chicago). For each ISO weekday (1 = Monday ... 7 = Sunday) rank the returned hours by value, highest first, keep the top 3 or more, and write `ops/best-times.json`:
```
{"tiktok": {"1": [18, 10, 12], "2": [...], ... "7": [...]}, "instagram": {"1": [10, 11, 12], ... "7": [...]}}
```
Every post goes at its platform's top hour for that weekday (minute 00). TikTok and Instagram may post at the same hour on the same day. If the top hour falls in a blocked evening (5 PM on, on a holiday or event night), schedule.py uses the next hour in the list. For a new account these figures are Metricool's general data, not this account's own, so refresh the file every month (and once the account has about 100 followers the numbers become account-specific). If the tool errors, reuse last month's file and tell Krystian.

## Step 9. Generate the schedule

```
python3 ops/schedule.py YYYY-MM --manifest ops/runs/YYYY-MM/manifest.json --best-times ops/best-times.json --out-dir ops/runs/YYYY-MM \
   [--start-day N] [--used-tiktok N] [--used-instagram N] [--exclude tiktok:ID] [--block-evening YYYY-MM-DD]
```
It validates captions against the banned list and hashtag caps (exit code 2 means fix the manifest), then writes `schedule-YYYY-MM.json` (including the exact `createScheduledPost` call for every post, draft true) and `schedule-YYYY-MM.md`. Read any WARNING lines. Check that the Super Bowl table in schedule.py covers the month and add other national event nights with `--block-evening`. Commit the schedule files.

## Step 10. Load drafts into Metricool

For each post in `schedule-YYYY-MM.json`, call `createScheduledPost` with its `blogId`, `date` and `info` exactly as written (draft true). Rules that are already in the JSON, do not change them:

- TikTok silent video: `autoPublish: false` (Metricool pings Krystian's phone to add a commercial-library sound).
- TikTok voiced video: `autoPublish: true`, `tiktokData.isAigc: true` for AI voices.
- TikTok photo set: `autoPublish: true`, `tiktokData.autoAddMusic: true`, several images in `media`.
- Instagram: `autoPublish: true`; video is `type: REEL`, photo set is `type: POST` (carousel); `instagramData.isAiGenerated` true for AI voices.
- `tiktokData.title` set on every TikTok post.

Save the returned ids and uuids to `ops/runs/YYYY-MM/drafts.json` (post number, platform, asset, id, uuid, plannerUrl). Then call `getScheduledPosts` for the month and confirm 10 + 10 drafts at the right dates and times, with media attached. If a call errors, see Failures. Do not retry a rejected post with altered claims.

## Step 11. Message Krystian and wait

Send him the table from `schedule-YYYY-MM.md` (date, day, time, platform, asset, type, sound action), plus: which videos are silent and will ping his phone for a sound, which are AI-voiced and labeled, what was dropped or replaced, and any warnings. Ask a single question: "Reply yes to schedule all 20, or tell me what to change." Then STOP and wait for his reply in this session. Do not infer approval from silence, from an emoji you cannot read, or from "looks fine, maybe".

If he asks for changes: edit the manifest, re-run schedule.py, update the affected drafts (`updateScheduledPost` keeping `draft: true`), show the changed rows, and ask again.

## Step 12. After the yes: switch to scheduled

For every draft, call `updateScheduledPost` with its current `id`, `uuid`, `blogId` and the full original `info` unchanged except `draft: false` (the update replaces the whole post, so resend all fields; the id changes after each update, so use the id returned). Then call `getScheduledPosts` and confirm 20 scheduled posts (none still drafts). Report to Krystian the final list and remind him to add a sound on his phone when a silent TikTok pings him, and to pin the TikTok comment from rules.md after each TikTok goes live.

Finish by committing `ops/runs/YYYY-MM/` (drafts.json, final ids) and tell Krystian the month is done.

## Failures (report, never post partial claims)

- **Render fails or looks wrong:** retry once with the spec simplified. If it fails again, drop that asset, tell Krystian, and fill its slot with the next unused concept from the bank (full pipeline: spec, render, review). If time is short, run the month with fewer posts: schedule.py handles fewer assets and reports leftovers. Never post a half-finished video.
- **TTS unavailable or errors:** make the video silent (autoPublish false on TikTok) and set voiced false. Do not use a voice that was not generated for that exact script.
- **Review fails and cannot be fixed:** drop the asset. Never post an asset with an unreviewed or disputed claim or number.
- **git push fails / media 404:** stop before Step 10. Tell Krystian. Metricool cannot read local files.
- **Metricool error on a draft:** report the exact error text, keep the posts already created, do not create duplicates (check `getScheduledPosts` first), and let Krystian decide. If the monthly cap blocks creation, stop; do not delete other posts to make room.
- **Metricool error on switching to scheduled:** list which posts are still drafts and which are scheduled, so nothing is half-published silently. Retry each failed one once, then report.
- **Krystian does not reply:** leave everything as drafts. Never schedule on your own. A later session must re-ask.
- **Date already in the past (late run):** re-run schedule.py with a later `--start-day`; fewer than 10 per platform is fine.

## Quick checklist

- [ ] tests pass, rules and used log read
- [ ] Metricool month checked, used counts known
- [ ] trend research saved to ops/research/YYYY-MM.md, 3 to 5 new t- concepts added, 2+ used
- [ ] 6 video + 4 photo concepts, none used before, math verified
- [ ] rendered, viewed, reviewed by a separate subagent: PASS
- [ ] committed and pushed, URLs return 200
- [ ] best-times.json refreshed from Metricool
- [ ] schedule.py run, drafts loaded (10 + 10), verified in Metricool
- [ ] summary sent, yes received in this session
- [ ] drafts switched to scheduled, verified, run folder committed

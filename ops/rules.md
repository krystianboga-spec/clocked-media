# Copy and claims rules for Clocked organic social

Copied from the reviewed November 2026 calendar and research so that this folder stands alone. If a rule here conflicts with a creative idea, the rule wins.

## What Clocked is (the only things you may say)

Clocked is a free shift and pay tracker web app for US hourly workers, out now in free beta at clocked.space. Real features:

1. Log shifts and see projected pay before payday, including 1.5x overtime after 40 hours in a workweek.
2. Payday reminders as phone notifications.
3. Track more than one job.

Email schedule import is NOT live. It may appear only as "we're building this next" (TikTok, at most once every two weeks, never with footage that shows it working). Clocked does not track tips, taxes, net pay, or bank deposits. Do not imply any of that.

## Hard claims rules

- No user counts, download counts, reviews, ratings, testimonials, awards, press, or "popular" language. No invented stats of any kind.
- Every pay figure is an example, adds up (verify each sum with Python), and is labeled "example" and "before taxes" on screen and in the caption.
- No tax, legal or financial advice. Overtime explainers say "most hourly jobs pay 1.5x after 40 hours in a workweek (federal rule), some states add more" and "ask payroll". Do not claim combined overtime across two jobs.
- Do not promise holiday pay, tips, raises, refunds, or that anyone's employer pays any particular way.
- It is a web app: never say download, App Store, Google Play, or "search Clocked" (an unrelated iOS app named "Hourly Pay Tracker - Clocked" exists). Always say the full address clocked.space.
- Never show faces, founder names, other apps' logos or UI, watermarks, or QR codes. No engagement bait ("comment 1 for...", giveaways).
- Do not re-upload a downloaded TikTok anywhere. Upload the clean master.

## CTAs (use exactly this wording)

- TikTok: `Try it free at clocked.space and follow for updates.`
- Instagram: `Try it free at clocked.space (link in bio). Follow for updates.`
- Teaser only: `Try it free at clocked.space, and follow to watch the email part get built.`
- Every video and photo set ends on the standard end card: clock icon + CLOCKED wordmark, pill "Free beta · Out now", `clocked.space`, "Try it free in your browser."

## Caption style

- First line carries the search phrase people use ("How much will my paycheck be this week?").
- Say "free beta" once and name what it does in one line. Keep the example math in the caption.
- TikTok: ONE line, no line breaks, max 5 hashtags, `tiktokData.title` required (max 90 characters, plain, no hashtags).
- Instagram: line breaks allowed, max 5 hashtags, include `(link in bio)`. Alt text on slides where possible.
- Hashtags go at the end. Pick 3 to 5 from the sets below. Do not use #overtime on a post that hides the overtime answer.
- The video and the photo sets are posted once on TikTok and once on Instagram with different captions (rewrite, do not paste).
- No em dashes or en dashes anywhere. Use commas, periods, colons, parentheses.

## Hashtag sets

| Theme | Tags |
|---|---|
| Pay, general | #paycheck #hourlyworker #payday #serverlife #retailworker |
| Overtime | #overtime #paycheck #hourlyworker #payday #retailworker |
| Payday | #payday #paycheck #hourlyworker #retailworker #serverlife |
| Two jobs | #twojobs #hourlyworker #paycheck #sidehustle #serverlife |
| First job | #firstjob #hourlyworker #serverlife #retailworker #paycheck |
| Schedule | #workschedule #hourlyworker #retailworker #serverlife #paycheck |
| Seasonal | the theme tag (#blackfriday, #newyear, #backtoschool) replaces one tag above |

## Bios (already set; keep consistent)

- TikTok (80 chars): `Free shift + pay tracker for hourly workers. Free beta now: clocked.space`
- Instagram (150 chars): `Know your paycheck before payday. Free shift + pay tracker web app for hourly workers, now in free beta. Try it free at clocked.space`
- TikTok links are not clickable until 1,000 followers. Instagram bio link is clickable.
- Pinned TikTok comment (manual, after posting): `Clocked is in free beta. Try it free at clocked.space (type the full address, it runs in your browser). Follow for updates.`

## AI labeling

- AI voice or AI-generated visuals that look real: set `tiktokData.isAigc: true` (video) and `instagramData.isAiGenerated: true`. Manifest: `voiced: true` implies `ai_voice: true` unless you set `ai_voice: false`.
- Painted or illustrated motion graphics with no AI voice: label not required, but set it when unsure.
- Silent videos: TikTok `autoPublish: false` (Metricool pings Krystian's phone to add a commercial-library sound). Voiced videos and all Instagram posts: `autoPublish: true`. TikTok photo sets: `autoAddMusic: true`, autoPublish true.
- Music: only Commercial Music Library on TikTok business accounts, Meta Sound Collection on Instagram. No unlicensed music, ever.

## Banned phrases (schedule.py rejects these)

search clocked, coming soon, guarantee, AI-powered, App Store, Google Play, download, take-home, take home, after tax, after-tax, net pay, tax calculator, track tips, tip tracking, tracks your tips, users love, thousands of, rated, "#1 ", best app, sync your, syncs, direct deposit, never miss, scan the QR, link in comments. "import" is allowed only with "building", "not ready" or "next" in the same caption.

## Posting times (Central)

Times come from Metricool's best-time report, not from fixed bands. Each month the run calls `getBestTimeToPostByNetwork` for TikTok and Instagram (brand 7724856, America/Chicago), ranks each weekday's hours, and saves `ops/best-times.json`. `schedule.py` posts each item at the platform's top hour for that weekday, minute 00. TikTok and Instagram may share an hour on the same day; any weekday including Saturday is fine. These are Metricool's general figures for a new account, so refresh them every month.

Still fixed: payday-themed assets go on Thursday or Friday; evenings (5 PM on) stay empty on US federal holidays (including observed days), Election Day (even years), Super Bowl Sunday, Christmas Eve and New Year's Eve, and if a weekday's top hour is in such an evening the next best hour is used. Update `SUPER_BOWLS` in schedule.py each year and add other big national nights with `--block-evening YYYY-MM-DD`.

Background (October 2026 research, for context only): shift workers tend to be on their phones pre-shift and after closing, and many hourly employers pay biweekly or weekly, which is why payday content stays on Thursday and Friday.

## Look (for engine and photo sets)

Dark #0E0F12 background, cards #1A1C21 with 2 px #2A2D34 border, text #F4F4F0, muted #A3A7B0, body #D6D8DC, accent #C8F25A. Anton for headlines (uppercase), Inter for body, JetBrains Mono for every dollar figure. Text inside x 90 to 930, y 180 to 1520 on 1080x1920; 80 px padding on 1080x1350. Vary the setting, palette and format month to month inside this brand (see used-concepts.json "style").

# Independent review, 2026-12 (run 2026-11-20)

Reviewer: a separate subagent that did not make the assets (read-only).

Round 1: 3 PASS (first-job-tips-2, dec-christmas-eve-close, t-2026-12-camera-shy), 5 FAIL:
- t-2026-12-getting-louder: phone showed a notes-app style screen (other app UI); "+5 HRS" stamp outside the safe zone.
- ot-rate-chart: chart slide had dollar figures without "example, before taxes".
- t-2026-12-same-answer: "Clocked logs every shift" implied automatic tracking.
- t-2026-12-day-better: calendar and stamps outside the safe zone and not aligned to days; overtime line lacked "in a workweek, some states add more, ask payroll".
- which-job-pays: cover slide rates without "example, before taxes".

Fixes: lock-screen phone and "+5 CAFE" stamp inside the safe zone; chart note added; captions changed to "Log every shift in Clocked", on-screen line "You logged them."; calendar 800 wide with one stamp per weekday column, overtime line split into "after 40 hours in a workweek" plus "Some states add more. Ask payroll."; cover note added; photo footers moved inside the safe zones. Schedule regenerated and two same-slot swaps applied with ops/runs/2026-12/swap.py.

Round 2: all 8 assets PASS, schedule PASS.

Minor notes left open: count-up animations pass through in-between numbers for under a second (engine behavior, final values add up); day-better posts on IG Dec 23, after the Dec 13 to 19 week it shows; confirm the real payday notification shows the projected amount (camera-shy shows it, as the approved preloaded video does).

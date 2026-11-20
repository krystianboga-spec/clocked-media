"""Hand swaps applied after schedule.py for 2026-12 (seasonal timing). Swaps two posts on the same platform whose slots share weekday and hour,
so every schedule.py rule (Thu/Fri payday, one per day, gaps, no same-day pair, evening blocks) still holds. Re-checks the rules after."""
import json, sys, datetime as dt
p = 'ops/runs/2026-12/schedule-2026-12.json'
s = json.load(open(p))
m = {a['id']: a for a in json.load(open('ops/runs/2026-12/manifest.json'))['assets']}
SWAPS = [('instagram', '2026-12-16', '2026-12-30', 'getting-louder ("December schedule just dropped") moved earlier'),
         ('tiktok', '2026-12-10', '2026-12-24', 'payday-Friday video kept off Christmas Eve')]
P = {(x['platform'], x['date']): x for x in s['posts']}
for plat, d1, d2, why in SWAPS:
    a, b = P[(plat, d1)], P[(plat, d2)]
    assert a['time'] == b['time'] and a['weekday'] == b['weekday']
    for k in ('asset', 'type', 'payday', 'createScheduledPost'):
        a[k], b[k] = b[k], a[k]
    for x, d in ((a, d1), (b, d2)):
        c = x['createScheduledPost']; off = c['date'][19:]
        c['date'] = f"{d}T{x['time']}:00{off}"; c['info']['publicationDate']['dateTime'] = f"{d}T{x['time']}:00"
        x['reason'] = x['reason'].split(';')[0] + f"; hand swap: {why}" + ("; payday asset on Thu/Fri" if x['payday'] else '')
    s['warnings'].append(f"Hand swap after schedule.py ({plat}): {a['asset']} now {d1}, {b['asset']} now {d2}: {why}.")
# instagram alt text for carousels
for x in s['posts']:
    a = m[x['asset']]
    if x['platform'] == 'instagram' and a['type'] == 'photo':
        x['createScheduledPost']['info']['mediaAltText'] = a['instagram']['alt']
# re-check rules
seen = {}
for x in s['posts']:
    d = dt.date.fromisoformat(x['date'])
    assert (x['platform'], x['date']) not in seen; seen[(x['platform'], x['date'])] = x['asset']
    if x['payday']: assert d.weekday() in (3, 4)
    assert x['createScheduledPost']['info']['text'] == m[x['asset']][x['platform']]['caption']
    if x['date'] in ('2026-12-24', '2026-12-25', '2026-12-31'): assert x['time'] < '17:00'
for (pl, d), a in seen.items():
    other = 'tiktok' if pl == 'instagram' else 'instagram'
    assert seen.get((other, d)) != a
json.dump(s, open(p, 'w'), indent=1, ensure_ascii=False)
# rewrite md table
L = open('ops/runs/2026-12/schedule-2026-12.md').read().split('\n')
out = []
for l in L:
    if l.startswith('| ') and '| 2026-12-' in l:
        c = l.split('|'); x = next(y for y in s['posts'] if y['platform'] == c[2].strip() and y['date'] == c[3].strip())
        a = m[x['asset']]
        snd = 'AI voice (labeled)' if a['type'] == 'video' else ('auto music' if x['platform'] == 'tiktok' else 'none')
        c[6], c[7], c[8], c[10] = f" {x['asset']} ", f" {a['type']} ", f" {snd} ", f" {x['reason']} "
        l = '|'.join(c)
    out.append(l)
txt = '\n'.join(out).rstrip('\n') + '\n' + ''.join(f"- NOTE: {w}\n" for w in s['warnings'] if w.startswith('Hand swap'))
open('ops/runs/2026-12/schedule-2026-12.md', 'w').write(txt)
print('swaps applied, rules re-checked')

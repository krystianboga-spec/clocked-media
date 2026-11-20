"""Builds the December 2026 photo sets (TikTok 1080x1920, Instagram 1080x1350) from the slide data below.
Run: python3 media/2026-12/photo-src/make_slides.py  (needs Python Playwright + Chromium)."""
import os, pathlib
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent

CSS = """
@font-face{font-family:Anton;src:url(anton-latin-400-normal.woff2)}
@font-face{font-family:JBM;src:url(jetbrains-mono-latin-700-normal.woff2);font-weight:700}
@font-face{font-family:JBM;src:url(jetbrains-mono-latin-500-normal.woff2);font-weight:500}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:var(--h);background:#0E0F12;color:#F4F4F0;font-family:Inter,sans-serif;overflow:hidden;position:relative}
.bg{position:absolute;inset:0;background:radial-gradient(circle at 85% 8%,rgba(200,242,90,.16),transparent 38%),radial-gradient(circle at 10% 95%,rgba(200,242,90,.08),transparent 40%)}
.wrap{position:absolute;left:var(--l);right:var(--r);top:var(--t);bottom:var(--b);display:flex;flex-direction:column;justify-content:center;gap:34px}
.kicker{font:700 30px JBM,monospace;color:#C8F25A;letter-spacing:2px;text-transform:uppercase}
h1{font-family:Anton;font-weight:400;text-transform:uppercase;font-size:var(--h1);line-height:1.2;letter-spacing:.5px}
h1 em{font-style:normal;color:#0E0F12;background:#C8F25A;padding:0 12px;border-radius:10px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
h2{font-family:Anton;font-weight:400;text-transform:uppercase;font-size:var(--h2);line-height:1.05}
p{font-size:var(--p);line-height:1.35;color:#D6D8DC}
.muted{color:#A3A7B0}
.ticket{background:#1A1C21;border:2px solid #2A2D34;border-radius:28px;padding:var(--pad);position:relative}
.ticket .band{font:700 26px JBM,monospace;letter-spacing:3px;color:#C8F25A;text-transform:uppercase;margin-bottom:22px}
.perf{border-top:3px dashed #2A2D34;margin:26px -8px}
.ticket:before,.ticket:after{content:"";position:absolute;width:44px;height:44px;border-radius:50%;background:#0E0F12;border:2px solid #2A2D34;top:var(--notch);}
.ticket:before{left:-24px;clip-path:inset(0 0 0 50%)}.ticket:after{right:-24px;clip-path:inset(0 50% 0 0)}
.row{display:flex;justify-content:space-between;align-items:baseline;font-size:var(--row);color:#D6D8DC;padding:8px 0;gap:20px}
.row .v,.money{font-family:JBM,monospace;font-weight:500;color:#F4F4F0;white-space:nowrap}
.total{display:flex;justify-content:space-between;align-items:center;font-size:var(--row);font-weight:700;gap:16px}
.total .v{font:700 var(--big) JBM,monospace;color:#0E0F12;background:#C8F25A;padding:6px 18px;border-radius:12px;white-space:nowrap}
.note{font-size:var(--small);color:#A3A7B0}
.num{display:inline-flex;width:var(--badge);height:var(--badge);border-radius:50%;background:#C8F25A;color:#0E0F12;font-family:Anton;font-size:calc(var(--badge)*.6);align-items:center;justify-content:center;flex:none}
.tip{display:flex;gap:28px;align-items:flex-start}
.tip h2{margin-bottom:10px}
.foot{position:absolute;left:var(--l);right:var(--r);bottom:var(--fb);display:flex;justify-content:space-between;font:500 24px JBM,monospace;color:#A3A7B0}
.end{align-items:center;text-align:center;gap:26px}
.word{font-family:Anton;font-size:var(--word);letter-spacing:3px;line-height:1}
.pill{display:inline-block;background:#C8F25A;color:#0E0F12;font-weight:800;font-size:34px;padding:10px 30px;border-radius:999px}
.url{font:700 var(--url) JBM,monospace;color:#C8F25A}
.chart .row{font-size:var(--row);border-bottom:2px solid #2A2D34;padding:16px 0}
.chart .row:last-child{border-bottom:0}
.arrow{color:#C8F25A;font-family:JBM;font-weight:700}
"""
VARS = {
 'tt': dict(h='1920px', l='110px', r='170px', t='230px', b='450px', h1='120px', h2='70px', p='46px', pad='48px', row='44px', big='52px', small='30px', badge='84px', word='150px', url='60px', fb='410px', notch='calc(50% - 22px)'),
 'ig': dict(h='1350px', l='90px', r='90px', t='90px', b='130px', h1='100px', h2='56px', p='36px', pad='40px', row='36px', big='44px', small='26px', badge='76px', word='130px', url='54px', fb='84px', notch='calc(50% - 22px)'),
}
CLOCK = '<svg width="180" height="200" viewBox="0 0 180 200"><rect x="74" y="4" width="32" height="20" rx="6" fill="#C8F25A"/><circle cx="90" cy="112" r="78" fill="#0E0F12" stroke="#C8F25A" stroke-width="14"/><line x1="90" y1="112" x2="90" y2="62" stroke="#F4F4F0" stroke-width="10" stroke-linecap="round"/><line x1="90" y1="112" x2="126" y2="128" stroke="#C8F25A" stroke-width="10" stroke-linecap="round"/><circle cx="90" cy="112" r="9" fill="#F4F4F0"/></svg>'

def endcard(pay):
    extra = '<p class="note">Example figures, before taxes.</p>' if pay else ''
    return f'<div class="wrap end">{CLOCK}<div class="word">CLOCKED</div><span class="pill">Free beta · Out now</span><div class="url">clocked.space</div><p>Try it free in your browser.</p>{extra}</div>'

def page(fmt, inner, idx, n, pay):
    v = VARS[fmt]
    root = ';'.join(f'--{k}:{val}' for k, val in v.items())
    foot = '' if idx == n else f'<div class="foot"><span>CLOCKED</span><span>{idx}/{n}</span></div>'
    return f'<!doctype html><html><head><meta charset="utf-8"><style>:root{{{root}}}{CSS}</style></head><body><div class="bg"></div>{inner}{foot}</body></html>'

def W(*parts):
    return '<div class="wrap">' + ''.join(parts) + '</div>'

def ticket(band, rows, total=None, note=None, perf=True):
    r = ''.join(f'<div class="row"><span>{a}</span><span class="v">{b}</span></div>' for a, b in rows)
    t = f'{"<div class=perf></div>" if perf else ""}<div class="total"><span>{total[0]}</span><span class="v">{total[1]}</span></div>' if total else ''
    nt = f'<p class="note" style="margin-top:18px">{note}</p>' if note else ''
    return f'<div class="ticket"><div class="band">{band}</div>{r}{t}{nt}</div>'

def tip(n, head, body):
    return f'<div class="tip"><span class="num">{n}</span><div><h2>{head}</h2><p>{body}</p></div></div>'

SETS = {
 'first-job-tips-2': dict(pay=False, slides=[
   W('<div class="kicker">Seasonal job, week one</div>', '<h1>Seasonal job? Do these <em>5 things</em> in week one.</h1>', '<p class="muted">Save this for your first shift.</p>'),
   W(tip(1, 'Get the schedule in writing', 'Screenshot it or ask for a copy, every week.'), tip(2, 'Keep your own hours list', 'Start time, end time, breaks. Every shift.')),
   W(tip(3, 'Learn your payday', 'Weekly or every two weeks? Ask on day one.'), tip(4, 'Know when overtime starts', 'Most hourly jobs pay 1.5x after 40 hours in a workweek (federal rule). Some states add more.')),
   W(tip(5, 'Keep your pay stubs', 'Check the hours and the rate. Something off? Ask payroll.'), '<p class="muted">Clocked keeps your hours list and projects your pay before payday.</p>'),
 ]),
 'dec-christmas-eve-close': dict(pay=True, slides=[
   W('<div class="kicker">Christmas Eve close</div>', '<h1>Closing early on Christmas Eve? <em>Log it anyway.</em></h1>', '<p class="muted">Short shifts still count.</p>'),
   W('<h2>The short shift</h2>', ticket('Thu Dec 24 · 12 PM to 5 PM', [('Hours', '5'), ('Rate', '$14.00')], ('5 h x $14.00', '$70.00'), 'Example figures, before taxes.')),
   W('<h2>The whole week</h2>', ticket('Example week', [('Sun Dec 20', '6 h'), ('Mon Dec 21', '6 h'), ('Tue Dec 22', '7 h'), ('Thu Dec 24', '5 h')], ('24 h x $14.00', '$336.00'), 'Projected pay, example figures, before taxes. Holiday pay rules vary by job: ask payroll.')),
 ]),
 'ot-rate-chart': dict(pay=True, slides=[
   W('<div class="kicker">Overtime, in one chart</div>', '<h1>Your <em>overtime rate</em>, in one chart.</h1>', '<p class="muted">Base rate x 1.5. Swipe.</p>'),
   W('<h2>Base rate <span class="arrow">to</span> 1.5x</h2>', '<div class="ticket chart">' + ''.join(f'<div class="row"><span class="money">{a}/hr</span><span class="arrow">to</span><span class="money">{b}/hr</span></div>' for a, b in [('$12.00', '$18.00'), ('$15.00', '$22.50'), ('$18.00', '$27.00'), ('$20.00', '$30.00')]) + '<p class="note" style="margin-top:18px">Example rates, before taxes.</p></div>'),
   W('<h2>Example: 43 hours at $18</h2>', ticket('Example week', [('40 h x $18.00', '$720.00'), ('3 h x $27.00 (1.5x)', '$81.00')], ('Projected', '$801.00'), 'Example figures, before taxes.')),
   W('<h2>The rule</h2>', '<p>Most hourly jobs pay 1.5x after 40 hours in a workweek (federal rule). Some states add more. Not sure? Ask payroll.</p>', '<p class="muted">Clocked counts 1.5x after 40 hours in your projected pay.</p>'),
 ]),
 'which-job-pays': dict(pay=True, slides=[
   W('<div class="kicker">Two jobs, one week</div>', '<h1>Which job pays more <em>this week?</em></h1>', '<p>Job A: $16/hr. Job B: $12/hr.</p>', '<p class="muted">Example figures, before taxes. Guess, then swipe.</p>'),
   W(ticket('Job A', [('Hours', '12'), ('Rate', '$16.00')], ('12 h x $16.00', '$192.00')), ticket('Job B', [('Hours', '18'), ('Rate', '$12.00')], ('18 h x $12.00', '$216.00'), 'Example figures, before taxes.')),
   W('<h2>Job B wins this week</h2>', '<p>More hours beat the higher rate.</p>', ticket('Both jobs', [('Job A', '$192.00'), ('Job B', '+ $216.00')], ('Projected', '$408.00'), 'Example figures, before taxes.'), '<p class="muted">Clocked tracks more than one job in one place.</p>'),
 ]),
}

def main():
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        for sid, d in SETS.items():
            slides = d['slides'] + [endcard(d['pay'])]
            n = len(slides)
            os.makedirs(OUT / sid, exist_ok=True)
            for fmt, h in (('tt', 1920), ('ig', 1350)):
                pg = br.new_page(viewport={'width': 1080, 'height': h})
                for i, inner in enumerate(slides, 1):
                    html = HERE / f'_tmp.html'
                    html.write_text(page(fmt, inner, i, n, d['pay']))
                    pg.goto(html.as_uri()); pg.wait_for_timeout(250)
                    pg.screenshot(path=str(OUT / sid / f'{fmt}-{i}.png'))
                pg.close()
            print(sid, n, 'slides')
        (HERE / '_tmp.html').unlink(missing_ok=True)
        br.close()

if __name__ == '__main__':
    main()

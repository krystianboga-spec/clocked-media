// props.js: painted props. All are drawn centred on (x, y) unless noted, in the current transform.

// a paper card with a soft drop shadow (the base for shift cards, pay cards, stubs)
function paperCard(x, y, w, h, o = {}) {
  pushT(); tr(x, y); rot(o.rot || 0);
  if (o.shadow !== false) shape(boxP(-w / 2 + w * .03, -h / 2 + h * .05, w, h, o.r ?? w * .05), { flat: '#120c18', flatA: 55, line: false, tex: 0 });
  const cp = boxP(-w / 2, -h / 2, w, h, o.r ?? w * .05, o.j ?? 1.2);
  shape(cp, { flat: o.col || PAL.card, line: false, tex: .35, shade: .12, wet: .6 });
  if (o.band) clipTo(cp, () => shape(boxP(-w / 2 - 10, -h / 2 - 10, w + 20, (o.bandH || h * .16) + 10, 0, 1.5), { flat: o.band, line: false, tex: .4, wet: .4 }));
  shape(cp, { line: INK(), lw: o.lw ?? 1.3 });
  popT();
}
// a gold coin, seen at angle `spin` (0 = face on)
function coin(x, y, r, o = {}) {
  const sp = Math.cos(o.spin || 0);
  pushT(); tr(x, y); rot(o.rot || 0); scl(Math.max(.12, Math.abs(sp)), 1);
  shape(ellP(0, 0, r, r, 18), { flat: C.coin, lw: .9, tex: .2, shade: .35, hi: .4, curve: .5 });
  stroke_(arcP(0, 0, r * .72, r * .72, 0, TAU, 14), .5, C.coinDk, 'fine', .5);
  if (Math.abs(sp) > .4) label('$', 0, r * .02, r * 1.05, C.coinDk, {});
  popT();
}
// the phone. h = body height. o.screen: 'clocked' | 'lock' | 'notes' | 'blank' | function(w, h) drawing in screen space
function phone(x, y, h, o = {}) {
  const w = h * .5;
  pushT(); tr(x, y); rot(o.rot || 0);
  if (o.glow) glow(0, 0, w * 1.6, h * .9, '#BDF0F7', 110 * o.glow);
  shape(boxP(-w / 2, -h / 2, w, h, w * .16), { flat: C.phone, lw: 1.2, tex: .2, hi: .25 });
  const sw = w * .86, sh = h * .88;
  shape(boxP(-sw / 2, -sh / 2, sw, sh, w * .1), { flat: o.screenCol || C.screen, line: false, tex: .15 });
  shape(boxP(-w * .12, -sh / 2 + h * .012, w * .24, h * .022, h * .011), { flat: C.phone, line: false, tex: 0 });
  pushT(); tr(-sw / 2, -sh / 2);
  const s = o.screen || 'blank';
  if (typeof s === 'function') s(sw, sh);
  else if (s === 'clocked') screenClocked(sw, sh, o.data || {});
  else if (s === 'lock') screenLock(sw, sh, o.data || {});
  else if (s === 'notes') screenNotes(sw, sh, o.data || {});
  popT();
  popT();
}
function miniClocky(x, y, r) { disc(x, y, r, C.lime, { line: INK(), lw: .5 }); disc(x, y, r * .72, C.face); disc(x - r * .26, y - r * .15, r * .15, '#fff'); disc(x + r * .26, y - r * .15, r * .15, '#fff'); stroke_(arcP(x, y + r * .1, r * .25, r * .16, .4, Math.PI - .4, 5), .4, C.lime, 'fine', .5); }
// Clocked app screen: header, a big projected-pay number, shift rows. d = { title, big, sub, rows: [[left, right], ...], k (0..1 rows shown) }
function screenClocked(w, h, d) {
  shape(boxP(0, 0, w, h * .14, w * .1).slice(0, 10).concat([[w, h * .14], [0, h * .14]]), { flat: C.face, line: false, tex: 0 });
  miniClocky(w * .14, h * .075, h * .035);
  label('Clocked', w * .27, h * .077, h * .045, C.lime, { align: 'left', font: 'anton' });
  label(d.title || 'This pay period', w * .08, h * .2, h * .032, '#6A6F7E', { align: 'left', font: 'ui' });
  label(d.big || '$0.00', w * .08, h * .27, h * .075, C.face, { align: 'left', font: 'anton' });
  if (d.sub) label(d.sub, w * .08, h * .335, h * .03, '#6A6F7E', { align: 'left', font: 'ui' });
  const rows = d.rows || [], k = d.k ?? 1;
  rows.forEach((r, i) => {
    const a = clamp(k * rows.length - i); if (a <= 0) return;
    const y = h * (.42 + i * .1);
    shape(boxP(w * .06, y - h * .04, w * .88, h * .08, h * .02), { flat: i % 2 ? '#F1F4E6' : '#E8F2CF', line: false, tex: 0 });
    label(r[0], w * .11, y, h * .034, C.face, { align: 'left', font: 'ui', alpha: a });
    label(r[1], w * .89, y, h * .034, C.face, { align: 'right', font: 'ui', alpha: a });
  });
}
// lock screen with an optional notification banner. d = { time, date, notif: { title, body, k } }
function screenLock(w, h, d) {
  shape(boxP(0, 0, w, h, w * .1), { flat: '#2D3A6A', line: false, tex: .3 });
  glow(w * .3, h * .3, w * .8, h * .4, '#7FA8E0', 90); glow(w * .8, h * .8, w * .7, h * .4, '#B49CF0', 70);
  label(d.time || '7:42', w / 2, h * .17, h * .11, '#F7F3FF', { font: 'ui', weight: 300 });
  label(d.date || 'Thursday', w / 2, h * .09, h * .03, '#DCD6F5', { font: 'ui' });
  const n = d.notif; if (!n) return;
  const k = n.k ?? 1; if (k <= 0) return;
  const by = lerp(-h * .2, h * .3, over(k, 1.4)), bh = h * (n.h || .19);
  pushT(); tr(0, by);
  shape(boxP(w * .04, 0, w * .92, bh, w * .06), { flat: '#FBFAF5', lw: .6, tex: .1 });
  miniClocky(w * .13, bh * .2, bh * .09);
  label(n.app || 'CLOCKED', w * .23, bh * .2, bh * .085, '#555A66', { align: 'left', font: 'ui', track: 4 });
  label(n.when || 'now', w * .9, bh * .2, bh * .08, '#888C96', { align: 'right', font: 'ui' });
  (n.lines || [n.body]).forEach((L, i) => label(L, w * .09, bh * (.43 + i * .17), bh * (i === 0 ? .11 : .1), '#1F1D26', { align: 'left', font: 'ui', weight: i === 0 ? 700 : 500, maxW: w * .82 }));
  popT();
}
function screenNotes(w, h, d) {
  shape(boxP(0, 0, w, h * .1, w * .1).slice(0, 10).concat([[w, h * .1], [0, h * .1]]), { flat: C.notes, line: false, tex: 0 });
  label('Notes', w * .08, h * .055, h * .04, '#6A4A10', { align: 'left', font: 'ui' });
  (d.lines || []).forEach((L, i) => label(L, w * .08, h * (.17 + i * .07), h * .036, '#3A3550', { align: 'left', maxW: w * .86, rot: (hash(i) - .5) * .05 }));
}
// a week calendar strip: days, one highlighted, an optional payday flag
function calendarStrip(x, y, w, o = {}) {
  const days = o.days || ['M', 'T', 'W', 'T', 'F', 'S', 'S'], n = days.length, cw = w / n, h = o.h || cw * 1.25;
  pushT(); tr(x - w / 2, y - h / 2);
  shape(boxP(-8, -8, w + 16, h + 16, 18), { flat: PAL.card, lw: 1.2, tex: .35, shade: .1 });
  days.forEach((d, i) => {
    const cx = i * cw + cw / 2, on = i === o.hi, pay = i === o.pay;
    if (on) shape(ellP(cx, h * .58, cw * .4, cw * .4, 18, 1.2), { flat: o.hiCol || C.lime, lw: .9, tex: .2 });
    label(d, cx, h * .2, cw * .3, '#6A6577', { font: 'ui' });
    label(String(o.dates ? o.dates[i] : i + 1), cx, h * .6, cw * .38, PAL.cardInk, { font: 'hand' });
    if (pay) { label('$', cx + cw * .32, h * .3, cw * .28, '#2E7D32', {}); if (!on) stroke_(arcP(cx, h * .6, cw * .42, cw * .42, 0, TAU, 14, 1.5), 1.1, PAL.accent, 'pen', .5); }
    if (i < n - 1) stroke_([[cw * (i + 1), h * .1], [cw * (i + 1), h * .9]], .3, '#C9C0B0', 'fine', 0);
  });
  popT();
}
// wall punch clock
function timeClock(x, y, s, o = {}) {
  pushT(); tr(x, y);
  shape(boxP(-s * .5, -s * .7, s, s * 1.4, s * .08), { flat: '#C9CCD3', lw: 1.2, tex: .35, shade: .25 });
  disc(0, -s * .3, s * .3, '#FBF7EC', { line: INK(), lw: .9 });
  const t = o.t ?? TNOW; stroke_([[0, -s * .3], [Math.sin(t * .4) * s * .22, -s * .3 - Math.cos(t * .4) * s * .22]], .8); stroke_([[0, -s * .3], [s * .14, -s * .22]], 1);
  shape(boxP(-s * .3, s * .15, s * .6, s * .1, s * .02), { flat: '#3A3D48', lw: .7, tex: 0 });
  if (o.card != null) { const k = o.card; shape(boxP(-s * .16, s * .15 - s * .55 * (1 - k), s * .32, s * .55, s * .02), { flat: '#F6E7B8', lw: .7, tex: .2 }); }
  popT();
}
// a waist apron as a prop (for juggling): colour, flapping ties
function apronProp(x, y, s, col, o = {}) {
  const t = o.t ?? TNOW;
  pushT(); tr(x, y); rot(o.rot || 0);
  shape([[-s * .5, -s * .3], [s * .5, -s * .3], [s * .45, s * .4], [-s * .45, s * .4]], { flat: col, lw: 1, curve: .2, tex: .45, shade: .25 });
  shape(boxP(-s * .3, -s * .02, s * .6, s * .24, s * .04), { flat: mixC(col, '#ffffff', .2), lw: .6, tex: 0 });
  stroke_([[-s * .5, -s * .3], [-s * .8, -s * .35 + osc(t, 3) * s * .1], [-s * 1.0, -s * .2 + osc(t, 3, .3) * s * .12]], .9, mixC(col, '#000', .2), 'pen', .6);
  stroke_([[s * .5, -s * .3], [s * .8, -s * .35 + osc(t, 3, .5) * s * .1], [s * 1.0, -s * .2 + osc(t, 3, .8) * s * .12]], .9, mixC(col, '#000', .2), 'pen', .6);
  if (o.tag) label(o.tag, 0, s * .1, s * .2, mixC(col, '#000000', .55), {});
  popT();
}
// small icon props for list items: 'screenshot' | 'clockcard' | 'stub' | 'calendar' | 'jar' | 'phone' | 'coins'
function iconProp(kind, x, y, s, o = {}) {
  const t = o.t ?? TNOW;
  pushT(); tr(x, y); rot(o.rot || 0);
  if (kind === 'screenshot') {
    phone(0, 0, s * 1.6, { screen: (w, h) => { label('SCHEDULE', w / 2, h * .1, h * .045, '#555', { font: 'ui', track: 3 }); ['Mon  5-10', 'Wed  4-9', 'Sat  11-5'].forEach((L, i) => { shape(boxP(w * .08, h * (.18 + i * .12), w * .84, h * .09, 6), { flat: '#E8F2CF', line: false, tex: 0 }); label(L, w * .14, h * (.225 + i * .12), h * .04, '#222', { align: 'left', font: 'ui' }); }); } });
    const fl = clamp(1 - fract(t * .8) * 3); if (fl > 0) shape(boxP(-s * .45, -s * .82, s * .9, s * 1.64, s * .08), { flat: '#FFFFFF', flatA: 200 * fl, line: false, tex: 0 });
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) stroke_([[sx * s * .6, sy * s * .7], [sx * s * .6, sy * s * .95], [sx * s * .35, sy * s * .95]], 1.2, PAL.accent, 'pen', 0);
  } else if (kind === 'clockcard') {
    timeClock(0, 0, s * 1.1, { card: clamp(.5 + osc(t, .7) * .5), t });
  } else if (kind === 'stub') {
    paperCard(0, 0, s * 1.3, s * 1.5, { rot: -.05 });
    label('PAY STUB', 0, -s * .55, s * .16, PAL.cardInk, { font: 'ui', track: 4 });
    [['Hours', '32.0'], ['Rate', '$15.00'], ['Gross', '$480.00']].forEach(([a, b], i) => { label(a, -s * .5, -s * .25 + i * s * .3, s * .15, '#555', { align: 'left', font: 'ui' }); label(b, s * .5, -s * .25 + i * s * .3, s * .15, PAL.cardInk, { align: 'right', font: 'ui' }); });
    pushT(); tr(s * .45 + osc(t, .8) * s * .1, s * .1); disc(0, 0, s * .4, '#DDEEF5', { line: INK(), lw: 1.4, extra: { flatA: 120 } }); stroke_([[s * .28, s * .28], [s * .65, s * .65]], 3.4, '#7A4E2E', 'pen', 0); popT();
  } else if (kind === 'calendar') {
    paperCard(0, 0, s * 1.4, s * 1.4, { band: PAL.accent, bandH: s * .3 });
    label('FRIDAY', 0, -s * .55, s * .17, '#FFF8EC', { font: 'ui', track: 4 });
    label('15', 0, s * .12, s * .62, PAL.cardInk, { font: 'anton' });
    stroke_(arcP(0, s * .12, s * .45, s * .4, 0, TAU * .95, 16, 2), 1.4, '#2E7D32', 'pen', .5);
    label('payday', s * .1, s * .53, s * .15, '#2E7D32', {});
  } else if (kind === 'jar') {
    shape([[-s * .45, -s * .5], [s * .45, -s * .5], [s * .5, s * .6], [-s * .5, s * .6]], { flat: '#DDEFF3', flatA: 190, lw: 1.2, curve: .3, tex: 0, hi: .4 });
    for (let i = 0; i < 7; i++) coin(-s * .28 + (i % 3) * s * .28, s * .45 - Math.floor(i / 3) * s * .2, s * .14, { spin: i * .7 });
    shape(boxP(-s * .5, -s * .62, s * 1.0, s * .16, s * .04), { flat: '#B88A5A', lw: 1, tex: .3 });
    label('TIPS', 0, -s * .1, s * .2, PAL.cardInk, { font: 'ui', track: 3 });
    const k = fract(t * .9); coin(s * .1, lerp(-s * 1.2, -s * .4, eIn(k)), s * .14, { spin: t * 9 });
  } else if (kind === 'ask') {
    shape(blobP(0, -s * .1, s * .75, s * .6, 12, .06, 18), { flat: '#FFFDF4', lw: 1.4, tex: .3, curve: .6 });
    shape([[-s * .3, s * .4], [-s * .5, s * .8], [-s * .05, s * .45]], { flat: '#FFFDF4', lw: 1.2, tex: 0 });
    label('?', 0, -s * .1 + osc(t, 1.2) * s * .04, s * .8, PAL.accent, { font: 'anton' });
    label('payroll', s * .05, s * .95, s * .26, PAL.card, { stroke: PAL.ink, strokeW: .2 });
  } else if (kind === 'coins') { for (let i = 0; i < 5; i++) coin(-s * .4 + i * s * .2, -i * s * .08, s * .22, { spin: t * 3 + i }); }
  popT();
}
// a rising stack of coins (count grows with k)
function coinStack(x, y, r, n, k = 1) { const m = Math.round(n * clamp(k)); for (let i = 0; i < m; i++) { pushT(); tr(x + (hash(i) - .5) * r * .2, y - i * r * .32); scl(1, .42); shape(ellP(0, 0, r, r, 16), { flat: i % 2 ? C.coin : mixC(C.coin, C.coinDk, .3), lw: .8, tex: .1 }); popT(); } }
// motion / speed lines radiating from a point
function speedLines(cx, cy, r0, r1, n, col, a = 1, seed = 1) {
  for (let i = 0; i < n; i++) { const ang = hash2(seed, i) * TAU, rr = r0 + hash2(seed + 3, i) * (r1 - r0) * .3; stroke_([[cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr], [cx + Math.cos(ang) * (rr + (r1 - r0) * (.4 + hash(i) * .4)), cy + Math.sin(ang) * (rr + (r1 - r0) * (.4 + hash(i) * .4))]], .9 * a, col, 'pen', 0); }
}
// a comic sound-effect word that pops and wobbles
function sfx(txt, x, y, size, col, age, o = {}) {
  const life = o.life ?? 1.2; if (age < 0 || age > life) return;
  label(txt, x, y, size, col, { pop: age * 4.5, rot: (o.rot ?? -.08) + Math.sin(age * 18) * .04 * (1 - age / life), alpha: 1 - seg(age, life - .25, life), stroke: INK(), strokeW: .18, shadow: true });
}
// a rubber stamp that slams down (for "$33.00 SHORT" and similar)
function stampMark(txt, x, y, size, col, age, o = {}) {
  if (age < 0) return;
  const k = eOut(age / .18), s = lerp(2.4, 1, k), a = clamp(age / .08);
  pushT(); tr(x, y); rot(o.rot ?? -.12); scl(s);
  const w = textW(txt, size, o.font || 'anton') + size * .7, h = size * 1.35;
  shape(boxP(-w / 2, -h / 2, w, h, size * .18, 1.5), { flat: o.bg || '#FFF6EA', flatA: 235 * a, line: col, lw: 2.2, tex: .3 });
  label(txt, 0, size * .04, size, col, { font: o.font || 'anton', alpha: a, track: 2 });
  popT();
}

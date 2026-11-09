// scenes.js — reusable scene templates. A spec shot names a template in "scene" and passes "params".
// Every template receives { t, lt, dur, p, shot, setting } and paints the whole frame. lt = time since the shot
// started (negative or past dur while a transition is still showing it), so all motion is clamped.
//
// Shared param shapes (see README for the full list):
//   cast:  [{ who: sam|clocky|notes|stub|manager, x, y, size, pose:{...}, act, beats:[[t, {pose}]...], enter:{type, at, dur, from},
//            exit:{type, at, dur, to}, path:[[t, x, y]...], layer: 'back'|'front' }]
//   cam:   [[t, cx, cy, zoom, roll], ...] keyframes (shot time), camEase: 'smooth'|'out'|'snap'|'linear', shake:[[t, amount]], drift: n
//   props: [{ kind, x, y, size, at, ...kind options }]   fx: [{ type: sfx|stamp|coins|lines|spark, at, ... }]

const SPEAKER_OF = { sam: 'SAM', clocky: 'CLOCKY', notes: 'NOTES', manager: 'MANAGER', stub: 'STUB' };
const CAST_FN = { sam, clocky, notes, stub, manager };
const EASE = { smooth: eInOut, out: eOut, in: eIn, linear: x => clamp(x), snap: x => eOut(clamp(x) * 1.6), back: over };

// ---------- camera ----------
function camAt(lt, p, dur) {
  const ks = p.cam || [[0, 540, 960, 1, 0], [dur, 540, 960, 1.05, 0]];
  let [cx, cy, z, r] = keys(lt, ks.map(k => [k[0], [k[1], k[2], k[3], k[4] || 0]]), EASE[p.camEase || 'smooth']);
  if (p.drift !== 0) { const [dx, dy] = drift(lt + (p.seed || 0), p.drift ?? .6); cx += dx; cy += dy; }
  for (const [ts, amt] of p.shake || []) { const k = hit(lt, ts, 8); if (k > .01) { const [sx, sy] = shake(lt, amt * k); cx += sx; cy += sy; } }
  return [cx, cy, z, r];
}

// ---------- cast ----------
const ACTS = {
  idle: () => ({}),
  talk: (lt, s, c) => ({ dy: Math.abs(osc(lt, 2.2)) * s * .03 * (c.talking ? 1 : 0), aR: c.talking ? -.6 + osc(lt, .9) * .45 : undefined }),
  bounce: (lt, s) => { const k = Math.abs(Math.sin(lt * Math.PI * 2.4)); return { dy: k * s * .35, sq: k < .15 ? .2 : -.08 }; },
  hop: (lt, s) => { const k = seg(lt, .05, .5); return { dy: Math.sin(k * Math.PI) * s * .7, sq: k >= 1 ? hit(lt, .5, 10) * .3 : -.12 * Math.sin(k * Math.PI) }; },
  point: (lt, s) => ({ aR: .25 + osc(lt, .8) * .05, aL: -.7 }),
  pointL: (lt, s) => ({ aL: .25 + osc(lt, .8) * .05, aR: -.7 }),
  shrug: (lt, s) => { const k = smooth(seg(lt, .1, .4)); return { aL: lerp(-1.3, .15, k), aR: lerp(-1.3, .15, k), headTilt: .1 * k, eyes: 'closed', dy: k * s * .04 }; },
  cheer: (lt, s) => { const k = Math.abs(Math.sin(lt * Math.PI * 2.2)); return { aL: 1.15 + k * .2, aR: 1.15 + k * .2, dy: k * s * .25, eyes: 'happy', mouth: 'grin' }; },
  sigh: (lt, s) => ({ lean: .06 + osc(lt, .25) * .02, aL: -1.55, aR: -1.55, mouth: 'sigh', eyes: 'tired', headTilt: -.06 }),
  wave: (lt, s) => ({ aR: .95 + osc(lt, 2.2) * .3 }),
  think: (lt, s, c) => c.who === 'sam' ? { tgtR: [s * .45, -s * 7.45], eyes: 'side', headTilt: .08 } : { aR: .9, spin: .2, eyes: 'look', lookX: .6, lookY: -.6 },
  phone: (lt, s, c) => ({ tgtR: [s * .55, -s * 5.6], tgtL: [-s * .1, -s * 5.3], eyes: 'dead', lookY: .8, headTilt: .1, handR: u => phone(-u * .15, -u * .45, u * 1.7, { rot: -.15, screen: c.screen || 'notes', data: c.screenData, glow: .6 }) }),
  wipe: (lt, s) => ({ tgtR: [s * (.8 + osc(lt, 1.4) * 1.1), -s * 3.8], lean: .12, eyes: 'tired' }),
  juggle: (lt, s) => { const k = lt * 2.4; return { tgtL: [-s * 1.3 + Math.sin(k * Math.PI) * s * .3, -s * (6.6 + Math.max(0, Math.sin(k * Math.PI)) * .9)], tgtR: [s * 1.3 - Math.sin(k * Math.PI) * s * .3, -s * (6.6 + Math.max(0, -Math.sin(k * Math.PI)) * .9)], eyes: 'wide', lookY: -.9, mouth: 'wavy', emote: 'sweat', emoteK: 1 }; },
  write: (lt, s) => ({ pencil: true, aR: -.2 + osc(lt, 3) * .25 }),
  float: (lt, s) => ({ dy: s * .08 + osc(lt, .6) * s * .05, legs: true }),
};
function castMember(c, lt, dur, t) {
  const s = c.size || 100;
  // timed beats: the latest beat wins; changing beats does a squash "take" and pops its emote
  let pose = { ...(c.pose || {}) }, act = c.act || 'idle', tb = -99;
  for (const [bt, bp] of c.beats || []) if (lt >= bt) { pose = { ...pose, ...bp }; if (bp.act) act = bp.act; tb = bt; }
  const take = hit(lt, tb, 9), spk = SPEAKER_OF[c.who];
  const tk = spk ? talk(spk, t) : 0;
  const a = (ACTS[act] || ACTS.idle)(lt, s, { ...c, talking: tk > .05 });
  let o = { t, ...a, ...pose, talk: tk };
  if (a.handR && !pose.handR) o.handR = a.handR;
  if (take > .02) { o.sq = (o.sq || 0) + take * .22; if (o.emote) o.emoteK = Math.min(o.emoteK ?? 1, seg(lt, tb, tb + .25)); }
  // position: path keys or fixed
  let x = c.x ?? 540, y = c.y ?? 1560;
  if (c.path) [x, y] = keys(lt, c.path.map(k => [k[0], [k[1], k[2]]]), EASE[c.pathEase || 'smooth']);
  let sc = 1, alpha = 1;
  const en = c.enter, ex = c.exit;
  if (en) {
    const k = seg(lt, en.at || 0, (en.at || 0) + (en.dur || .45));
    if (lt < (en.at || 0)) return;
    if (en.type === 'pop') sc = over(k, 2.2);
    else if (en.type === 'slide') x += (en.from === 'right' ? 1 : -1) * (1 - eOut(k)) * (en.dist || 900);
    else if (en.type === 'drop') { y -= (1 - eIn(k)) * (en.dist || 1400); if (k >= 1) o.sq = (o.sq || 0) + hit(lt, (en.at || 0) + (en.dur || .45), 10) * .4; }
    else if (en.type === 'rise') y += (1 - over(k, 1.4)) * (en.dist || 900);
    else if (en.type === 'peek') x += (en.from === 'right' ? 1 : -1) * (1 - over(k, 1.6)) * (en.dist || 400);
    if (en.type === 'slide' && k < 1 && (c.who === 'sam' || c.who === 'clocky')) o.walk = lt * 2.2;
  }
  if (ex && lt > ex.at) {
    const k = seg(lt, ex.at, ex.at + (ex.dur || .4));
    if (ex.type === 'pop') sc *= 1 - eIn(k);
    else if (ex.type === 'slide') x += (ex.to === 'left' ? -1 : 1) * eIn(k) * (ex.dist || 1000);
    else if (ex.type === 'jump') { y -= eIn(k) * 1600; o.sq = -.2; }
    if (sc <= .01) return;
  }
  pushT(); tr(x, y); scl(sc);
  CAST_FN[c.who](0, 0, s, o);
  popT();
  if (c.juggle) juggleItems(c.juggle, x, y, s, lt, t);
}
function juggleItems(items, x, y, s, lt, t) {
  const n = items.length;
  items.forEach((it, i) => {
    const ph = fract(lt * .8 + i / n), side = Math.floor(lt * .8 + i / n) % 2 ? 1 : -1;
    const jx = x + lerp(-s * 1.4, s * 1.4, side > 0 ? ph : 1 - ph), jy = y - s * 7.2 - Math.sin(ph * Math.PI) * s * 4.2;
    const rotv = lt * 5 + i * 2;
    if (it.kind === 'apron') apronProp(jx, jy, s * 1.3, it.col, { rot: rotv * .3, tag: it.tag, t });
    else if (it.kind === 'phone') phone(jx, jy, s * 1.9, { rot: rotv * .5, screen: 'clocked', data: it.data || { big: '$331.50', title: 'This week' } });
    else if (it.kind === 'coin') coin(jx, jy, s * .5, { spin: rotv });
    else if (it.kind === 'card') { paperCard(jx, jy, s * 2.2, s * 1.4, { rot: rotv * .2, band: it.col }); if (it.tag) label(it.tag, jx, jy + s * .15, s * .45, PAL.cardInk, { rot: rotv * .2 }); }
  });
}
function drawCast(list, lt, dur, t, layer) { for (const c of list || []) if ((c.layer || 'mid') === layer) castMember(c, lt, dur, t); }

// ---------- props & fx ----------
function drawProps(list, lt, t, layer = 'mid') {
  for (const pr of list || []) {
    if ((pr.layer || 'mid') !== layer || lt < (pr.at || 0)) continue;
    const k = over(seg(lt, pr.at || 0, (pr.at || 0) + .35), 2), x = pr.x ?? 540, y = (pr.y ?? 1000) + (pr.bob ? osc(lt, .7, pr.x || 0) * pr.bob : 0), s = pr.size || 100;
    pushT(); tr(x, y); scl(k); rot(pr.rot || 0);
    if (pr.kind === 'phone') phone(0, 0, s, { screen: pr.screen, data: screenData(pr.data, lt), glow: pr.glow });
    else if (pr.kind === 'coin') coin(0, 0, s, { spin: t * (pr.spin ?? 3) });
    else if (pr.kind === 'coins') coinStack(0, 0, s, pr.n || 8, seg(lt, pr.at || 0, (pr.at || 0) + .8));
    else if (pr.kind === 'calendar') calendarStrip(0, 0, s, pr);
    else if (pr.kind === 'timeclock') timeClock(0, 0, s, { card: pr.card ?? 1, t });
    else if (pr.kind === 'apron') apronProp(0, 0, s, pr.col || C.apron, { tag: pr.tag, t });
    else if (pr.kind === 'icon') iconProp(pr.icon, 0, 0, s, { t });
    else if (pr.kind === 'card') { paperCard(0, 0, s, pr.h || s * .6, { band: pr.band }); (pr.lines || []).forEach((L, i) => label(L, 0, -(pr.h || s * .6) * .2 + i * s * .14, s * .1, PAL.cardInk, { font: pr.font || 'hand' })); }
    else if (pr.kind === 'stub') stub(0, 0, s, { amount: pr.amount, t });
    popT();
  }
}
function screenData(d, lt) { if (!d) return d; const o = { ...d }; if (d.rowsAt != null) o.k = seg(lt, d.rowsAt, d.rowsAt + (d.rowsDur || 1)); if (d.notif) o.notif = { ...d.notif, k: seg(lt, d.notif.at || 0, (d.notif.at || 0) + .45) }; if (d.bigCount) o.big = countText(d.big, seg(lt, d.bigCount[0], d.bigCount[1])); return o; }
function drawFx(list, lt, t) {
  for (const f of list || []) {
    const age = lt - (f.at || 0); if (age < 0) continue;
    if (f.type === 'sfx') sfx(f.text, f.x, f.y, f.size || 110, f.col || '#FFE27A', age, { life: f.life ?? 1.1, rot: f.rot });
    else if (f.type === 'stamp') stampMark(f.text, f.x, f.y, f.size || 90, f.col || '#D9483B', age, { rot: f.rot, bg: f.bg });
    else if (f.type === 'coins') for (let i = 0; i < (f.n || 14); i++) { const d = i * .06, a = age - d; if (a < 0) continue; const x = (f.x0 ?? 100) + hash(i * 3) * ((f.x1 ?? 980) - (f.x0 ?? 100)), y = (f.y0 ?? -100) + a * a * 1800 + a * 300; if (y < (f.floor ?? 1600)) coin(x, y, f.size || 46, { spin: a * 12 + i }); else coin(x, f.floor ?? 1600, f.size || 46, { spin: 0 }); }
    else if (f.type === 'lines') { const k = clamp(1 - age / (f.life || .6)); if (k > 0) speedLines(f.x, f.y, f.r0 || 260, f.r1 || 700, f.n || 18, f.col || INK(), k, f.seed || 1); }
    else if (f.type === 'spark') { const k = seg(age, 0, .5); if (k < 1) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = (f.r || 120) * (.4 + eOut(k)); shape(starP(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, (f.s || 22) * (1 - k), .4, 4), { flat: f.col || '#FFE27A', lw: .5, tex: 0 }); } }
    else if (f.type === 'label') label(f.text, f.x, f.y, f.size || 70, f.col || PAL.card, { pop: age * 4, rot: f.rot, stroke: f.stroke ?? INK(), strokeW: .16, font: f.font, alpha: f.until ? 1 - seg(lt, f.until, f.until + .2) : 1 });
  }
}
// "$660.00" counting up: replaces the last number in a string with its value at progress k (keeps decimals)
function countText(s, k) {
  const m = [...String(s).matchAll(/[\d,]+(\.\d+)?/g)]; if (!m.length) return s;
  const last = m[m.length - 1], dp = last[1] ? last[1].length - 1 : 0, v = parseFloat(last[0].replace(/,/g, '')) * eOut(k);
  const txt = v.toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return s.slice(0, last.index) + txt + s.slice(last.index + last[0].length);
}

// ---------- the scene templates ----------
const SCENES = {
  // general purpose: a setting, a cast, props and fx under a moving camera
  stage({ t, lt, dur, p, setting: st }) {
    const [cx, cy, z, r] = camAt(lt, p, dur);
    camOn(cx, cy, z, r);
    setting(p.setting || st, t, p.set || {});
    drawProps(p.props, lt, t, 'back'); drawCast(p.cast, lt, dur, t, 'back');
    drawProps(p.props, lt, t, 'mid'); drawCast(p.cast, lt, dur, t, 'mid');
    if (p.table) { const tb = p.table; shape(boxP(-200, tb.y, 1480, 900, 14), { flat: tb.col || '#B98A5E', lw: 1.5, tex: .5, shade: .15 }); stroke_([[-200, tb.y + 30], [1280, tb.y + 32]], .6, mixC(tb.col || '#B98A5E', '#000', .3), 'fine', 0); }
    drawProps(p.props, lt, t, 'front'); drawCast(p.cast, lt, dur, t, 'front');
    drawFx(p.fx, lt, t);
    camOff();
    drawFx(p.screenFx, lt, t);
  },

  // two characters talking. The camera leans toward whoever is speaking (from the voice track or the shot's speaker)
  // and can whip between them. params: setting, left, right (cast specs), whip:true (fast whip pans), base:[cx,cy,z]
  dialogue(ctx) {
    const { t, lt, dur, p, shot } = ctx;
    const L = { x: 300, y: 1560, ...p.left }, R = { x: 790, y: 1560, ...p.right };
    const sp = shot.speaker, leftSpk = SPEAKER_OF[L.who] === sp, rightSpk = SPEAKER_OF[R.who] === sp;
    const base = p.base || [540, 1080, 1.0];
    const tgt = leftSpk ? [base[0] - 50, base[1], base[2] * 1.07] : rightSpk ? [base[0] + 50, base[1], base[2] * 1.07] : base;
    const k = (p.whip ? EASE.snap : eInOut)(seg(lt, .05, p.whip ? .3 : 1.6));
    SCENES.stage({ ...ctx, p: { ...p, cam: p.cam || [[0, ...lerpArr(base, tgt, k), p.roll || 0], [dur, ...lerpArr(base, tgt, k).map((v, i) => i === 2 ? v * 1.03 : v), p.roll || 0]], cast: [L, R, ...(p.cast || [])] } });
  },

  // card reveal: a painted card slides in; rows type on and numbers count up; an optional total stamps down.
  // params: setting/set, card: { x, y, w, title, band, rows:[{ l, r, at, count, hl, strike, col }], total:{ l, r, at, count },
  //   rot, enterAt }, host: cast spec, stamp: { text, at, x, y, col, size }, fx, cam
  card(ctx) {
    const { t, lt, dur, p } = ctx;
    const cd = p.card, w = cd.w || 860, rows = cd.rows || [], rh = cd.rowH || 118, th = cd.title ? 150 : 40;
    const h = th + rows.length * rh + (cd.total ? rh * 1.35 : 0) + 50;
    const x = cd.x ?? 540, y0 = cd.y ?? 1000, ea = cd.enterAt ?? 0;
    const ke = eOut(seg(lt, ea, ea + .45)), y = y0 + (1 - ke) * 1400, rot0 = (cd.rot ?? -.025) + (1 - ke) * .25;
    const [cx, cy, z, r] = camAt(lt, p, dur);
    camOn(cx, cy, z, r);
    setting(p.setting || 'wash', t, p.set || {});
    if (p.dim) { applyMat(CTX); CTX.fillStyle = rgba(p.dimCol || PAL.ink, p.dim); CTX.fillRect(-400, -400, W + 800, H + 800); }
    drawCast(p.cast, lt, dur, t, 'back');
    if (p.host) castMember(p.host, lt, dur, t);
    pushT(); tr(x, y); rot(rot0 + osc(lt, .4) * .004);
    paperCard(0, 0, w, h, { band: cd.band, bandH: th * .82, col: cd.col });
    if (cd.title) label(cd.title, 0, -h / 2 + th * .42, cd.titleSize || 58, cd.band ? (cd.titleCol || '#FFFBF0') : PAL.cardInk, { font: cd.titleFont || 'anton', track: 3, maxW: w * .86 });
    rows.forEach((rw, i) => {
      const ry = -h / 2 + th + rh * (i + .55), a = seg(lt, rw.at ?? 0, (rw.at ?? 0) + .2);
      if (a <= 0) return;
      const ck = rw.count ? seg(lt, rw.at ?? 0, (rw.at ?? 0) + (rw.countDur || .7)) : 1;
      if (rw.hl) { const hk = eOut(seg(lt, (rw.at ?? 0) + .1, (rw.at ?? 0) + .5)); shape(boxP(-w * .46, ry - rh * .36, w * .92 * hk, rh * .72, 18), { flat: rw.hl === true ? C.limeLt : rw.hl, flatA: 230, line: false, tex: .3 }); }
      label(rw.l, -w * .43, ry, rw.size || 54, rw.lcol || '#5A5566', { align: 'left', alpha: a, maxW: w * .5, font: rw.lfont || 'hand' });
      label(rw.count ? countText(rw.r, ck) : rw.r, w * .43, ry, rw.size || 58, rw.col || PAL.cardInk, { align: 'right', alpha: a, pop: rw.pop ? seg(lt, rw.at, rw.at + .3) : null, font: rw.rfont || 'hand', maxW: w * .5 });
      if (rw.strike) { const sk = eOut(seg(lt, rw.strike, rw.strike + .3)); if (sk > 0) stroke_([[w * .05, ry + 6], [w * .05 + w * .4 * sk, ry - 4]], 2.2, '#D9483B', 'pen', 0); }
      if (i < rows.length - 1 || cd.total) stroke_([[-w * .43, ry + rh * .5], [w * .43, ry + rh * .5]], .35, '#CFC5B4', 'fine', 0);
    });
    if (cd.total) {
      const tt = cd.total, ty = -h / 2 + th + rh * rows.length + rh * .75, a = seg(lt, tt.at ?? 0, (tt.at ?? 0) + .2);
      if (a > 0) {
        const ck = tt.count ? seg(lt, tt.at, tt.at + (tt.countDur || .9)) : 1, pk = over(seg(lt, tt.at, tt.at + .35), 2.4);
        stroke_([[-w * .45, ty - rh * .6], [w * .45, ty - rh * .62]], 1.4, PAL.cardInk, 'pen', .2);
        label(tt.l, -w * .43, ty, tt.size ? tt.size * .8 : 56, PAL.cardInk, { align: 'left', alpha: a, font: 'hand' });
        pushT(); tr(w * .43, ty); scl(pk);
        if (tt.swash !== false) { const sk = eOut(seg(lt, tt.at + .1, tt.at + .5)); shape(blobP(-w * .17, 0, w * .2 * sk + 1, rh * .42, 77, .12, 14), { flat: tt.swashCol || C.lime, flatA: 220, line: false, tex: .4, curve: .7 }); }
        label(tt.count ? countText(tt.r, ck) : tt.r, 0, 0, tt.size || 80, tt.col || PAL.cardInk, { align: 'right', font: 'anton' });
        popT();
      }
    }
    popT();
    drawCast(p.cast, lt, dur, t, 'mid');
    if (p.stamp) stampMark(p.stamp.text, p.stamp.x ?? 540, p.stamp.y ?? 1400, p.stamp.size || 84, p.stamp.col || '#D9483B', lt - p.stamp.at, { rot: p.stamp.rot, bg: p.stamp.bg });
    drawCast(p.cast, lt, dur, t, 'front');
    drawFx(p.fx, lt, t);
    camOff();
  },

  // list reveal (one tip per shot): number badge, an illustrated icon prop, done tips as small notes on a strip.
  // params: n, total, icon, done:[short labels], setting/set, cast, accent
  list(ctx) {
    const { t, lt, dur, p } = ctx;
    const [cx, cy, z, r] = camAt(lt, { cam: [[0, 540, 960, 1.12, -.02], [.35, 540, 960, 1.0, 0], [dur, 540, 940, 1.04, .01]], camEase: 'out', ...p }, dur);
    camOn(cx, cy, z, r);
    setting(p.setting || 'studio', t, p.set || {});
    drawCast(p.cast, lt, dur, t, 'back');
    // number badge
    const bk = over(seg(lt, .05, .4), 2.4), bx = p.badgeX ?? 250, by = p.badgeY ?? 720;
    pushT(); tr(bx, by); scl(bk); rot(-.12 + osc(lt, .5) * .03);
    shape(blobP(0, 0, 150, 140, 5 + p.n, .1, 16, 1.5), { flat: p.accent || C.lime, lw: 1.6, tex: .5, shade: .25, curve: .6 });
    label(String(p.n), 0, 8, 190, PAL.ink, { font: 'anton' });
    if (p.total) label(`of ${p.total}`, 0, 112, 34, PAL.ink, { font: 'hand' });
    popT();
    // the icon prop
    const ik = over(seg(lt, .2, .6), 1.8), ix = p.iconX ?? 700, iy = p.iconY ?? 900;
    if (ik > 0) { pushT(); tr(ix, iy + (1 - ik) * 200); scl(ik); rot(osc(lt, .6) * .04); iconProp(p.icon, 0, 0, p.iconSize || 210, { t }); popT(); }
    // done tips strip
    (p.done || []).forEach((d, i) => {
      const nx = 150 + i * 205, ny = 1395;
      pushT(); tr(nx, ny); rot((hash(i + 3) - .5) * .12);
      shape(boxP(-92, -62, 184, 124, 6), { flat: ['#F6D86B', '#F4B2A2', '#A8D8C8', '#C9B8F0'][i % 4], lw: 1, tex: .4 });
      label(String(i + 1), -62, -32, 40, PAL.ink, { font: 'anton' });
      label(d, 0, 16, 32, PAL.ink, { maxW: 165 });
      stroke_([[30, -42], [48, -24], [80, -60]], 1.4, '#2E7D32', 'pen', .2);
      popT();
    });
    drawCast(p.cast, lt, dur, t, 'mid');
    drawFx(p.fx, lt, t);
    camOff();
  },

  // before / after: two stacked panels with a painted divider. params: before:{ label, setting, set, cast, props, lines },
  // after:{ label, setting, set, cast, props }, afterAt (when the AFTER panel wipes in), divider colour
  split(ctx) {
    const { t, lt, dur, p } = ctx;
    const top = [0, 0, W, 980], bot = [0, 980, W, 940], ak = eInOut(seg(lt, p.afterAt ?? .9, (p.afterAt ?? .9) + .5));
    // whole frame background
    setting(p.setting || 'wash', t, p.set || {});
    const panel = (rc, sub, cxy, pa, k) => {
      const c = CTX; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      const path = new Path2D(); const x1 = rc[0] + rc[2] * k; path.moveTo(rc[0], rc[1]); for (let i = 0; i <= 12; i++) path.lineTo(x1 + (k < 1 ? Math.sin(i * 1.7) * 18 : 0), rc[1] + rc[3] * i / 12); path.lineTo(rc[0], rc[1] + rc[3]); path.closePath();
      c.clip(path);
      camOn(cxy[0], cxy[1], cxy[2] || 1, 0);
      setting(sub.setting || 'wash', t, sub.set || {});
      drawProps(sub.props, lt, t, 'mid'); drawCast(sub.cast, lt, dur, t, 'mid'); drawFx(sub.fx, lt, t);
      camOff(); c.restore();
      const tag = sub.label; if (tag) { const tx = rc[0] + 70, ty = rc[1] + (pa ? 70 : 60); pushT(); tr(tx, ty); rot(-.04); const tw = textW(tag, 54, 'anton') + 50; shape(boxP(-12, -40, tw, 80, 14, 1), { flat: pa ? C.lime : '#F4B2A2', lw: 1.2, tex: .3 }); label(tag, tw / 2 - 12, 2, 54, PAL.ink, { font: 'anton', track: 3 }); popT(); }
    };
    const bc = p.before.cam || [540, 1130, 1.25], acam = p.after.cam || [540, 820, 1.25];
    panel([0, 450, W, 520], { ...p.before, label: p.before.label }, [bc[0] + drift(lt, .5)[0], bc[1], bc[2]], false, 1);
    if (ak > 0) panel([0, 990, W, 560], { ...p.after, label: p.after.label }, [acam[0], acam[1] + drift(lt + 3, .3)[1], acam[2]], true, ak);
    // painted frames + divider
    applyMat(CTX);
    shape(boxP(18, 450, W - 36, 520, 22, 1.4), { line: INK(), lw: 1.8 });
    if (ak > 0) shape(boxP(18, 990, W - 36, 560, 22, 1.4), { line: INK(), lw: 1.8 });
    drawFx(p.fx, lt, t);
  },

  // countdown: a big painted number flips in over a calendar strip. params: n, unit ('days to payday'), day (label),
  // cal:{ days, dates, hi, pay }, setting/set, cast, from (previous number shown flipping away)
  countdown(ctx) {
    const { t, lt, dur, p } = ctx;
    const [cx, cy, z, r] = camAt(lt, { cam: [[0, 540, 960, 1.0, 0], [dur, 540, 960, 1.0, 0]], drift: .25, ...p }, dur);
    camOn(cx, cy, z, r);
    setting(p.setting || 'busstop', t, p.set || {});
    drawCast(p.cast, lt, dur, t, 'back');
    // flip card
    const fx = p.x ?? 540, fy = p.y ?? 820, fw = 470, fh = 520, fk = seg(lt, .05, .45);
    pushT(); tr(fx, fy); rot(-.03);
    shape(boxP(-fw / 2 + 16, -fh / 2 + 22, fw, fh, 40), { flat: '#000000', flatA: 60, line: false, tex: 0 });
    shape(boxP(-fw / 2, -fh / 2, fw, fh, 40), { flat: PAL.card, lw: 1.8, tex: .45, shade: .15 });
    for (const sd of [-1, 1]) shape(ellP(sd * fw * .3, -fh / 2, 18, 30, 12), { flat: '#3A3D48', lw: .8, tex: 0 });
    // lower half shows the new number; upper half flips from the old number to the new
    pushT(); const c = CTX; applyMat(c); c.save(); c.beginPath(); c.rect(-fw / 2, 0, fw, fh / 2); c.clip();
    label(String(p.n), 0, 10, 400, PAL.cardInk, { font: 'anton' }); c.restore(); popT();
    const flipS = Math.cos(fk * Math.PI);
    pushT(); scl(1, Math.abs(flipS) + .001); const c2 = CTX; applyMat(c2); c2.save(); c2.beginPath(); c2.rect(-fw / 2, flipS > 0 ? -fh / 2 : 0, fw, fh / 2); c2.clip();
    shape(boxP(-fw / 2 + 2, flipS > 0 ? -fh / 2 + 2 : 0, fw - 4, fh / 2 - 2, 38), { flat: mixC(PAL.card, '#000', fk > .5 ? .0 : .08 * fk * 2), line: false, tex: .3 });
    label(String(fk < .5 ? (p.from ?? p.n + 1) : p.n), 0, 10, 400, PAL.cardInk, { font: 'anton' }); c2.restore(); popT();
    stroke_([[-fw / 2, 0], [fw / 2, 0]], 1.2, '#3A3D48', 'pen', 0);
    popT();
    label(p.unit || 'days to payday', fx, fy + fh / 2 + 70, 66, PAL.card, { stroke: PAL.ink, strokeW: .2, shadow: true, pop: seg(lt, .3, .6) });
    if (p.cal) calendarStrip(540, p.calY ?? 1330, 860, { ...p.cal, hi: lt > .5 ? p.cal.hi : p.cal.prev ?? p.cal.hi });
    drawCast(p.cast, lt, dur, t, 'mid');
    drawFx(p.fx, lt, t);
    camOff();
  },

  // phone notification: a hand-held phone, a buzz, a banner drops. params: setting/set, phone:{ x, y, h, rot },
  // notif:{ at, app, when, lines:[...] }, time, date, cast, cam, glow
  notify(ctx) {
    const { t, lt, dur, p } = ctx;
    const [cx, cy, z, r] = camAt(lt, { cam: [[0, 540, 1000, 1.0, 0], [dur, 540, 990, 1.08, 0]], ...p }, dur);
    camOn(cx, cy, z, r);
    setting(p.setting || 'busstop', t, p.set || {});
    drawCast(p.cast, lt, dur, t, 'back');
    const ph = p.phone || {}, nAt = p.notif?.at ?? .5, buzz = lt > nAt - .05 && lt < nAt + .5 ? Math.sin(lt * 90) * 7 * (1 - seg(lt, nAt, nAt + .5)) : 0;
    const px = (ph.x ?? 540) + buzz, py = ph.y ?? 1010, hh = ph.h ?? 900;
    glow(px, py, hh * .9, hh * .8, C.lime, 70 * seg(lt, nAt, nAt + .3));
    // the hand holding it
    pushT(); tr(px, py); rot(ph.rot ?? -.04);
    shape(limbP(hh * .1, hh * .9, hh * .22, hh * .28, hh * .17, hh * .15), { flat: C.shirt, lw: 1.2, tex: .35, shade: .2 });
    phone(0, 0, hh, { screen: 'lock', data: { time: p.time || '7:42', date: p.date || 'Thursday', notif: p.notif ? { ...p.notif, k: seg(lt, nAt, nAt + .45) } : null } });
    shape(ellP(hh * .26, hh * .24, hh * .12, hh * .17, 14), { flat: C.skin, lw: 1.1, tex: .25, shade: .2 });
    for (let i = 0; i < 3; i++) shape(ellP(-hh * .25, hh * (.05 + i * .1), hh * .055, hh * .04, 10), { flat: C.skin, lw: .9, tex: 0 });
    popT();
    if (Math.abs(buzz) > .5) for (const sd of [-1, 1]) stroke_([[px + sd * hh * .3, py - hh * .2], [px + sd * hh * .36, py - hh * .1], [px + sd * hh * .3, py]], 1.1, PAL.card, 'pen', .5);
    drawCast(p.cast, lt, dur, t, 'mid');
    drawFx(p.fx, lt, t);
    camOff();
  },

  // montage: comic panels that pop in. params: panels:[{ at, rect:[x,y,w,h], setting, set, cast, props, cam:[cx,cy,z], label, labelCol }]
  montage(ctx) {
    const { t, lt, dur, p } = ctx;
    setting(p.setting || 'wash', t, p.set || {});
    const [mx, my, mz, mr] = camAt(lt, { cam: [[0, 540, 960, 1, 0], [dur, 540, 960, 1.03, 0]], drift: .3, ...p }, dur);
    camOn(mx, my, mz, mr);
    for (const pn of p.panels) {
      const k = over(seg(lt, pn.at || 0, (pn.at || 0) + .35), 1.8); if (k <= 0) continue;
      const [x, y, w, h] = pn.rect, rr = pn.rot || 0;
      pushT(); tr(x + w / 2, y + h / 2); rot(rr); scl(k); tr(-w / 2, -h / 2);
      shape(boxP(10, 14, w, h, 18), { flat: '#000', flatA: 70, line: false, tex: 0 });
      const c = CTX; applyMat(c); c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
      const pc = pn.cam || [540, 1000, 1];
      pushT(); tr(w / 2, h / 2); scl(pc[2] * w / W); tr(-pc[0], -pc[1]);
      setting(pn.setting || 'wash', t, pn.set || {});
      drawProps(pn.props, lt - (pn.at || 0), t, 'mid'); drawCast(pn.cast, lt - (pn.at || 0), dur, t, 'mid'); drawFx(pn.fx, lt - (pn.at || 0), t);
      popT(); c.restore();
      shape(boxP(0, 0, w, h, 18, 1.2), { line: INK(), lw: 2 });
      if (pn.label) { const tw = textW(pn.label, 50, 'anton') + 44; shape(boxP(22, h - 92, tw, 70, 14, 1), { flat: pn.labelCol || C.lime, lw: 1.2, tex: .3 }); label(pn.label, 22 + tw / 2, h - 56, 50, PAL.ink, { font: 'anton', track: 3 }); }
      popT();
    }
    drawCast(p.cast, lt, dur, t, 'mid');
    drawFx(p.fx, lt, t);
    camOff();
  },

  // title card: big painted hand-lettered lines that pop in one by one. params: lines:[{ text, at, size, col, rot }], setting/set, cast
  title(ctx) {
    const { t, lt, dur, p } = ctx;
    const [cx, cy, z, r] = camAt(lt, { cam: [[0, 540, 960, 1.0, 0], [dur, 540, 960, 1.07, 0]], ...p }, dur);
    camOn(cx, cy, z, r);
    setting(p.setting || 'studio', t, p.set || {});
    drawCast(p.cast, lt, dur, t, 'back');
    (p.lines || []).forEach((L, i) => {
      const k = seg(lt, L.at ?? i * .25, (L.at ?? i * .25) + .35); if (k <= 0) return;
      const y = (p.y0 ?? 330) + i * (p.gap ?? 128);
      if (L.swash) { const sk = eOut(seg(lt, (L.at ?? 0) + .15, (L.at ?? 0) + .5)); shape(blobP(540, y + 8, 420 * sk + 1, 62, 30 + i, .1, 14), { flat: L.swash, flatA: 230, line: false, tex: .4, curve: .7 }); }
      label(L.text, 540, y, L.size || 104, L.col || PAL.card, { pop: k, rot: L.rot ?? (i % 2 ? .025 : -.03), stroke: PAL.ink, strokeW: .2, shadow: true, maxW: 860 });
    });
    drawProps(p.props, lt, t, 'mid'); drawCast(p.cast, lt, dur, t, 'mid');
    drawFx(p.fx, lt, t);
    camOff();
  },

  // end card (added automatically): Clocky, the CLOCKED wordmark, the beta pill, the URL, and the figures note
  endcard(ctx) {
    const { t, lt, dur, p } = ctx;
    const [cx, cy, z, r] = camAt(lt, { cam: [[0, 540, 960, 1.1, .03], [.6, 540, 960, 1.0, 0], [dur, 540, 960, 1.02, 0]], camEase: 'out', drift: .2 }, dur);
    camOn(cx, cy, z, r);
    setting('studio', t, { plate: { a: '#23252E', b: '#2E3140', c: LIME, cy: 760 } });
    const ck = seg(lt, .1, .55);
    clocky(540, 1010 + (1 - over(ck, 1.6)) * 900, 200, { t, eyes: lt > .6 ? (p.eyes || 'happy') : 'wide', mouth: 'grin', aR: lt > .7 ? .95 + osc(lt, 2) * .25 : -.4, aL: -.6, talk: talk('CLOCKY', t), glow: .6, sq: hit(lt, .55, 9) * .25 });
    camOff();
    const wk = seg(lt, .35, .7);
    label('CLOCKED', 540, 1130, 200, '#F7F4EA', { font: 'anton', pop: wk, track: 3, shadow: '#000000' });
    const pk = seg(lt, .6, .9);
    if (pk > 0) { pushT(); tr(540, 1290); scl(over(pk, 2)); const tw = textW('Free beta · Out now', 50, 'hand') + 80; shape(boxP(-tw / 2, -46, tw, 92, 46, .8), { flat: C.lime, lw: 1.3, tex: .3 }); label('Free beta · Out now', 0, 2, 50, '#1F1D26', {}); popT(); }
    label('clocked.space', 540, 1400, 74, C.lime, { pop: seg(lt, .8, 1.1), shadow: '#000000' });
    if (SPEC.showsPay) label('Example figures, before taxes.', 540, 1478, 36, '#CFCBD8', { font: 'ui', weight: 500, alpha: seg(lt, 1.0, 1.3) });
  },
};
function lerpArr(a, b, k) { return a.map((v, i) => lerp(v, b[i], k)); }

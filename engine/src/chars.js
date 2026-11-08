// chars.js — the painted cast. Every character is drawn at a ground point (x, y = where its feet touch) with a size unit.
// Shared pose options: dy (hop, px), sq (squash: + squashes, - stretches), rot, flip, aL/aR (arm angles, radians:
// 0 = straight out, + raised, - lowered), talk (0..1 mouth open; use talk('WHO', t)), eyes/mouth names, emote/emoteK.
const C = CAST_COL;

// emote marks that pop beside a head: sweat, spark, heart, '!', '?', '!?', zzz, anger, music
function emoteMark(kind, x, y, s, k = 1) {
  if (!kind || k <= .02) return; const q = over(k, 2);
  pushT(); tr(x, y); scl(q);
  if (kind === 'sweat') { shape([[0, -s], [s * .55, s * .2], [0, s * .6], [-s * .55, s * .2]], { flat: '#9ED6F2', line: INK(), lw: .5, curve: .7 }); }
  else if (kind === 'spark') { for (let i = 0; i < 3; i++) shape(starP(Math.cos(i * 2.1) * s * .9, Math.sin(i * 2.1) * s * .9, s * (.55 - i * .12), .35, 4), { flat: '#FFE27A', line: INK(), lw: .4 }); }
  else if (kind === 'heart') { const p = []; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, hx = 16 * Math.pow(Math.sin(a), 3), hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); p.push([hx * s / 16, hy * s / 16]); } shape(p, { flat: '#EE6B86', line: INK(), lw: .5 }); }
  else if (kind === 'anger') { for (let i = 0; i < 4; i++) { pushT(); rot(i * Math.PI / 2); stroke_([[s * .2, s * .2], [s * .7, s * .35], [s * .35, s * .7]], .6, '#E0533D', 'pen', .3); popT(); } }
  else if (kind === 'zzz') { label('z', 0, 0, s * 1.2, '#FFFBEF', { font: 'hand', stroke: INK(), strokeW: .2 }); label('z', s * .8, -s * .9, s * .9, '#FFFBEF', { font: 'hand', stroke: INK(), strokeW: .2 }); }
  else if (kind === 'music') { stroke_([[0, s * .5], [0, -s * .6], [s * .5, -s * .4]], .6); disc(-s * .15, s * .5, s * .22, INK()); }
  else label(kind, 0, 0, s * 1.6, kind.includes('!') ? '#FFE27A' : '#FFFBEF', { font: 'hand', stroke: INK(), strokeW: .22, shadow: false });
  popT();
}
// a blink that is a pure function of time
const blinkAt = (t, seed = 0) => { const ph = fract((t + hash(seed) * 3) / 3.4); return ph < .045 ? 1 - Math.abs(ph / .0225 - 1) : 0; };

// ================= CLOCKY: round clock mascot, lime rim, dark face, clock hands, big eyes, little arms =================
// clocky(x, y, R, o) — R = body radius. Extra options: hh/mh (hour/minute hand angles; default: slow tick from t),
// spin (hands spin fast, 0..1), lookX/lookY (-1..1), blush, legs:false, walk (phase), handL/handR(s) hooks drawn at the hands.
function clocky(x, y, R, o = {}) {
  const t = o.t ?? 0, sq = o.sq || 0, legH = o.legs === false ? 0 : R * .42;
  const sx = 1 + sq * .5, sy = 1 - sq * .6;
  pushT(); tr(x, y - (o.dy || 0));
  if (o.shadow !== false) shape(ellP(0, 0, R * .85, R * .14, 16), { flat: '#000000', flatA: 40, line: false, curve: .9 });
  if (o.flip) scl(-1, 1);
  rot(o.rot || 0);
  // legs
  if (legH) {
    const w = o.walk ?? null;
    for (const s of [-1, 1]) {
      const ph = w == null ? 0 : Math.sin(w * TAU + (s > 0 ? Math.PI : 0));
      const fx = s * R * .32 + ph * R * .18, fy = -Math.max(0, ph) * R * .12 * (w == null ? 0 : 1);
      stroke_([[s * R * .28, -legH - R * .1], [fx, fy - R * .08]], 1.5, INK(), 'pen', .3);
      shape(ellP(fx + s * R * .06, fy - R * .05, R * .17, R * .09, 14), { flat: C.face, line: INK(), lw: .6, curve: .8 });
      shape(ellP(fx + s * R * .03, fy - R * .09, R * .08, R * .03, 8), { flat: C.lime, line: false });
    }
  }
  tr(0, -legH - R); scl(sx, sy);
  // stopwatch crown + side bells
  shape(boxP(-R * .12, -R * 1.2, R * .24, R * .2, R * .04), { flat: C.limeDk, line: INK(), lw: .7 });
  shape(boxP(-R * .2, -R * 1.3, R * .4, R * .12, R * .05), { flat: C.lime, line: INK(), lw: .7 });
  for (const s of [-1, 1]) { pushT(); rot(s * .62); shape(boxP(-R * .07, -R * 1.16, R * .14, R * .14, R * .04), { flat: C.limeDk, line: INK(), lw: .6 }); popT(); }
  // arms (behind body when lowered)
  const arm = (s, a) => {
    const sx0 = s * R * .9, sy0 = R * .1, L = R * .75;
    const hx = sx0 + s * Math.cos(a) * L, hy = sy0 - Math.sin(a) * L;
    stroke_(bendP(sx0, sy0, hx, hy, s * .18, 5), 1.6, INK(), 'pen', .6);
    const hook = s < 0 ? o.handL : o.handR;
    if (hook) { pushT(); tr(hx, hy); hook(R); popT(); }
    shape(ellP(hx, hy, R * .14, R * .13, 12), { flat: C.lime, line: INK(), lw: .6, curve: .8 });
  };
  const aL = o.aL ?? -.7, aR = o.aR ?? -.7;
  // rim and face
  shape(ellP(0, 0, R, R, 30, R * .006), { flat: C.lime, line: INK(), lw: 1.25, curve: .5 });
  shape(arcP(0, 0, R * .93, R * .93, .2, 1.9, 10).concat(arcP(0, 0, R * .82, R * .82, 1.9, .2, 10)), { flat: C.limeDk, flatA: 150, line: false });
  stroke_(arcP(0, 0, R * .92, R * .92, 3.6, 4.6, 6), .9, C.limeLt, 'fine', .5);
  shape(ellP(0, 0, R * .8, R * .8, 28), { flat: C.face, line: INK(), lw: .7, curve: .5 });
  shape(blobP(-R * .22, -R * .25, R * .45, R * .38, 7, .15, 14), { flat: C.faceLt, flatA: 120, line: false, curve: .8 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r0 = i % 3 ? R * .7 : R * .64; stroke_([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * R * .75, Math.sin(a) * R * .75]], i % 3 ? .35 : .55, i % 3 ? '#8A90A0' : C.lime, 'fine', 0); }
  // clock hands (pivot just under the eyes)
  const spin = o.spin || 0, mh = (o.mh ?? (t * .5)) + spin * t * 18, hh = (o.hh ?? (t * .04 + 1.2)) + spin * t * 1.5;
  const hand = (a, L, w) => { const ca = Math.sin(a), sa = -Math.cos(a); shape([[-sa * w, ca * w], [ca * L - sa * w * .5, sa * L + ca * w * .5], [ca * L * 1.08, sa * L * 1.08], [ca * L + sa * w * .5, sa * L - ca * w * .5], [sa * w, -ca * w]], { flat: '#F5F1E4', line: false }); };
  hand(hh, R * .38, R * .045); hand(mh, R * .56, R * .032);
  disc(0, 0, R * .055, C.lime, { line: INK(), lw: .4 });
  // eyes
  const eyes = o.eyes || 'open', lx = (o.lookX || 0) * R * .07, ly = (o.lookY || 0) * R * .07;
  const bl = eyes === 'open' || eyes === 'look' || eyes === 'wide' ? blinkAt(t, 3) : 0;
  for (const s of [-1, 1]) {
    const ex = s * R * .3, ey = -R * .24, rx = R * (eyes === 'wide' ? .2 : .17), ry = R * (eyes === 'wide' ? .25 : .22);
    if (eyes === 'happy' || (eyes === 'wink' && s > 0)) { stroke_(arcP(ex, ey + ry * .3, rx * .9, ry * .7, Math.PI * 1.1, Math.PI * 1.9, 6), 1.1, C.eye, 'pen', .6); continue; }
    if (eyes === 'closed' || bl > .5) { stroke_([[ex - rx, ey + ry * .1], [ex, ey + ry * .3], [ex + rx, ey + ry * .1]], 1, C.eye, 'pen', .6); continue; }
    if (eyes === 'star') { shape(starP(ex, ey, rx * 1.15, .45, 4), { flat: C.lime, line: C.eye, lw: .5 }); continue; }
    shape(ellP(ex, ey, rx, ry * (1 - bl), 18), { flat: C.eye, line: INK(), lw: .5, curve: .7 });
    const pr = eyes === 'wide' ? rx * .38 : rx * .55;
    disc(ex + lx + s * R * .015, ey + ly + R * .02, pr, C.pupil);
    disc(ex + lx - pr * .35, ey + ly - pr * .35, pr * .32, '#FFFFFF');
    if (eyes === 'tired') shape([[ex - rx * 1.1, ey - ry * 1.1], [ex + rx * 1.1, ey - ry * 1.1], [ex + rx * 1.1, ey - ry * .1], [ex - rx * 1.1, ey - ry * .1]], { flat: C.face, line: false });
  }
  if (o.brows) for (const s of [-1, 1]) { const b = o.brows === 'up' ? -.06 : o.brows === 'worried' ? s * .05 : o.brows === 'angry' ? -s * .06 : 0; stroke_([[s * R * .16, -R * .5 + b * R * -s], [s * R * .42, -R * .5 + b * R * s]], .8, C.lime, 'pen', .2); }
  // mouth
  const tk = clamp(o.talk || 0), m = o.mouth || 'smile', my = R * .3;
  if (tk > .05 || m === 'open' || m === 'O') {
    const oh = R * (m === 'O' ? .2 : .06 + tk * .16), ow = R * (m === 'O' ? .13 : .2 - tk * .03);
    shape(ellP(0, my + oh * .3, ow, oh, 16), { flat: '#3D1620', line: C.lime, lw: .5, curve: .7 });
    if (oh > R * .1) shape(ellP(0, my + oh * .85, ow * .55, oh * .3, 10), { flat: '#F27D8A', line: false });
  } else if (m === 'grin') {
    shape(arcP(0, my - R * .06, R * .24, R * .2, .1, Math.PI - .1, 10), { flat: '#3D1620', line: C.lime, lw: .5 });
    shape(boxP(-R * .17, my - R * .04, R * .34, R * .06), { flat: C.eye, line: false });
  } else if (m === 'flat') stroke_([[-R * .12, my], [R * .12, my + R * .01]], .8, C.lime, 'pen', .3);
  else if (m === 'frown') stroke_(arcP(0, my + R * .12, R * .14, R * .1, Math.PI * 1.15, Math.PI * 1.85, 6), .8, C.lime, 'pen', .6);
  else if (m === 'wobble') stroke_([[-R * .16, my], [-R * .08, my - R * .03], [0, my + R * .01], [R * .08, my - R * .03], [R * .16, my]], .8, C.lime, 'pen', .5);
  else stroke_(arcP(0, my - R * .06, R * .16, R * .12, .35, Math.PI - .35, 8), .9, C.lime, 'pen', .6);
  if (o.blush !== false) for (const s of [-1, 1]) disc(s * R * .5, R * .1, R * .08, '#F28C8C', { ry: R * .05, extra: { flatA: 150 } });
  arm(-1, aL); arm(1, aR);
  emoteMark(o.emote, R * .95, -R * 1.05, R * .3, o.emoteK ?? 1);
  popT();
}

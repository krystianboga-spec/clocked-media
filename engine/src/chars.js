// chars.js — the painted cast. Every character is drawn at a ground point (x, y = where its feet touch) with a size unit.
// Shared pose options: t (time, for blinks and idle motion), dy (hop, px), sq (squash: + squashes, - stretches), rot,
// flip, aL/aR (arm angles, radians: 0 = straight out, + raised, - lowered), handL/handR (hooks called at the hand to
// draw held props), talk (0..1 mouth open; use talk('WHO', t)), eyes/mouth/brows names, emote/emoteK, lookX/lookY.
const C = CAST_COL;

// ---------- shared bits ----------
function emoteMark(kind, x, y, s, k = 1) {
  if (!kind || k <= .02) return; const q = over(clamp(k), 2);
  pushT(); tr(x, y); scl(q); rot(osc(TNOW, 1.3) * .08);
  if (kind === 'sweat') { shape([[0, -s], [s * .55, s * .2], [s * .3, s * .55], [-s * .3, s * .55], [-s * .55, s * .2]], { flat: '#A8DDF5', lw: .7, curve: .8, tex: 0, hi: .4 }); }
  else if (kind === 'spark') { for (let i = 0; i < 3; i++) shape(starP(Math.cos(i * 2.1 + .4) * s * .9, Math.sin(i * 2.1 + .4) * s * .9, s * (.6 - i * .13), .34, 4), { flat: '#FFE27A', lw: .5, tex: 0 }); }
  else if (kind === 'heart') { const p = []; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; p.push([16 * Math.pow(Math.sin(a), 3) * s / 16, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * s / 16]); } shape(p, { flat: '#EE6B86', lw: .7, tex: 0, hi: .3 }); }
  else if (kind === 'anger') { for (let i = 0; i < 4; i++) { pushT(); rot(i * Math.PI / 2 + .3); stroke_([[s * .18, s * .5], [s * .2, s * .2], [s * .5, s * .18]], 1.3, '#E0533D', 'pen', .3); popT(); } }
  else if (kind === 'zzz') { label('z', 0, 0, s * 1.3, '#FFFBEF', { stroke: INK(), strokeW: .22 }); label('z', s * .9, -s * 1, s, '#FFFBEF', { stroke: INK(), strokeW: .22 }); }
  else if (kind === 'music') { stroke_([[0, s * .5], [0, -s * .6], [s * .55, -s * .35]], 1.1); disc(-s * .17, s * .52, s * .24, INK()); }
  else if (kind === 'swirl') { const p = []; for (let i = 0; i < 26; i++) { const a = i * .5, r = s * (.1 + i * .028); p.push([Math.cos(a) * r, Math.sin(a) * r]); } stroke_(p, 1, '#FFFBEF', 'pen', .5); }
  else label(kind, 0, 0, s * 1.7, kind.includes('!') ? '#FFE27A' : '#FFFBEF', { stroke: INK(), strokeW: .24 });
  popT();
}
const blinkAt = (t, seed = 0) => { const ph = fract((t + hash(seed) * 3) / 3.3); return ph < .05 ? 1 - Math.abs(ph / .025 - 1) : 0; };
// ground shadow
function groundShadow(w, a = 46) { shape(ellP(0, 0, w, w * .17, 18), { flat: '#140f1c', flatA: a, line: false, curve: .9, tex: 0 }); }
// arm geometry: from shoulder (sx, sy), angle a (0 = out to the side s, + up), length L; or explicit target
function armPts(sx, sy, s, a, L, target, bend = .22) {
  const hx = target ? target[0] : sx + s * Math.cos(a) * L, hy = target ? target[1] : sy - Math.sin(a) * L;
  return bendP(sx, sy, hx, hy, -s * bend, 6);
}

// ================= CLOCKY: round stopwatch mascot — lime rim, dark face, clock hands, big eyes, little arms =================
// clocky(x, y, R, o): R = body radius. o.hh/o.mh hour/minute hand angles (default: ticking with t), o.spin (hands
// whirl, 0..1), o.legs:false, o.walk (phase), o.blush:false, o.glow (lime aura 0..1).
function clocky(x, y, R, o = {}) {
  const t = o.t ?? TNOW, sq = o.sq || 0, legH = o.legs === false ? 0 : R * .42;
  const breath = o.still ? 0 : osc(t, .55) * .025;
  const sx = 1 + sq * .45 - breath * .5, sy = 1 - sq * .55 + breath;
  pushT(); tr(x, y - (o.dy || 0));
  if (o.shadow !== false) groundShadow(R * .8 * (1 - clamp((o.dy || 0) / (R * 3)) * .5));
  if (o.flip) scl(-1, 1);
  rot(o.rot || 0);
  if (o.glow) glow(0, -legH - R, R * 1.9, R * 1.9, C.lime, 90 * o.glow);
  if (legH) {
    const w = o.walk;
    for (const s of [-1, 1]) {
      const ph = w == null ? 0 : Math.sin(w * TAU + (s > 0 ? Math.PI : 0));
      const fx = s * R * .3 + ph * R * .16, fy = w == null ? 0 : -Math.max(0, ph) * R * .14;
      stroke_([[s * R * .26, -legH - R * .15], [s * R * .28 + ph * R * .08, -legH * .5], [fx, fy - R * .07]], 1.7, INK(), 'pen', .5);
      shape(ellP(fx + s * R * .07, fy - R * .055, R * .19, R * .1, 14), { flat: C.face, lw: .8, curve: .8, tex: 0, hi: .35 });
      shape(ellP(fx + s * R * .03, fy - R * .1, R * .085, R * .035, 8), { flat: C.lime, line: false, tex: 0 });
    }
  }
  tr(0, -legH - R); scl(sx, sy);
  const tk = clamp(o.talk || 0);
  // crown + bells
  pushT(); tr(0, -tk * R * .03);
  shape(boxP(-R * .11, -R * 1.2, R * .22, R * .22, R * .04), { flat: C.limeDk, lw: .9, tex: .3 });
  shape(boxP(-R * .21, -R * 1.31, R * .42, R * .13, R * .06), { flat: C.lime, lw: .9, shade: .3 });
  popT();
  for (const s of [-1, 1]) { pushT(); rot(s * .64); shape(boxP(-R * .075, -R * 1.17, R * .15, R * .15, R * .05), { flat: C.limeDk, lw: .8, tex: .3 }); popT(); }
  const arm = (s, a) => {
    const pts = armPts(s * R * .88, R * .12, s, a, R * .78, s < 0 ? o.tgtL : o.tgtR, .2), h = pts[pts.length - 1];
    stroke_(pts, 2.3, INK(), 'pen', .6);
    const hook = s < 0 ? o.handL : o.handR;
    if (hook) { pushT(); tr(h[0], h[1]); hook(R); popT(); }
    shape(ellP(h[0], h[1], R * .15, R * .14, 12), { flat: C.lime, lw: .8, curve: .8, tex: .2, shade: .3 });
  };
  const aL = o.aL ?? -.75 + osc(t, .5) * .05, aR = o.aR ?? -.75 - osc(t, .5, .3) * .05;
  if (aL < -1.2) arm(-1, aL); if (aR < -1.2) arm(1, aR);
  // rim and face
  shape(ellP(0, 0, R, R, 30, R * .005), { flat: C.lime, lw: 1.5, curve: .5, shade: .38, hi: .35, tex: .45, light: [-.09, -.11] });
  shape(ellP(R * .015, R * .02, R * .79, R * .79, 28), { flat: C.face, lw: .9, curve: .5, tex: .25, hi: .55, light: [.07, .09], shadeCol: '#000000' });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r0 = i % 3 ? R * .69 : R * .62; stroke_([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * R * .74, Math.sin(a) * R * .74]], i % 3 ? .45 : .8, i % 3 ? '#7C8396' : C.lime, 'pen', 0); }
  if (o.glowFace) glow(0, 0, R * .75, R * .75, C.lime, 70 * o.glowFace);
  // clock hands
  const spin = o.spin || 0, mh = (o.mh ?? (t * .45)) + spin * t * 16, hh = (o.hh ?? (t * .04 + 1.15)) + spin * t * 1.4;
  const hand = (a, L, w) => { const ca = Math.sin(a), sa = -Math.cos(a); shape([[-sa * w, ca * w], [ca * L * .9 - sa * w * .6, sa * L * .9 + ca * w * .6], [ca * L * 1.06, sa * L * 1.06], [ca * L * .9 + sa * w * .6, sa * L * .9 - ca * w * .6], [sa * w, -ca * w]], { flat: '#F5F1E4', line: false, tex: 0 }); };
  hand(hh, R * .36, R * .05); hand(mh, R * .55, R * .035);
  disc(0, 0, R * .06, C.lime, { line: INK(), lw: .5 });
  // eyes
  const eyes = o.eyes || 'open', lx = (o.lookX || 0) * R * .07, ly = (o.lookY || 0) * R * .07;
  const bl = (eyes === 'open' || eyes === 'look' || eyes === 'wide') && !o.noBlink ? blinkAt(t, o.seed ?? 3) : 0;
  for (const s of [-1, 1]) {
    const ex = s * R * .3, ey = -R * .25, rx = R * (eyes === 'wide' ? .21 : .175), ry = R * (eyes === 'wide' ? .26 : .225);
    if (eyes === 'happy' || (eyes === 'wink' && s > 0)) { stroke_(arcP(ex, ey + ry * .35, rx * .95, ry * .75, Math.PI * 1.08, Math.PI * 1.92, 7), 1.6, C.eye, 'pen', .6); continue; }
    if (eyes === 'closed' || bl > .5) { stroke_([[ex - rx, ey + ry * .1], [ex, ey + ry * .32], [ex + rx, ey + ry * .1]], 1.4, C.eye, 'pen', .6); continue; }
    if (eyes === 'star') { shape(starP(ex, ey, rx * 1.2, .42, 4, -Math.PI / 2 + TNOW * 2), { flat: C.lime, line: C.eye, lw: .6, tex: 0 }); continue; }
    shape(ellP(ex, ey, rx, ry * (1 - bl * .9), 18), { flat: C.eye, lw: .6, curve: .7, tex: 0, shade: .12, light: [-.1, -.12] });
    const pr = eyes === 'wide' ? rx * .36 : rx * .54;
    disc(ex + lx + s * R * .012, ey + ly + R * .025, pr, C.pupil);
    disc(ex + lx - pr * .32, ey + ly - pr * .28, pr * .34, '#FFFFFF');
    if (eyes === 'tired' || eyes === 'squint') shape([[ex - rx * 1.2, ey - ry * 1.2], [ex + rx * 1.2, ey - ry * 1.2], [ex + rx * 1.2, ey - ry * (eyes === 'squint' ? -.1 : .15)], [ex - rx * 1.2, ey - ry * (eyes === 'squint' ? -.1 : .15)]], { flat: C.face, line: false, tex: 0 });
  }
  if (o.brows) for (const s of [-1, 1]) { const b = o.brows === 'up' ? -.07 : o.brows === 'worried' ? .06 : o.brows === 'angry' ? -.07 : 0; stroke_([[s * R * .15, -R * .53 - (o.brows === 'worried' ? -b : b) * R], [s * R * .43, -R * .53 + (o.brows === 'up' ? b * R : o.brows === 'angry' ? -b * R : -b * R)]], 1.1, C.lime, 'pen', .2); }
  // mouth
  const m = o.mouth || 'smile', my = R * .3;
  if (tk > .05 || m === 'open' || m === 'O') {
    const oh = R * (m === 'O' ? .19 : .055 + Math.max(tk, m === 'open' ? .7 : 0) * .15), ow = R * (m === 'O' ? .13 : .2 - tk * .03);
    shape(ellP(0, my + oh * .3, ow, oh, 16), { flat: '#3D1620', line: C.lime, lw: .6, curve: .7, tex: 0 });
    if (oh > R * .1) shape(ellP(0, my + oh * .9, ow * .55, oh * .32, 10), { flat: '#F27D8A', line: false, tex: 0 });
  } else if (m === 'grin') {
    shape(arcP(0, my - R * .07, R * .25, R * .21, .1, Math.PI - .1, 10), { flat: '#3D1620', line: C.lime, lw: .6, tex: 0 });
    shape(boxP(-R * .18, my - R * .05, R * .36, R * .06, R * .02), { flat: C.eye, line: false, tex: 0 });
    shape(ellP(0, my + R * .09, R * .09, R * .04, 10), { flat: '#F27D8A', line: false, tex: 0 });
  } else if (m === 'flat') stroke_([[-R * .12, my], [R * .12, my + R * .01]], 1.1, C.lime, 'pen', .3);
  else if (m === 'frown') stroke_(arcP(0, my + R * .12, R * .14, R * .1, Math.PI * 1.15, Math.PI * 1.85, 6), 1.1, C.lime, 'pen', .6);
  else if (m === 'wobble') stroke_([[-R * .16, my], [-R * .08, my - R * .03], [0, my + R * .01], [R * .08, my - R * .03], [R * .16, my]], 1.1, C.lime, 'pen', .5);
  else stroke_(arcP(0, my - R * .07, R * .16, R * .12, .35, Math.PI - .35, 8), 1.3, C.lime, 'pen', .6);
  if (o.blush !== false) for (const s of [-1, 1]) disc(s * R * .5, R * .1, R * .085, '#F28C8C', { ry: R * .05, extra: { flatA: 140 } });
  if (aL >= -1.2) arm(-1, aL); if (aR >= -1.2) arm(1, aR);
  emoteMark(o.emote, R * .98, -R * 1.05, R * .32, o.emoteK ?? 1);
  popT();
}

// ================= SAM: a tired restaurant server in his 20s, bib apron, order pad in the pocket =================
// sam(x, y, u, o): u = unit (Sam is ~10u tall, big picture-book head). o.lean (rad), o.eyes: tired|open|wide|closed|
// happy|squint|side|dead, o.brows: tired|up|worried|angry|flat, o.mouth: flat|smile|frown|o|grin|wavy|sigh, o.walk,
// o.bust (skip legs), o.tgtL/o.tgtR ([x, y] hand targets in body space), o.backL/o.backR (arm behind the body),
// o.apronCol, o.apron2 (lanyard colour for a second job), o.noApron, o.phoneGlow (0..1 cyan light on the face), o.headTilt
function sam(x, y, u, o = {}) {
  const t = o.t ?? TNOW, sq = o.sq || 0, breath = o.still ? 0 : osc(t, .42) * .012;
  pushT(); tr(x, y - (o.dy || 0));
  if (o.shadow !== false) groundShadow(u * 1.8);
  if (o.flip) scl(-1, 1);
  rot(o.rot || 0); scl(1 + sq * .35, 1 - sq * .4 + breath);
  if (!o.bust) {
    const w = o.walk;
    for (const s of [-1, 1]) {
      const ph = w == null ? 0 : Math.sin(w * TAU + (s > 0 ? Math.PI : 0));
      const fx = s * u * .52 + ph * u * .55, fy = w == null ? 0 : -Math.max(0, ph) * u * .35;
      shape(limbP(s * u * .55, -u * 3.85, fx, fy - u * .45, u * .58, u * .4), { flat: C.pants, lw: 1, tex: .35, shade: .25 });
      shape(boxP(fx - u * .55 + s * u * .14, fy - u * .55, u * 1.1, u * .55, u * .25), { flat: C.shoe, lw: 1, tex: 0, hi: .3 });
      stroke_([[fx - u * .43 + s * u * .14, fy - u * .13], [fx + u * .5 + s * u * .14, fy - u * .13]], .5, '#F2E6CF', 'fine', 0);
    }
  }
  pushT(); tr(0, -u * 3.8); rot(o.lean || 0); tr(0, u * 3.8);
  const sx0 = u * 1.3, sy0 = -u * 6.4;
  const arm = (s, a) => {
    const tgt = s < 0 ? o.tgtL : o.tgtR, pts = armPts(s * sx0, sy0, s, a, u * 2.75, tgt, .18), h = pts[pts.length - 1], el = pts[3];
    shape(limbP(s * sx0, sy0, el[0], el[1], u * .42, u * .34), { flat: C.shirt, lw: 1, tex: .35, shade: .22 });
    shape(limbP(el[0], el[1], h[0], h[1], u * .25, u * .22), { flat: C.skin, lw: .9, tex: .2, shade: .18 });
    const hook = s < 0 ? o.handL : o.handR;
    if (hook) { pushT(); tr(h[0], h[1]); hook(u); popT(); }
    shape(ellP(h[0], h[1], u * .34, u * .31, 12), { flat: C.skin, lw: .9, curve: .7, tex: .2, shade: .2 });
  };
  const aL = o.aL ?? -1.52, aR = o.aR ?? -1.52;
  if (o.backL) arm(-1, aL); if (o.backR) arm(1, aR);
  shape([[-u * 1.4, -u * 6.75], [u * 1.4, -u * 6.75], [u * 1.6, -u * 6.1], [u * 1.3, -u * 3.6], [-u * 1.3, -u * 3.6], [-u * 1.6, -u * 6.1]], { flat: C.shirt, lw: 1.1, curve: .4, tex: .4, shade: .3 });
  shape([[-u * .42, -u * 6.8], [0, -u * 6.3], [u * .42, -u * 6.8]], { flat: C.shirtDk, lw: .8, tex: 0 });
  if (!o.noApron) {
    const ap = o.apronCol || C.apron, apd = mixC(ap, '#3a2a20', .3);
    stroke_([[-u * .66, -u * 6.1], [-u * .34, -u * 6.75]], .7, apd, 'pen', 0); stroke_([[u * .66, -u * 6.1], [u * .34, -u * 6.75]], .7, apd, 'pen', 0);
    shape([[-u * .74, -u * 6.15], [u * .74, -u * 6.15], [u * .8, -u * 4.75], [u * 1.36, -u * 4.55], [u * 1.42, -u * 2.35], [-u * 1.42, -u * 2.35], [-u * 1.36, -u * 4.55], [-u * .8, -u * 4.75]], { flat: ap, lw: 1.1, curve: .15, tex: .5, shade: .25 });
    stroke_([[-u * 1.36, -u * 4.55], [0, -u * 4.5], [u * 1.36, -u * 4.55]], .6, apd, 'pen', .3);
    shape(boxP(-u * .9, -u * 3.95, u * 1.8, u * .8, u * .08), { flat: mixC(ap, '#ffffff', .15), lw: .7, tex: .3 });
    stroke_([[0, -u * 3.95], [0, -u * 3.15]], .5, apd, 'fine', 0);
    shape(boxP(-u * .74, -u * 4.28, u * .56, u * .46, u * .04), { flat: '#FFFBF0', lw: .6, tex: 0 });
    stroke_([[u * .42, -u * 4.5], [u * .55, -u * 3.9]], 1.3, '#3E5C9A', 'pen', 0);
    if (o.apron2) {
      stroke_([[-u * .42, -u * 6.7], [-u * .14, -u * 5.45], [u * .14, -u * 5.45], [u * .42, -u * 6.7]], .8, o.apron2, 'pen', .4);
      shape(boxP(-u * .3, -u * 5.5, u * .6, u * .74, u * .08), { flat: '#FFFFFF', lw: .7, tex: 0 });
      shape(boxP(-u * .3, -u * 5.5, u * .6, u * .2, u * .04), { flat: o.apron2, line: false, tex: 0 });
    }
  }
  shape(boxP(-u * .34, -u * 7.2, u * .68, u * .6, u * .2), { flat: C.skinDk, lw: .8, tex: 0 });
  const hb = o.headBob ?? (o.still ? 0 : osc(t, .42, .2) * u * .04);
  pushT(); tr(0, -u * 8.3 + hb); rot(o.headTilt || 0);
  samHead(u * 1.2, t, o);
  popT();
  if (!o.backL) arm(-1, aL); if (!o.backR) arm(1, aR);
  popT();
  emoteMark(o.emote, u * 1.7, -u * 10.1, u * .6, o.emoteK ?? 1);
  popT();
}
function samHead(u, t, o) {
  const tk = clamp(o.talk || 0), eyes = o.eyes || 'tired', brows = o.brows || (eyes === 'tired' ? 'tired' : 'flat');
  // back hair
  shape(blobP(0, -u * .35, u * 1.1, u * 1.0, 11, .08, 16), { flat: C.hair, line: false, curve: .7, tex: .3 });
  // ears
  for (const s of [-1, 1]) shape(ellP(s * u * .98, u * .05, u * .2, u * .3, 10), { flat: C.skin, lw: .8, curve: .7, tex: 0 });
  // face
  shape(ellP(0, 0, u * 1.0, u * 1.17, 24), { flat: C.skin, lw: 1.1, curve: .6, tex: .3, shade: .22, hi: .2 });
  if (o.phoneGlow) glow(0, u * .2, u * 1.3, u * 1.2, '#BDF0F7', 110 * o.phoneGlow);
  // stubble + cheeks
  shape(arcP(0, u * .25, u * .92, u * .9, .25, Math.PI - .25, 12), { flat: '#B88A78', flatA: 60, line: false, tex: 0 });
  for (const s of [-1, 1]) disc(s * u * .58, u * .3, u * .17, '#E48D7A', { ry: u * .1, extra: { flatA: 110 } });
  // hair: messy top with a cowlick
  const hairP = [[-u * 1.1, u * .1], [-u * 1.2, -u * .45], [-u * 1.05, -u * .95], [-u * .7, -u * 1.32], [-u * .2, -u * 1.48], [u * .3, -u * 1.5], [u * .75, -u * 1.33], [u * 1.08, -u * .98], [u * 1.2, -u * .45], [u * 1.1, u * .05], [u * .98, -u * .3], [u * .82, -u * .42], [u * .62, -u * .5], [u * .42, -u * .38], [u * .22, -u * .58], [-u * .05, -u * .45], [-u * .3, -u * .62], [-u * .55, -u * .48], [-u * .8, -u * .58], [-u * .98, -u * .3]];
  shape(hairP, { flat: C.hair, lw: 1.1, curve: .4, tex: .35, hi: .35, light: [-.08, -.12] });
  for (const [x0, y0, x1, y1, x2, y2] of [[u * .1, -u * 1.45, u * .35, -u * 1.85, u * .62, -u * 1.7], [-u * .35, -u * 1.4, -u * .55, -u * 1.75, -u * .3, -u * 1.85], [u * .7, -u * 1.25, u * 1.05, -u * 1.45, u * 1.2, -u * 1.2]])
    shape([[x0 - u * .12, y0 + u * .05], [x1, y1], [x2, y2], [x0 + u * .14, y0 + u * .08]], { flat: C.hair, lw: .9, curve: .5, tex: 0 });
  // eyes
  const bl = !['closed', 'happy', 'dead'].includes(eyes) && !o.noBlink ? blinkAt(t, 7) : 0;
  const lx = (o.lookX || (eyes === 'side' ? .7 : 0)) * u * .09, ly = (o.lookY || 0) * u * .06;
  for (const s of [-1, 1]) {
    const ex = s * u * .4, ey = -u * .02;
    if (eyes === 'closed' || eyes === 'happy' || bl > .6) {
      stroke_(eyes === 'happy' ? arcP(ex, ey + u * .1, u * .2, u * .16, Math.PI * 1.1, Math.PI * 1.9, 6) : [[ex - u * .2, ey + u * .02], [ex, ey + u * .07], [ex + u * .2, ey + u * .02]], 1, INK(), 'pen', .6);
    } else {
      const ry = u * (eyes === 'wide' ? .24 : .18), rx = u * (eyes === 'wide' ? .2 : .19);
      shape(ellP(ex, ey, rx, ry, 14), { flat: '#FFFBF2', lw: .7, curve: .7, tex: 0 });
      disc(ex + lx, ey + ly + u * .02, u * (eyes === 'wide' ? .08 : .1), C.pupil);
      disc(ex + lx - u * .035, ey + ly - u * .02, u * .03, '#FFFFFF');
      const lid = { tired: .55, dead: .62, squint: .7, side: .35, open: 0, wide: 0 }[eyes] ?? 0;
      if (lid) { shape([[ex - rx * 1.25, ey - ry * 1.3], [ex + rx * 1.25, ey - ry * 1.3], [ex + rx * 1.25, ey - ry + ry * 2 * lid], [ex - rx * 1.25, ey - ry + ry * 2 * lid]], { flat: C.skin, line: false, tex: 0 }); stroke_([[ex - rx * 1.05, ey - ry + ry * 2 * lid], [ex + rx * 1.05, ey - ry + ry * 2 * lid + u * .01]], .8, INK(), 'pen', 0); }
    }
    // eye bags: he's tired
    if (eyes !== 'happy') stroke_(arcP(ex, ey + u * .14, u * .17, u * .09, .35, Math.PI - .35, 5), .55, '#9A6E8C', 'fine', .6);
  }
  // brows
  for (const s of [-1, 1]) {
    const by = -u * .38, inner = { tired: .03, flat: 0, up: -.12, worried: -.1, angry: .1 }[brows] ?? 0, outer = { tired: .08, flat: 0, up: -.08, worried: .06, angry: -.04 }[brows] ?? 0;
    stroke_([[s * u * .18, by + inner * u], [s * u * .62, by + outer * u - u * .03]], 1.3, C.hair, 'pen', .2);
  }
  // nose
  stroke_([[u * .04, u * .1], [u * .12, u * .33], [-u * .02, u * .37]], .7, mixC(C.skinDk, INK(), .3), 'pen', .5);
  // mouth
  const m = o.mouth || 'flat', my = u * .66;
  if (tk > .05 || m === 'o') {
    const oh = u * (m === 'o' ? .17 : .05 + tk * .16), ow = u * (m === 'o' ? .14 : .22 - tk * .04);
    shape(ellP(0, my, ow, oh, 14), { flat: '#5A2230', lw: .8, curve: .7, tex: 0 });
    if (oh > u * .1) shape(ellP(0, my + oh * .55, ow * .6, oh * .35, 8), { flat: '#E47F86', line: false, tex: 0 });
  } else if (m === 'smile') stroke_(arcP(0, my - u * .12, u * .26, u * .16, .45, Math.PI - .45, 7), 1, INK(), 'pen', .6);
  else if (m === 'grin') { shape(arcP(0, my - u * .1, u * .3, u * .22, .15, Math.PI - .15, 9), { flat: '#5A2230', lw: .9, tex: 0 }); shape(boxP(-u * .22, my - u * .08, u * .44, u * .07, u * .02), { flat: '#FFFBF2', line: false, tex: 0 }); }
  else if (m === 'frown') stroke_(arcP(0, my + u * .14, u * .22, u * .12, Math.PI * 1.2, Math.PI * 1.8, 6), 1, INK(), 'pen', .6);
  else if (m === 'wavy') stroke_([[-u * .22, my], [-u * .11, my - u * .05], [0, my + u * .01], [u * .11, my - u * .05], [u * .22, my]], .9, INK(), 'pen', .5);
  else if (m === 'sigh') { stroke_([[-u * .18, my + u * .02], [u * .18, my - u * .02]], .9, INK(), 'pen', .3); }
  else stroke_([[-u * .2, my], [u * .2, my + u * .02]], .9, INK(), 'pen', .3);
}

// ================= NOTES: a yellow notes pad — cheerful, eager, useless =================
// notes(x, y, s, o): s = pad height. o.lines (array of scribbled strings shown on the pad), o.scribbleK (0..1 how many
// lines are visible), o.eyes: open|happy|wide|closed|star, o.mouth: smile|grin|o|flat|wobble, o.pencil (holds a pencil)
function notes(x, y, s, o = {}) {
  const t = o.t ?? TNOW, sq = o.sq || 0, w = s * .78, legH = s * .16, bob = o.still ? 0 : Math.abs(osc(t, 1.1)) * s * .02;
  pushT(); tr(x, y - (o.dy || 0) - bob);
  if (o.shadow !== false) groundShadow(w * .55);
  if (o.flip) scl(-1, 1);
  rot((o.rot || 0) + (o.still ? 0 : osc(t, .55) * .03));
  for (const sd of [-1, 1]) { stroke_([[sd * w * .18, -legH], [sd * w * .2, -legH * .4], [sd * w * .22, -s * .02]], 1.4, INK(), 'pen', .5); shape(ellP(sd * w * .25, -s * .025, s * .06, s * .03, 10), { flat: INK(), line: false, tex: 0 }); }
  tr(0, -legH); scl(1 + sq * .4, 1 - sq * .5);
  const arm = (sd, a) => {
    const pts = armPts(sd * w * .5, -s * .45, sd, a, s * .32, null, .25), h = pts[pts.length - 1];
    stroke_(pts, 1.6, INK(), 'pen', .6);
    if (o.pencil && sd > 0) { pushT(); tr(h[0], h[1]); rot(-.6 + osc(t, 2) * .2); shape(boxP(-s * .02, -s * .22, s * .04, s * .26, 0), { flat: '#F2B33D', lw: .6, tex: 0 }); shape([[-s * .02, -s * .22], [s * .02, -s * .22], [0, -s * .27]], { flat: '#F6D7B0', lw: .5, tex: 0 }); shape(boxP(-s * .02, s * .02, s * .04, s * .03, 0), { flat: '#F08A9A', lw: .5, tex: 0 }); popT(); }
    disc(h[0], h[1], s * .045, C.notes, { line: INK(), lw: .6 });
  };
  const aL = o.aL ?? -.6 + osc(t, 1.1) * .15, aR = o.aR ?? -.6 + osc(t, 1.1, .5) * .15;
  // pad
  shape(boxP(-w / 2, -s, w, s, s * .06), { flat: C.notes, lw: 1.3, tex: .5, shade: .25, hi: .25 });
  shape([[-w / 2, -s * .84], [-w / 2, -s * .94], [-w / 2 + s * .06, -s], [w / 2 - s * .06, -s], [w / 2, -s * .94], [w / 2, -s * .84]], { flat: C.notesDk, lw: 1, tex: .3, curve: .2 });
  for (let i = 0; i < 5; i++) disc(-w * .36 + i * w * .18, -s * .92, s * .022, '#7A5A20');
  for (let i = 0; i < 7; i++) stroke_([[-w * .42, -s * (.72 - i * .095)], [w * .42, -s * (.72 - i * .095)]], .35, C.notesLine, 'fine', 0);
  // scribbles
  const lines = o.lines || [], vis = Math.floor((o.scribbleK ?? 1) * lines.length + .001);
  lines.slice(0, vis).forEach((L, i) => label(L, -w * .4, -s * (.42 - i * .095), s * .062, '#3A3550', { align: 'left', rot: -.02 + hash(i) * .04, maxW: w * .82 }));
  // face (upper half of the page)
  const fy = -s * .62, eyes = o.eyes || 'open', bl = eyes === 'open' && !o.noBlink ? blinkAt(t, 11) : 0, tk = clamp(o.talk || 0);
  for (const sd of [-1, 1]) {
    const ex = sd * w * .2, ey = fy - s * .03;
    if (eyes === 'happy') { stroke_(arcP(ex, ey + s * .03, s * .055, s * .045, Math.PI * 1.1, Math.PI * 1.9, 6), 1.3, INK(), 'pen', .6); continue; }
    if (eyes === 'closed' || bl > .5) { stroke_([[ex - s * .05, ey], [ex + s * .05, ey]], 1.2, INK(), 'pen', 0); continue; }
    if (eyes === 'star') { shape(starP(ex, ey, s * .07, .42, 5), { flat: '#FFFFFF', lw: .8, tex: 0 }); continue; }
    const r = s * (eyes === 'wide' ? .07 : .058);
    shape(ellP(ex, ey, r, r * 1.15, 14), { flat: '#FFFFFF', lw: .8, curve: .7, tex: 0 });
    disc(ex + (o.lookX || 0) * r * .4, ey + r * .15, r * .58, C.pupil); disc(ex - r * .2, ey - r * .1, r * .2, '#FFFFFF');
  }
  for (const sd of [-1, 1]) disc(sd * w * .3, fy + s * .07, s * .04, C.cheek, { ry: s * .025, extra: { flatA: 170 } });
  const m = o.mouth || 'smile', my = fy + s * .1;
  if (tk > .05 || m === 'o') { const oh = s * (m === 'o' ? .05 : .02 + tk * .05); shape(ellP(0, my, s * .08, oh, 14), { flat: '#6B2A33', lw: .8, curve: .7, tex: 0 }); }
  else if (m === 'grin' || m === 'smile') { shape(arcP(0, my - s * .035, s * .11, s * .08, .1, Math.PI - .1, 10), { flat: '#6B2A33', lw: .9, tex: 0 }); shape(ellP(0, my + s * .03, s * .04, s * .015, 8), { flat: '#F08A9A', line: false, tex: 0 }); }
  else if (m === 'wobble') stroke_([[-s * .07, my], [-s * .035, my - s * .015], [0, my + s * .005], [s * .035, my - s * .015], [s * .07, my]], 1, INK(), 'pen', .5);
  else stroke_([[-s * .06, my], [s * .06, my]], 1, INK(), 'pen', 0);
  arm(-1, aL); arm(1, aR);
  emoteMark(o.emote, w * .55, -s * 1.05, s * .12, o.emoteK ?? 1);
  popT();
}

// ================= STUB: the paycheck envelope (extra) =================
// stub(x, y, s, o): s = envelope width. o.amount (string on the cheque slip peeking out), o.slip (0..1 how far the
// cheque slides out), o.flap (0..1 open; it also lifts while talking), o.eyes, o.mouth: smile|frown|o|flat
function stub(x, y, s, o = {}) {
  const t = o.t ?? TNOW, h = s * .7, sq = o.sq || 0, tk = clamp(o.talk || 0), legH = s * .14;
  pushT(); tr(x, y - (o.dy || 0));
  if (o.shadow !== false) groundShadow(s * .45);
  if (o.flip) scl(-1, 1);
  rot((o.rot || 0) + (o.still ? 0 : osc(t, .7) * .025));
  for (const sd of [-1, 1]) { stroke_([[sd * s * .18, -legH - s * .02], [sd * s * .19, -legH * .5], [sd * s * .2, -s * .01]], 1.4, INK(), 'pen', .3); shape(ellP(sd * s * .24, -s * .02, s * .075, s * .032, 10), { flat: INK(), line: false, tex: 0 }); }
  tr(0, -legH); scl(1 + sq * .4, 1 - sq * .5);
  const fl = clamp((o.flap ?? 0) + tk * .3);
  if (fl > .02) { pushT(); tr(0, -h); scl(1, -fl); shape([[-s / 2, 0], [s / 2, 0], [0, h * .5]], { flat: mixC(C.envDk, '#ffffff', .2), lw: 1, tex: .3 }); popT(); }
  if (o.amount) {
    const so = (o.slip ?? 1) * h * .55;
    pushT(); tr(0, -h + h * .3 - so); rot(-.04);
    shape(boxP(-s * .4, -h * .25, s * .8, h * .62, s * .02), { flat: '#EAF3E4', lw: .9, tex: .25 });
    label(o.amount, 0, -h * .06, h * .2, '#24402E', { maxW: s * .7 });
    stroke_([[-s * .3, h * .12], [s * .3, h * .12]], .4, '#8AA894', 'fine', 0);
    popT();
  }
  shape(boxP(-s / 2, -h, s, h, s * .04), { flat: C.env, lw: 1.3, tex: .45, shade: .22, hi: .2 });
  stroke_([[-s / 2 + s * .02, -h * .03], [-s * .12, -h * .42]], .5, C.envDk, 'fine', 0); stroke_([[s / 2 - s * .02, -h * .03], [s * .12, -h * .42]], .5, C.envDk, 'fine', 0);
  if (fl <= .02) shape([[-s / 2, -h], [s / 2, -h], [0, -h * .45]], { flat: mixC(C.env, C.envDk, .45), lw: 1, tex: .3 });
  const bl = !o.noBlink ? blinkAt(t, 19) : 0, eyes = o.eyes || 'open';
  for (const sd of [-1, 1]) {
    const ex = sd * s * .17, ey = -h * .34;
    if (eyes === 'closed' || bl > .5) stroke_([[ex - s * .045, ey], [ex + s * .045, ey]], 1.1, INK(), 'pen', 0);
    else if (eyes === 'happy') stroke_(arcP(ex, ey + s * .02, s * .045, s * .035, Math.PI * 1.1, Math.PI * 1.9, 5), 1.1, INK(), 'pen', .6);
    else { const r = s * (eyes === 'wide' ? .062 : .052); shape(ellP(ex, ey, r, r * 1.15, 12), { flat: '#FFFFFF', lw: .7, curve: .7, tex: 0 }); disc(ex + (o.lookX || 0) * r * .4, ey + r * .2, r * .55, C.pupil); disc(ex - r * .2, ey - r * .05, r * .18, '#FFFFFF'); }
  }
  for (const sd of [-1, 1]) disc(sd * s * .3, -h * .22, s * .045, C.cheek, { ry: s * .025, extra: { flatA: 150 } });
  const my = -h * .19, m = o.mouth || 'smile';
  if (tk > .05 || m === 'o') shape(ellP(0, my, s * .055, s * (.014 + tk * .035), 10), { flat: '#6B2A33', lw: .6, tex: 0 });
  else if (m === 'frown') stroke_(arcP(0, my + s * .035, s * .06, s * .035, Math.PI * 1.15, Math.PI * 1.85, 5), .9, INK(), 'pen', .6);
  else if (m === 'flat') stroke_([[-s * .05, my], [s * .05, my]], .9, INK(), 'pen', 0);
  else stroke_(arcP(0, my - s * .025, s * .06, s * .04, .3, Math.PI - .3, 5), .9, INK(), 'pen', .6);
  emoteMark(o.emote, s * .55, -h - s * .05, s * .14, o.emoteK ?? 1);
  popT();
}

// ================= MANAGER: a faceless silhouette who always needs "just a little more" (extra) =================
// manager(x, y, u, o): u ≈ Sam's unit. o.clip (holds a clipboard), o.point (raises a finger: "one more thing"),
// o.lean (looming), o.rim (rim-light colour), o.talk (the head bobs)
function manager(x, y, u, o = {}) {
  const t = o.t ?? TNOW, body = C.shadowMan, rim = o.rim || C.shadowRim, sway = o.still ? 0 : osc(t, .3) * .02, tk = clamp(o.talk || 0);
  pushT(); tr(x, y - (o.dy || 0));
  if (o.shadow !== false) groundShadow(u * 2.1, 80);
  if (o.flip) scl(-1, 1);
  for (const s of [-1, 1]) { shape(limbP(s * u * .6, -u * 4.4, s * u * .62, -u * .4, u * .62, u * .48), { flat: body, lw: .9, tex: .15 }); shape(boxP(s * u * .62 - u * .62 + s * u * .12, -u * .5, u * 1.24, u * .5, u * .22), { flat: '#0E0C14', lw: .8, tex: 0 }); }
  pushT(); tr(0, -u * 4.3); rot((o.lean || 0) + sway); tr(0, u * 4.3);
  shape([[-u * 1.55, -u * 7.9], [u * 1.55, -u * 7.9], [u * 2.0, -u * 7.3], [u * 1.75, -u * 4.1], [-u * 1.75, -u * 4.1], [-u * 2.0, -u * 7.3]], { flat: body, lw: 1.1, curve: .5, tex: .25 });
  shape([[-u * .5, -u * 7.95], [0, -u * 7.1], [u * .5, -u * 7.95]], { flat: '#E9E4F2', lw: .6, tex: 0 });
  shape([[0, -u * 7.3], [u * .24, -u * 6.9], [u * .17, -u * 5.2], [0, -u * 4.8], [-u * .17, -u * 5.2], [-u * .24, -u * 6.9]], { flat: '#5B4E86', lw: .6, tex: 0 });
  stroke_([[u * 1.55, -u * 7.85], [u * 1.98, -u * 7.25], [u * 1.78, -u * 4.4]], 1.6, rim, 'pen', .5);
  pushT(); tr(u * .25, -u * 9.15 - tk * u * .08); rot(.12);
  shape(ellP(0, 0, u * 1.0, u * 1.18, 22), { flat: body, lw: 1.1, curve: .6, tex: .2 });
  stroke_(arcP(0, 0, u * .95, u * 1.13, -1.25, .6, 8), 1.6, rim, 'pen', .5);
  popT();
  const tgtR = o.point ? [u * 2.45, -u * 9.4] : [u * 2.0, -u * 4.3], tgtL = o.clip ? [u * .1, -u * 5.8] : [-u * 2.0, -u * 4.2];
  for (const [s, tg] of [[-1, tgtL], [1, tgtR]]) {
    const pts = armPts(s * u * 1.65, -u * 7.3, s, 0, 0, tg, .2), h = pts[pts.length - 1];
    shape(limbP(s * u * 1.65, -u * 7.3, pts[3][0], pts[3][1], u * .55, u * .46), { flat: body, lw: .9, tex: .15 });
    shape(limbP(pts[3][0], pts[3][1], h[0], h[1], u * .46, u * .38), { flat: body, lw: .9, tex: .15 });
    if (s > 0) stroke_([[s * u * 1.95, -u * 7.1], [pts[3][0] + u * .4, pts[3][1]], [h[0] + u * .35, h[1]]], 1.2, rim, 'pen', .5);
    if (s < 0 && o.clip) { pushT(); tr(h[0] - u * .4, h[1] + u * .9); rot(-.12); shape(boxP(-u * .95, -u * 1.25, u * 1.9, u * 2.5, u * .12), { flat: '#C9A46A', lw: 1, tex: .4 }); shape(boxP(-u * .78, -u * 1.02, u * 1.56, u * 2.05, 0), { flat: '#F4EEDC', lw: .5, tex: 0 }); for (let i = 0; i < 4; i++) stroke_([[-u * .55, -u * .55 + i * u * .42], [u * .5, -u * .55 + i * u * .42]], .45, '#8A8AA0', 'fine', 0); shape(boxP(-u * .32, -u * 1.38, u * .64, u * .28, u * .06), { flat: '#9A9AA8', lw: .5, tex: 0 }); popT(); }
    disc(h[0], h[1], u * .4, body, { line: INK(), lw: .8 });
    if (s > 0 && o.point) { stroke_([[h[0] + u * .05, h[1] - u * .2], [h[0] + u * .12, h[1] - u * .95]], 2.6, body, 'pen', 0); stroke_([[h[0] + u * .3, h[1] - u * .25], [h[0] + u * .32, h[1] - u * .9]], 1, rim, 'pen', 0); }
  }
  popT();
  popT();
}

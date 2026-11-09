// core.js — Clocked painted engine: constants, timing, randomness, geometry, transforms and the two painting backends.
//
// Two backends share one drawing API (shape, stroke_, disc, glow, label, pushT/popT/tr/rot/scl):
//   PLATE  — p5.brush in WebGL: real watercolour fills, washes, hatching and brush strokes. Slow on a software GPU,
//            so it paints *plates* (backgrounds, textures) once; they are cached and reused by every frame of a shot.
//   LIVE   — Canvas 2D: characters, props and anything that moves, redrawn every frame with a hand-made ink ribbon,
//            flat pigment, a p5.brush-painted pigment texture multiplied in, and wet-edge darkening.
// Every frame is a pure function of time. Never use Math.random(); hash() gives stable randomness and jit() gives
// hand-drawn "boil" (reseeded BOIL times a second, so linework shimmers like hand-drawn animation).
'use strict';
const W = 1080, H = 1920, FPS = 30, BOIL = 12;
const SAFE = { top: 180, bottom: 400, left: 90, right: 150 };   // keep captions and faces inside this
const TAU = Math.PI * 2;
const LIME = '#C8F25A';
const GW = 1404, GH = 2496;                                       // WebGL canvas (plate painting) size = SETRECT at 1:1

// ---------- math & easing ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const fract = x => x - Math.floor(x);
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const eOut = x => 1 - Math.pow(1 - clamp(x), 3);
const eIn = x => Math.pow(clamp(x), 3);
const eInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const over = (x, s = 1.7) => { x = clamp(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };   // overshoot
const springy = x => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(x * 14); };
const osc = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
const hash = n => { const s = Math.sin(n * 91.345 + 47.853) * 24634.6345; return s - Math.floor(s); };
const hash2 = (a, b) => hash(a * 13.17 + b * 7.31);
// keyframes: keys(t, [[t0, v0], [t1, v1], ...], easeFn) — values may be numbers or arrays
function keys(t, ks, e = smooth) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) if (t < ks[i][0]) {
    const [a, va] = ks[i - 1], [b, vb] = ks[i], k = e((t - a) / (b - a));
    return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
  }
  return ks[ks.length - 1][1];
}
// impact: 0 before t0, jumps to 1 at t0 and decays (drive squash on landings and hits)
const hit = (t, t0, k = 7) => t < t0 ? 0 : Math.exp(-(t - t0) * k);
// colour helpers
function hexRGB(h) { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixC(a, b, k) { const A = hexRGB(a), B = hexRGB(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(k))).toString(16).padStart(2, '0')).join(''); }
const rgba = (h, a) => { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; };
const money = v => '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---------- boil jitter ----------
let RND = () => .5;
function seedRnd(s) { let x = (s >>> 0) || 1; RND = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296; if (PLATE) randomSeed(s); }
const jit = a => (RND() * 2 - 1) * a;
const boilFrame = t => Math.floor(t * BOIL);

// ---------- backends ----------
let PLATE = false;      // true while painting a plate with p5.brush
let CTX = null;         // Canvas 2D context of the live layer

// ---------- transform mirror (both backends) ----------
let MAT = [1, 0, 0, 1, 0, 0], MSTACK = [];
function mmul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
function pushT() { if (PLATE) push(); MSTACK.push(MAT.slice()); }
function popT() { if (PLATE) pop(); MAT = MSTACK.pop() || [1, 0, 0, 1, 0, 0]; }
function tr(x, y) { if (PLATE) translate(x, y); MAT = mmul(MAT, [1, 0, 0, 1, x, y]); }
function rot(a) { if (!a) return; if (PLATE) rotate(a); const c = Math.cos(a), s = Math.sin(a); MAT = mmul(MAT, [c, s, -s, c, 0, 0]); }
function scl(sx, sy = sx) { if (PLATE) scale(sx, sy); MAT = mmul(MAT, [sx, 0, 0, sy, 0, 0]); }
const toScreen = (x, y) => [MAT[0] * x + MAT[2] * y + MAT[4], MAT[1] * x + MAT[3] * y + MAT[5]];
const matScale = () => Math.sqrt(Math.abs(MAT[0] * MAT[3] - MAT[1] * MAT[2]));
const applyMat = c => c.setTransform(MAT[0], MAT[1], MAT[2], MAT[3], MAT[4], MAT[5]);
// camera: world point (cx, cy) lands at frame centre, zoomed and rolled. Always pair camOn/camOff.
function camOn(cx = W / 2, cy = H / 2, zoom = 1, roll = 0) { pushT(); tr(W / 2, H / 2); rot(roll); scl(zoom); tr(-cx, -cy); }
function camOff() { popT(); }
const drift = (t, amt = 1, f = .35) => [amt * 9 * (Math.sin(t * f * 6.1) + .5 * Math.sin(t * f * 13.7 + 2)), amt * 7 * (Math.sin(t * f * 5.3 + 1) + .5 * Math.sin(t * f * 11.1))];
const shake = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.31) - .5) * 2 * amt, (hash(f * 2.77 + 5) - .5) * 2 * amt]; };

// ---------- geometry (point lists) ----------
function ellP(cx, cy, rx, ry, n = 26, j = 0, r0 = 0) { const p = []; for (let i = 0; i < n; i++) { const a = r0 + i / n * TAU; p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); } return p; }
function boxP(x, y, w, h, r = 0, j = 0) {
  if (r <= 0) return [[x + jit(j), y + jit(j)], [x + w / 2 + jit(j), y + jit(j) * .4], [x + w + jit(j), y + jit(j)], [x + w + jit(j) * .4, y + h / 2], [x + w + jit(j), y + h + jit(j)], [x + w / 2 + jit(j), y + h + jit(j) * .4], [x + jit(j), y + h + jit(j)], [x + jit(j) * .4, y + h / 2]];
  r = Math.min(r, w / 2, h / 2); const p = [], k = 4;
  const c = (cx, cy, a0) => { for (let i = 0; i <= k; i++) { const a = a0 + i / k * Math.PI / 2; p.push([cx + Math.cos(a) * r + jit(j), cy + Math.sin(a) * r + jit(j)]); } };
  c(x + w - r, y + r, -Math.PI / 2); c(x + w - r, y + h - r, 0); c(x + r, y + h - r, Math.PI / 2); c(x + r, y + r, Math.PI); return p;
}
function arcP(cx, cy, rx, ry, a0, a1, n = 12, j = 0) { const p = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); } return p; }
function limbP(x1, y1, x2, y2, r1, r2 = r1, n = 6) {
  const a = Math.atan2(y2 - y1, x2 - x1), p = [];
  for (let i = 0; i <= n; i++) { const q = a + Math.PI / 2 + i / n * Math.PI; p.push([x1 + Math.cos(q) * r1, y1 + Math.sin(q) * r1]); }
  for (let i = 0; i <= n; i++) { const q = a - Math.PI / 2 + i / n * Math.PI; p.push([x2 + Math.cos(q) * r2, y2 + Math.sin(q) * r2]); }
  return p;
}
// curved limb path (shoulder -> hand), bend > 0 bows one way
function bendP(x1, y1, x2, y2, bend = .25, n = 6) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, p = [];
  const cx = mx - dy * bend, cy = my + dx * bend;
  for (let i = 0; i <= n; i++) { const k = i / n, a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; p.push([a * x1 + b * cx + c * x2, a * y1 + b * cy + c * y2]); }
  return p;
}
function starP(cx, cy, r, inner = .45, n = 5, r0 = -Math.PI / 2) { const p = []; for (let i = 0; i < n * 2; i++) { const a = r0 + i * Math.PI / n, q = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } return p; }
function blobP(cx, cy, rx, ry, seed = 1, wob = .18, n = 18, j = 0) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (hash2(seed, i) - .5) * 2 * wob; p.push([cx + Math.cos(a) * rx * k + jit(j), cy + Math.sin(a) * ry * k + jit(j)]); } return p; }
// Catmull-Rom resample (closed or open) for smooth outlines
function smoothPts(pts, closed = true, sub = 4, tension = .5) {
  const n = pts.length; if (n < 3 || tension <= 0) return pts.slice();
  const out = [], P = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)], last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < sub; s++) {
      const u = s / sub, u2 = u * u, u3 = u2 * u, k = tension;
      const m1x = (p2[0] - p0[0]) * k, m1y = (p2[1] - p0[1]) * k, m2x = (p3[0] - p1[0]) * k, m2y = (p3[1] - p1[1]) * k;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      out.push([h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x, h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

// ---------- LIVE backend: pigment, wet edges, ink ribbons ----------
let PIGMENT = null;      // p5.brush-painted mottled texture (multiplied into flat colour)
const INK_PX = 5;      // ink width at lw = 1
function pathOf(pts, closed = true) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; }
function pigmentInto(path, bb, a = .32) {
  if (!PIGMENT || a <= 0) return;
  const c = CTX, w = bb[2] - bb[0], h = bb[3] - bb[1], sz = Math.max(w, h, 420) * 1.08;
  const ox = bb[0] - (sz - w) * hash(Math.round(bb[0] * .37)) - (boilFrame(TNOW) % 3) * 3, oy = bb[1] - (sz - h) * hash(Math.round(bb[1] * .53));
  c.save(); c.clip(path); c.globalCompositeOperation = 'multiply'; c.globalAlpha = a * GA; c.drawImage(PIGMENT, ox, oy, sz, sz); c.restore();
}
// crescent shading: darken the part of the shape not covered by itself shifted toward the light (dx, dy in shape units)
function shadeInto(path, sp, bb, col, a, dx, dy) {
  const c = CTX, w = bb[2] - bb[0], h = bb[3] - bb[1], m = new Path2D();
  m.rect(bb[0] - w, bb[1] - h, w * 3, h * 3); m.addPath(path, new DOMMatrix([1, 0, 0, 1, dx * w, dy * h]));
  c.save(); c.clip(path); c.globalAlpha = a; c.fillStyle = col; c.fill(m, 'evenodd'); c.restore(); c.globalAlpha = 1;
}
const bbox = pts => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of pts) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; };
// ink ribbon along a path: tapered, width wobbling like a loaded brush, a little overshoot on closed shapes
function ribbon(pts, w, col, closed = false, taper = [.35, .25], seed = 0, alpha = .93) {
  let P = pts;
  if (closed) { const n = pts.length, k = Math.max(1, Math.round(n * .06)); P = pts.slice(); for (let i = 0; i <= k; i++) P.push(pts[i % n]); }
  const n = P.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const u = i / (n - 1), tp = Math.min(1, u / Math.max(.001, taper[0] * .3), (1 - u) / Math.max(.001, taper[1] * .3));
    const ww = w * .5 * (.25 + .75 * clamp(tp)) * (.78 + .44 * hash2(seed, Math.floor(i / 2))) * (1 + jit(.08));
    L.push([P[i][0] - dy * ww, P[i][1] + dx * ww]); R.push([P[i][0] + dy * ww, P[i][1] - dx * ww]);
  }
  const c = CTX, p = new Path2D();
  L.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]));
  for (let i = R.length - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
  p.closePath(); c.globalAlpha = alpha * GA; c.fillStyle = col; c.fill(p); c.globalAlpha = 1;
}

// ---------- the shared drawing API ----------
// shape(pts, o): one painted shape.
//   o.flat / o.flatA      flat pigment (characters, props). o.tex: pigment texture strength (0 = none), o.wet: wet-edge darkening
//   o.water / o.waterA    watercolour fill with bleeding edges (plates: p5.brush fill; live: soft translucent pigment)
//   o.line / o.lw / o.br  ink outline colour (false = none), weight, brush name (plates); o.curve smooths (0..1)
let TNOW = 0, GA = 1;   // GA: global alpha multiplier (caption fades)
function shape(pts, o = {}) {
  if (PLATE) return plateShape(pts, o);
  const c = CTX; applyMat(c);
  const sp = o.curve ? smoothPts(pts, true, 4, o.curve * .5) : pts, path = pathOf(sp, true);
  if (o.flat) {
    c.globalAlpha = (o.flatA ?? 255) / 255 * GA; c.fillStyle = o.flat; c.fill(path); c.globalAlpha = 1;
    if ((o.flatA ?? 255) > 200) {
      const bb = bbox(sp);
      if (o.shade) shadeInto(path, sp, bb, mixC(o.flat, o.shadeCol || '#2a1838', .45), o.shade, o.light?.[0] ?? -.13, o.light?.[1] ?? -.16);
      if (o.hi) shadeInto(path, sp, bb, mixC(o.flat, '#ffffff', .55), o.hi, -(o.light?.[0] ?? -.13) * .6, -(o.light?.[1] ?? -.16) * .6);
      if (o.tex !== 0) pigmentInto(path, bb, o.tex ?? .55);
      if (o.wet !== 0) { c.save(); c.clip(path); c.lineWidth = Math.max(3, Math.min(bb[2] - bb[0], bb[3] - bb[1]) * .07) * (o.wet ?? 1); c.strokeStyle = rgba(mixC(o.flat, '#1a1020', .35), .22); c.stroke(path); c.restore(); }
    }
  }
  if (o.water) {
    const a = (o.waterA ?? 150) / 255;
    c.globalAlpha = a * .55; c.fillStyle = o.water; c.fill(path);
    c.save(); c.clip(path); c.globalAlpha = a * .35; c.lineWidth = 14; c.strokeStyle = mixC(o.water, '#1a1020', .25); c.stroke(path); c.restore();
    pigmentInto(path, bbox(sp), .25 * a); c.globalAlpha = 1;
  }
  const ln = o.line === undefined ? INK() : o.line;
  if (ln) {
    ribbon(o.curve ? sp : densify(sp, true), INK_PX * (o.lw ?? 1), ln, true, [.3, .3], (pts.length * 7 + Math.round(sp[0][0])) % 97);
  }
}
function densify(pts, closed) { const out = []; const n = pts.length, m = closed ? n : n - 1; for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % n]; out.push(a); out.push([(a[0] * 2 + b[0]) / 3, (a[1] * 2 + b[1]) / 3]); out.push([(a[0] + b[0] * 2) / 3, (a[1] + b[1] * 2) / 3]); } if (!closed) out.push(pts[n - 1]); return out; }
// stroke along an open path
function stroke_(pts, lw = 1, col = null, br = 'pen', curve = .5) {
  if (pts.length < 2) return;
  if (PLATE) { brush.noFill(); brush.noWash(); brush.noHatch(); brush.set(br, col || INK(), lw); brush.spline(pts.length === 2 ? [pts[0], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], pts[1]] : pts, curve); return; }
  applyMat(CTX);
  const sp = pts.length > 2 && curve > 0 ? smoothPts(pts, false, 4, curve * .5) : densify(pts, false);
  ribbon(sp, INK_PX * lw * (br === 'fine' ? .6 : br === 'bristle' ? 2.4 : 1), col || INK(), false, [.5, .45], pts.length * 3 % 89, br === 'bristle' ? .6 : .93);
}
const disc = (cx, cy, r, col, o = {}) => shape(ellP(cx, cy, r, o.ry ?? r, o.n ?? 20, o.j ?? 0), { flat: col, line: o.line ?? false, lw: o.lw, curve: o.curve ?? 0, tex: o.tex ?? 0, wet: o.wet ?? 0, ...o.extra });
// soft light (live: radial gradient; plates: watercolour bloom)
function glow(cx, cy, rx, ry, col, a = 60, seed = 3) {
  if (PLATE) return shape(blobP(cx, cy, rx, ry, seed, .12, 16), { water: col, waterA: a, bleed: .3, tex: .2, edge: .15, line: false, curve: .8 });
  const c = CTX; applyMat(c); c.save(); c.translate(cx, cy); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, rgba(col, a / 255)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
}
// plate implementation of shape (p5.brush)
function plateShape(pts, o) {
  if (o.flat || o.water) {
    if (o.flat) brush.wash(o.flat, o.flatA ?? 255); else brush.noWash();
    if (o.water) { brush.fill(o.water, o.waterA ?? 150); brush.fillBleed(o.bleed ?? .12); brush.fillTexture(o.tex ?? .45, o.edge ?? .4); } else brush.noFill();
    if (o.hatch) { brush.hatch(o.hatch.d, o.hatch.a, { rand: .12 }); brush.hatchStyle(o.hatch.br || 'HB', o.hatch.c || INK(), o.hatch.w || 1); } else brush.noHatch();
    brush.noStroke();
    if (o.curve) { brush.beginShape(o.curve); for (const p of pts) brush.vertex(p[0], p[1]); brush.endShape(true); } else brush.polygon(pts);
  }
  const ln = o.line === undefined ? INK() : o.line;
  if (ln) {
    brush.noWash(); brush.noFill(); brush.noHatch(); brush.set(o.br || 'pen', ln, o.lw ?? 1);
    brush.beginShape(o.curve || 0); for (const p of pts) brush.vertex(p[0], p[1]); brush.endShape(true);
  }
}

// run fn() with drawing clipped to a shape (live only)
function clipTo(pts, fn) { if (PLATE) return fn(); const c = CTX; applyMat(c); c.save(); c.clip(pathOf(pts)); fn(); c.restore(); }

// ---------- lettering (live only; drawn in order, so later paint covers it) ----------
// label(txt, x, y, size, colour, o): o.font ('hand' | 'anton' | 'ui'), o.align, o.pop (0..1 appear with overshoot),
// o.alpha, o.rot, o.stroke (outline colour), o.strokeW, o.shadow (false to disable), o.maxW (shrink to fit), o.track
const FONTS = { hand: '"Shantell", "Comic Sans MS", cursive', anton: '"Anton", Impact, sans-serif', ui: 'Inter, "Helvetica Neue", Arial, sans-serif' };
function label(txt, x, y, size, col, o = {}) {
  if (PLATE) return;
  const k = o.pop != null ? over(o.pop, 2.2) : 1; if (k <= .01 || (o.alpha ?? 1) <= .01) return;
  const c = CTX; applyMat(c); c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.globalAlpha = clamp(o.alpha ?? 1) * GA;
  const fam = FONTS[o.font || 'hand'] || o.font, wt = o.weight || (o.font === 'ui' ? 700 : o.font === 'anton' ? 400 : 800);
  c.font = `${wt} ${size}px ${fam}`; c.letterSpacing = o.track ? (o.track * size / 100) + 'px' : '0px';
  let s = k; if (o.maxW) { const w = c.measureText(String(txt)).width; if (w > o.maxW) s *= o.maxW / w; }
  c.scale(s, s); c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
  if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = size * (o.strokeW || .16); c.strokeStyle = o.stroke; c.strokeText(txt, 0, 0); }
  if (o.shadow) { c.fillStyle = rgba(o.shadow === true ? '#1d1a24' : o.shadow, .85); c.fillText(txt, size * .035, size * .05); }
  c.fillStyle = col; c.fillText(txt, 0, 0);
  c.restore();
}
const textW = (txt, size, font = 'hand') => { const c = CTX; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.font = `${font === 'anton' ? 400 : 800} ${size}px ${FONTS[font]}`; const w = c.measureText(txt).width; c.restore(); return w; };

// ---------- paper and grain (built once) ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function makePaper(col = '#F2EADB', w = W, h = H) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'), r = rng(42);
  c.fillStyle = col; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h, rad = 140 + r() * 420, g = c.createRadialGradient(x, y, 0, x, y, rad), a = .05 * r(); g.addColorStop(0, `rgba(150,118,78,${a})`); g.addColorStop(1, 'rgba(150,118,78,0)'); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 1800; i++) { const x = r() * w, y = r() * h, l = 5 + r() * 22, a = r() * TAU; c.strokeStyle = `rgba(105,84,58,${.03 + r() * .06})`; c.lineWidth = .8 + r() * .6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .7) * l * .5, y + Math.sin(a + .7) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return cv;
}
function makeGrain() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), r = rng(9);
  const id = c.createImageData(W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - (r() < .5 ? r() * r() * 30 : 0); d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 4; d[i + 3] = 255; }
  c.putImageData(id, 0, 0);
  const g = c.createRadialGradient(W / 2, H * .46, H * .32, W / 2, H / 2, H * .78); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(110,86,64,.30)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return cv;
}

// ---------- brushes (plates) ----------
function defineBrushes() {
  brush.add('pen', { type: 'default', weight: 5, scatter: .2, sharpness: .85, grain: 35, opacity: 235, spacing: .22, pressure: [1.2, .7], rotate: 'natural', noise: .12 });
  brush.add('fine', { type: 'default', weight: 2.4, scatter: .12, sharpness: .9, grain: 35, opacity: 230, spacing: .22, pressure: [1.1, .8], rotate: 'natural', noise: .08 });
  brush.add('bristle', { type: 'default', weight: 16, scatter: 2.6, sharpness: .35, grain: 8, opacity: 110, spacing: .55, pressure: [1.1, .55], rotate: 'natural', noise: .45 });
  brush.add('chalky', { type: 'default', weight: 6, scatter: 1.2, sharpness: .3, grain: 4, opacity: 150, spacing: .5, pressure: [1, .8], rotate: 'natural', noise: .6 });
}

// core.js — Clocked painted engine: constants, timing, randomness, geometry, transforms, painting, text queue.
// Every frame is a pure function of time. Never use Math.random(); use hash() for stable randomness and
// jit() for hand-drawn "boil" (reseeded BOIL times a second, so linework shimmers like hand-drawn animation).
'use strict';
const W = 1080, H = 1920, FPS = 30, BOIL = 12;
const SAFE = { top: 180, bottom: 400, left: 90, right: 150 };   // keep text and faces inside this
const TAU = Math.PI * 2;
const LIME = '#C8F25A';

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
// "hit": 0 before t0, jumps to 1 and decays (for squash on impacts)
const hit = (t, t0, k = 7) => t < t0 ? 0 : Math.exp(-(t - t0) * k);
// hex colour helpers
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixC(a, b, k) { const A = hexRGB(a), B = hexRGB(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(k))).toString(16).padStart(2, '0')).join(''); }
const rgba = (h, a) => { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; };
// money / number formatting (all figures in specs are examples; renderer prints them exactly)
const money = (v, dp = 2) => '$' + v.toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---------- boil jitter ----------
const jit = a => (random() * 2 - 1) * a;          // seeded per boil frame by the frame driver
const boilFrame = t => Math.floor(t * BOIL);

// ---------- affine transform mirror (so text can follow painted objects through push/translate/rotate/scale) ----------
let MAT = [1, 0, 0, 1, 0, 0], MSTACK = [];
function mmul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
function pushT() { push(); MSTACK.push(MAT.slice()); }
function popT() { pop(); MAT = MSTACK.pop() || [1, 0, 0, 1, 0, 0]; }
function tr(x, y) { translate(x, y); MAT = mmul(MAT, [1, 0, 0, 1, x, y]); }
function rot(a) { if (!a) return; rotate(a); const c = Math.cos(a), s = Math.sin(a); MAT = mmul(MAT, [c, s, -s, c, 0, 0]); }
function scl(sx, sy = sx) { scale(sx, sy); MAT = mmul(MAT, [sx, 0, 0, sy, 0, 0]); }
const toScreen = (x, y) => [MAT[0] * x + MAT[2] * y + MAT[4], MAT[1] * x + MAT[3] * y + MAT[5]];
const matScale = () => Math.sqrt(Math.abs(MAT[0] * MAT[3] - MAT[1] * MAT[2]));
const matRot = () => Math.atan2(MAT[1], MAT[0]);

// camera: world point (cx, cy) lands at frame centre, zoomed and rolled. Always pair camOn/camOff.
function camOn(cx = W / 2, cy = H / 2, zoom = 1, roll = 0) { pushT(); tr(W / 2, H / 2); rot(roll); scl(zoom); tr(-cx, -cy); }
function camOff() { popT(); }
// deterministic handheld drift and impact shake
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
// a limb as a closed tapered capsule from (x1,y1) to (x2,y2)
function limbP(x1, y1, x2, y2, r1, r2 = r1, n = 6) {
  const a = Math.atan2(y2 - y1, x2 - x1), p = [];
  for (let i = 0; i <= n; i++) { const q = a + Math.PI / 2 + i / n * Math.PI; p.push([x1 + Math.cos(q) * r1, y1 + Math.sin(q) * r1]); }
  for (let i = 0; i <= n; i++) { const q = a - Math.PI / 2 + i / n * Math.PI; p.push([x2 + Math.cos(q) * r2, y2 + Math.sin(q) * r2]); }
  return p;
}
// two-segment bendy limb (shoulder -> elbow -> hand) as a polyline
function bendP(x1, y1, x2, y2, bend = .25, n = 6) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, p = [];
  const cx = mx - dy * bend, cy = my + dx * bend;
  for (let i = 0; i <= n; i++) { const k = i / n, a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; p.push([a * x1 + b * cx + c * x2, a * y1 + b * cy + c * y2]); }
  return p;
}
function starP(cx, cy, r, inner = .45, n = 5, r0 = -Math.PI / 2) { const p = []; for (let i = 0; i < n * 2; i++) { const a = r0 + i * Math.PI / n, q = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } return p; }
// irregular watercolour blob (stable shape from seed, gently boiling)
function blobP(cx, cy, rx, ry, seed = 1, wob = .18, n = 18, j = 0) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (hash2(seed, i) - .5) * 2 * wob; p.push([cx + Math.cos(a) * rx * k + jit(j), cy + Math.sin(a) * ry * k + jit(j)]); } return p; }

// ---------- painting ----------
// shape(pts, o): one painted shape.
//   o.flat / o.flatA      flat wash colour (solid read; characters, props)
//   o.water / o.waterA    watercolour fill with bleeding edges (backgrounds, glows, shading); o.bleed, o.tex, o.edge
//   o.line / o.lw / o.br  ink outline colour (false = none), weight, brush name; o.curve smooths the outline (0..1)
function shape(pts, o = {}) {
  if (o.flat || o.water) {
    if (o.flat) brush.wash(o.flat, o.flatA ?? 255); else brush.noWash();
    if (o.water) { brush.fill(o.water, o.waterA ?? 150); brush.fillBleed(o.bleed ?? .12); brush.fillTexture(o.tex ?? .45, o.edge ?? .4); } else brush.noFill();
    brush.noHatch(); brush.noStroke();
    if (o.curve) { brush.beginShape(o.curve); for (const p of pts) brush.vertex(p[0], p[1]); brush.endShape(true); } else brush.polygon(pts);
  }
  if (o.line !== false && o.line !== null) {
    brush.noWash(); brush.noFill(); brush.noHatch(); brush.set(o.br || 'pen', o.line || INK(), o.lw ?? 1);
    brush.beginShape(o.curve || 0); for (const p of pts) brush.vertex(p[0], p[1]); brush.endShape(true);
  }
}
// stroke along an open path
function stroke_(pts, lw = 1, col = null, br = 'pen', curve = .5) {
  if (pts.length < 2) return;
  brush.noFill(); brush.noWash(); brush.noHatch(); brush.set(br, col || INK(), lw); brush.spline(pts, curve);
}
// quick helpers
const disc = (cx, cy, r, col, o = {}) => shape(ellP(cx, cy, r, o.ry ?? r, o.n ?? 22, o.j ?? 0), { flat: col, line: o.line ?? false, lw: o.lw, curve: o.curve ?? .6, ...o.extra });
const glow = (cx, cy, rx, ry, col, a = 60, seed = 3) => shape(blobP(cx, cy, rx, ry, seed, .12, 16), { water: col, waterA: a, bleed: .3, tex: .2, edge: .15, line: false, curve: .8 });

// ---------- text queue (lettering is drawn on the 2D layer after the paint, following the current transform) ----------
let TEXTQ = [];
// label(txt, x, y, size, colour, o): o.font ('hand' | 'anton' | 'ui'), o.align, o.pop (0..1 appear), o.alpha, o.rot,
// o.stroke (outline colour), o.shadow (false to disable), o.weight, o.maxW (shrink to fit), o.track (letter spacing px)
function label(txt, x, y, size, col, o = {}) {
  const [sx, sy] = toScreen(x, y), k = matScale();
  TEXTQ.push({ txt: String(txt), x: sx, y: sy, size: size * k, col, ...o, rot: (o.rot || 0) + matRot(), maxW: o.maxW ? o.maxW * k : 0 });
}
const FONTS = { hand: '"Shantell", "Comic Sans MS", cursive', anton: '"Anton", Impact, sans-serif', ui: 'Inter, "Helvetica Neue", Arial, sans-serif' };
function drawText(c, list) {
  for (const L of list) {
    const k = L.pop != null ? over(L.pop, 2.2) : 1; if (k <= .01) continue;
    const fam = FONTS[L.font || 'hand'] || L.font, wt = L.weight || (L.font === 'ui' ? 700 : L.font === 'anton' ? 400 : 800);
    c.save(); c.translate(L.x, L.y); c.rotate(L.rot || 0); c.globalAlpha = clamp(L.alpha ?? 1);
    c.font = `${wt} ${L.size}px ${fam}`;
    if (L.track) c.letterSpacing = (L.track * L.size / 100) + 'px';
    let s = k; if (L.maxW) { const w = c.measureText(L.txt).width; if (w > L.maxW) s *= L.maxW / w; }
    c.scale(s, s); c.textAlign = L.align || 'center'; c.textBaseline = 'middle';
    if (L.stroke) { c.lineJoin = 'round'; c.lineWidth = L.size * (L.strokeW || .16); c.strokeStyle = L.stroke; c.strokeText(L.txt, 0, 0); }
    if (L.shadow !== false && L.font !== 'ui') { c.fillStyle = rgba(L.shadowCol || '#1d1a24', .9); c.fillText(L.txt, L.size * .04, L.size * .05); }
    c.fillStyle = L.col; c.fillText(L.txt, 0, 0);
    c.restore();
  }
}

// ---------- paper and grain (built once) ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function makePaper(col = '#F2EADB') {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), r = rng(42);
  c.fillStyle = col; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, rad = 140 + r() * 420, g = c.createRadialGradient(x, y, 0, x, y, rad), a = .05 * r(); g.addColorStop(0, `rgba(150,118,78,${a})`); g.addColorStop(1, 'rgba(150,118,78,0)'); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 1800; i++) { const x = r() * W, y = r() * H, l = 5 + r() * 22, a = r() * TAU; c.strokeStyle = `rgba(105,84,58,${.03 + r() * .06})`; c.lineWidth = .8 + r() * .6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .7) * l * .5, y + Math.sin(a + .7) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return cv;
}
function makeGrain() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), r = rng(9);
  const id = c.createImageData(W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - (r() < .5 ? r() * r() * 30 : 0); d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 4; d[i + 3] = 255; }
  c.putImageData(id, 0, 0);
  const g = c.createRadialGradient(W / 2, H * .46, H * .32, W / 2, H / 2, H * .78); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(110,86,64,.32)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return cv;
}

// ---------- brushes ----------
function defineBrushes() {
  brush.add('pen', { type: 'default', weight: 5, scatter: .2, sharpness: .85, grain: 35, opacity: 235, spacing: .22, pressure: [1.2, .7], rotate: 'natural', noise: .12 });
  brush.add('fine', { type: 'default', weight: 2.4, scatter: .12, sharpness: .9, grain: 35, opacity: 230, spacing: .22, pressure: [1.1, .8], rotate: 'natural', noise: .08 });
  brush.add('bristle', { type: 'default', weight: 16, scatter: 2.6, sharpness: .35, grain: 8, opacity: 110, spacing: .55, pressure: [1.1, .55], rotate: 'natural', noise: .45 });
  brush.add('chalky', { type: 'default', weight: 6, scatter: 1.2, sharpness: .3, grain: 4, opacity: 150, spacing: .5, pressure: [1, .8], rotate: 'natural', noise: .6 });
}

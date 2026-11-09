// main.js — turns a spec into frames. Each frame:
//   1. paints the active shot (two shots during a two-layer transition) on a 2D layer: paper, cached plates, live drawing
//   2. composes the transition between the layers
//   3. draws the caption overlay, then multiplies paper grain and vignette over everything.
// Plates (painted backgrounds) are painted once with p5.brush in WebGL and cached by key.
let SPEC = null, SHOTS = [], MOUTH = null, CUR = null, SEED = 1;
let PAPER = null, PAPERG = null, GRAIN = null, LAYER = [], OUT = null, OUTX = null, GLCANVAS = null;
let PLATE_JOB = null; const PLATES = new Map(); let MISSING = [];
const STATS = { plates: 0, plateMs: 0 };

async function setup() {
  createCanvas(GW, GH, WEBGL); pixelDensity(1); noLoop();
  GLCANVAS = drawingContext.canvas;
  brush.scaleBrushes(2.2); defineBrushes();
  PAPER = makePaper();
  PAPERG = createGraphics(W, H); PAPERG.pixelDensity(1); PAPERG.drawingContext.drawImage(PAPER, 0, 0);
  GRAIN = makeGrain();
  for (let i = 0; i < 2; i++) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; LAYER.push(cv); }
  OUT = document.getElementById('out'); OUTX = OUT.getContext('2d');
  await Promise.all([document.fonts.load('800 60px "Shantell"'), document.fonts.load('60px "Anton"')]);
  window.ready = true;
}

// ---------- plates ----------
// plate(key, rect, painter, o): draw a cached painted plate covering world rect [x, y, w, h] under the current transform.
// painter() runs once in PLATE mode (p5.brush). o.res = pixels per world unit (default fits the GL canvas).
function plate(key, rect, painter, o = {}) {
  const hit_ = PLATES.get(key);
  if (PLATE) return painter();                       // nested plates paint straight into the parent plate
  if (!hit_) { if (!MISSING.find(m => m.key === key)) MISSING.push({ key, rect, painter, o }); return; }
  const c = CTX; applyMat(c); c.globalAlpha = o.alpha ?? 1; c.drawImage(hit_.cv, rect[0], rect[1], rect[2], rect[3]); c.globalAlpha = 1;
}
function draw() {
  if (!PLATE_JOB) return;
  const { rect, painter, s, key } = PLATE_JOB;
  PLATE = true; MAT = [1, 0, 0, 1, 0, 0]; MSTACK = [];
  seedRnd(Math.floor(hash(key.length * 7.7 + key.charCodeAt(0)) * 1e6) + SEED); noiseSeed(SEED);
  push(); translate(-GW / 2, -GH / 2); scale(s); translate(-rect[0], -rect[1]);
  image(PAPERG, rect[0], rect[1], rect[2], rect[3]);
  try { painter(); } finally { pop(); PLATE = false; }
}
async function paintPlate(job) {
  const t0 = performance.now(), rect = job.rect, s = job.o.res || Math.min(GW / rect[2], GH / rect[3]);
  PLATE_JOB = { ...job, s }; await redraw(); PLATE_JOB = null;
  const cv = document.createElement('canvas'); cv.width = Math.round(rect[2] * s); cv.height = Math.round(rect[3] * s);
  cv.getContext('2d').drawImage(GLCANVAS, 0, 0, cv.width, cv.height, 0, 0, cv.width, cv.height);
  PLATES.set(job.key, { cv }); STATS.plates++; STATS.plateMs += performance.now() - t0;
}
// disk cache: plates are deterministic, so the renderer keeps them in engine/cache/plates between runs
let PLATE_VER = 'dev';
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };
const plateName = job => fnv(PLATE_VER + '|' + job.key) + fnv(job.key + '|' + PLATE_VER + JSON.stringify(job.rect));
async function loadPlate(job) {
  if (!window.savePlate) return false;
  try {
    const r = await fetch(`cache/plates/${plateName(job)}.png`); if (!r.ok) return false;
    const bmp = await createImageBitmap(await r.blob()), cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0); PLATES.set(job.key, { cv }); return true;
  } catch (e) { return false; }
}
async function storePlate(job) { if (window.savePlate) await window.savePlate(plateName(job), PLATES.get(job.key).cv.toDataURL('image/png')); }
// a mottled pigment texture painted with p5.brush watercolour fills; multiplied into flat colours on the live layer
async function paintPigment() {
  const job = { key: '__pigment', rect: [0, 0, 900, 900], o: { res: .8 }, painter: () => {
    shape([[-20, -20], [920, -20], [920, 920], [-20, 920]], { flat: '#FFFFFF', line: false });
    for (let i = 0; i < 16; i++) {
      const x = hash(i * 3.1) * 900, y = hash(i * 5.7) * 900, r = 120 + hash(i * 1.3) * 260;
      shape(blobP(x, y, r, r * (.6 + hash(i) * .6), i, .3, 14), { water: i % 3 ? '#B9B2A8' : '#9E968C', waterA: 70 + hash(i * 9) * 70, bleed: .25, tex: .9, edge: .7, line: false, curve: .6 });
    }
  } };
  await paintPlate(job); const cv = PLATES.get('__pigment').cv; PLATES.delete('__pigment'); return cv;
}

// ---------- spec → shot list ----------
const SPEAKER_COL = { SAM: '#4E6489', CLOCKY: '#6E9A1E', NOTES: '#D99A12', MANAGER: '#4A4560', STUB: '#A07C3C' };
const SPEAKER_NAME = { SAM: 'Sam', CLOCKY: 'Clocky', NOTES: 'Notes', MANAGER: 'Manager', STUB: 'Paycheck' };
window.loadSpec = (spec, mouth = null, plateVer = 'dev') => {
  PLATE_VER = plateVer; SPEC = spec; MOUTH = mouth; SEED = spec.seed || 1;
  const shots = spec.shots.map(s => ({ ...s }));
  const ec = spec.endCard || {};
  shots.push({ scene: 'endcard', start: ec.start ?? (spec.duration - 4.5), params: ec, caption: ec.caption || null, say: ec.say, speaker: ec.speaker || null, palette: ec.palette });
  shots.forEach((s, i) => { s.i = i; s.end = i + 1 < shots.length ? shots[i + 1].start : spec.duration; s.dur = s.end - s.start; s.params = s.params || {}; });
  SHOTS = shots;
  return SHOTS.map(s => [s.scene, s.start, s.end]);
};
const shotAt = t => { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x.start) s = x; return s; };
function transOf(shot) {                       // the transition INTO shot (taken from the previous shot's "out")
  const prev = SHOTS[shot.i - 1]; if (!prev) return null;
  let o = prev.out ?? SPEC.transition ?? 'brush'; if (typeof o === 'string') o = { type: o };
  if (o.type === 'cut' || !TRANS[o.type]) return { ...o, type: 'cut', half: 0 };
  return { ...o, half: o.half ?? TRANS[o.type].half };
}
function framePlan(t) {
  const s = shotAt(t), nx = SHOTS[s.i + 1];
  const tin = transOf(s), tout = nx ? transOf(nx) : null;
  if (tout && tout.half && t > nx.start - tout.half) return { a: s, b: nx, tr: tout, p: seg(t, nx.start - tout.half, nx.start + tout.half) };
  if (tin && tin.half && t < s.start + tin.half) return { a: SHOTS[s.i - 1], b: s, tr: tin, p: seg(t, s.start - tin.half, s.start + tin.half) };
  return { a: s, b: null, tr: null, p: 0 };
}

// ---------- mouths: voiced envelope when present, otherwise a procedural flap while the speaker's line plays ----------
function talk(who, t) {
  if (MOUTH && MOUTH.mouth[who]) { const f = Math.round(t * MOUTH.fps); return MOUTH.mouth[who][f] || 0; }
  const s = CUR; if (!s || s.speaker !== who || !(s.say || s.caption)) return 0;
  const lt = t - s.start, words = (s.say || s.caption).split(/\s+/).length, len = Math.min(s.dur - .35, .25 + words * .28);
  if (lt < .15 || lt > .15 + len) return 0;
  const x = (lt - .15) * 7.5; return clamp(.2 + .8 * Math.abs(Math.sin(x * 1.7)) * (.6 + .4 * Math.sin(x * .63 + 1)));
}

// ---------- layers ----------
function paintLive(shot, t, cv) {
  CTX = cv.getContext('2d'); CTX.setTransform(1, 0, 0, 1, 0, 0); CTX.globalAlpha = 1; CTX.globalCompositeOperation = 'source-over';
  CTX.drawImage(PAPER, 0, 0);
  MAT = [1, 0, 0, 1, 0, 0]; MSTACK = []; TNOW = t; CUR = shot;
  seedRnd(SEED * 1000 + boilFrame(t) * 7 + shot.i * 131);
  usePalette(shot.palette || SPEC.palette);
  const fn = SCENES[shot.scene]; if (!fn) throw new Error('unknown scene template: ' + shot.scene);
  fn({ t, lt: t - shot.start, dur: shot.dur, p: shot.params, shot, setting: shot.params.setting || SPEC.setting });
  CTX.setTransform(1, 0, 0, 1, 0, 0); CTX.globalAlpha = 1;
}
async function renderLayer(shot, t, li) {
  for (let pass = 0; pass < 4; pass++) {
    MISSING = [];
    paintLive(shot, t, LAYER[li]);
    if (!MISSING.length) break;
    for (const job of MISSING.splice(0)) if (!(await loadPlate(job))) { await paintPlate(job); await storePlate(job); }
  }
  return LAYER[li];
}
async function composeFrame(t) {
  if (!PIGMENT) PIGMENT = await paintPigment();
  const plan = framePlan(t), c = OUTX;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  if (!plan.tr) c.drawImage(await renderLayer(plan.a, t, 0), 0, 0);
  else {
    const T = TRANS[plan.tr.type];
    const A = T.single && plan.p >= .5 ? null : await renderLayer(plan.a, t, 0);
    const B = T.single && plan.p < .5 ? null : await renderLayer(plan.b, t, 1);
    usePalette((plan.p < .5 ? plan.a : plan.b).palette || SPEC.palette);
    CTX = c; MAT = [1, 0, 0, 1, 0, 0]; MSTACK = []; seedRnd(SEED * 77 + boilFrame(t));
    T.compose(c, A, B, plan.p, plan.tr, t);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  usePalette(SPEC.palette);
  CTX = c; MAT = [1, 0, 0, 1, 0, 0]; drawCaptions(c, t, plan);
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
  c.globalCompositeOperation = 'multiply'; c.drawImage(GRAIN, 0, 0); c.globalCompositeOperation = 'source-over';
}
window.renderAt = async (t, type = 'image/jpeg', q = .93) => { await composeFrame(t); return OUT.toDataURL(type, q); };
window.renderSheet = async (times, cols = 6, w = 240) => {
  const h = Math.round(w * H / W), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); await composeFrame(times[i]); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    c.drawImage(OUT, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x, y, 70, 22); c.fillStyle = '#fff'; c.font = '14px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 5, y + 16);
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms, stats: STATS };
};
window.gpuInfo = () => { const gl = drawingContext, e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };

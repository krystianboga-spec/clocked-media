// main.js — turns a spec into frames. Each frame:
//   1. paints the active shot (two shots during a two-layer transition) in WebGL, copies it to a 2D layer, adds its lettering
//   2. composes the transition (painted cover passes run in WebGL again; geometric ones run in 2D)
//   3. draws the caption overlay, then multiplies paper grain and vignette over everything.
let SPEC = null, SHOTS = [], MOUTH = null, CUR = null, PASS = null, SEED = 1;
let PAPERG = null, GRAIN = null, LAYER = [], OUT = null, OUTX = null, GLCANVAS = null;

async function setup() {
  createCanvas(W, H, WEBGL); pixelDensity(1); noLoop();
  GLCANVAS = drawingContext.canvas;
  brush.scaleBrushes(2.2); defineBrushes();
  PAPERG = createGraphics(W, H); PAPERG.pixelDensity(1); PAPERG.drawingContext.drawImage(makePaper(), 0, 0);
  GRAIN = makeGrain();
  for (let i = 0; i < 2; i++) { const g = createGraphics(W, H); g.pixelDensity(1); LAYER.push(g); }
  OUT = document.getElementById('out'); OUTX = OUT.getContext('2d');
  await Promise.all([document.fonts.load('800 60px "Shantell"'), document.fonts.load('60px "Anton"')]);
  window.ready = true;
}

// ---------- spec → shot list ----------
const SPEAKER_COL = { SAM: '#4E6489', CLOCKY: '#7FA626', NOTES: '#E0A21E', MANAGER: '#4A4560', STUB: '#B08A4A' };
const SPEAKER_NAME = { SAM: 'Sam', CLOCKY: 'Clocky', NOTES: 'Notes', MANAGER: 'Manager', STUB: 'Paycheck' };
window.loadSpec = (spec, mouth = null) => {
  SPEC = spec; MOUTH = mouth; SEED = spec.seed || 1;
  const shots = spec.shots.map(s => ({ ...s }));
  shots.push({ scene: 'endcard', start: spec.endCard?.start ?? (spec.duration - 4.5), params: spec.endCard || {}, caption: spec.endCard?.caption || null, speaker: spec.endCard?.speaker || null, palette: spec.endCard?.palette });
  shots.forEach((s, i) => { s.i = i; s.end = i + 1 < shots.length ? shots[i + 1].start : spec.duration; s.dur = s.end - s.start; s.params = s.params || {}; });
  SHOTS = shots;
  return SHOTS.map(s => [s.scene, s.start, s.end]);
};
const shotAt = t => { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x.start) s = x; return s; };
function transOf(shot) {                       // the transition INTO shot (taken from the previous shot's "out")
  const prev = SHOTS[shot.i - 1]; if (!prev) return null;
  let o = prev.out ?? SPEC.transition ?? 'brush'; if (typeof o === 'string') o = { type: o };
  if (o.type === 'cut') return { ...o, half: 0 };
  return { ...o, half: o.half ?? (TRANS[o.type]?.half ?? .3) };
}
// which layers and transition a time needs
function framePlan(t) {
  const s = shotAt(t), nx = SHOTS[s.i + 1];
  const tin = transOf(s), tout = nx ? transOf(nx) : null;
  if (tout && tout.half && t > nx.start - tout.half) return { a: s, b: nx, tr: tout, p: seg(t, nx.start - tout.half, nx.start + tout.half) };
  if (tin && tin.half && t < s.start + tin.half) return { a: SHOTS[s.i - 1], b: s, tr: tin, p: seg(t, s.start - tin.half, s.start + tin.half) };
  return { a: s, b: null, tr: null, p: 0 };
}

// ---------- mouths: voiced envelope when present, otherwise a procedural flap during the speaker's caption ----------
function talk(who, t) {
  if (MOUTH && MOUTH.mouth[who]) { const f = Math.round(t * MOUTH.fps); return MOUTH.mouth[who][f] || 0; }
  const s = CUR; if (!s || s.speaker !== who || !s.caption) return 0;
  const lt = t - s.start, words = (s.say || s.caption).split(/\s+/).length, len = Math.min(s.dur - .35, .25 + words * .3);
  if (lt < .15 || lt > .15 + len) return 0;
  const x = (lt - .15) * 7.5; return clamp(.25 + .75 * Math.abs(Math.sin(x * 1.7)) * (.6 + .4 * Math.sin(x * .63 + 1)));
}

// ---------- drawing passes ----------
function draw() {
  if (!PASS) return;
  MAT = [1, 0, 0, 1, 0, 0]; MSTACK = []; TEXTQ = [];
  push(); translate(-W / 2, -H / 2);
  randomSeed(SEED * 1000 + boilFrame(PASS.t) * 7 + (PASS.shot ? PASS.shot.i * 131 : 0)); noiseSeed(SEED);
  if (PASS.kind === 'scene') {
    CUR = PASS.shot; usePalette(CUR.palette || SPEC.palette);
    image(PAPERG, 0, 0);
    const fn = SCENES[CUR.scene]; if (!fn) throw new Error('unknown scene template: ' + CUR.scene);
    fn({ t: PASS.t, lt: PASS.t - CUR.start, dur: CUR.dur, p: CUR.params, shot: CUR, setting: CUR.params.setting || CUR.setting || SPEC.setting });
  } else if (PASS.kind === 'cover') {
    usePalette(PASS.palette); image(PASS.src, 0, 0);
    TRANS[PASS.tr.type].paint(PASS.p, PASS.tr, PASS.t);
  }
  pop();
}
async function paintPass(pass) { PASS = pass; await redraw(); PASS = null; }
async function renderLayer(shot, t, li) {
  await paintPass({ kind: 'scene', shot, t });
  const g = LAYER[li], c = g.drawingContext;
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.drawImage(GLCANVAS, 0, 0, W, H);
  drawText(c, TEXTQ); TEXTQ = [];
  return g;
}
async function composeFrame(t) {
  const plan = framePlan(t), c = OUTX;
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  if (!plan.tr) { c.drawImage((await renderLayer(plan.a, t, 0)).elt, 0, 0); }
  else {
    const T = TRANS[plan.tr.type];
    if (T.paint) {                                                   // painted cover: A gets covered, then B is uncovered
      const src = plan.p < .5 ? await renderLayer(plan.a, t, 0) : await renderLayer(plan.b, t, 0);
      await paintPass({ kind: 'cover', src, tr: plan.tr, p: plan.p, t, palette: (plan.p < .5 ? plan.a : plan.b).palette || SPEC.palette });
      c.drawImage(GLCANVAS, 0, 0, W, H);
    } else {
      const A = await renderLayer(plan.a, t, 0), B = await renderLayer(plan.b, t, 1);
      usePalette(SPEC.palette); T.compose(c, A.elt, B.elt, plan.p, plan.tr, t);
    }
  }
  drawCaptions(c, t, plan);
  c.globalCompositeOperation = 'multiply'; c.drawImage(GRAIN, 0, 0); c.globalCompositeOperation = 'source-over';
}
window.renderAt = async (t, type = 'image/jpeg', q = .93) => { await composeFrame(t); return OUT.toDataURL(type, q); };
window.renderSheet = async (times, cols = 4, w = 270) => {
  const h = Math.round(w * H / W), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); await composeFrame(times[i]); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    c.drawImage(OUT, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x, y, 74, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 5, y + 17);
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => { const gl = drawingContext, e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };

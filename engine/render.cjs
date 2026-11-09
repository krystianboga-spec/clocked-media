#!/usr/bin/env node
// render.cjs — paint a spec in headless Chromium (Playwright) and encode with ffmpeg.
//
//   node engine/render.cjs engine/specs/ot-puzzle.json --sheet=auto --out=check.jpg      contact sheet (auto = every shot + every cut)
//   node engine/render.cjs engine/specs/ot-puzzle.json --sheet=1,2.5,4 --w=360 --cols=3  contact sheet at chosen times
//   node engine/render.cjs engine/specs/ot-puzzle.json --stills=2.0,7.5 --out=dir        full-size JPEG stills
//   node engine/render.cjs engine/specs/ot-puzzle.json --video --out=out.mp4             silent MP4
//   node engine/render.cjs engine/specs/ot-puzzle.json --video --voice --out=out.mp4     voiced MP4 (run voice.py first)
// Options: --workers=N (pages rendering segments in parallel, default 2), --fresh (ignore the segment cache)
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { spawn } = require('child_process');

const ENGINE = __dirname;
const argv = process.argv.slice(2);
const specPath = argv.find(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
if (!specPath) { console.error('usage: node render.cjs <spec.json> [--sheet=auto|t,t,..] [--stills=t,..] [--video] [--voice] [--out=..]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const FPS = spec.fps || 30;
const CACHE = path.join(ENGINE, 'cache');
const voiceBase = path.join(CACHE, 'voice', spec.id);
const mouth = args.voice ? JSON.parse(fs.readFileSync(voiceBase + '.json', 'utf8')) : null;

const run = (cmd, a, opts = {}) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: ['ignore', 'inherit', 'inherit'], ...opts }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  return new Promise(ok => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ENGINE, decodeURIComponent(q.url.split('?')[0]));
      if (!f.startsWith(ENGINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => ok(srv));
  });
}
const sha = (...xs) => { const h = crypto.createHash('sha1'); for (const x of xs) h.update(typeof x === 'string' ? x : JSON.stringify(x)); return h.digest('hex').slice(0, 16); };
function engineHash() {
  const files = ['studio.html', ...fs.readdirSync(path.join(ENGINE, 'src')).sort().map(f => 'src/' + f)];
  return sha(...files.map(f => fs.readFileSync(path.join(ENGINE, f), 'utf8')));
}

const PLATE_VER = (() => { const h = crypto.createHash('sha1'); for (const f of ['core.js', 'palettes.js', 'settings.js', 'main.js']) h.update(fs.readFileSync(path.join(ENGINE, 'src', f))); return h.digest('hex').slice(0, 12); })();
(async () => {
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch();
  async function openPage(tag = '') {
    const page = await browser.newPage();
    page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource|GPU stall|GL Driver/.test(m.text())) console.log(`[page${tag}]`, m.text()); });
    page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
    await page.exposeFunction('savePlate', (name, url) => { const d = path.join(CACHE, 'plates'); fs.mkdirSync(d, { recursive: true }); const f = path.join(d, name + '.png'); fs.writeFileSync(f + '.tmp', Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); fs.renameSync(f + '.tmp', f); });
    await page.goto(`http://127.0.0.1:${port}/studio.html?render`);
    await page.waitForFunction('window.ready === true', null, { timeout: 120000 });
    const shots = await page.evaluate(([s, m, v]) => window.loadSpec(s, m, v), [spec, mouth, PLATE_VER]);
    return { page, shots };
  }
  const frame = async (page, t, q = .93) => { const url = await page.evaluate(([t, q]) => window.renderAt(t, 'image/jpeg', q), [t, q]); return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'); };

  try {
    if (args.sheet) {
      const { page, shots } = await openPage();
      let times;
      if (args.sheet === 'auto') {
        times = [];
        shots.forEach(([, a, b], i) => { if (i > 0) times.push(a - .1, a + .02); times.push(a + Math.min(.45, (b - a) * .25), a + (b - a) * .7); });
        times = times.filter(t => t >= 0 && t < spec.duration).map(t => +t.toFixed(2));
      } else times = String(args.sheet).split(',').map(Number);
      const out = args.out || `sheet-${spec.id}.jpg`; fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      const { url, ms } = await page.evaluate(([ts, c, w]) => window.renderSheet(ts, c, w), [times, +(args.cols || 6), +(args.w || 240)]);
      fs.writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      console.log(`${out}\nms/frame: ${ms.join(' ')}\navg ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(0)} ms`);
    } else if (args.stills) {
      const { page } = await openPage(), out = args.out || 'stills'; fs.mkdirSync(out, { recursive: true });
      console.log('GPU:', await page.evaluate(() => window.gpuInfo()));
      for (const s of String(args.stills).split(',').map(Number)) {
        const t0 = Date.now(), buf = await frame(page, s, .95), f = path.join(out, `${spec.id}-t${s.toFixed(2)}.jpg`);
        fs.writeFileSync(f, buf); console.log(`${f}  ${Date.now() - t0} ms`);
      }
    } else if (args.video) {
      const out = args.out || `${spec.id}.mp4`, workers = +(args.workers || 2);
      fs.mkdirSync(path.join(CACHE, 'seg'), { recursive: true }); fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      const eh = engineHash(), { shots: _ } = { shots: null };
      const probe = await openPage(); const shots = probe.shots; await probe.page.close();
      const globals = { ...spec, shots: undefined, title: undefined };
      const nFrames = Math.round(spec.duration * FPS);
      // one segment per shot; a segment re-renders only when its shots, neighbours or (voiced) mouth data change
      const segs = shots.map(([, a, b], i) => {
        const f0 = Math.round(a * FPS), f1 = i === shots.length - 1 ? nFrames : Math.round(b * FPS);
        const near = [i - 1, i, i + 1].filter(j => j >= 0 && j < shots.length);
        const shotJSON = near.map(j => j < spec.shots.length ? spec.shots[j] : spec.endCard);
        const speaks = shotJSON.some(s => s && s.speaker);
        let mk = 'none';
        if (speaks) mk = mouth ? sha(Object.fromEntries(Object.entries(mouth.mouth).map(([k, v]) => [k, v.slice(f0, f1)]))) : 'procedural';
        const key = sha(eh, globals, shotJSON, f0, f1, mk);
        return { i, f0, f1, file: path.join(CACHE, 'seg', `${spec.id}-${String(i).padStart(2, '0')}-${key}.mp4`) };
      });
      const todo = args.fresh ? segs : segs.filter(s => !fs.existsSync(s.file));
      console.log(`${segs.length} segments, ${todo.length} to paint (${todo.reduce((a, s) => a + s.f1 - s.f0, 0)} frames), ${workers} workers`);
      const start = Date.now(); let next = 0, done = 0;
      await Promise.all(Array.from({ length: Math.min(workers, todo.length) }, async (_, w) => {
        const { page } = await openPage('#' + w);
        while (next < todo.length) {
          const s = todo[next++], tmp = s.file.replace(/\.mp4$/, `.part${w}.mp4`);
          const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '60', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
          const closed = new Promise((ok, bad) => ff.on('close', c => c ? bad(new Error('ffmpeg ' + c)) : ok()));
          const t0 = Date.now();
          for (let f = s.f0; f < s.f1; f++) {
            const buf = await frame(page, f / FPS);
            if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
          }
          ff.stdin.end(); await closed; fs.renameSync(tmp, s.file); done += s.f1 - s.f0;
          console.log(`segment ${s.i} (${s.f1 - s.f0} frames) ${((Date.now() - t0) / (s.f1 - s.f0)).toFixed(0)} ms/frame · ${done} frames done · ${((Date.now() - start) / 1000).toFixed(0)} s`);
        }
        await page.close();
      }));
      if (todo.length) console.log(`painted ${done} frames in ${((Date.now() - start) / 1000).toFixed(0)} s → ${((Date.now() - start) / Math.max(1, done)).toFixed(0)} ms/frame effective`);
      const list = path.join(CACHE, `${spec.id}-concat.txt`);
      fs.writeFileSync(list, segs.map(s => `file '${s.file}'`).join('\n'));
      const tmpOut = out.replace(/\.mp4$/, '.tmp.mp4');
      if (mouth) {
        await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', voiceBase + '.wav', '-map', '0:v', '-map', '1:a',
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', `apad=whole_dur=${spec.duration}`, '-t', String(spec.duration), '-movflags', '+faststart', tmpOut]);
      } else {
        await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', tmpOut]);
      }
      fs.renameSync(tmpOut, out); console.log('wrote ' + out);
    }
  } finally { await browser.close(); srv.close(); }
})().catch(e => { console.error(e); process.exit(1); });

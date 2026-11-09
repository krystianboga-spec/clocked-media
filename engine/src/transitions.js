// transitions.js: painted transitions between shots. A shot's "out" names the transition into the next shot:
//   "brush" | "bloom" | "drip" | "splat" (painted covers: paint covers shot A, then lifts off shot B)
//   "whip" | "tear" | "flip" | "iris" | "zoom" (two-layer: both shots are painted and composited) | "cut"
// Options (object form): { type, half (seconds each side of the cut), colors:[...], x, y (iris/splat centre), dir }
// compose(c, A, B, p, o, t): p runs 0 → 1 across the cut (0.5 = the cut itself). Single-layer covers get only A
// (p < .5) or only B (p >= .5).

function bristleBand(x0, x1, yc, h, ang, col, seed, k = 1) {
  if (x1 - x0 < 2) return;
  pushT(); tr(W / 2, H / 2); rot(ang); tr(-W / 2, -H / 2);
  const n = 16, top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = lerp(x0, x1, u), sw = Math.sin(u * Math.PI * 1.3 + seed) * h * .07;
    top.push([x, yc - h / 2 + sw + (hash2(seed, i) - .5) * h * .05 + jit(2)]);
    bot.push([x, yc + h / 2 + sw * .6 + (hash2(seed + 5, i) - .5) * h * .05 + jit(2)]);
  }
  // rounded, loaded head of the stroke
  const head = arcP(x1, yc + Math.sin(1.3 * Math.PI + seed) * h * .05, h * .16, h / 2, -Math.PI / 2, Math.PI / 2, 7);
  const pts = top.concat(head, bot.reverse());
  shape(pts, { flat: col, line: false, tex: .75, wet: 1.6, curve: .5, shade: .18, light: [0, -.06] });
  // dry-brush streaks: pale bristle gaps and dark pigment ridges along the stroke
  for (let i = 0; i < 14; i++) {
    const yy = yc + (hash2(seed, i + 40) - .5) * h * .86, xs = lerp(x0, x1, hash2(seed, i + 70) * .35), xe = lerp(xs, x1, .55 + hash2(seed, i + 90) * .45);
    stroke_([[xs, yy], [lerp(xs, xe, .5), yy + jit(3)], [xe, yy + (hash(i) - .5) * 8]], .5 + hash(i + seed) * 1.1, mixC(col, i % 3 ? '#ffffff' : '#000000', i % 3 ? .3 : .22), 'fine', .4);
  }
  popT();
}
const TRANS = {
  cut: { half: 0 },
  // broad diagonal dry-brush strokes sweep across, then pull away
  brush: {
    half: .27, single: true,
    compose(c, A, B, p, o, t) {
      c.drawImage(A || B, 0, 0);
      const cols = o.colors || [PAL.accent, LIME, PAL.wall2, PAL.warm], n = 6, h = (H + 700) / n * 1.4, ang = o.ang ?? -.16, L = -500, R = W + 500;
      for (let i = 0; i < n; i++) {
        const yc = -350 + (i + .5) * (H + 700) / n, d = (i % 2 ? .06 : 0) + i * .03;
        const col = cols[i % cols.length];
        if (p < .5) { const k = eInOut(seg(p / .5, d, d + .79)); if (k > 0) bristleBand(L, lerp(L, R, k), yc, h, ang, col, i + 1); }
        else { const k = eInOut(seg((p - .5) / .5, d, d + .79)); if (k < 1) bristleBand(lerp(L, R, k), R, yc, h, ang, col, i + 1); }
      }
    },
  },
  // wet watercolour blooms open up and swallow the frame
  bloom: {
    half: .3, single: true,
    compose(c, A, B, p, o, t) {
      c.drawImage(A || B, 0, 0);
      const cols = o.colors || [PAL.accent, PAL.cool, LIME, PAL.warm], pts = [[200, 300], [880, 520], [420, 980], [900, 1380], [180, 1640], [600, 1820], [540, 120]];
      const q = p < .5 ? p / .5 : 1 - (p - .5) / .5;
      pts.forEach(([x, y], i) => {
        const k = eInOut(seg(q, i * .04, i * .04 + .76)); if (k <= 0) return;
        const col = cols[i % cols.length], r = 820 * k + 1;
        // soft bleeding halo, then the wet body of the bloom with a darker tide line
        shape(blobP(x, y, r * 1.18, r * 1.1, i + 29, .3, 18, 8), { flat: mixC(col, '#ffffff', .25), flatA: 90, line: false, tex: 0, curve: .8 });
        shape(blobP(x, y, r * 1.07, r * 1.0, i + 19, .26, 18, 6), { flat: col, flatA: 150, line: false, tex: .4, curve: .8 });
        shape(blobP(x, y, r, r * .93, i + 9, .22, 18, 6), { flat: col, line: false, tex: .8, wet: 2.4, curve: .7, shade: .12, light: [.05, .05] });
      });
    },
  },
  // paint pours down from the top with drips, then slides off the bottom
  drip: {
    half: .32, single: true,
    compose(c, A, B, p, o, t) {
      c.drawImage(A || B, 0, 0);
      const col = o.colors?.[0] || PAL.wall2, col2 = o.colors?.[1] || mixC(col, '#ffffff', .25);
      const front = p < .5 ? eIn(p / .5) * (H + 700) - 200 : H + 600, back = p < .5 ? -400 : eInOut((p - .5) / .5) * (H + 900) - 300;
      if (front - back < 4) return;
      // the paint curtain: a flat top and a front edge of rounded drips of different lengths
      const n = 9, pts = [[-60, back], [W + 60, back]];
      for (let i = n; i >= 0; i--) {
        const x = W * i / n, len = (hash(i * 3 + 1) * .7 + .3) * 340, wd = W / n * .32;
        pts.push([x + wd, front - 200]); pts.push([x + wd * .5, front - 200 + len * .9]); pts.push([x, front - 200 + len]); pts.push([x - wd * .5, front - 200 + len * .9]); pts.push([x - wd, front - 200]);
      }
      shape(pts, { flat: col, line: false, tex: .7, wet: 1.6, curve: .45 });
      for (let i = 0; i < 7; i++) { const x = (i + .5) / 7 * W + (hash(i) - .5) * 80; stroke_([[x, back + 40], [x + jit(3), lerp(back, front - 220, .6)]], .7 + hash(i * 5) * .8, col2, 'fine', .3); }
    },
  },
  // a fat paint splat lands, then a hole tears open through it to the next shot
  splat: {
    half: .22, single: true,
    compose(c, A, B, p, o, t) {
      const x = o.x ?? 540, y = o.y ?? 960, col = o.colors?.[0] || PAL.accent;
      if (p < .5) {
        c.drawImage(A, 0, 0); const k = eIn(p / .5);
        shape(starP(x, y, 1700 * k + 1, .72, 11, hash(3)), { flat: col, line: false, tex: .5, wet: 1.6, curve: .5 });
        for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 380 + 600 * k; disc(x + Math.cos(a) * r, y + Math.sin(a) * r, 40 + hash(i) * 50, col, { j: 3 }); }
      } else {
        c.drawImage(B, 0, 0); const k = eOut((p - .5) / .5), hole = blobP(x, y, 40 + 1500 * k, 40 + 1500 * k, 21, .2, 18);
        const ring = new Path2D(); ring.rect(-50, -50, W + 100, H + 100); hole.forEach((q, i) => i ? ring.lineTo(q[0], q[1]) : ring.moveTo(q[0], q[1])); ring.closePath();
        c.save(); c.fillStyle = col; c.fill(ring, 'evenodd'); c.restore();
        CTX = c; shape(hole, { line: INK(), lw: 2.4, curve: .5 });
      }
    },
  },
  // whip pan: both shots smear sideways with speed streaks
  whip: {
    half: .2,
    compose(c, A, B, p, o, t) {
      const d = o.dir ?? 1, k = eInOut(p), ax = -k * W * d, bx = (1 - k) * W * d, blur = Math.sin(p * Math.PI);
      c.drawImage(A, ax, 0); c.drawImage(B, bx, 0);
      for (const sh of [-2, -1, 1, 2]) { c.globalAlpha = .22 * blur; c.drawImage(A, ax + sh * 34 * blur, 0); c.drawImage(B, bx + sh * 34 * blur, 0); }
      c.globalAlpha = 1;
      for (let i = 0; i < 26; i++) { const y = hash(i * 3) * H, l = 200 + hash(i) * 600, x = hash(i * 7) * W; c.globalAlpha = .55 * blur; c.fillStyle = i % 3 ? '#FFFFFF' : PAL.ink; c.fillRect(x - l / 2, y, l, 3 + hash(i * 9) * 6); }
      c.globalAlpha = 1;
    },
  },
  // the frame tears in two along a ragged line and the halves fly apart
  tear: {
    half: .3,
    compose(c, A, B, p, o, t) {
      c.drawImage(B, 0, 0);
      const k = eIn(p), line = []; for (let i = 0; i <= 24; i++) line.push([i / 24 * W, H * .5 + (i / 24 - .5) * 260 + (hash(i * 5) - .5) * 70]);
      for (const sd of [-1, 1]) {
        const path = new Path2D(); path.moveTo(-10, sd < 0 ? -10 : H + 10); for (const q of line) path.lineTo(q[0], q[1]); path.lineTo(W + 10, sd < 0 ? -10 : H + 10); path.closePath();
        c.save(); c.translate(W / 2 + sd * k * 120, H / 2 + sd * k * (H * .6)); c.rotate(sd * k * .18); c.translate(-W / 2, -H / 2);
        c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 30; c.fillStyle = '#F6F0E2'; c.fill(path); c.shadowBlur = 0;
        c.clip(path); c.drawImage(A, 0, 0);
        c.lineWidth = 14; c.strokeStyle = '#F6F0E2'; c.beginPath(); line.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
        c.restore();
      }
    },
  },
  // page flip: the frame turns like a card
  flip: {
    half: .26,
    compose(c, A, B, p, o, t) {
      c.fillStyle = PAL.ink; c.fillRect(0, 0, W, H);
      const s = Math.cos(p * Math.PI), img = p < .5 ? A : B, sx = Math.abs(s);
      c.save(); c.translate(W / 2, H / 2); c.transform(sx, (p < .5 ? -1 : 1) * (1 - sx) * .25, 0, 1, 0, 0); c.translate(-W / 2, -H / 2);
      c.drawImage(img, 0, 0); c.fillStyle = `rgba(20,14,30,${(1 - sx) * .55})`; c.fillRect(0, 0, W, H); c.restore();
    },
  },
  // ink iris: the next shot opens through a growing, ragged circle with an ink rim
  iris: {
    half: .3,
    compose(c, A, B, p, o, t) {
      c.drawImage(A, 0, 0);
      const x = o.x ?? 540, y = o.y ?? 960, r = eInOut(p) * 1250, pts = blobP(x, y, r + 1, r + 1, 5, .06, 28, 3);
      const path = pathOf(pts); c.save(); c.clip(path); c.drawImage(B, 0, 0); c.restore();
      CTX = c; MAT = [1, 0, 0, 1, 0, 0]; if (r > 4 && r < 1200) shape(pts, { line: INK(), lw: 3.2, curve: 0 });
    },
  },
  // push-through zoom: A rushes past the lens, B settles in
  zoom: {
    half: .24,
    compose(c, A, B, p, o, t) {
      const x = o.x ?? 540, y = o.y ?? 960;
      if (p < .5) { const k = eIn(p / .5), s = 1 + k * 2.2; c.save(); c.translate(x, y); c.scale(s, s); c.rotate(k * .12); c.translate(-x, -y); c.drawImage(A, 0, 0); c.restore(); c.fillStyle = `rgba(255,250,235,${k * .85})`; c.fillRect(0, 0, W, H); }
      else { const k = eOut((p - .5) / .5), s = 1.5 - k * .5; c.save(); c.translate(x, y); c.scale(s, s); c.rotate((1 - k) * -.1); c.translate(-x, -y); c.drawImage(B, 0, 0); c.restore(); c.fillStyle = `rgba(255,250,235,${(1 - k) * .85})`; c.fillRect(0, 0, W, H); }
    },
  },
};

// overlay.js — captions. They sit above the transitions in the upper safe zone (top 180 px clear, 90 left, 150 right),
// hand-lettered (Shantell Sans ExtraBold), at least 54 px, on a painted paper strip with a speaker tag.
// A shot gives "caption" (+ "speaker"), or "captions": [{ at, text, speaker }] for lines that change mid-shot.
// Wrap a word in *asterisks* to mark it with a lime highlighter swash.
const CAP = { x0: 90, x1: W - 150, y: 205, size: 64, minSize: 54, lh: 1.22 };

function captionLines(c, text, size, maxW) {
  c.font = `800 ${size}px ${FONTS.hand}`;
  const words = text.split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (c.measureText(tst.replace(/\*/g, '')).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; }
  if (cur) lines.push(cur); return lines;
}
function activeCaption(shot, t) {
  if (!shot) return null;
  if (shot.captions) { let cur = null; for (const cp of shot.captions) if (t >= shot.start + (cp.at || 0)) cur = { ...cp, start: shot.start + (cp.at || 0) }; return cur && cur.text ? cur : null; }
  return shot.caption ? { text: shot.caption, speaker: shot.speaker, start: shot.start } : null;
}
function drawCaptions(c, t, plan) {
  const shot = plan.tr ? (plan.p < .5 ? plan.a : plan.b) : plan.a;
  const cap = activeCaption(shot, t); if (!cap) return;
  usePalette(shot.palette || SPEC.palette);
  const kin = seg(t, cap.start + .03, cap.start + .28), kout = 1 - seg(t, shot.end - .1, shot.end + .02);
  if (kin <= 0 || kout <= 0) return;
  const maxW = CAP.x1 - CAP.x0 - 70; let size = CAP.size, lines;
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (;;) { lines = captionLines(c, cap.text, size, maxW); if (lines.length <= 3 || size <= CAP.minSize) break; size -= 2; }
  const lh = size * CAP.lh, bw = Math.min(maxW, Math.max(...lines.map(L => { c.font = `800 ${size}px ${FONTS.hand}`; return c.measureText(L.replace(/\*/g, '')).width; }))) + 70;
  const bh = lines.length * lh + 44, cx = (CAP.x0 + CAP.x1) / 2, top = CAP.y + (cap.speaker ? 34 : 0);
  const k = over(kin, 2.2), wob = (hash(Math.floor(cap.start * 10)) - .5) * .03;
  CTX = c; MAT = [1, 0, 0, 1, 0, 0]; MSTACK = [];
  pushT(); tr(cx, top + bh / 2); rot(wob); scl(k * (kout < 1 ? lerp(.9, 1, kout) : 1)); tr(-cx, -(top + bh / 2));
  GA = kout;
  // painted paper strip
  shape(boxP(cx - bw / 2 + 8, top + 12, bw, bh, 24), { flat: '#000000', flatA: 70, line: false, tex: 0 });
  shape(boxP(cx - bw / 2, top, bw, bh, 24, 1.2), { flat: PAL.capBg, lw: 1.6, tex: .35, wet: .5 });
  // speaker tag
  if (cap.speaker) {
    const nm = SPEAKER_NAME[cap.speaker] || cap.speaker, tw = textW(nm, 40, 'hand') + 44, col = SPEAKER_COL[cap.speaker] || PAL.ink;
    pushT(); tr(cx - bw / 2 + 26, top - 30); rot(-.05);
    shape(boxP(0, -26, tw, 56, 20, .8), { flat: col, lw: 1.2, tex: .3 });
    label(nm, tw / 2, 2, 40, '#FFFBF0', {});
    popT();
  }
  // lines, with *highlight* swashes
  lines.forEach((L, i) => {
    const y = top + 22 + lh * (i + .5) + size * .02;
    c.setTransform(...MAT); c.font = `800 ${size}px ${FONTS.hand}`;
    const plain = L.replace(/\*/g, ''), wTot = c.measureText(plain).width; let x = cx - wTot / 2;
    const parts = L.split('*');
    parts.forEach((seg_, j) => {
      const ww = c.measureText(seg_).width;
      if (j % 2 && seg_) { shape(blobP(x + ww / 2, y + size * .3, ww / 2 + 8, size * .17, j + i * 5, .08, 12), { flat: LIME, flatA: 235, line: false, tex: .3, curve: .7 }); }
      x += ww;
    });
    x = cx - wTot / 2;
    parts.forEach(seg_ => { label(seg_, x, y, size, PAL.capInk, { align: 'left' }); x += (c.setTransform(...MAT), c.font = `800 ${size}px ${FONTS.hand}`, c.measureText(seg_).width); });
  });
  popT();
  GA = 1; c.globalAlpha = 1; c.setTransform(1, 0, 0, 1, 0, 0);
}

// settings.js — painted locations. setting(name, t, o) draws a cached p5.brush plate (the room) plus live ambience
// (rain, steam, flicker, glows). Call it inside the camera. The plate covers SETRECT, so the camera can drift, push
// up to ~1.35x and pan ±150 px without showing an edge. o.variant changes the furniture where a setting supports it.
const SETRECT = [-162, -288, 1404, 2496];
const FLOOR_Y = 1480;

// ---------- plate helpers (run in PLATE mode) ----------
function wallWash(col, col2, seed = 1, y0 = SETRECT[1], y1 = FLOOR_Y + 40) {
  shape(boxP(SETRECT[0], y0, SETRECT[2], y1 - y0), { flat: col, line: false });
  for (let i = 0; i < 5; i++) shape(blobP(hash2(seed, i) * W, lerp(y0, y1, hash2(seed + 1, i)), 260 + hash2(seed, i + 9) * 260, 220 + hash2(seed + 2, i) * 220, seed * 10 + i, .25, 14), { water: i % 2 ? col2 : mixC(col, '#ffffff', .25), waterA: 70, bleed: .25, tex: .6, edge: .5, line: false, curve: .6 });
}
function floorPlane(col, col2, y = FLOOR_Y, seed = 2, lines = 0) {
  shape(boxP(SETRECT[0], y, SETRECT[2], SETRECT[1] + SETRECT[3] - y), { flat: col, line: false });
  shape(blobP(W / 2, y + 260, 900, 260, seed, .2, 14), { water: col2, waterA: 90, bleed: .2, tex: .7, edge: .5, line: false, curve: .6 });
  for (let i = 1; i <= lines; i++) { const yy = y + Math.pow(i / lines, 1.6) * 760; stroke_([[SETRECT[0], yy], [W / 2, yy + 3], [SETRECT[0] + SETRECT[2], yy]], .5, mixC(col2, '#000000', .2), 'fine', .3); }
  stroke_([[SETRECT[0], y], [W * .5, y + 2], [SETRECT[0] + SETRECT[2], y]], 1.4, mixC(col2, '#000000', .35), 'pen', .2);
}
function plateGlow(x, y, r, col, a = 70, seed = 4) { shape(blobP(x, y, r, r * .9, seed, .1, 16), { water: col, waterA: a, bleed: .35, tex: .2, edge: .1, line: false, curve: .8 }); }
function wallClock(x, y, r, face = '#FBF6EA', rim = '#3A3550') {
  shape(ellP(x, y, r, r, 24), { flat: rim, line: INK(), lw: 1 });
  shape(ellP(x, y, r * .82, r * .82, 24), { flat: face, line: false });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; stroke_([[x + Math.cos(a) * r * .66, y + Math.sin(a) * r * .66], [x + Math.cos(a) * r * .76, y + Math.sin(a) * r * .76]], .5, '#555', 'fine', 0); }
}

// ---------- the settings ----------
const SETTINGS = {
  // late-night break room: lockers, schedule board, fluorescent tube, wall clock
  breakroom: {
    plate(o) {
      wallWash(PAL.wall, PAL.wall2, 3, SETRECT[1], 1180);
      shape(boxP(SETRECT[0], 1180, SETRECT[2], FLOOR_Y - 1180 + 20), { flat: PAL.wall2, water: mixC(PAL.wall2, PAL.ink, .2), waterA: 60, line: false });
      stroke_([[SETRECT[0], 1180], [SETRECT[0] + SETRECT[2], 1182]], 1.2, mixC(PAL.wall2, PAL.ink, .4), 'pen', 0);
      // fluorescent tube
      shape(boxP(160, 120, 760, 46, 20), { flat: '#E9EEE2', line: INK(), lw: 1 });
      plateGlow(540, 260, 620, PAL.glow, 110, 8);
      // bulletin board with the posted schedule
      shape(boxP(-40, 470, 520, 400, 10), { flat: '#C99A5B', water: '#A9773E', waterA: 120, lw: 1.3, hatch: { d: 9, a: .6, br: 'HB', c: '#8A5E2E', w: .6 } });
      shape(boxP(10, 510, 220, 300, 4), { flat: '#FFFDF4', lw: .8 });
      stroke_([[40, 545], [190, 545]], 1.2, '#444', 'pen', 0);
      for (let i = 0; i < 7; i++) stroke_([[40, 590 + i * 30], [200 - hash(i) * 60, 590 + i * 30]], .5, '#888', 'fine', 0);
      shape(boxP(260, 540, 180, 140, 4), { flat: '#F6D86B', lw: .7 }); shape(boxP(270, 700, 170, 130, 4), { flat: '#F4B2A2', lw: .7 });
      for (const [px, py] of [[120, 515], [350, 545], [355, 705]]) shape(ellP(px, py, 9, 9, 10), { flat: '#D9483B', line: false });
      // lockers
      for (let i = 0; i < 3; i++) {
        const x = 760 + i * 200;
        shape(boxP(x, 560, 196, FLOOR_Y - 560, 6), { flat: PAL.cool, water: mixC(PAL.cool, PAL.ink, .25), waterA: 70, lw: 1.2 });
        for (let k = 0; k < 5; k++) stroke_([[x + 50, 620 + k * 22], [x + 146, 620 + k * 22]], .6, mixC(PAL.cool, PAL.ink, .5), 'fine', 0);
        shape(boxP(x + 150, 980, 18, 70, 6), { flat: '#C7CDD1', lw: .7 });
      }
      shape(boxP(800, 760, 120, 150, 3), { flat: '#FFFFFF', lw: .6 });
      wallClock(560, 420, 78);
      floorPlane(PAL.floor, PAL.floor2, FLOOR_Y, 5, 6);
    },
    live(t, o) {
      const fl = .85 + .15 * (hash(Math.floor(t * 9)) > .93 ? 0 : 1);
      glow(540, 160, 520, 240, PAL.glow, 70 * fl);
      const a = t * .12; stroke_([[560, 420], [560 + Math.sin(a) * 50, 420 - Math.cos(a) * 50]], .9); stroke_([[560, 420], [560 + Math.sin(a / 12 + 2.6) * 34, 420 - Math.cos(a / 12 + 2.6) * 34]], 1.3);
    },
  },
  // diner at night: big windows on a dark street, pendant lamps, booths, neon, checkerboard floor
  diner: {
    plate(o) {
      wallWash(PAL.wall, PAL.wall2, 7, SETRECT[1], FLOOR_Y + 20);
      // window to the night street
      shape(boxP(40, 360, 1000, 720, 14), { flat: PAL.sky, water: '#2B3470', waterA: 140, lw: 1.6 });
      for (let i = 0; i < 6; i++) { const bx = 60 + i * 170 + hash(i) * 30, bh = 200 + hash(i * 3) * 260; shape(boxP(bx, 1080 - bh, 150, bh, 2), { flat: mixC(PAL.sky, '#000000', .35), line: false }); for (let k = 0; k < 8; k++) if (hash2(i, k) > .45) shape(boxP(bx + 20 + (k % 3) * 40, 1080 - bh + 30 + Math.floor(k / 3) * 60, 22, 30, 2), { flat: PAL.warm, flatA: 200, line: false }); }
      shape(ellP(860, 480, 46, 46, 18), { flat: '#FFF1C9', line: false }); plateGlow(860, 480, 150, '#FFF1C9', 50, 2);
      stroke_([[540, 360], [540, 1080]], 1.6); stroke_([[40, 720], [1040, 720]], 1.2);
      // neon
      plateGlow(300, 560, 230, PAL.accent, 90, 5);
      // booths + tables
      for (const bx of [-60, 600]) { shape(boxP(bx, 1040, 540, 330, 40), { flat: PAL.accent, water: mixC(PAL.accent, PAL.ink, .3), waterA: 90, lw: 1.4 }); for (let k = 1; k < 4; k++) stroke_([[bx + k * 135, 1060], [bx + k * 135, 1350]], .6, mixC(PAL.accent, PAL.ink, .45), 'fine', 0); }
      shape(boxP(-60, 1260, 1200, 60, 10), { flat: '#E9E1CF', lw: 1.3 });
      // pendant lamps
      for (const lx of [270, 810]) { stroke_([[lx, SETRECT[1]], [lx, 150]], .8); shape([[lx - 90, 230], [lx - 40, 150], [lx + 40, 150], [lx + 90, 230]], { flat: PAL.warm, lw: 1.2 }); plateGlow(lx, 360, 300, PAL.glow, 80, lx); }
      // checkerboard floor
      shape(boxP(SETRECT[0], FLOOR_Y, SETRECT[2], 800), { flat: '#E9E1CF', line: false });
      for (let r = 0; r < 7; r++) for (let c = -1; c < 9; c++) if ((r + c) % 2) { const y0 = FLOOR_Y + Math.pow(r / 7, 1.5) * 760, y1 = FLOOR_Y + Math.pow((r + 1) / 7, 1.5) * 760, sk = (y => (y - FLOOR_Y) * .35); shape([[c * 150 - sk(y0) * ((c * 150 - 540) / 540), y0], [(c + 1) * 150 - sk(y0) * (((c + 1) * 150 - 540) / 540), y0], [(c + 1) * 150 - sk(y1) * (((c + 1) * 150 - 540) / 540), y1], [c * 150 - sk(y1) * ((c * 150 - 540) / 540), y1]], { flat: PAL.wall2, flatA: 220, line: false }); }
      shape(blobP(540, FLOOR_Y + 300, 700, 200, 3, .2, 12), { water: PAL.warm, waterA: 50, bleed: .3, tex: .4, line: false, curve: .7 });
      stroke_([[SETRECT[0], FLOOR_Y], [SETRECT[0] + SETRECT[2], FLOOR_Y]], 1.4);
      if (o.clock !== false) wallClock(860, 220, 70);
    },
    live(t, o) {
      const fl = hash(Math.floor(t * 8)) > .9 ? .55 : 1;
      label('OPEN', 300, 560, 120, mixC(PAL.accent, '#ffffff', .35), { rot: -.05, alpha: fl, stroke: rgba(PAL.accent, .6), strokeW: .25 });
      glow(300, 560, 300, 160, PAL.accent, 60 * fl);
      for (const lx of [270, 810]) glow(lx, 420, 260, 300, PAL.glow, 55 + osc(t, .3, lx) * 6);
    },
  },
  // bedroom at 1 AM: navy walls, moonlit window, bed, nightstand with a glowing clock
  bedroom: {
    plate(o) {
      wallWash(PAL.wall, PAL.wall2, 11, SETRECT[1], 1160);
      shape(boxP(560, 330, 440, 560, 12), { flat: PAL.sky, water: '#26306A', waterA: 140, lw: 1.5 });
      shape(ellP(860, 450, 52, 52, 18), { flat: '#FFF6D8', line: false }); plateGlow(860, 450, 160, '#FFF6D8', 45, 9);
      for (let i = 0; i < 14; i++) shape(starP(590 + hash(i) * 380, 360 + hash(i * 7) * 480, 6 + hash(i * 3) * 6, .4, 4), { flat: '#FFF6D8', line: false });
      stroke_([[780, 330], [780, 890]], 1.2); stroke_([[560, 610], [1000, 610]], 1.2);
      for (const cx of [520, 1000]) shape([[cx - 50, 300], [cx + 50, 300], [cx + 40 + (cx > 600 ? 10 : -10), 940], [cx - 60, 950]], { flat: PAL.accent, water: mixC(PAL.accent, PAL.ink, .3), waterA: 90, lw: 1.1, curve: .3 });
      // posters
      shape(boxP(70, 380, 260, 340, 6), { flat: '#E8A27C', lw: 1.1 }); shape(ellP(200, 520, 80, 80, 14), { water: PAL.warm, waterA: 160, line: false }); shape([[90, 700], [200, 590], [310, 700]], { flat: '#4F6EA8', line: false });
      // bed
      shape(boxP(-120, 1000, 900, 300, 30), { flat: '#5A4A8C', lw: 1.4 });
      shape(boxP(-120, 1160, 1000, 420, 40), { flat: PAL.accent, water: mixC(PAL.accent, PAL.ink, .35), waterA: 110, lw: 1.4 });
      for (let i = 0; i < 4; i++) stroke_([[-60 + i * 220, 1200], [40 + i * 230, 1420]], .7, mixC(PAL.accent, PAL.ink, .5), 'pen', .4);
      // nightstand + clock
      shape(boxP(860, 1130, 260, 380, 10), { flat: '#4B3B6E', lw: 1.3 }); shape(boxP(900, 1040, 180, 90, 10), { flat: '#1A1630', lw: 1 });
      floorPlane(PAL.floor, PAL.floor2, 1560, 13, 0);
    },
    live(t, o) {
      label(o.clockText || '1:00', 990, 1086, 58, '#FF6B6B', { font: 'ui', weight: 700, alpha: .9 });
      glow(990, 1086, 130, 70, '#FF6B6B', 40);
      glow(540, 180, 900, 300, PAL.wall2, 20);
    },
  },
  // bus stop in the rain: shelter, bench, street lamp, wet road, puddles
  busstop: {
    plate(o) {
      shape(boxP(SETRECT[0], SETRECT[1], SETRECT[2], FLOOR_Y + 300), { flat: PAL.sky, line: false });
      for (let i = 0; i < 6; i++) shape(blobP(hash(i) * W, 300 + hash(i * 2) * 600, 300, 200, i + 3, .3, 12), { water: i % 2 ? PAL.wall2 : '#6B86A0', waterA: 70, bleed: .3, tex: .7, line: false, curve: .6 });
      for (let i = 0; i < 7; i++) { const bx = -100 + i * 190, bh = 280 + hash(i * 5) * 380; shape(boxP(bx, 1050 - bh, 170, bh, 0), { flat: mixC(PAL.sky, '#0d1620', .35), water: PAL.wall2, waterA: 50, line: false }); for (let k = 0; k < 9; k++) if (hash2(i + 7, k) > .5) shape(boxP(bx + 18 + (k % 3) * 50, 1050 - bh + 30 + Math.floor(k / 3) * 70, 26, 36, 2), { flat: PAL.warm, flatA: 170, line: false }); }
      // street lamp
      stroke_([[1010, 1480], [1010, 380], [930, 330]], 3.2, '#2A3540', 'pen', .3); shape(boxP(880, 320, 90, 40, 12), { flat: '#2A3540', lw: 1 });
      plateGlow(930, 520, 380, PAL.glow, 90, 3);
      // shelter
      shape(boxP(60, 600, 760, 760, 6), { flat: '#9FC3D6', flatA: 90, water: PAL.cool, waterA: 60, line: INK(), lw: 1.2 });
      shape(boxP(30, 540, 820, 70, 10), { flat: '#3D4F5E', lw: 1.4 });
      stroke_([[70, 610], [70, 1480]], 2.2, '#3D4F5E', 'pen', 0); stroke_([[810, 610], [810, 1480]], 2.2, '#3D4F5E', 'pen', 0);
      shape(boxP(520, 680, 250, 360, 6), { flat: '#F2E6CF', lw: 1 }); shape(boxP(540, 700, 210, 70, 4), { flat: PAL.accent, line: false });
      for (let k = 0; k < 6; k++) stroke_([[550, 800 + k * 36], [740 - hash(k) * 80, 800 + k * 36]], .5, '#777', 'fine', 0);
      shape(boxP(120, 1240, 520, 40, 10), { flat: '#7A5236', lw: 1.2 }); stroke_([[160, 1280], [160, 1380]], 1.4); stroke_([[600, 1280], [600, 1380]], 1.4);
      // bus sign
      stroke_([[900, 1480], [900, 900]], 2.2, '#3D4F5E', 'pen', 0); shape(ellP(900, 860, 64, 64, 18), { flat: PAL.accent, lw: 1.2 });
      // sidewalk + wet road
      shape(boxP(SETRECT[0], 1440, SETRECT[2], 140), { flat: '#5E6E7C', lw: 1 });
      shape(boxP(SETRECT[0], 1580, SETRECT[2], 700), { flat: PAL.floor, line: false });
      for (let i = 0; i < 9; i++) shape(boxP(hash(i) * 1100 - 40, 1600, 30 + hash(i * 3) * 50, 300 + hash(i * 5) * 200, 10), { water: i % 3 ? PAL.warm : PAL.cool, waterA: 60, bleed: .35, tex: .5, line: false });
      for (let i = 0; i < 3; i++) shape(ellP(180 + i * 330, 1700 + hash(i) * 120, 130, 26, 18), { flat: '#7D9CB5', flatA: 140, line: false });
    },
    live(t, o) {
      const n = o.rain ?? 90, a = clamp(o.rainA ?? 1);
      if (a > 0) { CTX.save(); applyMat(CTX); CTX.globalAlpha = .55 * a; CTX.strokeStyle = '#D6E6F2'; CTX.lineWidth = 2.4; CTX.beginPath();
        for (let i = 0; i < n; i++) { const x = hash(i) * 1400 - 160, sp = 1700 + hash(i * 3) * 600, y = ((hash(i * 7) * 2600 + t * sp) % 2600) - 300; CTX.moveTo(x, y); CTX.lineTo(x - 14, y + 46); }
        CTX.stroke(); CTX.restore();
        for (let i = 0; i < 6; i++) { const k = fract(t * 1.3 + hash(i)), px = 120 + hash(i * 5) * 900, py = 1650 + hash(i * 9) * 200; stroke_(arcP(px, py, 10 + k * 50, (10 + k * 50) * .25, 0, TAU, 12), .5 * (1 - k), '#C9DCEB', 'fine', .5); }
      }
      glow(930, 560, 360, 520, PAL.glow, 45 * (o.lampA ?? 1));
      if (o.sun) glow(900, 200, 900, 700, '#FFE9A8', 120 * o.sun);
    },
  },
  // restaurant kitchen line: tiled wall, steel pass under heat lamps, tickets, hanging pans
  kitchen: {
    plate(o) {
      wallWash('#F3EAD8', '#E2D6BE', 17, SETRECT[1], 1100);
      for (let y = 0; y < 14; y++) stroke_([[SETRECT[0], -200 + y * 95], [SETRECT[0] + SETRECT[2], -200 + y * 95]], .4, '#C8BBA2', 'fine', 0);
      for (let x = 0; x < 16; x++) stroke_([[-160 + x * 95, -280], [-160 + x * 95, 1100]], .4, '#C8BBA2', 'fine', 0);
      // hanging pans
      stroke_([[SETRECT[0], 180], [SETRECT[0] + SETRECT[2], 180]], 2.2, '#6E6E78', 'pen', 0);
      for (let i = 0; i < 5; i++) { const px = 60 + i * 230; stroke_([[px, 180], [px, 250]], .8); shape(ellP(px, 330, 80, 80, 18), { flat: i % 2 ? '#B8BCC6' : '#C76D45', water: '#7E838F', waterA: 60, lw: 1.2 }); shape(boxP(px - 12, 400, 24, 120, 8), { flat: '#3A3A44', lw: .8 }); }
      // heat lamps
      for (const lx of [240, 540, 840]) { shape([[lx - 110, 600], [lx - 60, 540], [lx + 60, 540], [lx + 110, 600]], { flat: '#9DA2AE', lw: 1.2 }); plateGlow(lx, 760, 230, '#FF9A4A', 90, lx); }
      stroke_([[SETRECT[0], 520], [SETRECT[0] + SETRECT[2], 520]], 1.6, '#555', 'pen', 0);
      // ticket rail
      shape(boxP(SETRECT[0], 640, SETRECT[2], 26, 6), { flat: '#B8BCC6', lw: 1 });
      for (let i = 0; i < 6; i++) { const tx = 40 + i * 175; shape(boxP(tx, 650, 120, 170 + hash(i) * 40, 3), { flat: '#FFFDF4', lw: .8 }); for (let k = 0; k < 5; k++) stroke_([[tx + 14, 690 + k * 24], [tx + 100 - hash(i + k) * 40, 690 + k * 24]], .45, '#777', 'fine', 0); }
      // the pass
      shape(boxP(SETRECT[0], 1000, SETRECT[2], 80, 6), { flat: '#C9CDD6', water: '#8E95A3', waterA: 70, lw: 1.3 });
      for (const px of [180, 520, 860]) { shape(ellP(px, 990, 120, 28, 18), { flat: '#FFFDF6', lw: 1 }); shape(blobP(px, 975, 60, 22, px, .3, 10), { flat: px === 520 ? '#E2873A' : '#7BAA5B', line: false }); }
      shape(boxP(SETRECT[0], 1080, SETRECT[2], 420, 0), { flat: '#9AA1AE', water: '#6E7584', waterA: 70, line: false });
      floorPlane('#8B6F5E', '#6E5446', FLOOR_Y, 19, 5);
    },
    live(t, o) {
      for (const lx of [240, 540, 840]) glow(lx, 740, 200, 230, '#FF9A4A', 45 + osc(t, .8, lx) * 8);
      for (let i = 0; i < 5; i++) { const k = fract(t * .35 + i / 5), sx = 180 + (i % 3) * 340 + Math.sin(t + i) * 30; shape(blobP(sx + Math.sin(k * 6 + i) * 30, 960 - k * 360, 40 + k * 70, 30 + k * 50, i + 1, .25, 10), { flat: '#FFFFFF', flatA: 70 * (1 - k) * Math.min(1, k * 4), line: false, tex: 0, curve: .6 }); }
    },
  },
  // retail shop floor: shelves of folded shirts, a rack, the register counter
  shop: {
    plate(o) {
      wallWash(PAL.wall, PAL.wall2, 23, SETRECT[1], FLOOR_Y + 20);
      for (let r = 0; r < 3; r++) {
        const y = 420 + r * 240; shape(boxP(-60, y, 700, 24, 4), { flat: '#C69C6D', lw: 1.1 });
        for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) shape(boxP(-30 + i * 165, y - 32 - k * 34, 140, 32, 8), { flat: ['#6FA8DC', '#E06666', '#93C47D', '#F6B26B', '#8E7CC3'][(i + k + r) % 5], lw: .8 });
      }
      stroke_([[700, 520], [1150, 520]], 2.2, '#6E6E78', 'pen', 0);
      for (let i = 0; i < 5; i++) { const hx = 740 + i * 90; stroke_([[hx, 520], [hx, 560]], .6); shape([[hx - 50, 570], [hx + 50, 570], [hx + 60, 820], [hx - 60, 820]], { flat: ['#F4C7A1', '#9BD0C6', '#F6E28B', '#C9A8E8', '#F29E9E'][i], lw: 1, curve: .2 }); }
      shape(boxP(600, 1080, 600, 420, 14), { flat: '#C69C6D', water: '#9C7148', waterA: 80, lw: 1.4 });
      shape(boxP(760, 960, 260, 130, 12), { flat: '#4A4A58', lw: 1.2 }); shape(boxP(790, 980, 200, 60, 6), { flat: '#9FE3C0', line: false });
      shape(boxP(120, 160, 360, 140, 16), { flat: PAL.accent, lw: 1.3 });
      floorPlane(PAL.floor, PAL.floor2, FLOOR_Y, 29, 4);
    },
    live(t, o) { label('SALE', 300, 230, 84, '#FFF8EC', { font: 'anton', track: 6, rot: -.03 }); glow(540, 200, 700, 260, PAL.glow, 40); },
  },
  // café with a chalkboard menu wall (for the first-job tips)
  chalkcafe: {
    plate(o) {
      wallWash(PAL.wall, PAL.wall2, 31, SETRECT[1], FLOOR_Y + 20);
      for (let y = 0; y < 26; y++) for (let x = 0; x < 9; x++) if (hash2(x, y) > .55) shape(boxP(-160 + x * 170 + (y % 2) * 85, -280 + y * 70, 160, 62, 4), { flat: mixC(PAL.wall, PAL.wall2, hash2(y, x)), flatA: 160, line: false });
      shape(boxP(40, 300, 1000, 900, 18), { flat: '#C69C6D', lw: 1.5 });
      shape(boxP(70, 330, 940, 840, 10), { flat: PAL.sky, water: '#24392F', waterA: 140, line: false });
      for (let i = 0; i < 6; i++) shape(blobP(200 + hash(i) * 700, 500 + hash(i * 3) * 500, 200, 120, i, .3, 12), { water: '#C8D6CF', waterA: 22, bleed: .3, tex: .8, line: false });
      stroke_(arcP(860, 470, 60, 40, 0, Math.PI, 8), 1, '#EDEDE4', 'chalky', .5); stroke_([[800, 470], [920, 470]], 1, '#EDEDE4', 'chalky', 0); stroke_(arcP(930, 500, 24, 24, -1.2, 1.2, 6), .8, '#EDEDE4', 'chalky', .5);
      for (const [x, y, s] of [[150, 1080, 1], [880, 1100, .8]]) { stroke_(starP(x, y, 30 * s, .45, 5).concat([starP(x, y, 30 * s, .45, 5)[0]]), .7, '#F6D86B', 'chalky', 0); }
      // counter + espresso machine
      shape(boxP(SETRECT[0], 1250, SETRECT[2], 260, 8), { flat: '#7B4A35', water: '#5F3828', waterA: 80, lw: 1.5 });
      shape(boxP(SETRECT[0], 1230, SETRECT[2], 34, 8), { flat: '#E9D8B8', lw: 1.2 });
      shape(boxP(780, 1060, 240, 175, 18), { flat: '#B8BCC6', water: '#7E838F', waterA: 60, lw: 1.3 }); shape(boxP(830, 1140, 40, 50, 6), { flat: '#3A3A44', lw: .8 }); shape(boxP(930, 1140, 40, 50, 6), { flat: '#3A3A44', lw: .8 });
      for (let i = 0; i < 4; i++) shape(boxP(80 + i * 110, 1180, 80, 54, 12), { flat: ['#F4F0E6', PAL.warm, PAL.cool, '#F4F0E6'][i], lw: 1 });
      floorPlane(PAL.floor, PAL.floor2, FLOOR_Y, 37, 0);
    },
    live(t, o) {
      label(o.board || 'SPECIALS', 420, 420, 88, '#F4F2EA', { rot: -.03, alpha: .92 });
      stroke_([[180, 485], [660, 478]], .9, '#F4F2EA', 'pen', .3);
      glow(540, 200, 700, 300, PAL.glow, 45);
    },
  },
  // abstract painted studio: sunburst rays and blooms (end cards, title cards, number cards)
  studio: {
    plate(o) {
      const a = o.a || PAL.wall, b = o.b || PAL.wall2;
      shape(boxP(SETRECT[0], SETRECT[1], SETRECT[2], SETRECT[3]), { flat: a, line: false });
      const cx = o.cx ?? 540, cy = o.cy ?? 820;
      for (let i = 0; i < 18; i += 2) { const a0 = i / 18 * TAU + .1, a1 = (i + 1) / 18 * TAU + .1; shape([[cx, cy], [cx + Math.cos(a0) * 2600, cy + Math.sin(a0) * 2600], [cx + Math.cos(a1) * 2600, cy + Math.sin(a1) * 2600]], { water: b, waterA: 110, bleed: .15, tex: .6, edge: .5, line: false }); }
      for (let i = 0; i < 7; i++) shape(blobP(hash(i * 5) * W, hash(i * 9) * H, 240 + hash(i) * 200, 200 + hash(i * 2) * 200, i + 40, .3, 14), { water: i % 2 ? (o.c || LIME) : mixC(a, '#ffffff', .3), waterA: 40, bleed: .3, tex: .7, line: false, curve: .6 });
      plateGlow(cx, cy, 520, o.c || LIME, 60, 6);
    },
    live() {},
  },
  // plain painted wash (for card close-ups)
  wash: {
    plate(o) {
      const a = o.a || PAL.wall, b = o.b || PAL.wall2;
      shape(boxP(SETRECT[0], SETRECT[1], SETRECT[2], SETRECT[3]), { flat: a, line: false });
      for (let i = 0; i < 9; i++) shape(blobP(hash(i * 3 + (o.seed || 0)) * W, hash(i * 7 + (o.seed || 0)) * H, 300 + hash(i) * 250, 260 + hash(i * 2) * 240, i + 60 + (o.seed || 0), .3, 14), { water: i % 3 ? b : (o.c || PAL.accent), waterA: i % 3 ? 90 : 45, bleed: .3, tex: .7, edge: .6, line: false, curve: .6 });
    },
    live() {},
  },
};
function setting(name, t, o = {}) {
  const S = SETTINGS[name]; if (!S) throw new Error('unknown setting: ' + name);
  const pal = Object.keys(PALETTES).find(k => PALETTES[k] === PAL) || 'custom';
  plate(`set:${name}:${pal}:${JSON.stringify(o.plate || {})}`, SETRECT, () => S.plate(o.plate || {}));
  S.live(t, o);
}

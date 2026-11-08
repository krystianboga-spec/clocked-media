const SCENES = {
  test({ t, lt }) {
    shape(boxP(-20, -20, W + 40, H + 40), { flat: PAL.wall, line: false });
    shape(blobP(540, 700, 500, 300, 2), { water: PAL.cool, waterA: 120, line: false, curve: .7 });
    shape(blobP(300, 1300, 300, 200, 5), { water: PAL.warm, waterA: 120, line: false, curve: .7 });
    shape(boxP(-20, 1450, W + 40, 600), { flat: PAL.floor, line: false });
    clocky(540, 1450, 260, { t, eyes: 'open', talk: Math.abs(Math.sin(t * 8)), aL: .6, aR: -.6 });
    clocky(200, 1650, 90, { t, eyes: 'happy', mouth: 'grin' });
    label('Hello, painted world', 540, 400, 72, PAL.card, {});
  },
};

# Clocked painted engine

A reusable, spec-driven animation engine for Clocked's short vertical videos, in a hand-painted watercolour-and-ink style. A video is one JSON file (a spec). The renderer paints every frame in headless Chromium with p5.js + p5.brush and Canvas 2D, then encodes an MP4 with ffmpeg. Voice is an optional extra step: every video works silent, because the captions carry the story.

- Output: 1080x1920, 30 fps, H.264 (yuv420p, CRF 18) + AAC. One master file serves both TikTok and Instagram.
- Safe zone: captions and faces stay inside 180 px from the top, 400 from the bottom, 90 from the left, 150 from the right.
- Every video ends on the standard end card: Clocky, the CLOCKED wordmark (Anton), the pill "Free beta · Out now", `clocked.space`, "Try it free in your browser.", and "Example figures, before taxes." when the spec sets `"showsPay": true`.
- Licences: `vendor/p5.min.js` is p5.js 2.3.4 (LGPL-2.1, unmodified, licence in `vendor/LICENSE-p5.txt`); `vendor/p5.brush.js` is p5.brush 2.2.3 (MIT). Fonts in `fonts/` are Anton and Shantell Sans ExtraBold (both SIL OFL 1.1). UI text uses the system Inter if installed, else Helvetica/Arial.

## Requirements

- Node 18+ and the Playwright package with its Chromium (preinstalled here; `require('playwright')` must resolve. If it does not, run with `NODE_PATH=$(npm root -g)`). Nothing to `npm install` for the engine itself.
- ffmpeg and ffprobe on PATH.
- Optional, for voice: a Python 3.10+ env and the two Kokoro model files (see Voice below). If they are missing, make silent videos.

## Commands

Run from the repo root. `<spec>` is any spec path, for example `engine/specs/ot-puzzle.json` or `media/2026-12/specs/<id>.json`.

```bash
# 1. contact sheet: every shot (early + late frame) and a frame inside every cut. Look at it before rendering.
node engine/render.cjs <spec> --sheet=auto --out=media/YYYY-MM/painted/<id>-sheet.jpg
#    or chosen times (seconds), columns and thumbnail width:
node engine/render.cjs <spec> --sheet=1.0,2.5,7.2 --cols=3 --w=360 --out=check.jpg

# 2. full-size stills (1080x1920 JPEG) at chosen times: check text, safe zone and the end card at full size
node engine/render.cjs <spec> --stills=2.0,7.5,19.0 --out=check-stills/

# 3. silent master
node engine/render.cjs <spec> --video --out=media/YYYY-MM/painted/<id>.mp4

# 4. optional voice: check the captions, make the voice track (retiming the spec so no word is cut), render voiced
<tts-python> engine/voice.py <spec> --check
<tts-python> engine/voice.py <spec> --models <dir with kokoro-v1.0.onnx and voices-v1.0.bin> --retime
node engine/render.cjs <spec> --video --voice --crf=25 --preset=veryfast --out=media/YYYY-MM/painted/<id>-voiced.mp4

# 5. verify
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate -show_entries format=duration -of compact <file>.mp4
```

See Voice below for what `voice.py` does and how to install it. A fresh session usually cannot download the model files: then skip step 4 and post silent videos.

Options: `--workers=N` pages painting in parallel (default 2; on a 2-core machine 2 is right), `--fresh` ignores the segment cache, `--crf=N` and `--preset=name` set the x264 encode (default 18 / medium; 25 / veryfast gives files about a third the size).

Speed (2 CPU cores, SwiftShader WebGL, 2 workers): about 120 to 130 ms per frame effective once the backgrounds are cached, about 270 to 370 ms per frame on a first render that also paints the backgrounds (each painted plate takes 10 to 40 s once). A 20 s video renders in about 1.5 to 4 minutes. Plates are cached in `engine/cache/plates/` and finished shots in `engine/cache/seg/` (both git-ignored): re-rendering after a change repaints only the shots whose spec (or neighbours) changed, and the voiced render reuses every silent shot in which nobody speaks.

## How it works

- **Plates** (`src/settings.js`): rooms and backdrops are painted once with real p5.brush watercolour fills, washes, hatching and brush strokes in WebGL, then cached as images. Software WebGL is slow per pixel, so this is where p5.brush does the heavy painting.
- **Live layer** (`src/chars.js`, `src/props.js`, `src/scenes.js`): characters, props, cards and lettering are redrawn every frame in Canvas 2D with a hand-made ink ribbon (tapered, wobbling width), flat pigment with a p5.brush-painted pigment texture multiplied in, wet-edge darkening and crescent shading.
- **Boil**: every frame is a pure function of time. `jit()` jitter is reseeded 12 times a second, so outlines shimmer like hand-drawn animation; stable randomness uses `hash()`. Never use `Math.random()`.
- **Frame**: paper, then the shot's scene template (plate under the camera, cast, props, fx), then the transition composite, then captions, then paper grain and vignette multiplied over everything.
- **Mouths**: with `--voice`, mouths follow the per-frame loudness envelope of each speaker's final processed audio. Silent renders flap the speaker's mouth while their caption line is up.

Files: `studio.html` (the page), `src/core.js` (math, transforms, both painting backends, lettering), `src/palettes.js`, `src/chars.js`, `src/props.js`, `src/settings.js`, `src/scenes.js`, `src/transitions.js`, `src/overlay.js` (captions), `src/main.js` (spec timeline, layers, plate cache), `render.cjs`, `voice.py`, `specs/` (the November 2026 videos, good examples to copy).

## Spec format

```json
{
  "id": "ot-puzzle",                    // file and cache name; unique per video
  "title": "Is this paycheck right?",   // for people; not rendered
  "concept": "one line",                // for people; not rendered
  "palette": "breakRoom",               // see Palettes
  "setting": "breakroom",               // default setting for shots that don't name one
  "duration": 22.4,                     // seconds (14 to 24 recommended; the end card runs to the end)
  "fps": 30, "seed": 11,                // seed changes the boil and texture variation
  "showsPay": true,                     // true when any pay figure is on screen: adds "Example figures, before taxes" to cards and the end card
  "transition": "brush",                // default transition between shots
  "math": ["40 x 16.50 = 660.00"],      // for review only: write every calculation here and check it in Python
  "shots": [ { shot }, ... ],
  "endCard": { "start": 17.4, "caption": "...", "speaker": "CLOCKY" }
}
```

JSON does not allow comments; they are only here to explain.

A **shot**:

| key | meaning |
|---|---|
| `start` | seconds; a shot lasts until the next shot's start (the last one until the end card) |
| `scene` | template name (see Scene templates) |
| `params` | the template's parameters |
| `caption` + `speaker` | caption text and who says it (`SAM`, `CLOCKY`, `NOTES`, `MANAGER`, `STUB`, or none). With a speaker, the caption is spoken word for word in the voiced cut. Wrap words in `*asterisks*` for a lime highlighter mark (the voice stresses them) |
| `captions` | instead of `caption`: `[{ "at": 0, "text": "...", "speaker": "CLOCKY" }, { "at": 1.6, ... }]` for lines that change inside a shot |
| `out` | transition into the next shot: a name or `{ "type": "iris", "x": 540, "y": 760, "half": 0.3, "colors": ["#hex"], "dir": 1 }` |
| `palette` | optional per-shot palette override |

Captions: Shantell Sans ExtraBold, 64 px (shrinks to fit 3 lines, never below 54), on a painted paper strip in the upper safe zone (top at y 205), with a coloured speaker tag. Keep each caption to about 2 lines and leave each shot at least 2 s per caption line.

### Scene templates (`src/scenes.js`)

Shared shapes inside `params`:

- `cast`: list of `{ "who": "sam|clocky|notes|stub|manager", "x", "y" (ground point, world px), "size", "pose": {...}, "act": "...", "beats": [[t, { pose... }], ...], "enter": { "type": "pop|slide|drop|rise|peek", "at", "dur", "from": "left|right", "dist" }, "exit": { "type": "pop|slide|jump", "at", "dur", "to" }, "path": [[t, x, y], ...], "layer": "back|mid|front", "juggle": [{ "kind": "apron|phone|coin|card", "col", "tag" }] }`. A beat change does a squash "take" and pops its emote.
- `cam`: keyframes `[[t, cx, cy, zoom, roll], ...]` (shot time; the world point cx, cy lands at frame centre), `camEase`: `smooth|out|in|linear|snap|back`, `shake`: `[[t, px], ...]`, `drift`: handheld amount (0 = locked off).
- `props`: `[{ "kind": "phone|coin|coins|calendar|timeclock|apron|icon|card|stub|mug|paper", "x", "y", "size", "at", "layer", ... }]`. A phone takes `"screen": "clocked|lock|notes|blank"` and `"data"` (clocked: `title, big, sub, rows: [[left, right]], rowsAt, rowsDur`; lock: `time, date, notif`; notes: `lines`).
- `fx`: `[{ "type": "sfx|stamp|coins|lines|spark|label", "at", ... }]` (sfx: `text, x, y, size, col, rot`; stamp: `text, x, y, size, col`; coins: `n, x0, x1, y0, floor`; lines: speed lines `x, y, r0, r1, n`; spark: `x, y, r`).
- `set`: options for the setting, for example `{ "plate": { "clock": false } }`, `{ "rainA": 0.3, "sun": 1 }`, `{ "board": "TIP 1" }`.
- `table`: `{ "y": 1395, "col": "#hex" }` draws a foreground table edge (it hides legs and holds props with `"layer": "front"`).

| template | what it does | its own params |
|---|---|---|
| `stage` | a setting, a cast, props and fx under a moving camera (establishing shots, reactions, hero shots) | `setting`, `set`, `cast`, `props`, `fx`, `screenFx`, `table`, camera keys |
| `dialogue` | two characters; the camera leans toward whoever speaks | `left`, `right` (cast entries), `base: [cx, cy, zoom]`, `whip: true`, `roll`, plus `cast`, `table` |
| `card` | a painted card slides in, rows type on, numbers count up, a total lands with a lime swash, optional stamp | `card: { x, y, w, title, band, titleCol, rot, rowH, rows: [{ l, r, at, count, hl, col, strike, size }], total: { l, r, at, count }, after: [rows below the total], example }`, `host` (one cast entry), `stamp: { text, at, x, y, col, size }`, `dim` (0..1 darkens the setting), `dimCol`, `setting` |
| `list` | one tip per shot: numbered badge, an illustrated icon, earlier tips as small notes | `n`, `total`, `icon: screenshot|clockcard|stub|calendar|ask|jar|coins`, `done: [short labels]`, `accent`, `badgeX/Y`, `iconX/Y/Size`, `setting`, `cast` |
| `split` | before/after: two stacked panels; AFTER wipes in | `before: { label, setting, set, cam: [cx, cy, zoom], cast, props }`, `after: {...}`, `afterAt` |
| `countdown` | a flip card number over a week calendar strip | `n`, `from`, `unit`, `cal: { days, dates, hi, prev, pay }`, `calY`, `setting`, `cast` |
| `notify` | a hand-held phone buzzes and a notification banner drops | `phone: { x, y, h, rot }`, `notif: { at, app, when, h, lines: [...] }`, `time`, `date`, `setting`, `cast` |
| `montage` | comic panels that pop in, each a small stage | `panels: [{ at, rect: [x, y, w, h], rot, setting, set, cam: [cx, cy, zoom], cast, props, fx, label, labelCol }]` |
| `title` | big hand-lettered title lines that pop in | `lines: [{ text, at, size, col, rot, swash }]`, `y0`, `gap`, `setting`, `cast`, `props` |
| `endcard` | added automatically from `endCard`; do not list it in `shots`. Its text sits between y 950 and 1395, centred on the safe zone | `caption`, `speaker`, `eyes` |

### Characters (`src/chars.js`)

| who | size means | look | useful pose keys |
|---|---|---|---|
| `clocky` | body radius (90 to 200) | round stopwatch mascot, lime #C8F25A rim, dark face, clock hands, big eyes, little arms | `eyes: open|happy|wide|closed|wink|star|tired|squint|look`, `mouth: smile|grin|open|O|flat|frown|wobble`, `spin` (hands whirl), `glow`, `flip`, `aL/aR` |
| `sam` | unit, ~10 per height (56 to 100) | tired server in his 20s, bib apron, order pad | `eyes: tired|open|wide|closed|happy|squint|side|dead`, `brows`, `mouth: flat|smile|frown|o|grin|wavy|sigh`, `apronCol`, `apron2` (lanyard), `phoneGlow`, `headTilt`, `lean`, `tgtL/tgtR` |
| `notes` | pad height (300 to 560) | yellow notes pad, cheerful and useless | `lines` (scribbles on the page), `eyes`, `mouth`, `pencil` |
| `stub` | envelope width (200 to 260) | the paycheck envelope; a cheque slip peeks out | `amount`, `slip`, `flap`, `eyes`, `mouth` |
| `manager` | unit like Sam (90 to 110) | faceless looming silhouette with a rim light | `clip` (clipboard), `point` ("one more thing"), `lean`, `rim` |

Shared pose keys: `dy`, `sq` (squash), `rot`, `flip`, `aL`, `aR` (arm angles: 0 out, + up, - down), `emote: sweat|spark|heart|anger|zzz|music|swirl|!|?|!?`, `lookX/lookY`.

`act` presets: `idle, talk, bounce, hop, point, pointL, shrug, cheer, sigh, wave, think, phone (with screen + screenData), wipe, juggle, write, float`.

### Settings, palettes, transitions

- Settings: `breakroom`, `diner` (`plate.clock`), `bedroom` (`clockText`), `busstop` (`rainA`, `sun`, `lampA`), `kitchen`, `shop`, `chalkcafe` (`board`), `studio` (`plate: { a, b, c, cx, cy }` sunburst), `wash` (`plate: { a, b, c, seed }`).
- Palettes (`src/palettes.js`): `breakRoom`, `nightDiner`, `midnight`, `rainyBus`, `sunnyJuggle`, `chalkCafe`, `studio`. Each is harmonious on its own with Clocked lime as the accent. Character colours are fixed so the cast stays on model.
- Transitions: painted covers `brush` (dry-brush strokes sweep across), `bloom` (watercolour blooms), `drip` (paint pours down), `splat` (a splat, then a hole opens); two-layer `whip` (`dir`), `tear`, `flip`, `iris` (`x`, `y`), `zoom` (`x`, `y`); `cut`.

## Voice

Rule: **the caption is the speech.** Every caption (or `captions` entry) that has a `speaker` is spoken word for word, and nothing is spoken that is not a caption. There is no separate script field: `voice.py --check` fails if a shot has `say` or `voiceSpeaker`, or if a caption does not read cleanly aloud. Write captions the way a person would say them: `$759` (no `.00`; keep cents only when they are not zero, `$16.50`), `16.5 hours`, `1.5×`, `4 to 9`, `9:30`. The voice reads them as "seven hundred fifty-nine dollars", "sixteen fifty", "sixteen and a half hours", "one and a half times", "four to nine", "nine thirty". Cards can still show full math with cents.

What `voice.py` does:
1. Splits each line into phrases at `. ? ! :` and `...` and synthesizes each with Kokoro (CPU, ONNX). Speed varies per phrase between 0.95 and 1.03 and is never above 1.05.
2. Voices: Sam = am_michael 60% + am_fenrir 40% (style-vector blend), Clocky = af_heart, Notes = af_bella (+1.5 semitones), Manager = am_fenrir + am_onyx (-2.5 semitones). The blend weight wobbles a little per phrase.
3. Shapes pitch with Praat PSOLA (praat-parselmouth): widens the contour around the speaker's mean toward a target spread (about 3.4 to 3.8 semitones std, capped at 1.5x), adds a fall at the end of statements, a rise on questions, a stress bump on the `*emphasised*` word or the dollar amount, and slow drift.
4. Joins phrases with real pauses (0.2 to 0.42 s) and 8 ms fades, so joins do not click.
5. Per speaker: high-pass 80 Hz, a small low-mid cut, a presence lift, de-ess, light compression and a short subtle room. The mix is normalised to -16 LUFS with true peak under -1.5 dB.
6. `--retime` rewrites the spec so nothing is cut or overlapped: each caption stays on screen until its line ends plus 0.25 s. A caption that has to start later shifts that shot's later timed keys (rows, totals, stamps, fx, camera, beats); a shot that has to grow shifts every later shot and the end card. Run it once per spec after editing captions; it only ever lengthens.
7. Writes `engine/cache/voice/<id>.wav` and `<id>.json` (the timing report, per-phrase F0 before/after, and per-frame mouth envelopes).

Install in a fresh session (the model files are in this repo, nothing to download):
```bash
bash engine/setup-voice.sh            # joins engine/models/kokoro-v1.0.onnx.part*, checks SHA256SUMS, makes engine/.ttsenv
export CLOCKED_TTS_MODELS=engine/models
engine/.ttsenv/bin/python engine/voice.py engine/specs/<id>.json --retime
node engine/render.cjs engine/specs/<id>.json --video --voice --out=media/YYYY-MM/painted/<id>-voiced.mp4
```
Kokoro-82M v1.0 (Apache 2.0) is stored in engine/models/ as 90 MB parts plus voices-v1.0.bin; packages come from PyPI (engine/requirements-voice.txt). If setup fails, make silent videos.

## Rules the engine does not check for you

- Follow `ops/rules.md`: real features only, no em or en dashes anywhere (captions, titles, cards), overtime phrased as "most hourly jobs pay 1.5x after 40 hours", no tips/taxes/net-pay claims.
- Every pay figure is an example and must add up: put each calculation in `math` and verify it in Python. Card count-ups pass through intermediate values for under a second; the settled values are what must add up.
- Look at the auto contact sheet and at full-size stills of the busiest frame of each shot and of the end card before rendering, and at the finished video after.

## Making a new video

1. Copy the closest spec in `engine/specs/` (monthly runs keep theirs in `media/YYYY-MM/specs/`), give it a new `id`, change palette, setting, transitions, camera and pacing so it does not look like last month's.
2. Write the shots and captions; verify the math.
3. `--sheet=auto`, fix what looks off, `--stills` of the key frames, then `--video` (and voice if available).
4. ffprobe: 1080x1920, 30 fps, duration as specified.

Photo sets: `--stills` gives 1080x1920 frames of any spec time (for example the end card or a card shot) that can serve as TikTok photo-mode slides. The engine has no 1080x1350 output; make Instagram carousel slides another way (see ops/RUNBOOK.md Step 5).

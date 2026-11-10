#!/usr/bin/env python3
"""sound.py: music bed + sound effects + final mix for a spec. Everything is synthesized here (numpy); no samples.

    <python> engine/sound.py <spec.json> [--voice]          (python with numpy, scipy, soundfile, pyloudnorm)

Music: spec "music": { "mood": detective | nightdiner | lofi | upbeat | bouncy | chaoscalm, "bpm": 96,
                       "calmShot": 5 (chaoscalm only: the shot where it turns calm), "gain": 0 (dB trim) }
SFX:   automatic from the spec (a whoosh family sound on every transition by type, coins, stamps, comic sfx words,
       sparks, count-up ticks and a register "ka-ching" on totals, page flips on countdowns, a phone buzz + ding on
       notifications, pops and thuds on character entrances, a riser into the end card), plus manual events:
       spec "sfx": [{ "t": 3.2, "kind": "ding", "gain": 0 }]. Kinds: whoosh whip tear flip splat bloom drip coin coins
       thud stamp ding buzz tick kaching riser pop boing sparkle thump.
Mix:   voice (engine/cache/voice/<id>.wav, from voice.py, when --voice) at dialog level, music around -21 LUFS ducked
       ~12 dB under the voice, SFX on top; the whole mix is normalised to -14 LUFS with true peak at or below -2.6 dB before AAC (so the encoded file stays under -1 dB).
Writes engine/cache/audio/<id>.wav (48 kHz mono). render.cjs --sound puts it on the video.
"""
import sys, os, json, math, argparse
import numpy as np, soundfile as sf

SR = 48000
TRANS_HALF = {'brush': .27, 'bloom': .3, 'drip': .32, 'splat': .22, 'whip': .2, 'tear': .3, 'flip': .26, 'iris': .3, 'zoom': .24, 'cut': 0}
rng = np.random.default_rng(7)

# ================================================================= small DSP kit
def t_(d): return np.arange(int(d * SR)) / SR
def env(n, a=.005, r=.2, curve=1.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4)) ** curve
    return e.astype(np.float32)
def adsr(n, a, d, s, rel):
    t = np.arange(n) / SR; dur = n / SR
    e = np.where(t < a, t / a, np.where(t < a + d, 1 - (1 - s) * (t - a) / d, s))
    e = e * np.clip((dur - t) / rel, 0, 1); return e.astype(np.float32)
def lowpass(x, fc, order=2):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low', output='sos'), x).astype(np.float32)
def highpass(x, fc, order=2):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(order, fc / (SR / 2), 'high', output='sos'), x).astype(np.float32)
def bandpass(x, lo, hi, order=2):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(order, [lo / (SR / 2), min(hi, SR / 2 - 200) / (SR / 2)], 'band', output='sos'), x).astype(np.float32)
def noise(d, seed=None): return (np.random.default_rng(seed).standard_normal(int(d * SR))).astype(np.float32)
def sweep_noise(d, f0, f1, width=1.0, seed=None):
    """Band-passed noise whose centre sweeps f0 -> f1 (chunked FFT filter with overlap-add)."""
    x = noise(d + .05, seed); n = 2048; hop = 512; out = np.zeros(len(x) + n, np.float32); win = np.hanning(n).astype(np.float32)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    for i in range(0, len(x) - n, hop):
        k = i / max(1, len(x) - n); fc = f0 * (f1 / f0) ** k
        m = np.exp(-0.5 * (np.log2(np.maximum(freqs, 1) / fc) / (0.5 * width)) ** 2)
        out[i:i + n] += np.fft.irfft(np.fft.rfft(x[i:i + n] * win) * m).astype(np.float32) * win
    return out[:int(d * SR)] / 1.5
def norm(x, peak=1.0): m = float(np.max(np.abs(x))) or 1.0; return (x / m * peak).astype(np.float32)
def place(buf, x, t, gain_db=0.0):
    i = int(round(t * SR)); g = 10 ** (gain_db / 20)
    if i < 0: x = x[-i:]; i = 0
    m = min(len(x), len(buf) - i)
    if m > 0: buf[i:i + m] += x[:m] * g
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'm9': [0, 3, 7, 10, 14], 'maj9': [0, 4, 7, 11, 14], 'sus2': [0, 2, 7], 'add9': [0, 4, 7, 14]}
def chord(name, octave=4):
    r = name[:2] if len(name) > 1 and name[1] in '#b' else name[:1]; q = name[len(r):]
    root = 12 * (octave + 1) + NOTE[r]; return root, [root + i for i in QUAL[q]]

# ================================================================= instruments
def epiano(f, d, vel=1.0):
    t = t_(d); mod = np.sin(2 * np.pi * f * t) * 1.6 * np.exp(-t * 5)
    x = np.sin(2 * np.pi * f * t + mod) + .25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6)
    return (x * env(len(t), .004, .9) * vel * (1 + .25 * np.sin(2 * np.pi * 4.5 * t))).astype(np.float32)
def pad(freqs, d, bright=1800):
    t = t_(d); x = np.zeros(len(t), np.float32)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12); ph = rng.uniform(0, 6.28)
            x += sum(np.sin(2 * np.pi * ff * k * t + ph * k) / k for k in range(1, 6)).astype(np.float32)
    return lowpass(x, bright) * adsr(len(t), .35, .3, .8, .5) / (len(freqs) * 3)
def pluck(f, d=.6, bright=1.0):
    t = t_(d); x = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (4 + k * 3 / bright)) / k for k in range(1, 7))
    return (x * env(len(t), .002, .5)).astype(np.float32)
def marimba(f, d=.5):
    t = t_(d); x = np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + .35 * np.sin(2 * np.pi * 3.99 * f * t) * np.exp(-t * 22) + .1 * np.sin(2 * np.pi * 9.9 * f * t) * np.exp(-t * 40)
    return (x * env(len(t), .001, 1)).astype(np.float32)
def vibes(f, d=1.2):
    t = t_(d); x = np.sin(2 * np.pi * f * t) + .2 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 8)
    return (x * np.exp(-t * 2.2) * (1 + .3 * np.sin(2 * np.pi * 5.5 * t)) * env(len(t), .002, 9)).astype(np.float32)
def bass(f, d=.4, pluck_=True):
    t = t_(d); x = np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t) + .1 * np.sin(2 * np.pi * 3 * f * t)
    e = env(len(t), .006, .35 if pluck_ else 2) * np.clip((d - t) / .03, 0, 1)
    return lowpass((x * e).astype(np.float32), 900)
def kick(d=.35, f0=120, f1=45):
    t = t_(d); f = f1 + (f0 - f1) * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 9) + .3 * noise(d, 1) * np.exp(-t * 200)).astype(np.float32)
def snare(d=.25, tone=190, brushed=False):
    t = t_(d); n = bandpass(noise(d, 2), 1500 if brushed else 900, 9000)
    x = n * np.exp(-t * (9 if brushed else 18)) + (0 if brushed else .5) * np.sin(2 * np.pi * tone * t) * np.exp(-t * 25)
    return x.astype(np.float32)
def clap(d=.25):
    t = t_(d); e = sum(np.exp(-np.maximum(t - o, 0) * 80) * (t >= o) for o in (0, .011, .023)) + .6 * np.exp(-t * 14)
    return (bandpass(noise(d, 3), 900, 5000) * e).astype(np.float32)
def hat(d=.06, open_=False):
    t = t_(d); return (highpass(noise(d, 4), 7000) * np.exp(-t * (18 if open_ else 70))).astype(np.float32)
def shaker(d=.08):
    t = t_(d); return (bandpass(noise(d, 5), 4000, 12000) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2).astype(np.float32)
def woodblock(f=900, d=.12):
    t = t_(d); return (np.sin(2 * np.pi * f * t) * np.exp(-t * 45) + .4 * np.sin(2 * np.pi * f * 2.7 * t) * np.exp(-t * 70)).astype(np.float32)

# ================================================================= music
MOODS = {
    # chords per bar, swing (0..1), and which parts play
    'detective':  dict(chords=['Dm9', 'Bb', 'Gm7', 'A7'], oct=3, swing=.55, parts='walk brush vibes ride', key=62),
    'nightdiner': dict(chords=['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], oct=3, swing=.6, parts='epiano upright softkick ride', key=65),
    'lofi':       dict(chords=['Cmaj7', 'Am7', 'Fmaj7', 'G7'], oct=3, swing=.58, parts='epiano boombap bass vinyl rain', key=60),
    'upbeat':     dict(chords=['C', 'G', 'Am', 'F'], oct=3, swing=.5, parts='four pluckarp bass8 claps', key=60),
    'bouncy':     dict(chords=['F', 'C', 'Dm', 'Bb'], oct=3, swing=.5, parts='marimba bouncykick snap shaker bass', key=65),
    'chaoscalm':  dict(chords=['Cmaj9', 'Fmaj7', 'Am7', 'Gsus2'], oct=3, swing=.5, parts='chaos calm', key=60),
}
def music(spec, dur):
    m = spec.get('music') or {}; mood = MOODS.get(m.get('mood', 'lofi'), MOODS['lofi']); bpm = m.get('bpm', 100)
    beat = 60 / bpm; bar = beat * 4; n = int((dur + 1) * SR); out = np.zeros(n, np.float32)
    parts = mood['parts'].split(); sw = mood['swing']
    calm_at = None
    if m.get('mood') == 'chaoscalm':
        cs = m.get('calmShot'); calm_at = spec['shots'][cs]['start'] if cs is not None and cs < len(spec['shots']) else dur * .5
    def eighth(b, k):   # time of the k-th eighth note in bar b, with swing
        return b * bar + (k // 2) * beat + (k % 2) * beat * 2 * sw
    bars = int(math.ceil(dur / bar)) + 1
    for b in range(bars):
        name = mood['chords'][b % len(mood['chords'])]; root, notes = chord(name, mood['oct'])
        t0 = b * bar
        if 'walk' in parts:
            seq = [root, root + 7, root + 12 if b % 2 else root + 10, root + 5]
            for k, nn in enumerate(seq): place(out, bass(midi(nn - 12), beat * .95, False), t0 + k * beat, -6)
        if 'upright' in parts:
            for k, nn in enumerate([root, root + 7]): place(out, bass(midi(nn - 12), beat * 1.8, False), t0 + k * 2 * beat, -6)
        if 'bass' in parts:
            for k in (0, 3, 5): place(out, bass(midi(root - 12), beat * .7), eighth(b, k), -6)
        if 'bass8' in parts:
            for k in range(8): place(out, bass(midi(root - 12 + (12 if k % 4 == 3 else 0)), beat * .4), eighth(b, k), -8)
        if 'vibes' in parts:
            for k in (0, 3):
                for nn in notes[1:4]: place(out, vibes(midi(nn + 12), 1.4), eighth(b, k) + .01 * (nn % 3), -15)
        if 'epiano' in parts:
            for k in (0, 3) if b % 2 == 0 else (1, 4):
                for nn in notes: place(out, epiano(midi(nn + 12), beat * 2.2, .9), eighth(b, k) + .006 * (nn % 4), -14)
        if 'pluckarp' in parts:
            seq = (notes + [notes[1] + 12, notes[2] + 12])[:6]
            for k in range(8): place(out, pluck(midi(seq[k % len(seq)] + 24), .35), eighth(b, k), -16)
            place(out, pad([midi(x + 12) for x in notes], bar, 2600), t0, -10)
        if 'marimba' in parts:
            pat = [0, 2, 1, 2, 0, 3, 2, 1]
            for k in range(8):
                if k in (2, 6) and b % 2: continue
                place(out, marimba(midi(notes[pat[k] % len(notes)] + 24), .35), eighth(b, k), -11)
        # drums
        if 'brush' in parts:
            for k in (1, 3): place(out, snare(.35, brushed=True), t0 + k * beat, -19)
        if 'ride' in parts:
            for k in range(8):
                if k % 2 == 0 or k in (3, 7): place(out, hat(.12, True), eighth(b, k), -24 if k % 2 else -21)
        if 'softkick' in parts:
            for k in (0, 2): place(out, kick(.3, 90, 45), t0 + k * beat, -14)
        if 'boombap' in parts:
            for tt in (0, 2.5 * beat, 2 * beat + beat * 1.5 if b % 2 else 2 * beat): place(out, kick(), t0 + tt, -9)
            for k in (1, 3): place(out, snare(.3), t0 + k * beat, -14)
            for k in range(8): place(out, hat(.05), eighth(b, k), -24 if k % 2 else -21)
        if 'four' in parts:
            for k in range(4): place(out, kick(.3, 140, 50), t0 + k * beat, -8)
            for k in range(8):
                if k % 2: place(out, hat(.07, True), eighth(b, k), -20)
        if 'claps' in parts:
            for k in (1, 3): place(out, clap(), t0 + k * beat, -13)
        if 'bouncykick' in parts:
            for tt in (0, 1.5 * beat, 2 * beat): place(out, kick(.25, 130, 55), t0 + tt, -10)
        if 'snap' in parts:
            for k in (1, 3): place(out, clap(.12), t0 + k * beat, -15)
        if 'shaker' in parts:
            for k in range(16): place(out, shaker(), t0 + k * beat / 4, -27 if k % 2 else -23)
        if 'chaos' in parts and (calm_at is None or t0 < calm_at + bar):
            r = np.random.default_rng(b)
            for k in range(16):
                tt = t0 + k * beat / 4 + r.uniform(-.015, .015)
                if calm_at is not None and tt > calm_at: break
                place(out, marimba(midi(int(r.choice([60, 62, 64, 66, 68, 70, 72, 75, 78])) + 12), .25), tt, -13 - r.uniform(0, 6))
            for k in range(4): place(out, woodblock(1100 if k % 2 else 800), t0 + k * beat, -15)
        if 'calm' in parts and calm_at is not None and t0 + bar > calm_at - bar:
            st = max(t0, calm_at - .2); x = pad([midi(nn + 12) for nn in notes], t0 + bar - st + .6, 1500)
            place(out, x, st, -6)
            for k in range(4):
                tt = t0 + k * beat
                if tt >= calm_at: place(out, pluck(midi(notes[k % len(notes)] + 24), .9, .6), tt, -17)
            if t0 >= calm_at - .01: place(out, bass(midi(root - 12), bar * .95, False), t0, -11)
        if 'vinyl' in parts:
            r = np.random.default_rng(100 + b); cr = np.zeros(int(bar * SR), np.float32)
            for _ in range(int(bar * 9)): j = r.integers(0, len(cr) - 40); cr[j:j + 40] += r.uniform(.2, 1) * np.exp(-np.arange(40) / 6)
            place(out, highpass(cr, 1200), t0, -30)
    if 'rain' in mood['parts']:
        place(out, lowpass(highpass(noise(dur + 1, 9), 800), 7000) * .6, 0, -26)
    # tail: gentle fade on the last 0.6 s
    out = out[:int(dur * SR)]; f = int(.6 * SR); out[-f:] *= np.linspace(1, 0, f) ** 1.5
    return out

# ================================================================= sound effects
def sfx(kind, seed=0):
    r = np.random.default_rng(seed)
    if kind in ('whoosh', 'bloom', 'brush'):
        d = .5 if kind != 'bloom' else .6; x = sweep_noise(d, 300 if kind != 'bloom' else 200, 2600 if kind != 'bloom' else 1200, 1.2, seed)
        return norm(x * np.sin(np.pi * np.clip(t_(d) / d, 0, 1)) ** 1.5, .8)
    if kind == 'whip':
        d = .28; x = sweep_noise(d, 700, 5000, .9, seed); return norm(x * np.sin(np.pi * np.clip(t_(d) / d, 0, 1)) ** 2, .9)
    if kind == 'tear':
        d = .42; t = t_(d); g = np.repeat(r.uniform(.2, 1, int(d * 200)), SR // 200)[:len(t)]
        return norm(bandpass(noise(d, seed), 1200, 7000) * g * np.exp(-t * 2.5) * np.minimum(1, t / .02), .8)
    if kind == 'flip':
        out = np.zeros(int(.3 * SR), np.float32)
        for o in (0, .09):
            d = .1; x = bandpass(noise(d, seed + int(o * 100)), 900, 5000) * np.sin(np.pi * np.clip(t_(d) / d, 0, 1)); place(out, x, o)
        return norm(out, .7)
    if kind == 'splat':
        d = .35; t = t_(d); x = lowpass(noise(d, seed), 1800) * np.exp(-t * 12) + kick(d, 160, 60)[:len(t)] * .6
        return norm(x, .9)
    if kind == 'drip':
        out = np.zeros(int(.35 * SR), np.float32)
        for o, f0 in ((0, 1100), (.13, 800)):
            d = .09; t = t_(d); f = f0 * np.exp(-t * 14) + 250; place(out, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30), o)
        return norm(out, .7)
    if kind == 'coin':
        d = .45; t = t_(d); x = sum(np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * np.exp(-t * dk) * a for f, dk, a in ((2093 * r.uniform(.97, 1.03), 9, 1), (3150, 12, .7), (4320, 16, .5), (5600, 20, .35)))
        return norm(x * np.minimum(1, t / .002), .6)
    if kind == 'coins':
        out = np.zeros(int(1.4 * SR), np.float32)
        for i in range(10): place(out, sfx('coin', seed + i), i * .07 + r.uniform(0, .03), -i * .8)
        return norm(out, .8)
    if kind in ('thud', 'stamp'):
        d = .4; t = t_(d); x = kick(d, 110, 42) + .6 * bandpass(noise(d, seed), 300, 3000) * np.exp(-t * 60)
        return norm(x, 1.0)
    if kind == 'thump':
        return norm(kick(.3, 130, 50), .9)
    if kind == 'ding':
        d = 1.0; t = t_(d); x = np.zeros(len(t), np.float32)
        for o, f in ((0, 1319), (.12, 1976)):
            tt = np.maximum(t - o, 0); x += (t >= o) * (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 9)) * np.exp(-tt * 4.5)
        return norm(x, .7)
    if kind == 'buzz':
        d = .55; t = t_(d); x = np.sign(np.sin(2 * np.pi * 150 * t)) * .5 + np.sin(2 * np.pi * 150 * t); g = ((t % .28) < .2).astype(np.float32)
        return norm(lowpass(x * g, 900), .5)
    if kind == 'tick':
        d = .02; t = t_(d); return norm(np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 400), .5)
    if kind == 'kaching':
        out = np.zeros(int(1.0 * SR), np.float32); place(out, sfx('thud', seed)[:int(.1 * SR)], 0, -10)
        place(out, sfx('coin', seed), .03, -2); d = .8; t = t_(d)
        place(out, (np.sin(2 * np.pi * 2093 * t) + .5 * np.sin(2 * np.pi * 2637 * t) + .3 * np.sin(2 * np.pi * 3136 * t)) * np.exp(-t * 4), .06, -4)
        return norm(out, .8)
    if kind == 'riser':
        d = 1.3; t = t_(d); f = 180 * (1300 / 180) ** (t / d); saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
        x = lowpass(saw, 3000) * .4 + sweep_noise(d, 400, 6000, 1.4, seed) * .8
        return norm(x * (t / d) ** 2.2, .7)
    if kind == 'pop':
        d = .09; t = t_(d); f = 400 + 900 * t / d; return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35), .7)
    if kind == 'boing':
        d = .55; t = t_(d); f = 210 + 90 * np.sin(2 * np.pi * 13 * t) * np.exp(-t * 4) + 60 * np.exp(-t * 6)
        return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * np.minimum(1, t / .005), .8)
    if kind == 'sparkle':
        out = np.zeros(int(.8 * SR), np.float32)
        for i in range(6):
            d = .4; t = t_(d); f = r.choice([2637, 3136, 3520, 3951, 4699]); place(out, np.sin(2 * np.pi * f * t) * np.exp(-t * 10), i * .06, -i)
        return norm(out, .55)
    raise ValueError('unknown sfx kind ' + kind)
# default level of each kind (dB, relative to a -0.0 dBFS peak before the final mix)
LEVEL = {'whoosh': -16, 'brush': -16, 'bloom': -18, 'whip': -15, 'tear': -15, 'flip': -14, 'splat': -12, 'drip': -14, 'coin': -16, 'coins': -14,
         'thud': -9, 'stamp': -9, 'thump': -13, 'ding': -11, 'buzz': -16, 'tick': -22, 'kaching': -12, 'riser': -17, 'pop': -17, 'boing': -13, 'sparkle': -18}
TRANS_SFX = {'brush': 'brush', 'bloom': 'bloom', 'drip': 'drip', 'splat': 'splat', 'whip': 'whip', 'tear': 'tear', 'flip': 'flip', 'iris': 'whoosh', 'zoom': 'whoosh'}

def events(spec):
    """[(time, kind, gain_db)] derived from what is on screen, plus spec['sfx']."""
    shots = spec['shots'] + [dict(spec['endCard'], scene='endcard')]
    ev = []
    for i, s in enumerate(shots):
        st = s['start']; p = s.get('params') or {}
        prev = shots[i - 1] if i else None
        if prev is not None:
            o = prev.get('out') or spec.get('transition', 'brush'); o = o if isinstance(o, dict) else {'type': o}
            k = TRANS_SFX.get(o['type'])
            if k: ev.append((st - TRANS_HALF.get(o['type'], .3) * (.9 if k in ('whoosh', 'whip', 'brush', 'bloom') else .5), k, 0))
        for c in (p.get('cast') or []) + [x for x in (p.get('left'), p.get('right'), p.get('host')) if x]:
            en = c.get('enter') or {}
            if en.get('type') == 'drop': ev.append((st + en.get('at', 0) + en.get('dur', .45), 'boing' if c['who'] == 'clocky' else 'thump', 0))
            elif en.get('type') == 'pop': ev.append((st + en.get('at', 0), 'pop', 0))
            elif en.get('type') in ('rise', 'slide', 'peek'): ev.append((st + en.get('at', 0), 'whip', -5))
        for f in p.get('fx') or []:
            at = st + f.get('at', 0)
            if f['type'] == 'coins': ev.append((at + .3, 'coins', 0))
            elif f['type'] == 'stamp': ev.append((at, 'stamp', 0))
            elif f['type'] == 'spark': ev.append((at, 'sparkle', 0))
            elif f['type'] == 'lines': ev.append((at, 'whip', -3))
            elif f['type'] == 'sfx': ev.append((at, 'boing' if 'BOING' in f['text'].upper() else 'sparkle' if 'TA' in f['text'].upper() else 'pop', 0))
            elif f['type'] == 'label': ev.append((at, 'pop', 0))
        sc = s.get('scene')
        if sc == 'card':
            cd = p.get('card') or {}
            for rw in cd.get('rows', []):
                if 0 <= rw.get('at', 0) < 8:
                    if rw.get('count'):
                        for k in range(int((rw.get('countDur', .7)) / .07)): ev.append((st + rw['at'] + k * .07, 'tick', -2 - k * .4))
                    else: ev.append((st + rw['at'], 'tick', 2))
            tt = cd.get('total')
            if tt and 0 <= tt.get('at', 0) < 8:
                if tt.get('count'):
                    for k in range(int(tt.get('countDur', .9) / .07)): ev.append((st + tt['at'] + k * .07, 'tick', -2 - k * .3))
                    ev.append((st + tt['at'] + tt.get('countDur', .9), 'kaching', 0))
                else: ev.append((st + tt['at'], 'pop', 0))
            if p.get('stamp'): ev.append((st + p['stamp']['at'], 'stamp', 0))
        if sc == 'countdown': ev.append((st + .05, 'flip', 2))
        if sc == 'notify':
            n_at = (p.get('notif') or {}).get('at', .5)
            if n_at >= 0: ev += [(st + n_at - .12, 'buzz', 0), (st + n_at, 'ding', 0)]
        if sc == 'list': ev += [(st + .05, 'pop', 0), (st + .2, 'pop', -3)]
        if sc == 'montage': ev += [(st + max(0, pn.get('at', 0)), 'pop', 0) for pn in p.get('panels', [])]
        if sc == 'title': ev += [(st + L.get('at', 0), 'pop', 0) for L in p.get('lines', [])]
        if sc == 'split' and 0 <= p.get('afterAt', 99) < 8: ev.append((st + p['afterAt'], 'whoosh', -2))
        if sc == 'endcard': ev += [(st - 1.15, 'riser', 0), (st + .4, 'sparkle', 0), (st + .62, 'pop', 0)]
    for e in spec.get('sfx') or []: ev.append((e['t'], e['kind'], e.get('gain', 0)))
    return sorted((t, k, g) for t, k, g in ev if t > -0.5)

# ================================================================= mix
def lufs(x):
    import pyloudnorm; return pyloudnorm.Meter(SR).integrated_loudness(x.astype(np.float64))
def true_peak(x):
    from scipy.signal import resample_poly; return 20 * math.log10(max(1e-9, float(np.max(np.abs(resample_poly(x, 4, 1))))))
def duck_gain(voice, depth_db=12, att=.02, rel=.3):
    """Smooth gain curve: down by depth_db wherever the voice is talking."""
    hop = 240; frames = len(voice) // hop + 1
    e = np.array([np.sqrt(np.mean(voice[i * hop:(i + 1) * hop] ** 2)) if i * hop < len(voice) else 0 for i in range(frames)])
    on = (e > max(1e-4, np.max(e) * .02)).astype(float); g = np.zeros(frames); a, r = hop / SR / att, hop / SR / rel; v = 0
    for i in range(frames): v += (on[i] - v) * (min(1, a) if on[i] > v else min(1, r)); g[i] = v
    gain = 10 ** (-depth_db * g / 20)
    return np.interp(np.arange(len(voice)), np.arange(frames) * hop, gain).astype(np.float32)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('spec'); ap.add_argument('--voice', action='store_true')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache'))
    a = ap.parse_args()
    spec = json.load(open(a.spec)); dur = spec['duration']; n = int(round(dur * SR))
    voice = np.zeros(n, np.float32)
    if a.voice:
        v, sr = sf.read(os.path.join(a.out, 'voice', spec['id'] + '.wav'), dtype='float32')
        if sr != SR: sys.exit('voice track must be 48 kHz (run voice.py)')
        voice[:min(n, len(v))] = v[:n]
    mus = music(spec, dur); mus = np.pad(mus, (0, max(0, n - len(mus))))[:n]
    mus *= 10 ** ((-21 + (spec.get('music') or {}).get('gain', 0) - lufs(mus)) / 20)
    if a.voice: mus *= duck_gain(voice)
    fx = np.zeros(n, np.float32); evs = events(spec)
    for j, (t, k, g) in enumerate(evs): place(fx, sfx(k, j), t, LEVEL.get(k, -16) + g)
    mix = voice + mus + fx
    f0 = int(.03 * SR); mix[:f0] *= np.linspace(0, 1, f0)          # no hard edge at the first sample (AAC priming)
    mix *= 10 ** ((-14 - lufs(mix)) / 20)
    for _ in range(6):                                  # true-peak safety: soft knee limiter, re-measure
        tp = true_peak(mix)
        if tp <= -2.6: break                        # head-room for AAC encoding overshoot
        lim = 10 ** (-3.0 / 20); k0 = lim * .6
        mix = np.where(np.abs(mix) > k0, np.sign(mix) * (k0 + (lim - k0) * np.tanh((np.abs(mix) - k0) / (lim - k0))), mix).astype(np.float32)
    os.makedirs(os.path.join(a.out, 'audio'), exist_ok=True)
    f = os.path.join(a.out, 'audio', spec['id'] + '.wav'); sf.write(f, mix, SR, subtype='PCM_16')
    print(f"wrote {f}: {lufs(mix):.1f} LUFS, true peak {true_peak(mix):.1f} dB, {len(evs)} sfx events, music {spec.get('music', {}).get('mood')}")

if __name__ == '__main__':
    main()

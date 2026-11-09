#!/usr/bin/env python3
"""voice.py: optional voice track for a spec (Kokoro TTS, offline).

    <tts-python> engine/voice.py engine/specs/ot-puzzle.json --models <dir with kokoro-v1.0.onnx + voices-v1.0.bin>

Reads every voiced line in the spec (a shot's "say", or "say" on entries of a shot's "captions" list, and the end
card's "say"), speaks it with the speaker's voice at natural speed, places it at its caption's start, and writes:
    engine/cache/voice/<id>.wav    the mixed voice track (24 kHz mono)
    engine/cache/voice/<id>.json   timing report + per-frame mouth envelope per speaker (drives lip sync)
Then render with:  node engine/render.cjs <spec> --video --voice --out=<id>-voiced.mp4
If a line is longer than its slot it is sped up (max 1.15x); if it still doesn't fit you get a WARNING: shorten the
"say" text or lengthen the shot. Videos never depend on this step: without it, captions carry the story.
"""
import sys, os, json, argparse
import numpy as np, soundfile as sf

VOICES = {'SAM': 'am_michael', 'NOTES': 'af_bella', 'CLOCKY': 'am_puck', 'MANAGER': 'am_onyx', 'STUB': 'am_echo'}
SPEED = {'SAM': 1.0, 'NOTES': 1.05, 'CLOCKY': 1.0, 'MANAGER': 0.95, 'STUB': 1.05}
SR, LEAD = 24000, 0.12

def voiced_lines(spec):
    shots = list(spec['shots'])
    ec = spec.get('endCard') or {}
    shots.append({'start': ec.get('start', spec['duration'] - 4.5), 'say': ec.get('say'), 'speaker': ec.get('speaker'), 'caption': ec.get('caption')})
    out = []
    for i, s in enumerate(shots):
        end = shots[i + 1]['start'] if i + 1 < len(shots) else spec['duration']
        caps = s.get('captions')
        if caps:
            for j, c in enumerate(caps):
                if not c.get('say'): continue
                st = s['start'] + c.get('at', 0)
                en = s['start'] + caps[j + 1]['at'] if j + 1 < len(caps) else end
                out.append((st, en, c.get('speaker') or s.get('speaker'), c['say']))
        elif s.get('say') and s.get('speaker'):
            out.append((s['start'], end, s['speaker'], s['say']))
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('spec'); ap.add_argument('--models', default=os.environ.get('CLOCKED_TTS_MODELS'))
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'voice'))
    a = ap.parse_args()
    if not a.models: sys.exit('pass --models <dir> or set CLOCKED_TTS_MODELS')
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(a.models, 'kokoro-v1.0.onnx'), os.path.join(a.models, 'voices-v1.0.bin'))
    spec = json.load(open(a.spec)); fps = spec.get('fps', 30); dur = spec['duration']
    n = int(round(dur * SR)); mix = np.zeros(n, dtype=np.float32)
    per = {}
    report, warn = [], 0
    for st, en, who, text in voiced_lines(spec):
        voice = VOICES.get(who, 'am_michael'); sp = SPEED.get(who, 1.0)
        audio, sr = k.create(text, voice=voice, speed=sp, lang='en-us')
        room = en - st - LEAD - 0.1
        while len(audio) / sr > room and sp < 1.15:
            sp = round(sp + 0.03, 2); audio, sr = k.create(text, voice=voice, speed=sp, lang='en-us')
        # trim leading/trailing near-silence so the mouth moves with the words
        nz = np.where(np.abs(audio) > 0.01)[0]
        if len(nz): audio = audio[max(0, nz[0] - 240): nz[-1] + 480]
        fits = len(audio) / sr <= room + 0.1
        if not fits: warn += 1; print(f'WARNING: "{text}" ({who}) is {len(audio)/sr:.2f}s for a {room:.2f}s slot at {st:.2f}s')
        i0 = int((st + LEAD) * SR); m = min(len(audio), n - i0)
        mix[i0:i0 + m] += audio[:m]
        per.setdefault(who, np.zeros(n, dtype=np.float32))[i0:i0 + m] += audio[:m]
        report.append(dict(start=round(st, 2), end=round(en, 2), speaker=who, voice=voice, speed=sp, audio_start=round(st + LEAD, 3), audio_end=round(st + LEAD + len(audio) / sr, 3), text=text, fits=fits))
    peak = float(np.abs(mix).max()) or 1.0
    mix = mix / peak * 0.89
    os.makedirs(a.out, exist_ok=True)
    sf.write(os.path.join(a.out, spec['id'] + '.wav'), mix, SR)
    hop = SR / fps; frames = int(round(dur * fps)); mouth = {}
    for who, sig in per.items():
        env = []
        for f in range(frames):
            seg = sig[int(f * hop): int((f + 1) * hop)]
            env.append(float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0)
        mx = max(env) or 1.0
        mouth[who] = [round(min(1.0, (v / mx) ** 0.6 * 1.25), 3) if v > mx * 0.04 else 0.0 for v in env]
    json.dump(dict(fps=fps, duration=dur, lines=report, mouth=mouth), open(os.path.join(a.out, spec['id'] + '.json'), 'w'))
    for r in report: print(f"{r['start']:6.2f}-{r['end']:6.2f} {r['speaker']:8s} {r['voice']:11s} x{r['speed']:.2f} {r['audio_end']-r['audio_start']:.2f}s {'ok' if r['fits'] else 'LONG'}  {r['text']}")
    print(f"wrote {os.path.join(a.out, spec['id'])}.wav/.json  ({warn} warnings)")

if __name__ == '__main__':
    main()

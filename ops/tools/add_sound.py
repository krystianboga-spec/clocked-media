"""Add an original synthesized music bed + SFX to a silent video (no voice).
Usage: python add_sound.py in.mp4 out.mp4 --mood upbeat --bpm 116
SFX: whoosh on every detected scene cut, pop at 0.1 s, riser into the last 1.5 s, kaching on the final cut.
Uses engine/sound.py (pure numpy synthesis, nothing downloaded)."""
import sys, os, re, subprocess, argparse, numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'engine'))
import sound as S
ap = argparse.ArgumentParser(); ap.add_argument('inp'); ap.add_argument('out')
ap.add_argument('--mood', default='upbeat'); ap.add_argument('--bpm', type=float, default=110); ap.add_argument('--scene', type=float, default=.3)
a = ap.parse_args()
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.inp]).strip())
# motion peaks (frame-difference maxima) stand in for cuts: these are motion graphics without hard cuts
log = subprocess.run(['ffmpeg', '-hide_banner', '-i', a.inp, '-vf', 'scale=270:-1,signalstats,metadata=print:key=lavfi.signalstats.YDIF', '-f', 'null', '-'], capture_output=True, text=True).stderr
tt = [float(x) for x in re.findall(r'pts_time:([0-9.]+)', log)]; yd = [float(x) for x in re.findall(r'YDIF=([0-9.]+)', log)]
pk = sorted([(tt[i], yd[i]) for i in range(1, len(yd) - 1) if yd[i] >= yd[i - 1] and yd[i] >= yd[i + 1] and yd[i] > a.scene * 10], key=lambda p: -p[1])
cuts = []
for t0, v in pk:
    if .4 < t0 < dur - .6 and all(abs(t0 - c) > .9 for c in cuts): cuts.append(t0)
cuts.sort()
spec = {'id': 'x', 'duration': dur, 'shots': [{'start': 0}], 'music': {'mood': a.mood, 'bpm': a.bpm}}
n = int(round(dur * S.SR))
mus = S.music(spec, dur); mus = np.pad(mus, (0, max(0, n - len(mus))))[:n]
mus *= 10 ** ((-18 - S.lufs(mus)) / 20)
fade = int(.8 * S.SR); mus[-fade:] *= np.linspace(1, 0, fade)
fx = np.zeros(n, np.float32); ev = [(.1, 'pop', 0)] + [(max(0, c - .25), 'whoosh' if j % 2 == 0 else 'whip', 0) for j, c in enumerate(cuts)]
if cuts: ev.append((cuts[-1] + .05, 'kaching', -2))
ev.append((max(0, dur - 1.6), 'riser', -2))
for j, (t, k, g) in enumerate(ev): S.place(fx, S.sfx(k, j), t, S.LEVEL.get(k, -16) + g)
mix = mus + fx; f0 = int(.03 * S.SR); mix[:f0] *= np.linspace(0, 1, f0)
mix *= 10 ** ((-17 - S.lufs(mix)) / 20)   # mono -17 = about -14 LUFS once copied to two channels
for _ in range(6):
    if S.true_peak(mix) <= -4: break
    lim = 10 ** (-4.5 / 20); k0 = lim * .6
    mix = np.where(np.abs(mix) > k0, np.sign(mix) * (k0 + (lim - k0) * np.tanh((np.abs(mix) - k0) / (lim - k0))), mix).astype(np.float32)
wav = a.out + '.wav'; sf.write(wav, np.stack([mix, mix], 1), S.SR, subtype='PCM_16')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', a.inp, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', a.out], check=True)
os.remove(wav)
print(f'{a.out}: {dur:.1f}s, cuts {[round(c,2) for c in cuts]}, {len(ev)} sfx, mood {a.mood}, {S.lufs(mix):.1f} LUFS')

#!/usr/bin/env python3
"""voice.py: the optional voice track for a spec (Kokoro TTS, offline, CPU).

    <tts-python> engine/voice.py <spec.json> --models <dir with kokoro-v1.0.onnx + voices-v1.0.bin> [--retime] [--check]

Rule: the caption is the single source of truth. Every caption (or captions[] entry) that has a speaker is spoken,
word for word: the spoken text is derived from the caption by speak_text() (strip *emphasis*, read $, numbers, x, =,
times like a person reads them). A shot may not carry its own "say" text; --check fails if it does, or if any spoken
line is not derived from its caption.

Pipeline per line: split into phrases at . ? ! : and ..., synthesize each with Kokoro (speed about 1.0 to 1.05, never
above 1.05), widen and shape its pitch contour with Praat PSOLA (expand around the speaker mean, a fall at the end of
statements, a rise on questions, a stress bump on the *emphasised* word or the dollar amount, slow drift), join with
real pauses and short fades. Per-speaker stems then get high-pass, presence EQ, de-ess, light compression and a
small room, and the mix is normalised to -16 LUFS with a true-peak limit. Mouth envelopes come from the processed stems.

--retime rewrites the spec so nothing is cut: each caption stays on screen until its line ends plus 0.25 s. A caption
that has to start later shifts every timed key in that shot after it (rows, totals, stamps, fx, camera keys); a shot
that has to get longer shifts every later shot and the end card. Lines are never sped up to fit.

Writes engine/cache/voice/<id>.wav (48 kHz mono) and <id>.json (timing report + per-frame mouth envelope per speaker).
Needs: pip install kokoro-onnx soundfile numpy praat-parselmouth pyloudnorm scipy, ffmpeg on PATH, and the two Kokoro
model files (see engine/README.md).
"""
import sys, os, re, json, argparse, subprocess, tempfile, math
import numpy as np, soundfile as sf

# ---------------------------------------------------------------- speakers
# voice: a Kokoro voice name or a blend {name: weight}. shift: semitones. target: wanted F0 std (semitones).
SPEAKERS = {
    'SAM':     dict(voice={'am_michael': .6, 'am_fenrir': .4}, speed=1.04, shift=0.0, target=3.4, floor=65, ceil=320),
    'CLOCKY':  dict(voice={'af_heart': 1.0}, speed=1.05, shift=0.0, target=3.6, floor=110, ceil=520),
    'NOTES':   dict(voice={'af_bella': 1.0}, speed=1.06, shift=1.5, target=3.8, floor=120, ceil=600),
    'MANAGER': dict(voice={'am_fenrir': .5, 'am_onyx': .5}, speed=1.0, shift=-2.5, target=2.8, floor=60, ceil=300),
    'STUB':    dict(voice={'am_puck': .6, 'am_echo': .4}, speed=1.02, shift=1.0, target=3.0, floor=70, ceil=350),
}
SR_TTS, SR, FPS = 24000, 48000, 30
LEAD, TAIL = 0.08, 0.22          # voice starts 0.08 s after its caption; caption stays 0.22 s after the voice ends
MAX_SPEED = 1.05
PAUSE = {'?': .2, '!': .18, '.': .22, ':': .14, '...': .3, '': .0}

# ---------------------------------------------------------------- caption -> speech
ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
def words(n):
    n = int(n)
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else '-' + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + words(n % 100))
    if n < 1000000: return words(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + words(n % 1000))
    raise ValueError(n)
def money(m):
    plus, d, c, unit = m.group(1), m.group(2).replace(',', ''), m.group(4), m.group(5)
    if c and int(c):
        cents = ('oh ' + ONES[int(c)]) if int(c) < 10 else words(int(c))
        s = f"{words(d)} {cents}" if int(d) else f"{words(int(c))} cents"
    else:
        s = f"{words(d)} dollar" + ('' if int(d) == 1 else 's')
    if unit: s += ' an hour'
    return ('plus ' if plus else '') + s
def decimal(m):
    a, b = m.group(1), m.group(2)
    return f"{words(a)} and a half" if b == '5' else f"{words(a)} point " + ' '.join(ONES[int(ch)] for ch in b)
def speak_text(caption):
    """The words a person says when reading this caption aloud."""
    s = caption.replace('*', '').replace('clocked.space', 'clocked dot space')
    s = re.sub(r'\s*×\s*', ' times ', s); s = re.sub(r'(\d)\s*x\s*(\d)', r'\1 times \2', s)
    s = re.sub(r'\s*=\s*', ' equals ', s)
    s = re.sub(r'(\+\s*)?\$([\d,]+)(\.(\d\d))?(/hr)?', money, s)
    s = re.sub(r'\b(\d{1,2}):(\d\d)\b', lambda m: words(m.group(1)) + ' ' + (('oh ' + ONES[int(m.group(2))]) if m.group(2)[0] == '0' else words(m.group(2))), s)
    s = re.sub(r'\b(\d+)\s*-\s*(\d+)\b', lambda m: f"{words(m.group(1))} to {words(m.group(2))}", s)
    s = re.sub(r'\b(\d+)\.(\d+)', decimal, s)
    s = re.sub(r'\b(\d+)\s*(hrs|hr|h)\b', lambda m: words(m.group(1)) + (' hour' if m.group(1) == '1' else ' hours'), s)
    s = re.sub(r'\b(and a half)\s*(hrs|hr|h)\b', r'\1 hours', s)
    s = re.sub(r'\d+', lambda m: words(m.group(0)), s)
    s = re.sub(r'\?+', '?', s); s = re.sub(r'!+', '!', s)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'(^|[.?!]\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), s)   # sentence starts
    return s
def emphasis(caption):
    return [speak_text(x).lower() for x in re.findall(r'\*([^*]+)\*', caption)]

# ---------------------------------------------------------------- spec -> voiced lines
def voiced_lines(spec):
    """[(shot index, entry index or None, caption start, speaker, caption)] for every caption that has a speaker."""
    shots = list(spec['shots']) + [dict(spec.get('endCard') or {}, start=(spec.get('endCard') or {}).get('start', spec['duration'] - 4.5))]
    out = []
    for i, s in enumerate(shots):
        if s.get('captions'):
            for j, c in enumerate(s['captions']):
                spk = c.get('speaker') or s.get('speaker')
                if spk and c.get('text'): out.append((i, j, s['start'] + c.get('at', 0), spk, c['text']))
        elif s.get('caption') and s.get('speaker'):
            out.append((i, None, s['start'], s['speaker'], s['caption']))
    return out, shots
def check(spec):
    errs = []
    shots = list(spec['shots']) + [spec.get('endCard') or {}]
    for i, s in enumerate(shots):
        for k in ('say', 'voiceSpeaker'):
            if k in s: errs.append(f"shot {i}: '{k}' is not allowed; the caption is what gets spoken")
        for c in s.get('captions') or []:
            if 'say' in c: errs.append(f"shot {i}: captions entry has 'say'; the caption is what gets spoken")
    lines, _ = voiced_lines(spec)
    for (i, j, st, spk, cap) in lines:
        if spk not in SPEAKERS: errs.append(f"shot {i}: unknown speaker {spk}")
        txt = speak_text(cap)
        if re.search(r'[\d$×=*]', txt): errs.append(f"shot {i}: '{cap}' does not read cleanly aloud: '{txt}'")
        if re.search('[\u2013\u2014]', cap): errs.append(f"shot {i}: dash in caption")
    return errs

# ---------------------------------------------------------------- synthesis
def phrases(text):
    """Split spoken text into phrases at sentence ends, colons and ellipses: [(phrase, closing mark)]."""
    out, buf, i = [], '', 0
    while i < len(text):
        if text.startswith('...', i): out.append((buf.strip() + '...', '...')); buf = ''; i += 3; continue
        ch = text[i]; buf += ch; i += 1
        if ch in '.?!:' and (i >= len(text) or text[i] == ' '): out.append((buf.strip(), ch)); buf = ''
    if buf.strip(): out.append((buf.strip(), ''))
    return [(p, m) for p, m in out if re.search(r'[A-Za-z]', p)]
def style_of(k, voice, jitter=0.0):
    names = list(voice.items())
    if jitter and len(names) == 2:
        (a, wa), (b, wb) = names; wa = min(.9, max(.1, wa + jitter)); names = [(a, wa), (b, 1 - wa)]
    st = sum(k.get_voice_style(n) * w for n, w in names)
    return (st / sum(w for _, w in names)).astype(np.float32)
def f0_stats(x, sr, floor, ceil):
    import parselmouth
    p = parselmouth.Sound(x.astype(np.float64), sr).to_pitch_ac(time_step=.01, pitch_floor=floor, pitch_ceiling=ceil)
    f = p.selected_array['frequency']; f = f[f > 0]
    if len(f) < 5: return None
    st = 12 * np.log2(f / 100.0)
    return dict(std=float(np.std(st)), range=float(np.percentile(st, 95) - np.percentile(st, 5)), mean_hz=float(np.exp(np.mean(np.log(f)))))
def flatness(x, sr):
    n = 1024; hop = 512; vals = []
    for i in range(0, len(x) - n, hop):
        fr = x[i:i + n] * np.hanning(n); e = np.mean(fr ** 2)
        if e < 1e-5: continue
        p = np.abs(np.fft.rfft(fr)) ** 2 + 1e-12
        vals.append(np.exp(np.mean(np.log(p))) / np.mean(p))
    return float(np.mean(vals)) if vals else 0.0
def shape_pitch(x, sr, cfg, mark, stress_frac, seed):
    """Praat PSOLA: widen the contour around the speaker mean and add a final fall or rise, a stress bump and drift."""
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(x.astype(np.float64), sr)
    dur = snd.duration
    st = f0_stats(x, sr, cfg['floor'], cfg['ceil'])
    if not st or dur < .25: return x
    k = min(1.5, max(1.0, cfg['target'] / max(st['std'], .5)))
    if mark == '!': k = min(1.5, k * 1.1)
    lnm = math.log(st['mean_hz'])
    terms = [f"{cfg['shift']:.3f}"]
    rng = np.random.default_rng(seed)
    terms.append(f"{rng.uniform(.25, .45):.3f}*sin(2*pi*x/{rng.uniform(1.6, 2.6):.3f} + {rng.uniform(0, 6.28):.3f})")
    if stress_frac is not None:
        bt = min(dur - .1, max(.1, stress_frac * dur)); terms.append(f"1.6*exp(-((x-{bt:.3f})/0.14)^2)")
    if mark == '?':
        ft = max(0, dur - .32); terms.append(f"(if x > {ft:.3f} then 2.6*((x-{ft:.3f})/0.32) else 0 fi)")
    elif mark in '.:!' and mark:
        ft = max(0, dur - .38); terms.append(f"(if x > {ft:.3f} then -1.8*((x-{ft:.3f})/0.38) else 0 fi)")
    formula = f"exp({lnm:.5f} + (ln(self) - {lnm:.5f})*{k:.3f}) * 2^(({' + '.join(terms)})/12)"
    man = call(snd, "To Manipulation", .01, cfg['floor'], cfg['ceil'])
    tier = call(man, "Extract pitch tier")
    call(tier, "Formula", formula)
    call([man, tier], "Replace pitch tier")
    out = call(man, "Get resynthesis (overlap-add)")
    y = np.asarray(out.values[0], dtype=np.float32)
    return y[:len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))
def fade(x, sr, ms=8):
    n = min(len(x) // 2, int(sr * ms / 1000));
    if n > 0: x = x.copy(); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n)
    return x
def synth_line(k, spk, caption, seed, shape=True, plain=False):
    """One caption line -> (audio at SR_TTS, report)."""
    cfg = SPEAKERS[spk]; text = speak_text(caption); emph = emphasis(caption)
    if plain:   # the old single-call delivery, for A/B
        a, sr = k.create(text, voice=style_of(k, cfg['voice']), speed=cfg['speed'], lang='en-us'); return a, dict(text=text)
    parts, rep = [], []
    for pi, (ph, mark) in enumerate(phrases(text)):
        h = (seed * 7919 + pi * 104729) % 1000 / 1000
        sp = min(MAX_SPEED, cfg['speed'] * (0.96 + 0.05 * h))
        a, sr = k.create(ph.rstrip('.') if mark == '...' else ph, voice=style_of(k, cfg['voice'], (h - .5) * .16), speed=sp, lang='en-us')
        nz = np.where(np.abs(a) > .008)[0]
        if len(nz): a = a[max(0, nz[0] - 120): nz[-1] + 360]
        low = ph.lower(); sf_ = None
        for e in emph:
            pos = low.find(e.lower().split(' ')[0])
            if pos >= 0: sf_ = (pos + len(e) * .5) / max(1, len(ph)); break
        if sf_ is None:
            m = re.search(r'(dollars?|fifty|seventy-five|forty-four|thirty-three|ninety-nine)', low)
            if m: sf_ = (m.start() + 4) / max(1, len(ph))
        before = f0_stats(a, SR_TTS, cfg['floor'], cfg['ceil'])
        if shape: a = shape_pitch(a, SR_TTS, cfg, mark, sf_, seed * 31 + pi)
        after = f0_stats(a, SR_TTS, cfg['floor'], cfg['ceil'])
        parts.append(fade(a, SR_TTS)); parts.append(np.zeros(int(SR_TTS * PAUSE.get(mark, 0) * (0.85 + .3 * h)), np.float32) if pi < 99 else None)
        rep.append(dict(phrase=ph, speed=round(sp, 3), f0_before=before, f0_after=after))
    while parts and (parts[-1] is None or (len(parts[-1]) and not np.any(parts[-1]))): parts.pop()
    return np.concatenate([p for p in parts if p is not None]), dict(text=text, phrases=rep)

# ---------------------------------------------------------------- post: chain, mix, loudness
CHAIN = ("highpass=f=80,equalizer=f=250:t=q:w=1.0:g=-1.5,equalizer=f=3400:t=q:w=1.3:g=2.5,"
         "deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=0.1:ratio=2.5:attack=6:release=140:makeup=1.6,"
         "aecho=0.85:0.9:23|41:0.07|0.045")
def ff(inp, out, filt):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', inp, '-af', filt, '-ar', str(SR), '-ac', '1', out], check=True)
def resample(x, a, b):
    from scipy.signal import resample_poly
    g = math.gcd(a, b); return resample_poly(x, b // g, a // g).astype(np.float32)
def true_peak_db(x):
    return 20 * math.log10(max(1e-9, float(np.max(np.abs(resample(x, SR, SR * 4))))))

# ---------------------------------------------------------------- retiming
TIME_KEYS = {'at', 'afterAt', 'rowsAt', 'strike'}
def shift_times(obj, after, d):
    """Add d to every timed key in a shot's params that happens at or after `after` (shot time)."""
    if isinstance(obj, dict):
        for kk, v in obj.items():
            if kk in TIME_KEYS and isinstance(v, (int, float)) and v >= after - 1e-6: obj[kk] = round(v + d, 3)
            elif kk in ('cam', 'shake', 'beats', 'path') and isinstance(v, list):
                for key in v:
                    if isinstance(key, list) and key and isinstance(key[0], (int, float)) and key[0] >= after - 1e-6: key[0] = round(key[0] + d, 3)
            else: shift_times(v, after, d)
    elif isinstance(obj, list):
        for v in obj: shift_times(v, after, d)
def retime(spec, durs):
    """durs: {(shot, entry): seconds of audio}. Mutates spec so every caption outlasts its line by TAIL."""
    shots = spec['shots'] + [spec['endCard']]
    for i in range(len(shots)):
        s = shots[i]; start = s['start']; end = shots[i + 1]['start'] if i + 1 < len(shots) else spec['duration']
        caps = s.get('captions')
        if caps:
            for j in range(1, len(caps)):
                prev = caps[j - 1]; need = prev.get('at', 0) + LEAD + durs.get((i, j - 1), 0) + TAIL
                if caps[j].get('at', 0) < need:
                    d = round(need - caps[j]['at'], 2)
                    shift_times(s.get('params', {}), caps[j]['at'], d)
                    for c in caps[j:]: c['at'] = round(c.get('at', 0) + d, 2)
            last = (len(caps) - 1, caps[-1].get('at', 0))
            need_end = start + last[1] + LEAD + durs.get((i, last[0]), 0) + TAIL
        else:
            need_end = start + LEAD + durs.get((i, None), 0) + TAIL
        grid = 30.0 / spec['music']['bpm'] if (spec.get('music') or {}).get('bpm') else 0
        if grid and need_end > end + 1e-3: need_end = math.ceil((need_end - 1e-6) / grid) * grid   # cut on the music's half-beat
        if need_end > end + 1e-3:
            d = round(need_end - end, 3)
            for t in shots[i + 1:]: t['start'] = round(t['start'] + d, 2)
            spec['duration'] = round(spec['duration'] + d, 2)
            # stretch the shot's own last camera key so the move doesn't stall early
            cam = (s.get('params') or {}).get('cam')
            if cam and isinstance(cam[-1], list): cam[-1][0] = round(cam[-1][0] + d, 3)

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('spec'); ap.add_argument('--models', default=os.environ.get('CLOCKED_TTS_MODELS'))
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'voice'))
    ap.add_argument('--retime', action='store_true', help='rewrite the spec timing so no line is cut')
    ap.add_argument('--check', action='store_true', help='only validate captions, no audio')
    a = ap.parse_args()
    spec = json.load(open(a.spec))
    errs = check(spec)
    if errs: print('\n'.join('ERROR: ' + e for e in errs)); sys.exit(2)
    lines, _ = voiced_lines(spec)
    if a.check:
        for (i, j, st, spk, cap) in lines: print(f"{spk:8s} {cap}  ->  {speak_text(cap)}")
        print(f'{len(lines)} voiced lines OK'); return
    if not a.models: sys.exit('pass --models <dir> or set CLOCKED_TTS_MODELS')
    from kokoro_onnx import Kokoro
    import pyloudnorm
    k = Kokoro(os.path.join(a.models, 'kokoro-v1.0.onnx'), os.path.join(a.models, 'voices-v1.0.bin'))
    audio, reps = {}, {}
    for n, (i, j, st, spk, cap) in enumerate(lines):
        x, rep = synth_line(k, spk, cap, seed=n + 1)
        audio[(i, j)] = x; reps[(i, j)] = rep
    durs = {key: len(x) / SR_TTS for key, x in audio.items()}
    if a.retime:
        retime(spec, durs)
        json.dump(spec, open(a.spec, 'w'), indent=1, ensure_ascii=False); print(f"retimed {a.spec}: duration {spec['duration']} s")
    lines, _ = voiced_lines(spec)
    shots = spec['shots'] + [spec['endCard']]
    n = int(round(spec['duration'] * SR)); stems, report, cut = {}, [], 0
    for (i, j, st, spk, cap) in lines:
        x = resample(audio[(i, j)], SR_TTS, SR); t0 = st + LEAD
        end = shots[i + 1]['start'] if i + 1 < len(shots) else spec['duration']
        if j is not None and j + 1 < len(shots[i]['captions']): end = shots[i]['start'] + shots[i]['captions'][j + 1]['at']
        if t0 + len(x) / SR + TAIL > end + .02: cut += 1; print(f"WARNING: line does not fit, run with --retime: {cap}")
        i0 = int(t0 * SR); stems.setdefault(spk, np.zeros(n, np.float32))[i0:i0 + len(x)] += x[:max(0, n - i0)]
        report.append(dict(shot=i, entry=j, speaker=spk, caption=cap, spoken=reps[(i, j)]['text'], start=round(t0, 3), end=round(t0 + len(x) / SR, 3), phrases=reps[(i, j)]['phrases']))
    tmp = tempfile.mkdtemp()
    proc = {}
    for spk, x in stems.items():
        p_in, p_out = os.path.join(tmp, spk + '.wav'), os.path.join(tmp, spk + '-fx.wav')
        sf.write(p_in, x, SR); ff(p_in, p_out, CHAIN); y, _ = sf.read(p_out, dtype='float32'); proc[spk] = np.pad(y, (0, max(0, n - len(y))))[:n]
    mix = sum(proc.values())
    meter = pyloudnorm.Meter(SR); g = 10 ** ((-16.0 - meter.integrated_loudness(mix)) / 20)
    mix *= g; tp = true_peak_db(mix)
    if tp > -1.5:   # gentle limiter: soft-knee tanh only on the peaks
        lim = 10 ** (-1.7 / 20); mix = np.where(np.abs(mix) > lim * .7, np.sign(mix) * (lim * .7 + lim * .3 * np.tanh((np.abs(mix) - lim * .7) / (lim * .3))), mix).astype(np.float32)
    for spk in proc: proc[spk] *= g
    os.makedirs(a.out, exist_ok=True)
    sf.write(os.path.join(a.out, spec['id'] + '.wav'), mix, SR, subtype='PCM_16')
    hop = SR / FPS; frames = int(round(spec['duration'] * FPS)); mouth = {}
    for spk, sig in proc.items():
        env = np.array([np.sqrt(np.mean(sig[int(f * hop):int((f + 1) * hop)] ** 2)) for f in range(frames)])
        mx = float(env.max()) or 1.0
        mouth[spk] = [round(float(min(1.0, (v / mx) ** .6 * 1.25)), 3) if v > mx * .05 else 0.0 for v in env]
    lufs = meter.integrated_loudness(mix)
    json.dump(dict(fps=FPS, duration=spec['duration'], lufs=round(float(lufs), 2), true_peak_db=round(float(true_peak_db(mix)), 2), lines=report, mouth=mouth), open(os.path.join(a.out, spec['id'] + '.json'), 'w'))
    for r in report:
        fb = [p['f0_before']['std'] for p in r['phrases'] if p['f0_before']]; fa = [p['f0_after']['std'] for p in r['phrases'] if p['f0_after']]
        print(f"{r['start']:6.2f}-{r['end']:6.2f} {r['speaker']:8s} f0 std {np.mean(fb) if fb else 0:.2f}->{np.mean(fa) if fa else 0:.2f} st  {r['caption']}")
    print(f"wrote {os.path.join(a.out, spec['id'])}.wav/.json  {lufs:.1f} LUFS, true peak {true_peak_db(mix):.1f} dB, {cut} lines not fitting")
    if cut: sys.exit(3)

if __name__ == '__main__':
    main()

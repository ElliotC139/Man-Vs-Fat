"""The promo's soundtrack, synthesised from nothing.

    python3 tools/promo/audio/score.py          # writes tools/promo/out/score.wav

An original track, so there is no licence to clear before posting: 120bpm,
a warm four-chord loop (Fmaj7 - G - Am7 - Cmaj9), quiet for the title cards,
dropping into a full groove the moment the phone arrives, and resolving on
one held chord under the end card.

Timings come from ../timeline.js (run through node) and
../capture/clips/markers.json, so the
tap sounds land on the frame the finger touches the glass, the keyboard
ticks with the typing, and the shimmer follows the ring.

Needs numpy and scipy.
"""

import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

HERE = Path(__file__).resolve().parent
PROMO = HERE.parent
SR = 48000

# The schedule is computed in timeline.js; node evaluates it and hands it over.
TL = json.loads(
    subprocess.run(
        ["node", "-e", "const T = require(process.argv[1]); console.log(JSON.stringify(T))", str(PROMO / "timeline.js")],
        check=True, capture_output=True, text=True,
    ).stdout
)
BEATS = TL["beats"]
MARKERS = json.loads((PROMO / "capture" / "clips" / "markers.json").read_text())

BEAT = 60 / TL["bpm"]
BAR = BEAT * 4
DUR = TL["duration"] + 0.5
N = int(DUR * SR)
DROP = TL["drop"]
END = TL["endIn"]
DRUMS_OUT = END
# The music lifts for the last act, "It learns what you really burn", on the
# bar that beat starts in.
LIFT = next(b["start"] for b in BEATS if b["title"][0].startswith("It learns")) // BAR * BAR

rng = np.random.default_rng(7)
mix_l = np.zeros(N)
mix_r = np.zeros(N)
side = np.ones(N)  # the kick's ducking envelope, applied to the whole mix


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR * 0.45), "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def add(sig, at, gain=1.0, pan=0.0):
    """Mixes a mono signal in at time `at`, panned -1..1 (equal power)."""
    i = int(at * SR)
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: N - i]
    a = (pan + 1) * np.pi / 4
    mix_l[i : i + len(sig)] += sig * gain * np.cos(a)
    mix_r[i : i + len(sig)] += sig * gain * np.sin(a)


def env(n, a, d, s=0.0, r=0.0, hold=None):
    """ADSR in seconds over n samples; `hold` is when release starts."""
    t = np.arange(n) / SR
    hold = hold if hold is not None else n / SR - r
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip(1 - (t - hold) / max(r, 1e-4), 0, 1)
    return e * np.where(t > hold, rel, 1)


def saw(f, n, detune=0.0, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((t * f * (1 + detune) + phase) % 1) - 1


# ── The harmony ────────────────────────────────────────────────────────

CHORDS = [  # (bass root, voicing) — one per bar
    (41, [53, 57, 60, 64, 69]),  # Fmaj7
    (43, [55, 59, 62, 67, 71]),  # G
    (45, [57, 60, 64, 67, 72]),  # Am7
    (36, [55, 59, 62, 64, 67]),  # Cmaj9 (no root up top)
]


def chord_at(t):
    return CHORDS[int(t // BAR) % 4]


# ── Instruments ───────────────────────────────────────────────────────


def pad(notes, dur, gain):
    n = int((dur + 1.5) * SR)
    out = np.zeros(n)
    for m in notes:
        for d in (-0.004, 0.0, 0.0045):
            out += saw(hz(m), n, d, rng.random())
    out = lp(out, 1400) * env(n, 0.35, 10, 1.0, 1.4, hold=dur)
    return out / len(notes) * gain


def pluck(m, gain, dur=0.35, bright=4200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = 0.6 * saw(hz(m), n) + 0.4 * np.sign(np.sin(2 * np.pi * hz(m) * t))
    # A filter that snaps shut, which is what makes it a pluck: a bright and a
    # dark copy, crossfaded as it decays (no per-block filter restarts, so no
    # zipper noise).
    snap = np.exp(-t / 0.06)
    out = lp(tone, 350) * (1 - snap) + lp(tone, 350 + bright) * snap
    return out * env(n, 0.002, 0.12) * gain


def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    click = hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.6 * (body + click))


def clap():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 5000)
    e = np.zeros(n)
    for off in (0, 0.011, 0.022):
        e += (t >= off) * np.exp(-np.clip(t - off, 0, None) / (0.012 if off < 0.02 else 0.09))
    return noise * e * 0.55


def hat(open_=False):
    n = int((0.2 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 8000) * np.exp(-t / (0.07 if open_ else 0.016)) * 0.35


def sub(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    # Harmonics up to the 4th, so a phone speaker (nothing below ~150Hz)
    # still hears the bass line.
    x = np.sin(2 * np.pi * hz(m) * t) + 0.4 * np.sin(4 * np.pi * hz(m) * t) + 0.2 * np.sin(6 * np.pi * hz(m) * t)
    return np.tanh(1.6 * x) * env(n, 0.005, 10, 1.0, 0.05)


def sweep(x, centre, bands=10):
    """Noise through a band-pass whose centre moves over the sound: a bank of
    fixed bands, each faded in while the moving centre is near it."""
    n = len(x)
    u = np.arange(n) / n
    c = centre(u)
    out = np.zeros(n)
    for f in np.geomspace(c.min() * 0.8, c.max() * 1.2, bands):
        w = np.exp(-(np.log(c / f) ** 2) / (2 * 0.18**2))
        out += bp(x, f * 0.8, f * 1.25, 1) * w
    return out


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = sweep(x, lambda u: 300 + 7000 * u**2)
    return out * (t / dur) ** 2


def whoosh(dur=0.7, up=True):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    out = sweep(x, lambda u: 500 + 4500 * (u if up else 1 - u))
    e = np.sin(np.pi * np.arange(n) / n) ** 2
    return out * e


def tap_sound():
    """A soft glassy tick, like the iOS keyboard's but rounder."""
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 1850 * t) * np.exp(-t / 0.012)
    tick = hp(rng.standard_normal(n), 4000) * np.exp(-t / 0.003) * 0.4
    return tone * 0.6 + tick


def key_sound():
    n = int(0.04 * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.006) * 0.5 + np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.008) * 0.3


def shimmer(dur, notes):
    """The ring filling: a rising run of bell tones."""
    out = np.zeros(int((dur + 1.2) * SR))
    for i, m in enumerate(notes):
        n = int(1.0 * SR)
        t = np.arange(n) / SR
        f = hz(m)
        bell = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.08)) * np.exp(-t / 0.35)
        i0 = int(i * dur / len(notes) * SR)
        out[i0 : i0 + n] += bell * (0.5 + 0.5 * i / len(notes))
    return out


# ── Arrangement ───────────────────────────────────────────────────────

# Pad: from the first second to the end, one chord per bar, quieter before the drop.
bar_t = 0.0
while bar_t < DUR:
    _, voicing = chord_at(bar_t)
    g = 0.12 if bar_t < DROP else (0.2 if bar_t < END else 0.0)
    if bar_t < 2:
        g *= 0.6
    if g:
        add(pad(voicing, BAR, g), bar_t, pan=-0.25)
        add(pad([v + 12 for v in voicing[1:3]], BAR, g * 0.35), bar_t, pan=0.35)
    bar_t += BAR

# The closing chord: everything on C, held and left to ring.
add(pad([48, 55, 59, 62, 64, 67, 71], DUR - END, 0.16), END, pan=0.0)
add(sub(36, DUR - END) * env(int((DUR - END) * SR), 0.01, 1.6, 0.0), END, 0.35)

# Arpeggio: sparse eighths in the intro, sixteenths from the drop.
ARP = [0, 2, 1, 3, 2, 4, 3, 1]
t = 2.0
k = 0
while t < END:
    step = BEAT / 2 if t < DROP else BEAT / 4
    _, voicing = chord_at(t)
    m = voicing[ARP[k % 8] % len(voicing)] + 12
    lift = 1.25 if LIFT <= t < TL['phoneOut'] else 1.0
    g = (0.06 if t < 4 else 0.08) if t < DROP else 0.13 * lift
    if not (5.75 <= t < DROP):  # a breath before the drop
        add(pluck(m, g), t, pan=0.35 * np.sin(k * 0.9))
        # A quiet echo, a dotted eighth later, on the other side.
        add(pluck(m, g * 0.35, bright=1800), t + BEAT * 0.75, pan=-0.4 * np.sin(k * 0.9))
    t += step
    k += 1

# Top line from the target scene on: longer notes, an octave up.
for i, tt in enumerate(np.arange(LIFT, TL['phoneOut'], BEAT)):
    _, voicing = chord_at(tt)
    add(pluck(voicing[[4, 3, 2, 3][i % 4]] + 12, 0.06, dur=0.6, bright=5000), tt, pan=0.5)

# Drums and bass, from the drop until the end card.
t = DROP
# A breather: the drums sit out "It does the maths", where the screen holds
# still, and come back as the ring moves.
maths = next(i for i, b in enumerate(BEATS) if b["title"][0] == "It does")
BREAK = (BEATS[maths]["start"], BEATS[maths + 1]["start"])
while t < DRUMS_OUT - 1e-6:
    beat_in_bar = round((t % BAR) / BEAT) % 4
    if BREAK[0] <= t < BREAK[1]:
        add(hat(), t + BEAT / 2, 0.25, pan=0.3)
        t += BEAT
        continue
    add(kick(), t, 0.4)
    i = int(t * SR)
    dip = 1 - 0.55 * np.exp(-np.arange(min(int(BEAT * SR), N - i)) / SR / 0.11)
    side[i : i + len(dip)] = np.minimum(side[i : i + len(dip)], dip)
    if beat_in_bar in (1, 3):
        add(clap(), t, 0.5, pan=0.05)
    add(hat(open_=(beat_in_bar == 3)), t + BEAT / 2, 0.45, pan=0.3)
    add(hat(), t + BEAT / 4, 0.18, pan=-0.3)
    add(hat(), t + 3 * BEAT / 4, 0.18, pan=-0.3)
    root, _ = chord_at(t)
    # Bass on the offbeat eighths, the classic pump.
    add(sub(root, BEAT / 2 * 0.9), t + BEAT / 2, 0.2)
    t += BEAT

# A fill into the target scene.
for j, tt in enumerate(np.arange(LIFT - 1.0, LIFT, BEAT / 4)):
    add(clap() * 0.5, tt, 0.15 + 0.35 * j / 8, pan=0.1)

# Risers into the drop and into the end card.
add(riser(2.0), DROP - 2.0, 0.22)
add(riser(1.5), END - 1.5, 0.18)
# The drop itself: a low boom and a splash of noise.
boom_n = int(1.8 * SR)
tb = np.arange(boom_n) / SR
add(np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-tb / 0.08)) / SR) * np.exp(-tb / 0.6), DROP, 0.35)
add(hp(rng.standard_normal(boom_n), 3000) * np.exp(-tb / 0.5), DROP, 0.12, pan=-0.2)
add(hp(rng.standard_normal(boom_n), 3000) * np.exp(-tb / 0.5), DROP, 0.12, pan=0.2)
add(hp(rng.standard_normal(boom_n), 2000) * np.exp(-tb / 0.9), END, 0.1)

# ── Sound effects, from the footage ───────────────────────────────────

TOUCH = 0.12  # the finger lands this long after a tap is marked


def time_of(clip, frame):
    """When a frame of a recorded clip is on screen, or None if it's cut."""
    for b in BEATS:
        # A few frames of grace: a marker just before a beat's first frame
        # (the ring's data landing) plays as the beat starts.
        if b["clip"] == clip and b["from"] - 3 <= frame < b["to"]:
            return b["playAt"] + max(0, frame - b["from"]) / 60
    return None


for name, marks in MARKERS.items():
    for mk in marks:
        at = time_of(name, mk["frame"])
        if at is None:
            continue
        if mk["what"].startswith("tap"):
            add(tap_sound(), at + TOUCH, 0.22, pan=0.1)
        elif mk["what"] == "key":
            add(key_sound(), at, 0.07, pan=rng.uniform(-0.2, 0.2))
        elif mk["what"] == "estimate":
            add(whoosh(0.35, up=True), at - 0.05, 0.12)
        elif mk["what"] == "ring":
            # The first sweep is the long one, from empty.
            if name == "today":
                add(shimmer(1.4, [67, 72, 74, 76, 79, 81, 84]), at, 0.06, pan=-0.15)
            else:
                add(shimmer(0.45, [72, 76, 79, 84]), at, 0.07, pan=-0.2)

# Each new caption gets one soft bell as it arrives, so the ear knows a new
# idea has started before the eye has read it.
for i, b in enumerate(BEATS):
    add(pluck([79, 81, 84, 86][i % 4] + 12, 0.05, dur=0.8, bright=3000), b["start"], pan=0.2)

# The phone arriving and leaving.
add(whoosh(0.9, up=True), TL["phoneIn"] - 0.1, 0.18)
add(whoosh(0.8, up=False), TL["phoneOut"], 0.15)

# Each tile lands with a note, a rising run.
for i, m in enumerate([72, 74, 76, 79, 81, 84]):
    at = TL["tilesIn"] + 1.0 + (i // 2) * 0.6 + (i % 2) * 0.12  # as promo.html lays them in
    add(pluck(m + 12, 0.07, dur=0.5, bright=5000), at, pan=-0.3 + 0.12 * i)

# ── Mix ───────────────────────────────────────────────────────────────

# The sidechain pumps everything a little, so the groove breathes.
duck = 0.72 + 0.28 * side
L, R = mix_l * duck, mix_r * duck

# Room: a few short stereo delays, low-passed, for air.
def room(x, seed):
    out = np.zeros_like(x)
    r = np.random.default_rng(seed)
    for d in r.uniform(0.023, 0.09, 6):
        k = int(d * SR)
        out[k:] += x[:-k] * r.uniform(0.12, 0.2)
    return lp(out, 5000)


L, R = L + room(L, 1) * 0.6, R + room(R, 2) * 0.6

# Fade in over the first half second; fade the tail at the very end.
fade = np.ones(N)
fade[: int(0.4 * SR)] = np.linspace(0, 1, int(0.4 * SR))
tail = int(2.5 * SR)
fade[-tail:] = np.linspace(1, 0, tail) ** 1.5
L, R = L * fade, R * fade

# Loudness: a soft clip then peak-normalise to -1 dBFS. Social apps turn
# everything to about -14 LUFS anyway; this just keeps the peaks clean.
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = np.tanh(1.4 * L / peak) / np.tanh(1.4), np.tanh(1.4 * R / peak) / np.tanh(1.4)
L, R = L * 0.89, R * 0.89

out = PROMO / "out" / "score.wav"
out.parent.mkdir(exist_ok=True)
pcm = (np.stack([L, R], axis=1) * 32767).astype("<i2")
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(out, f"{DUR:.1f}s")

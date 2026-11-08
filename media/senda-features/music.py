#!/usr/bin/env python
"""Deterministic cinematic bed for the SENDA feature vignettes."""
import argparse
import math
import wave

import numpy as np

SR = 44100


def envelope(n, attack, release, sr=SR):
    a = max(1, int(attack * sr))
    r = max(1, int(release * sr))
    env = np.ones(n, dtype=np.float64)
    env[:a] = np.linspace(0.0, 1.0, a) ** 1.6
    env[-r:] *= np.linspace(1.0, 0.0, r) ** 1.8
    return env


def note(freq, t):
    return np.sin(2 * np.pi * freq * t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--duration', type=float, default=14.0)
    ap.add_argument('--out', required=True)
    ap.add_argument('--seed', type=int, default=1)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    dur = max(2.0, args.duration)
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    mix = np.zeros((n, 2), dtype=np.float64)

    # A minor / F major / C major / G major, one chord every 3.5 s.
    roots = [55.00, 43.65, 65.41, 49.00]
    chords = [
        [220.00, 261.63, 329.63],
        [174.61, 220.00, 261.63],
        [261.63, 329.63, 392.00],
        [196.00, 246.94, 293.66],
    ]
    bar = dur / 4.0
    for i in range(4):
        start = i * bar
        stop = min(dur, (i + 1) * bar)
        seg = int((stop - start) * SR)
        if seg <= 0:
            continue
        tt = np.arange(seg) / SR
        pad = np.zeros(seg)
        for j, f in enumerate(chords[i]):
            detune = 1.0 + (j - 1) * 0.0017
            pad += 0.16 * np.sin(2 * np.pi * f * detune * tt + 0.3 * j)
            pad += 0.06 * np.sin(2 * np.pi * f * 2.003 * tt)
        pad *= envelope(seg, 0.7 if i else 1.2, 0.9)
        sub = 0.24 * np.sin(2 * np.pi * roots[i] * tt) * envelope(seg, 0.4, 0.8)
        left = pad + sub * 0.9
        right = np.roll(pad, 47) + sub
        a = int(start * SR)
        b = min(n, a + seg)
        mix[a:b, 0] += left[:b - a]
        mix[a:b, 1] += right[:b - a]

    # Slow shimmer / arpeggio.
    arp = [880.0, 659.25, 987.77, 783.99, 1174.66, 987.77, 783.99, 659.25]
    step = 0.5
    k = 0
    pos = 0.0
    while pos < dur:
        f = arp[k % len(arp)]
        seg = int(min(step * 1.8, dur - pos) * SR)
        if seg > 0:
            tt = np.arange(seg) / SR
            e = np.exp(-tt * 3.2) * (1 - np.exp(-tt * 60))
            voice = 0.045 * np.sin(2 * np.pi * f * tt) * e
            voice += 0.018 * np.sin(2 * np.pi * f * 2.0 * tt) * e
            a = int(pos * SR)
            b = min(n, a + seg)
            pan = 0.5 + 0.35 * math.sin(k * 1.7)
            mix[a:b, 0] += voice[:b - a] * (1.0 - pan)
            mix[a:b, 1] += voice[:b - a] * pan
        pos += step
        k += 1

    # Soft heartbeat pulse at 72 bpm.
    beat = 60.0 / 72.0
    pos = 0.0
    while pos < dur:
        seg = int(min(0.38, dur - pos) * SR)
        if seg > 0:
            tt = np.arange(seg) / SR
            e = np.exp(-tt * 13.0) * (1 - np.exp(-tt * 120.0))
            kick = 0.14 * np.sin(2 * np.pi * 52.0 * tt) * e
            a = int(pos * SR)
            b = min(n, a + seg)
            mix[a:b, 0] += kick[:b - a]
            mix[a:b, 1] += kick[:b - a]
        pos += beat

    # Chapter whooshes.
    for at in [0.06, 4.1, 8.35, 12.3]:
        seg = int(min(1.1, dur - at) * SR)
        if seg <= 0:
            continue
        tt = np.arange(seg) / SR
        e = np.exp(-tt * 4.0) * (1 - np.exp(-tt * 30.0))
        noise = rng.normal(0, 1, seg)
        # one-pole low pass
        smooth = np.empty(seg)
        acc = 0.0
        for i in range(seg):
            acc = acc * 0.985 + noise[i] * 0.015
            smooth[i] = acc
        voice = 0.11 * smooth * e
        a = int(at * SR)
        b = min(n, a + seg)
        mix[a:b, 0] += voice[:b - a] * 0.65
        mix[a:b, 1] += voice[:b - a] * 0.35

    # Gentle stereo width and fades.
    mix[:, 1] = np.roll(mix[:, 1], 23)
    fade = envelope(n, 0.7, 1.1)
    mix *= fade[:, None]
    peak = np.max(np.abs(mix))
    if peak > 0:
        mix *= 0.72 / peak
    pcm = (np.clip(mix, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(args.out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'music {args.out} {dur:.2f}s')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Banda sonora original y determinista para la película de inversores: techno tranquilo (118 BPM).

Uso: python3 music-techno.py out.wav <duración_s> <drop_s> <cortes_s separados por comas>
Antes del «drop» solo hay atmósfera (pad + sub); después entran bombo suave, bajo, hi-hat y arpegio.
En cada corte de escena suena un barrido de ruido (whoosh) y un golpe grave. Sin muestras de terceros.
"""
import sys, wave
import numpy as np

out, dur = sys.argv[1], float(sys.argv[2])
drop = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
cuts = [float(c) for c in sys.argv[4].split(',')] if len(sys.argv) > 4 and sys.argv[4] else []
SR = 44100; n = int(SR * dur); t = np.arange(n) / SR
rng = np.random.default_rng(20261111)
BPM = 118; beat = 60 / BPM; bar = 4 * beat
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
CH = [(45, [57, 60, 64, 67]), (41, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 66])]  # Am7 Fmaj7 C G
L, R = np.zeros(n), np.zeros(n)
def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= n or i < 0: return
    m = min(len(sig), n - i); L[i:i + m] += sig[:m] * gain * (1 - pan) * 0.5 * 2 ** 0.5; R[i:i + m] += sig[:m] * gain * (1 + pan) * 0.5 * 2 ** 0.5
def env(m, a, r): e = np.ones(m); na, nr = int(a * SR), int(r * SR); e[:na] = np.linspace(0, 1, na); e[-nr:] = np.linspace(1, 0, nr); return e
# pads y sub (toda la pieza)
nb = int(np.ceil(dur / (2 * bar)))
for b in range(nb):
    root, notes = CH[b % 4]; m = int(2 * bar * SR) + int(0.8 * SR); tt = np.arange(m) / SR
    pad = sum(np.sin(2 * np.pi * hz(k) * tt + 0.3 * np.sin(2 * np.pi * 0.2 * tt + j)) + 0.4 * np.sin(2 * np.pi * hz(k) * 2.003 * tt) for j, k in enumerate(notes))
    add(pad * env(m, 1.2, 1.2), b * 2 * bar, 0.0, 0.035)
    add(np.sin(2 * np.pi * hz(root - 12) * tt) * env(m, 0.6, 0.8), b * 2 * bar, 0.0, 0.11)
# ritmo desde el drop (entra por capas)
k_m = int(0.32 * SR); kt = np.arange(k_m) / SR
kick = np.sin(2 * np.pi * (48 * kt + 70 * (1 - np.exp(-kt * 26)) / 26)) * np.exp(-kt * 11)
h_m = int(0.05 * SR); hat = rng.standard_normal(h_m) * np.exp(-np.arange(h_m) / SR * 90); hat = np.diff(hat, prepend=0)
nbeats = int(dur / beat)
for i in range(nbeats):
    tb = i * beat
    if tb < drop or tb > dur - 6: continue
    since = tb - drop
    add(kick, tb, 0.0, 0.34)
    if since > 2 * bar: add(hat, tb + beat / 2, 0.25, 0.05)
    root, notes = CH[int(tb // (2 * bar)) % 4]
    if since > 4 * bar:
        for s in (0.25, 0.75):
            m = int(0.2 * SR); tt = np.arange(m) / SR
            add(np.tanh(2.2 * np.sin(2 * np.pi * hz(root) * tt)) * np.exp(-tt * 12), tb + s * beat, 0.0, 0.085)
    if since > 8 * bar:
        for s in range(4):
            k = notes[(i * 4 + s * 3) % 4] + 12; m = int(0.22 * SR); tt = np.arange(m) / SR
            pl = np.sin(2 * np.pi * hz(k) * tt) * np.exp(-tt * 14)
            for d, g in ((0, 1.0), (0.75 * beat, 0.45), (1.5 * beat, 0.2)): add(pl, tb + s * beat / 4 + d, (-1) ** s * 0.5, 0.03 * g)
# transiciones: whoosh + golpe
for c in cuts[1:]:
    m = int(1.1 * SR); tt = np.arange(m) / SR; nz = rng.standard_normal(m); sm = np.cumsum(nz) ; sm = sm - np.convolve(sm, np.ones(400) / 400, 'same')
    e = np.exp(-((tt - 0.75) / 0.22) ** 2); add(sm / (np.abs(sm).max() + 1e-9) * e, c - 0.75, 0.0, 0.16)
    m = int(1.2 * SR); tt = np.arange(m) / SR; add(np.sin(2 * np.pi * (38 * tt + 30 * (1 - np.exp(-tt * 9)) / 9)) * np.exp(-tt * 3.2), c, 0.0, 0.3)
st = np.stack([L, R], 1)
# reverberación barata y limitación
for d, g in ((0.031, 0.25), (0.047, 0.2), (0.089, 0.14)):
    k = int(d * SR); st[k:] += st[:-k] * g
fade = np.ones(n); f = int(2.5 * SR); fade[:f] = np.linspace(0, 1, f); fade[-f:] = np.linspace(1, 0, f)
st = np.tanh(st * 1.4) * fade[:, None]; st = st / np.abs(st).max() * 0.85
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print(f'=> {out} ({dur:.1f} s, drop {drop:.1f} s, {len(cuts)} cortes)')

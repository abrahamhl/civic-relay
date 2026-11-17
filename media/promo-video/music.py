#!/usr/bin/env python3
"""Banda sonora ambiental original y determinista para el vídeo (sin muestras de terceros).

Uso: python3 music.py out/music.wav 298
Pads en La menor (Am–F–C–G), bajo suave, arpegio pulsado a 96 BPM y reverberación sintética.
"""
import sys, wave
import numpy as np

out = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
dur = float(sys.argv[2]) if len(sys.argv) > 2 else 298.0
SR = 44100
n = int(SR * dur)
t = np.arange(n) / SR
rng = np.random.default_rng(20261025)

def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)

# Progresión: cada acorde 8 compases de 4/4 a 96 BPM ≈ 10 s
BPM = 96
beat = 60 / BPM
bar = 4 * beat
chord_len = 4 * bar
CHORDS = [  # (raíz para el bajo, notas del pad, arpegio)
    (45, [57, 60, 64, 69], [69, 72, 76, 81]),  # Am
    (41, [53, 57, 60, 65], [65, 69, 72, 77]),  # F
    (48, [55, 60, 64, 67], [67, 72, 76, 79]),  # C
    (43, [55, 59, 62, 67], [67, 71, 74, 79]),  # G
]

pad = np.zeros(n)
bass = np.zeros(n)
arp = np.zeros(n)
seg = int(chord_len * SR)
xf = int(1.5 * SR)
for k in range(int(np.ceil(dur / chord_len)) + 1):
    root, notes, arpn = CHORDS[k % 4]
    a = max(0, k * seg - xf); b = min(n, (k + 1) * seg + xf)
    if a >= n:
        break
    tt = t[a:b] - t[a]
    L = b - a
    env = np.minimum(1, tt / 1.8) * np.minimum(1, (L / SR - tt) / 1.8)
    for m in notes:
        f = hz(m)
        for det in (-0.12, 0.0, 0.11):  # coro suave
            ph = rng.uniform(0, 2 * np.pi)
            w = np.sin(2 * np.pi * f * (1 + det / 100) * tt + ph)
            w += 0.28 * np.sin(2 * np.pi * 2 * f * tt + ph) + 0.08 * np.sin(2 * np.pi * 3 * f * tt)
            pad[a:b] += env * w * 0.03
    fb = hz(root - 12)
    bass[a:b] += env * (np.sin(2 * np.pi * fb * tt) + 0.2 * np.sin(2 * np.pi * 2 * fb * tt)) * 0.10
    # arpegio en corcheas
    step = beat / 2
    for j in range(int(chord_len / step)):
        s0 = k * seg + int(j * step * SR)
        if s0 >= n:
            break
        ln = min(int(1.2 * SR), n - s0)
        tl = np.arange(ln) / SR
        f = hz(arpn[(j * 3 + (j // 4)) % 4])
        vel = 0.55 + 0.45 * ((j % 4) == 0)
        arp[s0:s0 + ln] += vel * np.exp(-tl * 5.5) * (np.sin(2 * np.pi * f * tl) + 0.15 * np.sin(2 * np.pi * 2 * f * tl)) * 0.035

# Intensidad por secciones del vídeo: intro tranquila, cuerpo con arpegio, cierre amplio
def ramp(x, x0, x1):
    return np.clip((x - x0) / max(1e-6, x1 - x0), 0, 1)
arp_gain = ramp(t, 8, 16) * (1 - 0.6 * ramp(t, 180, 186) * (1 - ramp(t, 204, 212)))
mix = pad + bass * ramp(t, 4, 12) + arp * arp_gain

# Reverberación: convolución con ruido de decaimiento exponencial
ir_len = int(2.8 * SR)
ir = rng.standard_normal(ir_len) * np.exp(-np.arange(ir_len) / SR * 2.2)
ir /= np.sqrt(np.sum(ir ** 2))
N = 1 << int(np.ceil(np.log2(n + ir_len)))
wet = np.fft.irfft(np.fft.rfft(mix, N) * np.fft.rfft(ir, N), N)[:n]
y = 0.72 * mix + 0.38 * wet

# Fundidos de entrada/salida y normalización a -3 dBFS
y *= np.minimum(1, t / 3.0) * np.minimum(1, (dur - t) / 5.0)
y /= np.max(np.abs(y)) + 1e-9
y *= 0.7
left = y
right = np.roll(y, int(0.012 * SR)) * 0.97 + 0.03 * y  # leve anchura estéreo
pcm = (np.stack([left, right], 1) * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("music →", out, f"{dur:.0f}s")

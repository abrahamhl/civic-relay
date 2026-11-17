#!/usr/bin/env python3
"""Genera el doblaje (Kokoro-82M v1.0, voz ef_dora) y la línea de tiempo del vídeo.

Uso: python3 -I voice.py <modelo.onnx> <voces.npz> [salida_dir]
Salidas en salida_dir (por defecto out/):
  voice.wav       pista de voz completa, 24 kHz mono
  timeline.js     (junto a film.html) window.TIMELINE = {duration, scenes:[{id,start,end}], cues:{"s5.st1":t,...}}
  subtitles.es.srt (junto a film.html) subtítulos con los tiempos reales de cada frase
La duración de cada escena se adapta a su locución, así el vídeo nunca corta una frase.
"""
import json, sys, wave, re
from pathlib import Path
import numpy as np
from kokoro_onnx import Kokoro

here = Path(__file__).resolve().parent
model, voices = sys.argv[1], sys.argv[2]
out = Path(sys.argv[3]) if len(sys.argv) > 3 else here / "out"
out.mkdir(parents=True, exist_ok=True)
cfg = json.loads((here / "narration.json").read_text(encoding="utf-8"))

# Pronunciación: el fonemizador es español, así que los términos en inglés se escriben como suenan.
PRON = [
    (r"Civic Relay", "Sívic Riléi"),
    (r"Offline Emergency Protocol", "Óflain Imérllensi Prótocol"),
    (r"Nearby Connections", "Níarbai Conécshons"),
    (r"\bgateway\b", "géituei"),
    (r"\bAndroid\b", "Ándroid"),
    (r"\bSDK\b", "ese de ka"),
    (r"\bBluetooth\b", "Blutuz"),
    (r"\bstop\b", "estop"),
    (r"\bArnhem\b", "Árnem"),
    (r"\bmonorepo\b", "mono repo"),
]
def speakable(t):
    for a, b in PRON:
        t = re.sub(a, b, t)
    return t

SR = 24000
LEAD, GAP, TAIL = 0.7, 0.38, 1.1
k = Kokoro(model, voices)
track, scenes, cues, subs = [], [], {}, []
t = 0.0
def silence(sec):
    return np.zeros(int(sec * SR), dtype=np.float32)

for sc in cfg["scenes"]:
    start = t
    track.append(silence(LEAD)); t += LEAD
    for i, ch in enumerate(sc["chunks"]):
        if i:
            track.append(silence(GAP)); t += GAP
        audio, sr = k.create(speakable(ch["text"]), voice=cfg["voice"], speed=cfg["speed"], lang=cfg["lang"])
        assert sr == SR, sr
        audio = audio.astype(np.float32)
        if ch.get("cue"):
            cues[f'{sc["id"]}.{ch["cue"]}'] = round(t - start, 3)  # relativo al inicio de escena
        subs.append((t, t + len(audio) / SR, ch["text"]))
        track.append(audio); t += len(audio) / SR
    track.append(silence(TAIL)); t += TAIL
    scenes.append({"id": sc["id"], "start": round(start, 3), "end": round(t, 3)})
    print(f'{sc["id"]}: {t - start:5.1f}s', flush=True)

y = np.concatenate(track)
y = y / (np.max(np.abs(y)) + 1e-9) * 0.89
with wave.open(str(out / "voice.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype(np.int16).tobytes())

tl = {"duration": round(t, 3), "scenes": scenes, "cues": cues}
(here / "timeline.js").write_text("window.TIMELINE=" + json.dumps(tl, ensure_ascii=False) + ";\n", encoding="utf-8")

def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s % 1) * 1000)) % 1000:03d}"
srt = []
for i, (a, b, txt) in enumerate(subs, 1):
    srt.append(f"{i}\n{ts(a)} --> {ts(b)}\n{txt}\n")
(here / "subtitles.es.srt").write_text("\n".join(srt), encoding="utf-8")
print(f"total {t:.1f}s → {out}")

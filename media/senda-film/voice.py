#!/usr/bin/env python3
"""Doblaje de la película SENDA v5 (Kokoro-82M v1.0). <lang>_say = texto pronunciado; <lang> = subtítulo.

Uso: python3 -I voice.py <modelo.onnx> <voces.npz> <es|en> [salida_dir]
Genera en salida_dir: voice-<lang>.wav, timeline-<lang>.js y subtitles-<lang>.vtt
(para «en» también subtitles-nl.vtt con los mismos tiempos y el texto neerlandés).
Cada escena dura lo que su narración; cada frase marca un «cue» para la animación.
"""
import json, sys, wave, re, os
from pathlib import Path
import numpy as np
from kokoro_onnx import Kokoro

here = Path(__file__).resolve().parent
model, voices, lang = sys.argv[1], sys.argv[2], sys.argv[3]
out = Path(sys.argv[4]) if len(sys.argv) > 4 else here / "out"
out.mkdir(parents=True, exist_ok=True)
SCRIPT = os.environ.get("SCRIPT", "script"); PFX = "" if SCRIPT == "script" else f"{SCRIPT}-"
cfg = json.loads((here / f"{SCRIPT}.json").read_text(encoding="utf-8"))
vc = cfg["voices"][lang]
PRON = {"es": [(r"\bSENDA\b", "Senda"), (r"\bSMS\b", "ese eme ese"), (r"\bwifi\b", "uifi")],
        "en": [(r"\bSENDA\b", "Senda"), (r"\bQO-100\b", "Q O one hundred"), (r"\bCAP\b", "cap")]}[lang]
def speakable(t):
    for a, b in PRON: t = re.sub(a, b, t)
    return t

SR = 24000
LEAD, GAP, TAIL = 0.6, 0.35, 1.0
k = Kokoro(model, voices)
track, scenes, subs, t = [], [], [], 0.0
sil = lambda s: np.zeros(int(s * SR), dtype=np.float32)
for sc in cfg["scenes"]:
    start = t; track.append(sil(LEAD)); t += LEAD; cues = []
    say = sc.get(f"{lang}_say", sc[lang])  # lo que se pronuncia; sc[lang] es lo que se lee
    for i, text in enumerate(say):
        if i: track.append(sil(GAP)); t += GAP
        audio, sr = k.create(speakable(text), voice=vc["voice"], speed=vc["speed"], lang=vc["lang"])
        assert sr == SR, sr
        audio = audio.astype(np.float32)
        cues.append(round(t - start, 3))
        subs.append((t, t + len(audio) / SR, sc["id"], i))
        track.append(audio); t += len(audio) / SR
    track.append(sil(TAIL)); t += TAIL
    scenes.append({"id": sc["id"], "start": round(start, 3), "end": round(t, 3), "cues": cues})
    print(f'{lang} {sc["id"]}: {t - start:5.1f}s', flush=True)

y = np.concatenate(track); y = y / (np.max(np.abs(y)) + 1e-9) * 0.89
with wave.open(str(out / f"voice-{PFX}{lang}.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype(np.int16).tobytes())
(out / f"timeline-{PFX}{lang}.js").write_text(f"window.TIMELINE={json.dumps({'duration': round(t, 3), 'scenes': scenes})};\n", encoding="utf-8")

def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"
by = {s["id"]: s for s in cfg["scenes"]}
def vtt(sublang):
    lines = ["WEBVTT", ""]
    for n, (a, b, sid, i) in enumerate(subs, 1):
        lines += [str(n), f"{ts(a)} --> {ts(b)}", by[sid][sublang][i], ""]
    (out / f"subtitles-{PFX}{sublang}.vtt").write_text("\n".join(lines), encoding="utf-8")
vtt(lang)
if lang == "en": vtt("nl")
print(f"total {t:.1f}s → {out}")

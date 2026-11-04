#!/usr/bin/env python3
"""Narración de la película y los reels (Kokoro-82M v1.0, local, sin servicios externos).

Uso: python3 -I voice.py <modelo.onnx> <voces.bin> <es|en> [video ...]
Por vídeo y idioma genera en out/: voice-<v>-<lang>.wav, timeline-<v>-<lang>.js y <v>-<lang>.vtt.
Cada escena dura lo que su narración; cada frase marca un «cue» para la animación y los subtítulos.
"""
import json, sys, wave, re
from pathlib import Path
import numpy as np
from kokoro_onnx import Kokoro

here = Path(__file__).resolve().parent
model, voices, lang = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = json.loads((here / "scripts.json").read_text(encoding="utf-8"))
only = sys.argv[4:] or list(cfg["videos"])
out = here / "out"; out.mkdir(exist_ok=True)
vc = cfg["voices"][lang]
PRON = {"es": [(r"\bSENDA\b", "Senda"), (r"\bLoRa\b", "Lora"), (r"\bwifi\b", "uaifai"), (r"Offline first, for sure", "Óflain férst, for shur"), (r"\bbyte\b", "bait")],
        "en": [(r"\bSENDA\b", "Senda"), (r"\bLoRa\b", "Lora")]}[lang]
def speakable(t):
    for a, b in PRON: t = re.sub(a, b, t)
    return t
SR, LEAD, GAP, TAIL = 24000, 0.5, 0.35, 0.9
k = Kokoro(model, voices)
sil = lambda s: np.zeros(int(s * SR), dtype=np.float32)
def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"
for vid in only:
    track, scenes, subs, t = [], [], [], 0.0
    for sc in cfg["videos"][vid]["scenes"]:
        start = t; track.append(sil(LEAD)); t += LEAD; cues = []
        for i, text in enumerate(sc[lang]):
            if i: track.append(sil(GAP)); t += GAP
            audio, sr = k.create(speakable(text), voice=vc["voice"], speed=vc["speed"], lang=vc["lang"])
            assert sr == SR, sr
            audio = audio.astype(np.float32); cues.append(round(t - start, 3))
            subs.append((t, t + len(audio) / SR, text)); track.append(audio); t += len(audio) / SR
        track.append(sil(TAIL)); t += TAIL
        scenes.append({"id": sc["id"], "start": round(start, 3), "end": round(t, 3), "cues": cues})
    y = np.concatenate(track); y = y / (np.max(np.abs(y)) + 1e-9) * 0.89
    with wave.open(str(out / f"voice-{vid}-{lang}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype(np.int16).tobytes())
    (out / f"timeline-{vid}-{lang}.js").write_text(f"window.TIMELINE={json.dumps({'duration': round(t, 3), 'scenes': scenes, 'subs': [[round(a, 3), round(b, 3), s] for a, b, s in subs]}, ensure_ascii=False)};\n", encoding="utf-8")
    lines = ["WEBVTT", ""]
    for n, (a, b, s) in enumerate(subs, 1): lines += [str(n), f"{ts(a)} --> {ts(b)}", s, ""]
    (out / f"{vid}-{lang}.vtt").write_text("\n".join(lines), encoding="utf-8")
    print(f"{vid} {lang}: {t:.1f} s", flush=True)

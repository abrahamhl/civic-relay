#!/usr/bin/env python3
"""Genera narración con Kokoro v1.0 (ONNX, 24 kHz) + timings.json + subtítulos WebVTT.

Uso:
  python3 voice.py                 # script.json en es + en (+ nl sobre tiempos en)
  python3 voice.py ruta es         # ruta.json solo en es
  python3 voice.py m95-film en     # m95-film.json en en (+ subtítulos en, es, nl sobre tiempos en)
"""
import hashlib, json, os, pathlib, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = pathlib.Path(__file__).resolve().parent
BUILD = ROOT / "build"
BUILD.mkdir(exist_ok=True)
TTS_CACHE = BUILD / "tts-cache"
TTS_CACHE.mkdir(exist_ok=True)

MODEL_DIR = pathlib.Path(os.environ.get("KOKORO_DIR", os.path.expanduser("~/.cache/kokoro")))
SR = 24000
LEAD_IN = 0.60      # silencio al entrar en escena (s)
GAP = 0.35          # pausa entre frases de una misma escena (s)
TAIL = 1.00         # colchón al cerrar escena (s)

raw_name = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] not in ("es", "en") else "script"
NAME = pathlib.Path(raw_name).stem
ONLY_LANG = sys.argv[2] if len(sys.argv) > 2 else (sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ("es", "en") else None)
PFX = "" if NAME == "script" else f"{NAME}-"


def fmt_vtt(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t - h * 3600 - m * 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def pad(sec: float) -> np.ndarray:
    return np.zeros(int(round(sec * SR)), dtype=np.float32)


def soft_edges(wav: np.ndarray, ms: float = 12.0) -> np.ndarray:
    n = min(int(SR * ms / 1000.0), len(wav) // 4)
    if n <= 1:
        return wav
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    out = wav.copy()
    out[:n] *= ramp
    out[-n:] *= ramp[::-1]
    return out


def main():
    script_path = ROOT / f"{NAME}.json"
    if not script_path.exists():
        raise SystemExit(f"[FATAL] No existe {script_path}")
    doc = json.loads(script_path.read_text(encoding="utf-8"))
    kokoro = Kokoro(str(MODEL_DIR / "kokoro-v1.0.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))

    for lang, vcfg in doc["voices"].items():
        if ONLY_LANG and lang != ONLY_LANG:
            continue
        voice = vcfg["voice"]
        klang = vcfg["lang"]
        speed = float(vcfg.get("speed", 1.0))

        chunks = []
        timings = {"script": NAME, "lang": lang, "voice": voice, "sr": SR, "scenes": []}
        if lang == "en":
            sub_langs = ["en"]
            for extra in ("es", "nl"):
                if all(extra in sc for sc in doc["scenes"]):
                    sub_langs.append(extra)
                elif NAME.startswith(("m95-", "m96-")):
                    raise SystemExit(f"[FATAL] Falta idioma '{extra}' en alguna escena de {NAME}.json")
        else:
            sub_langs = [lang]
        vtts = {sl: ["WEBVTT", ""] for sl in sub_langs}
        cue_idx = 1
        cursor = 0.0

        for sc in doc["scenes"]:
            sid = sc["id"]
            sub_lines = sc[lang]
            say_lines = sc.get(f"{lang}_say", sub_lines)
            if len(say_lines) != len(sub_lines):
                raise SystemExit(f"{sid}: {lang}_say ({len(say_lines)}) != {lang} ({len(sub_lines)})")
            for sl in sub_langs:
                if sl not in sc or len(sc[sl]) != len(say_lines):
                    raise SystemExit(f"[FATAL] {sid}: longitud de '{sl}' no coincide con '{lang}_say'")
            sc_start = cursor
            chunks.append(pad(LEAD_IN))
            cursor += LEAD_IN
            line_spans = []

            for i, (say_txt, sub_txt) in enumerate(zip(say_lines, sub_lines)):
                ckey = hashlib.sha256(f"{voice}|{speed}|{klang}|{say_txt}".encode("utf-8")).hexdigest()[:24]
                cfile = TTS_CACHE / f"{ckey}.npy"
                if cfile.exists():
                    wav = np.load(cfile)
                else:
                    wav, _ = kokoro.create(say_txt, voice=voice, speed=speed, lang=klang)
                    wav = soft_edges(wav.astype(np.float32))
                    np.save(cfile, wav)
                dur = len(wav) / SR
                t0, t1 = cursor, cursor + dur
                chunks.append(wav)
                cursor = t1
                line_spans.append({"text": sub_txt, "start": round(t0, 3), "end": round(t1, 3)})

                for sl in sub_langs:
                    sl_lines = sc.get(sl, sub_lines)
                    sl_txt = sl_lines[i] if i < len(sl_lines) else sub_txt
                    vtts[sl].append(f"{cue_idx}")
                    vtts[sl].append(f"{fmt_vtt(t0)} --> {fmt_vtt(t1)}")
                    vtts[sl].append(sl_txt)
                    vtts[sl].append("")
                cue_idx += 1

                if i < len(say_lines) - 1:
                    chunks.append(pad(GAP))
                    cursor += GAP

            chunks.append(pad(TAIL))
            cursor += TAIL
            sc_end = cursor
            title_obj = sc.get("title", {})
            sc_title = title_obj.get(lang, title_obj.get("en", "")) if isinstance(title_obj, dict) else str(title_obj)
            timings["scenes"].append({
                "id": sid,
                "claim": sc.get("claim", "CALCULATED"),
                "title": sc_title,
                "visual": sc["visual"],
                "start": round(sc_start, 3),
                "end": round(sc_end, 3),
                "duration": round(sc_end - sc_start, 3),
                "lines": line_spans,
            })
            print(f"[{NAME}:{lang}] {sid}: {sc_start:6.2f}s -> {sc_end:6.2f}s ({sc_end - sc_start:5.2f}s)")

        full = np.concatenate(chunks)
        peak = float(np.max(np.abs(full))) or 1.0
        full = (full / peak) * 0.89  # ~ -1 dBFS pico antes de loudnorm en ffmpeg
        timings["totalDuration"] = round(len(full) / SR, 3)

        wav_path = BUILD / f"voice-{PFX}{lang}.wav"
        sf.write(str(wav_path), full, SR, subtype="PCM_16")
        (BUILD / f"timings-{PFX}{lang}.json").write_text(
            json.dumps(timings, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        for sl, lines in vtts.items():
            (BUILD / f"subtitles-{PFX}{sl}.vtt").write_text("\n".join(lines), encoding="utf-8")
        print(f"=> {wav_path.name} ({timings['totalDuration']:.1f}s) · vtt: {','.join(sub_langs)}")


if __name__ == "__main__":
    main()

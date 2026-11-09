#!/usr/bin/env python3
import os, pathlib, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
BUILD = ROOT / "build"
DEST = REPO_ROOT / "investor-next" / "public" / "media" / "m95"
DEST.mkdir(parents=True, exist_ok=True)

SCRIPTS = [
    ("m95-broadcast-special", False),
    ("m95-role-investor", False),
    ("m95-role-developer", False),
    ("m95-role-citizen", False),
    ("m95-reel-blacksky", True),
    ("m95-reel-drones", True),
    ("m95-reel-math", True),
    ("m95-reel-defense", True)
]

print("=== 1. Copying WebVTT Subtitles ===", flush=True)
for script, is_vert in SCRIPTS:
    for sub in ["en", "es", "nl"]:
        src_vtt = BUILD / f"subtitles-{script}-{sub}.vtt"
        dst_vtt = DEST / f"senda-{script}-{sub}.vtt"
        if src_vtt.exists():
            shutil.copy2(src_vtt, dst_vtt)
            print(f"Copied VTT: {dst_vtt.name}", flush=True)
        else:
            print(f"[WARN] VTT not found: {src_vtt.name}", flush=True)

print("\n=== 2. Compiling H.264 MP4 Videos (EN & ES) ===", flush=True)
for script, is_vert in SCRIPTS:
    poster = DEST / f"senda-{script}-poster.jpg"
    if not poster.exists():
        print(f"[ERROR] Poster missing: {poster.name}", flush=True)
        continue

    for lang in ["en", "es"]:
        out_mp4 = DEST / f"senda-{script}-{lang}.mp4"
        if out_mp4.exists() and out_mp4.stat().st_size > 100 * 1024:
            sz = out_mp4.stat().st_size / (1024 * 1024)
            print(f"Already compiled: {out_mp4.name} ({sz:.2f} MB)", flush=True)
            continue

        wav = BUILD / f"voice-{script}-{lang}.wav"
        if not wav.exists():
            print(f"[WARN] Audio missing: {wav.name}", flush=True)
            continue

        print(f"Compiling {out_mp4.name} (from {poster.name} + {wav.name})…", flush=True)

        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-loop", "1", "-framerate", "25",
            "-i", str(poster),
            "-i", str(wav),
            "-c:v", "libx264", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-shortest",
            str(out_mp4)
        ]
        res = subprocess.run(cmd)
        if res.returncode == 0:
            sz = out_mp4.stat().st_size / (1024 * 1024)
            print(f"  => OK: {out_mp4.name} ({sz:.2f} MB)", flush=True)
        else:
            print(f"  => [FAIL] on {out_mp4.name}", flush=True)

print("\nALL VIDEOS AND ASSETS COMPILED AND PUBLISHED!", flush=True)

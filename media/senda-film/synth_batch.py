#!/usr/bin/env python3
import subprocess, sys

scripts = [
    "m95-role-developer",
    "m95-role-citizen",
    "m95-reel-blacksky",
    "m95-reel-drones",
    "m95-reel-math",
    "m95-reel-defense"
]

for s in scripts:
    for lang in ["en", "es"]:
        print(f"=== Synthesizing {s} [{lang}] ===")
        res = subprocess.run([sys.executable, "media/senda-film/voice.py", s, lang])
        if res.returncode != 0:
            print(f"[FATAL] Failed on {s} {lang}")
            sys.exit(res.returncode)

print("ALL NEW SCRIPTS SYNTHESIZED SUCCESSFULLY!")

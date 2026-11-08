# SENDA · M95 Presentation Video Suite Release (`senda-m95-video-2026-11`)

- **Date:** 2026-11-08
- **Branch:** `mission/senda-corridor-fabric-20261108`
- **Base Commit:** `8becb7c6ceea1e1f8112ccdd76c408f9cc594eb2`
- **Canonical Spec:** [`docs/handoff/08_ANTIGRAVITY_VIDEO_HANDOFF.md`](file:///c:/Users/2fabr/civic-relay/docs/handoff/08_ANTIGRAVITY_VIDEO_HANDOFF.md)
- **Sources & Epistemic Register:** [`docs/video/M95_VIDEO_SOURCES.md`](file:///c:/Users/2fabr/civic-relay/docs/video/M95_VIDEO_SOURCES.md)
- **Evidence Package:** [`evidence/video/m95/`](file:///c:/Users/2fabr/civic-relay/evidence/video/m95/release.json)

## 1. Published Assets (`investor-next/public/media/m95/`)

All 53 files (`15` MP4 videos, `36` WebVTT subtitle tracks in `es`/`en`/`nl`, and `2` `1920×1080` posters) are published in `investor-next/public/media/m95/` without overwriting the archived v5 assets (`senda-film-*`, `senda-ruta-*`).

| Deliverable | Master MP4 | Resolution & FPS | Duration | Subtitles (`.vtt`) | Poster / Variants |
|---|---|---|---|---|---|
| **V1 · Main Film** | `senda-m95-film-en.mp4` | `1920×1080` @ `25 fps` | `530.12 s` (22 scenes `s1`…`s13` + `s12b`) | `es`, `en`, `nl` | `senda-m95-film-poster.jpg` |
| **V2 · Protective Route** | `senda-m95-ruta-en.mp4` | `1920×1080` @ `25 fps` | `218.28 s` (12 scenes `r0`…`r11`) | `es`, `en`, `nl` | `senda-m95-ruta-poster.jpg` |
| **V3 · 90s Cut** | `senda-m95-90s-en.mp4` | `1920×1080` @ `25 fps` | `92.24 s` (`s1,s2,s3b,s9,s13`) | `es`, `en`, `nl` | — |
| **V3 · 60s Cut** | `senda-m95-60s-en.mp4` | `1920×1080` @ `25 fps` | `62.48 s` (`s1,s4,s9,s13`) | `es`, `en`, `nl` | — |
| **V3 · 30s Cut** | `senda-m95-30s-en.mp4` | `1920×1080` @ `25 fps` | `33.70 s` (`s1,s12b,s13`) | `es`, `en`, `nl` | — |
| **V4 · Vertical 9:16** | `senda-m95-vertical-45s-en.mp4` | `1080×1920` @ `25 fps` | `42.80 s` (`s1,s3b,s13`) | `es`, `en`, `nl` | Burned-in: `-sub-en.mp4`, `-sub-es.mp4`, `-sub-nl.mp4` |
| **V5 · Sim 1 (Braking)** | `senda-m95-sim-braking-en.mp4` | `1920×1080` @ `25 fps` | `24.48 s` (`r1`) | `es`, `en`, `nl` | — |
| **V5 · Sim 2 (SOS DTN)** | `senda-m95-sim-sos-en.mp4` | `1920×1080` @ `25 fps` | `22.16 s` (`r2`) | `es`, `en`, `nl` | — |
| **V5 · Sim 3 (Wrong-way)** | `senda-m95-sim-wrongway-en.mp4` | `1920×1080` @ `25 fps` | `16.36 s` (`r5`) | `es`, `en`, `nl` | — |
| **V5 · Sim 4 (Queue LWR)** | `senda-m95-sim-queue-en.mp4` | `1920×1080` @ `25 fps` | `19.30 s` (`r6`) | `es`, `en`, `nl` | — |
| **V5 · Sim 5 (Visibility)** | `senda-m95-sim-visibility-en.mp4` | `1920×1080` @ `25 fps` | `18.96 s` (`r7`) | `es`, `en`, `nl` | — |
| **V5 · Sim 6 (PCI Proof)** | `senda-m95-sim-proof-en.mp4` | `1920×1080` @ `25 fps` | `27.64 s` (`s12b`) | `es`, `en`, `nl` | — |

## 2. Pipeline & Stage Enhancements

- **Stage (`media/senda-film/film.html` + `media/senda-film/sims.js`):**
  - Full-bleed Three.js r158 3D scenes (`drone3d` and `arch3d`) with live `.hud` overlays, deterministic `window.seek(t)` at `25 fps`, and `1.5x` retina scaling (`1920×1080` horizontal and `1080×1920` vertical).
  - Explicit epistemic claim badges (`OBSERVED · VERIFIED EVIDENCE`, `COMPUTED FROM THE APP CORE`, `SIMULATION · COMPUTED FROM THE APP CORE`) and simulation badges (`SIMULATION · SYNTHETIC TRAFFIC`, `INVENTED ROAD · DEMO`, `SIMULATION · PAS PROTOCOL`, `SIMULATION · DGT COUNTING LOOPS`).
  - Scene `s12b` (*The proof you can inspect*) added with verified counts (`266` core tests, `13` PCI custody tests, `0` external audits completed) and copyright notice `© 2026 Abraham Haddioui · SENDA · MIT License · 112 first` on `s13` / `r11`.
  - Complete English internationalization for `?film=1&lang=en` across `carretera.html`, `camaras.html`, `paises.html`, `dgt.html`, and `kit.mjs`.
  - English-only diagram system for `s3`–`s10` (`offline`, `fragments`, `sataccess`, `blackout`, `railtime`, `floors`, `fusion`, `railwatch`, `fire`, `trust`, `easy`), replacing static Spanish app captures in the English master while keeping `s5b` on the fully English `/senda/ojo` capture.
- **Voice & Subtitles (`media/senda-film/voice.py` + `media/senda-film/check-vtt.mjs`):**
  - British English narration (`bf_emma` at `0.95x`, `kokoro-onnx==0.6.1`) generating simultaneous `es`, `en`, and `nl` `.vtt` tracks from the exact English sentence timings (`sc[lang]`, never `en_say`).
  - Procedural ambient soundtrack (`media/promo-video/music.py`) ducked via `sidechaincompress` and normalized to `-16 LUFS` / `-1.5 dBTP`.

## 3. Open Blockers & Operational Boundaries (§ 12)

1. **`SECURITY.txt` (`BLOCKED`):** Contains placeholder `security@civic-relay.example.com`; requires a real founder-controlled mailbox before making any public "protected" claim.
2. **Dutch Native Review (`REVIEW_REQUIRED`):** Standard Dutch subtitles pass all technical and glossary checks (`36/36`), pending native speaker review before claiming native-verified status.
3. **Remote Vercel Deployment (`BLOCKED_EXTERNAL`):** Local static export (`investor-next/out`) and Chromium verification passed (`0` console errors); remote preview/production deployment awaits `VERCEL_TOKEN` / founder confirmation.

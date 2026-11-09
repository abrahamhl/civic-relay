# SENDA M95 · QA & Acceptance Report (§ 10)

- **Release ID:** `senda-m95-video-2026-11`
- **Date:** 2026-11-08
- **Branch:** `mission/senda-corridor-fabric-20261108`
- **Base Commit:** `8becb7c6ceea1e1f8112ccdd76c408f9cc594eb2`

## 1. Mandatory Gates (§ 10.1)

### Gate 1 · Content (`PASS`)
- [x] Every number spoken or shown on screen has an explicit source and epistemic classification (`OBSERVED`, `CALCULATED`, `SIMULATED`) in [`docs/video/M95_VIDEO_SOURCES.md`](file:///c:/Users/2fabr/civic-relay/docs/video/M95_VIDEO_SOURCES.md).
- [x] Every simulation carries an on-screen badge (`SIMULATION · COMPUTED FROM THE APP CORE`, `SIMULATION · SYNTHETIC TRAFFIC`, `INVENTED ROAD · DEMO`, `SIMULATION · PAS PROTOCOL`, `SIMULATION · DGT COUNTING LOOPS`).
- [x] Zero promises of replacing `112`, certification, field validation, or external security audit (`s12` and `s12b` explicitly show `0 external audits completed` and list field pilots, independent security audit, and public-procurement certification as pending).
- [x] English master script (`m95-film.json`, 22 scenes including `s12b`; `m95-ruta.json`, 12 scenes) locked and validated via `media/senda-film/validate.mjs`.

### Gate 2 · Voice (`PASS`)
- [x] Synthesized with `kokoro-onnx==0.6.1`, voice `bf_emma` (`en-gb`), speed `0.95`, sentence pause `350 ms`.
- [x] Procedural ambient soundtrack (`media/promo-video/music.py`) ducked via `sidechaincompress` and normalized with `loudnorm=I=-16:TP=-1.5:LRA=11`, AAC-LC `192 kbps`, `48 kHz`, stereo.
- [x] Phonetic overrides in `en_say` verified (`Senda`, `D G T`, `one one two`, `DATEX two`, `Q O one hundred`, `LOR-ah`, `P C I`, `D T N`, `kilometres an hour`, `metres per second squared`).

### Gate 3 · Subtitles (`PASS_WITH_NL_REVIEW_REQUIRED`)
- [x] 36 `.vtt` files (`12` video pieces × `3` languages: `es`, `en`, `nl`) published in `investor-next/public/media/m95/`.
- [x] Automated check (`node media/senda-film/check-vtt.mjs`): `36/36` pass (`WEBVTT` header, monotonic non-overlapping timestamps, duration `0.80 s – 7.00 s`, `<= 2` lines, `<= 42` chars/line, zero `_say` phonetics).
- [x] Dutch (`nl`) review status explicitly declared as `REVIEW_REQUIRED` in [`evidence/video/m95/subtitles-review.md`](file:///c:/Users/2fabr/civic-relay/evidence/video/m95/subtitles-review.md).

### Gate 4 · Image (`PASS`)
- [x] Horizontal masters and simulations (`11` pieces): `1920×1080`, `25 fps`, H.264 High (`avc1.640028`), `yuv420p` (TV range), `+faststart`.
- [x] Vertical 9:16 cuts (`4` files: clean + burned-in `en`/`es`/`nl`): `1080×1920`, `25 fps`, H.264 High, `yuv420p`, `+faststart`.
- [x] Control stills extracted and inspected at `5s, 8s, 40s, 90s, 111s, 137s, 150s, 188s, 213s, 234s, 255s, 291s, 318s, 342s, 362s, 377s, 395s, 430s, 475s, 500s, 520s` (`film`) and `8s, 35s, 60s, 82s, 98s, 115s, 132s, 148s, 165s, 185s, 204s, 215s` (`ruta`) in `evidence/video/m95/screenshots/`.
- [x] 100% English canvas labels on all interactive simulations in the English master (`0` Spanish leaks in `carretera.html`, `camaras.html`, `paises.html`, `dgt.html`, `sims.js`).
- [x] English-only diagrams for `s3`–`s10` (offline, fragments, sataccess, blackout, railtime, floors, fusion, railwatch, fire, trust, easy); static Spanish app captures removed from the English master, `s5b` keeps the English `/senda/ojo` capture. Blackout, railwatch and wildfire SVGs verified after scoping the hub-only `svg` positioning rule.

### Gate 5 · Web (`PASS` local export / `BLOCKED_EXTERNAL` remote Vercel deploy)
- [x] `/`, `/es`, `/nl` build and render cleanly (`14/14` static pages in `investor-next/out`, `6/6` `check:locales`, `107/107` `investor-next/tests/*.test.mjs`).
- [x] `<video id="senda-m95-film-video">` and `<video id="senda-m95-ruta-video">` expose `es`, `en`, `nl` `<track>` elements with locale-matched `default`, `preload="metadata"`, legible `1920×1080` posters, and visible caption `English narration · Subtítulos: Español · English · Nederlands`.
- [x] HTTP `206 Partial Content` Range requests and `Content-Type: text/vtt` verified in Chromium (`0` console errors across `/`, `/es`, `/nl`, `/senda/carretera.html`, `/senda/arquitectura.html`).

### Gate 6 · Security (`PASS` headers & hashes / `BLOCKED` `SECURITY.txt` mailbox)
- [x] Security headers (§ 8.4) and `/media/m95/(.*)` caching headers declared in [`investor-next/vercel.json`](file:///c:/Users/2fabr/civic-relay/investor-next/vercel.json).
- [x] `SHA256SUMS.txt` generated for all 53 files in `investor-next/public/media/m95/`.
- [ ] `SECURITY.txt` still contains placeholder `security@civic-relay.example.com` — marked `BLOCKED` per § 9.4 / § 12; no public claim of "protected" is made.

### Gate 7 · Legal (`PASS`)
- [x] `LICENSE` (MIT) untouched.
- [x] [`NOTICE`](file:///c:/Users/2fabr/civic-relay/NOTICE) created documenting `kokoro-onnx` v0.6.1 (`bf_emma`), `music.py`, Three.js r158, and public domain satellite/road reference data.
- [x] Zero non-commercial datasets (no God's Eye View data), zero faces, zero number plates, zero personal data.
- [x] Copyright `© 2026 Abraham Haddioui · SENDA · MIT License · 112 first` visible on closing frames (`s13`, `r11`).

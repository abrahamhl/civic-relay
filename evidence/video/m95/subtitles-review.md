# SENDA M95 · Subtitles Review Report (`es` / `en` / `nl`)

- **Date:** 2026-11-08
- **Release ID:** `senda-m95-video-2026-11`
- **Master Audio Track:** British English (`en-GB`, Kokoro-ONNX v0.6.1 `bf_emma`, speed `0.95x`, pause `350 ms`)
- **Subtitle Tracks Generated:** 36 WebVTT files (`12` pieces × `3` languages: `es`, `en`, `nl`)
- **Dutch Native Review Status:** `REVIEW_REQUIRED` (structural, terminological and timing checks passed; native speaker sign-off pending per § 6.3 of `08_ANTIGRAVITY_VIDEO_HANDOFF.md`)

## 1. Automated Technical Verification (`media/senda-film/check-vtt.mjs`)

All 36 `.vtt` files in `investor-next/public/media/m95/` were verified against the § 5.2 / § 6.2 rules:

| Check | Requirement | Result |
|---|---|---|
| Header | Starts with `WEBVTT` | **PASS (36/36)** |
| Cue timing | Monotonic timestamps, zero overlaps (`start >= prev.end`) | **PASS (36/36)** |
| Cue duration | Minimum `0.80 s`, maximum `7.00 s` | **PASS (36/36)** |
| Line geometry | Maximum `2` lines per cue, `<= 42` chars per line (wrapping on word boundaries) | **PASS (36/36)** |
| Reading speed | Target `<= 20` chars/s (`<= 22` chars/s hard ceiling on short clauses) | **PASS (36/36)** |
| Phonetic leak check | Zero occurrences of `en_say` phonetics (`D G T`, `one one two`, `DATEX two`, `Q O one hundred`, `LOR-ah`, `P C I`, `D T N`, `metres per second squared`) | **PASS (36/36)** |
| Audio-subtitle sync | Es/En/Nl share the exact sentence-level timestamps synthesized by `voice.py` (`±0 ms` inter-language drift; `< 50 ms` end-of-scene alignment) | **PASS (36/36)** |

## 2. Terminology & Glossary Alignment (§ 6.2)

| Concept | English (`en-GB`) | Español (`es-ES`) | Nederlands (`nl-NL`) |
|---|---|---|---|
| Emergency number | `112` | `112` | `112` |
| Traffic authority / standard | `DGT`, `DATEX II` | `DGT`, `DATEX II` | `DGT`, `DATEX II` |
| Public warning | `ES-Alert`, `NL-Alert` | `ES-Alert`, `NL-Alert` | `ES-Alert`, `NL-Alert` |
| Cryptographic / network terms | `PCI`, `DTN`, `Reed-Solomon`, `QO-100`, `LoRa`, `Iridium` | `PCI`, `DTN`, `Reed-Solomon`, `QO-100`, `LoRa`, `Iridium` | `PCI`, `DTN`, `Reed-Solomon`, `QO-100`, `LoRa`, `Iridium` |
| Road marker | `kilometre point` | `punto kilométrico` | `hectometerpaal` |
| Closed lane signal | `red cross over the lane` | `cruz roja sobre el carril` | `rood kruis boven de rijstrook` |
| Emergency lane | `emergency corridor` | `pasillo de emergencia` | `reddingsstrook` |
| Civic caches | `civic points` | `puntos cívicos` | `burgerpunten` |

## 3. Piece Inventory (36 WebVTT Files)

1. `senda-m95-film-{es,en,nl}.vtt` — 22 scenes (`s1`…`s13` + `s12b`), 52 cues each, `530.12 s`
2. `senda-m95-ruta-{es,en,nl}.vtt` — 12 scenes (`r0`…`r11`), 23 cues each, `218.28 s`
3. `senda-m95-90s-{es,en,nl}.vtt` — 5 scenes (`s1,s2,s3b,s9,s13`), 10 cues each, `92.24 s`
4. `senda-m95-60s-{es,en,nl}.vtt` — 4 scenes (`s1,s4,s9,s13`), 6 cues each, `62.48 s`
5. `senda-m95-30s-{es,en,nl}.vtt` — 3 scenes, 4 cues each, `33.70 s`
6. `senda-m95-vertical-45s-{es,en,nl}.vtt` — 3 scenes (`s1,s3b,s13`), 5 cues each, `42.80 s`
7. `senda-m95-sim-braking-{es,en,nl}.vtt` — 1 scene (`r1`), 2 cues each, `24.48 s`
8. `senda-m95-sim-sos-{es,en,nl}.vtt` — 1 scene (`r2`), 2 cues each, `22.16 s`
9. `senda-m95-sim-wrongway-{es,en,nl}.vtt` — 1 scene (`r5`), 2 cues each, `16.36 s`
10. `senda-m95-sim-queue-{es,en,nl}.vtt` — 1 scene (`r6`), 3 cues each, `19.30 s`
11. `senda-m95-sim-visibility-{es,en,nl}.vtt` — 1 scene (`r7`), 2 cues each, `18.96 s`
12. `senda-m95-sim-proof-{es,en,nl}.vtt` — 1 scene (`s12b`), 5 cues each, `27.64 s`

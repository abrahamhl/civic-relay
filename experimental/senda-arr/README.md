# SENDA Adaptive Resilience Routing (ARR) — research sandbox

**Model only.** No radio is transmitted or measured. A planned route never demonstrates delivery.
Zero dependencies; Node ≥ 22. Builds on `experimental/senda-route-truth` (PR #34 → #38).

| Path | What it is |
|---|---|
| `src/arr-core.mjs` | Fail-closed temporal contact graph, hazard-ensemble reliability (exact inclusion–exclusion), greedy replica selection, risk bounds |
| `src/arr-sim.mjs` | Seeded scenarios, truth simulator, baselines (CGR earliest, CGR k-exclusion, top-k, independence ablation, epidemic, spray-and-wait), statistics |
| `data/geomac-2018-*.json` | OBSERVED fire perimeters (USGS GeoMAC via NIFC Open Data) with provenance and SHA-256 |
| `experiments/fetch-geomac-perimeters.mjs` | Reproducible ingest of the snapshots above |
| `experiments/run-experiment.mjs` | Pre-registered experiment H-ARR-1 (`--quick` for a smoke run) |
| `src/arr-forecast.mjs` | Fire-front arrival forecast with particle assimilation (H2 — rejected: worse than persistence) |
| `experiments/run-forecast-experiment.mjs` | Pre-registered H2 experiment → `results/FORECAST_RESULTS.md` |
| `experiments/make-report.mjs` | `results.json` → `results/RESULTS.md` + SVG charts |
| `tests/` | Unit, invariant, adversarial and differential tests |
| `viewer/index.html` | Interactive prototype running the same engine in the browser |

```bash
node --test experimental/senda-arr/tests/*.test.mjs
node experimental/senda-arr/experiments/run-experiment.mjs      # ≈ 25 min on one core
node experimental/senda-arr/experiments/make-report.mjs
cd experimental/senda-arr && python3 -m http.server 8765         # then open /viewer/index.html
```

Results and verdict: `results/RESULTS.md`. Hypotheses, limits and roadmap:
`docs/research/SENDA_ARR_HYPOTHESIS_REGISTER_20261117.md`, `docs/research/SENDA_SCIENTIFIC_ARCHITECTURE_20261117.md`.

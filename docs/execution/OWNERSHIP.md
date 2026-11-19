# Ownership

Twelve subagents installed in `.opencode/agents/`. Each owns a domain and must
refuse work outside it rather than guess.

| Agent | Owns | Vertical-slice touchpoints |
| --- | --- | --- |
| `senda-camera-vision` | Camera-derived counts, FOV, calibration honesty | `CameraIntelligence`, `adapter.mjs` camera mapping |
| `senda-data-forensics` | Provenance, SHA binding, evidence tables | `scripts/sync-evidence.mjs`, `EvidenceView`, `manifest.json` |
| `senda-desktop` | Tauri shell, capabilities, packaging | `src-tauri/*` |
| `senda-fire-science` | Fire behaviour, hindsight replay framing | `TimelineBar`, `types.ts` namespaces |
| `senda-geospatial-3d` | Map projection, 3D twin | `lib/geo.ts`, `Map2D`, `Scene3D` |
| `senda-integrator` | Cross-cut integration, build wiring | `App.tsx`, `bundle.ts`, `package.json` |
| `senda-media-integration` | Offline media, imagery handling | snapshot media policy |
| `senda-performance` | Bundle budget, lazy loading | lazy `Scene3D`, build sizes |
| `senda-regulatory-funding` | Rights, funding claims | `SourceRecord.rights`, `provenance` |
| `senda-rf-rescue` | RF/life-signal honesty | `RfLab` fail-closed statuses |
| `senda-security` | Threat model, least privilege | CSP, capability allowlist, path confinement |
| `senda-ux` | Commander-grade interface, accessibility | `styles.css`, layout, keyboard targets |

## Rules

- One owner per file. Cross-domain changes require the integrator to mediate.
- Any agent that cannot verify a claim returns `MISSING_DATA`, not a guess.
- A UI claim about a source is only allowed if the source registry backs it.
- Security owns the final veto on anything that adds a capability or network
  origin.

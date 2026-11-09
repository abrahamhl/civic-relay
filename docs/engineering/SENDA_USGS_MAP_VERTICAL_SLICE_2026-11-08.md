# SENDA LIVE — USGS Earthquake Observations Map (research integration)

**Scope:** branch \`feat/senda-usgs-map-evidence-20261108\` based on \`feat/senda-social-live-20261108\` (PR #25). Not deployed to the canonical investor site by this change.

## What is implemented

1. **Public upstream only:** the backend requests the fixed USGS M4.5+ past-week GeoJSON feed; no user URL is accepted.
2. **Source-aware normalization:** each earthquake retains observed timestamp, source event URL, magnitude, WGS84 coordinates, optional depth, and dataset identity. Event IDs are namespaced \`usgs:\`.
3. **Fail-closed acquisition:** 1.5 MB response cap, 1,200 input feature cap, 200 displayed observations, 6s timeout, strict feature/timestamp/geometry checks, one-minute acquisition cache and 6-hour maximum stale server cache.
4. **Transparent read-only API:** \`GET /api/sources/usgs-earthquakes\` returns \`SOURCE_SNAPSHOT\`, \`CACHED_SNAPSHOT\`, \`STALE_SNAPSHOT\` or 503 \`UNAVAILABLE\`; reports are \`HISTORICAL_OBSERVATION\` and explicitly \`isOfficialAlert:false\`.
5. **Opt-in Leaflet layer:** show or hide USGS observations, inspect each observation and open its original USGS event. The UI states the snapshot status and provenance.
6. **Stored-XSS mitigation:** citizen-provided event titles and locations are placed in DOM elements via \`textContent\` instead of \`innerHTML\` in map popups.
7. **OSM service hygiene:** the interactive tile URL uses the currently recommended \`tile.openstreetmap.org\` endpoint. No tile bulk download or offline map claim.

## Testing

- \`node --test apps/senda-live/tests/usgs-earthquakes.test.mjs\` — deterministic fixture tests for provenance, reject rules, cache, concurrent requests, source outage and oversized responses.
- \`node --test apps/senda-live/tests/http.test.mjs\` — source endpoint tested with injected **synthetic fixture** so CI does not depend on live USGS availability.
- \`corepack pnpm --filter @senda/live type-check\`
- \`corepack pnpm --filter @senda/live build\`
- \`corepack pnpm --filter @senda/live test\`
- GitHub Actions: \`.github/workflows/senda-live-usgs-map.yml\` runs these checks on this branch and PRs.

## Evidence and boundaries

USGS documentation: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

USGS feed: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson

The endpoint was independently verified as a public machine-readable feed. Successful **local fixture tests** are not a field test, a validated forecast, an earthquake early-warning system or a live deployed integration. USGS reported catalog events are not official SENDA emergency alerts.

- The upstream report may be updated after initial publication.
- The server cache is in-memory and is lost on restart.
- When offline, the browser map base layer is not guaranteed available; the public OSM raster tile service explicitly forbids prefetch/offline download.
- No offline-first background sync, own geospatial archive or authoritative emergency alert integration is claimed by this PR.
- The validation stage is \`SOURCE_INTEGRATION_READY_FOR_REVIEW\`; post-merge end-to-end runtime and deployment verification remain necessary.

## Next integration

1. Establish browser-facing end-to-end tests with Playwright and source fixtures.
2. Introduce a versioned shared source/evidence contract for weather, wildfire, hydrology and traffic in the existing scientific engines.
3. Provide an explicit offline tile provider/package format and verified reuse rules.
4. Connect historical USGS observations to the scientific validation dashboard as **labels**, never as data that would leak future information into past inference.

## Security follow-up

Audit every remaining Leaflet popup and third-party metadata rendering path for untrusted HTML injection. Run dependency security checks and review event/map permissions independently before public production deployment.

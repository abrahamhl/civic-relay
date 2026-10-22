# Sector Intelligence & Camera Coordination Architecture

**Date:** 2026-10-22  
**Engine Implementation:** [`investor-next/lib/sector-camera-engine.mjs`](../../investor-next/lib/sector-camera-engine.mjs)  
**Type Definitions:** [`investor-next/lib/sector-camera-engine.d.mts`](../../investor-next/lib/sector-camera-engine.d.mts)  
**UI Console:** [`investor-next/app/sector-intelligence-console.tsx`](../../investor-next/app/sector-intelligence-console.tsx)  
**Test Suite:** [`investor-next/tests/sector-and-globe-mission.test.mjs`](../../investor-next/tests/sector-and-globe-mission.test.mjs)

---

## 1. Purpose & Alignment with Founder Vision

In `audio/vision_original_2026-10-22.ogg` (`00:54 – 01:49`), the founder described selecting a geographic sector during an emergency (specifically citing the **El Tiemblo wildfire in Ávila, Spain** alongside urban flood and European corridors) to inspect local situational context and available traffic/environmental cameras alongside OEP's store-and-forward alert pipeline.

This architecture implements that capability **honestly and safely**:
1. It distinguishes **verified public open-data traffic camera catalogs** (`PUBLIC_CATALOG_VERIFIED`) from **synthetic emergency simulation cameras** (`SYNTHETIC`) and **unconfigured grid slots** (`NO_SIGNAL`).
2. It enforces **strict security and privacy boundaries**: anti-SSRF URL validation, RBAC fail-closed access control, mandatory privacy mosaic filtering, and a hard prohibition on biometric identification or license plate recognition (LPR).
3. It renders **uncalibrated 2D/2.5D FOV cones** (`computeCameraFovPolygon()`) explicitly labeled as geometric estimates (`isCalibrated: false`) rather than claiming photogrammetric precision.

---

## 2. Geographic Sector & Camera Data Schemas

### 2.1 `Sector` Schema (`SECTOR_CATALOG`)
Each sector in `SECTOR_CATALOG` (`investor-next/lib/sector-camera-engine.mjs`) defines:
- `id`: Canonical identifier (`SECTOR-AVILA-TIEMBLO`, `SECTOR-VLC-TURIA`, `SECTOR-NL-ARNHEM`).
- `countryCode` / `continent`: Geographic hierarchy keys (`ES` / `NL`, `EUROPE`).
- `name`: Localized titles (`en`, `es`, `nl`).
- `crisisType`: `'WILDFIRE_RURAL_PARTITION' | 'FLASH_FLOOD_URBAN' | 'GRID_BLACKOUT_CORRIDOR'`.
- `linkedScenarioId`: Deterministic link to `virtual-scenarios.mjs` (`RURAL_WILDFIRE_PARTITION`, `COASTAL_FLOOD_MESH`, `URBAN_BLACKOUT_72H`).
- `center` & `bounds`: WGS84 coordinates (`lat`, `lon`, `defaultZoom`) and polygon `perimeter` ring.
- `weatherAndEnvironment`: Contextual telemetry (`windSpeedKmh`, `windDirectionDeg`, `temperatureC`, `visibilityKm`, `airQualityIndex`, `sourceLabel`, `verificationBadge`).
- `cameras`: Array of `CameraSource` descriptors.

### 2.2 `CameraSource` Schema
| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique camera identifier (e.g., `CAM-AV-N403-KM82`, `CAM-VLC-V30-TURIA`, `CAM-NL-A12-ARNHEM`). |
| `sectorId` | `string` | Parent sector ID. |
| `label` | `{ en, es, nl }` | Localized human-readable station name. |
| `operator` | `string` | Responsible agency or simulation source (e.g., `DGT España (Catálogo Abierto NAP / DATEX II)`, `Rijkswaterstaat Verkeersinfo (Open Data NL)`, `OEP Synthetic Crisis Simulator`). |
| `license` | `string` | Open-data license or synthetic notice (`DGT Open Data / RISP España — Atribución obligatoria`, `CC0 / Open Data Rijkswaterstaat Nederland`, `MIT / Synthetic Telemetry`). |
| `coordinates` | `{ lat, lon, elevationM }` | Physical or simulated mounting coordinates. |
| `fov` | `{ azimuthDeg, spreadDeg, rangeMeters, isCalibrated: false }` | Azimuth and angular spread used by `computeCameraFovPolygon()` to project an uncalibrated FOV wedge on the 2.5D sector map. |
| `verificationState` | `'PUBLIC_CATALOG_VERIFIED' \| 'SYNTHETIC' \| 'STALE' \| 'NO_SIGNAL' \| 'RBAC_BLOCKED'` | Explicit provenance state rendered on every camera tile and modal. |
| `accessLevel` | `'PUBLIC_OPEN_DATA' \| 'MUNICIPAL_RESTRICTED'` | Determines whether `PUBLIC_VIEWER` can view the cell or receives `RBAC_BLOCKED`. |
| `catalogUrl` | `string` | HTTPS URL validated against `ALLOWED_CAMERA_FEED_DOMAINS`. |
| `refreshIntervalSec` | `number` | Expected snapshot refresh cadence (e.g., `300s` for DGT snapshots). |
| `staleThresholdSec` | `number` | Age threshold after which the feed is automatically badged `STALE`. |

---

## 3. Configured Sectors & Provenance Truth Table

| Sector ID | Location & Founder Reference | Configured Cameras | Provenance & Licensing |
|---|---|---|---|
| **`SECTOR-AVILA-TIEMBLO`** | **El Tiemblo / N-403 · Ávila, España** (Founder audio `01:08` wildfire reference) | 1. `CAM-AV-N403-KM82` (N-403 km 82.4 Guisando/El Tiemblo)<br/>2. `CAM-AV-M501-ROBLEDO` (M-501 San Martín de Valdeiglesias)<br/>3. `CAM-AV-TIEMBLO-FOREST-SIM` (Castañar de El Tiemblo)<br/>4. `CAM-AV-CHARCO-MUNI` (Embalse del Charco del Cura) | Cameras 1–2: `PUBLIC_CATALOG_VERIFIED` metadata (`infocar.dgt.es`, RISP Spain attribution).<br/>Camera 3: `SYNTHETIC` fire-plume telemetry.<br/>Camera 4: `MUNICIPAL_RESTRICTED` (`RBAC_BLOCKED` for public viewers). |
| **`SECTOR-VLC-TURIA`** | **Cauce Nuevo del Turia / V-30 · Valencia, España** (DANA flash-flood reference) | 1. `CAM-VLC-V30-TURIA` (V-30 km 6.8 Puente de Xirivella)<br/>2. `CAM-VLC-A3-CHIVA` (A-3 km 332 Chiva / Barranco del Poyo)<br/>3. `CAM-VLC-PAI-HYDRO-SIM` (Paiporta Hydrological Sensor)<br/>4. `CAM-VLC-PORT-GATE-MUNI` (V-31 Silla Access) | Cameras 1–2: `PUBLIC_CATALOG_VERIFIED` metadata (`infocar.dgt.es`).<br/>Camera 3: `SYNTHETIC` hydrological gauge.<br/>Camera 4: `MUNICIPAL_RESTRICTED`. |
| **`SECTOR-NL-ARNHEM`** | **Arnhem / A12 IJsselknooppunt · Gelderland, Nederland** (Dutch grant & corridor reference) | 1. `CAM-NL-A12-ARNHEM` (RWS A12 km 128.5 Velperbroek)<br/>2. `CAM-NL-A50-WAALWIJK` (RWS A50 Rhine Bridge Heteren)<br/>3. `CAM-NL-ARNHEM-GRID-SIM` (Liander Substation Synthetic Telemetry) | Cameras 1–2: `PUBLIC_CATALOG_VERIFIED` metadata (`rwsverkeersinfo.nl`, CC0 NL).<br/>Camera 3: `SYNTHETIC` substation telemetry. |

---

## 4. Security, Privacy & Threat Model Controls

### 4.1 Anti-SSRF Domain & IP Guard (`validateCameraFeedUrl`)
To prevent Server-Side Request Forgery (SSRF) or malicious redirect injection when operators test or register external camera catalog URLs:
1. **Protocol Enforcement:** Only `https:` is permitted (`http:`, `file:`, `javascript:`, `data:`, `rtsp:` are rejected).
2. **Credential Rejection:** URLs containing `username` or `password` (`https://user:pass@host`) are rejected (`EMBEDDED_CREDENTIALS_FORBIDDEN`).
3. **Private/Loopback/Metadata IP Blocklist:** Rejects `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (cloud metadata service), `0.0.0.0`, and IPv6 loopback/private prefixes (`::1`, `fc00:`, `fe80:`).
4. **Explicit Host Allowlist (`ALLOWED_CAMERA_FEED_DOMAINS`):**
   - `infocar.dgt.es`
   - `nap.dgt.es`
   - `www.dgt.es`
   - `rwsverkeersinfo.nl`
   - `www.rwsverkeersinfo.nl`
   - `ndw.nu`
   - `opendata.ndw.nu`
   - `civic-relay-investor.vercel.app`

### 4.2 Fail-Closed RBAC (`evaluateSectorIntelligence`)
Cameras with `accessLevel: 'MUNICIPAL_RESTRICTED'` require `operatorRole === 'AUTHORIZED_OPERATOR'`. By default (`operatorRole === 'PUBLIC_VIEWER'`), restricted cameras return `effectiveState: 'RBAC_BLOCKED'`, redact stream coordinates, and display an explicit permission lock badge.

### 4.3 GDPR, Privacy Mosaic & Biometric Prohibition
- **No Biometrics / No LPR:** Facial recognition, person tracking, and automatic license plate recognition (`LPR`) are permanently disabled at the architecture level (`biometricProcessing: 'PROHIBITED_BY_DESIGN'`).
- **Privacy Mosaic Default:** Camera preview canvases apply a visual privacy mosaic filter by default (`privacyMosaicEnabled: true`) to prevent incidental identification of individuals or vehicle plates in public traffic snapshots.
- **No Indiscriminate Autoplay:** Camera cells render low-overhead telemetry snapshots and require explicit user selection to inspect detailed metadata, preventing bandwidth exhaustion during degraded connectivity.

### 4.4 `STALE` and `NO_SIGNAL` Handling
- If `snapshotAgeSec > staleThresholdSec` (or when the user activates the `Forzar STALE / Force STALE` test toggle), the camera state transitions to `STALE` with a high-contrast amber warning badge so operators never mistake an old cached frame for live situational clearance.
- When the `3×3 (9 cells)` matrix is selected for a sector with 3 or 4 configured cameras, the remaining cells deterministically render `NO_SIGNAL` placeholders (`SLOT-UNASSIGNED-*`) rather than duplicating feeds or inventing fake cameras.

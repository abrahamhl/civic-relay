# Data Sources – Civic Relay

## Overview

Civic Relay aggregates information from **three tiers**:

1. **Official sources** – Government agencies, verified organizations
2. **Citizen reports** – Unverified crowdsourced data
3. **Sensor networks** – Automated detection (satellites, cameras, seismic)

**Critical principle:** **NEVER conflate tiers.** Display provenance clearly.

---

## Official Sources

### 1. NASA FIRMS (Fire Information for Resource Management System)

**What:** Real-time wildfire detection from satellites (MODIS, VIIRS)

**Data:**
- Fire hotspot coordinates
- Confidence level (0-100%)
- Brightness temperature
- Acquisition time

**API:**
```
https://firms.modaps.eosdis.nasa.gov/api/area/
```

**Integration:**

```typescript
interface FIRMSHotspot {
  latitude: number;
  longitude: number;
  confidence: number;     // 0-100
  bright_ti4: number;     // Brightness temp (Kelvin)
  acq_date: string;       // YYYY-MM-DD
  acq_time: string;       // HHMM
}

// Map to Civic Relay Incident
const incident: Incident = {
  type: 'FIRE',
  verificationState: 'OFFICIAL',
  location: { lat, lon, confidence: 'HIGH', source: 'OFFICIAL' },
  officialSource: 'NASA FIRMS',
  // ...
};
```

**Update frequency:** Every 3 hours

**Terms of use:** Public domain (US government data)

**Status:** ⏳ PLANNED (V0.2)

---

### 2. Copernicus Emergency Management Service (EMS)

**What:** EU satellite imagery for natural disasters

**Data:**
- Flood extent polygons
- Damaged infrastructure
- Population impact estimates

**API:**
```
https://emergency.copernicus.eu/mapping/
```

**Integration:** GeoJSON layers on map

**Update frequency:** Variable (per-event basis)

**Terms of use:** Free for non-commercial (attribution required)

**Status:** ⏳ PLANNED (V1.0)

---

### 3. USGS Earthquake Alerts

**What:** Real-time seismic event detection

**Data:**
- Epicenter coordinates
- Magnitude
- Depth
- ShakeMap intensity

**API:**
```
https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
```

**Integration:**

```typescript
const incident: Incident = {
  type: 'INFRASTRUCTURE', // Earthquake category
  verificationState: 'OFFICIAL',
  officialSource: 'USGS',
  // ...
};
```

**Update frequency:** Real-time (< 5 min after event)

**Status:** ⏳ PLANNED (V1.0)

---

### 4. Weather Alerts (NWS / AEMET)

**What:** Government weather warnings

**Data:**
- Storm warnings
- Flood watches
- Extreme heat advisories

**APIs:**
- US: https://api.weather.gov/alerts
- Spain: AEMET API (requires key)

**Integration:** Overlay alerts on map

**Status:** ⏳ PLANNED (V1.0)

---

## Sensor Networks (Future)

### 1. Traffic Cameras

**What:** Public road cameras (DOT feeds)

**Use case:** Detect road blockages, fires, floods

**Challenge:** Legal access, privacy concerns

**Status:** 🔬 RESEARCH

---

### 2. Seismic Sensors

**What:** Raspberry Pi + accelerometer network

**Use case:** Community-run earthquake early warning

**Challenge:** Calibration, false positives

**Status:** 🔬 RESEARCH

---

### 3. Air Quality Monitors

**What:** PurpleAir, OpenAQ

**Use case:** Wildfire smoke detection

**API:** https://www2.purpleair.com/

**Status:** ⏳ PLANNED (V2.0)

---

## Citizen Reports

### Data Model

```typescript
interface CitizenReport {
  type: MessageType;
  verificationState: 'UNVERIFIED';  // Always starts here
  origin: string;                   // Device ID
  approximateLocation: Location;    // GPS + confidence
  createdAt: string;
  payload: Record<unknown>;
}
```

**Key properties:**

- Always starts `UNVERIFIED`
- Can be upgraded to `CORROBORATED` if multiple independent reports at same location
- Never auto-upgraded to `OFFICIAL`

---

## Data Fusion

### Corroboration Logic

**Scenario:** 3 citizen reports + 1 NASA FIRMS hotspot at same location

**Algorithm:**

1. Cluster reports within 500m radius
2. If ≥ 2 independent origins + 1 official source → `CORROBORATED`
3. If only official source → `OFFICIAL`
4. If only citizen reports → `UNVERIFIED` (show count)

**Implementation:**

```typescript
function corroborate(messages: MessageEnvelope[]): VerificationState {
  const uniqueOrigins = new Set(messages.map(m => m.origin));
  const hasOfficial = messages.some(m => m.verificationState === 'OFFICIAL');

  if (hasOfficial && uniqueOrigins.size >= 2) {
    return 'CORROBORATED';
  }
  if (hasOfficial) {
    return 'OFFICIAL';
  }
  if (uniqueOrigins.size >= 3) {
    return 'CORROBORATED';
  }
  return 'UNVERIFIED';
}
```

**Status:** ⏳ PLANNED (V0.2)

---

## Data Quality

### Deduplication

**Problem:** Same fire reported via:
- NASA FIRMS
- 5 citizen reports
- 1 traffic camera

**Solution:** Spatial-temporal clustering

```typescript
function cluster(incidents: Incident[]): Incident[][] {
  // DBSCAN with ε = 500m, minPts = 1
  // Time window = 15 minutes
}
```

Each cluster = 1 logical incident with multiple sources.

---

### Staleness Detection

**TTL by source:**

| Source | TTL |
|--------|-----|
| Citizen report | 1 hour |
| NASA FIRMS | 3 hours |
| USGS earthquake | 24 hours |
| Weather alert | Until expiration |

**Rationale:** Official data stays relevant longer.

---

### False Positive Handling

**Problem:** Citizen reports false fire (BBQ smoke)

**Detection:**
- No corroboration within 15 min → Mark `DISPUTED`
- Coordinator manual review

**UI:** Show disputed reports in red, collapsed by default

---

## Privacy & Legal

### Official Data

**FIRMS/USGS/AEMET:** Public domain or open license  
**Attribution:** Required for Copernicus

**Compliance:** ✅ No PII, no restrictions

---

### Citizen Reports

**PII risk:** Location + device ID = trackable

**Mitigation:**
- [ ] Location jitter (±100m random offset)
- [ ] Device ID rotation (per incident)
- [ ] User consent before sharing

**Compliance:** GDPR, CCPA → [ ] Privacy policy required

---

### Sensor Networks

**Traffic cameras:** Check local laws (some jurisdictions prohibit automated capture)

**Air quality:** Data already public (PurpleAir terms)

---

## Integration Roadmap

### V0.1 (Current)

- ❌ No external sources
- ✅ Simulated official incident (demo)

### V0.2

- [ ] NASA FIRMS integration (wildfire)
- [ ] Corroboration logic (multi-source)

### V1.0

- [ ] USGS earthquakes
- [ ] Weather alerts (NWS)
- [ ] Copernicus EMS

### V2.0

- [ ] PurpleAir (air quality)
- [ ] Seismic sensor network
- [ ] Traffic camera analysis (if legal)

---

## Data Pipeline Architecture (Future)

```
External API (FIRMS)
  ↓
Poller Service (every 3h)
  ↓
Data Normalizer (GeoJSON → Incident)
  ↓
Deduplication / Clustering
  ↓
Database (PostgreSQL + PostGIS)
  ↓
WebSocket (push to clients)
  ↓
Map UI (Leaflet layers)
```

**Tech stack:**

- **Poller:** Node.js + cron
- **Normalizer:** TypeScript (same schemas as client)
- **Database:** PostgreSQL with PostGIS extension
- **Real-time:** Socket.io or SSE

---

## Testing Strategy

### Data Quality Tests

1. **Deduplication:** Same incident via 2 sources = 1 stored incident
2. **Corroboration:** 3 citizen reports → CORROBORATED
3. **Staleness:** Expired TTL → Hidden from map
4. **False positive:** No corroboration → DISPUTED

### API Mocking

**V0.2 testing:** Mock FIRMS API responses

```typescript
const mockFIRMS: FIRMSHotspot[] = [
  { latitude: 40.45, longitude: -3.75, confidence: 90, /* ... */ },
];
```

No need to hit real API during tests.

---

## Cost Estimates (Future)

| Source | Cost | Rate Limit |
|--------|------|------------|
| NASA FIRMS | Free | 10,000 req/day |
| USGS | Free | Unlimited |
| NWS | Free | Unlimited |
| Copernicus | Free | Fair use |
| AEMET | Free (API key) | 5,000 req/day |
| PurpleAir | Free | 1 req/10s |

**Backend hosting:** ~$50/month (AWS t3.small + RDS)

**Total:** < $100/month for moderate usage

---

## Open Questions

1. **Liability:** If we show official data with delay, who is responsible for outdated info?
2. **Accuracy:** Should we show confidence intervals for citizen reports?
3. **Filtering:** Allow users to hide unverified reports?
4. **Export:** Should coordinators be able to export incident data for GIS tools?
5. **Historical:** Keep incident history for post-event analysis?

---

**Next:** See [TRANSPORT_BOUNDARIES.md](./TRANSPORT_BOUNDARIES.md) for legal transport limits.

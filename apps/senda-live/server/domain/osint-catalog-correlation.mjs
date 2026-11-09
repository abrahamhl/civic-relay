/**
 * Source-preserving public OSINT cross-catalog proximity analysis.
 *
 * IMPORTANT: GDACS may incorporate USGS / other providers as input. Therefore a
 * GDACS↔USGS or GDACS↔EONET overlap does NOT constitute independent confirmation.
 * Geographic proximity is not event identity and cannot verify an alert.
 *
 * No citizens, social profiles, device positions or private user records.
 */
const EARTH_RADIUS_M = 6371008.8;
const finite = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
function distanceKm(a, b) {
  if (!a || !b || !finite(a.lat, -90, 90) || !finite(b.lat, -90, 90) ||
      !finite(a.lon, -180, 180) || !finite(b.lon, -180, 180)) return null;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const q = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, q)))) / 1000;
}
function minutesBetween(a, b) {
  const x = Date.parse(a), y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.abs(x - y) / 60_000 : null;
}
export const OSINT_RULES = Object.freeze({
  EQ: { catalog: 'USGS_M45_WEEK_GEOJSON', type: 'HISTORICAL_OBSERVATION',
    maxDistanceKm: 125, maxOffsetMinutes: 180 },
  WF: { catalog: 'NASA_EONET_V3_WILDFIRES', type: 'CURATED_EVENT_METADATA',
    maxDistanceKm: 80, maxOffsetMinutes: 72 * 60 }
});

export function correlateGdacsCatalogs(gdacs, usgs, eonet) {
  if (gdacs?.schema !== 'senda.osint.gdacs/1' ||
      !Array.isArray(gdacs.observations) || gdacs.observations.length > 100) {
    throw new Error('BAD_GDACS_CATALOG');
  }
  const sources = {
    EQ: usgs?.dataset === OSINT_RULES.EQ.catalog && Array.isArray(usgs.observations) ? usgs : null,
    WF: eonet?.dataset === OSINT_RULES.WF.catalog && Array.isArray(eonet.observations) ? eonet : null,
  };
  const correlation = gdacs.observations.map((e) => {
    const rule = OSINT_RULES[e.eventType];
    const other = sources[e.eventType];
    const candidates = [];
    if (rule && other && !['UNAVAILABLE', 'STALE_SNAPSHOT'].includes(other.status) &&
        !['UNAVAILABLE', 'STALE_SNAPSHOT'].includes(gdacs.status)) {
      for (const ref of other.observations.slice(0, 200)) {
        if (ref.dataKind !== rule.type) continue;
        const d = distanceKm(e.location, ref.location);
        const t = minutesBetween(e.observedAt, ref.observedAt);
        if (d === null || t === null || d > rule.maxDistanceKm || t > rule.maxOffsetMinutes) continue;
        candidates.push({
          id: ref.id,
          catalog: rule.catalog,
          distanceKm: Math.round(d * 100) / 100,
          timeDifferenceMinutes: Math.round(t),
          referenceUrl: typeof ref.url === 'string' ? ref.url : null,
          relation: 'SPATIOTEMPORAL_CANDIDATE_ONLY',
          isIndependentVerification: false
        });
      }
      candidates.sort((a, b) =>
        a.distanceKm - b.distanceKm || a.timeDifferenceMinutes - b.timeDifferenceMinutes);
    }
    return {
      ...e,
      crossCatalogCandidates: candidates.slice(0, 3),
      crossCatalogStatus: rule ? (!other || ['UNAVAILABLE', 'STALE_SNAPSHOT'].includes(other.status) ||
        ['UNAVAILABLE', 'STALE_SNAPSHOT'].includes(gdacs.status) ?
        'COMPARISON_SOURCE_UNAVAILABLE_OR_STALE' :
        candidates.length ? 'PROXIMITY_CANDIDATE_NOT_VERIFIED' : 'NO_NEARBY_CATALOG_CANDIDATE') :
        'NOT_COMPARABLE_BY_AVAILABLE_SOURCES',
      independentlyVerified: false,
      isSendaAlert: false,
    };
  });
  return {
    schema: 'senda.osint.cross-catalog/1',
    dataKind: 'PUBLIC_GEOSPATIAL_CROSS_CATALOG_SCREENING',
    methodology: 'GEODESIC_DISTANCE_AND_EVENT_TIME_WINDOW',
    sourceIndependenceValidated: false,
    isSendaAlert: false,
    caveat: 'GDACS can depend on USGS or NASA sources; catalog matches are NOT independent corroboration.',
    rules: OSINT_RULES,
    upstream: {
      gdacs: gdacs.status || 'UNKNOWN',
      usgs: usgs?.status || 'UNKNOWN',
      eonet: eonet?.status || 'UNKNOWN'
    },
    observations: correlation,
    totalCandidateLinks: correlation.reduce((n, e) => n + e.crossCatalogCandidates.length, 0),
  };
}

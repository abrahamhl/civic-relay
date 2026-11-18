/**
 * SENDA RoadSafe — canonical road incident alerts, electronic horizon and distribution plan.
 * Pure/portable decision support; NO networking, public broadcast, automatic 112 dispatch,
 * vehicle control or permission acquisition. All clocks and geometry are supplied explicitly.
 *
 * Provenance root != transport copy: DATEX II, DGT, MQTT and BLE relaying the SAME report
 * must carry the same original rootId. Distinct channels are not independent witnesses.
 */
const HAZARDS = new Set([
  'TAIL_OF_QUEUE', 'COLLISION', 'BROKEN_DOWN_VEHICLE', 'PERSON_ON_ROAD',
  'EMERGENCY_VEHICLE_STOPPED', 'ROAD_BLOCKAGE', 'REDUCED_VISIBILITY',
]);
const SEVERITIES = new Set(['INFO', 'MODERATE', 'HIGH', 'CRITICAL']);
const DIRECTIONS = new Set(['INCREASING', 'DECREASING', 'BOTH']);
const VERIFICATIONS = new Set([
  'AUTHORITY_VERIFIED', 'PARTNER_ATTESTED', 'PEER_SIGNATURE_VERIFIED',
  'UNVERIFIED', 'SIMULATED', 'DISPUTED',
]);
const CREDIBLE = new Set(['AUTHORITY_VERIFIED', 'PARTNER_ATTESTED']);
const PRIORITY = { INFO: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
const TRUST_RANK = { UNVERIFIED: 0, PEER_SIGNATURE_VERIFIED: 1, PARTNER_ATTESTED: 2, AUTHORITY_VERIFIED: 3 };
const nonempty = (x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 200;
const finite = (x) => typeof x === 'number' && Number.isFinite(x);

/**
 * Input schema:
 * { reportId, incidentKey, hazardType, severity, observedAtMs, expiresAtMs,
 *   road:{roadId,carriagewayId,direction,chainageM,uncertaintyM,mapMatched},
 *   provenance:{rootId,publisherId,independenceFamily,verification,proofId?},
 *   authorityPublicWarningApproved?:boolean }
 *
 * `AUTHORITY_VERIFIED`/`PARTNER_ATTESTED` require a non-empty externally validated
 * proofId. This module does not itself verify the certificate; callers must.
 */
export function normalizeRoadReport(raw, { nowMs, acceptedAttestations = {} } = {}) {
  if (!finite(nowMs) || nowMs < 0) return { ok: false, reason: 'INVALID_CLOCK' };
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'INVALID_REPORT' };
  const p = raw.provenance, r = raw.road;
  if (![raw.reportId, raw.incidentKey, p?.rootId, p?.publisherId, p?.independenceFamily,
    r?.roadId, r?.carriagewayId].every(nonempty)) return { ok: false, reason: 'MISSING_IDENTITY_OR_ROAD' };
  if (!HAZARDS.has(raw.hazardType) || !SEVERITIES.has(raw.severity) ||
      !DIRECTIONS.has(r.direction) || !VERIFICATIONS.has(p.verification))
    return { ok: false, reason: 'UNKNOWN_HAZARD_DIRECTION_OR_VERIFICATION' };
  if (![raw.observedAtMs, raw.expiresAtMs, r.chainageM, r.uncertaintyM].every(finite) ||
      r.chainageM < 0 || r.uncertaintyM < 0 || r.uncertaintyM > 100000 ||
      raw.observedAtMs > nowMs || raw.expiresAtMs <= raw.observedAtMs ||
      raw.expiresAtMs <= nowMs || raw.expiresAtMs - raw.observedAtMs > 24 * 3600_000)
    return { ok: false, reason: 'INVALID_TIME_OR_GEOMETRY' };
  // Never trust self-reported authority flags or a mere non-empty proof string.
  // Only an independently verified, root-bound attestation may elevate trust.
  const att = Object.hasOwn(acceptedAttestations, p.proofId) ? acceptedAttestations[p.proofId] : null;
  const attested = att && att.rootId === p.rootId && att.publisherId === p.publisherId &&
    att.independenceFamily === p.independenceFamily && att.verification === p.verification &&
    finite(att.validUntilMs) && att.validUntilMs > nowMs;
  const verification = CREDIBLE.has(p.verification) && !attested ? 'UNVERIFIED' :
    p.verification === 'PEER_SIGNATURE_VERIFIED' && !attested ? 'UNVERIFIED' : p.verification;
  return { ok: true, report: {
    reportId: raw.reportId, incidentKey: raw.incidentKey,
    hazardType: raw.hazardType, severity: raw.severity,
    observedAtMs: raw.observedAtMs, expiresAtMs: raw.expiresAtMs,
    road: { roadId: r.roadId, carriagewayId: r.carriagewayId,
      direction: r.direction, chainageM: r.chainageM, uncertaintyM: r.uncertaintyM,
      mapMatched: r.mapMatched === true },
    provenance: { rootId: p.rootId, publisherId: p.publisherId,
      independenceFamily: p.independenceFamily, verification,
      proofId: nonempty(p.proofId) ? p.proofId : null },
    authorityPublicWarningApproved: raw.authorityPublicWarningApproved === true &&
      verification === 'AUTHORITY_VERIFIED' && att?.publicWarningApproved === true,
  } };
}

/**
 * Same explicit incident key AND hazard, plus compatible carriageway/position.
 * No proximity-only merging: two separate collisions may happen 50 m apart.
 * On conflicting geometry or disputed evidence, quarantine the entire scene.
 */
export function fuseRoadReports(reports, { nowMs, maxPositionDifferenceM = 200, acceptedAttestations = {} } = {}) {
  if (!Array.isArray(reports) || reports.length > 10_000 || !finite(nowMs) ||
      !finite(maxPositionDifferenceM) || maxPositionDifferenceM < 0) {
    return { status: 'ABSTAIN', scenes: [], rejected: [{ reason: 'INVALID_BATCH_OR_CLOCK' }] };
  }
  const rejected = [], groups = new Map();
  for (const raw of reports) {
    const normalized = normalizeRoadReport(raw, { nowMs, acceptedAttestations });
    if (!normalized.ok) { rejected.push({ reportId: raw?.reportId ?? null, reason: normalized.reason }); continue; }
    const x = normalized.report;
    if (['SIMULATED', 'DISPUTED'].includes(x.provenance.verification)) {
      rejected.push({ reportId: x.reportId, reason: 'NON_OPERATIONAL_EVIDENCE' }); continue;
    }
    const key = JSON.stringify([x.incidentKey, x.hazardType]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }
  const scenes = [];
  for (const group of groups.values()) {
    const uniqueRoots = new Map(), conflictingRootPublishers = new Set();
    // An attacker cannot overwrite one verified V16/DATEX root by replaying a newer
    // unsigned relay with the same rootId. Source ownership and trust rank are FIRST.
    for (const e of group) {
      const prev = uniqueRoots.get(e.provenance.rootId);
      const rank = TRUST_RANK[e.provenance.verification] ?? -1;
      const prevRank = prev ? TRUST_RANK[prev.provenance.verification] ?? -1 : -1;
      if (prev && rank >= 2 && prevRank >= 2 &&
          e.provenance.publisherId !== prev.provenance.publisherId) {
        conflictingRootPublishers.add(e.provenance.rootId);
      }
      if (!prev || rank > prevRank ||
          (rank === prevRank && (prev.observedAtMs < e.observedAtMs ||
          (prev.observedAtMs === e.observedAtMs && PRIORITY[e.severity] > PRIORITY[prev.severity])))) {
        uniqueRoots.set(e.provenance.rootId, e);
      }
    }
    if (conflictingRootPublishers.size > 0) {
      rejected.push({ incidentKey: group[0].incidentKey, hazardType: group[0].hazardType,
        reason: 'CONFLICTING_VERIFIED_ROOT_OWNERSHIP', rootCount: conflictingRootPublishers.size });
      continue;
    }
    const allRoots = [...uniqueRoots.values()];
    // Untrusted copies may not escalate severity, shift an official event or shorten its TTL.
    const trusted = allRoots.filter((r) => CREDIBLE.has(r.provenance.verification));
    const roots = trusted.length ? trusted : allRoots;
    const first = roots[0];
    const incompatible = roots.some((r) => r.road.roadId !== first.road.roadId ||
      r.road.carriagewayId !== first.road.carriagewayId ||
      (r.road.direction !== first.road.direction && r.road.direction !== 'BOTH' && first.road.direction !== 'BOTH') ||
      Math.abs(r.road.chainageM - first.road.chainageM) > maxPositionDifferenceM +
        r.road.uncertaintyM + first.road.uncertaintyM);
    if (incompatible) {
      rejected.push({ incidentKey: first.incidentKey, hazardType: first.hazardType,
        reason: 'CONFLICTING_ROAD_GEOMETRY' });
      continue;
    }
    const authoritative = roots.some((r) => r.provenance.verification === 'AUTHORITY_VERIFIED');
    const corroboratingFamilies = new Set(roots.filter((r) => CREDIBLE.has(r.provenance.verification))
      .map((r) => r.provenance.independenceFamily));
    const evidence = authoritative ? 'OFFICIAL' : corroboratingFamilies.size >= 2 ? 'CORROBORATED' : 'UNVERIFIED';
    const severity = roots.reduce((s, r) => PRIORITY[r.severity] > PRIORITY[s] ? r.severity : s, 'INFO');
    const latest = roots.reduce((a, b) => b.observedAtMs > a.observedAtMs ? b : a, first);
    const starts = roots.map((r) => r.road.chainageM - r.road.uncertaintyM);
    const ends = roots.map((r) => r.road.chainageM + r.road.uncertaintyM);
    const lo = Math.min(...starts), hi = Math.max(...ends);
    scenes.push({
      incidentKey: first.incidentKey, hazardType: first.hazardType, severity, evidence,
      observedAtMs: latest.observedAtMs, expiresAtMs: Math.min(...roots.map((r) => r.expiresAtMs)),
      road: { roadId: first.road.roadId, carriagewayId: first.road.carriagewayId,
        direction: first.road.direction === 'BOTH' ? roots.find((r) => r.road.direction !== 'BOTH')?.road.direction ?? 'BOTH' : first.road.direction,
        chainageM: (lo + hi) / 2, uncertaintyM: (hi - lo) / 2,
        mapMatched: roots.every((r) => r.road.mapMatched) },
      rootCount: roots.length, receivedRootCount: allRoots.length,
      independentFamilyCount: corroboratingFamilies.size,
      originRootIds: roots.map((r) => r.provenance.rootId).sort(),
      warningApproved: authoritative && roots.some((r) => r.authorityPublicWarningApproved),
      classification: 'PLANNING_ONLY_NOT_A_PUBLIC_WARNING',
    });
  }
  return { status: 'PLANNING_ONLY', scenes: scenes.sort((a, b) =>
    a.incidentKey.localeCompare(b.incidentKey) || a.hazardType.localeCompare(b.hazardType)),
    rejected, incomingCount: reports.length,
    uniqueRoots: scenes.reduce((n, s) => n + s.rootCount, 0) };
}

/**
 * The road reference MUST be map-matched to a route whose increasing direction
 * is known. No 'creciente/decreciente' interpretation from raw GPS or road name.
 * `nowMs` in milliseconds, returned arbiter fields in seconds.
 */
export function buildElectronicHorizon({ driver, scenes, nowMs, maxAheadM = 6000 } = {}) {
  if (!finite(nowMs) || !driver || !Array.isArray(scenes) ||
      !nonempty(driver.roadId) || !nonempty(driver.carriagewayId) ||
      !['INCREASING', 'DECREASING'].includes(driver.direction) ||
      !finite(driver.chainageM) || driver.chainageM < 0 ||
      !finite(driver.uncertaintyM) || driver.uncertaintyM < 0 ||
      !finite(driver.speedMps) || driver.speedMps < 0 ||
      !finite(maxAheadM) || maxAheadM <= 0) {
    return { status: 'ABSTAIN_GEOMETRY_OR_CLOCK', horizon: [], rejected: [] };
  }
  if (driver.mapMatched !== true) return { status: 'ABSTAIN_UNMATCHED_ROUTE', horizon: [], rejected: [] };
  const horizon = [], rejected = [], sign = driver.direction === 'INCREASING' ? 1 : -1;
  for (const s of scenes) {
    const key = s?.incidentKey ?? null;
    const reject = (reason) => rejected.push({ incidentKey: key, reason });
    if (!s || !s.road || !finite(s.expiresAtMs) || s.expiresAtMs <= nowMs ||
        !finite(s.observedAtMs) || s.observedAtMs > nowMs) { reject('EXPIRED_OR_INVALID_SCENE'); continue; }
    if (s.road.roadId !== driver.roadId || s.road.carriagewayId !== driver.carriagewayId) {
      reject('OTHER_CARRIAGEWAY'); continue;
    }
    if (!s.road.mapMatched || !['BOTH', driver.direction].includes(s.road.direction)) {
      reject('DIRECTION_UNVERIFIED_OR_OPPOSITE'); continue;
    }
    if (!finite(s.road.chainageM) || !finite(s.road.uncertaintyM)) { reject('UNKNOWN_CHAINAGE'); continue; }
    const nominal = (s.road.chainageM - driver.chainageM) * sign;
    const marginM = s.road.uncertaintyM + driver.uncertaintyM;
    const lower = nominal - marginM, upper = nominal + marginM;
    if (upper <= 0) { reject('BEHIND_DRIVER'); continue; }
    if (lower > maxAheadM) { reject('OUTSIDE_HORIZON'); continue; }
    const uncertainAhead = lower <= 0 || s.road.uncertaintyM > 100 || driver.uncertaintyM > 75;
    const etaS = driver.speedMps > 0 ? Math.max(0, lower) / driver.speedMps : null;
    horizon.push({ incidentKey: s.incidentKey, hazardType: s.hazardType, severity: s.severity,
      evidence: s.evidence, nominalDistanceM: nominal, distanceRangeM: [Math.max(0, lower), Math.max(0, upper)],
      etaRangeS: driver.speedMps > 0 ? [Math.max(0, lower) / driver.speedMps, Math.max(0, upper) / driver.speedMps] : null,
      // The HMI arbiter requires a finite ETA. Unknown ETA cannot be voiced.
      arbiterCandidate: etaS === null || uncertainAhead ? null : {
        incidentKey: s.incidentKey, hazardType: s.hazardType, severity: s.severity,
        etaS, observedAt: s.observedAtMs / 1000, expiresAt: s.expiresAtMs / 1000,
        carriagewayMatch: true, evidence: s.evidence, warningApproved: s.warningApproved === true,
      },
      state: uncertainAhead ? 'POSITION_OVERLAP_ABSTAIN_VOICE' : 'ESTIMATED_NOT_NAVIGATION',
    });
  }
  horizon.sort((a, b) => a.distanceRangeM[0] - b.distanceRangeM[0] ||
    PRIORITY[b.severity] - PRIORITY[a.severity]);
  return { status: 'PLANNING_ONLY', horizon, rejected,
    disclaimer: 'Geometric estimate, not verified brake distance or driver manoeuvre instruction.' };
}

// The output is a plan, not a send/ACK. Publishing requires an external authorised adapter.
const OUTPUTS = Object.freeze({
  SCREEN: { family: 'LOCAL_UI', consent: null, grant: null, public: false },
  VOICE: { family: 'LOCAL_UI', consent: 'VOICE_OPT_IN', grant: 'HMI_APPROVED', public: false },
  BLE_PEER: { family: 'LOCAL_RADIO', consent: 'BLE_RELAY_OPT_IN', grant: 'TRUSTED_PEER_TRANSPORT', public: false },
  DTN_RELAY: { family: 'LOCAL_RADIO', consent: 'DTN_OPT_IN', grant: 'TRUSTED_PEER_TRANSPORT', public: false },
  SMS: { family: 'CELLULAR', consent: 'SMS_OPT_IN', grant: null, public: false },
  TAXI_PARTNER: { family: 'PARTNER_API', consent: 'PARTNER_SHARE_OPT_IN', grant: 'TAXI_CONTRACT', public: false },
  INSURER_PARTNER: { family: 'PARTNER_API', consent: 'PARTNER_SHARE_OPT_IN', grant: 'ASSISTANCE_CONTRACT', public: false },
  DGT30: { family: 'PARTNER_API', consent: null, grant: 'DGT30_CREDENTIALS_AND_SCOPE', public: true },
  DATEX2: { family: 'PARTNER_API', consent: null, grant: 'NAP_PUBLISHER_APPROVAL', public: true },
  WAZE_CIFS: { family: 'PARTNER_API', consent: null, grant: 'WAZE_PARTNER', public: true },
  DENM: { family: 'CITS_RADIO', consent: null, grant: 'CITS_CERTIFIED_STATION', public: true },
  PMV: { family: 'ROAD_OPERATOR', consent: null, grant: 'ROAD_OPERATOR_APPROVAL', public: true },
  CAP: { family: 'PUBLIC_WARNING', consent: null, grant: 'PUBLIC_ALERT_AUTHORITY', public: true },
});
export const ROAD_ALERT_OUTPUTS = OUTPUTS;

export function planRoadAlertDistribution(scene, { requestedChannels = [], linkStates = {},
  consents = [], grants = [], nowMs } = {}) {
  if (!scene || !finite(nowMs) || scene.expiresAtMs <= nowMs ||
      !Array.isArray(requestedChannels) || !Array.isArray(consents) || !Array.isArray(grants))
    return { status: 'ABSTAIN', selected: [], blocked: [{ reason: 'INVALID_OR_EXPIRED_SCENE' }] };
  const selected = [], blocked = [];
  for (const channel of new Set(requestedChannels)) {
    const rule = Object.hasOwn(OUTPUTS, channel) ? OUTPUTS[channel] : null;
    const reason = !rule ? 'UNKNOWN_CHANNEL' :
      (rule.public || channel === 'VOICE') &&
        (scene.warningApproved !== true || scene.evidence !== 'OFFICIAL') ? 'NOT_APPROVED_FOR_DRIVER_OR_PUBLIC_WARNING' :
      rule.consent && !consents.includes(rule.consent) ? 'NO_USER_CONSENT' :
      rule.grant && !grants.includes(rule.grant) ? 'MISSING_EXTERNAL_AUTHORIZATION' :
      // No optimistic availability: explicit locally measured UP only.
      linkStates[channel] !== 'MEASURED_UP' ? 'LINK_UNAVAILABLE_OR_UNMEASURED' : null;
    if (reason) blocked.push({ channel, reason });
    else selected.push({ channel, failureFamily: rule.family,
      status: 'PLANNED_NOT_TRANSMITTED', destinationAck: false });
  }
  return { status: 'PLANNING_ONLY', selected, blocked,
    failureFamilies: [...new Set(selected.map((s) => s.failureFamily))],
    noDeliveryGuarantee: true, noPublicWarningSent: true,
    note: 'Multiple interfaces in one failure family do not constitute independent paths.' };
}
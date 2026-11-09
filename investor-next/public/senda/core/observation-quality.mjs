/**
 * SENDA v0.21 — sensor observation QA gates. Pure code, no network or side effects.
 * A validated algorithm is NOT an authorised operational fire/traffic warning.
 * Official NOAA ABI FHS: lowest false-alarm tolerance: masks 10,11,30,31.
 * Sources: https://developers.google.com/earth-engine/datasets/catalog/NOAA_GOES_16_FDCF
 *           https://www.noaasis.noaa.gov/pdf/ps-pvr/goes18/ABI/Fires%20and%20Hot%20Spots%20Characterization/Full/GOES-18_ABI_L2_FireHotSpot_Full_ReadMe.pdf
 */
export const GOES_RESEARCH_MASKS = Object.freeze([10, 11, 12, 13, 14, 15, 30, 31, 32, 33, 34, 35]);
export const GOES_STRICT_MASKS = Object.freeze([10, 11, 30, 31]);
const STRICT = new Set(GOES_STRICT_MASKS);
const RESEARCH = new Set(GOES_RESEARCH_MASKS);
const finite = (x) => typeof x === 'number' && Number.isFinite(x);

export function classifyGoesPixel(det) {
  if (!Array.isArray(det) || det.length < 2 || !finite(det[0]) || !finite(det[1]) ||
      Math.abs(det[0]) > 90 || Math.abs(det[1]) > 180) return 'INVALID';
  if (det.length < 4 || det[3] == null) return 'MISSING_MASK';
  if (!Number.isInteger(det[3])) return 'INVALID';
  // GOES DQF=0 is a good-quality fire pixel; reject bad quality when the product supplies DQF.
  // Old 4-field records remain mask-only candidates and are not independently calibrated.
  if (det.length >= 5 && det[4] != null && det[4] !== 0) return 'INVALID';
  return STRICT.has(det[3]) ? 'STRICT' : RESEARCH.has(det[3]) ? 'EXPLORATORY' : 'INVALID';
}

/**
 * Applies a quality gate to GOES ABI FHS detections without inventing missing mask codes.
 * Captured times must be ISO with explicit zone; detects out-of-order frames.
 * LEGACY_NO_MASK blocks publication of calibrated spread speeds, not visualization.
 */
export function filterGoesFrames(frames) {
  if (!Array.isArray(frames)) return { usableForCalibration: false, status: 'INVALID_INPUT', frames: [], counts: {} };
  const counts = { STRICT: 0, EXPLORATORY: 0, MISSING_MASK: 0, INVALID: 0, timeErrors: 0 };
  let last = -Infinity;
  const filtered = frames.map((frame) => {
    const iso = frame?.t;
    const t = typeof iso === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t) || t <= last) counts.timeErrors++;
    if (Number.isFinite(t)) last = t;
    const det = [];
    for (const p of Array.isArray(frame?.det) ? frame.det : []) {
      const q = classifyGoesPixel(p);
      counts[q]++;
      if (q === 'STRICT') det.push(p);
    }
    return { t: iso, det };
  });
  const total = counts.STRICT + counts.EXPLORATORY + counts.MISSING_MASK + counts.INVALID;
  const masked = total > 0 && counts.MISSING_MASK === 0 && counts.INVALID === 0;
  const usableForCalibration = masked && !counts.timeErrors && counts.STRICT >= 2 &&
    filtered.filter((f) => f.det.length > 0).length >= 2;
  const status = counts.timeErrors ? 'INVALID_TIMESTAMPS' :
    counts.MISSING_MASK ? 'LEGACY_NO_MASK' :
    counts.INVALID ? 'INVALID_DETECTIONS' :
    !counts.STRICT ? 'NO_HIGH_CONFIDENCE_FIRE' :
    usableForCalibration ? 'FILTERED_CANDIDATE' : 'INSUFFICIENT_FRAMES';
  return { status, usableForCalibration, frames: filtered, counts, removedFraction: total ? +(1 - counts.STRICT / total).toFixed(4) : null,
    notes: ['GOES detections are pixel-level thermal anomalies, not subpixel fire boundaries.',
      'FILTERED_CANDIDATE still requires independent perimeter/VIIRS and uncertainty validation.'] };
}

/**
 * The catalogued/public nature of a camera is not permission to reuse the live video.
 * No RGB traffic camera can produce radiometric temperature.
 */
export function assessCameraMeasurement(observation, { nowMs = Date.now(), maxAgeS = 600 } = {}) {
  const issues = [], o = observation ?? {};
  const captureMs = Date.parse(o.capturedAtUTC ?? '');
  if (!Number.isFinite(captureMs) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(o.capturedAtUTC ?? '')) issues.push('UNVERIFIED_CAPTURE_TIME');
  else if (captureMs > nowMs + 30000 || nowMs - captureMs > maxAgeS * 1000) issues.push('STALE_OR_FUTURE');
  if (!o.sourceId || !o.sourceUrl || !/^https:\/\//.test(o.sourceUrl)) issues.push('MISSING_PROVENANCE');
  if (o.licenseForThisData !== true) issues.push('RIGHTS_NOT_VERIFIED');
  if (o.accessAuthorized !== true) issues.push('ACCESS_NOT_AUTHORIZED');
  const modality = o.modality;
  if (!['RGB', 'THERMAL_RADIOMETRIC', 'THERMAL_NON_RADIOMETRIC'].includes(modality)) issues.push('UNKNOWN_MODALITY');
  if (o.metric === 'temperatureC') {
    if (modality !== 'THERMAL_RADIOMETRIC') issues.push('NOT_A_RADIOMETRIC_MEASUREMENT');
    const c = o.calibration ?? {};
    if (!finite(c.emissivity) || c.emissivity <= 0 || c.emissivity > 1 ||
        !finite(c.distanceM) || c.distanceM <= 0 ||
        !finite(c.reflectedTempC) || !c.calibrationId || !finite(c.uncertaintyC) || c.uncertaintyC <= 0) {
      issues.push('THERMAL_CALIBRATION_MISSING');
    }
  }
  if (o.metric === 'speedKmh') {
    const c = o.calibration ?? {};
    if (!c.calibrationId || c.method !== 'ROAD_PLANE_HOMOGRAPHY' ||
        !finite(c.uncertaintyKmh) || c.uncertaintyKmh <= 0) issues.push('SPEED_NOT_GEOMETRICALLY_CALIBRATED');
  }
  if (!finite(o.value) || (o.metric !== 'temperatureC' && o.value < 0) || (o.metric === 'temperatureC' && (o.value < -273.15 || o.value > 2000))) issues.push('INVALID_MEASUREMENT');
  if (o.privacyReviewPassed !== true) issues.push('PRIVACY_REVIEW_PENDING');
  return { status: issues.length ? 'RESEARCH_ONLY' : 'ELIGIBLE_FOR_FUSION_REVIEW', issues,
    canEnterLivePredictor: issues.length === 0,
    canIssueOfficialAlert: false, // Only an authenticated authority may issue alerts; this gate never authorizes it.
  };
}

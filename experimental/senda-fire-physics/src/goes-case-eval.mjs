/**
 * SENDA A3b (H-FIRE-B) — causal multi-incident evaluation helpers over REAL in-repo data:
 *   investor-next/public/senda/data/referencias/goes_casos.json
 *   (NOAA GOES-R ABI L2 FDC hotspots + NOAA HRRR 3 km point series, public domain).
 *
 * Honest scope (documented, never hidden):
 *  - Target = cumulative GOES active-fire hotspot footprint, NOT a mapped perimeter.
 *    GOES pixels are ~2 km at nadir (larger at these latitudes); obscuration/omission exists.
 *  - No DEM or fuel map exists in the archive for US cases -> flat terrain + uniform fuel.
 *    This evaluates WIND-DIRECTIONAL skill only, not full physics.
 *  - HRRR is a single point series per incident; availability assumed validUTC + 60 min
 *    (conservative publication latency assumption, stated in results).
 *  - Research only: canIssueEvacuationOrder=false, canPublicWarn=false always.
 */
import { solveLevelSetUpwind } from './level-set-solver.mjs';

export const HRRR_AVAILABILITY_LAG_MS = 60 * 60 * 1000;
const KM_PER_DEG_LAT = 111.32;

/** Build a local equirectangular grid (row j grows northward) covering all detections. */
export function buildCaseGrid(frames, { dxM = 1000, marginKm = 12 } = {}) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const f of frames) for (const [lat, lon] of f.det || []) {
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
  }
  if (!Number.isFinite(minLat)) return null;
  const lat0 = (minLat + maxLat) / 2;
  const kmPerDegLon = KM_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const dxKm = dxM / 1000;
  const widthKm = (maxLon - minLon) * kmPerDegLon + 2 * marginKm;
  const heightKm = (maxLat - minLat) * KM_PER_DEG_LAT + 2 * marginKm;
  const w = Math.max(8, Math.ceil(widthKm / dxKm));
  const h = Math.max(8, Math.ceil(heightKm / dxKm));
  const originLon = minLon - marginKm / kmPerDegLon;
  const originLat = minLat - marginKm / KM_PER_DEG_LAT;
  const toCell = (lat, lon) => ({
    i: Math.floor(((lon - originLon) * kmPerDegLon) / dxKm),
    j: Math.floor(((lat - originLat) * KM_PER_DEG_LAT) / dxKm),
  });
  return { w, h, dxM, originLat, originLon, kmPerDegLon, toCell };
}

/** Cumulative observed hotspot mask for all frames with t <= tMs (radius in km around each pixel centre). */
export function cumulativeMask(frames, geo, tMs, { radiusKm = 1.0 } = {}) {
  const { w, h, dxM } = geo;
  const dxKm = dxM / 1000;
  const mask = new Uint8Array(w * h);
  const r = Math.ceil(radiusKm / dxKm);
  for (const f of frames) {
    if (Date.parse(f.t) > tMs) continue;
    for (const [lat, lon] of f.det || []) {
      const { i, j } = geo.toCell(lat, lon);
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.hypot(di, dj) * dxKm > radiusKm + 1e-9) continue;
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < w && jj < h) mask[jj * w + ii] = 1;
      }
    }
  }
  return mask;
}

/** Brute-force signed distance (m): <=0 inside burned, >0 outside. Adequate for small grids. */
export function signedDistanceFromMask(mask, w, h, dxM) {
  const burned = [];
  for (let k = 0; k < mask.length; k++) if (mask[k]) burned.push(k);
  const phi = new Float64Array(w * h);
  if (!burned.length) return null;
  for (let k = 0; k < w * h; k++) {
    if (mask[k]) { phi[k] = -0.5 * dxM; continue; }
    const i = k % w, j = (k - i) / w;
    let best = Infinity;
    for (const b of burned) {
      const bi = b % w, bj = (b - bi) / w;
      const d = (bi - i) ** 2 + (bj - j) ** 2;
      if (d < best) best = d;
    }
    phi[k] = Math.max(0.5, Math.sqrt(best) - 0.5) * dxM;
  }
  return phi;
}

/** Latest HRRR sample whose (validUTC + lag) <= t0. Returns null -> caller must ABSTAIN. */
export function causalHrrrAt(hrrr, t0Ms, lagMs = HRRR_AVAILABILITY_LAG_MS) {
  let best = null;
  for (const s of hrrr || []) {
    const valid = Date.parse(s.validUTC.length === 17 ? s.validUTC.replace('Z', ':00Z') : s.validUTC);
    if (!Number.isFinite(valid)) continue;
    const availableAtMs = valid + lagMs;
    if (availableAtMs <= t0Ms && (!best || valid > best.validMs)) best = { ...s, validMs: valid, availableAtMs };
  }
  return best;
}

/** Isotropic baseline with the SAME predicted burned area as the comparator (area-matched disc growth). */
export function areaMatchedIsotropic(phi0, w, h, targetBurnedCells) {
  const order = [];
  for (let k = 0; k < w * h; k++) order.push(k);
  order.sort((a, b) => phi0[a] - phi0[b]);
  const mask = new Uint8Array(w * h);
  for (let n = 0; n < Math.min(targetBurnedCells, order.length); n++) mask[order[n]] = 1;
  return mask;
}

export function maskScores(pred, obs, base) {
  let inter = 0, uni = 0, tpN = 0, fpN = 0, fnN = 0;
  for (let k = 0; k < obs.length; k++) {
    if (pred[k] && obs[k]) inter++;
    if (pred[k] || obs[k]) uni++;
    const pNew = pred[k] && !base[k];
    const oNew = obs[k] && !base[k];
    if (pNew && oNew) tpN++; else if (pNew) fpN++; else if (oNew) fnN++;
  }
  const denom = tpN + fpN + fnN;
  return {
    iou: uni ? inter / uni : null,
    growthCsi: denom ? tpN / denom : null,
    observedNewCells: tpN + fnN,
    predictedNewCells: tpN + fpN,
  };
}

/**
 * Evaluate one incident at successive t0 (step = horizon) with strict causal inputs.
 * fuelCode is a uniform assumption (no fuel map available for this archive).
 */
export function evaluateGoesCase(caseData, { horizonH = 3, dxM = 1000, fuelCode = 2, minNewCells = 1 } = {}) {
  const frames = (caseData.frames || []).filter((f) => Number.isFinite(Date.parse(f.t)));
  const geo = buildCaseGrid(frames, { dxM });
  if (!geo) return { status: 'ABSTAIN', reason: 'NO_DETECTIONS', origins: [] };
  const tFirst = Date.parse(frames.find((f) => f.det?.length).t);
  const tLast = Date.parse(frames[frames.length - 1].t);
  const H = horizonH * 3600_000;
  const origins = [];
  const grid = { w: geo.w, h: geo.h, dxM, fuel: new Uint8Array(geo.w * geo.h).fill(fuelCode), elev: new Float64Array(geo.w * geo.h) };
  for (let t0 = tFirst + 3600_000; t0 + H <= tLast; t0 += H) {
    const base = cumulativeMask(frames, geo, t0);
    const obs = cumulativeMask(frames, geo, t0 + H);
    const met = causalHrrrAt(caseData.hrrr, t0);
    const rec = { t0: new Date(t0).toISOString(), horizonH };
    if (!met) { origins.push({ ...rec, status: 'ABSTAIN', reason: 'NO_CAUSAL_HRRR' }); continue; }
    const phi0 = signedDistanceFromMask(base, geo.w, geo.h, dxM);
    if (!phi0) { origins.push({ ...rec, status: 'ABSTAIN', reason: 'EMPTY_BASE' }); continue; }
    const ls = solveLevelSetUpwind({
      grid, phi0, horizonMin: horizonH * 60, cflTarget: 0.4, t0Ms: t0,
      weather: { windU_mps: met.u10, windV_mps: met.v10, availableAtMs: met.availableAtMs, isPostHocReanalysis: false },
    });
    if (ls.status !== 'PREDICTED_MODEL_ONLY') { origins.push({ ...rec, status: 'ABSTAIN', reason: ls.reason }); continue; }
    let lsCells = 0; for (const v of ls.burnedMask) lsCells += v;
    const iso = areaMatchedIsotropic(phi0, geo.w, geo.h, lsCells);
    const sLs = maskScores(ls.burnedMask, obs, base);
    const sIso = maskScores(iso, obs, base);
    const sPers = maskScores(base, obs, base);
    if (sLs.observedNewCells < minNewCells) {
      origins.push({ ...rec, status: 'EXCLUDED', reason: 'NO_OBSERVED_GROWTH', iouPersistence: sPers.iou });
      continue;
    }
    origins.push({
      ...rec, status: 'SCORED',
      hrrrValidUTC: met.validUTC, hrrrAvailableAt: new Date(met.availableAtMs).toISOString(),
      observedNewCells: sLs.observedNewCells, levelSetNewCells: sLs.predictedNewCells,
      iou: { levelSet: sLs.iou, isotropicAreaMatched: sIso.iou, persistence: sPers.iou },
      growthCsi: { levelSet: sLs.growthCsi, isotropicAreaMatched: sIso.growthCsi, persistence: 0 },
      maxObservedCfl: ls.maxObservedCfl,
    });
  }
  return { status: 'OK', grid: { w: geo.w, h: geo.h, dxM }, origins };
}

/** Deterministic percentile bootstrap over incident-level means (incident = independent unit). */
export function bootstrapMeanCi(values, { iterations = 10000, seed = 20261117, alpha = 0.05 } = {}) {
  const n = values.length;
  if (!n) return null;
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const means = new Float64Array(iterations);
  for (let b = 0; b < iterations; b++) {
    let sum = 0; for (let k = 0; k < n; k++) sum += values[Math.floor(rnd() * n)];
    means[b] = sum / n;
  }
  means.sort();
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return { mean, lo: means[Math.floor((alpha / 2) * iterations)], hi: means[Math.floor((1 - alpha / 2) * iterations) - 1], n, iterations };
}

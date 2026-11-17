/**
 * SENDA A3 (H-FIRE-B) — Monotone Upwind Hamilton-Jacobi Level-Set Fire Spread Solver.
 *
 * Solves:  d(phi)/dt + V_n(x, t, normal) * |grad(phi)| = 0
 * where phi <= 0 denotes burned cells and phi > 0 unburned cells.
 * Reuses `windShape` and `FUELS` from `packages/senda/src/wildfire.mjs` (Rothermel-form
 * wind ellipse and upslope tan^2 factor) with monotone Godunov / Rouy-Tourin upwind scheme
 * enforcing strict CFL <= 0.45 and hard causal gate `availableAtMs <= t0Ms`.
 *
 * Research/experimental ONLY: never authorizes public alerts or evacuation instructions.
 */
import { windShape, FUELS } from '../../../packages/senda/src/wildfire.mjs';
import { mulberry32, gaussian } from '../../senda-arr/src/arr-sim.mjs';

const finite = (x) => typeof x === 'number' && Number.isFinite(x);

/** Normal outward speed V_n (m/min) at cell (i, j) along front normal angle dirRad. */
export function localNormalRosMPerMin({
  fuelCode,
  windU_mps,
  windV_mps,
  slopeX,
  slopeY,
  normalDirRad,
  moistureDamping = 1,
  rosMult = 1,
  beta = 0.01,
}) {
  const fuel = FUELS[fuelCode];
  if (!fuel || fuel.r0 <= 0) return 0;
  const r0 = fuel.r0 * rosMult * Math.max(0.05, moistureDamping);
  const windMps = Math.hypot(windU_mps, windV_mps);
  const windKmh = windMps * 3.6;
  const { head, ecc } = windShape(windKmh);
  const windToRad = Math.atan2(windV_mps, windU_mps);
  const ellipse = windKmh > 0 ? (head * (1 - ecc)) / (1 - ecc * Math.cos(normalDirRad - windToRad)) : 1;
  // Directional slope along front normal: slopeTan > 0 means climbing uphill
  const dirX = Math.cos(normalDirRad);
  const dirY = Math.sin(normalDirRad);
  const slopeTan = dirX * slopeX + dirY * slopeY;
  const slopeK = 5.275 * beta ** -0.3;
  const slopeFactor = slopeTan > 0 ? slopeK * slopeTan * slopeTan : 0;
  return Math.max(0, r0 * ellipse * (1 + slopeFactor));
}

/** Validate grid, causal observation timestamps, and abstention gates. */
export function validateCausalFireInputs(grid, weather, { t0Ms, maxPerimeterAgeH = 12 } = {}) {
  if (!grid || !Number.isInteger(grid.w) || !Number.isInteger(grid.h) || grid.w < 4 || grid.h < 4 || !finite(grid.dxM) || grid.dxM <= 0) {
    return { ok: false, abstain: true, reason: 'INVALID_OR_MISSING_GRID' };
  }
  if (!grid.fuel || grid.fuel.length !== grid.w * grid.h || !grid.elev || grid.elev.length !== grid.w * grid.h) {
    return { ok: false, abstain: true, reason: 'MISSING_FUEL_OR_DEM' };
  }
  for (let k = 0; k < grid.w * grid.h; k++) {
    if (!FUELS[grid.fuel[k]] || !finite(grid.elev[k])) {
      return { ok: false, abstain: true, reason: 'UNKNOWN_FUEL_OR_NONFINITE_DEM' };
    }
  }
  if (!weather || !finite(weather.windU_mps) || !finite(weather.windV_mps)) {
    return { ok: false, abstain: true, reason: 'MISSING_METEOROLOGICAL_WIND' };
  }
  if (weather.isPostHocReanalysis === true) {
    return { ok: false, abstain: true, reason: 'TEMPORAL_LEAKAGE_POSTHOC_REANALYSIS_FORBIDDEN' };
  }
  if (!finite(t0Ms) || !finite(weather.availableAtMs)) {
    return { ok: false, abstain: true, reason: 'MISSING_CAUSAL_AVAILABILITY_TIMESTAMP' };
  }
  if (weather.availableAtMs > t0Ms) {
    return { ok: false, abstain: true, reason: 'TEMPORAL_LEAKAGE_FUTURE_FEATURE' };
  }
  if (finite(weather.perimeterObservedAtMs) && (t0Ms - weather.perimeterObservedAtMs) / 3_600_000 > maxPerimeterAgeH) {
    return { ok: false, abstain: true, reason: 'STALE_PERIMETER_BEYOND_LIMIT' };
  }
  if (finite(weather.moistureDamping) && (weather.moistureDamping <= 0 || weather.moistureDamping > 1.5)) {
    return { ok: false, abstain: true, reason: 'OUT_OF_DOMAIN_MOISTURE_FACTOR' };
  }
  return { ok: true, abstain: false, reason: null };
}

/** Godunov monotone upwind gradient magnitude for shrinking/expanding front with positive V_n. */
function godunovGradNorm(phi, w, h, dxM, i, j) {
  const c = j * w + i;
  const pc = phi[c];
  const pw = i > 0 ? phi[c - 1] : pc;
  const pe = i + 1 < w ? phi[c + 1] : pc;
  const ps = j > 0 ? phi[c - w] : pc;
  const pn = j + 1 < h ? phi[c + w] : pc;

  const dxBack = (pc - pw) / dxM;
  const dxFwd = (pe - pc) / dxM;
  const dyBack = (pc - ps) / dxM;
  const dyFwd = (pn - pc) / dxM;

  // For V_n >= 0 solving phi_t + V_n |grad phi| = 0 -> use Godunov upwind sqrt(max(D_x^-,0)^2 + min(D_x^+,0)^2 + ...)
  const gxPos = Math.max(dxBack, 0) ** 2 + Math.min(dxFwd, 0) ** 2;
  const gyPos = Math.max(dyBack, 0) ** 2 + Math.min(dyFwd, 0) ** 2;
  const gradMag = Math.sqrt(gxPos + gyPos);

  const nx = (pe - pw) / (2 * dxM);
  const ny = (pn - ps) / (2 * dxM);
  const nNorm = Math.hypot(nx, ny);
  const normalDirRad = nNorm > 1e-9 ? Math.atan2(ny, nx) : 0;

  return { gradMag, normalDirRad };
}

/**
 * Solve Hamilton-Jacobi level-set over [0, horizonMin] with strict CFL <= 0.45 substepping.
 * Returns monotonic arrival times (minutes), final signed phi, burned mask, and numerical audit stats.
 */
export function solveLevelSetUpwind({
  grid,
  phi0,
  weather,
  horizonMin = 120,
  cflTarget = 0.4,
  rosMult = 1,
  t0Ms = 0,
} = {}) {
  const gate = validateCausalFireInputs(grid, weather, { t0Ms });
  if (!gate.ok) {
    return {
      status: 'ABSTAIN',
      reason: gate.reason,
      abstained: true,
      canIssueEvacuationOrder: false,
      arrivalMin: null,
      burnedMask: null,
    };
  }
  if (!finite(horizonMin) || horizonMin <= 0 || !finite(cflTarget) || cflTarget <= 0 || cflTarget > 0.45) {
    throw new RangeError('Invalid horizonMin or CFL target (must enforce CFL <= 0.45)');
  }
  const { w, h, dxM, fuel, elev } = grid;
  if (!phi0 || phi0.length !== w * h) throw new RangeError('phi0 must match w*h');

  let phi = Float64Array.from(phi0);
  const arrivalMin = Float64Array.from(phi, (v) => (v <= 0 ? 0 : Infinity));
  const moisture = weather.moistureDamping ?? 1;

  // Precompute DEM slopes & max possible ROS for global CFL guarantee
  const slopeX = new Float64Array(w * h);
  const slopeY = new Float64Array(w * h);
  let maxRos = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const il = i > 0 ? k - 1 : k;
      const ir = i + 1 < w ? k + 1 : k;
      const jd = j > 0 ? k - w : k;
      const ju = j + 1 < h ? k + w : k;
      slopeX[k] = (elev[ir] - elev[il]) / ((ir === il ? 1 : 2) * dxM);
      slopeY[k] = (elev[ju] - elev[jd]) / ((ju === jd ? 1 : 2) * dxM);

      // Upper bound speed across wind-aligned direction for global CFL safety
      const rFast = localNormalRosMPerMin({
        fuelCode: fuel[k],
        windU_mps: weather.windU_mps,
        windV_mps: weather.windV_mps,
        slopeX: slopeX[k],
        slopeY: slopeY[k],
        normalDirRad: Math.atan2(weather.windV_mps, weather.windU_mps),
        moistureDamping: moisture,
        rosMult,
      });
      if (rFast > maxRos) maxRos = rFast;
    }
  }

  let tMin = 0;
  let steps = 0;
  let maxObservedCfl = 0;
  const maxStepCap = maxRos > 1e-9 ? (cflTarget * dxM) / maxRos : horizonMin;

  while (tMin < horizonMin - 1e-9) {
    const dt = Math.min(horizonMin - tMin, Math.max(1e-4, maxStepCap));
    const cfl = (maxRos * dt) / dxM;
    if (cfl > 0.45 + 1e-9) throw new Error(`CFL stability violation: ${cfl}`);
    if (cfl > maxObservedCfl) maxObservedCfl = cfl;

    const nextPhi = Float64Array.from(phi);
    const nextT = tMin + dt;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (FUELS[fuel[k]].r0 <= 0) continue;
        const { gradMag, normalDirRad } = godunovGradNorm(phi, w, h, dxM, i, j);
        if (gradMag <= 1e-12) continue;
        const vn = localNormalRosMPerMin({
          fuelCode: fuel[k],
          windU_mps: weather.windU_mps,
          windV_mps: weather.windV_mps,
          slopeX: slopeX[k],
          slopeY: slopeY[k],
          normalDirRad,
          moistureDamping: moisture,
          rosMult,
        });
        const updated = phi[k] - dt * vn * gradMag;
        nextPhi[k] = updated;
        if (updated <= 0 && !Number.isFinite(arrivalMin[k])) {
          arrivalMin[k] = nextT;
        }
      }
    }
    phi = nextPhi;
    tMin = nextT;
    steps++;
    if (steps > 50000) throw new Error('Max solver steps exceeded');
  }

  const burnedMask = Uint8Array.from(phi, (v) => (v <= 0 ? 1 : 0));
  return {
    status: 'PREDICTED_MODEL_ONLY',
    evidenceKind: 'PREDICTED',
    abstained: false,
    reason: null,
    canIssueEvacuationOrder: false,
    canPublicWarn: false,
    horizonMin,
    steps,
    maxObservedCfl: +maxObservedCfl.toFixed(4),
    maxRosMPerMin: +maxRos.toFixed(3),
    phi,
    arrivalMin,
    burnedMask,
  };
}

/** Probabilistic ensemble wrapping perturbed wind/ROS realizations over monotone Level-Set. */
export function ensembleLevelSetForecast({
  grid,
  phi0,
  weather,
  horizonMin = 120,
  members = 16,
  seed = 20261117,
  dirSdDeg = 12,
  windScaleSd = 0.18,
  rosSd = 0.22,
  t0Ms = 0,
} = {}) {
  const gate = validateCausalFireInputs(grid, weather, { t0Ms });
  if (!gate.ok) {
    return {
      status: 'ABSTAIN',
      abstained: true,
      reason: gate.reason,
      canIssueEvacuationOrder: false,
      probGrid: null,
    };
  }
  const rng = mulberry32(seed);
  const runs = [];
  for (let m = 0; m < members; m++) {
    const rot = (gaussian(rng) * dirSdDeg * Math.PI) / 180;
    const sc = Math.exp(gaussian(rng) * windScaleSd);
    const rm = Math.exp(gaussian(rng) * rosSd);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const pertWeather = {
      ...weather,
      windU_mps: (weather.windU_mps * c - weather.windV_mps * s) * sc,
      windV_mps: (weather.windU_mps * s + weather.windV_mps * c) * sc,
    };
    runs.push(solveLevelSetUpwind({ grid, phi0, weather: pertWeather, horizonMin, rosMult: rm, t0Ms }));
  }

  const nCells = grid.w * grid.h;
  const probGrid = new Float64Array(nCells);
  for (let k = 0; k < nCells; k++) {
    let hits = 0;
    for (const r of runs) if (r.burnedMask[k] === 1) hits++;
    probGrid[k] = hits / runs.length;
  }
  return {
    status: 'PREDICTED_ENSEMBLE_ONLY',
    evidenceKind: 'PREDICTED',
    abstained: false,
    members: runs.length,
    horizonMin,
    probGrid,
    canIssueEvacuationOrder: false,
    canPublicWarn: false,
  };
}

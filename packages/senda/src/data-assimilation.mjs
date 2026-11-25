/**
 * SENDA · Asimilación de datos de campo (N2+) en modelos físicos mediante Filtro de Kalman por Conjuntos (`data-assimilation.mjs`).
 *
 * Permite que las fotos y medidas peritadas en campo (nivel N2 o superior: marcas de calado en inundación,
 * aforos, perímetros o posiciones de frente de fuego) corrijan en tiempo real el estado y los parámetros
 * inciertos de los simuladores físicos (`shallow-water.mjs`, `fire4d.mjs`), reduciendo error y horquilla.
 *
 * Métodos y referencias:
 *  - Filtro de Kalman por Conjuntos (EnKF) con observaciones perturbadas:
 *    Evensen, G. (1994). «Sequential data assimilation with a nonlinear quasi-geostrophic model using
 *    Monte Carlo methods to forecast error statistics». JGR Oceans 99(C5): 10143–10162. DOI: 10.1029/94JC00572.
 *    Burgers, G., van Leeuwen, P. J. & Evensen, G. (1998). «Analysis scheme in the ensemble Kalman filter».
 *    Monthly Weather Review 126(6): 1719–1724. DOI: 10.1175/1520-0493(1998)126<1719:ASITEK>2.0.CO;2.
 *    Evensen, G. (2003). «The Ensemble Kalman Filter: theoretical formulation and practical implementation».
 *    Ocean Dynamics 53: 343–367. DOI: 10.1007/s10236-003-0036-9.
 *  - Localización espacial de soporte compacto (5.º orden):
 *    Gaspari, G. & Cohn, S. E. (1999). «Construction of correlation functions in two and three dimensions».
 *    Q. J. R. Meteorol. Soc. 125(554): 723–757. DOI: 10.1002/qj.49712555417.
 *  - Inflación multiplicativa de covarianza: Anderson, J. L. & Anderson, S. L. (1999), MWR 127:2741–2758.
 *
 * Regla de admisión: SOLO reportes con nivel N2, N3, N4 o N5 (y sin contradicción activa) entran en la
 * asimilación. Ningún reporte N0/N1 ni con `observationStd` faltante puede modificar un modelo físico.
 */

import { createSim, runUntil, piecewise } from './shallow-water.mjs';
import { agreement } from './flood-science.mjs';
import { PROTOCOL_LEVELS } from './report-protocol.mjs';

const ASSIMILABLE_LEVELS = new Set(['N2', 'N3', 'N4', 'N5']);

/** PRNG determinista Mulberry32 + Box-Muller para reproducibilidad exacta de conjuntos. */
export function seededNormalRng(seed) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    uniform: u,
    normal: () => Math.sqrt(-2 * Math.log(Math.max(1e-12, u()))) * Math.cos(2 * Math.PI * u()),
  };
}

/**
 * Puerta de admisión de observaciones de campo para asimilación:
 * solo admite expedientes peritados en N2 o superior, sin contradicción activa y con incertidumbre explícita.
 */
export function filterAssimilableObservations(observations) {
  if (!Array.isArray(observations)) throw new TypeError('observations debe ser un array');
  const accepted = [], rejected = [];
  for (const obs of observations) {
    if (!obs || typeof obs !== 'object') {
      rejected.push({ obs, reason: 'MALFORMED' });
      continue;
    }
    if (!ASSIMILABLE_LEVELS.has(obs.level)) {
      rejected.push({ id: obs.id ?? null, level: obs.level ?? null, reason: 'BELOW_N2_GATE' });
      continue;
    }
    if (obs.contradicted === true || obs.observationStatus === 'COLLECTION_ERROR') {
      rejected.push({ id: obs.id ?? null, reason: 'CONTRADICTED_OR_ERROR' });
      continue;
    }
    if (!Number.isFinite(obs.value) || !Number.isFinite(obs.observationStd) || obs.observationStd <= 0) {
      rejected.push({ id: obs.id ?? null, reason: 'MISSING_VALUE_OR_OBSERVATION_STD' });
      continue;
    }
    accepted.push(obs);
  }
  return Object.freeze({ accepted, rejected, minLevelRequired: 'N2', levelRanks: Object.fromEntries([...ASSIMILABLE_LEVELS].map((k) => [k, PROTOCOL_LEVELS[k].rank])) });
}

/**
 * Función de localización de Gaspari & Cohn (1999, ec. 4.10): soporte compacto en [0, 2c].
 * @param {number} dist distancia ≥ 0
 * @param {number} c radio de semilocalización (> 0; cae a 0 en 2c)
 */
export function gaspariCohnWeight(dist, c) {
  if (!Number.isFinite(dist) || dist < 0) throw new RangeError('dist debe ser ≥ 0');
  if (!Number.isFinite(c) || c <= 0) throw new RangeError('c (radio de localización) debe ser > 0');
  const r = dist / c;
  if (r >= 2) return 0;
  if (r <= 1) {
    return 1 - (1 / 4) * r ** 5 + (1 / 2) * r ** 4 + (5 / 8) * r ** 3 - (5 / 3) * r ** 2;
  }
  return (1 / 12) * r ** 5 - (1 / 2) * r ** 4 + (5 / 8) * r ** 3 + (5 / 3) * r ** 2 - 5 * r + 4 - (2 / 3) / r;
}

/** Resuelve A·X = B (A simétrica definida positiva m×m, B matriz m×k) por eliminación gaussiana con pivoteo parcial. */
function solveLinearSystem(A, B) {
  const m = A.length;
  const cols = B[0].length;
  const M = A.map((row, i) => [...row, ...B[i]]);
  for (let c = 0; c < m; c++) {
    let piv = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) throw new Error('matriz de innovación singular en EnKF');
    if (piv !== c) [M[c], M[piv]] = [M[piv], M[c]];
    const diag = M[c][c];
    for (let j = c; j < m + cols; j++) M[c][j] /= diag;
    for (let r = 0; r < m; r++) {
      if (r === c || Math.abs(M[r][c]) < 1e-15) continue;
      const f = M[r][c];
      for (let j = c; j < m + cols; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row.slice(m));
}

/**
 * Paso de análisis del Filtro de Kalman por Conjuntos (EnKF estocástico, Evensen 1994/2003; Burgers et al. 1998).
 *
 * @param {number[][]} ensemble  array de N_e vectores de estado x^(i) de dimensión n
 * @param {Array<{value:number, observationStd:number, level?:string, pos?:[number,number], observe:(state:number[])=>number}>} observations
 * @param {{
 *   seed:number,
 *   inflation?:number,
 *   statePositions?:Array<[number,number]>|null,
 *   localizationRadius?:number|null,
 *   bounds?:Array<[number,number]>|null,
 *   requireN2Gate?:boolean,
 * }} opts
 */
export function enkfUpdate(ensemble, observations, {
  seed,
  inflation = 1.0,
  statePositions = null,
  localizationRadius = null,
  bounds = null,
  requireN2Gate = true,
} = {}) {
  if (!Array.isArray(ensemble) || ensemble.length < 3) {
    throw new RangeError('enkfUpdate: se requiere un conjunto con al menos 3 miembros');
  }
  if (!Number.isSafeInteger(seed)) throw new TypeError('enkfUpdate: seed entera obligatoria para reproducibilidad');
  if (!Number.isFinite(inflation) || inflation < 1.0 || inflation > 2.0) {
    throw new RangeError('enkfUpdate: inflation debe estar en [1.0, 2.0]');
  }

  const obsList = requireN2Gate ? filterAssimilableObservations(observations).accepted : observations;
  const Ne = ensemble.length;
  const n = ensemble[0].length;
  const m = obsList.length;

  if (m === 0) {
    return Object.freeze({
      basis: 'MODEL',
      assimilatedCount: 0,
      analysisEnsemble: ensemble.map((x) => [...x]),
      forecastMean: meanVector(ensemble),
      analysisMean: meanVector(ensemble),
      forecastSpread: spreadVector(ensemble),
      analysisSpread: spreadVector(ensemble),
    });
  }

  // 1. Media de pronóstico e inflación multiplicativa de anomalías
  const xBar = meanVector(ensemble);
  const Xf = ensemble.map((x) => x.map((v, k) => xBar[k] + inflation * (v - xBar[k])));
  const Af = Xf.map((x) => x.map((v, k) => v - xBar[k]));

  // 2. Proyección al espacio de observaciones H(x^(i))
  const Yf = Xf.map((x) => obsList.map((o) => {
    if (typeof o.observe === 'function') return o.observe(x);
    if (Number.isInteger(o.stateIndex)) return x[o.stateIndex];
    throw new TypeError('cada observación requiere `observe(state)` o `stateIndex`');
  }));
  const yBar = meanVector(Yf);
  const Ay = Yf.map((y) => y.map((v, j) => v - yBar[j]));

  // 3. Covarianzas muestrales P_xy (n×m) y S = P_yy + R (m×m)
  const scale = 1 / (Ne - 1);
  const Pxy = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < Ne; i++) {
    for (let k = 0; k < n; k++) {
      const ak = Af[i][k];
      for (let j = 0; j < m; j++) Pxy[k][j] += ak * Ay[i][j];
    }
  }
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < m; j++) {
      Pxy[k][j] *= scale;
      if (localizationRadius && statePositions?.[k] && obsList[j].pos) {
        const d = Math.hypot(statePositions[k][0] - obsList[j].pos[0], statePositions[k][1] - obsList[j].pos[1]);
        Pxy[k][j] *= gaspariCohnWeight(d, localizationRadius);
      }
    }
  }

  const S = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let i = 0; i < Ne; i++) {
    for (let a = 0; a < m; a++) {
      for (let b = 0; b < m; b++) S[a][b] += Ay[i][a] * Ay[i][b];
    }
  }
  for (let a = 0; a < m; a++) {
    for (let b = 0; b < m; b++) {
      S[a][b] *= scale;
      if (localizationRadius && obsList[a].pos && obsList[b].pos) {
        const d = Math.hypot(obsList[a].pos[0] - obsList[b].pos[0], obsList[a].pos[1] - obsList[b].pos[1]);
        S[a][b] *= gaspariCohnWeight(d, localizationRadius);
      }
    }
    S[a][a] += obsList[a].observationStd ** 2;
  }

  // 4. Ganancia de Kalman K = P_xy · S^(-1) (resolvemos S · K^T = P_xy^T)
  const PxyT = Array.from({ length: m }, (_, j) => Array.from({ length: n }, (_, k) => Pxy[k][j]));
  const KT = solveLinearSystem(S, PxyT);

  // 5. Observaciones perturbadas centradas (Burgers et al. 1998) y actualización por miembro
  const rng = seededNormalRng(seed);
  const rawEps = Array.from({ length: Ne }, () => obsList.map((o) => rng.normal() * o.observationStd));
  // Centrar perturbaciones para no introducir sesgo de muestreo en conjuntos pequeños
  const meanEps = meanVector(rawEps);
  const Xa = new Array(Ne);
  for (let i = 0; i < Ne; i++) {
    const innov = obsList.map((o, j) => o.value + (rawEps[i][j] - meanEps[j]) - Yf[i][j]);
    const next = new Array(n);
    for (let k = 0; k < n; k++) {
      let delta = 0;
      for (let j = 0; j < m; j++) delta += KT[j][k] * innov[j];
      let val = Xf[i][k] + delta;
      if (bounds?.[k]) {
        const [lo, hi] = bounds[k];
        if (Number.isFinite(lo)) val = Math.max(lo, val);
        if (Number.isFinite(hi)) val = Math.min(hi, val);
      }
      next[k] = val;
    }
    Xa[i] = next;
  }

  return Object.freeze({
    basis: 'MODEL',
    method: 'EnKF estocástico (Evensen 1994/2003; Burgers et al. 1998)',
    assimilatedCount: m,
    kalmanGain: Array.from({ length: n }, (_, k) => Array.from({ length: m }, (_, j) => KT[j][k])),
    analysisEnsemble: Xa,
    forecastMean: xBar,
    analysisMean: meanVector(Xa),
    forecastSpread: spreadVector(Xf),
    analysisSpread: spreadVector(Xa),
  });
}

function meanVector(mat) {
  const N = mat.length, d = mat[0].length;
  const out = new Array(d).fill(0);
  for (let i = 0; i < N; i++) for (let k = 0; k < d; k++) out[k] += mat[i][k];
  for (let k = 0; k < d; k++) out[k] /= N;
  return out;
}

function spreadVector(mat) {
  const N = mat.length, d = mat[0].length, mu = meanVector(mat);
  const out = new Array(d).fill(0);
  for (let i = 0; i < N; i++) for (let k = 0; k < d; k++) out[k] += (mat[i][k] - mu[k]) ** 2;
  for (let k = 0; k < d; k++) out[k] = Math.sqrt(out[k] / Math.max(1, N - 1));
  return out;
}

/** Cuantil lineal sobre array ordenado. */
function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Demostración operativa de asimilación hidrodinámica (`shallow-water.mjs` + EnKF):
 * Un conjunto de simulaciones con caudal de entrada y rugosidad de Manning inciertos
 * asimila marcas de calado ciudadano peritadas (N2+) a mitad del episodio (`tAssimilateS`),
 * corrige tanto los calados como los parámetros latentes y continúa hasta `tEndS`.
 * Devuelve métricas comparadas (bucle abierto sin asimilar vs asimilado): RMSE, CSI y horquilla 90 %.
 */
export function runFloodAssimilationExperiment({
  w,
  h,
  z,
  dx,
  sink,
  inflowCells,
  baseHydrograph, // [[tS, Q], ...]
  truthParams,    // { inflowScale, manningN }
  priorMembers,   // [{ inflowScale, manningN }, ...]
  fieldMarks,     // [{ id, level, cellIndex, observationStd, contradicted? }]
  tAssimilateS,
  tEndS,
  wetThresholdM = 0.1,
  dtMax = 5,
  seed = 42,
}) {
  if (!Array.isArray(priorMembers) || priorMembers.length < 4) {
    throw new RangeError('se requieren al menos 4 miembros en priorMembers');
  }
  const N = w * h;
  const runScaled = (params, tStop, initSim = null) => {
    const S = initSim ?? createSim({ w, h, z, dx, n: params.manningN, sink, hArrive: wetThresholdM });
    const pts = baseHydrograph.map(([t, q]) => [t, q * params.inflowScale]);
    runUntil(S, tStop, { inflow: piecewise(pts), cells: inflowCells, dtMax });
    return S;
  };

  // 1. Realidad de referencia (sintética controlada para medir RMSE/CSI exactos)
  const truthMid = runScaled(truthParams, tAssimilateS);
  const truthObs = fieldMarks.map((fm) => ({
    ...fm,
    value: fm.value ?? truthMid.d[fm.cellIndex],
    observe: (state) => state[fm.cellIndex],
  }));
  const truthEnd = runScaled(truthParams, tEndS, truthMid);
  const truthMask = Uint8Array.from(truthEnd.maxD, (v) => (v >= wetThresholdM ? 1 : 0));

  // 2. Pronóstico en bucle abierto (open-loop, sin asimilación) hasta tAssimilateS y tEndS
  const midSims = priorMembers.map((p) => runScaled(p, tAssimilateS));
  const openEndSims = priorMembers.map((p) => runScaled(p, tEndS));

  // 3. Vector de estado aumentado [d_0..d_{N-1}, inflowScale, manningN] → EnKF en tAssimilateS
  const augmented = midSims.map((S, i) => [...S.d, priorMembers[i].inflowScale, priorMembers[i].manningN]);
  const bounds = [
    ...Array.from({ length: N }, () => [0, 50]),
    [0.2, 4.0],     // inflowScale físico positivo
    [0.015, 0.25],  // Manning n físico
  ];
  const upd = enkfUpdate(augmented, truthObs, { seed, inflation: 1.04, bounds, requireN2Gate: true });

  // 4. Continuar los miembros analizados desde tAssimilateS hasta tEndS con estado y parámetros corregidos
  const assimEndSims = midSims.map((S, i) => {
    const anal = upd.analysisEnsemble[i];
    const correctedN = anal[N + 1];
    const correctedScale = anal[N];
    const nextSim = createSim({ w, h, z, dx, n: correctedN, sink, hArrive: wetThresholdM });
    for (let k = 0; k < N; k++) {
      nextSim.d[k] = anal[k];
      nextSim.maxD[k] = Math.max(S.maxD[k], anal[k]);
    }
    nextSim.qx.set(S.qx);
    nextSim.qy.set(S.qy);
    nextSim.t = S.t;
    nextSim.box = S.box ? [...S.box] : [0, w - 1, 0, h - 1];
    return runScaled({ inflowScale: correctedScale, manningN: correctedN }, tEndS, nextSim);
  });

  const evalEnsemble = (sims) => {
    const meanMaxD = new Float64Array(N);
    let spreadSum = 0, wetCells = 0;
    for (let k = 0; k < N; k++) {
      const vals = sims.map((S) => S.maxD[k]).sort((a, b) => a - b);
      meanMaxD[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (truthEnd.maxD[k] >= wetThresholdM || meanMaxD[k] >= wetThresholdM) {
        spreadSum += quantile(vals, 0.95) - quantile(vals, 0.05);
        wetCells++;
      }
    }
    let sqErr = 0;
    for (let k = 0; k < N; k++) sqErr += (meanMaxD[k] - truthEnd.maxD[k]) ** 2;
    const rmseM = Math.sqrt(sqErr / N);
    const predMask = Uint8Array.from(meanMaxD, (v) => (v >= wetThresholdM ? 1 : 0));
    const agr = agreement(predMask, truthMask);
    return {
      rmseM: +rmseM.toFixed(4),
      csi: +agr.csi.toFixed(4),
      hitRate: +agr.hitRate.toFixed(4),
      falseAlarmRatio: +agr.falseAlarmRatio.toFixed(4),
      meanHorquilla90M: wetCells ? +(spreadSum / wetCells).toFixed(4) : 0,
    };
  };

  const openMetrics = evalEnsemble(openEndSims);
  const assimMetrics = evalEnsemble(assimEndSims);
  const admitted = filterAssimilableObservations(truthObs);

  return Object.freeze({
    basis: 'SCENARIO',
    method: 'EnKF estado+parámetros sobre shallow-water.mjs (Evensen 1994/2003)',
    assimilatedMarks: admitted.accepted.length,
    rejectedMarks: admitted.rejected.length,
    inflowScalePriorMean: +(priorMembers.reduce((s, p) => s + p.inflowScale, 0) / priorMembers.length).toFixed(3),
    inflowScalePosteriorMean: +(upd.analysisMean[N]).toFixed(3),
    inflowScaleTruth: truthParams.inflowScale,
    manningPriorMean: +(priorMembers.reduce((s, p) => s + p.manningN, 0) / priorMembers.length).toFixed(4),
    manningPosteriorMean: +(upd.analysisMean[N + 1]).toFixed(4),
    manningTruth: truthParams.manningN,
    openLoop: openMetrics,
    assimilated: assimMetrics,
    improvement: Object.freeze({
      deltaCsi: +(assimMetrics.csi - openMetrics.csi).toFixed(4),
      rmseReductionPct: openMetrics.rmseM > 0 ? +(((openMetrics.rmseM - assimMetrics.rmseM) / openMetrics.rmseM) * 100).toFixed(1) : 0,
      horquillaReductionPct: openMetrics.meanHorquilla90M > 0 ? +(((openMetrics.meanHorquilla90M - assimMetrics.meanHorquilla90M) / openMetrics.meanHorquilla90M) * 100).toFixed(1) : 0,
    }),
  });
}

/**
 * Demostración de asimilación de perímetro de incendio (frente direccional + EnKF):
 * actualiza la velocidad de cabeza `rosHeadMMin` y dirección de avance `spreadToDeg`
 * con detecciones N2+ de avance del frente en azimuts observados.
 */
export function assimilateFireFrontObservations({
  priorMembers, // [{ rosHeadMMin, windKmh, spreadToDeg }]
  observations, // [{ id, level, tMin, azimuthDeg, frontDistM, observationStd }]
  seed = 7,
}) {
  const rad = (d) => (d * Math.PI) / 180;
  const distAlong = (rosHead, windKmh, spreadToDeg, azDeg, tMin) => {
    const LB = 1 + 8.729 * (1 - Math.exp(-0.030 * Math.max(0, windKmh))) ** 2.155;
    const ecc = Math.sqrt(Math.max(0, 1 - 1 / (LB * LB)));
    const rosAz = (rosHead * (1 - ecc)) / Math.max(0.05, 1 - ecc * Math.cos(rad(azDeg - spreadToDeg)));
    return rosAz * tMin;
  };
  const stateEnsemble = priorMembers.map((m) => [m.rosHeadMMin, m.windKmh, m.spreadToDeg]);
  const mappedObs = observations.map((o) => ({
    ...o,
    value: o.frontDistM,
    observe: (st) => distAlong(st[0], st[1], st[2], o.azimuthDeg, o.tMin),
  }));
  const res = enkfUpdate(stateEnsemble, mappedObs, {
    seed,
    inflation: 1.03,
    bounds: [[0.5, 120], [0, 140], [-360, 720]],
    requireN2Gate: true,
  });
  return Object.freeze({
    basis: 'MODEL',
    assimilatedCount: res.assimilatedCount,
    priorMean: { rosHeadMMin: +res.forecastMean[0].toFixed(2), windKmh: +res.forecastMean[1].toFixed(2), spreadToDeg: +(((res.forecastMean[2] % 360) + 360) % 360).toFixed(1) },
    posteriorMean: { rosHeadMMin: +res.analysisMean[0].toFixed(2), windKmh: +res.analysisMean[1].toFixed(2), spreadToDeg: +(((res.analysisMean[2] % 360) + 360) % 360).toFixed(1) },
    priorSpreadRos: +res.forecastSpread[0].toFixed(2),
    posteriorSpreadRos: +res.analysisSpread[0].toFixed(2),
    analysisEnsemble: res.analysisEnsemble,
  });
}

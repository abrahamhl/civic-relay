/**
 * SENDA RoadSafe · Modelo de gravedad ajustado sobre datos oficiales (regresión logística multivariante).
 *
 * Pregunta: entre accidentes CON VÍCTIMAS, ¿qué circunstancias se asocian a un desenlace MORTAL,
 * controlando a la vez por las demás? (Los OR univariantes mezclan factores: p. ej. la noche coincide
 * con más vía interurbana.) Resultado: OR AJUSTADOS con IC 95 % (Wald, matriz de información de Fisher),
 * efectos fijos por país (las definiciones y coberturas nacionales difieren) y validación:
 *  - partición 80/20 aleatoria con semilla: AUC (Mann–Whitney), Brier y tabla de calibración por deciles;
 *  - «dejar un país fuera»: se ajusta sin un país y se evalúa en él (transferibilidad).
 * Ajuste por IRLS (Newton) con penalización L2 pequeña declarada para estabilidad numérica.
 *
 * Esto es «calculado por este código» sobre ficheros oficiales con SHA-256: gravedad condicionada, NO
 * probabilidad de accidentarse (no hay exposición), NO causalidad.
 */

/** Variables (binarias) y su construcción desde el registro armonizado. Desconocido → indicador propio. */
export const FEATURES = Object.freeze([
  ['dark', (r) => r.light?.startsWith('DARK')], ['darkUnlit', (r) => r.light === 'DARK_UNLIT'], ['twilight', (r) => r.light === 'TWILIGHT'], ['lightUnknown', (r) => r.light === 'UNKNOWN'],
  ['wet', (r) => r.surface === 'WET'], ['iceSnow', (r) => r.surface === 'ICE_SNOW'], ['fog', (r) => r.weather === 'FOG'],
  ['rural', (r) => r.area === 'RURAL'], ['areaUnknown', (r) => r.area === 'UNKNOWN'],
  ['motorway', (r) => r.roadClass === 'MOTORWAY'], ['dualCarriageway', (r) => r.roadClass === 'DUAL_CARRIAGEWAY'],
  ['curve', (r) => r.curve === true], ['intersection', (r) => r.intersection === true],
  ['hardShoulder', (r) => r.onHardShoulder === true], ['stoppedVehicle', (r) => r.stoppedVehicleInvolved === true],
  ['rearEndOrChain', (r) => ['REAR_END', 'MULTI_VEHICLE_CHAIN'].includes(r.collision)], ['headOn', (r) => r.collision === 'HEAD_ON'],
  ['pedestrian', (r) => r.collision === 'PEDESTRIAN' || r.involves?.pedestrian === true], ['runOffRoad', (r) => r.collision === 'RUN_OFF_ROAD'],
  ['hgv', (r) => r.involves?.hgv === true], ['night0to6', (r) => r.hour != null && r.hour < 6],
  ['cDE', (r) => r.country === 'DE'], ['cNL', (r) => r.country === 'NL'], ['cFR', (r) => r.country === 'FR'], ['cGB', (r) => r.country === 'GB'],
]);
export const FEATURE_NAMES = Object.freeze(FEATURES.map(([n]) => n));
const injury = (r) => ['FATAL', 'SERIOUS', 'SLIGHT', 'INJURY'].includes(r.severity);

export function featurize(r) { const x = new Float64Array(FEATURES.length + 1); x[0] = 1; FEATURES.forEach(([, f], i) => { x[i + 1] = f(r) ? 1 : 0; }); return x; }

/** Resolución de A·x = b (Gauss con pivoteo parcial); A simétrica pequeña. Devuelve también la inversa. */
function solveAndInvert(A) {
  const n = A.length, M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; if (Math.abs(d) < 1e-12) throw new Error('matriz singular');
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((row) => row.slice(n));
}
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** IRLS con L2 (λ declarado; no se penaliza el intercepto). X: Float64Array[], y: 0/1. */
export function fitLogistic(X, y, { l2, maxIter = 30, tol = 1e-8 } = {}) {
  if (!Number.isFinite(l2) || l2 < 0) throw new Error('fitLogistic exige λ (l2) declarado');
  const p = X[0].length; let beta = new Float64Array(p), iter = 0, cov = null;
  for (; iter < maxIter; iter++) {
    const H = Array.from({ length: p }, () => new Float64Array(p)), g = new Float64Array(p);
    for (let i = 0; i < X.length; i++) {
      const x = X[i]; let z = 0; for (let j = 0; j < p; j++) z += x[j] * beta[j];
      const mu = sigmoid(z), w = Math.max(1e-10, mu * (1 - mu)), r = y[i] - mu;
      for (let j = 0; j < p; j++) { if (!x[j]) continue; g[j] += x[j] * r; for (let k = j; k < p; k++) if (x[k]) H[j][k] += w * x[j] * x[k]; }
    }
    for (let j = 0; j < p; j++) { for (let k = 0; k < j; k++) H[j][k] = H[k][j]; if (j > 0) { H[j][j] += l2; g[j] -= l2 * beta[j]; } }
    cov = solveAndInvert(H.map((r) => Array.from(r)));
    const step = new Float64Array(p); for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) step[j] += cov[j][k] * g[k];
    let mx = 0; for (let j = 0; j < p; j++) { beta[j] += step[j]; mx = Math.max(mx, Math.abs(step[j])); }
    if (mx < tol) { iter++; break; }
  }
  return { beta: Array.from(beta), cov, iterations: iter };
}
export const predict = (model, x) => { let z = 0; for (let j = 0; j < x.length; j++) z += x[j] * model.beta[j]; return sigmoid(z); };

/** AUC por Mann–Whitney (empates a la mitad). */
export function auc(scores, labels) {
  const idx = scores.map((s, i) => i).sort((a, b) => scores[a] - scores[b]);
  let rank = 0, sumPos = 0, nPos = 0, i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) if (labels[idx[k]]) { sumPos += avg; nPos++; } i = j + 1; rank = j; }
  const nNeg = labels.length - nPos; return nPos && nNeg ? +((sumPos - nPos * (nPos + 1) / 2) / (nPos * nNeg)).toFixed(4) : null;
}
export const brier = (scores, labels) => +(scores.reduce((s, p, i) => s + (p - labels[i]) ** 2, 0) / scores.length).toFixed(5);
export function calibrationTable(scores, labels, bins = 10) {
  const idx = scores.map((s, i) => i).sort((a, b) => scores[a] - scores[b]), out = [];
  for (let b = 0; b < bins; b++) { const part = idx.slice(Math.floor(b * idx.length / bins), Math.floor((b + 1) * idx.length / bins)); if (!part.length) continue; out.push({ bin: b + 1, n: part.length, predicted: +(part.reduce((s, i) => s + scores[i], 0) / part.length).toFixed(4), observed: +(part.reduce((s, i) => s + labels[i], 0) / part.length).toFixed(4) }); }
  return out;
}
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** Ajuste completo + validación. records: registros armonizados. */
export function fitSeverityModel(records, { l2 = 1, seed = 2026, testShare = 0.2, countries = null } = {}) {
  const data = records.filter(injury).filter((r) => !countries || countries.includes(r.country));
  const X = data.map(featurize), y = data.map((r) => (r.severity === 'FATAL' ? 1 : 0));
  const r = rng(seed), isTest = data.map(() => r() < testShare);
  const tr = X.filter((_, i) => !isTest[i]), ytr = y.filter((_, i) => !isTest[i]);
  // Quitar columnas constantes (p. ej. un país ausente) para evitar singularidad
  const active = FEATURE_NAMES.map((_, j) => tr.some((x) => x[j + 1]) && tr.some((x) => !x[j + 1]));
  const cols = [0, ...active.map((a, j) => (a ? j + 1 : -1)).filter((j) => j > 0)], sub = (x) => Float64Array.from(cols.map((c) => x[c]));
  const m = fitLogistic(tr.map(sub), ytr, { l2 });
  const te = X.filter((_, i) => isTest[i]).map(sub), yte = y.filter((_, i) => isTest[i]), s = te.map((x) => predict(m, x));
  const names = ['intercept', ...cols.slice(1).map((c) => FEATURE_NAMES[c - 1])];
  const coef = names.map((name, j) => { const se = Math.sqrt(m.cov[j][j]); return { name, beta: +m.beta[j].toFixed(4), se: +se.toFixed(4), or: +Math.exp(m.beta[j]).toFixed(3), ci: [+Math.exp(m.beta[j] - 1.96 * se).toFixed(3), +Math.exp(m.beta[j] + 1.96 * se).toFixed(3)], significant: Math.abs(m.beta[j] / se) > 1.96 }; });
  return {
    schema: 'senda-roadsafe-severity-model/1', basis: 'FITTED_ON_OFFICIAL_DATA — gravedad condicionada (accidentes con víctimas); no exposición, no causalidad',
    l2, seed, nTrain: tr.length, nTest: te.length, events: y.reduce((a, b) => a + b, 0), iterations: m.iterations, coefficients: coef,
    model: { names, beta: m.beta.map((b) => +b.toFixed(6)) },
    test: { auc: auc(s, yte), brier: brier(s, yte), baseRate: +(yte.reduce((a, b) => a + b, 0) / yte.length).toFixed(4), calibration: calibrationTable(s, yte) },
  };
}

/** Transferibilidad: ajustar sin un país (sin su efecto fijo) y evaluar en ese país. */
export function leaveOneCountryOut(records, { l2 = 1 } = {}) {
  const countries = [...new Set(records.filter(injury).map((r) => r.country))], out = [];
  for (const c of countries) {
    const train = records.filter((r) => injury(r) && r.country !== c), test = records.filter((r) => injury(r) && r.country === c);
    const strip = (x) => { const z = Float64Array.from(x); FEATURE_NAMES.forEach((n, j) => { if (n.startsWith('c') && n.length === 3) z[j + 1] = 0; }); return z; };
    const Xtr = train.map((r) => strip(featurize(r))), ytr = train.map((r) => (r.severity === 'FATAL' ? 1 : 0));
    const active = FEATURE_NAMES.map((n, j) => !(n.startsWith('c') && n.length === 3) && Xtr.some((x) => x[j + 1]) && Xtr.some((x) => !x[j + 1]));
    const cols = [0, ...active.map((a, j) => (a ? j + 1 : -1)).filter((j) => j > 0)], sub = (x) => Float64Array.from(cols.map((k) => x[k]));
    const m = fitLogistic(Xtr.map(sub), ytr, { l2 });
    const s = test.map((r) => predict(m, sub(strip(featurize(r))))), y = test.map((r) => (r.severity === 'FATAL' ? 1 : 0));
    const meanP = s.reduce((a, b) => a + b, 0) / s.length, obs = y.reduce((a, b) => a + b, 0) / y.length;
    out.push({ heldOut: c, n: test.length, auc: auc(s, y), brier: brier(s, y), meanPredicted: +meanP.toFixed(4), observed: +obs.toFixed(4) });
  }
  return { basis: 'FITTED_ON_OFFICIAL_DATA — validación dejando un país fuera (sin su efecto fijo)', rows: out, note: 'AUC mide discriminación transferible; la diferencia predicho/observado refleja definiciones y coberturas nacionales distintas.' };
}

/**
 * Probabilidad de desenlace mortal SI hay un accidente con víctimas en estas circunstancias, con el modelo
 * publicado (JSON). Entrada: registro parcial armonizado. Sin modelo cargado ⇒ null (no se inventa).
 */
export function severityProbability(record, published) {
  if (!published?.model?.names || !published.model.beta) return { p: null, basis: 'MODELO NO CARGADO' };
  const full = featurize(record), idx = new Map(['intercept', ...FEATURE_NAMES].map((n, i) => [n, i]));
  const x = published.model.names.map((n) => full[idx.get(n)] ?? 0);
  return { p: +predict({ beta: published.model.beta }, x).toFixed(4), basis: published.basis, auc: published.test?.auc ?? null };
}

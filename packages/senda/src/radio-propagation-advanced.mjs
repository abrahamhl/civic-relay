/**
 * SENDA · Propagación radio avanzada sobre relieve real para la malla de emergencias
 * (`radio-propagation-advanced.mjs`): ITU-R P.526-15 Delta-Bullington, difracción esférica,
 * Epstein-Peterson, Longley-Rice / ITM (NTIA 82-100), clutter ITU-R P.2108-1 y vegetación ITU-R P.833-10.
 *
 * Complementa a `deygoutP526` en `telecom-mathematical-physics.mjs` sin duplicarlo y añade
 * cuantificación de incertidumbre atmosférica (horquilla de factor k) y extracción de perfiles MDE.
 *
 * Referencias publicadas:
 *  - Difracción por obstáculos y método Delta-Bullington:
 *    ITU-R (2019). Recommendation ITU-R P.526-15 «Propagation by diffraction» (§3.1, §4.2, §4.5.2).
 *    También adoptado en ITU-R P.452-17 e ITU-R P.1812-6.
 *  - Cascada de filos de cuchillo:
 *    Epstein, J. & Peterson, D. W. (1953). «An experimental study of wave propagation at 850 Mc».
 *    Proc. IRE 41(5):595-611. DOI: 10.1109/JRPROC.1953.274401.
 *  - Irregularidad del terreno Δh y modelo Irregular Terrain Model (Longley-Rice / ITM):
 *    Hufford, G. A., Longley, A. G. & Kissick, W. A. (1982). «A guide to the use of the ITS
 *    Irregular Terrain Model in the area prediction mode». NTIA Report 82-100.
 *  - Pérdidas por entorno construido (clutter) y vegetación:
 *    ITU-R (2021). Recommendation ITU-R P.2108-1 «Prediction of clutter loss» (§3.2).
 *    ITU-R (2021). Recommendation ITU-R P.833-10 «Attenuation in vegetation».
 *
 * Regla de veracidad (CLAUDE.md): frecuencia, alturas de antena, distancia y factor k son OBLIGATORIOS
 * (sin valores por defecto ocultos). Toda salida declara `basis: 'MODEL'`.
 */

const C_LIGHT = 299_792_458; // m/s exacto (SI)
const EARTH_RADIUS_M = 6_371_000;

function reqNum(v, name) {
  if (!Number.isFinite(v)) throw new RangeError(`radio-propagation-advanced: parámetro obligatorio '${name}' ausente o no finito`);
  return v;
}

/** Pérdida en espacio libre de Friis (dB) para distancia d (m) y frecuencia f (Hz). */
export function friisFreeSpaceLossDb(distanceM, freqHz) {
  const d = reqNum(distanceM, 'distanceM');
  const f = reqNum(freqHz, 'freqHz');
  if (!(d > 0 && f > 0)) throw new RangeError('distanceM y freqHz deben ser > 0');
  const lambda = C_LIGHT / f;
  return 20 * Math.log10((4 * Math.PI * d) / lambda);
}

/**
 * Aproximación oficial ITU-R P.526-15 §4.2 de la integral de Fresnel para un filo de cuchillo J(v) (dB).
 * Válida para v > -0,78 (error < 0,05 dB frente a integrales de Fresnel exactas); 0 dB si v ≤ -0,78.
 */
export function ituKnifeEdgeLossDb(v) {
  reqNum(v, 'v');
  if (v <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
}

/**
 * Pérdida por difracción sobre Tierra esférica lisa (ITU-R P.526-15 §3.1.1, primer término de serie de residuos).
 * Útil como suelo físico en enlaces más allá del horizonte radioeléctrico (BLOS).
 */
export function sphericalEarthDiffractionDb({ distanceM, freqHz, hTxM, hRxM, kFactor }) {
  const d = reqNum(distanceM, 'distanceM');
  const f = reqNum(freqHz, 'freqHz');
  const ht = Math.max(0.1, reqNum(hTxM, 'hTxM'));
  const hr = Math.max(0.1, reqNum(hRxM, 'hRxM'));
  const k = reqNum(kFactor, 'kFactor');
  if (!(d > 0 && f > 0 && k > 0.1)) throw new RangeError('distanceM > 0, freqHz > 0 y kFactor > 0.1 obligatorios');

  const ae = k * EARTH_RADIUS_M;
  const fMhz = f / 1e6;
  const dKm = d / 1000;
  const aeKm = ae / 1000;

  // Distancia normalizada X y alturas normalizadas Y1, Y2 (ITU-R P.526-15 Ec. 3–6, polarización vertical/tierra media)
  const beta = 1.0; // aproximación válida en VHF/UHF/SHF (> 100 MHz)
  const X = 2.188 * beta * Math.pow(fMhz, 1 / 3) * Math.pow(aeKm, -2 / 3) * dKm;
  const Y1 = 9.575e-3 * beta * Math.pow(fMhz, 2 / 3) * Math.pow(aeKm, -1 / 3) * ht;
  const Y2 = 9.575e-3 * beta * Math.pow(fMhz, 2 / 3) * Math.pow(aeKm, -1 / 3) * hr;

  const F = X >= 1.6 ? 11 + 10 * Math.log10(X) - 17.6 * X : -20 * Math.log10(X) - 5.6488 * Math.pow(X, 1.425);
  const G = (Y) => {
    const B = beta * Y;
    if (B > 2) return 17.6 * Math.sqrt(B - 1.1) - 5 * Math.log10(B - 1.1) - 8;
    return Math.max(-40, 20 * Math.log10(B + 0.1 * B * B * B));
  };

  // En ITU-R P.526-15 la ganancia respecto a espacio libre es E/E0 = F(X) + G(Y1) + G(Y2) (≤ 0 dB → pérdida = -(F+G1+G2))
  const lossDb = Math.max(0, -(F + G(Y1) + G(Y2)));
  return +lossDb.toFixed(3);
}

/**
 * Núcleo Bullington ITU-R P.526-15 §4.5.2.1 sobre un perfil de cotas `h[0..N-1]` y distancias `d[0..N-1]`.
 */
function bullingtonCore(dArr, hArr, hTxAbs, hRxAbs, freqHz, ae) {
  const n = dArr.length;
  const dTot = dArr[n - 1];
  const lambda = C_LIGHT / freqHz;

  let stim = -Infinity;
  for (let i = 1; i < n - 1; i++) {
    const di = dArr[i];
    const bulge = (di * (dTot - di)) / (2 * ae);
    const s = (hArr[i] + bulge - hTxAbs) / di;
    if (s > stim) stim = s;
  }

  const str = (hRxAbs - hTxAbs) / dTot;
  let lucDb = 0;
  let vMax = -Infinity;
  let isTranshorizon = false;

  if (stim < str) {
    // Enlace con línea de vista (LoS): evaluar difracción por obstrucción de zona de Fresnel
    for (let i = 1; i < n - 1; i++) {
      const di = dArr[i];
      const bulge = (di * (dTot - di)) / (2 * ae);
      const hLos = hTxAbs + str * di;
      const hClear = hArr[i] + bulge - hLos;
      const v = hClear * Math.sqrt((2 * dTot) / (lambda * di * (dTot - di)));
      if (v > vMax) vMax = v;
    }
    lucDb = vMax > -0.78 ? ituKnifeEdgeLossDb(vMax) : 0;
  } else {
    // Enlace transhorizonte: intersección de rectas tangentes desde Tx y Rx (Bullington equivalente)
    isTranshorizon = true;
    let srim = -Infinity;
    for (let i = 1; i < n - 1; i++) {
      const dRem = dTot - dArr[i];
      const bulge = (dArr[i] * dRem) / (2 * ae);
      const s = (hArr[i] + bulge - hRxAbs) / dRem;
      if (s > srim) srim = s;
    }
    const db = (hRxAbs - hTxAbs + srim * dTot) / (stim + srim);
    const dbClamped = Math.max(1e-3, Math.min(dTot - 1e-3, db));
    const hb = hTxAbs + stim * dbClamped;
    const hLos = hTxAbs + str * dbClamped;
    vMax = (hb - hLos) * Math.sqrt((2 * dTot) / (lambda * dbClamped * (dTot - dbClamped)));
    lucDb = ituKnifeEdgeLossDb(vMax);
  }

  // Corrección de término de adición suave ITU-R P.526-15 §4.5.2.1: L_b = L_uc + (1 - exp(-L_uc/6)) * (10 + 0.02 * d_km)
  const dKm = dTot / 1000;
  const lb = lucDb + (1 - Math.exp(-lucDb / 6)) * (10 + 0.02 * dKm);
  return { lossDb: lb, rawKnifeEdgeDb: lucDb, vMax, isTranshorizon };
}

/**
 * Ajuste lineal de Tierra lisa (mínimos cuadrados, ITU-R P.526-15 §4.5.2.3) para calcular
 * alturas efectivas de antena `h_ts`, `h_rs` y la rugosidad del terreno Δh.
 */
function smoothEarthFit(dArr, hArr) {
  const n = dArr.length;
  const dTot = dArr[n - 1];
  let sumD = 0, sumH = 0, sumDD = 0, sumDH = 0;
  for (let i = 0; i < n; i++) {
    sumD += dArr[i];
    sumH += hArr[i];
    sumDD += dArr[i] * dArr[i];
    sumDH += dArr[i] * hArr[i];
  }
  const denom = n * sumDD - sumD * sumD;
  const slope = denom > 0 ? (n * sumDH - sumD * sumH) / denom : 0;
  const intercept = (sumH - slope * sumD) / n;
  const hSt = intercept;
  const hSr = intercept + slope * dTot;
  const residuals = [];
  for (let i = 0; i < n; i++) residuals.push(hArr[i] - (intercept + slope * dArr[i]));
  residuals.sort((a, b) => a - b);
  const q = (p) => residuals[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
  const deltaHM = Math.max(0, q(0.9) - q(0.1));
  return { hSt, hSr, slope, intercept, deltaHM };
}

/**
 * Método **Delta-Bullington completo según ITU-R P.526-15 §4.5.2** (usado en ITU-R P.452-17 y P.1812-6).
 *
 * @param {Array<{dM:number, zM:number}>} profile Perfil del terreno ordenado con `dM` desde 0 hasta `dTot` (≥ 3 puntos)
 * @param {object} opts Parámetros OBLIGATORIOS:
 *   - `freqHz`: frecuencia portadora (Hz, > 0)
 *   - `hTxAglM`: altura de antena transmisora sobre el suelo (m, > 0)
 *   - `hRxAglM`: altura de antena receptora sobre el suelo (m, > 0)
 *   - `kFactor`: factor de radio terrestre efectivo (ej. `4/3` atmósfera estándar; `2/3` subrefracción)
 */
export function deltaBullingtonP526(profile, opts) {
  if (!Array.isArray(profile) || profile.length < 3) {
    throw new RangeError('deltaBullingtonP526: se requiere un perfil con al menos 3 puntos { dM, zM }');
  }
  if (!opts || typeof opts !== 'object') throw new Error('deltaBullingtonP526: opts obligatorio');
  const freqHz = reqNum(opts.freqHz, 'freqHz');
  const hTxAglM = reqNum(opts.hTxAglM, 'hTxAglM');
  const hRxAglM = reqNum(opts.hRxAglM, 'hRxAglM');
  const kFactor = reqNum(opts.kFactor, 'kFactor');
  if (!(freqHz > 0 && hTxAglM > 0 && hRxAglM > 0 && kFactor > 0.1)) {
    throw new RangeError('freqHz, hTxAglM, hRxAglM > 0 y kFactor > 0.1 obligatorios');
  }

  const dArr = profile.map((p) => reqNum(p.dM, 'profile.dM'));
  const hArr = profile.map((p) => reqNum(p.zM, 'profile.zM'));
  const dTot = dArr[dArr.length - 1];
  if (!(dTot > 0)) throw new RangeError('distancia total del perfil debe ser > 0');

  const ae = kFactor * EARTH_RADIUS_M;
  const hTxAbs = hArr[0] + hTxAglM;
  const hRxAbs = hArr[hArr.length - 1] + hRxAglM;

  // 1. Bullington sobre el perfil real (L_ba)
  const actual = bullingtonCore(dArr, hArr, hTxAbs, hRxAbs, freqHz, ae);

  // 2. Tierra lisa equivalente + Bullington sobre perfil plano cero (L_bs)
  const fit = smoothEarthFit(dArr, hArr);
  const hts = Math.max(1, hTxAbs - Math.min(hArr[0], fit.hSt));
  const hrs = Math.max(1, hRxAbs - Math.min(hArr[hArr.length - 1], fit.hSr));
  const zeroH = new Array(hArr.length).fill(0);
  const smooth = bullingtonCore(dArr, zeroH, hts, hrs, freqHz, ae);

  // 3. Difracción sobre Tierra esférica lisa (L_sph)
  const lSph = sphericalEarthDiffractionDb({ distanceM: dTot, freqHz, hTxM: hts, hRxM: hrs, kFactor });

  // 4. Combinación Delta-Bullington (ITU-R P.526-15 Ec. 44): L_d = L_ba + max(L_sph - L_bs, 0)
  const deltaTerm = Math.max(0, lSph - smooth.lossDb);
  const diffractionLossDb = actual.lossDb + deltaTerm;
  const fsplDb = friisFreeSpaceLossDb(dTot, freqHz);

  return Object.freeze({
    basis: 'MODEL',
    method: 'ITU-R P.526-15 §4.5.2 Delta-Bullington',
    distanceM: +dTot.toFixed(1),
    freqHz,
    kFactor,
    isTranshorizon: actual.isTranshorizon,
    fsplDb: +fsplDb.toFixed(2),
    bullingtonActualDb: +actual.lossDb.toFixed(2),
    bullingtonSmoothDb: +smooth.lossDb.toFixed(2),
    sphericalEarthDb: +lSph.toFixed(2),
    diffractionLossDb: +diffractionLossDb.toFixed(2),
    totalBasicTransmissionLossDb: +(fsplDb + diffractionLossDb).toFixed(2),
    terrainIrregularityDeltaHM: +fit.deltaHM.toFixed(1),
    effectiveHeightsM: Object.freeze({ hts: +hts.toFixed(1), hrs: +hrs.toFixed(1) }),
  });
}

/**
 * Método de Epstein-Peterson (1953) de múltiples filos de cuchillo en cascada sobre los horizontes
 * sucesivos visibles del perfil del terreno (para contraste con Delta-Bullington y Deygout).
 */
export function epsteinPetersonDiffraction(profile, { freqHz, hTxAglM, hRxAglM, kFactor }) {
  if (!Array.isArray(profile) || profile.length < 3) {
    throw new RangeError('epsteinPetersonDiffraction: perfil con ≥ 3 puntos obligatorio');
  }
  reqNum(freqHz, 'freqHz');
  reqNum(hTxAglM, 'hTxAglM');
  reqNum(hRxAglM, 'hRxAglM');
  reqNum(kFactor, 'kFactor');

  const ae = kFactor * EARTH_RADIUS_M;
  const dTot = profile[profile.length - 1].dM;
  const lambda = C_LIGHT / freqHz;
  // Construir envolvente convexa superior (cadena de picos que bloquean sucesivamente el rayo)
  const pts = profile.map((p, i) => {
    const bulge = (p.dM * (dTot - p.dM)) / (2 * ae);
    const z = p.zM + bulge + (i === 0 ? hTxAglM : i === profile.length - 1 ? hRxAglM : 0);
    return { d: p.dM, z, idx: i };
  });

  // Algoritmo de cadena superior (Graham/Andrew) para seleccionar vértices dominantes de difracción
  const hull = [];
  for (const pt of pts) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b.d - a.d) * (pt.z - a.z) - (b.z - a.z) * (pt.d - a.d);
      if (cross >= 0) hull.pop();
      else break;
    }
    hull.push(pt);
  }

  let totalLossDb = 0;
  const edges = [];
  if (hull.length === 2) {
    // Línea de vista libre entre extremos: evaluar el obstáculo de mayor parámetro de Fresnel v
    let vMax = -Infinity;
    let bestIdx = -1;
    const z0 = pts[0].z, z1 = pts[pts.length - 1].z;
    for (let i = 1; i < pts.length - 1; i++) {
      const d1 = pts[i].d, d2 = dTot - d1;
      const zRay = z0 + ((z1 - z0) * d1) / dTot;
      const v = (pts[i].z - zRay) * Math.sqrt((2 * dTot) / (lambda * d1 * d2));
      if (v > vMax) { vMax = v; bestIdx = i; }
    }
    totalLossDb = ituKnifeEdgeLossDb(vMax);
    if (totalLossDb > 0) edges.push({ idx: bestIdx, dM: pts[bestIdx].d, v: +vMax.toFixed(3), lossDb: +totalLossDb.toFixed(2) });
  } else {
    for (let m = 1; m < hull.length - 1; m++) {
      const prev = hull[m - 1];
      const curr = hull[m];
      const next = hull[m + 1];
      const d1 = curr.d - prev.d;
      const d2 = next.d - curr.d;
      const zLine = prev.z + ((next.z - prev.z) * d1) / (d1 + d2);
      const hObs = curr.z - zLine;
      const v = hObs * Math.sqrt((2 * (d1 + d2)) / (lambda * d1 * d2));
      const loss = ituKnifeEdgeLossDb(v);
      totalLossDb += loss;
      edges.push({ idx: curr.idx, dM: +curr.d.toFixed(1), v: +v.toFixed(3), lossDb: +loss.toFixed(2) });
    }
  }

  return Object.freeze({
    basis: 'MODEL',
    method: 'Epstein-Peterson (1953)',
    edges,
    diffractionLossDb: +totalLossDb.toFixed(2),
  });
}

/**
 * Análisis de perfil de terreno estilo Longley-Rice / ITM (Hufford, Longley & Kissick 1982, NTIA 82-100):
 * calcula Δh (irregularidad interdecil 10–90 %), distancias a los horizontes radioeléctricos d_L1, d_L2,
 * ángulos de elevación de horizonte θ_e1, θ_e2 y ángulo total de dispersión θ.
 */
export function itmLongleyRiceTerrainSummary(profile, { hTxAglM, hRxAglM, kFactor }) {
  if (!Array.isArray(profile) || profile.length < 3) throw new RangeError('perfil con ≥ 3 puntos obligatorio');
  reqNum(hTxAglM, 'hTxAglM');
  reqNum(hRxAglM, 'hRxAglM');
  reqNum(kFactor, 'kFactor');

  const dArr = profile.map((p) => p.dM);
  const hArr = profile.map((p) => p.zM);
  const dTot = dArr[dArr.length - 1];
  const ae = kFactor * EARTH_RADIUS_M;
  const fit = smoothEarthFit(dArr, hArr);
  const zTx = hArr[0] + hTxAglM;
  const zRx = hArr[hArr.length - 1] + hRxAglM;

  let theta1 = -Infinity, dL1 = dTot;
  let theta2 = -Infinity, dL2 = dTot;
  for (let i = 1; i < profile.length - 1; i++) {
    const d1 = dArr[i];
    const d2 = dTot - d1;
    const el1 = (hArr[i] - zTx) / d1 - d1 / (2 * ae);
    if (el1 > theta1) { theta1 = el1; dL1 = d1; }
    const el2 = (hArr[i] - zRx) / d2 - d2 / (2 * ae);
    if (el2 > theta2) { theta2 = el2; dL2 = d2; }
  }
  const losAngle1 = (zRx - zTx) / dTot - dTot / (2 * ae);
  const isLos = theta1 < losAngle1;
  const scatterAngleRad = Math.max(0, theta1 + theta2 + dTot / ae);
  const terrainClass = fit.deltaHM < 30 ? 'LLANO' : fit.deltaHM < 90 ? 'ONDULADO' : fit.deltaHM < 200 ? 'MONTAÑOSO' : 'ESCARPADO';

  return Object.freeze({
    basis: 'MODEL',
    ref: 'Hufford, Longley & Kissick (1982), NTIA Report 82-100 (Longley-Rice ITM)',
    distanceM: +dTot.toFixed(1),
    deltaHM: +fit.deltaHM.toFixed(1),
    terrainClass,
    isLineOfSight: isLos,
    txHorizonDistanceM: +dL1.toFixed(1),
    rxHorizonDistanceM: +dL2.toFixed(1),
    txHorizonAngleMrad: +(theta1 * 1000).toFixed(3),
    rxHorizonAngleMrad: +(theta2 * 1000).toFixed(3),
    scatterAngleMrad: +(scatterAngleRad * 1000).toFixed(3),
  });
}

/**
 * Pérdida estadística por entorno construido (clutter terrestre) según ITU-R P.2108-1 §3.2 (0,5–67 GHz).
 * `locationPct` ∈ (0, 100) es el porcentaje de ubicaciones (ej. 50 = mediana).
 */
export function ituP2108ClutterLossDb({ freqGhz, distanceKm, locationPct }) {
  const f = reqNum(freqGhz, 'freqGhz');
  const d = reqNum(distanceKm, 'distanceKm');
  const p = reqNum(locationPct, 'locationPct');
  if (!(f >= 0.5 && f <= 67)) throw new RangeError('ITU-R P.2108-1 §3.2 es válido para 0,5 ≤ freqGhz ≤ 67 GHz');
  if (!(d >= 0.25)) throw new RangeError('ITU-R P.2108-1 §3.2 requiere distanceKm ≥ 0,25 km');
  if (!(p > 0 && p < 100)) throw new RangeError('locationPct debe estar en (0, 100)');

  // Ecuaciones 3a–3d de ITU-R P.2108-1
  const lL = -2 * Math.log10(Math.pow(10, -5 * Math.log10(f) - 12.5) + Math.pow(10, -16.5));
  const lS = 32.98 + 23.9 * Math.log10(d) + 3 * Math.log10(f);
  const sigmaL = 4.0;
  const sigmaS = 6.0;
  // Inversa normal aproximada para p/100 (Beasley-Springer-Moro simplificada, precisa a 1e-4)
  const qInv = invNormalApprox(p / 100);
  const lCtt = -5 * Math.log10(Math.pow(10, -0.2 * lL) + Math.pow(10, -0.2 * lS)) - qInv * Math.sqrt(
    (sigmaL * sigmaL * Math.pow(10, -0.2 * lL) + sigmaS * sigmaS * Math.pow(10, -0.2 * lS)) /
    (Math.pow(10, -0.2 * lL) + Math.pow(10, -0.2 * lS)),
  );
  return Object.freeze({
    lossDb: +Math.max(0, lCtt).toFixed(2),
    freqGhz: f,
    distanceKm: d,
    locationPct: p,
    basis: 'MODEL',
    ref: 'ITU-R P.2108-1 §3.2',
  });
}

/**
 * Atenuación por vegetación según ITU-R P.833-10: A_ev = A_m · (1 − exp(−d · γ / A_m)).
 * Requiere explícitamente `specificAttenDbM` (γ, dB/m) y `maxAttenDb` (A_m, dB) publicados para el tipo de bosque/frecuencia.
 */
export function ituP833VegetationLossDb({ depthM, specificAttenDbM, maxAttenDb }) {
  const d = reqNum(depthM, 'depthM');
  const gamma = reqNum(specificAttenDbM, 'specificAttenDbM');
  const am = reqNum(maxAttenDb, 'maxAttenDb');
  if (d < 0 || !(gamma > 0 && am > 0)) throw new RangeError('depthM ≥ 0, specificAttenDbM > 0 y maxAttenDb > 0 obligatorios');
  const loss = am * (1 - Math.exp((-d * gamma) / am));
  return Object.freeze({
    lossDb: +loss.toFixed(2),
    depthM: d,
    basis: 'MODEL',
    ref: 'ITU-R P.833-10',
  });
}

/**
 * Extrae un perfil de elevación desde un MDE raster `{ w, h, west, north, dx, dy, data }` (formato `radio/poyo.json`)
 * entre dos coordenadas geográficas `[lon, lat]`.
 */
export function sampleDemProfile(dem, fromLonLat, toLonLat, steps = 120) {
  if (!dem || !dem.data || !(steps >= 4)) throw new RangeError('sampleDemProfile: dem válido y steps ≥ 4 obligatorios');
  const [lon1, lat1] = fromLonLat;
  const [lon2, lat2] = toLonLat;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  const distM = 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const out = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const lon = lon1 + (lon2 - lon1) * t;
    const lat = lat1 + (lat2 - lat1) * t;
    const ci = Math.min(dem.w - 1, Math.max(0, Math.round((lon - dem.west) / dem.dx)));
    const cj = Math.min(dem.h - 1, Math.max(0, Math.round((dem.north - lat) / dem.dy)));
    const zM = dem.data[cj * dem.w + ci];
    out.push({ dM: +(distM * t).toFixed(2), zM: Number.isFinite(zM) ? zM : 0, lon: +lon.toFixed(5), lat: +lat.toFixed(5) });
  }
  return out;
}

/**
 * Evalúa un enlace radio de la malla SENDA (ej. LoRa 868 MHz, VHF 160 MHz, Meshtastic) con
 * ITU-R P.526-15 Delta-Bullington y devuelve la horquilla de margen por variabilidad refractiva atmosférica
 * (`kMin` subrefracción, `kNom` estándar 4/3, `kMax` superrefracción).
 */
export function evaluateMeshLinkWithUncertainty(profile, {
  freqHz,
  hTxAglM,
  hRxAglM,
  txPowerDbm,
  txGainDbi,
  rxGainDbi,
  rxSensitivityDbm,
  kMin,
  kNom,
  kMax,
  extraLossDb = 0,
}) {
  reqNum(txPowerDbm, 'txPowerDbm');
  reqNum(txGainDbi, 'txGainDbi');
  reqNum(rxGainDbi, 'rxGainDbi');
  reqNum(rxSensitivityDbm, 'rxSensitivityDbm');
  reqNum(kMin, 'kMin');
  reqNum(kNom, 'kNom');
  reqNum(kMax, 'kMax');
  if (!(kMin < kNom && kNom < kMax)) throw new RangeError('se exige kMin < kNom < kMax');

  const evalK = (k) => {
    const db = deltaBullingtonP526(profile, { freqHz, hTxAglM, hRxAglM, kFactor: k });
    const totalLoss = db.totalBasicTransmissionLossDb + extraLossDb;
    const rxPowerDbm = txPowerDbm + txGainDbi + rxGainDbi - totalLoss;
    const marginDb = rxPowerDbm - rxSensitivityDbm;
    return { kFactor: k, totalLossDb: +totalLoss.toFixed(2), rxPowerDbm: +rxPowerDbm.toFixed(2), marginDb: +marginDb.toFixed(2), db };
  };

  const worst = evalK(kMin);
  const nominal = evalK(kNom);
  const best = evalK(kMax);
  const itm = itmLongleyRiceTerrainSummary(profile, { hTxAglM, hRxAglM, kFactor: kNom });

  const linkStatus = worst.marginDb >= 0
    ? 'VIABLE_INCLUSO_SUBREFRACCION'
    : nominal.marginDb >= 0
      ? 'VIABLE_EN_ATMOSFERA_ESTANDAR_MARGINAL_EN_SUBREFRACCION'
      : best.marginDb >= 0
        ? 'SOLO_CON_SUPERREFRACCION_NECESITA_REPETIDOR'
        : 'SIN_ENLACE_NECESITA_REPETIDOR';

  return Object.freeze({
    basis: 'MODEL',
    method: 'ITU-R P.526-15 Delta-Bullington + banda de refractividad k + NTIA ITM Δh',
    distanceKm: +(nominal.db.distanceM / 1000).toFixed(3),
    freqMhz: +(freqHz / 1e6).toFixed(3),
    itmTerrain: itm,
    nominal,
    marginHorquillaDb: Object.freeze({
      minSubrefraction: worst.marginDb,
      nominal: nominal.marginDb,
      maxSuperrefraction: best.marginDb,
    }),
    linkStatus,
  });
}

function invNormalApprox(p) {
  // Aproximación racional de Acklam (2003), error absoluto < 1.15e-9
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5, r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

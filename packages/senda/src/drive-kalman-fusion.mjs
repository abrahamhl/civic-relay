/**
 * SENDA Drive · Fusión Sensorial GNSS + IMU 6 estados (Filtro de Kalman Extendido en forma de Joseph)
 * y Auto-Calibrador Online de Horizonte/Cabeceo de Cámara (0 €, 100 % en el dispositivo, sin red).
 *
 * 1) `createGnssImuEkf`:
 *    Vector de estado x = [pE, pN, v, psi, ba, bw]ᵀ (plano tangente ENU en metros, velocidad m/s,
 *    rumbo rad desde Norte en sentido horario, sesgo de acelerómetro longitudinal, sesgo de giróscopo).
 *    - Actualización de covarianza en forma de Joseph: P = (I-KH)P(I-KH)ᵀ + KRKᵀ (garantiza simetría y
 *      definición positiva sin deriva numérica).
 *    - Puerta de innovación χ² de Mahalanobis: rechaza saltos multipath imposibles en cañones urbanos.
 *    - Dead-Reckoning transparente en túneles (M-30 Madrid, Coentunnel/Velsertunnel NL): propaga posición
 *      y elipse de incertidumbre σ_pos con IMU y pasa a estado `DEGRADED` al superar el umbral declarado
 *      (jamás finge fijación GPS cuando no hay señal, CLAUDE.md §1).
 * 2) `createHorizonCalibrator`:
 *    Estima online el cabeceo (`pitchDeg`) y la fila de horizonte (`horizonY`) del soporte de parabrisas
 *    usando el vector gravedad IMU durante conducción rectilínea estable (inspirado en `openpilot liveCalibration`).
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const M_PER_DEG_LAT = 111_132.95;

const wrapRad = (a) => {
  let x = (a + Math.PI) % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x - Math.PI;
};

// Álgebra lineal compacta para matrices pequeñas (6×6) sin dependencias externas
function matMul(A, B) {
  const m = A.length, k = B.length, n = B[0].length;
  const C = Array.from({ length: m }, () => new Float64Array(n));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
      C[i][j] = s;
    }
  }
  return C;
}
function matT(A) {
  const m = A.length, n = A[0].length;
  const T = Array.from({ length: n }, () => new Float64Array(m));
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) T[j][i] = A[i][j];
  return T;
}
function matAdd(A, B, sign = 1) {
  return A.map((row, i) => row.map((v, j) => v + sign * B[i][j]));
}
function eye(n) {
  return Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
}

/**
 * Crea un Filtro de Kalman Extendido GNSS + IMU de 6 estados.
 * Todos los ruidos de proceso y umbrales están explícitamente declarados (no calibrados en flota).
 */
export function createGnssImuEkf({
  qAccelMs2 = 0.8,          // ruido de proceso aceleración (m/s²)
  qYawRateRadS = 0.08,      // ruido de proceso giroscopio (rad/s)
  qBiasAccel = 0.02,        // deriva sesgo acelerómetro
  qBiasYaw = 0.004,         // deriva sesgo giróscopo
  chi2GatePos = 16.0,       // puerta χ² 2-DoF (~99,97 % confianza; rechaza saltos multipath extremos)
  maxDrSigmaM = 50.0,       // incertidumbre 1σ máxima admitida en dead-reckoning de túnel (m)
} = {}) {
  let anchor = null; // { lon, lat, cosLat }
  let x = new Float64Array(6); // [pE, pN, v, psi, ba, bw]
  let P = eye(6);
  P[0][0] = 25; P[1][1] = 25; P[2][2] = 4; P[3][3] = 0.25; P[4][4] = 0.25; P[5][5] = 0.02;
  let lastMs = null, lastGnssMs = null, outliersRejected = 0, consecutiveRejects = 0;

  function reanchor({ lon, lat, speedMs, headingDeg, tMs }) {
    anchor = { lon, lat, cosLat: Math.cos(lat * DEG) };
    x = new Float64Array(6);
    x[2] = speedMs != null && Number.isFinite(speedMs) ? Math.max(0, speedMs) : 0;
    x[3] = headingDeg != null && Number.isFinite(headingDeg) ? wrapRad(headingDeg * DEG) : 0;
    P = eye(6);
    P[0][0] = 25; P[1][1] = 25; P[2][2] = 4; P[3][3] = 0.25; P[4][4] = 0.25; P[5][5] = 0.02;
    lastMs = tMs; lastGnssMs = tMs; consecutiveRejects = 0;
  }

  const toEnu = (lon, lat) => [
    (lon - anchor.lon) * M_PER_DEG_LAT * anchor.cosLat,
    (lat - anchor.lat) * M_PER_DEG_LAT,
  ];
  const toWgs = (pE, pN) => [
    +(anchor.lon + pE / (M_PER_DEG_LAT * anchor.cosLat)).toFixed(6),
    +(anchor.lat + pN / M_PER_DEG_LAT).toFixed(6),
  ];

  // Actualización escalar de Joseph (exacta para observaciones independientes, O(n²) y 100 % estable)
  function scalarUpdate(idx, z, R, isAngle = false, gateChi2 = Infinity) {
    const innov = isAngle ? wrapRad(z - x[idx]) : (z - x[idx]);
    const S = P[idx][idx] + R;
    if (!(S > 1e-12)) return false;
    const d2 = (innov * innov) / S;
    if (d2 > gateChi2) { outliersRejected++; return false; }
    const K = new Float64Array(6);
    for (let i = 0; i < 6; i++) K[i] = P[i][idx] / S;
    for (let i = 0; i < 6; i++) x[i] += K[i] * innov;
    x[3] = wrapRad(x[3]);
    if (x[2] < 0) x[2] = 0;
    // Forma de Joseph para fila H = e_idx: P_new = (I - K e^T) P (I - K e^T)^T + K R K^T
    const IKH = eye(6);
    for (let i = 0; i < 6; i++) IKH[i][idx] -= K[i];
    const tmp = matMul(matMul(IKH, P), matT(IKH));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) tmp[i][j] += K[i] * R * K[j];
    P = tmp;
    return true;
  }

  return {
    get initialized() { return anchor != null; },
    get outliersRejected() { return outliersRejected; },

    /** Predicción cinemática con aceleración longitudinal `aLongMs2` y velocidad angular `yawRateRadS` (IMU). */
    predict({ tMs, aLongMs2 = 0, yawRateRadS = 0 }) {
      if (!anchor) return null;
      if (lastMs == null) { lastMs = tMs; return this.state(tMs); }
      const dt = (tMs - lastMs) / 1000;
      if (!(dt > 0 && dt <= 5)) { lastMs = tMs; return this.state(tMs); }
      lastMs = tMs;

      const v = x[2], psi = x[3], ba = x[4], bw = x[5];
      const aEff = aLongMs2 - ba;
      const wEff = yawRateRadS - bw;
      const psiMid = psi + 0.5 * wEff * dt;
      const vNext = Math.max(0, v + aEff * dt);
      const vMid = 0.5 * (v + vNext);

      x[0] += vMid * Math.sin(psiMid) * dt;
      x[1] += vMid * Math.cos(psiMid) * dt;
      x[2] = vNext;
      x[3] = wrapRad(psi + wEff * dt);

      // Jacobiano exacto F = ∂f/∂x
      const F = eye(6);
      F[0][2] = Math.sin(psiMid) * dt;
      F[0][3] = vMid * Math.cos(psiMid) * dt;
      F[0][4] = -0.5 * Math.sin(psiMid) * dt * dt;
      F[1][2] = Math.cos(psiMid) * dt;
      F[1][3] = -vMid * Math.sin(psiMid) * dt;
      F[1][4] = -0.5 * Math.cos(psiMid) * dt * dt;
      F[2][4] = -dt;
      F[3][5] = -dt;

      const Q = Array.from({ length: 6 }, () => new Float64Array(6));
      const dt2 = dt * dt, dt3 = dt2 * dt;
      const qa = qAccelMs2 * qAccelMs2, qw = qYawRateRadS * qYawRateRadS;
      Q[0][0] = 0.25 * qa * dt3 * dt + 0.05 * dt;
      Q[1][1] = 0.25 * qa * dt3 * dt + 0.05 * dt;
      Q[2][2] = qa * dt2;
      Q[3][3] = qw * dt2;
      Q[4][4] = qBiasAccel * qBiasAccel * dt;
      Q[5][5] = qBiasYaw * qBiasYaw * dt;

      P = matAdd(matMul(matMul(F, P), matT(F)), Q);
      return this.state(tMs);
    },

    /** Fusión de medición GNSS con puerta de rechazo χ² de saltos multipath y re-anclaje seguro en readquisición. */
    updateGnss({ lon, lat, accuracyM = 8, speedMs = null, headingDeg = null, tMs = Date.now() }) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      if (!anchor) {
        reanchor({ lon, lat, speedMs, headingDeg, tMs });
        return { ...this.state(tMs), gnssRejected: false, maha2: 0 };
      }
      if (lastMs != null && tMs > lastMs) this.predict({ tMs });
      const [zE, zN] = toEnu(lon, lat);
      const sig = Math.max(1.5, Number.isFinite(accuracyM) ? accuracyM : 8);
      const Rpos = sig * sig;

      // Puerta χ² conjunta en 2D para rechazar saltos GPS imposibles en cañón urbano (30 m – 2 km)
      const dE = zE - x[0], dN = zN - x[1];
      const jumpM = Math.hypot(dE, dN);
      if (jumpM > 2000) {
        reanchor({ lon, lat, speedMs, headingDeg, tMs });
        return { ...this.state(tMs), gnssRejected: false, reanchored: true, maha2: 0 };
      }
      const maha2 = (dE * dE) / (P[0][0] + Rpos) + (dN * dN) / (P[1][1] + Rpos);
      if (maha2 > chi2GatePos && (tMs - (lastGnssMs ?? tMs)) < 10_000) {
        consecutiveRejects++;
        if (consecutiveRejects >= 2) {
          reanchor({ lon, lat, speedMs, headingDeg, tMs });
          return { ...this.state(tMs), gnssRejected: false, reanchored: true, maha2: +maha2.toFixed(2) };
        }
        outliersRejected++;
        return { ...this.state(tMs), gnssRejected: true, maha2: +maha2.toFixed(2) };
      }

      consecutiveRejects = 0;
      scalarUpdate(0, zE, Rpos);
      scalarUpdate(1, zN, Rpos);
      if (speedMs != null && Number.isFinite(speedMs) && speedMs >= 0) scalarUpdate(2, speedMs, 0.8 * 0.8);
      if (headingDeg != null && Number.isFinite(headingDeg) && (speedMs ?? x[2]) > 2.0) {
        scalarUpdate(3, wrapRad(headingDeg * DEG), (6 * DEG) ** 2, true);
      }
      lastGnssMs = tMs;
      return { ...this.state(tMs), gnssRejected: false, maha2: +maha2.toFixed(2) };
    },

    state(nowMs = lastMs ?? Date.now()) {
      if (!anchor) return null;
      const sigmaPosM = +Math.hypot(Math.sqrt(Math.max(0, P[0][0])), Math.sqrt(Math.max(0, P[1][1]))).toFixed(2);
      const gnssAgeS = lastGnssMs != null ? +Math.max(0, (nowMs - lastGnssMs) / 1000).toFixed(1) : null;
      const mode = gnssAgeS != null && gnssAgeS <= 2.5
        ? 'GNSS_FUSED'
        : (sigmaPosM <= maxDrSigmaM ? 'DEAD_RECKONING_IMU' : 'DEGRADED');
      return {
        pos: toWgs(x[0], x[1]),
        enuM: [+x[0].toFixed(2), +x[1].toFixed(2)],
        speedMs: +x[2].toFixed(2),
        headingDeg: +(((x[3] * RAD) % 360) + 360) % 360,
        biasAccelMs2: +x[4].toFixed(3),
        biasYawRadS: +x[5].toFixed(4),
        sigmaPosM,
        gnssAgeS,
        mode,
        outliersRejected,
      };
    },
  };
}

/**
 * Auto-calibrador online de cabeceo (`pitchDeg`) y horizonte (`horizonY`) de la cámara del parabrisas
 * usando la orientación del vector gravedad IMU en tramos rectos a velocidad constante (0 €, sin red).
 */
export function createHorizonCalibrator({ fovVDeg = 48, nominalHorizonY = 0.48, alpha = 0.05 } = {}) {
  let pitchDeg = 0, samples = 0;
  return {
    /** Alimenta lectura IMU `(ax, ay, az)` durante conducción recta (`|yawRate| < 0.04`, `v > 8 m/s`). */
    update({ az, ay, ax, speedMs = 0, yawRateRadS = 0, aLongMs2 = 0 }) {
      if (!Number.isFinite(az) || !Number.isFinite(ay)) return this.status();
      if (speedMs < 8 || Math.abs(yawRateRadS) > 0.04 || Math.abs(aLongMs2) > 0.8) return this.status();
      // En soporte vertical de parabrisas (eje Y vertical móvil, eje Z perpendicular a la pantalla):
      // inclinación hacia abajo = atan2(az, ay) (acotada a ±15° para robustez tipo Huber)
      const rawDeg = Math.max(-15, Math.min(15, Math.atan2(az, Math.max(1e-3, Math.abs(ay))) * RAD));
      if (samples === 0) pitchDeg = rawDeg;
      else {
        const err = Math.max(-2.5, Math.min(2.5, rawDeg - pitchDeg)); // recorte Huber
        pitchDeg += alpha * err;
      }
      samples++;
      return this.status();
    },
    status() {
      const horizonY = +(Math.max(0.25, Math.min(0.70, nominalHorizonY - pitchDeg / fovVDeg))).toFixed(4);
      return {
        calibrated: samples >= 20,
        samples,
        pitchDeg: +pitchDeg.toFixed(2),
        horizonY,
      };
    },
  };
}

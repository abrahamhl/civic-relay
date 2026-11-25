/**
 * SENDA Copiloto 5D · Física avanzada de conducción y asistencia predictiva en el viaje
 * (`drive-copilot-physics.mjs`, 0 €, 100 % en el dispositivo, sin red obligatoria).
 *
 * Construye encima de `drive-physics-v2.mjs` (RSS), `drive-kalman-fusion.mjs` (EKF 6 estados),
 * `traffic-shockwave.mjs` (LWR), `shallow-water-fv.mjs` (estabilidad vehicular en riada) y
 * `radio-propagation-advanced.mjs` (difracción ITU-R P.526-15), añadiendo 6 motores inéditos
 * en navegadores comerciales:
 *
 *  1. **Envolvente dinámica de adherencia, Círculo de Kamm y Aquaplaning NASA:**
 *     - Velocidad crítica de aquaplaning dinámico: Horne, W. B. & Dreher, R. C. (1963),
 *       «Phenomena of Pneumatic Tire Hydroplaning», NASA TN D-2056: v_p = 6,3435 · √(p_kPa) km/h.
 *     - Círculo de fricción de Kamm (reserva combinada de agarre longitudinal + lateral):
 *       Pacejka, H. B. (2012), «Tire and Vehicle Dynamics», 3.ª ed.; Rajamani, R. (2012),
 *       «Vehicle Dynamics and Control», 2.ª ed., Springer.
 *     - Distancia de visibilidad de parada corregida por pendiente y fricción + velocidad máxima
 *       segura en niebla/luces: AASHTO (2018), «A Policy on Geometric Design of Highways and Streets» §3.2.2.
 *  2. **Horizonte predictivo de curvas y límite de vuelco SSF desde la polilínea de ruta:**
 *     - Curvatura de Menger geodésica, equilibrio lateral AASHTO v = √(g·R·(e + f_max)),
 *       umbral de vuelco estático NHTSA SSF (T / 2·h_CG) y punto exacto de frenado anticipado.
 *  3. **Puerta física de cruce en emergencia (riada / incendio):**
 *     - Reutiliza Shand et al. (2011) / Martínez-Gomariz et al. (2018) (`assessVehicleFloodStability`)
 *       y umbrales de proximidad a llama/humo PM2.5.
 *  4. **Guardián de zonas de sombra (túnel/barranco sin cobertura) y convoy cooperativo BLE/V2V:**
 *     - Anticipa pérdidas de señal antes de entrar (armado preventivo de EKF + caché local) y vigila
 *       separación y detenciones imprevistas de vehículos compañeros por radio local sin torre celular.
 *  5. **Índice de fatiga y micro-sueño sin cámara ni PII (cronobiología + espectro IMU):**
 *     - Ventana circadiana de mínimo alerta WOCL (Åkerstedt & Folkard 1997, Sleep 20(1):42-48),
 *       tiempo continuo de conducción (Reglamento UE 561/2006 / DGT 2 h) e inestabilidad lateral
 *       de correcciones bruscas del volante por IMU (jerk lateral RMS y tasa de oscilaciones,
 *       proxy físico de SDLP, Verster & Roth 2011).
 *  6. **Árbitro cognitivo ISO 15005 + salida compacta para Android Auto + debriefing forense SHA-256:**
 *     - Escala estricta de prioridades con histéresis y enfriamiento para no saturar al conductor,
 *       filas compactas listas para `SendaNative.publishDriveState(...)` y resumen post-viaje firmado.
 *
 * Regla de veracidad (CLAUDE.md §1): todo parámetro dependiente del vehículo o de la calzada
 * (presión de neumáticos, μ del firme, tiempo de reacción, pendiente, SSF) es OBLIGATORIO o debe
 * seleccionarse explícitamente de un catálogo publicado etiquetado. Toda salida declara `basis`.
 */

import { haversineKm } from './zones.mjs';
import { assessVehicleFloodStability } from './shallow-water-fv.mjs';
import { movingQueueIntercept } from './traffic-shockwave.mjs';

export const COPILOT_G_MS2 = 9.80665; // ISO 80000-3 exacto

/**
 * Coeficientes de fricción neumático-calzada publicados de referencia (Bosch Automotive Handbook,
 * 10.ª ed.; AASHTO Green Book 2018). El llamante DEBE elegir la superficie explícitamente; nunca se asume en silencio.
 */
export const PUBLISHED_SURFACE_PRESETS = Object.freeze({
  dry_asphalt: Object.freeze({ id: 'dry_asphalt', label: 'Asfalto seco', muLong: 0.80, muLatMax: 0.35, standingWaterMm: 0, ref: 'Bosch Automotive Handbook 10th ed. (μ ≈ 0,8–0,9); AASHTO f_max cómodo' }),
  wet_asphalt: Object.freeze({ id: 'wet_asphalt', label: 'Asfalto mojado', muLong: 0.50, muLatMax: 0.25, standingWaterMm: 1.0, ref: 'Bosch Automotive Handbook 10th ed. (μ ≈ 0,45–0,55); AASHTO wet SSD' }),
  heavy_rain: Object.freeze({ id: 'heavy_rain', label: 'Lluvia intensa / balsas', muLong: 0.35, muLatMax: 0.18, standingWaterMm: 3.5, ref: 'Horne & Dreher (1963) NASA TN D-2056 (>2,5 mm lámina de agua)' }),
  packed_snow: Object.freeze({ id: 'packed_snow', label: 'Nieve compactada', muLong: 0.22, muLatMax: 0.14, standingWaterMm: 0, ref: 'Bosch Automotive Handbook 10th ed. (μ ≈ 0,20–0,25)' }),
  black_ice: Object.freeze({ id: 'black_ice', label: 'Hielo / placa negra', muLong: 0.10, muLatMax: 0.08, standingWaterMm: 0, ref: 'Bosch Automotive Handbook 10th ed. (μ ≈ 0,08–0,12)' }),
  gravel: Object.freeze({ id: 'gravel', label: 'Pista / gravilla', muLong: 0.40, muLatMax: 0.22, standingWaterMm: 0, ref: 'AASHTO / USFS pistas sin pavimentar (μ ≈ 0,35–0,45)' }),
});

/**
 * Factores de estabilidad estática (SSF = T / (2·h_CG)) de referencia NHTSA (NCAP Rollover Resistance)
 * y clase vehicular Shand (2011) para cruces inundados.
 */
export const PUBLISHED_VEHICLE_PROFILES = Object.freeze({
  sedan: Object.freeze({ id: 'sedan', label: 'Turismo / Berlina', ssf: 1.40, floodClass: 'small_passenger', defaultSuperelevationE: 0.04, ref: 'NHTSA NCAP SSF típico turismos (1,35–1,48)' }),
  suv: Object.freeze({ id: 'suv', label: 'SUV / Todocamino', ssf: 1.18, floodClass: 'large_passenger', defaultSuperelevationE: 0.04, ref: 'NHTSA NCAP SSF típico SUV (1,12–1,24)' }),
  van_4x4: Object.freeze({ id: 'van_4x4', label: 'Furgoneta / 4×4 alto', ssf: 1.08, floodClass: 'large_4wd', defaultSuperelevationE: 0.04, ref: 'NHTSA NCAP SSF típico furgoneta/pick-up (1,05–1,14)' }),
});

function reqFinite(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new RangeError(`drive-copilot-physics: parámetro obligatorio '${name}' ausente o no finito`);
  }
  return v;
}

/* ───────────── 1. Adherencia dinámica, Círculo de Kamm y Aquaplaning NASA ───────────── */

/**
 * Calcula la envolvente dinámica de adherencia, el círculo de Kamm, la velocidad crítica de
 * aquaplaning de Horne & Dreher (1963, NASA TN D-2056) y la distancia de parada corregida por
 * pendiente y visibilidad (AASHTO Green Book 2018 §3.2.2).
 */
export function computeDynamicGripEnvelope({
  speedMs,
  axMs2 = 0,
  ayMs2 = 0,
  surfaceMu,
  tirePressureBar,
  standingWaterMm,
  gradePct,
  reactionTimeS,
  visibilityM = null,
}) {
  reqFinite(speedMs, 'speedMs');
  reqFinite(axMs2, 'axMs2');
  reqFinite(ayMs2, 'ayMs2');
  reqFinite(surfaceMu, 'surfaceMu');
  reqFinite(tirePressureBar, 'tirePressureBar');
  reqFinite(standingWaterMm, 'standingWaterMm');
  reqFinite(gradePct, 'gradePct');
  reqFinite(reactionTimeS, 'reactionTimeS');

  if (speedMs < 0) throw new RangeError('speedMs debe ser ≥ 0');
  if (!(surfaceMu > 0.02 && surfaceMu <= 1.3)) throw new RangeError('surfaceMu debe estar en (0.02, 1.3]');
  if (!(tirePressureBar >= 1.0 && tirePressureBar <= 9.0)) throw new RangeError('tirePressureBar debe estar en [1.0, 9.0] bar');
  if (standingWaterMm < 0) throw new RangeError('standingWaterMm debe ser ≥ 0');
  if (gradePct < -25 || gradePct > 25) throw new RangeError('gradePct debe estar en [-25, 25] %');
  if (reactionTimeS < 0) throw new RangeError('reactionTimeS debe ser ≥ 0');

  const speedKmh = speedMs * 3.6;
  const pKpa = tirePressureBar * 100;
  // NASA TN D-2056 (Horne & Dreher 1963): V_p = 10,35·√(p_psi) mph = 6,3435·√(p_kPa) km/h
  const hydroplaningCriticalKmh = 6.3435 * Math.sqrt(pKpa);
  const waterFilmActive = standingWaterMm >= 2.5;
  const hydroplaningRatio = waterFilmActive ? speedKmh / hydroplaningCriticalKmh : 0;

  let hydroplaningRisk = 'NONE';
  if (waterFilmActive) {
    if (hydroplaningRatio >= 1.0) hydroplaningRisk = 'CRITICAL_HYDROPLANING';
    else if (hydroplaningRatio >= 0.85) hydroplaningRisk = 'HIGH_APPROACHING_HYDROPLANING';
    else if (hydroplaningRatio >= 0.70) hydroplaningRisk = 'MODERATE_STANDING_WATER';
  }

  // Degradación efectiva de fricción al acercarse al aquaplaning dinámico
  const hydroDegradation = waterFilmActive && hydroplaningRatio > 0.75
    ? Math.max(0.25, 1 - 0.75 * Math.min(1, (hydroplaningRatio - 0.75) / 0.30))
    : 1.0;
  const effectiveMu = surfaceMu * hydroDegradation;

  // Círculo de fricción de Kamm (Pacejka 2012 / Rajamani 2012): sqrt(ax² + ay²) / (μ_eff · g)
  const aMaxTotalMs2 = effectiveMu * COPILOT_G_MS2;
  const aCombinedMs2 = Math.hypot(axMs2, ayMs2);
  const kammUtilization = aMaxTotalMs2 > 0 ? aCombinedMs2 / aMaxTotalMs2 : 1;
  const gripReservePct = Math.max(0, Math.min(100, (1 - kammUtilization) * 100));
  const remainingBrakeCapacityMs2 = Math.sqrt(Math.max(0, aMaxTotalMs2 * aMaxTotalMs2 - ayMs2 * ayMs2));

  let gripStatus = 'OPTIMAL';
  if (kammUtilization >= 0.90 || hydroplaningRisk === 'CRITICAL_HYDROPLANING') gripStatus = 'CRITICAL_SATURATION';
  else if (kammUtilization >= 0.72 || hydroplaningRisk === 'HIGH_APPROACHING_HYDROPLANING') gripStatus = 'HIGH_DEMAND';
  else if (kammUtilization >= 0.50) gripStatus = 'MODERATE_DEMAND';

  // Distancia de visibilidad de parada AASHTO Green Book (2018) §3.2.2 con pendiente G = gradePct/100
  // Nota conservadora: la deceleración práctica sostenible sin bloqueo se acota por min(effectiveMu, 0.85)
  const grade = gradePct / 100;
  const aBrakeNetMs2 = Math.max(0.4, COPILOT_G_MS2 * (effectiveMu + grade));
  const reactionDistM = speedMs * reactionTimeS;
  const brakingDistM = (speedMs * speedMs) / (2 * aBrakeNetMs2);
  const stoppingDistM = reactionDistM + brakingDistM;

  // Velocidad máxima segura para detenerse DENTRO del alcance visual (niebla / lluvia / luces de cruce)
  let maxSafeVisibilitySpeedKmh = null;
  let overdrivingVisibility = false;
  if (visibilityM != null) {
    reqFinite(visibilityM, 'visibilityM');
    if (visibilityM <= 0) throw new RangeError('visibilityM debe ser > 0');
    const vSafeMs = Math.max(0, -aBrakeNetMs2 * reactionTimeS + Math.sqrt((aBrakeNetMs2 * reactionTimeS) ** 2 + 2 * aBrakeNetMs2 * visibilityM));
    maxSafeVisibilitySpeedKmh = +(vSafeMs * 3.6).toFixed(1);
    overdrivingVisibility = stoppingDistM > visibilityM;
  }

  return Object.freeze({
    basis: 'MODEL',
    refs: Object.freeze([
      'Horne & Dreher (1963), NASA TN D-2056 (aquaplaning)',
      'Pacejka (2012) / Rajamani (2012) (Círculo de Kamm)',
      'AASHTO Green Book (2018) §3.2.2 (SSD con pendiente y fricción)',
    ]),
    speedKmh: +speedKmh.toFixed(1),
    effectiveMu: +effectiveMu.toFixed(3),
    aMaxTotalMs2: +aMaxTotalMs2.toFixed(2),
    aCombinedMs2: +aCombinedMs2.toFixed(2),
    kammUtilizationPct: +(kammUtilization * 100).toFixed(1),
    gripReservePct: +gripReservePct.toFixed(1),
    remainingBrakeCapacityMs2: +remainingBrakeCapacityMs2.toFixed(2),
    gripStatus,
    hydroplaningCriticalKmh: +hydroplaningCriticalKmh.toFixed(1),
    hydroplaningRatio: +hydroplaningRatio.toFixed(3),
    hydroplaningRisk,
    stoppingDistM: +stoppingDistM.toFixed(1),
    reactionDistM: +reactionDistM.toFixed(1),
    brakingDistM: +brakingDistM.toFixed(1),
    aBrakeNetMs2: +aBrakeNetMs2.toFixed(2),
    visibilityM,
    maxSafeVisibilitySpeedKmh,
    overdrivingVisibility,
  });
}

/* ───────────── 2. Horizonte predictivo de curvas y vuelco SSF sobre polilínea ───────────── */

function toLocalMeters(originLonLat, ptLonLat) {
  const cosLat = Math.cos((originLonLat[1] * Math.PI) / 180);
  return [
    (ptLonLat[0] - originLonLat[0]) * 111_320 * cosLat,
    (ptLonLat[1] - originLonLat[1]) * 111_132.95,
  ];
}

/**
 * Analiza las curvas por delante sobre una polilínea de ruta `[[lon, lat], ...]`,
 * calcula radio de curvatura por curvatura de Menger, dirección (IZQUIERDA/DERECHA),
 * velocidad segura AASHTO, techo de vuelco NHTSA SSF y punto exacto de frenado anticipado.
 */
export function analyzeRouteCurvesAhead({
  routeCoords,
  egoAlongM = 0,
  egoSpeedMs,
  horizonM = 1200,
  maxLateralMu,
  superelevationE,
  vehicleSsf,
  comfortBrakeMs2,
  reactionTimeS,
  minCurveRadiusAlertM = 350,
}) {
  if (!Array.isArray(routeCoords) || routeCoords.length < 3) {
    throw new RangeError('analyzeRouteCurvesAhead: routeCoords con ≥ 3 vértices obligatorio');
  }
  reqFinite(egoAlongM, 'egoAlongM');
  reqFinite(egoSpeedMs, 'egoSpeedMs');
  reqFinite(maxLateralMu, 'maxLateralMu');
  reqFinite(superelevationE, 'superelevationE');
  reqFinite(vehicleSsf, 'vehicleSsf');
  reqFinite(comfortBrakeMs2, 'comfortBrakeMs2');
  reqFinite(reactionTimeS, 'reactionTimeS');
  if (!(maxLateralMu > 0 && vehicleSsf > 0.5 && comfortBrakeMs2 > 0)) {
    throw new RangeError('maxLateralMu > 0, vehicleSsf > 0.5 y comfortBrakeMs2 > 0 obligatorios');
  }

  // Distancia acumulada a lo largo de la polilínea
  const cumM = new Float64Array(routeCoords.length);
  for (let i = 1; i < routeCoords.length; i++) {
    cumM[i] = cumM[i - 1] + haversineKm({ lat: routeCoords[i - 1][1], lon: routeCoords[i - 1][0] }, { lat: routeCoords[i][1], lon: routeCoords[i][0] }) * 1000;
  }

  const rawPoints = [];
  for (let i = 1; i < routeCoords.length - 1; i++) {
    const aheadM = cumM[i] - egoAlongM;
    if (aheadM < 15 || aheadM > horizonM) continue;
    const pA = toLocalMeters(routeCoords[i], routeCoords[i - 1]);
    const pB = [0, 0];
    const pC = toLocalMeters(routeCoords[i], routeCoords[i + 1]);

    const a = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]);
    const b = Math.hypot(pC[0] - pB[0], pC[1] - pB[1]);
    const c = Math.hypot(pC[0] - pA[0], pC[1] - pA[1]);
    if (a < 3 || b < 3 || c < 3) continue;

    // Producto vectorial 2D (pB - pA) × (pC - pB): >0 = giro izquierda, <0 = giro derecha
    const cross = (pB[0] - pA[0]) * (pC[1] - pB[1]) - (pB[1] - pA[1]) * (pC[0] - pB[0]);
    const area2 = Math.abs(cross); // 2 * área del triángulo
    if (area2 < 1e-6) continue;
    // Curvatura de Menger: κ = 2·|cross| / (a·b·c) => R = (a·b·c) / (2·|cross|)
    const radiusM = (a * b * c) / (2 * area2);
    if (radiusM > minCurveRadiusAlertM) continue;

    const direction = cross > 0 ? 'IZQUIERDA' : 'DERECHA';
    rawPoints.push({ index: i, aheadM, radiusM, direction, lon: routeCoords[i][0], lat: routeCoords[i][1] });
  }

  // Agrupar vértices contiguos del mismo giro en curvas discretas (conservando el vértice más cerrado = ápice)
  const bends = [];
  for (const pt of rawPoints) {
    const prev = bends[bends.length - 1];
    if (prev && prev.direction === pt.direction && pt.aheadM - prev.endAheadM < 90) {
      prev.endAheadM = pt.aheadM;
      if (pt.radiusM < prev.minRadiusM) {
        prev.minRadiusM = pt.radiusM;
        prev.apexAheadM = pt.aheadM;
        prev.apexLonLat = [pt.lon, pt.lat];
      }
    } else {
      bends.push({
        direction: pt.direction,
        startAheadM: pt.aheadM,
        endAheadM: pt.aheadM,
        apexAheadM: pt.aheadM,
        minRadiusM: pt.radiusM,
        apexLonLat: [pt.lon, pt.lat],
      });
    }
  }

  const curves = bends.map((b) => {
    const R = Math.max(8, b.minRadiusM);
    // Equilibrio AASHTO Green Book (2018): v_safe = sqrt(g · R · (e + f_max))
    const vSafeMs = Math.sqrt(COPILOT_G_MS2 * R * Math.max(0.05, superelevationE + maxLateralMu));
    // Límite de vuelco estático NHTSA (SSF = T / (2·h_CG)) con margen 0,80 para transferencia dinámica
    const vRollMs = Math.sqrt(COPILOT_G_MS2 * R * vehicleSsf * 0.80);
    const vLimitMs = Math.min(vSafeMs, vRollMs);
    const safeSpeedKmh = +(vLimitMs * 3.6).toFixed(0);
    const rolloverSpeedKmh = +(vRollMs * 3.6).toFixed(0);

    // Distancia de frenado necesaria desde velocidad actual hasta vLimitMs ANTES de la entrada a la curva (Círculo de Kamm)
    const needSlow = egoSpeedMs > vLimitMs + 1.0;
    const brakeDistNeededM = needSlow
      ? egoSpeedMs * reactionTimeS + (egoSpeedMs * egoSpeedMs - vLimitMs * vLimitMs) / (2 * comfortBrakeMs2)
      : 0;
    const marginBeforeEntryM = b.startAheadM - brakeDistNeededM;

    let cue = 'COMFORTABLE';
    if (needSlow && marginBeforeEntryM <= 25) cue = 'BRAKE_NOW';
    else if (needSlow && marginBeforeEntryM <= 140) cue = 'COAST_EARLY';

    const severity = R < 35 ? 'HORQUILLA_MUY_CERRADA' : R < 85 ? 'CURVA_CERRADA' : R < 180 ? 'CURVA_MEDIA' : 'CURVA_ABIERTA';
    const voiceCue = cue === 'COMFORTABLE'
      ? null
      : `${severity.replace(/_/g, ' ').toLowerCase()} a ${b.direction.toLowerCase()} en ${Math.round(b.startAheadM / 10) * 10} metros. Velocidad segura ${safeSpeedKmh} kilómetros por hora.`;

    return Object.freeze({
      direction: b.direction,
      severity,
      entryAheadM: Math.round(b.startAheadM),
      apexAheadM: Math.round(b.apexAheadM),
      minRadiusM: +R.toFixed(1),
      safeSpeedKmh,
      rolloverSpeedKmh,
      brakeDistNeededM: Math.round(brakeDistNeededM),
      marginBeforeEntryM: Math.round(marginBeforeEntryM),
      cue,
      voiceCue,
      apexLonLat: b.apexLonLat,
    });
  });

  // Curva más crítica por delante (prioridad: BRAKE_NOW > COAST_EARLY > más próxima)
  const cueRank = { BRAKE_NOW: 2, COAST_EARLY: 1, COMFORTABLE: 0 };
  const topCurve = [...curves].sort((a, b) => cueRank[b.cue] - cueRank[a.cue] || a.apexAheadM - b.apexAheadM)[0] ?? null;

  return Object.freeze({
    basis: 'MODEL',
    refs: Object.freeze([
      'AASHTO Green Book (2018) Cap. 3 (equilibrio de curvas horizontales)',
      'NHTSA NCAP Static Stability Factor (SSF)',
    ]),
    horizonM,
    curvesCount: curves.length,
    topCurve,
    curves,
  });
}

/* ───────────── 3. Puerta física de cruce en riada o incendio ───────────── */

/**
 * Evalúa si un tramo inundado (paso inferior, rambla, vado) o con incendio activo por delante es
 * físicamente franqueable para el vehículo actual, usando criterios publicados de Shand et al. (2011)
 * y Martínez-Gomariz et al. (2018).
 */
export function evaluateRoadEmergencyCrossing({
  vehicleClass,
  waterDepthM = 0,
  waterSpeedMs = 0,
  fireDistanceM = Infinity,
  smokePm25UgM3 = 0,
}) {
  if (!vehicleClass) throw new RangeError('evaluateRoadEmergencyCrossing: vehicleClass obligatorio');
  const flood = assessVehicleFloodStability(waterDepthM, waterSpeedMs, { vehicleClass });
  const fireBlocked = Number.isFinite(fireDistanceM) && fireDistanceM < 250;
  const smokeSevere = Number.isFinite(smokePm25UgM3) && smokePm25UgM3 >= 300;

  let verdict = 'TRANSITABLE';
  const reasons = [];
  if (flood.unstable) {
    verdict = 'NO_CRUZAR_PELIGRO_MORTAL';
    reasons.push(`Agua (${waterDepthM.toFixed(2)} m a ${waterSpeedMs.toFixed(1)} m/s): ${flood.mechanism} para ${flood.label}`);
  } else if (waterDepthM >= flood.limits.maxDepthM * 0.7) {
    verdict = 'PRECAUCION_EXTREMA_DESVIAR';
    reasons.push(`Calado al ${Math.round((waterDepthM / flood.limits.maxDepthM) * 100)} % del límite de flotación`);
  }
  if (fireBlocked) {
    verdict = 'NO_CRUZAR_PELIGRO_MORTAL';
    reasons.push(`Frente de fuego a ${Math.round(fireDistanceM)} m (< 250 m)`);
  }
  if (smokeSevere) {
    if (verdict === 'TRANSITABLE') verdict = 'PRECAUCION_EXTREMA_DESVIAR';
    reasons.push(`Humo denso PM2.5 = ${Math.round(smokePm25UgM3)} µg/m³ (recirculación cerrada y desvío)`);
  }

  return Object.freeze({
    basis: 'MODEL',
    verdict,
    doNotCross: verdict === 'NO_CRUZAR_PELIGRO_MORTAL',
    floodStability: flood,
    fireBlocked,
    smokeSevere,
    reasons,
    voiceCue: verdict === 'NO_CRUZAR_PELIGRO_MORTAL'
      ? 'Atención: peligro mortal por delante. No cruces el tramo, da la vuelta o busca cota alta.'
      : verdict === 'PRECAUCION_EXTREMA_DESVIAR'
        ? 'Precaución extrema en el tramo por delante. Reduce velocidad y valora desvío seguro.'
        : null,
  });
}

/* ───────────── 4. Guardián de zonas de sombra (túnel/valle) y convoy cooperativo BLE ───────────── */

/**
 * Anticipa la entrada en túneles o zonas sin cobertura y supervisa un convoy cooperativo de vehículos
 * vía BLE/V2V sin necesidad de red celular.
 */
export function evaluateConvoyAndShadowHorizon({
  egoPos, // { lat, lon }
  egoSpeedMs,
  nowMs,
  shadowZonesAhead = [], // [{ id, name, distAheadM, lengthM, kind: 'TUNNEL'|'VALLEY_DEADZONE' }]
  convoyPeers = [],      // [{ id, callsign, lat, lon, speedMs, lastSeenMs, stoppedSinceMs?, rssiDbm? }]
  maxConvoySpacingM,
  lostContactS,
  unexpectedStopS,
}) {
  if (!egoPos || !Number.isFinite(egoPos.lat) || !Number.isFinite(egoPos.lon)) {
    throw new RangeError('evaluateConvoyAndShadowHorizon: egoPos { lat, lon } obligatorio');
  }
  reqFinite(egoSpeedMs, 'egoSpeedMs');
  reqFinite(nowMs, 'nowMs');
  reqFinite(maxConvoySpacingM, 'maxConvoySpacingM');
  reqFinite(lostContactS, 'lostContactS');
  reqFinite(unexpectedStopS, 'unexpectedStopS');

  // 1. Horizonte de zonas de sombra (túneles / zonas sin cobertura)
  const upcomingShadow = shadowZonesAhead
    .filter((z) => Number.isFinite(z.distAheadM) && z.distAheadM >= 0 && z.distAheadM <= 3000)
    .sort((a, b) => a.distAheadM - b.distAheadM)[0] ?? null;

  const shadowActions = [];
  if (upcomingShadow) {
    shadowActions.push('PRE_CACHE_CORRIDOR_ALERTS');
    if (upcomingShadow.kind === 'TUNNEL') shadowActions.push('ARM_EKF_IMU_DEAD_RECKONING');
    shadowActions.push('ENABLE_BLE_CONVOY_RELAY');
  }

  // 2. Supervisión de convoy cooperativo BLE/V2V
  const peerStatus = convoyPeers.map((p) => {
    const distM = Math.round(haversineKm(egoPos, { lat: p.lat, lon: p.lon }) * 1000);
    const staleS = Math.max(0, (nowMs - p.lastSeenMs) / 1000);
    const stoppedS = p.stoppedSinceMs != null && p.speedMs < 0.8 ? Math.max(0, (nowMs - p.stoppedSinceMs) / 1000) : 0;

    let state = 'LINKED';
    if (stoppedS >= unexpectedStopS) state = 'PEER_STOPPED_CHECK';
    else if (staleS >= lostContactS) state = 'CONTACT_LOST';
    else if (distM > maxConvoySpacingM) state = 'SEPARATED';

    return Object.freeze({
      id: p.id,
      callsign: p.callsign ?? p.id,
      distM,
      staleS: +staleS.toFixed(1),
      stoppedS: +stoppedS.toFixed(1),
      rssiDbm: p.rssiDbm ?? null,
      state,
    });
  });

  const convoyAlerts = peerStatus.filter((p) => p.state !== 'LINKED');
  return Object.freeze({
    basis: 'MEASURED',
    upcomingShadow: upcomingShadow
      ? Object.freeze({
          ...upcomingShadow,
          etaS: egoSpeedMs > 1 ? Math.round(upcomingShadow.distAheadM / egoSpeedMs) : null,
          actions: shadowActions,
          voiceCue: `En ${upcomingShadow.distAheadM >= 1000 ? `${(upcomingShadow.distAheadM / 1000).toFixed(1)} kilómetros` : `${Math.round(upcomingShadow.distAheadM)} metros`}, zona sin cobertura (${upcomingShadow.name}). Modo autónomo y radio local listos.`,
        })
      : null,
    convoyCount: peerStatus.length,
    peerStatus,
    convoyAlerts,
  });
}

/* ───────────── 5. Índice de fatiga y micro-sueño sin cámara ni PII (WOCL + espectro IMU) ───────────── */

/**
 * Estima el riesgo de fatiga al volante sin cámara facial ni nube ni PII:
 * combina horas de conducción continua (Reglamento UE 561/2006 / DGT 120 min), ventana circadiana
 * WOCL (Åkerstedt & Folkard 1997) e inestabilidad lateral por jerk IMU (correcciones bruscas de carril,
 * proxy físico de SDLP, Verster & Roth 2011).
 */
export function assessDriverFatigueRisk({
  continuousDriveMin,
  localHour,
  lateralAccelSamplesMs2 = [],
  sampleHz,
  maxContinuousDriveMin = 120,
}) {
  reqFinite(continuousDriveMin, 'continuousDriveMin');
  reqFinite(localHour, 'localHour');
  reqFinite(sampleHz, 'sampleHz');
  if (continuousDriveMin < 0 || localHour < 0 || localHour >= 24 || !(sampleHz > 0)) {
    throw new RangeError('assessDriverFatigueRisk: parámetros fuera de rango');
  }

  // Factor 1: tiempo continuo sin descanso (120 min = recomendación DGT / mitad del límite UE 561/2006)
  const durationScore = Math.min(1, continuousDriveMin / (maxContinuousDriveMin * 1.5));

  // Factor 2: ventana circadiana de mínimo alerta WOCL (Åkerstedt & Folkard 1997):
  // pico primario 02:00–06:00 (0,85), secundario postprandial 14:00–16:00 (0,35)
  const circadianScore = (localHour >= 2 && localHour < 6)
    ? 0.85
    : (localHour >= 0 && localHour < 2) || (localHour >= 6 && localHour < 7)
      ? 0.45
      : (localHour >= 14 && localHour < 16)
        ? 0.35
        : 0.10;

  // Factor 3: inestabilidad lateral por IMU (jerk lateral RMS + micro-correcciones bruscas en zig-zag)
  let lateralJerkRmsMs3 = null;
  let microCorrectionBursts = 0;
  let imuInstabilityScore = 0;
  if (lateralAccelSamplesMs2.length >= 6) {
    let sqSum = 0;
    let prevSign = 0;
    for (let i = 1; i < lateralAccelSamplesMs2.length; i++) {
      const jerk = (lateralAccelSamplesMs2[i] - lateralAccelSamplesMs2[i - 1]) * sampleHz;
      sqSum += jerk * jerk;
      // Cambio brusco de signo con salto de jerk > 1.8 m/s³ indica volantazo correctivo
      const sign = Math.sign(jerk);
      if (Math.abs(jerk) >= 1.8 && prevSign !== 0 && sign !== prevSign) microCorrectionBursts++;
      if (Math.abs(jerk) >= 0.8) prevSign = sign;
    }
    lateralJerkRmsMs3 = Math.sqrt(sqSum / (lateralAccelSamplesMs2.length - 1));
    const durationSec = (lateralAccelSamplesMs2.length - 1) / sampleHz;
    const burstsPerMin = (microCorrectionBursts / Math.max(1, durationSec)) * 60;
    imuInstabilityScore = Math.min(1, 0.55 * (lateralJerkRmsMs3 / 2.5) + 0.45 * (burstsPerMin / 8));
  }

  const composite = 0.40 * durationScore + 0.25 * circadianScore + 0.35 * imuInstabilityScore;
  const reasons = [];
  if (continuousDriveMin >= maxContinuousDriveMin) reasons.push(`llevas ${Math.round(continuousDriveMin)} min sin pausa (recomendado descansar cada ${maxContinuousDriveMin} min)`);
  if (circadianScore >= 0.8) reasons.push('franja nocturna de mínimo alerta circadiano WOCL (02:00–06:00)');
  else if (circadianScore >= 0.35) reasons.push('franja de descenso circadiano');
  if (imuInstabilityScore >= 0.55) reasons.push(`correcciones laterales bruscas detectadas por IMU (jerk RMS ${lateralJerkRmsMs3.toFixed(2)} m/s³)`);

  let level = 'LOW';
  if (composite >= 0.72 || (continuousDriveMin >= 180 && imuInstabilityScore >= 0.5)) level = 'CRITICAL_STOP_NOW';
  else if (composite >= 0.52 || continuousDriveMin >= maxContinuousDriveMin) level = 'HIGH_STOP_SOON';
  else if (composite >= 0.34) level = 'MODERATE_PLAN_BREAK';

  return Object.freeze({
    basis: lateralAccelSamplesMs2.length >= 6 ? 'HYBRID' : 'MODEL',
    privacy: 'Cero cámara facial, cero biometría, cero nube (solo reloj + IMU local).',
    refs: Object.freeze([
      'Åkerstedt & Folkard (1997), Sleep 20(1):42-48 (WOCL)',
      'Verster & Roth (2011), Int. J. Gen. Med. 4:359-371 (SDLP)',
      'Reglamento (CE) 561/2006 / Recomendación DGT descansos 2 h',
    ]),
    fatigueScore: +composite.toFixed(3),
    level,
    continuousDriveMin: +continuousDriveMin.toFixed(1),
    circadianWindow: circadianScore >= 0.8 ? 'WOCL_PRIMARY' : circadianScore >= 0.35 ? 'WOCL_SECONDARY' : 'NORMAL',
    lateralJerkRmsMs3: lateralJerkRmsMs3 == null ? null : +lateralJerkRmsMs3.toFixed(3),
    microCorrectionBursts,
    reasons,
    voiceCue: level === 'CRITICAL_STOP_NOW'
      ? 'Alerta de fatiga alta. Para en la próxima área de servicio para descansar.'
      : level === 'HIGH_STOP_SOON'
        ? 'Llevas mucho tiempo conduciendo. Planifica una pausa de 15 minutos.'
        : null,
  });
}

/* ───────────── 6. Árbitro cognitivo ISO 15005 + Android Auto + Debriefing forense SHA-256 ───────────── */

const ALERT_PRIORITY = Object.freeze({
  EMERGENCY_CROSSING: 100,
  QUEUE_TAIL_SHOCKWAVE: 90,
  CURVE_BRAKE_NOW: 85,
  HYDROPLANING_OR_GRIP: 80,
  FOG_OVERDRIVING: 75,
  CONVOY_STOPPED: 70,
  CURVE_COAST_EARLY: 60,
  SHADOW_ZONE_PREP: 45,
  DRIVER_FATIGUE: 40,
});

/**
 * Orquestador en tiempo real del Copiloto 5D con arbitraje cognitivo (evita fatiga de alertas),
 * enfriamiento por categoría y emisor de instantáneas compactas para Android Auto (`DriveHazards`).
 */
export function createDriveCopilotEngine({ voiceCooldownMs = 15_000 } = {}) {
  const lastSpokenAt = new Map();
  const telemetryLog = [];

  function evaluateTick({
    nowMs = Date.now(),
    gripInput,
    curveInput = null,
    crossingInput = null,
    queueInput = null, // { distToIncidentM, egoSpeedKmh, incidentAgeS, lwrParams }
    shadowConvoyInput = null,
    fatigueInput = null,
  }) {
    const grip = computeDynamicGripEnvelope(gripInput);
    const curves = curveInput ? analyzeRouteCurvesAhead(curveInput) : null;
    const crossing = crossingInput ? evaluateRoadEmergencyCrossing(crossingInput) : null;
    const queue = queueInput ? movingQueueIntercept(queueInput) : null;
    const shadowConvoy = shadowConvoyInput ? evaluateConvoyAndShadowHorizon(shadowConvoyInput) : null;
    const fatigue = fatigueInput ? assessDriverFatigueRisk(fatigueInput) : null;

    const alerts = [];
    if (crossing?.doNotCross) {
      alerts.push({ id: 'EMERGENCY_CROSSING', priority: ALERT_PRIORITY.EMERGENCY_CROSSING, severity: 'ROJO', title: 'NO CRUZAR: tramo cortado por riada/fuego', detail: crossing.reasons.join(' · '), voice: crossing.voiceCue });
    }
    if (queue?.queueForming && queue.interceptTimeS <= 25) {
      alerts.push({ id: 'QUEUE_TAIL_SHOCKWAVE', priority: ALERT_PRIORITY.QUEUE_TAIL_SHOCKWAVE, severity: queue.interceptTimeS <= 12 ? 'ROJO' : 'AMBAR', title: `Cola móvil en ${queue.interceptDistM} m (${queue.interceptTimeS} s)`, detail: `Onda LWR retrocede a ${Math.abs(queue.shockwaveKmh)} km/h`, voice: `Retención creciendo hacia ti en ${Math.round(queue.interceptDistM / 10) * 10} metros. Reduce velocidad.` });
    }
    if (curves?.topCurve?.cue === 'BRAKE_NOW') {
      const c = curves.topCurve;
      alerts.push({ id: 'CURVE_BRAKE_NOW', priority: ALERT_PRIORITY.CURVE_BRAKE_NOW, severity: 'ROJO', title: `Frena: curva ${c.direction} ${c.apexAheadM} m · máx ${c.safeSpeedKmh} km/h`, detail: `Radio ${c.minRadiusM} m · vuelco ${c.rolloverSpeedKmh} km/h`, voice: c.voiceCue });
    } else if (curves?.topCurve?.cue === 'COAST_EARLY') {
      const c = curves.topCurve;
      alerts.push({ id: 'CURVE_COAST_EARLY', priority: ALERT_PRIORITY.CURVE_COAST_EARLY, severity: 'AMBAR', title: `Curva ${c.direction} en ${c.apexAheadM} m · ${c.safeSpeedKmh} km/h`, detail: `Radio ${c.minRadiusM} m`, voice: c.voiceCue });
    }
    if (grip.hydroplaningRisk === 'CRITICAL_HYDROPLANING' || grip.gripStatus === 'CRITICAL_SATURATION') {
      alerts.push({ id: 'HYDROPLANING_OR_GRIP', priority: ALERT_PRIORITY.HYDROPLANING_OR_GRIP, severity: 'ROJO', title: `Riesgo aquaplaning / límite adherencia (${grip.kammUtilizationPct} %)`, detail: `Crítico NASA ${grip.hydroplaningCriticalKmh} km/h · SSD ${grip.stoppingDistM} m`, voice: 'Riesgo de aquaplaning. Suelta el acelerador suavemente sin frenazos bruscos.' });
    }
    if (grip.overdrivingVisibility) {
      alerts.push({ id: 'FOG_OVERDRIVING', priority: ALERT_PRIORITY.FOG_OVERDRIVING, severity: 'AMBAR', title: `Superas visibilidad (${grip.visibilityM} m): máx ${grip.maxSafeVisibilitySpeedKmh} km/h`, detail: `Parada actual ${grip.stoppingDistM} m`, voice: `Visibilidad reducida. Velocidad segura máxima ${Math.round(grip.maxSafeVisibilitySpeedKmh)} kilómetros por hora.` });
    }
    if (shadowConvoy?.convoyAlerts?.some((p) => p.state === 'PEER_STOPPED_CHECK')) {
      const p = shadowConvoy.convoyAlerts.find((x) => x.state === 'PEER_STOPPED_CHECK');
      alerts.push({ id: 'CONVOY_STOPPED', priority: ALERT_PRIORITY.CONVOY_STOPPED, severity: 'AMBAR', title: `Convoy: ${p.callsign} detenido (${p.distM} m)`, detail: `Parado hace ${p.stoppedS} s`, voice: `Atención convoy: ${p.callsign} se ha detenido a ${p.distM} metros.` });
    }
    if (shadowConvoy?.upcomingShadow) {
      const sh = shadowConvoy.upcomingShadow;
      alerts.push({ id: 'SHADOW_ZONE_PREP', priority: ALERT_PRIORITY.SHADOW_ZONE_PREP, severity: 'INFO', title: `Sin cobertura en ${sh.distAheadM} m (${sh.name})`, detail: sh.actions.join(', '), voice: sh.voiceCue });
    }
    if (fatigue && (fatigue.level === 'CRITICAL_STOP_NOW' || fatigue.level === 'HIGH_STOP_SOON')) {
      alerts.push({ id: 'DRIVER_FATIGUE', priority: ALERT_PRIORITY.DRIVER_FATIGUE, severity: fatigue.level === 'CRITICAL_STOP_NOW' ? 'ROJO' : 'AMBAR', title: `Fatiga ${fatigue.level === 'CRITICAL_STOP_NOW' ? 'alta' : 'moderada-alta'} (${Math.round(fatigue.continuousDriveMin)} min)`, detail: fatigue.reasons.join(' · '), voice: fatigue.voiceCue });
    }

    alerts.sort((a, b) => b.priority - a.priority);
    const primaryAlert = alerts[0] ?? null;

    // Arbitraje de voz con enfriamiento por categoría (ISO 15005: no interrumpir ni spammear)
    let spokenNow = null;
    if (primaryAlert?.voice) {
      const prevT = lastSpokenAt.get(primaryAlert.id) ?? -Infinity;
      if (nowMs - prevT >= voiceCooldownMs) {
        lastSpokenAt.set(primaryAlert.id, nowMs);
        spokenNow = primaryAlert.voice;
      }
    }

    // Techo de velocidad segura combinado (mínimo entre curva, visibilidad y 90% aquaplaning)
    const speedCaps = [];
    if (curves?.topCurve) speedCaps.push(curves.topCurve.safeSpeedKmh);
    if (grip.maxSafeVisibilitySpeedKmh != null) speedCaps.push(grip.maxSafeVisibilitySpeedKmh);
    if (grip.hydroplaningRisk !== 'NONE') speedCaps.push(Math.round(grip.hydroplaningCriticalKmh * 0.88));
    const recommendedMaxKmh = speedCaps.length ? Math.min(...speedCaps) : null;

    telemetryLog.push({
      tMs: nowMs,
      speedKmh: grip.speedKmh,
      kammPct: grip.kammUtilizationPct,
      stoppingDistM: grip.stoppingDistM,
      alertId: primaryAlert?.id ?? null,
      severity: primaryAlert?.severity ?? 'VERDE',
    });

    // Formato compacto listo para `SendaNative.publishDriveState(JSON.stringify(androidAutoPayload))`
    const androidAutoPayload = Object.freeze({
      ts: nowMs,
      speedKmh: grip.speedKmh,
      recommendedMaxKmh,
      stoppingDistM: grip.stoppingDistM,
      gripReservePct: grip.gripReservePct,
      status: primaryAlert ? primaryAlert.severity : 'VERDE',
      rows: alerts.slice(0, 4).map((a) => `${a.severity === 'ROJO' ? '!' : a.severity === 'AMBAR' ? '▲' : '·'} ${a.title}`),
    });

    return Object.freeze({
      nowMs,
      status: primaryAlert ? primaryAlert.severity : 'VERDE',
      primaryAlert,
      alerts,
      spokenNow,
      recommendedMaxKmh,
      grip,
      curves,
      crossing,
      queue,
      shadowConvoy,
      fatigue,
      androidAutoPayload,
    });
  }

  /** Genera un informe post-viaje determinista con huella SHA-256 (0 PII) sobre la sesión grabada. */
  async function buildTripForensicDebrief() {
    const n = telemetryLog.length;
    if (n === 0) {
      return Object.freeze({ samples: 0, safetyScore100: null, sha256: null, basis: 'MEASURED' });
    }
    const maxKammPct = Math.max(...telemetryLog.map((x) => x.kammPct));
    const meanKammPct = telemetryLog.reduce((s, x) => s + x.kammPct, 0) / n;
    const redTicks = telemetryLog.filter((x) => x.severity === 'ROJO').length;
    const amberTicks = telemetryLog.filter((x) => x.severity === 'AMBAR').length;
    const maxSpeedKmh = Math.max(...telemetryLog.map((x) => x.speedKmh));
    const alertCounts = {};
    for (const x of telemetryLog) if (x.alertId) alertCounts[x.alertId] = (alertCounts[x.alertId] ?? 0) + 1;

    const penalty = Math.min(80, (redTicks / n) * 90 + (amberTicks / n) * 35 + Math.max(0, maxKammPct - 75) * 0.4);
    const core = {
      schema: 'senda.drive-copilot-debrief/v1',
      samples: n,
      maxSpeedKmh: +maxSpeedKmh.toFixed(1),
      maxKammUtilizationPct: +maxKammPct.toFixed(1),
      meanKammUtilizationPct: +meanKammPct.toFixed(1),
      redAlerts: redTicks,
      amberAlerts: amberTicks,
      alertCounts,
      safetyScore100: +Math.max(0, 100 - penalty).toFixed(1),
      basis: 'MEASURED',
    };
    const digestBuf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(core)));
    const sha256 = Array.from(new Uint8Array(digestBuf), (b) => b.toString(16).padStart(2, '0')).join('');
    return Object.freeze({ ...core, sha256 });
  }

  return Object.freeze({
    evaluateTick,
    buildTripForensicDebrief,
    getSampleCount: () => telemetryLog.length,
  });
}

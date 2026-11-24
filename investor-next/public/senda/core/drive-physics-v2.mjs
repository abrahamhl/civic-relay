/**
 * SENDA Drive · Física matemática y propagación V2V (0 €, 100 % en el dispositivo, sin red).
 *
 * Incluye únicamente ecuaciones cerradas con fuente primaria verificada (CLAUDE.md §1):
 *  1) RSS — Responsibility-Sensitive Safety (Shalev-Shwartz, Shammah, Shashua 2017, arXiv:1708.06374;
 *     IEEE Std 2846-2022): distancia longitudinal segura en mismo sentido (Definición 1 / Lema 2)
 *     y en sentido contrario (Definición 2). Los parámetros de aceleración/frenado NO llevan valores
 *     por defecto sin fuente: deben declararse explícitamente al llamar.
 *  2) Propagación V2V de dos rayos sobre suelo (Two-Ray Ground Reflection, campo abierto/autovía):
 *     distancia crítica d_c = 4·π·h_t·h_r / λ, pérdida en espacio libre (Friis) y asintótica 1/d⁴,
 *     desplazamiento Doppler f_D = v_rel / λ, tiempo de coherencia T_c ≈ 0,423 / f_D y ventana
 *     máxima de contacto BLE/V2V entre dos coches que se cruzan.
 *  3) Bluetooth 6.0 Channel Sounding (Core Spec 6.0, sept. 2024): física de distancia por pendiente
 *     de fase (PBR: d = c·Δφ / (4π·Δf)), distancia de ambigüedad d_amb = c / (2·Δf) ≈ 150 m a 1 MHz,
 *     y resolución de ambigüedad combinando PBR + RTT.
 *  4) Cinemática planar desde trazas GNSS (aceleración longitudinal Theil–Sen, aceleración lateral
 *     centrípeta a_y = v·ω, magnitud en g con g_0 = 9,80665 m/s² exacto SI, radio de curvatura).
 */
import { theilSenSlope } from './drive-hazard.mjs';

export const C_LIGHT = 299_792_458; // m/s (definición exacta SI)
export const G_STD = 9.80665;       // m/s² (gravedad estándar exacta ISO 80000-3)

const need = (fn, obj, keys) => {
  for (const k of keys) {
    if (typeof obj?.[k] !== 'number' || !Number.isFinite(obj[k])) {
      throw new Error(`${fn}: «${k}» debe declararse como número finito`);
    }
  }
};

/**
 * Escenario ilustrativo DECLARADO para demostraciones y pruebas de RSS (NO calibrado en flota real).
 * Nota de Shalev-Shwartz et al. (arXiv:1708.06374 §3.3): los parámetros RSS dependen de la normativa,
 * el estado del firme y el tipo de conductor/vehículo.
 */
export const EXAMPLE_RSS_PARAMS = Object.freeze({
  rhoS: 1.5,            // tiempo de respuesta declarado (s)
  aMaxAccelMs2: 2.0,    // aceleración máxima durante rho (m/s²)
  aMinBrakeMs2: 3.4,    // deceleración mínima asumida (m/s², referencia AASHTO SSD)
  aMaxBrakeMs2: 8.0,    // frenada máxima asumida del coche delantero (m/s²)
  aMinBrakeCorrectMs2: 3.4, // deceleración mínima del coche en sentido correcto (sentido opuesto)
  basis: 'EJEMPLO_DECLARADO · parámetros sin calibrar en flota (fórmula exacta arXiv:1708.06374 / IEEE 2846)',
});

/**
 * Distancia longitudinal segura RSS en el mismo sentido (Shalev-Shwartz et al. 2017, Def. 1 / Lema 2).
 * @param {{ vRearMs: number, vFrontMs: number }} speeds velocidades (m/s, ≥ 0)
 * @param {{ rhoS: number, aMaxAccelMs2: number, aMinBrakeMs2: number, aMaxBrakeMs2: number }} params parámetros declarados
 */
export function rssLongitudinalSameDir({ vRearMs, vFrontMs }, params) {
  need('rssLongitudinalSameDir', { vRearMs, vFrontMs }, ['vRearMs', 'vFrontMs']);
  need('rssLongitudinalSameDir', params, ['rhoS', 'aMaxAccelMs2', 'aMinBrakeMs2', 'aMaxBrakeMs2']);
  const { rhoS, aMaxAccelMs2, aMinBrakeMs2, aMaxBrakeMs2 } = params;
  if (vRearMs < 0 || vFrontMs < 0 || rhoS < 0 || aMaxAccelMs2 < 0 || aMinBrakeMs2 <= 0 || aMaxBrakeMs2 <= 0) {
    throw new Error('rssLongitudinalSameDir: parámetros físicos fuera de dominio');
  }
  const vRearRho = vRearMs + rhoS * aMaxAccelMs2;
  const d = vRearMs * rhoS
    + 0.5 * aMaxAccelMs2 * rhoS * rhoS
    + (vRearRho * vRearRho) / (2 * aMinBrakeMs2)
    - (vFrontMs * vFrontMs) / (2 * aMaxBrakeMs2);
  return {
    dMinM: +Math.max(0, d).toFixed(3),
    vRearAfterRhoMs: +vRearRho.toFixed(3),
    basis: params.basis ?? 'PARAMETROS_DECLARADOS_POR_LLAMANTE',
    source: 'Shalev-Shwartz, Shammah & Shashua (2017), arXiv:1708.06374, Def. 1 / IEEE Std 2846-2022',
  };
}

/**
 * Distancia longitudinal segura RSS en sentidos opuestos (Shalev-Shwartz et al. 2017, Def. 2).
 * Relevante en carreteras convencionales de un carril por sentido (72 % de fallecidos en España, DGT 2024).
 */
export function rssLongitudinalOppositeDir({ v1Ms, v2Ms }, params) {
  need('rssLongitudinalOppositeDir', { v1Ms, v2Ms }, ['v1Ms', 'v2Ms']);
  need('rssLongitudinalOppositeDir', params, ['rhoS', 'aMaxAccelMs2', 'aMinBrakeCorrectMs2', 'aMinBrakeMs2']);
  const { rhoS, aMaxAccelMs2, aMinBrakeCorrectMs2, aMinBrakeMs2 } = params;
  const s1 = Math.abs(v1Ms), s2 = Math.abs(v2Ms);
  if (rhoS < 0 || aMaxAccelMs2 < 0 || aMinBrakeCorrectMs2 <= 0 || aMinBrakeMs2 <= 0) {
    throw new Error('rssLongitudinalOppositeDir: parámetros físicos fuera de dominio');
  }
  const v1Rho = s1 + rhoS * aMaxAccelMs2;
  const v2Rho = s2 + rhoS * aMaxAccelMs2;
  const d = ((s1 + v1Rho) / 2) * rhoS + (v1Rho * v1Rho) / (2 * aMinBrakeCorrectMs2)
    + ((s2 + v2Rho) / 2) * rhoS + (v2Rho * v2Rho) / (2 * aMinBrakeMs2);
  return {
    dMinM: +d.toFixed(3),
    basis: params.basis ?? 'PARAMETROS_DECLARADOS_POR_LLAMANTE',
    source: 'Shalev-Shwartz, Shammah & Shashua (2017), arXiv:1708.06374, Def. 2',
  };
}

/**
 * Modelo V2V de dos rayos sobre suelo (Two-Ray Ground Reflection) + Doppler + ventana de contacto.
 * Ecuaciones exactas de campo abierto (LOS + reflexión rasante en asfalto; NO incluye pérdidas por carrocería
 * salvo que el llamante las sume aparte).
 *
 * @param {{ distM: number, freqHz: number, htM: number, hrM: number, vRelMs?: number, gainLin?: number }} p
 */
export function twoRayV2vChannel({ distM, freqHz, htM, hrM, vRelMs = 0, gainLin = 1 }) {
  need('twoRayV2vChannel', { distM, freqHz, htM, hrM, vRelMs, gainLin }, ['distM', 'freqHz', 'htM', 'hrM', 'vRelMs', 'gainLin']);
  if (distM <= 0 || freqHz <= 0 || htM <= 0 || hrM <= 0 || gainLin <= 0) {
    throw new Error('twoRayV2vChannel: distancias, alturas, frecuencia y ganancia deben ser > 0');
  }
  const lambdaM = C_LIGHT / freqHz;
  const dCritM = (4 * Math.PI * htM * hrM) / lambdaM;
  const fsplDb = 20 * Math.log10((4 * Math.PI * distM) / lambdaM) - 10 * Math.log10(gainLin);
  const twoRayAsympDb = 40 * Math.log10(distM) - 10 * Math.log10(gainLin * htM * htM * hrM * hrM);
  // Suma coherente exacta con reflexión ideal Γ = -1 (incidencia rasante) para estimar el desvanecimiento
  const dLos = Math.hypot(distM, htM - hrM);
  const dRef = Math.hypot(distM, htM + hrM);
  const deltaPhi = (2 * Math.PI * (dRef - dLos)) / lambdaM;
  // Potencia recibida relativa a Friis: |1/dLos - exp(-j·Δφ)/dRef|² · dLos²
  const re = 1 / dLos - Math.cos(deltaPhi) / dRef;
  const im = Math.sin(deltaPhi) / dRef;
  const fieldMag = Math.hypot(re, im);
  const coherentLossDb = -20 * Math.log10((Math.sqrt(gainLin) * lambdaM) / (4 * Math.PI) * fieldMag);
  const pathLossEnvelopeDb = distM <= dCritM ? fsplDb : twoRayAsympDb;
  const dopplerHz = Math.abs(vRelMs) / lambdaM;
  const coherenceTimeS = dopplerHz > 0 ? 0.423 / dopplerHz : null; // Clarke/Rappaport T_c ≈ 0.423 / f_D
  const contactWindowS = Math.abs(vRelMs) > 0 ? (2 * distM) / Math.abs(vRelMs) : null;
  return {
    lambdaM: +lambdaM.toFixed(6),
    dCritM: +dCritM.toFixed(2),
    regime: distM <= dCritM ? 'FRIIS_NEAR' : 'TWO_RAY_FAR_D4',
    fsplDb: +fsplDb.toFixed(2),
    twoRayAsympDb: +twoRayAsympDb.toFixed(2),
    pathLossEnvelopeDb: +pathLossEnvelopeDb.toFixed(2),
    coherentLossDb: Number.isFinite(coherentLossDb) ? +coherentLossDb.toFixed(2) : null,
    dopplerHz: +dopplerHz.toFixed(2),
    coherenceTimeMs: coherenceTimeS != null ? +(coherenceTimeS * 1000).toFixed(3) : null,
    contactWindowS: contactWindowS != null ? +contactWindowS.toFixed(2) : null,
    source: 'Two-Ray Ground Reflection (d_c = 4π·h_t·h_r/λ, 40 dB/dec) + Doppler f_D = v_rel/λ (Rappaport / ITU)',
  };
}

/**
 * Física de Bluetooth 6.0 Channel Sounding (Core Spec 6.0, sept. 2024):
 *  - PBR (Phase-Based Ranging): d_pbr = c · Δφ / (4π · Δf), con ambigüedad d_amb = c / (2 · Δf).
 *  - Si se aporta RTT (tiempo de ida y vuelta en ns), resuelve el múltiplo entero k·d_amb.
 * NOTA: los móviles Android comerciales previos a hardware/API BT 6.0 CS no exponen todavía PBR crudo en WebView.
 */
export function bleChannelSoundingRange({ deltaPhiRad, deltaFreqHz, rttNs = null }) {
  need('bleChannelSoundingRange', { deltaPhiRad, deltaFreqHz }, ['deltaPhiRad', 'deltaFreqHz']);
  if (deltaFreqHz <= 0) throw new Error('bleChannelSoundingRange: deltaFreqHz debe ser > 0');
  const dAmbM = C_LIGHT / (2 * deltaFreqHz);
  const wrappedPhi = ((deltaPhiRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const dPbrM = (C_LIGHT * wrappedPhi) / (4 * Math.PI * deltaFreqHz);
  let dRttM = null, dResolvedM = dPbrM, wrapIndex = 0;
  if (typeof rttNs === 'number' && Number.isFinite(rttNs) && rttNs >= 0) {
    dRttM = (C_LIGHT * (rttNs * 1e-9)) / 2;
    wrapIndex = Math.max(0, Math.round((dRttM - dPbrM) / dAmbM));
    dResolvedM = wrapIndex * dAmbM + dPbrM;
  }
  return {
    dAmbM: +dAmbM.toFixed(3),
    dPbrM: +dPbrM.toFixed(3),
    dRttM: dRttM != null ? +dRttM.toFixed(3) : null,
    wrapIndex,
    dResolvedM: +dResolvedM.toFixed(3),
    source: 'Bluetooth Core Specification 6.0 (sept. 2024), Channel Sounding PBR + RTT',
  };
}

/**
 * Cinemática planar en tiempo real a partir de una ventana corta de muestras GNSS:
 * [{ t (s), speedMs, headingDeg }]. Devuelve aceleración longitudinal (Theil–Sen),
 * aceleración lateral centrípeta (v·ω), magnitud total en g y radio de curvatura.
 */
export function estimatePlanarKinematics(samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return { axMs2: null, ayMs2: null, aNormG: null, yawRateRadS: null, curveRadiusM: null };
  }
  const speedPts = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.speedMs));
  if (speedPts.length < 2) return { axMs2: null, ayMs2: null, aNormG: null, yawRateRadS: null, curveRadiusM: null };
  const axMs2 = theilSenSlope(speedPts.map((s) => ({ t: s.t, v: s.speedMs })));
  const lastV = speedPts.at(-1).speedMs;

  // Desenvolver rumbo en grados para evitar saltos 359° -> 1°
  const hdgPts = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.headingDeg));
  let yawRateRadS = null, ayMs2 = null, curveRadiusM = null;
  if (hdgPts.length >= 2 && lastV > 1) {
    const unwrapped = [{ t: hdgPts[0].t, v: hdgPts[0].headingDeg }];
    for (let i = 1; i < hdgPts.length; i++) {
      const prev = unwrapped[i - 1].v;
      let diff = ((hdgPts[i].headingDeg - prev + 540) % 360) - 180;
      unwrapped.push({ t: hdgPts[i].t, v: prev + diff });
    }
    const yawDegS = theilSenSlope(unwrapped);
    yawRateRadS = (yawDegS * Math.PI) / 180;
    ayMs2 = lastV * yawRateRadS;
    curveRadiusM = Math.abs(yawRateRadS) > 1e-4 ? +(lastV / Math.abs(yawRateRadS)).toFixed(1) : null;
  }
  const aNormMs2 = Math.hypot(axMs2, ayMs2 ?? 0);
  return {
    axMs2: +axMs2.toFixed(3),
    ayMs2: ayMs2 != null ? +ayMs2.toFixed(3) : null,
    aNormG: +(aNormMs2 / G_STD).toFixed(3),
    yawRateRadS: yawRateRadS != null ? +yawRateRadS.toFixed(4) : null,
    curveRadiusM,
  };
}

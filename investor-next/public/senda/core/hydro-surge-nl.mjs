/**
 * SENDA · Física Hidrológica de Inundación Vial, Estabilidad de Vehículos y Rebase de Diques (ES DANA + NL Pólderes)
 * (0 €, 100 % en el dispositivo, sin red).
 *
 * Ecuaciones exactas con fuentes primarias (CLAUDE.md §1):
 *  1) Fórmula de Manning (hidráulica de lámina libre): v = (1/n) · R_h^(2/3) · S^(1/2)
 *  2) Criterio hidrodinámico de flotación y arrastre de vehículos en calzada inundada
 *     (Shand et al. 2011, Australian Rainfall & Runoff; Martínez-Gomariz et al. 2017, J. Flood Risk Mgmt):
 *     un turismo pierde adherencia/flota a partir de h ≈ 0,30 m o producto D·v ≈ 0,45 m²/s.
 *  3) Rebase de oleaje en diques costeros y fluviales — Manual EurOtop (2018, Van der Meer et al., ec. 5.10/5.11):
 *     q / √(g·H_m0³) = 0,09 · exp(−(1,5 · R_c / (H_m0 · γ_f · γ_β))^1,3) (oleaje no rompiente, valor medio).
 *  4) Resguardo altimétrico frente al datum NAP (*Normaal Amsterdams Peil*, Países Bajos).
 */
import { G_STD } from './drive-physics-v2.mjs';

export const HYDRO_SOURCES = Object.freeze({
  manning: 'Manning (1891) / Chow Open-Channel Hydraulics',
  vehicleStability: 'Martínez-Gomariz et al. (2017), J. Flood Risk Mgmt; Shand et al. (2011) ARR Project 10',
  eurotop: 'Van der Meer et al., EurOtop Manual on Wave Overtopping of Sea Defences and Related Structures (2nd ed., 2018)',
});

/** Velocidad y caudal en lámina libre por fórmula exacta de Manning. */
export function manningOpenChannel({ hydraulicRadiusM, slope, manningN, areaM2 = null }) {
  if (!(hydraulicRadiusM > 0) || !(slope > 0) || !(manningN > 0)) {
    throw new Error('manningOpenChannel: hydraulicRadiusM, slope y manningN deben ser > 0');
  }
  const velocityMs = (1 / manningN) * (hydraulicRadiusM ** (2 / 3)) * Math.sqrt(slope);
  return {
    velocityMs: +velocityMs.toFixed(3),
    dischargeM3s: areaM2 != null && areaM2 > 0 ? +(velocityMs * areaM2).toFixed(3) : null,
    source: HYDRO_SOURCES.manning,
  };
}

/**
 * Evalúa el peligro hidrodinámico de atravesar una calzada inundada (pasos inferiores DANA ES / pólderes NL).
 * Devuelve nivel de riesgo exacto según profundidad `depthM` y producto profundidad×velocidad `dvM2s`.
 */
export function vehicleFloodStability({ depthM, velocityMs = 0 }) {
  if (!Number.isFinite(depthM) || depthM < 0 || !Number.isFinite(velocityMs) || velocityMs < 0) {
    throw new Error('vehicleFloodStability: depthM y velocityMs deben ser ≥ 0');
  }
  const dvM2s = +(depthM * velocityMs).toFixed(3);
  let level = 'SAFE';
  let advisory = 'Calzada transitable con precaución';
  if (depthM >= 0.50 || dvM2s >= 0.60) {
    level = 'EXTREME_WASH_AWAY';
    advisory = 'PELIGRO EXTREMO: arrastre/flotación incluso para todoterrenos y furgonetas — NO ENTRAR';
  } else if (depthM >= 0.30 || dvM2s >= 0.45) {
    level = 'UNSTABLE_PASSENGER_CAR';
    advisory = 'PELIGRO: un turismo flota o pierde control desde 30 cm o D·v ≥ 0,45 m²/s — DAR LA VUELTA';
  } else if (depthM >= 0.15 || dvM2s >= 0.25) {
    level = 'CAUTION_AQUAPLANING';
    advisory = 'PRECAUCIÓN: riesgo severo de aquaplaning y fallo eléctrico/admisión';
  }
  return {
    depthM: +depthM.toFixed(3),
    velocityMs: +velocityMs.toFixed(3),
    dvM2s,
    level,
    advisory,
    source: HYDRO_SOURCES.vehicleStability,
  };
}

/**
 * Descarga media de rebase de oleaje en un dique según EurOtop (2018, ec. 5.10, límite máximo no rompiente).
 * @param {{ hm0M: number, freeboardRcM: number, gammaF?: number, gammaBeta?: number }} p
 * @returns {{ qM3sPerM: number, qLsPerM: number, severity: string, source: string }}
 */
export function eurotopOvertopping({ hm0M, freeboardRcM, gammaF = 1.0, gammaBeta = 1.0 }) {
  if (!(hm0M > 0) || !Number.isFinite(freeboardRcM) || freeboardRcM < 0 || !(gammaF > 0) || !(gammaBeta > 0)) {
    throw new Error('eurotopOvertopping: hm0M, gammaF, gammaBeta > 0 y freeboardRcM ≥ 0');
  }
  const relRc = freeboardRcM / (hm0M * gammaF * gammaBeta);
  const qDimless = 0.09 * Math.exp(-((1.5 * relRc) ** 1.3));
  const qM3sPerM = qDimless * Math.sqrt(G_STD * (hm0M ** 3));
  const qLsPerM = qM3sPerM * 1000;
  // Umbrales orientativos EurOtop (2018) Tabla 3.1/3.2 para peatones, tráfico y daño estructural en dique
  let severity = 'LOW';
  if (qLsPerM >= 50) severity = 'CRITICAL_DIKE_DAMAGE';
  else if (qLsPerM >= 10) severity = 'DANGEROUS_VEHICLES_AND_CREST';
  else if (qLsPerM >= 1) severity = 'HAZARD_PEDESTRIANS_AND_SPRAY';
  return {
    relFreeboard: +relRc.toFixed(3),
    qM3sPerM: +qM3sPerM.toFixed(6),
    qLsPerM: +qLsPerM.toFixed(2),
    severity,
    source: HYDRO_SOURCES.eurotop,
  };
}

/** Resguardo altimétrico en Países Bajos frente al nivel del agua en referencia NAP (*Normaal Amsterdams Peil*). */
export function polderNapClearance({ roadElevationNapM, waterLevelNapM, dikeCrestNapM = null }) {
  if (!Number.isFinite(roadElevationNapM) || !Number.isFinite(waterLevelNapM)) {
    throw new Error('polderNapClearance: cotas NAP obligatorias');
  }
  const marginAboveWaterM = +(roadElevationNapM - waterLevelNapM).toFixed(2);
  const dikeFreeboardM = dikeCrestNapM != null && Number.isFinite(dikeCrestNapM)
    ? +(dikeCrestNapM - waterLevelNapM).toFixed(2) : null;
  const belowSeaLevel = roadElevationNapM < 0;
  return {
    roadElevationNapM: +roadElevationNapM.toFixed(2),
    waterLevelNapM: +waterLevelNapM.toFixed(2),
    marginAboveWaterM,
    dikeFreeboardM,
    belowSeaLevel,
    inundatedIfUnprotected: marginAboveWaterM < 0,
  };
}

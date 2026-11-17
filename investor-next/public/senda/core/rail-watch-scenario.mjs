/**
 * Escenario sintético y determinista para `rail-watch.mjs`. TODOS los valores son
 * ilustrativos: reproducen la FORMA de los patrones documentados (Adamuz, Angrois, Gelida),
 * no datos de Adif, Renfe ni de ningún operador. Ver docs/research/ACCIDENTES_GRAVES_Y_PREVENCION_2026-11-04.md.
 */
import { trackCircuitWatch, trackGeometryCrowd, speedTransitionAudit, weatherAssetWatch } from './rail-watch.mjs';

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const gauss = (R) => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());

/** 48 h de un circuito de vía cada 5 min; escalón de 0,7 V a las 26 h que deja la tensión POR ENCIMA del umbral. */
export function syntheticTrackCircuit({ seed = 7, hours = 48, stepAtH = 26, nominalV = 1.9, stepV = 0.7, thresholdV = 0.78 } = {}) {
  const R = rng(seed), out = [];
  for (let k = 0; k < (hours * 60) / 5; k++) {
    const t = k * 300, h = t / 3600, occupied = k % 6 === 2; // un tren cada 30 min ocupa el circuito
    const v = occupied ? 0.05 + R() * 0.05 : nominalV + 0.04 * Math.sin((2 * Math.PI * h) / 24) + gauss(R) * 0.02 - (h >= stepAtH ? stepV : 0);
    out.push({ t, v: +v.toFixed(3), occupied });
  }
  return { samples: out, stepAtS: stepAtH * 3600, accidentAtS: hours * 3600, thresholdV };
}

/** 60 viajes con 24 teléfonos distintos en 20 km: tramo degradándose (PK 12,35–12,45) e impacto repetido en el PK 7,8. */
export function syntheticPassengerTrips({ seed = 11, trips = 60, devices = 24, lengthM = 20000 } = {}) {
  const R = rng(seed), out = [];
  for (let n = 0; n < trips; n++) {
    const deviceId = `movil-${n % devices}`, gain = 0.8 + 0.4 * ((n % devices) / devices), t = n * 86400 / 4, recent = n >= trips / 2;
    const vBase = 45 + R() * 25, samples = [];
    for (let pk = 0; pk < lengthM; pk += 2) {
      const v = vBase * (pk > 15000 && pk < 16000 ? 0.6 : 1); // zona de velocidad reducida (no es defecto)
      let rms = 0.25 * (v / 50);
      if (pk >= 12350 && pk < 12450) rms *= recent ? 2.6 : 1.2;
      let az = gauss(R) * rms * gain;
      if (pk >= 7800 && pk < 7804 && R() < 0.75) az += (R() < 0.5 ? -1 : 1) * (2.5 + R()) * gain;
      samples.push({ pk, v, az });
    }
    out.push({ tripId: `viaje-${n}`, deviceId, t, samples });
  }
  return out;
}

/** Perfil ilustrativo de una línea con una transición tipo Angrois (200 → 80 km/h sin supervisión continua). */
export const DEMO_SPEED_PROFILE = Object.freeze([
  { pk: 0, vmaxKmh: 220, supervised: true, name: 'Salida' },
  { pk: 18000, vmaxKmh: 160, supervised: true, name: 'Viaducto' },
  { pk: 31000, vmaxKmh: 200, supervised: false, name: 'Fin del tramo con supervisión continua' },
  { pk: 35200, vmaxKmh: 80, supervised: false, name: 'Curva de entrada a la estación (ilustrativa)' },
  { pk: 37000, vmaxKmh: 30, supervised: true, name: 'Andén' },
]);

export const DEMO_ASSETS = Object.freeze([
  { id: 'MURO-PK47', kind: 'MURO', pk: 47200, condition: 4, daysSinceInspection: 640, name: 'Muro de contención en trinchera (ilustrativo)' },
  { id: 'TRIN-PK52', kind: 'TRINCHERA', pk: 52100, condition: 2, daysSinceInspection: 120 },
  { id: 'TERR-PK58', kind: 'TERRAPLEN', pk: 58800, condition: 3, daysSinceInspection: 300 },
]);
export const DEMO_RAIN = Object.freeze({ 'MURO-PK47': { mm24: 85, mm72: 160, forecastMm24: 40 }, 'TRIN-PK52': { mm24: 30, mm72: 55 }, 'TERR-PK58': { mm24: 70, mm72: 110 } });

export function runRailWatchDemo() {
  const tc = syntheticTrackCircuit();
  const circuit = trackCircuitWatch(tc.samples, { occupancyThresholdV: tc.thresholdV });
  const first = circuit.events[0];
  const geometry = trackGeometryCrowd(syntheticPassengerTrips());
  return {
    circuit: { ...circuit, samples: tc.samples, stepAtS: tc.stepAtS, accidentAtS: tc.accidentAtS, thresholdV: tc.thresholdV,
      leadTimeH: first ? +((tc.accidentAtS - first.detectedAtT) / 3600).toFixed(1) : null, detectionDelayMin: first ? Math.round((first.detectedAtT - tc.stepAtS) / 60) : null },
    geometry: { alerts: geometry.alerts, segments: geometry.segments, trips: geometry.trips, devices: geometry.devices, binM: geometry.binM },
    transitions: speedTransitionAudit(DEMO_SPEED_PROFILE),
    assets: weatherAssetWatch(DEMO_ASSETS, DEMO_RAIN, { 'MURO-PK47': 2 }),
    disclaimer: 'Datos sintéticos e ilustrativos: reproducen la forma de patrones documentados, no datos reales de ningún gestor u operador.',
  };
}

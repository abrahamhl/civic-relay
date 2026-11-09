/**
 * SENDA · Riadas y maremotos: el agua que viene de donde no estás.
 *
 * Lección de la DANA de 2024 en Valencia y del Ahr en 2021: el agua que inunda un pueblo puede
 * venir de una lluvia extrema caída kilómetros aguas arriba, mientras en el pueblo apenas llueve.
 * Un umbral fijo en el propio pueblo avisa tarde; la SUBIDA aguas arriba avisa horas antes.
 *
 * Modelo (determinista, hidrología clásica, ligera para un móvil):
 *  - Lluvia → caudal: hidrograma unitario de Nash (cascada de n embalses lineales de constante k),
 *    con coeficiente de escorrentía. 1 mm sobre 1 km² = 1000 m³. Conserva el volumen.
 *  - Embalse: balance de volumen con desagüe máximo; si se llena, vierte el exceso.
 *  - Tránsito río abajo: traslación con retardo (onda cinemática simplificada).
 *  - Alarmas: umbral clásico frente a «velocidad de subida + proyección» (avisa antes).
 * Maremoto: velocidad en aguas someras c = √(g·h); el tiempo de llegada suma tramos de profundidad.
 *
 * Datos reales previstos: AEMET OpenData (clave gratuita) y SAIH de cada confederación (acceso por
 * verificar o convenio). Los escenarios de este módulo son SINTÉTICOS e ilustrativos.
 */

const G = 9.81;

/** P(n, x) regularizada para n entero: 1 − e^{−x} Σ_{k<n} x^k/k! */
function gammaP(n, x) { if (x <= 0) return 0; let term = 1, sum = 1; for (let k = 1; k < n; k++) { term *= x / k; sum += term; } return 1 - Math.exp(-x) * sum; }

/** Fracción del volumen que sale en cada paso (hidrograma unitario de Nash discretizado). */
export function nashFractions(n, kMin, dtMin, tol = 1e-5) {
  const f = []; let j = 0;
  while (true) { const a = gammaP(n, (j * dtMin) / kMin), b = gammaP(n, ((j + 1) * dtMin) / kMin); f.push(b - a); j++; if (b > 1 - tol && j > n) break; }
  return f;
}

/** Lluvia (mm por paso) → caudal (m³/s) en la salida de la cuenca. */
export function runoff(rainMm, { areaKm2, runoffCoef = 0.5, n = 3, kMin = 60, dtMin = 10, baseflow = 2 }) {
  const f = nashFractions(n, kMin, dtMin), out = new Array(rainMm.length + f.length).fill(baseflow);
  rainMm.forEach((r, i) => { const vol = r * runoffCoef * areaKm2 * 1000; if (vol) f.forEach((fj, j) => { out[i + j] += (vol * fj) / (dtMin * 60); }); });
  return out;
}

/** Embalse: desagüe hasta outletM3s; si se llena, vierte el exceso. */
export function reservoir(inflow, { capacityHm3, storageHm3, outletM3s, dtMin = 10 }) {
  let s = storageHm3 * 1e6; const cap = capacityHm3 * 1e6, dt = dtMin * 60, out = [], level = [];
  for (const q of inflow) {
    s += q * dt; let o = Math.min(outletM3s, s / dt); s -= o * dt;
    if (s > cap) { o += (s - cap) / dt; s = cap; }
    out.push(o); level.push(s / cap);
  }
  return { outflow: out, fill: level };
}

/** Traslación río abajo (retardo en pasos) y suma de afluentes. */
export const lag = (q, steps, base = q[0] ?? 0) => [...new Array(steps).fill(base), ...q];
export const addSeries = (...ss) => { const L = Math.max(...ss.map((s) => s.length)); return Array.from({ length: L }, (_, i) => ss.reduce((a, s) => a + (s[i] ?? s[s.length - 1] ?? 0), 0)); };

/**
 * Alarmas en una serie de caudal: umbral clásico y subida rápida con proyección.
 * @returns {{thresholdMin:number|null, riseMin:number|null, peakMin:number, peak:number}}
 */
export function alarms(q, { dtMin = 10, threshold, risePerHour, windowMin = 30, horizonMin = 120 }) {
  const w = Math.max(1, Math.round(windowMin / dtMin)); let thr = null, rise = null, pk = 0;
  for (let i = 0; i < q.length; i++) {
    if (q[i] > q[pk]) pk = i;
    if (thr === null && q[i] >= threshold) thr = i;
    if (rise === null && i >= w) { const rate = ((q[i] - q[i - w]) * 60) / (w * dtMin); if (rate >= risePerHour && q[i] + (rate * horizonMin) / 60 >= threshold) rise = i; }
  }
  return { thresholdMin: thr === null ? null : thr * dtMin, riseMin: rise === null ? null : rise * dtMin, peakMin: pk * dtMin, peak: q[pk] };
}

/**
 * Escenario sintético inspirado en el patrón documentado de una DANA: tormenta estacionaria sobre la
 * cabecera de una rambla; en los pueblos de abajo casi no llueve. Un afluente pasa por un embalse.
 */
export function floodScenario({ dtMin = 10, hours = 24 } = {}) {
  const N = (hours * 60) / dtMin, storm = (t0h, t1h, peakMmH) => Array.from({ length: N }, (_, i) => { const h = (i * dtMin) / 60; if (h < t0h || h > t1h) return 0; const x = (h - t0h) / (t1h - t0h); return (peakMmH * Math.sin(Math.PI * x) ** 2 * dtMin) / 60; });
  const rainHead = storm(6, 11, 80), rainTrib = storm(7, 11, 45), rainTown = storm(9, 10, 6);
  const head = runoff(rainHead, { areaKm2: 300, runoffCoef: 0.65, n: 3, kMin: 70, dtMin, baseflow: 2 });
  const tribIn = runoff(rainTrib, { areaKm2: 420, runoffCoef: 0.55, n: 3, kMin: 90, dtMin, baseflow: 5 });
  const dam = reservoir(tribIn, { capacityHm3: 22, storageHm3: 14, outletM3s: 120, dtMin });
  const gaugeUp = head; // aforo de cabecera (aguas arriba)
  const towns = [
    { id: 'A', name: 'Pueblo del cauce', lagMin: 100, threshold: 450, series: lag(head, 100 / dtMin, 2) },
    { id: 'B', name: 'Pueblo de la desembocadura', lagMin: 160, threshold: 700, series: addSeries(lag(head, 160 / dtMin, 2), lag(dam.outflow, 60 / dtMin, 5)) },
  ].map((t) => ({ ...t, ...alarms(t.series, { dtMin, threshold: t.threshold, risePerHour: 120 }), localRainMm: +rainTown.reduce((a, b) => a + b, 0).toFixed(1) }));
  const up = alarms(gaugeUp, { dtMin, threshold: 450, risePerHour: 120 });
  const result = towns.map((t) => ({ id: t.id, name: t.name, overflowMin: t.thresholdMin, warnFromUpstreamMin: up.riseMin, leadMin: t.thresholdMin != null && up.riseMin != null ? t.thresholdMin - up.riseMin : null, localThresholdLeadMin: 0, localRainMm: t.localRainMm, peak: Math.round(t.peak) }));
  return { dtMin, hours, rain: { head: rainHead, trib: rainTrib, town: rainTown }, headTotalMm: +rainHead.reduce((a, b) => a + b, 0).toFixed(0), gaugeUp, up, dam, towns, result, synthetic: true };
}

/** Velocidad del maremoto (m/s) en una profundidad h (m). */
export const tsunamiSpeed = (h) => Math.sqrt(G * Math.max(h, 1));
/** Tiempo de llegada (min) a lo largo de un perfil [{km, depthM}]. */
export const tsunamiEtaMin = (profile) => profile.reduce((s, p) => s + (p.km * 1000) / tsunamiSpeed(p.depthM), 0) / 60;

/**
 * Escenario sintético: terremoto submarino al suroeste del cabo de San Vicente (zona de la fuente
 * de 1755). Perfiles de profundidad ilustrativos; evacuación vertical si no da tiempo a alejarse.
 */
export function tsunamiScenario() {
  const coasts = [
    { id: 'faro', name: 'Costa del Algarve', profile: [{ km: 120, depthM: 3500 }, { km: 40, depthM: 800 }, { km: 15, depthM: 60 }] },
    { id: 'huelva', name: 'Costa de Huelva', profile: [{ km: 180, depthM: 3800 }, { km: 70, depthM: 900 }, { km: 40, depthM: 80 }, { km: 6, depthM: 15 }] },
    { id: 'cadiz', name: 'Bahía de Cádiz', profile: [{ km: 220, depthM: 3800 }, { km: 60, depthM: 1000 }, { km: 35, depthM: 90 }, { km: 8, depthM: 12 }] },
  ].map((c) => ({ ...c, etaMin: +tsunamiEtaMin(c.profile).toFixed(1) }));
  /** Minutos para llegar a un lugar seguro: lejos (cota) o arriba (3.ª planta o más). */
  const people = [
    { who: 'Adulto en la playa', walkMs: 1.2, toHighGroundM: 1800, toTallBuildingM: 250 },
    { who: 'Persona mayor', walkMs: 0.7, toHighGroundM: 1800, toTallBuildingM: 250 },
  ].map((p) => ({ ...p, highGroundMin: +(p.toHighGroundM / p.walkMs / 60).toFixed(1), verticalMin: +(p.toTallBuildingM / p.walkMs / 60 + 2).toFixed(1) }));
  return { coasts, people, synthetic: true };
}

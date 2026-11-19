/**
 * Escenario de referencia «dos trenes» (configuración tipo Adamuz: un tren descarrila,
 * invade la vía contigua y otro, en sentido contrario, lo embiste segundos después).
 * TODO es sintético y determinista (semilla); los algoritmos son los reales de SENDA:
 * cada teléfono genera su acelerómetro y GPS, ejecuta `detectCrash`, la persona responde
 * (o no) y el informe viaja por cobertura propia o por Bluetooth hasta alguien con señal.
 * La fusión se recalcula segundo a segundo para medir cuándo se sabe qué.
 */
import { detectCrash, crashResponsePolicy, buildIncidentReport, fuseIncidentReports, G } from './rail-incident.mjs';

/** Dato publicado usado como referencia (cronología del accidente de Adamuz; ver docs). */
export const PUBLISHED_REFERENCE = Object.freeze({
  event: 'Adamuz (Córdoba), 18-01-2026',
  secondTrainRecognisedAfterS: 45 * 60,
  source: 'Cronología publicada (Wikipedia «Accidente ferroviario de Adamuz»), basada en registros del 112; cifra a contrastar con la investigación oficial',
});

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const offset = (p, dN, dE) => ({ lat: p.lat + dN / 111320, lon: p.lon + dE / (111320 * Math.cos((p.lat * Math.PI) / 180)) });

function phoneSignals(R, { tCrash, speed, impactG, overturn, stopS }) {
  const motion = [], gps = [];
  const grav = (t) => (overturn && t > tCrash + 1 ? { ax: G, ay: 0, az: 0 } : { ax: 0, ay: 0, az: G });
  for (let t = tCrash - 70; t <= tCrash + 20; t += 0.05) {
    const g = grav(t), n = () => (R() - 0.5) * 0.6;
    let s = { t, ax: g.ax + n(), ay: g.ay + n(), az: g.az + n() };
    if (t >= tCrash && t < tCrash + 0.15) s = { ...s, ax: s.ax + impactG * G * 0.6, ay: s.ay + impactG * G * 0.8 };
    motion.push(s);
  }
  for (let t = tCrash - 70; t <= tCrash + 20; t += 1) gps.push({ t, speed: t < tCrash ? speed : Math.max(0, speed * (1 - (t - tCrash) / stopS)) });
  return { motion, gps };
}

/**
 * @param {{seed?:number, adoption?:number, coverage?:number, paxA?:number, paxB?:number, coachesA?:number, coachesB?:number}} o
 */
export function simulateTwoTrainIncident({ seed = 18, adoption = 0.25, coverage = 0.55, paxA = 300, paxB = 180, coachesA = 8, coachesB = 6, horizonS = 900 } = {}) {
  const R = rng(seed);
  const site = { lat: 37.995, lon: -4.53 }; // zona ilustrativa, no coordenadas oficiales
  const t0 = 0;
  const trains = [
    { id: 'TREN-A (ilustrativo)', heading: 45, speed: 55, pax: paxA, coaches: coachesA, tCrash: t0, origin: site, severeCoaches: new Set([coachesA - 1, coachesA]), overturned: new Set([coachesA]) },
    { id: 'TREN-B (ilustrativo)', heading: 225, speed: 58, pax: paxB, coaches: coachesB, tCrash: t0 + 20, origin: offset(site, -260, -180), severeCoaches: new Set([1, 2, 3]), overturned: new Set([1, 2]) },
  ];
  const phones = [];
  for (const tr of trains) {
    for (let p = 0; p < tr.pax; p++) {
      if (R() > adoption) continue;
      const coach = 1 + Math.floor((p / tr.pax) * tr.coaches);
      const along = (coach - 1) * 26 + R() * 24;
      const pos = offset(tr.origin, along * Math.cos((tr.heading * Math.PI) / 180), along * Math.sin((tr.heading * Math.PI) / 180));
      const severe = tr.severeCoaches.has(coach);
      const sig = phoneSignals(R, { tCrash: tr.tCrash, speed: tr.speed, impactG: severe ? 3 + R() * 7 : 1.2 + R() * 4, overturn: tr.overturned.has(coach), stopS: severe ? 2 + R() * 2 : 3 + R() * 4 });
      const det = detectCrash(sig);
      phones.push({ id: `${tr.id}-${p}`, train: tr, coach, pos, severe, det, hasCoverage: R() < coverage });
    }
  }
  const reports = [];
  for (const ph of phones) {
    const pol = crashResponsePolicy(ph.det);
    const tr = ph.train;
    let status, at;
    const pick = () => { const x = R(); return ph.severe ? (x < 0.25 ? 'TRAPPED' : x < 0.5 ? 'INJURED_SERIOUS' : x < 0.75 ? 'NEED_HELP' : 'HELPING_OTHERS') : (x < 0.6 ? 'OK' : x < 0.85 ? 'HELPING_OTHERS' : 'NEED_HELP'); };
    if (pol.prompt) {
      const responds = R() < (ph.severe ? 0.45 : 0.8);
      if (responds) { status = pick(); at = tr.tCrash + 4 + R() * Math.min(pol.countdownS - 4, 30); }
      else { status = 'NO_RESPONSE'; at = tr.tCrash + pol.countdownS; }
    } else if (R() < 0.6) { status = pick(); at = tr.tCrash + 60 + R() * 240; } // SOS manual de quien no fue detectado
    else continue;
    if (status === 'OK') continue; // «estoy bien» se guarda para familias, no carga al 112
    // Entrega: cobertura propia, o Bluetooth hasta un compañero del mismo tren con cobertura.
    const peerWithCoverage = phones.some((o) => o !== ph && o.train === tr && o.hasCoverage);
    const delay = ph.hasCoverage ? 2 + R() * 3 : peerWithCoverage ? 10 + R() * 20 : null;
    if (delay === null) continue;
    const r = buildIncidentReport({ reporterId: ph.id, detection: ph.det, status, position: { ...ph.pos, accuracyM: 15 + R() * 30, headingDeg: tr.heading + (R() - 0.5) * 10, speedBeforeMs: tr.speed }, trip: { coach: ph.coach }, nearbyInjured: ph.severe ? Math.floor(R() * 4) : 0, at });
    reports.push({ ...r, arrivesAt: at + delay });
  }
  const received = (t) => reports.filter((r) => r.arrivesAt <= t).map((r) => ({ ...r, at: r.arrivesAt }));
  let firstSiteAt = null, secondSiteAt = null;
  for (let t = 0; t <= horizonS; t++) {
    const f = fuseIncidentReports(received(t), { now: t });
    if (firstSiteAt === null && f.sites.length >= 1) firstSiteAt = t;
    if (f.sites.length >= 2) { secondSiteAt = t; break; }
  }
  const final = fuseIncidentReports(received(horizonS), { now: horizonS });
  const det = phones.reduce((m, p) => ((m[p.det.state] = (m[p.det.state] ?? 0) + 1), m), {});
  return {
    id: 'RAIL_TWO_TRAINS', params: { seed, adoption, coverage, paxA, paxB },
    phonesWithSenda: phones.length, detections: det, reportsDelivered: reports.length,
    firstSiteKnownS: firstSiteAt, secondTrainKnownS: secondSiteAt,
    reference: PUBLISHED_REFERENCE,
    improvementFactor: secondSiteAt ? Math.round(PUBLISHED_REFERENCE.secondTrainRecognisedAfterS / secondSiteAt) : null,
    final, trains: trains.map((t) => ({ id: t.id, heading: t.heading, crashAtS: t.tCrash, origin: t.origin, coaches: t.coaches })),
    phones: phones.map((p) => ({ train: p.train.id, coach: p.coach, lat: p.pos.lat, lon: p.pos.lon, state: p.det.state })),
    reports: reports.map((r) => ({ status: r.status, lat: r.lat, lon: r.lon, coach: r.coach, arrivesAt: +r.arrivesAt.toFixed(1), train: r.headingDeg < 135 ? 'A' : 'B' })),
    disclaimer: 'Simulación sintética con los algoritmos reales de SENDA. Pasajeros, posiciones, adopción y cobertura son supuestos; no reproduce datos del accidente real.',
  };
}

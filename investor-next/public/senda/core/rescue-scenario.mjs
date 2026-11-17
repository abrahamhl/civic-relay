/**
 * Escenarios deterministas para el motor de fusión (`occupancy.mjs`).
 *
 * 1) `simulateRescueTruth`: edificio colapsado con verdad del terreno conocida (quién está
 *    dentro y dónde) y sensores con ruido. Sirve para MEDIR la calibración del motor
 *    (puntuación de Brier y diagrama de fiabilidad) frente a una referencia sin evidencias.
 *    Limitación declarada: generador y motor comparten la forma del modelo; la calibración
 *    real exige pilotos de campo. Por eso hay un modo `misspecified` con parámetros reales
 *    distintos de los que asume el motor.
 * 2) `fusionInputFromBuildingSim`: traduce el escenario «edificio 14» de
 *    `building-scenario.mjs` (respuestas, teléfonos localizados) a entradas del motor.
 */
import { cellsFromBuilding, fuseOccupancy, calibrationReport, coverage } from './occupancy.mjs';
import { FLOOR_HEIGHT_M } from './building-twin.mjs';

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const gauss = (R) => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());

/** Realidad física del sensor: cualquier persona en su volumen puede dispararlo (no solo la celda central). */
function detectProb(cells, present, at, radiusM, pd, pfa) {
  let miss = 1 - pfa;
  for (const x of cells) if (present.get(x.id)) miss *= 1 - pd * coverage(at, radiusM, x);
  return 1 - miss;
}

export function demoTower({ levels = 8 } = {}) {
  return { id: 'T', levels, unitsPerFloor: 4, heightM: levels * FLOOR_HEIGHT_M, bbox: { minX: 0, maxX: 20, minY: 0, maxY: 20 },
    local: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }] };
}

/**
 * @param {object} o
 * @param {boolean} o.misspecified si true, la realidad usa parámetros distintos de los del motor
 */
export function simulateRescueTruth({ seed = 1, levels = 8, misspecified = false } = {}) {
  const R = rng(seed);
  const truthP = misspecified
    ? { pHome: 0.6, unregistered: 0.3, respond: 0.3, beaconing: 0.5, forgotPhone: 0.3, csiPd: 0.65, csiPfa: 0.1, acPd: 0.5, acPfa: 0.12, fixSigma: 4 }
    : { pHome: 0.75, unregistered: 0.2, respond: 0.4, beaconing: 0.6, forgotPhone: 0.1, csiPd: 0.8, csiPfa: 0.05, acPd: 0.6, acPfa: 0.08, fixSigma: 2.5 };
  const building = demoTower({ levels });
  const cells = cellsFromBuilding(building);
  const present = new Map(cells.map((c) => [c.id, false]));
  const persons = [], truthPos = [];
  for (const c of cells) {
    if (R() < truthP.unregistered) present.set(c.id, true);
    const n = Math.floor(R() * 3); // 0–2 residentes registrados por vivienda
    for (let k = 0; k < n; k++) {
      const id = `${c.id}-${k}`, home = R() < truthP.pHome;
      if (home) present.set(c.id, true);
      const per = { id, homeCell: c.id };
      if (R() < truthP.respond) { per.status = home ? 'TRAPPED' : 'AWAY'; if (home) per.reportedCell = c.id; }
      else {
        const phoneInside = home || R() < truthP.forgotPhone;
        if (phoneInside && R() < truthP.beaconing) {
          const s = truthP.fixSigma;
          per.phoneFix = { x: c.center.x + gauss(R) * s, y: c.center.y + gauss(R) * s, z: c.center.z + gauss(R) * 1.5, baroZ: c.center.z + gauss(R) * 1.5, errorM: 2.5 };
        }
      }
      persons.push(per); truthPos.push({ id, home });
    }
  }
  // Sensores CSI en fachada (uno por planta en lados alternos) y barrido acústico por planta.
  const cellEvidence = [];
  for (let f = 0; f < levels; f++) {
    const side = f % 2 ? 'B' : 'C', c = cells.find((x) => x.id === `${f}${side}`);
    cellEvidence.push({ family: 'BODY_RF', at: c.center, radiusM: 6, detected: R() < detectProb(cells, present, c.center, 6, truthP.csiPd, truthP.csiPfa), label: `Accesorio CSI planta ${f}` });
    for (const u of ['A', 'D']) {
      const cu = cells.find((x) => x.id === `${f}${u}`);
      cellEvidence.push({ family: 'ACOUSTIC', at: cu.center, radiusM: 5, detected: R() < detectProb(cells, present, cu.center, 5, truthP.acPd, truthP.acPfa), label: `Escucha de golpes ${cu.id}` });
    }
  }
  return { building, cells, persons, cellEvidence, truth: Object.fromEntries(present), truthPersons: truthPos };
}

/** Ejecuta N escenarios y compara el motor con la referencia «solo registro» (sin evidencias). */
export function runCalibration({ runs = 60, seed0 = 100, misspecified = false } = {}) {
  const fused = [], prior = [], badge = [], veryLikely = [];
  for (let r = 0; r < runs; r++) {
    const s = simulateRescueTruth({ seed: seed0 + r, misspecified });
    const f = fuseOccupancy(s);
    const base = fuseOccupancy({ cells: s.cells, persons: s.persons.map(({ id, homeCell }) => ({ id, homeCell })), cellEvidence: [] });
    for (const c of f.cells) { const y = s.truth[c.id] ? 1 : 0; fused.push([c.p, y]); if (c.badge98) badge.push(y); if (c.lo >= 0.9) veryLikely.push(y); }
    for (const c of base.cells) prior.push([c.p, s.truth[c.id] ? 1 : 0]);
  }
  const engine = calibrationReport(fused), baseline = calibrationReport(prior);
  const rate = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : null);
  return { runs, misspecified, engine, baseline, badge98: { n: badge.length, observedRate: rate(badge) }, lowerBoundAtLeast90: { n: veryLikely.length, observedRate: rate(veryLikely) }, brierImprovementPct: Math.round(100 * (1 - engine.brier / baseline.brier)),
    disclaimer: 'Calibración en simulación: demuestra coherencia interna del motor y robustez a parámetros erróneos, no exactitud de campo.' };
}

/** Adapta el escenario «edificio 14» (`building-scenario.mjs`) al motor de fusión, más sensores de demostración. */
export function fusionInputFromBuildingSim(sim) {
  const building = { ...sim.tower };
  const cells = cellsFromBuilding(building);
  const byId = new Map(cells.map((c) => [c.id, c]));
  const persons = sim.people.list.map((p) => {
    const homeCell = `${p.trueFloor}${p.unit}`;
    const per = { id: p.id, homeCell };
    if (p.state === 'CONFIRMED_SAFE') per.status = 'SAFE';
    else if (p.state === 'NOT_IN_BUILDING') per.status = 'AWAY';
    else if (p.state === 'TRAPPED_CONFIRMED') { per.status = 'TRAPPED'; per.reportedCell = homeCell; }
    else if (p.state === 'CONFIRMED_NEEDS_HELP') { per.status = 'NEED_HELP'; per.reportedCell = homeCell; }
    else if (p.located) {
      const c = byId.get(`${p.located.floor}${p.located.unit}`) ?? byId.get(homeCell);
      per.phoneFix = { x: c.center.x, y: c.center.y, z: c.center.z, errorM: 3 };
    }
    return per;
  });
  // Sensores de demostración en la zona dañada (plantas 1–4, fachada este): CSI y escucha de golpes.
  const cellEvidence = [];
  for (const f of [1, 2, 3, 4]) {
    const b = byId.get(`${f}B`), d = byId.get(`${f}D`);
    const any = persons.some((p) => !p.status && (p.homeCell === b.id || p.homeCell === d.id));
    cellEvidence.push({ family: 'BODY_RF', at: { x: (b.center.x + d.center.x) / 2, y: (b.center.y + d.center.y) / 2, z: b.center.z }, radiusM: 7, detected: any || f === 3, label: `Accesorio CSI fachada este P${f}` });
    cellEvidence.push({ family: 'ACOUSTIC', at: d.center, radiusM: 5, detected: f === 3, label: `Escucha de golpes ${d.id}` });
  }
  cellEvidence.push({ family: 'SEARCH', at: byId.get('5A').center, radiusM: 6, detected: false, label: 'Perro de rescate · planta 5 oeste sin marcaje' });
  // Riesgo por planta según la evaluación EMS-98 del escenario (plantas 1–4 dañadas, grado 4).
  const cellRisk = Object.fromEntries(cells.map((c) => [c.id, c.floor >= 1 && c.floor <= 4 ? 1 : 0.2]));
  return { building, cells, persons, cellEvidence, cellRisk };
}

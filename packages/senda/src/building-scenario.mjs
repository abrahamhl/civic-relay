/**
 * Escenario de referencia «edificio 14»: zona urbana con 14 edificios tras un sismo; el
 * edificio 14 es una torre de 15 plantas con 4 viviendas por planta (60 routers).
 * Sintético y determinista; procesado con los algoritmos reales de SENDA:
 *  - evaluación EMS-98 y recuento de afectados de la zona,
 *  - dos barridos tipo dron (minuto 5 y minuto 25) que localizan routers en 3D y detectan
 *    los que se apagan entre barridos,
 *  - pasarelas: routers con salida a Internet confirmada por un teléfono SENDA conectado,
 *  - alertas dirigidas por planta, orden remota firmada (baliza Bluetooth) y estado de
 *    cada persona registrada, con DESAPARECIDO (sin confirmar) en lugar de «víctima».
 */
import { prepareBuilding, damageSummary, locateAccessPoints, personState, targetAudience, floorBoard, FLOOR_HEIGHT_M, unitOf } from './building-twin.mjs';
import { locateBeacon } from './rubble.mjs';

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const gauss = (R) => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
export const ZONE_ORIGIN = Object.freeze({ lat: 37.6775, lon: -1.7005 }); // zona ilustrativa
const fromLocal = (x, y) => ({ lat: ZONE_ORIGIN.lat + y / 111320, lon: ZONE_ORIGIN.lon + x / (111320 * Math.cos((ZONE_ORIGIN.lat * Math.PI) / 180)) });
const rect = (cx, cy, w, h) => [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => fromLocal(cx + (a * w) / 2, cy + (b * h) / 2));

export function demoZoneBuildings(R = rng(3)) {
  const bs = [];
  let n = 0;
  for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 4; gy++) {
    if (n >= 13) break;
    n++;
    const levels = 2 + Math.floor(R() * 5);
    bs.push({ id: `B${n}`, name: `Edificio ${n}`, source: 'Demostración (sin red)', levels, footprint: rect(-90 + gx * 45, -90 + gy * 45, 22 + R() * 10, 18 + R() * 10), unitsPerFloor: 2 + Math.floor(R() * 3) });
  }
  bs.push({ id: 'B14', name: 'Edificio 14 (torre)', source: 'Demostración (sin red)', levels: 15, footprint: rect(90, 40, 22, 22), unitsPerFloor: 4 });
  return bs;
}

export function simulateBuildingIncident({ seed = 14, appAdoption = 0.55, consentRemote = 0.7 } = {}) {
  const R = rng(seed);
  const buildings = demoZoneBuildings(rng(3)).map((b) => prepareBuilding(b, ZONE_ORIGIN));
  const tower = buildings.find((b) => b.id === 'B14');
  // Evaluación visual EMS-98 (inspectores / ciudadanos con foto).
  const assessments = buildings.map((b, i) => ({ buildingId: b.id, grade: b.id === 'B14' ? 4 : [1, 1, 2, 0, 3, 1, 2, 0, 1, 3, 2, 1, 0][i] ?? 1, floors: b.id === 'B14' ? [1, 2, 3, 4] : [], at: 240 + i * 20, by: b.id === 'B14' ? 'Bomberos · Parque 3' : 'Voluntario verificado', photo: b.id === 'B14' ? 'foto-fachada-este.jpg' : null }));
  const zone = damageSummary(buildings, assessments);

  // Routers reales (verdad del terreno) de la torre: 1 por vivienda.
  const { minX, maxX, minY, maxY } = tower.bbox, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const truth = [];
  for (let f = 0; f < tower.levels; f++) for (const [u, sx, sy] of [['A', -1, 1], ['B', 1, 1], ['C', -1, -1], ['D', 1, -1]]) {
    const p = { x: cx + sx * (2 + R() * 7), y: cy + sy * (2 + R() * 7), z: f * FLOOR_HEIGHT_M + 1 + R() * 1.2 };
    const damaged = f >= 1 && f <= 4 && (u === 'B' || u === 'D');
    truth.push({ bssid: `aa:bb:cc:${f.toString(16).padStart(2, '0')}:0${u.charCodeAt(0) - 65}:01`, ssid: `MOVISTAR_${f}${u}`, floor: f, unit: u, ...p, poweredAt5: !(damaged && f <= 2), poweredAt25: !damaged, fiberUp: R() < 0.35 });
  }
  // Barrido de dron: órbitas alrededor de la torre cada 4,5 m de altura.
  const survey = (t, poweredKey) => {
    const scans = [];
    for (let h = 1.5; h <= tower.heightM + 3; h += 4.5) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 2 * Math.PI, rad = 20;
      const pt = { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a), z: h };
      for (const ap of truth) {
        if (!ap[poweredKey]) continue;
        const d = Math.hypot(ap.x - pt.x, ap.y - pt.y, ap.z - pt.z);
        const rssi = -38 - 30 * Math.log10(Math.max(1, d)) + gauss(R) * 3;
        if (rssi > -92) scans.push({ ...pt, bssid: ap.bssid, ssid: ap.ssid, rssi, t: t + k });
      }
    }
    return scans;
  };
  const scans5 = survey(300, 'poweredAt5'), scans25 = survey(1500, 'poweredAt25');
  // Teléfonos SENDA de residentes conectados a su router informan si hay Internet.
  const connected = truth.filter((ap) => ap.poweredAt25 && R() < 0.4).map((ap) => ({ bssid: ap.bssid, internet: ap.fiberUp, t: 1490 }));
  const aps = locateAccessPoints([...scans5, ...scans25], tower, { now: 1520, staleS: 300, connected });
  const truthBy = new Map(truth.map((t) => [t.bssid, t]));
  const located = aps.filter((a) => a.position);
  const floorErr = located.map((a) => Math.abs(a.floor - truthBy.get(a.bssid).floor));
  const unitOk = located.filter((a) => a.unit === truthBy.get(a.bssid).unit).length;

  // Registro voluntario de residentes con SENDA, alertas por planta y respuestas.
  const registry = [];
  for (const ap of truth) for (let p = 0; p < 2; p++) if (R() < appAdoption) registry.push({ id: `${ap.floor}${ap.unit}-${p}`, buildingId: 'B14', floor: ap.floor, unit: ap.unit, damaged: !ap.poweredAt25, home: R() < 0.8 });
  const audience = targetAudience(registry, { buildingId: 'B14', floors: [0, 1, 2, 3, 4, 5, 6] });
  const alertTimes = [600, 900];
  const people = registry.map((r) => {
    const targeted = audience.includes(r);
    const responses = [];
    if (targeted) {
      if (!r.home) responses.push({ status: 'AWAY', at: 650 + R() * 200 });
      else if (r.damaged) { const x = R(); if (x < 0.25) responses.push({ status: 'TRAPPED', at: 620 + R() * 400 }); else if (x < 0.45) responses.push({ status: 'NEED_HELP', at: 620 + R() * 400 }); }
      else if (R() < 0.85) responses.push({ status: 'SAFE', at: 610 + R() * 300 });
    }
    // Orden remota BLE_BEACON aceptada por quien lo preautorizó: su teléfono se localiza.
    let phoneSignal = null;
    if (targeted && !responses.length && r.home && R() < consentRemote) {
      const t = truth.find((ap) => ap.floor === r.floor && ap.unit === r.unit);
      const reads = [];
      for (let h = 1.5; h <= tower.heightM + 3; h += 4.5) for (let k = 0; k < 8; k++) { const a = (k / 8) * 2 * Math.PI; const pt = { x: cx + 18 * Math.cos(a), y: cy + 18 * Math.sin(a), z: h }; const d = Math.hypot(t.x - pt.x, t.y - pt.y, t.z - pt.z); reads.push({ ...pt, z: -pt.z, rssi: -59 - 28 * Math.log10(Math.max(1, d)) + gauss(R) * 3 }); }
      const e = locateBeacon(reads, { txPower1m: -59, n: 2.8 });
      phoneSignal = { t: 1450, floor: Math.max(0, Math.min(tower.levels - 1, Math.floor(-e.z / FLOOR_HEIGHT_M))), unit: unitOf(tower, e) };
    }
    const st = personState({ responses, alertsSent: targeted ? alertTimes.map((at) => ({ at })) : [], phoneSignal }, { now: 1520 });
    return { ...r, ...st, trueFloor: r.floor, floor: phoneSignal?.floor ?? r.floor, located: phoneSignal };
  });
  const counts = people.reduce((m, p) => ((m[p.state] = (m[p.state] ?? 0) + 1), m), {});
  const locatedPeople = people.filter((p) => p.located);
  return {
    id: 'BUILDING_14', zone, tower: { id: tower.id, levels: tower.levels, unitsPerFloor: tower.unitsPerFloor, heightM: tower.heightM, local: tower.local, bbox: tower.bbox },
    buildings: buildings.map((b) => ({ id: b.id, name: b.name, levels: b.levels, local: b.local, grade: zone.rows.find((r) => r.id === b.id).grade })),
    routers: { truth: truth.length, detected: aps.length, located: located.length, active: aps.filter((a) => a.state === 'ACTIVE').length, lostBetweenSurveys: aps.filter((a) => a.state === 'LOST').length, gateways: aps.filter((a) => a.gateway).length,
      floorExactPct: Math.round((100 * floorErr.filter((e) => e === 0).length) / floorErr.length), floorWithin1Pct: Math.round((100 * floorErr.filter((e) => e <= 1).length) / floorErr.length), unitPct: Math.round((100 * unitOk) / located.length) },
    aps: aps.map((a) => ({ ...a, trueFloor: truthBy.get(a.bssid).floor, trueUnit: truthBy.get(a.bssid).unit })),
    people: { registered: registry.length, targeted: audience.length, counts, missing: counts.MISSING_UNCONFIRMED ?? 0, locatedNoResponse: counts.SIGNAL_NO_RESPONSE ?? 0,
      locatedFloorExactPct: locatedPeople.length ? Math.round((100 * locatedPeople.filter((p) => p.floor === p.trueFloor).length) / locatedPeople.length) : null,
      locatedFloorWithin1Pct: locatedPeople.length ? Math.round((100 * locatedPeople.filter((p) => Math.abs(p.floor - p.trueFloor) <= 1).length) / locatedPeople.length) : null, list: people },
    board: floorBoard(tower, aps, people),
    disclaimer: 'Simulación sintética (zona, edificios, routers, residentes y señales) procesada con los algoritmos reales de SENDA. Requiere calibración de campo.',
  };
}

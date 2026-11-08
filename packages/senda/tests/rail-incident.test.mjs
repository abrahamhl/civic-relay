import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCrash, crashResponsePolicy, buildIncidentReport, fuseIncidentReports, emergencyBrief, G } from '../src/rail-incident.mjs';
import { simulateTwoTrainIncident } from '../src/rail-scenario.mjs';

/* Señales sintéticas: 70 s antes y 20 s después del instante 0. */
function signal({ speed = 55, impactG = 0, overturn = false, stopS = null, keepSpeed = false, brakeS = null } = {}) {
  let s = 3; const n = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5) * 0.6;
  const motion = [], gps = [];
  for (let t = -70; t <= 20; t += 0.05) {
    const g = overturn && t > 1 ? { ax: G, ay: 0, az: 0 } : { ax: 0, ay: 0, az: G };
    const m = { t, ax: g.ax + n(), ay: g.ay + n(), az: g.az + n() };
    if (impactG && t >= 0 && t < 0.15) { m.ax += impactG * G * 0.6; m.ay += impactG * G * 0.8; }
    motion.push(m);
  }
  for (let t = -70; t <= 20; t += 1) {
    let v = speed;
    if (stopS && t >= 0) v = Math.max(0, speed * (1 - t / stopS));
    if (brakeS && t >= -brakeS) v = Math.max(0, speed * (-t / brakeS));
    if (keepSpeed) v = speed;
    gps.push({ t, speed: v });
  }
  return { motion, gps };
}

test('descarrilamiento con vuelco a 200 km/h → CRASH_LIKELY', () => {
  const d = detectCrash(signal({ impactG: 6, overturn: true, stopS: 3 }));
  assert.equal(d.state, 'CRASH_LIKELY');
  assert.ok(d.tiltDeg > 45 && d.decelMs2 >= 4);
});

test('impacto y parada brusca sin vuelco → al menos CRASH_SUSPECTED', () => {
  assert.match(detectCrash(signal({ impactG: 4, stopS: 4 })).state, /CRASH_/); // ≈3,1 g netos
});

test('falsos positivos: caída del móvil, frenada de emergencia y bache a velocidad NO son accidente', () => {
  assert.equal(detectCrash(signal({ speed: 0, impactG: 8 })).state, 'PHONE_DROP');
  assert.equal(detectCrash(signal({ brakeS: 45 })).state, 'HARD_BRAKING');
  assert.equal(detectCrash(signal({ impactG: 4, keepSpeed: true })).state, 'NONE');
  assert.equal(crashResponsePolicy({ state: 'PHONE_DROP' }).prompt, false);
});

test('cuenta atrás: más corta si el accidente es probable; sin respuesta se informa solo', () => {
  const p = crashResponsePolicy({ state: 'CRASH_LIKELY' });
  assert.equal(p.countdownS, 20); assert.equal(p.onTimeout, 'NO_RESPONSE');
  assert.equal(crashResponsePolicy({ state: 'CRASH_SUSPECTED' }).countdownS, 30);
  assert.throws(() => buildIncidentReport({ reporterId: 'x', status: 'MUERTO', position: { lat: 0, lon: 0 }, at: 0 }));
});

test('fusión: dos trenes en el mismo punto y sentidos opuestos se separan; uno largo no se parte', () => {
  const mk = (id, lat, lon, heading, status, coach, at) => buildIncidentReport({ reporterId: id, status, position: { lat, lon, headingDeg: heading }, trip: { coach }, at });
  const reports = [
    mk('a1', 38, -4.5, 45, 'TRAPPED', 8, 10), mk('a2', 38.0010, -4.4990, 47, 'NO_RESPONSE', 8, 20), mk('a3', 38.002, -4.498, 44, 'NEED_HELP', 2, 15),
    mk('b1', 38.0003, -4.5003, 226, 'INJURED_SERIOUS', 1, 30), mk('b2', 37.9998, -4.5006, 224, 'NO_RESPONSE', 1, 40),
  ];
  const f = fuseIncidentReports(reports);
  assert.equal(f.sites.length, 2);
  assert.equal(f.secondSiteDetectedAt, 40);
  assert.ok(f.alerts.some((a) => a.level === 'CRITICAL'));
  const a = f.sites.find((s) => s.headingDeg < 100);
  assert.equal(a.coachesByPriority[0].coach, '8');
  assert.match(emergencyBrief(f), /SITIO 1.*atrapados/);
});

test('el último estado de cada persona manda (rectificación «ya estoy bien»)', () => {
  const p = { lat: 38, lon: -4.5, headingDeg: 45 };
  const f = fuseIncidentReports([
    buildIncidentReport({ reporterId: 'x', status: 'NO_RESPONSE', position: p, at: 20 }),
    buildIncidentReport({ reporterId: 'x', status: 'HELPING_OTHERS', position: p, at: 60 }),
    buildIncidentReport({ reporterId: 'y', status: 'NEED_HELP', position: p, at: 25 }),
  ]);
  assert.equal(f.sites[0].counts.NO_RESPONSE, 0);
  assert.equal(f.sites[0].counts.HELPING_OTHERS, 1);
});

test('escenario dos trenes: el segundo tren se conoce en segundos, con poca adopción y en todas las semillas', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = simulateTwoTrainIncident({ seed });
    assert.equal(r.final.sites.length, 2, `semilla ${seed}`);
    assert.ok(r.secondTrainKnownS < 90, `semilla ${seed}: ${r.secondTrainKnownS}s`);
  }
  const low = simulateTwoTrainIncident({ adoption: 0.05 });
  assert.ok(low.secondTrainKnownS !== null && low.secondTrainKnownS < 120, `adopción 5%: ${low.secondTrainKnownS}`);
});

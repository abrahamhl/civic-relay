import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceM, levelFromTaps, riseRate, clusterReports, assessIncident, reconZone, triageQueue, citizenAdvice } from '../src/hazard-reports.mjs';
import { rng } from '../src/incident-ops.mjs';

const T0 = 1_800_000_000_000, BRIDGE = { lat: 39.4269, lon: -0.4174 }; // coordenadas de ejemplo (Paiporta)
const off = (m, dLat = 0, dLon = 0) => ({ lat: BRIDGE.lat + dLat * m / 111_320, lon: BRIDGE.lon + dLon * m / (111_320 * Math.cos(BRIDGE.lat * Math.PI / 180)) });

test('nivel por toques: interpolación entre dos marcas del pilar', () => {
  const lvl = levelFromTaps({ refTop: { row: 100, heightM: 3 }, refBottom: { row: 500, heightM: 1 }, waterRow: 300 });
  assert.equal(lvl, 2);
  assert.throws(() => levelFromTaps({ refTop: { row: 500, heightM: 3 }, refBottom: { row: 100, heightM: 1 }, waterRow: 300 }));
});

test('velocidad de subida: recupera 1,2 cm/min con ruido de ±1 cm en las lecturas', () => {
  const R = rng(4), s = Array.from({ length: 8 }, (_, i) => ({ at: T0 + i * 5 * 60_000, levelM: 1 + (1.2 * i * 5 + (R() * 2 - 1)) / 100 }));
  const r = riseRate(s);
  assert.ok(Math.abs(r.cmPerMin - 1.2) < 0.1, String(r.cmPerMin));
  assert.ok(r.stdErr < 0.1);
});

test('40 reportes del mismo río en 30 min → 1 incidente; un fuego a 5 km es otro', () => {
  const R = rng(7), reps = [];
  for (let i = 0; i < 40; i++) reps.push({ kind: i % 3 ? 'RIVER_RISING' : 'STREET_FLOODED', ...off(150 * R(), R() - 0.5, R() - 0.5), at: T0 + R() * 30 * 60_000, deviceId: `d${i % 25}` });
  reps.push({ kind: 'FIRE', ...off(5000, 1, 0), at: T0 + 600_000, deviceId: 'x1' });
  const cl = clusterReports(reps);
  assert.equal(cl.length, 2);
  assert.equal(cl.find((c) => c.family === 'WATER').reports.length, 40);
});

test('escalado: rumor con 1 persona; corroborado con varias; reconocimiento con medida; oficial solo con organismo', () => {
  const mk = (n, extra = {}) => clusterReports(Array.from({ length: n }, (_, i) => ({ kind: 'STREET_FLOODED', ...off(50), at: T0 + i * 60_000, deviceId: `p${i}`, ...extra })))[0];
  const one = assessIncident(mk(1));
  assert.equal(one.state, 'RUMOR'); assert.equal(one.canPublicWarn, false);
  const many = assessIncident(mk(4, { measurement: { rise: { cmPerMin: 1.1, stdErr: 0.1 } } }));
  assert.equal(many.state, 'RECON'); assert.equal(many.canPublicWarn, false, 'sin organismo no hay aviso público');
  const offc = assessIncident(mk(2), { official: [{ family: 'WATER', source: 'SAIH Júcar', ...off(800), at: T0 }] });
  assert.equal(offc.state, 'OFFICIAL'); assert.equal(offc.canPublicWarn, true);
});

test('el mismo móvil repitiendo 20 veces no vale como 20 personas; un aforo oficial que no sube resta', () => {
  const spam = clusterReports(Array.from({ length: 20 }, (_, i) => ({ kind: 'STREET_FLOODED', ...off(10), at: T0 + i * 1000, deviceId: 'mismo' })))[0];
  const a = assessIncident(spam);
  assert.equal(a.reporters, 1); assert.equal(a.state, 'RUMOR');
  const four = clusterReports(Array.from({ length: 4 }, (_, i) => ({ kind: 'RIVER_RISING', ...off(10), at: T0, deviceId: `q${i}` })))[0];
  const contra = assessIncident(four, { sensors: [{ id: 'SAIH-07', family: 'WATER', official: true, agrees: false, ...off(500) }] });
  assert.ok(contra.pReal < assessIncident(four).pReal);
  const bad = assessIncident(four, { reputation: { q0: { good: 0, bad: 9 }, q1: { good: 0, bad: 9 }, q2: { good: 0, bad: 9 }, q3: { good: 0, bad: 9 } } });
  assert.ok(bad.pReal < assessIncident(four).pReal, 'reputación aprendida de falsas alarmas pesa menos');
});

test('reconocimiento previo: cámaras, sensores y móviles con consentimiento dentro del radio', () => {
  const inc = { id: 'INC-1', family: 'WATER' };
  const z = reconZone(inc, BRIDGE, { cameras: [{ id: 'C1', source: 'DGT', ...off(800, 1, 0) }, { id: 'C2', source: 'DGT', ...off(9000, 1, 0) }], sensors: [{ id: 'S1', family: 'WATER', ...off(300, 0, 1) }], phones: [{ id: 'P1', consent: true, ...off(100, 1, 0) }, { id: 'P2', consent: false, ...off(100, 1, 0) }] });
  assert.deepEqual(z.cameras.map((c) => c.id), ['C1']);
  assert.deepEqual(z.phones.map((p) => p.id), ['P1']);
  assert.equal(z.sensors.length, 1);
});

test('cola del 112: una persona atrapada pasa delante de 40 reportes de una calle inundada; y se avisa siempre de llamar si hay vida en riesgo', () => {
  const water = Array.from({ length: 40 }, (_, i) => ({ kind: 'STREET_FLOODED', ...off(20), at: T0 + i * 10_000, deviceId: `w${i}` }));
  const trapped = [{ kind: 'PERSON_TRAPPED', ...off(3000, 1, 1), at: T0, deviceId: 't1', people: { trapped: 2 } }];
  const cl = clusterReports([...water, ...trapped]), as = cl.map((c) => assessIncident(c));
  const q = triageQueue(as, cl);
  assert.equal(q.queue[0].family, 'STRUCTURE');
  assert.equal(q.totalReports, 41); assert.equal(q.incidents, 2); assert.equal(q.deduplicated, 39);
  assert.equal(citizenAdvice('PERSON_TRAPPED', as[0]).call112, true);
  assert.equal(citizenAdvice('CAR_SWEPT', { state: 'OFFICIAL', official: { source: 'x' } }).call112, true, 'aunque ya sea oficial');
});

test('distancia: 1° de latitud ≈ 111,2 km', () => {
  assert.ok(Math.abs(distanceM({ lat: 40, lon: -3 }, { lat: 41, lon: -3 }) - 111_195) < 5);
});

test('reporte firmado: cabe en una línea de SMS, se verifica y no se puede falsificar ni atribuir a otro móvil', async () => {
  const { createReporterKeys, encodeReport, decodeReports } = await import('../src/hazard-reports.mjs');
  const k1 = await createReporterKeys(), k2 = await createReporterKeys();
  const r = { kind: 'RIVER_RISING', lat: 39.42691, lon: -0.41742, at: Date.UTC(2026, 10, 13, 0, 40), people: { trapped: 0, injured: 1 }, measurement: { rise: { cmPerMin: 2.5, stdErr: 0.12 } } };
  const line = await encodeReport(r, k1);
  assert.equal(line.length, 160, `${line.length} caracteres`);
  const { reports, rejected } = await decodeReports(`Reenviado:\n${line}\n${await encodeReport({ ...r, kind: 'SMOKE' }, k2)}`);
  assert.equal(rejected.length, 0); assert.equal(reports.length, 2);
  assert.deepEqual({ ...reports[0], deviceId: undefined, signed: undefined }, { ...r, deviceId: undefined, signed: undefined });
  assert.notEqual(reports[0].deviceId, reports[1].deviceId);
  // alterar la posición rompe la firma
  const u = line.slice(5), bad = 'SND3 ' + u.slice(0, 6) + (u[6] === 'A' ? 'B' : 'A') + u.slice(7);
  assert.equal((await decodeReports(bad)).rejected[0], 'firma');
  // el mismo móvil reenviando 5 veces sigue contando como una persona
  const many = (await decodeReports(Array(5).fill(line).join('\n'))).reports;
  assert.equal(new Set(many.map((x) => x.deviceId)).size, 1);
});

test('CAP 1.2 para la sala: restringido, nunca público; certeza según estado; parámetros del cuadro', async () => {
  const { incidentToCap } = await import('../src/hazard-reports.mjs');
  const reps = Array.from({ length: 4 }, (_, i) => ({ kind: 'STREET_FLOODED', ...off(30, 1, 0), at: T0 + i * 60_000, deviceId: `c${i}`, ...(i === 2 ? { measurement: { rise: { cmPerMin: 1.3, stdErr: 0.1 } } } : {}) }));
  reps.push({ kind: 'PERSON_TRAPPED', ...off(3000, 0, 1), at: T0, deviceId: 'z', people: { trapped: 1 } });
  const cl = clusterReports(reps), q = triageQueue(cl.map((c) => assessIncident(c)), cl);
  const water = q.queue.find((a) => a.family === 'WATER'), c = cl.find((x) => x.id === water.id);
  const cap = incidentToCap(water, c, { now: T0 + 600_000 });
  assert.match(cap, /<scope>Restricted<\/scope>/); assert.doesNotMatch(cap, /<scope>Public/);
  assert.match(cap, /<status>Exercise<\/status>/);
  assert.match(cap, /<certainty>Likely<\/certainty>/);
  assert.match(cap, /<valueName>SENDA_RISE_CM_MIN_MAX<\/valueName><value>1.30<\/value>/);
  assert.match(cap, /SENDA no ha avisado a la población/);
  const tr = q.queue.find((a) => a.family === 'STRUCTURE'), ct = cl.find((x) => x.id === tr.id);
  const capT = incidentToCap(tr, ct, { now: T0 });
  assert.match(capT, /<severity>Extreme<\/severity>/); assert.match(capT, /<certainty>Possible<\/certainty>/);
  assert.match(capT, /<valueName>SENDA_TRAPPED<\/valueName><value>1<\/value>/);
});

// Capa centralizadora: k-de-n entre portadores, probabilidad exacta, límites legales,
// previsión de apagón, drones, CAP y auditoría.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeShards, decodeShards, gfMul, gfInv, createReassembler, packShard } from '../src/erasure.mjs';
import { BEARERS, deliveryProbability, planMultiBearer, shardForPlan, fromBearerFrame, splitShards, toBearerFrame } from '../src/bearers.mjs';
import { SATELLITE_NETWORKS } from '../src/satellites.mjs';
import { survival, BACKUP, forecastBlackout, placeGateways, syntheticCity, parseOpenCellId, calibrateBatteryMedian, cellCoverage } from '../src/blackout.mjs';
import { encodeLocation, decodeOdid, facadeMission, muleSortie } from '../src/drone.mjs';
import { toCap, railIncidentToCap, createAuditLog, verifyAuditLog } from '../src/interop.mjs';
import { parseCap } from '../src/feeds.mjs';
import { simulateTwoTrainIncident } from '../src/rail-scenario.mjs';

const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); };

test('GF(256): a·a⁻¹ = 1 para todo a ≠ 0', () => { for (let a = 1; a < 256; a++) assert.equal(gfMul(a, gfInv(a)), 1); });

test('Reed-Solomon k-de-n: CUALQUIER combinación de k fragmentos reconstruye el mensaje', () => {
  const r = rnd(3); const data = Uint8Array.from({ length: 777 }, () => Math.floor(r() * 256));
  const k = 5, n = 9, enc = encodeShards(data, k, n);
  // todas las combinaciones de 5 entre 9 (126)
  let combos = 0;
  const rec = (start, pick) => {
    if (pick.length === k) { combos++; assert.deepEqual(decodeShards(pick.map((i) => ({ index: i, data: enc.shards[i] })), enc), data); return; }
    for (let i = start; i < n; i++) rec(i + 1, [...pick, i]);
  };
  rec(0, []);
  assert.equal(combos, 126);
  assert.throws(() => decodeShards([0, 1, 2, 3].map((i) => ({ index: i, data: enc.shards[i] })), enc), /faltan/);
});

test('probabilidad exacta: 3 portadores al 80 % con k=2 → 0,896 (mejor que cualquiera solo)', () => {
  const p = deliveryProbability([{ p: 0.8, shards: 1 }, { p: 0.8, shards: 1 }, { p: 0.8, shards: 1 }], 2);
  assert.ok(Math.abs(p - 0.896) < 1e-12);
  // agrupación: si un portador lleva 2 fragmentos, su fallo arrastra a ambos
  assert.ok(Math.abs(deliveryProbability([{ p: 0.8, shards: 2 }, { p: 0.8, shards: 1 }], 2) - 0.8) < 1e-12);
});

test('plan multiportador: un SOS de 380 B alcanza 99 % repartido entre satélite, LoRa, SMS y vecinos', () => {
  const plan = planMultiBearer(380, [{ id: 'SAT_D2C_SMS' }, { id: 'MESHTASTIC' }, { id: 'SMS' }, { id: 'PHONE_MESH' }], { target: 0.99 });
  assert.ok(plan.feasible, JSON.stringify(plan));
  assert.ok(plan.pDelivery >= 0.99 && plan.n >= plan.k);
  assert.ok(plan.gainOverSingle > 0, 'el reparto supera al mejor portador individual');
  assert.ok(new Set(plan.messages.map((m) => m.id)).size >= 2, 'usa varios portadores');
});

test('ley: las bandas de radioaficionado NUNCA llevan contenido cifrado; sí estados públicos firmados', () => {
  const priv = planMultiBearer(100, [{ id: 'APRS' }, { id: 'QO100' }], { target: 0.9 });
  assert.equal(priv.feasible, false); assert.equal(priv.excluded.length, 2);
  const pub = planMultiBearer(100, [{ id: 'APRS' }, { id: 'QO100' }], { target: 0.9, publicCleartext: true });
  assert.ok(pub.messages.every((m) => !BEARERS[m.id].encryptionAllowed));
});

test('extremo a extremo: fragmentos viajan por SMS (texto), LoRa (binario) y satélite y el reensamblador recupera el mensaje aunque se pierdan portadores', () => {
  const r = rnd(9); const msg = Uint8Array.from({ length: 300 }, () => Math.floor(r() * 256));
  const plan = planMultiBearer(msg.length, [{ id: 'SAT_D2C_SMS' }, { id: 'MESHTASTIC' }, { id: 'SMS' }, { id: 'IRIDIUM_SBD' }], { target: 0.999 });
  const frames = shardForPlan(msg, plan);
  assert.ok(frames.some((f) => typeof f.frame === 'string' && f.frame.length <= 160), 'SMS en texto ≤160');
  // se pierde el primer portador entero
  const lostBearer = frames[0].bearer;
  const ra = createReassembler(); let out = null;
  for (const f of frames.filter((x) => x.bearer !== lostBearer)) for (const s of splitShards(fromBearerFrame(f.frame))) out = ra.add(s, f.bearer) ?? out;
  assert.ok(out, `no se reconstruyó sin ${lostBearer}; plan ${JSON.stringify(plan.messages)}`);
  assert.deepEqual(out.data, msg);
  assert.throws(() => toBearerFrame('APRS', new Uint8Array(60)), /MTU/);
  assert.ok(createReassembler().add(packShard({ id: new Uint8Array(8), k: 2, n: 3, len: 10, index: 0, data: new Uint8Array(5) })) === null);
});

test('catálogo satelital: cada red tiene fuente, estado y hardware; nada «en desarrollo» figura como operativo', () => {
  for (const n of SATELLITE_NETWORKS) { assert.ok(n.sources.length && n.status && n.hardware, n.id); }
  assert.equal(SATELLITE_NETWORKS.find((n) => n.id === 'GALILEO_EWSS').status, 'UNDER_DEVELOPMENT');
  assert.match(SATELLITE_NETWORKS.find((n) => n.id === 'QO100').legal, /prohibido cifrar/);
});

test('apagón: la supervivencia de baterías es monótona y la mediana es la indicada', () => {
  assert.ok(Math.abs(survival(BACKUP.BATTERY.medianH, BACKUP.BATTERY) - 0.5) < 1e-9);
  let prev = 1; for (let h = 0; h <= 24; h += 0.5) { const s = survival(h, BACKUP.BATTERY); assert.ok(s <= prev + 1e-12); prev = s; }
});

test('apagón: previsión de ciudad, calibración con el dato público del 28-04-2025 y pasarelas voraces', () => {
  const city = syntheticCity();
  const f = forecastBlackout(city);
  assert.ok(f.timeline[0].coveredPct > 95 && f.timeline.at(-1).coveredPct < f.timeline[0].coveredPct);
  assert.ok(f.halfDarkAtH !== null && f.halfDarkAtH <= 6, `mitad a oscuras a las ${f.halfDarkAtH} h`);
  const med = calibrateBatteryMedian({ ...city, observation: { h: 2.45, relativeConnected: 40 / 90 } });
  assert.ok(med > 0.5 && med < 6, `mediana calibrada ${med} h`);
  const g = placeGateways({ ...city, k: 4, tH: 4 });
  assert.equal(g.picks.length, 4);
  for (let i = 1; i < g.picks.length; i++) assert.ok(g.picks[i].peopleReached <= g.picks[i - 1].peopleReached, 'ganancias marginales decrecientes (submodular)');
  assert.ok(g.reachedPct > 20, `pasarelas alcanzan ${g.reachedPct} % de la población a oscuras`);
  // aumentar k nunca empeora
  assert.ok(placeGateways({ ...city, k: 6, tH: 4 }).reachedPct >= g.reachedPct);
});

test('OpenCelliD: se leen antenas reales en formato CSV', () => {
  const t = parseOpenCellId('radio,mcc,net,area,cell,unit,lon,lat,range,samples,changeable,created,updated,averageSignal\nLTE,214,1,2801,1234567,0,-0.3763,39.4699,1500,12,1,1500000000,1700000000,0');
  assert.equal(t.length, 1); assert.equal(t[0].mcc, 214); assert.ok(cellCoverage({ lat: 39.47, lon: -0.3763 }, [{ ...t[0], backup: 'GENERATOR' }], 1) > 0.9);
});

test('Open Drone ID: ubicación de 25 bytes ida y vuelta (posición, altura, rumbo, velocidad)', () => {
  const b = encodeLocation({ lat: 39.4699123, lon: -0.3763456, altGeoM: 120.5, heightM: 35, directionDeg: 270, speedMs: 12.25, vSpeedMs: -1.5, tenthsSinceHour: 12345 });
  assert.equal(b.length, 25); assert.equal(b[0] >> 4, 1);
  const d = decodeOdid(b);
  assert.equal(d.type, 'LOCATION'); assert.equal(d.status, 'AIRBORNE');
  assert.ok(Math.abs(d.lat - 39.4699123) < 1e-7 && Math.abs(d.lon + 0.3763456) < 1e-7);
  assert.equal(d.altGeoM, 120.5); assert.equal(d.heightM, 35); assert.equal(d.directionDeg, 270); assert.equal(d.speedMs, 12.25); assert.equal(d.vSpeedMs, -1.5);
  const basic = new Uint8Array(25); basic[0] = 0x02; basic[1] = (1 << 4) | 2; basic.set(new TextEncoder().encode('SENDA-DRON-0001'), 2);
  assert.deepEqual(decodeOdid(basic), { type: 'BASIC_ID', idType: 'SERIAL_NUMBER', uaType: 'HELICOPTER_OR_MULTIROTOR', uasId: 'SENDA-DRON-0001' });
});

test('dron: misión de fachada planta a planta en formato QGroundControl y salida de mula', () => {
  const m = facadeMission({ center: { lat: 39.47, lon: -0.38 }, widthM: 20, depthM: 16, levels: 15 });
  assert.equal(m.waypoints, 15 * 12); assert.equal(m.plan.fileType, 'Plan');
  const alts = [...new Set(m.plan.mission.items.map((i) => i.Altitude))]; assert.equal(alts.length, 15);
  assert.ok(m.plan.mission.items.every((i) => i.command === 16 && i.params.length === 7));
  const s = muleSortie({ from: { lat: 39.47, lon: -0.38 }, to: { lat: 39.48, lon: -0.36 } });
  assert.ok(s.feasible && s.distanceM > 1500 && s.distanceM < 2500);
  assert.equal(muleSortie({ from: { lat: 39.47, lon: -0.38 }, to: { lat: 39.7, lon: -0.1 } }).feasible, false);
});

test('CAP 1.2: el incidente ferroviario fusionado sale en CAP válido que el propio lector CAP de SENDA entiende', () => {
  const sim = simulateTwoTrainIncident();
  const site = sim.final.sites[0];
  const x = railIncidentToCap(site, { now: Date.UTC(2026, 0, 18, 19, 45) });
  assert.match(x, /^<\?xml/); assert.match(x, /urn:oasis:names:tc:emergency:cap:1\.2/);
  const back = parseCap(x);
  assert.equal(back.status, 'Actual'); assert.equal(back.severity, 'Extreme'); assert.equal(back.urgency, 'Immediate');
  assert.ok(back.area.circle && Math.abs(back.area.circle.center.lat - site.center.lat) < 1e-9);
  assert.throws(() => toCap({ identifier: 'x', sender: 's', sent: 0, info: { category: 'Nope', urgency: 'Immediate', severity: 'Minor', certainty: 'Observed', event: 'e' } }), /category/);
  assert.ok(!/[<>]script/i.test(toCap({ identifier: '<script>', sender: 's', sent: 0, info: { category: 'Rescue', urgency: 'Immediate', severity: 'Minor', certainty: 'Observed', event: '<b>' } })));
});

test('auditoría encadenada: alterar, borrar o reordenar una entrada se detecta', async () => {
  const log = createAuditLog();
  await log.append({ at: 1, actor: 'coord:A', action: 'ALERT_SENT', data: { building: 'B14' } });
  await log.append({ at: 2, actor: 'res:B', action: 'RESPONSE', data: { status: 'TRAPPED' } });
  await log.append({ at: 3, actor: 'coord:A', action: 'CAP_EXPORTED' });
  const e = log.entries();
  assert.deepEqual((await verifyAuditLog(e)).ok, true);
  const tampered = structuredClone(e); tampered[1].data.status = 'SAFE';
  assert.deepEqual(await verifyAuditLog(tampered), { ok: false, brokenAt: 1 });
  assert.equal((await verifyAuditLog([e[0], e[2]])).ok, false);
  assert.equal((await verifyAuditLog([e[1], e[0], e[2]])).ok, false);
});

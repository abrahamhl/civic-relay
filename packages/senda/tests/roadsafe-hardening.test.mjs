import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCrashEvent, syntheticTrace, evaluateDetector, SYNTHETIC_KINDS, EXAMPLE_DETECTION_CONFIG as CFG } from '../src/roadsafe-crash-detect.mjs';
import { constantTimeEqual, createMasterKey, sealProtected, openProtected, createCustodyKey, signAuditHead, verifyAuditHead, createRateLimiter, abuseSignals, coarsen, suppressSmallCells } from '../src/roadsafe-guard.mjs';
import { createIncident, observe, verifyAudit } from '../src/roadsafe-incident-twin.mjs';
import { parseCsv, fromBaac, fromStats19, validateRecord } from '../src/roadsafe-dataset.mjs';
import { stoppedVehicleStudy } from '../src/roadsafe-dataset-analysis.mjs';

test('detector: sin configuración declarada no funciona; nunca llama solo al 112', () => {
  assert.throws(() => detectCrashEvent(syntheticTrace('CRASH_REAR_END')), /configuración declarada/);
  const r = detectCrashEvent(syntheticTrace('CRASH_REAR_END'), CFG);
  assert.equal(r.autoCall112, false); assert.match(r.basis, /UNCALIBRATED/);
});

test('detector: choques ⇒ preguntar; caída del móvil, bache, frenada, esquí, montaña rusa y portazo ⇒ nada (trazas sintéticas)', () => {
  const traces = SYNTHETIC_KINDS.map((k) => ({ ...syntheticTrace(k), kind: k, synthetic: true }));
  const e = evaluateDetector(traces, CFG);
  assert.equal(e.fn, 0, JSON.stringify(e.rows)); assert.equal(e.fp, 0, JSON.stringify(e.rows));
  assert.match(e.basis, /SIMULATION/);
  const ski = detectCrashEvent(syntheticTrace('SKI_FALL'), CFG); assert.equal(ski.evidence.farFromRoad, true, 'lejos de toda vía: evidencia en contra');
  const drop = detectCrashEvent(syntheticTrace('PHONE_DROP_IN_CAR'), CFG); assert.equal(drop.evidence.freeFallBefore, true);
});

test('detector: sin GNSS (túnel) un pulso fuerte no se descarta; con caída libre previa sí', () => {
  const r = detectCrashEvent(syntheticTrace('CRASH_NO_GNSS'), CFG);
  assert.equal(r.state, 'CHECK_USER'); assert.ok(r.why.some((w) => /sin datos de velocidad/.test(w)));
  const quiet = detectCrashEvent({ imu: Array.from({ length: 100 }, (_, i) => ({ t: i * 0.01, x: 0, y: 0, z: 9.81 })), speed: [] }, CFG);
  assert.equal(quiet.state, 'NO_EVENT');
  assert.equal(detectCrashEvent({ imu: [{ t: 0, x: 0, y: 0, z: 9.8 }] }, CFG).state, 'ABSTAIN');
});

test('blindaje: comparación en tiempo constante', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true); assert.equal(constantTimeEqual('abc', 'abd'), false); assert.equal(constantTimeEqual('abc', 'abcd'), false);
});

test('blindaje: sobre AES-GCM por incidente — abre con su contexto; falla si se altera o se trasplanta', async () => {
  const mk = await createMasterKey();
  const env = await sealProtected({ owner: 'Familia X', phone: '+34000' }, mk, { incidentId: 'RS-1', purpose: 'asistencia' });
  assert.equal(env.alg, 'HKDF-SHA256/AES-256-GCM'); assert.doesNotMatch(JSON.stringify(env), /Familia|\+34/);
  assert.deepEqual(await openProtected(env, mk, { incidentId: 'RS-1', purpose: 'asistencia' }), { owner: 'Familia X', phone: '+34000' });
  await assert.rejects(openProtected({ ...env, incidentId: 'RS-2' }, mk, { incidentId: 'RS-2', purpose: 'asistencia' }), /alterado/);
  await assert.rejects(openProtected(env, mk, { incidentId: 'RS-1', purpose: 'seguro' }), /no corresponde/);
  const bad = { ...env, ct: env.ct.slice(0, -4) + 'AAAA' }; await assert.rejects(openProtected(bad, mk, { incidentId: 'RS-1', purpose: 'asistencia' }), /alterado/);
  await assert.rejects(openProtected(env, await createMasterKey(), { incidentId: 'RS-1', purpose: 'asistencia' }), /clave incorrecta/);
});

test('blindaje: custodia firmada de la cadena de auditoría detecta añadidos y manipulación', async () => {
  const inc = await createIncident({ obsId: 'a', source: 'V16_BEACON', rootHint: 'B', at: 0, lat: 40.2, lon: -3.3 }, { now: 1 });
  const v = await verifyAudit(inc), key = await createCustodyKey();
  const signed = await signAuditHead({ incidentId: inc.id, head: v.head, length: v.length, at: 2 }, key.privateKey);
  assert.equal((await verifyAuditHead(signed, key.publicKey, { head: v.head, length: v.length })).ok, true);
  await observe(inc, { obsId: 'b', source: 'DATEX2_NAP', at: 5, lat: 40.2, lon: -3.3 }, { now: 6 });
  const v2 = await verifyAudit(inc);
  assert.equal((await verifyAuditHead(signed, key.publicKey, { head: v2.head, length: v2.length })).ok, false);
  assert.equal((await verifyAuditHead({ ...signed, body: signed.body.replace('"length":', '"length":9') }, key.publicKey)).ok, false);
});

test('blindaje: limitador, ráfagas, saltos imposibles, difuminado y k-anonimato', () => {
  assert.throws(() => createRateLimiter({}), /declararse/);
  const rl = createRateLimiter({ capacity: 3, refillPerS: 0.1 });
  assert.ok([0, 0, 0].every(() => rl.allow('u', 0).ok)); assert.equal(rl.allow('u', 1).ok, false); assert.equal(rl.allow('u', 11).ok, true);
  const reps = [...Array.from({ length: 8 }, (_, i) => ({ reporterId: 'bot', at: i, lat: 40, lon: -3 })), { reporterId: 'jumper', at: 0, lat: 40, lon: -3 }, { reporterId: 'jumper', at: 10, lat: 41, lon: -3 }, { reporterId: 'ok', at: 0, lat: 40, lon: -3 }, { reporterId: 'ok', at: 600, lat: 40.05, lon: -3 }];
  const ab = abuseSignals(reps, { burstWindowS: 60, burstMax: 5, maxSpeedMs: 70 });
  assert.deepEqual(ab.map((a) => [a.reporterId, a.flags[0]]).sort(), [['bot', 'RAFAGA'], ['jumper', 'SALTO_IMPOSIBLE']]);
  assert.deepEqual(coarsen({ lat: 40.20012, lon: -3.30021 }, 0.005), { lat: 40.2, lon: -3.3, gridDeg: 0.005 });
  assert.equal(suppressSmallCells([{ count: 2 }, { count: 9 }], 5)[0].suppressed, true);
});

test('dataset FR (BAAC) y GB (STATS19): códigos oficiales verificados, arcén y vehículo detenido', () => {
  const c = parseCsv('"Num_Acc";"jour";"mois";"an";"hrmn";"lum";"dep";"com";"agg";"int";"atm";"col";"adr";"lat";"long"\n"202400000001";"25";"03";"2024";"07:40";"3";"70";"70285";"1";"1";"5";"2";"A6";"47,56277000";"6,75832000"')[0];
  const l = { Num_Acc: '202400000001', catr: '1', surf: '2', situ: '2', plan: '1', vma: '130', voie: '6' };
  const v = [{ manv: '23', obs: '0', obsm: '2', choc: '4', catv: '7' }, { manv: '1', obs: '0', obsm: '2', choc: '1', catv: '7' }];
  const u = [{ grav: '2' }, { grav: '4' }];
  const fr = fromBaac(c, l, v, u);
  assert.deepEqual([fr.collision, fr.light, fr.weather, fr.roadClass, fr.surface, fr.area, fr.severity, fr.onHardShoulder, fr.stoppedVehicleInvolved, fr.rearImpact, fr.weekday], ['REAR_END', 'DARK_UNLIT', 'FOG', 'MOTORWAY', 'WET', 'RURAL', 'FATAL', true, true, true, 1]);
  assert.equal(validateRecord(fr).valid, true);
  const uk = fromStats19({ collision_index: '2024X', collision_year: '2024', date: '05/03/2024', day_of_week: '1', time: '23:10', latitude: '51.5', longitude: '-0.1', collision_severity: '2', light_conditions: '6', road_surface_conditions: '4', weather_conditions: '7', road_type: '3', first_road_class: '1', speed_limit: '70', number_of_vehicles: '2' }, [{ vehicle_manoeuvre: '2', vehicle_location_restricted_lane: '6', first_point_of_impact: '2', vehicle_type: '9' }, { vehicle_manoeuvre: '19', vehicle_location_restricted_lane: '0', first_point_of_impact: '1', vehicle_type: '21' }]);
  assert.deepEqual([uk.severity, uk.light, uk.surface, uk.weather, uk.roadClass, uk.weekday, uk.speedLimitKmh, uk.onHardShoulder, uk.stoppedVehicleInvolved, uk.rearImpact, uk.involves.hgv, uk.area], ['SERIOUS', 'DARK_UNLIT', 'ICE_SNOW', 'FOG', 'MOTORWAY', 7, 113, true, true, true, true, 'UNKNOWN']);
  assert.equal(validateRecord(uk).valid, true);
  const st = stoppedVehicleStudy([fr, { ...fr, severity: 'SLIGHT', onHardShoulder: false }, uk]);
  assert.equal(st.hardShoulder.available, true); assert.equal(st.hardShoulder.k, 2);
});

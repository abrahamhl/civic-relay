import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingsFromOverpass, prepareBuilding, damageSummary, locateAccessPoints, personState, targetAudience, signalColor, overpassQuery, toLocal } from '../src/building-twin.mjs';
import { signCommand, evaluateCommand, planActions, keyThumb } from '../src/remote-command.mjs';
import { createOrganization, issueCredential } from '../src/roles.mjs';
import { simulateBuildingIncident, ZONE_ORIGIN } from '../src/building-scenario.mjs';

const now = Date.UTC(2026, 10, 4, 12);

test('OpenStreetMap: huellas y plantas desde Overpass (building:levels, height o por defecto)', () => {
  const sq = (lat, lon) => [[0, 0], [0, 0.0002], [0.0002, 0.0002], [0.0002, 0], [0, 0]].map(([a, b]) => ({ lat: lat + a, lon: lon + b }));
  const b = buildingsFromOverpass({ elements: [
    { type: 'way', id: 1, tags: { building: 'apartments', 'building:levels': '15', 'addr:street': 'Calle Real', 'addr:housenumber': '4' }, geometry: sq(37.68, -1.70) },
    { type: 'way', id: 2, tags: { building: 'yes', height: '9' }, geometry: sq(37.681, -1.70) },
    { type: 'way', id: 3, tags: { building: 'yes', name: 'Colegio' }, geometry: sq(37.682, -1.70) },
    { type: 'node', id: 4, tags: {} },
  ] });
  assert.equal(b.length, 3);
  assert.deepEqual(b.map((x) => x.levels), [15, 3, 1]);
  assert.equal(b[0].name, 'Calle Real 4'); assert.equal(b[2].name, 'Colegio');
  assert.match(overpassQuery({ lat: 37.68, lon: -1.7 }, 250), /around:250,37.68,-1.7/);
  const p = prepareBuilding(b[0], { lat: 37.68, lon: -1.70 });
  assert.ok(p.areaM2 > 300 && p.areaM2 < 450, `${p.areaM2}`);
});

test('recuento EMS-98 de la zona: afectados, graves y sin evaluar; prevalece la última evaluación', () => {
  const bs = [{ id: 'a', levels: 3 }, { id: 'b', levels: 5 }, { id: 'c', levels: 2 }];
  const s = damageSummary(bs, [{ buildingId: 'a', grade: 1, at: 1 }, { buildingId: 'a', grade: 4, at: 5 }, { buildingId: 'b', grade: 2, at: 2 }]);
  assert.equal(s.affected, 2); assert.equal(s.severe, 1); assert.equal(s.notAssessed, 1);
  assert.equal(s.rows[0].id, 'a');
});

test('routers: localización por plantas, apagados entre barridos y pasarela solo con Internet confirmado', () => {
  const b = prepareBuilding({ id: 'T', levels: 10, unitsPerFloor: 4, footprint: [[0, 0], [0, 0.0002], [0.0002, 0.0002], [0.0002, 0], [0, 0]].map(([a, c]) => ({ lat: 37.68 + a, lon: -1.70 + c })) }, { lat: 37.68, lon: -1.70 });
  const ap = { x: 15, y: 15, z: 6 * 3 + 1.5 }, scans = [];
  for (let h = 1.5; h < 33; h += 3) for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283, pt = { x: 9 + 18 * Math.cos(a), y: 11 + 18 * Math.sin(a), z: h }; const d = Math.hypot(ap.x - pt.x, ap.y - pt.y, ap.z - pt.z); scans.push({ ...pt, bssid: 'x', rssi: -38 - 30 * Math.log10(d), t: now / 1000 }); }
  scans.push({ x: 0, y: 0, z: 1, bssid: 'old', rssi: -80, t: now / 1000 - 1000 }, { x: 5, y: 0, z: 1, bssid: 'old', rssi: -82, t: now / 1000 - 1000 });
  const aps = locateAccessPoints(scans, b, { now: now / 1000, connected: [{ bssid: 'x', internet: true, t: now / 1000 }] });
  const x = aps.find((a) => a.bssid === 'x');
  assert.equal(x.floor, 6); assert.equal(x.unit, 'B'); assert.equal(x.gateway, true);
  const old = aps.find((a) => a.bssid === 'old');
  assert.equal(old.state, 'LOST'); assert.equal(old.gateway, false); assert.equal(old.position, null, 'con 2 lecturas no se inventa posición');
});

test('persona: sin respuesta tras 2 alertas → DESAPARECIDO sin confirmar (nunca víctima); señal localizada prevalece', () => {
  const alerts = [{ at: 0 }, { at: 300 }];
  assert.equal(personState({ alertsSent: alerts }, { now: 200 }).state, 'PENDING');
  assert.equal(personState({ alertsSent: alerts }, { now: 700 }).state, 'MISSING_UNCONFIRMED');
  assert.equal(personState({ alertsSent: alerts, phoneSignal: { t: 650, floor: 3 } }, { now: 700 }).state, 'SIGNAL_NO_RESPONSE');
  assert.equal(personState({ alertsSent: alerts, responses: [{ status: 'TRAPPED', at: 690 }] }, { now: 700 }).state, 'TRAPPED_CONFIRMED');
  assert.ok(!JSON.stringify(personState({ alertsSent: alerts }, { now: 9e9 })).match(/VICTIM|DEAD|FALLEC/i));
  const reg = [{ buildingId: 'B14', floor: 3, unit: 'A' }, { buildingId: 'B14', floor: 9, unit: 'A' }, { buildingId: 'B2', floor: 3, unit: 'A' }];
  assert.equal(targetAudience(reg, { buildingId: 'B14', floors: [2, 3, 4] }).length, 1);
});

test('mapa de calor: señal fuerte roja, débil azul', () => {
  assert.equal(signalColor(-42).strength, 'FUERTE');
  assert.equal(signalColor(-92).strength, 'DÉBIL');
  assert.match(signalColor(-70).css, /^rgb\(/);
});

test('órdenes remotas: solo coordinador verificado, con consentimiento, en zona y sin repetición', async () => {
  const fire = await createOrganization({ id: 'bomberos', name: 'Bomberos', kind: 'FIRE' });
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const day = 86400_000;
  const cred = await issueCredential(fire, { subject: await keyThumb(pub), role: 'JEFE_INCIDENTE', unit: 'Parque 3', validFrom: now - day, validUntil: now + day });
  const cmd = await signCommand({ issuerKeys: keys, credential: cred, target: { buildingId: 'B14', floors: [3, 4] }, actions: ['BLE_BEACON', 'SIREN', 'REPORT_STATUS'], message: 'Bomberos en la fachada este', now });
  const ctx = (o = {}) => ({ anchors: [fire.anchor], consent: { remoteCommands: true }, inDeclaredZone: true, battery: 60, radios: { bluetooth: true, wifi: true }, me: { buildingId: 'B14', floor: 3 }, seen: new Set(), now: now + 1000, ...o });
  const ok = await evaluateCommand(cmd, ctx());
  assert.equal(ok.accepted, true); assert.deepEqual(ok.plan.map((p) => p.mode), ['RUN', 'RUN', 'RUN']);
  assert.equal((await evaluateCommand(cmd, ctx({ consent: { remoteCommands: false } }))).reason, 'NO_OWNER_CONSENT');
  assert.equal((await evaluateCommand(cmd, ctx({ inDeclaredZone: false }))).reason, 'NO_DECLARED_ZONE');
  assert.equal((await evaluateCommand(cmd, ctx({ me: { buildingId: 'B14', floor: 9 } }))).reason, 'NOT_TARGETED');
  assert.equal((await evaluateCommand(cmd, ctx({ now: now + 3600_000 }))).reason, 'EXPIRED');
  const seen = new Set(); await evaluateCommand(cmd, ctx({ seen }));
  assert.equal((await evaluateCommand(cmd, ctx({ seen }))).reason, 'REPLAY');
  const forged = { ...cmd, actions: ['SIREN', 'FLASH'] };
  assert.equal((await evaluateCommand(forged, ctx())).reason, 'BAD_SIGNATURE');
  const rogue = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const stolen = await signCommand({ issuerKeys: rogue, credential: cred, target: {}, actions: ['SIREN'], now });
  assert.equal((await evaluateCommand(stolen, ctx())).reason, 'KEY_NOT_BOUND_TO_CREDENTIAL');
  const volunteer = await issueCredential(fire, { subject: await keyThumb(pub), role: 'VOLUNTARIO', unit: 'x', validFrom: now - day, validUntil: now + day });
  assert.equal((await evaluateCommand(await signCommand({ issuerKeys: keys, credential: volunteer, target: {}, actions: ['SIREN'], now }), ctx())).reason, 'NOT_A_COORDINATOR');
});

test('batería baja: sustituye acciones caras por baliza de bajo consumo; radio apagada → pide un toque', () => {
  const p = planActions(['SIREN', 'FLASH', 'REPORT_STATUS'], { battery: 9, radios: { bluetooth: true } });
  assert.deepEqual(p.map((x) => x.action), ['LOW_POWER_BEACON', 'REPORT_STATUS']);
  assert.equal(planActions(['BLE_BEACON'], { battery: 80, radios: { bluetooth: false } })[0].mode, 'ASK_USER_TAP');
});

test('escenario edificio 14: recuento de zona, routers por planta (±1) y personas sin presunciones', () => {
  for (const seed of [1, 2, 14]) {
    const r = simulateBuildingIncident({ seed });
    assert.equal(r.zone.total, 14); assert.ok(r.zone.affected >= 5);
    assert.ok(r.routers.located >= 50, `semilla ${seed}: ${r.routers.located}`);
    assert.ok(r.routers.floorWithin1Pct >= 95 && r.routers.unitPct >= 90, `semilla ${seed}`);
    assert.ok(r.routers.lostBetweenSurveys >= 1 && r.routers.gateways >= 1);
    assert.ok(r.people.locatedFloorWithin1Pct === null || r.people.locatedFloorWithin1Pct >= 80);
    assert.equal(r.board.length, 15);
  }
  const l = toLocal(ZONE_ORIGIN, ZONE_ORIGIN); assert.equal(l.x, 0);
});

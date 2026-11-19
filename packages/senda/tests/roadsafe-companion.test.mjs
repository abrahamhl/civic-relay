import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, fromDgt, fromUnfallatlas, fromBron, fromStatbel, rdToWgs84, validateRecord } from '../src/roadsafe-dataset.mjs';
import { oddsRatio, conditionalShare, hotspotsEB, gridCell, roadKmCell, empiricalSeverityFactors, roadsafeProfile, similarCases } from '../src/roadsafe-dataset-analysis.mjs';
import { decideStayOrExit, validateCounts, toDossierScene, SAFETY_QUESTIONS } from '../src/roadsafe-guidance.mjs';
import { createTrip, inviteCode, joinTrip, addPersonWithoutDevice, heartbeat, startCheckIn, respond, reportFor, situation, ringCommand, verifyRing, rssiDistanceM } from '../src/roadsafe-occupants.mjs';
import { plusCode, plusCodeCenter, locationPackage } from '../src/roadsafe-location-share.mjs';
import { planarImpact, postImpactTrajectory, dangerEnvelope, severityBand, triageFromPhysics, EXAMPLE_VEHICLES_UNSOURCED as VEHICLE_PRESETS, EXAMPLE_PHYSICS_SCENARIO as PHYS } from '../src/roadsafe-crash-physics.mjs';
import { decodeObd, obdDecel, estimateMounting, toVehicleFrame, classifyImpulse, pulseDeltaV, predictStop } from '../src/roadsafe-vehicle-sensors.mjs';
import { createAnnouncer, phrase } from '../src/roadsafe-announcer.mjs';
import { planServiceStop, serviceStopCapsule, isServiceStop, arrivalObservation, EXAMPLE_SERVICE_STOP_POLICY as POL } from '../src/roadsafe-service-stop.mjs';
import { assessHazardFrame, createFrameSigner, createTrustStore } from '../src/roadsafe-frame-trust.mjs';
import { decodeHazard } from '../src/road-guard.mjs';
import { createResponderRegistry } from '../src/roadsafe-responders.mjs';
import { createRouteStore, offlineRoutePack, compareRoutesByRisk, simplify } from '../src/roadsafe-routes.mjs';

// Filas con el formato REAL de cada fuente (valores de ejemplo de los ficheros oficiales 2024).
const DE_CSV = 'OID_;UIDENTSTLAE;ULAND;UREGBEZ;UKREIS;UGEMEINDE;UJAHR;UMONAT;USTUNDE;UWOCHENTAG;UKATEGORIE;UART;UTYP1;ULICHTVERH;IstStrassenzustand;IstRad;IstPKW;IstFuss;IstKrad;IstGkfz;IstSonstige;LINREFX;LINREFY;XGCSWGS84;YGCSWGS84;PLST\n1;01240526125013102024;01;0;59;044;2024;05;23;1;3;1;5;2;0;0;1;0;0;0;0;525162,37;6045497,2;9,389075627000068;54,556379612000057;1\n2;01240526105132502024;01;0;62;094;2024;05;23;1;1;2;6;0;1;0;1;0;0;1;0;600576,09;5964744,32;10,527878375000057;53,821498344000076;1';
const NL_CSV = 'FID,shape,verkeersongeval_nummer,jaar_ongeval,verkeersongeval_afloop,partij_1_objecttype,partij_2_objecttype,aard_ongeval,wegsituatie,bebouwde_kom,maximum_snelheid,wegdek,lichtgesteldheid,weersgesteldheid,bijz_tijdelijke_aard,straatnaam\nongevallen_2024.34,POINT (131437.148 422301.464),20240001154,2024,Uitsluitend materiele schade,Personenauto,,Onbekend,Rechte weg,Buiten,60,Sneeuw/ijzel,Duisternis,Sneeuw/Hagel,,Hoge Maasdijk\nongevallen_2024.99,POINT (121000 487000),20240009999,2024,Letsel,Personenauto,Personenauto,Kop/staart,"Rechte weg, gescheiden rijbanen",Buiten,100,Nat,Daglicht,Regen,Ander ongeval,A4';
const ES_ROW = { ID_ACCIDENTE: 1, ANYO: 2024, MES: 1, DIA_SEMANA: 3, HORA: 22, ZONA_AGRUPADA: 1, CARRETERA: 'A-2622', KM: 33, SENTIDO_1F: 1, TIPO_VIA: 6, TIPO_ACCIDENTE: 4, TOTAL_MU30DF: 0, TOTAL_HG30DF: 1, TOTAL_HL30DF: 0, TOTAL_VEHICULOS: 2, CONDICION_FIRME: 3, CONDICION_ILUMINACION: 6, CONDICION_METEO: 3, CONDICION_NIEBLA: '', VISIB_RESTRINGIDA_POR: 9, NUDO: 2, TRAZADO_PLANTA: 2 };

test('dataset: adaptadores DE/NL/ES con códigos oficiales; RD→WGS84; BE sin verificar se rechaza', () => {
  const de = parseCsv(DE_CSV).map(fromUnfallatlas);
  assert.equal(de[0].collision, 'STATIONARY_VEHICLE'); assert.equal(de[0].light, 'DARK'); assert.equal(de[0].weekday, 7, 'Destatis 1=domingo → ISO 7');
  assert.equal(de[1].severity, 'FATAL'); assert.equal(de[1].collision, 'REAR_END'); assert.equal(de[1].involves.hgv, true); assert.ok(Math.abs(de[0].lat - 54.5564) < 1e-3);
  const nl = parseCsv(NL_CSV).map(fromBron);
  assert.equal(nl[0].severity, 'PDO'); assert.equal(nl[0].surface, 'ICE_SNOW'); assert.equal(nl[1].collision, 'REAR_END'); assert.equal(nl[1].secondaryIndicator, 'OTHER_ACCIDENT'); assert.equal(nl[1].roadClass, 'DUAL_CARRIAGEWAY'); assert.equal(nl[1].severity, 'INJURY');
  const ams = rdToWgs84(121000, 487000); assert.ok(Math.abs(ams.lat - 52.37) < 0.02 && Math.abs(ams.lon - 4.89) < 0.03, 'RD (121000, 487000) ≈ Ámsterdam');
  const es = fromDgt(ES_ROW);
  assert.deepEqual([es.collision, es.light, es.surface, es.weather, es.severity, es.roadClass, es.area, es.coordQuality], ['REAR_END', 'DARK_UNLIT', 'WET', 'RAIN', 'SERIOUS', 'SINGLE_CARRIAGEWAY', 'RURAL', 'ROAD_PK']);
  assert.equal(es.visibilityRestrictedByVehicle, true); assert.equal(es.curve, true);
  assert.equal(fromDgt({ ...ES_ROW, CARRETERA: 'No inventariada' }).road, null);
  for (const r of [...de, ...nl, es]) assert.equal(validateRecord(r).valid, true, JSON.stringify(validateRecord(r)));
  assert.throws(() => fromStatbel({ foo: 1 }), /no está verificado/);
  assert.equal(parseCsv('a;b\n"x;y";"z ""q"""\n')[0].b, 'z "q"', 'comillas y separador dentro de campo');
});

test('análisis: OR con IC de Woolf, Wilson, Bayes empírico que contrae, perfil y casos similares', () => {
  const rec = [];
  for (let i = 0; i < 400; i++) rec.push({ severity: i % 10 === 0 ? 'FATAL' : 'SLIGHT', light: 'DARK', surface: 'DRY', collision: 'REAR_END', area: 'RURAL', lat: 40 + (i % 5) * 0.001, lon: -3, involves: {}, curve: false });
  for (let i = 0; i < 600; i++) rec.push({ severity: i % 25 === 0 ? 'FATAL' : 'SLIGHT', light: 'DAY', surface: 'DRY', collision: 'SIDE', area: 'URBAN', lat: 41 + (i % 50) * 0.02, lon: -3, involves: {}, curve: false });
  const or = oddsRatio(rec, (r) => r.light === 'DARK', (r) => r.severity === 'FATAL');
  assert.ok(or.or > 2 && or.significant); assert.ok(or.ci[0] < or.or && or.or < or.ci[1]);
  const cs = conditionalShare(rec, 'light', (r) => r.severity === 'FATAL'); assert.equal(cs[0].group, 'DARK'); assert.ok(cs[0].ci[0] <= cs[0].p);
  const hs = hotspotsEB(rec, gridCell(0.01), { minCount: 3 }); assert.ok(hs.top[0].ebExpected < hs.top[0].count, 'contracción hacia la media');
  assert.equal(roadKmCell(1)({ road: 'A-3', km: 41.7 }), 'A-3@41');
  const sev = empiricalSeverityFactors(rec); assert.ok(sev.darkVsDay.or > 1); assert.match(sev.interpretation, /No mide frecuencia/);
  const prof = roadsafeProfile(rec); assert.equal(prof.rearEnd.k, 400);
  const sim = similarCases(rec, { collision: 'REAR_END', light: 'DARK', lat: 40.001, lon: -3 }, { k: 3 }); assert.equal(sim.length, 3); assert.equal(sim[0].record.collision, 'REAR_END');
});

test('guía: fuego ⇒ salir ya; lugar seguro ⇒ salir al refugio; sin refugio ⇒ quedarse con cinturón; atrapados ⇒ no mover', () => {
  assert.equal(decideStayOrExit({ fire: true, safeRefuge: false }).decision, 'EXIT_NOW_FIRE');
  assert.equal(decideStayOrExit({ safeRefuge: true, exitAwaySide: true }).decision, 'EXIT_TO_REFUGE');
  assert.equal(decideStayOrExit({ safeRefuge: false }).decision, 'STAY_BELTED');
  assert.equal(decideStayOrExit({ safeRefuge: true, exitAwaySide: false }).decision, 'STAY_BELTED');
  assert.equal(decideStayOrExit({ safeRefuge: true, trapped: true }).decision, 'STAY_WITH_INJURED');
  const u = decideStayOrExit({}); assert.equal(u.decision, 'CALL_112_AND_STAY_ALERT'); assert.match(u.steps[0], /112/);
  assert.match(decideStayOrExit({ safeRefuge: true, inLane: true }, { lang: 'en' }).steps.join(' '), /lane: tell 112 first/);
  assert.equal(decideStayOrExit({ fire: true }).priority, 'LIFE');
  assert.ok(SAFETY_QUESTIONS.every((q) => q.es && q.en && q.nl && q.de && q.fr));
  const v = validateCounts({ people: 2, injured: 3, vehicles: 'x' }); assert.ok(v.issues.includes('más heridos que personas')); assert.ok(v.issues.includes('vehicles no válido'));
  const scene = toDossierScene({ trapped: true, fire: false }, { people: 3, vehicles: 2 }, { decision: 'STAY_WITH_INJURED' }); assert.equal(scene.trapped, 1); assert.equal(scene.stayOrExit, 'STAY_WITH_INJURED');
});

test('ocupantes: manifiesto con invitación, comprobación tras choque, persona ≠ dispositivo, móvil perdido y orden de búsqueda firmada', async () => {
  const trip = await createTrip({ tripId: 'T1', now: 0 }), code = await inviteCode(trip);
  assert.equal((await joinTrip(trip, { code: 'malo', alias: 'X', deviceId: 'dx', now: 1 })).ok, false);
  const a = await joinTrip(trip, { code, alias: 'Conductora', deviceId: 'dA', role: 'DRIVER', now: 1 });
  const b = await joinTrip(trip, { code, alias: 'Hijo', deviceId: 'dB', now: 2 });
  await joinTrip(trip, { code, alias: 'Abuela', deviceId: 'dC', now: 3 });
  addPersonWithoutDevice(trip, { alias: 'Bebé', now: 4 });
  heartbeat(trip, { deviceId: 'dB', now: 50, pos: { lat: 40.2, lon: -3.3 } });
  startCheckIn(trip, { now: 100, timeoutS: 60, crashPos: { lat: 40.2, lon: -3.3 } });
  respond(trip, { deviceId: 'dA', now: 110, status: 'OK' });
  reportFor(trip, { byDeviceId: 'dA', personId: b.personId, now: 115, status: 'OK' }); // el móvil del hijo no responde, pero ella le ve bien
  heartbeat(trip, { deviceId: 'dC', now: 120, pos: { lat: 40.2008, lon: -3.3 } }); // móvil de la abuela a ~90 m: despedido
  const s = situation(trip, { now: 200 });
  assert.equal(s.peopleOnBoard, 4); assert.equal(s.ok, 2); assert.deepEqual(s.unaccountedAliases.sort(), ['Abuela', 'Bebé']);
  assert.equal(s.devices.find((d) => d.deviceId === 'dB').status, 'POSSIBLY_LOST');
  assert.equal(s.devices.find((d) => d.deviceId === 'dC').status, 'POSSIBLY_SEPARATED');
  assert.equal(s.for112.sinConfirmar, 2); assert.equal(s.caveats.length, 2);
  const ring = await ringCommand(trip, { byDeviceId: 'dA', targetDeviceId: 'dB', now: 210 });
  assert.equal((await verifyRing(trip, ring.cmd, { deviceId: 'dB', now: 220 })).ok, true);
  assert.equal((await verifyRing(trip, ring.cmd, { deviceId: 'dC', now: 220 })).ok, false);
  assert.equal((await verifyRing(trip, { ...ring.cmd, mac: '00' }, { deviceId: 'dB', now: 220 })).ok, false);
  assert.equal((await verifyRing(trip, ring.cmd, { deviceId: 'dB', now: 9999 })).ok, false);
  assert.equal(rssiDistanceM(-59).metres, null, 'sin calibración declarada no hay distancia'); assert.ok(rssiDistanceM(-59, { txPower: -59, n: 2 }).metres === 1);
});

test('ubicación: Plus Code coincide con el ejemplo canónico OLC; ida y vuelta; SMS ≤ 160 GSM', () => {
  assert.equal(plusCode(47.36559, 8.524997), '8FVC9G8F+6X'); assert.equal(plusCode(0, 0), '6FG22222+22');
  const c = plusCodeCenter(plusCode(40.20012, -3.30021)); assert.ok(Math.abs(c.lat - 40.20012) < 0.0002 && Math.abs(c.lon + 3.30021) < 0.0002);
  const p = locationPackage({ lat: 40.20012, lon: -3.30021, accuracyM: 80, at: 1_800_000_000 }, { road: { roadId: 'A-3', pk: 41.2, sentido: 'creciente' }, info: { kind: 'CRASH', people: 3, injured: 1, trapped: 1, fire: true } });
  assert.ok(p.sms.length <= 160); assert.match(p.sms, /A-3 PK 41,2/); assert.ok(/^[\x20-\x7E]*$/.test(p.sms));
  assert.equal(p.geoUri, 'geo:40.200120,-3.300210;u=80'); assert.ok(p.warnings.some((w) => /Precisión baja/.test(w)));
});

test('física: conservación exacta del momento lineal y angular; impacto descentrado induce guiñada; reposo y envolvente', () => {
  const P = VEHICLE_PRESETS;
  const r = planarImpact({ ...P.car, pos: { x: -2.25, y: 0.3 }, vel: { x: 25, y: 0 }, omega: 0 }, { ...P.taxi, pos: { x: 2.35, y: 0 }, vel: { x: 0, y: 0 }, omega: 0 }, { p: { x: 0, y: 0.6 }, n: { x: 1, y: 0 } }, { e: 0.1 });
  assert.ok(r.conservation.linearErr < 1e-6 && r.conservation.angularErr < 1e-6);
  assert.ok(Math.abs(r.after[1].omega) > 0.5, 'golpe descentrado ⇒ rotación');
  const centred = planarImpact({ ...P.car, pos: { x: -2.25, y: 0 }, vel: { x: 25, y: 0 }, omega: 0 }, { ...P.taxi, pos: { x: 2.35, y: 0 }, vel: { x: 0, y: 0 }, omega: 0 }, { p: { x: 0, y: 0 }, n: { x: 1, y: 0 } }, { e: 0.1 });
  assert.ok(Math.abs(centred.after[1].omega) < 1e-9, 'golpe centrado ⇒ sin rotación');
  assert.equal(planarImpact({ ...P.car, pos: { x: 0, y: 0 }, vel: { x: -1, y: 0 }, omega: 0 }, { ...P.taxi, pos: { x: 5, y: 0 }, vel: { x: 0, y: 0 }, omega: 0 }, { p: { x: 2.5, y: 0 }, n: { x: 1, y: 0 } }, { e: 0.1 }).impact, false);
  assert.throws(() => planarImpact({ ...P.car, pos: { x: 0, y: 0 }, vel: { x: 1, y: 0 }, omega: 0 }, { ...P.taxi, pos: { x: 5, y: 0 }, vel: { x: 0, y: 0 }, omega: 0 }, { p: { x: 2.5, y: 0 }, n: { x: 1, y: 0 } }), /restitución/);
  const tr = postImpactTrajectory({ ...r.after[1] }, { mu: 0.7, etaPost: 0.6, cOmega: 0.8 }); const v = Math.hypot(r.after[1].vel.x, r.after[1].vel.y);
  assert.ok(Math.abs(tr.travelM - (v * v) / (2 * 0.6 * 0.7 * 9.80665)) < 1.5, 'distancia ≈ v²/(2·η·μ·g)');
  assert.throws(() => dangerEnvelope({ striker: P.car, struck: P.taxi, v1: 20 }), /escenario declarado/);
  const env = dangerEnvelope({ ...PHYS, striker: P.car, struck: P.taxi, v1: 20, angleDeg: 0, offsetM: 0, y1: 1.75, y2: 1.75 }, { n: 120 });
  assert.ok(env.laneInvasion.find((l) => l.lane === 'LANE_1').p > 0.9); assert.ok(env.restReachM.p95 >= env.restReachM.p50);
  assert.equal(severityBand(8).band, 'HIGH'); assert.equal(severityBand(12).band, 'SEVERE'); assert.equal(triageFromPhysics({ deltaVms: 5, rolledOver: true }).priority, 'LIFE');
});

test('sensores: OBD-II estándar, orientación del móvil, choque vs caída del móvil, Δv y parada prevista', () => {
  assert.deepEqual([decodeObd('41 0D 3C').value, decodeObd('41 0C 1A F8').value], [60, 1726]);
  assert.equal(decodeObd('41 99 00').ok, false); assert.equal(decodeObd('NO DATA').ok, false);
  assert.equal(obdDecel([{ t: 0, kmh: 72 }, { t: 0.5, kmh: 54 }, { t: 1, kmh: 36 }]), 10);
  const samples = []; for (let i = 0; i < 40; i++) samples.push({ a: { x: i % 4 === 0 ? 2 : 0, y: 0, z: 9.81 }, dvGnss: i % 4 === 0 ? 2 : 0 });
  const m = estimateMounting(samples); assert.equal(m.ok, true); assert.ok(m.forward.x > 0.99);
  assert.ok(toVehicleFrame({ x: -5, y: 0, z: 9.80665 }, m).long < -4.9);
  const crash = Array.from({ length: 30 }, (_, i) => ({ x: i >= 5 && i < 15 ? -80 : 0, y: 0, z: 9.8 }));
  assert.equal(classifyImpulse({ imu: crash, speedBefore: 20, speedAfter: 8 }).verdict, 'CRASH_LIKELY');
  const drop = [...Array.from({ length: 25 }, () => ({ x: 0, y: 0, z: 0.5 })), ...Array.from({ length: 3 }, () => ({ x: 0, y: 0, z: 90 }))];
  assert.equal(classifyImpulse({ imu: drop, speedBefore: 20, speedAfter: 20 }).verdict, 'PHONE_DROP');
  assert.equal(pulseDeltaV(Array(10).fill(-100), 0.01).deltaVms, 10);
  assert.deepEqual(predictStop({ vMs: 20, decelMs2: 4, posAheadM: 100, latencyS: 0 }), { tStopS: 5, stopAtAheadM: 150, note: 'supone deceleración constante desde ahora' });
});

test('megafonía: escalera de distancias, sin repetir, máximo por peligro, silencio si la política suprime, 5 idiomas', () => {
  assert.equal(phrase({ kind: 'SERVICE_STOPPING', distanceM: 300, lang: 'es' }), 'Atención: vehículo de servicio deteniéndose a 300 metros. Precaución.');
  assert.match(phrase({ kind: 'QUEUE_TAIL', distanceM: 1000, lang: 'de' }), /Stauende in 1 Kilometer/);
  assert.match(phrase({ kind: 'STOPPED_SHOULDER', distanceM: 500, side: 'right', lang: 'nl' }), /vluchtstrook rechts over 500 meter/);
  const risk = { absoluteRiskReduction: 0.05, ciNoWarning: [0.2, 0.3], ciWithWarning: [0.1, 0.15] };
  const base = { id: 'h1', kind: 'STOPPED_SHOULDER', speedMs: 25, trustCeiling: 'WARNING', carriageway: 'SAME', posErrM: 10, confidenceP: 0.95, risk };
  const A = createAnnouncer({ lang: 'es' });
  assert.equal(A.consider({ ...base, distanceM: 1900 }, 0).speak, true);
  assert.equal(A.consider({ ...base, distanceM: 1800 }, 3).speak, false, 'mismo escalón');
  assert.equal(A.consider({ ...base, distanceM: 950 }, 40).speak, true);
  assert.equal(A.consider({ ...base, distanceM: 480 }, 60).speak, true);
  assert.equal(A.consider({ ...base, distanceM: 190 }, 80).speak, false, 'tiempo hasta el peligro < 4 s ⇒ política suprime');
  assert.equal(createAnnouncer().consider({ ...base, carriageway: 'OPPOSITE', distanceM: 900 }, 0).speak, false);
  const quiet = createAnnouncer(); quiet.consider({ ...base, distanceM: 1900 }, 0);
  assert.equal(quiet.consider({ ...base, id: 'h2', distanceM: 1900 }, 5).speak, false, 'separación mínima entre avisos');
});

test('parada de servicio: plan por delante del averiado, cápsula firmada con banderas, observación de llegada', async () => {
  assert.throws(() => planServiceStop({ disabledS: 10_000, approachSpeedMs: 25, shoulderFreeAheadM: 80 }), /política declarada/);
  const noAssessment = planServiceStop({ disabledS: 10_000, approachSpeedMs: 25, shoulderFreeAheadM: 80, policy: POL });
  assert.equal(noAssessment.status, 'ABSTAIN_UNVERIFIED_SITE'); assert.equal(noAssessment.stopS, null);
  const siteAssessment = { verified: true, safePullOffApproved: true };
  const p = planServiceStop({ disabledS: 10_000, approachSpeedMs: 25, shoulderFreeAheadM: 80, policy: POL, siteAssessment });
  assert.equal(p.status, 'HYPOTHETICAL_REVIEW_REQUIRED'); assert.equal(p.canGuideDriver, false);
  assert.equal(p.stopPosition, 'AHEAD_OF_DISABLED_ON_SHOULDER'); assert.ok(p.brakeStartS < p.stopS && p.announceFromS < p.brakeStartS);
  const noSpace = planServiceStop({ disabledS: 10_000, approachSpeedMs: 25, shoulderFreeAheadM: 10, policy: POL, siteAssessment });
  assert.equal(noSpace.status, 'NO_VERIFIED_PULLOFF_SPACE'); assert.equal(noSpace.stopS, null);
  assert.throws(() => planServiceStop({ disabledS: 10_000, approachSpeedMs: -1, shoulderFreeAheadM: 80, policy: POL }), /inválida/);
  const fleet = await createFrameSigner(), store = createTrustStore(); await store.enroll(fleet.publicKey, { role: 'PEER_DEVICE', label: 'flota taxi (ejercicio)' });
  const { capsule, frame } = await serviceStopCapsule(fleet, { t: 1000, lat: 40.2, lon: -3.3, headingDeg: 45, speedMs: 20, incidentShortId: 77, pickup: true });
  assert.equal(isServiceStop(decodeHazard(frame)), true);
  assert.equal((await assessHazardFrame(capsule, { now: 1001, receiver: { lat: 40.2005, lon: -3.3 }, trustStore: store })).trust, 'SIGNED_PEER');
  const o = arrivalObservation({ providerId: 'TAXI-SIM', incidentId: 'RS-1', at: 990, lat: 40.2, lon: -3.3, etaS: 60 }); assert.equal(o.source, 'PROVIDER_STATUS'); assert.match(o.note, /llegando/);
});

test('servicios: solo con credencial, caducidad, visibilidad por rol y propuesta (no asignación)', () => {
  const reg = createResponderRegistry({ ttlS: 120 });
  assert.equal(reg.update({ unitId: 'GC-1', agency: 'GC', kind: 'POLICE', lat: 40.21, lon: -3.3, at: 100, status: 'AVAILABLE' }, { now: 100, credential: { verified: false, agency: 'GC' } }).ok, false);
  reg.update({ unitId: 'GC-1', agency: 'GC', kind: 'POLICE', lat: 40.21, lon: -3.3, at: 100, status: 'AVAILABLE' }, { now: 100, credential: { verified: true, agency: 'GC' } });
  reg.update({ unitId: 'AMB-1', agency: 'SUM', kind: 'AMBULANCE', lat: 40.3, lon: -3.3, at: 100, status: 'ASSIGNED', assignedIncident: 'RS-1', shareWithCitizen: true }, { now: 100, credential: { verified: true, agency: 'SUM' } });
  assert.equal(reg.update({ unitId: 'GC-1', agency: 'GC', kind: 'POLICE', lat: 40.2, lon: -3.3, at: 90, status: 'AVAILABLE' }, { now: 110, credential: { verified: true, agency: 'GC' } }).ok, false, 'actualización antigua');
  assert.equal(reg.view({ now: 110, role: 'PUBLIC' }).length, 0);
  assert.deepEqual(reg.view({ now: 110, role: 'CITIZEN', incidentId: 'RS-1' }).map((u) => u.kind), ['AMBULANCE']);
  assert.equal(reg.view({ now: 110, role: 'CITIZEN', incidentId: 'RS-2' }).length, 0);
  assert.equal(reg.suggestNearest({ lat: 40.2, lon: -3.3 }, { now: 110 }).proposals[0].unitId, 'GC-1');
  assert.equal(reg.suggestNearest({ lat: 40.2, lon: -3.3 }, { now: 500 }).proposals.length, 0, 'posiciones caducadas no cuentan');
  assert.ok(reg.view({ now: 500, role: 'COORDINATOR' }).every((u) => u.stale));
});

test('rutas: favoritas, paquete offline pequeño con peligros del corredor, comparación por riesgo histórico', () => {
  const store = createRouteStore();
  const line = (lat0, n, dLon) => Array.from({ length: n }, (_, i) => ({ lat: lat0 + i * 0.0005, lon: -3.3 + i * dLon }));
  assert.equal(store.save({ id: 'casa-trabajo', name: 'Casa → trabajo', points: line(40.2, 400, 0.0001) }, { now: 1 }).ok, true);
  store.save({ id: 'alt', name: 'Alternativa', points: line(40.2, 300, 0.0003) }, { now: 2 }); store.favorite('casa-trabajo');
  assert.equal(store.list()[0].id, 'casa-trabajo');
  assert.equal(createRouteStore().importJson(store.exportJson()), 2);
  const r = store.get('casa-trabajo');
  const pack = offlineRoutePack(r, { hazards: { hazards: [{ id: 'h', label: 'Accidente', lat: 40.25, lon: -3.29, alongKm: 5, carriageway: 'SAME' }], otherCarriageway: [{}] }, services: [{ name: 'Taller', kind: 'GARAGE', lat: 40.21, lon: -3.299 }, { name: 'Lejos', kind: 'GARAGE', lat: 41, lon: -3 }], now: 0 });
  assert.ok(pack.bytes < 20_000); assert.ok(pack.points.simplified < pack.points.original); assert.equal(pack.pack.services.length, 1); assert.equal(pack.pack.otherCarriagewayInfo, 1);
  assert.equal(pack.stale(7 * 3600), true);
  const cmp = compareRoutesByRisk([{ id: 'casa-trabajo', name: 'A', points: r.points }, { id: 'alt', name: 'B', points: store.get('alt').points }], [{ centroid: { lat: 40.25, lon: -3.29 }, ebExpected: 40, fatal: 2 }]);
  assert.equal(cmp.lowestRiskPerKm, 'alt'); assert.match(cmp.note, /elección es del conductor/);
  assert.ok(simplify([{ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 }, { lat: 0, lon: 0.002 }]).length === 2);
});

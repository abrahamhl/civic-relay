import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectHardBrake, detectCarCrash, encodeHazard, decodeHazard, relayHazard, HAZARD, HAZARD_BYTES, hazardRelevance, brakeAdvice, alertGain, brakeChain,
  contactProbability, muleDelivery, roadScenario, roadLocate, pointAt, roadDeadReckon, describePosition, landmarksAlong, demoRoad, corridorTiles, ROUTE_MAD_VLC,
  navLinks, reportBelief, toCifs, roadSosText, call112Script, createScene, sceneAct, sceneBrief, civicLedger, verifyLedger,
} from '../src/road-guard.mjs';
import { startTriage } from '../src/triage.mjs';

const series = (v0, a, { hz = 1, s = 8, t0 = 0, until = Infinity } = {}) => Array.from({ length: s * hz + 1 }, (_, k) => { const t = t0 + k / hz; return { t, speed: Math.max(0, t < until ? v0 : v0 - a * (t - until)) }; });

test('frenada brusca por GNSS: 120 km/h a 7 m/s² sí; frenada normal no; caída imposible para unos frenos = golpe', () => {
  const hard = detectHardBrake(series(33.3, 7, { until: 2 }));
  assert.equal(hard.state, 'HARD_BRAKE'); assert.ok(Math.abs(hard.decelMs2 - 7) < 0.6, String(hard.decelMs2));
  assert.equal(detectHardBrake(series(33.3, 2, { until: 2 })).state, 'NONE');
  assert.equal(detectHardBrake(series(10, 7, { until: 2 })).state, 'NONE', 'a poca velocidad no se avisa');
  const gps = [{ t: 0, speed: 25 }, { t: 1, speed: 25 }, { t: 2, speed: 25 }, { t: 3, speed: 0 }, { t: 4, speed: 0 }];
  assert.equal(detectHardBrake(gps).state, 'IMPACT_LIKE');
});

test('choque de coche: impacto + parada en un segundo desde 90 km/h; frenada fuerte sin golpe no es choque', () => {
  const G = 9.80665, motion = [];
  for (let t = 0; t < 12; t += 0.05) motion.push({ t, ax: 0, ay: Math.abs(t - 5) < 0.06 ? 7 * G : 0, az: G });
  const gps = [0, 1, 2, 3, 4, 5.6, 6, 7, 8, 9, 10, 11].map((t) => ({ t, speed: t < 5 ? 25 : 0 }));
  assert.match(detectCarCrash({ motion, gps }).state, /CRASH/);
  const calm = Array.from({ length: 200 }, (_, k) => ({ t: k * 0.05, ax: 0, ay: 0.4 * G, az: G }));
  assert.equal(detectCarCrash({ motion: calm, gps: series(25, 8, { s: 9, until: 2 }) }).state, 'HARD_BRAKING');
});

test('trama de aviso: 24 bytes, ida y vuelta exacta, saltos con tope', () => {
  const h = { type: HAZARD.BRAKE, t: 1793000000, lat: 40.123456, lon: -3.654321, headingDeg: 87.5, speedMs: 31.2, decelMs2: 7.4, id: 99 };
  const b = encodeHazard(h); assert.equal(b.length, HAZARD_BYTES); assert.ok(3 + 4 + HAZARD_BYTES <= 31, 'cabe en un anuncio BLE clásico');
  const d = decodeHazard(b); for (const k of ['type', 't', 'lat', 'lon', 'headingDeg', 'speedMs', 'decelMs2', 'id']) assert.ok(Math.abs(d[k] - h[k]) < 1e-6, k);
  let x = b; for (let i = 0; i < 3; i++) x = relayHazard(x); assert.equal(decodeHazard(x).hops, 3); assert.equal(relayHazard(x), null);
});

test('relevancia: delante y en mi sentido sí; detrás, sentido contrario o carril de al lado no', () => {
  const me = { lat: 40, lon: -3, headingDeg: 0 }, at = (dn, de) => ({ lat: 40 + dn / 111320, lon: -3 + de / (111320 * Math.cos((40 * Math.PI) / 180)) });
  const hz = (dn, de, h = 0, type = HAZARD.BRAKE) => ({ ...at(dn, de), headingDeg: h, type, t: 100 });
  assert.equal(hazardRelevance(me, hz(300, 2), { now: 102 }).relevant, true);
  assert.equal(hazardRelevance(me, hz(-200, 0), { now: 102 }).relevant, false);
  assert.equal(hazardRelevance(me, hz(300, 2, 180), { now: 102 }).relevant, false);
  assert.equal(hazardRelevance(me, hz(300, 30), { now: 102 }).relevant, false);
  assert.equal(hazardRelevance(me, hz(300, 30, 180, HAZARD.FOG), { now: 102 }).relevant, true, 'la niebla afecta a los dos sentidos');
  assert.equal(hazardRelevance(me, hz(300, 2), { now: 160 }).relevant, false, 'una frenada de hace un minuto ya no vale');
  const road = { roadId: 'A-4', dir: 1 };
  assert.equal(hazardRelevance({ ...me, ...road, s: 1000 }, { ...hz(0, 0), ...road, s: 1800 }, { now: 101 }).aheadM, 800);
});

test('consejo de frenada: deceleración necesaria y nivel (umbral AASHTO 3,4 m/s²)', () => {
  assert.equal(brakeAdvice({ vMs: 33.3, distM: 200 }).level, 'FRENA');
  assert.equal(brakeAdvice({ vMs: 33.3, distM: 400 }).level, 'ATENCION');
  assert.equal(brakeAdvice({ vMs: 33.3, distM: 900 }).level, 'INFO');
  assert.equal(brakeAdvice({ vMs: 33.3, distM: 40 }).aReqMs2, Infinity);
});

test('ganancia honesta: con el coche de justo delante no hay ganancia; con tres por delante, casi 2 s', () => {
  assert.equal(alertGain({ carsAhead: 1, vMs: 33.3 }).gainS, 0);
  const g = alertGain({ carsAhead: 3, vMs: 33.3 }); assert.ok(g.gainS > 1.9 && g.gainM > 60, JSON.stringify(g));
});

test('columna con 1,2 s de separación a 120 km/h: sin SENDA choque en cadena; con SENDA solo el de justo detrás; con 2 s nadie', () => {
  const no = brakeChain({ gapS: 1.2 }), all = brakeChain({ gapS: 1.2, senda: Array(6).fill(true) });
  assert.equal(no.collisions, 5); assert.equal(all.collisions, 1); assert.ok(all.cars[1].collided, 'el de justo detrás depende de su distancia');
  assert.equal(brakeChain({ gapS: 2 }).collisions, 0);
  const mixed = brakeChain({ gapS: 1.2, senda: [1, 0, 1, 0, 1, 1].map(Boolean) });
  assert.equal(mixed.cars[3].via, 'luces de freno'); assert.ok(mixed.collisions > all.collisions && mixed.collisions < no.collisions);
});

test('SOS por los coches que pasan: contacto casi seguro al cruzarse y entrega con cuotas bajas', () => {
  assert.ok(contactProbability({ rangeM: 60, relSpeedMs: 2 * 80 / 3.6 }).p > 0.99);
  const m = muleDelivery({ flowVehH: 600, share: 0.05, pContact: 0.99, travelMin: 7, withinMin: 20 }); assert.ok(m.pWithin > 0.99 && m.meanMin < 10, JSON.stringify(m));
  assert.equal(muleDelivery({ flowVehH: 600, share: 0, travelMin: 7 }).meanMin, Infinity);
});

test('carretera sin cobertura: con 10 % de coches con SENDA el SOS sale en minutos y los que se acercan se enteran a kilómetros', () => {
  const s = roadScenario();
  assert.ok(s.sosDeliveredMin !== null && s.sosDeliveredMin < 10, String(s.sosDeliveredMin));
  assert.ok(s.warned >= s.approachingSenda - 1 && s.medianWarnM > 2000, JSON.stringify({ w: s.warned, a: s.approachingSenda, m: s.medianWarnM }));
  const none = roadScenario({ share: 0 }); assert.equal(none.sosDeliveredMin, null);
  assert.ok(roadScenario({ seed: 3 }).sosDeliveredMin < 12, 'otra semilla, mismo orden de magnitud');
});

test('PK y sentido sin red, referencia visible y túnel por estima', () => {
  const { road, landmarks } = demoRoad();
  const fix = { ...pointAt(road, 7500), headingDeg: 40 }, loc = roadLocate(fix, road);
  assert.equal(loc.pk, 127.5); assert.equal(loc.sentido, 'creciente'); assert.ok(loc.crossM < 1);
  const back = roadLocate({ ...fix, headingDeg: 220 }, road); assert.equal(back.sentido, 'decreciente');
  assert.match(describePosition(fix, road, landmarks).full, /PK 127,5 .*300 m después del aerogenerador AE-12 \(a la derecha\)/);
  assert.equal(landmarksAlong(road, landmarks).length, 4);
  const dr = roadDeadReckon(road, { s: 7500, dir: 1, speedMs: 25, t: 0 }, 20); assert.equal(dr.s, 8000); assert.ok(Math.abs(dr.pk - 128) < 0.01);
});

test('mapas de la ruta: el pasillo de 2 km pesa menos de una décima parte del rectángulo', () => {
  const c = corridorTiles(ROUTE_MAD_VLC); assert.ok(c.ratio < 0.1 && c.corridorMB < 100, JSON.stringify({ r: c.ratio, mb: c.corridorMB }));
  const l = navLinks({ lat: 40.4169, lon: -3.7035 }); assert.match(l.waze, /^https:\/\/waze\.com\/ul\?ll=40\.4169,-3\.7035&navigate=yes/); assert.match(l.google, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=40\.4169,-3\.7035&travelmode=driving$/);
});

test('avisos de un toque: dos confirmaciones lo confirman, el tiempo y los «ya no está» lo retiran; CIFS solo tras validar', () => {
  assert.equal(reportBelief([{ atMin: 0, present: true }], 0, { hlMin: 20 }).state, 'PROBABLE');
  assert.equal(reportBelief([{ atMin: 0, present: true }, { atMin: 2, present: true }], 3, { hlMin: 20 }).state, 'CONFIRMADO');
  assert.equal(reportBelief([{ atMin: 0, present: true }], 30, { hlMin: 20 }).show, false);
  assert.equal(reportBelief([{ atMin: 0, present: true }, { atMin: 5, present: false }, { atMin: 6, present: false }], 7, { hlMin: 20 }).show, false);
  const c = toCifs({ id: 1, kind: 'accidente', lat: 40.9, lon: -2.4, roadId: 'N-000', sentido: 'creciente', startIso: '2026-11-05T22:41:00Z' });
  assert.equal(c.type, 'ACCIDENT'); assert.equal(c._validated, false);
});

test('SMS de SOS ≤160 y guion del 112 con PK, víctimas y atrapados', () => {
  const s = roadSosText({ where: 'N-000 PK 127,3 sentido creciente', lat: 40.95, lon: -2.36, vehicles: 2, people: 3, trapped: 1, hhmm: '23:41', auto: true });
  assert.ok(s.length <= 160); assert.match(s, /PK 127,3/);
  assert.match(call112Script({ where: 'la N-000, PK 127', vehicles: 2, people: 3, trapped: 1, counts: { ROJO: 1 } }), /2 vehículos y 3 personas: 1 grave\. 1 persona atrapada/);
});

test('coordinador de escena: PAS, nadie se confirma a sí mismo, traspaso solo a servicio verificado, puntos con cadena de huellas', async () => {
  const sc = createScene({ id: 'acc-1', at: 0, where: 'N-000 PK 127,5', coordinator: { userId: 'ana', trust: 'VOLUNTEER_UNVERIFIED', coordinator: true } });
  assert.equal(sceneAct(sc, { t: 5, who: 'luis', action: 'ASSIGN', task: 'avisar', to: 'luis' }).ok, false);
  sceneAct(sc, { t: 10, who: 'luis', action: 'JOIN' });
  sceneAct(sc, { t: 20, who: 'ana', action: 'ASSIGN', task: 'proteger', to: 'luis' }); sceneAct(sc, { t: 25, who: 'ana', action: 'ASSIGN', task: 'avisar', to: 'ana' });
  sceneAct(sc, { t: 60, who: 'luis', action: 'DONE', task: 'proteger' }); sceneAct(sc, { t: 70, who: 'ana', action: 'DONE', task: 'avisar' }); sceneAct(sc, { t: 70, who: 'ana', action: 'CALL112' });
  assert.equal(sceneAct(sc, { t: 80, who: 'ana', action: 'CONFIRM', task: 'avisar' }).ok, false, 'nadie se confirma a sí mismo');
  sceneAct(sc, { t: 80, who: 'ana', action: 'CONFIRM', task: 'proteger' });
  sceneAct(sc, { t: 90, who: 'ana', action: 'TRIAGE', victim: 'V1', result: startTriage({ walks: false, breathes: true, rr: 34 }) });
  assert.equal(sceneAct(sc, { t: 900, who: 'x', action: 'HANDOVER', actor: { userId: 'x', trust: 'CITIZEN' } }).ok, false);
  const gc = { userId: 'gc-1', trust: 'VERIFIED_INSTITUTIONAL', orgKind: 'POLICE', unit: 'Guardia Civil de Tráfico', coordinator: true };
  assert.equal(sceneAct(sc, { t: 960, who: 'gc-1', action: 'HANDOVER', actor: gc }).ok, true); assert.equal(sc.coordinator.userId, 'gc-1');
  assert.equal(sceneAct(sc, { t: 970, who: 'gc-1', action: 'CONFIRM', task: 'avisar', actor: gc }).ok, true);
  assert.match(sceneBrief(sc).text, /112 avisado 1:10/);
  const L = await civicLedger(sc);
  assert.equal(L.totals.luis, 10); assert.equal(L.totals.ana, 10 + 5 + 20 + 10);
  assert.ok(await verifyLedger(L.entries));
  const forged = L.entries.map((e) => ({ ...e })); forged[0].points = 999; assert.equal(await verifyLedger(forged), false);
});

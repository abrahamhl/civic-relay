/**
 * RoadSafe · Pruebas adversariales de los bloqueos P0 (auditoría 2026-11-17).
 * Cada prueba reproduce un ataque o un dato malformado y exige un comportamiento conservador.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeHazard, decodeHazard, relayHazard, hazardRelevance, brakeAdvice, HAZARD, HAZARD_BYTES, createScene, sceneAct, sceneBrief, call112Script, toCifs, EXAMPLE_RELAY, EXAMPLE_RELEVANCE, EXAMPLE_BRAKE_ADVICE } from '../src/road-guard.mjs';
import { parseDatex2, toHazard, toHazards, corridorPack } from '../src/datex2.mjs';
import { assessHazardFrame, createReplayCache, createFrameSigner, signHazardCapsule, relayCapsule, createTrustStore, CAPSULE_BYTES } from '../src/roadsafe-frame-trust.mjs';
import { validateCifs } from '../src/roadsafe-interop.mjs';

const me = { lat: 40.4, lon: -3.7 };
// Políticas DECLARADAS (regla de veracidad): ejemplos sin fuente verificada.
const RLY = EXAMPLE_RELAY, REL = EXAMPLE_RELEVANCE, BA = EXAMPLE_BRAKE_ADVICE;
const frame = (o = {}) => encodeHazard({ type: HAZARD.CRASH, t: 1000, lat: 40.4009, lon: -3.7, headingDeg: 0, speedMs: 0, decelMs2: 0, id: 77, ...o });

// ------------------------------------------------------------- P0-1 autenticidad, replay, plausibilidad
test('P0-1: una trama sin firma nunca supera ADVISORY ni puede disparar un aviso crítico', async () => {
  const r = await assessHazardFrame(frame(), { now: 1001, receiver: me, replayCache: createReplayCache() });
  assert.equal(r.trust, 'UNVERIFIED_PEER_HINT'); assert.equal(r.presentationCeiling, 'ADVISORY'); assert.equal(r.canTriggerCritical, false);
});
test('P0-1: repetición (replay) y relé del mismo evento se deduplican', async () => {
  const cache = createReplayCache();
  assert.equal((await assessHazardFrame(frame(), { now: 1001, receiver: me, replayCache: cache })).trust, 'UNVERIFIED_PEER_HINT');
  assert.equal((await assessHazardFrame(frame(), { now: 1002, receiver: me, replayCache: cache })).trust, 'DUPLICATE');
  assert.equal((await assessHazardFrame(relayHazard(frame(), RLY), { now: 1003, receiver: me, replayCache: cache })).trust, 'DUPLICATE', 'el relé (saltos+1) es el mismo evento');
});
test('P0-1: hora futura, trama caducada, sin reloj → rechazo', async () => {
  assert.equal((await assessHazardFrame(frame({ t: 2000 }), { now: 1000, receiver: me })).trust, 'REJECT_CLOCK');
  assert.equal((await assessHazardFrame(frame({ t: 900 }), { now: 1000, receiver: me })).trust, 'REJECT_STALE');
  assert.equal((await assessHazardFrame(frame(), { receiver: me })).trust, 'REJECT_CLOCK');
});
test('P0-1: posición inverosímil (a 50 km del receptor) y cinemática imposible → rechazo', async () => {
  assert.notEqual((await assessHazardFrame(frame({ lat: 40.85, id: 501 }), { now: 1001, receiver: me })).trust, 'REJECT_IMPLAUSIBLE', 'sin alcance de radio medido no se juzga la posición');
  assert.equal((await assessHazardFrame(frame({ lat: 40.85 }), { now: 1001, receiver: me, policy: { radioRangeM: 400 } })).trust, 'REJECT_IMPLAUSIBLE', 'con alcance declarado (escenario de prueba) sí');
  assert.equal((await assessHazardFrame(frame({ speedMs: 120 }), { now: 1001, receiver: me })).trust, 'REJECT_IMPLAUSIBLE');
  assert.equal((await assessHazardFrame(frame({ decelMs2: 24 }), { now: 1001, receiver: me })).trust, 'REJECT_IMPLAUSIBLE');
});
test('P0-1: tramas malformadas — tamaño, versión, coordenadas fuera de rango, tipo desconocido', async () => {
  assert.equal((await assessHazardFrame(new Uint8Array(23), { now: 1 })).trust, 'REJECT_MALFORMED');
  const badVer = frame(); badVer[0] = 0x20; assert.equal((await assessHazardFrame(badVer, { now: 1001 })).trust, 'REJECT_MALFORMED');
  const badLat = frame(); new DataView(badLat.buffer).setInt32(6, 1_000_000_000); assert.throws(() => decodeHazard(badLat), /coordenadas/);
  const unk = frame({ type: 200 }); assert.equal((await assessHazardFrame(unk, { now: 1001, receiver: me })).trust, 'REJECT_UNKNOWN_TYPE');
  assert.equal(relayHazard(unk, RLY), null, 'un relé no propaga tipos desconocidos');
  assert.equal(relayHazard(frame({ t: 100 }), { ...RLY, now: 1000 }), null, 'un relé no propaga tramas caducadas');
  assert.throws(() => decodeHazard([...frame()]), /tamaño/, 'un array normal no es una trama');
});
test('P0-1: cápsula firmada — válida, alterada, clave no inscrita, revocada; el relé no rompe la firma', async () => {
  const peer = await createFrameSigner(), auth = await createFrameSigner(), rogue = await createFrameSigner();
  const store = createTrustStore();
  await store.enroll(peer.publicKey, { role: 'PEER_DEVICE' }); const authId = await store.enroll(auth.publicKey, { role: 'AUTHORITY', label: 'Centro de tráfico (ejercicio)' });
  const cap = await signHazardCapsule(frame(), peer); assert.equal(cap.length, CAPSULE_BYTES);
  assert.equal((await assessHazardFrame(cap, { now: 1001, receiver: me, trustStore: store })).trust, 'SIGNED_PEER');
  assert.equal((await assessHazardFrame(relayCapsule(cap), { now: 1001, receiver: me, trustStore: store })).trust, 'SIGNED_PEER', 'saltos+1 no invalida la firma');
  const tampered = new Uint8Array(cap); tampered[19] ^= 0x01; // banderas
  assert.equal((await assessHazardFrame(tampered, { now: 1001, receiver: me, trustStore: store })).trust, 'REJECT_BAD_SIGNATURE');
  const a = await assessHazardFrame(await signHazardCapsule(frame({ id: 9 }), auth), { now: 1001, receiver: me, trustStore: store });
  assert.equal(a.trust, 'AUTHORITY_VERIFIED'); assert.equal(a.presentationCeiling, 'WARNING');
  assert.equal((await assessHazardFrame(await signHazardCapsule(frame({ id: 10 }), rogue), { now: 1001, receiver: me, trustStore: store })).trust, 'UNVERIFIED_PEER_HINT', 'clave sin inscribir = sin firma (anti-Sybil)');
  store.revoke(authId);
  assert.equal((await assessHazardFrame(await signHazardCapsule(frame({ id: 11 }), auth), { now: 1001, receiver: me, trustStore: store })).trust, 'REJECT_REVOKED_KEY');
});

// ------------------------------------------------------------- P0-2 topología / calzada / antigüedad
test('P0-2: corridorPack separa la calzada contraria, otra carretera y registros sin actualizar', () => {
  const route = [{ lat: 40.0, lon: -3.0 }, { lat: 40.1, lon: -3.0 }]; // hacia el norte
  const hz = [
    { id: 'same', lat: 40.05, lon: -3.0, road: 'A-3', line: [{ lat: 40.049, lon: -3.0 }, { lat: 40.051, lon: -3.0 }], start: '2026-11-17T10:00:00Z' },
    { id: 'opp', lat: 40.05, lon: -2.9997, road: 'A-3', line: [{ lat: 40.051, lon: -2.9997 }, { lat: 40.049, lon: -2.9997 }], start: '2026-11-17T10:00:00Z' },
    { id: 'pt', lat: 40.06, lon: -3.0, road: 'A-3', start: '2026-11-17T10:00:00Z' },
    { id: 'road', lat: 40.07, lon: -3.0, road: 'M-40', start: '2026-11-17T10:00:00Z' },
    { id: 'old', lat: 40.08, lon: -3.0, road: 'A-3', start: '2026-11-16T10:00:00Z' },
  ];
  const p = corridorPack(hz, route, { roadId: 'A-3', now: '2026-11-17T10:30:00Z', maxAgeS: 6 * 3600 });
  assert.deepEqual(p.hazards.map((h) => [h.id, h.carriageway]), [['same', 'SAME'], ['pt', 'UNKNOWN']]);
  assert.deepEqual(p.otherCarriageway.map((h) => h.id), ['opp']);
  assert.deepEqual(p.otherRoad.map((h) => h.id), ['road']);
  assert.deepEqual(p.stale.map((h) => h.id), ['old'], 'lo viejo se aparta pero no se borra');
});
test('P0-2/6: hazardRelevance sin reloj o con hora futura no avisa; misma carretera sentido contrario no avisa', () => {
  const m = { lat: 40.4, lon: -3.7, headingDeg: 0 }, h = { type: HAZARD.CRASH, t: 100, lat: 40.402, lon: -3.7, headingDeg: 0 };
  assert.equal(hazardRelevance(m, h, REL).relevant, false);
  assert.equal(hazardRelevance(m, { ...h, t: 200 }, { ...REL, now: 100 }).relevant, false);
  // Sentido del peligro con base fiable (geometría de la vía): el de la otra calzada no avisa.
  assert.equal(hazardRelevance({ ...m, roadId: 'A-3', s: 1000, dir: 1 }, { ...h, roadId: 'A-3', s: 1500, dir: -1, dirBasis: 'ROAD_GEOMETRY' }, { ...REL, now: 101 }).relevant, false);
  // Caso real (doc 18): un coche accidentado y girado 180° da un sentido falso; sin base fiable se avisa marcado como incierto.
  const spun = hazardRelevance({ ...m, roadId: 'A-3', s: 1000, dir: 1 }, { ...h, roadId: 'A-3', s: 1500, dir: -1, speedMs: 0 }, { ...REL, now: 101 });
  assert.equal(spun.relevant, true); assert.equal(spun.carriagewayUncertain, true);
});

// ------------------------------------------------------------- P0-3 consejo de frenada
test('P0-3: brakeAdvice describe, no ordena; declara que no está certificado; abstiene con entradas inválidas', () => {
  const a = brakeAdvice({ vMs: 33.3, distM: 200, hazardSpeedMs: 0 }, BA);
  assert.equal(a.level, 'FRENA'); assert.doesNotMatch(a.say, /¡?Frena!?/i); assert.match(a.say, /200 metros/);
  assert.equal(a.certified, false); assert.equal(a.advisoryOnly, true);
  assert.equal(brakeAdvice({ vMs: NaN, distM: 200, hazardSpeedMs: 0 }, BA).level, 'ABSTAIN');
  assert.equal(brakeAdvice({ vMs: 30, distM: -5, hazardSpeedMs: 0 }, BA).level, 'ABSTAIN');
  assert.equal(brakeAdvice({ vMs: 30, distM: 200 }, BA).level, 'ABSTAIN', 'sin velocidad del peligro no se supone que está parado');
  assert.throws(() => brakeAdvice({ vMs: 30, distM: 200, hazardSpeedMs: 0 }, { reactS: 1.5 }), /debe declararse/, 'política sin declarar = error, nunca un valor por defecto');
});

// ------------------------------------------------------------- P0-4 112
test('P0-4: CALL112 = llamada declarada; confirmación solo con referencia o actor verificado', () => {
  const sc = createScene({ id: 's', at: 0, where: 'A-3 PK 100', coordinator: { userId: 'ana' } });
  sceneAct(sc, { t: 10, who: 'ana', action: 'CALL112' });
  assert.equal(sceneBrief(sc).call112, 'LOGGED_NOT_CONFIRMED'); assert.doesNotMatch(sceneBrief(sc).text, /avisado/);
  sceneAct(sc, { t: 12, who: 'ana', action: 'CALL112_STARTED' }); assert.equal(sceneBrief(sc).call112, 'DIALER_OPENED_NOT_CONFIRMED');
  assert.equal(sceneAct(sc, { t: 20, who: 'ana', action: 'CALL112_CONFIRMED' }).ok, false, 'sin referencia no hay confirmación');
  assert.equal(sceneAct(sc, { t: 21, who: 'ana', action: 'CALL112_CONFIRMED', result: { reference: '   ' } }).ok, false);
  assert.equal(sceneAct(sc, { t: 22, who: 'ana', action: 'CALL112_CONFIRMED', result: { reference: '112-EXP-0001' } }).ok, true);
  assert.equal(sceneBrief(sc).call112, 'EXTERNALLY_CONFIRMED');
  assert.doesNotMatch(call112Script({ where: 'A-3' }), /V16/, 'no afirma una V16 que nadie ha declarado');
  assert.match(call112Script({ where: 'A-3', v16: true }), /V16/);
});

// ------------------------------------------------------------- P0-5 DATEX II
test('P0-5: DATEX II malformado, coordenadas inválidas, tipo desconocido, probabilidad y fin de validez', () => {
  assert.throws(() => parseDatex2(null), TypeError);
  assert.deepEqual(parseDatex2('<no-xml'), []);
  const rec = (type, extra = '') => `<situationRecord id="r-${type}" version="1" xsi:type="${type}"><validity><validityStatus>active</validityStatus></validity>${extra}</situationRecord>`;
  const xml = rec('Accident', '<latitude>NaN</latitude><longitude>5</longitude>') + rec('Accident', '<latitude>95</latitude><longitude>5</longitude>') + rec('SpaceWeatherEvent', '<latitude>52</latitude><longitude>5</longitude>') + rec('Accident', '<probabilityOfOccurrence>riskOf</probabilityOfOccurrence><latitude>52</latitude><longitude>5</longitude>') + rec('Accident', '<overallEndTime>2026-11-17T09:00:00Z</overallEndTime><latitude>52</latitude><longitude>5</longitude>');
  const r = parseDatex2(xml);
  assert.equal(r[0].lat, null); assert.ok(r[0].issues.includes('COORDENADAS_NO_VALIDAS'));
  assert.equal(r[1].lat, null, 'latitud 95 descartada');
  const unk = toHazard(r[2]); assert.equal(unk.type, null); assert.equal(unk.kind, 'UNKNOWN_DATEX_TYPE'); assert.equal(unk.confirmed, false, 'tipo desconocido ≠ peligro confirmado');
  assert.equal(toHazard(r[3]).confirmed, false, 'riskOf no es confirmado');
  assert.equal(toHazard(r[4], { now: '2026-11-17T10:00:00Z' }).active, false, 'validez terminada');
  assert.equal(toHazards(r, { now: '2026-11-17T10:00:00Z' }).length, 2, 'sin coordenadas o terminados no se avisan; desconocido y riskOf se conservan como información');
  const noStatus = toHazard(parseDatex2('<situationRecord id="x" xsi:type="Accident"><latitude>52</latitude><longitude>5</longitude></situationRecord>')[0]);
  assert.equal(noStatus.validity, 'UNSTATED'); assert.equal(noStatus.active, true, 'información oficial sin estado: no se oculta'); assert.equal(noStatus.confirmed, false);
});
test('P0-5: entrada hostil — XML enorme rechazado, inyección en comentario no rompe el lector', () => {
  assert.throws(() => parseDatex2('x'.repeat(11), { maxBytes: 10 }), RangeError);
  const r = parseDatex2('<situationRecord id="a" xsi:type="Accident"><validity><validityStatus>active</validityStatus></validity><latitude>52</latitude><longitude>5</longitude><value>&lt;script&gt;</value></situationRecord>');
  assert.equal(r.length, 1); assert.equal(r[0].comment, '&lt;script&gt;', 'el texto se conserva escapado: la UI lo pinta como texto');
});

// ------------------------------------------------------------- P0-6 supresión conservadora
test('P0-6: lo caducado/contradictorio/sin procedencia se suprime sin ocultar información oficial válida', async () => {
  const { warningDecision } = await import('../src/roadsafe-secondary-risk.mjs');
  assert.equal(warningDecision({ trustCeiling: 'NONE', timeToHazardS: 30, confidenceP: 0.99 }).level, 'SUPPRESS', 'sin procedencia');
  assert.equal(warningDecision({ trustCeiling: 'ADVISORY', timeToHazardS: 30, confidenceP: 0.3 }).level, 'ABSTAIN', 'contradictorio/baja confianza');
  assert.equal(warningDecision({ trustCeiling: 'WARNING', timeToHazardS: 30, confidenceP: 0.3, official: true, carriageway: 'SAME', posErrM: 10 }).level, 'ADVISORY', 'oficial con baja confianza se muestra como información');
  const h = toHazards(parseDatex2('<situationRecord id="o" xsi:type="Accident"><validity><validityStatus>active</validityStatus></validity><latitude>40.05</latitude><longitude>-3</longitude></situationRecord>'));
  const p = corridorPack(h, [{ lat: 40, lon: -3 }, { lat: 40.1, lon: -3 }], { now: '2026-11-17T10:00:00Z', maxAgeS: 60 });
  assert.equal(p.hazards.length, 1, 'oficial sin hora de versión no se marca como caducado');
});

test('CIFS: tipo inexistente CONSTRUCTION corregido y validación de la especificación', () => {
  const c = toCifs({ id: 1, kind: 'obras', lat: 40.9, lon: -2.4, roadId: 'N-000', sentido: 'creciente', startIso: '2026-11-05T22:41:00.123Z' });
  assert.equal(c.type, 'HAZARD'); assert.equal(c.starttime, '2026-11-05T22:41:00+00:00');
  assert.equal(validateCifs({ ...c, type: 'CONSTRUCTION' }).valid, false);
  assert.equal(validateCifs(c).valid, true);
  assert.equal(HAZARD_BYTES, 24);
});

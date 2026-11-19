/**
 * Caso real de regresión (doc 18): declaración de UNA de las partes, anonimizada y NO verificada.
 * Autopista en Bélgica: la esquina de la cabina de un camión golpea el lateral izquierdo de un turismo que
 * circula por el carril derecho; el turismo queda empujado contra el frontal del camión, es arrastrado varios
 * metros (atravesado), sale despedido hacia la izquierda, gira ~180°, golpea la barrera izquierda y queda
 * inmovilizado en el carril rápido mirando contra el tráfico. El camión acaba en el arcén derecho. Sin heridos graves.
 *
 * No hay medidas (velocidades, tiempos, distancias): NO calibra ningún umbral. Fija PROPIEDADES que SENDA debe
 * cumplir ante esta secuencia. Las trazas GNSS de abajo son SINTÉTICAS (solo forma, ningún valor es del accidente).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hazardRelevance, travelHeadingBefore, encodeHazard, decodeHazard, HAZARD, HAZARD_FLAGS, EXAMPLE_RELEVANCE, call112Script } from '../src/road-guard.mjs';
import { wrongWayCheck, mountainRoad, EXAMPLE_WRONG_WAY, EXAMPLE_MOUNTAIN_ROAD } from '../src/drive-cases.mjs';
import { createIncident, observe, publicView } from '../src/roadsafe-incident-twin.mjs';
import { decideStayOrExit } from '../src/roadsafe-guidance.mjs';

const REL = EXAMPLE_RELEVANCE; // política de EJEMPLO declarada (sin fuente verificada)
const at = (dn, de) => ({ lat: 40 + dn / 111320, lon: -3 + de / (111320 * Math.cos((40 * Math.PI) / 180)) });
const approaching = { lat: 40, lon: -3, headingDeg: 0 }; // coche que llega por detrás, misma calzada

test('caso HGV · el coche girado 180° o atravesado en el carril rápido SIGUE avisando a quien llega por detrás', () => {
  for (const facing of [0, 90, 180, 270]) {
    const r = hazardRelevance(approaching, { ...at(400, -7), type: HAZARD.CRASH, t: 100, headingDeg: facing, speedMs: 0 }, { ...REL, now: 101 });
    assert.equal(r.relevant, true, `orientación ${facing}°: ${r.why}`);
    assert.equal(r.carriagewayUncertain, true, 'sin rumbo de marcha la calzada se declara incierta, no se inventa');
  }
});

test('caso HGV · el móvil accidentado envía el rumbo de MARCHA previo: la otra calzada ya no recibe falsa alarma', () => {
  // SINTÉTICO: 10 s a 30 m/s rumbo 0°, choque en t=10, luego deriva, giro y reposo.
  const gps = [...Array.from({ length: 10 }, (_, t) => ({ t, speed: 30, headingDeg: t % 2 ? 359 : 1 })), { t: 11, speed: 9, headingDeg: 300 }, { t: 12, speed: 3, headingDeg: 230 }, { t: 14, speed: 0, headingDeg: 180 }];
  const pre = travelHeadingBefore(gps, 10, { minSpeedMs: 5, windowS: 8 });
  assert.ok(pre && (pre.headingDeg < 1 || pre.headingDeg > 359), JSON.stringify(pre));
  assert.equal(travelHeadingBefore([{ t: 11, speed: 0, headingDeg: 180 }], 10, { minSpeedMs: 5, windowS: 8 }), null, 'sin marcha previa no se inventa rumbo');
  assert.throws(() => travelHeadingBefore(gps, 10, {}), /debe declararse/);
  const frame = decodeHazard(encodeHazard({ type: HAZARD.CRASH, t: 100, ...at(400, -7), headingDeg: pre.headingDeg, speedMs: 0, flags: HAZARD_FLAGS.TRAVEL_HEADING }));
  assert.equal(hazardRelevance(approaching, frame, { ...REL, now: 101 }).relevant, true, 'misma calzada: aviso');
  const oncoming = { ...at(800, -20), headingDeg: 180 };
  assert.equal(hazardRelevance(oncoming, frame, { ...REL, now: 101 }).relevant, false, 'calzada contraria: sin falsa alarma');
});

test('caso HGV · un coche inmovilizado mirando contra el tráfico NO es un «kamikaze»', () => {
  const r = mountainRoad(EXAMPLE_MOUNTAIN_ROAD);
  const fixes = [0, 1, 2, 3, 4].map((t) => ({ lat: r.points[5].lat, lon: r.points[5].lon, headingDeg: 180, speed: 0, t }));
  assert.equal(wrongWayCheck(fixes, r, EXAMPLE_WRONG_WAY).wrongWay, false);
});

test('caso HGV · dos vehículos en sitios distintos: el aviso público muestra el carril rápido, no el arcén del camión', async () => {
  const inc = await createIncident({ obsId: 'truck', source: 'V16_BEACON', rootHint: 'B-T', at: 0, lat: 40.0001, lon: -3.0001, accuracyM: 8, laneHint: 'SHOULDER' }, { now: 1, kind: 'CRASH' });
  assert.equal(publicView(inc).location.lane, 'SHOULDER');
  await observe(inc, { obsId: 'car', source: 'SENDA_OWNER_DECLARATION', rootHint: 'CAR', at: 2, lat: 40.0001, lon: -3.0002, accuracyM: 10, laneHint: 'LEFT_LANE' }, { now: 3 });
  const pub = publicView(inc).location;
  assert.equal(pub.lane, 'LEFT_LANE'); assert.equal(pub.liveLaneBlocked, true);
  assert.deepEqual(pub.occupiedLanes, ['LEFT_LANE', 'SHOULDER']);
  assert.equal(inc.location.lane.p, null, 'una pista declarada no lleva probabilidad inventada');
});

test('caso HGV · guion del 112 con carril y orientación solo si se declaran; guía en carril de circulación', () => {
  const s = call112Script({ where: 'autopista, sentido creciente', vehicles: 2, lane: 'LEFT_LANE', againstTraffic: true });
  assert.match(s, /carril izquierdo \(rápido\), orientado contra la circulación/);
  assert.match(s, /No se sabe aún si hay personas atrapadas/, 'sin declarar atrapados no se afirma nada');
  assert.doesNotMatch(call112Script({ where: 'A-3' }), /carril|orientado/);
  const g = decideStayOrExit({ inLane: true, fire: false, trapped: false });
  assert.equal(g.priority, 'HIGH'); assert.equal(g.call112.automatic, false);
});

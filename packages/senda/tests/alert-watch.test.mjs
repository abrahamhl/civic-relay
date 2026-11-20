import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../src/alert-watch.mjs';

const FX = new URL('./fixtures/alertas/', import.meta.url);
const read = (f) => readFileSync(new URL(f, FX), 'utf8');
const ZONES = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/alertas/zonas-emma-es-nl.json', import.meta.url), 'utf8')).zonas;
const NOW = Date.parse('2026-11-20T18:15:00Z');

test('CAP 1.2 real de AEMET: cabecera, actualización con referencia, dos idiomas y zona EMMA_ID', () => {
  const c = W.parseCapDocument(read('aemet-cap.xml'));
  assert.equal(c.sender, 'http://www.aemet.es'); assert.equal(c.status, 'Actual'); assert.equal(c.msgType, 'Update');
  assert.equal(c.references.length, 1); assert.equal(c.references[0].sender, 'http://www.aemet.es');
  assert.deepEqual(c.infos.map((i) => i.language), ['es-ES', 'en-GB']);
  assert.equal(c.infos[0].areas[0].geocodes[0].value, 'ES215');
  const [a] = W.fromCap(read('aemet-cap.xml'), ZONES);
  assert.equal(a.kind, 'WIND'); assert.equal(a.severity, 'MODERATE'); assert.equal(a.msgType, 'UPDATE');
  assert.equal(a.geometry.type, 'POLYGONS', 'la zona se resuelve con la tabla EMMA_ID');
  assert.equal(W.distanceToAreaKm(a.point, a), 0, 'el centroide de Rías Baixas cae dentro de su polígono');
  assert.equal(W.phaseOf(a, NOW), 'FORECAST', 'el aviso empieza a las 00:00 del 21: está PREVISTO');
});

test('MeteoAlarm Atom real: todas las entradas con zona y punto; tipo y nivel', () => {
  const xs = W.fromMeteoalarmAtom(read('meteoalarm-es.xml'), ZONES);
  assert.equal(xs.length, 6);
  for (const a of xs) { assert.ok(a.point, a.geocode); assert.match(a.id, /^METEOALARM:/); assert.ok(W.ALERT_KINDS.includes(a.kind)); }
  assert.ok(xs.some((a) => ['Yellow', 'Orange', 'Red'].includes(a.level)));
});

test('USGS, EMSC, GDACS y EONET reales se normalizan; el mismo terremoto de USGS y EMSC se fusiona', () => {
  const u = W.fromUsgs(JSON.parse(read('usgs.json'))), e = W.fromEmsc(JSON.parse(read('emsc.json')));
  const g = W.fromGdacs(JSON.parse(read('gdacs.json'))), o = W.fromEonet(JSON.parse(read('eonet.json')));
  for (const a of [...u, ...e, ...g, ...o]) { assert.ok(Number.isFinite(a.point.lat) && Number.isFinite(a.point.lon)); assert.ok(W.ALERT_SOURCES[a.source]); }
  assert.equal(u[0].nature, 'OBSERVATION'); assert.equal(g[0].nature, 'AUTOMATED_ALERT'); assert.equal(o[0].nature, 'EVENT_CATALOG');
  assert.equal(g[0].onset, '2026-11-20T17:53:15.000Z', 'GDACS da la hora sin zona: se interpreta en UTC');
  assert.equal(W.phaseOf(g[0], NOW), 'OBSERVED', 'GDACS verde no cuenta como alerta vigente');
  assert.equal(W.phaseOf({ ...g[0], level: 'Orange' }, NOW), 'ACTIVE');
  const fused = W.fuseEvents([...u, ...e], W.EXAMPLE_ALERT_FUSION);
  const vanuatu = fused.find((x) => x.sources.length > 1);
  assert.ok(vanuatu, 'Vanuatu M5.1 publicado por USGS y EMSC queda como un solo evento');
  assert.deepEqual(vanuatu.sources.sort(), ['EMSC', 'USGS']);
  assert.throws(() => W.fuseEvents(u, { maxKm: 100 }), /declararse/);
});

test('fases: previsto, activo, caducado, ejercicio y cancelado', () => {
  const base = { nature: 'OFFICIAL_WARNING', status: 'ACTUAL', msgType: 'ALERT' };
  assert.equal(W.phaseOf({ ...base, onset: '2026-11-21T00:00:00Z', expires: '2026-11-21T06:00:00Z' }, NOW), 'FORECAST');
  assert.equal(W.phaseOf({ ...base, onset: '2026-11-20T10:00:00Z', expires: '2026-11-21T06:00:00Z' }, NOW), 'ACTIVE');
  assert.equal(W.phaseOf({ ...base, onset: '2026-11-19T10:00:00Z', expires: '2026-11-20T06:00:00Z' }, NOW), 'EXPIRED');
  assert.equal(W.phaseOf({ ...base, status: 'EXERCISE' }, NOW), 'EXERCISE');
  assert.equal(W.phaseOf({ ...base, msgType: 'CANCEL' }, NOW), 'CANCELLED');
  assert.equal(W.phaseOf({ nature: 'OBSERVATION', status: 'ACTUAL', onset: '2026-11-20T17:53:15Z' }, NOW), 'OBSERVED');
});

test('cambios entre lecturas: nuevo, actualizado, cancelado y desaparecido', () => {
  const a = { id: 'A', title: 'x', severity: 'MODERATE', msgType: 'ALERT' }, b = { id: 'B', title: 'y', severity: 'MINOR', msgType: 'ALERT' }, c = { id: 'C', title: 'z', severity: 'SEVERE', msgType: 'ALERT' };
  const d = W.diffSnapshots([a, b, c], [{ ...a }, { ...b, severity: 'SEVERE' }, { ...c, msgType: 'CANCEL' }, { id: 'D', title: 'w', msgType: 'ALERT' }]);
  assert.deepEqual(d.created.map((x) => x.id), ['D']); assert.deepEqual(d.updated.map((x) => x.id), ['B']);
  assert.deepEqual(d.cancelled.map((x) => x.id), ['C']); assert.deepEqual(d.gone, []);
  assert.deepEqual(W.diffSnapshots([a], []).gone.map((x) => x.id), ['A']);
});

test('geometría: círculo y polígono (avisos SINTÉTICOS de prueba)', () => {
  const sq = { geometry: { type: 'POLYGONS', rings: [[[-4, 40], [-3, 40], [-3, 41], [-4, 41], [-4, 40]]] } };
  assert.equal(W.distanceToAreaKm({ lat: 40.5, lon: -3.5 }, sq), 0);
  const d = W.distanceToAreaKm({ lat: 40.5, lon: -2.9 }, sq); // 0,1° al este del borde x = −3 a 40,5° N ≈ 8,5 km
  assert.ok(Math.abs(d - 0.1 * 111.32 * Math.cos(40.5 * Math.PI / 180)) < 0.05, `${d}`);
  const circle = W.fromCap(`<alert><identifier>T-1</identifier><status>Actual</status><msgType>Alert</msgType><info><event>Flood warning</event><severity>Severe</severity><area><areaDesc>Prueba</areaDesc><circle>39.47,-0.38 5</circle></area></info></alert>`)[0];
  assert.equal(circle.kind, 'FLOOD'); assert.equal(circle.geometry.type, 'CIRCLE');
  assert.equal(W.distanceToAreaKm({ lat: 39.47, lon: -0.38 }, circle), 0);
  const poly = W.fromCap(`<alert><identifier>T-2</identifier><status>Actual</status><msgType>Alert</msgType><info><event>Incendio forestal</event><severity>Extreme</severity><area><areaDesc>Prueba</areaDesc><polygon>40.3,-4.5 40.3,-4.3 40.45,-4.3 40.45,-4.5 40.3,-4.5</polygon></area></info></alert>`)[0];
  assert.equal(poly.kind, 'FIRE'); assert.equal(W.distanceToAreaKm({ lat: 40.36, lon: -4.39 }, poly), 0);
});

test('activación: dentro, testigos, pasarelas y ayuda solo con consentimiento; ejercicios y avisos leves no despiertan', () => {
  const fire = { id: 'F', nature: 'OFFICIAL_WARNING', kind: 'FIRE', severity: 'SEVERE', status: 'ACTUAL', msgType: 'ALERT', onset: '2026-11-20T17:00:00Z', expires: '2026-11-21T17:00:00Z',
    geometry: { type: 'POLYGONS', rings: [[[-4.5, 40.3], [-4.3, 40.3], [-4.3, 40.45], [-4.5, 40.45], [-4.5, 40.3]]] }, point: { lat: 40.37, lon: -4.4 } };
  const all = { verify: true, relay: true, help: true };
  const devices = [
    { id: 'dentro', lat: 40.36, lon: -4.39, consent: all, uplink: false, speedMs: 0 },
    { id: 'testigo', lat: 40.36, lon: -4.25, consent: { verify: true }, uplink: false, speedMs: 0 },
    { id: 'pasarela', lat: 40.36, lon: -4.25, consent: { relay: true }, uplink: true, speedMs: 0 },
    { id: 'coche', lat: 40.36, lon: -4.2, consent: { help: true }, uplink: false, speedMs: 25 },
    { id: 'sin-permiso', lat: 40.36, lon: -4.25, consent: {}, uplink: true, speedMs: 25 },
    { id: 'lejos', lat: 41.5, lon: -4.39, consent: all, uplink: true, speedMs: 1 },
  ];
  const plan = W.planActivation(fire, devices, W.EXAMPLE_ALERT_POLICY, NOW);
  const by = Object.fromEntries(plan.roles.map((r) => [r.id, r.roles]));
  assert.deepEqual(by.dentro, ['IN_AREA']); assert.deepEqual(by.testigo, ['VERIFIER']); assert.deepEqual(by.pasarela, ['RELAY']); assert.deepEqual(by.coche, ['HELPER']);
  assert.equal(by['sin-permiso'], undefined, 'sin consentimiento no recibe ninguna petición'); assert.equal(by.lejos, undefined);
  assert.equal(plan.canPublicWarn, false);
  assert.equal(W.planActivation({ ...fire, status: 'EXERCISE' }, devices, W.EXAMPLE_ALERT_POLICY, NOW).wake, false);
  assert.equal(W.planActivation({ ...fire, severity: 'MINOR' }, devices, W.EXAMPLE_ALERT_POLICY, NOW).wake, false);
  const fc = W.planActivation({ ...fire, onset: '2026-11-21T06:00:00Z' }, devices, W.EXAMPLE_ALERT_POLICY, NOW);
  assert.equal(fc.phase, 'FORECAST'); assert.ok(fc.prepare.includes('ENABLE_GATEWAYS_IF_CONSENTED'), 'con un aviso previsto se preparan pasarelas ANTES');
  const quake = { id: 'Q', nature: 'OBSERVATION', kind: 'EARTHQUAKE', severity: 'UNKNOWN', status: 'ACTUAL', onset: '2026-11-20T18:10:00Z', point: { lat: 40.36, lon: -4.39 }, geometry: null };
  assert.equal(W.planActivation(quake, devices, W.EXAMPLE_ALERT_POLICY, NOW).wake, true, 'un terremoto observado despierta aunque no traiga severidad');
  assert.throws(() => W.planActivation(fire, devices, { ringKm: 5 }, NOW), /declararse/);
});

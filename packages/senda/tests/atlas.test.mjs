import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineM, pointInPolygon, inArea, ringAreaKm2, convexHull, makeEvent, filterEvents, timeline, areaStats, growth, toGeoJSON, eventsFromGoes, eventsFromCameras, eventsFromReports, eventsFromGdacs, GDACS_TYPES, eventsFromDgt, DGT_CAUSES } from '../src/atlas.mjs';
import { parseDatex2 } from '../src/datex2.mjs';
import { createReporterKeys, encodeReport, decodeReports } from '../src/hazard-reports.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ref = (f) => JSON.parse(readFileSync(resolve(here, '../../../investor-next/public/senda/data/referencias', f), 'utf8'));

test('haversine: 1° de meridiano ≈ 111,2 km', () => {
  assert.ok(Math.abs(haversineM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 111_195) < 5);
});

test('punto en polígono y círculo; un polígono degenerado se rechaza', () => {
  const sq = [[0, 0], [0, 1], [1, 1], [1, 0]];
  assert.equal(pointInPolygon({ lat: 0.5, lon: 0.5 }, sq), true);
  assert.equal(pointInPolygon({ lat: 1.5, lon: 0.5 }, sq), false);
  assert.equal(inArea({ lat: 0, lon: 0.01 }, { type: 'circle', center: { lat: 0, lon: 0 }, radiusM: 1200 }), true);
  assert.equal(inArea({ lat: 0, lon: 0.02 }, { type: 'circle', center: { lat: 0, lon: 0 }, radiusM: 1200 }), false);
  assert.throws(() => inArea({ lat: 0, lon: 0 }, { type: 'polygon', ring: [[0, 0], [1, 1]] }));
});

test('área de anillo: cuadrado de 0,1° en el ecuador ≈ 123,6 km²', () => {
  const a = ringAreaKm2([[0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0]]);
  assert.ok(Math.abs(a - 123.6) < 0.5, a);
});

test('envolvente convexa descarta los puntos interiores', () => {
  const h = convexHull([{ lat: 0, lon: 0 }, { lat: 0, lon: 2 }, { lat: 2, lon: 2 }, { lat: 2, lon: 0 }, { lat: 1, lon: 1 }]);
  assert.equal(h.length, 4);
});

test('un evento sin fuente o sin base declarada no se admite', () => {
  assert.throws(() => makeEvent({ t: 0, lat: 0, lon: 0, kind: 'X', basis: 'SIMULATION' }), /fuente/);
  assert.throws(() => makeEvent({ t: 0, lat: 0, lon: 0, kind: 'X', source: 'y' }), /base/);
  assert.throws(() => makeEvent({ t: 'no', lat: 0, lon: 0, kind: 'X', source: 'y', basis: 'SIMULATION' }), /fecha/);
});

test('GOES real · Camp Fire: línea de tiempo, perímetro y crecimiento calculados', () => {
  const goes = ref('goes_casos.json');
  const ev = eventsFromGoes(goes, { cases: ['camp'] });
  const total = goes.casos.camp.frames.reduce((s, f) => s + f.det.length, 0);
  assert.equal(ev.length, total);
  assert.ok(ev.every((e) => e.basis === 'MEASURED_SATELLITE' && /GOES/.test(e.source)));
  const first = Math.min(...ev.map((e) => e.t));
  assert.equal(new Date(first).toISOString(), '2018-11-08T14:57:18.000Z'); // primera detección registrada en el repo
  const bins = timeline(ev, { binMs: 3_600_000 });
  assert.equal(bins.reduce((s, b) => s + b.n, 0), ev.length);
  // Paradise (centro aprox. 39.7596, -121.6219): radio de 5 km
  const area = { type: 'circle', center: { lat: 39.7596, lon: -121.6219 }, radiusM: 5000 };
  const inside = filterEvents(ev, { area });
  assert.ok(inside.length > 0 && inside.length < ev.length);
  const st = areaStats(inside);
  assert.ok(st.first > first, 'el fuego llega a Paradise después de la primera detección');
  const g = growth(ev, { binMs: 3_600_000 });
  assert.equal(g.at(-1).n, ev.length);
  for (let i = 1; i < g.length; i++) { assert.ok(g[i].hullKm2 >= g[i - 1].hullKm2 - 1e-9); assert.ok(g[i].reachKm >= g[i - 1].reachKm); }
});

test('cámaras: TfL y Caltrans se cargan con su fuente y su recuento', () => {
  const ev = eventsFromCameras(ref('tfl_camaras.json'), ref('referencias.json').caltrans);
  assert.ok(ev.some((e) => e.group === 'london') && ev.some((e) => e.group === 'camp'));
  assert.ok(ev.every((e) => e.basis === 'MEASURED_CAMERA'));
});

test('reportes ciudadanos firmados entran como «firmado, no verificado» y se exportan a GeoJSON', async () => {
  const k = await createReporterKeys();
  const line = await encodeReport({ kind: 'PERSON_TRAPPED', lat: 39.44, lon: -0.41, at: Date.parse('2026-11-14T10:00:00Z'), people: { trapped: 2, injured: 0 } }, k);
  const { reports } = await decodeReports(line);
  const ev = eventsFromReports(reports);
  assert.equal(ev[0].basis, 'CITIZEN_SIGNED_UNVERIFIED');
  assert.equal(ev[0].value, 2);
  const gj = toGeoJSON(ev, { area: { type: 'polygon', ring: [[39, -1], [40, -1], [40, 0]] } });
  assert.deepEqual(gj.features[0].geometry.coordinates, [-0.41, 39.44]);
  const poly = gj.features[1].geometry.coordinates[0];
  assert.deepEqual(poly[0], poly.at(-1));
});

test('GDACS real: cada alerta lleva fuente oficial, tipo conocido y coordenadas; procedencia con SHA-256 por página', () => {
  const snap = ref('gdacs_eventos.json');
  assert.ok(snap.paginas.length >= 1 && snap.paginas.every((p) => /^[0-9a-f]{64}$/.test(p.sha256) && p.url.startsWith('https://www.gdacs.org/')));
  const ev = eventsFromGdacs(snap);
  assert.equal(ev.length, snap.total);
  assert.ok(ev.every((e) => e.basis === 'OFFICIAL_ALERT' && /GDACS/.test(e.source) && GDACS_TYPES[e.kind.slice(6)]));
  const bins = timeline(ev, { binMs: 86_400_000 });
  assert.equal(bins.reduce((s, b) => s + b.n, 0), ev.length);
});

test('DGT real: incidencias de nap.dgt.es leídas con el lector DATEX II del núcleo, con fuente oficial', () => {
  const snap = ref('dgt_incidencias.json');
  assert.match(snap.url, /^https:\/\/nap\.dgt\.es\//); assert.match(snap.sha256Xml, /^[0-9a-f]{64}$/);
  const ev = eventsFromDgt(snap);
  assert.ok(ev.length > 0 && ev.length <= snap.total);
  assert.ok(ev.every((e) => e.basis === 'OFFICIAL_ALERT' && /DGT/.test(e.source) && DGT_CAUSES[e.kind.slice(4)]));
  assert.ok(ev.every((e) => e.lat > 27 && e.lat < 44.5 && e.lon > -18.5 && e.lon < 4.5), 'todas dentro de España (con Canarias)');
});

test('lector DATEX II: entiende el perfil real de la DGT (v3.7) con namespaces levelC', () => {
  const xml = `<d2:payload xmlns:com="http://levelC/schema/3/common" xmlns:loc="http://levelC/schema/3/locationReferencing" xmlns:d2="http://levelC/schema/3/d2Payload" xmlns:sit="http://levelC/schema/3/situation" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="sit:SituationPublication">
  <sit:situation id="1"><sit:situationRecord xsi:type="sit:RoadOrCarriagewayOrLaneManagement" id="18811074" version="2">
  <sit:situationRecordCreationTime>2025-12-12T08:11:34.000+01:00</sit:situationRecordCreationTime>
  <sit:validity><com:validityStatus>active</com:validityStatus><com:validityTimeSpecification><com:overallStartTime>2025-12-12T08:05:19.000+01:00</com:overallStartTime></com:validityTimeSpecification></sit:validity>
  <sit:cause><sit:causeType>roadMaintenance</sit:causeType></sit:cause>
  <sit:locationReference xsi:type="loc:SingleRoadLinearLocation"><loc:supplementaryPositionalDescription><loc:roadInformation><loc:roadName>N-400</loc:roadName></loc:roadInformation></loc:supplementaryPositionalDescription>
  <loc:tpegLinearLocation><loc:to xsi:type="loc:TpegNonJunctionPoint"><loc:pointCoordinates><loc:latitude>39.994446</loc:latitude><loc:longitude>-3.6054852</loc:longitude></loc:pointCoordinates></loc:to></loc:tpegLinearLocation></sit:locationReference>
  </sit:situationRecord></sit:situation></d2:payload>`;
  const [r] = parseDatex2(xml); // fragmento recortado de un registro real (id 18811074) de la publicación de la DGT del 14-11-2026
  assert.equal(r.road, 'N-400'); assert.equal(r.lat, 39.994446); assert.equal(r.subtypes.causeType[0], 'roadMaintenance');
});

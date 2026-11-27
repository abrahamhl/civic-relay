import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMadridKml, parseEuskadi, parseRws, parseBrussels, parseAutobahn, fromDgt, mergeCameras, CAMERA_SOURCES } from '../src/public-cameras.mjs';

test('cada fuente tiene licencia y país', () => { for (const s of Object.values(CAMERA_SOURCES)) { assert.ok(s.license && s.cc && s.url); } });

test('Madrid: KML con imagen pública', () => {
  const kml = `<Placemark><description>&lt;img src=https://informo.madrid.es/cameras/Camara06303.jpg?v=66003  width=300/&gt;</description><ExtendedData><Data name="Numero"><Value>06303</Value></Data><Data name="Nombre"><Value>PLAZA DE CASTILLA (NORTE)</Value></Data></ExtendedData><Point><coordinates>-3.68894207537291,40.466063829633,10 </coordinates></Point></Placemark>`;
  const [c] = parseMadridKml(kml);
  assert.equal(c.img, 'https://informo.madrid.es/cameras/Camara06303.jpg'); assert.equal(c.name, 'PLAZA DE CASTILLA (NORTE)'); assert.ok(Math.abs(c.lat - 40.46606) < 1e-4);
});

test('Euskadi: UTM huso 30 → WGS84 en el País Vasco; solo ubicación', () => {
  const [c] = parseEuskadi([{ cameraId: '75', sourceId: '2', cameraName: 'DOMO 232', latitude: '4792953.64', longitude: '507650.15', road: 'N - 637', kilometer: '016+500' }]);
  assert.ok(c.lat > 43.2 && c.lat < 43.4 && c.lon > -3.0 && c.lon < -2.8, `${c.lat},${c.lon}`); assert.equal(c.img, null); assert.equal(c.road, 'N-637 · PK 016+500');
});

test('Rijkswaterstaat, Bruselas, Autobahn y DGT', () => {
  assert.equal(parseRws([{ id: 4, latitude: '52.185241', longitude: '5.41449', road: 'A1', near: 'Amersfoort', static_url: 'https://stream.inmoves.nl/62' }])[0].page, 'https://stream.inmoves.nl/62');
  assert.equal(parseBrussels([{ id_reg_iot: 'iot_1', name_nl: 'Webcam - Grote Markt', geo_point: { lat: 50.846, lon: 4.353 }, url_nl: 'https://www.brussel.be/webcam-grote-markt' }])[0].cc, 'BE');
  assert.deepEqual(parseAutobahn('A1', { webcam: [] }), []);
  const d = fromDgt([{ id: '1', lat: 42.26, lon: -3.94, carretera: 'A-62', destino: 'BURGOS', url: 'https://etraffic.dgt.es/x.jpg', disponible: true }]);
  assert.equal(mergeCameras(d, d).length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectRegion, omNlSpeedCheck, parseNdwDatex3, ndwToIncident, dutchMotorwayWindow } from '../src/ndw-nl.mjs';
import { isAllowedOfficialControl, radarsAhead } from '../src/drive-radars.mjs';
import { hazardsAhead } from '../src/drive-corridor.mjs';

const nlRadars = JSON.parse(fs.readFileSync(new URL('../../../investor-next/public/senda/data/referencias/nl_radares_oficiales.json', import.meta.url), 'utf8'));
const nlNdw = JSON.parse(fs.readFileSync(new URL('../../../investor-next/public/senda/data/referencias/nl_ndw_incidencias.json', import.meta.url), 'utf8'));

test('Países Bajos: detectRegion, regla oficial OM meetcorrectie y ventana horaria autopistas NL', () => {
  assert.equal(detectRegion([5.9111, 51.9851]), 'NL'); // Arnhem
  assert.equal(detectRegion([4.9041, 52.3676]), 'NL'); // Amsterdam
  assert.equal(detectRegion([-3.7038, 40.4168]), 'ES'); // Madrid
  assert.equal(detectRegion([-0.3763, 39.4699]), 'ES'); // Valencia
  assert.equal(detectRegion([-16.2518, 28.4636]), 'ES'); // Tenerife
  assert.equal(detectRegion([13.405, 52.52]), 'EU'); // Berlin

  // Ejemplos exactos publicados por el Openbaar Ministerie (om.nl):
  // Límite 80 km/h → multa desde 87 km/h (87 - 3 = 84 → +4 km/h)
  assert.equal(omNlSpeedCheck(86, 80).aboveFineThreshold, false);
  assert.equal(omNlSpeedCheck(87, 80).aboveFineThreshold, true);
  assert.equal(omNlSpeedCheck(87, 80).correctionKmh, 3);
  // Límite 100 km/h → multa desde 108 km/h (108 - 3.24 = 104.8 → +4.8 ≥ 4)
  assert.equal(omNlSpeedCheck(107, 100).aboveFineThreshold, false);
  assert.equal(omNlSpeedCheck(108, 100).aboveFineThreshold, true);

  assert.equal(dutchMotorwayWindow(new Date('2026-11-24T12:00:00')).generalMotorwayLimitKmh, 100);
  assert.equal(dutchMotorwayWindow(new Date('2026-11-24T22:00:00')).generalMotorwayLimitKmh, 130);
});

test('Países Bajos: snapshot real de 844 cámaras (CC BY 4.0) pasa puerta legal, filtra sentido contrario y adjunta omCheck', () => {
  assert.equal(nlRadars.totalPuntos, 844);
  for (const p of nlRadars.puntos) {
    assert.equal(isAllowedOfficialControl(p), true, `cámara NL rechazada: ${p.id}`);
    assert.ok(p.maxspeed == null || p.maxspeed <= 130, `límite aberrante >130 en NL: ${p.id} (${p.maxspeed})`);
  }

  // Elegir una cámara real unidireccional con bearing y maxspeed (ej. 50 u 80 km/h)
  const cam = nlRadars.puntos.find((p) => !p.bidirectional && typeof p.bearing === 'number' && typeof p.maxspeed === 'number');
  assert.ok(cam);
  const rad = ((cam.bearing + 180) % 360) * Math.PI / 180;
  const approach = [
    cam.lon + (350 * Math.sin(rad)) / (111320 * Math.cos(cam.lat * Math.PI / 180)),
    cam.lat + (350 * Math.cos(rad)) / 111320,
  ];
  const fwd = radarsAhead({ pos: approach, headingDeg: cam.bearing, speedMs: (cam.maxspeed + 12) / 3.6, points: nlRadars.puntos });
  assert.ok(fwd.top && fwd.top.id === cam.id);
  assert.equal(fwd.top.country, 'NL');
  assert.equal(fwd.top.overLimit, true);
  assert.equal(fwd.top.omCheck.aboveFineThreshold, true);

  // Calzada contraria -> filtrada por rumbo
  const opp = [
    cam.lon - (350 * Math.sin(rad)) / (111320 * Math.cos(cam.lat * Math.PI / 180)),
    cam.lat - (350 * Math.cos(rad)) / 111320,
  ];
  const rev = radarsAhead({ pos: opp, headingDeg: (cam.bearing + 180) % 360, speedMs: (cam.maxspeed + 12) / 3.6, points: nlRadars.puntos });
  assert.equal(rev.items.some((x) => x.id === cam.id), false);
});

test('Países Bajos: parser DATEX II v3 NDW + snapshot real de 769 incidencias (SRTI con rumbo, brugopeningen y afsluitingen)', () => {
  const sampleXml = `
    <sit:situation id="NDW_TEST_1">
      <sit:situationRecord xsi:type="sit:VehicleObstruction">
        <sit:locationReference><loc:pointByCoordinates><loc:bearing>136</loc:bearing>
          <loc:pointCoordinates><loc:latitude>51.787296</loc:latitude><loc:longitude>5.661652</loc:longitude></loc:pointCoordinates>
        </loc:pointByCoordinates></sit:locationReference>
      </sit:situationRecord>
    </sit:situation>`;
  const parsed = parseNdwDatex3(sampleXml, 'srti');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].bearing, 136);
  assert.equal(parsed[0].lat, 51.787296);

  assert.equal(nlNdw.conteos.total, 769);
  const converted = nlNdw.incidencias.map(ndwToIncident);
  // Verificar detección de puente levadizo real (brugopeningen) en el corredor NL
  const bridge = converted.find((i) => i.type === 'BridgeOpening');
  assert.ok(bridge);
  const bPos = [bridge.lon, bridge.lat - 0.004]; // ~440 m al sur, yendo norte (0°)
  const resB = hazardsAhead({ pos: bPos, headingDeg: 0, speedMs: 18, incidents: converted, incSource: 'NDW NL (CC0)' });
  assert.ok(resB.top, 'debe alertar de puente levadizo abierto en el corredor NL');
  assert.equal(resB.top.source, 'NDW');
  assert.equal(resB.top.label, 'Puente levadizo abierto');

  // Verificar filtrado de calzada contraria por <loc:bearing> en SRTI real
  const srti = converted.find((i) => i.feed === 'srti' && typeof i.bearing === 'number');
  assert.ok(srti);
  const rad = ((srti.bearing + 180) % 360) * Math.PI / 180;
  const oppPos = [
    srti.lon - (500 * Math.sin(rad)) / (111320 * Math.cos(srti.lat * Math.PI / 180)),
    srti.lat - (500 * Math.cos(rad)) / 111320,
  ];
  const oppRes = hazardsAhead({ pos: oppPos, headingDeg: (srti.bearing + 180) % 360, speedMs: 25, incidents: [srti], incSource: 'NDW NL' });
  assert.equal(oppRes.items.length, 0, 'debe descartar incidente NDW de la calzada contraria');
});

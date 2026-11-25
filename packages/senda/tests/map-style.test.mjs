import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_STYLES, satelliteStyle, orthoCovers, circlePolygon } from '../src/map-style.mjs';
import { haversineM } from '../src/route-planner.mjs';

test('tipos de mapa: los cuatro base y el satélite propio', () => {
  assert.deepEqual(Object.keys(MAP_STYLES).slice(0, 4), ['mapa', 'claro', 'noche', 'satelite']); assert.ok(Object.keys(MAP_STYLES).length >= 10);
  const s = satelliteStyle();
  assert.equal(s.version, 8);
  assert.equal(s.sources.pnoa.scheme, 'tms', 'PNOA es TMS (y invertida): comprobado con una tesela real de San Martín de Valdeiglesias');
  assert.match(s.sources.pnoa.attribution, /CC BY 4\.0/); assert.match(s.sources.pdok.attribution, /CC BY 4\.0/);
});

test('cobertura de ortofoto: España y Países Bajos sí, Francia central no', () => {
  assert.ok(orthoCovers([-4.3986, 40.3595])); // San Martín de Valdeiglesias
  assert.ok(orthoCovers([5.8616, 50.9718]));  // Geleen
  assert.ok(!orthoCovers([2.35, 46.5]));
});

test('círculo de precisión: todos los vértices a la distancia pedida (±0,5 %)', () => {
  const c = [5.8616, 50.9718], f = circlePolygon(c, 25);
  const ring = f.geometry.coordinates[0];
  assert.equal(ring.length, 65); assert.deepEqual(ring[0], ring.at(-1));
  for (const p of ring) assert.ok(Math.abs(haversineM(c, p) - 25) < 0.125);
});

test('nuevos tipos: cada uno da un estilo válido, con su atribución y fecha de la imagen diaria', async () => {
  const { styleFor, MAP_STYLES, gibsDate } = await import('../src/map-style.mjs');
  const now = Date.UTC(2026, 10, 25, 12);
  assert.equal(gibsDate(now), '2026-11-24');
  for (const id of Object.keys(MAP_STYLES)) {
    const st = styleFor(id, { now });
    if (typeof st === 'string') { assert.match(st, /^https:\/\/tiles\.openfreemap\.org\/styles\//); continue; }
    assert.equal(st.version, 8, id);
    for (const [k, src] of Object.entries(st.sources)) if (src.type === 'raster' || src.type === 'raster-dem') assert.ok(src.attribution, `${id}/${k} sin atribución`);
  }
  assert.match(JSON.stringify(styleFor('dia', { now })), /2026-11-24\/GoogleMapsCompatible_Level9\/\{z\}\/\{y\}\/\{x\}/);
  assert.equal(styleFor('relieve').sources.dem.encoding, 'terrarium');
});

test('leyendas térmicas: paleta oficial de NASA y conversión K→°C', async () => {
  const { legendCss, kToC } = await import('../src/map-style.mjs');
  assert.equal(kToC(273.15), 0); assert.equal(kToC(300), 27);
  const L = legendCss('termico');
  assert.match(L.source, /gibs\.earthdata\.nasa\.gov\/colormaps\/v1\.3\/MODIS_Land_Surface_Temp\.xml/);
  assert.deepEqual(L.labels, ['-73 °C', '2 °C', '77 °C']);
  assert.match(L.gradient, /^linear-gradient\(90deg,rgb\(201,0,255\) 0%/);
  assert.equal(legendCss('mapa'), null);
});

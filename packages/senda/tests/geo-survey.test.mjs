import test from 'node:test';
import assert from 'node:assert/strict';
import { lonToTileX, latToTileY, tileXToLon, tileYToLat, tilesFor, decodeTerrarium, mosaic, sampleHeight, terrainStats, contourInterval, contours, elevationProfile, sunPosition, footprintMetrics, footprintSvg, footprintDxf, metersPerPixel } from '../src/geo-survey.mjs';

test('teselas: ida y vuelta lon/lat ↔ tesela y cobertura de un rectángulo', () => {
  assert.ok(Math.abs(tileXToLon(lonToTileX(-4.3986, 14), 14) + 4.3986) < 1e-9);
  assert.ok(Math.abs(tileYToLat(latToTileY(40.3595, 14), 14) - 40.3595) < 1e-9);
  assert.equal(tilesFor([-4.41, 40.35, -4.39, 40.37], 14).length >= 1, true);
  assert.ok(Math.abs(metersPerPixel(0, 0) - 156543.03392) < 1e-6);
});

test('terrarium: (R·256 + G + B/256) − 32768', () => {
  const h = decodeTerrarium(new Uint8ClampedArray([128, 0, 0, 255, 130, 100, 128, 255]));
  assert.equal(h[0], 0); assert.equal(h[1], 2 * 256 + 100 + 0.5);
});

/** Malla sintética: plano inclinado h = 10·x (m) en una tesela 256×256. */
function planeGrid() {
  const heights = new Float32Array(256 * 256); for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) heights[j * 256 + i] = 10 * i;
  return mosaic([{ x: 8028, y: 6178, heights }], 14);
}

test('curvas en un plano: rectas verticales cada 100 m, cotas correctas', () => {
  const g = planeGrid(), fc = contours(g, 100);
  assert.ok(fc.features.length >= 20);
  for (const f of fc.features) { const lons = f.geometry.coordinates.map((c) => c[0]); assert.ok(Math.max(...lons) - Math.min(...lons) < 1e-6, 'curva recta'); assert.equal(f.properties.ele % 100, 0); }
  assert.ok(fc.features.some((f) => f.properties.index));
  assert.equal(contourInterval(800), 50); assert.equal(contourInterval(90), 5);
});

test('altura bilineal y perfil: el plano sube 10 m por píxel', () => {
  const g = planeGrid(), a = [tileXToLon(8028 + 10.5 / 256, 14), tileYToLat(6178 + 100 / 256, 14)], b = [tileXToLon(8028 + 110.5 / 256, 14), a[1]];
  assert.ok(Math.abs(sampleHeight(g, a) - 100) < 1e-3 && Math.abs(sampleHeight(g, b) - 1100) < 1e-3);
  const pr = elevationProfile(g, [a, b], 5);
  assert.ok(Math.abs(pr.ascentM - 1000) < 1e-2 && pr.descentM < 1e-6 && pr.maxSlopePct > 0);
  const st = terrainStats(g, 40.36);
  assert.ok(st.minM === 10 && st.maxM === 2540, 'el borde se excluye (sin vecinos para la pendiente)');
  assert.ok(Math.abs(st.slopeMaxDeg - Math.atan(10 / st.cellM) * 180 / Math.PI) < 1e-6, 'pendiente = atan(dz/dx)');
  assert.ok(Math.abs(st.slopeP99Deg - st.slopeMaxDeg) <= 0.05, 'plano: P99 = máx (redondeo a 0,1°)');
});

test('sol NOAA: mediodía solar en Madrid el solsticio de verano ≈ 73° de elevación al sur', () => {
  // 21-06-2026; mediodía solar en lon −3,70 ≈ 12:15 UTC
  const s = sunPosition(Date.UTC(2026, 5, 21, 12, 15), 40.4168, -3.7038);
  assert.ok(Math.abs(s.elevationDeg - (90 - 40.4168 + 23.44)) < 0.6, `elev ${s.elevationDeg}`);
  assert.ok(Math.abs(s.azimuthDeg - 180) < 5, `az ${s.azimuthDeg}`);
  assert.ok(sunPosition(Date.UTC(2026, 5, 21, 0, 0), 40.4168, -3.7038).elevationDeg < 0, 'medianoche: bajo el horizonte');
});

test('planta de edificio: cuadrado de ~20 m → 400 m², cotas, SVG y DXF', () => {
  const lat = 40.36, dLat = 20 / 110_574, dLon = 20 / (111_320 * Math.cos(lat * Math.PI / 180));
  const ring = [[-4.4, lat], [-4.4 + dLon, lat], [-4.4 + dLon, lat + dLat], [-4.4, lat + dLat], [-4.4, lat]];
  const m = footprintMetrics(ring);
  assert.ok(Math.abs(m.areaM2 - 400) < 2 && Math.abs(m.perimeterM - 80) < 0.4 && m.edgesM.length === 4);
  const svg = footprintSvg(ring, { heightM: 9, source: 'OSM' });
  assert.match(svg, /^<svg/); assert.match(svg, /400\.\d m²/); assert.match(svg, /no plano interior/);
  assert.match(footprintDxf(ring), /LWPOLYLINE[\s\S]*EOF/);
});

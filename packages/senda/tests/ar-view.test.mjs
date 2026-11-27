import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distM, bearingDeg, angleDiff, normalizeDatasets, rankNearby, project, declutter, deviceCards, intensityClass, describePosition } from '../src/ar-view.mjs';

const ref = (f) => JSON.parse(readFileSync(new URL(`../../../investor-next/public/senda/data/referencias/${f}`, import.meta.url)));

test('geodesia: distancia y rumbo coherentes (Madrid Sol → Cibeles ≈ 1,0 km al este)', () => {
  const sol = { lat: 40.41694, lon: -3.70361 }, cib = { lat: 40.41926, lon: -3.69306 };
  assert.ok(Math.abs(distM(sol, cib) - 930) < 60);
  const b = bearingDeg(sol, cib); assert.ok(b > 65 && b < 80, `rumbo ${b}`);
  assert.equal(angleDiff(10, 350), 20); assert.equal(angleDiff(350, 10), -20); assert.equal(angleDiff(180, 0), 180);
});

test('datos reales del repositorio: se normalizan con su fuente y licencia, sin inventar campos', () => {
  const pts = normalizeDatasets({ cameras: ref('camaras_publicas.json'), dgtIncidents: ref('dgt_incidencias.json'), ndwIncidents: ref('nl_ndw_incidencias.json'), dgtRadars: ref('dgt_radares_oficiales.json'), nlRadars: ref('nl_radares_oficiales.json') });
  const by = (l) => pts.filter((p) => p.layer === l);
  assert.ok(by('INCIDENT').length > 1000 && by('RADAR').length > 1500 && by('CAMERA').length > 2500);
  for (const p of pts) { assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lon)); assert.ok(p.src); }
  assert.ok(by('CAMERA').filter((p) => p.img).length > 2000, 'las cámaras con imagen la conservan');
  // Madrid centro: hay cámaras de Madrid a menos de 2 km y salen ordenadas por importancia.
  const near = rankNearby(pts, { lat: 40.4169, lon: -3.7036 }, { maxM: 2000, limit: 30 });
  assert.ok(near.length > 0 && near.every((p) => p.distM <= 2000));
  for (let i = 1; i < near.length; i++) assert.ok(near[i - 1].score >= near[i].score);
});

test('importancia: una incidencia a 2 km pesa más que una cámara a 1,5 km; lo lejano no entra', () => {
  const me = { lat: 52.0, lon: 5.0 };
  const pts = [
    { id: 'c', layer: 'CAMERA', lat: 52.0135, lon: 5.0, src: 'x' },
    { id: 'i', layer: 'INCIDENT', lat: 52.018, lon: 5.0, src: 'x' },
    { id: 'far', layer: 'INCIDENT', lat: 52.2, lon: 5.0, src: 'x' },
  ];
  assert.deepEqual(rankNearby(pts, me, { maxM: 5000 }).map((p) => p.id), ['i', 'c']);
});

test('proyección: de frente al centro, a la derecha a la derecha, detrás → flecha al borde; lo cercano más abajo', () => {
  const pts = [
    { id: 'front', bearing: 90, distM: 100, score: 1 }, { id: 'right', bearing: 110, distM: 100, score: 1 },
    { id: 'behind', bearing: 270, distM: 100, score: 1 }, { id: 'farFront', bearing: 90, distM: 4000, score: 1 },
  ];
  const P = Object.fromEntries(project(pts, { headingDeg: 90, w: 400, h: 800, fovHDeg: 66 }).map((p) => [p.id, p]));
  assert.equal(P.front.x, 200); assert.equal(P.front.inView, true);
  assert.ok(P.right.x > 300 && P.right.inView);
  assert.equal(P.behind.inView, false); assert.ok(P.behind.x === 16 || P.behind.x === 384);
  assert.ok(P.front.y > P.farFront.y, 'cerca = más abajo');
  const d = declutter([{ ...P.front, y: 500 }, { ...P.front, id: 'twin', y: 500, score: 0.5 }]);
  assert.ok(Math.abs(d[0].y - d[1].y) >= 34, 'etiquetas separadas para poder tocarlas');
  assert.match(describePosition({ distM: 1234, bearing: 100 }, 90), /1\.2 km, 10° a la derecha/);
});

test('dispositivos: fichas sin MAC ni nombre, SENDA primero, redes abiertas marcadas como salida legal, tendencia por historial', () => {
  const hist = new Map();
  deviceCards({ wifi: [{ a: 11, r: -70, g: '5', o: 1 }], ble: [] }, hist, 1000);
  const cards = deviceCards({ wifi: [{ a: 11, r: -60, g: '5', o: 1 }, { a: 12, r: -50, g: '2.4' }], ble: [{ a: 7, r: -65, s: true }, { a: 8, r: -90, s: false }] }, hist, 2000);
  assert.equal(cards[0].kind, 'SENDA');
  const open = cards.find((c) => c.key === 'w11'), prot = cards.find((c) => c.key === 'w12');
  assert.equal(open.open, true); assert.match(open.gateway, /abierta/);
  assert.equal(prot.open, false); assert.match(prot.gateway, /no la usa/);
  assert.equal(open.samples, 2); assert.equal(open.first, 1000); assert.equal(open.last, 2000);
  for (const c of cards) assert.ok(!JSON.stringify(c).match(/[0-9a-f]{2}(:[0-9a-f]{2}){5}/i), 'sin direcciones MAC');
  assert.equal(intensityClass(-50).key, 'VERY_NEAR'); assert.equal(intensityClass(-95).key, 'FAR'); assert.equal(intensityClass(null).key, 'NA');
});

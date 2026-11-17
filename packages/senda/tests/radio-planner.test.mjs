import test from 'node:test';
import assert from 'node:assert/strict';
import { fsplDb, knifeEdgeLossDb, elevationAt, pathLoss, maxPathLossDb, coverage, link, mesh, placeRelays, peakCandidates, distM, ASSUMPTIONS } from '../src/radio-planner.mjs';

// DEM sintético de 101×21 celdas de ~100 m, plano a 100 m, con un muro opcional de norte a sur en la columna 50.
function dem(wallM = 0) { const w = 101, h = 21, data = new Float32Array(w * h).fill(100); if (wallM) for (let j = 0; j < h; j++) data[j * w + 50] = 100 + wallM; return { w, h, data, west: 0, north: 0.02, dx: 0.001, dy: 0.001 }; }
const P = { fMhz: 868, kFactor: 4 / 3 }, RADIO = { txPowerDbm: 14, txGainDbi: 2, rxGainDbi: 2, sensitivityDbm: -130, marginDb: 10 };
const A = { lon: 0.01, lat: 0.01, hM: 10 }, B = { lon: 0.09, lat: 0.01, hM: 10 };

test('radio: espacio libre y arista de cuchillo coinciden con valores de referencia', () => {
  assert.ok(Math.abs(fsplDb(1, 868) - 91.22) < 0.01, 'FSPL a 1 km y 868 MHz ≈ 91,2 dB');
  assert.ok(Math.abs(fsplDb(10, 868) - fsplDb(1, 868) - 20) < 1e-9, '+20 dB por década');
  assert.ok(Math.abs(knifeEdgeLossDb(0) - 6.03) < 0.05, 'ν = 0 (rasante) ≈ 6 dB');
  assert.equal(knifeEdgeLossDb(-1), 0);
  assert.ok(knifeEdgeLossDb(2) > knifeEdgeLossDb(1));
});

test('radio: interpolación bilineal del relieve', () => {
  const d = { w: 2, h: 2, data: [0, 10, 20, 30], west: 0, north: 1, dx: 1, dy: 1 };
  assert.equal(elevationAt(d, 0.5, 0.5), 15); assert.equal(elevationAt(d, 0, 1), 0); assert.equal(elevationAt(d, 9, -9), 30);
});

test('radio: en llano con antenas altas hay visión directa y la pérdida es la de espacio libre', () => {
  const hi = { ...A, hM: 40 }, hj = { ...B, hM: 40 }, r = pathLoss(dem(), hi, hj, P);
  assert.ok(Math.abs(r.dKm - distM(hi, hj) / 1000) < 1e-9); assert.equal(r.los, true); assert.equal(r.diffractionDb, 0);
  assert.ok(Math.abs(r.totalDb - fsplDb(r.dKm, 868)) < 1e-9);
});

test('radio: un muro de 80 m añade difracción y cuanto más alto, más pérdida', () => {
  const r0 = pathLoss(dem(), A, B, P), r80 = pathLoss(dem(80), A, B, P), r200 = pathLoss(dem(200), A, B, P);
  assert.equal(r80.los, false); assert.ok(r80.diffractionDb > 15); assert.ok(r200.totalDb > r80.totalDb); assert.ok(r80.totalDb > r0.totalDb);
});

test('radio: el balance del enlace no tiene valores por defecto', () => {
  assert.equal(maxPathLossDb(RADIO), 138);
  assert.throws(() => maxPathLossDb({ ...RADIO, sensitivityDbm: undefined }), /sensitivityDbm/);
  assert.throws(() => pathLoss(dem(), A, B, { kFactor: 1 }), /fMhz/);
  assert.throws(() => pathLoss(dem(), A, B, { fMhz: 868 }), /kFactor/);
  assert.throws(() => pathLoss(dem(), { lon: 0, lat: 0 }, B, P), /hM/);
  assert.throws(() => coverage(dem(), A, RADIO, P, {}), /rxHM/);
});

test('radio: la cobertura cae detrás del muro', () => {
  const weak = { ...RADIO, sensitivityDbm: -122 }, c0 = coverage(dem(), A, weak, P, { rxHM: 1.5, stride: 4 }), c1 = coverage(dem(300), A, weak, P, { rxHM: 1.5, stride: 4 });
  assert.ok(c1.coveredCells < c0.coveredCells); assert.ok(c0.pct > 0 && c0.pct <= 100);
  const far = c1.w - 2, row = Math.floor(c1.h / 2); assert.equal(c1.covered[row * c1.w + far], 0, 'detrás del muro no llega');
  assert.equal(c1.covered[row * c1.w + 3], 1, 'junto al emisor sí');
});

test('radio: la malla salta el muro con un repetidor en la cresta', () => {
  const d = dem(300), weak = { ...RADIO, sensitivityDbm: -105 }, top = { lon: 0.05, lat: 0.01, hM: 10 };
  assert.equal(link(d, A, B, weak, P).ok, false);
  const m = mesh(d, [A, top, B], weak, P);
  assert.deepEqual(m.hops, [0, 1, 2]); assert.equal(m.reachable, 3); assert.equal(m.prev[2], 1);
});

test('radio: la colocación voraz elige primero el repetidor que más demanda cubre y marca el resultado como modelo', () => {
  const d = dem(300), weak = { ...RADIO, sensitivityDbm: -105 };
  const demand = [{ lon: 0.02, lat: 0.01, hM: 1.5 }, { lon: 0.03, lat: 0.012, hM: 1.5 }, { lon: 0.08, lat: 0.01, hM: 1.5, weight: 5 }];
  const cands = [{ id: 'oeste', ...A }, { id: 'cresta', lon: 0.05, lat: 0.01, hM: 10 }, { id: 'este', ...B }];
  const r = placeRelays(d, cands, demand, weak, P, 2);
  assert.equal(r.basis, 'MODEL'); assert.equal(r.steps[0].id, 'cresta', 'la cresta ve los dos lados'); assert.equal(r.pct, 100);
  assert.ok(r.assumptions.length === ASSUMPTIONS.length && /no es una medida/.test(r.assumptions[0]));
  const con = placeRelays(d, cands, demand, weak, P, 3, { mustConnect: true, seed: 0 });
  assert.equal(con.chosen[0], 0); assert.equal(con.chosen[1], 1, 'el segundo debe enlazar con el primero: la cresta');
});

test('radio: candidatos en los máximos locales', () => {
  const d = dem(300), c = peakCandidates(d, { win: 21, hM: 6, minProminenceM: 50 });
  assert.ok(c.length >= 1 && c.every((x) => x.z === 400 && Math.abs(x.lon - 0.05) < 1e-9));
  assert.throws(() => peakCandidates(d, {}), /hM/);
});

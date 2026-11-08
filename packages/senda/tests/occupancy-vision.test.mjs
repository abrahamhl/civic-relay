import test from 'node:test';
import assert from 'node:assert/strict';
import { cellsFromBuilding, fuseOccupancy } from '../src/occupancy.mjs';
import { demoTower, simulateRescueTruth, runCalibration, fusionInputFromBuildingSim } from '../src/rescue-scenario.mjs';
import { simulateBuildingIncident } from '../src/building-scenario.mjs';
import { planNextSensing, baroHeightDiffM, floorFromHeight, DEVICE_CATALOG } from '../src/sensor-fabric.mjs';
import { composeLayers, thermalHotspots, probabilityColor } from '../src/vision-layers.mjs';

const tower = demoTower({ levels: 6 });
const cells = cellsFromBuilding(tower);
const cell = (id) => cells.find((c) => c.id === id);

test('celdas: una por vivienda y planta, en los cuadrantes de unitOf', () => {
  assert.equal(cells.length, 24);
  assert.ok(cell('3B').center.x > cell('3A').center.x && cell('3A').center.y > cell('3C').center.y);
});

test('una sola familia de evidencia nunca alcanza la insignia ≥98 %, por fuerte que sea', () => {
  const persons = [{ id: 'p', homeCell: '2A', phoneFix: { ...cell('2A').center, errorM: 1, baroZ: cell('2A').center.z } }];
  const f = fuseOccupancy({ cells, persons }).cells.find((c) => c.id === '2A');
  assert.ok(f.families.length === 1 && f.badge98 === false);
});

test('«atrapado» + respiración por CSI en la misma vivienda → ≥98 % corroborado por 2 familias', () => {
  const persons = [{ id: 'p', homeCell: '4D', status: 'TRAPPED', reportedCell: '4D' }];
  const cellEvidence = [{ family: 'BODY_RF', at: cell('4D').center, radiusM: 4, detected: true }];
  const f = fuseOccupancy({ cells, persons, cellEvidence }).cells.find((c) => c.id === '4D');
  assert.ok(f.p >= 0.98 && f.lo >= 0.98 && f.badge98 && f.cls === 'CONFIRMADO_POR_RESPUESTA', JSON.stringify(f));
});

test('la búsqueda sin hallazgo baja la probabilidad y «a salvo» retira a la persona', () => {
  const base = fuseOccupancy({ cells, persons: [{ id: 'p', homeCell: '1C' }] }).cells.find((c) => c.id === '1C').p;
  const searched = fuseOccupancy({ cells, persons: [{ id: 'p', homeCell: '1C' }], cellEvidence: [{ family: 'SEARCH', at: cell('1C').center, radiusM: 4, detected: false }] }).cells.find((c) => c.id === '1C').p;
  const safe = fuseOccupancy({ cells, persons: [{ id: 'p', homeCell: '1C', status: 'SAFE' }] }).cells.find((c) => c.id === '1C').p;
  assert.ok(searched < base - 0.2 && safe < base / 2, `${base} ${searched} ${safe}`);
});

test('el intervalo [lo, hi] contiene siempre el valor central y es determinista', () => {
  const s = simulateRescueTruth({ seed: 5 });
  const a = fuseOccupancy(s), b = fuseOccupancy(s);
  assert.deepEqual(a, b);
  for (const c of a.cells) assert.ok(c.lo <= c.p + 1e-12 && c.p <= c.hi + 1e-12, c.id);
});

test('calibración en simulación: mejora el Brier frente a «solo registro» y la insignia ≥98 % acierta ≥98 %', () => {
  const r = runCalibration({ runs: 40 });
  assert.ok(r.engine.brier < r.baseline.brier, `${r.engine.brier} vs ${r.baseline.brier}`);
  assert.ok(r.badge98.n >= 50 && r.badge98.observedRate >= 0.98, JSON.stringify(r.badge98));
  for (const b of r.engine.table) if (b.n >= 60) assert.ok(Math.abs(b.predicted - b.observed) <= 0.15, JSON.stringify(b));
});

test('robustez: con la realidad distinta de los parámetros del motor sigue mejorando y la insignia sigue ≥95 %', () => {
  const r = runCalibration({ runs: 40, misspecified: true });
  assert.ok(r.engine.brier < r.baseline.brier && r.badge98.observedRate >= 0.95, JSON.stringify({ e: r.engine.brier, b: r.baseline.brier, badge: r.badge98 }));
});

test('edificio 14: la vivienda con «atrapado» encabeza la prioridad y las plantas dañadas pesan más', () => {
  const f = fuseOccupancy(fusionInputFromBuildingSim(simulateBuildingIncident()));
  assert.equal(f.ranked[0].cls, 'CONFIRMADO_POR_RESPUESTA');
  assert.ok(f.ranked.slice(0, 6).every((c) => c.floor >= 1 && c.floor <= 4));
});

test('planificador: elige la medida que más información da por minuto, no la más cercana', () => {
  const s = simulateRescueTruth({ seed: 9 });
  const f = fuseOccupancy({ cells: s.cells, persons: s.persons.map(({ id, homeCell }) => ({ id, homeCell })) });
  const plan = planNextSensing(f, [
    { id: 'csi-p2', at: cellsFromBuilding(s.building).find((c) => c.id === '2B').center, radiusM: 6, pd: 0.8, pfa: 0.05, costMin: 5 },
    { id: 'perro-p2', at: cellsFromBuilding(s.building).find((c) => c.id === '2B').center, radiusM: 6, pd: 0.8, pfa: 0.05, costMin: 20 },
    { id: 'lejos', at: { x: 500, y: 500, z: 0 }, radiusM: 6, pd: 0.9, pfa: 0.01, costMin: 1 },
  ]);
  assert.equal(plan[0].id, 'csi-p2');
  assert.equal(plan.at(-1).bits, 0);
});

test('barometría diferencial: 1 hPa ≈ 8,3 m y planta correcta', () => {
  const h = baroHeightDiffM(1012, 1013);
  assert.ok(Math.abs(h - 8.33) < 0.1, String(h));
  assert.equal(floorFromHeight(baroHeightDiffM(1013 - 9.2 * 0.12, 1013)), 3); // ~9,2 m por encima de la calle
});

test('catálogo: todo lo no permitido queda fuera de alcance y lo hecho apunta a un módulo', () => {
  for (const d of DEVICE_CATALOG) {
    if (d.access === 'NO_PERMITIDO') assert.equal(d.status, 'FUERA_DE_ALCANCE');
    if (d.status.startsWith('HECHO')) assert.ok(d.module, d.id);
  }
});

test('capas: cada capa produce primitivas visibles y la leyenda dice lo que NO es', () => {
  const s = simulateRescueTruth({ seed: 2 });
  const fusion = fuseOccupancy(s);
  const cx = 10, cy = 10;
  const cam = { pos: { x: cx - 30, y: cy, z: 1.6 }, yaw: 0, pitch: 0.35, hfovRad: 1.15, width: 800, height: 600 };
  const out = composeLayers({ building: s.building, fusion, persons: s.persons, cellEvidence: s.cellEvidence, damagedFloors: [2, 3] }, cam, { PROBABILIDAD: 0.8, ESPECTRO: 1, ESTRUCTURA: 1, TOPOGRAFIA: 0.5 });
  for (const k of ['PROBABILIDAD', 'ESPECTRO', 'ESTRUCTURA', 'TOPOGRAFIA']) assert.ok(out.byLayer[k] > 0, k);
  assert.ok(out.primitives.some((p) => p.layer === 'ESTRUCTURA' && p.color === '#ff3b4e'));
  assert.match(out.legend.find((l) => l.layer === 'PROBABILIDAD').honest, /No es una imagen térmica/);
  const back = composeLayers({ building: s.building, fusion }, { ...cam, yaw: Math.PI }, { PROBABILIDAD: 1 });
  assert.equal(back.byLayer.PROBABILIDAD ?? 0, 0); // de espaldas no se dibuja nada
});

test('térmica real: encuentra el punto caliente de una persona en un fotograma radiométrico', () => {
  const w = 40, h = 30, data = new Float32Array(w * h).fill(18);
  for (let y = 10; y < 20; y++) for (let x = 22; x < 27; x++) data[y * w + x] = 33.5;
  data[5] = 300; // fuego: fuera del rango de piel
  const hs = thermalHotspots({ w, h, data });
  assert.equal(hs.length, 1); assert.deepEqual(hs[0].box, { x: 22, y: 10, w: 5, h: 10 });
  assert.equal(probabilityColor(0).css, 'rgb(8,6,30)');
});

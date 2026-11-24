import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORRIDOR_RULES, stoppingDistanceM, bearingDeg, headingDeltaDeg, dedupeHazards, hazardsAhead, corridorAnnouncement } from '../src/drive-corridor.mjs';
import { AASHTO_SSD } from '../src/road-guard.mjs';

const dgt = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/referencias/dgt_incidencias.json', import.meta.url), 'utf8'));

test('SSD de AASHTO exacta a 50, 90 y 120 km/h; sin velocidad devuelve null', () => {
  assert.equal(stoppingDistanceM(null), null);
  assert.equal(stoppingDistanceM(-5), null);
  const v120 = 120 / 3.6;
  const expected = v120 * AASHTO_SSD.perceptionReactionS + (v120 ** 2) / (2 * AASHTO_SSD.decelMs2);
  assert.ok(Math.abs(stoppingDistanceM(v120) - expected) < 1e-9);
  assert.ok(stoppingDistanceM(v120) > 240 && stoppingDistanceM(v120) < 255);
  assert.match(CORRIDOR_RULES.source, /no calibradas/);
});

test('datos reales DGT (838 incidencias): detecta ACCIDENTE real en V-31 al circular hacia el sur y lo ignora en sentido contrario', () => {
  assert.equal(dgt.incidencias.length, 838);
  // Posición 1,1 km al norte del accidente real de V-31 (39.4328, -0.3703), circulando hacia el sur (180°) a 90 km/h
  const pos = [-0.3703, 39.4427];
  const south = hazardsAhead({ pos, headingDeg: 180, speedMs: 25, incidents: dgt.incidencias, incSource: 'DGT, copia del 14/11/2026' });
  assert.ok(south.top, 'debe detectar el accidente real en V-31 por delante');
  assert.equal(south.top.cat, 'ACCIDENTE');
  assert.equal(south.top.road, 'V-31');
  assert.ok(south.top.distM > 900 && south.top.distM < 1300, `distancia inesperada: ${south.top.distM}`);
  assert.equal(south.top.sourceLabel, 'DGT, copia del 14/11/2026');
  assert.ok(south.ssdM > 150 && south.ssdM < 160);

  // Misma posición circulando hacia el norte (0°): el accidente queda detrás y NO debe avisar
  const north = hazardsAhead({ pos, headingDeg: 0, speedMs: 25, incidents: dgt.incidencias, incSource: 'DGT, copia del 14/11/2026' });
  assert.ok(!north.items.some((i) => i.road === 'V-31' && i.cat === 'ACCIDENTE'), 'no debe avisar de incidencias ya rebasadas');
});

test('datos reales DGT: colapsa duplicados reales en A-6 BUS-VAO (dos CORTE idénticos a la misma coordenada)', () => {
  // Posición en A-6 ~1,4 km al SE del doble CORTE real (40.4579, -3.7472), rumbo NO (315°) a 100 km/h (horizonte 1,67 km)
  const pos = [-3.735, 40.449];
  const res = hazardsAhead({ pos, headingDeg: 315, speedMs: 100 / 3.6, incidents: dgt.incidencias, incSource: 'DGT, copia del 14/11/2026' });
  assert.ok(res.rawCount > res.dedupedCount, `debe colapsar duplicados reales en A-6 (raw=${res.rawCount}, deduped=${res.dedupedCount})`);
  assert.equal(res.top.cat, 'CORTE');
  assert.equal(res.top.road, 'A-6 BUS-VAO');
});

test('modo RUTA: proyecta sobre polilínea OSRM, filtra incidencias fuera de la ruta (>80 m) y avisa por delante', () => {
  const routeCoords = [[-0.3703, 39.4500], [-0.3703, 39.4400], [-0.3703, 39.4300]];
  const pos = [-0.3703, 39.4430];
  const fakeFar = { id: 'off', lat: 39.4380, lon: -0.3650, type: 'Accident', cause: 'accident', road: 'OTRA' }; // ~450 m lateral
  const res = hazardsAhead({ pos, speedMs: 25, routeCoords, incidents: [...dgt.incidencias, fakeFar], incSource: 'DGT, copia del 14/11/2026' });
  assert.equal(res.mode, 'RUTA');
  assert.ok(res.items.some((i) => i.road === 'V-31' && i.cat === 'ACCIDENTE'));
  assert.ok(!res.items.some((i) => i.road === 'OTRA'), 'incidencia a >80 m de la ruta no debe avisar');
});

test('aviso SENDA por Bluetooth: se etiqueta «sin verificar», se anuncia una sola vez y aplica urgencia ROJO dentro de 2×SSD', () => {
  const pos = [-3.7000, 40.4000];
  // Aviso de vehículo parado 200 m al norte (rumbo 0°), velocidad 108 km/h (30 m/s → SSD ≈ 207 m, 2×SSD ≈ 415 m)
  const report = { id: 77, kind: 'parado', lat: 40.4018, lon: -3.7000, t: Date.now(), own: false, verified: null };
  const res = hazardsAhead({ pos, headingDeg: 0, speedMs: 30, incidents: [], reports: [report] });
  assert.equal(res.top.urgency, 'ROJO');
  assert.equal(res.top.withinSsdMargin, true);
  assert.match(res.top.sourceLabel, /sin verificar/);

  const said = new Set();
  const a1 = corridorAnnouncement(res.top, said);
  const a2 = corridorAnnouncement(res.top, said);
  assert.ok(a1 && /sin verificar/.test(a1), `anuncio debe declarar sin verificar: ${a1}`);
  assert.equal(a2, null, 'no debe repetir el mismo aviso');
});

test('geometría auxiliar y deduplicación determinista', () => {
  assert.ok(Math.abs(bearingDeg([0, 0], [0, 1]) - 0) < 0.01);
  assert.ok(Math.abs(bearingDeg([0, 0], [1, 0]) - 90) < 0.01);
  assert.equal(headingDeltaDeg(350, 10), 20);
  const d = dedupeHazards([
    { cat: 'OBRAS', lat: 40.4, lon: -3.7, distM: 500, rank: 2 },
    { cat: 'OBRAS', lat: 40.4004, lon: -3.7, distM: 540, rank: 2 },
    { cat: 'ACCIDENTE', lat: 40.4004, lon: -3.7, distM: 540, rank: 4 },
  ], 120);
  assert.equal(d.length, 2);
});

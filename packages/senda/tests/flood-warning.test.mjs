import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { downstreamPath, closestOnPath, travelMinutes, frontIndex, flowLevel, leadMinutes, localToUtcMs, eventsUntil } from '../src/flood-warning.mjs';

// Malla 5×5: todo cae hacia el este (d = 0) en la fila 2; la columna 4 es salida.
const w = 5, h = 5, dir = new Uint8Array(w * h).fill(0); for (let j = 0; j < h; j++) dir[j * w + 4] = 15;
dir[1 * w + 0] = 1; // (0,1) → sureste → (1,2)
const dirAt = (k) => dir[k];

test('camino aguas abajo: longitud con pasos rectos y diagonales', () => {
  const p = downstreamPath(dirAt, w, h, 1 * w + 0, 30);
  assert.deepEqual(p.cells, [5, 11, 12, 13, 14]);
  assert.ok(Math.abs(p.distM.at(-1) - (30 * Math.SQRT2 + 3 * 30)) < 1e-9);
  const c = closestOnPath(p, w, 3 * w + 3); assert.equal(p.cells[c.idx], 13); assert.equal(c.offCells, 1);
});

test('tiempo de llegada y frente: sin velocidad no se inventa', () => {
  assert.equal(travelMinutes(8400, undefined), null);
  assert.equal(travelMinutes(8400, 14), 10);
  const p = { distM: [0, 30, 60, 90, 120] };
  assert.equal(frontIndex(p, 1, 1), 2); assert.equal(frontIndex(p, 1, 10), 4); assert.equal(frontIndex(p, null, 5), -1);
});

test('nivel de aviso: umbrales con fuente o «no medido»', () => {
  assert.equal(flowLevel(2282, { avisoM3s: 150, capacidadM3s: 800 }).level, 'desbordamiento');
  assert.equal(flowLevel(264, { avisoM3s: 150, capacidadM3s: 800 }).level, 'aviso');
  assert.equal(flowLevel(100, { avisoM3s: 150 }).level, 'normal');
  assert.equal(flowLevel(100, {}).level, 'no_medido');
  assert.ok(Math.abs(flowLevel(2282, { avisoM3s: 150, capacidadM3s: 800 }).ratio - 2.8525) < 1e-9);
});

test('cronología real (telemetria.json): horas y antelaciones calculadas, sin rellenar huecos', () => {
  const t = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/dana2024/telemetria.json', import.meta.url)));
  const ids = new Set(); for (const e of t.eventos) { assert.ok(!ids.has(e.id)); ids.add(e.id); assert.ok(t.fuentes[e.fuente], `fuente de ${e.id}`); assert.ok(e.estado, `estado de ${e.id}`); }
  for (const c of t.constantes) assert.ok(t.fuentes[c.fuente]);
  // CET: 18:55 local = 17:55 UTC
  assert.equal(new Date(localToUtcMs('2024-10-29T18:55', 1)).toISOString(), '2024-10-29T17:55:00.000Z');
  assert.equal(leadMinutes(t.eventos, 'poyo_1855', 'esalert', 1).minutes, 76);
  assert.equal(leadMinutes(t.eventos, 'poyo_1855', 'cedex_pico', 1).minutes, 40);
  assert.equal(leadMinutes(t.eventos, 'cems_evento', 'esalert', 1).minutes, 281); // 14:30 UTC → 20:11 local (19:11 UTC)
  assert.equal(leadMinutes(t.eventos, 'poyo_manana', 'esalert', 1), null); // sin hora: no se calcula
  assert.equal(leadMinutes(t.eventos, 'reanuda_14', 'esalert', 1).approx, true);
  const until = eventsUntil(t.eventos, localToUtcMs('2024-10-29T19:00', 1), 1).map((e) => e.id);
  assert.ok(until.includes('poyo_1855') && !until.includes('esalert'));
});

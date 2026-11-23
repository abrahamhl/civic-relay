import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES, FROM_REPORT, fromDatex, ICONS, markerSvg } from '../src/report-style.mjs';
import { REPORT_KINDS } from '../src/road-guard.mjs';

test('todo aviso de SENDA tiene categoría, color e icono', () => {
  for (const k of Object.keys(REPORT_KINDS)) { const c = CATEGORIES[FROM_REPORT[k]]; assert.ok(c, k); assert.ok(ICONS[c.icon], k); }
});

test('todas las incidencias reales de la DGT (copia del 14-11) caen en una categoría', () => {
  const d = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/referencias/dgt_incidencias.json', import.meta.url)));
  const list = Object.values(d).find(Array.isArray);
  const seen = new Set(list.map((i) => fromDatex(i)));
  for (const c of seen) assert.ok(CATEGORIES[c], c);
  assert.equal(fromDatex({ type: 'GenericSituationRecord', cause: 'accident' }), 'ACCIDENTE');
  assert.equal(fromDatex({ type: 'RoadOrCarriagewayOrLaneManagement', cause: 'roadMaintenance' }), 'OBRAS');
  assert.equal(fromDatex({ type: 'AbnormalTraffic', cause: 'abnormalTraffic' }), 'TRAFICO');
  assert.ok(seen.size >= 4, `variedad de categorías en datos reales: ${[...seen]}`);
});

test('el marcador es un SVG con el color de su categoría', () => {
  const s = markerSvg('ACCIDENTE');
  assert.match(s, /^<svg /); assert.match(s, /#ff3b30/);
});

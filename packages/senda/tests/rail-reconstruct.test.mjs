import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hms, fmtHms, speedProfile, pkAt, meanDecel, stopping, closingKmh, brakingShortfall } from '../src/rail-reconstruct.mjs';

test('integración exacta del perfil lineal a trozos', () => {
  const p = speedProfile([{ tSec: 0, vKmh: 36 }, { tSec: 10, vKmh: 72 }]); // 10 → 20 m/s
  assert.ok(Math.abs(p.dist(0, 10) - 150) < 1e-9);
  assert.ok(Math.abs(p.dist(-5, 0) - 50) < 1e-9); // antes del primer punto, velocidad constante
  assert.ok(Math.abs(p.dist(10, 0) + 150) < 1e-9);
  assert.ok(Math.abs(pkAt(p, { tAnchor: 10, pkAnchor: 100, dir: -1 }, 0) - 100.15) < 1e-12);
});

test('distancia de parada, deceleración media y velocidad de acercamiento', () => {
  assert.throws(() => stopping(200, 0), /sin valor por defecto/);
  const s = stopping(216, 1); assert.ok(Math.abs(s.distM - 1800) < 1e-9); assert.ok(Math.abs(s.timeS - 60) < 1e-9);
  assert.ok(Math.abs(meanDecel({ tSec: 0, vKmh: 216 }, { tSec: 6, vKmh: 204 }) - 12 / 3.6 / 6) < 1e-12);
  assert.equal(closingKmh(204, 152), 356);
  const b = brakingShortfall(216, 1, 300); assert.ok(Math.abs(b.shortfallM - 1500) < 1e-9); assert.ok(Math.abs(b.earlierS - 25) < 1e-9);
  assert.equal(hms('19:43:42') - hms('19:43:37'), 5); assert.equal(fmtHms(hms('20:16:29')), '20:16:29');
});

test('Adamuz con datos publicados: cada suceso tiene fuente y las restas de tiempo son las esperadas', () => {
  const d = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/adamuz2026/cronologia.json', import.meta.url)));
  for (const e of d.eventos) { assert.ok(d.fuentes[e.fuente], e.id); assert.ok(e.estado, e.id); }
  const T = (id) => hms(d.eventos.find((e) => e.id === id).t);
  assert.equal(T('segundo_tren') - T('choque_infobae'), 32 * 60 + 47); // 32 min 47 s hasta confirmar el segundo tren
  assert.equal(T('llamada_112') - T('choque_infobae'), 69);
  // Alvia (versión Infobae): 217 → 204 km/h entre 19:43:37 y 19:43:42
  const a = d.eventos.find((e) => e.id === 'alvia_s613'), c = d.eventos.find((e) => e.id === 'choque_infobae');
  const alvia = speedProfile([{ tSec: hms(a.t), vKmh: a.vKmh }, { tSec: hms(c.t), vKmh: c.vKmh }]);
  assert.ok(Math.abs(alvia.dist(hms(a.t), hms(c.t)) - 292.36) < 0.01);
  assert.ok(Math.abs(meanDecel({ tSec: hms(a.t), vKmh: 217 }, { tSec: hms(c.t), vKmh: 204 }) - 0.7222) < 1e-4);
});

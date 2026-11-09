import test from 'node:test';
import assert from 'node:assert/strict';
import { multilaterate, chorusScenario, clockOffsets, detectOnset, kalman1d, arvaGuide, SOUND_AIR_MS } from '../src/senses.mjs';

test('escucha coral: con relojes desfasados ±50 ms y pitido de sincronía, el golpe se sitúa a < 0,5 m', () => {
  for (const seed of [1, 3, 7, 11]) { const s = chorusScenario({ seed }); assert.ok(Math.hypot(s.fix.x - s.knock.x, s.fix.y - s.knock.y) < 0.5, `seed ${seed}`); }
});

test('sin corregir los relojes el error es de metros: la sincronía es imprescindible', () => {
  const s = chorusScenario({ seed: 3 }), raw = s.obs.map((o, i) => ({ ...o, t: o.t + s.offsets[i] }));
  const f = multilaterate(raw); assert.ok(Math.hypot(f.x - s.knock.x, f.y - s.knock.y) > 2);
});

test('desfases de reloj recuperados y detector de golpe', () => {
  const phones = [{ x: 0, y: 0 }, { x: 10, y: 0 }], at = { x: 0, y: 0 }, arr = [1 + 0, 1 + 10 / SOUND_AIR_MS + 0.03];
  assert.ok(Math.abs(clockOffsets(phones, at, arr)[1] - 0.03) < 1e-9);
  const sr = 8000, x = Array.from({ length: sr }, (_, i) => (i > 4000 ? Math.sin(i) * 0.8 : Math.sin(i * 7) * 0.01));
  assert.ok(Math.abs(detectOnset(x, sr) - 0.5) < 0.01);
});

test('modo ARVA: al acercarse, la distancia baja, el pitido se acelera y el intervalo es honesto', () => {
  const k = kalman1d(); let prev = null, first = null, last = null;
  for (const z of [-90, -88, -85, -82, -78, -74, -70, -66]) { const x = k(z); last = arvaGuide(x, prev); first ??= last; prev = x; }
  assert.ok(last.distM < first.distM && last.beepMs < first.beepMs && last.trend === 'más cerca');
  assert.ok(last.loM <= last.distM && last.distM <= last.hiM);
});

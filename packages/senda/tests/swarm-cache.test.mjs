import test from 'node:test';
import assert from 'node:assert/strict';
import { retrievalProbability, planSwarm, bloomParams, bloom, bloomFpRate, swarmRoundTrip, contentId } from '../src/swarm-cache.mjs';

test('probabilidad de recuperar k de n: casos límite y binomial', () => {
  assert.equal(retrievalProbability(1, 1, 1), 1); assert.ok(Math.abs(retrievalProbability(1, 2, 0.5) - 0.75) < 1e-12);
  assert.ok(retrievalProbability(5, 10, 0.5) > retrievalProbability(6, 10, 0.5));
});

test('plan del enjambre: 6 GB entre 40 vecinos alcanzables al 50 % → < 500 MB por móvil con ≥ 99 % de recuperación', () => {
  const p = planSwarm({ packMB: 6000, phones: 40, pAvail: 0.5 });
  assert.ok(p.p >= 0.99 && p.perPhoneMB < 500, JSON.stringify(p));
  assert.ok(planSwarm({ packMB: 6000, phones: 40, pAvail: 0.3 }).perPhoneMB > p.perPhoneMB, 'con peor alcance hace falta más por vecino');
});

test('filtro de Bloom: 2000 piezas al 1 % caben en ~2,4 KB, sin falsos negativos y falsos positivos cerca del 1 %', () => {
  const { m, k, bytes } = bloomParams(2000, 0.01); assert.ok(bytes < 2500 && k === 7);
  const b = bloom(2000, 0.01); for (let i = 0; i < 2000; i++) b.add(`pieza-${i}`);
  for (let i = 0; i < 2000; i++) assert.ok(b.has(`pieza-${i}`));
  let fp = 0; for (let i = 0; i < 20000; i++) if (b.has(`otra-${i}`)) fp++;
  assert.ok(fp / 20000 < 0.02, String(fp / 20000)); assert.ok(Math.abs(bloomFpRate(m, k, 2000) - 0.01) < 0.002);
});

test('ida y vuelta real: un paquete repartido en 30 fragmentos se reconstruye exacto con 12 cualesquiera y se verifica su huella', async () => {
  const pack = new Uint8Array(200000).map((_, i) => (i * 31 + 7) & 255);
  const ok = await swarmRoundTrip(pack, { k: 12, n: 30, reachable: Array.from({ length: 30 }, (_, i) => i % 3 !== 0) });
  assert.ok(ok.ok && ok.got === 20);
  const few = await swarmRoundTrip(pack, { k: 12, n: 30, reachable: Array.from({ length: 30 }, (_, i) => i < 11) });
  assert.equal(few.ok, false);
  assert.equal((await contentId(new TextEncoder().encode('abc'))).slice(0, 8), 'ba7816bf');
});

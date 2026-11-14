import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glofasUrl, parseGlofasDaily, riverContext, riverContextText } from '../src/river-context.mjs';

const snap = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public/senda/data/referencias/glofas_puntos.json'), 'utf8'));

test('URL de GloFAS válida y coordenadas inválidas rechazadas', () => {
  assert.match(glofasUrl(39.4269, -0.4174), /^https:\/\/flood-api\.open-meteo\.com\/v1\/flood\?latitude=39\.4269&longitude=-0\.4174&daily=river_discharge/);
  assert.throws(() => glofasUrl(120, 0));
});

test('contexto calculado sobre una serie sintética conocida', () => {
  const days = Array.from({ length: 10 }, (_, k) => ({ date: `2026-01-${String(k + 1).padStart(2, '0')}`, q: k < 6 ? 10 : [12, 30, 20, 15][k - 6], median: null, p75: null, max: null }));
  const c = riverContext({ cell: { lat: 1, lon: 2 }, unit: 'm³/s', days }, '2026-01-07');
  assert.equal(c.medianaPrevia30d, 10); assert.equal(c.qHoy, 12); assert.equal(c.pico.q, 30); assert.equal(c.pico.date, '2026-01-08'); assert.equal(c.pico.vecesMediana, 3); assert.equal(c.tendenciaManana, 'sube');
  assert.throws(() => riverContext({ cell: { lat: 1, lon: 2 }, days }, '2030-01-01'));
  assert.throws(() => parseGlofasDaily({}));
});

test('foto real de GloFAS (Paiporta): serie con pasado y previsión, fuente declarada y texto sin palabra «aviso» de alarma', () => {
  const p = snap.puntos[0];
  assert.match(snap.fuente, /GloFAS/); assert.match(p.sha256, /^[0-9a-f]{64}$/);
  assert.ok(p.serie.days.length >= 40, 'unos 30 días pasados + 14 de previsión');
  const day = snap.descargadoUTC.slice(0, 10), c = riverContext(p.serie, day);
  assert.ok(Number.isFinite(c.qHoy) && Number.isFinite(c.pico.q) && c.pico.q >= c.qHoy);
  assert.match(c.lectura, /No es un aviso oficial/);
  assert.doesNotMatch(riverContextText(c), /evac|alerta roja|peligro/i);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchEvents, concordance, dependencyOf } from '../src/cross-source.mjs';
import { eventsFromUsgs, eventsFromGdacs, eventsFromS2Change } from '../src/atlas.mjs';
import { fuseSituations } from '../src/fusion.mjs';

const ref = (f) => JSON.parse(readFileSync(new URL(`../../../investor-next/public/senda/data/${f}`, import.meta.url)));
const T = Date.parse('2026-01-01T00:00:00Z');

test('emparejamiento uno a uno por distancia y ventana; lo que no casa queda aparte', () => {
  const A = [{ t: T, lat: 0, lon: 0, mag: 5 }, { t: T + 3_600_000, lat: 10, lon: 10, mag: 6 }];
  const B = [{ t: T + 20_000, lat: 0.1, lon: 0, mag: 5.2 }, { t: T + 30_000, lat: 0.2, lon: 0, mag: 5.1 }, { t: T + 3_600_000, lat: 40, lon: 40 }];
  const r = matchEvents(A, B, { radiusKm: 100, windowS: 120 });
  assert.equal(r.pairs.length, 1); assert.equal(r.pairs[0].b, B[0]); assert.ok(Math.abs(r.pairs[0].dMag - 0.2) < 1e-9);
  assert.equal(r.onlyA.length, 1); assert.equal(r.onlyB.length, 2);
  assert.throws(() => matchEvents(A, B, { radiusKm: 0 }));
});

test('GDACS y USGS: concordancia real medida y declarada como NO independiente', () => {
  const g = eventsFromGdacs(ref('referencias/gdacs_eventos.json')).filter((e) => e.kind === 'GDACS_EQ').map((e) => ({ ...e, mag: e.value }));
  const u = eventsFromUsgs(ref('referencias/usgs_sismos.json'), { includeCases: false }).map((e) => ({ ...e, mag: e.value }));
  const c = concordance(g, u, { nameA: 'GDACS_EQ', nameB: 'USGS', radiusKm: 100, windowS: 120 });
  assert.equal(c.independence, 'DEPENDENT'); assert.match(c.verdictWord, /no es confirmación independiente/);
  assert.ok(c.matched > 50, `pares: ${c.matched}`); assert.ok(c.medianKm < 50); assert.ok(c.medianAbsS < 60);
  assert.equal(dependencyOf('USGS', 'GDACS_EQ').independent, false); assert.equal(dependencyOf('X', 'Y'), null);
});

test('Nepal 26-08-2026: señal sísmica real de USGS (landslide) y cambio Sentinel-2 forman una situación', () => {
  const u = eventsFromUsgs(ref('referencias/usgs_sismos.json')), s2 = eventsFromS2Change(ref('nepal2026/nepal_s2.json'));
  const anchor = u.find((e) => e.id === 'usgs:us7000tbwb');
  assert.equal(anchor.kind, 'USGS_landslide'); assert.equal(anchor.value, 5.2); assert.equal(anchor.t, Date.parse('2026-08-26T02:52:10Z'));
  assert.equal(s2.length, 1); assert.equal(s2[0].basis, 'MEASURED_SATELLITE');
  const [sit] = fuseSituations([anchor], [...u, ...s2]);
  assert.equal(sit.severity, 3); assert.ok(sit.corroboration >= 2);
  assert.ok(sit.facts.some((f) => /Sentinel-2/.test(f))); assert.ok(sit.facts.some((f) => /USGS/.test(f)));
});

test('fusión: USGS cerca de una alerta sísmica de GDACS se cita pero NO suma corroboración (no independientes)', () => {
  const anchor = { id: 'g1', t: T, lat: 0, lon: 0, kind: 'GDACS_EQ', label: 'Earthquake · alerta Orange', source: 'GDACS', basis: 'OFFICIAL_ALERT' };
  const q = { id: 'u1', t: T + 1000, lat: 0.01, lon: 0, kind: 'USGS_earthquake', value: 6, label: 'M 6', source: 'USGS', basis: 'MEASURED_SEISMIC' };
  const [sit] = fuseSituations([anchor], [q]);
  assert.equal(sit.corroboration, 0); assert.ok(sit.facts.some((f) => /no cuenta como corroboración/.test(f)));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fuseSituations, fireStartAnchors, anchorSeverity, DEFAULT_RULES } from '../src/fusion.mjs';
import { makeEvent, eventsFromGoes, eventsFromDgt, eventsFromGnss, eventsFromCameras } from '../src/atlas.mjs';

const R = resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public/senda/data/referencias'), j = (f) => JSON.parse(readFileSync(resolve(R, f), 'utf8'));
const ev = (o) => makeEvent({ source: 'prueba', basis: 'SIMULATION', ...o });

test('fusión sintética: junta carreteras y GPS del radio, ignora lo lejano y lo fuera de la ventana', () => {
  const a = ev({ id: 'a', t: 0, lat: 40, lon: -3.7, kind: 'DGT_accident', label: 'A-1 · Accidente' });
  const pool = [a, ev({ id: 'r1', t: 3_600_000, lat: 40.05, lon: -3.7, kind: 'DGT_roadMaintenance', label: 'A-1 · Obras' }), ev({ id: 'r2', t: 0, lat: 41, lon: -3.7, kind: 'DGT_roadMaintenance', label: 'M-30 · Obras' }),
    ev({ id: 'r3', t: 30 * 3_600_000, lat: 40.01, lon: -3.7, kind: 'DGT_roadMaintenance', label: 'A-2 · Obras' }), makeEvent({ id: 'g', t: 9e12, lat: 40.02, lon: -3.69, kind: 'GNSS_yellow', source: 'adsb', basis: 'MEASURED_ADSB', label: 'x' })];
  const [s] = fuseSituations([a], pool);
  assert.equal(s.evidence.filter((e) => e.layer === 'roads').length, 1, 'solo la obra a 5,6 km y dentro de 6 h');
  assert.ok(s.facts.some((f) => /integridad GPS en la zona: amarillo/.test(f)), 'GNSS no depende de la hora');
  assert.equal(s.corroboration, 2); assert.equal(s.severity, 2);
});

test('reglas declaradas y gravedad por etiqueta oficial', () => {
  assert.equal(DEFAULT_RULES.GDACS_DR.radiusKm, 0);
  assert.equal(anchorSeverity({ label: 'X · alerta Red' }), 3); assert.equal(anchorSeverity({ label: 'X · alerta Orange' }), 2); assert.equal(anchorSeverity({ kind: 'DGT_roadMaintenance' }), 1);
});

test('fusión con datos reales: el incendio Camp reúne detecciones GOES y cámaras públicas de Caltrans en su radio', () => {
  const fire = eventsFromGoes(j('goes_casos.json')), cams = eventsFromCameras(j('tfl_camaras.json'), j('referencias.json').caltrans);
  const sit = fuseSituations(fireStartAnchors(fire), [...fire, ...cams, ...eventsFromDgt(j('dgt_incidencias.json')), ...eventsFromGnss(j('adsb_gnss.json'))]);
  const camp = sit.find((s) => s.anchor.group === 'camp');
  assert.ok(camp && camp.evidence.some((e) => e.layer === 'fire') && camp.evidence.some((e) => e.layer === 'cameras'));
  assert.ok(camp.facts.every((f) => /\d/.test(f)), 'cada hecho lleva su número');
  assert.ok(camp.sources.length >= 2);
});

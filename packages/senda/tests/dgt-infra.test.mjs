import test from 'node:test';
import assert from 'node:assert/strict';
import { DGT_INFRA, speedZoneAdvice, sectionAverage, detectorQueue, vmsToHazard } from '../src/dgt-infra.mjs';
import { parseMeasured, parseVms, SAMPLE_MEASURED, SAMPLE_VMS } from '../src/datex2.mjs';

test('validación: ningún equipo de la DGT en la vía es una pasarela utilizable; detectar radares y publicar controles móviles es NUNCA', () => {
  assert.deepEqual(DGT_INFRA.filter((d) => d.gateway).map((d) => d.id), ['dgt30']);
  for (const id of ['detectar-radar', 'radar-movil']) assert.equal(DGT_INFRA.find((d) => d.id === id).access, 'NUNCA');
  assert.match(DGT_INFRA.find((d) => d.id === 'detectar-radar').legal, /2014/);
  for (const d of DGT_INFRA) assert.ok(d.emits && d.senda && d.legal, d.id);
});

test('zona de control publicada y radar de tramo: avisa de reducir y nunca propone superar el límite', () => {
  const z = speedZoneAdvice({ vKmh: 130, limitKmh: 100, distM: 500 }); assert.equal(z.over, true); assert.equal(z.decelMs2, 0.53);
  assert.equal(speedZoneAdvice({ vKmh: 90, limitKmh: 100, distM: 500 }).say, null);
  assert.equal(sectionAverage({ travelledM: 5000, elapsedS: 160, limitKmh: 100 }).over, true);
  const slow = sectionAverage({ travelledM: 5000, elapsedS: 200, limitKmh: 100 }); assert.equal(slow.say, null);
  assert.ok(!('maxRestKmh' in slow), 'no calcula «a cuánto puedes ir el resto»');
});

test('estaciones de aforo en DATEX II → final de la retención entre la 3 y la 4 y crece hacia atrás', () => {
  const m = parseMeasured(SAMPLE_MEASURED); assert.equal(m.length, 6); assert.deepEqual([m[3].flowVehH, m[3].speedKmh], [1200, 22]);
  const q = detectorQueue(m.map((x, i) => ({ ...x, s: i * 1000 })));
  assert.deepEqual(q.between, ['EST-3', 'EST-4']); assert.equal(q.sTail, 3000); assert.ok(q.growing && q.wKmh < -10);
  assert.equal(detectorQueue([{ id: 'a', s: 0, flowVehH: 1500, speedKmh: 100 }]), null);
});

test('paneles: el texto en español o neerlandés se convierte en aviso SENDA', () => {
  const v = parseVms(SAMPLE_VMS); assert.equal(v.length, 3); assert.equal(v[0].lat, 40.05);
  assert.deepEqual(v.map((p) => vmsToHazard(p.lines)), ['CRASH', 'FOG', 'CRASH']);
  assert.equal(vmsToHazard(['SPOOKRIJDER A2']), 'WRONG_WAY'); assert.equal(vmsToHazard(['BUEN VIAJE']), null);
});

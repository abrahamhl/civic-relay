import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bearingDeg, cameraRing, classifyCamera, perimeterAssessment, SIGNAL_RULES } from '../src/camera-perimeter.mjs';

const ref = (f) => JSON.parse(readFileSync(new URL(`../../../investor-next/public/senda/data/${f}`, import.meta.url)));

test('rumbos y sectores: una cámara al norte cae en N, otra al este en E; los demás sectores quedan ciegos', () => {
  const c = { lat: 40, lon: -3.7 };
  assert.ok(Math.abs(bearingDeg(c, { lat: 40.1, lon: -3.7 })) < 0.5); assert.ok(Math.abs(bearingDeg(c, { lat: 40, lon: -3.6 }) - 90) < 0.5);
  const r = cameraRing(c, [{ id: 'n', lat: 40.05, lon: -3.7 }, { id: 'e', lat: 40, lon: -3.65 }, { id: 'lejos', lat: 41, lon: -3.7 }], { radiusKm: 15 });
  assert.equal(r.covered, 2); assert.deepEqual(r.sectors.find((s) => s.name === 'N').cams.map((x) => x.id), ['n']);
  assert.equal(r.sectors.find((s) => s.name === 'E').cams[0].id, 'e'); assert.equal(r.blind.length, 6);
  assert.throws(() => cameraRing(c, [], { radiusKm: 0 }));
});

test('lectura de cámara: sin medir ≠ normal; aviso de la fuente; desactualizada; viva con movimiento y vehículos', () => {
  assert.equal(classifyCamera(undefined).state, 'SIN_MEDIR');
  assert.equal(classifyCamera({ placeholder: true }).state, 'SIN_IMAGEN');
  assert.equal(classifyCamera({ ageS: SIGNAL_RULES.freshMaxAgeS + 1 }).state, 'DESACTUALIZADA');
  const v = classifyCamera({ ageS: 120, motion: 0.05, vehicles: 7 }); assert.equal(v.state, 'VIVA'); assert.equal(v.moving, true); assert.equal(v.traffic, true);
  assert.equal(classifyCamera({ ageS: 120, motion: null, vehicles: 0 }).moving, null, 'sin imagen nueva el movimiento queda sin medir');
});

test('evaluación perimetral: nunca dice «confirmado»; lee la misma vía como indicio', () => {
  const ring = cameraRing({ lat: 40, lon: -3.7 }, [{ id: 'a', lat: 40.05, lon: -3.7, carretera: 'A-4' }, { id: 'b', lat: 39.95, lon: -3.7, carretera: 'M-50' }], { radiusKm: 15 });
  const r = perimeterAssessment(ring, { a: { ageS: 100, motion: 0.06, vehicles: 9 } }, { road: 'A-4' });
  assert.deepEqual(r.liveSectors, ['N']); assert.equal(r.roadReading.verdict, 'TRAFICO_PRESENTE');
  assert.ok(r.statements.every((t) => !/confirmad/i.test(t))); assert.match(r.roadReading.text, /no lo prueba/);
  assert.equal(perimeterAssessment(ring, {}, { road: 'A-4' }).roadReading.verdict, 'SIN_DATOS');
  assert.ok(perimeterAssessment({ ...ring, radiusKm: null }, {}).statements.every((t) => !/null/.test(t)), 'sin radio no escribe «null»');
});

test('medición REAL del cordón (DGT + YOLOX): procedencia completa y movimiento sin medir cuando la fuente no renovó', () => {
  const plan = ref('perimetro/plan.json'), m = ref('perimetro/medicion.json');
  assert.ok(plan.casos.length > 0); assert.match(m.modelo.nombre, /Apache 2\.0/); assert.match(m.modelo.sha256, /^[0-9a-f]{64}$/);
  const cams = Object.values(m.camaras).filter((s) => !s.error);
  assert.ok(cams.length > 10);
  for (const s of cams) { assert.equal(s.sha256.length, 2); if (s.identicas) assert.equal(s.motion, null); if (!s.placeholder) assert.ok(Number.isInteger(s.vehicles)); }
  const caso = plan.casos[0], sig = Object.fromEntries(Object.entries(m.camaras));
  const ring = { radiusKm: plan.radioKm, blind: caso.ciegos, sectors: caso.sectores.map((s) => ({ name: s.nombre, total: s.total, cams: s.camara ? [s.camara] : [] })) };
  const a = perimeterAssessment(ring, sig, { road: caso.carretera });
  assert.equal(a.sectors.length, 8); assert.ok(a.statements[0].startsWith('Comprobable visualmente ahora en'));
});

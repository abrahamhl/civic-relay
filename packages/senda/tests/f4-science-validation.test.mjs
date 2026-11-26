import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAngroisPublicPhysicsCheck } from '../src/rail-physics-etcs.mjs';
import { rothermelSpread } from '../src/fire-rothermel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('F4 · dana-f4-crossval.json tiene huella SHA-256 íntegra, física de celeridad Manning y CV espacial 4-fold', () => {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'evidence/quality/dana-f4-crossval.json'), 'utf8'));
  const { sha256, ...body } = raw;
  const expectedSha = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  assert.equal(sha256, expectedSha, 'SHA-256 del informe F4 DANA debe coincidir exactamente');

  // 1. Física de celeridad Manning (Chow 1959): barranco encajonado vs malla gruesa vs cono aluvial
  const r = raw.celerityPhysics.regimes;
  assert.ok(r.chivaConfinedGorge30m.velocityMs >= 10 && r.chivaConfinedGorge30m.velocityMs <= 16,
    `Chiva 30 m debe estar en el orden de 10–16 m/s (got ${r.chivaConfinedGorge30m.velocityMs})`);
  assert.ok(r.chivaConfinedGorge30m.froude > 1.0, 'Flujo en barranco encajonado de Chiva debe ser supercrítico');
  assert.ok(r.coarseGridCell118m.velocityMs < r.chivaConfinedGorge30m.velocityMs,
    'Malla gruesa 118 m atenúa la velocidad frente a B=30 m');
  assert.ok(r.alluvialFanHortaSud1500m.velocityMs < 2.0 && r.alluvialFanHortaSud1500m.froude < 0.5,
    'Cono aluvial de 1500 m debe ser subcrítico y < 2 m/s');

  // 2. Conservación de masa en todos los candidatos FV2D y línea base Bates
  assert.ok(Math.abs(raw.baselineBates.massError) < 1e-9);
  assert.ok(raw.candidates.length >= 4);
  for (const c of raw.candidates) {
    assert.ok(Math.abs(c.massError) < 1e-9, `Conservación de masa fallida en ${c.id}: ${c.massError}`);
    assert.ok(c.maxVelGorgeMs > 3.0, `Velocidad en garganta FV2D debe superar 3 m/s en ${c.id}`);
  }

  // 3. Validación cruzada espacial de 4 particiones disjuntas sin ocultar brecha de sobreajuste
  const cv = raw.spatialCrossValidation;
  assert.equal(cv.folds.length, 4);
  const pairs = cv.folds.map((f) => `${f.trainSplit}→${f.testSplit}`);
  assert.deepEqual(pairs, ['north→south', 'south→north', 'west→east', 'east→west']);
  for (const f of cv.folds) {
    const expectedGap = +(f.trainCsi - f.testCsi).toFixed(4);
    assert.equal(f.overfitGap, expectedGap, `overfitGap exacto en ${f.trainSplit}→${f.testSplit}`);
  }
  assert.ok(raw.landUseProxyNotice.includes('proxy DEM+OSM'),
    'Debe declararse explícitamente que la zonificación CLC/SIOSE es proxy DEM+OSM');
});

test('F4 · AUDITORIA_PARAMETROS_F4.md cita literalmente Rothermel, Scott & Burgan, ETCS, Kish-Samavedam y marca NO VERIFICADO', () => {
  const doc = readFileSync(resolve(ROOT, 'docs/validacion/AUDITORIA_PARAMETROS_F4.md'), 'utf8');
  for (const token of [
    'INT-115',
    'RMRS-GTR-153',
    'RMRS-GTR-371',
    'SUBSET-026-3',
    'DOT/FRA/ORD-13/01',
    'EN 14363',
    '0054/2013',
    'FUEL_LOAD',
    'NO VERIFICADO',
    'APROXIMACIÓN DE ORDEN REDUCIDO',
  ]) {
    assert.ok(doc.includes(token), `AUDITORIA_PARAMETROS_F4.md debe incluir '${token}'`);
  }
});

test('F4 · Contratos físicos de incendio (Rothermel) y tren (Angrois CIAF 0054/2013)', () => {
  // Rothermel rechaza parámetros ausentes (sin valores por defecto ocultos)
  assert.throws(() => rothermelSpread('GR2', { dead1hMoisture: 0.06 }), RangeError);
  const res = rothermelSpread('SH5', {
    dead1hMoisture: 0.05, dead10hMoisture: 0.07, dead100hMoisture: 0.09,
    liveHerbMoisture: 0.60, liveWoodyMoisture: 0.90,
    midflameWindMs: 5, slopeDeg: 15,
  });
  assert.equal(res.basis, 'MODEL');
  assert.ok(res.rosMs > 0 && res.flameLengthM > 0);

  // Angrois: peralte 130 mm (CIAF 0054/2013) y fricción instantánea marcada NOT_VERIFIED
  const ang = buildAngroisPublicPhysicsCheck({
    etcsParams: {
      vInitialKmh: 200, vTargetKmh: 80,
      aSafeEmergencyMs2: 1.0, aServiceMs2: 0.7,
      tBrakeEmergencyS: 2.0, tBrakeServiceS: 2.5,
      tTractionCutoffS: 1.5, aEstTractionMs2: 0.4,
      tWarningS: 2.0, tDriverS: 4.0, tIndicationS: 5.0,
      gradientPermille: 0, dTargetM: 1200,
    },
    wheelRailFriction: 0.30, flangeAngleDeg: 70, wheelLoadKN: 85, aNcLimitMs2: 1.0,
  });
  const cant = ang.parameters.find((p) => p.name === 'peralte');
  assert.equal(cant.value, 130);
  assert.equal(cant.basis, 'PUBLISHED_FACT');
  assert.ok(ang.unverifiedFields.includes('friccionRuedaCarrilInstantanea'));
});

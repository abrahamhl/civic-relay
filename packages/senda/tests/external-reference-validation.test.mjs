// Contraste contra referencias EXTERNAS e independientes del código bajo prueba.
// - ITU-R P.838-3, Tabla 5: valores tabulados de k y α (fuente distinta de los coeficientes
//   de regresión de las Tablas 1-4 que usa la implementación).
// - ISO 9613-1: propiedades físicas de la absorción atmosférica (no valores de una tabla
//   reproducida de memoria; ver docs/engineering/SENDA_MASTER_ENGINEERING_PLAN.md, V&V-04).
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRainAttenuation, computeCompleteLinkBudget } from '../src/telecom-mathematical-physics.mjs';
import { computeIso9613AbsorptionDbPerM } from '../src/acoustic-beamforming-survival.mjs';

const P838_TABLE5 = [
  // f GHz, kH, αH, kV, αV
  [1, 0.0000259, 0.9691, 0.0000308, 0.8592],
  [2, 0.0000847, 1.0664, 0.0000998, 0.949],
  [4, 0.0001071, 1.6009, 0.0002461, 1.2476],
  [6, 0.0007056, 1.59, 0.0004878, 1.5728],
  [8, 0.004115, 1.3905, 0.00345, 1.3797],
  [10, 0.01217, 1.2571, 0.01129, 1.2156],
  [20, 0.09164, 1.0568, 0.09611, 0.9847],
  [30, 0.2403, 0.9485, 0.2291, 0.9129],
];

test('ITU-R P.838-3: k y α reproducen la Tabla 5 con error relativo ≤ 0,1 %', () => {
  for (const [f, kH, aH, kV, aV] of P838_TABLE5) {
    const h = computeRainAttenuation(f, 20, 'H');
    const v = computeRainAttenuation(f, 20, 'V');
    for (const [got, ref, name] of [[h.k, kH, 'kH'], [h.alpha, aH, 'αH'], [v.k, kV, 'kV'], [v.alpha, aV, 'αV']]) {
      assert.ok(Math.abs(got / ref - 1) <= 1e-3, `${name}@${f} GHz: ${got} vs ${ref}`);
    }
  }
});

test('ITU-R P.838-3: γ_R continua (sin el salto heredado de 6 GHz) en 1–40 GHz', () => {
  let prev = computeRainAttenuation(1, 20, 'V').specificAttenuationDbPerKm;
  for (let f = 1.01; f <= 40; f += 0.01) {
    const g = computeRainAttenuation(f, 20, 'V').specificAttenuationDbPerKm;
    assert.ok(Math.abs(g - prev) <= Math.max(0.02 * prev, 2e-4), `salto en ${f.toFixed(2)} GHz: ${prev} → ${g}`);
    prev = g;
  }
});

test('Presupuesto de enlace: marca como no conforme una PIRE que supera ETSI', () => {
  const base = { txAntennaGainDbi: 5, txCableLossDb: 1, rxAntennaGainDbi: 6, frequencyHz: 869.5e6, distanceM: 8500, rxSensitivityDbm: -130 };
  assert.equal(computeCompleteLinkBudget({ ...base, txPowerDbm: 27 }).isRegulatoryCompliant, false); // 31 dBm > 29,15
  assert.equal(computeCompleteLinkBudget({ ...base, txPowerDbm: 25 }).isRegulatoryCompliant, true); // 29 dBm
});

test('ISO 9613-1: orden de magnitud, monotonía en frecuencia y dependencia de humedad', () => {
  const a1k = computeIso9613AbsorptionDbPerM(1000) * 1000; // dB/km a 20 °C, 50 %
  assert.ok(a1k > 4 && a1k < 5.5, `1 kHz: ${a1k} dB/km`);
  let prev = 0;
  for (const f of [500, 1000, 2000, 4000, 8000, 16000, 20000]) {
    const a = computeIso9613AbsorptionDbPerM(f);
    assert.ok(a > prev, `no monótona en ${f} Hz`); prev = a;
  }
  // A 20 kHz el aire seco y caliente de un incendio absorbe más que el aire templado y húmedo.
  assert.ok(computeIso9613AbsorptionDbPerM(20000, 35, 20) > computeIso9613AbsorptionDbPerM(20000, 20, 70));
  assert.throws(() => computeIso9613AbsorptionDbPerM(-1));
});

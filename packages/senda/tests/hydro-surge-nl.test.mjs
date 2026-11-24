import test from 'node:test';
import assert from 'node:assert/strict';
import {
  manningOpenChannel,
  vehicleFloodStability,
  eurotopOvertopping,
  polderNapClearance,
} from '../src/hydro-surge-nl.mjs';

test('Hidrología ES/NL: Manning exacto y criterio Martínez-Gomariz/Shand de flotación de vehículos', () => {
  // Canal hormigón n=0.015, R_h=0.5 m, S=0.004 -> v = (1/0.015)*0.5^(2/3)*sqrt(0.004) ≈ 2.656 m/s
  const m = manningOpenChannel({ hydraulicRadiusM: 0.5, slope: 0.004, manningN: 0.015, areaM2: 4 });
  assert.ok(Math.abs(m.velocityMs - 2.656) < 0.01);
  assert.ok(Math.abs(m.dischargeM3s - 10.625) < 0.05);

  assert.equal(vehicleFloodStability({ depthM: 0.05, velocityMs: 0.2 }).level, 'SAFE');
  assert.equal(vehicleFloodStability({ depthM: 0.18, velocityMs: 0.5 }).level, 'CAUTION_AQUAPLANING');
  assert.equal(vehicleFloodStability({ depthM: 0.32, velocityMs: 0.5 }).level, 'UNSTABLE_PASSENGER_CAR');
  assert.equal(vehicleFloodStability({ depthM: 0.25, velocityMs: 2.0 }).level, 'UNSTABLE_PASSENGER_CAR'); // D*v = 0.50 >= 0.45
  assert.equal(vehicleFloodStability({ depthM: 0.55, velocityMs: 1.2 }).level, 'EXTREME_WASH_AWAY');
});

test('Hidrología NL: rebase de oleaje EurOtop (2018) y resguardo altimétrico frente a NAP', () => {
  // Dique con H_m0 = 2.0 m: a menor francobordo R_c, el rebase q crece exponencialmente
  const lowRc = eurotopOvertopping({ hm0M: 2.0, freeboardRcM: 1.5 });
  const highRc = eurotopOvertopping({ hm0M: 2.0, freeboardRcM: 4.5 });
  assert.ok(lowRc.qLsPerM > highRc.qLsPerM * 10);
  assert.equal(lowRc.severity, 'CRITICAL_DIKE_DAMAGE');

  // Pólder típico neerlandés (ej. Flevoland / Haarlemmermeer a -4.2 m NAP)
  const polder = polderNapClearance({ roadElevationNapM: -4.2, waterLevelNapM: 1.1, dikeCrestNapM: 4.8 });
  assert.equal(polder.belowSeaLevel, true);
  assert.equal(polder.inundatedIfUnprotected, true);
  assert.equal(polder.dikeFreeboardM, 3.7);
});

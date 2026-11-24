import test from 'node:test';
import assert from 'node:assert/strict';
import { createGnssImuEkf, createHorizonCalibrator } from '../src/drive-kalman-fusion.mjs';

test('EKF 6 estados GNSS+IMU: convergencia en autopista, rechazo multipath χ² y dead-reckoning transparente en túnel', () => {
  const ekf = createGnssImuEkf();
  const lon0 = 4.9041, lat0 = 52.3676; // Amsterdam (ej. entrada Coentunnel)
  const v = 25; // 90 km/h hacia el Norte (heading 0°)
  const mPerDegLat = 111_132.95;

  // 10 s de GNSS estable a 1 Hz
  let t = 1_700_000_000_000;
  for (let i = 0; i < 10; i++) {
    const lat = lat0 + (v * i) / mPerDegLat;
    const s = ekf.updateGnss({ lon: lon0, lat, accuracyM: 5, speedMs: v, headingDeg: 0, tMs: t + i * 1000 });
    assert.equal(s.mode, 'GNSS_FUSED');
    assert.equal(s.gnssRejected, false);
  }

  // Salto multipath absurdo de 350 m al este en t=10 s -> rechazado por puerta χ²
  const spike = ekf.updateGnss({ lon: lon0 + 0.005, lat: lat0 + (v * 10) / mPerDegLat, accuracyM: 5, speedMs: v, headingDeg: 0, tMs: t + 10_000 });
  assert.equal(spike.gnssRejected, true);
  assert.equal(ekf.outliersRejected, 1);

  // Túnel sin GPS durante 6 s (dead-reckoning solo con IMU constante a 25 m/s)
  let dr;
  for (let i = 11; i <= 16; i++) {
    dr = ekf.predict({ tMs: t + i * 1000, aLongMs2: 0, yawRateRadS: 0 });
  }
  assert.equal(dr.mode, 'DEAD_RECKONING_IMU');
  // Tras 16 s a 25 m/s → ~400 m al Norte
  assert.ok(Math.abs(dr.enuM[1] - 400) < 15, `pN esperado ~400 m, obtenido ${dr.enuM[1]}`);
  assert.ok(dr.sigmaPosM > 5, 'la incertidumbre debe crecer honestamente sin GPS');
});

test('Auto-calibrador online de horizonte: converge al cabeceo real del parabrisas e ignora curvas/paradas', () => {
  const cal = createHorizonCalibrator({ fovVDeg: 48, nominalHorizonY: 0.48 });
  // Parado o girando fuerte -> no actualiza
  for (let i = 0; i < 10; i++) cal.update({ ax: 0, ay: 9.78, az: 0.85, speedMs: 2, yawRateRadS: 0 });
  assert.equal(cal.status().samples, 0);

  // Conducción recta estable con soporte inclinado +5° hacia abajo (tan(5°) ≈ 0.0875 → az ≈ 0.855, ay ≈ 9.77)
  for (let i = 0; i < 40; i++) {
    cal.update({ ax: 0.1, ay: 9.77, az: 0.855, speedMs: 25, yawRateRadS: 0.005, aLongMs2: 0.1 });
  }
  const st = cal.status();
  assert.equal(st.calibrated, true);
  assert.ok(Math.abs(st.pitchDeg - 5.0) < 0.3, `pitchDeg esperado ~5°, obtenido ${st.pitchDeg}`);
  assert.ok(st.horizonY < 0.48, 'al mirar más abajo el horizonte sube en imagen');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  C_LIGHT, G_STD, EXAMPLE_RSS_PARAMS,
  rssLongitudinalSameDir, rssLongitudinalOppositeDir,
  twoRayV2vChannel, bleChannelSoundingRange, estimatePlanarKinematics,
} from '../src/drive-physics-v2.mjs';

test('RSS exige declarar parámetros explícitamente (regla CLAUDE.md: sin valores ocultos sin fuente)', () => {
  assert.throws(() => rssLongitudinalSameDir({ vRearMs: 30, vFrontMs: 30 }, {}), /debe declararse/);
  assert.throws(() => rssLongitudinalOppositeDir({ v1Ms: 25, v2Ms: 25 }, { rhoS: 1 }), /debe declararse/);
});

test('RSS mismo sentido (arXiv:1708.06374 Def. 1) y sentido opuesto (Def. 2): fórmula exacta', () => {
  // Mismo sentido a 108 km/h (30 m/s) ambos coches con EXAMPLE_RSS_PARAMS
  const r = rssLongitudinalSameDir({ vRearMs: 30, vFrontMs: 30 }, EXAMPLE_RSS_PARAMS);
  const vRho = 30 + 1.5 * 2.0; // 33 m/s
  const expected = 30 * 1.5 + 0.5 * 2.0 * 1.5 ** 2 + (vRho ** 2) / (2 * 3.4) - (30 ** 2) / (2 * 8.0);
  assert.ok(Math.abs(r.dMinM - expected) < 0.01, `esperado ${expected}, obtenido ${r.dMinM}`);
  assert.match(r.basis, /EJEMPLO_DECLARADO/);

  // Sentido contrario a 90 km/h (25 m/s) cada coche: siempre mayor que mismo sentido
  const opp = rssLongitudinalOppositeDir({ v1Ms: 25, v2Ms: 25 }, EXAMPLE_RSS_PARAMS);
  assert.ok(opp.dMinM > 200, `distancia segura frontal a 90+90 km/h debe superar 200 m, salió ${opp.dMinM}`);
});

test('Two-Ray V2V a 2,44 GHz (BLE): distancia crítica, régimen 1/d⁴, Doppler y ventana de contacto a 120+120 km/h', () => {
  // Dos coches con móvil a 1,2 m de altura, cruce frontal a 120+120 km/h (v_rel = 66,67 m/s)
  const ch40 = twoRayV2vChannel({ distM: 40, freqHz: 2.44e9, htM: 1.2, hrM: 1.2, vRelMs: 240 / 3.6 });
  const lambda = C_LIGHT / 2.44e9;
  const expectedDc = (4 * Math.PI * 1.2 * 1.2) / lambda; // ~147 m
  assert.ok(Math.abs(ch40.dCritM - expectedDc) < 0.1);
  assert.equal(ch40.regime, 'FRIIS_NEAR');
  assert.ok(Math.abs(ch40.contactWindowS - 1.2) < 0.05, `ventana contacto 40 m @ 240 km/h ≈ 1,2 s, salió ${ch40.contactWindowS}`);
  assert.ok(ch40.dopplerHz > 500 && ch40.dopplerHz < 560);
  assert.ok(ch40.coherenceTimeMs < 1.0);

  // A 300 m (> d_c): régimen 1/d⁴ (40 dB/década)
  const ch300 = twoRayV2vChannel({ distM: 300, freqHz: 2.44e9, htM: 1.2, hrM: 1.2 });
  const ch600 = twoRayV2vChannel({ distM: 600, freqHz: 2.44e9, htM: 1.2, hrM: 1.2 });
  assert.equal(ch300.regime, 'TWO_RAY_FAR_D4');
  // Doblar distancia en 1/d⁴ suma exactamente 40*log10(2) = 12,04 dB
  assert.ok(Math.abs((ch600.twoRayAsympDb - ch300.twoRayAsympDb) - 12.04) < 0.05);
});

test('Bluetooth 6.0 Channel Sounding: ambigüedad ~150 m a Δf = 1 MHz y resolución con RTT', () => {
  // Distancia real = 185 m (> d_amb ≈ 149,9 m)
  const dTrue = 185;
  const df = 1e6;
  const deltaPhi = (4 * Math.PI * df * dTrue) / C_LIGHT;
  const rttNs = (2 * dTrue / C_LIGHT) * 1e9;
  const pbrOnly = bleChannelSoundingRange({ deltaPhiRad: deltaPhi, deltaFreqHz: df });
  assert.ok(Math.abs(pbrOnly.dAmbM - 149.896) < 0.01);
  assert.ok(pbrOnly.dPbrM < 40, 'sin RTT la fase se pliega módulo 150 m');

  const resolved = bleChannelSoundingRange({ deltaPhiRad: deltaPhi, deltaFreqHz: df, rttNs });
  assert.equal(resolved.wrapIndex, 1);
  assert.ok(Math.abs(resolved.dResolvedM - dTrue) < 0.02, `esperado ${dTrue} m, salió ${resolved.dResolvedM} m`);
});

test('cinemática planar GNSS: frenada, giro atravesando 359°→1° y radio de curvatura', () => {
  // Frenada constante a -4 m/s² manteniendo rumbo norte
  const brake = [0, 1, 2, 3, 4].map((t) => ({ t, speedMs: 25 - 4 * t, headingDeg: 0 }));
  const kb = estimatePlanarKinematics(brake);
  assert.ok(Math.abs(kb.axMs2 - (-4)) < 0.01);
  assert.ok(Math.abs(kb.aNormG - (4 / G_STD)) < 0.01);

  // Giro constante 10°/s a 20 m/s cruzando el norte (350° → 360°/0° → 10° → 20°)
  const turn = [0, 1, 2, 3].map((t) => ({ t, speedMs: 20, headingDeg: (350 + 10 * t) % 360 }));
  const kt = estimatePlanarKinematics(turn);
  const expectedAy = 20 * (10 * Math.PI / 180); // ~3,49 m/s²
  const expectedR = 20 / (10 * Math.PI / 180);  // ~114,6 m
  assert.ok(Math.abs(kt.ayMs2 - expectedAy) < 0.02, `esperado ay=${expectedAy}, salió ${kt.ayMs2}`);
  assert.ok(Math.abs(kt.curveRadiusM - expectedR) < 0.5, `esperado R=${expectedR}, salió ${kt.curveRadiusM}`);
});

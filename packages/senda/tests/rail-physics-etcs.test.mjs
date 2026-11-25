import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEtcsBrakingCurves,
  assessCwrThermalBuckling,
  evaluateNadalDerailment,
  evaluatePrudhommeTrackShift,
  buildPublicRailReconstruction,
  buildAngroisPublicPhysicsCheck,
} from '../src/rail-physics-etcs.mjs';

const ETCS_SAMPLE = {
  vInitialKmh: 200,
  vTargetKmh: 80,
  aSafeEmergencyMs2: 1.1,
  aServiceMs2: 0.75,
  tBrakeEmergencyS: 3.0,
  tBrakeServiceS: 4.0,
  tTractionCutoffS: 1.5,
  aEstTractionMs2: 0.3,
  tWarningS: 2.0,
  tDriverS: 4.0,
  tIndicationS: 5.0,
  gradientPermille: 0,
  dTargetM: 3000,
};

test('ETCS SUBSET-026-3: verificación analítica de EBD y orden estricto EBD < EBI ≤ SBI < Warning < Permitted < Indication', () => {
  const res = computeEtcsBrakingCurves(ETCS_SAMPLE);
  assert.equal(res.basis, 'MODEL');
  assert.ok(res.standard.includes('SUBSET-026-3'));
  assert.ok(res.functionalSafetyNotice.includes('SIL-4'));

  // Verificación analítica exacta de EBD: (v0² - vt²) / (2 * a_eb)
  const v0 = 200 / 3.6, vt = 80 / 3.6;
  const exactEbd = (v0 * v0 - vt * vt) / (2 * 1.1);
  assert.ok(Math.abs(res.distancesM.EBD - exactEbd) < 0.2, `EBD=${res.distancesM.EBD} vs exacto=${exactEbd.toFixed(1)}`);

  // Jerarquía estricta de distancias de supervisión
  const d = res.distancesM;
  assert.ok(d.EBD < d.EBI);
  assert.ok(d.EBI <= d.SBI);
  assert.ok(d.SBI < d.Warning);
  assert.ok(d.Warning < d.Permitted);
  assert.ok(d.Permitted < d.Indication);

  // Pendiente descendente (-15‰) alarga todas las distancias de frenado
  const downhill = computeEtcsBrakingCurves({ ...ETCS_SAMPLE, gradientPermille: -15 });
  assert.ok(downhill.distancesM.EBD > res.distancesM.EBD);
  assert.ok(downhill.distancesM.Permitted > res.distancesM.Permitted);

  // Estados de supervisión al acortarse la distancia al objetivo
  assert.equal(computeEtcsBrakingCurves({ ...ETCS_SAMPLE, dTargetM: d.Indication + 200 }).supervisionStatus, 'NORMAL');
  assert.equal(computeEtcsBrakingCurves({ ...ETCS_SAMPLE, dTargetM: (d.Permitted + d.Indication) / 2 }).supervisionStatus, 'INDICATION');
  assert.equal(computeEtcsBrakingCurves({ ...ETCS_SAMPLE, dTargetM: (d.EBI + d.SBI) / 2 }).supervisionStatus, 'SERVICE_BRAKE_INTERVENTION');
  assert.equal(computeEtcsBrakingCurves({ ...ETCS_SAMPLE, dTargetM: (d.EBD + d.EBI) / 2 }).supervisionStatus, 'EMERGENCY_BRAKE_INTERVENTION');
  assert.equal(computeEtcsBrakingCurves({ ...ETCS_SAMPLE, dTargetM: d.EBD - 50 }).supervisionStatus, 'TARGET_OVERSHOOT');
});

test('Pandeo térmico CWR (Kish & Samavedam 2013): T_B,min ≤ T_B,max, sensibilidad a curvatura y balasto desconsolidado', () => {
  const base60E1 = {
    railTempC: 48,
    neutralTempC: 25,
    railAreaM2: 7.684e-3,
    railIzM4: 5.12e-6,
    youngModulusPa: 210e9,
    thermalAlphaPerK: 11.5e-6,
    lateralBallastPeakNPerM: 15000,
    lateralBallastLimitNPerM: 10000,
    initialMisalignmentMm: 4,
    curveRadiusM: Infinity,
  };
  const tangent = assessCwrThermalBuckling(base60E1);
  // Verificación exacta de fuerza axial térmica: P = 2 * E * A * α * ΔT
  const exactP_kN = (2 * 210e9 * 7.684e-3 * 11.5e-6 * 23) / 1000;
  assert.ok(Math.abs(tangent.axialForceKN - exactP_kN) < 0.2);
  assert.ok(tangent.tBMinC < tangent.tBMaxC, 'en vía recta consolidada debe existir barrera de energía positiva');
  assert.equal(tangent.status, 'SAFE');

  // Vía en curva cerrada (R = 350 m) recién bateada (balasto flojo F_p = 7 kN/m, F_L = 5 kN/m) a 62 °C → riesgo crítico
  const critical = assessCwrThermalBuckling({
    ...base60E1,
    railTempC: 62,
    lateralBallastPeakNPerM: 7000,
    lateralBallastLimitNPerM: 5000,
    initialMisalignmentMm: 12,
    curveRadiusM: 350,
  });
  assert.ok(critical.tBMaxC < tangent.tBMaxC, 'curvatura y balasto débil reducen la temperatura crítica');
  assert.ok(['HIGH_ENERGY_BARRIER_RISK', 'CRITICAL_SPONTANEOUS_BUCKLING_RISK'].includes(critical.status));
});

test('Nadal (1908), Weinstock (1984) y Prud\'homme (EN 14363): verificación analítica exacta', () => {
  // Caso de referencia EN 14363: ángulo de pestaña β = 70°, fricción μ = 0,36
  // Nadal exacto = (tan 70° - 0.36) / (1 + 0.36 * tan 70°) = (2.747477 - 0.36) / (1 + 0.98909) = 1.2003
  const ok = evaluateNadalDerailment({
    flangeAngleDeg: 70,
    wheelRailFriction: 0.36,
    lateralForceKN: 45,
    verticalForceKN: 80,
    oppositeWheelLateralKN: 10,
    oppositeWheelVerticalKN: 80,
  });
  assert.ok(Math.abs(ok.nadalLimit - 1.2003) < 0.002, `nadalLimit=${ok.nadalLimit}`);
  assert.equal(ok.exceedsEn14363, false);
  assert.equal(ok.exceedsNadal, false);
  assert.equal(ok.weinstock.exceeded, false);

  // Rueda descargada con alto esfuerzo lateral → remonte de pestaña
  const climb = evaluateNadalDerailment({
    flangeAngleDeg: 70,
    wheelRailFriction: 0.36,
    lateralForceKN: 65,
    verticalForceKN: 50,
  });
  assert.equal(climb.exceedsNadal, true);
  assert.equal(climb.verdict, 'REMONTE_PESTANA_INMINENTE_NADAL');

  // Prud'homme: P0 = 180 kN (18 t/eje), vía consolidada α = 1.0 → H_lim = 10 + 60 = 70 kN; desconsolidada α = 0.85 → 59.5 kN
  const pCons = evaluatePrudhommeTrackShift({ axleLoadKN: 180, sumLateralForceKN: 62, trackFactorAlpha: 1.0 });
  const pDecons = evaluatePrudhommeTrackShift({ axleLoadKN: 180, sumLateralForceKN: 62, trackFactorAlpha: 0.85 });
  assert.equal(pCons.limitKN, 70);
  assert.equal(pCons.exceeded, false);
  assert.equal(pDecons.limitKN, 59.5);
  assert.equal(pDecons.exceeded, true);
});

test('Reconstrucción pública documentada (Angrois CIAF 0054/2013 + plantilla Adamuz con NO_VERIFICADO) y rechazo de omisiones', () => {
  const angrois = buildAngroisPublicPhysicsCheck({
    etcsParams: { ...ETCS_SAMPLE, dTargetM: 1200 },
    wheelRailFriction: 0.36,
    flangeAngleDeg: 70,
  });
  assert.equal(angrois.caseId, 'angrois-2013-public');
  assert.ok(angrois.unverifiedFields.includes('friccionRuedaCarrilInstantanea'));
  // A 1200 m de la curva entrando a 200 km/h, la distancia de frenado ETCS Permitted (>2000 m) ya habría disparado intervención
  assert.ok(angrois.physicsEvaluations.etcsBraking.distancesM.Permitted > 2000);
  assert.notEqual(angrois.physicsEvaluations.etcsBraking.supervisionStatus, 'NORMAL');

  // Plantilla pública Adamuz 2026: campos no publicados oficialmente quedan estrictamente NO_VERIFICADO
  const adamuz = buildPublicRailReconstruction({
    caseId: 'adamuz-2026-public-template',
    title: 'Plantilla pública Adamuz (18-01-2026) — pendiente informe final CIAF',
    dateIso: '2026-01-18',
    officialSource: 'Investigación CIAF en curso (solo hechos públicos comunicados)',
    parameters: [
      { name: 'fechaIncidente', value: '2026-01-18', basis: 'PUBLISHED_FACT', source: 'Comunicados oficiales 18-01-2026' },
      { name: 'tensionCircuitoViaExacta', value: 0.9, basis: 'NOT_VERIFIED' },
      { name: 'friccionCarril', value: null, basis: 'NOT_VERIFIED' },
    ],
  });
  assert.equal(adamuz.parameters[1].value, 'NO_VERIFICADO');
  assert.equal(adamuz.unverifiedFields.length, 2);

  // Regla de veracidad: falla si falta cualquier parámetro obligatorio o fuente en PUBLISHED_FACT
  assert.throws(() => computeEtcsBrakingCurves({ vInitialKmh: 200, vTargetKmh: 80 }), /aSafeEmergencyMs2/);
  assert.throws(() => evaluateNadalDerailment({ flangeAngleDeg: 70, lateralForceKN: 40, verticalForceKN: 80 }), /wheelRailFriction/);
  assert.throws(() => evaluatePrudhommeTrackShift({ axleLoadKN: 180, sumLateralForceKN: 50 }), /trackFactorAlpha/);
  assert.throws(() => buildPublicRailReconstruction({
    caseId: 'bad',
    title: 'Sin fuente',
    dateIso: '2026-01-01',
    officialSource: 'X',
    parameters: [{ name: 'p', value: 1, basis: 'PUBLISHED_FACT' }],
  }), /fuente oficial/);
});

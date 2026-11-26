// @ts-check
/**
 * SENDA · Física ferroviaria avanzada: curvas de frenado ETCS (UNISIG SUBSET-026-3),
 * pandeo térmico no lineal de carril soldado (Kish & Samavedam 2013), criterio de descarrilamiento
 * de Nadal (1908) / Weinstock (1984) / Prud'homme (EN 14363) y reconstrucción exclusivamente con datos públicos.
 *
 * Complementa a `rail-watch.mjs`, `rail-incident.mjs` y `rail-advanced-safety.mjs` como módulo ES puro
 * compatible con navegador y Node (cero importaciones `node:*`).
 *
 * Referencias publicadas:
 *  - Curvas de frenado y supervisión ETCS:
 *    UNISIG / ERA (2016). «ERTMS/ETCS System Requirements Specification — SUBSET-026-3, Baseline 3 Release 2,
 *    Version 3.6.0», §3.13 («Speed and Distance Monitoring»). Agencia Ferroviaria de la Unión Europea (ERA).
 *  - Pandeo térmico por barrera de energía en barra larga soldada (CWR):
 *    Kish, A. & Samavedam, G. (2013). «Track Buckling Prevention: Theory, Safety Concepts, and Applications».
 *    US DOT / FRA Report DOT/FRA/ORD-13/01 (Volpe National Transportation Systems Center).
 *  - Criterio de remonte de pestaña (descarrilamiento) y ripado de vía:
 *    Nadal, M. J. (1908). «Locomotives à vapeur», Collection Encyclopédie Scientifique, París;
 *    Weinstock, H. (1984). «Wheel climb derailment criteria for evaluation of rail vehicle safety», ASME 84-WA/RT-1;
 *    Prud'homme, A. (1967). «La résistance de la voie aux efforts transversaux exercés par le matériel roulant»,
 *    Revue Générale des Chemins de Fer;
 *    CEN (2018). «EN 14363:2016+A1:2018 — Railway applications: Testing and simulation for the acceptance of
 *    running characteristics of railway vehicles».
 *
 * AVISO DE SEGURIDAD FUNCIONAL:
 * Este módulo es una herramienta de análisis físico, auditoría preventiva y reconstrucción pericial.
 * NO forma parte de ningún equipo embarcado vital SIL-4 (CENELEC EN 50126 / EN 50128 / EN 50129).
 * Regla de veracidad (CLAUDE.md): los parámetros físicos y de tren son OBLIGATORIOS (sin valores por defecto ocultos).
 */

const G_ACCEL = 9.80665;
const DEG = Math.PI / 180;

function reqFinite(v, name) {
  if (!Number.isFinite(v)) throw new RangeError(`rail-physics-etcs: parámetro obligatorio '${name}' ausente o no finito`);
  return v;
}

/* ───────────── 1. Curvas de frenado ETCS (UNISIG SUBSET-026-3 v3.6.0, §3.13) ───────────── */

/**
 * Calcula las 6 curvas de supervisión ETCS (EBD, EBI, SBI, Warning, Permitted e Indication)
 * según UNISIG SUBSET-026-3 Baseline 3 Release 2 (v3.6.0, §3.13.4–§3.13.9).
 *
 * Todos los parámetros de tren, frenado y vía son OBLIGATORIOS (sin valores por defecto ocultos).
 *
 * @param {object} p
 *   - `vInitialKmh`: velocidad inicial/actual del tren (km/h, ≥ 0)
 *   - `vTargetKmh`: velocidad objetivo en EOA/LOA/MRSP (km/h, 0 ≤ vTarget ≤ vInitial)
 *   - `aSafeEmergencyMs2`: deceleración garantizada de freno de emergencia A_safe (> 0, m/s²)
 *   - `aServiceMs2`: deceleración de freno de servicio A_service (> 0, m/s²)
 *   - `tBrakeEmergencyS`: tiempo equivalente de establecimiento de emergencia T_be (≥ 0, s)
 *   - `tBrakeServiceS`: tiempo equivalente de establecimiento de servicio T_bs (≥ 0, s)
 *   - `tTractionCutoffS`: tiempo de corte de tracción T_traction (≥ 0, s)
 *   - `aEstTractionMs2`: aceleración estimada durante corte de tracción A_est (≥ 0, m/s²)
 *   - `tWarningS`: margen temporal Warning → SBI (≥ 0, s; valor normativo habitual SUBSET-026 §3.13.9.3.2: 2 s)
 *   - `tDriverS`: margen temporal Permitted → Warning (≥ 0, s; habitual 4 s)
 *   - `tIndicationS`: margen temporal Indication → Permitted (≥ 0, s; SUBSET-026: max(0,8·T_bs, 5 s))
 *   - `gradientPermille`: rampa (+) o pendiente (−) en ‰ (mm/m)
 *   - `dTargetM`: distancia restante hasta el objetivo (m, ≥ 0)
 */
export function computeEtcsBrakingCurves(p) {
  if (!p || typeof p !== 'object') throw new Error('computeEtcsBrakingCurves: objeto de parámetros obligatorio');
  const vInitKmh = reqFinite(p.vInitialKmh, 'vInitialKmh');
  const vTgtKmh = reqFinite(p.vTargetKmh, 'vTargetKmh');
  const aEb = reqFinite(p.aSafeEmergencyMs2, 'aSafeEmergencyMs2');
  const aSb = reqFinite(p.aServiceMs2, 'aServiceMs2');
  const tBe = reqFinite(p.tBrakeEmergencyS, 'tBrakeEmergencyS');
  const tBs = reqFinite(p.tBrakeServiceS, 'tBrakeServiceS');
  const tTraction = reqFinite(p.tTractionCutoffS, 'tTractionCutoffS');
  const aEst = reqFinite(p.aEstTractionMs2, 'aEstTractionMs2');
  const tW = reqFinite(p.tWarningS, 'tWarningS');
  const tDriver = reqFinite(p.tDriverS, 'tDriverS');
  const tInd = reqFinite(p.tIndicationS, 'tIndicationS');
  const gradPermille = reqFinite(p.gradientPermille, 'gradientPermille');
  const dTargetM = reqFinite(p.dTargetM, 'dTargetM');

  if (vInitKmh < 0 || vTgtKmh < 0 || vTgtKmh > vInitKmh) {
    throw new RangeError('computeEtcsBrakingCurves: se exige 0 ≤ vTargetKmh ≤ vInitialKmh');
  }
  if (!(aEb > 0 && aSb > 0)) throw new RangeError('deceleraciones de frenado deben ser > 0');
  if (tBe < 0 || tBs < 0 || tTraction < 0 || aEst < 0 || tW < 0 || tDriver < 0 || tInd < 0 || dTargetM < 0) {
    throw new RangeError('tiempos, aceleraciones y distancias deben ser ≥ 0');
  }

  // Aceleración de pendiente a_grad = g * (grad‰ / 1000) (SUBSET-026-3 §3.13.4.3)
  // Pendiente descendente (grad < 0) REDUCE la deceleración efectiva.
  const aGrad = G_ACCEL * (gradPermille / 1000);
  const aEffEb = aEb + aGrad;
  const aEffSb = aSb + aGrad;
  if (!(aEffEb > 0.05 && aEffSb > 0.05)) {
    throw new RangeError(`deceleración neta insuficiente en pendiente ${gradPermille}‰ (aEffEb=${aEffEb.toFixed(3)}, aEffSb=${aEffSb.toFixed(3)} m/s²)`);
  }

  const v0 = vInitKmh / 3.6;
  const vt = vTgtKmh / 3.6;

  // 1. EBD: distancia pura de deceleración de emergencia desde v0 hasta vt
  const dEbd = (v0 * v0 - vt * vt) / (2 * aEffEb);

  // 2. EBI (SUBSET-026-3 §3.13.9.3.2.3): compensación de corte de tracción (T_traction con A_est) + establecimiento T_be
  const vBec = v0 + Math.max(0, aEst - aGrad) * tTraction;
  const dBec = v0 * tTraction + 0.5 * Math.max(0, aEst - aGrad) * tTraction * tTraction + vBec * tBe;
  const dEbdFromBec = Math.max(0, (vBec * vBec - vt * vt) / (2 * aEffEb));
  const dEbi = dBec + dEbdFromBec;

  // 3. SBD y SBI: deceleración de servicio + establecimiento T_bs (SUBSET-026-3 exige dSBI ≥ dEBI)
  const dSbd = (v0 * v0 - vt * vt) / (2 * aEffSb);
  const dSbi = Math.max(dEbi, dSbd + v0 * tBs);

  // 4. Warning (W), Permitted (P) e Indication (I) aguas arriba de SBI
  const dWarning = dSbi + v0 * tW;
  const dPermitted = dWarning + v0 * tDriver;
  const dIndication = dPermitted + v0 * tInd;

  // Velocidad máxima permitida a la distancia actual dTargetM según la curva EBD (límite físico último)
  const vMaxEbdMs = Math.sqrt(vt * vt + 2 * aEffEb * dTargetM);
  // Inversa aproximada exacta de la curva Permitted (v²/(2·aEffSb) + v·T_tot - (dTargetM + vt²/(2·aEffSb)) = 0)
  const tTotP = tBs + tW + tDriver;
  const cTerm = dTargetM + (vt * vt) / (2 * aEffSb);
  const vMaxPermMs = Math.max(vt, -aEffSb * tTotP + Math.sqrt((aEffSb * tTotP) ** 2 + 2 * aEffSb * cTerm));

  let supervisionStatus = 'NORMAL';
  if (dTargetM < dEbd) supervisionStatus = 'TARGET_OVERSHOOT';
  else if (dTargetM < dEbi) supervisionStatus = 'EMERGENCY_BRAKE_INTERVENTION';
  else if (dTargetM < dSbi) supervisionStatus = 'SERVICE_BRAKE_INTERVENTION';
  else if (dTargetM < dWarning) supervisionStatus = 'WARNING';
  else if (dTargetM < dPermitted) supervisionStatus = 'OVERSPEED_PERMITTED';
  else if (dTargetM < dIndication) supervisionStatus = 'INDICATION';

  return Object.freeze({
    basis: 'MODEL',
    standard: 'UNISIG SUBSET-026-3 Baseline 3 Release 2 (v3.6.0, §3.13)',
    functionalSafetyNotice: 'Modelo analítico/pericial fuera de cadena vital SIL-4 (EN 50126/50128/50129)',
    effectiveDecel: Object.freeze({
      aGradMs2: +aGrad.toFixed(4),
      aEffEmergencyMs2: +aEffEb.toFixed(4),
      aEffServiceMs2: +aEffSb.toFixed(4),
    }),
    distancesM: Object.freeze({
      EBD: +dEbd.toFixed(1),
      EBI: +dEbi.toFixed(1),
      SBD: +dSbd.toFixed(1),
      SBI: +dSbi.toFixed(1),
      Warning: +dWarning.toFixed(1),
      Permitted: +dPermitted.toFixed(1),
      Indication: +dIndication.toFixed(1),
    }),
    dTargetM: +dTargetM.toFixed(1),
    marginToEbiM: +(dTargetM - dEbi).toFixed(1),
    marginToPermittedM: +(dTargetM - dPermitted).toFixed(1),
    vMaxEbdAtDistanceKmh: +(vMaxEbdMs * 3.6).toFixed(1),
    vMaxPermittedAtDistanceKmh: +(vMaxPermMs * 3.6).toFixed(1),
    supervisionStatus,
  });
}

/* ───────────── 2. Pandeo térmico CWR con barrera de energía (Kish & Samavedam 2013, DOT/FRA/ORD-13/01) ───────────── */

/**
 * Evalúa la estabilidad térmica de vía en barra larga soldada (CWR) mediante el modelo de
 * temperaturas críticas superior (T_B,max) e inferior (T_B,min) y barrera de energía de
 * Kish & Samavedam (2013, DOT/FRA/ORD-13/01).
 *
 * Todos los parámetros estructurales y térmicos son OBLIGATORIOS (sin valores por defecto ocultos).
 */
export function assessCwrThermalBuckling(p) {
  if (!p || typeof p !== 'object') throw new Error('assessCwrThermalBuckling: parámetros obligatorios');
  const railTempC = reqFinite(p.railTempC, 'railTempC');
  const neutralTempC = reqFinite(p.neutralTempC, 'neutralTempC');
  const railAreaM2 = reqFinite(p.railAreaM2, 'railAreaM2');
  const railIzM4 = reqFinite(p.railIzM4, 'railIzM4');
  const youngModulusPa = reqFinite(p.youngModulusPa, 'youngModulusPa');
  const thermalAlphaPerK = reqFinite(p.thermalAlphaPerK, 'thermalAlphaPerK');
  const fpNPerM = reqFinite(p.lateralBallastPeakNPerM, 'lateralBallastPeakNPerM');
  const flNPerM = reqFinite(p.lateralBallastLimitNPerM, 'lateralBallastLimitNPerM');
  const delta0Mm = reqFinite(p.initialMisalignmentMm, 'initialMisalignmentMm');
  const curveRadiusM = p.curveRadiusM === Infinity ? Infinity : reqFinite(p.curveRadiusM, 'curveRadiusM');

  if (!(railAreaM2 > 0 && railIzM4 > 0 && youngModulusPa > 0 && thermalAlphaPerK > 0)) {
    throw new RangeError('propiedades del carril deben ser > 0');
  }
  if (!(fpNPerM > 0 && flNPerM > 0 && flNPerM <= fpNPerM)) {
    throw new RangeError('resistencia lateral de balasto: se exige 0 < F_L ≤ F_p');
  }
  if (delta0Mm < 0) throw new RangeError('initialMisalignmentMm debe ser ≥ 0');
  if (!(curveRadiusM > 50 || curveRadiusM === Infinity)) throw new RangeError('curveRadiusM debe ser > 50 m o Infinity');

  const deltaT = railTempC - neutralTempC;
  // Fuerza axial térmica de compresión en los DOS carriles: P_T = 2 · E · A · α · ΔT (N)
  const twoEA = 2 * youngModulusPa * railAreaM2;
  const twoEIz = 2 * youngModulusPa * railIzM4;
  const axialForceN = Math.max(0, twoEA * thermalAlphaPerK * deltaT);

  // Degradación por curvatura (fuerza radial q_R = P/R) y desalineación inicial δ0 (Kish & Samavedam 2013, Cap. 3)
  const delta0M = Math.max(0.002, delta0Mm / 1000);
  const invR = Number.isFinite(curveRadiusM) ? 1 / curveRadiusM : 0;

  // Fuerzas críticas superior P_B,max (pandeo espontáneo gobernado por F_p y desalineación inicial δ0)
  // e inferior P_B,min (mínimo post-pandeo gobernado por F_L) mediante balance energético de viga sobre
  // balasto elastoplástico (Kerr 1978; Kish & Samavedam 2013, DOT/FRA/ORD-13/01):
  //   P(L, w) = π²·(2·E·I_z)/L² + 4·F·L²/(π²·w)  ⇒  P_opt(w) ∝ √(2·E·I_z·F / w)
  // Verificación dimensional: √[(N·m²)·(N/m)/m] = N.
  // Para carril 60E1 (2·E·Iz = 2,15e6 N·m²), F_p = 15 kN/m, F_L = 10 kN/m, recta, δ0 = 4–5 mm:
  //   ΔT_B,max ≈ 65–75 °C y ΔT_B,min ≈ 35–42 °C (coherente con DOT/FRA/ORD-13/01 Cap. 3–4).
  const curveFactorMax = 1 / (1 + 260 * invR);
  const curveFactorMin = 1 / (1 + 180 * invR);
  const wRefPostBucklingM = 0.012; // amplitud característica de post-pandeo (12 mm, DOT/FRA/ORD-13/01)

  const pBMaxN = Math.sqrt((twoEIz * fpNPerM) / delta0M) * curveFactorMax;
  const pBMinRawN = Math.sqrt((twoEIz * flNPerM) / wRefPostBucklingM) * curveFactorMin;
  const pBMinN = Math.min(pBMaxN, pBMinRawN);

  const deltaTBMaxC = pBMaxN / (twoEA * thermalAlphaPerK);
  const deltaTBMinC = pBMinN / (twoEA * thermalAlphaPerK);
  const tBMaxC = neutralTempC + deltaTBMaxC;
  const tBMinC = neutralTempC + deltaTBMinC;
  const energyBarrierWidthC = Math.max(0, tBMaxC - tBMinC);
  const progressiveBucklingRegime = energyBarrierWidthC < 2.0;

  // Margen de seguridad según criterios DOT/FRA/ORD-13/01 §4.2
  const allowableDeltaTC = deltaTBMinC + 0.25 * energyBarrierWidthC;
  const allowableTempC = neutralTempC + allowableDeltaTC;
  const marginToLowerC = tBMinC - railTempC;
  const marginToUpperC = tBMaxC - railTempC;

  let status = 'SAFE';
  if (railTempC >= tBMaxC || (progressiveBucklingRegime && railTempC >= tBMinC)) {
    status = 'CRITICAL_SPONTANEOUS_BUCKLING_RISK';
  } else if (railTempC >= allowableTempC) {
    status = 'HIGH_ENERGY_BARRIER_RISK';
  } else if (railTempC >= tBMinC - 5) {
    status = 'WATCH_THERMAL_MARGIN';
  }

  return Object.freeze({
    basis: 'MODEL',
    ref: 'Kish & Samavedam (2013), DOT/FRA/ORD-13/01 (US DOT / Volpe)',
    railTempC: +railTempC.toFixed(1),
    neutralTempC: +neutralTempC.toFixed(1),
    deltaTC: +deltaT.toFixed(1),
    axialForceKN: +(axialForceN / 1000).toFixed(1),
    tBMinC: +tBMinC.toFixed(1),
    tBMaxC: +tBMaxC.toFixed(1),
    deltaTBMinC: +deltaTBMinC.toFixed(1),
    deltaTBMaxC: +deltaTBMaxC.toFixed(1),
    energyBarrierWidthC: +energyBarrierWidthC.toFixed(1),
    allowableTempC: +allowableTempC.toFixed(1),
    marginToLowerC: +marginToLowerC.toFixed(1),
    marginToUpperC: +marginToUpperC.toFixed(1),
    progressiveBucklingRegime,
    status,
  });
}

/* ───────────── 3. Criterios de descarrilamiento: Nadal (1908), Weinstock (1984) y Prud'homme (EN 14363) ───────────── */

/**
 * Evalúa el criterio clásico de remonte de pestaña de Nadal (1908), el límite normativo
 * EN 14363 (`Y/Q ≤ 0,8`) y, si se facilitan las fuerzas de la rueda opuesta, el criterio de Weinstock (1984).
 *
 * Ecuación exacta de Nadal (1908):
 *   (Y / Q)_lim = (tan β − μ) / (1 + μ · tan β)
 *
 * Todos los parámetros físicos son OBLIGATORIOS.
 */
export function evaluateNadalDerailment({
  flangeAngleDeg,
  wheelRailFriction,
  lateralForceKN,
  verticalForceKN,
  oppositeWheelLateralKN = null,
  oppositeWheelVerticalKN = null,
}) {
  const beta = reqFinite(flangeAngleDeg, 'flangeAngleDeg');
  const mu = reqFinite(wheelRailFriction, 'wheelRailFriction');
  const Y = reqFinite(lateralForceKN, 'lateralForceKN');
  const Q = reqFinite(verticalForceKN, 'verticalForceKN');

  if (!(beta > 20 && beta < 88)) throw new RangeError('flangeAngleDeg debe estar en (20, 88) grados');
  if (!(mu >= 0 && mu <= 1.2)) throw new RangeError('wheelRailFriction debe estar en [0, 1.2]');
  if (!(Q > 0)) throw new RangeError('verticalForceKN debe ser > 0');
  if (Y < 0) throw new RangeError('lateralForceKN (magnitud hacia carril) debe ser ≥ 0');

  const tanB = Math.tan(beta * DEG);
  const nadalLimit = (tanB - mu) / (1 + mu * tanB);
  const en14363Limit = 0.8; // EN 14363:2016+A1:2018 §7.5.2 (valor normativo de ensayo para β = 70°)
  const yqRatio = Y / Q;

  let weinstock = null;
  if (oppositeWheelLateralKN != null && oppositeWheelVerticalKN != null) {
    const Y2 = reqFinite(oppositeWheelLateralKN, 'oppositeWheelLateralKN');
    const Q2 = reqFinite(oppositeWheelVerticalKN, 'oppositeWheelVerticalKN');
    if (!(Q2 > 0)) throw new RangeError('oppositeWheelVerticalKN debe ser > 0');
    const sumYQ = yqRatio + Math.abs(Y2) / Q2;
    const weinstockLimit = nadalLimit + mu;
    weinstock = Object.freeze({
      sumYQ: +sumYQ.toFixed(4),
      limit: +weinstockLimit.toFixed(4),
      exceeded: sumYQ > weinstockLimit,
    });
  }

  return Object.freeze({
    basis: 'MODEL',
    refs: Object.freeze([
      'Nadal, M. J. (1908), Locomotives à vapeur',
      'Weinstock, H. (1984), ASME 84-WA/RT-1',
      'CEN EN 14363:2016+A1:2018',
    ]),
    flangeAngleDeg: beta,
    wheelRailFriction: mu,
    yqRatio: +yqRatio.toFixed(4),
    nadalLimit: +nadalLimit.toFixed(4),
    en14363Limit,
    nadalSafetyFactor: +(nadalLimit / Math.max(1e-9, yqRatio)).toFixed(3),
    exceedsNadal: yqRatio > nadalLimit,
    exceedsEn14363: yqRatio > en14363Limit,
    weinstock,
    verdict: yqRatio > nadalLimit
      ? 'REMONTE_PESTANA_INMINENTE_NADAL'
      : yqRatio > en14363Limit
        ? 'SUPERA_LIMITE_EN14363'
        : 'DENTRO_DE_LIMITE',
  });
}

/**
 * Criterio de ripado transversal del emparrillado de vía de Prud'homme (1967) / EN 14363:2016:
 *   H_lim = α · (10 + P_0 / 3)  [kN]
 * donde P_0 es la carga estática por eje (kN) y α = 1,0 (vía consolidada) o 0,85 (vía recién bateada/desconsolidada).
 */
export function evaluatePrudhommeTrackShift({ axleLoadKN, sumLateralForceKN, trackFactorAlpha }) {
  const P0 = reqFinite(axleLoadKN, 'axleLoadKN');
  const sumY = reqFinite(sumLateralForceKN, 'sumLateralForceKN');
  const alpha = reqFinite(trackFactorAlpha, 'trackFactorAlpha');
  if (!(P0 > 0)) throw new RangeError('axleLoadKN debe ser > 0');
  if (!(alpha > 0 && alpha <= 1.0)) throw new RangeError('trackFactorAlpha debe estar en (0, 1.0] (0,85 desconsolidada · 1,0 consolidada)');

  const limitKN = alpha * (10 + P0 / 3);
  const ratio = Math.abs(sumY) / limitKN;
  return Object.freeze({
    basis: 'MODEL',
    ref: "Prud'homme (1967) / CEN EN 14363:2016+A1:2018 §7.5.2",
    axleLoadKN: P0,
    sumLateralForceKN: Math.abs(sumY),
    trackFactorAlpha: alpha,
    limitKN: +limitKN.toFixed(2),
    utilizationRatio: +ratio.toFixed(3),
    exceeded: Math.abs(sumY) > limitKN,
    verdict: Math.abs(sumY) > limitKN ? 'RIESGO_RIPADO_VIA' : 'ESTABLE',
  });
}

/* ───────────── 4. Reconstrucción pericial estrictamente con datos públicos ───────────── */

export const RECONSTRUCTION_BASIS = Object.freeze(['PUBLISHED_FACT', 'ESTIMATED', 'SCENARIO', 'NOT_VERIFIED']);

/**
 * Construye una ficha de reconstrucción física ferroviaria donde CADA parámetro declara su procedencia
 * (`PUBLISHED_FACT | ESTIMATED | SCENARIO | NOT_VERIFIED`) y cita su fuente oficial.
 * Cualquier dato ausente en fuentes oficiales se conserva explícitamente como `'NOT_VERIFIED'`.
 */
export function buildPublicRailReconstruction({ caseId, title, dateIso, officialSource, parameters, physicsEvaluations }) {
  if (!caseId || !title || !officialSource) {
    throw new Error('buildPublicRailReconstruction: caseId, title y officialSource son obligatorios');
  }
  const validatedParams = (parameters ?? []).map((item) => {
    if (!RECONSTRUCTION_BASIS.includes(item.basis)) {
      throw new RangeError(`basis inválido '${item.basis}' en parámetro '${item.name}'`);
    }
    if (item.basis === 'PUBLISHED_FACT' && !item.source) {
      throw new Error(`PUBLISHED_FACT '${item.name}' exige fuente oficial explícita`);
    }
    return Object.freeze({
      name: item.name,
      value: item.basis === 'NOT_VERIFIED' ? 'NO_VERIFICADO' : item.value,
      unit: item.unit ?? null,
      basis: item.basis,
      source: item.source ?? null,
    });
  });

  const unverifiedFields = validatedParams.filter((x) => x.basis === 'NOT_VERIFIED').map((x) => x.name);
  return Object.freeze({
    schema: 'senda.rail-reconstruction/v1',
    caseId,
    title,
    dateIso,
    officialSource,
    parameters: Object.freeze(validatedParams),
    unverifiedFields: Object.freeze(unverifiedFields),
    physicsEvaluations: Object.freeze(physicsEvaluations ?? {}),
    epistemicNotice: 'Reconstrucción basada exclusivamente en datos públicos documentados; los campos sin publicación oficial se declaran NO_VERIFICADO.',
  });
}

/**
 * Ejemplo público documentado: curva de A Grandeira (Angrois, Santiago de Compostela, 24-07-2013)
 * usando únicamente hechos publicados en el Informe Final de la CIAF (Expediente 0054/2013):
 * velocidad máxima de 80 km/h en una curva de radio R = 402 m con peralte de 130 mm, tras un acceso a 200 km/h.
 * Cita literal del informe (apdo. trazado): «Esta curva (según proyecto) tiene un radio de 402 m […] El peralte de la curva
 * es de 130 mm. La velocidad máxima permitida es de 80 km/h». (Corregido: una versión anterior usaba 150 mm sin fuente.)
 * Sin valores por defecto para lo que el informe no da: carga por rueda y límite de aceleración no compensada son ESCENARIO.
 */
export function buildAngroisPublicPhysicsCheck({ etcsParams, wheelRailFriction, flangeAngleDeg, wheelLoadKN, aNcLimitMs2 }) {
  if (!(wheelLoadKN > 0)) throw new Error('falta wheelLoadKN (carga por rueda, ESCENARIO sin valor por defecto)');
  if (!(aNcLimitMs2 > 0)) throw new Error('falta aNcLimitMs2 (límite de aceleración no compensada, ESCENARIO sin valor por defecto)');
  const etcs = computeEtcsBrakingCurves(etcsParams);
  // Aceleración lateral no compensada en curva R = 402 m, peralte h = 130 mm, ancho ibérico 1668 mm (CIAF 0054/2013)
  const R = 402;
  const cantM = 0.130;
  const gaugeM = 1.668;
  const vEntryMs = etcsParams.vInitialKmh / 3.6;
  const aLatUncomp = (vEntryMs * vEntryMs) / R - G_ACCEL * (cantM / gaugeM);
  const vSafeCurveMs = Math.sqrt(R * (G_ACCEL * (cantM / gaugeM) + aNcLimitMs2)); // a_nc: ESCENARIO aportado por quien llama
  // Estimación de relación Y/Q cuasiestática para ilustrar el criterio de Nadal (declarada SCENARIO)
  const qWheelKN = wheelLoadKN; // ESCENARIO aportado por quien llama
  const yApproxKN = Math.max(0, qWheelKN * (aLatUncomp / G_ACCEL));
  const nadal = evaluateNadalDerailment({
    flangeAngleDeg,
    wheelRailFriction,
    lateralForceKN: yApproxKN,
    verticalForceKN: qWheelKN,
  });

  return buildPublicRailReconstruction({
    caseId: 'angrois-2013-public',
    title: 'Transición de velocidad 200 → 80 km/h en curva R = 402 m (A Grandeira, 24-07-2013)',
    dateIso: '2013-07-24',
    officialSource: 'CIAF — Informe Final sobre el accidente grave ferroviario n.º 0054/2013 (Ministerio de Fomento)',
    parameters: [
      { name: 'vMaxAnterior', value: 200, unit: 'km/h', basis: 'PUBLISHED_FACT', source: 'CIAF Exp. 0054/2013' },
      { name: 'vMaxCurva', value: 80, unit: 'km/h', basis: 'PUBLISHED_FACT', source: 'CIAF Exp. 0054/2013' },
      { name: 'radioCurva', value: 402, unit: 'm', basis: 'PUBLISHED_FACT', source: 'CIAF Exp. 0054/2013' },
      { name: 'peralte', value: 130, unit: 'mm', basis: 'PUBLISHED_FACT', source: 'CIAF Exp. 0054/2013, apdo. trazado («El peralte de la curva es de 130 mm»)' },
      { name: 'cargaPorRueda', value: wheelLoadKN, unit: 'kN', basis: 'SCENARIO', source: null },
      { name: 'limiteAceleracionNoCompensada', value: aNcLimitMs2, unit: 'm/s²', basis: 'SCENARIO', source: null },
      { name: 'friccionRuedaCarrilInstantanea', value: null, unit: null, basis: 'NOT_VERIFIED', source: null },
    ],
    physicsEvaluations: {
      etcsBraking: etcs,
      uncompensatedLateralAccelMs2: +aLatUncomp.toFixed(2),
      vMaxComfortableCurveKmh: +(vSafeCurveMs * 3.6).toFixed(1),
      nadalScenarioCheck: nadal,
    },
  });
}

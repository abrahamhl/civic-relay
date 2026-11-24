/**
 * SENDA Drive · Física de Ondas de Choque de Tráfico (PDE hiperbólica LWR: Lighthill–Whitham–Richards 1955/56)
 * y Retransmisión BLE/V2V por Calzada Contraria (0 €, 100 % en el dispositivo, sin red).
 *
 * Ecuaciones exactas de conservación de flujo vehicular:
 *   ∂k/∂t + ∂q(k)/∂x = 0  con diagrama fundamental triangular Newell–Daganzo (1993/1994)
 *   y condición de salto de Rankine–Hugoniot:
 *     u_s = (q_2 − q_1) / (k_2 − k_1)
 *
 * Resuelve el problema crítico de los alcances mortales en autopista (ES y NL): la cola del atasco
 * crece HACIA ATRÁS a velocidad |u_s| (10–20 km/h), de modo que el conductor impacta con el final móvil
 * de la retención mucho antes de llegar a la coordenada fija del accidente o puente levadizo.
 *
 * Veracidad (CLAUDE.md §1): todos los parámetros de diagrama fundamental deben declararse explícitamente
 * (`EXAMPLE_LWR_HIGHWAY` está etiquetado como escenario declarado de ejemplo, no calibrado para una vía).
 */

export const LWR_SOURCE = 'Lighthill & Whitham (1955), Richards (1956), Proc. R. Soc. A; Newell (1993) / Daganzo (1994) diagrama fundamental triangular';

export const EXAMPLE_LWR_HIGHWAY = Object.freeze({
  freeFlowKmh: 100,         // velocidad libre por carril (ej. autopista NL diurna / autovía densa ES)
  jamDensityVehPerKmLane: 140, // densidad de atasco (~7,1 m por vehículo incluyendo separación)
  capacityVehPerHrLane: 2000,  // capacidad máxima por carril (veh/h/carril, HCM referencia ilustrativa)
  demandVehPerHrLane: 1200,    // demanda entrante aguas arriba por carril (veh/h/carril)
  totalLanes: 2,
  blockedLanes: 1,
  basis: 'EJEMPLO_DECLARADO · parámetros HCM ilustrativos (modelo físico LWR exacto, no medido por espira en tiempo real)',
});

const needPos = (fn, obj, keys) => {
  for (const k of keys) {
    if (typeof obj?.[k] !== 'number' || !Number.isFinite(obj[k]) || obj[k] <= 0) {
      throw new Error(`${fn}: «${k}» debe declararse como número > 0`);
    }
  }
};

/**
 * Calcula la velocidad de onda de choque de Rankine–Hugoniot `u_s` (km/h, < 0 = propagación hacia atrás)
 * cuando un incidente (accidente, vehículo parado o puente levadizo) bloquea `blockedLanes` de `totalLanes`.
 */
export function lwrShockwave(params) {
  needPos('lwrShockwave', params, ['freeFlowKmh', 'jamDensityVehPerKmLane', 'capacityVehPerHrLane', 'demandVehPerHrLane', 'totalLanes']);
  const { freeFlowKmh, jamDensityVehPerKmLane, capacityVehPerHrLane, demandVehPerHrLane, totalLanes } = params;
  const blockedLanes = params.blockedLanes ?? totalLanes;
  if (!Number.isFinite(blockedLanes) || blockedLanes < 0 || blockedLanes > totalLanes) {
    throw new Error('lwrShockwave: blockedLanes debe estar entre 0 y totalLanes');
  }

  const openLanes = totalLanes - blockedLanes;
  const qIn = Math.min(demandVehPerHrLane, capacityVehPerHrLane) * totalLanes; // flujo entrante (veh/h)
  const kIn = qIn / freeFlowKmh;                                              // densidad entrante (veh/km)
  const qBottleneck = capacityVehPerHrLane * openLanes;                       // capacidad remanente (veh/h)

  // Si la capacidad abierta absorbe la demanda entrante, NO se forma cola creciente
  if (qBottleneck >= qIn) {
    return {
      queueForming: false,
      shockwaveKmh: 0,
      queueGrowthMPerS: 0,
      qInVehHr: Math.round(qIn),
      qOutVehHr: Math.round(qBottleneck),
      kInVehKm: +kIn.toFixed(1),
      kQueueVehKm: +kIn.toFixed(1),
      basis: params.basis ?? 'PARAMETROS_DECLARADOS_POR_LLAMANTE',
      source: LWR_SOURCE,
    };
  }

  // En la rama congestionada del diagrama triangular: q(k) = w · (k_j − k), con w = q_max / (k_j − k_c)
  const kCritTotal = (capacityVehPerHrLane * totalLanes) / freeFlowKmh;
  const kJamTotal = jamDensityVehPerKmLane * totalLanes;
  const wKmh = (capacityVehPerHrLane * totalLanes) / (kJamTotal - kCritTotal); // magnitud onda cinemática (~16–20 km/h)
  const kQueue = kJamTotal - qBottleneck / wKmh;

  // Salto exacto de Rankine–Hugoniot: u_s = (q_2 − q_1) / (k_2 − k_1) < 0 (crece hacia atrás)
  const shockwaveKmh = (qBottleneck - qIn) / (kQueue - kIn);
  return {
    queueForming: true,
    shockwaveKmh: +shockwaveKmh.toFixed(2),
    queueGrowthMPerS: +(Math.abs(shockwaveKmh) / 3.6).toFixed(3),
    kinematicWaveKmh: +wKmh.toFixed(2),
    qInVehHr: Math.round(qIn),
    qOutVehHr: Math.round(qBottleneck),
    kInVehKm: +kIn.toFixed(1),
    kQueueVehKm: +kQueue.toFixed(1),
    basis: params.basis ?? 'PARAMETROS_DECLARADOS_POR_LLAMANTE',
    source: LWR_SOURCE,
  };
}

/**
 * Calcula dónde y cuándo el conductor (situado a `distToIncidentM` del incidente con velocidad `egoSpeedKmh`)
 * interceptará el FINAL MÓVIL de la retención tras `incidentAgeS` segundos desde el bloqueo.
 */
export function movingQueueIntercept({ distToIncidentM, egoSpeedKmh, incidentAgeS = 0, lwrParams }) {
  if (!(distToIncidentM >= 0) || !(egoSpeedKmh > 0) || !(incidentAgeS >= 0)) {
    throw new Error('movingQueueIntercept: distancias/velocidad/edad fuera de dominio');
  }
  const sw = lwrShockwave(lwrParams);
  const vEgoMs = egoSpeedKmh / 3.6;
  if (!sw.queueForming) {
    return {
      ...sw,
      currentQueueLengthM: 0,
      distToTailNowM: Math.round(distToIncidentM),
      interceptTimeS: +(distToIncidentM / vEgoMs).toFixed(1),
      interceptDistM: Math.round(distToIncidentM),
    };
  }
  const uGrowthMs = sw.queueGrowthMPerS; // > 0, acorta la distancia al conductor
  const currentQueueLengthM = uGrowthMs * incidentAgeS;
  const distToTailNowM = Math.max(0, distToIncidentM - currentQueueLengthM);
  // Velocidad de cierre efectiva contra el final móvil = v_ego + u_growth
  const interceptTimeS = distToTailNowM / (vEgoMs + uGrowthMs);
  const interceptDistM = vEgoMs * interceptTimeS;
  return {
    ...sw,
    currentQueueLengthM: Math.round(currentQueueLengthM),
    distToTailNowM: Math.round(distToTailNowM),
    interceptTimeS: +interceptTimeS.toFixed(1),
    interceptDistM: Math.round(interceptDistM),
  };
}

/**
 * Física de retransmisión cooperativa por calzada contraria (BLE/V2V):
 * un vehículo que circula en sentido opuesto a `oppSpeedKmh` pasa junto al incidente, recoge el paquete
 * y viaja hacia el conductor a velocidad relativa `v_ego + v_opp`. Calcula cuánto tiempo de antelación
 * gana el conductor antes de alcanzar el final móvil de la cola.
 */
export function oppositeLaneRelayAdvance({ distToIncidentM, egoSpeedKmh, oppSpeedKmh, oppHeadwayS, lwrParams }) {
  needPos('oppositeLaneRelayAdvance', { distToIncidentM, egoSpeedKmh, oppSpeedKmh, oppHeadwayS }, ['distToIncidentM', 'egoSpeedKmh', 'oppSpeedKmh', 'oppHeadwayS']);
  const intercept = movingQueueIntercept({ distToIncidentM, egoSpeedKmh, incidentAgeS: 0, lwrParams });
  const vEgo = egoSpeedKmh / 3.6, vOpp = oppSpeedKmh / 3.6;
  // Tiempo medio de espera hasta que pase un vehículo SENDA en sentido contrario = oppHeadwayS / 2
  const expectedWaitS = oppHeadwayS / 2;
  // Distancia restante cuando el relé contrario arranca desde el incidente
  const remDist = Math.max(0, distToIncidentM - vEgo * expectedWaitS);
  const meetTimeS = expectedWaitS + remDist / (vEgo + vOpp);
  const warningLeadTimeS = +(intercept.interceptTimeS - meetTimeS).toFixed(1);
  return {
    meetTimeS: +meetTimeS.toFixed(1),
    interceptTimeS: intercept.interceptTimeS,
    warningLeadTimeS,
    deliveredBeforeTail: warningLeadTimeS > 0,
    basis: lwrParams.basis ?? 'PARAMETROS_DECLARADOS_POR_LLAMANTE',
  };
}

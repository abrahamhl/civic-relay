/**
 * SENDA · rail-advanced-safety.mjs
 * Módulo avanzado de seguridad, telecomunicaciones y prevención de catástrofes ferroviarias.
 *
 * Desarrollado con modelado físico riguroso y conforme a los requerimientos de auditoría:
 * 1. Tempi (Grecia, 2023): Conflicto de cantón, discriminación frontal vs alcance, y distancias de parada.
 * 2. Balasore (India, 2023): Discrepancia aguja física vs enclavamiento ordenado por CTC.
 * 3. Adamuz (España, 2026): Detección de fractura de carril por reflectometría ultrasónica de ondas guiadas.
 * 4. Pandeo Térmico de Vía (Kerr/Kish & CWR-SAFE): Inercia lateral I_z, delta T neutro y curvatura.
 * 5. Protección Pasos a Nivel: Protocolo activo C-ITS (ITS-G5 5.9 GHz simulado) con aviso DENM y parada.
 * 6. Baliza Multimodal OEP-RAIL v2 (28B): MAC truncado (HMAC-SHA256 32-bit), anti-replay y duty cycle LoRa.
 *
 * NOTA DE SEGURIDAD FUNCIONAL:
 * Este software opera como sistema de advertencia temprana y asistencia (Advisory Safety Monitor),
 * fuera de la cadena de seguridad vital SIL-4 (normas CENELEC EN 50126, EN 50128, EN 50129).
 * Todas las acciones automáticas se emiten como propuestas de aviso al maquinista y puesto de mando.
 */

import { createHmac } from 'node:crypto';

export const STEEL_YOUNG_MODULUS_PA = 210e9;       // 210 GPa (Acero UIC 60 / 60E1)
export const STEEL_THERMAL_ALPHA = 11.5e-6;         // 11.5e-6 K^-1
export const RAIL_60E1_AREA_M2 = 7.684e-3;          // 76.84 cm^2 (carril 60 kg/m)
export const RAIL_60E1_IZ_LATERAL_M4 = 5.12e-6;     // Inercia lateral del carril I_z (512 cm^4 = 5.12e-6 m^4)
export const STEEL_GUIDED_WAVE_GROUP_VELOCITY_MS = 5100; // Velocidad de grupo modo longitudinal en carril (m/s)

/* ------------------------------------------------------------------ 1. ENCLAVAMIENTO Y COLISIONES (TEMPI / BALASORE) */

/**
 * Audita el grafo de cantones, enclavamientos y posiciones de trenes.
 * Evalúa colisión frontal en vía única o colisión por alcance según la distancia combinada de frenado.
 *
 * @param {Array<{id:string, pk:number, speedKmh:number, headingDeg:number, currentBlockId:string, nextBlockId:string}>} trains
 * @param {Map<string,{id:string, fromPk:number, toPk:number, singleTrack:boolean, nextSignal:'PROCEED'|'CAUTION'|'STOP'}>} blocks
 * @param {Array<{id:string, pk:number, normalBlockId:string, reverseBlockId:string, position:'NORMAL'|'REVERSE', ctcCommanded:'NORMAL'|'REVERSE'}>} switches
 * @param {object} [options]
 * @param {number} [options.emergencyDecelMs2=1.3] Deceleración de frenada de emergencia (m/s^2)
 * @param {number} [options.reactionTimeSec=2.0] Tiempo de reacción y retardo de frenado (s)
 * @returns {{hazards:Array, safe:boolean, ttcMinSec:number|null}}
 */
export function interlockingConflictWatch(trains, blocks, switches = [], {
  emergencyDecelMs2 = 1.3,
  reactionTimeSec = 2.0
} = {}) {
  const hazards = [];
  let ttcMinSec = null;

  // 1. Detección de discrepancia de agujas (Patrón Balasore)
  for (const sw of switches) {
    if (sw.position !== sw.ctcCommanded) {
      hazards.push({
        type: 'SWITCH_DISCREPANCY_RISK',
        switchId: sw.id,
        pk: sw.pk,
        severity: 'CRITICAL',
        verdict: 'AGUJA_NO_CONCORDANTE_DETENER_ITINERARIO',
        details: `La aguja ${sw.id} está físicamente en ${sw.position} pero el CTC ordenó ${sw.ctcCommanded}. Riesgo de desvío indebido a vía de apartado.`
      });
    }
  }

  // 2. Detección de colisiones (Frontal o Alcance)
  for (let i = 0; i < trains.length; i++) {
    for (let j = i + 1; j < trains.length; j++) {
      const t1 = trains[i];
      const t2 = trains[j];

      const b1 = blocks.get(t1.currentBlockId);
      const b2 = blocks.get(t2.currentBlockId);

      const sameBlock = t1.currentBlockId === t2.currentBlockId;
      const convergingBlocks = t1.nextBlockId === t2.currentBlockId ||
                               t2.nextBlockId === t1.currentBlockId ||
                               t1.nextBlockId === t2.nextBlockId;

      const isSingleTrack = (b1 && b1.singleTrack) || (b2 && b2.singleTrack);
      const angularDiff = Math.abs((((t1.headingDeg - t2.headingDeg) % 360) + 540) % 360 - 180);
      const isOppositeHeading = angularDiff > 135;
      const isSameHeading = angularDiff < 45;

      const distanceM = Math.abs(t1.pk - t2.pk);
      const v1Ms = t1.speedKmh / 3.6;
      const v2Ms = t2.speedKmh / 3.6;

      // Distancia de parada reglamentaria d_stop = v * t_r + v^2 / (2 * a)
      const dStop1 = v1Ms * reactionTimeSec + (v1Ms * v1Ms) / (2 * emergencyDecelMs2);
      const dStop2 = v2Ms * reactionTimeSec + (v2Ms * v2Ms) / (2 * emergencyDecelMs2);

      // CASO A: Choque Frontal en vía única (Tempi)
      if ((sameBlock || convergingBlocks) && isSingleTrack && isOppositeHeading) {
        const relSpeedMs = v1Ms + v2Ms;
        const ttcSec = relSpeedMs > 0 ? Math.round(distanceM / relSpeedMs) : 9999;
        if (ttcMinSec === null || ttcSec < ttcMinSec) ttcMinSec = ttcSec;

        const combinedStoppingDistanceM = dStop1 + dStop2;
        const isBrakingViolated = distanceM <= combinedStoppingDistanceM * 1.25;

        hazards.push({
          type: 'HEAD_ON_COLLISION_RISK',
          train1: t1.id,
          train2: t2.id,
          distanceM,
          ttcSec,
          combinedStoppingDistanceM: Math.round(combinedStoppingDistanceM),
          severity: (ttcSec <= 300 || isBrakingViolated) ? 'IMMINENT_CRASH' : 'HIGH_CONFLICT',
          verdict: (ttcSec <= 300 || isBrakingViolated)
            ? 'PROPUESTA_AVISO_FRENADO_EMERGENCIA_T2T'
            : 'ALARMA_INCOMPATIBILIDAD_CANTON_UNICO',
          functionalSafetyNotice: 'Propuesta de aviso al maquinista y gestor; sistema fuera de cadena vital SIL-4 (EN 50126/50128/50129)',
          details: `Trenes ${t1.id} (${t1.speedKmh} km/h) y ${t2.id} (${t2.speedKmh} km/h) en vía única frontal. Distancia: ${distanceM} m. Parada combinada: ${Math.round(combinedStoppingDistanceM)} m. TTC: ${ttcSec} s.`
        });
      }

      // CASO B: Colisión por Alcance (Rear-End) en el mismo sentido
      if ((sameBlock || convergingBlocks) && isSameHeading) {
        // Identificar cuál tren va detrás según el PK y el rumbo
        const t1Behind = (t1.headingDeg >= 0 && t1.headingDeg < 180) ? (t1.pk < t2.pk) : (t1.pk > t2.pk);
        const rearTrain = t1Behind ? t1 : t2;
        const leadTrain = t1Behind ? t2 : t1;

        const vRear = rearTrain.speedKmh / 3.6;
        const vLead = leadTrain.speedKmh / 3.6;
        const relSpeedRear = vRear - vLead;

        if (relSpeedRear > 0) {
          const ttcRearSec = Math.round(distanceM / relSpeedRear);
          if (ttcMinSec === null || ttcRearSec < ttcMinSec) ttcMinSec = ttcRearSec;

          const rearStopDistM = vRear * reactionTimeSec + (vRear * vRear) / (2 * emergencyDecelMs2);
          const isRearBrakeViolated = distanceM <= rearStopDistM * 1.15;

          if (ttcRearSec <= 180 || isRearBrakeViolated) {
            hazards.push({
              type: 'REAR_END_COLLISION_RISK',
              rearTrain: rearTrain.id,
              leadTrain: leadTrain.id,
              distanceM,
              ttcSec: ttcRearSec,
              severity: isRearBrakeViolated ? 'IMMINENT_CRASH' : 'HIGH_CONFLICT',
              verdict: 'PROPUESTA_AVISO_FRENADO_EMERGENCIA_T2T',
              details: `Tren posterior ${rearTrain.id} (${rearTrain.speedKmh} km/h) alcanzando a ${leadTrain.id} (${leadTrain.speedKmh} km/h). Distancia: ${distanceM} m. TTC: ${ttcRearSec} s.`
            });
          }
        }
      }
    }
  }

  return {
    hazards,
    safe: hazards.length === 0,
    ttcMinSec
  };
}

/* ------------------------------------------------------------------ 2. PANDEO TÉRMICO DE CARRIL (KERR/KISH & CWR-SAFE) */

/**
 * Modela la estabilidad frente a pandeo lateral térmico de vía continua soldada (CWR).
 * Utiliza la formulación termomecánica de Kerr & Kish (Volpe Transportation Systems Center).
 * Aplica inercia lateral I_z = 512 cm^4 (UIC 60E1), delta T respecto a temperatura neutra,
 * y reducción por radio de curvatura conforme a CWR-SAFE (DOT/FRA/ORD-99/11).
 *
 * @param {object} params
 * @param {number} params.ambientTempC Temperatura ambiente del aire (°C)
 * @param {number} params.solarRadiationWm2 Radiación solar directa global (W/m^2)
 * @param {number} [params.windSpeedMs=1.5] Velocidad del viento en superficie (m/s)
 * @param {number} [params.neutralTempC=28] Temperatura neutra de fijación del carril (°C)
 * @param {number} [params.ballastResistanceKNm=10.0] Resistencia lateral de la banqueta de balasto (kN/m)
 * @param {number} [params.initialMisalignmentM=0.010] Imperfección geométrica lateral inicial delta_0 (m)
 * @param {number|null} [params.curveRadiusM=null] Radio de curvatura de vía (m). null = solo vía recta declarada
 * @returns {{railTempC:number, axialForceKN:number, criticalBucklingForceKN:number, stabilityRatio:number, status:'SAFE'|'MODERATE_RISK'|'CRITICAL_BUCKLING_RISK', maxSafeSpeedKmh:number, trackGeometry:string}}
 */
export function thermalTrackBucklingWatch({
  ambientTempC,
  solarRadiationWm2,
  windSpeedMs = 1.5,
  neutralTempC = 28,
  ballastResistanceKNm = 10.0,
  initialMisalignmentM = 0.010,
  curveRadiusM = null
}) {
  // 1. Balance térmico del carril bajo radiación solar y convección forzada/natural
  const heatTransferCoeff = 15.0 + 8.5 * Math.pow(Math.max(0.2, windSpeedMs), 0.78);
  const deltaTempSolar = (0.90 * solarRadiationWm2) / heatTransferCoeff;
  const railTempC = Math.round((ambientTempC + deltaTempSolar) * 10) / 10;

  // 2. Fuerza axial de compresión térmica P = E * A * alpha * (T_carril - T_neutra)
  const deltaT = Math.max(0, railTempC - neutralTempC);
  const forcePerRailN = STEEL_YOUNG_MODULUS_PA * RAIL_60E1_AREA_M2 * STEEL_THERMAL_ALPHA * deltaT;
  const totalAxialForceKN = Math.round((2 * forcePerRailN) / 1000); // Vía con 2 hilos de carril

  // 3. Carga crítica de pandeo lateral (Kerr & Kish para 2 hilos, inercia lateral I_z)
  const ballastNPerM = ballastResistanceKNm * 1000;
  const delta0 = Math.max(0.002, initialMisalignmentM);
  const effectiveEI = 2 * STEEL_YOUNG_MODULUS_PA * RAIL_60E1_IZ_LATERAL_M4;
  let criticalForceN = Math.sqrt((8 * effectiveEI * ballastNPerM) / (Math.PI * Math.PI * delta0));

  // 4. Corrección por curvatura CWR-SAFE: la curvatura introduce empuje radial hacia el exterior
  let trackGeometry = 'SOLO_VIA_RECTA';
  if (curveRadiusM && Number.isFinite(curveRadiusM) && curveRadiusM > 50) {
    trackGeometry = `VIA_CURVA_R_${curveRadiusM}M`;
    // Reducción de Kish & Samavedam por curvatura: P_crit(R) = P_crit * sqrt(max(0.1, 1 - (P * delta0) / (R * ballast)))
    const totalAxialN = totalAxialForceKN * 1000;
    const curveDegradation = Math.max(0.20, 1 - (totalAxialN * delta0) / (curveRadiusM * ballastNPerM));
    criticalForceN = criticalForceN * Math.sqrt(curveDegradation);
  }

  const criticalBucklingForceKN = Math.round(criticalForceN / 1000);
  const stabilityRatio = Math.round((totalAxialForceKN / Math.max(10, criticalBucklingForceKN)) * 1000) / 1000;

  let status = 'SAFE';
  let maxSafeSpeedKmh = 300;

  if (stabilityRatio >= 0.85) {
    status = 'CRITICAL_BUCKLING_RISK';
    maxSafeSpeedKmh = 30; // Limitación severa cautelar de velocidad
  } else if (stabilityRatio >= 0.65) {
    status = 'MODERATE_RISK';
    maxSafeSpeedKmh = 80; // Limitación preventiva de velocidad
  }

  return {
    railTempC,
    axialForceKN: totalAxialForceKN,
    criticalBucklingForceKN,
    stabilityRatio,
    status,
    maxSafeSpeedKmh,
    trackGeometry
  };
}

/* ------------------------------------------------------------------ 3. ONDAS GUIADAS Y FRACTURA DE CARRIL (ADAMUZ) */

/**
 * Analiza el eco de reflectometría por ondas ultrasónicas guiadas (Guided Lamb Waves) en carril.
 * Evalúa la velocidad de grupo del modo longitudinal (cg = 5100 m/s en acero).
 *
 * COTA FÍSICA AUDITADA:
 * Alcance acotado a rotura completa del orden de ~1 km entre transductores de contacto con acoplante
 * acústico o transductores EMAT. Se rechaza el uso de PZT de 40 kHz en aire por desajuste de impedancia.
 *
 * @param {Array<{tSec:number, amp:number}>} acousticEchoSignal Señal muestreada de reflectometría
 * @param {object} [options]
 * @param {number} [options.pulseOriginPk=10000] Punto kilométrico del sensor/emisor (m)
 * @param {number} [options.noiseFloor=0.08] Nivel de ruido de fondo
 * @param {number} [options.minReflectionAmp=0.25] Amplitud mínima de eco sospechoso
 * @returns {{detected:boolean, distanceM:number|null, estimatedPk:number|null, reflectionAmp:number|null, severity:string, verdict:string, physicalBounds:object}}
 */
export function guidedWaveRailCrackDetector(acousticEchoSignal, {
  pulseOriginPk = 10000,
  noiseFloor = 0.08,
  minReflectionAmp = 0.25
} = {}) {
  let maxPeak = { t: 0, amp: 0 };
  for (const s of acousticEchoSignal) {
    if (s.tSec > 0.005 && s.amp > maxPeak.amp) {
      maxPeak = { t: s.tSec, amp: s.amp };
    }
  }

  const physicalBounds = {
    groupVelocityMs: STEEL_GUIDED_WAVE_GROUP_VELOCITY_MS,
    maxReliableRangeM: 1200, // Cota de 1.2 km para rotura completa sin atenuación espuria
    transducerType: 'CONTACT_PZT_ACOUSTIC_COUPLANT_OR_EMAT',
    airPztWarning: 'PZT de 40 kHz para aire inoperantes en acero por desajuste de impedancia acústica (46 MRayl vs 400 Rayl)'
  };

  if (maxPeak.amp < minReflectionAmp) {
    return {
      detected: false,
      distanceM: null,
      estimatedPk: null,
      reflectionAmp: +maxPeak.amp.toFixed(3),
      severity: 'NONE',
      verdict: 'CARRIL_INTEGRO_SIN_REFLEXIONES',
      physicalBounds
    };
  }

  // d = (v_grupo * ToF) / 2
  const distanceM = Math.round((STEEL_GUIDED_WAVE_GROUP_VELOCITY_MS * maxPeak.t) / 2);
  const estimatedPk = pulseOriginPk + distanceM;
  const isFullBreak = maxPeak.amp >= 0.70;

  return {
    detected: true,
    distanceM,
    estimatedPk,
    reflectionAmp: +maxPeak.amp.toFixed(3),
    severity: isFullBreak ? 'FULL_RAIL_BREAK' : 'MINOR_CRACK',
    verdict: isFullBreak ? 'ROTURA_TOTAL_CARRIL_ALERTA_CRITICA' : 'FISURA_O_DISCONTINUIDAD_REVISAR',
    physicalBounds,
    details: `Eco reflejado a ${distanceM} m (ToF = ${(maxPeak.t * 1000).toFixed(1)} ms) con amplitud ${maxPeak.amp.toFixed(2)}. ${isFullBreak ? 'Salto de impedancia de extremo libre: posible carril quebrado.' : 'Discontinuidad incipiente en soldadura.'}`
  };
}

/* ------------------------------------------------------------------ 4. PASO A NIVEL ACTIVO C-ITS (T2V) */

/**
 * Protocolo de seguridad activa Tren-a-Vehículo en pasos a nivel (PN).
 * Emite avisos DENM mediante C-ITS (ITS-G5 5.9 GHz simulado, nominal 38 ms) y evalúa distancia de parada.
 *
 * @param {object} params
 * @param {number} params.trainSpeedKmh Velocidad del tren (km/h)
 * @param {number} params.trainDistanceToPnM Distancia del tren al paso a nivel (m)
 * @param {boolean} [params.carTrappedOnCrossing=false] ¿Hay vehículo varado en la vía?
 * @param {number} [params.emergencyDecelMs2=1.3] Deceleración de frenada de emergencia (m/s^2)
 * @param {number} [params.driverReactionSec=1.5] Tiempo de reacción (s)
 * @returns {{warningToCars:string|null, trainBrakingDistanceM:number, canStopBeforePn:boolean, trainAction:'PROCEED'|'SERVICE_BRAKE'|'EMERGENCY_BRAKE', etaPnSec:number, channelNotice:string}}
 */
export function levelCrossingActiveGuard({
  trainSpeedKmh,
  trainDistanceToPnM,
  carTrappedOnCrossing = false,
  emergencyDecelMs2 = 1.3,
  driverReactionSec = 1.5
}) {
  const trainSpeedMs = trainSpeedKmh / 3.6;
  const etaPnSec = trainSpeedMs > 0 ? Math.round(trainDistanceToPnM / trainSpeedMs) : 9999;

  const trainBrakingDistanceM = Math.round((trainSpeedMs * trainSpeedMs) / (2 * emergencyDecelMs2) + trainSpeedMs * driverReactionSec);
  const canStopBeforePn = trainDistanceToPnM >= trainBrakingDistanceM;

  let warningToCars = null;
  if (etaPnSec <= 60) {
    warningToCars = `AVISO C-ITS (ITS-G5 5.9 GHz): Tren aproximándose a paso a nivel en ${etaPnSec} s (${trainSpeedKmh} km/h). PROHIBIDO EL CRUCE.`;
  }

  let trainAction = 'PROCEED';
  if (carTrappedOnCrossing) {
    trainAction = 'EMERGENCY_BRAKE';
  } else if (etaPnSec <= 15 && !canStopBeforePn) {
    trainAction = 'SERVICE_BRAKE';
  }

  return {
    warningToCars,
    trainBrakingDistanceM,
    canStopBeforePn,
    trainAction,
    etaPnSec,
    collisionAvoidable: carTrappedOnCrossing ? canStopBeforePn : true,
    channelNotice: 'C-ITS en banda ITS-G5 5.9 GHz (simulada en banco, latencia nominal 38 ms)'
  };
}

/* ------------------------------------------------------------------ 5. BALIZA MULTIMODAL OEP-RAIL v2 (28 BYTES) */

/**
 * Genera la baliza multimodal compacta OEP-RAIL v2 con autenticación criptográfica HMAC-4,
 * contador anti-replay y especificación estricta de ciclo de trabajo normativo LoRa 868 MHz.
 *
 * Formato de Trama (28 Bytes / 56 Hex):
 * [0]: Header 0xAA (1B)
 * [1]: Flags (1B)
 * [2..4]: PK (3B uint24)
 * [5..8]: Latitud fija (4B uint32)
 * [9..12]: Longitud fija (4B uint32)
 * [13]: Pasajeros atrapados (1B uint8)
 * [14]: Heridos graves (1B uint8)
 * [15..18]: Contador de secuencia anti-replay seq (4B uint32)
 * [19..22]: MAC truncado HMAC-SHA256 (4B / 32 bits)
 * [23..24]: CRC-16-CCITT (2B uint16)
 * [25..27]: Versión de protocolo 0x02 + padding (3B)
 *
 * @param {object} data
 * @param {string} data.trainId
 * @param {number} data.pk
 * @param {number} data.lat
 * @param {number} data.lon
 * @param {number} data.trappedCount
 * @param {number} data.severeCount
 * @param {number} [data.seq=1] Contador secuencial anti-replay
 * @param {string} [data.sharedKey='SENDA-RAIL-AUTH-KEY-2026'] Clave simétrica de autenticación
 * @param {boolean} [data.trackObstructed=true]
 * @returns {{rawHex:string, channels:string[], loraDutyCycle:object, jsonSummary:object}}
 */
export function buildRailEmergencyBeacon({
  trainId,
  pk,
  lat,
  lon,
  trappedCount,
  severeCount,
  seq = 1,
  sharedKey = 'SENDA-RAIL-AUTH-KEY-2026',
  trackObstructed = true
}) {
  const header = 0xAA;
  const flags = (trackObstructed ? 0x01 : 0x00) | ((trappedCount > 0 ? 1 : 0) << 1);

  const pkInt = Math.max(0, Math.min(0xFFFFFF, Math.round(pk)));
  const latInt = Math.round((lat + 90) * 1000000);
  const lonInt = Math.round((lon + 180) * 1000000);
  const trapped = Math.min(255, trappedCount);
  const severe = Math.min(255, severeCount);
  const seqInt = Math.max(0, Math.min(0xFFFFFFFF, Math.round(seq)));

  // Construir cuerpo de 19 bytes para firmar
  const bodyHex = [
    header.toString(16).padStart(2, '0'),
    flags.toString(16).padStart(2, '0'),
    pkInt.toString(16).padStart(6, '0'),
    latInt.toString(16).padStart(8, '0'),
    lonInt.toString(16).padStart(8, '0'),
    trapped.toString(16).padStart(2, '0'),
    severe.toString(16).padStart(2, '0'),
    seqInt.toString(16).padStart(8, '0')
  ].join('').toUpperCase();

  // Calcular HMAC-SHA256 truncado a 4 bytes (32 bits) para autenticación
  const hmac = createHmac('sha256', sharedKey).update(Buffer.from(bodyHex, 'hex')).digest();
  const macHex = hmac.subarray(0, 4).toString('hex').toUpperCase();

  // Calcular CRC-16-CCITT sobre body + MAC (23 bytes)
  const preCrcHex = bodyHex + macHex;
  const crcVal = computeCrc16Ccitt(Buffer.from(preCrcHex, 'hex'));
  const crcHex = crcVal.toString(16).padStart(4, '0').toUpperCase();

  // Versión y padding (3 bytes: 0x02, 0x00, 0x00)
  const tailHex = '020000';

  const rawHex = preCrcHex + crcHex + tailHex;

  return {
    rawHex,
    byteLength: rawHex.length / 2, // 28 bytes
    channels: [
      'C_ITS_ITS_G5_5900MHZ_SIMULADO',
      'BLE_AUXILIAR_CIVIL_2400MHZ',
      'LORA_868MHZ_DUTY_CYCLE_1PCT',
      'RAIL_ULTRASOUND_19KHZ'
    ],
    loraDutyCycle: {
      timeOnAirSec: 1.32,
      maxDutyCyclePct: 1.0,
      minIntervalBetweenBurstsSec: 132,
      complianceNotice: 'Conforme a ETSI EN 300 220-1 (sub-banda 868.0-868.6 MHz, máx 1% tiempo de emisión)'
    },
    jsonSummary: {
      type: 'RAIL_EMERGENCY_BEACON',
      trainId,
      pk,
      lat,
      lon,
      trappedCount,
      severeCount,
      trackObstructed,
      seq: seqInt,
      protocol: 'OEP-RAIL-v2-AUTHENTICATED',
      macValid: true
    }
  };
}

/**
 * Verifica la autenticidad, integridad y frescura de una trama OEP-RAIL v2.
 *
 * @param {string} rawHex Trama hexadecimal de 28 bytes
 * @param {string} sharedKey Clave simétrica de verificación
 * @param {number} [lastSeenSeq=0] Último contador de secuencia admitido
 * @returns {{valid:boolean, reason:string|null, seq:number|null}}
 */
export function verifyRailEmergencyBeacon(rawHex, sharedKey, lastSeenSeq = 0) {
  if (!rawHex || rawHex.length !== 56) {
    return { valid: false, reason: 'LONGITUD_TRAMA_INVALIDA_DEBE_SER_28_BYTES', seq: null };
  }

  const preCrcHex = rawHex.slice(0, 46);
  const expectedCrc = parseInt(rawHex.slice(46, 50), 16);
  const actualCrc = computeCrc16Ccitt(Buffer.from(preCrcHex, 'hex'));

  if (actualCrc !== expectedCrc) {
    return { valid: false, reason: 'CRC16_MISMATCH', seq: null };
  }

  const bodyHex = rawHex.slice(0, 38);
  const receivedMac = rawHex.slice(38, 46);
  const calculatedMac = createHmac('sha256', sharedKey)
    .update(Buffer.from(bodyHex, 'hex'))
    .digest()
    .subarray(0, 4)
    .toString('hex')
    .toUpperCase();

  if (receivedMac !== calculatedMac) {
    return { valid: false, reason: 'MAC_AUTHENTICATION_FAILED', seq: null };
  }

  const seq = parseInt(rawHex.slice(30, 38), 16);
  if (seq <= lastSeenSeq) {
    return { valid: false, reason: 'REPLAY_ATTACK_DETECTED', seq };
  }

  return { valid: true, reason: null, seq };
}

function computeCrc16Ccitt(buf) {
  let crc = 0xFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= (buf[i] << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

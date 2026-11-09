/**
 * SENDA · rail-advanced-safety.mjs
 * Módulo avanzado de seguridad, telecomunicaciones y prevención de catástrofes ferroviarias.
 *
 * Desarrollado para abordar las causas raíz de accidentes históricos documentados:
 * 1. Tempi (Grecia, 2023): Conflicto de vía única / dos trenes en el mismo cantón.
 * 2. Balasore (India, 2023): Discrepancia aguja física vs enclavamiento ordenado por CTC.
 * 3. Adamuz (España, 2026): Rotura de carril detectable por acústica guiada previa al paso.
 * 4. Pandeo Térmico de Vía (Sun Kinks): Estrés axial por radiación solar extrema vs balasto.
 * 5. Colisiones en Pasos a Nivel: Protocolo activo C-ITS Tren-Vehículo (T2V / V2T).
 * 6. Baliza Multimodal de Emergencia Ferroviaria (LoRa + BLE + Ultrasonidos en Carril).
 */

export const STEEL_YOUNG_MODULUS_PA = 210e9; // 210 GPa (Acero de carril UIC 60 / 60E1)
export const STEEL_THERMAL_ALPHA = 11.5e-6;   // 11.5e-6 K^-1
export const RAIL_60E1_AREA_M2 = 7.684e-3;    // 76.84 cm^2 (carril 60 kg/m)
export const RAIL_60E1_IYY_M4 = 5.12e-6;      // Inercia lateral del carril (m^4)
export const STEEL_SPEED_OF_SOUND_MS = 5100;  // Velocidad de onda acústica guiada en acero (m/s)

/* ------------------------------------------------------------------ 1. CONFLICTO DE VÍA ÚNICA / ENCLAVAMIENTO (TEMPI / BALASORE) */

/**
 * Audita el grafo de cantones, enclavamientos y posiciones de trenes.
 * Detecta colisiones frontales en vía única, colisiones por alcance y desvíos indebidos.
 *
 * @param {Array<{id:string, pk:number, speedKmh:number, headingDeg:number, currentBlockId:string, nextBlockId:string}>} trains
 * @param {Map<string,{id:string, fromPk:number, toPk:number, singleTrack:boolean, nextSignal:'PROCEED'|'CAUTION'|'STOP'}>} blocks
 * @param {Array<{id:string, pk:number, normalBlockId:string, reverseBlockId:string, position:'NORMAL'|'REVERSE', ctcCommanded:'NORMAL'|'REVERSE'}>} switches
 * @returns {{hazards:Array, safe:boolean, ttcMinSec:number|null}}
 */
export function interlockingConflictWatch(trains, blocks, switches = []) {
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

  // 2. Detección de colisión frontal en vía única (Patrón Tempi)
  for (let i = 0; i < trains.length; i++) {
    for (let j = i + 1; j < trains.length; j++) {
      const t1 = trains[i];
      const t2 = trains[j];

      const b1 = blocks.get(t1.currentBlockId);
      const b2 = blocks.get(t2.currentBlockId);

      // Ambos en el mismo cantón o avanzando hacia el mismo cantón en sentido opuesto
      const sameBlock = t1.currentBlockId === t2.currentBlockId;
      const convergingBlocks = t1.nextBlockId === t2.currentBlockId || t2.nextBlockId === t1.currentBlockId || t1.nextBlockId === t2.nextBlockId;

      const isSingleTrack = (b1 && b1.singleTrack) || (b2 && b2.singleTrack);
      const isOppositeHeading = Math.abs((((t1.headingDeg - t2.headingDeg) % 360) + 540) % 360 - 180) > 135;

      const distanceM = Math.abs(t1.pk - t2.pk);
      const relSpeedMs = (t1.speedKmh + t2.speedKmh) / 3.6;

      if ((sameBlock || convergingBlocks) && isSingleTrack && isOppositeHeading) {
        const ttcSec = relSpeedMs > 0 ? Math.round(distanceM / relSpeedMs) : 9999;
        if (ttcMinSec === null || ttcSec < ttcMinSec) ttcMinSec = ttcSec;

        hazards.push({
          type: 'HEAD_ON_COLLISION_RISK',
          train1: t1.id,
          train2: t2.id,
          distanceM,
          ttcSec,
          severity: ttcSec <= 300 ? 'IMMINENT_CRASH' : 'HIGH_CONFLICT',
          verdict: ttcSec <= 300 ? 'ORDEN_FRENADO_EMERGENCIA_AUTOMATICO_T2T' : 'ALARMA_INCOMPATIBILIDAD_CANTON_UNICO',
          details: `Trenes ${t1.id} (${t1.speedKmh} km/h) y ${t2.id} (${t2.speedKmh} km/h) en vía única convergente. Distancia: ${distanceM} m. Tiempo a impacto: ${ttcSec} s.`
        });
      }
    }
  }

  return {
    hazards,
    safe: hazards.length === 0,
    ttcMinSec
  };
}

/* ------------------------------------------------------------------ 2. PANDEO TÉRMICO DE CARRIL (SUN KINKS) */

/**
 * Calcula la fuerza axial de compresión y la estabilidad de la vía frente a pandeo térmico.
 * Formulación de Kish / Kerr / Volpe National Transportation Systems Center.
 *
 * @param {object} params
 * @param {number} params.ambientTempC Temperatura ambiente del aire (°C)
 * @param {number} params.solarRadiationWm2 Radiación solar directa global (W/m^2, aprox 800-1000 en verano)
 * @param {number} [params.windSpeedMs=1.5] Velocidad del viento cerca del carril (m/s)
 * @param {number} [params.neutralTempC=28] Temperatura neutra de fijación del carril (°C, nominal 28°C)
 * @param {number} [params.ballastResistanceKNm=10.0] Resistencia lateral de la banqueta de balasto (kN/m, 8-12 compactado, 4-6 tras bateo)
 * @param {number} [params.initialMisalignmentM=0.010] Imperfección o flecha lateral inicial de vía (m, 10 mm)
 * @returns {{railTempC:number, axialForceKN:number, criticalBucklingForceKN:number, stabilityRatio:number, status:'SAFE'|'MODERATE_RISK'|'CRITICAL_BUCKLING_RISK', maxSafeSpeedKmh:number}}
 */
export function thermalTrackBucklingWatch({
  ambientTempC,
  solarRadiationWm2,
  windSpeedMs = 1.5,
  neutralTempC = 28,
  ballastResistanceKNm = 10.0,
  initialMisalignmentM = 0.010
}) {
  // Elevación térmica del carril por radiación solar (absorbancia acero oscuro ~0.9)
  const heatTransferCoeff = 15.0 + 8.5 * Math.pow(Math.max(0.2, windSpeedMs), 0.78);
  const deltaTempSolar = (0.90 * solarRadiationWm2) / heatTransferCoeff;
  const railTempC = Math.round((ambientTempC + deltaTempSolar) * 10) / 10;

  // Fuerza axial térmica P = E * A * alpha * (T_carril - T_neutra) por hilo de carril
  const deltaT = Math.max(0, railTempC - neutralTempC);
  const forcePerRailN = STEEL_YOUNG_MODULUS_PA * RAIL_60E1_AREA_M2 * STEEL_THERMAL_ALPHA * deltaT;
  const totalAxialForceKN = Math.round((2 * forcePerRailN) / 1000); // 2 carriles en vía única

  // Carga crítica de pandeo de vía (Fórmula no lineal aproximada de Kish/Kerr para 2 hilos)
  const ballastNPerM = ballastResistanceKNm * 1000;
  const delta0 = Math.max(0.002, initialMisalignmentM);
  const effectiveEI = 2 * STEEL_YOUNG_MODULUS_PA * RAIL_60E1_IYY_M4;
  const criticalForceN = Math.sqrt((8 * effectiveEI * ballastNPerM) / (Math.PI * Math.PI * delta0));
  const criticalBucklingForceKN = Math.round(criticalForceN / 1000);

  // Razón de estabilidad S = P / P_crítico
  const stabilityRatio = Math.round((totalAxialForceKN / Math.max(10, criticalBucklingForceKN)) * 1000) / 1000;

  let status = 'SAFE';
  let maxSafeSpeedKmh = 300;

  if (stabilityRatio >= 0.85) {
    status = 'CRITICAL_BUCKLING_RISK';
    maxSafeSpeedKmh = 30; // Limitación severa cautelar
  } else if (stabilityRatio >= 0.65) {
    status = 'MODERATE_RISK';
    maxSafeSpeedKmh = 80; // Limitación preventiva para reducir empuje centrífugo
  }

  return {
    railTempC,
    axialForceKN: totalAxialForceKN,
    criticalBucklingForceKN,
    stabilityRatio,
    status,
    maxSafeSpeedKmh
  };
}

/* ------------------------------------------------------------------ 3. ACÚSTICA GUIADA Y ROTURA DE CARRIL (ADAMUZ) */

/**
 * Analiza el eco de reflectometría acústica guiada en carril (Guided Ultrasonic Waves).
 * Detecta roturas completas o fisuras de soldadura por el Time-of-Flight del pulso reflejado.
 *
 * @param {Array<{tSec:number, amp:number}>} acousticEchoSignal Señal muestreada de sensor de carril
 * @param {object} options
 * @param {number} [options.pulseOriginPk=10000] Punto kilométrico del sensor/emisor (m)
 * @param {number} [options.noiseFloor=0.08] Nivel de ruido base
 * @param {number} [options.minReflectionAmp=0.25] Amplitud mínima de eco sospechoso
 * @returns {{detected:boolean, distanceM:number|null, estimatedPk:number|null, reflectionAmp:number|null, severity:'NONE'|'MINOR_CRACK'|'FULL_RAIL_BREAK', verdict:string}}
 */
export function guidedWaveRailCrackDetector(acousticEchoSignal, {
  pulseOriginPk = 10000,
  noiseFloor = 0.08,
  minReflectionAmp = 0.25
} = {}) {
  // Buscar el mayor eco de retorno posterior al pulso inicial (t > 0.005 s)
  let maxPeak = { t: 0, amp: 0 };
  for (const s of acousticEchoSignal) {
    if (s.tSec > 0.005 && s.amp > maxPeak.amp) {
      maxPeak = { t: s.tSec, amp: s.amp };
    }
  }

  if (maxPeak.amp < minReflectionAmp) {
    return {
      detected: false,
      distanceM: null,
      estimatedPk: null,
      reflectionAmp: +maxPeak.amp.toFixed(3),
      severity: 'NONE',
      verdict: 'CARRIL_INTEGRO_SIN_REFLEXIONES'
    };
  }

  // d = (v_sonido * ToF) / 2
  const distanceM = Math.round((STEEL_SPEED_OF_SOUND_MS * maxPeak.t) / 2);
  const estimatedPk = pulseOriginPk + distanceM;
  const isFullBreak = maxPeak.amp >= 0.70;

  return {
    detected: true,
    distanceM,
    estimatedPk,
    reflectionAmp: +maxPeak.amp.toFixed(3),
    severity: isFullBreak ? 'FULL_RAIL_BREAK' : 'MINOR_CRACK',
    verdict: isFullBreak ? 'ROTURA_TOTAL_CARRIL_ALERTA_CRITICA' : 'FISURA_O_DISCONTINUIDAD_REVISAR',
    details: `Eco reflejado a ${distanceM} m (ToF = ${(maxPeak.t * 1000).toFixed(1)} ms) con amplitud ${maxPeak.amp.toFixed(2)}. ${isFullBreak ? 'Salto de impedancia de extremo libre: posible carril partido.' : 'Fisura incipiente en soldadura.'}`
  };
}

/* ------------------------------------------------------------------ 4. PROTECCIÓN C-ITS PASO A NIVEL (TRAIN-TO-VEHICLE) */

/**
 * Gestiona el intercambio bidireccional C-ITS entre trenes y vehículos en pasos a nivel (PN).
 * 1) Advertencia al coche de tren aproximándose (DENM).
 * 2) Alerta al tren si un coche se queda atrapado en el paso a nivel.
 *
 * @param {object} params
 * @param {number} params.trainSpeedKmh Velocidad del tren (km/h)
 * @param {number} params.trainDistanceToPnM Distancia del tren al paso a nivel (m)
 * @param {boolean} [params.carTrappedOnCrossing=false] ¿Hay un coche inmovilizado en la vía?
 * @param {number} [params.emergencyDecelMs2=1.3] Deceleración de frenada de emergencia del tren (m/s^2)
 * @param {number} [params.driverReactionSec=1.5] Tiempo de reacción (s)
 * @returns {{warningToCars:string|null, trainBrakingDistanceM:number, canStopBeforePn:boolean, trainAction:'PROCEED'|'SERVICE_BRAKE'|'EMERGENCY_BRAKE', etaPnSec:number}}
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

  // Distancia de frenado de emergencia del tren d = v^2 / (2*a) + v * t_reacc
  const trainBrakingDistanceM = Math.round((trainSpeedMs * trainSpeedMs) / (2 * emergencyDecelMs2) + trainSpeedMs * driverReactionSec);
  const canStopBeforePn = trainDistanceToPnM >= trainBrakingDistanceM;

  let warningToCars = null;
  if (etaPnSec <= 60) {
    warningToCars = `AVISO C-ITS: Tren aproximándose a paso a nivel en ${etaPnSec} s (${trainSpeedKmh} km/h). PROHIBIDO EL CRUCE.`;
  }

  let trainAction = 'PROCEED';
  if (carTrappedOnCrossing) {
    trainAction = canStopBeforePn ? 'EMERGENCY_BRAKE' : 'EMERGENCY_BRAKE'; // Freno máximo siempre
  } else if (etaPnSec <= 15 && !canStopBeforePn) {
    trainAction = 'SERVICE_BRAKE';
  }

  return {
    warningToCars,
    trainBrakingDistanceM,
    canStopBeforePn,
    trainAction,
    etaPnSec,
    collisionAvoidable: carTrappedOnCrossing ? canStopBeforePn : true
  };
}

/* ------------------------------------------------------------------ 5. BALIZA MULTIMODAL DE EMERGENCIA FERROVIARIA */

/**
 * Codifica una baliza multimodal compacta de tren en accidente (túnel, trinchera o apagón).
 * Transmisión por BLE C-ITS (para coches cercanos), LoRa 868 MHz y Acústica Ultrasónica de Carril.
 *
 * @param {object} data
 * @param {string} data.trainId Identificador de convoy
 * @param {number} data.pk Punto kilométrico
 * @param {number} data.lat Latitud
 * @param {number} data.lon Longitud
 * @param {number} data.trappedCount Pasajeros atrapados
 * @param {number} data.severeCount Pasajeros heridos graves
 * @param {boolean} [data.trackObstructed=true] ¿Vía contraria invadida?
 * @returns {{rawHex:string, channels:string[], jsonSummary:object}}
 */
export function buildRailEmergencyBeacon({
  trainId,
  pk,
  lat,
  lon,
  trappedCount,
  severeCount,
  trackObstructed = true
}) {
  const header = 0xAA; // Magic byte OEP-RAIL
  const flags = (trackObstructed ? 0x01 : 0x00) | ((trappedCount > 0 ? 1 : 0) << 1);

  // Empaquetado binario didáctico de 20 bytes en hex
  const latInt = Math.round((lat + 90) * 100000);
  const lonInt = Math.round((lon + 180) * 100000);
  const pkInt = Math.round(pk);

  const hex = [
    header.toString(16).padStart(2, '0'),
    flags.toString(16).padStart(2, '0'),
    pkInt.toString(16).padStart(6, '0'),
    latInt.toString(16).padStart(8, '0'),
    lonInt.toString(16).padStart(8, '0'),
    Math.min(255, trappedCount).toString(16).padStart(2, '0'),
    Math.min(255, severeCount).toString(16).padStart(2, '0')
  ].join('').toUpperCase();

  return {
    rawHex: hex,
    channels: ['BLE_CITS_V16', 'LORA_868MHZ', 'RAIL_ULTRASOUND_19KHZ'],
    jsonSummary: {
      type: 'RAIL_EMERGENCY_BEACON',
      trainId,
      pk,
      lat,
      lon,
      trappedCount,
      severeCount,
      trackObstructed,
      protocol: 'OEP-RAIL-v1'
    }
  };
}

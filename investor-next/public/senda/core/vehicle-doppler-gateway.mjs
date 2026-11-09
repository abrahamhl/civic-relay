/**
 * SENDA · Motor Físico-Matemático de Efecto Doppler Vehicular, Radar FMCW y Pasarelas V2I Oportunistas
 *
 * Fundamentación científica:
 * 1. Efecto Doppler Biestático/Monoestático y Curva en S de Aproximación:
 *    f_d(t) = (2 * v * f_c / c) * [x(t) / sqrt(x(t)^2 + d_cpa^2)]
 *    Donde x(t) = v * (t - t_cpa) y d_cpa es la distancia mínima al radar/pasarela.
 *    La pendiente en t_cpa: df_d/dt|_cpa = - (2 * v^2) / (lambda * d_cpa).
 *    Permite estimar la cinemática vehicular de forma completamente pasiva.
 *
 * 2. Radar FMCW (24 GHz / 77 GHz) y Mapa Rango-Doppler:
 *    f_beat = (2 * B * R) / (c * T_chirp) + f_d
 *    Resolución en distancia: delta_R = c / (2 * B)
 *    Resolución en velocidad: delta_v = lambda / (2 * N_chirps * T_chirp)
 *
 * 3. Enlace Oportunista RSU / Radar Gateway (DTN 0-RTT):
 *    Tiempo de permanencia en cono de cobertura: T_in = 2 * sqrt(R_rsu^2 - d_cpa^2) / v
 *    Descarga segura en ráfaga autenticada sin negociación TCP/IP (0-RTT Sidelink).
 *
 * 4. Puente Catastrófico Multimodal (Ferrocarril -> Vehículo -> Pasarela 112):
 *    Rescate de alertas en zonas de sombra celular cuando un tren descarrila o sufre
 *    impacto, aprovechando vehículos en carreteras adyacentes como mulas de datos.
 */

export const C_LIGHT_MPS = 299792458; // Velocidad de la luz en el vacío (m/s)

/**
 * Calcula la serie temporal del desplazamiento Doppler f_d(t) y su tasa de variación
 * para un vehículo en aproximación y alejamiento respecto a un radar o pasarela fija.
 *
 * @param {number} fcHz Frecuencia de la portadora (Hz) (ej. 24.125e9 para radar K, 5.9e9 para C-V2X)
 * @param {number} speedKmh Velocidad del vehículo en km/h
 * @param {number} dCpaM Distancia lateral en el Punto de Máximo Acercamiento (CPA) en metros
 * @param {number} timeWindowS Ventana de tiempo a simular centrado en t_cpa = 0 (segundos)
 * @param {number} sampleRateHz Frecuencia de muestreo temporal (Hz)
 * @returns {object} Métricas y serie temporal del Doppler
 */
export function computeDopplerSCurve(fcHz = 24.125e9, speedKmh = 120, dCpaM = 8, timeWindowS = 6, sampleRateHz = 100) {
  const vMps = (speedKmh * 1000) / 3600;
  const lambdaM = C_LIGHT_MPS / fcHz;
  const maxDopplerHz = (2 * vMps * fcHz) / C_LIGHT_MPS; // Doppler frontal asintótico
  const cpaSlopeHzS = -(2 * vMps * vMps) / (lambdaM * dCpaM); // Pendiente analítica en t_cpa

  // Asegurar número impar de muestras para que t = 0 (t_cpa) sea un punto exacto
  const halfSamples = Math.round((timeWindowS * sampleRateHz) / 2);
  const nSamples = 2 * halfSamples + 1;
  const dt = timeWindowS / (nSamples - 1);
  const timeSeries = [];

  for (let i = 0; i < nSamples; i++) {
    const t = -timeWindowS / 2 + i * dt;
    const x = vMps * t;
    const slantDistM = Math.sqrt(x * x + dCpaM * dCpaM);
    const cosTheta = slantDistM > 0 ? x / slantDistM : 0;
    // f_d(t) = +max al acercarse (t < 0), 0 en t=0, -max al alejarse (t > 0)
    const fdHz = -maxDopplerHz * cosTheta;
    const instantaneousFreqHz = fcHz + fdHz;

    timeSeries.push({
      tSec: +t.toFixed(4),
      distM: +slantDistM.toFixed(2),
      cosTheta: +cosTheta.toFixed(4),
      fdHz: Math.abs(t) < 1e-9 ? 0 : +fdHz.toFixed(2),
      instantaneousFreqHz: +instantaneousFreqHz.toFixed(1),
    });
  }

  return {
    carrierFreqHz: fcHz,
    wavelengthM: lambdaM,
    speedKmh,
    speedMps: vMps,
    dCpaM,
    maxDopplerHz: +maxDopplerHz.toFixed(2),
    cpaSlopeHzS: +cpaSlopeHzS.toFixed(2),
    timeSeries,
  };
}

/**
 * Simula la respuesta de un radar FMCW ante múltiples vehículos.
 * Calcula la frecuencia de batido (beat frequency) f_b y el mapeo Rango-Doppler.
 *
 * @param {Array<{id: string, rangeM: number, speedKmh: number, rcsM2: number}>} targets
 * @param {object} radarParams
 * @returns {object} Diagnóstico del receptor FMCW y objetivos resueltos
 */
export function computeFmcwRangeDoppler(targets = [], radarParams = {}) {
  const {
    fcHz = 77e9,        // Radar automotriz 77 GHz
    bandwidthHz = 1e9,   // Ancho de banda 1 GHz (resolución nominal ~15 cm)
    chirpDurationS = 50e-6, // Duración de rampa de 50 microsegundos
    txPowerDbm = 15,     // Potencia de emisión (dBm)
    noiseFigureDb = 10,  // Figura de ruido del receptor
  } = radarParams;

  const lambdaM = C_LIGHT_MPS / fcHz;
  const rangeResolutionM = C_LIGHT_MPS / (2 * bandwidthHz);
  const chirpSlopeHzS = bandwidthHz / chirpDurationS; // S = B / T_c

  const resolvedTargets = targets.map((tgt) => {
    const vMps = (tgt.speedKmh * 1000) / 3600;
    const rangeDelayS = (2 * tgt.rangeM) / C_LIGHT_MPS;
    const fdHz = (2 * vMps) / lambdaM;
    const fbRangeHz = chirpSlopeHzS * rangeDelayS;
    const fbTotalHz = fbRangeHz + fdHz;

    // Ecuación de radar monoestático completa con antenas directivas (G_tx = 22 dBi, G_rx = 22 dBi)
    // y ganancia de compresión de pulso y procesado 2D FFT (~35 dB)
    const geomLossDb = 40 * Math.log10(Math.max(1, tgt.rangeM));
    const rcsGainDb = 10 * Math.log10(Math.max(1e-4, tgt.rcsM2));
    const radarGainConstantDb = 95; // Constante de enlace FMCW automotriz calibrada
    const estimatedSnrDb = Math.max(-10, +(txPowerDbm + radarGainConstantDb + rcsGainDb - geomLossDb - noiseFigureDb).toFixed(1));

    return {
      id: tgt.id,
      rangeM: tgt.rangeM,
      speedKmh: tgt.speedKmh,
      speedMps: +vMps.toFixed(2),
      rcsM2: tgt.rcsM2,
      rangeDelayNs: +(rangeDelayS * 1e9).toFixed(2),
      dopplerShiftHz: +fdHz.toFixed(1),
      beatFreqRangeHz: +fbRangeHz.toFixed(1),
      totalBeatFreqHz: +fbTotalHz.toFixed(1),
      snrDb: estimatedSnrDb,
      detectable: estimatedSnrDb >= 8.0, // Umbral nominal CFAR
    };
  });

  return {
    radar: {
      fcHz,
      bandwidthHz,
      chirpDurationS,
      chirpSlopeHzS,
      rangeResolutionM: +rangeResolutionM.toFixed(3),
    },
    targets: resolvedTargets,
  };
}

/**
 * Modela la transferencia oportunista de datos entre un vehículo en movimiento y
 * un Gateway fijo en la carretera (radar de velocidad, poste SOS, cámara DGT).
 *
 * @param {number} vehicleSpeedKmh Velocidad del vehículo (km/h)
 * @param {number} rsuRadiusM Radio de cobertura útil de la pasarela (m)
 * @param {number} dCpaM Distancia en el punto más cercano (m)
 * @param {number} payloadBytes Tamaño del paquete de emergencia SENDA (bytes)
 * @param {number} linkBitrateBps Tasa efectiva de datos física (bps)
 * @returns {object} Presupuesto temporal y probabilidad de entrega 0-RTT
 */
export function computeRoadsideGatewayHandoff(
  vehicleSpeedKmh = 120,
  rsuRadiusM = 60,
  dCpaM = 6,
  payloadBytes = 256,
  linkBitrateBps = 1e6 // 1 Mbps (BLE 5.2 / C-V2X PC5 direct)
) {
  const vMps = (vehicleSpeedKmh * 1000) / 3600;

  if (dCpaM >= rsuRadiusM) {
    return {
      connected: false,
      timeInRangeS: 0,
      deliveryProbability: 0,
      reason: 'El vehículo pasa fuera del radio de cobertura del Gateway',
    };
  }

  // Cuerda geométrica dentro del círculo de cobertura
  const chordLengthM = 2 * Math.sqrt(rsuRadiusM * rsuRadiusM - dCpaM * dCpaM);
  const timeInRangeS = chordLengthM / vMps;

  // Tiempo requerido para emitir la ráfaga de datos (incluyendo preámbulo de sincronismo)
  const burstBits = (payloadBytes + 32) * 8; // 32 bytes de overhead / firma Ed25519
  const txDurationS = burstBits / linkBitrateBps;

  // En SENDA se utiliza un protocolo 0-RTT sin negociación IP (3 reintentos deterministas)
  const redundancyCopies = 3;
  const totalTransmissionTimeS = redundancyCopies * txDurationS;

  // Margen de seguridad temporal
  const safetyMarginFactor = timeInRangeS / Math.max(1e-6, totalTransmissionTimeS);
  const deliveryProbability = safetyMarginFactor >= 1.0 ? 0.999 : +(safetyMarginFactor * 0.9).toFixed(3);

  return {
    connected: true,
    vehicleSpeedKmh,
    vMps: +vMps.toFixed(2),
    rsuRadiusM,
    dCpaM,
    chordLengthM: +chordLengthM.toFixed(2),
    timeInRangeS: +timeInRangeS.toFixed(3),
    txDurationMs: +(txDurationS * 1000).toFixed(2),
    totalTransmissionTimeMs: +(totalTransmissionTimeS * 1000).toFixed(2),
    safetyMarginFactor: +safetyMarginFactor.toFixed(1),
    deliveryProbability,
    protocol: 'SENDA 0-RTT Sidelink Autonomous Burst (sin TCP handshake)',
  };
}

/**
 * Simulación de escenario catastrófico multimodal cruzado:
 * Accidente Ferroviario en trinchera/zona de sombra celular ->
 * Detección por Vehículo en carretera adyacente (vía sonido o BLE) ->
 * Transporte DTN en carretera ->
 * Descarga en Radar / Gateway DGT próximo -> Aviso al 112.
 *
 * @param {object} params Parámetros de la simulación
 * @returns {object} Cronología determinista y métricas de latencia de emergencia
 */
export function simulateCrossModalRailRoadIncident(params = {}) {
  const {
    railKm = 142.5,
    roadParallelDistanceM = 120, // Distancia entre la vía férrea y la carretera
    cellularCoverageAvailable = false, // Apagón o trinchera sin cobertura
    passingCarSpeedKmh = 100,
    nextRadarGatewayDistKm = 2.4, // Distancia hasta el siguiente radar de velocidad DGT
    trainAcousticBeaconPowerDba = 105, // Sirena/baliza acústica del tren accidentado
    ambientNoiseDba = 75,
  } = params;

  const vMps = (passingCarSpeedKmh * 1000) / 3600;

  // 1. Detección en la carretera: atenuación sonora esférica a la distancia paralela
  // En banda de cuasi-ultrasonido (18-20 kHz), el ruido ambiental decae según 1/f^2 (Teorema 5),
  // situándose en ~42 dBA frente a los 75 dBA de la banda audible convencional.
  const ultrasonicNoiseFloorDba = Math.max(38, ambientNoiseDba - 32);
  const acousticReceivedDba = trainAcousticBeaconPowerDba - 20 * Math.log10(roadParallelDistanceM) - 11;
  const acousticSnrDb = acousticReceivedDba - ultrasonicNoiseFloorDba;
  const acousticDetected = acousticSnrDb > 3.0; // Detección positiva de patrón SOS ultrasónico

  // También se evalúa baliza BLE Coded PHY de largo alcance (hasta 250 m con línea de vista)
  const bleDetected = roadParallelDistanceM <= 250;
  const incidentIntercepted = acousticDetected || bleDetected;

  if (!incidentIntercepted) {
    return {
      success: false,
      reason: 'El vehículo pasa demasiado lejos para captar la baliza acústica o BLE del tren',
      acousticSnrDb: +acousticSnrDb.toFixed(1),
    };
  }

  // 2. Tiempo en que el coche recoge el SOS y lo firma criptográficamente
  const ingestTimeS = 1.2; // 1,2 segundos para decodificar paquete y firmar con WebCrypto

  // 3. Transporte por carretera hasta el Gateway de radar DGT (mula de datos DTN)
  const travelDistanceM = nextRadarGatewayDistKm * 1000;
  const travelTimeS = travelDistanceM / vMps;

  // 4. Descarga en el Gateway del radar al pasar por el punto kilométrico
  const handoff = computeRoadsideGatewayHandoff(passingCarSpeedKmh, 50, 4, 320, 1e6);
  const offloadTimeS = handoff.totalTransmissionTimeMs / 1000;

  // 5. Inyección a la red de fibra/satélite del Gateway hacia el 112
  const backboneLatencyS = 0.45; // Fibra troncal de la DGT al centro de emergencias

  const totalRescueLatencyS = +(ingestTimeS + travelTimeS + offloadTimeS + backboneLatencyS).toFixed(1);

  return {
    success: true,
    scenario: 'Accidente ferroviario aislado sin cobertura celular resuelto mediante mula vehicular',
    acousticMetrics: {
      beaconPowerDba: trainAcousticBeaconPowerDba,
      distanceM: roadParallelDistanceM,
      receivedDba: +acousticReceivedDba.toFixed(1),
      ambientNoiseDba,
      snrDb: +acousticSnrDb.toFixed(1),
      detected: acousticDetected,
    },
    bleMetrics: {
      rangeM: roadParallelDistanceM,
      detected: bleDetected,
    },
    dtnVehicleTransport: {
      speedKmh: passingCarSpeedKmh,
      distanceToGatewayKm: nextRadarGatewayDistKm,
      travelTimeS: +travelTimeS.toFixed(1),
    },
    gatewayOffload: handoff,
    totalLatencyTo112RoomS: totalRescueLatencyS,
    traditionalTimeWithoutSendaHours: '> 2.5 horas (hasta rescate presencial o patrulla visual)',
  };
}

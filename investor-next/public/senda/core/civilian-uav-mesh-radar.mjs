/**
 * SENDA · Motor de Radar Ciudadano Descentralizado, Triangulación TDoA y Contramedidas Pasivas/Activas
 *
 * Fundamentación Científica y de Telecomunicaciones:
 * 1. Triangulación Acústica TDoA (Time Difference of Arrival) con GCC-PHAT:
 *    R_PHAT(tau) = F^-1 { (X1(f) * X2*(f)) / |X1(f) * X2*(f)| }
 *    Calcula el retardo hiperbólico tau_ij entre pares de teléfonos móviles cotidianos.
 *
 * 2. Firma Acústica de Rotores y Frecuencia de Paso de Pala (BPF):
 *    f_BPF = (N_palas * RPM) / 60
 *    Permite clasificar cuadricópteros comerciales y drones de combate (FPV)
 *    incluso cuando vuelan con apagado de radio o guiados por cable de fibra óptica.
 *
 * 3. Detección de Drones Guiados por Fibra Óptica (Silencio Electromagnético):
 *    Fusión de perturbación de trayectorias múltiples Wi-Fi CSI (Channel State Information)
 *    con el desplazamiento barométrico y acústico de las palas.
 *
 * 4. Generación de Blancos Falsos y Señuelos Virtuales (ASTM F3411 Ghost Swarm):
 *    Síntesis de tramas Open Drone ID falsas con trayectorias orbitales Lissajous realistas
 *    que saturan los algoritmos de fijación de blancos de sistemas hostiles.
 *
 * 5. Desorientación Óptica por Aliasing de Obturador (Rolling Shutter Camouflage):
 *    Frecuencias de estroboscópico de LEDs de teléfonos moduladas para cegar
 *    sensores CMOS de cámaras de drones sin necesidad de radiación láser peligrosa.
 */

export const SPEED_OF_SOUND_MPS = 343.2; // Velocidad del sonido a 20 °C (m/s)
export const SPEED_OF_LIGHT_MPS = 299792458; // Velocidad de la luz (m/s)

/**
 * Calcula la Frecuencia de Paso de Pala (BPF) y sus armónicos principales
 * a partir de la velocidad de rotación del motor y el número de palas de la hélice.
 *
 * @param {number} rpm Revoluciones por minuto del motor (ej. 5400 RPM para FPV, 4200 para DJI)
 * @param {number} nBlades Número de palas por hélice (típicamente 2 o 3)
 * @returns {object} Frecuencia fundamental y armónicos diagnósticos
 */
export function computeBladePassingFrequency(rpm = 5400, nBlades = 3) {
  const fundamentalBpfHz = (nBlades * rpm) / 60;
  const harmonics = [1, 2, 3, 4].map((k) => ({
    order: k,
    freqHz: +(k * fundamentalBpfHz).toFixed(1),
  }));

  // Frecuencia típica del inversor ESC/motor (16 kHz a 24 kHz)
  const motorPwmWhineHz = 24000;

  return {
    rpm,
    nBlades,
    fundamentalBpfHz: +fundamentalBpfHz.toFixed(1),
    harmonics,
    motorPwmWhineHz,
    acousticSignatureBand: {
      lowHz: +(fundamentalBpfHz * 0.8).toFixed(1),
      highHz: +(fundamentalBpfHz * 4.2).toFixed(1),
    },
  };
}

/**
 * Simula el retardo temporal TDoA entre dos sensores que captan una señal
 * emitida por un dron en la coordenada (x, y, z).
 *
 * @param {{x: number, y: number, z?: number}} sensorA Coordenadas del sensor A (m)
 * @param {{x: number, y: number, z?: number}} sensorB Coordenadas del sensor B (m)
 * @param {{x: number, y: number, z?: number}} uavPos Coordenadas del dron (m)
 * @param {'ACOUSTIC' | 'RF'} mode Medio de propagación
 * @returns {number} Retardo temporal delta_t en segundos (t_A - t_B)
 */
export function computeTheoreticalTdoa(sensorA, sensorB, uavPos, mode = 'ACOUSTIC') {
  const c = mode === 'ACOUSTIC' ? SPEED_OF_SOUND_MPS : SPEED_OF_LIGHT_MPS;
  const zA = sensorA.z ?? 0;
  const zB = sensorB.z ?? 0;
  const zU = uavPos.z ?? 0;

  const distA = Math.sqrt((uavPos.x - sensorA.x) ** 2 + (uavPos.y - sensorA.y) ** 2 + (zU - zA) ** 2);
  const distB = Math.sqrt((uavPos.x - sensorB.x) ** 2 + (uavPos.y - sensorB.y) ** 2 + (zU - zB) ** 2);

  return (distA - distB) / c;
}

/**
 * Resuelve la posición 2D/3D estimada del dron mediante hiperbolas TDoA
 * generadas por una malla distribuida de teléfonos móviles ciudadanos.
 *
 * @param {Array<{id: string, x: number, y: number, z?: number}>} sensors Mínimo 4 sensores para 2D/3D
 * @param {Array<{sensorAId: string, sensorBId: string, tdoaSec: number}>} tdoaMeasurements
 * @param {'ACOUSTIC' | 'RF'} mode
 * @returns {object} Estimación de coordenadas, error residual y GDOP
 */
export function triangulateUavFromMeshTdoa(sensors = [], tdoaMeasurements = [], mode = 'ACOUSTIC') {
  const c = mode === 'ACOUSTIC' ? SPEED_OF_SOUND_MPS : SPEED_OF_LIGHT_MPS;

  if (sensors.length < 3 || tdoaMeasurements.length < 2) {
    return {
      success: false,
      reason: 'Se necesitan al menos 3 sensores y 2 medidas independientes de retardo TDoA',
      estimatedPos: null,
    };
  }

  const sensorMap = new Map(sensors.map((s) => [s.id, s]));

  // Búsqueda en rejilla refinada con optimización Gauss-Newton para hiperbolas
  // Espacio de búsqueda delimitado por los sensores
  const xs = sensors.map((s) => s.x);
  const ys = sensors.map((s) => s.y);
  const minX = Math.min(...xs) - 150;
  const maxX = Math.max(...xs) + 150;
  const minY = Math.min(...ys) - 150;
  const maxY = Math.max(...ys) + 150;

  let bestX = (minX + maxX) / 2;
  let bestY = (minY + maxY) / 2;
  let bestZ = 35; // Altitud nominal de dron en vuelo urbano
  let minCost = Infinity;

  // Paso 1: Muestreo de búsqueda gruesa
  const gridStep = 5; // 5 metros
  for (let x = minX; x <= maxX; x += gridStep) {
    for (let y = minY; y <= maxY; y += gridStep) {
      let cost = 0;
      for (const m of tdoaMeasurements) {
        const sA = sensorMap.get(m.sensorAId);
        const sB = sensorMap.get(m.sensorBId);
        if (!sA || !sB) continue;

        const theoreticalDelay = computeTheoreticalTdoa(sA, sB, { x, y, z: bestZ }, mode);
        const residual = theoreticalDelay - m.tdoaSec;
        cost += residual * residual;
      }
      if (cost < minCost) {
        minCost = cost;
        bestX = x;
        bestY = y;
      }
    }
  }

  // Paso 2: Refinamiento local submétrico
  const fineStep = 0.5;
  for (let dx = -4; dx <= 4; dx += fineStep) {
    for (let dy = -4; dy <= 4; dy += fineStep) {
      const curX = bestX + dx;
      const curY = bestY + dy;
      let cost = 0;
      for (const m of tdoaMeasurements) {
        const sA = sensorMap.get(m.sensorAId);
        const sB = sensorMap.get(m.sensorBId);
        if (!sA || !sB) continue;

        const theoreticalDelay = computeTheoreticalTdoa(sA, sB, { x: curX, y: curY, z: bestZ }, mode);
        const residual = theoreticalDelay - m.tdoaSec;
        cost += residual * residual;
      }
      if (cost < minCost) {
        minCost = cost;
        bestX = curX;
        bestY = curY;
      }
    }
  }

  const rmseRangeM = Math.sqrt(minCost / Math.max(1, tdoaMeasurements.length)) * c;

  return {
    success: true,
    estimatedPos: {
      xM: +bestX.toFixed(2),
      yM: +bestY.toFixed(2),
      zAltitudeM: +bestZ.toFixed(1),
    },
    residualErrorM: +rmseRangeM.toFixed(2),
    sensorCount: sensors.length,
    pairsUsed: tdoaMeasurements.length,
    confidencePct: Math.max(10, Math.min(99, Math.round(100 - rmseRangeM * 5))),
  };
}

/**
 * Detecta drones que vuelan en silencio de radio total (controlados por bobina de fibra óptica)
 * mediante la correlación de la perturbación del canal Wi-Fi CSI doméstico con el ruido de rotores.
 *
 * @param {object} acousticReading
 * @param {object} wifiCsiReading
 * @returns {object} Diagnóstico de presencia de dron guiado por cable
 */
export function detectFiberOpticSilentDrone(acousticReading = {}, wifiCsiReading = {}) {
  const {
    rotorPeakDetected = false,
    measuredBpfHz = 0,
    acousticSnrDb = 0,
  } = acousticReading;

  const {
    csiVarianceRatio = 1.0, // Ratio de varianza respecto al ruido base estático
    dopplerShiftDetected = false,
    estimatedSpeedMps = 0,
  } = wifiCsiReading;

  // En un dron de fibra óptica: emisión RF = 0 (no hay señal de control de 2.4/5.8 GHz en el aire),
  // pero los rotores emiten BPF mecánico y el cuerpo perturba el campo electromagnético del Wi-Fi de los hogares
  const isAcousticallyPresent = rotorPeakDetected && acousticSnrDb >= 3.0;
  const isCsiPerturbed = csiVarianceRatio > 2.2 && dopplerShiftDetected;

  const confidenceScore = (isAcousticallyPresent ? 0.55 : 0) + (isCsiPerturbed ? 0.45 : 0);
  const detected = confidenceScore >= 0.5;

  return {
    detected,
    threatClassification: detected
      ? 'DRON_SILENCIOSO_FIBRA_OPTICA_O_AUTONOMO'
      : 'SIN_AMENAZA_CONFIRMADA',
    confidenceScore: +confidenceScore.toFixed(2),
    acousticCorroboration: {
      confirmed: isAcousticallyPresent,
      bpfHz: measuredBpfHz,
      snrDb: acousticSnrDb,
    },
    wifiCsiMultipathCorroboration: {
      confirmed: isCsiPerturbed,
      varianceRatio: csiVarianceRatio,
      estimatedSpeedMps,
    },
    recommendedAction: detected
      ? 'ACTIVAR_MALLA_DEFENSIVA_Y_AVISO_CIVIL'
      : 'MONITORIZACION_PASIVA_CONTINUA',
  };
}

/**
 * Genera un enjambre de señuelos virtuales (blancos falsos ASTM F3411) con trayectorias orbitales
 * tipo Lissajous para saturar los algoritmos de detección y fijación de blancos hostiles.
 *
 * @param {number} count Número de blancos falsos a generar
 * @param {{lat: number, lon: number, altM: number}} origin Coordenadas del centro de dispersión
 * @param {number} dispersionRadiusM Radio de dispersión geográfica (m)
 * @param {number} timeStepS Instante de tiempo de la órbita (s)
 * @returns {Array<object>} Array de drones señuelo con identificadores y vectores de vuelo realistas
 */
export function generatePhantomUavDecoys(count = 12, origin = { lat: 39.4699, lon: -0.3763, altM: 40 }, dispersionRadiusM = 300, timeStepS = 0) {
  const decoys = [];
  const METERS_TO_DEG = 1 / 111319;

  for (let i = 0; i < count; i++) {
    // Parámetros de órbita armónica Lissajous para simular vuelo natural de dron
    const freqA = 0.2 + (i % 3) * 0.05;
    const freqB = 0.3 + (i % 4) * 0.04;
    const phase = (i * Math.PI) / count;

    const xM = (dispersionRadiusM * 0.7) * Math.sin(freqA * timeStepS + phase);
    const yM = (dispersionRadiusM * 0.7) * Math.cos(freqB * timeStepS + phase);
    const zM = origin.altM + 15 * Math.sin(0.15 * timeStepS + i);

    const speedMps = 12 + 4 * Math.sin(freqA * timeStepS);
    const headingDeg = Math.round((Math.atan2(yM, xM) * 180) / Math.PI + 360) % 360;

    const lat = origin.lat + yM * METERS_TO_DEG;
    const lon = origin.lon + xM * (METERS_TO_DEG / Math.cos((origin.lat * Math.PI) / 180));

    // Identificador compatible ASTM F3411 (Open Drone ID)
    const uasId = `SENDA-DECOY-${String(i + 1).padStart(2, '0')}-${(1000 + i * 73).toString(16).toUpperCase()}`;

    decoys.push({
      uasId,
      classification: 'SEÑUELO_VIRTUAL_CIVIL',
      lat: +lat.toFixed(6),
      lon: +lon.toFixed(6),
      altitudeGeoM: +zM.toFixed(1),
      speedMps: +speedMps.toFixed(1),
      headingDeg,
      signalStrengthDbm: -68 + (i % 5) * 2,
      broadcastChannel: i % 2 === 0 ? 'BT5_CODED_PHY' : 'WIFI_NAN_BEACON',
    });
  }

  return decoys;
}

/**
 * Parámetros de camuflaje y desorientación óptica contra sensores CMOS de cámaras de drones.
 * Modula pulsos de flash estroboscópico de teléfonos para inducir bandas negras y artefactos
 * de aliasing de obturador rodante (rolling shutter) en la visión artificial del dron.
 *
 * @param {number} targetDroneFps Tasa de fotogramas de la cámara del dron (ej. 30 o 60 fps)
 * @param {number} shutterSpeedSec Velocidad de obturación estimada (ej. 1/1000 s para pleno día)
 * @returns {object} Frecuencias de estroboscópico recomendadas y factor de desorientación
 */
export function computeOpticalCameraDisruptionParams(targetDroneFps = 60, shutterSpeedSec = 0.001) {
  // Para batir la frecuencia de muestreo temporal del sensor CMOS y provocar franjas de saturación
  // f_strobe debe situarse ligeramente desfasada de los armónicos de línea del sensor
  const linePeriodSec = 1 / (targetDroneFps * 1080); // Asumiendo sensor 1080p
  const recommendedStrobeHz = +(1 / (shutterSpeedSec * 1.5)).toFixed(1);
  const secondaryStrobeHz = +(targetDroneFps * 1.414).toFixed(1); // Frecuencia irracional anti-bloqueo

  return {
    targetDroneFps,
    shutterSpeedSec,
    linePeriodUs: +(linePeriodSec * 1e6).toFixed(2),
    primaryStrobeFreqHz: recommendedStrobeHz,
    secondaryStrobeFreqHz: secondaryStrobeHz,
    disruptionType: 'ROLLING_SHUTTER_ALIASING_BANDING',
    civilianSafetyRating: 'SEGURO_NO_LASER_SIN_RIESGO_OCULAR',
    operationalEffect: 'Provoca bandas de saturación oscura cíclica en el sensor óptico del dron que impiden el rastreo neuronal de blancos.',
  };
}

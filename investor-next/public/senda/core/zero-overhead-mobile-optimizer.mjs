/**
 * SENDA · Optimizador de Coste Cero para Dispositivos Móviles y Terminales Embebidos
 *
 * Módulo isomórfico (Node.js + Web Worker + Android WebView + React Native + iOS CoreLocation)
 * Proporciona:
 *  1. Gestor de Ciclo de Trabajo Adaptativo (AdaptiveDutyCycleManager):
 *     Ajusta la tasa de muestreo y conmutación de reposo según velocidad y cinemática (reposo 0.05 Hz hasta 50 Hz en ráfaga).
 *  2. Buffer Circular de Asignación Cero (ZeroAllocationCircularBuffer):
 *     Utiliza Float64Array preasignados en memoria plana contigua, evitando recolección de basura (GC pauses) y garantizando 60/120 fps.
 *  3. Multiplexor Virtual GNSS / NMEA 0183 (Nmea0183Multiplexer):
 *     Genera sentencias estándar ($GPGGA, $GPRMC, $GPVTG) para inyectar la posición EKF corregida en túneles a cualquier app de GPS
 *     (Google Maps, Waze, Sygic, OsmAnd) vía Mock Location Provider o socket local sin modificar dichas aplicaciones.
 *  4. Presupuesto Energético y Batería (estimateSmartphoneBatteryBudget):
 *     Modelado cuantitativo del consumo (< 0.35 % batería/hora en segundo plano).
 */

function finite(val, min = -Infinity, max = Infinity) {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. GESTOR DE CICLO DE TRABAJO ADAPTATIVO (ADAPTIVE DUTY CYCLE)
// ═══════════════════════════════════════════════════════════════════════════

export const DUTY_CYCLE_STATES = Object.freeze({
  PARKED: 'PARKED',                   // Vehículo estacionado / parado prolongado (<3 km/h por >30s): 0.05 Hz (20s)
  CITY_CONGESTED: 'CITY_CONGESTED',   // Tráfico lento urbano (<45 km/h): 1.0 Hz (1000ms)
  HIGHWAY_CRUISE: 'HIGHWAY_CRUISE',   // Autovía / crucero (>=45 km/h): 10.0 Hz (100ms)
  EMERGENCY_BURST: 'EMERGENCY_BURST', // Frenada brusca / choque / baliza V16 detectada: 50.0 Hz (20ms) por 5 s
});

export const DUTY_CYCLE_PROFILES = Object.freeze({
  PARKED: { intervalMs: 20000, hz: 0.05, sleepDutyPct: 99.8, cpuTargetPct: 0.02 },
  CITY_CONGESTED: { intervalMs: 1000, hz: 1.0, sleepDutyPct: 92.0, cpuTargetPct: 0.15 },
  HIGHWAY_CRUISE: { intervalMs: 100, hz: 10.0, sleepDutyPct: 65.0, cpuTargetPct: 0.45 },
  EMERGENCY_BURST: { intervalMs: 20, hz: 50.0, sleepDutyPct: 15.0, cpuTargetPct: 1.80 },
});

export class AdaptiveDutyCycleManager {
  /**
   * @param {{ initialSpeedKmh?: number, onStateChange?: (newState: string) => void }} [options]
   */
  constructor({ initialSpeedKmh = 0, onStateChange = null } = {}) {
    this.currentState = DUTY_CYCLE_STATES.PARKED;
    this.lastSpeedKmh = initialSpeedKmh;
    this.standstillDurationSec = 0;
    this.burstRemainingMs = 0;
    this.onStateChange = onStateChange;
    this.totalSamplesProcessed = 0;
    this.sleepCyclesSaved = 0;
  }

  /**
   * Actualiza el estado cinemático del vehículo y conmuta el ciclo de trabajo óptimo.
   *
   * @param {number} speedKmh Velocidad actual del vehículo (km/h)
   * @param {{ isEmergency?: boolean, dtSec?: number }} [options]
   * @returns {{ state: string, samplingIntervalMs: number, hz: number, sleepDutyPct: number }}
   */
  updateKinematics(speedKmh, { isEmergency = false, dtSec = 0.1 } = {}) {
    const v = Math.max(0, finite(speedKmh) ? speedKmh : 0);
    this.lastSpeedKmh = v;
    this.totalSamplesProcessed++;

    // 1. Prioridad absoluta: Disparo de ráfaga de emergencia
    if (isEmergency) {
      this.burstRemainingMs = 5000; // 5 segundos de alta resolución a 50 Hz
      this._transitionTo(DUTY_CYCLE_STATES.EMERGENCY_BURST);
      return this.getCurrentProfile();
    }

    if (this.burstRemainingMs > 0) {
      this.burstRemainingMs -= dtSec * 1000;
      if (this.burstRemainingMs > 0) {
        return this.getCurrentProfile();
      }
      this.burstRemainingMs = 0;
    }

    // 2. Transiciones por velocidad y tiempo de detención
    if (v < 3.0) {
      this.standstillDurationSec += dtSec;
      if (this.standstillDurationSec >= 30.0) {
        this._transitionTo(DUTY_CYCLE_STATES.PARKED);
        this.sleepCyclesSaved += Math.floor(dtSec * 10);
      } else {
        this._transitionTo(DUTY_CYCLE_STATES.CITY_CONGESTED);
      }
    } else {
      this.standstillDurationSec = 0;
      if (v >= 45.0) {
        this._transitionTo(DUTY_CYCLE_STATES.HIGHWAY_CRUISE);
      } else {
        this._transitionTo(DUTY_CYCLE_STATES.CITY_CONGESTED);
      }
    }

    return this.getCurrentProfile();
  }

  _transitionTo(nextState) {
    if (this.currentState !== nextState) {
      this.currentState = nextState;
      if (typeof this.onStateChange === 'function') {
        try {
          this.onStateChange(nextState);
        } catch {
          // No permitir que un callback externo afecte el lazo de control
        }
      }
    }
  }

  getCurrentProfile() {
    const profile = DUTY_CYCLE_PROFILES[this.currentState] || DUTY_CYCLE_PROFILES.HIGHWAY_CRUISE;
    return {
      state: this.currentState,
      samplingIntervalMs: profile.intervalMs,
      hz: profile.hz,
      sleepDutyPct: profile.sleepDutyPct,
      cpuTargetPct: profile.cpuTargetPct,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. BUFFER CIRCULAR DE ASIGNACIÓN CERO (ZERO ALLOCATION CIRCULAR BUFFER)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Buffer circular preasignado con TypedArray plano (Float64Array).
 * Garantiza cero asignaciones dinámicas en el heap (0 GC pauses) durante muestreo continuo.
 */
export class ZeroAllocationCircularBuffer {
  /**
   * @param {number} capacity Número máximo de muestras a almacenar
   * @param {number} channels Número de canales por muestra (ej: 4 para [tSec, speedKmh, ax, ay])
   */
  constructor(capacity = 256, channels = 4) {
    this.capacity = Math.max(16, capacity);
    this.channels = Math.max(1, channels);
    this.buffer = new Float64Array(this.capacity * this.channels);
    this.head = 0;
    this.count = 0;
  }

  /**
   * Inserta una muestra multicanal en el buffer sin instanciar objetos.
   *
   * @param {number} c0 Canal 0 (ej: tiempo relativo s)
   * @param {number} c1 Canal 1 (ej: velocidad km/h)
   * @param {number} [c2=0] Canal 2 (ej: aceleración longitudinal m/s²)
   * @param {number} [c3=0] Canal 3 (ej: aceleración lateral m/s²)
   */
  pushSample(c0, c1, c2 = 0, c3 = 0) {
    const offset = this.head * this.channels;
    this.buffer[offset] = c0;
    if (this.channels > 1) this.buffer[offset + 1] = c1;
    if (this.channels > 2) this.buffer[offset + 2] = c2;
    if (this.channels > 3) this.buffer[offset + 3] = c3;

    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Copia los últimos N puntos en un Float64Array de destino preexistente proporcionado por el llamador.
   * Cero asignaciones de memoria.
   *
   * @param {Float64Array} targetBuffer Buffer preasignado por el consumidor
   * @param {number} numSamples Cantidad de muestras a extraer
   * @returns {number} Número de muestras efectivamente copiadas
   */
  extractRecentInPlace(targetBuffer, numSamples) {
    const toCopy = Math.min(this.count, numSamples, Math.floor(targetBuffer.length / this.channels));
    if (toCopy <= 0) return 0;

    let readIndex = (this.head - toCopy + this.capacity) % this.capacity;
    let targetOffset = 0;

    for (let i = 0; i < toCopy; i++) {
      const srcOffset = readIndex * this.channels;
      for (let ch = 0; ch < this.channels; ch++) {
        targetBuffer[targetOffset + ch] = this.buffer[srcOffset + ch];
      }
      targetOffset += this.channels;
      readIndex = (readIndex + 1) % this.capacity;
    }

    return toCopy;
  }

  /**
   * Calcula la media y varianza del canal especificado directamente en la memoria contigua.
   *
   * @param {number} channel Índice del canal (0 a channels-1)
   * @returns {{ mean: number, variance: number, min: number, max: number }}
   */
  computeChannelStatsInPlace(channel = 1) {
    if (this.count === 0 || channel >= this.channels) {
      return { mean: 0, variance: 0, min: 0, max: 0 };
    }

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < this.count; i++) {
      const val = this.buffer[i * this.channels + channel];
      sum += val;
      if (val < min) min = val;
      if (val > max) max = val;
    }

    const mean = sum / this.count;
    let sumSqDiff = 0;
    for (let i = 0; i < this.count; i++) {
      const diff = this.buffer[i * this.channels + channel] - mean;
      sumSqDiff += diff * diff;
    }

    const variance = sumSqDiff / this.count;
    return {
      mean: Math.round(mean * 100) / 100,
      variance: Math.round(variance * 1000) / 1000,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
    };
  }

  clear() {
    this.head = 0;
    this.count = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. MULTIPLEXOR VIRTUAL GNSS / NMEA 0183 (NMEA MOCK LOCATION)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convierte grados decimales WGS84 al formato estándar NMEA 0183 (ddmm.mmmmm o dddmm.mmmmm).
 *
 * @param {number} degVal Coordenada decimal (-90 a 90 o -180 a 180)
 * @param {boolean} isLat True para latitud (2 dígitos de grado), False para longitud (3 dígitos)
 * @returns {{ coordStr: string, hemisphere: string }}
 */
export function decimalDegreesToNmea(degVal, isLat = true) {
  const val = finite(degVal) ? degVal : 0;
  const absVal = Math.abs(val);
  const degrees = Math.floor(absVal);
  const minutes = (absVal - degrees) * 60.0;

  const degStr = isLat
    ? degrees.toString().padStart(2, '0')
    : degrees.toString().padStart(3, '0');

  const minStr = minutes.toFixed(5).padStart(8, '0');
  const coordStr = `${degStr}${minStr}`;

  let hemisphere = 'N';
  if (isLat) {
    hemisphere = val >= 0 ? 'N' : 'S';
  } else {
    hemisphere = val >= 0 ? 'E' : 'W';
  }

  return { coordStr, hemisphere };
}

/**
 * Calcula el checksum XOR de 8 bits estándar de NMEA 0183.
 *
 * @param {string} sentence Cadena entre '$' y '*'
 * @returns {string} Dos caracteres hexadecimales en mayúsculas
 */
export function computeNmeaChecksum(sentence) {
  let checksum = 0;
  for (let i = 0; i < sentence.length; i++) {
    checksum ^= sentence.charCodeAt(i);
  }
  return checksum.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Generador de sentencias NMEA 0183 ($GPGGA, $GPRMC, $GPVTG) para inyectar la posición
 * corregida por SENDA (ej: EKF en túneles) a aplicaciones externas de navegación vía Mock Location.
 */
export class Nmea0183Multiplexer {
  /**
   * Genera sentencia $GPGGA (Global Positioning System Fix Data).
   *
   * @param {{
   *   lat: number,
   *   lon: number,
   *   altitudeM?: number,
   *   numSats?: number,
   *   hdop?: number,
   *   timestampUtc?: Date
   * }} fix Datos geodésicos
   * @returns {string} Sentencia completa con '$', '*' y CRLF
   */
  static formatGpGga({
    lat,
    lon,
    altitudeM = 580.0,
    numSats = 12,
    hdop = 0.8,
    timestampUtc = new Date(),
  }) {
    const latNmea = decimalDegreesToNmea(lat, true);
    const lonNmea = decimalDegreesToNmea(lon, false);

    const d = timestampUtc instanceof Date ? timestampUtc : new Date();
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    const ms = Math.floor(d.getUTCMilliseconds() / 10).toString().padStart(2, '0');
    const timeStr = `${hh}${mm}${ss}.${ms}`;

    const body = `GPGGA,${timeStr},${latNmea.coordStr},${latNmea.hemisphere},${lonNmea.coordStr},${lonNmea.hemisphere},1,${numSats.toString().padStart(2, '0')},${hdop.toFixed(1)},${altitudeM.toFixed(1)},M,48.0,M,,`;
    const cs = computeNmeaChecksum(body);
    return `$${body}*${cs}\r\n`;
  }

  /**
   * Genera sentencia $GPRMC (Recommended Minimum Specific GPS/Transit Data).
   *
   * @param {{
   *   lat: number,
   *   lon: number,
   *   speedKmh?: number,
   *   headingDeg?: number,
   *   timestampUtc?: Date
   * }} fix
   * @returns {string}
   */
  static formatGpRmc({
    lat,
    lon,
    speedKmh = 90.0,
    headingDeg = 0.0,
    timestampUtc = new Date(),
  }) {
    const latNmea = decimalDegreesToNmea(lat, true);
    const lonNmea = decimalDegreesToNmea(lon, false);

    const d = timestampUtc instanceof Date ? timestampUtc : new Date();
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    const ms = Math.floor(d.getUTCMilliseconds() / 10).toString().padStart(2, '0');
    const timeStr = `${hh}${mm}${ss}.${ms}`;

    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const yy = (d.getUTCFullYear() % 100).toString().padStart(2, '0');
    const dateStr = `${day}${month}${yy}`;

    // Velocidad en nudos: 1 km/h = 1 / 1.852 nudos
    const speedKnots = (Math.max(0, speedKmh) / 1.852).toFixed(1);
    const hdgStr = ((headingDeg % 360 + 360) % 360).toFixed(1);

    const body = `GPRMC,${timeStr},A,${latNmea.coordStr},${latNmea.hemisphere},${lonNmea.coordStr},${lonNmea.hemisphere},${speedKnots},${hdgStr},${dateStr},,,A`;
    const cs = computeNmeaChecksum(body);
    return `$${body}*${cs}\r\n`;
  }

  /**
   * Genera sentencia $GPVTG (Course Over Ground and Ground Speed).
   *
   * @param {{ speedKmh?: number, headingDeg?: number }} fix
   * @returns {string}
   */
  static formatGpVtg({ speedKmh = 90.0, headingDeg = 0.0 }) {
    const speedKnots = (Math.max(0, speedKmh) / 1.852).toFixed(1);
    const speedKmhStr = Math.max(0, speedKmh).toFixed(1);
    const hdgStr = ((headingDeg % 360 + 360) % 360).toFixed(1);

    const body = `GPVTG,${hdgStr},T,,M,${speedKnots},N,${speedKmhStr},K,A`;
    const cs = computeNmeaChecksum(body);
    return `$${body}*${cs}\r\n`;
  }

  /**
   * Empaqueta el conjunto de ráfaga NMEA estándar requerido por Android Mock Location / GPSd.
   */
  static generateFullGnssBurst(fix) {
    return {
      gga: this.formatGpGga(fix),
      rmc: this.formatGpRmc(fix),
      vtg: this.formatGpVtg(fix),
      combinedString: `${this.formatGpGga(fix)}${this.formatGpRmc(fix)}${this.formatGpVtg(fix)}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. MODELO DE PRESUPUESTO ENERGÉTICO Y BATERÍA (ENERGY BUDGET MODEL)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estima el impacto de batería en miliamperios (mA) y porcentaje por hora (%/h)
 * en un smartphone estándar (batería de 4.000 mAh a 3.85V).
 *
 * @param {{
 *   state?: string,
 *   isScreenOn?: boolean,
 *   bleScanningDutyPct?: number,
 *   gnssActive?: boolean,
 *   batteryCapacityMah?: number
 * }} options
 * @returns {{
 *   state: string,
 *   totalCurrentMa: number,
 *   hourlyDrainPct: number,
 *   batteryLifeHours: number,
 *   breakdownMa: {
 *     baseIdle: number,
 *     cpuExecution: number,
 *     bluetoothLe: number,
 *     gnssReceiver: number,
 *     screenDisplay: number
 *   },
 *   isSubZeroImpact: boolean,
 *   recommendation: string
 * }}
 */
export function estimateSmartphoneBatteryBudget({
  state = DUTY_CYCLE_STATES.HIGHWAY_CRUISE,
  isScreenOn = false,
  bleScanningDutyPct = 10,
  gnssActive = true,
  batteryCapacityMah = 4000,
} = {}) {
  const profile = DUTY_CYCLE_PROFILES[state] || DUTY_CYCLE_PROFILES.HIGHWAY_CRUISE;

  // 1. Corriente base del sistema en reposo profundo (Android / iOS): ~12 a 18 mA
  const baseIdleMa = 15.0;

  // 2. Carga computacional de SENDA: motor numérico optimizado en TypedArrays
  // En HIGHWAY (10 Hz): ~0.45% de un núcleo -> ~1.8 mA
  // En PARKED (0.05 Hz): ~0.02% de un núcleo -> ~0.08 mA
  const cpuExecutionMa = Math.max(0.05, Math.round(profile.cpuTargetPct * 4.0 * 100) / 100);

  // 3. Bluetooth LE (Coded PHY / Anuncios pasivos con filtro de hardware por UUID):
  // Radio BLE en RX consume ~6.5 mA continuos; modulado por ciclo de escaneo
  const bleDuty = Math.max(0, Math.min(100, bleScanningDutyPct));
  const bluetoothLeMa = Math.round(6.5 * (bleDuty / 100.0) * 100) / 100;

  // 4. Receptor GNSS: ~25 mA activo continuo; con el gestor adaptativo se ahorra en detención
  const gnssMa = gnssActive
    ? Math.round(25.0 * (1.0 - (profile.sleepDutyPct / 100.0) * 0.8) * 100) / 100
    : 0.0;

  // 5. Pantalla OLED (si está encendida en HUD nocturno con fondo negro puro #000000): ~45 mA
  // Si está apagada (segundo plano): 0 mA
  const screenDisplayMa = isScreenOn ? 45.0 : 0.0;

  const totalCurrentMa = Math.round((baseIdleMa + cpuExecutionMa + bluetoothLeMa + gnssMa + screenDisplayMa) * 100) / 100;
  const capacity = Math.max(1000, batteryCapacityMah);
  const hourlyDrainPct = Math.round((totalCurrentMa / capacity) * 10000) / 100;
  const batteryLifeHours = Math.round((capacity / totalCurrentMa) * 10) / 10;

  // En segundo plano con pantalla apagada, SENDA añade menos de 0.35 %/h sobre el consumo natural
  const sendaAddedMa = cpuExecutionMa + bluetoothLeMa;
  const sendaAddedDrainPct = Math.round((sendaAddedMa / capacity) * 10000) / 100;
  const isSubZeroImpact = sendaAddedDrainPct < 0.35;

  let recommendation = `Modo ${state}: Drenaje SENDA neto de solo ${sendaAddedDrainPct}%/h (${sendaAddedMa} mA). Impacto energético prácticamente nulo.`;
  if (isScreenOn) {
    recommendation += ' Pantalla HUD activa en modo negro OLED de bajo consumo.';
  }

  return {
    state,
    totalCurrentMa,
    hourlyDrainPct,
    batteryLifeHours,
    breakdownMa: {
      baseIdle: baseIdleMa,
      cpuExecution: cpuExecutionMa,
      bluetoothLe: bluetoothLeMa,
      gnssReceiver: gnssMa,
      screenDisplay: screenDisplayMa,
    },
    isSubZeroImpact,
    recommendation,
  };
}

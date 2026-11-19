/**
 * SENDA · Tejido de sensores: qué puede medir cada dispositivo de uso común, con qué API,
 * con qué permiso legal y qué papel puede jugar como pasarela. Y un planificador que decide
 * la SIGUIENTE MEDIDA más útil (máxima información por minuto) sobre el mapa de `occupancy.mjs`.
 *
 * Principio: integrar por INTERFACES ABIERTAS Y DOCUMENTADAS (Bluetooth LE, Wi-Fi RTT,
 * sensores de Android, Open Drone ID, MAVLink, UVC, CAP, OpenWrt) y por CONVENIO con quien
 * opera cada sistema. No se descompila software ajeno para «extraer» datos: el art. 6 de la
 * Directiva 2009/24/CE solo permite descompilar lo indispensable para la interoperabilidad de
 * un programa creado de forma independiente, por quien tiene derecho a usar la copia, cuando
 * esa información no esté ya disponible, y sin usarla para otros fines ni cederla. Cada caso
 * concreto exige revisión jurídica (agente A4). La estrategia útil es pedir la interfaz.
 */

export const ACCESS = Object.freeze({
  PROPIO: 'Hardware o app SENDA con consentimiento de su dueño',
  CONSENTIMIENTO: 'Solo si el dueño lo autoriza expresamente',
  CONVENIO: 'Requiere convenio con el operador del sistema',
  NO_PERMITIDO: 'Fuera de alcance: solo el operador o el 112 pueden usarlo',
});

/** Catálogo. `evidence` enlaza con las familias de occupancy.mjs. `status`: HECHO / POR_HACER / FUERA_DE_ALCANCE. */
export const DEVICE_CATALOG = Object.freeze([
  { id: 'ANDROID_BLE', device: 'Teléfono Android', capability: 'Baliza y escáner Bluetooth LE (localización por RSSI)', api: 'BluetoothLeAdvertiser / BluetoothLeScanner', access: 'PROPIO', evidence: 'PHONE_RF', gateway: 'Malla Bluetooth entre vecinos', status: 'HECHO', module: 'beacon.mjs · rubble.mjs' },
  { id: 'ANDROID_WIFI_RTT', device: 'Teléfono Android 9+', capability: 'Distancia a puntos de acceso compatibles por Wi-Fi RTT (802.11mc/az)', api: 'WifiRttManager · ScanResult.is80211mcResponder()', access: 'PROPIO', evidence: 'PHONE_RF', gateway: '—', status: 'POR_HACER',
    accuracy: 'Objetivo AOSP 802.11mc, percentil 90: 2 m a 80 MHz, 4 m a 40 MHz, 8 m a 20 MHz', source: 'https://source.android.com/docs/core/connect/wifi-rtt' },
  { id: 'BAROMETER', device: 'Teléfono con barómetro (Android/iPhone)', capability: 'Altura relativa → planta, por barometría DIFERENCIAL con un teléfono de referencia a pie de calle', api: 'Sensor.TYPE_PRESSURE · CMAltimeter', access: 'PROPIO', evidence: 'PHONE_RF', gateway: '—', status: 'HECHO_ALGORITMO',
    accuracy: 'Pruebas CTIA «Stage Z» (48 edificios): proveedores dentro de 5 m vertical en el 80 % de los casos; la compensación del sensor es la mayor fuente de error', source: 'https://rcrwireless.com/?p=198556', module: 'sensor-fabric.mjs#baroHeightDiffM' },
  { id: 'MIC_KNOCK', device: 'Teléfonos de los equipos de rescate', capability: 'Escucha de golpes o voz por plantas', api: 'getUserMedia / AudioRecord', access: 'PROPIO', evidence: 'ACOUSTIC', gateway: '—', status: 'POR_HACER' },
  { id: 'ANDROID_UWB', device: 'Teléfonos con UWB', capability: 'Distancia entre dos dispositivos UWB', api: 'androidx.core.uwb', access: 'PROPIO', evidence: 'PHONE_RF', gateway: '—', status: 'POR_HACER', note: 'Solo si ambos tienen UWB; disponibilidad por modelo pendiente de verificar' },
  { id: 'IPHONE', device: 'iPhone', capability: 'Bluetooth LE (limitado en segundo plano), barómetro; LiDAR en modelos Pro para escanear estancias (RoomPlan)', api: 'CoreBluetooth · CMAltimeter · RoomPlan', access: 'PROPIO', evidence: 'PHONE_RF', gateway: 'Capa «Construcción» (modelo de la estancia)', status: 'POR_HACER', note: 'iOS no expone el escaneo de redes Wi-Fi a las apps' },
  { id: 'HOME_ROUTER', device: 'Router doméstico', capability: 'Su baliza Wi-Fi pública (SSID/BSSID/RSSI) revela si hay corriente en la vivienda', api: 'Escaneo pasivo Wi-Fi', access: 'PROPIO', evidence: 'INFRA', gateway: 'Solo si un teléfono SENDA conectado confirma Internet', status: 'HECHO', module: 'building-twin.mjs#locateAccessPoints', note: 'Nunca se accede a redes ajenas' },
  { id: 'ESP32_CSI', device: 'Accesorio ESP32 (~10 €) o router con firmware abierto compatible', capability: 'Presencia y respiración tras tabiques por Wi-Fi CSI', api: 'ESP32-CSI-Tool · Nexmon CSI (chips concretos)', access: 'PROPIO', evidence: 'BODY_RF', gateway: 'Nodo LoRa/Bluetooth opcional', status: 'HECHO_ALGORITMO', module: 'through-wall.mjs', note: 'Necesita calibración de campo' },
  { id: 'THERMAL_USB', device: 'Cámara térmica USB-C para móvil', capability: 'Puntos calientes compatibles con una persona; ve a través del HUMO, no de paredes', api: 'UVC (USB Video Class) en Android nativo', access: 'PROPIO', evidence: 'THERMAL', gateway: '—', status: 'HECHO_ALGORITMO', module: 'vision-layers.mjs#thermalHotspots', note: 'Modelos y precios pendientes de verificar' },
  { id: 'DRONE', device: 'Dron con Open Drone ID / MAVLink', capability: 'Barrido de fachada (Wi-Fi, BLE) y pasarela aérea', api: 'Open Drone ID · MAVLink', access: 'CONVENIO', evidence: 'PHONE_RF', gateway: 'Pasarela Wi-Fi/LoRa/satélite en vuelo', status: 'HECHO', module: 'drone.mjs', note: 'Autorización del director de extinción / AESA' },
  { id: 'SMART_METER', device: 'Contador eléctrico inteligente', capability: 'Hora de corte de suministro por vivienda (daño, no presencia)', api: 'Datos de la distribuidora', access: 'CONVENIO', evidence: 'INFRA', gateway: '—', status: 'POR_HACER' },
  { id: 'SMARTWATCH', device: 'Reloj inteligente', capability: 'Caída detectada o pulso, solo a través de la app del propio usuario', api: 'Health Connect / HealthKit', access: 'CONSENTIMIENTO', evidence: 'RESPONSE', gateway: '—', status: 'POR_HACER', note: 'Dato de salud: art. 9 RGPD, consentimiento explícito' },
  { id: 'TRACK_CIRCUIT_SAM', device: 'Circuitos de vía (registro de mantenimiento)', capability: 'Serie de tensión por circuito: cambios bruscos persistentes', api: 'Exportación del gestor de infraestructura', access: 'CONVENIO', evidence: 'RAIL', gateway: '—', status: 'HECHO_ALGORITMO', module: 'rail-watch.mjs#trackCircuitWatch' },
  { id: 'PASSENGER_PHONE', device: 'Teléfono del viajero', capability: 'Aceleración vertical/lateral por punto kilométrico (geometría de vía colaborativa)', api: 'DeviceMotionEvent / SensorManager', access: 'PROPIO', evidence: 'RAIL', gateway: 'Mula de datos al llegar a estación', status: 'HECHO_ALGORITMO', module: 'rail-watch.mjs#trackGeometryCrowd' },
  { id: 'SMART_SPEAKER', device: 'Altavoz inteligente / cámara de portero', capability: 'Micrófono o vídeo del hogar', api: '—', access: 'NO_PERMITIDO', evidence: null, gateway: '—', status: 'FUERA_DE_ALCANCE', note: 'Solo con un programa oficial del fabricante y consentimiento del dueño' },
  { id: 'ECALL', device: 'eCall del vehículo', capability: 'Llamada automática al 112 tras un choque', api: '—', access: 'NO_PERMITIDO', evidence: null, gateway: '—', status: 'FUERA_DE_ALCANCE', note: 'Va directamente al 112; SENDA no la intercepta' },
  { id: 'TETRA', device: 'Radio de emergencias', capability: 'Voz y datos de los cuerpos', api: '—', access: 'NO_PERMITIDO', evidence: null, gateway: '—', status: 'FUERA_DE_ALCANCE', note: 'Comunicaciones cifradas; interceptarlas es delito' },
]);

/**
 * Altura de un teléfono respecto a otro de referencia por la ecuación hipsométrica.
 * Al restar dos barómetros a la vez se cancela la deriva meteorológica; queda el sesgo de
 * cada sensor (calibrar uno contra otro a la misma altura antes de entrar).
 * @param {number} pHpa presión del teléfono buscado (hPa) · @param {number} pRefHpa presión de referencia (hPa)
 */
export function baroHeightDiffM(pHpa, pRefHpa, { tempC = 15, refBiasHpa = 0 } = {}) {
  const T = tempC + 273.15, Rd = 287.05, g = 9.80665;
  return ((Rd * T) / g) * Math.log((pRefHpa - refBiasHpa) / pHpa);
}

/** Planta estimada a partir de la altura relativa a la planta baja. */
export function floorFromHeight(hM, { floorHeightM = 3, groundOffsetM = 1.2 } = {}) {
  return Math.max(0, Math.round((hM - groundOffsetM) / floorHeightM));
}

const H2 = (p) => (p <= 0 || p >= 1 ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)));

/**
 * Ganancia de información esperada (bits) de una acción sobre el mapa de probabilidades.
 * Aproximación por celda (sensor Pd·w / Pfa), suficiente para ordenar acciones.
 */
export function expectedInfoGain(cells, action) {
  let bits = 0, findP = 0;
  for (const c of cells) {
    const d = Math.hypot(c.center.x - action.at.x, c.center.y - action.at.y, c.center.z - action.at.z);
    const w = Math.max(0, Math.min(1, (1.2 * action.radiusM - d) / (0.6 * action.radiusM)));
    if (w <= 0) continue;
    const pd = action.pd * w, pfa = action.pfa, p = c.p;
    const pDet = p * pd + (1 - p) * pfa;
    const p1 = (p * pd) / pDet, p0 = (p * (1 - pd)) / (1 - pDet);
    bits += (H2(p) - (pDet * H2(p1) + (1 - pDet) * H2(p0))) * (c.risk ?? 1);
    findP = 1 - (1 - findP) * (1 - p * pd * (c.risk ?? 1));
  }
  return { bits, findP };
}

/** Ordena las acciones candidatas por bits por minuto (y probabilidad de hallazgo como desempate). */
export function planNextSensing(fusion, actions) {
  return actions.map((a) => {
    const { bits, findP } = expectedInfoGain(fusion.cells, a);
    return { ...a, bits: +bits.toFixed(3), bitsPerMin: +(bits / Math.max(0.5, a.costMin)).toFixed(3), findP: +findP.toFixed(3) };
  }).sort((a, b) => b.bitsPerMin - a.bitsPerMin || b.findP - a.findP);
}

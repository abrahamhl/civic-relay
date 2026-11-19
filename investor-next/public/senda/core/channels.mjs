/**
 * Catálogo de canales que un teléfono puede usar para mover un mensaje.
 *
 * Cada canal declara lo que la física y el sistema operativo permiten de verdad:
 * alcance típico, caudal, coste energético, tamaño máximo y si activarlo exige un
 * toque del usuario (Android 13+ ya no deja a una app encender Bluetooth/Wi-Fi sola).
 * Los valores son órdenes de magnitud de referencia para planificar; la planificación
 * real usa lo MEDIDO por cada sonda (probe) en el dispositivo.
 */
export const CHANNELS = Object.freeze({
  BLE: {
    label: 'Bluetooth LE', kind: 'PROXIMITY', rangeM: 40, rubbleRangeM: 8,
    rateBps: 100_000, latencyS: 0.4, maxBytes: 64 * 1024, energy: 1,
    userTapToEnable: true, // Android 13+: BluetoothAdapter.enable() obsoleto → diálogo del sistema
  },
  WIFI_DIRECT: {
    label: 'Wi-Fi Direct / Aware', kind: 'PROXIMITY', rangeM: 120, rubbleRangeM: 15,
    rateBps: 20_000_000, latencyS: 1.5, maxBytes: 50 * 1024 * 1024, energy: 3,
    userTapToEnable: true,
  },
  HOTSPOT: {
    label: 'Punto de acceso compartido', kind: 'PROXIMITY', rangeM: 60, rubbleRangeM: 10,
    rateBps: 10_000_000, latencyS: 2, maxBytes: 50 * 1024 * 1024, energy: 4,
    userTapToEnable: true, // compartir Internet siempre requiere confirmación del dueño
  },
  LORA: {
    label: 'LoRa (accesorio)', kind: 'PROXIMITY', rangeM: 3000, rubbleRangeM: 300,
    rateBps: 1_000, latencyS: 3, maxBytes: 200, energy: 1,
    userTapToEnable: false, requiresAccessory: true,
  },
  CELL_DATA: {
    label: 'Datos móviles', kind: 'UPLINK', rateBps: 2_000_000, latencyS: 0.3,
    maxBytes: Infinity, energy: 2, userTapToEnable: false,
  },
  SMS: {
    label: 'SMS (red celular)', kind: 'UPLINK', rateBps: 1_120, latencyS: 8,
    maxBytes: 140 * 6, energy: 1, userTapToEnable: false,
    note: 'Llega con señal muy débil o 2G, donde los datos ya no funcionan.',
  },
  SAT_D2D_SMS: {
    label: 'Satélite directo al móvil (SMS)', kind: 'UPLINK', rateBps: 300, latencyS: 30,
    maxBytes: 160, energy: 2, userTapToEnable: false, windowed: true,
    note: 'Solo si el operador del destinatario ofrece servicio directo a móvil; funciona por ventanas de paso.',
  },
  SAT_BROADBAND: {
    label: 'Internet por satélite (terminal)', kind: 'UPLINK', rateBps: 50_000_000, latencyS: 0.05,
    maxBytes: Infinity, energy: 0, userTapToEnable: false,
    note: 'Terminal de un vecino o de un servicio de emergencia; el teléfono lo usa como Wi-Fi.',
  },
  INTERNET: {
    label: 'Internet troncal', kind: 'BACKBONE', rateBps: 100_000_000, latencyS: 0.15,
    maxBytes: Infinity, energy: 0, userTapToEnable: false,
  },
});

export const PRIORITY = Object.freeze({ SOS: 0, OFFICIAL: 1, COORDINATION: 2, FAMILY: 3, ROUTINE: 4 });

/** Tiempo de transmisión de `sizeBytes` por un canal (latencia + serialización). */
export function transferSeconds(channel, sizeBytes, rateBps) {
  const c = CHANNELS[channel];
  if (!c) throw new Error(`Canal desconocido: ${channel}`);
  const rate = rateBps ?? c.rateBps;
  return c.latencyS + (sizeBytes * 8) / rate;
}

/** Fragmenta un mensaje para canales de mensaje corto (SMS, satélite D2D, LoRa). */
export function fragmentsNeeded(channel, sizeBytes) {
  const max = CHANNELS[channel].maxBytes;
  return Number.isFinite(max) ? Math.ceil(sizeBytes / max) : 1;
}

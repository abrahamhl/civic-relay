/**
 * SENDA RoadSafe · Parada señalizada de vehículos de servicio (taxi que recoge, grúa, asistencia).
 *
 * Caso de investigación (C4): el taxi frena para detenerse junto a la furgoneta averiada y el coche que le
 * sigue no lo anticipa. La medida: el vehículo de servicio ANUNCIA su parada antes de frenar:
 *  1. Plan de aproximación: dónde detenerse (arcén, por delante del averiado si hay espacio), desde dónde
 *     empezar a decelerar con una deceleración PROGRESIVA y cuándo empezar a emitir.
 *  2. Emisión: cápsula firmada (roadsafe-frame-trust) tipo STOPPED con banderas SERVICE_STOP/ASSISTANCE,
 *     identificador vinculado al incidente; los seguidores la reciben por BLE, por la app o por el canal
 *     autorizado y oyen «vehículo de servicio deteniéndose a 300 metros».
 *  3. Vinculación: el gemelo del incidente registra «asistencia llegando» (PROVIDER_STATUS) y la V16 de la
 *     furgoneta + la parada del taxi se presentan como UNA zona de peligro, no como dos avisos inconexos.
 * Valores de deceleración y distancias: HIPÓTESIS de diseño (validar con DGT y gremio del taxi/asistencia).
 */
import { encodeHazard, HAZARD } from './road-guard.mjs';
import { signHazardCapsule } from './roadsafe-frame-trust.mjs';
import { WARNING_POLICY } from './roadsafe-secondary-risk.mjs';

export const STOP_FLAGS = Object.freeze({ SERVICE_STOP: 0x01, ASSISTANCE_TO_INCIDENT: 0x02, PASSENGER_PICKUP: 0x04 });
export const SERVICE_STOP_POLICY = Object.freeze({ comfortDecelMs2: 2.0, maxDecelMs2: 3.0, aheadOfDisabledM: 25, announceLeadS: WARNING_POLICY.tMaxS / 2, provenance: 'HYPOTHETICAL' });

/**
 * Plan de aproximación sobre la vía (s en metros, sentido de circulación creciente).
 * disabledS: posición del averiado; approachSpeedMs: velocidad actual del taxi; shoulderFreeAheadM: arcén libre por delante.
 */
export function planServiceStop({ disabledS, approachSpeedMs, shoulderFreeAheadM = 60, policy = SERVICE_STOP_POLICY }) {
  const P = { ...SERVICE_STOP_POLICY, ...policy };
  const ahead = shoulderFreeAheadM >= P.aheadOfDisabledM + 10;
  const stopS = ahead ? disabledS + P.aheadOfDisabledM : disabledS - 30;
  const brakeDist = (approachSpeedMs ** 2) / (2 * P.comfortDecelMs2);
  const brakeStartS = stopS - brakeDist, announceS = brakeStartS - approachSpeedMs * P.announceLeadS;
  return {
    stopS: Math.round(stopS), stopPosition: ahead ? 'AHEAD_OF_DISABLED_ON_SHOULDER' : 'BEHIND_DISABLED_ON_SHOULDER',
    brakeStartS: Math.round(brakeStartS), announceFromS: Math.round(announceS), decelMs2: P.comfortDecelMs2,
    brakeDurationS: +(approachSpeedMs / P.comfortDecelMs2).toFixed(1),
    steps: [
      `Luces de emergencia y emisión SENDA desde ${Math.round(stopS - announceS)} m antes del punto de parada.`,
      `Deceleración progresiva (≈${P.comfortDecelMs2} m/s²) desde ${Math.round(stopS - brakeStartS)} m antes; sin frenar en el carril.`,
      ahead ? 'Detenerse en el arcén POR DELANTE del averiado: los ocupantes no cruzan tráfico y el averiado protege al taxi.' : 'Sin espacio por delante: detenerse tras el averiado dejando hueco y con luces de emergencia.',
      'Los ocupantes suben por el lado contrario al tráfico.',
    ],
    rationale: ahead ? 'evita que el taxi quede como último vehículo expuesto (C4/C5)' : 'arcén insuficiente por delante',
    provenance: P.provenance,
  };
}

/** Trama y cápsula firmada de parada de servicio (para BLE extendido/GATT/LoRa/app). */
export async function serviceStopCapsule(signer, { t, lat, lon, headingDeg, speedMs, incidentShortId = 0, pickup = false }) {
  const flags = STOP_FLAGS.SERVICE_STOP | STOP_FLAGS.ASSISTANCE_TO_INCIDENT | (pickup ? STOP_FLAGS.PASSENGER_PICKUP : 0);
  const frame = encodeHazard({ type: HAZARD.STOPPED, t, lat, lon, headingDeg, speedMs, decelMs2: SERVICE_STOP_POLICY.comfortDecelMs2, id: incidentShortId >>> 0, flags });
  return { frame, capsule: await signHazardCapsule(frame, signer), flags };
}
export const isServiceStop = (decoded) => (decoded.flags & STOP_FLAGS.SERVICE_STOP) !== 0;

/** Observación para el gemelo del incidente: «asistencia llegando» (no «en el lugar»). */
export function arrivalObservation({ providerId, incidentId, at, lat, lon, etaS }) {
  return { obsId: `arrival-${providerId}-${at}`, source: 'PROVIDER_STATUS', at, lat, lon, present: true, rootHint: `${providerId}:${incidentId}`, note: `asistencia llegando, ETA ${Math.round(etaS)} s (declarado por el proveedor)` };
}

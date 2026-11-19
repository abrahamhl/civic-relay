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
/** Política de EJEMPLO (hipótesis de diseño sin validar): debe declararse explícitamente. */
export const EXAMPLE_SERVICE_STOP_POLICY = Object.freeze({ comfortDecelMs2: 2.0, maxDecelMs2: 3.0, aheadOfDisabledM: 25, announceLeadS: WARNING_POLICY.tMaxS / 2, provenance: 'HYPOTHETICAL — validar con DGT y gremio' });

/**
 * Plan de aproximación sobre la vía (s en metros, sentido de circulación creciente).
 * disabledS: posición del averiado; approachSpeedMs: velocidad actual del taxi; shoulderFreeAheadM: arcén libre por delante.
 */
export function planServiceStop({ disabledS, approachSpeedMs, shoulderFreeAheadM, policy, siteAssessment = null }) {
  if (!policy || ![policy.comfortDecelMs2, policy.aheadOfDisabledM, policy.announceLeadS].every((x) => Number.isFinite(x) && x > 0))
    throw new Error('planServiceStop exige una política declarada y positiva (comfortDecelMs2, aheadOfDisabledM, announceLeadS)');
  if (!Number.isFinite(shoulderFreeAheadM) || shoulderFreeAheadM < 0)
    throw new Error('arcén libre por delante no declarado o inválido');
  if (![disabledS, approachSpeedMs].every(Number.isFinite) || approachSpeedMs <= 0)
    throw new Error('posición o velocidad de aproximación inválida');
  const P = policy;
  const abstain = (status, why) => ({
    status, stopS: null, brakeStartS: null, announceFromS: null, brakeDurationS: null,
    stopPosition: 'UNDETERMINED', canGuideDriver: false,
    steps: ['No se propone lugar de parada sin una valoración autorizada de la vía.',
      'Contactar con el operador de asistencia y seguir la señalización e instrucciones de la autoridad competente.'],
    rationale: why, provenance: P.provenance,
  });
  // A numeric estimate of free shoulder does NOT prove that it is safe or legal to pull over.
  if (siteAssessment?.verified !== true || siteAssessment?.safePullOffApproved !== true)
    return abstain('ABSTAIN_UNVERIFIED_SITE', 'no consta evaluación del arcén por personal competente');
  if (shoulderFreeAheadM < P.aheadOfDisabledM + 10)
    return abstain('NO_VERIFIED_PULLOFF_SPACE', 'no existe espacio declarado suficiente por delante; no se inventa una parada por detrás');
  const stopS = disabledS + P.aheadOfDisabledM;
  const brakeDist = approachSpeedMs ** 2 / (2 * P.comfortDecelMs2);
  const brakeStartS = stopS - brakeDist;
  const announceS = brakeStartS - approachSpeedMs * P.announceLeadS;
  return {
    status: 'HYPOTHETICAL_REVIEW_REQUIRED', canGuideDriver: false,
    stopS: Math.round(stopS), stopPosition: 'AHEAD_OF_DISABLED_ON_SHOULDER',
    brakeStartS: Math.round(brakeStartS), announceFromS: Math.round(announceS),
    decelMs2: P.comfortDecelMs2, brakeDurationS: +(approachSpeedMs / P.comfortDecelMs2).toFixed(1),
    steps: ['Proyección matemática para simulador, NO instrucciones de conducción.',
      'El operador competente debe aprobar cualquier plan real de aproximación y estacionamiento.',
      'Si no hay espacio seguro certificado, buscar un punto autorizado alternativo sin aproximación riesgosa.'],
    rationale: 'ubicación hipotética basada en parámetros explícitos y evaluación declarada; nunca autorización automática',
    provenance: P.provenance,
  };
}

/** Trama y cápsula firmada de parada de servicio (para BLE extendido/GATT/LoRa/app). */
export async function serviceStopCapsule(signer, { t, lat, lon, headingDeg, speedMs, incidentShortId = 0, pickup = false, decelMs2 = 0 }) {
  const flags = STOP_FLAGS.SERVICE_STOP | STOP_FLAGS.ASSISTANCE_TO_INCIDENT | (pickup ? STOP_FLAGS.PASSENGER_PICKUP : 0);
  const frame = encodeHazard({ type: HAZARD.STOPPED, t, lat, lon, headingDeg, speedMs, decelMs2, id: incidentShortId >>> 0, flags });
  return { frame, capsule: await signHazardCapsule(frame, signer), flags };
}
export const isServiceStop = (decoded) => (decoded.flags & STOP_FLAGS.SERVICE_STOP) !== 0;

/** Observación para el gemelo del incidente: «asistencia llegando» (no «en el lugar»). */
export function arrivalObservation({ providerId, incidentId, at, lat, lon, etaS }) {
  return { obsId: `arrival-${providerId}-${at}`, source: 'PROVIDER_STATUS', at, lat, lon, present: true, rootHint: `${providerId}:${incidentId}`, note: `asistencia llegando, ETA ${Math.round(etaS)} s (declarado por el proveedor)` };
}

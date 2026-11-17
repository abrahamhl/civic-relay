/**
 * SENDA RoadSafe · Resiliencia de red y política de rutas para mensajes de incidente.
 *
 * Reutiliza: `posteriorReliability` (delivery-assurance.mjs, Beta-Binomial con cuantil inferior
 * creíble) y la separación custodia ≠ destino de `transport-telemetry.mjs` (CUSTODY_ACK nunca es
 * entrega). Añade los estados propios de RoadSafe pedidos en la misión:
 *   QUEUED · CUSTODY_ACK · FORWARDED_UNCONFIRMED · DESTINATION_ACK · EXPIRED · REVOKED · DELIVERY_UNKNOWN
 *
 * Reglas:
 *  - Un fallo de conexión nunca muestra «enviado»: el mensaje sigue QUEUED o pasa a DELIVERY_UNKNOWN.
 *  - FORWARDED_UNCONFIRMED: salió hacia un tercero (p. ej. relé DTN, otro móvil) sin acuse de destino.
 *  - DESTINATION_ACK solo con acuse del destino final (firmado en producción).
 *  - Canales sin consentimiento del usuario o sin autorización no se usan aunque estén disponibles.
 *  - No se asume cobertura universal BLE/satélite/V2X: cada canal declara disponibilidad medida o
 *    `UNKNOWN`, y la fiabilidad usada es el CUANTIL INFERIOR del posterior, no la media.
 */
import { posteriorReliability } from './delivery-assurance.mjs';

export const DELIVERY_STATES = Object.freeze(['QUEUED', 'CUSTODY_ACK', 'FORWARDED_UNCONFIRMED', 'DESTINATION_ACK', 'EXPIRED', 'REVOKED', 'DELIVERY_UNKNOWN']);
const TERMINAL = new Set(['DESTINATION_ACK', 'EXPIRED', 'REVOKED']);
const NEXT = {
  QUEUED: ['CUSTODY_ACK', 'FORWARDED_UNCONFIRMED', 'DESTINATION_ACK', 'EXPIRED', 'REVOKED', 'DELIVERY_UNKNOWN'],
  CUSTODY_ACK: ['FORWARDED_UNCONFIRMED', 'DESTINATION_ACK', 'EXPIRED', 'REVOKED', 'DELIVERY_UNKNOWN'],
  FORWARDED_UNCONFIRMED: ['DESTINATION_ACK', 'EXPIRED', 'REVOKED', 'DELIVERY_UNKNOWN'],
  DELIVERY_UNKNOWN: ['QUEUED', 'DESTINATION_ACK', 'EXPIRED', 'REVOKED'],
};

/**
 * Catálogo de canales: prior de planificación (HIPÓTESIS), coste relativo y requisitos.
 * `authorization`: lo que hace falta para usarlo legítimamente. availability: 'MEASURED'|'UNKNOWN'.
 */
export const ROAD_CHANNELS = Object.freeze({
  CELLULAR_DATA: { p0: 0.9, cost: 1, latencyS: 2, authorization: 'NONE', consent: 'location_share', note: 'Depende de cobertura; sin cobertura en tramos rurales.' },
  SMS: { p0: 0.85, cost: 2, latencyS: 10, authorization: 'NONE', consent: 'sms_send', note: 'Coste por mensaje; 160 caracteres.' },
  BLE_PEER: { p0: 0.2, cost: 0, latencyS: 1, authorization: 'NONE', consent: 'ble_beacon', note: 'Alcance corto, Android limita el escaneo en segundo plano; densidad de adopción incierta.' },
  DTN_RELAY: { p0: 0.5, cost: 0, latencyS: 600, authorization: 'NONE', consent: 'dtn_carry', note: 'Custodia por otros móviles: entrega diferida, nunca confirmada por la custodia.' },
  SATELLITE_SOS: { p0: 0.6, cost: 5, latencyS: 120, authorization: 'OS_VENDOR', consent: 'none_os_flow', note: 'Solo mediante el flujo del sistema operativo/operador; SENDA no puede iniciarlo por API.' },
  PARTNER_API: { p0: 0.95, cost: 1, latencyS: 3, authorization: 'CONTRACT', consent: 'partner_share', note: 'Proveedor de asistencia con contrato.' },
  DGT30_PLATFORM: { p0: 0.9, cost: 1, latencyS: null, authorization: 'DGT30_REGISTRATION_X509', consent: 'traffic_publish', note: 'Alta como actor DGT 3.0 (formulario, IP en lista blanca, certificado X.509). Latencia no publicada.' },
});

export function createMessage({ id, priority = 1, ttlS = 3600, now, payloadBytes = 0 }) {
  return { id, priority, createdAt: now, expiresAt: now + ttlS, payloadBytes, state: 'QUEUED', history: [{ at: now, state: 'QUEUED', channel: null }], attempts: [] };
}

/** Transición validada: rechaza saltos imposibles (p. ej. de EXPIRED a DESTINATION_ACK). */
export function advance(msg, to, { at, channel = null, evidence = null } = {}) {
  if (!DELIVERY_STATES.includes(to)) return { ok: false, error: 'estado desconocido' };
  if (TERMINAL.has(msg.state)) return { ok: false, error: `terminal ${msg.state}` };
  if (at > msg.expiresAt && to !== 'EXPIRED' && to !== 'REVOKED') { msg.state = 'EXPIRED'; msg.history.push({ at, state: 'EXPIRED', channel: null }); return { ok: false, error: 'mensaje caducado' }; }
  if (!(NEXT[msg.state] ?? []).includes(to)) return { ok: false, error: `${msg.state} → ${to} no permitido` };
  if (to === 'DESTINATION_ACK' && !evidence?.destinationAck) return { ok: false, error: 'DESTINATION_ACK exige acuse del destino' };
  msg.state = to; msg.history.push({ at, state: to, channel, evidence });
  return { ok: true };
}

/** Resultado de un intento de envío por un canal → estado honesto. */
export function recordAttempt(msg, { at, channel, outcome }) {
  msg.attempts.push({ at, channel, outcome });
  switch (outcome) {
    case 'CONNECTION_FAILED': case 'TIMEOUT': return { ok: true, state: msg.state, note: 'sin cambio: un fallo de conexión no es un envío' };
    case 'HANDED_TO_CUSTODIAN': return advance(msg, 'CUSTODY_ACK', { at, channel });
    case 'SENT_NO_ACK': return advance(msg, msg.state === 'QUEUED' || msg.state === 'CUSTODY_ACK' ? 'FORWARDED_UNCONFIRMED' : 'DELIVERY_UNKNOWN', { at, channel });
    case 'AMBIGUOUS': return advance(msg, 'DELIVERY_UNKNOWN', { at, channel });
    case 'DESTINATION_ACK': return advance(msg, 'DESTINATION_ACK', { at, channel, evidence: { destinationAck: true } });
    default: return { ok: false, error: 'resultado desconocido' };
  }
}

/** Texto para la interfaz: nunca «enviado» sin acuse de destino. */
export function deliveryLabel(state, lang = 'es') {
  const T = {
    es: { QUEUED: 'En cola: aún no ha salido', CUSTODY_ACK: 'En manos de un relé: sin confirmación del destino', FORWARDED_UNCONFIRMED: 'Reenviado: sin confirmación', DESTINATION_ACK: 'Recibido por el destino', EXPIRED: 'Caducado sin entrega', REVOKED: 'Retirado', DELIVERY_UNKNOWN: 'Entrega desconocida' },
    en: { QUEUED: 'Queued: not sent yet', CUSTODY_ACK: 'Held by a relay: destination not confirmed', FORWARDED_UNCONFIRMED: 'Forwarded: unconfirmed', DESTINATION_ACK: 'Received by destination', EXPIRED: 'Expired undelivered', REVOKED: 'Revoked', DELIVERY_UNKNOWN: 'Delivery unknown' },
    nl: { QUEUED: 'In wachtrij: nog niet verzonden', CUSTODY_ACK: 'Bij een relay: bestemming niet bevestigd', FORWARDED_UNCONFIRMED: 'Doorgestuurd: onbevestigd', DESTINATION_ACK: 'Ontvangen door bestemming', EXPIRED: 'Verlopen zonder levering', REVOKED: 'Ingetrokken', DELIVERY_UNKNOWN: 'Levering onbekend' },
  };
  return (T[lang] ?? T.es)[state] ?? state;
}

/**
 * Política de rutas: ordena canales por utilidad = P_inf(éxito) · prioridad − λ·coste, filtrando por
 * disponibilidad, consentimiento y autorización. receipts: { [canal]: { successes, failures } } medidos.
 */
export function routeChannels({ available = [], consents = [], authorizations = [], receipts = {}, priority = 1, lambdaCost = 0.05, credibility = 0.9 } = {}) {
  const rows = [];
  for (const ch of available) {
    const c = ROAD_CHANNELS[ch];
    if (!c) { rows.push({ channel: ch, usable: false, why: 'canal desconocido' }); continue; }
    if (c.consent !== 'none_os_flow' && !consents.includes(c.consent)) { rows.push({ channel: ch, usable: false, why: `sin consentimiento (${c.consent})` }); continue; }
    if (c.authorization !== 'NONE' && c.authorization !== 'OS_VENDOR' && !authorizations.includes(c.authorization)) { rows.push({ channel: ch, usable: false, why: `sin autorización (${c.authorization})` }); continue; }
    if (c.authorization === 'OS_VENDOR') { rows.push({ channel: ch, usable: false, why: 'solo mediante el flujo del sistema operativo: se ofrece al usuario, no se automatiza' }); continue; }
    const r = receipts[ch] ?? { successes: 0, failures: 0 };
    const post = posteriorReliability({ p0: c.p0, successes: r.successes, failures: r.failures, credibility });
    rows.push({ channel: ch, usable: true, pLower: +post.lower.toFixed(3), pMean: +post.mean.toFixed(3), measured: post.observations > 0, cost: c.cost, utility: +(post.lower * priority - lambdaCost * c.cost).toFixed(4) });
  }
  const usable = rows.filter((r) => r.usable).sort((a, b) => b.utility - a.utility);
  // Probabilidad de que AL MENOS uno funcione suponiendo independencia: COTA OPTIMISTA (los fallos
  // de cobertura están correlacionados); se informa como tal, no como garantía.
  const pAnyIndep = 1 - usable.reduce((s, r) => s * (1 - r.pLower), 1);
  return { plan: usable, rejected: rows.filter((r) => !r.usable), pAnyIndependentUpperBound: +pAnyIndep.toFixed(3), caveat: 'Cota optimista: supone fallos independientes entre canales.' };
}

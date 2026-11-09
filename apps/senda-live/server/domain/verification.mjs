/**
 * Máquina de estados de verificación de un acontecimiento (EVENT HUB).
 *
 * Principios (no negociables, cubiertos por tests):
 *  - Las reacciones (likes), seguidores o popularidad NO intervienen. La función ni siquiera
 *    los recibe: si se pasan, se ignoran.
 *  - OFFICIAL_SOURCE_CONFIRMED solo con al menos una alerta oficial ACTIVA vinculada, emitida
 *    con credencial institucional verificada criptográficamente en servidor.
 *  - Un analista no puede fijar OFFICIAL_SOURCE_CONFIRMED a mano.
 *  - Corroboración = ≥2 fuentes independientes (clave de independencia distinta Y autor distinto).
 *  - Una contradicción sin resolver ⇒ DISPUTED (la incertidumbre se muestra, no se oculta).
 *
 * Tres verificaciones distintas que la interfaz nunca mezcla:
 *  account  → ¿la cuenta/organización está verificada? (organizations.status, roles)
 *  content  → estado del acontecimiento (este módulo)
 *  official → confirmación por alerta institucional autenticada
 */
export const EVENT_STATUSES = Object.freeze(['UNVERIFIED_REPORT', 'SOURCE_IDENTIFIED', 'CORROBORATED', 'OFFICIAL_SOURCE_CONFIRMED', 'DISPUTED', 'RETRACTED', 'EXPIRED']);
export const MANUAL_STATUSES = Object.freeze(['UNVERIFIED_REPORT', 'CORROBORATED', 'DISPUTED', 'RETRACTED']);
const IDENTIFIED_KINDS = new Set(['JOURNALIST', 'NEWS_ORG', 'EXTERNAL_PLATFORM']);

/**
 * @param {object} s
 * @param {{kind:string, independenceKey:string, authorId?:string}[]} s.sources
 * @param {number} s.contradictions  vínculos CONTRADICTS sin resolver
 * @param {number} s.officialActive  alertas oficiales activas y verificadas vinculadas
 * @param {{toStatus:string}|null} s.manual  última decisión humana vigente
 * @param {number|null} s.expiresAt
 * @param {number} s.now
 */
export function computeEventStatus({ sources = [], contradictions = 0, officialActive = 0, manual = null, expiresAt = null, now = Date.now() } = {}) {
  const reasons = [];
  const nonOfficial = sources.filter((x) => x.kind !== 'OFFICIAL');
  const keys = new Set(nonOfficial.map((x) => x.independenceKey));
  const authors = new Set(nonOfficial.map((x) => x.authorId ?? x.independenceKey));
  const independent = Math.min(keys.size, authors.size);
  const signals = { independentSources: independent, contradictions, officialActive };

  if (manual?.toStatus === 'RETRACTED') return { status: 'RETRACTED', reasons: ['MANUAL_RETRACTION'], signals };
  if (expiresAt && now > expiresAt) return { status: 'EXPIRED', reasons: ['EXPIRED'], signals };
  if (officialActive > 0) {
    reasons.push('OFFICIAL_ALERT_LINKED');
    if (contradictions > 0) reasons.push('CONTRADICTIONS_PRESENT');
    return { status: 'OFFICIAL_SOURCE_CONFIRMED', reasons, signals };
  }
  if (manual && MANUAL_STATUSES.includes(manual.toStatus) && manual.toStatus !== 'UNVERIFIED_REPORT') {
    return { status: manual.toStatus, reasons: ['MANUAL_DECISION'], signals };
  }
  if (contradictions > 0) return { status: 'DISPUTED', reasons: ['CONTRADICTION_UNRESOLVED'], signals };
  if (independent >= 2) return { status: 'CORROBORATED', reasons: ['INDEPENDENT_SOURCES>=2'], signals };
  if (nonOfficial.some((x) => IDENTIFIED_KINDS.has(x.kind))) return { status: 'SOURCE_IDENTIFIED', reasons: ['IDENTIFIED_SOURCE'], signals };
  return { status: 'UNVERIFIED_REPORT', reasons: ['DEFAULT'], signals };
}

export const STATUS_LABELS = Object.freeze({
  es: {
    UNVERIFIED_REPORT: 'Reporte sin verificar', SOURCE_IDENTIFIED: 'Fuente identificada', CORROBORATED: 'Corroborado',
    OFFICIAL_SOURCE_CONFIRMED: 'Confirmado por fuente oficial', DISPUTED: 'En disputa', RETRACTED: 'Retractado', EXPIRED: 'Caducado',
  },
});

/**
 * SENDA · Interoperabilidad con salas de mando y registro de auditoría a prueba de manipulación.
 *
 * - CAP 1.2 (OASIS, abierto): lo que ya consumen EU-Alert, Meteoalarm y las plataformas 112.
 *   SENDA exporta incidentes y alertas en CAP para que entren en cualquier sistema existente.
 * - EMSI (ISO/TR 22351, antes TSO/CWA 15931) es el estándar de intercambio entre organismos;
 *   su texto es de pago (CHF 227). SENDA expone aquí el MAPEO de campos que se implementará
 *   y validará al adquirir la norma: no se declara conformidad sin ella.
 * - Auditoría: cadena de hashes SHA-256; alterar, quitar o reordenar una entrada rompe la cadena.
 */
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const xml = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+00:00');

export const CAP_ENUMS = Object.freeze({
  status: ['Actual', 'Exercise', 'System', 'Test', 'Draft'], msgType: ['Alert', 'Update', 'Cancel', 'Ack', 'Error'], scope: ['Public', 'Restricted', 'Private'],
  category: ['Geo', 'Met', 'Safety', 'Security', 'Rescue', 'Fire', 'Health', 'Env', 'Transport', 'Infra', 'CBRNE', 'Other'],
  urgency: ['Immediate', 'Expected', 'Future', 'Past', 'Unknown'], severity: ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'], certainty: ['Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown'],
});

/** Genera CAP 1.2. Valida los enumerados obligatorios (lanza si alguno no es válido). */
export function toCap({ identifier, sender, sent, status = 'Actual', msgType = 'Alert', scope = 'Public', info }) {
  for (const [k, v] of Object.entries({ status, msgType, scope })) if (!CAP_ENUMS[k].includes(v)) throw new Error(`CAP ${k} no válido: ${v}`);
  for (const k of ['category', 'urgency', 'severity', 'certainty']) if (!CAP_ENUMS[k].includes(info[k])) throw new Error(`CAP ${k} no válido: ${info[k]}`);
  const area = info.area ?? {};
  const areaXml = `<area><areaDesc>${xml(area.areaDesc ?? 'Zona')}</areaDesc>${area.polygon ? `<polygon>${area.polygon.map(([la, lo]) => `${la},${lo}`).join(' ')}</polygon>` : ''}${area.circle ? `<circle>${area.circle.center.lat},${area.circle.center.lon} ${area.circle.radiusKm}</circle>` : ''}</area>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>${xml(identifier)}</identifier><sender>${xml(sender)}</sender><sent>${iso(sent)}</sent><status>${status}</status><msgType>${msgType}</msgType><scope>${scope}</scope><info><language>${xml(info.language ?? 'es-ES')}</language><category>${info.category}</category><event>${xml(info.event)}</event><urgency>${info.urgency}</urgency><severity>${info.severity}</severity><certainty>${info.certainty}</certainty>${info.expires ? `<expires>${iso(info.expires)}</expires>` : ''}<senderName>${xml(info.senderName ?? sender)}</senderName><headline>${xml(info.headline ?? info.event)}</headline><description>${xml(info.description ?? '')}</description>${info.instruction ? `<instruction>${xml(info.instruction)}</instruction>` : ''}${(info.parameters ?? []).map(([n, v]) => `<parameter><valueName>${xml(n)}</valueName><value>${xml(v)}</value></parameter>`).join('')}${areaXml}</info></alert>`;
}

/** Fusión de incidente ferroviario (rail-incident.fuseReports) → CAP para la sala 112. */
export function railIncidentToCap(site, { sender = 'senda@organismo.example', now }) {
  const trapped = site.counts?.TRAPPED ?? 0, injured = (site.counts?.INJURED_SERIOUS ?? 0), noResp = site.counts?.NO_RESPONSE ?? 0;
  return toCap({ identifier: `SENDA-RAIL-${site.site}-${now}`, sender, sent: now, scope: 'Restricted', msgType: 'Alert',
    info: { category: 'Transport', event: 'Accidente ferroviario', urgency: 'Immediate', severity: 'Extreme', certainty: 'Observed',
      headline: `Accidente ferroviario: ${site.reports ?? 0} informes, ${trapped} atrapados, ${injured} heridos graves, ${noResp} sin respuesta`,
      description: 'Fusión automática de informes cifrados de pasajeros SENDA (detección de impacto + respuestas). Estado «sin respuesta» no implica víctima.',
      parameters: [['SENDA_SITE', site.site], ['TRAIN', site.train ?? '?'], ['TRAPPED', trapped], ['INJURED_SERIOUS', injured], ['NO_RESPONSE', noResp]],
      area: { areaDesc: `Sitio ${site.site} · tren ${site.train ?? '?'}`, circle: { center: site.center, radiusKm: Math.max(0.2, (site.extentM ?? 300) / 1000) } } } });
}

/** Mapeo previsto SENDA → EMSI (pendiente de validar con el texto de ISO/TR 22351). */
export const EMSI_MAPPING = Object.freeze({
  'CONTEXT.ID': 'identifier del incidente SENDA', 'CONTEXT.MODE': 'ACTUAL | EXERCISE', 'EVENT.TYPE': 'categoría (ferroviario, sismo, inundación, edificio)',
  'EVENT.CASUALTIES': 'recuentos TRAPPED / INJURED_SERIOUS / NO_RESPONSE (nunca fallecidos sin confirmación oficial)', 'EVENT.EGEO': 'emplazamientos fusionados',
  'RESOURCE': 'pasarelas, drones y relés desplegados', 'MISSION': 'alertas dirigidas y órdenes remotas firmadas',
});

/* ---------------- auditoría encadenada ---------------- */
const hex = (u8) => [...new Uint8Array(u8)].map((b) => b.toString(16).padStart(2, '0')).join('');
const canon = (e) => JSON.stringify([e.seq, e.at, e.actor, e.action, e.data ?? null, e.prev]);

export function createAuditLog() {
  const entries = [];
  return {
    async append({ at, actor, action, data }) {
      const prev = entries.length ? entries[entries.length - 1].hash : '0'.repeat(64);
      const e = { seq: entries.length, at, actor, action, data, prev };
      e.hash = hex(await subtle.digest('SHA-256', enc.encode(canon(e))));
      entries.push(e); return e;
    },
    entries: () => entries.map((e) => ({ ...e })),
  };
}

/** Verifica una cadena exportada. Devuelve {ok} o {ok:false, brokenAt}. */
export async function verifyAuditLog(entries) {
  let prev = '0'.repeat(64);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i || e.prev !== prev) return { ok: false, brokenAt: i };
    if (hex(await subtle.digest('SHA-256', enc.encode(canon(e)))) !== e.hash) return { ok: false, brokenAt: i };
    prev = e.hash;
  }
  return { ok: true, length: entries.length, head: prev };
}

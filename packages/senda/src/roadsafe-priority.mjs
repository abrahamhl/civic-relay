/**
 * SENDA RoadSafe · Priorización explicable de incidentes para el operador.
 *
 * Orden lexicográfico (cada nivel solo desempata el anterior):
 *   1. Riesgo vital declarado o confirmado (atrapados, fuego, heridos graves, personas en calzada).
 *      Una declaración SIN verificar también sube: ante la duda sobre una vida, se prioriza y se verifica.
 *   2. Colisión secundaria sospechada / escalada requerida.
 *   3. Nivel de riesgo secundario (CRITICAL > HIGH > ELEVATED > MONITOR), usando el caso pesimista si hay incertidumbre.
 *   4. Índice relativo.
 *   5. Minutos sin asistencia en escena por encima del objetivo (SLA).
 *   6. Confianza (p) — la baja confianza NO baja la prioridad de un riesgo vital; añade «verificar».
 *
 * Esto ordena la ATENCIÓN de un operador de coordinación. No despacha recursos públicos ni sustituye
 * la clasificación del 112; cualquier reordenación manual queda registrada.
 */
import { assessIncidentRisk, recommendedActions } from './roadsafe-risk-factors.mjs';

const TIER_RANK = { CRITICAL: 3, HIGH: 2, ELEVATED: 1, MONITOR: 0 };

export function priorityKey(item, { now, slaMin = 30 } = {}) {
  const r = item.risk ?? assessIncidentRisk(item.circumstances);
  const escalated = ['SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED'].includes(item.state) || r.secondaryCollision;
  const waitedMin = item.assistance?.onSceneAt ? 0 : Math.max(0, (now - (item.assistance?.requestedAt ?? item.detectedAt ?? now)) / 60);
  return { r, key: [r.lifeRisk.length ? 1 : 0, escalated ? 1 : 0, TIER_RANK[r.tier], r.index, Math.max(0, waitedMin - slaMin), item.confidenceP ?? 0], waitedMin };
}

/**
 * items: [{ id, state, circumstances, confidenceP, official?, detectedAt, assistance?: {requestedAt, onSceneAt} }]
 * overrides: [{ id, toTop:true, by, reason, at }] — reordenación manual auditada.
 */
export function prioritizeIncidents(items, { now, slaMin = 30, overrides = [] } = {}) {
  const rows = items.map((it) => {
    const { r, key, waitedMin } = priorityKey(it, { now, slaMin });
    const flags = [];
    if ((it.confidenceP ?? 0) < 0.5 && !it.official) flags.push('VERIFICAR');
    if (r.uncertain) flags.push(`DATOS_INCOMPLETOS:${r.missing.join(',')}`);
    if (waitedMin > slaMin && !it.assistance?.onSceneAt) flags.push('SLA_SUPERADO');
    const why = [];
    if (key[0]) why.push(`riesgo vital: ${r.lifeRisk.join(', ')}`);
    if (key[1]) why.push('colisión secundaria / escalada');
    why.push(`nivel ${r.tier} (índice ${r.index}${r.uncertain ? `, rango ${r.indexRange.join('–')}` : ''})`);
    if (r.drivers.length) why.push('factores: ' + r.drivers.slice(0, 3).map((d) => `${d.label} ×${d.mult} [${d.grade}]`).join('; '));
    if (key[4] > 0) why.push(`${Math.round(waitedMin)} min sin asistencia`);
    return { id: it.id, key, tier: r.tier, index: r.index, lifeRisk: r.lifeRisk, flags, why, actions: recommendedActions(r), risk: r };
  });
  rows.sort((a, b) => { for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return b.key[i] - a.key[i]; return String(a.id).localeCompare(String(b.id)); });
  const audit = [];
  for (const o of overrides) {
    const i = rows.findIndex((r) => r.id === o.id);
    if (i > 0 && o.toTop && o.by && o.reason) { const [row] = rows.splice(i, 1); row.flags.push('REORDENADO_MANUALMENTE'); rows.unshift(row); audit.push({ ...o, applied: true }); }
    else audit.push({ ...o, applied: false, why: !o.by || !o.reason ? 'falta autor o motivo' : 'ya primero o desconocido' });
  }
  return { generatedAt: now, order: rows.map((r, i) => ({ rank: i + 1, ...r })), audit, disclaimer: 'Orden de atención para coordinación; no sustituye la clasificación del 112.' };
}

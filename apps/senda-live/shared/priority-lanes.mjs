/**
 * Carriles de prioridad compartidos por cliente (cola offline) y servidor (DTN / sincronización).
 *
 * Objetivo: la sincronización social NUNCA consume los recursos reservados a SOS y mensajes
 * críticos. Se reserva una fracción del presupuesto (bytes por ventana) al carril crítico; lo
 * social solo usa lo que sobra y lo crítico puede usar todo el presupuesto.
 * Prioridad numérica compatible con el sobre SENDA v2: 0 = máxima (SOS) … 9 = mínima.
 */
export const LANES = Object.freeze({ CRITICAL: 'CRITICAL', PERSONAL: 'PERSONAL', SOCIAL: 'SOCIAL' });

export function laneOf(item) {
  if (item.kind === 'SOS' || item.kind === 'OFFICIAL_ALERT' || item.kind === 'HELP_REQUEST' || (Number.isInteger(item.priority) && item.priority <= 1)) return LANES.CRITICAL;
  if (item.kind === 'MESSAGE' || item.kind === 'PERSONAL' || item.kind === 'COORDINATION') return LANES.PERSONAL;
  return LANES.SOCIAL;
}

/**
 * Planifica qué elementos de una cola se envían en esta ventana.
 * @param {{id:string, kind:string, priority?:number, sizeBytes:number, createdAt:number}[]} queue
 * @param {{budgetBytes:number, criticalReserve?:number}} opts  criticalReserve ∈ [0,1]
 * @returns {{send:object[], deferred:object[], usedBytes:number, byLane:Record<string,number>}}
 */
export function planWindow(queue, { budgetBytes, criticalReserve = 0.5 } = {}) {
  const order = { CRITICAL: 0, PERSONAL: 1, SOCIAL: 2 };
  const sorted = [...queue].sort((a, b) => order[laneOf(a)] - order[laneOf(b)] || (a.priority ?? 5) - (b.priority ?? 5) || a.createdAt - b.createdAt);
  const nonCriticalCap = Math.floor(budgetBytes * (1 - criticalReserve));
  const send = [], deferred = [];
  let used = 0, nonCriticalUsed = 0;
  const byLane = { CRITICAL: 0, PERSONAL: 0, SOCIAL: 0 };
  for (const it of sorted) {
    const lane = laneOf(it);
    const size = Math.max(1, it.sizeBytes | 0);
    const fitsTotal = used + size <= budgetBytes;
    const fitsLane = lane === 'CRITICAL' || nonCriticalUsed + size <= nonCriticalCap;
    if (fitsTotal && fitsLane) {
      send.push(it); used += size; byLane[lane] += size;
      if (lane !== 'CRITICAL') nonCriticalUsed += size;
    } else deferred.push(it);
  }
  return { send, deferred, usedBytes: used, byLane };
}

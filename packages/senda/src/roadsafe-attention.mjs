/**
 * SENDA RoadSafe · Presupuesto de atención del conductor y alcance de la cadena BLE por la carretera.
 *
 * 1) PRESUPUESTO DE ATENCIÓN. Con varios avisos por delante, decir todos satura y distrae (riesgo descrito
 *    en H-ROAD-1 y en las guías de distracción). El planificador elige COMO MUCHO UN aviso por turno, con
 *    un orden explicable y un presupuesto declarado de avisos por ventana de tiempo:
 *      1. dentro de la ventana útil (no tardío, no demasiado lejano)    → si no, no se dice
 *      2. techo de confianza (WARNING antes que ADVISORY)
 *      3. tipo (escena con personas/choque > cola > obras > contexto)
 *      4. menor tiempo de llegada
 *    Los avisos contextuales (puntos negros) solo usan presupuesto sobrante y nunca desplazan a uno real.
 *
 * 2) CADENA BLE SIN RED. Un aviso se propaga aguas arriba saltando entre vehículos con SENDA del mismo
 *    sentido. Con vehículos equipados distribuidos como proceso de Poisson de densidad λ = k·p (veh/m), la
 *    cadena se rompe en el primer hueco mayor que el alcance r: el número de saltos es geométrico con
 *    P(hueco ≤ r) = 1 − e^(−λr). Alcance r y penetración p NO están medidos: deben declararse.
 */

export const KIND_PRIORITY = { SECONDARY_COLLISION: 9, PEOPLE_ON_ROAD: 9, ACCIDENT: 8, WRONG_WAY: 8, STOPPED_VEHICLE_LANE: 7, SERVICE_STOPPING: 6, QUEUE_TAIL: 6, CLOSURE: 5, STOPPED_VEHICLE_SHOULDER: 5, OBSTACLE: 5, ANIMAL: 4, ICE: 4, FOG: 4, ROADWORKS: 3, UNKNOWN_OFFICIAL: 2, HOTSPOT_CONTEXT: 1 };

/**
 * Planificador de atención. items: salida de roadAhead().items. state: { spoken:[{id,at}] }.
 * policy (DECLARADA): { tMinS, tMaxS, budgetPerWindow, windowS, minGapS }.
 */
export function createAttentionPlanner(policy) {
  for (const k of ['tMinS', 'tMaxS', 'budgetPerWindow', 'windowS', 'minGapS']) if (!Number.isFinite(policy?.[k])) throw new Error(`presupuesto de atención: «${k}» debe declararse`);
  const spoken = []; // { id, at, aheadM }
  return {
    next(items, now) {
      const recent = spoken.filter((s) => now - s.at <= policy.windowS);
      const last = spoken.at(-1);
      const reasons = [];
      const cands = items.filter((i) => {
        if (!Number.isFinite(i.etaS)) { reasons.push({ id: i.warningId, why: 'sin tiempo de llegada (vehículo parado)' }); return false; }
        if (i.etaS < policy.tMinS) { reasons.push({ id: i.warningId, why: 'tardío: prioridad a la percepción directa' }); return false; }
        if (i.etaS > policy.tMaxS) { reasons.push({ id: i.warningId, why: 'demasiado lejos todavía' }); return false; }
        const said = spoken.filter((s) => s.id === i.warningId);
        if (said.length && said.at(-1).aheadM - i.aheadM < 400) { reasons.push({ id: i.warningId, why: 'ya anunciado a esta distancia' }); return false; }
        return true;
      });
      const rank = (i) => [i.ceiling === 'WARNING' ? 1 : 0, KIND_PRIORITY[i.kind] ?? 0, -i.etaS];
      cands.sort((a, b) => { const A = rank(a), B = rank(b); for (let k = 0; k < A.length; k++) if (A[k] !== B[k]) return B[k] - A[k]; return 0; });
      const top = cands[0];
      if (!top) return { speak: null, reasons };
      const isContext = top.kind === 'HOTSPOT_CONTEXT';
      const budgetLeft = policy.budgetPerWindow - recent.length;
      if (budgetLeft <= 0) return { speak: null, reasons: [...reasons, { id: top.warningId, why: 'presupuesto de atención agotado en la ventana' }] };
      if (isContext && budgetLeft <= 1) return { speak: null, reasons: [...reasons, { id: top.warningId, why: 'contexto: solo con presupuesto sobrante' }] };
      const urgent = top.ceiling === 'WARNING' && (KIND_PRIORITY[top.kind] ?? 0) >= 6;
      if (last && now - last.at < policy.minGapS && !urgent) return { speak: null, reasons: [...reasons, { id: top.warningId, why: 'separación mínima entre avisos' }] };
      spoken.push({ id: top.warningId, at: now, aheadM: top.aheadM });
      return { speak: top, queued: cands.slice(1).map((c) => c.warningId), reasons, budgetLeft: budgetLeft - 1 };
    },
    history: () => spoken.slice(),
  };
}

/**
 * Alcance esperado aguas arriba de una cadena BLE multisalto en el mismo sentido.
 * densityVehKm: densidad de tráfico (veh/km); penetration: fracción con SENDA; rangeM: alcance por salto
 * (NO medido: declarar); maxHops: tope de saltos (anti-inundación). Devuelve alcance esperado y P(≥ distancia).
 */
export function bleRelayReach({ densityVehKm, penetration, rangeM, maxHops, targetM }) {
  for (const [k, v] of Object.entries({ densityVehKm, penetration, rangeM, maxHops, targetM })) if (!Number.isFinite(v) || v < 0) throw new Error(`bleRelayReach: «${k}» debe declararse`);
  const lam = (densityVehKm / 1000) * penetration, q = 1 - Math.exp(-lam * rangeM); // P(siguiente equipado dentro del alcance)
  // Reenvío «al más lejano dentro del alcance» (óptimo greedy): avance = r − distancia esperada desde el borde
  // del alcance hasta el equipado más lejano (exponencial truncada en [0, r]).
  const backoff = lam > 0 ? (1 / lam - (rangeM * Math.exp(-lam * rangeM)) / (1 - Math.exp(-lam * rangeM) || 1)) : rangeM;
  const meanGap = Math.max(0, rangeM - backoff);
  let expHops = 0; for (let h = 1; h <= maxHops; h++) expHops += q ** h; // E[min(Geom, maxHops)]
  const hopsNeeded = meanGap > 0 ? Math.ceil(targetM / meanGap) : Infinity;
  const pReach = hopsNeeded <= maxHops ? q ** hopsNeeded : 0;
  return { basis: 'MODEL (Poisson espacial, reenvío al más lejano; alcance y penetración declarados, no medidos)', forwarding: 'GREEDY_FARTHEST', pNextHop: +q.toFixed(4), meanAdvancePerHopM: Math.round(meanGap), expectedHops: +expHops.toFixed(2), expectedReachM: Math.round(expHops * meanGap), hopsNeededForTarget: Number.isFinite(hopsNeeded) ? hopsNeeded : null, pReachTarget: +pReach.toFixed(4) };
}

// @ts-check
/**
 * SENDA · Datos con sentido de lo que ve la cámara, por objeto y por modo de uso (coche, bici, peatón).
 * Entrada: pistas de drive-hazard enriquecidas con drive-ar-hud (p3: zM, xM, widthM solo si el montaje está declarado).
 * Salida por objeto (todo MEDIDO por la cámara + CALCULADO aquí; nada sin geometría declarada se da en metros):
 *  - distancia, desplazamiento lateral, velocidad de acercamiento (pendiente de Theil–Sen de la distancia),
 *  - velocidad estimada del otro si va en tu sentido (tu velocidad GPS + variación de la distancia),
 *  - separación en segundos con el de delante frente a la regla de los 2 s de la DGT,
 *  - tiempo hasta alcanzarlo, frenada (luces de freno detectadas) y semáforo.
 * Modos:
 *  - COCHE: lo de arriba + al adelantar a un ciclista, la separación lateral frente a 1,5 m (RGC art. 85.4).
 *  - BICI_ATRAS (móvil mirando hacia atrás): adelantamientos que te hacen, con su separación lateral estimada.
 *  - PEATON: vehículos que se acercan con su tiempo de llegada. Es información, no una orden de cruzar.
 */
export const RULE_2S = Object.freeze({ seconds: 2, source: 'DGT, «regla de los dos segundos» para la distancia de seguridad' });
export const CYCLIST_CLEARANCE = Object.freeze({ meters: 1.5, source: 'Reglamento General de Circulación (RD 1428/2003), art. 85.4: separación lateral mínima de 1,5 m al adelantar a ciclistas' });
const VEH = new Set(['car', 'truck', 'bus', 'motorcycle']), VRU = new Set(['person', 'bicycle']);
const kindOf = (l) => (VEH.has(l) ? 'VEHICULO' : VRU.has(l) ? 'VULNERABLE' : l === 'traffic light' || l === 'stop sign' ? 'INFRA' : 'OTRO');
function slope(pts) { // Theil–Sen
  const s = []; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dt = pts[j].t - pts[i].t; if (dt > 0) s.push((pts[j].v - pts[i].v) / dt); }
  if (!s.length) return null; s.sort((a, b) => a - b); return s[Math.floor(s.length / 2)];
}

/** windowS (obligatorio): segundos de historia para estimar velocidades. egoHalfWidthM (opcional, declarado): medio ancho de tu vehículo. */
export function createInsights({ windowS, egoHalfWidthM = null, mode = 'COCHE' }) {
  if (!(windowS > 0)) throw new Error('createInsights exige windowS (sin valor por defecto)');
  const hist = new Map(), seen = new Map(), overtakes = [], counts = {}; let t0 = null;
  function update(objs, tS, egoMs) {
    t0 ??= tS; const out = [];
    for (const o of objs ?? []) {
      const kind = kindOf(o.label);
      if (!seen.has(o.id)) { seen.set(o.id, { label: o.label, first: tS }); counts[o.label] = (counts[o.label] ?? 0) + 1; }
      const p3 = o.p3 && Number.isFinite(o.p3.zM) ? o.p3 : null;
      let h = hist.get(o.id); if (!h) hist.set(o.id, (h = []));
      if (p3) { h.push({ t: tS, z: p3.zM, x: p3.xM ?? 0, w: p3.widthM ?? null }); while (h.length && h[0].t < tS - windowS) h.shift(); }
      const dz = h.length >= 3 ? slope(h.map((q) => ({ t: q.t, v: q.z }))) : null;
      const closingKmh = dz == null ? null : +(-dz * 3.6).toFixed(0);
      const sameDirKmh = dz != null && Number.isFinite(egoMs) && kind === 'VEHICULO' ? Math.max(0, Math.round((egoMs + dz) * 3.6)) : null;
      const gapS = p3 && o.zone === 'TU_CARRIL' && kind === 'VEHICULO' && Number.isFinite(egoMs) && egoMs > 2 ? +(p3.zM / egoMs).toFixed(1) : null;
      const ttcS = o.ttcS ?? (p3 && dz != null && dz < -0.3 ? +(p3.zM / -dz).toFixed(1) : null);
      out.push({ id: o.id, label: o.label, kind, zone: o.zone ?? null, distM: p3 ? p3.zM : null, lateralM: p3 ? p3.xM ?? 0 : null, closingKmh, sameDirKmh, gapS, gapBelow2s: gapS != null && gapS < RULE_2S.seconds, ttcS: ttcS == null ? null : +(+ttcS).toFixed(1), braking: o.brakeInfo?.braking ?? o.brakeInfo?.state === 'FRENO' ? true : null, light: o.lightState?.state ?? o.lightState ?? null, level: o.level ?? 'VERDE' });
    }
    // Adelantamientos: un objeto que estaba cerca y desaparece por un lateral (en COCHE, ciclistas que adelantas; en BICI_ATRAS, coches que te adelantan)
    const live = new Set((objs ?? []).map((o) => o.id));
    for (const [id, h] of hist) {
      if (live.has(id) || !h.length) continue;
      const last = h[h.length - 1], label = seen.get(id)?.label, near = last.z <= 12, lateral = Math.abs(last.x) > 0.8;
      const relevant = mode === 'COCHE' ? label === 'bicycle' || label === 'person' : mode === 'BICI_ATRAS' ? VEH.has(label) : false;
      if (relevant && near && lateral && egoHalfWidthM != null && last.w != null) {
        const clearanceM = +(Math.abs(last.x) - last.w / 2 - egoHalfWidthM).toFixed(2);
        overtakes.push({ tS: +last.t.toFixed(1), label, clearanceM, belowLegal: clearanceM < CYCLIST_CLEARANCE.meters, basis: 'ESTIMADO por cámara monocular con geometría declarada' });
      }
      hist.delete(id);
    }
    return out;
  }
  function summary(insights, tS) {
    const lead = insights.filter((i) => i.gapS != null).sort((a, b) => a.distM - b.distM)[0] ?? null;
    const now = { vehicles: insights.filter((i) => i.kind === 'VEHICULO').length, vulnerable: insights.filter((i) => i.kind === 'VULNERABLE').length };
    const minutes = t0 == null ? 0 : (tS - t0) / 60;
    const approaching = insights.filter((i) => i.kind !== 'INFRA' && i.ttcS != null && i.ttcS <= 30).sort((a, b) => a.ttcS - b.ttcS); // más de 30 s no es útil para decidir nada
    return { now, lead, leadBelow2s: lead?.gapBelow2s ?? false, totals: { ...counts }, perMinute: minutes > 0.5 ? Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / minutes).toFixed(1)])) : null, overtakes: overtakes.slice(-20), closeOvertakes: overtakes.filter((o) => o.belowLegal).length, nextArrival: approaching[0] ?? null };
  }
  return { update, summary, mode };
}

/** Frase corta por objeto para pintar junto a su recuadro. */
export function objectLine(i) {
  const ES = { car: 'coche', truck: 'camión', bus: 'autobús', motorcycle: 'moto', bicycle: 'bici', person: 'persona', 'traffic light': 'semáforo', 'stop sign': 'STOP' };
  const a = [ES[i.label] ?? i.label];
  if (i.distM != null) a.push(`${Math.round(i.distM)} m`);
  if (i.closingKmh != null && Math.abs(i.closingKmh) >= 3) a.push(i.closingKmh > 0 ? `se acerca ${i.closingKmh} km/h` : `se aleja ${-i.closingKmh} km/h`);
  const b = [];
  if (i.gapS != null) b.push(`${String(i.gapS).replace('.', ',')} s${i.gapBelow2s ? ' < 2 s' : ''}`);
  if (i.ttcS != null && i.ttcS < 8) b.push(`choque en ${String(i.ttcS).replace('.', ',')} s`);
  if (i.sameDirKmh != null) b.push(`va a ~${i.sameDirKmh} km/h`);
  if (i.braking) b.push('FRENA');
  if (i.light && typeof i.light === 'string' && i.light !== 'UNKNOWN') b.push(i.light);
  return [a.join(' · '), b.join(' · ')].filter(Boolean);
}

/**
 * SENDA RoadSafe · Posición de servicios de emergencia y asistencia, SOLO cuando la comparten con autorización.
 *
 * SENDA no rastrea a la policía ni a las ambulancias. Si un organismo o proveedor decide compartir la
 * posición de sus unidades (acuerdo + credencial), este registro:
 *  - acepta solo actualizaciones firmadas por credencial verificada y con hora coherente;
 *  - caduca la posición (TTL) y nunca muestra una posición vieja como actual;
 *  - aplica niveles de visibilidad: COORDINATOR ve la posición exacta; CITIZEN solo ve «ayuda asignada, llegada
 *    estimada» de la unidad asignada a SU incidente y si el organismo lo permite; PUBLIC no ve nada;
 *  - propone (no asigna) la unidad más cercana disponible con una ETA orientativa.
 * Clase de integración: CONTRACT_REQUIRED (ningún organismo está conectado hoy).
 */
const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

export function createResponderRegistry({ ttlS = 120, maxFutureS = 5 } = {}) {
  const units = new Map(), log = [];
  return {
    /** update: { unitId, agency, kind:'POLICE'|'AMBULANCE'|'FIRE'|'TOW'|'ROAD_OPERATOR', lat, lon, at, status:'AVAILABLE'|'ASSIGNED'|'BUSY', assignedIncident?, shareWithCitizen? } */
    update(u, { now, credential }) {
      if (!(credential?.verified === true && credential.agency === u.agency)) { log.push({ at: now, op: 'REJECT', unitId: u.unitId, why: 'credencial no verificada' }); return { ok: false, error: 'credencial no verificada' }; }
      if (!Number.isFinite(u.lat) || !Number.isFinite(u.lon) || Math.abs(u.lat) > 90 || Math.abs(u.lon) > 180) return { ok: false, error: 'posición no válida' };
      if (u.at > now + maxFutureS) return { ok: false, error: 'hora futura' };
      const prev = units.get(u.unitId); if (prev && u.at <= prev.at) return { ok: false, error: 'actualización antigua o repetida' };
      units.set(u.unitId, { ...u }); log.push({ at: now, op: 'UPDATE', unitId: u.unitId }); return { ok: true };
    },
    /** Vista según rol; las posiciones caducadas se marcan STALE y no cuentan como disponibles. */
    view({ now, role, incidentId = null }) {
      const all = [...units.values()].map((u) => ({ ...u, stale: now - u.at > ttlS, ageS: Math.round(now - u.at) }));
      if (role === 'COORDINATOR') return all;
      if (role === 'CITIZEN') return all.filter((u) => u.assignedIncident === incidentId && u.shareWithCitizen === true && !u.stale).map((u) => ({ kind: u.kind, status: 'ASSIGNED', note: 'ayuda asignada según el organismo' }));
      return [];
    },
    /** Propuesta de unidad más cercana (línea recta × factor de tortuosidad; ETA orientativa). */
    suggestNearest(target, { now, kinds = null, avgSpeedKmh = 70, detour = 1.3 } = {}) {
      const cand = [...units.values()].filter((u) => now - u.at <= ttlS && u.status === 'AVAILABLE' && (!kinds || kinds.includes(u.kind)))
        .map((u) => { const d = distM(u, target) * detour; return { unitId: u.unitId, kind: u.kind, agency: u.agency, roadDistanceKm: +(d / 1000).toFixed(1), etaMin: Math.round((d / 1000) / avgSpeedKmh * 60) }; })
        .sort((a, b) => a.etaMin - b.etaMin);
      return { proposals: cand.slice(0, 3), note: 'Propuesta para el coordinador del organismo; SENDA no asigna recursos públicos. ETA orientativa sin tráfico real.' };
    },
    log, units,
  };
}

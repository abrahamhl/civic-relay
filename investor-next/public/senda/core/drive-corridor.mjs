/**
 * SENDA Drive · avisos por delante en el corredor (100 % en el dispositivo, 0 €, sin red obligatoria).
 *
 * Combina incidencias reales DGT (DATEX II en vivo o copia empaquetada con su fecha) y avisos SENDA
 * (propios o recibidos por Bluetooth) para avisar solo de lo que tienes POR DELANTE en tu ruta o
 * rumbo, colapsando duplicados del feed DGT y calculando la distancia de parada AASHTO.
 *
 * Veracidad (CLAUDE.md):
 *  - Distancia de parada (SSD): fórmula de AASHTO Green Book (t_r = 2,5 s, a = 3,4 m/s², fuente en road-guard.mjs).
 *  - Horizonte de aviso, cono frontal (±35°), margen lateral en ruta (80 m) y radio de deduplicación (120 m):
 *    REGLAS DE LA APP declaradas, NO calibradas en carretera abierta con flota.
 *  - Los avisos de la copia DGT llevan siempre su etiqueta de fecha (`sourceLabel`) y los de SENDA Bluetooth
 *    mantienen «sin verificar» salvo confirmación por cámara.
 */
import { AASHTO_SSD, REPORT_KINDS } from './road-guard.mjs';
import { hazardBelief, beliefText, BELIEF_RULES } from './hazard-belief.mjs';
import { haversineM, pointSegmentM } from './route-planner.mjs';
import { CATEGORIES, FROM_REPORT, fromDatex } from './report-style.mjs';

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export const CORRIDOR_RULES = Object.freeze({
  coneHalfDeg: 35,          // regla de la app (alineada con EXAMPLE_RELEVANCE.headingTolDeg)
  routeMaxOffsetM: 80,      // distancia máxima lateral respecto a la polilínea OSRM (regla de la app)
  defaultLookaheadM: 2500,  // alcance por defecto sin velocidad GPS (regla de la app)
  minLookaheadM: 1500,      // alcance mínimo en movimiento (regla de la app)
  maxLookaheadM: 5000,      // alcance máximo, igual que el radar sin red (regla de la app)
  lookaheadS: 60,           // segundos de anticipación en marcha (regla de la app)
  nearRadiusM: 300,         // radio omnidireccional si no hay rumbo fiable (regla de la app)
  dedupM: 120,              // colapsa incidencias duplicadas misma categoría en < 120 m (regla de la app)
  voiceM: 1500,             // distancia máxima para anunciar por voz (regla de la app)
  ssdUrgencyFactor: 2,      // ROJO si distM ≤ 2 × SSD de AASHTO en peligro grave (regla de la app)
  basis: 'SSD_AASHTO_CON_FUENTE + REGLAS_APP_NO_CALIBRADAS',
  source: `SSD = AASHTO Green Book (${AASHTO_SSD.perceptionReactionS} s, ${AASHTO_SSD.decelMs2} m/s²; ${AASHTO_SSD.source}); cono ±35°, margen de ruta 80 m, horizonte 1,5–5 km y deduplicación 120 m = reglas de la app no calibradas`,
});

export const SEVERITY_RANK = Object.freeze({
  ACCIDENTE: 4, CORTE: 4, PARADO: 3, ANIMAL: 3, PELIGRO: 3, TRAFICO: 2, OBRAS: 2, CLIMA: 1, CAMARA: 0,
});
const CRITICAL_CATS = new Set(['ACCIDENTE', 'CORTE', 'PARADO', 'ANIMAL', 'PELIGRO']);

/** Distancia de visibilidad de parada AASHTO (m): d = v·t_r + v² / (2·a). Null si no hay velocidad válida. */
export function stoppingDistanceM(speedMs) {
  if (typeof speedMs !== 'number' || !Number.isFinite(speedMs) || speedMs < 0) return null;
  return speedMs * AASHTO_SSD.perceptionReactionS + (speedMs * speedMs) / (2 * AASHTO_SSD.decelMs2);
}

/** Acimut inicial geodésico en grados [0, 360) desde [lon, lat] hasta [lon, lat]. */
export function bearingDeg(from, to) {
  const lat1 = rad(from[1]), lat2 = rad(to[1]), dLon = rad(to[0] - from[0]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Diferencia angular mínima en grados [0, 180]. */
export function headingDeltaDeg(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

/** Proyecta un punto [lon, lat] sobre una polilínea; devuelve { distM, alongM }. */
function projectOnPolyline(coords, pt) {
  let bestDist = Infinity, bestAlong = 0, acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const segLen = haversineM(a, b);
    const d = pointSegmentM(pt, a, b);
    if (d < bestDist) {
      bestDist = d;
      const cos = Math.cos(rad((a[1] + b[1]) / 2));
      const ax = a[0] * cos, ay = a[1], bx = b[0] * cos, by = b[1], px = pt[0] * cos, py = pt[1];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const frac = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      bestAlong = acc + frac * segLen;
    }
    acc += segLen;
  }
  return { distM: bestDist, alongM: bestAlong };
}

/** Colapsa incidencias de la misma categoría separadas menos de dedupM (conserva la más cercana/prioritaria). */
export function dedupeHazards(items, dedupM = CORRIDOR_RULES.dedupM) {
  const ordered = [...items].sort((a, b) => a.distM - b.distM || b.rank - a.rank);
  const kept = [];
  for (const it of ordered) {
    const dup = kept.some((k) => k.cat === it.cat && haversineM([k.lon, k.lat], [it.lon, it.lat]) < dedupM);
    if (!dup) kept.push(it);
  }
  return kept;
}

/**
 * Evalúa incidencias DGT y avisos SENDA por delante del vehículo.
 * @param {object} p
 * @param {[number,number]} p.pos [lon, lat]
 * @param {number|null} [p.headingDeg] rumbo GPS en grados [0, 360)
 * @param {number|null} [p.speedMs] velocidad GPS en m/s
 * @param {Array<[number,number]>|null} [p.routeCoords] polilínea OSRM si hay ruta activa
 * @param {Array<object>} [p.incidents] incidencias DGT (DATEX II normalizadas)
 * @param {string} [p.incSource] etiqueta veraz de procedencia/fecha DGT
 * @param {Array<object>} [p.reports] avisos locales/Bluetooth SENDA
 * @param {object} [p.rules] reglas declaradas (por defecto CORRIDOR_RULES)
 */
export function hazardsAhead({ pos, headingDeg = null, speedMs = null, routeCoords = null, incidents = [], incSource = 'DGT', reports = [], rules = CORRIDOR_RULES, now = Date.now() } = {}) {
  const ssdM = stoppingDistanceM(speedMs);
  const moving = typeof speedMs === 'number' && Number.isFinite(speedMs) && speedMs > 1;
  const horizonM = moving
    ? Math.max(rules.minLookaheadM, Math.min(rules.maxLookaheadM, Math.round(speedMs * rules.lookaheadS)))
    : rules.defaultLookaheadM;
  const hasRoute = Array.isArray(routeCoords) && routeCoords.length >= 2;
  const hasHeading = typeof headingDeg === 'number' && Number.isFinite(headingDeg) && moving;
  const mode = hasRoute ? 'RUTA' : hasHeading ? 'CONO' : 'ENTORNO';

  if (!Array.isArray(pos) || pos.length < 2 || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) {
    return { top: null, items: [], horizonM, ssdM, rawCount: 0, dedupedCount: 0, mode, basis: rules.basis };
  }

  const egoProj = hasRoute ? projectOnPolyline(routeCoords, pos) : null;
  // Desigualdad triangular exacta: ningún punto con proyección ≤ horizonM sobre la ruta y desplazamiento lateral ≤ routeMaxOffsetM
  // puede estar en línea recta a más de egoProj.distM + horizonM + routeMaxOffsetM (evita proyectar cientos de incidencias lejanas cada segundo).
  const maxStraightM = (egoProj ? egoProj.distM : 0) + horizonM + rules.routeMaxOffsetM + 100;
  const cosLat0 = Math.max(0.1, Math.cos(rad(pos[1])));
  const candidates = [];

  const consider = (item) => {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return;
    if (Math.abs(item.lat - pos[1]) * 110_000 > maxStraightM) return;
    if (Math.abs(item.lon - pos[0]) * 111_320 * cosLat0 > maxStraightM) return;
    if (hasHeading && typeof item.bearing === 'number' && Number.isFinite(item.bearing)) {
      if (headingDeltaDeg(headingDeg, item.bearing) > 70) return;
    }
    let distM, lateralM = null, relDeg = null;
    if (hasRoute) {
      const p = projectOnPolyline(routeCoords, [item.lon, item.lat]);
      const aheadM = p.alongM - egoProj.alongM;
      if (aheadM < -20 || aheadM > horizonM || p.distM > rules.routeMaxOffsetM) return;
      distM = Math.max(0, Math.round(aheadM));
      lateralM = Math.round(p.distM);
    } else {
      const d = haversineM(pos, [item.lon, item.lat]);
      if (d > horizonM) return;
      if (hasHeading) {
        relDeg = Math.round(headingDeltaDeg(headingDeg, bearingDeg(pos, [item.lon, item.lat])));
        if (relDeg > rules.coneHalfDeg) return;
      } else {
        if (d > rules.nearRadiusM || !CRITICAL_CATS.has(item.cat)) return;
      }
      distM = Math.round(d);
    }
    const etaS = moving ? +(distM / speedMs).toFixed(1) : null;
    const withinSsdMargin = ssdM != null && distM <= rules.ssdUrgencyFactor * ssdM;
    const urgency = (withinSsdMargin && CRITICAL_CATS.has(item.cat)) || (distM <= 400 && item.rank >= 4)
      ? 'ROJO'
      : (distM <= rules.voiceM && item.rank >= 3) || item.rank >= 4
        ? 'AMBAR'
        : 'INFO';
    candidates.push({ ...item, distM, lateralM, relDeg, etaS, urgency, withinSsdMargin });
  };

  for (const i of incidents) {
    if (i == null || i.lat == null || i.lon == null) continue;
    const isBridge = i.type === 'BridgeOpening' || i.feed === 'brugopeningen';
    const cat = isBridge ? 'CORTE' : fromDatex(i);
    const label = isBridge ? 'Puente levadizo abierto' : (CATEGORIES[cat]?.label ?? 'Peligro');
    const isNl = i.country === 'NL';
    consider({
      key: `${isNl ? 'ndw' : 'dgt'}:${i.id ?? `${cat}@${Number(i.lat).toFixed(4)},${Number(i.lon).toFixed(4)}`}`,
      source: isNl ? 'NDW' : 'DGT',
      sourceLabel: incSource,
      cat,
      label,
      road: i.road || '',
      detail: i.cause || i.type || '',
      bearing: typeof i.bearing === 'number' && Number.isFinite(i.bearing) ? i.bearing : null,
      lat: Number(i.lat),
      lon: Number(i.lon),
      rank: SEVERITY_RANK[cat] ?? 1,
      verified: true,
    });
  }

  for (const r of reports) {
    if (r == null || r.lat == null || r.lon == null) continue;
    // Probabilidad bayesiana de que siga ahí (hazard-belief): los avisos viejos o negados dejan de salir.
    const belief = Number.isFinite(r.t) ? hazardBelief(r, now) : null;
    if (belief && belief.p < BELIEF_RULES.dropBelow) continue;
    const cat = FROM_REPORT[r.kind] ?? 'PELIGRO';
    const label = REPORT_KINDS[r.kind]?.label ?? CATEGORIES[cat]?.label ?? 'Aviso';
    consider({
      key: `senda:${r.id ?? `${r.kind}@${Number(r.lat).toFixed(4)},${Number(r.lon).toFixed(4)}`}`,
      source: 'SENDA',
      sourceLabel: (r.verified ? 'SENDA · visto con cámara' : r.own ? 'SENDA · tu aviso' : 'SENDA · otro móvil (sin verificar)') + (belief ? ` · ${beliefText(belief)}` : ''),
      reportId: r.id ?? null, belief: belief ? +belief.p.toFixed(3) : null,
      cat,
      label,
      road: '',
      detail: r.kind || '',
      lat: Number(r.lat),
      lon: Number(r.lon),
      rank: SEVERITY_RANK[cat] ?? 2,
      verified: !!r.verified,
    });
  }

  const deduped = dedupeHazards(candidates, rules.dedupM);
  const urgRank = { ROJO: 2, AMBAR: 1, INFO: 0 };
  deduped.sort((a, b) => urgRank[b.urgency] - urgRank[a.urgency] || b.rank - a.rank || a.distM - b.distM);

  return {
    top: deduped[0] ?? null,
    items: deduped,
    horizonM,
    ssdM: ssdM != null ? +ssdM.toFixed(1) : null,
    rawCount: candidates.length,
    dedupedCount: deduped.length,
    mode,
    basis: rules.basis,
  };
}

/** Frase hablada en español para el peligro más cercano del corredor (deduplicada en alreadySaid), o null. */
export function corridorAnnouncement(top, alreadySaid, rules = CORRIDOR_RULES) {
  if (!top || top.distM > rules.voiceM) return null;
  if (alreadySaid?.has(top.key)) return null;
  alreadySaid?.add(top.key);
  const distTxt = top.distM >= 1000
    ? `${(top.distM / 1000).toFixed(1).replace('.', ',')} kilómetros`
    : `${Math.max(50, Math.round(top.distM / 50) * 50)} metros`;
  const roadTxt = top.road ? ` en ${top.road}` : '';
  const qual = top.source === 'SENDA' && !top.verified ? ', sin verificar' : '';
  return `Aviso por delante a ${distTxt}: ${top.label.toLowerCase()}${roadTxt}${qual}`;
}

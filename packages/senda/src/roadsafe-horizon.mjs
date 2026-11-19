/**
 * SENDA RoadSafe · Horizonte electrónico: «lo que tienes por delante» en TU carretera y TU sentido.
 *
 * Concepto equivalente al horizonte electrónico de los sistemas de ayuda a la conducción: proyectar la
 * posición sobre la geometría de la vía (o la ruta guardada), mirar hacia delante una longitud de horizonte
 * y ordenar los avisos del bus por distancia y tiempo de llegada, descartando lo que queda detrás, lo de
 * la calzada contraria y lo caducado. Funciona sin red con la geometría del paquete de ruta.
 *
 * La longitud del horizonte y los umbrales son decisiones de diseño DECLARADAS por quien llama.
 */
import { roadLocate, pointAt } from './road-guard.mjs';

const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

/**
 * fix: { lat, lon, headingDeg, speedMs }, road: geometría (road-guard), warnings: avisos activos del bus.
 * opts: { now, horizonM, horizonS, maxOffRoadM } — horizonte = máx(horizonM, v·horizonS); todo declarado.
 */
export function roadAhead(fix, road, warnings, { now, horizonM, horizonS, maxOffRoadM }) {
  for (const [k, v] of Object.entries({ now, horizonM, horizonS, maxOffRoadM })) if (!Number.isFinite(v)) throw new Error(`roadAhead: «${k}» debe declararse`);
  const me = roadLocate(fix, road); // s, dir (+1/−1 respecto a la geometría), PK
  if (me.crossM > maxOffRoadM) return { onRoad: false, why: `a ${me.crossM} m de la vía: no se puede proyectar el horizonte`, items: [] };
  const v = Math.max(0, fix.speedMs ?? 0), H = Math.max(horizonM, v * horizonS);
  const items = [], dropped = [];
  for (const w of warnings) {
    if (w.validUntil <= now) { dropped.push({ id: w.warningId, why: 'caducado' }); continue; }
    if (w.road.roadId && road.id && w.road.roadId !== road.id && w.family !== 'WEATHER') { dropped.push({ id: w.warningId, why: 'otra carretera' }); continue; }
    const loc = roadLocate({ lat: w.point.lat, lon: w.point.lon }, road);
    if (loc.crossM > maxOffRoadM + 50) { dropped.push({ id: w.warningId, why: 'lejos de esta vía' }); continue; }
    if (w.road.dir != null && w.family !== 'WEATHER' && w.road.dir !== me.dir) { dropped.push({ id: w.warningId, why: 'sentido contrario' }); continue; }
    const ahead = (loc.s - me.s) * me.dir, tailAhead = ahead - (w.extentM ?? 0);
    if (ahead < -20) { dropped.push({ id: w.warningId, why: 'detrás' }); continue; }
    if (tailAhead > H) { dropped.push({ id: w.warningId, why: 'fuera del horizonte' }); continue; }
    const firstContactM = Math.max(0, tailAhead);
    items.push({ warningId: w.warningId, kind: w.kind, trust: w.trust, ceiling: w.ceiling, aheadM: Math.round(firstContactM), etaS: v > 0.5 ? Math.round(firstContactM / v) : null, pk: loc.pk, sources: [...new Set(w.lineage.map((l) => l.source.split(':')[0]))], independentRoots: new Set(w.lineage.map((l) => l.root)).size, directionKnown: w.road.dir != null, severityIfCrash: w.severityIfCrash ?? null });
  }
  items.sort((a, b) => a.aheadM - b.aheadM);
  return { onRoad: true, position: { roadId: road.id, pk: me.pk, s: me.s, dir: me.dir }, horizonM: Math.round(H), items, dropped };
}

/**
 * «Sentido creciente/decreciente» (PK, como lo publica la DGT) → sentido de la geometría (+1/−1).
 * Se deduce de cómo crecen los hitos kilométricos a lo largo de la geometría; sin hitos ⇒ null (no se adivina).
 */
export function geometryDirFromSentido(road, sentido) {
  const ms = road.milestones ?? []; if (ms.length < 2 || !['creciente', 'decreciente', 'ASC', 'DESC'].includes(sentido)) return null;
  const a = roadLocate(ms[0], road), b = roadLocate(ms[ms.length - 1], road);
  const pkUpAlongGeometry = (b.s - a.s) * (ms[ms.length - 1].km - ms[0].km) > 0;
  const up = sentido === 'creciente' || sentido === 'ASC';
  return up === pkUpAlongGeometry ? 1 : -1;
}

/** Punto de la vía a `aheadM` por delante (para dibujar o para anclar un aviso de cola móvil). */
export function pointAhead(road, fix, aheadM) {
  const me = roadLocate(fix, road); return pointAt(road, me.s + me.dir * aheadM);
}

/** Distancia directa (respaldo sin geometría): solo para depurar, nunca para decidir sentido. */
export const straightDistanceM = distM;

/**
 * SENDA · Motor de fusión de situaciones.
 *
 * No es «otra capa»: cruza TODAS las capas (alertas oficiales, carreteras, integridad GNSS, satélite, cámaras,
 * caudales y reportes ciudadanos) y construye SITUACIONES: un ancla (lo que pasa) más la evidencia de las demás
 * fuentes en su radio y en su ventana de tiempo, con la cadena de procedencia de cada dato y unos hechos
 * calculados (no redactados). La regla de cada tipo de ancla dice qué radio y qué capas importan.
 *
 * Reglas de veracidad: cada hecho sale de un recuento o de un valor de las capas; si una capa no aporta nada, no se
 * menciona. No se predice ni se avisa a la población: es una herramienta de lectura de la situación.
 */
import { haversineM } from './atlas.mjs';

/** Peso de gravedad del ancla (orden, no probabilidad). */
export function anchorSeverity(e) {
  if (/alerta Red/.test(e.label ?? '')) return 3;
  if (/alerta Orange/.test(e.label ?? '')) return 2;
  if (e.kind === 'DGT_accident' || e.kind === 'NDW_Accident' || e.kind === 'PERSON_TRAPPED') return 2;
  if (e.kind === 'FIRE_START') return 2;
  return 1;
}

/**
 * Reglas por defecto: radio de búsqueda (km), ventana de tiempo (h, simétrica) y capas que aportan evidencia.
 * Son decisiones de SENDA para agrupar (no umbrales físicos): se declaran para que se puedan revisar.
 */
export const DEFAULT_RULES = Object.freeze({
  GDACS_EQ: { radiusKm: 300, windowH: 72, layers: ['roads', 'gnss', 'gdacs', 'citizen', 'cameras'] },
  GDACS_TC: { radiusKm: 500, windowH: 120, layers: ['roads', 'gnss', 'gdacs', 'citizen', 'cameras'] },
  GDACS_FL: { radiusKm: 150, windowH: 120, layers: ['roads', 'gdacs', 'citizen', 'rivers', 'cameras'] },
  GDACS_WF: { radiusKm: 60, windowH: 72, layers: ['roads', 'gdacs', 'fire', 'citizen', 'cameras'] },
  GDACS_VO: { radiusKm: 150, windowH: 168, layers: ['roads', 'gnss', 'gdacs', 'citizen'] },
  GDACS_DR: { radiusKm: 0, windowH: 0, layers: [] },
  FIRE_START: { radiusKm: 40, windowH: 48, layers: ['roads', 'fire', 'cameras', 'citizen', 'gdacs'] },
  DGT_accident: { radiusKm: 15, windowH: 6, layers: ['roads', 'gnss', 'citizen', 'cameras'] },
  NDW_Accident: { radiusKm: 15, windowH: 6, layers: ['roads', 'gnss', 'citizen', 'cameras'] },
  DGT_environmentalObstruction: { radiusKm: 25, windowH: 24, layers: ['roads', 'rivers', 'citizen', 'gdacs'] },
  CITIZEN: { radiusKm: 10, windowH: 12, layers: ['roads', 'rivers', 'citizen', 'gnss', 'gdacs', 'cameras'] },
});

const LAYER_OF = (e) => e.basis === 'MEASURED_ADSB' ? 'gnss' : e.kind?.startsWith('GDACS_') ? 'gdacs' : (e.kind?.startsWith('DGT_') || e.kind?.startsWith('NDW_')) ? 'roads'
  : e.kind === 'FIRE_HOTSPOT' ? 'fire' : e.kind === 'CAMERA_COUNT' ? 'cameras' : e.basis === 'CITIZEN_SIGNED_UNVERIFIED' || e.basis === 'SIMULATION' ? 'citizen' : e.kind === 'RIVER' ? 'rivers' : 'other';

/** Convierte cada caso de incendio GOES en un ancla «inicio de incendio» (primera detección del satélite). */
export function fireStartAnchors(fireEvents, names = {}) {
  const byCase = {}; for (const e of fireEvents) (byCase[e.group] ??= []).push(e);
  return Object.entries(byCase).map(([g, ev]) => { const first = ev.reduce((a, b) => (b.t < a.t ? b : a));
    return { id: `fire-start:${g}`, t: first.t, lat: first.lat, lon: first.lon, kind: 'FIRE_START', label: names[g] ?? `Incendio ${g}`, source: first.source, basis: first.basis, group: g }; });
}

/**
 * Fusiona. anchors: eventos-ancla; pool: todos los eventos de evidencia (de cualquier capa).
 * Devuelve situaciones ordenadas por gravedad y nº de fuentes distintas que la corroboran.
 */
export function fuseSituations(anchors, pool, { rules = DEFAULT_RULES, perLayer = 4 } = {}) {
  const out = [];
  for (const a of anchors) {
    const rule = rules[a.kind] ?? (a.basis === 'CITIZEN_SIGNED_UNVERIFIED' || a.basis === 'SIMULATION' ? rules.CITIZEN : null);
    if (!rule || !(rule.radiusKm > 0)) continue;
    const near = [];
    for (const e of pool) {
      if (e.id === a.id) continue; const layer = LAYER_OF(e); if (!rule.layers.includes(layer)) continue;
      const timeless = layer === 'gnss' || layer === 'cameras' || layer === 'rivers';
      if (!timeless && Math.abs(e.t - a.t) > rule.windowH * 3_600_000) continue;
      const d = haversineM(a, e) / 1000; if (d <= rule.radiusKm) near.push({ e, layer, dKm: d });
    }
    const byLayer = {}; for (const n of near) (byLayer[n.layer] ??= []).push(n);
    const facts = [];
    if (byLayer.fire) { const f = byLayer.fire, t0 = Math.min(...f.map((n) => n.e.t)), t1 = Math.max(...f.map((n) => n.e.t));
      facts.push(`${f.length} detecciones de fuego por satélite a ≤ ${rule.radiusKm} km en ${((t1 - t0) / 3_600_000).toFixed(1)} h`); }
    if (byLayer.roads) { const r = byLayer.roads, roads = new Set(r.map((n) => (n.e.label ?? '').split(' · ')[0]));
      facts.push(`${r.length} incidencia(s) de tráfico en ${roads.size} vía(s) a ≤ ${rule.radiusKm} km (la más cercana a ${Math.min(...r.map((n) => n.dKm)).toFixed(1)} km)`); }
    if (byLayer.gnss) { const g = byLayer.gnss, worst = g.some((n) => n.e.kind === 'GNSS_red') ? 'rojo' : g.some((n) => n.e.kind === 'GNSS_yellow') ? 'amarillo' : 'verde';
      facts.push(`integridad GPS en la zona: ${worst} (${g.length} celda(s) con aviones)`); }
    if (byLayer.gdacs) facts.push(`${byLayer.gdacs.length} otra(s) alerta(s) GDACS cerca`);
    if (byLayer.cameras) facts.push(`${byLayer.cameras.length} cámara(s) pública(s) en el radio`);
    if (byLayer.citizen) facts.push(`${byLayer.citizen.length} reporte(s) ciudadano(s) cerca`);
    if (byLayer.rivers) facts.push(`caudal GloFAS disponible para ${byLayer.rivers.length} punto(s)`);
    const sources = [...new Set([a.source, ...near.map((n) => n.e.source)])];
    out.push({ id: `sit:${a.id}`, anchor: a, title: a.label, lat: a.lat, lon: a.lon, t: a.t, severity: anchorSeverity(a), rule: { kind: a.kind, ...rule },
      corroboration: new Set(near.map((n) => n.layer)).size, sources, facts,
      evidence: Object.values(byLayer).flatMap((l) => [...l].sort((x, y) => x.dKm - y.dKm).slice(0, perLayer)).sort((x, y) => x.dKm - y.dKm).map((n) => ({ layer: n.layer, dKm: Math.round(n.dKm * 10) / 10, label: n.e.label, t: n.e.t, source: n.e.source, basis: n.e.basis })) });
  }
  // Orden: gravedad del ancla más 1,5 por cada capa distinta que la corrobora (decisión de SENDA, declarada)
  return out.sort((x, y) => (y.severity + 1.5 * y.corroboration) - (x.severity + 1.5 * x.corroboration) || y.t - x.t);
}

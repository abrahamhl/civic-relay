/**
 * SENDA Drive · Radares fijos y de tramo OFICIALMENTE PUBLICADOS (100 % legal, sin red, 0 €).
 *
 * Política innegociable (CLAUDE.md + dgt-infra.mjs):
 *  - SOLO admite posiciones publicadas oficialmente por administraciones (DGT CC BY 4.0,
 *    Servei Català de Trànsit, Gobierno Vasco, Navarra, Ayuntamientos — Ley 37/2007).
 *  - RECHAZA de forma dura cualquier control policial móvil, aviso no anunciado o detector RF.
 *  - Incluye seguimiento exacto de velocidad media en radares de tramo (cinemática pura v = Δs / Δt).
 */
import { haversineM } from './route-planner.mjs';
import { bearingDeg, headingDeltaDeg } from './drive-corridor.mjs';

export const OFFICIAL_RADAR_SOURCES = Object.freeze(['dgt', 'sct', 'euskadi', 'madrid', 'salamanca', 'donostia', 'navarra']);
export const ALLOWED_RADAR_KINDS = Object.freeze(['fixed', 'section', 'stretch']);
const FORBIDDEN_PATTERNS = /mobile|movil|polic|control_movil|rf_detect|unannounced|camuflado/i;

export const RADAR_RULES = Object.freeze({
  lookaheadM: 1200,         // alcance de aviso por delante (regla de la app, no calibrada)
  coneHalfDeg: 35,          // cono frontal del vehículo (regla de la app)
  radarBearingTolDeg: 55,   // tolerancia respecto al rumbo publicado del radar para filtrar calzada contraria
  voiceM: 800,              // distancia para anuncio por voz (regla de la app)
  sectionEntryM: 90,        // radio de entrada/salida de radar de tramo (regla de la app)
  source: 'Posiciones oficiales publicadas (DGT CC BY 4.0 / SCT / Euskadi / Ayuntamientos); umbrales de aviso = reglas de la app no calibradas',
});

/** Puerta legal/cívica: solo radares fijos o de tramo de organismos públicos oficiales. */
export function isAllowedOfficialControl(item) {
  if (!item || typeof item !== 'object') return false;
  const kind = String(item.kind ?? '');
  const src = String(item.src ?? item.source ?? '');
  if (FORBIDDEN_PATTERNS.test(kind) || FORBIDDEN_PATTERNS.test(src)) return false;
  return ALLOWED_RADAR_KINDS.includes(kind) && OFFICIAL_RADAR_SOURCES.includes(src);
}

/**
 * Busca radares fijos/de tramo oficiales por delante del vehículo.
 * Si el radar trae rumbo publicado (`bearing`), descarta los de la calzada contraria.
 */
export function radarsAhead({ pos, headingDeg = null, speedMs = null, points = [], rules = RADAR_RULES } = {}) {
  if (!Array.isArray(pos) || pos.length < 2 || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) {
    return { top: null, items: [], source: rules.source };
  }
  const moving = typeof speedMs === 'number' && Number.isFinite(speedMs) && speedMs > 1;
  const hasHeading = typeof headingDeg === 'number' && Number.isFinite(headingDeg) && moving;
  const out = [];

  for (const r of points) {
    if (!isAllowedOfficialControl(r)) continue;
    if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    const d = haversineM(pos, [r.lon, r.lat]);
    if (d > rules.lookaheadM) continue;
    if (hasHeading) {
      const rel = headingDeltaDeg(headingDeg, bearingDeg(pos, [r.lon, r.lat]));
      if (rel > rules.coneHalfDeg) continue;
      if (typeof r.bearing === 'number' && Number.isFinite(r.bearing)) {
        if (headingDeltaDeg(headingDeg, r.bearing) > rules.radarBearingTolDeg) continue;
      }
    } else if (d > 300) {
      continue;
    }
    const maxspeed = typeof r.maxspeed === 'number' && Number.isFinite(r.maxspeed) ? r.maxspeed : null;
    const speedKmh = moving ? speedMs * 3.6 : null;
    const overLimit = maxspeed != null && speedKmh != null ? speedKmh > maxspeed : false;
    out.push({
      id: r.id,
      kind: r.kind,
      src: r.src ?? r.source,
      road: r.road || '',
      km: r.km ?? null,
      dir: r.dir || '',
      maxspeed,
      distM: Math.round(d),
      etaS: moving ? +(d / speedMs).toFixed(1) : null,
      overLimit,
      lon: r.lon,
      lat: r.lat,
      attribution: `${String(r.src ?? r.source).toUpperCase()} · oficial publicado`,
    });
  }
  out.sort((a, b) => a.distM - b.distM);
  return { top: out[0] ?? null, items: out, source: rules.source };
}

/**
 * Seguimiento cinemático exacto de velocidad media en un radar de tramo oficial (`v_media = Δs / Δt`).
 */
export function createSectionTracker(stretches = [], rules = RADAR_RULES) {
  const valid = stretches.filter((s) => isAllowedOfficialControl({ kind: 'stretch', src: s.src }) && Array.isArray(s.from) && Array.isArray(s.to));
  let active = null;

  return {
    get active() { return active; },
    reset() { active = null; },
    update({ pos, tMs = Date.now(), headingDeg = null, speedMs = null }) {
      if (!Array.isArray(pos) || pos.length < 2) return null;
      if (!active) {
        for (const s of valid) {
          const dStart = haversineM(pos, s.from);
          if (dStart <= rules.sectionEntryM) {
            const stretchBrg = bearingDeg(s.from, s.to);
            if (headingDeg != null && speedMs > 1 && headingDeltaDeg(headingDeg, stretchBrg) > 65) continue;
            const totalM = Math.max(100, haversineM(s.from, s.to));
            active = { stretch: s, startMs: tMs, lastMs: tMs, lastPos: pos, distM: 0, totalM };
            break;
          }
        }
        return active ? { id: active.stretch.id, road: active.stretch.road, avgKmh: speedMs != null ? +(speedMs * 3.6).toFixed(1) : null, maxspeed: active.stretch.maxspeed ?? null, progressPct: 0, remainingM: Math.round(active.totalM), overAverage: false } : null;
      }

      const step = haversineM(active.lastPos, pos);
      const dtS = Math.max(0.5, (tMs - active.lastMs) / 1000);
      if (step < Math.max(500, dtS * 85)) active.distM += step;
      active.lastPos = pos;
      active.lastMs = tMs;
      const elapsedS = Math.max(0.5, (tMs - active.startMs) / 1000);
      const avgKmh = +((active.distM / elapsedS) * 3.6).toFixed(1);
      const remM = Math.round(haversineM(pos, active.stretch.to));
      const maxspeed = active.stretch.maxspeed ?? null;
      const done = remM <= rules.sectionEntryM || active.distM > active.totalM * 1.35;
      const state = {
        id: active.stretch.id,
        road: active.stretch.road,
        avgKmh,
        maxspeed,
        elapsedS: +elapsedS.toFixed(1),
        distM: Math.round(active.distM),
        remainingM: remM,
        progressPct: Math.min(100, Math.round((active.distM / active.totalM) * 100)),
        overAverage: maxspeed != null ? avgKmh > maxspeed : false,
        finished: done,
      };
      if (done) active = null;
      return state;
    },
  };
}

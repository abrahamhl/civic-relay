/**
 * SENDA · Lectores verificados de fuentes abiertas multiplataforma (GDACS, ReliefWeb, EUMETSAT MTG-I1)
 * y fusión situacional con procedencia explícita (0 €, sin claves privadas, CLAUDE.md §1).
 */
import { haversineM } from './route-planner.mjs';

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : null;
};

/**
 * Analiza el feed oficial GDACS GeoRSS XML (https://www.gdacs.org/xml/rss.xml).
 * Soporta terremotos (EQ), inundaciones (FL), ciclones (TC), incendios (WF), volcanes (VO) y sequías (DR).
 */
export function parseGdacsRss(xml) {
  if (typeof xml !== 'string' || !xml.includes('<item')) return [];
  const items = [];
  const matches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);
  for (const m of matches) {
    const blk = m[1];
    const pt = tag(blk, 'georss:point');
    if (!pt) continue;
    const [latStr, lonStr] = pt.split(/\s+/);
    const lat = Number(latStr), lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const level = tag(blk, 'gdacs:alertlevel') || 'Unknown';
    const type = tag(blk, 'gdacs:eventtype') || 'EVENT';
    const score = Number(tag(blk, 'gdacs:alertscore'));
    items.push({
      id: `gdacs:${type}:${tag(blk, 'gdacs:eventid') ?? items.length}`,
      source: 'GDACS',
      attribution: 'GDACS (ONU / Comisión Europea JRC)',
      type,
      level, // Green | Orange | Red
      score: Number.isFinite(score) ? score : null,
      title: tag(blk, 'title') || `${type} ${level}`,
      country: tag(blk, 'gdacs:country') || null,
      pubDate: tag(blk, 'pubDate') || null,
      lat, lon,
    });
  }
  return items;
}

/** Normaliza eventos de la API abierta de ReliefWeb (OCHA ONU). */
export function parseReliefWeb(json) {
  const list = Array.isArray(json?.data) ? json.data : [];
  return list.map((d) => {
    const f = d.fields || {};
    const c = Array.isArray(f.country) ? f.country[0] : f.country;
    const lat = Number(c?.location?.lat), lon = Number(c?.location?.lon);
    return {
      id: `reliefweb:${d.id}`,
      source: 'RELIEFWEB',
      attribution: 'UN OCHA ReliefWeb API',
      type: f.type?.[0]?.code || 'CRISIS',
      level: f.status === 'alert' ? 'Red' : 'Orange',
      title: f.name || f.title || 'Evento ReliefWeb',
      country: c?.name || null,
      pubDate: f.date?.created || null,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
    };
  }).filter((x) => x.lat != null && x.lon != null);
}

/**
 * Normaliza detecciones geoestacionarias EUMETSAT MTG-I1 (FCI 1–2 km cada 10 min / Lightning Imager).
 * Declara siempre la incertidumbre espacial de píxel GEO (`uncertaintyKm`: 1–2 km).
 */
export function parseMtgEvents(geojson) {
  const feats = Array.isArray(geojson?.features) ? geojson.features : [];
  const out = [];
  for (const f of feats) {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lon, lat] = coords;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const kind = p.instrument === 'LI' || p.kind === 'lightning' ? 'LIGHTNING' : 'FIRE_FRP';
    out.push({
      id: `mtg:${f.id ?? out.length}`,
      source: 'EUMETSAT_MTG',
      attribution: 'EUMETSAT Meteosat Third Generation (MTG-I1 FCI/LI)',
      type: kind,
      level: kind === 'FIRE_FRP' && Number(p.frpMw) >= 50 ? 'Red' : 'Orange',
      frpMw: typeof p.frpMw === 'number' ? p.frpMw : null,
      uncertaintyKm: typeof p.uncertaintyKm === 'number' ? p.uncertaintyKm : (kind === 'LIGHTNING' ? 4.5 : 2.0),
      pubDate: p.utc || p.time || null,
      lat, lon,
    });
  }
  return out;
}

/** Filtra alertas de fuentes abiertas y observación de la Tierra dentro de un radio declarado (km) alrededor de una posición [lon, lat]. */
export function osintNear({ pos, events = [], radiusKm = 100 }) {
  if (!Array.isArray(pos) || pos.length < 2 || !(radiusKm > 0)) return [];
  const maxM = radiusKm * 1000;
  const sev = { Red: 3, Orange: 2, Green: 1 };
  return events
    .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon))
    .map((e) => ({ ...e, distKm: +(haversineM(pos, [e.lon, e.lat]) / 1000).toFixed(1) }))
    .filter((e) => e.distKm * 1000 <= maxM)
    .sort((a, b) => (sev[b.level] ?? 0) - (sev[a.level] ?? 0) || a.distKm - b.distKm);
}

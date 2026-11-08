/**
 * Conectores a fuentes públicas reales. Cada conector recibe un `fetch` inyectable
 * (pruebas sin red, caché, proxy) y devuelve datos normalizados con su PROCEDENCIA.
 *
 * Fuentes:
 *  - USGS Earthquake Hazards (GeoJSON):  https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson
 *  - EMSC Seismic Portal (FDSN, JSON):   https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=50
 *  - Meteoalarm / EU-Alert (CAP 1.2 XML): feeds de EUMETNET por país (ej. https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain)
 *  - CelesTrak GP (TLE):                 https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle
 *  - SatNOGS Network (estaciones terrestres abiertas): https://network.satnogs.org/api/stations/?format=json
 * Ninguna de estas fuentes convierte a SENDA en emisor oficial: las alertas se
 * reenvían como canal secundario con su emisor original visible.
 */
import { parseTleFile } from './orbital.mjs';
import { zoneFromQuake } from './zones.mjs';

export const SOURCES = Object.freeze({
  USGS_ALL_HOUR: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  EMSC_LATEST: 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=50',
  CELESTRAK_WEATHER: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle',
  CELESTRAK_STARLINK: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
  CELESTRAK_IRIDIUM: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-NEXT&FORMAT=tle',
  SATNOGS_STATIONS: 'https://network.satnogs.org/api/stations/?format=json',
});

/** USGS GeoJSON → eventos normalizados. */
export function parseUsgs(geojson) {
  return (geojson.features ?? []).map((f) => ({
    id: f.id, provider: 'USGS', mag: f.properties.mag, time: f.properties.time, place: f.properties.place,
    lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], depthKm: f.geometry.coordinates[2],
  })).filter((e) => Number.isFinite(e.mag));
}

/** EMSC FDSN JSON → eventos normalizados. */
export function parseEmsc(json) {
  return (json.features ?? []).map((f) => ({
    id: f.id ?? f.properties.unid, provider: 'EMSC', mag: f.properties.mag, time: Date.parse(f.properties.time),
    place: f.properties.flynn_region, lat: f.properties.lat, lon: f.properties.lon, depthKm: f.properties.depth,
  })).filter((e) => Number.isFinite(e.mag));
}

/** CAP 1.2 XML mínimo (EU-Alert/Meteoalarm) → objeto para zones.ingestOfficialAlert. */
export function parseCap(xml) {
  const tag = (t, s = xml) => s.match(new RegExp(`<(?:cap:)?${t}>([\\s\\S]*?)</(?:cap:)?${t}>`))?.[1]?.trim();
  const info = tag('info') ?? '';
  const area = tag('area', info) ?? '';
  const poly = tag('polygon', area);
  const circle = tag('circle', area);
  return {
    identifier: tag('identifier'), sender: tag('sender'), sent: tag('sent'), status: tag('status'), msgType: tag('msgType'),
    event: tag('event', info), severity: tag('severity', info), urgency: tag('urgency', info), expires: tag('expires', info),
    headline: tag('headline', info), areaDesc: tag('areaDesc', area),
    area: {
      polygon: poly ? poly.split(/\s+/).map((pt) => pt.split(',').map(Number)) : undefined,
      circle: circle ? (([c, r]) => ({ center: { lat: +c.split(',')[0], lon: +c.split(',')[1] }, radiusKm: +r }))(circle.split(/\s+/)) : undefined,
    },
    signature: tag('Signature') ? 'XMLDSIG_PRESENT' : 'NONE',
  };
}

/** SatNOGS: estaciones terrestres abiertas en línea cerca de un punto (posibles gateways). */
export function parseSatnogsStations(json) {
  return json.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lng, altitudeM: s.altitude, status: s.status, provider: 'SatNOGS' }))
    .filter((s) => s.status === 'Online');
}

async function getText(url, fetchImpl) {
  const r = await fetchImpl(url, { headers: { 'User-Agent': 'SENDA-research/0.1' } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

/** Ingesta combinada: sismos recientes → zonas; listas TLE; estaciones SatNOGS. */
export async function pullAll({ fetchImpl = globalThis.fetch, minMag = 4.5 } = {}) {
  const out = { fetchedAt: Date.now(), zones: [], satellites: [], stations: [], errors: [] };
  const tryIt = async (name, fn) => { try { await fn(); } catch (e) { out.errors.push({ source: name, error: String(e.message ?? e) }); } };
  await tryIt('USGS', async () => { for (const e of parseUsgs(JSON.parse(await getText(SOURCES.USGS_ALL_HOUR, fetchImpl)))) if (e.mag >= minMag) out.zones.push(zoneFromQuake(e)); });
  await tryIt('EMSC', async () => { for (const e of parseEmsc(JSON.parse(await getText(SOURCES.EMSC_LATEST, fetchImpl)))) if (e.mag >= minMag) out.zones.push(zoneFromQuake(e)); });
  await tryIt('CelesTrak', async () => { out.satellites.push(...parseTleFile(await getText(SOURCES.CELESTRAK_WEATHER, fetchImpl))); });
  await tryIt('SatNOGS', async () => { out.stations.push(...parseSatnogsStations(JSON.parse(await getText(SOURCES.SATNOGS_STATIONS, fetchImpl)))); });
  return out;
}

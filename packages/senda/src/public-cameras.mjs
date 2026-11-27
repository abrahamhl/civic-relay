// @ts-check
/**
 * SENDA · Cámaras públicas de varias fuentes abiertas, en un solo formato (ES, NL, BE, DE).
 * Solo fuentes OFICIALES y publicadas para reutilizar, cada una con su licencia. Nunca cámaras privadas ni CCTV sin protección.
 * Formato común: { id, src, cc, lat, lon, name, road, img (imagen fija pública o null), page (página oficial o null), kind }.
 * Si una fuente solo publica la UBICACIÓN, img = null y se dice así en la app.
 */
import { utmToLonLat } from './fire4d.mjs';

export const CAMERA_SOURCES = Object.freeze({
  DGT: { name: 'DGT · cámaras de tráfico', cc: 'ES', license: 'DGT, reutilización con atribución (CC BY)', url: 'https://nap.dgt.es/', images: true },
  MADRID: { name: 'Ayuntamiento de Madrid · cámaras de tráfico', cc: 'ES', license: 'Condiciones de uso de datos.madrid.es (atribución)', url: 'https://datos.madrid.es/egob/catalogo/202088-0-trafico-camaras', images: true },
  EUSKADI: { name: 'Gobierno Vasco · cámaras de tráfico (API de tráfico)', cc: 'ES', license: 'CC BY 4.0', url: 'https://api.euskadi.eus/traffic/v1.0/cameras', images: false },
  RWS: { name: 'Rijkswaterstaat · cámaras de verkeersinfo', cc: 'NL', license: 'no verificada: solo ubicación y enlace a la emisión oficial', url: 'https://api.rwsverkeersinfo.nl/api/cameras', images: false },
  BRUSSEL: { name: 'Ville de Bruxelles · webcams', cc: 'BE', license: 'CC0 1.0', url: 'https://opendata.bruxelles.be/explore/dataset/webcams/', images: false },
  AUTOBAHN: { name: 'Autobahn GmbH · webcams (API oficial)', cc: 'DE', license: 'API pública de Autobahn GmbH', url: 'https://verkehr.autobahn.de/o/autobahn/', images: true },
});

const num = (v) => (v == null || v === '' ? NaN : Number(String(v).replace(',', '.')));
const ok = (c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180;

/** Ayuntamiento de Madrid: KML con la imagen en la descripción. */
export function parseMadridKml(kml) {
  const out = [];
  for (const m of String(kml).matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const b = m[1], co = b.match(/<coordinates>\s*([-\d.]+),([-\d.]+)/), img = b.match(/img src=(https:\/\/informo\.madrid\.es\/cameras\/[^\s&"']+)/);
    const id = b.match(/<Data name="Numero">\s*<Value>([^<]+)<\/Value>/)?.[1], name = b.match(/<Data name="Nombre">\s*<Value>([^<]+)<\/Value>/)?.[1];
    const c = { id: `MAD-${id ?? out.length}`, src: 'MADRID', cc: 'ES', lat: num(co?.[2]), lon: num(co?.[1]), name: name?.trim() ?? null, road: null, img: img ? img[1].replace(/\?.*$/, '') : null, page: null, kind: 'TRAFICO' };
    if (ok(c)) out.push(c);
  }
  return out;
}
/** Gobierno Vasco: coordenadas UTM (huso 30, ETRS89) → WGS84. */
export function parseEuskadi(cameras) {
  return (cameras ?? []).map((r) => {
    const x = num(r.longitude), y = num(r.latitude); let lon = NaN, lat = NaN;
    if (x > 1e5 && y > 1e6) [lon, lat] = utmToLonLat(x, y, 30); else { lon = x; lat = y; }
    return { id: `EUS-${r.cameraId}-${r.sourceId}`, src: 'EUSKADI', cc: 'ES', lat: +(+lat).toFixed(6), lon: +(+lon).toFixed(6), name: r.cameraName ?? null, road: r.road ? `${String(r.road).replace(/\s+/g, '')}${r.kilometer ? ` · PK ${r.kilometer}` : ''}` : null, img: null, page: null, kind: 'TRAFICO' };
  }).filter(ok);
}
export function parseRws(list) {
  return (list ?? []).map((r) => ({ id: `RWS-${r.id}`, src: 'RWS', cc: 'NL', lat: num(r.latitude), lon: num(r.longitude), name: r.near ? `${r.road ?? ''} · ${r.near}`.trim() : r.road ?? null, road: r.road ?? null, img: null, page: r.static_url ?? r.stream_url ?? null, kind: 'TRAFICO' })).filter(ok);
}
export function parseBrussels(records) {
  return (records ?? []).map((r) => ({ id: `BXL-${r.id_reg_iot}`, src: 'BRUSSEL', cc: 'BE', lat: num(r.geo_point?.lat), lon: num(r.geo_point?.lon), name: r.name_nl ?? r.name_fr ?? null, road: null, img: null, page: r.url_nl ?? r.url_fr ?? null, kind: 'CIUDAD' })).filter(ok);
}
/** Autobahn GmbH: /o/autobahn/{vía}/services/webcam → { webcam: [...] }. */
export function parseAutobahn(road, json) {
  return (json?.webcam ?? []).map((w) => ({ id: `AB-${w.identifier ?? w.title}`, src: 'AUTOBAHN', cc: 'DE', lat: num(w.coordinate?.lat), lon: num(w.coordinate?.long), name: w.title ?? null, road, img: w.imageurl ?? null, page: w.linkurl ?? null, kind: 'TRAFICO' })).filter(ok);
}
export function fromDgt(list) {
  return (list ?? []).map((c) => ({ id: `DGT-${c.id}`, src: 'DGT', cc: 'ES', lat: c.lat, lon: c.lon, name: c.destino ? `${c.carretera} · ${c.destino}` : c.carretera ?? null, road: c.carretera ?? null, img: c.disponible === false ? null : c.url ?? null, page: null, kind: 'TRAFICO' })).filter(ok);
}
/** Une fuentes quitando duplicados exactos de posición dentro de la misma fuente. */
export function mergeCameras(...lists) {
  const seen = new Set(), out = [];
  for (const c of lists.flat()) { const k = `${c.src}|${c.lat.toFixed(5)}|${c.lon.toFixed(5)}`; if (seen.has(k)) continue; seen.add(k); out.push(c); }
  return out;
}

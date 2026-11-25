/**
 * SENDA · tipos de mapa (como en las apps de mapas conocidas) y geometrías de dibujo.
 *
 * Fuentes (sin clave, gratuitas):
 *  - Vectoriales: OpenFreeMap (estilos liberty / positron / dark), datos © OpenStreetMap (ODbL).
 *  - Satélite: ortofotos OFICIALES — España: PNOA (IGN, servicio TMS, CC BY 4.0 scne.es);
 *    Países Bajos: Luchtfoto Actueel (Kadaster / Beeldmateriaal Nederland vía PDOK, CC BY 4.0).
 *    Fuera de ES y NL no hay ortofoto: se dice en pantalla.
 */
const OFM = 'https://tiles.openfreemap.org/styles';
export const MAP_STYLES = Object.freeze({
  mapa: { label: 'Mapa', url: `${OFM}/liberty` },
  claro: { label: 'Claro', url: `${OFM}/positron` },
  noche: { label: 'Noche', url: `${OFM}/dark` },
  satelite: { label: 'Satélite', url: null },
});

export const ORTHO = Object.freeze({
  es: { bounds: [-18.4, 27.5, 4.6, 44.0], attribution: 'Ortofoto PNOA cedida por © Instituto Geográfico Nacional · CC BY 4.0 scne.es' },
  nl: { bounds: [3.2, 50.7, 7.3, 53.7], attribution: 'Luchtfoto © Kadaster / Beeldmateriaal Nederland (PDOK) · CC BY 4.0' },
});

/** Estilo de satélite con las dos ortofotos oficiales (MapLibre style v8). */
export function satelliteStyle() {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      pnoa: { type: 'raster', tiles: ['https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg'], scheme: 'tms', tileSize: 256, maxzoom: 19, bounds: ORTHO.es.bounds, attribution: ORTHO.es.attribution },
      pdok: { type: 'raster', tiles: ['https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg'], tileSize: 256, maxzoom: 19, bounds: ORTHO.nl.bounds, attribution: ORTHO.nl.attribution },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0b1014' } },
      { id: 'pnoa', type: 'raster', source: 'pnoa' },
      { id: 'pdok', type: 'raster', source: 'pdok' },
    ],
  };
}

/** ¿Hay ortofoto oficial en este punto? */
export function orthoCovers([lon, lat]) {
  return Object.values(ORTHO).some(({ bounds: [w, s, e, n] }) => lon >= w && lon <= e && lat >= s && lat <= n);
}

/** Polígono circular geodésico (aprox. esférica, 64 lados) para dibujar la precisión del GPS en metros. */
export function circlePolygon([lon, lat], radiusM, sides = 64) {
  const R = 6371008.8, d = radiusM / R, φ1 = (lat * Math.PI) / 180, λ1 = (lon * Math.PI) / 180, ring = [];
  for (let i = 0; i <= sides; i++) {
    const θ = (2 * Math.PI * i) / sides;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
    ring.push([(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI]);
  }
  return { type: 'Feature', properties: { radiusM }, geometry: { type: 'Polygon', coordinates: [ring] } };
}

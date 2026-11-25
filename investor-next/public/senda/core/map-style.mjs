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
  satelite: { label: 'Satélite', url: null, note: 'Ortofoto oficial: España (PNOA) y Países Bajos (PDOK)' },
  relieve: { label: 'Relieve', url: null, note: 'Sombreado del terreno (Terrain Tiles en AWS)' },
  topo: { label: 'Topográfico', url: null, note: 'OpenTopoMap · curvas de nivel' },
  dia: { label: 'Satélite del día', url: null, note: 'NASA MODIS Terra, color real, ~250 m, imagen de ayer' },
  termico: { label: 'Térmico', url: null, note: 'NASA MODIS: temperatura de la superficie de día (sin dato bajo nubes)' },
  nubes: { label: 'Nubes', url: null, note: 'NASA MODIS: temperatura de la cima de las nubes' },
  luces: { label: 'Luces nocturnas', url: null, note: 'NASA Black Marble 2016' },
  falso: { label: 'Falso color (incendios)', url: null, note: 'NASA MODIS bandas 7-2-1: zonas quemadas en marrón-rojo, vegetación en verde vivo, agua en azul oscuro' },
  fuego: { label: 'Fuego (VIIRS)', url: null, note: 'NASA VIIRS bandas M11-I2-I1: frentes activos y cicatrices resaltados, ~375 m' },
  vegetacion: { label: 'Vegetación (NDVI)', url: null, note: 'NASA MODIS NDVI de 8 días: más verde = más vegetación viva' },
  nieve: { label: 'Nieve y hielo', url: null, note: 'NASA MODIS bandas 3-6-7: nieve y hielo en rojo-naranja, nubes en blanco' },
  aerosoles: { label: 'Humo y polvo', url: null, note: 'NASA MODIS: espesor óptico de aerosoles (humo, polvo, contaminación)' },
});

/** Etiquetas de lugares (OpenFreeMap) encima de los mapas de imagen, para orientarse. */
const LABELS = {
  source: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  layers: [
    { id: 'lbl-road', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name', minzoom: 12, layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,.75)', 'text-halo-width': 1.4 } },
    { id: 'lbl-place', type: 'symbol', source: 'ofm', 'source-layer': 'place', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 12, 16] }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,.8)', 'text-halo-width': 1.6 } },
  ],
};
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const ATTR = Object.freeze({
  gibs: 'Imágenes de NASA GIBS (ESDIS), sin restricciones de uso',
  terrain: 'Relieve: Terrain Tiles en AWS (Mapzen/Linux Foundation; USGS, SRTM, EU-DEM y otros)',
  otm: 'Mapa © OpenTopoMap (CC BY-SA) · datos © OpenStreetMap',
  osm: '© OpenStreetMap · OpenFreeMap',
});
/** Fecha UTC de AYER (la imagen diaria de hoy aún puede estar incompleta). */
export function gibsDate(now = Date.now()) { return new Date(now - 86_400_000).toISOString().slice(0, 10); }
export const TERRAIN_SOURCE = Object.freeze({ type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 15, attribution: ATTR.terrain });

function rasterOnly(id, tiles, { maxzoom = 9, attribution, bg = '#0b1014', labels = true, extra = [] } = {}) {
  return {
    version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { [id]: { type: 'raster', tiles, tileSize: 256, maxzoom, attribution }, ...(labels ? { ofm: LABELS.source } : {}), ...Object.fromEntries(extra.map((e) => [e.id, e.source])) },
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': bg } }, { id, type: 'raster', source: id }, ...extra.map((e) => e.layer), ...(labels ? LABELS.layers : [])],
  };
}

/** Estilo MapLibre de cada tipo (los de imagen se construyen aquí; los vectoriales son URL de OpenFreeMap). */
export function styleFor(id, { now = Date.now(), date = null } = {}) {
  const d = date ?? gibsDate(now); // `date` (AAAA-MM-DD) fija el día de las imágenes NASA (p. ej. el de un incendio)
  switch (id) {
    case 'satelite': return satelliteStyle();
    case 'topo': return rasterOnly('otm', ['https://tile.opentopomap.org/{z}/{x}/{y}.png'], { maxzoom: 17, attribution: ATTR.otm, labels: false, bg: '#f2efe9' });
    case 'dia': return rasterOnly('modis', [`${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`], { attribution: `${ATTR.gibs} · MODIS Terra ${d}` });
    case 'termico': return rasterOnly('lst', [`${GIBS}/MODIS_Terra_Land_Surface_Temp_Day/default/${d}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`], { maxzoom: 7, attribution: `${ATTR.gibs} · MODIS Terra LST ${d}`, bg: '#111' });
    case 'nubes': return rasterOnly('ctt', [`${GIBS}/MODIS_Terra_Cloud_Top_Temp_Day/default/${d}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`], { maxzoom: 6, attribution: `${ATTR.gibs} · MODIS Terra ${d}`, bg: '#0b1014' });
    case 'falso': return rasterOnly('b721', [`${GIBS}/MODIS_Terra_CorrectedReflectance_Bands721/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`], { attribution: `${ATTR.gibs} · MODIS Terra 7-2-1 ${d}` });
    case 'fuego': return rasterOnly('viirs', [`${GIBS}/VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`], { attribution: `${ATTR.gibs} · VIIRS NOAA-20 ${d}` });
    case 'vegetacion': return rasterOnly('ndvi', [`${GIBS}/MODIS_Terra_NDVI_8Day/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`], { attribution: `${ATTR.gibs} · MODIS NDVI 8 días (${d})`, bg: '#111' });
    case 'nieve': return rasterOnly('b367', [`${GIBS}/MODIS_Terra_CorrectedReflectance_Bands367/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`], { attribution: `${ATTR.gibs} · MODIS Terra 3-6-7 ${d}` });
    case 'aerosoles': return rasterOnly('aod', [`${GIBS}/MODIS_Terra_Aerosol/default/${d}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`], { maxzoom: 6, attribution: `${ATTR.gibs} · MODIS Terra aerosoles ${d}`, bg: '#0b1014' });
    case 'luces': return rasterOnly('bm', [`${GIBS}/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`], { maxzoom: 8, attribution: `${ATTR.gibs} · Black Marble 2016`, bg: '#000' });
    case 'relieve': return {
      version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: { dem: TERRAIN_SOURCE, ofm: LABELS.source },
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eceae4' } },
        { id: 'hillshade', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.85, 'hillshade-shadow-color': '#2a2620', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#5c5345' } },
        { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#8fb8d8', 'fill-opacity': 0.85 } },
        { id: 'roads', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]], paint: { 'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#e8853d', 'primary', '#f2b64c', '#ffffff'], 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 3], 'line-opacity': 0.9 } },
        ...LABELS.layers.map((l) => ({ ...l, paint: { 'text-color': '#2b2b2b', 'text-halo-color': 'rgba(255,255,255,.85)', 'text-halo-width': 1.4 } }))],
    };
    default: return MAP_STYLES[id]?.url ?? MAP_STYLES.mapa.url;
  }
}

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

/**
 * Leyendas con la PALETA OFICIAL de NASA GIBS (colormaps v1.3, consultadas el 2026-11-25):
 *  - MODIS_Land_Surface_Temp.xml (K): <200 → ≥350; MODIS_Cloud_Top_Temp.xml (K): 150 → 350.
 * Se muestran en °C (°C = K − 273,15).
 */
export const LEGENDS = Object.freeze({
  termico: { source: 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Land_Surface_Temp.xml', title: 'Temperatura de la superficie (de día)', stops: [[200, '201,0,255'], [225, '33,0,255'], [250, '0,179,255'], [275, '102,255,18'], [300, '255,253,0'], [325, '255,124,0'], [350, '255,1,0']] },
  nubes: { source: 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Cloud_Top_Temp.xml', title: 'Temperatura de la cima de las nubes', stops: [[185, '102,0,119'], [228, '0,0,100'], [238, '0,0,255'], [248, '0,80,0'], [258, '0,220,0'], [268, '240,190,64'], [278, '122,90,3'], [288, '170,0,0'], [300, '255,0,0']] },
});
export const kToC = (k) => Math.round(k - 273.15);
/** Degradado CSS y etiquetas en °C de una leyenda. */
export function legendCss(id) {
  const L = LEGENDS[id]; if (!L) return null;
  const n = L.stops.length - 1;
  return { title: L.title, source: L.source, gradient: `linear-gradient(90deg,${L.stops.map(([, rgb], i) => `rgb(${rgb}) ${Math.round((i / n) * 100)}%`).join(',')})`, labels: [L.stops[0], L.stops[Math.floor(n / 2)], L.stops[n]].map(([k]) => `${kToC(k)} °C`) };
}

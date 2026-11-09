// SENDA · fire-cases: base de referencia de incendios reales y algoritmos para «entrenar» con ella.
//
// Entrada:
//   - hechos documentados de incendios reales, cada uno con su fuente;
//   - detecciones de satélite GOES-R (ABI L2 FDC, NOAA, dominio público) cada 5–10 minutos;
//   - viento HRRR 3 km (NOAA, dominio público).
// Procesamiento:
//   - progresión medida: frente, área acumulada y potencia radiativa;
//   - velocidad de avance (ROS) por ventanas;
//   - ajuste ROS–viento con validación dejando un incendio fuera;
//   - comparación con la regla del 10 % de Cruz y Alexander (2019).
// Salida: priores calibrados para los conjuntos de propagación y umbrales de evacuación.
//
// Reglas: los datos sin fuente comprobada llevan `verificado: false` y el texto «pendiente de verificar».
// Ningún valor se inventa. Los puntos de entrenamiento salen solo de mediciones (satélite + modelo
// meteorológico); las cifras de prensa sirven de contraste, nunca de dato de entrenamiento.

export const FIRE_SOURCES_REF = {
  nistTn2135: { t: 'NIST TN 2135 · A Case Study of the Camp Fire – Fire Progression Timeline (2021)', url: 'https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.2135.pdf' },
  nistTn2252: { t: 'NIST TN 2252 (suplemento) · Camp Fire: evacuación, atascos y atrapamientos', url: 'https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.2252sup.pdf' },
  nistEscape: { t: 'NIST ESCAPE · consideraciones de evacuación y refugio en incendios de interfaz', url: 'https://escape.nist.gov/evacuation3AddressingFailuresEgresslearnmore1' },
  nistCamp4m5: { t: 'NIST · CAMP 4, módulo 5 (evacuación): cierre de Skyway y atrapamientos', url: 'https://www.nist.gov/document/camp-4-module-5-presentation-slides' },
  nistCamp4: { t: 'NIST · CAMP 4, presentaciones de los módulos (2024)', url: 'https://www.nist.gov/document/camp-4-module-1-presentation-slides' },
  skywayLanes: { t: 'The Week · la vía principal de Paradise se redujo de 4 a 2 carriles (2014)', url: 'https://theweek.com/speedreads/808817/despite-warnings-main-evacuation-route-paradise-narrowed-by-2-lanes' },
  cruzAlexander2019: { t: 'Cruz y Alexander (2019) · La regla del 10 %, Annals of Forest Science 76:44', url: 'https://doi.org/10.1007/s13595-019-0829-8' },
  cruz2012: { t: 'Cruz et al. (2012) · Anatomía del incendio de Kilmore East (Black Saturday), Forest Ecology and Management 284', url: 'https://doi.org/10.1016/j.foreco.2012.02.035' },
  eatonWiki: { t: 'Eaton Fire · cronología con fuentes primarias', url: 'https://en.wikipedia.org/wiki/Eaton_Fire' },
  eatonLaTimes: { t: 'Fire Engineering / LA Times · el fuego avanzaba hacia Altadena oeste horas antes de la orden', url: 'https://www.fireengineering.com/firefighting/wildland-firefighting/report-eaton-fire-marched-toward-west-altadena-hours-before-official-accounts' },
  marshallWiki: { t: 'Marshall Fire · resumen con fuentes del condado de Boulder', url: 'https://en.wikipedia.org/wiki/Marshall_Fire' },
  marshallHomes: { t: 'Colorado Newsline · 1.084 viviendas destruidas', url: 'https://coloradonewsline.com/briefs/1084-homes-louisville-superior-destroyed-marshall-fire-updated-tally/' },
  smokehouseWiki: { t: 'Smokehouse Creek Fire · cifras del Texas A&M Forest Service', url: 'https://en.wikipedia.org/wiki/Smokehouse_Creek_Fire' },
  smokehouseDallas: { t: 'Dallas News · 100 % contenido tras más de un millón de acres', url: 'https://dallasnews.com/news/texas/2024/03/17/largest-wildfire-in-texas-history-100-contained-after-burning-more-than-1-million-acres' },
  palisadesCalfire: { t: 'CAL FIRE · Palisades Fire', url: 'https://www.fire.ca.gov/incidents/2025/1/7/palisades-fire' },
  eatonCalfire: { t: 'CAL FIRE · Eaton Fire', url: 'https://www.fire.ca.gov/incidents/2025/1/7/eaton-fire' },
  campCalfire: { t: 'CAL FIRE · Camp Fire', url: 'https://www.fire.ca.gov/incidents/2018/11/8/camp-fire' },
  kincadeFt2025: { t: 'Fire Technology (2025) · revisión: en Kincade 2019 los evacuados iban ≈ 3,5 km/h más lentos y la capacidad cayó ≈ 5 %', url: 'https://link.springer.com/article/10.1007/s10694-025-01813-y' },
  intini2022: { t: 'Intini et al. (2022) · humo y visibilidad en la evacuación por carretera (WUI-NITY), IJDRR', url: 'https://iris.unisalento.it/handle/11587/488606' },
  lahainaArxiv: { t: 'arXiv 2603.29055 (2026) · ley de conservación escalar de la evacuación de Lahaina', url: 'https://arxiv.org/html/2603.29055v1' },
  goes: { t: 'NOAA GOES-R ABI L2 Fire Detection (FDC), AWS Open Data', url: 'https://registry.opendata.aws/noaa-goes/' },
  hrrr: { t: 'NOAA HRRR 3 km, AWS Open Data', url: 'https://registry.opendata.aws/noaa-hrrr-pds/' },
  miteco: { t: 'MITECO · estadística de grandes incendios forestales', url: 'https://www.miteco.gob.es/es/biodiversidad/temas/incendios-forestales/estadisticas-incendios.html' },
};

// Hechos documentados. `verificado: true` solo cuando la cifra aparece en la fuente citada
// (comprobado en búsquedas del 05/06-11-2026). Lo demás queda «pendiente de verificar».
export const REFERENCE_FIRES = [
  {
    id: 'camp-2018', nombre: 'Camp Fire', pais: 'EE. UU. · California', fecha: '2018-11-08', combustible: 'pinar y matorral; núcleo urbano (Paradise)', satelite: 'goes16',
    hechos: [
      { k: 'superficie', v: '153.336 acres (62.053 ha)', src: 'campCalfire', verificado: true },
      { k: 'muertes', v: '85', src: 'campCalfire', verificado: true },
      { k: 'estructuras destruidas', v: '18.804', src: 'campCalfire', verificado: true },
      { k: 'propagación', v: '≈ 7 millas en 90 min (≈ 7,5 km/h); pavesas ≈ 40 min por delante del frente', src: 'nistCamp4', verificado: false, nota: 'cifra de una presentación de NIST; pendiente de verificar en la TN 2135' },
      { k: 'carreteras', v: 'a las 08:30 el fuego alcanzó el tráfico en Pentz Rd y en la parte alta de Skyway; desde las 10:00 Skyway cerrado al sur para civiles', src: 'nistCamp4m5', verificado: true },
      { k: 'atasco', v: 'el atasco de Chico y el valle remontó Skyway hasta Paradise; varios atrapamientos de evacuados', src: 'nistEscape', verificado: true },
      { k: 'vía', v: 'Skyway reducida de 4 a 2 carriles en 2014', src: 'skywayLanes', verificado: true },
      { k: 'población evacuada', v: '≈ 40.000 personas en las comunidades afectadas', src: 'nistTn2252', verificado: true },
    ],
    leccion: 'La capacidad la decide el cuello de botella aguas abajo (Chico), no la salida del pueblo: SENDA debe vigilar el final de la ruta y avisar antes de que el atasco remonte hacia el fuego.',
  },
  {
    id: 'palisades-2025', nombre: 'Palisades Fire', pais: 'EE. UU. · California', fecha: '2025-01-07', combustible: 'chaparral costero e interfaz urbana', satelite: 'goes18',
    hechos: [
      { k: 'superficie', v: '23.448 acres', src: 'palisadesCalfire', verificado: true },
      { k: 'estructuras destruidas', v: '6.837', src: 'palisadesCalfire', verificado: true },
      { k: 'muertes', v: '12', src: 'palisadesCalfire', verificado: false, nota: 'cifra que varía entre fuentes' },
      { k: 'carreteras', v: '≈ 30 coches abandonados en Palisades Dr y Sunset Blvd apartados con excavadora para abrir paso', src: 'palisadesCalfire', verificado: false, nota: 'documentado en prensa; pendiente de verificar en un informe oficial' },
      { k: 'viento', v: 'rachas de 60–100 mph (Santa Ana)', src: 'palisadesCalfire', verificado: false },
    ],
    leccion: 'Una sola vía de salida colapsa cuando los conductores abandonan el coche: medir velocidad de sondas y conteos de cámara detecta el bloqueo minutos antes y permite abrir alternativas o carriles contrarios.',
  },
  {
    id: 'eaton-2025', nombre: 'Eaton Fire', pais: 'EE. UU. · California', fecha: '2025-01-07', combustible: 'chaparral y barrios de Altadena', satelite: 'goes18',
    hechos: [
      { k: 'superficie', v: '14.021 acres', src: 'eatonCalfire', verificado: true },
      { k: 'estructuras destruidas', v: '9.418', src: 'eatonCalfire', verificado: true },
      { k: 'muertes', v: '17–19', src: 'eatonWiki', verificado: false, nota: 'la cifra cambió con el tiempo' },
      { k: 'ignición', v: '≈ 18:18 hora local (02:18 UTC del 8)', src: 'eatonWiki', verificado: true },
      { k: 'avance inicial', v: '≈ 10 acres a las 18:26; pavesas a ≈ 1 milla a las 18:33; > 1.000 acres a las 00:07', src: 'eatonWiki', verificado: true },
      { k: 'aviso', v: 'Altadena oeste recibió la orden después de las 03:00, aunque el fuego avanzaba hacia allí desde ≈ 21:30', src: 'eatonLaTimes', verificado: true },
    ],
    leccion: 'El fallo fue de umbral de aviso, no de datos: con el frente medido por satélite y el viento del modelo, un umbral dinámico habría avisado horas antes.',
  },
  {
    id: 'marshall-2021', nombre: 'Marshall Fire', pais: 'EE. UU. · Colorado', fecha: '2021-12-30', combustible: 'pasto seco y urbanizaciones', satelite: 'goes16',
    hechos: [
      { k: 'superficie', v: '≈ 6.026 acres (2.439 ha)', src: 'marshallWiki', verificado: true },
      { k: 'viviendas destruidas', v: '1.084', src: 'marshallHomes', verificado: true },
      { k: 'muertes', v: '2', src: 'marshallWiki', verificado: true },
      { k: 'viento', v: 'rachas de 100–115 mph', src: 'marshallWiki', verificado: true },
      { k: 'ignición', v: '≈ 11:00 hora local', src: 'marshallWiki', verificado: true },
    ],
    leccion: 'En pasto con viento extremo el frente supera la regla del 10 %: los priores de SENDA distinguen tipo de combustible.',
  },
  {
    id: 'smokehouse-2024', nombre: 'Smokehouse Creek Fire', pais: 'EE. UU. · Texas', fecha: '2024-02-26', combustible: 'pastizal', satelite: 'goes16',
    hechos: [
      { k: 'superficie', v: '1.058.482 acres (≈ 428.000 ha), el mayor de Texas', src: 'smokehouseWiki', verificado: true },
      { k: 'ignición', v: '14:20 hora local según InciWeb; señal térmica en GOES-18 ya a las 12:56', src: 'smokehouseWiki', verificado: true },
      { k: 'causa', v: 'líneas eléctricas, según los investigadores del estado', src: 'smokehouseWiki', verificado: true },
      { k: 'contención', v: '100 % a mediados de marzo de 2024', src: 'smokehouseDallas', verificado: true },
    ],
    leccion: 'El satélite vio el foco antes que el aviso oficial: SENDA escucha GOES/MTG y lo cruza con el móvil y la cámara para confirmar en minutos.',
  },
  {
    id: 'troublesome-2020', nombre: 'East Troublesome Fire', pais: 'EE. UU. · Colorado', fecha: '2020-10-21', combustible: 'conífera con mortalidad por escarabajo', satelite: 'goes16',
    hechos: [
      { k: 'superficie', v: '≈ 193.800 acres', src: null, verificado: false, nota: 'cifra conocida; pendiente de verificar con InciWeb' },
      { k: 'carrera', v: 'gran carrera hacia el este la tarde y noche del 21 al 22-10-2020', src: null, verificado: false },
    ],
    leccion: 'Una carrera nocturna de conífera seca: SENDA mantiene la vigilancia de noche con satélite, cuando las cámaras ven poco.',
  },
  {
    id: 'creek-2020', nombre: 'Creek Fire', pais: 'EE. UU. · California', fecha: '2020-09-04', combustible: 'conífera de Sierra Nevada', satelite: 'goes16',
    hechos: [
      { k: 'superficie', v: '≈ 379.900 acres', src: null, verificado: false, nota: 'pendiente de verificar con CAL FIRE' },
      { k: 'evacuación', v: 'campistas aislados en Mammoth Pool rescatados por helicóptero', src: null, verificado: false },
    ],
    leccion: 'Cuando la única carretera queda cortada, la salida es aérea: SENDA marca los grupos aislados y su posición para los medios aéreos.',
  },
  {
    id: 'pedrogao-2017', nombre: 'Pedrógão Grande', pais: 'Portugal', fecha: '2017-06-17', combustible: 'eucalipto y pino', satelite: null,
    hechos: [
      { k: 'muertes', v: '66, de ellas 47 en la carretera EN-236-1 o cerca', src: null, verificado: false, nota: 'cifras del informe de la Comisión Técnica Independiente; pendiente de verificar el enlace primario' },
      { k: 'carreteras', v: 'la EN-236-1 no se cerró a tiempo y muchos conductores quedaron atrapados por el fuego', src: null, verificado: false },
    ],
    leccion: 'Cerrar a tiempo es tan importante como evacuar: SENDA cruza la llegada del fuego con la ocupación de cada tramo y propone el cierre antes de que entren coches.',
  },
  {
    id: 'mati-2018', nombre: 'Mati (Ática)', pais: 'Grecia', fecha: '2018-07-23', combustible: 'pinar mediterráneo y urbanización', satelite: null,
    hechos: [
      { k: 'muertes', v: '≈ 100 (varía entre 102 y 104 según la fuente)', src: null, verificado: false },
      { k: 'carreteras', v: 'calles estrechas sin salida; coches atrapados camino de la costa', src: null, verificado: false },
    ],
    leccion: 'Sin rutas alternativas, la orden debe llegar antes: el umbral depende del tiempo de despeje, no solo de la distancia al fuego.',
  },
  {
    id: 'kilmore-2009', nombre: 'Kilmore East (Black Saturday)', pais: 'Australia', fecha: '2009-02-07', combustible: 'eucalipto', satelite: null,
    hechos: [
      { k: 'propagación', v: 'velocidades sostenidas por encima de 5 km/h y pavesas a decenas de kilómetros', src: 'cruz2012', verificado: false, nota: 'pendiente de verificar las cifras exactas en el artículo' },
    ],
    leccion: 'El salto de pavesas adelanta el peligro al frente: el umbral de aviso suma la distancia de pavesas (P90) a la del frente.',
  },
  {
    id: 'lahaina-2023', nombre: 'Lahaina', pais: 'EE. UU. · Hawái', fecha: '2023-08-08', combustible: 'pasto invasor y núcleo urbano', satelite: null,
    hechos: [
      { k: 'muertes', v: '≈ 100', src: null, verificado: false },
      { k: 'tráfico', v: 'un modelo de conservación escalar halla una transición de fase en la capacidad del carril de salida: una vez colapsada, optimizar rutas aporta poco', src: 'lahainaArxiv', verificado: true },
    ],
    leccion: 'La capacidad de la salida manda: SENDA calcula el tiempo de despeje con un modelo de celdas y adelanta la orden mientras la vía aún fluye.',
  },
  {
    id: 'culebra-2022', nombre: 'Sierra de la Culebra', pais: 'España · Zamora', fecha: '2022-06-15', combustible: 'matorral y pinar', satelite: null,
    hechos: [
      { k: 'superficie', v: '24.737,95 ha', src: 'miteco', verificado: false, nota: 'cifra de MITECO recogida en búsqueda; pendiente de verificar el informe' },
      { k: 'muertes', v: '4 (incluidos los incendios de julio en la zona)', src: null, verificado: false },
    ],
    leccion: 'Caso español para calibrar cuando haya perímetros oficiales por hora; hoy no entra en el entrenamiento.',
  },
  {
    id: 'smv-2026', nombre: 'San Martín de Valdeiglesias / Almorox', pais: 'España · Madrid', fecha: '2026-07-23', combustible: 'pasto, matorral y pinar', satelite: 'sentinel2',
    hechos: [
      { k: 'datos', v: 'DEM Copernicus, cicatriz Sentinel-2 (dNBR, 24-07 a 08-08) y GFS, descargados de verdad', src: null, verificado: true },
    ],
    leccion: 'Caso propio de SENDA: la cicatriz real valida el modelo; sirve de contraste fuera de muestra para lo aprendido en EE. UU.',
  },
  {
    id: 'kincade-2019', nombre: 'Kincade (evacuación)', pais: 'EE. UU. · California', fecha: '2019-10-23', combustible: '—', satelite: null,
    hechos: [
      { k: 'tráfico', v: 'evacuados ≈ 3,5 km/h más lentos que el tráfico habitual; capacidad ≈ 5 % menor', src: 'kincadeFt2025', verificado: false, nota: 'cifra citada en una revisión; pendiente de verificar en el estudio original' },
    ],
    leccion: 'Durante una evacuación la vía rinde algo menos de lo normal: el modelo de tráfico de SENDA lo incorpora como prior.',
  },
];

// ── geometría local ────────────────────────────────────────────────────────────
const R_E = 6371.0088, rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
export function localKm(origin, lat, lon) {
  return [rad(lon - origin[1]) * Math.cos(rad(origin[0])) * R_E, rad(lat - origin[0]) * R_E];
}
export function bearingTo(origin, p) { const [x, y] = localKm(origin, p[0], p[1]); return (deg(Math.atan2(x, y)) + 360) % 360; }
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const minutesBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;

/** Tamaño medio del píxel GOES en la zona (km²), a partir de la separación real entre centros vecinos. */
export function goesPixelAreaKm2(frames, origin) {
  const seen = new Map();
  for (const f of frames) for (const d of f.det) seen.set(`${d[0].toFixed(4)},${d[1].toFixed(4)}`, localKm(origin, d[0], d[1]));
  const P = [...seen.values()], dx = [], dy = [];
  for (const p of P) {
    let bx = Infinity, by = Infinity;
    for (const q of P) {
      if (q === p) continue; const ax = Math.abs(q[0] - p[0]), ay = Math.abs(q[1] - p[1]);
      if (ay < 0.35 * ax && ax > 0.3) bx = Math.min(bx, ax);
      if (ax < 0.35 * ay && ay > 0.3) by = Math.min(by, ay);
    }
    if (Number.isFinite(bx)) dx.push(bx); if (Number.isFinite(by)) dy.push(by);
  }
  const sx = dx.length ? median(dx) : 2, sy = dy.length ? median(dy) : 2;
  return { dxKm: sx, dyKm: sy, areaKm2: sx * sy, pixels: P.length };
}

/**
 * Progresión medida a partir de las detecciones de GOES.
 * frames: [{ t: ISO, det: [[lat, lon, frpMW, mask], …] }]
 * Devuelve por fotograma: minutos desde la primera detección, píxeles activos, FRP total (MW),
 * frente a lo largo de la dirección de avance (km, máximo acumulado), área acumulada (km²).
 */
export function goesProgression(frames, { origin = null, dirDeg = null, hrrr = null, windHours = 3 } = {}) {
  const f0 = frames.findIndex((f) => f.det.length);
  if (f0 < 0) return { ok: false, rows: [] };
  const d0 = frames[f0].det;
  const o = origin || [d0.reduce((s, d) => s + d[0], 0) / d0.length, d0.reduce((s, d) => s + d[1], 0) / d0.length];
  const px = goesPixelAreaKm2(frames, o);
  const all = new Map();
  for (const f of frames) for (const d of f.det) all.set(`${d[0].toFixed(4)},${d[1].toFixed(4)}`, d);
  let dir = dirDeg, dirFuente = dirDeg == null ? null : 'dada';
  if (dir == null && hrrr?.length) { // a sotavento: media vectorial del viento HRRR en las primeras horas
    const t0 = Date.parse(frames[f0].t); let sx = 0, sy = 0;
    for (let m = 0; m <= windHours * 60; m += 20) { const w = hrrrAt(hrrr, new Date(t0 + m * 60000).toISOString()); const to = rad(w.fromDeg + 180); sx += Math.sin(to) * w.u10Kmh; sy += Math.cos(to) * w.u10Kmh; }
    dir = (deg(Math.atan2(sx, sy)) + 360) % 360; dirFuente = 'sotavento HRRR';
  }
  if (dir == null) { dirFuente = 'centroide'; // dirección dominante: del origen al centroide de todo lo que ardió
    let sx = 0, sy = 0; for (const d of all.values()) { const [x, y] = localKm(o, d[0], d[1]); sx += x; sy += y; }
    dir = (deg(Math.atan2(sx, sy)) + 360) % 360;
  }
  const ux = Math.sin(rad(dir)), uy = Math.cos(rad(dir));
  const cum = new Set(), rows = []; let runMax = 0;
  for (let k = f0; k < frames.length; k++) {
    const f = frames[k]; let front = 0, frp = 0;
    for (const d of f.det) {
      const [x, y] = localKm(o, d[0], d[1]); front = Math.max(front, x * ux + y * uy); frp += d[2] || 0;
      cum.add(`${d[0].toFixed(4)},${d[1].toFixed(4)}`);
    }
    runMax = Math.max(runMax, front);
    rows.push({ t: f.t, min: minutesBetween(frames[f0].t, f.t), n: f.det.length, frpMW: Math.round(frp), frontKm: +front.toFixed(2), frontMaxKm: +runMax.toFixed(2), cumPixels: cum.size, areaKm2: +(cum.size * px.areaKm2).toFixed(1) });
  }
  return { ok: true, origin: o, dirDeg: +dir.toFixed(1), dirFuente, pixel: px, firstDetection: frames[f0].t, rows };
}

/** Recta por mínimos cuadrados y = a + b·x con error típico de la pendiente. */
export function linfit(xs, ys) {
  const n = xs.length; if (n < 2) return { a: NaN, b: NaN, se: NaN, r2: NaN, n };
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  const b = sxy / sxx, a = my - b * mx; let sse = 0; for (let i = 0; i < n; i++) sse += (ys[i] - a - b * xs[i]) ** 2;
  return { a, b, se: n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : NaN, r2: syy > 0 ? 1 - sse / syy : 1, n };
}

/** Viento HRRR interpolado en el tiempo: velocidad media (km/h), racha, HR y dirección de procedencia. */
export function hrrrAt(hrrr, iso) {
  if (!hrrr?.length) return null; const t = Date.parse(iso);
  let i = hrrr.findIndex((h) => Date.parse(h.validUTC) > t); if (i < 0) i = hrrr.length - 1; const j = Math.max(0, i - 1);
  const a = hrrr[j], b = hrrr[i], span = Date.parse(b.validUTC) - Date.parse(a.validUTC), w = span > 0 ? Math.min(1, Math.max(0, (t - Date.parse(a.validUTC)) / span)) : 0;
  const L = (k) => a[k] + (b[k] - a[k]) * w, u = L('u10'), v = L('v10');
  return { u10Kmh: Math.hypot(u, v) * 3.6, gustKmh: L('gust') * 3.6, rh: L('rh2'), t2: L('t2'), fromDeg: (deg(Math.atan2(-u, -v)) + 360) % 360 };
}

/**
 * Velocidad de avance por ventanas: recta del frente (máximo acumulado) frente al tiempo.
 * Solo ventanas con avance real (frente > 0 al inicio no exigido) y con al menos 4 fotogramas.
 * La incertidumbre mínima es un píxel por ventana (resolución del satélite).
 */
export function rosWindows(prog, hrrr, { windowMin = 60, stepMin = 60, maxMin = Infinity } = {}) {
  const out = [], rows = prog.rows.filter((r) => r.min <= maxMin), pxKm = Math.sqrt(prog.pixel.areaKm2);
  for (let t0 = 0; t0 + windowMin <= (rows.at(-1)?.min ?? 0) + 1e-9; t0 += stepMin) {
    const w = rows.filter((r) => r.min >= t0 && r.min <= t0 + windowMin); if (w.length < 4) continue;
    const f = linfit(w.map((r) => r.min / 60), w.map((r) => r.frontMaxKm)), adv = w.at(-1).frontMaxKm - w[0].frontMaxKm;
    const mid = new Date(Date.parse(prog.firstDetection) + (t0 + windowMin / 2) * 60000).toISOString(), met = hrrrAt(hrrr, mid);
    out.push({ t0Min: t0, t1Min: t0 + windowMin, midUTC: mid, rosKmh: +Math.max(0, f.b).toFixed(2), seKmh: +Math.max(f.se || 0, pxKm / (windowMin / 60)).toFixed(2), advanceKm: +adv.toFixed(2), frontStartKm: w[0].frontMaxKm, r2: +(f.r2 || 0).toFixed(2), ...(met ? { u10Kmh: +met.u10Kmh.toFixed(1), gustKmh: +met.gustKmh.toFixed(1), rh: +met.rh.toFixed(1), windFromDeg: Math.round(met.fromDeg) } : {}) });
  }
  return out;
}

/**
 * Puntos de entrenamiento: ventanas con avance medible (≥ 1 píxel) en la fase de carrera del incendio.
 * Se descartan ventanas sin viento conocido o sin avance: el satélite no distingue un frente parado de
 * uno que avanza menos de un píxel.
 */
export function trainingPoints(caseId, windows) {
  return windows.filter((w) => w.u10Kmh > 0 && w.advanceKm >= 0.9 * Math.min(w.seKmh, 3) && w.rosKmh > 0).map((w) => ({ caso: caseId, ...w }));
}

// ── modelos ROS–viento ─────────────────────────────────────────────────────────
/** Regla del 10 % (Cruz y Alexander 2019): ROS ≈ 0,1 · U10 en las mismas unidades. */
export const tenPercentRule = (u10Kmh) => 0.1 * u10Kmh;

/** Regresión lineal por mínimos cuadrados (ecuaciones normales con un pequeño término de cresta). */
function ols(X, y, ridge = 1e-6) {
  const k = X[0].length, A = Array.from({ length: k }, () => new Array(k).fill(0)), r = new Array(k).fill(0);
  for (let i = 0; i < X.length; i++) for (let a = 0; a < k; a++) { r[a] += X[i][a] * y[i]; for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b]; }
  for (let a = 1; a < k; a++) A[a][a] += ridge;
  const beta = solve(A, r); let sse = 0; for (let i = 0; i < X.length; i++) sse += (y[i] - X[i].reduce((s, x, j) => s + x * beta[j], 0)) ** 2;
  return { beta, sdLog: Math.sqrt(sse / Math.max(1, X.length - k)) };
}
const isGrass = (p) => /pasto/.test(p.combustible || '');

/**
 * Modelos de ROS que se pueden «entrenar» con la base de referencia. Todos trabajan en escala
 * logarítmica (los errores de propagación son multiplicativos). Cada uno devuelve predict(p).
 *  - potencia: ln ROS = a + b·ln U10
 *  - potencia+pasto: añade un término para pastizal
 *  - razon-combustible: ROS = k_combustible · U10 (una «regla del 10 %» aprendida por combustible)
 */
export const ROS_MODELS = {
  potencia: (pts) => { const m = ols(pts.map((p) => [1, Math.log(p.u10Kmh)]), pts.map((p) => Math.log(p.rosKmh))); return { ...m, predict: (p) => Math.exp(m.beta[0] + m.beta[1] * Math.log(Math.max(1, p.u10Kmh))) }; },
  'potencia+pasto': (pts) => { const m = ols(pts.map((p) => [1, Math.log(p.u10Kmh), isGrass(p) ? 1 : 0]), pts.map((p) => Math.log(p.rosKmh))); return { ...m, predict: (p) => Math.exp(m.beta[0] + m.beta[1] * Math.log(Math.max(1, p.u10Kmh)) + m.beta[2] * (isGrass(p) ? 1 : 0)) }; },
  'razon-combustible': (pts) => {
    const g = pts.filter(isGrass), o = pts.filter((p) => !isGrass(p)), all = pts.reduce((s, p) => s + Math.log(p.rosKmh / p.u10Kmh), 0) / pts.length;
    const lk = (a) => (a.length ? a.reduce((s, p) => s + Math.log(p.rosKmh / p.u10Kmh), 0) / a.length : all), kg = lk(g), ko = lk(o);
    const res = pts.map((p) => Math.log(p.rosKmh / p.u10Kmh) - (isGrass(p) ? kg : ko)), sdLog = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / Math.max(1, pts.length - 2));
    return { beta: [Math.exp(kg), Math.exp(ko)], kPasto: Math.exp(kg), kOtros: Math.exp(ko), sdLog, predict: (p) => (isGrass(p) ? Math.exp(kg) : Math.exp(ko)) * p.u10Kmh };
  },
};
/**
 * Regla del 10 % actualizada por Bayes (normal en ln k): prior k = 0,10 (Cruz y Alexander 2019) con
 * σ = 0,5 en logaritmo (supuesto: un factor ≈ 1,65), y cada medida pesa según su error (resolución del
 * píxel frente a la velocidad medida) más un error de modelo. Con pocos incendios no sobreajusta:
 * si no hay datos de un combustible, se queda en la regla publicada.
 */
export function bayesRatio(pts, { priorK = 0.1, priorSdLog = 0.5, modelSdLog = 0.5 } = {}) {
  const post = (arr) => {
    let prec = 1 / priorSdLog ** 2, num = Math.log(priorK) * prec;
    for (const p of arr) { const sm = Math.min(1.5, (p.resolucionKmh || 0) / Math.max(p.rosKmh, 1e-6)), v = sm * sm + modelSdLog ** 2; prec += 1 / v; num += Math.log(p.rosKmh / p.u10Kmh) / v; }
    const m = num / prec, sd = Math.sqrt(1 / prec); return { k: Math.exp(m), sdLog: sd, predSdLog: Math.sqrt(sd * sd + modelSdLog ** 2), n: arr.length };
  };
  const g = post(pts.filter(isGrass)), o = post(pts.filter((p) => !isGrass(p)));
  return { pasto: g, otros: o, beta: [g.k, o.k], sdLog: Math.max(g.predSdLog, o.predSdLog), predict: (p) => (isGrass(p) ? g.k : o.k) * p.u10Kmh };
}
ROS_MODELS['bayes-10%'] = (pts) => bayesRatio(pts);

/** Compatibilidad: ajuste potencial (con HR opcional). */
export function fitRosModel(points, { useRh = false } = {}) {
  const m = ols(points.map((p) => (useRh ? [1, Math.log(p.u10Kmh), p.rh] : [1, Math.log(p.u10Kmh)])), points.map((p) => Math.log(p.rosKmh)));
  return { ...m, useRh, n: points.length, predict: (u10Kmh, rh = 20) => Math.exp(m.beta[0] + m.beta[1] * Math.log(Math.max(1, u10Kmh)) + (useRh ? m.beta[2] * rh : 0)) };
}
function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Validación dejando un INCENDIO fuera (no un punto): se ajusta con los demás incendios y se
 * predice el excluido. Así se mide de verdad la capacidad de generalizar a un incendio nuevo.
 * Siempre se compara con la regla del 10 % y con la media (predecir siempre lo mismo).
 */
export function leaveOneFireOut(points, { models = ['razon-combustible'] } = {}) {
  const cases = [...new Set(points.map((p) => p.caso))], res = [];
  for (const c of cases) {
    const train = points.filter((p) => p.caso !== c), test = points.filter((p) => p.caso === c);
    if (new Set(train.map((p) => p.caso)).size < 2) continue;
    const fits = Object.fromEntries(models.map((m) => [m, ROS_MODELS[m](train)])), meanLog = train.reduce((s, p) => s + Math.log(p.rosKmh), 0) / train.length;
    for (const p of test) res.push({ caso: c, obs: p.rosKmh, u10Kmh: p.u10Kmh, regla10: tenPercentRule(p.u10Kmh), media: Math.exp(meanLog), ...Object.fromEntries(models.map((m) => [m, fits[m].predict(p)])) });
  }
  const N = Math.max(1, res.length);
  const score = (k) => ({
    maeKmh: +(res.reduce((s, r) => s + Math.abs(r[k] - r.obs), 0) / N).toFixed(2),
    maeLog: +(res.reduce((s, r) => s + Math.abs(Math.log(r[k] / r.obs)), 0) / N).toFixed(3),
    dentroDeX2: +(res.filter((r) => r[k] / r.obs <= 2 && r.obs / r[k] <= 2).length / N).toFixed(2),
    sesgoLog: +(res.reduce((s, r) => s + Math.log(r[k] / r.obs), 0) / N).toFixed(3),
  });
  return { n: res.length, casos: cases.length, preds: res.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(2) : v]))), scores: Object.fromEntries([...models, 'regla10', 'media'].map((k) => [k, score(k)])) };
}

/** Prior para los conjuntos de propagación: ROS esperado y dispersión logarítmica aprendidos. */
export function ensemblePrior(model, { u10Kmh, rh = 20, combustible = 'matorral/bosque', ros0Kmh = null } = {}) {
  const ros = model.predict.length >= 2 ? model.predict(u10Kmh, rh) : model.predict({ u10Kmh, rh, combustible });
  return { rosKmh: +ros.toFixed(2), sdLog: +model.sdLog.toFixed(3), p10Kmh: +(ros * Math.exp(-1.2816 * model.sdLog)).toFixed(2), p90Kmh: +(ros * Math.exp(1.2816 * model.sdLog)).toFixed(2), ...(ros0Kmh ? { rosMult: +(ros / ros0Kmh).toFixed(3) } : {}) };
}

/** Distancia (km) a un punto del primer píxel detectado en cada fotograma: cuándo el fuego se acercó. */
export function approachSeries(frames, target) {
  return frames.filter((f) => f.det.length).map((f) => {
    let dmin = Infinity; for (const d of f.det) { const [x, y] = localKm(target, d[0], d[1]); dmin = Math.min(dmin, Math.hypot(x, y)); }
    return { t: f.t, distKm: +dmin.toFixed(2) };
  });
}
/** Primer instante en que el fuego (píxel más cercano) queda a ≤ dKm del punto. */
export function firstWithin(series, dKm) { return series.find((s) => s.distKm <= dKm)?.t ?? null; }

/**
 * Tramos de avance: ajuste por trozos del frente frente al tiempo (programación dinámica, hasta
 * `maxSegs` tramos de al menos `minSegMin` minutos) con penalización tipo BIC. Separa la «carrera»
 * inicial de las fases lentas sin elegir ventanas a mano. Cada tramo da su ROS y su viento medio.
 */
export function runSegments(prog, hrrr, { maxSegs = 3, minSegMin = 90, endMin = Infinity } = {}) {
  const rows = prog.rows.filter((r) => r.min <= endMin), n = rows.length, x = rows.map((r) => r.min / 60), y = rows.map((r) => r.frontMaxKm);
  const sse = (i, j) => { const f = linfit(x.slice(i, j + 1), y.slice(i, j + 1)); let s = 0; for (let k = i; k <= j; k++) s += (y[k] - f.a - f.b * x[k]) ** 2; return s; };
  const ok = (i, j) => rows[j].min - rows[i].min >= minSegMin - 1e-9 && j - i >= 3;
  const best = [];
  for (let K = 1; K <= maxSegs; K++) {
    const D = Array.from({ length: K + 1 }, () => new Array(n).fill(Infinity)), B = Array.from({ length: K + 1 }, () => new Array(n).fill(-1));
    for (let j = 0; j < n; j++) if (ok(0, j)) D[1][j] = sse(0, j);
    for (let k = 2; k <= K; k++) for (let j = 0; j < n; j++) for (let i = 1; i <= j; i++) if (Number.isFinite(D[k - 1][i - 1]) && ok(i, j)) { const v = D[k - 1][i - 1] + sse(i, j); if (v < D[k][j]) { D[k][j] = v; B[k][j] = i; } }
    if (!Number.isFinite(D[K][n - 1])) continue;
    const cuts = []; let j = n - 1; for (let k = K; k >= 1; k--) { const i = k === 1 ? 0 : B[k][j]; cuts.unshift([i, j]); j = i - 1; }
    const bic = n * Math.log(Math.max(D[K][n - 1], 1e-6) / n) + 2 * K * Math.log(n); best.push({ K, bic, cuts });
  }
  const pick = best.sort((a, b) => a.bic - b.bic)[0], pxKm = Math.sqrt(prog.pixel.areaKm2);
  return pick.cuts.map(([i, j], s) => {
    const f = linfit(x.slice(i, j + 1), y.slice(i, j + 1)), h = x[j] - x[i], ws = rows.slice(i, j + 1).map((r) => hrrrAt(hrrr, r.t)).filter(Boolean);
    const mean = (k) => (ws.length ? ws.reduce((t, w) => t + w[k], 0) / ws.length : NaN);
    return { tramo: s + 1, t0Min: rows[i].min, t1Min: rows[j].min, horas: +h.toFixed(2), avanceKm: +(y[j] - y[i]).toFixed(2), rosKmh: +Math.max(0, f.b).toFixed(2), resolucionKmh: +(pxKm / h).toFixed(2), u10Kmh: +mean('u10Kmh').toFixed(1), gustKmh: +mean('gustKmh').toFixed(1), rh: +mean('rh').toFixed(1), resuelto: f.b > pxKm / h };
  });
}

/**
 * Calibración de la incertidumbre de la regla del 10 %: residuos r = ln(ROS / 0,1·U10).
 * La mediana corregida es 0,1·U10·e^μ y el intervalo, e^(μ ± z·σ). Es lo que se aprende de verdad
 * con pocos incendios: el sesgo y la dispersión, no una ley nueva.
 */
export function calibrateRule(points) {
  const r = points.map((p) => Math.log(p.rosKmh / tenPercentRule(p.u10Kmh))), n = r.length, mu = r.reduce((a, b) => a + b, 0) / n;
  const sigma = Math.sqrt(r.reduce((a, x) => a + (x - mu) ** 2, 0) / Math.max(1, n - 1));
  const sPred = sigma * Math.sqrt(1 + 1 / n); // incertidumbre predictiva: dispersión + error de la media
  return {
    mu: +mu.toFixed(3), sigma: +sigma.toFixed(3), sigmaPred: +sPred.toFixed(3), n, factorMediana: +Math.exp(mu).toFixed(2),
    predict: (u10Kmh, z = 0) => tenPercentRule(u10Kmh) * Math.exp(mu + z * sigma),
    /** Intervalo predictivo con t de Student (pocos incendios ⇒ colas más anchas). */
    interval: (u10Kmh, level = 0.8) => { const q = tQuantile(n - 1, level); return { lo: tenPercentRule(u10Kmh) * Math.exp(mu - q * sPred), mediana: tenPercentRule(u10Kmh) * Math.exp(mu), hi: tenPercentRule(u10Kmh) * Math.exp(mu + q * sPred), q }; },
  };
}
const T_TABLE = { 0.8: [3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372], 0.9: [6.314, 2.92, 2.353, 2.132, 2.015, 1.943, 1.895, 1.86, 1.833, 1.812] };
/** Cuantil bilateral de la t de Student para el nivel 0,8 o 0,9 (tabla; normal para gl > 30). */
export function tQuantile(df, level = 0.8) {
  const t = T_TABLE[level] || T_TABLE[0.8], zInf = level === 0.9 ? 1.6449 : 1.2816;
  if (df < 1) return t[0]; if (df <= 10) return t[df - 1]; if (df >= 30) return zInf;
  return t[9] + ((zInf - t[9]) * (df - 10)) / 20; // interpolación suave entre 10 y 30 gl
}

/** Cobertura fuera de muestra del intervalo central (por defecto 80 %), dejando un incendio fuera. */
export function looCoverage(points, { level = 0.8 } = {}) {
  const cases = [...new Set(points.map((p) => p.caso))]; let inside = 0, n = 0;
  const rows = [];
  for (const c of cases) {
    const train = points.filter((p) => p.caso !== c); if (train.length < 2) continue; const cal = calibrateRule(train);
    for (const p of points.filter((q) => q.caso === c)) { const I = cal.interval(p.u10Kmh, level), ok = p.rosKmh >= I.lo && p.rosKmh <= I.hi; inside += ok; n++; rows.push({ caso: c, obs: p.rosKmh, lo: +I.lo.toFixed(2), mediana: +I.mediana.toFixed(2), hi: +I.hi.toFixed(2), dentro: ok }); }
  }
  return { nivel: level, cobertura: +(inside / Math.max(1, n)).toFixed(2), n, rows };
}

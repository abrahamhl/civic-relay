/**
 * SENDA RoadSafe · Dataset armonizado de accidentes (España, Alemania, Países Bajos; Bélgica preparado).
 *
 * Esquema común `senda-road-accident/1`. Cada adaptador traduce los CÓDIGOS OFICIALES de su fuente,
 * verificados contra el diccionario publicado:
 *  - ES · DGT, microdatos de accidentes con víctimas (TABLA_ACCIDENTES_YY.XLSX + Diccionario_Tabla_Accidentes.xlsx).
 *    Sin coordenadas: carretera + PK + sentido. Gravedad a 30 días.
 *  - DE · Destatis/Statistische Ämter, Unfallatlas «Unfallorte» (CSV, DSB_Unfallatlas.pdf). Solo accidentes
 *    con daños personales; coordenadas WGS84. Licencia Datenlizenz Deutschland – Namensnennung 2.0.
 *  - NL · Rijkswaterstaat, BRON (WFS `verkeersongevallen_nederland:ongevallen_YYYY`, CSV). Incluye accidentes
 *    solo con daños materiales (PDO); coordenadas RD New (EPSG:28992). CC0.
 *  - BE · Statbel: el portal exige superar un captcha anti-bots; NO se elude. Adaptador listo para un fichero
 *    descargado manualmente, con mapeo de columnas declarado como NO VERIFICADO.
 *
 * Comparabilidad: las definiciones de gravedad y la cobertura difieren (NL incluye PDO; DE y ES solo con
 * víctimas). Toda comparación entre países debe filtrar a accidentes con víctimas y leerse como indicativa.
 */

export const DATASET_SCHEMA = 'senda-road-accident/1';
export const SOURCES = Object.freeze({
  ES_DGT: { country: 'ES', publisher: 'Dirección General de Tráfico', url: 'https://www.dgt.es/menusecundario/dgt-en-cifras/dgt-en-cifras-resultados/dgt-en-cifras-detalle/Ficheros-de-microdatos-de-accidentes-con-victimas-2024/', license: 'Reutilización según el aviso legal de la DGT / datos.gob.es (verificar condiciones exactas)', coverage: 'accidentes con víctimas', coords: false },
  DE_UNFALLATLAS: { country: 'DE', publisher: 'Statistische Ämter des Bundes und der Länder', url: 'https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/', license: 'Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0)', coverage: 'accidentes con daños personales', coords: true },
  NL_BRON: { country: 'NL', publisher: 'Rijkswaterstaat (BRON)', url: 'https://data.overheid.nl/dataset/53580-verkeersongevallen-nederland----ongevallen--rws-', license: 'CC0 1.0', coverage: 'todos los registrados (incluye solo daños materiales)', coords: true },
  BE_STATBEL: { country: 'BE', publisher: 'Statbel', url: 'https://statbel.fgov.be/en/themes/mobility/traffic/road-accidents', license: 'Open data Statbel (verificar)', coverage: 'accidentes con víctimas', coords: 'parcial', blocked: 'Captcha anti-bots en el portal; descarga manual necesaria' },
});
export const ENUMS = Object.freeze({
  collision: ['REAR_END', 'STATIONARY_VEHICLE', 'MULTI_VEHICLE_CHAIN', 'HEAD_ON', 'SIDE', 'PEDESTRIAN', 'OBSTACLE', 'RUN_OFF_ROAD', 'ANIMAL', 'ROLLOVER', 'OTHER', 'UNKNOWN'],
  severity: ['FATAL', 'SERIOUS', 'SLIGHT', 'INJURY', 'PDO', 'UNKNOWN'], // INJURY = con heridos sin distinguir gravedad (BRON)
  light: ['DAY', 'TWILIGHT', 'DARK_LIT', 'DARK_UNLIT', 'DARK', 'UNKNOWN'],
  surface: ['DRY', 'WET', 'ICE_SNOW', 'OTHER', 'UNKNOWN'],
  weather: ['CLEAR', 'RAIN', 'SNOW_HAIL', 'FOG', 'WIND', 'OTHER', 'UNKNOWN'],
  roadClass: ['MOTORWAY', 'DUAL_CARRIAGEWAY', 'SINGLE_CARRIAGEWAY', 'URBAN_STREET', 'RAMP', 'OTHER', 'UNKNOWN'],
  area: ['URBAN', 'RURAL', 'UNKNOWN'],
});

// ------------------------------------------------------------------ CSV
/** Parser CSV con comillas, separador configurable y BOM. Devuelve objetos por cabecera. */
export function parseCsv(text, { sep = null, maxRows = Infinity } = {}) {
  if (typeof text !== 'string') throw new TypeError('CSV: texto requerido');
  const t = text.replace(/^﻿/, '');
  const firstLine = t.slice(0, t.indexOf('\n') === -1 ? t.length : t.indexOf('\n'));
  const S = sep ?? ((firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',');
  const rows = []; let field = '', row = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; continue; }
    if (c === '"') q = true; else if (c === S) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; if (rows.length > maxRows) break; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// ------------------------------------------------------------------ RD New → WGS84
/**
 * Conversión aproximada RD New (EPSG:28992) → WGS84 con las series polinómicas de Schreutelkamp y
 * Strang van Hees (precisión del orden de 1 m, suficiente para estadística de puntos negros).
 */
export function rdToWgs84(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const dX = (x - 155000) * 1e-5, dY = (y - 463000) * 1e-5;
  const Kp = [[0, 1, 3235.65389], [2, 0, -32.58297], [0, 2, -0.2475], [2, 1, -0.84978], [0, 3, -0.0655], [2, 2, -0.01709], [1, 0, -0.00738], [4, 0, 0.0053], [2, 3, -0.00039], [4, 1, 0.00033], [1, 1, -0.00012]];
  const Lp = [[1, 0, 5260.52916], [1, 1, 105.94684], [1, 2, 2.45656], [3, 0, -0.81885], [1, 3, 0.05594], [3, 1, -0.05607], [0, 1, 0.01199], [3, 2, -0.00256], [1, 4, 0.00128], [0, 2, 0.00022], [2, 0, -0.00022], [5, 0, 0.00026]];
  let lat = 52.1551744, lon = 5.38720621;
  for (const [p, q, k] of Kp) lat += (k * dX ** p * dY ** q) / 3600;
  for (const [p, q, l] of Lp) lon += (l * dX ** p * dY ** q) / 3600;
  return { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
}

const num = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const blank = () => ({ schema: DATASET_SCHEMA, country: null, source: null, sourceId: null, year: null, month: null, weekday: null, hour: null, lat: null, lon: null, coordQuality: 'NONE', road: null, km: null, direction: null, roadClass: 'UNKNOWN', area: 'UNKNOWN', light: 'UNKNOWN', surface: 'UNKNOWN', weather: 'UNKNOWN', fog: null, collision: 'UNKNOWN', severity: 'UNKNOWN', fatalities: null, seriouslyInjured: null, slightlyInjured: null, vehicles: null, involves: {}, speedLimitKmh: null, visibilityRestrictedByVehicle: null, secondaryIndicator: null, intersection: null, curve: null });

// ------------------------------------------------------------------ ES · DGT
const ES_COLLISION = { 1: 'HEAD_ON', 2: 'SIDE', 3: 'SIDE', 4: 'REAR_END', 5: 'MULTI_VEHICLE_CHAIN', 6: 'OBSTACLE', 7: 'PEDESTRIAN', 8: 'ANIMAL', 9: 'ROLLOVER', 10: 'OTHER', 11: 'RUN_OFF_ROAD', 12: 'RUN_OFF_ROAD', 13: 'RUN_OFF_ROAD', 14: 'RUN_OFF_ROAD', 15: 'RUN_OFF_ROAD', 16: 'RUN_OFF_ROAD', 17: 'RUN_OFF_ROAD', 18: 'RUN_OFF_ROAD', 19: 'RUN_OFF_ROAD', 20: 'OTHER' };
const ES_ROAD = { 1: 'MOTORWAY', 2: 'MOTORWAY', 3: 'MOTORWAY', 4: 'SINGLE_CARRIAGEWAY', 5: 'DUAL_CARRIAGEWAY', 6: 'SINGLE_CARRIAGEWAY', 7: 'OTHER', 8: 'RAMP', 9: 'URBAN_STREET', 10: 'OTHER', 11: 'OTHER', 12: 'OTHER', 13: 'OTHER', 14: 'OTHER' };
const ES_LIGHT = { 1: 'DAY', 2: 'TWILIGHT', 3: 'TWILIGHT', 4: 'DARK_LIT', 5: 'DARK_UNLIT', 6: 'DARK_UNLIT' };
const ES_SURFACE = { 1: 'DRY', 2: 'OTHER', 3: 'WET', 4: 'WET', 5: 'ICE_SNOW', 6: 'ICE_SNOW', 7: 'OTHER', 8: 'OTHER' };
const ES_WEATHER = { 1: 'CLEAR', 2: 'CLEAR', 3: 'RAIN', 4: 'RAIN', 5: 'SNOW_HAIL', 6: 'SNOW_HAIL' };
export function fromDgt(r) {
  const o = blank(); o.country = 'ES'; o.source = 'ES_DGT'; o.sourceId = String(r.ID_ACCIDENTE);
  o.year = num(r.ANYO); o.month = num(r.MES); o.weekday = num(r.DIA_SEMANA); o.hour = num(r.HORA); // DGT: 1 = lunes (ISO)
  o.road = r.CARRETERA && !/^no inventariada$/i.test(String(r.CARRETERA).trim()) ? String(r.CARRETERA).trim() || null : null; // «No inventariada» no es una vía
  o.km = num(r.KM); o.direction = { 1: 'ASC', 2: 'DESC', 3: 'BOTH' }[num(r.SENTIDO_1F)] ?? null;
  o.coordQuality = o.road && o.km != null ? 'ROAD_PK' : 'NONE';
  o.roadClass = ES_ROAD[num(r.TIPO_VIA)] ?? 'UNKNOWN'; o.area = { 1: 'RURAL', 2: 'URBAN' }[num(r.ZONA_AGRUPADA)] ?? 'UNKNOWN';
  o.light = ES_LIGHT[num(r.CONDICION_ILUMINACION)] ?? 'UNKNOWN'; o.surface = ES_SURFACE[num(r.CONDICION_FIRME)] ?? 'UNKNOWN';
  const fog = num(r.CONDICION_NIEBLA); o.fog = fog === 1 || fog === 2 ? true : null;
  o.weather = fog ? 'FOG' : ES_WEATHER[num(r.CONDICION_METEO)] ?? 'UNKNOWN';
  o.collision = ES_COLLISION[num(r.TIPO_ACCIDENTE)] ?? 'UNKNOWN';
  o.fatalities = num(r.TOTAL_MU30DF); o.seriouslyInjured = num(r.TOTAL_HG30DF); o.slightlyInjured = num(r.TOTAL_HL30DF); o.vehicles = num(r.TOTAL_VEHICULOS);
  o.severity = o.fatalities > 0 ? 'FATAL' : o.seriouslyInjured > 0 ? 'SERIOUS' : o.slightlyInjured > 0 ? 'SLIGHT' : 'UNKNOWN';
  o.visibilityRestrictedByVehicle = num(r.VISIB_RESTRINGIDA_POR) === 9 ? true : num(r.VISIB_RESTRINGIDA_POR) == null || num(r.VISIB_RESTRINGIDA_POR) >= 18 ? null : false;
  o.intersection = { 1: true, 2: false }[num(r.NUDO)] ?? null; o.curve = { 1: false, 2: true, 3: true }[num(r.TRAZADO_PLANTA)] ?? null;
  return o;
}

// ------------------------------------------------------------------ DE · Unfallatlas
const DE_COLLISION = { 1: 'STATIONARY_VEHICLE', 2: 'REAR_END', 3: 'SIDE', 4: 'HEAD_ON', 5: 'SIDE', 6: 'PEDESTRIAN', 7: 'OBSTACLE', 8: 'RUN_OFF_ROAD', 9: 'RUN_OFF_ROAD', 0: 'OTHER' };
export function fromUnfallatlas(r) {
  const o = blank(); o.country = 'DE'; o.source = 'DE_UNFALLATLAS'; o.sourceId = String(r.UIDENTSTLAE ?? r.OID_);
  o.year = num(r.UJAHR); o.month = num(r.UMONAT); o.hour = num(r.USTUNDE);
  const wd = num(r.UWOCHENTAG); o.weekday = wd == null ? null : wd === 1 ? 7 : wd - 1; // Destatis 1=domingo → ISO
  o.lat = num(r.YGCSWGS84); o.lon = num(r.XGCSWGS84); o.coordQuality = o.lat != null ? 'POINT' : 'NONE';
  o.light = { 0: 'DAY', 1: 'TWILIGHT', 2: 'DARK' }[num(r.ULICHTVERH)] ?? 'UNKNOWN';
  const sz = r.IstStrassenzustand ?? r.STRZUSTAND ?? r.USTRZUSTAND; o.surface = { 0: 'DRY', 1: 'WET', 2: 'ICE_SNOW' }[num(sz)] ?? 'UNKNOWN';
  o.collision = DE_COLLISION[num(r.UART)] ?? 'UNKNOWN';
  o.severity = { 1: 'FATAL', 2: 'SERIOUS', 3: 'SLIGHT' }[num(r.UKATEGORIE)] ?? 'UNKNOWN';
  o.involves = { bicycle: num(r.IstRad) === 1, car: num(r.IstPKW) === 1, pedestrian: num(r.IstFuss) === 1, motorcycle: num(r.IstKrad) === 1, hgv: num(r.IstGkfz) === 1 };
  o.secondaryIndicator = num(r.UTYP1) === 5 ? 'STATIONARY_TRAFFIC_TYPE' : null; // Unfalltyp 5 = Unfall durch ruhenden Verkehr
  return o;
}

// ------------------------------------------------------------------ NL · BRON
const NL_COLLISION = { 'Kop/staart': 'REAR_END', 'Flank': 'SIDE', 'Frontaal': 'HEAD_ON', 'Vast voorwerp': 'OBSTACLE', 'Los voorwerp': 'OBSTACLE', 'Eenzijdig': 'RUN_OFF_ROAD', 'Voetganger': 'PEDESTRIAN', 'Dier': 'ANIMAL', 'Geparkeerd voertuig': 'STATIONARY_VEHICLE' };
export function fromBron(r) {
  const o = blank(); o.country = 'NL'; o.source = 'NL_BRON'; o.sourceId = String(r.verkeersongeval_nummer ?? r.FID);
  o.year = num(r.jaar_ongeval);
  const m = /POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)/.exec(r.shape ?? ''); const ll = m ? rdToWgs84(+m[1], +m[2]) : null;
  if (ll) { o.lat = ll.lat; o.lon = ll.lon; o.coordQuality = 'POINT_RD_APPROX'; }
  o.severity = { 'Dodelijk': 'FATAL', 'Letsel': 'INJURY', 'Uitsluitend materiele schade': 'PDO' }[r.verkeersongeval_afloop] ?? 'UNKNOWN'; // BRON no distingue grave/leve en este campo
  o.collision = NL_COLLISION[r.aard_ongeval] ?? (r.aard_ongeval === 'Onbekend' ? 'UNKNOWN' : 'OTHER');
  o.light = { 'Daglicht': 'DAY', 'Schemer': 'TWILIGHT', 'Duisternis': 'DARK' }[r.lichtgesteldheid] ?? 'UNKNOWN';
  o.surface = { 'Droog': 'DRY', 'Nat': 'WET', 'Sneeuw/ijzel': 'ICE_SNOW' }[r.wegdek] ?? 'UNKNOWN';
  const w = r.weersgesteldheid ?? ''; o.weather = /Mist/.test(w) ? 'FOG' : /Sneeuw|Hagel/.test(w) ? 'SNOW_HAIL' : /Regen/.test(w) ? 'RAIN' : /windstoten/.test(w) ? 'WIND' : w === 'Droog' ? 'CLEAR' : 'UNKNOWN'; o.fog = /Mist/.test(w) || null;
  o.area = { 'Binnen': 'URBAN', 'Buiten': 'RURAL' }[r.bebouwde_kom] ?? 'UNKNOWN';
  o.speedLimitKmh = num(r.maximum_snelheid);
  o.roadClass = /gescheiden rijbanen/.test(r.wegsituatie ?? '') ? 'DUAL_CARRIAGEWAY' : /strook op \(auto\)snelweg/.test(r.wegsituatie ?? '') || (o.speedLimitKmh ?? 0) >= 100 ? 'MOTORWAY' : o.area === 'URBAN' ? 'URBAN_STREET' : o.area === 'RURAL' ? 'SINGLE_CARRIAGEWAY' : 'UNKNOWN';
  o.intersection = /Kruispunt|Rotonde/.test(r.wegsituatie ?? '') ? true : r.wegsituatie ? false : null; o.curve = r.wegsituatie === 'Bocht' ? true : r.wegsituatie ? false : null;
  const tmp = r.bijz_tijdelijke_aard ?? ''; o.secondaryIndicator = tmp === 'Ander ongeval' ? 'OTHER_ACCIDENT' : tmp === 'File' ? 'QUEUE' : /afsluiting/.test(tmp) ? 'TEMP_CLOSURE' : /Werk in uitvoering/.test(tmp) ? 'ROADWORKS' : null;
  const parties = [r.partij_1_objecttype, r.partij_2_objecttype];
  o.involves = { car: parties.includes('Personenauto'), bicycle: parties.includes('Fiets'), pedestrian: parties.includes('Voetganger'), motorcycle: parties.includes('Motor'), hgv: parties.includes('Vrachtauto') };
  o.road = r.straatnaam || null;
  return o;
}

// ------------------------------------------------------------------ BE · Statbel (mapeo NO VERIFICADO)
/** Columnas declaradas como hipótesis; el constructor rechaza el fichero si no las encuentra. */
export const STATBEL_COLUMNS_UNVERIFIED = Object.freeze({ year: 'DT_YEAR_COLLISION', hour: 'DT_HOUR', light: 'TX_LIGHT_COND_DESCR_FR', road: 'TX_ROAD_TYPE_DESCR_FR', severity: 'TX_CLASS_ACCIDENTS_DESCR_FR' });
export function fromStatbel(r, columns = STATBEL_COLUMNS_UNVERIFIED) {
  for (const c of Object.values(columns)) if (!(c in r)) throw new Error(`Statbel: columna ${c} no encontrada — el mapeo no está verificado; ajústalo con el diccionario oficial`);
  const o = blank(); o.country = 'BE'; o.source = 'BE_STATBEL'; o.year = num(r[columns.year]); o.hour = num(r[columns.hour]);
  o.unverifiedMapping = true; return o;
}

/** Validación de un registro armonizado. */
export function validateRecord(o) {
  const e = [];
  if (o.schema !== DATASET_SCHEMA) e.push('schema');
  for (const [k, vals] of Object.entries(ENUMS)) if (!vals.includes(o[k])) e.push(`${k}=${o[k]}`);
  if (o.lat != null && (o.lat < -90 || o.lat > 90)) e.push('lat'); if (o.lon != null && (o.lon < -180 || o.lon > 180)) e.push('lon');
  if (o.hour != null && (o.hour < 0 || o.hour > 23)) e.push('hour'); if (o.weekday != null && (o.weekday < 1 || o.weekday > 7)) e.push('weekday');
  return { valid: e.length === 0, errors: e };
}

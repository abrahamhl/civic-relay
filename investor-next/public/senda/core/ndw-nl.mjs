/**
 * SENDA Drive · Motor Países Bajos (NDW DATEX II v3 CC0 + Openbaar Ministerie + detección ES/NL, 0 €).
 *
 * Fuentes primarias oficiales:
 *  - NDW Nationaal Dataportaal Wegverkeer (`https://opendata.ndw.nu/`, CC0): SRTI (vehículos parados,
 *    accidentes, obstáculos), brugopeningen (puentes levadizos) y afsluitingen (cortes de vía/carril)
 *    con coordenadas WGS84 de 6 decimales (~11 cm) y rumbo de calzada `<loc:bearing>`.
 *  - Openbaar Ministerie (`https://www.om.nl/onderwerpen/v/verkeer/handhaving/snelheid-en-te-hard-rijden/trajectcontroles`):
 *    corrección oficial de medida (`meetcorrectie`: −3 km/h hasta 100 km/h; −3 % por encima de 100 km/h)
 *    y umbral sancionador (+4 km/h tras corrección para límites ≤ 120 km/h).
 */

export const OM_NL_SOURCE = 'Openbaar Ministerie (om.nl) · meetcorrectie −3 km/h (≤100) / −3 % (>100), sanción desde +4 km/h tras corrección (≤120)';

/** Detecta la región activa ('NL' | 'ES' | 'EU') a partir de [lon, lat]. */
export function detectRegion(pos) {
  if (!Array.isArray(pos) || pos.length < 2 || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return 'ES';
  const [lon, lat] = pos;
  if (lon >= 3.3 && lon <= 7.3 && lat >= 50.7 && lat <= 53.65) return 'NL';
  if ((lon >= -9.5 && lon <= 4.5 && lat >= 35.8 && lat <= 43.9) || (lon >= -18.5 && lon <= -13.2 && lat >= 27.5 && lat <= 29.5)) return 'ES';
  return 'EU';
}

/**
 * Regla oficial del Openbaar Ministerie (Países Bajos) para corrección de velocidad (`meetcorrectie`).
 * Devuelve velocidad corregida, exceso neto y si supera el umbral sancionador oficial.
 */
export function omNlSpeedCheck(measuredKmh, limitKmh) {
  if (typeof measuredKmh !== 'number' || !Number.isFinite(measuredKmh) || typeof limitKmh !== 'number' || !Number.isFinite(limitKmh)) {
    return null;
  }
  const correctionKmh = measuredKmh <= 100 ? 3 : +(measuredKmh * 0.03).toFixed(2);
  const correctedKmh = +Math.max(0, measuredKmh - correctionKmh).toFixed(1);
  const netOverKmh = +(correctedKmh - limitKmh).toFixed(1);
  const minFineOver = limitKmh <= 120 ? 4 : 1;
  return {
    measuredKmh: +measuredKmh.toFixed(1),
    limitKmh,
    correctionKmh,
    correctedKmh,
    netOverKmh,
    overLimit: measuredKmh > limitKmh,
    aboveFineThreshold: netOverKmh >= minFineOver,
    source: OM_NL_SOURCE,
  };
}

/**
 * Regla horaria de autopistas en Países Bajos (Rijkswaterstaat):
 * 06:00–19:00 hora local NL → límite general 100 km/h (19:00–06:00 → 120/130 km/h donde esté señalizado).
 */
export function dutchMotorwayWindow(date = new Date()) {
  const h = date.getHours();
  const isDaytime = h >= 6 && h < 19;
  return {
    isDaytime,
    generalMotorwayLimitKmh: isDaytime ? 100 : 130,
    label: isDaytime ? 'NL 06–19 h: 100 km/h autopista' : 'NL 19–06 h: hasta 120/130 según señal',
  };
}

const xmlTag = (blk, name) => {
  const m = blk.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([^<]+)</(?:\\w+:)?${name}>`));
  return m ? m[1].trim() : null;
};

/**
 * Analizador puro JS de feeds DATEX II v3 de NDW Países Bajos (`opendata.ndw.nu`, CC0):
 * SRTI (`VehicleObstruction`, `Accident`, `GeneralObstruction`), `brugopeningen` y `afsluitingen`.
 */
export function parseNdwDatex3(xml, feedName = 'ndw') {
  if (typeof xml !== 'string' || !xml.includes('situation')) return [];
  const out = [];
  const matches = xml.matchAll(/<(?:\w+:)?situation\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?situation>/g);
  for (const m of matches) {
    const attrs = m[1], blk = m[2];
    const sid = attrs.match(/id="([^"]+)"/)?.[1] ?? `${feedName}-${out.length}`;
    const recType = blk.match(/situationRecord\b[^>]*xsi:type="([^"]+)"/)?.[1]?.split(':').pop() ?? 'Situation';
    let latS = xmlTag(blk, 'latitude'), lonS = xmlTag(blk, 'longitude');
    if (!latS || !lonS) {
      const pl = xmlTag(blk, 'posList');
      if (pl) {
        const parts = pl.split(/\s+/);
        if (parts.length >= 2) { latS = parts[0]; lonS = parts[1]; }
      }
    }
    const lat = Number(latS), lon = Number(lonS);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const brgRaw = xmlTag(blk, 'bearing');
    const bearing = brgRaw != null && Number.isFinite(Number(brgRaw)) ? Math.round(Number(brgRaw)) : null;
    const road = xmlTag(blk, 'roadNumber') || xmlTag(blk, 'roadName') || '';
    const cause = xmlTag(blk, 'causeType') || xmlTag(blk, 'vehicleObstructionType') || xmlTag(blk, 'accidentType') || '';
    const startUtc = xmlTag(blk, 'overallStartTime');
    const endUtc = xmlTag(blk, 'overallEndTime');
    out.push({
      id: sid,
      feed: feedName,
      country: 'NL',
      type: recType,
      cause,
      road,
      bearing,
      startUtc,
      endUtc,
      org: xmlTag(blk, 'value') || 'NDW',
      lat: +lat.toFixed(6),
      lon: +lon.toFixed(6),
    });
  }
  return out;
}

/** Traduce un evento NDW Países Bajos al formato común de incidencias de corredor SENDA. */
export function ndwToIncident(n) {
  let type = n.type || 'Obstruction';
  if (n.feed === 'brugopeningen') type = 'BridgeOpening';
  else if (n.type === 'RoadOrCarriagewayOrLaneManagement') type = 'RoadClosure';
  return {
    id: n.id,
    type,
    cause: n.cause || (n.feed === 'brugopeningen' ? 'Brug open (puente levadizo)' : ''),
    road: n.road || (n.feed === 'brugopeningen' ? 'Brug NL' : 'NL'),
    bearing: n.bearing ?? null,
    country: 'NL',
    feed: n.feed,
    lat: n.lat,
    lon: n.lon,
  };
}

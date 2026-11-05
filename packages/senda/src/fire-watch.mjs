/**
 * SENDA · Seguimiento de un incendio forestal con cámaras, móviles, satélite y meteorología (v0.18).
 *
 * Qué resuelve:
 *  1. LOCALIZAR la columna de humo cruzando rumbos: torres de vigilancia, cámaras orientables y la brújula del
 *     móvil de quien la ve (con su toque). Mínimos cuadrados con elipse de error y rechazo de brújulas malas.
 *  2. PERIMETRAR y MEDIR EL AVANCE con focos de satélite (NASA FIRMS: VIIRS 375 m, MODIS 1 km): envolvente de los
 *     píxeles, área, potencia radiativa (FRP) y velocidad del frente entre dos pasadas.
 *  3. METEOROLOGÍA DEL INCENDIO: regla 30-30-30, déficit de presión de vapor, índice cálido-seco-ventoso (HDW),
 *     índice de Fosberg (FFWI), humedad de equilibrio del combustible muerto e índice de propagación inicial (ISI).
 *  4. COMPORTAMIENTO Y CRITICIDAD: intensidad lineal de Byram, longitud de llama y qué medios pueden atacarlo
 *     (tabla de Andrews y Rothermel); criticidad con la exposición de pueblos y carreteras.
 *  5. CARRETERAS Y COCHES: tramos que el fuego alcanzará y cuándo; tramas de aviso de 24 bytes (HAZARD.FIRE) para
 *     los coches que se acercan, y velocidad segura con humo.
 *
 * SENDA no dirige la extinción ni declara situaciones operativas: propone datos y avisos al centro de mando
 * (la situación operativa 0–3 la declara la dirección del plan INFOMA, según la Directriz básica, RD 893/2013).
 * Coeficientes marcados como «supuesto» u «orientativo»: hay que calibrarlos con datos de campo.
 */
import { localFrame, bearingDeg } from './geo-offline.mjs';
import { fusePosition } from './vehicle-link.mjs';
import { HAZARD, encodeHazard } from './road-guard.mjs';
import { windShape } from './wildfire.mjs';
import { safeSpeedForVisibility } from './drive-cases.mjs';

const rad = (d) => (d * Math.PI) / 180, n360 = (a) => ((a % 360) + 360) % 360, wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const r1 = (x, d = 1) => +x.toFixed(d);

// ---------------------------------------------------------------- 0) Fuentes y modo de acceso
export const FIRE_SOURCES = Object.freeze([
  { id: 'firms', name: 'NASA FIRMS (VIIRS 375 m · MODIS 1 km)', access: 'PASIVO', gives: 'Focos térmicos con potencia radiativa (FRP); varias pasadas al día', latency: '≈ 3 h (casi tiempo real)', legal: 'Datos abiertos de la NASA; citar FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/' },
  { id: 'effis', name: 'Copernicus EFFIS', access: 'PASIVO', gives: 'Peligro meteorológico previsto (FWI) y perímetros de área quemada (≳ 30 ha)', latency: 'diaria', legal: 'CC BY 4.0 según el cliente effis-client (pendiente de verificar en la web oficial)', url: 'https://forest-fire.emergency.copernicus.eu/' },
  { id: 'meteosat', name: 'EUMETSAT Meteosat (geoestacionario)', access: 'PASIVO', gives: 'Detección de fuego cada pocos minutos con píxel de varios km', latency: 'minutos', legal: 'Registro gratuito; licencia pendiente de verificar', url: 'https://www.eumetsat.int/' },
  { id: 'sentinel2', name: 'Copernicus Sentinel-2', access: 'PASIVO', gives: 'Imagen de 10–20 m cada ≈ 5 días: área quemada y gravedad (dNBR)', latency: 'días', legal: 'Licencia abierta de Copernicus', url: 'https://dataspace.copernicus.eu/' },
  { id: 'aemet', name: 'AEMET OpenData', access: 'PASIVO', gives: 'Temperatura, humedad, viento y rachas observados y previstos', latency: 'horaria', legal: 'Reutilización citando a AEMET; clave gratuita', url: 'https://opendata.aemet.es/' },
  { id: 'asem112', name: 'ASEM 112 Comunidad de Madrid (avisos públicos)', access: 'PASIVO', gives: 'Estado oficial, cortes de carretera, confinamientos y evacuaciones', latency: 'minutos', legal: 'Información pública oficial', url: 'https://www.comunidad.madrid/seguridad-emergencias-asem-112' },
  { id: 'torres', name: 'Torres de vigilancia y cámaras del plan INFOMA', access: 'CONVENIO', gives: 'Rumbo a la columna de humo (alidada o cámara orientable)', latency: 'minutos', legal: 'Las imágenes van a los operadores, no son públicas: solo por convenio', url: 'https://www.comunidad.madrid/node/69737' },
  { id: 'dgt-camaras', name: 'Cámaras de tráfico de la DGT', access: 'PASIVO', gives: 'Humo y visibilidad en la propia carretera', latency: 'minutos', legal: 'Imagen pública de la DGT; se analiza y se descarta', url: 'https://infocar.dgt.es/' },
  { id: 'movil', name: 'Brújula, GPS y cámara del móvil (con tu toque)', access: 'PASIVO', gives: 'Rumbo a la columna, hora y posición; la foto no sale del teléfono', latency: 'segundos', legal: 'Consentimiento explícito de quien informa', url: null },
  { id: 'coches', name: 'Coches conectados (Ley de Datos)', access: 'CONVENIO', gives: 'Temperatura exterior, paradas, luces de emergencia en la zona', latency: 'segundos', legal: 'Reglamento (UE) 2023/2854, art. 5: a elección del usuario', url: null },
  { id: 'escucha-radio', name: 'Escuchar las radios de emergencia', access: 'NUNCA', gives: '—', latency: '—', legal: 'Van cifradas (TETRA); interceptarlas o difundirlas vulnera el secreto de las comunicaciones', url: null },
  { id: 'drones-sobre-fuego', name: 'Volar drones propios sobre el incendio', access: 'NUNCA', gives: '—', latency: '—', legal: 'Sin autorización de la dirección de extinción pone en peligro a los medios aéreos', url: null },
  { id: 'camaras-privadas', name: 'Cámaras privadas abiertas sin permiso', access: 'NUNCA', gives: '—', latency: '—', legal: 'Imagen de terceros sin base legal (estilo Shodan/Insecam)', url: null },
]);

// ---------------------------------------------------------------- 1) Localizar la columna cruzando rumbos
/** Error típico del rumbo, en grados (SUPUESTOS a calibrar): alidada de torre, cámara orientable, brújula del móvil. */
export const BEARING_SD = Object.freeze({ torre: 1, camara: 0.5, movil: 8 });

/**
 * Rumbo hacia donde apunta la cámara trasera del móvil, con la orientación del dispositivo (α, β, γ en grados),
 * según el ejemplo de la especificación W3C DeviceOrientation. α absoluto (evento `deviceorientationabsolute`).
 * En iOS, `webkitCompassHeading` ya es el rumbo. Devuelve grados respecto al norte magnético.
 */
export function compassHeading(alpha, beta, gamma) {
  const x = rad(beta || 0), y = rad(gamma || 0), z = rad(alpha || 0);
  const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z), sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
  const Vx = -cZ * sY - sZ * sX * cY, Vy = -sZ * sY + cZ * sX * cY;
  return n360((Math.atan2(Vx, Vy) * 180) / Math.PI);
}

/** Avistamiento desde el móvil → observación de rumbo (solo número, hora y posición; la imagen se queda en el teléfono). */
export function phoneSighting({ lat, lon, accuracyM = 10, headingDeg, alpha, beta, gamma, declDeg = 0, t = 0, id = 'movil' }) {
  const mag = headingDeg ?? compassHeading(alpha, beta, gamma);
  return { id, kind: 'movil', lat, lon, azDeg: n360(mag + declDeg), sdDeg: BEARING_SD.movil, accuracyM, t };
}

function rayCross(a, b) {
  const ux = Math.sin(rad(a.az)), uy = Math.cos(rad(a.az)), vx = Math.sin(rad(b.az)), vy = Math.cos(rad(b.az)), den = ux * vy - uy * vx;
  if (Math.abs(den) < 0.05) return null; // visuales casi paralelas (< ~3°)
  const t = ((b.x - a.x) * vy - (b.y - a.y) * vx) / den, s = ((b.x - a.x) * uy - (b.y - a.y) * ux) / den;
  return t > 0 && s > 0 ? { x: a.x + t * ux, y: a.y + t * uy } : null;
}

/**
 * Posición de la columna a partir de rumbos DESDE sitios conocidos HACIA el humo.
 * @param {Array<{id:string, kind:'torre'|'camara'|'movil', lat:number, lon:number, azDeg:number, sdDeg?:number}>} obs
 * @returns {{ok:boolean, lat?, lon?, majorM?, minorM?, angleDeg?, crossingDeg?, used?:string[], rejected?:object[], residuals?:object[], reason?:string}}
 */
export function bearingFix(obs, { declDeg = 0, rejectZ = 2.5, maxRangeM = 40000 } = {}) {
  const sites = new Set(obs.map((o) => `${o.lat.toFixed(4)},${o.lon.toFixed(4)}`));
  if (obs.length < 2 || sites.size < 2) return { ok: false, reason: 'hacen falta al menos 2 rumbos desde sitios distintos' };
  const lat0 = obs.reduce((s, o) => s + o.lat, 0) / obs.length, lon0 = obs.reduce((s, o) => s + o.lon, 0) / obs.length, F = localFrame(lat0, lon0);
  let use = obs.map((o) => ({ ...o, sd: o.sdDeg ?? BEARING_SD[o.kind] ?? 5, az: n360(o.azDeg + declDeg), ...F.toXY(o.lat, o.lon) }));
  const rejected = [];
  for (;;) {
    let sx = 0, sy = 0, sw = 0;
    for (let i = 0; i < use.length; i++) for (let j = i + 1; j < use.length; j++) {
      const p = rayCross(use[i], use[j]); if (!p || Math.hypot(p.x - use[i].x, p.y - use[i].y) > maxRangeM) continue;
      const w = 1 / (use[i].sd * use[j].sd); sx += w * p.x; sy += w * p.y; sw += w;
    }
    if (!sw) return { ok: false, reason: 'las visuales no se cruzan delante de los observadores', rejected };
    const init = F.toLL(sx / sw, sy / sw);
    const fix = fusePosition(use.map((o) => ({ kind: 'bearing', lat: o.lat, lon: o.lon, deg: n360(o.az + 180), sdDeg: o.sd })), { init });
    const residuals = use.map((o) => { const res = wrap180(o.az - bearingDeg(o, fix)); return { id: o.id, kind: o.kind, resDeg: r1(res, 2), z: r1(res / o.sd, 2), rangeM: Math.round(Math.hypot(...Object.values(localFrame(o.lat, o.lon).toXY(fix.lat, fix.lon)))) }; });
    const worst = residuals.reduce((m, r) => (Math.abs(r.z) > Math.abs(m.z) ? r : m));
    if (Math.abs(worst.z) > rejectZ && use.length > 2) { rejected.push({ ...worst, why: 'rumbo incoherente con el resto (brújula descalibrada o otra columna)' }); use = use.filter((o) => o.id !== worst.id); continue; }
    let crossingDeg = 0;
    for (let i = 0; i < use.length; i++) for (let j = i + 1; j < use.length; j++) { const d = Math.abs(wrap180(use[i].az - use[j].az)); crossingDeg = Math.max(crossingDeg, Math.min(d, 180 - d)); }
    return { ok: true, lat: fix.lat, lon: fix.lon, majorM: fix.majorM, minorM: fix.minorM, angleDeg: fix.angleDeg, crossingDeg: r1(crossingDeg), used: use.map((o) => o.id), rejected, residuals };
  }
}

// ---------------------------------------------------------------- 2) Perímetro y avance con satélite
export const PIXEL_M = Object.freeze({ VIIRS: 375, MODIS: 1000 });
/** Kg de biomasa quemada por MJ radiado (Wooster et al., 2005: 0,368 kg/MJ). */
export const FRE_TO_BIOMASS = 0.368;

function hull(pts) {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y), cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const areaOf = (h) => Math.abs(h.reduce((s, a, i) => { const b = h[(i + 1) % h.length]; return s + a.x * b.y - b.x * a.y; }, 0)) / 2;
function inside(h, q) { let c = false; for (let i = 0, j = h.length - 1; i < h.length; j = i++) { const a = h[i], b = h[j]; if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; }
function edgeDist(h, q) {
  if (h.length === 1) return Math.hypot(q.x - h[0].x, q.y - h[0].y);
  let m = Infinity;
  for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L)); m = Math.min(m, Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy)); }
  return m;
}
/** Distancia (m) desde el perímetro hasta un punto; 0 si está dentro. */
export function distanceToPerimeter(per, p) { const F = localFrame(per.origin.lat, per.origin.lon), q = F.toXY(p.lat, p.lon), h = per.hullXY; return h.length > 2 && inside(h, q) ? 0 : edgeDist(h, q); }

/**
 * Perímetro aproximado de una pasada de satélite: envolvente convexa de los píxeles (cada foco ocupa scan × track,
 * o 375 m en VIIRS y 1 km en MODIS). Es una COTA SUPERIOR del área; la imagen de Sentinel-2 o el perímetro oficial la afinan.
 * @param {Array<{lat:number, lon:number, frp?:number, scanKm?:number, trackKm?:number, instrument?:string, when?:string}>} points
 */
export function hotspotPerimeter(points, { origin } = {}) {
  if (!points.length) return null;
  const o = origin ?? { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lon: points.reduce((s, p) => s + p.lon, 0) / points.length }, F = localFrame(o.lat, o.lon);
  const corners = [], cen = { x: 0, y: 0 };
  for (const p of points) {
    const q = F.toXY(p.lat, p.lon), def = PIXEL_M[String(p.instrument || 'VIIRS').toUpperCase()] ?? 375;
    const hx = ((p.scanKm ? p.scanKm * 1000 : def) / 2), hy = ((p.trackKm ? p.trackKm * 1000 : def) / 2);
    corners.push({ x: q.x - hx, y: q.y - hy }, { x: q.x + hx, y: q.y - hy }, { x: q.x + hx, y: q.y + hy }, { x: q.x - hx, y: q.y + hy }); cen.x += q.x / points.length; cen.y += q.y / points.length;
  }
  const h = hull(corners), frp = points.reduce((s, p) => s + (p.frp || 0), 0), times = points.map((p) => p.when).filter(Boolean).sort();
  return { origin: o, hullXY: h, hull: h.map((v) => F.toLL(v.x, v.y)), areaHa: r1(areaOf(h) / 1e4, 0), n: points.length, frpMW: r1(frp), biomassKgS: r1(FRE_TO_BIOMASS * frp), centroid: F.toLL(cen.x, cen.y), when: times[times.length - 1] ?? null };
}

/** Avance entre dos pasadas: crecimiento (ha/h), máximo avance del frente (m), velocidad (m/min) y hacia dónde. */
export function fireProgress(prev, next, { dtMin } = {}) {
  const dt = dtMin ?? (Date.parse(next.when) - Date.parse(prev.when)) / 60000;
  if (!(dt > 0)) throw new Error('las pasadas deben estar ordenadas en el tiempo');
  const F = localFrame(prev.origin.lat, prev.origin.lon), H = prev.hullXY, c0 = F.toXY(prev.centroid.lat, prev.centroid.lon);
  let best = { d: 0, v: null };
  for (const v of next.hull) { const q = F.toXY(v.lat, v.lon); const d = H.length > 2 && inside(H, q) ? 0 : edgeDist(H, q); if (d > best.d) best = { d, v: q }; }
  const c1 = F.toXY(next.centroid.lat, next.centroid.lon);
  return { dtMin: r1(dt), growthHaH: r1(((next.areaHa - prev.areaHa) * 60) / dt), advanceM: Math.round(best.d), rosMMin: r1(best.d / dt), headingDeg: best.v ? Math.round(n360((Math.atan2(best.v.x - c0.x, best.v.y - c0.y) * 180) / Math.PI)) : null, centroidShiftM: Math.round(Math.hypot(c1.x - c0.x, c1.y - c0.y)) };
}

// ---------------------------------------------------------------- 3) Meteorología del incendio
/** Presión de vapor de saturación (hPa), fórmula de Magnus con los coeficientes de Alduchov y Eskridge (1996). */
export const satVapHpa = (tC) => 6.1094 * Math.exp((17.625 * tC) / (tC + 243.04));
/** Humedad de equilibrio del combustible muerto fino (%), Simard (1968), con T en °F internamente. */
export function emcPct(tC, rh) {
  const T = (tC * 9) / 5 + 32, H = rh;
  if (H < 10) return 0.03229 + 0.281073 * H - 0.000578 * H * T;
  if (H < 50) return 2.22749 + 0.160107 * H - 0.01478 * T;
  return 21.0606 + 0.005565 * H * H - 0.00035 * H * T - 0.483199 * H;
}
/** Índice de Fosberg (1978): combina humedad de equilibrio y viento (mph). Aproximadamente de 0 a 100. */
export function fosbergFfwi(tC, rh, windKmh) {
  const x = Math.max(0, emcPct(tC, rh)) / 30, eta = 1 - 2 * x + 1.5 * x * x - 0.5 * x ** 3, U = windKmh / 1.609344;
  return Math.max(0, (eta * Math.sqrt(1 + U * U)) / 0.3002);
}
/** Índice de propagación inicial (ISI) del sistema canadiense FWI (Van Wagner, 1987) a partir del FFMC y del viento (km/h). */
export function isiFromFfmc(ffmc, windKmh) {
  const m = (147.2 * (101 - ffmc)) / (59.5 + ffmc), fF = 91.9 * Math.exp(-0.1386 * m) * (1 + m ** 5.31 / 4.93e7);
  return 0.208 * Math.exp(0.05039 * windKmh) * fF;
}
/**
 * @param {{tempC:number, rh:number, windKmh:number, gustKmh?:number, windFromDeg?:number, ffmc?:number}} w
 */
export function fireWeather({ tempC, rh, windKmh, gustKmh = null, windFromDeg = null, ffmc = null }) {
  const rule30 = { temp: tempC > 30, rh: rh < 30, wind: windKmh > 30 };
  const vpd = satVapHpa(tempC) * (1 - rh / 100);
  return {
    tempC, rh, windKmh, gustKmh, windFromDeg, spreadToDeg: windFromDeg == null ? null : n360(windFromDeg + 180),
    rule30: { ...rule30, count: Object.values(rule30).filter(Boolean).length },
    vpdHpa: r1(vpd, 1), hdw: r1(vpd * (windKmh / 3.6), 0), ffwi: r1(fosbergFfwi(tempC, rh, windKmh), 0), deadFuelMoisturePct: r1(Math.max(0, emcPct(tempC, rh)), 1),
    isi: ffmc == null ? null : r1(isiFromFfmc(ffmc, windKmh), 1),
    notes: ['30-30-30: criterio divulgativo; en 2007-2016 lo cumplieron 72 de 196 grandes incendios en España (Civio) y el viento fue el factor más decisivo', 'HDW con valores de superficie: el índice original usa el máximo en los 500 m más bajos (Srock et al., 2018), así que aquí se infravalora'],
  };
}

// ---------------------------------------------------------------- 4) Comportamiento y criticidad
/** Calor de combustión típico (kJ/kg) y carga de combustible consumida (kg/m²): valores ORIENTATIVOS. */
export const HEAT_KJKG = 18000;
export const FUEL_LOAD = Object.freeze({ pasto: 0.4, matorral: 2.0, arbolado: 2.5 });
export const ATTACK = Object.freeze([
  { k: 1, maxFlameM: 1.2, label: 'Ataque directo con herramientas manuales' },
  { k: 2, maxFlameM: 2.4, label: 'Ataque directo con maquinaria y autobombas' },
  { k: 3, maxFlameM: 3.4, label: 'Control difícil: ataque indirecto y medios aéreos' },
  { k: 4, maxFlameM: Infinity, label: 'Fuera de la capacidad de extinción: coronación y focos secundarios; prioridad, las personas' },
]);
/** Intensidad lineal de Byram I = H·w·R (kW/m) y longitud de llama L = 0,0775·I^0,46 (m); clase de ataque de Andrews y Rothermel (1982). */
export function fireBehavior({ rosMMin, fuel = 'matorral', fuelKgM2 = FUEL_LOAD[fuel] ?? 1, heatKJkg = HEAT_KJKG }) {
  const I = (heatKJkg * fuelKgM2 * rosMMin) / 60, L = 0.0775 * I ** 0.46, attack = ATTACK.find((a) => L < a.maxFlameM);
  return { rosMMin, rosKmh: r1((rosMMin * 60) / 1000, 2), intensityKWm: Math.round(I), flameM: r1(L, 1), attack };
}
/**
 * Criticidad 0–100 (criterio SENDA, configurable): comportamiento + meteorología + exposición.
 * @param {{behavior:object, weather:object, exposure?:{towns?:Array<{name:string, etaMin:number}>, roads?:Array<{name:string, etaMin:number}>, people?:number}}} a
 */
export function fireCriticality({ behavior, weather, exposure = {} }) {
  const reasons = [];
  let s = (behavior.attack.k - 1) * 15; reasons.push(`Llama de ${behavior.flameM.toString().replace('.', ',')} m: ${behavior.attack.label.toLowerCase()}`);
  s += weather.rule30.count * 8; if (weather.rule30.count) reasons.push(`Cumple ${weather.rule30.count} de 3 condiciones del 30-30-30`);
  const towns = (exposure.towns ?? []).filter((t) => Number.isFinite(t.etaMin)).sort((a, b) => a.etaMin - b.etaMin);
  if (towns[0]) { const e = towns[0].etaMin; s += e < 60 ? 25 : e < 180 ? 15 : e < 360 ? 5 : 0; if (e < 360) reasons.push(e === 0 ? `${towns[0].name}: el perímetro ya lo alcanza` : `${towns[0].name}: el fuego podría llegar en ≈ ${fmtMin(e)}`); }
  const roads = (exposure.roads ?? []).filter((r) => r.etaMin < 60); s += Math.min(10, roads.length * 5); if (roads.length) reasons.push(`Carreteras a cortar: ${roads.map((r) => r.name).join(', ')}`);
  if ((exposure.people ?? 0) > 0) { s += Math.min(10, Math.log10(1 + exposure.people) * 3); reasons.push(`≈ ${exposure.people} personas en la zona (recuento anónimo, k ≥ 5)`); }
  s = Math.max(0, Math.min(100, Math.round(s)));
  const level = s < 25 ? 'vigilancia' : s < 50 ? 'alerta' : s < 75 ? 'emergencia' : 'extrema';
  return { score: s, level, reasons, note: 'Criterio SENDA para priorizar avisos; la situación operativa oficial (0–3) la declara la dirección del plan.' };
}
const fmtMin = (m) => (m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1).replace('.', ',')} h`);

// ---------------------------------------------------------------- 5) Pueblos, carreteras y coches
/** Velocidad (m/min) del frente en la dirección `toDeg`, con la elipse de viento del núcleo (foco en el punto de ignición). */
export function directionalSpeed(rosHeadMMin, toDeg, spreadToDeg, windKmh) {
  const { ecc } = windShape(windKmh), th = rad(toDeg - spreadToDeg);
  return (rosHeadMMin * (1 - ecc)) / (1 - ecc * Math.cos(th));
}
/** Tiempo (min) hasta que el frente alcance un punto, desde el perímetro actual. */
export function etaToPoint(per, p, { rosHeadMMin, spreadToDeg, windKmh, from }) {
  const d = distanceToPerimeter(per, p); if (d === 0) return 0;
  const v = directionalSpeed(rosHeadMMin, bearingDeg(from ?? per.centroid, p), spreadToDeg, windKmh);
  return v > 0 ? d / v : Infinity;
}
/** Tramos de carretera amenazados: primer punto alcanzado, en cuánto tiempo y qué hacer. */
export function roadThreats(roads, per, opts, { cutMin = 30, warnMin = 180, stepM = 200 } = {}) {
  return roads.map((r) => {
    let best = { eta: Infinity, p: null, s: 0 }, s = 0, cut = null;
    const pkOf = (m) => (r.pk0 != null ? r1(r.pk0 + (r.pkDir ?? 1) * (m / 1000), 1) : null);
    for (let i = 0; i < r.path.length - 1; i++) {
      const a = r.path[i], b = r.path[i + 1], F = localFrame(a.lat, a.lon), q = F.toXY(b.lat, b.lon), L = Math.hypot(q.x, q.y), n = Math.max(1, Math.ceil(L / stepM));
      for (let k = 0; k <= n; k++) {
        const p = F.toLL((q.x * k) / n, (q.y * k) / n), eta = etaToPoint(per, p, opts), at = s + (L * k) / n;
        if (eta < best.eta) best = { eta, p, s: at };
        if (eta <= cutMin) cut = cut ? { from: Math.min(cut.from, at), to: Math.max(cut.to, at) } : { from: at, to: at };
      }
      s += L;
    }
    const action = best.eta <= cutMin ? 'cortar' : best.eta <= warnMin ? 'avisar' : 'vigilar';
    const section = cut && r.pk0 != null ? { pkFrom: Math.min(pkOf(cut.from), pkOf(cut.to)), pkTo: Math.max(pkOf(cut.from), pkOf(cut.to)) } : null;
    return { id: r.id, name: r.name, etaMin: Number.isFinite(best.eta) ? Math.round(best.eta) : Infinity, at: best.p, pk: pkOf(best.s), section, action };
  });
}
/** Tramas de aviso de 24 bytes (HAZARD.FIRE) para los coches que se acercan a un tramo amenazado. `flags` bit 0 = cortar ya. */
export function fireRoadAlerts(threats, { t = 0, idBase = 0xF1A0 } = {}) {
  return threats.filter((r) => r.action !== 'vigilar' && r.at).map((r, i) => ({ road: r.name, action: r.action, frame: encodeHazard({ type: HAZARD.FIRE, t, lat: r.at.lat, lon: r.at.lon, flags: r.action === 'cortar' ? 1 : 0, id: idBase + i }) }));
}
/** Humo en la vía: con la visibilidad estimada por la cámara (Koschmieder), la velocidad a la que se puede parar. */
export function smokeRoadAdvice(visM, { surface = 'seco' } = {}) {
  const v = safeSpeedForVisibility(visM, surface === 'seco' ? {} : { mu: 0.4 });
  return { visM, kmh: v.kmh, text: visM < 50 ? `Humo denso: visibilidad ${Math.round(visM)} m. Sal de la zona si puedes; si no, ${v.kmh} km/h como máximo, con luces de cruce y antiniebla` : `Humo: visibilidad ${Math.round(visM)} m. No pases de ${v.kmh} km/h` };
}
/** Un coche ardiendo junto a vegetación seca con 30-30-30 es un posible inicio de incendio: aviso inmediato al 112 (como en la M-501, 23-07-2026). */
export function vehicleFireIgnitionRisk({ weather, vegetationM }) {
  const c = weather.rule30.count, risk = vegetationM <= 30 && c >= 2 ? 'alto' : vegetationM <= 100 && c >= 1 ? 'medio' : 'bajo';
  return { risk, notify112: risk !== 'bajo', text: risk === 'alto' ? 'Coche en llamas junto a vegetación seca con calor, sequedad y viento: riesgo alto de incendio forestal. Llama al 112 y aléjate a favor de la carretera, nunca hacia el monte.' : risk === 'medio' ? 'Coche en llamas cerca de vegetación: avisa al 112 y aléjate.' : 'Coche en llamas: avisa al 112 y aléjate.' };
}

// ---------------------------------------------------------------- 6) Caso real y reconstrucción ilustrativa
/** Hechos verificados del incendio de San Martín de Valdeiglesias (23-07-2026), con su fuente. */
export const CASE_SMV_2026 = Object.freeze({
  id: 'smv-2026', title: 'Incendio de San Martín de Valdeiglesias y Almorox (julio de 2026)',
  facts: [
    { text: 'El 23-07-2026 el fuego se inició junto al km 57 de la M-501, a la entrada de San Martín de Valdeiglesias, a partir de un coche en llamas en la calzada; según la Guardia Civil era de combustión, no eléctrico.', src: 'https://www.hibridosyelectricos.com/coches/verdad-sobre-falso-coche-electrico-provoco-incendio-san-martin-valdeiglesias-en-madrid_88384_102.html' },
    { text: 'El fuego afectó también a Pelayos de la Presa.', src: 'https://www.democrata.es/actualidad/mapa-incendios-activos-espana/amp/' },
    { text: 'Se confinó por precaución la residencia de mayores López Rumayor.', src: 'https://www.elespanol.com/madrid/sociedad/20260723/confinan-residencia-mayores-incendio-forestal-san-martin-valdeiglesias/1003744331891_0.html' },
    { text: 'Los incendios de Almorox (Toledo) y San Martín de Valdeiglesias acabaron confluyendo en un único frente.', src: 'https://www.esdiario.com/nacional/260724/194013/madrid-enfrenta-24-horas-decisivas-peor-incendio-historia-llamas-fuera-control-viento-da-tregua.html' },
    { text: 'La presidenta de la Comunidad de Madrid pidió declarar la situación operativa 3.', src: 'https://www.eldebate.com/espana/madrid/20260723/ayuso-pide-declarar-situacion-operativa-3-ola-incendios-tenemos-miles-evacuados_443097.html' },
    { text: 'Almorox, a 24-07: 890 ha, 700 personas evacuadas y 26 viviendas destruidas; cortes de la M-507 y la N-403.', src: 'https://www.moncloa.com/2026/07/24/incendio-almorox-890-hectareas-evacuados-3405005/' },
    { text: 'Las cifras de superficie difieren entre fuentes (≈ 3.000 ha conjuntas el 24-07 y cifras mayores después): pendiente del balance oficial.', src: 'https://www.ultimahora.es/noticias/comunidades/2026/07/24/2676453/incendios-villa-del-prado-san-martin-valdeiglesias-calcinan-3000-hectareas.html' },
    { text: 'Página oficial del ASEM 112: «Incendio forestal Almorox (#IFAlmorox) – Villa del Prado (julio 2026)».', src: 'https://www.comunidad.madrid/seguridad-emergencias-asem-112/incendio-forestal-almorox-ifalmorox-villa-prado-julio-2026' },
  ],
  context: [
    { text: 'Plan INFOMA 2026: época de peligro alto del 15 de junio al 30 de septiembre, con vigilancia de 24 horas.', src: 'https://www.comunidad.madrid/transparencia/node/106365' },
    { text: 'Red de vigilancia de la Comunidad: entre 33 y 38 puestos fijos según el año y la fuente, y 4 cámaras de videovigilancia (2024); las imágenes van a los operadores.', src: 'https://www.comunidad.madrid/node/69737' },
  ],
  /** Cascos urbanos: coordenadas APROXIMADAS (±1 km). */
  places: {
    sanMartin: { name: 'San Martín de Valdeiglesias', lat: 40.360, lon: -4.400 }, pelayos: { name: 'Pelayos de la Presa', lat: 40.360, lon: -4.330 },
    navas: { name: 'Navas del Rey', lat: 40.383, lon: -4.250 }, tiemblo: { name: 'El Tiemblo', lat: 40.415, lon: -4.500 },
    cadalso: { name: 'Cadalso de los Vidrios', lat: 40.300, lon: -4.434 }, almorox: { name: 'Almorox', lat: 40.232, lon: -4.390 }, villaPrado: { name: 'Villa del Prado', lat: 40.279, lon: -4.305 },
  },
  /** Trazados SIMPLIFICADOS (unos pocos vértices); el km 57 de la M-501 está a la entrada de San Martín. */
  roads: [
    { id: 'M-501', name: 'M-501', pk0: 45.1, pkDir: 1, path: [{ lat: 40.383, lon: -4.250 }, { lat: 40.372, lon: -4.290 }, { lat: 40.360, lon: -4.330 }, { lat: 40.362, lon: -4.365 }, { lat: 40.362, lon: -4.385 }, { lat: 40.360, lon: -4.400 }] },
    { id: 'N-403', name: 'N-403', path: [{ lat: 40.232, lon: -4.390 }, { lat: 40.300, lon: -4.395 }, { lat: 40.360, lon: -4.400 }, { lat: 40.390, lon: -4.450 }, { lat: 40.415, lon: -4.500 }] },
  ],
  ignition: { lat: 40.362, lon: -4.385, label: 'M-501, km 57 (aprox.)' },
});

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Reconstrucción ILUSTRATIVA sobre la geografía real del caso: la forma del frente, el viento, las torres, los móviles
 * y los focos de satélite son INVENTADOS para mostrar el método; no son datos del incendio real.
 * Frente elíptico con el foco de ignición en el foco trasero (como el núcleo `wildfire.mjs`).
 */
export function fireScenario({ seed = 7, rosHeadMMin = 25, windKmh = 32, windFromDeg = 270, tempC = 38, rh = 15, gustKmh = 50 } = {}) {
  const R = rng(seed), N = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
  const ig = CASE_SMV_2026.ignition, F = localFrame(ig.lat, ig.lon), spreadTo = n360(windFromDeg + 180), { ecc } = windShape(windKmh);
  const u = { x: Math.sin(rad(spreadTo)), y: Math.cos(rad(spreadTo)) }, wv = { x: u.y, y: -u.x };
  const ellipseAt = (tMin) => { const H = rosHeadMMin * tMin, B = (H * (1 - ecc)) / (1 + ecc), a = (H + B) / 2, b = a * Math.sqrt(1 - ecc * ecc), c = { x: u.x * (H - a), y: u.y * (H - a) }; return { a, b, c, H, B }; };
  const pointOn = (E, s) => ({ x: E.c.x + E.a * Math.cos(s) * u.x + E.b * Math.sin(s) * wv.x, y: E.c.y + E.a * Math.cos(s) * u.y + E.b * Math.sin(s) * wv.y });
  const truthAt = (tMin) => { const E = ellipseAt(tMin); return { ...F.toLL(E.c.x, E.c.y), areaHa: r1((Math.PI * E.a * E.b) / 1e4, 0), headM: Math.round(E.H) }; };
  // Observadores (posiciones ILUSTRATIVAS; no son las torres reales del plan INFOMA)
  const obsSites = [
    { id: 'torre-A', kind: 'torre', lat: 40.440, lon: -4.440, label: 'Torre A (ilustrativa)' },
    { id: 'torre-B', kind: 'torre', lat: 40.312, lon: -4.322, label: 'Torre B (ilustrativa)' },
    { id: 'camara-C', kind: 'camara', lat: 40.372, lon: -4.255, label: 'Cámara orientable C (ilustrativa)' },
    { id: 'movil-1', kind: 'movil', lat: 40.361, lon: -4.336, label: 'Conductor en la M-501 (Pelayos)' },
    { id: 'movil-2', kind: 'movil', lat: 40.300, lon: -4.396, label: 'Conductora en la N-403' },
    { id: 'movil-3', kind: 'movil', lat: 40.358, lon: -4.404, label: 'Vecina en San Martín' },
    { id: 'movil-4', kind: 'movil', lat: 40.405, lon: -4.475, label: 'Móvil con la brújula descalibrada', biasDeg: 28 },
  ];
  const tSight = 20, smoke = truthAt(tSight);
  const sightings = obsSites.map((o, i) => { const sd = BEARING_SD[o.kind]; return { ...o, t: 6 + i * 2, azDeg: r1(n360(bearingDeg(o, smoke) + sd * N() + (o.biasDeg ?? 0)), 1), sdDeg: sd }; });
  // Dos pasadas de satélite VIIRS (píxel 375 m): focos en la banda activa del frente
  const pass = (tMin, when) => {
    const E = ellipseAt(tMin), pts = new Map(), per = 2 * Math.PI * Math.sqrt((E.a * E.a + E.b * E.b) / 2), steps = Math.max(12, Math.ceil(per / 250));
    for (let k = 0; k < steps; k++) {
      const s = (2 * Math.PI * k) / steps, head = Math.cos(s), pDet = head > 0.3 ? 1 : head > -0.5 ? 0.8 : 0.45; if (R() > pDet) continue;
      const q = pointOn(E, s), gx = Math.round(q.x / 375) * 375, gy = Math.round(q.y / 375) * 375, key = `${gx},${gy}`; if (pts.has(key)) continue;
      const ll = F.toLL(gx, gy), frp = head > 0.3 ? 20 + 60 * R() : head > -0.5 ? 5 + 20 * R() : 1 + 7 * R();
      pts.set(key, { lat: r1(ll.lat, 5), lon: r1(ll.lon, 5), frp: r1(frp), scanKm: 0.38, trackKm: 0.36, instrument: 'VIIRS', satellite: tMin < 120 ? 'N' : '1', confidence: head > -0.5 ? 'h' : 'n', when, daynight: 'D' });
    }
    return [...pts.values()];
  };
  const passes = [{ tMin: 90, when: '2026-07-23T14:30Z', points: pass(90, '2026-07-23T14:30Z') }, { tMin: 210, when: '2026-07-23T16:30Z', points: pass(210, '2026-07-23T16:30Z') }];
  const weather = fireWeather({ tempC, rh, windKmh, gustKmh, windFromDeg, ffmc: 94 });
  const towns = Object.values(CASE_SMV_2026.places);
  return { ignition: ig, rosHeadMMin, windKmh, windFromDeg, spreadToDeg: spreadTo, weather, sightings, tSight, smokeTruth: smoke, passes, towns, roads: CASE_SMV_2026.roads, truthAt, ellipseAt: (t) => { const E = ellipseAt(t); return Array.from({ length: 73 }, (_, k) => F.toLL(...Object.values(pointOn(E, (2 * Math.PI * k) / 72)))); }, illustrative: true };
}

/** Todo el seguimiento de una vez: posición, perímetros, avance, meteo, comportamiento, exposición, criticidad y avisos a coches. */
export function fireWatch(sc, { fuel = 'matorral', people = 0 } = {}) {
  const fix = bearingFix(sc.sightings);
  const pers = sc.passes.map((p) => hotspotPerimeter(p.points, { origin: sc.ignition }));
  const prog = pers.length > 1 ? fireProgress(pers[0], pers[pers.length - 1]) : null;
  const ros = prog?.rosMMin ?? sc.rosHeadMMin, spreadTo = prog?.headingDeg ?? sc.spreadToDeg, last = pers[pers.length - 1];
  const opts = { rosHeadMMin: ros, spreadToDeg: spreadTo, windKmh: sc.windKmh, from: sc.ignition };
  const towns = sc.towns.map((t) => ({ name: t.name, lat: t.lat, lon: t.lon, etaMin: Math.round(etaToPoint(last, t, opts)) })).sort((a, b) => a.etaMin - b.etaMin);
  const roads = roadThreats(sc.roads, last, opts);
  const behavior = fireBehavior({ rosMMin: ros, fuel });
  const crit = fireCriticality({ behavior, weather: sc.weather, exposure: { towns, roads, people } });
  return { fix, perimeters: pers, progress: prog, behavior, weather: sc.weather, towns, roads, criticality: crit, carAlerts: fireRoadAlerts(roads, { t: 0 }) };
}

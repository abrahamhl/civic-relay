/**
 * SENDA · Contexto hidrológico de un reporte de agua: caudal previsto por GloFAS (Copernicus EMS).
 *
 * Sirve para que un «el río sube» de un vecino llegue a la sala con el caudal previsto al lado. NO es un aviso:
 * GloFAS es un modelo global de ~5 km cuya celda puede no coincidir con el barranco del reporte. No se usan
 * umbrales inventados; solo se compara el caudal previsto con el de los días anteriores en la misma celda.
 * Fuente de acceso: Open-Meteo Flood API (gratis y CC BY 4.0 solo para uso no comercial; en producción comercial,
 * Copernicus CDS o la API de pago de Open-Meteo).
 */
export const GLOFAS_SOURCE = 'GloFAS (Copernicus EMS) vía Open-Meteo Flood API, CC BY 4.0, uso no comercial';

/** URL de la consulta diaria (30 días pasados + 14 de previsión) para una posición. */
export function glofasUrl(lat, lon) {
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new Error('coordenadas no válidas');
  return `https://flood-api.open-meteo.com/v1/flood?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&daily=river_discharge,river_discharge_median,river_discharge_max,river_discharge_p75&past_days=30&forecast_days=14`;
}

/** Normaliza la respuesta de la API a { cell, days:[{ date, q, median, p75, max }] }. */
export function parseGlofasDaily(json) {
  const d = json?.daily; if (!d?.time?.length || !Array.isArray(d.river_discharge)) throw new Error('respuesta GloFAS sin serie diaria');
  return { cell: { lat: json.latitude, lon: json.longitude }, unit: json.daily_units?.river_discharge ?? 'm³/s',
    days: d.time.map((date, k) => ({ date, q: d.river_discharge[k], median: d.river_discharge_median?.[k] ?? null, p75: d.river_discharge_p75?.[k] ?? null, max: d.river_discharge_max?.[k] ?? null })) };
}

const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Contexto para hoy: caudal de hoy, pico previsto en los próximos días, mediana de los 30 días anteriores y
 * tendencia de mañana frente a hoy. Todo calculado sobre la serie de GloFAS; nada más.
 */
export function riverContext(series, today) {
  const k = series.days.findIndex((d) => d.date === today);
  if (k < 0) throw new Error(`la serie no contiene el día ${today}`);
  const past = series.days.slice(0, k).map((d) => d.q), future = series.days.slice(k);
  const base = med(past), now = series.days[k].q, peak = future.reduce((a, d) => (Number.isFinite(d.q) && d.q > a.q ? d : a), future[0]);
  const tomorrow = series.days[k + 1]?.q, rel = (x) => (base > 0 ? x / base : null);
  const trend = !Number.isFinite(tomorrow) ? 'sin dato' : tomorrow > now * 1.05 ? 'sube' : tomorrow < now * 0.95 ? 'baja' : 'estable';
  return { cell: series.cell, unit: series.unit, today, qHoy: now, medianaPrevia30d: base, vecesMedianaHoy: rel(now), pico: { date: peak.date, q: peak.q, vecesMediana: rel(peak.q), maxConjunto: peak.max },
    tendenciaManana: trend, fuente: GLOFAS_SOURCE,
    lectura: `Caudal modelado por GloFAS en la celda más cercana (${series.cell.lat.toFixed(3)}, ${series.cell.lon.toFixed(3)}). No es un aviso oficial ni mide el barranco del reporte.` };
}

/** Texto breve para la tarjeta del incidente. */
export function riverContextText(c) {
  const f = (x) => (x == null ? 's/d' : x >= 100 ? x.toFixed(0) : x.toFixed(1));
  return `GloFAS hoy ${f(c.qHoy)} ${c.unit}${c.vecesMedianaHoy ? ` (${f(c.vecesMedianaHoy)}× la mediana de los 30 días previos)` : ''}; pico previsto ${f(c.pico.q)} ${c.unit} el ${c.pico.date}${c.pico.vecesMediana ? ` (${f(c.pico.vecesMediana)}×)` : ''}; mañana ${c.tendenciaManana}.`;
}

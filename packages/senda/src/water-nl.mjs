/**
 * SENDA · Vigilancia de niveles de agua (núcleo puro, sin E/S). Pensado para los datos abiertos de Rijkswaterstaat
 * (WaterWebservices: medidas «meting» y previsión oficial «verwachting», cm respecto a NAP), pero sirve para
 * cualquier serie {t, v}.
 *
 * Qué calcula, todo a partir de datos MEDIDOS o de la PREVISIÓN OFICIAL (nunca una previsión propia):
 *  - tendencia: cm/h por mínimos cuadrados en una ventana, y cambio en 24 h;
 *  - posición del nivel actual dentro de la propia serie descargada (percentil de los últimos N días; NO es un
 *    periodo de retorno ni un umbral oficial);
 *  - pico de la previsión oficial y cuánto falta;
 *  - error que tuvo la previsión oficial donde ya se puede comparar con lo medido (verificación);
 *  - tiempo de viaje de la onda entre dos estaciones (desfase de máxima correlación de las variaciones).
 *
 * Veracidad: SENDA no conoce aquí los umbrales oficiales de alerta de cada estación. Las reglas de WATCH_RULES son
 * decisiones de SENDA para ordenar la atención, declaradas y revisables; no son niveles de alarma de Rijkswaterstaat.
 */

const H = 3600e3;

/** Convierte la respuesta de OphalenWaarnemingen en series [{t (ms), v (cm)}] por tipo de proceso. */
export function parseRws(resp) {
  const out = {};
  for (const w of resp?.WaarnemingenLijst ?? []) {
    const kind = w.AquoMetadata?.ProcesType ?? 'desconocido', unit = w.AquoMetadata?.Eenheid?.Code ?? null, ref = w.AquoMetadata?.Hoedanigheid?.Code ?? null;
    const s = (out[kind] ??= { unit, ref, points: [] });
    for (const m of w.MetingenLijst ?? []) {
      const v = m.Meetwaarde?.Waarde_Numeriek, t = Date.parse(m.Tijdstip);
      if (!Number.isFinite(v) || !Number.isFinite(t) || Math.abs(v) >= 99999) continue; // 999999999 = sin dato en RWS
      s.points.push({ t, v });
    }
  }
  for (const s of Object.values(out)) s.points.sort((a, b) => a.t - b.t);
  return out;
}

/** Media por hora (hora UTC truncada) para aligerar la serie. */
export function hourly(points) {
  const m = new Map();
  for (const p of points) { const k = Math.floor(p.t / H) * H; const a = m.get(k) ?? [0, 0]; a[0] += p.v; a[1]++; m.set(k, a); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, [s, n]]) => ({ t, v: Math.round((10 * s) / n) / 10 }));
}

/** Valor de la serie en el instante t por interpolación lineal; null fuera de rango o con hueco > maxGapH. */
export function valueAt(points, t, maxGapH = 3) {
  let lo = 0, hi = points.length - 1; if (hi < 0 || t < points[0].t || t > points[hi].t) return null;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid].t <= t) lo = mid; else hi = mid; }
  const a = points[lo], b = points[hi]; if (b.t === a.t) return a.v; if (b.t - a.t > maxGapH * H) return null;
  return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
}

/** Tendencia: pendiente por mínimos cuadrados (cm/h) en las últimas windowH horas y cambio en 24 h. */
export function trend(points, { windowH }) {
  if (!(windowH > 0)) throw new Error('water-nl: falta «windowH» (ventana de la tendencia, en horas)');
  if (!points.length) return { last: null, rateCmH: null, change24hCm: null, n: 0 };
  const last = points[points.length - 1], w = points.filter((p) => p.t >= last.t - windowH * H);
  let rate = null;
  if (w.length >= 3) { const n = w.length, mx = w.reduce((a, p) => a + p.t, 0) / n, my = w.reduce((a, p) => a + p.v, 0) / n; let sxy = 0, sxx = 0; for (const p of w) { sxy += (p.t - mx) * (p.v - my); sxx += (p.t - mx) ** 2; } rate = sxx ? (sxy / sxx) * H : null; }
  const v24 = valueAt(points, last.t - 24 * H);
  return { last, rateCmH: rate === null ? null : Math.round(rate * 100) / 100, change24hCm: v24 === null ? null : Math.round((last.v - v24) * 10) / 10, n: w.length };
}

/** Percentil (0–100) del valor v dentro de la serie: % de puntos por debajo o iguales. */
export function percentileRank(points, v) { if (!points.length) return null; let k = 0; for (const p of points) if (p.v <= v) k++; return Math.round((1000 * k) / points.length) / 10; }

/** Pico de la previsión OFICIAL a partir de `now`. */
export function forecastPeak(forecast, now) {
  const f = forecast.filter((p) => p.t > now); if (!f.length) return null;
  const pk = f.reduce((a, p) => (p.v > a.v ? p : a), f[0]);
  return { t: pk.t, v: pk.v, inH: Math.round(((pk.t - now) / H) * 10) / 10, horizonH: Math.round(((f[f.length - 1].t - now) / H) * 10) / 10 };
}

/**
 * Diferencia entre la previsión oficial servida y lo medido donde coinciden en el tiempo. OJO: la API no dice con
 * cuánta antelación se emitió cada valor pasado, así que no es una verificación a un plazo concreto.
 */
export function forecastError(measured, forecast, { maxGapH = 3 } = {}) {
  let n = 0, sa = 0, sb = 0, mx = 0;
  for (const f of forecast) { const m = valueAt(measured, f.t, maxGapH); if (m === null) continue; const e = f.v - m; n++; sa += Math.abs(e); sb += e; mx = Math.max(mx, Math.abs(e)); }
  return n ? { n, maeCm: Math.round((10 * sa) / n) / 10, biasCm: Math.round((10 * sb) / n) / 10, maxAbsCm: Math.round(mx * 10) / 10 } : { n: 0, maeCm: null, biasCm: null, maxAbsCm: null };
}

/**
 * Tiempo de viaje entre una estación de aguas arriba y otra de aguas abajo: desfase (h) que maximiza la correlación
 * de las VARIACIONES en diffH horas (diffH filtra el ruido de la medida). Por debajo de minCorr no se da por bueno.
 */
export function travelLag(up, down, { maxLagH, minCorr, diffH }) {
  if (!(maxLagH > 0) || !(minCorr > 0) || !(diffH >= 1)) throw new Error('water-nl: faltan «maxLagH», «minCorr» y «diffH»');
  const a = new Map(hourly(up).map((p) => [p.t, p.v])), b = new Map(hourly(down).map((p) => [p.t, p.v]));
  const da = []; for (const [t, v] of a) { const v0 = a.get(t - diffH * H); if (v0 !== undefined) da.push({ t, d: v - v0 }); }
  let best = { lagH: null, corr: -Infinity, n: 0 };
  for (let lag = 0; lag <= maxLagH; lag++) {
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (const p of da) { const y1 = b.get(p.t + lag * H), y0 = b.get(p.t + (lag - diffH) * H); if (y1 === undefined || y0 === undefined) continue; const y = y1 - y0; n++; sx += p.d; sy += y; sxx += p.d * p.d; syy += y * y; sxy += p.d * y; }
    if (n < 48) continue; const den = Math.sqrt((sxx - (sx * sx) / n) * (syy - (sy * sy) / n)); if (!den) continue;
    const c = (sxy - (sx * sy) / n) / den; if (c > best.corr) best = { lagH: lag, corr: c, n };
  }
  const corr = Number.isFinite(best.corr) ? Math.round(best.corr * 100) / 100 : null, atLimit = best.lagH === maxLagH, reliable = corr !== null && corr >= minCorr && !atLimit;
  return { lagH: reliable ? best.lagH : null, corr, n: best.n, reliable, atLimit, diffH };
}

/** Periodo de la marea lunar semidiurna M2, en horas (constante astronómica). */
export const M2_HOURS = 12.4206;

/** Amplitud (cm) de la componente de marea M2 en la serie, por ajuste de mínimos cuadrados de seno y coseno. */
export function tidalAmplitudeCm(points) {
  if (points.length < 50) return null;
  const mean = points.reduce((a, p) => a + p.v, 0) / points.length, w = (2 * Math.PI) / (M2_HOURS * H);
  let sc = 0, ss = 0, cc = 0, s2 = 0, cs = 0;
  for (const p of points) { const c = Math.cos(w * p.t), s = Math.sin(w * p.t), y = p.v - mean; sc += y * c; ss += y * s; cc += c * c; s2 += s * s; cs += c * s; }
  const det = cc * s2 - cs * cs; if (!det) return null;
  const A = (sc * s2 - ss * cs) / det, B = (ss * cc - sc * cs) / det;
  return Math.round(Math.hypot(A, B) * 10) / 10;
}

/** Quita la marea: media móvil de las 25 h anteriores sobre la serie horaria (solo con la ventana completa). */
export function detide(points) {
  const h = hourly(points), out = []; let j = 0, sum = 0;
  for (let i = 0; i < h.length; i++) { sum += h[i].v; while (h[j].t < h[i].t - 24 * H) sum -= h[j++].v; const n = i - j + 1; if (n >= 25) out.push({ t: h[i].t, v: Math.round((10 * sum) / n) / 10 }); }
  return out;
}

/**
 * Reglas de SENDA para ordenar la atención (NO son niveles de alarma oficiales):
 *  - risingCmH: subida sostenida en cm/h a partir de la cual se marca «subiendo»;
 *  - fastCmH: subida rápida;
 *  - highPct: percentil dentro de la propia serie descargada a partir del cual el nivel se considera «alto para el periodo»;
 *  - peakRiseCm: la previsión oficial anuncia al menos esta subida sobre el nivel actual;
 *  - tidalMinCm: amplitud M2 medida a partir de la cual la estación se trata como «con marea»: la tendencia y el
 *    percentil se calculan sobre la serie sin marea, y la previsión solo cuenta si supera el máximo medido de la serie.
 */
export const WATCH_RULES = Object.freeze({ windowH: 6, risingCmH: 1, fastCmH: 4, highPct: 95, peakRiseCm: 25, tidalMinCm: 10 });

/** Estado de una estación. measured / forecast: series [{t,v}]. */
export function assessStation({ measured, forecast = [] }, rules = WATCH_RULES) {
  const raw = trend(measured, { windowH: rules.windowH });
  if (!raw.last) return { state: 'SIN_DATOS', reasons: ['la estación no devolvió medidas válidas'], basis: 'MEASURED' };
  const m2 = tidalAmplitudeCm(measured), tidal = m2 !== null && m2 >= rules.tidalMinCm, base = tidal ? detide(measured) : measured;
  const tr = tidal ? trend(base, { windowH: rules.windowH }) : raw;
  const pct = tr.last ? percentileRank(base, tr.last.v) : null, peak = forecastPeak(forecast, raw.last.t), err = forecastError(measured, forecast);
  const reasons = []; let score = 0; const sfx = tidal ? ' (sin marea)' : '';
  if (tr.rateCmH !== null && tr.rateCmH >= rules.fastCmH) { score += 2; reasons.push(`sube ${tr.rateCmH} cm/h${sfx} (≥ ${rules.fastCmH})`); }
  else if (tr.rateCmH !== null && tr.rateCmH >= rules.risingCmH) { score += 1; reasons.push(`sube ${tr.rateCmH} cm/h${sfx} (≥ ${rules.risingCmH})`); }
  if (pct !== null && pct >= rules.highPct) { score += 1; reasons.push(`nivel${sfx} en el percentil ${pct} de su propia serie descargada`); }
  const maxMeasured = measured.reduce((a, p) => Math.max(a, p.v), -Infinity);
  const peakRise = peak ? Math.round((peak.v - (tidal ? maxMeasured : raw.last.v)) * 10) / 10 : null;
  if (peakRise !== null && (tidal ? peakRise > 0 : peakRise >= rules.peakRiseCm)) { score += 1; reasons.push(tidal ? `la previsión oficial supera en ${peakRise} cm el máximo medido de la serie, en ${peak.inH} h` : `la previsión oficial sube ${peakRise} cm más en ${peak.inH} h`); }
  const state = score >= 3 ? 'ATENCION_ALTA' : score === 2 ? 'ATENCION' : score === 1 ? 'VIGILAR' : 'ESTABLE';
  return { state, score, reasons, basis: 'MEASURED', tidal, m2AmplitudeCm: m2, lastT: raw.last.t, lastCm: raw.last.v, rateCmH: tr.rateCmH, change24hCm: tr.change24hCm, pctOwnSeries: pct, peak, peakRiseCm: peakRise, forecastCheck: err, rules,
    disclaimer: 'Orden de atención de SENDA con reglas propias declaradas; no es un nivel de alarma oficial de Rijkswaterstaat' };
}

/** Ordena estaciones por atención (más urgente primero). */
export function rankStations(list) { return [...list].sort((a, b) => (b.assessment.score ?? -1) - (a.assessment.score ?? -1) || (b.assessment.rateCmH ?? -99) - (a.assessment.rateCmH ?? -99)); }

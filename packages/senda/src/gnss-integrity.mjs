/**
 * SENDA · Integridad GNSS a partir de ADS-B (método de GPSJam, adaptado).
 *
 * Cada avión con ADS-B emite NACp, su propia estimación de la precisión de su posición. Si en una zona muchos
 * aviones declaran precisión baja, allí el GNSS no es fiable (interferencia, inhibidores o fallos). Para
 * emergencias importa: si el GPS no es fiable, SENDA debe posicionar por otras vías (rumbos, Wi-Fi, balizas).
 *
 * - Fórmula y colores de GPSJam (gpsjam.org/faq): % malos = 100·(malos − 1)/(buenos + malos); verde < 2 %,
 *   amarillo 2–10 %, rojo > 10 %. GPSJam agrega 24 h; una foto instantánea tiene muchas menos muestras.
 * - «Precisión baja» = NACp por debajo de un umbral que hay que pasar explícitamente. GPSJam no publica el suyo.
 *   Referencia con fuente: la guía ADS-B Out de la FAA pide replanificar si NACp < 8 (FAA_NACP_MIN).
 * - No identifica la causa: no dice que haya «inhibición», solo precisión baja declarada.
 * - Filtro por defecto (DECISIÓN DE SENDA, no de GPSJam): solo ADS-B versión 2 y SIL ≥ 1. En la foto del 14-11 sobre
 *   Países Bajos y Reino Unido, los NACp bajos eran sobre todo avionetas y ultraligeros con transpondedor antiguo
 *   (versión 0/1) o integridad no declarada (SIL 0): limitación del equipo, no interferencia.
 */
export const SENDA_DEFAULT_FILTER = Object.freeze({ fn: (a) => a.version === 2 && Number.isFinite(a.sil) && a.sil >= 1, note: 'solo ADS-B v2 y SIL ≥ 1 (decisión de SENDA)' });
export const FAA_NACP_MIN = Object.freeze({ value: 8, source: 'FAA, «Guidance for ADS-B Out operations» (14 CFR 91.227): replanificar si NACp < 8' });
export const GPSJAM_LEVELS = Object.freeze({ yellowPct: 2, redPct: 10, source: 'gpsjam.org/faq' });

/** Agrega aviones en celdas de cellDeg grados. Un avión cuenta una vez por celda (por su código hex). */
export function gnssCells(aircraft, { cellDeg = 1, nacpMin, filter = SENDA_DEFAULT_FILTER.fn } = {}) {
  if (!Number.isFinite(nacpMin)) throw new Error('nacpMin obligatorio: sin umbral con fuente no se clasifica (p. ej. FAA_NACP_MIN.value)');
  const cells = new Map();
  for (const a of aircraft) {
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon) || !Number.isFinite(a.nac_p) || (filter && !filter(a))) continue;
    const ci = Math.floor(a.lat / cellDeg), cj = Math.floor(a.lon / cellDeg), key = `${ci}:${cj}`;
    const c = cells.get(key) ?? { lat: (ci + 0.5) * cellDeg, lon: (cj + 0.5) * cellDeg, good: new Set(), bad: new Set() };
    (a.nac_p < nacpMin ? c.bad : c.good).add(a.hex ?? `${a.lat},${a.lon}`); cells.set(key, c);
  }
  return [...cells.values()].map((c) => {
    const bad = c.bad.size, good = [...c.good].filter((h) => !c.bad.has(h)).length, n = good + bad;
    const pct = n ? Math.max(0, (100 * (bad - 1)) / n) : 0;
    const level = pct > GPSJAM_LEVELS.redPct ? 'red' : pct >= GPSJAM_LEVELS.yellowPct ? 'yellow' : 'green';
    return { lat: c.lat, lon: c.lon, good, bad, n, pctBad: pct, level };
  });
}

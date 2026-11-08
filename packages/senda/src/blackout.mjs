/**
 * SENDA · Previsión de apagón de comunicaciones y colocación óptima de pasarelas.
 *
 * Lección del apagón ibérico del 28-04-2025: la red móvil no cae cuando se va la luz, cae
 * cuando se agotan las baterías de las antenas («apenas unas horas»); los usuarios con
 * conexión estable bajaron del 90 % al 40 % hacia las 15:00 (fuentes en docs/research).
 * Nadie entrega a protección civil un MAPA DE CUÁNDO Y DÓNDE se va a quedar a oscuras la
 * población. SENDA lo calcula y dice dónde colocar pasarelas (Iridium, LoRa, satélite de
 * banda ancha, dron) ANTES de que ocurra.
 *
 * Modelo:
 *  - Supervivencia de cada antena tras el corte: Weibull S(t) = exp(-(t/λ)^β), con mediana
 *    por clase de respaldo (batería, batería ampliada, generador).
 *  - Celda de población cubierta si sobrevive al menos una antena en alcance:
 *    P(cubierta) = 1 − Π(1 − S_i(t)).
 *  - Pasarelas: maximizar población a oscuras alcanzada; función submodular → el algoritmo
 *    voraz garantiza ≥ (1 − 1/e) ≈ 63 % del óptimo (Nemhauser-Wolsey-Fisher, 1978).
 */
const R = 6371000;
export const distM = (a, b) => { const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

/** Clases de respaldo energético. Medianas de planificación; sustituir por inventario del operador. */
export const BACKUP = Object.freeze({
  BATTERY: { medianH: 2.0, shape: 2.2, label: 'Baterías estándar («apenas unas horas»)' },
  EXTENDED: { medianH: 6, shape: 2.5, label: 'Baterías ampliadas' },
  GENERATOR: { medianH: 48, shape: 3, label: 'Grupo electrógeno con combustible' },
});

export function survival(tH, { medianH, shape }) {
  if (tH <= 0) return 1;
  const lambda = medianH / Math.log(2) ** (1 / shape);
  return Math.exp(-((tH / lambda) ** shape));
}

/** OpenCelliD (CSV): radio,mcc,net,area,cell,unit,lon,lat,range,samples,changeable,created,updated,averageSignal */
export function parseOpenCellId(csv) {
  return csv.trim().split(/\r?\n/).filter((l) => l && !/^radio,/i.test(l)).map((l) => {
    const c = l.split(',');
    return { radio: c[0], mcc: +c[1], net: +c[2], area: +c[3], cell: +c[4], lon: +c[6], lat: +c[7], rangeM: Math.max(200, Math.min(+c[8] || 1500, 15000)) };
  }).filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon));
}

/** Probabilidad de cobertura de una celda a las tH horas del corte. */
export function cellCoverage(cell, towers, tH) {
  let none = 1;
  for (const t of towers) if (distM(cell, t) <= t.rangeM) none *= 1 - survival(tH, BACKUP[t.backup ?? 'BATTERY']);
  return 1 - none;
}

/** Evolución de la población con cobertura y mapa por celda. */
export function forecastBlackout({ towers, cells, hours = [0, 1, 2, 3, 4, 6, 8, 12, 24] }) {
  const pop = cells.reduce((a, c) => a + c.pop, 0);
  const timeline = hours.map((h) => {
    const covered = cells.reduce((a, c) => a + c.pop * cellCoverage(c, towers, h), 0);
    return { h, coveredPct: +((100 * covered) / pop).toFixed(1), darkPeople: Math.round(pop - covered) };
  });
  const halfDark = timeline.find((x) => x.coveredPct < 50);
  return { population: pop, timeline, halfDarkAtH: halfDark ? halfDark.h : null };
}

/**
 * Ajusta la mediana de las baterías estándar a una observación (h, fracción conectada relativa)
 * por bisección. Con la observación pública del 28-04-2025 se obtiene un orden de magnitud,
 * no un modelo de operador.
 */
export function calibrateBatteryMedian({ towers, cells, observation: { h, relativeConnected } }) {
  let lo = 0.2, hi = 24;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const model = { ...BACKUP.BATTERY, medianH: mid };
    const pop = cells.reduce((a, c) => a + c.pop, 0);
    const cov = cells.reduce((a, c) => { let none = 1; for (const t of towers) if (distM(c, t) <= t.rangeM) none *= 1 - survival(h, t.backup && t.backup !== 'BATTERY' ? BACKUP[t.backup] : model); return a + c.pop * (1 - none); }, 0) / pop;
    if (cov > relativeConnected) hi = mid; else lo = mid;
  }
  return +((lo + hi) / 2).toFixed(2);
}

/**
 * Colocación voraz de k pasarelas (radio `radiusM`) entre `candidates` para maximizar la
 * población que quedaría a oscuras a las tH horas y que la pasarela alcanzaría.
 */
export function placeGateways({ towers, cells, candidates, k = 3, radiusM = 2000, tH = 4 }) {
  const dark = cells.map((c) => ({ ...c, w: c.pop * (1 - cellCoverage(c, towers, tH)) }));
  const total = dark.reduce((a, c) => a + c.w, 0);
  const served = new Set(); const picks = [];
  for (let i = 0; i < k; i++) {
    let best = null;
    for (const g of candidates) {
      if (picks.some((p) => p.id === g.id)) continue;
      let gain = 0; for (let j = 0; j < dark.length; j++) if (!served.has(j) && distM(dark[j], g) <= radiusM) gain += dark[j].w;
      if (!best || gain > best.gain) best = { ...g, gain };
    }
    if (!best || best.gain <= 0) break;
    dark.forEach((c, j) => { if (distM(c, best) <= radiusM) served.add(j); });
    picks.push({ id: best.id, lat: best.lat, lon: best.lon, kind: best.kind, peopleReached: Math.round(best.gain) });
  }
  const reached = picks.reduce((a, p) => a + p.peopleReached, 0);
  return { picks, darkPeople: Math.round(total), reachedPct: total ? +((100 * reached) / total).toFixed(1) : 0 };
}

/** Escenario sintético reproducible (ciudad media) para la web y las pruebas. */
export function syntheticCity({ seed = 7, towers = 60, cellsPerSide = 24, center = { lat: 39.47, lon: -0.38 }, sizeKm = 12 } = {}) {
  let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const dLat = sizeKm / 111.32, dLon = sizeKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const cells = [];
  for (let i = 0; i < cellsPerSide; i++) for (let j = 0; j < cellsPerSide; j++) {
    const lat = center.lat - dLat / 2 + (i + 0.5) * (dLat / cellsPerSide), lon = center.lon - dLon / 2 + (j + 0.5) * (dLon / cellsPerSide);
    const r = Math.hypot(i - cellsPerSide / 2, j - cellsPerSide / 2) / (cellsPerSide / 2);
    cells.push({ id: `c${i}-${j}`, lat, lon, pop: Math.round(3000 * Math.exp(-2.2 * r * r) + 80 * rnd()) });
  }
  const T = [];
  for (let n = 0; n < towers; n++) {
    const u = rnd(), backup = u < 0.9 ? 'BATTERY' : u < 0.98 ? 'EXTENDED' : 'GENERATOR'; // «baja penetración» de respaldo
    T.push({ id: `t${n}`, lat: center.lat + (rnd() - 0.5) * dLat * 0.95, lon: center.lon + (rnd() - 0.5) * dLon * 0.95, rangeM: 900 + 1100 * rnd(), backup });
  }
  const candidates = cells.filter((_, i) => i % 7 === 0).map((c) => ({ id: `g-${c.id}`, lat: c.lat, lon: c.lon, kind: 'IRIDIUM_SBD + MESHTASTIC' }));
  return { cells, towers: T, candidates, center };
}

/**
 * SENDA · Incendio forestal: frente de llama, antenas que caen y alertas que deben salir ANTES.
 *
 * 1. `arrivalTimes`: tiempo mínimo de llegada del fuego a cada celda (método de «tiempo mínimo
 *    de viaje» sobre una malla, el mismo enfoque que usan los simuladores operativos), con:
 *    - velocidad base por combustible (sin viento ni pendiente),
 *    - propagación ELÍPTICA por viento (el foco de ignición en el foco trasero de la elipse),
 *    - factor de pendiente con la forma de Rothermel (∝ tan²φ, solo ladera arriba).
 *    Coeficientes ILUSTRATIVOS y configurables: para operación se acopla a modelos validados
 *    (Rothermel/FARSITE, Wildfire Analyst) y a combustibles reales; este módulo aporta el cruce.
 * 2. `assessAssets`: para cada población, cuándo llega el fuego, cuándo hay que avisar
 *    (llegada − evacuación − notificación) y CUÁNDO SE QUEDA SIN ANTENAS. Si las antenas caen
 *    antes de la hora límite, la alerta debe salir ya o por portadores sin red (`bearers.mjs`).
 * 3. `parseFirmsCsv`: focos de satélite NASA FIRMS (VIIRS/MODIS) como igniciones.
 * SENDA no dirige la extinción: propone alertas y colocación de pasarelas al centro de mando.
 */
import { planMultiBearer } from './bearers.mjs';

export const FUELS = Object.freeze({
  0: { key: 'NONE', label: 'Sin combustible (agua, roca)', r0: 0 },
  1: { key: 'GRASS', label: 'Pasto', r0: 6 },
  2: { key: 'SHRUB', label: 'Matorral', r0: 3 },
  3: { key: 'FOREST', label: 'Arbolado', r0: 1.5 },
  4: { key: 'URBAN', label: 'Urbano', r0: 0.4 },
  5: { key: 'ROAD', label: 'Carretera / cortafuegos', r0: 0.15 },
}); // r0 en m/min (ilustrativo)

/** Factor de viento de cabeza y relación longitud/anchura de la elipse (hipótesis, LB ≤ 8). */
export function windShape(windKmh, { a = 0.1, b = 1.4, lbPerKmh = 0.1 } = {}) {
  const head = 1 + a * Math.max(0, windKmh) ** b;
  const lb = Math.min(8, 1 + lbPerKmh * Math.max(0, windKmh));
  return { head, lb, ecc: Math.sqrt(1 - 1 / (lb * lb)) };
}

/** Velocidad (m/min) en la dirección `dirRad` (hacia donde avanza) dado el viento que SOPLA HACIA `windToRad`. */
export function directionalRos(r0, dirRad, { windKmh, windToRad }, slopeTan = 0, { beta = 0.01 } = {}) {
  if (r0 <= 0) return 0;
  const { head, ecc } = windShape(windKmh);
  const ellipse = (head * (1 - ecc)) / (1 - ecc * Math.cos(dirRad - windToRad));
  const slope = slopeTan > 0 ? 5.275 * beta ** -0.3 * slopeTan * slopeTan : 0; // forma de Rothermel
  return r0 * ellipse * (1 + slope);
}

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];

/**
 * @param {{w:number,h:number,cellM:number,fuel:Uint8Array,elev?:Float32Array}} grid
 * @param {Array<{x:number,y:number,t?:number}>} ignitions celdas (x hacia el este, y hacia el SUR) y minuto de ignición
 * @param {{windKmh:number, windToDeg:number}} weather dirección HACIA la que sopla, en grados (0 = este, 90 = sur)
 * @returns {Float32Array} minutos de llegada (Infinity si no llega antes de maxMin)
 */
export function arrivalTimes(grid, ignitions, weather, { maxMin = 720 } = {}) {
  const { w, h, cellM, fuel, elev } = grid, n = w * h, T = new Float32Array(n).fill(Infinity);
  const wx = { windKmh: weather.windKmh, windToRad: (weather.windToDeg * Math.PI) / 180 };
  const heap = []; // montículo binario de [t, idx]
  const push = (t, i) => { heap.push([t, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  for (const g of ignitions) { const i = g.y * w + g.x; if (g.x >= 0 && g.x < w && g.y >= 0 && g.y < h && FUELS[fuel[i]].r0 > 0) { T[i] = Math.min(T[i], g.t ?? 0); push(T[i], i); } }
  while (heap.length) {
    const [t, i] = pop(); if (t > T[i] || t > maxMin) continue;
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx, dist = Math.hypot(dx, dy) * cellM, dir = Math.atan2(dy, dx);
      const tan = elev ? (elev[j] - elev[i]) / dist : 0;
      const ra = directionalRos(FUELS[fuel[i]].r0, dir, wx, tan), rb = directionalRos(FUELS[fuel[j]].r0, dir, wx, tan);
      if (ra <= 0 || rb <= 0) continue;
      const nt = t + (dist / 2) * (1 / ra + 1 / rb);
      if (nt < T[j] && nt <= maxMin) { T[j] = nt; push(T[j], j); } // push del valor float32 guardado: si no, el pop lo descarta
    }
  }
  return T;
}

/** Superficie quemada (ha) y celdas del frente activo en el minuto t. */
export function perimeterAt(grid, T, tMin) {
  let burned = 0; const front = [];
  for (let i = 0; i < T.length; i++) if (T[i] <= tMin) { burned++; if (T[i] > tMin - 15) front.push(i); }
  return { burnedHa: +((burned * grid.cellM * grid.cellM) / 10000).toFixed(1), front };
}

const minIn = (grid, T, { x, y, r = 0 }) => { let m = Infinity; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < grid.w && Y < grid.h) m = Math.min(m, T[Y * grid.w + X]); } return m; };

/** Portadores sin red disponibles en una población cuando ya no queda antena. */
export const OFFLINE_BEARERS = Object.freeze([{ id: 'PHONE_MESH' }, { id: 'MESHTASTIC' }, { id: 'SAT_D2C_SMS' }, { id: 'IRIDIUM_SBD' }, { id: 'DRONE_MULE' }]);

/**
 * @param {Array<{id,name,x,y,r?,population,evacMin}>} towns
 * @param {Array<{id,x,y,serves:string[]}>} towers antenas y poblaciones a las que dan cobertura
 */
export function assessAssets(grid, T, towns, towers, { nowMin = 0, notifyMin = 10, towerMarginMin = 10, alertBytes = 220 } = {}) {
  const towerLoss = towers.map((tw) => ({ ...tw, lossMin: minIn(grid, T, { ...tw, r: 1 }) - towerMarginMin }));
  return towns.map((tn) => {
    const arrivalMin = minIn(grid, T, tn);
    const serving = towerLoss.filter((tw) => tw.serves.includes(tn.id));
    const commsLossMin = serving.length ? Math.max(...serving.map((tw) => tw.lossMin)) : -Infinity; // sin cobertura cuando caen TODAS
    const deadlineMin = arrivalMin - tn.evacMin - notifyMin;
    const lead = deadlineMin - nowMin;
    const status = !Number.isFinite(arrivalMin) ? 'FUERA_DE_ALCANCE' : lead <= 0 ? 'EVACUAR_YA' : lead <= tn.evacMin ? 'PREPARAR' : 'VIGILAR';
    const sendByMin = Math.min(deadlineMin, commsLossMin);
    const antennaFirst = Number.isFinite(arrivalMin) && commsLossMin < deadlineMin;
    const plan = antennaFirst ? planMultiBearer(alertBytes, OFFLINE_BEARERS) : null;
    return { id: tn.id, name: tn.name, population: tn.population, arrivalMin, deadlineMin, commsLossMin, sendByMin, antennaFirst, status,
      channel: !antennaFirst ? 'RED_MOVIL_Y_ES_ALERT' : sendByMin > nowMin ? 'AVISAR_YA_POR_RED_MOVIL' : 'PORTADORES_SIN_RED',
      offlinePlan: plan && { k: plan.k, n: plan.n, pDelivery: +plan.pDelivery.toFixed(4), etaS: plan.etaS, bearers: [...new Set(plan.messages.map((m) => m.id))] } };
  }).sort((a, b) => a.sendByMin - b.sendByMin);
}

/** CSV de NASA FIRMS (columnas por nombre: latitude, longitude, acq_date, acq_time, confidence, frp). */
export function parseFirmsCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split(',').map((c) => c.trim());
  const at = (r, k) => r[cols.indexOf(k)];
  return rows.map((l) => l.split(',')).filter((r) => r.length === cols.length).map((r) => ({
    lat: +at(r, 'latitude'), lon: +at(r, 'longitude'), frp: +(at(r, 'frp') ?? 0), confidence: at(r, 'confidence'),
    when: `${at(r, 'acq_date')}T${String(at(r, 'acq_time')).padStart(4, '0').replace(/(\d\d)(\d\d)/, '$1:$2')}Z`, satellite: at(r, 'satellite') ?? null,
  }));
}

/** Foco FIRMS → celda de la malla georreferenciada (esquina NO en `origin`). */
export function firmsToIgnitions(points, grid, origin) {
  const mLat = 111320, mLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return points.map((p) => ({ x: Math.floor(((p.lon - origin.lon) * mLon) / grid.cellM), y: Math.floor(((origin.lat - p.lat) * mLat) / grid.cellM), t: 0 }))
    .filter((c) => c.x >= 0 && c.y >= 0 && c.x < grid.w && c.y < grid.h);
}

/** Paisaje sintético determinista (colinas, combustibles, río, carretera, 3 pueblos, 5 antenas). Ilustrativo. */
export function syntheticLandscape({ w = 96, h = 64, cellM = 100, seed = 5 } = {}) {
  let s = seed >>> 0; const R = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const hills = Array.from({ length: 7 }, () => ({ x: R() * w, y: R() * h, a: 60 + R() * 220, r: 8 + R() * 16 }));
  const elev = new Float32Array(w * h), fuel = new Uint8Array(w * h);
  const towns = [
    { id: 'A', name: 'Valdeolmos', x: 70, y: 20, r: 3, population: 2400, evacMin: 45 },
    { id: 'B', name: 'Navalcerro', x: 78, y: 48, r: 2, population: 900, evacMin: 30 },
    { id: 'C', name: 'Hoyarrubia', x: 24, y: 50, r: 2, population: 600, evacMin: 30 },
  ];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    elev[i] = 600 + hills.reduce((a, q) => a + q.a * Math.exp(-((x - q.x) ** 2 + (y - q.y) ** 2) / (2 * q.r * q.r)), 0);
    const n = Math.sin(x * 0.31 + seed) * Math.cos(y * 0.27) + (R() - 0.5) * 0.9;
    fuel[i] = n > 0.45 ? 1 : n > -0.2 ? 2 : 3;
    if (Math.abs(y - (40 + 6 * Math.sin(x / 9))) < 0.8) fuel[i] = 0; // río
    if (x === 55 && y < 36) fuel[i] = 5; // carretera
    for (const t of towns) if (Math.abs(x - t.x) <= t.r && Math.abs(y - t.y) <= t.r) fuel[i] = 4;
  }
  const towers = [
    { id: 'T1', x: 50, y: 16, serves: ['B'] }, { id: 'T2', x: 58, y: 26, serves: ['A'] },
    { id: 'T3', x: 84, y: 56, serves: ['B'] }, { id: 'T4', x: 30, y: 44, serves: ['C'] }, { id: 'T5', x: 18, y: 58, serves: ['C'] },
  ];
  return { grid: { w, h, cellM, fuel, elev }, towns, towers, disclaimer: 'Paisaje sintético e ilustrativo; combustibles y coeficientes no calibrados.' };
}

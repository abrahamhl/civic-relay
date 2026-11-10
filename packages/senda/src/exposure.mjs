/**
 * SENDA · Motor de exposición: cuánta gente hay en una zona y cómo avisarla antes.
 *
 * Por qué: un aviso vale lo que vale la gente a la que llega a tiempo. Una carretera con 3.000
 * veh/h a 100 km/h no se avisa igual que una con 200 veh/h; un barrio a las 4:00 no tiene la misma
 * gente que a las 12:00. Este módulo da a SENDA esa conciencia, con datos públicos y AGREGADOS
 * (nunca personas individuales, nunca trayectorias):
 *
 *  1. Población residente oficial: rejilla 1 km² de Eurostat/GISCO (censo 2021, ETRS89-LAEA,
 *     EPSG:3035). Proyección exacta según EPSG Guidance Note 7-2 (§ Lambert Azimuthal Equal Area).
 *  2. Tráfico real: intensidad y velocidad por estación (Digitraffic, NDW…) o intensidad y
 *     ocupación por detector (Informo Madrid). Relación fundamental q = k·v ⇒ vehículos = q·L/v.
 *  3. Dispositivos SENDA con permiso, solo como recuento agregado k-anónimo (cota inferior).
 *  4. Plan de aviso en carretera ADAPTADO A LA DENSIDAD: distancia de peligro (parada + avance de
 *     la cola por onda de choque LWR), probabilidad EXACTA de que la cadena de retransmisión llegue
 *     a todos (proceso de Poisson en 1D, ecuación de renovación), saltos y retardos calculados en
 *     lugar de fijos. Compara con la política fija actual (3 saltos, 2 km).
 *  5. Priorización de alertas por personas expuestas esperadas, con intervalo.
 *
 * Todo factor que no sale de un dato medido (presencia diurna, ocupantes por vehículo, longitud
 * efectiva) es una HIPÓTESIS declarada y sustituible.
 */

/* ------------------------------------------------------------------ 1. EPSG:3035 */
const A_GRS80 = 6378137;
const F_GRS80 = 1 / 298.257222101;
const E2 = F_GRS80 * (2 - F_GRS80);
const E = Math.sqrt(E2);
const LAT0 = (52 * Math.PI) / 180, LON0 = (10 * Math.PI) / 180, FE = 4321000, FN = 3210000;
const qOf = (phi) => { const s = Math.sin(phi); return (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s))); };
const QP = qOf(Math.PI / 2);
const RQ = A_GRS80 * Math.sqrt(QP / 2);
const BETA0 = Math.asin(qOf(LAT0) / QP);
const D_LAEA = (A_GRS80 * Math.cos(LAT0) / Math.sqrt(1 - E2 * Math.sin(LAT0) ** 2)) / (RQ * Math.cos(BETA0));

/** (lat, lon) ETRS89 en grados → { x: Easting, y: Northing } EPSG:3035 en metros. */
export function toLaea(lat, lon) {
  const phi = (lat * Math.PI) / 180, dl = (lon * Math.PI) / 180 - LON0;
  const beta = Math.asin(qOf(phi) / QP);
  const B = RQ * Math.sqrt(2 / (1 + Math.sin(BETA0) * Math.sin(beta) + Math.cos(BETA0) * Math.cos(beta) * Math.cos(dl)));
  return {
    x: FE + B * D_LAEA * Math.cos(beta) * Math.sin(dl),
    y: FN + (B / D_LAEA) * (Math.cos(BETA0) * Math.sin(beta) - Math.sin(BETA0) * Math.cos(beta) * Math.cos(dl)),
  };
}

/** EPSG:3035 { x, y } → { lat, lon } ETRS89 en grados. */
export function fromLaea(x, y) {
  const dx = (x - FE) / D_LAEA, dy = D_LAEA * (y - FN);
  const rho = Math.hypot(dx, dy);
  if (rho < 1e-9) return { lat: 52, lon: 10 };
  const C = 2 * Math.asin(rho / (2 * RQ));
  const betaP = Math.asin(Math.cos(C) * Math.sin(BETA0) + (D_LAEA * (y - FN) * Math.sin(C) * Math.cos(BETA0)) / rho);
  const lon = LON0 + Math.atan2((x - FE) * Math.sin(C), D_LAEA * rho * Math.cos(BETA0) * Math.cos(C) - D_LAEA * D_LAEA * (y - FN) * Math.sin(BETA0) * Math.sin(C));
  const e4 = E2 * E2, e6 = e4 * E2;
  const phi = betaP + (E2 / 3 + (31 * e4) / 180 + (517 * e6) / 5040) * Math.sin(2 * betaP)
    + ((23 * e4) / 360 + (251 * e6) / 3780) * Math.sin(4 * betaP) + ((761 * e6) / 45360) * Math.sin(6 * betaP);
  return { lat: (phi * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}

/* ------------------------------------------------------------------ 2. población residente */

/**
 * Presencia relativa de residentes en su celda según hora y tipo de día (HIPÓTESIS DE
 * PLANIFICACIÓN, no medida): el censo cuenta dónde se DUERME. Sustituir por datos de movilidad
 * con teléfonos (estudio MITMA, INE) cuando se integren.
 */
export const RESIDENT_PRESENCE = Object.freeze({
  night: 0.95,    // 00:00–06:59
  morning: 0.6,   // 07:00–09:59 (laborable)
  day: 0.45,      // 10:00–17:59 (laborable)
  evening: 0.8,   // 18:00–23:59
  weekendDay: 0.75,
});
export function residentPresenceFactor(hour, { weekend = false } = {}) {
  if (!(hour >= 0 && hour < 24)) throw new RangeError('hour ∈ [0, 24)');
  if (hour < 7) return RESIDENT_PRESENCE.night;
  if (weekend) return hour >= 18 ? RESIDENT_PRESENCE.evening : RESIDENT_PRESENCE.weekendDay;
  if (hour < 10) return RESIDENT_PRESENCE.morning;
  if (hour < 18) return RESIDENT_PRESENCE.day;
  return RESIDENT_PRESENCE.evening;
}

/**
 * Residentes dentro de un círculo (centro lat/lon, radio en m) sobre celdas de 1 km² en EPSG:3035
 * ({ x_llc, y_llc, pop }, esquina inferior izquierda). Fracción de celda por muestreo regular
 * 10×10 (error de área ≤ 1 %), suponiendo población uniforme dentro de cada celda.
 */
export function residentsInCircle(cells, { lat, lon, radiusM }, { cellM = 1000, samples = 10 } = {}) {
  if (!(radiusM > 0)) throw new RangeError('radiusM > 0');
  const c = toLaea(lat, lon);
  let total = 0, touched = 0;
  const step = cellM / samples;
  for (const cell of cells) {
    const cx = cell.x_llc + cellM / 2, cy = cell.y_llc + cellM / 2;
    // Descarte rápido: la celda entera queda fuera del círculo.
    if (Math.hypot(cx - c.x, cy - c.y) > radiusM + cellM * Math.SQRT1_2) continue;
    let inside = 0;
    for (let i = 0; i < samples; i++) for (let j = 0; j < samples; j++) {
      if (Math.hypot(cell.x_llc + (i + 0.5) * step - c.x, cell.y_llc + (j + 0.5) * step - c.y) <= radiusM) inside++;
    }
    if (inside) { total += cell.pop * (inside / (samples * samples)); touched++; }
  }
  return { residents: total, cellsTouched: touched };
}

/* ------------------------------------------------------------------ 3. tráfico real */

/**
 * Densidad (veh/km/carril) a partir de la ocupación del detector: k = ocupación / L_eff, con
 * L_eff = longitud media del vehículo + longitud del lazo (HIPÓTESIS 6,5 m, típica en la literatura).
 */
export const densityFromOccupancy = (occupancyPct, { effLengthM = 6.5 } = {}) => Math.max(0, occupancyPct) / 100 * (1000 / effLengthM);

/**
 * Exposición de un tramo: vehículos = q·L/v (relación fundamental) y personas = vehículos × ocupantes.
 * `occupantsPerVehicle` es una HIPÓTESIS (por defecto 1,4; sustituir por aforos de ocupación).
 */
export function roadSegmentExposure({ flowVehH, speedKmh, lengthKm, occupantsPerVehicle = 1.4 }) {
  if (!(flowVehH >= 0 && speedKmh > 0 && lengthKm > 0)) throw new RangeError('flowVehH ≥ 0, speedKmh > 0, lengthKm > 0');
  const densityVehKm = flowVehH / speedKmh;
  const vehicles = densityVehKm * lengthKm;
  // Recuento de Poisson: intervalo aproximado del 90 % (±1,645·√N), más la incertidumbre de ocupantes (1,1–1,8).
  const sd = Math.sqrt(vehicles);
  return {
    densityVehKm, vehicles,
    persons: vehicles * occupantsPerVehicle,
    persons90: [Math.max(0, (vehicles - 1.645 * sd) * 1.1), (vehicles + 1.645 * sd) * 1.8],
  };
}

/** Digitraffic TMS (`/api/tms/v1/stations/data`) → por estación y sentido: q (veh/h) y v (km/h). */
export function parseDigitrafficTms(json) {
  if (!json || !Array.isArray(json.stations)) throw new TypeError('Digitraffic: falta stations[]');
  const out = [];
  for (const st of json.stations) {
    const v = Object.fromEntries((st.sensorValues ?? []).map((s) => [s.name, s.value]));
    for (const dir of [1, 2]) {
      const q = v[`OHITUKSET_60MIN_KIINTEA_SUUNTA${dir}`];
      const speed = v[`KESKINOPEUS_5MIN_LIUKUVA_SUUNTA${dir}`] ?? v[`KESKINOPEUS_60MIN_KIINTEA_SUUNTA${dir}`];
      if (Number.isFinite(q) && q >= 0 && Number.isFinite(speed) && speed > 5) {
        out.push({ stationId: st.id, direction: dir, flowVehH: q, speedKmh: speed, updated: st.dataUpdatedTime ?? null });
      }
    }
  }
  return out;
}

/** Informo Madrid (`pm.xml`) → por detector: q (veh/h), ocupación (%), carga y posición WGS84. */
export function parseMadridPm(xml, { fromUtm }) {
  const out = [];
  const num = (s) => (s == null ? NaN : Number(String(s).trim().replace(',', '.')));
  for (const m of String(xml).matchAll(/<pm>([\s\S]*?)<\/pm>/g)) {
    const get = (tag) => (m[1].match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) ?? [])[1];
    if ((get('error') ?? '').trim() !== 'N') continue;
    const x = num(get('st_x')), y = num(get('st_y')), q = num(get('intensidad')), occ = num(get('ocupacion'));
    if (![x, y, q, occ].every(Number.isFinite)) continue;
    const { lat, lon } = fromUtm(x, y, 30);
    out.push({ id: (get('idelem') ?? '').trim(), flowVehH: q, occupancyPct: occ, load: num(get('carga')), lat, lon });
  }
  return out;
}

/* ------------------------------------------------------------------ 4. plan de aviso adaptativo */

/**
 * Probabilidad EXACTA de que una cadena de retransmisión de alcance r recorra una distancia D
 * cuando los vehículos equipados forman un proceso de Poisson de intensidad λ (veh/m): todos los
 * huecos consecutivos desde el origen y dentro de [0, D] deben ser ≤ r.
 * Ecuación de renovación (huecos exponenciales sin memoria):
 *   f(x) = e^{−λx} + ∫₀^{min(x,r)} λ e^{−λt} f(x − t) dt ,   P = f(D)
 * resuelta por cuadratura trapezoidal en una malla uniforme (error O(h²)).
 */
export function chainCoverageProbability({ lambdaPerM, rangeM, distanceM, steps = 4000 }) {
  if (!(lambdaPerM >= 0 && rangeM > 0 && distanceM >= 0)) throw new RangeError('λ ≥ 0, r > 0, D ≥ 0');
  if (distanceM <= rangeM || lambdaPerM === 0) return 1; // todos los equipados están ya al alcance (o no hay ninguno)
  const n = Math.max(200, Math.min(steps, Math.ceil(distanceM / (rangeM / 50))));
  const h = distanceM / n, w = Math.round(rangeM / h);
  const f = new Float64Array(n + 1);
  const ker = (t) => lambdaPerM * Math.exp(-lambdaPerM * t);
  for (let i = 0; i <= n; i++) {
    const x = i * h;
    let integral = 0;
    const m = Math.min(i, w);
    if (m > 0) {
      // ∫₀^{m·h} ker(t) f(x−t) dt; la parte implícita (t = 0 usa f(x)) se despeja.
      for (let j = 1; j < m; j++) integral += ker(j * h) * f[i - j];
      integral += 0.5 * ker(m * h) * f[i - m];
      integral *= h;
      const selfWeight = 0.5 * h * ker(0);
      f[i] = (Math.exp(-lambdaPerM * x) + integral) / (1 - selfWeight);
    } else {
      f[i] = 1;
    }
  }
  return Math.min(1, Math.max(0, f[n]));
}

/**
 * Probabilidad de que la cadena alcance a un vehículo equipado situado a distancia x del origen
 * (todos los huecos intermedios ≤ r, incluido el último hasta x). Con un nodo intermedio en y:
 *   c(x) = 1{x ≤ r}·e^{−λx} + ∫_{max(0,x−r)}^{x} λ e^{−λ(x−y)} c(y) dy
 * Devuelve la curva c en la malla y la FRACCIÓN ESPERADA de equipados de [0, D] alcanzados,
 *   ∫₀^D λ c(x) dx / (λD),  que sí crece con la penetración (a diferencia de «alcanzar a todos»,
 * casi seguro cuando apenas hay equipados porque no hay a quién llegar).
 */
export function chainReachProfile({ lambdaPerM, rangeM, distanceM, steps = 3000 }) {
  if (!(lambdaPerM > 0 && rangeM > 0 && distanceM > 0)) throw new RangeError('λ > 0, r > 0, D > 0');
  const n = Math.max(200, Math.min(steps, Math.ceil(distanceM / (rangeM / 50))));
  const h = distanceM / n, w = Math.round(rangeM / h);
  const c = new Float64Array(n + 1);
  const ker = (d) => lambdaPerM * Math.exp(-lambdaPerM * d);
  for (let i = 0; i <= n; i++) {
    const x = i * h;
    if (x <= rangeM) { c[i] = 1; continue; }        // alcance directo desde el origen
    // Trapecio completo sobre y ∈ [x − r, x] con el extremo y = x implícito (peso ½·λ·h·c(x)).
    const jA = i - w;
    let acc = 0.5 * ker(x - jA * h) * c[jA];
    for (let j = jA + 1; j < i; j++) acc += ker(x - j * h) * c[j];
    c[i] = Math.min(1, (acc * h) / (1 - 0.5 * h * ker(0)));
  }
  let integral = 0;
  for (let i = 1; i <= n; i++) integral += 0.5 * (c[i] + c[i - 1]) * h;
  return { reachedFraction: integral / distanceM, reachAtEnd: c[n] };
}

/**
 * Avance esperado por salto con reenvío por el vecino MÁS LEJANO dentro del alcance (temporizador
 * por distancia: quien está más lejos retransmite antes). Para Poisson(λ) en (0, r]:
 *   P(X ≤ x) = e^{−λ(r−x)},  E[X | ≥1 vecino] = (r − (1 − e^{−λr})/λ) / (1 − e^{−λr}).
 */
export function expectedHopProgressM(lambdaPerM, rangeM) {
  if (!(lambdaPerM > 0)) return 0;
  const p1 = 1 - Math.exp(-lambdaPerM * rangeM);
  return (rangeM - p1 / lambdaPerM) / p1;
}

/**
 * Plan de aviso en carretera adaptado a la densidad real.
 * @param {object} o
 * @param {number} o.flowVehH  intensidad del sentido afectado (todos los carriles), veh/h
 * @param {number} o.speedKmh  velocidad media aguas arriba
 * @param {number} [o.penetration=0.1]  fracción de vehículos con SENDA
 * @param {number} [o.rangeM=60]  alcance útil de radio (BLE en carretera, prudente)
 * @param {number} [o.reactS=1.5]  tiempo de reacción del conductor avisado
 * @param {number} [o.decelMs2=4.5]  deceleración de frenada firme pero controlada
 * @param {number} [o.horizonS=60]  horizonte durante el que la cola crece aguas arriba
 * @param {number} [o.jamDensityVehKmLane=133]  densidad de atasco por carril (≈ 7,5 m por vehículo)
 * @param {number} [o.lanes=2]
 * @param {number} [o.maxBackoffMs=40]  temporizador máximo de contienda por salto
 * @param {number} [o.airtimeMs=2]  duración de una trama (24 B en BLE: < 1 ms; 2 ms prudente)
 */
export function roadWarningPlan({
  flowVehH, speedKmh, penetration = 0.1, rangeM = 60, reactS = 1.5, decelMs2 = 4.5, horizonS = 60,
  jamDensityVehKmLane = 133, lanes = 2, maxBackoffMs = 40, airtimeMs = 2, occupantsPerVehicle = 1.4,
  fixedPolicy = { maxHops: 3, maxAheadM: 2000 },
}) {
  if (!(flowVehH > 0 && speedKmh > 0)) throw new RangeError('flowVehH > 0 y speedKmh > 0');
  if (!(penetration > 0 && penetration <= 1)) throw new RangeError('penetration ∈ (0, 1]');
  const v = speedKmh / 3.6;
  const kVehKm = flowVehH / speedKmh;                       // densidad total del sentido
  const kJam = jamDensityVehKmLane * lanes;
  // Onda de choque LWR entre el flujo que llega (q, k) y la cola parada (0, k_jam): w = q / (k_jam − k).
  const shockMs = kVehKm < kJam ? (flowVehH / (kJam - kVehKm)) / 3.6 : 0;
  const stoppingM = v * reactS + (v * v) / (2 * decelMs2);
  const dangerM = stoppingM + shockMs * horizonS;           // zona donde un vehículo puede alcanzar la cola
  const vehiclesAtRisk = (kVehKm * dangerM) / 1000;

  const lambda = (penetration * kVehKm) / 1000;             // vehículos equipados por metro
  const pAllReached = chainCoverageProbability({ lambdaPerM: lambda, rangeM, distanceM: dangerM });
  const reach = chainReachProfile({ lambdaPerM: lambda, rangeM, distanceM: dangerM });
  const progress = expectedHopProgressM(lambda, rangeM);
  const hops = progress > 0 ? Math.ceil(Math.max(0, dangerM - rangeM) / progress) + 1 : Infinity;
  const backoffMs = progress > 0 ? maxBackoffMs * (1 - progress / rangeM) : maxBackoffMs;
  const multiHopLatencyS = Number.isFinite(hops) ? (hops * (backoffMs + airtimeMs)) / 1000 : Infinity;
  // Cadena de luces de freno: cada conductor reacciona al de delante (≈ reactS por coche).
  const brakeLightsToLastS = Math.max(0, vehiclesAtRisk - 1) * 1.25;

  // Política fija actual (road-guard: 3 saltos, relevancia 2 km): fracción de la zona de peligro cubierta.
  const fixedReachM = Math.min(fixedPolicy.maxAheadM, rangeM + (fixedPolicy.maxHops - 1) * Math.max(progress, 0));
  const fixedCoverage = Math.min(1, fixedReachM / dangerM);

  return {
    inputs: { flowVehH, speedKmh, penetration, rangeM, lanes, horizonS },
    densityVehKm: kVehKm,
    shockwaveKmh: shockMs * 3.6,
    stoppingDistanceM: stoppingM,
    dangerZoneM: dangerM,
    vehiclesAtRisk,
    personsAtRisk: vehiclesAtRisk * occupantsPerVehicle,
    equippedVehiclesInZone: lambda * dangerM,
    pAllEquippedReached: pAllReached,
    expectedEquippedReachedFraction: reach.reachedFraction,
    expectedVehiclesWarnedBySenda: lambda * dangerM * reach.reachedFraction,
    expectedHopProgressM: progress,
    recommended: {
      relevanceAheadM: Math.ceil(dangerM / 50) * 50,
      maxHops: hops,
      backoffMs: +backoffMs.toFixed(1),
    },
    multiHopLatencyS,
    brakeLightsToLastS,
    timeGainS: Math.max(0, brakeLightsToLastS - multiHopLatencyS),
    fixedPolicy: { ...fixedPolicy, reachM: fixedReachM, coverageOfDangerZone: fixedCoverage, vehiclesUnwarned: vehiclesAtRisk * (1 - fixedCoverage) },
    assumptions: 'Poisson equipped vehicles; farthest-forwarder relaying; LWR stopped-queue shockwave; occupants per vehicle and reaction times are planning hypotheses.',
  };
}

/* ------------------------------------------------------------------ 5. priorización */

/**
 * Ordena zonas por personas afectadas esperadas = P(peligro) × exposición, con intervalo.
 * @param {Array<{id:string, pHazard:number, exposure:{mean:number, lo?:number, hi?:number}}>} zones
 */
export function prioritizeByExposure(zones) {
  return zones.map((z) => {
    if (!(z.pHazard >= 0 && z.pHazard <= 1)) throw new RangeError(`${z.id}: pHazard ∈ [0, 1]`);
    const m = z.exposure.mean, lo = z.exposure.lo ?? m, hi = z.exposure.hi ?? m;
    return { ...z, expectedAffected: z.pHazard * m, expectedAffected90: [z.pHazard * lo, z.pHazard * hi] };
  }).sort((a, b) => b.expectedAffected - a.expectedAffected || b.expectedAffected90[1] - a.expectedAffected90[1]);
}

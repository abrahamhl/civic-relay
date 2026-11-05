/**
 * SENDA · Ruta protectora: el móvil va contigo en la carretera, avisa y pide ayuda aunque no haya red.
 *
 * Qué resuelve (vías interurbanas de España: 1.119 fallecidos a 24 h en 2025 según la DGT; en 2024 el
 * 72 % murió en vías convencionales, las de un carril por sentido, menos tráfico y peor cobertura):
 *
 *  1. FRENADA BRUSCA: la velocidad del GNSS (Doppler) basta; no depende de cómo esté colocado el móvil.
 *     Un coche no frena a más de ~1 g (≈ 10 m/s²): una caída de velocidad más rápida que eso no es una
 *     frenada, es un golpe (o un dato erróneo) y lo confirma el detector de choque.
 *  2. CHOQUE: el detector de `rail-incident.mjs` con umbrales de coche + cuenta atrás humana.
 *  3. AVISO AL DE DETRÁS: una trama de 24 bytes (cabe en un anuncio Bluetooth LE clásico, sin
 *     Bluetooth 5) con posición, rumbo, velocidad y deceleración. Quien la recibe decide si le afecta
 *     (mismo sentido, delante, mismo carril o misma carretera) y calcula la deceleración que necesita
 *     para parar: a = v² / 2·(d − v·t_reacción − margen). Por encima de 3,4 m/s² (la que la norma de
 *     diseño de carreteras AASHTO supone que aplica la mayoría de conductores) dice «FRENA».
 *     Honestidad: al coche de justo delante lo ves antes que cualquier radio; el valor está en los coches
 *     que NO ves (dos o más por delante, camión que tapa, curva, niebla). Ver `brakeChain`.
 *  4. SOS SIN COBERTURA: el teléfono del coche accidentado lo anuncia; cualquier coche con SENDA que
 *     pase en cualquier sentido se lo lleva y lo entrega al recuperar cobertura. Los que vienen de
 *     frente, además, lo pasan a los que se acercan al accidente: el tráfico contrario es el mensajero.
 *  5. DÓNDE ESTÁS, EN EL IDIOMA DEL 112: carretera, punto kilométrico y sentido, calculados sin red a
 *     partir de la geometría de la vía y los hitos kilométricos guardados; con referencias visibles
 *     (aerogeneradores, antenas) cuando no hay hito a la vista.
 *  6. COORDINADOR DE ESCENA: cualquier persona puede guiar la conducta PAS (Proteger, Avisar, Socorrer)
 *     hasta que llega un servicio verificado, que asume el mando automáticamente; las acciones
 *     confirmadas por otra persona suman PUNTOS CÍVICOS en un libro encadenado por huellas SHA-256.
 *
 * Límites (por diseño): nunca sustituye la atención del conductor, la distancia de seguridad, el eCall
 * del coche ni el 112; con el coche en marcha, solo avisos por voz y pantalla completa, sin tocar el
 * móvil. No lee datos de Waze ni de Google Maps (no hay API pública para ello): abre la ruta en ellos
 * con enlaces y les hace llegar avisos por los canales oficiales (DGT 3.0, Waze for Cities) con convenio.
 */
import { localFrame } from './geo-offline.mjs';
import { detectCrash } from './rail-incident.mjs';
import { tally } from './triage.mjs';

const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const hdgDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const fmt1 = (x) => x.toFixed(1).replace('.', ',');

// ---------------------------------------------------------------- 1) Frenada brusca
export const ROAD = Object.freeze({ maxBrakeMs2: 10, hardBrakeMs2: 4.5, aashtoMs2: 3.4 });

/**
 * Frenada brusca a partir de la velocidad GNSS. Ajusta una recta por mínimos cuadrados a la velocidad
 * dentro de una ventana deslizante (robusto al ruido de cada punto).
 * @param {Array<{t:number, speed:number}>} gps  t en s, speed en m/s
 * @returns {{state:'NONE'|'HARD_BRAKE'|'IMPACT_LIKE', at:number|null, speedMs:number|null, decelMs2:number}}
 */
export function detectHardBrake(gps, { winS = 1.5, hardMs2 = ROAD.hardBrakeMs2, minSpeedMs = 50 / 3.6, impactMs2 = ROAD.maxBrakeMs2 * 1.3 } = {}) {
  let best = { state: 'NONE', at: null, speedMs: null, decelMs2: 0 };
  for (let i = 1; i < gps.length; i++) {
    const w = gps.filter((f) => f.t <= gps[i].t && f.t >= gps[i].t - winS);
    if (w.length < 2 || w[w.length - 1].t - w[0].t < 0.6 * winS) continue;
    const mt = w.reduce((s, f) => s + f.t, 0) / w.length, mv = w.reduce((s, f) => s + f.speed, 0) / w.length;
    const slope = w.reduce((s, f) => s + (f.t - mt) * (f.speed - mv), 0) / (w.reduce((s, f) => s + (f.t - mt) ** 2, 0) || 1);
    const decel = -slope, v0 = w[0].speed;
    if (decel > best.decelMs2 && v0 >= minSpeedMs) best = { state: decel >= impactMs2 ? 'IMPACT_LIKE' : decel >= hardMs2 ? 'HARD_BRAKE' : 'NONE', at: decel >= hardMs2 ? w[0].t : null, speedMs: +v0.toFixed(2), decelMs2: +decel.toFixed(2) };
  }
  return best;
}

// ---------------------------------------------------------------- 2) Choque de coche
/** Umbrales de coche (pendientes de calibrar con choques reales). Un coche frena hasta ~10 m/s²; un choque, mucho más. */
export const CAR_CRASH = Object.freeze({ impactG: 4, speedContextMs: 25 / 3.6, stopMs: 2, crashDecelMs2: 12, tiltDeg: 45 });
export const detectCarCrash = (input, opts = {}) => detectCrash(input, { ...CAR_CRASH, ...opts });

// ---------------------------------------------------------------- 3) Trama de aviso entre coches
export const HAZARD = Object.freeze({ BRAKE: 1, CRASH: 2, STOPPED: 3, OBSTACLE: 4, ANIMAL: 5, FOG: 6, ICE: 7, QUEUE: 8, WORKS: 9, SOS: 10 });
const HAZARD_NAME = Object.fromEntries(Object.entries(HAZARD).map(([k, v]) => [v, k]));
/** Peligros de un solo sentido (mismo carril) frente a peligros de zona (niebla, hielo, animales). */
const ONE_WAY = new Set([HAZARD.BRAKE, HAZARD.CRASH, HAZARD.STOPPED, HAZARD.OBSTACLE, HAZARD.QUEUE, HAZARD.SOS]);
export const HAZARD_BYTES = 24;

/**
 * 24 bytes: versión|saltos, tipo, hora (s), lat·1e7, lon·1e7, rumbo·100, velocidad (cm/s), deceleración·10,
 * banderas, identificador. Con la cabecera de banderas (3) y la de fabricante (4) suma 31: un anuncio BLE clásico.
 */
export function encodeHazard({ type, t, lat, lon, headingDeg = 0, speedMs = 0, decelMs2 = 0, hops = 0, id = 0, flags = 0 }) {
  const b = new ArrayBuffer(HAZARD_BYTES), d = new DataView(b);
  d.setUint8(0, (1 << 4) | Math.min(15, hops)); d.setUint8(1, type);
  d.setUint32(2, Math.max(0, Math.floor(t)) >>> 0); d.setInt32(6, Math.round(lat * 1e7)); d.setInt32(10, Math.round(lon * 1e7));
  d.setUint16(14, Math.round((((headingDeg % 360) + 360) % 360) * 100) % 36000); d.setUint16(16, Math.min(65535, Math.round(speedMs * 100)));
  d.setUint8(18, Math.min(255, Math.round(decelMs2 * 10))); d.setUint8(19, flags & 255); d.setUint32(20, id >>> 0);
  return new Uint8Array(b);
}
export function decodeHazard(bytes) {
  if (bytes.length !== HAZARD_BYTES) throw new Error('trama de aviso: tamaño incorrecto');
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), v = d.getUint8(0) >> 4;
  if (v !== 1) throw new Error(`trama de aviso: versión ${v} desconocida`);
  const type = d.getUint8(1);
  return { v, hops: d.getUint8(0) & 15, type, kind: HAZARD_NAME[type] ?? 'UNKNOWN', t: d.getUint32(2), lat: d.getInt32(6) / 1e7, lon: d.getInt32(10) / 1e7, headingDeg: d.getUint16(14) / 100, speedMs: d.getUint16(16) / 100, decelMs2: d.getUint8(18) / 10, flags: d.getUint8(19), id: d.getUint32(20) };
}
/** Un relé reenvía con un salto más; tope de saltos para no inundar. */
export const relayHazard = (bytes, { maxHops = 3 } = {}) => { const h = decodeHazard(bytes); return h.hops >= maxHops ? null : encodeHazard({ ...h, hops: h.hops + 1 }); };

/**
 * ¿Me afecta este aviso? Mismo sentido (rumbo), delante y en mi carril o en mi carretera.
 * Si ambos traen posición sobre la vía (`s` de `roadLocate`, misma carretera y sentido), se usa la
 * distancia por la carretera, válida también en curvas; si no, geometría en línea recta con alcance corto.
 */
export function hazardRelevance(me, hz, { now, maxAheadM = 2000, straightMaxM = 600, laneM = 12, areaM = 600, headingTolDeg = 35, maxAgeS = 20 } = {}) {
  const age = (now ?? hz.t) - hz.t;
  if (age > (ONE_WAY.has(hz.type) ? maxAgeS : 1800)) return { relevant: false, why: 'aviso caducado' };
  if (me.roadId && hz.roadId && me.roadId === hz.roadId && me.s != null && hz.s != null && me.dir != null) {
    if (ONE_WAY.has(hz.type) && hz.dir !== me.dir) return { relevant: false, why: 'otro sentido de la misma carretera' };
    const ahead = (hz.s - me.s) * me.dir;
    return ahead > 0 && ahead <= maxAheadM ? { relevant: true, aheadM: Math.round(ahead), why: 'delante en mi carretera y sentido' } : { relevant: false, aheadM: Math.round(ahead), why: ahead <= 0 ? 'detrás de mí' : 'demasiado lejos' };
  }
  const f = localFrame(me.lat, me.lon), p = f.toXY(hz.lat, hz.lon), h = rad(me.headingDeg ?? 0);
  const along = p.x * Math.sin(h) + p.y * Math.cos(h), cross = Math.abs(p.x * Math.cos(h) - p.y * Math.sin(h));
  if (ONE_WAY.has(hz.type) && hdgDiff(me.headingDeg ?? 0, hz.headingDeg ?? 0) > headingTolDeg) return { relevant: false, aheadM: Math.round(along), why: 'circula en otro sentido' };
  if (along <= 0) return { relevant: false, aheadM: Math.round(along), why: 'detrás de mí' };
  if (along > straightMaxM) return { relevant: false, aheadM: Math.round(along), why: 'lejos para juzgarlo sin la geometría de la vía' };
  if (cross > (ONE_WAY.has(hz.type) ? laneM : areaM)) return { relevant: false, aheadM: Math.round(along), crossM: Math.round(cross), why: 'fuera de mi carril o de mi calzada' };
  return { relevant: true, aheadM: Math.round(along), crossM: Math.round(cross), why: 'delante, mismo sentido' };
}

/**
 * Qué decirle al conductor: la deceleración que necesita para parar antes del peligro.
 * El peligro puede seguir moviéndose y frenando: se usa su punto de parada (hipótesis prudente).
 */
export function brakeAdvice({ vMs, distM, reactS = 1.5, marginM = 10, hazardSpeedMs = 0, hazardDecelMs2 = 8 }) {
  const target = distM + (hazardSpeedMs > 0 ? hazardSpeedMs ** 2 / (2 * Math.max(1, hazardDecelMs2)) : 0);
  const free = target - vMs * reactS - marginM, aReq = free <= 0 ? Infinity : vMs ** 2 / (2 * free);
  const level = aReq >= ROAD.aashtoMs2 ? 'FRENA' : aReq >= 1.5 ? 'ATENCION' : 'INFO';
  return { aReqMs2: Number.isFinite(aReq) ? +aReq.toFixed(2) : Infinity, level, say: level === 'FRENA' ? '¡Frena! Frenada brusca delante' : level === 'ATENCION' ? 'Atención: frenada delante, reduce' : 'Aviso: tráfico frenando más adelante', freeM: Math.round(free) };
}

/**
 * Cuánto antes empieza a frenar quien va N coches por detrás. Con luces de freno, cada conductor
 * reacciona al de delante (la reacción se acumula: N·t). Con SENDA, el aviso llega a todos a la vez.
 */
export function alertGain({ carsAhead, vMs, reactS = 1.25, alertReactS = 1.5, latencyS = 0.3, hops = 1 }) {
  const lightsS = carsAhead * reactS, sendaS = hops * latencyS + alertReactS, gainS = Math.max(0, lightsS - sendaS);
  return { lightsS: +lightsS.toFixed(2), sendaS: +sendaS.toFixed(2), gainS: +gainS.toFixed(2), gainM: Math.round(gainS * vMs) };
}

/**
 * Columna de coches a la misma velocidad; el primero frena a fondo. Cinemática exacta paso a paso.
 * `senda[i]` = el coche i lleva SENDA. El aviso del primero llega, salto a salto, por los coches con
 * SENDA que estén a menos de `rangeM`. Devuelve quién empieza a frenar cuándo y quién choca y a qué velocidad.
 */
export function brakeChain({ n = 6, v0 = 120 / 3.6, gapS = 1.5, carLenM = 4.5, decel = 8, leaderDecel = 9, reactS = 1.25, alertReactS = 1.5, latencyS = 0.3, senda = [], rangeM = 150, dt = 0.005, horizonS = 20, traceEvery = 0 } = {}) {
  const x = Array.from({ length: n }, (_, i) => -i * v0 * gapS), v = Array(n).fill(v0);
  // saltos de radio desde el primero, solo por coches con SENDA (búsqueda en anchura sobre posiciones iniciales)
  const hop = Array(n).fill(Infinity);
  if (senda[0]) { hop[0] = 0; const q = [0]; while (q.length) { const a = q.shift(); for (let b = 0; b < n; b++) if (senda[b] && hop[b] === Infinity && Math.abs(x[a] - x[b]) <= rangeM) { hop[b] = hop[a] + 1; q.push(b); } } }
  const tb = Array(n).fill(Infinity), via = Array(n).fill('luces'); tb[0] = 0; via[0] = 'frena el primero';
  for (let i = 1; i < n; i++) {
    const lights = tb[i - 1] + reactS, alert = hop[i] < Infinity ? hop[i] * latencyS + alertReactS : Infinity;
    tb[i] = Math.min(lights, alert); via[i] = alert < lights ? `SENDA (${hop[i]} salto${hop[i] > 1 ? 's' : ''})` : 'luces de freno';
  }
  const hit = Array(n).fill(null), trace = []; let nextTrace = 0;
  for (let t = 0; t <= horizonS; t += dt) {
    if (traceEvery && t >= nextTrace - 1e-9) { trace.push({ t: +t.toFixed(3), x: [...x], v: [...v], braking: tb.map((b) => t >= b), hit: hit.map((h) => !!h) }); nextTrace += traceEvery; }
    for (let i = 0; i < n; i++) { const a = t >= tb[i] ? (i ? decel : leaderDecel) : 0; v[i] = Math.max(0, v[i] - a * dt); x[i] += v[i] * dt; }
    for (let i = 1; i < n; i++) if (x[i - 1] - x[i] - carLenM <= 0) {
      if (!hit[i]) hit[i] = { t: +t.toFixed(2), impactKmh: Math.round((v[i] - v[i - 1]) * 3.6) };
      x[i] = x[i - 1] - carLenM; v[i] = Math.min(v[i], v[i - 1]);
    }
    if (v.every((s) => s === 0)) { if (traceEvery) trace.push({ t: +t.toFixed(3), x: [...x], v: [...v], braking: tb.map(() => true), hit: hit.map((h) => !!h) }); break; }
  }
  const cars = Array.from({ length: n }, (_, i) => ({ i, senda: !!senda[i], brakeAtS: +tb[i].toFixed(2), via: via[i], collided: !!hit[i], impactKmh: hit[i]?.impactKmh ?? 0, gapM: i ? Math.round(x[i - 1] - x[i] - carLenM) : null }));
  return { cars, collisions: cars.filter((c) => c.collided).length, worstImpactKmh: Math.max(0, ...cars.map((c) => c.impactKmh)), clearanceM: +(v0 * gapS - carLenM).toFixed(1), hops: hop.map((h) => (h === Infinity ? null : h)), trace };
}

// ---------------------------------------------------------------- 4) SOS sin cobertura: los coches que pasan
/** Probabilidad de que dos móviles se oigan al cruzarse: ventana = 2·alcance / velocidad relativa. */
export function contactProbability({ rangeM = 60, relSpeedMs, advIntervalS = 0.1, pRx = 0.2 }) {
  const windowS = (2 * rangeM) / Math.max(1, relSpeedMs), tries = windowS / advIntervalS;
  return { windowS: +windowS.toFixed(2), p: +(1 - (1 - pRx) ** tries).toFixed(4) };
}
/**
 * Coches con SENDA que pasan junto al accidentado: llegada de Poisson con tasa λ = flujo · cuota · P(contacto).
 * El SOS sale cuando uno de ellos alcanza la cobertura (`travelMin`).
 */
export function muleDelivery({ flowVehH, share, pContact = 0.95, travelMin, withinMin = 15 }) {
  const lam = flowVehH * share * pContact; if (lam <= 0) return { ratePerH: 0, meanMin: Infinity, pWithin: 0 };
  const meanWaitMin = 60 / lam, pWithin = withinMin > travelMin ? 1 - Math.exp((-lam * (withinMin - travelMin)) / 60) : 0;
  return { ratePerH: +lam.toFixed(2), meanWaitMin: +meanWaitMin.toFixed(1), meanMin: +(meanWaitMin + travelMin).toFixed(1), pWithin: +pWithin.toFixed(3) };
}

const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/**
 * Carretera convencional de montaña sin cobertura en el tramo central; accidente a mitad, de noche.
 * Simulación determinista (1 s): llegadas de Poisson en los dos sentidos, una parte con SENDA; el SOS
 * pasa de teléfono a teléfono al cruzarse; los que se acercan al accidente reciben el aviso del tráfico
 * contrario. Devuelve cuándo sale el SOS y con cuánta antelación se enteran los que se acercan.
 */
export function roadScenario({ seed = 7, lengthKm = 24, accidentKm = 12, flowVehH = 300, share = 0.1, speedKmh = 80, rangeM = 60, pRx = 0.2, advIntervalS = 0.1, coverage = [[0, 3], [21, 24]], durationMin = 30, sightM = 150 } = {}) {
  const R = rng(seed), v = speedKmh / 3.6, L = lengthKm * 1000, X = accidentKm * 1000, cars = [];
  const pSec = 1 - (1 - pRx) ** (1 / advIntervalS); // probabilidad de oírse en 1 s dentro del alcance
  // tráfico ya presente en t=0 (densidad = flujo/velocidad) y el que entra después, en los dos sentidos
  const spawn = (dir, t0, x0) => cars.push({ id: cars.length + 1, dir, t0, x0, senda: R() < share, informedAt: null, warnAheadM: null, deliveredAt: null });
  for (const dir of [1, -1]) {
    const gapM = () => (-Math.log(1 - R()) * 3600 * v) / flowVehH;
    for (let p = gapM(); p < L; p += gapM()) spawn(dir, 0, dir === 1 ? p : L - p);
    for (let t = (-Math.log(1 - R()) * 3600) / flowVehH; t < durationMin * 60; t += (-Math.log(1 - R()) * 3600) / flowVehH) spawn(dir, t, dir === 1 ? 0 : L);
  }
  // el coche accidentado (sentido 1) ya no circula; su móvil anuncia el SOS
  const wreck = { id: 0, x: X, senda: true };
  const inCov = (x) => coverage.some(([a, b]) => x >= a * 1000 && x <= b * 1000);
  const pos = (c, t) => (t < c.t0 ? null : c.x0 + c.dir * v * (t - c.t0));
  let sosAt = null; const timeline = [];
  for (let t = 0; t <= durationMin * 60; t++) {
    const live = cars.filter((c) => c.senda).map((c) => ({ c, x: pos(c, t) })).filter((o) => o.x !== null && o.x >= 0 && o.x <= L);
    for (const o of live) if (!o.c.informedAt && Math.abs(o.x - wreck.x) <= rangeM && R() < pSec) { o.c.informedAt = t; o.c.from = 'accidentado'; if (o.c.dir === 1 && o.x < X) o.c.warnAheadM = Math.round(X - o.x); timeline.push({ t, what: `Coche ${o.c.id} (${o.c.dir === 1 ? 'hacia el accidente' : 'de frente'}) recibe el SOS del accidentado` }); }
    for (const a of live) if (a.c.informedAt !== null && a.c.informedAt < t) for (const b of live) {
      if (b.c.informedAt !== null || Math.abs(a.x - b.x) > rangeM || R() >= pSec) continue;
      b.c.informedAt = t; b.c.from = a.c.id;
      if (b.c.dir === 1 && b.x < X) { b.c.warnAheadM = Math.round(X - b.x); timeline.push({ t, what: `Coche ${b.c.id}, que va hacia el accidente, avisado por el coche ${a.c.id} a ${fmt1((X - b.x) / 1000)} km` }); }
    }
    for (const o of live) if (o.c.informedAt !== null && o.c.deliveredAt === null && inCov(o.x)) { o.c.deliveredAt = t; if (sosAt === null) { sosAt = t; timeline.push({ t, what: `Coche ${o.c.id} entra en cobertura y entrega el SOS` }); } }
  }
  const approaching = cars.filter((c) => c.dir === 1 && c.senda && c.t0 + (X - c.x0) / v <= durationMin * 60 && c.x0 < X);
  const warned = approaching.filter((c) => c.warnAheadM !== null).map((c) => c.warnAheadM).sort((a, b) => a - b);
  return {
    cars: cars.length, sendaCars: cars.filter((c) => c.senda).length, sosDeliveredMin: sosAt === null ? null : +(sosAt / 60).toFixed(1),
    approachingSenda: approaching.length, warned: warned.length, medianWarnM: warned.length ? warned[Math.floor(warned.length / 2)] : null,
    warnedOver500: warned.filter((m) => m >= 500).length, warnedBeyondSight: warned.filter((m) => m > sightM).length, sightM, timeline, params: { lengthKm, accidentKm, flowVehH, share, speedKmh, rangeM, coverage, durationMin },
    positions: (t) => cars.map((c) => ({ id: c.id, dir: c.dir, senda: c.senda, x: pos(c, t), informed: c.informedAt !== null && c.informedAt <= t, delivered: c.deliveredAt !== null && c.deliveredAt <= t })).filter((p) => p.x !== null && p.x >= 0 && p.x <= L),
  };
}

// ---------------------------------------------------------------- 5) Carretera, PK y sentido sin red
function prep(road) {
  if (road._p) return road._p;
  const f = localFrame(road.points[0].lat, road.points[0].lon), xy = road.points.map((p) => f.toXY(p.lat, p.lon)), cum = [0];
  for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y));
  const proj = (q) => {
    let best = null;
    for (let i = 1; i < xy.length; i++) {
      const a = xy[i - 1], b = xy[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
      const px = a.x + u * dx, py = a.y + u * dy, d = Math.hypot(q.x - px, q.y - py), side = Math.sign(dx * (q.y - a.y) - dy * (q.x - a.x));
      if (!best || d < best.d) best = { d, s: cum[i - 1] + u * Math.sqrt(l2), seg: i, bearing: (deg(Math.atan2(dx, dy)) + 360) % 360, side };
    }
    return best;
  };
  const ms = (road.milestones ?? []).map((m) => ({ km: m.km, s: proj(f.toXY(m.lat, m.lon)).s })).sort((a, b) => a.s - b.s);
  const pkUp = ms.length < 2 || ms[ms.length - 1].km >= ms[0].km;
  Object.defineProperty(road, '_p', { value: { f, xy, cum, proj, ms, pkUp }, enumerable: false, configurable: true });
  return road._p;
}
/** Punto kilométrico en una posición sobre la vía, interpolando entre hitos. */
export function pkAt(road, s) {
  const { ms } = prep(road); if (ms.length < 2) return null;
  let k = ms.findIndex((m) => m.s >= s); if (k <= 0) k = k === 0 ? 1 : ms.length - 1;
  const a = ms[k - 1], b = ms[k]; return a.km + ((s - a.s) / (b.s - a.s || 1)) * (b.km - a.km);
}
/**
 * Encaja una posición en la carretera: distancia por la vía (`s`), separación lateral, PK y sentido
 * («creciente» si avanzas hacia PK mayores). Sin red: geometría y hitos van en el paquete de la ruta.
 */
export function roadLocate(fix, road) {
  const P = prep(road), b = P.proj(P.f.toXY(fix.lat, fix.lon)), pk = pkAt(road, b.s);
  const forward = fix.headingDeg == null ? 1 : hdgDiff(fix.headingDeg, b.bearing) <= 90 ? 1 : -1, dir = P.pkUp ? forward : -forward;
  const sentido = dir === 1 ? 'creciente' : 'decreciente';
  return { roadId: road.id, s: Math.round(b.s), crossM: +b.d.toFixed(1), dir: forward, pk: pk == null ? null : +pk.toFixed(1), sentido, text: `${road.id}${pk == null ? '' : ` PK ${fmt1(pk)}`} sentido ${sentido}${road.towards ? ` (hacia ${dir === 1 ? road.towards[1] : road.towards[0]})` : ''}` };
}
/** Punto de la vía a una distancia `s` (para seguir sin GNSS en un túnel). */
export function pointAt(road, s) {
  const { f, xy, cum } = prep(road), S = Math.max(0, Math.min(cum[cum.length - 1], s));
  let i = cum.findIndex((c) => c >= S); if (i <= 0) i = 1;
  const u = (S - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return f.toLL(xy[i - 1].x + u * (xy[i].x - xy[i - 1].x), xy[i - 1].y + u * (xy[i].y - xy[i - 1].y));
}
/** Sin GNSS (túnel, trinchera): avanza por la geometría de la vía con la última velocidad conocida. */
export function roadDeadReckon(road, last, tNow) { const s = last.s + last.dir * last.speedMs * (tNow - last.t); return { s: Math.round(s), ...pointAt(road, s), pk: pkAt(road, s), estimated: true }; }

/** Referencias visibles a lo largo de la ruta (aerogeneradores, antenas, iglesias) con su PK y lado. */
export function landmarksAlong(road, landmarks, { maxM = 3000 } = {}) {
  const P = prep(road);
  return landmarks.map((l) => { const b = P.proj(P.f.toXY(l.lat, l.lon)); return { ...l, s: Math.round(b.s), offM: Math.round(b.d), side: b.side, pk: pkAt(road, b.s) }; }).filter((l) => l.offM <= maxM).sort((a, b) => a.s - b.s);
}
/** Descripción para el 112: carretera, PK, sentido y la referencia visible más cercana con su lado. */
export function describePosition(fix, road, landmarks = []) {
  const loc = roadLocate(fix, road), ls = landmarksAlong(road, landmarks);
  const near = ls.map((l) => ({ ...l, ds: l.s - loc.s })).sort((a, b) => Math.abs(a.ds) - Math.abs(b.ds))[0];
  if (!near) return { ...loc, landmark: null, full: loc.text };
  const ahead = near.ds * loc.dir > 0, right = near.side * loc.dir < 0, m = Math.abs(near.ds);
  const rel = `${m < 1000 ? `${Math.round(m / 50) * 50} m` : `${fmt1(m / 1000)} km`} ${ahead ? 'antes de' : 'después de'} ${near.name} (a la ${right ? 'derecha' : 'izquierda'})`.replace(/de el /, 'del ');
  return { ...loc, landmark: { name: near.name, distM: Math.round(m), ahead, side: right ? 'derecha' : 'izquierda' }, full: `${loc.text} · ${rel}` };
}

// ---------------------------------------------------------------- 6) Mapas de la ruta: un pasillo, no un rectángulo
/**
 * Teselas de un pasillo de `bufferKm` alrededor de la ruta frente al rectángulo que la contiene (lo que
 * descargan los mapas sin conexión por áreas). Recuento exacto de teselas únicas por nivel de zoom.
 */
export function corridorTiles(points, { bufferKm = 2, zMin = 6, zMax = 15, kbPerTile = 20 } = {}) {
  const tile = (lat, lon, z) => { const n = 2 ** z, φ = rad(lat); return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2) * n)]; };
  let corridor = 0, rect = 0; const perZoom = [];
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon), lat0 = (Math.min(...lats) + Math.max(...lats)) / 2, dLat = bufferKm / 111.32, dLon = bufferKm / (111.32 * Math.cos(rad(lat0)));
  for (let z = zMin; z <= zMax; z++) {
    const set = new Set(), sizeKm = (40075 * Math.cos(rad(lat0))) / 2 ** z, step = Math.max(0.05, Math.min(sizeKm, bufferKm) / 2);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], km = Math.hypot((b.lat - a.lat) * 111.32, (b.lon - a.lon) * 111.32 * Math.cos(rad(lat0))), k = Math.max(1, Math.ceil(km / step));
      for (let j = 0; j <= k; j++) {
        const lat = a.lat + ((b.lat - a.lat) * j) / k, lon = a.lon + ((b.lon - a.lon) * j) / k, [x0, y1] = tile(lat - dLat, lon - dLon, z), [x1, y0] = tile(lat + dLat, lon + dLon, z);
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(x * 1e7 + y);
      }
    }
    const [rx0, ry1] = tile(Math.min(...lats) - dLat, Math.min(...lons) - dLon, z), [rx1, ry0] = tile(Math.max(...lats) + dLat, Math.max(...lons) + dLon, z), r = (rx1 - rx0 + 1) * (ry1 - ry0 + 1);
    perZoom.push({ z, corridor: set.size, rect: r }); corridor += set.size; rect += r;
  }
  return { perZoom, corridorTiles: corridor, rectTiles: rect, corridorMB: +((corridor * kbPerTile) / 1024).toFixed(1), rectMB: +((rect * kbPerTile) / 1024).toFixed(1), ratio: +(corridor / rect).toFixed(3) };
}
/** Trazado APROXIMADO por puntos de paso (ilustrativo) de Madrid a Valencia por la A-3. */
export const ROUTE_MAD_VLC = Object.freeze([{ lat: 40.4168, lon: -3.7038 }, { lat: 40.3, lon: -3.44 }, { lat: 40.012, lon: -3.0 }, { lat: 39.91, lon: -2.55 }, { lat: 39.56, lon: -1.91 }, { lat: 39.49, lon: -1.1 }, { lat: 39.47, lon: -0.376 }]);

/** Abrir la ruta en el navegador del usuario: enlaces públicos y documentados (no leen nada de vuelta). */
export function navLinks({ lat, lon }) {
  return { waze: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes&utm_source=senda`, google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving` };
}

// ---------------------------------------------------------------- 7) Avisos de carretera de un toque
/** Semivida (min) de la creencia en cada aviso sin nuevas confirmaciones. */
export const REPORT_KINDS = Object.freeze({
  accidente: { label: 'Accidente', type: HAZARD.CRASH, hlMin: 45, cifs: 'ACCIDENT' },
  parado: { label: 'Vehículo parado', type: HAZARD.STOPPED, hlMin: 20, cifs: 'HAZARD' },
  obstaculo: { label: 'Objeto en la calzada', type: HAZARD.OBSTACLE, hlMin: 20, cifs: 'HAZARD' },
  animal: { label: 'Animal suelto', type: HAZARD.ANIMAL, hlMin: 10, cifs: 'HAZARD' },
  niebla: { label: 'Niebla', type: HAZARD.FOG, hlMin: 60, cifs: 'HAZARD' },
  hielo: { label: 'Hielo o nieve', type: HAZARD.ICE, hlMin: 120, cifs: 'HAZARD' },
  retencion: { label: 'Retención', type: HAZARD.QUEUE, hlMin: 15, cifs: 'HAZARD' },
  obras: { label: 'Obras', type: HAZARD.WORKS, hlMin: 1440, cifs: 'CONSTRUCTION' },
});
/**
 * Creencia en que el peligro sigue ahí (log-odds bayesianas). Cada «sigue ahí» suma y cada «ya no está»
 * resta logit(fiabilidad), pesados por su frescura; un servicio verificado pesa mucho más.
 */
export function reportBelief(votes, nowMin, { prior = 0.5, reliability = 0.8, verifiedReliability = 0.99, hlMin = 30 } = {}) {
  const logit = (p) => Math.log(p / (1 - p));
  let L = logit(prior);
  for (const v of votes) { const w = 2 ** (-Math.max(0, nowMin - v.atMin) / hlMin), r = v.verified ? verifiedReliability : reliability; L += (v.present ? 1 : -1) * w * logit(r); }
  const lastYes = Math.max(-Infinity, ...votes.filter((v) => v.present).map((v) => v.atMin));
  if (Number.isFinite(lastYes)) L -= Math.max(0, nowMin - lastYes) / hlMin; // sin confirmaciones, cae una unidad de log-odds por semivida
  const p = 1 / (1 + Math.exp(-L));
  return { p: +p.toFixed(3), show: p > 0.5, state: p >= 0.9 ? 'CONFIRMADO' : p > 0.5 ? 'PROBABLE' : 'RETIRADO' };
}
/**
 * Aviso en el formato de incidencias que Waze acepta de sus socios (CIFS). Solo se ENVÍA con convenio
 * (Waze for Cities, a través de un organismo público) y tras confirmarse; campos por validar contra la
 * especificación oficial antes del primer envío.
 */
export function toCifs({ id, kind, lat, lon, roadId, sentido, startIso, description }) {
  const k = REPORT_KINDS[kind]; if (!k) throw new Error(`aviso desconocido: ${kind}`);
  return { id: `senda-${id}`, type: k.cifs, polyline: `${lat.toFixed(6)} ${lon.toFixed(6)}`, street: roadId, direction: 'ONE_DIRECTION', starttime: startIso, description: description ?? `${k.label} · ${roadId} sentido ${sentido} · confirmado por SENDA`, reference: 'SENDA', _validated: false };
}

// ---------------------------------------------------------------- 8) SOS en un SMS y guion para el 112
export function roadSosText({ where, lat, lon, vehicles = 1, people = 1, trapped = 0, fire = false, hhmm, auto = false }) {
  const s = `SENDA SOS ACCIDENTE ${where} · ${lat.toFixed(5)},${lon.toFixed(5)} · ${vehicles} veh · ${people} pers${trapped ? ` · ${trapped} atrap` : ''}${fire ? ' · FUEGO' : ''} · ${hhmm}${auto ? ' · sin respuesta' : ''}`;
  return s.length <= 160 ? s : s.slice(0, 159) + '…';
}
/** Lo que hay que decir al 112, en el orden en que lo pregunta el operador. */
export function call112Script({ where, vehicles = 1, people = 1, trapped = 0, fire = false, dangerous = false, counts = null }) {
  const inj = counts ? Object.entries(counts).filter(([, n]) => n).map(([c, n]) => `${n} ${({ ROJO: 'grave', AMARILLO: 'herido que no camina', VERDE: 'leve', PARADA: 'sin respiración', SIN_RESPIRACION: 'sin respiración' })[c] ?? c}`).join(', ') : null;
  return [`Accidente de tráfico en ${where}.`, `${vehicles} vehículo${vehicles > 1 ? 's' : ''} y ${people} persona${people > 1 ? 's' : ''}${inj ? `: ${inj}` : ''}.`, trapped ? `${trapped} persona${trapped > 1 ? 's' : ''} atrapada${trapped > 1 ? 's' : ''}.` : 'Nadie atrapado por ahora.', fire ? 'Hay fuego o humo.' : 'Sin fuego.', dangerous ? 'Hay un vehículo de mercancías peligrosas (panel naranja).' : null, 'La zona está señalizada con la baliza V16.'].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- 9) Coordinador de escena (PAS) y puntos cívicos
export const PAS = Object.freeze([
  { id: 'proteger', step: 'P', title: 'Proteger', items: ['Luces de emergencia y baliza V16 encendida (se pone desde la ventanilla)', 'Chaleco puesto antes de bajar', 'Bajar por el lado contrario al tráfico y esperar tras el guardarraíl o fuera de la calzada', 'Quitar el contacto de los coches implicados si se puede sin riesgo; nadie fuma'] },
  { id: 'avisar', step: 'A', title: 'Avisar', items: ['Llamar al 112 con carretera, PK y sentido (SENDA lo dice)', 'Cuántos vehículos y personas, atrapados, fuego, mercancías peligrosas', 'No colgar hasta que lo diga el operador'] },
  { id: 'socorrer', step: 'S', title: 'Socorrer', items: ['No mover a los heridos salvo peligro inmediato (fuego)', 'No quitar el casco a un motorista salvo que no respire', 'Triaje: quién camina, quién respira, quién responde', 'Hablarles y abrigarlos hasta que llegue la ayuda'] },
]);
export const CIVIC_POINTS = Object.freeze({ proteger: 10, avisar: 10, socorrer: 5, triaje: 5, coordinar: 20, traspaso: 10 });
export const CIVIC_RULES = Object.freeze([
  'Solo cuentan acciones confirmadas por otra persona presente o por el servicio que recibe el traspaso',
  'Nadie puede confirmarse a sí mismo',
  'Nunca se premia llegar el primero, la rapidez ni acercarse al peligro',
  'Nunca se piden ni se guardan fotos o vídeos de víctimas',
  'Tope de puntos por persona e incidente',
]);

/** Abre una escena. Quien la abre la coordina hasta que llega alguien con credencial institucional verificada. */
export function createScene({ id, at, where, coordinator }) {
  const tasks = PAS.map((p) => ({ id: p.id, step: p.step, title: p.title, assignee: null, doneAt: null, confirmedBy: [] }));
  return { id, at, where, coordinator, participants: [coordinator.userId], tasks, victims: [], calls: [], log: [{ t: at, who: coordinator.userId, what: 'abre la escena y coordina' }], handover: null };
}
/**
 * Acciones: JOIN, ASSIGN (solo quien coordina), DONE, CONFIRM, TRIAGE (con resultado de `startTriage`),
 * CALL112, HANDOVER (solo a un actor institucional verificado: asume el mando).
 */
export function sceneAct(scene, { t, who, action, task, to, victim, result, actor }) {
  const err = (m) => ({ ok: false, error: m }), T = (id) => scene.tasks.find((k) => k.id === id);
  if (scene.handover && action !== 'CONFIRM') return err('la escena ya está en manos del servicio de emergencias');
  switch (action) {
    case 'JOIN': if (!scene.participants.includes(who)) scene.participants.push(who); break;
    case 'ASSIGN': if (who !== scene.coordinator.userId) return err('solo quien coordina asigna tareas'); if (!T(task)) return err('tarea desconocida'); T(task).assignee = to; if (!scene.participants.includes(to)) scene.participants.push(to); break;
    case 'DONE': if (!T(task)) return err('tarea desconocida'); if (T(task).assignee && T(task).assignee !== who) return err('la tarea es de otra persona'); T(task).assignee ??= who; T(task).doneAt = t; break;
    case 'CONFIRM': { if (!T(task)?.doneAt) return err('no hay nada que confirmar'); if (T(task).assignee === who) return err('nadie se confirma a sí mismo'); if (!scene.participants.includes(who) && !actor) return err('solo confirma quien está en la escena'); if (!T(task).confirmedBy.includes(who)) T(task).confirmedBy.push(who); break; }
    case 'TRIAGE': scene.victims.push({ id: victim, by: who, at: t, cat: result.cat }); break;
    case 'CALL112': scene.calls.push({ who, at: t }); break;
    case 'HANDOVER': if (actor?.trust !== 'VERIFIED_INSTITUTIONAL') return err('el traspaso es solo a un servicio con credencial verificada'); scene.handover = { at: t, to: actor.userId, unit: actor.unit ?? null, orgKind: actor.orgKind }; scene.coordinator = actor; break;
    default: return err('acción desconocida');
  }
  scene.log.push({ t, who, what: action === 'HANDOVER' ? `traspasa la escena a ${actor.unit ?? actor.userId}` : `${action.toLowerCase()}${task ? ' ' + task : ''}${to ? ' → ' + to : ''}${victim ? ' ' + victim : ''}` });
  return { ok: true };
}
/** Resumen para quien llega: qué se hizo, cuándo y por quién; recuento de triaje. */
export function sceneBrief(scene) {
  const counts = tally(scene.victims.map((v) => ({ cat: v.cat }))), mm = (s) => `${Math.floor((s - scene.at) / 60)}:${String(Math.round((s - scene.at) % 60)).padStart(2, '0')}`;
  const done = scene.tasks.filter((k) => k.doneAt).map((k) => `${k.step} ${mm(k.doneAt)}${k.confirmedBy.length ? ' ✓' : ''}`).join(' · ');
  return { counts, text: `${scene.where} · ${scene.victims.length} víctima(s) triadas · ${Object.entries(counts).filter(([, n]) => n).map(([c, n]) => `${c} ${n}`).join(' ') || 'sin triaje'} · PAS: ${done || 'pendiente'} · 112 ${scene.calls.length ? 'avisado ' + mm(scene.calls[0].at) : 'NO avisado'}` };
}

const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('');
/**
 * Libro de puntos cívicos: cada asiento lleva la huella del anterior (cualquier cambio rompe la cadena).
 * Solo puntúa lo confirmado por otra persona o por el servicio que recibe el traspaso.
 */
export async function civicLedger(scene, { capPerPerson = 50, prev = '0'.repeat(64) } = {}) {
  const items = [], by = {};
  const add = (who, action, why) => { const pts = Math.max(0, Math.min(CIVIC_POINTS[action], capPerPerson - (by[who] ?? 0))); if (pts) { by[who] = (by[who] ?? 0) + pts; items.push({ who, action, points: pts, why }); } };
  for (const k of scene.tasks) if (k.doneAt && k.assignee && k.confirmedBy.some((c) => c !== k.assignee)) add(k.assignee, k.id, `${k.title} confirmado por ${k.confirmedBy.filter((c) => c !== k.assignee).join(', ')}`);
  const confirmedByService = scene.handover != null;
  for (const v of scene.victims) if (confirmedByService) add(v.by, 'triaje', `triaje de ${v.id} recibido por ${scene.handover.unit ?? 'el servicio'}`);
  const opener = scene.log[0].who;
  if (confirmedByService) { add(opener, 'coordinar', `coordinó hasta el traspaso`); add(opener, 'traspaso', `traspaso a ${scene.handover.unit ?? 'el servicio'}`); }
  const entries = [];
  for (const it of items) { const e = { incident: scene.id, ...it, prev }; e.hash = await sha(JSON.stringify(e)); prev = e.hash; entries.push(e); }
  return { entries, totals: by, head: prev };
}
export async function verifyLedger(entries, { genesis = '0'.repeat(64) } = {}) {
  let prev = genesis;
  for (const e of entries) { const { hash, ...rest } = e; if (rest.prev !== prev || (await sha(JSON.stringify(rest))) !== hash) return false; prev = hash; }
  return true;
}

// ---------------------------------------------------------------- 10) Carretera de ejemplo (ILUSTRATIVA)
/**
 * Carretera de montaña INVENTADA para la demostración: geometría, hitos y aerogeneradores no son
 * reales. En producción: geometría y PK de la Red de Transporte del IGN/CNIG y de OpenStreetMap,
 * aerogeneradores de OpenStreetMap (generator:source=wind) o del registro público.
 */
export function demoRoad() {
  const o = { lat: 40.9, lon: -2.4 }, pts = [];
  for (let k = 0; k <= 24; k++) pts.push({ lat: o.lat + k * 0.0072 + 0.004 * Math.sin(k / 2.2), lon: o.lon + k * 0.0055 + 0.006 * Math.cos(k / 3) });
  const road = { id: 'N-000', towards: ['Valle', 'Puerto'], points: pts };
  const P = prep(road), total = P.cum[P.cum.length - 1];
  road.milestones = Array.from({ length: Math.floor(total / 1000) + 1 }, (_, i) => ({ km: 120 + i, ...pointAt(road, i * 1000) }));
  delete road._p;
  const off = (s, m) => { const a = pointAt(road, s), b = pointAt(road, s + 30), f = localFrame(a.lat, a.lon), q = f.toXY(b.lat, b.lon), L = Math.hypot(q.x, q.y) || 1; return f.toLL((-q.y / L) * m, (q.x / L) * m); };
  const landmarks = [{ name: 'el aerogenerador AE-07', kind: 'aerogenerador', s: 3500, m: 420 }, { name: 'el aerogenerador AE-12', kind: 'aerogenerador', s: 7200, m: -650 }, { name: 'la antena de telefonía', kind: 'antena', s: 11800, m: 300 }, { name: 'la ermita', kind: 'ermita', s: 16000, m: -900 }].map((l) => ({ name: l.name, kind: l.kind, ...off(l.s, l.m) }));
  return { road, landmarks, lengthM: Math.round(total) };
}

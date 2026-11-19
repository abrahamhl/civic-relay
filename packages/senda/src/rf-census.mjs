/**
 * SENDA · Censo radioeléctrico por planta (dron, mástil o accesorio ESP32).
 *
 * ¿Cuántas personas puede haber en cada planta de un edificio dañado? Los teléfonos, relojes
 * y auriculares anuncian su presencia por Bluetooth LE aunque nadie los toque. Contar esas
 * señales tiene dos trampas que este módulo resuelve de forma determinista:
 *  1. DIRECCIONES ALEATORIAS: los móviles cambian su dirección BLE cada pocos minutos, así que
 *     contar direcciones distintas sobreestima. Pero un dispositivo solo usa UNA dirección a
 *     la vez: dentro de un grupo de señales con la misma «huella» de carga útil, el número
 *     mínimo de dispositivos es el MÁXIMO DE DIRECCIONES ACTIVAS A LA VEZ (cobertura de un
 *     grafo de intervalos). Cota inferior = esa concurrencia; superior = direcciones distintas.
 *  2. PLANTA: el dron a una altura oye también las plantas vecinas; cada señal se asigna a la
 *     planta donde su RSSI mediano es mayor.
 * Teléfonos → personas (inferencia bayesiana exacta): cada persona lleva 0, 1 o 2 teléfonos
 * con probabilidades configurables (hipótesis por defecto: 12 % ninguno, 8 % dos; PENDIENTE de
 * calibrar con datos reales). Para m teléfonos, P(m | N personas) es la convolución N veces de
 * esa mezcla; con prior plano se obtiene la mediana y el intervalo creíble del 90 % para N. En
 * plantas con pocos teléfonos el intervalo se ensancha solo, que es lo honesto.
 * Se excluyen las clases fijas (televisores, sensores, routers). La radio detecta DISPOSITIVOS:
 * quien no lleva teléfono es invisible, y por eso «0 teléfonos» no garantiza «planta vacía».
 *
 * Privacidad por diseño: el capturador guarda solo un hash con sal de cada dirección (la
 * sal se destruye al acabar la misión), nunca contenido; de aquí solo salen RECUENTOS.
 * Las direcciones MAC son dato personal (RGPD): requiere base jurídica (interés vital /
 * misión de emergencia) y DPIA. Vuelos: autorización del director de extinción / AESA.
 */

const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export const DEVICE_CLASSES = Object.freeze({ phone: 'teléfono', wearable: 'reloj/auriculares', iot: 'fijo (TV, sensor, router)', unknown: 'desconocido' });

/** Máximo número de intervalos [a,b] activos a la vez (barrido de eventos). */
export function maxConcurrent(intervals, { gapS = 0 } = {}) {
  const ev = [];
  for (const [a, b] of intervals) { ev.push([a, 1]); ev.push([b + gapS, -1]); }
  ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let cur = 0, max = 0; for (const [, d] of ev) { cur += d; max = Math.max(max, cur); }
  return max;
}

/**
 * Personas a partir de m teléfonos: posterior exacta con prior plano sobre N.
 * @returns {{lo:number, mid:number, hi:number, pEmpty:number, post:number[]}} intervalo creíble (90 % por
 *   defecto), P(N=0) y la distribución posterior completa P(N = n | m).
 */
export function peopleFromPhones(m, { none = 0.12, two = 0.08, cred = 0.9, nMax = 2 * m + 12 } = {}) {
  const one = 1 - none - two; let dist = [1]; const like = [];
  for (let n = 0; n <= nMax; n++) {
    like.push(dist[m] ?? 0);
    const next = new Array(dist.length + 2).fill(0); // añade una persona más: 0, 1 o 2 teléfonos
    dist.forEach((p, k) => { next[k] += p * none; next[k + 1] += p * one; next[k + 2] += p * two; });
    dist = next;
  }
  const z = like.reduce((a, b) => a + b, 0), post = like.map((l) => l / z), a = (1 - cred) / 2;
  let c = 0, lo = null, mid = null, hi = null;
  post.forEach((p, n) => { c += p; if (lo === null && c >= a) lo = n; if (mid === null && c >= 0.5) mid = n; if (hi === null && c >= 1 - a) hi = n; });
  return { lo, mid, hi, pEmpty: post[0], post };
}

/**
 * @param {Array<{t:number, floor:number, id:string, fp:string, cls:string, rssi:number}>} obs
 *   observaciones del barrido (id = hash con sal de la dirección; fp = huella de carga útil)
 * @param {{floors:number}} building
 * @param {{explain?:boolean}} [opts] explain: añade por planta los intervalos de actividad de cada
 *   grupo (sin identificadores) para poder dibujar por qué sale cada número.
 */
export function rfCensus(obs, building, { minRssi = -88, sameFloorRssi = -71, phoneMix = { none: 0.12, two: 0.08 }, cred = 0.9, explain = false } = {}) {
  // 1) cada dirección → su planta (RSSI mediano máximo) y su intervalo de actividad
  const byId = new Map();
  for (const o of obs) {
    if (o.rssi < minRssi || o.cls === 'iot') continue;
    let r = byId.get(o.id); if (!r) byId.set(o.id, (r = { id: o.id, fp: o.fp, cls: o.cls, perFloor: new Map(), t0: o.t, t1: o.t }));
    r.t0 = Math.min(r.t0, o.t); r.t1 = Math.max(r.t1, o.t);
    if (!r.perFloor.has(o.floor)) r.perFloor.set(o.floor, []); r.perFloor.get(o.floor).push(o.rssi);
  }
  for (const r of byId.values()) { const [f, rssi] = [...r.perFloor.entries()].map(([f2, v]) => [f2, median(v)]).sort((a2, b2) => b2[1] - a2[1])[0]; r.floor = f; r.best = rssi; }
  // una dirección oída solo débil (desde la órbita de otra planta) no se asigna: ese dispositivo
  // también se oye fuerte desde su propia planta con otra dirección (rotación), así que no se pierde
  for (const [id, r] of byId) if (r.best < sameFloorRssi) byId.delete(id);
  // 2) por planta y huella: concurrencia (mínimo de dispositivos) y direcciones (máximo)
  const floors = Array.from({ length: building.floors }, (_, f) => {
    const ids = [...byId.values()].filter((r) => r.floor === f), groups = new Map();
    for (const r of ids) { const k = `${r.cls}|${r.fp}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    let lo = 0, hi = 0, wearLo = 0, wearHi = 0, unkLo = 0, unkHi = 0; const why = [];
    for (const g of groups.values()) {
      const iv = g.map((r) => [r.t0, r.t1]), c = maxConcurrent(iv), n = g.length, cls = g[0].cls;
      if (explain) why.push({ cls, fp: g[0].fp, min: c, intervals: iv.sort((a, b) => a[0] - b[0]) });
      if (cls === 'phone') { lo += c; hi += n; } else if (cls === 'wearable') { wearLo += c; wearHi += n; } else { unkLo += c; unkHi += n; }
    }
    const devLo = lo + wearLo + unkLo, devHi = hi + wearHi + unkHi;
    // personas: los teléfonos (concurrencia) son el ancla. Relojes y auriculares no suman
    // personas; un dispositivo de clase desconocida solo ensancha la cota superior.
    const pp = peopleFromPhones(lo, { ...phoneMix, cred });
    const people = { lo: pp.lo, mid: pp.mid, hi: pp.hi + unkLo, pEmpty: +pp.pEmpty.toFixed(3) };
    return { floor: f, addresses: ids.length, devices: { lo: devLo, hi: devHi }, phones: { lo, hi }, people, ...(explain ? { groups: why } : {}) };
  });
  const sum = (k) => floors.reduce((s, f) => s + f.people[k], 0);
  return { floors, total: { lo: sum('lo'), mid: sum('mid'), hi: sum('hi') }, addresses: byId.size,
    privacy: 'Solo recuentos: identificadores con sal destruida al terminar la misión; ningún contenido.' };
}

/**
 * Escenario sintético determinista: edificio de 6 plantas, rotación BLE cada 15 min, 3 pasadas
 * de dron. Realista a propósito: hay personas SIN teléfono (niños, mayores, móvil perdido) y
 * personas con DOS, para que el rango de personas tenga que cubrir la verdad, no copiarla.
 */
export function rfCensusScenario({ seed = 9, floors = 6, people = [3, 8, 5, 0, 6, 2], rotateS = 900, passes = 3, noPhoneShare = 0.12, twoPhoneShare = 0.08 } = {}) {
  let s = seed >>> 0; const R = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
  const g = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
  const FP = ['apple-phone', 'google-phone', 'samsung-phone'], WFP = ['watch-a', 'buds-b'];
  const devices = [];
  people.forEach((n, f) => {
    for (let p = 0; p < n; p++) {
      const u = R(), nPhones = u < noPhoneShare ? 0 : u < noPhoneShare + twoPhoneShare ? 2 : 1;
      for (let k = 0; k < nPhones; k++) devices.push({ floor: f, cls: 'phone', fp: FP[Math.floor(R() * 3)], phase: R() * rotateS, key: `${f}-${p}-ph${k}` });
      if (R() < 0.4) devices.push({ floor: f, cls: 'wearable', fp: WFP[Math.floor(R() * 2)], phase: R() * rotateS, key: `${f}-${p}-w` });
    }
    for (let k = 0; k < 2; k++) devices.push({ floor: f, cls: 'iot', fp: 'tv-sensor', phase: 0, key: `${f}-iot${k}` });
  });
  const obs = [], passS = 600, gapS = 300;
  for (let pass = 0; pass < passes; pass++) for (let f = 0; f < floors; f++) {
    const tStart = pass * (passS + gapS) + (f / floors) * passS;
    for (let k = 0; k < 12; k++) { // 12 lecturas por planta y pasada (órbita del dron a la altura de la planta)
      const t = tStart + k * (passS / floors / 12);
      for (const d of devices) {
        const dz = Math.abs(d.floor - f); if (dz > 1) continue;
        const rssi = (dz === 0 ? -62 : -79) + g() * 4; if (R() < 0.15) continue; // pérdidas de paquetes
        const epoch = Math.floor((t + d.phase) / rotateS);
        obs.push({ t, floor: f, id: d.cls === 'iot' ? d.key : `${d.key}#${epoch}`, fp: d.fp, cls: d.cls, rssi });
      }
    }
  }
  return { building: { floors }, obs, truth: people, phones: people.map((_, f) => devices.filter((d) => d.floor === f && d.cls === 'phone').length) };
}

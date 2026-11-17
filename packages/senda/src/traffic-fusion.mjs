// SENDA · traffic-fusion: coches + cámaras de tráfico + fuego.
//
// Entrada:
//   - conteos y ocupación de cámaras de tráfico oficiales (YOLOX + ByteTrack en el relé, sin
//     identificar a nadie);
//   - velocidades de coches sonda (la flota SENDA o datos de navegación con convenio);
//   - llegada del fuego a cada tramo (satélite, cámaras, modelo de propagación).
// Procesamiento:
//   - modelo de transmisión de celdas (CTM, Daganzo 1994) con diagrama fundamental triangular;
//   - capacidad reducida por humo según la distancia de parada;
//   - salidas escalonadas (curva de Rayleigh) tras el aviso;
//   - filtro de Kalman por conjuntos (EnKF) que asimila cámaras y sondas y estima a la vez la
//     capacidad oculta de los cuellos de botella.
// Salida:
//   - tiempo de despeje y vehículos expuestos al fuego;
//   - hora de cierre de cada tramo;
//   - adelanto de aviso necesario y umbral dinámico de distancia (Cova 2005; Larsen 2011;
//     Li, Cova y Dennison 2019).
//
// Nada aquí sustituye a la autoridad: SENDA propone cierres y avisos con sus fuentes; decide el 112.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Diagrama fundamental triangular por carril: vf (km/h), qmax (veh/h/carril), kj (veh/km/carril). */
export function triangularFD({ vfKmh = 60, qmax = 1800, kj = 133 } = {}) {
  const kc = qmax / vfKmh, w = qmax / (kj - kc);
  return {
    vfKmh, qmax, kj, kc, wKmh: w,
    flow: (k) => (k <= kc ? vfKmh * k : Math.max(0, w * (kj - k))),
    speed: (k) => (k <= 1e-9 ? vfKmh : Math.min(vfKmh, (k <= kc ? vfKmh * k : Math.max(0, w * (kj - k))) / k)),
    // Inversa en la rama congestionada: con v < vf, k = w·kj / (v + w).
    densityFromSpeed: (v) => (v >= vfKmh - 1e-9 ? kc : (w * kj) / (Math.max(0, v) + w)),
  };
}

/** Velocidad máxima segura con visibilidad visM: distancia de parada v·tr + v²/(2a) ≤ vis (km/h). */
export function smokeSpeedKmh(visM, { trS = 2.5, decel = 3.4 } = {}) {
  const v = decel * (-trS + Math.sqrt(trS * trS + (2 * Math.max(0, visM)) / decel)); return v * 3.6;
}
/** Capacidad por carril con hueco de seguridad: q = v / (v·tr + L) (veh/h/carril). */
export function headwayCapacity(vKmh, { trS = 1.5, lVehM = 7.5 } = {}) { const v = vKmh / 3.6; return v <= 0 ? 0 : (3600 * v) / (v * trS + lVehM); }

/** Fracción acumulada de vehículos que ya han salido t minutos después del aviso (Rayleigh). */
export const rayleighDepart = (tMin, tauMin) => (tMin <= 0 ? 0 : 1 - Math.exp(-((tMin / tauMin) ** 2)));

/**
 * Ruta en celdas. cells: [{ lenKm, lanes, vfKmh, qmax?, kj?, name?, lat?, lon? }].
 * Devuelve la ruta con su diagrama por celda y el paso de tiempo máximo (CFL: vf·dt ≤ L).
 */
export function makeRoute(cells) {
  const C = cells.map((c) => ({ ...c, fd: triangularFD({ vfKmh: c.vfKmh ?? 60, qmax: c.qmax ?? 1800, kj: c.kj ?? 133 }) }));
  const dtMaxS = Math.min(...C.map((c) => (c.lenKm / c.fd.vfKmh) * 3600));
  return { cells: C, dtMaxS };
}

/**
 * Un paso del CTM. n: vehículos por celda; dt en segundos; capF(i): factor de capacidad de la celda
 * (humo, coche abandonado, cierre); exitCapVehH: capacidad de salida al final de la ruta;
 * inflow[i]: vehículos que quieren entrar en la celda i en este paso (salidas de casas).
 * Devuelve el nuevo estado, los vehículos que salen de la ruta y los que esperan para entrar.
 */
export function ctmStep(route, n, dtS, { capF = () => 1, exitCapVehH = Infinity, inflow = null, queue = null, entryClosed = () => false } = {}) {
  const C = route.cells, N = C.length, h = dtS / 3600, send = new Array(N), recv = new Array(N);
  for (let i = 0; i < N; i++) {
    const c = C[i], f = clamp(capF(i), 0, 1), k = n[i] / (c.lenKm * c.lanes), qcap = c.fd.qmax * f * c.lanes;
    send[i] = Math.min(c.fd.vfKmh * k * c.lanes, qcap) * h;
    recv[i] = entryClosed(i) ? 0 : Math.min(qcap, c.fd.wKmh * Math.max(0, c.fd.kj - k) * c.lanes) * h;
  }
  const y = new Array(N + 1).fill(0); let diverted = 0;
  for (let i = 0; i < N - 1; i++) {
    y[i + 1] = Math.min(send[i], recv[i + 1], n[i]);
    // Ante un tramo cerrado, los agentes desvían a los que llegan por otra ruta (salen de esta).
    if (entryClosed(i + 1)) { const dv = Math.min(send[i], n[i]); diverted += dv; n = n.slice(); n[i] -= dv; }
  }
  y[N] = Math.min(send[N - 1], exitCapVehH * h, n[N - 1]);
  const m = n.slice(), q = queue ? queue.slice() : new Array(N).fill(0);
  for (let i = 0; i < N; i++) m[i] += y[i] - y[i + 1];
  if (inflow) for (let i = 0; i < N; i++) { // entradas laterales: lo que no cabe espera en la calle
    q[i] += inflow[i]; const room = Math.max(0, recv[i] - y[i]), adm = Math.min(q[i], room); m[i] += adm; q[i] -= adm;
  }
  return { n: m.map((x) => Math.max(0, x)), out: y[N], queue: q, diverted };
}

/**
 * Evacuación completa. demand[i]: vehículos que salen hacia la celda i; warnMin: minuto del aviso;
 * tauMin: escala de la curva de salidas; capF(i, tMin); exitCap(tMin) en veh/h.
 * fireArrivalMin[i] (opcional): minuto en que el fuego alcanza la celda i.
 */
export function simulateEvacuation(route, { demand, warnMin = 0, tauMin = 30, durMin = 360, dtS = null, capF = () => 1, exitCap = () => Infinity, fireArrivalMin = null, closeAtMin = null, sampleEvery = 60 } = {}) {
  // La simulación empieza en el aviso si es anterior a t = 0 (aviso preventivo antes de la detección).
  const dt = dtS ?? Math.min(30, route.dtMaxS), tStart = Math.min(0, warnMin), steps = Math.ceil(((durMin - tStart) * 60) / dt), N = route.cells.length, total = demand.reduce((s, d) => s + d, 0);
  let n = new Array(N).fill(0), queue = new Array(N).fill(0), exited = 0, diverted = 0, departedPrev = 0, clearMin = null, exposedVehMin = 0, maxCaught = 0;
  const series = [];
  for (let s = 0; s <= steps; s++) {
    const t = tStart + (s * dt) / 60, dep = rayleighDepart(t - warnMin, tauMin), inflow = demand.map((d) => d * (dep - departedPrev)); departedPrev = dep;
    // Cierre: a partir de closeAtMin[i] la celda deja de admitir vehículos nuevos (ni laterales ni de aguas arriba).
    const closed = (i) => closeAtMin && closeAtMin[i] != null && t >= closeAtMin[i];
    // Tramo cerrado: no admite entradas; sus vecinos usan la ruta alternativa (se cuentan como desviados).
    const lat = inflow.map((x, i) => (closed(i) ? 0 : x)); diverted += inflow.reduce((a, x, i) => a + (closed(i) ? x : 0), 0);
    if (closeAtMin) for (let i = 0; i < N; i++) if (closed(i) && queue[i] > 0) { diverted += queue[i]; queue[i] = 0; }
    const r = ctmStep(route, n, dt, { capF: (i) => capF(i, t), exitCapVehH: exitCap(t), inflow: lat, queue, entryClosed: closed });
    n = r.n; queue = r.queue; exited += r.out; diverted += r.diverted;
    if (fireArrivalMin) { let caught = 0; for (let i = 0; i < N; i++) if (t >= fireArrivalMin[i]) caught += n[i] + queue[i]; exposedVehMin += (caught * dt) / 60; maxCaught = Math.max(maxCaught, caught); }
    if (clearMin == null && exited + diverted >= total * 0.99) clearMin = t;
    if (s % Math.max(1, Math.round((sampleEvery) / dt)) === 0) series.push({ tMin: +t.toFixed(1), exited: Math.round(exited), onRoad: Math.round(n.reduce((a, b) => a + b, 0)), waiting: Math.round(queue.reduce((a, b) => a + b, 0)), speed: route.cells.map((c, i) => Math.round(c.fd.speed(n[i] / (c.lenKm * c.lanes)))) });
  }
  return { clearMin, exited: Math.round(exited), diverted: Math.round(diverted), total, exposedVehMin: Math.round(exposedVehMin), maxCaught: Math.round(maxCaught), series, final: n };
}

/**
 * Adelanto de aviso: el último minuto de aviso (respecto a t = 0) con el que nadie queda expuesto
 * al fuego (vehículos·minuto ≤ tolerancia). Búsqueda binaria sobre el minuto del aviso.
 */
export function latestSafeWarning(route, opts, { lo = -360, hi = 360, tolVehMin = 1 } = {}) {
  const exp = (w) => simulateEvacuation(route, { ...opts, warnMin: w }).exposedVehMin;
  if (exp(lo) > tolVehMin) return { ok: false, warnMin: null, note: `ni avisando ${-lo} min antes se evita la exposición` };
  if (exp(hi) <= tolVehMin) return { ok: true, warnMin: hi };
  for (let it = 0; it < 30 && hi - lo > 0.5; it++) { const mid = (lo + hi) / 2; if (exp(mid) <= tolVehMin) lo = mid; else hi = mid; }
  return { ok: true, warnMin: +lo.toFixed(1) };
}

/** Umbral dinámico (Cova 2005; Larsen 2011): distancia = ROS · (tiempo de despeje + margen) + pavesas. */
export function triggerBufferKm({ rosKmh, clearMin, marginMin = 15, spottingKm = 0 }) { return rosKmh * ((clearMin + marginMin) / 60) + spottingKm; }

/** Hora de cierre de cada celda: cuando el fuego llegue menos lo que se tarda en atravesarla y el margen. */
export function closureSchedule(route, fireArrivalMin, { marginMin = 10, speedKmh = null } = {}) {
  return route.cells.map((c, i) => {
    const v = speedKmh ?? c.fd.vfKmh * 0.5, cross = (c.lenKm / v) * 60;
    return Number.isFinite(fireArrivalMin[i]) ? +(fireArrivalMin[i] - marginMin - cross).toFixed(1) : null;
  });
}

// ── filtro de Kalman por conjuntos ─────────────────────────────────────────────
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) + 0.5) / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r()); }
function solveSym(A, B) { // A·X = B por eliminación de Gauss con pivote (A pequeña: nº de observaciones)
  const n = A.length, m = B[0].length, M = A.map((row, i) => [...row, ...B[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12; for (let k = c; k < n + m; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let k = c; k < n + m; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row) => row.slice(n));
}

/**
 * EnKF estocástico para el CTM. Estado de cada miembro: vehículos por celda + ln(factor de capacidad)
 * de cada cuello de botella vigilado (parámetros ocultos que se aprenden con los datos).
 * obs: [{ tipo: 'camara-densidad' | 'camara-flujo' | 'sonda-velocidad', cell, valor, sd }]
 */
export function makeEnkf(route, { members = 40, seed = 7, bottlenecks = [], priorLogit = 2.2, capSdLogit = 1.0, modelSd = 0.08 } = {}) {
  // Factor de capacidad = logística(a): con a ≈ N(2,2; 1) el prior está en ≈ 0,9 (casi libre) pero puede
  // bajar hasta ≈ 0 sin perder sensibilidad (una exponencial truncada en 1 se queda sin gradiente).
  const r = rng(seed), N = route.cells.length, sig = (a) => 1 / (1 + Math.exp(-a));
  const ens = Array.from({ length: members }, () => ({ n: new Array(N).fill(0), q: new Array(N).fill(0), lc: bottlenecks.map(() => priorLogit + capSdLogit * gauss(r)) }));
  const capOf = (m) => (i) => { const b = bottlenecks.indexOf(i); return b < 0 ? 1 : sig(m.lc[b]); };
  let lastExit = Infinity, lastCapF = () => 1;
  function forecast(dtS, { inflow, exitCapVehH = Infinity, capF = () => 1 }) {
    lastExit = exitCapVehH; lastCapF = capF;
    for (const m of ens) {
      const cf = capOf(m), exitIdx = bottlenecks.indexOf(N), exitF = exitIdx < 0 ? 1 : sig(m.lc[exitIdx]);
      const st = ctmStep(route, m.n, dtS, { capF: (i) => cf(i) * capF(i), exitCapVehH: exitCapVehH * exitF, inflow: inflow?.map((x) => x * Math.exp(0.15 * gauss(r))), queue: m.q });
      m.n = st.n.map((x) => Math.max(0, x * (1 + modelSd * gauss(r)))); m.q = st.queue; m.lc = m.lc.map((x) => x + 0.05 * gauss(r));
    }
  }
  const Hx = (m, o) => {
    const c = route.cells[o.cell], k = m.n[o.cell] / (c.lenKm * c.lanes);
    if (o.tipo === 'camara-densidad') return k;
    if (o.tipo === 'camara-flujo') { // flujo que cruza la línea de conteo al final de la celda (veh/min), como en el CTM
      const cf = capOf(m), send = Math.min(c.fd.vfKmh * k, c.fd.qmax * cf(o.cell) * lastCapF(o.cell)) * c.lanes;
      let recv;
      if (o.cell === N - 1) { const b = bottlenecks.indexOf(N); recv = lastExit * (b < 0 ? 1 : sig(m.lc[b])); }
      else { const d = route.cells[o.cell + 1], kd = m.n[o.cell + 1] / (d.lenKm * d.lanes); recv = Math.min(d.fd.qmax * cf(o.cell + 1) * lastCapF(o.cell + 1), d.fd.wKmh * Math.max(0, d.fd.kj - kd)) * d.lanes; }
      return Math.min(send, recv) / 60;
    }
    return c.fd.speed(k); // sonda-velocidad (km/h)
  };
  function analyze(obs) {
    if (!obs.length) return;
    const M = ens.length, X = ens.map((m) => [...m.n, ...m.lc]), D = X[0].length, P = obs.length;
    const Y = ens.map((m) => obs.map((o) => Hx(m, o)));
    const xm = new Array(D).fill(0), ym = new Array(P).fill(0);
    for (let e = 0; e < M; e++) { for (let d = 0; d < D; d++) xm[d] += X[e][d] / M; for (let p = 0; p < P; p++) ym[p] += Y[e][p] / M; }
    const Pyy = Array.from({ length: P }, (_, a) => Array.from({ length: P }, (_, b) => { let s = 0; for (let e = 0; e < M; e++) s += (Y[e][a] - ym[a]) * (Y[e][b] - ym[b]); return s / (M - 1) + (a === b ? obs[a].sd ** 2 : 0); }));
    const Pxy = Array.from({ length: D }, (_, d) => Array.from({ length: P }, (_, p) => { let s = 0; for (let e = 0; e < M; e++) s += (X[e][d] - xm[d]) * (Y[e][p] - ym[p]); return s / (M - 1); }));
    const innov = ens.map((_, e) => obs.map((o, p) => o.valor + o.sd * gauss(r) - Y[e][p]));
    const Z = solveSym(Pyy, innov.length ? transpose(innov) : [[0]]); // P×M
    for (let e = 0; e < M; e++) {
      for (let d = 0; d < D; d++) { let s = 0; for (let p = 0; p < P; p++) s += Pxy[d][p] * Z[p][e]; X[e][d] += s; }
      ens[e].n = X[e].slice(0, N).map((x) => Math.max(0, x)); ens[e].lc = X[e].slice(N);
    }
  }
  const mean = () => ({ n: ens[0].n.map((_, i) => ens.reduce((s, m) => s + m.n[i], 0) / ens.length), capFactor: bottlenecks.map((_, b) => ens.reduce((s, m) => s + sig(m.lc[b]), 0) / ens.length), capSd: bottlenecks.map((_, b) => { const v = ens.map((m) => sig(m.lc[b])), mu = v.reduce((a, x) => a + x, 0) / v.length; return Math.sqrt(v.reduce((a, x) => a + (x - mu) ** 2, 0) / (v.length - 1)); }) });
  return { ens, forecast, analyze, mean, Hx };
}
function transpose(A) { return A[0].map((_, j) => A.map((row) => row[j])); }

/**
 * Ruido de observación de una cámara a partir de sus conteos reales: varianza entre fotogramas del
 * número de vehículos en imagen (incluye errores del detector) y tasa de cruces con su error de Poisson.
 */
export function cameraNoiseFromCounts({ perFrame = null, meanInFrame, crossings, durationS }) {
  const mu = meanInFrame ?? (perFrame ? perFrame.reduce((a, b) => a + b, 0) / perFrame.length : 0);
  const varF = perFrame ? perFrame.reduce((a, x) => a + (x - mu) ** 2, 0) / Math.max(1, perFrame.length - 1) : mu;
  const ratePerMin = (crossings / durationS) * 60, rateSd = (Math.sqrt(Math.max(1, crossings)) / durationS) * 60;
  return { meanInFrame: +mu.toFixed(2), sdInFrame: +Math.sqrt(Math.max(varF, mu, 0.25)).toFixed(2), ratePerMin: +ratePerMin.toFixed(2), rateSdPerMin: +rateSd.toFixed(2) };
}

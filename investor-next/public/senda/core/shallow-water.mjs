// @ts-check
/**
 * SENDA · motor hidrodinámico 2D de aguas someras (formulación inercial simplificada).
 *
 * Método: Bates, P. D., Horritt, M. S. y Fewtrell, T. J. (2010). «A simple inertial formulation of the shallow water
 * equations for efficient two-dimensional flood inundation modelling». Journal of Hydrology 387: 33–45.
 * Es la base del modelo LISFLOOD-FP. Por cada cara entre dos celdas:
 *
 *   q⁽ᵗ⁺ᐞᵗ⁾ = ( qᵗ − g·h_f·Δt·∂η/∂x ) / ( 1 + g·Δt·n²·|qᵗ| / h_f^(7/3) )        [m²/s, caudal por unidad de ancho]
 *   h_f = max(ηᵢ, ηᵢ₊₁) − max(zᵢ, zᵢ₊₁)      (calado en la cara; η = h + z)
 *   Δt = α·Δx / √(g·h_max)                  (condición de Courant; α = 0,7 como en el artículo)
 *   Continuidad: Δh = Δt·(Σq_entra − Σq_sale)/Δx
 *
 * Límites declarados: malla regular, rugosidad de Manning uniforme o por celda; sin término de advección (el propio
 * método lo omite: válido para flujo lento a moderado; en frentes muy rápidos subestima la inercia); los sumideros
 * (mar, lagos con cota ≤ 0, borde) absorben el agua que llega.
 */
const G = 9.81;

/**
 * Crea una simulación. z: cotas (m, NaN = sin dato → se trata como sumidero), dx: lado de celda (m),
 * n: Manning (s/m^(1/3)) número o Float32Array por celda, sink: Uint8Array (1 = absorbe), hMin: calado mínimo para fluir.
 */
export function createSim({ w, h, z, dx, n, sink = null, alpha = 0.7, hMin = 1e-3, hArrive = 0.1 }) {
  if (!(n > 0) && !(n instanceof Float32Array)) throw new Error('falta la rugosidad de Manning n (sin valor por defecto)');
  const N = w * h, zz = new Float64Array(N), sk = new Uint8Array(N);
  for (let k = 0; k < N; k++) { const v = z[k]; if (Number.isFinite(v)) zz[k] = v; else { zz[k] = 0; sk[k] = 1; } if (sink?.[k]) sk[k] = 1; }
  return {
    w, h, dx, alpha, hMin, hArrive, n, z: zz, sink: sk,
    d: new Float64Array(N), qx: new Float64Array((w - 1) * h), qy: new Float64Array(w * (h - 1)),
    maxD: new Float32Array(N), arrive: new Float32Array(N).fill(NaN), t: 0,
    volIn: 0, volOut: 0, box: null, steps: 0,
  };
}

const nAt = (S, k) => (typeof S.n === 'number' ? S.n : S.n[k]);
/** Volumen almacenado (m³). */
export function storedVolume(S) { let v = 0; for (let k = 0; k < S.d.length; k++) v += S.d[k]; return v * S.dx * S.dx; }

function growBox(S, i, j) {
  const b = S.box; if (!b) { S.box = [i, i, j, j]; return; }
  if (i < b[0]) b[0] = i; if (i > b[1]) b[1] = i; if (j < b[2]) b[2] = j; if (j > b[3]) b[3] = j;
}

/**
 * Un paso. sources: [{ k, q }] caudal (m³/s) que entra en la celda k. Devuelve Δt usado.
 */
export function step(S, dtMax, sources = []) {
  const { w, h, dx, z, d, qx, qy, sink, hMin, alpha } = S;
  for (const s of sources) growBox(S, s.k % w, (s.k / w) | 0);
  if (!S.box) { S.t += dtMax; return dtMax; }
  // caja activa ampliada en 1 celda
  const b = S.box, i0 = Math.max(0, b[0] - 1), i1 = Math.min(w - 1, b[1] + 1), j0 = Math.max(0, b[2] - 1), j1 = Math.min(h - 1, b[3] + 1);
  let dMax = 0; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const v = d[j * w + i]; if (v > dMax) dMax = v; }
  let dt = dMax > hMin ? (alpha * dx) / Math.sqrt(G * dMax) : dtMax; if (dt > dtMax) dt = dtMax;
  // flujos en x
  for (let j = j0; j <= j1; j++) for (let i = i0; i < i1; i++) {
    const a = j * w + i, c = a + 1, f = j * (w - 1) + i, ea = d[a] + z[a], ec = d[c] + z[c];
    const hf = Math.max(ea, ec) - Math.max(z[a], z[c]);
    if (hf <= hMin) { qx[f] = 0; continue; }
    const nn = 0.5 * (nAt(S, a) + nAt(S, c)), q0 = qx[f];
    qx[f] = (q0 - G * hf * dt * (ec - ea) / dx) / (1 + (G * dt * nn * nn * Math.abs(q0)) / hf ** (7 / 3));
  }
  // flujos en y
  for (let j = j0; j < j1; j++) for (let i = i0; i <= i1; i++) {
    const a = j * w + i, c = a + w, f = a, ea = d[a] + z[a], ec = d[c] + z[c];
    const hf = Math.max(ea, ec) - Math.max(z[a], z[c]);
    if (hf <= hMin) { qy[f] = 0; continue; }
    const nn = 0.5 * (nAt(S, a) + nAt(S, c)), q0 = qy[f];
    qy[f] = (q0 - G * hf * dt * (ec - ea) / dx) / (1 + (G * dt * nn * nn * Math.abs(q0)) / hf ** (7 / 3));
  }
  // limitador: una celda no puede ceder más agua de la que tiene en este paso (evita calados negativos)
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * w + i; let out = 0;
    if (i < w - 1 && qx[j * (w - 1) + i] > 0) out += qx[j * (w - 1) + i];
    if (i > 0 && qx[j * (w - 1) + i - 1] < 0) out -= qx[j * (w - 1) + i - 1];
    if (j < h - 1 && qy[k] > 0) out += qy[k];
    if (j > 0 && qy[k - w] < 0) out -= qy[k - w];
    const avail = d[k] * dx / dt;
    if (out > avail && out > 0) {
      const r = avail / out;
      if (i < w - 1 && qx[j * (w - 1) + i] > 0) qx[j * (w - 1) + i] *= r;
      if (i > 0 && qx[j * (w - 1) + i - 1] < 0) qx[j * (w - 1) + i - 1] *= r;
      if (j < h - 1 && qy[k] > 0) qy[k] *= r;
      if (j > 0 && qy[k - w] < 0) qy[k - w] *= r;
    }
  }
  // continuidad
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * w + i;
    let net = 0;
    if (i > 0) net += qx[j * (w - 1) + i - 1]; if (i < w - 1) net -= qx[j * (w - 1) + i];
    if (j > 0) net += qy[k - w]; if (j < h - 1) net -= qy[k];
    let nd = d[k] + (dt * net) / dx; if (nd < 0) nd = 0;
    d[k] = nd;
  }
  for (const s of sources) { d[s.k] += (s.q * dt) / (dx * dx); S.volIn += s.q * dt; }
  // sumideros, máximos, llegada y caja activa
  const tEnd = S.t + dt;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * w + i, v = d[k]; if (v <= 0) continue;
    if (sink[k]) { S.volOut += v * dx * dx; d[k] = 0; continue; }
    if (v > S.maxD[k]) S.maxD[k] = v;
    if (v >= S.hArrive && Number.isNaN(S.arrive[k])) S.arrive[k] = tEnd;
    if (v > hMin) growBox(S, i, j);
  }
  S.t = tEnd; S.steps++;
  return dt;
}

/**
 * Avanza hasta tEnd (s) con un hidrograma Q(t) repartido entre las celdas de entrada. onFrame(t) cada frameEvery s.
 * @param {any} S
 * @param {number} tEnd
 * @param {{ inflow?: (t: number) => number, cells?: number[], dtMax?: number, frameEvery?: number, onFrame?: ((t: number) => void) | null }} [opts]
 */
export function runUntil(S, tEnd, { inflow = /** @type {(t: number) => number} */ (() => 0), cells = [], dtMax = 10, frameEvery = 0, onFrame = null } = {}) {
  let nextFrame = frameEvery ? Math.ceil(S.t / frameEvery) * frameEvery : Infinity;
  while (S.t < tEnd - 1e-9) {
    const q = inflow(S.t), src = q > 0 && cells.length ? cells.map((k) => ({ k, q: q / cells.length })) : [];
    step(S, Math.min(dtMax, tEnd - S.t, nextFrame - S.t > 0 ? nextFrame - S.t : dtMax), src);
    if (onFrame && S.t >= nextFrame - 1e-9) { onFrame(S.t); nextFrame += frameEvery; }
  }
  return S;
}

/** Hidrograma lineal a trozos: puntos [[tSeg, Q]], 0 fuera del intervalo. */
export const piecewise = (pts) => (t) => {
  if (t <= pts[0][0] || t >= pts.at(-1)[0]) return t === pts[0][0] ? pts[0][1] : 0;
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, q0] = pts[i - 1], [t1, q1] = pts[i]; return q0 + ((q1 - q0) * (t - t0)) / (t1 - t0); }
  return 0;
};

/** Volumen de un hidrograma lineal a trozos (m³), por la regla del trapecio exacta. */
export const hydrographVolume = (pts) => pts.slice(1).reduce((s, [t1, q1], i) => s + 0.5 * (q1 + pts[i][1]) * (t1 - pts[i][0]), 0);

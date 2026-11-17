/**
 * SENDA · Masa de aire y flujo 3D alrededor de un incendio (v0.19).
 *
 * 1. TERMODINÁMICA de la columna: punto de rocío, razón de mezcla, temperatura virtual, DENSIDAD del aire,
 *    temperatura potencial, frecuencia de Brunt–Väisälä (estabilidad), nivel de condensación e índice de Haines.
 * 2. PERFILES REALES de un modelo meteorológico (GFS 0,25°) interpolados a cualquier punto y altura.
 * 3. SENSORES DE MULTITUD como estación meteorológica de zona:
 *    - interpolación óptima (Gandin) de observaciones dispersas sobre un fondo de modelo, con varianza del análisis;
 *    - coches: presión barométrica y temperatura exterior por OBD-II (SAE J1979, PID 0x33 y 0x46);
 *    - «anemometría de flota»: el viento a lo largo de la vía se despeja de la deceleración en rueda libre
 *      (balance aerodinámico + rodadura + pendiente), y varios coches con rumbos distintos dan el vector viento;
 *    - barómetros de móviles y coches reducidos a una altura común, con sesgo por dispositivo (Kalman).
 * 4. VIENTO 3D CON CONSERVACIÓN DE MASA sobre el terreno (método variacional de WindNinja/MATHEW):
 *    se corrige el campo inicial lo mínimo para que ∇·u = 0, con el terreno como pared. Malla MAC y SOR.
 * 5. PLUMA del incendio (Briggs): flujo de flotabilidad, ascenso curvado por el viento y altura final;
 *    la corriente ascendente se impone y la proyección genera sola la ASPIRACIÓN de aire hacia el fuego.
 * 6. AVIONES Y HELICÓPTEROS: estela de vórtices, chorro del rotor y energía que absorbe una descarga de agua.
 * 7. PARTÍCULAS: humo y pavesas transportados por el campo 3D (RK2 + paseo aleatorio), con caída terminal.
 *
 * Todo es determinista (semilla fija). Unidades SI salvo que el nombre diga otra cosa. Las constantes empíricas
 * citan su fuente; las que son supuestos lo dicen. Esto es un modelo diagnóstico para decidir avisos, no un
 * sustituto de WRF-SFIRE, QUIC-Fire o FARSITE.
 */

export const G = 9.80665, RD = 287.05, RV = 461.5, CP = 1004.6, EPS = RD / RV, LV = 2.501e6, LV100 = 2.257e6, CW = 4186;
const K0 = 273.15, rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI, n360 = (a) => ((a % 360) + 360) % 360;

// ---------------------------------------------------------------- 1) Termodinámica
/** Presión de vapor de saturación (hPa), Magnus (Alduchov y Eskridge, 1996). */
export const satVapHpa = (tC) => 6.1094 * Math.exp((17.625 * tC) / (tC + 243.04));
/** Punto de rocío (°C) por inversión de Magnus. */
export function dewPoint(tC, rh) { const g = Math.log(Math.max(1e-3, rh) / 100) + (17.625 * tC) / (243.04 + tC); return (243.04 * g) / (17.625 - g); }
/** Razón de mezcla (kg/kg) a presión p (hPa). */
export const mixingRatio = (pHpa, eHpa) => (EPS * eHpa) / Math.max(1e-6, pHpa - eHpa);
/** Temperatura virtual (K). */
export const virtualTempK = (tC, r) => (tC + K0) * ((1 + r / EPS) / (1 + r));
/** Densidad del aire húmedo (kg/m³): ρ = p / (Rd·Tv). 1013,25 hPa y 15 °C seco → 1,225. */
export function airDensity(pHpa, tC, rh = 0) { const e = (rh / 100) * satVapHpa(tC), r = mixingRatio(pHpa, e); return (pHpa * 100) / (RD * virtualTempK(tC, r)); }
/** Temperatura potencial (K). */
export const potentialTempK = (tC, pHpa) => (tC + K0) * (1000 / pHpa) ** (RD / CP);
/** Frecuencia de Brunt–Väisälä al cuadrado (s⁻²) entre dos niveles. N² > 0 estable, < 0 inestable. */
export const bruntN2 = (th1, z1, th2, z2) => (G / ((th1 + th2) / 2)) * ((th2 - th1) / (z2 - z1));
/** Altura aproximada del nivel de condensación (m sobre el punto): fórmula de Espy, ≈ 125 m por °C de diferencia T − Td. */
export const lclHeightM = (tC, tdC) => 125 * Math.max(0, tC - tdC);
/**
 * Índice de Haines (1988): estabilidad + sequedad de la baja troposfera, de 2 a 6. Variante por altitud del terreno.
 * @param {'low'|'mid'|'high'} variant  low: 950–850 hPa; mid: 850–700 hPa (meseta ibérica); high: 700–500 hPa
 */
export function hainesIndex({ t950, t850, t700, t500, td850, td700 }, variant = 'mid') {
  const sc = (x, a, b) => (x <= a ? 1 : x <= b ? 2 : 3);
  if (variant === 'low') return { A: sc(t950 - t850, 3, 7), B: sc(t850 - td850, 5, 9), get value() { return this.A + this.B; } };
  if (variant === 'high') return { A: sc(t700 - t500, 17, 21), B: sc(t700 - td700, 14, 20), get value() { return this.A + this.B; } };
  return { A: sc(t850 - t700, 5, 10), B: sc(t850 - td850, 5, 12), get value() { return this.A + this.B; } };
}

// ---------------------------------------------------------------- 2) Perfiles de un modelo (GFS)
/**
 * Interpola bilinealmente un instante GFS (formato de `fixtures`/`gfs_*.json`) en (lat, lon) y devuelve el perfil
 * vertical ordenado de abajo arriba: presión, altura geopotencial, T, HR, viento, densidad y θ, más la superficie.
 */
export function gfsProfile(time, grid, lat, lon) {
  const { lats, lons } = grid, f = time.fields;
  const fi = (lon - lons[0]) / (lons[1] - lons[0]), fj = (lats[0] - lat) / (lats[0] - lats[1]);
  const i0 = Math.max(0, Math.min(lons.length - 2, Math.floor(fi))), j0 = Math.max(0, Math.min(lats.length - 2, Math.floor(fj))), a = fi - i0, b = fj - j0;
  const at = (k) => { const A = f[k]; if (!A) return null; return (1 - a) * (1 - b) * A[j0][i0] + a * (1 - b) * A[j0][i0 + 1] + (1 - a) * b * A[j0 + 1][i0] + a * b * A[j0 + 1][i0 + 1]; };
  const levels = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500].map((p) => {
    const z = at(`HGT@${p} mb`), tK = at(`TMP@${p} mb`); if (z == null || tK == null) return null;
    const tC = tK - K0, rh = at(`RH@${p} mb`) ?? 50;
    return { p, z, tC, rh, td: dewPoint(tC, rh), u: at(`UGRD@${p} mb`) ?? 0, v: at(`VGRD@${p} mb`) ?? 0, omega: at(`VVEL@${p} mb`) ?? 0, rho: airDensity(p, tC, rh), theta: potentialTempK(tC, p) };
  }).filter(Boolean);
  const zs = at('HGT@surface') ?? 0, ps = (at('PRES@surface') ?? 101325) / 100;
  const sfc = { zs, pHpa: ps, t2: (at('TMP@2 m above ground') ?? 288) - K0, rh2: at('RH@2 m above ground') ?? 50, u10: at('UGRD@10 m above ground') ?? 0, v10: at('VGRD@10 m above ground') ?? 0, gust: at('GUST@surface'), hpbl: at('HPBL@surface'), cape: at('CAPE@surface'), mslp: (at('PRMSL@mean sea level') ?? 101325) / 100 };
  const above = levels.filter((l) => l.z > zs + 5);
  return { lat, lon, validUTC: time.validUTC, sfc, levels: above, all: levels };
}
/** Valor del perfil a una altura sobre el suelo (m): T, viento, densidad, θ; ley logarítmica entre 10 m y el primer nivel. */
export function profileAt(prof, zAGL, { z0 = 0.5 } = {}) {
  const { sfc, levels } = prof, z = Math.max(0, zAGL);
  const s10 = { zA: 10, tC: sfc.t2 - 0.0098 * 8, u: sfc.u10, v: sfc.v10, rho: airDensity(sfc.pHpa, sfc.t2, sfc.rh2), theta: potentialTempK(sfc.t2, sfc.pHpa) };
  const pts = [s10, ...levels.map((l) => ({ zA: l.z - sfc.zs, tC: l.tC, u: l.u, v: l.v, rho: l.rho, theta: l.theta }))];
  if (z <= 10) { const k = Math.log(Math.max(z, z0 * 1.01) / z0) / Math.log(10 / z0); return { ...s10, u: s10.u * k, v: s10.v * k, zA: z }; }
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1]; if (z > B.zA) continue;
    const w = i === 0 ? Math.log(z / A.zA) / Math.log(B.zA / A.zA) : (z - A.zA) / (B.zA - A.zA); // capa superficial: interpolación en ln z
    const sA = Math.hypot(A.u, A.v), sB = Math.hypot(B.u, B.v), dA = Math.atan2(A.u, A.v); let dd = Math.atan2(B.u, B.v) - dA; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    const sp = sA + (sB - sA) * w, dr = dA + dd * w;
    return { zA: z, tC: A.tC + (B.tC - A.tC) * w, u: sp * Math.sin(dr), v: sp * Math.cos(dr), rho: A.rho + (B.rho - A.rho) * w, theta: A.theta + (B.theta - A.theta) * w };
  }
  return { ...pts[pts.length - 1], zA: z };
}
/** Diagnóstico de la masa de aire en un punto: estabilidad por capas, Haines de media altitud, LCL, densidad y viento en la capa de mezcla. */
export function airMassDiagnosis(prof) {
  const lv = prof.all, by = Object.fromEntries(lv.map((l) => [l.p, l]));
  const layers = []; for (let i = 0; i < prof.levels.length - 1; i++) { const a = prof.levels[i], b = prof.levels[i + 1]; layers.push({ from: a.p, to: b.p, zA: Math.round(a.z - prof.sfc.zs), lapseKkm: +(((a.tC - b.tC) / (b.z - a.z)) * 1000).toFixed(2), N2: +bruntN2(a.theta, a.z, b.theta, b.z).toExponential(2) }); }
  const haines = by[850] && by[700] ? hainesIndex({ t850: by[850].tC, t700: by[700].tC, td850: by[850].td }, 'mid') : null;
  const wind10 = Math.hypot(prof.sfc.u10, prof.sfc.v10), dirFrom10 = n360(deg(Math.atan2(-prof.sfc.u10, -prof.sfc.v10)));
  const mixTop = prof.sfc.hpbl ?? null, inMix = prof.levels.filter((l) => mixTop == null || l.z - prof.sfc.zs <= mixTop);
  const mixWind = inMix.length ? Math.max(...inMix.map((l) => Math.hypot(l.u, l.v))) : null;
  const freeN2 = layers.filter((l) => mixTop != null && l.zA > mixTop).map((l) => +l.N2)[0] ?? null;
  return {
    validUTC: prof.validUTC, t2: +prof.sfc.t2.toFixed(1), rh2: +prof.sfc.rh2.toFixed(0), td2: +dewPoint(prof.sfc.t2, prof.sfc.rh2).toFixed(1), pSfcHpa: +prof.sfc.pHpa.toFixed(1), mslp: +prof.sfc.mslp.toFixed(1),
    rhoSfc: +airDensity(prof.sfc.pHpa, prof.sfc.t2, prof.sfc.rh2).toFixed(3), wind10Kmh: +(wind10 * 3.6).toFixed(1), dirFrom10: Math.round(dirFrom10), gustKmh: prof.sfc.gust != null ? +(prof.sfc.gust * 3.6).toFixed(1) : null,
    hpblM: mixTop != null ? Math.round(mixTop) : null, mixMaxWindKmh: mixWind != null ? +(mixWind * 3.6).toFixed(1) : null, lclM: Math.round(lclHeightM(prof.sfc.t2, dewPoint(prof.sfc.t2, prof.sfc.rh2))), capeJkg: prof.sfc.cape != null ? Math.round(prof.sfc.cape) : null,
    haines: haines ? { A: haines.A, B: haines.B, value: haines.value } : null, freeTropN2: freeN2, layers,
  };
}

// ---------------------------------------------------------------- 3) Sensores de multitud
/** Decodifica PID estándar de OBD-II (SAE J1979, modo 01): bytes A,B → valor físico. */
export function obdDecode(pid, A, B = 0) {
  switch (pid) {
    case 0x0d: return { name: 'velocidad', unit: 'km/h', value: A };
    case 0x0f: return { name: 'temperatura de admisión', unit: '°C', value: A - 40 };
    case 0x33: return { name: 'presión barométrica absoluta', unit: 'kPa', value: A };
    case 0x46: return { name: 'temperatura ambiente', unit: '°C', value: A - 40 };
    case 0x0c: return { name: 'régimen del motor', unit: 'rpm', value: (256 * A + B) / 4 };
    default: return null;
  }
}
/** Reduce una presión medida a la altitud z (m) a otra altitud zRef (ecuación hipsométrica). */
export const reducePressure = (pHpa, zM, zRefM, tC = 15) => pHpa * Math.exp((G * (zM - zRefM)) / (RD * (tC + K0)));
/** Filtro de Kalman escalar para el sesgo de un barómetro (hPa): innovación = medida reducida − análisis. */
export function biasKalman(state = { b: 0, P: 4 }, innovation, { R = 0.25, Q = 0.0004 } = {}) {
  const P = state.P + Q, K = P / (P + R); return { b: state.b + K * (innovation - state.b), P: (1 - K) * P, K };
}
/**
 * Viento a lo largo de la vía (m/s, + a favor de la marcha) desde una deceleración en rueda libre:
 *   m·a = −½·ρ·CdA·(v − w)|v − w| − m·g·(Crr·cos θ + sen θ)   →   w = v − v_rel
 * @param {{aMs2:number, vMs:number, massKg?:number, cdA?:number, crr?:number, gradePct?:number, rho?:number, sdA?:number, sdCdA?:number}} o
 */
export function coastdownWind({ aMs2, vMs, massKg = 1500, cdA = 0.7, crr = 0.011, gradePct = 0, rho = 1.2, sdA = 0.03, sdCdA = 0.05 }) {
  const th = Math.atan(gradePct / 100), solve = (a, c) => { const F = -massKg * a - massKg * G * (crr * Math.cos(th) + Math.sin(th)); const vr = Math.sign(F) * Math.sqrt((2 * Math.abs(F)) / (rho * c)); return vMs - vr; };
  const w = solve(aMs2, cdA), dA = (solve(aMs2 + 1e-3, cdA) - w) / 1e-3, dC = (solve(aMs2, cdA * 1.001) - w) / (cdA * 0.001);
  return { wParMs: w, sdMs: Math.sqrt((dA * sdA) ** 2 + (dC * sdCdA * cdA) ** 2) };
}
/** Vector viento (u este, v norte) por mínimos cuadrados con las componentes medidas por coches de rumbos distintos. */
export function fleetWind(obs) {
  let a = 0, b = 0, c = 0, d = 0, e = 0;
  for (const o of obs) { const s = Math.sin(rad(o.headingDeg)), co = Math.cos(rad(o.headingDeg)), w = 1 / (o.sdMs ?? 1) ** 2; a += w * s * s; b += w * s * co; c += w * co * co; d += w * s * o.wParMs; e += w * co * o.wParMs; }
  const det = a * c - b * b; if (Math.abs(det) < 1e-9) return { ok: false, reason: 'hacen falta coches con rumbos distintos' };
  const u = (c * d - b * e) / det, v = (a * e - b * d) / det, Cuu = c / det, Cvv = a / det;
  return { ok: true, u, v, speedMs: Math.hypot(u, v), dirFromDeg: n360(deg(Math.atan2(-u, -v))), sdMs: Math.sqrt((Cuu + Cvv) / 2), n: obs.length };
}
/**
 * Interpolación óptima (Gandin): análisis = fondo + B·Hᵀ·(H·B·Hᵀ + R)⁻¹·(y − H·fondo), con covarianza gaussiana.
 * @param {Array<{x:number,y:number}>} pts puntos de análisis (m)
 * @param {Array<{x:number,y:number,val:number,sd:number}>} obs
 * @param {(x:number,y:number)=>number} bg fondo (p. ej., el modelo)
 * @returns {{val:Float64Array, sd:Float64Array, innovRms:number}}
 */
export function optimalInterpolation(pts, obs, bg, { L = 3000, sdB = 1.5 } = {}) {
  const n = obs.length, cov = (dx, dy) => sdB * sdB * Math.exp(-(dx * dx + dy * dy) / (2 * L * L));
  const A = Array.from({ length: n }, (_, i) => Float64Array.from({ length: n }, (_, j) => cov(obs[i].x - obs[j].x, obs[i].y - obs[j].y) + (i === j ? obs[i].sd ** 2 : 0)));
  for (let k = 0; k < n; k++) { // Cholesky en sitio (A = L·Lᵀ)
    let s = A[k][k]; for (let m = 0; m < k; m++) s -= A[k][m] ** 2; A[k][k] = Math.sqrt(Math.max(s, 1e-12));
    for (let i = k + 1; i < n; i++) { let t = A[i][k]; for (let m = 0; m < k; m++) t -= A[i][m] * A[k][m]; A[i][k] = t / A[k][k]; }
  }
  const fwd = (b) => { const y = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let m = 0; m < i; m++) s -= A[i][m] * y[m]; y[i] = s / A[i][i]; } return y; };
  const back = (y) => { const x = new Float64Array(n); for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let m = i + 1; m < n; m++) s -= A[m][i] * x[m]; x[i] = s / A[i][i]; } return x; };
  const d = Float64Array.from(obs, (o) => o.val - bg(o.x, o.y)), alpha = back(fwd(d));
  const val = new Float64Array(pts.length), sd = new Float64Array(pts.length);
  for (let p = 0; p < pts.length; p++) {
    const k = Float64Array.from(obs, (o) => cov(pts[p].x - o.x, pts[p].y - o.y)); let s = 0; for (let i = 0; i < n; i++) s += k[i] * alpha[i];
    val[p] = bg(pts[p].x, pts[p].y) + s; const v = fwd(k); let vv = 0; for (let i = 0; i < n; i++) vv += v[i] * v[i]; sd[p] = Math.sqrt(Math.max(0, sdB * sdB - vv));
  }
  return { val, sd, innovRms: Math.sqrt(d.reduce((s, x) => s + x * x, 0) / Math.max(1, n)) };
}

// ---------------------------------------------------------------- 4) Viento 3D con conservación de masa
/**
 * Malla de voxels sobre el terreno. `heightAt(x,y)` en m sobre el nivel del mar; x este, y norte en m locales.
 * Celda sólida si su centro queda bajo el terreno (terreno escalonado).
 */
export function makeWindGrid({ nx, ny, nz, dx, dz, x0 = 0, y0 = 0, heightAt, zBase }) {
  const N = nx * ny * nz, solid = new Uint8Array(N), terr = new Float32Array(nx * ny);
  let zmin = Infinity; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const h = heightAt(x0 + (i + 0.5) * dx, y0 + (j + 0.5) * dx); terr[j * nx + i] = h; zmin = Math.min(zmin, h); }
  const zb = zBase ?? Math.floor(zmin / dz) * dz - dz;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) solid[(k * ny + j) * nx + i] = zb + (k + 0.5) * dz < terr[j * nx + i] ? 1 : 0;
  return { nx, ny, nz, dx, dz, x0, y0, zBase: zb, solid, terr, id: (i, j, k) => (k * ny + j) * nx + i };
}
/** Campo inicial en las caras de la malla MAC desde un perfil `windAt(zAGL) → {u,v}` (m/s). */
export function initialWind(g, windAt) {
  const { nx, ny, nz, dx, dz, zBase, terr, solid } = g, U = new Float32Array((nx + 1) * ny * nz), V = new Float32Array(nx * (ny + 1) * nz), W = new Float32Array(nx * ny * (nz + 1));
  const sol = (i, j, k) => (i < 0 || j < 0 || i >= nx || j >= ny ? 0 : solid[(k * ny + j) * nx + i]);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) {
    if (sol(i - 1, j, k) || sol(i, j, k)) continue; const t = (terr[j * nx + Math.min(nx - 1, i)] + terr[j * nx + Math.max(0, i - 1)]) / 2;
    U[(k * ny + j) * (nx + 1) + i] = windAt(zBase + (k + 0.5) * dz - t).u;
  }
  for (let k = 0; k < nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
    if (sol(i, j - 1, k) || sol(i, j, k)) continue; const t = (terr[Math.min(ny - 1, j) * nx + i] + terr[Math.max(0, j - 1) * nx + i]) / 2;
    V[(k * (ny + 1) + j) * nx + i] = windAt(zBase + (k + 0.5) * dz - t).v;
  }
  return { U, V, W };
}
/**
 * Ajuste variacional con conservación de masa: busca el campo más cercano al inicial con ∇·u = 0.
 * Poisson ah·(λxx + λyy) + av·λzz = −div, λ = 0 en los bordes abiertos (laterales y techo), ∂λ/∂n = 0 en el terreno.
 * @param {{U,V,W}} f0 campo inicial (no se modifica)
 * @param {{vertWeight?:number, iters?:number, omega?:number, fixedW?:Uint8Array}} o vertWeight = (α1/α2)²: < 1 atmósfera estable (rodea más que remonta)
 */
export function massConsistent(g, f0, { vertWeight = 1, iters = 300, omega = 1.85, fixedW = null, tol = 1e-5 } = {}) {
  const { nx, ny, nz, dx, dz, solid } = g, N = nx * ny * nz;
  const U = Float32Array.from(f0.U), V = Float32Array.from(f0.V), W = Float32Array.from(f0.W);
  const iU = (i, j, k) => (k * ny + j) * (nx + 1) + i, iV = (i, j, k) => (k * (ny + 1) + j) * nx + i, iW = (i, j, k) => (k * ny + j) * nx + i;
  const fluid = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && !solid[(k * ny + j) * nx + i];
  const div = new Float32Array(N); let div0 = 0;
  const computeDiv = () => { let mx = 0; for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const c = (k * ny + j) * nx + i; if (solid[c]) { div[c] = 0; continue; } const d = (U[iU(i + 1, j, k)] - U[iU(i, j, k)]) / dx + (V[iV(i, j + 1, k)] - V[iV(i, j, k)]) / dx + (W[iW(i, j, k + 1)] - W[iW(i, j, k)]) / dz; div[c] = d; mx = Math.max(mx, Math.abs(d)); } return mx; };
  div0 = computeDiv();
  const ch = 1 / (dx * dx), cv = vertWeight / (dz * dz), lam = new Float32Array(N);
  // Coeficientes por celda: vecino fluido o borde abierto (λ=0) suma; terreno o cara fija (pluma) no.
  const coef = new Float32Array(N); const nbr = [];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = (k * ny + j) * nx + i; if (solid[c]) continue; let s = 0;
    const add = (ii, jj, kk, w, faceFixed) => { if (faceFixed) return; const out = ii < 0 || jj < 0 || ii >= nx || jj >= ny || kk >= nz; if (kk < 0) return; if (out || fluid(ii, jj, kk)) s += w; };
    add(i - 1, j, k, ch); add(i + 1, j, k, ch); add(i, j - 1, k, ch); add(i, j + 1, k, ch);
    add(i, j, k - 1, cv, fixedW && fixedW[iW(i, j, k)]); add(i, j, k + 1, cv, fixedW && fixedW[iW(i, j, k + 1)]);
    coef[c] = s;
  }
  let it = 0, res = 0;
  for (; it < iters; it++) {
    res = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = (k * ny + j) * nx + i; if (solid[c] || coef[c] === 0) continue; let s = 0;
      const L = (ii, jj, kk, w) => { if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || kk >= nz) return; if (kk < 0) return; const n = (kk * ny + jj) * nx + ii; if (!solid[n]) s += w * lam[n]; };
      L(i - 1, j, k, ch); L(i + 1, j, k, ch); L(i, j - 1, k, ch); L(i, j + 1, k, ch);
      if (!(fixedW && fixedW[iW(i, j, k)])) L(i, j, k - 1, cv); if (!(fixedW && fixedW[iW(i, j, k + 1)])) L(i, j, k + 1, cv);
      const nv = (s + div[c]) / coef[c], d = nv - lam[c]; lam[c] += omega * d; res = Math.max(res, Math.abs(d));
    }
    if (res < tol) break;
  }
  const lv = (i, j, k) => (i < 0 || j < 0 || i >= nx || j >= ny || k >= nz ? 0 : lam[(k * ny + j) * nx + i]);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) { const a = i - 1 >= 0 ? !solid[(k * ny + j) * nx + i - 1] : true, b = i < nx ? !solid[(k * ny + j) * nx + i] : true; if (!(a && b)) continue; U[iU(i, j, k)] += (lv(i, j, k) - lv(i - 1, j, k)) / dx; }
  for (let k = 0; k < nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) { const a = j - 1 >= 0 ? !solid[(k * ny + j - 1) * nx + i] : true, b = j < ny ? !solid[(k * ny + j) * nx + i] : true; if (!(a && b)) continue; V[iV(i, j, k)] += (lv(i, j, k) - lv(i, j - 1, k)) / dx; }
  for (let k = 1; k <= nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { if (fixedW && fixedW[iW(i, j, k)]) continue; const a = !solid[((k - 1) * ny + j) * nx + i], b = k < nz ? !solid[(k * ny + j) * nx + i] : true; if (!(a && b)) continue; W[iW(i, j, k)] += (vertWeight * (lv(i, j, k) - lv(i, j, k - 1))) / dz; }
  const divEnd = computeDiv();
  return { U, V, W, iters: it, divBefore: div0, divAfter: divEnd, residual: res };
}
/** Velocidad en el centro de una celda (media de caras). */
export function cellVelocity(g, f, i, j, k) {
  const { nx, ny } = g;
  return { u: (f.U[(k * ny + j) * (nx + 1) + i] + f.U[(k * ny + j) * (nx + 1) + i + 1]) / 2, v: (f.V[(k * (ny + 1) + j) * nx + i] + f.V[(k * (ny + 1) + j + 1) * nx + i]) / 2, w: (f.W[(k * ny + j) * nx + i] + f.W[((k + 1) * ny + j) * nx + i]) / 2 };
}
/** Interpolación trilineal de la velocidad en (x,y,z) locales (m, z sobre el mar). */
export function sampleWind(g, f, x, y, z) {
  const { nx, ny, nz, dx, dz, x0, y0, zBase } = g, fx = (x - x0) / dx - 0.5, fy = (y - y0) / dx - 0.5, fz = (z - zBase) / dz - 0.5;
  const i = Math.max(0, Math.min(nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(ny - 2, Math.floor(fy))), k = Math.max(0, Math.min(nz - 2, Math.floor(fz)));
  const a = Math.max(0, Math.min(1, fx - i)), b = Math.max(0, Math.min(1, fy - j)), c = Math.max(0, Math.min(1, fz - k)); let u = 0, v = 0, w = 0;
  for (const [di, wa] of [[0, 1 - a], [1, a]]) for (const [dj, wb] of [[0, 1 - b], [1, b]]) for (const [dk, wc] of [[0, 1 - c], [1, c]]) { const q = cellVelocity(g, f, i + di, j + dj, k + dk), s = wa * wb * wc; u += s * q.u; v += s * q.v; w += s * q.w; }
  return { u, v, w };
}

// ---------------------------------------------------------------- 5) Pluma del incendio (Briggs)
/** Flujo de flotabilidad (m⁴/s³) de un foco de calor Q (W): F = g·Q / (π·cp·ρ·T)  (Briggs, 1969). */
export const buoyancyFlux = (qW, { rho = 1.1, tK = 305 } = {}) => (G * qW) / (Math.PI * CP * rho * tK);
/**
 * Pluma curvada por el viento: ascenso Δz(x) = 1,6·F^⅓·x^⅔/U hasta la altura final:
 *   estable (N² > 0): 2,6·(F/(U·N²))^⅓;  neutra/inestable: limitada por la capa de mezcla.
 */
export function briggsPlume({ qW, U, N2 = 1e-4, hpbl = 1500, rho = 1.1, tK = 305 }) {
  const F = buoyancyFlux(qW, { rho, tK }), Uc = Math.max(1, U), stable = N2 > 1e-5 ? 2.6 * (F / (Uc * N2)) ** (1 / 3) : Infinity;
  const finalRise = Math.min(stable, Math.max(hpbl * 1.2, 300) + (N2 > 1e-5 ? 0 : 1000)), xFinal = ((finalRise * Uc) / (1.6 * F ** (1 / 3))) ** 1.5;
  const rise = (x) => Math.min(finalRise, (1.6 * F ** (1 / 3) * Math.max(x, 1) ** (2 / 3)) / Uc), wAt = (x) => (x >= xFinal ? 0 : (2 / 3) * 1.6 * F ** (1 / 3) * Math.max(x, 5) ** (-1 / 3));
  return { F, finalRiseM: finalRise, xFinalM: xFinal, rise, wAt, radiusAt: (x) => Math.max(15, 0.5 * rise(x)) };
}
/** Impone la corriente ascendente de la pluma como caras fijas de la malla (la proyección genera la aspiración). */
export function imposePlume(g, f, { x, y, qW, U, dirToDeg, N2, hpbl, wMax = 18 }) {
  const { nx, ny, nz, dx, dz, x0, y0, zBase, terr } = g, P = briggsPlume({ qW, U, N2, hpbl }), fixed = new Uint8Array(nx * ny * (nz + 1)), W = Float32Array.from(f.W);
  const ux = Math.sin(rad(dirToDeg)), uy = Math.cos(rad(dirToDeg)), ci = Math.floor((x - x0) / dx), cj = Math.floor((y - y0) / dx), zf = terr[Math.max(0, Math.min(ny - 1, cj)) * nx + Math.max(0, Math.min(nx - 1, ci))];
  let faces = 0;
  for (let k = 1; k <= nz; k++) {
    const zA = zBase + k * dz - zf; if (zA <= 0 || zA > P.finalRiseM) continue;
    const xd = ((zA * U) / (1.6 * P.F ** (1 / 3))) ** 1.5, w = Math.min(wMax, P.wAt(xd)), r = P.radiusAt(xd); if (w <= 0.2) continue;
    const cx = x + ux * xd, cy = y + uy * xd, rr = Math.max(dx * 0.75, r);
    for (let j = Math.floor((cy - rr - y0) / dx); j <= Math.floor((cy + rr - y0) / dx); j++) for (let i = Math.floor((cx - rr - x0) / dx); i <= Math.floor((cx + rr - x0) / dx); i++) {
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue; const px = x0 + (i + 0.5) * dx, py = y0 + (j + 0.5) * dx; if (Math.hypot(px - cx, py - cy) > rr) continue;
      const id = (k * ny + j) * nx + i; if (k < nz && g.solid[(k * ny + j) * nx + i]) continue; W[id] = w * Math.exp(-((Math.hypot(px - cx, py - cy) / rr) ** 2)); fixed[id] = 1; faces++;
    }
  }
  return { field: { U: f.U, V: f.V, W }, fixedW: fixed, plume: P, faces };
}

// ---------------------------------------------------------------- 6) Aviones, helicópteros y descargas
/** Par de vórtices de estela (ala elíptica): Γ0 = M·g / (ρ·V·b0), b0 = π·b/4; descenso w = Γ0 / (2π·b0); racha inducida a altura h ≈ Γ0 / (2π·h). */
export function wakeVortex({ massKg, speedMs, spanM, rho = 1.1, heightM = 40 }) {
  const b0 = (Math.PI * spanM) / 4, G0 = (massKg * G) / (rho * speedMs * b0);
  return { circulation: G0, b0, descentMs: G0 / (2 * Math.PI * b0), groundGustMs: G0 / (2 * Math.PI * Math.max(heightM, b0 / 2)), timeToGroundS: heightM / (G0 / (2 * Math.PI * b0)) };
}
/** Chorro del rotor en vuelo estacionario (teoría de cantidad de movimiento): v_i = √(W / (2ρA)); estela lejana ≈ 2·v_i. */
export function rotorDownwash({ massKg, rotorRadiusM, rho = 1.1 }) { const vi = Math.sqrt((massKg * G) / (2 * rho * Math.PI * rotorRadiusM ** 2)); return { induced: vi, farWake: 2 * vi }; }
/**
 * Energía que puede absorber una descarga de agua frente a la potencia del frente bajo la huella:
 * E = m·(c_w·ΔT + L_v)·η   frente a   P = I·L_huella. Devuelve los segundos de fuego «anulados» en la huella.
 * η (fracción que llega a evaporarse sobre la llama) es un SUPUESTO; por defecto 0,3.
 */
export function dropEffect({ litres, intensityKWm, footprintM = 120, eta = 0.3, deltaT = 80 }) {
  const m = litres, E = m * (CW * deltaT + LV100) * eta, P = intensityKWm * 1000 * footprintM;
  return { energyGJ: E / 1e9, firePowerMW: P / 1e6, secondsCancelled: E / P, linePerLitreM: footprintM / litres };
}
/** Aeronaves de extinción de referencia (capacidades publicadas por los fabricantes; masa y envergadura aproximadas). */
export const AIRCRAFT = Object.freeze({
  'CL-415': { kind: 'avion', litres: 6137, massKg: 19890, spanM: 28.6, speedMs: 62 },
  'AT-802F': { kind: 'avion', litres: 3028, massKg: 7257, spanM: 18.0, speedMs: 55 },
  'helicoptero-medio': { kind: 'helicoptero', litres: 1200, massKg: 5000, rotorRadiusM: 7.0 },
});

// ---------------------------------------------------------------- 7) Partículas (humo y pavesas)
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/**
 * Transporta partículas con el campo 3D: RK2 + paseo aleatorio (σ turbulento), con velocidad terminal para pavesas.
 * Devuelve las trayectorias muestreadas y los puntos de caída (focos secundarios posibles).
 */
export function advectParticles(g, f, seeds, { dt = 2, steps = 300, sigmaTurb = 0.8, terminalMs = 0, burnoutS = Infinity, seed = 1, every = 10 } = {}) {
  const R = rng(seed), N = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
  const { nx, ny, dx, x0, y0, terr } = g, ground = (x, y) => { const i = Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / dx))), j = Math.max(0, Math.min(ny - 1, Math.floor((y - y0) / dx))); return terr[j * nx + i]; };
  const tracks = [], landed = [];
  for (const s0 of seeds) {
    let p = { ...s0 }; const tr = [{ ...p }]; let t = 0;
    for (let n = 0; n < steps; n++) {
      const a = sampleWind(g, f, p.x, p.y, p.z), mid = { x: p.x + a.u * dt / 2, y: p.y + a.v * dt / 2, z: p.z + (a.w - terminalMs) * dt / 2 }, b = sampleWind(g, f, mid.x, mid.y, mid.z);
      p = { x: p.x + b.u * dt + sigmaTurb * Math.sqrt(dt) * N(), y: p.y + b.v * dt + sigmaTurb * Math.sqrt(dt) * N(), z: p.z + (b.w - terminalMs) * dt + 0.5 * sigmaTurb * Math.sqrt(dt) * N() }; t += dt;
      const outside = p.x < x0 || p.y < y0 || p.x > x0 + nx * dx || p.y > y0 + ny * dx;
      if (n % every === 0) tr.push({ ...p });
      if (p.z <= ground(p.x, p.y) + 1) { landed.push({ x: p.x, y: p.y, t, alive: t <= burnoutS, distM: Math.hypot(p.x - s0.x, p.y - s0.y) }); break; }
      if (outside || t > burnoutS * 3) break;
    }
    tracks.push(tr);
  }
  return { tracks, landed };
}

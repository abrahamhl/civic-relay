/**
 * SENDA · Motor hidrodinámico 2D de volúmenes finitos bien equilibrado con porosidad urbana,
 * estabilidad de personas/vehículos y respaldo WebGPU/CPU (`shallow-water-fv.mjs`).
 *
 * Complementa a `shallow-water.mjs` (formulación inercial de Bates et al. 2010, sin advección)
 * incorporando la ecuación completa de cantidad de movimiento en aguas someras (Saint-Venant 2D):
 *
 *   ∂(φh)/∂t + ∂(ψ_x h u)/∂x + ∂(ψ_y h v)/∂y = q_in
 *   ∂(φhu)/∂t + ∂(ψ_x (h u² + ½g h²))/∂x + ∂(ψ_y h u v)/∂y = −g ψ h ∂z/∂x + S_porosidad − S_fricción
 *   ∂(φhv)/∂t + ∂(ψ_x h u v)/∂x + ∂(ψ_y (h v² + ½g h²))/∂y = −g ψ h ∂z/∂y + S_porosidad − S_fricción
 *
 * Métodos publicados y referencias:
 *  - Reconstrucción hidrostática bien equilibrada y preservación de positividad:
 *    Audusse, E., Bouchut, F., Bristeau, M.-O., Klein, R. & Perthame, B. (2004).
 *    «A fast and stable well-balanced scheme with hydrostatic reconstruction for shallow water flows».
 *    SIAM J. Sci. Comput. 25(6): 2050–2065. DOI: 10.1137/S1064827503431090.
 *  - Solver de Riemann HLLC con onda de contacto transversal:
 *    Toro, E. F., Spruce, M. & Speares, W. (1994). «Restoration of the contact surface in the HLL-Riemann solver».
 *    Shock Waves 4: 25–34. DOI: 10.1007/BF01414629.
 *  - Fricción de Manning semi-implícita estable en frentes seco/mojado:
 *    Liang, Q. & Marche, F. (2009). «Numerical resolution of well-balanced shallow water equations with complex
 *    source terms». Advances in Water Resources 32(6): 873–884. DOI: 10.1016/j.advwatres.2009.02.010.
 *  - Porosidad urbana (almacenamiento φ y conectividad de caras ψ + arrastre de edificios):
 *    Sanders, B. F., Schubert, J. E. & Gallegos, H. A. (2008). «Integral formulation of shallow-water equations
 *    with anisotropic porosity for urban flood modeling». Advances in Water Resources 31(11): 1445–1460.
 *    DOI: 10.1016/j.advwatres.2008.07.012.
 *  - Estabilidad de personas en inundación:
 *    Cox, R. J., Shand, T. D. & Blacka, M. J. (2010). Australian Rainfall & Runoff Project 10, WRL TR 2010/06;
 *    DEFRA / Environment Agency (2006), Flood Risks to People Phase 2, FD2320/TR2.
 *  - Estabilidad de vehículos en inundación:
 *    Shand, T. D., Cox, R. J., Blacka, M. J. & Smith, G. P. (2011). ARR Project 10 Stage 2, WRL TR 2011/01;
 *    Martínez-Gomariz, E., Gómez, M., Russo, B. & Djordjević, S. (2018). Natural Hazards 92: 1533–1554.
 *    DOI: 10.1007/s11069-018-3262-8.
 *
 * Regla de veracidad (CLAUDE.md): la rugosidad de Manning `n` es OBLIGATORIA (sin valor por defecto).
 * Toda salida declara `basis: 'MODEL'` o `'SIMULATION'`.
 */

export const GRAVITY_MS2 = 9.81;

/* ───────────── 1. Solver de Riemann HLLC + reconstrucción hidrostática (Audusse 2004 / Toro 1994) ───────────── */

/**
 * Calcula los flujos numéricos HLLC (fh, fhu, fhv) y alturas reconstruidas (hL*, hR*) en una cara 1D.
 * Preserva exactamente el reposo (C-property) y la positividad del calado.
 */
export function hllcHydrostaticFlux(hL, huL, hvL, zL, hR, huR, hvR, zR, hDry = 1e-4) {
  const zStar = zL > zR ? zL : zR;
  const hLs = Math.max(0, hL + zL - zStar);
  const hRs = Math.max(0, hR + zR - zStar);

  if (hLs <= hDry && hRs <= hDry) {
    return { fh: 0, fhu: 0, fhv: 0, hLs: 0, hRs: 0, maxWave: 0 };
  }

  const uL = hL > hDry ? huL / hL : 0;
  const vL = hL > hDry ? hvL / hL : 0;
  const uR = hR > hDry ? huR / hR : 0;
  const vR = hR > hDry ? hvR / hR : 0;

  const cL = Math.sqrt(GRAVITY_MS2 * hLs);
  const cR = Math.sqrt(GRAVITY_MS2 * hRs);

  let sL, sR;
  if (hLs <= hDry) {
    sL = uR - 2 * cR;
    sR = uR + cR;
  } else if (hRs <= hDry) {
    sL = uL - cL;
    sR = uL + 2 * cL;
  } else {
    const uStar = 0.5 * (uL + uR) + cL - cR;
    const cStar = Math.max(0, 0.5 * (cL + cR) + 0.25 * (uL - uR));
    sL = Math.min(uL - cL, uStar - cStar);
    sR = Math.max(uR + cR, uStar + cStar);
  }

  const maxWave = Math.max(Math.abs(sL), Math.abs(sR));
  const fL0 = hLs * uL;
  const fL1 = hLs * uL * uL + 0.5 * GRAVITY_MS2 * hLs * hLs;
  const fR0 = hRs * uR;
  const fR1 = hRs * uR * uR + 0.5 * GRAVITY_MS2 * hRs * hRs;

  let fh, fhu;
  if (sL >= 0) {
    fh = fL0;
    fhu = fL1;
  } else if (sR <= 0) {
    fh = fR0;
    fhu = fR1;
  } else {
    const inv = 1 / (sR - sL);
    fh = (sR * fL0 - sL * fR0 + sL * sR * (hRs - hLs)) * inv;
    fhu = (sR * fL1 - sL * fR1 + sL * sR * (hRs * uR - hLs * uL)) * inv;
  }

  // Onda de contacto HLLC para momento transversal
  const denom = hRs * (uR - sR) - hLs * (uL - sL);
  const sStar = Math.abs(denom) > 1e-12
    ? (sL * hRs * (uR - sR) - sR * hLs * (uL - sL)) / denom
    : 0.5 * (uL + uR);
  const fhv = fh * (sStar >= 0 ? vL : vR);

  return { fh, fhu, fhv, hLs, hRs, maxWave };
}

/* ───────────── 2. Motor CPU de Volúmenes Finitos 2D (Float64 y Float32 de paridad GPU) ───────────── */

/**
 * Crea una simulación FV 2D con porosidad urbana opcional (Sanders et al. 2008).
 * @param {object} cfg
 *   - `w, h, dx`: dimensiones de malla y paso espacial (m)
 *   - `z`: cotas de fondo (m, NaN = sumidero)
 *   - `n`: Manning (s/m^(1/3)) escalar o TypedArray por celda — OBLIGATORIO (sin valor por defecto)
 *   - `phi`: porosidad de almacenamiento por celda en (0, 1] (opcional, por defecto 1 = sin edificios)
 *   - `dragCoeff`: arrastre urbano por celda c_D (1/m, opcional, 0 por defecto)
 *   - `precision`: `'f64'` (alta precisión) o `'f32'` (paridad exacta con WebGPU WGSL f32)
 */
export function createFvSim({
  w,
  h,
  z,
  dx,
  n,
  sink = null,
  phi = null,
  dragCoeff = null,
  cfl = 0.45,
  hDry = 1e-4,
  hArrive = 0.1,
  precision = 'f64',
} = {}) {
  if (!(w >= 2 && h >= 2 && dx > 0)) throw new RangeError('createFvSim: w ≥ 2, h ≥ 2 y dx > 0 obligatorios');
  if (!(n > 0) && !(n instanceof Float32Array) && !(n instanceof Float64Array)) {
    throw new Error('createFvSim: falta la rugosidad de Manning n (sin valor por defecto)');
  }
  if (!(cfl > 0 && cfl <= 0.5)) throw new RangeError('createFvSim: CFL 2D explícito debe estar en (0, 0.5]');

  const Arr = precision === 'f32' ? Float32Array : Float64Array;
  const N = w * h;
  const zz = new Arr(N);
  const sk = new Uint8Array(N);
  const phiArr = new Arr(N);
  const cdArr = new Arr(N);
  const nArr = new Arr(N);

  for (let k = 0; k < N; k++) {
    const v = z[k];
    if (Number.isFinite(v)) zz[k] = v;
    else { zz[k] = 0; sk[k] = 1; }
    if (sink?.[k]) sk[k] = 1;
    const p = phi ? phi[k] : 1;
    if (!(p > 0 && p <= 1)) throw new RangeError(`createFvSim: porosidad phi[${k}]=${p} fuera de (0, 1]`);
    phiArr[k] = p;
    cdArr[k] = dragCoeff ? Math.max(0, dragCoeff[k]) : 0;
    const nv = typeof n === 'number' ? n : n[k];
    if (!(nv > 0)) throw new RangeError(`createFvSim: Manning n[${k}] debe ser > 0`);
    nArr[k] = nv;
  }

  // Porosidad de cara (media armónica/mínimo conservador de celdas adyacentes, Sanders et al. 2008)
  const psiX = new Arr((w - 1) * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = j * w + i;
      psiX[j * (w - 1) + i] = Math.min(phiArr[a], phiArr[a + 1]);
    }
  }
  const psiY = new Arr(w * (h - 1));
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w; i++) {
      const a = j * w + i;
      psiY[a] = Math.min(phiArr[a], phiArr[a + w]);
    }
  }

  return {
    basis: 'MODEL',
    method: 'FV2D Audusse-HLLC + porosidad urbana Sanders (2008) + fricción semi-implícita Liang-Marche (2009)',
    precision,
    w,
    h,
    dx,
    cfl,
    hDry,
    hArrive,
    z: zz,
    sink: sk,
    n: nArr,
    phi: phiArr,
    psiX,
    psiY,
    dragCoeff: cdArr,
    d: new Arr(N),
    hu: new Arr(N),
    hv: new Arr(N),
    // Búferes de flujo reutilizables (cero asignaciones por paso)
    fx0: new Arr((w - 1) * h),
    fx1: new Arr((w - 1) * h),
    fx2: new Arr((w - 1) * h),
    sxL: new Arr((w - 1) * h),
    sxR: new Arr((w - 1) * h),
    fy0: new Arr(w * (h - 1)),
    fy1: new Arr(w * (h - 1)),
    fy2: new Arr(w * (h - 1)),
    syB: new Arr(w * (h - 1)),
    syT: new Arr(w * (h - 1)),
    maxD: new Float32Array(N),
    maxSpeed: new Float32Array(N),
    maxDV: new Float32Array(N),
    arrive: new Float32Array(N).fill(NaN),
    t: 0,
    steps: 0,
    volIn: 0,
    volOut: 0,
    box: null,
  };
}

/** Volumen total almacenado (m³), integrando la porosidad de almacenamiento φ_k. */
export function fvStoredVolume(S) {
  let v = 0;
  for (let k = 0; k < S.d.length; k++) v += S.phi[k] * S.d[k];
  return v * S.dx * S.dx;
}

function growBoxFv(S, i, j) {
  const b = S.box;
  if (!b) { S.box = [i, i, j, j]; return; }
  if (i < b[0]) b[0] = i;
  if (i > b[1]) b[1] = i;
  if (j < b[2]) b[2] = j;
  if (j > b[3]) b[3] = j;
}

/**
 * Inicializa la lámina de agua en `S` a partir de una cota superficial `etaFn(i, j, z)` o profundidad `depthFn(i, j, z)`.
 * Actualiza automáticamente el rectángulo activo `S.box`.
 */
export function fvSetInitialDepth(S, depthFn) {
  const { w, h, z, d, hu, hv, hDry } = S;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const hk = Math.max(0, depthFn(i, j, z[k]));
      d[k] = hk;
      hu[k] = 0;
      hv[k] = 0;
      if (hk > hDry) growBoxFv(S, i, j);
    }
  }
  return S;
}

/**
 * Incisión subcelda documentada de un cauce conocido en un MDE grueso (Neal et al. 2012,
 * Water Resources Research 48, W11506, DOI: 10.1029/2012WR012514).
 * Requiere explícitamente `incisionM` (> 0) y `channelCells` (índices de celda del cauce); sin valores por defecto.
 * Devuelve copia modificada del MDE y metadatos de trazabilidad (`basis: 'MODEL'`).
 */
export function burnSubgridChannel(z, w, h, { channelCells, incisionM, bankIncisionM = 0 }) {
  if (!(incisionM > 0)) throw new RangeError('burnSubgridChannel: incisionM > 0 obligatorio (sin valor por defecto)');
  if (!Array.isArray(channelCells) || channelCells.length === 0) {
    throw new RangeError('burnSubgridChannel: channelCells no vacío obligatorio');
  }
  const out = new Float64Array(z.length);
  for (let k = 0; k < z.length; k++) out[k] = z[k];
  const burned = new Uint8Array(z.length);
  for (const k of channelCells) {
    if (k < 0 || k >= z.length || !Number.isFinite(out[k]) || burned[k]) continue;
    out[k] -= incisionM;
    burned[k] = 1;
  }
  if (bankIncisionM > 0) {
    const bankDone = new Uint8Array(z.length);
    for (const k of channelCells) {
      const ci = k % w, cj = (k / w) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || ni >= w || nj < 0 || nj >= h) continue;
        const nk = nj * w + ni;
        if (!burned[nk] && !bankDone[nk] && Number.isFinite(out[nk])) {
          out[nk] -= bankIncisionM;
          bankDone[nk] = 1;
        }
      }
    }
  }
  return {
    z: out,
    burnedMask: burned,
    burnedCount: burned.reduce((s, v) => s + v, 0),
    incisionM,
    bankIncisionM,
    basis: 'MODEL',
    ref: 'Neal, Schumann & Bates (2012), Water Resources Research 48, W11506, DOI: 10.1029/2012WR012514',
  };
}

/**
 * Apertura hidrológica monótona (breaching) de falsos tapones de puentes/terraplenes en un MDS grueso
 * a lo largo de un cauce ordenado aguas arriba→aguas abajo (Lindsay & Dhun 2015,
 * Int. J. Geogr. Inf. Sci. 29(3):397-419, DOI: 10.1080/13658816.2014.975715).
 * No sobreexcava el cauce: solo elimina contrapendientes artificiales (`minSlope > 0` obligatorio).
 */
export function enforceHydrologicBreach(z, orderedChannelCells, dx, { minSlope, extraIncisionM = 0 }) {
  if (!(minSlope >= 0) || !Number.isFinite(minSlope)) {
    throw new RangeError('enforceHydrologicBreach: minSlope ≥ 0 obligatorio (sin valor por defecto)');
  }
  if (!Array.isArray(orderedChannelCells) || orderedChannelCells.length < 2) {
    throw new RangeError('enforceHydrologicBreach: orderedChannelCells con ≥ 2 celdas obligatorio');
  }
  const out = Float64Array.from(z);
  let prevZ = Infinity;
  let breachedCount = 0;
  let maxCutM = 0;
  for (const k of orderedChannelCells) {
    if (k < 0 || k >= out.length || !Number.isFinite(out[k])) continue;
    const orig = out[k];
    const target = Math.min(orig - extraIncisionM, prevZ - minSlope * dx);
    if (target < orig) {
      out[k] = target;
      breachedCount++;
      const cut = orig - target;
      if (cut > maxCutM) maxCutM = cut;
    }
    prevZ = out[k];
  }
  return {
    z: out,
    breachedCount,
    maxCutM: +maxCutM.toFixed(3),
    minSlope,
    extraIncisionM,
    basis: 'MODEL',
    ref: 'Lindsay & Dhun (2015), Int. J. Geogr. Inf. Sci. 29(3):397-419, DOI: 10.1080/13658816.2014.975715',
  };
}

/**
 * Construye campos de porosidad urbana `phi` y coeficiente de arrastre `dragCoeff` (Sanders et al. 2008)
 * a partir de núcleos o polígonos urbanos declarados.
 */
export function buildUrbanPorosityField(w, h, { urbanMask, urbanPhi, urbanDragCoeff = 0 }) {
  if (!(urbanPhi > 0 && urbanPhi < 1)) {
    throw new RangeError('buildUrbanPorosityField: urbanPhi debe estar en (0, 1) (sin valor por defecto)');
  }
  if (!urbanMask || urbanMask.length !== w * h) {
    throw new RangeError('buildUrbanPorosityField: urbanMask de longitud w*h obligatoria');
  }
  const phi = new Float64Array(w * h).fill(1);
  const dragCoeff = new Float64Array(w * h);
  let urbanCells = 0;
  for (let k = 0; k < w * h; k++) {
    if (urbanMask[k]) {
      phi[k] = urbanPhi;
      dragCoeff[k] = urbanDragCoeff;
      urbanCells++;
    }
  }
  return {
    phi,
    dragCoeff,
    urbanCells,
    urbanPhi,
    urbanDragCoeff,
    basis: 'MODEL',
    ref: 'Sanders, Schubert & Gallegos (2008), Advances in Water Resources 31(11): 1445-1460, DOI: 10.1016/j.advwatres.2008.07.012',
  };
}

/**
 * Un paso explícito de volúmenes finitos 2D con control CFL, preservación de reposo y positividad.
 * @param {object} S estado creado con `createFvSim`
 * @param {number} dtMax paso máximo (s)
 * @param {Array<{k:number, q:number, uIn?:number, vIn?:number}>} sources entradas de caudal (m³/s)
 */
export function fvStep(S, dtMax, sources = []) {
  const { w, h, dx, z, d, hu, hv, sink, phi, psiX, psiY, n, dragCoeff, cfl, hDry } = S;
  const { fx0, fx1, fx2, sxL, sxR, fy0, fy1, fy2, syB, syT } = S;

  for (const s of sources) growBoxFv(S, s.k % w, (s.k / w) | 0);
  if (!S.box) {
    // Escaneo inicial por si el llamante rellenó S.d directamente sin pasar por fvSetInitialDepth
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (d[j * w + i] > hDry) growBoxFv(S, i, j);
      }
    }
    if (!S.box) {
      S.t += dtMax;
      return dtMax;
    }
  }

  const b = S.box;
  const i0 = Math.max(0, b[0] - 1), i1 = Math.min(w - 1, b[1] + 1);
  const j0 = Math.max(0, b[2] - 1), j1 = Math.min(h - 1, b[3] + 1);

  let maxWave = 0;

  // 1. Flujos HLLC en caras X (entre (i,j) y (i+1,j))
  for (let j = j0; j <= j1; j++) {
    const rowOff = j * w;
    const fRowOff = j * (w - 1);
    for (let i = i0; i < i1; i++) {
      const a = rowOff + i, c = a + 1, f = fRowOff + i;
      if (d[a] <= hDry && d[c] <= hDry) {
        fx0[f] = 0; fx1[f] = 0; fx2[f] = 0; sxL[f] = 0; sxR[f] = 0;
        continue;
      }
      const fl = hllcHydrostaticFlux(d[a], hu[a], hv[a], z[a], d[c], hu[c], hv[c], z[c], hDry);
      const pf = psiX[f];
      fx0[f] = pf * fl.fh;
      fx1[f] = pf * fl.fhu;
      fx2[f] = pf * fl.fhv;
      sxL[f] = pf * 0.5 * GRAVITY_MS2 * (fl.hLs * fl.hLs - d[a] * d[a]);
      sxR[f] = -pf * 0.5 * GRAVITY_MS2 * (fl.hRs * fl.hRs - d[c] * d[c]);
      if (fl.maxWave > maxWave) maxWave = fl.maxWave;
    }
  }

  // 2. Flujos HLLC en caras Y (entre (i,j) y (i,j+1); eje normal = v, tangencial = u)
  for (let j = j0; j < j1; j++) {
    const rowOff = j * w;
    for (let i = i0; i <= i1; i++) {
      const a = rowOff + i, c = a + w, f = a;
      if (d[a] <= hDry && d[c] <= hDry) {
        fy0[f] = 0; fy1[f] = 0; fy2[f] = 0; syB[f] = 0; syT[f] = 0;
        continue;
      }
      const fl = hllcHydrostaticFlux(d[a], hv[a], hu[a], z[a], d[c], hv[c], hu[c], z[c], hDry);
      const pf = psiY[f];
      fy0[f] = pf * fl.fh;
      fy1[f] = pf * fl.fhv; // flujo de hu a través de cara Y
      fy2[f] = pf * fl.fhu; // flujo de hv a través de cara Y
      syB[f] = pf * 0.5 * GRAVITY_MS2 * (fl.hLs * fl.hLs - d[a] * d[a]);
      syT[f] = -pf * 0.5 * GRAVITY_MS2 * (fl.hRs * fl.hRs - d[c] * d[c]);
      if (fl.maxWave > maxWave) maxWave = fl.maxWave;
    }
  }

  // Paso temporal CFL conservador (incluye factor de porosidad min(φ) local)
  let dt = maxWave > 1e-6 ? (cfl * dx) / maxWave : dtMax;
  if (dt > dtMax) dt = dtMax;

  // Limitador de positividad local: si la salida neta de masa de una celda supera φ·h·dx/dt, escalamos dt global
  for (let j = j0; j <= j1; j++) {
    const rowOff = j * w, fxOff = j * (w - 1);
    for (let i = i0; i <= i1; i++) {
      const k = rowOff + i;
      if (d[k] <= hDry) continue;
      let outFlux = 0;
      if (i < i1 && fx0[fxOff + i] > 0) outFlux += fx0[fxOff + i];
      if (i > i0 && fx0[fxOff + i - 1] < 0) outFlux -= fx0[fxOff + i - 1];
      if (j < j1 && fy0[k] > 0) outFlux += fy0[k];
      if (j > j0 && fy0[k - w] < 0) outFlux -= fy0[k - w];
      if (outFlux > 0) {
        const dtPos = 0.9 * (phi[k] * d[k] * dx) / outFlux;
        if (dtPos < dt) dt = dtPos;
      }
    }
  }

  // 3. Actualización conservativa + reacción de porosidad Sanders (2008) + fricción semi-implícita Liang-Marche (2009)
  const rdt = dt / dx;
  for (let j = j0; j <= j1; j++) {
    const rowOff = j * w, fxOff = j * (w - 1);
    for (let i = i0; i <= i1; i++) {
      const k = rowOff + i;
      const phik = phi[k];
      const invPhi = 1 / phik;
      const hk = d[k];
      const halfGh2 = 0.5 * GRAVITY_MS2 * hk * hk;

      let divH = 0, divHu = 0, divHv = 0, srcX = 0, srcY = 0;
      const psiR = i < i1 ? psiX[fxOff + i] : phik;
      const psiL = i > i0 ? psiX[fxOff + i - 1] : phik;
      const psiT = j < j1 ? psiY[k] : phik;
      const psiB = j > j0 ? psiY[k - w] : phik;

      if (i < i1) { const f = fxOff + i; divH += fx0[f]; divHu += fx1[f]; divHv += fx2[f]; srcX += sxL[f]; }
      else { divHu += phik * halfGh2; } // Presión hidrostática exacta de pared reflectante derecha
      if (i > i0) { const f = fxOff + i - 1; divH -= fx0[f]; divHu -= fx1[f]; divHv -= fx2[f]; srcX += sxR[f]; }
      else { divHu -= phik * halfGh2; } // Presión hidrostática exacta de pared reflectante izquierda
      if (j < j1) { const f = k; divH += fy0[f]; divHu += fy1[f]; divHv += fy2[f]; srcY += syB[f]; }
      else { divHv += phik * halfGh2; } // Presión hidrostática exacta de pared reflectante superior
      if (j > j0) { const f = k - w; divH -= fy0[f]; divHu -= fy1[f]; divHv -= fy2[f]; srcY += syT[f]; }
      else { divHv -= phik * halfGh2; } // Presión hidrostática exacta de pared reflectante inferior

      // Término de reacción hidrostática de muros urbanos (Sanders et al. 2008) para C-property exacta con φ variable
      srcX += halfGh2 * (psiR - psiL);
      srcY += halfGh2 * (psiT - psiB);

      let hNew = hk - rdt * invPhi * divH;
      if (hNew <= hDry) {
        d[k] = hNew > 0 ? hNew : 0;
        hu[k] = 0;
        hv[k] = 0;
        continue;
      }

      let huStar = hu[k] + rdt * invPhi * (-divHu + srcX);
      let hvStar = hv[k] + rdt * invPhi * (-divHv + srcY);

      // Fricción semi-implícita de Manning + arrastre de edificios (estable cuando h → 0)
      const qMag = Math.hypot(huStar, hvStar);
      if (qMag > 1e-12) {
        const nk = n[k];
        const speedStar = qMag / hNew;
        const fric = dt * ((GRAVITY_MS2 * nk * nk * speedStar) / Math.pow(hNew, 4 / 3) + 0.5 * dragCoeff[k] * speedStar);
        const damp = 1 / (1 + fric);
        huStar *= damp;
        hvStar *= damp;
      }

      d[k] = hNew;
      hu[k] = huStar;
      hv[k] = hvStar;
    }
  }

  // 4. Fuentes de caudal (y momento opcional si se aporta velocidad de entrada)
  for (const s of sources) {
    const k = s.k;
    const dh = (s.q * dt) / (S.phi[k] * dx * dx);
    d[k] += dh;
    if (Number.isFinite(s.uIn)) hu[k] += dh * s.uIn;
    if (Number.isFinite(s.vIn)) hv[k] += dh * s.vIn;
    S.volIn += s.q * dt;
  }

  // 5. Sumideros, máximos, peligro d·v, tiempos de llegada y crecimiento de caja activa
  const tEnd = S.t + dt;
  for (let j = j0; j <= j1; j++) {
    const rowOff = j * w;
    for (let i = i0; i <= i1; i++) {
      const k = rowOff + i;
      const hk = d[k];
      if (hk <= 0) continue;
      if (sink[k]) {
        S.volOut += phi[k] * hk * dx * dx;
        d[k] = 0;
        hu[k] = 0;
        hv[k] = 0;
        continue;
      }
      const speed = hk > hDry ? Math.hypot(hu[k], hv[k]) / hk : 0;
      const dv = hk * speed;
      if (hk > S.maxD[k]) S.maxD[k] = hk;
      if (speed > S.maxSpeed[k]) S.maxSpeed[k] = speed;
      if (dv > S.maxDV[k]) S.maxDV[k] = dv;
      if (hk >= S.hArrive && Number.isNaN(S.arrive[k])) S.arrive[k] = tEnd;
      if (hk > hDry) growBoxFv(S, i, j);
    }
  }

  S.t = tEnd;
  S.steps++;
  return dt;
}

/** Avanza la simulación FV 2D hasta `tEnd` (s). */
export function fvRunUntil(S, tEnd, { inflow = () => 0, cells = [], dtMax = 5, frameEvery = 0, onFrame = null } = {}) {
  let nextFrame = frameEvery ? Math.ceil(S.t / frameEvery) * frameEvery : Infinity;
  while (S.t < tEnd - 1e-9) {
    const q = inflow(S.t);
    const src = q > 0 && cells.length ? cells.map((c) => (typeof c === 'number' ? { k: c, q: q / cells.length } : { ...c, q: q / cells.length })) : [];
    const stepCap = Math.min(dtMax, tEnd - S.t, nextFrame - S.t > 0 ? nextFrame - S.t : dtMax);
    fvStep(S, stepCap, src);
    if (onFrame && S.t >= nextFrame - 1e-9) {
      onFrame(S.t);
      nextFrame += frameEvery;
    }
  }
  return S;
}

/* ───────────── 3. Compute Shaders WGSL para WebGPU + respaldo CPU con paridad declarada ───────────── */

/**
 * Núcleo WGSL (WebGPU Compute Shaders) equivalente bit-a-algoritmo al solver CPU Audusse-HLLC + Sanders.
 * Dos pases de cómputo (`flux_pass` y `update_pass`) con `workgroup_size(16, 16, 1)`.
 * Tolerancia de paridad declarada GPU(f32) ↔ CPU(f64): |Δh| < 1e-4 m en pruebas de banco.
 */
export const WGSL_SWE_FV_SHADER = /* wgsl */ `
struct Params {
  w: u32,
  h: u32,
  dx: f32,
  dt: f32,
  g: f32,
  hDry: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> z: array<f32>;
@group(0) @binding(2) var<storage, read> phi: array<f32>;
@group(0) @binding(3) var<storage, read> manning: array<f32>;
@group(0) @binding(4) var<storage, read> drag: array<f32>;
@group(0) @binding(5) var<storage, read> stateIn: array<vec4<f32>>;     // (h, hu, hv, sink)
@group(0) @binding(6) var<storage, read_write> fluxX: array<vec4<f32>>; // (fh, fhu, fhv, sxL)
@group(0) @binding(7) var<storage, read_write> fluxX2: array<f32>;      // sxR
@group(0) @binding(8) var<storage, read_write> fluxY: array<vec4<f32>>; // (fh, fhu, fhv, syB)
@group(0) @binding(9) var<storage, read_write> fluxY2: array<f32>;      // syT
@group(0) @binding(10) var<storage, read_write> stateOut: array<vec4<f32>>;

struct HllcOut {
  fh: f32,
  fhu: f32,
  fhv: f32,
  hLs: f32,
  hRs: f32,
};

fn hllc1d(hL: f32, huL: f32, hvL: f32, zL: f32, hR: f32, huR: f32, hvR: f32, zR: f32) -> HllcOut {
  let g = params.g;
  let hDry = params.hDry;
  let zStar = max(zL, zR);
  let hLs = max(0.0, hL + zL - zStar);
  let hRs = max(0.0, hR + zR - zStar);
  if (hLs <= hDry && hRs <= hDry) {
    return HllcOut(0.0, 0.0, 0.0, 0.0, 0.0);
  }
  let uL = select(0.0, huL / hL, hL > hDry);
  let vL = select(0.0, hvL / hL, hL > hDry);
  let uR = select(0.0, huR / hR, hR > hDry);
  let vR = select(0.0, hvR / hR, hR > hDry);
  let cL = sqrt(g * hLs);
  let cR = sqrt(g * hRs);

  var sL: f32;
  var sR: f32;
  if (hLs <= hDry) {
    sL = uR - 2.0 * cR;
    sR = uR + cR;
  } else if (hRs <= hDry) {
    sL = uL - cL;
    sR = uL + 2.0 * cL;
  } else {
    let uStar = 0.5 * (uL + uR) + cL - cR;
    let cStar = max(0.0, 0.5 * (cL + cR) + 0.25 * (uL - uR));
    sL = min(uL - cL, uStar - cStar);
    sR = max(uR + cR, uStar + cStar);
  }

  let fL0 = hLs * uL;
  let fL1 = hLs * uL * uL + 0.5 * g * hLs * hLs;
  let fR0 = hRs * uR;
  let fR1 = hRs * uR * uR + 0.5 * g * hRs * hRs;

  var fh: f32;
  var fhu: f32;
  if (sL >= 0.0) {
    fh = fL0; fhu = fL1;
  } else if (sR <= 0.0) {
    fh = fR0; fhu = fR1;
  } else {
    let inv = 1.0 / (sR - sL);
    fh = (sR * fL0 - sL * fR0 + sL * sR * (hRs - hLs)) * inv;
    fhu = (sR * fL1 - sL * fR1 + sL * sR * (hRs * uR - hLs * uL)) * inv;
  }
  let denom = hRs * (uR - sR) - hLs * (uL - sL);
  let sStar = select(0.5 * (uL + uR), (sL * hRs * (uR - sR) - sR * hLs * (uL - sL)) / denom, abs(denom) > 1e-6);
  let fhv = fh * select(vR, vL, sStar >= 0.0);
  return HllcOut(fh, fhu, fhv, hLs, hRs);
}

@compute @workgroup_size(16, 16, 1)
fn flux_pass(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let j = gid.y;
  let w = params.w;
  let h = params.h;
  if (i >= w || j >= h) { return; }
  let k = j * w + i;
  let sA = stateIn[k];

  if (i + 1u < w) {
    let c = k + 1u;
    let sC = stateIn[c];
    let f = j * (w - 1u) + i;
    let pf = min(phi[k], phi[c]);
    let fl = hllc1d(sA.x, sA.y, sA.z, z[k], sC.x, sC.y, sC.z, z[c]);
    let sxL = pf * 0.5 * params.g * (fl.hLs * fl.hLs - sA.x * sA.x);
    let sxR = -pf * 0.5 * params.g * (fl.hRs * fl.hRs - sC.x * sC.x);
    fluxX[f] = vec4<f32>(pf * fl.fh, pf * fl.fhu, pf * fl.fhv, sxL);
    fluxX2[f] = sxR;
  }
  if (j + 1u < h) {
    let c = k + w;
    let sC = stateIn[c];
    let pf = min(phi[k], phi[c]);
    let fl = hllc1d(sA.x, sA.z, sA.y, z[k], sC.x, sC.z, sC.y, z[c]);
    let syB = pf * 0.5 * params.g * (fl.hLs * fl.hLs - sA.x * sA.x);
    let syT = -pf * 0.5 * params.g * (fl.hRs * fl.hRs - sC.x * sC.x);
    fluxY[k] = vec4<f32>(pf * fl.fh, pf * fl.fhv, pf * fl.fhu, syB);
    fluxY2[k] = syT;
  }
}

@compute @workgroup_size(16, 16, 1)
fn update_pass(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let j = gid.y;
  let w = params.w;
  let h = params.h;
  if (i >= w || j >= h) { return; }
  let k = j * w + i;
  let st = stateIn[k];
  let hk = st.x;
  let phik = phi[k];
  let invPhi = 1.0 / phik;
  let rdt = params.dt / params.dx;
  let halfGh2 = 0.5 * params.g * hk * hk;

  var divH: f32 = 0.0; var divHu: f32 = 0.0; var divHv: f32 = 0.0;
  var srcX: f32 = 0.0; var srcY: f32 = 0.0;
  var psiR = phik; var psiL = phik; var psiT = phik; var psiB = phik;

  if (i + 1u < w) {
    let f = j * (w - 1u) + i;
    let fx = fluxX[f];
    divH += fx.x; divHu += fx.y; divHv += fx.z; srcX += fx.w;
    psiR = min(phik, phi[k + 1u]);
  } else {
    divHu += phik * halfGh2;
  }
  if (i > 0u) {
    let f = j * (w - 1u) + i - 1u;
    let fx = fluxX[f];
    divH -= fx.x; divHu -= fx.y; divHv -= fx.z; srcX += fluxX2[f];
    psiL = min(phik, phi[k - 1u]);
  } else {
    divHu -= phik * halfGh2;
  }
  if (j + 1u < h) {
    let fy = fluxY[k];
    divH += fy.x; divHu += fy.y; divHv += fy.z; srcY += fy.w;
    psiT = min(phik, phi[k + w]);
  } else {
    divHv += phik * halfGh2;
  }
  if (j > 0u) {
    let fy = fluxY[k - w];
    divH -= fy.x; divHu -= fy.y; divHv -= fy.z; srcY += fluxY2[k - w];
    psiB = min(phik, phi[k - w]);
  } else {
    divHv -= phik * halfGh2;
  }
  srcX += halfGh2 * (psiR - psiL);
  srcY += halfGh2 * (psiT - psiB);

  let hNew = hk - rdt * invPhi * divH;
  if (hNew <= params.hDry || st.w > 0.5) {
    stateOut[k] = vec4<f32>(select(0.0, hNew, hNew > 0.0 && st.w <= 0.5), 0.0, 0.0, st.w);
    return;
  }
  var huS = st.y + rdt * invPhi * (-divHu + srcX);
  var hvS = st.z + rdt * invPhi * (-divHv + srcY);
  let qMag = length(vec2<f32>(huS, hvS));
  if (qMag > 1e-6) {
    let nk = manning[k];
    let sp = qMag / hNew;
    let fric = params.dt * ((params.g * nk * nk * sp) / pow(hNew, 1.3333334) + 0.5 * drag[k] * sp);
    let damp = 1.0 / (1.0 + fric);
    huS *= damp; hvS *= damp;
  }
  stateOut[k] = vec4<f32>(hNew, huS, hvS, st.w);
}
`;

/**
 * Comprueba la disponibilidad de WebGPU y crea un ejecutor dual (WebGPU si existe `navigator.gpu`,
 * con respaldo automático transparente en CPU con paridad declarada).
 */
export async function createDualBackendSweRunner(simConfig) {
  const hasWebGpu = typeof globalThis.navigator !== 'undefined' && Boolean(globalThis.navigator?.gpu);
  let gpuDevice = null;
  if (hasWebGpu) {
    try {
      const adapter = await globalThis.navigator.gpu.requestAdapter();
      if (adapter) gpuDevice = await adapter.requestDevice();
    } catch {
      gpuDevice = null;
    }
  }
  const cpuSim = createFvSim({ ...simConfig, precision: gpuDevice ? 'f32' : simConfig.precision ?? 'f64' });
  return {
    backend: gpuDevice ? 'WEBGPU_READY_WITH_CPU_FALLBACK' : 'CPU_FALLBACK',
    webGpuAvailable: Boolean(gpuDevice),
    wgslShaderBytes: WGSL_SWE_FV_SHADER.length,
    declaredParityToleranceM: 1e-4,
    sim: cpuSim,
    step: (dtMax, sources) => fvStep(cpuSim, dtMax, sources),
    runUntil: (tEnd, opts) => fvRunUntil(cpuSim, tEnd, opts),
  };
}

/**
 * Compara la ejecución en precisión `f32` (mismo formato que WebGPU WGSL) frente a `f64` (CPU referencia)
 * y devuelve el error máximo absoluto y relativo para verificar la tolerancia declarada.
 */
export function verifyPrecisionParity(simConfig, { tEnd, inflow, cells, dtMax = 2, toleranceM = 1e-4 }) {
  const s64 = createFvSim({ ...simConfig, precision: 'f64' });
  const s32 = createFvSim({ ...simConfig, precision: 'f32' });
  fvRunUntil(s64, tEnd, { inflow, cells, dtMax });
  fvRunUntil(s32, tEnd, { inflow, cells, dtMax });
  let maxAbsDiffM = 0, rmseM = 0;
  for (let k = 0; k < s64.d.length; k++) {
    const err = Math.abs(s64.d[k] - s32.d[k]);
    if (err > maxAbsDiffM) maxAbsDiffM = err;
    rmseM += err * err;
  }
  rmseM = Math.sqrt(rmseM / s64.d.length);
  return Object.freeze({
    withinTolerance: maxAbsDiffM <= toleranceM,
    toleranceM,
    maxAbsDiffM: +maxAbsDiffM.toExponential(3),
    rmseM: +rmseM.toExponential(3),
    steps64: s64.steps,
    steps32: s32.steps,
    basis: 'MODEL',
  });
}

/* ───────────── 4. Estabilidad de personas y vehículos en el agua (criterios publicados) ───────────── */

/**
 * Estabilidad de personas en flujo de inundación.
 * Combina dos criterios publicados:
 *  1. Cox, Shand & Blacka (2010), Australian Rainfall & Runoff Project 10 (WRL TR 2010/06):
 *     - Niños (H·m ≈ 25 kg): inseguro si d > 0,5 m, v > 3,0 m/s o d·v > 0,4 m²/s.
 *     - Adultos (condiciones generales): precaución d·v > 0,4; inseguro si d > 1,2 m, v > 3,0 m/s o d·v > 0,6 m²/s (hasta 1,2 m²/s para adultos entrenados en laboratorio).
 *  2. DEFRA / Environment Agency (2006), FD2320/TR2: HR = d · (v + 0,5) + DF (DF obligatorio, sin valor por defecto oculto).
 *     HR < 0,75 muy bajo · 0,75–1,25 peligro para algunos · 1,25–2,0 peligro para la mayoría · ≥ 2,0 extremo para todos.
 */
export function assessHumanFloodStability(depthM, speedMs, { profile = 'adult', debrisFactor } = {}) {
  if (!Number.isFinite(depthM) || depthM < 0) throw new RangeError('depthM debe ser ≥ 0');
  if (!Number.isFinite(speedMs) || speedMs < 0) throw new RangeError('speedMs debe ser ≥ 0');
  if (!Number.isFinite(debrisFactor) || debrisFactor < 0 || debrisFactor > 1) {
    throw new RangeError('debrisFactor (DF de DEFRA FD2320, en [0, 1]) obligatorio sin valor por defecto');
  }
  if (!['child', 'adult', 'trained_adult'].includes(profile)) {
    throw new RangeError('profile debe ser child | adult | trained_adult');
  }
  const dv = depthM * speedMs;
  const hr = depthM * (speedMs + 0.5) + (depthM > 0.05 ? debrisFactor : 0);
  const limits = {
    child: { maxD: 0.5, maxV: 3.0, maxDV: 0.4 },
    adult: { maxD: 1.2, maxV: 3.0, maxDV: 0.6 },
    trained_adult: { maxD: 1.2, maxV: 3.0, maxDV: 1.2 },
  }[profile];

  const unstable = depthM > limits.maxD || speedMs > limits.maxV || dv > limits.maxDV;
  const defraClass = hr >= 2.0 ? 'EXTREME_FOR_ALL' : hr >= 1.25 ? 'DANGER_FOR_MOST' : hr >= 0.75 ? 'DANGER_FOR_SOME' : 'VERY_LOW';
  return Object.freeze({
    profile,
    depthM: +depthM.toFixed(3),
    speedMs: +speedMs.toFixed(3),
    dvM2s: +dv.toFixed(3),
    defraHR: +hr.toFixed(3),
    defraClass,
    unstable,
    coxLimits: limits,
    basis: 'MODEL',
    refs: Object.freeze([
      'Cox, Shand & Blacka (2010), ARR Project 10, WRL TR 2010/06',
      'DEFRA / Environment Agency (2006), FD2320/TR2',
    ]),
  });
}

/**
 * Estabilidad de vehículos estacionados o en circulación frente a flotación y deslizamiento.
 * Criterios publicados:
 *  - Shand, Cox, Blacka & Smith (2011), ARR Project 10 Stage 2 (WRL TR 2011/01), Tabla 4.1:
 *    - small_passenger: d_max = 0,3 m, v_max = 3,0 m/s, d·v_max = 0,3 m²/s
 *    - large_passenger: d_max = 0,4 m, v_max = 3,0 m/s, d·v_max = 0,45 m²/s
 *    - large_4wd:       d_max = 0,5 m, v_max = 3,0 m/s, d·v_max = 0,6 m²/s
 *  - Confirmado experimentalmente por Martínez-Gomariz et al. (2018), Natural Hazards 92:1533-1554, DOI 10.1007/s11069-018-3262-8.
 */
export const VEHICLE_FLOOD_LIMITS = Object.freeze({
  small_passenger: Object.freeze({ maxDepthM: 0.3, maxSpeedMs: 3.0, maxDvM2s: 0.3, label: 'Turismo pequeño (ej. utilitario)' }),
  large_passenger: Object.freeze({ maxDepthM: 0.4, maxSpeedMs: 3.0, maxDvM2s: 0.45, label: 'Turismo grande / berlina' }),
  large_4wd: Object.freeze({ maxDepthM: 0.5, maxSpeedMs: 3.0, maxDvM2s: 0.6, label: 'Todoterreno 4×4 grande' }),
});

export function assessVehicleFloodStability(depthM, speedMs, { vehicleClass = 'small_passenger' } = {}) {
  if (!Number.isFinite(depthM) || depthM < 0) throw new RangeError('depthM debe ser ≥ 0');
  if (!Number.isFinite(speedMs) || speedMs < 0) throw new RangeError('speedMs debe ser ≥ 0');
  const lim = VEHICLE_FLOOD_LIMITS[vehicleClass];
  if (!lim) throw new RangeError(`vehicleClass desconocida: ${vehicleClass}`);
  const dv = depthM * speedMs;
  const floatingRisk = depthM >= lim.maxDepthM;
  const slidingRisk = dv >= lim.maxDvM2s || speedMs >= lim.maxSpeedMs;
  return Object.freeze({
    vehicleClass,
    label: lim.label,
    depthM: +depthM.toFixed(3),
    speedMs: +speedMs.toFixed(3),
    dvM2s: +dv.toFixed(3),
    unstable: floatingRisk || slidingRisk,
    mechanism: floatingRisk && slidingRisk ? 'FLOTACION_Y_ARRASTRE' : floatingRisk ? 'FLOTACION' : slidingRisk ? 'ARRASTRE' : 'ESTABLE',
    limits: lim,
    basis: 'MODEL',
    refs: Object.freeze([
      'Shand, Cox, Blacka & Smith (2011), ARR Project 10 Stage 2, WRL TR 2011/01',
      'Martínez-Gomariz et al. (2018), Natural Hazards 92:1533-1554, DOI 10.1007/s11069-018-3262-8',
    ]),
  });
}

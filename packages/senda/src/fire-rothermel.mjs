// @ts-check
/**
 * SENDA · Motor de propagación de incendios forestales: Rothermel (1972) + Scott & Burgan (2005)
 * + frente 2D Level-Set / Huygens elíptico (Finney 1998 / Osher & Sethian 1988) + conjunto probabilista.
 *
 * Referencias publicadas:
 *  - Modelo físico de velocidad de propagación superficial:
 *    Rothermel, R. C. (1972). «A mathematical model for predicting fire spread in wildland fuels».
 *    USDA Forest Service Research Paper INT-115.
 *  - Correcciones de carga dinámica y ponderación de clases:
 *    Albini, F. A. (1976). «Estimating wildfire behavior and effects». USDA Forest Service GTR INT-30;
 *    Andrews, P. L. (2018). «The Rothermel surface fire spread model and associated developments:
 *    A comprehensive explanation». USDA Forest Service RMRS-GTR-371. DOI: 10.2737/RMRS-GTR-371.
 *  - Modelos estándar de combustible (40 modelos, subconjunto representativo mediterráneo/ibérico):
 *    Scott, J. H. & Burgan, R. E. (2005). «Standard fire behavior fuel models: a comprehensive set for use
 *    with Rothermel's surface fire spread model». USDA Forest Service RMRS-GTR-153. DOI: 10.2737/RMRS-GTR-153.
 *  - Longitud de llama e intensidad de línea de fuego:
 *    Byram, G. M. (1959). «Combustion of forest fuels». En: Forest Fire: Control and Use (K. P. Davis, ed.), McGraw-Hill.
 *  - Relación longitud/anchura de elipse y frente de Huygens:
 *    Anderson, H. E. (1983). «Predicting wind-driven wild land fire size and shape». USDA FS INT-305;
 *    Richards, G. D. (1990). Int. J. Numer. Meth. Eng. 30:1163-1179. DOI: 10.1002/nme.1620300606;
 *    Finney, M. A. (1998). «FARSITE: Fire Area Simulator». USDA FS RMRS-RP-4. DOI: 10.2737/RMRS-RP-4.
 *  - Método Level-Set para frentes en propagación:
 *    Osher, S. & Sethian, J. A. (1988). J. Comput. Phys. 79(1):12-49. DOI: 10.1016/0021-9991(88)90002-2.
 *
 * Regla de veracidad (CLAUDE.md): humedad del combustible, viento a media llama y pendiente son OBLIGATORIOS
 * (sin valores por defecto ocultos). Toda salida declara `basis: 'MODEL'`.
 */

import { slopeAspect } from './fire-science.mjs';

const DEG = Math.PI / 180;
const LB_FT2_PER_TON_AC = 2000 / 43560; // 0.04591368 lb/ft² por short ton/acre
const FT_MIN_TO_MS = 0.3048 / 60;       // 0.00508 m/s por ft/min
const MS_TO_FT_MIN = 1 / FT_MIN_TO_MS;
const BTU_FT_S_TO_KWM = 3.4613;         // 1 BTU/(ft·s) ≈ 3.4613 kW/m
const BTU_FT2_MIN_TO_KWM2 = 0.18928;    // 1 BTU/(ft²·min) ≈ 0.18928 kW/m²

// Constantes universales de Rothermel (1972) INT-115
const RHO_P = 32.0;        // densidad de partícula (lb/ft³)
const S_T = 0.0555;        // contenido mineral total (fracción)
const S_E = 0.010;         // contenido mineral efectivo libre de sílice (fracción)
const ETA_S = Math.min(1, 0.174 * Math.pow(S_E, -0.19)); // coeficiente de amortiguación mineral ≈ 0.41739

/* ───────────── 1. Catálogo publicado de modelos de combustible Scott & Burgan (2005, RMRS-GTR-153) ───────────── */

/**
 * Parámetros literales de la Tabla de Scott & Burgan (2005, RMRS-GTR-153, p. 12–66).
 * Unidades publicadas por el USDA FS para reproducibilidad directa con Rothermel (1972):
 *  - cargas `w1h, w10h, w100h, wHerb, wWood`: short tons/acre
 *  - SAV `sav1h, savHerb, savWood`: ft⁻¹ (clases 10h = 109 ft⁻¹, 100h = 30 ft⁻¹)
 *  - `depthFt`: profundidad del lecho (ft)
 *  - `mx`: humedad de extinción del combustible muerto (fracción)
 *  - `heatBtuLb`: poder calorífico bajo (BTU/lb, 8000 en S&B 2005 salvo excepción)
 *  - `dynamic`: transferencia de carga viva herbácea a 1h muerta según curado (Albini 1976 / S&B 2005)
 */
export const SCOTT_BURGAN_MODELS = Object.freeze({
  NB1: Object.freeze({ code: 'NB1', name: 'No combustible · urbano/carretera', burnable: false }),
  NB8: Object.freeze({ code: 'NB8', name: 'No combustible · agua abierta', burnable: false }),
  NB9: Object.freeze({ code: 'NB9', name: 'No combustible · suelo desnudo/roca', burnable: false }),
  GR1: Object.freeze({ code: 'GR1', name: 'Pasto corto y ralo', burnable: true, dynamic: true, w1h: 0.10, w10h: 0.00, w100h: 0.00, wHerb: 0.30, wWood: 0.00, sav1h: 2200, savHerb: 2000, savWood: 1500, depthFt: 0.4, mx: 0.15, heatBtuLb: 8000 }),
  GR2: Object.freeze({ code: 'GR2', name: 'Pasto seco de carga moderada', burnable: true, dynamic: true, w1h: 0.10, w10h: 0.00, w100h: 0.00, wHerb: 1.00, wWood: 0.00, sav1h: 2000, savHerb: 1800, savWood: 1500, depthFt: 1.0, mx: 0.15, heatBtuLb: 8000 }),
  GR4: Object.freeze({ code: 'GR4', name: 'Pasto alto y denso seco', burnable: true, dynamic: true, w1h: 0.25, w10h: 0.00, w100h: 0.00, wHerb: 1.90, wWood: 0.00, sav1h: 2000, savHerb: 1800, savWood: 1500, depthFt: 2.0, mx: 0.15, heatBtuLb: 8000 }),
  GR7: Object.freeze({ code: 'GR7', name: 'Pasto muy alto de carga elevada', burnable: true, dynamic: true, w1h: 1.00, w10h: 0.00, w100h: 0.00, wHerb: 5.40, wWood: 0.00, sav1h: 2000, savHerb: 1800, savWood: 1500, depthFt: 3.0, mx: 0.15, heatBtuLb: 8000 }),
  GS1: Object.freeze({ code: 'GS1', name: 'Pasto y matorral bajo seco', burnable: true, dynamic: true, w1h: 0.20, w10h: 0.00, w100h: 0.00, wHerb: 0.50, wWood: 0.65, sav1h: 2000, savHerb: 1800, savWood: 1800, depthFt: 0.9, mx: 0.15, heatBtuLb: 8000 }),
  GS2: Object.freeze({ code: 'GS2', name: 'Pasto y matorral moderado (mediterráneo)', burnable: true, dynamic: true, w1h: 0.50, w10h: 0.50, w100h: 0.00, wHerb: 0.60, wWood: 1.00, sav1h: 2000, savHerb: 1800, savWood: 1800, depthFt: 1.5, mx: 0.15, heatBtuLb: 8000 }),
  SH1: Object.freeze({ code: 'SH1', name: 'Matorral bajo seco', burnable: true, dynamic: true, w1h: 0.25, w10h: 0.25, w100h: 0.00, wHerb: 0.15, wWood: 1.30, sav1h: 2000, savHerb: 1800, savWood: 1600, depthFt: 1.0, mx: 0.15, heatBtuLb: 8000 }),
  SH2: Object.freeze({ code: 'SH2', name: 'Matorral moderado (jara/romero)', burnable: true, dynamic: false, w1h: 1.35, w10h: 2.40, w100h: 0.75, wHerb: 0.00, wWood: 3.85, sav1h: 2000, savHerb: 1800, savWood: 1600, depthFt: 1.0, mx: 0.15, heatBtuLb: 8000 }),
  SH5: Object.freeze({ code: 'SH5', name: 'Matorral alto y denso seco (maquia)', burnable: true, dynamic: false, w1h: 3.60, w10h: 2.10, w100h: 0.00, wHerb: 0.00, wWood: 2.90, sav1h: 750, savHerb: 1800, savWood: 1600, depthFt: 6.0, mx: 0.15, heatBtuLb: 8000 }),
  SH7: Object.freeze({ code: 'SH7', name: 'Matorral muy alto de carga muy elevada', burnable: true, dynamic: false, w1h: 3.50, w10h: 5.30, w100h: 2.20, wHerb: 0.00, wWood: 3.40, sav1h: 750, savHerb: 1800, savWood: 1600, depthFt: 6.0, mx: 0.15, heatBtuLb: 8000 }),
  TU1: Object.freeze({ code: 'TU1', name: 'Arbolado con sotobosque bajo de pasto/matorral', burnable: true, dynamic: true, w1h: 0.20, w10h: 0.90, w100h: 1.50, wHerb: 0.20, wWood: 0.90, sav1h: 2000, savHerb: 1800, savWood: 1600, depthFt: 0.6, mx: 0.20, heatBtuLb: 8000 }),
  TU2: Object.freeze({ code: 'TU2', name: 'Pinar con sotobosque moderado', burnable: true, dynamic: false, w1h: 0.95, w10h: 1.80, w100h: 1.25, wHerb: 0.00, wWood: 0.20, sav1h: 2000, savHerb: 1800, savWood: 1600, depthFt: 1.0, mx: 0.30, heatBtuLb: 8000 }),
  TU5: Object.freeze({ code: 'TU5', name: 'Bosque denso con sotobosque muy cargado', burnable: true, dynamic: false, w1h: 4.00, w10h: 4.00, w100h: 3.00, wHerb: 0.00, wWood: 3.00, sav1h: 1500, savHerb: 1800, savWood: 750, depthFt: 1.0, mx: 0.25, heatBtuLb: 8000 }),
  TL1: Object.freeze({ code: 'TL1', name: 'Hojarasca compacta de coníferas', burnable: true, dynamic: false, w1h: 1.00, w10h: 2.20, w100h: 3.60, wHerb: 0.00, wWood: 0.00, sav1h: 2000, savHerb: 1800, savWood: 1600, depthFt: 0.2, mx: 0.30, heatBtuLb: 8000 }),
  TL3: Object.freeze({ code: 'TL3', name: 'Hojarasca moderada de coníferas', burnable: true, dynamic: false, w1h: 0.50, w10h: 2.20, w100h: 2.80, wHerb: 0.00, wWood: 0.00, sav1h: 2000, savHerb: 1800, savWood: 1600, depthFt: 0.3, mx: 0.20, heatBtuLb: 8000 }),
  TL8: Object.freeze({ code: 'TL8', name: 'Pinocha de acícula larga (Pinus pinaster/pinea)', burnable: true, dynamic: false, w1h: 5.80, w10h: 1.40, w100h: 1.10, wHerb: 0.00, wWood: 0.00, sav1h: 1800, savHerb: 1800, savWood: 1600, depthFt: 0.3, mx: 0.35, heatBtuLb: 8000 }),
  TL9: Object.freeze({ code: 'TL9', name: 'Hojarasca de frondosas de carga alta', burnable: true, dynamic: false, w1h: 6.65, w10h: 3.30, w100h: 4.15, wHerb: 0.00, wWood: 0.00, sav1h: 1800, savHerb: 1800, savWood: 1600, depthFt: 0.6, mx: 0.35, heatBtuLb: 8000 }),
  SB1: Object.freeze({ code: 'SB1', name: 'Restos de corta ligeros', burnable: true, dynamic: false, w1h: 1.50, w10h: 3.00, w100h: 11.00, wHerb: 0.00, wWood: 0.00, sav1h: 2000, savHerb: 1800, savWood: 1600, depthFt: 1.0, mx: 0.25, heatBtuLb: 8000 }),
  SB2: Object.freeze({ code: 'SB2', name: 'Restos de corta moderados', burnable: true, dynamic: false, w1h: 4.50, w10h: 4.25, w100h: 4.00, wHerb: 0.00, wWood: 0.00, sav1h: 2000, savHerb: 1800, savWood: 1600, depthFt: 1.0, mx: 0.25, heatBtuLb: 8000 }),
});

/* ───────────── 2. Ecuaciones exactas de Rothermel (1972) + Byram (1959) ───────────── */

function reqNum(v, name) {
  if (!Number.isFinite(v)) throw new RangeError(`rothermelSpread: parámetro obligatorio '${name}' ausente o no finito`);
  return v;
}

/**
 * Calcula la velocidad de propagación superficial de Rothermel (1972) con corrección dinámica
 * de Scott & Burgan (2005) e intensidad/longitud de llama de Byram (1959).
 *
 * @param {string|object} fuelModel Código Scott & Burgan (ej. 'GR2', 'SH5', 'TL8') u objeto personalizado
 * @param {object} env Condiciones ambientales (OBLIGATORIAS, sin valores por defecto ocultos):
 *   - `dead1hMoisture`, `dead10hMoisture`, `dead100hMoisture`: fracción (ej. 0.06 = 6 %)
 *   - `liveHerbMoisture`, `liveWoodyMoisture`: fracción (ej. 0.60 = 60 %; 0.90 = 90 %)
 *   - `midflameWindMs`: viento a altura media de llama (m/s, ≥ 0)
 *   - `slopeDeg`: pendiente del terreno en dirección del avance (grados, ≥ 0)
 *   - `windSlopeAligned`: opcional (boolean, true por defecto si no se da vector; usar `rothermelDirectionalSpread` para 2D)
 */
export function rothermelSpread(fuelModel, env) {
  const fm = typeof fuelModel === 'string' ? SCOTT_BURGAN_MODELS[fuelModel] : fuelModel;
  if (!fm) throw new Error(`rothermelSpread: modelo de combustible desconocido '${fuelModel}'`);
  if (!env || typeof env !== 'object') throw new Error('rothermelSpread: objeto de entorno obligatorio');

  const m1 = reqNum(env.dead1hMoisture, 'dead1hMoisture');
  const m10 = reqNum(env.dead10hMoisture, 'dead10hMoisture');
  const m100 = reqNum(env.dead100hMoisture, 'dead100hMoisture');
  const mHerb = reqNum(env.liveHerbMoisture, 'liveHerbMoisture');
  const mWood = reqNum(env.liveWoodyMoisture, 'liveWoodyMoisture');
  const windMs = reqNum(env.midflameWindMs, 'midflameWindMs');
  const slopeDeg = reqNum(env.slopeDeg, 'slopeDeg');
  if (m1 < 0 || m10 < 0 || m100 < 0 || mHerb < 0 || mWood < 0) throw new RangeError('humedades deben ser ≥ 0');
  if (windMs < 0) throw new RangeError('midflameWindMs debe ser ≥ 0');
  if (slopeDeg < 0 || slopeDeg >= 85) throw new RangeError('slopeDeg debe estar en [0, 85)');

  if (!fm.burnable) {
    return Object.freeze({
      fuelCode: fm.code ?? 'NB',
      burnable: false,
      rosMs: 0,
      rosMMin: 0,
      rosFtMin: 0,
      reactionIntensityKWm2: 0,
      byramIntensityKWm: 0,
      flameLengthM: 0,
      windFactorPhiW: 0,
      slopeFactorPhiS: 0,
      propagatingFluxRatio: 0,
      basis: 'MODEL',
    });
  }

  // Transferencia dinámica herbácea (Scott & Burgan 2005, RMRS-GTR-153, Ec. 1):
  // si M_herb <= 1.20, la fracción curada pasa a combustible muerto de 1 h
  let w1h = fm.w1h * LB_FT2_PER_TON_AC;
  const w10h = fm.w10h * LB_FT2_PER_TON_AC;
  const w100h = fm.w100h * LB_FT2_PER_TON_AC;
  let wHerb = fm.wHerb * LB_FT2_PER_TON_AC;
  const wWood = fm.wWood * LB_FT2_PER_TON_AC;
  let wCured = 0;

  if (fm.dynamic && wHerb > 0) {
    const curedFrac = mHerb <= 0.30 ? 1.0 : mHerb >= 1.20 ? 0.0 : (1.20 - mHerb) / 0.90;
    wCured = wHerb * curedFrac;
    wHerb -= wCured;
  }

  // Clases muertas (1h, herbáceo curado con savHerb, 10h, 100h) y vivas (herbáceo vivo, leñoso vivo)
  const dead = [
    { w: w1h, sav: fm.sav1h, m: m1 },
    { w: wCured, sav: fm.savHerb, m: m1 },
    { w: w10h, sav: 109, m: m10 },
    { w: w100h, sav: 30, m: m100 },
  ].filter((c) => c.w > 0);

  const live = [
    { w: wHerb, sav: fm.savHerb, m: mHerb },
    { w: wWood, sav: fm.savWood, m: mWood },
  ].filter((c) => c.w > 0);

  const area = (c) => (c.w * c.sav) / RHO_P;
  const aDead = dead.reduce((s, c) => s + area(c), 0);
  const aLive = live.reduce((s, c) => s + area(c), 0);
  const aTot = aDead + aLive;
  if (aTot <= 0) {
    return Object.freeze({ fuelCode: fm.code, burnable: false, rosMs: 0, rosMMin: 0, rosFtMin: 0, reactionIntensityKWm2: 0, byramIntensityKWm: 0, flameLengthM: 0, windFactorPhiW: 0, slopeFactorPhiS: 0, propagatingFluxRatio: 0, basis: 'MODEL' });
  }

  const fDead = aDead / aTot;
  const fLive = aLive / aTot;

  // SAV característico por categoría y global (Rothermel 1972, Ec. 53–55)
  const savDead = aDead > 0 ? dead.reduce((s, c) => s + (area(c) / aDead) * c.sav, 0) : 0;
  const savLive = aLive > 0 ? live.reduce((s, c) => s + (area(c) / aLive) * c.sav, 0) : 0;
  const sigma = fDead * savDead + fLive * savLive;

  // Humedad ponderada de cada categoría
  const mDead = aDead > 0 ? dead.reduce((s, c) => s + (area(c) / aDead) * c.m, 0) : 0;
  const mLive = aLive > 0 ? live.reduce((s, c) => s + (area(c) / aLive) * c.m, 0) : 0;

  // Carga neta libre de minerales (wn = w * (1 - S_T)) ponderada por categoría (Albini 1976 / Andrews 2018)
  const wnDead = aDead > 0
    ? dead.reduce((s, c) => s + (area(c) / aDead) * c.w * (1 - S_T), 0)
    : 0;
  const wnLive = aLive > 0
    ? live.reduce((s, c) => s + (area(c) / aLive) * c.w * (1 - S_T), 0)
    : 0;

  // Humedad de extinción del combustible vivo M_x,live (Albini 1976, INT-30)
  let mxLive = fm.mx;
  if (aLive > 0 && aDead > 0) {
    const deadW = dead.reduce((s, c) => s + c.w * Math.exp(-138 / c.sav), 0);
    const liveW = live.reduce((s, c) => s + c.w * Math.exp(-500 / c.sav), 0);
    const W = liveW > 0 ? deadW / liveW : 0;
    const mDeadFine = deadW > 0 ? dead.reduce((s, c) => s + c.w * c.m * Math.exp(-138 / c.sav), 0) / deadW : mDead;
    mxLive = Math.max(fm.mx, 2.9 * W * (1 - mDeadFine / fm.mx) - 0.226);
  }

  // Amortiguación por humedad η_M (Rothermel 1972, Ec. 29)
  const etaM = (m, mx) => {
    if (mx <= 0) return 0;
    const r = Math.min(1, Math.max(0, m / mx));
    return Math.max(0, 1 - 2.59 * r + 5.11 * r * r - 3.52 * r * r * r);
  };
  const etaMDead = aDead > 0 ? etaM(mDead, fm.mx) : 0;
  const etaMLive = aLive > 0 ? etaM(mLive, mxLive) : 0;

  // Densidad aparente ρ_b y relación de empaquetamiento β / β_op (Ec. 31, 37, 40)
  const totalW = dead.reduce((s, c) => s + c.w, 0) + live.reduce((s, c) => s + c.w, 0);
  const rhoB = totalW / fm.depthFt;
  const beta = rhoB / RHO_P;
  const betaOp = 3.348 * Math.pow(sigma, -0.8189);
  const betaRatio = beta / betaOp;

  // Velocidad de reacción óptima Γ' (Ec. 36, 38, 39)
  const A = 133 * Math.pow(sigma, -0.7913);
  const gammaMax = Math.pow(sigma, 1.5) / (495 + 0.0594 * Math.pow(sigma, 1.5));
  const gammaPrime = gammaMax * Math.pow(betaRatio, A) * Math.exp(A * (1 - betaRatio));

  // Intensidad de reacción I_R (BTU / (ft²·min), Ec. 27)
  const heat = fm.heatBtuLb ?? 8000;
  const IR = gammaPrime * heat * ETA_S * (wnDead * etaMDead + wnLive * etaMLive);

  // Razón de flujo propagador ξ (Ec. 42)
  const xi = Math.exp((0.792 + 0.681 * Math.sqrt(sigma)) * (beta + 0.1)) / (192 + 0.2595 * sigma);

  // Factor de viento φ_W (Ec. 47–50) con límite superior de viento efectivo de Rothermel (U <= 0.9 * I_R)
  const C = 7.47 * Math.exp(-0.133 * Math.pow(sigma, 0.55));
  const B = 0.02526 * Math.pow(sigma, 0.54);
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const uFtMinRaw = windMs * MS_TO_FT_MIN;
  const uFtMin = Math.min(uFtMinRaw, 0.9 * IR); // tope de Rothermel (1972) / Andrews (2018)
  const phiW = uFtMin > 0 ? C * Math.pow(uFtMin, B) * Math.pow(betaRatio, -E) : 0;

  // Factor de pendiente φ_S (Ec. 51)
  const tanPhi = Math.tan(slopeDeg * DEG);
  const phiS = 5.275 * Math.pow(beta, -0.3) * tanPhi * tanPhi;

  // Calor de preignición ponderado y número de calentamiento efectivo ε (Ec. 12, 14)
  const qig = (m) => 250 + 1116 * m;
  const eps = (sav) => Math.exp(-138 / sav);
  const denomDead = aDead > 0 ? dead.reduce((s, c) => s + (area(c) / aDead) * eps(c.sav) * qig(c.m), 0) : 0;
  const denomLive = aLive > 0 ? live.reduce((s, c) => s + (area(c) / aLive) * eps(c.sav) * qig(c.m), 0) : 0;
  const heatSink = rhoB * (fDead * denomDead + fLive * denomLive);

  // Velocidad de propagación sin viento/pendiente R0 y total R (ft/min, Ec. 52)
  const r0FtMin = heatSink > 0 ? (IR * xi) / heatSink : 0;
  const rosFtMin = heatSink > 0 ? (IR * xi * (1 + phiW + phiS)) / heatSink : 0;
  const rosMs = rosFtMin * FT_MIN_TO_MS;
  const rosMMin = rosMs * 60;

  // Tiempo de residencia de Anderson (1969): t_r = 384 / sigma (min)
  const residenceMin = 384 / sigma;
  // Intensidad de línea de fuego de Byram (1959): I_B = I_R * R * t_r / 60 (BTU/(ft·s)) → kW/m
  const byramBtuFtS = (IR * rosFtMin * residenceMin) / 60;
  const byramIntensityKWm = byramBtuFtS * BTU_FT_S_TO_KWM;
  // Longitud de llama de Byram (1959) en SI: L = 0.0775 * I_B^0.46 (m)
  const flameLengthM = byramIntensityKWm > 0 ? 0.0775 * Math.pow(byramIntensityKWm, 0.46) : 0;

  return Object.freeze({
    fuelCode: fm.code,
    burnable: true,
    rosMs: +rosMs.toFixed(5),
    rosMMin: +rosMMin.toFixed(3),
    rosFtMin: +rosFtMin.toFixed(3),
    ros0Ms: +(r0FtMin * FT_MIN_TO_MS).toFixed(5),
    reactionIntensityKWm2: +(IR * BTU_FT2_MIN_TO_KWM2).toFixed(2),
    byramIntensityKWm: +byramIntensityKWm.toFixed(2),
    flameLengthM: +flameLengthM.toFixed(3),
    windFactorPhiW: +phiW.toFixed(4),
    slopeFactorPhiS: +phiS.toFixed(4),
    propagatingFluxRatio: +xi.toFixed(5),
    effectiveWindMs: +(uFtMin * FT_MIN_TO_MS).toFixed(3),
    residenceMin: +residenceMin.toFixed(3),
    basis: 'MODEL',
    refs: Object.freeze([
      'Rothermel (1972) USDA FS INT-115',
      'Scott & Burgan (2005) USDA FS RMRS-GTR-153',
      'Byram (1959) Forest Fire: Control and Use',
    ]),
  });
}

/**
 * Relación longitud/anchura L/B de Anderson (1983, INT-305) / Finney (1998, FARSITE RMRS-RP-4)
 * en función de la velocidad efectiva del viento a media llama U (m/s).
 */
export function fireEllipseLengthToBreadth(effectiveWindMs) {
  const u = Math.max(0, effectiveWindMs);
  // Ec. 2 de Finney (1998) con U en m/s (Anderson 1983): L/B = 0.936 e^(0.2566 U) + 0.461 e^(-0.1548 U) - 0.397
  return Math.max(1.0, Math.min(8.0, 0.936 * Math.exp(0.2566 * u) + 0.461 * Math.exp(-0.1548 * u) - 0.397));
}

/**
 * Combina vectorialmente el viento (hacia dónde sopla, grados desde el norte) y la pendiente ascendente
 * (aspecto + 180°, grados desde el norte) siguiendo Finney (1998, FARSITE) para obtener la velocidad
 * máxima de cabeza `headRosMs`, cola `backRosMs`, flanco `flankRosMs`, y vector unitario `(ex, ey)`
 * en coordenadas de malla (x hacia el Este, y hacia el Sur).
 */
export function computeHuygensEllipse(fuelModel, env, { windToDeg, upslopeToDeg = 0 }) {
  const base = rothermelSpread(fuelModel, { ...env, midflameWindMs: 0, slopeDeg: 0 });
  if (!base.burnable || base.rosMs <= 0) {
    return { burnable: false, headRosMs: 0, backRosMs: 0, flankRosMs: 0, a: 0, b: 0, c: 0, ex: 1, ey: 0, byramIntensityKWm: 0, flameLengthM: 0 };
  }
  const withWind = rothermelSpread(fuelModel, { ...env, slopeDeg: 0 });
  const withSlope = rothermelSpread(fuelModel, { ...env, midflameWindMs: 0 });

  // Vectores de contribución aditiva de viento (φ_W) y pendiente (φ_S) en coordenadas de malla (x=E, y=S)
  const wRad = windToDeg * DEG;
  const sRad = upslopeToDeg * DEG;
  const wx = withWind.windFactorPhiW * Math.sin(wRad);
  const wy = -withWind.windFactorPhiW * Math.cos(wRad);
  const sx = withSlope.slopeFactorPhiS * Math.sin(sRad);
  const sy = -withSlope.slopeFactorPhiS * Math.cos(sRad);

  const tx = wx + sx;
  const ty = wy + sy;
  const phiEff = Math.hypot(tx, ty);
  const ex = phiEff > 1e-9 ? tx / phiEff : 1;
  const ey = phiEff > 1e-9 ? ty / phiEff : 0;

  const headRosMs = base.ros0Ms * (1 + phiEff);
  // Viento efectivo equivalente (incluyendo pendiente equivalente, Finney 1998)
  const uEff = env.midflameWindMs + (withSlope.slopeFactorPhiS > 0 ? Math.min(5, Math.sqrt(withSlope.slopeFactorPhiS)) : 0);
  const lb = fireEllipseLengthToBreadth(uEff);
  const hb = (lb + Math.sqrt(Math.max(0, lb * lb - 1))) / (lb - Math.sqrt(Math.max(0, lb * lb - 1)));
  const backRosMs = Math.max(base.ros0Ms * 0.15, headRosMs / Math.max(1, hb));
  const a = 0.5 * (headRosMs + backRosMs);
  const c = 0.5 * (headRosMs - backRosMs);
  const b = a / lb;

  // Byram en cabeza
  const byramHead = base.byramIntensityKWm * (base.ros0Ms > 0 ? headRosMs / base.ros0Ms : 1);
  const flameHead = byramHead > 0 ? 0.0775 * Math.pow(byramHead, 0.46) : 0;

  return {
    burnable: true,
    headRosMs,
    backRosMs,
    flankRosMs: b,
    a,
    b,
    c,
    ex,
    ey,
    lb,
    byramIntensityKWm: byramHead,
    flameLengthM: flameHead,
  };
}

/* ───────────── 3. Solver 2D Level-Set con frente elíptico de Huygens (Osher & Sethian 1988 / Finney 1998) ───────────── */

/**
 * Crea una simulación 2D Level-Set de incendio forestal acoplada a Rothermel (1972) y Scott & Burgan (2005).
 * @param {object} cfg
 *   - `w, h, dx`: dimensiones de malla y resolución espacial (m)
 *   - `fuelGrid`: array de longitud `w*h` con códigos Scott & Burgan (ej. 'GR2', 'SH5', 'TL8', 'NB8')
 *   - `dem`: opcional, Float32Array/Float64Array/Int16Array de elevaciones (m) para pendiente/orientación Horn (1981)
 *   - `ignition`: `{ i, j, radiusM? }` o array de puntos de ignición
 *   - `cfl`: número de Courant en (0, 0.45] (por defecto 0.4)
 */
export function createLevelSetFireSim({ w, h, dx, fuelGrid, dem = null, ignition, cfl = 0.4 } = {}) {
  if (!(w >= 5 && h >= 5 && dx > 0)) throw new RangeError('createLevelSetFireSim: w ≥ 5, h ≥ 5 y dx > 0 obligatorios');
  if (!fuelGrid || fuelGrid.length !== w * h) throw new RangeError('createLevelSetFireSim: fuelGrid de longitud w*h obligatoria');
  if (!ignition) throw new RangeError('createLevelSetFireSim: ignition obligatorio');
  if (!(cfl > 0 && cfl <= 0.45)) throw new RangeError('createLevelSetFireSim: cfl debe estar en (0, 0.45]');

  const N = w * h;
  const phi = new Float64Array(N).fill(Infinity);
  const arriveS = new Float32Array(N).fill(NaN);
  const flameMaxM = new Float32Array(N);
  const byramMaxKWm = new Float32Array(N);

  const ignitions = Array.isArray(ignition) ? ignition : [ignition];
  for (const ig of ignitions) {
    const r0 = ig.radiusM ?? dx * 0.75;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const dist = Math.hypot((i - ig.i) * dx, (j - ig.j) * dx) - r0;
        const k = j * w + i;
        if (dist < phi[k]) phi[k] = dist;
      }
    }
  }
  for (let k = 0; k < N; k++) {
    if (phi[k] <= 0) arriveS[k] = 0;
  }

  let slopeDeg = new Float32Array(N);
  let upslopeDeg = new Float32Array(N);
  if (dem) {
    const sa = slopeAspect(dem, w, h, dx);
    for (let k = 0; k < N; k++) {
      slopeDeg[k] = Number.isFinite(sa.slope[k]) ? Math.min(70, sa.slope[k]) : 0;
      // aspect de Horn es hacia donde CAE la ladera; la pendiente ascendente es aspect + 180°
      upslopeDeg[k] = Number.isFinite(sa.aspect[k]) ? (sa.aspect[k] + 180) % 360 : 0;
    }
  }

  return {
    basis: 'MODEL',
    method: 'Level-Set 2D upwind Godunov (Osher-Sethian 1988) + elipse de Huygens (Finney 1998) + Rothermel (1972) / Scott-Burgan (2005)',
    w,
    h,
    dx,
    cfl,
    fuelGrid,
    slopeDeg,
    upslopeDeg,
    phi,
    phiNext: new Float64Array(N),
    arriveS,
    flameMaxM,
    byramMaxKWm,
    t: 0,
    steps: 0,
  };
}

/**
 * Avanza la simulación Level-Set hasta `tEnd` (s).
 * @param {object} S estado de `createLevelSetFireSim`
 * @param {number} tEnd tiempo objetivo (s)
 * @param {function|object} weatherFn función `(tSec) => { dead1hMoisture, dead10hMoisture, dead100hMoisture, liveHerbMoisture, liveWoodyMoisture, midflameWindMs, windToDeg }` u objeto fijo
 */
export function runLevelSetFireUntil(S, tEnd, weatherFn, { dtMax = 60, reinitEvery = 15 } = {}) {
  const { w, h, dx, cfl, fuelGrid, slopeDeg, upslopeDeg, phi, phiNext, arriveS, flameMaxM, byramMaxKWm } = S;
  const getWeather = typeof weatherFn === 'function' ? weatherFn : () => weatherFn;

  // Caché de elipses por clave de tiempo/viento/combustible/pendiente redondeada
  let cachedWeatherKey = '';
  let ellipseCache = new Map();

  while (S.t < tEnd - 1e-6) {
    const wx = getWeather(S.t);
    const wKey = `${wx.dead1hMoisture.toFixed(3)}|${wx.liveHerbMoisture.toFixed(3)}|${wx.midflameWindMs.toFixed(2)}|${Math.round(wx.windToDeg)}`;
    if (wKey !== cachedWeatherKey) {
      cachedWeatherKey = wKey;
      ellipseCache = new Map();
    }

    const getEllipse = (k) => {
      const code = fuelGrid[k];
      const sBin = Math.round(slopeDeg[k]);
      const uBin = sBin > 0 ? Math.round(upslopeDeg[k] / 10) * 10 : 0;
      const key = `${code}|${sBin}|${uBin}`;
      let e = ellipseCache.get(key);
      if (!e) {
        e = computeHuygensEllipse(code, {
          dead1hMoisture: wx.dead1hMoisture,
          dead10hMoisture: wx.dead10hMoisture,
          dead100hMoisture: wx.dead100hMoisture,
          liveHerbMoisture: wx.liveHerbMoisture,
          liveWoodyMoisture: wx.liveWoodyMoisture,
          midflameWindMs: wx.midflameWindMs,
          slopeDeg: sBin,
        }, { windToDeg: wx.windToDeg, upslopeToDeg: uBin });
        ellipseCache.set(key, e);
      }
      return e;
    };

    // Primer barrido: banda activa cerca del frente (|φ| <= 3*dx) y velocidad máxima para CFL
    let maxF = 0;
    const band = [];
    for (let j = 1; j < h - 1; j++) {
      const row = j * w;
      for (let i = 1; i < w - 1; i++) {
        const k = row + i;
        if (Math.abs(phi[k]) > 6 * dx) continue;
        const e = getEllipse(k);
        if (!e.burnable || e.headRosMs <= 0) continue;

        // Gradiente centrado para normal unitaria n̂ = ∇φ / |∇φ| (apunta de quemado φ<0 hacia no quemado φ>0)
        const dpx = (phi[k + 1] - phi[k - 1]) / (2 * dx);
        const dpy = (phi[k + w] - phi[k - w]) / (2 * dx);
        const gMag = Math.hypot(dpx, dpy);
        const nx = gMag > 1e-9 ? dpx / gMag : e.ex;
        const ny = gMag > 1e-9 ? dpy / gMag : e.ey;

        // Función de soporte exacta de la elipse de Huygens desplazada:
        // F(n̂) = c (n̂·ê) + sqrt(a² (n̂·ê)² + b² (1 - (n̂·ê)²))
        const dot = Math.max(-1, Math.min(1, nx * e.ex + ny * e.ey));
        const F = e.c * dot + Math.sqrt(e.a * e.a * dot * dot + e.b * e.b * Math.max(0, 1 - dot * dot));
        if (F <= 0) continue;

        // Esquema upwind de Godunov para F > 0: |∇φ|+ = sqrt(max(D-x,0)² + min(D+x,0)² + max(D-y,0)² + min(D+y,0)²)
        const dmx = (phi[k] - phi[k - 1]) / dx;
        const dpxF = (phi[k + 1] - phi[k]) / dx;
        const dmy = (phi[k] - phi[k - w]) / dx;
        const dpyF = (phi[k + w] - phi[k]) / dx;
        const gradPlus = Math.sqrt(
          Math.max(dmx, 0) ** 2 + Math.min(dpxF, 0) ** 2 +
          Math.max(dmy, 0) ** 2 + Math.min(dpyF, 0) ** 2,
        );
        if (F > maxF) maxF = F;
        band.push({ k, F, gradPlus, flame: e.flameLengthM, byram: e.byramIntensityKWm });
      }
    }

    if (band.length === 0 || maxF <= 1e-9) {
      S.t = tEnd;
      break;
    }

    const dt = Math.min(dtMax, tEnd - S.t, (cfl * dx) / maxF);
    phiNext.set(phi);
    const tNew = S.t + dt;

    for (let idx = 0; idx < band.length; idx++) {
      const { k, F, gradPlus, flame, byram } = band[idx];
      const wasUnburned = phi[k] > 0;
      const val = phi[k] - dt * F * gradPlus;
      phiNext[k] = val;
      if (wasUnburned && val <= 0) {
        if (Number.isNaN(arriveS[k])) arriveS[k] = tNew;
        if (flame > flameMaxM[k]) flameMaxM[k] = flame;
        if (byram > byramMaxKWm[k]) byramMaxKWm[k] = byram;
      }
    }

    // Condición de frontera Neumann en bordes de malla
    for (let i = 0; i < w; i++) {
      phiNext[i] = phiNext[w + i];
      phiNext[(h - 1) * w + i] = phiNext[(h - 2) * w + i];
    }
    for (let j = 0; j < h; j++) {
      phiNext[j * w] = phiNext[j * w + 1];
      phiNext[j * w + (w - 1)] = phiNext[j * w + (w - 2)];
    }

    phi.set(phiNext);
    S.t = tNew;
    S.steps++;

    // Reinicialización periódica ligera de distancia firmada (Sussman et al. 1994, 2 pasos) para evitar distorsión de |∇φ|
    if (reinitEvery > 0 && S.steps % reinitEvery === 0) {
      reinitSignedDistance(phi, phiNext, w, h, dx, 2);
    }
  }

  let burnedCells = 0;
  for (let k = 0; k < w * h; k++) if (phi[k] <= 0) burnedCells++;
  return {
    tSec: S.t,
    steps: S.steps,
    burnedCells,
    burnedHa: +((burnedCells * dx * dx) / 10_000).toFixed(2),
    basis: 'MODEL',
  };
}

function reinitSignedDistance(phi, tmp, w, h, dx, iters) {
  const phi0 = Float64Array.from(phi);
  const dt = 0.25 * dx;
  for (let it = 0; it < iters; it++) {
    tmp.set(phi);
    for (let j = 1; j < h - 1; j++) {
      const row = j * w;
      for (let i = 1; i < w - 1; i++) {
        const k = row + i;
        const p0 = phi0[k];
        if (Math.abs(p0) > 6 * dx) continue;
        // Anclaje de interfaz (Russo & Smereka 2000): no desplazar celdas que cruzan φ = 0
        if (p0 * phi0[k - 1] <= 0 || p0 * phi0[k + 1] <= 0 || p0 * phi0[k - w] <= 0 || p0 * phi0[k + w] <= 0) {
          continue;
        }
        const p = phi[k];
        const s = p0 / Math.sqrt(p0 * p0 + dx * dx);
        const a = (p - phi[k - 1]) / dx;
        const b = (phi[k + 1] - p) / dx;
        const c = (p - phi[k - w]) / dx;
        const d = (phi[k + w] - p) / dx;
        let g;
        if (p0 > 0) {
          g = Math.sqrt(Math.max(a, 0) ** 2 + Math.min(b, 0) ** 2 + Math.max(c, 0) ** 2 + Math.min(d, 0) ** 2);
        } else {
          g = Math.sqrt(Math.min(a, 0) ** 2 + Math.max(b, 0) ** 2 + Math.min(c, 0) ** 2 + Math.max(d, 0) ** 2);
        }
        tmp[k] = p - dt * s * (g - 1);
      }
    }
    phi.set(tmp);
  }
}

/* ───────────── 4. Conjunto probabilista (Hipercubo Latino estratificado) ───────────── */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lhsDraws(n, rng) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = (i + rng()) / n;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function quantile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Ejecuta un conjunto probabilista por Hipercubo Latino (McKay, Beckman & Conover 1979) sobre
 * perturbaciones declaradas de viento (velocidad y dirección) y humedad del combustible muerto,
 * devolviendo mapa de probabilidad de quema por celda [0, 1] y horquilla p10/p50/p90 de superficie.
 */
export function runFireEnsemble({
  gridConfig,
  tEndSec,
  baseWeather,
  perturbation,
  members = 12,
  seed = 20261125,
  dtMax = 60,
}) {
  if (!perturbation || !Number.isFinite(perturbation.windSpeedMultMin) || !Number.isFinite(perturbation.windSpeedMultMax) ||
      !Number.isFinite(perturbation.windDirDeltaDeg) || !Number.isFinite(perturbation.deadMoistureDelta)) {
    throw new RangeError('runFireEnsemble: perturbation { windSpeedMultMin, windSpeedMultMax, windDirDeltaDeg, deadMoistureDelta } obligatorio');
  }
  if (!(members >= 3)) throw new RangeError('runFireEnsemble: members ≥ 3 obligatorio');

  const rng = mulberry32(seed);
  const uSpeed = lhsDraws(members, rng);
  const uDir = lhsDraws(members, rng);
  const uMoist = lhsDraws(members, rng);

  const N = gridConfig.w * gridConfig.h;
  const burnCount = new Uint16Array(N);
  const areasHa = [];
  const memberSummaries = [];

  const evalBase = typeof baseWeather === 'function' ? baseWeather : () => baseWeather;

  for (let m = 0; m < members; m++) {
    const speedMult = perturbation.windSpeedMultMin + uSpeed[m] * (perturbation.windSpeedMultMax - perturbation.windSpeedMultMin);
    const dirShift = (uDir[m] * 2 - 1) * perturbation.windDirDeltaDeg;
    const moistShift = (uMoist[m] * 2 - 1) * perturbation.deadMoistureDelta;

    const sim = createLevelSetFireSim(gridConfig);
    const res = runLevelSetFireUntil(sim, tEndSec, (t) => {
      const bw = evalBase(t);
      return {
        ...bw,
        midflameWindMs: Math.max(0, bw.midflameWindMs * speedMult),
        windToDeg: (bw.windToDeg + dirShift + 360) % 360,
        dead1hMoisture: Math.max(0.02, bw.dead1hMoisture + moistShift),
        dead10hMoisture: Math.max(0.03, bw.dead10hMoisture + moistShift),
        dead100hMoisture: Math.max(0.04, bw.dead100hMoisture + moistShift),
      };
    }, { dtMax });

    for (let k = 0; k < N; k++) if (sim.phi[k] <= 0) burnCount[k]++;
    areasHa.push(res.burnedHa);
    memberSummaries.push({
      member: m,
      speedMult: +speedMult.toFixed(3),
      dirShiftDeg: +dirShift.toFixed(1),
      moistShift: +moistShift.toFixed(3),
      burnedHa: res.burnedHa,
    });
  }

  const probBurn = new Float32Array(N);
  for (let k = 0; k < N; k++) probBurn[k] = burnCount[k] / members;
  const sorted = [...areasHa].sort((a, b) => a - b);

  return Object.freeze({
    basis: 'MODEL',
    method: 'Latin Hypercube Ensemble (McKay et al. 1979) sobre Rothermel + Level-Set Huygens',
    members,
    seed,
    probBurn,
    burnedHa: Object.freeze({
      min: +sorted[0].toFixed(2),
      p10: +quantile(sorted, 0.1).toFixed(2),
      p50: +quantile(sorted, 0.5).toFixed(2),
      p90: +quantile(sorted, 0.9).toFixed(2),
      max: +sorted[sorted.length - 1].toFixed(2),
    }),
    memberSummaries,
  });
}

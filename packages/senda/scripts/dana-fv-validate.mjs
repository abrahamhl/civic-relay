#!/usr/bin/env node
/**
 * SENDA · Validación científica DANA 29-10-2024 (Barranc del Poyo, l'Horta Sud)
 * con el solver de volúmenes finitos 2D bien equilibrado (`shallow-water-fv.mjs`:
 * Audusse et al. 2004 + HLLC Toro et al. 1994 + porosidad urbana Sanders et al. 2008 +
 * incisión subcelda de cauce Neal et al. 2012).
 *
 * 100% reproducible SIN RED a partir de los datos abiertos del repositorio:
 *  - `investor-next/public/senda/data/dana2024/dem_d4.bin` (Terrain Tiles z12 agregado ×4, 118,1 m)
 *  - `investor-next/public/senda/data/dana2024/dir_z12.bin` (red de drenaje D8)
 *  - `investor-next/public/senda/data/dana2024/hidro.json` (ROI y metadatos de malla)
 *  - `investor-next/public/senda/data/dana2024/emsr773_inundacion.geojson` (Copernicus EMSR773 AOI03)
 *  - `investor-next/public/senda/data/dana2024/swe.json` (referencia base Bates et al. 2010)
 *  - `investor-next/public/senda/data/radio/poyo.json` (coordenadas de los municipios de l'Horta Sud)
 *
 * Uso:
 *   node packages/senda/scripts/dana-fv-validate.mjs [--json]
 *
 * Regla de veracidad: el hidrograma de entrada usa los 3 puntos publicados (16:55 inicio Bonet ROP;
 * 18:55 2.282 m³/s CHJ; 19:35 3.500 m³/s CEDEX preliminar) y una recesión lineal (ESCENARIO).
 * Todo resultado se etiqueta `MODEL_CALIBRATED_AGAINST_OBSERVED` con sus parámetros explícitos.
 */
import { readFileSync } from 'node:fs';
import { lonToTileX, latToTileY, gridToLonLat } from '../src/geo-survey.mjs';
import { rasterize, agreement } from '../src/flood-science.mjs';
import { createSim, runUntil, piecewise, hydrographVolume, storedVolume } from '../src/shallow-water.mjs';
import {
  createFvSim,
  fvRunUntil,
  fvStoredVolume,
  enforceHydrologicBreach,
  buildUrbanPorosityField,
  assessHumanFloodStability,
  assessVehicleFloodStability,
} from '../src/shallow-water-fv.mjs';

const JSON_OUT = process.argv.includes('--json');
const DATA = new URL('../../../investor-next/public/senda/data/dana2024/', import.meta.url);
const RADIO = new URL('../../../investor-next/public/senda/data/radio/poyo.json', import.meta.url);

// 1. Cargar metadatos de malla y DEM offline dem_d4.bin (576×384, celda 118,1 m)
const hm = JSON.parse(readFileSync(new URL('hidro.json', DATA), 'utf8'));
const GM = hm.malla; // z=12, x0=2036, y0=1556, size=256, w=2304, h=1536
const D4 = hm.relieveD4; // factor=4, w=576, h=384, celdaM=118.1
const rawDem = readFileSync(new URL('dem_d4.bin', DATA));
const demFull = new Int16Array(rawDem.buffer, rawDem.byteOffset, rawDem.byteLength / 2);
const sweRef = JSON.parse(readFileSync(new URL('swe.json', DATA), 'utf8'));
const TOWNS = JSON.parse(readFileSync(RADIO, 'utf8')).municipios;

// Recorte al mismo dominio geográfico que dana-swe.mjs: BOX = [-0.62, 39.33, -0.33, 39.51]
const BOX = [-0.62, 39.33, -0.33, 39.51];
const fullPx = ([lon, lat]) => [
  (lonToTileX(lon, GM.z) - GM.x0) * GM.size,
  (latToTileY(lat, GM.z) - GM.y0) * GM.size,
];
const [fx0, fy0] = fullPx([BOX[0], BOX[3]]).map((v) => Math.floor(v / D4.factor));
const [fx1, fy1] = fullPx([BOX[2], BOX[1]]).map((v) => Math.ceil(v / D4.factor));
const W = fx1 - fx0;
const H = fy1 - fy0;
const dx = D4.celdaM;

const zRaw = new Float64Array(W * H);
const sink = new Uint8Array(W * H);
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const v = demFull[(fy0 + j) * D4.w + (fx0 + i)];
    const k = j * W + i;
    if (v === -32768 || v <= 0) {
      zRaw[k] = 0;
      sink[k] = 1;
    } else {
      zRaw[k] = v;
    }
    if (i === 0 || j === 0 || i === W - 1 || j === H - 1) sink[k] = 1;
  }
}

const toCell = ([lon, lat]) => {
  const [gx, gy] = fullPx([lon, lat]);
  return [gx / D4.factor - fx0, gy / D4.factor - fy0];
};

// 2. Trazar el cauce principal D8 del Poyo desde Chiva hasta el mar/Albufera (dir_z12.bin)
const DP = readFileSync(new URL('dir_z12.bin', DATA));
const dirAt = (k) => (DP[k >> 1] >> ((k & 1) * 4)) & 15;
const DI = [1, 1, 0, -1, -1, -1, 0, 1];
const DJ = [0, 1, 1, 1, 0, -1, -1, -1];
const chiva = TOWNS.find((m) => m.nombre === 'Chiva');
let [pi, pj] = fullPx([chiva.lon, chiva.lat]).map(Math.floor);

let kin = -1;
let inLL = null;
const channelSet = new Set();
const channelOrdered = [];
for (let s = 0; s < 100000; s++) {
  const ll = gridToLonLat({ ...GM }, pi + 0.5, pj + 0.5);
  const [ci, cj] = toCell(ll).map(Math.floor);
  if (ci >= 1 && ci < W - 1 && cj >= 1 && cj < H - 1) {
    const ck = cj * W + ci;
    if (kin < 0 && ci >= 2) {
      kin = ck;
      inLL = ll;
    }
    if (!channelSet.has(ck) && !sink[ck]) {
      channelSet.add(ck);
      channelOrdered.push(ck);
    }
  }
  const d = dirAt(pj * GM.w + pi);
  if (d > 7) break;
  pi += DI[d];
  pj += DJ[d];
}
if (kin < 0) throw new Error('No se encontró la entrada D8 del Poyo en el dominio');

// 3. Mancha observada Copernicus EMSR773 AOI03 y ROI oficial (idénticos a dana-swe.mjs)
const gj = JSON.parse(readFileSync(new URL('emsr773_inundacion.geojson', DATA), 'utf8'));
const aoi = gj.features.find((f) => f.properties.aoi === 3);
const obs = rasterize([aoi], W, H, toCell);
const rb = hm.roi.bbox;
const [rx0, ry0] = toCell([rb[0], rb[3]]).map(Math.floor);
const [rx1, ry1] = toCell([rb[2], rb[1]]).map(Math.ceil);
const roi = new Uint8Array(W * H);
for (let j = Math.max(0, ry0); j < Math.min(H, ry1); j++) {
  for (let i = Math.max(0, rx0); i < Math.min(W, rx1); i++) roi[j * W + i] = 1;
}
const obsKm2 = (obs.reduce((s, v, k) => s + (roi[k] ? v : 0), 0) * dx * dx) / 1e6;

// 4. Máscara urbana de núcleos de l'Horta Sud (radio aproximado 1,0 km en torno a centros municipales OSM)
const URBAN_NAMES = new Set([
  'Torrent', 'Picanya', 'Paiporta', 'Alaquàs', 'Aldaia', 'Catarroja',
  'Massanassa', 'Alfafar', 'Benetússer', 'Sedaví', 'Xirivella', 'Quart de Poblet', 'Alcàsser',
]);
const urbanMask = new Uint8Array(W * H);
const radiusCells = Math.round(900 / dx);
for (const m of TOWNS) {
  if (!URBAN_NAMES.has(m.nombre)) continue;
  const [ci, cj] = toCell([m.lon, m.lat]).map(Math.floor);
  for (let b = -radiusCells; b <= radiusCells; b++) {
    for (let a = -radiusCells; a <= radiusCells; a++) {
      if (a * a + b * b > radiusCells * radiusCells) continue;
      const ni = ci + a, nj = cj + b;
      if (ni >= 0 && ni < W && nj >= 0 && nj < H) urbanMask[nj * W + ni] = 1;
    }
  }
}

// 5. Hidrograma publicado (t = 0 en 16:55 CET)
const T = (hh, mm) => ((hh - 16) * 60 + (mm - 55)) * 60;
const hydroPts = (R) => [[T(16, 55), 0], [T(18, 55), 2282], [T(19, 35), 3500], [T(19, 35) + R * 3600, 0]];
const H_WET = 0.1;

function townMetrics(S, isFv) {
  return TOWNS.map((m) => {
    const [ci, cj] = toCell([m.lon, m.lat]).map(Math.floor);
    if (ci < 2 || cj < 2 || ci >= W - 2 || cj >= H - 2) return null;
    let md = 0, mv = 0, mdv = 0, arr = NaN;
    for (let b = -2; b <= 2; b++) {
      for (let a = -2; a <= 2; a++) {
        const k = (cj + b) * W + (ci + a);
        md = Math.max(md, S.maxD[k]);
        if (isFv) {
          mv = Math.max(mv, S.maxSpeed[k]);
          mdv = Math.max(mdv, S.maxDV[k]);
        }
        const ar = S.arrive[k];
        if (Number.isFinite(ar) && !(arr <= ar)) arr = ar;
      }
    }
    if (md < H_WET) return null;
    const out = {
      nombre: m.nombre,
      calMaxM: +md.toFixed(2),
      llegadaMinDesde1655: Number.isFinite(arr) ? Math.round(arr / 60) : null,
      horaLlegadaAproxCET: Number.isFinite(arr)
        ? (() => {
            const totalMin = 16 * 60 + 55 + Math.round(arr / 60);
            const hh = Math.floor(totalMin / 60) % 24;
            const mm = totalMin % 60;
            return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          })()
        : null,
    };
    if (isFv) {
      out.velMaxMs = +mv.toFixed(2);
      out.dvMaxM2s = +mdv.toFixed(2);
      out.estabilidadAdulto = assessHumanFloodStability(md, mv, { profile: 'adult', debrisFactor: 1.0 }).defraClass;
      out.estabilidadTurismo = assessVehicleFloodStability(md, mv, { vehicleClass: 'small_passenger' }).mechanism;
    }
    return out;
  }).filter(Boolean);
}

// 6. Experimento A: Bates (2010) en esta misma malla 118 m (para comparación justa en idéntica resolución)
function runBatesBaseline(nVal, R) {
  const pts = hydroPts(R);
  const tEnd = pts.at(-1)[0] + 3 * 3600;
  const S = createSim({ w: W, h: H, z: Float32Array.from(zRaw), dx, n: nVal, sink, hArrive: H_WET });
  const t0 = performance.now();
  runUntil(S, tEnd, { inflow: piecewise(pts), cells: [kin], dtMax: 10 });
  const sec = (performance.now() - t0) / 1000;
  const mask = Uint8Array.from(S.maxD, (v) => (v >= H_WET ? 1 : 0));
  const a = agreement(mask, obs, roi);
  const bal = (S.volIn - S.volOut - storedVolume(S)) / S.volIn;
  const towns = townMetrics(S, false);
  return {
    modelo: 'Bates-2010 (base, MDE bruto 118 m)',
    n: nVal,
    recesionH: R,
    csi: +a.csi.toFixed(4),
    acierto: +a.hitRate.toFixed(4),
    falsaAlarma: +a.falseAlarmRatio.toFixed(4),
    km2SimRoi: +((mask.reduce((s, v, k) => s + (roi[k] ? v : 0), 0) * dx * dx) / 1e6).toFixed(2),
    errorBalance: +bal.toExponential(2),
    pasos: S.steps,
    cpuSeg: +sec.toFixed(2),
    llegadasMin: Object.fromEntries(towns.map((t) => [t.nombre, t.llegadaMinDesde1655])),
    municipios: towns,
  };
}

// 7. Experimento B: FV 2D Audusse-HLLC + apertura hidrológica (Lindsay & Dhun 2015) + Manning diferenciado (Chow 1959) + porosidad urbana (Sanders 2008)
function runFvScenario({ label, breachMinSlope = null, extraIncisionM = 0, nChannel, nPlain, urbanPhi = 1, urbanDrag = 0, R = 6, burnStopLon = -0.44 }) {
  const gorgeCells = channelOrdered.filter((k) => {
    const ci = k % W, cj = (k / W) | 0;
    const [lon] = gridToLonLat({ ...GM }, (fx0 + ci + 0.5) * D4.factor, (fy0 + cj + 0.5) * D4.factor);
    return lon <= burnStopLon;
  });
  let zUse = zRaw;
  let breachedCount = 0;
  if (breachMinSlope != null) {
    const br = enforceHydrologicBreach(zRaw, gorgeCells, dx, { minSlope: breachMinSlope, extraIncisionM });
    zUse = br.z;
    breachedCount = br.breachedCount;
  }

  const nField = new Float64Array(W * H).fill(nPlain);
  for (const k of channelOrdered) {
    const ci = k % W, cj = (k / W) | 0;
    const [lon] = gridToLonLat({ ...GM }, (fx0 + ci + 0.5) * D4.factor, (fy0 + cj + 0.5) * D4.factor);
    if (lon <= -0.415) nField[k] = nChannel;
  }

  let phi = null;
  let dragCoeff = null;
  if (urbanPhi < 1) {
    const u = buildUrbanPorosityField(W, H, { urbanMask, urbanPhi, urbanDragCoeff: urbanDrag });
    phi = u.phi;
    dragCoeff = u.dragCoeff;
  }

  const pts = hydroPts(R);
  const tEnd = pts.at(-1)[0] + 3 * 3600;
  const S = createFvSim({ w: W, h: H, z: zUse, dx, n: nField, sink, phi, dragCoeff, cfl: 0.45, hArrive: H_WET });
  const t0 = performance.now();
  fvRunUntil(S, tEnd, { inflow: piecewise(pts), cells: [kin], dtMax: 10 });
  const sec = (performance.now() - t0) / 1000;
  const mask = Uint8Array.from(S.maxD, (v) => (v >= H_WET ? 1 : 0));
  const a = agreement(mask, obs, roi);
  const bal = (S.volIn - S.volOut - fvStoredVolume(S)) / S.volIn;
  const towns = townMetrics(S, true);
  return {
    modelo: label,
    breachMinSlope,
    breachedCount,
    extraIncisionM,
    nChannel,
    nPlain,
    urbanPhi,
    recesionH: R,
    burnStopLon,
    csi: +a.csi.toFixed(4),
    acierto: +a.hitRate.toFixed(4),
    falsaAlarma: +a.falseAlarmRatio.toFixed(4),
    km2SimRoi: +((mask.reduce((s, v, k) => s + (roi[k] ? v : 0), 0) * dx * dx) / 1e6).toFixed(2),
    volumenHidrogramaHm3: +(hydrographVolume(pts) / 1e6).toFixed(2),
    errorBalance: +bal.toExponential(2),
    pasos: S.steps,
    cpuSeg: +sec.toFixed(2),
    llegadasMin: Object.fromEntries(towns.map((t) => [t.nombre, t.llegadaMinDesde1655])),
    municipios: towns,
  };
}

const results = {
  caso: "DANA 29-10-2024 · Barranc del Poyo (l'Horta Sud) · Validación FV 2D Audusse-HLLC vs Bates 2010",
  basis: 'MODEL_CALIBRATED_AGAINST_OBSERVED',
  generadoUTC: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  malla: { w: W, h: H, dxM: dx, entradaLonLat: inLL.map((v) => +v.toFixed(5)), celdasCauceD8: channelOrdered.length },
  observadoCopernicusEMSR773_Km2Roi: +obsKm2.toFixed(2),
  referenciaRepoSweJson59m: {
    mejorCsi: sweRef.mejor.csi,
    mejorN: sweRef.mejor.n,
    mejorRecesionH: sweRef.mejor.recesionH,
    llegadaPaiportaMin: sweRef.mejor.llegadas?.Paiporta ?? null,
    llegadaPicanyaMin: sweRef.mejor.llegadas?.Picanya ?? null,
    llegadaMasRapidaPaiportaMin: Math.min(...sweRef.calibracion.map((r) => r.llegadas?.Paiporta ?? Infinity)),
    llegadaMasRapidaPicanyaMin: Math.min(...sweRef.calibracion.map((r) => r.llegadas?.Picanya ?? Infinity)),
  },
  experimentos: [
    runBatesBaseline(0.06, 6),
    runFvScenario({ label: 'FV2D Audusse-HLLC (MDE bruto, n=0.06 uniforme)', breachMinSlope: null, nChannel: 0.06, nPlain: 0.06, urbanPhi: 1, R: 6 }),
    runFvScenario({ label: 'FV2D Audusse-HLLC + breaching MDS (Lindsay-Dhun 2015) + Manning dif. + porosidad urbana 0.68', breachMinSlope: 0.0005, extraIncisionM: 0, nChannel: 0.025, nPlain: 0.09, urbanPhi: 0.68, urbanDrag: 0.003, R: 6, burnStopLon: -0.43 }),
    runFvScenario({ label: 'FV2D Audusse-HLLC + breaching MDS + incisión 1 m garganta + Manning dif. + porosidad urbana 0.72', breachMinSlope: 0.0005, extraIncisionM: 1.0, nChannel: 0.022, nPlain: 0.085, urbanPhi: 0.72, urbanDrag: 0.002, R: 6, burnStopLon: -0.44 }),
  ],
};

if (JSON_OUT) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`\n=== ${results.caso} ===`);
  console.log(`Malla offline: ${W}×${H} (dx=${dx} m) · Observado EMSR773 ROI: ${obsKm2.toFixed(2)} km²`);
  console.log(`Referencia swe.json (Bates 59 m): mejor CSI=${results.referenciaRepoSweJson59m.mejorCsi} · Paiporta=${results.referenciaRepoSweJson59m.llegadaMasRapidaPaiportaMin}–${results.referenciaRepoSweJson59m.llegadaPaiportaMin ?? 'N/D'} min · Picanya=${results.referenciaRepoSweJson59m.llegadaMasRapidaPicanyaMin}–${results.referenciaRepoSweJson59m.llegadaPicanyaMin} min\n`);
  for (const e of results.experimentos) {
    console.log(`• ${e.modelo}`);
    console.log(`  CSI=${e.csi}  Acierto=${e.acierto}  FalsaAlarma=${e.falsaAlarma}  AreaSim=${e.km2SimRoi} km²  Bal=${e.errorBalance}  Pasos=${e.pasos}  CPU=${e.cpuSeg}s`);
    console.log(`  Llegadas (min desde 16:55): ${JSON.stringify(e.llegadasMin)}`);
    const keyTowns = e.municipios.filter((m) => ['Picanya', 'Paiporta', 'Catarroja', 'Massanassa', 'Alfafar', 'Benetússer', 'Sedaví', 'Torrent'].includes(m.nombre));
    if (keyTowns.length && keyTowns[0].velMaxMs != null) {
      console.log(`  Estabilidad (d_max, v_max, adulto DEFRA, turismo Shand):`);
      for (const t of keyTowns) {
        console.log(`    - ${t.nombre}: ${t.horaLlegadaAproxCET} (+${t.llegadaMinDesde1655} min) · h=${t.calMaxM} m · v=${t.velMaxMs} m/s · d·v=${t.dvMaxM2s} m²/s · ${t.estabilidadAdulto} · ${t.estabilidadTurismo}`);
      }
    }
  }
}

#!/usr/bin/env node
/**
 * DANA 4D · simulación hidrodinámica 2D (Bates et al. 2010) de la crecida del Poyo el 29-10-2024 en l'Horta Sud,
 * validada contra la mancha observada por Copernicus EMS (EMSR773, AOI03).
 *
 *   node packages/senda/scripts/dana-swe.mjs [--quick]
 *
 * Entrada de agua = ESCENARIO construido SOLO con puntos publicados (hora local CET):
 *   16:55 → 0 m³/s    (Bonet: «en dos horas llegó a superar los 2000 m³/s»; subida desde 2 h antes del dato de las 18:55)
 *   18:55 → 2.282 m³/s (MEDIDO, CHJ vía Maldita; Roldán da 2.292)
 *   19:35 → 3.500 m³/s (ESTIMADO, CEDEX preliminar vía Roldán 2025)
 *   después → bajada lineal a 0 en R horas (R = ESCENARIO, sin dato publicado: se prueban varias)
 * Rugosidad de Manning n: sin valor publicado para esta zona → se prueban varias y se CALIBRA con la mancha.
 * Lluvia sobre la llanura: no se añade (Roldán 2025: «en las poblaciones situadas en el cauce bajo no llovió o lo hizo
 * escasamente»). Afluentes (Saleta, Horteta, Gallego): no incluidos (declarado).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tile } from './lib/terrarium-node.mjs';
import { tilesFor, mosaic, metersPerPixel, lonToTileX, latToTileY, gridToLonLat } from '../src/geo-survey.mjs';
import { rasterize, agreement } from '../src/flood-science.mjs';
import { createSim, runUntil, piecewise, hydrographVolume, storedVolume } from '../src/shallow-water.mjs';

const OUT = new URL('../../../investor-next/public/senda/data/dana2024/', import.meta.url);
const QUICK = process.argv.includes('--quick');
const Z = 12, BOX = [-0.62, 39.33, -0.33, 39.51], F = 2; // dominio y agregación ×2 (≈ 59 m)
const t0 = Date.now();

// ── Relieve del dominio ──
const tiles = []; for (const t of tilesFor(BOX, Z)) tiles.push(await tile(t));
const g = mosaic(tiles, Z);
const px = ([lon, lat]) => [(lonToTileX(lon, Z) - g.x0) * g.size, (latToTileY(lat, Z) - g.y0) * g.size];
const [cx0, cy0] = px([BOX[0], BOX[3]]).map(Math.floor), [cx1, cy1] = px([BOX[2], BOX[1]]).map(Math.ceil);
const W = Math.floor((cx1 - cx0) / F), H = Math.floor((cy1 - cy0) / F), latMid = (BOX[1] + BOX[3]) / 2, dx = metersPerPixel(latMid, Z) * F;
const zc = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  let s = 0, n = 0; for (let b = 0; b < F; b++) for (let a = 0; a < F; a++) { const v = g.data[(cy0 + j * F + b) * g.w + cx0 + i * F + a]; if (Number.isFinite(v)) { s += v; n++; } }
  zc[j * W + i] = n ? s / n : NaN;
}
const toCell = ([lon, lat]) => { const [x, y] = px([lon, lat]); return [(x - cx0) / F, (y - cy0) / F]; };
const cellLL = (i, j) => gridToLonLat(g, cx0 + i * F, cy0 + j * F);
console.log(`dominio ${W}×${H} celdas de ${dx.toFixed(1)} m`);

// ── Sumideros: mar / Albufera (cota ≤ 0) y borde ──
const sink = new Uint8Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (!(zc[k] > 0) || i === 0 || j === 0 || i === W - 1 || j === H - 1) sink[k] = 1; }

// ── Entrada: el cauce del Poyo (camino D8 de la malla completa desde Chiva) donde cruza el borde oeste del dominio ──
const hm = JSON.parse(readFileSync(new URL('hidro.json', OUT))), GM = hm.malla, DP = readFileSync(new URL('dir_z12.bin', OUT));
const dirAt = (k) => (DP[k >> 1] >> ((k & 1) * 4)) & 15, DI = [1, 1, 0, -1, -1, -1, 0, 1], DJ = [0, 1, 1, 1, 0, -1, -1, -1];
const chiva = JSON.parse(readFileSync(new URL('../radio/poyo.json', OUT))).municipios.find((m) => m.nombre === 'Chiva');
const gpx = ([lon, lat]) => [Math.floor((lonToTileX(lon, Z) - GM.x0) * GM.size), Math.floor((latToTileY(lat, Z) - GM.y0) * GM.size)];
let [pi, pj] = gpx([chiva.lon, chiva.lat]), kin = -1, inLL = null;
for (let s = 0; s < 100000; s++) {
  const ll = gridToLonLat({ ...GM }, pi + 0.5, pj + 0.5); const [ci, cj] = toCell(ll).map(Math.floor);
  if (ci >= 3 && cj > 0 && cj < H - 1) { kin = cj * W + ci; inLL = ll; break; }
  const d = dirAt(pj * GM.w + pi); if (d > 7) break; pi += DI[d]; pj += DJ[d];
}
if (kin < 0) throw new Error('el camino del Poyo no entra en el dominio');
console.log(`entrada en ${inLL.map((v) => v.toFixed(4))} (camino D8 del Poyo desde Chiva al cruzar el borde oeste)`);

// ── Mancha observada (AOI03) y ROI de comparación (igual criterio que HAND) ──
const gj = JSON.parse(readFileSync(new URL('emsr773_inundacion.geojson', OUT))), aoi = gj.features.find((f) => f.properties.aoi === 3);
const obs = rasterize([aoi], W, H, toCell);
const hidro = hm, rb = hidro.roi.bbox;
const [rx0, ry0] = toCell([rb[0], rb[3]]).map(Math.floor), [rx1, ry1] = toCell([rb[2], rb[1]]).map(Math.ceil);
const roi = new Uint8Array(W * H); for (let j = Math.max(0, ry0); j < Math.min(H, ry1); j++) for (let i = Math.max(0, rx0); i < Math.min(W, rx1); i++) roi[j * W + i] = 1;

// ── Municipios (puntos de Nominatim/OSM): llegada (calado ≥ 0,1 m) y calado máximo en un radio de 2 celdas ──
const TOWNS = JSON.parse(readFileSync(new URL('../radio/poyo.json', OUT))).municipios;
const townStats = (S) => TOWNS.map((m) => {
  const [ci, cj] = toCell([m.lon, m.lat]).map(Math.floor); if (ci < 2 || cj < 2 || ci >= W - 2 || cj >= H - 2) return null;
  let md = 0, arr = NaN; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const k = (cj + b) * W + ci + a; md = Math.max(md, S.maxD[k]); const ar = S.arrive[k]; if (Number.isFinite(ar) && !(arr <= ar)) arr = ar; }
  return { nombre: m.nombre, calMaxM: +md.toFixed(2), llegadaMin: Number.isFinite(arr) ? Math.round(arr / 60) : null };
}).filter(Boolean);
// Velocidad media del frente desde la entrada hasta el primer municipio alcanzado (para contrastar con 14 m/s del CEDEX)

// ── Escenarios ──
const T = (hh, mm) => ((hh - 16) * 60 + (mm - 55)) * 60; // segundos desde las 16:55 locales
const hydroPts = (R) => [[T(16, 55), 0], [T(18, 55), 2282], [T(19, 35), 3500], [T(19, 35) + R * 3600, 0]];
const NS = QUICK ? [0.06] : [0.035, 0.06, 0.1], RS = QUICK ? [3] : [3, 6], H_WET = 0.1;
const runs = [];
let best = null;
for (const n of NS) for (const R of RS) {
  const pts = hydroPts(R), tEnd = pts.at(-1)[0] + 3 * 3600, S = createSim({ w: W, h: H, z: zc, dx, n, sink, hArrive: H_WET });
  const tr = Date.now();
  runUntil(S, tEnd, { inflow: piecewise(pts), cells: [kin], dtMax: 10 });
  const mask = Uint8Array.from(S.maxD, (v) => (v >= H_WET ? 1 : 0)), a = agreement(mask, obs, roi);
  const bal = (S.volIn - S.volOut - storedVolume(S)) / S.volIn;
  const ts = townStats(S), first = ts.filter((x) => x.llegadaMin != null).sort((a, b) => a.llegadaMin - b.llegadaMin)[0];
  const r = { n, recesionH: R, llegadas: Object.fromEntries(ts.filter((x) => x.llegadaMin != null).map((x) => [x.nombre, x.llegadaMin])), volumenEntradaHm3: +(S.volIn / 1e6).toFixed(2), volumenHidrogramaHm3: +(hydrographVolume(pts) / 1e6).toFixed(2), salidaHm3: +(S.volOut / 1e6).toFixed(2), errorBalance: +bal.toExponential(2), pasos: S.steps, csi: +a.csi.toFixed(4), acierto: +a.hitRate.toFixed(4), falsaAlarma: +a.falseAlarmRatio.toFixed(4), km2Max: +((mask.reduce((s, v, k) => s + (roi[k] ? v : 0), 0) * dx * dx) / 1e6).toFixed(2), seg: +((Date.now() - tr) / 1000).toFixed(1) };
  runs.push(r); console.log(JSON.stringify(r));
  if (!best || r.csi > best.r.csi) best = { r, n, R };
  void first;
}
// Variante «más rápida»: la de menor llegada a Paiporta (para contrastar el tiempo con el dato del CEDEX)
const fast = runs.filter((r) => r.llegadas.Paiporta != null).sort((a, b) => a.llegadas.Paiporta - b.llegadas.Paiporta)[0];
const obsKm2 = (obs.reduce((s, v, k) => s + (roi[k] ? v : 0), 0) * dx * dx) / 1e6;
console.log(`observado en la ROI: ${obsKm2.toFixed(2)} km² · mejor: n=${best.n}, R=${best.R} h, CSI ${best.r.csi}`);

// ── Repetición de las variantes elegidas con fotogramas cada 15 min ──
const FR = 15 * 60, q8 = (v) => (v < H_WET ? 0 : Math.min(254, Math.round(v * 10))); // décimas de metro
const rle = (arr) => { const out = []; let k = 0; while (k < arr.length) { if (arr[k] === 0) { let r = 0; while (k < arr.length && arr[k] === 0 && r < 65535) { r++; k++; } out.push(255, r & 255, r >> 8); } else { out.push(arr[k]); k++; } } return Uint8Array.from(out); };
const replay = (n, R, tag) => {
  const pts = hydroPts(R), tEnd = pts.at(-1)[0] + 3 * 3600, S = createSim({ w: W, h: H, z: zc, dx, n, sink, hArrive: H_WET }), frames = [];
  runUntil(S, tEnd, { inflow: piecewise(pts), cells: [kin], dtMax: 10, frameEvery: FR, onFrame: (t) => frames.push({ t, data: rle(Uint8Array.from(S.d, q8)) }) });
  const blob = Buffer.concat(frames.map((f) => Buffer.from(f.data))); let off = 0;
  if (!QUICK) {
    writeFileSync(new URL(`swe_${tag}_frames.bin`, OUT), blob); writeFileSync(new URL(`swe_${tag}_max.bin`, OUT), Uint8Array.from(S.maxD, q8));
  }
  return { id: tag, n, recesionH: R, municipios: townStats(S), fotogramas: frames.map((f) => { const o = { tSeg: Math.round(f.t), offset: off, bytes: f.data.length }; off += f.data.length; return o; }), mb: +(blob.length / 1e6).toFixed(2) };
};
const variants = [replay(best.n, best.R, 'extension')];
if (fast && !(fast.n === best.n && fast.recesionH === best.R)) variants.push(replay(fast.n, fast.recesionH, 'tiempo'));
const corner = (i, j) => cellLL(i, j).map((v) => +v.toFixed(6));
const meta = {
  caso: "DANA 29-10-2024 · crecida del Poyo en l'Horta Sud · simulación hidrodinámica 2D", basis: 'MODEL_CALIBRATED_AGAINST_OBSERVED', generadoUTC: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  metodo: 'Ecuaciones de aguas someras, formulación inercial (Bates, Horritt y Fewtrell 2010, J. Hydrology 387:33-45), Courant α = 0,7; verificado con lago en reposo, conservación de masa y calado normal de Manning (packages/senda/tests/shallow-water.test.mjs)',
  malla: { w: W, h: H, celdaM: +dx.toFixed(2), esquinas: [corner(0, 0), corner(W, 0), corner(W, H), corner(0, H)], bbox: BOX, agregacion: `media de ${F}×${F} celdas de Terrain Tiles z${Z}` },
  entrada: { lonlat: inLL.map((v) => +v.toFixed(5)), nota: 'camino D8 del Poyo desde Chiva al entrar en el dominio (zona del aforo; su posición exacta no está publicada)', puntos: [['16:55', 0, 'inicio de la subida: «en dos horas» (Bonet, ROP)'], ['18:55', 2282, 'MEDIDO (CHJ vía Maldita)'], ['19:35', 3500, 'ESTIMADO (CEDEX, preliminar)'], [`+${best.R} h`, 0, 'bajada lineal: ESCENARIO calibrado']] },
  origenTiempo: '2024-10-29T16:55 hora local (15:55 UTC)', umbralMojadoM: H_WET, observadoKm2Roi: +obsKm2.toFixed(2), calibracion: runs, mejor: { n: best.n, recesionH: best.R, ...best.r },
  comparacionHAND: { csi: hidro.calibracion.find((x) => x.streamKm2 === hidro.cauceKm2).best.csi, nota: 'mismo índice, misma mancha y misma ROI' },
  limites: ['Sin edificios, colectores, puentes ni encauzamientos en el relieve (≈ 59 m).', 'Hidrograma de entrada construido con 3 puntos publicados; la forma entre ellos y la bajada son ESCENARIO.', 'Sin afluentes (Saleta, Horteta, Gallego) ni lluvia local.', 'La rugosidad y la duración de la bajada se calibran con la mancha observada: no es una predicción a ciegas.', 'La mancha de Copernicus es del 31-10 10:22 UTC; se compara con la extensión MÁXIMA simulada.'],
  variantes: variants, codificacion: 'RLE: 255,lo,hi = racha de ceros; resto = calado en décimas de m (1..254)',
  fuentes: ['Roldán Cañas (2025), BRAC 174:775-795', 'Bonet, Revista de Obras Públicas 3652', 'Maldita.es 07-11-2024 (cita a la CHJ)', 'Copernicus EMS EMSR773', 'Terrain Tiles (AWS Open Data)'],
};
if (!QUICK) writeFileSync(new URL('swe.json', OUT), JSON.stringify(meta, null, 1));
for (const v of variants) console.log(`${v.id}: n=${v.n} R=${v.recesionH} h · ${v.fotogramas.length} fotogramas ${v.mb} MB · ${JSON.stringify(v.municipios.filter((m) => m.llegadaMin != null))}`);
console.log(`total ${((Date.now() - t0) / 1000).toFixed(0)} s`);

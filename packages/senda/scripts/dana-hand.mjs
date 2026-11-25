#!/usr/bin/env node
/**
 * DANA 4D · calcula la hidrología del relieve alrededor de l'Horta Sud y la contrasta con la mancha
 * OBSERVADA por Copernicus EMS (EMSR773, AOI03, imagen del 31-10-2024 10:22 UTC).
 *
 *   node packages/senda/scripts/dana-hand.mjs
 *
 * Entradas: Terrain Tiles de AWS (terrarium, z12) y data/dana2024/emsr773_inundacion.geojson (ya en el repo).
 * Salidas (investor-next/public/senda/data/dana2024/):
 *   hand_roi.bin   Uint8, HAND en cuartos de metro (0–254 → 0–63,5 m; 255 = sin dato o mar), recorte ROI
 *   obs_roi.bin    Uint8, 1 = agua observada por Copernicus en el recorte ROI
 *   dir_z12.bin    D8 empaquetado (2 celdas por byte, 4 bits; 15 = salida) de toda la malla, para cuencas
 *   cauces.geojson cauces del modelo (cuenca ≥ 5 km²) con su clase de cuenca
 *   (HAND se guarda con el umbral de cauce de mayor CSI de los probados: 1, 5 o 25 km²)
 *   hidro.json     malla, recorte, calibración (CSI por nivel) y procedencia con SHA-256 de cada tesela
 */
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tilesFor, decodeTerrarium, mosaic, metersPerPixel, lonToTileX, latToTileY, gridToLonLat } from '../src/geo-survey.mjs';
import { analyze, rasterize, calibrateLevel, floodMask, agreement, DI, DJ } from '../src/flood-science.mjs';

const ROOT = new URL('../../../', import.meta.url);
const OUT = new URL('investor-next/public/senda/data/dana2024/', ROOT);
const Z = 12, BBOX = [-1.0, 39.25, -0.3, 39.6]; // cuencas del Poyo, Pozalet/Saleta y Horta Sud hasta el mar
const ROI_PAD = 0.01;
const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const CACHE = join(tmpdir(), 'senda-terrarium'); mkdirSync(CACHE, { recursive: true });

/** Decodificador PNG mínimo: 8 bits, RGB o RGBA, sin entrelazado (lo que sirven las Terrain Tiles). */
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG no soportado'); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error(`tipo de color ${ct} no soportado`);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { out.set(cur.subarray(x * bpp, x * bpp + 3), (y * w + x) * 4); out[(y * w + x) * 4 + 3] = 255; }
    prev.set(cur);
  }
  return { w, h, rgba: out };
}

async function tile(t) {
  const f = join(CACHE, `${t.z}-${t.x}-${t.y}.png`);
  let buf;
  if (existsSync(f)) buf = readFileSync(f);
  else {
    const r = await fetch(TILE_URL(t.z, t.x, t.y)); if (!r.ok) throw new Error(`${r.status} en ${TILE_URL(t.z, t.x, t.y)}`);
    buf = Buffer.from(await r.arrayBuffer()); writeFileSync(f, buf);
  }
  const png = decodePng(buf); if (png.w !== 256) throw new Error('tesela de tamaño inesperado');
  return { ...t, heights: decodeTerrarium(png.rgba), sha256: createHash('sha256').update(buf).digest('hex') };
}

const t0 = Date.now();
const tiles = []; for (const t of tilesFor(BBOX, Z)) tiles.push(await tile(t));
const g = mosaic(tiles, Z), latMid = (BBOX[1] + BBOX[3]) / 2, cellM = metersPerPixel(latMid, Z), cellKm2 = (cellM * cellM) / 1e6;
console.log(`malla ${g.w}×${g.h} (${tiles.length} teselas), celda ${cellM.toFixed(1)} m`);

const toPx = ([lon, lat]) => [(lonToTileX(lon, Z) - g.x0) * g.size, (latToTileY(lat, Z) - g.y0) * g.size];
const toLonLat = (px, py) => gridToLonLat(g, px, py).map((v) => Math.round(v * 1e5) / 1e5);
const gj = JSON.parse(readFileSync(new URL('emsr773_inundacion.geojson', OUT)));
const aoi = gj.features.find((f) => f.properties.aoi === 3);
const obs = rasterize([aoi], g.w, g.h, toPx);

// ROI = rectángulo que envuelve la mancha observada de AOI03 (+ margen). El perímetro exacto del área cartografiada
// (AOI) no está en el repo: fuera de la mancha pero dentro del rectángulo se cuenta «seco observado» (aproximación declarada).
let xs = [], ys = []; (function walk(c) { if (typeof c[0] === 'number') { xs.push(c[0]); ys.push(c[1]); } else c.forEach(walk); })(aoi.geometry.coordinates);
const roiBox = [Math.min(...xs) - ROI_PAD, Math.min(...ys) - ROI_PAD, Math.max(...xs) + ROI_PAD, Math.max(...ys) + ROI_PAD];
const [rx0, ry0] = toPx([roiBox[0], roiBox[3]]).map(Math.floor), [rx1, ry1] = toPx([roiBox[2], roiBox[1]]).map(Math.ceil);
const rw = rx1 - rx0, rh = ry1 - ry0, roi = new Uint8Array(g.w * g.h);
for (let j = ry0; j < ry1; j++) for (let i = rx0; i < rx1; i++) roi[j * g.w + i] = 1;

const LEVELS = Array.from({ length: 41 }, (_, k) => k * 0.5); // 0–20 m
const runs = [];
let keep = null, keepCsi = -1;
for (const streamKm2 of [1, 5, 25]) {
  const r = analyze(g.data, g.w, g.h, { cellM, streamKm2, seaLevel: 0 });
  const cal = calibrateLevel(r.hand, obs, { levels: LEVELS, roi, dem: g.data, seaLevel: 0 });
  runs.push({ streamKm2, streamCells: r.streamCells, best: cal.best, rows: cal.rows.map(({ level, csi, hitRate, falseAlarmRatio }) => ({ level, csi: +csi.toFixed(4), hitRate: +hitRate.toFixed(4), falseAlarmRatio: +falseAlarmRatio.toFixed(4) })) });
  console.log(`cauce ≥ ${streamKm2} km²: mejor nivel ${cal.best.level} m, CSI ${cal.best.csi.toFixed(3)} (acierto ${cal.best.hitRate.toFixed(3)}, falsa alarma ${cal.best.falseAlarmRatio.toFixed(3)})`);
  if (cal.best.csi > keepCsi) { keep = { ...r, streamKm2 }; keepCsi = cal.best.csi; } // se guarda el umbral con mejor CSI (declarado)
}

// Línea base sin terreno: ¿cuánto acierta «inundar todo lo que esté por debajo de X m de cota»? (bañera)
const bath = LEVELS.map((L) => L * 4).map((zMax) => {
  const m = new Uint8Array(g.w * g.h); for (let k = 0; k < m.length; k++) if (g.data[k] > 0 && g.data[k] <= zMax) m[k] = 1;
  return { zMaxM: zMax, csi: +agreement(m, obs, roi).csi.toFixed(4) };
});
const bathBest = bath.reduce((p, r) => (r.csi > p.csi ? r : p), bath[0]);
console.log(`bañera por cota (sin hidrología): mejor ≤ ${bathBest.zMaxM} m, CSI ${bathBest.csi}`);

// Recortes ROI
const handRoi = new Uint8Array(rw * rh).fill(255), obsRoi = new Uint8Array(rw * rh);
for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
  const k = (j + ry0) * g.w + (i + rx0), v = keep.hand[k];
  if (Number.isFinite(v) && g.data[k] > 0) handRoi[j * rw + i] = Math.min(254, Math.round(v * 4));
  obsRoi[j * rw + i] = obs[k];
}
// D8 empaquetado de toda la malla
const dirPacked = new Uint8Array(Math.ceil((g.w * g.h) / 2));
for (let k = 0; k < g.w * g.h; k++) { const d = keep.dir[k] === 255 ? 15 : keep.dir[k]; dirPacked[k >> 1] |= k & 1 ? d << 4 : d; }

// Cauces trazados como polilíneas (cortadas al cambiar de clase de cuenca)
const CLASSES = [5, 25, 100, 400, Infinity], cls = (km2) => CLASSES.findIndex((c) => km2 < c);
const DRAW_KM2 = 5, drawCells = Math.round((DRAW_KM2 * 1e6) / (cellM * cellM));
const isStream = (k) => keep.acc[k] >= drawCells, inflow = new Uint8Array(g.w * g.h);
for (let k = 0; k < g.w * g.h; k++) { if (!isStream(k) || keep.dir[k] === 255) continue; const n = (((k / g.w) | 0) + DJ[keep.dir[k]]) * g.w + (k % g.w) + DI[keep.dir[k]]; inflow[n] = 1; }
const seen = new Uint8Array(g.w * g.h), feats = [];
for (let k0 = 0; k0 < g.w * g.h; k0++) {
  if (!isStream(k0) || inflow[k0]) continue; // empieza en cabeceras
  let k = k0, line = [toLonLat((k % g.w) + 0.5, ((k / g.w) | 0) + 0.5)], c = cls(keep.acc[k] * cellKm2);
  while (true) {
    const d = keep.dir[k]; if (d === 255) break;
    const n = (((k / g.w) | 0) + DJ[d]) * g.w + (k % g.w) + DI[d]; const pt = toLonLat((n % g.w) + 0.5, ((n / g.w) | 0) + 0.5); line.push(pt);
    const cn = cls(keep.acc[n] * cellKm2);
    if (cn !== c || seen[n]) { feats.push({ type: 'Feature', properties: { clase: c, km2: Math.round(keep.acc[k] * cellKm2) }, geometry: { type: 'LineString', coordinates: line } }); line = [pt]; c = cn; if (seen[n]) break; }
    seen[n] = 1; k = n;
  }
  if (line.length > 1) feats.push({ type: 'Feature', properties: { clase: c, km2: Math.round(keep.acc[k] * cellKm2) }, geometry: { type: 'LineString', coordinates: line } });
}

const corner = (px, py) => gridToLonLat(g, px, py).map((v) => +v.toFixed(6));
const meta = {
  caso: "DANA de Valencia, 29-10-2024 · l'Horta Sud",
  basis: 'MODEL_CALIBRATED_AGAINST_OBSERVED',
  generadoUTC: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  metodo: {
    relleno: 'Priority-Flood+ε (Barnes, Lehman y Mulla 2014)', direccion: 'D8 (O’Callaghan y Mark 1984)',
    hand: 'Height Above Nearest Drainage (Rennó et al. 2008; Nobre et al. 2011, 2016)', acuerdo: 'CSI = A/(A+B+C) (Bates y De Roo 2000)',
    limites: [
      'Relieve de Terrain Tiles (≈ 30 m), sin diques, puentes, colectores ni edificios.',
      'HAND es estático: ordena qué se inunda antes, no da calados ni horas.',
      'El nivel se CALIBRA con la mancha observada: no es una predicción hecha antes del suceso.',
      'La mancha de Copernicus es del 31-10-2024 10:22 UTC, unas 44 h después del inicio: parte del agua ya se había retirado.',
      'ROI = rectángulo que envuelve la mancha de AOI03 (el perímetro exacto del área cartografiada no está en el repo).',
      'El Turia y otros ríos que entran por el borde oeste llegan sin su cuenca de aguas arriba.',
    ],
  },
  malla: { z: Z, x0: g.x0, y0: g.y0, size: g.size, w: g.w, h: g.h, celdaM: +cellM.toFixed(2), bbox: BBOX, esquinas: [corner(0, 0), corner(g.w, 0), corner(g.w, g.h), corner(0, g.h)] },
  roi: { px: [rx0, ry0], w: rw, h: rh, bbox: roiBox.map((v) => +v.toFixed(5)), esquinas: [corner(rx0, ry0), corner(rx1, ry0), corner(rx1, ry1), corner(rx0, ry1)], handEscala: 'valor/4 = metros; 255 = sin dato o mar' },
  observado: { fuente: 'Copernicus EMS Rapid Mapping EMSR773 AOI03 (Horta Sud), observedEventA', imagen: aoi.properties.imagen, km2Oficial: aoi.properties.km2, celdas: obs.reduce((s, v) => s + v, 0) },
  cauceKm2: keep.streamKm2, cauceDibujoKm2: DRAW_KM2, calibracion: runs, banera: { mejor: bathBest, filas: bath },
  procedencia: { teselas: tiles.map((t) => ({ url: TILE_URL(t.z, t.x, t.y), sha256: t.sha256 })), licenciaRelieve: 'Terrain Tiles (AWS Open Data); atribuciones en https://github.com/tilezen/joerd/blob/master/docs/attribution.md', mancha: gj.features[0].properties.source },
  cita: 'Contains modified Copernicus Emergency Management Service information 2024',
};
writeFileSync(new URL('hand_roi.bin', OUT), handRoi);
writeFileSync(new URL('obs_roi.bin', OUT), obsRoi);
writeFileSync(new URL('dir_z12.bin', OUT), dirPacked);
writeFileSync(new URL('cauces.geojson', OUT), JSON.stringify({ type: 'FeatureCollection', features: feats }));
writeFileSync(new URL('hidro.json', OUT), JSON.stringify(meta, null, 1));
console.log(`ROI ${rw}×${rh}; cauces ${feats.length} tramos; ${((Date.now() - t0) / 1000).toFixed(1)} s`);

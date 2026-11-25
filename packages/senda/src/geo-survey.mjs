/**
 * SENDA · levantamiento topográfico y de edificios para cualquier zona (Explorador 3D).
 * Todo se calcula en el dispositivo a partir de datos abiertos; cada resultado dice de dónde sale.
 *
 * Fuentes y fórmulas:
 *  - Alturas: Terrain Tiles en AWS, codificación «terrarium»: h = (R·256 + G + B/256) − 32768 m
 *    (registry.opendata.aws/terrain-tiles). Resolución nominal según la zona (≈ 10–90 m; en Europa EU-DEM/SRTM):
 *    NO es topografía de precisión de obra.
 *  - Teselas web: esquema XYZ de OpenStreetMap (slippy map).
 *  - Curvas de nivel: «marching squares» con interpolación lineal en los lados de cada celda.
 *  - Sol: algoritmo de la NOAA (Solar Calculator, basado en Meeus, «Astronomical Algorithms», 1991),
 *    precisión de ~1′ en elevación para fechas recientes.
 *  - Edificios: huella y altura de OpenStreetMap vía OpenMapTiles (render_height; si falta, la estima el
 *    generador de teselas): es una PLANTA EXTERIOR, no un plano interior.
 */
const D = Math.PI / 180;

// ── Teselas ──
export const lonToTileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
export const latToTileY = (lat, z) => ((1 - Math.log(Math.tan(lat * D) + 1 / Math.cos(lat * D)) / Math.PI) / 2) * 2 ** z;
export const tileXToLon = (x, z) => (x / 2 ** z) * 360 - 180;
export const tileYToLat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) / D;
/** Teselas que cubren un rectángulo [oeste, sur, este, norte]. */
export function tilesFor([w, s, e, n], z) {
  const x0 = Math.floor(lonToTileX(w, z)), x1 = Math.floor(lonToTileX(e, z)), y0 = Math.floor(latToTileY(n, z)), y1 = Math.floor(latToTileY(s, z));
  const out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ z, x, y }); return out;
}
/** Metros por píxel de una tesela de 256 px a esa latitud y zoom. */
export const metersPerPixel = (lat, z) => (156543.03392 * Math.cos(lat * D)) / 2 ** z;

/** Decodifica una imagen RGBA «terrarium» en alturas (Float32Array, metros). */
export function decodeTerrarium(rgba) {
  const n = rgba.length / 4, h = new Float32Array(n);
  for (let i = 0; i < n; i++) h[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768;
  return h;
}

/**
 * Junta teselas decodificadas en una malla: tiles = [{x, y, heights (256×256)}] del mismo zoom.
 * Devuelve { w, h, data, z, x0, y0 } con la esquina superior izquierda en coordenadas de tesela.
 */
export function mosaic(tiles, z, size = 256) {
  const xs = tiles.map((t) => t.x), ys = tiles.map((t) => t.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = (Math.max(...xs) - x0 + 1) * size, h = (Math.max(...ys) - y0 + 1) * size, data = new Float32Array(w * h).fill(NaN);
  for (const t of tiles) {
    const ox = (t.x - x0) * size, oy = (t.y - y0) * size;
    for (let r = 0; r < size; r++) data.set(t.heights.subarray(r * size, (r + 1) * size), (oy + r) * w + ox);
  }
  return { w, h, data, z, x0, y0, size };
}
/** Píxel de malla → [lon, lat]. */
export const gridToLonLat = (g, px, py) => [tileXToLon(g.x0 + px / g.size, g.z), tileYToLat(g.y0 + py / g.size, g.z)];
/** Altura bilineal en [lon, lat] (NaN fuera). */
export function sampleHeight(g, [lon, lat]) {
  const px = (lonToTileX(lon, g.z) - g.x0) * g.size - 0.5, py = (latToTileY(lat, g.z) - g.y0) * g.size - 0.5;
  const i = Math.floor(px), j = Math.floor(py), fx = px - i, fy = py - j;
  if (i < 0 || j < 0 || i + 1 >= g.w || j + 1 >= g.h) return NaN;
  const a = g.data[j * g.w + i], b = g.data[j * g.w + i + 1], c = g.data[(j + 1) * g.w + i], d = g.data[(j + 1) * g.w + i + 1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Estadística del terreno de la malla (solo celdas válidas). Pendiente en grados por diferencias centrales. */
export function terrainStats(g, latMid) {
  const mpp = metersPerPixel(latMid, g.z); let min = Infinity, max = -Infinity, sum = 0, n = 0, slopeSum = 0, slopeMax = 0, sn = 0; const hist = new Uint32Array(901); // pendiente en décimas de grado
  for (let j = 1; j < g.h - 1; j++) for (let i = 1; i < g.w - 1; i++) {
    const v = g.data[j * g.w + i]; if (!Number.isFinite(v)) continue;
    min = Math.min(min, v); max = Math.max(max, v); sum += v; n++;
    const dzdx = (g.data[j * g.w + i + 1] - g.data[j * g.w + i - 1]) / (2 * mpp), dzdy = (g.data[(j + 1) * g.w + i] - g.data[(j - 1) * g.w + i]) / (2 * mpp);
    const s = Math.atan(Math.hypot(dzdx, dzdy)) / D; if (Number.isFinite(s)) { slopeSum += s; slopeMax = Math.max(slopeMax, s); sn++; hist[Math.min(900, Math.round(s * 10))]++; }
  }
  let acc = 0, p99 = NaN; for (let k = 0; k <= 900; k++) { acc += hist[k]; if (acc >= 0.99 * sn) { p99 = k / 10; break; } }
  return { minM: min, maxM: max, meanM: n ? sum / n : NaN, slopeMeanDeg: sn ? slopeSum / sn : NaN, slopeMaxDeg: slopeMax, slopeP99Deg: p99, cellM: mpp, cells: n }; // P99: robusto frente a píxeles sueltos del modelo
}

/** Equidistancia razonable para ~12–25 curvas en el desnivel dado (regla de la app). */
export function contourInterval(reliefM) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) if (reliefM / s <= 25) return s;
  return 1000;
}

/**
 * Curvas de nivel por «marching squares» sobre una subventana de la malla.
 * Devuelve FeatureCollection de LineString con propiedad `ele` (m) e `index` (curva maestra cada 5).
 */
export function contours(g, interval, { step = 1, box = null } = {}) {
  const [ix0, iy0, ix1, iy1] = box ?? [0, 0, g.w - 1, g.h - 1];
  const val = (i, j) => g.data[j * g.w + i];
  const levels = new Map(); let min = Infinity, max = -Infinity;
  for (let j = iy0; j <= iy1; j += step) for (let i = ix0; i <= ix1; i += step) { const v = val(i, j); if (Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); } }
  for (let L = Math.ceil(min / interval) * interval; L <= max; L += interval) levels.set(L, []);
  const P = (i, j) => [i, j];
  for (let j = iy0; j + step <= iy1; j += step) for (let i = ix0; i + step <= ix1; i += step) {
    const a = val(i, j), b = val(i + step, j), c = val(i + step, j + step), d = val(i, j + step);
    if (![a, b, c, d].every(Number.isFinite)) continue;
    const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
    for (const [L, segs] of levels) {
      if (L < lo || L > hi) continue;
      const pts = [];
      const edge = (v1, v2, p1, p2) => { if ((v1 < L) !== (v2 < L)) { const t = (L - v1) / (v2 - v1); pts.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]); } };
      edge(a, b, P(i, j), P(i + step, j)); edge(b, c, P(i + step, j), P(i + step, j + step)); edge(c, d, P(i + step, j + step), P(i, j + step)); edge(d, a, P(i, j + step), P(i, j));
      if (pts.length === 2) segs.push(pts); else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); }
    }
  }
  const feats = [];
  for (const [L, segs] of levels) {
    for (const line of joinSegments(segs)) feats.push({ type: 'Feature', properties: { ele: L, index: Math.round(L / interval) % 5 === 0 }, geometry: { type: 'LineString', coordinates: line.map(([x, y]) => gridToLonLat(g, x + 0.5, y + 0.5).map((v) => +v.toFixed(6))) } });
  }
  return { type: 'FeatureCollection', features: feats, interval, minM: min, maxM: max };
}

/** Une segmentos que comparten extremos en polilíneas (para dibujar y etiquetar las curvas). */
export function joinSegments(segs) {
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`, ends = new Map(), used = new Uint8Array(segs.length), out = [];
  segs.forEach((s, k) => { for (const p of s) { const kk = key(p); (ends.get(kk) ?? ends.set(kk, []).get(kk)).push(k); } });
  const take = (p, from) => (ends.get(key(p)) ?? []).find((k) => k !== from && !used[k]);
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue; used[k] = 1; const line = [...segs[k]];
    for (const dir of [1, 0]) {
      let cur = k;
      for (;;) {
        const tip = dir ? line.at(-1) : line[0], nk = take(tip, cur); if (nk == null) break; used[nk] = 1;
        const [p, q] = segs[nk], nxt = key(p) === key(tip) ? q : p; if (dir) line.push(nxt); else line.unshift(nxt); cur = nk;
      }
    }
    out.push(line);
  }
  return out;
}

/** Perfil del terreno a lo largo de una línea [[lon,lat],…] cada `stepM` metros. */
export function elevationProfile(g, line, stepM = 10) {
  const R = 6371008.8, hav = (a, b) => { const dφ = (b[1] - a[1]) * D, dλ = (b[0] - a[0]) * D; const s = Math.sin(dφ / 2) ** 2 + Math.cos(a[1] * D) * Math.cos(b[1] * D) * Math.sin(dλ / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
  const pts = []; let dist = 0;
  for (let k = 1; k < line.length; k++) {
    const a = line[k - 1], b = line[k], L = hav(a, b), n = Math.max(1, Math.ceil(L / stepM));
    for (let s = k === 1 ? 0 : 1; s <= n; s++) { const t = s / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; pts.push({ d: dist + L * t, h: sampleHeight(g, p), p }); }
    dist += L;
  }
  let up = 0, down = 0, maxSlope = 0;
  for (let k = 1; k < pts.length; k++) { const dh = pts[k].h - pts[k - 1].h, dd = pts[k].d - pts[k - 1].d; if (!Number.isFinite(dh)) continue; if (dh > 0) up += dh; else down -= dh; if (dd > 0) maxSlope = Math.max(maxSlope, Math.abs(dh / dd) * 100); }
  return { pts, lengthM: dist, ascentM: up, descentM: down, maxSlopePct: maxSlope };
}

// ── Sol (NOAA) ──
/** Posición del Sol: { azimuthDeg (desde el norte, horario), elevationDeg } para un instante UTC (ms). */
export function sunPosition(ms, lat, lon) {
  const jd = ms / 86_400_000 + 2440587.5, T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T), e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * D) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * D) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * D) * 0.000289;
  const trueLong = L0 + C, omega = 125.04 - 1934.136 * T, lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * D);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60, eps = eps0 + 0.00256 * Math.cos(omega * D);
  const decl = Math.asin(Math.sin(eps * D) * Math.sin(lambda * D));
  const y = Math.tan((eps / 2) * D) ** 2;
  const eqTime = 4 / D * (y * Math.sin(2 * L0 * D) - 2 * e * Math.sin(M * D) + 4 * e * y * Math.sin(M * D) * Math.cos(2 * L0 * D) - 0.5 * y * y * Math.sin(4 * L0 * D) - 1.25 * e * e * Math.sin(2 * M * D));
  const minutes = ((ms / 60_000) % 1440 + 1440) % 1440, tst = (minutes + eqTime + 4 * lon + 1440) % 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const cosZ = Math.sin(lat * D) * Math.sin(decl) + Math.cos(lat * D) * Math.cos(decl) * Math.cos(ha * D), zen = Math.acos(Math.min(1, Math.max(-1, cosZ)));
  let az = Math.acos(Math.min(1, Math.max(-1, (Math.sin(lat * D) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(lat * D) * Math.sin(zen))))) / D;
  az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360;
  return { azimuthDeg: az, elevationDeg: 90 - zen / D, declinationDeg: decl / D };
}

// ── Edificios: planta exterior ──
/** Medidas de una huella [[lon,lat],…] (anillo cerrado o no) en un plano local en metros. */
export function footprintMetrics(ring) {
  const r = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  const lat0 = r.reduce((s, p) => s + p[1], 0) / r.length, lon0 = r.reduce((s, p) => s + p[0], 0) / r.length;
  const mx = 111_320 * Math.cos(lat0 * D), my = 110_574; // m por grado (aprox. esférica local, < 0,5 % a escala de edificio)
  const xy = r.map(([lo, la]) => [(lo - lon0) * mx, (la - lat0) * my]);
  let A = 0, per = 0; const edges = [];
  for (let i = 0; i < xy.length; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length]; A += x1 * y2 - x2 * y1; const L = Math.hypot(x2 - x1, y2 - y1); per += L; edges.push(L); }
  return { areaM2: Math.abs(A) / 2, perimeterM: per, edgesM: edges, xy, centroid: [lon0, lat0] };
}

/** Planta exterior en SVG con cotas de cada lado, norte y escala gráfica. */
export function footprintSvg(ring, { title = 'Planta exterior', heightM = null, groundM = null, source = '' } = {}) {
  const m = footprintMetrics(ring), xs = m.xy.map((p) => p[0]), ys = m.xy.map((p) => p[1]);
  const W = 600, H = 600, pad = 70, span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1), k = (W - 2 * pad) / span;
  const tx = (x) => pad + (x - Math.min(...xs)) * k, ty = (y) => H - pad - (y - Math.min(...ys)) * k;
  const pts = m.xy.map(([x, y]) => `${tx(x).toFixed(1)},${ty(y).toFixed(1)}`).join(' ');
  const dims = m.xy.map(([x1, y1], i) => { const [x2, y2] = m.xy[(i + 1) % m.xy.length]; return `<text x="${((tx(x1) + tx(x2)) / 2).toFixed(1)}" y="${((ty(y1) + ty(y2)) / 2 - 4).toFixed(1)}" font-size="12" text-anchor="middle" fill="#1a56c4">${m.edgesM[i].toFixed(2)} m</text>`; }).join('');
  const bar = [1, 2, 5, 10, 20, 50, 100].find((v) => v * k >= 60) ?? 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 60}" viewBox="0 0 ${W} ${H + 60}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/>
<polygon points="${pts}" fill="#e8f0fe" stroke="#1c1c1e" stroke-width="2"/>${dims}
<g transform="translate(${W - 40},40)"><path d="M0 -22 L8 6 L0 0 L-8 6 Z" fill="#1c1c1e"/><text y="22" text-anchor="middle" font-size="13" font-weight="700">N</text></g>
<g transform="translate(${pad},${H - 20})"><rect width="${(bar * k).toFixed(1)}" height="6" fill="#1c1c1e"/><text y="20" font-size="12">${bar} m</text></g>
<text x="${pad}" y="${H + 14}" font-size="14" font-weight="700">${title}</text>
<text x="${pad}" y="${H + 32}" font-size="12">Superficie en planta ${m.areaM2.toFixed(1)} m² · perímetro ${m.perimeterM.toFixed(1)} m${heightM != null ? ` · altura ${heightM} m` : ''}${groundM != null ? ` · cota del suelo ≈ ${Math.round(groundM)} m` : ''}</text>
<text x="${pad}" y="${H + 50}" font-size="10" fill="#6e6e73">${source} · planta EXTERIOR (huella), no plano interior · cotas en plano local, error &lt; 0,5 %</text></svg>`;
}

/** Planta exterior en DXF mínimo (R12, LWPOLYLINE en metros locales) para abrir en CAD. */
export function footprintDxf(ring) {
  const m = footprintMetrics(ring);
  const v = m.xy.map(([x, y]) => `10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}`).join('\n');
  return `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nHUELLA\n90\n${m.xy.length}\n70\n1\n${v}\n0\nENDSEC\n0\nEOF\n`;
}

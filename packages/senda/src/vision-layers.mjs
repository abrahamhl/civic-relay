/**
 * SENDA · Visión por capas sobre la cámara del teléfono.
 *
 * Convierte el estado fusionado (probabilidades por vivienda, señales, estructura, terreno)
 * en PRIMITIVAS DE DIBUJO en píxeles de la cámara, con la proyección pinhole de
 * `rubble.projectToCamera`. Es determinista y se prueba sin navegador; la página solo pinta.
 *
 * Capas (combinables, cada una con su opacidad):
 *  - PROBABILIDAD  «calor» en falsa color de P(persona) por vivienda. NO es imagen térmica.
 *  - ESPECTRO      cada familia de señal con su color: routers, teléfonos, CSI, sonido, respuestas.
 *  - ESTRUCTURA    alambre tipo «Matrix»: forjados y aristas del edificio; plantas dañadas en rojo.
 *  - TOPOGRAFIA    malla del terreno con curvas de nivel (función de altura opcional, p. ej. MDT del IGN).
 *  - TERMICA       solo con una cámara térmica REAL conectada: puntos calientes compatibles con
 *                  una persona. Ve a través del humo; no a través de muros.
 * Cada primitiva lleva `layer` y `honest` (qué es y qué no es) para la leyenda.
 */
import { projectToCamera } from './rubble.mjs';
import { FLOOR_HEIGHT_M } from './building-twin.mjs';

export const LAYERS = Object.freeze({
  PROBABILIDAD: { label: 'Probabilidad de persona', honest: 'Mapa calculado por el motor de fusión. No es una imagen térmica.' },
  ESPECTRO: { label: 'Espectro de señales', honest: 'Dónde está cada señal de radio o sonido detectada, con su incertidumbre.' },
  ESTRUCTURA: { label: 'Estructura (alambre)', honest: 'Geometría del gemelo digital (OSM/Catastro o demostración); plantas dañadas según EMS-98.' },
  TOPOGRAFIA: { label: 'Topografía', honest: 'Malla del terreno; con red se sustituye por el MDT del IGN.' },
  TERMICA: { label: 'Térmica real', honest: 'Solo con cámara térmica conectada. Ve a través del humo, no de paredes.' },
});

export const SPECTRUM_COLORS = Object.freeze({ ROUTER: '#34d399', GATEWAY: '#91d7e8', PHONE_RF: '#22d3ee', BODY_RF: '#e879f9', ACOUSTIC: '#fbbf24', THERMAL: '#fb7185', RESPONSE: '#ff3b4e', SEARCH: '#94a3b8' });

/** Rampa perceptual tipo «magma» (negro → violeta → naranja → amarillo claro). */
export function probabilityColor(p) {
  const stops = [[0, [8, 6, 30]], [0.25, [80, 18, 123]], [0.5, [182, 54, 121]], [0.75, [251, 136, 97]], [1, [252, 253, 191]]];
  const t = Math.max(0, Math.min(1, p));
  let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i], [t1, c1] = stops[i + 1], k = (t - t0) / (t1 - t0);
  const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
  return { r: c[0], g: c[1], b: c[2], css: `rgb(${c[0]},${c[1]},${c[2]})` };
}

function proj(pt, cam) { const r = projectToCamera(pt, cam); return r.reason === 'BEHIND_CAMERA' ? null : r; }
function line(a, b, cam) { const pa = proj(a, cam), pb = proj(b, cam); return pa && pb ? [[pa.u, pa.v], [pb.u, pb.v]] : null; }
const inFrame = (r, cam) => r && r.u >= -50 && r.u <= cam.width + 50 && r.v >= -50 && r.v <= cam.height + 50;

/**
 * @param {object} s estado: { building:{local,levels,bbox}, fusion?, aps?, cellEvidence?, damagedFloors?, terrain?(x,y)→z, thermal? }
 * @param {object} cam cámara de `projectToCamera` ({pos,yaw,pitch,hfovRad,width,height})
 * @param {Object<string,number>} layers capas activas con su opacidad (0–1)
 * @param {{labelTop?:number}} [opts] cuántas viviendas prioritarias se rotulan (el resto solo color)
 */
export function composeLayers(s, cam, layers, opts = {}) {
  const prims = [];
  const f = (cam.width / 2) / Math.tan((cam.hfovRad ?? 1.2) / 2);
  const add = (layer, p) => prims.push({ layer, alpha: layers[layer], ...p });

  if (layers.TOPOGRAFIA) {
    const { minX, maxX, minY, maxY } = s.building.bbox, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, h = s.terrain ?? (() => 0), step = 10, R = 60;
    for (let k = -R; k <= R; k += step) {
      for (const [a, b] of [[{ x: cx - R, y: cy + k }, { x: cx + R, y: cy + k }], [{ x: cx + k, y: cy - R }, { x: cx + k, y: cy + R }]]) {
        const pts = [];
        for (let t = 0; t <= 12; t++) { const x = a.x + ((b.x - a.x) * t) / 12, y = a.y + ((b.y - a.y) * t) / 12, r = proj({ x, y, z: h(x, y) }, cam); if (r) pts.push([r.u, r.v]); }
        if (pts.length > 1) add('TOPOGRAFIA', { kind: 'poly', points: pts, color: '#1f8a5b', width: 1 });
      }
    }
  }

  if (layers.ESTRUCTURA) {
    const fp = s.building.local, damaged = new Set(s.damagedFloors ?? []);
    for (let fl = 0; fl <= s.building.levels; fl++) {
      const z = fl * FLOOR_HEIGHT_M, pts = fp.map((p) => proj({ x: p.x, y: p.y, z }, cam)).filter(Boolean).map((r) => [r.u, r.v]);
      if (pts.length > 1) add('ESTRUCTURA', { kind: 'poly', points: pts, color: damaged.has(fl) || damaged.has(fl - 1) ? '#ff3b4e' : '#00ff9c', width: fl === 0 || fl === s.building.levels ? 2 : 1 });
    }
    for (const p of fp.slice(0, -1)) { const l = line({ x: p.x, y: p.y, z: 0 }, { x: p.x, y: p.y, z: s.building.levels * FLOOR_HEIGHT_M }, cam); if (l) add('ESTRUCTURA', { kind: 'poly', points: l, color: '#00ff9c', width: 1 }); }
  }

  if (layers.PROBABILIDAD && s.fusion) {
    const blobs = [], labelled = new Set((s.fusion.ranked ?? s.fusion.cells).slice(0, opts.labelTop ?? 5).map((c) => c.id));
    for (const c of s.fusion.cells) {
      if (c.p < 0.05) continue;
      const r = proj(c.center, cam); if (!inFrame(r, cam)) continue;
      const col = probabilityColor(c.p);
      blobs.push({ kind: 'glow', alpha: (layers.PROBABILIDAD ?? 1) * (0.35 + 0.65 * (c.risk ?? 1)), u: r.u, v: r.v, r: Math.max(8, (c.halfM / Math.max(0.5, r.depthM)) * f * 0.9), color: col.css, depth: r.depthM, p: c.p, cellId: c.id,
        text: !labelled.has(c.id) ? null : c.badge98 ? `${c.id} · ≥98 % · ${c.families.length} fuentes` : `${c.id} · ${Math.round(c.p * 100)} % [${Math.round(c.lo * 100)}–${Math.round(c.hi * 100)}]` });
    }
    blobs.sort((a, b) => b.depth - a.depth).forEach((b) => add('PROBABILIDAD', b));
  }

  if (layers.ESPECTRO) {
    for (const a of s.aps ?? []) {
      if (!a.position || a.state === 'LOST') continue;
      const r = proj(a.position, cam); if (!inFrame(r, cam)) continue;
      add('ESPECTRO', { kind: 'dot', u: r.u, v: r.v, r: a.gateway ? 4 : 3, color: a.gateway ? SPECTRUM_COLORS.GATEWAY : SPECTRUM_COLORS.ROUTER, family: a.gateway ? 'GATEWAY' : 'ROUTER' });
    }
    for (const per of s.persons ?? []) {
      if (!per.phoneFix || per.status) continue;
      const r = proj(per.phoneFix, cam); if (!inFrame(r, cam)) continue;
      add('ESPECTRO', { kind: 'ring', u: r.u, v: r.v, r: Math.min(60, Math.max(6, ((per.phoneFix.errorM ?? 3) / Math.max(0.5, r.depthM)) * f)), color: SPECTRUM_COLORS.PHONE_RF, family: 'PHONE_RF' });
    }
    for (const e of s.cellEvidence ?? []) {
      const r = proj(e.at, cam); if (!inFrame(r, cam)) continue;
      add('ESPECTRO', { kind: 'ring', u: r.u, v: r.v, r: Math.min(80, Math.max(6, (e.radiusM / Math.max(0.5, r.depthM)) * f * 0.6)), color: SPECTRUM_COLORS[e.family], dashed: !e.detected, family: e.family });
    }
  }

  if (layers.TERMICA && s.thermal) for (const h of s.thermal.hotspots) add('TERMICA', { kind: 'box', ...h.box, color: SPECTRUM_COLORS.THERMAL, text: `${h.maxC.toFixed(1)} °C` });

  const byLayer = prims.reduce((m, p) => ((m[p.layer] = (m[p.layer] ?? 0) + 1), m), {});
  return { primitives: prims, byLayer, legend: Object.keys(layers).filter((k) => layers[k]).map((k) => ({ layer: k, ...LAYERS[k] })) };
}

/**
 * Puntos calientes de un fotograma radiométrico (°C por píxel) de una cámara térmica real.
 * Componentes conexas (4-vecinos) dentro del rango de temperatura de piel expuesta tras humo.
 */
export function thermalHotspots({ w, h, data }, { minC = 28, maxC = 40, minPixels = 12 } = {}) {
  const seen = new Uint8Array(w * h), out = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || data[i] < minC || data[i] > maxC) continue;
    const stack = [i]; seen[i] = 1; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, mx = -Infinity;
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j / w) | 0; n++; mx = Math.max(mx, data[j]);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const k of [j - 1, j + 1, j - w, j + w]) {
        if (k < 0 || k >= w * h || seen[k] || (k === j - 1 && x === 0) || (k === j + 1 && x === w - 1)) continue;
        if (data[k] >= minC && data[k] <= maxC) { seen[k] = 1; stack.push(k); }
      }
    }
    if (n >= minPixels) out.push({ pixels: n, maxC: mx, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } });
  }
  return out.sort((a, b) => b.pixels - a.pixels);
}

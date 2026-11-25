/**
 * SENDA · radar de personas mmWave de bajo coste (Ai-Thinker RD-03D / Hi-Link LD2450, 24 GHz, hasta 3 objetivos en movimiento).
 *
 * Protocolo (verificado en código abierto, no en folleto):
 *  - Firmware de Sudo_solder (GitHub Stevee87/Arduino-ESP32-Radarproject, v1.1, licencia MIT, © 2026 Sudo_solder):
 *    UART 256000 8N1; trama de datos AA FF 03 00 · 3 × 8 bytes · 55 CC (30 bytes); cada objetivo: x, y (mm),
 *    velocidad (cm/s) y resolución de distancia, 16 bits little-endian; bit 15 = 1 → positivo, 0 → negativo.
 *    Modo multiobjetivo con la cadena de órdenes FD FC FB FA (abrir configuración · 0x90 · cerrar).
 *  - Coincide con el crate ld2450-proto (docs.rs), que documenta la misma convención de signo.
 * Lo que este módulo añade: seguimiento por filtro de Kalman de velocidad constante, asignación ÓPTIMA (con ≤ 3 objetivos
 * se prueban todas las permutaciones), identificadores estables, proyección al mapa con la orientación fusionada y
 * calibración del ángulo de montaje. Umbrales y ruidos: los pasa quien llama (sin valores por defecto).
 *
 * Límites físicos declarados: el módulo es Doppler/FMCW de 24 GHz de baja resolución; detecta lo que SE MUEVE (una persona
 * quieta puede desaparecer), no atraviesa escombros ni muros gruesos y NO distingue una persona de un perro por sí solo.
 */
export const CMD = Object.freeze({
  ENABLE_CONFIG: Uint8Array.from([0xfd, 0xfc, 0xfb, 0xfa, 0x04, 0x00, 0xff, 0x00, 0x01, 0x00, 0x04, 0x03, 0x02, 0x01]),
  MULTI_TARGET: Uint8Array.from([0xfd, 0xfc, 0xfb, 0xfa, 0x02, 0x00, 0x90, 0x00, 0x04, 0x03, 0x02, 0x01]),
  END_CONFIG: Uint8Array.from([0xfd, 0xfc, 0xfb, 0xfa, 0x02, 0x00, 0xfe, 0x00, 0x04, 0x03, 0x02, 0x01]),
});
export const SERIAL = Object.freeze({ baudRate: 256000, dataBits: 8, stopBits: 1, parity: 'none' });
const HDR = [0xaa, 0xff, 0x03, 0x00], TAIL = [0x55, 0xcc];

/** Valor de 16 bits del RD-03D/LD2450: bit 15 activo = positivo, inactivo = negativo. */
export const decodeVal = (lo, hi) => { const raw = lo | (hi << 8); return raw >= 0x8000 ? raw - 0x8000 : -raw; };
export const encodeVal = (v) => { const raw = v >= 0 ? v + 0x8000 : -v; return [raw & 0xff, (raw >> 8) & 0xff]; };

/** Decodifica los 24 bytes de carga: hasta 3 objetivos { xMm, yMm, speedCms, resMm } (huecos a cero se omiten). */
export function decodePayload(p) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const b = p.subarray ? p.subarray(i * 8, i * 8 + 8) : p.slice(i * 8, i * 8 + 8);
    if (b.every((x) => x === 0)) continue;
    out.push({ slot: i, xMm: decodeVal(b[0], b[1]), yMm: decodeVal(b[2], b[3]), speedCms: decodeVal(b[4], b[5]), resMm: b[6] | (b[7] << 8) });
  }
  return out;
}
/** Construye una trama de 30 bytes (para pruebas, simulación y repetición de grabaciones). */
export function encodeFrame(targets) {
  const f = [...HDR];
  for (let i = 0; i < 3; i++) { const t = targets[i]; f.push(...(t ? [...encodeVal(t.xMm), ...encodeVal(t.yMm), ...encodeVal(t.speedCms), (t.resMm ?? 0) & 0xff, ((t.resMm ?? 0) >> 8) & 0xff] : [0, 0, 0, 0, 0, 0, 0, 0])); }
  f.push(...TAIL); return Uint8Array.from(f);
}

/** Lector de flujo: admite trozos de cualquier tamaño, se resincroniza con la cabecera y descarta tramas sin cierre 55 CC. */
export function createFrameParser(onFrame) {
  let hdr = 0, inFrame = false, pl = new Uint8Array(26), idx = 0, ok = 0, bad = 0;
  return {
    push(bytes) {
      for (const c of bytes) {
        if (!inFrame) { if (c === HDR[hdr]) { hdr++; if (hdr === 4) { hdr = 0; inFrame = true; idx = 0; } } else hdr = c === HDR[0] ? 1 : 0; continue; }
        pl[idx++] = c;
        if (idx === 26) { inFrame = false; if (pl[24] === TAIL[0] && pl[25] === TAIL[1]) { ok++; onFrame(decodePayload(pl.slice(0, 24))); } else bad++; }
      }
    },
    stats: () => ({ ok, bad }),
  };
}

/** Filtro de alcance y fusión de ecos cercanos (p. ej. torso y brazo de la misma persona). Parámetros obligatorios. */
export function cleanTargets(targets, { minMm, maxMm, mergeMm }) {
  if (![minMm, maxMm, mergeMm].every((v) => v >= 0)) throw new Error('faltan minMm, maxMm o mergeMm (sin valores por defecto)');
  const t = targets.filter((o) => { const d = Math.hypot(o.xMm, o.yMm); return d > minMm && d <= maxMm; }).map((o) => ({ ...o }));
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
    if (!t[i] || !t[j]) continue;
    if (Math.hypot(t[i].xMm - t[j].xMm, t[i].yMm - t[j].yMm) < mergeMm) {
      t[i].xMm = (t[i].xMm + t[j].xMm) / 2; t[i].yMm = (t[i].yMm + t[j].yMm) / 2;
      if (Math.abs(t[j].speedCms) > Math.abs(t[i].speedCms)) t[i].speedCms = t[j].speedCms; // conserva la velocidad de mayor módulo
      t[j] = null;
    }
  }
  return t.filter(Boolean);
}

function permutations(n) { if (n <= 1) return [[0].slice(0, n)]; const out = []; const rec = (a, used) => { if (a.length === n) return out.push(a.slice()); for (let i = 0; i < n; i++) if (!used[i]) { used[i] = 1; a.push(i); rec(a, used); a.pop(); used[i] = 0; } }; rec([], []); return out; }

/**
 * Seguimiento multiobjetivo: Kalman de velocidad constante por pista (estado x, y, vx, vy en mm y mm/s) y asignación
 * óptima por coste mínimo total dentro de una puerta. cfg obligatorio:
 *   gateMm (puerta de asociación), qMmS2 (ruido de aceleración, mm/s²), rMm (ruido de medida, mm), maxMissS (s sin ver → baja)
 */
export function createTracker(cfg) {
  for (const k of ['gateMm', 'qMmS2', 'rMm', 'maxMissS']) if (!(cfg?.[k] > 0)) throw new Error(`falta ${k} (sin valor por defecto)`);
  let tracks = [], nextId = 1, lastT = null;
  const predict = (tr, dt) => {
    const [x, y, vx, vy] = tr.s; tr.s = [x + vx * dt, y + vy * dt, vx, vy];
    const P = tr.P, q = cfg.qMmS2 ** 2, dt2 = dt * dt, dt3 = dt2 * dt / 2, dt4 = dt2 * dt2 / 4;
    for (const [p, v] of [[0, 2], [1, 3]]) { // ejes independientes: [[Ppp, Ppv], [Ppv, Pvv]]
      const Ppp = P[p][p] + 2 * dt * P[p][v] + dt2 * P[v][v] + q * dt4, Ppv = P[p][v] + dt * P[v][v] + q * dt3, Pvv = P[v][v] + q * dt2;
      P[p][p] = Ppp; P[p][v] = P[v][p] = Ppv; P[v][v] = Pvv;
    }
  };
  const update = (tr, z) => {
    const P = tr.P, R = cfg.rMm ** 2;
    for (const [p, v, zi] of [[0, 2, z.xMm], [1, 3, z.yMm]]) {
      const S = P[p][p] + R, Kp = P[p][p] / S, Kv = P[v][p] / S, inn = zi - tr.s[p];
      tr.s[p] += Kp * inn; tr.s[v] += Kv * inn;
      const Ppp = (1 - Kp) * P[p][p], Ppv = (1 - Kp) * P[p][v], Pvv = P[v][v] - Kv * P[p][v];
      P[p][p] = Ppp; P[p][v] = P[v][p] = Ppv; P[v][v] = Pvv;
    }
  };
  return {
    /** dets: objetivos limpios de una trama; tS: tiempo en segundos. Devuelve las pistas vivas. */
    step(dets, tS) {
      const dt = lastT == null ? 0 : Math.max(0, tS - lastT); lastT = tS;
      for (const tr of tracks) predict(tr, dt);
      // Asignación óptima (≤ 3 × ≤ 3): mínima suma de distancias dentro de la puerta; lo que no entra crea/omite
      const n = tracks.length, m = dets.length; let best = { cost: Infinity, pairs: [] };
      const idx = [...Array(Math.max(n, m)).keys()];
      for (const perm of permutations(idx.length)) {
        let cost = 0; const pairs = [];
        for (let i = 0; i < n; i++) { const j = perm[i]; if (j >= m) continue; const d = Math.hypot(tracks[i].s[0] - dets[j].xMm, tracks[i].s[1] - dets[j].yMm); if (d <= cfg.gateMm) { cost += d; pairs.push([i, j]); } }
        cost += (Math.min(n, m) - pairs.length) * cfg.gateMm; // no asociar cuesta como la puerta
        if (cost < best.cost) best = { cost, pairs };
      }
      const usedD = new Set();
      for (const [i, j] of best.pairs) { update(tracks[i], dets[j]); tracks[i].lastSeen = tS; tracks[i].hits++; tracks[i].speedCms = dets[j].speedCms; usedD.add(j); }
      dets.forEach((d, j) => { if (!usedD.has(j)) tracks.push({ id: nextId++, s: [d.xMm, d.yMm, 0, 0], P: [[cfg.rMm ** 2, 0, 0, 0], [0, cfg.rMm ** 2, 0, 0], [0, 0, 2e6, 0], [0, 0, 0, 2e6]], lastSeen: tS, born: tS, hits: 1, speedCms: d.speedCms, trail: [] }); });
      tracks = tracks.filter((tr) => tS - tr.lastSeen <= cfg.maxMissS);
      for (const tr of tracks) { tr.trail.push([tr.s[0], tr.s[1]]); if (tr.trail.length > 60) tr.trail.shift(); }
      return tracks.map((tr) => ({ id: tr.id, xMm: tr.s[0], yMm: tr.s[1], vxMms: tr.s[2], vyMms: tr.s[3], speedCms: tr.speedCms, sigmaMm: Math.sqrt((tr.P[0][0] + tr.P[1][1]) / 2), hits: tr.hits, ageS: tS - tr.born, coasting: tr.lastSeen < tS, trail: tr.trail.slice() }));
    },
  };
}

/**
 * Del sistema del radar (x a la derecha, y hacia delante, mm) a coordenadas geográficas.
 * pose: { lon, lat, headingDeg (hacia dónde mira el radar, 0 = norte), mountYawDeg (corrección de montaje) }
 */
export function radarToLonLat({ xMm, yMm }, { lon, lat, headingDeg, mountYawDeg = 0 }) {
  const th = ((headingDeg + mountYawDeg) * Math.PI) / 180, x = xMm / 1000, y = yMm / 1000;
  const e = x * Math.cos(th) + y * Math.sin(th), n = -x * Math.sin(th) + y * Math.cos(th);
  return [lon + e / (111320 * Math.cos((lat * Math.PI) / 180)), lat + n / 110574];
}

/**
 * Calibración del ángulo de montaje: una persona camina por una línea de rumbo CONOCIDO (p. ej. un borde de acera
 * en el mapa); se compara con el rumbo medido en el radar. Devuelve la corrección media circular y su dispersión.
 * pairs: [{ measuredDeg, trueDeg }]
 */
export function calibrateMountYaw(pairs) {
  if (!pairs?.length) throw new Error('hacen falta pares medido/real');
  let sx = 0, sy = 0;
  for (const { measuredDeg, trueDeg } of pairs) { const d = ((trueDeg - measuredDeg) * Math.PI) / 180; sx += Math.sin(d); sy += Math.cos(d); }
  const r = Math.hypot(sx, sy) / pairs.length, mean = (Math.atan2(sx, sy) * 180) / Math.PI;
  return { mountYawDeg: +mean.toFixed(2), circularSpreadDeg: +((Math.sqrt(-2 * Math.log(Math.max(r, 1e-12))) * 180) / Math.PI).toFixed(2), n: pairs.length };
}

/**
 * Rumbo de la marcha en el sistema del radar a partir de la estela (eje principal por componentes principales,
 * orientado del primer punto al último). 0° = eje y del radar (al frente), sentido horario hacia +x.
 */
export function trackBearingDeg(trail) {
  if (!trail || trail.length < 3) throw new Error('hacen falta al menos 3 puntos de estela');
  const n = trail.length, mx = trail.reduce((s, p) => s + p[0], 0) / n, my = trail.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of trail) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); let ux = Math.cos(th), uy = Math.sin(th);
  const dx = trail[n - 1][0] - trail[0][0], dy = trail[n - 1][1] - trail[0][1];
  if (ux * dx + uy * dy < 0) { ux = -ux; uy = -uy; }
  const lam1 = (sxx + syy) / 2 + Math.hypot((sxx - syy) / 2, sxy), lam2 = (sxx + syy) / 2 - Math.hypot((sxx - syy) / 2, sxy);
  return { bearingDeg: (((Math.atan2(ux, uy) * 180) / Math.PI) + 360) % 360, lateralRmsMm: Math.sqrt(Math.max(0, lam2) / n), lengthMm: Math.sqrt(Math.max(0, lam1) / n) * Math.sqrt(12) };
}

/**
 * Calibración de distancia con cinta métrica: una persona se mueve suavemente sobre marcas a distancias conocidas.
 * Ajuste por mínimos cuadrados d_real = escala · d_medida + sesgo. pairs: [{ measuredMm, trueMm }] (≥ 2 distancias distintas).
 */
export function calibrateRange(pairs) {
  if (!pairs || pairs.length < 2) throw new Error('hacen falta al menos 2 pares medido/real');
  const n = pairs.length, mx = pairs.reduce((s, p) => s + p.measuredMm, 0) / n, my = pairs.reduce((s, p) => s + p.trueMm, 0) / n;
  let sxx = 0, sxy = 0; for (const p of pairs) { sxx += (p.measuredMm - mx) ** 2; sxy += (p.measuredMm - mx) * (p.trueMm - my); }
  if (sxx === 0) throw new Error('las distancias medidas son todas iguales: no se puede ajustar la escala');
  const scale = sxy / sxx, biasMm = my - scale * mx;
  const rmsMm = Math.sqrt(pairs.reduce((s, p) => s + (p.trueMm - (scale * p.measuredMm + biasMm)) ** 2, 0) / n);
  return { scale: +scale.toFixed(5), biasMm: +biasMm.toFixed(1), residualRmsMm: +rmsMm.toFixed(1), n };
}

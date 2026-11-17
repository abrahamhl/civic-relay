/**
 * SENDA VIGÍA · Consenso físico entre sensores baratos.
 *
 * Problema: una cámara térmica de 32×24 px, un micrófono de 1 € o una dashcam dan falsas alarmas
 * (un tubo de escape, un portazo, un reflejo) y cualquiera puede manipular un nodo. Por eso ningún
 * organismo actúa con la palabra de UN sensor barato.
 *
 * Idea: un suceso real obedece la física en TODOS los nodos que lo perciben a la vez. Un fuego visto
 * por tres térmicas desde sitios distintos da tres rumbos que se cortan en un punto; un estallido o un
 * derrumbe llega a cada micrófono con retrasos que cuadran con la velocidad del sonido a ESA
 * temperatura. Vigía busca el punto que más observaciones independientes explican (consenso tipo
 * RANSAC, exhaustivo porque los grupos son pequeños), descarta como INCOHERENTE a quien no cuadra
 * (nodo averiado o manipulado) y solo eleva el nivel cuando hay nodos y modalidades independientes.
 *
 * Privacidad por diseño: del nodo sale un SUCESO (tipo, rumbo o instante, temperatura pico), nunca
 * imagen ni audio. `buildEvent` rechaza cualquier campo de datos en bruto.
 *
 * Coordenadas locales en metros (x = este, y = norte). Rumbos en grados de brújula (0 = norte, 90 = este).
 */
import { multilaterate } from './senses.mjs';
import { toCap } from './interop.mjs';

const RAD = Math.PI / 180;
const subtle = globalThis.crypto.subtle;

/** Velocidad del sonido en aire seco (m/s): c = 331,3·√(1 + T/273,15). A 35 °C es 352 m/s, no 343. */
export function speedOfSound(tempC = 20) {
  if (!(tempC > -60 && tempC < 70)) throw new RangeError('temperatura fuera de rango');
  return 331.3 * Math.sqrt(1 + tempC / 273.15);
}

/* ───────────────────────────── 1. Térmica (MLX90640 y similares) ───────────────────────────── */

/**
 * Puntos calientes en un fotograma térmico (°C, fila a fila). Ambiente = mediana del fotograma.
 * Caliente = supera ambiente + dT Y el umbral absoluto. Agrupa píxeles vecinos (4-conexión).
 */
export function fireHotspots(frame, { w = 32, h = 24, dT = 25, absC = 60, minPixels = 1 } = {}) {
  if (frame.length !== w * h) throw new RangeError(`fotograma de ${frame.length} px, esperaba ${w}×${h}`);
  const sorted = [...frame].sort((a, b) => a - b), ambient = sorted[Math.floor(sorted.length / 2)];
  const thr = Math.max(ambient + dT, absC), seen = new Uint8Array(w * h), spots = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || !(frame[i] >= thr)) continue;
    const stack = [i], px = []; seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j / w) | 0; px.push(j);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx; if (!seen[k] && frame[k] >= thr) { seen[k] = 1; stack.push(k); }
      }
    }
    if (px.length < minPixels) continue;
    let sw = 0, sx = 0, sy = 0, peak = -Infinity;
    for (const j of px) { const wt = frame[j] - ambient; sw += wt; sx += wt * (j % w); sy += wt * ((j / w) | 0); peak = Math.max(peak, frame[j]); }
    spots.push({ col: sx / sw, row: sy / sw, pixels: px.length, peakC: peak });
  }
  return { ambientC: ambient, thresholdC: thr, spots: spots.sort((a, b) => b.peakC - a.peakC) };
}

/** Rumbo de brújula de una columna (modelo estenopeico). MLX90640: variantes de 55° y 110° de campo horizontal. */
export function bearingFromColumn(col, { w = 32, fovDeg = 55, headingDeg = 0 } = {}) {
  const u = (col + 0.5 - w / 2) / (w / 2);
  return (((headingDeg + Math.atan(u * Math.tan((fovDeg / 2) * RAD)) / RAD) % 360) + 360) % 360;
}

/* ───────────────────────────── 2. Geometría ───────────────────────────── */

/** Punto que minimiza la suma de distancias² perpendiculares a varias semirrectas de rumbo. */
export function intersectBearings(obs) {
  if (obs.length < 2) return null;
  let a = 0, b = 0, c = 0, d = 0, e = 0;
  for (const o of obs) {
    const s = Math.sin(o.bearingDeg * RAD), co = Math.cos(o.bearingDeg * RAD), nx = co, ny = -s; // normal a la dirección (s, co)
    const wgt = o.weight ?? 1;
    a += wgt * nx * nx; b += wgt * nx * ny; c += wgt * ny * ny; d += wgt * nx * (nx * o.x + ny * o.y); e += wgt * ny * (nx * o.x + ny * o.y);
  }
  const det = a * c - b * b;
  if (Math.abs(det) < 1e-9) return null; // rumbos paralelos
  const p = { x: (c * d - b * e) / det, y: (a * e - b * d) / det };
  // ha de estar DELANTE de cada sensor, no detrás
  for (const o of obs) if ((p.x - o.x) * Math.sin(o.bearingDeg * RAD) + (p.y - o.y) * Math.cos(o.bearingDeg * RAD) <= 0) return null;
  return p;
}

const angDiff = (a, b) => { const d = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(d); };
const azimuth = (from, to) => ((Math.atan2(to.x - from.x, to.y - from.y) / RAD) + 360) % 360;

/* ───────────────────────────── 3. Consenso físico ───────────────────────────── */

/**
 * @param {Array<object>} obs  observaciones del mismo intervalo:
 *   { nodeId, modality: 'THERMAL'|'CAMERA'|'ACOUSTIC', kind: 'BEARING', x, y, bearingDeg, sigmaDeg? }
 *   { nodeId, modality: 'ACOUSTIC', kind: 'TOA', x, y, t }   (t en s, relojes sincronizados por GNSS/LoRa)
 * @param {object} [o]
 * @param {number} [o.tempC=20]  temperatura del aire (velocidad del sonido)
 * @param {number} [o.gateM=25]  tolerancia en metros para considerar que una observación cuadra
 * @param {Record<string,number>} [o.trust]  confianza aprendida por nodo (0–1), p. ej. de SENDA-CAL
 */
export function corroborate(obs, { tempC = 20, gateM = 25, trust = {} } = {}) {
  const c = speedOfSound(tempC), B = obs.filter((o) => o.kind === 'BEARING'), T = obs.filter((o) => o.kind === 'TOA');
  const nodes = new Set(obs.map((o) => o.nodeId));
  if (nodes.size < 2) return { level: 'UNCONFIRMED', reason: 'un solo nodo: ningún sensor barato decide solo', location: null, inliers: obs.map((o) => o.nodeId), outliers: [], nodes: nodes.size, modalities: [...new Set(obs.map((o) => o.modality))] };

  // candidatos: cruces de pares de rumbos (de nodos distintos) y multilateraciones de tríos de llegadas
  const cands = [];
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) if (B[i].nodeId !== B[j].nodeId) { const p = intersectBearings([B[i], B[j]]); if (p) cands.push(p); }
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) for (let k = j + 1; k < T.length; k++) {
    try { const m = multilaterate([T[i], T[j], T[k]], { c }); if (Number.isFinite(m.x) && Number.isFinite(m.y)) cands.push({ x: m.x, y: m.y }); } catch { /* geometría degenerada */ }
  }
  if (!cands.length) return { level: 'UNCONFIRMED', reason: 'las observaciones no se cortan en ningún punto', location: null, inliers: [], outliers: obs.map((o) => o.nodeId), nodes: nodes.size, modalities: [] };

  // error en metros de cada observación respecto a un punto
  const errM = (o, p, t0) => {
    if (o.kind === 'BEARING') { const dist = Math.hypot(p.x - o.x, p.y - o.y); return dist * Math.sin(Math.min(90, angDiff(azimuth(o, p), o.bearingDeg)) * RAD) + (angDiff(azimuth(o, p), o.bearingDeg) > 90 ? 1e9 : 0); }
    return Math.abs(o.t - t0 - Math.hypot(p.x - o.x, p.y - o.y) / c) * c;
  };
  const t0At = (p) => { const v = T.map((o) => o.t - Math.hypot(p.x - o.x, p.y - o.y) / c).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };
  const score = (p) => {
    const t0 = t0At(p), inl = obs.filter((o) => errM(o, p, t0) <= gateM);
    const support = [...new Set(inl.map((o) => o.nodeId))].reduce((s, n) => s + (trust[n] ?? 1), 0);
    return { p, inl, support, resid: inl.reduce((s, o) => s + errM(o, p, t0) ** 2, 0) };
  };
  let best = null;
  for (const p of cands) { const s = score(p); if (!best || s.support > best.support + 1e-9 || (Math.abs(s.support - best.support) < 1e-9 && s.resid < best.resid)) best = s; }

  // refinado con todos los que cuadran
  let loc = best.p;
  const inB = best.inl.filter((o) => o.kind === 'BEARING'), inT = best.inl.filter((o) => o.kind === 'TOA');
  if (inT.length >= 3) { try { const m = multilaterate(inT, { c }); loc = { x: m.x, y: m.y }; } catch { /* se queda el candidato */ } }
  if (inB.length >= 2) { const pb = intersectBearings(inB); if (pb) loc = inT.length >= 3 ? { x: (loc.x + pb.x) / 2, y: (loc.y + pb.y) / 2 } : pb; }
  const final = score(loc);

  const inNodes = new Set(final.inl.map((o) => o.nodeId)), mods = [...new Set(final.inl.map((o) => o.modality))];
  const outliers = [...nodes].filter((n) => !inNodes.has(n));
  const level = inNodes.size >= 2 && (mods.length >= 2 || inNodes.size >= 3) ? 'CONFIRMED' : inNodes.size >= 2 ? 'PROBABLE' : 'UNCONFIRMED';
  const rmsM = Math.sqrt(final.resid / Math.max(1, final.inl.length));
  return { level, location: { x: loc.x, y: loc.y }, rmsM, nodes: inNodes.size, modalities: mods, inliers: [...inNodes], outliers, speedOfSound: c,
    reason: outliers.length ? `${outliers.length} nodo(s) incoherente(s) con la física del suceso: revisar avería o manipulación` : 'todos los nodos cuadran' };
}

/* ───────────────────────────── 4. Suceso firmado, sin datos en bruto ───────────────────────────── */

const RAW = /^(frame|image|jpeg|png|audio|pcm|wav|video|samples|pixels)$/i;
const canon = (o) => JSON.stringify(o, Object.keys(o).sort());

/** Construye y firma (ECDSA P-256) el suceso. Rechaza cualquier campo que parezca imagen o audio. */
export async function buildEvent({ id, kind, at, result, nodeKeys, origin }) {
  const flat = JSON.stringify(result ?? {});
  for (const k of Object.keys(result ?? {})) if (RAW.test(k)) throw new Error(`privacidad: el suceso no puede llevar «${k}»`);
  if (/data:image|data:audio/.test(flat)) throw new Error('privacidad: el suceso no puede llevar imagen ni audio');
  const body = { schema: 'senda-vigia-event/v1', id, kind, at, level: result.level, x: result.location?.x ?? null, y: result.location?.y ?? null,
    rmsM: result.rmsM ?? null, nodes: result.inliers ?? [], outliers: result.outliers ?? [], modalities: result.modalities ?? [], origin: origin ?? null };
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, nodeKeys.privateKey, new TextEncoder().encode(canon(body))));
  return { ...body, sig: btoa(String.fromCharCode(...sig)) };
}

export async function verifyEvent(ev, publicKey) {
  const { sig, ...body } = ev;
  const bytes = Uint8Array.from(atob(sig), (ch) => ch.charCodeAt(0));
  return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, bytes, new TextEncoder().encode(canon(body)));
}

const KIND_CAP = { FIRE: ['Fire', 'Posible ignición detectada por consenso de sensores'], BLAST: ['Safety', 'Estallido o derrumbe detectado por consenso acústico'], PERSON: ['Rescue', 'Persona detectada'] };

/** CAP 1.2 para la sala 112. Solo sucesos CONFIRMED salen como Alert; el resto, como Update de seguimiento. */
export function eventToCap(ev, { sender = 'vigia@organismo.example', lat, lon, metersPerDegLat = 111_320, exercise = true } = {}) {
  const [category, event] = KIND_CAP[ev.kind] ?? ['Other', 'Suceso detectado'];
  const cosLat = Math.cos((lat ?? 0) * RAD), pLat = lat + (ev.y ?? 0) / metersPerDegLat, pLon = lon + (ev.x ?? 0) / (metersPerDegLat * cosLat);
  return toCap({ identifier: `SENDA-VIGIA-${String(ev.id).replace(/[^A-Za-z0-9]/g, '')}`, sender, sent: ev.at, status: exercise ? 'Exercise' : 'Actual', msgType: ev.level === 'CONFIRMED' ? 'Alert' : 'Update', scope: 'Restricted',
    info: { category, event, urgency: 'Immediate', severity: ev.level === 'CONFIRMED' ? 'Severe' : 'Moderate', certainty: ev.level === 'CONFIRMED' ? 'Observed' : 'Possible',
      headline: `${event}: ${ev.level} por ${ev.nodes.length} nodos (${ev.modalities.join(' + ')})`, description: `Error típico ${ev.rmsM?.toFixed(1)} m. Nodos incoherentes: ${ev.outliers.join(', ') || 'ninguno'}. Sin imagen ni audio: solo el suceso firmado.`,
      parameters: [['VIGIA_LEVEL', ev.level], ['VIGIA_NODES', ev.nodes.length], ['VIGIA_RMS_M', ev.rmsM?.toFixed(1) ?? '']],
      area: Number.isFinite(pLat) && Number.isFinite(pLon) ? { areaDesc: 'Punto estimado', circle: { center: { lat: +pLat.toFixed(6), lon: +pLon.toFixed(6) }, radiusKm: Math.max(0.05, ((ev.rmsM ?? 25) * 3) / 1000) } } : { areaDesc: 'Sin posición' } } });
}

/* ───────────────────────────── 5. Energía del nodo ───────────────────────────── */

/**
 * Balance energético. Las corrientes son DATOS DE ENTRADA (hojas de datos o, mejor, medidas con
 * amperímetro): el módulo solo hace la cuenta, no inventa consumos.
 * @param {{loads:Array<{name:string,mA:number,duty:number}>, volts?:number, batteryMah:number, solarW?:number, sunHours?:number, chargeEff?:number, usableFrac?:number}} p
 */
export function powerBudget({ loads, volts = 3.7, batteryMah, solarW = 0, sunHours = 0, chargeEff = 0.7, usableFrac = 0.8 }) {
  for (const l of loads) if (!(l.mA >= 0 && l.duty >= 0 && l.duty <= 1)) throw new RangeError(`carga no válida: ${l.name}`);
  const avgMa = loads.reduce((s, l) => s + l.mA * l.duty, 0), useWhDay = (avgMa / 1000) * volts * 24;
  const solarWhDay = solarW * sunHours * chargeEff, battWh = (batteryMah / 1000) * volts * usableFrac;
  return { avgMa: +avgMa.toFixed(2), useWhDay: +useWhDay.toFixed(3), solarWhDay: +solarWhDay.toFixed(3), balanceWhDay: +(solarWhDay - useWhDay).toFixed(3),
    autonomyDaysNoSun: +(battWh / useWhDay).toFixed(1), sustainable: solarWhDay >= useWhDay };
}

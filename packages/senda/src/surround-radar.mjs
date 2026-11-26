// @ts-check
/**
 * SENDA · Radar 360 alrededor del coche (vista desde arriba, como la de algunos coches con sensores).
 * Junta en un solo marco del coche (x a la derecha, y hacia delante, metros) lo que ve cada sensor REAL:
 *  - Cámara del móvil mirando al frente: detecciones de la IA. Con la geometría de montaje declarada hay metros;
 *    sin ella solo hay dirección (ángulo dentro del campo de visión), y se dibuja sin distancia.
 *  - Radar mmWave SENDA (RD-03D/LD2450) por USB, montado donde se declare (p. ej. en la luneta mirando atrás):
 *    x e y reales de hasta 3 objetivos EN MOVIMIENTO (alcance y ángulo los de la hoja de datos: ±60°, 8 m).
 * Lo que no cubre ningún sensor se dice como «sin sensor»: el móvil no ve detrás ni a los lados por sí solo.
 */
const D = Math.PI / 180;
export const SECTORS = Object.freeze(['DELANTE', 'DELANTE_DCHA', 'DCHA', 'DETRAS_DCHA', 'DETRAS', 'DETRAS_IZDA', 'IZDA', 'DELANTE_IZDA']);
export const SECTOR_ES = Object.freeze({ DELANTE: 'delante', DELANTE_DCHA: 'delante a la derecha', DCHA: 'a la derecha', DETRAS_DCHA: 'detrás a la derecha', DETRAS: 'detrás', DETRAS_IZDA: 'detrás a la izquierda', IZDA: 'a la izquierda', DELANTE_IZDA: 'delante a la izquierda' });
/** Rumbo relativo al coche: 0 = delante, positivo hacia la derecha (grados, −180..180). */
export const bearingOf = (x, y) => Math.atan2(x, y) / D;
export const sectorOf = (bearingDeg) => SECTORS[Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8];

const VEHICLE = new Set(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'person']);
/** Pistas de la cámara frontal → objetos en el marco del coche. hfovDeg obligatorio (campo horizontal de la cámara). */
export function fromCamera(tracks, { hfovDeg }) {
  if (!(hfovDeg > 0)) throw new Error('fromCamera exige hfovDeg');
  return (tracks ?? []).filter((t) => VEHICLE.has(t.label)).map((t) => {
    if (t.p3 && Number.isFinite(t.p3.zM)) { const x = t.p3.xM ?? 0, y = t.p3.zM; return { src: 'CAMARA', label: t.label, x, y, distM: +Math.hypot(x, y).toFixed(1), bearingDeg: +bearingOf(x, y).toFixed(1) }; }
    const cx = (t.box?.x ?? t.x ?? 0.5) + (t.box?.w ?? t.w ?? 0) / 2;
    return { src: 'CAMARA', label: t.label, x: null, y: null, distM: null, bearingDeg: +((cx - 0.5) * hfovDeg).toFixed(1) };
  });
}

/** Objetivos del radar mmWave (mm, marco del radar: x a su derecha, y hacia donde mira) → marco del coche. */
export function fromMmwave(targets, { mount }) {
  if (!mount || !Number.isFinite(mount.yawDeg)) throw new Error('fromMmwave exige el montaje declarado (yawDeg: 0 delante, 180 detrás, 90 derecha, −90 izquierda)');
  const c = Math.cos(mount.yawDeg * D), s = Math.sin(mount.yawDeg * D);
  return (targets ?? []).map((t) => {
    const xr = t.xMm / 1000, yr = t.yMm / 1000; // girar del marco del radar al del coche y desplazar al punto de montaje
    const x = xr * c + yr * s + (mount.xM ?? 0), y = -xr * s + yr * c + (mount.yM ?? 0);
    return { src: 'RADAR', label: 'objetivo en movimiento', x: +x.toFixed(2), y: +y.toFixed(2), distM: +Math.hypot(x, y).toFixed(1), bearingDeg: +bearingOf(x, y).toFixed(1), speedCms: t.speedCms ?? null };
  });
}

/** Qué sectores cubre cada sensor (para pintar «sin sensor» donde no hay nada). */
export function coverage({ cameraHfovDeg = null, mmwaveMounts = [] }) {
  const arcs = [];
  if (cameraHfovDeg > 0) arcs.push({ src: 'CAMARA', fromDeg: -cameraHfovDeg / 2, toDeg: cameraHfovDeg / 2, maxM: null });
  for (const m of mmwaveMounts) arcs.push({ src: 'RADAR', fromDeg: m.yawDeg - 60, toDeg: m.yawDeg + 60, maxM: 8 });
  const covered = new Set(); for (const sct of SECTORS) { const b = SECTORS.indexOf(sct) * 45; if (arcs.some((a) => inArc(b, a.fromDeg, a.toDeg))) covered.add(sct); }
  return { arcs, covered: [...covered], uncovered: SECTORS.filter((x) => !covered.has(x)) };
}
const inArc = (b, from, to) => { const n = (v) => ((v % 360) + 360) % 360, w = n(to - from), d = n(b - from); return d <= w; };

/** Resumen para la pantalla y la voz: cuántos y dónde, el más cercano primero. */
export function summarize(objs) {
  const bySector = {}; for (const o of objs) { const k = sectorOf(o.bearingDeg); (bySector[k] ??= []).push(o); }
  const parts = Object.entries(bySector).sort((a, b) => minD(a[1]) - minD(b[1])).map(([k, list]) => { const d = minD(list); return `${list.length} ${SECTOR_ES[k]}${Number.isFinite(d) ? ` (${Math.round(d)} m)` : ''}`; });
  const total = objs.length;
  return { total, bySector: Object.fromEntries(Object.entries(bySector).map(([k, v]) => [k, v.length])), text: total ? `${total} alrededor: ${parts.join(', ')}` : 'Nada detectado alrededor', key: Object.entries(bySector).map(([k, v]) => `${k}:${v.length}`).sort().join('|') };
}
const minD = (l) => Math.min(...l.map((o) => (Number.isFinite(o.distM) ? o.distM : Infinity)));

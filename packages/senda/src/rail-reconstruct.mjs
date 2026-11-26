// @ts-check
/**
 * SENDA · reconstrucción cinemática de un accidente ferroviario a partir de velocidades publicadas.
 *
 * Solo cinemática: velocidad lineal a trozos entre los puntos publicados (hipótesis declarada), posición por
 * integración exacta de ese perfil (regla del trapecio, exacta para velocidad lineal) anclada en un punto
 * kilométrico conocido. Sin masas ni fuerzas (no hay masas publicadas): no se calculan energías.
 *
 * Distancia de parada a deceleración constante: d = v²/(2a), t = v/a (cinemática elemental). La deceleración
 * NO tiene valor por defecto: se pasa la medida entre dos lecturas publicadas o un escenario declarado.
 */

const KMH = 1 / 3.6;
/** «HH:MM:SS» → segundos desde medianoche. */
export const hms = (s) => { const [h, m, x = 0] = String(s).split(':').map(Number); return h * 3600 + m * 60 + x; };
export const fmtHms = (sec) => { const s = Math.round(sec); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':'); };

/**
 * Perfil de velocidad lineal a trozos. pts: [{ tSec, vKmh }] ordenados. Fuera del intervalo, velocidad constante
 * igual a la del extremo (hipótesis declarada en la interfaz).
 */
export function speedProfile(pts) {
  if (!pts?.length) throw new Error('hacen falta puntos de velocidad publicados');
  const P = [...pts].sort((a, b) => a.tSec - b.tSec);
  const v = (t) => {
    if (t <= P[0].tSec) return P[0].vKmh * KMH;
    for (let i = 1; i < P.length; i++) if (t <= P[i].tSec) { const a = P[i - 1], b = P[i]; return (a.vKmh + ((b.vKmh - a.vKmh) * (t - a.tSec)) / (b.tSec - a.tSec)) * KMH; }
    return P.at(-1).vKmh * KMH;
  };
  /** Distancia recorrida (m) entre t1 y t2 (t2 ≥ t1), exacta para el perfil lineal a trozos. */
  const dist = (t1, t2) => {
    if (t2 < t1) return -dist(t2, t1);
    const knots = [t1, ...P.map((p) => p.tSec).filter((x) => x > t1 && x < t2), t2];
    let d = 0; for (let i = 1; i < knots.length; i++) d += 0.5 * (v(knots[i - 1]) + v(knots[i])) * (knots[i] - knots[i - 1]);
    return d;
  };
  return { v, dist, points: P };
}

/** Posición kilométrica (km) en el instante t, anclada: en tAnchor el tren está en pkAnchor; dir = +1 (PK crece) o −1. */
export const pkAt = (profile, { tAnchor, pkAnchor, dir }, t) => pkAnchor + (dir * profile.dist(tAnchor, t)) / 1000;

/** Deceleración media (m/s², positiva al frenar) entre dos lecturas publicadas. */
export const meanDecel = (a, b) => ((a.vKmh - b.vKmh) * KMH) / (b.tSec - a.tSec);

/** Distancia (m) y tiempo (s) para parar desde vKmh con deceleración constante decelMs2 (obligatoria). */
export function stopping(vKmh, decelMs2) {
  if (!(decelMs2 > 0)) throw new Error('falta la deceleración (sin valor por defecto)');
  const v = vKmh * KMH; return { distM: (v * v) / (2 * decelMs2), timeS: v / decelMs2 };
}

/** Velocidad de acercamiento (km/h) de dos trenes en sentidos opuestos. */
export const closingKmh = (aKmh, bKmh) => aKmh + bKmh;

/**
 * ¿Con cuánta antelación habría tenido que empezar a frenar un tren para detenerse antes de un punto?
 * Dado que a tCheck le quedaban distLeftM hasta el punto, con velocidad vKmh y deceleración decelMs2:
 * devuelve los segundos de antelación necesarios (0 si le bastaba) y la distancia que le faltaba.
 */
export function brakingShortfall(vKmh, decelMs2, distLeftM) {
  const s = stopping(vKmh, decelMs2), lack = Math.max(0, s.distM - distLeftM);
  return { ...s, shortfallM: lack, earlierS: lack / (vKmh * KMH) };
}

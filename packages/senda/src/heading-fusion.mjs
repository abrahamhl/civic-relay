/**
 * SENDA · orientación fusionada: hacia dónde miras (brújula con compensación de inclinación) y hacia dónde vas (rumbo GPS).
 *
 * Brújula: matriz de rotación del dispositivo según la especificación W3C «DeviceOrientation Event» (ángulos Z-X'-Y'':
 * alpha, beta, gamma), marco terrestre x = Este, y = Norte, z = Arriba. Se proyecta en horizontal:
 *  - el borde superior del móvil (0, 1, 0) cuando está casi plano;
 *  - la cámara trasera (0, 0, −1) cuando está casi vertical (soporte del coche, mirar a través de la cámara).
 * Solo vale si el evento es ABSOLUTO (referido al norte): `deviceorientationabsolute` en Android o
 * `webkitCompassHeading` en iOS. Sin referencia absoluta no se inventa un rumbo.
 *
 * Fusión: con velocidad suficiente manda el rumbo GPS (no le afectan los imanes ni el metal del coche); a la vez se aprende
 * la diferencia brújula − GPS (declinación magnética, interferencias y montaje del soporte) y se aplica cuando se va
 * despacio o parado. Suavizado circular (media de vectores unitarios, no de ángulos: 359° y 1° promedian 0°).
 * Las constantes de suavizado y el umbral de velocidad son elecciones de diseño: las pasa quien llama, declaradas.
 */
const D = Math.PI / 180;
export const norm360 = (a) => ((a % 360) + 360) % 360;
/** Diferencia angular con signo en (−180, 180]. */
export const angDiff = (a, b) => { const d = norm360(a - b); return d > 180 ? d - 360 : d; };

/** Vector de la Tierra (E, N, Arriba) al que apunta un vector del dispositivo, con alpha, beta, gamma en grados. */
export function deviceToEarth({ alpha, beta, gamma }, v) {
  const cA = Math.cos(alpha * D), sA = Math.sin(alpha * D), cB = Math.cos(beta * D), sB = Math.sin(beta * D), cG = Math.cos(gamma * D), sG = Math.sin(gamma * D);
  const R = [
    [cA * cG - sA * sB * sG, -cB * sA, cG * sA * sB + cA * sG],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  ];
  return R.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
}

/**
 * Rumbo de brújula (0 = norte, sentido horario) a partir de un evento de orientación.
 * screenAngle: rotación de la pantalla (0, 90, 180, 270) para el modo «borde superior».
 * Devuelve { headingDeg, mode: 'flat'|'upright'|'ios', horizontalNorm } o null si no hay referencia absoluta.
 */
export function compassHeading(ev, { screenAngle = 0 } = {}) {
  if (!ev) return null;
  if (typeof ev.webkitCompassHeading === 'number' && Number.isFinite(ev.webkitCompassHeading)) return { headingDeg: norm360(ev.webkitCompassHeading + screenAngle), mode: 'ios', horizontalNorm: 1 };
  if (!ev.absolute || ![ev.alpha, ev.beta, ev.gamma].every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  const upright = Math.abs(ev.beta) > 50; // móvil vertical (soporte): manda la cámara trasera
  const v = upright ? deviceToEarth(ev, [0, 0, -1]) : deviceToEarth(ev, [0, 1, 0]);
  const h = Math.hypot(v[0], v[1]); if (h < 0.2) return null; // apunta casi al cielo o al suelo: rumbo indefinido
  let hd = Math.atan2(v[0], v[1]) / D;
  if (!upright) hd += screenAngle;
  return { headingDeg: norm360(hd), mode: upright ? 'upright' : 'flat', horizontalNorm: h };
}

/**
 * Crea el fusor. cfg (obligatorio, elecciones de diseño declaradas):
 *   gpsMinSpeedMs: velocidad a partir de la cual manda el GPS
 *   tauCompassS, tauGpsS, tauOffsetS: constantes de tiempo del suavizado (s)
 */
export function createHeadingFusion(cfg) {
  for (const k of ['gpsMinSpeedMs', 'tauCompassS', 'tauGpsS', 'tauOffsetS']) if (!(cfg?.[k] > 0)) throw new Error(`falta ${k} (sin valor por defecto)`);
  let vec = null, offVec = null, offN = 0, source = null, lastT = null;
  const blend = (cur, angDeg, w) => { const x = Math.sin(angDeg * D), y = Math.cos(angDeg * D); if (!cur) return [x, y]; return [cur[0] + w * (x - cur[0]), cur[1] + w * (y - cur[1])]; };
  const angOf = (v) => norm360(Math.atan2(v[0], v[1]) / D);
  const w = (dt, tau) => 1 - Math.exp(-Math.max(0, dt) / tau);
  return {
    /** Lectura de brújula (rumbo en grados, tiempo en s). */
    compass(headingDeg, tS) {
      const dt = lastT == null ? Infinity : tS - lastT; lastT = tS;
      this._lastCompass = { h: headingDeg, t: tS }; // siempre: la autocalibración la necesita aunque mande el GPS
      if (source === 'gps' && this._gpsFresh(tS)) return this.state();
      const corr = offVec ? norm360(headingDeg + angOf(offVec)) : headingDeg;
      vec = blend(vec, corr, w(dt, cfg.tauCompassS)); source = offVec ? 'brujula_calibrada' : 'brujula';
      return this.state();
    },
    /** Fijo GPS: rumbo (grados o null) y velocidad (m/s). */
    gps(headingDeg, speedMs, tS) {
      const dt = lastT == null ? Infinity : tS - lastT; lastT = tS;
      if (!(Number.isFinite(headingDeg) && speedMs >= cfg.gpsMinSpeedMs)) return this.state();
      vec = blend(vec, headingDeg, w(dt, cfg.tauGpsS)); source = 'gps'; this._lastGps = tS;
      // Aprender la diferencia GPS − brújula si hay una lectura de brújula reciente (≤ 1 s)
      if (this._lastCompass && tS - this._lastCompass.t <= 1) { offVec = blend(offVec, angDiff(headingDeg, this._lastCompass.h), w(1, cfg.tauOffsetS)); offN++; }
      return this.state();
    },
    _gpsFresh(tS) { return this._lastGps != null && tS - this._lastGps < 2; },
    state() {
      if (!vec) return { headingDeg: null, source: null, confidence: 0, offsetDeg: null, offsetSamples: offN };
      const r = Math.hypot(vec[0], vec[1]); // longitud del vector medio: 1 = lecturas coherentes, ~0 = dispersas
      return { headingDeg: angOf(vec), source, confidence: Math.min(1, r), offsetDeg: offVec ? +angDiff(angOf(offVec), 0).toFixed(1) : null, offsetSamples: offN };
    },
  };
}

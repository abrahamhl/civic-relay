/**
 * Detección de presencia, movimiento y RESPIRACIÓN a través de paredes con Wi-Fi CSI
 * (Channel State Information).
 *
 * Base científica: el cuerpo humano altera la propagación multitrayecto del Wi-Fi; la
 * respiración (0,1–0,5 Hz) modula la amplitud de las subportadoras incluso a través de
 * tabiques. Línea de investigación publicada y reproducible con hardware barato:
 *   - ESP32-CSI-Tool (StevenMHernandez/ESP32-CSI-Tool) — placa ESP32 de ~10 €.
 *   - Nexmon CSI (seemoo-lab/nexmon_csi) — algunos chips Broadcom (Raspberry Pi, ciertos móviles con root).
 * Un teléfono normal NO expone CSI por API y su cámara no capta radio. Por eso SENDA
 * usa un ACCESORIO (ESP32) emparejado por Bluetooth/USB, y el móvil hace de pantalla
 * y de cámara para la realidad aumentada.
 *
 * Este módulo procesa series de amplitud CSI (cualquiera de esas herramientas) y
 * devuelve: movimiento, respiración estimada (rpm) y confianza. Debe calibrarse en
 * campo antes de usarse en rescates reales.
 */

export const CAPABILITIES = Object.freeze([
  { id: 'BLE_PHONE_LOCATION', what: 'Localizar el teléfono de una víctima por su señal BLE/Wi-Fi', hardware: 'Solo teléfonos', status: 'IMPLEMENTED_ALGORITHM', module: 'rubble.mjs' },
  { id: 'AR_OVERLAY', what: 'Ver en la cámara dónde está esa señal', hardware: 'Solo teléfonos', status: 'IMPLEMENTED_ALGORITHM', module: 'rubble.mjs#projectToCamera' },
  { id: 'CSI_BREATHING', what: 'Detectar respiración y movimiento tras un muro sin teléfono de la víctima', hardware: 'Accesorio ESP32 (CSI) + teléfono', status: 'IMPLEMENTED_ALGORITHM_NEEDS_FIELD_CALIBRATION', module: 'through-wall.mjs' },
  { id: 'CAMERA_ALONE_THROUGH_WALL', what: 'Ver a través de un muro solo con la cámara del móvil', hardware: '—', status: 'NOT_PHYSICALLY_POSSIBLE', module: null },
]);

/** Parser del CSV de ESP32-CSI-Tool: columna CSI_DATA "[imag real imag real ...]" → amplitudes por subportadora. */
export function parseEsp32CsiLine(line) {
  const m = line.match(/\[([-\d\s]+)\]/);
  if (!m) return null;
  const v = m[1].trim().split(/\s+/).map(Number);
  const amps = [];
  for (let i = 0; i + 1 < v.length; i += 2) amps.push(Math.hypot(v[i], v[i + 1]));
  return amps;
}

function mean(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
function std(a) { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); }

/** Media móvil (filtro paso bajo simple). */
function smooth(x, w) {
  const out = new Array(x.length).fill(0); let s = 0;
  for (let i = 0; i < x.length; i++) { s += x[i]; if (i >= w) s -= x[i - w]; out[i] = s / Math.min(i + 1, w); }
  return out;
}

/** Potencia espectral por DFT directa en una banda (suficiente para ventanas de 30–60 s). */
function bandPeak(x, sr, fLo, fHi, step = 0.005) {
  const m = mean(x), y = x.map((v) => v - m);
  let best = { f: 0, p: 0 }, total = 0;
  for (let f = fLo; f <= fHi; f += step) {
    let re = 0, im = 0;
    for (let i = 0; i < y.length; i++) { const a = (2 * Math.PI * f * i) / sr; re += y[i] * Math.cos(a); im -= y[i] * Math.sin(a); }
    const p = (re * re + im * im) / y.length; total += p;
    if (p > best.p) best = { f, p };
  }
  return { ...best, share: best.p / Math.max(total, 1e-9) };
}

/**
 * @param {number[][]} frames amplitudes CSI por instante (frames × subportadoras)
 * @param {{sr:number}} opts sr = paquetes por segundo
 */
export function analyzeCsi(frames, { sr = 20, baselineStd = null } = {}) {
  if (frames.length < sr * 20) return { status: 'INSUFFICIENT_DATA', needSeconds: 20 };
  const nSub = frames[0].length;
  // Elegir las subportadoras más sensibles (mayor varianza relativa) y promediarlas.
  const series = Array.from({ length: nSub }, (_, k) => frames.map((f) => f[k]));
  const scored = series.map((s, k) => ({ k, cv: std(s) / Math.max(mean(s), 1e-6) })).sort((a, b) => b.cv - a.cv).slice(0, Math.max(4, Math.floor(nSub / 6)));
  const sig = frames.map((_, i) => mean(scored.map(({ k }) => series[k][i] / Math.max(mean(series[k]), 1e-6))));
  const slow = smooth(sig, Math.round(sr * 0.8));
  const motionIndex = std(sig.map((v, i) => v - slow[i])) * 100; // energía rápida → movimiento
  const breathing = bandPeak(slow.filter((_, i) => i % Math.max(1, Math.round(sr / 5)) === 0), 5, 0.1, 0.5);
  const presenceScore = baselineStd ? std(slow) / baselineStd : null;
  const breathingDetected = breathing.share > 0.08 && breathing.p > 0;
  return {
    status: 'ANALYZED',
    motion: motionIndex > 1.5 ? 'MOVEMENT' : 'STILL',
    motionIndex: +motionIndex.toFixed(2),
    breathing: breathingDetected ? { detected: true, rpm: +(breathing.f * 60).toFixed(1), bandShare: +breathing.share.toFixed(3) } : { detected: false },
    presenceVsEmptyRoom: presenceScore === null ? 'NO_BASELINE' : presenceScore > 1.8 ? 'LIKELY_PRESENCE' : 'NO_EVIDENCE',
    evidence: 'CSI_RESEARCH_GRADE', caution: 'Indicio para orientar la búsqueda; nunca descarta a nadie ni sustituye a perros, geófonos o cámaras de rescate.',
  };
}

/** Señal CSI sintética para pruebas: respiración a `rpm` + ruido; `person=false` = sala vacía. */
export function synthesizeCsi({ seconds = 40, sr = 20, nSub = 52, rpm = 14, person = true, seed = 1 } = {}) {
  let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5);
  const base = Array.from({ length: nSub }, (_, k) => 20 + 10 * Math.sin(k / 5));
  const sens = Array.from({ length: nSub }, (_, k) => (k % 7 === 0 ? 1 : 0.15));
  return Array.from({ length: seconds * sr }, (_, i) => base.map((b, k) => b * (1 + (person ? 0.03 * sens[k] * Math.sin((2 * Math.PI * rpm * i) / (60 * sr)) : 0)) + rnd() * 0.15));
}

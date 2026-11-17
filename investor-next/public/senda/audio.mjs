/**
 * Puente WebAudio ↔ módem acústico del núcleo (core/acoustic-modem.mjs).
 * Emisión: altavoz. Recepción: micrófono SIN cancelación de eco ni supresión de ruido
 * (esos filtros destruyen los tonos). Decodifica en caliente y se detiene al primer éxito.
 */
import { modulate, demodulate } from './core/acoustic-modem.mjs';

let ctx = null;
const audio = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)());

export function drawScope(canvas, samples) {
  if (!canvas) return;
  const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  g.fillStyle = '#071018'; g.fillRect(0, 0, w, h); g.strokeStyle = '#91d7e8'; g.beginPath();
  const step = Math.max(1, Math.floor(samples.length / w));
  for (let x = 0; x < w; x++) { let m = 0; for (let i = 0; i < step; i++) m = Math.max(m, Math.abs(samples[x * step + i] || 0)); g.moveTo(x, h / 2 - m * h * 0.45); g.lineTo(x, h / 2 + m * h * 0.45); }
  g.stroke();
}

/** Reproduce una carga por el altavoz. Devuelve la forma de onda (para pruebas y osciloscopio). */
export async function emit(payload, { canvas } = {}) {
  const a = audio(); await a.resume();
  const samples = modulate(payload, { sampleRate: a.sampleRate });
  drawScope(canvas, samples);
  window.SENDA_TEST && (window.SENDA_TEST.lastEmission = { samples, sampleRate: a.sampleRate });
  const buf = a.createBuffer(1, samples.length, a.sampleRate); buf.copyToChannel(samples, 0);
  const src = a.createBufferSource(); src.buffer = buf; src.connect(a.destination);
  await new Promise((res) => { src.onended = res; src.start(); });
  return samples;
}

/**
 * Escucha hasta decodificar algo o agotar `maxS`. Llama a onPayload(bytes) por cada trama.
 * @returns {Promise<{stop:()=>void, done:Promise<number>}>}
 */
export async function listen({ maxS = 60, onPayload, onLevel, canvas }) {
  const a = audio(); await a.resume();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const src = a.createMediaStreamSource(stream), proc = a.createScriptProcessor(4096, 1, 1);
  const chunks = []; let total = 0, stopped = false, found = 0, lastTry = 0;
  const sr = a.sampleRate, maxSamples = maxS * sr;
  let resolveDone; const done = new Promise((r) => (resolveDone = r));
  const stop = () => { if (stopped) return; stopped = true; proc.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop()); resolveDone(found); };
  proc.onaudioprocess = (e) => {
    if (stopped) return;
    const d = new Float32Array(e.inputBuffer.getChannelData(0)); chunks.push(d); total += d.length;
    let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v)); onLevel?.(peak);
    if (total - lastTry > sr * 2) {
      lastTry = total;
      const all = new Float32Array(total); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
      drawScope(canvas, all.subarray(Math.max(0, all.length - sr * 4)));
      const r = demodulate(all, { sampleRate: sr });
      if (r) { found++; onPayload(r.payload); chunks.length = 0; total = 0; lastTry = 0; }
    }
    if (total > maxSamples) stop();
  };
  src.connect(proc); proc.connect(a.destination);
  return { stop, done };
}

/** Entrada directa de muestras (pruebas automáticas o archivos de audio grabados). */
export function decodeSamples(samples, sampleRate) { return demodulate(samples, { sampleRate }); }

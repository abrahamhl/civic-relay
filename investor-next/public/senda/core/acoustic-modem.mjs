/**
 * Módem acústico SENDA: datos por SONIDO entre dos teléfonos (altavoz → micrófono).
 * Funciona sin red, sin SIM, sin Bluetooth y sin Wi-Fi: solo aire.
 *
 * Diseño (implementación propia, sin dependencias):
 *  - Modulación MFSK-16 ortogonal: 16 tonos de 2 000 a 5 000 Hz (separación 200 Hz),
 *    4 bits por símbolo, símbolo de 20 ms + 5 ms de guarda contra eco → 160 bit/s brutos.
 *  - Sincronización: preámbulo de 8 símbolos conocidos; detección de inicio por energía
 *    y ajuste fino de fase de símbolo con la puntuación de los tonos del preámbulo.
 *  - Corrección de errores: Hamming(7,4) + entrelazado por bloque (un símbolo erróneo
 *    reparte sus 4 bits en 4 palabras distintas y se corrige).
 *  - Integridad: CRC-32 sobre la trama; si no cuadra, se descarta (nunca se entrega basura).
 *  - Independiente de la frecuencia de muestreo: emisor a 48 kHz, receptor a 44,1 kHz, etc.
 */
export const PROFILE = Object.freeze({ f0: 2000, df: 200, tones: 16, symS: 0.020, guardS: 0.005, preamble: [0, 15, 0, 15, 5, 10, 5, 10], rampS: 0.002 });

/* ---------- CRC-32 ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/* ---------- Hamming(7,4) ---------- */
function hamEncode(n) { const d = [(n >> 3) & 1, (n >> 2) & 1, (n >> 1) & 1, n & 1]; const p1 = d[0] ^ d[1] ^ d[3], p2 = d[0] ^ d[2] ^ d[3], p3 = d[1] ^ d[2] ^ d[3]; return [p1, p2, d[0], p3, d[1], d[2], d[3]]; }
function hamDecode(c) { const s = (c[0] ^ c[2] ^ c[4] ^ c[6]) | ((c[1] ^ c[2] ^ c[5] ^ c[6]) << 1) | ((c[3] ^ c[4] ^ c[5] ^ c[6]) << 2); const x = c.slice(); if (s) x[s - 1] ^= 1; return { nibble: (x[2] << 3) | (x[4] << 2) | (x[5] << 1) | x[6], corrected: s !== 0 }; }

/* ---------- Trama → bits → símbolos ---------- */
function frameBytes(payload) {
  if (payload.length > 4096) throw new Error('Carga máxima 4096 bytes por trama acústica');
  const f = new Uint8Array(2 + payload.length + 4);
  f[0] = payload.length >> 8; f[1] = payload.length & 0xff; f.set(payload, 2);
  const c = crc32(f.subarray(0, 2 + payload.length));
  f.set([c >>> 24, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff], 2 + payload.length);
  return f;
}
function interleave(bits, depth) { const rows = Math.ceil(bits.length / depth), out = []; for (let c = 0; c < depth; c++) for (let r = 0; r < rows; r++) { const i = r * depth + c; if (i < bits.length) out.push(bits[i]); } return out; }
function deinterleave(bits, depth) { const rows = Math.ceil(bits.length / depth), out = new Array(bits.length); let k = 0; for (let c = 0; c < depth; c++) for (let r = 0; r < rows; r++) { const i = r * depth + c; if (i < bits.length) out[i] = bits[k++]; } return out; }
const DEPTH = 7 * 4;

export function bytesToSymbols(payload) {
  const f = frameBytes(payload), bits = [];
  for (const b of f) { bits.push(...hamEncode(b >> 4), ...hamEncode(b & 15)); }
  const il = interleave(bits, DEPTH);
  while (il.length % 4) il.push(0);
  const syms = []; for (let i = 0; i < il.length; i += 4) syms.push((il[i] << 3) | (il[i + 1] << 2) | (il[i + 2] << 1) | il[i + 3]);
  return syms;
}

/** Duración en segundos de una transmisión de `n` bytes. */
export function airtimeSeconds(n, p = PROFILE) { return (p.preamble.length + Math.ceil(((2 + n + 4) * 14) / 4)) * (p.symS + p.guardS) + 0.1; }

/** Genera la forma de onda (Float32Array, amplitud ≤ 0,8). */
export function modulate(payload, { sampleRate = 48000, profile = PROFILE } = {}) {
  const syms = [...profile.preamble, ...bytesToSymbols(payload)];
  const ns = Math.round(profile.symS * sampleRate), ng = Math.round(profile.guardS * sampleRate), nr = Math.round(profile.rampS * sampleRate);
  const lead = Math.round(0.05 * sampleRate);
  const out = new Float32Array(lead + syms.length * (ns + ng) + lead);
  let pos = lead;
  for (const s of syms) {
    const f = profile.f0 + s * profile.df;
    for (let i = 0; i < ns; i++) {
      const env = Math.min(1, i / nr, (ns - 1 - i) / nr);
      out[pos + i] = 0.8 * env * Math.sin((2 * Math.PI * f * i) / sampleRate);
    }
    pos += ns + ng;
  }
  return out;
}

/* ---------- Demodulación ---------- */
function goertzel(x, start, n, f, sr) {
  const w = (2 * Math.PI * f) / sr, c = 2 * Math.cos(w); let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const s0 = (x[start + i] || 0) + c * s1 - s2; s2 = s1; s1 = s0; }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}
function symbolPowers(x, start, n, sr, p) { const pw = new Float64Array(p.tones); for (let k = 0; k < p.tones; k++) pw[k] = goertzel(x, start, n, p.f0 + k * p.df, sr); return pw; }
function argmax(a) { let m = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[m]) m = i; return m; }

/** Busca inicios candidatos por subida de energía en la banda. */
function onsets(x, sr) {
  const win = Math.round(0.005 * sr), env = [];
  for (let i = 0; i + win <= x.length; i += win) { let e = 0; for (let j = 0; j < win; j++) e += x[i + j] * x[i + j]; env.push(e / win); }
  const sorted = [...env].sort((a, b) => a - b), floor = sorted[Math.floor(sorted.length * 0.2)] || 0, peak = sorted[Math.floor(sorted.length * 0.98)] || 0;
  const thr = floor + 0.15 * (peak - floor), out = [];
  for (let i = 1; i < env.length; i++) if (env[i] > thr && env[i - 1] <= thr) out.push(i * win);
  return out;
}

/**
 * Decodifica una grabación. Devuelve la carga (Uint8Array) o null si no hay trama válida.
 * @returns {{payload:Uint8Array, start:number, corrected:number}|null}
 */
export function demodulate(samples, { sampleRate = 48000, profile: p = PROFILE } = {}) {
  const ns = Math.round(p.symS * sampleRate), step = Math.round((p.symS + p.guardS) * sampleRate);
  const win = Math.round(ns * 0.8), skip = Math.round(ns * 0.1);
  const scorePre = (start) => { let sc = 0; p.preamble.forEach((tone, i) => { const pw = symbolPowers(samples, start + i * step + skip, win, sampleRate, p); let tot = 0; for (const v of pw) tot += v; sc += pw[tone] / (tot + 1e-12); }); return sc / p.preamble.length; };
  for (const on of onsets(samples, sampleRate)) {
    let best = { s: -1, at: 0 };
    const fine = Math.max(1, Math.round(0.0005 * sampleRate));
    for (let at = Math.max(0, on - step); at <= on + step; at += fine) { const s = scorePre(at); if (s > best.s) best = { s, at }; }
    if (best.s < 0.5) continue;
    const r = decodeFrom(samples, best.at + p.preamble.length * step, { sampleRate, p, step, win, skip });
    if (r) return { ...r, start: best.at / sampleRate, preambleScore: +best.s.toFixed(3) };
  }
  return null;
}

function decodeFrom(x, start, { sampleRate, p, step, win, skip }) {
  const readSyms = (count, from) => { const out = []; for (let i = 0; i < count; i++) out.push(argmax(symbolPowers(x, from + i * step + skip, win, sampleRate, p))); return out; };
  const symsToBytes = (syms, nBytes) => {
    const bits = []; for (const s of syms) bits.push((s >> 3) & 1, (s >> 2) & 1, (s >> 1) & 1, s & 1);
    const need = nBytes * 14; const di = deinterleave(bits.slice(0, need), DEPTH);
    const out = new Uint8Array(nBytes); let corrected = 0;
    for (let i = 0; i < nBytes; i++) { const hi = hamDecode(di.slice(i * 14, i * 14 + 7)), lo = hamDecode(di.slice(i * 14 + 7, i * 14 + 14)); corrected += hi.corrected + lo.corrected; out[i] = (hi.nibble << 4) | lo.nibble; }
    return { out, corrected };
  };
  // El entrelazado abarca toda la trama: se prueba la longitud declarada leyendo una cabecera
  // provisional y se valida con CRC; se aceptan solo longitudes coherentes con la grabación.
  const maxSyms = Math.min(Math.floor((x.length - start) / step), Math.ceil(((2 + 4096 + 4) * 14) / 4));
  const all = readSyms(maxSyms, start); // demodulación una sola vez; la búsqueda de longitud es aritmética
  for (let n = 1; n <= 4096; n++) {
    const total = 2 + n + 4, symCount = Math.ceil((total * 14) / 4);
    if (symCount > maxSyms) break;
    const { out, corrected } = symsToBytes(all.slice(0, symCount), total);
    if (((out[0] << 8) | out[1]) !== n) continue;
    const c = crc32(out.subarray(0, 2 + n)), got = ((out[2 + n] << 24) | (out[3 + n] << 16) | (out[4 + n] << 8) | out[5 + n]) >>> 0;
    if (c === got) return { payload: out.slice(2, 2 + n), corrected };
  }
  return null;
}

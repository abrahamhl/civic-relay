/**
 * SENDA · Chat familiar: lo que la gente ya sabe usar (chats, grupos, notas de voz, fotos, ubicación,
 * reacciones, respuestas, estados de 24 h y los «tics»), pero sobre CUALQUIER vía: datos, Wi-Fi, un
 * desconocido con datos (stranger-gateway.mjs), Bluetooth, LoRa, SMS o satélite.
 *
 * SENDA no se conecta a WhatsApp, Instagram ni Snapchat ni las sustituye en el día a día. Cuando no hay
 * red, el usuario abre SENDA y encuentra lo mismo de siempre; lo que cambia es CÓMO viaja cada mensaje:
 *
 *  1. ESCALERA DE MEDIOS: cada mensaje tiene varias formas, de la más rica a la más ligera, y se envía la
 *     mejor que quepa en el presupuesto de bytes de la vía disponible. Una foto puede viajar como miniatura
 *     de 132 B por LoRa y completarse cuando aparezca Wi-Fi. El códec de miniaturas de este módulo es REAL
 *     (reducción por cajas + YCbCr 4:2:0 + cuantización uniforme) y su calidad se MIDE en PSNR.
 *  2. NOTAS DE VOZ: se dimensionan con las tasas publicadas de Codec2 (700–3200 bit/s) y Opus (≥ 6 kbit/s,
 *     RFC 6716). El códec en sí lo aporta la app (libcodec2 / libopus); aquí solo se decide qué cabe.
 *  3. TICS CON PRUEBA: 🕓 en tu móvil · ✓ alguien lo custodia (recibo firmado de la pasarela) · ✓✓ entregado
 *     (recibo extremo a extremo: solo el destinatario conoce el secreto de acuse) · ✓✓ azul leído (solo si
 *     el destinatario lo activa). Cada tic es comprobable, no una promesa del servidor.
 *  4. GRUPOS: «clave de remitente» (un cifrado por mensaje + reparto inicial de la clave a cada miembro)
 *     frente a sobre por miembro; el coste en bytes se calcula y se elige el menor para cada vía.
 *  5. COLA CON PRIORIDAD: con un presupuesto de bytes por ventana (p. ej. el ciclo de trabajo de LoRa),
 *     se elige qué sale primero maximizando el valor declarado (mochila 0/1 exacta por programación dinámica).
 *
 * Veracidad: los valores de prioridad son una POLÍTICA declarada, no un dato; las tasas de los códecs son
 * las publicadas por sus proyectos; los tamaños se calculan, no se suponen.
 */

/* ───────────────────────── Tipos de mensaje familiares ───────────────────────── */

export const MESSAGE_TYPES = Object.freeze({
  SOS: { label: 'SOS', familiar: 'Botón de emergencia' },
  TEXT: { label: 'Texto', familiar: 'Mensaje' },
  LOCATION: { label: 'Ubicación', familiar: 'Compartir ubicación' },
  VOICE: { label: 'Nota de voz', familiar: 'Mantener pulsado para grabar' },
  PHOTO: { label: 'Foto', familiar: 'Cámara / galería' },
  REACTION: { label: 'Reacción', familiar: 'Emoji sobre un mensaje' },
  REPLY: { label: 'Respuesta', familiar: 'Responder citando' },
  STATUS: { label: 'Estado 24 h', familiar: 'Historias / estados' },
  RECEIPT: { label: 'Tic', familiar: '✓ ✓✓ leído' },
});

export const TICKS = Object.freeze([
  { state: 'QUEUED', icon: '🕓', proof: 'Sellado y cifrado en tu móvil; aún no ha salido.' },
  { state: 'IN_CUSTODY', icon: '✓', proof: 'Recibo de custodia firmado por una pasarela (stranger-gateway.mjs → verifyCustodyReceipt).' },
  { state: 'DELIVERED', icon: '✓✓', proof: 'Recibo extremo a extremo: el secreto de acuse solo lo conoce el destinatario (envelope.mjs).' },
  { state: 'READ', icon: '✓✓ azul', proof: 'Recibo de lectura cifrado; solo si el destinatario lo tiene activado.' },
]);
const TICK_ORDER = TICKS.map((t) => t.state);
/** Los tics solo avanzan; un recibo tardío de custodia no hace retroceder un ✓✓. */
export function advanceTick(current, next) {
  const a = TICK_ORDER.indexOf(current), b = TICK_ORDER.indexOf(next);
  if (a < 0 || b < 0) throw new Error('tic desconocido');
  return b > a ? next : current;
}

/* ───────────────────────── Ubicación compacta ───────────────────────── */

/** Ubicación en 8 B: lat y lon como enteros de 32 bits con resolución 1e-7° (≈ 1,1 cm en latitud). */
export function packLocation(lat, lon) {
  const b = new Uint8Array(8), v = new DataView(b.buffer);
  v.setInt32(0, Math.round(lat * 1e7)); v.setInt32(4, Math.round(lon * 1e7)); return b;
}
export function unpackLocation(b) { const v = new DataView(b.buffer, b.byteOffset, 8); return { lat: v.getInt32(0) / 1e7, lon: v.getInt32(4) / 1e7 }; }

/* ───────────────────────── Miniaturas: códec real ───────────────────────── */

const clamp8 = (x) => (x < 0 ? 0 : x > 255 ? 255 : Math.round(x));
/** Reduce una imagen RGBA (w×h) a tw×th promediando por cajas (cada píxel destino = media del área que cubre). */
export function downscaleRGBA(rgba, w, h, tw, th) {
  const out = new Float64Array(tw * th * 3);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const x0 = Math.floor((tx * w) / tw), x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * w) / tw));
    const y0 = Math.floor((ty * h) / th), y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * h) / th));
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++; }
    const o = (ty * tw + tx) * 3; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
  }
  return out;
}
// YCbCr de JPEG (ITU-R BT.601, rango completo).
const toY = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const toCb = (r, g, b) => 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
const toCr = (r, g, b) => 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

function writeBits(values, bits) {
  const out = new Uint8Array(Math.ceil((values.length * bits) / 8)); let pos = 0;
  for (const v of values) for (let b = bits - 1; b >= 0; b--, pos++) if ((v >> b) & 1) out[pos >> 3] |= 0x80 >> (pos & 7);
  return out;
}
function readBits(bytes, count, bits, offsetBits) {
  const vals = new Array(count); let pos = offsetBits;
  for (let i = 0; i < count; i++) { let v = 0; for (let b = 0; b < bits; b++, pos++) v = (v << 1) | ((bytes[pos >> 3] >> (7 - (pos & 7))) & 1); vals[i] = v; }
  return vals;
}
// Cuantización uniforme con reconstrucción en los extremos. La crominancia usa 2^bits − 1 niveles (número impar)
// para que el gris neutro (128) sea representable: con 2^bits niveles el negro y el blanco salían teñidos de azul.
const levels = (bits, chroma) => (1 << bits) - (chroma ? 1 : 0);
const q = (x, bits, chroma = false) => { const L = levels(bits, chroma); return Math.max(0, Math.min(L - 1, Math.round((x * (L - 1)) / 255))); };
const dq = (v, bits, chroma = false) => (v * 255) / (levels(bits, chroma) - 1);

/** Tamaño exacto en bytes de una miniatura tw×th con yBits/cBits. */
export const thumbBytes = (tw, th, yBits, cBits) => 4 + Math.ceil((tw * th * yBits + 2 * Math.ceil(tw / 2) * Math.ceil(th / 2) * cBits) / 8);

/** Codifica: [1][tw][th][yBits<<4|cBits] + luminancia por píxel + crominancia 4:2:0, en bits empaquetados. */
export function encodeThumb(rgba, w, h, { tw, th, yBits, cBits }) {
  if (!(tw >= 1 && th >= 1 && tw <= 255 && th <= 255 && yBits >= 1 && yBits <= 8 && cBits >= 1 && cBits <= 8)) throw new RangeError('parámetros de miniatura');
  const px = downscaleRGBA(rgba, w, h, tw, th), cw = Math.ceil(tw / 2), ch = Math.ceil(th / 2);
  const Y = [], Cb = [], Cr = [];
  for (let i = 0; i < tw * th; i++) Y.push(q(toY(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]), yBits));
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    let cb = 0, cr = 0, n = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const x = cx * 2 + dx, y = cy * 2 + dy; if (x >= tw || y >= th) continue;
      const i = (y * tw + x) * 3; cb += toCb(px[i], px[i + 1], px[i + 2]); cr += toCr(px[i], px[i + 1], px[i + 2]); n++;
    }
    Cb.push(q(cb / n, cBits, true)); Cr.push(q(cr / n, cBits, true));
  }
  const body = writeBits([...Y.map((v) => [v, yBits]), ...Cb.map((v) => [v, cBits]), ...Cr.map((v) => [v, cBits])].flatMap(([v, b]) => Array.from({ length: b }, (_, k) => (v >> (b - 1 - k)) & 1)), 1);
  const out = new Uint8Array(4 + body.length); out[0] = 1; out[1] = tw; out[2] = th; out[3] = (yBits << 4) | cBits; out.set(body, 4);
  return out;
}

/** Decodifica a RGBA tw×th (la app la amplía con suavizado, como hacen las «vistas previas borrosas»). */
export function decodeThumb(bytes) {
  if (bytes[0] !== 1) throw new Error('miniatura desconocida');
  const tw = bytes[1], th = bytes[2], yBits = bytes[3] >> 4, cBits = bytes[3] & 15, cw = Math.ceil(tw / 2), ch = Math.ceil(th / 2);
  const body = bytes.subarray(4);
  const Y = readBits(body, tw * th, yBits, 0), Cb = readBits(body, cw * ch, cBits, tw * th * yBits), Cr = readBits(body, cw * ch, cBits, tw * th * yBits + cw * ch * cBits);
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const yy = dq(Y[y * tw + x], yBits), c = (y >> 1) * cw + (x >> 1), cb = dq(Cb[c], cBits, true) - 127.5, cr = dq(Cr[c], cBits, true) - 127.5, o = (y * tw + x) * 4;
    out[o] = clamp8(yy + 1.402 * cr); out[o + 1] = clamp8(yy - 0.344136 * cb - 0.714136 * cr); out[o + 2] = clamp8(yy + 1.772 * cb); out[o + 3] = 255;
  }
  return { w: tw, h: th, rgba: out };
}

/** PSNR (dB) entre la imagen original reducida a tw×th y la miniatura decodificada (canales RGB). */
export function thumbPsnr(rgba, w, h, thumb) {
  const d = decodeThumb(thumb), ref = downscaleRGBA(rgba, w, h, d.w, d.h);
  let se = 0; for (let i = 0; i < d.w * d.h; i++) for (let c = 0; c < 3; c++) se += (ref[i * 3 + c] - d.rgba[i * 4 + c]) ** 2;
  const mse = se / (d.w * d.h * 3); return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

/** Escalones de miniatura (de más rico a más ligero), conservando la proporción de la foto. */
export function thumbLadder(w, h) {
  const steps = [];
  for (const long of [64, 48, 40, 32, 24, 20, 16, 12, 8]) for (const [yB, cB] of [[6, 4], [5, 4], [5, 3], [4, 3], [3, 2]]) {
    const tw = w >= h ? long : Math.max(1, Math.round((long * w) / h)), th = w >= h ? Math.max(1, Math.round((long * h) / w)) : long;
    steps.push({ tw, th, yBits: yB, cBits: cB, bytes: thumbBytes(tw, th, yB, cB) });
  }
  return steps.sort((a, b) => b.bytes - a.bytes);
}

/** Amplía RGBA tw×th a W×H por interpolación bilineal (lo que hace la app al mostrar la vista previa). */
export function upscaleBilinear(src, tw, th, W, H) {
  const out = new Float64Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = Math.max(0, Math.min(tw - 1, ((x + 0.5) * tw) / W - 0.5)), fy = Math.max(0, Math.min(th - 1, ((y + 0.5) * th) / H - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(tw - 1, x0 + 1), y1 = Math.min(th - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
    for (let c = 0; c < 3; c++) {
      const p = (xx, yy) => src[(yy * tw + xx) * 4 + c];
      out[(y * W + x) * 3 + c] = (1 - ay) * ((1 - ax) * p(x0, y0) + ax * p(x1, y0)) + ay * ((1 - ax) * p(x0, y1) + ax * p(x1, y1));
    }
  }
  return out;
}
/**
 * PSNR COMPARABLE entre escalones: la miniatura decodificada se amplía a una referencia común (refW×refH) y se
 * compara con el original reducido a esa misma referencia. Así 16×9 y 48×27 se miden con la misma vara.
 */
export function thumbPsnrAt(rgba, w, h, thumb, refW, refH) {
  const d = decodeThumb(thumb), up = upscaleBilinear(d.rgba, d.w, d.h, refW, refH), ref = downscaleRGBA(rgba, w, h, refW, refH);
  let se = 0; for (let i = 0; i < up.length; i++) se += (up[i] - ref[i]) ** 2;
  const mse = se / up.length; return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}
/**
 * La miniatura que MEJOR se ve (PSNR a referencia común de 64 px en el lado largo) entre todas las que caben en
 * `budgetBytes`. Se codifican y miden todas las candidatas: la elección es por medida, no por suposición.
 */
export function bestThumbForBudget(rgba, w, h, budgetBytes) {
  const refW = w >= h ? 64 : Math.max(1, Math.round((64 * w) / h)), refH = w >= h ? Math.max(1, Math.round((64 * h) / w)) : 64;
  let best = null;
  for (const step of thumbLadder(w, h)) {
    if (step.bytes > budgetBytes) continue;
    const data = encodeThumb(rgba, w, h, step), psnr = thumbPsnrAt(rgba, w, h, data, refW, refH);
    if (!best || psnr > best.psnrDb) best = { ...step, bytes: data.length, data, psnrDb: psnr };
  }
  return best && { ...best, psnrDb: +best.psnrDb.toFixed(2), reference: `${refW}x${refH}` };
}

/* ───────────────────────── Notas de voz ───────────────────────── */

/** Tasas publicadas de Codec2 (bit/s) y mínimo de Opus (RFC 6716: 6 a 510 kbit/s). */
export const VOICE_CODECS = Object.freeze([
  { id: 'OPUS_16K', bps: 16000, source: 'Opus · RFC 6716' },
  { id: 'OPUS_6K', bps: 6000, source: 'Opus · RFC 6716 (mínimo)' },
  { id: 'CODEC2_3200', bps: 3200, source: 'Codec2' },
  { id: 'CODEC2_2400', bps: 2400, source: 'Codec2' },
  { id: 'CODEC2_1600', bps: 1600, source: 'Codec2' },
  { id: 'CODEC2_1200', bps: 1200, source: 'Codec2' },
  { id: 'CODEC2_700C', bps: 700, source: 'Codec2 (modo 700C)' },
]);
export const voiceBytes = (bps, seconds) => Math.ceil((bps * seconds) / 8);

/** Para una nota de `seconds`, el códec de más calidad que cabe; si ninguno cabe, cuántos segundos caben en el más ligero. */
export function voiceNotePlan(seconds, budgetBytes) {
  const fit = VOICE_CODECS.find((c) => voiceBytes(c.bps, seconds) <= budgetBytes);
  if (fit) return { codec: fit.id, bps: fit.bps, bytes: voiceBytes(fit.bps, seconds), seconds, truncated: false };
  const lo = VOICE_CODECS[VOICE_CODECS.length - 1], s = Math.floor((budgetBytes * 8) / lo.bps);
  return { codec: lo.id, bps: lo.bps, bytes: voiceBytes(lo.bps, s), seconds: s, truncated: true, suggestion: 'Enviar como texto (dictado en el propio móvil) o esperar una vía con más capacidad' };
}

/* ───────────────────────── Grupos ───────────────────────── */

/**
 * Bytes para enviar un mensaje de `bodyBytes` a un grupo de `members` personas (incluido el emisor).
 *  · Sobre por miembro: (m − 1) · (overhead + cuerpo).
 *  · Clave de remitente: un sobre cifrado con la clave del grupo (overhead + cuerpo) más, la PRIMERA vez,
 *    (m − 1) sobres con la clave (overhead + 32 B). `envelopeOverhead` se MIDE con envelope.mjs.
 */
export function groupCost({ members, bodyBytes, envelopeOverhead, messagesInSession }) {
  for (const [k, v] of Object.entries({ members, bodyBytes, envelopeOverhead, messagesInSession })) if (!Number.isFinite(v)) throw new Error(`groupCost: «${k}» debe declararse`);
  const pairwise = (members - 1) * (envelopeOverhead + bodyBytes) * messagesInSession;
  const senderKey = (members - 1) * (envelopeOverhead + 32) + (envelopeOverhead + bodyBytes) * messagesInSession;
  return { pairwise, senderKey, best: senderKey < pairwise ? 'SENDER_KEY' : 'PAIRWISE', breakEvenMessages: members > 2 ? Math.floor(((members - 1) * (envelopeOverhead + 32)) / ((members - 2) * (envelopeOverhead + bodyBytes))) + 1 : null };
}

/* ───────────────────────── Cola con prioridad: mochila exacta ───────────────────────── */

/**
 * items: [{id, bytes, value}] · budgetBytes entero. Maximiza Σ value con Σ bytes ≤ presupuesto (0/1 exacto).
 * Los valores son una POLÍTICA declarada por quien configura la app (p. ej. SOS ≫ texto > voz > foto > estado).
 */
export function scheduleWindow(items, budgetBytes) {
  const B = Math.floor(budgetBytes), n = items.length;
  if (B * n > 5e7) throw new RangeError('instancia demasiado grande para la DP exacta');
  const dp = new Float64Array(B + 1), take = Array.from({ length: n }, () => new Uint8Array(B + 1));
  items.forEach((it, i) => {
    if (!(Number.isInteger(it.bytes) && it.bytes >= 0 && Number.isFinite(it.value))) throw new Error(`elemento ${it.id}: bytes y value declarados`);
    for (let b = B; b >= it.bytes; b--) { const v = dp[b - it.bytes] + it.value; if (v > dp[b]) { dp[b] = v; take[i][b] = 1; } }
  });
  const chosen = []; let b = B;
  for (let i = n - 1; i >= 0; i--) if (take[i][b]) { chosen.push(items[i].id); b -= items[i].bytes; }
  return { chosen: chosen.reverse(), value: dp[B], bytes: B - b };
}

/* ───────────────────────── Composición: qué forma tiene cada mensaje en esta vía ───────────────────────── */

/**
 * Elige la forma de un mensaje para un presupuesto de bytes de CUERPO (ya descontado el sobre).
 * Devuelve { form, bytes, pending } donde `pending` indica que la versión completa queda en cola para una vía mejor.
 */
export function formFor(msg, budgetBytes) {
  switch (msg.type) {
    case 'SOS': case 'TEXT': case 'REPLY': case 'REACTION': case 'STATUS': {
      const bytes = new TextEncoder().encode(msg.text ?? '').length + (msg.type === 'REPLY' ? 16 : 0);
      return bytes <= budgetBytes ? { form: 'FULL', bytes, pending: false } : { form: 'TOO_BIG', bytes, pending: true };
    }
    case 'LOCATION': return 8 <= budgetBytes ? { form: 'FULL', bytes: 8, pending: false } : { form: 'TOO_BIG', bytes: 8, pending: true };
    case 'VOICE': { const p = voiceNotePlan(msg.seconds, budgetBytes); return { form: p.truncated ? 'VOICE_TRUNCATED' : p.codec, bytes: p.bytes, pending: p.truncated || p.bps < 6000 }; }
    case 'PHOTO': {
      if (msg.fullBytes != null && msg.fullBytes <= budgetBytes) return { form: 'FULL', bytes: msg.fullBytes, pending: false };
      const t = msg.rgba ? bestThumbForBudget(msg.rgba, msg.w, msg.h, budgetBytes) : null;
      return t ? { form: `THUMB_${t.tw}x${t.th}`, bytes: t.bytes, psnrDb: t.psnrDb, pending: true } : { form: 'TOO_BIG', bytes: msg.fullBytes ?? null, pending: true };
    }
    default: throw new Error(`tipo desconocido: ${msg.type}`);
  }
}

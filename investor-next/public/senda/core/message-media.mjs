// @ts-check
/**
 * SENDA · mensaje corto con foto (formato SM1), para meter DENTRO del sobre cifrado de envelope.mjs (cuerpo binario).
 *   'S','M','1' · hora de creación (ms, 6 bytes) · flags (bit0 = lleva imagen) · longitud del texto (2 bytes) · texto UTF-8
 *   · [tipo de imagen (1 = WebP, 2 = JPEG) · bytes de la imagen]
 * Límites (decisión de producto, declarada): texto ≤ 200 caracteres (como un tuit corto) e imagen ≤ 12 KB, para que el
 * mensaje quepa en un envío por Bluetooth de pocos segundos y en un paquete .senda pequeño. La hora va dentro del cifrado
 * y sirve para medir cuánto tardó en llegar (con el reloj de cada móvil).
 */
export const MAX_TEXT_CHARS = 200, MAX_IMAGE_BYTES = 12 * 1024;
const MAGIC = [0x53, 0x4d, 0x31], MIME = { 1: 'image/webp', 2: 'image/jpeg' }, MIME_ID = { 'image/webp': 1, 'image/jpeg': 2 };
const enc = new TextEncoder(), dec = new TextDecoder();

/** @param {{ text: string, createdAt: number, image?: { mime: string, bytes: Uint8Array } | null }} m */
export function packRich({ text, createdAt, image = null }) {
  const t = String(text ?? '').trim();
  if ([...t].length > MAX_TEXT_CHARS) throw new RangeError(`texto de más de ${MAX_TEXT_CHARS} caracteres`);
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new RangeError('hora de creación no válida');
  if (image && !MIME_ID[image.mime]) throw new Error('solo WebP o JPEG');
  if (image && image.bytes.length > MAX_IMAGE_BYTES) throw new RangeError(`imagen de más de ${MAX_IMAGE_BYTES} bytes`);
  const tb = enc.encode(t), out = new Uint8Array(3 + 6 + 1 + 2 + tb.length + (image ? 1 + image.bytes.length : 0));
  out.set(MAGIC, 0); let v = createdAt; for (let i = 8; i >= 3; i--) { out[i] = v % 256; v = Math.floor(v / 256); }
  out[9] = image ? 1 : 0; out[10] = tb.length >> 8; out[11] = tb.length & 255; out.set(tb, 12);
  if (image) { out[12 + tb.length] = MIME_ID[image.mime]; out.set(image.bytes, 13 + tb.length); }
  return out;
}
export const isRich = (b) => b instanceof Uint8Array && b.length >= 12 && b[0] === MAGIC[0] && b[1] === MAGIC[1] && b[2] === MAGIC[2];
/** @returns {{ text: string, createdAt: number, image: { mime: string, bytes: Uint8Array } | null }} */
export function unpackRich(b) {
  if (!isRich(b)) throw new Error('no es un mensaje SM1');
  let createdAt = 0; for (let i = 3; i <= 8; i++) createdAt = createdAt * 256 + b[i];
  const n = (b[10] << 8) | b[11]; if (12 + n > b.length) throw new Error('mensaje SM1 truncado');
  const text = dec.decode(b.subarray(12, 12 + n));
  let image = null;
  if (b[9] & 1) { const mime = MIME[b[12 + n]]; if (!mime) throw new Error('tipo de imagen desconocido'); image = { mime, bytes: b.slice(13 + n) }; if (image.bytes.length > MAX_IMAGE_BYTES) throw new Error('imagen demasiado grande'); }
  return { text, createdAt, image };
}
/** Registro de pruebas: cuánto tardó un mensaje (con los relojes de los dos móviles; ojo a su diferencia). */
export function latency(entry) { return Number.isFinite(entry?.createdAt) && Number.isFinite(entry?.receivedAt) ? entry.receivedAt - entry.createdAt : null; }

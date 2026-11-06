/**
 * Escritor ZIP mínimo, sin dependencias y DETERMINISTA (misma entrada → mismos bytes):
 * - entradas ordenadas y fecha fija, para que regenerar la entrega sin cambios no engorde el repositorio;
 * - deflate (zlib de Node) para texto; «store» para lo que ya va comprimido (vídeo, imágenes, fuentes);
 * - nombres en UTF-8 (bit 11) y permisos Unix 0644.
 * Límites: < 65.535 ficheros y < 4 GB por archivo (sin ZIP64), de sobra para la entrega.
 */
import { deflateRawSync, crc32 as zcrc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const STORE_EXT = /\.(mp4|webm|mov|jpe?g|png|webp|gif|woff2?|zip|gz|br|onnx|pdf)$/i;
const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01 00:00

let table = null;
function crc32(buf) {
  if (typeof zcrc32 === 'function') return zcrc32(buf) >>> 0;
  table ??= Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param {string} outPath
 * @param {Array<{name:string, data:Buffer}>} entries rutas con «/», sin barra inicial
 * @returns {{files:number, bytes:number, raw:number}}
 */
export function writeZip(outPath, entries) {
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (sorted.length >= 0xffff) throw new Error('demasiados ficheros para un ZIP sin ZIP64');
  const parts = [], central = []; let off = 0, raw = 0;
  for (const { name, data } of sorted) {
    const nm = Buffer.from(name, 'utf8'), crc = crc32(data), store = STORE_EXT.test(name) || data.length < 64;
    let body = store ? data : deflateRawSync(data, { level: 9 }); let method = 8;
    if (store || body.length >= data.length) { body = data; method = 0; }
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8); lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(0x0314, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10); ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE((0o100644 << 16) >>> 0, 38); ch.writeUInt32LE(off, 42);
    parts.push(lh, nm, body); central.push(ch, nm); off += 30 + nm.length + body.length; raw += data.length;
    if (off > 0xffffffff) throw new Error('el ZIP supera 4 GB');
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(sorted.length, 8); end.writeUInt16LE(sorted.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16); end.writeUInt16LE(0, 20);
  const buf = Buffer.concat([...parts, cd, end]); writeFileSync(outPath, buf);
  return { files: sorted.length, bytes: buf.length, raw };
}

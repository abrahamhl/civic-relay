/** Lectura de Terrain Tiles (terrarium) en Node: descarga con caché, PNG mínimo y huella SHA-256. */
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeTerrarium } from '../../src/geo-survey.mjs';

export const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const CACHE = join(tmpdir(), 'senda-terrarium'); mkdirSync(CACHE, { recursive: true });

/** Decodificador PNG mínimo: 8 bits, RGB o RGBA, sin entrelazado (lo que sirven las Terrain Tiles). */
export function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG no soportado'); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error(`tipo de color ${ct} no soportado`);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { out.set(cur.subarray(x * bpp, x * bpp + 3), (y * w + x) * 4); out[(y * w + x) * 4 + 3] = 255; }
    prev.set(cur);
  }
  return { w, h, rgba: out };
}

export async function tile(t) {
  const f = join(CACHE, `${t.z}-${t.x}-${t.y}.png`);
  let buf;
  if (existsSync(f)) buf = readFileSync(f);
  else {
    const r = await fetch(TILE_URL(t.z, t.x, t.y)); if (!r.ok) throw new Error(`${r.status} en ${TILE_URL(t.z, t.x, t.y)}`);
    buf = Buffer.from(await r.arrayBuffer()); writeFileSync(f, buf);
  }
  const png = decodePng(buf); if (png.w !== 256) throw new Error('tesela de tamaño inesperado');
  return { ...t, heights: decodeTerrarium(png.rgba), sha256: createHash('sha256').update(buf).digest('hex') };
}


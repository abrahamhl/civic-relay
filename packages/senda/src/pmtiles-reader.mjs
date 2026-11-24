/**
 * SENDA · Lector puro JS de archivos PMTiles v3 (mapas vectoriales/raster 100 % sin red, 0 €).
 *
 * Especificación PMTiles v3: Protomaps (dominio público / CC0, https://github.com/protomaps/PMTiles).
 * Permite cargar un archivo `.pmtiles` local en MapLibre GL JS mediante `addProtocol('pmtiles', ...)`
 * sin servidor de teselas, sin Internet y sin añadir dependencias externas al APK.
 */

export const PMTILES_HEADER_BYTES = 127;
export const PMTILES_COMPRESSION = Object.freeze({ 0: 'unknown', 1: 'none', 2: 'gzip', 3: 'brotli', 4: 'zstd' });
export const PMTILES_TILE_TYPE = Object.freeze({ 0: 'unknown', 1: 'mvt', 2: 'png', 3: 'jpeg', 4: 'webp', 5: 'avif' });

/** Lee un varint sin signo (LEB128) desde un Uint8Array; devuelve [valor, nuevoOffset]. */
export function readVarint(u, pos) {
  let val = 0, shift = 0;
  while (pos < u.length) {
    const b = u[pos++];
    val += (b & 0x7f) * (2 ** shift);
    if ((b & 0x80) === 0) return [val, pos];
    shift += 7;
    if (shift > 53) throw new Error('PMTiles varint fuera de rango');
  }
  throw new Error('PMTiles varint truncado');
}

function rotate(n, xy, rx, ry) {
  if (ry === 0) {
    if (rx === 1) { xy[0] = n - 1 - xy[0]; xy[1] = n - 1 - xy[1]; }
    const t = xy[0]; xy[0] = xy[1]; xy[1] = t;
  }
}

/** Convierte coordenadas de tesela (z, x, y) a TileID sobre la curva de Hilbert (spec PMTiles v3). */
export function zxyToTileId(z, x, y) {
  if (z < 0 || z > 26) throw new Error(`zoom PMTiles fuera de rango: ${z}`);
  let acc = 0;
  for (let i = 0; i < z; i++) acc += 4 ** i;
  const n = 2 ** z;
  const xy = [x, y];
  let d = 0;
  for (let s = n / 2; s >= 1; s = Math.floor(s / 2)) {
    const rx = (xy[0] & s) > 0 ? 1 : 0;
    const ry = (xy[1] & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    rotate(s, xy, rx, ry);
  }
  return acc + d;
}

/** Inversa exacta: TileID de Hilbert → { z, x, y }. */
export function tileIdToZxy(tileId) {
  let acc = 0;
  for (let z = 0; z <= 26; z++) {
    const count = 4 ** z;
    if (tileId < acc + count) {
      let t = tileId - acc;
      const n = 2 ** z;
      const xy = [0, 0];
      for (let s = 1; s < n; s *= 2) {
        const rx = 1 & Math.floor(t / 2);
        const ry = 1 & (t ^ rx);
        rotate(s, xy, rx, ry);
        xy[0] += s * rx;
        xy[1] += s * ry;
        t = Math.floor(t / 4);
      }
      return { z, x: xy[0], y: xy[1] };
    }
    acc += count;
  }
  throw new Error(`TileID PMTiles fuera de rango: ${tileId}`);
}

/** Analiza la cabecera binaria fija de 127 bytes de PMTiles v3. */
export function parsePmTilesHeader(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u.byteLength < PMTILES_HEADER_BYTES) throw new Error('PMTiles: cabecera < 127 bytes');
  const magic = String.fromCharCode(...u.subarray(0, 7));
  if (magic !== 'PMTiles') throw new Error(`PMTiles: firma no válida («${magic}»)`);
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  const version = dv.getUint8(7);
  if (version !== 3) throw new Error(`PMTiles: versión ${version} no soportada (se espera 3)`);
  const u64 = (off) => Number(dv.getBigUint64(off, true));
  const ic = dv.getUint8(97), tc = dv.getUint8(98), tt = dv.getUint8(99);
  return {
    version,
    rootOffset: u64(8),
    rootLength: u64(16),
    metadataOffset: u64(24),
    metadataLength: u64(32),
    leafDirOffset: u64(40),
    leafDirLength: u64(48),
    tileDataOffset: u64(56),
    tileDataLength: u64(64),
    numAddressedTiles: u64(72),
    numTileEntries: u64(80),
    numTileContents: u64(88),
    clustered: dv.getUint8(96) === 1,
    internalCompression: PMTILES_COMPRESSION[ic] ?? 'unknown',
    tileCompression: PMTILES_COMPRESSION[tc] ?? 'unknown',
    tileType: PMTILES_TILE_TYPE[tt] ?? 'unknown',
    minZoom: dv.getUint8(100),
    maxZoom: dv.getUint8(101),
    minLon: dv.getInt32(102, true) / 1e7,
    minLat: dv.getInt32(106, true) / 1e7,
    maxLon: dv.getInt32(110, true) / 1e7,
    maxLat: dv.getInt32(114, true) / 1e7,
    centerZoom: dv.getUint8(118),
    centerLon: dv.getInt32(119, true) / 1e7,
    centerLat: dv.getInt32(123, true) / 1e7,
  };
}

/** Decodifica un directorio PMTiles v3 descomprimido (deltas de tileId, runLength, length, offset). */
export function decodeDirectory(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let pos = 0, numEntries;
  [numEntries, pos] = readVarint(u, pos);
  const entries = new Array(numEntries);
  let lastId = 0;
  for (let i = 0; i < numEntries; i++) {
    let delta; [delta, pos] = readVarint(u, pos);
    lastId += delta;
    entries[i] = { tileId: lastId, offset: 0, length: 0, runLength: 0 };
  }
  for (let i = 0; i < numEntries; i++) [entries[i].runLength, pos] = readVarint(u, pos);
  for (let i = 0; i < numEntries; i++) [entries[i].length, pos] = readVarint(u, pos);
  for (let i = 0; i < numEntries; i++) {
    let tmp; [tmp, pos] = readVarint(u, pos);
    if (tmp === 0 && i > 0) entries[i].offset = entries[i - 1].offset + entries[i - 1].length;
    else entries[i].offset = tmp - 1;
  }
  return entries;
}

/** Búsqueda binaria de un tileId en un directorio ordenado PMTiles v3. */
export function findTileEntry(entries, tileId) {
  let lo = 0, hi = entries.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const e = entries[mid];
    if (tileId < e.tileId) hi = mid - 1;
    else if (e.runLength === 0) return e; // puntero a directorio hoja
    else if (tileId >= e.tileId + e.runLength) lo = mid + 1;
    else return e;
  }
  if (hi >= 0 && entries[hi].runLength === 0) return entries[hi];
  return null;
}

async function maybeGunzip(u, compression) {
  if (compression === 'none') return u;
  if (compression !== 'gzip') throw new Error(`PMTiles: compresión ${compression} no soportada sin dependencias`);
  const ds = new DecompressionStream('gzip');
  const w = ds.writable.getWriter(); w.write(u); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

/**
 * Abre un Blob/File/Uint8Array PMTiles v3 local (100 % sin red) para servir teselas a MapLibre GL JS.
 */
export async function openPmTilesLocal(source) {
  const slice = async (off, len) => {
    if (source instanceof Uint8Array) return source.subarray(off, off + len);
    if (source instanceof ArrayBuffer) return new Uint8Array(source, off, len);
    return new Uint8Array(await source.slice(off, off + len).arrayBuffer());
  };
  const header = parsePmTilesHeader(await slice(0, PMTILES_HEADER_BYTES));
  const rootRaw = await slice(header.rootOffset, header.rootLength);
  const rootEntries = decodeDirectory(await maybeGunzip(rootRaw, header.internalCompression));
  const metaRaw = header.metadataLength ? await slice(header.metadataOffset, header.metadataLength) : null;
  const metadata = metaRaw ? JSON.parse(new TextDecoder().decode(await maybeGunzip(metaRaw, header.internalCompression))) : {};

  async function lookup(entries, tileId, depth = 0) {
    if (depth > 3) return null;
    const e = findTileEntry(entries, tileId);
    if (!e) return null;
    if (e.runLength === 0) {
      const leafRaw = await slice(header.leafDirOffset + e.offset, e.length);
      const leaf = decodeDirectory(await maybeGunzip(leafRaw, header.internalCompression));
      return lookup(leaf, tileId, depth + 1);
    }
    const raw = await slice(header.tileDataOffset + e.offset, e.length);
    return maybeGunzip(raw, header.tileCompression);
  }

  return {
    header,
    metadata,
    getTile: (z, x, y) => lookup(rootEntries, zxyToTileId(z, x, y)),
  };
}

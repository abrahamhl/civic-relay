import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  PMTILES_HEADER_BYTES,
  zxyToTileId,
  tileIdToZxy,
  parsePmTilesHeader,
  decodeDirectory,
  openPmTilesLocal,
} from '../src/pmtiles-reader.mjs';

function encodeVarint(v) {
  const out = [];
  let n = v;
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
  return out;
}

/** Construye un archivo binario PMTiles v3 válido en memoria (sin dependencias). */
function buildSyntheticPmTiles({ tiles, metadata = { name: 'senda-test' }, gzip = false }) {
  const sorted = tiles
    .map((t) => ({ id: zxyToTileId(t.z, t.x, t.y), data: t.data }))
    .sort((a, b) => a.id - b.id);

  const tileChunks = [];
  const entries = [];
  let tileOff = 0;
  for (const t of sorted) {
    const raw = gzip ? new Uint8Array(zlib.gzipSync(t.data)) : t.data;
    entries.push({ id: t.id, runLength: 1, length: raw.length, offset: tileOff });
    tileChunks.push(raw);
    tileOff += raw.length;
  }

  // Directorio raíz en formato varint PMTiles v3
  const dirBytes = [];
  dirBytes.push(...encodeVarint(entries.length));
  let prevId = 0;
  for (const e of entries) { dirBytes.push(...encodeVarint(e.id - prevId)); prevId = e.id; }
  for (const e of entries) dirBytes.push(...encodeVarint(e.runLength));
  for (const e of entries) dirBytes.push(...encodeVarint(e.length));
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].offset === entries[i - 1].offset + entries[i - 1].length) dirBytes.push(...encodeVarint(0));
    else dirBytes.push(...encodeVarint(entries[i].offset + 1));
  }
  const rootBuf = gzip ? new Uint8Array(zlib.gzipSync(Uint8Array.from(dirBytes))) : Uint8Array.from(dirBytes);
  const metaRaw = new TextEncoder().encode(JSON.stringify(metadata));
  const metaBuf = gzip ? new Uint8Array(zlib.gzipSync(metaRaw)) : metaRaw;

  const rootOff = PMTILES_HEADER_BYTES;
  const metaOff = rootOff + rootBuf.length;
  const dataOff = metaOff + metaBuf.length;
  const total = dataOff + tileOff;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  out.set(new TextEncoder().encode('PMTiles'), 0);
  dv.setUint8(7, 3);
  dv.setBigUint64(8, BigInt(rootOff), true);
  dv.setBigUint64(16, BigInt(rootBuf.length), true);
  dv.setBigUint64(24, BigInt(metaOff), true);
  dv.setBigUint64(32, BigInt(metaBuf.length), true);
  dv.setBigUint64(40, BigInt(dataOff), true);
  dv.setBigUint64(48, 0n, true);
  dv.setBigUint64(56, BigInt(dataOff), true);
  dv.setBigUint64(64, BigInt(tileOff), true);
  dv.setBigUint64(72, BigInt(entries.length), true);
  dv.setBigUint64(80, BigInt(entries.length), true);
  dv.setBigUint64(88, BigInt(entries.length), true);
  dv.setUint8(96, 1);
  dv.setUint8(97, gzip ? 2 : 1); // internalCompression
  dv.setUint8(98, gzip ? 2 : 1); // tileCompression
  dv.setUint8(99, 1); // MVT
  dv.setUint8(100, 0);
  dv.setUint8(101, 14);
  dv.setInt32(102, Math.round(-4.0 * 1e7), true);
  dv.setInt32(106, Math.round(40.0 * 1e7), true);
  dv.setInt32(110, Math.round(-3.5 * 1e7), true);
  dv.setInt32(114, Math.round(40.6 * 1e7), true);
  dv.setUint8(118, 12);
  dv.setInt32(119, Math.round(-3.7038 * 1e7), true);
  dv.setInt32(123, Math.round(40.4168 * 1e7), true);

  out.set(rootBuf, rootOff);
  out.set(metaBuf, metaOff);
  let p = dataOff;
  for (const ch of tileChunks) { out.set(ch, p); p += ch.length; }
  return out;
}

test('PMTiles v3: curva de Hilbert zxyToTileId ↔ tileIdToZxy exacta en zooms 0..14', () => {
  const cases = [
    [0, 0, 0], [1, 0, 0], [1, 1, 1], [2, 3, 2],
    [10, 501, 385], [14, 8023, 6172],
  ];
  for (const [z, x, y] of cases) {
    const id = zxyToTileId(z, x, y);
    const back = tileIdToZxy(id);
    assert.deepEqual(back, { z, x, y });
  }
  assert.equal(zxyToTileId(0, 0, 0), 0);
  assert.equal(zxyToTileId(1, 0, 0), 1);
});

test('PMTiles v3: abre archivo local sin comprimir y comprimido con gzip y sirve teselas exactas sin red', async () => {
  const t0 = new Uint8Array([0x1a, 0x05, 0x6d, 0x76, 0x74, 0x30]);
  const t1 = new Uint8Array([0x1a, 0x06, 0x6d, 0x61, 0x64, 0x72, 0x69, 0x64]);
  for (const gzip of [false, true]) {
    const bin = buildSyntheticPmTiles({
      gzip,
      metadata: { name: 'madrid-offline', vector_layers: [{ id: 'roads' }] },
      tiles: [
        { z: 0, x: 0, y: 0, data: t0 },
        { z: 12, x: 2005, y: 1543, data: t1 },
      ],
    });
    const hdr = parsePmTilesHeader(bin);
    assert.equal(hdr.version, 3);
    assert.equal(hdr.tileType, 'mvt');
    assert.equal(hdr.internalCompression, gzip ? 'gzip' : 'none');

    const reader = await openPmTilesLocal(new Blob([bin]));
    assert.equal(reader.metadata.name, 'madrid-offline');
    assert.deepEqual(await reader.getTile(0, 0, 0), t0);
    assert.deepEqual(await reader.getTile(12, 2005, 1543), t1);
    assert.equal(await reader.getTile(12, 1, 1), null);
  }
});

test('PMTiles v3: decodeDirectory y validación de cabecera rechazan archivos corruptos', () => {
  assert.throws(() => parsePmTilesHeader(new Uint8Array(10)), /cabecera < 127/);
  const bad = new Uint8Array(127);
  assert.throws(() => parsePmTilesHeader(bad), /firma no válida/);
  const entries = decodeDirectory(Uint8Array.from([1, 5, 1, 10, 1]));
  assert.deepEqual(entries, [{ tileId: 5, runLength: 1, length: 10, offset: 0 }]);
});

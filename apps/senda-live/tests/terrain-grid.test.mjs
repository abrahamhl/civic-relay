import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import {
  terrainTileCoverage, terrainRegionBounds, decodeTerrariumPng, terrariumMeters,
  sampleTerrainGrid, createTerrainGridFeed, TERRAIN_DATASET
} from '../server/domain/terrain-grid.mjs';

const NOW = Date.parse('2026-11-09T09:00:00Z');

function chunk(name, data) {
  // The production decoder verifies structure and uncompressed extent; fixture CRC
  // is intentionally zero because CRC integrity is not yet a source authenticity proof.
  const len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, Buffer.from(name), data, crc]);
}
function pngTile(heightM = 123.25, channels = 3, filter = 0) {
  const encoded = heightM + 32768;
  const rgb = [Math.floor(encoded / 256), Math.floor(encoded) % 256, Math.round((encoded % 1) * 256)];
  const stride = 256 * channels, bytes = Buffer.alloc(257 * channels * 256 / channels);
  let p = 0;
  for (let row = 0; row < 256; row++) {
    bytes[p++] = filter;
    for (let col = 0; col < 256; col++) {
      const rgba = channels === 4 ? [...rgb, 255] : rgb;
      for (let channel = 0; channel < channels; channel++) {
        const original = rgba[channel];
        // All pixels in a row have equal source values. Valid PNG Sub filter:
        // first pixel is raw, later pixels store zero.
        bytes[p++] = filter === 1 && col > 0 ? 0 : original;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(256, 0); ihdr.writeUInt32BE(256, 4);
  ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(bytes)), chunk('IEND', Buffer.alloc(0))
  ]);
}
const asResponse = (png, status = 200) => new Response(new Uint8Array(png), {
  status, headers: { 'content-type': 'image/png', 'content-length': String(png.length) }
});

test('fixed region bounds and Mercator tile budget support all four geographic centers', () => {
  for (const region of ['valencia', 'madrid', 'arnhem', 'veenendaal']) {
    const { bounds, ids } = terrainTileCoverage(region);
    assert.ok(ids.length >= 1 && ids.length <= 16);
    assert.ok(bounds.north > bounds.south && bounds.east > bounds.west);
    for (const tile of ids) assert.match(tile.url, /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\/10\/\d+\/\d+\.png$/);
  }
  assert.throws(() => terrainTileCoverage('my-home'), /TERRAIN_UNKNOWN_REGION/);
  assert.throws(() => terrainTileCoverage('valencia', 15), /INVALID_TERRAIN_ZOOM/);
  assert.equal(terrainRegionBounds('valencia').center.lat, 39.4699);
});

test('Terrarium decoder reconstructs elevation in meters for RGB, RGBA and Sub filter', () => {
  for (const channels of [3, 4]) for (const filter of [0, 1]) {
    const tile = decodeTerrariumPng(pngTile(178.25, channels, filter));
    assert.equal(tile.width, 256);
    assert.equal(tile.height, 256);
    assert.equal(tile.channels, channels);
    assert.equal(terrariumMeters(tile, 30, 80), 178.25);
    assert.equal(terrariumMeters(tile, 255, 255), 178.25);
  }
});

test('real georeferenced terrain mesh uses sampled DEM altitudes, not atmospheric extrusion', () => {
  const { ids } = terrainTileCoverage('valencia');
  const map = new Map(ids.map((tile, i) => [tile.key, decodeTerrariumPng(pngTile(100 + i * 25))]));
  const result = sampleTerrainGrid({ region: 'valencia', pngTiles: map,
    acquiredAt: new Date(NOW).toISOString(),
    tileHashes: ids.map((t) => ({ tile: t.key, sha256: 'a'.repeat(64) })) });
  assert.equal(result.schema, 'senda.terrain.grid/1');
  assert.equal(result.rows, 33); assert.equal(result.columns, 33);
  assert.equal(result.elevationsM.length, 1089);
  assert.ok(result.elevationsM.every((h) => Number.isFinite(h) && h >= 100 && h <= 100 + (ids.length - 1) * 25));
  assert.equal(result.dataKind, 'RASTER_DEM_SAMPLES');
  assert.equal(result.georeference.crs, 'EPSG:4326');
  assert.equal(result.isVerifiedNavigationClearance, false);
  assert.equal(result.source.offlineRedistributionReviewRequired, true);
  assert.ok(result.georeference.approximateWidthM > 15_000);
  assert.ok(result.summary.maxElevationM >= result.summary.minElevationM);
});

test('finite bounds and truncation block invalid tiles and oversized responses', async () => {
  assert.throws(() => decodeTerrariumPng(Buffer.from('not a png')), /INVALID_TERRARIUM_PNG/);
  assert.throws(() => terrariumMeters(decodeTerrariumPng(pngTile()), 256, 0), /BAD_ELEVATION_PIXEL/);
  const feed = createTerrainGridFeed({ clock: () => NOW, fetcher: async () =>
    new Response('bad', { status: 200, headers: { 'content-length': '99999999' } }) });
  assert.equal((await feed.read('valencia')).status, 'UNAVAILABLE');
});

test('source acquisition is bounded, cache coalesces requests, outage keeps only explicit stale snapshot', async () => {
  let time = NOW, requested = 0, failing = false;
  const encoded = pngTile(210);
  const tileCount = terrainTileCoverage('madrid').ids.length;
  const feed = createTerrainGridFeed({
    clock: () => time, ttlMs: 10_000, maxStaleMs: 20_000,
    fetcher: async (url, options) => {
      requested++;
      assert.match(url, /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\//);
      assert.equal(options.redirect, 'error');
      if (failing) throw new Error('NETWORK_FAILURE');
      return asResponse(encoded);
    },
  });
  const [one, two] = await Promise.all([feed.read('madrid'), feed.read('madrid')]);
  assert.equal(requested, tileCount);
  assert.equal(one.status, 'SOURCE_SNAPSHOT');
  assert.equal(two.elevationsM.length, 33 * 33);
  assert.equal(one.summary.minElevationM, 210);
  assert.equal(one.summary.maxElevationM, 210);
  assert.equal(one.source.rawTileSha256.length, tileCount);
  assert.equal((await feed.read('madrid')).status, 'CACHED_SNAPSHOT');
  time += 11_000; failing = true;
  assert.equal((await feed.read('madrid')).status, 'STALE_SNAPSHOT');
  time += 25_000;
  assert.equal((await feed.read('madrid')).status, 'UNAVAILABLE');
  assert.equal((await feed.read('custom-visitor-coordinate')).status, 'INVALID_REGION');
});

test('source response never becomes an observed live sensor, emergency clearance or verified building geometry', async () => {
  const encoded = pngTile(-15);
  const feed = createTerrainGridFeed({ clock: () => NOW, fetcher: async () => asResponse(encoded) });
  const result = await feed.read('veenendaal');
  assert.equal(result.status, 'SOURCE_SNAPSHOT');
  assert.equal(result.isObservedLiveSensor, false);
  assert.equal(result.hasPreciseBuildings, false);
  assert.equal(result.isVerifiedNavigationClearance, false);
  assert.equal(result.summary.minElevationM, -15);
  assert.equal(result.source.dataset, TERRAIN_DATASET);
});

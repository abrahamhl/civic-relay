import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/index.mjs';
import {
  CotsDroneReconManager,
  calculateHaversineDistanceM,
  calculateBearingDeg,
} from '../server/domain/cots-drone-recon.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_COTS_DB = join(__dirname, '../data/test-cots.db');

test('COTS Drone Recon Domain: coordinates distance, bearing and antenna recipes', () => {
  // Test distance and bearing between Valencia Town Hall (39.4699, -0.3763) and Torres de Serrano (39.4791, -0.3758)
  const dist = calculateHaversineDistanceM(39.4699, -0.3763, 39.4791, -0.3758);
  assert.ok(dist > 1000 && dist < 1050, `Distance should be ~1024m, got ${dist}`);

  const bearing = calculateBearingDeg(39.4699, -0.3763, 39.4791, -0.3758);
  assert.ok(bearing >= 0 && bearing < 10, `Bearing northwards should be ~2.5 deg, got ${bearing}`);

  const manager = new CotsDroneReconManager();
  const catalog = manager.getHardwareCatalogAndAntennas();
  assert.ok(catalog.totalBomCostEur < 35, 'Total hardware BOM must be under 35€');
  assert.equal(catalog.antennas.length, 5);

  const active = manager.getActiveTracks();
  assert.equal(active.length, 3, 'Synthetic scenario must provide 3 active radar/drone tracks');
  const rogue = active.find((d) => d.classification === 'UNAUTHORIZED_ROGUE');
  assert.ok(rogue);
  assert.ok(rogue.pilot);
  assert.ok(rogue.distanceToPilotM > 400);
});

test('COTS Drone Recon API: antenna recipes, Remote ID decoding and live drone detections', async () => {
  if (existsSync(TEST_COTS_DB)) rmSync(TEST_COTS_DB, { force: true });

  const { server, db } = createServer({ dbFile: TEST_COTS_DB });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /api/cots/antennas
    const antennasRes = await fetch(`${baseUrl}/api/cots/antennas`);
    assert.equal(antennasRes.status, 200);
    const antennasData = await antennasRes.json();
    assert.ok(antennasData.hardwareComponents.length >= 4);
    assert.ok(antennasData.antennas.length >= 5);
    const noaaAntenna = antennasData.antennas.find((a) => a.bandId === 'SATELLITE_NOAA_137');
    assert.ok(noaaAntenna);
    assert.equal(noaaAntenna.design.antennaType, 'QUADRIFILAR_HELIX_QFH');

    // 2. GET /api/cots/drone-detections
    const detectionsRes = await fetch(`${baseUrl}/api/cots/drone-detections`);
    assert.equal(detectionsRes.status, 200);
    const detectionsData = await detectionsRes.json();
    assert.ok(Array.isArray(detectionsData.drones));
    assert.equal(detectionsData.drones.length, 3);
    const pbrTarget = detectionsData.drones.find((d) => d.rfSource === 'PASSIVE_BISTATIC_RADAR_CAF');
    assert.ok(pbrTarget);
    assert.equal(pbrTarget.operationalStatus, 'RADAR_CONTACT');

    // 3. POST /api/cots/remote-id/decode
    // Synthesize Basic ID hex string: Type 0x01 (Type 0, ver 1), 0x12 (serial, multirotor), "1581F45X22090001"
    const raw = new Uint8Array(25);
    raw[0] = 0x01;
    raw[1] = 0x12;
    const serial = '1581F45X22090001';
    for (let i = 0; i < serial.length; i++) raw[2 + i] = serial.charCodeAt(i);
    const hex = Array.from(raw).map((b) => b.toString(16).padStart(2, '0')).join('');

    const decodeRes = await fetch(`${baseUrl}/api/cots/remote-id/decode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
      },
      body: JSON.stringify({ hex }),
    });
    assert.equal(decodeRes.status, 200);
    const decodeData = await decodeRes.json();
    assert.equal(decodeData.decoded.messageType, 'BASIC_ID');
    assert.equal(decodeData.decoded.uavId, serial);
    assert.equal(decodeData.track.serialNumber, serial);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    if (existsSync(TEST_COTS_DB)) rmSync(TEST_COTS_DB, { force: true });
  }
});

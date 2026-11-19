import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_UAV_DB = join(__dirname, '../data/test-uav.db');

test('UAV Tactical API: camera presets, boustrophedon mission plan and swarm RF evaluation', async () => {
  if (existsSync(TEST_UAV_DB)) rmSync(TEST_UAV_DB, { force: true });

  const { server, db } = createServer({ dbFile: TEST_UAV_DB });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /api/uav/camera-presets
    const presetsRes = await fetch(`${baseUrl}/api/uav/camera-presets`);
    assert.equal(presetsRes.status, 200);
    const presetsData = await presetsRes.json();
    assert.ok(presetsData.presets);
    assert.equal(presetsData.presets.DJI_MAVIC_3_ENTERPRISE.focalLengthMm, 12.3);
    assert.equal(presetsData.presets.DJI_ZENMUSE_P1.imageWidthPx, 8192);

    // 2. POST /api/uav/tactical-plan
    const planRes = await fetch(`${baseUrl}/api/uav/tactical-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
      },
      body: JSON.stringify({
        bbox: [-0.40, 39.45, -0.38, 39.47],
        targetGsdCm: 3.0,
        camera: 'DJI_MAVIC_3_ENTERPRISE',
        forwardOverlapPct: 80,
        sideOverlapPct: 70,
        cruiseSpeedMs: 12.0,
        operationalCeilingM: 300,
        emergencyScenario: 'WILDFIRE_RAPID_PERIMETER',
      }),
    });
    assert.equal(planRes.status, 200);
    const planData = await planRes.json();
    assert.equal(planData.success, true);
    assert.equal(planData.emergencyScenario, 'WILDFIRE_RAPID_PERIMETER');
    assert.ok(planData.planHashSha256);
    assert.ok(planData.waypoints.length >= 4);
    assert.equal(planData.geojson.type, 'FeatureCollection');
    assert.equal(planData.qgcPlan.fileType, 'Plan');

    // 3. GET /api/uav/tactical-plan (query string)
    const getPlanRes = await fetch(`${baseUrl}/api/uav/tactical-plan?bbox=-0.40,39.45,-0.38,39.47&targetGsdCm=3.0&camera=DJI_MAVIC_3_ENTERPRISE`);
    assert.equal(getPlanRes.status, 200);
    const getPlanData = await getPlanRes.json();
    assert.equal(getPlanData.success, true);
    assert.ok(getPlanData.waypoints.length >= 4);

    // 4. POST /api/uav/swarm-evaluation
    const swarmRes = await fetch(`${baseUrl}/api/uav/swarm-evaluation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
      },
      body: JSON.stringify({
        drones: [
          { id: 'relay-alpha', x: 0, y: 0, z: 150, role: 'RELAY_GATEWAY' },
          { id: 'survey-bravo', x: 450, y: 0, z: 120, role: 'IMAGING_SURVEY' },
          { id: 'survey-charlie', x: 225, y: 350, z: 120, role: 'SAR_INFRARED' },
        ],
        communicationRangeM: 600,
        frequencyHz: 868e6,
        envType: 'URBAN',
        groundResponderDistM: 800,
        ewThreat: {
          rfBandwidthHz: 20e6,
          dataRateBps: 250e3,
          requiredEbN0Db: 6.0,
        },
      }),
    });
    assert.equal(swarmRes.status, 200);
    const swarmData = await swarmRes.json();
    assert.equal(swarmData.success, true);
    assert.equal(swarmData.swarmSize, 3);
    assert.equal(swarmData.swarmConnectivity.isSwarmConnected, true);
    assert.ok(swarmData.swarmConnectivity.algebraicConnectivityFiedler > 0);
    assert.equal(swarmData.a2gEvaluations.length, 3);
    assert.ok(swarmData.antiJamming !== null);
    assert.ok(swarmData.antiJamming.processingGainDb > 15);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    if (existsSync(TEST_UAV_DB)) rmSync(TEST_UAV_DB, { force: true });
  }
});

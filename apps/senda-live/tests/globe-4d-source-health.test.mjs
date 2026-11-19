import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGlobeSourceHealth,
  GLOBE_SOURCE_DEFINITIONS,
} from '../web/src/science/globe-source-health.mjs';

test('Globe 4D Source Health: exposes definitions for all 9 platform feeds', () => {
  assert.equal(GLOBE_SOURCE_DEFINITIONS.length, 9);
  const ids = GLOBE_SOURCE_DEFINITIONS.map((d) => d.id);
  assert.ok(ids.includes('terrain'));
  assert.ok(ids.includes('weather'));
  assert.ok(ids.includes('effis'));
  assert.ok(ids.includes('aemet'));
  assert.ok(ids.includes('usgs'));
  assert.ok(ids.includes('recon'));
  assert.ok(ids.includes('mobility'));
  assert.ok(ids.includes('cots_drones'));
  assert.ok(ids.includes('cots_catalog'));
});

test('Globe 4D Source Health P0-06: 9 failures must NEVER say VERIFIED or report verified status', () => {
  // Simulate all 9 feeds failing (either rejected promises or status UNAVAILABLE)
  const nineFailures = Array.from({ length: 9 }, () => ({
    status: 'fulfilled',
    value: { status: 'UNAVAILABLE' },
  }));

  const health = computeGlobeSourceHealth(nineFailures);

  assert.equal(health.isAllVerified, false);
  assert.equal(health.availableCount, 0);
  assert.equal(health.failedCount, 9);
  assert.equal(health.overallStatus, 'DESCONECTADO');
  assert.equal(health.badgeText, 'DESCONECTADO (0/9)');

  // Critical verification: Status message must NOT say "VERIFICADO" or "Datos verificados"
  assert.equal(health.statusMessage.includes('VERIFICADO'), false);
  assert.equal(health.statusMessage.includes('Datos verificados'), false);
  assert.ok(health.statusMessage.includes('Desconectado'));
  assert.ok(health.statusMessage.includes('0/9'));

  // Each individual source in the panel must be marked UNAVAILABLE
  assert.equal(health.sources.length, 9);
  for (const src of health.sources) {
    assert.equal(src.status, 'UNAVAILABLE');
  }
});

test('Globe 4D Source Health P0-06: rejected promises are treated as failures without crashing', () => {
  const rejectedFailures = Array.from({ length: 9 }, () => ({
    status: 'rejected',
    reason: new Error('Network timeout'),
  }));

  const health = computeGlobeSourceHealth(rejectedFailures);

  assert.equal(health.isAllVerified, false);
  assert.equal(health.availableCount, 0);
  assert.equal(health.failedCount, 9);
  assert.equal(health.badgeText, 'DESCONECTADO (0/9)');
  assert.equal(health.statusMessage.includes('VERIFICADO'), false);
});

test('Globe 4D Source Health: partial degradation reports exact available count', () => {
  const partial = [
    { status: 'fulfilled', value: { status: 'OK', grid: [1, 2, 3] } }, // terrain ok
    { status: 'fulfilled', value: { status: 'UNAVAILABLE' } },           // weather fail
    { status: 'fulfilled', value: { observations: [{ id: 'wf1' }] } },  // effis ok
    { status: 'fulfilled', value: { status: 'UNAVAILABLE' } },           // aemet fail
    { status: 'fulfilled', value: { observations: [] } },                // usgs ok
    { status: 'fulfilled', value: { receipt: { rootSha256: 'abc123456789' } } }, // recon ok
    { status: 'fulfilled', value: { status: 'UNAVAILABLE' } },           // mobility fail
    { status: 'fulfilled', value: { status: 'LIVE_TRACKS_ACTIVE', drones: [{ id: 'uav1' }] } }, // cots ok
    { status: 'fulfilled', value: { antennas: [1, 2, 3, 4, 5] } },       // catalog ok
  ];

  const health = computeGlobeSourceHealth(partial);

  assert.equal(health.isAllVerified, false);
  assert.equal(health.availableCount, 6);
  assert.equal(health.failedCount, 3);
  assert.equal(health.overallStatus, 'DEGRADADO');
  assert.equal(health.badgeText, 'DEGRADADO (6/9)');
  assert.ok(health.statusMessage.includes('6/9'));
  assert.equal(health.statusMessage.includes('Todas las fuentes conectadas'), false);
});

test('Globe 4D Source Health: complete success marks all 9 sources as verified/available', () => {
  const completeSuccess = [
    { status: 'fulfilled', value: { status: 'ACTIVE_SNAPSHOT', grid: [10, 20] } },
    { status: 'fulfilled', value: { status: 'ACTIVE_SNAPSHOT' } },
    { status: 'fulfilled', value: { observations: [{ id: 'effis-1' }] } },
    { status: 'fulfilled', value: { warnings: [{ id: 'cap-1' }] } },
    { status: 'fulfilled', value: { observations: [{ id: 'usgs-1' }] } },
    { status: 'fulfilled', value: { receipt: { rootSha256: 'deadbeef1234' } } },
    { status: 'fulfilled', value: { incidents: [{ id: 'dgt-1' }] } },
    { status: 'fulfilled', value: { status: 'NO_LIVE_DETECTIONS', drones: [] } },
    { status: 'fulfilled', value: { antennas: [1, 2, 3, 4, 5] } },
  ];

  const health = computeGlobeSourceHealth(completeSuccess);

  assert.equal(health.isAllVerified, true);
  assert.equal(health.availableCount, 9);
  assert.equal(health.failedCount, 0);
  assert.equal(health.overallStatus, 'VERIFICADO');
  assert.equal(health.badgeText, 'VERIFICADO (9/9)');
  assert.ok(health.statusMessage.includes('verificadas'));
});

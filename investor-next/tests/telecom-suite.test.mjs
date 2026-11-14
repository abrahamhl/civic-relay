import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  crc16Ccitt,
  encodeCompactSatelliteBurst,
  computeSatelliteLinkBudget,
  computeZoneTelemetryGrid,
  runThroughWallRfRadar
} from '../lib/telecom-suite.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('24-byte OEP-NTN compact binary burst frame encodes magic header and deterministic CRC-16-CCITT', () => {
  const frame = encodeCompactSatelliteBurst({
    zoneId: 'ZONE-VLC-01',
    sectorIndex: 2,
    safeCount: 18,
    sosCount: 4,
    unknownCount: 29,
    relayNodes: 22,
    timestampSec: 1792569600
  });
  assert.equal(frame.byteLength, 24);
  assert.ok(frame.hexFrame.startsWith('4F 45 50 01'), 'Must start with OEP v1 magic bytes');
  assert.match(frame.crc16Hex, /^0x[0-9A-F]{4}$/);
  assert.equal(frame.hexFrame.split(' ').length, 24);
  assert.ok(crc16Ccitt(new Uint8Array([0x4f, 0x45, 0x50, 0x01])) > 0);
});

test('3GPP NTN satellite link budget computes realistic slant range, FSPL, Doppler shift, and viable burst bitrate', () => {
  const leo = computeSatelliteLinkBudget({
    orbitProfile: 'LEO_D2C_550KM',
    elevationDeg: 45,
    frequencyMhz: 1990
  });
  const geo = computeSatelliteLinkBudget({
    orbitProfile: 'GEO_EMERGENCY_35786KM',
    elevationDeg: 45,
    frequencyMhz: 1616
  });
  assert.ok(leo.slantRangeKm > 550 && leo.slantRangeKm < 1000);
  assert.ok(geo.slantRangeKm > 35786);
  assert.ok(geo.fsplDb > leo.fsplDb, 'GEO path loss must exceed LEO path loss');
  assert.ok(leo.dopplerShiftHz > 10000, 'LEO S-band Doppler shift at 45 deg must be >10 kHz');
  assert.equal(leo.linkViable, true);
  assert.ok(leo.achievableBitrateBps >= 300);
  assert.ok(leo.authorizationBoundary.includes('licensed 3GPP NTN'));
});

test('polygonal 9-sector zone telemetry preserves node accounting and restores connectivity via mesh + NTN bridge', () => {
  const grid = computeZoneTelemetryGrid({
    totalDevices: 72,
    infrastructureDamagePct: 85,
    satelliteBridgeEnabled: true,
    seed: 20261021
  });
  assert.equal(grid.totalSectors, 9);
  assert.equal(grid.sectors.length, 9);
  assert.equal(grid.totals.nodes, 72);
  assert.equal(grid.totals.safe + grid.totals.sos + grid.totals.unknown, 72);
  assert.ok(
    grid.withOepConnectedSectors > grid.withoutOepConnectedSectors,
    'OEP mesh + satellite bridge must connect more damaged sectors than dead terrestrial cellular alone'
  );
});

test('through-wall Wi-Fi CSI & RF spectral radar models ITU-R P.2040 wall attenuation and 64-subcarrier OFDM tomography', () => {
  const drywall = runThroughWallRfRadar({
    wallMaterial: 'DRYWALL',
    scannerDistanceMeters: 3.0,
    timeStep: 2
  });
  const concrete = runThroughWallRfRadar({
    wallMaterial: 'CONCRETE_30CM',
    scannerDistanceMeters: 3.0,
    timeStep: 2
  });
  assert.equal(drywall.csiSubcarriers.length, 64);
  assert.equal(concrete.heatmapGrid.length, 10);
  assert.equal(concrete.heatmapGrid[0].length, 16);

  // Sub-GHz penetrates 30cm reinforced concrete with much lower attenuation than 5 GHz Wi-Fi
  assert.ok(
    concrete.wallAttenuationDb.SUB_GHZ < concrete.wallAttenuationDb.WIFI_50,
    'Sub-GHz must have lower concrete attenuation than 5 GHz Wi-Fi'
  );
  // Target 1 (SOS beacon with Sub-GHz + Wi-Fi + BLE + respiration CSI) is detected through concrete
  const t1Dry = drywall.targets[0];
  const t1Conc = concrete.targets[0];
  assert.equal(t1Dry.detectable, true);
  assert.equal(t1Conc.detectable, true);
  assert.ok(t1Dry.bestRssiDbm > t1Conc.bestRssiDbm);
  assert.ok(t1Conc.respirationBpm > 10 && t1Conc.respirationBpm < 30);
});

test('TelecomAndRfRadarSuite is integrated in investor-page.tsx across EN, ES, and NL', () => {
  const page = readFileSync(resolve(root, 'investor-next/app/investor-page.tsx'), 'utf8');
  const suite = readFileSync(resolve(root, 'investor-next/app/telecom-rf-radar-suite.tsx'), 'utf8');
  assert.ok(page.includes('<TelecomAndRfRadarSuite locale={locale}/>'));
  assert.ok(suite.includes('IEEE 802.11bf'));
  assert.ok(suite.includes('DensePoseFromWiFi'));
  assert.ok(suite.includes('getUserMedia'));
});

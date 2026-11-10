import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeRemoteIdMessage,
  calculateBistaticRange,
  calculateBistaticDopplerVelocity,
  computePassiveRadarCafSlice,
  calculateInterferometricDoA,
  calculateHomebrewAntennaDesign,
  OPENDRONEID_MSG_TYPES,
} from '../../src/defense/cots-rf-tactical.mjs';

test('Remote ID ASTM F3411: decodes Basic ID message with serial number', () => {
  // Construct a synthetic ASTM F3411 Basic ID message (25 bytes)
  // Header: 0x01 (Type 0 = Basic ID, Version 1)
  const bytes = new Array(25).fill(0);
  bytes[0] = (OPENDRONEID_MSG_TYPES.BASIC_ID << 4) | 0x01;
  bytes[1] = (0x01 << 4) | 0x02; // ID type 1 (Serial Number ANSI/CTA-2063), UAV type 2 (Multirotor)
  const serial = '1581F45X22090001';
  for (let i = 0; i < serial.length; i++) {
    bytes[2 + i] = serial.charCodeAt(i);
  }

  const decoded = decodeRemoteIdMessage(bytes);
  assert.equal(decoded.messageType, 'BASIC_ID');
  assert.equal(decoded.protocolVersion, 1);
  assert.equal(decoded.idType, 'SERIAL_NUMBER_ANSI_CTA_2063');
  assert.equal(decoded.uavId, serial);
});

test('Remote ID ASTM F3411: decodes Location & Vector and System Pilot Location', () => {
  // Location & Vector message
  const locBytes = new Uint8Array(25);
  locBytes[0] = (OPENDRONEID_MSG_TYPES.LOCATION_VECTOR << 4) | 0x01;
  locBytes[1] = 0x10; // Airborne status
  locBytes[2] = 45; // Heading: 45 * 2 = 90 degrees (East)
  locBytes[3] = 48; // Speed horiz: 48 * 0.25 = 12 m/s
  locBytes[4] = 130; // Speed vert: (130 - 128) * 0.5 = +1.0 m/s climb

  const view = new DataView(locBytes.buffer);
  // Valencia: lat 39.4699 (394699000 int32), lon -0.3763 (-3763000 int32)
  view.setInt32(5, 394699000, true);
  view.setInt32(9, -3763000, true);
  view.setUint16(13, (120 + 1000) / 0.5, true); // Alt MSL 120m
  view.setUint16(15, (45 + 1000) / 0.5, true);  // Height AGL 45m

  const loc = decodeRemoteIdMessage(locBytes);
  assert.equal(loc.messageType, 'LOCATION_VECTOR');
  assert.equal(loc.operationalStatus, 'AIRBORNE');
  assert.equal(loc.trackHeadingDeg, 90);
  assert.equal(loc.speedHorizontalMs, 12);
  assert.equal(loc.latitude, 39.4699);
  assert.equal(loc.longitude, -0.3763);
  assert.equal(loc.heightAglM, 45);

  // System Operator / Pilot Location message
  const sysBytes = new Uint8Array(25);
  sysBytes[0] = (OPENDRONEID_MSG_TYPES.SYSTEM << 4) | 0x01;
  sysBytes[1] = 0x01; // Pilot live coordinates
  const sysView = new DataView(sysBytes.buffer);
  sysView.setInt32(2, 394680000, true); // Pilot lat 39.4680
  sysView.setInt32(6, -3761000, true);  // Pilot lon -0.3761
  sysView.setUint16(10, (15 + 1000) / 0.5, true); // Pilot alt 15m

  const sys = decodeRemoteIdMessage(sysBytes);
  assert.equal(sys.messageType, 'SYSTEM_OPERATOR_LOCATION');
  assert.equal(sys.operatorLocationType, 'PILOT_GCS_LIVE_COORDINATES');
  assert.equal(sys.pilotLatitude, 39.468);
  assert.equal(sys.pilotLongitude, -0.3761);
});

test('Passive Bistatic Radar: computes bistatic range, Doppler velocity and CAF peak', () => {
  // Delay of 10 microseconds over a 5000m baseline
  const delaySec = 10e-6; // 10 µs -> 2997.9 m
  const range = calculateBistaticRange(delaySec, 5000);
  assert.ok(range.bistaticRangeM > 2990 && range.bistaticRangeM < 3010);
  assert.ok(range.totalPathLengthM > 7990 && range.totalPathLengthM < 8010);

  // Doppler shift of 20 Hz at 100 MHz (FM radio illuminator) with 30° bistatic angle
  const doppler = calculateBistaticDopplerVelocity(20, 100e6, 30);
  assert.ok(doppler.radialVelocityMs > 25 && doppler.radialVelocityMs < 35);
  assert.ok(doppler.radialVelocityKmh > 90);

  // Cross-Ambiguity Function slice: simulated radar echo at lag 8 with wideband PRN signal
  const sampleRate = 2.048e6; // 2.048 MSPS RTL-SDR
  const refSignal = new Float32Array(512);
  const survSignal = new Float32Array(512);
  const targetLag = 8;

  // Generate deterministic wideband pseudo-random noise sequence (matching DVB-T / FM broadcast)
  let seed = 12345;
  for (let i = 0; i < 512; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    refSignal[i] = (seed / 0x7fffffff) * 2 - 1; // uniform noise in [-1, 1]
  }

  for (let i = 0; i < 512; i++) {
    if (i >= targetLag) {
      survSignal[i] = refSignal[i - targetLag] * 0.8; // echo delayed by targetLag
    }
  }

  const caf = computePassiveRadarCafSlice(refSignal, survSignal, sampleRate, 0, 32);
  assert.equal(caf.bestLagSamples, targetLag);
  assert.ok(caf.snrDb > 5.0, 'CAF correlation peak must exhibit positive SNR');
});

test('Direction of Arrival (DoA): interferometric phase-difference azimuth retrieval', () => {
  const freq = 868e6; // 868 MHz LoRa (lambda = 0.345m)
  const wavelength = 299792458 / freq;
  const baseline = wavelength / 2; // optimal half-wavelength baseline: 0.172m

  // Broadside signal (0 phase diff -> 0 degrees azimuth)
  const doa0 = calculateInterferometricDoA(0, freq, baseline);
  assert.equal(doa0.azimuthDeg, 0);
  assert.equal(doa0.phaseAmbiguity, false);

  // 45 degrees phase difference
  const phaseDiff = Math.PI / 4; // 45°
  const doa45 = calculateInterferometricDoA(phaseDiff, freq, baseline);
  assert.ok(doa45.azimuthDeg > 12 && doa45.azimuthDeg < 16);

  // Large baseline induces spatial ambiguity (grating lobes)
  const doaAmbiguous = calculateInterferometricDoA(phaseDiff, freq, baseline * 2);
  assert.equal(doaAmbiguous.phaseAmbiguity, true);
});

test('Homebrew Antenna Design: synthesizes exact cutting dimensions for low-cost COTS builds', () => {
  // 1/4 Groundplane at 868 MHz
  const mono868 = calculateHomebrewAntennaDesign(868e6, 'MONOPOLE');
  assert.equal(mono868.antennaType, 'MONOPOLE_GROUNDPLANE_1_4');
  assert.ok(mono868.drivenElementLengthMm > 75 && mono868.drivenElementLengthMm < 88);
  assert.equal(mono868.feedpointImpedanceOhms, 50);

  // Double Bi-Quad at 2.4 GHz (Wi-Fi drone detection)
  const biquad24 = calculateHomebrewAntennaDesign(2400e6, 'BI_QUAD');
  assert.equal(biquad24.antennaType, 'DOUBLE_BI_QUAD_DIRECTIONAL');
  assert.ok(biquad24.loopSideLengthMm > 25 && biquad24.loopSideLengthMm < 35);
  assert.ok(biquad24.expectedGainDbi >= 11.0);

  // QFH NOAA satellite antenna at 137.5 MHz
  const qfh137 = calculateHomebrewAntennaDesign(137.5e6, 'QFH_SATELLITE');
  assert.equal(qfh137.antennaType, 'QUADRIFILAR_HELIX_QFH');
  assert.ok(qfh137.outerLoopHeightMm > 1100 && qfh137.outerLoopHeightMm < 1300);
  assert.equal(qfh137.polarization, 'RIGHT_HAND_CIRCULAR_RHCP');

  // Yagi-Uda 5-element beam at 868 MHz
  const yagi = calculateHomebrewAntennaDesign(868e6, 'YAGI_UDA');
  assert.equal(yagi.antennaType, 'YAGI_UDA_5_ELEMENT_BEAM');
  assert.equal(yagi.elementsMm.length, 5);
  assert.ok(yagi.expectedGainDbi >= 10.0);
});

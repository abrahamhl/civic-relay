import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAlHouraniOptimalAltitude,
  solveOptimalElevationAngleDeg,
  computeGraphLaplacianSpectrum,
  computeDeygoutMultiObstacleDiffraction,
  computePassiveRadarCrlb,
  computeAcousticNearUltrasoundBudget,
} from '../src/scientific-theorems-physics.mjs';

test('Theorem 1 (Al-Hourani A2G Altitude): solves optimal elevation angle and minimizes path loss', () => {
  // Test Suburban: optimal angle should be around 20°
  const thetaSuburban = solveOptimalElevationAngleDeg('SUBURBAN');
  assert.ok(thetaSuburban > 15 && thetaSuburban < 25, `Suburban angle ${thetaSuburban} must be near 20°`);

  // Test Urban: optimal angle should be around 42°
  const thetaUrban = solveOptimalElevationAngleDeg('URBAN');
  assert.ok(thetaUrban > 35 && thetaUrban < 50, `Urban angle ${thetaUrban} must be near 42°`);

  // Test Dense Urban: optimal angle should be around 54°
  const thetaDense = solveOptimalElevationAngleDeg('DENSE_URBAN');
  assert.ok(thetaDense > 48 && thetaDense < 62, `Dense urban angle ${thetaDense} must be near 54°`);

  // Test Canyon / Disaster Rubble: optimal angle should be around 75°
  const thetaCanyon = solveOptimalElevationAngleDeg('CANYON_RUBBLE');
  assert.ok(thetaCanyon > 65 && thetaCanyon < 80, `Canyon angle ${thetaCanyon} must be near 75°`);

  // Full curve calculation for radius = 1000m
  const res = computeAlHouraniOptimalAltitude(1000, 'URBAN', 868e6);
  assert.ok(res.optimalAltitudeM > 800 && res.optimalAltitudeM < 1050, 'Urban optimal altitude must be around 915m');
  assert.ok(res.pLosAtOptimal > 0.85, 'LoS probability at optimal altitude must exceed 85%');
  assert.ok(res.lossVsFixed50mDb > 5.0, 'Optimal altitude must beat low 50m hover by at least 5 dB');
  assert.equal(res.curvePoints.length, 21);

  // Check monotonicity / convexity: points around the minimum have higher path loss
  const optIdx = res.curvePoints.findIndex(p => Math.abs(p.altitudeM - res.optimalAltitudeM) < 50);
  if (optIdx > 0 && optIdx < res.curvePoints.length - 1) {
    assert.ok(res.curvePoints[0].pathLossDb > res.optimalPathLossDb, 'Very low altitude must have higher loss');
    assert.ok(res.curvePoints[res.curvePoints.length - 1].pathLossDb > res.optimalPathLossDb, 'Very high altitude must have higher loss');
  }
});

test('Theorem 2 (Swarm Graph Laplacian & Fiedler Gradient): computes spectrum and identifies critical link to boost', () => {
  // 4-node line network: 0 -- 1 -- 2 -- 3
  // Cut between 1 and 2 is the bottleneck
  const adj = [
    [0, 1, 0, 0],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [0, 0, 1, 0],
  ];

  const res = computeGraphLaplacianSpectrum(adj);
  assert.equal(res.eigenvalues.length, 4);
  assert.equal(res.eigenvalues[0], 0); // first eigenvalue is always 0
  assert.ok(res.fiedlerValue > 0.5 && res.fiedlerValue < 0.65, `Line graph Fiedler value should be ~0.5858, got ${res.fiedlerValue}`);
  assert.ok(res.cheegerLowerBound > 0);

  // The link with highest Fiedler gradient (v2(i) - v2(j))^2 should be between the opposite ends (0 and 3)
  assert.ok(res.optimalLinksToBoost.length > 0);
  const bestLink = res.optimalLinksToBoost[0];
  assert.equal(bestLink.from, 0);
  assert.equal(bestLink.to, 3);
  assert.ok(bestLink.gradient > 1.0, 'Opposite ends must have highest gradient for graph bridging');
});

test('Theorem 3 (Deygout Multi-Obstacle vs Epstein-Peterson): corrects double-diffraction overestimation', () => {
  // Bejís mountain ridge profile: 5 km distance, 868 MHz
  const terrain = [
    { distanceM: 1200, elevationM: 95 },
    { distanceM: 2500, elevationM: 145 }, // Main ridge
    { distanceM: 3800, elevationM: 120 }, // Secondary ridge
  ];

  const res = computeDeygoutMultiObstacleDiffraction(terrain, 100, 100, 5000, 868e6);
  assert.equal(res.mainObstacleIndex, 1, 'Obstacle at 2500m must be identified as main obstacle');
  assert.ok(res.obstacles[1].isMain, 'Obstacle 1 must have isMain=true');
  assert.ok(res.lossDeygoutDb > 20 && res.lossDeygoutDb < 30, `Deygout loss ${res.lossDeygoutDb} dB must be reasonable`);
  assert.ok(res.lossEpsteinPetersonDb > res.lossDeygoutDb, 'Epstein-Peterson must overestimate loss compared to Deygout');
  assert.ok(res.epsteinOverestimationDb >= 1.0, 'Epstein-Peterson overestimation should be at least 1.0 dB');
});

test('Theorem 4 (Passive Bistatic Radar CRLB): bounds range and velocity estimation for micro-drones', () => {
  // DVB-T broadcast: B = 7.61 MHz, CIT = 0.25s, SNR = 15 dB, fc = 650 MHz
  const res = computePassiveRadarCrlb(7.61e6, 0.25, 15, 650e6);
  assert.ok(res.sigmaRangeM > 0.2 && res.sigmaRangeM < 1.0, `Range accuracy ${res.sigmaRangeM}m must be sub-meter (< 1m)`);
  assert.ok(res.sigmaVelocityMps > 0.005 && res.sigmaVelocityMps < 0.05, `Velocity accuracy ${res.sigmaVelocityMps}m/s must be high resolution`);
  assert.ok(res.crlbTimeVarianceSec2 > 0);
  assert.ok(res.crlbDopplerVarianceHz2 > 0);
});

test('Theorem 5 (Near-Ultrasound Acoustic Capacity): guarantees call setup in 85 dBA disaster noise', () => {
  // 5 meters distance, 85 dBA ambient noise, 80 byte handshake payload
  const res = computeAcousticNearUltrasoundBudget(5.0, 85, 80);
  assert.ok(res.receivedSplDb > 40 && res.receivedSplDb < 50, `Received SPL ${res.receivedSplDb} dB SPL`);
  assert.ok(res.hfNoiseFloorSplDb > 35 && res.hfNoiseFloorSplDb < 48, `HF noise floor ${res.hfNoiseFloorSplDb} dB SPL`);
  assert.ok(res.snrDb > 0, 'High-frequency noise floor decay guarantees positive SNR even in 85 dBA storm');
  assert.ok(res.shannonCapacityBps > 2000, `Shannon capacity ${res.shannonCapacityBps} bps exceeds required baud rate`);
  assert.ok(res.transmissionTimeSec < 2.0, `Transmission time ${res.transmissionTimeSec}s is under 2 seconds`);
  assert.ok(res.packetErrorRate <= 1e-6, 'Reed-Solomon RS(104, 80) guarantees P_FER < 1e-6');
});

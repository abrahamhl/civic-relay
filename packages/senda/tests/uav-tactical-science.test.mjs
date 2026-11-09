import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAirToGroundLoSProbability,
  computeAirToGroundPathLoss,
  calculateOptimalUavAltitude,
  computeSwarmAlgebraicConnectivity,
  computeAerialPhotogrammetryParams,
  computeAntiJammingMargin,
  A2G_ENVIRONMENTS,
} from '../src/uav-tactical-science.mjs';

test('A2G LoS Probability: higher altitude yields higher LoS probability per Al-Hourani sigmoid', () => {
  // Ground distance 1000m (1 km) in Urban environment
  const lowAlt = computeAirToGroundLoSProbability(50, 1000, 'URBAN');
  const highAlt = computeAirToGroundLoSProbability(400, 1000, 'URBAN');

  assert.ok(lowAlt.elevationDeg < highAlt.elevationDeg);
  assert.ok(highAlt.pLos > lowAlt.pLos, 'High altitude UAV must have higher LoS probability than low altitude');
  assert.equal(Math.round((highAlt.pLos + highAlt.pNlos) * 100) / 100, 1.0);
  assert.ok(highAlt['3dDistanceM'] > 1000);
});

test('A2G Path Loss & Optimal Altitude: finds altitude maximizing ground coverage radius', () => {
  // 868 MHz LoRa with max allowable path loss of 115 dB in Urban
  const opt = calculateOptimalUavAltitude(115, 868e6, 'URBAN');
  assert.ok(opt.optimalAltitudeM >= 80 && opt.optimalAltitudeM <= 600, `Optimal altitude must be physical (got ${opt.optimalAltitudeM}m)`);
  assert.ok(opt.maxCoverageRadiusM > 1000, `Coverage radius must exceed 1km (got ${opt.maxCoverageRadiusM}m)`);
  assert.ok(opt.coverageAreaKm2 > 3.0);

  // At optimal altitude, link at max radius must be within path loss threshold
  const plAtOpt = computeAirToGroundPathLoss(opt.optimalAltitudeM, opt.maxCoverageRadiusM * 0.95, 868e6, 'URBAN');
  assert.ok(plAtOpt.totalPathLossDb <= 115, 'Path loss at boundary must respect threshold');
});

test('Swarm Laplacian: computes Fiedler eigenvalue λ₂ and detects network connectivity', () => {
  // Connected triangle swarm
  const connectedSwarm = [
    { id: 'uav-1', x: 0, y: 0, z: 100 },
    { id: 'uav-2', x: 500, y: 0, z: 100 },
    { id: 'uav-3', x: 250, y: 433, z: 100 },
  ];
  const connResult = computeSwarmAlgebraicConnectivity(connectedSwarm, 600);
  assert.equal(connResult.isSwarmConnected, true);
  assert.ok(connResult.algebraicConnectivity > 0.5, `Connected swarm must have positive λ₂ (got ${connResult.algebraicConnectivity})`);
  assert.equal(connResult.totalLinks, 3);

  // Disconnected swarm (uav-3 is out of range at 5000m)
  const disconnectedSwarm = [
    { id: 'uav-1', x: 0, y: 0, z: 100 },
    { id: 'uav-2', x: 300, y: 0, z: 100 },
    { id: 'uav-3', x: 5000, y: 5000, z: 100 }, // isolated
  ];
  const disconnResult = computeSwarmAlgebraicConnectivity(disconnectedSwarm, 600);
  assert.equal(disconnResult.isSwarmConnected, false);
  assert.equal(disconnResult.algebraicConnectivity, 0);
  assert.equal(disconnResult.degreeMin, 0);
});

test('Photogrammetry: computes GSD, overlap intervals and SfM feasibility for 3D DEM reconstruction', () => {
  const photoParams = computeAerialPhotogrammetryParams({
    flightAltitudeM: 120, // 120m AGL
    focalLengthMm: 24,    // 24mm lens
    sensorWidthMm: 13.2,  // 1-inch sensor
    imageWidthPx: 5472,   // 20 MP
    forwardOverlapRatio: 0.80,
    sideOverlapRatio: 0.70,
    flightSpeedMs: 10,
  });

  // GSD = (120 * 0.0132) / (0.024 * 5472) ≈ 0.01205 m = 1.2 cm/px
  assert.ok(photoParams.gsdCmPerPx > 1.0 && photoParams.gsdCmPerPx < 1.5, `GSD must be ~1.2 cm/px (got ${photoParams.gsdCmPerPx})`);
  assert.ok(photoParams.footprintWidthM > 50);
  assert.ok(photoParams.photoIntervalSeconds >= 0.5);
  assert.equal(photoParams.isSfmReconstructionFeasible, true);
});

test('Anti-Jamming Margin: evaluates processing gain and jammer-to-signal tolerance in EW zones', () => {
  // FHSS with 20 MHz spread bandwidth and 1 kbps emergency command data rate
  const ew = computeAntiJammingMargin(20e6, 1000, 7.0, 2.0);
  // Processing Gain Gp = 10 * log10(20e6 / 1e3) = 10 * log10(20000) ≈ 43 dB
  assert.ok(ew.processingGainDb > 40.0);
  assert.ok(ew.jammingMarginDb > 30.0);
  assert.equal(ew.isResilientUnderTacticalJamming, true);
});

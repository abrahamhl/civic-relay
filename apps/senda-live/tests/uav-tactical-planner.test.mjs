import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTacticalFlightPlan,
  evaluateTacticalSwarmMission,
  UAV_CAMERA_PRESETS,
} from '../server/domain/uav-tactical-planner.mjs';

test('UAV Tactical Planner: generates boustrophedon flight plan and photogrammetry metrics', () => {
  // Bounding box over Valencia wildfire zone (approx 1.5 km x 1.5 km)
  const bbox = [-0.40, 39.45, -0.38, 39.47];
  const plan = generateTacticalFlightPlan({
    bbox,
    targetGsdCm: 3.0,
    camera: 'DJI_MAVIC_3_ENTERPRISE',
    forwardOverlapPct: 80,
    sideOverlapPct: 70,
    cruiseSpeedMs: 12.0,
    operationalCeilingM: 300,
    emergencyScenario: 'WILDFIRE_PERIMETER_SURVEY',
  });

  assert.equal(plan.success, true);
  assert.equal(plan.emergencyScenario, 'WILDFIRE_PERIMETER_SURVEY');
  assert.ok(plan.planHashSha256 && plan.planHashSha256.length === 64);
  assert.ok(plan.waypoints.length >= 4, `Must have multiple waypoints (got ${plan.waypoints.length})`);

  // Verify photogrammetric metrics
  const m = plan.metrics;
  assert.ok(m.targetGsdCm <= 3.5);
  assert.ok(m.flightAltitudeAglM > 50 && m.flightAltitudeAglM <= 300);
  assert.ok(m.totalFlightDistanceM > 1000);
  assert.ok(m.estimatedFlightDurationSec > 60);
  assert.ok(m.totalPhotoCount > 10);
  assert.equal(m.isSfMReconstructionFeasible, true);

  // Verify GeoJSON structure
  assert.equal(plan.geojson.type, 'FeatureCollection');
  assert.equal(plan.geojson.features.length, 2);
  const lineFeature = plan.geojson.features[0];
  assert.equal(lineFeature.geometry.type, 'LineString');
  assert.equal(lineFeature.geometry.coordinates.length, plan.waypoints.length);

  // Verify QGroundControl PX4 plan structure
  assert.equal(plan.qgcPlan.fileType, 'Plan');
  assert.equal(plan.qgcPlan.version, 1);
  assert.ok(plan.qgcPlan.mission.items.length === plan.waypoints.length);
  assert.equal(plan.qgcPlan.mission.items[0].command, 16);
});

test('UAV Tactical Planner: enforces operational ceiling and clamps GSD when ceiling is reached', () => {
  const bbox = [-0.40, 39.45, -0.39, 39.46];
  // Requesting very coarse GSD (25 cm) which would require flying at >900m AGL
  const plan = generateTacticalFlightPlan({
    bbox,
    targetGsdCm: 25.0,
    camera: 'DJI_MAVIC_3_ENTERPRISE',
    operationalCeilingM: 120, // Civil 120m ceiling
  });

  assert.equal(plan.success, true);
  assert.equal(plan.metrics.flightAltitudeAglM, 120);
  assert.ok(plan.metrics.targetGsdCm < 25.0, 'Effective GSD must be clamped to ceiling capability');
});

test('UAV Tactical Swarm: evaluates algebraic connectivity and A2G mesh coverage', () => {
  const drones = [
    { id: 'uav-lead', x: 0, y: 0, z: 150, role: 'COMM_RELAY_ALPHA' },
    { id: 'uav-wing1', x: 500, y: 0, z: 120, role: 'SURVEY_NODE_1' },
    { id: 'uav-wing2', x: 250, y: 400, z: 120, role: 'SURVEY_NODE_2' },
  ];

  const evalResult = evaluateTacticalSwarmMission({
    drones,
    communicationRangeM: 600,
    frequencyHz: 868e6,
    envType: 'URBAN',
    groundResponderDistM: 1000,
    ewThreat: {
      signalPowerDbm: -65,
      jammerPowerDbm: -45,
      rfBandwidthHz: 20e6,
      dataRateBps: 250e3,
      snrMinDb: 6.0,
    },
  });

  assert.equal(evalResult.success, true);
  assert.equal(evalResult.swarmSize, 3);
  assert.equal(evalResult.swarmConnectivity.isSwarmConnected, true);
  assert.ok(evalResult.swarmConnectivity.algebraicConnectivityFiedler > 0);
  assert.equal(evalResult.a2gEvaluations.length, 3);
  assert.ok(evalResult.a2gEvaluations[0].pLos > 0);
  assert.ok(evalResult.antiJamming !== null);
  assert.equal(typeof evalResult.antiJamming.isResilientUnderTacticalJamming, 'boolean');
});

test('UAV Tactical Planner: rejects invalid bounding boxes and parameters', () => {
  assert.throws(() => generateTacticalFlightPlan({ bbox: null }), /bbox must be/);
  assert.throws(() => generateTacticalFlightPlan({ bbox: [10, 40, 5, 40] }), /Invalid longitude bounds/);
  assert.throws(() => generateTacticalFlightPlan({ bbox: [0, 50, 1, 40] }), /Invalid latitude bounds/);
});

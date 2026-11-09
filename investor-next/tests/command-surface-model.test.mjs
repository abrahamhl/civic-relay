import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVATIONS,
  CALIBRATION_SOURCES,
  CORRIDOR_INTELLIGENCE_LAYERS,
  CORRIDOR_SECTORS,
  DEFAULT_ENVIRONMENT,
  ENVIRONMENTS,
  MODEL_VERSION,
  analyze,
  collectAll,
  computeLinkBudget,
  computeRoutePlan,
  coverageField,
  deliveryProbability,
  getCorridorIntelligenceSnapshot,
  linkProbabilityForChannel,
  trilaterate2D
} from '../lib/command-surface.ts';

const SCENARIOS = ['blackout', 'degraded', 'recovery'];

test('activation dataset is unique, ordered and large enough for the v0.22 surface', () => {
  assert.equal(ACTIVATIONS.length, 34);
  assert.equal(new Set(ACTIVATIONS.map(activation => activation.id)).size, ACTIVATIONS.length);
  assert.ok(ACTIVATIONS.every((activation, index) => index === 0 || activation.t >= ACTIVATIONS[index - 1].t));
  assert.equal(ACTIVATIONS[0].id, 'ACT-2401');
  assert.equal(ACTIVATIONS.at(-1).id, 'ACT-2434');
});

test('environment presets expose bounded propagation and calibration metadata', () => {
  assert.equal(Object.keys(ENVIRONMENTS).length, 5);
  assert.equal(ENVIRONMENTS[DEFAULT_ENVIRONMENT].shadowingSigmaDb, 6);
  assert.ok(MODEL_VERSION.startsWith('mando-2.'));
  assert.ok(CALIBRATION_SOURCES.length >= 4);
  assert.ok(Object.values(ENVIRONMENTS).every(environment => environment.shadowingSigmaDb > 0 && environment.pathLossExponent >= 2));
});

test('link budget is monotonic in distance and consistent between mean and P90 margin', () => {
  const base = {
    frequencyMhz: 868,
    distanceM: 1000,
    txPowerDbm: 14,
    txGainDbi: 2,
    rxGainDbi: 2,
    sensitivityDbm: -137,
    bandwidthHz: 125000,
    wallMaterial: 'BRICK_25CM',
    walls: 0,
    noiseFigureDb: 6,
    environment: 'SUBURBAN',
    maxRangeCapM: 3000
  };
  const near = computeLinkBudget(base);
  const far = computeLinkBudget({...base, distanceM: 4000});
  assert.ok(far.pathLossDb > near.pathLossDb);
  assert.ok(far.marginDb < near.marginDb);
  assert.ok(near.marginP90Db <= near.marginDb);
  assert.equal(near.viable90, near.marginP90Db >= 0);
  assert.ok(near.linkProbability >= 0 && near.linkProbability <= 1);
  assert.ok(near.maxRangeM > 0 && near.maxRangeM <= 3000);
});

test('link probability is capped by planning range and decreases in dense clutter', () => {
  for (const channel of ['BLE', 'WIFI', 'LORA']) {
    const probability = linkProbabilityForChannel(channel, 25, 'OPEN');
    assert.ok(probability >= 0 && probability <= 1);
  }
  const open = linkProbabilityForChannel('LORA', 1500, 'OPEN');
  const urban = linkProbabilityForChannel('LORA', 1500, 'URBAN');
  assert.ok(open >= urban);
  assert.ok(linkProbabilityForChannel('LORA', 1500, 'SUBURBAN', 12) <= linkProbabilityForChannel('LORA', 1500, 'SUBURBAN', 3));
  assert.ok(linkProbabilityForChannel('LORA', 2000, 'RUBBLE') <= linkProbabilityForChannel('LORA', 20, 'RUBBLE'));
});

test('weighted trilateration recovers a consistent fix with uncertainty and GDOP', () => {
  // P0-02: Geometría insuficiente (0, 1, 2 anclas) debe devolver UNDERDETERMINED con incertidumbre nula
  const fix0 = trilaterate2D([]);
  assert.equal(fix0.status, 'UNDERDETERMINED');
  assert.equal(fix0.x, null);
  assert.equal(fix0.y, null);
  assert.equal(fix0.errorM, null);
  assert.equal(fix0.gdop, null);
  assert.equal(fix0.ellipseMajorM, null);
  assert.equal(fix0.anchorCount, 0);

  const fix1 = trilaterate2D([{ id: 'a', x: 0, y: 0, distance: 10, sigma: 1 }]);
  assert.equal(fix1.status, 'UNDERDETERMINED');
  assert.equal(fix1.x, null);
  assert.equal(fix1.y, null);
  assert.equal(fix1.errorM, null);
  assert.equal(fix1.gdop, null);
  assert.equal(fix1.anchorCount, 1);

  const fix2 = trilaterate2D([
    { id: 'a', x: 0, y: 0, distance: 10, sigma: 1 },
    { id: 'b', x: 20, y: 0, distance: 10, sigma: 1 }
  ]);
  assert.equal(fix2.status, 'UNDERDETERMINED');
  assert.equal(fix2.x, null);
  assert.equal(fix2.y, null);
  assert.equal(fix2.errorM, null);
  assert.equal(fix2.gdop, null);
  assert.equal(fix2.anchorCount, 2);

  // P0-02: Colinealidad (3 anclas en la misma recta) debe devolver UNDERDETERMINED con incertidumbre nula
  const collinearAnchors = [
    { id: 'a', x: 0, y: 0, distance: 50, sigma: 1 },
    { id: 'b', x: 50, y: 0, distance: 20, sigma: 1 },
    { id: 'c', x: 100, y: 0, distance: 50, sigma: 1 }
  ];
  const fixCollinear = trilaterate2D(collinearAnchors);
  assert.equal(fixCollinear.status, 'UNDERDETERMINED');
  assert.equal(fixCollinear.x, null);
  assert.equal(fixCollinear.y, null);
  assert.equal(fixCollinear.errorM, null);
  assert.equal(fixCollinear.gdop, null);
  assert.equal(fixCollinear.ellipseMajorM, null);
  assert.equal(fixCollinear.anchorCount, 3);

  // Geometría válida determinada (3 anclas no colineales)
  const anchors = [
    {id: 'a', x: 0, y: 0, distance: Math.hypot(50, 30), sigma: 1},
    {id: 'b', x: 100, y: 0, distance: Math.hypot(-50, 30), sigma: 1},
    {id: 'c', x: 0, y: 100, distance: Math.hypot(50, -70), sigma: 1}
  ];
  const fix = trilaterate2D(anchors);
  assert.equal(fix.status, 'DETERMINED');
  assert.ok(Math.abs(fix.x - 50) < 1e-6);
  assert.ok(Math.abs(fix.y - 30) < 1e-6);
  assert.ok(fix.errorM < 1e-6);
  assert.ok(fix.gdop > 0);
  assert.equal(fix.anchorCount, 3);
  assert.ok(fix.ellipseMajorM >= fix.ellipseMinorM);
  assert.ok(fix.ellipseMajorM > 0);
});

test('routes expose hop probability, energy and a distinct backup first hop', () => {
  for (const scenario of SCENARIOS) {
    for (const activation of ACTIVATIONS) {
      const plan = computeRoutePlan(activation, scenario, {environment: 'SUBURBAN'});
      if (!plan.primary.ok) continue;
      const primary = plan.primary;
      assert.ok(primary.successProbability >= 0 && primary.successProbability <= 1);
      assert.ok(primary.energy >= 0);
      assert.ok(primary.hops.length > 0);
      for (const hop of primary.hops) {
        assert.ok(hop.probability >= 0 && hop.probability <= 1);
        assert.ok(hop.pathLossDb >= 0);
        assert.ok(hop.latencyS >= 0);
      }
      if (plan.backup) {
        assert.notEqual(plan.backup.hops[0].to, primary.hops[0].to);
        assert.ok(plan.backup.successProbability >= 0 && plan.backup.successProbability <= 1);
      }
    }
  }
});

test('analysis and coverage field stay bounded across scenarios and environments', () => {
  for (const scenario of SCENARIOS) {
    for (const environment of Object.keys(ENVIRONMENTS)) {
      const analysis = analyze(scenario, 900, environment);
      assert.equal(analysis.total, ACTIVATIONS.length);
      assert.ok(analysis.routed <= analysis.total);
      assert.ok(analysis.meanDeliveryPct >= 0 && analysis.meanDeliveryPct <= 100);
      assert.ok(analysis.coveragePct >= 0 && analysis.coveragePct <= 100);
      const cells = coverageField(scenario, environment);
      assert.equal(cells.length, 400);
      assert.ok(cells.every(cell => cell.probability >= 0 && cell.probability <= 1));
    }
  }
});

test('delivery probability compounds independent attempts', () => {
  assert.ok(deliveryProbability(3, 0) === 0);
  assert.ok(Math.abs(deliveryProbability(3, 0.5) - 0.875) < 1e-12);
  assert.ok(deliveryProbability(3, 1) === 1);
  assert.equal(deliveryProbability(0, 0.5), 0);
});

test('collectAll v2 export includes environment, model, assumptions and routes', () => {
  const data = collectAll('degraded', 900, 'URBAN', 12);
  assert.equal(data.schema, 'senda-mando-surface/v2');
  assert.equal(data.environment, 'URBAN');
  assert.equal(data.shadowingSigmaDb, 12);
  assert.equal(data.model.version, MODEL_VERSION);
  assert.equal(data.model.calibration.length, CALIBRATION_SOURCES.length);
  assert.ok(Array.isArray(data.assumptions) && data.assumptions.length >= 4);
  assert.ok(Array.isArray(data.routes));
  assert.equal(data.routes.length, ACTIVATIONS.length);
  assert.equal(data.analysis.total, ACTIVATIONS.length);
  assert.ok(data.corridorIntelligence);
});

test('CORRIDOR INTELLIGENCE mode exposes 9 layers, Pilot A (A12 Arnhem-Ede) and Pilot B (Barrio Lab) with honest RWS/DGT30 guards', () => {
  assert.deepEqual(CORRIDOR_INTELLIGENCE_LAYERS, [
    'CAMERAS',
    'DASHCAMS',
    'ROAD DATA',
    'ENVIRONMENT',
    'CONNECTED DEVICES',
    'GATEWAYS',
    'DTN ROUTES',
    'DETECTED INCIDENTS',
    'EVIDENCE'
  ]);
  assert.equal(CORRIDOR_SECTORS.length, 3);

  const snapA = getCorridorIntelligenceSnapshot('NL-A12-ARNHEM-EDE', 'SEGMENT');
  assert.equal(snapA.sector.pilotCode, 'PILOT_A_A12');
  const rwsCam = snapA.sources.find(s => s.sourceId === 'RWS-NL-A12-CCTV-VELPERBROEK');
  assert.ok(rwsCam);
  assert.equal(rwsCam.health, 'PARTNER_ACCESS_REQUIRED');
  assert.equal(rwsCam.videoPreviewUrl, null);
  assert.equal(rwsCam.canActAsRelay, false);

  const snapB = getCorridorIntelligenceSnapshot('LAB-BARRIO-EDIFICIO-01', 'RADIUS');
  assert.equal(snapB.sector.pilotCode, 'PILOT_B_BARRIO_LAB');
  assert.equal(snapB.sector.messages[0].state, 'VERIFIED');

  assert.equal(snapA.cotsHardwareKits.length, 3);
  assert.equal(snapA.meshInteropFormats.length, 4);
  assert.equal(snapA.byzantineQuorum.distinctOperatorsVerified, 3);
  assert.ok(snapA.sources.some(s => s.sourceId === 'DRONE-A12-POD-COTS02'));
  assert.ok(snapA.sources.some(s => s.sourceId === 'SAT-NTN-IRIDIUM-GALILEO'));
  assert.ok(snapA.sources.some(s => s.sourceId === 'NDW-NL-BRIDGES-V3'));
});


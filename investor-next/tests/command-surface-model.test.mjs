import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVATIONS,
  CALIBRATION_SOURCES,
  DEFAULT_ENVIRONMENT,
  ENVIRONMENTS,
  MODEL_VERSION,
  analyze,
  collectAll,
  computeLinkBudget,
  computeRoutePlan,
  coverageField,
  deliveryProbability,
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
  const anchors = [
    {id: 'a', x: 0, y: 0, distance: Math.hypot(50, 30), sigma: 1},
    {id: 'b', x: 100, y: 0, distance: Math.hypot(-50, 30), sigma: 1},
    {id: 'c', x: 0, y: 100, distance: Math.hypot(50, -70), sigma: 1}
  ];
  const fix = trilaterate2D(anchors);
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
});

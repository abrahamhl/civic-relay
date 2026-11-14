import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MATERIALS,
  RF_STATUS,
  dbmToMw,
  freeSpacePathLossDb,
  getRfLegalGates,
  linkBudget,
  materialAttenuationDb,
  mwToDbm,
  pathAttenuationDb,
  presenceLikelihood,
  rssiToDistance,
  throughWallFeasibility,
} from '../src/science/rf.mjs';
import {
  DEMO_FLOOR,
  pathLossThroughBuilding,
  presenceHeatmap,
  segmentIntersection,
  summarizeHeatmap,
  wallCrossings,
} from '../src/science/structure.mjs';

test('free-space path loss matches the textbook value and the 20 dB/decade slope', () => {
  const at1m = freeSpacePathLossDb(1, 2.4e9);
  assert.ok(Math.abs(at1m - 40.05) < 0.1, `FSPL(1m, 2.4GHz)=${at1m}`);

  const at10m = freeSpacePathLossDb(10, 2.4e9);
  assert.ok(Math.abs(at10m - at1m - 20) < 1e-9);

  assert.throws(() => freeSpacePathLossDb(0, 2.4e9), /positive/);
  assert.throws(() => freeSpacePathLossDb(1, 0), /positive/);
});

test('material attenuation scales with thickness and frequency, and metal blocks', () => {
  const thin = materialAttenuationDb({ material: 'concrete', thicknessM: 0.1, freqHz: 2.4e9 });
  const thick = materialAttenuationDb({ material: 'concrete', thicknessM: 0.2, freqHz: 2.4e9 });
  assert.ok(Math.abs(thick - 2 * thin) < 1e-9);

  const low = materialAttenuationDb({ material: 'concrete', thicknessM: 0.2, freqHz: 1e9 });
  const high = materialAttenuationDb({ material: 'concrete', thicknessM: 0.2, freqHz: 5e9 });
  assert.ok(high > low);

  const metal = materialAttenuationDb({ material: 'metal', thicknessM: 0.001, freqHz: 2.4e9 });
  assert.ok(metal > 35, `1 mm metal should be a barrier, got ${metal} dB`);

  assert.throws(
    () => materialAttenuationDb({ material: 'unobtanium', thicknessM: 0.1, freqHz: 2.4e9 }),
    /unknown material/,
  );
});

test('link budget classifies robust, marginal and blocked links', () => {
  const base = {
    txPowerDbm: 0,
    txGainDbi: 2,
    rxGainDbi: 2,
    distanceM: 10,
    freqHz: 2.4e9,
    rxSensitivityDbm: -95,
    walls: [],
  };
  assert.equal(linkBudget(base).status, RF_STATUS.ROBUST);

  const blocked = linkBudget({
    ...base,
    walls: [{ material: 'reinforced_concrete', thicknessM: 0.3 }],
  });
  assert.equal(blocked.status, RF_STATUS.BLOCKED);
  assert.ok(blocked.totalDb > base.rxSensitivityDbm);
});

test('RSSI inverts to distance with a declared one-sigma band', () => {
  const freqHz = 2.4e9;
  const exponent = 2.7;
  const distanceM = 5;
  const pl0 = freeSpacePathLossDb(1, freqHz);
  const rssiDbm = 0 - (pl0 + 10 * exponent * Math.log10(distanceM));

  const estimate = rssiToDistance({ rssiDbm, txPowerDbm: 0, freqHz, exponent });
  assert.ok(Math.abs(estimate.distanceM - distanceM) < 1e-6);
  assert.ok(estimate.lowM < estimate.distanceM);
  assert.ok(estimate.highM > estimate.distanceM);

  const tighter = rssiToDistance({ rssiDbm, txPowerDbm: 0, freqHz, exponent, shadowingSigmaDb: 3 });
  assert.ok(tighter.highM - tighter.lowM < estimate.highM - estimate.lowM);
});

test('presence likelihood is monotonic and bounded', () => {
  const low = presenceLikelihood({ rssiDbm: -90, baselineDbm: -70 });
  const mid = presenceLikelihood({ rssiDbm: -70, baselineDbm: -70 });
  const high = presenceLikelihood({ rssiDbm: -50, baselineDbm: -70 });
  assert.ok(low < mid && mid < high);
  assert.equal(mid, 0.5);
  assert.ok(low > 0 && high < 1);
});

test('through-wall feasibility never returns a detection capability', () => {
  const drywall = throughWallFeasibility({
    freqHz: 2.4e9,
    distanceM: 5,
    walls: [{ material: 'drywall', thicknessM: 0.0127 }],
  });
  assert.equal(drywall.capability, 'SIMULATION_ONLY');
  assert.ok(drywall.status.endsWith('SIMULATION_ONLY'));

  const metal = throughWallFeasibility({
    freqHz: 2.4e9,
    distanceM: 5,
    walls: [{ material: 'metal', thicknessM: 0.002 }],
  });
  assert.equal(metal.status, RF_STATUS.BLOCKED_BY_MATERIAL);
  assert.equal(metal.capability, 'SIMULATION_ONLY');
});

test('legal gates keep prohibited capabilities explicit', () => {
  const gates = getRfLegalGates();
  const byId = Object.fromEntries(gates.map((gate) => [gate.id, gate]));
  assert.equal(byId.consented_devices_only.status, 'REQUIRED');
  assert.equal(byId.no_imsi_catcher.status, 'PROHIBITED');
  assert.equal(byId.no_ss7.status, 'PROHIBITED');
  assert.equal(byId.no_warrantless_tracking.status, 'PROHIBITED');
  assert.equal(byId.through_wall_simulation_only.status, 'SIMULATION_ONLY');
  assert.ok(gates.every((gate) => gate.statement.length > 20));
});

test('unit conversion round-trips', () => {
  for (const dbm of [-100, -70, -30, 0, 20]) {
    assert.ok(Math.abs(mwToDbm(dbmToMw(dbm)) - dbm) < 1e-9);
  }
  assert.throws(() => mwToDbm(0), /positive/);
});

test('segment intersection computes a crossing only when segments actually meet', () => {
  const hit = segmentIntersection(
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: -5 },
    { x: 5, y: 5 },
  );
  assert.ok(hit);
  assert.ok(Math.abs(hit.t - 0.5) < 1e-12);
  assert.deepEqual(hit.point, { x: 5, y: 0 });

  const miss = segmentIntersection(
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 1 },
    { x: 5, y: 5 },
  );
  assert.equal(miss, null);
});

test('path loss through the demo floor counts real wall crossings', () => {
  const crossing = wallCrossings({
    from: { x: 3, y: 3 },
    to: { x: 17, y: 9 },
    walls: DEMO_FLOOR.walls,
  });
  assert.ok(crossing.length >= 2, `expected several walls, got ${crossing.length}`);

  const loss = pathLossThroughBuilding({
    from: { x: 3, y: 3 },
    to: { x: 17, y: 9 },
    walls: DEMO_FLOOR.walls,
    freqHz: 2.4e9,
  });
  assert.ok(loss.wallsDb > 0);
  assert.ok(loss.totalDb > loss.freeSpaceDb);
  assert.equal(loss.crossings.length, crossing.length);
});

test('presence heatmap is deterministic, relative and labelled SIMULATOR', () => {
  const a = presenceHeatmap({
    bounds: DEMO_FLOOR.bounds,
    resolution: 24,
    sensors: DEMO_FLOOR.sensors,
    walls: DEMO_FLOOR.walls,
  });
  const b = presenceHeatmap({
    bounds: DEMO_FLOOR.bounds,
    resolution: 24,
    sensors: DEMO_FLOOR.sensors,
    walls: DEMO_FLOOR.walls,
  });

  assert.equal(a.provenance, 'SIMULATOR');
  assert.equal(a.cols, 24);
  assert.equal(a.values.length, a.cols * a.rows);
  assert.deepEqual([...a.values], [...b.values]);
  assert.ok(a.values.every((value) => value >= 0 && value <= 1));
  assert.equal(a.peak.value, 1);
  assert.ok(a.peak.x >= a.bounds.minX && a.peak.x <= a.bounds.maxX);
  assert.ok(a.peak.y >= a.bounds.minY && a.peak.y <= a.bounds.maxY);

  const summary = summarizeHeatmap(a);
  assert.equal(summary.cells, a.values.length);
  assert.ok(summary.fractionAboveHalf >= 0 && summary.fractionAboveHalf <= 1);
  assert.ok(Object.keys(MATERIALS).includes('metal'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_DEPENDENCY_GRAPH,
  checkCorroborationIndependence,
  getFullUpstreamLineage,
  createSourceEvidence,
  EVIDENCE_STAGES
} from '../src/source-evidence.mjs';

test('Source Evidence: correctly detects upstream dependency between GDACS and USGS (P0 fix)', () => {
  // GDACS Earthquake uses USGS NEIC
  const res1 = checkCorroborationIndependence('GDACS_EQ', 'USGS_NEIC');
  assert.equal(res1.independent, false);
  assert.equal(res1.reason, 'UPSTREAM_DEPENDENCY');

  // Reverse direction: USGS is upstream of GDACS
  const res2 = checkCorroborationIndependence('USGS_NEIC', 'GDACS_EQ');
  assert.equal(res2.independent, false);
  assert.equal(res2.reason, 'UPSTREAM_DEPENDENCY');
});

test('Source Evidence: detects shared upstream lineage between GDACS_WF and NASA_FIRMS', () => {
  const res = checkCorroborationIndependence('GDACS_WF', 'NASA_FIRMS');
  assert.equal(res.independent, false);
  assert.ok(res.reason === 'UPSTREAM_DEPENDENCY' || res.reason === 'SAME_UPSTREAM_NOT_CORROBORATION');
});

test('Source Evidence: recognizes genuinely independent emergency sources', () => {
  // USGS seismic network vs Copernicus EMS satellite optical/radar mapping
  const res = checkCorroborationIndependence('USGS_NEIC', 'COPERNICUS_EMS_RAPID');
  assert.equal(res.independent, true);
  assert.equal(res.reason, 'INDEPENDENT_PROVENANCE');
  assert.ok(Array.isArray(res.lineageA));
  assert.ok(Array.isArray(res.lineageB));
});

test('Source Evidence: getFullUpstreamLineage traces transitive dependencies recursively', () => {
  const gdacsWfLineage = getFullUpstreamLineage('GDACS_WF');
  assert.ok(gdacsWfLineage.has('NASA_FIRMS'));
  assert.ok(gdacsWfLineage.has('VIIRS_SNPP_NOAA'));
  assert.ok(gdacsWfLineage.has('COPERNICUS_EFFIS'));
});

test('Source Evidence: state machine enforces strict progression invariants', () => {
  // Stage 0: DISCOVERED is valid with minimal metadata
  const discovered = createSourceEvidence({
    sourceId: 'cems-emsr765',
    stage: 'DISCOVERED'
  });
  assert.equal(discovered.stage, 'DISCOVERED');
  assert.equal(discovered.isFieldValidated, false);

  // Advancing to SCHEMA_VALIDATED without schemaValid = true must throw
  assert.throws(
    () => createSourceEvidence({ sourceId: 'test-src', stage: 'SCHEMA_VALIDATED', schemaValid: false }),
    /SCHEMA_VALIDATION_REQUIRED/
  );

  // Advancing to LIVE_FETCHED without rawSha256 must throw
  assert.throws(
    () => createSourceEvidence({ sourceId: 'test-src', stage: 'LIVE_FETCHED', schemaValid: true }),
    /IMMUTABLE_DIGEST_REQUIRED/
  );

  // Valid LIVE_FETCHED
  const live = createSourceEvidence({
    sourceId: 'test-src',
    stage: 'LIVE_FETCHED',
    schemaValid: true,
    rawSha256: 'sha256:2c454d97d7f3acf518a976776800bd7f2741ed20b72ee9868c7d0d2105d3b4db'
  });
  assert.equal(live.stage, 'LIVE_FETCHED');

  // Advancing to FIELD_VALIDATED requires field trial receipt
  assert.throws(
    () =>
      createSourceEvidence({
        sourceId: 'test-src',
        stage: 'FIELD_VALIDATED',
        schemaValid: true,
        rawSha256: 'sha256:2c454d97d7f3acf518a976776800bd7f2741ed20b72ee9868c7d0d2105d3b4db',
        holdoutScore: 0.94
      }),
    /FIELD_TRIAL_RECEIPT_REQUIRED/
  );

  // Fully validated
  const fieldVal = createSourceEvidence({
    sourceId: 'test-src',
    stage: 'FIELD_VALIDATED',
    schemaValid: true,
    rawSha256: 'sha256:2c454d97d7f3acf518a976776800bd7f2741ed20b72ee9868c7d0d2105d3b4db',
    holdoutScore: 0.94,
    fieldTrialReceiptId: 'receipt-field-001'
  });
  assert.equal(fieldVal.isFieldValidated, true);
});

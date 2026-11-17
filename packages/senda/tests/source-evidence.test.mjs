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
  assert.equal(fieldVal.isFieldValidated, false,
    'a textual receipt ID cannot certify an actual field trial');
  assert.equal(fieldVal.requestedStage,'FIELD_VALIDATED');
  assert.equal(fieldVal.stage,'HOLDOUT_TESTED');
  assert.equal(fieldVal.fieldReceiptSignatureVerified,false);
  assert.equal(fieldVal.sourceAuthenticityVerified,false);
});

test('P0: unknown feeds without a declared lineage never count as independent corroboration',()=>{
  const a=checkCorroborationIndependence('UNKNOWN_ONE','UNKNOWN_TWO');
  assert.equal(a.independent,false);
  assert.equal(a.reason,'UNKNOWN_SOURCE_LINEAGE');
  const b=checkCorroborationIndependence('USGS_NEIC','SOURCE_MADE_UP');
  assert.equal(b.independent,false);
  assert.equal(b.reason,'UNKNOWN_SOURCE_LINEAGE');
  const c=checkCorroborationIndependence('USGS_NEIC','COPERNICUS_EMS_RAPID');
  assert.equal(c.independent,true);
  assert.equal(c.declaredGraphOnly,true);
  assert.equal(c.externallyAuthenticated,false);
});
test('P0: arbitrary sha256: text, NaN holdout and unsigned field receipt cannot advance to validated field status',()=>{
  assert.throws(()=>createSourceEvidence({
    sourceId:'unknown-but-valid-format',stage:'LIVE_FETCHED',schemaValid:true,
    rawSha256:'sha256:garbage'}),/IMMUTABLE_DIGEST_REQUIRED/);
  const sha='sha256:'+'a'.repeat(64);
  for(const score of [NaN,Infinity,-Infinity]){
    assert.throws(()=>createSourceEvidence({
      sourceId:'source-01',stage:'HOLDOUT_TESTED',schemaValid:true,
      rawSha256:sha,holdoutScore:score}),/HOLDOUT_SCORE_REQUIRED/);
  }
  const claimed=createSourceEvidence({
    sourceId:'source-01',stage:'FIELD_VALIDATED',schemaValid:true,
    rawSha256:sha,holdoutScore:.9,fieldTrialReceiptId:'any-id-caller-can-type'
  });
  assert.equal(claimed.isFieldValidated,false);
  assert.equal(claimed.stage,'HOLDOUT_TESTED');
  assert.equal(claimed.requestedStage,'FIELD_VALIDATED');
  assert.equal(claimed.fieldReceiptSignatureVerified,false);
});


test('P0: stage taxonomy and lineage graph are immutable to injected fake evidence',()=>{
  assert.equal(Object.isFrozen(EVIDENCE_STAGES),true);
  assert.equal(Object.isFrozen(SOURCE_DEPENDENCY_GRAPH),true);
  assert.equal(Object.isFrozen(SOURCE_DEPENDENCY_GRAPH.USGS_NEIC),true);
  assert.equal(Object.isFrozen(SOURCE_DEPENDENCY_GRAPH.USGS_NEIC.upstream),true);
  assert.throws(()=>{SOURCE_DEPENDENCY_GRAPH.INVENTED_FEED={upstream:[]};},TypeError);
  assert.throws(()=>{SOURCE_DEPENDENCY_GRAPH.USGS_NEIC.upstream.push('FAKE');},TypeError);
  assert.throws(()=>{EVIDENCE_STAGES.push('CERTIFIED');},TypeError);
  assert.equal(checkCorroborationIndependence('INVENTED_FEED','USGS_NEIC').independent,false);
});

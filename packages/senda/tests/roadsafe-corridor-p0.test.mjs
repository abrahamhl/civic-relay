/**
 * SENDA Corridor P0 — regression tests for fail-closed data and transport defaults.
 * These tests are software-only. No RF, DGT, institutional authorization or public alerts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeObservation, createMqttEdgeBridge, parseDgtNapXml } from '../src/corridor-connectors.mjs';
import { correlateCorridorObservations, CorridorTransportFabric } from '../src/corridor-fabric.mjs';

const NOW = Date.parse('2026-11-18T01:00:00.000Z');
const raw = (extra={}) => ({
  sourceId:'TEST-CAMERA-001',
  measuredAtUtc:new Date(NOW-12000).toISOString(),
  receivedAtUtc:new Date(NOW).toISOString(),
  location:{lat:40.4,lon:-3.7},
  roadSegmentId:'TEST-ROAD-WEST',
  observationType:'STOPPED_VEHICLE_OBSTRUCTION',
  units:'categorical',
  value:{stopped:true},
  ...extra
});
test('P0: missing confidence, precision and validation stay unknown', () => {
  const x = normalizeObservation(raw(),{nowMs:NOW});
  assert.equal(x.confidence,null);
  assert.equal(x.location.uncertaintyRadiusM,null);
  assert.equal(x.measurementUncertainty,null);
  assert.equal(x.provenance.verificationState,'UNVERIFIED');
  assert.deepEqual(x.qualityFlags,['VALIDATION_NOT_ESTABLISHED']);
});
test('P0: invalid confidence cannot become 0.85', () => {
  for (const score of [NaN, -1, 1.01, Infinity, null, '0.9']) {
    const x = normalizeObservation(raw({confidence:score}),{nowMs:NOW});
    assert.equal(x.confidence,null);
  }
  assert.equal(normalizeObservation(raw({confidence:0.67}),{nowMs:NOW}).confidence,0.67);
});
test('P0: source can supply observationId without bypassing value validation', () => {
  assert.throws(()=>normalizeObservation(raw({observationId:'already-created',location:{lat:990,lon:0}}),{nowMs:NOW}),/INVALID_OBSERVATION_LOCATION/);
});
test('P0: a nonverified obstruction cannot certify road is clear', () => {
  const result=correlateCorridorObservations([normalizeObservation(raw(),{nowMs:NOW})],{nowMs:NOW});
  assert.equal(result.abstained,true);
  assert.equal(result.decision,'ABSTAIN_INSUFFICIENT_EVIDENCE');
  assert.equal(result.events[0].unqualifiedSignalCount,1);
  assert.equal(result.events[0].confidenceMeaning,'HEURISTIC_SCORE_NOT_CALIBRATED_PROBABILITY');
  assert.equal(result.events[0].uncertaintyInterval90,null);
});
test('P0: a measured number with unverified provenance still cannot confirm accident', () => {
  const obs=normalizeObservation(raw({confidence:0.99}),{nowMs:NOW});
  const r=correlateCorridorObservations([obs],{nowMs:NOW});
  assert.equal(r.decision,'ABSTAIN_INSUFFICIENT_EVIDENCE');
  assert.equal(r.events[0].unqualifiedSignalCount,1);
});
test('P0: unknown location accuracy cannot become a precise radius', () => {
  const x=normalizeObservation(raw({confidence:0.9,provenance:{verificationState:'LAB_VERIFIED'}}),{nowMs:NOW});
  const result=correlateCorridorObservations([x],{nowMs:NOW});
  assert.equal(result.events[0].location.uncertaintyRadiusM,null);
});
test('P0: MQTT bridge has no hardcoded credential default', async () => {
  const b=createMqttEdgeBridge();
  assert.equal(b.permissionState,'AUTHENTICATION_REQUIRED');
  await assert.rejects(b.authenticate({token:'edge-token-barrio-lab-01'}),/MQTT_EDGE_UNAUTHORIZED/);
  await assert.rejects(b.authenticate({token:'guess-me'}),/MQTT_EDGE_UNAUTHORIZED/);
});
test('P0: MQTT payload cannot invent probabilistic detector certainty', async () => {
  const b=createMqttEdgeBridge({authorizedTokens:['explicit-lab-secret']});
  const response=await b.fetchObservation({token:'explicit-lab-secret',nowMs:NOW,eventPayload:{
    schema:'senda.edge-event/1.0',
    sourceId:'SENSOR-01', measuredAtUtc:new Date(NOW-3000).toISOString(),
    location:{lat:40.4,lon:-3.7},observationType:'EDGE_OBJECT_ANOMALY'
  }});
  assert.equal(response.observation.confidence,null);
  assert.equal(response.observation.value.severityScore,null);
  assert.equal(response.observation.value.objectClass,null);
  assert.equal(response.observation.value.localSnapshotSha256,null);
});
test('P0: unapproved bearer is never selected even with observedCoverage=true', () => {
  const fabric=new CorridorTransportFabric();
  const bearer=fabric.registerBearer({bearerId:'test-cell',type:'CELLULAR_BACKHAUL',observedCoverage:true,osCapability:true});
  assert.equal(bearer.authorizationState,'UNVERIFIED');
  assert.equal(bearer.hardwareAvailability,'UNKNOWN');
  assert.equal(bearer.realLinkQuality.packetLossRatio,null);
  assert.equal(fabric.selectAvailableBearer().selected,null);
});
test('P0: even authorized bearer with no measured loss/reliability abstains', () => {
  const f=new CorridorTransportFabric();
  f.registerBearer({bearerId:'b',type:'BLE_PEER',authorizationState:'AUTHORIZED',hardwareAvailability:'AVAILABLE_IN_SOFTWARE_OR_LOOPBACK',observedCoverage:true,osCapability:true});
  assert.equal(f.selectAvailableBearer().selected,null);
});
test('P0: DGT document with no trusted event date or coordinates does not invent an incident', () => {
  const xml='<d2:payload xmlns:d2="http://datex2.eu/schema/3/d2Payload"><sit:situation xmlns:sit="http://datex2.eu/schema/3/situation" id="x"><sit:situationRecord xsi:type="sit:Accident" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><loc:latitude xmlns:loc="http://datex2.eu/schema/3/locationReferencing">40.4</loc:latitude><loc:longitude xmlns:loc="http://datex2.eu/schema/3/locationReferencing">-3.7</loc:longitude></sit:situationRecord></sit:situation></d2:payload>';
  const r=parseDgtNapXml(xml,{nowMs:NOW,receivedAtUtc:new Date(NOW).toISOString()});
  assert.equal(r.observations.length,0);
  assert.equal(r.publicationTimeUtc,null);
});


test('P0: distinct DATEX situation IDs in the same XML blob must not be deduplicated', () => {
  const common={sourcePayloadHash:'same-file-sha',confidence:0.85,provenance:{verificationState:'LAB_VERIFIED'}};
  const first=normalizeObservation(raw({...common,observationId:'situation-1'}),{nowMs:NOW});
  const second=normalizeObservation(raw({...common,observationId:'situation-2',location:{lat:40.42,lon:-3.7}}),{nowMs:NOW});
  const result=correlateCorridorObservations([first,second],{nowMs:NOW,maxClusterRadiusM:100});
  assert.equal(result.deduplicatedCount,0);
  assert.equal(result.events.length,2);
});

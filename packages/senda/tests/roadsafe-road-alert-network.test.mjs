import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoadReport, fuseRoadReports, buildElectronicHorizon,
  planRoadAlertDistribution, ROAD_ALERT_OUTPUTS } from '../src/roadsafe-road-alert-network.mjs';
const NOW = 1000000;
const raw = (extra = {}) => ({
  reportId: 'DGT-1', incidentKey: 'collision-x', hazardType: 'COLLISION', severity: 'HIGH',
  observedAtMs: NOW - 5000, expiresAtMs: NOW + 300000,
  road: { roadId: 'A-12', carriagewayId: 'A-12-E', direction: 'INCREASING', chainageM: 123000, uncertaintyM: 25, mapMatched: true },
  provenance: { rootId: 'original-dgt-1', publisherId: 'dgt', independenceFamily: 'DGT', verification: 'AUTHORITY_VERIFIED', proofId: 'verified-chain-1' },
  authorityPublicWarningApproved: true, ...extra,
});
const att = { 'verified-chain-1': { rootId:'original-dgt-1', publisherId:'dgt', independenceFamily:'DGT', verification:'AUTHORITY_VERIFIED', validUntilMs:NOW+900000, publicWarningApproved:true } };
const fuse = (reports, opts={}) => fuseRoadReports(reports,{ nowMs: NOW, acceptedAttestations: att, ...opts });
const driver = (extra = {}) => ({ roadId: 'A-12', carriagewayId: 'A-12-E', direction: 'INCREASING',
  chainageM: 121500, uncertaintyM: 5, speedMps: 25, mapMatched: true, ...extra });

test('canonical report requires explicit road, time, provenance and known enum', () => {
  assert.equal(normalizeRoadReport(raw(), { nowMs: NOW, acceptedAttestations:att }).ok, true);
  assert.equal(normalizeRoadReport(raw({ provenance: {} }), { nowMs: NOW }).reason, 'MISSING_IDENTITY_OR_ROAD');
  assert.equal(normalizeRoadReport(raw({ hazardType: '__proto__' }), { nowMs: NOW }).ok, false);
  assert.equal(normalizeRoadReport(raw({ observedAtMs: NOW + 1 }), { nowMs: NOW }).ok, false);
  assert.equal(normalizeRoadReport(raw({ expiresAtMs: NOW - 1 }), { nowMs: NOW }).ok, false);
  assert.equal(normalizeRoadReport(raw({ road: { ...raw().road, chainageM: NaN } }), { nowMs: NOW }).ok, false);
});
test('claim of official status without proof is downgraded, not endorsed', () => {
  const v = normalizeRoadReport(raw({ provenance: { ...raw().provenance, proofId: '' } }), { nowMs: NOW, acceptedAttestations: att });
  assert.equal(v.report.provenance.verification, 'UNVERIFIED');
  assert.equal(v.report.authorityPublicWarningApproved, false);
});
test('V16→DATEX→BLE copies from ONE origin remain one piece of evidence', () => {
  const feeds = ['V16', 'DATEX', 'BLE'].map((channel, i) => raw({ reportId: channel,
    observedAtMs: NOW - 4000 + i * 100,
    provenance: { ...raw().provenance, publisherId: 'dgt', rootId: 'original-dgt-1' },
  }));
  const result = fuse(feeds);
  assert.equal(result.scenes.length, 1);
  assert.equal(result.scenes[0].rootCount, 1);
  assert.equal(result.scenes[0].independentFamilyCount, 1);
});
test('two independent partner attestations corroborate but cannot self-authorize public broadcast', () => {
  const p = (rootId, family) => raw({ reportId: rootId,
    provenance: { rootId, publisherId: rootId, independenceFamily: family,
      verification: 'PARTNER_ATTESTED', proofId: `proof-${rootId}` } });
  const result = fuseRoadReports([p('taxi-1', 'TAXI_FLEET'), p('camera-1', 'ROAD_CAMERA')], { nowMs: NOW, acceptedAttestations:{'proof-taxi-1':{rootId:'taxi-1',publisherId:'taxi-1',independenceFamily:'TAXI_FLEET',verification:'PARTNER_ATTESTED',validUntilMs:NOW+1000}, 'proof-camera-1':{rootId:'camera-1',publisherId:'camera-1',independenceFamily:'ROAD_CAMERA',verification:'PARTNER_ATTESTED',validUntilMs:NOW+1000}} });
  assert.equal(result.scenes[0].evidence, 'CORROBORATED');
  assert.equal(result.scenes[0].warningApproved, false);
});
test('unverified opposite carriageway claim cannot poison authoritative scene', () => {
  const result = fuse([raw(), raw({ reportId:'other', provenance:{...raw().provenance,rootId:'r2'},
    road: {...raw().road,carriagewayId:'A-12-W'}, severity:'CRITICAL' })]);
  assert.equal(result.scenes.length, 1);
  assert.equal(result.scenes[0].severity, 'HIGH');
  assert.equal(result.scenes[0].road.carriagewayId, 'A-12-E');
});
test('two authenticated incompatible geometries force quarantine', () => {
  const r2 = raw({reportId:'other',provenance:{rootId:'r2',publisherId:'r2',
    independenceFamily:'ROAD_MANAGER',verification:'PARTNER_ATTESTED',proofId:'signed-r2'},
    road:{...raw().road,carriagewayId:'A-12-W'}});
  const result = fuse([raw(),r2], {acceptedAttestations:{...att,'signed-r2':{
    rootId:'r2',publisherId:'r2',independenceFamily:'ROAD_MANAGER',
    verification:'PARTNER_ATTESTED',validUntilMs:NOW+90000}}});
  assert.equal(result.scenes.length,0);
  assert.equal(result.rejected[0].reason,'CONFLICTING_ROAD_GEOMETRY');
});
test('unverified distant claims cannot be merged by proximity-only', () => {
  const two = [raw({ reportId:'a', incidentKey:'event-a' }), raw({ reportId:'b', incidentKey:'event-b',
    provenance:{...raw().provenance,rootId:'r2'}, road:{...raw().road,chainageM:123050} })];
  assert.equal(fuse(two).scenes.length, 2);
});
test('disputed evidence and malformed inputs never produce operational scenes', () => {
  const a = fuse([raw({ provenance: {...raw().provenance, verification:'DISPUTED'} })]);
  assert.equal(a.scenes.length, 0);
  assert.equal(fuse([raw({ expiresAtMs: NOW })]).scenes.length, 0);
  assert.equal(fuseRoadReports('oops', { nowMs: NOW }).status, 'ABSTAIN');
});
test('horizon locates the nearer queue tail before crash with speed-dependent ETA', () => {
  const accident = fuse([raw()]).scenes[0];
  const queue = fuse([raw({ incidentKey:'queue-x', hazardType:'TAIL_OF_QUEUE',
    road: {...raw().road,chainageM:122400}, provenance:{...raw().provenance,rootId:'tail-sensor'} })]).scenes[0];
  const out = buildElectronicHorizon({ driver:driver(), scenes:[accident, queue], nowMs:NOW });
  assert.equal(out.horizon.length, 2);
  assert.equal(out.horizon[0].hazardType, 'TAIL_OF_QUEUE');
  assert.equal(out.horizon[0].arbiterCandidate.evidence, 'UNVERIFIED');
  assert.equal(out.horizon[1].arbiterCandidate.evidence, 'OFFICIAL');
  assert.ok(out.horizon[0].etaRangeS[0] < out.horizon[1].etaRangeS[0]);
});
test('wrong carriageway, contrary direction and behind driver are suppressed', () => {
  const scene = fuse([raw()]).scenes[0];
  assert.equal(buildElectronicHorizon({driver:driver({carriagewayId:'A-12-W'}), scenes:[scene], nowMs:NOW}).rejected[0].reason, 'OTHER_CARRIAGEWAY');
  assert.equal(buildElectronicHorizon({driver:driver({direction:'DECREASING'}), scenes:[scene], nowMs:NOW}).rejected[0].reason, 'DIRECTION_UNVERIFIED_OR_OPPOSITE');
  assert.equal(buildElectronicHorizon({driver:driver({chainageM:125000}), scenes:[scene], nowMs:NOW}).rejected[0].reason, 'BEHIND_DRIVER');
});
test('unmatched geometry and stationary driver never trigger an automated voice candidate', () => {
  const scene = fuse([raw()]).scenes[0];
  assert.equal(buildElectronicHorizon({driver:driver({mapMatched:false}), scenes:[scene], nowMs:NOW}).status, 'ABSTAIN_UNMATCHED_ROUTE');
  assert.equal(buildElectronicHorizon({driver:driver({speedMps:0}), scenes:[scene], nowMs:NOW}).horizon[0].arbiterCandidate, null);
});
test('overlapping positioning uncertainty abstains from voice rather than precise distance', () => {
  const scene = fuse([raw()]).scenes[0];
  const x = buildElectronicHorizon({driver:driver({chainageM:122990}), scenes:[scene], nowMs:NOW});
  assert.equal(x.horizon[0].state, 'POSITION_OVERLAP_ABSTAIN_VOICE');
  assert.equal(x.horizon[0].arbiterCandidate, null);
});
test('public and private distribution denied by default; SMS needs consent', () => {
  const scene = fuse([raw()]).scenes[0];
  const out = planRoadAlertDistribution(scene, { nowMs: NOW, requestedChannels: ['SMS','BLE_PEER','DGT30','TAXI_PARTNER'],
    linkStates: { SMS:'MEASURED_UP', BLE_PEER:'MEASURED_UP', DGT30:'MEASURED_UP', TAXI_PARTNER:'MEASURED_UP' }});
  assert.equal(out.selected.length,0);
  assert.equal(out.blocked.length,4);
});
test('multiple approved media are only plans; cellular loss leaves measured BLE path without delivery claim', () => {
  const scene = fuse([raw()]).scenes[0];
  const o = planRoadAlertDistribution(scene, { nowMs:NOW, requestedChannels:['SMS','BLE_PEER','DTN_RELAY'],
    consents:['SMS_OPT_IN','BLE_RELAY_OPT_IN','DTN_OPT_IN'], grants:['TRUSTED_PEER_TRANSPORT'],
    linkStates:{SMS:'MEASURED_DOWN',BLE_PEER:'MEASURED_UP',DTN_RELAY:'MEASURED_UP'} });
  assert.deepEqual(o.selected.map(x=>x.channel), ['BLE_PEER','DTN_RELAY']);
  assert.deepEqual(o.failureFamilies, ['LOCAL_RADIO']);
  assert.equal(o.noDeliveryGuarantee, true);
  assert.equal(o.selected[0].destinationAck, false);
});
test('unknown channel and expired scene fail closed; no hidden authentication', () => {
  const scene = fuse([raw()]).scenes[0];
  const x = planRoadAlertDistribution(scene,{nowMs:NOW,requestedChannels:['PIRATE','CAP'],linkStates:{CAP:'MEASURED_UP'}});
  assert.equal(x.blocked.length,2);
  assert.equal(x.selected.length,0);
  assert.equal(planRoadAlertDistribution(scene,{nowMs:NOW+900000}).status,'ABSTAIN');
  assert.equal(Object.hasOwn(ROAD_ALERT_OUTPUTS,'__proto__'),false);
});

test('forged authority label and proof identifier cannot authorize a live broadcast', () => {
  const forged = raw({provenance:{...raw().provenance,proofId:'forged-proof'}});
  const scene = fuseRoadReports([forged], {nowMs:NOW}).scenes[0];
  assert.equal(scene.evidence,'UNVERIFIED');
  assert.equal(scene.warningApproved,false);
  const plan = planRoadAlertDistribution(scene,{nowMs:NOW,requestedChannels:['VOICE','DGT30','CAP'],
    linkStates:{VOICE:'MEASURED_UP',DGT30:'MEASURED_UP',CAP:'MEASURED_UP'},
    consents:['VOICE_OPT_IN'],grants:['HMI_APPROVED','DGT30_CREDENTIALS_AND_SCOPE','PUBLIC_ALERT_AUTHORITY']});
  assert.equal(plan.selected.length,0);
});
test('anonymous critical escalation cannot alter verified high severity', () => {
  const anonymous = raw({reportId:'forged-critical',severity:'CRITICAL',
    provenance:{rootId:'anonymous-r2',publisherId:'unknown',independenceFamily:'PEER',verification:'UNVERIFIED'}});
  const scene = fuse([raw(),anonymous]).scenes[0];
  assert.equal(scene.severity,'HIGH');
  assert.equal(scene.rootCount,1);
  assert.equal(scene.receivedRootCount,2);
});

test('P0: attacker copying official root cannot replace it with newer unsigned event',()=>{
  const attack=raw({reportId:'forged-newer',observedAtMs:NOW-100,
    severity:'CRITICAL',road:{...raw().road,chainageM:124000},
    provenance:{rootId:'original-dgt-1',publisherId:'fake-v16',independenceFamily:'FAKE',verification:'UNVERIFIED'}});
  const scene=fuse([raw(),attack]).scenes[0];
  assert.equal(scene.evidence,'OFFICIAL');
  assert.equal(scene.severity,'HIGH');
  assert.equal(scene.road.chainageM,123000);
  assert.equal(scene.rootCount,1);
});
test('P0: two verified publishers claiming same root enter quarantine',()=>{
  const e=raw({reportId:'other-publisher',
    provenance:{rootId:'original-dgt-1',publisherId:'other-authority',
      independenceFamily:'OTHER',verification:'PARTNER_ATTESTED',proofId:'other-proof'}});
  const r=fuse([raw(),e],{acceptedAttestations:{...att,'other-proof':{
    rootId:'original-dgt-1',publisherId:'other-authority',independenceFamily:'OTHER',
    verification:'PARTNER_ATTESTED',validUntilMs:NOW+10000}}});
  assert.equal(r.scenes.length,0);
  assert.equal(r.rejected[0].reason,'CONFLICTING_VERIFIED_ROOT_OWNERSHIP');
});
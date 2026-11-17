import test from 'node:test';
import assert from 'node:assert/strict';
import {auditResilienceCouncil,auditDeclaredContactWindow}
 from '../src/resilience-council.mjs';

const nowMs=Date.UTC(2026,10,17,5,0);
const risk={
  incidents:Array.from({length:100},(_,i)=>({
    incidentKey:'incident-'+i,
    independentBlockId:'causal-block-'+i,
    scenarioId:i<70?'NORMAL':i<95?'GRID_DOWN':'UNKNOWN',
    sourceId:'SYNTHETIC_DATASET',
    evidenceSha256:'a'.repeat(64),
  })),
  scenarioIds:['NORMAL','GRID_DOWN','UNKNOWN'],
  hazardsByState:{
    NORMAL:{family:{}},
    GRID_DOWN:{family:{TERRESTRIAL:.2,BACKBONE:.4,SATELLITE:.9}},
  },
  links:[
    {id:'cell-link',riskDomains:['same-tower','same-grid','same-core']},
    {id:'sms-link',riskDomains:['same-tower','same-grid','same-core']},
    {id:'sat-link',riskDomains:['sat-terminal-power','sat-operator']},
  ],
  paths:[
    {id:'CELL_PATH',linkIds:['cell-link'],costEUR:0,energyMj:10,
      consentDeclared:true,linkAuthorizedDeclared:true},
    {id:'SMS_PATH',linkIds:['sms-link'],costEUR:0,energyMj:10,
      consentDeclared:true,linkAuthorizedDeclared:true},
    {id:'SAT_PATH',linkIds:['sat-link'],costEUR:1,energyMj:30,
      consentDeclared:true,linkAuthorizedDeclared:true},
  ],
  contactModelsByPath:{
    CELL_PATH:{bearerId:'CELL_DATA',p:.92,shards:1,wireBytes:200,
      bytesPerSecond:100,handshakeMs:1000,windowStartMs:nowMs,
      windowEndMs:nowMs+30000},
    SMS_PATH:{bearerId:'SMS',p:.90,shards:1,wireBytes:100,
      bytesPerSecond:100,handshakeMs:1000,windowStartMs:nowMs,
      windowEndMs:nowMs+30000},
    SAT_PATH:{bearerId:'IRIDIUM_SBD',p:.8,shards:1,wireBytes:200,
      bytesPerSecond:100,handshakeMs:1000,windowStartMs:nowMs,
      windowEndMs:nowMs+30000},
  },
  nowMs,deadlineMs:nowMs+20000,k:1,alpha:.05,minRobustSuccess:.01
};
const clone=()=>structuredClone(risk);
test('H15: composes causal evidence, SRLG and contact windows into robust shadow-only pair',async()=>{
  const result=await auditResilienceCouncil(clone());
  assert.equal(result.contractVersion,'SENDA_H15_SHADOW_V1');
  assert.equal(result.status,'RESEARCH_ONLY_COUNTERFACTUAL_PAIR');
  assert.deepEqual(result.selectedPathIds,['CELL_PATH','SAT_PATH']);
  assert.equal(result.topologyAudit.consideredPairCount,3);
  assert.equal(result.assessedCandidateCount,2);
  assert.ok(result.exclusions.some(e=>e.pathIds.join('|')==='CELL_PATH|SMS_PATH'));
  assert.ok(result.modeledWorstCaseLower>0&&result.modeledWorstCaseLower<1);
  assert.ok(result.modeledWorstCaseLower<=result.modeledIndependentNominal+1e-10);
  assert.ok(result.scenarioUncertainty.unknownUpperMass>.05);
  assert.equal(result.scenarioUncertainty.IIDAssumptionExternallyVerified,false);
  assert.equal(result.mayIssuePublicAlert,false);
  assert.equal(result.maySendTraffic,false);
  assert.equal(result.mayClaimCertifiedEmergencyDelivery,false);
  assert.equal(result.notARealDeliveryProbability,true);
  assert.match(result.reproducibilitySha256,/^[0-9a-f]{64}$/);
});
test('H15: stable evidence digest independent of plain object property insertion order',async()=>{
  const base=clone();
  const other=clone();
  other.hazardsByState={GRID_DOWN:other.hazardsByState.GRID_DOWN,NORMAL:other.hazardsByState.NORMAL};
  other.contactModelsByPath={SAT_PATH:other.contactModelsByPath.SAT_PATH,
    SMS_PATH:other.contactModelsByPath.SMS_PATH,CELL_PATH:other.contactModelsByPath.CELL_PATH};
  const a=await auditResilienceCouncil(base),b=await auditResilienceCouncil(other);
  assert.equal(a.reproducibilitySha256,b.reproducibilitySha256);
  other.incidents[0].evidenceSha256='b'.repeat(64);
  const changed=await auditResilienceCouncil(other);
  assert.notEqual(changed.reproducibilitySha256,a.reproducibilitySha256);
  assert.equal(changed.digestKind,'UNSIGNED_CANONICAL_INPUT_FINGERPRINT');
});
test('H15: identical tower power risk is never considered independent routes',async()=>{
  const data=clone();
  data.paths=data.paths.slice(0,2);
  delete data.contactModelsByPath.SAT_PATH;
  const result=await auditResilienceCouncil(data);
  assert.equal(result.status,'NO_DEFENSIBLE_COUNTERFACTUAL_PAIR');
  assert.equal(result.selectedPathIds,null);
  assert.equal(result.assessedCandidateCount,0);
  assert.equal(result.maySendTraffic,false);
});
test('H15: missing SRLG metadata forces refusal, never optimistic independence',async()=>{
  const data=clone();
  data.links[2].riskDomains=[];
  const result=await auditResilienceCouncil(data);
  assert.equal(result.selectedPathIds,null);
  assert.ok(result.topologyAudit.incompleteTopologyPaths.includes('SAT_PATH'));
});
test('H15: path without declared authorization must never make a feasible research pair',async()=>{
  const data=clone();
  data.paths.forEach(p=>p.linkAuthorizedDeclared=false);
  const result=await auditResilienceCouncil(data);
  assert.equal(result.status,'NO_DEFENSIBLE_COUNTERFACTUAL_PAIR');
  assert.equal(result.assessedCandidateCount,0);
});
test('H15: deadlines, handshake, capacity and contact windows are binding',async()=>{
  const data=clone();
  data.contactModelsByPath.SAT_PATH.windowEndMs=nowMs+1500;
  const result=await auditResilienceCouncil(data);
  assert.equal(result.selectedPathIds,null);
  assert.equal(result.assessedCandidateCount,0);
  assert.equal(result.contactChecks.SAT_PATH.feasibleWithinDeclaredWindow,false);
  assert.ok(result.exclusions.some(x=>x.reasons.includes('CONTACT_UNAVAILABLE:SAT_PATH')));
});
test('H15: exact boundary of a declared contact can be met, but 1 ms later is infeasible',()=>{
  const model={wireBytes:200,bytesPerSecond:100,handshakeMs:1000,
    windowStartMs:nowMs,windowEndMs:nowMs+3000};
  const good=auditDeclaredContactWindow(model,{nowMs,deadlineMs:nowMs+3000});
  assert.equal(good.feasibleWithinDeclaredWindow,true);
  assert.equal(good.earliestFinishAtMs,nowMs+3000);
  const bad=auditDeclaredContactWindow({...model,windowEndMs:nowMs+2999},
    {nowMs,deadlineMs:nowMs+3000});
  assert.equal(bad.feasibleWithinDeclaredWindow,false);
});
test('H15: invalid, unknown and encrypted amateur bearers reject before giving a result',async()=>{
  const data=clone();
  data.contactModelsByPath.SAT_PATH.bearerId='UNKNOWN_PSEUDO_SATELLITE';
  await assert.rejects(auditResilienceCouncil(data),/invalid bearer model/);
  const amateur=clone();
  amateur.contactModelsByPath.SAT_PATH.bearerId='APRS';
  await assert.rejects(auditResilienceCouncil(amateur),/encrypted payload prohibited/);
});
test('H15: no calibration or unproven simulated success can meet an arbitrary 99.9% target',async()=>{
  const data=clone();data.minRobustSuccess=.999;
  const result=await auditResilienceCouncil(data);
  assert.equal(result.status,'NO_DEFENSIBLE_COUNTERFACTUAL_PAIR');
  assert.equal(result.modeledWorstCaseLower,null);
});
test('H15: invalid/duplicate causal episodes and missing UNKNOWN fail closed',async()=>{
  const duplicate=clone();
  duplicate.incidents[2].independentBlockId=duplicate.incidents[0].independentBlockId;
  await assert.rejects(auditResilienceCouncil(duplicate),/repeated|undocumented/);
  const noUnknown=clone();noUnknown.scenarioIds=['NORMAL','GRID_DOWN'];
  await assert.rejects(auditResilienceCouncil(noUnknown),/UNKNOWN/);
  const short=clone();short.incidents=short.incidents.slice(0,20);
  await assert.rejects(auditResilienceCouncil(short),/30/);
});
test('H15: missing/extra contact mapping and zero capacity reject before calculations',async()=>{
  const d=clone();delete d.contactModelsByPath.SAT_PATH;
  await assert.rejects(auditResilienceCouncil(d),/incomplete path/);
  const d2=clone();d2.contactModelsByPath.SAT_PATH.bytesPerSecond=0;
  await assert.rejects(auditResilienceCouncil(d2),/invalid declared contact/);
});
test('H15: arithmetic limits and invalid input never authorize radio or CAP',async()=>{
  for(const bad of [NaN,-1,Infinity]){
    const d=clone();d.nowMs=bad;
    await assert.rejects(auditResilienceCouncil(d));
  }
  const d=clone();d.deadlineMs=d.nowMs-1;
  await assert.rejects(auditResilienceCouncil(d));
  const x=await auditResilienceCouncil(clone());
  for(const name of ['mayIssuePublicAlert','maySendTraffic','mayClaimCertifiedEmergencyDelivery'])
    assert.equal(x[name],false);
});

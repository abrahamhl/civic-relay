import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateFrozenPairedPolicy as evaluate} from '../src/paired-policy-evaluator.mjs';

const start=Date.UTC(2026,10,17,1,0);
const protocol={id:'FROZEN-REPLAY-01',candidateVersion:'SENDA-H15-001',
  baselineVersion:'FIFO-WAIT-001',frozenAtMs:start,deadlineMs:60000,
  maxEnergyMj:200,maxCostEUR:2,design:'FROZEN_SYNTHETIC_PAIRED_REPLAY',
  sameExogenousTraceDeclared:true,licenseReviewDeclared:true};
const synthetic=(n=100,{candidate=()=>true,baseline=()=>false}={})=>
  Array.from({length:n},(_,i)=>({
    incidentKey:'incident-'+i,causalBlockId:'disaster-'+i,
    scenarioId:i%5===0?'GRID_DOWN':'NORMAL',
    traceSha256:i.toString(16).padStart(64,'0'),
    fold:'TEST',traceObservedAtMs:start+50000+i*1000,
    candidate:{acked:candidate(i),ackLatencyMs:candidate(i)?500: null,energyMj:50,costEUR:0},
    baseline:{acked:baseline(i),ackLatencyMs:baseline(i)?600: null,energyMj:50,costEUR:0}
  }));
test('H16: paired synthetic candidate with a real delta in fixture passes conservative time-uniform criterion',()=>{
  const r=evaluate({protocol,episodes:synthetic(600)});
  assert.equal(r.status,'POSITIVE_PAIRED_GAIN_IN_SYNTHETIC_REPLAY_ONLY');
  assert.equal(r.sampleSize,600);
  assert.equal(r.pairedCandidateWins,600);
  assert.equal(r.pairedBaselineWins,0);
  assert.equal(r.candidateOnTimeMinusBaseline,1);
  assert.ok(r.anytimeHoeffding.lower>0);
  assert.equal(r.trueMatchedCausalProcessVerified,false);
  assert.equal(r.realReceiverReceiptsCryptographicallyVerified,false);
  assert.equal(r.mayClaimCertifiedGain,false);
  assert.equal(r.fieldDeploymentAuthorized,false);
});
test('H16: equal policies produce an inconclusive comparison, no marketed superiority',()=>{
  const rows=synthetic(100,{candidate:i=>i%2===0,baseline:i=>i%2===0});
  const r=evaluate({protocol,episodes:rows});
  assert.equal(r.candidateOnTimeMinusBaseline,0);
  assert.equal(r.status,'NO_PAIRED_GAIN_DEMONSTRATED_IN_SYNTHETIC_REPLAY');
  assert.equal(r.pairedTies,100);
  assert.ok(r.anytimeHoeffding.lower<0&&r.anytimeHoeffding.upper>0);
});
test('H16: baseline can dominate, cannot claim fictional candidate improvement',()=>{
  const rows=synthetic(600,{candidate:()=>false,baseline:()=>true});
  const r=evaluate({protocol,episodes:rows});
  assert.equal(r.candidateOnTimeMinusBaseline,-1);
  assert.equal(r.status,'POSSIBLE_PAIRED_HARM_IN_SYNTHETIC_REPLAY_ONLY');
  assert.ok(r.anytimeHoeffding.upper<0);
});
test('H16: independent causal event keys and trace hashes cannot be reused',()=>{
  const bad=synthetic();bad[1]={...bad[1],causalBlockId:bad[0].causalBlockId};
  assert.throws(()=>evaluate({protocol,episodes:bad}),/duplicate/);
  const dupTrace=synthetic();dupTrace[2]={...dupTrace[2],traceSha256:dupTrace[0].traceSha256};
  assert.throws(()=>evaluate({protocol,episodes:dupTrace}),/duplicate/);
  const dupEvent=synthetic();dupEvent[3]={...dupEvent[3],incidentKey:dupEvent[0].incidentKey};
  assert.throws(()=>evaluate({protocol,episodes:dupEvent}),/duplicate/);
});
test('H16: protocol must be frozen BEFORE holdout traces, never after observations',()=>{
  const before=synthetic();
  before[5].traceObservedAtMs=protocol.frozenAtMs;
  assert.throws(()=>evaluate({protocol,episodes:before}),/non-held-out/);
  const after=synthetic();
  after[2].fold='TRAIN';
  assert.throws(()=>evaluate({protocol,episodes:after}),/non-held-out/);
});
test('H16: same declared maximum energy and cost, no asymmetric larger budget',()=>{
  const data=synthetic();data[3].candidate.energyMj=201;
  assert.throws(()=>evaluate({protocol,episodes:data}),/unfair/);
  const d=synthetic();d[4].baseline.costEUR=3;
  assert.throws(()=>evaluate({protocol,episodes:d}),/unfair/);
});
test('H16: receipt and latency contradictions are rejected, never interpreted as delivery',()=>{
  const missing=synthetic();missing[2].candidate.ackLatencyMs=null;
  assert.throws(()=>evaluate({protocol,episodes:missing}),/inconsistent/);
  const failed=synthetic();failed[2].candidate.acked=false;
  assert.throws(()=>evaluate({protocol,episodes:failed}),/inconsistent/);
});
test('H16: valid late acknowledgements count as missed deadline',()=>{
  const rows=synthetic();
  rows[0].candidate.ackLatencyMs=90000;
  const r=evaluate({protocol,episodes:rows});
  assert.equal(r.pairedCandidateWins,99);
  assert.equal(r.pairedTies,1);
  assert.equal(r.candidateOnTimeMinusBaseline,.99);
});
test('H16: risk-specific replay strata are descriptive, not proof of deployment distribution',()=>{
  const r=evaluate({protocol,episodes:synthetic()});
  assert.equal(r.byScenario.NORMAL.n,80);
  assert.equal(r.byScenario.GRID_DOWN.n,20);
  assert.equal(r.byScenario.NORMAL.meanPairedDelta,1);
  assert.equal(r.eventIIDVerified,false);
});
test('H16: statistical penalty increases with repeated monitoring, no p-hacking',()=>{
  const r=evaluate({protocol,episodes:synthetic(100)});
  const expectedFixed=Math.sqrt(2*Math.log(2/.05)/100);
  const expectedAnytime=Math.sqrt(2*Math.log(2*100*101/.05)/100);
  assert.ok(Math.abs(r.fixedNHoeffding.epsilon-expectedFixed)<1e-12);
  assert.ok(Math.abs(r.anytimeHoeffding.epsilon-expectedAnytime)<1e-12);
  assert.ok(r.anytimeHoeffding.epsilon>r.fixedNHoeffding.epsilon);
});
test('H16: insufficient episodes, invalid alpha, non-comparable versions and unlicensed replay all fail closed',()=>{
  assert.throws(()=>evaluate({protocol,episodes:synthetic(29)}));
  assert.throws(()=>evaluate({protocol,episodes:synthetic(),alpha:1}));
  assert.throws(()=>evaluate({protocol:{...protocol,baselineVersion:protocol.candidateVersion},episodes:synthetic()}));
  assert.throws(()=>evaluate({protocol:{...protocol,licenseReviewDeclared:false},episodes:synthetic()}));
});
test('H16: conditional 95th percentile latency is explicitly survivor-biased',()=>{
  const rows=synthetic(100,{candidate:i=>i<50,baseline:i=>i<50});
  for(let i=0;i<50;i++)rows[i].candidate.ackLatencyMs=i*10;
  const r=evaluate({protocol,episodes:rows});
  assert.equal(r.candidateAckedP95LatencyMs,470);
  assert.equal(r.latencyConditionedOnAcknowledgementSurvivorBias,true);
  assert.equal(r.comparedUnderSameDeclaredBudgets,true);
});

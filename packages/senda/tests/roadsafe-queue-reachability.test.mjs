import test from 'node:test';
import assert from 'node:assert/strict';
import { projectQueueTailEnvelope, lwrShockSpeed } from '../src/roadsafe-queue-reachability.mjs';
import { evaluateCoverageBounds, wilsonInterval95, assessCoverageAtQueueDeadline } from '../src/roadsafe-coverage-bounds.mjs';

const NOW = 2_000_000;
const a = { atMs:NOW-10000, chainageM:123000, uncertaintyM:5, roadId:'A12',
  carriagewayId:'A12 EAST', direction:'INCREASING', incidentKey:'tail-11', mapMatched:true };
const b = {...a, atMs:NOW, chainageM:122960};
const driver = {roadId:'A12',carriagewayId:'A12 EAST',direction:'INCREASING',
  mapMatched:true,chainageM:121500,uncertaintyM:5};
const constraints = {driverSpeedRangeMps:[24,26],latencyRangeS:[0.3,1],
  reactionRangeS:[1,2],decelerationRangeMs2:[4,6],clearanceMarginM:10,maxExtrapolationS:20,maxObservationGapS:30,maxAbsWaveSpeedMps:15};
const evalQ = (o = {}) => projectQueueTailEnvelope({ observations:[a,b],driver,nowMs:NOW,constraints, ...o });
const field = (extra={})=>({channelId:'BLE-A12',failureDomain:'PHONE_RADIO',measurementStratum:'A12 Android foreground clear',
  receiverAckType:'DESTINATION_ACK',authorizationGranted:true,consentGranted:true,
  measurementOrigin:'FIELD_OBSERVED',trials:100,deadlineSuccesses:80,
  testedDeadlineS:10,measuredLatencyP95S:8,observedAtMs:NOW-10000,validUntilMs:NOW+60000,...extra});

test('interval tail speed from two observations is guaranteed outer envelope at endpoints',()=>{
  const x=evalQ(); assert.equal(x.status,'SCIENTIFIC_MODEL_ONLY');
  assert.deepEqual(x.waveVelocityRangeMps,[-5,-3]);
  assert.deepEqual(x.distanceRangeM,[1450,1470]);
  assert.deepEqual(x.closureSpeedRangeMps,[27,31]);
  assert.equal(x.verdict,'TIMING_ROBUST_IN_MODEL');
  assert.equal(x.canWarnDrivers,false);
  assert.ok(x.robustTimingMarginM>1200);
});
test('backwards-moving queue reaches car sooner than using static point',()=>{
  const q=evalQ();
  assert.ok(q.encounterTimeRangeS[0] < 1455/26);
  assert.ok(q.encounterTimeRangeS[0] > 40);
});
test('extrapolation updates position interval after 10 seconds',()=>{
  const p=evalQ({nowMs:NOW+10000});
  assert.deepEqual(p.projectedTailRangeAlongRoadM,[122905,122935]);
  assert.equal(p.observationAgeS,10);
});
test('extrapolation beyond caller freshness gate always abstains',()=>{
  assert.equal(evalQ({nowMs:NOW+20001}).reason,'INVALID_OR_STALE_OBSERVATION_TIMING');
});
test('driver in other carriageway, road or direction always abstains',()=>{
  for(const change of [{carriagewayId:'A12 WEST'},{roadId:'N233'},{direction:'DECREASING'}]){
    assert.equal(evalQ({driver:{...driver,...change}}).reason,'INCIDENT_ROAD_OR_DIRECTION_MISMATCH');
  }
});
test('map matching is necessary for driver AND queue reports',()=>{
  assert.equal(evalQ({driver:{...driver,mapMatched:false}}).reason,'DRIVER_NOT_MAP_MATCHED');
  assert.equal(evalQ({observations:[a,{...b,mapMatched:false}]}).reason,'UNVERIFIED_TAIL_LOCATION');
});
test('replay clock, duplicate times, mismatched incident and missing speed bound abstain',()=>{
  assert.equal(evalQ({nowMs:NOW-100}).reason,'INVALID_OR_STALE_OBSERVATION_TIMING');
  assert.equal(evalQ({observations:[a,{...b,atMs:a.atMs}]}).reason,'INVALID_OR_STALE_OBSERVATION_TIMING');
  assert.equal(evalQ({observations:[a,{...b,incidentKey:'other'}]}).reason,'INCIDENT_ROAD_OR_DIRECTION_MISMATCH');
  assert.equal(evalQ({constraints:{...constraints,latencyRangeS:null}}).reason,'UNCALIBRATED_SAFETY_PARAMETERS');
});
test('a queue tail behind driver does not become a future warning',()=>{
  assert.equal(evalQ({driver:{...driver,chainageM:124000}}).reason,'QUEUE_TAIL_BEHIND_DRIVER');
});
test('position interval overlap blocks any driver-warning decision',()=>{
  assert.equal(evalQ({driver:{...driver,chainageM:122958}}).reason,'POSITION_OVERLAP_NO_DRIVER_WARNING');
});
test('zero closing speed: no proven approach',()=>{
  assert.equal(evalQ({constraints:{...constraints,driverSpeedRangeMps:[0,1]}, observations:[a,{...b,chainageM:123100}]}).reason,'NO_PROVEN_APPROACH');
});
test('reversing direction with chainage decreasing reproduces physical result',()=>{
  const flip=x=>126000-x;
  const decA={...a,chainageM:flip(a.chainageM),direction:'DECREASING'};
  const decB={...b,chainageM:flip(b.chainageM),direction:'DECREASING'};
  const decDriver={...driver,chainageM:flip(driver.chainageM),direction:'DECREASING'};
  const x=evalQ({observations:[decA,decB],driver:decDriver});
  assert.deepEqual(x.distanceRangeM,[1450,1470]);
  assert.deepEqual(x.waveVelocityRangeMps,[-5,-3]);
});
test('robust conclusion rejects fixed 500m threshold when clearance physics demands more',()=>{
  const data={...driver,chainageM:122440,uncertaintyM:10};
  const c={...constraints,driverSpeedRangeMps:[29,31],latencyRangeS:[1,2],
    reactionRangeS:[1,2],decelerationRangeMs2:[1.5,2],clearanceMarginM:20};
  const x=evalQ({driver:data,constraints:c});
  assert.ok(x.distanceRangeM[0] > 500,'naive threshold would call it safe');
  assert.notEqual(x.verdict,'TIMING_ROBUST_IN_MODEL');
  assert.ok(x.robustTimingMarginM < 0);
});
test('LWR shock speed based on conservation and near singularity gate',()=>{
  const w=lwrShockSpeed({upstream:{flowVehH:1500,densityVehKm:30},
    downstream:{flowVehH:900,densityVehKm:60}});
  assert.equal(w.status,'THEORETICAL_SPEED_ONLY');
  assert.ok(Math.abs(w.shockSpeedMps+20/3.6)<1e-10);
  const bad=lwrShockSpeed({upstream:{flowVehH:1,densityVehKm:30},downstream:{flowVehH:2,densityVehKm:30.001}});
  assert.equal(bad.reason,'NEAR_SINGULAR_DENSITY_DIFFERENCE');
});
test('LWR conflict gate blocks incompatible model and accepts within tolerance',()=>{
  const ref={upstream:{flowVehH:1500,densityVehKm:30},downstream:{flowVehH:900,densityVehKm:60}};
  assert.equal(evalQ({flowCheck:ref,maxFlowDisagreementMps:0.2}).reason,'OBSERVATION_LWR_CONTRADICTION');
  assert.equal(evalQ({flowCheck:ref,maxFlowDisagreementMps:0.6}).status,'SCIENTIFIC_MODEL_ONLY');
});
test('corner samples never violate a claimed robust timing margin',()=>{
  const result=evalQ(); assert.equal(result.verdict,'TIMING_ROBUST_IN_MODEL');
  const [dMin,dMax]=result.distanceRangeM,[wcLo,wcHi]=result.waveVelocityRangeMps;
  for(const d of [dMin,dMax]) for(const v of constraints.driverSpeedRangeMps)
  for(const w of [wcLo,wcHi]) for(const lag of constraints.latencyRangeS)
  for(const react of constraints.reactionRangeS) for(const decel of constraints.decelerationRangeMs2){
    const close=Math.max(0,v-w);
    const need=close*(lag+react)+close*close/(2*decel)+constraints.clearanceMarginM;
    assert.ok(d >= need-1e-8,`violated at ${[d,v,w,lag,react,decel]}`);
  }
});

test('Wilson interval bounded, including all successes and zero successes',()=>{
  const none=wilsonInterval95(0,100), all=wilsonInterval95(100,100);
  assert.equal(none.status,'ASSUMPTION_BOUND');
  assert.equal(none.interval[0],0); assert.ok(none.interval[1]<0.04);
  assert.equal(all.interval[1],1); assert.ok(all.interval[0]>0.96);
  assert.equal(wilsonInterval95(2,1).status,'INSUFFICIENT_COUNTS');
});
test('no calibration field data means abstain, even with invented success numbers',()=>{
  const r=evaluateCoverageBounds({channelEvidence:[field({measurementOrigin:'SYNTHETIC'})],deadlineS:20,nowMs:NOW});
  assert.equal(r.status,'ABSTAIN_NO_CALIBRATED_CHANNEL');
  assert.equal(r.blocked[0].reason,'NO_EMPIRICAL_FIELD_MEASUREMENTS');
});
test('custody ack cannot count as final receiver receipt',()=>{
  const r=evaluateCoverageBounds({channelEvidence:[field({receiverAckType:'CUSTODY_ACK'})],deadlineS:20,nowMs:NOW});
  assert.equal(r.blocked[0].reason,'CUSTODY_IS_NOT_RECEIPT');
});
test('no authorization or consent, insufficient samples, wrong OS stratum, stale evidence',()=>{
  const cases=[
    [{authorizationGranted:false},'NO_AUTHORIZATION_OR_CONSENT'],
    [{consentGranted:false},'NO_AUTHORIZATION_OR_CONSENT'],
    [{trials:12,deadlineSuccesses:10},'TOO_FEW_SAMPLES'],
    [{validUntilMs:NOW},'STALE_RECEIPT_EVIDENCE'],
    [{testedDeadlineS:30},'TESTED_DEADLINE_TOO_LAX'],
    [{measuredLatencyP95S:30},'LATENCY_P95_EXCEEDS_DEADLINE'],
  ];
  for(const [extra,reason] of cases){const r=evaluateCoverageBounds({channelEvidence:[field(extra)],deadlineS:20,nowMs:NOW});
    assert.equal(r.blocked[0].reason,reason,reason);}
  assert.equal(evaluateCoverageBounds({channelEvidence:[field()],deadlineS:20,nowMs:NOW,
    requiredStratum:'iOS locked'}).blocked[0].reason,'STRATUM_MISMATCH');
});
test('duplicate paths do not double count coverage and no independence assumed',()=>{
  const routes=[field(),field({channelId:'DTN-A12',failureDomain:'PHONE_RADIO',deadlineSuccesses:75})];
  const r=evaluateCoverageBounds({channelEvidence:routes,deadlineS:20,nowMs:NOW});
  assert.equal(r.status,'RESEARCH_BOUNDS_ONLY');
  assert.equal(r.failureDomains.length,1);
  assert.equal(r.channels.length,2);
  assert.equal(r.canWarnDrivers,false);
  assert.ok(r.dependenceAgnosticExploratoryRange[0] < 0.9);
  assert.equal(r.dependenceAgnosticExploratoryRange[1],1);
  assert.equal(r.noDeliveryGuarantee,true);
});
test('a channel observed in separate operating conditions is not pooled',()=>{
  const r=evaluateCoverageBounds({channelEvidence:[field(),field({channelId:'IOS-BLE',measurementStratum:'iOS locked'})],
    deadlineS:20,nowMs:NOW,requiredStratum:'A12 Android foreground clear'});
  assert.equal(r.channels.length,1); assert.equal(r.blocked[0].reason,'STRATUM_MISMATCH');
});
test('coverage at moving queue deadline is a coupling, not a driver warning',()=>{
  const q=evalQ();const c=evaluateCoverageBounds({channelEvidence:[field()],deadlineS:20,nowMs:NOW});
  const decision=assessCoverageAtQueueDeadline({queueEnvelope:q,coverage:c,reserveS:20});
  assert.equal(decision.status,'RESEARCH_TIMING_COVERAGE_ONLY');
  assert.equal(decision.canWarnDrivers,false);
  assert.deepEqual(decision.qualifiedChannelsWithinBudget,['BLE-A12']);
  assert.ok(decision.availableRelayBudgetS<q.encounterTimeRangeS[0]);
});
test('coverage coupling with untrusted evidence or too-short deadline abstains from optimistic reach',()=>{
  const q=evalQ(); const c=evaluateCoverageBounds({channelEvidence:[field()],deadlineS:20,nowMs:NOW});
  assert.equal(assessCoverageAtQueueDeadline({queueEnvelope:{status:'ABSTAIN'},coverage:c}).status,'ABSTAIN');
  const short=assessCoverageAtQueueDeadline({queueEnvelope:q,coverage:c,reserveS:100});
  assert.equal(short.exploratoryLowerOnAtLeastOneReceipt,null);
});

test('observation gap cannot silently extrapolate beyond declared temporal validity',()=>{
  assert.equal(evalQ({constraints:{...constraints,maxObservationGapS:5}}).reason,'INVALID_OR_STALE_OBSERVATION_TIMING');
});
test('overflow and impossible huge numerical ranges abstain rather than claim safety',()=>{
  const huge={...constraints,driverSpeedRangeMps:[1e300,1e300],decelerationRangeMs2:[1,2]};
  assert.equal(evalQ({constraints:huge}).reason,'NUMERICAL_OVERFLOW');
});

test('unbounded or implausible queue shock speed is not treated as a safe extrapolation',()=>{
  assert.equal(evalQ({constraints:{...constraints,maxAbsWaveSpeedMps:null}}).reason,'UNCALIBRATED_OR_IMPLAUSIBLE_WAVE_SPEED');
  assert.equal(evalQ({constraints:{...constraints,maxAbsWaveSpeedMps:2}}).reason,'UNCALIBRATED_OR_IMPLAUSIBLE_WAVE_SPEED');
});
test('without explicit stratum, heterogeneous OS telemetry must not be pooled',()=>{
  const r=evaluateCoverageBounds({channelEvidence:[field(),field({channelId:'IOS-LOCKED',
    measurementStratum:'iOS locked'})],deadlineS:20,nowMs:NOW});
  assert.equal(r.status,'ABSTAIN_MIXED_MEASUREMENT_STRATA');
  assert.equal(r.channels.length,0);
});
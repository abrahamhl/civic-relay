import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnytimeIncidentFrequencyEnvelope,anytimeHalfWidth,compareFixedVersusAnytime}
  from '../src/anytime-scenario-confidence.mjs';
import {buildIncidentFrequencyEnvelope,attachConservativeResearchHazards}
  from '../src/scenario-frequency-evidence.mjs';
import {auditAssuranceAgainstUncertainHazards} from '../src/robust-assurance-audit.mjs';

const ids=['NORMAL','BLACKOUT','UNKNOWN'];
const mk=(labels)=>labels.map((scenarioId,i)=>({
  incidentKey:'episode-'+i,
  independentBlockId:'causal-disaster-'+i,
  scenarioId,sourceId:'lab-fixture-01',evidenceSha256:'a'.repeat(64)
}));
const labels=Array.from({length:100},(_,i)=>i<70?'NORMAL':i<90?'BLACKOUT':'UNKNOWN');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,String(a)+' vs '+String(b));

test('H14: correct time-uniform alpha-spending radius at n=100 and 3 categories',()=>{
  const radius=anytimeHalfWidth({sampleSize:100,categoryCount:3,alpha:.05});
  near(radius,Math.sqrt(Math.log(2*3*100*101/.05)/(2*100)));
  const fixed=Math.sqrt(Math.log(2*3/.05)/(2*100));
  assert.ok(radius>fixed,'peeking incurs statistical cost');
  assert.ok(anytimeHalfWidth({sampleSize:1000,categoryCount:3,alpha:.05})<radius);
});
test('H14: telescoping error budget sum over n of alpha/[n(n+1)] = alpha',()=>{
  const alpha=.05,m=3;
  let spent=0;
  for(let n=1;n<=100000;n++)spent+=alpha/(n*(n+1));
  near(spent,alpha*(1-1/100001));
  const eps=anytimeHalfWidth({sampleSize:50,categoryCount:m,alpha});
  near(2*Math.exp(-2*50*eps*eps),alpha/(m*50*51));
});
test('H14: reuses strict causal-block H12 input validation, not packet pseudo-replication',()=>{
  const rows=mk(labels);
  const anytime=buildAnytimeIncidentFrequencyEnvelope({incidents:rows,scenarioIds:ids});
  const fixed=buildIncidentFrequencyEnvelope({incidents:rows,scenarioIds:ids});
  assert.equal(anytime.sampleSize,100);
  assert.deepEqual(anytime.counts,{NORMAL:70,BLACKOUT:20,UNKNOWN:10});
  assert.ok(anytime.simultaneousHalfWidth>fixed.simultaneousHalfWidth);
  near(anytime.states.find(s=>s.id==='UNKNOWN').nominalMass,.1);
  assert.ok(anytime.unknownUpperMass>fixed.unknownUpperMass);
  assert.equal(anytime.sequentialMonitoringAllowedUnderIIDAssumptions,true);
  assert.equal(anytime.operationalAuthorizationGranted,false);
  assert.equal(anytime.independenceOfIncidentsVerified,false);
  const comparison=compareFixedVersusAnytime(anytime);
  near(comparison.monitoringPenalty,anytime.simultaneousHalfWidth-fixed.simultaneousHalfWidth);
});
test('H14: duplicate causal episode, bad digest, absent UNKNOWN and wrong alpha reject',()=>{
  const rows=mk(labels);
  rows[1]={...rows[1],independentBlockId:rows[0].independentBlockId};
  assert.throws(()=>buildAnytimeIncidentFrequencyEnvelope({incidents:rows,scenarioIds:ids}));
  assert.throws(()=>buildAnytimeIncidentFrequencyEnvelope({incidents:mk(labels),scenarioIds:['NORMAL','BLACKOUT']}));
  const bad=mk(labels);bad[0].evidenceSha256='untrusted';
  assert.throws(()=>buildAnytimeIncidentFrequencyEnvelope({incidents:bad,scenarioIds:ids}));
  assert.throws(()=>buildAnytimeIncidentFrequencyEnvelope({incidents:mk(labels),scenarioIds:ids,alpha:1}));
});
test('H14: invalid sample size, category count, alpha and untrusted comparison fail closed',()=>{
  assert.throws(()=>anytimeHalfWidth({sampleSize:0,categoryCount:3,alpha:.05}));
  assert.throws(()=>anytimeHalfWidth({sampleSize:100,categoryCount:1,alpha:.05}));
  assert.throws(()=>anytimeHalfWidth({sampleSize:100,categoryCount:3,alpha:NaN}));
  assert.throws(()=>anytimeHalfWidth({sampleSize:100,categoryCount:3,alpha:-1}));
  assert.throws(()=>compareFixedVersusAnytime({states:[]}));
});
test('H14: unknown unseen means non-zero risk after many independent incident blocks',()=>{
  const r=buildAnytimeIncidentFrequencyEnvelope({incidents:mk(
    Array.from({length:500},(_,i)=>i<400?'NORMAL':'BLACKOUT')),scenarioIds:ids});
  assert.equal(r.counts.UNKNOWN,0);
  assert.ok(r.unknownUpperMass>0);
  assert.equal(r.representativeOfFutureDisastersVerified,false);
});
test('H14: time-uniform conservative UNKNOWN flows to fail-closed Claude engine',()=>{
  const env=buildAnytimeIncidentFrequencyEnvelope({incidents:mk(labels),scenarioIds:ids});
  const haz=attachConservativeResearchHazards(env,{
    NORMAL:{family:{}},
    BLACKOUT:{family:{TERRESTRIAL:0.05}},
  });
  assert.equal(haz.states.find(s=>s.id==='UNKNOWN').isUnknownConservative,true);
  const audit=auditAssuranceAgainstUncertainHazards({states:haz.states,plans:[{
    id:'only-cell',k:1,groups:[{id:'CELL_DATA',p:.99,shards:1}],
    costEUR:0,energyMj:15,consentDeclared:true,linkAuthorizedDeclared:true
  }],minRobustSuccess:.99});
  assert.equal(audit.selectedId,null);
  assert.ok(audit.evaluations[0].robustLower<.99);
  assert.equal(audit.operationallyAuthorized,false);
});
test('H14: 300 synthetic IID streams with repeated monitoring retain simultaneous coverage',()=>{
  // This is only a Monte Carlo sanity check, NOT a statistical guarantee for field incidents.
  const m=3,alpha=.05,p=[.65,.25,.10];
  let seed=20261117;
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  let covered=0;
  const checkpoints=[30,50,100,200,400];
  for(let trial=0;trial<300;trial++){
    const count=[0,0,0];let okay=true,look=0;
    for(let n=1;n<=400;n++){
      const u=rng();count[u<p[0]?0:u<p[0]+p[1]?1:2]++;
      if(n===checkpoints[look]){
        const e=anytimeHalfWidth({sampleSize:n,categoryCount:m,alpha});
        if(count.some((x,j)=>Math.abs(x/n-p[j])>e))okay=false;
        look++;
      }
    }
    if(okay)covered++;
  }
  assert.ok(covered>=285,'synthetic stream coverage '+covered+'/300');
});

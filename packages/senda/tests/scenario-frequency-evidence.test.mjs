import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIncidentFrequencyEnvelope,attachConservativeResearchHazards}
  from '../src/scenario-frequency-evidence.mjs';
import {auditAssuranceAgainstUncertainHazards} from '../src/robust-assurance-audit.mjs';

const sample=(n=100, distribution={NORMAL:80,GRID_DOWN:15,UNKNOWN:5})=>{
  const labels=Object.entries(distribution).flatMap(([id,count])=>Array(count).fill(id));
  assert.equal(n,labels.length);
  return labels.map((scenarioId,i)=>({
    incidentKey:'episode-'+String(i).padStart(5,'0'),
    independentBlockId:'causal-block-'+String(i).padStart(5,'0'),
    scenarioId,sourceId:'official-feed-'+i%3,
    evidenceSha256:'a'.repeat(63)+(i%16).toString(16)
  }));
};
const ids=['NORMAL','GRID_DOWN','UNKNOWN'];
const get=(env,id)=>env.states.find(s=>s.id===id);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,String(a)+' != '+String(b));

test('H12: counts independent incident IDs, not messages, and creates simultaneous Hoeffding bands',()=>{
  const r=buildIncidentFrequencyEnvelope({incidents:sample(),scenarioIds:ids});
  assert.equal(r.sampleSize,100);
  assert.deepEqual(r.counts,{NORMAL:80,GRID_DOWN:15,UNKNOWN:5});
  near(get(r,'NORMAL').nominalMass,.8);
  near(get(r,'GRID_DOWN').nominalMass,.15);
  near(get(r,'UNKNOWN').nominalMass,.05);
  near(r.simultaneousHalfWidth,Math.sqrt(Math.log(2*3/.05)/(2*100)));
  assert.equal(r.sourceAuthenticityVerified,false);
  assert.equal(r.independenceOfIncidentsVerified,false);
  assert.equal(r.mayAuthorizeOperationalRouting,false);
});
test('H12: zero observed unknown outages still means nonzero risk upper bound',()=>{
  const obs=sample(100,{NORMAL:90,GRID_DOWN:10,UNKNOWN:0});
  const r=buildIncidentFrequencyEnvelope({incidents:obs,scenarioIds:ids});
  near(get(r,'UNKNOWN').nominalMass,0);
  assert.ok(get(r,'UNKNOWN').upperMass>.1,'0/100 is not proof of zero risk');
  assert.equal(r.status,'RESEARCH_ESTIMATE_ONLY');
});
test('H12: duplicate evidence for same incident is rejected even if packet counts are large',()=>{
  const rows=sample();
  rows.push({...rows[0],scenarioId:'GRID_DOWN'});
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:rows,scenarioIds:ids}),/repeated|undocumented/);
});
test('H12: two distinct municipal incidents from one disaster cannot be counted as independent blocks',()=>{
  const obs=sample();
  obs[1]={...obs[1],independentBlockId:obs[0].independentBlockId};
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:obs,scenarioIds:ids}),/repeated|undocumented/);
  const noBlock=sample(); delete noBlock[2].independentBlockId;
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:noBlock,scenarioIds:ids}));
});
test('H12: missing UNKNOWN, missing source hash and unclassified incident fail closed',()=>{
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:sample(),scenarioIds:['NORMAL','GRID_DOWN']}),/UNKNOWN/);
  const rows=sample();
  rows[0]={...rows[0],evidenceSha256:'not-a-sha'};
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:rows,scenarioIds:ids}),/undocumented/);
  const rest=sample();rest[5]={...rest[5],scenarioId:'SECRET_UNKNOWN'};
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:rest,scenarioIds:ids}));
});
test('H12: too few events, invalid confidence, duplicate or invalid scenarios fail closed',()=>{
  const small=sample(30,{NORMAL:30,GRID_DOWN:0,UNKNOWN:0}).slice(0,29);
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:small,scenarioIds:ids}));
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:sample(),scenarioIds:ids,alpha:0}));
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:sample(),scenarioIds:ids,alpha:0.99}));
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:sample(),scenarioIds:[...ids,'UNKNOWN']}));
  assert.throws(()=>buildIncidentFrequencyEnvelope({incidents:sample(),scenarioIds:['NORMAL','__proto__','UNKNOWN']}));
});
test('H12: unknown hazard must guarantee zero availability for EVERY bearer family',()=>{
  const r=buildIncidentFrequencyEnvelope({incidents:sample(),scenarioIds:ids});
  const h=attachConservativeResearchHazards(r,{
    NORMAL:{family:{}},
    GRID_DOWN:{family:{TERRESTRIAL:.15,BACKBONE:.3}},
    UNKNOWN:{family:{TERRESTRIAL:1,SATELLITE:1}}, // deliberately ignored
  });
  const unknown=h.states.find(s=>s.id==='UNKNOWN');
  assert.equal(unknown.isUnknownConservative,true);
  assert.ok(Object.values(unknown.hazard.family).length>=6);
  assert.ok(Object.values(unknown.hazard.family).every(p=>p===0));
  assert.equal(h.permissionsGranted,false);
});
test('H12: an UNKNOWN scenario with unobserved modes prevents spurious 99% robust guarantee',()=>{
  const r=buildIncidentFrequencyEnvelope({incidents:sample(),scenarioIds:ids});
  const x=attachConservativeResearchHazards(r,{
    NORMAL:{family:{}},
    GRID_DOWN:{family:{TERRESTRIAL:.1}},
  });
  const plans=[{
    id:'cell',k:1,groups:[{id:'CELL_DATA',p:.99,shards:1}],
    consentDeclared:true,linkAuthorizedDeclared:true,costEUR:0,energyMj:10,
  }];
  const audit=auditAssuranceAgainstUncertainHazards({
    states:x.states,plans,minRobustSuccess:.99});
  assert.equal(audit.selectedId,null);
  assert.ok(audit.evaluations[0].robustLower<.99);
  assert.equal(audit.physicalHardwareValidated,false);
});
test('H12: narrower uncertainty from more distinct incidents, NOT from message replication',()=>{
  const a=buildIncidentFrequencyEnvelope({incidents:sample(100,{NORMAL:80,GRID_DOWN:15,UNKNOWN:5}),scenarioIds:ids});
  const b=buildIncidentFrequencyEnvelope({incidents:sample(1000,{NORMAL:800,GRID_DOWN:150,UNKNOWN:50}),scenarioIds:ids});
  assert.ok(b.simultaneousHalfWidth<a.simultaneousHalfWidth);
  assert.ok(b.unknownUpperMass<a.unknownUpperMass);
});
test('H12: independent synthetic multinomial simulations show conservative band coverage',()=>{
  const n=100,m=3,prob=[.75,.2,.05],alpha=.05;
  let seed=20261117;
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  let covered=0;
  for(let trial=0;trial<250;trial++){
    const counts=[0,0,0];
    for(let i=0;i<n;i++){
      const u=rng(),index=u<prob[0]?0:u<prob[0]+prob[1]?1:2;
      counts[index]++;
    }
    const eps=Math.sqrt(Math.log(2*m/alpha)/(2*n));
    if(counts.every((c,j)=>Math.abs(c/n-prob[j])<=eps+1e-12))covered++;
  }
  assert.ok(covered>=235,'reproducible synthetic sanity, not field coverage evidence');
});

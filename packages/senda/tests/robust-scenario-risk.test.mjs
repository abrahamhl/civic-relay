import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScenarioEnvelope,evaluateScenarioUncertainty,chooseRobustResearchPlan}
  from '../src/robust-scenario-risk.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,String(a)+' != '+String(b));
const states=[
  {id:'NORMAL',lowerMass:.4,upperMass:.95,nominalMass:.95},
  {id:'BLACKOUT',lowerMass:.05,upperMass:.6,nominalMass:.05},
];
const direct={NORMAL:{lower:.98,upper:.98,nominal:.98},BLACKOUT:{lower:.05,upper:.05,nominal:.05}};
const diverse={NORMAL:{lower:.85,upper:.85,nominal:.85},BLACKOUT:{lower:.8,upper:.8,nominal:.8}};
const plan=(id,successByState,mod={})=>({id,successByState,consentDeclared:true,
  linkAuthorizedDeclared:true,costEUR:0,energyMj:20,...mod});

test('exact two-state LP: worst case shifts 60% of mass onto common blackout',()=>{
  const r=evaluateScenarioUncertainty({states,successByState:direct});
  near(r.robustLower,.4*.98+.6*.05);
  near(r.robustUpper,.95*.98+.05*.05);
  near(r.nominalConditional,.95*.98+.05*.05);
  near(r.worstCaseScenarioMass.BLACKOUT,.6);
  assert.equal(r.probabilityOfPhysicalDeliveryVerified,false);
  assert.equal(r.operationallyAuthorized,false);
});
test('higher nominal success can be rejected in favour of smaller worst-case loss',()=>{
  const r=chooseRobustResearchPlan({states,candidates:[plan('single',direct),plan('diverse',diverse)]});
  const a=r.evaluations.find(x=>x.id==='single'),b=r.evaluations.find(x=>x.id==='diverse');
  assert.ok(a.nominalConditional>b.nominalConditional);
  assert.ok(a.robustLower<b.robustLower);
  assert.equal(r.selectedId,'diverse');
  assert.equal(r.mayClaimRealEmergencyReliability,false);
});
test('single fixed distribution degenerates to a single exact mathematical expectation',()=>{
  const s=[{id:'A',lowerMass:.2,upperMass:.2,nominalMass:.2},
    {id:'B',lowerMass:.8,upperMass:.8,nominalMass:.8}];
  const p={A:{lower:.5,upper:.5,nominal:.5},B:{lower:.8,upper:.8,nominal:.8}};
  const r=evaluateScenarioUncertainty({states:s,successByState:p});
  near(r.robustLower,.74);near(r.robustUpper,.74);near(r.nominalConditional,.74);
});
test('conditional success intervals: lower and upper cannot be confused with nominal',()=>{
  const p={NORMAL:{lower:.6,upper:.8,nominal:.7},BLACKOUT:{lower:.2,upper:.3,nominal:.25}};
  const r=evaluateScenarioUncertainty({states,successByState:p});
  near(r.robustLower,.4*.6+.6*.2);
  near(r.robustUpper,.95*.8+.05*.3);
  assert.ok(r.robustLower<r.nominalConditional&&r.nominalConditional<r.robustUpper);
});
test('missing probability mass, duplicate IDs, inverted bounds, NaN fail closed',()=>{
  const bad=[
    [{id:'A',lowerMass:.1,upperMass:.4,nominalMass:.2}],
    [{id:'A',lowerMass:0,upperMass:1,nominalMass:.5}],
    [{id:'A',lowerMass:.1,upperMass:.6,nominalMass:.4},{id:'A',lowerMass:.1,upperMass:.6,nominalMass:.6}],
    [{id:'A',lowerMass:.8,upperMass:.9,nominalMass:.85},{id:'B',lowerMass:.8,upperMass:.9,nominalMass:.15}],
    [{id:'A',lowerMass:0,upperMass:.6,nominalMass:.5},{id:'B',lowerMass:0,upperMass:.3,nominalMass:.5}],
    [{id:'A',lowerMass:-.01,upperMass:1,nominalMass:1}],
    [{id:'A',lowerMass:0,upperMass:NaN,nominalMass:1}],
  ];
  for(const s of bad)assert.throws(()=>validateScenarioEnvelope(s));
});
test('omitted, surplus or logically impossible per-scenario success fails closed',()=>{
  for(const p of [
    {NORMAL:{lower:.9,upper:.9}},
    {...direct,UNKNOWN:{lower:.9,upper:.9}},
    {...direct,NORMAL:{lower:.9,upper:.8}},
    {...direct,NORMAL:{lower:NaN,upper:1}},
    {...direct,NORMAL:{lower:0,upper:1,nominal:2}},
  ])assert.throws(()=>evaluateScenarioUncertainty({states,successByState:p}));
});
test('missing consent/authorization, cost and energy caps block research selection',()=>{
  const r=chooseRobustResearchPlan({states,candidates:[
    plan('a',diverse,{consentDeclared:false}),
    plan('b',direct,{linkAuthorizedDeclared:false}),
    plan('c',direct,{energyMj:101}),
  ],maxEnergyMj:100});
  assert.equal(r.selectedId,null);assert.equal(r.status,'NO_ELIGIBLE_SHADOW_PLAN');
  assert.ok(r.evaluations.every(x=>!x.eligibleInDeclaredModel));
});
test('no plan exceeds robust success threshold; fail closed',()=>{
  assert.equal(chooseRobustResearchPlan({states,candidates:[
    plan('a',direct),plan('b',diverse)],minRobustSuccess:.9}).selectedId,null);
});
test('no knowledge of scenario prevalence cannot grant positive reliability after unknown outage',()=>{
  const s=[{id:'NORMAL',lowerMass:0,upperMass:1,nominalMass:.5},
    {id:'FAILED',lowerMass:0,upperMass:1,nominalMass:.5}];
  const p={NORMAL:{lower:.99,upper:.99,nominal:.99},
    FAILED:{lower:0,upper:0,nominal:0}};
  const r=evaluateScenarioUncertainty({states:s,successByState:p});
  near(r.robustLower,0);near(r.robustUpper,.99);
  assert.equal(r.independentlyCalibrated,false);
});
test('tie-breaking deterministic and does not mutate inputs',()=>{
  const p=[plan('Z',diverse,{costEUR:6}),plan('B',diverse,{costEUR:2}),
    plan('A',diverse,{costEUR:2,energyMj:10})];
  const original=JSON.stringify({states,p});
  const r=chooseRobustResearchPlan({states,candidates:p});
  assert.equal(r.selectedId,'A');
  assert.equal(chooseRobustResearchPlan({states,candidates:[...p].reverse()}).selectedId,'A');
  assert.equal(JSON.stringify({states,p}),original);
});
test('3-scenario exact LP agrees with exhaustive 0.05-grid feasible simplex',()=>{
  const ss=[{id:'A',lowerMass:.1,upperMass:.6,nominalMass:.3},
    {id:'B',lowerMass:.15,upperMass:.6,nominalMass:.4},
    {id:'C',lowerMass:.1,upperMass:.65,nominalMass:.3}];
  const ps={A:{lower:.9,upper:.9,nominal:.9},B:{lower:.55,upper:.55,nominal:.55},
    C:{lower:.1,upper:.1,nominal:.1}};
  const r=evaluateScenarioUncertainty({states:ss,successByState:ps});
  let min=Infinity,max=-Infinity;
  for(let a=0;a<=20;a++)for(let b=0;b<=20-a;b++){
    const q=[a/20,b/20,(20-a-b)/20];
    if(ss.some((s,i)=>q[i]<s.lowerMass-1e-9||q[i]>s.upperMass+1e-9))continue;
    const x=q[0]*.9+q[1]*.55+q[2]*.1;
    min=Math.min(min,x);max=Math.max(max,x);
  }
  near(r.robustLower,min);near(r.robustUpper,max);
});
test('100 randomized distributions: worst/best adversarial weights obey all constraints',()=>{
  let seed=2077;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let n=0;n<100;n++){
    const u=[rand()+.01,rand()+.01,rand()+.01],sum=u.reduce((a,b)=>a+b,0);
    const ss=u.map((x,i)=>{const m=x/sum;return {id:'S'+i,nominalMass:m,
      lowerMass:.3*m,upperMass:Math.min(1,m+.5)};});
    const successByState=Object.fromEntries(ss.map(s=>[s.id,{lower:rand(),upper:1}]));
    const r=evaluateScenarioUncertainty({states:ss,successByState});
    assert.ok(r.robustLower<=r.robustUpper+1e-9);
    for(const mass of [r.worstCaseScenarioMass,r.bestCaseScenarioMass]){
      near(Object.values(mass).reduce((a,b)=>a+b,0),1);
      for(const s of ss)assert.ok(mass[s.id]>=s.lowerMass-1e-9&&mass[s.id]<=s.upperMass+1e-9);
    }
  }
});

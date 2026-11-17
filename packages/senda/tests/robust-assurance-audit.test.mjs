import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAssuranceAgainstUncertainHazards} from '../src/robust-assurance-audit.mjs';
import {DEFAULT_HAZARDS} from '../src/delivery-assurance.mjs';

const states=[
  {id:'NORMAL',lowerMass:.4,upperMass:.95,nominalMass:.95,hazard:DEFAULT_HAZARDS.NORMAL},
  {id:'GRID_DOWN',lowerMass:.05,upperMass:.6,nominalMass:.05,hazard:DEFAULT_HAZARDS.GRID_DOWN},
];
const plans=[
  {id:'cell_only',k:1,groups:[{id:'CELL_DATA',p:.98,shards:1}],consentDeclared:true,
    linkAuthorizedDeclared:true,costEUR:0,energyMj:10},
  {id:'dual_family',k:1,groups:[{id:'PHONE_MESH',p:.72,shards:1},
    {id:'IRIDIUM_SBD',p:.72,shards:1}],consentDeclared:true,
    linkAuthorizedDeclared:true,costEUR:1,energyMj:40},
];

test('bridges existing common-cause engine, not a duplicated reliability formula',()=>{
  const r=auditAssuranceAgainstUncertainHazards({states,plans});
  assert.equal(r.upstreamModel,'delivery-assurance.mjs/correlatedDeliveryProbability');
  assert.equal(r.upstreamConditionalIndependenceAssumed,true);
  assert.equal(r.statisticalCalibrationClaim,false);
  assert.equal(r.physicalHardwareValidated,false);
  assert.equal(r.operationallyAuthorized,false);
  const a=r.evaluations.find(x=>x.id==='cell_only');
  const b=r.evaluations.find(x=>x.id==='dual_family');
  assert.ok(a.nominalConditional>b.nominalConditional,'nominal favors single cell');
  assert.ok(a.robustLower<b.robustLower,'adversarial outage favors independent families');
  assert.equal(r.selectedId,'dual_family');
});
test('robustness requirement cannot promise a non-available path',()=>{
  const r=auditAssuranceAgainstUncertainHazards({states,plans,minRobustSuccess:.995});
  assert.equal(r.selectedId,null);
  assert.equal(r.status,'NO_ELIGIBLE_SHADOW_PLAN');
  assert.equal(r.mayClaimRealEmergencyReliability,false);
});
test('unconfirmed bearer authorization blocks both candidate model plans',()=>{
  const r=auditAssuranceAgainstUncertainHazards({
    states,plans:plans.map(p=>({...p,linkAuthorizedDeclared:false}))});
  assert.equal(r.selectedId,null);
});
test('unphysical hazard factors and fake bearer data fail closed',()=>{
  assert.throws(()=>auditAssuranceAgainstUncertainHazards({states:[
    {...states[0],hazard:{family:{TERRESTRIAL:1.2}}},states[1]],plans}));
  assert.throws(()=>auditAssuranceAgainstUncertainHazards({states:[
    {...states[0],hazard:{family:{},rainMmH:-1}},states[1]],plans}));
  assert.throws(()=>auditAssuranceAgainstUncertainHazards({states,plans:[{...plans[0],k:4}]}));
  assert.throws(()=>auditAssuranceAgainstUncertainHazards({states,plans:[{...plans[0],
    groups:[{id:'NOT_A_REAL_BEARER',p:.5,shards:1}]}]}));
  assert.throws(()=>auditAssuranceAgainstUncertainHazards({states,plans:[{...plans[0],
    groups:[{id:'CELL_DATA',p:NaN,shards:1}]}]}));
});
test('synthetic Monte Carlo: correlated worst-case common-power outage matches fixed hazard model',()=>{
  const r=auditAssuranceAgainstUncertainHazards({states,plans});
  const lower=r.evaluations.find(x=>x.id==='dual_family').robustLower;
  const normal=1-(1-.72)*(1-.72);
  const outage=1-(1-.72*.85)*(1-.72);
  const expected=.4*normal+.6*outage;
  assert.ok(Math.abs(lower-expected)<1e-12,String(lower)+' vs '+String(expected));
  let seed=20261117;
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const N=120000;let success=0;
  for(let i=0;i<N;i++){
    const gridDown=rng()<.6;
    const phone=rng()<(gridDown?.72*.85:.72);
    const satellite=rng()<.72;
    if(phone||satellite)success++;
  }
  const measured=success/N;
  assert.ok(Math.abs(measured-expected)<.006,String(measured)+' vs '+String(expected));
});

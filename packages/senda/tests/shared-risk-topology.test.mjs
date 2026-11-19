import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSharedRiskTopology} from '../src/shared-risk-topology.mjs';

const links=[
 {id:'cell-link',riskDomains:['grid-main','tower-07','backhaul-01']},
 {id:'sms-link',riskDomains:['grid-main','tower-07','backhaul-01']},
 {id:'lora-link',riskDomains:['gateway-02','grid-spare']},
 {id:'sat-link',riskDomains:['sat-terminal-batt','sat-operator']},
 {id:'ble-link',riskDomains:['phone-batt']},
];
const path=(id,linkIds,costEUR=1,extra={})=>({
 id,linkIds,costEUR,energyMj:100,consentDeclared:true,linkAuthorizedDeclared:true,...extra
});
test('H13: technologically different cellular and SMS share mast, electricity and backhaul',()=>{
 const r=analyzeSharedRiskTopology({links,paths:[
  path('CELL_ROUTE',['cell-link']),path('SMS_ROUTE',['sms-link'])]});
 const a=r.pairs[0];
 assert.equal(a.linkDisjoint,true);
 assert.equal(a.declaredSrlgDisjoint,false);
 assert.ok(a.sharedDeclaredRisks.includes('SRLG:grid-main'));
 assert.ok(a.sharedDeclaredRisks.includes('SRLG:tower-07'));
 assert.equal(r.selectedPathIds,null);
 assert.equal(r.mayMultiplyReliabilities,false);
});
test('H13: independent declared domains yield research pair, never proven physical independence',()=>{
 const r=analyzeSharedRiskTopology({links,paths:[
  path('CELL_ROUTE',['cell-link']),path('SAT_ROUTE',['sat-link'])]});
 assert.deepEqual(r.selectedPathIds,['CELL_ROUTE','SAT_ROUTE']);
 assert.equal(r.status,'DECLARED_DISJOINT_RESEARCH_PAIR');
 assert.equal(r.pairs[0].physicalIndependenceValidated,false);
 assert.equal(r.linkPermissionsVerified,false);
 assert.equal(r.mayTransmit,false);
});
test('H13: even one missing risk inventory is a universal shared risk wildcard',()=>{
 const missing={id:'unknown-link',riskDomains:[]};
 const r=analyzeSharedRiskTopology({links:[...links,missing],paths:[
  path('KNOWN',['sat-link']),path('UNKNOWN',['unknown-link'])]});
 assert.equal(r.selectedPathIds,null);
 assert.deepEqual(r.incompleteTopologyPaths,['UNKNOWN']);
 assert.ok(r.pairs[0].sharedDeclaredRisks.includes('UNKNOWN_TOPOLOGY'));
 assert.equal(r.pairs[0].declaredSrlgDisjoint,false);
});
test('H13: shared link ID is always shared risk even if riskDomains differ',()=>{
 const r=analyzeSharedRiskTopology({links,paths:[
  path('R_ONE',['cell-link','ble-link']),
  path('R_TWO',['cell-link','lora-link'])]});
 assert.ok(r.pairs[0].sharedDeclaredRisks.includes('LINK:cell-link'));
 assert.equal(r.pairs[0].linkDisjoint,false);
});
test('H13: declared authorization and consent both mandatory, even for disjoint topology',()=>{
 const r=analyzeSharedRiskTopology({links,paths:[
  path('ONE',['cell-link'],1,{consentDeclared:false}),
  path('TWO',['sat-link'],1)]});
 assert.equal(r.selectedPathIds,null);
 assert.equal(r.pairs[0].candidateEligible,false);
});
test('H13: energy and economic caps block model candidate without fake deployment',()=>{
 const r=analyzeSharedRiskTopology({links,paths:[
  path('ONE',['cell-link'],100),
  path('TWO',['sat-link'],200)],maxPairCostEUR:299});
 assert.equal(r.selectedPathIds,null);
 assert.equal(r.status,'NO_VERIFIABLE_DISJOINT_PAIR');
});
test('H13: deterministic lowest-cost disjoint pair, insensitive to input ordering',()=>{
 const p=[path('CELL',['cell-link'],2),path('SAT',['sat-link'],1),
  path('LORA',['lora-link'],1)];
 const a=analyzeSharedRiskTopology({links,paths:p});
 const b=analyzeSharedRiskTopology({links,paths:[...p].reverse()});
 assert.deepEqual(a.selectedPathIds,b.selectedPathIds);
 assert.deepEqual(a.selectedPathIds,['LORA','SAT']);
});
test('H13: duplicate IDs and invalid topology metadata fail closed',()=>{
 assert.throws(()=>analyzeSharedRiskTopology({links:[links[0],links[0]],paths:[
   path('ONE',['cell-link']),path('TWO',['cell-link'])]}),/duplicate/);
 assert.throws(()=>analyzeSharedRiskTopology({links,paths:[
   path('ONE',['cell-link']),path('TWO',['unknown-link'])]}),/unknown link/);
 assert.throws(()=>analyzeSharedRiskTopology({links,paths:[
   path('ONE',['cell-link','cell-link']),path('TWO',['sat-link'])]}),/duplicated/);
 assert.throws(()=>analyzeSharedRiskTopology({links:[
   {...links[0],riskDomains:['grid-main','grid-main']},...links.slice(1)
 ],paths:[path('ONE',['cell-link']),path('TWO',['sat-link'])]}),/risk domains/);
});
test('H13: 100 synthetic risk-pairs never mark shared resources as structurally disjoint',()=>{
 let seed=1317;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let i=0;i<100;i++){
  const r1='resource-'+Math.floor(rng()*10);
  const r2=rng()<.7?r1:'resource-other-'+i;
  const ls=[{id:'link-AA',riskDomains:[r1]},{id:'link-BB',riskDomains:[r2]}];
  const r=analyzeSharedRiskTopology({links:ls,
    paths:[path('PATH_A',['link-AA']),path('PATH_B',['link-BB'])]});
  if(r1===r2){assert.equal(r.selectedPathIds,null);
    assert.equal(r.pairs[0].declaredSrlgDisjoint,false);}
  assert.equal(r.pairs[0].successEventsIndependentValidated,false);
 }
});

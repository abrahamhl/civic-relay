import test from 'node:test';
import assert from 'node:assert/strict';
import {enumerateDeclaredFailureCuts as audit} from '../src/failure-domain-cuts.mjs';

const link=(id,riskDomains)=>({id,riskDomains});
const path=(id,linkIds,endpointRiskDomains,more={})=>({
  id,linkIds,endpointRiskDomains,
  consentDeclared:true,linkAuthorizedDeclared:true,...more
});
const risk=(r,...names)=>r.singleDomainCuts.some(
  c=>c.failedDomains.some(x=>names.includes(x))
);

test('H15: cellular and SMS that share mast/power suffer single-domain cut',()=>{
 const a=audit({links:[link('LTE',['TOWER-9','GRID-A']),
   link('SMS',['TOWER-9','GRID-A'])],paths:[
   path('LTE-PATH',['LTE'],['PHONE-BATTERY']),
   path('SMS-PATH',['SMS'],['PHONE-BATTERY'])]});
 assert.equal(a.declaredN1Resilience,false);
 assert.equal(a.smallestObservedCutSize,1);
 assert.ok(risk(a,'SRLG:GRID-A'));
 assert.ok(risk(a,'SRLG:TOWER-9'));
 assert.ok(risk(a,'SRLG:PHONE-BATTERY'));
 assert.equal(a.mayOperateEmergencyInfrastructure,false);
});
test('H15: shared handset battery is a cut even for unrelated radio bearers',()=>{
 const r=audit({links:[link('meshl',['MESH-GW']),link('satl',['SAT-OP'])],
   paths:[path('M',['meshl'],['PHONE-BATT']),path('S',['satl'],['PHONE-BATT'])]});
 assert.ok(r.singleDomainCuts.some(c=>c.failedDomains[0]==='SRLG:PHONE-BATT'));
 assert.equal(r.declaredN1Resilience,false);
});
test('H15: a link and a device sharing the same source must be one cross-layer SRLG',()=>{
 const r=audit({links:[link('cell',['GRID-X']),link('sat',['SAT-NET'])],
   paths:[path('CELL',['cell'],['HANDSET-1']),path('SAT',['sat'],['GRID-X'])]});
 assert.ok(r.singleDomainCuts.some(c=>c.failedDomains[0]==='SRLG:GRID-X'));
 assert.equal(r.declaredN1Resilience,false);
});
test('H15: two truly disjoint modeled paths survive any single failure, not any two',()=>{
 const r=audit({links:[link('L1',['P1']),link('L2',['P2'])],
   paths:[path('A',['L1'],['D1']),path('B',['L2'],['D2'])]});
 assert.equal(r.declaredTopologyComplete,true);
 assert.equal(r.declaredN1Resilience,true);
 assert.equal(r.declaredN2Resilience,false);
 assert.equal(r.singleDomainCuts.length,0);
 assert.ok(r.doubleDomainCuts.length>0);
 assert.equal(r.smallestObservedCutSize,2);
});
test('H15: three fully independent declared paths survive two distinct domain failures',()=>{
 const r=audit({links:[link('L1',['P1']),link('L2',['P2']),link('L3',['P3'])],
   paths:[path('A',['L1'],['D1']),path('B',['L2'],['D2']),path('C',['L3'],['D3'])]});
 assert.equal(r.declaredN1Resilience,true);
 assert.equal(r.declaredN2Resilience,true);
 assert.equal(r.singleDomainCuts.length,0);
 assert.equal(r.doubleDomainCuts.length,0);
 assert.equal(r.topologyEvidenceVerified,false);
 assert.equal(r.publicNetworkAuthorizationVerified,false);
});
test('H15: demanding at least two viable paths changes N-2 result',()=>{
 const r=audit({links:[link('L1',['P1']),link('L2',['P2']),link('L3',['P3'])],
   paths:[path('A',['L1'],['D1']),path('B',['L2'],['D2']),path('C',['L3'],['D3'])],
   requiredSurvivingPaths:2});
 assert.equal(r.declaredN1Resilience,true);
 assert.equal(r.declaredN2Resilience,false);
 assert.equal(r.singleDomainCuts.length,0);
});
test('H15: missing physical topology is a universal worst-case wildcard, never proof of independent paths',()=>{
 const r=audit({links:[link('cell',[]),link('sat',['SPACE'])],
   paths:[path('C',['cell'],['C1']),path('S',['sat'],['S1'])]});
 assert.equal(r.status,'INCOMPLETE_PHYSICAL_DEPENDENCY_INVENTORY');
 assert.equal(r.declaredTopologyComplete,false);
 assert.equal(r.declaredN1Resilience,false);
 assert.ok(r.singleDomainCuts.some(x=>x.failedDomains.includes('UNKNOWN_TOPOLOGY')));
 const second=audit({links:[link('cell',['GRID']),link('sat',['SPACE'])],
   paths:[path('C',['cell'],[]),path('S',['sat'],['S1'])]});
 assert.equal(second.declaredN1Resilience,false);
 assert.ok(second.singleDomainCuts.some(x=>x.failedDomains.includes('UNKNOWN_TOPOLOGY')));
});
test('H15: no trust or consent excludes a path before claiming any failure tolerance',()=>{
 const r=audit({links:[link('cell',['GRID']),link('sat',['SPACE'])],
   paths:[path('C',['cell'],['PHONE']),path('S',['sat'],['OTHER'],{linkAuthorizedDeclared:false})]});
 assert.equal(r.eligiblePathCount,1);
 assert.deepEqual(r.excludedPathIds,['S']);
 assert.equal(r.declaredN1Resilience,false);
});
test('H15: deterministic labels under permuted input',()=>{
 const links=[link('z',['GRID']),link('a',['SAT'])];
 const paths=[path('P2',['a'],['NODE2']),path('P1',['z'],['NODE1'])];
 const a=audit({links,paths}),b=audit({links:[...links].reverse(),paths:[...paths].reverse()});
 assert.deepEqual(a.singleDomainCuts,b.singleDomainCuts);
 assert.deepEqual(a.doubleDomainCuts,b.doubleDomainCuts);
 assert.deepEqual(a.pathRiskTable,b.pathRiskTable);
});
test('H15: invalid budgets, unknown links, duplicate domain metadata or oversized risk taxonomy fail closed',()=>{
 const two=[link('a',['GRID']),link('b',['SAT'])],ps=[path('A',['a'],['P1']),path('B',['b'],['P2'])];
 assert.throws(()=>audit({links:two,paths:ps,maxSimultaneousFailures:3}));
 assert.throws(()=>audit({links:two,paths:ps,requiredSurvivingPaths:0}));
 assert.throws(()=>audit({links:two,paths:[ps[0],path('B',['wrong'],['P2'])]}));
 assert.throws(()=>audit({links:[link('a',['GRID','GRID']),link('b',['SAT'])],paths:ps}));
 assert.throws(()=>audit({links:two,paths:[ps[0],path('B',['b'],['P2','P2'])]}));
 const huge=Array.from({length:4},(_,i)=>link('L'+i,
   Array.from({length:20},(_,j)=>'GR'+i+'-'+j)));
 const q=huge.map((l,i)=>path('P'+i,[l.id],['EP'+i]));
 assert.throws(()=>audit({links:huge,paths:q}),/too many risk domains/);
});
test('H15: 100 deterministic random topologies exactly match independent brute-force failure enumeration',()=>{
 let seed=15017;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let trial=0;trial<100;trial++){
  const n=2+Math.floor(rng()*5);
  const links=Array.from({length:n},(_,i)=>link('L'+i,
    ['G'+Math.floor(rng()*4)]));
  const paths=links.map((l,i)=>path('P'+i,[l.id],
    ['END'+Math.floor(rng()*5)]));
  const required=1+Math.floor(rng()*n);
  const result=audit({links,paths,requiredSurvivingPaths:required});
  const domainByPath=paths.map((p,i)=>new Set([
    'LINK:'+p.linkIds[0],
    'SRLG:'+links[i].riskDomains[0],
    'SRLG:'+p.endpointRiskDomains[0]
  ]));
  const catalog=[...new Set(domainByPath.flatMap(s=>[...s]))].sort();
  const oracle=(failed)=>{
    const alive=domainByPath.filter(s=>failed.every(d=>!s.has(d))).length;
    return alive<required;
  };
  const single=catalog.filter(x=>oracle([x]));
  const pairs=[];
  for(let i=0;i<catalog.length;i++)for(let j=i+1;j<catalog.length;j++)
    if(oracle([catalog[i],catalog[j]]))pairs.push([catalog[i],catalog[j]]);
  assert.deepEqual(result.singleDomainCuts.map(c=>c.failedDomains[0]),single);
  assert.deepEqual(result.doubleDomainCuts.map(c=>c.failedDomains),pairs);
  assert.equal(result.declaredN1Resilience,single.length===0);
  assert.equal(result.declaredN2Resilience,single.length===0&&pairs.length===0);
 }
});

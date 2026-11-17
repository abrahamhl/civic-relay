import test from 'node:test';
import assert from 'node:assert/strict';
import {auditCrossLayerSurvivability as audit} from '../src/cross-layer-survivability.mjs';
import {DEFAULT_HAZARDS} from '../src/delivery-assurance.mjs';
import {buildAnytimeIncidentFrequencyEnvelope} from '../src/anytime-scenario-confidence.mjs';
import {attachConservativeResearchHazards} from '../src/scenario-frequency-evidence.mjs';

const links=[
  {id:'LTE-LINK',riskDomains:['GRID-C','TOWER-C']},
  {id:'SAT-LINK',riskDomains:['SAT-OP']},
  {id:'MESH-LINK',riskDomains:['MESH-BATT']},
];
const paths=[
  {id:'LTE-PATH',linkIds:['LTE-LINK'],endpointRiskDomains:['PHONE-LTE'],consentDeclared:true,linkAuthorizedDeclared:true},
  {id:'SAT-PATH',linkIds:['SAT-LINK'],endpointRiskDomains:['PHONE-SAT'],consentDeclared:true,linkAuthorizedDeclared:true},
  {id:'MESH-PATH',linkIds:['MESH-LINK'],endpointRiskDomains:['PHONE-MESH'],consentDeclared:true,linkAuthorizedDeclared:true},
];
const states=[
  {id:'NORMAL',nominalMass:.9,lowerMass:.6,upperMass:.95,hazard:DEFAULT_HAZARDS.NORMAL},
  {id:'GRID_DOWN',nominalMass:.1,lowerMass:.05,upperMass:.4,hazard:DEFAULT_HAZARDS.GRID_DOWN},
];
const mk=(id,k,groups)=>({
 id,k,groups,costEUR:1,energyMj:50,consentDeclared:true,linkAuthorizedDeclared:true
});
const a=mk('all-shards',2,[{id:'CELL_DATA',shards:1,p:.98},{id:'IRIDIUM_SBD',shards:1,p:.98}]);
const b=mk('either-shard',1,[{id:'CELL_DATA',shards:1,p:.8},{id:'IRIDIUM_SBD',shards:1,p:.8}]);
const c=mk('three-radio',1,[{id:'CELL_DATA',shards:1,p:.75},{id:'IRIDIUM_SBD',shards:1,p:.75},
  {id:'PHONE_MESH',shards:1,p:.75}]);
const options=()=>({
 states,links,paths,
 plans:[a,b],
 groupPathBindings:{
  'all-shards':['LTE-PATH','SAT-PATH'],
  'either-shard':['LTE-PATH','SAT-PATH']
 }
});

test('H16: a surviving physical route cannot reconstruct a 2-of-2 missing shard',()=>{
 const r=audit(options());
 const A=r.candidates.find(x=>x.id==='all-shards');
 const B=r.candidates.find(x=>x.id==='either-shard');
 assert.equal(A.declaredN1ShardReconstruction,false);
 assert.equal(A.structurallyEligibleInDeclaredModel,false);
 assert.equal(A.minimumShardsAfterSingleDomain,1);
 assert.equal(B.declaredN1ShardReconstruction,true);
 assert.equal(B.minimumShardsAfterSingleDomain,1);
 assert.equal(r.selectedId,'either-shard');
 assert.equal(r.mayOperateEmergencyInfrastructure,false);
 assert.equal(r.noCommandEmission,true);
});
test('H16: two 1-of-2 paths are N-1 but not N-2 under finite declared physics',()=>{
 const r=audit({...options(),plans:[b],
  groupPathBindings:{'either-shard':['LTE-PATH','SAT-PATH']},requiredSurvivalOrder:2});
 assert.equal(r.candidates[0].declaredN1ShardReconstruction,true);
 assert.equal(r.candidates[0].declaredN2ShardReconstruction,false);
 assert.equal(r.selectedId,null);
 assert.ok(r.candidates[0].twoDomainCutCount>0);
});
test('H16: three 1-of-3 fully disjoint declared paths can withstand two declared failures',()=>{
 const r=audit({...options(),plans:[c],
   groupPathBindings:{'three-radio':['LTE-PATH','SAT-PATH','MESH-PATH']},
   requiredSurvivalOrder:2});
 assert.equal(r.candidates[0].declaredN1ShardReconstruction,true);
 assert.equal(r.candidates[0].declaredN2ShardReconstruction,true);
 assert.equal(r.selectedId,'three-radio');
 assert.equal(r.physicalTestingCompleted,false);
 assert.equal(r.institutionallyAuthenticated,false);
});
test('H16: duplicated fragments routed via one physical gateway are not independent',()=>{
 const r=audit({...options(),plans:[b],
  groupPathBindings:{'either-shard':['LTE-PATH','LTE-PATH']}});
 assert.equal(r.candidates[0].declaredN1ShardReconstruction,false);
 assert.equal(r.selectedId,null);
 assert.ok(r.candidates[0].oneDomainCutCount>0);
});
test('H16: unidentified endpoint or radio dependency quarantines all candidate selections',()=>{
 const badPaths=paths.map(x=>x.id==='SAT-PATH'?{...x,endpointRiskDomains:[]}:x);
 const r=audit({...options(),plans:[b],paths:badPaths,
  groupPathBindings:{'either-shard':['LTE-PATH','SAT-PATH']}});
 assert.equal(r.topologySummary.declaredTopologyComplete,false);
 assert.equal(r.unknownTopologyQuarantined,true);
 assert.equal(r.selectedId,null);
});
test('H16: fabricated permission declarations never confer verified institutional authority',()=>{
 const badPaths=paths.map(x=>x.id==='SAT-PATH'?{...x,linkAuthorizedDeclared:false}:x);
 const r=audit({...options(),plans:[b],paths:badPaths,
  groupPathBindings:{'either-shard':['LTE-PATH','SAT-PATH']}});
 assert.equal(r.candidates[0].structurallyEligibleInDeclaredModel,false);
 assert.equal(r.selectedId,null);
 assert.equal(r.mayOperateEmergencyInfrastructure,false);
});
test('H16: unknown paths, missing positional bindings and forged plan IDs fail closed',()=>{
 assert.throws(()=>audit({...options(),groupPathBindings:{'all-shards':['LTE-PATH','SAT-PATH']}}));
 assert.throws(()=>audit({...options(),groupPathBindings:{
  'all-shards':['LTE-PATH','SAT-PATH'],
  'either-shard':['LTE-PATH','NO_SUCH_PATH']
 }}));
 assert.throws(()=>audit({...options(),requiredSurvivalOrder:3}));
 assert.throws(()=>audit({...options(),plans:[{...a,id:'__proto__'}],
  groupPathBindings:{__proto__:['LTE-PATH','SAT-PATH']}}));
});
test('H16: probabilistic robust threshold is a separate mandatory gate from topology',()=>{
 const r=audit({...options(),plans:[b],groupPathBindings:{
  'either-shard':['LTE-PATH','SAT-PATH']
 },minRobustSuccess:.99});
 assert.equal(r.candidates[0].declaredN1ShardReconstruction,true);
 assert.equal(r.candidates[0].probabilisticallyEligibleInDeclaredModel,false);
 assert.equal(r.selectedId,null);
});
test('H16: H14 IID-sampling confidence sequences -> UNKNOWN -> H11 -> H15 shard survival',()=>{
 const ids=['NORMAL','GRID_DOWN','UNKNOWN'];
 const obs=Array.from({length:100},(_,i)=>({
  incidentKey:'INC-'+i,independentBlockId:'CAUSAL-'+i,
  scenarioId:i<80?'NORMAL':'GRID_DOWN',
  sourceId:'SYNTHETIC-NO-RF',evidenceSha256:'f'.repeat(64)
 }));
 const env=buildAnytimeIncidentFrequencyEnvelope({incidents:obs,scenarioIds:ids});
 const wrapped=attachConservativeResearchHazards(env,{
  NORMAL:DEFAULT_HAZARDS.NORMAL,
  GRID_DOWN:DEFAULT_HAZARDS.GRID_DOWN
 });
 const r=audit({...options(),states:wrapped.states,plans:[b],
   groupPathBindings:{'either-shard':['LTE-PATH','SAT-PATH']}});
 assert.equal(r.selectedId,'either-shard');
 assert.equal(env.unknownUpperMass>0,true);
 assert.equal(r.noPhysicalSuccessProbabilityGuaranteed,true);
 assert.equal(r.institutionallyAuthenticated,false);
});
test('H16: canonical input order never changes the declared N-1/N-2 verdict',()=>{
 const opts={...options(),plans:[c],requiredSurvivalOrder:2,
 groupPathBindings:{'three-radio':['LTE-PATH','SAT-PATH','MESH-PATH']}};
 const x=audit(opts),y=audit({...opts,
  links:[...links].reverse(),paths:[...paths].reverse()});
 assert.equal(x.selectedId,y.selectedId);
 assert.deepEqual(x.candidates[0].minimalReconstructionCut,y.candidates[0].minimalReconstructionCut);
});

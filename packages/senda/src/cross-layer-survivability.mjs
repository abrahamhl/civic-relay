/**
 * SENDA H16: cross-layer k-of-n structural resilience + robust probabilities.
 *
 * This COMPOSES existing engines, not a parallel routing stack:
 * H15 enumerates declared SRLG topology, H11 evaluates robust probabilistic
 * shard delivery with no independent retransmission assumption.
 *
 * A bearer group carries 'shards' via a specifically declared path. Failure
 * of any SRLG on that path removes all its shards. Reconstructing k shards
 * then requires sum(shards on surviving paths)>=k. This closes a subtle
 * modeling gap: "one route survives" is NOT enough for k-of-n coding.
 *
 * Link/path descriptions are unverified research declarations. No transport
 * activation, certification or operator authorization arises from this API.
 */
import {enumerateDeclaredFailureCuts} from './failure-domain-cuts.mjs';
import {auditAssuranceAgainstUncertainHazards} from './robust-assurance-audit.mjs';

const ID=/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/;
const validId=x=>typeof x==='string'&&ID.test(x);
const max2=(domains)=>{
  const out=[];
  for(let i=0;i<domains.length;i++)for(let j=i+1;j<domains.length;j++)
    out.push([domains[i],domains[j]]);
  return out;
};
const evaluateOutage=(groupPaths,groups,cut,k)=>{
  const failed=new Set(cut);
  const survivingShards=groups.reduce((s,g,i)=>
    s+(groupPaths[i].domains.some(d=>failed.has(d))?0:g.shards),0);
  return {failedDomains:[...cut],survivingShards,reconstructionPossible:survivingShards>=k};
};
/**
 * @param {object} arg
 * @param {Record<string,string[]>} arg.groupPathBindings
 *   planId -> pathId for EVERY positional group. Explicit positional binding
 *   avoids quietly assuming bearerId === physical path or gateway.
 */
export function auditCrossLayerSurvivability({
  states,plans,links,paths,groupPathBindings,
  requiredSurvivalOrder=1,minRobustSuccess=0,
  maxCostEUR=1000000,maxEnergyMj=1000000000
}={}){
  if(![1,2].includes(requiredSurvivalOrder))
    throw new RangeError('requiredSurvivalOrder must be 1 or 2');
  if(!Array.isArray(plans)||!plans.length||plans.length>100||
    !groupPathBindings||typeof groupPathBindings!=='object'||
    Array.isArray(groupPathBindings))
    throw new TypeError('plans and positional path bindings required');
  const ids=new Set(plans.map(p=>p?.id));
  if(ids.size!==plans.length||[...ids].some(x=>!validId(x))||
    Object.keys(groupPathBindings).length!==plans.length)
    throw new TypeError('exact unique plan bindings required');
  const topo=enumerateDeclaredFailureCuts({
    links,paths,requiredSurvivingPaths:1,maxSimultaneousFailures:2
  });
  const modeled=auditAssuranceAgainstUncertainHazards({
    states,plans,minRobustSuccess,maxCostEUR,maxEnergyMj
  });
  const pathMap=new Map(topo.pathRiskTable.map(p=>[p.id,p]));
  const candidates=[];
  for(const p of plans){
    if(!Object.prototype.hasOwnProperty.call(groupPathBindings,p.id)||
       !Array.isArray(groupPathBindings[p.id])||
       groupPathBindings[p.id].length!==p.groups.length)
       throw new TypeError('one explicitly bound physical path per shard group is required: '+p.id);
    const bound=groupPathBindings[p.id];
    if(bound.some(x=>!pathMap.has(x)))
      throw new RangeError('unknown bound physical path for plan '+p.id);
    const pathProfiles=bound.map(x=>pathMap.get(x));
    const riskDomains=[...new Set(pathProfiles.flatMap(x=>x.domains))].sort();
    if(riskDomains.length>64)throw new RangeError('unbounded plan risk domains');
    const single=riskDomains.map(d=>evaluateOutage(pathProfiles,p.groups,[d],p.k));
    const double=requiredSurvivalOrder===2?
      max2(riskDomains).map(d=>evaluateOutage(pathProfiles,p.groups,d,p.k)):[];
    const badSingle=single.filter(x=>!x.reconstructionPossible);
    const badDouble=double.filter(x=>!x.reconstructionPossible);
    const pathAuthorityDeclared=pathProfiles.every(x=>x.allowedByDeclaredPermissions);
    const n1=topo.declaredTopologyComplete&&pathAuthorityDeclared&&badSingle.length===0;
    const n2=n1&&requiredSurvivalOrder===2&&badDouble.length===0;
    const modelResult=modeled.evaluations.find(x=>x.id===p.id);
    const robustnessPassed=requiredSurvivalOrder===1?n1:n2;
    const robustProbabilityPassed=modelResult?.eligibleInDeclaredModel===true&&
      modelResult.robustLower>=minRobustSuccess;
    candidates.push({
      id:p.id,groupPathIds:[...bound],k:p.k,
      totalDeclaredShards:p.groups.reduce((a,g)=>a+g.shards,0),
      declaredN1ShardReconstruction:n1,
      declaredN2ShardReconstruction:requiredSurvivalOrder===2?n2:null,
      oneDomainCutCount:badSingle.length,
      twoDomainCutCount:badDouble.length,
      minimalReconstructionCut:badSingle[0]??badDouble[0]??null,
      minimumShardsAfterSingleDomain:single.length?
        Math.min(...single.map(x=>x.survivingShards)):p.groups.reduce((a,g)=>a+g.shards,0),
      minimumShardsAfterDoubleDomain:requiredSurvivalOrder===2?
        (double.length?Math.min(...double.map(x=>x.survivingShards)):
         p.groups.reduce((a,g)=>a+g.shards,0)):null,
      robustLower:modelResult?.robustLower??null,
      robustUpper:modelResult?.robustUpper??null,
      nominalConditional:modelResult?.nominalConditional??null,
      costEUR:modelResult?.costEUR??null,
      energyMj:modelResult?.energyMj??null,
      structurallyEligibleInDeclaredModel:robustnessPassed,
      probabilisticallyEligibleInDeclaredModel:robustProbabilityPassed,
      eligibleResearchCandidate:robustnessPassed&&robustProbabilityPassed,
      authorizationIndependentlyVerified:false
    });
  }
  const admissible=candidates.filter(x=>x.eligibleResearchCandidate)
    .sort((a,b)=>b.robustLower-a.robustLower||
      a.costEUR-b.costEUR||a.energyMj-b.energyMj||a.id.localeCompare(b.id));
  return {
    mode:'OFFLINE_SHADOW_CROSS_LAYER_RESEARCH',
    selectedId:admissible[0]?.id??null,
    upstreamRobustModelChoice:modeled.selectedId,
    requiredSurvivalOrder,
    candidates,
    topologySummary:{
      declaredTopologyComplete:topo.declaredTopologyComplete,
      physicalRiskDomainCount:topo.riskDomainCount,
      riskDomainsMissing:!topo.declaredTopologyComplete
    },
    groupsMaySharePhysicalPath:true,
    unknownTopologyQuarantined:!topo.declaredTopologyComplete,
    noPhysicalSuccessProbabilityGuaranteed:true,
    institutionallyAuthenticated:false,
    physicalTestingCompleted:false,
    mayOperateEmergencyInfrastructure:false,
    noCommandEmission:true
  };
}

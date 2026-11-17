/**
 * SENDA H15 — Enumerated common-cause failure-cut laboratory.
 *
 * Given a finite DECLARED inventory of links, shared-risk domains, and
 * endpoint/device domains, enumerate all one- and two-domain failures.
 * A path fails when ANY one of its declared domains fails. A route set
 * survives if at least requiredSurvivingPaths eligible paths remain.
 *
 * This is elementary finite set-cover / cut enumeration (NOT new maths).
 * If information is missing, an UNKNOWN_TOPOLOGY global hazard is included
 * in every route, thus blocking optimistic N-1/N-2 conclusions.
 *
 * Exact for the supplied domains and <=2 simultaneous failures; no real
 * availability, independence, coverage or operator permissions inferred.
 * See RFC 6414 §3.1.10 and RFC 8001 for SRLG provenance and limitations.
 */
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/;
const goodId=x=>typeof x==='string'&&ID.test(x);
const isBudget=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const MAX_DOMAINS=64,MAX_PATHS=40,MAX_LINKS=1024;
const assertDomains=(arr,label,max)=>{
  if(!Array.isArray(arr)||arr.length>max||arr.some(x=>!goodId(x))||
     new Set(arr).size!==arr.length)throw new TypeError('invalid or duplicate '+label);
};
const combos=(arr,k)=>{
  if(k===1)return arr.map(x=>[x]);
  const out=[];
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++)out.push([arr[i],arr[j]]);
  return out;
};

/**
 * @param {object} input
 * @param {Array<{id:string,riskDomains:string[]}>} input.links
 * @param {Array<{id:string,linkIds:string[],endpointRiskDomains:string[],
 *        consentDeclared:boolean,linkAuthorizedDeclared:boolean}>} input.paths
 * Endpoint domains MUST include all critical source, sink, relay and power
 * dependencies. A missing inventory is a common-risk wildcard.
 */
export function enumerateDeclaredFailureCuts({
  links,paths,requiredSurvivingPaths=1,maxSimultaneousFailures=2
}={}){
  if(!Array.isArray(links)||links.length<1||links.length>MAX_LINKS||
     !Array.isArray(paths)||paths.length<1||paths.length>MAX_PATHS||
     !Number.isSafeInteger(requiredSurvivingPaths)||
     requiredSurvivingPaths<1||requiredSurvivingPaths>MAX_PATHS||
     ![1,2].includes(maxSimultaneousFailures))
    throw new RangeError('invalid H15 topology or failure-budget input');

  const linkMap=new Map();
  let incomplete=false;
  for(const link of links){
    if(!link||!goodId(link.id)||linkMap.has(link.id))
      throw new TypeError('invalid/duplicate link');
    if(link.riskDomains==null){
      incomplete=true;
    }else assertDomains(link.riskDomains,'link risk domains',32);
    if(!link.riskDomains?.length)incomplete=true;
    linkMap.set(link.id,link);
  }
  const pathIds=new Set(),summaries=[];
  for(const p of paths){
    if(!p||!goodId(p.id)||pathIds.has(p.id))
      throw new TypeError('invalid/duplicate path');
    pathIds.add(p.id);
    assertDomains(p.linkIds,'path links',64);
    if(!p.linkIds.length)throw new RangeError('empty path');
    if(p.endpointRiskDomains==null)incomplete=true;
    else assertDomains(p.endpointRiskDomains,'path endpoint dependencies',32);
    if(!p.endpointRiskDomains?.length)incomplete=true;
    const domains=new Set();
    for(const linkId of p.linkIds){
      const link=linkMap.get(linkId);
      if(!link)throw new RangeError('unknown link '+linkId);
      domains.add('LINK:'+linkId);
      if(!link.riskDomains?.length)domains.add('UNKNOWN_TOPOLOGY');
      for(const d of link.riskDomains??[])domains.add('SRLG:'+d);
    }
    if(!p.endpointRiskDomains?.length)domains.add('UNKNOWN_TOPOLOGY');
    // Use the SAME SRLG namespace for link and endpoint failures: a common
    // power supply can affect both without the prefix hiding their overlap.
    for(const d of p.endpointRiskDomains??[])domains.add('SRLG:'+d);
    const allowed=p.consentDeclared===true&&p.linkAuthorizedDeclared===true;
    summaries.push({
      id:p.id,allowedByDeclaredPermissions:allowed,
      endpointMetadataPresent:!!p.endpointRiskDomains?.length,
      domains:[...domains].sort(),
      permissionEvidenceVerified:false
    });
  }
  // Every plan depends on the unobserved resource graph when any inventory
  // is incomplete. This is deliberate risk-conservative global quarantine.
  if(incomplete)for(const p of summaries)
    p.domains=[...new Set([...p.domains,'UNKNOWN_TOPOLOGY'])].sort();
  const eligible=summaries.filter(x=>x.allowedByDeclaredPermissions);
  const catalog=[...new Set(eligible.flatMap(p=>p.domains))].sort();
  if(catalog.length>MAX_DOMAINS)
    throw new RangeError('too many risk domains; split audited sample without claiming global N-2');

  const investigate=(set)=>{
    const failed=new Set(set);
    const surviving=eligible.filter(p=>!p.domains.some(d=>failed.has(d))).map(p=>p.id);
    return {
      failedDomains:[...set],
      survivingPaths:surviving.sort(),
      survivorCount:surviving.length,
      deliveryCut:surviving.length<requiredSurvivingPaths
    };
  };
  const failureSets=[];
  for(let k=1;k<=maxSimultaneousFailures;k++)
    for(const subset of combos(catalog,k))failureSets.push(investigate(subset));

  const singleCuts=failureSets.filter(x=>x.deliveryCut&&x.failedDomains.length===1);
  const doubleCuts=failureSets.filter(x=>x.deliveryCut&&x.failedDomains.length===2);
  const baselineEligible=eligible.length;
  const baselineSufficient=baselineEligible>=requiredSurvivingPaths;
  const n1=baselineSufficient&&!incomplete&&singleCuts.length===0;
  const n2=baselineSufficient&&!incomplete&&maxSimultaneousFailures===2&&
           singleCuts.length===0&&doubleCuts.length===0;
  const firstCut=singleCuts[0]??doubleCuts[0]??null;
  return {
    status:!baselineSufficient?'INSUFFICIENT_DECLARED_PATHS':
      incomplete?'INCOMPLETE_PHYSICAL_DEPENDENCY_INVENTORY':
      firstCut?'DECLARED_FAILURE_CUT_FOUND':'NO_CUT_WITHIN_ENUMERATED_BUDGET',
    mode:'SHADOW_TOPOLOGY_RESEARCH_ONLY',
    declaredTopologyComplete:!incomplete,
    eligiblePathCount:baselineEligible,
    excludedPathIds:summaries.filter(x=>!x.allowedByDeclaredPermissions).map(x=>x.id).sort(),
    requiredSurvivingPaths,
    maximumFailureCardinalityEnumerated:maxSimultaneousFailures,
    riskDomainCount:catalog.length,
    testedFailureSets:failureSets.length,
    smallestObservedCutSize:firstCut?.failedDomains.length??null,
    singleDomainCuts:singleCuts,
    doubleDomainCuts:doubleCuts,
    declaredN1Resilience:n1,
    declaredN2Resilience:n2,
    pathRiskTable:summaries.sort((a,b)=>a.id.localeCompare(b.id)),
    guaranteesOnlyDeclaredModel:true,
    unmodeledFailuresExcluded:false,
    radioMeasurementsVerified:false,
    topologyEvidenceVerified:false,
    publicNetworkAuthorizationVerified:false,
    mayOperateEmergencyInfrastructure:false,
  };
}

/**
 * SENDA H13 — SRLG (Shared Risk Link Group) provenance gate, SHADOW ONLY.
 * A route is not diverse simply because it uses a different radio technology.
 * Different links may depend on a common power supply, gateway, mast,
 * provider network, tunnel, software version, bridge or evacuation zone.
 *
 * It computes *DECLARED* structural overlap, never proves physical or
 * stochastic independence. Missing metadata is a universal wildcard risk,
 * NOT an independent empty set. Actual topology use requires permission.
 *
 * RFC 6414 sec. 3.1.10: https://www.rfc-editor.org/rfc/rfc6414.html
 */
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{1,127}$/;
const valid=x=>typeof x==='string'&&ID.test(x);
const finitePositive=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const MAX_LINKS=1024,MAX_PATHS=40,MAX_HOPS=64,MAX_RISK_PER_LINK=32;

export function analyzeSharedRiskTopology({links,paths,
  maxPairCostEUR=100000,maxPairEnergyMj=100000000}={}){
  if(!Array.isArray(links)||!links.length||links.length>MAX_LINKS||
    !Array.isArray(paths)||paths.length<2||paths.length>MAX_PATHS||
    !finitePositive(maxPairCostEUR)||!finitePositive(maxPairEnergyMj))
    throw new RangeError('invalid SRLG research topology size or budgets');
  const byLink=new Map();
  for(const l of links){
    if(!l||!valid(l.id)||byLink.has(l.id))throw new TypeError('duplicate or invalid link ID');
    if(l.riskDomains!=null&&(!Array.isArray(l.riskDomains)||
      l.riskDomains.length>MAX_RISK_PER_LINK||
      l.riskDomains.some(x=>!valid(x))||
      new Set(l.riskDomains).size!==l.riskDomains.length))
      throw new TypeError('invalid risk domains for '+l.id);
    byLink.set(l.id,l);
  }
  const idSeen=new Set(),processed=[];
  for(const p of paths){
    if(!p||!valid(p.id)||idSeen.has(p.id)||
      !Array.isArray(p.linkIds)||!p.linkIds.length||p.linkIds.length>MAX_HOPS||
      new Set(p.linkIds).size!==p.linkIds.length||
      !finitePositive(p.costEUR)||!finitePositive(p.energyMj))
      throw new TypeError('invalid, duplicated or unbounded path');
    idSeen.add(p.id);
    const domains=new Set(),hops=new Set();
    let unknown=false;
    for(const linkId of p.linkIds){
      if(!byLink.has(linkId))throw new RangeError('unknown link '+linkId);
      hops.add(linkId);
      const item=byLink.get(linkId);
      domains.add('LINK:'+linkId);
      if(!item.riskDomains?.length){
        unknown=true;domains.add('UNKNOWN_TOPOLOGY');
      }else for(const risk of item.riskDomains)domains.add('SRLG:'+risk);
    }
    processed.push({id:p.id,costEUR:p.costEUR,energyMj:p.energyMj,
      consentDeclared:p.consentDeclared===true,
      linkAuthorizedDeclared:p.linkAuthorizedDeclared===true,
      incompleteTopology:unknown,
      linkIds:[...hops],riskDomains:[...domains].sort()});
  }
  const pairs=[];
  for(let i=0;i<processed.length;i++)for(let j=i+1;j<processed.length;j++){
    const a=processed[i],b=processed[j];
    const setB=new Set(b.riskDomains);
    const overlap=a.riskDomains.filter(x=>setB.has(x));
    const unknown=a.incompleteTopology||b.incompleteTopology;
    if(unknown&&!overlap.includes('UNKNOWN_TOPOLOGY'))
      overlap.push('UNKNOWN_TOPOLOGY');
    const complete=!unknown;
    const consent=a.consentDeclared&&b.consentDeclared;
    const authorized=a.linkAuthorizedDeclared&&b.linkAuthorizedDeclared;
    const cost=a.costEUR+b.costEUR,energy=a.energyMj+b.energyMj;
    const allowedByBudget=cost<=maxPairCostEUR&&energy<=maxPairEnergyMj;
    pairs.push({pathIds:[a.id,b.id],sharedDeclaredRisks:[...overlap].sort(),
      sharedRiskCount:overlap.length,
      linkDisjoint:!overlap.some(x=>x.startsWith('LINK:')),
      fullyDeclaredTopology:complete,
      declaredSrlgDisjoint:complete&&overlap.length===0,
      candidateEligible:consent&&authorized&&allowedByBudget&&
        complete&&overlap.length===0,
      declaredConsentAndAuthorization:consent&&authorized,
      costEUR:cost,energyMj:energy,
      physicalIndependenceValidated:false,
      successEventsIndependentValidated:false});
  }
  const eligible=pairs.filter(x=>x.candidateEligible);
  eligible.sort((a,b)=>a.costEUR-b.costEUR||a.energyMj-b.energyMj||
    a.pathIds.join('|').localeCompare(b.pathIds.join('|')));
  return {status:eligible.length?'DECLARED_DISJOINT_RESEARCH_PAIR':'NO_VERIFIABLE_DISJOINT_PAIR',
    selectedPathIds:eligible[0]?.pathIds??null,paths:processed,pairs,
    mode:'OFFLINE_SHADOW_TOPOLOGY_AUDIT',
    incompleteTopologyPaths:processed.filter(x=>x.incompleteTopology).map(x=>x.id),
    declarationDoesNotProveIndependentFailures:true,
    mayMultiplyReliabilities:false,mayTransmit:false,
    physicalValidationCompleted:false,linkPermissionsVerified:false};
}

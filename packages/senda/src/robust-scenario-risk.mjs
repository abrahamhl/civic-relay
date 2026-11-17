/**
 * SENDA: finite-scenario distributional ambiguity gate (SHADOW RESEARCH ONLY).
 *
 * Existing delivery-assurance.mjs handles common-cause outages with fixed state weights.
 * This module handles UNCERTAIN state weights:
 *   L(a) = min_q Σ q_s lowerSuccess(a,s)
 *   U(a) = max_q Σ q_s upperSuccess(a,s)
 *   subject to Σ q_s=1, lowerMass_s <= q_s <= upperMass_s.
 *
 * Exact for the declared finite box/simplex: start at lowerMass, allocate remaining
 * mass to lowest (min) or highest (max) success. This is established linear
 * optimization, NOT a novel theorem nor a calibrated real-world reliability claim.
 * Unknown states, inaccurate intervals and unmodeled conditional dependence
 * invalidate any physical interpretation. NEVER authorizes emergency operation.
 * Ref: https://doi.org/10.1007/s10107-017-1172-1
 */
const EPS=1e-10;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const unit=x=>finite(x)&&x>=0&&x<=1;
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(x);

export function validateScenarioEnvelope(states) {
  if(!Array.isArray(states)||!states.length||states.length>128)
    throw new RangeError('scenario envelope must have 1..128 states');
  const ids=new Set();
  let lo=0,hi=0,nom=0;
  for(const s of states){
    if(!s||!validId(s.id)||ids.has(s.id))throw new TypeError('unique scenario id required');
    ids.add(s.id);
    if(!unit(s.lowerMass)||!unit(s.upperMass)||!unit(s.nominalMass)||
      s.lowerMass>s.upperMass||s.nominalMass<s.lowerMass-EPS||s.nominalMass>s.upperMass+EPS)
      throw new RangeError('invalid probability interval: '+s.id);
    lo+=s.lowerMass;hi+=s.upperMass;nom+=s.nominalMass;
  }
  if(lo>1+EPS||hi<1-EPS||Math.abs(nom-1)>EPS)
    throw new RangeError('infeasible envelope or unaccounted scenario probability mass');
  return {feasible:true,sumLower:lo,sumUpper:hi,sumNominal:nom,
    completeStatePartition:'ASSERTED_BY_CALLER_NOT_VERIFIED'};
}
function extremize(states,successByState,key,maximize) {
  const weights=states.map(s=>({id:s.id,q:s.lowerMass,remaining:s.upperMass-s.lowerMass,
    outcome:successByState[s.id][key]}));
  let free=1-weights.reduce((a,x)=>a+x.q,0);
  if(free < -EPS)throw new RangeError('infeasible lower masses');
  free=Math.max(0,free);
  const sorted=[...weights].sort((a,b)=>
    (maximize?b.outcome-a.outcome:a.outcome-b.outcome)||a.id.localeCompare(b.id));
  for(const w of sorted){
    const plus=Math.min(free,w.remaining);
    if(plus>0){w.q+=plus;free-=plus;}
    if(free<=EPS)break;
  }
  if(free>EPS)throw new RangeError('infeasible upper masses');
  return {
    value:Math.max(0,Math.min(1,weights.reduce((a,x)=>a+x.q*x.outcome,0))),
    adversarialMass:Object.fromEntries(weights.map(w=>[w.id,w.q]))
  };
}
export function evaluateScenarioUncertainty({states,successByState}={}){
  validateScenarioEnvelope(states);
  if(!successByState||typeof successByState!=='object'||Array.isArray(successByState)||
      Object.keys(successByState).length!==states.length)
    throw new TypeError('complete successByState mapping required');
  for(const s of states){
    const x=successByState[s.id];
    if(!x||!unit(x.lower)||!unit(x.upper)||x.lower>x.upper||
       (x.nominal!==undefined&&(!unit(x.nominal)||x.nominal<x.lower-EPS||x.nominal>x.upper+EPS)))
       throw new RangeError('invalid conditional success bounds: '+s.id);
  }
  const worst=extremize(states,successByState,'lower',false);
  const best=extremize(states,successByState,'upper',true);
  const nominalPresent=states.every(s=>unit(successByState[s.id].nominal));
  const nominal=nominalPresent?states.reduce(
    (sum,s)=>sum+s.nominalMass*successByState[s.id].nominal,0):null;
  if(worst.value>best.value+EPS)throw new RangeError('inconsistent robust bounds');
  return {robustLower:worst.value,robustUpper:best.value,nominalConditional:nominal,
    worstCaseScenarioMass:worst.adversarialMass,bestCaseScenarioMass:best.adversarialMass,
    uncertaintyWidth:Math.max(0,best.value-worst.value),
    optimization:'EXACT_BOX_SIMPLEX_LP',
    qualification:'CONDITIONAL_ON_DECLARED_STATE_SPACE_AND_BOUNDS',
    independentlyCalibrated:false,probabilityOfPhysicalDeliveryVerified:false,
    operationallyAuthorized:false};
}
/** Rank declared authorized/consented model candidates, never a live transport decision. */
export function chooseRobustResearchPlan({states,candidates,minRobustSuccess=0,
  maxCostEUR=1e6,maxEnergyMj=1e9}={}){
  validateScenarioEnvelope(states);
  if(!Array.isArray(candidates)||!candidates.length||candidates.length>100||
    !unit(minRobustSuccess)||!finite(maxCostEUR)||maxCostEUR<0||
    !finite(maxEnergyMj)||maxEnergyMj<0)
    throw new TypeError('invalid research plan selection input');
  const seen=new Set(),evaluations=[];
  for(const p of candidates){
    if(!p||!validId(p.id)||seen.has(p.id))throw new TypeError('unique plan id required');
    seen.add(p.id);
    const rejected=[];
    if(p.consentDeclared!==true)rejected.push('NO_DECLARED_CONSENT');
    if(p.linkAuthorizedDeclared!==true)rejected.push('NO_DECLARED_BEARER_AUTHORIZATION');
    if(!finite(p.costEUR)||p.costEUR<0||p.costEUR>maxCostEUR)rejected.push('COST_OUT_OF_BOUNDS');
    if(!finite(p.energyMj)||p.energyMj<0||p.energyMj>maxEnergyMj)rejected.push('ENERGY_OUT_OF_BOUNDS');
    let result=null;
    try{result=evaluateScenarioUncertainty({states,successByState:p.successByState});}
    catch(e){rejected.push('INVALID_SCENARIO_CONDITIONALS: '+e.message);}
    evaluations.push({id:p.id,rejected,eligibleInDeclaredModel:rejected.length===0,...result,
      costEUR:finite(p.costEUR)?p.costEUR:null,
      energyMj:finite(p.energyMj)?p.energyMj:null});
  }
  const eligible=evaluations.filter(x=>x.eligibleInDeclaredModel&&x.robustLower>=minRobustSuccess);
  eligible.sort((a,b)=>b.robustLower-a.robustLower||a.costEUR-b.costEUR||
    a.energyMj-b.energyMj||a.id.localeCompare(b.id));
  return {selectedId:eligible[0]?.id??null,
    status:eligible.length?'RESEARCH_SHADOW_CHOICE':'NO_ELIGIBLE_SHADOW_PLAN',
    evaluations,allInputsUnverifiedForFieldUse:true,operationallyAuthorized:false,
    mayClaimRealEmergencyReliability:false};
}

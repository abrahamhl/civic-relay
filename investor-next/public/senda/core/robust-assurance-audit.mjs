/**
 * SENDA shadow-only bridge to the existing Claude delivery-assurance engine.
 * Evaluates each candidate separately under EACH declared hazard state, then
 * applies robust-scenario-risk to unknown state frequencies. No live routing.
 * Conditional independence WITHIN an outage state is inherited from upstream;
 * actual weather/propagation/shared-hardware correlations must still be measured.
 */
import {correlatedDeliveryProbability} from './delivery-assurance.mjs';
import {chooseRobustResearchPlan,validateScenarioEnvelope} from './robust-scenario-risk.mjs';

const unit=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
export function auditAssuranceAgainstUncertainHazards({states,plans,minRobustSuccess=0,
  maxCostEUR=1e6,maxEnergyMj=1e9}={}){
  validateScenarioEnvelope(states);
  if(!Array.isArray(plans)||!plans.length||plans.length>100)
    throw new TypeError('1..100 assurance candidates required');
  for(const s of states){
    const h=s.hazard;
    if(!h||typeof h!=='object'||Array.isArray(h)||
      !h.family||typeof h.family!=='object'||Array.isArray(h.family)||
      !Object.values(h.family).every(unit)||
      (h.rainMmH!==undefined&&
       (typeof h.rainMmH!=='number'||!Number.isFinite(h.rainMmH)||
         h.rainMmH<0||h.rainMmH>500)))
      throw new RangeError('invalid hazard physics: '+s.id);
  }
  const calculated=plans.map(p=>{
    if(!p||!Array.isArray(p.groups)||!p.groups.length||p.groups.length>32||
      !p.groups.every(g=>g&&typeof g.id==='string'&&unit(g.p)&&
        Number.isSafeInteger(g.shards)&&g.shards>=1&&g.shards<=255)||
      !Number.isSafeInteger(p.k)||p.k<1||
      p.k>p.groups.reduce((a,g)=>a+g.shards,0))
      throw new RangeError('invalid hypothetical shard allocation');
    const successByState={};
    for(const s of states){
      // Reuse upstream once per hazard; isolate it from uncertain prevalence.
      const result=correlatedDeliveryProbability(p.groups,p.k,
        {[s.id]:{...s.hazard,prob:1}});
      successByState[s.id]={lower:result.pDelivery,upper:result.pDelivery,
        nominal:result.pDelivery};
    }
    return {id:p.id,consentDeclared:p.consentDeclared,
      linkAuthorizedDeclared:p.linkAuthorizedDeclared,
      costEUR:p.costEUR,energyMj:p.energyMj,successByState};
  });
  const summary=chooseRobustResearchPlan({states,candidates:calculated,
    minRobustSuccess,maxCostEUR,maxEnergyMj});
  return {...summary,mode:'HYPOTHETICAL_SHADOW_MODE',
    upstreamModel:'delivery-assurance.mjs/correlatedDeliveryProbability',
    upstreamConditionalIndependenceAssumed:true,
    statisticalCalibrationClaim:false,physicalHardwareValidated:false,
    evidenceRequirements:[
      'Enumerate all material common-cause outage states',
      'Calibrate conditional success on held-out independent real measurements',
      'Prove that hazard mass intervals cover real incident frequencies',
      'Verify operator authorizations, radio hardware and receiver receipts',
    ]};
}

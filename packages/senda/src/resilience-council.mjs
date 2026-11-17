/**
 * SENDA H15 — Evidence-to-route council (RESEARCH / SHADOW ONLY).
 *
 * The missing integration: incident sampling (H12/H14) -> uncertainty of
 * scenario frequency -> physical shared-risk topology (H13) -> declared
 * contact/deadline feasibility -> dependence-free shard lower bounds (H11-D)
 * -> worst-case distributional optimization (H11) -> reproducible audit.
 *
 * An executable *counterfactual research* decision, NEVER a live router.
 * We do not verify source signatures, hazard labels, physical RF links,
 * operator grants, hardware, receipt delivery, statistical IID or CAP rights.
 * Output cannot arm a transmitter or publish an alert.
 */
import {BEARERS} from './bearers.mjs';
import {buildAnytimeIncidentFrequencyEnvelope} from './anytime-scenario-confidence.mjs';
import {attachConservativeResearchHazards} from './scenario-frequency-evidence.mjs';
import {analyzeSharedRiskTopology} from './shared-risk-topology.mjs';
import {auditAssuranceAgainstUncertainHazards} from './robust-assurance-audit.mjs';

const finite=x=>typeof x==='number'&&Number.isFinite(x);
const pos=x=>finite(x)&&x>=0;
const safeMs=x=>Number.isSafeInteger(x)&&x>=0&&x<=8.64e15;
const own=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{1,127}$/;

/** A declared ONE-CONTACT path, not an RF measurement or multi-hop orbital proof. */
export function auditDeclaredContactWindow(model,{nowMs,deadlineMs}={}){
  if(!model||typeof model!=='object'||!safeMs(nowMs)||!safeMs(deadlineMs)||
    nowMs>deadlineMs||!safeMs(model.windowStartMs)||
    !safeMs(model.windowEndMs)||model.windowEndMs<=model.windowStartMs||
    !Number.isSafeInteger(model.wireBytes)||model.wireBytes<1||model.wireBytes>1_000_000_000||
    !finite(model.bytesPerSecond)||model.bytesPerSecond<=0||
    model.bytesPerSecond>1e9||!Number.isSafeInteger(model.handshakeMs)||
    model.handshakeMs<0||model.handshakeMs>600_000)
    throw new RangeError('invalid declared contact, rate, payload or deadline');
  const ready=Math.max(nowMs,model.windowStartMs);
  const duration=Math.ceil(1000*model.wireBytes/model.bytesPerSecond);
  if(!Number.isSafeInteger(duration)||!Number.isSafeInteger(ready+duration+model.handshakeMs))
    throw new RangeError('contact time arithmetic overflow');
  const finishAtMs=ready+model.handshakeMs+duration;
  const usableEndMs=Math.min(deadlineMs,model.windowEndMs);
  const feasible=ready<model.windowEndMs && finishAtMs<=usableEndMs;
  return {feasibleWithinDeclaredWindow:feasible,
    earliestFinishAtMs:finishAtMs,
    contactDeadlineMs:usableEndMs,
    elapsedTransferMs:duration+model.handshakeMs,
    contactStartAssumedMs:model.windowStartMs,
    contactEndAssumedMs:model.windowEndMs,
    observedCapacityVerified:false,physicalContactVerified:false};
}

function canonical(value,depth=0,seen=new WeakSet()){
  if(depth>32)throw new RangeError('audit input too deeply nested');
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'){if(!finite(value))throw new TypeError('non-finite audit input');return JSON.stringify(value);}
  if(typeof value!=='object')throw new TypeError('audit input must be JSON data');
  if(seen.has(value))throw new TypeError('cyclic audit input');
  seen.add(value);
  let result;
  if(Array.isArray(value))result='['+value.map(x=>canonical(x,depth+1,seen)).join(',')+']';
  else {
    const proto=Object.getPrototypeOf(value);
    if(proto!==Object.prototype&&proto!==null)throw new TypeError('non-plain audit object');
    result='{'+Object.keys(value).sort().map(k=>{
      if(k==='__proto__'||k==='prototype'||k==='constructor')throw new TypeError('dangerous object key');
      return JSON.stringify(k)+':'+canonical(value[k],depth+1,seen);
    }).join(',')+'}';
  }
  seen.delete(value);
  return result;
}
async function digestInput(inputs){
  const text=canonical(inputs);
  if(text.length>1_500_000)throw new RangeError('audit fixture exceeds 1.5 MB');
  const bytes=new TextEncoder().encode(text);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return [...hash].map(x=>x.toString(16).padStart(2,'0')).join('');
}

/**
 * Top-level H15 contract:
 *   input: {nowMs,deadlineMs,incidents,scenarioIds,hazardsByState,
 *           links,paths,contactModelsByPath,k,alpha,threshold,maxPair...}
 *
 * A path has id, linkIds, costEUR, energyMj, and two consent flags,
 * exactly as in analyzeSharedRiskTopology.
 * A contact model is {bearerId,p,shards,wireBytes,bytesPerSecond,
 *                      handshakeMs,windowStartMs,windowEndMs}.
 * All probabilities and rate/window inputs are HYPOTHETICAL for testing.
 */
export async function auditResilienceCouncil(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new TypeError('research council requires input object');
  const {
    nowMs,deadlineMs,incidents,scenarioIds,hazardsByState,links,paths,
    contactModelsByPath,k=1,alpha=.05,minRobustSuccess=0,
    maxPairCostEUR=100000,maxPairEnergyMj=100000000,
    encryptedPayload=true
  }=input;
  if(!safeMs(nowMs)||!safeMs(deadlineMs)||deadlineMs<nowMs||
    !Array.isArray(paths)||paths.length<2||paths.length>14||
    !Array.isArray(incidents)||incidents.length>1000||
    !Number.isSafeInteger(k)||k<1||k>255||
    typeof encryptedPayload!=='boolean'||
    !finite(minRobustSuccess)||minRobustSuccess<0||minRobustSuccess>1||
    !pos(maxPairCostEUR)||!pos(maxPairEnergyMj)||
    !contactModelsByPath||typeof contactModelsByPath!=='object'||
    Array.isArray(contactModelsByPath)||
    Object.keys(contactModelsByPath).length!==paths.length)
    throw new RangeError('invalid council scope or incomplete path/contact mapping');
  const inputSha256=await digestInput(input); // fingerprint, NOT an institutional signature
  const confidence=buildAnytimeIncidentFrequencyEnvelope({incidents,scenarioIds,alpha});
  const scenarioModel=attachConservativeResearchHazards(confidence,hazardsByState);
  const topology=analyzeSharedRiskTopology({links,paths,maxPairCostEUR,maxPairEnergyMj});
  const contactChecks={};
  for(const path of paths){
    if(!own(contactModelsByPath,path.id))throw new TypeError('missing contact for '+path.id);
    const model=contactModelsByPath[path.id];
    if(!model||typeof model.bearerId!=='string'||!own(BEARERS,model.bearerId)||
      !finite(model.p)||model.p<0||model.p>1||
      !Number.isSafeInteger(model.shards)||model.shards<1||model.shards>255)
      throw new TypeError('invalid bearer model for '+path.id);
    const bearer=BEARERS[model.bearerId];
    if(encryptedPayload&&!bearer.encryptionAllowed)
      throw new RangeError('encrypted payload prohibited on bearer '+model.bearerId);
    const check=auditDeclaredContactWindow(model,{nowMs,deadlineMs});
    contactChecks[path.id]={...check,bearerId:model.bearerId};
  }
  const exclusions=[],plans=[];
  for(const pair of topology.pairs){
    const [a,b]=pair.pathIds;
    const why=[];
    if(!pair.candidateEligible)why.push('TOPOLOGY_BUDGET_OR_DECLARED_PERMISSION_REJECTED');
    if(!contactChecks[a].feasibleWithinDeclaredWindow)why.push('CONTACT_UNAVAILABLE:'+a);
    if(!contactChecks[b].feasibleWithinDeclaredWindow)why.push('CONTACT_UNAVAILABLE:'+b);
    const A=contactModelsByPath[a],B=contactModelsByPath[b];
    if(k>A.shards+B.shards)why.push('INSUFFICIENT_SHARD_COUNT');
    if(why.length){exclusions.push({pathIds:pair.pathIds,reasons:why});continue;}
    plans.push({
      id:'PAIR_'+[a,b].join('__'),
      k,groups:[{id:A.bearerId,p:A.p,shards:A.shards},
                {id:B.bearerId,p:B.p,shards:B.shards}],
      consentDeclared:true,linkAuthorizedDeclared:true,
      costEUR:pair.costEUR,energyMj:pair.energyMj,
    });
  }
  // At least one topology- and deadline-feasible pair is required.
  const robustness=plans.length?auditAssuranceAgainstUncertainHazards({
    states:scenarioModel.states,plans,minRobustSuccess,
    maxCostEUR:maxPairCostEUR,maxEnergyMj:maxPairEnergyMj
  }):null;
  const selectedId=robustness?.selectedId??null;
  const selected=selectedId?robustness.evaluations.find(p=>p.id===selectedId):null;
  const chosen=plans.find(p=>p.id===selectedId);
  const chosenPathIds=chosen?
    topology.pairs.find(x=>'PAIR_'+x.pathIds.join('__')===selectedId)?.pathIds??null:null;
  return {
    contractVersion:'SENDA_H15_SHADOW_V1',
    status:selected?'RESEARCH_ONLY_COUNTERFACTUAL_PAIR':'NO_DEFENSIBLE_COUNTERFACTUAL_PAIR',
    selectedPathIds:chosenPathIds,
    modeledWorstCaseLower:selected?.robustLower??null,
    modeledIndependentNominal:selected?.nominalConditional??null,
    modeledUpper:selected?.robustUpper??null,
    assessedCandidateCount:plans.length,
    exclusions,
    contactChecks,
    scenarioUncertainty:{method:confidence.method,sampleSize:confidence.sampleSize,
      alpha:confidence.alpha,anytimeHalfWidth:confidence.simultaneousHalfWidth,
      unknownUpperMass:confidence.unknownUpperMass,
      IIDAssumptionExternallyVerified:false},
    topologyAudit:{status:topology.status,
      consideredPairCount:topology.pairs.length,
      incompleteTopologyPaths:topology.incompleteTopologyPaths,
      sharedRiskIndependentOfPhysics:false},
    robustnessAudit:robustness?{
      worstCaseOptimization:'EXACT_FINITE_BOX_SIMPLEX',
      correlationsWithinScenarioIndependenceNotRequiredForLower:true,
      allInputsUnverifiedForFieldUse:robustness.allInputsUnverifiedForFieldUse,
      candidateEvaluations:robustness.evaluations,
    }:null,
    reproducibilitySha256:inputSha256,
    digestKind:'UNSIGNED_CANONICAL_INPUT_FINGERPRINT',
    noExternalAuthorityAuthenticated:true,
    noRfFieldExperimentPerformed:true,
    notARealDeliveryProbability:true,
    mayIssuePublicAlert:false,
    maySendTraffic:false,
    mayClaimCertifiedEmergencyDelivery:false,
    evidenceNeeded:[
      'Out-of-band consent, spectrum and operator permissions',
      'Per-causal-event independent audited outage observations',
      'Receiver-signed hardware receipt and field RSSI/PER/latency measurements',
      'Externally verified power/backhaul/gateway SRLG maps',
      'Independent clock, contact and capacity calibration',
      'Institutional trust anchor for CAP and emergency alert publication',
    ]
  };
}

/**
 * SENDA H12: incident-level categorical frequency uncertainty (research-only).
 *
 * Each record is ONE distinct incident/independent study episode, NEVER
 * one radio packet or one repeated citizen report. Distinct IDs are checked;
 * actual statistical independence, representative sampling, and source
 * authenticity CANNOT be verified by this code.
 *
 * Under IID incident labels, for m exhaustive declared categories and n
 * episodes, Hoeffding + union bound gives simultaneous coverage >= 1-alpha:
 *   |q_s - count_s/n| <= sqrt( ln(2m/alpha) / (2n)) for every s.
 * This is a pre-existing concentration result, not new science.
 *
 * The mandatory UNKNOWN category must include unclassified observed events.
 * It does not protect against events that were NEVER collected or forecast
 * drift. It intentionally remains with a nonzero upper frequency when n>0.
 */
import {BEARERS} from './bearers.mjs';
import {validateScenarioEnvelope} from './robust-scenario-risk.mjs';

const LABEL=/^[A-Z][A-Z0-9_]{1,39}$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{1,159}$/;
const SHA=/^[0-9a-f]{64}$/i;
const OWN=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);

export function buildIncidentFrequencyEnvelope({incidents,scenarioIds,alpha=0.05}={}){
  if(!Array.isArray(scenarioIds)||scenarioIds.length<2||scenarioIds.length>24||
    new Set(scenarioIds).size!==scenarioIds.length||
    !scenarioIds.every(s=>typeof s==='string'&&LABEL.test(s))||
    !scenarioIds.includes('UNKNOWN'))
    throw new RangeError('2..24 unique scenario labels, including UNKNOWN, are mandatory');
  if(typeof alpha!=='number'||!Number.isFinite(alpha)||alpha<=0||alpha>.2)
    throw new RangeError('alpha must be in (0, 0.2]');
  // Fewer events cannot support even an exploratory frequency estimate.
  if(!Array.isArray(incidents)||incidents.length<30||incidents.length>100000)
    throw new RangeError('30..100000 distinct incident records required');
  const seen=new Set(), count=Object.fromEntries(scenarioIds.map(x=>[x,0]));
  for(const row of incidents){
    if(!row||typeof row!=='object'||!ID.test(row.incidentKey??'')||
      seen.has(row.incidentKey)||typeof row.scenarioId!=='string'||
      !OWN(count,row.scenarioId)||typeof row.evidenceSha256!=='string'||
      !SHA.test(row.evidenceSha256)||!ID.test(row.sourceId??''))
      throw new TypeError('invalid, repeated or undocumented incident label');
    seen.add(row.incidentKey);
    count[row.scenarioId]++;
  }
  const n=incidents.length,m=scenarioIds.length;
  const eps=Math.sqrt(Math.log(2*m/alpha)/(2*n));
  const states=scenarioIds.map(id=>{
    const nominalMass=count[id]/n;
    return {id,lowerMass:Math.max(0,nominalMass-eps),
      upperMass:Math.min(1,nominalMass+eps),nominalMass};
  });
  validateScenarioEnvelope(states);
  const unknown=states.find(s=>s.id==='UNKNOWN');
  return {states,sampleSize:n,counts:count,alpha,
    simultaneousHalfWidth:eps,
    unknownUpperMass:unknown.upperMass,
    status:'RESEARCH_ESTIMATE_ONLY',
    method:'HOEFFDING_PLUS_UNION_BOUND_IID_CATEGORICAL_EVENTS',
    confidenceStatement:'SIMULTANEOUS_COVERAGE_ONLY_IF_EVENT_LABELS_ARE_IID_AND_COMPLETE',
    sourceHashFormatChecked:true,sourceAuthenticityVerified:false,
    distinctIncidentKeysChecked:true,independenceOfIncidentsVerified:false,
    representativeOfFutureDisastersVerified:false,
    novelMathematicsClaim:false,mayAuthorizeOperationalRouting:false};
}

/**
 * Bridge event uncertainty to the existing Claude conditional-outage model.
 * UNKNOWN deliberately models no guaranteed bearer availability. In that
 * state, every portador gets factor 0 even if caller supplies a favorable
 * hazard. This is a conservative LOWER-bound assumption only.
 */
export function attachConservativeResearchHazards(envelope,hazardsByState){
  if(!envelope||!Array.isArray(envelope.states)||
    envelope.status!=='RESEARCH_ESTIMATE_ONLY'||!hazardsByState||
    typeof hazardsByState!=='object'||Array.isArray(hazardsByState))
    throw new TypeError('evidenced research envelope and hazard table required');
  validateScenarioEnvelope(envelope.states);
  const zeroByFamily=Object.fromEntries(
    [...new Set(Object.values(BEARERS).map(x=>x.family))].map(f=>[f,0])
  );
  return {states:envelope.states.map(s=>{
    if(s.id==='UNKNOWN')
      return {...s,hazard:{family:zeroByFamily,rainMmH:0},isUnknownConservative:true};
    if(!OWN(hazardsByState,s.id))throw new RangeError('missing declared hazard: '+s.id);
    const h=hazardsByState[s.id];
    if(!h||typeof h!=='object'||Array.isArray(h)||!h.family||
      typeof h.family!=='object'||Array.isArray(h.family)||
      !Object.values(h.family).every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1)||
      (h.rainMmH!==undefined&&
       (typeof h.rainMmH!=='number'||!Number.isFinite(h.rainMmH)||h.rainMmH<0||h.rainMmH>500)))
      throw new RangeError('invalid declared hazard: '+s.id);
    return {...s,hazard:{family:{...h.family},rainMmH:h.rainMmH??0}};
  }),status:'RESEARCH_HAZARDS_ASSUMED_NOT_FIELD_CALIBRATED',
    unknownAlwaysZeroGuaranteedSuccess:true,
    permissionsGranted:false,independenceOfIncidentsVerified:false};
}

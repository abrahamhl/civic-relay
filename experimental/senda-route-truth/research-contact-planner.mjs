/**
 * SENDA candidate contact-time planner. Research-only finite-horizon enumeration.
 * Conservative Boole/Frechet lower bound: P(all contacts work) >= max(0,1-Σ(1-p_i)).
 * No independence assumption. Supplied p_i are HYPOTHETICAL until independently calibrated;
 * numbers are NOT guarantees, satellite availability, RF measurements or permissions.
 */
const LIVE_ROLES = new Set(['SENDER','RECEIVER','RELAY','GATEWAY']);
export function planHypotheticalContacts({nodes,contacts,source,destination,startMs,
  deadlineMs,payloadBytes,maxHops=5,minLowerBound=0,maxEnergyMj=Number.MAX_SAFE_INTEGER}={}) {
  if(!Array.isArray(nodes)||!Array.isArray(contacts)||typeof source!=='string'||
   typeof destination!=='string'||!Number.isSafeInteger(startMs)||startMs<0||
   !Number.isSafeInteger(deadlineMs)||deadlineMs<=startMs||
   !Number.isSafeInteger(payloadBytes)||payloadBytes<1||payloadBytes>65536||
   !Number.isSafeInteger(maxHops)||maxHops<1||maxHops>8||
   typeof minLowerBound!=='number'||!Number.isFinite(minLowerBound)||minLowerBound<0||minLowerBound>1||
   !Number.isSafeInteger(maxEnergyMj)||maxEnergyMj<0)throw new TypeError('Invalid planner configuration');
  const byId=new Map();
  for(const node of nodes){
    if(!node||typeof node.id!=='string'||!node.id||byId.has(node.id))throw new TypeError('Invalid node');
    byId.set(node.id,node);
  }
  const usable=n=>n?.consent===true&&n?.powered===true&&n?.radioEnabled===true&&LIVE_ROLES.has(n.role);
  const output=(reason,chosen,candidates)=>Object.freeze({
    reason,modelFeasible:!!chosen,evidenceLevel:'HYPOTHETICAL_CONTACT_MODEL_ONLY',
    physicalDeliveryVerified:false,satelliteAccessVerified:false,
    candidatePathsExamined:candidates,
    path:chosen?.path??[], scheduledContacts:chosen?.schedule??[],
    arrivalMs:chosen?.arrivalMs??null,energyMj:chosen?.energyMj??null,
    conservativeSuccessLowerBound:chosen?.bound??null
  });
  if(source===destination||!usable(byId.get(source))||!usable(byId.get(destination)))
    return output('ENDPOINTS_NOT_ELIGIBLE_OR_SAME',null,0);
  const adjacency=new Map([...byId.keys()].map(id=>[id,[]]));
  for(const c of contacts){
    if(!c||!adjacency.has(c.from)||!adjacency.has(c.to)||!usable(byId.get(c.from))||
      !usable(byId.get(c.to))||c.kind!=='ACTIVE_RADIO'||c.authorized!==true||
      c.enabled!==true||c.dutyCycleAllowed!==true)continue;
    if(!Number.isSafeInteger(c.startMs)||!Number.isSafeInteger(c.endMs)||c.endMs<=c.startMs||
      !Number.isSafeInteger(c.rateBytesPerSec)||c.rateBytesPerSec<=0||
      !Number.isSafeInteger(c.handshakeMs)||c.handshakeMs<0||
      !Number.isSafeInteger(c.energyMj)||c.energyMj<0||
      typeof c.probabilityLowerBound!=='number'||!Number.isFinite(c.probabilityLowerBound)||
      c.probabilityLowerBound<0||c.probabilityLowerBound>1)continue;
    adjacency.get(c.from).push(c);
  }
  for(const arr of adjacency.values())arr.sort((a,b)=>a.startMs-b.startMs||a.to.localeCompare(b.to));
  let considered=0,best=null, truncated=false;
  const score=x=>[x.bound,-x.arrivalMs,-x.energyMj,-x.path.length];
  const superior=(a,b)=>!b||score(a).some((x,i)=>x!==score(b)[i]&&score(a).slice(0,i).every((v,j)=>v===score(b)[j])&&x>score(b)[i]);
  function traverse(node,arrivalMs,path,schedule,failSum,energyMj){
    if(considered>=10000){truncated=true;return;}
    if(node===destination){
      considered++;
      const bound=Math.max(0,1-failSum);
      const candidate={path,schedule,arrivalMs,bound,energyMj};
      if(bound>=minLowerBound&&superior(candidate,best))best=candidate;
      return;
    }
    if(path.length-1>=maxHops)return;
    for(const c of adjacency.get(node)||[]){
      if(path.includes(c.to))continue;
      const depart=Math.max(arrivalMs,c.startMs);
      const timeMs=Math.ceil(1000*payloadBytes/c.rateBytesPerSec)+c.handshakeMs;
      const finish=depart+timeMs;
      if(finish>c.endMs||finish>deadlineMs||energyMj+c.energyMj>maxEnergyMj)continue;
      traverse(c.to,finish,[...path,c.to],[...schedule,{from:c.from,to:c.to,departMs:depart,finishMs:finish}],
        failSum+1-c.probabilityLowerBound,energyMj+c.energyMj);
      if(truncated)return;
    }
  }
  traverse(source,startMs,[source],[],0,0);
  if(truncated)return output('SEARCH_LIMIT_REACHED_FAIL_CLOSED',null,considered);
  return output(best?'HYPOTHETICAL_PATH_FOUND_NOT_DELIVERED':'NO_RISK_FEASIBLE_AUTHORIZED_CONTACT_PLAN',best,considered);
}

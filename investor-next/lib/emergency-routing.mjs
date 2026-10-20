/** Deterministic RESEARCH SIMULATION only. No radios, personal data, CAP trust, physical gateway or 112. */
export function runScenario(p={}) {
  const clamp=(v,lo,hi,d)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Math.round(Number(v)):d));
  const n=clamp(p.devices,20,100,40),seed=clamp(p.seed,0,2147483647,20261020);
  const participation=clamp(p.participation,0,100,70),permissions=clamp(p.permissions,0,100,85);
  const battery=clamp(p.battery,0,100,65),damaged=clamp(p.damaged,0,100,75);
  const bluetooth=p.bluetooth!==false,wifi=p.wifi!==false,gateway=p.gateway!==false;
  let s=seed>>>0;const rand=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
  const columns=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/columns);
  const devices=Array.from({length:n},(_,i)=>{
    const participating=rand()*100<participation;
    const permission=participating&&rand()*100<permissions;
    const online=rand()*100>=damaged;
    return {id:`NODE-${String(i+1).padStart(3,'0')}`,
      x:Math.min(.98,Math.max(.02,(i%columns+.5)/columns+(rand()-.5)*.06)),
      y:Math.min(.98,Math.max(.02,(Math.floor(i/columns)+.5)/rows+(rand()-.5)*.06)),
      floor:i%5,participating,permission,online,
      energy:battery<=15?'CRITICAL':battery<=35?'CONSERVATION':damaged>0?'ALERT':'NORMAL',
      bluetooth:!bluetooth?'DISABLED':!participating?'RESTRICTED':!permission?'PERMISSION_REQUIRED':'AVAILABLE',
      wifi:!wifi?'DISABLED':!participating?'RESTRICTED':!permission?'PERMISSION_REQUIRED':'AVAILABLE',
      satellite:'UNSUPPORTED',humanStatus:'UNKNOWN'};
  });
  const participants=devices.filter(d=>d.participating);
  const sos=clamp(p.helpRequests,0,participants.length,2);
  const safe=clamp(p.responses,0,participants.length-sos,8);
  for(let i=0;i<safe;i++)participants[i].humanStatus='SAFE';
  for(let i=safe;i<safe+sos;i++)participants[i].humanStatus='SOS_EXPLICIT';
  const usable=devices.filter(d=>d.participating&&d.permission&&(bluetooth||wifi));
  const byId=new Map(devices.map(d=>[d.id,d]));
  const range=wifi?.275:.175; // normalized virtual topology, NEVER metres or physical capability
  const graph=new Map(usable.map(d=>[d.id,[]]));
  for(let i=0;i<usable.length;i++)for(let j=i+1;j<usable.length;j++){
    const a=usable[i],b=usable[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
    if(distance>range)continue;
    const weight=1+2*distance/range+(battery<=35?.7:0);
    graph.get(a.id).push({id:b.id,weight});graph.get(b.id).push({id:a.id,weight});
  }
  const exit=new Set(gateway?usable.filter(d=>d.x>.65&&Math.abs(d.y-.5)<.35).map(d=>d.id):[]);
  const path=(start)=>{
    if(!graph.has(start))return null;
    const dist=new Map([[start,0]]),prev=new Map(),visited=new Set();
    while(true){
      let at=null,best=Infinity;
      for(const [id,v] of dist)if(!visited.has(id)&&v<best){best=v;at=id;}
      if(at===null)return null;
      if(exit.has(at)){const route=[at];while(prev.has(at)){at=prev.get(at);route.unshift(at);}return [...route,'GATEWAY'];}
      visited.add(at);
      if(at!==start&&byId.get(at).energy==='CRITICAL')continue;
      for(const edge of graph.get(at)||[]){
        if(visited.has(edge.id))continue;
        if(best+edge.weight<(dist.get(edge.id)??Infinity)){dist.set(edge.id,best+edge.weight);prev.set(edge.id,at);}
      }
    }
  };
  const messages=participants.filter(d=>d.humanStatus!=='UNKNOWN');
  const routes=messages.map(device=>{
    const direct=device.online;
    const via=direct?[device.id,'CELLULAR_MODEL','CENTRE_MODEL']:path(device.id);
    return {id:`SIM-${device.id}`,source:device.id,priority:device.humanStatus==='SOS_EXPLICIT'?'CRITICAL':'LOW',
      humanStatus:device.humanStatus,delivery:via?'ACK_SYNTHETIC':'QUEUED_LOCAL',
      path:via||[],hops:via?via.length-1:0,transport:direct?'SIMULATED_CELLULAR':via?'SIMULATED_LOCAL_GATEWAY':'NONE',
      evidence:'SIMULATED_ONLY',ttlSeconds:3600};
  });
  const ack=routes.filter(r=>r.delivery==='ACK_SYNTHETIC').length;
  const summary={totalDevices:n,participating:participants.length,permissioned:usable.length,
    humanSafe:safe,humanSOS:sos,humanUnknown:participants.length-safe-sos,noContact:n-participants.length,
    modelledMessages:messages.length,syntheticAcks:ack,queued:messages.length-ack,
    cellularOnlyAcks:messages.filter(d=>d.online).length,
    simulatedLocalGatewayAcks:routes.filter(r=>r.transport==='SIMULATED_LOCAL_GATEWAY').length,
    energyProfile:battery<=15?'CRITICAL':battery<=35?'CONSERVATION':damaged>0?'ALERT':'NORMAL'};
  return {
    kind:'RESEARCH_SIMULATION_NOT_OPERATIONAL',version:'0.1',seed,
    zone:{id:`EXERCISE-${seed}`,type:'EARTHQUAKE',provenance:'SIMULATION_NOT_OFFICIAL',
      institutionalAuthentication:false,intensity:'SYNTHETIC',certainty:'NOT_ASSESSED',
      polygon:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]],permissionPolicy:'OPT_IN',
      activation:'EXERCISE_ONLY',expiresAfterSeconds:3600,cancellation:'RESET_EXERCISE'},
    assumptions:{geometry:'NORMALIZED_VIRTUAL_UNITS',radioRange:range,bluetooth,wifi,gateway,
      realRadio:false,realSatellite:false,authorityVerification:false,encryption:false,live112:false,
      energyMeasured:false,latencyMeasured:false,ack:'SYNTHETIC_GATEWAY_RECEIPT_ONLY'},
    summary,devices,routes,audit:[
      {event:'EXERCISE_CREATED',detail:'No official alert or emergency dispatch'},
      {event:'CAPABILITY_POLICY',detail:`${usable.length} consented virtual devices can relay`},
      {event:'SIMULATED_DELIVERY',detail:`${ack} synthetic gateway ACK, ${messages.length-ack} queued`},
      {event:'HUMAN_SAFETY',detail:`${sos} explicit SOS, ${summary.humanUnknown} UNKNOWN; silence never implies injury`}
    ]
  };
}

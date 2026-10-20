/**
 * Bounded, deterministic, EXERCISE-ONLY store-and-forward coordinator.
 * This is NOT a radio, institutional alert service, authenticated receipt, or 112 interface.
 * Existing packages/core dispatcher remains untouched.
 */
const RESPONSES=new Set(['SAFE','SOS_EXPLICIT','OTHERS_AFFECTED','CANNOT_DETERMINE']);
const TERMINAL=new Set(['ACK_SYNTHETIC','EXPIRED','REVOKED','EXHAUSTED']);
const json=(v)=>JSON.parse(JSON.stringify(v));
const stable=(v)=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
const isNumber=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;
function validate(input,now){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid envelope');
  const {id,category,createdAt=now,ttlSeconds=3600,consented,destination='LAB_CENTRE',payload={}}=input;
  if(typeof id!=='string'||!/^[A-Z0-9_-]{1,64}$/.test(id))throw Error('Invalid exercise message ID');
  if(!RESPONSES.has(category))throw Error('An explicit response category is required');
  if(consented!==true)throw Error('Explicit consent required');
  if(typeof destination!=='string'||!/^LAB_[A-Z0-9_]{1,40}$/.test(destination))
    throw Error('Only synthetic laboratory destinations allowed');
  if(!Number.isSafeInteger(createdAt)||createdAt>now+60000||createdAt<0)
    throw Error('Invalid createdAt');
  if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>86400)
    throw Error('Invalid message lifetime');
  let detached;
  try{detached=json(payload);}catch{throw Error('Payload must be JSON serializable');}
  if(detached===undefined||stable(detached).length>4096)throw Error('Invalid or oversized payload');
  return {id,category,createdAt,ttlSeconds,consented:true,destination,payload:detached,
    provenance:'SYNTHETIC_EXERCISE_ONLY'};
}
export function createStoreForwardEngine({now=()=>Date.now(),retryMs=2000,maxAttempts=4,maxEntries=1000,
  energyProfile='ALERT'}={}){
  if(typeof now!=='function'||!Number.isSafeInteger(retryMs)||retryMs<1||
     !Number.isSafeInteger(maxAttempts)||maxAttempts<1||
     !Number.isSafeInteger(maxEntries)||maxEntries<1)throw Error('Invalid engine settings');
  const adapters=new Map(),records=new Map(),events=[],inFlight=new Set();
  const audit=(id,event,detail='')=>{
    events.push({at:now(),id,event,detail});
    if(events.length>1000)events.shift();
  };
  const view=(r)=>r?{id:r.id,category:r.category,status:r.status,attempts:r.attempts,
    nextAttemptAt:r.nextAttemptAt,selectedTransport:r.selectedTransport,
    evidence:'SIMULATED_ONLY',receiptKind:r.receiptKind||null,hasPayload:r.envelope!==null}:null;
  const expire=(r)=>{
    if(r.envelope&&now()>=r.envelope.createdAt+r.envelope.ttlSeconds*1000){
      r.status='EXPIRED';r.envelope=null;r.nextAttemptAt=null;audit(r.id,'EXPIRED','Payload cleared');
    }
  };
  const chooseScore=(d,category)=>{
    const urgency=category==='SOS_EXPLICIT'?2:1;
    return 100*d.reliability-urgency*(d.latencyMs/100)-d.energyCost*12-d.monetaryCost*4;
  };
  return {
    registerAdapter(adapter){
      if(!adapter||adapter.kind!=='SIMULATOR_ADAPTER'||adapter.evidence!=='SIMULATED'||
        typeof adapter.id!=='string'||!/^[A-Z0-9_-]{1,40}$/.test(adapter.id)||
        typeof adapter.describe!=='function'||typeof adapter.send!=='function')
        throw Error('Only explicitly simulated TransportAdapter implementations accepted');
      if(adapters.has(adapter.id))throw Error('Duplicate transport ID');
      adapters.set(adapter.id,adapter);
    },
    enqueue(input){
      const envelope=validate(input,now()),id=envelope.id,prior=records.get(id);
      if(prior){
        if(!prior.envelope)throw Error('Terminal message ID cannot be reused');
        if(stable(prior.envelope)!==stable(envelope))throw Error('Conflicting duplicate message ID');
        audit(id,'DEDUPLICATED');return view(prior);
      }
      if(records.size>=maxEntries)throw Error('Exercise queue full; fail closed');
      // Keep one active payload copy only; finalized IDs remain payload-free tombstones.
      const r={id,category:envelope.category,envelope,
        status:'QUEUED',attempts:0,nextAttemptAt:now(),selectedTransport:null,receiptKind:null};
      if(now()>=envelope.createdAt+envelope.ttlSeconds*1000)
        throw Error('Expired envelope cannot be enqueued');
      records.set(id,r);audit(id,'ENQUEUED');return view(r);
    },
    async dispatch(id){
      const r=records.get(id);
      if(!r)throw Error('Unknown message');
      expire(r);
      if(TERMINAL.has(r.status)||inFlight.has(id)||now()<r.nextAttemptAt)return view(r);
      if(energyProfile==='CRITICAL'&&r.category!=='SOS_EXPLICIT'){
        r.nextAttemptAt=now()+retryMs;audit(id,'ENERGY_HOLD');return view(r);
      }
      inFlight.add(id);
      try{
        const candidates=[];
        for(const a of adapters.values()){
          try{
            const d=await a.describe();
            if(d&&d.available===true&&d.permitted===true&&d.compatible===true&&d.secure===true&&
              isNumber(d.reliability,0,1)&&isNumber(d.latencyMs,0,600000)&&
              isNumber(d.energyCost,0,1)&&isNumber(d.monetaryCost,0,1)&&
              Number.isSafeInteger(d.capacity)&&d.capacity>0){
              candidates.push({a,score:chooseScore(d,r.category)});
            }
          }catch{audit(id,'ADAPTER_DESCRIPTION_FAILED',a.id);}
        }
        candidates.sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id));
        if(records.get(id)!==r)return view(r);
        expire(r); // Clock may have advanced while checking adapter availability.
        if(TERMINAL.has(r.status))return view(r);
        if(!candidates.length){
          r.nextAttemptAt=now()+retryMs;audit(id,'NO_COMPATIBLE_ROUTE');return view(r);
        }
        const selected=candidates[r.attempts%candidates.length].a;
        r.selectedTransport=selected.id;r.attempts++;
        const sent=await selected.send(json(r.envelope));
        if(records.get(id)!==r)return view(r);
        expire(r); // A late receipt must not revive an expired message.
        if(TERMINAL.has(r.status))return view(r);
        if(sent?.accepted===true&&sent?.receipt?.kind==='SIMULATED_RECEIVER_RECEIPT'&&
          sent.receipt.messageId===id&&sent.receipt.transportId===selected.id){
          r.status='ACK_SYNTHETIC';r.receiptKind='SIMULATED_RECEIVER_RECEIPT';
          r.envelope=null;r.nextAttemptAt=null;
          audit(id,'SIMULATED_RECEIPT','Never implies human rescue, physical delivery or cryptographic proof');
          return view(r);
        }
        r.status=sent?.accepted===true?'FORWARDED_UNCONFIRMED':'QUEUED';
        audit(id,r.status,selected.id);
      }catch{
        if(records.get(id)===r){
          expire(r);
          if(!TERMINAL.has(r.status)){
            r.status='QUEUED';audit(id,'ADAPTER_SEND_FAILED',r.selectedTransport||'');
          }
        }
      }finally{
        inFlight.delete(id);
        if(records.get(id)===r&&!TERMINAL.has(r.status)){
          expire(r);
        }
        if(records.get(id)===r&&!TERMINAL.has(r.status)){
          if(r.attempts>=maxAttempts){
            r.status='EXHAUSTED';r.envelope=null;r.nextAttemptAt=null;
            audit(id,'EXHAUSTED','Payload cleared; no delivery claim');
          }else r.nextAttemptAt=now()+retryMs*2**(r.attempts-1);
        }
      }
      return view(r);
    },
    async retryDue(){
      const outcomes=[];
      for(const r of records.values()){
        expire(r);
        if(!TERMINAL.has(r.status)&&now()>=r.nextAttemptAt)
          outcomes.push(await this.dispatch(r.id));
      }
      return outcomes;
    },
    revoke(id){
      const r=records.get(id);if(!r)return false;
      r.envelope=null;r.status='REVOKED';r.nextAttemptAt=null;
      audit(id,'REVOKED','Exercise payload cleared');return true;
    },
    purge(id){const deleted=records.delete(id);if(deleted){for(let i=events.length-1;i>=0;i--)if(events[i].id===id)events.splice(i,1);}return deleted;},
    inspect(id){const r=records.get(id);if(r)expire(r);return view(r);},
    snapshot(){return [...records.values()].map(r=>{expire(r);return view(r);});},
    audit(){return json(events);}
  };
}
/** Lab-only fake adapter; its receipt is simulated, not a cryptographic or field-tested ACK. */
export function createInMemoryAdapter({id='LAB_GATEWAY',available=true,receipts=true,
  failures=0,reliability=.8,latencyMs=100,energyCost=.2,monetaryCost=0}={}){
  let enabled=available,remaining=failures;const received=[];
  return {
    id,kind:'SIMULATOR_ADAPTER',evidence:'SIMULATED',
    setAvailable(v){enabled=Boolean(v);},
    describe:async()=>({available:enabled,permitted:true,compatible:true,secure:true,
      reliability,latencyMs,energyCost,monetaryCost,capacity:1}),
    async send(envelope){
      if(!enabled)return {accepted:false};
      if(remaining>0){remaining--;return {accepted:false};}
      // Record only non-sensitive test metadata. This does not imply remote deletion.
      received.push({id:envelope.id,provenance:'SYNTHETIC_EXERCISE_ONLY'});
      return {accepted:true,...(receipts?{receipt:{kind:'SIMULATED_RECEIVER_RECEIPT',
        messageId:envelope.id,transportId:id}}:{})};
    },
    getReceived:()=>json(received)
  };
}

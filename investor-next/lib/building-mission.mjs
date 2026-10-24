import {createStoreForwardEngine,createInMemoryAdapter} from './store-forward.mjs';

/** Visual exercise, driven by the real local queue; every link and receipt is synthetic.
 * advance() advances ANIMATION, never claims measured network latency.
 */
export function createBuildingMission({model,sourceId,onChange=()=>{},now=Date.now}={}){
  let currentModel=model,id=null,pending=null,cursor=0,path=[],busy=false,disposed=false,revision=0;
  let state='IDLE',reason='CHOOSE_RESPONSE';
  const events=[];
  const route=()=>currentModel?.routes.find(r=>r.source===sourceId);
  const device=()=>currentModel?.devices.find(d=>d.id===sourceId);
  const engine=createStoreForwardEngine({now,retryMs:1,maxAttempts:8,maxEntries:1,operationTimeoutMs:30000});
  const adapter=createInMemoryAdapter({id:'BUILDING_MODEL',latencyMs:0});
  adapter.describe=async()=>({available:Boolean(route()?.path.length),permitted:true,compatible:true,secure:true,
    reliability:1,latencyMs:0,energyCost:0,monetaryCost:0,capacity:1});
  const snapshot=()=>({state,reason,messageId:id,sourceId,path:[...path],cursor,busy,
    receipt:state==='RECEIVED'?'SIMULATED_RECEIVER_RECEIPT':null,
    evidence:'SIMULATED_ONLY',record:id?engine.inspect(id):null,events:events.map(e=>({...e}))});
  const publish=(event)=>{
    if(disposed)return;
    if(event){events.push({step:events.length+1,event});if(events.length>24)events.shift();}
    onChange(snapshot());
  };
  adapter.send=(_envelope,{signal})=>new Promise(resolve=>{
    path=[...(route()?.path||[])];cursor=0;state='IN_TRANSIT';reason='FOLLOW_MESSAGE';
    const finish=value=>{signal.removeEventListener('abort',abort);if(pending?.finish===finish)pending=null;resolve(value);};
    const abort=()=>finish({accepted:false});
    pending={finish,signal};signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){abort();return;}
    publish('FORWARDING_STARTED');
  });
  engine.registerAdapter(adapter);
  const dispatch=async()=>{
    if(!id||busy||disposed)return snapshot();
    const run=revision;busy=true;state='QUEUED';reason='LOOKING_FOR_ROUTE';publish('QUEUED_LOCAL');
    try{
      const record=await engine.dispatch(id);
      if(run!==revision||disposed)return snapshot();
      state=record.status==='ACK_SYNTHETIC'?'RECEIVED':record.status==='EXPIRED'?'EXPIRED':
        record.status==='REVOKED'?'IDLE':record.status==='EXHAUSTED'?'EXHAUSTED':'QUEUED';
      reason=state==='RECEIVED'?'MODEL_RECEIPT_ONLY':state==='QUEUED'?(reason==='LINK_CHANGED_RETRY'?reason:'NO_ROUTE_KEEP_MESSAGE'):state;
      busy=false;publish(state==='RECEIVED'?'RECEIVER_ACK_MATCHED':state);
    }catch{
      if(run===revision&&!disposed){busy=false;state='QUEUED';reason='RETRY_REQUIRED';publish('SEND_ERROR');}
    }
    return snapshot();
  };
  return {
    snapshot,
    refresh(){
      const record=id?engine.inspect(id):null;
      if(record?.status==='EXPIRED'&&state!=='EXPIRED'){state='EXPIRED';reason='EXPIRED';busy=false;publish('EXPIRED');}
      return snapshot();
    },
    async start(){
      if(disposed||busy)return snapshot();
      const d=device();
      if(!d?.participating||!['SAFE','SOS_EXPLICIT'].includes(d.humanStatus)){
        state='IDLE';reason='CHOOSE_RESPONSE';publish();return snapshot();
      }
      if(id)return dispatch();
      id=`MISSION_${globalThis.crypto.randomUUID().toUpperCase()}`;
      engine.enqueue({id,category:d.humanStatus,consented:true,destination:'LAB_CENTRE',
        payload:{fictionalTerminal:sourceId},ttlSeconds:60});
      return dispatch();
    },
    advance(){
      if(!pending||disposed)return snapshot();
      cursor=Math.min(cursor+1,path.length-1);
      publish('VISUAL_HOP');
      if(cursor===path.length-1){
        const finish=pending.finish;
        finish({accepted:true,receipt:{kind:'SIMULATED_RECEIVER_RECEIPT',messageId:id,transportId:'BUILDING_MODEL'}});
      }
      return snapshot();
    },
    updateModel(next){
      currentModel=next;
      if(pending){
        const nextPath=route()?.path||[];
        if(JSON.stringify(nextPath)!==JSON.stringify(path)){
          pending.finish({accepted:false});state='QUEUED';reason='LINK_CHANGED_RETRY';publish('LINK_CHANGED');
        }
      }else if(state==='QUEUED')publish('CONDITIONS_CHANGED');
    },
    stop(){
      revision++;
      if(id)engine.purge(id);
      id=null;path=[];cursor=0;busy=false;state='IDLE';reason='CLEARED';events.length=0;
      publish();return snapshot();
    },
    dispose(){this.stop();disposed=true;}
  };
}

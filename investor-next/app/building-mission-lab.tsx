'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Locale} from './copy';
import EmergencyBuilding from './emergency-building';
import {buildingMissionCopy} from './building-mission-copy';
import {runScenario,type ScenarioParameters,type HumanStatus} from '../lib/emergency-routing.mjs';
import {createBuildingMission,type BuildingMission,type BuildingMissionState} from '../lib/building-mission.mjs';

const defaults:ScenarioParameters={devices:40,seed:20261020,participation:100,permissions:100,battery:65,
 damaged:100,responses:8,helpRequests:2,bluetooth:true,wifi:true,gateway:true};
const responses:HumanStatus[]=['SAFE','SOS_EXPLICIT','UNKNOWN'];

export default function BuildingMissionLab({locale}:{locale:Locale}){
 const t=buildingMissionCopy[locale];
 const [params,setParams]=useState(defaults);
 const [sourceId,setSourceId]=useState('NODE-001');
 const [answer,setAnswer]=useState<HumanStatus>('UNKNOWN');
 const [phase,setPhase]=useState(0),[floor,setFloor]=useState<number|null>(null);
 const [automatic,setAutomatic]=useState(true),[speed,setSpeed]=useState(1),[touring,setTouring]=useState(false);
 const [mission,setMission]=useState<BuildingMissionState|null>(null);
 const scene=useRef<HTMLDivElement>(null);
 const controller=useRef<BuildingMission|null>(null);
 const model=useMemo(()=>runScenario({...params,responsesByNode:{[sourceId]:answer}}),[params,sourceId,answer]);
 const latestModel=useRef(model);latestModel.current=model;
 useEffect(()=>{
   let active=true;
   const trial=createBuildingMission({model:latestModel.current,sourceId,onChange:value=>{if(active)setMission(value);}});
   controller.current=trial;setMission(trial.snapshot());
   return ()=>{active=false;trial.dispose();controller.current=null;};
 },[sourceId]);
 useEffect(()=>{controller.current?.updateModel(model);},[model]);
 useEffect(()=>{
   if(mission?.state==='IN_TRANSIT')setPhase(2);
   if(mission?.state==='QUEUED')setPhase(1);
   if(mission?.state==='RECEIVED')setPhase(3);
 },[mission?.state]);
 useEffect(()=>{
   if(mission?.state!=='IN_TRANSIT'||!automatic)return;
   const timer=window.setInterval(()=>controller.current?.advance(),[1500,950,500][speed]);
   return ()=>window.clearInterval(timer);
 },[mission?.state,automatic,speed]);
 useEffect(()=>{
   if(!touring||answer!=='SOS_EXPLICIT')return;
   const timer=window.setTimeout(()=>{setTouring(false);setPhase(1);void controller.current?.start();},900);
   return ()=>window.clearTimeout(timer);
 },[touring,answer]);
 useEffect(()=>{
   if(!mission?.messageId||!['IN_TRANSIT','QUEUED'].includes(mission.state))return;
   const timer=window.setInterval(()=>controller.current?.refresh(),1000);
   return ()=>window.clearInterval(timer);
 },[mission?.messageId,mission?.state]);
 const selected=model.devices.find(d=>d.id===sourceId)!;
 const state=mission?.state??'IDLE';
 const queued=state==='QUEUED';
 const received=state==='RECEIVED';
 const ended=state==='EXPIRED'||state==='EXHAUSTED';
 const select=(id:string)=>{
   if(id===sourceId)return;
   controller.current?.stop();setTouring(false);setSourceId(id);setAnswer('UNKNOWN');setPhase(1);
 };
 const respond=(status:HumanStatus)=>{controller.current?.stop();setTouring(false);setAnswer(status);setPhase(1);};
 const stop=()=>{setTouring(false);controller.current?.stop();setAnswer('UNKNOWN');setPhase(0);};
 const preset=(index:number)=>{
   setTouring(false);
   setParams({...defaults,gateway:index!==1,permissions:index===2?0:100,battery:index===3?10:65});
 };
 const blocked=mission?.reason==='LINK_CHANGED_RETRY'?t.changed:params.permissions===0?t.permissionBlocked:
   Number(params.battery)<=15?t.criticalBlocked:model.routes.find(r=>r.source===sourceId)?.path.length?t.retryTimeout:t.noRoute;
 const showScene=()=>{if(window.matchMedia('(max-width: 780px)').matches)scene.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 const start=()=>{setTouring(false);setAutomatic(true);void controller.current?.start();showScene();};
 const guided=()=>{
   controller.current?.stop();setParams(defaults);setSourceId('NODE-001');setAnswer('SOS_EXPLICIT');
   setFloor(null);setAutomatic(true);setPhase(0);setTouring(true);showScene();
 };
 const download=()=>{
   const data={kind:'OEP_BUILDING_MISSION_SIMULATED',physicalDelivery:false,seed:model.seed,
     assumptions:params,fictionalResponse:{sourceId,answer},trial:controller.current?.snapshot()};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='oep-building-mission-simulated.json';link.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <div className="bml" data-testid="building-mission">
  <div className="bml-intro"><div><p className="eyebrow">{t.eyebrow}</p><h2 id="mer-title">{t.title}</h2><p>{t.intro}</p></div>
   <span className="bml-simulation"><i/>{t.badge}</span></div>
  <div className="bml-presets" role="group" aria-label={t.scenario}>{t.presets.map((label,index)=><button key={label} type="button"
    onClick={()=>preset(index)} data-testid={`mission-preset-${index}`} aria-pressed={index===0?params.gateway!==false&&params.permissions===100&&params.battery===65:index===1?params.gateway===false:index===2?params.permissions===0:Number(params.battery)<=15}>{label}</button>)}</div>
  <div className="bml-workspace">
   <div className="bml-scene" ref={scene}>
    <div className="bml-scene-head"><span>{t.view}</span><span>{t.floor} {selected.floor+1} · {sourceId.replace('NODE-','N·')}</span></div>
    <div className={`bml-scene-status is-${state.toLowerCase()}`} aria-hidden="true">{t.sceneStates[state as keyof typeof t.sceneStates]}{state==='IN_TRANSIT'&&` · ${mission?.cursor??0}/${(mission?.path.length??1)-1}`}</div>
    <EmergencyBuilding model={model} stage={phase} selectedId={sourceId} onSelect={select} floor={floor}
      mission={mission} playing={automatic} hopDuration={[1500,950,500][speed]} locale={locale}/>
    <div className="bml-floors" role="group" aria-label={t.floor}>
     <button type="button" aria-pressed={floor===null} onClick={()=>setFloor(null)}>{t.allFloors}</button>
     {[4,3,2,1,0].map(n=><button key={n} type="button" aria-pressed={floor===n} onClick={()=>setFloor(floor===n?null:n)}>{t.floor} {n+1}</button>)}
    </div>
    <div className="bml-endpoint-labels" aria-hidden="true"><span>{t.mobileOff}</span><span className={params.gateway===false?'is-off':''}>{params.gateway===false?t.outsideOff:t.outsideOn}</span></div>
    <div className="bml-legend"><span><i className="is-unknown"/>{t.unknown}</span><span><i className="is-safe"/>{t.safe}</span><span><i className="is-sos"/>{t.sos}</span></div>
   </div>
   <div className="bml-console">
    <p className="bml-step-caption">{String(phase+1).padStart(2,'0')} / 04 · {t.steps[phase]}</p>
    <h3>{t.stepTitles[phase]}</h3><p className="bml-explanation">{t.stepDescriptions[phase]}</p>
    <label className="bml-device"><span>{t.terminal}</span><select data-testid="mission-source" value={sourceId} onChange={e=>select(e.currentTarget.value)}>
     {model.devices.filter(d=>floor===null||d.floor===floor).concat(floor!==null&&selected.floor!==floor?[selected]:[]).map(d=><option key={d.id} value={d.id}>{d.id} · {t.floor} {d.floor+1}</option>)}
    </select><small>{t.pick}</small></label>
    <fieldset className="bml-responses"><legend>{t.response}</legend>{responses.map((response,index)=><button type="button" key={response}
      aria-pressed={answer===response} className={response==='SOS_EXPLICIT'?'is-help':''} onClick={()=>respond(response)} data-testid={`mission-response-${response}`}>{t.answers[index]}</button>)}</fieldset>
    <button className="bml-primary" type="button" data-testid="mission-send" disabled={answer==='UNKNOWN'||Boolean(mission?.busy)||touring}
      onClick={received||ended?()=>{controller.current?.stop();setAnswer('UNKNOWN');setPhase(1);}:start}>{received||ended?t.again:queued?t.retry:t.send}<span aria-hidden="true">↗</span></button>
    {answer==='UNKNOWN'&&<p className="bml-hint">{t.noResponse}</p>}
    {state==='IDLE'&&<button type="button" className="bml-tour" data-testid="mission-tour" onClick={guided} disabled={touring}>{t.tour}<span aria-hidden="true"> ▷</span></button>}
   </div>
  </div>
  <nav className="bml-phases" aria-label={t.progress}>{t.steps.map((label,index)=><button key={label} type="button" aria-current={phase===index?'step':undefined}
    className={phase===index?'is-current':''} onClick={()=>setPhase(index)}><span>{String(index+1).padStart(2,'0')}</span>{label}<i aria-hidden="true">{index<3?'→':received?'✓':'○'}</i></button>)}</nav>
  <div className={`bml-delivery is-${state.toLowerCase()}`}>
   <div className="bml-status" role="status" aria-live="polite" data-testid="mission-status" data-state={state}>
    <span className="bml-status-light"/><div><strong>{ended?(state==='EXPIRED'?t.expired:t.exhausted):received?t.received:queued?t.queued:state==='IN_TRANSIT'?t.moving:t.idle}</strong>
     <p>{ended?t.noResponse:received?t.finish:queued?blocked:mission?.messageId?`${t.terminal}: ${sourceId}`:t.noResponse}</p></div>
   </div>
   <div className="bml-counters"><div><span>{t.queueLabel}</span><strong>{mission?.record?.hasPayload?1:0}</strong></div>
    <div><span>{t.hopLabel}</span><strong>{mission?.path.length?`${mission.cursor} / ${mission.path.length-1}`:'—'}</strong></div>
    <div><span>{t.receiptLabel}</span><strong data-testid="mission-receipt">{received?t.yes:t.notYet}</strong></div></div>
  </div>
  <div className="bml-route"><h4>{t.route}</h4>{mission?.path.length?<ol>{mission.path.map((id,index)=><li key={`${id}-${index}`} className={index<=mission.cursor?'is-reached':''}>
    <span>{index===0?'◉':id==='GATEWAY'||id==='CENTRE_MODEL'?'▣':'○'}</span><div><strong>{id==='GATEWAY'||id==='CENTRE_MODEL'?t.receiver:id==='CELLULAR_MODEL'?'CELLULAR':id}</strong><small>{index===0?t.inPhone:id==='GATEWAY'||id==='CENTRE_MODEL'?(received?t.yes:t.notYet):t.relay}</small></div>
   </li>)}</ol>:<p>{t.none}</p>}</div>
  <div className="bml-transport-controls"><div><h4>{t.connection}</h4>
   <label><input data-testid="mission-gateway" type="checkbox" checked={params.gateway!==false} onChange={e=>{const value=e.currentTarget.checked;setTouring(false);setParams(p=>({...p,gateway:value}));}}/>{t.gateway}</label>
   <label><input data-testid="mission-permission" type="checkbox" checked={params.permissions===100} onChange={e=>{const value=e.currentTarget.checked;setTouring(false);setParams(p=>({...p,permissions:value?100:0}));}}/>{t.grant}</label>
   <label><input type="checkbox" checked={params.wifi!==false} onChange={e=>{const value=e.currentTarget.checked;setTouring(false);setParams(p=>({...p,wifi:value}));}}/>{t.wifi}</label>
   <label><input type="checkbox" checked={params.bluetooth!==false} onChange={e=>{const value=e.currentTarget.checked;setTouring(false);setParams(p=>({...p,bluetooth:value}));}}/>{t.bluetooth}</label>
   <label className="bml-battery">{t.battery}<strong>{params.battery}%</strong><input data-testid="mission-battery" type="range" min="5" max="100" step="5" value={Number(params.battery)} onChange={e=>{const value=Number(e.currentTarget.value);setTouring(false);setParams(p=>({...p,battery:value}));}}/></label>
  </div><div className="bml-playback"><label>{t.speed}<select value={speed} onChange={e=>setSpeed(Number(e.currentTarget.value))}>{t.speedChoices.map((label,index)=><option key={label} value={index}>{label}</option>)}</select></label>
   <button type="button" data-testid="mission-pause" disabled={state!=='IN_TRANSIT'} onClick={()=>setAutomatic(v=>!v)}>{automatic?t.pause:t.resume}</button>
   <button type="button" data-testid="mission-next-hop" disabled={state!=='IN_TRANSIT'} onClick={()=>{setAutomatic(false);controller.current?.advance();}}>{t.next}</button>
   <button className="bml-stop" type="button" data-testid="mission-stop" onClick={stop}>{t.clear}</button>
  </div></div>
  <details className="bml-evidence"><summary>{t.details}</summary><p>{t.limits} {t.lifetime}</p><h4>{t.why}</h4><ol>{mission?.events.map((event,index)=><li key={`${index}-${event.event}`}>{t.events[event.event as keyof typeof t.events]??event.event}</li>)}</ol>
   {mission?.messageId&&<code>{mission.messageId} · SIMULATED_ONLY</code>}<button type="button" onClick={download}>{t.export}</button></details>
 </div>;
}

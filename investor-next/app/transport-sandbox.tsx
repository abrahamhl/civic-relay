'use client';
import {useEffect,useState} from 'react';
import {createStoreForwardEngine,createInMemoryAdapter} from '../lib/store-forward.mjs';
import type {LabStatusRecord} from '../lib/store-forward.mjs';
import type {Locale} from './copy';

/** A second, independent exercise fixture; never uses real emergency identities, radios or services. */
const words={
 en:{title:'STORE & FORWARD / REAL CODE, SYNTHETIC TRANSPORT',desc:'Exercise the actual queue, dedup, TTL, retries and receipt validation code. The gateway is an in-memory fake, not a satellite or emergency centre.',
  send:'GENERATE SYNTHETIC SOS',retry:'RETRY QUEUE',clear:'CLEAR LAB DATA',empty:'No test messages yet',transport:'LAB GATEWAY',enabled:'MODELED ONLINE',disabled:'MODELED OFFLINE',status:'QUEUE STATE',receipt:'SIMULATED RECEIPT ONLY'},
 es:{title:'COLA Y REENVÍO / CÓDIGO REAL, TRANSPORTE SIMULADO',desc:'Ejecuta la cola, deduplicación, caducidad, reintentos y validación de recibos. El gateway solo existe en memoria: no es un satélite ni un centro real.',
  send:'GENERAR SOS FICTICIO',retry:'REINTENTAR COLA',clear:'BORRAR DATOS DE PRUEBA',empty:'Aún no hay mensajes de prueba',transport:'GATEWAY DE LABORATORIO',enabled:'EN LÍNEA SIMULADO',disabled:'SIN CONEXIÓN SIMULADA',status:'ESTADO DE LA COLA',receipt:'RECIBO SOLO SIMULADO'},
 nl:{title:'OPSLAAN EN DOORSTUREN / ECHTE CODE, VIRTUEEL TRANSPORT',desc:'Test de wachtrij, ontdubbeling, vervaltijd, nieuwe pogingen en ontvangstcontrole. De gateway bestaat uitsluitend in geheugen.',
  send:'MAAK FICTIEVE SOS',retry:'PROBEER OPNIEUW',clear:'VERWIJDER TESTDATA',empty:'Nog geen testberichten',transport:'TESTGATEWAY',enabled:'VIRTUEEL ONLINE',disabled:'VIRTUEEL OFFLINE',status:'WACHTRIJSTATUS',receipt:'ALLEEN GESIMULEERDE ONTVANGST'}
} as const;
export default function TransportSandbox({locale,gatewayAvailable}:{locale:Locale;gatewayAvailable:boolean}){
 const t=words[locale];
 const [lab]=useState(()=>{
  const engine=createStoreForwardEngine({retryMs:2000,maxAttempts:4,maxEntries:20});
  const adapter=createInMemoryAdapter({id:'LAB_GATEWAY',available:gatewayAvailable});
  engine.registerAdapter(adapter);
  return {engine,adapter};
 });
 const [serial,setSerial]=useState(0);
 const [records,setRecords]=useState<LabStatusRecord[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{lab.adapter.setAvailable(gatewayAvailable);},[lab,gatewayAvailable]);
 const refresh=()=>setRecords(lab.engine.snapshot());
 const send=async()=>{
  if(busy)return;setBusy(true);setError('');
  try{
   const id='EXERCISE_'+String(serial+1).padStart(4,'0');
   lab.engine.enqueue({id,category:'SOS_EXPLICIT',consented:true,destination:'LAB_CENTRE',
    payload:{fictionalNode:true},ttlSeconds:60});
   setSerial(v=>v+1);
   await lab.engine.dispatch(id);refresh();
  }catch(e){setError(String(e));}finally{setBusy(false);}
 };
 const retry=async()=>{
  if(busy)return;setBusy(true);setError('');
  try{await lab.engine.retryDue();refresh();}catch(e){setError(String(e));}finally{setBusy(false);}
 };
 const clear=()=>{for(const r of lab.engine.snapshot())lab.engine.purge(r.id);refresh();};
 return <section className="mer-forward-lab" aria-label={t.title}>
  <div className="mer-forward-head"><div><h3>{t.title}</h3><p>{t.desc}</p></div>
   <span className={gatewayAvailable?'mer-gateway-up':'mer-gateway-down'}>{t.transport}: {gatewayAvailable?t.enabled:t.disabled}</span>
  </div>
  <div className="mer-tools">
   <button type="button" data-testid="sandbox-send-sos" disabled={busy} onClick={()=>{void send();}}>{t.send}</button>
   <button type="button" data-testid="sandbox-retry-queue" disabled={busy||!records.length} onClick={()=>{void retry();}}>{t.retry}</button>
   <button type="button" data-testid="sandbox-clear-data" disabled={busy||!records.length} onClick={clear}>{t.clear}</button>
  </div>
  <div aria-live="polite" className="mer-forward-results"><strong>{t.status}</strong>
   {records.length===0?<p>{t.empty}</p>:<ul>{records.slice(-5).reverse().map(r=>
    <li key={r.id}><code>{r.id}</code><span>{r.status}</span><small>{r.attempts} attempt(s) · {r.evidence}</small></li>
   )}</ul>}
   {error&&<p role="alert">{error}</p>}
  </div>
  <small className="mer-warning">{t.receipt} · NO 112 · NO REAL TRANSPORT</small>
 </section>;
}

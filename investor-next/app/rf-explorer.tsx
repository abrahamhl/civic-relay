'use client';
import {useEffect,useRef,useState} from 'react';
import {createBrowserSensors,type BrowserSensors,type SensorKind,type SensorState} from '../lib/browser-sensors.mjs';
import type {Locale} from './copy';

const kinds:SensorKind[]=['camera','microphone','geolocation','bluetooth','serial','usb','connectivity'];
const copy={
 es:{title:'RF Explorer · sensores y procedencia',lead:'Cada conexión requiere una acción tuya. La cámara muestra luz visible; el micrófono capta sonido. Ninguno detecta personas tras paredes ni mide RF. No se guardan ni envían estas muestras.',
 labels:['Cámara','Micrófono','Ubicación','Bluetooth BLE autorizado','Puerto serie','USB compatible','Conectividad del navegador'],
 start:'Autorizar',stop:'STOP · liberar todos los sensores',empty:'Sin medición',hardware:'HARDWARE_REQUIRED · Espectro RF, RSSI y CSI requieren un receptor y un protocolo compatibles. El contrato de laboratorio está probado con fixtures; no hay driver RTL-SDR/CSI conectado.',
 evidence:'Consultar límites y pruebas'},
 en:{title:'RF Explorer · sensors and provenance',lead:'Each connection requires your action. The camera captures visible light; the microphone captures sound. Neither detects people through walls or measures RF. These samples are not stored or transmitted.',
 labels:['Camera','Microphone','Location','Authorized Bluetooth BLE','Serial port','Compatible USB','Browser connectivity'],
 start:'Authorize',stop:'STOP · release all sensors',empty:'No measurement',hardware:'HARDWARE_REQUIRED · RF spectra, RSSI and CSI need a compatible receiver and protocol. The lab contract is fixture-tested; no RTL-SDR/CSI driver is connected.',
 evidence:'Review limits and tests'},
 nl:{title:'RF Explorer · sensoren en herkomst',lead:'Elke verbinding vereist jouw actie. De camera registreert zichtbaar licht; de microfoon registreert geluid. Ze detecteren geen personen achter muren en meten geen RF. Deze metingen worden niet opgeslagen of verzonden.',
 labels:['Camera','Microfoon','Locatie','Toegestane Bluetooth BLE','Seriële poort','Compatibele USB','Browserverbinding'],
 start:'Toestaan',stop:'STOP · alle sensoren vrijgeven',empty:'Geen meting',hardware:'HARDWARE_REQUIRED · RF-spectra, RSSI en CSI vereisen een compatibele ontvanger en protocol. Het labcontract is met fixtures getest; er is geen RTL-SDR/CSI-driver verbonden.',
 evidence:'Bekijk beperkingen en tests'}
};

export default function RfExplorer({locale}:{locale:Locale}) {
 const t=copy[locale];
 const controller=useRef<BrowserSensors|null>(null);
 const video=useRef<HTMLVideoElement|null>(null);
 const [states,setStates]=useState<Partial<Record<SensorKind,SensorState>>>({});
 useEffect(()=>{
   let mounted=true;
   const sensors=createBrowserSensors({onChange:value=>{if(mounted)setStates(prev=>({...prev,[value.kind]:value}));}});
   controller.current=sensors;
   for(const kind of kinds)sensors.stop(kind);
   return ()=>{mounted=false;sensors.stopAll();controller.current=null;};
 },[]);
 useEffect(()=>{
   if(video.current)video.current.srcObject=states.camera?.resource??null;
 },[states.camera]);
 return <div className="oep-ts-block oep-rf-explorer" id="rf-explorer" data-testid="rf-explorer">
   <div className="oep-ts-block-head"><div><h3>{t.title}</h3><p>{t.lead}</p></div></div>
   <p className="oep-ts-auth-banner">{t.hardware}</p>
   <button type="button" className="button-outline" onClick={()=>controller.current?.stopAll()}>{t.stop}</button>
   <div className="oep-ts-fn-grid">
    {kinds.map((kind,index)=>{
      const state=states[kind];
      return <article className="oep-ts-fn-card" key={kind}>
       <h4>{t.labels[index]}</h4>
       <p role="status" data-testid={`sensor-${kind}-status`}>{state?.state??'UNKNOWN'}</p>
       <button type="button" className="button-outline" disabled={!state||state.state==='UNSUPPORTED'||state.state==='PERMISSION_PENDING'}
         onClick={()=>void controller.current?.request(kind,{consent:true})}>{t.start} · {t.labels[index]}</button>
       <p>{state?.sample?JSON.stringify(state.sample):t.empty}</p>
       <small>{state?.source??`browser:${kind}`} · {state?.unit??'—'} · {state?.timestamp??'—'} · {state?.confidence??'UNKNOWN'}</small>
       {state?.reason&&<p>{state.reason}</p>}
      </article>;
    })}
   </div>
   <video ref={video} autoPlay muted playsInline aria-label={t.labels[0]} hidden={states.camera?.state!=='DEVICE_CONNECTED'} style={{width:'100%',maxHeight:360,objectFit:'contain'}}/>
   <a className="text-cta" href="#evidence">{t.evidence} ↓</a>
 </div>;
}

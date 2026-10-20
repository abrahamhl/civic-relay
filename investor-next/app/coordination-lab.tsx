'use client';
import {useMemo,useState} from 'react';
import EmergencyBuilding from './emergency-building';
import {runScenario} from '../lib/emergency-routing.mjs';
import type {ScenarioParameters} from '../lib/emergency-routing.mjs';
import type {Locale} from './copy';
import './coordination-lab.css';

const words={
 en:{
  eyebrow:'FIELD RESEARCH / 20–100 SYNTHETIC DEVICES',title:'THE BUILDING IS DOWN. THE COORDINATION MODEL IS ON.',
  summary:'Change the assumptions; inspect synthetic routing decisions. Zero live alarms, zero physical measurements.',
  captions:['Earthquake','Example zone','Opt-in check','SAFE reply','UNKNOWN silence','Explicit SOS','Cellular outage','Local discovery','Gateway route','Coordination centre','Indoor uncertainty','Baseline comparison'],
  descriptions:[
   'A synthetic earthquake damages a virtual five-storey building.',
   'An EXERCISE_ONLY alert is displayed. No official authority is impersonated.',
   'Participating devices receive a modelled status request. Nonparticipants are excluded.',
   'A person explicitly answers SAFE, without implying any broader safety estimate.',
   'No answer means UNKNOWN — never automatically injured or trapped.',
   'A consenting person explicitly requests assistance; SOS is not inferred.',
   'The model removes cellular links according to its infrastructure failure assumption.',
   'Permissioned compatible nodes may relay modelled traffic; no phone radio is touched.',
   'Virtual hops can connect to an example outside gateway when the graph permits.',
   'Synthetic ACKs and queued SOS are listed, not rescue confirmations.',
   'Indoor floor and position are illustrative, not geolocated or triangulated.',
   'Compare direct cellular-only synthetic receipts with adaptive synthetic receipts.'
  ],
  controls:'SIMULATION INPUTS',results:'EXERCISE OUTCOME',participants:'PARTICIPATING',permissions:'PERMITTED',damage:'INFRASTRUCTURE FAILURE',
  battery:'BATTERY LEVEL',devices:'VIRTUAL NODES',responses:'SAFE RESPONSES',help:'EXPLICIT SOS',radios:'RADIOS IN MODEL',gateway:'EXTERNAL GATEWAY',
  active:'Enabled',off:'Disabled',safe:'SAFE',sos:'EXPLICIT SOS',unknown:'UNKNOWN',acks:'SYNTHETIC ACK',queued:'QUEUED',
  baseline:'CELLULAR-ONLY MODEL',adaptive:'ADAPTIVE MODEL',legend:'Orange = unknown · coral = explicit SOS · mint = SAFE',
  disclaimer:'No real Bluetooth, Wi-Fi, satellite, CAP authentication, triangulation or emergency service dispatch. A synthetic ACK means modelled gateway receipt only.',
  refresh:'RESET EXPERIMENT',audit:'TRACE OF MODEL DECISIONS',copy:'COPY REPRODUCIBLE INPUT'
 },
 es:{
  eyebrow:'LABORATORIO / 20–100 DISPOSITIVOS SINTÉTICOS',title:'EL EDIFICIO CAE. EL MODELO DE COORDINACIÓN CONTINÚA.',
  summary:'Cambia las hipótesis y observa las rutas calculadas. Sin alertas reales ni mediciones físicas.',
  captions:['Terremoto','Zona de ejemplo','Comprobación','Respuesta segura','Silencio UNKNOWN','SOS explícito','Corte celular','Descubrimiento local','Gateway exterior','Centro coordinador','Límite interior','Comparativa'],
  descriptions:[
   'Un terremoto simulado daña un edificio virtual de cinco plantas.',
   'Se muestra una alerta de EJERCICIO. Ninguna institución real la ha emitido.',
   'Solo los dispositivos participantes reciben la comprobación simulada.',
   'Una persona responde ESTOY BIEN; no permite concluir nada sobre otras personas.',
   'Una persona no contesta: UNKNOWN. No significa herida o atrapada.',
   'Una tercera persona solicita ayuda voluntariamente. No se infiere el SOS por silencio.',
   'La simulación elimina conexiones celulares según el porcentaje de daño elegido.',
   'Nodos compatibles y autorizados pueden retransmitir virtualmente; sin tocar radios reales.',
   'Los saltos virtuales alcanzan un gateway externo solo si existe ruta calculable.',
   'Se separan ACK sintéticos, mensajes en cola y solicitudes SOS humanas.',
   'Los pisos y posiciones son ilustrativos, sin geolocalización interior real.',
   'Compara las recepciones celulares simuladas frente al enrutamiento adaptativo.'
  ],
  controls:'PARÁMETROS DE SIMULACIÓN',results:'RESULTADOS DEL EJERCICIO',participants:'PARTICIPACIÓN',permissions:'PERMISOS',damage:'INFRAESTRUCTURA DAÑADA',
  battery:'BATERÍA',devices:'NODOS VIRTUALES',responses:'RESPUESTAS «BIEN»',help:'SOLICITUDES SOS',radios:'RADIOS DEL MODELO',gateway:'GATEWAY EXTERNO',
  active:'Activado',off:'Desactivado',safe:'ESTOY BIEN',sos:'SOS EXPLÍCITO',unknown:'DESCONOCIDO',acks:'ACK SINTÉTICOS',queued:'EN COLA',
  baseline:'SOLO CELULAR / MODELO',adaptive:'MODELO ADAPTATIVO',legend:'Ámbar = desconocido · coral = SOS · verde = bien',
  disclaimer:'Sin Bluetooth, Wi-Fi, satélite, autenticación CAP, triangulación ni envíos reales al 112. Los ACK son confirmaciones ficticias de recepción en el modelo.',
  refresh:'REINICIAR EJERCICIO',audit:'TRAZA DE DECISIONES',copy:'COPIAR PARÁMETROS'
 },
 nl:{
  eyebrow:'ONDERZOEKSLAB / 20–100 VIRTUELE APPARATEN',title:'HET GEBOUW STORT IN. DE COÖRDINATIE WORDT GESIMULEERD.',
  summary:'Wijzig aannames en bekijk berekende routes. Geen echte waarschuwingen of fysieke metingen.',
  captions:['Aardbeving','Oefenzone','Statuscheck','Veilig gemeld','Onbekend','Expliciete SOS','Mobiel netwerk uit','Lokale ontdekking','Gateway','Coördinatiecentrum','Binnenbeperking','Vergelijking'],
  descriptions:[
   'Een gesimuleerde aardbeving beschadigt een virtueel gebouw met vijf verdiepingen.',
   'Een OEFENMELDING verschijnt. Geen officiële instantie heeft die uitgegeven.',
   'Alleen deelnemende apparaten krijgen een gesimuleerd statusverzoek.',
   'Iemand meldt expliciet VEILIG; dat zegt niets over anderen.',
   'Geen antwoord betekent ONBEKEND; geen aanname over letsel.',
   'Een andere deelnemer vraagt vrijwillig om hulp. Stilte creëert nooit een SOS.',
   'Mobiele verbindingen verdwijnen afhankelijk van de ingestelde schade.',
   'Apparaten met toestemming simuleren lokale doorgeleiding; echte radio’s blijven onaangeroerd.',
   'Virtuele hops bereiken de voorbeeldgateway uitsluitend bij een berekende route.',
   'Gesimuleerde ACKs, wachtrijberichten en expliciete SOS blijven gescheiden.',
   'Verdiepingen en posities zijn illustratief; geen echte binnenlokalisatie.',
   'Vergelijk een mobielnetwerkmodel met het adaptieve routeringsmodel.'
  ],
  controls:'SIMULATIE-INSTELLINGEN',results:'UITKOMST VAN DE OEFENING',participants:'DEELNAME',permissions:'TOESTEMMINGEN',damage:'NETWERKSCHADE',
  battery:'ACCU',devices:'VIRTUELE NODES',responses:'VEILIG-MELDINGEN',help:'EXPLICIETE SOS',radios:'RADIO’S IN MODEL',gateway:'EXTERNE GATEWAY',
  active:'Aan',off:'Uit',safe:'VEILIG',sos:'EXPLICIETE SOS',unknown:'ONBEKEND',acks:'GESIMULEERDE ACK',queued:'IN WACHTRIJ',
  baseline:'ALLEEN MOBIEL / MODEL',adaptive:'ADAPTIEF MODEL',legend:'Oranje = onbekend · koraal = SOS · groen = veilig',
  disclaimer:'Geen echte Bluetooth-, Wi-Fi- of satellietverbinding, CAP-verificatie, triangulatie of contact met 112. ACK is uitsluitend een gesimuleerde ontvangst.',
  refresh:'OEFENING OPNIEUW',audit:'BESLISLOG',copy:'KOPIEER INSTELLINGEN'
 }
} as const;
const steps=Array.from({length:12},(_,i)=>i);

export default function CoordinationLab({locale}:{locale:Locale}){
 const w=words[locale];
 const [stage,setStage]=useState(0);
 const [params,setParams]=useState<ScenarioParameters>({
  devices:60,seed:20261020,participation:80,permissions:85,battery:65,damaged:85,
  responses:10,helpRequests:3,bluetooth:true,wifi:true,gateway:true
 });
 const result=useMemo(()=>runScenario(params),[params]);
 const s=result.summary;
 const set=(key:keyof ScenarioParameters,value:number|boolean)=>setParams(prev=>({...prev,[key]:value}));
 const ranges: [keyof ScenarioParameters,string,number,number,number,string?][] = [
  ['devices',w.devices,20,100,1],
  ['participation',w.participants,0,100,5,'%'],
  ['permissions',w.permissions,0,100,5,'%'],
  ['battery',w.battery,0,100,5,'%'],
  ['damaged',w.damage,0,100,5,'%'],
  ['responses',w.responses,0,Number(params.devices),1],
  ['helpRequests',w.help,0,Number(params.devices),1]
 ];
 return <section className="mer-lab" id="routing-lab" aria-labelledby="mer-title">
  <div className="container mer-inner">
   <div className="mer-intro"><p className="eyebrow">{w.eyebrow}</p><h2 id="mer-title">{w.title}</h2><p>{w.summary}</p></div>
   <div className="mer-topology">
    <div className="mer-visual-wrap">
     <EmergencyBuilding model={result} stage={stage}/>
     <div className="mer-legend">{w.legend}</div>
    </div>
    <div className="mer-story">
     <div className="mer-step-meta">SCENARIO {String(stage+1).padStart(2,'0')} / 12</div>
     <h3>{w.captions[stage]}</h3><p aria-live="polite">{w.descriptions[stage]}</p>
     <div className="mer-step-picker" role="group" aria-label="Scenario steps">
      {steps.map(i=><button key={i} type="button" onClick={()=>setStage(i)}
       className={stage===i?'mer-current':''} aria-pressed={stage===i}
       title={w.captions[i]}>{i+1}</button>)}
     </div>
     <div className="mer-step-actions">
      <button type="button" disabled={stage===0} onClick={()=>setStage(v=>Math.max(0,v-1))}>←</button>
      <button type="button" disabled={stage===11} onClick={()=>setStage(v=>Math.min(11,v+1))}>→</button>
     </div>
    </div>
   </div>
   <div className="mer-bottom">
    <div className="mer-controls"><h3>{w.controls}</h3>
     <div className="mer-sliders">{ranges.map(([key,label,min,max,step,suffix])=><label key={key}>
      <span>{label}<strong>{String(params[key])}{suffix||''}</strong></span>
      <input type="range" min={min} max={max} step={step} value={Number(params[key])}
       onChange={e=>set(key,Number(e.currentTarget.value))}/>
     </label>)}</div>
     <div className="mer-toggles">
      {(['bluetooth','wifi','gateway'] as const).map(key=><label key={key}>
       <input type="checkbox" checked={params[key]!==false} onChange={e=>set(key,e.currentTarget.checked)}/>
       <span>{key==='gateway'?w.gateway:key.toUpperCase()}</span></label>)}
     </div>
     <div className="mer-tools"><button type="button" onClick={()=>{
      setParams({devices:60,seed:20261020,participation:80,permissions:85,battery:65,damaged:85,responses:10,helpRequests:3,bluetooth:true,wifi:true,gateway:true});
      setStage(0);
     }}>{w.refresh}</button>
     <button type="button" onClick={()=>{void navigator.clipboard?.writeText(JSON.stringify({seed:result.seed,params,summary:s},null,2));}}>{w.copy}</button></div>
    </div>
    <div className="mer-output"><h3>{w.results}</h3>
     <div className="mer-stat-grid">
      {[[w.participants,s.participating],[w.permissions,s.permissioned],[w.safe,s.humanSafe],[w.sos,s.humanSOS],
        [w.unknown,s.humanUnknown],[w.acks,s.syntheticAcks],[w.queued,s.queued]] .map(([label,value])=>
        <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
     </div>
     <div className="mer-comparison">
      <div><span>{w.baseline}</span><strong>{s.cellularOnlyAcks} / {s.modelledMessages}</strong></div>
      <div><span>{w.adaptive}</span><strong>{s.syntheticAcks} / {s.modelledMessages}</strong></div>
     </div>
     <div className="mer-trace"><strong>{w.audit}</strong>
      {result.audit.map(item=><p key={item.event}><b>{item.event}</b>: {item.detail}</p>)}
     </div>
     <p className="mer-warning">{w.disclaimer}</p>
    </div>
   </div>
  </div>
 </section>;
}

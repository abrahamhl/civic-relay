'use client';
import {useEffect,useRef,useState} from 'react';
import type {Locale} from './copy';

const stories={
 en:{eyebrow:'01 / HUMAN IMPACT SIMULATION',heading:'WHEN A SIGNAL DISAPPEARS, A PERSON REMAINS.',sub:'A seven-scene fictional wildfire scenario. Scroll to see what is demonstrated and what still requires physical validation.',step:'SCENE',next:'NEXT SCENE',status:'SCENARIO / NOT LIVE',signal:'MOBILE NETWORK',link:'ALTERNATIVE PATH',disclaimer:'Fictional, illustrative story. No real emergency dispatch, satellite uplink, mesh radio or rescue acknowledgment.',stages:[
 ['A NORMAL DAY','The phone works. Connectivity is taken for granted.','COVERAGE AVAILABLE','4 BARS','A person is walking near a rural settlement. Communications depend on infrastructure.'],
 ['THE INFRASTRUCTURE FAILS','Wildfire damage interrupts the mobile network.','NETWORK BLACKOUT','0 BARS','The nearest cell tower stops functioning. The example is fictional; it does not use live incident data.'],
 ['THE MESSAGE CANNOT LEAVE','A critical request has no available route.','NO ROUTE','NOT SENT','The message cannot reach an emergency service merely because someone pressed Send.'],
 ['THE MESSAGE IS PRESERVED','The application stores a test message in a local queue.','STORED LOCALLY','QUEUED','The browser-local research engine models store-and-forward. Restart and power-failure guarantees still need testing.'],
 ['A ROUTE MAY RETURN','Nearby relay nodes and an orbital path appear as a concept.','HYPOTHETICAL ROUTE','SIMULATED','Device-to-device radio and satellite gateways are research targets, not an existing connection.'],
 ['RECEPTION MUST BE PROVEN','The test receiver produces a synthetic acknowledgment.','MODEL ACK','SIMULATED ACK','This is not confirmation by emergency services or proof that an external receiver got the message.'],
 ['FROM CONCEPT TO FIELD EVIDENCE','The next milestone is a safe, independent device-to-device pilot.','PILOT NEEDED','NOT CERTIFIED','Funding enables physical links, measured reliability, authenticated senders and responder-led evaluation.']
 ]},
 es:{eyebrow:'01 / HISTORIA HUMANA SIMULADA',heading:'CUANDO DESAPARECE LA SEÑAL, LA PERSONA SIGUE AHÍ.',sub:'Siete escenas ficticias de un incendio. Desplázate para ver qué hemos demostrado y qué necesita pruebas físicas.',step:'ESCENA',next:'ESCENA SIGUIENTE',status:'SIMULACIÓN / NO ES EN DIRECTO',signal:'COBERTURA MÓVIL',link:'RUTA ALTERNATIVA',disclaimer:'Historia ficticia. No hay aviso real a emergencias, enlace satelital, radio mesh ni confirmación de rescate.',stages:[
 ['UN DÍA NORMAL','El teléfono funciona y damos por hecho que habrá cobertura.','CONEXIÓN DISPONIBLE','4 BARRAS','Una persona camina junto a una población rural. Su comunicación depende de infraestructuras.'],
 ['FALLA LA INFRAESTRUCTURA','Un incendio deja fuera de servicio la red móvil.','APAGÓN DE RED','0 BARRAS','La antena cercana deja de funcionar. Es un supuesto ficticio, sin datos de incidentes reales.'],
 ['EL MENSAJE NO SALE','Una petición crítica no tiene ruta de salida.','SIN RUTA','NO ENVIADO','Pulsar «Enviar» no significa que los servicios de emergencia hayan recibido un mensaje.'],
 ['EL MENSAJE SE CONSERVA','La aplicación guarda un mensaje de prueba en cola local.','GUARDADO LOCALMENTE','EN COLA','El motor de investigación implementa la lógica de almacenar y reenviar en el navegador. Aún faltan pruebas ante reinicios y cortes de energía.'],
 ['PODRÍA APARECER UNA RUTA','Visualizamos nodos próximos y un enlace orbital hipotético.','RUTA HIPOTÉTICA','SIMULACIÓN','La radio entre teléfonos y las pasarelas satelitales son objetivos futuros, no enlaces operativos.'],
 ['HAY QUE PROBAR LA RECEPCIÓN','Un receptor simulado genera un acuse de recibo sintético.','ACK DEL MODELO','ACK SIMULADO','No confirma la recepción por emergencias ni por un dispositivo receptor externo.'],
 ['DE LA IDEA A LA PRUEBA REAL','Siguiente meta: un piloto seguro con dispositivos independientes.','PILOTO PENDIENTE','SIN CERTIFICAR','La financiación permitirá conexiones físicas, fiabilidad medida, identidades verificadas y evaluación con personal de emergencias.']
 ]},
 nl:{eyebrow:'01 / MENSELIJK CRISISSIMULATIE',heading:'ALS HET SIGNAAL WEGVALT, BLIJFT DE MENS ACHTER.',sub:'Zeven fictieve scènes rond een natuurbrand. Scroll om te zien wat aantoonbaar is en wat nog fysiek getest moet worden.',step:'SCÈNE',next:'VOLGENDE SCÈNE',status:'SCENARIO / NIET LIVE',signal:'MOBIEL BEREIK',link:'ALTERNATIEVE ROUTE',disclaimer:'Fictief scenario. Geen echte alarmmelding, satellietverbinding, meshradio of bevestiging van hulpdiensten.',stages:[
 ['EEN GEWONE DAG','De telefoon werkt; bereik lijkt vanzelfsprekend.','BEREIK BESCHIKBAAR','4 STREEPJES','Een persoon loopt bij een dorp. Communicatie is afhankelijk van infrastructuur.'],
 ['INFRASTRUCTUUR VALT UIT','Een natuurbrand verstoort het mobiele netwerk.','NETWERKUITVAL','0 STREEPJES','De dichtstbijzijnde mast werkt niet meer. Dit is fictie, zonder live incidentgegevens.'],
 ['BERICHT KAN NIET WEG','Een dringend verzoek heeft geen beschikbare route.','GEEN ROUTE','NIET VERZONDEN','Op Verzenden drukken is geen bewijs dat de hulpdiensten iets hebben ontvangen.'],
 ['BERICHT BLIJFT BEWAARD','De app bewaart een testbericht in de lokale wachtrij.','LOKAAL BEWAARD','IN WACHTRIJ','De browserdemo modelleert bewaren en later doorsturen. Herstart en stroomverlies moeten nog worden getest.'],
 ['EEN ROUTE KAN TERUGKOMEN','Nabije relaisknooppunten en een satellietpad verschijnen als concept.','HYPOTHETISCHE ROUTE','SIMULATIE','Radio tussen telefoons en satellietgateways zijn onderzoeksdoelen, geen werkende verbindingen.'],
 ['ONTVANGST MOET BEWEZEN WORDEN','Een gesimuleerde ontvanger geeft een synthetische ontvangstbevestiging.','MODEL-ACK','GESIMULEERDE ACK','Geen bewijs van ontvangst door hulpdiensten of een extern apparaat.'],
 ['VAN CONCEPT NAAR VELDPROEF','De volgende mijlpaal is een veilige proef met twee onafhankelijke apparaten.','VELDPROEF NODIG','NIET GECERTIFICEERD','Financiering maakt fysieke verbindingen, betrouwbaarheidsmetingen en tests met hulpverleners mogelijk.']
 ]}
} as const;

export default function CrisisStory({locale}:{locale:Locale}){
 const t=stories[locale]; const refs=useRef<(HTMLElement|null)[]>([]); const [active,setActive]=useState(0); const [reduce,setReduce]=useState(false);
 useEffect(()=>{
   const mq=window.matchMedia('(prefers-reduced-motion: reduce)');const onMotion=()=>setReduce(mq.matches);onMotion();mq.addEventListener('change',onMotion);
   const observer=new IntersectionObserver(entries=>{const candidates=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);if(candidates[0]){const n=Number((candidates[0].target as HTMLElement).dataset.scene);if(Number.isInteger(n))setActive(n);}}, {rootMargin:'-30% 0px -30% 0px',threshold:[0,.1,.25,.5]});
   refs.current.forEach(el=>el&&observer.observe(el));return()=>{mq.removeEventListener('change',onMotion);observer.disconnect()};
 },[]);
 const step=t.stages[active];const online=active===0,route=active>=4;
 return <section className="crisis-story" id="story" aria-label={t.heading}>
   <div className="container crisis-story-title"><p className="eyebrow">{t.eyebrow}</p><h2>{t.heading}</h2><p>{t.sub}</p></div>
   <div className="container crisis-story-layout">
    <div className="crisis-story-chapters">{t.stages.map((s,i)=><article key={i} data-scene={i} ref={el=>{refs.current[i]=el}} className={'crisis-story-chapter '+(i===active?'is-active':'')}><span>{String(i+1).padStart(2,'0')} / 07</span><h3>{s[0]}</h3><h4>{s[1]}</h4><p>{s[4]}</p></article>)}</div>
    <div className="crisis-story-viewport"><div className="crisis-story-panel" data-scene={active}>
      <div className="crisis-story-panel-head"><span className="pulse"/> {t.status} <span>{t.step} {String(active+1).padStart(2,'0')}/07</span></div>
      <div className={'crisis-story-art crisis-stage-'+active} role="img" aria-label={step[1]}>
       <svg viewBox="0 0 700 450" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0c2436"/><stop offset="1" stopColor="#1d3742"/></linearGradient><radialGradient id="fire"><stop stopColor="#ff8c3f" stopOpacity=".7"/><stop offset="1" stopColor="#e64c2e" stopOpacity="0"/></radialGradient></defs>
        <rect width="700" height="450" fill="url(#sky)"/><path d="M0 308L126 236 217 290 327 200 449 290 560 205 700 273V450H0Z" fill="#233b40"/><path d="M0 348L90 310 210 347 332 287 474 340 600 282 700 320V450H0Z" fill="#101f29"/>
        <g stroke="#406e74" strokeWidth="4"><path d="M145 338V143M134 153L145 143 156 153M113 175L145 143 178 175M113 198L145 175 178 198" fill="none"/></g>
        <g className="crisis-tower-wave" fill="none" stroke="#79d8d8" strokeWidth="3"><path d="M96 130Q68 160 96 191M194 130Q222 160 194 191"/><path d="M80 113Q36 160 80 208M210 113Q254 160 210 208"/></g>
        <g className="crisis-fire"><ellipse cx="530" cy="308" rx="150" ry="128" fill="url(#fire)"/><path d="M488 358Q455 304 485 272Q482 314 512 285Q508 230 542 211Q530 286 575 291Q609 319 577 359Z" fill="#ff7b41" opacity=".95"/><path d="M513 359Q503 322 526 299Q524 323 543 315Q546 342 562 359Z" fill="#ffe4a1"/></g>
        <g className="crisis-person"><circle cx="316" cy="308" r="17" fill="#d2a68e"/><path d="M293 343Q317 323 340 343L358 403H281Z" fill="#a6c6d1"/><path d="M293 356L263 388M339 356L356 381" stroke="#a6c6d1" strokeWidth="11" strokeLinecap="round"/><path d="M302 400L295 444M339 400L345 444" stroke="#243944" strokeWidth="15"/></g>
        <g className="crisis-phone" transform="translate(345 372) rotate(-12)"><rect x="-12" y="-24" width="24" height="42" rx="5" fill="#101a21" stroke="#82dae3" strokeWidth="2"/><rect x="-8" y="-18" width="16" height="25" rx="2" fill={online?'#47a6b2':'#bc6654'}/></g>
        <g className="crisis-node-link" fill="none" stroke="#88e4e2" strokeWidth="3" strokeDasharray="7 8"><path d="M354 358Q480 120 620 100"/><path d="M145 143Q285 82 400 119"/></g>
        <g className="crisis-satellite" transform="translate(602 94) rotate(-25)"><rect x="-12" y="-11" width="24" height="22" rx="2" fill="#e8ebef"/><rect x="-57" y="-14" width="42" height="28" fill="#2d98b1" stroke="#95d7e0"/><rect x="15" y="-14" width="42" height="28" fill="#2d98b1" stroke="#95d7e0"/></g>
       </svg>
       <div className="crisis-signal-box"><small>{t.signal}</small><strong>{online?'▂▄▆█':'▁▁▁▁'}</strong><span>{online?'ONLINE':'OFFLINE'}</span></div>
       <div className="crisis-route-box"><small>{t.link}</small><strong>{route?step[3]:online?'AVAILABLE':'UNAVAILABLE'}</strong></div>
       {active>=3&&<div className="crisis-message-box"><span>TEST MESSAGE / LOCAL</span><strong>{step[3]}</strong></div>}
      </div>
      <div className="crisis-story-state"><span>{step[2]}</span><strong>{step[3]}</strong></div>
      <div className="crisis-story-buttons"><div role="group" aria-label={t.step}>{t.stages.map((s,i)=><button key={i} type="button" className={active===i?'current':''} aria-label={t.step+' '+(i+1)+': '+s[0]} aria-current={active===i?'step':undefined} onClick={()=>refs.current[i]?.scrollIntoView({behavior:reduce?'instant':'smooth',block:'center'})}>{i+1}</button>)}</div><button type="button" className="crisis-next" disabled={active===6} onClick={()=>refs.current[Math.min(6,active+1)]?.scrollIntoView({behavior:reduce?'instant':'smooth',block:'center'})}>{t.next} ↓</button></div>
      <p className="crisis-story-caution">{t.disclaimer}</p>
     </div></div>
   </div>
  </section>;
}

'use client';
import {useEffect,useState} from 'react';
import type {Locale} from './copy';

type Aud='all'|'citizen'|'coord'|'eng'|'inv';
const ORDER:Aud[]=['all','citizen','coord','eng','inv'];
const L:Record<Locale,{label:string;names:Record<Aud,string>;intro:Record<Aud,string>;count:string}>={
 es:{label:'Ver la página como',count:'secciones en este recorrido',
  names:{all:'Todo',citizen:'Ciudadanía',coord:'Coordinación',eng:'Ingeniería',inv:'Inversión'},
  intro:{all:'Página completa: todas las secciones, simuladores y explicaciones.',
   citizen:'Qué hace SENDA por ti cuando cae la red: cómo avisar, cómo te encuentran y qué datos tuyos se protegen.',
   coord:'Para salas de coordinación, protección civil y cuerpos: imagen operativa, alertas firmadas, casos y despliegue.',
   eng:'Para equipos técnicos: arquitectura, enrutamiento, radio, criptografía, pruebas y laboratorio de hardware.',
   inv:'Para inversión y financiación pública: el hueco de mercado, la evidencia, la hoja de ruta y qué compra el capital.'}},
 en:{label:'View the page as',count:'sections in this path',
  names:{all:'Everything',citizen:'Citizen',coord:'Coordinator',eng:'Engineer',inv:'Investor'},
  intro:{all:'Full page: every section, simulator and explanation.',
   citizen:'What SENDA does for you when the network falls: how to raise the alarm, how rescuers find you and how your data is protected.',
   coord:'For control rooms, civil protection and responders: operational picture, signed alerts, cases and deployment.',
   eng:'For technical teams: architecture, routing, radio, cryptography, tests and the hardware lab.',
   inv:'For investors and public funding: the market gap, the evidence, the roadmap and what capital buys.'}},
 nl:{label:'Bekijk de pagina als',count:'secties in dit pad',
  names:{all:'Alles',citizen:'Burger',coord:'Coördinator',eng:'Ingenieur',inv:'Investeerder'},
  intro:{all:'Volledige pagina: alle secties, simulators en uitleg.',
   citizen:'Wat SENDA voor je doet als het netwerk uitvalt: alarm slaan, hoe hulpverleners je vinden en hoe je gegevens beschermd worden.',
   coord:'Voor meldkamers, crisisbeheersing en hulpdiensten: operationeel beeld, ondertekende alarmen, gevallen en uitrol.',
   eng:'Voor technische teams: architectuur, routering, radio, cryptografie, tests en het hardwarelab.',
   inv:'Voor investeerders en publieke financiering: het gat in de markt, het bewijs, de roadmap en wat kapitaal oplevert.'}}
};

export default function AudienceFilter({locale}:{locale:Locale}){
 const t=L[locale]??L.en;
 const [aud,setAud]=useState<Aud>('all');
 const [count,setCount]=useState(0);
 useEffect(()=>{try{const s=localStorage.getItem('senda-aud') as Aud|null;if(s&&ORDER.includes(s))setAud(s);}catch{}},[]);
 useEffect(()=>{
  const root=document.querySelector('.site-root') as HTMLElement|null;
  if(root)root.dataset.aud=aud;
  try{localStorage.setItem('senda-aud',aud);}catch{}
  setCount([...document.querySelectorAll('[data-for]')].filter(el=>aud==='all'||(el.getAttribute('data-for')||'').split(' ').includes(aud)).length);
 },[aud]);
 const choose=(a:Aud)=>{setAud(a);document.getElementById('audience')?.scrollIntoView({behavior:'smooth',block:'start'});};
 return <div id="audience" className="aud-bar" role="region" aria-label={t.label}>
  <div className="aud-inner">
   <span className="aud-label">{t.label}</span>
   <div className="aud-pills" role="radiogroup" aria-label={t.label}>
    {ORDER.map(a=><button key={a} type="button" role="radio" aria-checked={aud===a} className={aud===a?'on':''} onClick={()=>choose(a)}>{t.names[a]}</button>)}
   </div>
   <p className="aud-intro" aria-live="polite">{t.intro[aud]} <b>{count} {t.count}</b></p>
  </div>
 </div>;
}

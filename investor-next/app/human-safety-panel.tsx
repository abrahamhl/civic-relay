'use client';
import {useState} from 'react';
import {recordSafetyResponse,revokeSafetyRecord} from '../lib/emergency-policy.mjs';
import type {SafetyResponse,SafetyRecord} from '../lib/emergency-policy.mjs';
import type {Locale} from './copy';

const copy={
 en:{title:'HUMAN STATUS / EXERCISE ONLY',note:'Choose an explicit response. Nothing is sent to 112, an agency, a radio or another device. No location is collected.',consent:'I agree to store this temporary test response only in this page.',responses:['I am safe','I need help','Other people affected','I cannot determine my situation'],saved:'Local exercise response',revoke:'REVOKE AND CLEAR',expired:'Expires within 1 hour; cleared when leaving the page'},
 es:{title:'ESTADO HUMANO / SOLO EJERCICIO',note:'Selecciona una respuesta. Nada se envía al 112, a autoridades, radios ni a otros teléfonos. No se obtiene tu ubicación.',consent:'Acepto guardar esta respuesta de prueba temporal solo en esta página.',responses:['Estoy bien','Necesito ayuda','Hay otras personas afectadas','No puedo determinar mi situación'],saved:'Respuesta local de ejercicio',revoke:'REVOCAR Y ELIMINAR',expired:'Caduca en una hora; se elimina al salir de la página'},
 nl:{title:'STATUS / ALLEEN OEFENING',note:'Kies zelf een antwoord. Er gaat niets naar 112, instanties, radios of andere telefoons. Geen locatie wordt opgehaald.',consent:'Ik geef toestemming om dit testantwoord tijdelijk in deze pagina te bewaren.',responses:['Ik ben veilig','Ik heb hulp nodig','Andere mensen getroffen','Ik kan mijn situatie niet bepalen'],saved:'Lokaal oefenantwoord',revoke:'INTREKKEN EN WISSEN',expired:'Verloopt binnen één uur; verdwijnt bij verlaten van pagina'}
} as const;
const answers:SafetyResponse[]=['SAFE','SOS_EXPLICIT','OTHERS_AFFECTED','CANNOT_DETERMINE'];
export default function HumanSafetyPanel({locale}:{locale:Locale}){
 const t=copy[locale];const [consent,setConsent]=useState(false);const [record,setRecord]=useState<SafetyRecord|null>(null);
 const apply=(response:SafetyResponse)=>{
  if(!consent)return;
  setRecord(recordSafetyResponse({response,consented:true,retentionSeconds:3600,shareLocation:false}));
 };
 const revoke=()=>{if(record)revokeSafetyRecord(record);setRecord(null);setConsent(false);};
 return <div className="mer-human">
  <h3>{t.title}</h3><p>{t.note}</p>
  <label><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.currentTarget.checked);if(!e.currentTarget.checked)setRecord(null);}}/>{t.consent}</label>
  <div className="mer-safety-choices" role="group" aria-label={t.title}>
   {answers.map((answer,i)=><button type="button" disabled={!consent} key={answer}
    aria-pressed={record?.response===answer} onClick={()=>apply(answer)}
    className={record?.response===answer?'selected':''}>{t.responses[i]}</button>)}
  </div>
  {record&&<div className="mer-safety-record" aria-live="polite"><strong>{t.saved}: {record.response}</strong>
   <small>{t.expired}</small><button type="button" onClick={revoke}>{t.revoke}</button></div>}
 </div>;
}

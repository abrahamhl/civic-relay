'use client';

import {useState} from 'react';
import type {Locale} from './copy';
import {MODULES,SURFACES,SCENARIOS,GATES} from '../lib/master-vision.mjs';
import {simulateFamilyDelivery} from '../lib/vision-contracts.mjs';
import './master-vision.css';

const copy = {
 es: {
  kicker:'CIVIC RELAY · VISIÓN MAESTRA',title:'Anticipar. Conservar. Conectar. Coordinar.',
  lead:'Una plataforma europea modular para anticipar riesgos y mantener la continuidad de personas, equipos e infraestructuras cuando la conectividad se degrada.',
  thesis:'La apuesta tecnológica: unir contexto de riesgo, oportunidades de conexión y confirmaciones verificables en una misma cadena de decisiones.',
  audience:'Elige una perspectiva',scenario:'Escenario de referencia',all:'Todos los módulos',catalog:'Explorar el programa tecnológico',
  demo:'Un mensaje de Arnhem a San Martín',demoLead:'Abraham escribe a Ismael. Explora qué cambia cuando aparece una ruta y quién confirma cada paso.',
  simulation:'SIMULACIÓN EXPLÍCITA · no envía mensajes ni cifra o almacena datos',
  stages:['Sin ruta','Custodia del gateway','Confirmación de Ismael','Lectura opcional','Caducidad'],
  statuses:{NO_ROUTE:'Sin ruta: el mensaje espera una oportunidad real.',PENDING:'En custodia del gateway. Ismael aún no ha confirmado.',DESTINATION_ACK:'El destinatario confirma la recepción en este escenario simulado.',READ:'Lectura confirmada por el destinatario simulado.',EXPIRED:'Plazo agotado sin confirmación de destino. Estado de la persona: desconocido.'},
  rule:'Ver un satélite o recibir un ACK intermedio no prueba entrega. Si no hay hardware, permiso y enlace compatibles, no existe ruta.',
  custody:'Confirmación intermedia',none:'Ninguna',next:'Prueba necesaria',gates:'La inversión avanza con evidencia',gateNote:'Cada etapa requiere pruebas de salida. Este catálogo no certifica etapas completadas.',
  legend:'E: software parcial · S: simulación · L: laboratorio sin validación física · R: investigación · X: dependencia externa',
  empty:'No hay módulos para esta combinación. Selecciona todos los módulos o cambia de escenario.',master:'Leer el maestro completo (ES)',limits:'Programa de I+D. Los módulos no constituyen un servicio operativo de emergencias.',
 },
 en: {
  kicker:'CIVIC RELAY · MASTER VISION',title:'Anticipate. Preserve. Connect. Coordinate.',
  lead:'A modular European platform to anticipate risks and sustain continuity for people, teams and infrastructure when connectivity degrades.',
  thesis:'The technology thesis: connect risk context, connectivity opportunities and verifiable receipts in one decision chain.',
  audience:'Choose a perspective',scenario:'Reference scenario',all:'All modules',catalog:'Explore the technology programme',
  demo:'A message from Arnhem to San Martín',demoLead:'Abraham writes to Ismael. Explore what changes when a route appears and who confirms each step.',
  simulation:'EXPLICIT SIMULATION · sends no messages and does not encrypt or store data',
  stages:['No route','Gateway custody','Ismael confirms','Optional read receipt','Expiry'],
  statuses:{NO_ROUTE:'No route: the message waits for a real opportunity.',PENDING:'In gateway custody. Ismael has not confirmed yet.',DESTINATION_ACK:'The recipient confirms reception in this simulated scenario.',READ:'Reading confirmed by the simulated recipient.',EXPIRED:'Time limit reached without destination confirmation. Human status: unknown.'},
  rule:'Seeing a satellite or receiving an intermediate ACK does not prove delivery. Without compatible hardware, permission and a link, there is no route.',
  custody:'Intermediate receipt',none:'None',next:'Required evidence',gates:'Investment advances with evidence',gateNote:'Each stage requires exit evidence. This catalogue does not certify completed stages.',
  legend:'E: partial software · S: simulation · L: lab without physical validation · R: research · X: external dependency',
  empty:'No modules match this combination. Select all modules or change the scenario.',master:'Read the complete master document (Spanish)',limits:'R&D programme. These modules do not constitute an operational emergency service.',
 },
 nl: {
  kicker:'CIVIC RELAY · MASTERVISIE',title:'Anticiperen. Bewaren. Verbinden. Coördineren.',
  lead:'Een modulair Europees platform om risico’s te voorzien en de continuïteit voor mensen, teams en infrastructuur te ondersteunen bij verminderde connectiviteit.',
  thesis:'De technologische inzet: risicocontext, verbindingskansen en verifieerbare ontvangstbewijzen samenbrengen in één beslisketen.',
  audience:'Kies een perspectief',scenario:'Referentiescenario',all:'Alle modules',catalog:'Verken het technologieprogramma',
  demo:'Een bericht van Arnhem naar San Martín',demoLead:'Abraham schrijft aan Ismael. Bekijk wat verandert wanneer een route beschikbaar komt en wie elke stap bevestigt.',
  simulation:'EXPLICIETE SIMULATIE · verzendt, versleutelt of bewaart geen berichten',
  stages:['Geen route','Bewaring bij gateway','Ismael bevestigt','Optioneel leesbewijs','Verlopen'],
  statuses:{NO_ROUTE:'Geen route: het bericht wacht op een echte kans.',PENDING:'In bewaring bij de gateway. Ismael heeft nog niet bevestigd.',DESTINATION_ACK:'De ontvanger bevestigt ontvangst in dit gesimuleerde scenario.',READ:'Lezen bevestigd door de gesimuleerde ontvanger.',EXPIRED:'Termijn verstreken zonder bevestiging van de ontvanger. Menselijke status: onbekend.'},
  rule:'Een zichtbare satelliet of tussentijdse ACK bewijst geen aflevering. Zonder geschikte hardware, toestemming en verbinding is er geen route.',
  custody:'Tussentijds ontvangstbewijs',none:'Geen',next:'Vereist bewijs',gates:'Investeringen volgen het bewijs',gateNote:'Elke fase vereist bewijs. Deze catalogus certificeert geen voltooide fasen.',
  legend:'E: gedeeltelijke software · S: simulatie · L: lab zonder fysieke validatie · R: onderzoek · X: externe afhankelijkheid',
  empty:'Geen modules voor deze combinatie. Kies alle modules of een ander scenario.',master:'Lees het volledige masterdocument (Spaans)',limits:'R&D-programma. Deze modules vormen geen operationele hulpdienst.',
 },
};
const stages=['NO_ROUTE','GATEWAY_ACK','DESTINATION_ACK','READ','EXPIRED'] as const;

export default function MasterVision({locale}:{locale:Locale}) {
 const t=copy[locale];
 const [surface,setSurface]=useState('family');
 const [scenario,setScenario]=useState('ALL');
 const [stage,setStage]=useState<(typeof stages)[number]>('NO_ROUTE');
 const result=simulateFamilyDelivery(stage);
 const perspective=SURFACES.find(s=>s.id===surface);
 const modules=MODULES.filter(m=>(surface==='ALL'||m.surfaces.includes(surface)) && (scenario==='ALL'||m.scenarios.includes(scenario)));
 return <section id="master-vision" className="container cr-vision" aria-labelledby="master-vision-title" data-testid="master-vision">
  <header className="cr-vision-heading"><p className="eyebrow">{t.kicker}</p><h2 id="master-vision-title">{t.title}</h2><p className="cr-vision-lead">{t.lead}</p><p>{t.thesis}</p></header>
  <div className="cr-family-demo">
   <div><p className="cr-vision-label">S01 · ARNHEM → SAN MARTÍN DE VALDEIGLESIAS</p><h3>{t.demo}</h3><p>{t.demoLead}</p><p className="cr-synthetic">{t.simulation}</p></div>
   <div role="group" aria-label={t.demo} className="cr-stages">{stages.map((value,i)=><button key={value} type="button" aria-pressed={stage===value} onClick={()=>setStage(value)} data-testid={`vision-stage-${value}`}>{t.stages[i]}</button>)}</div>
   <div className="cr-delivery" role="status" aria-live="polite" data-testid="vision-delivery"><strong>{result.status}</strong><p>{t.statuses[result.status as keyof typeof t.statuses]}</p><small>{t.custody}: {result.custody.join(' → ')||t.none}</small></div>
   <p className="cr-route-rule">{t.rule}</p>
  </div>
  <div className="cr-programme-controls"><div><label htmlFor={`vision-audience-${locale}`}>{t.audience}</label><select id={`vision-audience-${locale}`} value={surface} onChange={e=>setSurface(e.target.value)} data-testid="vision-audience"><option value="ALL">{t.all}</option>{SURFACES.map(s=><option key={s.id} value={s.id}>{s.title[locale]}</option>)}</select></div><div><label htmlFor={`vision-scenario-${locale}`}>{t.scenario}</label><select id={`vision-scenario-${locale}`} value={scenario} onChange={e=>setScenario(e.target.value)} data-testid="vision-scenario"><option value="ALL">{t.all}</option>{SCENARIOS.map(s=><option key={s.id} value={s.id}>{s.id} · {s.title[locale]}</option>)}</select></div></div>
  <p className="cr-perspective" role="status">{perspective?.boundary[locale]||t.limits}</p>
  <details className="cr-catalog"><summary>{t.catalog} <span>{modules.length} / 20</span></summary><p>{t.legend}</p><div className="cr-module-list" data-testid="vision-module-list">{modules.length===0?<p role="status">{t.empty}</p>:null}{modules.map(m=><article key={m.id} data-testid={`vision-module-${m.id}`}><div className="cr-module-id"><b>{m.id}</b><small>{m.state.join(' · ')}</small></div><div><h3>{m.title[locale]}</h3><p><strong>{t.next}: </strong>{m.acceptance[locale]}</p></div><span className="cr-gate-tag">{m.gate}</span></article>)}</div></details>
  <details className="cr-gates"><summary>{t.gates}</summary><p>{t.gateNote}</p><ol>{GATES.map(g=><li key={g.id}><b>{g.id}</b><span>{g.title[locale]}</span></li>)}</ol></details>
  <footer className="cr-vision-footer"><p>{t.limits}</p><a className="text-cta" href="/vision-master.md" download>{t.master} ↓</a></footer>
 </section>;
}

import MissionControl from './mission-control';
import ScrollExperience from './scroll-experience';
import CrisisStory from './crisis-story';
import CoordinationLab from './coordination-lab';
import EvidenceBoard from './evidence-board';
import TelecomAndRfRadarSuite from './telecom-rf-radar-suite';
import LiveHardwareAndDealRoomConsole from './live-hardware-console';
import SectorIntelligenceConsole from './sector-intelligence-console';
import {WhatItDoes,SystemExplained,DeveloperBlueprint} from './system-explained';
import {routingPitch} from './routing-pitch';
import {getCopy,labels,locales,type Locale} from './copy';
import LanguageDocument from './language-document';

const source='https://github.com/abrahamhl/civic-relay';

const funding='https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04';
const dossier=source+'/blob/master/docs/README.md';
const contact=source+'/issues/new?template=pilot-or-grant-partner.yml';
const chapterNavigation:Record<Locale,Array<{href:string;label:string}>>={
 en:[{href:'#what-oep-does',label:'WHAT IT DOES'},{href:'#architecture',label:'THE 3D STORY'},{href:'#how-it-works',label:'HOW IT WORKS'},{href:'#routing-lab',label:'TRY THE LAB'},{href:'#developer-stack',label:'TECH STACK'},{href:'#evidence',label:'EVIDENCE'}],
 es:[{href:'#what-oep-does',label:'QUÉ HACE'},{href:'#architecture',label:'HISTORIA 3D'},{href:'#how-it-works',label:'CÓMO FUNCIONA'},{href:'#routing-lab',label:'PROBAR LAB'},{href:'#developer-stack',label:'TECNOLOGÍA'},{href:'#evidence',label:'EVIDENCIAS'}],
 nl:[{href:'#what-oep-does',label:'WAT HET DOET'},{href:'#architecture',label:'3D-VERHAAL'},{href:'#how-it-works',label:'WERKING'},{href:'#routing-lab',label:'LAB PROBEREN'},{href:'#developer-stack',label:'TECHNIEK'},{href:'#evidence',label:'BEWIJS'}]
};

const thirtySecondThesis:Record<Locale,{
 brandTag:string;
 title:string;
 subtitle:string;
 exactQuote:string;
 ctaSimulate:string;
 ctaExploreMap:string;
 ctaEvidence:string;
 surfacesTitle:string;
 surfaces:Array<{id:string;tag:string;name:string;desc:string;targetAnchor:string;routeHref:string}>;
 eightScenes:Array<{num:string;tag:string;summary:string;targetAnchor:string;badge:string}>;
}>={
 es:{
  brandTag:'CIVIC RELAY (PLATAFORMA) · OEP — OFFLINE EMERGENCY PROTOCOL (PROTOCOLO DE INVESTIGACIÓN)',
  title:'Cuando cae la red, la coordinación no debería desaparecer.',
  subtitle:'Explora cómo Civic Relay investiga el uso coordinado de dispositivos participantes y redes compatibles para conservar avisos, encontrar rutas alternativas y comunicar estados voluntarios durante emergencias. Hoy puedes comprobar el modelo en una simulación; la conexión física a gran escala sigue en investigación.',
  exactQuote:'«Civic Relay investiga cómo coordinar avisos, estados voluntarios de personas y rutas alternativas entre dispositivos y redes compatibles cuando falla parte de la conectividad. El prototipo permite experimentar con zonas de emergencia, permisos, mensajes, almacenamiento y reenvío y confirmaciones en un escenario simulado. La comunicación real entre teléfonos y con servicios oficiales todavía requiere validación e integración autorizada».',
  ctaSimulate:'Simular una emergencia',
  ctaExploreMap:'Explorar el mapa interactivo',
  ctaEvidence:'Ver qué funciona de verdad',
  surfacesTitle:'TRES SUPERFICIES COMPLEMENTARIAS (DIVULGACIÓN PROGRESIVA)',
  surfaces:[
   {id:'surface-discover',tag:'A · DESCUBRIR',name:'Historia y Resumen en 30s',desc:'Qué problema resuelve, para quién y con qué límites honestos, sin necesidad de jerga 3GPP/CSI/CAP.',targetAnchor:'#what-oep-does',routeHref:'/es/'},
   {id:'surface-explore',tag:'B · EXPLORAR / MISSION CONTROL',name:'Globo 3D + Sector Intelligence CCTV',desc:'Globo 3D con selección raycast, sectores (El Tiemblo, Valencia, Arnhem), conos FOV estimados y cámaras públicas/demo.',targetAnchor:'#sector-intelligence',routeHref:'/es/mission-control/'},
   {id:'surface-science',tag:'C · INVESTIGAR / SCIENCE & LAB',name:'Motor Determinista, Criptografía y Evidencia',desc:'Cola Store-and-Forward, firmas reales WebCrypto ECDSA P-256, laboratorio Android Nearby y matriz científica.',targetAnchor:'#routing-lab',routeHref:'/es/science/'}
  ],
  eightScenes:[
   {num:'01',tag:'DESASTRE',summary:'Incendio o apagón inutiliza una antena; la cobertura del sector cambia.',targetAnchor:'#story',badge:'SYNTHETIC SIMULATION'},
   {num:'02',tag:'PERSONAS',summary:'Nodos voluntarios declaran SAFE o SOS; UNKNOWN significa sin respuesta, nunca herido.',targetAnchor:'#routing-lab',badge:'REAL CODE / LOCAL LAB'},
   {num:'03',tag:'CONSENTIMIENTO',summary:'Permisos granulares opt-in; ningún sensor ajeno se activa sin permiso del usuario y SO.',targetAnchor:'#routing-lab',badge:'REAL CODE / LOCAL LAB'},
   {num:'04',tag:'RUTAS',summary:'«Policía de tráfico» alterna BLE/Wi-Fi/Gateway virtual según batería, prioridad y TTL.',targetAnchor:'#how-it-works',badge:'REAL CODE / LOCAL LAB'},
   {num:'05',tag:'SECTORES Y CÁMARAS',summary:'Del globo al sector (El Tiemblo/Valencia/Arnhem) con cámaras públicas DGT/RWS y conos estimados.',targetAnchor:'#sector-intelligence',badge:'LIVE THIRD-PARTY DATA — SOURCE/TIMESTAMP'},
   {num:'06',tag:'COORDINACIÓN Y ACK',summary:'Cola → ruta → ACK_SYNTHETIC; jamás se presenta como despacho real del 112.',targetAnchor:'#architecture',badge:'SYNTHETIC SIMULATION'},
   {num:'07',tag:'COMPARACIÓN',summary:'Lado a lado «Hoy (solo celular) vs Hipótesis Civic Relay» bajo las mismas condiciones.',targetAnchor:'#telecom-rf-radar-suite',badge:'SYNTHETIC SIMULATION'},
   {num:'08',tag:'EVIDENCIA Y PILOTO',summary:'Estado verificable del código, 0 relés físicos medidos aún y hoja de ruta para pilotos.',targetAnchor:'#evidence',badge:'PHYSICAL FIELD TEST PENDING'}
  ]
 },
 en:{
  brandTag:'CIVIC RELAY (PLATFORM) · OEP — OFFLINE EMERGENCY PROTOCOL (RESEARCH PROTOCOL)',
  title:'When the network goes down, coordination should not disappear.',
  subtitle:'Explore how Civic Relay researches coordinated use of participating devices and compatible networks to preserve alerts, find alternative paths, and communicate voluntary status during emergencies. Today you can test the model in a deterministic simulation; large-scale physical links remain under research.',
  exactQuote:'“Civic Relay researches how to coordinate alerts, voluntary human status check-ins, and alternative routes across participating devices and compatible networks when connectivity partially fails. The prototype lets you experiment with emergency zones, permissions, messages, store-and-forward queuing, and acknowledgments in a simulated scenario. Real phone-to-phone and official emergency service communication still requires validation and authorized integration.”',
  ctaSimulate:'Simulate an emergency',
  ctaExploreMap:'Explore interactive map',
  ctaEvidence:'See what works today',
  surfacesTitle:'THREE COMPLEMENTARY SURFACES (PROGRESSIVE DISCLOSURE)',
  surfaces:[
   {id:'surface-discover',tag:'A · DISCOVER',name:'30-Second Story & Primer',desc:'What problem it solves, for whom, and with what explicit boundaries—no 3GPP/CSI/CAP jargon required.',targetAnchor:'#what-oep-does',routeHref:'/'},
   {id:'surface-explore',tag:'B · EXPLORE / MISSION CONTROL',name:'3D Globe + Sector Intelligence CCTV',desc:'3D Globe with raycast object selection, sectors (El Tiemblo, Valencia, Arnhem), estimated FOV cones, and public/demo cameras.',targetAnchor:'#sector-intelligence',routeHref:'/mission-control/'},
   {id:'surface-science',tag:'C · INVESTIGATE / SCIENCE & LAB',name:'Deterministic Engine, Crypto & Evidence',desc:'Store-and-Forward queue, real WebCrypto ECDSA P-256 signatures, Android Nearby lab source, and scientific truth matrix.',targetAnchor:'#routing-lab',routeHref:'/science/'}
  ],
  eightScenes:[
   {num:'01',tag:'DISASTER',summary:'Wildfire or blackout disables a tower; sector coverage map updates immediately.',targetAnchor:'#story',badge:'SYNTHETIC SIMULATION'},
   {num:'02',tag:'PEOPLE',summary:'Participating nodes report SAFE or SOS; UNKNOWN means unconfirmed silence, never casualty.',targetAnchor:'#routing-lab',badge:'REAL CODE / LOCAL LAB'},
   {num:'03',tag:'CONSENT',summary:'Granular opt-in permissions; no remote phone sensor is ever turned on without OS/user consent.',targetAnchor:'#routing-lab',badge:'REAL CODE / LOCAL LAB'},
   {num:'04',tag:'ROUTES',summary:'Routing traffic-cop evaluates BLE/Wi-Fi/Gateway paths by battery, priority, and TTL.',targetAnchor:'#how-it-works',badge:'REAL CODE / LOCAL LAB'},
   {num:'05',tag:'SECTORS & CAMERAS',summary:'Drill down from Globe to Sector (El Tiemblo/Valencia/Arnhem) with public road metadata & FOV cones.',targetAnchor:'#sector-intelligence',badge:'LIVE THIRD-PARTY DATA — SOURCE/TIMESTAMP'},
   {num:'06',tag:'COORDINATION & ACK',summary:'Queue → decision → ACK_SYNTHETIC; never misrepresented as a live 112 dispatch.',targetAnchor:'#architecture',badge:'SYNTHETIC SIMULATION'},
   {num:'07',tag:'COMPARISON',summary:'Side-by-side “Conventional cellular-only vs Civic Relay hypothesis” under identical seed parameters.',targetAnchor:'#telecom-rf-radar-suite',badge:'SYNTHETIC SIMULATION'},
   {num:'08',tag:'EVIDENCE & PILOT',summary:'Verifiable code status, 0 measured physical field relays yet, and institutional pilot roadmap.',targetAnchor:'#evidence',badge:'PHYSICAL FIELD TEST PENDING'}
  ]
 },
 nl:{
  brandTag:'CIVIC RELAY (PLATFORM) · OEP — OFFLINE EMERGENCY PROTOCOL (ONDERZOEKSPROTOCOL)',
  title:'Als het netwerk uitvalt, mag de coördinatie niet verdwijnen.',
  subtitle:'Ontdek hoe Civic Relay onderzoekt hoe deelnemende apparaten en compatibele netwerken meldingen bewaren, alternatieve routes vinden en vrijwillige statussen delen tijdens noodsituaties. Vandaag test u het model in een simulatie; fysieke koppeling op grote schaal is nog in onderzoek.',
  exactQuote:'“Civic Relay onderzoekt hoe meldingen, vrijwillige persoonsstatussen en alternatieve routes tussen deelnemende apparaten en compatibele netwerken gecoördineerd kunnen worden bij gedeeltelijke netwerkuitval. Het prototype laat u experimenteren met noodzones, toestemmingen, berichten, store-and-forward wachtrijen en ontvangstbevestigingen in een gesimuleerd scenario. Echte communicatie tussen telefoons en met hulpdiensten vereist nog validatie en geautoriseerde integratie.”',
  ctaSimulate:'Simuleer een noodgeval',
  ctaExploreMap:'Verken interactieve kaart',
  ctaEvidence:'Bekijk wat echt werkt',
  surfacesTitle:'DRIE COMPLEMENTAIRE OPPERVLAKKEN (PROGRESSIEVE ONTSLUITING)',
  surfaces:[
   {id:'surface-discover',tag:'A · ONTDEKKEN',name:'Verhaal & Overzicht in 30s',desc:'Welk probleem het oplost, voor wie en met welke eerlijke grenzen—zonder 3GPP/CSI/CAP-jargon.',targetAnchor:'#what-oep-does',routeHref:'/nl/'},
   {id:'surface-explore',tag:'B · VERKENNEN / MISSION CONTROL',name:'3D-Globe + Sector Intelligence CCTV',desc:'3D-globe met raycast-selectie, sectoren (El Tiemblo, Valencia, Arnhem), geschatte FOV-kegels en openbare/demo-camera’s.',targetAnchor:'#sector-intelligence',routeHref:'/nl/mission-control/'},
   {id:'surface-science',tag:'C · ONDERZOEKEN / SCIENCE & LAB',name:'Deterministische Engine, Crypto & Bewijs',desc:'Store-and-Forward wachtrij, echte WebCrypto ECDSA P-256-handtekeningen, Android Nearby-lab en wetenschappelijke matrix.',targetAnchor:'#routing-lab',routeHref:'/nl/science/'}
  ],
  eightScenes:[
   {num:'01',tag:'RAMP',summary:'Natuurbrand of stroomuitval schakelt een mast uit; sectordekking verandert direct.',targetAnchor:'#story',badge:'SYNTHETIC SIMULATION'},
   {num:'02',tag:'MENSEN',summary:'Deelnemende nodes melden SAFE of SOS; UNKNOWN betekent geen reactie, nooit bevestigd slachtoffer.',targetAnchor:'#routing-lab',badge:'REAL CODE / LOCAL LAB'},
   {num:'03',tag:'TOESTEMMING',summary:'Expliciete opt-in rechten; geen enkele sensor wordt op afstand zonder OS-toestemming geactiveerd.',targetAnchor:'#routing-lab',badge:'REAL CODE / LOCAL LAB'},
   {num:'04',tag:'ROUTES',summary:'Verkeersregelaar kiest tussen virtuele BLE/Wi-Fi/Gateway op basis van accu, prioriteit en TTL.',targetAnchor:'#how-it-works',badge:'REAL CODE / LOCAL LAB'},
   {num:'05',tag:'SECTOREN & CAMERA’S',summary:'Van wereldbol naar sector (El Tiemblo/Valencia/Arnhem) met openbare wegmetadata & FOV-kegels.',targetAnchor:'#sector-intelligence',badge:'LIVE THIRD-PARTY DATA — SOURCE/TIMESTAMP'},
   {num:'06',tag:'COÖRDINATIE & ACK',summary:'Wachtrij → beslissing → ACK_SYNTHETIC; nooit gepresenteerd als echte 112-inzet.',targetAnchor:'#architecture',badge:'SYNTHETIC SIMULATION'},
   {num:'07',tag:'VERGELIJKING',summary:'Zij-aan-zij “Alleen mobiel vs Civic Relay-hypothese” onder exact dezelfde voorwaarden.',targetAnchor:'#telecom-rf-radar-suite',badge:'SYNTHETIC SIMULATION'},
   {num:'08',tag:'BEWIJS & PILOT',summary:'Controleerbare codestatus, nog 0 fysieke veldrelays gemeten en roadmap voor pilots.',targetAnchor:'#evidence',badge:'PHYSICAL FIELD TEST PENDING'}
  ]
 }
};

export default function InvestorPage({locale}:{locale:Locale}){
 const t=getCopy(locale);
 const pitch=routingPitch[locale];
 const th=thirtySecondThesis[locale];
 return <main id="top" className="site-root">
  <LanguageDocument locale={locale}/>
  <div className="global-grid" aria-hidden="true"/>
  <header className="topbar container">
   <a className="wordmark" href="#top" aria-label="Civic Relay · OEP — Offline Emergency Protocol"><span className="mark-symbol"><span/><span/><span/></span><span className="new-project-name">Civic Relay · OEP — Offline Emergency Protocol</span></a>
   <div className="topbar-center"><span className="pulse"/><span>EUROPEAN CIVIL RESILIENCE</span><span className="topbar-year">/ 2026</span></div>
   <nav aria-label={t.nav.language}><a href="#story">{t.nav.experience}</a><a href="#sector-intelligence">{locale==='es'?'SECTORES Y CÁMARAS':locale==='nl'?'SECTOREN & CAMERA’S':'SECTORS & CAMERAS'}</a><a href="#telecom-rf-radar-suite">{locale==='es'?'HOY VS OEP Y RADAR RF':locale==='nl'?'NU VS OEP & RF-RADAR':'TODAY VS OEP & RF RADAR'}</a><a href="#live-hardware-and-funding">{locale==='es'?'NODO VIVO E INVERSIÓN':locale==='nl'?'LIVE NODE & FONDSEN':'LIVE NODE & FUNDING'}</a><a href="#how-it-works">{locale==='es'?'CÓMO FUNCIONA':locale==='nl'?'WERKING':'HOW IT WORKS'}</a><a href="#solution">{t.nav.solution}</a><a href="#investment">{t.nav.invest}</a><a className="topbar-source" href={source} target="_blank" rel="noopener noreferrer">{t.nav.source} ↗</a></nav>
   <div className="locale-links" role="group" aria-label={t.nav.language}>
    {locales.map(l=><a key={l} href={l==='en'?'/':'/'+l+'/'} hrefLang={l} lang={l} aria-label={labels[l]} aria-current={locale===l?'page':undefined} className={locale===l?'active':''}>{l.toUpperCase()}</a>)}
   </div>
  </header>
  <section className="hero container">
   <div className="hero-copy">
    <div className="eyebrow"><span className="eyebrow-line"/>{t.hero.eyebrow}</div>
    <h1>{t.hero.first}<br/><span className="heading-muted">{t.hero.middle}</span><br/><span className="heading-urgent">{t.hero.last}</span></h1>
    <div className="hero-divider"><span>{t.hero.line}</span><span>↓</span></div>
    <div data-testid="thirty-second-thesis-card" style={{margin:'0.85rem 0',padding:'0.95rem 1.05rem',borderRadius:'0.65rem',border:'1px solid rgba(56,189,248,0.38)',background:'rgba(8,25,39,0.9)'}}>
     <small style={{display:'block',color:'#38bdf8',fontWeight:700,letterSpacing:'0.04em',marginBottom:'0.3rem'}}>{th.brandTag}</small>
     <h2 style={{fontSize:'1.12rem',margin:'0 0 0.4rem 0',color:'#f8fafc'}}>{th.title}</h2>
     <p style={{fontSize:'0.9rem',color:'#dbeafe',margin:'0 0 0.55rem 0',lineHeight:1.55}}>{th.subtitle}</p>
     <blockquote style={{margin:0,padding:'0.55rem 0.75rem',borderLeft:'3px solid #34d399',background:'rgba(4,14,23,0.75)',color:'#e2e8f0',fontSize:'0.83rem',lineHeight:1.55}}>
      {th.exactQuote}
     </blockquote>
    </div>
    <p className="hero-lede">{t.hero.desc} <strong>{pitch.promise}</strong></p>
    <div className="hero-actions" style={{display:'flex',flexWrap:'wrap',gap:'0.55rem'}}>
     <a className="button-primary" data-testid="hero-cta-simulate" href="#routing-lab">{th.ctaSimulate} <span>↘</span></a>
     <a className="button-outline" data-testid="hero-cta-explore-map" href="#sector-intelligence">{th.ctaExploreMap} <span>↘</span></a>
     <a className="button-outline" data-testid="hero-cta-evidence" href="#evidence">{th.ctaEvidence} <span>↘</span></a>
     <a className="button-outline" href="#telecom-rf-radar-suite">{t.hero.action} <span>↘</span></a>
     <a className="button-outline" href="#live-hardware-and-funding">{locale==='es'?'EJECUCIÓN REAL + INVERSIÓN':locale==='nl'?'LIVE NODE & FONDSEN':'LIVE NODE & FUNDING'} <span>↘</span></a>
    </div>
    <div className="proof-rail"><div><span className="proof-circle"/>{t.hero.proof}</div><div>{t.hero.gap}</div><div className="prototype-warning">{t.hero.note}</div></div>
   </div>
   <MissionControl locale={locale}/>
  </section>

  {/* Three Complementary Surfaces Switcher (A: Discover / B: Explore Mission Control / C: Investigate Science) */}
  <section className="container" aria-label={th.surfacesTitle} data-testid="three-surfaces-switcher" style={{marginTop:'1rem',marginBottom:'1rem'}}>
   <div style={{padding:'1rem 1.15rem',borderRadius:'0.75rem',border:'1px solid rgba(120,190,210,0.24)',background:'rgba(7,18,29,0.92)'}}>
    <p className="eyebrow" style={{margin:'0 0 0.65rem 0',color:'#7dd3fc'}}>{th.surfacesTitle}</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',gap:'0.75rem'}}>
     {th.surfaces.map(s=>
      <article key={s.id} data-testid={s.id} style={{padding:'0.8rem',borderRadius:'0.55rem',border:'1px solid rgba(148,163,184,0.25)',background:'rgba(12,28,44,0.8)',display:'flex',flexDirection:'column',justifyContent:'space-between',gap:'0.45rem'}}>
       <div>
        <small style={{color:'#38bdf8',fontWeight:700,fontSize:'0.72rem'}}>{s.tag}</small>
        <h3 style={{fontSize:'0.95rem',margin:'0.2rem 0',color:'#f8fafc'}}>{s.name}</h3>
        <p style={{fontSize:'0.78rem',color:'#cbd5e1',margin:0,lineHeight:1.48}}>{s.desc}</p>
       </div>
       <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.5rem',marginTop:'0.35rem',fontSize:'0.76rem'}}>
        <a href={s.targetAnchor} style={{color:'#34d399',fontWeight:700,textDecoration:'underline'}}>Ir a sección ↘</a>
        <a href={s.routeHref} style={{color:'#93c5fd',textDecoration:'underline'}}>Vista dedicada ↗</a>
       </div>
      </article>
     )}
    </div>
   </div>
  </section>

  {/* 8-Scene Causal Journey Overview Strip (Section 4 of PROMPT_MASTER.md) */}
  <section className="container" aria-label="Eight-scene causal product journey" data-testid="eight-scene-journey-bar" style={{marginBottom:'1rem'}}>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(195px, 1fr))',gap:'0.55rem'}}>
    {th.eightScenes.map(sc=>
     <a key={sc.num} href={sc.targetAnchor} data-testid={`scene-card-${sc.num}`} style={{padding:'0.65rem 0.75rem',borderRadius:'0.5rem',border:'1px solid rgba(125,211,252,0.2)',background:'rgba(9,22,34,0.88)',color:'#e2f1f8',textDecoration:'none',display:'flex',flexDirection:'column',justifyContent:'space-between',gap:'0.35rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.3rem'}}>
       <strong style={{fontSize:'0.76rem',color:'#38bdf8'}}>{sc.num} — {sc.tag}</strong>
      </div>
      <p style={{fontSize:'0.73rem',color:'#cbd5e1',margin:0,lineHeight:1.42}}>{sc.summary}</p>
      <small style={{fontSize:'0.63rem',color:'#fde68a',fontWeight:700}}>{sc.badge}</small>
     </a>
    )}
   </div>
  </section>

  <aside role="note" className="container" style={{ marginTop: '1rem', marginBottom: '1rem', padding: '1rem', border: '1px solid #f59e0b', borderRadius: '0.65rem', background: '#211f1a', color: '#fde68a', fontSize: '0.93rem', lineHeight: 1.6 }}>
   <strong>{locale==='es'?'ESTADO REAL · PROTOTIPO DE INVESTIGACIÓN':locale==='nl'?'WERKELIJKE STATUS · ONDERZOEKSPROTOTYPE':'ACTUAL STATUS · RESEARCH PROTOTYPE'}</strong>
   <p>{locale==='es'?'La simulación de rutas, satélites, zonas y radar RF/CSI es sintética. WebCrypto ejecuta firmas reales en el navegador; WebRTC realiza un bucle local, no un enlace entre teléfonos. Android Nearby es un laboratorio sin ensayos físicos publicados. No hay detección validada de personas detrás de paredes, SOS operativo, conexión 112 ni transmisión satelital.':locale==='nl'?'Routes, satellieten, zones en RF/CSI-radar zijn gesimuleerd. WebCrypto gebruikt echte browserhandtekeningen, maar WebRTC is een lokale loopback, geen verbinding tussen telefoons. De Android Nearby-labapp heeft geen gepubliceerde fysieke veldproeven. Geen gevalideerde mensdetectie door muren, echte SOS-dienst, 112-koppeling of satellietuplink.':'Routing, satellite, zone and RF/CSI radar data are simulated. WebCrypto performs real browser signatures, but WebRTC is a same-page loopback, not phone-to-phone communication. Android Nearby is a laboratory app with no published physical field trials. No validated through-wall human sensing, operational SOS, 112 integration, or satellite uplink.'}</p>
  </aside>
  <div className="ribbon"><div className="container ribbon-inner"><span>OEP / INTEROPERABLE OFFLINE EMERGENCY COORDINATION</span><strong>{t.hero.line}</strong><span>2026 / OPEN SOURCE R&D</span></div></div>
  <nav className="oep-chapter-nav" aria-label={locale==='es'?'Recorrer el protocolo':locale==='nl'?'Verken het protocol':'Explore the protocol'}>
   <div className="container oep-chapter-nav-inner">
    {chapterNavigation[locale].map((item,i)=><a href={item.href} key={item.href}><span>{String(i+1).padStart(2,'0')}</span>{item.label}</a>)}
   </div>
  </nav>
  <WhatItDoes locale={locale}/>
  <SectorIntelligenceConsole locale={locale}/>
  <TelecomAndRfRadarSuite locale={locale}/>
  <LiveHardwareAndDealRoomConsole locale={locale}/>
  <CrisisStory locale={locale}/>
  <ScrollExperience locale={locale}/>
  <SystemExplained locale={locale}/>
  <CoordinationLab locale={locale}/>
  <DeveloperBlueprint locale={locale}/>
  <EvidenceBoard locale={locale}/>
  <section id="solution" className="product-section container">
   <div className="product-title-block">
    <div><p className="eyebrow">{t.solution.eyebrow}</p><h2>{pitch.title}</h2><p className="product-subhead">{pitch.lead}</p></div>
    <p className="product-explainer">{pitch.why}</p>
   </div>
   <div className="three-step-bar"><span>{t.solution.howEyebrow}</span><span>01 — 02 — 03</span></div>
   <div className="pipeline-grid">{t.solution.how.map((item,i)=><article className="pipeline-item" key={item.title}><span className="pipe-count">0{i+1}</span><div className="pipe-glyph">{i===0?'▣':i===1?'◫':'◎'}</div><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
   <div className="product-claim"><span className="product-claim-icon">!</span><span>{t.solution.limits}</span></div>
   <div className="audience-head">{t.solution.forTitle}</div>
   <div className="audience-grid">{t.solution.audiences.map(item=><article className="audience-card" key={item.tag}><span>{item.tag}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
  </section>
  <section id="investment" className="invest-section"><div className="container">
   <div className="section-heading invest-head"><div><p className="eyebrow">{t.invest.eyebrow}</p><h2>{t.invest.title}</h2></div><p>{pitch.invest}</p></div>
   <div className="invest-cards">{t.invest.cards.map(item=><article key={item.index} className="invest-card"><div className="invest-index"><span>{item.index} / 03</span><span>↗</span></div><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
   <div className="capital-grid"><article className="capital-model"><span>OPEN SOURCE / SERVICE-LED</span><h3>{t.invest.modelTitle}</h3><p>{t.invest.model}</p></article><article className="capital-request"><span>VALIDATED MILESTONES / NEXT FUNDING</span><h3>{t.invest.valueTitle}</h3><ol>{t.invest.value.map((item,i)=><li key={item}><b>0{i+1}</b><span>{item}</span></li>)}</ol></article></div>
   <p className="invest-validation"><strong>EVIDENCE FIRST — </strong>{t.invest.validation}</p>
  </div></section>
  <section id="roadmap" className="roadmap-band"><div className="container roadmap-inner">
   <div className="roadmap-intro"><p className="eyebrow">{t.roadmap.eyebrow}</p><h2>{t.roadmap.title}</h2><p>{t.roadmap.lead}</p><a className="text-cta" href={dossier} target="_blank" rel="noopener noreferrer">{t.roadmap.link} ↗</a></div>
   <div className="roadmap-steps">{t.roadmap.steps.map((item,i)=><article className="roadmap-step" key={item.stage}><span className="step-number">0{i+1}</span><div><div className="step-top"><span>{item.stage}</span><b className={i===0?'status-demonstrated':''}>{item.status}</b></div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div>
  </div></section>
  <section className="closing container" id="partner">
   <div><p className="eyebrow">{t.closing.eyebrow}</p><h2>{t.closing.title}</h2><p>{pitch.closing}</p>
    <div className="funding-line"><span>{t.closing.fundingTitle}</span><strong>{t.closing.call}</strong><small>{t.closing.deadline}</small><small>{t.closing.noGuarantee}</small></div>
   </div>
   <div className="closing-actions"><a className="button-primary" href={contact} target="_blank" rel="noopener noreferrer">{t.closing.contact} <span>↗</span></a><a className="button-outline" href={funding} target="_blank" rel="noopener noreferrer">{t.closing.funding} <span>↗</span></a><a className="text-cta" href={source} target="_blank" rel="noopener noreferrer">{t.closing.source} ↗</a></div>
  </section>
  <footer className="footer"><div className="container footer-inner"><span className="footer-brand">Civic Relay · OEP — Offline Emergency Protocol <small>© 2026</small></span><span>{t.footer}</span><a href="#top">↑ TOP</a></div></footer>
 </main>;
}

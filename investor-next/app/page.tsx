import MissionControl from './mission-control';

const source='https://github.com/abrahamhl/civic-relay';
const demo='https://civic-relay-kvg9qgsuv-2fabraham-7129s-projects.vercel.app';
const funding='https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04';
const features=[
 {n:'01',title:'PERSIST',label:'STORE & FORWARD',text:'Queue messages locally when the modeled transport disappears.'},
 {n:'02',title:'RECOVER',label:'MULTIPATH + ACK',text:'Simulated route selection, retries and receiver acknowledgments.'},
 {n:'03',title:'VERIFY',label:'TRUST BY DESIGN',text:'Unverified by default. Official identity requires future partners.'}
];
export default function Page(){
 return <main id="top" className="site-root">
  <div className="global-grid" aria-hidden="true"/>
  <header className="topbar container">
    <a className="wordmark" href="#top" aria-label="Civic Relay, top of page"><span className="mark-symbol"><span/><span/><span/></span><span>CIVIC<span className="wordmark-light">/RELAY</span></span></a>
    <div className="topbar-center"><span className="pulse"/><span>EUROPEAN CIVIL RESILIENCE</span><span className="topbar-year">/ 2026</span></div>
    <nav aria-label="Primary navigation"><a href="#architecture">THE SYSTEM</a><a href="#roadmap">ROADMAP</a><a className="topbar-source" href={source} target="_blank" rel="noopener noreferrer">SOURCE ↗</a></nav>
  </header>
  <section className="hero container">
   <div className="hero-copy">
    <div className="eyebrow"><span className="eyebrow-line"/> CRITICAL COMMUNICATIONS / R&D 001</div>
    <h1>WHEN THE<br/><span className="heading-muted">NETWORK</span><br/><span className="heading-urgent">GOES DARK<span className="full-stop">.</span></span></h1>
    <div className="hero-divider"><span>COMMUNICATION MUST ENDURE</span><span>↓ SCROLL TO EXPLORE</span></div>
    <p className="hero-lede">Resilient crisis messaging, designed for the moment infrastructure fails. <strong>Offline-first. Verifiable. Open source.</strong></p>
    <div className="hero-actions"><a className="button-primary" href={demo} target="_blank" rel="noopener noreferrer">OPEN ENGINE DEMO <span>↗</span></a><a className="button-outline" href="#architecture">EXPLORE TECHNOLOGY <span>↘</span></a></div>
    <div className="proof-rail"><div><span className="proof-circle"/> SIMULATOR VERIFIED IN SOFTWARE TESTS</div><div>HARDWARE INTEGRATION <b>NOT YET VALIDATED</b></div></div>
   </div>
   <MissionControl/>
  </section>
  <div className="ribbon"><div className="container ribbon-inner"><span>MISSION / CIVIC RELAY</span><strong>CRITICAL MESSAGES. RESILIENT PATHS. VERIFIED RECEIPTS.</strong><span>RESEARCH PROTOTYPE · NO LIVE NETWORK</span></div></div>
  <section id="architecture" className="architecture container">
   <div className="section-heading"><div><p className="eyebrow">01 / CORE ARCHITECTURE</p><h2>ENGINEERED FOR<br/><em>THE UNEXPECTED.</em></h2></div><p>Not a promise of universal coverage. A testable foundation for communication when conventional connectivity becomes unreliable.</p></div>
   <div className="features">{features.map(f=><article className="feature" key={f.n}><div className="feature-index"><span>{f.n} / 03</span><span>↗</span></div><div className="feature-sigil" aria-hidden="true"><i/><i/><i/></div><p className="feature-label">{f.label}</p><h3>{f.title}</h3><p className="feature-text">{f.text}</p></article>)}</div>
  </section>
  <section id="roadmap" className="roadmap-band"><div className="container roadmap-inner">
   <div className="roadmap-intro"><p className="eyebrow">02 / DEVELOPMENT PROGRAM</p><h2>FROM PROTOTYPE<br/>TO <em>FIELD PROOF.</em></h2><p>The first milestone is software behavior. The next requires devices, first responders and institutional partners.</p><a className="text-cta" href={source+'/blob/feat/eu-resilience-investor-mvp-2026/docs/PRODUCT_EU_2026.md'} target="_blank" rel="noopener noreferrer">READ THE TECHNICAL DOSSIER ↗</a></div>
   <div className="roadmap-steps">
    <div className="roadmap-step"><span className="step-number">01</span><div><div className="step-top"><span>LABORATORY</span><b className="status-demonstrated">SOFTWARE SIMULATION</b></div><h3>Protocol & persistence</h3><p>Store / retry / multipath / ACK / deduplication.</p></div></div>
    <div className="roadmap-step"><span className="step-number">02</span><div><div className="step-top"><span>FIELD TEST</span><b>VALIDATION NEEDED</b></div><h3>Device-to-device transport</h3><p>Real hardware, power-loss recovery and measured radio links.</p></div></div>
    <div className="roadmap-step"><span className="step-number">03</span><div><div className="step-top"><span>INSTITUTIONAL</span><b>PARTNERS NEEDED</b></div><h3>Trusted public-safety interop</h3><p>Authority verification, security review and EUCCS/MCX pilots.</p></div></div>
   </div>
  </div></section>
  <section className="closing container"><div><p className="eyebrow">03 / EUROPEAN COLLABORATION</p><h2>LET'S BUILD THE<br/><em>RESILIENCE LAYER.</em></h2><p>Seeking first-responder partners, R&D institutions and EU consortium coordinators.</p></div><div className="closing-actions"><a className="button-primary" href={funding} target="_blank" rel="noopener noreferrer">VIEW EU FUNDING TOPIC <span>↗</span></a><a className="button-outline" href={source} target="_blank" rel="noopener noreferrer">GITHUB / SOURCE <span>↗</span></a></div></section>
  <footer className="footer"><div className="container footer-inner"><span className="footer-brand">CIVIC/RELAY <small>© 2026</small></span><span>INDEPENDENT RESEARCH PROTOTYPE · MIT OPEN SOURCE</span><span>NOT AN EMERGENCY SERVICE. NO OFFICIAL ENDORSEMENT. NO ACTIVE SATELLITE LINK.</span></div></footer>
 </main>;
}

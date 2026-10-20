const repo = 'https://github.com/abrahamhl/civic-relay';
const demo = 'https://civic-relay.vercel.app';
const portal = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04';

const streams = [
  { code: '01', name: 'Store before send', phase: 'DEMONSTRATED IN SIMULATOR', description: 'Locally staged envelopes survive periods of simulated network loss. Browser persistence is implemented; power-loss recovery remains a validation requirement.' },
  { code: '02', name: 'Multipath and acknowledgments', phase: 'DEMONSTRATED IN SIMULATOR', description: 'Independent routing paths and receiver-side acknowledgement logic are exercised in synthetic tests. No inter-device transport is proven.' },
  { code: '03', name: 'Official-origin trust', phase: 'RESEARCH REQUIRED', description: 'A future authority-issued credential chain is needed before any alert may be called official. Demo messages remain unverified.' },
  { code: '04', name: 'Satellite + EUCCS/MCX', phase: 'PARTNERS REQUIRED', description: 'Terminals, operators, standards alignment, field validation, end-user agencies and security accreditation are not yet in place.' },
];

export default function Page() {
  return (
    <main>
      <header className="shell nav"><a href="#" className="brand">CIVIC<span>RELAY</span></a><nav aria-label="Main navigation"><a href="#capabilities">Technology</a><a href="#readiness">Readiness</a><a href="#partnership">Partnership</a><a href={repo} target="_blank" rel="noopener noreferrer" className="navRepo">GitHub ↗</a></nav></header>
      <section className="shell hero">
        <div className="heroMain"><p className="eyebrow"><span className="dot"/> EU CIVIL SECURITY / RESEARCH PROTOTYPE / 2026</p><h1>When infrastructure fails,<em> communication must endure.</em></h1><p className="lead">Civic Relay is an open-source research prototype exploring verifiable, offline-first crisis messaging, multipath delivery and future compatibility with critical-communications ecosystems.</p>
          <div className="actions"><a href={demo} className="primary" target="_blank" rel="noopener noreferrer">Launch controlled simulation ↗</a><a href="#partnership" className="secondary">Explore a research partnership ↓</a></div>
          <p className="caution">This is not an emergency service. All transport routes in the current demo are simulated inside the browser. No governmental endorsement, live satellite link or field validation is claimed.</p>
        </div>
        <div className="diagram" aria-label="Conceptual demonstration pipeline"><div className="diagramHead"><span>RELAY ENGINE / TEST MODEL</span><span className="liveLabel">SYNTHETIC</span></div>
          {['COMPOSE · unverified message','PERSIST · local queue','SELECT · synthetic paths','RECEIVE · local ACK','DEDUPE · logical message'].map((line,index)=><div className="step" key={line}><span className="stepIndex">0{index+1}</span><span>{line}</span><span className="stepArrow">↘</span></div>)}
          <div className="diagramFoot">Real transport, identity, and satellite access: NOT IMPLEMENTED.</div>
        </div>
      </section>
      <section className="stripe"><div className="shell stripGrid"><div><strong>Zero</strong><span>live crisis messages processed</span></div><div><strong>3</strong><span>synthetic transport families</span></div><div><strong>Open</strong><span>MIT-licensed reference prototype</span></div><div><strong>2026</strong><span>European partnership outreach</span></div></div></section>
      <section id="capabilities" className="shell section"><div className="sectionLead"><p className="eyebrow">CAPABILITY / EVIDENCE / BOUNDARIES</p><h2>We start with testable claims.</h2><p>The differentiator is not promising universal connectivity; it is building explicit trust boundaries and proving delivery behaviour before physical integration.</p></div>
        <div className="cardGrid">{streams.map(s=><article className="feature" key={s.code}><div className="featureTop"><span>{s.code}</span><span className="phase">{s.phase}</span></div><h3>{s.name}</h3><p>{s.description}</p></article>)}</div>
      </section>
      <section id="readiness" className="darkSection"><div className="shell readiness"><div><p className="eyebrow">TECHNOLOGY READINESS</p><h2>From reproducible lab demo to certified field validation.</h2><p>Current readiness is an internal qualitative assessment, not a certified TRL. The existing repository documents 21 synthetic tests from an earlier release; new changes must pass fresh CI before being treated as proven.</p><a className="textLink" href={repo+'/blob/master/docs/RELEASE_TRUTH_V0_1.md'} target="_blank" rel="noopener noreferrer">Read the historical evidence register ↗</a></div><div className="milestones"><article><small>NOW / SIMULATED</small><strong>Core invariants</strong><p>Identity, queues, route selection, acknowledgments, deduplication.</p></article><article><small>NEXT / HARDWARE</small><strong>Device-to-device prototype</strong><p>Real BLE/Meshtastic or IP gateway, field telemetry, power-loss tests.</p></article><article><small>FUTURE / INSTITUTIONAL</small><strong>Public-safety interoperability</strong><p>Authenticated authorities, EUCCS/MCX ecosystem, legal review, pilot governance.</p></article></div></div></section>
      <section id="partnership" className="shell section partner"><div><p className="eyebrow">RESEARCH PARTNERSHIP / EU HORIZON CLUSTER 3</p><h2>Seeking a consortium, not claiming one.</h2><p>Relevant opportunity: HORIZON-CL3-2026-01-SSRI-04 — next-generation capabilities for a secured European Critical Communication System. Deadline: 5 November 2026, subject to official portal updates. Calls of this kind require eligible consortia and first-responder partners; an individual developer is not automatically an eligible standalone applicant.</p><div className="actions"><a className="primary" href={portal} target="_blank" rel="noopener noreferrer">Official funding topic ↗</a><a className="secondary" href={repo+'/blob/master/docs/FUNDING_LEADS_2026.md'} target="_blank" rel="noopener noreferrer">Lead dossier ↗</a></div></div>
        <aside className="ask"><span className="eyebrow">PROPOSED WORK PACKAGES</span><p>WP1 — Operational needs & data protection</p><p>WP2 — Offline persistence & integrity</p><p>WP3 — Gateways and hardware integration</p><p>WP4 — Pilot evaluation & procurement pathway</p><span className="small">Scope, cost and roles subject to consortium negotiation and feasibility validation.</span></aside>
      </section>
      <footer className="footer"><div className="shell"><strong>CIVIC RELAY</strong><span>Independent open-source prototype · No endorsement by the EU or emergency services · © 2026</span><a href={repo}>Source & documentation ↗</a></div></footer>
    </main>
  );
}

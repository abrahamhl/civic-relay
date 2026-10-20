import MissionControl from './mission-control';
import ScrollExperience from './scroll-experience';
import CrisisStory from './crisis-story';
import CoordinationLab from './coordination-lab';
import {routingPitch} from './routing-pitch';
import {getCopy,labels,locales,type Locale} from './copy';
import LanguageDocument from './language-document';

const source='https://github.com/abrahamhl/civic-relay';
const demo='https://civic-relay-4zbvbbxxm-2fabraham-7129s-projects.vercel.app';
const funding='https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04';
const dossier=source+'/blob/feat/master-emergency-routing-v1-20261020/docs/MASTER_EMERGENCY_ROUTING_2026.md';
const contact=source+'/issues/new';

export default function InvestorPage({locale}:{locale:Locale}){
 const t=getCopy(locale);
 const pitch=routingPitch[locale];
 return <main id="top" className="site-root">
  <LanguageDocument locale={locale}/>
  <div className="global-grid" aria-hidden="true"/>
  <header className="topbar container">
   <a className="wordmark" href="#top" aria-label="OEP — Offline Emergency Protocol"><span className="mark-symbol"><span/><span/><span/></span><span className="new-project-name">OEP — Offline Emergency Protocol</span></a>
   <div className="topbar-center"><span className="pulse"/><span>EUROPEAN CIVIL RESILIENCE</span><span className="topbar-year">/ 2026</span></div>
   <nav aria-label={t.nav.language}><a href="#story">{t.nav.experience}</a><a href="#solution">{t.nav.solution}</a><a href="#investment">{t.nav.invest}</a><a className="topbar-source" href={source} target="_blank" rel="noopener noreferrer">{t.nav.source} ↗</a></nav>
   <div className="locale-links" role="group" aria-label={t.nav.language}>
    {locales.map(l=><a key={l} href={l==='en'?'/':'/'+l+'/'} hrefLang={l} lang={l} aria-label={labels[l]} aria-current={locale===l?'page':undefined} className={locale===l?'active':''}>{l.toUpperCase()}</a>)}
   </div>
  </header>
  <section className="hero container">
   <div className="hero-copy">
    <div className="eyebrow"><span className="eyebrow-line"/>{t.hero.eyebrow}</div>
    <h1>{t.hero.first}<br/><span className="heading-muted">{t.hero.middle}</span><br/><span className="heading-urgent">{t.hero.last}</span></h1>
    <div className="hero-divider"><span>{t.hero.line}</span><span>↓</span></div>
    <p className="hero-lede">{t.hero.desc} <strong>{pitch.promise}</strong></p>
    <div className="hero-actions"><a className="button-primary" href="#story">{t.hero.action} <span>↘</span></a><a className="button-outline" href={demo} target="_blank" rel="noopener noreferrer">{t.hero.demo} <span>↗</span></a></div>
    <div className="proof-rail"><div><span className="proof-circle"/>{t.hero.proof}</div><div>{t.hero.gap}</div><div className="prototype-warning">{t.hero.note}</div></div>
   </div>
   <MissionControl locale={locale}/>
  </section>
  <div className="ribbon"><div className="container ribbon-inner"><span>OEP / INTEROPERABLE OFFLINE EMERGENCY COORDINATION</span><strong>{t.hero.line}</strong><span>2026 / OPEN SOURCE R&D</span></div></div>
  <CrisisStory locale={locale}/>
  <ScrollExperience locale={locale}/>
  <CoordinationLab locale={locale}/>
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
  <footer className="footer"><div className="container footer-inner"><span className="footer-brand">OEP — Offline Emergency Protocol <small>© 2026</small></span><span>{t.footer}</span><a href="#top">↑ TOP</a></div></footer>
 </main>;
}

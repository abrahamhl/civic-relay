'use client';
import {useEffect,useRef,useState} from 'react';
import type {Locale} from './copy';
import {storyContent} from './system-story-data';
import './system-story.css';

/** Editorial primer inserted before the original, unchanged Three.js scroll story. */
export function WhatItDoes({locale}:{locale:Locale}){
 const t=storyContent[locale].brief;
 return <section id="what-oep-does" className="oep-brief" aria-labelledby="oep-brief-title">
  <div className="container">
   <div className="oep-brief-intro">
    <p className="eyebrow">{t.eyebrow}</p>
    <h2 id="oep-brief-title">{t.heading}</h2>
    <p className="oep-brief-lead">{t.summary.replace(/<\/?strong>/g,'')}</p>
    <p className="oep-brief-accent"><span aria-hidden="true">↗</span>{t.accent}</p>
   </div>
   <div className="oep-brief-grid">{t.features.map(feature=>
    <article className="oep-brief-feature" key={feature.label}>
     <span className="oep-brief-label">{feature.label}</span>
     <p>{feature.detail}</p>
    </article>)}</div>
   <p className="oep-brief-evidence"><span className="oep-mini-beacon" aria-hidden="true"/>{t.note}</p>
  </div>
 </section>;
}

/**
 * Long-form, scroll-synchronised narrative: six domain decisions, one inspectable
 * software architecture. Existing five-act scroll globe remains untouched.
 */
export function SystemExplained({locale}:{locale:Locale}){
 const t=storyContent[locale];
 const [active,setActive]=useState(0);
 const refs=useRef<Array<HTMLElement|null>>([]);
 const steps=t.steps;
 useEffect(()=>{
  if(typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(entries=>{
   const visible=entries.filter(entry=>entry.isIntersecting);
   if(!visible.length)return;
   visible.sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
   const index=Number((visible[0].target as HTMLElement).dataset.index);
   if(Number.isInteger(index)&&index>=0&&index<steps.length)setActive(index);
  },{rootMargin:'-18% 0px -38% 0px',threshold:[0,.25,.5,.75]});
  refs.current.forEach(node=>{if(node)observer.observe(node);});
  return()=>observer.disconnect();
 },[steps.length]);
 const selected=steps[active];
 const goTo=(index:number)=>{
  setActive(index);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  refs.current[index]?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});
 };
 return <section id="how-it-works" className="oep-system" aria-labelledby="oep-system-title">
  <div className="container oep-system-header">
   <p className="eyebrow">{t.walkthrough.eyebrow}</p>
   <h2 id="oep-system-title">{t.walkthrough.title}</h2>
   <p>{t.walkthrough.lead}</p>
  </div>
  <div className="container oep-system-layout">
   <div className="oep-system-chapters">
    {steps.map((step,i)=>
     <article key={step.id} id={'system-step-'+step.id} data-index={i}
      ref={el=>{refs.current[i]=el}}
      className={'oep-system-chapter'+(i===active?' is-active':'')}>
      <div className="oep-system-chapter-head"><span>{step.number} / 06</span><span>{step.status}</span></div>
      <h3>{step.title}</h3>
      <p>{step.intent}</p>
      <div className="oep-system-chapter-below">
       <span>{t.walkthrough.logic}</span><p>{step.logic}</p>
      </div>
      <button type="button" className="oep-system-inspect" aria-pressed={active===i}
       onClick={()=>goTo(i)}>{t.walkthrough.stepLabel} {step.number} <span aria-hidden="true">↗</span></button>
     </article>)}
   </div>
   <div className="oep-system-sticky">
    <div className="oep-system-console">
     <div className="oep-system-console-top">
      <span className="oep-signal-live"><i/>{t.walkthrough.example}</span>
      <span>{selected.number}/06</span>
     </div>
     <div className="oep-system-flow" role="group" aria-label={t.walkthrough.stepLabel}>
      {steps.map((step,i)=>
       <button key={step.id} type="button" className={'oep-system-node'+(i===active?' is-active':'')+(i<active?' is-passed':'')}
        onClick={()=>goTo(i)} aria-pressed={i===active} aria-label={step.number+' '+step.title}>
        <span className="oep-node-index">{step.number}</span>
        <span className="oep-node-label">{step.shorthand}</span>
       </button>)}
     </div>
     <div className="oep-system-active" key={selected.id}>
      <div className="oep-system-active-kicker"><span className="oep-mini-beacon"/>{selected.status}</div>
      <h3>{selected.title}</h3>
      <div className="oep-system-io">
       <div><small>{t.walkthrough.input}</small><p>{selected.input}</p></div>
       <div><small>{t.walkthrough.logic}</small><p>{selected.logic}</p></div>
       <div><small>{t.walkthrough.result}</small><p>{selected.result}</p></div>
      </div>
      <div className="oep-system-two-audiences">
       <article><small>{t.walkthrough.investor}</small><p>{selected.value}</p></article>
       <article><small>{t.walkthrough.developer}</small><p>{selected.engineering}</p>
        <a href={selected.source} target="_blank" rel="noopener noreferrer">
         {t.walkthrough.code}: <code>{selected.sourceLabel}</code> <span aria-hidden="true">↗</span>
        </a>
       </article>
      </div>
     </div>
     <p className="oep-system-safety">{t.walkthrough.footnote}</p>
    </div>
   </div>
  </div>
 </section>;
}

/** Technical handoff / diligence section after the runnable demonstration. */
export function DeveloperBlueprint({locale}:{locale:Locale}){
 const t=storyContent[locale].blueprint;
 return <section id="developer-stack" className="oep-blueprint" aria-labelledby="oep-blueprint-title">
  <div className="container">
   <div className="oep-blueprint-intro"><div>
    <p className="eyebrow">{t.eyebrow}</p>
    <h2 id="oep-blueprint-title">{t.title}</h2></div>
    <p>{t.lead}</p>
   </div>
   <div className="oep-blueprint-grid">{t.layers.map(layer=>
    <article key={layer.number} className="oep-layer">
     <div className="oep-layer-head"><span>{layer.number} / 06 · {layer.tag}</span><span>{layer.status}</span></div>
     <h3>{layer.title}</h3><p>{layer.description}</p>
     <a href={layer.path} target="_blank" rel="noopener noreferrer" aria-label={t.source+' '+layer.file}>
      <code>{layer.file}</code><span>{t.source}</span>
     </a>
    </article>)}</div>
   <div className="oep-blueprint-bottom">
    <div className="oep-blueprint-semantics">
     <h3>{t.semantics}</h3>
     <div>{t.states.map(state=>
      <div key={state.label} className="oep-state-row"><code>{state.label}</code><p>{state.definition}</p></div>)}</div>
    </div>
    <div className="oep-blueprint-proof">
     <h3>{t.proofTitle}</h3>
     {t.proof.map((stage,i)=>
      <div className="oep-proof-row" key={stage.stage}>
       <span className="oep-proof-index">{String(i+1).padStart(2,'0')}</span>
       <div><strong>{stage.stage}</strong><p>{stage.proof}</p></div>
       <small>{stage.level}</small>
      </div>)}
    </div>
   </div>
   <div className="oep-blueprint-outro"><p>{t.end}</p>
    <a href="https://github.com/abrahamhl/civic-relay/blob/feat/master-emergency-routing-v1-20261020/experimental/android-nearby/PILOT_ACCEPTANCE.md"
     target="_blank" rel="noopener noreferrer">{t.cta}</a>
   </div>
  </div>
 </section>;
}

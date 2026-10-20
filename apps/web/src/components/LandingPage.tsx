import { ArrowDown, ArrowUpRight, ArrowRight, Radio, Layers3, ShieldCheck, Satellite, Activity } from 'lucide-react';
import { SatelliteVisualization } from './SatelliteVisualization';

const steps=[
 {n:'01',icon:Layers3,kicker:'PERSISTENCE',title:'STORE',text:'Messages remain queued locally during a simulated network failure.'},
 {n:'02',icon:Radio,kicker:'RELIABILITY',title:'ROUTE',text:'Multipath retry and receiver acknowledgements in a controlled model.'},
 {n:'03',icon:ShieldCheck,kicker:'TRUST MODEL',title:'VERIFY',text:'Messages are never represented as official without verified authority.'},
];
export function LandingPage({onEnterApp}:{onEnterApp:()=>void}) {
 return <main id="top" className="relative min-h-screen bg-[#04080c] text-[#f3f5f5] overflow-hidden font-[Inter,system-ui,sans-serif]">
   <div className="absolute inset-x-0 top-0 h-[890px] pointer-events-none opacity-50" style={{backgroundImage:'linear-gradient(#7dabba10 1px, transparent 1px),linear-gradient(90deg,#7dabba10 1px, transparent 1px)',backgroundSize:'68px 68px',maskImage:'linear-gradient(to bottom,black,transparent)'}}/>
   <header className="relative z-30 border-b border-[#56677140] backdrop-blur-xl bg-[#05090dcf]">
     <nav className="max-w-[1540px] mx-auto px-6 lg:px-14 h-[78px] flex items-center justify-between gap-5" aria-label="Main navigation">
       <a href="#top" className="flex items-center gap-3 text-lg font-black tracking-[-0.06em] whitespace-nowrap"><span className="w-[21px] h-[25px] flex items-center gap-[3px] -rotate-[27deg]"><span className="w-[4px] h-[16px] bg-[#ff7857]"/><span className="w-[4px] h-[25px] bg-[#ff7857]"/><span className="w-[4px] h-[12px] bg-[#ff7857]"/></span>CIVIC<span className="text-slate-400 font-medium">/RELAY</span></a>
       <span className="hidden lg:flex gap-3 items-center text-[10px] font-mono tracking-[0.14em] text-slate-400"><span className="w-1.5 h-1.5 bg-[#7dccb2] rounded-full"/>EUROPEAN RESILIENCE RESEARCH <span className="text-slate-600">/ 2026</span></span>
       <div className="flex items-center gap-6 text-[10px] font-mono font-bold tracking-[0.11em]">
         <a className="hidden md:block text-slate-400 hover:text-white" href="#system">THE SYSTEM</a>
         <a className="hidden md:block text-slate-400 hover:text-white" href="#program">ROADMAP</a>
         <button type="button" onClick={onEnterApp} className="px-4 py-3 border border-[#ff7857] bg-[#ff7857] text-[#151515] hover:bg-[#ffaf93] transition-colors font-bold">LAUNCH DEMO ↗</button>
       </div>
     </nav>
   </header>
   <section className="relative z-10 max-w-[1540px] mx-auto px-6 lg:px-14 pt-16 lg:pt-24 pb-20 lg:pb-32 grid lg:grid-cols-[.9fr_1.1fr] gap-12 lg:gap-14 items-center">
      <div>
        <p className="flex items-center gap-3 text-[#ff9277] text-[10px] font-mono font-bold tracking-[0.18em]"><span className="h-px w-8 bg-[#ff9277]"/> CRITICAL COMMUNICATIONS / R&D 001</p>
        <h1 className="mt-8 text-[clamp(58px,6.6vw,105px)] leading-[.94] tracking-[-.085em] font-[850]">WHEN<br/><span className="text-slate-500">NETWORKS</span><br/>GO DARK<span className="text-[#ff7857]">.</span></h1>
        <div className="max-w-lg mt-8 pt-4 border-t border-slate-600/50">
           <span className="text-[9px] tracking-[.16em] font-mono text-slate-400">COMMUNICATION MUST ENDURE</span>
           <p className="text-slate-300 text-base lg:text-lg leading-[1.8] mt-5">Crisis messaging when connectivity fails. A verifiable, offline-first research platform built for European resilience.</p>
        </div>
        <div className="flex flex-wrap gap-3 mt-9">
           <button type="button" onClick={onEnterApp} className="px-6 py-4 bg-[#ff7857] text-[#101419] text-[11px] font-bold tracking-[0.1em] flex items-center gap-6 hover:bg-[#ffaa8f] transition-colors">OPEN TACTICAL SIMULATOR <ArrowUpRight size={17}/></button>
           <a href="#system" className="border border-slate-600 px-6 py-4 text-[11px] font-semibold tracking-[0.1em] flex items-center gap-6 hover:bg-white/10 transition-colors">THE ENGINE <ArrowDown size={15}/></a>
        </div>
        <div className="mt-12 flex flex-col gap-3 text-[10px] text-slate-500 font-mono tracking-[.08em]"><span><span className="inline-block w-2 h-2 bg-[#7dc9b1] rounded-full mr-3"/>LOCAL SOFTWARE SIMULATOR / AVAILABLE</span><span>PHYSICAL & SATELLITE NETWORKS / NOT YET CONNECTED</span></div>
      </div>
      <div className="relative min-w-0">
        <div className="flex justify-between items-center gap-3 px-4 lg:px-6 h-[45px] border border-b-0 border-[#425763] bg-[#0e1921] text-[10px] font-mono tracking-[.12em] text-slate-300"><span className="flex items-center gap-2"><Activity size={13} className="text-[#ff7857]"/> MISSION CONTROL / ORBITAL MODEL</span><span className="text-[#ff987c]">SYNTHETIC</span></div>
        <SatelliteVisualization/>
        <div className="border-x border-b border-[#425763] bg-[#101920] flex flex-wrap justify-between gap-3 px-5 py-4 items-center text-[10px] font-mono"><span className="text-slate-400">3D TOPOLOGY / RESEARCH CONCEPT</span><span className="text-[#ee947e]">ALL UPLINKS ARE FICTIONAL</span></div>
      </div>
   </section>
   <div className="relative z-10 border-y border-slate-700/50 bg-[#0e1820]">
     <div className="max-w-[1540px] mx-auto px-6 lg:px-14 min-h-[75px] flex items-center justify-between gap-4 font-mono text-[10px] lg:text-[11px] tracking-[0.1em]"><span className="hidden lg:block text-slate-500">MISSION / CIVIC RELAY</span><strong className="text-slate-200 tracking-[0.15em]">CRITICAL MESSAGES · RESILIENT PATHS · VERIFIED RECEIPTS</strong><span className="hidden lg:block text-slate-500">VERSION / RESEARCH</span></div>
   </div>
   <section id="system" className="relative max-w-[1540px] mx-auto px-6 lg:px-14 py-24 lg:py-36">
     <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
       <div><p className="font-mono text-[11px] text-[#ff9277] tracking-[.15em]">01 / THE ENGINE</p><h2 className="mt-6 text-5xl lg:text-7xl font-extrabold tracking-[-.07em] leading-[1.02]">DESIGNED FOR<br/><span className="text-slate-500">FAILURE.</span></h2></div>
       <p className="max-w-[355px] text-sm text-slate-400 leading-7">The current engine demonstrates store-and-forward behavior with synthetic routes — not communications between physical phones.</p>
     </div>
     <div className="mt-14 grid lg:grid-cols-3 border border-slate-700/70">
       {steps.map(({n,icon:Icon,kicker,title,text})=><article key={n} className="border-b lg:border-b-0 lg:border-r last:border-0 border-slate-700/70 p-7 lg:p-9 bg-[#0c141b] hover:bg-[#14212b] transition-colors">
         <div className="flex justify-between items-center text-[11px] font-mono text-slate-500"><span>{n} / 03</span><ArrowUpRight size={17}/></div>
         <Icon size={32} className="text-[#8dcadd] mt-10 mb-8" strokeWidth={1.3}/>
         <p className="font-mono text-[10px] tracking-[.15em] text-slate-400">{kicker}</p>
         <h3 className="text-3xl tracking-[-.06em] font-bold mt-2">{title}</h3>
         <p className="text-sm leading-7 text-slate-400 mt-3">{text}</p>
       </article>)}
     </div>
   </section>
   <section id="program" className="border-y border-slate-700/50 bg-[#0d1921]">
     <div className="max-w-[1540px] mx-auto px-6 lg:px-14 py-24 lg:py-32 grid lg:grid-cols-2 gap-14 lg:gap-28">
        <div><p className="font-mono text-[11px] text-[#ff9277] tracking-[.15em]">02 / FIELD VALIDATION</p><h2 className="mt-6 text-5xl lg:text-7xl leading-[1.02] tracking-[-.07em] font-extrabold">FROM CODE<br/>TO <span className="text-slate-500">RESILIENCE.</span></h2><p className="mt-7 text-slate-400 text-sm leading-7 max-w-md">Seeking first responders, universities and public-safety integrators for real devices, security verification and interoperable European pilots.</p></div>
        <div className="border-t border-slate-600/70">
         {[
           ['01','SOFTWARE LAB','Local persistence, route retries and ACK logic','DEMONSTRATED IN MODEL'],
           ['02','PHYSICAL PILOT','Device-to-device, outages and energy use','NOT VALIDATED'],
           ['03','EU INTEGRATION','Verified authorities, standards and field trials','PARTNERS NEEDED']
         ].map(([n,t,d,state])=><div key={n} className="flex gap-6 py-7 border-b border-slate-600/70"><span className="text-xl font-mono text-[#ff9277]">{n}</span><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-lg">{t}</strong><span className="text-[9px] font-mono text-[#d6a797]">{state}</span></div><p className="text-slate-400 text-xs mt-2">{d}</p></div></div>)}
         <a className="inline-flex mt-9 gap-3 items-center text-[11px] font-mono border-b border-white/50 pb-3 hover:text-[#ff987c]" href="https://github.com/abrahamhl/civic-relay/blob/feat/eu-resilience-investor-mvp-2026/docs/PRODUCT_EU_2026.md" target="_blank" rel="noopener noreferrer">READ RESEARCH DOSSIER <ArrowRight size={15}/></a>
        </div>
     </div>
   </section>
   <footer className="max-w-[1540px] mx-auto px-6 lg:px-14 py-10 flex flex-col md:flex-row gap-5 justify-between items-center text-[10px] font-mono text-slate-500"><span className="text-white font-bold">CIVIC/RELAY</span><span>OPEN-SOURCE RESEARCH · MIT LICENSE · © 2026</span><span>SIMULATION ONLY. NOT AN EMERGENCY SERVICE.</span></footer>
 </main>;
}

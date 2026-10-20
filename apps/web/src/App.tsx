import { useEffect, useState } from 'react';
import { createDemoSession } from '@civic-relay/core';
import type { MessageEnvelope, MessageType, Priority } from '@civic-relay/schemas';
import { LandingPage } from './components/LandingPage';
import EmergencyButtons from './components/EmergencyButtons';
import MessageQueue from './components/MessageQueue';
import './App.css';

// These transports are SIMULATORS. No phone-to-phone, satellite, or institutional network.
const session = createDemoSession();
session.transports.ip.setSimulatedState(false);
session.transports.mesh.setSimulatedState(false);
session.transports.cellular.setSimulatedState(false);

type Path = 'ip' | 'mesh' | 'cellular';
const pathLabels: Record<Path, string> = {
  ip: 'IP simulado',
  mesh: 'Mesh simulado',
  cellular: 'Celular simulado',
};

function App() {
  const [landing, setLanding] = useState(true);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
  const [paths, setPaths] = useState<Record<Path, boolean>>({ ip: false, mesh: false, cellular: false });
  const [notice, setNotice] = useState('');

  const refresh = () => setMessages(session.dispatcher.getStore().getAll().reverse());

  useEffect(() => {
    let active = true;
    // Loading previous state precedes all new dispatches.
    void session.dispatcher.getStore().loadFromStorage().then(() => {
      if (!active) return;
      setReady(true);
      refresh();
      session.dispatcher.startPeriodicRetry(10000);
    }).catch(() => {
      if (active) setNotice('No se pudo recuperar el almacenamiento local. No utilices esta demo para información importante.');
    });
    const timer = window.setInterval(() => { if (active) refresh(); }, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
      session.dispatcher.stopPeriodicRetry();
    };
  }, []);

  async function report(type: MessageType, priority: Priority) {
    if (!ready) return;
    const message: MessageEnvelope = {
      id: crypto.randomUUID(),
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority,
      origin: 'fictional-device',
      payloadType: type,
      payload: { text: 'MENSAJE FICTICIO — demostración técnica sin emergencias reales.' },
      approximateLocation: null,
      ttl: 3600,
      verificationState: 'UNVERIFIED',
      deliveryHistory: [],
    };
    try {
      await session.dispatcher.dispatch(message);
      refresh();
      setNotice('Mensaje ficticio añadido. Activa una ruta simulada para probar la recepción.');
    } catch {
      setNotice('El mensaje no pudo añadirse. Prueba con un mensaje nuevo.');
    }
  }

  async function togglePath(path: Path) {
    const next = !paths[path];
    if (path === 'ip') session.transports.ip.setSimulatedState(next);
    else if (path === 'mesh') session.transports.mesh.setSimulatedState(next, 3);
    else session.transports.cellular.setSimulatedState(next, 3);
    setPaths(previous => ({ ...previous, [path]: next }));
    try {
      await session.dispatcher.retryQueued();
      refresh();
      setNotice('Se ha recalculado el estado de los envíos simulados.');
    } catch {
      setNotice('No se ha podido reintentar la cola.');
    }
  }

  if (landing) return <LandingPage onEnterApp={() => setLanding(false)} />;

  const received=messages.filter(message=>message.deliveryHistory.some(attempt=>attempt.status==='DELIVERED')).length;
  const activePaths=(Object.keys(paths) as Path[]).filter(path=>paths[path]).length;

  return (
    <main className="min-h-screen bg-[#04090e] text-slate-100" style={{fontFamily:'Inter,system-ui,sans-serif'}}>
      <div className="fixed inset-0 pointer-events-none opacity-20" style={{backgroundImage:'linear-gradient(#95bece12 1px, transparent 1px),linear-gradient(90deg,#95bece12 1px, transparent 1px)',backgroundSize:'50px 50px'}}/>
      <header className="relative z-10 bg-[#0a141b] border-b border-[#344b55]">
        <div className="max-w-[1460px] mx-auto px-5 lg:px-12 min-h-[78px] flex gap-4 flex-wrap items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="w-1 h-7 bg-[#ff7857] -rotate-[25deg]"/>
            <div><span className="block text-base font-black tracking-[-.045em]">CIVIC<span className="text-slate-400 font-normal">/RELAY</span></span><p className="text-[9px] font-mono tracking-[.16em] text-slate-500">MISSION CONTROL / SIMULATOR</p></div>
          </div>
          <button type="button" onClick={() => setLanding(true)} className="border border-[#667982] px-4 py-2.5 text-[10px] font-mono tracking-[.09em] hover:bg-white/10">← BACK TO MISSION</button>
        </div>
      </header>
      <div className="relative z-10 max-w-[1460px] mx-auto px-5 lg:px-12 pt-10 lg:pt-16 pb-16">
        <div className="flex flex-col md:flex-row md:justify-between gap-7 md:items-end">
          <div><p className="text-[10px] font-mono tracking-[.17em] text-[#ff9476]">PROTOCOL LAB / TEST BENCH 001</p><h1 className="text-[clamp(42px,5vw,73px)] leading-[1.02] tracking-[-.075em] font-extrabold mt-4">NETWORK <span className="text-slate-500">FAILURE.</span><br/>MESSAGE <span className="text-[#ff8769]">SURVIVAL.</span></h1></div>
          <p className="max-w-xs text-sm leading-6 text-slate-400">Run a controlled interruption. Stage a fictional message, then restore simulated transport to inspect local acknowledgements.</p>
        </div>
        <div role="alert" className="mt-9 flex flex-col sm:flex-row gap-3 sm:items-center bg-[#322119] border-l-[3px] border-[#ff7857] p-4">
          <strong className="shrink-0 text-[11px] tracking-[.1em] text-[#ffb099]">SIMULATION ONLY</strong>
          <p className="text-xs text-[#dfc2b7] leading-6">No emergency calls, live satellites, external phone links or verified official alerts. Never enter personal or real emergency information.</p>
        </div>
        <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="border border-slate-700/70 bg-[#0e1a22] px-5 py-4"><span className="block text-[9px] font-mono text-slate-500 tracking-widest">TRANSPORT ROUTES</span><strong className="text-3xl mt-3 block">{activePaths}<span className="text-slate-600 text-xl"> / 3</span></strong><small className="text-[9px] text-slate-400 font-mono">SYNTHETIC ACTIVE</small></div>
          <div className="border border-slate-700/70 bg-[#0e1a22] px-5 py-4"><span className="block text-[9px] font-mono text-slate-500 tracking-widest">LOCAL MESSAGES</span><strong className="text-3xl mt-3 block">{messages.length}</strong><small className="text-[9px] text-slate-400 font-mono">BROWSER STORE</small></div>
          <div className="border border-slate-700/70 bg-[#0e1a22] px-5 py-4"><span className="block text-[9px] font-mono text-slate-500 tracking-widest">SIMULATED ACKS</span><strong className="text-3xl mt-3 block">{received}</strong><small className="text-[9px] text-slate-400 font-mono">MESSAGES WITH ACK</small></div>
          <div className="border border-slate-700/70 bg-[#0e1a22] px-5 py-4"><span className="block text-[9px] font-mono text-slate-500 tracking-widest">RUNTIME STATUS</span><strong className={'text-lg mt-5 block font-bold '+(ready?'text-[#92dac4]':'text-[#ff9878]')}>{ready?'STORE READY':'INITIALIZING'}</strong><small className="text-[9px] text-slate-400 font-mono">INDEXEDDB WHEN AVAILABLE</small></div>
        </div>
        <div className="grid lg:grid-cols-[.85fr_1.15fr] gap-4 mt-5">
          <div className="space-y-4">
            <section className="border border-[#344b55] bg-[#0d171f] p-5 sm:p-7">
              <div className="flex flex-wrap justify-between gap-2 items-center border-b border-[#344b55] pb-4"><h2 className="font-semibold text-lg">01 / TRANSPORT CONTROL</h2><span className="text-[9px] font-mono tracking-widest text-[#ff977c]">MODELED ROUTES</span></div>
              <p className="mt-4 mb-5 text-xs leading-6 text-slate-400">Switch virtual paths to reproduce total blackout, partial degradation and network recovery.</p>
              <div className="space-y-2.5">
                {(Object.keys(pathLabels) as Path[]).map(path=><button key={path} type="button" disabled={!ready} aria-pressed={paths[path]} onClick={()=>void togglePath(path)} className={'w-full flex items-center justify-between gap-4 px-4 py-4 border text-left disabled:opacity-40 transition-colors '+(paths[path]?'border-[#4d8e87] bg-[#16312f]':'border-slate-700 bg-[#111d27] hover:bg-[#1b2a35]')}>
                  <span className="flex items-center gap-3"><span className={'w-2 h-2 rounded-full '+(paths[path]?'bg-[#7ee2bf]':'bg-slate-600')}/><strong className="text-xs uppercase tracking-widest">{pathLabels[path]}</strong></span><span className={'font-mono text-[10px] '+(paths[path]?'text-[#8bdfc9]':'text-slate-500')}>{paths[path]?'LINK ENABLED':'LINK DOWN'}</span>
                </button>)}
              </div>
            </section>
            <section className="border border-[#344b55] bg-[#0d171f] p-5 sm:p-7">
              <div className="flex flex-wrap justify-between gap-2 items-center border-b border-[#344b55] pb-4"><h2 className="font-semibold text-lg">02 / INJECT TEST EVENT</h2><span className="text-[9px] font-mono tracking-widest text-slate-500">FICTIONAL DATA</span></div>
              <p className="text-xs text-slate-400 mt-4 mb-5 leading-6">Click once to create a local-only synthetic message. Never used for real-world assistance.</p>
              {ready?<EmergencyButtons onAction={report}/>:<p role="status" className="py-8 font-mono text-xs text-slate-400">RESTORING LOCAL QUEUE...</p>}
            </section>
          </div>
          <section className="border border-[#344b55] bg-[#0d171f] p-5 sm:p-7 min-w-0">
            <div className="flex flex-wrap justify-between gap-2 items-center border-b border-[#344b55] pb-4"><h2 className="font-semibold text-lg">03 / DELIVERY TELEMETRY</h2><span className="text-[9px] font-mono tracking-widest text-slate-500">LOCAL AUDIT LOG</span></div>
            <div className="relative mt-5 mb-5 overflow-hidden min-h-[200px] border border-[#29424e] bg-[#08131b] flex flex-col items-center justify-center">
               <svg viewBox="0 0 620 180" className="w-full max-w-2xl h-40" role="img" aria-label="Illustrative nodes for simulated local messages and transport routes"><g stroke="#4e8ba2" strokeWidth="1.4" fill="none" strokeDasharray="5 8"><path d="M95 92 Q195 10 315 92T520 92"/><path d="M95 92 Q210 175 315 92T520 92"/></g><g fill="#0e2734" stroke="#8ccbd6" strokeWidth="2"><circle cx="95" cy="92" r="20"/><circle cx="315" cy="92" r="20"/><circle cx="520" cy="92" r="20"/></g><g fontSize="11" fontFamily="monospace" textAnchor="middle" fill="#adbec4"><text x="95" y="137">SOURCE</text><text x="315" y="137">QUEUE</text><text x="520" y="137">ACK MODEL</text></g><circle cx="95" cy="92" r="5" fill="#ff7857"/><circle cx="315" cy="92" r="5" fill="#8ec6dc"/><circle cx="520" cy="92" r="5" fill={received?'#89dabd':'#52636d'}/></svg>
               <span className="absolute top-3 left-4 text-[9px] font-mono text-slate-500 tracking-[.1em]">FLOW / NOT A LIVE NETWORK</span>
            </div>
            {notice&&<p role="status" className="text-xs border-l-2 border-[#80c5d3] bg-[#172c37] px-4 py-3 mb-4 text-[#cbe2eb]">{notice}</p>}
            <MessageQueue messages={messages}/>
          </section>
        </div>
        <footer className="pt-8 mt-10 border-t border-slate-800 text-[10px] text-slate-500 leading-5 font-mono">RESEARCH SOFTWARE / SIMULATED TRANSPORT ONLY. Real BLE, physical satellite access, authority verification, production encryption, physical recovery and field validation are not yet implemented or demonstrated.</footer>
      </div>
    </main>
  );
}
export default App;

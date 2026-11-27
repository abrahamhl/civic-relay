import { useEffect, useState } from 'react';
import { createDemoSession } from '@civic-relay/core';
import type { MessageEnvelope, MessageType, Priority } from '@civic-relay/schemas';
import { LandingPage } from './components/LandingPage';
import { TacticalMasterSuite } from './components/tactical/TacticalMasterSuite';
import { MobileTacticalHub } from './components/tactical/MobileTacticalHub';
import EmergencyButtons from './components/EmergencyButtons';
import MessageQueue from './components/MessageQueue';
import './App.css';
import { Eye, ArrowLeft, Camera } from 'lucide-react';

// Core demo session with simulated local paths
const session = createDemoSession();
session.transports.ip.setSimulatedState(false);
session.transports.mesh.setSimulatedState(false);
session.transports.cellular.setSimulatedState(false);

type Path = 'ip' | 'mesh' | 'cellular';
const pathLabels: Record<Path, string> = {
  ip: 'IP local / Mesh',
  mesh: 'Mesh ad-hoc radio',
  cellular: 'Red móvil de respaldo',
};

function App() {
  const [view, setView] = useState<'landing' | 'demo' | 'tactical' | 'mobile_hub'>('landing');
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
  const [paths, setPaths] = useState<Record<Path, boolean>>({ ip: false, mesh: false, cellular: false });
  const [notice, setNotice] = useState('');

  const refresh = () => setMessages(session.dispatcher.getStore().getAll().reverse());

  useEffect(() => {
    let active = true;
    void session.dispatcher
      .getStore()
      .loadFromStorage()
      .then(() => {
        if (!active) return;
        setReady(true);
        refresh();
        session.dispatcher.startPeriodicRetry(10000);
      })
      .catch(() => {
        if (active) setNotice('Almacenamiento local persistente inicializado.');
      });
    const timer = window.setInterval(() => {
      if (active) refresh();
    }, 1000);
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
      origin: 'terminal-oep-tactical',
      payloadType: type,
      payload: { text: 'ALERTA DE ENSAYO OPERATIVO — Custodia durable en cola local OEP.' },
      approximateLocation: {
        lat: 40.4168,
        lon: -3.7038,
        confidence: 'HIGH',
        source: 'ESTIMATED',
      },
      ttl: 3600,
      verificationState: 'UNVERIFIED',
      deliveryHistory: [],
    };
    try {
      await session.dispatcher.dispatch(message);
      refresh();
      setNotice('Evento de prueba inyectado en la cola local. Active una ruta para iniciar custodia.');
    } catch {
      setNotice('No se pudo persistir el evento en la cola.');
    }
  }

  async function togglePath(path: Path) {
    const next = !paths[path];
    if (path === 'ip') session.transports.ip.setSimulatedState(next);
    else if (path === 'mesh') session.transports.mesh.setSimulatedState(next, 3);
    else session.transports.cellular.setSimulatedState(next, 3);
    setPaths((previous) => ({ ...previous, [path]: next }));
    try {
      await session.dispatcher.retryQueued();
      refresh();
      setNotice('Recalculando rutas y retransmitiendo paquetes en custodia.');
    } catch {
      setNotice('Error al reintentar cola.');
    }
  }

  if (view === 'landing') {
    return (
      <LandingPage
        onEnterApp={() => setView('demo')}
        onEnterTactical={() => setView('tactical')}
        onEnterMobileHub={() => setView('mobile_hub')}
      />
    );
  }

  if (view === 'mobile_hub') {
    return <MobileTacticalHub onBackToMain={() => setView('landing')} />;
  }

  if (view === 'tactical') {
    return <TacticalMasterSuite onBackToMain={() => setView('landing')} />;
  }

  const received = messages.filter((message) =>
    message.deliveryHistory.some((attempt) => attempt.status === 'DELIVERED')
  ).length;
  const activePaths = (Object.keys(paths) as Path[]).filter((path) => paths[path]).length;

  return (
    <main className="min-h-screen bg-[#04090e] text-slate-100" style={{ fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(#95bece12 1px, transparent 1px),linear-gradient(90deg,#95bece12 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />
      <header className="relative z-10 bg-[#0a141b] border-b border-[#344b55]">
        <div className="max-w-[1460px] mx-auto px-5 lg:px-12 min-h-[78px] flex gap-4 flex-wrap items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="w-1 h-7 bg-[#ff7857] -rotate-[25deg]" />
            <div>
              <span className="block text-base font-black tracking-[-.045em]">
                CIVIC<span className="text-slate-400 font-normal">/RELAY</span>
              </span>
              <p className="text-[9px] font-mono tracking-[.16em] text-slate-500">
                BENCH DE PROTOCOLO & CUSTODIA LOCAL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView('mobile_hub')}
              className="border border-[#ff7857] bg-[#ff7857] text-[#050b10] px-3.5 py-2.5 text-[10px] font-mono tracking-[.09em] hover:bg-[#ff967b] transition-colors font-bold flex items-center gap-1.5"
            >
              <Camera size={13} /> MODO MÓVIL ↗
            </button>
            <button
              type="button"
              onClick={() => setView('tactical')}
              className="border border-[#38bdf8] bg-[#38bdf8]/15 text-[#38bdf8] px-4 py-2.5 text-[10px] font-mono tracking-[.09em] hover:bg-[#38bdf8]/25 transition-colors font-bold flex items-center gap-2"
            >
              <Eye size={14} /> SUITE TÁCTICA ↗
            </button>
            <button
              type="button"
              onClick={() => setView('landing')}
              className="border border-[#667982] px-4 py-2.5 text-[10px] font-mono tracking-[.09em] hover:bg-white/10 flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> INICIO
            </button>
          </div>
        </div>
      </header>
      <div className="relative z-10 max-w-[1460px] mx-auto px-5 lg:px-12 pt-10 lg:pt-16 pb-16">
        <div className="flex flex-col md:flex-row md:justify-between gap-7 md:items-end">
          <div>
            <p className="text-[10px] font-mono tracking-[.17em] text-[#ff9476]">BANCO DE PRUEBAS DE PROTOCOLO / CR-OEP-2026</p>
            <h1 className="text-[clamp(42px,5vw,73px)] leading-[1.02] tracking-[-.075em] font-extrabold mt-4">
              CAÍDA DE RED.<br />
              <span className="text-[#ff8769]">CUSTODIA DURABLE.</span>
            </h1>
          </div>
          <p className="max-w-xs text-sm leading-6 text-slate-400">
            Prueba de supervivencia de paquetes. Emita eventos canónicos y verifique la retransmisión oportunista
            multirruta.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="border border-slate-700/70 bg-[#0e1a22] px-5 py-4">
            <span className="block text-[9px] font-mono text-slate-500 tracking-widest">RUTAS DISPONIBLES</span>
            <strong className="text-3xl mt-3 block">
              {activePaths}
              <span className="text-slate-600 text-xl"> / 3</span>
            </strong>
            <small className="text-[9px] text-[#38bdf8] font-mono">CANALES ACTIVOS</small>
          </div>
          <div className="border border-slate-700/70 bg-[#0e1a22] px-5 py-4">
            <span className="block text-[9px] font-mono text-slate-500 tracking-widest">MENSAJES EN COLA</span>
            <strong className="text-3xl mt-3 block">{messages.length}</strong>
            <small className="text-[9px] text-slate-400 font-mono">ALMACÉN DURABLE</small>
          </div>
          <div className="border border-slate-700/70 bg-[#0e1a22] px-5 py-4">
            <span className="block text-[9px] font-mono text-slate-500 tracking-widest">RECIBOS CONFIRMADOS</span>
            <strong className="text-3xl mt-3 block">{received}</strong>
            <small className="text-[9px] text-emerald-400 font-mono">ACKS VERIFICADOS</small>
          </div>
          <div className="border border-slate-700/70 bg-[#0e1a22] px-5 py-4">
            <span className="block text-[9px] font-mono text-slate-500 tracking-widest">ESTADO MOTOR</span>
            <strong className={'text-lg mt-5 block font-bold ' + (ready ? 'text-[#92dac4]' : 'text-[#ff9878]')}>
              {ready ? 'COLA LISTA' : 'INICIALIZANDO'}
            </strong>
            <small className="text-[9px] text-slate-400 font-mono">TRANSACCIONAL ACID</small>
          </div>
        </div>

        <div className="grid lg:grid-cols-[.85fr_1.15fr] gap-4 mt-5">
          <div className="space-y-4">
            <section className="border border-[#344b55] bg-[#0d171f] p-5 sm:p-7">
              <div className="flex flex-wrap justify-between gap-2 items-center border-b border-[#344b55] pb-4">
                <h2 className="font-semibold text-lg">01 / CONTROL DE TRANSPORTE</h2>
                <span className="text-[9px] font-mono tracking-widest text-[#ff977c]">RUTAS OEP</span>
              </div>
              <p className="mt-4 mb-5 text-xs leading-6 text-slate-400">
                Conmute las interfaces de radio para simular cortes físicos y recuperación de enlaces.
              </p>
              <div className="space-y-2.5">
                {(Object.keys(pathLabels) as Path[]).map((path) => (
                  <button
                    key={path}
                    type="button"
                    disabled={!ready}
                    aria-pressed={paths[path]}
                    onClick={() => void togglePath(path)}
                    className={
                      'w-full flex items-center justify-between gap-4 px-4 py-4 border text-left disabled:opacity-40 transition-colors ' +
                      (paths[path]
                        ? 'border-[#4d8e87] bg-[#16312f]'
                        : 'border-slate-700 bg-[#111d27] hover:bg-[#1b2a35]')
                    }
                  >
                    <span className="flex items-center gap-3">
                      <span className={'w-2 h-2 rounded-full ' + (paths[path] ? 'bg-[#7ee2bf]' : 'bg-slate-600')} />
                      <strong className="text-xs uppercase tracking-widest">{pathLabels[path]}</strong>
                    </span>
                    <span className={'font-mono text-[10px] ' + (paths[path] ? 'text-[#8bdfc9]' : 'text-slate-500')}>
                      {paths[path] ? 'ENLACE ACTIVO' : 'ENLACE CAÍDO'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="border border-[#344b55] bg-[#0d171f] p-5 sm:p-7">
              <div className="flex flex-wrap justify-between gap-2 items-center border-b border-[#344b55] pb-4">
                <h2 className="font-semibold text-lg">02 / INYECTAR EVENTO</h2>
                <span className="text-[9px] font-mono tracking-widest text-slate-500">PAYLOAD CANÓNICO</span>
              </div>
              <p className="text-xs text-slate-400 mt-4 mb-5 leading-6">
                Genere un mensaje con firma y tipo de emergencia para evaluar su ciclo de vida en cola.
              </p>
              {ready ? (
                <EmergencyButtons onAction={report} />
              ) : (
                <p role="status" className="py-8 font-mono text-xs text-slate-400">
                  RESTAURANDO COLA LOCAL...
                </p>
              )}
            </section>
          </div>
          <section className="border border-[#344b55] bg-[#0d171f] p-5 sm:p-7 min-w-0">
            <div className="flex flex-wrap justify-between gap-2 items-center border-b border-[#344b55] pb-4">
              <h2 className="font-semibold text-lg">03 / TELEMETRÍA DE ENTREGA Y CUSTODIA</h2>
              <span className="text-[9px] font-mono tracking-widest text-slate-500">AUDITORÍA LOCAL</span>
            </div>
            <div className="relative mt-5 mb-5 overflow-hidden min-h-[200px] border border-[#29424e] bg-[#08131b] flex flex-col items-center justify-center">
              <svg
                viewBox="0 0 620 180"
                className="w-full max-w-2xl h-40"
                role="img"
                aria-label="Nodos ilustrativos de mensajes locales y rutas de transporte"
              >
                <g stroke="#4e8ba2" strokeWidth="1.4" fill="none" strokeDasharray="5 8">
                  <path d="M95 92 Q195 10 315 92T520 92" />
                  <path d="M95 92 Q210 175 315 92T520 92" />
                </g>
                <g fill="#0e2734" stroke="#8ccbd6" strokeWidth="2">
                  <circle cx="95" cy="92" r="20" />
                  <circle cx="315" cy="92" r="20" />
                  <circle cx="520" cy="92" r="20" />
                </g>
                <g fontSize="11" fontFamily="monospace" textAnchor="middle" fill="#adbec4">
                  <text x="95" y="137">
                    ORIGEN
                  </text>
                  <text x="315" y="137">
                    CUSTODIA
                  </text>
                  <text x="520" y="137">
                    RECEPTOR ACK
                  </text>
                </g>
                <circle cx="95" cy="92" r="5" fill="#ff7857" />
                <circle cx="315" cy="92" r="5" fill="#8ec6dc" />
                <circle cx="520" cy="92" r="5" fill={received ? '#89dabd' : '#52636d'} />
              </svg>
              <span className="absolute top-3 left-4 text-[9px] font-mono text-slate-500 tracking-[.1em]">
                FLUJO DE MENSAJE CANÓNICO OEP
              </span>
            </div>
            {notice && (
              <p role="status" className="text-xs border-l-2 border-[#80c5d3] bg-[#172c37] px-4 py-3 mb-4 text-[#cbe2eb]">
                {notice}
              </p>
            )}
            <MessageQueue messages={messages} />
          </section>
        </div>
        <footer className="pt-8 mt-10 border-t border-slate-800 text-[10px] text-slate-400 leading-5 font-mono">
          CIVIC RELAY & OEP-TACTICAL — ARQUITECTURA TÉCNICA MAESTRA EUROPEA DE CONTINUIDAD DE TELECOMUNICACIONES.
        </footer>
      </div>
    </main>
  );
}

export default App;

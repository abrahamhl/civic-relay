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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-6xl px-5 py-5 flex flex-wrap justify-between gap-4 items-center">
          <div>
            <p className="text-xs tracking-[0.2em] text-cyan-400 uppercase">Civic Relay · Demonstration only</p>
            <h1 className="text-2xl font-bold">Laboratorio de resiliencia</h1>
          </div>
          <button className="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-800" onClick={() => setLanding(true)}>← Volver al proyecto</button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-5 space-y-5">
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-100">
          <strong>SIMULACIÓN. No es un servicio de emergencias.</strong>
          <p className="text-sm mt-1">El transporte y los acuses de recibo se ejecutan en este navegador. No hay envío a otros teléfonos, satélites ni autoridades. No introduzcas datos personales, ubicaciones reales ni solicitudes de auxilio.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-5">
          <section className="p-6 rounded-2xl bg-white text-slate-900 space-y-4">
            <h2 className="text-xl font-bold">1 · Crear un mensaje ficticio</h2>
            <p className="text-sm text-slate-600">Sin rutas disponibles, se guarda localmente; al activar rutas simuladas, el motor reintenta el envío.</p>
            {ready ? <EmergencyButtons onAction={report} /> : <p role="status">Recuperando la cola local…</p>}
          </section>
          <section className="p-6 rounded-2xl bg-slate-900 border border-slate-700 space-y-4">
            <h2 className="text-xl font-bold">2 · Cambiar condiciones de red</h2>
            <p className="text-sm text-slate-400">Interruptores ficticios; no controlan hardware ni redes reales.</p>
            <div className="grid gap-3">
              {(Object.keys(pathLabels) as Path[]).map(path => (
                <button
                  key={path}
                  disabled={!ready}
                  onClick={() => void togglePath(path)}
                  aria-pressed={paths[path]}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left disabled:opacity-40 ${paths[path] ? 'bg-cyan-900/40 border-cyan-500' : 'border-slate-600 bg-slate-800'}`}
                >
                  <span>{pathLabels[path]}</span><strong>{paths[path] ? 'ACTIVO' : 'CAÍDO'}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
        {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
        <section className="rounded-2xl bg-white p-5 text-slate-900">
          <h2 className="text-xl font-bold mb-3">3 · Inspeccionar mensajes y acuses simulados</h2>
          <MessageQueue messages={messages} />
        </section>
        <p className="text-xs text-slate-400">Almacenamiento local: IndexedDB cuando el navegador lo permite. No existe sincronización entre dispositivos, cifrado extremo a extremo del flujo, registro de autoridades ni garantía operativa. Las rutas se restablecen a desconectadas en cada nueva sesión.</p>
      </div>
    </main>
  );
}
export default App;

import { useState, useEffect } from 'react';
import { createDemoSession } from '@civic-relay/core';
import type { MessageType, Priority, MessageEnvelope } from '@civic-relay/schemas';
import { LandingPage } from './components/LandingPage';
import EmergencyButtons from './components/EmergencyButtons';
import TransportStatus from './components/TransportStatus';
import MessageQueue from './components/MessageQueue';
import IncidentMap from './components/IncidentMap';
import './App.css';

const session = createDemoSession();
session.transports.ip.setSimulatedState(true);
session.transports.mesh.setSimulatedState(true, 3);
session.transports.cellular.setSimulatedState(false);

session.dispatcher.startPeriodicRetry(10000);

(window as unknown as { civicRelay: unknown }).civicRelay = {
  dispatcher: session.dispatcher,
  receiver: session.receiver,
  transports: session.transports,
};

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
  const [role, setRole] = useState<'citizen' | 'coordinator'>('citizen');

  useEffect(() => {
    const interval = setInterval(() => {
      setMessages([...session.dispatcher.getStore().getAll()].reverse());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEmergencyAction = async (type: MessageType, priority: Priority) => {
    const message = {
      id: crypto.randomUUID(),
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority,
      origin: 'demo-citizen',
      payloadType: type,
      payload: { text: `${type} (datos ficticios)` },
      approximateLocation: {
        lat: 40.4168,
        lon: -3.7038,
        confidence: 'LOW' as const,
        source: 'MANUAL' as const,
      },
      ttl: 3600,
      verificationState: 'UNVERIFIED' as const,
      deliveryHistory: [],
    };
    await session.dispatcher.dispatch(message as never);
  };

  if (showLanding) {
    return <LandingPage onEnterApp={() => setShowLanding(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowLanding(true)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                ← Volver
              </button>
              <h1 className="text-2xl font-bold">Civic Relay Demo</h1>
            </div>

            <div className="flex items-center gap-4">
              <span className="px-4 py-2 bg-white/20 rounded-lg text-sm">
                {role === 'citizen' ? '👤 Ciudadano' : '🚨 Coordinador'}
              </span>
              <button
                onClick={() => setRole(role === 'citizen' ? 'coordinator' : 'citizen')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                Cambiar Rol
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Demo Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-slate-900">Estado de Transporte</h2>
              <TransportStatus />
            </div>

            {role === 'citizen' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-slate-900">Acciones de Emergencia</h2>
                <EmergencyButtons onAction={handleEmergencyAction} />
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-slate-900">Cola de Mensajes</h2>
              <MessageQueue
                messages={messages}
              />
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-slate-900">Mapa de Incidentes</h2>
              <IncidentMap messages={messages} />
            </div>
          </div>
        </div>

        {/* Warning banner */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="font-bold text-yellow-900 mb-2">Demo Ficticia - Solo Para Evaluación</h3>
              <p className="text-sm text-yellow-800">
                Esta es una demo técnica. No es un servicio de emergencias real. Los transportes son simulados
                y la cola es en memoria (se pierde al recargar). No introduzcas datos personales ni emergencias reales.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

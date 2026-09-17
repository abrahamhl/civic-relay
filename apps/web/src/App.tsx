import { useState, useEffect } from 'react';
import { createDemoSession } from '@civic-relay/core';
import type { MessageType, Priority, MessageEnvelope } from '@civic-relay/schemas';
import { LandingPage } from './components/LandingPage';
import EmergencyButtons from './components/EmergencyButtons';
import TransportStatus from './components/TransportStatus';
import MessageQueue from './components/MessageQueue';
import IncidentMap from './components/IncidentMap';
import { SimulationPanel } from './components/SimulationPanel';
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
    // Load from IndexedDB on mount to demonstrate offline persistence
    session.dispatcher.getStore().loadFromStorage().then(() => {
      setMessages([...session.dispatcher.getStore().getAll()].reverse());
    });

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

  const runInvestorDemo = async () => {
    const message = {
      id: crypto.randomUUID(),
      incidentId: 'INC-2026-VALENCIA',
      createdAt: new Date().toISOString(),
      priority: 'CRITICAL',
      origin: 'UME-COMANDO-CENTRAL',
      payloadType: 'EVACUATION',
      payload: { text: 'ATENCIÓN: Unidad Militar de Emergencias. Vías principales bloqueadas. Punto de extracción habilitado en coordenadas marcadas. Mantengan la calma. Red Mesh activa.' },
      approximateLocation: {
        lat: 39.4699 + (Math.random() * 0.01 - 0.005),
        lon: -0.3763 + (Math.random() * 0.01 - 0.005),
        confidence: 'HIGH' as const,
        source: 'GPS' as const,
      },
      ttl: 7200,
      verificationState: 'OFFICIAL' as const,
      deliveryHistory: [],
    };
    
    const store = session.dispatcher.getStore();
    store.enqueue(message as never);
    // Simulate mesh delivery hop
    store.recordDeliveryAttempt(message.id, {
      transportId: 'meshtastic-web-bt-1',
      status: 'DELIVERED',
      timestamp: new Date().toISOString()
    } as never);
    
    setMessages([...store.getAll()].reverse());
  };

  const dispatchSimulatedMessage = async (type: MessageType, priority: Priority, text: string, deliveryHistory: any[]) => {
    const message = {
      id: crypto.randomUUID(),
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority,
      origin: role === 'coordinator' ? 'demo-coordinator' : 'demo-citizen',
      payloadType: type,
      payload: { text },
      approximateLocation: {
        lat: 40.4168 + (Math.random() * 0.01 - 0.005),
        lon: -3.7038 + (Math.random() * 0.01 - 0.005),
        confidence: 'HIGH' as const,
        source: 'MANUAL' as const,
      },
      ttl: 3600,
      verificationState: role === 'coordinator' ? 'OFFICIAL' as const : 'UNVERIFIED' as const,
      deliveryHistory: [],
    };
    
    const store = session.dispatcher.getStore();
    store.enqueue(message as never);
    
    for (const attempt of deliveryHistory) {
      store.recordDeliveryAttempt(message.id, attempt as never);
    }
    
    setMessages([...store.getAll()].reverse());
  };

  if (showLanding) {
    return <LandingPage onEnterApp={() => setShowLanding(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
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
                {role === 'citizen' ? '👤 Ciudadano' : '🛡️ Coordinador'}
              </span>
              <button
                onClick={() => setRole(role === 'citizen' ? 'coordinator' : 'citizen')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                Cambiar Rol
              </button>
              <button
                onClick={runInvestorDemo}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-bold shadow-lg transition-colors"
                title="Inyectar alerta de la Unidad Militar de Emergencias para demostración técnica"
              >
                Simular Rescate Real (Demo Inversores)
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
            <SimulationPanel role={role} session={session} dispatchSimulatedMessage={dispatchSimulatedMessage} />
            
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

        {/* Info banner */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🚀</span>
            <div>
              <h3 className="font-bold text-blue-900 mb-2">PWA Offline-First Activado</h3>
              <p className="text-sm text-blue-800">
                Esta aplicación ya cuenta con un Service Worker que permite su uso sin conexión y persistencia real mediante IndexedDB. 
                Si recargas la página o pierdes la conexión, los mensajes no se perderán. Prepara el soporte para el protocolo Meshtastic WebBluetooth.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

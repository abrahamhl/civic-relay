import { useState, useEffect } from 'react';
import { createDemoSession } from '@civic-relay/core';
import type { MessageType, Priority, MessageEnvelope } from '@civic-relay/schemas';
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>🆘 Civic Relay</h1>
        <div className="role-toggle">
          <button className={role === 'citizen' ? 'active' : ''} onClick={() => setRole('citizen')}>
            Citizen
          </button>
          <button className={role === 'coordinator' ? 'active' : ''} onClick={() => setRole('coordinator')}>
            Coordinator
          </button>
        </div>
      </header>

      <TransportStatus />

      <main className="app-main">
        {role === 'citizen' ? (
          <>
            <EmergencyButtons onAction={handleEmergencyAction} />
            <MessageQueue messages={messages} />
          </>
        ) : (
          <IncidentMap messages={messages} />
        )}
      </main>

      <footer className="app-footer">
        <small>
          Demo ficticia • transportes simulados en esta misma página • cola en memoria (se pierde al recargar) • sin aval institucional • no atiende emergencias reales
        </small>
      </footer>
    </div>
  );
}

export default App;

import { useState, useEffect } from 'react';
import { Dispatcher } from '@civic-relay/core';
import { IPTransport, LocalMeshTransport, CellularTransport } from '@civic-relay/transports';
import type { MessageEnvelope, MessageType, Priority } from '@civic-relay/schemas';
import EmergencyButtons from './components/EmergencyButtons';
import TransportStatus from './components/TransportStatus';
import MessageQueue from './components/MessageQueue';
import IncidentMap from './components/IncidentMap';
import './App.css';

// Global dispatcher instance
const dispatcher = new Dispatcher();

// Register transports
const ipTransport = new IPTransport();
const meshTransport = new LocalMeshTransport();
const cellularTransport = new CellularTransport();

dispatcher.registerTransport(ipTransport);
dispatcher.registerTransport(meshTransport);
dispatcher.registerTransport(cellularTransport);

// Start periodic retry
dispatcher.startPeriodicRetry(10000);

// Expose for demo control
(window as any).civicRelay = {
  dispatcher,
  transports: { ipTransport, meshTransport, cellularTransport },
};

function App() {
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
  const [role, setRole] = useState<'citizen' | 'coordinator'>('citizen');

  // Poll for message updates
  useEffect(() => {
    const interval = setInterval(() => {
      const allMessages = dispatcher.getStore().getAll();
      setMessages([...allMessages].reverse()); // Newest first
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleEmergencyAction = async (type: MessageType, priority: Priority) => {
    const message: MessageEnvelope = {
      id: crypto.randomUUID(),
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority,
      origin: 'user-001',
      payloadType: type,
      payload: { text: `${type} reported by citizen` },
      approximateLocation: {
        lat: 40.4168, // Madrid
        lon: -3.7038,
        confidence: 'MEDIUM',
        source: 'GPS',
      },
      ttl: 3600, // 1 hour
      verificationState: 'UNVERIFIED',
      deliveryHistory: [],
    };

    await dispatcher.dispatch(message);
    console.log('Message dispatched:', message.id);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🆘 Civic Relay</h1>
        <div className="role-toggle">
          <button
            className={role === 'citizen' ? 'active' : ''}
            onClick={() => setRole('citizen')}
          >
            Citizen
          </button>
          <button
            className={role === 'coordinator' ? 'active' : ''}
            onClick={() => setRole('coordinator')}
          >
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
          V0.1 Prototype • Local transports simulated • No real RF transmission
        </small>
      </footer>
    </div>
  );
}

export default App;

import type { MessageEnvelope } from '@civic-relay/schemas';
import './MessageQueue.css';

export default function MessageQueue({ messages }: { messages: MessageEnvelope[] }) {
  if (!messages.length) return <div className="message-queue empty"><p>Sin mensajes. Genera un incidente ficticio arriba.</p></div>;
  return (
    <div className="message-queue">
      <h3>Historial local ({messages.length})</h3>
      <div className="message-list">
        {messages.map(msg => {
          const acks = new Set(msg.deliveryHistory.filter(a => a.status === 'DELIVERED').map(a => a.transportId)).size;
          return <article className="message-card" key={msg.id}>
            <div className="message-header">
              <strong>{msg.payloadType} · {msg.priority}</strong>
              <span className="verification-badge badge-unverified">NO VERIFICADO</span>
            </div>
            <div className="message-body">
              <p>{new Date(msg.createdAt).toLocaleString()}</p>
              <p>{acks > 0 ? `${acks} ruta(s) con ACK simulado (no acredita entrega externa)` : 'Sin ACK simulado; pendiente o sin transporte disponible'}</p>
            </div>
            <details><summary>Inspeccionar intentos ({msg.deliveryHistory.length})</summary>
              <ul>{msg.deliveryHistory.map((a, i) => <li key={i}>{a.transportId}: {a.status}</li>)}</ul>
            </details>
          </article>;
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Props {
  user: any;
}

export const MessagesView: React.FC<Props> = ({ user }) => {
  const [channels, setChannels] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'chats' | 'channels'>('chats');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
      const interval = setInterval(() => loadMessages(activeConvId), 4000);
      return () => clearInterval(interval);
    }
  }, [activeConvId]);

  const loadData = async () => {
    try {
      const chRes = await api.getChannels();
      setChannels(chRes.channels || []);
      if (user) {
        const convRes = await api.getConversations();
        setConversations(convRes.conversations || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const res = await api.getMessages(convId);
      setMessages(res.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim() || !activeConvId) return;
    const text = msgInput.trim();
    setMsgInput('');
    try {
      const res = await api.sendMessage(activeConvId, { body: text });
      setMessages((prev) => [...prev, res.message]);
    } catch (e: any) {
      alert(e.message || 'Error al enviar mensaje');
    }
  };

  const handleJoinChannel = async (ch: any) => {
    try {
      const res = await api.joinChannel(ch.id);
      setActiveConvId(res.conversationId);
      loadData();
    } catch (e: any) {
      alert(e.message || 'Error al unirse al canal institucional (credencial requerida)');
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', background: 'var(--bg-primary)' }}>
      {/* Lateral de Conversaciones / Canales */}
      <div style={{ width: '280px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button
            className={`tab-btn ${activeSubTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('chats')}
          >
            Chats y Grupos
          </button>
          <button
            className={`tab-btn ${activeSubTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('channels')}
          >
            Canales
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeSubTab === 'chats' ? (
            conversations.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No tienes conversaciones activas.
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: activeConvId === c.id ? 'var(--bg-tertiary)' : 'transparent'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{c.title}</div>
                  {c.lastMessage && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.lastMessage.preview}</span>
                      <span>{c.lastMessage.state === 'VERIFIED' ? '✓✓' : c.lastMessage.state === 'IN_CUSTODY' ? '✓' : ''}</span>
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            channels.map((ch) => (
              <div
                key={ch.id}
                style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{ch.name}</span>
                  <span className={`badge ${ch.kind === 'INSTITUTIONAL' ? 'badge-official' : 'badge-identified'}`}>
                    {ch.kind}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{ch.topic}</p>
                {ch.joined ? (
                  <button
                    className="btn btn-outline"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', width: '100%' }}
                    onClick={() => setActiveConvId(ch.conversationId)}
                  >
                    Abrir Canal
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', width: '100%' }}
                    onClick={() => handleJoinChannel(ch)}
                  >
                    Unirse
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panel de Mensajes Activos */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeConvId ? (
          <>
            {/* Mensajes Scroll */}
            <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {messages.map((m) => {
                const isMe = user && m.senderId === user.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      maxWidth: '70%',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      background: isMe ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
                      color: isMe ? '#fff' : 'var(--text-primary)',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '1rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    {!isMe && (
                      <div style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.2rem', color: 'var(--brand-text)' }}>
                        {m.sender?.displayName || 'Usuario'}
                      </div>
                    )}
                    <div>{m.body || '[Sobre SENDA cifrado de extremo a extremo]'}</div>
                    <div style={{ fontSize: '0.6875rem', marginTop: '0.25rem', textAlign: 'right', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (
                        <span title={`Estado: ${m.state}`}>
                          {m.state === 'VERIFIED' ? '🛡️ ✓✓' : m.state === 'DELIVERED' ? '✓✓' : m.state === 'IN_CUSTODY' ? '✓' : '⏳'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Escribe un mensaje seguro..."
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.875rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
              <button type="submit" className="btn btn-primary">
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Selecciona una conversación o canal para ver los mensajes.
          </div>
        )}
      </div>
    </div>
  );
};

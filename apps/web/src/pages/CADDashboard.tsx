/**
 * CAD Dashboard - Mock 112 Dispatcher Interface
 * Mejora #2: Integración 112/CAD - UI Dashboard
 *
 * Simula interfaz de centro de coordinación 112 para demos institucionales
 */

import { useState, useEffect } from 'react';

interface CADTicket {
  id: string;
  incidentType: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'DISPATCHED' | 'EN_ROUTE' | 'ON_SCENE' | 'RESOLVED' | 'CLOSED';
  location: {
    address?: string;
    coordinates?: { lat: number; lon: number };
  };
  description: string;
  reportedAt: string;
  unitsDispatched: string[];
  dispatchNotes?: string;
}

export function CADDashboard() {
  const [tickets, setTickets] = useState<CADTicket[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
    avgResponseTime: '0 min',
    unitsDispatched: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<CADTicket | null>(null);

  const API_BASE = 'http://localhost:3001/api/cad';

  useEffect(() => {
    fetchTickets();
    fetchStats();

    // Poll every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchTickets();
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_BASE}/tickets`);
      const data = await res.json();
      setTickets(data.tickets || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      const data = await res.json();
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleDispatch = async (ticketId: string) => {
    const mockUnits = ['UNIT-112', 'UNIT-FIRE-01', 'UNIT-MEDICAL-03'];
    const randomUnit = mockUnits[Math.floor(Math.random() * mockUnits.length)];

    try {
      await fetch(`${API_BASE}/ticket/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DISPATCHED',
          notes: `Unidad ${randomUnit} despachada`
        })
      });
      fetchTickets();
      alert(`✅ Unidad ${randomUnit} despachada al incidente ${ticketId}`);
    } catch (error) {
      console.error('Failed to dispatch:', error);
      alert('❌ Error al despachar unidad');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#eab308';
      case 'LOW': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      NEW: '#3b82f6',
      DISPATCHED: '#f59e0b',
      EN_ROUTE: '#8b5cf6',
      ON_SCENE: '#ef4444',
      RESOLVED: '#10b981',
      CLOSED: '#6b7280'
    };

    return (
      <span style={{
        background: colors[status] || '#6b7280',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: '600'
      }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Cargando dashboard 112...</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1rem',
      background: '#0f172a',
      color: 'white',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: '#1e293b',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>🚨 Centro 112 - Madrid</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
            Sistema CAD - Computer Aided Dispatch
          </p>
        </div>
        <div style={{
          background: '#22c55e',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontWeight: '600'
        }}>
          🟢 ONLINE
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          background: '#1e293b',
          padding: '1rem',
          borderRadius: '8px',
          borderLeft: '4px solid #3b82f6'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Incidentes Activos</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '0.5rem' }}>
            {stats.total}
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          padding: '1rem',
          borderRadius: '8px',
          borderLeft: '4px solid #ef4444'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Críticos</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '0.5rem' }}>
            {stats.byPriority.CRITICAL || 0}
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          padding: '1rem',
          borderRadius: '8px',
          borderLeft: '4px solid #22c55e'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Unidades Despachadas</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '0.5rem' }}>
            {stats.unitsDispatched}
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          padding: '1rem',
          borderRadius: '8px',
          borderLeft: '4px solid #8b5cf6'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Tiempo Medio Respuesta</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '0.5rem' }}>
            {stats.avgResponseTime}
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div style={{
        background: '#1e293b',
        borderRadius: '8px',
        padding: '1rem'
      }}>
        <h2 style={{ marginTop: 0 }}>📋 Incidentes en Tiempo Real</h2>

        {tickets.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
            No hay incidentes activos
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #334155' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Tipo</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Prioridad</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Estado</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Ubicación</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Hora</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    style={{
                      borderBottom: '1px solid #334155',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <td style={{ padding: '0.75rem' }}>
                      <code style={{
                        background: '#0f172a',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.75rem'
                      }}>
                        {ticket.id.substring(0, 8)}
                      </code>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {ticket.incidentType}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getPriorityColor(ticket.priority),
                        marginRight: '0.5rem'
                      }} />
                      {ticket.priority}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {getStatusBadge(ticket.status)}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                      {ticket.location.address || 'Sin dirección'}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                      {new Date(ticket.reportedAt).toLocaleTimeString('es-ES')}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {ticket.status === 'NEW' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDispatch(ticket.id);
                          }}
                          style={{
                            background: '#22c55e',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600'
                          }}
                        >
                          Despachar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedTicket(null)}
        >
          <div
            style={{
              background: '#1e293b',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Detalles del Incidente</h2>

            <div style={{ marginBottom: '1rem' }}>
              <strong>ID:</strong> <code>{selectedTicket.id}</code>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong>Tipo:</strong> {selectedTicket.incidentType}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong>Prioridad:</strong>{' '}
              <span style={{ color: getPriorityColor(selectedTicket.priority) }}>
                {selectedTicket.priority}
              </span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong>Estado:</strong> {getStatusBadge(selectedTicket.status)}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong>Descripción:</strong>
              <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                {selectedTicket.description}
              </p>
            </div>

            {selectedTicket.location.coordinates && (
              <div style={{ marginBottom: '1rem' }}>
                <strong>Coordenadas:</strong>
                <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                  {selectedTicket.location.coordinates.lat}, {selectedTicket.location.coordinates.lon}
                </p>
              </div>
            )}

            {selectedTicket.unitsDispatched.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <strong>Unidades Despachadas:</strong>
                <ul style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                  {selectedTicket.unitsDispatched.map((unit, i) => (
                    <li key={i}>{unit}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setSelectedTicket(null)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

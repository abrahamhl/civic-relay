import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Props {
  eventId: string | null;
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export const EventHubModal: React.FC<Props> = ({ eventId, isOpen, onClose, user }) => {
  if (!isOpen || !eventId) return null;

  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [obsText, setObsText] = useState('');
  const [submittingObs, setSubmittingObs] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    setLoading(true);
    try {
      const res = await api.getEvent(eventId);
      setEventData(res.event);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!eventData) return;
    const current = eventData.viewerSubscription?.following;
    try {
      const res = await api.setEventSubscription(eventData.id, !current, true);
      setEventData((prev: any) => ({
        ...prev,
        viewerSubscription: res,
        subscriberCount: prev.subscriberCount + (res.following ? 1 : -1)
      }));
    } catch (e: any) {
      alert(e.message || 'Error al modificar suscripción');
    }
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsText.trim()) return;
    setSubmittingObs(true);
    try {
      await api.createPost({
        kind: 'OBSERVATION',
        body: obsText.trim(),
        eventId: eventData.id
      });
      setObsText('');
      loadEvent();
      alert('Observación añadida a la cadena de evidencias del acontecimiento.');
    } catch (e: any) {
      alert(e.message || 'Error al añadir observación');
    } finally {
      setSubmittingObs(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        {loading || !eventData ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos del acontecimiento...</div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div>
                <span className={`badge ${
                  eventData.status === 'OFFICIAL_SOURCE_CONFIRMED' ? 'badge-official' :
                  eventData.status === 'CORROBORATED' ? 'badge-corroborated' :
                  eventData.status === 'DISPUTED' ? 'badge-disputed' : 'badge-unverified'
                }`}>
                  {eventData.status}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  {eventData.slug}
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem' }}>
                  {eventData.title}
                </h2>
              </div>
              <button className="btn btn-outline" style={{ border: 'none' }} onClick={onClose}>✕</button>
            </div>

            {/* Location & Times */}
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {eventData.location?.label && <span>📍 {eventData.location.label}</span>}
              <span>👥 {eventData.subscriberCount} seguidores</span>
              <span>📅 Inicio: {new Date(eventData.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>

            {/* Seguir / Dejar de seguir */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <button
                className={`btn ${eventData.viewerSubscription?.following ? 'btn-outline' : 'btn-primary'}`}
                onClick={handleToggleFollow}
              >
                {eventData.viewerSubscription?.following ? '✓ Siguiendo avisos del suceso' : '+ Seguir este acontecimiento'}
              </button>
            </div>

            {/* Cuadro de Verificación y Señales */}
            <div style={{ background: 'var(--bg-secondary)', padding: '0.875rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Auditoría de Verificación y Procedencia
              </div>
              <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div>• Fuentes independientes registradas: <strong>{eventData.verification?.independentSourceCount}</strong></div>
                <div>• Confirmación oficial: <strong>{eventData.verification?.officialConfirmed ? 'SÍ (Alerta institucional activa)' : 'NO'}</strong></div>
                <div>• Contradicciones detectadas: <strong>{eventData.verification?.contradictionCount || 0}</strong></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  * El recuento de likes o popularidad no influye en la verificación de hechos.
                </div>
              </div>
            </div>

            {/* Cámaras públicas aportadas: CONTEXTO, no fuente independiente */}
            {Array.isArray(eventData.evidence) && eventData.evidence.some((e: any) => e.metadata?.type === 'CAMERA_SIGNAL') && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.875rem', marginBottom: '1.25rem' }} data-testid="camera-evidence">
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Cámaras públicas aportadas · contexto
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                  {eventData.evidence.filter((e: any) => e.metadata?.type === 'CAMERA_SIGNAL').map((e: any) => (
                    <figure key={e.id} style={{ margin: 0, fontSize: '0.75rem' }}>
                      <img src={e.original_url} alt={`Cámara ${e.metadata.provider} ${e.metadata.road ?? ''}`} loading="lazy" referrerPolicy="no-referrer"
                        style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                      <figcaption style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                        <strong>{e.metadata.sector ?? '—'}</strong> · {e.metadata.road ?? ''} · {e.metadata.dKm ?? '?'} km<br />
                        {e.metadata.reading?.note ?? ''}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Imagen actual servida por {eventData.evidence.find((e: any) => e.metadata?.type === 'CAMERA_SIGNAL')?.metadata?.provider} ({eventData.evidence.find((e: any) => e.metadata?.type === 'CAMERA_SIGNAL')?.metadata?.licence}); la lectura se midió al aportarla. Las cámaras no cuentan como fuente independiente ni cambian el estado de verificación. Cada aportación queda encadenada por hash.
                </div>
              </div>
            )}

            {/* Actualizaciones y Correcciones */}
            {eventData.updates && eventData.updates.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>Línea de Tiempo y Actualizaciones</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {eventData.updates.map((u: any) => (
                    <div key={u.id} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: '0.8125rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 700, color: u.kind === 'RETRACTION' ? 'var(--danger)' : 'var(--text-primary)' }}>
                          [{u.kind}] {u.display_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p>{u.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Añadir Observación al suceso */}
            <form onSubmit={handleAddObservation} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="Aporta una observación o evidencia ciudadana..."
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
              <button type="submit" className="btn btn-primary" disabled={submittingObs}>
                Aportar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { api } from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: any) => void;
  events: any[];
}

export const PublishModal: React.FC<Props> = ({ isOpen, onClose, onPostCreated, events }) => {
  if (!isOpen) return null;

  const [kind, setKind] = useState<'LINK' | 'NEWS' | 'OBSERVATION' | 'INCIDENT_REPORT' | 'HELP_REQUEST'>('LINK');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [placeLabel, setPlaceLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [createNewEvent, setCreateNewEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFetchPreview = async () => {
    if (!url.trim()) return;
    setLoadingPreview(true);
    try {
      const res = await api.previewLink(url.trim());
      setPreview(res);
      if (res.title && !title) setTitle(res.title);
      if (res.description && !body) setBody(res.description);
      if (res.hypothesis?.suggestedCategory) setCategory(res.hypothesis.suggestedCategory);
    } catch (e: any) {
      alert(e.message || 'No se pudieron extraer metadatos de la URL');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && !title.trim() && !url.trim()) {
      alert('Escribe contenido o introduce un enlace');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        kind,
        url: url.trim() || undefined,
        title: title.trim() || undefined,
        body: body.trim(),
        category,
        placeLabel: placeLabel.trim() || undefined,
        lat: lat ?? undefined,
        lon: lon ?? undefined,
        sensitive,
        eventId: selectedEventId || undefined
      };

      if (createNewEvent && newEventTitle.trim()) {
        payload.createEvent = {
          title: newEventTitle.trim(),
          type: category
        };
      }

      const res = await api.createPost(payload);
      onPostCreated(res.post);
      onClose();
    } catch (e: any) {
      alert(e.message || 'Error al publicar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no está disponible en este dispositivo');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Redondeo de privacidad client-side
        const rLat = Math.round(pos.coords.latitude * 100) / 100;
        const rLon = Math.round(pos.coords.longitude * 100) / 100;
        setLat(rLat);
        setLon(rLon);
        if (!placeLabel) setPlaceLabel('Mi ubicación aproximada (~1 km)');
      },
      (err) => alert('Permiso de ubicación denegado o no disponible: ' + err.message)
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Publicar / Compartir</h2>
          <button className="btn btn-outline" style={{ border: 'none', fontSize: '1.25rem' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Tipo de Publicación */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Tipo de Publicación
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {[
                { id: 'LINK', label: '🔗 Enlace / Vídeo' },
                { id: 'NEWS', label: '📰 Noticia' },
                { id: 'OBSERVATION', label: '👁️ Observación' },
                { id: 'INCIDENT_REPORT', label: '⚠️ Incidencia' },
                { id: 'HELP_REQUEST', label: '🆘 Petición Ayuda' }
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`btn ${kind === t.id ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  onClick={() => setKind(t.id as any)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campo URL si es enlace */}
          {(kind === 'LINK' || kind === 'NEWS') && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                URL del contenido (YouTube, TikTok, X, Bluesky, Periódico...)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleFetchPreview}
                  disabled={loadingPreview}
                >
                  {loadingPreview ? 'Analizando...' : 'Extraer Preview'}
                </button>
              </div>
            </div>
          )}

          {/* Vista Previa de la URL */}
          {preview && (
            <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>
                {preview.siteName || preview.provider} · Autor: {preview.authorName || 'Público'}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>{preview.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Reproducción permitida vía: {preview.embed?.kind} (sin re-alojar archivos).
              </div>
            </div>
          )}

          {/* Título */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Título</label>
            <input
              type="text"
              placeholder="Ej: Inundación en paso subterráneo de la CV-400"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '0.25rem' }}
            />
          </div>

          {/* Descripción / Contenido */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Descripción / Detalles</label>
            <textarea
              rows={3}
              placeholder="Describe lo observado o añade contexto relevante..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '0.25rem' }}
            />
          </div>

          {/* Categoría & Hipótesis */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '0.25rem' }}
            >
              <option value="general">General</option>
              <option value="flood">Inundación / DANA</option>
              <option value="fire">Incendio</option>
              <option value="traffic">Tráfico y carreteras</option>
              <option value="weather">Meteorología</option>
              <option value="outage">Corte de suministro</option>
              <option value="accident">Accidente</option>
            </select>
          </div>

          {/* Ubicación aproximada opcional */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Ubicación aproximada</label>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.6875rem' }}
                onClick={handleUseCurrentLocation}
              >
                📍 Usar mi zona (~1 km)
              </button>
            </div>
            <input
              type="text"
              placeholder="Municipio, barrio o vía..."
              value={placeLabel}
              onChange={(e) => setPlaceLabel(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '0.25rem' }}
            />
          </div>

          {/* Vincular a Acontecimiento */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Vincular a Acontecimiento (Event Hub)</label>
            {!createNewEvent ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="">-- Sin suceso vinculado --</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.status})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => setCreateNewEvent(true)}
                >
                  + Nuevo
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Nombre del nuevo acontecimiento..."
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem', alignSelf: 'flex-start' }}
                  onClick={() => setCreateNewEvent(false)}
                >
                  Cancelar y seleccionar existente
                </button>
              </div>
            )}
          </div>

          {/* Check sensible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="sens"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
            />
            <label htmlFor="sens" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Contiene imágenes o información potencialmente sensible
            </label>
          </div>

          {/* Footer Botones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

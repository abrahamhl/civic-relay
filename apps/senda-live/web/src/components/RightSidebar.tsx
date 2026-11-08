import React from 'react';

interface Props {
  events: any[];
  onSelectEvent: (event: any) => void;
  online: boolean;
  dtnStats: any;
}

export const RightSidebar: React.FC<Props> = ({ events, onSelectEvent, online, dtnStats }) => {
  return (
    <aside className="right-sidebar">
      {/* Connection & Network Status */}
      <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Estado de Conexión
          </span>
          <span className={`badge ${online ? 'badge-corroborated' : 'badge-unverified'}`}>
            {online ? 'ONLINE' : 'DEGRADED / DTN'}
          </span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {online ? 'Sincronización en directo activa vía HTTP/SSE.' : 'Modo fuera de línea. Sobres y reportes en cola local DTN.'}
        </div>
        {dtnStats && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Almacén DTN: {dtnStats.storedEnvelopes || 0} sobres en custodia
          </div>
        )}
      </div>

      {/* Emergency Aviso */}
      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '0.875rem', borderRadius: 'var(--radius)', color: '#9f1239' }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          ⚠️ Canal Complementario
        </div>
        <p style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
          SENDA es una red de resiliencia civil y ayuda mutua. Ante un riesgo vital inmediato o emergencia grave, <strong>llama al 112</strong>.
        </p>
      </div>

      {/* Acontecimientos de Interés */}
      <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          ⚡ Sucesos en Seguimiento
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {events.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No hay sucesos activos en tu zona.</div>
          ) : (
            events.slice(0, 5).map((ev) => (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev)}
                style={{ cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className={`badge ${
                    ev.status === 'OFFICIAL_SOURCE_CONFIRMED' ? 'badge-official' :
                    ev.status === 'CORROBORATED' ? 'badge-corroborated' :
                    ev.status === 'DISPUTED' ? 'badge-disputed' : 'badge-unverified'
                  }`}>
                    {ev.status}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ev.type}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{ev.title}</div>
                {ev.location?.label && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>📍 {ev.location.label}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Transparencia y Modelo DSA */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, padding: '0 0.5rem' }}>
        SENDA LIVE cumple con RGPD y DSA. La popularidad o likes no determinan la verificación de hechos. Coordenadas aproximadas a ~1 km por privacidad.
      </div>
    </aside>
  );
};

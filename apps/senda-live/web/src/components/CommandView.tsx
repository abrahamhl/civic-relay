import React, { useMemo, useState } from 'react';

interface Props {
  user: any;
  events: any[];
  onSelectEvent: (id: string) => void;
}

export type CommandSection =
  | 'overview'
  | 'live_events'
  | 'corridor_intel'
  | 'camera_fusion'
  | 'incident_command'
  | 'network_dtn'
  | 'evidence'
  | 'data_sources';

const sections: { id: CommandSection; icon: string; label: string }[] = [
  { id: 'overview', icon: '◫', label: 'Situación' },
  { id: 'live_events', icon: '!', label: 'Incidentes' },
  { id: 'corridor_intel', icon: '⌁', label: 'Corredores' },
  { id: 'camera_fusion', icon: '▣', label: 'Cámaras' },
  { id: 'incident_command', icon: '✚', label: 'Respuesta' },
  { id: 'network_dtn', icon: '⌁', label: 'Conectividad' },
  { id: 'evidence', icon: '⛓', label: 'Evidencias' },
  { id: 'data_sources', icon: '◎', label: 'Fuentes' },
];

const labelForStatus = (status: unknown) => {
  const value = String(status ?? 'UNVERIFIED_REPORT');
  const labels: Record<string, string> = {
    OFFICIAL_SOURCE_CONFIRMED: 'Fuente oficial',
    CORROBORATED: 'Corroborado',
    DISPUTED: 'En disputa',
    RETRACTED: 'Retirado',
    UNVERIFIED_REPORT: 'Sin verificar',
    IDENTIFIED: 'Identificado',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
};

const statusTone = (status: unknown) => {
  switch (String(status ?? '')) {
    case 'OFFICIAL_SOURCE_CONFIRMED': return '#dc2626';
    case 'CORROBORATED': return '#059669';
    case 'DISPUTED': return '#9333ea';
    case 'RETRACTED': return '#64748b';
    default: return '#d97706';
  }
};

const displayTime = (value: unknown) => {
  if (!value) return 'Hora no disponible';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const EmptyState: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '1.25rem', background: 'var(--bg-secondary)' }}>
    <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.55 }}>{detail}</p>
  </div>
);

export const CommandView: React.FC<Props> = ({ user, events, onSelectEvent }) => {
  const [activeSection, setActiveSection] = useState<CommandSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const safeEvents = Array.isArray(events) ? events : [];
  const filteredEvents = useMemo(() => safeEvents.filter((event) => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return true;
    return [event?.title, event?.type, event?.location?.label, event?.id]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(query));
  }), [safeEvents, searchQuery]);

  const counts = useMemo(() => ({
    total: safeEvents.length,
    official: safeEvents.filter((event) => event?.status === 'OFFICIAL_SOURCE_CONFIRMED').length,
    corroborated: safeEvents.filter((event) => event?.status === 'CORROBORATED').length,
    unverified: safeEvents.filter((event) => !['OFFICIAL_SOURCE_CONFIRMED', 'CORROBORATED', 'DISPUTED', 'RETRACTED'].includes(String(event?.status))).length,
    disputed: safeEvents.filter((event) => event?.status === 'DISPUTED').length,
  }), [safeEvents]);

  const openEvent = (event: any) => {
    setSelectedIncident(event);
    if (event?.id) onSelectEvent(String(event.id));
  };

  const panelTitle = sections.find((section) => section.id === activeSection)?.label ?? 'Situación';

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 4rem)', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <aside style={{ width: sidebarCollapsed ? 62 : 210, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0.85rem 0.7rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          {!sidebarCollapsed && <strong style={{ fontSize: '0.82rem', letterSpacing: '.04em' }}>SENDA / MANDO</strong>}
          <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'} style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}>
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>
        <nav aria-label="Módulos de mando" style={{ padding: 8, display: 'grid', gap: 4 }}>
          {sections.map((section) => (
            <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} title={section.label} aria-current={activeSection === section.id ? 'page' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 9px', borderRadius: 8, border: '1px solid ' + (activeSection === section.id ? 'var(--brand-primary)' : 'transparent'), background: activeSection === section.id ? 'var(--brand-light)' : 'transparent', color: activeSection === section.id ? 'var(--brand-text)' : 'var(--text-secondary)', fontWeight: activeSection === section.id ? 800 : 600, fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
              <span aria-hidden="true" style={{ width: 18, textAlign: 'center', fontSize: '1rem' }}>{section.icon}</span>
              {!sidebarCollapsed && <span>{section.label}</span>}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.68rem', lineHeight: 1.5 }}>
          {!sidebarCollapsed && <>Prototipo de investigación<br />No es un servicio 112</>}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 170 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Centro de coordinación · {panelTitle}</div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 850 }}>Situación operativa</h2>
          </div>
          <label style={{ flex: 2, minWidth: 190 }}>
            <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Buscar incidentes</span>
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar por incidente, tipo, ubicación o ID…" style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
          </label>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 99, padding: '5px 9px' }}>{safeEvents.length} registros cargados</span>
        </header>

        <div style={{ padding: 'clamp(0.8rem, 2vw, 1.35rem)', overflowY: 'auto', flex: 1 }}>
          {activeSection === 'overview' && <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Lo que sabemos ahora</div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 850, marginTop: 4 }}>Incidentes y nivel de corroboración</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 5 }}>Indicadores calculados exclusivamente a partir de los acontecimientos recibidos por esta sesión. No representan cobertura total de la carretera.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 9, marginBottom: 18 }}>
              {[
                { label: 'Registros cargados', value: counts.total, color: 'var(--text-primary)' },
                { label: 'Fuente oficial', value: counts.official, color: '#dc2626' },
                { label: 'Corroborados', value: counts.corroborated, color: '#059669' },
                { label: 'Sin verificar', value: counts.unverified, color: '#d97706' },
                { label: 'En disputa', value: counts.disputed, color: '#9333ea' },
              ].map((metric) => <div key={metric.label} style={{ padding: '0.9rem', border: '1px solid var(--border)', borderRadius: 11, background: 'var(--bg-secondary)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{metric.label}</div>
                <div style={{ fontSize: '1.7rem', lineHeight: 1.2, fontWeight: 850, color: metric.color, fontVariantNumeric: 'tabular-nums' }}>{metric.value}</div>
              </div>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Actividad recibida</h3>
              <button type="button" className="btn btn-outline" onClick={() => setActiveSection('live_events')}>Abrir registro completo →</button>
            </div>
            {filteredEvents.length ? <div style={{ display: 'grid', gap: 8 }}>
              {filteredEvents.slice(0, 8).map((event) => <EventRow key={event.id} event={event} onOpen={() => openEvent(event)} />)}
            </div> : <EmptyState title="Todavía no hay incidentes para mostrar" detail="Cuando el servicio entregue acontecimientos, aparecerán aquí con su estado de verificación. No se generan incidentes ficticios para rellenar el panel." />}
          </>}

          {activeSection === 'live_events' && <>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 850, marginBottom: 5 }}>Registro de acontecimientos</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 14 }}>Selecciona un registro para abrir su ficha y revisar ubicación, estado y datos recibidos.</p>
            {filteredEvents.length ? <div style={{ display: 'grid', gap: 8 }}>{filteredEvents.map((event) => <EventRow key={event.id} event={event} onOpen={() => openEvent(event)} />)}</div> : <EmptyState title="Sin resultados" detail="No hay registros que coincidan con la búsqueda actual." />}
          </>}

          {activeSection === 'corridor_intel' && <>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 850, marginBottom: 6 }}>Inteligencia de corredor</h3>
            <EmptyState title="No hay telemetría de corredor conectada a esta vista" detail="Esta pantalla no recibe todavía inventario verificable de sensores, aforos, PK, cierres ni estado de cámaras por tramo. Los corredores y cifras estáticas se han retirado para no presentar infraestructura ficticia como operativa. Los acontecimientos geolocalizados sí pueden consultarse en el mapa de sucesos." />
          </>}

          {activeSection === 'camera_fusion' && <>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 850, marginBottom: 6 }}>Cámaras y corroboración visual</h3>
            <EmptyState title="La fusión de vídeo no está disponible en este centro de mando" detail="No se mostrarán cámaras como activas ni se afirmará que una imagen está en directo sin comprobar disponibilidad, hora de captura, licencia y procedencia. La integración de cámaras públicas debe aparecer aquí con vista previa, antigüedad de imagen y enlace a la fuente." />
          </>}

          {activeSection === 'incident_command' && <>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 850, marginBottom: 6 }}>Ficha de respuesta</h3>
            {selectedIncident ? <IncidentDetail event={selectedIncident} /> : <EmptyState title="Selecciona un acontecimiento" detail="Abre un registro en Situación o Incidentes para revisar sus datos. La consola no puede despachar recursos ni notificar a servicios de emergencia." />}
          </>}

          {activeSection === 'network_dtn' && <>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 850, marginBottom: 6 }}>Continuidad de comunicaciones</h3>
            <EmptyState title="Estado DTN no conectado a esta consola" detail="No se inferirá que existe una malla activa a partir de modelos o simulaciones. Para mostrar un enlace aquí se necesitan mediciones de transporte en dispositivos reales: interfaz, último contacto, entrega, latencia y recibo de custodia." />
          </>}

          {activeSection === 'evidence' && <>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 850, marginBottom: 6 }}>Evidencias y procedencia</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 14 }}>Resumen de registros recibidos. La integridad criptográfica solo se mostrará cuando exista un recibo verificable asociado al registro.</p>
            {filteredEvents.length ? <div style={{ display: 'grid', gap: 8 }}>{filteredEvents.map((event) => <EventRow key={event.id} event={event} onOpen={() => openEvent(event)} />)}</div> : <EmptyState title="No hay evidencias cargadas" detail="No se declara una cadena de custodia válida sin pruebas verificables." />}
          </>}

          {activeSection === 'data_sources' && <>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 850, marginBottom: 6 }}>Fuentes y frescura de datos</h3>
            <EmptyState title="No hay telemetría de salud de fuentes en esta vista" detail="La lista de proveedores o adaptadores configurados no demuestra que estén respondiendo ahora. Esta sección necesita mostrar, por fuente, último éxito, antigüedad, latencia, cobertura geográfica, licencia y último error." />
          </>}
        </div>
      </main>

      <aside style={{ width: 270, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '1rem', overflowY: 'auto' }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Inspector</div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 850, margin: '4px 0 12px' }}>Detalle del registro</h3>
        {selectedIncident ? <IncidentDetail event={selectedIncident} /> : <EmptyState title="Sin selección" detail="Selecciona un acontecimiento para consultar los datos que realmente han llegado al sistema." />}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.68rem', lineHeight: 1.5 }}>
          {user ? 'Sesión autenticada.' : 'Sesión no autenticada.'} La autenticación no equivale a autorización para operar con organismos de emergencia.
        </div>
      </aside>
    </div>
  );
};

const EventRow: React.FC<{ event: any; onOpen: () => void }> = ({ event, onOpen }) => (
  <button type="button" onClick={onOpen} style={{ width: '100%', textAlign: 'left', padding: '0.9rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'grid', gap: 6 }}>
    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <strong style={{ fontSize: '0.86rem' }}>{String(event?.title ?? 'Acontecimiento sin título')}</strong>
      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: statusTone(event?.status), border: '1px solid currentColor', borderRadius: 99, padding: '3px 7px' }}>{labelForStatus(event?.status)}</span>
    </span>
    <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>{String(event?.location?.label ?? 'Ubicación no disponible')} · {String(event?.type ?? 'Tipo no especificado')}</span>
    <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{displayTime(event?.createdAt ?? event?.created_at ?? event?.timestamp)} · ID: {String(event?.id ?? 'no disponible')}</span>
  </button>
);

const IncidentDetail: React.FC<{ event: any }> = ({ event }) => (
  <div style={{ display: 'grid', gap: 11, fontSize: '0.78rem' }}>
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase' }}>Acontecimiento</div>
      <strong style={{ display: 'block', marginTop: 3 }}>{String(event?.title ?? 'Sin título')}</strong>
    </div>
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase' }}>Estado de verificación</div>
      <strong style={{ display: 'block', marginTop: 3, color: statusTone(event?.status) }}>{labelForStatus(event?.status)}</strong>
    </div>
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase' }}>Ubicación declarada</div>
      <span style={{ display: 'block', marginTop: 3 }}>{String(event?.location?.label ?? 'No disponible')}</span>
      {Number.isFinite(event?.location?.lat) && Number.isFinite(event?.location?.lon) && <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 3 }}>{event.location.lat}, {event.location.lon}</span>}
    </div>
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase' }}>Tipo</div>
      <span>{String(event?.type ?? 'No especificado')}</span>
    </div>
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase' }}>Fecha recibida</div>
      <span>{displayTime(event?.createdAt ?? event?.created_at ?? event?.timestamp)}</span>
    </div>
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase' }}>Identificador</div>
      <code style={{ overflowWrap: 'anywhere' }}>{String(event?.id ?? 'No disponible')}</code>
    </div>
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 9, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      Esta ficha es informativa. No confirma por sí sola el incidente ni activa una respuesta de emergencia.
    </div>
  </div>
);

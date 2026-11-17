import React, { useState } from 'react';

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

export const CommandView: React.FC<Props> = ({ user, events, onSelectEvent }) => {
  const [activeSection, setActiveSection] = useState<CommandSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const corridors = [
    { id: 'CORR-A3', name: 'Corredor A-3 (Valencia — Madrid)', status: 'WARNING', sensors: 48, cameras: 18, fireRisk: 'EXTREME' },
    { id: 'CORR-A12', name: 'Corridor A12 (Arnhem — Utrecht)', status: 'NORMAL', sensors: 34, cameras: 12, fireRisk: 'LOW' },
    { id: 'CORR-AP7', name: 'Corredor AP-7 (Mediterráneo)', status: 'ATTENTION', sensors: 62, cameras: 24, fireRisk: 'HIGH' },
  ];

  const filteredEvents = events.filter((e) =>
    !searchQuery || e.title?.toLowerCase().includes(searchQuery.toLowerCase()) || e.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Sub-Navigation Sidebar (Collapsible) */}
      <div
        style={{
          width: sidebarCollapsed ? '64px' : '240px',
          transition: 'width 0.2s ease',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!sidebarCollapsed && <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-primary)' }}>SENDA COMMAND</span>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
            title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>

        <nav style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'overview', icon: '📊', label: 'OVERVIEW' },
            { id: 'live_events', icon: '🚨', label: 'LIVE EVENTS' },
            { id: 'corridor_intel', icon: '🛣️', label: 'CORRIDOR INTEL' },
            { id: 'camera_fusion', icon: '📷', label: 'CAMERA FUSION' },
            { id: 'incident_command', icon: '🛡️', label: 'INCIDENT COMMAND' },
            { id: 'network_dtn', icon: '📡', label: 'NETWORK & DTN' },
            { id: 'evidence', icon: '⛓️', label: 'EVIDENCE (PCI)' },
            { id: 'data_sources', icon: '🌐', label: 'DATA SOURCES' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as CommandSection)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius)',
                border: 'none',
                background: activeSection === item.id ? 'var(--brand-primary)' : 'transparent',
                color: activeSection === item.id ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeSection === item.id ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                textAlign: 'left',
                whiteSpace: 'nowrap',
              }}
              title={item.label}
            >
              <span>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Center Adaptive Work Center */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
        {/* Top Filter & Global Search Bar */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Búsqueda global de incidentes, sectores, sensores, carreteras o fuentes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            MALLA OPERACIONAL ACTIVA
          </span>
        </div>

        <div style={{ padding: '1.25rem', flex: 1 }}>
          {/* SECTION: OVERVIEW */}
          {activeSection === 'overview' && (
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>PANEL DE MANDO Y CONTROL MULTICANAL</h2>

              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CORREDORES EN ALERTA</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f97316' }}>1 / 3</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>A-3 Sector PK 38-46</div>
                </div>

                <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FUSIONES MULTISENSOR</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>14 activas</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Confianza promedio: 91.4%</div>
                </div>

                <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>COLA DE CUSTODIA DTN</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a855f7' }}>2 sobres</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>100% recibos verificados</div>
                </div>

                <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FUENTES OFICIALES</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>5 conectadas</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>DGT, NDW, AEMET, USGS, IGN</div>
                </div>
              </div>

              {/* Corridors Table */}
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>Estado de Corredores Viales</h3>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Corredor</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Estado</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Sensores</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Cámaras</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Riesgo Fuego</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corridors.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>{c.name}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span className={`badge ${c.status === 'WARNING' ? 'badge-official' : 'badge-corroborated'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{c.sensors} espiras</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{c.cameras} activas</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: c.fireRisk === 'EXTREME' ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                          {c.fireRisk}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => { setActiveSection('corridor_intel'); setSelectedIncident(c); }}
                          >
                            Inspeccionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION: CORRIDOR INTEL */}
          {activeSection === 'corridor_intel' && (
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>CORRIDOR FABRIC — 5 PLANOS INTEROPERABLES</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Arquitectura unificada con separación estricta de planos, garantías criptográficas y tolerancias ante fallos de telecomunicación.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#38bdf8' }}>PLANO A: VIAL</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>DGT NAP v3.6, NDW DATEX II, tramos kilométricos y cierres viales.</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#10b981' }}>PLANO B: SENSORES</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>Espiras inductivas, estaciones meteorológicas, caudales e IoT ambiental.</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#f59e0b' }}>PLANO C: VISIÓN</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>Dashcam móvil, cámaras IP fijas ONVIF/RTSP, inferencia Edge YOLOX.</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#a855f7' }}>PLANO D: TELECOM / DTN</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>Malla BLE, Wi-Fi Direct, LoRa, custodia DTN y conmutación celular.</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#ef4444' }}>PLANO E: MANDO</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>Consola de incidentes, validación 112, firma Ed25519 y cadena PCI.</div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: LIVE EVENTS */}
          {activeSection === 'live_events' && (
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>ACONTECIMIENTOS Y GESTIÓN DE VERIFICACIÓN</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedIncident(ev)}
                    style={{
                      padding: '0.85rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius)',
                      border: selectedIncident?.id === ev.id ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{ev.title}</span>
                      <span className={`badge ${ev.status === 'OFFICIAL_SOURCE_CONFIRMED' ? 'badge-official' : ev.status === 'CORROBORATED' ? 'badge-corroborated' : 'badge-unverified'}`}>
                        {ev.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      📍 {ev.location?.label || 'Ubicación aproximada (~1.1 km)'} · Tipo: {ev.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: EVIDENCE (PCI) */}
          {activeSection === 'evidence' && (
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>CADENA DE CUSTODIA Y EVIDENCIA CRIPTOGRÁFICA (PCI)</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                Registro inmutable de hashes, firmas Ed25519 y transferencias de custodia verificado conforme al estándar PCI v0.2.
              </p>

              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                <div style={{ color: '#10b981', marginBottom: '0.5rem' }}>✓ CADENA DE CUSTODIA VÁLIDA (13 verificaciones pasadas)</div>
                <div style={{ color: 'var(--text-secondary)' }}>• Ancla de Confianza: BOMBEROS_CONSORCIO_VALENCIA (ed25519: 7d49b1...)</div>
                <div style={{ color: 'var(--text-secondary)' }}>• Integridad de Sobres: AES-GCM-256 + ECDH P-256</div>
                <div style={{ color: 'var(--text-secondary)' }}>• Hash de Árbol Reproducible: senda.release-manifest/1</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Contextual Inspector */}
      <div style={{ width: '320px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.85rem' }}>
          🔍 Inspector Contextual
        </div>
        <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
          {selectedIncident ? (
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IDENTIFICADOR</div>
                <div style={{ fontWeight: 700 }}>{selectedIncident.id}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TÍTULO</div>
                <div style={{ fontWeight: 700 }}>{selectedIncident.title || selectedIncident.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ESTADO OPERACIONAL</div>
                <div style={{ color: '#f59e0b', fontWeight: 700 }}>{selectedIncident.status}</div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>ACCIONES DE MANDO</div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.75rem' }}
                  onClick={() => alert('Acción de corroboración emitida')}
                >
                  🛡️ Corroborar Oficialmente
                </button>
                <button
                  className="btn btn-outline"
                  style={{ width: '100%', fontSize: '0.75rem' }}
                  onClick={() => alert('Disputa registrada')}
                >
                  ⚠️ Abrir Disputa
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
              Selecciona un elemento en el centro de trabajo para inspeccionar sus metadatos y controles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Props {
  user: any;
  onSelectEvent: (eventId: string) => void;
}

export const AlertsView: React.FC<Props> = ({ user, onSelectEvent }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [zoneSubs, setZoneSubs] = useState<any[]>([]);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneLabel, setZoneLabel] = useState('');
  const [zoneRadius, setZoneRadius] = useState(10);
  const [showIssueAlertModal, setShowIssueAlertModal] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertBody, setAlertBody] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('SEVERE');
  const [alertUrgency, setAlertUrgency] = useState('IMMEDIATE');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [loading, setLoading] = useState(false);\n  const [emergencyLocation, setEmergencyLocation] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);\n  const [locationMessage, setLocationMessage] = useState('');

  const isOperator = user?.roles?.includes('INSTITUTIONAL_OPERATOR');

  useEffect(() => {
    loadAlerts();
    if (user) loadZones();
  }, [user]);

  const loadAlerts = async () => {
    try {
      const res = await api.getAlerts({ includeExpired: 'false' });
      setAlerts(res.alerts || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadZones = async () => {
    try {
      const res = await api.getZoneSubscriptions();
      setZoneSubs(res.subscriptions || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.geolocation) {
      alert('Geolocalización no disponible');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.addZoneSubscription({
            label: zoneLabel || 'Mi Zona',
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            radiusKm: zoneRadius
          });
          setShowZoneModal(false);
          setZoneLabel('');
          loadZones();
        } catch (err: any) {
          alert(err.message || 'Error al guardar zona');
        }
      },
      (err) => alert('Permiso de localización denegado: ' + err.message)
    );
  };

  const handleIssueOfficialAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !alertTitle.trim() || !alertBody.trim()) {
      alert('Completa todos los campos obligatorios');
      return;
    }
    setLoading(true);
    try {
      await api.issueAlert({
        orgId: selectedOrgId,
        title: alertTitle.trim(),
        body: alertBody.trim(),
        severity: alertSeverity,
        urgency: alertUrgency
      });
      setShowIssueAlertModal(false);
      setAlertTitle('');
      setAlertBody('');
      loadAlerts();
      alert('Alerta oficial emitida y verificada criptográficamente en servidor.');
    } catch (err: any) {
      alert(err.message || 'Error al emitir alerta');
    } finally {
      setLoading(false);
    }
  };

  const handleRetract = async (alertId: string) => {
    const reason = prompt('Indica el motivo de la retractación pública:');
    if (!reason || !reason.trim()) return;
    try {
      await api.retractAlert(alertId, reason.trim());
      loadAlerts();
      alert('Alerta retractada correctamente. Permanece registrada de forma trazable.');
    } catch (e: any) {
      alert(e.message || 'Error al retractar alerta');
    }
  };

  return (
    <div style={{ padding: '1.25rem', maxWidth: '680px', margin: '0 auto' }}>
      {/* Acceso real a emergencias: no simular un envío SOS inexistente */}
      <section aria-labelledby="emergency-help-title" style={{ background: '#7f1d1d', color: '#fff', padding: '1.1rem 1.25rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 230px' }}>
            <div id="emergency-help-title" style={{ fontWeight: 850, fontSize: '1.05rem' }}>🚨 ¿Necesitas ayuda inmediata?</div>
            <p style={{ fontSize: '0.82rem', opacity: 0.95, marginTop: 5, lineHeight: 1.5 }}>
              SENDA todavía no transmite llamadas de socorro ni contacta con el 112. Si existe peligro inmediato en la UE, llama al 112.
            </p>
            <p style={{ fontSize: '0.72rem', opacity: 0.82, marginTop: 5 }}>La ubicación se obtiene solo si tú lo solicitas y permanece en esta pantalla; no se envía a ningún servidor.</p>
          </div>
          <a href="tel:112" aria-label="Llamar al 112" className="btn" style={{ background: '#fff', color: '#991b1b', fontWeight: 900, padding: '0.75rem 1.1rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            LLAMAR AL 112
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <button type="button" className="btn" style={{ background: '#991b1b', border: '1px solid rgba(255,255,255,.55)', color: '#fff', fontSize: '0.78rem' }}
            onClick={() => {
              if (!navigator.geolocation) { setLocationMessage('Este dispositivo no ofrece geolocalización en el navegador.'); return; }
              setLocationMessage('Solicitando ubicación al dispositivo…');
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  setEmergencyLocation({ lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy });
                  setLocationMessage('Ubicación obtenida. Comprueba el margen de precisión antes de comunicarla.');
                },
                (error) => setLocationMessage(error.code === error.PERMISSION_DENIED ? 'Permiso denegado. Puedes indicar manualmente la carretera, sentido y punto kilométrico.' : 'No se pudo obtener la ubicación. Indica al 112 la carretera, sentido y punto kilométrico.'),
                { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
              );
            }}>
            Obtener mi ubicación
          </button>
          {emergencyLocation && <button type="button" className="btn" style={{ background: '#fff', color: '#7f1d1d', fontSize: '0.78rem' }}
            onClick={() => {
              const text = `Ubicación aproximada: ${emergencyLocation.lat.toFixed(6)}, ${emergencyLocation.lon.toFixed(6)} (precisión estimada ±${Math.round(emergencyLocation.accuracy)} m)`;
              if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => setLocationMessage('Coordenadas copiadas. Léelas al operador del 112.')).catch(() => setLocationMessage(text));
              else setLocationMessage(text);
            }}>
            Copiar coordenadas
          </button>}
        </div>
        {locationMessage && <p role="status" aria-live="polite" style={{ marginTop: 9, fontSize: '0.75rem', lineHeight: 1.45 }}>{locationMessage}</p>}
        {emergencyLocation && <p style={{ marginTop: 5, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{emergencyLocation.lat.toFixed(6)}, {emergencyLocation.lon.toFixed(6)} · precisión estimada ±{Math.round(emergencyLocation.accuracy)} m</p>}
      </section>

      {/* Header con botón para operadores */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Centro de Alertas Oficiales</h2>
        {isOperator && (
          <button className="btn btn-primary" onClick={() => setShowIssueAlertModal(true)}>
            📢 Emitir Alerta Oficial
          </button>
        )}
      </div>

      {/* Zonas Vigiladas */}
      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Tus Zonas de Alerta Voluntarias</h3>
          {user && (
            <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setShowZoneModal(true)}>
              + Añadir Zona
            </button>
          )}
        </div>
        {zoneSubs.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            No has configurado ninguna zona favorita. Las alertas se reciben por suscripción voluntaria sin rastreo masivo.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {zoneSubs.map((z) => (
              <span key={z.id} className="badge badge-identified" style={{ fontSize: '0.75rem' }}>
                📍 {z.label} (radio {z.radiusKm} km)
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Lista de Alertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {alerts.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No hay alertas oficiales activas en este momento.
          </div>
        ) : (
          alerts.map((al) => (
            <div
              key={al.id}
              style={{
                background: al.status === 'RETRACTED' ? 'var(--bg-secondary)' : '#fff1f2',
                border: al.status === 'RETRACTED' ? '1px dashed var(--border)' : '1px solid #fecdd3',
                borderRadius: 'var(--radius)',
                padding: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${al.status === 'RETRACTED' ? 'badge-retracted' : 'badge-official'}`}>
                    {al.status === 'RETRACTED' ? 'RETRACTADA' : al.severity}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#9f1239' }}>
                    {al.provenance.organization.name}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(al.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '0.5rem', color: al.status === 'RETRACTED' ? 'var(--text-secondary)' : '#9f1239' }}>
                {al.title}
              </h3>

              <p style={{ fontSize: '0.9375rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>{al.body}</p>

              {al.status === 'RETRACTED' && (
                <div style={{ background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', color: '#991b1b', marginBottom: '0.75rem' }}>
                  <strong>Motivo de retractación:</strong> {al.retractionReason}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #fecdd3', paddingTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Emisor verificado: {al.provenance.credential.role}</span>
                {isOperator && al.status === 'ACTIVE' && (
                  <button
                    className="btn btn-outline"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: '#f87171', color: '#b91c1c' }}
                    onClick={() => handleRetract(al.id)}
                  >
                    Retractar Alerta
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Añadir Zona */}
      {showZoneModal && (
        <div className="modal-overlay" onClick={() => setShowZoneModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '0.75rem' }}>Añadir Zona de Alerta</h3>
            <form onSubmit={handleAddZone} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Nombre de la zona (ej: Casa, Trabajo, Universidad)"
                value={zoneLabel}
                onChange={(e) => setZoneLabel(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                required
              />
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Radio de cobertura: {zoneRadius} km</label>
                <input
                  type="range"
                  min="2"
                  max="50"
                  value={zoneRadius}
                  onChange={(e) => setZoneRadius(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowZoneModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Zona</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Emitir Alerta Institucional */}
      {showIssueAlertModal && (
        <div className="modal-overlay" onClick={() => setShowIssueAlertModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '0.75rem' }}>Emitir Alerta Oficial Verificada</h3>
            <form onSubmit={handleIssueOfficialAlert} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Organización Acreditada</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                  required
                >
                  <option value="">-- Selecciona Organización --</option>
                  {user?.organizations?.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.kind})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Severidad</label>
                <select
                  value={alertSeverity}
                  onChange={(e) => setAlertSeverity(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                >
                  <option value="EXTREME">EXTREMA (Peligro vital)</option>
                  <option value="SEVERE">SEVERA (Riesgo grave)</option>
                  <option value="MODERATE">MODERADA (Precaución)</option>
                  <option value="MINOR">MENOR (Aviso preventivo)</option>
                </select>
              </div>

              <input
                type="text"
                placeholder="Título de la alerta oficial..."
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                required
              />

              <textarea
                rows={3}
                placeholder="Instrucciones precisas para la población..."
                value={alertBody}
                onChange={(e) => setAlertBody(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowIssueAlertModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Firmando y emitiendo...' : 'Emitir Alerta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

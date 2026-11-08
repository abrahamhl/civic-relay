import React, { useState } from 'react';
import { api } from '../api/client';

interface Props {
  target: any;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<Props> = ({ target, isOpen, onClose }) => {
  if (!isOpen || !target) return null;

  const [reason, setReason] = useState('MISINFORMATION');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.report({
        targetType: 'POST',
        targetId: target.id,
        reason,
        details: details.trim()
      });
      alert('Reporte recibido conforme al procedimiento DSA. El equipo de confianza revisará el expediente.');
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al enviar reporte');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Notificar Contenido (DSA)</h3>
          <button className="btn btn-outline" style={{ border: 'none' }} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Motivo de la notificación</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '0.25rem' }}
            >
              <option value="MISINFORMATION">Desinformación sobre emergencias o evacuaciones</option>
              <option value="OLD_FOOTAGE_MISREPRESENTED">Vídeo antiguo presentado como actual</option>
              <option value="MANIPULATED_CONTENT">Contenido manipulado o generado artificialmente</option>
              <option value="IMPERSONATION">Suplantación de identidad oficial o institucional</option>
              <option value="VICTIM_PRIVACY_EXPOSURE">Difusión de imágenes de víctimas o vulnerables</option>
              <option value="SENSITIVE_LOCATION_EXPOSURE">Exposición de refugios o ubicaciones sensibles</option>
              <option value="SPAM_SCAM">Spam o fraude</option>
              <option value="OTHER">Otro motivo</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Detalles de la objeción</label>
            <textarea
              rows={3}
              placeholder="Indica enlaces de desmentido o contexto verificable..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '0.25rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar Reporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

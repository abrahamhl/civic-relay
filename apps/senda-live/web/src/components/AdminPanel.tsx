import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Props {
  user: any;
}

export const AdminPanel: React.FC<Props> = ({ user }) => {
  const [subTab, setSubTab] = useState<'health' | 'moderation' | 'users' | 'orgs' | 'audit'>('health');
  const [health, setHealth] = useState<any>(null);
  const [modCases, setModCases] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [orgsList, setOrgsList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSubTabData();
  }, [subTab]);

  const loadSubTabData = async () => {
    setLoading(true);
    try {
      if (subTab === 'health') {
        const res = await api.getAdminHealth();
        setHealth(res);
      } else if (subTab === 'moderation') {
        const res = await api.getModerationCases();
        setModCases(res.cases || []);
      } else if (subTab === 'users') {
        const res = await api.getAdminUsers();
        setUsersList(res.users || []);
      } else if (subTab === 'orgs') {
        const res = await api.getAdminOrgs();
        setOrgsList(res.organizations || []);
      } else if (subTab === 'audit') {
        const res = await api.getAdminAudit();
        setAuditLogs(res.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveModCase = async (caseId: string, decision: string) => {
    const reason = prompt('Motivo de la resolución de moderación (DSA):');
    if (!reason) return;
    try {
      await api.resolveCase(caseId, { decision, reason });
      loadSubTabData();
      alert('Caso de moderación resuelto y notificado al autor.');
    } catch (e: any) {
      alert(e.message || 'Error al resolver caso');
    }
  };

  return (
    <div style={{ padding: '1.25rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>
        🛡️ Panel de Gobierno y Mando SENDA
      </h2>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
        {[
          { id: 'health', label: 'Salud y Métricas' },
          { id: 'moderation', label: 'Casos Moderación (DSA)' },
          { id: 'users', label: 'Usuarios y Roles' },
          { id: 'orgs', label: 'Organizaciones' },
          { id: 'audit', label: 'Registro de Auditoría' }
        ].map((t) => (
          <button
            key={t.id}
            className={`btn ${subTab === t.id ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem' }}
            onClick={() => setSubTab(t.id as any)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cargando datos del sistema...</div>
      ) : subTab === 'health' && health ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Métricas clave */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Usuarios Activos</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{health.metrics?.activeUsers}</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Publicaciones</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{health.metrics?.posts}</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acontecimientos</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{health.metrics?.events}</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Alertas Oficiales</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{health.metrics?.alerts}</div>
            </div>
          </div>

          {/* Adaptadores Externos */}
          <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem' }}>Conectores de Redes Externas (Link First)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {health.adapters?.map((ad: any) => (
                <div key={ad.provider} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{ad.provider}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Modo: {ad.mode}</span>
                  <span className={`badge ${ad.status === 'OK' ? 'badge-corroborated' : 'badge-unverified'}`}>
                    {ad.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : subTab === 'moderation' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {modCases.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No hay expedientes de moderación pendientes.</div>
          ) : (
            modCases.map((c) => (
              <div key={c.id} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Expediente #{c.id.slice(0, 8)} ({c.target_type})</span>
                  <span className={`badge ${c.status === 'OPEN' ? 'badge-official' : 'badge-corroborated'}`}>{c.status}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>Motivo: <strong>{c.reason}</strong> · {c.details}</div>
                {c.status === 'OPEN' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => handleResolveModCase(c.id, 'LABEL_SENSITIVE')}>
                      Etiquetar Sensible
                    </button>
                    <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => handleResolveModCase(c.id, 'LIMIT')}>
                      Limitar Alcance
                    </button>
                    <button className="btn btn-danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => handleResolveModCase(c.id, 'REMOVE')}>
                      Retirar Contenido
                    </button>
                    <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => handleResolveModCase(c.id, 'NO_ACTION')}>
                      Sin Acción
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : subTab === 'audit' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {auditLogs.map((log) => (
            <div key={log.id} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: '0.75rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: log.severity === 'SECURITY' ? 'var(--danger)' : 'var(--text-primary)' }}>
                  [{log.outcome}] {log.action}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{new Date(log.at).toLocaleString()}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Actor: {log.actor_id || 'Anónimo'} · Objetivo: {log.target_type} #{log.target_id || '-'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Gestión de registros activos y asignaciones de rol en base de datos.
        </div>
      )}
    </div>
  );
};

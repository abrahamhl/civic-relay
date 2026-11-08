import React from 'react';

export type NavTab = 'feed' | 'map' | 'publish' | 'messages' | 'alerts' | 'admin';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadAlerts: number;
  unreadMessages: number;
  user: any;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Navigation: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  unreadAlerts,
  unreadMessages,
  user,
  onOpenAuth,
  onLogout
}) => {
  const isAdmin = user?.roles?.some((r: string) => ['PLATFORM_ADMIN', 'TRUST_ANALYST', 'COMMUNITY_MODERATOR', 'INSTITUTIONAL_OPERATOR'].includes(r));

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="left-nav">
        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.25rem' }}>
            S
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.1 }}>SENDA</h1>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)', letterSpacing: '0.05em' }}>LIVE / AHORA</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button
            className={`btn btn-outline ${activeTab === 'feed' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', fontSize: '1rem' }}
            onClick={() => onSelectTab('feed')}
          >
            🏠 Inicio / Feed
          </button>

          <button
            className={`btn btn-outline ${activeTab === 'map' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', fontSize: '1rem' }}
            onClick={() => onSelectTab('map')}
          >
            🗺️ Mapa de Sucesos
          </button>

          <button
            className={`btn btn-outline ${activeTab === 'messages' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', fontSize: '1rem' }}
            onClick={() => onSelectTab('messages')}
          >
            💬 Mensajes
            {unreadMessages > 0 && <span className="badge badge-identified" style={{ marginLeft: 'auto' }}>{unreadMessages}</span>}
          </button>

          <button
            className={`btn btn-outline ${activeTab === 'alerts' ? 'btn-primary' : ''}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', fontSize: '1rem' }}
            onClick={() => onSelectTab('alerts')}
          >
            🚨 Alertas y SOS
            {unreadAlerts > 0 && <span className="badge badge-official" style={{ marginLeft: 'auto' }}>{unreadAlerts}</span>}
          </button>

          {isAdmin && (
            <button
              className={`btn btn-outline ${activeTab === 'admin' ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', fontSize: '1rem' }}
              onClick={() => onSelectTab('admin')}
            >
              🛡️ Sala de Mando / Admin
            </button>
          )}

          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem', padding: '0.875rem 1rem', fontSize: '1rem' }}
            onClick={() => onSelectTab('publish')}
          >
            ✍️ Publicar / Aporte
          </button>
        </nav>

        {/* User Card at bottom */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{user.profile?.displayName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{user.profile?.handle}</div>
              </div>
              <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={onLogout}>
                Salir
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onOpenAuth}>
              Iniciar Sesión
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (5 secciones principales) */}
      <nav className="bottom-nav">
        <button
          className="tab-btn"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.75rem', padding: '0.25rem' }}
          onClick={() => onSelectTab('feed')}
        >
          <span style={{ fontSize: '1.25rem' }}>🏠</span>
          <span>Inicio</span>
        </button>

        <button
          className="tab-btn"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.75rem', padding: '0.25rem' }}
          onClick={() => onSelectTab('map')}
        >
          <span style={{ fontSize: '1.25rem' }}>🗺️</span>
          <span>Mapa</span>
        </button>

        <button
          style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'var(--brand-primary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', cursor: 'pointer', boxShadow: 'var(--shadow-md)', marginTop: '-1rem' }}
          onClick={() => onSelectTab('publish')}
          title="Publicar"
        >
          +
        </button>

        <button
          className="tab-btn"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.75rem', padding: '0.25rem', position: 'relative' }}
          onClick={() => onSelectTab('messages')}
        >
          <span style={{ fontSize: '1.25rem' }}>💬</span>
          <span>Mensajes</span>
          {unreadMessages > 0 && <span style={{ position: 'absolute', top: 0, right: '1.5rem', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-primary)' }} />}
        </button>

        <button
          className="tab-btn"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.75rem', padding: '0.25rem', position: 'relative' }}
          onClick={() => onSelectTab('alerts')}
        >
          <span style={{ fontSize: '1.25rem' }}>🚨</span>
          <span>Alertas</span>
          {unreadAlerts > 0 && <span style={{ position: 'absolute', top: 0, right: '1.5rem', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} />}
        </button>
      </nav>
    </>
  );
};

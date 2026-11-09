import React, { useState } from 'react';
import { api } from '../api/client';

interface Props {
  posts: any[];
  stories: any[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSelectEvent: (eventId: string) => void;
  onOpenReport: (post: any) => void;
  user: any;
}

export const FeedView: React.FC<Props> = ({
  posts,
  stories,
  activeTab,
  onTabChange,
  onSelectEvent,
  onOpenReport,
  user
}) => {
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

  const toggleComments = async (postId: string) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }
    setActiveCommentsPostId(postId);
    setLoadingComments(true);
    try {
      const res = await api.getComments(postId);
      setComments(res.comments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    try {
      const res = await api.addComment(postId, commentText.trim());
      setComments((prev) => [...prev, res.comment]);
      setCommentText('');
    } catch (e: any) {
      alert(e.message || 'Error al comentar');
    }
  };

  const handleReact = async (post: any) => {
    try {
      const res = await api.toggleReaction(post.id);
      post.viewer.reacted = res.reacted;
      post.counts.reactions = res.count;
    } catch (e: any) {
      alert(e.message || 'Inicia sesión para reaccionar');
    }
  };

  const handleFollowEvent = async (eventId: string, currentFollowing: boolean) => {
    try {
      await api.setEventSubscription(eventId, !currentFollowing, true);
      alert(!currentFollowing ? 'Ahora sigues este acontecimiento y recibirás actualizaciones.' : 'Has dejado de seguir este acontecimiento.');
    } catch (e: any) {
      alert(e.message || 'Error al gestionar suscripción');
    }
  };

  return (
    <div>
      {/* Feed Tabs Bar */}
      <div className="tabs-bar">
        {['for_you', 'following', 'nearby', 'news', 'live'].map((tab) => {
          const labels: Record<string, string> = {
            for_you: 'Para ti',
            following: 'Siguiendo',
            nearby: 'Cerca',
            news: 'Noticias',
            live: 'En directo'
          };
          return (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => onTabChange(tab)}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Stories / Actualizaciones breves */}
      {stories.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', padding: '1rem', borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
          {stories.map((st) => (
            <div
              key={st.id}
              style={{ flexShrink: 0, width: '5.5rem', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => { if (st.url) window.open(st.url, '_blank'); }}
            >
              <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', margin: '0 auto 0.25rem', border: '2px solid var(--brand-primary)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)' }}>
                <span style={{ fontSize: '1.25rem' }}>
                  {st.mode === 'OFFICIAL_COMMUNICATION' ? '📢' : st.mode === 'NEWS_STORY' ? '📰' : '⚡'}
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {st.author.displayName}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Posts List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {posts.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>No hay publicaciones en esta vista</p>
            <p style={{ fontSize: '0.875rem' }}>Sé el primero en compartir un enlace, reporte o noticia de tu zona.</p>
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="card">
              {/* Header: Author & Verification */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                    {post.author.displayName[0]}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{post.author.displayName}</span>
                      {post.author.verification.accountVerified && (
                        <span title="Cuenta verificada" style={{ color: 'var(--info)', fontSize: '0.875rem' }}>✓</span>
                      )}
                      {post.author.verification.organization && (
                        <span className="badge badge-official" style={{ fontSize: '0.625rem', padding: '0.1rem 0.35rem' }}>
                          {post.author.verification.organization.name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      @{post.author.handle} · {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-outline"
                  style={{ border: 'none', padding: '0.25rem', color: 'var(--text-muted)' }}
                  onClick={() => onOpenReport(post)}
                  title="Reportar publicación"
                >
                  •••
                </button>
              </div>

              {/* Title & Body */}
              {post.title && (
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>{post.title}</h3>
              )}
              {post.body && (
                <p style={{ fontSize: '0.9375rem', marginBottom: '0.75rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {post.body}
                </p>
              )}

              {/* Location Tag */}
              {post.location && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>📍 {post.location.label || `${post.location.latCoarse}, ${post.location.lonCoarse}`}</span>
                  <span style={{ color: 'var(--text-muted)' }}>({post.location.precision})</span>
                </div>
              )}

              {/* Media Reference / Embed Player (Click-to-load) */}
              {post.media && (
                <div style={{ marginBottom: '0.75rem', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {post.media.embed?.kind === 'IFRAME_CLICK_TO_LOAD' && activeEmbedId === post.id ? (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                      <iframe
                        src={post.media.embed.src}
                        title={post.media.title || 'Reproductor'}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          {post.media.siteName || post.media.provider}
                        </span>
                        {post.media.authorName && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>por {post.media.authorName}</span>
                        )}
                      </div>
                      {post.media.title && (
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{post.media.title}</div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {post.media.embed?.kind === 'IFRAME_CLICK_TO_LOAD' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => setActiveEmbedId(post.id)}
                          >
                            ▶ Cargar reproductor oficial
                          </button>
                        )}
                        <a
                          href={post.media.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none' }}
                        >
                          ↗ Ver en fuente original
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Linked Events Badges */}
              {post.events && post.events.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                  {post.events.map((ev: any) => (
                    <div
                      key={ev.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius)', fontSize: '0.75rem' }}
                    >
                      <span
                        style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--brand-primary)' }}
                        onClick={() => onSelectEvent(ev.id)}
                      >
                        ⚡ {ev.title}
                      </span>
                      <span className={`badge ${
                        ev.verification.contentStatus === 'OFFICIAL_SOURCE_CONFIRMED' ? 'badge-official' :
                        ev.verification.contentStatus === 'CORROBORATED' ? 'badge-corroborated' :
                        ev.verification.contentStatus === 'DISPUTED' ? 'badge-disputed' : 'badge-unverified'
                      }`}>
                        {ev.verification.contentStatus}
                      </span>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.1rem 0.4rem', fontSize: '0.6875rem' }}
                        onClick={() => handleFollowEvent(ev.id, ev.viewerFollows)}
                      >
                        {ev.viewerFollows ? 'Siguiendo ✓' : '+ Seguir evento'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <button
                  className={`btn btn-outline ${post.viewer.reacted ? 'btn-primary' : ''}`}
                  style={{ border: 'none', padding: '0.35rem 0.5rem', fontSize: '0.8125rem' }}
                  onClick={() => handleReact(post)}
                >
                  ❤️ {post.counts.reactions > 0 && post.counts.reactions}
                </button>

                <button
                  className="btn btn-outline"
                  style={{ border: 'none', padding: '0.35rem 0.5rem', fontSize: '0.8125rem' }}
                  onClick={() => toggleComments(post.id)}
                >
                  💬 Comentarios ({post.counts.comments})
                </button>

                <button
                  className="btn btn-outline"
                  style={{ border: 'none', padding: '0.35rem 0.5rem', fontSize: '0.8125rem' }}
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: post.title, text: post.body, url: window.location.href });
                    } else {
                      navigator.clipboard.writeText(window.location.origin + '/?post=' + post.id);
                      alert('Enlace copiado al portapapeles');
                    }
                  }}
                >
                  ↗ Compartir
                </button>
              </div>

              {/* Expandable Comments Drawer */}
              {activeCommentsPostId === post.id && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Escribe un comentario..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                    />
                    <button className="btn btn-primary" style={{ padding: '0.4rem 0.75rem' }} onClick={() => handleAddComment(post.id)}>
                      Enviar
                    </button>
                  </div>

                  {loadingComments ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cargando comentarios...</div>
                  ) : comments.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aún no hay comentarios. Sé el primero.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {comments.map((c) => (
                        <div key={c.id} style={{ background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', fontSize: '0.8125rem' }}>
                          <span style={{ fontWeight: 700 }}>{c.author.displayName}</span>: {c.body}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
};

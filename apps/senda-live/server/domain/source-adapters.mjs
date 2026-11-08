/**
 * Integraciones externas «LINK FIRST». Interfaz común `SocialSourceAdapter`:
 *   authorize · resolveUrl · fetchPermittedMetadata · renderEmbed · getCreatorMedia ·
 *   publishWithApproval · refresh · revoke · health
 * Lo no admitido devuelve { status: 'UNSUPPORTED' }; lo que exige revisión de la plataforma,
 * { status: 'APPROVAL_REQUIRED' }. Nunca se piden contraseñas de terceros, nunca se descarga
 * ni re-aloja el vídeo, y nunca se guarda ni se renderiza HTML de terceros: el reproductor
 * se construye a partir de un identificador validado con expresión regular y un host fijo.
 */
import { safeFetch, validatePublicUrl } from './safe-fetch.mjs';

export const UNSUPPORTED = Object.freeze({ status: 'UNSUPPORTED' });
export const APPROVAL_REQUIRED = Object.freeze({ status: 'APPROVAL_REQUIRED' });

const clean = (s, max = 300) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : null) || null;
const httpsUrlOrNull = (s) => { try { const u = new URL(s); return u.protocol === 'https:' ? u.toString().slice(0, 1024) : null; } catch { return null; } };

function baseAdapter(provider, overrides) {
  return {
    provider,
    authorize: () => UNSUPPORTED,
    resolveUrl: () => null,
    fetchPermittedMetadata: async () => ({ status: 'METADATA_UNAVAILABLE' }),
    renderEmbed: () => ({ kind: 'LINK_CARD' }),
    getCreatorMedia: () => UNSUPPORTED,
    publishWithApproval: () => UNSUPPORTED,
    refresh: () => UNSUPPORTED,
    revoke: () => UNSUPPORTED,
    health: () => ({ status: 'OK', mode: 'LINK_ONLY' }),
    ...overrides,
  };
}

async function oembed(fetcher, endpoint, url) {
  const r = await fetcher(`${endpoint}${encodeURIComponent(url)}`, { accept: 'application/json' });
  if (r.status !== 200) return null;
  try { return JSON.parse(r.text); } catch { return null; }
}

/* YouTube: oEmbed público oficial + reproductor youtube-nocookie bajo clic. */
const youtube = baseAdapter('youtube', {
  resolveUrl(u) {
    const h = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (h === 'youtube.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = /^\/(shorts|live|embed)\/([^/?#]+)/.exec(u.pathname); if (m) id = m[2]; }
    }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return h === 'youtube.com' || h === 'youtu.be' ? { provider: 'youtube', externalId: null, canonicalUrl: u.toString() } : null;
    return { provider: 'youtube', externalId: id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` };
  },
  async fetchPermittedMetadata(r, { fetcher }) {
    const j = await oembed(fetcher, 'https://www.youtube.com/oembed?format=json&url=', r.canonicalUrl);
    if (!j) return { status: 'METADATA_UNAVAILABLE' };
    return { status: 'OK', title: clean(j.title), authorName: clean(j.author_name, 120), authorUrl: httpsUrlOrNull(j.author_url), siteName: 'YouTube', thumbnailUrl: httpsUrlOrNull(j.thumbnail_url) };
  },
  renderEmbed: (r) => (r.externalId ? { kind: 'IFRAME_CLICK_TO_LOAD', src: `https://www.youtube-nocookie.com/embed/${r.externalId}` } : { kind: 'LINK_CARD' }),
  authorize: () => APPROVAL_REQUIRED, // YouTube Data API (OAuth) requiere proyecto verificado: no configurado.
  getCreatorMedia: () => APPROVAL_REQUIRED,
  health: () => ({ status: 'OK', mode: 'OEMBED_PUBLIC' }),
});

/* TikTok: oEmbed público + reproductor oficial player/v1. Display API (OAuth) = app aprobada. */
const tiktok = baseAdapter('tiktok', {
  resolveUrl(u) {
    const h = u.hostname.replace(/^(www\.|m\.)/, '');
    if (!['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(h)) return null;
    const m = /^\/@([A-Za-z0-9._]{1,40})\/(video|photo)\/(\d{8,25})/.exec(u.pathname);
    if (!m) return { provider: 'tiktok', externalId: null, canonicalUrl: u.toString() };
    return { provider: 'tiktok', externalId: m[3], canonicalUrl: `https://www.tiktok.com/@${m[1]}/${m[2]}/${m[3]}` };
  },
  async fetchPermittedMetadata(r, { fetcher }) {
    const j = await oembed(fetcher, 'https://www.tiktok.com/oembed?url=', r.canonicalUrl);
    if (!j) return { status: 'METADATA_UNAVAILABLE' };
    return { status: 'OK', title: clean(j.title), authorName: clean(j.author_name, 120), authorUrl: httpsUrlOrNull(j.author_url), siteName: 'TikTok', thumbnailUrl: httpsUrlOrNull(j.thumbnail_url) };
  },
  renderEmbed: (r) => (r.externalId ? { kind: 'IFRAME_CLICK_TO_LOAD', src: `https://www.tiktok.com/player/v1/${r.externalId}` } : { kind: 'LINK_CARD' }),
  authorize: () => APPROVAL_REQUIRED, // Login Kit + Display API: requiere app registrada y aprobada.
  getCreatorMedia: () => APPROVAL_REQUIRED,
  health: () => ({ status: 'OK', mode: 'OEMBED_PUBLIC', oauth: 'APPROVAL_REQUIRED' }),
});

/* Instagram / Facebook: oEmbed de Meta exige token de app + revisión → solo tarjeta de enlace. */
const metaAdapter = (provider, hosts, re) => baseAdapter(provider, {
  resolveUrl(u) {
    const h = u.hostname.replace(/^(www\.|m\.|l\.)/, '');
    if (!hosts.includes(h)) return null;
    const m = re.exec(u.pathname);
    return { provider, externalId: m ? m[2] ?? m[1] : null, canonicalUrl: `${u.origin.replace('://m.', '://www.')}${u.pathname}` };
  },
  fetchPermittedMetadata: async () => ({ status: 'APPROVAL_REQUIRED', siteName: provider === 'instagram' ? 'Instagram' : 'Facebook' }),
  authorize: () => APPROVAL_REQUIRED,
  getCreatorMedia: () => APPROVAL_REQUIRED,
  publishWithApproval: () => APPROVAL_REQUIRED,
  health: () => ({ status: 'APPROVAL_REQUIRED', mode: 'LINK_ONLY', note: 'Meta oEmbed Read / Instagram Platform requieren App Review' }),
});
const instagram = metaAdapter('instagram', ['instagram.com'], /^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/);
const facebook = metaAdapter('facebook', ['facebook.com', 'fb.watch'], /^\/(?:.+\/)?(videos|posts|reel)\/([A-Za-z0-9._-]+)/);

/* X: oEmbed público solo para autor; no se carga widgets.js (script de terceros) → tarjeta. */
const x = baseAdapter('x', {
  resolveUrl(u) {
    const h = u.hostname.replace(/^(www\.|mobile\.)/, '');
    if (!['x.com', 'twitter.com'].includes(h)) return null;
    const m = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})/.exec(u.pathname);
    return { provider: 'x', externalId: m ? m[2] : null, canonicalUrl: m ? `https://x.com/${m[1]}/status/${m[2]}` : u.toString() };
  },
  async fetchPermittedMetadata(r, { fetcher }) {
    const j = await oembed(fetcher, 'https://publish.twitter.com/oembed?omit_script=true&url=', r.canonicalUrl);
    if (!j) return { status: 'METADATA_UNAVAILABLE', siteName: 'X' };
    return { status: 'OK', title: null, authorName: clean(j.author_name, 120), authorUrl: httpsUrlOrNull(j.author_url), siteName: 'X' };
  },
  authorize: () => APPROVAL_REQUIRED,
  health: () => ({ status: 'OK', mode: 'LINK_CARD_ONLY' }),
});

/* Bluesky (AT Protocol): oEmbed público; el embed oficial se construye desde el at-uri validado. */
const bluesky = baseAdapter('bluesky', {
  resolveUrl(u) {
    if (u.hostname !== 'bsky.app') return null;
    const m = /^\/profile\/([A-Za-z0-9._:-]{3,253})\/post\/([a-z0-9]{8,20})$/.exec(u.pathname);
    return { provider: 'bluesky', externalId: m ? `${m[1]}/${m[2]}` : null, canonicalUrl: m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : u.toString() };
  },
  async fetchPermittedMetadata(r, { fetcher }) {
    const j = await oembed(fetcher, 'https://embed.bsky.app/oembed?url=', r.canonicalUrl);
    if (!j) return { status: 'METADATA_UNAVAILABLE', siteName: 'Bluesky' };
    const at = /data-bluesky-uri="at:\/\/(did:(?:plc|web):[A-Za-z0-9._:%-]{1,200})\/app\.bsky\.feed\.post\/([a-z0-9]{8,20})"/.exec(String(j.html || ''));
    return { status: 'OK', title: null, authorName: clean(j.author_name, 120), authorUrl: httpsUrlOrNull(j.author_url), siteName: 'Bluesky', atUri: at ? { did: at[1], rkey: at[2] } : null };
  },
  renderEmbed: (r, meta) => (meta?.atUri ? { kind: 'IFRAME_CLICK_TO_LOAD', src: `https://embed.bsky.app/embed/${meta.atUri.did}/app.bsky.feed.post/${meta.atUri.rkey}` } : { kind: 'LINK_CARD' }),
  authorize: () => ({ status: 'SPECIFIED', note: 'OAuth AT Protocol (DPoP+PAR) especificado; no implementado en v0.1' }),
  health: () => ({ status: 'OK', mode: 'OEMBED_PUBLIC' }),
});

/* Genérico (periódicos, blogs, ActivityPub/Mastodon): OpenGraph mínimo vía safeFetch. */
const generic = baseAdapter('web', {
  resolveUrl: (u) => ({ provider: 'web', externalId: null, canonicalUrl: u.toString() }),
  async fetchPermittedMetadata(r, { fetcher }) {
    const res = await fetcher(r.canonicalUrl, { accept: 'text/html' });
    if (res.status !== 200 || !res.text) return { status: 'METADATA_UNAVAILABLE', siteName: new URL(r.canonicalUrl).hostname };
    const head = res.text.slice(0, 200_000);
    const meta = (prop) => {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
      const tag = re.exec(head)?.[0];
      return tag ? decodeEntities(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? '') : null;
    };
    const title = meta('og:title') ?? decodeEntities(/<title[^>]*>([^<]{1,300})<\/title>/i.exec(head)?.[1] ?? '');
    return {
      status: 'OK', title: clean(title), description: clean(meta('og:description') ?? meta('description'), 500),
      siteName: clean(meta('og:site_name'), 120) ?? new URL(r.canonicalUrl).hostname, authorName: clean(meta('author'), 120),
      thumbnailUrl: httpsUrlOrNull(meta('og:image')), publishedAt: meta('article:published_time'),
    };
  },
});

function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) % 0x110000));
}

export const ADAPTERS = [youtube, tiktok, instagram, facebook, x, bluesky];
export const ALL_ADAPTERS = [...ADAPTERS, generic];

/**
 * Resuelve una URL compartida a una referencia externa (sin descargar medios).
 * @returns {Promise<{provider, externalId, canonicalUrl, meta, embed}>}
 */
export async function resolveSharedUrl(input, { fetcher = safeFetch, fetchMetadata = true } = {}) {
  const u = validatePublicUrl(input);
  let adapter = generic, resolved = null;
  for (const a of ADAPTERS) { resolved = a.resolveUrl(u); if (resolved) { adapter = a; break; } }
  if (!resolved) resolved = generic.resolveUrl(u);
  let meta = { status: 'METADATA_UNAVAILABLE' };
  if (fetchMetadata) {
    try { meta = await adapter.fetchPermittedMetadata(resolved, { fetcher }); }
    catch (err) { meta = { status: 'METADATA_UNAVAILABLE', error: err.code || 'FETCH_FAILED' }; }
  } else if (adapter.provider === 'instagram' || adapter.provider === 'facebook') {
    meta = await adapter.fetchPermittedMetadata(resolved, { fetcher });
  }
  const embed = adapter.renderEmbed(resolved, meta);
  return { provider: adapter.provider, externalId: resolved.externalId, canonicalUrl: resolved.canonicalUrl, meta, embed };
}

export function adapterHealth() {
  return ALL_ADAPTERS.map((a) => ({ provider: a.provider, ...a.health(), oauth: a.authorize().status, creatorMedia: a.getCreatorMedia().status, publish: a.publishWithApproval().status }));
}

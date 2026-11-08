/**
 * Cliente API HTTP y SSE para SENDA LIVE.
 * Gestiona cabeceras de seguridad CSRF (X-Senda-Request), reconexión en tiempo real y offline fallback.
 */
import { enqueueOfflineItem, cacheFeedPosts, getCachedFeed } from '../offline/storage';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  // CSRF Protection
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers.set('X-Senda-Request', '1');
  }

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
      let errData: any = {};
      try { errData = await res.json(); } catch {}
      throw new ApiError(res.status, errData.error || 'ERROR', errData.message || res.statusText);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return await res.text();
  } catch (err: any) {
    // Si falla por red (offline) y es una mutación, encolar según el tipo
    if (!navigator.onLine && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (path === '/api/posts' && options.body) {
        const payload = JSON.parse(options.body as string);
        const queued = await enqueueOfflineItem('POST', payload);
        return { post: { ...payload, id: queued.id, moderationState: 'QUEUED_OFFLINE', createdAt: Date.now() } };
      }
    }
    throw err;
  }
}

export const api = {
  // Auth
  async register(data: any) { return request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }); },
  async login(data: any) { return request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }); },
  async logout() { return request('/api/auth/logout', { method: 'POST' }); },
  async me() { return request('/api/auth/me'); },
  async updateProfile(data: any) { return request('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }); },
  async updateSettings(data: any) { return request('/api/auth/settings', { method: 'PATCH', body: JSON.stringify(data) }); },
  async exportData() { return request('/api/auth/export'); },

  // Posts & Feed
  async previewLink(url: string) { return request('/api/posts/preview-link', { method: 'POST', body: JSON.stringify({ url }) }); },
  async createPost(data: any) { return request('/api/posts', { method: 'POST', body: JSON.stringify(data) }); },
  async getPost(id: string) { return request(`/api/posts/${id}`); },
  async getFeed(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    try {
      const res = await request(`/api/feed${qs ? '?' + qs : ''}`);
      if (res.items) cacheFeedPosts(res.items);
      return res;
    } catch (err) {
      if (!navigator.onLine) {
        const cached = await getCachedFeed();
        return { items: cached, nextCursor: null, offline: true };
      }
      throw err;
    }
  },
  async toggleReaction(id: string) { return request(`/api/posts/${id}/react`, { method: 'POST' }); },
  async toggleSave(id: string) { return request(`/api/posts/${id}/save`, { method: 'POST' }); },
  async addComment(id: string, body: string) { return request(`/api/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }); },
  async getComments(id: string) { return request(`/api/posts/${id}/comments`); },
  async getStories() { return request('/api/stories'); },

  // Public scientific source records (separate from SENDA emergency alerts).
  async getUsgsEarthquakes() { return request('/api/sources/usgs-earthquakes'); },
  async getEonetWildfires() { return request('/api/sources/eonet-wildfires'); },
  async getWeatherGrid(region: string) { return request('/api/sources/weather-grid?region=' + encodeURIComponent(region)); },

  // Events
  async getEvents(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/events${qs ? '?' + qs : ''}`);
  },
  async getEvent(id: string) { return request(`/api/events/${id}`); },
  async createEvent(data: any) { return request('/api/events', { method: 'POST', body: JSON.stringify(data) }); },
  async linkPostToEvent(eventId: string, postId: string, relation: string = 'REPORTS') {
    return request(`/api/events/${eventId}/link-post`, { method: 'POST', body: JSON.stringify({ postId, relation }) });
  },
  async setEventSubscription(eventId: string, following: boolean, notify: boolean = true) {
    return request(`/api/events/${eventId}/subscription`, { method: 'POST', body: JSON.stringify({ following, notify }) });
  },
  async postEventUpdate(eventId: string, data: any) {
    return request(`/api/events/${eventId}/updates`, { method: 'POST', body: JSON.stringify(data) });
  },
  async decideEventStatus(eventId: string, toStatus: string, reason: string) {
    return request(`/api/events/${eventId}/decide-status`, { method: 'POST', body: JSON.stringify({ toStatus, reason }) });
  },
  async getIntelligenceCandidates() { return request('/api/events/intelligence/candidates'); },

  // Alerts & Emergency
  async getAlerts(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/alerts${qs ? '?' + qs : ''}`);
  },
  async issueAlert(data: any) { return request('/api/alerts', { method: 'POST', body: JSON.stringify(data) }); },
  async retractAlert(id: string, reason: string) {
    return request(`/api/alerts/${id}/retract`, { method: 'POST', body: JSON.stringify({ reason }) });
  },
  async getZoneSubscriptions() { return request('/api/zones/subscriptions'); },
  async addZoneSubscription(data: any) { return request('/api/zones/subscriptions', { method: 'POST', body: JSON.stringify(data) }); },
  async deleteZoneSubscription(id: string) { return request(`/api/zones/subscriptions/${id}`, { method: 'DELETE' }); },
  async getDtnStats() { return request('/api/dtn/stats'); },

  // Messaging
  async getChannels() { return request('/api/channels'); },
  async joinChannel(id: string) { return request(`/api/channels/${id}/join`, { method: 'POST' }); },
  async getConversations() { return request('/api/conversations'); },
  async createConversation(data: any) { return request('/api/conversations', { method: 'POST', body: JSON.stringify(data) }); },
  async getMessages(conversationId: string) { return request(`/api/conversations/${conversationId}/messages`); },
  async sendMessage(conversationId: string, data: any) {
    return request(`/api/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(data) });
  },

  // Moderation
  async report(data: any) { return request('/api/moderation/report', { method: 'POST', body: JSON.stringify(data) }); },
  async getModerationCases() { return request('/api/moderation/cases'); },
  async resolveCase(caseId: string, data: any) { return request(`/api/moderation/cases/${caseId}/resolve`, { method: 'POST', body: JSON.stringify(data) }); },

  // Admin
  async getAdminHealth() { return request('/api/admin/health'); },
  async getAdminAudit() { return request('/api/admin/audit'); },
  async getAdminUsers() { return request('/api/admin/users'); },
  async getAdminOrgs() { return request('/api/admin/organizations'); },
  async createOrg(data: any) { return request('/api/admin/organizations', { method: 'POST', body: JSON.stringify(data) }); },
  async assignRole(data: any) { return request('/api/admin/roles', { method: 'POST', body: JSON.stringify(data) }); }
};

/**
 * Conexión SSE persistente con reanudación por Last-Event-ID.
 */
export function subscribeRealtime(onEvent: (event: any) => void) {
  const es = new EventSource('/api/realtime/stream');
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch {}
  };
  es.addEventListener('POST_CREATED', (e: any) => onEvent({ type: 'POST_CREATED', ...JSON.parse(e.data) }));
  es.addEventListener('ALERT_PUBLISHED', (e: any) => onEvent({ type: 'ALERT_PUBLISHED', ...JSON.parse(e.data) }));
  es.addEventListener('ALERT_RETRACTED', (e: any) => onEvent({ type: 'ALERT_RETRACTED', ...JSON.parse(e.data) }));
  es.addEventListener('NOTIFICATION', (e: any) => onEvent({ type: 'NOTIFICATION', ...JSON.parse(e.data) }));
  es.addEventListener('MESSAGE_RECEIVED', (e: any) => onEvent({ type: 'MESSAGE_RECEIVED', ...JSON.parse(e.data) }));
  return () => es.close();
}

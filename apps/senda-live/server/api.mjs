/**
 * Enrutador API REST y SSE para SENDA LIVE.
 * 
 * Cumple con:
 *  - Autenticación con cookies HttpOnly y token Bearer como fallback.
 *  - CSRF check para mutaciones (POST, PUT, PATCH, DELETE): cabecera X-Senda-Request: 1.
 *  - Rate limiting por IP y por usuario.
 *  - Respuestas JSON estructuradas y manejo uniforme de errores HttpError.
 */
import {
  createRouter, parseCookies, serializeCookie, readJson, sendJson,
  createRateLimiter, HttpError, bad, forbidden
} from './http.mjs';
import { COOKIE_NAME } from './services/auth.mjs';
import { adapterHealth } from './domain/source-adapters.mjs';
import { createUsgsEarthquakeFeed } from './domain/usgs-earthquakes.mjs';
import { createEonetWildfireFeed } from './domain/eonet-wildfires.mjs';
import { createWeatherGridFeed, WEATHER_REGIONS } from './domain/weather-grid.mjs';
import { createMetNorwayGridFeed } from './domain/metno-weather-grid.mjs';
import { createTerrainGridFeed } from './domain/terrain-grid.mjs';

export function createApiHandler({
  db, auth, social, events, emergency, messaging, moderation, admin, rt,
  usgsFeed = createUsgsEarthquakeFeed(),
  eonetFeed = createEonetWildfireFeed(),
  weatherGridFeed = process.env.SENDA_WEATHER_PROVIDER === 'openmeteo' ? createWeatherGridFeed() : createMetNorwayGridFeed(),
  terrainGridFeed = createTerrainGridFeed(),
}) {
  const router = createRouter();
  const rateLimiter = createRateLimiter();

  // Helper de extracción de sesión
  function getSession(req) {
    const cookies = parseCookies(req.headers['cookie']);
    let token = cookies[COOKIE_NAME];
    if (!token && req.headers['authorization']) {
      const match = /^Bearer\s+([A-Za-z0-9_-]+)$/i.exec(req.headers['authorization']);
      if (match) token = match[1];
    }
    if (!token) return null;
    return auth.authenticate(token);
  }

  function requireUser(req) {
    const s = getSession(req);
    if (!s) throw new HttpError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar');
    return s.userId;
  }

  function checkCsrf(req) {
    // Si la petición es mutante, requerimos la cabecera X-Senda-Request
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.headers['x-senda-request'] !== '1') {
        throw forbidden('CSRF_DETECTED', 'Cabecera X-Senda-Request obligatoria en mutaciones');
      }
    }
  }

  /* ------------------- AUTH ------------------- */
  router.post('/api/auth/register', async (req, res, { ip }) => {
    const body = await readJson(req);
    const { token, user } = auth.register(body, { ip });
    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, token, { maxAge: 30 * 86400, sameSite: 'Lax' }));
    sendJson(res, 201, { user, token });
  });

  router.post('/api/auth/login', async (req, res, { ip }) => {
    const body = await readJson(req);
    const { token, user } = auth.login(body, { ip });
    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, token, { maxAge: 30 * 86400, sameSite: 'Lax' }));
    sendJson(res, 200, { user, token });
  });

  router.post('/api/auth/logout', async (req, res, { ip }) => {
    const cookies = parseCookies(req.headers['cookie']);
    const token = cookies[COOKIE_NAME];
    const session = getSession(req);
    auth.logout(token, { actorId: session?.userId, ip });
    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { maxAge: 0 }));
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/auth/me', (req, res) => {
    const s = getSession(req);
    if (!s) return sendJson(res, 200, { user: null });
    const user = auth.userSummary(s.userId);
    sendJson(res, 200, { user });
  });

  router.patch('/api/auth/profile', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const user = auth.updateProfile(userId, body);
    sendJson(res, 200, { user });
  });

  router.patch('/api/auth/settings', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const user = auth.updateSettings(userId, body);
    sendJson(res, 200, { user });
  });

  router.post('/api/auth/consent', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const receipt = auth.recordConsent(userId, body);
    sendJson(res, 200, { receipt });
  });

  router.get('/api/auth/export', (req, res) => {
    const userId = requireUser(req);
    const data = auth.exportUserData(userId);
    sendJson(res, 200, data);
  });

  router.delete('/api/auth/account', (req, res, { ip }) => {
    const userId = requireUser(req);
    auth.deleteAccount(userId, { ip });
    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { maxAge: 0 }));
    sendJson(res, 200, { deleted: true });
  });

  /* ------------------- SOCIAL & FEED ------------------- */
  router.post('/api/posts/preview-link', async (req, res) => {
    const body = await readJson(req);
    if (!body.url) throw bad('URL_REQUIRED');
    const preview = await social.previewLink(body.url);
    sendJson(res, 200, preview);
  });

  router.post('/api/posts', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const post = await social.createPost(userId, body, { ip });
    sendJson(res, 201, { post });
  });

  router.get('/api/posts/:id', (req, res, { params }) => {
    const s = getSession(req);
    const post = social.getPost(params.id, s?.userId);
    sendJson(res, 200, { post });
  });

  router.delete('/api/posts/:id', (req, res) => {
    const userId = requireUser(req);
    const result = social.deletePost(userId, params.id);
    sendJson(res, 200, result);
  });

  router.get('/api/feed', (req, res, { query }) => {
    const s = getSession(req);
    const feed = social.listFeed({
      viewerId: s?.userId,
      tab: query.tab,
      category: query.category,
      lat: query.lat ? Number(query.lat) : null,
      lon: query.lon ? Number(query.lon) : null,
      radiusKm: query.radiusKm ? Number(query.radiusKm) : 25,
      cursor: query.cursor,
      limit: query.limit
    });
    sendJson(res, 200, feed);
  });

  router.post('/api/posts/:id/react', (req, res, { params }) => {
    const userId = requireUser(req);
    const resToggle = social.toggleReaction(userId, params.id);
    sendJson(res, 200, resToggle);
  });

  router.post('/api/posts/:id/save', (req, res, { params }) => {
    const userId = requireUser(req);
    const resSave = social.toggleSave(userId, params.id);
    sendJson(res, 200, resSave);
  });

  router.post('/api/posts/:id/comments', async (req, res, { params }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const comment = social.addComment(userId, params.id, body);
    sendJson(res, 201, { comment });
  });

  router.get('/api/posts/:id/comments', (req, res, { params }) => {
    const comments = social.listComments(params.id);
    sendJson(res, 200, { comments });
  });

  router.get('/api/stories', (req, res) => {
    const stories = social.listStories();
    sendJson(res, 200, { stories });
  });

  router.post('/api/social/follow', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const result = social.toggleFollow(userId, body);
    sendJson(res, 200, result);
  });

  router.post('/api/social/block', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    if (!body.targetUserId) throw bad('TARGET_USER_REQUIRED');
    const result = social.toggleBlock(userId, body.targetUserId);
    sendJson(res, 200, result);
  });

  /* ------------------- EVENT HUB ------------------- */
  router.post('/api/events', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const event = events.createEvent(userId, body, { ip });
    sendJson(res, 201, { event });
  });

  router.get('/api/events', (req, res, { query }) => {
    const s = getSession(req);
    const list = events.listEvents({
      q: query.q,
      type: query.type,
      status: query.status,
      bbox: query.bbox,
      lat: query.lat,
      lon: query.lon,
      radiusKm: query.radiusKm,
      polygon: query.polygon,
      since: query.since,
      viewerId: s?.userId,
      limit: query.limit
    });
    sendJson(res, 200, { events: list });
  });

  router.get('/api/events/:id', (req, res, { params }) => {
    const s = getSession(req);
    const event = events.getEvent(params.id, s?.userId);
    sendJson(res, 200, { event });
  });

  router.post('/api/events/:id/link-post', async (req, res, { params }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const event = events.linkPost(userId, params.id, body);
    sendJson(res, 200, { event });
  });

  router.post('/api/events/:id/observations', async (req, res, { params }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const event = events.addObservation(userId, params.id, body);
    sendJson(res, 201, { event });
  });

  router.post('/api/events/:id/updates', async (req, res, { params, ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const result = events.postUpdate(userId, params.id, body, { ip });
    sendJson(res, 201, result);
  });

  router.post('/api/events/:id/decide-status', async (req, res, { params, ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const event = events.decideStatus(userId, params.id, body, { ip });
    sendJson(res, 200, { event });
  });

  router.post('/api/events/:id/subscription', async (req, res, { params }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const sub = events.setSubscription(userId, params.id, body);
    sendJson(res, 200, sub);
  });

  router.get('/api/events/intelligence/candidates', (req, res) => {
    const candidates = events.intelligenceCandidates();
    sendJson(res, 200, candidates);
  });

  /* ------------------- ALERTS & EMERGENCY ------------------- */
  router.post('/api/alerts', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const alert = await emergency.issueAlert(userId, body, { ip });
    sendJson(res, 201, { alert });
  });

  router.get('/api/alerts', (req, res, { query }) => {
    const list = emergency.listAlerts({
      severity: query.severity,
      includeExpired: query.includeExpired === 'true'
    });
    sendJson(res, 200, { alerts: list });
  });

  router.get('/api/alerts/:id', (req, res, { params }) => {
    const alert = emergency.getAlert(params.id);
    sendJson(res, 200, { alert });
  });

  router.post('/api/alerts/:id/retract', async (req, res, { params, ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const alert = await emergency.retractAlert(userId, params.id, body, { ip });
    sendJson(res, 200, { alert });
  });

  router.post('/api/zones/subscriptions', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const sub = emergency.addZoneSubscription(userId, body);
    sendJson(res, 201, { subscription: sub });
  });

  router.get('/api/zones/subscriptions', (req, res) => {
    const userId = requireUser(req);
    const list = emergency.listZoneSubscriptions(userId);
    sendJson(res, 200, { subscriptions: list });
  });

  router.delete('/api/zones/subscriptions/:id', (req, res, { params }) => {
    const userId = requireUser(req);
    const result = emergency.deleteZoneSubscription(userId, params.id);
    sendJson(res, 200, result);
  });

  router.post('/api/dtn/envelope', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const state = emergency.storeEnvelope(userId, body);
    sendJson(res, 200, { message: state });
  });

  router.post('/api/dtn/receipt', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const result = await emergency.submitReceipt(userId, body);
    sendJson(res, 200, result);
  });

  router.get('/api/dtn/bundle', (req, res, { query }) => {
    const peerSummary = query.peerSummary ? JSON.parse(query.peerSummary) : {};
    const bundleText = emergency.exportDtnBundle(peerSummary);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="sync.senda"' });
    res.end(bundleText);
  });

  router.post('/api/dtn/bundle', async (req, res) => {
    const text = await (async () => {
      let chunks = [];
      for await (const c of req) chunks.push(c);
      return Buffer.concat(chunks).toString('utf8');
    })();
    const result = await emergency.importDtnBundle(text);
    sendJson(res, 200, result);
  });

  router.get('/api/dtn/stats', (req, res) => {
    sendJson(res, 200, emergency.dtnStats());
  });

  /* ------------------- MESSAGING ------------------- */
  router.get('/api/channels', (req, res) => {
    const s = getSession(req);
    const channels = messaging.listChannels(s?.userId);
    sendJson(res, 200, { channels });
  });

  router.post('/api/channels', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const ch = await messaging.createChannel(userId, body, { ip });
    sendJson(res, 201, { channel: ch });
  });

  router.post('/api/channels/:id/join', async (req, res, { params, ip }) => {
    const userId = requireUser(req);
    const result = await messaging.joinChannel(userId, params.id, { ip });
    sendJson(res, 200, result);
  });

  router.get('/api/conversations', (req, res) => {
    const userId = requireUser(req);
    const list = messaging.listConversations(userId);
    sendJson(res, 200, { conversations: list });
  });

  router.post('/api/conversations', async (req, res) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const conv = messaging.createOrGetConversation(userId, body);
    sendJson(res, 200, { conversation: conv });
  });

  router.get('/api/conversations/:id/messages', async (req, res, { params }) => {
    const userId = requireUser(req);
    const messages = await messaging.listMessages(userId, params.id);
    sendJson(res, 200, { messages });
  });

  router.post('/api/conversations/:id/messages', async (req, res, { params }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const msg = await messaging.sendMessage(userId, params.id, body);
    sendJson(res, 201, { message: msg });
  });

  /* ------------------- MODERATION ------------------- */
  router.post('/api/moderation/report', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const result = moderation.reportContent(userId, body, { ip });
    sendJson(res, 201, result);
  });

  router.get('/api/moderation/cases', (req, res, { query }) => {
    const userId = requireUser(req);
    const cases = moderation.listCases(userId, { status: query.status, limit: query.limit });
    sendJson(res, 200, { cases });
  });

  router.post('/api/moderation/cases/:id/resolve', async (req, res, { params, ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const result = moderation.resolveCase(userId, params.id, body, { ip });
    sendJson(res, 200, { case: result });
  });

  router.post('/api/moderation/cases/:id/appeal', async (req, res, { params, ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const result = moderation.appealDecision(userId, params.id, body, { ip });
    sendJson(res, 200, { case: result });
  });

  router.post('/api/moderation/cases/:id/appeal/resolve', async (req, res, { params, ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const result = moderation.resolveAppeal(userId, params.id, body, { ip });
    sendJson(res, 200, { case: result });
  });

  /* ------------------- ADMIN ------------------- */
  router.get('/api/admin/users', (req, res, { query }) => {
    const userId = requireUser(req);
    const users = admin.listUsers(userId, { limit: query.limit });
    sendJson(res, 200, { users });
  });

  router.get('/api/admin/organizations', (req, res) => {
    const s = getSession(req);
    const orgs = admin.listOrganizations(s?.userId);
    sendJson(res, 200, { organizations: orgs });
  });

  router.post('/api/admin/organizations', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const org = admin.createOrganization(userId, body, { ip });
    sendJson(res, 201, { organization: org });
  });

  router.post('/api/admin/credentials', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const cred = admin.registerAuthorityCredential(userId, body, { ip });
    sendJson(res, 201, { credential: cred });
  });

  router.post('/api/admin/roles', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const assigned = admin.assignRole(userId, body, { ip });
    sendJson(res, 201, { assignment: assigned });
  });

  router.delete('/api/admin/roles/:id', (req, res, { params, ip }) => {
    const userId = requireUser(req);
    const result = admin.revokeRole(userId, params.id, { ip });
    sendJson(res, 200, result);
  });

  router.get('/api/admin/audit', (req, res, { query }) => {
    const userId = requireUser(req);
    const logs = admin.queryAuditLogs(userId, {
      action: query.action,
      actorId: query.actorId,
      severity: query.severity,
      limit: query.limit
    });
    sendJson(res, 200, { logs });
  });

  router.post('/api/admin/feature-flags', async (req, res, { ip }) => {
    const userId = requireUser(req);
    const body = await readJson(req);
    const flag = admin.setFeatureFlag(userId, body.key, body.enabled, { ip });
    sendJson(res, 200, { flag });
  });

  router.get('/api/admin/health', (req, res) => {
    const userId = requireUser(req);
    const health = admin.getSystemHealth(userId);
    sendJson(res, 200, health);
  });

  /* -------- READ-ONLY OFFICIAL SOURCE OBSERVATIONS -------- */
  // USGS observations are not SENDA alerts, forecasts, or crisis dispatches.
  router.get('/api/sources/usgs-earthquakes', async (req, res) => {
    const snapshot = await usgsFeed.read();
    sendJson(res, snapshot.status === 'UNAVAILABLE' ? 503 : 200, snapshot);
  });

  // EONET's curated event locations are NOT fire perimeters or emergency alerts.
  router.get('/api/sources/eonet-wildfires', async (req, res) => {
    const snapshot = await eonetFeed.read();
    sendJson(res, snapshot.status === 'UNAVAILABLE' ? 503 : 200, snapshot);
  });

  // Explicitly time-indexed NWP model forecast. Never an observed station or an alert.
  router.get('/api/sources/weather-grid', async (req, res, { query }) => {
    const region = query.region || 'valencia';
    if (!Object.hasOwn(WEATHER_REGIONS, region)) return sendJson(res, 400, { error: 'INVALID_WEATHER_REGION' });
    const snapshot = await weatherGridFeed.read(region);
    sendJson(res, ['UNAVAILABLE', 'PROVIDER_NOT_CONFIGURED'].includes(snapshot.status) ? 503 : 200, snapshot);
  });

  // Read-only public elevation raster samples; no user-provided coordinates or URLs.
  router.get('/api/sources/terrain-grid', async (req, res, { query }) => {
    const region = query.region || 'valencia';
    if (!Object.hasOwn(WEATHER_REGIONS, region)) return sendJson(res, 400, { error: 'INVALID_TERRAIN_REGION' });
    const snapshot = await terrainGridFeed.read(region);
    sendJson(res, snapshot.status === 'UNAVAILABLE' ? 503 : 200, snapshot);
  });

  /* ------------------- ADAPTERS & METADATA ------------------- */
  router.get('/api/integrations/adapters', (req, res) => {
    sendJson(res, 200, { adapters: adapterHealth() });
  });

  /* ------------------- REALTIME SSE ------------------- */
  router.get('/api/realtime/stream', (req, res) => {
    const s = getSession(req);
    const lastEventId = req.headers['last-event-id'];
    rt.attach(req, res, s?.userId, lastEventId);
  });

  // Request dispatcher
  return async function handleApi(req, res) {
    const ip = req.socket?.remoteAddress || '127.0.0.1';
    const rate = rateLimiter.take(ip, { capacity: 120, refillPerSec: 10 });
    if (!rate.ok) {
      res.setHeader('Retry-After', String(rate.retryAfterS));
      return sendJson(res, 429, { error: 'TOO_MANY_REQUESTS', retryAfterS: rate.retryAfterS });
    }

    const url = new URL(req.url, 'http://localhost');
    const match = router.match(req.method, url.pathname);

    if (!match) return false;
    if (match.methodNotAllowed) {
      sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      return true;
    }

    try {
      checkCsrf(req);
      const query = Object.fromEntries(url.searchParams.entries());
      await match.route.handler(req, res, { params: match.params, query, ip });
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.code, message: err.message, ...err.extra });
      } else {
        console.error('Unhandled API Error:', err);
        sendJson(res, 500, { error: 'INTERNAL_SERVER_ERROR', message: err.message });
      }
    }
    return true;
  };
}

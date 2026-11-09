/**
 * Servidor Principal SENDA LIVE (Node 22 HTTP sin frameworks externos).
 *
 * Expone la API REST/SSE y sirve la SPA estática (PWA) de apps/senda-live/web/dist.
 */
import http from 'node:http';
import { readFileSync, statSync, createReadStream, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDatabase, migrate } from './db.mjs';
import { securityHeaders } from './http.mjs';
import { createAuditor } from './audit.mjs';
import { createRealtimeHub } from './realtime.mjs';
import { createNotifier } from './services/notify.mjs';
import { createAuthService } from './services/auth.mjs';
import { createEmergencyService } from './services/emergency.mjs';
import { createEventService } from './services/events.mjs';
import { createSocialService } from './services/social.mjs';
import { createMessagingService } from './services/messaging.mjs';
import { createModerationService } from './services/moderation.mjs';
import { createAdminService } from './services/admin.mjs';
import { createApiHandler } from './api.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DATABASE_FILE || join(__dirname, '../data/senda-live.db');
const WEB_DIST = join(__dirname, '../web/dist');

export function createServer({ dbFile = DB_PATH, ipSalt = 'senda-ip-salt-default', usgsFeed, eonetFeed, weatherGridFeed, terrainGridFeed, gdacsFeed, effisFeed, aemetFeed } = {}) {
  const db = openDatabase(dbFile);
  migrate(db);

  const audit = createAuditor(db, { ipSalt });
  const rt = createRealtimeHub(db);
  const notifier = createNotifier(db, rt);
  const auth = createAuthService(db, audit);
  const emergency = createEmergencyService(db, { rt, notifier, events: null, audit });
  const events = createEventService(db, { rt, notifier, audit });
  // Interlinking circular reference resolution
  emergency.events = events;

  const social = createSocialService(db, { rt, notifier, events, audit });
  const messaging = createMessagingService(db, { rt, notifier, emergency, audit });
  const moderation = createModerationService(db, { rt, notifier, audit });
  const admin = createAdminService(db, { rt, emergency, audit });

  const handleApi = createApiHandler({
    db, auth, social, events, emergency, messaging, moderation, admin, rt, usgsFeed, eonetFeed, weatherGridFeed, terrainGridFeed, gdacsFeed, effisFeed, aemetFeed
  });

  const server = http.createServer(async (req, res) => {
    securityHeaders(res);

    // Si la ruta es /api/*
    if (req.url.startsWith('/api/')) {
      const handled = await handleApi(req, res);
      if (handled) return;
    }

    // Servir estáticos SPA
    serveStatic(req, res);
  });

  function serveStatic(req, res) {
    if (!existsSync(WEB_DIST)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>SENDA LIVE API</title><meta charset="utf-8"/></head>
        <body style="font-family:sans-serif;padding:2rem;">
          <h1>SENDA LIVE · Núcleo Activo</h1>
          <p>Servicio backend y API en funcionamiento. Ejecuta <code>pnpm --filter @senda/live build</code> para generar la interfaz PWA.</p>
          <p>Endpoints disponibles en <code>/api/*</code>.</p>
        </body>
        </html>
      `);
    }

    let pathname = new URL(req.url, 'http://localhost').pathname;
    let filePath = join(WEB_DIST, pathname);

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      sendFile(res, filePath);
    } else {
      // Fallback a index.html para rutas client-side SPA
      const indexFile = join(WEB_DIST, 'index.html');
      if (existsSync(indexFile)) {
        sendFile(res, indexFile);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    }
  }

  function sendFile(res, filePath) {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.webmanifest': 'application/manifest+json'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
    });
    createReadStream(filePath).pipe(res);
  }

  return { server, db, rt, services: { auth, social, events, emergency, messaging, moderation, admin } };
}

// Ejecución directa de CLI
if (process.argv[1] === __filename) {
  const { server } = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`[SENDA LIVE] Servidor escuchando en http://${HOST}:${PORT}`);
  });
}

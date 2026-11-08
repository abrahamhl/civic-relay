import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../server/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_HTTP_DB = join(__dirname, '../data/test-http.db');

test('INTEGRACIÓN HTTP / SPA / SSE / SEGURIDAD', async (t) => {
  if (existsSync(TEST_HTTP_DB)) rmSync(TEST_HTTP_DB, { force: true });

  const { server, db } = createServer({ dbFile: TEST_HTTP_DB });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    if (existsSync(TEST_HTTP_DB)) rmSync(TEST_HTTP_DB, { force: true });
  });

  await t.test('1. Cabeceras de seguridad en respuesta (CSP, X-Frame-Options, X-Content-Type-Options)', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-security-policy'));
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  await t.test('2. Servir estáticos SPA e index.html para rutas no-API', async () => {
    const res = await fetch(`${baseUrl}/ruta-aleatoria-spa`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('SENDA LIVE'));
  });

  await t.test('3. Registro vía API con protección CSRF', async () => {
    // Sin cabecera CSRF en mutación -> 403
    const badRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@senda.live', password: 'password123', handle: 'tester', displayName: 'Test User' })
    });
    assert.equal(badRes.status, 403);

    // Con cabecera CSRF -> 201
    const okRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Senda-Request': '1' },
      body: JSON.stringify({ email: 'test@senda.live', password: 'password123', handle: 'tester', displayName: 'Test User' })
    });
    assert.equal(okRes.status, 201);
    const data = await okRes.json();
    assert.ok(data.token);
    assert.equal(data.user.email, 'test@senda.live');
  });

  await t.test('4. Consulta de Feed y Adaptadores', async () => {
    const feedRes = await fetch(`${baseUrl}/api/feed`);
    assert.equal(feedRes.status, 200);
    const feed = await feedRes.json();
    assert.ok(Array.isArray(feed.items));

    const adaptersRes = await fetch(`${baseUrl}/api/integrations/adapters`);
    assert.equal(adaptersRes.status, 200);
    const adapters = await adaptersRes.json();
    assert.ok(adapters.adapters.length >= 6);
  });
});

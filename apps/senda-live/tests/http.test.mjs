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

  // Synthetic fixture only verifies HTTP wiring; it is NOT a live USGS acquisition.
  const usgsFeed = { read: async () => ({
    dataset: 'USGS_M45_WEEK_GEOJSON', status: 'SOURCE_SNAPSHOT',
    dataKind: 'HISTORICAL_OBSERVATION', isOfficialAlert: false,
    observations: [{ id: 'usgs:test', magnitude: 5.2, location: { lat: 40, lon: 1 } }],
    source: { provider: 'USGS Earthquake Hazards Program' }
  }) };
  const eonetFeed = { read: async () => ({
    dataset: 'NASA_EONET_V3_WILDFIRES', status: 'SOURCE_SNAPSHOT',
    dataKind: 'CURATED_EVENT_METADATA', isPerimeter: false, isOfficialAlert: false,
    observations: [{ id: 'eonet:test', title: 'Synthetic wildfire', location: { lat: 42, lon: -5 } }],
    source: { provider: 'NASA EONET' }
  }) };
  const weatherGridFeed = { read: async (region) => ({
    schema: 'senda.atmosphere.grid/1', status: 'SOURCE_SNAPSHOT', region,
    dataKind: 'MODEL_FORECAST', isOfficialAlert: false, calibratedBySenda: false,
    times: [], points: [], source: { provider: 'Open-Meteo' }
  }) };
  const { server, db } = createServer({ dbFile: TEST_HTTP_DB, usgsFeed, eonetFeed, weatherGridFeed });

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

  await t.test('5. Endpoint público de observaciones: se mantienen separadas de las alertas', async () => {
    const res = await fetch(baseUrl + '/api/sources/usgs-earthquakes');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dataset, 'USGS_M45_WEEK_GEOJSON');
    assert.equal(body.dataKind, 'HISTORICAL_OBSERVATION');
    assert.equal(body.isOfficialAlert, false);
    assert.equal(body.observations[0].magnitude, 5.2);
  });

  await t.test('6. NASA EONET event metadata stays separate from wildfire predictions and alerts', async () => {
    const res = await fetch(baseUrl + '/api/sources/eonet-wildfires');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dataset, 'NASA_EONET_V3_WILDFIRES');
    assert.equal(body.dataKind, 'CURATED_EVENT_METADATA');
    assert.equal(body.isPerimeter, false);
    assert.equal(body.isOfficialAlert, false);
  });

  await t.test('7. Contrato meteorológico: predicción no equivale a estación ni alerta', async () => {
    const res = await fetch(baseUrl + '/api/sources/weather-grid?region=valencia');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.dataKind, 'MODEL_FORECAST');
    assert.equal(data.calibratedBySenda, false);
    assert.equal(data.isOfficialAlert, false);
    const denied = await fetch(baseUrl + '/api/sources/weather-grid?region=private-gps-location');
    assert.equal(denied.status, 400);
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

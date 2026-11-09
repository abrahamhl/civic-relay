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
  const terrainGridFeed = { read: async (region) => ({
    schema: 'senda.terrain.grid/1', region, status: 'SOURCE_SNAPSHOT',
    dataKind: 'RASTER_DEM_SAMPLES', rows: 33, columns: 33,
    elevationsM: Array(1089).fill(120), source: { provider: 'Mapzen Terrain Tiles' }
  }) };
    const effisFeed = { read: async () => ({
    schema: 'senda.osint.copernicus-effis/1', dataset: 'COPERNICUS_EMS_EFFIS_ACTIVE_FIRES',
    status: 'ACTIVE_SNAPSHOT', observations: [{ id: 'effis:test', location: { lat: 39.5, lon: -0.4 }, fireRadiativePowerMW: 45 }],
    source: { provider: 'Copernicus EFFIS', rawSha256: 'effis_hash' }
  }) };
  const aemetFeed = { read: async () => ({
    schema: 'senda.osint.official-warnings-cap/1', dataset: 'AEMET_METEOALARM_OFFICIAL_WARNINGS',
    status: 'ACTIVE_SNAPSHOT', warnings: [{ id: 'warn:test', severity: 'SEVERE', capIdentifier: 'test' }],
    source: { provider: 'AEMET', rawSha256: 'aemet_hash' }
  }) };
  const gdacsFeed = { read: async () => ({
    schema: 'senda.osint.gdacs/1', dataset: 'GDACS_PUBLIC_DISASTER_EVENTS',
    status: 'ACTIVE_SNAPSHOT', observations: [{ id: 'gdacs:test', eventType: 'EQ', location: { lat: 40, lon: 1 }, severity: 5.2 }],
    source: { provider: 'GDACS', rawSha256: 'gdacs_hash' }
  }) };
  const { server, db } = createServer({ dbFile: TEST_HTTP_DB, usgsFeed, eonetFeed, weatherGridFeed, terrainGridFeed, gdacsFeed, effisFeed, aemetFeed });

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

  await t.test('8. DEM: topografía real separada de alertas y sensores, región fija', async () => {
    const response = await fetch(baseUrl + '/api/sources/terrain-grid?region=valencia');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.dataKind, 'RASTER_DEM_SAMPLES');
    assert.equal(data.elevationsM.length, 1089);
    const unsafe = await fetch(baseUrl + '/api/sources/terrain-grid?region=private-home-location');
    assert.equal(unsafe.status, 400);
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

  await t.test('5. P0-003: DELETE /api/posts/:id - autorización del propietario, denegación a terceros y persistencia', async () => {
    // 1. Crear Usuario A (propietario)
    const userARes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Senda-Request': '1' },
      body: JSON.stringify({ email: 'owner@senda.live', password: 'password123', handle: 'postowner', displayName: 'Post Owner' })
    });
    assert.equal(userARes.status, 201);
    const userA = await userARes.json();

    // 2. Crear Usuario B (tercero no autorizado)
    const userBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Senda-Request': '1' },
      body: JSON.stringify({ email: 'stranger@senda.live', password: 'password123', handle: 'stranger', displayName: 'Stranger' })
    });
    assert.equal(userBRes.status, 201);
    const userB = await userBRes.json();

    // 3. Crear una publicación de prueba por Usuario A
    const postRes = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
        'Authorization': `Bearer ${userA.token}`
      },
      body: JSON.stringify({
        title: 'Incidente temporal A-3',
        body: 'Retención de tráfico por humo en pk 42',
        category: 'traffic',
        visibility: 'PUBLIC'
      })
    });
    assert.equal(postRes.status, 201);
    const { post } = await postRes.json();
    assert.ok(post.id);

    // 4. Intento de borrado sin autenticación -> 401
    const unauthDel = await fetch(`${baseUrl}/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: { 'X-Senda-Request': '1' }
    });
    assert.equal(unauthDel.status, 401);

    // 5. Intento de borrado por tercero no propietario -> 403
    const strangerDel = await fetch(`${baseUrl}/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: {
        'X-Senda-Request': '1',
        'Authorization': `Bearer ${userB.token}`
      }
    });
    assert.equal(strangerDel.status, 403);

    // 6. Borrado legítimo por el propietario -> 200 { deleted: true }
    const ownerDel = await fetch(`${baseUrl}/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: {
        'X-Senda-Request': '1',
        'Authorization': `Bearer ${userA.token}`
      }
    });
    assert.equal(ownerDel.status, 200);
    const delResult = await ownerDel.json();
    assert.equal(delResult.deleted, true);

    // 7. Comprobar que ya no aparece en getPost -> 404
    const getDeleted = await fetch(`${baseUrl}/api/posts/${post.id}`);
    assert.equal(getDeleted.status, 404);

    // 8. Comprobar que no aparece en el feed
    const feedAfter = await (await fetch(`${baseUrl}/api/feed`)).json();
    assert.ok(!feedAfter.items.some((item) => item.id === post.id));

    // 9. Comprobar retención/persistencia conforme a política: registro en DB existe con deleted_at != NULL
    const row = db.get('SELECT deleted_at, body, title FROM posts WHERE id = ?', post.id);
    assert.ok(row.deleted_at > 0);
    assert.equal(row.title, '[eliminado]');
  });

  await t.test('6. P0-007: Distinción de seguridad en mensajes - chat servidor vs sobre cifrado SENDA', async () => {
    // Registro de usuario para mensajería
    const userRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Senda-Request': '1' },
      body: JSON.stringify({ email: 'chatuser@senda.live', password: 'password123', handle: 'chatuser', displayName: 'Chat User' })
    });
    const user = await userRes.json();

    // Crear un canal público para la prueba
    const createChanRes = await fetch(`${baseUrl}/api/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({ kind: 'PUBLIC', name: 'Corredor A-3', topic: 'Avisos en el corredor' })
    });
    assert.equal(createChanRes.status, 201);
    const { channel } = await createChanRes.json();
    assert.ok(channel.conversationId);

    // Enviar mensaje ordinario en canal público -> Almacenado en servidor sin E2EE
    const sendMsgRes = await fetch(`${baseUrl}/api/conversations/${channel.conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({ body: 'Hola comunidad, aviso de lluvia en el corredor' })
    });
    assert.equal(sendMsgRes.status, 201);
    const msgData = await sendMsgRes.json();
    assert.equal(msgData.message.securityLevel, 'SERVER_STORED_PLAINTEXT');
    assert.ok(msgData.message.securityNotice.includes('sin E2EE'));
    assert.equal(msgData.message.state, 'IN_CUSTODY'); // 1 check en servidor

    // Listar mensajes y verificar hidratación
    const listRes = await fetch(`${baseUrl}/api/conversations/${channel.conversationId}/messages`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.messages[0].securityLevel, 'SERVER_STORED_PLAINTEXT');
  });

  await t.test('7. P0-OSINT: Endpoints oficiales Copernicus EFFIS, AEMET CAP y Reconciled Multi-Hazard Intelligence', async () => {
    // 1. GET /api/sources/copernicus-effis
    const effisRes = await fetch(`${baseUrl}/api/sources/copernicus-effis`);
    assert.equal(effisRes.status, 200);
    const effisData = await effisRes.json();
    assert.equal(effisData.schema, 'senda.osint.copernicus-effis/1');
    assert.ok(Array.isArray(effisData.observations));

    // 2. GET /api/sources/aemet-warnings
    const aemetRes = await fetch(`${baseUrl}/api/sources/aemet-warnings`);
    assert.equal(aemetRes.status, 200);
    const aemetData = await aemetRes.json();
    assert.equal(aemetData.schema, 'senda.osint.official-warnings-cap/1');
    assert.ok(Array.isArray(aemetData.warnings));

    // 3. GET /api/sources/reconciled-intelligence
    const reconRes = await fetch(`${baseUrl}/api/sources/reconciled-intelligence`);
    assert.equal(reconRes.status, 200);
    const reconData = await reconRes.json();
    assert.equal(reconData.schema, 'senda.osint.reconciled-intelligence/1');
    assert.ok(reconData.receipt);
    assert.equal(reconData.receipt.rootSha256.length, 64);
  });
});

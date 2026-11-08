/**
 * SENDA LIVE map QA in real Chromium, no external source/tile dependencies.
 * Synthetic fixtures exercise DOM safety and scientific status separation.
 * NOT proof that the real NASA/USGS services are currently available.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.SENDA_PLAYWRIGHT_MODULE ?? 'playwright');
const baseUrl = process.env.SENDA_MAP_QA_URL ?? 'http://127.0.0.1:3000';
const output = resolve('evidence/senda/geospatial-qa');
mkdirSync(output, { recursive: true });

const event = {
  id: 'fixture-injection', type: 'fire', status: 'UNVERIFIED_REPORT',
  title: '<img src=x onerror="window.__injected=1">',
  location: { lat: 39.4699, lon: -0.3763, label: '<svg onload="window.__injected=2">' },
};
const usgs = {
  status: 'SOURCE_SNAPSHOT', dataset: 'USGS_M45_WEEK_GEOJSON',
  dataKind: 'HISTORICAL_OBSERVATION', isOfficialAlert: false,
  fetchedAt: '2026-11-09T12:00:00.000Z',
  source: { provider: 'USGS', generatedAt: '2026-11-09T12:00:00.000Z' },
  observations: [{
    id: 'usgs:fixture', magnitude: 5.3, location: { lat: 39.4, lon: -0.37 },
    observedAt: '2026-11-09T11:20:00.000Z', place: 'Fixture Valencia', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/fixture',
  }],
};
const eonet = {
  status: 'SOURCE_SNAPSHOT', dataset: 'NASA_EONET_V3_WILDFIRES',
  dataKind: 'CURATED_EVENT_METADATA', isOfficialAlert: false, isPerimeter: false,
  resultLimitReached: false, requestedLimit: 150,
  fetchedAt: '2026-11-09T12:00:00.000Z', source: { provider: 'NASA EONET' },
  observations: [{
    id: 'eonet:fixture', title: '<img src=x onerror="window.__injected=3">',
    location: { lat: 39.49, lon: -0.36 },
    observedAt: '2026-11-09T10:00:00.000Z',
    reportedSources: ['NASA'], url: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1',
  }],
};

const forecastTimes = Array.from({ length: 24 }, (_, i) =>
  new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 + i * 3_600_000).toISOString());
const weather = {
  schema: 'senda.atmosphere.grid/1', region: 'valencia', regionName: 'Valencia',
  requestedCenter: { lat: 39.4699, lon: -0.3763 },
  status: 'SOURCE_SNAPSHOT', fetchedAt: new Date().toISOString(),
  dataKind: 'MODEL_FORECAST', isOfficialAlert: false, calibratedBySenda: false,
  times: forecastTimes,
  source: {
    provider: 'Synthetic test fixture (NOT Open-Meteo acquisition)', model: 'test_fixture',
    documentationUrl: 'https://open-meteo.com/en/docs', rawSha256: 'f'.repeat(64),
    access: 'TEST_FIXTURE', modelRunAt: null, units: { temperature_2m: '°C' }
  },
  points: Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    return {
      index: i, lat: 39.4699 + (row - 1) * .12, lon: -.3763 + (col - 1) * .18,
      values: {
        temperature_2m: Array.from({ length: 24 }, (_, t) => 15 + row + col + t * .2),
        relative_humidity_2m: Array.from({ length: 24 }, (_, t) => 55 + row + col - t * .1),
        precipitation: Array.from({ length: 24 }, (_, t) => t % 3 === 0 ? 2 : 0),
        wind_speed_10m: Array.from({ length: 24 }, (_, t) => 12 + row + t * .2),
        wind_direction_10m: Array.from({ length: 24 }, () => 250)
      }
    };
  })
};

async function exercise(browser, name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.addInitScript(() => { window.__injected = 0; });
  const clientErrors = [];
  page.on('pageerror', (error) => clientErrors.push(error.message));
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let obj = {};
    if (path === '/api/events') obj = { events: [event] };
    else if (path === '/api/feed') obj = { items: [], nextCursor: null };
    else if (path === '/api/stories') obj = { stories: [] };
    else if (path === '/api/alerts') obj = { alerts: [] };
    else if (path === '/api/auth/me') obj = { user: null };
    else if (path === '/api/sources/usgs-earthquakes') obj = usgs;
    else if (path === '/api/sources/eonet-wildfires') obj = eonet;
    else if (path === '/api/sources/weather-grid') obj = weather;
    if (path === '/api/realtime/stream') return route.abort();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  if (name === 'mobile') await page.locator('.bottom-nav button').filter({ hasText: 'Mapa' }).click();
  else await page.getByRole('button', { name: /Mapa de Sucesos/ }).click();
  await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 12_000 });
  await page.locator('.senda-map-marker').first().click();
  await page.locator('.leaflet-popup-content').waitFor({ state: 'visible' });
  const markup = await page.locator('.leaflet-popup-content').innerText();
  assert.match(markup, /<img src=x/);
  assert.equal(await page.locator('.leaflet-popup-content img').count(), 0, 'Untrusted HTML was executed');
  assert.equal(await page.evaluate(() => window.__injected), 0);

  await page.getByLabel('Incendios NASA EONET (catálogo)').check();
  await page.getByText(/1 acontecimientos catalogados/).waitFor({ timeout: 12_000 });
  assert.equal(await page.getByText(/No son perímetros/).count(), 1);

  await page.getByLabel('Sismos USGS (M≥4,5)').check();
  await page.getByText(/1 observaciones M≥4,5/).waitFor({ timeout: 12_000 });
  const markers = await page.locator('.leaflet-interactive').count();
  assert.ok(markers >= 2, 'Scientific points not rendered in Leaflet');
  assert.equal(await page.evaluate(() => window.__injected), 0);

  assert.deepEqual(clientErrors, [], 'Unhandled browser exceptions');

  // Three coordinates + independent time dimension: actual browser canvas and interactive timeline.
  await page.getByRole('button', { name: 'Abrir Atmosphere 4D' }).click();
  await page.locator('[data-testid="atmosphere4d-workbench"]').waitFor();
  await page.locator('canvas.senda-4d-canvas').waitFor({ state: 'visible', timeout: 12_000 });
  assert.equal(await page.getByRole('slider', { name: 'Línea temporal de pronóstico' }).count(), 1);
  const canvasSize = await page.locator('canvas.senda-4d-canvas').evaluate(
    (el) => ({ w: el.width, h: el.height })
  );
  assert.ok(canvasSize.w > 200 && canvasSize.h > 200, '4D canvas has a valid drawing buffer');
  await page.getByRole('slider', { name: 'Línea temporal de pronóstico' }).fill('9');
  assert.match(await page.getByText(/Centro del grid/).innerText(), /Centro del grid/);
  await page.getByLabel('Variable meteorológica').selectOption('wind_speed_10m');
  await page.locator('canvas.senda-4d-canvas').focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Reproducir tiempo' }).click();
  await page.getByRole('button', { name: 'Pausar tiempo' }).click();

  // Feed interruption only. The visualizer must continue with the last IndexedDB public snapshot.
  await page.waitForFunction(async () => {
    return await new Promise((resolve) => {
      const req = indexedDB.open('senda_atmosphere4d_public_cache');
      req.onerror = () => resolve(false);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('weather_snapshots', 'readonly');
        const get = tx.objectStore('weather_snapshots').get('valencia');
        get.onsuccess = () => { resolve(!!get.result?.snapshot); db.close(); };
        get.onerror = () => { resolve(false); db.close(); };
      };
    });
  }, null, { timeout: 8_000 });
  await page.getByRole('button', { name: 'Volver al mapa 2D' }).click();
  await page.route('**/api/sources/weather-grid*', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Abrir Atmosphere 4D' }).click();
  await page.getByText(/SNAPSHOT LOCAL/).waitFor({ timeout: 10_000 });
  assert.equal(await page.locator('canvas.senda-4d-canvas').count(), 1, 'Offline cache surface missing');
  assert.equal(await page.evaluate(() => window.__injected), 0);
  assert.deepEqual(clientErrors, [], 'Unhandled browser exceptions');

  // Offline hard-restart: first prime the production service-worker assets under its control,
  // then disconnect the browser and reload. The model is already in IndexedDB.
  await page.getByRole('button', { name: 'Volver al mapa 2D' }).click();
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller;
  }, null, { timeout: 15_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (name === 'mobile') await page.locator('.bottom-nav button').filter({ hasText: 'Mapa' }).click();
  else await page.getByRole('button', { name: /Mapa de Sucesos/ }).click();
  await page.getByRole('button', { name: 'Abrir Atmosphere 4D' }).click();
  await page.getByText(/SNAPSHOT LOCAL/).waitFor({ timeout: 10_000 });
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  if (name === 'mobile') await page.locator('.bottom-nav button').filter({ hasText: 'Mapa' }).click();
  else await page.getByRole('button', { name: /Mapa de Sucesos/ }).click();
  await page.getByRole('button', { name: 'Abrir Atmosphere 4D' }).click();
  await page.locator('canvas.senda-4d-canvas').waitFor({ state: 'visible', timeout: 12_000 });
  await page.getByText(/SNAPSHOT LOCAL/).waitFor({ timeout: 12_000 });
  assert.ok(await page.locator('canvas.senda-4d-canvas').evaluate((el) => el.width > 200));
  assert.deepEqual(clientErrors, [], 'Unhandled browser exceptions after offline restart');

  await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
  await page.close();
  return { viewport, status: 'PASS', visibleGeospatialMarkers: markers,
    sourceKinds: ['HISTORICAL_OBSERVATION', 'CURATED_EVENT_METADATA'],
    injectedMarkupExecuted: false, atmosphere4DRendered: true,
    hourlyTimeNavigation: true, localSnapshotRecoveredAfterFeedLoss: true, offlinePwaRestart: true, fixtureOnly: true };
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  results.push(await exercise(browser, 'desktop', { width: 1440, height: 900 }));
  results.push(await exercise(browser, 'mobile', { width: 390, height: 844 }));
} finally { await browser.close(); }
const report = {
  schema: 'senda.browser-geospatial-qa/1',
  testedAt: new Date().toISOString(),
  codeType: 'CHROMIUM_REAL_BROWSER_WITH_SYNTHETIC_SOURCE_FIXTURES',
  notProven: ['NASA/USGS upstream live in browser', 'real Open-Meteo forecast in browser', 'physical radio', 'wildfire forecast calibration', 'offline OSM tiles'],
  results,
};
writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

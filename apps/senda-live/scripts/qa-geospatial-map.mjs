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

  await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
  await page.close();
  return { viewport, status: 'PASS', visibleGeospatialMarkers: markers,
    sourceKinds: ['HISTORICAL_OBSERVATION', 'CURATED_EVENT_METADATA'],
    injectedMarkupExecuted: false, fixtureOnly: true };
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
  notProven: ['NASA/USGS upstream live in browser', 'physical radio', 'wildfire forecast calibration', 'offline OSM tiles'],
  results,
};
writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

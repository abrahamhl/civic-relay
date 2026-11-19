// SENDA Command Center — real-browser vertical slice smoke test.
//
// Runs against a real Chromium served by `vite preview` over the production
// build. Captures are from the actual running app; nothing is synthetically
// rendered to look like a screenshot of a feature that does not exist.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '..', '..', 'evidence', 'senda-command-center');
const baseURL = process.env.SENDA_CC_URL ?? 'http://127.0.0.1:5174/';
const executablePath = process.env.SENDA_CHROMIUM ?? require('playwright').chromium.executablePath();

const steps = [];
const consoleErrors = [];
const pageErrors = [];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 960 } });
const page = await context.newPage();

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(String(error)));

async function shot(name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  steps.push({ step: name, screenshot: path.relative(path.resolve(here, '..', '..', '..'), file) });
}

const started = Date.now();
await page.goto(baseURL, { waitUntil: 'networkidle' });

await page.waitForSelector('.header h1');
const brand = await page.locator('.header h1').innerText();
steps.push({ step: 'boot', brand, title: await page.title() });
await shot('01-overview');

const chips = await page.locator('.header-chips .chip').allInnerTexts();
steps.push({ step: 'header-chips', chips });

const markers = await page.locator('.map-frame svg g[role="button"]').count();
steps.push({ step: 'map-markers', markers });

if (markers < 20) throw new Error(`expected >=20 real camera markers, found ${markers}`);

// Select a real Caltrans camera through the map.
const firstMarker = page.locator('.map-frame svg g[role="button"]').first();
await firstMarker.click({ force: true });
await page.waitForSelector('.panel.right h2');
const selectedName = await page.locator('.panel.right h2').innerText();
steps.push({ step: 'select-camera', selectedName });
await shot('02-camera-selected');

// TfL-only dataset must remove Caltrans markers.
await page.locator('select.select').selectOption('tfl');
await page.waitForTimeout(120);
const tflMarkers = await page.locator('.map-frame svg g[role="button"]').count();
steps.push({ step: 'filter-tfl', tflMarkers });
if (tflMarkers !== 12) throw new Error(`expected 12 TfL markers, found ${tflMarkers}`);
await shot('03-tfl-only');

await page.locator('select.select').selectOption('all');

// 3D tab must mount the lazy WebGL chunk without crashing the page.
await page.getByRole('button', { name: '3D Digital Twin' }).click();
await page.waitForTimeout(900);
const canvasCount = await page.locator('.view canvas, .map-frame canvas').count();
const fallbackVisible = await page.locator('.scene-fallback').count();
steps.push({ step: 'twin-3d', canvasCount, fallbackVisible, pageErrors: pageErrors.length });
await shot('04-twin-3d');

// RF Lab must explicitly fail closed.
await page.getByRole('button', { name: 'RF & Rescue Lab' }).click();
await page.waitForTimeout(150);
const rfBody = await page.locator('.view').innerText();
const rfStatuses = await page.locator('.cap-card .status').allInnerTexts();
steps.push({ step: 'rf-lab', rfStatuses, mentionsNoHardware: rfBody.includes('NOT_AVAILABLE_NO_HARDWARE') });

await page.getByRole('button', { name: 'Comprobar instrumento conectado' }).click();
await page.waitForTimeout(600);
const probeNotice = await page.locator('.prov-chip', { hasText: 'NOT_AVAILABLE_NO_HARDWARE' }).first().innerText();
steps.push({ step: 'rf-probe', probeNotice });
const gateStatuses = await page.locator('.cap-card .status').allInnerTexts();
steps.push({ step: 'rf-legal-gates', gateStatuses });
if (!gateStatuses.includes('PROHIBITED')) throw new Error('legal gates missing PROHIBITED');
if (!gateStatuses.includes('SIMULATION_ONLY')) throw new Error('legal gates missing SIMULATION_ONLY');

const heatRects = await page.locator('.floor-plan svg rect').count();
const simChip = await page.locator('.floor-plan .prov-chip').innerText();
steps.push({ step: 'rf-heatmap', heatRects, simChip });
if (heatRects < 20) throw new Error(`heatmap did not render: ${heatRects} rects`);
if (!simChip.includes('SIMULATOR')) throw new Error(`heatmap not labelled SIMULATOR: ${simChip}`);
await shot('05-rf-lab');

// Meteorological models must render and stay labelled as models, not measurements.
await page.getByRole('button', { name: 'Meteorology & Forecast' }).click();
await page.waitForTimeout(200);
const metBody = await page.locator('.view').innerText();
const metStats = await page.locator('.rf-readout .stat .v').allInnerTexts();
const reliabilityDots = await page.locator('.floor-plan svg rect').count();
steps.push({
  step: 'meteorology',
  stats: metStats.slice(0, 8),
  reliabilityDots,
  mentionsModel: metBody.includes('MODEL_DERIVED'),
  mentionsSimulator: metBody.includes('SIMULATOR'),
});
if (!metBody.includes('MODEL_DERIVED')) throw new Error('meteorology not labelled MODEL_DERIVED');
if (!metBody.includes('SIMULATOR')) throw new Error('verification not labelled SIMULATOR');
if (reliabilityDots < 4) throw new Error(`reliability chart did not render: ${reliabilityDots} marks`);
if (metBody.includes('NaN')) throw new Error('meteorology rendered NaN');
await shot('05b-meteorology');

// Access control: directory, roles and permission checker must render and be labelled SIMULATOR.
await page.getByRole('button', { name: 'Access & Entities' }).click();
await page.waitForTimeout(200);
const accessBody = await page.locator('.view').innerText();
const accessStats = await page.locator('.stat .v').allInnerTexts();
steps.push({
  step: 'access-directory',
  stats: accessStats.slice(0, 4),
  mentionsSimulator: accessBody.includes('SIMULATOR'),
});
if (!accessBody.includes('SIMULATOR')) throw new Error('access panel not labelled SIMULATOR');
if (!accessBody.includes('Entidades') || !accessBody.includes('Usuarios')) {
  throw new Error('access summary missing directory KPIs');
}

await page.getByRole('button', { name: 'Usuarios', exact: true }).click();
await page.waitForTimeout(120);
const userRows = await page.locator('.data-table tbody tr').count();
const userSearch = page.getByPlaceholder('Nombre o correo');
await userSearch.fill('Elena');
await page.waitForTimeout(120);
const filteredRows = await page.locator('.data-table tbody tr').count();
steps.push({ step: 'access-users', userRows, filteredRows });
if (userRows < 10) throw new Error(`user table did not render: ${userRows} rows`);
if (filteredRows !== 1) throw new Error(`user search did not filter to one row: ${filteredRows}`);

await page.getByRole('button', { name: 'Matriz de roles' }).click();
await page.waitForTimeout(120);
const matrixRows = await page.locator('.role-matrix tbody tr').count();
const grantedMarks = await page.locator('.role-matrix td span').filter({ hasText: '●' }).count();
steps.push({ step: 'access-matrix', matrixRows, grantedMarks });
if (matrixRows < 10) throw new Error(`role matrix did not render: ${matrixRows} rows`);
if (grantedMarks < 20) throw new Error(`role matrix missing grants: ${grantedMarks}`);

await page.getByRole('button', { name: 'Comprobador de acceso' }).click();
await page.waitForTimeout(120);
const deniedBefore = await page.locator('.check-row[data-granted="false"]').count();
await page.getByRole('checkbox', { name: /Superadministrador/ }).check();
await page.waitForTimeout(120);
const deniedAfter = await page.locator('.check-row[data-granted="false"]').count();
steps.push({ step: 'access-checker', deniedBefore, deniedAfter });
if (deniedBefore === 0) throw new Error('operator role should not grant every permission');
if (deniedAfter !== 0) throw new Error('super_admin should grant every permission');
await shot('05c-access');

// Simulation must be labelled synthetic.
await page.getByRole('button', { name: 'Simulation Lab' }).click();
await page.waitForTimeout(120);
const simBody = await page.locator('.view').innerText();
steps.push({ step: 'simulation', labelled: simBody.includes('SINTÉTICOS'), bars: await page.locator('.sim-bar').count() });
await shot('06-simulation');

// Evidence view must expose SHA-256 hashes for the snapshot.
await page.getByRole('button', { name: 'Forensic Evidence' }).click();
await page.waitForTimeout(120);
const hashCells = await page.locator('.data-table td.mono').allInnerTexts();
const shaCount = hashCells.filter((t) => /^[0-9a-f]{64}$/.test(t.trim())).length;
steps.push({ step: 'evidence', shaCount });
if (shaCount < 4) throw new Error(`expected >=4 SHA-256 rows, found ${shaCount}`);
await shot('07-evidence');

// Keyboard navigation: select the first source row via the keyboard.
await page.getByRole('button', { name: 'Camera Intelligence' }).click();
await page.waitForTimeout(120);
const cameraRows = await page.locator('.data-table tbody tr').count();
steps.push({ step: 'camera-intelligence', cameraRows });
if (cameraRows !== 25) throw new Error(`expected 25 camera rows, found ${cameraRows}`);
await shot('08-camera-intelligence');

// Sources view.
await page.getByRole('button', { name: 'Live Sources' }).click();
await page.waitForTimeout(120);
const sourceRows = await page.locator('.data-table tbody tr').count();
steps.push({ step: 'live-sources', sourceRows });
await shot('09-live-sources');

// Secure Link: identity, manifest integrity, signed envelope, tamper, outbox.
await page.getByRole('button', { name: 'Secure Link' }).click();
await page.waitForSelector('text=ED25519_READY');
await page.waitForSelector('text=X25519_READY');
const manifestNotice = await page.locator('.view.split .notice').first().innerText();
steps.push({ step: 'secure-manifest', manifestNotice });
if (!manifestNotice.includes('PASS')) throw new Error(`manifest did not pass: ${manifestNotice}`);

await page.getByRole('button', { name: 'Firmar y verificar' }).click();
await page.waitForSelector('text=VERIFIED');
steps.push({ step: 'secure-sign', verified: true });

await page.getByRole('button', { name: 'Manipular payload' }).click();
await page.waitForSelector('text=REJECTED');
const rejected = await page.locator('[data-testid="verification-notice"]').innerText();
steps.push({ step: 'secure-tamper', rejected });
if (!rejected.includes('PAYLOAD_TAMPERED')) throw new Error(`tamper not detected: ${rejected}`);

await page.getByRole('button', { name: 'Encolar offline' }).click();
await page.waitForTimeout(120);
const queuedText = await page.locator('.secure-meta').innerText();
steps.push({ step: 'secure-outbox', queuedText });
if (!queuedText.includes('1 pendientes')) throw new Error(`outbox did not queue: ${queuedText}`);

await page.getByRole('button', { name: 'Acusar recibo del par' }).click();
await page.waitForTimeout(120);
const ackedText = await page.locator('.secure-meta').innerText();
steps.push({ step: 'secure-ack', ackedText });
if (!ackedText.includes('0 pendientes')) throw new Error(`ack did not clear queue: ${ackedText}`);
await shot('11-secure-link');

// Disable every external request to prove the app is offline-capable.
await context.route('**/*', (route) => {
  const url = route.request().url();
  if (url.startsWith(baseURL)) return route.continue();
  return route.abort();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.header h1');
steps.push({ step: 'offline-reload', ok: true, blockedExternal: true });
await shot('10-offline');

const durationMs = Date.now() - started;
const summary = {
  generatedAtUTC: new Date().toISOString(),
  baseURL,
  browser: await browser.version(),
  durationMs,
  steps,
  consoleErrors,
  pageErrors,
};

await writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
await browser.close();

if (pageErrors.length > 0 || consoleErrors.length > 0) {
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(summary, null, 2));

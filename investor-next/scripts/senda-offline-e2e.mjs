#!/usr/bin/env node
/**
 * Prueba extremo a extremo de SENDA Campo SIN RED, en Chromium real (Playwright).
 * Tres teléfonos independientes (contextos con almacenamiento propio):
 *   A = Abraham, B = Ismael, C = vecino «mula» que transporta sin poder leer.
 * Tras instalar la app, se CORTA la red de los tres y se recarga: la app debe abrir desde
 * su propia caché. Luego se verifican tres caminos:
 *   1) sonido: la forma de onda real que A emite se decodifica en B,
 *   2) archivo .senda: A → B,
 *   3) almacenar-transportar-reenviar: A → C (mula) → B, y el recibo de B borra la copia de C.
 * Genera evidence/senda/offline-e2e.json y capturas.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, '../public');
const outDir = resolve(here, '../../evidence/senda');
await mkdir(outDir, { recursive: true });
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try { let p = resolve(pub, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!p.startsWith(pub)) throw 0; if (!extname(p)) { const html = p.replace(/\/$/, '') + '.html'; p = (await readFile(html).then(() => true, () => false)) ? html : resolve(p, 'index.html'); } const body = await readFile(p); res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
// SENDA_BASE_URL=https://civic-relay-investor.vercel.app/senda verifica el despliegue publicado en lugar del local.
const base = process.env.SENDA_BASE_URL || `http://127.0.0.1:${server.address().port}/senda`;

const results = []; const t0 = Date.now();
const check = (name, ok, detail = {}) => { results.push({ name, ok: !!ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}`); if (!ok) process.exitCode = 1; };

const browser = await chromium.launch();
async function phone(label, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await page.fill('#ob-name', name); await page.click('#ob-go');
  await page.waitForFunction(() => document.querySelector('#me-name')?.textContent.length > 0);
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  return { label, ctx, page, errors };
}
const A = await phone('A', 'Abraham'), B = await phone('B', 'Ismael'), C = await phone('C', 'Vecino');

// ---- Corte de red total y recarga: la app debe abrir desde la caché del teléfono
const offlineNetworkAttempts = [];
for (const p of [A, B, C]) {
  await p.ctx.setOffline(true);
  p.page.on('requestfailed', (r) => offlineNetworkAttempts.push(r.url()));
  await p.page.reload();
  await p.page.waitForFunction(() => window.SENDA_TEST?.ready && document.querySelector('#me-name')?.textContent.length > 0, null, { timeout: 15000 });
}
check('La app abre sin red en los 3 teléfonos (service worker + IndexedDB)', await A.page.evaluate(() => navigator.onLine === false && document.querySelector('#net').textContent === 'SIN RED'));
await A.page.screenshot({ path: resolve(outDir, 'e2e-01-offline-home.png') });

// ---- Intercambio de tarjetas (código de texto: válido por SMS, papel, cualquier medio)
const card = (p) => p.page.evaluate(() => window.SENDA_TEST.myCard());
await B.page.evaluate((c) => window.SENDA_TEST.receiveText(c), await card(A));
await A.page.evaluate((c) => window.SENDA_TEST.receiveText(c), await card(B));
check('Tarjetas intercambiadas sin red', (await A.page.evaluate(() => window.SENDA_TEST.state.contacts.length)) === 1 && (await B.page.evaluate(() => window.SENDA_TEST.state.contacts.length)) === 1);

async function compose(p, text, prio = '3') {
  await p.page.click('[data-tab="messages"]');
  await p.page.selectOption('#prio', prio); await p.page.fill('#body', text); await p.page.click('#send');
  await p.page.waitForFunction((t) => document.querySelector('#body').value === '', text);
}
const inboxHas = (p, text) => p.page.evaluate((t) => window.SENDA_TEST.state.inbox.some((m) => m.body === t), text);

// ---- Camino 1: SONIDO (forma de onda real generada por la app emisora)
const M1 = 'Ismael, ¿qué tal estás? Te escribo sin cobertura.';
await compose(A, M1);
await A.page.evaluate(() => { window.SENDA_TEST.lastEmission = null; window.SENDA_TEST.emitTop(); });
await A.page.waitForFunction(() => window.SENDA_TEST.lastEmission !== null);
const wave = await A.page.evaluate(() => { const { samples, sampleRate } = window.SENDA_TEST.lastEmission; let s = ''; const u = new Uint8Array(samples.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return { b64: btoa(s), sampleRate, seconds: samples.length / sampleRate }; });
const bytesHeard = await B.page.evaluate(async ({ b64, sampleRate }) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return window.SENDA_TEST.ingestSamples(Array.from(new Float32Array(u.buffer)), sampleRate); }, wave);
check('Camino SONIDO: B descifra el mensaje de A a partir del audio emitido', await inboxHas(B, M1), { airtimeSeconds: +wave.seconds.toFixed(1), bytes: bytesHeard });

// ---- Camino 2: ARCHIVO .senda (Quick Share / AirDrop / Bluetooth / USB)
const M2 = 'Estamos en el polideportivo, todos bien.';
await compose(A, M2);
await B.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await A.page.evaluate(() => window.SENDA_TEST.exportBundle()));
check('Camino ARCHIVO: B recibe y descifra el paquete .senda', await inboxHas(B, M2));

// ---- Camino 3: MULA — C transporta sin poder leer y entrega a B
const M3 = 'SOS: abuela necesita insulina, Calle Real 4';
await compose(A, M3, '0');
const sosId = await A.page.evaluate(() => window.SENDA_TEST.state.store.list().find((i) => i.priority === 0).id);
await C.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await A.page.evaluate(() => window.SENDA_TEST.exportBundle()));
const cCarries = await C.page.evaluate((id) => window.SENDA_TEST.state.store.has(id), sosId);
const cCannotRead = await C.page.evaluate(() => window.SENDA_TEST.state.inbox.length === 0);
check('La mula C transporta el SOS cifrado y no puede leerlo', cCarries && cCannotRead);
await B.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await C.page.evaluate(() => window.SENDA_TEST.exportBundle()));
check('Camino MULA: B recibe el SOS a través de C', await inboxHas(B, M3));
await C.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await B.page.evaluate(() => window.SENDA_TEST.exportBundle()));
check('El recibo infalsificable de B borra la copia que llevaba C', !(await C.page.evaluate((id) => window.SENDA_TEST.state.store.has(id), sosId)));

// ---- Duplicados y persistencia
await B.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await A.page.evaluate(() => window.SENDA_TEST.exportBundle()));
check('Duplicados descartados (cada mensaje una sola vez)', (await B.page.evaluate(() => window.SENDA_TEST.state.inbox.length)) === 3);
await B.page.reload();
await B.page.waitForFunction(() => window.SENDA_TEST?.state?.inbox?.length === 3, null, { timeout: 15000 });
check('Tras reiniciar sin red, B conserva sus mensajes (IndexedDB)', true);
await B.page.click('[data-tab="messages"]'); await B.page.screenshot({ path: resolve(outDir, 'e2e-02-inbox-offline.png'), fullPage: true });
await C.page.click('[data-tab="messages"]'); await C.page.screenshot({ path: resolve(outDir, 'e2e-03-mule.png'), fullPage: true });

// ---- Modo viaje: accidente detectado por sensores, sin respuesta → aviso automático
const crashSignal = (opts) => B.page.evaluate((o) => {
  const G = 9.80665; let s = 3; const n = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5) * 0.6;
  const t0 = performance.now() / 1000, motion = [], gps = [];
  for (let t = -70; t <= 20; t += 0.05) { const g = o.overturn && t > 1 ? [G, 0, 0] : [0, 0, G]; const m = { t: t0 + t, ax: g[0] + n(), ay: g[1] + n(), az: g[2] + n() }; if (o.impactG && t >= 0 && t < 0.15) { m.ax += o.impactG * G * 0.6; m.ay += o.impactG * G * 0.8; } motion.push(m); }
  for (let t = -70; t <= 20; t += 1) gps.push({ t: t0 + t, speed: o.speed && t < 0 ? o.speed : o.speed && o.stopS ? Math.max(0, o.speed * (1 - t / o.stopS)) : 0, lat: 37.995, lon: -4.53, heading: 45, accuracy: 20 });
  window.SENDA_TEST.countdownS = 2;
  return window.SENDA_TEST.tripFeed({ motion, gps, train: 'Tren 2384 (prueba)', coach: '6' });
}, opts);
const drop = await crashSignal({ impactG: 8 });
check('Modo viaje: una caída del móvil NO dispara alarma', drop.state === 'PHONE_DROP' && (await B.page.isHidden('#crash')));
const crash = await crashSignal({ impactG: 7, overturn: true, speed: 55, stopS: 3 });
const overlay = await B.page.isVisible('#crash');
await B.page.screenshot({ path: resolve(outDir, 'e2e-04-crash-prompt.png') });
await B.page.waitForFunction(() => window.SENDA_TEST.lastIncident() !== null, null, { timeout: 8000 });
const inc = await B.page.evaluate(() => window.SENDA_TEST.lastIncident());
check('Modo viaje: vuelco a 200 km/h → «¿Estás bien?» y, sin respuesta, aviso automático', crash.state === 'CRASH_LIKELY' && overlay && inc.status === 'NO_RESPONSE' && inc.coach === '6', { detection: crash.state, peakG: crash.peakG, tiltDeg: crash.tiltDeg });
await A.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await B.page.evaluate(() => window.SENDA_TEST.exportBundle()));
await A.page.click('[data-tab="zone"]');
const brief = await A.page.textContent('#incidents');
check('El contacto recibe el aviso de accidente cifrado sin red y lo ve legible', (await A.page.evaluate(() => window.SENDA_TEST.state.inbox.some((m) => m.incident?.status === 'NO_RESPONSE'))) && brief !== 'Sin informes.' && /informe|SITIO/.test(brief), { brief });
await A.page.screenshot({ path: resolve(outDir, 'e2e-05-incident-received.png'), fullPage: true });

// ---- Panel de coordinación sin red (precargado por el service worker)
await C.page.goto(base + '/incidente');
await C.page.waitForFunction(() => window.SENDA_PANEL?.sim?.secondTrainKnownS != null, null, { timeout: 15000 });
const panel = await C.page.evaluate(() => ({ s: window.SENDA_PANEL.sim.secondTrainKnownS, sites: window.SENDA_PANEL.sim.final.sites.length }));
check('Panel de coordinación abre sin red y separa los 2 trenes en segundos', panel.sites === 2 && panel.s < 90, { secondTrainKnownS: panel.s });
await C.page.setViewportSize({ width: 1280, height: 900 }); await C.page.screenshot({ path: resolve(outDir, 'e2e-06-coordination-panel.png'), fullPage: true });

check('Sin errores de JavaScript en los 3 teléfonos', [A, B, C].every((p) => p.errors.length === 0), { errors: [A, B, C].flatMap((p) => p.errors) });

await browser.close(); server.close();
const evidence = { kind: 'REAL_CHROMIUM_AUTOMATED_E2E', target: process.env.SENDA_BASE_URL ? base : 'local static server (investor-next/public)', network: 'OFFLINE (context.setOffline(true) en los 3 contextos tras instalar)', at: new Date().toISOString(),
  durationS: +((Date.now() - t0) / 1000).toFixed(1), passed: results.filter((r) => r.ok).length, total: results.length, results, offlineNetworkAttemptsBlocked: offlineNetworkAttempts.length,
  scope: 'Tres navegadores Chromium independientes. La onda acústica es la que genera la app emisora, inyectada en la receptora (sin altavoz/micrófono físicos en CI).' };
await writeFile(resolve(outDir, 'offline-e2e.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`\n${evidence.passed}/${evidence.total} · ${evidence.durationS}s → evidence/senda/offline-e2e.json`);

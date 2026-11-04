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

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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

// ---- Gemelo digital de edificios (sin red, precargado)
await C.page.goto(base + '/edificios');
await C.page.waitForFunction(() => window.SENDA_BUILDINGS?.sim, null, { timeout: 15000 });
const tw = await C.page.evaluate(() => { const s = window.SENDA_BUILDINGS.sim; return { affected: s.zone.affected, total: s.zone.total, located: s.routers.located, within1: s.routers.floorWithin1Pct, gateways: s.routers.gateways, lost: s.routers.lostBetweenSurveys, board: s.board.length }; });
await C.page.waitForTimeout(600); await C.page.screenshot({ path: resolve(outDir, 'e2e-07-zone-drone.png') });
await C.page.click('[data-v="tower"]'); await C.page.waitForTimeout(800); await C.page.screenshot({ path: resolve(outDir, 'e2e-08-building-3d.png') });
await C.page.click('#send-alert');
const alertOut = await C.page.textContent('#alert-out');
await C.page.click('[data-v="ar"]'); await C.page.waitForTimeout(1500);
const arShown = await C.page.evaluate(() => window.SENDA_BUILDINGS.arShown ?? 0);
await C.page.screenshot({ path: resolve(outDir, 'e2e-09-camera-heatmap.png') });
check('Gemelo digital sin red: recuento de zona, edificio 3D, routers por planta, alerta dirigida y cámara con mapa de calor',
  tw.total === 14 && tw.affected >= 5 && tw.located >= 50 && tw.within1 >= 95 && tw.gateways >= 1 && tw.board === 15 && /plantas 1, 2, 3, 4/.test(alertOut) && arShown > 0,
  { ...tw, arSignalsInView: arShown });

// ---- Visión por capas: motor de fusión + capas sobre la cámara (sin red)
await C.page.click('[data-v="vision"]'); await C.page.check('#layers input[value="TOPOGRAFIA"]'); await C.page.waitForTimeout(1500);
const vis = await C.page.evaluate(() => window.SENDA_BUILDINGS.vision);
const fusionRows = await C.page.locator('#fusion-table tr').count();
await C.page.screenshot({ path: resolve(outDir, 'e2e-14-vision-layers.png') });
check('Visión por capas sin red: probabilidad, espectro, estructura y topografía sobre la cámara; la vivienda con «atrapado» encabeza la prioridad con ≥98 % corroborado por 2 fuentes',
  vis && ['PROBABILIDAD', 'ESPECTRO', 'ESTRUCTURA', 'TOPOGRAFIA'].every((k) => vis.byLayer[k] > 0) && vis.top.cls === 'CONFIRMADO_POR_RESPUESTA' && vis.top.badge98 && fusionRows >= 9,
  { byLayer: vis?.byLayer, top: vis?.top, planTop: vis?.planTop });

// ---- Ojo de SENDA (sin red): constelaciones, casos reales y ruta del aviso
await C.page.goto(base + '/ojo');
await C.page.waitForFunction(() => window.SENDA_OJO, null, { timeout: 20000 });
await C.page.click('#cases button[data-id="adamuz"]'); await C.page.waitForTimeout(1500);
const ojo = await C.page.evaluate(() => window.SENDA_OJO);
await C.page.screenshot({ path: resolve(outDir, 'e2e-17-ojo.png'), fullPage: true });
check('Ojo de SENDA sin red: 7 casos reales, satélite visible con elevación, distancia y latencia calculadas, y plan k-de-n ≥99 % con los canales que quedan',
  ojo.cases === 7 && ojo.selected === 'adamuz' && ojo.path && ojo.path.elevationDeg >= 10 && ojo.path.rangeKm > 700 && ojo.path.delayMs > 2 && ojo.plan.p >= 0.99 && ojo.visible.galileo > 0,
  { path: ojo.path, plan: ojo.plan, visible: ojo.visible });

// ---- Incendio forestal (sin red): frente, antenas y canal de aviso por pueblo
await C.page.goto(base + '/incendio');
await C.page.waitForFunction(() => window.SENDA_FIRE, null, { timeout: 20000 });
await C.page.evaluate(() => { document.querySelector('#play').click(); const t = document.querySelector('#t'); t.value = '125'; t.dispatchEvent(new Event('input', { bubbles: true })); });
await C.page.waitForTimeout(1200);
const fireRes = await C.page.evaluate(() => window.SENDA_FIRE.assets);
await C.page.screenshot({ path: resolve(outDir, 'e2e-16-incendio.png'), fullPage: true });
const byId = Object.fromEntries(fireRes.map((a) => [a.id, a]));
check('Incendio sin red: la antena de Valdeolmos cae antes de su hora límite (aviso adelantado), Navalcerro se avisa a su hora y Hoyarrubia queda fuera de alcance',
  byId.A.antennaFirst && byId.A.commsLossMin < byId.A.deadlineMin && !byId.B.antennaFirst && byId.C.status === 'FUERA_DE_ALCANCE',
  { gapMin: Math.round(byId.A.deadlineMin - byId.A.commsLossMin) });

// ---- Vigilancia ferroviaria (sin red)
await C.page.goto(base + '/via');
await C.page.waitForFunction(() => window.SENDA_RAIL, null, { timeout: 20000 });
const rail = await C.page.evaluate(() => window.SENDA_RAIL);
await C.page.waitForTimeout(300); await C.page.screenshot({ path: resolve(outDir, 'e2e-15-rail-watch.png'), fullPage: true });
check('Vigilancia ferroviaria sin red: escalón del circuito de vía detectado ≥20 h antes sin alarma del umbral, defectos de vía por los móviles, transición sin supervisión y muro con lluvia',
  rail.events === 1 && rail.thresholdAlarms === 0 && rail.leadTimeH >= 20 && rail.geoAlerts.some((a) => a.kinds.includes('IMPACTO_REPETIDO')) && rail.geoAlerts.some((a) => a.kinds.includes('DEGRADACION')) && rail.topTransition === 'ALTO_SIN_SUPERVISION' && rail.topAsset === 3,
  rail);

// ---- Flujo institucional real: organismo → credencial → alerta firmada → mula → residente → respuesta → cuadro
const orgPage = await A.ctx.newPage(); orgPage.on('pageerror', (e) => A.errors.push(String(e)));
await orgPage.goto(base + '/organismo');
await orgPage.fill('#o-id', 'es-bomberos-piloto'); await orgPage.fill('#o-name', 'Bomberos (piloto)'); await orgPage.selectOption('#o-kind', 'FIRE'); await orgPage.click('#o-create');
await orgPage.waitForFunction(() => document.querySelector('#o-anchor').value.startsWith('SENDA-ANCLA:'));
const anchorCode = await orgPage.evaluate(() => window.SENDA_ORG.anchor());
const reqCode = await A.page.evaluate(() => window.SENDA_TEST.co().requestCode());
const credCode = await orgPage.evaluate((r) => window.SENDA_ORG.sign(r), reqCode);
await orgPage.close();
const coStatus = await A.page.evaluate(async ({ a, c }) => { const co = window.SENDA_TEST.co(); await co.importAnchorCode(a); return co.importCredentialCode(c); }, { a: anchorCode, c: credCode });
await B.page.evaluate(async (a) => { const co = window.SENDA_TEST.co(); await co.importAnchorCode(a); await co.setProfile({ buildingId: 'B14', floor: 3, unit: 'B', consentRemote: true }); window.SENDA_TEST.alertCountdownS = 30; }, anchorCode);
await C.page.goto(base); await C.page.waitForFunction(() => window.SENDA_TEST?.ready, null, { timeout: 15000 }); await C.page.evaluate(() => window.SENDA_TEST.ready);
await C.page.evaluate((a) => window.SENDA_TEST.co().importAnchorCode(a), anchorCode);
await A.page.click('[data-tab="coord"]');
await A.page.fill('#co-building', 'B14'); await A.page.fill('#co-floors', '1-4');
await A.page.click('[data-co="send-alert"]');
await A.page.waitForFunction(() => window.SENDA_TEST.state.coord.alerts.length === 1);
// A → mula C → B (sin red)
await C.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await A.page.evaluate(() => window.SENDA_TEST.exportBundle()));
const cLog = await C.page.evaluate(() => window.SENDA_TEST.state.cmdLog[0]);
await B.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await C.page.evaluate(() => window.SENDA_TEST.exportBundle()));
await B.page.waitForSelector('#alert:not([hidden])', { timeout: 5000 });
const issuerText = await B.page.textContent('#alert-issuer');
await B.page.waitForFunction(() => document.querySelector('#alert-native')?.href?.startsWith('senda://accion'));
const nativeHref = await B.page.getAttribute('#alert-native', 'href');
await B.page.screenshot({ path: resolve(outDir, 'e2e-10-signed-alert.png') });
await B.page.click('#alert-opts [data-rs="TRAPPED"]');
await B.page.waitForFunction(() => window.SENDA_TEST.lastResponse()?.status === 'TRAPPED');
// B → mula C → A
await C.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await B.page.evaluate(() => window.SENDA_TEST.exportBundle()));
await A.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await C.page.evaluate(() => window.SENDA_TEST.exportBundle()));
await A.page.click('[data-tab="coord"]'); await A.page.waitForTimeout(300);
const boardText = await A.page.textContent('#co-board');
await A.page.screenshot({ path: resolve(outDir, 'e2e-11-coordinator-board.png'), fullPage: true });
check('Organismo firma credencial; alerta firmada viaja por la mula; el residente la verifica, responde «atrapado» y el coordinador lo ve en su cuadro',
  /FIRE · JEFE_INCIDENTE/.test(coStatus.text) && /Bomberos \(piloto\)|FIRE/.test(issuerText) && /B14/.test(boardText) && /3/.test(boardText),
  { issuer: issuerText, board: boardText.slice(0, 120) });
const nat = new URL(nativeHref);
check('La alerta ofrece abrir SENDA Android con las acciones nativas (baliza BLE) y el id de baliza del teléfono', nat.searchParams.get('a').includes('BLE_BEACON') && /^[0-9a-f]{16}$/.test(nat.searchParams.get('id')) && nat.searchParams.get('f') === '3', { href: nativeHref });
check('Un teléfono sin consentimiento de órdenes remotas IGNORA la alerta (y la sigue transportando)', cLog && cLog.accepted === false && cLog.reason === 'NO_OWNER_CONSENT', { reason: cLog?.reason });

// ---- Relé por Internet (cuando hay conexión)
// Solo en local: desde el origen público https, Chromium puede bloquear el acceso a un relé en 127.0.0.1
// (protección de red local). En producción el relé se despliega con su propio dominio HTTPS.
if (!process.env.SENDA_BASE_URL) {
const { createRelay } = await import('../../packages/senda-relay/server.mjs');
const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
const relay = createRelay({ dataDir: mkdtempSync(join(tmpdir(), 'senda-e2e-relay-')) }); await new Promise((r) => relay.server.listen(0, r));
const relayUrl = `http://127.0.0.1:${relay.server.address().port}`;
const M5 = 'Mensaje por relé: estoy en el albergue';
await compose(A, M5);
await A.ctx.setOffline(false); await C.ctx.setOffline(false);
await A.page.evaluate((u) => { document.querySelector('#relay-url').value = u; }, relayUrl); await A.page.evaluate(() => window.SENDA_TEST.co().syncRelay());
await C.page.evaluate((u) => { document.querySelector('#relay-url').value = u; }, relayUrl); await C.page.evaluate(() => window.SENDA_TEST.co().syncRelay());
await A.ctx.setOffline(true); await C.ctx.setOffline(true);
await B.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await C.page.evaluate(() => window.SENDA_TEST.exportBundle()));
check('Relé por Internet: A sube con conexión, C baja y transporta sin red, B lo recibe; el relé no puede leerlo', (await inboxHas(B, M5)) && !JSON.stringify(relay.store.snapshot()).includes('albergue'));
await relay.close();
} else console.log('SKIP · Relé por Internet (solo en local; ver comentario)');

// ---- Capa centralizadora: red multiportador, satélites, previsión de apagón, drones y CAP (sin red)
const R = await C.ctx.newPage(); R.on('pageerror', (e) => C.errors.push(String(e)));
await R.goto(base + '/red'); await R.waitForFunction(() => window.SENDA_RED?.plan(), null, { timeout: 15000 });
await R.click('#trial'); await R.waitForFunction(() => window.SENDA_RED.trial != null);
await R.click('#cap-go'); await R.waitForFunction(() => window.SENDA_RED.cap != null);
const red = await R.evaluate(() => ({ p: window.SENDA_RED.plan().pDelivery, feasible: window.SENDA_RED.plan().feasible, bearers: new Set(window.SENDA_RED.plan().messages.map((m) => m.id)).size, trial: window.SENDA_RED.trial, half: window.SENDA_RED.forecast().halfDarkAtH, gw: window.SENDA_RED.gateways().picks.length, cap: window.SENDA_RED.cap, sats: document.querySelectorAll('#sats tbody tr').length }));
await R.setViewportSize({ width: 1280, height: 900 }); await R.screenshot({ path: resolve(outDir, 'e2e-12-red-multiportador.png'), fullPage: true });
check('Red SENDA sin red: reparto k-de-n entre varios portadores ≥99 %, prueba real de pérdida de portadores, catálogo satelital, previsión de apagón con pasarelas y CAP con auditoría que delata alteraciones',
  red.feasible && red.p >= 0.99 && red.bearers >= 2 && red.trial >= 0.95 && red.half != null && red.gw === 5 && red.cap.ok && red.cap.tamperDetected && /cap:1\.2/.test(red.cap.cap) && red.sats >= 8,
  { pDelivery: +red.p.toFixed(4), trialSuccess: red.trial, halfDarkAtH: red.half, gateways: red.gw });
await R.goto(base + '/incidente'); await R.waitForFunction(() => window.SENDA_PANEL?.sim?.final, null, { timeout: 15000 });
await R.click('#cap'); await R.waitForFunction(() => window.SENDA_PANEL.cap != null);
const capInc = await R.evaluate(() => window.SENDA_PANEL.cap);
check('Panel ferroviario exporta cada emplazamiento a la sala 112 en CAP 1.2 con auditoría íntegra', capInc.count === 2 && capInc.auditOk && /<severity>Extreme<\/severity>/.test(capInc.xml), { sites: capInc.count });

// ---- Modo fácil: un toque «Estoy atrapado» llega cifrado al contacto
await A.page.click('[data-tab="home"]');
await A.page.click('[data-quick="TRAPPED"]');
await A.page.waitForFunction(() => window.SENDA_TEST.state.lastQuick?.status === 'TRAPPED');
await B.page.evaluate((t) => window.SENDA_TEST.receiveText(t), await A.page.evaluate(() => window.SENDA_TEST.exportBundle()));
await A.page.click('[data-tab="home"]'); await A.page.check('#easy-only'); await A.page.waitForTimeout(5500);
const easyVisible = await A.page.evaluate(() => ({ sosHidden: getComputedStyle(document.querySelector('#sos')).display === 'none', easy: getComputedStyle(document.querySelector('#easy')).display !== 'none' }));
await A.page.screenshot({ path: resolve(outDir, 'e2e-13-modo-facil.png') });
await A.page.uncheck('#easy-only');
const easyInbox = await B.page.evaluate(() => window.SENDA_TEST.state.inbox.some((m) => m.body.startsWith('ESTOY ATRAPADO · Abraham')));
check('Modo fácil: un toque «Estoy atrapado» sale cifrado y el contacto lo recibe; la vista sencilla deja solo los botones grandes', easyInbox && easyVisible.sosHidden && easyVisible.easy, { easyInbox, ...easyVisible });

// ---- Accesibilidad (automática): idioma, nombre accesible de cada control, alt en imágenes
const a11y = async (page) => page.evaluate(() => {
  const issues = [];
  if (!document.documentElement.lang) issues.push('html sin lang');
  const named = (el) => el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.title;
  for (const el of document.querySelectorAll('input:not([type=hidden]),select,textarea')) if (!named(el)) issues.push(`${el.tagName.toLowerCase()}#${el.id || '?'} sin etiqueta`);
  for (const b of document.querySelectorAll('button,a[href]')) if (!(b.textContent.trim() || b.getAttribute('aria-label') || b.title || b.querySelector('img[alt]:not([alt=""])'))) issues.push(`${b.tagName.toLowerCase()}#${b.id || '?'} sin nombre`);
  for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) issues.push('img sin alt');
  return issues;
});
const a11yIssues = {};
for (const path of ['', '/red', '/organismo', '/incidente', '/edificios', '/via', '/ojo', '/incendio', '/estado']) {
  await R.goto(base + path); await R.waitForLoadState('load'); await R.waitForTimeout(300);
  const iss = await a11y(R); if (iss.length) a11yIssues[path || '/'] = iss;
}
await R.close();
check('Accesibilidad automática en las 9 pantallas: idioma declarado, todos los controles con nombre accesible e imágenes con texto alternativo', Object.keys(a11yIssues).length === 0, { issues: a11yIssues });

check('Sin errores de JavaScript en los 3 teléfonos', [A, B, C].every((p) => p.errors.length === 0), { errors: [A, B, C].flatMap((p) => p.errors) });

await browser.close(); server.close();
const evidence = { kind: 'REAL_CHROMIUM_AUTOMATED_E2E', target: process.env.SENDA_BASE_URL ? base : 'local static server (investor-next/public)', network: 'OFFLINE (context.setOffline(true) en los 3 contextos tras instalar)', at: new Date().toISOString(),
  durationS: +((Date.now() - t0) / 1000).toFixed(1), passed: results.filter((r) => r.ok).length, total: results.length, results, offlineNetworkAttemptsBlocked: offlineNetworkAttempts.length,
  scope: 'Tres navegadores Chromium independientes. La onda acústica es la que genera la app emisora, inyectada en la receptora (sin altavoz/micrófono físicos en CI).' };
await writeFile(resolve(outDir, 'offline-e2e.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`\n${evidence.passed}/${evidence.total} · ${evidence.durationS}s → evidence/senda/offline-e2e.json`);

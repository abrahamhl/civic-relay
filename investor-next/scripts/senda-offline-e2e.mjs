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

// ---- Censo radio con dron (sin red): teléfonos exactos por planta e intervalo de personas que cubre la verdad
await C.page.goto(base + '/dron');
await C.page.waitForFunction(() => window.SENDA_DRON?.r, null, { timeout: 20000 });
const dron = await C.page.evaluate(() => { const S = window.SENDA_DRON; return { phones: S.r.floors.map((f) => f.phones.lo), truePhones: S.sc.phones, covered: S.r.floors.every((f) => f.people.lo <= S.sc.truth[f.floor] && S.sc.truth[f.floor] <= f.people.hi), addresses: S.r.addresses, total: S.r.total, empty: S.r.floors[3].people }; });
await C.page.screenshot({ path: resolve(outDir, 'e2e-18-dron-censo.png'), fullPage: true });
check('Censo radio con dron sin red: teléfonos exactos por planta pese a la rotación de direcciones, intervalo de personas que contiene la verdad en las 6 plantas y planta sin teléfonos = «0, quizá 1»',
  JSON.stringify(dron.phones) === JSON.stringify(dron.truePhones) && dron.covered && dron.addresses > 2.5 * dron.total.mid && dron.empty.mid === 0 && dron.empty.hi === 1, dron);

// ---- Arquitectura (sin red): escenarios paso a paso y ficha de cada pieza
await C.page.goto(base + '/arquitectura');
await C.page.waitForFunction(() => window.SENDA_ARQ, null, { timeout: 20000 });
await C.page.click('#sc button[data-i="2"]');
for (let i = 0; i < 5; i++) await C.page.click('#next');
await C.page.click('.node[data-id="c-census"]');
const arq = await C.page.evaluate(() => ({ step: window.SENDA_ARQ.step, cur: document.querySelector('.node.cur')?.dataset.id, edges: document.querySelectorAll('#edges > path').length, detail: document.querySelector('#node-body').textContent, nodes: document.querySelectorAll('.node').length, links: [...new Set([...document.querySelectorAll('#node-body a, .inv a')].map((a) => a.getAttribute('href')))] }));
await C.page.screenshot({ path: resolve(outDir, 'e2e-19-arquitectura.png'), fullPage: true });
check('Arquitectura sin red: el escenario «Censo con dron» recorre sus 6 pasos con sus 5 conexiones, y cada pieza muestra estado real, código y enlace',
  arq.step === 5 && arq.cur === 'd-rescue' && arq.edges === 5 && /Probado en simulación/.test(arq.detail) && /rf-census\.mjs/.test(arq.detail) && arq.nodes >= 30, arq);

// ---- Capacidades v0.12 (sin red): sentidos, riadas, triaje, monte y dron casa por casa
const cap = async (path, fn, shot) => { await C.page.goto(base + path); await C.page.waitForFunction(() => window.SENDA_VIZ_READY, null, { timeout: 20000 }); await C.page.waitForTimeout(600); const r = await C.page.evaluate(fn); await C.page.screenshot({ path: resolve(outDir, shot), fullPage: true }); return r; };
const sent = await cap('/sentidos', () => window.SENDA_SENTIDOS, 'e2e-22-sentidos.png');
check('Sentidos ampliados sin red: el golpe se sitúa a < 0,5 m con 5 móviles y relojes desfasados, y la respiración por Wi-Fi se detecta (≈14 rpm) solo cuando hay persona',
  sent.result.err < 0.5 && sent.csi.person.detected && Math.abs(sent.csi.person.rpm - 14) < 1.5 && !sent.csi.empty.detected, { err: sent.result.err, csi: sent.csi });
const agua = await cap('/agua', () => window.SENDA_AGUA, 'e2e-23-riadas.png');
check('Riadas y maremotos sin red: la subida aguas arriba avisa ≥ 2 h antes en pueblos donde casi no llueve, y subir a una 3.ª planta es más rápido que la llegada del maremoto',
  agua.result.every((r) => r.leadMin >= 120 && r.localRainMm < 10) && agua.people.every((p) => p.verticalMin < Math.min(...agua.coasts.map((c) => c.etaMin))), { leads: agua.result.map((r) => r.leadMin), coasts: agua.coasts });
await C.page.goto(base + '/triaje'); await C.page.waitForFunction(() => window.SENDA_VIZ_READY);
const tri = await C.page.evaluate(() => { const click = (t) => [...document.querySelectorAll('#wiz button')].find((b) => b.textContent.startsWith(t)).click(); click('No'); click('Sí'); click('Más de 7'); document.querySelector('[data-f=bleeding]').click(); const steps = document.querySelector('#out').textContent; document.querySelector('#add').click(); return { cat: window.SENDA_TRIAJE.victims[0].cat, msg: window.SENDA_TRIAJE.msg, steps }; });
await C.page.screenshot({ path: resolve(outDir, 'e2e-24-triaje.png'), fullPage: true });
check('Triaje sin red: «no camina, respira, más de 30/min» → ROJO, con indicaciones de hemorragia y un parte de ≤ 160 caracteres que pide el 112 primero',
  tri.cat === 'ROJO' && /Presión directa/.test(tri.steps) && tri.msg.length <= 160 && /\| 112,/.test(tri.msg), tri);
const monte = await cap('/monte', () => ({ err: window.SENDA_MONTE.fix.err, maj: window.SENDA_MONTE.fix.errMajorM, tiles: window.SENDA_MONTE.tiles }), 'e2e-25-monte.png');
check('Monte sin red: posición por rumbos a aerogeneradores y antena dentro de su elipse de error, y mapas de una sierra en menos de 100 MB',
  monte.err < 2.5 * monte.maj && monte.tiles.mb < 100, monte);
const bar = await cap('/barrido', () => window.SENDA_BARRIDO, 'e2e-26-barrido.png');
check('Dron casa por casa sin red: 24 edificios en varias salidas que respetan la batería y tablero de prioridad que encabeza el edificio con más personas probables y daño',
  bar.sorties.length >= 2 && bar.sorties.flatMap((s) => s.houses).length === 24 && bar.top[0] === 'D2', { sorties: bar.sorties.length, top: bar.top });

// ---- Batería de Internet (sin red): reserva, biblioteca de vecinos y puntos de rebote
await C.page.goto(base + '/reserva'); await C.page.waitForFunction(() => window.SENDA_VIZ_READY && window.SENDA_RESERVA?.roundTrip, null, { timeout: 20000 });
const resv = await C.page.evaluate(async () => { const S = window.SENDA_RESERVA; const st = await navigator.storage.estimate(); return { cov: S.coverage, used: S.plan.usedMB, swarm: S.swarm, rt: S.roundTrip.ok, best: S.rebote.best.id, quota: st.quota > 0 }; });
await C.page.screenshot({ path: resolve(outDir, 'e2e-27-reserva.png'), fullPage: true });
check('Batería de Internet sin red: 1 GB cubre ≥ 95 % de lo necesario, la biblioteca de vecinos reconstruye el paquete exacto (Reed-Solomon y SHA-256) y la memoria de cobertura elige el cerro con antena de grupo electrógeno',
  resv.cov >= 0.95 && resv.used <= 1024 && resv.rt && resv.swarm.p >= 0.99 && resv.best === 'ermita' && resv.quota, resv);

// ---- Ruta protectora (sin red): cadena de frenadas, SOS que viaja con los coches, puntos cívicos verificables, detector real
await C.page.goto(base + '/carretera'); await C.page.waitForFunction(() => window.SENDA_VIZ_READY && window.SENDA_CARRETERA?.ledger, null, { timeout: 20000 });
await C.page.click('#t-brake'); await C.page.click('#r-btns [data-k="animal"]');
const road = await C.page.evaluate(() => { const S = window.SENDA_CARRETERA; return { no: S.no.collisions, si: S.si.collisions, sos: S.road.sosDeliveredMin, warned: S.road.warnedBeyondSight, ok: S.ledgerOk, pts: S.ledger.totals, ratio: S.corridor.ratio, live: S.live.state, hex: document.querySelector('#r-hex').textContent.trim().split(' ').length }; });
await C.page.screenshot({ path: resolve(outDir, 'e2e-28-carretera.png'), fullPage: true });
check('Ruta protectora sin red: con 1,2 s entre coches el aviso SENDA reduce el choque en cadena de 5 a 1, el SOS sale de la zona sin cobertura en menos de 10 min con los coches que pasan, el libro de puntos cívicos verifica su cadena SHA-256 y el detector marca la frenada',
  road.no === 5 && road.si === 1 && road.sos !== null && road.sos < 10 && road.warned >= 1 && road.ok && road.ratio < 0.1 && road.live === 'HARD_BRAKE' && road.hex === 24, road);

// ---- v0.15 sin red: situaciones al volante, V16 + SENDA, cámaras (visibilidad física) y exportación a Países Bajos (DATEX II y rood kruis)
const drv = await C.page.evaluate(() => { const S = window.SENDA_CARRETERA; return { v16: S.v16.incidents[0].kind, trapped: S.v16.incidents[0].trapped, orphan: S.v16.orphans.length, w: S.lwr.w, calc: S.calc, rows: document.querySelectorAll('#z-tb tr').length }; });
check('Situaciones al volante sin red: V16 + SENDA convierte una baliza en «accidente con atrapado», la cola crece hacia atrás a 14,3 km/h (LWR) y las calculadoras de niebla, firme y agua responden',
  drv.v16 === 'ACCIDENTE' && drv.trapped === 1 && drv.orphan === 1 && drv.w === -14.3 && drv.calc.vis === 72 && drv.calc.flood === 'PIERDE_CONTROL' && drv.rows >= 18, drv);
const cam = await cap('/camaras', () => ({ est: window.SENDA_CAMARAS.est.visM, vis: window.SENDA_CAMARAS.vis, never: [...document.querySelectorAll('#f-tb .chip.no')].length }), 'e2e-29-camaras.png');
check('Cámaras sin red: la visibilidad estimada en la imagen con niebla de 120 m queda a menos del 15 % y lo prohibido (cámaras sin permiso, «Ojo de Dios», biometría) aparece como NUNCA',
  Math.abs(cam.est - cam.vis) / cam.vis < 0.15 && cam.never === 3, cam);
const nl = await cap('/paises', () => ({ d: window.SENDA_PAISES.datex, conv: window.SENDA_PAISES.plan.needsConvenio }), 'e2e-30-paises.png');
const msi = await C.page.evaluate(async () => { document.querySelector('#m-say').click(); await new Promise((r) => setTimeout(r, 50)); return window.SENDA_PAISES.spoken; });
check('Exportación a Países Bajos sin red: el lector DATEX II convierte la publicación en avisos y se queda con los 3 de la ruta; el rood kruis se dice en neerlandés; las cámaras allí requieren convenio',
  nl.d.records === 5 && nl.d.route === 3 && /Rood kruis op rijstrook 1: voeg in naar rechts/.test(msi) && nl.conv.includes('Cámaras'), { ...nl, msi });

// ---- v0.16 sin red: infraestructura de la DGT (solo datos publicados), cola desde aforos DATEX II y paneles
const dgt = await cap('/dgt', () => { const S = window.SENDA_DGT; return { gw: S.gateways, q: S.queue, vms: S.vms, radar: S.radar, never: document.querySelectorAll('#t-tb .chip.no').length }; }, 'e2e-31-dgt.png');
check('Infraestructura DGT sin red: ningún equipo de la vía es pasarela (solo DGT 3.0 por convenio), detectar radares y publicar controles móviles es NUNCA, las estaciones de aforo localizan la cola y los paneles se convierten en avisos',
  dgt.gw.join() === 'dgt30' && dgt.never === 2 && dgt.q.sTail === 3000 && dgt.q.growing && dgt.vms.join() === 'CRASH,FOG,CRASH' && dgt.radar.zone && dgt.radar.avg === 106, dgt);

// ---- Llamada sin Internet: dos teléfonos nuevos, código por SONIDO (onda real) y conexión directa sin servidor.
// (La emulación «offline» de Chromium también bloquea WebRTC local, así que aquí se demuestra lo equivalente:
//  sin servidores STUN/TURN ni de señalización y CERO peticiones de red desde que empieza la llamada.)
const callPhone = async () => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e))); await page.goto(base + '/llamada'); await page.waitForFunction(() => window.SENDA_CALL_API); const reqs = []; page.on('request', (r) => reqs.push(r.url())); return { ctx, page, errors, reqs }; };
const D = await callPhone(), E = await callPhone();
const offerCode = await D.page.evaluate(() => window.SENDA_CALL_API.createOffer());
const offerWave = await D.page.evaluate(async (t) => { const m = await import('/senda/core/acoustic-modem.mjs'), s = await import('/senda/core/sdp-compact.mjs'); return Array.from(m.modulate(s.callFromText(t), { sampleRate: 48000 })); }, offerCode);
const heardOffer = await E.page.evaluate(async (arr) => { const m = await import('/senda/core/acoustic-modem.mjs'), s = await import('/senda/core/sdp-compact.mjs'); const r = m.demodulate(Float32Array.from(arr), { sampleRate: 48000 }); return r && s.callToText(r.payload); }, offerWave);
const answerCode = await E.page.evaluate((t) => window.SENDA_CALL_API.acceptOffer(t), heardOffer);
await D.page.evaluate((t) => window.SENDA_CALL_API.acceptAnswer(t), answerCode);
await D.page.waitForFunction(() => window.SENDA_CALL.state === 'connected', null, { timeout: 15000 }).catch(() => {});
await E.page.waitForFunction(() => window.SENDA_CALL.state === 'connected', null, { timeout: 15000 }).catch(() => {});
await D.page.evaluate(() => window.SENDA_CALL_API.send('Hola, te oigo')); await E.page.click('#sos');
await D.page.waitForTimeout(2500);
const call = { d: await D.page.evaluate(() => ({ ...window.SENDA_CALL, path: document.querySelector('#k-path').textContent })), e: await E.page.evaluate(() => ({ ...window.SENDA_CALL })), offerS: +(offerWave.length / 48000).toFixed(1), soundExact: heardOffer === offerCode, requestsDuringCall: [...D.reqs, ...E.reqs].filter((u) => !u.startsWith('data:')) };
await D.page.screenshot({ path: resolve(outDir, 'e2e-20-llamada.png'), fullPage: true });
check('Llamada sin Internet: oferta de <110 bytes por sonido (onda real, decodificada exacta), conexión directa cifrada, voz Opus y chat en ambos sentidos y cero peticiones de red durante la llamada',
  call.soundExact && call.d.sentBytes < 110 && call.e.sentBytes < 110 && call.d.state === 'connected' && call.e.state === 'connected' && call.e.received.includes('Hola, te oigo') && call.d.received.some((m) => m.startsWith('🆘')) && call.d.audioPackets > 20 && call.e.audioPackets > 20 && call.requestsDuringCall.length === 0 && call.d.path === 'local, sin servidor',
  { offerBytes: call.d.sentBytes, answerBytes: call.e.sentBytes, offerSoundS: call.offerS, audioPackets: [call.d.audioPackets, call.e.audioPackets], requests: call.requestsDuringCall });
await D.page.evaluate(() => document.querySelector('#hang').click());
const demo = await E.page.evaluate(async () => { await window.SENDA_CALL_API.demoHere(); return window.SENDA_CALL.demo; });
check('Llamada de prueba en un solo dispositivo (sin micrófono): dos conexiones reales A↔B con el código por forma de onda, mensaje y audio recibidos', demo.connected && demo.message?.includes('3.ª planta') && demo.audioPackets > 10, demo);
const chain = await E.page.evaluate(async () => { const before = window.SENDA_CALL.mesh; document.querySelector('#mesh-bat').click(); await new Promise((r) => setTimeout(r, 150)); const low = window.SENDA_CALL.mesh; document.querySelector('#mesh-bat').click(); await window.SENDA_CALL_API.chainDemo(); return { before, low, ...window.SENDA_CALL.chain }; });
await E.page.locator('#mesh').screenshot({ path: resolve(outDir, 'e2e-21-cadena-voz.png') });
check('Cadena de voz real A → B → C: B reenvía la voz de A (C oye el tono de 440 Hz de A) y el chat; el plan nunca usa como repetidor a quien tiene poca batería y avisa de quién queda aislado',
  chain.connected && Math.abs(chain.freqAtC - 440) <= 12 && chain.audioPacketsAtC > 20 && chain.message?.includes('4.ª planta') && !chain.before.relays.includes('Marta') && chain.before.unreachable.length === 0 && chain.low.unreachable.join() === 'Ana,Luis,Marta',
  { freqAtC: chain.freqAtC, audioPacketsAtC: chain.audioPacketsAtC, relays: chain.before.relays, isolatedWhenLow: chain.low.unreachable });
for (const p of [D, E]) { A.errors.push(...p.errors); await p.ctx.close(); }

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
for (const path of ['', '/red', '/organismo', '/incidente', '/edificios', '/via', '/ojo', '/incendio', '/estado', '/llamada', '/dron', '/arquitectura', '/sentidos', '/agua', '/triaje', '/monte', '/barrido', '/reserva', '/carretera', '/camaras', '/paises', '/dgt']) {
  await R.goto(base + path); await R.waitForLoadState('load'); await R.waitForTimeout(300);
  const iss = await a11y(R); if (iss.length) a11yIssues[path || '/'] = iss;
}
await R.close();
check('Accesibilidad automática en las 22 pantallas: idioma declarado, todos los controles con nombre accesible e imágenes con texto alternativo', Object.keys(a11yIssues).length === 0, { issues: a11yIssues });

check('Sin errores de JavaScript en los 3 teléfonos', [A, B, C].every((p) => p.errors.length === 0), { errors: [A, B, C].flatMap((p) => p.errors) });

await browser.close(); server.close();
const evidence = { kind: 'REAL_CHROMIUM_AUTOMATED_E2E', target: process.env.SENDA_BASE_URL ? base : 'local static server (investor-next/public)', network: 'OFFLINE (context.setOffline(true) en los 3 contextos tras instalar)', at: new Date().toISOString(),
  durationS: +((Date.now() - t0) / 1000).toFixed(1), passed: results.filter((r) => r.ok).length, total: results.length, results, offlineNetworkAttemptsBlocked: offlineNetworkAttempts.length,
  scope: 'Tres navegadores Chromium independientes. La onda acústica es la que genera la app emisora, inyectada en la receptora (sin altavoz/micrófono físicos en CI).' };
await writeFile(resolve(outDir, 'offline-e2e.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`\n${evidence.passed}/${evidence.total} · ${evidence.durationS}s → evidence/senda/offline-e2e.json`);

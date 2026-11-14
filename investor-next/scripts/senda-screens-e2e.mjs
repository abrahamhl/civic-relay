/**
 * SENDA · pruebas de extremo a extremo de las pantallas «Mensaje sin red», «Avisos» y la cola de reportes
 * ciudadanos del Centro, en Chromium real con varios «móviles» (contextos de navegador aislados).
 *
 * Qué se comprueba (nada simulado en la criptografía; la ubicación del navegador sí es fija):
 *  - Mensaje: emparejar → número de seguridad igual en los dos → mensaje corto en 1 línea ≤ 160 caracteres →
 *    abrir con autenticidad → repetido rechazado → alterado rechazado → mensaje largo con una línea perdida y
 *    desordenado → por sonido (señal emitida por un móvil, decodificada en otro).
 *  - Avisos: 3 móviles firman reportes de 160 caracteres → un 4.º importa con duplicado y falsificación →
 *    agrupa en 1 incidente → paso por sonido.
 *  - Centro: verifica, descarta repetidos y falsos, prioriza atrapados primero y exporta CAP restringido.
 *  - Atlas: datos GOES reales, zona de 5 km, filtro por instante y GeoJSON con fuente. Demo guiada: corre el código real.
 * Escribe evidence/senda/screens-e2e.json. Sale con código ≠ 0 si algo falla.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = dirname(fileURLToPath(import.meta.url)), pub = resolve(here, '../public'), outDir = resolve(here, '../../evidence/senda');
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try { let p = resolve(pub, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!p.startsWith(pub)) throw 0; if (!extname(p)) p = p.replace(/\/$/, '') + '.html'; const body = await readFile(p); res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/senda`;
const results = [], t0 = Date.now();
const check = (name, ok, detail = {}) => { results.push({ name, ok: !!ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}`); if (!ok) process.exitCode = 1; };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function phone(path, { lat = 39.4269, lon = -0.4174 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, geolocation: { latitude: lat, longitude: lon }, permissions: ['geolocation'] });
  await ctx.addInitScript(() => { window.SENDA_TEST = window.SENDA_TEST || {}; });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  await page.goto(base + path); return page;
}
const lastEmission = (p) => p.evaluate(() => ({ s: Array.from(window.SENDA_TEST.lastEmission.samples), sr: window.SENDA_TEST.lastEmission.sampleRate }));
const decodeOn = (p, em) => p.evaluate(async (em) => { const { decodeSamples } = await import('/senda/audio.mjs'); return Array.from(decodeSamples(Float32Array.from(em.s), em.sr)?.payload ?? []); }, em);

try {
  /* ───── Mensaje sin red ───── */
  const yo = await phone('/mensaje'), her = await phone('/mensaje');
  for (const p of [yo, her]) await p.waitForFunction(() => document.querySelector('#mycode').textContent.startsWith('SP1.'));
  const cy = await yo.textContent('#mycode'), ch = await her.textContent('#mycode');
  await yo.fill('#peer-name', 'Hermano'); await yo.fill('#peer-code', ch); await yo.click('#add');
  await her.fill('#peer-name', 'Abraham'); await her.fill('#peer-code', cy); await her.click('#add');
  await yo.waitForSelector('#pair-out .ok'); await her.waitForSelector('#pair-out .ok');
  check('mensaje: el número de seguridad coincide en los dos móviles', (await yo.textContent('#contacts .big')) === (await her.textContent('#contacts .big')));
  const open = async () => { await her.evaluate(() => { document.querySelector('#opened').innerHTML = ''; }); await her.click('#open'); await her.waitForFunction(() => document.querySelector('#opened').textContent.trim().length > 0); return her.textContent('#opened'); };
  await yo.fill('#text', 'Estoy bien. Sin red en casa. Llamo cuando vuelva.'); await yo.click('#seal'); await yo.waitForSelector('#frames code');
  const lines = await yo.$$eval('#frames code', (e) => e.map((x) => x.textContent));
  check('mensaje: un mensaje corto cabe en una línea de ≤ 160 caracteres', lines.length === 1 && lines[0].length <= 160, { chars: lines[0].length });
  await her.fill('#inbox', 'Recibido:\n' + lines[0]);
  check('mensaje: se abre con autenticidad verificada', /autenticidad verificada[\s\S]*Estoy bien/.test(await open()));
  check('mensaje: el repetido se detecta', /ya lo habías abierto/.test(await open()));
  const l = lines[0], bad = l.slice(0, 40) + (l[40] === 'A' ? 'B' : 'A') + l.slice(41);
  await her.fill('#inbox', bad); check('mensaje: el alterado no se muestra', !/Estoy bien/.test(await open()));
  await yo.fill('#text', 'Largo: '.padEnd(380, 'x')); await yo.click('#seal'); await yo.waitForFunction(() => document.querySelectorAll('#frames code').length > 1);
  const L2 = await yo.$$eval('#frames code', (e) => e.map((x) => x.textContent));
  await her.fill('#inbox', L2.slice(1).reverse().join('\n'));
  check('mensaje: el largo se rehace sin la primera línea y desordenado', /autenticidad verificada[\s\S]*Largo:/.test(await open()), { lines: L2.length });
  await yo.fill('#text', 'Por sonido.'); await yo.click('#seal'); await yo.waitForSelector('#snd'); await yo.click('#snd');
  await yo.waitForFunction(() => /Emitido|No se pudo/.test(document.querySelector('#snd').textContent), null, { timeout: 90_000 });
  const bytesM = await decodeOn(her, await lastEmission(yo));
  await her.fill('#inbox', ''); await her.evaluate((b) => window.SENDA_MENSAJE.addBytes(Uint8Array.from(b)), bytesM);
  check('mensaje: pasa por sonido de un móvil a otro y se abre', /autenticidad verificada[\s\S]*Por sonido/.test(await open()));

  /* ───── Avisos ───── */
  const rep = [];
  for (const [lat, k] of [[39.4269, 'STREET_FLOODED'], [39.4271, 'STREET_FLOODED'], [39.4402, 'PERSON_TRAPPED']]) {
    const p = await phone('/avisos', { lat }); await p.click('#geo'); await p.waitForFunction(() => /39\./.test(document.querySelector('#pos').textContent));
    await p.click(`#kinds button[data-k="${k}"]`); if (k === 'PERSON_TRAPPED') await p.fill('#trapped', '2');
    await p.click('#send'); await p.waitForSelector('#sent code'); rep.push(await p.textContent('#sent code'));
  }
  check('avisos: cada reporte firmado ocupa exactamente 160 caracteres', rep.every((x) => x.length === 160));
  const me = await phone('/avisos');
  await me.fill('#paste', 'Grupo:\n' + rep.slice(0, 2).join('\n') + '\n' + rep[0] + '\nSND3 ' + rep[1].slice(5, 20) + 'AAAA' + rep[1].slice(24));
  await me.click('#import'); await me.waitForFunction(() => document.querySelector('#imp').textContent.length > 0);
  const imp = await me.textContent('#imp');
  check('avisos: 2 nuevos, 1 repetido y 1 falsificado rechazado', /2 nuevo/.test(imp) && /1 repetido/.test(imp) && /1 rechazado/.test(imp), { imp });
  check('avisos: dos vecinos de la misma calle forman un solo incidente', /2 reportes → 1 incidente/.test(await me.textContent('#qsum')));
  const sender = await phone('/avisos', { lat: 39.4270 }); await sender.click('#geo'); await sender.waitForFunction(() => /39\./.test(document.querySelector('#pos').textContent));
  await sender.click('#kinds button[data-k="RIVER_RISING"]'); await sender.click('#send'); await sender.waitForSelector('#snd'); await sender.click('#snd');
  await sender.waitForFunction(() => /Emitido|No se pudo/.test(document.querySelector('#snd').textContent), null, { timeout: 60_000 });
  const bytesA = await decodeOn(me, await lastEmission(sender));
  await me.evaluate((b) => window.SENDA_AVISOS.ingestBytes(Uint8Array.from(b)), bytesA);
  check('avisos: un reporte pasa por sonido y entra verificado', /1 nuevo/.test(await me.textContent('#imp')));

  /* ───── Centro ───── */
  const cctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }), c = await cctx.newPage();
  c.on('pageerror', (e) => errors.push(`centro: ${e.message}`));
  await c.goto(base + '/centro'); await c.waitForSelector('#boot.done', { timeout: 90_000 });
  await c.fill('#cit-in', rep.join('\n') + '\n' + rep[0] + '\nSND3 ' + 'A'.repeat(155)); await c.click('#cit-go');
  await c.waitForFunction(() => window.SENDA_CENTRO.lastCitizen);
  const cit = await c.evaluate(() => window.SENDA_CENTRO.lastCitizen);
  check('centro: 4 líneas válidas, 1 rechazada, 2 incidentes y atrapados primero', cit.valid === 4 && cit.rejected === 1 && cit.incidents === 2 && cit.top === 'STRUCTURE', cit);
  const [dl] = await Promise.all([c.waitForEvent('download'), c.click('#cit-out button[data-cap]')]);
  const cap = await readFile(await dl.path(), 'utf8');
  check('centro: el parte CAP 1.2 es restringido y de ejercicio', /<scope>Restricted<\/scope>/.test(cap) && /<status>Exercise<\/status>/.test(cap) && !/<scope>Public/.test(cap));

  /* ───── Atlas y demo guiada ───── */
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }), a = await actx.newPage();
  a.on('pageerror', (e) => errors.push(`atlas: ${e.message}`));
  await a.goto(base + '/atlas'); await a.waitForSelector('body[data-ready]');
  const all = await a.evaluate(() => window.SENDA_ATLAS.last);
  await a.evaluate(() => window.SENDA_ATLAS.setArea({ type: 'circle', center: { lat: 39.7596, lon: -121.6219 }, radiusM: 5000 }));
  const zone = await a.evaluate(() => window.SENDA_ATLAS.last);
  check('atlas: Camp Fire con detecciones GOES reales y zona de 5 km alrededor de Paradise', all.total > 1000 && zone.inside > 0 && zone.inside < all.total && zone.first > Date.parse('2018-11-08T14:57:18Z'), { total: all.total, inside: zone.inside, first: new Date(zone.first).toISOString() });
  const { t0 } = await a.evaluate(() => window.SENDA_ATLAS.range()); await a.evaluate((t) => window.SENDA_ATLAS.setTime(t), t0);
  check('atlas: la línea de tiempo filtra por instante', (await a.evaluate(() => window.SENDA_ATLAS.last)).inside === 0);
  await a.evaluate((t) => window.SENDA_ATLAS.setTime(t), Date.parse('2018-11-08T23:47:18Z'));
  const [gdl] = await Promise.all([a.waitForEvent('download'), a.click('#gj')]);
  const gj = JSON.parse(await readFile(await gdl.path(), 'utf8'));
  check('atlas: el GeoJSON exportado lleva fuente y base en cada punto', gj.features.length > 1 && gj.features.filter((f) => f.geometry.type === 'Point' && !f.properties.role).every((f) => f.properties.source && f.properties.basis), { features: gj.features.length });
  await a.evaluate(() => window.SENDA_ATLAS.setCase('world'));
  const w = await a.evaluate(() => window.SENDA_ATLAS.last);
  check('atlas: capa mundial con alertas reales de GDACS (descarga oficial con SHA-256 por página)', w.case === 'world' && w.total > 100, { total: w.total });
  await a.evaluate(() => window.SENDA_ATLAS.setCase('spain'));
  const es = await a.evaluate(() => window.SENDA_ATLAS.last);
  check('atlas: capa España con incidencias reales de la DGT leídas por el lector DATEX II del núcleo', es.case === 'spain' && es.total > 50, { total: es.total });
  const d = await (await actx.newPage()); d.on('pageerror', (e) => errors.push(`demo: ${e.message}`));
  await d.goto(base + '/demo'); await d.click('#run'); await d.waitForFunction(() => window.SENDA_DEMO?.done || window.SENDA_DEMO?.error, null, { timeout: 30_000 });
  const demo = await d.evaluate(() => window.SENDA_DEMO);
  check('demo: cifra en ≤ 160 caracteres, abre, rechaza alterado y repetido, verifica reporte y calcula el atlas', demo.done && demo.chars <= 160 && demo.opened && demo.tamperRejected && demo.replayRejected && demo.reportChars === 160 && demo.reportVerified && demo.atlas.insideParadise5km > 0, demo);
} catch (e) { check(`ejecución sin excepciones (${e.message})`, false); }

check('sin errores de JavaScript en las páginas', errors.length === 0, { errors });
await browser.close(); server.close();
await mkdir(outDir, { recursive: true });
const passed = results.filter((r) => r.ok).length;
await writeFile(resolve(outDir, 'screens-e2e.json'), JSON.stringify({ kind: 'senda-screens-e2e', at: new Date().toISOString(), durationS: Math.round((Date.now() - t0) / 1000), passed, total: results.length, results, note: 'Ubicación del navegador fija; sonido verificado decodificando la señal generada (no por altavoz y micrófono reales).' }, null, 1));
console.log(`${passed}/${results.length} comprobaciones`);

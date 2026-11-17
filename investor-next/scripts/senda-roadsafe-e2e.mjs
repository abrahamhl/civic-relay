/**
 * SENDA RoadSafe · E2E en Chromium real (móvil y escritorio), sin red externa.
 * Comprueba: carga sin errores, ES/EN/NL, expediente de avería, «accidente» exige llamada humana al 112,
 * solicitud de asistencia que NUNCA se muestra como «en camino» por un 2xx, operador con raíces causales
 * deduplicadas y auditoría ✓, simulación A–E con controles visibles, sin desbordamiento horizontal,
 * ninguna petición a dominios externos. Escribe evidence/roadsafe/roadsafe-e2e.json y capturas.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = dirname(fileURLToPath(import.meta.url)), pub = resolve(here, '../public'), outDir = resolve(here, '../../evidence/roadsafe');
await mkdir(outDir, { recursive: true });
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try { let p = resolve(pub, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!p.startsWith(pub)) throw 0; if (!extname(p)) p = p.replace(/\/$/, '') + '.html'; const body = await readFile(p); res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
const check = (name, ok, detail = {}) => { results.push({ name, ok: !!ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}`); if (!ok) { console.log('  detalle:', JSON.stringify(detail).slice(0, 400)); process.exitCode = 1; } };

const browser = await chromium.launch();
for (const vp of [{ name: 'movil', width: 390, height: 844 }, { name: 'escritorio', width: 1280, height: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, geolocation: { latitude: 40.2001, longitude: -3.3002 }, permissions: ['geolocation'] });
  const page = await ctx.newPage(), errors = [], external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto(`${origin}/senda/roadsafe.html`);
  await page.waitForFunction(() => window.__roadsafeReady === true, null, { timeout: 15000 });
  check(`${vp.name}: carga sin errores`, errors.length === 0, { errors });
  const tel = await page.getAttribute('#call112', 'href');
  check(`${vp.name}: botón 112 es tel:112 y visible sin abrir expediente`, tel === 'tel:112' && await page.isVisible('#call112'));
  await page.check('#q-hurt');
  check(`${vp.name}: autoevaluación — heridos/atrapados ⇒ CRITICAL con instrucción 112`, /CRITICAL/.test(await page.textContent('#c-risk')) && /112/.test(await page.textContent('#c-risk')));
  await page.uncheck('#q-hurt');
  await page.click('#b-breakdown'); await page.waitForSelector('#c-case b');
  const caseTxt = await page.textContent('#c-case');
  check(`${vp.name}: expediente de avería abierto (UNVERIFIED, sin registro)`, /RS-[0-9a-f]{16}/.test(caseTxt) && /UNVERIFIED/.test(caseTxt), { caseTxt: caseTxt.slice(0, 200) });
  await page.click('#b-tow'); await page.waitForSelector('#c-services li');
  const svc = await page.textContent('#c-services');
  check(`${vp.name}: grúa simulada → PARTNER_ACKNOWLEDGED con SIM, nunca «en camino»`, /PARTNER_ACKNOWLEDGED/.test(svc) && /SIM/.test(svc) && !/EN_ROUTE|ON_SCENE/.test(svc), { svc });
  await page.click('#b-crash'); await page.waitForTimeout(200);
  const crash = await page.textContent('#c-case');
  check(`${vp.name}: accidente → escalada con instrucción de llamar (SENDA no llama)`, /EMERGENCY_ESCALATION_REQUIRED/.test(crash) && /no llama por ti/.test(crash), { crash: crash.slice(0, 300) });
  for (const [l, re] of [['en', /Call 112/], ['nl', /Bel 112/], ['es', /Llamar al 112/]]) { await page.click(`button[data-lang=${l}]`); check(`${vp.name}: idioma ${l}`, re.test(await page.textContent('#call112')) && (await page.getAttribute('html', 'lang')) === l); }
  await page.click('#tab-o'); await page.click('#o-run'); await page.waitForSelector('#o-prov tbody tr');
  const prov = await page.textContent('#o-prov'), conf = await page.textContent('#o-conf'), audit = await page.textContent('#o-audit'), svcO = await page.textContent('#o-svc');
  check(`${vp.name}: operador — V16/DGT/navegador comparten raíz causal`, (prov.match(/V16_BEACON:V16-001/g) ?? []).length === 4 && (prov.match(/misma raíz: no suma/g) ?? []).length === 3 && /UNVERIFIED|CORROBORATED/.test(conf), { prov: prov.slice(0, 300), conf });
  check(`${vp.name}: operador — auditoría encadenada ✓`, /✓/.test(audit), { audit });
  check(`${vp.name}: operador — 202 sin referencia se queda en TRANSPORT_ACCEPTED`, /TRANSPORT_ACCEPTED/.test(svcO) && /ACK_SIN_REFERENCIA/.test(svcO), { svcO: svcO.slice(0, 400) });
  const prio = await page.$$eval('#o-prio tbody tr', (rs) => rs.map((r) => r.textContent));
  check(`${vp.name}: priorización — el «atrapado» sin verificar va primero con VERIFICAR`, prio.length === 4 && /atrapado/.test(prio[0]) && /VERIFICAR/.test(prio[0]), { prio: prio.map((x) => x.slice(0, 60)) });
  const q20 = await page.textContent('#z-info'); await page.fill('#z-min', '50'); await page.dispatchEvent('#z-min', 'input'); const q50 = await page.textContent('#z-info');
  const len = (t) => +(t.match(/ADVANCE_WARNING (\d+) m/) ?? [])[1];
  check(`${vp.name}: zona — el aviso anticipado crece con la cola y los paneles son propuestas`, len(q50) > len(q20) && /propuesta, requiere aprobación/.test(q50), { a20: len(q20), a50: len(q50) });
  await page.screenshot({ path: resolve(outDir, `roadsafe-operador-${vp.name}.png`), fullPage: true });
  await page.click('#tab-s'); await page.click('#s-run'); await page.waitForSelector('#s-res .bar');
  const sres = await page.textContent('#s-res'), srisk = await page.textContent('#s-risk');
  check(`${vp.name}: científico — 5 escenarios con IC y acuse de visualización 0`, (sres.match(/%/g) ?? []).length >= 10 && /acuse de visualización 0/.test(sres) && /d_stop/.test(srisk), { sres: sres.slice(0, 300) });
  await page.click('#s-circ'); await page.waitForSelector('#s-circ-t tbody tr');
  const circ = await page.$$eval('#s-circ-t tbody tr', (rs) => rs.map((r) => r.textContent));
  check(`${vp.name}: científico — ranking de 11 circunstancias, 2 s la más segura`, circ.length === 11 && /2 s/.test(circ.at(-1)), { last: circ.at(-1) });
  await page.screenshot({ path: resolve(outDir, `roadsafe-cientifico-${vp.name}.png`), fullPage: true });
  const overflow = await page.evaluate(() => [...document.querySelectorAll('[role=tabpanel]')].map((p) => { p.hidden = false; return document.documentElement.scrollWidth - document.documentElement.clientWidth; }));
  check(`${vp.name}: sin desbordamiento horizontal`, overflow.every((x) => x <= 1), { overflow });
  check(`${vp.name}: ninguna petición a dominios externos`, external.length === 0, { external });
  check(`${vp.name}: sin errores tras la interacción`, errors.length === 0, { errors });
  await ctx.close();
}
await browser.close(); server.close();
await writeFile(resolve(outDir, 'roadsafe-e2e.json'), JSON.stringify({ schema: 'senda-roadsafe-e2e/1', browser: 'chromium (playwright)', at: new Date().toISOString(), passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results }, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} comprobaciones superadas`);

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
  await page.click('#g-yes'); for (let i = 0; i < 8; i++) await page.click('#g-unk');
  check(`${vp.name}: emergencia guiada — humo/fuego ⇒ EXIT_NOW_FIRE con 112 primero`, /EXIT_NOW_FIRE/.test(await page.textContent('#g-out')) && /112/.test(await page.textContent('#g-out')));
  await page.click('#l-make'); await page.waitForSelector('#l-out .mono');
  check(`${vp.name}: ubicación — Plus Code y SMS listos`, /[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}/.test(await page.textContent('#l-out')));
  await page.click('#t-sim'); await page.waitForSelector('#t-out .tl');
  const occ = await page.textContent('#t-out');
  check(`${vp.name}: ocupantes — 4 personas, 2 sin confirmar, móvil perdido y separado`, /4/.test(occ) && /sin confirmar 2/.test(occ) && /POSSIBLY_LOST/.test(occ) && /POSSIBLY_SEPARATED/.test(occ), { occ: occ.slice(0, 300) });
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
  const phys = await page.textContent('#p-out');
  check(`${vp.name}: física — Δv, guiñada y probabilidad de invasión de carril`, /Δv taxi/.test(phys) && /LANE_1 \d+ %/.test(phys), { phys: phys.slice(0, 200) });
  const resp = await page.textContent('#r-out');
  check(`${vp.name}: servicios — posición caducada marcada y el ciudadano solo ve su asignación`, /STALE/.test(await page.textContent('#r-tab')) && /AMBULANCE/.test(resp) && !/GC-ATGC-12/.test(resp.split('ve')[1] ?? ''), { resp: resp.slice(0, 200) });
  await page.screenshot({ path: resolve(outDir, `roadsafe-operador-${vp.name}.png`), fullPage: true });
  await page.click('#tab-s'); await page.click('#s-run'); await page.waitForSelector('#s-res .bar');
  const sres = await page.textContent('#s-res'), srisk = await page.textContent('#s-risk');
  check(`${vp.name}: científico — 5 escenarios con IC y acuse de visualización 0`, (sres.match(/%/g) ?? []).length >= 10 && /acuse de visualización 0/.test(sres) && /d_stop/.test(srisk), { sres: sres.slice(0, 300) });
  await page.click('#s-circ'); await page.waitForSelector('#s-circ-t tbody tr');
  const circ = await page.$$eval('#s-circ-t tbody tr', (rs) => rs.map((r) => r.textContent));
  check(`${vp.name}: científico — ranking de 11 circunstancias, 2 s la más segura`, circ.length === 11 && /2 s/.test(circ.at(-1)), { last: circ.at(-1) });
  await page.waitForFunction(() => /ES/.test(document.querySelector('#d-out').textContent) && /DE/.test(document.querySelector('#d-out').textContent));
  check(`${vp.name}: dataset oficial — 5 países con OR de oscuridad y arcén`, /GB/.test(await page.textContent('#d-out')) && /FR/.test(await page.textContent('#d-out')) && /\*/.test(await page.textContent('#d-out')));
  await page.waitForFunction(() => /AUC/.test(document.querySelector('#m-out').textContent));
  const before = await page.textContent('#m-out'); await page.check('#m-hgv'); await page.waitForTimeout(100); const after = await page.textContent('#m-out');
  const pct = (t) => +(t.match(/([\d.]+) %/) ?? [])[1];
  check(`${vp.name}: modelo de gravedad — AUC publicado y vehículo pesado sube la probabilidad`, pct(after) > pct(before) && /hardShoulder/.test(after), { before: pct(before), after: pct(after) });
  await page.screenshot({ path: resolve(outDir, `roadsafe-cientifico-${vp.name}.png`), fullPage: true });
  await page.click('#tab-v'); await page.click('#v-save'); await page.click('#v-ann'); await page.click('#v-taxi'); await page.click('#v-det');
  const det = await page.$$eval('#v-det-t tbody tr', (rs) => rs.map((r) => r.textContent));
  check(`${vp.name}: detector — 10 casos sintéticos sin fallos (choque ⇒ preguntar; falsas alarmas ⇒ nada)`, det.length === 10 && (await page.$$('#v-det-t .b-bad')).length === 0, { det });
  const vout = await page.textContent('#v-out'), ann = await page.$$eval('#v-ann-out li', (l) => l.map((x) => x.textContent)), taxi = await page.textContent('#v-taxi-out');
  check(`${vp.name}: viaje — ruta favorita, paquete offline en KB, comparación por riesgo`, /★/.test(vout) && /KB/.test(vout) && /riesgo\/km/.test(vout), { vout: vout.slice(0, 200) });
  check(`${vp.name}: viaje — megafonía escalonada (≤3 avisos, sin órdenes)`, ann.length >= 2 && ann.length <= 3 && ann.every((a) => /Atención/.test(a) && !/[Ff]rena/.test(a)), { ann });
  check(`${vp.name}: viaje — sin evaluación del arcén no se recomienda parada del taxi`, /ABSTAIN_UNVERIFIED_SITE/.test(taxi) && /No se propone una parada/.test(taxi) && !/AHEAD_OF_DISABLED_ON_SHOULDER/.test(taxi));
  await page.screenshot({ path: resolve(outDir, `roadsafe-viaje-${vp.name}.png`), fullPage: true });
  await page.click('#tab-r'); await page.click('#r-run');
  await page.waitForFunction(() => document.querySelectorAll('#r-horizon tbody tr').length === 2);
  const roadRows = await page.locator('#r-horizon tbody tr').allTextContents();
  const roadChannels = await page.textContent('#r-channels');
  const roadRelay = await page.textContent('#r-relay');
  check(`${vp.name}: carretera — primero final de cola, después accidente`, /Final de cola/.test(roadRows[0]) && /Accidente/.test(roadRows[1]), { roadRows });
  check(`${vp.name}: carretera — no publica ni anuncia sin autorizaciones`, /DGT30/.test(roadChannels) && /WAZE_CIFS/.test(roadChannels) && /Avisos por voz emitidos: 0/.test(await page.textContent('#r-horizon')), {roadChannels});
  check(`${vp.name}: carretera — BLE se declara solo hipótesis`, /HIPÓTESIS/.test(roadRelay) && /%/.test(roadRelay), {roadRelay});
  const rre = await page.textContent('#r-horizon');
  check(`${vp.name}: carretera — predicción cinemática conserva incertidumbre y no afirma cobertura física`,
    /H-ROAD-RRE-1/.test(rre) && /ABSTAIN_NO_CALIBRATED_CHANNEL/.test(rre) &&
    /m\/s/.test(rre) && !/AUTOMATICALLY_VERIFIED/.test(rre), {text: rre.slice(-650)});
  await page.screenshot({ path: resolve(outDir, `roadsafe-carretera-${vp.name}.png`), fullPage: true });
  const overflow = await page.evaluate(() => [...document.querySelectorAll('[role=tabpanel]')].map((p) => { p.hidden = false; return document.documentElement.scrollWidth - document.documentElement.clientWidth; }));
  check(`${vp.name}: sin desbordamiento horizontal`, overflow.every((x) => x <= 1), { overflow });
  check(`${vp.name}: ninguna petición a dominios externos`, external.length === 0, { external });
  check(`${vp.name}: sin errores tras la interacción`, errors.length === 0, { errors });
  await ctx.close();
}
await browser.close(); server.close();
await writeFile(resolve(outDir, 'roadsafe-e2e.json'), JSON.stringify({ schema: 'senda-roadsafe-e2e/1', browser: 'chromium (playwright)', at: new Date().toISOString(), passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results }, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} comprobaciones superadas`);

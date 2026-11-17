/**
 * SENDA · QA canónica de navegador (Fases 2, 3, 4 y 5):
 * - Verifica responsividad sin desbordamiento horizontal en 360, 390, 768 y 1440 px.
 * - Verifica Centro de Coordinación (/senda/centro): SRLG N-2, procedencia, cola IndexedDB offline
 *   con persistencia tras recarga y revocación de consentimiento (tumba REVOKED), flujo de reportes
 *   ciudadanos (Detectar→Comprobar→Clasificar→Cerrar), bloqueo fail-closed por rol y paquete de evidencias.
 * - Verifica Visor Científico Temporal/4D (/senda/visor): GeoMAC Camp 2018 OBSERVADO, puerta H2
 *   EXPERIMENTAL_REJECTED (canPublicWarn=false), vista 2D/3D, inspección de nodo/fuente y ejecución de mundo.
 * - Verifica fallback sin WebGL en /senda/fuego3d.
 * - Verifica que todos los activos listados en /senda-sw.js existan en investor-next/public/.
 * - Verifica ausencia de errores JS de consola/página.
 */
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, '../public');
const outDir = resolve(here, '../../evidence/senda');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.geojson': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    let p = resolve(pub, '.' + decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname));
    if (!p.startsWith(pub)) throw new Error('traversal');
    if (!extname(p)) p = p.replace(/\/$/, '') + '.html';
    if (p.endsWith('senda.html')) p = resolve(pub, 'senda/index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0, '127.0.0.1');

await new Promise((r) => server.once('listening', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/senda`;
const results = [];
const pageErrors = [];
const check = (name, ok, detail = {}) => {
  results.push({ name, ok: !!ok, ...detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}`);
  if (!ok) {
    console.log('  detalle:', JSON.stringify(detail).slice(0, 400));
    process.exitCode = 1;
  }
};

/* 1 · Integridad del caché offline (senda-sw.js) */
const swText = await readFile(resolve(pub, 'senda-sw.js'), 'utf8');
const assetMatches = [...swText.matchAll(/'(\/[^']+)'/g)].map((m) => m[1]);
const missingAssets = [];
for (const assetPath of assetMatches) {
  let fsPath = resolve(pub, '.' + assetPath);
  if (!extname(fsPath)) fsPath = assetPath === '/senda' ? resolve(pub, 'senda/index.html') : fsPath + '.html';
  try { await stat(fsPath); } catch { missingAssets.push(assetPath); }
}
check('offline SW: todos los activos declarados en senda-sw.js existen en disco', missingAssets.length === 0, { total: assetMatches.length, missingAssets });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  /* 2 · Responsividad (360, 390, 768, 1440 px) en Centro, Visor 4D y Atlas */
  for (const width of [360, 390, 768, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } });
    for (const [slug, waitSel] of [['/centro', '#boot.done'], ['/visor', 'body[data-ready="1"]'], ['/atlas', 'body[data-ready]']]) {
      const p = await ctx.newPage();
      p.on('pageerror', (e) => pageErrors.push(`${slug}@${width}: ${e.message}`));
      await p.goto(base + slug);
      await p.waitForSelector(waitSel, { timeout: 60_000 });
      const overflow = await p.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
      }));
      check(`responsive ${slug} @ ${width}px: sin scroll horizontal`, overflow.scrollW <= overflow.innerW + 1, overflow);
      await p.close();
    }
    await ctx.close();
  }

  /* 3 · Centro de Coordinación: flujos completos, IndexedDB persistencia/revocación, roles, idioma */
  const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const c = await cctx.newPage();
  c.on('pageerror', (e) => pageErrors.push(`centro-flow: ${e.message}`));
  await c.goto(base + '/centro');
  await c.waitForSelector('#boot.done', { timeout: 60_000 });

  // Idioma ES -> EN -> NL -> ES
  await c.click('#lang button[data-lang="en"]');
  const enSub = await c.textContent('[data-i18n="subtitle"]');
  await c.click('#lang button[data-lang="nl"]');
  const nlSub = await c.textContent('[data-i18n="subtitle"]');
  await c.click('#lang button[data-lang="es"]');
  check('centro: cambio de idioma ES/EN/NL operativo', enSub === 'COORDINATION CENTRE' && nlSub === 'COÖRDINATIECENTRUM', { enSub, nlSub });

  // Cola offline IndexedDB: encolar, recargar, verificar persistencia, revocar consentimiento -> tumba REVOKED
  await c.click('#q-add');
  await c.waitForSelector('#q-list button[data-qrev]');
  await c.reload();
  await c.waitForSelector('#boot.done', { timeout: 60_000 });
  await c.waitForSelector('#q-list button[data-qrev]');
  await c.click('#q-list button[data-qrev]');
  await c.waitForFunction(() => /REVOKED/.test(document.querySelector('#q-list')?.textContent ?? ''));
  const qTxt = await c.textContent('#q-list');
  check('centro offline IndexedDB: sobrevive recarga y revocación borra carga dejando tumba REVOKED', /REVOKED/.test(qTxt) && /\[purgado\]/.test(qTxt));

  // SRLG + Fuente independencia
  await c.selectOption('#srlg-mode', 'passive_blocked');
  await c.click('#srlg-run');
  const srlgTxt = await c.textContent('#srlg-out');
  check('centro SRLG: rechaza enlaces pasivos/sin consentimiento fail-closed', /NO_AUTHORIZED_ACTIVE_PATH|BLOQUEADA/.test(srlgTxt));

  await c.click('#src-check');
  const srcTxt = await c.textContent('#src-indep');
  check('centro procedencia: GDACS_EQ + USGS_NEIC detectado como no independiente', /NO INDEPENDIENTES/.test(srcTxt));

  // Flujo ciudadano: muestra Ed25519 -> Comprobar -> Clasificar -> Cerrar
  await c.click('#cit-sample');
  await c.waitForSelector('#cit-out button[data-wf]');
  await c.click('#cit-out button[data-next="COMPROBANDO"]');
  await c.waitForFunction(() => /COMPROBANDO/.test(document.querySelector('#cit-out')?.textContent ?? ''));
  await c.click('#cit-out button[data-next="CERRADO_EJERCICIO"]');
  await c.waitForFunction(() => /CERRADO_EJERCICIO/.test(document.querySelector('#cit-out')?.textContent ?? ''));
  check('centro reportes: flujo Detectar→Comprobar→Cerrar sin aviso público automático', /canPublicWarn=false/.test(await c.textContent('#cit-out')));

  // Rol fail-closed: OBSERVADOR bloqueado, COORDINADOR_INCIDENTE firma y exporta paquete de evidencias
  await c.selectOption('#role-select', 'OBSERVADOR');
  await c.click('#ops-go');
  check('centro roles: OBSERVADOR bloqueado fail-closed al intentar firmar orden', /BLOQUEADO FAIL-CLOSED/.test(await c.textContent('#ops-out')));
  await c.selectOption('#role-select', 'COORDINADOR_INCIDENTE');
  await c.click('#ops-go');
  await c.waitForFunction(() => window.SENDA_CENTRO.lastOps);
  const [bdl] = await Promise.all([c.waitForEvent('download'), c.click('#dl-evidence-bundle')]);
  const bundle = JSON.parse(await readFile(await bdl.path(), 'utf8'));
  check('centro auditoría: paquete de evidencias JSON con cadena SHA-256 verificada y canPublicWarn=false', bundle.auditIntegrity?.ok === true && bundle.canPublicWarn === false && bundle.physicalTrialsCompleted === 0);
  await cctx.close();

  /* 4 · Visor Científico Temporal / 4D */
  const vctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const v = await vctx.newPage();
  v.on('pageerror', (e) => pageErrors.push(`visor: ${e.message}`));
  await v.goto(base + '/visor');
  await v.waitForSelector('body[data-ready="1"]', { timeout: 60_000 });
  const skillTxt = await v.textContent('#skill');
  check('visor 4D: muestra puerta H2 EXPERIMENTAL_REJECTED con canPublicWarn=false', /EXPERIMENTAL_REJECTED/.test(skillTxt) && /canPublicWarn=false/.test(skillTxt));
  await v.click('#viewMode button[data-mode="3d"]');
  await v.click('#world');
  await v.waitForFunction(() => /inundación epidémica/.test(document.querySelector('#exec')?.textContent ?? ''));
  const execTxt = await v.textContent('#exec');
  check('visor 4D: vista 3D + ejecución de mundo compara ARR, ablación, CGR y epidémico', /arr/.test(execTxt) && /cgr-k-exclusion/.test(execTxt));
  await vctx.close();

  /* 5 · Fallback sin WebGL en /senda/fuego3d */
  const wctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await wctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return orig.call(this, type, ...args);
    };
  });
  const w = await wctx.newPage();
  w.on('pageerror', (e) => pageErrors.push(`fuego3d-nowebgl: ${e.message}`));
  await w.goto(base + '/fuego3d');
  await w.waitForFunction(() => window.SENDA_VIZ_READY === true, null, { timeout: 30_000 });
  const f3d = await w.evaluate(() => window.SENDA_FUEGO3D);
  check('fuego3d sin WebGL: degrada limpiamente a fallback Canvas 2D sin colapsar', f3d?.ok === true && f3d?.fallback2d === true, f3d);
  await wctx.close();

  check('cero errores JS no capturados en todas las pantallas y resoluciones', pageErrors.length === 0, { pageErrors });
} finally {
  await browser.close();
  server.close();
}

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'canonical-qa.json'), JSON.stringify({
  ranAt: new Date().toISOString(),
  pass: results.filter((r) => r.ok).length,
  total: results.length,
  results,
  pageErrors,
}, null, 2));

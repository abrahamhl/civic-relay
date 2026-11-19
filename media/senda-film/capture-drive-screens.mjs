#!/usr/bin/env node
// Captura pantallas REALES de la app web (investor-next/public/senda) para la película SENDA Drive.
// Formato móvil vertical (390×820 CSS, 2×), igual que las demás capturas de assets/.
// Uso: node capture-drive-screens.mjs   → assets/drive-*.png
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const pub = path.join(repoRoot, 'investor-next', 'public');
const out = path.join(__dirname, 'assets');
const { chromium } = createRequire(path.join(repoRoot, 'investor-next', 'package.json'))('playwright');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const fp = path.join(pub, decodeURIComponent((req.url || '/').split('?')[0]));
  if (!fp.startsWith(pub) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/senda/`;

// [archivo, página, pestaña, panel a encuadrar, botón del panel a pulsar (escenario de EJERCICIO), espera ms]
const SHOTS = [
  ['drive-roadsafe-ciudadano.png', 'roadsafe.html', '#tab-c', '#p-c', null, 800],
  ['drive-roadsafe-carretera.png', 'roadsafe.html', '#tab-k', '#p-k', 'button', 4000],
  ['drive-roadsafe-lab.png', 'roadsafe.html', '#tab-r', '#p-r', null, 1500],
  ['drive-roadsafe-operador.png', 'roadsafe.html', '#tab-o', '#p-o', 'button', 4000],
  ['drive-roadsafe-viaje.png', 'roadsafe.html', '#tab-v', '#p-v', null, 1200],
  ['drive-carretera.png', 'carretera.html', null, null, null, 1200],
  ['drive-vehiculos.png', 'vehiculos.html', null, null, null, 1500],
  ['drive-camaras.png', 'camaras.html', null, null, null, 1500],
];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 2, locale: 'es-ES', isMobile: true, hasTouch: true, offline: false });
const log = [];
for (const [file, page, click, panel, run, wait] of SHOTS) {
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + page, { waitUntil: 'networkidle' });
  if (click) await p.click(click);
  if (run) { const b = p.locator(`${panel} ${run}`).first(); if (await b.count()) await b.click(); }
  await p.waitForTimeout(wait);
  if (panel) await p.evaluate((sel) => { const el = document.querySelector(sel); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8); }, panel);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(out, file) });
  log.push({ file, page, tab: click, panel, ran: run ? 'primer botón del panel (escenario de ejercicio)' : null, errors });
  console.log(`${file} ← ${page}${click ? ' ' + click : ''}${errors.length ? ' · errores: ' + errors.join(' | ') : ''}`);
  await p.close();
}
fs.writeFileSync(path.join(out, 'drive-screens.json'), JSON.stringify({ capturedFrom: 'investor-next/public/senda', viewport: '390x820@2x', shots: log }, null, 1) + '\n');
await browser.close(); srv.close();

#!/usr/bin/env node
// Capturas REALES de cada módulo para la portada de la app (no son ilustraciones):
//   node investor-next/scripts/module-previews.mjs   (necesita Playwright + Chromium y ffmpeg)
// Sirve investor-next/public en local, abre cada página como un Pixel 7 y guarda senda/previews/<page>.webp.
// Red: solo los servicios que la app también puede usar (mapa, rutas, ortofotos); el resto se bloquea.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', 'public'), out = path.join(root, 'senda', 'previews');
const pwPath = process.env.PLAYWRIGHT_PATH || path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright', 'index.mjs');
const { chromium, devices } = await import(pathToFileURL(pwPath).href);
const { MODULES } = await import(pathToFileURL(path.join(root, 'senda', 'core', 'app-catalog.mjs')).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); let f = path.join(root, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html'; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8771);
const allow = /^https:\/\/(tiles\.openfreemap\.org|router\.project-osrm\.org|routing\.openstreetmap\.de|service\.pdok\.nl|tms-pnoa-ma\.idee\.es|gibs\.earthdata\.nasa\.gov|tile\.opentopomap\.org|s3\.amazonaws\.com\/elevation-tiles-prod\/)/;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1, geolocation: { latitude: 51.9830, longitude: 5.9105, accuracy: 10 }, permissions: ['geolocation'] });
await ctx.addInitScript(() => { try { localStorage.setItem('senda.drive.welcomed', 'true'); localStorage.setItem('senda.f4d.welcomed', 'true'); } catch { /* */ } });
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => (allow.test(r.request().url()) ? r.continue() : r.abort()));
const only = process.argv.slice(2);
const done = [];
for (const m of MODULES) {
  const page = m.page === 'drive' ? 'conducir' : m.page;
  if (only.length && !only.includes(m.page)) continue;
  const url = `http://localhost:8771${page === 'index' ? '/senda/index.html' : `/senda/${page}.html`}`;
  const pg = await ctx.newPage();
  try {
    await pg.goto(url, { waitUntil: 'load', timeout: 20000 }); await pg.waitForTimeout(m.page === 'incendio4d' ? 9000 : 4000);
    const png = path.join(out, `${m.page}.png`);
    // Lo visual de cada pantalla: el mayor mapa, lienzo, 3D, vídeo, imagen o gráfico visible; si no hay, la cabecera.
    const box = await pg.evaluate(() => {
      const els = [...document.querySelectorAll('canvas, .maplibregl-map, video, svg, img')].filter((e) => !e.closest('#chrome,.chrome,header,nav'));
      let best = null, bestA = 0;
      for (const e of els) { const r = e.getBoundingClientRect(); const a = Math.min(r.width, 412) * Math.min(r.height, 700); if (r.width >= 200 && r.height >= 120 && a > bestA && getComputedStyle(e).visibility !== 'hidden') { best = e; bestA = a; } }
      if (!best) return null;
      best.scrollIntoView({ block: 'center' }); const r = best.getBoundingClientRect();
      return { y: Math.max(0, r.top + r.height / 2 - 170) };
    });
    await pg.waitForTimeout(box ? 1200 : 0);
    await pg.screenshot({ path: png, clip: { x: 0, y: box ? box.y : 48, width: 412, height: 340 } });
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-vf', 'scale=360:-1', '-c:v', 'libwebp', '-quality', '62', path.join(out, `${m.page}.webp`)]);
    fs.unlinkSync(png); done.push(m.page);
  } catch (e) { console.error('sin vista previa:', m.page, e.message.split('\n')[0]); }
  await pg.close();
}
console.log(`vistas previas: ${done.length}/${MODULES.length}`);
await b.close(); srv.close();

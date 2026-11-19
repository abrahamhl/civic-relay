#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const requireFromInvestor = createRequire(path.join(repoRoot, 'investor-next', 'package.json'));
const { chromium } = requireFromInvestor('playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startServer() {
  const pubRoot = path.join(repoRoot, 'investor-next', 'public');
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = u.startsWith('/senda/') ? path.join(pubRoot, u) : path.join(__dirname, u);
    if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) filePath += '.html';
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

const targets = [
  { script: 'm95-broadcast-special', lang: 'es', t: 4.5, out: 'senda-m95-broadcast-special-poster.jpg', vertical: false },
  { script: 'm95-role-investor', lang: 'es', t: 3.5, out: 'senda-m95-role-investor-poster.jpg', vertical: false },
  { script: 'm95-role-developer', lang: 'es', t: 3.5, out: 'senda-m95-role-developer-poster.jpg', vertical: false },
  { script: 'm95-role-citizen', lang: 'es', t: 3.5, out: 'senda-m95-role-citizen-poster.jpg', vertical: false },
  { script: 'm95-reel-blacksky', lang: 'es', t: 2.5, out: 'senda-m95-reel-blacksky-poster.jpg', vertical: true },
  { script: 'm95-reel-drones', lang: 'es', t: 2.5, out: 'senda-m95-reel-drones-poster.jpg', vertical: true },
  { script: 'm95-reel-math', lang: 'es', t: 2.5, out: 'senda-m95-reel-math-poster.jpg', vertical: true },
  { script: 'm95-reel-defense', lang: 'es', t: 2.5, out: 'senda-m95-reel-defense-poster.jpg', vertical: true },
];

async function main() {
  const srv = await startServer();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
  const destDir = path.join(repoRoot, 'investor-next', 'public', 'media', 'm95');
  fs.mkdirSync(destDir, { recursive: true });

  for (const item of targets) {
    const vpW = item.vertical ? 720 : 1280;
    const vpH = item.vertical ? 1280 : 720;
    const ctx = await browser.newContext({ viewport: { width: vpW, height: vpH }, deviceScaleFactor: 1.5 });
    const page = await ctx.newPage();
    page.on('console', (msg) => console.log(`  [PAGE:${msg.type()}]`, msg.text()));
    page.on('pageerror', (err) => console.error('  [PAGE ERROR]', err));
    const url = `http://127.0.0.1:${port}/film.html?script=${encodeURIComponent(item.script)}&lang=${item.lang}${item.vertical ? '&vertical=1' : ''}`;
    console.log(`Loading ${item.script} (${item.vertical ? '9:16' : '16:9'})…`);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
    await page.evaluate((t) => window.seek(t), item.t);
    await new Promise((r) => setTimeout(r, 200));
    const outPath = path.join(destDir, item.out);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
    console.log(`=> Captured poster: ${item.out}`);
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log('All posters generated successfully!');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Render determinista de la película SENDA v5 (1280×720, 25 fps, H.264 + AAC) por idioma.
 *   LANG=es CORE=78 E2E=23 node render.mjs          → out/senda-film-es.mp4
 *   node render.mjs --stills es 3,40,90              → out/stills-<lang>/t-<s>.png
 * Requisitos: python3 -I voice.py … <lang> antes (out/voice-<lang>.wav, out/timeline-<lang>.js).
 */
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'out'); mkdirSync(out, { recursive: true });
const FPS = +(process.env.FPS || 25), JOBS = +(process.env.JOBS || 3), SCRIPT = process.env.SCRIPT || 'script', PFX = SCRIPT === 'script' ? '' : `${SCRIPT}-`, NAME = SCRIPT === 'script' ? 'film' : SCRIPT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
const pub = resolve(here, '../../investor-next/public'); // núcleo real y three.js servidos en /senda/

function serve() {
  return new Promise((res) => {
    const s = createServer(async (req, rsp) => {
      try { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), root = u.startsWith('/senda/') ? pub : here; let p = resolve(root, '.' + u); if (!p.startsWith(root)) throw 0; if (!extname(p)) p += '.html'; const b = await readFile(p); rsp.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }); rsp.end(b); }
      catch { rsp.writeHead(404); rsp.end(); }
    }).listen(0, () => res(s));
  });
}
async function openPage(lang) {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/film.html?lang=${lang}&script=${SCRIPT}&core=${process.env.CORE || 0}&e2e=${process.env.E2E || 0}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
  if (errors.length) throw new Error(errors.join('\n'));
  return { browser, page, srv };
}

const st = process.argv.indexOf('--stills');
if (st > -1) {
  const lang = process.argv[st + 1]; const { browser, page, srv } = await openPage(lang);
  const dir = resolve(out, `stills-${lang}`); mkdirSync(dir, { recursive: true });
  for (const s of process.argv[st + 2].split(',').map(Number)) { await page.evaluate((t) => window.seek(t), s); await page.screenshot({ path: resolve(dir, `t-${String(s).padStart(3, '0')}.png`) }); }
  await browser.close(); srv.close(); process.exit(0);
}
const ch = process.argv.indexOf('--chunk');
if (ch > -1) {
  const [lang, i, from, to] = [process.argv[ch + 1], ...process.argv.slice(ch + 2, ch + 5).map(Number)];
  const { browser, page, srv } = await openPage(lang);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', resolve(out, `chunk-${PFX}${lang}-${i}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - from) % (FPS * 20) === 0) console.log(`[${lang}${i}] ${f - from}/${to - from} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await browser.close(); srv.close(); process.exit(0);
}

const lang = process.env.LANG_FILM || process.argv[2] || 'es';
const voice = resolve(out, `voice-${PFX}${lang}.wav`);
if (!existsSync(voice)) throw new Error(`Falta ${voice}`);
const { browser, page, srv } = await openPage(lang); const duration = await page.evaluate(() => window.DURATION); await browser.close(); srv.close();
const music = resolve(out, `music-${PFX}${lang}.wav`);
execFileSync('python3', [resolve(here, '../promo-video/music.py'), music, String(duration)], { stdio: 'inherit' });
const total = Math.round(duration * FPS), per = Math.ceil(total / JOBS);
await Promise.all([...Array(JOBS)].map((_, i) => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--chunk', lang, String(i), String(i * per), String(Math.min(total, (i + 1) * per))], { stdio: 'inherit', env: process.env });
  p.on('close', (c) => (c === 0 ? ok() : ko(new Error('tramo ' + i))));
})));
writeFileSync(resolve(out, `chunks-${PFX}${lang}.txt`), [...Array(JOBS)].map((_, i) => `file 'chunk-${PFX}${lang}-${i}.mp4'`).join('\n'));
const target = resolve(out, `senda-${NAME}-${lang}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', resolve(out, `chunks-${PFX}${lang}.txt`), '-i', voice, '-i', music,
  '-filter_complex', '[1:a]aresample=48000,pan=stereo|c0=c0|c1=c0,asplit=2[v][sc];[2:a]aresample=48000,volume=0.5[m];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[v][md]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', target], { stdio: 'inherit' });
console.log('OK →', target);

#!/usr/bin/env node
/**
 * Render determinista de la película (16:9 → 1920×1080) y los reels (9:16 → 1080×1920), 25 fps,
 * H.264 + AAC. Requiere antes: python3 -I voice.py … <lang>  (out/voice-*.wav, out/timeline-*.js).
 *   node render.mjs investor es        → out/investor-es.mp4
 *   node render.mjs --still investor es 12.5 → out/still-investor-es.png
 * Sirve investor-next/public (demos y núcleo), media/senda-promo (/promo) y evidence (/evidence).
 */
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/package.json'))('playwright');
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..'), out = resolve(here, 'out'); mkdirSync(out, { recursive: true });
const FPS = 25, JOBS = +(process.env.JOBS || 3);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const map = (u) => (u.startsWith('/promo/') ? resolve(here, '.' + u.slice(6)) : u.startsWith('/evidence/') ? resolve(root, '.' + u) : resolve(root, 'investor-next/public', '.' + u));
const serve = () => new Promise((ok) => { const s = createServer(async (req, res) => { try { const b = await readFile(map(decodeURIComponent(new URL(req.url, 'http://x').pathname))); res.writeHead(200, { 'content-type': MIME[extname(req.url.split('?')[0])] ?? 'application/octet-stream' }); res.end(b); } catch { if (!res.headersSent) res.writeHead(404); res.end(); } }).listen(0, () => ok(s)); });
const fmt = (video) => JSON.parse(readFileSync(resolve(here, 'scripts.json'), 'utf8')).videos[video].format;
async function openPage(video, lang) {
  const srv = await serve(), browser = await chromium.launch(), f9 = fmt(video) === '9x16';
  const page = await browser.newPage({ viewport: f9 ? { width: 540, height: 960 } : { width: 1280, height: 720 }, deviceScaleFactor: f9 ? 2 : 1.5 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/promo/promo.html?video=${video}&lang=${lang}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  if (errors.length) throw new Error(errors.join('\n'));
  return { browser, page, srv };
}
const a = process.argv.slice(2);
if (a[0] === '--still') {
  const [, video, lang, ...ts] = a; const { browser, page, srv } = await openPage(video, lang);
  for (const t of ts) { await page.evaluate((t) => window.seek(t), +t); await page.screenshot({ path: resolve(out, `still-${video}-${lang}-${t}.png`) }); }
  await browser.close(); srv.close(); process.exit(0);
}
if (a[0] === '--chunk') {
  const [, video, lang, i, from, to] = a; const { browser, page, srv } = await openPage(video, lang);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', resolve(out, `chunk-${video}-${lang}-${i}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = +from; f < +to; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await browser.close(); srv.close(); process.exit(0);
}
const [video, lang] = a;
const { browser, page, srv } = await openPage(video, lang); const duration = await page.evaluate(() => window.DURATION); await browser.close(); srv.close();
const music = resolve(out, `music-${video}-${lang}.wav`), voice = resolve(out, `voice-${video}-${lang}.wav`);
execFileSync('python3', ['-I', resolve(root, 'media/promo-video/music.py'), music, String(duration + 0.5)], { stdio: 'inherit' });
const total = Math.ceil(duration * FPS), per = Math.ceil(total / JOBS), t0 = Date.now();
await Promise.all([...Array(JOBS)].map((_, i) => new Promise((ok, ko) => { const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--chunk', video, lang, String(i), String(i * per), String(Math.min(total, (i + 1) * per))], { stdio: 'inherit' }); p.on('close', (c) => (c === 0 ? ok() : ko(new Error('tramo ' + i)))); })));
writeFileSync(resolve(out, `chunks-${video}-${lang}.txt`), [...Array(JOBS)].map((_, i) => `file 'chunk-${video}-${lang}-${i}.mp4'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', resolve(out, `chunks-${video}-${lang}.txt`), '-i', voice, '-i', music,
  '-filter_complex', '[1:a]aresample=48000,pan=stereo|c0=c0|c1=c0,asplit=2[v][sc];[2:a]aresample=48000,volume=0.45[m];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[v][md]amix=inputs=2:duration=first:normalize=0[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', resolve(out, `${video}-${lang}.mp4`)], { stdio: 'inherit' });
console.log(`OK ${video}-${lang} · ${duration.toFixed(1)} s · ${((Date.now() - t0) / 1000).toFixed(0)} s de render`);

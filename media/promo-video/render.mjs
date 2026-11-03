#!/usr/bin/env node
/**
 * Renderiza film.html a MP4 1080p de forma determinista.
 *   node render.mjs                      → out/civic-relay-promo.mp4 (30 fps, con música)
 *   node render.mjs --stills 5,70,120    → out/stills/t-<s>.png (revisión rápida)
 *   FPS=24 node render.mjs               → otro framerate
 * Requisitos: Playwright con Chromium y ffmpeg en PATH. Música: python3 music.py (numpy).
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'out');
mkdirSync(out, { recursive: true });
const FPS = Number(process.env.FPS || 30);
const url = pathToFileURL(resolve(here, 'film.html')).href + '?render=1';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(url);
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);

const stillsArg = process.argv.indexOf('--stills');
if (stillsArg > -1) {
  mkdirSync(resolve(out, 'stills'), { recursive: true });
  for (const s of process.argv[stillsArg + 1].split(',').map(Number)) {
    await page.evaluate((t) => window.seek(t), s);
    await page.screenshot({ path: resolve(out, 'stills', `t-${String(s).padStart(3, '0')}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const music = resolve(out, 'music.wav');
if (!existsSync(music)) execFileSync('python3', [resolve(here, 'music.py'), music, String(duration)], { stdio: 'inherit' });

const target = resolve(out, 'civic-relay-promo.mp4');
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', music,
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '160k', '-shortest',
  target,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round(duration * FPS);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % (FPS * 10) === 0) process.stdout.write(`frame ${i}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log('OK →', target);

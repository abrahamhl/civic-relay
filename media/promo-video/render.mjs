#!/usr/bin/env node
/**
 * Renderiza film.html a MP4 1080p de forma determinista, en paralelo por tramos.
 *   node render.mjs                     → out/civic-relay-promo.mp4 (+ versión subtitulada)
 *   node render.mjs --stills 5,70,120   → out/stills/t-<s>.png
 *   JOBS=3 FPS=30 node render.mjs
 * Requisitos: Playwright + Chromium (WebGL por SwiftShader), ffmpeg con libass, python3 + numpy.
 * Antes: python3 -I voice.py <kokoro.onnx> <voices.npz>  (genera out/voice.wav y timeline.js)
 */
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'out');
mkdirSync(out, { recursive: true });
const FPS = Number(process.env.FPS || 30);
const JOBS = Number(process.env.JOBS || 3);
const url = pathToFileURL(resolve(here, 'film.html')).href + '?render=1';
const LAUNCH = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

async function openPage() {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  if (errors.length) throw new Error('Errores en film.html:\n' + errors.join('\n'));
  return { browser, page };
}

const stillsArg = process.argv.indexOf('--stills');
if (stillsArg > -1) {
  const { browser, page } = await openPage();
  mkdirSync(resolve(out, 'stills'), { recursive: true });
  for (const s of process.argv[stillsArg + 1].split(',').map(Number)) {
    await page.evaluate((t) => window.seek(t), s);
    await page.screenshot({ path: resolve(out, 'stills', `t-${String(s).padStart(3, '0')}.png`) });
  }
  await browser.close();
  process.exit(0);
}

// Tramo: node render.mjs --chunk <i> <from> <to>
const chunkArg = process.argv.indexOf('--chunk');
if (chunkArg > -1) {
  const [i, from, to] = process.argv.slice(chunkArg + 1, chunkArg + 4).map(Number);
  const { browser, page } = await openPage();
  const target = resolve(out, `chunk-${i}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', target], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - from) % (FPS * 15) === 0) console.log(`[${i}] ${f - from}/${to - from} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log(`[${i}] OK`);
  process.exit(0);
}

// Orquestador
const { browser, page } = await openPage();
const duration = await page.evaluate(() => window.DURATION);
await browser.close();
const voice = resolve(out, 'voice.wav');
if (!existsSync(voice)) throw new Error('Falta out/voice.wav: ejecuta voice.py primero.');
const music = resolve(out, 'music.wav');
execFileSync('python3', [resolve(here, 'music.py'), music, String(duration)], { stdio: 'inherit' });

const total = Math.round(duration * FPS);
const per = Math.ceil(total / JOBS);
await Promise.all([...Array(JOBS)].map((_, i) => new Promise((res, rej) => {
  const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--chunk', String(i), String(i * per), String(Math.min(total, (i + 1) * per))], { stdio: 'inherit' });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error('chunk ' + i + ' falló'))));
})));
writeFileSync(resolve(out, 'chunks.txt'), [...Array(JOBS)].map((_, i) => `file 'chunk-${i}.mp4'`).join('\n'));

const target = resolve(out, 'civic-relay-promo.mp4');
// Voz al frente; música con compresión lateral (baja cuando habla la voz)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', resolve(out, 'chunks.txt'), '-i', voice, '-i', music,
  '-filter_complex', '[1:a]aresample=48000,pan=stereo|c0=c0|c1=c0,volume=1.0,asplit=2[v][sc];[2:a]aresample=48000,volume=0.55[m];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[v][md]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', target], { stdio: 'inherit' });
const subbed = resolve(out, 'civic-relay-promo-subtitulado.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', target, '-vf',
  `subtitles=${resolve(here, 'subtitles.es.srt')}:force_style='FontName=Inter,FontSize=9,PrimaryColour=&H00F4F4F2,OutlineColour=&H99000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=14'`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'copy', '-movflags', '+faststart', subbed], { stdio: 'inherit' });
console.log('OK →', target, '\nOK →', subbed);

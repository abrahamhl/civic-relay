#!/usr/bin/env node
// Graba cinema.html (película de inversores, motor 3D) a MP4 1080p con voz, música y subtítulos.
// Antes: node build-investor-film.mjs && python3 voice.py investor-film en
// Uso:
//   node render-cinema.mjs                      # película completa (voz en, subtítulos es quemados + pistas es/en)
//   STILLS=5,20,33 node render-cinema.mjs --stills   # fotogramas de control en build/
//   JOBS=4 FPS=25 SUBS=es node render-cinema.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const mediaRoot = path.resolve(__dirname, '..');
const NAME = process.env.SCRIPT || 'investor-film', lang = 'en';
const FPS = Number(process.env.FPS || 25), JOBS = Number(process.env.JOBS || 4), SUBS = process.env.SUBS ?? 'es';
const args = process.argv.slice(2), buildDir = path.join(__dirname, 'build');

function loadPlaywright() {
  for (const base of [path.join(repoRoot, 'investor-next', 'package.json'), import.meta.url]) { try { return createRequire(base)('playwright'); } catch {} }
  throw new Error('playwright no encontrado');
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
function startServer() {
  const srv = http.createServer((req, res) => {
    const fp = path.join(mediaRoot, decodeURIComponent((req.url || '/').split('?')[0]));
    if (!fp.startsWith(mediaRoot) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}
async function openPage() {
  const { chromium } = loadPlaywright(), srv = await startServer();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--force-color-profile=srgb'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 })).newPage();
  page.on('pageerror', (e) => { console.error('[page]', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[')) console.log('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/senda-film/cinema.html?script=${NAME}&lang=${lang}&subs=${encodeURIComponent(SUBS)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  return { browser, page, srv };
}

const timings = JSON.parse(fs.readFileSync(path.join(buildDir, `timings-${NAME}-${lang}.json`), 'utf8'));
const script = JSON.parse(fs.readFileSync(path.join(__dirname, `${NAME}.json`), 'utf8'));

if (args[0] === '--chunk') {
  const [, w, from, to] = args.map(Number);
  const { browser, page, srv } = await openPage();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-color_range', 'tv', '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1',
    '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), path.join(buildDir, `chunk-${NAME}-${w}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - from) % 250 === 249) console.log(`  [w${w}] ${f - from + 1}/${to - from} (${((Date.now() - t0) / (f - from + 1)).toFixed(0)} ms/fotograma)`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  await browser.close(); srv.close(); process.exit(process.exitCode || 0);
}

if (args.includes('--stills')) {
  const { browser, page, srv } = await openPage(), t0 = Date.now(), list = (process.env.STILLS || '5,20,33,50,61,72,95,108,128,146,165,195,210,235,250').split(',').map(Number);
  for (const t of list) { await page.evaluate((x) => window.seek(x), t); await page.screenshot({ path: path.join(buildDir, `still-${String(t).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 90 }); }
  console.log(`${list.length} fotogramas en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await browser.close(); srv.close(); process.exit(process.exitCode || 0);
}

// Subtítulos ES y EN sobre los tiempos de la voz (máx. 2 líneas × 42 caracteres)
const ts = (t) => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`;
function wrap(text) {
  if (text.length <= 42) return text;
  const w = text.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '); if (a.length <= 42 && b.length <= 42 && (!best || Math.abs(a.length - b.length) < best.d)) best = { d: Math.abs(a.length - b.length), s: `${a}\n${b}` }; }
  if (!best) throw new Error(`subtítulo no cabe en 2×42: "${text}"`);
  return best.s;
}
const vtt = (sl) => path.join(buildDir, `senda-${NAME}.${sl}.vtt`);
for (const sl of ['es', 'en']) {
  const out = ['WEBVTT', '']; let n = 1;
  timings.scenes.forEach((s, i) => s.lines.forEach((ln, k) => out.push(String(n++), `${ts(ln.start)} --> ${ts(ln.end)}`, wrap(script.scenes[i][sl][k]), '')));
  fs.writeFileSync(vtt(sl), out.join('\n'), 'utf8');
}

const duration = timings.totalDuration, totalFrames = Math.ceil(duration * FPS);
const music = path.join(buildDir, `music-${NAME}.wav`);
if (!fs.existsSync(music)) {
  const cuts = timings.scenes.map((s) => s.start.toFixed(2)).join(','), drop = timings.scenes.find((s) => s.visual.kind === 'title')?.start ?? 0;
  execFileSync(process.env.PYTHON || 'python3', [path.join(__dirname, 'music-techno.py'), music, String(duration), String(drop), cuts], { stdio: 'inherit' });
}
console.log(`[${NAME}] ${totalFrames} fotogramas (${duration.toFixed(1)} s @ ${FPS} fps) · ${JOBS} procesos`);
const per = Math.ceil(totalFrames / JOBS), t0 = Date.now();
await Promise.all(Array.from({ length: JOBS }, (_, w) => new Promise((resolve, reject) => {
  const ch = spawn(process.execPath, [fileURLToPath(import.meta.url), '--chunk', String(w), String(w * per), String(Math.min(totalFrames, (w + 1) * per))], { stdio: 'inherit', env: process.env });
  ch.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`proceso ${w} salió con ${c}`))));
})));
console.log(`  fotogramas listos en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
const list = path.join(buildDir, `chunks-${NAME}.txt`);
fs.writeFileSync(list, Array.from({ length: JOBS }, (_, w) => `file 'chunk-${NAME}-${w}.mp4'`).join('\n') + '\n');
const out = path.join(buildDir, `senda-${NAME}-en.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
  '-i', path.join(buildDir, `voice-${NAME}-${lang}.wav`), '-i', music, '-i', vtt('es'), '-i', vtt('en'),
  '-filter_complex', '[1:a]aresample=48000,pan=stereo|c0=c0|c1=c0,asplit=2[v][sc];[2:a]aresample=48000,volume=0.6[m];[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=450[md];[v][md]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]',
  '-map', '0:v', '-map', '[a]', '-map', '3:0', '-map', '4:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-c:s', 'mov_text',
  '-metadata:s:a:0', 'language=eng', '-metadata:s:s:0', 'language=spa', '-metadata:s:s:1', 'language=eng', '-movflags', '+faststart', '-t', String(duration), out], { stdio: 'inherit' });
for (let w = 0; w < JOBS; w++) fs.rmSync(path.join(buildDir, `chunk-${NAME}-${w}.mp4`), { force: true });
fs.rmSync(list, { force: true });
console.log(`=> ${out} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);

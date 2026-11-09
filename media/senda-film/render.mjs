#!/usr/bin/env node
// Renderizador determinista de los vídeos SENDA v5 / M95 (Playwright + ffmpeg image2pipe + música ambiental).
// Uso:
//   node render.mjs [script=m95-film] [lang=en]
//   BURNSUB=en node render.mjs m95-vertical-45s en
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
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
  '.vtt': 'text/vtt; charset=utf-8',
};

function startServer() {
  const pubRoot = path.join(repoRoot, 'investor-next', 'public');
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath;
    if (u.startsWith('/senda/')) {
      filePath = path.join(pubRoot, u);
      if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) filePath += '.html';
    } else {
      filePath = path.join(__dirname, u);
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404); res.end('not found: ' + u); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

function getEstadoNumbers() {
  const estadoPath = path.join(repoRoot, 'investor-next', 'public', 'senda', 'estado.json');
  let core = 266, e2e = 49, pci = 13;
  if (fs.existsSync(estadoPath)) {
    try {
      const est = JSON.parse(fs.readFileSync(estadoPath, 'utf8'));
      core = est.tests?.core?.passed || core;
      e2e = est.tests?.e2e?.passed || e2e;
    } catch {}
  }
  return { core, e2e, pci };
}

const FPS = Number(process.env.FPS || 25);
const JOBS = Number(process.env.JOBS || 3);
const BURNSUB = process.env.BURNSUB || '';

async function openFilmPage(scriptName, lang, fromFrame = null, toFrame = null) {
  const isVertical = scriptName.includes('vertical') || process.env.VERTICAL === '1';
  const vpW = isVertical ? 720 : 1280;
  const vpH = isVertical ? 1280 : 720;
  const { core, e2e, pci } = getEstadoNumbers();
  const srv = await startServer();
  const port = srv.address().port;
  const browser = await chromium.launch({
    args: ['--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({
    viewport: { width: vpW, height: vpH },
    deviceScaleFactor: 1.5,
  });
  const page = await ctx.newPage();
  const sliceQ = (fromFrame != null && toFrame != null) ? `&t0=${(fromFrame / FPS).toFixed(2)}&t1=${(toFrame / FPS).toFixed(2)}` : '';
  const url = `http://127.0.0.1:${port}/film.html?script=${encodeURIComponent(scriptName)}&lang=${lang}&core=${core}&e2e=${e2e}&pci=${pci}${isVertical ? '&vertical=1' : ''}${BURNSUB ? `&burnsub=${encodeURIComponent(BURNSUB)}` : ''}${sliceQ}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.READY === true, null, { timeout: 45000 });
  return { browser, page, srv, isVertical };
}

const chIdx = process.argv.indexOf('--chunk');
if (chIdx > -1) {
  const scriptName = process.argv[chIdx + 1];
  const lang = process.argv[chIdx + 2];
  const workerId = Number(process.argv[chIdx + 3]);
  const fromFrame = Number(process.argv[chIdx + 4]);
  const toFrame = Number(process.argv[chIdx + 5]);
  const buildDir = path.join(__dirname, 'build');
  const subSuffix = BURNSUB ? `-sub-${BURNSUB}` : '';
  const chunkMp4 = path.join(buildDir, `chunk-${scriptName}-${lang}${subSuffix}-${workerId}.mp4`);

  const { browser, page, srv } = await openFilmPage(scriptName, lang, fromFrame, toFrame);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p',
    '-color_range', 'tv',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1',
    '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    chunkMp4,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const t0 = Date.now();
  for (let f = fromFrame; f < toFrame; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - fromFrame) > 0 && (f - fromFrame) % (FPS * 25) === 0) {
      console.log(`  [${scriptName}:w${workerId}] ${f - fromFrame}/${toFrame - fromFrame} frames (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  srv.close();
  process.exit(0);
}

const scriptName = process.argv[2] || process.env.SCRIPT || 'm95-film';
const lang = process.argv[3] || process.env.LANG_FILM || 'en';
const isVertical = scriptName.includes('vertical') || process.env.VERTICAL === '1';
const outW = isVertical ? 1080 : 1920;
const outH = isVertical ? 1920 : 1080;

const buildDir = path.join(__dirname, 'build');
fs.mkdirSync(buildDir, { recursive: true });
const timingsPath = path.join(buildDir, `timings-${scriptName}-${lang}.json`);
const wavPath = path.join(buildDir, `voice-${scriptName}-${lang}.wav`);
if (!fs.existsSync(timingsPath) || !fs.existsSync(wavPath)) {
  console.error(`Missing ${timingsPath} or ${wavPath}. Run voice.py first.`);
  process.exit(1);
}

const timings = JSON.parse(fs.readFileSync(timingsPath, 'utf8'));
const duration = timings.totalDuration;
const totalFrames = Math.ceil(duration * FPS);
const subSuffix = BURNSUB ? `-sub-${BURNSUB}` : '';

console.log(`[${scriptName}:${lang}${subSuffix}] rendering ${totalFrames} frames (${duration.toFixed(2)}s @ ${FPS}fps, ${outW}x${outH}) across ${JOBS} workers…`);

// Generate deterministic ambient music if not cached
const musicPath = path.join(buildDir, `music-${scriptName}-${lang}.wav`);
if (!fs.existsSync(musicPath)) {
  const venvPyWin = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
  const venvPyUnix = path.join(__dirname, '.venv', 'bin', 'python');
  const pyBin = fs.existsSync(venvPyWin) ? venvPyWin : (fs.existsSync(venvPyUnix) ? venvPyUnix : 'python');
  execFileSync(pyBin, [path.join(repoRoot, 'media', 'promo-video', 'music.py'), musicPath, String(duration)], {
    stdio: 'inherit',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
}

const t0 = Date.now();
const perWorker = Math.ceil(totalFrames / JOBS);
await Promise.all(
  Array.from({ length: JOBS }, (_, w) => new Promise((resolve, reject) => {
    const fromF = w * perWorker;
    const toF = Math.min(totalFrames, (w + 1) * perWorker);
    if (fromF >= toF) { resolve(); return; }
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), '--chunk', scriptName, lang, String(w), String(fromF), String(toF)],
      { stdio: 'inherit', env: process.env }
    );
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`chunk worker ${w} exited ${code}`))));
  }))
);

console.log(`  chunks ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const activeWorkers = Array.from({ length: JOBS }, (_, w) => w).filter((w) => w * perWorker < totalFrames);
const concatListPath = path.join(buildDir, `chunks-${scriptName}-${lang}${subSuffix}.txt`);
const tsFiles = activeWorkers.map((w) => {
  const mp4 = path.join(buildDir, `chunk-${scriptName}-${lang}${subSuffix}-${w}.mp4`);
  const ts = path.join(buildDir, `chunk-${scriptName}-${lang}${subSuffix}-${w}.ts`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', mp4,
    '-c', 'copy', '-bsf:v', 'h264_mp4toannexb', '-f', 'mpegts', ts,
  ], { stdio: 'inherit' });
  return ts;
});
fs.writeFileSync(
  concatListPath,
  tsFiles.map((f) => `file '${path.basename(f)}'`).join('\n') + '\n',
  'utf8'
);

const outTag = scriptName === 'script' ? 'film' : scriptName;
const outMp4 = path.join(buildDir, `senda-${outTag}-${lang}${subSuffix}.mp4`);

execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'concat', '-safe', '0', '-i', concatListPath,
  '-i', wavPath,
  '-i', musicPath,
  '-filter_complex',
  '[1:a]aresample=48000,pan=stereo|c0=c0|c1=c0,asplit=2[v][sc];[2:a]aresample=48000,volume=0.42[m];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[v][md]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]',
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-movflags', '+faststart',
  '-shortest',
  outMp4,
], { stdio: 'inherit' });

for (const w of activeWorkers) {
  fs.rmSync(path.join(buildDir, `chunk-${scriptName}-${lang}${subSuffix}-${w}.mp4`), { force: true });
}
for (const f of tsFiles) fs.rmSync(f, { force: true });
fs.rmSync(concatListPath, { force: true });

const sz = (fs.statSync(outMp4).size / (1024 * 1024)).toFixed(2);
console.log(`=> ${outMp4} (${sz} MB)`);

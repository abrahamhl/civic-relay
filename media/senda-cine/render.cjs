// Render final: JOBS procesos de Chromium; cada uno manda sus fotogramas a su propio ffmpeg (sin escribir JPEG en disco),
// luego se concatenan los tramos y se mezclan voz + música. Uso: JOBS=4 FPS=25 node render.cjs <script>
const http = require('http'), fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..'), FILM = path.join(ROOT, 'media/senda-film'), OUT = path.join(ROOT, 'investor-next/public/media/cine');
const NAME = process.argv[2], FPS = Number(process.env.FPS || 25), JOBS = Number(process.env.JOBS || 4);
const TL = JSON.parse(fs.readFileSync(path.join(FILM, `build/timings-${NAME}-es.json`), 'utf8')); const DUR = TL.totalDuration, N = Math.ceil(DUR * FPS);
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const tmp = path.join(FILM, 'build', `cine-${NAME}`); fs.mkdirSync(tmp, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const port = srv.address().port, t0 = Date.now(); let done = 0;
  const job = async (w) => {
    const a = Math.floor((N * w) / JOBS), b = Math.floor((N * (w + 1)) / JOBS);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), path.join(tmp, `part-${w}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'] });
    const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } }); pg.on('pageerror', (e) => { console.error('[page]', e.message); process.exitCode = 1; });
    await pg.goto(`http://127.0.0.1:${port}/media/senda-cine/cine.html?script=${NAME}`); await pg.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
    for (let f = a; f < b; f++) { await pg.evaluate((t) => window.seek(t), f / FPS); const buf = await pg.screenshot({ type: 'jpeg', quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); done++; if (done % 250 === 0) console.log(`${done}/${N} · ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await br.close();
  };
  if (!process.argv.includes('--finalize')) await Promise.all([...Array(JOBS).keys()].map(job)); srv.close();
  try {
  fs.writeFileSync(path.join(tmp, 'list.txt'), [...Array(JOBS).keys()].map((w) => `file 'part-${w}.mp4'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', path.join(tmp, 'video.mp4')]);
  execFileSync('python3', [path.join(ROOT, 'media/promo-video/music.py'), path.join(tmp, 'music.wav'), String(Math.ceil(DUR + 1))]);
  const outMp4 = path.join(OUT, `senda-${NAME}-es.mp4`);
  // Voz al frente; música baja con compresión lateral (se aparta cuando habla la voz).
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(tmp, 'video.mp4'), '-i', path.join(FILM, `build/voice-${NAME}-es.wav`), '-i', path.join(tmp, 'music.wav'),
    '-filter_complex', '[1:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[v][sc];[2:a]aresample=48000,volume=0.22[m];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[v][md]amix=inputs=2:duration=first:normalize=0[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(process.env.CRF || 25), '-pix_fmt', 'yuv420p', '-tune', 'animation', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', outMp4]);
  fs.copyFileSync(path.join(FILM, `build/subtitles-${NAME}-es.vtt`), path.join(OUT, `senda-${NAME}-es.vtt`));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.min(12, DUR / 3)), '-i', outMp4, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', path.join(OUT, `senda-${NAME}-poster.jpg`)]);
  console.log(`=> ${outMp4} · ${(fs.statSync(outMp4).size / 1048576).toFixed(1)} MB · ${DUR.toFixed(1)} s · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  } catch (e) { console.error('FALLO:', e.message, String(e.stderr || '').slice(0, 2000)); process.exit(1); }
});

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(here, '../..');
const require = createRequire(resolve(root, 'investor-next/package.json'));
const { chromium } = require('playwright');

const ALL = ['mensaje', 'edificio', 'dron', 'ojo', 'incendio', 'agua', 'sentidos', 'arquitectura', 'triaje'];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

function arg(name, fallback = null) {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  if (hit === `--${name}`) return true;
  return hit.slice(name.length + 3);
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function serve() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        const pathname = decodeURIComponent(url.pathname);
        const target = normalize(join(root, pathname));
        if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'Cross-Origin-Opener-Policy': 'same-origin',
        });
        createReadStream(target).pipe(res);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    });
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '';
    let err = '';
    p.stdout?.on('data', (d) => (out += d.toString()));
    p.stderr?.on('data', (d) => (err += d.toString()));
    p.on('error', rejectRun);
    p.on('close', (code) => {
      if (code === 0) resolveRun({ out, err });
      else rejectRun(new Error(`${cmd} exited ${code}\n${err.slice(-4000)}`));
    });
  });
}

async function makeMusic(duration, outPath, seed) {
  const py = process.env.PYTHON || 'python';
  await run(py, [join(here, 'music.py'), `--duration=${duration}`, `--out=${outPath}`, `--seed=${seed}`], { cwd: here });
}

async function ffprobe(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', file]);
  return JSON.parse(out);
}

async function openScene(browser, port, id) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  const url = `http://127.0.0.1:${port}/media/senda-features/index.html?scene=${encodeURIComponent(id)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.READY === true || typeof window.ERROR === 'string', null, { timeout: 120000 });
  const error = await page.evaluate(() => window.ERROR || null);
  if (error) throw new Error(`${id}: ${error}\n${errors.join('\n')}`);
  const info = await page.evaluate(() => ({ duration: window.DURATION, title: window.sceneMeta?.title || '', id: window.sceneMeta?.id || '' }));
  return { page, info, errors };
}

async function stills(browser, port, id, times, outDir) {
  const { page, info } = await openScene(browser, port, id);
  ensureDir(join(outDir, 'stills'));
  const files = [];
  for (const t of times) {
    await page.evaluate((tt) => window.seek(tt), t);
    const file = join(outDir, 'stills', `${id}-${String(t).replace('.', '_')}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 96, animations: 'disabled' });
    files.push(file);
    console.log(`still ${id} t=${t} -> ${file}`);
  }
  await page.close();
  return { info, files };
}

async function renderVideo(browser, port, id, fps, outDir, noMusic) {
  const { page, info } = await openScene(browser, port, id);
  ensureDir(outDir);
  const duration = info.duration;
  const frameCount = Math.ceil(duration * fps);
  const silent = join(outDir, `${id}-silent.mp4`);
  const final = join(outDir, `${id}.mp4`);
  const wav = join(outDir, `${id}-music.wav`);

  const posterTime = Math.min(duration - 0.3, Math.max(0.4, duration * 0.38));
  await page.evaluate((tt) => window.seek(tt), posterTime);
  await page.screenshot({ path: join(outDir, `${id}-poster.jpg`), type: 'jpeg', quality: 95, animations: 'disabled' });

  if (!noMusic) {
    console.log(`music ${id} (${duration.toFixed(2)}s)`);
    await makeMusic(duration, wav, 7000 + id.length * 137);
  }

  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', silent,
  ];
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', (d) => (ffErr += d.toString()));
  const done = new Promise((res, rej) => {
    ff.on('error', rej);
    ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}\n${ffErr.slice(-4000)}`))));
  });

  const started = Date.now();
  for (let i = 0; i < frameCount; i++) {
    const t = i / fps;
    await page.evaluate((tt) => window.seek(tt), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94, animations: 'disabled' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 30 === 0 || i === frameCount - 1) {
      const pct = ((i + 1) / frameCount * 100).toFixed(1);
      const sec = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`${id} ${String(i + 1).padStart(4)}/${frameCount} ${pct}% ${sec}s`);
    }
  }
  ff.stdin.end();
  await done;
  await page.close();

  if (!noMusic) {
    await run('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', silent, '-i', wav,
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
      '-shortest', '-movflags', '+faststart', final,
    ]);
  } else {
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-c', 'copy', '-movflags', '+faststart', final]);
  }

  const probe = await ffprobe(final);
  return {
    id,
    title: info.title,
    duration: Number(probe.format.duration),
    bytes: Number(probe.format.size),
    mp4: final,
    poster: join(outDir, `${id}-poster.jpg`),
  };
}

const server = await serve();
const port = server.address().port;
console.log(`server http://127.0.0.1:${port}/media/senda-features/index.html`);

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
  ],
});

const outDir = resolve(here, arg('out', 'out'));
ensureDir(outDir);
const sceneArg = arg('scene', null);
const all = process.argv.includes('--all');
const sceneIds = all ? ALL : [sceneArg].filter(Boolean);
if (!sceneIds.length) {
  console.error('Uso: node render.mjs --scene=mensaje [--stills=1,5] | --all');
  process.exit(2);
}

const stillArg = arg('stills', null);
let manifest = [];
try {
  if (stillArg) {
    const times = String(stillArg).split(',').map(Number).filter((n) => Number.isFinite(n));
    for (const id of sceneIds) {
      const { files } = await stills(browser, port, id, times, outDir);
      manifest.push({ id, stills: files });
    }
  } else {
    for (const id of sceneIds) {
      console.log(`render ${id}`);
      const rec = await renderVideo(browser, port, id, Number(arg('fps', 30)), outDir, process.argv.includes('--no-music'));
      manifest.push(rec);
      console.log(`done ${id} ${rec.duration.toFixed(2)}s ${(rec.bytes / 1024 / 1024).toFixed(1)}MB`);
    }
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest.map((m) => ({
      ...m,
      mp4: relative(root, m.mp4).replaceAll('\\', '/'),
      poster: relative(root, m.poster).replaceAll('\\', '/'),
      absMp4: m.mp4,
      absPoster: m.poster,
    })), null, 2) + '\n');
  }
} finally {
  await browser.close();
  server.close();
}

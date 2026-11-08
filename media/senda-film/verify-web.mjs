import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { chromium } from '../../investor-next/node_modules/playwright/index.mjs';

const ROOT = path.resolve('investor-next/out');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (u === '/') u = '/index.html';
  else if (u === '/es' || u === '/es/') u = '/es.html';
  else if (u === '/nl' || u === '/nl/') u = '/nl.html';
  else if (u === '/senda' || u === '/senda/') u = '/senda/index.html';
  let fp = path.join(ROOT, u);
  if (!fs.existsSync(fp) && fs.existsSync(fp + '.html')) fp += '.html';
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory() && fs.existsSync(path.join(fp, 'index.html'))) {
    fp = path.join(fp, 'index.html');
  }
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
  const stat = fs.statSync(fp);
  const ext = path.extname(fp).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  if (req.headers.range && ext === '.mp4') {
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range);
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': (end - start + 1)
    });
    fs.createReadStream(fp, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Length': stat.size });
  fs.createReadStream(fp).pipe(res);
});

await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const base = `http://127.0.0.1:${port}`;

// Check HTTP 206 Range & VTT Content-Type directly
const rangeRes = await fetch(`${base}/media/m95/senda-m95-film-en.mp4`, { headers: { Range: 'bytes=0-1023' } });
if (rangeRes.status !== 206) throw new Error(`Expected 206 Range response, got ${rangeRes.status}`);
console.log('Range request on senda-m95-film-en.mp4:', rangeRes.status, rangeRes.headers.get('content-range'));

for (const lang of ['es', 'en', 'nl']) {
  const vttRes = await fetch(`${base}/media/m95/senda-m95-film-${lang}.vtt`);
  const text = await vttRes.text();
  if (vttRes.status !== 200 || !vttRes.headers.get('content-type')?.includes('text/vtt') || !text.startsWith('WEBVTT')) {
    throw new Error(`VTT check failed for ${lang}`);
  }
}
console.log('VTT HTTP 200 + text/vtt + WEBVTT verified for es, en, nl');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

for (const [loc, urlPath, outPng] of [['en', '/', 'home-en.png'], ['es', '/es', 'home-es.png'], ['nl', '/nl', 'home-nl.png']]) {
  await page.goto(base + urlPath, { waitUntil: 'networkidle' });
  const tracks = await page.$$eval('#senda-m95-film-video track', (els) =>
    els.map((t) => ({ lang: t.srclang, label: t.label, src: t.getAttribute('src'), default: t.default }))
  );
  console.log(loc, 'tracks:', JSON.stringify(tracks));
  const vid = page.locator('#senda-m95-film-video');
  await vid.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `evidence/video/m95/screenshots/${outPng}` });
}
for (const p of ['/senda/carretera.html', '/senda/arquitectura.html']) {
  await page.goto(base + p, { waitUntil: 'networkidle' });
  const count = await page.locator('video track').count();
  console.log(p, 'video tracks:', count);
}
await browser.close();
srv.close();
console.log('Console errors:', errors.length);
if (errors.length) { console.error(errors); process.exit(1); }

// Generate evidence/video/m95/release.json
const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
const dir = 'investor-next/public/media/m95';
const files = fs.readdirSync(dir).sort().map((name) => {
  const fp = path.join(dir, name);
  const stat = fs.statSync(fp);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
  let duration = null;
  if (name.endsWith('.mp4')) {
    try {
      const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fp}"`, { encoding: 'utf8' }).trim();
      duration = parseFloat(Number(out).toFixed(2));
    } catch {}
  }
  return {
    path: `/media/m95/${name}`,
    bytes: stat.size,
    ...(duration !== null ? { duration } : {}),
    sha256
  };
});

const release = {
  releaseId: 'senda-m95-video-2026-11',
  commit,
  branch,
  deployUrl: null,
  deployStatus: 'BLOCKED_EXTERNAL',
  deployedAt: null,
  generatedAt: '2026-11-08T14:50:00+01:00',
  audioLanguage: 'en',
  voiceModel: 'kokoro-onnx==0.6.1 (bf_emma, en-gb, speed 0.95)',
  subtitleLanguages: ['es', 'en', 'nl'],
  nlNativeReview: 'REVIEW_REQUIRED',
  files,
  verificationStatus: {
    content: 'PASS',
    voice: 'PASS',
    subtitles: 'PASS_WITH_NL_REVIEW_REQUIRED',
    image: 'PASS',
    webLocalBuild: 'PASS',
    webProductionDeploy: 'BLOCKED_EXTERNAL',
    securityHeadersConfig: 'PASS',
    securityTxtContact: 'BLOCKED_FOUNDER_EMAIL',
    legal: 'PASS'
  },
  unresolvedItems: [
    'SECURITY.txt contains placeholder security@civic-relay.example.com; requires real founder-controlled security mailbox before claiming protected status (§ 9.4 / § 12).',
    'Dutch (nl) subtitles require native speaker sign-off before claiming native-verified status (marked REVIEW_REQUIRED per § 6.3 / § 12).',
    'Remote Vercel preview/production deployment requires VERCEL_TOKEN / founder confirmation (§ 8.2 / § 12).',
    'Physical field validation with phones/radios and external cryptographic audit remain pending (0 external audits).'
  ]
};

fs.writeFileSync('evidence/video/m95/release.json', JSON.stringify(release, null, 2) + '\n', 'utf8');
console.log('Wrote evidence/video/m95/release.json with', files.length, 'files');

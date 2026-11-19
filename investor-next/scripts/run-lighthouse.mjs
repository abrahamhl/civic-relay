#!/usr/bin/env node
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const outDir = resolve('investor-next/out');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const srv = http.createServer((req, res) => {
  const clean = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
  const cands = clean
    ? [join(outDir, clean), join(outDir, `${clean.replace(/\/$/, '')}.html`), join(outDir, clean, 'index.html')]
    : [join(outDir, 'index.html')];
  const f = cands.find((c) => existsSync(c) && statSync(c).isFile());
  if (!f) {
    res.writeHead(404);
    res.end('404');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});

await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const { port } = srv.address();
const chromePath = chromium.executablePath();
const outPath = resolve('docs/web/lighthouse-home.json');

try {
  await new Promise((res, rej) => {
    const child = spawn(
      process.platform === 'win32' ? 'pnpx.cmd' : 'pnpx',
      [
        'lighthouse',
        `http://127.0.0.1:${port}/`,
        '--output=json',
        `--output-path=${outPath}`,
        '"--chrome-flags=--headless=new --no-sandbox"',
        '--only-categories=performance,accessibility,best-practices,seo',
        '--quiet'
      ],
      {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, CHROME_PATH: chromePath }
      }
    );
    child.on('error', rej);
    child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`lighthouse exited with ${code}`))));
  });

  const r = JSON.parse(readFileSync(outPath, 'utf8'));
  const scores = Object.fromEntries(
    Object.entries(r.categories).map(([k, v]) => [k, Math.round((v.score || 0) * 100)])
  );
  console.log('LIGHTHOUSE SCORES:', JSON.stringify(scores));
  console.log(
    'CORE WEB VITALS:',
    JSON.stringify({
      lcpMs: Math.round(r.audits['largest-contentful-paint']?.numericValue || 0),
      cls: +(r.audits['cumulative-layout-shift']?.numericValue || 0).toFixed(4),
      tbtMs: Math.round(r.audits['total-blocking-time']?.numericValue || 0),
      fcpMs: Math.round(r.audits['first-contentful-paint']?.numericValue || 0)
    })
  );
  for (const [catKey, cat] of Object.entries(r.categories)) {
    const failed = cat.auditRefs
      .map((ref) => r.audits[ref.id])
      .filter((a) => a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable')
      .map((a) => ({ id: a.id, title: a.title, score: a.score, display: a.displayValue }));
    if (failed.length) console.log(`AUDIT NOTES (${catKey}):`, JSON.stringify(failed));
  }
} finally {
  srv.close();
}

// Fotogramas de control: node stills.cjs <script> <t1,t2,...> <outdir>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.geojson': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const [name, ts, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://127.0.0.1:${srv.address().port}/media/senda-cine/cine.html?script=${name}`); await p.waitForFunction(() => window.READY === true, null, { timeout: 120000 }).catch((e) => errs.push('READY ' + e.message));
  for (const t of ts.split(',').map(Number)) { const t0 = Date.now(); await p.evaluate((x) => window.seek(x), t); await p.screenshot({ path: `${out}/${name}-${String(t).padStart(5, '0')}.jpg`, quality: 80 }); console.log(t, Date.now() - t0, 'ms'); }
  console.log(JSON.stringify(errs.slice(0, 5))); await b.close(); srv.close();
});

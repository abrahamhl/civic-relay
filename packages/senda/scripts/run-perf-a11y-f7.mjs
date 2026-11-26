#!/usr/bin/env node
/**
 * SENDA · F7 Auditoría real de rendimiento (4G, LCP < 2,5 s, JS inicial < 300 KB) y accesibilidad
 * (axe-core WCAG 2.0/2.1/2.2 A/AA + prefers-reduced-motion) en Chromium real.
 *
 * 100 % reproducible sin red externa (sirve `investor-next/public` localmente con compresión gzip
 * equivalente a Vercel/CDN y bloquea peticiones externas para evitar ruido de red).
 * Guarda `evidence/quality/perf-a11y-report.json` sellado con SHA-256.
 */
import http from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PUBLIC_DIR = resolve(ROOT, 'investor-next/public');
const AXE_PATH = resolve(ROOT, 'node_modules/axe-core/axe.min.js');
const OUT = resolve(ROOT, 'evidence/quality/perf-a11y-report.json');

const BUDGETS = Object.freeze({
  maxLcpMs: 2500,
  maxInitialJsTransferBytes: 300 * 1024, // 300 KB
  maxAxeViolations: 0,
});

const ROUTES = [
  { id: 'senda-home', path: '/senda/' },
  { id: 'senda-conducir', path: '/senda/conducir' },
  { id: 'senda-personas', path: '/senda/personas' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
};

function findChrome() {
  for (const bin of [process.env.CHROME_PATH, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    try {
      const p = execFileSync('which', [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (p) return p;
    } catch {}
    if (existsSync(bin)) return bin;
  }
  throw new Error('Chromium / Google Chrome no encontrado en PATH');
}

function startStaticServer() {
  return new Promise((resolveServer) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      let rel = urlPath.replace(/^\/+/, '');
      let filePath = resolve(PUBLIC_DIR, rel);
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, 'index.html');
      } else if (!existsSync(filePath) && existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
      }
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = extname(filePath);
      const mime = MIME[ext] || 'application/octet-stream';
      const raw = readFileSync(filePath);
      const acceptGzip = String(req.headers['accept-encoding'] || '').includes('gzip');
      const compressible = /\.(html|mjs|js|css|json|svg|webmanifest)$/.test(ext);
      if (acceptGzip && compressible) {
        const gz = gzipSync(raw, { level: 6 });
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Encoding': 'gzip',
          'Content-Length': gz.length,
          'X-Uncompressed-Bytes': String(raw.length),
          'Cache-Control': 'no-cache',
        });
        res.end(gz);
      } else {
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': raw.length, 'Cache-Control': 'no-cache' });
        res.end(raw);
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveServer({ server, port: typeof addr === 'object' && addr ? addr.port : 0 });
    });
  });
}

async function launchChrome(chromeBin) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(
    chromeBin,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-extensions',
      '--mute-audio',
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  const killChrome = () => {
    try { proc.kill('SIGKILL'); } catch {}
  };

  let wsUrl = null;
  const deadline = Date.now() + 60_000; // arranque en frío de Chrome en un runner compartido: puede pasar de 15 s
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!wsUrl) {
    killChrome();
    throw new Error('Timeout esperando a Chromium CDP');
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Timeout abriendo WebSocket CDP')), 10_000);
    ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true });
    ws.addEventListener('error', (e) => { clearTimeout(t); rej(e); }, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const { res, rej, timer } = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(timer);
      if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
      else res(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      for (const fn of listeners.get(msg.method)) fn(msg.params);
    }
  });

  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        rej(new Error(`CDP timeout en ${method}`));
      }, 15_000);
      pending.set(id, { res, rej, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(fn);
    return () => listeners.get(method)?.delete(fn);
  };

  return { send, on, close: () => { try { ws.close(); } catch {} killChrome(); } };
}

async function auditRoute(cdp, baseUrl, route, axeSource) {
  const origin = new URL(baseUrl).origin;
  const reqTypes = new Map();
  const jsTransfers = [];
  const consoleErrors = [];

  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 915,
    deviceScaleFactor: 2,
    mobile: true,
  });
  // Emulación de red 4G rápida (Lighthouse / DevTools estándar: ~1,6 Mbps bajada, 750 Kbps subida, 150 ms RTT)
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    connectionType: 'cellular4g',
  });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  try {
    await cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'service_workers,cache_storage' });
  } catch {}

  // Evitar ruido de teselas/APIs externas durante el test offline determinista
  await cdp.send('Network.setBlockedURLs', {
    urls: [
      '*://tiles.openfreemap.org/*',
      '*://router.project-osrm.org/*',
      '*://nominatim.openstreetmap.org/*',
      '*://gibs.earthdata.nasa.gov/*',
      '*://nap.dgt.es/*',
      '*://*.tile.openstreetmap.org/*',
      '*://*.opentopomap.org/*',
      '*://www.ign.es/*',
      '*://service.pdok.nl/*',
    ],
  });

  // Inyectar PerformanceObserver antes del primer script de la página para capturar LCP/FCP reales
  const { identifier: observerId } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__SENDA_PERF__ = { lcpMs: null, fcpMs: null, lcpElement: null };
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) {
            window.__SENDA_PERF__.lcpMs = Math.round(last.startTime);
            window.__SENDA_PERF__.lcpElement = last.element ? last.element.tagName + (last.element.id ? '#' + last.element.id : '') : null;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.name === 'first-contentful-paint') window.__SENDA_PERF__.fcpMs = Math.round(e.startTime);
          }
        }).observe({ type: 'paint', buffered: true });
      } catch {}
    `,
  });

  let loadDone = false;
  const deferredJsTransfers = [];
  const offReq = cdp.on('Network.requestWillBeSent', (p) => {
    reqTypes.set(p.requestId, { url: p.request.url, type: p.type, afterLoad: loadDone });
  });
  const offResp = cdp.on('Network.responseReceived', (p) => {
    const info = reqTypes.get(p.requestId);
    if (info) {
      info.mime = p.response.mimeType;
      info.uncompressed = Number(p.response.headers['X-Uncompressed-Bytes'] || p.response.headers['x-uncompressed-bytes'] || 0);
    }
  });
  const offFin = cdp.on('Network.loadingFinished', (p) => {
    const info = reqTypes.get(p.requestId);
    if (!info) return;
    if (info.url.startsWith(origin) && (info.type === 'Script' || /\.(m?js)(\?|$)/.test(info.url))) {
      const entry = {
        url: info.url.replace(origin, ''),
        transferBytes: Math.round(p.encodedDataLength),
        uncompressedBytes: info.uncompressed || Math.round(p.encodedDataLength),
      };
      if (info.afterLoad) deferredJsTransfers.push(entry);
      else jsTransfers.push(entry);
    }
  });
  const offErr = cdp.on('Runtime.exceptionThrown', (p) => {
    consoleErrors.push(p.exceptionDetails?.text || 'uncaught exception');
  });

  const loadPromise = new Promise((res) => {
    const off = cdp.on('Page.loadEventFired', () => { loadDone = true; off(); res(); });
  });
  await cdp.send('Page.navigate', { url: `${baseUrl}${route.path}` });
  await Promise.race([loadPromise, new Promise((r) => setTimeout(r, 10_000))]);
  loadDone = true;
  // Esperar asentamiento de renderizado/LCP
  await new Promise((r) => setTimeout(r, 900));

  // Leer métricas reales de rendimiento (LCP, FCP, DOMContentLoaded)
  const perfEval = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const p = window.__SENDA_PERF__ || {};
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lastLcp = lcpEntries && lcpEntries.length ? Math.round(lcpEntries[lcpEntries.length - 1].startTime) : p.lcpMs;
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find((e) => e.name === 'first-contentful-paint');
      const fcpMs = fcp ? Math.round(fcp.startTime) : p.fcpMs;
      return {
        lcpMs: lastLcp ?? fcpMs ?? Math.round(nav ? nav.domContentLoadedEventEnd : 0),
        lcpObserved: lastLcp != null,
        lcpElement: p.lcpElement,
        fcpMs: fcpMs ?? null,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      };
    })()`,
  });
  const perf = perfEval.result.value;

  // Emular prefers-reduced-motion: reduce y verificar soporte real en CSS
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  const rmEval = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const mediaMatches = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let hasReducedMotionRule = false;
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.conditionText && rule.conditionText.includes('prefers-reduced-motion')) {
              hasReducedMotionRule = true;
            }
          }
        } catch {}
      }
      const focusables = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').length;
      return { mediaMatches, hasReducedMotionRule, focusables };
    })()`,
  });
  const reducedMotion = rmEval.result.value;

  // Inyectar axe-core y auditar WCAG 2.0 / 2.1 / 2.2 Level A & AA
  await cdp.send('Runtime.evaluate', { expression: axeSource });
  const axeEval = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const res = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      });
      return {
        passes: res.passes.length,
        incomplete: res.incomplete.length,
        violations: res.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          tags: v.tags,
          nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, failureSummary: n.failureSummary })),
        })),
      };
    })()`,
  });
  const a11y = axeEval.result.value;

  offReq(); offResp(); offFin(); offErr();
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: observerId });

  const initialJsTransferBytes = jsTransfers.reduce((s, x) => s + x.transferBytes, 0);
  const initialJsUncompressedBytes = jsTransfers.reduce((s, x) => s + x.uncompressedBytes, 0);
  const deferredJsTransferBytes = deferredJsTransfers.reduce((s, x) => s + x.transferBytes, 0);

  const lcpOk = perf.lcpMs < BUDGETS.maxLcpMs;
  const jsOk = initialJsTransferBytes < BUDGETS.maxInitialJsTransferBytes;
  const axeOk = a11y.violations.length <= BUDGETS.maxAxeViolations;
  const rmOk = reducedMotion.mediaMatches && reducedMotion.hasReducedMotionRule;

  return {
    id: route.id,
    path: route.path,
    perf: {
      ...perf,
      initialJsTransferBytes,
      initialJsTransferKB: +(initialJsTransferBytes / 1024).toFixed(1),
      initialJsUncompressedKB: +(initialJsUncompressedBytes / 1024).toFixed(1),
      deferredJsTransferKB: +(deferredJsTransferBytes / 1024).toFixed(1),
      deferredJsFilesCount: deferredJsTransfers.length,
      jsFilesCount: jsTransfers.length,
      topJsFiles: [...jsTransfers].sort((a, b) => b.transferBytes - a.transferBytes).slice(0, 8),
    },
    a11y: {
      wcagTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      passes: a11y.passes,
      violationsCount: a11y.violations.length,
      violations: a11y.violations,
      reducedMotion,
    },
    consoleErrors,
    gates: { lcpOk, jsOk, axeOk, rmOk, ok: lcpOk && jsOk && axeOk && rmOk && consoleErrors.length === 0 },
  };
}

const axeSource = readFileSync(AXE_PATH, 'utf8');
const chromeBin = findChrome();
const { server, port } = await startStaticServer();
const baseUrl = `http://127.0.0.1:${port}`;
const cdp = await launchChrome(chromeBin);

try {
  const results = [];
  for (const route of ROUTES) {
    const r = await auditRoute(cdp, baseUrl, route, axeSource);
    results.push(r);
    const status = r.gates.ok ? 'PASS' : 'FAIL';
    console.log(
      `[${status}] ${r.path.padEnd(18)} LCP=${r.perf.lcpMs} ms (<${BUDGETS.maxLcpMs}) · JS=${r.perf.initialJsTransferKB} KB (<300 KB, ${r.perf.jsFilesCount} ficheros) · axe=${r.a11y.violationsCount} violaciones (${r.a11y.passes} OK) · reduced-motion=${r.a11y.reducedMotion.hasReducedMotionRule}`
    );
    if (r.a11y.violationsCount > 0) {
      for (const v of r.a11y.violations) {
        console.log(`   ↳ [axe ${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
      }
    }
    if (r.consoleErrors.length > 0) {
      console.log(`   ↳ [JS errors] ${r.consoleErrors.join('; ')}`);
    }
  }

  const allOk = results.every((r) => r.gates.ok);
  const reportBody = {
    schema: 'senda.perf-a11y-f7/v1',
    basis: 'MEASURED_HEADLESS_CHROMIUM_4G_AXE',
    generatedAtUtc: new Date().toISOString(),
    environment: {
      node: process.version,
      chrome: chromeBin,
      networkProfile: '4G (1.6 Mbps down / 750 Kbps up / 150 ms RTT, gzip transfer, 412x915 mobile)',
      axeCoreVersion: JSON.parse(readFileSync(resolve(ROOT, 'node_modules/axe-core/package.json'), 'utf8')).version,
    },
    budgets: BUDGETS,
    allOk,
    routes: results,
  };
  const sha256 = createHash('sha256').update(JSON.stringify(reportBody)).digest('hex');
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ ...reportBody, sha256 }, null, 2) + '\n');
  console.log(`\nSHA-256: ${sha256}\nInforme: evidence/quality/perf-a11y-report.json`);
  if (!allOk) process.exitCode = 1;
} finally {
  cdp.close();
  server.closeAllConnections?.();
  server.close();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(HERE, '../../../investor-next/public');
const CHROME_BIN = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function startStaticServer() {
  return new Promise((resolveServer) => {
    const srv = http.createServer((req, res) => {
      const urlPath = new URL(req.url, 'http://127.0.0.1').pathname;
      let filePath = join(PUBLIC_DIR, urlPath);
      if (urlPath === '/senda' || urlPath === '/senda/') filePath = join(PUBLIC_DIR, 'senda/index.html');
      else if (!extname(urlPath) && existsSync(`${filePath}.html`)) filePath = `${filePath}.html`;
      if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
    });
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolveServer({ srv, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function launchCdp() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'senda-chrome-'));
  const proc = spawn(CHROME_BIN, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((ok, ko) => {
    let buf = '';
    const timer = setTimeout(() => ko(new Error('Chrome DevTools startup timeout')), 15_000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) { clearTimeout(timer); ok(m[1]); }
    });
    proc.once('exit', (code) => { clearTimeout(timer); ko(new Error(`Chrome exited early: ${code}`)); });
  });

  const { port } = new URL(wsUrl);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const pageTarget = targets.find((t) => t.type === 'page') ?? targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });

  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, ko } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) ko(new Error(msg.error.message));
      else ok(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      for (const fn of listeners.get(msg.method)) fn(msg.params);
    }
  };
  const send = (method, params = {}) => new Promise((ok, ko) => {
    const cur = ++id;
    pending.set(cur, { ok, ko });
    ws.send(JSON.stringify({ id: cur, method, params }));
  });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  };
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };
  const waitFor = async (expr, timeoutMs = 10_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await evalJs(`Boolean(${expr})`)) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timeout esperando condición: ${expr}`);
  };
  const close = () => {
    try { ws.close(); } catch { /* */ }
    try { proc.kill('SIGKILL'); } catch { /* */ }
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch { /* */ }
  };
  return { send, on, evalJs, waitFor, close };
}

test('Copiloto 5D Apple HIG Mobile-First (390x844): 4 pestañas, entorno directo/indirecto, calibración 1-toque, Android Auto y Conducir', { skip: !CHROME_BIN }, async () => {
  const { srv, baseUrl } = await startStaticServer();
  const cdp = await launchCdp();
  const errors = [];
  const failedLocal = [];
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    cdp.on('Runtime.exceptionThrown', (e) => errors.push(e.exceptionDetails?.text || 'exception'));
    cdp.on('Runtime.consoleAPICalled', (e) => {
      if (e.type === 'error') errors.push(e.args.map((a) => a.value ?? a.description).join(' '));
    });
    cdp.on('Network.responseReceived', (e) => {
      if (e.response.url.startsWith(baseUrl) && !e.response.url.includes('/senda/live/') && e.response.status >= 400) {
        failedLocal.push(`${e.response.status} ${e.response.url}`);
      }
    });

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__aaPayloads = [];
        window.__bleSent = [];
        window.SendaNative = {
          publishDriveState(json) { window.__aaPayloads.push(JSON.parse(json)); return true; },
          p2pStart() {},
          p2pSend(b64) { window.__bleSent.push(b64); },
          radioScan() {},
          info() { return JSON.stringify({ copilotBridge: true }); },
        };
      `,
    });

    // 1. Mobile-First Portrait 390x844 @2x (APK principal)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `${baseUrl}/senda/copiloto` });
    await cdp.waitFor('window.sendaCopilot && window.__aaPayloads.length >= 1');

    const mobileHome = await cdp.evalJs(`(() => {
      const kamm = document.getElementById('kammCanvas');
      const hor = document.getElementById('horizonCanvas');
      const kPix = kamm.getContext('2d').getImageData(0, 0, kamm.width, kamm.height).data;
      const hPix = hor.getContext('2d').getImageData(0, 0, hor.width, hor.height).data;
      let kNonZero = 0, hNonZero = 0;
      for (let i = 3; i < kPix.length; i += 4) if (kPix[i] > 0) kNonZero++;
      for (let i = 3; i < hPix.length; i += 4) if (hPix[i] > 0) hNonZero++;
      return {
        modePill: document.getElementById('modePill').textContent,
        aaPill: document.getElementById('aaPill').textContent,
        bannerTitle: document.getElementById('bannerTitle').textContent,
        bannerAction: document.getElementById('bannerAction').textContent,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        kNonZero,
        hNonZero,
        aaCount: window.__aaPayloads.length,
        lastAa: window.__aaPayloads[window.__aaPayloads.length - 1] ?? null,
      };
    })()`);

    assert.equal(mobileHome.modePill, 'Simulación declarada');
    assert.match(mobileHome.aaPill, /Auto activo/);
    assert.match(mobileHome.bannerTitle, /deslizar sobre el agua/i);
    assert.ok(mobileHome.overflowX <= 2, `sin desbordamiento horizontal 390px (${mobileHome.overflowX})`);
    assert.ok(mobileHome.kNonZero > 4000, 'anillo de agarre renderizado');
    assert.ok(mobileHome.hNonZero > 4000, 'horizonte predictivo renderizado');
    assert.ok(['VERDE', 'AMBAR', 'ROJO'].includes(mobileHome.lastAa.status));

    // 2. Pestaña Entorno: comunicación directa (BLE DENM 36 B) + indirecta (sin app) + votación bayesiana
    const envRes = await cdp.evalJs(`(() => {
      window.sendaCopilot.setTab('entorno');
      window.sendaCopilot.sendQuickSignal('agua');
      const voteBtn = document.querySelector('[data-vote="conf"]');
      if (voteBtn) voteBtn.click();
      return {
        bleSentCount: window.__bleSent.length,
        composeVisible: !document.getElementById('composeBox').hidden,
        indirectText: document.getElementById('composeIndirectText').textContent,
        directPeers: document.getElementById('dirPeersTitle').textContent,
        indirectDensity: document.getElementById('indDensityTitle').textContent,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    assert.equal(envRes.bleSentCount, 1, 'envía paquete directo C-ITS DENM 36 B por SendaNative.p2pSend');
    assert.equal(envRes.composeVisible, true);
    assert.match(envRes.indirectText, /Agua \/ Balsa/);
    assert.match(envRes.indirectText, /112/);
    assert.ok(envRes.overflowX <= 2, `sin desbordamiento en pestaña Entorno (${envRes.overflowX})`);

    // 3. Pestaña Calibrar: marcas en 1 toque + exportación SHA-256 sin PII
    const calRes = await cdp.evalJs(`(async () => {
      window.sendaCopilot.setTab('calibrar');
      window.sendaCopilot.recordCalibration('alert_feedback', 'acierto');
      window.sendaCopilot.recordCalibration('road_condition', 'balsas');
      window.sendaCopilot.recordCalibration('coverage_check', 'sin_red');
      window.sendaCopilot.recordCalibration('drive_mode_truth', 'en_coche');
      const pack = await window.sendaCopilot.exportCalibration();
      return {
        pack,
        stageText: document.getElementById('calStageBadge').textContent,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    assert.equal(calRes.pack.schema, 'senda.community-calibration-pack/v1');
    assert.equal(calRes.pack.totalMarks, 4);
    assert.match(calRes.pack.sha256, /^[a-f0-9]{64}$/);
    assert.equal(calRes.pack.lat, undefined);
    assert.ok(calRes.overflowX <= 2, `sin desbordamiento en pestaña Calibrar (${calRes.overflowX})`);

    // 4. Pestaña Física: escenarios críticos + debriefing SHA-256 (0 PII)
    const physRes = await cdp.evalJs(`(async () => {
      window.sendaCopilot.setTab('fisica');
      const out = {};
      for (const sc of ['tunnel_ekf', 'flood_gate', 'fog_lwr', 'night_convoy']) {
        window.sendaCopilot.applyScenarioDefaults(sc);
        window.sendaCopilot.tick();
        out[sc] = {
          bannerClass: document.getElementById('alertBanner').className,
          eMode: document.getElementById('eMode').textContent,
          fCross: document.getElementById('fCross').textContent,
          fLevel: document.getElementById('fLevel').textContent,
        };
      }
      const debrief = await window.sendaCopilot.sealDebrief();
      return { out, debrief, overflowX: document.documentElement.scrollWidth - window.innerWidth };
    })()`);
    assert.match(physRes.out.tunnel_ekf.eMode, /DEAD_RECKONING_IMU/);
    assert.match(physRes.out.flood_gate.bannerClass, /ROJO/);
    assert.match(physRes.out.flood_gate.fCross, /NO_CRUZAR|FLOOD/i);
    assert.match(physRes.out.night_convoy.fLevel, /CRITICAL|HIGH/);
    assert.equal(physRes.debrief.schema, 'senda.drive-copilot-debrief/v1');
    assert.match(physRes.debrief.sha256, /^[a-f0-9]{64}$/);
    assert.ok(physRes.overflowX <= 2);

    // 5. Conducir: chip 1-toque a Copiloto 5D + publicación Android Auto en vivo
    await cdp.send('Page.navigate', { url: `${baseUrl}/senda/conducir` });
    await cdp.waitFor('window.sendaDrive && document.getElementById("copilotChip")');
    const driveCheck = await cdp.evalJs(`(() => {
      const chip = document.getElementById('copilotChip');
      window.__aaPayloads.length = 0;
      window.sendaDrive.onPos({
        coords: { latitude: 40.4168, longitude: -3.7038, accuracy: 6, speed: 25, heading: 90, altitude: 650 },
        timestamp: Date.now(),
      });
      return {
        chipHref: chip ? chip.getAttribute('href') : null,
        aaCount: window.__aaPayloads.length,
        lastAa: window.__aaPayloads[window.__aaPayloads.length - 1] ?? null,
      };
    })()`);
    assert.equal(driveCheck.chipHref, '/senda/copiloto');
    assert.ok(driveCheck.aaCount >= 1);
    assert.equal(driveCheck.lastAa.speedKmh, 90);

    assert.deepEqual(failedLocal, [], `activos locales con error HTTP: ${failedLocal.join(', ')}`);
    assert.deepEqual(errors, [], `errores de consola/JS: ${errors.join(' | ')}`);
  } finally {
    cdp.close();
    srv.close();
  }
});

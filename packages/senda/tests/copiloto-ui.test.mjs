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

test('Copiloto 5D y Conducir: renderizado real en Chromium (1440x900 + 390x844), puente Android Auto y debriefing SHA-256', { skip: !CHROME_BIN }, async () => {
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
        window.SendaNative = {
          publishDriveState(json) {
            window.__aaPayloads.push(JSON.parse(json));
            return true;
          },
          info() { return JSON.stringify({ copilotBridge: true }); },
        };
      `,
    });

    // 1. Desktop / Car Dash landscape 1440x900
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `${baseUrl}/senda/copiloto` });
    await cdp.waitFor('window.sendaCopilot && window.__aaPayloads.length >= 1');

    const desktopCheck = await cdp.evalJs(`(() => {
      const kamm = document.getElementById('kammCanvas');
      const hor = document.getElementById('horizonCanvas');
      const kPix = kamm.getContext('2d').getImageData(0, 0, kamm.width, kamm.height).data;
      const hPix = hor.getContext('2d').getImageData(0, 0, hor.width, hor.height).data;
      let kNonZero = 0, hNonZero = 0;
      for (let i = 3; i < kPix.length; i += 4) if (kPix[i] > 0) kNonZero++;
      for (let i = 3; i < hPix.length; i += 4) if (hPix[i] > 0) hNonZero++;
      return {
        title: document.title,
        modePill: document.getElementById('modePill').textContent,
        aaPill: document.getElementById('aaPill').textContent,
        bannerClass: document.getElementById('alertBanner').className,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        kNonZero,
        hNonZero,
        aaCount: window.__aaPayloads.length,
        lastAa: window.__aaPayloads[window.__aaPayloads.length - 1] ?? null,
      };
    })()`);

    assert.match(desktopCheck.title, /Copiloto 5D/);
    assert.equal(desktopCheck.modePill, 'SIMULACIÓN DECLARADA');
    assert.match(desktopCheck.aaPill, /Android Auto: ACTIVO/);
    assert.ok(desktopCheck.overflowX <= 2, `sin desbordamiento horizontal desktop (${desktopCheck.overflowX})`);
    assert.ok(desktopCheck.kNonZero > 5000, 'canvas Círculo de Kamm dibujado');
    assert.ok(desktopCheck.hNonZero > 5000, 'canvas Horizonte predictivo dibujado');
    assert.ok(desktopCheck.aaCount >= 1, 'publicó paquete al puente SendaNative.publishDriveState');
    assert.ok(['VERDE', 'AMBAR', 'ROJO'].includes(desktopCheck.lastAa.status));
    assert.ok(Array.isArray(desktopCheck.lastAa.rows) && desktopCheck.lastAa.rows.length > 0);

    // 2. Recorrer los escenarios críticos (túnel EKF, paso inundado Shand, niebla LWR, noche+convoy)
    const scenariosCheck = await cdp.evalJs(`(() => {
      const out = {};
      for (const sc of ['tunnel_ekf', 'flood_gate', 'fog_lwr', 'night_convoy']) {
        window.sendaCopilot.applyScenarioDefaults(sc);
        window.sendaCopilot.tick();
        out[sc] = {
          bannerClass: document.getElementById('alertBanner').className,
          bannerTitle: document.getElementById('bannerTitle').textContent,
          eMode: document.getElementById('eMode').textContent,
          fCross: document.getElementById('fCross').textContent,
          fLevel: document.getElementById('fLevel').textContent,
        };
      }
      return out;
    })()`);

    assert.match(scenariosCheck.tunnel_ekf.eMode, /DEAD_RECKONING_IMU/, 'túnel EKF entra en dead-reckoning real');
    assert.match(scenariosCheck.flood_gate.bannerClass, /ROJO/, 'paso inundado activa alarma ROJO');
    assert.match(scenariosCheck.flood_gate.fCross, /DO_NOT_CROSS|NO_CRUZAR|FLOOD/i);
    assert.match(scenariosCheck.fog_lwr.bannerClass, /ROJO|AMBAR/, 'niebla + cola LWR activa alerta');
    assert.match(scenariosCheck.night_convoy.fLevel, /CRITICAL|HIGH/, 'fatiga nocturna detectada');

    // 3. Debriefing SHA-256 (0 PII)
    const debrief = await cdp.evalJs(`(async () => {
      await window.sendaCopilot.sealDebrief();
      return JSON.parse(document.getElementById('debriefOut').textContent);
    })()`);
    assert.equal(debrief.schema, 'senda.drive-copilot-debrief/v1');
    assert.match(debrief.sha256, /^[a-f0-9]{64}$/);
    assert.ok(debrief.samples >= 4);
    for (const forbidden of ['lat', 'lon', 'mac', 'ssid', 'name', 'email']) {
      assert.equal(debrief[forbidden], undefined, `debriefing no debe contener ${forbidden}`);
    }

    // 4. Portrait smartphone 390x844 (APK vertical)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 200));
    const mobileOverflow = await cdp.evalJs('document.documentElement.scrollWidth - window.innerWidth');
    assert.ok(mobileOverflow <= 2, `sin desbordamiento horizontal móvil 390px (${mobileOverflow})`);

    // 5. Conducir: botón 1-toque a Copiloto 5D + publicación Android Auto en vivo
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
    assert.ok(driveCheck.aaCount >= 1, 'conducir.mjs publica estado en vivo a SendaNative.publishDriveState');
    assert.equal(driveCheck.lastAa.speedKmh, 90);
    assert.ok(driveCheck.lastAa.stoppingDistM > 50);

    assert.deepEqual(failedLocal, [], `activos locales con error HTTP: ${failedLocal.join(', ')}`);
    assert.deepEqual(errors, [], `errores de consola/JS: ${errors.join(' | ')}`);
  } finally {
    cdp.close();
    srv.close();
  }
});

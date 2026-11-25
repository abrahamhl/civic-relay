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

  const killChrome = () => {
    try { proc.stderr.destroy(); } catch { /* */ }
    try { proc.kill('SIGKILL'); } catch { /* */ }
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch { /* */ }
  };
  const wsUrl = await new Promise((ok, ko) => {
    let buf = '';
    // Arranque en frío de Chrome en un runner compartido puede pasar de 15 s; 60 s y, si no, fallo limpio.
    const timer = setTimeout(() => ko(new Error('Chrome DevTools startup timeout (60 s)')), 60_000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) { clearTimeout(timer); ok(m[1]); }
    });
    proc.once('exit', (code) => { clearTimeout(timer); ko(new Error(`Chrome exited early: ${code}`)); });
  }).catch((e) => { killChrome(); throw e; });

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
    const timer = setTimeout(() => { pending.delete(cur); ko(new Error(`CDP sin respuesta en 30 s: ${method}`)); }, 30_000);
    pending.set(cur, { ok: (v) => { clearTimeout(timer); ok(v); }, ko: (e) => { clearTimeout(timer); ko(e); } });
    ws.send(JSON.stringify({ id: cur, method, params }));
  });
  ws.onclose = () => { for (const [, p] of pending) p.ko(new Error('CDP cerrado')); pending.clear(); };
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
    killChrome();
  };
  return { send, on, evalJs, waitFor, close };
}

test('Copiloto 5D Apple HIG Mobile-First (390x844): 4 pestañas, entorno directo/indirecto, calibración 1-toque, Android Auto y Conducir', { skip: !CHROME_BIN, timeout: 240_000 }, async () => {
  const { srv, baseUrl } = await startStaticServer();
  const stopSrv = () => { try { srv.closeAllConnections(); } catch { /* */ } srv.close(); };
  let cdp;
  try { cdp = await launchCdp(); } catch (e) { stopSrv(); throw e; }
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

    assert.equal(mobileHome.modePill, 'Simulación');
    assert.match(mobileHome.aaPill, /Auto activo/);
    assert.match(mobileHome.bannerTitle, /deslizar sobre el agua/i);
    assert.ok(mobileHome.overflowX <= 2, `sin desbordamiento horizontal 390px (${mobileHome.overflowX})`);
    assert.ok(mobileHome.kNonZero > 4000, 'anillo de agarre renderizado');
    assert.ok(mobileHome.hNonZero > 4000, 'horizonte predictivo renderizado');
    assert.ok(['VERDE', 'AMBAR', 'ROJO'].includes(mobileHome.lastAa.status));

    // 2. Pestaña Entorno: comunicación directa (BLE DENM 36 B TX+RX) + indirecta (sin app + QR offline) + votación bayesiana
    const envRes = await cdp.evalJs(`(async () => {
      window.sendaCopilot.setTab('entorno');
      window.sendaCopilot.sendQuickSignal('agua');
      const sentB64 = window.__bleSent[0];
      const qrOk = await window.sendaCopilot.showOfflineQr();
      const hasQrSvg = Boolean(document.querySelector('#composeQrBox svg'));
      // Simular recepción BLE real de otro móvil SENDA cercano (paquete DENM 36 B)
      window.sendaP2P({ event: 'received', b64: sentB64 });
      const voteBtn = document.querySelector('[data-vote="conf"]');
      if (voteBtn) voteBtn.click();
      return {
        bleSentCount: window.__bleSent.length,
        qrOk,
        hasQrSvg,
        composeVisible: !document.getElementById('composeBox').hidden,
        indirectText: document.getElementById('composeIndirectText').textContent,
        feedText: document.getElementById('communityFeed').textContent,
        directPeers: document.getElementById('dirPeersTitle').textContent,
        indirectDensity: document.getElementById('indDensityTitle').textContent,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    assert.equal(envRes.bleSentCount, 1, 'envía paquete directo C-ITS DENM 36 B por SendaNative.p2pSend');
    assert.equal(envRes.qrOk, true, 'genera código QR 100 % offline con qrcode-generator local');
    assert.equal(envRes.hasQrSvg, true, 'inyecta SVG del QR en #composeQrBox');
    assert.equal(envRes.composeVisible, true);
    assert.match(envRes.indirectText, /Agua \/ Balsa/);
    assert.match(envRes.indirectText, /112/);
    assert.match(envRes.feedText, /Recibido por Bluetooth/i, 'decodifica paquete C-ITS DENM entrante en window.sendaP2P');
    assert.ok(envRes.overflowX <= 2, `sin desbordamiento en pestaña Entorno (${envRes.overflowX})`);

    // 3. Pestaña Calibrar: marcas en 1 toque + encuentro BLE registrado + persistencia local + exportación SHA-256 sin PII
    const calRes = await cdp.evalJs(`(async () => {
      window.sendaCopilot.setTab('calibrar');
      window.sendaCopilot.recordCalibration('alert_feedback', 'acierto');
      window.sendaCopilot.recordCalibration('road_condition', 'balsas');
      window.sendaCopilot.recordCalibration('coverage_check', 'sin_red');
      window.sendaCopilot.recordCalibration('drive_mode_truth', 'en_coche');
      const pack = await window.sendaCopilot.exportCalibration();
      const persisted = Boolean(localStorage.getItem('senda.copilot.cal.v1'));
      return {
        pack,
        persisted,
        stageText: document.getElementById('calStageBadge').textContent,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    assert.equal(calRes.pack.schema, 'senda.community-calibration-pack/v1');
    assert.equal(calRes.pack.totalMarks, 5, '4 marcas manuales + 1 encuentro BLE recibido automáticamente');
    assert.equal(calRes.persisted, true, 'calibración 0-PII persistida en localStorage');
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

    // 5. Conducir: chip 1-toque a Copiloto 5D, horizonte de curva OSRM en vivo, Android Auto y compartir sin app
    await cdp.send('Page.navigate', { url: `${baseUrl}/senda/conducir` });
    await cdp.waitFor('window.sendaDrive && document.getElementById("copilotChip")');
    const driveCheck = await cdp.evalJs(`(async () => {
      const chip = document.getElementById('copilotChip');
      window.__aaPayloads.length = 0;
      // Polilínea OSRM sintética con curva cerrada de ~60 m de radio 160 m por delante
      const coords = [];
      for (let i = 0; i <= 16; i++) coords.push([-3.7038, 40.4168 + i * 0.0001]);
      for (let a = 1; a <= 12; a++) {
        const ang = (a / 12) * (Math.PI / 2);
        const cx = -3.7038 + 0.00072, cy = 40.4168 + 0.0016;
        coords.push([cx - Math.cos(ang) * 0.00072, cy + Math.sin(ang) * 0.00054]);
      }
      window.sendaDrive.st.route = { ok: true, coords, distanceM: 320, durationS: 20, steps: [{ text: 'Sigue recto', distanceM: 250, at: coords[16], type: 'continue' }] };
      window.sendaDrive.onPos({
        coords: { latitude: 40.4168, longitude: -3.7038, accuracy: 6, speed: 28, heading: 0, altitude: 650 },
        timestamp: Date.now(),
      });
      const shared = await window.sendaDrive.shareIndirectDrive();
      return {
        chipHref: chip ? chip.getAttribute('href') : null,
        curveVisible: !document.getElementById('curveAlert').hidden,
        curveTitle: document.getElementById('cuTitle').textContent,
        curveLim: document.getElementById('cuLim').textContent,
        shareText: shared?.indirect?.shareText ?? '',
        aaCount: window.__aaPayloads.length,
        lastAa: window.__aaPayloads[window.__aaPayloads.length - 1] ?? null,
      };
    })()`);
    assert.equal(driveCheck.chipHref, '/senda/copiloto');
    assert.equal(driveCheck.curveVisible, true, 'muestra alerta de horizonte de curva en vivo sobre ruta OSRM');
    assert.match(driveCheck.curveTitle, /Curva/i);
    assert.ok(Number(driveCheck.curveLim) > 20 && Number(driveCheck.curveLim) < 95);
    assert.match(driveCheck.shareText, /SENDA/);
    assert.ok(driveCheck.aaCount >= 1);
    assert.ok(driveCheck.lastAa.rows.some((r) => /Curva/i.test(r)), 'incluye curva próxima en el payload Android Auto');

    // 6. Reportar ciudadano (Apple HIG Dark móvil 390x844, 0 errores, 0 desbordamiento)
    await cdp.send('Page.navigate', { url: `${baseUrl}/senda/reportar` });
    await cdp.waitFor('document.getElementById("btn-send") && document.querySelectorAll("#kinds button").length >= 4');
    const reportCheck = await cdp.evalJs(`(() => ({
      title: document.title,
      kindCount: document.querySelectorAll('#kinds button').length,
      has112: Boolean(document.querySelector('a[href="tel:112"]')),
      hasCopilotLink: Boolean(document.querySelector('a[href="/senda/copiloto"]')),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    }))()`);
    assert.ok(reportCheck.kindCount >= 4);
    assert.equal(reportCheck.has112, true);
    assert.equal(reportCheck.hasCopilotLink, true);
    assert.ok(reportCheck.overflowX <= 2, `sin desbordamiento en /senda/reportar (${reportCheck.overflowX})`);

    assert.deepEqual(failedLocal, [], `activos locales con error HTTP: ${failedLocal.join(', ')}`);
    assert.deepEqual(errors, [], `errores de consola/JS: ${errors.join(' | ')}`);
  } finally {
    cdp.close();
    stopSrv();
  }
});

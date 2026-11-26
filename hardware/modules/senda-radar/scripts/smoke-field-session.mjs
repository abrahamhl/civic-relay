#!/usr/bin/env node
// @ts-check
/**
 * SENDA Radar v1 · Prueba de humo reproducible de extremo a extremo en Chromium real:
 *
 *  Flujo 1 (interfaz ciudadana / protocolo de humo H1.6):
 *    `/senda/personas.html` → «Empezar sesión» → «Simulación» → «Marcar momento» → «Terminar y guardar»
 *    → captura el archivo `senda-campo-*.json` y lo valida con `packages/senda/scripts/mmwave-field-report.mjs`.
 *
 *  Flujo 2 (demostración del puente USB-CDC transparente C++17 H1.2a):
 *    Compila `firmware/test/host_test.cpp` (`g++ -std=c++17`), obtiene las 40 tramas de 30 bytes emitidas por
 *    `senda_radar::TransparentBridge` (`--smoke-stream`), inyecta un puerto Web Serial virtual que comprueba:
 *      - apertura exacta a `256000 8N1`
 *      - recepción íntegra de las 3 órdenes `FD FC FB FA ... 04 03 02 01` enviadas por `/senda/personas`
 *      - entrega de las 40 tramas `AA FF 03 00 ... 55 CC` sin modificar una sola línea de `personas.mjs`
 *    y valida el paquete `senda-campo-*.json` resultante con `mmwave-field-report.mjs` (`integrity: "OK"`).
 *
 *  Nota de veracidad: las tramas de ambos flujos proceden de escenarios sintéticos en este entorno sin sensor físico;
 *  ningún archivo temporal se guarda como evidencia de campo real ni se publica cifra alguna de precisión.
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const PUBLIC_DIR = path.join(ROOT, 'investor-next', 'public');
const REPORT_SCRIPT = path.join(ROOT, 'packages', 'senda', 'scripts', 'mmwave-field-report.mjs');
const HOST_TEST_CPP = path.join(ROOT, 'hardware', 'modules', 'senda-radar', 'firmware', 'test', 'host_test.cpp');
const FW_DIR = path.join(ROOT, 'hardware', 'modules', 'senda-radar', 'firmware');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function findChrome() {
  for (const c of [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error('No se encontró Chrome/Chromium para la prueba de humo de /senda/personas');
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function startStaticServer() {
  /** @type {Set<import('node:net').Socket>} */
  const sockets = new Set();
  const srv = http.createServer((req, res) => {
    const cleanUrl = (req.url ?? '/').split('?')[0];
    const rel = cleanUrl === '/senda/personas' ? '/senda/personas.html' : cleanUrl;
    const filePath = path.join(PUBLIC_DIR, rel);
    if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  srv.on('connection', (sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
  });
  return {
    listen: () => new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(/** @type {any} */ (srv.address()).port))),
    close: () => new Promise((resolve) => {
      for (const s of sockets) s.destroy();
      srv.close(() => resolve(undefined));
    }),
  };
}

/** Cliente CDP mínimo sobre el WebSocket nativo de Node 22+. */
async function connectCdp(debugPort) {
  const deadline = Date.now() + 30_000;
  let wsUrl = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = /** @type {any[]} */ (await res.json());
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!wsUrl) throw new Error('Chrome CDP no respondió en 30 s');

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  /** @type {Map<number, { resolve: (v: any) => void, reject: (e: Error) => void }>} */
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p?.reject(new Error(msg.error.message));
      else p?.resolve(msg.result);
    }
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout CDP en ${method}`));
        }, 15_000);
        pending.set(id, {
          resolve: (v) => { clearTimeout(timer); resolve(v); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        });
      });
    },
    close() { ws.close(); },
  };
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'senda-radar-smoke-'));
const server = startStaticServer();
/** @type {import('node:child_process').ChildProcess | null} */
let chromeProc = null;

try {
  // 1. Compilar y ejecutar el generador de flujo del puente transparente C++17
  const binPath = path.join(tmpDir, 'host_bridge');
  execFileSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-I', FW_DIR, HOST_TEST_CPP, '-o', binPath]);
  const unitOut = execFileSync(binPath, [], { encoding: 'utf8' }).trim();
  console.log(`✔ ${unitOut}`);

  const smokeLines = execFileSync(binPath, ['--smoke-stream'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((line) => {
      const [tMs, hex] = line.trim().split(/\s+/);
      return { tMs: Number(tMs), hex };
    });
  if (smokeLines.length !== 40) throw new Error(`Se esperaban 40 tramas del puente C++, recibidas ${smokeLines.length}`);

  // 2. Arrancar servidor local y Chromium headless
  const httpPort = await server.listen();
  const cdpPort = await getFreePort();
  const chromeBin = findChrome();
  chromeProc = spawn(chromeBin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${path.join(tmpDir, 'profile')}`,
    'about:blank',
  ], { stdio: 'ignore' });

  const cdp = await connectCdp(cdpPort);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Interceptar descargas Blob en memoria (`window.__savedFiles`) además de permitir descargas en disco,
  // y exponer `navigator.serial` conectado a las tramas del puente C++17 cuando se pulsa `#connect`.
  const preloadScript = `
    window.__savedFiles = [];
    window.__serialTxHex = [];
    window.__serialOpenedCfg = null;
    const __blobMap = new Map();
    const __origCreateUrl = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function(obj) {
      const u = __origCreateUrl(obj);
      if (obj && typeof obj.text === 'function') __blobMap.set(u, obj);
      return u;
    };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.download && this.href && __blobMap.has(this.href)) {
        const name = this.download;
        const blob = __blobMap.get(this.href);
        blob.text().then(text => { window.__savedFiles.push({ name, text }); });
      }
      return origClick.apply(this, arguments);
    };
    const BRIDGE_FRAMES = ${JSON.stringify(smokeLines)};
    const hexToBytes = (h) => {
      const a = new Uint8Array(h.length / 2);
      for (let i = 0; i < a.length; i++) a[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
      return a;
    };
    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: {
        async requestPort() {
          let closed = false;
          return {
            async open(cfg) { window.__serialOpenedCfg = cfg; },
            async close() { closed = true; },
            writable: {
              getWriter() {
                return {
                  async write(chunk) {
                    const hex = [...chunk].map(b => b.toString(16).padStart(2, '0')).join('');
                    window.__serialTxHex.push(hex);
                  },
                  releaseLock() {}
                };
              }
            },
            readable: {
              getReader() {
                let idx = 0;
                return {
                  async read() {
                    if (closed || idx >= BRIDGE_FRAMES.length) return { value: undefined, done: true };
                    await new Promise(r => setTimeout(r, 35));
                    const f = BRIDGE_FRAMES[idx++];
                    return { value: hexToBytes(f.hex), done: false };
                  },
                  async cancel() { closed = true; },
                  releaseLock() {}
                };
              }
            }
          };
        }
      }
    });
  `;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: preloadScript });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/senda/personas.html` });

  // Esperar a que cargue personas.mjs
  const evalJs = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`Excepción JS en página: ${JSON.stringify(r.exceptionDetails)}`);
    return r.result?.value;
  };

  for (let i = 0; i < 50; i++) {
    const ready = await evalJs(`Boolean(document.getElementById('tracks')?.innerHTML.length > 0 && typeof document.getElementById('fStart')?.onclick === 'function')`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  // --- FLUJO 1: «Simulación» -> «Práctica de campo» ---
  await evalJs(`
    document.getElementById('fNote').value = 'Prueba de humo H1 (modo simulación)';
    document.getElementById('fStart').click();
    document.getElementById('demo').click();
    true;
  `);
  await new Promise((r) => setTimeout(r, 1400));
  await evalJs(`
    document.getElementById('fMark').click();
    document.getElementById('fEnd').click();
    document.getElementById('stop').click();
    true;
  `);
  for (let i = 0; i < 30; i++) {
    const count = await evalJs(`window.__savedFiles.length`);
    if (count >= 1) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const simFile = await evalJs(`window.__savedFiles[0]`);
  if (!simFile?.name?.startsWith('senda-campo-')) {
    throw new Error(`No se generó senda-campo-*.json en Flujo 1: ${JSON.stringify(simFile)}`);
  }
  const simPath = path.join(tmpDir, `sim-${simFile.name}`);
  fs.writeFileSync(simPath, simFile.text);
  const simReport = JSON.parse(execFileSync(process.execPath, [REPORT_SCRIPT, simPath], { encoding: 'utf8' }));
  if (simReport.integrity !== 'OK' || simReport.summary.basis !== 'SIMULATION' || simReport.summary.frames < 8) {
    throw new Error(`Informe inválido en Flujo 1: ${JSON.stringify(simReport)}`);
  }
  console.log(`✔ Flujo 1 («Simulación» → «Práctica de campo»): ${simFile.name} · integrity=${simReport.integrity} · frames=${simReport.summary.frames} · basis=${simReport.summary.basis}`);

  // --- FLUJO 2: «Conectar radar (USB)» contra el puente transparente C++17 ---
  await evalJs(`
    document.getElementById('fScenario').selectedIndex = 2; // Dos personas cruzándose
    document.getElementById('fNote').value = 'Puente transparente C++17 (tramas sintéticas de humo en VM)';
    document.getElementById('fStart').click();
    document.getElementById('connect').click();
    true;
  `);
  await new Promise((r) => setTimeout(r, 1800));
  await evalJs(`
    document.getElementById('fMark').click();
    document.getElementById('fEnd').click();
    document.getElementById('stop').click();
    true;
  `);
  for (let i = 0; i < 30; i++) {
    const count = await evalJs(`window.__savedFiles.length`);
    if (count >= 2) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  const serialCfg = await evalJs(`window.__serialOpenedCfg`);
  const txHex = /** @type {string[]} */ (await evalJs(`window.__serialTxHex`));
  const bridgeFile = await evalJs(`window.__savedFiles[1]`);

  if (serialCfg?.baudRate !== 256000 || serialCfg?.dataBits !== 8 || serialCfg?.stopBits !== 1 || serialCfg?.parity !== 'none') {
    throw new Error(`Configuración serie inesperada desde /senda/personas: ${JSON.stringify(serialCfg)}`);
  }
  if (
    txHex[0] !== 'fdfcfbfa0400ff00010004030201' ||
    txHex[1] !== 'fdfcfbfa0200900004030201' ||
    txHex[2] !== 'fdfcfbfa0200fe0004030201'
  ) {
    throw new Error(`Órdenes FD FC FB FA inesperadas desde /senda/personas: ${JSON.stringify(txHex)}`);
  }

  const bridgePath = path.join(tmpDir, `bridge-${bridgeFile.name}`);
  fs.writeFileSync(bridgePath, bridgeFile.text);
  const bridgeReport = JSON.parse(execFileSync(process.execPath, [REPORT_SCRIPT, bridgePath], { encoding: 'utf8' }));
  if (
    bridgeReport.integrity !== 'OK' ||
    bridgeReport.summary.corruptFrames !== 0 ||
    bridgeReport.summary.frames < 20 ||
    bridgeReport.summary.maxSimultaneousTracks !== 2
  ) {
    throw new Error(`Informe inválido en Flujo 2 (puente C++): ${JSON.stringify(bridgeReport)}`);
  }
  console.log(`✔ Flujo 2 («Conectar radar» ↔ puente C++17 transparente → «Práctica de campo»): ${bridgeFile.name} · 256000 8N1 · 3 órdenes FD FC FB FA verificadas · integrity=${bridgeReport.integrity} · frames=${bridgeReport.summary.frames} · corruptFrames=0 · maxSimultaneousTracks=${bridgeReport.summary.maxSimultaneousTracks}`);
  console.log('ℹ Aviso de veracidad: tramas sintéticas ejecutadas en máquina virtual sin sensor físico; los paquetes temporales se eliminan al cerrar la prueba.');

  try { await cdp.send('Browser.close'); } catch {}
  cdp.close();
} finally {
  if (chromeProc) {
    try { chromeProc.kill('SIGKILL'); } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  await server.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}

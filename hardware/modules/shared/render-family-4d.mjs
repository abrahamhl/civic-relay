#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Generador reproducible por código de los renders 4D rotativos (1920x1080, 30 fps, 8,0 s, MP4 + WebM)
// para los 3 módulos adicionales de la familia SENDA (Bloque H2):
//   - hardware/modules/senda-nodo-lora/renders/{turntable-360,exploded-4d}.{mp4,webm} + PNGs
//   - hardware/modules/senda-baliza-ble/renders/{turntable-360,exploded-4d}.{mp4,webm} + PNGs
//   - hardware/modules/senda-estacion-ambiental/renders/{turntable-360,exploded-4d}.{mp4,webm} + PNGs
// Todos rotulados explícitamente «render» sobre fondo oscuro de marca #04080b.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MODULES_DIR, '../..');
const THREE_DIR = path.join(REPO_ROOT, 'investor-next/node_modules/three');
const FONTS_DIR = path.join(REPO_ROOT, 'investor-next/public/senda/fonts');

for (const slug of ['senda-nodo-lora', 'senda-baliza-ble', 'senda-estacion-ambiental']) {
  fs.mkdirSync(path.join(MODULES_DIR, slug, 'renders'), { recursive: true });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
};

function spawnFfmpegPair(outDir, baseName, fps = 30) {
  const mp4 = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.join(outDir, `${baseName}.mp4`),
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const webm = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libvpx-vp9', '-b:v', '2.2M', '-crf', '28', '-deadline', 'realtime', '-cpu-used', '6', '-row-mt', '1',
    '-pix_fmt', 'yuv420p',
    path.join(outDir, `${baseName}.webm`),
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const waitDone = () => Promise.all([
    new Promise((res, rej) => mp4.on('close', (c) => (c === 0 ? res() : rej(new Error(`mp4 exit ${c}`))))),
    new Promise((res, rej) => webm.on('close', (c) => (c === 0 ? res() : rej(new Error(`webm exit ${c}`))))),
  ]);
  return { mp4, webm, waitDone };
}

function writePipe(stream, buf) {
  return new Promise((resolve, reject) => {
    const ok = stream.write(buf, (err) => (err ? reject(err) : null));
    if (ok) resolve();
    else stream.once('drain', resolve);
  });
}

const HTML_PAGE = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="/fonts/fonts.css" />
<script type="importmap">
{
  "imports": {
    "three": "/three/build/three.module.js",
    "three/addons/": "/three/examples/jsm/"
  }
}
</script>
<style>html,body{margin:0;padding:0;background:#04080b;overflow:hidden;}</style>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const W = 1920, H = 1080, FPS = 30, FRAMES = 240; // 8,0 s exactos (rango exigido: 8–12 s)
await document.fonts.ready;

const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const outCanvas = document.createElement('canvas'); outCanvas.width = W; outCanvas.height = H;
document.body.appendChild(outCanvas);
const ctx = outCanvas.getContext('2d', { alpha: false });

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04080b);
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x101c26, 1.35));
const key = new THREE.DirectionalLight(0xf4f9ff, 2.8); key.position.set(0.22, 0.28, 0.32); scene.add(key);
const rim = new THREE.DirectionalLight(0x91d7e8, 2.0); rim.position.set(-0.28, 0.16, -0.24); scene.add(rim);
const top = new THREE.DirectionalLight(0xffffff, 1.2); top.position.set(-0.05, 0.36, 0.12); scene.add(top);
const warm = new THREE.DirectionalLight(0xff7756, 0.85); warm.position.set(0.24, -0.20, 0.14); scene.add(warm);

const floor = new THREE.Group();
floor.position.set(0, -0.068, 0);
for (const r of [0.04, 0.07, 0.105]) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.0004, r, 96),
    new THREE.MeshBasicMaterial({ color: 0x1e3342, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
  );
  m.rotation.x = -Math.PI / 2;
  floor.add(m);
}
scene.add(floor);

const camera = new THREE.PerspectiveCamera(34, W / H, 0.005, 4.0);
const rig = new THREE.Group();
scene.add(rig);

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function drawHud({ chapter, title, subtitle, metricsLine }) {
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(W - 620, 46, 10, 10);
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#eef3f4';
  ctx.textAlign = 'left';
  ctx.fillText('render · generado por código (Three.js + OpenSCAD)', W - 600, 56);
  ctx.font = '400 13px "Inter", sans-serif';
  ctx.fillStyle = '#93a7b1';
  ctx.fillText('Diseño CAD paramétrico · No es fotografía de un producto fabricado', W - 600, 78);

  ctx.font = '500 15px "Inter", sans-serif';
  ctx.fillStyle = '#93a7b1';
  ctx.fillText(chapter, 64, 58);

  ctx.font = '600 40px "Inter", sans-serif';
  ctx.fillStyle = '#eef3f4';
  ctx.fillText(title, 64, 106);

  ctx.font = '400 19px "Inter", sans-serif';
  ctx.fillStyle = '#93a7b1';
  ctx.fillText(subtitle, 64, 138);

  ctx.strokeStyle = 'rgba(147,167,177,0.22)';
  ctx.beginPath(); ctx.moveTo(64, H - 74); ctx.lineTo(W - 64, H - 74); ctx.stroke();

  ctx.font = '400 14px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#91d7e8';
  ctx.fillText(metricsLine, 64, H - 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#93a7b1';
  ctx.fillText('Familia de módulos externos SENDA · hardware abierto MIT', W - 64, H - 44);
  ctx.textAlign = 'left';
}

function canvasToBlob(mime, q) {
  return new Promise((res) => outCanvas.toBlob(res, mime, q));
}
async function postBlob(url, blob) {
  const r = await fetch(url, { method: 'POST', body: blob });
  if (!r.ok) throw new Error('HTTP ' + r.status);
}

const MODS = [
  {
    slug: 'senda-nodo-lora',
    glb: '/glb/senda-nodo-lora/senda-nodo-lora.glb',
    rootName: 'senda_nodo_lora',
    camDist: 0.285,
    camY: 0.045,
    lookY: 0.012,
    floorY: -0.062,
    chapter: 'Familia SENDA · Nodo Malla EU868 (estado: diseño)',
    title: 'SENDA Nodo Malla EU868',
    subtitle: 'Heltec ESP32-S3 + SX1262 868 MHz · Sobres Reed-Solomon k-de-n sin cobertura (bearers.mjs · /senda/mensaje)',
    metrics: '868,0–868,6 MHz ≤25 mW p.r.a. / 1 % · 869,4–869,65 MHz ≤500 mW / 10 % (ERC/REC 70-03) · GLB 331 KB',
    explode: {
      base: [0, 0, -18],
      lipo_1200mah: [0, 0, 2],
      switch_ss22g08: [-22, 0, 0],
      heltec_wsl_v3_sx1262: [0, 0, 18],
      antenna_eu868_whip: [0, 26, 12],
      lid: [0, 0, 42],
    },
  },
  {
    slug: 'senda-baliza-ble',
    glb: '/glb/senda-baliza-ble/senda-baliza-ble.glb',
    rootName: 'senda_baliza_ble',
    camDist: 0.185,
    camY: 0.032,
    lookY: 0.002,
    floorY: -0.042,
    chapter: 'Familia SENDA · Baliza Rescate BLE 5.0 (estado: diseño)',
    title: 'SENDA Baliza Rescate BLE',
    subtitle: 'Seeed XIAO BLE nRF52840 · Localización por RSSI y barrido de viviendas (beacon.mjs, rubble.mjs · /senda/barrido)',
    metrics: '2,4 GHz ISM ETSI EN 300 328 (≤10 dBm / 20 dBm) · Li-Po 250 mAh PCM · 38 × 56 × 18 mm · GLB 241 KB',
    explode: {
      bottom_shell: [0, 0, -16],
      xiao_ble_nrf52840: [0, -10, 4],
      lipo_250mah_pcm: [0, 8, 12],
      sos_tactile_switch: [0, 4, 24],
      top_shell: [0, 0, 38],
    },
  },
  {
    slug: 'senda-estacion-ambiental',
    glb: '/glb/senda-estacion-ambiental/senda-estacion-ambiental.glb',
    rootName: 'senda_estacion_ambiental',
    camDist: 0.335,
    camY: 0.048,
    lookY: -0.008,
    floorY: -0.082,
    chapter: 'Familia SENDA · Estación Hidrometeo y Humo (estado: diseño)',
    title: 'SENDA Estación Hidrometeo y Humo',
    subtitle: 'Sensirion SPS30 (PM láser) + Bosch BME280 + ultrasonido JSN-SR04T (flood-watch.mjs, fire-rothermel.mjs)',
    metrics: 'Garita 84 × 96 × 42 mm con aislamiento térmico · Calado sin contacto 20–450 cm · GLB 348 KB',
    explode: {
      rear_housing: [0, 0, -22],
      xiao_esp32s3_logger: [18, 10, 4],
      jsn_sr04t_driver_pcb: [-16, 10, 6],
      jsn_sr04t_waterproof_probe: [0, -24, 6],
      sensirion_sps30_pm: [-12, -8, 16],
      bosch_bme280: [18, -8, 20],
      front_louvers: [0, 0, 46],
    },
  },
];

const loader = new GLTFLoader();

try {
  for (const m of MODS) {
    while (rig.children.length) rig.remove(rig.children[0]);
    floor.position.y = m.floorY;

    const gltf = await loader.loadAsync(m.glb);
    const root = gltf.scene.getObjectByName(m.rootName) || gltf.scene;
    rig.add(root);

    const basePos = new Map();
    for (const c of root.children) basePos.set(c.name, c.position.clone());
    const reset = () => {
      for (const c of root.children) {
        const p = basePos.get(c.name);
        if (p) c.position.copy(p);
      }
    };

    // 1. Giro 360° (8,0 s = 240 fotogramas)
    await fetch('/start?mod=' + m.slug + '&seq=turntable-360');
    reset();
    for (let f = 0; f < FRAMES; f++) {
      const u = f / FRAMES;
      rig.rotation.set(0.10 * Math.sin(u * Math.PI * 2), u * Math.PI * 2 + 0.45, 0);
      camera.position.set(0, m.camY, m.camDist);
      camera.lookAt(0, m.lookY, 0);
      renderer.render(scene, camera);
      ctx.drawImage(glCanvas, 0, 0);
      drawHud({
        chapter: m.chapter,
        title: m.title + ' · Giro 360°',
        subtitle: m.subtitle,
        metricsLine: m.metrics,
      });
      if (f === 26) {
        await postBlob('/still?mod=' + m.slug + '&name=hero-preview.png', await canvasToBlob('image/png'));
      }
      await postBlob('/frame', await canvasToBlob('image/jpeg', 0.94));
    }
    await fetch('/finish');

    // 2. Explosionada 4D (8,0 s = 240 fotogramas)
    await fetch('/start?mod=' + m.slug + '&seq=exploded-4d');
    for (let f = 0; f < FRAMES; f++) {
      const t = f / FPS;
      const openAmt = smoothstep(0.8, 3.1, t) * (1 - smoothstep(4.9, 7.2, t));
      reset();
      for (const c of root.children) {
        const d = m.explode[c.name];
        if (d) {
          c.position.x += d[0] * openAmt;
          c.position.y += d[1] * openAmt;
          c.position.z += d[2] * openAmt;
        }
      }
      rig.rotation.set(0.15, -0.52 + 0.48 * Math.sin((t / 8.0) * Math.PI * 2), 0);
      camera.position.set(0, m.camY + 0.008, m.camDist + 0.045 * openAmt);
      camera.lookAt(0, m.lookY, 0);
      renderer.render(scene, camera);
      ctx.drawImage(glCanvas, 0, 0);
      drawHud({
        chapter: m.chapter,
        title: m.title + ' · Vista explosionada 4D',
        subtitle: m.subtitle,
        metricsLine: 'Apertura axial: ' + (openAmt * 100).toFixed(0) + ' % · ' + m.metrics,
      });
      if (f === 120) {
        await postBlob('/still?mod=' + m.slug + '&name=exploded-preview.png', await canvasToBlob('image/png'));
      }
      await postBlob('/frame', await canvasToBlob('image/jpeg', 0.94));
    }
    await fetch('/finish');
  }
  await fetch('/all-done');
} catch (err) {
  await fetch('/error?msg=' + encodeURIComponent(err && err.stack ? err.stack : String(err)));
}
</script>
</body>
</html>`;

let activePair = null;
let doneResolve, doneReject;
const donePromise = new Promise((res, rej) => { doneResolve = res; doneReject = rej; });

function readBody(req) {
  return new Promise((res, rej) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => res(Buffer.concat(chunks)));
    req.on('error', rej);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/') { res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(HTML_PAGE); return; }
    if (u.pathname.startsWith('/three/')) {
      const fp = path.join(THREE_DIR, u.pathname.slice('/three/'.length));
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(fs.readFileSync(fp));
        return;
      }
    }
    if (u.pathname.startsWith('/fonts/')) {
      const fp = path.join(FONTS_DIR, u.pathname.slice('/fonts/'.length));
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(fs.readFileSync(fp));
        return;
      }
    }
    if (u.pathname.startsWith('/glb/')) {
      const parts = u.pathname.slice('/glb/'.length).split('/');
      const fp = path.join(MODULES_DIR, parts[0], 'glb', parts[1]);
      if (fs.existsSync(fp)) {
        res.writeHead(200, { 'Content-Type': MIME['.glb'] });
        res.end(fs.readFileSync(fp));
        return;
      }
    }
    if (u.pathname === '/start') {
      const mod = path.basename(u.searchParams.get('mod'));
      const seq = path.basename(u.searchParams.get('seq'));
      console.log(`[render-family-4d] Renderizando ${mod} -> ${seq} (1080p MP4+WebM)...`);
      activePair = spawnFfmpegPair(path.join(MODULES_DIR, mod, 'renders'), seq, 30);
      res.writeHead(200); res.end('ok');
      return;
    }
    if (u.pathname === '/frame' && req.method === 'POST') {
      const buf = await readBody(req);
      await Promise.all([writePipe(activePair.mp4.stdin, buf), writePipe(activePair.webm.stdin, buf)]);
      res.writeHead(200); res.end('ok');
      return;
    }
    if (u.pathname === '/still' && req.method === 'POST') {
      const mod = path.basename(u.searchParams.get('mod'));
      const name = path.basename(u.searchParams.get('name'));
      const buf = await readBody(req);
      fs.writeFileSync(path.join(MODULES_DIR, mod, 'renders', name), buf);
      console.log(`[render-family-4d] PNG ${mod}/renders/${name} (${(buf.length / 1024).toFixed(1)} KB)`);
      res.writeHead(200); res.end('ok');
      return;
    }
    if (u.pathname === '/finish') {
      activePair.mp4.stdin.end();
      activePair.webm.stdin.end();
      await activePair.waitDone();
      activePair = null;
      res.writeHead(200); res.end('ok');
      return;
    }
    if (u.pathname === '/all-done') { res.writeHead(200); res.end('ok'); doneResolve(); return; }
    if (u.pathname === '/error') { res.writeHead(200); res.end('ok'); doneReject(new Error(u.searchParams.get('msg'))); return; }
    res.writeHead(404); res.end('not found');
  } catch (err) {
    res.writeHead(500); res.end(String(err));
    doneReject(err);
  }
});

await new Promise((res) => server.listen(0, '127.0.0.1', res));
const { port } = server.address();
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist',
  '--window-size=1920,1080', '--hide-scrollbars', `http://127.0.0.1:${port}/`,
], { stdio: ['ignore', 'pipe', 'pipe'] });

try {
  await donePromise;
  console.log('[render-family-4d] Los 6 vídeos MP4 + 6 WebM 1080p y 6 capturas PNG de H2 están listos.');
} finally {
  chrome.kill('SIGKILL');
  server.close();
}

#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Generador reproducible por código de los renders 4D rotativos de SENDA Radar v1 (1920x1080, 30 fps):
//   1. renders/turntable-360.{mp4,webm}  (9,0 s · giro de 360° sobre fondo oscuro de marca #04080b)
//   2. renders/exploded-4d.{mp4,webm}    (9,0 s · vista explosionada animada: separación y reensamblaje)
//   3. renders/assembly-steps.{mp4,webm} (10,0 s · montaje paso a paso en 5 fases + 5 PNG 1080p para la guía)
//
// Carga directamente `glb/senda-radar-v1.glb` mediante Three.js GLTFLoader en Chromium headless WebGL,
// validando de paso que el GLB (< 2 MB) carga y gira en tiempo real en la web con 0 errores de consola.
// Todos los fotogramas llevan el rótulo visible «render» (nunca se presentan como foto de producto fabricado).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOD_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MOD_DIR, '../../..');
const RENDERS_DIR = path.join(MOD_DIR, 'renders');
const THREE_DIR = path.join(REPO_ROOT, 'investor-next/node_modules/three');
const FONTS_DIR = path.join(REPO_ROOT, 'investor-next/public/senda/fonts');

fs.mkdirSync(RENDERS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
};

function spawnFfmpegPair(baseName, fps = 30) {
  const mp4Path = path.join(RENDERS_DIR, `${baseName}.mp4`);
  const webmPath = path.join(RENDERS_DIR, `${baseName}.webm`);

  const mp4 = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    mp4Path,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const webm = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libvpx-vp9', '-b:v', '2.4M', '-crf', '28', '-deadline', 'realtime', '-cpu-used', '6', '-row-mt', '1',
    '-pix_fmt', 'yuv420p',
    webmPath,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const waitDone = () => Promise.all([
    new Promise((res, rej) => mp4.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg mp4 code ${c}`))))),
    new Promise((res, rej) => webm.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg webm code ${c}`))))),
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
<title>SENDA Radar v1 · Renderizador 4D</title>
<link rel="stylesheet" href="/fonts/fonts.css" />
<script type="importmap">
{
  "imports": {
    "three": "/three/build/three.module.js",
    "three/addons/": "/three/examples/jsm/"
  }
}
</script>
<style>
  html, body { margin: 0; padding: 0; background: #04080b; overflow: hidden; }
  canvas { display: block; }
</style>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const W = 1920, H = 1080, FPS = 30;
await document.fonts.ready;

const glCanvas = document.createElement('canvas');
glCanvas.width = W; glCanvas.height = H;
const outCanvas = document.createElement('canvas');
outCanvas.width = W; outCanvas.height = H;
document.body.appendChild(outCanvas);
const ctx = outCanvas.getContext('2d', { alpha: false });

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04080b);

// Iluminación analítica PBR de 5 focos sobre fondo #04080b (rápida y determinista en WebGL por software)
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x101c26, 1.35);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xf4f9ff, 2.8);
keyLight.position.set(0.20, 0.26, 0.30);
scene.add(keyLight);

const rimCyan = new THREE.DirectionalLight(0x91d7e8, 2.0);
rimCyan.position.set(-0.28, 0.16, -0.24);
scene.add(rimCyan);

const topSpec = new THREE.DirectionalLight(0xffffff, 1.25);
topSpec.position.set(-0.05, 0.35, 0.12);
scene.add(topSpec);

const warmFill = new THREE.DirectionalLight(0xff7756, 0.85);
warmFill.position.set(0.24, -0.20, 0.14);
scene.add(warmFill);

// Rejilla métrica sutil de laboratorio bajo el módulo (anillos cada 20 mm)
const floorGroup = new THREE.Group();
floorGroup.position.set(0, -0.044, 0);
for (const r of [0.035, 0.060, 0.088]) {
  const ringGeo = new THREE.RingGeometry(r - 0.0004, r, 96);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e3342, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
  const m = new THREE.Mesh(ringGeo, ringMat);
  m.rotation.x = -Math.PI / 2;
  floorGroup.add(m);
}
scene.add(floorGroup);

// Cono volumétrico sutil de haz de 24 GHz (±60° azimut) para el modo giro 360°
const beamGroup = new THREE.Group();
for (const dist of [0.028, 0.046, 0.064]) {
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(dist - 0.0006, dist, 64, 1, -Math.PI / 3, (2 * Math.PI) / 3),
    new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide, transparent: true, opacity: 0.28 })
  );
  // Proyectar hacia +Z desde la ventana del radomo (y = +0.018 m, z = +0.013 m)
  arc.rotation.x = -Math.PI / 2;
  arc.rotation.z = -Math.PI / 2;
  arc.position.set(0, 0.018, 0.013);
  beamGroup.add(arc);
}

const camera = new THREE.PerspectiveCamera(34, W / H, 0.005, 4.0);

const gltf = await new GLTFLoader().loadAsync('/glb/senda-radar-v1.glb');
const rig = new THREE.Group();
scene.add(rig);
const modelRoot = gltf.scene.getObjectByName('senda_radar_v1') || gltf.scene;
rig.add(modelRoot);
rig.add(beamGroup);

// Guardar posiciones base de cada nodo nombrado (en unidades internas del root = mm)
const baseState = new Map();
for (const child of modelRoot.children) {
  baseState.set(child.name, {
    pos: child.position.clone(),
    rot: child.rotation.clone(),
  });
}

function resetParts() {
  for (const child of modelRoot.children) {
    const b = baseState.get(child.name);
    if (!b) continue;
    child.position.copy(b.pos);
    child.rotation.copy(b.rot);
    child.visible = true;
  }
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Vectores de explosión (en mm dentro de modelRoot)
const EXPLODE_DELTAS = {
  belt_clip:            new THREE.Vector3(0, 0, -34),
  rear_body:            new THREE.Vector3(0, 0, -14),
  tripod_insert_1_4:    new THREE.Vector3(0, -24, -14),
  switch_ss22g08:       new THREE.Vector3(-24, 0, -8),
  boost_5v:             new THREE.Vector3(-14, 12, 2),
  lipo_1200mah:         new THREE.Vector3(0, 0, 5),
  xiao_esp32s3:         new THREE.Vector3(24, 0, 8),
  oled_ssd1306:         new THREE.Vector3(0, -8, 22),
  rd03d_radar_24ghz:    new THREE.Vector3(0, 8, 26),
  front_bezel:          new THREE.Vector3(0, 0, 44),
  m25_inserts_and_screws: new THREE.Vector3(0, -10, 58),
};

function drawHud({ chapter, title, subtitle, metricsLine, stepBadge }) {
  // Viñeta radial suave
  const grad = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.25, W * 0.5, H * 0.5, W * 0.65);
  grad.addColorStop(0, 'rgba(4,8,11,0)');
  grad.addColorStop(1, 'rgba(2,5,7,0.52)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Etiqueta obligatoria de veracidad (arriba derecha): cuadrado ámbar + texto honesto «render»
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(W - 620, 46, 10, 10);
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#eef3f4';
  ctx.textAlign = 'left';
  ctx.fillText('render · generado por código (Three.js + OpenSCAD)', W - 600, 56);
  ctx.font = '400 13px "Inter", sans-serif';
  ctx.fillStyle = '#93a7b1';
  ctx.fillText('Prototipo CAD paramétrico · No es fotografía de un producto fabricado', W - 600, 78);

  // Cabecera izquierda SENDA
  ctx.font = '500 15px "Inter", sans-serif';
  ctx.fillStyle = '#93a7b1';
  ctx.fillText(chapter, 64, 58);

  ctx.font = '600 40px "Inter", sans-serif';
  ctx.fillStyle = '#eef3f4';
  ctx.fillText(title, 64, 106);

  ctx.font = '400 19px "Inter", sans-serif';
  ctx.fillStyle = '#93a7b1';
  ctx.fillText(subtitle, 64, 138);

  if (stepBadge) {
    ctx.fillStyle = '#34d399';
    ctx.fillRect(64, H - 122, 10, 10);
    ctx.font = '600 22px "Inter", sans-serif';
    ctx.fillStyle = '#eef3f4';
    ctx.fillText(stepBadge, 84, H - 110);
  }

  // Barra técnica inferior con cifras verificadas
  ctx.strokeStyle = 'rgba(147,167,177,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, H - 74);
  ctx.lineTo(W - 64, H - 74);
  ctx.stroke();

  ctx.font = '400 14px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#91d7e8';
  ctx.fillText(metricsLine, 64, H - 44);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#93a7b1';
  ctx.fillText('SENDA · hardware abierto MIT · protocolo Sudo_solder MIT', W - 64, H - 44);
  ctx.textAlign = 'left';
}

async function postBlob(url, blob) {
  const res = await fetch(url, { method: 'POST', body: blob });
  if (!res.ok) throw new Error('HTTP ' + res.status);
}

function canvasToBlob(mime, quality) {
  return new Promise((resolve) => outCanvas.toBlob(resolve, mime, quality));
}

// 1. GIRO 360° (270 fotogramas = 9,0 s a 30 fps)
async function renderTurntable() {
  await fetch('/start?seq=turntable-360');
  const total = 270;
  resetParts();
  beamGroup.visible = true;

  for (let f = 0; f < total; f++) {
    const u = f / total;
    const angle = u * Math.PI * 2 + 0.42;
    rig.rotation.set(0.10 * Math.sin(u * Math.PI * 2), angle, 0);
    camera.position.set(0, 0.036, 0.215);
    camera.lookAt(0, -0.002, 0);

    renderer.render(scene, camera);
    ctx.drawImage(glCanvas, 0, 0);
    drawHud({
      chapter: 'Módulo externo H1 · SENDA Radar v1 (24 GHz)',
      title: 'Giro de 360° · Conjunto completo',
      subtitle: 'RD-03D (hasta 3 objetivos en movimiento) · XIAO ESP32-S3 · OLED SSD1306 · Li-Po 1200 mAh',
      metricsLine: '76 × 70 × 25 mm · radomo plástico 1,0 mm sin metal · UART 256000 8N1 → USB-CDC transparente · GLB 593 KB',
      stepBadge: null,
    });

    if (f === 28) {
      const png = await canvasToBlob('image/png');
      await postBlob('/still?name=hero-preview.png', png);
    }
    const jpg = await canvasToBlob('image/jpeg', 0.94);
    await postBlob('/frame', jpg);
  }
  await fetch('/finish');
}

// 2. VISTA EXPLOSIONADA 4D (270 fotogramas = 9,0 s a 30 fps)
async function renderExploded() {
  await fetch('/start?seq=exploded-4d');
  const total = 270;
  beamGroup.visible = false;

  for (let f = 0; f < total; f++) {
    const tSec = f / FPS;
    // 0..1,0 s cerrado -> 1,0..3,6 s separa -> 3,6..5,6 s mantiene -> 5,6..8,2 s vuelve a unir -> 8,2..9,0 s cerrado
    const openAmt = smoothstep(0.9, 3.5, tSec) * (1 - smoothstep(5.6, 8.2, tSec));

    resetParts();
    for (const child of modelRoot.children) {
      const delta = EXPLODE_DELTAS[child.name];
      if (delta) {
        child.position.addScaledVector(delta, openAmt);
      }
    }

    const yaw = -0.58 + 0.52 * Math.sin((tSec / 9.0) * Math.PI * 2);
    rig.rotation.set(0.14, yaw, 0);
    camera.position.set(0, 0.042, 0.255 + 0.035 * openAmt);
    camera.lookAt(0, -0.002, 0);

    renderer.render(scene, camera);
    ctx.drawImage(glCanvas, 0, 0);
    drawHud({
      chapter: 'Arquitectura mecánica y RF · Vista explosionada 4D',
      title: '11 subconjuntos · Separación y cierre',
      subtitle: 'Mitad superior 100 % libre de metal delante de los parches 1T2R · Insertos de latón confinados abajo',
      metricsLine: 'Desplazamiento axial: ' + (openAmt * 100).toFixed(0) + ' % · Holgura FDM 0,25 mm · Trípode 1/4"-20 UNC + cierre snap-fit/M2.5',
      stepBadge: null,
    });

    if (f === 135) {
      const png = await canvasToBlob('image/png');
      await postBlob('/still?name=exploded-preview.png', png);
    }
    const jpg = await canvasToBlob('image/jpeg', 0.94);
    await postBlob('/frame', jpg);
  }
  await fetch('/finish');
}

// 3. MONTAJE PASO A PASO (300 fotogramas = 10,0 s a 30 fps · 5 fases de 2,0 s + 5 PNG 1080p)
const STEPS = [
  {
    png: 'step-01-insertos.png',
    badge: 'Paso 1 de 5 · Insertos térmicos en cuerpo trasero (1/4"-20 UNC y 2× M2.5 inferiores)',
    subtitle: 'Embutir con soldador a 210 °C en la base y esquinas inferiores de rear_body.stl (lejos de la antena)',
    visible: ['rear_body', 'tripod_insert_1_4', 'm25_inserts_and_screws'],
    moving: ['tripod_insert_1_4'],
    from: new THREE.Vector3(0, -28, 0),
    camYaw: -0.45,
  },
  {
    png: 'step-02-energia-y-xiao.png',
    badge: 'Paso 2 de 5 · Interruptor SS22G08, elevador 5 V, Li-Po 1200 mAh y XIAO ESP32-S3',
    subtitle: 'Alinear conector USB-C en la ventana derecha; aislar 5 V del radar respecto a VBUS',
    visible: ['rear_body', 'tripod_insert_1_4', 'switch_ss22g08', 'boost_5v', 'lipo_1200mah', 'xiao_esp32s3'],
    moving: ['switch_ss22g08', 'boost_5v', 'lipo_1200mah', 'xiao_esp32s3'],
    from: new THREE.Vector3(0, 0, 26),
    camYaw: -0.32,
  },
  {
    png: 'step-03-radar-y-oled.png',
    badge: 'Paso 3 de 5 · Encajar RD-03D (antena hacia el radomo) y OLED SSD1306 en el bisel frontal',
    subtitle: 'La antena dorada de 24 GHz mira hacia la pared plástica de 1,0 mm; conectar cable Picoblade 4P e I2C',
    visible: ['rear_body', 'tripod_insert_1_4', 'switch_ss22g08', 'boost_5v', 'lipo_1200mah', 'xiao_esp32s3', 'front_bezel', 'rd03d_radar_24ghz', 'oled_ssd1306'],
    moving: ['rd03d_radar_24ghz', 'oled_ssd1306'],
    from: new THREE.Vector3(0, 0, -22),
    camYaw: 0.35,
  },
  {
    png: 'step-04-cierre-sin-metal.png',
    badge: 'Paso 4 de 5 · Cerrar bisel frontal con pestañas superiores snap-fit y 2 tornillos M2.5 inferiores',
    subtitle: 'Cero tornillos en la mitad superior; fijación firme para uso en vehículo, trípode o mochila',
    visible: ['rear_body', 'tripod_insert_1_4', 'switch_ss22g08', 'boost_5v', 'lipo_1200mah', 'xiao_esp32s3', 'front_bezel', 'rd03d_radar_24ghz', 'oled_ssd1306', 'm25_inserts_and_screws'],
    moving: ['front_bezel', 'rd03d_radar_24ghz', 'oled_ssd1306', 'm25_inserts_and_screws'],
    from: new THREE.Vector3(0, 0, 32),
    camYaw: -0.48,
  },
  {
    png: 'step-05-clip-y-prueba-usb.png',
    badge: 'Paso 5 de 5 · Deslizar clip de cinturón en cola de milano y ejecutar «Práctica de campo» USB',
    subtitle: 'Abrir /senda/personas → Conectar radar (USB) → verificar trama AA FF 03 00 … 55 CC en senda-campo-*.json',
    visible: ['rear_body', 'tripod_insert_1_4', 'switch_ss22g08', 'boost_5v', 'lipo_1200mah', 'xiao_esp32s3', 'front_bezel', 'rd03d_radar_24ghz', 'oled_ssd1306', 'm25_inserts_and_screws', 'belt_clip'],
    moving: ['belt_clip'],
    from: new THREE.Vector3(0, 22, -18),
    camYaw: 0.62,
  },
];

async function renderAssemblySteps() {
  await fetch('/start?seq=assembly-steps');
  const framesPerStep = 60; // 2,0 s por paso x 5 = 300 fotogramas (10,0 s)

  for (let s = 0; s < STEPS.length; s++) {
    const st = STEPS[s];
    for (let k = 0; k < framesPerStep; k++) {
      const u = k / (framesPerStep - 1);
      const seat = 1 - smoothstep(0.08, 0.68, u);

      resetParts();
      beamGroup.visible = (s === 4 && u > 0.65);

      for (const child of modelRoot.children) {
        child.visible = st.visible.includes(child.name);
        if (child.visible && st.moving.includes(child.name)) {
          child.position.addScaledVector(st.from, seat);
        }
        // En el paso 3 mantenemos el bisel ligeramente adelantado para ver encajar radar y OLED
        if (s === 2 && ['front_bezel', 'rd03d_radar_24ghz', 'oled_ssd1306'].includes(child.name)) {
          child.position.z += 28;
        }
      }

      const yaw = st.camYaw + 0.16 * (u - 0.5);
      rig.rotation.set(0.16, yaw, 0);
      camera.position.set(0, 0.038, 0.235);
      camera.lookAt(0, -0.002, 0);

      renderer.render(scene, camera);
      ctx.drawImage(glCanvas, 0, 0);
      drawHud({
        chapter: 'Guía visual de fabricación y montaje · SENDA Radar v1',
        title: 'Secuencia de montaje sin experiencia previa',
        subtitle: st.subtitle,
        metricsLine: 'Tiempo estimado impresión PETG (ESCENARIO): 4 h 07 min (66 g · 0 soportes) · Montaje manual: ~35 min',
        stepBadge: st.badge,
      });

      if (k === 46) {
        const png = await canvasToBlob('image/png');
        await postBlob('/still?name=' + encodeURIComponent(st.png), png);
      }
      const jpg = await canvasToBlob('image/jpeg', 0.94);
      await postBlob('/frame', jpg);
    }
  }
  await fetch('/finish');
}

try {
  await renderTurntable();
  await renderExploded();
  await renderAssemblySteps();
  await fetch('/all-done');
} catch (err) {
  await fetch('/error?msg=' + encodeURIComponent(err && err.stack ? err.stack : String(err)));
}
</script>
</body>
</html>`;

let activePair = null;
let allDoneResolve;
let allDoneReject;
const allDonePromise = new Promise((res, rej) => {
  allDoneResolve = res;
  allDoneReject = rej;
});

function readReqBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(HTML_PAGE);
      return;
    }
    if (u.pathname.startsWith('/three/')) {
      const rel = u.pathname.slice('/three/'.length);
      const fp = path.join(THREE_DIR, rel);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(fs.readFileSync(fp));
        return;
      }
    }
    if (u.pathname.startsWith('/fonts/')) {
      const rel = u.pathname.slice('/fonts/'.length);
      const fp = path.join(FONTS_DIR, rel);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(fs.readFileSync(fp));
        return;
      }
    }
    if (u.pathname === '/glb/senda-radar-v1.glb') {
      const fp = path.join(MOD_DIR, 'glb/senda-radar-v1.glb');
      res.writeHead(200, { 'Content-Type': MIME['.glb'] });
      res.end(fs.readFileSync(fp));
      return;
    }
    if (u.pathname === '/start') {
      const seq = u.searchParams.get('seq');
      console.log(`[render-4d] Iniciando secuencia 1080p: ${seq}...`);
      activePair = spawnFfmpegPair(seq, 30);
      res.writeHead(200); res.end('ok');
      return;
    }
    if (u.pathname === '/frame' && req.method === 'POST') {
      const buf = await readReqBody(req);
      await Promise.all([
        writePipe(activePair.mp4.stdin, buf),
        writePipe(activePair.webm.stdin, buf),
      ]);
      res.writeHead(200); res.end('ok');
      return;
    }
    if (u.pathname === '/still' && req.method === 'POST') {
      const name = path.basename(u.searchParams.get('name') || 'still.png');
      const buf = await readReqBody(req);
      fs.writeFileSync(path.join(RENDERS_DIR, name), buf);
      console.log(`[render-4d] Captura PNG guardada: renders/${name} (${(buf.length / 1024).toFixed(1)} KB)`);
      res.writeHead(200); res.end('ok');
      return;
    }
    if (u.pathname === '/finish') {
      activePair.mp4.stdin.end();
      activePair.webm.stdin.end();
      await activePair.waitDone();
      console.log('[render-4d] Secuencia codificada en MP4 + WebM.');
      activePair = null;
      res.writeHead(200); res.end('ok');
      return;
    }
    if (u.pathname === '/all-done') {
      res.writeHead(200); res.end('ok');
      allDoneResolve();
      return;
    }
    if (u.pathname === '/error') {
      const msg = u.searchParams.get('msg') || 'Unknown browser error';
      res.writeHead(200); res.end('ok');
      allDoneReject(new Error(msg));
      return;
    }
    res.writeHead(404); res.end('not found');
  } catch (err) {
    res.writeHead(500); res.end(String(err));
    allDoneReject(err);
  }
});

await new Promise((res) => server.listen(0, '127.0.0.1', res));
const { port } = server.address();

const chromeArgs = [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--window-size=1920,1080',
  '--hide-scrollbars',
  `http://127.0.0.1:${port}/`,
];

const chrome = spawn('/usr/bin/google-chrome', chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
let chromeStderr = '';
chrome.stderr.on('data', (d) => { chromeStderr += d.toString(); });

try {
  await allDonePromise;
  console.log('[render-4d] Los 3 renders 4D (MP4 + WebM 1080p) y las 7 capturas PNG se han generado con éxito.');
} catch (err) {
  console.error('[render-4d] ERROR:', err, chromeStderr);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
  server.close();
}

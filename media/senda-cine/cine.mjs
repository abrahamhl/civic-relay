// SENDA · motor de cine determinista: cada fotograma depende solo de t (window.seek). Voz y tiempos: voice.py.
import { THREE, C, g, W, H, grain, ease, seg, clamp, text, font, wrap } from './kit.mjs';
import { roadKinds } from './scenes-road.mjs';
import { worldKinds } from './scenes-world.mjs';

const NAME = new URLSearchParams(location.search).get('script') || 'cine-belgica';
const TL = await (await fetch(`/media/senda-film/build/timings-${NAME}-es.json`)).json();
const SCRIPT = await (await fetch(`/media/senda-film/${NAME}.json`)).json();
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;

const TRUTH = {
  ILLUSTRATIVE: [C.sun, 'Reconstrucción ilustrativa del relato de un conductor · sin escala'],
  SIMULATION: [C.sun, 'Simulación con el código real de SENDA'],
  CALCULATED: [C.sky, 'Calculado por el código de SENDA'],
  OBSERVED: [C.mint, 'Datos publicados · informe preliminar de la CIAF y fuentes citadas · escena 3D ilustrativa'],
  MODEL_CALIBRATED_AGAINST_OBSERVED: [C.sky, 'Relieve real · simulación calibrada con lo observado por Copernicus'],
  DESIGN_RENDER: [C.sun, 'Render de diseño · prototipo en desarrollo'],
};

const KINDS = { ...roadKinds, ...worldKinds };
const built = new Map();
function sceneFor(sc) {
  if (!built.has(sc.id)) { const mk = KINDS[sc.visual.kind]; if (!mk) throw new Error('tipo de escena desconocido: ' + sc.visual.kind); built.set(sc.id, mk({ sc, renderer })); }
  return built.get(sc.id);
}
// Preparación (datos pesados) antes de declarar READY.
for (const sc of TL.scenes) { const s = sceneFor(sc); if (s.ready) await s.ready; }
await document.fonts.ready;

function drawChrome(sc, t, local, idx) {
  const fadeIn = seg(local, 0, 0.9), fadeOut = 1 - seg(local, sc.duration - 0.6, sc.duration);
  // Viñeta
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // Capítulo y título
  const a = ease(seg(local, 0.3, 1.4)) * fadeOut;
  const n = String(idx + 1).padStart(2, '0');
  text(`${n} · ${SCRIPT.chapter ?? 'SENDA'}`, 96, 104, { px: 22, w: 550, color: C.gray, alpha: a });
  text(sc.title, 96, 158, { px: 54, w: 650, alpha: a });
  // Etiqueta de veracidad (un cuadrado de color + texto, sin pastilla)
  const [col, lbl] = TRUTH[sc.claim] ?? TRUTH.CALCULATED;
  g.save(); g.globalAlpha = a * 0.95; g.font = font(19, 550); const tw = g.measureText(lbl).width;
  g.fillStyle = col; g.fillRect(W - 96 - tw - 22, 88, 12, 12); g.fillStyle = C.gray; g.textAlign = 'right'; g.fillText(lbl, W - 96, 100); g.restore();
  // Subtítulo de la frase en curso
  const line = sc.lines.find((l) => t >= l.start - 0.05 && t <= l.end + 0.25);
  if (line) {
    const la = seg(t, line.start - 0.05, line.start + 0.25) * (1 - seg(t, line.end, line.end + 0.25));
    const rows = wrap(line.text, 1380, 36, 550), lh = 48, y0 = H - 96 - (rows.length - 1) * lh;
    g.save(); g.globalAlpha = la * 0.55; g.fillStyle = '#000'; g.beginPath(); g.roundRect(W / 2 - 740, y0 - 46, 1480, rows.length * lh + 26, 8); g.fill(); g.restore();
    rows.forEach((r, i) => text(r, W / 2, y0 + i * lh, { px: 36, w: 550, align: 'center', alpha: la }));
  }
  // Grano y fundidos
  g.save(); g.globalAlpha = 0.045; g.globalCompositeOperation = 'overlay'; const fr = Math.floor(t * 25);
  const ox = (fr * 97) % 256, oy = (fr * 61) % 256; for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) g.drawImage(grain, x, y); g.restore();
  const black = 1 - Math.min(fadeIn, fadeOut);
  if (black > 0) { g.fillStyle = `rgba(0,0,0,${black})`; g.fillRect(0, 0, W, H); }
}

window.DURATION = TL.totalDuration;
window.seek = async (t) => {
  const idx = Math.max(0, TL.scenes.findIndex((s) => t >= s.start && t < s.end)); const sc = TL.scenes[idx === -1 ? TL.scenes.length - 1 : idx];
  const local = t - sc.start, p = local / sc.duration;
  const s = sceneFor(sc);
  g.clearRect(0, 0, W, H);
  s.update({ t, local, p, sc, lineAt: (i) => sc.lines[i] ? clamp((t - sc.lines[i].start) / (sc.lines[i].end - sc.lines[i].start)) : 0, lineStarted: (i) => sc.lines[i] && t >= sc.lines[i].start });
  renderer.render(s.scene, s.camera);
  if (s.overlay) s.overlay({ t, local, p, sc, lineAt: (i) => sc.lines[i] ? clamp((t - sc.lines[i].start) / (sc.lines[i].end - sc.lines[i].start)) : 0 });
  drawChrome(sc, t, local, idx);
  return true;
};
window.READY = true;
const q = new URLSearchParams(location.search).get('t'); if (q != null) window.seek(Number(q));

// Escenas «reales» de la película SENDA Drive: planchas de material REAL con licencia verificada.
//   · Aéreas: ortofoto PNOA © IGN (CC BY 4.0), autovía A-2 como fondo genérico; vehículos recortados de la
//     propia ortofoto; geometría de carriles medida (build/plates/plates.json, build-drive-plates.py).
//   · Vídeo: dashcam de Udacity (MIT); detecciones REALES de YOLOX-s (assets/plates/udacity-vehicle-detections.json).
//   · Pantallas: capturas exactas de la app (assets/drive-*.png).
// Contrato: constructor(visual, TEX) → { scene, camera, update(lt, dur, cue) [puede devolver promesa], bloom?, exposure? }.
// Determinista: cada fotograma depende solo del tiempo. Las reconstrucciones son ILUSTRATIVAS (sin medidas).
import { T, clamp, mix, smooth, ease, hash, label, cam, fly } from './lib.js';

const P = { geo: null, det: null, img: {}, tex: {} };
const LANG = () => globalThis.FILM_LANG || 'en';
const TXT = {
  es: { sw: 'RECONSTRUCCIÓN ILUSTRATIVA · SIN MEDIDAS · FONDO: A-2 (MADRID), EL CASO OCURRIÓ EN BÉLGICA', truck: 'CAMIÓN · ARCÉN', car: 'TURISMO · CARRIL RÁPIDO · CONTRA EL TRÁFICO', dropped: 'ANTES: «OTRO SENTIDO» → AVISO DESCARTADO', warned: 'AVISO', unsure: 'CALZADA INCIERTA → AVISO', heading: 'RUMBO DE MARCHA PREVIO', nofa: 'SIN FALSA ALARMA',
    q: ['¿CHOQUE?', '¿CARRIL?', '¿SENTIDO?'], nav: 'NAVEGADOR', states: ['APAGADO', 'EN ESPERA', 'CANDIDATO', 'CONDUCIENDO', 'CERRANDO'], bt: 'BLUETOOTH DEL COCHE', hint: 'PISTA DÉBIL · ESPERANDO VELOCIDAD', consent: 'CONSENTIMIENTO CONCEDIDO', noperm: 'SIN PERMISO · NO ARRANCA', same: 'MISMA LÓGICA',
    accel: 'ACELERÓMETRO · FORMA SINTÉTICA DEL NÚCLEO (NO ES UNA MEDIDA)', spin: 'GIRO TOTAL ∫‖ω‖dt', ev: ['VELOCIDAD', 'PULSO', 'REPOSO', 'EN VÍA', 'VUELCO', 'GIRO'], nul: 'SIN PESO HASTA CALIBRAR', ex: 'PESO DE EJEMPLO', train: 'ENTRENAMIENTO', test: 'PRUEBA',
    det: 'DETECCIÓN REAL · YOLOX-s SOBRE VÍDEO DE DASHCAM (UDACITY, MIT)', vehicle: 'vehículo', event: 'EVENTO COMPARTIDO', evRows: ['qué: coche detenido delante', 'dónde: posición declarada', 'cuándo: hora declarada', 'imagen: ninguna'], rej: 'RECHAZADO', rejRows: ['imagen', 'matrícula', 'cara'], oem: 'VISIÓN DEL FABRICANTE (TESLA…) · NO DISPONIBLE PARA TERCEROS', logged: 'CÁMARA SIN CALIBRAR · NO SUBE LA CONFIANZA · SOLO SE ANOTA',
    base: ['ANDROID · BASE', 'sin Google · sin Internet'], play: ['ANDROID · PLAY', 'con Google'], auto: ['ANDROID AUTO', 'categoría provisional'], ios: ['iPHONE', 'app nueva · Swift'], fallback: 'Tu flujo de vídeo', plate: 'Ortofoto PNOA © IGN · CC BY 4.0', dash: 'Vídeo: Udacity (MIT)' },
  en: { sw: 'ILLUSTRATIVE RECONSTRUCTION · NO MEASUREMENTS · BACKGROUND: A-2 (MADRID), THE CASE HAPPENED IN BELGIUM', truck: 'TRUCK · SHOULDER', car: 'CAR · FAST LANE · FACING TRAFFIC', dropped: "BEFORE: 'OTHER DIRECTION' → WARNING DROPPED", warned: 'WARNING', unsure: 'ROAD SIDE UNCERTAIN → WARNING', heading: 'PRE-IMPACT TRAVEL HEADING', nofa: 'NO FALSE ALARM',
    q: ['CRASH?', 'LANE?', 'DIRECTION?'], nav: 'NAVIGATOR', states: ['OFF', 'IDLE', 'CANDIDATE', 'DRIVING', 'ENDING'], bt: 'CAR BLUETOOTH', hint: 'WEAK HINT · WAITING FOR SPEED', consent: 'CONSENT GRANTED', noperm: 'NO PERMISSION · NO START', same: 'SAME LOGIC',
    accel: 'ACCELEROMETER · SYNTHETIC SHAPE FROM THE CORE (NOT A MEASUREMENT)', spin: 'TOTAL TURN ∫‖ω‖dt', ev: ['SPEED', 'PULSE', 'AT REST', 'ON ROAD', 'ROLLOVER', 'SPIN'], nul: 'NO WEIGHT UNTIL CALIBRATED', ex: 'EXAMPLE WEIGHT', train: 'TRAIN', test: 'TEST',
    det: 'REAL DETECTION · YOLOX-s ON DASHCAM VIDEO (UDACITY, MIT)', vehicle: 'vehicle', event: 'SHARED EVENT', evRows: ['what: car stopped ahead', 'where: declared position', 'when: declared time', 'image: none'], rej: 'REJECTED', rejRows: ['image', 'plate', 'face'], oem: "MAKER'S VISION (TESLA…) · NOT AVAILABLE TO THIRD PARTIES", logged: 'UNCALIBRATED CAMERA · DOES NOT RAISE CONFIDENCE · LOGGED ONLY',
    base: ['ANDROID · BASE', 'no Google · no Internet'], play: ['ANDROID · PLAY', 'with Google'], auto: ['ANDROID AUTO', 'provisional category'], ios: ['iPHONE', 'new app · Swift'], fallback: 'Your video feed', plate: 'PNOA orthophoto © IGN · CC BY 4.0', dash: 'Video: Udacity (MIT)' },
};
const tx = (k) => TXT[LANG()][k];

// ───────────────────────────── carga previa (la llama cinema.html antes de construir escenas)
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`no carga ${src}`)); i.src = src; });
export async function prepare4(script) {
  const kinds = new Set(script.scenes.map((s) => s.visual.engine).filter(Boolean));
  if (!kinds.size) return;
  P.geo = await fetch('build/plates/plates.json').then((r) => r.json());
  const tl = new T.TextureLoader();
  for (const f of [...P.geo.tiles, 'sprite-car.png', 'sprite-truck.png']) { const t = await tl.loadAsync(`build/plates/${f}`); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; P.tex[f] = t; }
  P.det = await fetch('assets/plates/udacity-vehicle-detections.json').then((r) => r.json());
  for (const f of new Set(script.scenes.flatMap((s) => s.visual.screens || []))) P.img[f] = await loadImg(`assets/${f}`);
}

// ───────────────────────────── fotogramas de vídeo (deterministas, con caché)
const FR = new Map();
async function frame(clip, i) {
  const n = P.geo[`frames_${clip}`], k = `${clip}/${String(1 + (((i % n) + n) % n)).padStart(5, '0')}`;
  if (!FR.has(k)) { FR.set(k, loadImg(`build/plates/${k}.jpg`)); if (FR.size > 90) FR.delete(FR.keys().next().value); }
  return FR.get(k);
}

// ───────────────────────────── base 2D: lienzo → textura a pantalla completa (pasa por el postproceso)
function canvasScene() {
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 536; const g = cv.getContext('2d');
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.minFilter = T.LinearFilter;
  const scene = new T.Scene(); scene.background = new T.Color(0x000000);
  const q = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: tex, toneMapped: false, depthTest: false })); scene.add(q);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { cv, g, tex, scene, camera };
}
const W2 = 1280, H2 = 536;
function cover(g, img, { zoom = 1, cx = 0.5, cy = 0.5, filter = 'none', alpha = 1 } = {}) {
  const s = Math.max(W2 / img.width, H2 / img.height) * zoom, w = img.width * s, h = img.height * s;
  g.save(); g.globalAlpha = alpha; g.filter = filter; g.drawImage(img, (W2 - w) * cx, (H2 - h) * cy, w, h); g.restore();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function glass(g, x, y, w, h, a = 1) { g.save(); g.globalAlpha = a; rr(g, x, y, w, h, 14); g.fillStyle = 'rgba(6,12,18,.72)'; g.fill(); g.strokeStyle = 'rgba(145,215,232,.28)'; g.lineWidth = 1; g.stroke(); g.restore(); }
function text(g, s, x, y, { size = 14, weight = 600, color = '#f2f4f4', font = 'Inter', align = 'left', alpha = 1, spacing = 0 } = {}) {
  g.save(); g.globalAlpha = alpha; g.fillStyle = color; g.font = `${weight} ${size}px ${font === 'mono' ? '"JetBrains Mono", monospace' : 'Inter, sans-serif'}`; g.textAlign = align; g.textBaseline = 'middle';
  try { g.letterSpacing = `${spacing}px`; } catch {} g.fillText(s, x, y); g.restore();
}
function credit(g, s) { text(g, s, W2 - 18, H2 - 14, { size: 10, font: 'mono', color: '#8fa4ae', align: 'right', alpha: 0.85 }); }
function phone(g, img, x, y, h, { alpha = 1, tilt = 0 } = {}) {
  const w = h * 0.47, r = h * 0.07; g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(tilt);
  g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 40; g.shadowOffsetY = 18; rr(g, -w / 2, -h / 2, w, h, r); g.fillStyle = '#0b0f13'; g.fill(); g.shadowColor = 'transparent';
  g.lineWidth = 2; g.strokeStyle = '#3a4650'; g.stroke(); const b = h * 0.022; rr(g, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, r * 0.8); g.save(); g.clip();
  if (img) { const sw = w - 2 * b, s = sw / img.width; g.drawImage(img, -w / 2 + b, -h / 2 + b, sw, img.height * s); } else { g.fillStyle = '#081420'; g.fillRect(-w / 2, -h / 2, w, h); }
  g.restore(); g.fillStyle = '#05080b'; rr(g, -w * 0.16, -h / 2 + b + 4, w * 0.32, h * 0.025, 8); g.fill(); g.restore();
}

// ───────────────────────────── mundo aéreo 3D (ortofoto real + vehículos recortados de ella)
let AER;
function aerial() {
  if (AER) return AER;
  const G = P.geo, ppm = G.pxPerM, xRef = 5100, scene = new T.Scene(); scene.background = new T.Color(0x05080c); scene.fog = new T.FogExp2(0x05080c, 0.0028);
  const fade = (left) => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), gy = g.createLinearGradient(0, 0, 0, 128); gy.addColorStop(0, '#000'); gy.addColorStop(0.18, '#fff'); gy.addColorStop(0.82, '#fff'); gy.addColorStop(1, '#000'); g.fillStyle = gy; g.fillRect(0, 0, 256, 128);
    g.globalCompositeOperation = 'multiply'; const gx = g.createLinearGradient(0, 0, 256, 0); if (left) { gx.addColorStop(0, '#000'); gx.addColorStop(0.12, '#fff'); gx.addColorStop(1, '#fff'); } else { gx.addColorStop(0, '#fff'); gx.addColorStop(0.88, '#fff'); gx.addColorStop(1, '#000'); } g.fillStyle = gx; g.fillRect(0, 0, 256, 128); return new T.CanvasTexture(c); };
  const planes = G.tiles.map((f, i) => { const w = G.w / 2 / ppm, h = G.h / ppm; const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: P.tex[f], alphaMap: fade(i === 0), transparent: true, color: 0xffffff, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set((i * G.w / 2 + G.w / 4 - xRef) / ppm, 0, (G.h / 2 - 285) / ppm); m.renderOrder = -10; scene.add(m); return m; });
  const inner = (xm) => { const x = xm * ppm + xRef, Q = G.innerB; if (x <= Q[0][0]) return Q[0][1]; for (let i = 1; i < Q.length; i++) if (x <= Q[i][0]) return Q[i - 1][1] + (Q[i][1] - Q[i - 1][1]) * (x - Q[i - 1][0]) / (Q[i][0] - Q[i - 1][0]); return Q[Q.length - 1][1]; };
  const laneZ = (side, k, xm) => (inner(xm) + G[side][k] - 285) / ppm;
  const mk = (kind) => { const f = kind === 'truck' ? 'sprite-truck.png' : 'sprite-car.png', s = G.sprites[kind], len = s.lenPx / ppm, wid = s.widPx / ppm;
    const g = new T.Group(), pl = new T.Mesh(new T.PlaneGeometry(len, wid), new T.MeshBasicMaterial({ map: P.tex[f], color: kind === 'truck' ? 0xa8b0b8 : 0xd8dde2, transparent: true, depthWrite: false, toneMapped: false })); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.06; pl.renderOrder = 2; g.add(pl);
    const lights = new T.Group(), hl = len / 2 - 0.25, tl = -len / 2 + 0.2, side = wid * 0.32;
    const spr = (col, size) => { const m = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: col, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); m.scale.set(size, size, 1); m.renderOrder = 3; return m; };
    const H = [spr(0xfff1d6, 0.85), spr(0xfff1d6, 0.85)], R = [spr(0xff2a2a, 0.7), spr(0xff2a2a, 0.7)];
    H[0].position.set(hl, 0.8, -side); H[1].position.set(hl, 0.8, side); R[0].position.set(tl, 0.9, -side); R[1].position.set(tl, 0.9, side); lights.add(...H, ...R);
    const beam = new T.Mesh(new T.PlaneGeometry(14, 4.5), new T.MeshBasicMaterial({ map: beamTex(), color: 0xfff1d6, transparent: true, opacity: 0.32, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); beam.rotation.x = -Math.PI / 2; beam.position.set(len / 2 + 7, 0.08, 0); beam.visible = false; lights.add(beam);
    g.add(lights); g.userData = { H, R, beam, len, wid, pl }; scene.add(g); return g; };
  const car = mk('car'), truck = mk('truck'), traffic = Array.from({ length: 12 }, () => mk('car')), lorries = [mk('truck'), mk('truck')];
  const ring = () => { const m = new T.Mesh(new T.RingGeometry(0.9, 1, 64), new T.MeshBasicMaterial({ color: 0x91d7e8, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.15; m.renderOrder = 4; scene.add(m); return m; };
  const rings = traffic.map(ring), hz = ring(), v16 = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffa21a, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); scene.add(v16);
  const beamUp = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 160, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); scene.add(beamUp);
  const sparks = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(new Float32Array(90), 3)), new T.PointsMaterial({ map: glowTex(), color: 0xffc27a, size: 0.9, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); scene.add(sparks);
  const pathPts = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(new Float32Array(600), 3)), new T.PointsMaterial({ map: glowTex(), color: 0x34d399, size: 0.9, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); scene.add(pathPts);
  const labels = {}; const lab = (k, s, col, size, sub = '') => { const l = label(s, col, size, sub); scene.add(l); labels[k] = l; return l; };
  AER = { scene, camera: cam(34), planes, car, truck, traffic, lorries, rings, hz, v16, beamUp, sparks, pathPts, labels, lab, laneZ, inner };
  return AER;
}
let GT, BT;
function glowTex() { if (GT) return GT; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); GT = new T.CanvasTexture(c); return GT; }
function beamTex() { if (BT) return BT; const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(0, 64, 0, 0, 64, 256); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.moveTo(0, 56); g.lineTo(256, 0); g.lineTo(256, 128); g.lineTo(0, 72); g.fill(); BT = new T.CanvasTexture(c); return BT; }
const setLights = (v, { head = 1, brake = 0.35, beam = 1 } = {}) => { v.userData.H.forEach((s) => (s.material.opacity = head)); v.userData.R.forEach((s) => { s.material.opacity = brake; s.scale.setScalar(0.55 + 0.6 * brake); }); v.userData.beam.material.opacity = 0.16 * beam * head; };
const grade = (A, rgb) => A.planes.forEach((p) => p.material.color.setRGB(...rgb));
const only = (A, list) => { for (const o of [A.car, A.truck, ...A.traffic, ...A.rings, A.hz, A.v16, A.beamUp, A.sparks, A.pathPts, ...Object.values(A.labels)]) o.visible = list.includes(o); };
const at = (v, x, z, yaw = 0) => { v.position.set(x, 0, z); v.rotation.y = -yaw; };

// Reconstrucción ILUSTRATIVA del caso (doc 18): s en segundos de animación, sin medidas reales.
function crash(A, s) {
  const zR = A.laneZ('B', 'right', 0), zM = A.laneZ('B', 'middle', 0), zF = A.laneZ('B', 'fast', 0), zS = A.laneZ('B', 'shoulder', 0), v = 24;
  if (s < 0) return { car: [v * s, zR, 0], truck: [v * s - 9.4, mix(zM + 0.55 * (zR - zM), zM, clamp(-s / 3)), 0] };
  const ad = (u) => v * u - 4.2 * u * u, s1 = Math.min(s, 1.5), k = ease(s1 / 0.7);
  if (s < 1.5) return { car: [ad(s) + 0.3 * k, zR + 0.2 * k, 1.35 * k], truck: [ad(s) - 9.4, zM + 0.55 * (zR - zM) + 0.25 * (s / 1.5), 0] };
  const x15 = ad(1.5), v15 = v - 8.4 * 1.5, u = Math.min(s - 1.5, v15 / 5.2), xc = x15 + 0.3 + v15 * u - 2.6 * u * u;
  const lat = ease(clamp((s - 1.5) / 1.8)), bounce = 0.6 * smooth(3.0, 3.8, s), zc = mix(zR + 0.2, zF - 1.1, lat) + bounce;
  const yaw = mix(1.35, Math.PI * 1.05, ease(clamp((s - 1.5) / 2.1))) - 0.05 * Math.PI * smooth(3.1, 4.0, s);
  const ut = Math.min(s - 1.5, 3.4), xt = x15 - 9.4 + v15 * ut - (v15 / 6.8) * ut * ut;
  return { car: [xc, zc, yaw], truck: [xt, mix(zM + 0.55 * (zR - zM) + 0.25, zS, ease(clamp((s - 1.5) / 2.8))), 0.12 * Math.sin(Math.PI * clamp((s - 1.5) / 2.8))] };
}

// ───────────────────────────── escenas aéreas
function aerialBeacon() {
  const A = aerial(); A.lab('q0', tx('q')[0], '#ff7756', 16); A.lab('q1', tx('q')[1], '#ff7756', 16); A.lab('q2', tx('q')[2], '#ff7756', 16);
  return { scene: A.scene, camera: A.camera, bloom: [0.85, 0.55, 0.7], update(lt, d, cue) {
    grade(A, [0.46, 0.52, 0.64]); A.scene.fog.density = 0.003;
    const x0 = 40, zS = A.laneZ('B', 'shoulder', x0) - 0.3; at(A.car, x0, zS, 0); setLights(A.car, { head: 0.25, brake: 0.2, beam: 0 });
    const on = lt < cue(5) + 0.4, bl = on && Math.sin(lt * 9.4) > -0.15 ? 1 : 0, fade = lt < cue(5) ? 1 : clamp(1 - (lt - cue(5)) / 0.8);
    A.v16.position.set(x0, 1.9, zS); A.v16.scale.setScalar(2.6 + 1.6 * bl); A.v16.material.opacity = bl * fade;
    const up = smooth(cue(1), cue(1) + 1.4, lt) * (1 - smooth(cue(5), cue(5) + 1, lt)); A.beamUp.position.set(x0, 80 * up, zS); A.beamUp.scale.set(1, Math.max(0.001, up), 1); A.beamUp.material.opacity = 0.42 * up * (0.65 + 0.35 * bl);
    const vis = [A.car, A.v16, A.beamUp, A.labels.q0, A.labels.q1, A.labels.q2];
    A.traffic.forEach((v, i) => { if (i > 7) return; const lane = ['fast', 'middle', 'right'][i % 3], x = x0 - 260 + i * 34 + ((lt * 26) % 34); at(v, x, A.laneZ('B', lane, x), 0); setLights(v, { head: 1, brake: 0.35 }); vis.push(v);
      const r = A.rings[i], nav = i % 2 === 0, k = nav ? smooth(cue(2), cue(2) + 0.8, lt) * (1 - smooth(cue(5), cue(5) + 1, lt)) : 0, ph = (lt * 0.9 + i * 0.17) % 1; r.position.set(x, 0.15, v.position.z); r.scale.setScalar(2 + ph * 7); r.material.opacity = k * (1 - ph); r.material.color.set(0x91d7e8); vis.push(r); });
    ['q0', 'q1', 'q2'].forEach((k, i) => { const l = A.labels[k], a = smooth(cue(4) + i * 0.45, cue(4) + i * 0.45 + 0.6, lt) * (1 - smooth(cue(5) + 0.5, cue(5) + 1.2, lt)); l.material.opacity = a; l.position.set(x0 - 8 + i * 8, 7 + i * 3.2, zS); });
    only(A, vis);
    fly(A.camera, [{ p: [x0 - 22, 5, zS + 16], l: [x0, 0.6, zS] }, { p: [x0 - 30, 26, zS + 34], l: [x0, 18, zS] }, { p: [x0 - 170, 110, zS + 120], l: [x0 - 90, 0, zS - 10] }, { p: [x0 - 34, 12, zS + 22], l: [x0, 1, zS] }, { p: [x0 - 16, 4, zS + 10], l: [x0, 0.8, zS] }], lt / d);
  } };
}
// Frenada en cadena: mismo modelo ilustrativo que la escena «road» original (cifras: road-guard.mjs vía build-drive-film.mjs)
function chainSim(withSenda) {
  const N = 9, v0 = 33.3, LEN = 4.6, gaps = [0, 13, 40, 40, 40, 40, 150, 78, 78], x0 = []; let acc = 0; for (let i = 0; i < N; i++) { acc -= gaps[i] + (i ? LEN : 0); x0.push(acc); }
  const dt = 0.02, t0 = 1.6, hist = [], x = x0.slice(), v = Array(N).fill(v0), bt = Array(N).fill(1e9), hit = Array(N).fill(1e9);
  for (let s = 0; s < 900; s++) { const t = s * dt; for (let i = 1; i < N; i++) if (bt[i] > 1e8) { if (withSenda) bt[i] = t0 + 0.3; else if (bt[i - 1] < 1e8 || hit[i - 1] < 1e8) bt[i] = Math.min(bt[i - 1], hit[i - 1]) + 1.2; }
    if (s === 0) bt[0] = t0;
    for (let i = 0; i < N; i++) { if (t >= bt[i]) v[i] = Math.max(0, v[i] - (i === 0 ? 8 : 7.2) * dt); if (hit[i] < 1e8) v[i] = Math.max(0, v[i] - 30 * dt); x[i] += v[i] * dt; }
    for (let i = 1; i < N; i++) if (x[i] + LEN > x[i - 1] && v[i] > v[i - 1] + 0.5) { if (hit[i] > 1e8) hit[i] = t; if (hit[i - 1] > 1e8) hit[i - 1] = t; const vm = (v[i] + v[i - 1]) / 2; v[i] = vm; v[i - 1] = vm; x[i] = x[i - 1] - LEN; }
    hist.push({ x: x.slice(), v: v.slice() }); }
  return { hist, bt, hit, dt, N };
}
function aerialChain() {
  const A = aerial(), RA = chainSim(false), RB = chainSim(true);
  return { scene: A.scene, camera: A.camera, bloom: [0.7, 0.5, 0.78], update(lt, d, cue) {
    grade(A, [0.6, 0.64, 0.72]); A.scene.fog.density = 0.0035;
    const B = lt >= cue(3) - 0.25, run = B ? RB : RA, tau = B ? Math.max(0, lt - cue(3) + 0.25) * 0.85 : Math.max(0, lt - 1.0) * 0.7;
    const st = run.hist[Math.min(run.hist.length - 1, Math.floor(tau / run.dt))], off = -120, vis = [];
    for (let i = 0; i < run.N; i++) { const v = A.traffic[i], x = st.x[i] + off, hit = tau >= run.hit[i], brk = tau >= run.bt[i] || hit, since = tau - run.hit[i];
      const dz = hit ? (hash(i, 4) - 0.5) * 1.6 * smooth(0, 0.6, since) : 0, yaw = hit ? (hash(i, 3) - 0.5) * 0.45 * smooth(0, 0.5, since) : 0;
      at(v, x, A.laneZ('B', 'middle', x) + dz, yaw); setLights(v, { head: 1, brake: brk ? 1 : 0.3 }); vis.push(v);
      const r = A.rings[i], w = B && i > 0 ? clamp(1 - Math.abs(tau - run.bt[i] - 0.35) / 0.9) : 0; r.position.set(x, 0.15, v.position.z); r.scale.setScalar(3 + 4 * (1 - w)); r.material.color.set(0x91d7e8); r.material.opacity = w * 0.9; vis.push(r); }
    // SOS sin cobertura: anillo rojo que se expande desde el coche 1
    const c1 = A.traffic[1]; if (lt > cue(5)) { const ph = (lt * 0.7) % 1; A.hz.position.set(c1.position.x, 0.15, c1.position.z); A.hz.scale.setScalar(3 + ph * 60); A.hz.material.color.set(0xff3b4e); A.hz.material.opacity = (1 - ph) * 0.8; vis.push(A.hz); }
    only(A, vis);
    const zc = st.x[3] + off, zl = A.laneZ('B', 'middle', zc);
    if (!B) fly(A.camera, [{ p: [zc - 40, 22, zl + 30], l: [zc + 30, 0, zl] }, { p: [zc - 25, 34, zl + 40], l: [zc + 25, 0, zl] }], smooth(0, cue(3), lt));
    else fly(A.camera, [{ p: [zc - 60, 40, zl - 40], l: [zc + 30, 0, zl] }, { p: [zc - 30, 55, zl - 50], l: [zc + 30, 0, zl] }, { p: [zc - 70, 75, zl - 45], l: [zc + 20, 0, zl] }], smooth(cue(3), d, lt));
  } };
}
function aerialSide() {
  const A = aerial(); A.lab('sw', tx('sw'), '#fbbf24', 64); A.lab('truck', tx('truck'), '#dfe7ea', 26); A.lab('car', tx('car'), '#ff7756', 44);
  return { scene: A.scene, camera: A.camera, bloom: [0.7, 0.5, 0.78], update(lt, d, cue) {
    grade(A, [0.55, 0.6, 0.7]); A.scene.fog.density = 0.0025;
    const tI = cue(1) + 1.8, s = lt < tI ? lt - tI : (lt - tI) * 0.6, S = Math.max(-4, Math.min(s, 6)), p = crash(A, S);
    at(A.car, p.car[0], p.car[1], p.car[2]); at(A.truck, p.truck[0], p.truck[1], p.truck[2]);
    const brk = s > -0.15; setLights(A.car, { head: 1, brake: brk ? 1 : 0.3 }); setLights(A.truck, { head: 1, brake: brk ? 1 : 0.3 });
    const vis = [A.car, A.truck, A.sparks, A.labels.sw, A.labels.truck, A.labels.car];
    const sp = A.sparks.geometry.attributes.position.array;
    for (let i = 0; i < 30; i++) { const o = i * 3, a = i < 18 ? s : s - 3.0, base = i < 18 ? [A.car.position.x, A.car.position.z - 0.9] : [A.car.position.x, A.laneZ('B', 'fast', 0) - 2.2];
      if (a < 0 || a > 0.9) { sp[o + 1] = -50; continue; } sp[o] = base[0] + (hash(i, 1) - 0.5) * 7 * a; sp[o + 1] = 0.4 + hash(i, 2) * 3 * a - 4 * a * a; sp[o + 2] = base[1] + (hash(i, 3) - 0.5) * 7 * a; }
    A.sparks.geometry.attributes.position.needsUpdate = true;
    A.traffic.forEach((v, i) => { if (i > 5) return; const x = p.car[0] - 170 + i * 26 + Math.max(0, lt - cue(4)) * 9, lane = ['fast', 'middle', 'right'][i % 3]; at(v, x, A.laneZ('B', lane, x), 0); setLights(v, { head: 1, brake: 0.35 }); if (lt > cue(4) - 0.5) vis.push(v); });
    only(A, vis);
    const c = A.car.position, fin = smooth(cue(3), cue(3) + 1, lt);
    A.labels.sw.position.set(c.x + 12, 9, c.z - 10); A.labels.sw.material.opacity = smooth(0.3, 1.2, lt) * (1 - smooth(cue(1) + 0.4, cue(1) + 1.2, lt));
    A.labels.truck.position.set(A.truck.position.x, 7, A.truck.position.z + 6); A.labels.car.position.set(c.x, 8, c.z - 7); A.labels.truck.material.opacity = A.labels.car.material.opacity = fin;
    if (lt < tI + 0.3) fly(A.camera, [{ p: [c.x - 46, 26, c.z + 30], l: [c.x + 6, 0, c.z - 1] }, { p: [c.x - 30, 22, c.z + 22], l: [c.x + 4, 0, c.z - 1] }], smooth(0, tI + 0.3, lt));
    else if (lt < cue(3)) fly(A.camera, [{ p: [c.x - 30, 22, c.z + 22], l: [c.x + 4, 0, c.z - 1] }, { p: [c.x - 6, 46, c.z + 18], l: [c.x + 4, 0, c.z - 1] }], smooth(tI + 0.3, cue(3), lt));
    else fly(A.camera, [{ p: [c.x - 6, 46, c.z + 18], l: [c.x + 4, 0, c.z - 1] }, { p: [c.x - 50, 64, c.z + 40], l: [c.x + 8, 0, c.z] }], smooth(cue(3), d, lt));
  } };
}
function aerialRel() {
  const A = aerial(); A.lab('dropped', tx('dropped'), '#ff5b6e', 70); A.lab('warned', tx('warned'), '#91d7e8', 26); A.lab('unsure', tx('unsure'), '#fbbf24', 46); A.lab('heading', tx('heading'), '#34d399', 44); A.lab('nofa', tx('nofa'), '#34d399', 34);
  const F = crash(A, 9);
  return { scene: A.scene, camera: A.camera, bloom: [0.7, 0.5, 0.78], update(lt, d, cue) {
    grade(A, [0.5, 0.56, 0.68]); A.scene.fog.density = 0.0022;
    at(A.car, F.car[0], F.car[1], F.car[2]); at(A.truck, F.truck[0], F.truck[1], F.truck[2]); setLights(A.car, { head: 0.6, brake: Math.sin(lt * 8) > 0 ? 1 : 0.3 }); setLights(A.truck, { head: 0.6, brake: 0.6 });
    const xc = F.car[0], zc = F.car[1], vis = [A.car, A.truck, A.hz, ...['dropped', 'warned', 'unsure', 'heading', 'nofa'].map((k) => A.labels[k])];
    const ph0 = (lt * 0.6) % 1; A.hz.position.set(xc, 0.15, zc); A.hz.scale.setScalar(3 + ph0 * 40); A.hz.material.color.set(0xff3b4e); A.hz.material.opacity = (1 - ph0) * 0.8;
    const bad = smooth(cue(1), cue(1) + 0.6, lt) * (1 - smooth(cue(2) + 1.2, cue(2) + 2, lt)), good = smooth(cue(2) + 1.4, cue(2) + 2.2, lt), opp = smooth(cue(3) + 0.4, cue(3) + 1.2, lt) * (1 - smooth(cue(5), cue(5) + 1, lt));
    A.traffic.forEach((v, i) => { const behind = i < 7, lane = behind ? ['fast', 'middle', 'right'][i % 3] : ['fast', 'middle', 'right'][i % 3];
      const x = behind ? xc - 70 - i * 22 + Math.min(lt, cue(5) + 2) * 5 : xc + 60 - (i - 7) * 30 - lt * 9, z = A.laneZ(behind ? 'B' : 'A', lane, x);
      at(v, x, z, behind ? 0 : Math.PI); setLights(v, { head: 1, brake: behind && bad > 0.3 && good < 0.1 ? 0.3 : (behind && good > 0.5 ? 1 : 0.35) }); vis.push(v);
      const r = A.rings[i], ph = (lt * 0.9 + i * 0.17) % 1; r.position.set(x, 0.15, z); r.scale.setScalar(2 + ph * 6);
      if (behind) { r.material.color.set(good > 0.5 ? 0x91d7e8 : 0xff3b4e); r.material.opacity = Math.max(bad, good) * (1 - ph); } else { r.material.color.set(0xfbbf24); r.material.opacity = opp * (1 - ph); }
      vis.push(r); });
    // rumbo de marcha previo: trazo verde por el carril derecho hasta el golpe
    const pa = A.pathPts.geometry.attributes.position.array, dr = smooth(cue(4), cue(4) + 2.2, lt);
    for (let i = 0; i < 200; i++) { const u = i / 199, x = xc - 160 + u * 160, o = i * 3; if (u > dr) { pa[o + 1] = -50; continue; } const zr = A.laneZ('B', 'right', x); pa[o] = x; pa[o + 1] = 0.3; pa[o + 2] = u < 0.93 ? zr : mix(zr, zc, (u - 0.93) / 0.07); }
    A.pathPts.geometry.attributes.position.needsUpdate = true; vis.push(A.pathPts);
    only(A, vis);
    const L = A.labels; L.dropped.position.set(xc - 100, 18, zc + 2); L.dropped.material.opacity = bad; L.warned.position.set(xc - 95, 10, zc + 2); L.warned.material.opacity = good * (1 - smooth(cue(4), cue(4) + 0.5, lt));
    L.unsure.position.set(xc + 10, 14, A.laneZ('A', 'middle', xc) - 4); L.unsure.material.opacity = opp; L.heading.position.set(xc - 80, 12, A.laneZ('B', 'right', xc) + 10); L.heading.material.opacity = smooth(cue(4) + 0.8, cue(4) + 1.6, lt);
    L.nofa.position.set(xc + 10, 14, A.laneZ('A', 'middle', xc) - 4); L.nofa.material.opacity = smooth(cue(5) + 0.6, cue(5) + 1.4, lt);
    fly(A.camera, [{ p: [xc - 190, 70, zc + 60], l: [xc - 60, 0, zc] }, { p: [xc - 160, 85, zc + 80], l: [xc - 50, 0, zc] }, { p: [xc - 60, 95, zc - 90], l: [xc - 20, 0, zc - 4] }, { p: [xc - 120, 110, zc - 60], l: [xc - 40, 0, zc] }], lt / d);
  } };
}

// ───────────────────────────── escenas sobre vídeo real (2D)
function backdrop(v) {
  const C = canvasScene();
  return { scene: C.scene, camera: C.camera, bloom: [0.35, 0.4, 0.85], async update(lt, d) {
    const img = await frame(v.plate || 'dash', (v.from || 0) + Math.floor(lt * 25));
    cover(C.g, img, { zoom: mix(1.0, 1.07, lt / d), filter: `brightness(${v.dim ?? 0.55}) saturate(.85)` });
    const gr = C.g.createLinearGradient(0, 0, 0, H2); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)'); C.g.fillStyle = gr; C.g.fillRect(0, 0, W2, H2);
    credit(C.g, tx('dash')); C.tex.needsUpdate = true;
  } };
}
function autostartHud(v) {
  const C = canvasScene(), COL = ['#6f838e', '#91d7e8', '#fbbf24', '#34d399', '#ff7756'];
  return { scene: C.scene, camera: C.camera, bloom: [0.45, 0.45, 0.8], async update(lt, d, cue) {
    let st = 0; if (lt >= cue(0) + 1.2) st = 1; if (lt >= cue(1) + 0.8) st = 3; if (lt >= cue(1) + 3.2) st = 4; if (lt >= cue(2) - 0.4) st = 1; if (lt >= cue(2) + 0.6) st = 2; if (lt >= cue(2) + 3.0) st = 3; if (lt >= cue(3) - 0.2) st = 0;
    if (lt >= cue(4)) st = [1, 2, 3, 4][Math.floor((lt - cue(4)) * 1.1) % 4];
    const moving = st === 3 || st === 4, img = await frame('harder', 40 + Math.floor((moving ? lt : Math.min(lt, cue(1))) * 25));
    cover(C.g, img, { zoom: 1.04, filter: `brightness(${moving ? 0.62 : 0.45}) saturate(.8)` }); const g = C.g;
    // panel de estados (los nombres de AUTOSTART_STATES)
    const px = 760, py = 46, pw = 480, ph = 150; glass(g, px, py, pw, ph, 0.95);
    text(g, 'SENDA DRIVE · AUTOSTART', px + 20, py + 24, { size: 11, font: 'mono', color: '#ff7756', spacing: 2 });
    tx('states').forEach((s, i) => { const x = px + 20 + i * 90, y = py + 70, on = i === st; rr(g, x, y - 18, 82, 36, 18); g.fillStyle = on ? COL[i] : 'rgba(145,215,232,.08)'; g.fill(); if (!on) { g.strokeStyle = 'rgba(145,215,232,.25)'; g.stroke(); }
      text(g, s, x + 41, y, { size: s.length > 9 ? 9.5 : 11, weight: 700, font: 'mono', align: 'center', color: on ? '#04090d' : '#8fa4ae' }); });
    const msg = lt < cue(1) ? (lt > cue(0) + 0.6 ? tx('consent') : '') : lt < cue(2) - 0.4 ? tx('bt') : lt < cue(3) - 0.2 ? tx('hint') : lt < cue(4) ? tx('noperm') : `${tx('same')} · ${v.scen} × ${v.steps}`;
    text(g, msg, px + 20, py + 120, { size: 13, weight: 600, color: lt >= cue(3) - 0.2 && lt < cue(4) ? '#ff5b6e' : '#dfe7ea' });
    // velocidad (pista débil confirmada por velocidad)
    if (lt > cue(2) && lt < cue(3) - 0.2) { const k = smooth(cue(2) + 0.6, cue(2) + 3.0, lt); glass(g, px, py + ph + 12, 200, 56); text(g, `${Math.round(k * 32)} km/h`, px + 20, py + ph + 40, { size: 24, weight: 800, color: k >= 0.99 ? '#34d399' : '#fbbf24' }); }
    if (lt > cue(1) - 0.2 && lt < cue(2) - 0.4) { const ph2 = (lt * 1.2) % 1; g.save(); g.strokeStyle = `rgba(122,167,255,${1 - ph2})`; g.lineWidth = 2; g.beginPath(); g.arc(px + pw - 40, py + ph + 40, 10 + ph2 * 26, 0, Math.PI * 2); g.stroke(); g.restore(); text(g, 'ᛒ', px + pw - 40, py + ph + 40, { size: 20, weight: 800, color: '#7aa7ff', align: 'center' }); }
    if (lt > cue(4) - 0.3) ['ANDROID · BASE', 'ANDROID · PLAY', 'iPHONE'].forEach((s, i) => { const a = smooth(cue(4) + i * 0.3, cue(4) + i * 0.3 + 0.6, lt); glass(g, px + i * 162, py + ph + 12, 152, 40, a); text(g, s, px + i * 162 + 76, py + ph + 32, { size: 11, weight: 700, font: 'mono', align: 'center', alpha: a }); });
    credit(g, tx('dash')); C.tex.needsUpdate = true;
  } };
}
function phoneShot(v) {
  const C = canvasScene();
  return { scene: C.scene, camera: C.camera, bloom: [0.3, 0.4, 0.88], async update(lt, d, cue) {
    const img = await frame(v.plate || 'dash', 300 + Math.floor(lt * 25)); cover(C.g, img, { zoom: 1.12, filter: 'blur(10px) brightness(.42) saturate(.7)' });
    const n = v.screens.length; let k = 0; for (let i = 0; i < n; i++) if (lt >= cue(i) - 0.25) k = i;
    const f = clamp((lt - cue(k) + 0.25) / 0.6), prev = P.img[v.screens[Math.max(0, k - 1)]], cur = P.img[v.screens[k]], h = 470 + 12 * Math.sin(lt * 0.3), x = 640 + Math.sin(lt * 0.25) * 18;
    if (k > 0 && f < 1 && prev !== cur) phone(C.g, prev, x, 268, h, { alpha: 1 - f });
    phone(C.g, cur, x, 268 + (1 - ease(lt / 1.2)) * 30, h, { alpha: k > 0 && prev !== cur ? f : ease(lt / 0.8) });
    const side = P.img[v.screens[Math.min(n - 1, k + 1)]] || cur; phone(C.g, side, x + 330, 290, 380, { alpha: 0.35, tilt: 0.04 }); phone(C.g, prev || cur, x - 330, 290, 380, { alpha: 0.35, tilt: -0.04 });
    credit(C.g, LANG() === 'es' ? 'Capturas reales de la app · fondo: Udacity (MIT)' : 'Real app screenshots · background: Udacity (MIT)'); C.tex.needsUpdate = true;
  } };
}
function sensors(v) {
  const C = canvasScene();
  return { scene: C.scene, camera: C.camera, bloom: [0.5, 0.5, 0.75], async update(lt, d, cue) {
    const img = await frame('challenge', Math.floor(lt * 20)), g = C.g; cover(g, img, { zoom: 1.1, filter: 'brightness(.28) saturate(.6) blur(2px)' });
    // gráfico del acelerómetro (traza sintética del núcleo, normalizada)
    const gx = 70, gy = 70, gw = 620, gh = 200, a = smooth(0.3, 1, lt) * (1 - smooth(cue(3) + 1.5, cue(4), lt));
    glass(g, gx - 20, gy - 40, gw + 40, gh + 70, a); text(g, tx('accel'), gx, gy - 18, { size: 10.5, font: 'mono', color: '#ff7756', alpha: a, spacing: 1 });
    g.save(); g.globalAlpha = a; g.strokeStyle = 'rgba(145,215,232,.18)'; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(gx, gy + i * gh / 4); g.lineTo(gx + gw, gy + i * gh / 4); g.stroke(); }
    const N = v.accel.length, drawN = Math.floor(N * smooth(0.4, cue(1) - 0.2, lt)); g.strokeStyle = '#ff7756'; g.lineWidth = 2.4; g.shadowColor = '#ff7756'; g.shadowBlur = 12; g.beginPath();
    for (let i = 0; i < drawN; i++) { const x = gx + (i / (N - 1)) * gw, y = gy + gh - v.accel[i] * gh * 0.95; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.restore();
    // giroscopio: dial de giro total
    const dx = 1000, dy = 170, R = 86, sp = smooth(cue(1) + 0.3, cue(1) + 2.6, lt), b = smooth(cue(1), cue(1) + 0.6, lt);
    glass(g, dx - 130, dy - 130, 260, 265, b); text(g, tx('spin'), dx, dy - 108, { size: 11, font: 'mono', color: '#7aa7ff', align: 'center', alpha: b });
    g.save(); g.globalAlpha = b; g.lineWidth = 10; g.strokeStyle = 'rgba(122,167,255,.15)'; g.beginPath(); g.arc(dx, dy + 6, R, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#7aa7ff'; g.shadowColor = '#7aa7ff'; g.shadowBlur = 16; g.beginPath(); g.arc(dx, dy + 6, R, -Math.PI / 2, -Math.PI / 2 + sp * Math.PI); g.stroke(); g.restore();
    text(g, `${Math.round(sp * 180)}°`, dx, dy + 6, { size: 34, weight: 800, align: 'center', alpha: b });
    // evidencias: barras con peso de ejemplo; la del giro, vacía
    const ex = 90, ey = 470, eb = smooth(cue(2) - 0.2, cue(2) + 0.6, lt);
    tx('ev').forEach((s, i) => { const k = smooth(cue(2) + i * 0.25, cue(2) + i * 0.25 + 0.7, lt), x = ex + i * 112, isNull = i === 5, hgt = [120, 70, 90, 55, 40, 0][i] * k;
      g.save(); g.globalAlpha = eb; if (isNull) { const na = smooth(cue(3), cue(3) + 0.8, lt); g.setLineDash([6, 5]); g.strokeStyle = `rgba(145,215,232,${0.4 + 0.5 * na})`; g.lineWidth = 2; g.strokeRect(x, ey - 120, 70, 120); g.setLineDash([]);
        text(g, tx('nul'), x + 35, ey - 140, { size: 10, font: 'mono', align: 'center', color: '#91d7e8', alpha: na }); }
      else { const gr = g.createLinearGradient(0, ey - hgt, 0, ey); gr.addColorStop(0, i % 2 ? '#34d399' : '#91d7e8'); gr.addColorStop(1, 'rgba(145,215,232,.15)'); g.fillStyle = gr; g.fillRect(x, ey - hgt, 70, hgt); }
      g.restore(); text(g, s, x + 35, ey + 18, { size: 10.5, font: 'mono', align: 'center', color: '#a9bcc5', alpha: eb }); });
    text(g, tx('ex'), ex, ey - 150, { size: 10, font: 'mono', color: '#8fa4ae', alpha: eb * (1 - smooth(cue(3), cue(3) + 0.6, lt)) });
    // entrenamiento / prueba separados
    [tx('train'), tx('test')].forEach((s, i) => { const k = smooth(cue(4) + i * 0.4, cue(4) + i * 0.4 + 0.7, lt), sep = smooth(cue(4) + 1.2, cue(4) + 2.4, lt), x = 860 + i * 190 + (i ? 1 : -1) * 30 * sep;
      glass(g, x, 400, 170, 70, k); text(g, s, x + 85, 435, { size: 15, weight: 800, align: 'center', color: i ? '#fbbf24' : '#91d7e8', alpha: k }); });
    C.tex.needsUpdate = true;
  } };
}
function detect(v) {
  const C = canvasScene(), D = () => P.det;
  return { scene: C.scene, camera: C.camera, bloom: [0.35, 0.4, 0.85], async update(lt, d, cue) {
    const fi = 520 + Math.floor(lt * 25), img = await frame('dash', fi), g = C.g; cover(g, img, { filter: 'brightness(.78) saturate(.9)' });
    const det = D(), boxes = det.frames[fi % det.frames.length] || [], sx = W2 / det.w, y0 = 110, show = smooth(cue(1) - 0.3, cue(1) + 0.4, lt);
    for (const [cls, x0, y1, x1, y2, sc] of boxes) { const X = x0 * sx, Y = (y1 - y0), Wd = (x1 - x0) * sx, Hd = (y2 - y1); if (Y + Hd < 0 || Y > H2) continue;
      g.save(); g.globalAlpha = show; g.strokeStyle = '#34d399'; g.lineWidth = 2; const c = Math.min(14, Wd / 3);
      for (const [ax, ay, bx, by] of [[X, Y + c, X, Y], [X, Y, X + c, Y], [X + Wd - c, Y, X + Wd, Y], [X + Wd, Y, X + Wd, Y + c], [X, Y + Hd - c, X, Y + Hd], [X, Y + Hd, X + c, Y + Hd], [X + Wd - c, Y + Hd, X + Wd, Y + Hd], [X + Wd, Y + Hd - c, X + Wd, Y + Hd]]) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
      g.restore(); text(g, `${tx('vehicle')} ${sc.toFixed(2)}`, X, Y - 9, { size: 11, font: 'mono', color: '#34d399', alpha: show }); }
    text(g, tx('det'), 24, 24, { size: 10.5, font: 'mono', color: '#a9bcc5', alpha: smooth(0.3, 1, lt), spacing: 1 });
    const ev = smooth(cue(2), cue(2) + 0.7, lt) * (1 - smooth(cue(4) - 0.4, cue(4), lt));
    if (ev > 0) { glass(g, 860, 120, 360, 170, ev); text(g, tx('event'), 880, 146, { size: 11, font: 'mono', color: '#91d7e8', alpha: ev, spacing: 2 }); tx('evRows').forEach((r, i) => text(g, r, 880, 180 + i * 26, { size: 15, weight: 600, alpha: ev, color: i === 3 ? '#34d399' : '#f2f4f4' })); }
    const rj = smooth(cue(3), cue(3) + 0.6, lt) * (1 - smooth(cue(4) - 0.3, cue(4) + 0.2, lt));
    if (rj > 0) tx('rejRows').forEach((r, i) => { const a = rj * smooth(cue(3) + i * 0.35, cue(3) + i * 0.35 + 0.4, lt); glass(g, 860 + i * 124, 310, 112, 70, a); text(g, r, 916 + i * 124, 334, { size: 14, weight: 700, align: 'center', alpha: a }); text(g, `✕ ${tx('rej')}`, 916 + i * 124, 360, { size: 10, font: 'mono', align: 'center', color: '#ff5b6e', alpha: a }); });
    const oem = smooth(cue(4), cue(4) + 0.6, lt) * (1 - smooth(cue(5) - 0.3, cue(5) + 0.2, lt)), lg = smooth(cue(5), cue(5) + 0.6, lt);
    if (oem > 0) { glass(g, 330, 420, 620, 56, oem); text(g, tx('oem'), 640, 448, { size: 13, weight: 700, align: 'center', alpha: oem, color: '#dfe7ea' }); }
    if (lg > 0) { glass(g, 300, 420, 680, 56, lg); text(g, tx('logged'), 640, 448, { size: 13, weight: 700, align: 'center', alpha: lg, color: '#fbbf24' }); }
    credit(g, tx('dash')); C.tex.needsUpdate = true;
  } };
}
function devices() {
  const C = canvasScene(); let WMK;
  const wm = () => { if (WMK) return WMK; const c = document.createElement('canvas'); c.width = 390; c.height = 820; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 820); gr.addColorStop(0, '#0b1a26'); gr.addColorStop(1, '#03070b'); g.fillStyle = gr; g.fillRect(0, 0, 390, 820); text(g, 'SENDA', 195, 380, { size: 64, weight: 800, align: 'center' }); text(g, 'DRIVE', 195, 440, { size: 28, weight: 700, font: 'mono', align: 'center', color: '#ff7756', spacing: 6 }); WMK = c; return c; };
  return { scene: C.scene, camera: C.camera, bloom: [0.3, 0.4, 0.88], async update(lt, d, cue) {
    const img = await frame('harder', 600 + Math.floor(lt * 25)), g = C.g; cover(g, img, { zoom: 1.1, filter: 'blur(9px) brightness(.38) saturate(.7)' });
    const show = [cue(0), cue(1), cue(3)], labels = [tx('base'), tx('play'), tx('ios')];
    labels.forEach((L, i) => { const a = smooth(show[i] - 0.2, show[i] + 0.7, lt), x = 250 + i * 390; phone(g, wm(), x, 250 + (1 - a) * 30, 330, { alpha: a }); text(g, L[0], x, 450, { size: 15, weight: 800, font: 'mono', align: 'center', alpha: a, spacing: 1 }); text(g, L[1], x, 474, { size: 13, align: 'center', color: '#a9bcc5', alpha: a }); });
    const au = smooth(cue(1) + 0.4, cue(1) + 1.2, lt); if (au > 0) { const x = 640 + 120, y = 250; glass(g, x - 10, y - 70, 240, 130, au); g.save(); g.globalAlpha = au; g.drawImage(wm(), 0, 300, 390, 220, x, y - 60, 220, 110); g.restore(); text(g, tx('auto')[0], x + 110, y + 82, { size: 13, weight: 800, font: 'mono', align: 'center', alpha: au, color: '#91d7e8' }); text(g, tx('auto')[1], x + 110, y + 102, { size: 12, align: 'center', alpha: au * (0.6 + 0.4 * smooth(cue(2), cue(2) + 0.6, lt)), color: '#fbbf24' }); }
    credit(g, tx('dash')); C.tex.needsUpdate = true;
  } };
}

export const BUILD4 = { aerialBeacon, aerialChain, aerialSide, aerialRel, backdrop, autostartHud, phoneShot, sensors, detect, devices };

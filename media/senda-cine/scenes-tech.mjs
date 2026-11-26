// Escenas técnicas: radar de personas (seguidor Kalman real del núcleo), render del módulo SENDA Radar y red sin cobertura.
import { THREE, C, g, W, H, ease, clamp, lerp, seg, text, panel, project } from './kit.mjs';
import { createTracker, cleanTargets } from '/investor-next/public/senda/core/mmwave-radar.mjs';

function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
let _glow; function glow() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); _glow = new THREE.CanvasTexture(c); return _glow; }
const sprite = (color, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ color, map: glow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(s); return m; };
function stage(bg) { const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 500); scene.add(new THREE.HemisphereLight('#7fa3bb', '#05080a', 0.7)); const k = new THREE.DirectionalLight('#ffffff', 1.4); k.position.set(4, 8, 6); scene.add(k); const r = new THREE.DirectionalLight('#91d7e8', 0.8); r.position.set(-6, 3, -5); scene.add(r); return { scene, camera }; }

// Trayectorias de la simulación (milímetros, sistema del radar: x a la derecha, y al frente). Ruido inventado ±80 mm.
const PATHS = [
  (s) => ({ xMm: -2600 + 650 * s, yMm: 3300 }),
  (s) => ({ xMm: 2500 - 520 * s, yMm: 4200 + 250 * Math.sin(s / 2) }),
  (s) => ({ xMm: 1600 * Math.cos(s * 0.55), yMm: 2300 + 800 * Math.sin(s * 0.55) }),
];
const TCFG = { gateMm: 900, qMmS2: 1500, rMm: 120, maxMissS: 1.5 }, CLEAN = { minMm: 100, maxMm: 8000, mergeMm: 1000 }; // ajustes por defecto de la página /senda/personas (elecciones de diseño declaradas allí)
function runTracker(dur) {
  const tr = createTracker(TCFG), out = [];
  for (let k = 0; k <= Math.ceil(dur * 10); k++) { const s = k / 10; const dets = cleanTargets(PATHS.map((f, i) => { const q = f(s); return { ...q, xMm: q.xMm + (rnd(k * 3 + i) - 0.5) * 160, yMm: q.yMm + (rnd(k * 7 + i) - 0.5) * 160, speedCms: 0 }; }), CLEAN); out.push(tr.step(dets, s)); }
  return out;
}
const TRACK_COL = [C.mint, C.sky, C.sun, C.ember, C.rose];
function drawPPI(ctx, x, y, R, tracks) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = 'rgba(147,167,177,.35)'; ctx.lineWidth = 1.5;
  for (let m = 2; m <= 8; m += 2) { ctx.beginPath(); ctx.arc(0, 0, (R * m) / 8, Math.PI, 2 * Math.PI); ctx.stroke(); }
  for (let a = -90; a <= 90; a += 30) { const r = (a * Math.PI) / 180; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(r) * R, -Math.cos(r) * R); ctx.stroke(); }
  for (const t of tracks ?? []) { const c = TRACK_COL[(t.id - 1) % TRACK_COL.length]; ctx.strokeStyle = c; ctx.globalAlpha = 0.6; ctx.lineWidth = 3; ctx.beginPath(); t.trail.forEach(([tx, ty], i) => { const px = (tx / 8000) * R, py = -(ty / 8000) * R; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); ctx.globalAlpha = 1;
    const px = (t.xMm / 8000) * R, py = -(t.yMm / 8000) * R; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, R / 40, 0, 7); ctx.fill(); ctx.font = `600 ${Math.round(R / 18)}px Inter`; ctx.fillText('#' + t.id, px + R / 30, py - R / 30); }
  ctx.restore();
}

function radar({ sc }) {
  const { scene, camera } = stage('#03070a');
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: '#0a1014', roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.PolarGridHelper(9, 6, 8, 64, '#1f3a46', '#15262e'); grid.position.y = 0.01; scene.add(grid);
  const dev = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: '#1c2328', metalness: 0.3, roughness: 0.5 })); dev.position.set(0, 1.2, 0); scene.add(dev);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), new THREE.MeshStandardMaterial({ color: '#555' })); legs.position.set(0, 0.6, 0); scene.add(legs);
  const cone = new THREE.Mesh(new THREE.CircleGeometry(8, 64, Math.PI / 2 - Math.PI / 3, (2 * Math.PI) / 3), new THREE.MeshBasicMaterial({ color: C.sky, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })); cone.rotation.x = -Math.PI / 2; cone.rotation.z = Math.PI; cone.position.y = 0.02; scene.add(cone);
  const body = new THREE.MeshStandardMaterial({ color: '#9fb1bb', roughness: 0.6 }); const people = PATHS.map(() => { const p = new THREE.Group(); const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.2, 16), body); torso.position.y = 0.95; const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), body); head.position.y = 1.72; p.add(torso, head); scene.add(p); return p; });
  const sweep = sprite(C.sky, 0.5); sweep.position.set(0, 1.2, 0); scene.add(sweep);
  const steps = runTracker(sc.duration + 1);
  let cur = [];
  function update({ local, p }) {
    const s = local; PATHS.forEach((f, i) => { const q = f(s); people[i].position.set(q.xMm / 1000, 0, -q.yMm / 1000); people[i].rotation.y = Math.sin(s + i) * 0.3; });
    cur = steps[Math.min(steps.length - 1, Math.floor(local * 10))];
    const a = 2.3 + p * 0.9; camera.position.set(Math.cos(a) * 9, lerp(5.5, 4, p), Math.sin(a) * 9 - 2); camera.lookAt(0, 0.8, -3.2);
  }
  function overlay({ lineAt, local }) {
    const a = ease(seg(local, 1, 2)); panel(1180, 250, 640, 400, 0.84 * a); g.save(); g.globalAlpha = a; drawPPI(g, 1500, 610, 300, cur); g.restore();
    text('Pantalla de radar · /senda/personas', 1210, 290, { px: 20, w: 550, color: C.gray, alpha: a });
    const k1 = ease(seg(lineAt(1), 0.2, 0.5)); if (k1 > 0) { panel(1180, 670, 640, 96, 0.84 * k1); text('Filtro de Kalman + asignación óptima', 1210, 712, { px: 25, w: 600, alpha: k1 }); text('mmwave-radar.mjs · identidad estable al cruzarse', 1210, 744, { px: 19, w: 500, color: C.gray, alpha: k1, mono: true }); }
    const k2 = ease(seg(lineAt(2), 0.2, 0.5)); if (k2 > 0) { panel(1180, 786, 640, 96, 0.84 * k2); text('Práctica de campo → senda-campo-*.json', 1210, 828, { px: 25, w: 600, alpha: k2 }); text('huella SHA-256 · reproducible bit a bit', 1210, 860, { px: 19, w: 500, color: C.mint, alpha: k2 }); }
  }
  return { scene, camera, update, overlay };
}

// ---------- Render de diseño del módulo SENDA Radar (giro 360° y vista explosionada)
function roundedBox(w, h, d, r, mat) { const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: r * 0.4, bevelSize: r * 0.4, bevelSegments: 6, curveSegments: 12 }); geo.center(); return new THREE.Mesh(geo, mat); }
function moduleRender() {
  const { scene, camera } = stage('#05090c');
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: '#0b1216', metalness: 0.4, roughness: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -3.6; scene.add(floor);
  const spot = new THREE.SpotLight('#ffffff', 220, 40, 0.5, 0.7, 1.4); spot.position.set(0, 12, 6); spot.target.position.set(0, 0, 0); scene.add(spot, spot.target);
  const dev = new THREE.Group(); scene.add(dev);
  const shellM = new THREE.MeshStandardMaterial({ color: '#232b31', metalness: 0.15, roughness: 0.45 });
  const back = roundedBox(9, 6.4, 1.6, 0.7, shellM); back.position.z = -0.9; dev.add(back);
  const front = roundedBox(9, 6.4, 0.6, 0.7, shellM); front.position.z = 0.6; dev.add(front);
  const radome = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 0.12), new THREE.MeshStandardMaterial({ color: '#cfd8dc', transparent: true, opacity: 0.42, roughness: 0.2 })); radome.position.set(-1.8, 0, 0.98); dev.add(radome);
  const scr = document.createElement('canvas'); scr.width = 512; scr.height = 320; const sx = scr.getContext('2d'); const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), new THREE.MeshBasicMaterial({ map: scrTex })); screen.position.set(2.55, 0.2, 0.93); dev.add(screen);
  const pcbM = new THREE.MeshStandardMaterial({ color: '#0f5c3a', roughness: 0.6 }), chipM = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.4 }), goldM = new THREE.MeshStandardMaterial({ color: '#d4a63a', metalness: 1, roughness: 0.25 });
  const mcu = new THREE.Group(); const mcuB = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.75, 0.12), pcbM); mcu.add(mcuB); const can = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.18), new THREE.MeshStandardMaterial({ color: '#c0c8cc', metalness: 0.9, roughness: 0.3 })); can.position.z = 0.15; mcu.add(can);
  const usb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.3), new THREE.MeshStandardMaterial({ color: '#bfc6ca', metalness: 1, roughness: 0.2 })); usb.position.set(0, -0.95, 0.1); mcu.add(usb); mcu.position.set(2.4, -0.3, -0.2); dev.add(mcu);
  const rad = new THREE.Group(); const radB = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 0.1), pcbM); rad.add(radB); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const patch = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.04), goldM); patch.position.set(-1.1 + i * 0.7, -0.45 + j * 0.9, 0.08); rad.add(patch); } const ic = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.12), chipM); ic.position.set(1.3, 0.7, 0.1); rad.add(ic);
  rad.position.set(-1.8, 0, 0.4); dev.add(rad);
  const bat = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.4, 0.55), new THREE.MeshStandardMaterial({ color: '#2f5b8a', metalness: 0.3, roughness: 0.5 })); bat.position.set(0, 0, -1.0); dev.add(bat);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 24), new THREE.MeshStandardMaterial({ color: '#9aa4aa', metalness: 1, roughness: 0.3 })); thread.position.set(0, -3.4, -0.5); dev.add(thread);
  const parts = [ { o: front, d: [0, 0, 4.2], s: 'Carcasa impresa en 3D' }, { o: radome, d: [0, 0, 5.6], s: 'Ventana del radar (sin metal delante)' }, { o: screen, d: [0, 1.2, 5.0], s: 'Pantalla tipo radar' }, { o: rad, d: [-1.2, 1.6, 2.6], s: 'Radar de 24 GHz' }, { o: mcu, d: [2.6, -1.2, 1.4], s: 'ESP32-S3 · USB-C' }, { o: bat, d: [0, -1.4, -3.2], s: 'Batería LiPo' }, { o: back, d: [0, 0, -4.8], s: '' } ];
  parts.forEach((q) => (q.base = q.o.position.clone()));
  let ex = 0, tick = 0;
  function update({ local, p }) {
    tick = local; ex = ease(seg(p, 0.3, 0.52)) * (1 - ease(seg(p, 0.8, 0.95)));
    parts.forEach((q) => q.o.position.set(q.base.x + q.d[0] * ex, q.base.y + q.d[1] * ex, q.base.z + q.d[2] * ex));
    dev.rotation.y = -0.6 + local * 0.42; dev.rotation.x = -0.12 + 0.06 * Math.sin(local * 0.5);
    camera.position.set(0, lerp(3.5, 2.2, ease(p)), lerp(26, 22, ease(p)) + ex * 6); camera.lookAt(0, -0.3, 0);
    sx.fillStyle = '#04080b'; sx.fillRect(0, 0, 512, 320); const fake = PATHS.slice(0, 2).map((f, i) => { const q = f(local); return { id: i + 1, xMm: q.xMm, yMm: q.yMm, trail: [] }; }); drawPPI(sx, 256, 300, 260, fake); scrTex.needsUpdate = true;
  }
  function overlay({ local }) {
    if (ex < 0.2) return; const pts = parts.filter((q) => q.s).map((q) => { const wp = new THREE.Vector3(); q.o.getWorldPosition(wp); return { q, p: project(wp, camera) }; });
    // Etiquetas en dos columnas (izquierda/derecha del dispositivo), separadas en vertical para que no se pisen
    const cols = [pts.filter((x) => x.p.x < W / 2).sort((a, b) => a.p.y - b.p.y), pts.filter((x) => x.p.x >= W / 2).sort((a, b) => a.p.y - b.p.y)];
    cols.forEach((col, side) => { let lastY = -1e9; col.forEach(({ q, p }) => { const ly = Math.max(p.y, lastY + 46); lastY = ly; const lx = side ? W - 430 : 150; g.save(); g.globalAlpha = ex; g.strokeStyle = 'rgba(251,191,36,.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(side ? lx - 14 : lx + 340, ly - 8); g.stroke(); g.fillStyle = C.sun; g.fillRect(p.x - 5, p.y - 5, 10, 10); g.restore(); text(q.s, lx, ly, { px: 24, w: 600, alpha: ex }); }); });
  }
  return { scene, camera, update, overlay };
}

// ---------- Sin cobertura: fragmentos por todos los caminos, k de n y firma humana
function mesh() {
  const { scene, camera } = stage('#02060a'); scene.fog = new THREE.FogExp2('#02060a', 0.006);
  const city = new THREE.Group(); const bm = new THREE.MeshStandardMaterial({ color: '#1a2731', roughness: 0.8 });
  for (let i = 0; i < 160; i++) { const h = 2 + rnd(i) * 14; const b = new THREE.Mesh(new THREE.BoxGeometry(4, h, 4), bm); b.position.set(-90 + (i % 16) * 12, h / 2, -40 + Math.floor(i / 16) * 9); city.add(b); } scene.add(city);
  const A = new THREE.Vector3(-70, 3, 0), B = new THREE.Vector3(70, 3, 0); const sa = sprite(C.ember, 9), sb = sprite(C.mint, 9); sa.position.copy(A); sb.position.copy(B); scene.add(sa, sb);
  const BEARERS = [['Bluetooth', C.sky], ['wifi', C.mint], ['radio', C.sun], ['internet', C.ember], ['Bluetooth', C.sky], ['wifi', C.mint]];
  const cut = new Set([2, 4]);
  const paths = BEARERS.map(([n, c], i) => { const mid = new THREE.Vector3(0, 10 + i * 7, (i - 2.5) * 14); const curve = new THREE.QuadraticBezierCurve3(A, mid, B); const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.45, 8, false), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5 })); scene.add(line); const frag = sprite(c, 4.5); scene.add(frag); return { n, c, curve, line, frag, mid }; });
  let arrived = 0, k = 0;
  function update({ lineAt, p, local }) {
    k = lineAt(0); arrived = 0;
    paths.forEach((P, i) => { const q = clamp(k * 1.25 - i * 0.04); const stop = cut.has(i) ? 0.55 : 1; const pos = Math.min(q, stop); P.frag.position.copy(P.curve.getPoint(pos)); P.frag.visible = q > 0 && !(cut.has(i) && q > stop + 0.05); P.line.material.opacity = cut.has(i) && q > stop ? 0.1 : 0.5; if (!cut.has(i) && q >= 1) arrived++; });
    sb.scale.setScalar(arrived >= 4 ? 9 + 5 * Math.sin(local * 5) ** 2 : 9);
    const a = -1.35 + p * 0.5; camera.position.set(Math.cos(a) * 150, 75, Math.sin(a) * 150 + 60); camera.lookAt(0, 8, 0);
  }
  function overlay({ lineAt, local }) {
    paths.forEach((P, i) => { const s = project(P.mid, camera); const a = ease(seg(local, 1, 2)); text(P.n, s.x, s.y - 14, { px: 22, w: 600, color: P.c, align: 'center', alpha: a });
      if (cut.has(i) && k * 1.25 - i * 0.04 > 0.56) { const c = project(P.curve.getPoint(0.55), camera); text('×', c.x, c.y + 14, { px: 54, w: 650, color: C.rose, align: 'center' }); } });
    const r = ease(seg(lineAt(1), 0.1, 0.4)); if (r > 0) { panel(W / 2 - 330, 230, 660, 110, 0.85 * r); text(`Mensaje reconstruido · ${arrived} de 6 fragmentos`, W / 2, 280, { px: 30, w: 650, color: C.mint, align: 'center', alpha: r }); text('erasure.mjs · Reed-Solomon · ejemplo: bastan 4 de 6', W / 2, 318, { px: 19, w: 500, color: C.gray, align: 'center', alpha: r, mono: true }); }
    const s = ease(seg(lineAt(2), 0.1, 0.35)); if (s > 0) { panel(W - 760, 640, 660, 200, 0.9 * s); text('Aviso público', W - 730, 690, { px: 22, w: 550, color: C.gray, alpha: s }); text('Lo firma una persona con autoridad', W - 730, 738, { px: 30, w: 650, alpha: s }); g.save(); g.globalAlpha = s; g.strokeStyle = C.sun; g.lineWidth = 3; g.beginPath(); for (let x = 0; x < 260 * ease(seg(lineAt(2), 0.3, 0.8)); x++) g.lineTo(W - 730 + x, 790 + Math.sin(x / 9) * 10 * Math.cos(x / 31)); g.stroke(); g.restore(); text('report-protocol.mjs · nivel N5', W - 430, 820, { px: 18, w: 500, color: C.gray, alpha: s, mono: true }); }
  }
  return { scene, camera, update, overlay };
}

export const techKinds = { radar, module: moduleRender, mesh };

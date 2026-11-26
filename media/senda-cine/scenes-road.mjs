// Escenas de carretera: autopista de Bélgica (fases), rumbo de marcha, llamada al 112 y conducción.
import { THREE, C, g, W, H, ease, clamp, lerp, seg, text, panel, wrap, project } from './kit.mjs';
import { call112Script } from '/investor-next/public/senda/core/road-guard.mjs';

const LANE = { left: -3.5, mid: 0, right: 3.5 }; // conducción por la derecha: el carril rápido es el izquierdo (x negativa)
const col = (h) => new THREE.Color(h);

function baseScene(fogFar = 220) {
  const scene = new THREE.Scene(); scene.background = col('#03070a'); scene.fog = new THREE.Fog('#03070a', 30, fogFar);
  scene.add(new THREE.HemisphereLight('#7f9fb5', '#0b1014', 1.35));
  const moon = new THREE.DirectionalLight('#b9d6ea', 1.25); moon.position.set(-40, 60, 30); scene.add(moon);
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 600);
  return { scene, camera };
}

export function makeRoad(scene, len = 900) {
  const grp = new THREE.Group();
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(15.5, len), new THREE.MeshStandardMaterial({ color: '#23292e', roughness: 0.85 }));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(0.6, 0, -len / 2 + 60); grp.add(asphalt);
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(160, len), new THREE.MeshStandardMaterial({ color: '#070b0d', roughness: 1 }));
  verge.rotation.x = -Math.PI / 2; verge.position.set(0, -0.02, -len / 2 + 60); grp.add(verge);
  const white = new THREE.MeshBasicMaterial({ color: '#cfd8dc' });
  const solid = (x) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, len), white); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, -len / 2 + 60); grp.add(m); };
  solid(-5.25); solid(5.25);
  for (const x of [-1.75, 1.75]) for (let z = 60; z > -len + 60; z -= 12) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4), white); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.01, z); grp.add(d); }
  const barMat = new THREE.MeshStandardMaterial({ color: '#7c8a92', metalness: 0.6, roughness: 0.4 });
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, len), barMat); barrier.position.set(-6.0, 0.4, -len / 2 + 60); grp.add(barrier);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, len), barMat); rail.position.set(8.4, 0.55, -len / 2 + 60); grp.add(rail);
  // Farolas con halo (sprites aditivos)
  const halo = new THREE.SpriteMaterial({ color: '#ffcc88', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex() });
  for (let z = 40; z > -len + 60; z -= 48) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 9), barMat); pole.position.set(-6.3, 4.5, z); grp.add(pole);
    const s = new THREE.Sprite(halo); s.position.set(-5.2, 9, z); s.scale.set(6, 6, 1); grp.add(s);
    const pl = new THREE.PointLight('#ffc27a', 7, 22, 2); pl.position.set(-4.8, 8.6, z); if (z % 96 === 40 % 96) grp.add(pl);
  }
  scene.add(grp); return grp;
}

let _glow;
export function glowTex() {
  if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); _glow = new THREE.CanvasTexture(c); return _glow;
}
function lamp(color, scale) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(scale, scale, 1); return s; }

export function makeCar(color = '#91d7e8') {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0b141a', metalness: 0.9, roughness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 4.4), paint); body.position.y = 0.55; car.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.52, 2.2), glass); cab.position.set(0, 1.1, 0.25); car.add(cab);
  const tyre = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.8 });
  for (const [x, z] of [[-0.85, -1.4], [0.85, -1.4], [-0.85, 1.4], [0.85, 1.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 16), tyre); w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z); car.add(w); }
  // Frontal hacia -z (sentido de la marcha)
  const head = []; for (const x of [-0.6, 0.6]) { const s = lamp('#fff6e0', 1.4); s.position.set(x, 0.62, -2.25); car.add(s); head.push(s); }
  const tail = []; for (const x of [-0.65, 0.65]) { const s = lamp('#ff3344', 0.9); s.position.set(x, 0.65, 2.22); car.add(s); tail.push(s); }
  const blink = []; for (const [x, z] of [[-0.85, -2.1], [0.85, -2.1], [-0.85, 2.1], [0.85, 2.1]]) { const s = lamp('#ffb020', 1.1); s.position.set(x, 0.7, z); s.visible = false; car.add(s); blink.push(s); }
  const beam = new THREE.SpotLight('#fff1d6', 40, 60, 0.45, 0.6, 1.6); beam.position.set(0, 0.7, -2); beam.target.position.set(0, 0, -20); car.add(beam, beam.target);
  car.userData = { head, tail, blink, body, paint };
  return car;
}
export function makeTruck() {
  const t = new THREE.Group();
  const cabM = new THREE.MeshStandardMaterial({ color: '#c9d1d6', metalness: 0.4, roughness: 0.45 });
  const boxM = new THREE.MeshStandardMaterial({ color: '#5d6b74', metalness: 0.2, roughness: 0.7 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.0, 2.4), cabM); cab.position.set(0, 1.9, -6.4); t.add(cab);
  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.55, 3.4, 12.5), boxM); trailer.position.set(0, 2.2, 1.3); t.add(trailer);
  for (const x of [-0.8, 0.8]) { const s = lamp('#fff6e0', 1.6); s.position.set(x, 1.0, -7.65); t.add(s); }
  for (let z = -5; z < 7; z += 3) for (const x of [-1.3, 1.3]) { const s = lamp('#ffaa22', 0.5); s.position.set(x, 0.8, z); t.add(s); }
  const beam = new THREE.SpotLight('#fff1d6', 55, 70, 0.5, 0.6, 1.6); beam.position.set(0, 1.2, -7.5); beam.target.position.set(0, 0, -30); t.add(beam, beam.target);
  return t;
}
const sparkGeo = new THREE.SphereGeometry(0.05, 6, 6);
function sparks(scene, n = 40) { const grp = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: '#ffd27a' }); for (let i = 0; i < n; i++) grp.add(new THREE.Mesh(sparkGeo, m)); scene.add(grp); return grp; }
function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// Coreografía declarada (ilustrativa, sin escala): posiciones en función del progreso de la escena del golpe.
function crashPose(p) {
  const v = 22; // unidades de escena por segundo de animación, no una velocidad medida
  const travel = (q) => v * 20 * (q - 0.5 * q * q * 0.9); // avanza decelerando
  const s = travel(Math.min(p, 0.85));
  const car = { x: LANE.right, z: -s, yaw: 0 }, truck = { x: LANE.mid, z: -s + 7.6, yaw: 0 };
  const a = seg(p, 0.0, 0.16), b = seg(p, 0.16, 0.45), c = seg(p, 0.45, 0.8), d = seg(p, 0.8, 0.88);
  truck.x = lerp(LANE.mid, 1.7, ease(a)); truck.yaw = -0.08 * ease(a);
  if (b > 0) { car.yaw = lerp(0, -1.4, ease(b)); car.x = lerp(LANE.right, 2.4, ease(b)); car.z = -s - 1.6 * ease(b); truck.x = lerp(1.7, 2.6, ease(b)); }
  if (c > 0) { truck.x = lerp(2.6, 6.6, ease(c)); truck.yaw = lerp(-0.08, -0.12, ease(c)) + 0.12 * ease(c);
    car.x = lerp(2.4, -4.5, ease(c)); car.yaw = lerp(-1.4, -Math.PI, ease(c)); car.z = -s - 1.6 - 9 * ease(c); }
  if (d > 0) { car.x = lerp(-4.5, -3.7, ease(d)); car.yaw = -Math.PI; }
  if (p >= 0.88) { car.x = -3.7; }
  return { car, truck, contact: a > 0.9 && b < 1, barrier: d > 0 && d < 1 ? d : 0, final: p >= 0.85 };
}

function highway({ sc }) {
  const phase = sc.visual.phase;
  const { scene, camera } = baseScene(phase === 'alert' ? 320 : 220);
  makeRoad(scene);
  const car = makeCar(C.sky), truck = makeTruck(); scene.add(car, truck);
  const sp = sparks(scene); const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.12), new THREE.MeshStandardMaterial({ color: C.sky, metalness: 0.6 })); scene.add(mirror);
  const flash = lamp('#ffffff', 0.1); scene.add(flash);
  const traffic = []; for (let i = 0; i < 7; i++) { const c = makeCar(['#c7ccd1', '#5a646b', '#8a3b3b', '#2d4a66', '#d6d0c4', '#3d3d3d', '#6b5a3a'][i]); scene.add(c); traffic.push(c); }
  const rings = []; for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: C.sky, transparent: true, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.08; scene.add(r); rings.push(r); }
  const wedge = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 70), new THREE.MeshBasicMaterial({ color: C.rose, transparent: true, opacity: 0, depthWrite: false })); wedge.rotation.x = -Math.PI / 2; wedge.position.y = 0.03; scene.add(wedge);
  const final = crashPose(1);
  const place = (obj, pose) => { obj.position.set(pose.x, 0, pose.z); obj.rotation.y = pose.yaw; };
  const labels = [];
  function update({ local, p }) {
    labels.length = 0;
    traffic.forEach((c) => (c.visible = false)); rings.forEach((r) => (r.visible = false)); wedge.material.opacity = 0; sp.visible = false; mirror.visible = false; flash.visible = false;
    car.userData.blink.forEach((b) => (b.visible = false));
    if (phase === 'intro') {
      const s = 20 * local; place(car, { x: LANE.right, z: -s, yaw: 0 }); place(truck, { x: LANE.mid, z: -s + 9 - 0.25 * local, yaw: 0 });
      traffic.slice(0, 4).forEach((c, i) => { c.visible = true; const lane = [LANE.left, LANE.mid, LANE.left, LANE.right][i]; place(c, { x: lane, z: -s - 30 - i * 26 + ((local * (6 + i * 3)) % 60) * (i % 2 ? 1 : -1), yaw: 0 }); });
      const k = ease(p); camera.position.set(lerp(9, 4.5, k), lerp(5.5, 3.2, k), -s + lerp(18, 12, k)); camera.lookAt(car.position.x - 1, 0.8, car.position.z - 6);
    } else if (phase === 'crash') {
      const P = crashPose(p); place(car, P.car); place(truck, P.truck);
      if (P.contact || (p > 0.12 && p < 0.5)) { sp.visible = true; sp.children.forEach((m, i) => { const age = ((local * 3 + rnd(i)) % 1); m.position.set(car.position.x - 1 + (rnd(i + 3) - 0.5) * 0.6 - age * 2.5 * rnd(i + 9), 0.8 + age * 1.6 * rnd(i + 5) - age * age * 2, car.position.z + (rnd(i + 7) - 0.5) * 2 + age * 3); m.scale.setScalar(1 - age); }); }
      const mk = seg(p, 0.08, 0.5); if (mk > 0 && mk < 1) { mirror.visible = true; mirror.position.set(LANE.right - 1.2 - mk * 6, 1 + Math.sin(mk * Math.PI) * 1.6, -crashPose(0.1).car.z * 0 + crashPose(0.1).car.z + mk * 6); mirror.rotation.set(mk * 9, mk * 7, 0); }
      if (P.barrier) { flash.visible = true; flash.position.set(-5.7, 0.9, car.position.z); flash.scale.setScalar(6 * Math.sin(P.barrier * Math.PI)); }
      if (P.final) car.userData.blink.forEach((b) => (b.visible = Math.floor(local * 2.2) % 2 === 0));
      const k = ease(p), cz = (car.position.z + truck.position.z) / 2;
      const ang = lerp(0.35, 1.9, k), R = lerp(17, 15, k); camera.position.set(car.position.x * 0.5 + Math.cos(ang) * R, lerp(8.5, 7, k), cz + Math.sin(ang) * R); camera.lookAt(car.position.x * 0.6 + truck.position.x * 0.4, 0.8, cz);
      if (p > 0.86) { labels.push({ v: car.position.clone().setY(2.4), s: 'coche · carril rápido · contra la circulación', c: C.rose }); labels.push({ v: truck.position.clone().setY(4.2), s: 'camión · arcén derecho', c: C.sun }); }
    } else {
      place(car, final.car); place(truck, final.truck); car.userData.blink.forEach((b) => (b.visible = Math.floor(local * 2.2) % 2 === 0));
      const cz = final.car.z;
      if (phase === 'danger') {
        wedge.material.opacity = 0.16 + 0.08 * Math.sin(local * 3); wedge.position.set(LANE.left, 0.03, cz + 36);
        traffic.slice(0, 3).forEach((c, i) => { c.visible = true; const zz = cz + 140 - ((local * 9 + i * 38) % 120); const swerve = clamp((cz + 34 - zz) / 14); place(c, { x: lerp(LANE.left, LANE.mid, ease(swerve)) + (i === 2 ? 3.5 : 0), z: zz, yaw: -0.25 * Math.sin(swerve * Math.PI) }); });
        rings.forEach((r, i) => { const a = ((local * 0.8 + i / 4) % 1); r.visible = true; r.material.color.set(C.sun); r.material.opacity = (1 - a) * 0.5; r.scale.setScalar(2 + a * 14); r.position.set(LANE.mid, 0.08, cz + 30); });
        const k = ease(p); camera.position.set(lerp(-2.5, -4.6, k), 1.6, cz + lerp(70, 34, k)); camera.lookAt(car.position.x, 0.8, cz);
        labels.push({ v: new THREE.Vector3(LANE.left, 0.2, cz + 30), s: 'zona de impacto secundario', c: C.rose });
      } else { // alert
        rings.forEach((r, i) => { const a = ((local * 0.45 + i / 4) % 1); r.visible = true; r.material.color.set(C.sky); r.material.opacity = (1 - a) * 0.75; r.scale.setScalar(3 + a * 120); r.position.set(car.position.x, 0.09, cz); });
        traffic.slice(0, 5).forEach((c, i) => { c.visible = true; const zz = cz + 60 + i * 40 - ((local * 6) % 40); const warned = (zz - cz) < 3 + ((local * 0.45) % 1) * 120 || local > 4;
          place(c, { x: warned ? LANE.right - (i % 2) * 3.5 : [LANE.left, LANE.mid][i % 2], z: zz, yaw: 0 }); c.userData.paint.emissive = col(warned ? '#5a3a00' : '#000000');
          if (warned && i < 3) labels.push({ v: c.position.clone().setY(2.2), s: 'aviso recibido', c: C.sun }); });
        const k = ease(p); const ang = lerp(0.9, 1.25, k); camera.position.set(Math.cos(ang) * 60, lerp(70, 55, k), cz + 70 + Math.sin(ang) * 10); camera.lookAt(0, 0, cz + 40);
        labels.push({ v: car.position.clone().setY(2.6), s: 'coche · carril rápido · el más peligroso', c: C.rose }); labels.push({ v: truck.position.clone().setY(4.4), s: 'camión · arcén', c: C.sun });
      }
    }
  }
  function overlay({ local, sc: s }) {
    for (const L of labels) { const q = project(L.v, camera); if (q.behind) continue; g.save(); g.fillStyle = L.c; g.fillRect(q.x - 6, q.y - 6, 12, 12); g.restore(); text(L.s, q.x + 16, q.y + 7, { px: 24, w: 600, color: C.ink }); }
    if (phase === 'alert') { const a = ease(seg(local, 1.5, 2.5)); panel(96, 210, 600, 150, 0.8 * a); text('Aviso SENDA', 126, 260, { px: 22, w: 550, color: C.sun, alpha: a });
      text('Vehículo inmovilizado en el carril izquierdo (rápido),', 126, 302, { px: 24, w: 550, alpha: a }); text('orientado contra la circulación', 126, 336, { px: 24, w: 550, alpha: a }); }
  }
  return { scene, camera, update, overlay };
}

// Rumbo de marcha antes del choque frente al rumbo final (esquema técnico 2D sobre fondo 3D sutil).
function heading() {
  const { scene, camera } = baseScene(); makeRoad(scene); camera.position.set(0, 60, 10); camera.lookAt(0, 0, -10);
  function update() {}
  function overlay({ lineAt, t, sc }) {
    g.save(); g.fillStyle = 'rgba(4,8,11,.72)'; g.fillRect(0, 0, W, H); g.restore();
    const ox = 560, top = 230, bot = 960, lw = 110; // tres carriles verticales; el tráfico sube por la pantalla
    g.save(); g.strokeStyle = 'rgba(207,216,220,.55)'; g.lineWidth = 3; for (const k of [0, 3]) { g.beginPath(); g.moveTo(ox + k * lw, top); g.lineTo(ox + k * lw, bot); g.stroke(); }
    g.setLineDash([26, 30]); for (const k of [1, 2]) { g.beginPath(); g.moveTo(ox + k * lw, top); g.lineTo(ox + k * lw, bot); g.stroke(); } g.restore();
    text('carril rápido', ox + lw * 0.5, bot + 40, { px: 20, w: 550, color: C.gray, align: 'center' }); text('carril derecho', ox + lw * 2.5, bot + 40, { px: 20, w: 550, color: C.gray, align: 'center' });
    text('sentido de la circulación ↑', ox + 3 * lw + 40, top + 30, { px: 22, w: 550, color: C.gray });
    const a0 = lineAt(0), a1 = lineAt(1), a2 = lineAt(2);
    // Coche final, girado 180°, en el carril rápido; su flecha apunta hacia abajo (contra la circulación)
    const cx = ox + lw * 0.5, cy = 420; g.save(); g.translate(cx, cy); g.fillStyle = C.sky; g.globalAlpha = 0.9; g.beginPath(); g.roundRect(-26, -50, 52, 100, 10); g.fill(); g.restore();
    arrow(cx, cy + 10, cx, cy + 10 + 150 * ease(seg(a0, 0, 0.5)), C.rose, 'rumbo final del coche', 'left');
    // Últimas posiciones antes del choque (carril derecho, subiendo) y el rumbo de marcha calculado
    const n = 9; for (let i = 0; i < n; i++) { const k = ease(seg(a1, i / n * 0.6, i / n * 0.6 + 0.15)); if (k <= 0) continue; g.save(); g.globalAlpha = k; g.fillStyle = C.mint; g.beginPath(); g.arc(ox + lw * 2.5 + Math.sin(i) * 4, 900 - i * 48, 7, 0, 7); g.fill(); g.restore(); }
    const ka = ease(seg(a1, 0.6, 1)); if (ka > 0) arrow(ox + lw * 2.5 + 60, 900, ox + lw * 2.5 + 60, 900 - 380 * ka, C.mint, 'rumbo de marcha', 'right');
    // Regla
    const kr = ease(seg(a2, 0, 0.3)); if (kr > 0) { panel(1130, 600, 700, 250, 0.85 * kr);
      text('Rumbo fiable → filtra por sentido de la calzada', 1160, 660, { px: 25, w: 600, color: C.mint, alpha: kr });
      text('Rumbo dudoso → avisa y marca «sentido dudoso»', 1160, 712, { px: 25, w: 600, color: C.sun, alpha: kr });
      text('road-guard.mjs · travelHeadingBefore() · carriagewayUncertain', 1160, 800, { px: 18, w: 500, color: C.gray, alpha: kr, mono: true }); }
  }
  function arrow(x0, y0, x1, y1, c, label, side) {
    g.save(); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 7; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0); if (Math.hypot(x1 - x0, y1 - y0) > 20) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 26 * Math.cos(ang - 0.45), y1 - 26 * Math.sin(ang - 0.45)); g.lineTo(x1 - 26 * Math.cos(ang + 0.45), y1 - 26 * Math.sin(ang + 0.45)); g.closePath(); g.fill(); }
    g.restore(); text(label, side === 'left' ? x0 - 60 : x1 + 40, (y0 + y1) / 2, { px: 24, w: 600, color: c, align: side === 'left' ? 'right' : 'left' });
  }
  return { scene, camera, update, overlay };
}

// La llamada al 112: el guion lo genera la función real call112Script() con lo declarado en el caso.
function call112() {
  const { scene, camera } = baseScene(); makeRoad(scene); const car = makeCar(C.sky); scene.add(car); car.position.set(-3.7, 0, -40); car.rotation.y = Math.PI;
  const lines = call112Script({ where: 'una autopista de Bélgica', vehicles: 2, lane: 'LEFT_LANE', againstTraffic: true }).split(/(?<=\.) /).filter(Boolean);
  function update({ local, p }) { car.userData.blink.forEach((b) => (b.visible = Math.floor(local * 2.2) % 2 === 0)); const a = 0.6 + p * 0.5; camera.position.set(Math.cos(a) * 16 - 3.7, 6, -40 + Math.sin(a) * 16); camera.lookAt(-3.7, 0.8, -40); }
  function overlay({ lineAt }) {
    const a = ease(seg(lineAt(0), 0, 0.15)); g.save(); g.fillStyle = `rgba(4,8,11,${0.55 * a})`; g.fillRect(0, 0, W, H); g.restore();
    const px = 260, py = 230; panel(px, py, 560, 640, 0.92 * a, 34);
    text('Llamada al 112', px + 40, py + 70, { px: 30, w: 650, alpha: a }); text('Guion que prepara SENDA', px + 40, py + 108, { px: 20, w: 550, color: C.gray, alpha: a });
    let y = py + 170; lines.forEach((l, i) => { const k = ease(seg(lineAt(0), 0.1 + i * 0.1, 0.25 + i * 0.1)); for (const r of wrap(l, 480, 23, 550)) { text(r, px + 40, y, { px: 23, w: 550, alpha: k * a, color: i === 1 ? C.sun : C.ink }); y += 32; } y += 10; });
    const k2 = ease(seg(lineAt(1), 0, 0.3)); panel(1000, 600, 760, 190, 0.85 * k2);
    text('Prueba automática del caso', 1030, 655, { px: 22, w: 550, color: C.gray, alpha: k2 });
    text('roadsafe-case-hgv-sideswipe.test.mjs', 1030, 705, { px: 24, w: 500, mono: true, alpha: k2 });
    text('5 pruebas en verde en cada cambio del código', 1030, 752, { px: 24, w: 600, color: C.mint, alpha: k2 });
  }
  return { scene, camera, update, overlay };
}

// Conducción: brújula + GPS fusionados; la flecha gira aunque el coche esté parado.
function drive() {
  const { scene, camera } = baseScene(); makeRoad(scene); const car = makeCar(C.sky), stopped = makeCar('#c7ccd1'); scene.add(car, stopped);
  const puck = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 12, 96), new THREE.MeshBasicMaterial({ color: C.sky }));
  ring.rotation.x = Math.PI / 2; puck.add(ring);
  const arr = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 3), new THREE.MeshBasicMaterial({ color: C.mint })); arr.rotation.x = -Math.PI / 2; arr.position.z = -1.2; const arrG = new THREE.Group(); arrG.add(arr); puck.add(arrG); scene.add(puck);
  function update({ local, p }) {
    const moving = p > 0.45, s = moving ? 14 * (local - 0.45 * 14) : 0;
    car.position.set(LANE.left, 0, -s); puck.position.set(LANE.left, 3.4, -s);
    arrG.rotation.y = moving ? 0 : Math.sin(local * 0.9) * 1.6; // parado: la flecha sigue la mirada (brújula)
    stopped.position.set(LANE.left, 0, -s - 110 + 0); stopped.rotation.y = 0; stopped.userData.blink.forEach((b) => (b.visible = moving && Math.floor(local * 2.2) % 2 === 0)); stopped.visible = moving;
    camera.position.set(LANE.left + 6, 7, -s + 15); camera.lookAt(LANE.left, 1.5, -s - 10);
  }
  function overlay({ p, local }) {
    const moving = p > 0.45; const a = ease(seg(local, 1, 2));
    panel(110, 820 - 120, 470, 120, 0.75 * a); text('Rumbo', 140, 745, { px: 20, w: 550, color: C.gray, alpha: a });
    text(moving ? 'GPS · en marcha' : 'Brújula calibrada · parado', 140, 790, { px: 28, w: 600, color: moving ? C.mint : C.sky, alpha: a });
    if (moving) { const k = ease(seg(p, 0.55, 0.65)); panel(W / 2 - 330, 230, 660, 110, 0.88 * k); text('Vehículo detenido en tu carril', W / 2, 297, { px: 32, w: 650, color: C.sun, align: 'center', alpha: k }); }
  }
  return { scene, camera, update, overlay };
}

export const roadKinds = { highway, heading, call112, drive };

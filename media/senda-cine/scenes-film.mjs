// Escenas de la película completa: prólogo, drones, fuego (Sentinel-2 real), clips reales de la app, memoria, públicos y financiación.
import { THREE, C, g, W, H, ease, clamp, lerp, seg, text, panel, wrap, project } from './kit.mjs';
import { makeDrone, lamp } from './models.mjs';

const D = '/investor-next/public/senda/data/';
function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function stage(bg = '#02060a', fog = 0.004) { const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); scene.fog = new THREE.FogExp2(bg, fog); const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 3000); scene.add(new THREE.HemisphereLight('#7a98ad', '#05080a', 0.7)); const d = new THREE.DirectionalLight('#ffffff', 1.0); d.position.set(-60, 120, 60); scene.add(d); return { scene, camera }; }
function starfield(scene, n = 900, r = 900) { const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = rnd(i) * 2 - 1, a = rnd(i + 7) * Math.PI * 2, rr = r * (0.6 + 0.4 * rnd(i + 3)); pos.set([Math.sqrt(1 - u * u) * Math.cos(a) * rr, Math.abs(u) * rr * 0.6 + 40, Math.sqrt(1 - u * u) * Math.sin(a) * rr], i * 3); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#9fb8c8', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55 }))); }

// ---------- Prólogo: la península de noche, cuatro días que marcaron
const EVENTS = [null, { n: 'Valencia · DANA', lat: 39.47, lon: -0.38, c: C.sky }, { n: 'Apagón peninsular', lat: 40.2, lon: -3.7, c: C.sun, all: true }, { n: 'Adamuz · trenes', lat: 38.0098, lon: -4.5648, c: C.rose }, { n: 'San Martín de Valdeiglesias · fuego', lat: 40.36, lon: -4.4, c: C.ember }];
const CITIES = [[40.42, -3.7], [41.39, 2.17], [39.47, -0.38], [37.39, -5.98], [43.26, -2.93], [41.65, -0.88], [36.72, -4.42], [38.72, -9.14], [41.15, -8.61], [43.36, -8.41], [37.98, -1.13], [41.65, -4.72], [42.88, -8.54], [37.18, -3.6], [38.35, -0.48], [39.57, 2.65], [42.8, -1.64], [43.53, -5.66], [36.53, -6.29], [38.88, -6.97]];
function prologue() {
  const { scene, camera } = stage('#01040a', 0.0012); starfield(scene);
  const P = (lon, lat) => new THREE.Vector3((lon + 3.7) * 22, 0, -(lat - 40.2) * 28);
  const coast = new THREE.Group(); scene.add(coast); const st = {};
  const ready = fetch('/media/promo-video/land.js').then((r) => r.text()).then((t) => { const L = JSON.parse(t.slice(t.indexOf('=') + 1).replace(/;\s*$/, ''));
    st.lines = []; for (const ring of L.rings) { let pts = []; for (let i = 0; i < ring.length; i += 2) { const lon = ring[i], lat = ring[i + 1]; if (lon > -14 && lon < 9 && lat > 33 && lat < 47) pts.push(P(lon, lat)); else { if (pts.length > 1) st.lines.push(pts); pts = []; } } if (pts.length > 1) st.lines.push(pts); }
    st.alpha = 0.9; });
  const cities = CITIES.map(([la, lo]) => { const s = lamp('#ffd9a0', 7); s.position.copy(P(lo, la)).setY(0.5); scene.add(s); return s; });
  const pulses = EVENTS.map((e) => { if (!e || e.all) return null; const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: e.c, transparent: true, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.copy(P(e.lon, e.lat)).setY(0.6); scene.add(r); const core = lamp(e.c, 10); core.position.copy(r.position); scene.add(core); return { r, core }; });
  let k = [];
  function update({ lineAt, local, p, sc }) {
    k = sc.lines.map((_, i) => lineAt(i));
    const black = clamp(k[2] * 3) * (1 - clamp(k[3] * 4)); // apagón: se apagan las ciudades durante su frase
    cities.forEach((c, i) => { c.material.opacity = 1 - black * (0.92 + 0.08 * rnd(i)); });
    st.alpha = 0.9 - black * 0.6;
    pulses.forEach((q, i) => { if (!q) return; const on = k[i] > 0 ? 1 : 0; const ph = (local * 0.7) % 1; q.r.visible = !!on; q.core.visible = !!on; q.r.scale.setScalar(1 + ph * 14); q.r.material.opacity = (1 - ph) * 0.8 * on; });
    const a = -1.2 + p * 0.5, R = lerp(330, 230, ease(p)); camera.position.set(Math.cos(a) * R * 0.5, lerp(260, 170, ease(p)), Math.sin(a) * R * 0.3 + 180); camera.lookAt(0, 0, 0);
  }
  function overlay({ lineAt, local }) {
    if (st.lines) { g.save(); g.globalAlpha = st.alpha * ease(seg(local, 0.3, 2)); g.strokeStyle = '#5aa7c6'; g.lineWidth = 2.6; g.shadowColor = '#5aa7c6'; g.shadowBlur = 12; for (const pts of st.lines) { g.beginPath(); pts.forEach((v, i) => { const q = project(v, camera); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }); g.stroke(); } g.restore(); }
    EVENTS.forEach((e, i) => { if (!e) return; const a = ease(seg(lineAt(i), 0, 0.2)); if (a <= 0) return; const q = e.all ? { x: W / 2, y: H * 0.62 } : project(P(e.lon, e.lat), camera); text(e.n, q.x + (e.all ? 0 : 22), q.y + 8, { px: 26, w: 600, color: e.c, align: e.all ? 'center' : 'left', alpha: a }); });
    const last = ease(seg(lineAt(5), 0, 0.4)); if (last > 0) { text('SENDA', W / 2, H / 2, { px: 150, w: 650, align: 'center', alpha: last }); }
  }
  return { scene, camera, update, overlay, ready, envIntensity: 0.2 };
}

// ---------- Drones: barrido casa por casa, Remote ID y mula de datos
function drones() {
  const { scene, camera } = stage('#04080c', 0.006);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#141b20', roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 26), new THREE.MeshStandardMaterial({ color: '#1d3b52', roughness: 0.2, metalness: 0.3 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.05, 6); scene.add(water);
  const houses = []; const facade = new THREE.MeshStandardMaterial({ color: '#8d969c', roughness: 0.8 }), roof = new THREE.MeshStandardMaterial({ color: '#5b3a2e', roughness: 0.7 });
  for (let i = 0; i < 9; i++) { const floors = 2 + Math.floor(rnd(i) * 4), w = 10, h = floors * 3.1; const x = -48 + (i % 3) * 30 + (rnd(i + 2) - 0.5) * 8, z = -46 + Math.floor(i / 3) * 18; const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), facade); b.position.set(x, h / 2, z); scene.add(b); const r = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3, 4), roof); r.rotation.y = Math.PI / 4; r.position.set(x, h + 1.5, z); scene.add(r);
    const win = []; for (let f = 0; f < floors; f++) for (let k = 0; k < 3; k++) { const wv = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), new THREE.MeshStandardMaterial({ color: '#0d1418', emissive: '#000000' })); wv.position.set(x - 3 + k * 3, 1.6 + f * 3.1, z + 4.01); scene.add(wv); win.push({ m: wv, f }); } houses.push({ x, z, h, floors, win, occ: rnd(i + 11) }); }
  // Orden de visita: vecino más cercano desde la base (el planificador de SENDA añade una mejora 2-opt)
  const base = new THREE.Vector3(-70, 2, 10); const order = []; { const left = houses.map((_, i) => i); let cur = { x: base.x, z: base.z }; while (left.length) { left.sort((a, b) => Math.hypot(houses[a].x - cur.x, houses[a].z - cur.z) - Math.hypot(houses[b].x - cur.x, houses[b].z - cur.z)); const n = left.shift(); order.push(n); cur = houses[n]; } }
  const pts = [base.clone()]; order.forEach((i) => { const hs = houses[i]; for (let a = 0; a <= 1.001; a += 0.125) pts.push(new THREE.Vector3(hs.x + Math.cos(a * Math.PI * 2 + Math.PI / 2) * 9, hs.h * 0.6 + 2, hs.z + Math.sin(a * Math.PI * 2 + Math.PI / 2) * 9)); });
  const route = new THREE.CatmullRomCurve3(pts); const routeLine = new THREE.Mesh(new THREE.TubeGeometry(route, 600, 0.12, 6, false), new THREE.MeshBasicMaterial({ color: C.sky, transparent: true, opacity: 0.45 })); scene.add(routeLine);
  const drone = makeDrone(3.2); scene.add(drone);
  const rings = []; for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: C.mint, transparent: true, depthWrite: false })); scene.add(r); rings.push(r); }
  const isle = new THREE.Vector3(120, 18, -80); const isleMark = lamp(C.ember, 12); isleMark.position.copy(isle); scene.add(isleMark);
  let phase = 0, kk = [];
  function update({ lineAt, local, sc }) {
    kk = sc.lines.map((_, i) => lineAt(i));
    const fly = clamp(kk[0] * 0.25 + kk[1] * 0.75), u = ease(fly); const pos = route.getPoint(u), ahead = route.getPoint(Math.min(1, u + 0.005));
    phase = kk[4] > 0 ? 4 : kk[3] > 0 ? 3 : kk[2] > 0 ? 2 : 1;
    if (phase === 4) { const q = ease(kk[4]); pos.lerpVectors(route.getPoint(1), isle, q).setY(lerp(route.getPoint(1).y, 30, Math.sin(q * Math.PI)) + 4); }
    drone.position.copy(pos); drone.lookAt(phase === 4 ? isle : ahead); drone.userData.props.forEach((d, i) => (d.rotation.z = local * 40 + i));
    routeLine.material.opacity = phase === 4 ? 0.15 : 0.45;
    // Ventanas: la escucha Bluetooth por plantas y la pasada térmica se encienden al pasar el dron (escenario sintético)
    const visited = Math.floor(fly * order.length + 0.5);
    houses.forEach((hs, i) => { const seen = order.indexOf(i) < visited; hs.win.forEach((w, j) => { const hot = seen && rnd(i * 31 + j) < 0.18 + hs.occ * 0.25; w.m.material.emissive.set(hot ? (phase >= 2 ? '#ff7a2a' : '#34d399') : '#000000'); w.m.material.emissiveIntensity = hot ? 1.4 : 0; }); });
    rings.forEach((r, i) => { const a = ((local * 0.8 + i / 3) % 1); r.visible = phase === 3; r.position.copy(drone.position); r.rotation.x = Math.PI / 2; r.scale.setScalar(2 + a * 30); r.material.opacity = (1 - a) * 0.7; });
    const cam = phase === 4 ? new THREE.Vector3(40, 80, 60) : new THREE.Vector3(drone.position.x + 35, drone.position.y + 28, drone.position.z + 45);
    camera.position.copy(cam); camera.lookAt(phase === 4 ? new THREE.Vector3(40, 10, -40) : drone.position);
  }
  function overlay({ lineAt }) {
    const a1 = ease(seg(lineAt(1), 0.05, 0.25)); if (a1 > 0) { panel(96, 230, 560, 150, 0.84 * a1); text('Barrido casa por casa', 126, 276, { px: 26, w: 650, alpha: a1 }); text('ruta mínima · salidas según batería', 126, 312, { px: 21, w: 550, color: C.gray, alpha: a1 }); text('Bluetooth por plantas · pasada térmica', 126, 344, { px: 21, w: 550, color: C.gray, alpha: a1 }); }
    const a2 = ease(seg(lineAt(2), 0.05, 0.25)); if (a2 > 0) { panel(W - 620, 230, 520, 230, 0.88 * a2); text('Tablero de prioridad · ejemplo sintético', W - 590, 274, { px: 21, w: 550, color: C.gray, alpha: a2 });
      [['Personas probables', 'intervalo bayesiano por planta', C.mint], ['Daño del edificio', 'escala EMS-98 (lo asigna una persona experta)', C.sun], ['Orden de visita', 'para los equipos de tierra', C.sky]].forEach(([t1, t2, c], i) => { g.save(); g.globalAlpha = a2; g.fillStyle = c; g.fillRect(W - 590, 304 + i * 50, 12, 12); g.restore(); text(t1, W - 566, 316 + i * 50, { px: 23, w: 600, alpha: a2 }); text(t2, W - 566, 340 + i * 50, { px: 17, w: 500, color: C.gray, alpha: a2 }); }); }
    const a3 = ease(seg(lineAt(3), 0.05, 0.25)); if (a3 > 0) { panel(96, 400, 640, 130, 0.86 * a3); text('Identificación remota · Open Drone ID', 126, 446, { px: 25, w: 650, alpha: a3 }); text('mensajes de 25 bytes · ASTM F3411 / EN 4709-002', 126, 480, { px: 20, w: 500, color: C.gray, alpha: a3, mono: true }); text('drone.mjs', 126, 508, { px: 18, w: 500, color: C.gray, alpha: a3, mono: true }); }
    const a4 = ease(seg(lineAt(4), 0.05, 0.25)); if (a4 > 0) { panel(96, 550, 560, 110, 0.86 * a4); text('Mula de datos', 126, 596, { px: 26, w: 650, color: C.ember, alpha: a4 }); text('lleva y trae mensajes entre zonas aisladas', 126, 630, { px: 21, w: 550, color: C.gray, alpha: a4 }); }
  }
  return { scene, camera, update, overlay, envIntensity: 0.5 };
}

// ---------- Fuego: relieve real (Copernicus DEM) con imágenes reales de Sentinel-2 y severidad dNBR
function fire() {
  const { scene, camera } = stage('#04070a', 0.0016); starfield(scene, 400); const st = {};
  const ready = (async () => {
    const real = await (await fetch(D + 'smv2026/real.json')).json(); const dem = new Int16Array(await (await fetch(D + 'smv2026/dem_100m.bin')).arrayBuffer());
    const Wd = real.dem.w, Hd = real.dem.h, sx = 190, sy = 170; const geo = new THREE.PlaneGeometry(Wd, Hd, sx, sy); const pa = geo.attributes.position;
    for (let iy = 0; iy <= sy; iy++) for (let ix = 0; ix <= sx; ix++) { const x = Math.min(Wd - 1, Math.round((ix / sx) * (Wd - 1))), y = Math.min(Hd - 1, Math.round((iy / sy) * (Hd - 1))); pa.setZ(iy * (sx + 1) + ix, (dem[y * Wd + x] - real.dem.min) / 100 * 2.6); }
    geo.computeVertexNormals(); geo.rotateX(-Math.PI / 2);
    const load = (f) => new Promise((ok) => new THREE.TextureLoader().load(D + 'smv2026/' + f, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }));
    const [pre, d24, d29, d08, dn] = await Promise.all(['tci_pre.jpg', 'tci_d0724.jpg', 'tci_d0729.jpg', 'tci_d0808.jpg', 'dnbr_d0808.png'].map(load));
    // Mezcla de dos fechas en el sombreador (transición suave) + capa de severidad dNBR
    const mat = new THREE.ShaderMaterial({ uniforms: { a: { value: pre }, b: { value: d24 }, dn: { value: dn }, k: { value: 0 }, sev: { value: 0 }, fogColor: { value: new THREE.Color('#04070a') }, fogDensity: { value: 0.0016 } }, fog: false,
      vertexShader: 'varying vec2 vUv; varying float vShade; void main(){ vUv = uv; vShade = 0.65 + 0.45 * normal.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D a; uniform sampler2D b; uniform sampler2D dn; uniform float k; uniform float sev; varying vec2 vUv; varying float vShade; void main(){ vec3 c = mix(texture2D(a,vUv).rgb, texture2D(b,vUv).rgb, k); vec4 s = texture2D(dn, vUv); c = mix(c, s.rgb, s.a * sev * 0.85); gl_FragColor = vec4(c * vShade * 1.15, 1.0); }' });
    scene.add(new THREE.Mesh(geo, mat)); Object.assign(st, { mat, tex: [pre, d24, d29, d08], real });
  })();
  let label = '', ha = null;
  function update({ lineAt, p }) {
    if (!st.mat) return; const k0 = lineAt(0), k1 = lineAt(1), k2 = lineAt(2);
    // Frase 1: antes → 24 de julio; frase 2: 24 → 29 de julio y severidad; frase 3: 8 de agosto
    let A = 0, B = 1, k = 0; if (k1 <= 0) { A = 0; B = 1; k = ease(seg(k0, 0.4, 1)); } else if (k2 <= 0) { A = 1; B = 2; k = ease(seg(k1, 0.35, 0.75)); } else { A = 2; B = 3; k = ease(seg(k2, 0, 0.4)); }
    st.mat.uniforms.a.value = st.tex[A]; st.mat.uniforms.b.value = st.tex[B]; st.mat.uniforms.k.value = k; st.mat.uniforms.sev.value = clamp(k1 * 2) * (1 - 0.4 * clamp(k2 * 3));
    const dates = ['antes del incendio · 16-07-2026', '24-07-2026', '29-07-2026', '08-08-2026']; label = dates[k > 0.5 ? B : A];
    const F = st.real.fechas; ha = (k > 0.5 ? B : A) === 1 ? F.d0724.ha_moderada_o_mas : (k > 0.5 ? B : A) === 2 ? F.d0729.ha_moderada_o_mas : (k > 0.5 ? B : A) === 3 ? F.d0808.ha_moderada_o_mas : null;
    const a = 0.8 + p * 0.9, R = lerp(330, 250, ease(p)); camera.position.set(Math.cos(a) * R, lerp(210, 150, ease(p)), Math.sin(a) * R); camera.lookAt(0, 20, 0);
  }
  function overlay({ lineAt, local }) {
    const a = ease(seg(local, 1, 2)); panel(W - 520, 140, 424, 150, 0.82 * a); text(label, W - 308, 196, { px: 30, w: 650, align: 'center', alpha: a }); text('Sentinel-2 · color natural', W - 308, 228, { px: 18, w: 550, color: C.gray, align: 'center', alpha: a });
    if (ha != null) text(`${Math.round(ha).toLocaleString('es-ES')} ha · severidad moderada o mayor (dNBR)`, W - 308, 266, { px: 19, w: 600, color: C.ember, align: 'center', alpha: a });
    const r = ease(seg(lineAt(2), 0.15, 0.45)); if (r > 0) { panel(96, 250, 700, 170, 0.86 * r); text('Modelo de Rothermel (1972) · velocidad de propagación', 126, 296, { px: 23, w: 600, alpha: r });
      text('R = I_R · ξ · (1 + φw + φs) / (ρb · ε · Qig)', 126, 350, { px: 32, w: 550, color: C.sun, alpha: r }); text('viento (φ_w) · pendiente (φ_s) · combustible real · fire-rothermel.mjs', 126, 394, { px: 18, w: 500, color: C.gray, alpha: r }); }
  }
  return { scene, camera, update, overlay, ready, noEnv: true };
}

// ---------- Clip real de la aplicación (WebM VP9 derivado del MP4 publicado), buscado fotograma a fotograma
function clip({ sc }) {
  const { scene, camera } = stage('#000000'); const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; // Se carga entero en memoria (blob): así se puede saltar a cualquier segundo aunque el servidor no admita peticiones por rangos.
  const ready = fetch(`/media/senda-film/build/clips/${sc.visual.clip}.webm`).then((r) => r.blob()).then((b) => new Promise((ok) => { v.addEventListener('loadeddata', ok, { once: true }); v.src = URL.createObjectURL(b); v.load(); }));
  async function update({ local }) { const t = Math.min((v.duration || 1) - 0.05, (sc.visual.start || 0) + local); if (Math.abs(v.currentTime - t) > 0.001) { await new Promise((ok) => { v.addEventListener('seeked', ok, { once: true }); v.currentTime = t; }); } }
  function overlay() {
    if (v.videoHeight > v.videoWidth) { // grabación de móvil en vertical: el teléfono a la derecha, sin oscurecer la pantalla
      const h = H - 190, w = (v.videoWidth / v.videoHeight) * h, x = W * 0.64 - w / 2, y = 135;
      g.save(); g.fillStyle = '#0b0f12'; g.beginPath(); g.roundRect(x - 14, y - 14, w + 28, h + 28, 34); g.fill(); g.beginPath(); g.roundRect(x, y, w, h, 22); g.clip(); g.drawImage(v, x, y, w, h); g.restore(); return;
    }
    const r = Math.min(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * r, h = v.videoHeight * r; g.drawImage(v, (W - w) / 2, (H - h) / 2, w, h); g.save(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, 200); g.restore(); }
  return { scene, camera, update, overlay, ready, noEnv: true };
}

// Fondo sobrio común para las escenas de texto
function calm() { const { scene, camera } = stage('#03070b', 0.002); starfield(scene, 700); const grid = new THREE.GridHelper(800, 60, '#163040', '#0d1c26'); grid.position.y = -20; scene.add(grid); return { scene, camera, move: (p) => { camera.position.set(Math.sin(p * 0.6) * 120, 60, 260 - p * 40); camera.lookAt(0, 0, 0); } }; }

// ---------- Memoria del proyecto y delegación entre agentes
function memory() {
  const { scene, camera, move } = calm();
  function update({ p }) { move(p); }
  function overlay({ lineAt }) {
    const a = ease(seg(lineAt(0), 0, 0.15)); const cx = W / 2, cy = 470; const nodes = [['Fundador', 'decide y firma', C.ember, cx, cy - 150], ['Agente que investiga', 'y programa', C.sky, cx - 380, cy + 110], ['Agente que revisa', 'valida, integra y publica', C.mint, cx + 380, cy + 110]];
    g.save(); g.globalAlpha = a * 0.6; g.strokeStyle = C.gray; g.lineWidth = 2; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) { g.beginPath(); g.moveTo(nodes[i][3], nodes[i][4]); g.lineTo(nodes[j][3], nodes[j][4]); g.stroke(); } g.restore();
    nodes.forEach(([t1, t2, c, x, y]) => { panel(x - 190, y - 52, 380, 104, 0.9 * a); g.save(); g.globalAlpha = a; g.fillStyle = c; g.fillRect(x - 166, y - 20, 12, 12); g.restore(); text(t1, x - 144, y - 8, { px: 26, w: 650, alpha: a }); text(t2, x - 144, y + 26, { px: 20, w: 550, color: C.gray, alpha: a }); });
    const b = ease(seg(lineAt(1), 0, 0.25)); const n = (v) => Math.round(v * ease(seg(lineAt(1), 0.05, 0.6)));
    [[`${n(590)}`, 'cambios registrados'], [`${n(113)}`, 'revisiones de código'], [`${n(1425).toLocaleString('es-ES')}`, 'pruebas automáticas']].forEach(([v, l], i) => { const x = 360 + i * 600; text(v, x, 760, { px: 64, w: 650, align: 'center', alpha: b, color: [C.sky, C.mint, C.sun][i] }); text(l, x, 800, { px: 22, w: 550, color: C.gray, align: 'center', alpha: b }); });
    const c = ease(seg(lineAt(2), 0, 0.25)); if (c > 0) { panel(W / 2 - 420, 600, 840, 80, 0.9 * c); text('Ningún dato sin fuente', W / 2, 652, { px: 34, w: 650, align: 'center', alpha: c, color: C.ember }); }
  }
  return { scene, camera, update, overlay, envIntensity: 0.3 };
}

// ---------- Públicos: ¿y a mí cómo me sirve?
const AUD = [['Bomberos', 'por dónde avanza el fuego y dónde puede haber personas', C.ember], ['Guardia Civil · UME · 112', 'la misma imagen, con fuente e integridad', C.sky], ['Ayuntamientos', 'qué calles se inundan primero y a quién avisar', C.mint], ['Ciudadanía', 'avisos sin cobertura y petición de ayuda con ubicación', C.sun], ['Desarrolladores', 'código abierto y pruebas para comprobarlo todo', C.gray], ['Inversores', 'ciencia verificable, lista para integrarse', C.rose]];
function audiences() {
  const { scene, camera, move } = calm();
  function update({ p }) { move(p); }
  function overlay({ lineAt }) { AUD.forEach(([t1, t2, c], i) => { const a = ease(seg(lineAt(i), 0, 0.2)); if (a <= 0) return; const col = i % 2, row = Math.floor(i / 2), x = 200 + col * 780, y = 250 + row * 150; panel(x, y, 720, 120, 0.88 * a); g.save(); g.globalAlpha = a; g.fillStyle = c; g.fillRect(x + 28, y + 38, 14, 14); g.restore(); text(t1, x + 60, y + 52, { px: 30, w: 650, alpha: a }); text(t2, x + 60, y + 90, { px: 21, w: 550, color: C.gray, alpha: a }); }); }
  return { scene, camera, update, overlay, envIntensity: 0.3 };
}

// ---------- Hoja de ruta y financiación
function funding() {
  const { scene, camera, move } = calm();
  function update({ p }) { move(p); }
  function overlay({ lineAt }) {
    const steps = [['Validación de campo', 'radar, agua y carretera con datos reales', C.mint, 0], ['Eurostars-3 · convocatoria 12', 'abre el 17-12-2026 · cierra el 04-03-2027', C.sky, 1], ['Horizonte Europa', 'consorcios europeos en 2027', C.sun, 1], ['Producto', 'software abierto + módulos físicos', C.ember, 2]];
    const y = 470; g.save(); g.strokeStyle = 'rgba(147,167,177,.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(200, y); g.lineTo(W - 200, y); g.stroke(); g.restore();
    steps.forEach(([t1, t2, c, li], i) => { const a = ease(seg(lineAt(li), i === 2 ? 0.45 : 0.05, i === 2 ? 0.65 : 0.25)); if (a <= 0) return; const x = 260 + i * 470; g.save(); g.globalAlpha = a; g.fillStyle = c; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); g.restore(); panel(x - 200, y + 50, 400, 130, 0.88 * a); text(t1, x, y + 104, { px: 25, w: 650, align: 'center', alpha: a }); for (const [j, r] of wrap(t2, 360, 19, 550).entries()) text(r, x, y + 140 + j * 26, { px: 19, w: 550, color: C.gray, align: 'center', alpha: a }); });
  }
  return { scene, camera, update, overlay, envIntensity: 0.3 };
}

export const filmKinds = { prologue, drones, fire, clip, memory, audiences, funding };

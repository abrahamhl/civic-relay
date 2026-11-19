// Escenas 3D de la película v2 (explicación completa). Mismo contrato que scenes.js:
// cada constructor recibe (visual, TEX) y devuelve { scene, camera, update(lt, dur, cue), bloom? }.
// Son visualizaciones ilustrativas; las cifras que aparecen salen del guion verificado.
import { T, clamp, mix, smooth, ease, rng, hash, points, setPoint, tint, label, makeCity, night, cam, fly } from './lib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const C = { coral: 0xff7756, ice: 0x91d7e8, green: 0x34d399, amber: 0xfbbf24, red: 0xff3b4e, blue: 0x3d7bff };
const cache = {};
const once = (k, f) => (cache[k] ??= f());
let ENV;
export const env = () => ENV;
export function setRenderer(r) { const pm = new T.PMREMGenerator(r); ENV = pm.fromScene(new RoomEnvironment(), 0.04).texture; }

// ───────── utilidades de modelado
const mat = (color, o = {}) => new T.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3, ...o });
const glow = (color, o = {}) => new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, ...o });
function studio(scene, bg = 0x0d1b2a, floor = 0x13263a) {
  scene.background = new T.Color(bg); scene.environment = ENV; scene.fog = new T.Fog(bg, 60, 220);
  scene.add(new T.HemisphereLight(0xcfe6ff, 0x1a2633, 1.1));
  const key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(12, 22, 14); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 }); scene.add(key);
  const rim = new T.DirectionalLight(0x91d7e8, 1.4); rim.position.set(-16, 8, -14); scene.add(rim);
  const f = new T.Mesh(new T.CircleGeometry(160, 64), mat(floor, { roughness: 0.72, metalness: 0.15, envMapIntensity: 0.4 })); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f);
  return f;
}
function roundRect(w, h, r) { const s = new T.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; }
function phoneMesh(tex, s = 1) {
  const g = new T.Group(), W = 3.9 * s, H = 8.2 * s, D = 0.42 * s;
  const body = new T.Mesh(new T.ExtrudeGeometry(roundRect(W, H, 0.55 * s), { depth: D, bevelEnabled: true, bevelThickness: 0.08 * s, bevelSize: 0.08 * s, bevelSegments: 3 }), mat(0x1b232c, { metalness: 0.85, roughness: 0.22 }));
  body.position.z = -D; body.castShadow = true; g.add(body);
  const scrMat = new T.MeshBasicMaterial({ map: tex || null, color: tex ? 0xffffff : 0x0b141c, toneMapped: false });
  const scr = new T.Mesh(new T.ShapeGeometry(roundRect(W * 0.92, H * 0.95, 0.42 * s)), scrMat); scr.position.z = 0.09 * s; g.add(scr);
  const uv = scr.geometry.attributes.uv, p = scr.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / (W * 0.92) + 0.5, p.getY(i) / (H * 0.95) + 0.5);
  g.userData.screen = scrMat; return g;
}
function setScreen(ph, tex) { if (tex && ph.userData.screen.map !== tex) { ph.userData.screen.map = tex; ph.userData.screen.color.set(0xffffff); ph.userData.screen.needsUpdate = true; } }
function carMesh(color) {
  const g = new T.Group();
  const b = new T.Mesh(new T.BoxGeometry(1.9, 0.7, 4.5), mat(color, { metalness: 0.7, roughness: 0.3 })); b.position.y = 0.65; b.castShadow = true; g.add(b);
  const c = new T.Mesh(new T.BoxGeometry(1.65, 0.62, 2.3), mat(0x0a1016, { metalness: 0.9, roughness: 0.12 })); c.position.set(0, 1.3, -0.2); g.add(c);
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) { const w = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.28, 16), mat(0x111111)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); }
  return g;
}
function person(color = 0xe8eef2) {
  const g = new T.Group(), m = mat(color, { roughness: 0.6, metalness: 0.05 });
  const body = new T.Mesh(new T.CapsuleGeometry(0.28, 0.9, 4, 10), m); body.position.y = 1.0; body.castShadow = true; g.add(body);
  const head = new T.Mesh(new T.SphereGeometry(0.22, 16, 12), mat(0xf0c8a8, { roughness: 0.7, metalness: 0 })); head.position.y = 1.85; g.add(head);
  return g;
}
function turbine(h = 60) {
  const g = new T.Group(), white = mat(0xe9eef2, { roughness: 0.4, metalness: 0.2 });
  const tower = new T.Mesh(new T.CylinderGeometry(0.9, 1.6, h, 12), white); tower.position.y = h / 2; g.add(tower);
  const nac = new T.Mesh(new T.BoxGeometry(h * 0.037, h * 0.033, h * 0.085), white); nac.position.set(0, h + 1, 0.8); g.add(nac);
  const rotor = new T.Group(); rotor.position.set(0, h + 1, 3.4); g.add(rotor);
  const bl0 = h * 0.43; for (let i = 0; i < 3; i++) { const bl = new T.Mesh(new T.BoxGeometry(h * 0.017, bl0, h * 0.005), white); bl.position.y = bl0 / 2; const piv = new T.Group(); piv.rotation.z = (i / 3) * Math.PI * 2; piv.add(bl); rotor.add(piv); }
  const lamp = points([0, h + 2.4, 0.8], C.red, 6, { fog: true }); g.add(lamp);
  g.userData = { rotor, lamp }; return g;
}
function droneMesh() {
  const g = new T.Group(); g.add(new T.Mesh(new T.BoxGeometry(1.6, 0.45, 1.6), mat(0x1c2630, { metalness: 0.6 })));
  const props = [];
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { const arm = new T.Mesh(new T.BoxGeometry(0.14, 0.12, 2.0), mat(0x33404a)); arm.position.set(x / 2, 0, z / 2); arm.rotation.y = Math.atan2(x, z); g.add(arm); const pr = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.04, 20), new T.MeshBasicMaterial({ color: 0xbfe8f4, transparent: true, opacity: 0.28 })); pr.position.set(x, 0.32, z); g.add(pr); props.push(pr); }
  g.add(points([0, -0.35, 0], C.green, 5)); return g;
}
function mastMesh(h = 28) {
  const g = new T.Group(), m = mat(0x8a98a4, { metalness: 0.75, roughness: 0.35 });
  const t = new T.Mesh(new T.CylinderGeometry(0.25, 0.7, h, 6), m); t.position.y = h / 2; g.add(t);
  for (let i = 0; i < 3; i++) { const p = new T.Mesh(new T.BoxGeometry(0.5, 2.4, 0.2), mat(0xdfe6ea)); const a = (i / 3) * Math.PI * 2; p.position.set(Math.cos(a) * 0.8, h - 2, Math.sin(a) * 0.8); p.rotation.y = -a; g.add(p); }
  return g;
}
function ringMesh(color, r = 1, w = 0.04) { const m = new T.Mesh(new T.RingGeometry(r * (1 - w), r, 96), glow(color, { side: T.DoubleSide, opacity: 0 })); m.rotation.x = -Math.PI / 2; return m; }
// Trazo luminoso que se dibuja a lo largo de una curva (drawRange)
function trail(curve, color, size = 1.6, N = 300) { const p = points(curve.getSpacedPoints(N).flatMap((v) => [v.x, v.y, v.z]), color, size); p.geometry.setDrawRange(0, 0); p.userData.N = N + 1; return p; }
const draw = (tr, u) => tr.geometry.setDrawRange(0, Math.floor(clamp(u) * tr.userData.N));
function terrain(size, seg, hf, colorFn) {
  const geo = new T.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position, col = new Float32Array(P.count * 3), c = new T.Color();
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), h = hf(x, z); P.setY(i, h); colorFn(c, x, z, h, i); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02, flatShading: true })); m.receiveShadow = true; return m;
}
const land = (c, h, g) => { const k = clamp((h + 4) / 30); c.setRGB(mix(0.07, 0.24, k) * g, mix(0.15, 0.2, k) * g, mix(0.05, 0.13, k) * g); };
function houses(scene, cx, cz, n, R, spread, y = (x, z) => 0) {
  const g = new T.Group(), list = [];
  for (let i = 0; i < n; i++) { const x = cx + (R() - 0.5) * spread, z = cz + (R() - 0.5) * spread, h = 2.4 + R() * 3, w = 2.5 + R() * 2;
    const b = new T.Mesh(new T.BoxGeometry(w, h, w * 0.8), mat(0xc9bca5, { roughness: 0.85, metalness: 0, emissive: 0xffc27a, emissiveIntensity: 0.03 })); b.position.set(x, y(x, z) + h / 2, z); b.rotation.y = R() * 3; b.castShadow = true; g.add(b);
    const roof = new T.Mesh(new T.ConeGeometry(w * 0.75, 1.4, 4), mat(0x9a4a35, { roughness: 0.8 })); roof.position.set(x, y(x, z) + h + 0.7, z); roof.rotation.y = Math.PI / 4 + b.rotation.y; g.add(roof); list.push([x, y(x, z) + h + 1.6, z]); }
  scene.add(g); return list;
}
function dayScene(scene, sky = 0x6f8fa8, fogD = 0.0042, sun = 1.6) {
  scene.background = new T.Color(sky); scene.fog = new T.FogExp2(sky, fogD); scene.environment = ENV;
  scene.add(new T.HemisphereLight(0xdfeeff, 0x3a4a3a, 1.2));
  const d = new T.DirectionalLight(0xfff3df, sun); d.position.set(-60, 90, 40); d.castShadow = true; d.shadow.mapSize.set(1024, 1024);
  Object.assign(d.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, far: 400 }); scene.add(d); return d;
}

// ───────── Valle: crecida que baja desde la cabecera (v02 suceso · v20 aviso)
function valley(v) {
  const W = once('valley', () => {
    const scene = new T.Scene(); dayScene(scene, 0x4f6272, 0.0015, 1.1);
    const path = new T.CatmullRomCurve3([[-150, 26, -40], [-110, 17, -10], [-70, 10, -24], [-30, 6, 6], [10, 3, -8], [55, 1.2, 14], [110, 0.4, 4]].map((p) => new T.Vector3(...p)));
    const P = path.getSpacedPoints(200), near = (x, z) => P.reduce((b, p) => Math.min(b, Math.hypot(p.x - x, p.z - z)), 1e9);
    const hf = (x, z) => { const up = clamp((-x + 40) / 190); const base = up * 30 + 6 * Math.sin(z * 0.04 + x * 0.02) + 4 * Math.sin(x * 0.09) * Math.cos(z * 0.07); const d = near(x, z); return base * clamp((d - 6) / 34) + up * 26 * clamp((d - 6) / 34) - clamp(1 - d / 10) * 2.5; };
    scene.add(terrain(340, 150, hf, (c, x, z, h, i) => land(c, h, 0.85 + 0.25 * hash(i, 1))));
    const town = houses(scene, 70, 0, 26, rng(4), 34, hf);
    const N = 400, pts = path.getSpacedPoints(N), pos = [], idx = [];
    pts.forEach((p, i) => { const t = path.getTangentAt(i / N), n = new T.Vector3(-t.z, 0, t.x).normalize(), w = mix(4, 18, i / N), y = Math.max(hf(p.x + n.x * w, p.z + n.z * w), hf(p.x, p.z), hf(p.x - n.x * w, p.z - n.z * w)) + 1.2; pos.push(p.x + n.x * w, y, p.z + n.z * w, p.x - n.x * w, y, p.z - n.z * w); if (i) { const a = i * 2; idx.push(a - 2, a - 1, a, a - 1, a + 1, a); } });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const water = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x8a6a40, emissive: 0x3a2a14, emissiveIntensity: 0.6, roughness: 0.12, metalness: 0.5, side: T.DoubleSide })); scene.add(water);
    const flood = new T.Mesh(new T.CircleGeometry(30, 48), new T.MeshStandardMaterial({ color: 0x8a6a40, emissive: 0x3a2a14, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.55, transparent: true, opacity: 0.85 })); flood.rotation.x = -Math.PI / 2; flood.position.set(70, 1.6, 2); scene.add(flood);
    const cloud = new T.Group(); for (let i = 0; i < 14; i++) { const s = new T.Mesh(new T.SphereGeometry(14 + hash(i, 2) * 10, 16, 12), new T.MeshStandardMaterial({ color: 0x3b4450, roughness: 1, transparent: true, opacity: 0.85 })); s.position.set(-150 + hash(i, 3) * 110, 70 + hash(i, 4) * 10, -50 + hash(i, 5) * 80); cloud.add(s); } scene.add(cloud);
    const NR = 2400, rp = new Float32Array(NR * 6), seed = Array.from({ length: NR }, (_, i) => [-160 + hash(i, 6) * 120, hash(i, 7) * 70, -60 + hash(i, 8) * 100, 50 + hash(i, 9) * 20]);
    const rain = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(rp, 3)), new T.LineBasicMaterial({ color: 0xb8c8d6, transparent: true, opacity: 0.45 })); rain.frustumCulled = false; scene.add(rain);
    const gauge = new T.Group(); const pole = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 10, 8), mat(0xdfe6ea)); pole.position.y = 5; gauge.add(pole); const gl = points([0, 10.5, 0], C.ice, 10); gauge.add(gl); const gp = path.getPointAt(0.28); gauge.position.set(gp.x + 8, gp.y, gp.z + 6); scene.add(gauge);
    const warn = new T.CatmullRomCurve3([new T.Vector3(gp.x + 8, gp.y + 11, gp.z + 6), new T.Vector3(-20, 60, 0), new T.Vector3(70, 18, 0)]);
    const warnTrail = trail(warn, C.ice, 2.4); scene.add(warnTrail);
    const phones = points(town.flat(), C.amber, 6); scene.add(phones);
    const lu = label('UPSTREAM · EXTREME RAIN', '#f2f4f4', 34); lu.position.set(-120, 58, -10); scene.add(lu);
    const lt = label('TOWN · BARELY RAINING', '#fbbf24', 34); lt.position.set(70, 26, 0); scene.add(lt);
    return { scene, camera: cam(40), water, flood, rain, rp, seed, gauge: gl, warnTrail, phones, n: town.length, lu, lt, idxCount: idx.length };
  });
  const warnMode = v.mode === 'warn';
  return { scene: W.scene, camera: W.camera, exposure: 0.95, bloom: [0.7, 0.5, 0.75], update(lt, d, cue) {
    for (let i = 0; i < W.seed.length; i++) { const s = W.seed[i], y = 70 - ((s[1] + lt * s[3]) % 70), o = i * 6; W.rp[o] = s[0] + y * 0.15; W.rp[o + 1] = y; W.rp[o + 2] = s[2]; W.rp[o + 3] = s[0] + (y - 3) * 0.15; W.rp[o + 4] = y - 3; W.rp[o + 5] = s[2]; }
    W.rain.geometry.attributes.position.needsUpdate = true;
    const arrive = warnMode ? d + 1 : cue(3) + 2.5, front = warnMode ? smooth(0, d, lt) * 0.82 : smooth(cue(1), arrive, lt);
    W.water.geometry.setDrawRange(0, Math.floor(front * W.idxCount / 6) * 6);
    const fl = smooth(arrive - 1, arrive + 4, lt); W.flood.scale.setScalar(0.05 + fl); W.flood.visible = fl > 0.001;
    const alertAt = warnMode ? cue(2) + 0.6 : cue(4) + 0.4;
    const k = smooth(alertAt, alertAt + 0.4, lt); tint(W.phones, k * (0.7 + 0.3 * Math.sin(lt * 8)), new T.Color(warnMode ? C.green : C.amber));
    tint(W.gauge, warnMode ? (lt > cue(1) ? 0.6 + 0.4 * Math.sin(lt * 6) : 0.25) : 0); draw(W.warnTrail, warnMode ? smooth(cue(1) + 0.5, cue(2) + 0.6, lt) : 0);
    W.lu.material.opacity = warnMode ? 0 : smooth(cue(1), cue(1) + 0.8, lt) * (1 - smooth(cue(3), cue(3) + 0.6, lt)); W.lt.material.opacity = warnMode ? 0 : smooth(cue(2), cue(2) + 0.8, lt) * (1 - smooth(cue(4), cue(4) + 0.6, lt));
    if (warnMode) fly(W.camera, [{ p: [-150, 70, 120], l: [-80, 10, -10] }, { p: [-40, 60, 130], l: [10, 6, 0] }, { p: [130, 40, 90], l: [60, 4, 0] }], lt / d);
    else fly(W.camera, [{ p: [-200, 80, 60], l: [-110, 30, -20] }, { p: [-90, 50, 110], l: [-30, 8, 0] }, { p: [20, 30, 90], l: [60, 4, 0] }, { p: [120, 20, 50], l: [70, 3, 0] }], lt / d);
  } };
}

// ───────── Móvil 3D con pantallas reales (v06)
function phone(v, TEX) {
  const W = once('phone', () => {
    const scene = new T.Scene(); studio(scene);
    const ph = phoneMesh(null, 1.6); ph.position.set(0, 7.2, 0); scene.add(ph);
    const ph2 = phoneMesh(null, 1.3); ph2.position.set(9.5, 5.6, -4); ph2.rotation.y = -0.5; scene.add(ph2);
    const NB = 300, bp = new Float32Array(NB * 3); const bytes = points(bp, C.ice, 0.35); scene.add(bytes);
    const cube = new T.Mesh(new T.BoxGeometry(2.4, 2.4, 2.4), mat(0x10202a, { emissive: C.coral, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.2 })); cube.position.set(-7.5, 8, 2); scene.add(cube);
    const shield = new T.Mesh(new T.TorusGeometry(2.6, 0.08, 8, 64), glow(C.green, { opacity: 0 })); shield.position.copy(cube.position); scene.add(shield);
    const lb = label('≈ 300 BYTES · END-TO-END ENCRYPTED', '#f2f4f4', 13); lb.position.set(-7.5, 12, 2); scene.add(lb);
    return { scene, camera: cam(34), ph, ph2, bytes, bp, NB, cube, shield, lb };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.55, 0.5, 0.82], update(lt, d, cue) {
    setScreen(W.ph, TEX[lt < cue(2) - 0.3 ? v.screens[1] : v.screens[0]]); setScreen(W.ph2, TEX[v.screens[0]]);
    const intro = ease(lt / 1.6); W.ph.rotation.set(0.05, mix(-0.9, 0, intro) + Math.sin(lt * 0.4) * 0.12, 0); W.ph.position.y = 7.2 + Math.sin(lt * 0.8) * 0.15;
    const m = smooth(cue(3) - 0.3, cue(3) + 2.2, lt), seal = smooth(cue(3) + 1.6, cue(4), lt);
    for (let i = 0; i < W.NB; i++) { const a = hash(i, 1) * 6.28, r = 3 * hash(i, 2), u = clamp(m * 1.3 - hash(i, 3) * 0.3); W.bp[i * 3] = mix(W.ph.position.x + Math.cos(a) * r * 0.5, W.cube.position.x + Math.cos(a + lt) * 1.2 * (1 - seal), u); W.bp[i * 3 + 1] = mix(W.ph.position.y + (hash(i, 4) - 0.5) * 9, W.cube.position.y + Math.sin(a * 2 + lt) * 1.2 * (1 - seal), u); W.bp[i * 3 + 2] = mix(0.5, W.cube.position.z, u); }
    W.bytes.geometry.attributes.position.needsUpdate = true; tint(W.bytes, m > 0 && m < 1 ? 1 : m >= 1 ? 1 - seal : 0);
    W.cube.scale.setScalar(Math.max(0.001, seal)); W.cube.rotation.set(lt * 0.4, lt * 0.6, 0); W.shield.material.opacity = smooth(cue(4), cue(4) + 0.6, lt) * 0.9; W.shield.rotation.set(Math.PI / 2, 0, lt);
    W.lb.material.opacity = smooth(cue(3) + 1, cue(3) + 2, lt);
    const p2 = smooth(cue(5) - 0.4, cue(5) + 1, lt); W.ph2.position.x = mix(30, 9.5, p2); W.ph2.visible = p2 > 0.01;
    fly(W.camera, [{ p: [4, 9, 26], l: [0, 7, 0] }, { p: [-4, 10, 24], l: [-3, 7.5, 0] }, { p: [3, 9, 30], l: [2, 7, 0] }], lt / d);
  } };
}

// ───────── Dos móviles: sonido, punto de acceso y LoRa (v10)
function twophones(v, TEX) {
  const W = once('two', () => {
    const scene = new T.Scene(); studio(scene, 0x10202e, 0x152a3c);
    const a = phoneMesh(null, 1.2), b = phoneMesh(null, 1.2); a.position.set(-6, 0.45, 0); b.position.set(6, 0.45, 0); a.rotation.set(-Math.PI / 2, 0, 0.25); b.rotation.set(-Math.PI / 2, 0, -0.25); scene.add(a, b);
    const waves = Array.from({ length: 6 }, () => { const r = new T.Mesh(new T.TorusGeometry(1, 0.05, 6, 48, Math.PI * 0.7), glow(C.ice, { opacity: 0 })); r.rotation.set(0, Math.PI / 2, 0); scene.add(r); return r; });
    const wifi = Array.from({ length: 4 }, () => { const r = ringMesh(C.green, 1, 0.03); scene.add(r); return r; });
    const n1 = new T.Group(), n2 = new T.Group(); for (const n of [n1, n2]) { const box = new T.Mesh(new T.BoxGeometry(2.4, 1, 1.6), mat(0x2b3a46)); box.position.y = 0.5; n.add(box); const ant = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 4, 6), mat(0x111)); ant.position.set(0.8, 2.5, 0); n.add(ant); n.add(points([0.8, 4.6, 0], C.coral, 0.5)); scene.add(n); }
    n1.position.set(-11, 0, 6); n2.position.set(11, 0, 6);
    const arc = new T.CatmullRomCurve3([new T.Vector3(-10.2, 4.6, 6), new T.Vector3(0, 14, 6), new T.Vector3(11.8, 4.6, 6)]); const at = trail(arc, C.coral, 1.2); scene.add(at);
    const lb = label('LoRa · 868 MHz · KILOMETRES', '#ff7756', 12); lb.position.set(0, 16, 6); scene.add(lb);
    return { scene, camera: cam(36), a, b, waves, wifi, n1, n2, at, lb };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.6, 0.5, 0.8], update(lt, d, cue) {
    setScreen(W.a, TEX[v.screens[0]]); setScreen(W.b, TEX[lt < cue(3) ? v.screens[1] : v.screens[0]]);
    W.waves.forEach((r, i) => { const ph = ((lt - cue(1)) * 0.8 + i / 6) % 1, on = lt > cue(1) && lt < cue(3) + 0.3; r.position.set(mix(-4.5, 4.5, ph), 1.2, 0); r.scale.setScalar(0.6 + ph * 1.8); r.material.opacity = on ? Math.sin(ph * Math.PI) * 0.9 : 0; });
    W.wifi.forEach((r, i) => { const ph = ((lt - cue(3)) * 0.5 + i / 4) % 1, on = lt > cue(3) && lt < cue(4); r.position.set(-6, 0.6, 0); r.scale.setScalar(1 + ph * 14); r.material.opacity = on ? (1 - ph) * 0.7 : 0; });
    const lo = smooth(cue(4) - 0.3, cue(4) + 0.8, lt); W.n1.scale.setScalar(Math.max(0.001, lo)); W.n2.scale.setScalar(Math.max(0.001, lo)); draw(W.at, smooth(cue(4) + 0.4, cue(4) + 2.4, lt)); W.lb.material.opacity = smooth(cue(4) + 1, cue(4) + 2, lt);
    fly(W.camera, [{ p: [0, 14, 20], l: [0, 0, 0] }, { p: [-8, 9, 18], l: [0, 1, 0] }, { p: [0, 16, 30], l: [0, 4, 3] }], lt / d);
  } };
}

// ───────── Reserva de red (v11)
function reserve(v, TEX) {
  const W = once('reserve', () => {
    const scene = new T.Scene(); studio(scene, 0x0f1e2c, 0x13283a);
    const ph = phoneMesh(null, 1.5); ph.position.set(-5, 6.8, 0); ph.rotation.y = 0.3; scene.add(ph);
    const glass = new T.Mesh(new T.CylinderGeometry(3, 3, 12, 48, 1, true), new T.MeshStandardMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, side: T.DoubleSide })); glass.position.set(6, 6.5, 0); scene.add(glass);
    const segs = [['MAPS', 0x91d7e8, 2.6], ['SHELTERS', 0x34d399, 1.4], ['PLAN', 0xfbbf24, 1.0], ['ORBITS', 0xb39bff, 1.2], ['DOCUMENTS', 0xff7756, 1.6], ['FIRST AID', 0xff5b6e, 1.2]];
    let y = 0.6; const blocks = segs.map(([n, c, h]) => { const m = new T.Mesh(new T.CylinderGeometry(2.8, 2.8, h - 0.1, 48), mat(c, { emissive: c, emissiveIntensity: 0.35, roughness: 0.3 })); const y0 = y + h / 2; y += h; m.position.set(6, y0, 0); scene.add(m); const lb = label(n, '#' + new T.Color(c).getHexString(), 7); lb.position.set(11.5, y0, 0); scene.add(lb); return { m, lb, y0 }; });
    const cap = label('1 GB RESERVE', '#f2f4f4', 12); cap.position.set(6, 14, 0); scene.add(cap);
    const env = Array.from({ length: 5 }, (_, i) => { const e = new T.Mesh(new T.BoxGeometry(1.2, 0.8, 0.12), mat(0x10202a, { emissive: C.coral, emissiveIntensity: 1.2 })); e.position.set(-11, 3 + i * 1.1, 0); scene.add(e); return e; });
    const win = ringMesh(C.green, 1, 0.05); win.position.set(-5, 0.3, 0); scene.add(win);
    return { scene, camera: cam(36), ph, blocks, cap, env, win };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.55, 0.5, 0.8], update(lt, d, cue) {
    setScreen(W.ph, TEX[v.screens[0]]); W.ph.position.y = 6.8 + Math.sin(lt) * 0.12;
    W.blocks.forEach((b, i) => { const u = smooth(cue(1) + i * 0.55, cue(1) + i * 0.55 + 0.8, lt); b.m.position.y = mix(b.y0 + 14, b.y0, ease(u)); b.m.visible = u > 0; b.lb.material.opacity = u; });
    W.cap.material.opacity = smooth(cue(0), cue(0) + 1, lt);
    const q = smooth(cue(4), cue(4) + 0.6, lt), go = smooth(cue(4) + 2.2, cue(4) + 3.6, lt);
    W.env.forEach((e, i) => { e.visible = q > 0; e.scale.setScalar(Math.max(0.001, q)); e.position.x = mix(-11, -40, clamp(go * 1.4 - i * 0.08)); e.position.y = 3 + i * 1.1 + go * 6; });
    const w = (lt - cue(4) - 2) % 1.2; W.win.scale.setScalar(1 + clamp(w / 1.2) * 9); W.win.material.opacity = lt > cue(4) + 2 && lt < cue(5) + 1 ? (1 - clamp(w / 1.2)) * 0.45 : 0;
    fly(W.camera, [{ p: [2, 10, 30], l: [1, 6.5, 0] }, { p: [10, 9, 26], l: [3, 6.5, 0] }, { p: [-6, 10, 28], l: [0, 6, 0] }], lt / d);
  } };
}

// ───────── Lluvia frente a longitud de onda (v12)
function rainphys() {
  const W = once('rainphys', () => {
    const scene = new T.Scene(); scene.background = new T.Color(0x16283a); scene.fog = new T.FogExp2(0x16283a, 0.012); scene.environment = ENV;
    scene.add(new T.HemisphereLight(0xdfeeff, 0x223040, 1.3)); const d = new T.DirectionalLight(0xffffff, 1.4); d.position.set(10, 20, 15); scene.add(d);
    const ND = 380, dpos = [], seed = []; for (let i = 0; i < ND; i++) { seed.push([(hash(i, 1) - 0.5) * 90, hash(i, 2) * 40, (hash(i, 3) - 0.5) * 30, 18 + hash(i, 4) * 8]); }
    const drop = new T.InstancedMesh(new T.SphereGeometry(0.16, 10, 8), new T.MeshStandardMaterial({ color: 0x9fc4e0, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.55, envMapIntensity: 0.5 }), ND); drop.frustumCulled = false; scene.add(drop);
    const mkWave = (lambda, color, y) => { const N = 900, g = new T.BufferGeometry(), p = new Float32Array(N * 3); g.setAttribute('position', new T.BufferAttribute(p, 3)); const l = new T.Line(g, new T.LineBasicMaterial({ color, transparent: true, opacity: 0 })); l.frustumCulled = false; scene.add(l); const pts = points(new Float32Array(N * 3), color, 0.5); scene.add(pts); return { l, p, pts, lambda, y, N }; };
    const long = mkWave(14, C.ice, 9), short = mkWave(0.9, C.coral, -2);
    const l1 = label('868 MHz · λ ≈ 35 cm', '#91d7e8', 16); l1.position.set(-30, 17, 0); scene.add(l1);
    const l2 = label('28 GHz · λ ≈ 1 cm', '#ff7756', 16); l2.position.set(-30, 5, 0); scene.add(l2);
    const l3 = label('≈ 0 dB/km', '#34d399', 12); l3.position.set(36, 16, 0); scene.add(l3);
    const l4 = label('≈ 7 dB/km', '#ff5b6e', 12); l4.position.set(36, 4, 0); scene.add(l4);
    const spark = points(new Float32Array(400 * 3), 0xffd2c4, 0.6); scene.add(spark);
    return { scene, camera: cam(40), drop, seed, ND, long, short, l1, l2, l3, l4, spark, m4: new T.Matrix4() };
  });
  const setWave = (w, lt, on, decay, amp) => { for (let i = 0; i < w.N; i++) { const x = -45 + (i / (w.N - 1)) * 90, u = (x + 45) / 90, vis = u <= on, a = amp * (decay ? Math.exp(-u * 3.2) : 1); w.p[i * 3] = x; w.p[i * 3 + 1] = w.y + (vis ? a * Math.sin((x / w.lambda) * 6.283 - lt * 4) : 0); w.p[i * 3 + 2] = 0; } w.l.geometry.attributes.position.needsUpdate = true; w.l.material.opacity = on > 0 ? 1 : 0; w.pts.geometry.attributes.position.array.set(w.p); w.pts.geometry.attributes.position.needsUpdate = true; w.pts.geometry.setDrawRange(0, Math.floor(on * w.N)); };
  return { scene: W.scene, camera: W.camera, exposure: 1.1, bloom: [0.55, 0.45, 0.8], update(lt, d, cue) {
    for (let i = 0; i < W.ND; i++) { const s = W.seed[i], y = 34 - ((s[1] + lt * s[3]) % 44); W.m4.makeScale(1, 2.2, 1); W.m4.setPosition(s[0], y - 8, s[2]); W.drop.setMatrixAt(i, W.m4); }
    W.drop.instanceMatrix.needsUpdate = true;
    const on1 = smooth(cue(2) - 0.3, cue(2) + 2.5, lt), on2 = smooth(cue(4) - 0.3, cue(4) + 2.5, lt);
    setWave(W.long, lt, on1, false, 3.2); setWave(W.short, lt, on2, true, 2.2);
    W.l1.material.opacity = smooth(cue(2), cue(2) + 0.7, lt); W.l2.material.opacity = smooth(cue(4), cue(4) + 0.7, lt);
    W.l3.material.opacity = smooth(cue(3), cue(3) + 0.7, lt); W.l4.material.opacity = smooth(cue(5), cue(5) + 0.7, lt);
    const sp = W.spark.geometry.attributes.position.array; for (let i = 0; i < 400; i++) { const x = -45 + on2 * 90 * hash(i, 5); sp[i * 3] = x; sp[i * 3 + 1] = -2 + (hash(i, 6) - 0.5) * 6 + Math.sin(lt * 3 + i) * 1.5; sp[i * 3 + 2] = (hash(i, 7) - 0.5) * 8; }
    W.spark.geometry.attributes.position.needsUpdate = true; tint(W.spark, on2 > 0 ? 0.4 + 0.3 * Math.sin(lt * 9) : 0);
    fly(W.camera, [{ p: [-20, 12, 60], l: [0, 4, 0] }, { p: [0, 10, 52], l: [0, 4, 0] }, { p: [22, 9, 56], l: [6, 4, 0] }], lt / d);
  } };
}

// ───────── Difracción sobre una cresta (v13)
function ridge() {
  const W = once('ridge', () => {
    const scene = new T.Scene(); dayScene(scene, 0x7d97ad, 0.0026, 1.3);
    const hf = (x, z) => 34 * Math.exp(-((x / 26) ** 2)) * (0.85 + 0.15 * Math.cos(z * 0.05)) + 3 * Math.sin(x * 0.07 + z * 0.05) + 2 * Math.sin(z * 0.11);
    scene.add(terrain(360, 140, hf, (c, x, z, h, i) => land(c, h * 0.9, 0.9 + 0.2 * hash(i, 1))));
    const A = mastMesh(30), B = mastMesh(30); A.position.set(-130, hf(-130, 0), 0); B.position.set(130, hf(130, 0), 0); scene.add(A, B);
    const pa = new T.Vector3(-130, hf(-130, 0) + 29, 0), pb = new T.Vector3(130, hf(130, 0) + 29, 0);
    const los = new T.Line(new T.BufferGeometry().setFromPoints([pa, pb]), new T.LineDashedMaterial({ color: 0xffffff, dashSize: 3, gapSize: 2, transparent: true, opacity: 0 })); los.computeLineDistances(); scene.add(los);
    const fres = new T.Mesh(new T.SphereGeometry(1, 48, 24), glow(C.ice, { opacity: 0, side: T.DoubleSide })); fres.scale.set(130, 9, 9); fres.position.copy(pa).add(pb).multiplyScalar(0.5); scene.add(fres);
    const arc = (color) => { const pts = []; for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI; pts.push(Math.cos(a), Math.sin(a), 0); } return points(pts, color, 1.6); };
    const rings = Array.from({ length: 7 }, () => { const r = arc(C.ice); r.position.copy(pa); scene.add(r); return r; });
    const top = new T.Vector3(0, hf(0, 0) + 1, 0);
    const rings2 = Array.from({ length: 7 }, () => { const r = arc(C.coral); r.position.copy(top); r.rotation.z = -Math.PI * 0.15; scene.add(r); return r; });
    const relay = mastMesh(14); relay.position.copy(top).setY(top.y - 1); scene.add(relay);
    const l1 = trail(new T.LineCurve3(pa, top.clone().setY(top.y + 13)), C.green, 2), l2 = trail(new T.LineCurve3(top.clone().setY(top.y + 13), pb), C.green, 2); scene.add(l1, l2);
    const lb = label('≈ 22 dB · KNIFE-EDGE DIFFRACTION', '#ff7756', 50); lb.position.set(0, top.y + 30, 0); scene.add(lb);
    return { scene, camera: cam(40), los, fres, rings, rings2, relay, l1, l2, lb, top };
  });
  return { scene: W.scene, camera: W.camera, exposure: 0.95, bloom: [0.7, 0.5, 0.7], update(lt, d, cue) {
    W.rings.forEach((r, i) => { const ph = ((lt * 0.35) + i / 7) % 1; r.scale.setScalar(4 + ph * 125); tint(r, (1 - ph) * 0.9); });
    W.rings2.forEach((r, i) => { const ph = ((lt * 0.35) + i / 7) % 1, on = smooth(cue(0) + 2, cue(1), lt); r.scale.setScalar(2 + ph * 120); tint(r, (1 - ph) * 0.9 * on); });
    W.los.material.opacity = smooth(cue(2), cue(2) + 0.6, lt); W.fres.material.opacity = smooth(cue(2) + 0.6, cue(2) + 1.4, lt) * 0.08;
    W.lb.material.opacity = smooth(cue(3), cue(3) + 0.6, lt);
    const rl = smooth(cue(4), cue(4) + 0.8, lt); W.relay.scale.set(1, Math.max(0.001, rl), 1); draw(W.l1, smooth(cue(4) + 0.6, cue(4) + 1.6, lt)); draw(W.l2, smooth(cue(4) + 1.2, cue(4) + 2.2, lt));
    fly(W.camera, [{ p: [-60, 40, 190], l: [0, 20, 0] }, { p: [40, 60, 200], l: [0, 22, 0] }, { p: [60, 70, 150], l: [0, 24, 0] }], lt / d);
  } };
}

// ───────── Europa: Arnhem → San Martín (v09) y red/fuentes (v24)
function europeWorld() {
  return once('europe', () => {
    const scene = new T.Scene(); scene.background = new T.Color(0x0e1c2b); scene.fog = new T.FogExp2(0x0e1c2b, 0.0028); scene.environment = ENV;
    scene.add(new T.HemisphereLight(0xcfe6ff, 0x16222e, 1.2));
    const toXZ = (lon, lat) => [(lon - 1) * 8.6, -(lat - 46) * 11];
    const rings = (window.LAND?.rings || []), inside = (lon, lat) => { for (const r of rings) { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) if ((r[i + 1] > lat) !== (r[j + 1] > lat) && lon < ((r[j] - r[i]) * (lat - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) c = !c; if (c) return true; } return false; };
    const lp = []; for (let lat = 34; lat <= 60; lat += 0.33) for (let lon = -12; lon <= 22; lon += 0.42) if (inside(lon, lat)) { const [x, z] = toXZ(lon, lat); lp.push(x, 0, z); }
    const landPts = points(lp, 0x6fd0e4, 2.6); scene.add(landPts);
    const sea = new T.Mesh(new T.PlaneGeometry(900, 900), mat(0x0c2236, { roughness: 0.35, metalness: 0.5 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; scene.add(sea);
    const P = (lon, lat, y = 0) => { const [x, z] = toXZ(lon, lat); return new T.Vector3(x, y, z); };
    const arnhem = P(5.9, 51.98), sanm = P(-4.4, 40.36), server = P(8.7, 50.1, 0), sat = P(-3, 43, 70), neighbour = P(-4.1, 40.5);
    const pin = (p, color, txt) => { const g = new T.Group(); const m = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 8, 12), glow(color, { opacity: 0.9 })); m.position.y = 4; g.add(m); g.add(points([0, 8.5, 0], color, 10)); g.position.copy(p); scene.add(g); const l = label(txt, '#' + new T.Color(color).getHexString(), 26); l.position.copy(p).add(new T.Vector3(0, 14, 0)); scene.add(l); return { g, l }; };
    const pA = pin(arnhem, C.ice, 'ARNHEM'), pB = pin(sanm, C.amber, 'SAN MARTÍN'), mast = new T.Group(); mast.add(mastMesh(10)); mast.position.copy(sanm).add(new T.Vector3(6, 0, -4)); scene.add(mast);
    const x = label('✕ MAST DOWN', '#ff5b6e', 22); x.position.copy(mast.position).add(new T.Vector3(0, 16, 0)); scene.add(x);
    const satM = new T.Group(); const sb = new T.Mesh(new T.BoxGeometry(3, 2, 2), mat(0xc9d2d8, { metalness: 0.8 })); satM.add(sb); for (const s of [-1, 1]) { const p = new T.Mesh(new T.BoxGeometry(6, 0.15, 2.4), mat(0x14345e, { emissive: 0x0c2a55, emissiveIntensity: 1.2 })); p.position.x = s * 4.6; satM.add(p); } satM.position.copy(sat); scene.add(satM);
    const wa = trail(new T.CatmullRomCurve3([arnhem.clone().setY(8), server.clone().setY(30), sanm.clone().add(new T.Vector3(6, 12, -4))]), 0x9aa6ae, 2);
    const s1 = trail(new T.CatmullRomCurve3([arnhem.clone().setY(8), P(3, 49, 60), sat]), C.green, 2.2);
    const s2 = trail(new T.CatmullRomCurve3([sat, P(-3.6, 41.5, 35), neighbour.clone().setY(6)]), C.green, 2.2);
    const s3 = trail(new T.CatmullRomCurve3([neighbour.clone().setY(6), sanm.clone().add(new T.Vector3(-2, 3, 2)), sanm.clone().setY(8)]), C.ice, 2.6);
    scene.add(wa, s1, s2, s3);
    // malla de nodos para v24
    const R = rng(12), nodes = []; for (let i = 0; i < 520; i++) { const lon = -9 + R() * 26, lat = 37 + R() * 18; if (!inside(lon, lat)) continue; const p = P(lon, lat, 1); nodes.push(p); }
    const np = points(nodes.flatMap((p) => [p.x, p.y, p.z]), C.coral, 3); np.geometry.setDrawRange(0, 0); scene.add(np);
    const seg = []; nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b, j) => { if (a.distanceTo(b) < 26) seg.push(a.x, a.y, a.z, b.x, b.y, b.z); }));
    const links = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(seg, 3)), new T.LineBasicMaterial({ color: C.ice, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); scene.add(links);
    const srcs = [['USGS', -40, 60], ['GDACS', 40, 70], ['COPERNICUS', 120, 80], ['MET NORWAY', 60, 120], ['DGT · DATEX II', -60, 90], ['NDW · DATEX II', 80, 40]].map(([n, x, y], i) => { const at = new T.Vector3(x, y, -120 + i * 30); const l = label(n, '#fbbf24', 26); l.position.copy(at); scene.add(l); const tgt = nodes[(i * 61) % nodes.length]; const tr = trail(new T.LineCurve3(at, tgt), C.amber, 1.4, 120); scene.add(tr); return { l, tr }; });
    return { scene, camera: cam(40), pA, pB, mast, x, satM, wa, s1, s2, s3, np, nN: nodes.length, links, srcs };
  });
}
function europe() {
  const W = europeWorld();
  return { scene: W.scene, camera: W.camera, bloom: [0.85, 0.55, 0.55], update(lt, d, cue) {
    W.np.geometry.setDrawRange(0, 0); W.links.material.opacity = 0; W.srcs.forEach((s) => { s.l.material.opacity = 0; draw(s.tr, 0); });
    for (const o of [W.pA.g, W.pB.g, W.mast, W.satM]) o.visible = true; W.pA.l.material.opacity = W.pB.l.material.opacity = smooth(0.5, 1.5, lt);
    W.x.material.opacity = smooth(cue(1) - 1, cue(1), lt) * (0.6 + 0.4 * Math.sin(lt * 5));
    draw(W.wa, smooth(cue(2), cue(2) + 2.2, lt));
    draw(W.s1, smooth(cue(3), cue(3) + 1.6, lt)); draw(W.s2, smooth(cue(3) + 1.2, cue(4) + 0.4, lt)); draw(W.s3, smooth(cue(4), cue(4) + 1.2, lt));
    W.satM.position.x = -26 + Math.sin(lt * 0.2) * 3; W.satM.rotation.y = lt * 0.3;
    fly(W.camera, [{ p: [30, 150, 130], l: [0, 0, 20] }, { p: [-20, 110, 170], l: [-15, 0, 50] }, { p: [-70, 70, 160], l: [-35, 10, 70] }], lt / d);
  } };
}
function network() {
  const W = europeWorld();
  return { scene: W.scene, camera: W.camera, bloom: [0.9, 0.6, 0.5], update(lt, d, cue) {
    for (const o of [W.pA.g, W.pB.g, W.mast, W.satM]) o.visible = false; W.pA.l.material.opacity = W.pB.l.material.opacity = W.x.material.opacity = 0; for (const t of [W.wa, W.s1, W.s2, W.s3]) draw(t, 0);
    const grow = smooth(0, cue(2), lt); W.np.geometry.setDrawRange(0, Math.floor(mix(0.08, 1, grow) * W.nN)); W.links.material.opacity = 0.05 + 0.4 * smooth(cue(1), cue(2), lt);
    tint(W.np, 0.8 + 0.2 * Math.sin(lt * 3), new T.Color(lt > cue(2) ? C.green : C.coral));
    W.srcs.forEach((s, i) => { const t0 = cue(4) + i * 0.6; s.l.material.opacity = smooth(t0, t0 + 0.6, lt) * (1 - smooth(cue(6), cue(6) + 0.6, lt) * (i === 1 ? 0.75 : 0)); draw(s.tr, smooth(t0 + 0.3, t0 + 1.5, lt)); });
    fly(W.camera, [{ p: [0, 260, 140], l: [10, 0, 0] }, { p: [60, 160, 220], l: [10, 0, 20] }, { p: [-40, 180, 250], l: [0, 20, 0] }], lt / d);
  } };
}

// ───────── Previsión del apagón (v15)
function forecast() {
  const W = once('forecast', () => {
    const scene = new T.Scene(); night(scene, 0x0c1622, 0.0026).intensity = 1.6;
    const city = makeCity({ seed: 11 }); scene.add(city.group); city.dist.forEach((d) => d.power(0.08));
    const masts = [[-118, -70, 1.0], [-62, 58, 0.45], [-8, -18, 0.8], [44, 84, 0.3], [86, -52, 0.65], [126, 22, 0.55], [-100, 100, 0.25], [20, -110, 0.9]].map(([x, z, life]) => {
      const m = mastMesh(40); m.position.set(x, 0, z); scene.add(m);
      const disc = new T.Mesh(new T.CircleGeometry(48, 48), glow(C.ice, { opacity: 0.18 })); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.6, z); scene.add(disc);
      const bar = new T.Mesh(new T.BoxGeometry(2.4, 14, 2.4), glow(C.green, { opacity: 0.9 })); bar.position.set(x + 4, 50, z); scene.add(bar);
      return { disc, bar, life, x, z };
    });
    const gws = [[-70, -10], [30, 40], [100, -10], [-30, 100], [60, -90]].map(([x, z]) => { const p = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 70, 12, 1, true), glow(C.green, { opacity: 0, side: T.DoubleSide })); p.position.set(x, 35, z); scene.add(p); const d = new T.Mesh(new T.CircleGeometry(40, 48), glow(C.green, { opacity: 0 })); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.8, z); scene.add(d); return { p, d }; });
    return { scene, camera: cam(40), masts, gws };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.9, 0.6, 0.5], update(lt, d, cue) {
    const clock = smooth(0.5, cue(2), lt);
    W.masts.forEach((m) => { const left = clamp(1 - clock / m.life); m.bar.scale.y = Math.max(0.02, left); m.bar.position.y = 43 + 7 * left; m.bar.material.color.setHex(left > 0.4 ? C.green : left > 0.15 ? C.amber : C.red); m.disc.material.opacity = left > 0 ? 0.08 + 0.12 * left : 0; m.disc.material.color.setHex(left > 0 ? C.ice : C.red); if (left <= 0) m.disc.material.opacity = 0.12; });
    W.gws.forEach((g, i) => { const t0 = cue(2) + i * 0.5; g.p.material.opacity = smooth(t0, t0 + 0.5, lt) * 0.6; g.d.material.opacity = smooth(t0 + 0.3, t0 + 1, lt) * 0.22; });
    fly(W.camera, [{ p: [-230, 210, 230], l: [0, 0, 0] }, { p: [0, 260, 190], l: [0, 0, 0] }, { p: [200, 190, 160], l: [0, 0, 0] }], lt / d);
  } };
}

// ───────── Proteger, avisar, socorrer (v17)
function pas() {
  const W = once('pas', () => {
    const scene = new T.Scene(); night(scene, 0x101c28, 0.007).intensity = 1.8; scene.environment = ENV;
    const asph = new T.Mesh(new T.PlaneGeometry(14, 900), mat(0x2a2e33, { roughness: 0.5, metalness: 0.2 })); asph.rotation.x = -Math.PI / 2; asph.position.z = 200; asph.receiveShadow = true; scene.add(asph);
    const verge = new T.Mesh(new T.PlaneGeometry(600, 900), mat(0x18241a, { roughness: 1, metalness: 0 })); verge.rotation.x = -Math.PI / 2; verge.position.set(0, -0.05, 200); scene.add(verge);
    for (let i = 0; i < 60; i++) { const s = new T.Mesh(new T.BoxGeometry(0.15, 0.02, 3), new T.MeshBasicMaterial({ color: 0xcfd6da })); s.position.set(0, 0.02, -100 + i * 10); scene.add(s); }
    const lamp = new T.SpotLight(0xffe2b8, 40, 70, 0.7, 0.7, 1.6); lamp.position.set(9, 14, 20); lamp.target.position.set(2, 0, 20); lamp.castShadow = true; scene.add(lamp, lamp.target);
    const crash = carMesh(0x8a3a40); crash.position.set(5.6, 0, 26); crash.rotation.set(0, 0.6, 0.06); scene.add(crash);
    const helper = carMesh(0xb4c0c8); helper.position.set(5.2, 0, 8); scene.add(helper);
    const haz = points([4.4, 0.85, 23.6, 6.6, 0.85, 24.6, 4.3, 0.85, 5.8, 6.1, 0.85, 5.8], 0xffa020, 2.6, { fog: true }); scene.add(haz);
    const pp = person(0x2f6fb0); pp.position.set(3.5, 0, 9); scene.add(pp);
    const tri = new T.Mesh(new T.ConeGeometry(0.7, 1.1, 3), new T.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 0.8 })); tri.position.set(3.2, 0.55, -30); scene.add(tri);
    const pk = new T.Group(); const post = new T.Mesh(new T.BoxGeometry(0.5, 2.6, 0.2), mat(0xf2f4f4)); post.position.y = 1.3; pk.add(post); pk.position.set(8.5, 0, 30); scene.add(pk);
    const pkL = label('PK 42.3 · A-6 · DIRECTION A CORUÑA', '#f2f4f4', 22, 'location in 112 terms · demo'); pkL.position.set(8.5, 7, 30); scene.add(pkL);
    const tur = [[-80, 0, 160], [-40, 0, 220], [60, 0, 250]].map(([x, y, z]) => { const t = turbine(48); t.position.set(x, y, z); scene.add(t); return t; });
    const sig = Array.from({ length: 4 }, () => { const r = ringMesh(C.ice, 1, 0.05); scene.add(r); return r; });
    const gc = carMesh(0xe9eef2); gc.position.set(-3, 0, -120); scene.add(gc);
    const stripe = new T.Mesh(new T.BoxGeometry(1.92, 0.25, 4.52), new T.MeshBasicMaterial({ color: 0x0d6b3a })); stripe.position.y = 0.75; gc.add(stripe);
    const blue = points([-0.4, 1.75, 0, 0.4, 1.75, 0], 0x3d7bff, 4, { fog: true }); gc.add(blue);
    const steps = ['1 · PROTECT', '2 · ALERT', '3 · HELP'].map((s, i) => { const l = label(s, ['#fbbf24', '#91d7e8', '#34d399'][i], 18); l.position.set(-10, 9 - i * 2.6, 22); scene.add(l); return l; });
    return { scene, camera: cam(42), haz, pp, tri, pkL, tur, sig, gc, blue, steps };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.85, 0.6, 0.55], update(lt, d, cue) {
    const blink = Math.sin(lt * 7) > 0 ? 1 : 0.15; tint(W.haz, blink);
    const walk = smooth(cue(1), cue(1) + 3.5, lt); W.pp.position.z = mix(9, -26, walk); W.pp.position.x = mix(3.5, 2.6, walk); W.pp.rotation.y = walk < 1 ? Math.PI : 0;
    W.tri.visible = walk > 0.95; if (lt > cue(2)) { const back = smooth(cue(2), cue(2) + 2.5, lt); W.pp.position.z = mix(-26, 22, back); W.pp.rotation.y = 0; }
    W.sig.forEach((r, i) => { const ph = ((lt - cue(2)) * 0.6 + i / 4) % 1, on = lt > cue(2) && lt < cue(4); r.position.set(W.pp.position.x, 2.2, W.pp.position.z); r.scale.setScalar(1 + ph * 30); r.material.opacity = on ? (1 - ph) * 0.6 : 0; });
    W.pkL.material.opacity = smooth(cue(2) + 0.5, cue(2) + 1.3, lt) * (1 - smooth(cue(4), cue(4) + 0.8, lt));
    W.tur.forEach((t) => { t.userData.rotor.rotation.z = lt * 0.5; tint(t.userData.lamp, Math.sin(lt * 2) > 0 ? 1 : 0.2); });
    W.steps.forEach((s, i) => { s.material.opacity = smooth([cue(1), cue(2), cue(4)][i], [cue(1), cue(2), cue(4)][i] + 0.6, lt); });
    const arrive = smooth(cue(5) - 0.5, cue(5) + 3, lt); W.gc.position.z = mix(-140, 0, ease(arrive)); W.gc.position.x = mix(-3, 5, arrive); tint(W.blue, arrive > 0 ? (Math.sin(lt * 12) > 0 ? 1 : 0.1) : 0);
    fly(W.camera, [{ p: [-16, 6, -6], l: [4, 1.5, 20] }, { p: [-10, 4, -38], l: [3, 1, 0] }, { p: [-14, 9, 4], l: [4, 1, 20] }, { p: [-40, 26, 60], l: [-30, 20, 170] }, { p: [-12, 5, -14], l: [4, 1, 10] }], lt / d);
  } };
}

// ───────── Terremoto: ondas P y S (v19)
function quake() {
  const W = once('quake', () => {
    const scene = new T.Scene(); dayScene(scene, 0x5d7285, 0.0011, 1.3);
    const hf = (x, z) => 8 * Math.sin(x * 0.012) * Math.cos(z * 0.015) + 4 * Math.sin(x * 0.04 + z * 0.03);
    const ter = terrain(800, 160, hf, (c, x, z, h, i) => land(c, h + 6, 0.9 + 0.2 * hash(i, 2))); scene.add(ter);
    const base = Float32Array.from(ter.geometry.attributes.position.array);
    const R = rng(21), towns = [[180, 60, 'TOWN A'], [-160, 150, 'TOWN B'], [60, -220, 'TOWN C']].map(([x, z, n]) => { houses(scene, x, z, 18, R, 40, hf); const l = label(n, '#f2f4f4', 34); l.position.set(x, 30, z); scene.add(l); return { x, z, l, n }; });
    const ep = new T.Vector3(-60, hf(-60, -40), -40);
    const ph = []; for (let i = 0; i < 160; i++) { const x = (R() - 0.5) * 700, z = (R() - 0.5) * 700; ph.push(x, hf(x, z) + 2, z); }
    const phones = points(ph, C.ice, 6); scene.add(phones);
    const P = ringMesh(C.ice, 1, 0.012), S = ringMesh(C.coral, 1, 0.03); P.position.copy(ep).setY(ep.y + 3); S.position.copy(ep).setY(ep.y + 3); scene.add(P, S);
    const star = points([ep.x, ep.y + 4, ep.z], C.red, 40); scene.add(star);
    const tri = []; for (let k = 0; k < 6; k++) { const i = Math.floor(R() * 160); tri.push(trail(new T.LineCurve3(new T.Vector3(ph[i * 3], ph[i * 3 + 1] + 2, ph[i * 3 + 2]), ep.clone().setY(ep.y + 6)), C.amber, 2, 100)); } tri.forEach((t) => scene.add(t));
    return { scene, camera: cam(40), ter, base, towns, ep, ph, phones, P, S, star, tri, hf };
  });
  const VP = 60, VS = 34; // escala visual (unidades/s): P más rápida que S
  return { scene: W.scene, camera: W.camera, exposure: 0.95, bloom: [0.85, 0.6, 0.6], update(lt, d, cue) {
    const t0 = cue(1) - 0.3, te = Math.max(0, lt - t0), rP = te * VP, rS = te * VS;
    W.P.scale.setScalar(Math.max(0.01, rP)); W.P.material.opacity = lt > t0 ? 0.9 : 0; W.S.scale.setScalar(Math.max(0.01, rS)); W.S.material.opacity = lt > t0 ? 0.9 : 0;
    tint(W.star, lt > t0 ? 0.6 + 0.4 * Math.sin(lt * 10) : 0);
    const a = W.phones.geometry.attributes.color;
    for (let i = 0; i < a.count; i++) { const dd = Math.hypot(W.ph[i * 3] - W.ep.x, W.ph[i * 3 + 2] - W.ep.z), hitP = rP > dd, hitS = rS > dd; const k = hitS ? 1 : hitP ? 0.9 : 0.35; a.array[i * 3] = hitS ? 1 * k : 0.57 * k; a.array[i * 3 + 1] = hitS ? 0.47 * k : 0.84 * k; a.array[i * 3 + 2] = hitS ? 0.34 * k : 0.91 * k; }
    a.needsUpdate = true;
    // sacudida del terreno al paso de la onda S
    const p = W.ter.geometry.attributes.position; for (let i = 0; i < p.count; i += 1) { const x = W.base[i * 3], z = W.base[i * 3 + 2], dd = Math.hypot(x - W.ep.x, z - W.ep.z), ph = rS - dd; p.array[i * 3 + 1] = W.base[i * 3 + 1] + (ph > -10 && ph < 30 ? Math.sin(ph * 0.5) * 2.4 * Math.exp(-Math.abs(ph - 6) / 12) : 0); }
    p.needsUpdate = true;
    W.tri.forEach((t, k) => draw(t, smooth(cue(3) + k * 0.2, cue(3) + 1 + k * 0.2, lt)));
    W.towns.forEach((tw) => { const dd = Math.hypot(tw.x - W.ep.x, tw.z - W.ep.z), secs = Math.max(0, Math.ceil((dd - rS) / VS * 4)); tw.l.material.opacity = smooth(cue(4) - 0.5, cue(4) + 0.3, lt); });
    fly(W.camera, [{ p: [-300, 190, 300], l: [0, 0, 0] }, { p: [-120, 240, 330], l: [-40, 0, 0] }, { p: [220, 220, 290], l: [0, 0, -20] }], lt / d);
  } };
}

// ───────── Zona y orden firmada (v23)
function zone() {
  const W = once('zone', () => {
    const scene = new T.Scene(); night(scene, 0x0e1a26, 0.0026).intensity = 1.8;
    const city = makeCity({ seed: 31, half: 150, hmax: 34 }); scene.add(city.group); city.dist.forEach((d) => d.power(0.45));
    const hq = new T.Mesh(new T.BoxGeometry(18, 40, 18), mat(0x1b2a38, { emissive: C.ice, emissiveIntensity: 0.25 })); hq.position.set(-120, 20, -110); scene.add(hq);
    const hqL = label('AGENCY · TRUST ANCHOR', '#91d7e8', 48); hqL.position.set(-120, 54, -110); scene.add(hqL);
    const coord = new T.Group(); const van = carMesh(0xe9eef2); van.scale.setScalar(2.4); coord.add(van); coord.add(points([0, 5, 0], C.coral, 14)); coord.position.set(-30, 0, 40); scene.add(coord);
    const cL = label('COORDINATOR · SIGNED CREDENTIAL', '#ff7756', 44); cL.position.set(-30, 20, 40); scene.add(cL);
    const cred = trail(new T.CatmullRomCurve3([new T.Vector3(-120, 42, -110), new T.Vector3(-80, 70, -40), new T.Vector3(-30, 8, 40)]), C.ice, 2.4); scene.add(cred);
    const poly = [[-10, -20], [90, -40], [120, 40], [60, 90], [-10, 70]].map(([x, z]) => new T.Vector3(x, 1.2, z)); const zc = new T.CatmullRomCurve3(poly, true, 'catmullrom', 0.0);
    const zoneT = trail(zc, C.amber, 3, 500); scene.add(zoneT);
    const wall = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 64, 1, true), glow(C.amber, { opacity: 0, side: T.DoubleSide })); wall.position.set(55, 6, 25); wall.scale.set(70, 12, 60); scene.add(wall);
    const wave = ringMesh(C.coral, 1, 0.06); wave.position.set(55, 2, 25); scene.add(wave);
    const R = rng(7), ph = [], st = []; for (let i = 0; i < 260; i++) { const x = -10 + R() * 130, z = -40 + R() * 130; ph.push(x, 2 + R() * 22, z); const r = R(); st.push(r < 0.7 ? 0 : r < 0.9 ? 1 : 2); }
    const phones = points(ph, C.ice, 6); scene.add(phones);
    return { scene, camera: cam(40), hqL, coord, cL, cred, zoneT, wall, wave, phones, st };
  });
  const COL = [new T.Color(C.green), new T.Color(C.amber), new T.Color(C.red)];
  return { scene: W.scene, camera: W.camera, bloom: [0.9, 0.6, 0.5], update(lt, d, cue) {
    W.hqL.material.opacity = smooth(0.4, 1.4, lt); draw(W.cred, smooth(cue(1) - 0.4, cue(1) + 1.2, lt)); W.cL.material.opacity = smooth(cue(1) + 0.8, cue(1) + 1.6, lt) * (1 - smooth(cue(4), cue(4) + 0.6, lt));
    draw(W.zoneT, smooth(cue(2), cue(2) + 1.8, lt)); W.wall.material.opacity = smooth(cue(2) + 1.2, cue(2) + 2, lt) * 0.12;
    const wv = smooth(cue(3) - 0.2, cue(3) + 2.4, lt); W.wave.scale.setScalar(1 + wv * 85); W.wave.material.opacity = wv > 0 && wv < 1 ? (1 - wv) * 0.9 : 0;
    const a = W.phones.geometry.attributes.color, ans = smooth(cue(5), cue(5) + 2.5, lt);
    for (let i = 0; i < a.count; i++) { const on = hash(i, 9) < ans, c = on ? COL[W.st[i]] : null, k = 0.7 + 0.3 * Math.sin(lt * 5 + i); a.array[i * 3] = c ? c.r : 0.57 * (wv > 0.5 ? 1 : 0.5); a.array[i * 3 + 1] = c ? c.g : 0.84 * (wv > 0.5 ? 1 : 0.5); a.array[i * 3 + 2] = c ? c.b * k : 0.91 * (wv > 0.5 ? 1 : 0.5); }
    a.needsUpdate = true;
    fly(W.camera, [{ p: [-220, 160, 120], l: [-60, 0, -20] }, { p: [-60, 200, 220], l: [30, 0, 20] }, { p: [160, 150, 200], l: [55, 0, 25] }], lt / d);
  } };
}

// ───────── Integraciones (v25)
function integrate() {
  const W = once('integrate', () => {
    const scene = new T.Scene(); studio(scene, 0x0f1d2b, 0x142739);
    const core = new T.Mesh(new T.IcosahedronGeometry(3, 1), mat(0x10202a, { emissive: C.coral, emissiveIntensity: 0.55, flatShading: true, metalness: 0.5, roughness: 0.25 })); core.scale.setScalar(0.7); core.position.y = 9; scene.add(core);
    const coreL = label('SENDA CORE', '#ff7756', 12); coreL.position.set(0, 14, 0); scene.add(coreL);
    const items = [];
    const add = (obj, name, proto, a, r = 17, y = 5) => { obj.position.set(Math.cos(a) * r, y, Math.sin(a) * r); scene.add(obj); const l = label(name, '#f2f4f4', 10, proto); l.position.set(Math.cos(a) * r, y + 7, Math.sin(a) * r); scene.add(l); const tr = trail(new T.LineCurve3(new T.Vector3(0, 9, 0), obj.position.clone().setY(y + 2)), C.ice, 0.9, 80); scene.add(tr); items.push({ obj, l, tr }); };
    const ph = phoneMesh(null, 0.6); add(ph, 'PHONE', 'web + Android', 0, 17, 6);
    const lap = new T.Group(); const base = new T.Mesh(new T.BoxGeometry(5, 0.3, 3.4), mat(0x9aa6ae, { metalness: 0.8 })); lap.add(base); const scr = new T.Mesh(new T.BoxGeometry(5, 3.2, 0.15), mat(0x1b232c, { emissive: 0x23455a, emissiveIntensity: 0.6 })); scr.position.set(0, 1.6, -1.7); lap.add(scr); add(lap, 'COMPUTER', 'same core', 0.9, 17, 2);
    const rack = new T.Mesh(new T.BoxGeometry(3, 6, 2.4), mat(0x2b3a46, { emissive: C.green, emissiveIntensity: 0.15 })); add(rack, 'AGENCY SERVER', 'self-hosted relay · CAP', 1.8, 17, 3);
    const dr = droneMesh(); add(dr, 'DRONE', 'MAVLink', 2.7, 17, 9);
    const car = carMesh(0xe9eef2); car.scale.setScalar(1.2); add(car, 'EMERGENCY VEHICLE', 'OBD-II with consent', 3.6, 17, 0);
    const tb = turbine(12); tb.scale.setScalar(0.55); add(tb, 'WIND FARM', 'by agreement', 4.5, 19, 0);
    const sign = new T.Group(); const pole = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 7, 8), mat(0x9aa6ae)); pole.position.y = 3.5; sign.add(pole); const pnl = new T.Mesh(new T.BoxGeometry(5, 2, 0.3), mat(0x0a1016, { emissive: C.amber, emissiveIntensity: 0.4 })); pnl.position.y = 7; sign.add(pnl); add(sign, 'TRAFFIC DATA', 'DATEX II', 5.4, 17, 0);
    return { scene, camera: cam(38), core, coreL, items };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.6, 0.5, 0.8], update(lt, d, cue) {
    W.core.rotation.set(lt * 0.3, lt * 0.5, 0); W.coreL.material.opacity = smooth(0, 1, lt);
    W.items.forEach((it, i) => { const t0 = 0.6 + i * 0.6; const u = smooth(t0, t0 + 0.6, lt); it.obj.scale.setScalar(Math.max(0.001, u) * (it.obj.userData.s0 ??= it.obj.scale.x)); it.l.material.opacity = u; draw(it.tr, smooth(cue(2) + i * 0.25, cue(2) + i * 0.25 + 0.8, lt)); if (it.obj.userData.rotor) it.obj.userData.rotor.rotation.z = lt; });
    const ang = lt * 0.12; W.camera.position.set(Math.sin(ang) * 40, 20, Math.cos(ang) * 40); W.camera.lookAt(0, 6, 0);
  } };
}

// ───────── Módulos de pocos euros (v26)
function modules() {
  const W = once('modules', () => {
    const scene = new T.Scene(); studio(scene, 0x0c1824, 0x0f1d2b); scene.fog = new T.Fog(0x0c1824, 40, 140);
    const pcb = (w, d, col) => { const g = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(w, 0.16, d), mat(col, { roughness: 0.5 })); b.castShadow = true; g.add(b); for (let i = 0; i < 5; i++) { const c = new T.Mesh(new T.BoxGeometry(0.4 + hash(i, w) * 0.8, 0.25, 0.4 + hash(i, d) * 0.6), mat(0x111418, { metalness: 0.4 })); c.position.set((hash(i, 3) - 0.5) * w * 0.7, 0.2, (hash(i, 4) - 0.5) * d * 0.7); g.add(c); } return g; };
    const esp = pcb(5.2, 2.6, 0x1a4d2e); esp.position.set(-12, 1, 4); scene.add(esp);
    const lora = new T.Group(); const lb = new T.Mesh(new T.BoxGeometry(3.4, 1.4, 2.2), mat(0x2b3a46)); lb.position.y = 0.7; lora.add(lb); const ant = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 6, 8), mat(0x111)); ant.position.set(1, 4, 0); lora.add(ant); lora.position.set(-5, 0.1, 6); scene.add(lora);
    const radar = pcb(3, 3, 0x1f3a6b); radar.position.set(4, 2.2, 0); radar.rotation.x = -0.3; scene.add(radar);
    const cone = new T.Mesh(new T.ConeGeometry(8, 26, 32, 1, true), glow(C.ice, { opacity: 0.04, side: T.DoubleSide })); cone.rotation.x = Math.PI / 2; cone.position.set(4, 3, -13); scene.add(cone);
    const walker = person(0x6b7c8a); walker.position.set(10, 0, -28); scene.add(walker);
    const blip = points([0, 0, 0], C.coral, 4); scene.add(blip);
    const smoke = points(Array.from({ length: 500 }, (_, i) => [(hash(i, 1) - 0.5) * 40, hash(i, 2) * 6, -20 - hash(i, 3) * 25]).flat(), 0x9aa6ae, 1.1, { fog: true }); scene.add(smoke);
    const seis = pcb(2.4, 2.4, 0x5a2a6b); seis.position.set(14, 1, 8); scene.add(seis);
    const solar = new T.Group(); const panel = new T.Mesh(new T.BoxGeometry(5, 0.2, 3.4), mat(0x14345e, { metalness: 0.7, roughness: 0.2, emissive: 0x0c2a55, emissiveIntensity: 0.4 })); panel.position.y = 3; panel.rotation.x = -0.5; solar.add(panel); const pole = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 3, 8), mat(0x9aa6ae)); pole.position.y = 1.5; solar.add(pole); solar.position.set(22, 0, 2); scene.add(solar);
    const L = (txt, sub, p) => { const l = label(txt, '#f2f4f4', 8.5, sub); l.position.set(...p); scene.add(l); return l; };
    const labels = [L('ESP32 SCANNER', 'firmware built in CI', [-12, 5, 4]), L('LoRa NODE', '≈ 30–40 €', [-5, 9, 6]), L('24 GHz RADAR', 'design · ≈ 12 €', [4, 7, 0]), L('MICRO-SEISMOGRAPH', 'design · ≈ 5 €', [14, 5, 8]), L('SOLAR LoRa REPEATER', 'design · ≈ 18 €', [22, 7.5, 2])];
    return { scene, camera: cam(38), esp, lora, radar, cone, walker, blip, smoke, seis, solar, labels };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.7, 0.5, 0.75], update(lt, d, cue) {
    const show = [cue(0), cue(0) + 1.2, cue(2), cue(4), cue(4) + 1.2];
    [W.esp, W.lora, W.radar, W.seis, W.solar].forEach((o, i) => { const u = smooth(show[i], show[i] + 0.7, lt); o.visible = u > 0.01; o.scale.setScalar(Math.max(0.001, u)); W.labels[i].material.opacity = u; });
    const rd = smooth(cue(2) + 0.5, cue(2) + 1.2, lt); W.cone.material.opacity = rd * (0.03 + 0.02 * Math.sin(lt * 4)); W.walker.visible = rd > 0;
    W.walker.position.x = 10 - ((lt * 2) % 20); W.walker.position.z = -28 + Math.sin(lt * 0.5) * 4; W.walker.rotation.y = -Math.PI / 2;
    W.blip.position.copy(W.walker.position).setY(2); tint(W.blip, rd * (Math.sin(lt * 6) > 0 ? 1 : 0.3)); tint(W.smoke, rd * 0.22);
    fly(W.camera, [{ p: [-19, 10, 25], l: [-7, 2, 2] }, { p: [3, 11, 27], l: [5, 2, -8] }, { p: [24, 10, 26], l: [15, 2, 2] }], lt / d);
  } };
}

export const BUILD2 = { valley, phone, twophones, reserve, rainphys, ridge, europe, network, forecast, pas, quake, zone, integrate, modules };

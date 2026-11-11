// Escenas 3D de la película de inversores. Cada constructor devuelve
// { scene, camera, update(lt, dur, cue), bloom?: [fuerza, radio, umbral] }.
// lt = segundos desde el inicio de la escena; cue(k) = segundo local en que empieza la frase k.
// Son visualizaciones ilustrativas: las cifras que aparecen en pantalla salen del guion verificado.
import { T, clamp, mix, smooth, ease, rng, hash, points, setPoint, tint, label, makeCity, night, cam, fly } from './lib.js';

const C = { coral: 0xff7756, ice: 0x91d7e8, green: 0x34d399, amber: 0xfbbf24, red: 0xff3b4e };
const cache = {};
const once = (k, f) => (cache[k] ??= f());

// ───────────────────────── Ciudad (apagón · hueco · malla) ─────────────────────────
function cityWorld() {
  return once('city', () => {
    const scene = new T.Scene(); night(scene, 0x050b12, 0.0030).intensity = 1.5;
    const city = makeCity({ seed: 11 }); scene.add(city.group);
    const R = rng(5), ph = [];
    city.streets.slice(0, 520).forEach(([x, z]) => ph.push(x, 0.9, z));
    const phones = points(ph, C.ice, 4.6); scene.add(phones);
    // antenas con baliza
    const masts = [[-118, -70], [-62, 58], [-8, -18], [44, 84], [86, -52], [126, 22]].map(([x, z], i) => {
      const m = new T.Mesh(new T.CylinderGeometry(0.35, 0.7, 62, 6), new T.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.6 }));
      m.position.set(x, 31, z); scene.add(m);
      const ring = new T.Mesh(new T.RingGeometry(0.96, 1, 64), new T.MeshBasicMaterial({ color: C.ice, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 1.2, z); scene.add(ring);
      return { x, z, ring, i };
    });
    const beacons = points(masts.flatMap((m) => [m.x, 63.5, m.z]), C.red, 13); scene.add(beacons);
    // enlaces entre teléfonos vecinos y ruta de un paquete
    const P = []; for (let i = 0; i < ph.length; i += 3) P.push([ph[i], ph[i + 2]]);
    const seg = [];
    P.forEach((a, i) => { const near = P.map((b, j) => [Math.hypot(a[0] - b[0], a[1] - b[1]), j]).filter(([d, j]) => j !== i && d < 34).sort((x, y) => x[0] - y[0]).slice(0, 2); near.forEach(([, j]) => seg.push(a[0], 0.9, a[1], P[j][0], 0.9, P[j][1])); });
    const links = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(seg, 3)), new T.LineBasicMaterial({ color: C.ice, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    scene.add(links);
    const path = []; let cur = P.reduce((b, p) => (p[0] + p[1] < b[0] + b[1] ? p : b)); path.push(cur);
    for (let k = 0; k < 40; k++) { const nx = P.filter((p) => p[0] + p[1] > cur[0] + cur[1] + 6 && Math.hypot(p[0] - cur[0], p[1] - cur[1]) < 46).sort((a, b) => Math.abs(a[0] - a[1]) + Math.hypot(a[0] - cur[0], a[1] - cur[1]) * 0.6 - (Math.abs(b[0] - b[1]) + Math.hypot(b[0] - cur[0], b[1] - cur[1]) * 0.6))[0]; if (!nx) break; path.push(nx); cur = nx; }
    const curve = new T.CatmullRomCurve3(path.map(([x, z], i) => new T.Vector3(x, 1.2 + (i % 2) * 0.6, z)), false, 'catmullrom', 0.15);
    const N = 600, pts = curve.getSpacedPoints(N), flat = pts.flatMap((p) => [p.x, p.y, p.z]);
    const trail = points(flat, C.coral, 2.6), receipt = points(flat.slice().reverse(), C.green, 3.0);
    trail.geometry.setDrawRange(0, 0); receipt.geometry.setDrawRange(0, 0); scene.add(trail, receipt);
    const packet = points([0, 0, 0], 0xffffff, 26); scene.add(packet);
    const hops = points(path.flatMap(([x, z]) => [x, 1.4, z]), C.coral, 9); scene.add(hops);
    return { scene, camera: cam(40), city, phones, masts, beacons, links, trail, receipt, packet, hops, curve, N, nPh: ph.length / 3, nHops: path.length };
  });
}
function cityReset(W, { power = 1, phones = 1, links = 0 }) {
  W.city.dist.forEach((d) => d.power(power)); tint(W.phones, phones); W.links.material.opacity = links;
  W.trail.geometry.setDrawRange(0, 0); W.receipt.geometry.setDrawRange(0, 0); W.packet.visible = false; W.hops.visible = false;
  W.masts.forEach((m) => { m.ring.material.opacity = 0; }); tint(W.beacons, 0);
}

function blackout() {
  const W = cityWorld();
  return { scene: W.scene, camera: W.camera, bloom: [1.05, 0.7, 0.62], update(lt, d, cue) {
    cityReset(W, {});
    fly(W.camera, [{ p: [-250, 150, 240], l: [0, 10, 0] }, { p: [-60, 96, 210], l: [10, 14, 0] }, { p: [120, 54, 150], l: [0, 22, -10] }], lt / d);
    const t0 = cue(0) + 2.6, t1 = cue(2) - 0.4, n = W.city.dist.length;
    W.city.dist.forEach((dd, i) => { const at = mix(t0, t1, i / (n - 1)), fl = lt > at - 0.35 && lt < at ? 0.45 + 0.55 * hash(Math.floor(lt * 25), i) : 1; dd.power(lt < at ? fl : mix(0.035, 0.0, 0)); });
    // antenas: siguen vivas con batería y van cayendo
    const m0 = cue(2) + 1.0, m1 = cue(3) + 0.8; let alive = 0;
    W.masts.forEach((m, i) => { const die = mix(m0, m1, i / (W.masts.length - 1)), on = lt < die; if (on) alive++;
      const blink = on ? 0.45 + 0.55 * (Math.sin(lt * 5 + i * 1.7) > 0 ? 1 : 0.15) : 0; setPoint(W.beacons, i, blink, blink * 0.12, blink * 0.16);
      const ph = (lt * 0.42 + i * 0.37) % 1; m.ring.scale.setScalar(6 + ph * 70); m.ring.material.opacity = on ? (1 - ph) * 0.55 : 0; });
    const k = alive / W.masts.length, a = W.phones.geometry.attributes.color;
    for (let i = 0; i < W.nPh; i++) { const live = hash(i, 9) < 0.4 + 0.5 * k; a.array[i * 3] = live ? 0.57 : 0.5; a.array[i * 3 + 1] = live ? 0.84 : 0.1; a.array[i * 3 + 2] = live ? 0.91 : 0.12; }
    a.needsUpdate = true;
  } };
}
function gap() {
  const W = cityWorld();
  return { scene: W.scene, camera: W.camera, bloom: [1.0, 0.7, 0.6], update(lt, d, cue) {
    cityReset(W, { power: 0.03, phones: 0.5 });
    fly(W.camera, [{ p: [150, 30, 150], l: [0, 16, 0] }, { p: [70, 16, 96], l: [-20, 14, -10] }, { p: [10, 9, 60], l: [-60, 12, -60] }], lt / d);
    const wake = smooth(cue(4), cue(4) + 2.5, lt), a = W.phones.geometry.attributes.color;
    for (let i = 0; i < W.nPh; i++) { const tw = 0.35 + 0.25 * Math.sin(lt * 2 + i), p = wake * (0.6 + 0.9 * Math.max(0, Math.sin(lt * 3.2 - i * 0.37))); a.array[i * 3] = 0.57 * (tw + p); a.array[i * 3 + 1] = 0.84 * (tw + p); a.array[i * 3 + 2] = 0.91 * (tw + p); }
    a.needsUpdate = true;
  } };
}
function mesh() {
  const W = cityWorld(), v = new T.Vector3(), v2 = new T.Vector3();
  return { scene: W.scene, camera: W.camera, bloom: [1.15, 0.75, 0.55], update(lt, d, cue) {
    cityReset(W, { power: 0.04, phones: 0.9, links: 0.7 * smooth(0.3, 2.5, lt) });
    const t1 = cue(3) - 0.3, u = smooth(1.2, t1, lt) * 0.999, back = smooth(cue(3) + 0.4, d - 1.2, lt);
    W.curve.getPointAt(u, v); W.curve.getPointAt(Math.min(0.999, u + 0.06), v2);
    W.packet.visible = lt > 1.0 && back < 0.02; W.packet.position.copy(v); W.hops.visible = true;
    for (let i = 0; i < W.nHops; i++) { const on = i / (W.nHops - 1) <= u + 0.01, er = 1 - i / (W.nHops - 1) <= back; setPoint(W.hops, i, er ? 0.2 : on ? 1 : 0.12, er ? 0.83 : on ? 0.47 : 0.12, er ? 0.6 : on ? 0.34 : 0.14); }
    W.trail.geometry.setDrawRange(0, Math.floor(u * W.N * (1 - back))); W.receipt.geometry.setDrawRange(0, Math.floor(back * W.N));
    const ang = 0.6 + lt * 0.05, r = mix(54, 82, smooth(0, d, lt));
    W.camera.position.set(v.x - Math.cos(ang) * r, mix(26, 46, back), v.z - Math.sin(ang) * r); W.camera.lookAt(v2.x, 3, v2.z);
  } };
}

// ───────────────────────── Inundación ─────────────────────────
function flood() {
  const W = once('flood', () => {
    const scene = new T.Scene(); night(scene, 0x0a1218, 0.011);
    const city = makeCity({ seed: 23, half: 96, block: 17, street: 7, hmin: 5, hmax: 15, districts: 4, warm: 0.9, density: 0.95, ground: 0x15110c }); scene.add(city.group);
    city.dist.forEach((dd) => dd.power(0.55));
    const water = new T.Mesh(new T.PlaneGeometry(700, 700, 1, 1), new T.MeshStandardMaterial({ color: 0x2a2114, roughness: 0.16, metalness: 0.92 })); water.rotation.x = -Math.PI / 2; scene.add(water);
    const R = rng(3), n = 2600, seed = [], pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) seed.push([(R() - 0.5) * 220, R() * 70, (R() - 0.5) * 220, 38 + R() * 26]);
    const rain = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(pos, 3)), new T.LineBasicMaterial({ color: 0x9fb6c8, transparent: true, opacity: 0.32, fog: false })); rain.frustumCulled = false; scene.add(rain);
    const ph = []; city.lots.filter((b, i) => i % 2 === 0).forEach((b) => ph.push(b.x + b.w * 0.5, b.h * (0.3 + R() * 0.6), b.z + b.d * 0.51));
    const phones = points(ph, C.amber, 7); scene.add(phones);
    const flash = new T.PointLight(0xbfd8ff, 0, 0, 0); flash.position.set(40, 120, -60); scene.add(flash);
    return { scene, camera: cam(40), water, rain, seed, pos, phones, flash, nPh: ph.length / 3 };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.9, 0.6, 0.66], update(lt, d, cue) {
    W.water.position.y = mix(0.25, 3.3, smooth(0, d, lt)) + Math.sin(lt * 1.3) * 0.05;
    for (let i = 0; i < W.seed.length; i++) { const s = W.seed[i], y = 70 - ((s[1] + lt * s[3]) % 70), o = i * 6; W.pos[o] = s[0] + y * 0.18; W.pos[o + 1] = y; W.pos[o + 2] = s[2]; W.pos[o + 3] = s[0] + (y - 2.6) * 0.18; W.pos[o + 4] = y - 2.6; W.pos[o + 5] = s[2]; }
    W.rain.geometry.attributes.position.needsUpdate = true;
    const L = [1.6, 1.75, 6.4, 6.52].reduce((a, t) => Math.max(a, 1 - Math.abs(lt - t) / 0.09), 0); W.flash.intensity = Math.max(0, L) * 2.4;
    const al = smooth(cue(1) + 0.9, cue(1) + 1.5, lt), a = W.phones.geometry.attributes.color;
    for (let i = 0; i < W.nPh; i++) { const k = al * (0.75 + 0.5 * Math.sin(lt * 9 + i)); a.array[i * 3] = 0.98 * k; a.array[i * 3 + 1] = 0.75 * k; a.array[i * 3 + 2] = 0.14 * k; }
    a.needsUpdate = true;
    fly(W.camera, [{ p: [-78, 9, 70], l: [-20, 7, 0] }, { p: [-30, 12, 44], l: [20, 7, -20] }, { p: [16, 24, 40], l: [40, 5, -40] }], lt / d);
  } };
}

// ───────────────────────── Ferrocarril ─────────────────────────
function rail() {
  const W = once('rail', () => {
    const scene = new T.Scene(); night(scene, 0x0c141c, 0.0062).intensity = 2.2;
    const g = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshStandardMaterial({ color: 0x1c1f1d, roughness: 0.95 })); g.rotation.x = -Math.PI / 2; scene.add(g);
    const steel = new T.MeshStandardMaterial({ color: 0x8b98a4, roughness: 0.3, metalness: 0.9 });
    for (const x of [-3.6, -2.2, 2.2, 3.6]) { const r = new T.Mesh(new T.BoxGeometry(0.14, 0.2, 700), steel); r.position.set(x, 0.3, 120); scene.add(r); }
    const sl = new T.InstancedMesh(new T.BoxGeometry(2.6, 0.16, 0.34), new T.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.9 }), 1100), m4 = new T.Matrix4();
    for (let i = 0; i < 550; i++) { m4.setPosition(-2.9, 0.12, -220 + i * 1.25); sl.setMatrixAt(i * 2, m4); m4.setPosition(2.9, 0.12, -220 + i * 1.25); sl.setMatrixAt(i * 2 + 1, m4); }
    scene.add(sl);
    const coach = (x, z, ry, rz, lit) => { const c = new T.Group(), body = new T.Mesh(new T.BoxGeometry(2.9, 3.4, 24), new T.MeshStandardMaterial({ color: 0xc9d2d8, roughness: 0.45, metalness: 0.5 })); body.position.y = 2.4; c.add(body);
      const win = new T.Mesh(new T.BoxGeometry(2.96, 0.9, 21), new T.MeshBasicMaterial({ color: lit ? 0xffe2ad : 0x1a1f26, toneMapped: false })); win.position.y = 3.1; c.add(win);
      const stripe = new T.Mesh(new T.BoxGeometry(2.97, 0.28, 24), new T.MeshBasicMaterial({ color: 0x7a1f2a })); stripe.position.y = 1.5; c.add(stripe);
      c.position.set(x, 0.3, z); c.rotation.set(0, ry, rz); scene.add(c); return c; };
    coach(-2.9, -44, 0, 0, true); coach(-2.9, -18, 0.02, 0, true); coach(-1.6, 7.5, 0.16, 0.05, true); coach(0.6, 31, 0.3, 0.2, false);
    coach(2.9, 186, 0, 0, false); coach(3.4, 161, -0.07, -0.08, false); coach(5.6, 137, -0.24, -0.34, false);
    const blue = points([-12, 2.6, -30, -13, 2.6, -8, -11, 2.6, 16, -15, 2.6, -52, -18, 2.4, 2], 0x3d7bff, 15, { fog: true }); scene.add(blue);
    const work = points([-10, 5, -20, -10, 5, 6], 0xffe9c4, 30, { fog: true }); scene.add(work);
    const l1 = label('TRAIN 1', '#f2f4f4', 34, 'emergency services on scene'); l1.position.set(-2, 14, -14); scene.add(l1);
    const l2 = label('TRAIN 2', '#ff7756', 34, 'unknown for ≈ 45 min'); l2.position.set(4, 14, 160); scene.add(l2);
    const mark = points([4, 5, 160], C.coral, 26); scene.add(mark);
    return { scene, camera: cam(42), blue, l1, l2, mark };
  });
  return { scene: W.scene, camera: W.camera, bloom: [0.95, 0.65, 0.6], update(lt, d, cue) {
    if (cache.trainx) { const X = cache.trainx; [X.phones, X.node, X.nodeL, X.capT, X.room, X.roomL, ...X.ups].forEach((o) => { o.visible = false; }); }
    const a = W.blue.geometry.attributes.color; for (let i = 0; i < 5; i++) { const k = Math.sin(lt * 11 + i * 2.1) > 0.2 ? 1 : 0.05; a.array[i * 3] = 0.24 * k; a.array[i * 3 + 1] = 0.48 * k; a.array[i * 3 + 2] = k; } a.needsUpdate = true;
    const tr = smooth(cue(1) - 0.5, cue(2) + 1.6, lt);
    fly(W.camera, [{ p: [-30, 7, -78], l: [-2, 4, -10] }, { p: [-22, 9, -20], l: [0, 4, 40] }, { p: [-13, 6, 70], l: [3, 4, 150] }, { p: [-16, 10, 118], l: [4, 4, 162] }], smooth(0, 1, lt / d * 0.35 + tr * 0.65));
    W.l1.material.opacity = smooth(1.2, 2.2, lt) * (1 - smooth(cue(1) + 1, cue(1) + 2.5, lt));
    const rv = smooth(cue(2), cue(2) + 1.2, lt); W.l2.material.opacity = rv; tint(W.mark, rv * (0.5 + 0.5 * Math.sin(lt * 4)));
  } };
}

// ───────────────────────── Título (partículas → SENDA) ─────────────────────────
function titleWorld() {
  return once('title', () => {
    const scene = new T.Scene(); scene.background = new T.Color(0x03060a); scene.fog = new T.FogExp2(0x03060a, 0.004);
    const c = document.createElement('canvas'); c.width = 900; c.height = 220; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.font = '800 190px "Inter Display", Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    try { g.letterSpacing = '26px'; } catch {}
    g.fillText('SENDA', 463, 118);
    const img = g.getImageData(0, 0, 900, 220).data, target = [], R = rng(41);
    for (let y = 0; y < 220; y += 2) for (let x = 0; x < 900; x += 2) if (img[(y * 900 + x) * 4 + 3] > 128) target.push((x - 450) * 0.16, (110 - y) * 0.16, (R() - 0.5) * 0.5);
    const n = target.length / 3, start = new Float32Array(n * 3), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = R() * 6.283, b = Math.acos(2 * R() - 1), r = 60 + R() * 150; start[i * 3] = r * Math.sin(b) * Math.cos(a); start[i * 3 + 1] = r * Math.cos(b) * 0.6; start[i * 3 + 2] = r * Math.sin(b) * Math.sin(a) - 40; }
    const p = points(pos, 0xffffff, 1.25); scene.add(p);
    const a = p.geometry.attributes.color; for (let i = 0; i < n; i++) { const k = (target[i * 3 + 1] + 17) / 34; a.array[i * 3] = 1; a.array[i * 3 + 1] = mix(0.55, 1, k); a.array[i * 3 + 2] = mix(0.42, 1, k); }
    const dust = points(Array.from({ length: 2400 }, (_, i) => (hash(i, i % 3 + 1) - 0.5) * (i % 3 === 1 ? 160 : 520)), C.ice, 1.3); scene.add(dust);
    return { scene, camera: cam(36), p, n, start, target, dust };
  });
}
function titleUpdate(W, lt, conv, camZ) {
  const a = W.p.geometry.attributes.position.array;
  for (let i = 0; i < W.n; i++) { const k = ease(clamp(conv - hash(i, 2) * 0.35) / 0.65), sw = (1 - k) * 0.8, o = i * 3; a[o] = mix(W.start[o], W.target[o], k) + Math.sin(lt * 1.3 + i) * sw; a[o + 1] = mix(W.start[o + 1], W.target[o + 1], k) + Math.cos(lt * 1.1 + i * 1.7) * sw; a[o + 2] = mix(W.start[o + 2], W.target[o + 2], k); }
  W.p.geometry.attributes.position.needsUpdate = true; W.dust.rotation.y = lt * 0.03;
  W.camera.position.set(Math.sin(lt * 0.22) * 9, 2 + Math.sin(lt * 0.3) * 1.5, camZ); W.camera.lookAt(0, 0, 0);
}
function title() { const W = titleWorld(); return { scene: W.scene, camera: W.camera, bloom: [1.25, 0.8, 0.35], update(lt, d) { titleUpdate(W, lt, smooth(0, 2.6, lt), mix(165, 112, smooth(0, d, lt))); } }; }
function cta() { const W = titleWorld(); return { scene: W.scene, camera: W.camera, bloom: [1.25, 0.8, 0.35], update(lt, d) { titleUpdate(W, lt + 20, 1 + lt, mix(120, 150, smooth(0, d, lt))); W.camera.position.y += 14; W.camera.lookAt(0, -12, 0); } }; }

// ───────────────────────── Fragmentos por varios portadores ─────────────────────────
function bearers() {
  const W = once('bearers', () => {
    const scene = new T.Scene(); night(scene, 0x04080d, 0.0035);
    const grid = new T.GridHelper(600, 60, 0x18303c, 0x0d1c25); scene.add(grid);
    const A = new T.Vector3(-70, 4, 0), B = new T.Vector3(70, 4, 0);
    const node = (p, col, w) => { const m = new T.Mesh(new T.BoxGeometry(w, w * 1.7, w * 0.4), new T.MeshStandardMaterial({ color: 0x0e1820, emissive: col, emissiveIntensity: 0.9, roughness: 0.4 })); m.position.copy(p); scene.add(m); return m; };
    node(A, C.ice, 5); node(B, C.green, 7);
    const sat = new T.Group(), sb = new T.Mesh(new T.BoxGeometry(4, 3, 3), new T.MeshStandardMaterial({ color: 0xb9c4cc, metalness: 0.8, roughness: 0.3, emissive: 0x223344 })); sat.add(sb);
    for (const s of [-1, 1]) { const pn = new T.Mesh(new T.BoxGeometry(9, 0.2, 3.4), new T.MeshStandardMaterial({ color: 0x14345e, emissive: 0x0c2a55, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 })); pn.position.x = s * 7; sat.add(pn); }
    sat.position.set(-4, 66, -30); scene.add(sat);
    const mast = new T.Mesh(new T.CylinderGeometry(0.3, 0.9, 34, 6), new T.MeshStandardMaterial({ color: 0x2a3844 })); mast.position.set(8, 17, 40); scene.add(mast);
    const drone = new T.Group(); drone.add(new T.Mesh(new T.BoxGeometry(3.4, 0.8, 3.4), new T.MeshStandardMaterial({ color: 0x1c2630, emissive: 0x112233 })));
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const r = new T.Mesh(new T.CylinderGeometry(2, 2, 0.08, 20), new T.MeshBasicMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.25 })); r.position.set(x, 0.6, z); drone.add(r); }
    drone.position.set(-6, 28, 6); scene.add(drone);
    const nb = [[-44, -34], [-18, -52], [10, -46], [40, -30]].map(([x, z]) => new T.Vector3(x, 2.5, z)); scene.add(points(nb.flatMap((v) => [v.x, v.y, v.z]), C.ice, 12));
    const routes = [
      { name: 'SATELLITE', col: C.ice, pts: [A, new T.Vector3(-40, 44, -18), sat.position, new T.Vector3(38, 44, -16), B], lp: [-4, 76, -30], lost: [0] },
      { name: 'DRONE', col: C.amber, pts: [A, new T.Vector3(-38, 22, 4), drone.position, new T.Vector3(34, 22, 4), B], lp: [-6, 36, 6], lost: [] },
      { name: 'LoRa', col: C.coral, pts: [A, new T.Vector3(-30, 12, 26), new T.Vector3(8, 35, 40), new T.Vector3(44, 12, 24), B], lp: [8, 42, 40], lost: [1] },
      { name: 'NEIGHBOURS', col: C.green, pts: [A, ...nb, B], lp: [-4, 10, -52], lost: [1] },
    ].map((r, ri) => { const curve = new T.CatmullRomCurve3(r.pts, false, 'catmullrom', 0.4), N = 260, flat = curve.getSpacedPoints(N).flatMap((p) => [p.x, p.y, p.z]);
      const line = points(flat, r.col, 1.5); line.geometry.setDrawRange(0, 0); scene.add(line);
      const lb = label(r.name, '#' + new T.Color(r.col).getHexString(), 44); lb.position.set(...r.lp); scene.add(lb);
      return { ...r, curve, N, line, lb, ri }; });
    const shards = points(new Float32Array(8 * 3), 0xffffff, 13); scene.add(shards);
    const msg = new T.Mesh(new T.BoxGeometry(5, 5, 5), new T.MeshStandardMaterial({ color: 0x10202a, emissive: C.coral, emissiveIntensity: 1.6 })); scene.add(msg);
    const la = label('SOS', '#f2f4f4', 40, 'sender'); la.position.set(-70, 17, 0); scene.add(la);
    const lb = label('112', '#34d399', 40, 'control room'); lb.position.set(70, 24, 0); scene.add(lb);
    return { scene, camera: cam(40), routes, shards, msg, A, B, sat, drone };
  });
  const v = new T.Vector3();
  return { scene: W.scene, camera: W.camera, bloom: [1.1, 0.7, 0.5], update(lt, d, cue) {
    const split = cue(1) - 0.2, arrive = cue(3) + 1.6, u = smooth(split, arrive, lt), done = smooth(arrive, arrive + 1.0, lt);
    W.sat.rotation.y = lt * 0.2; W.drone.position.y = 28 + Math.sin(lt * 1.6) * 0.8;
    W.msg.visible = lt < split || done > 0; W.msg.position.copy(done > 0 ? W.B : W.A).add(v.set(0, 9, 0)); W.msg.rotation.set(lt * 0.5, lt * 0.7, 0);
    W.msg.material.emissive.setHex(done > 0 ? C.green : C.coral); W.msg.scale.setScalar(done > 0 ? 0.4 + 0.6 * done : 1 - smooth(split - 0.5, split, lt) * 0.6);
    const pos = W.shards.geometry.attributes.position.array;
    W.routes.forEach((r) => { r.line.geometry.setDrawRange(0, Math.floor(clamp(u * 1.15) * r.N)); r.lb.material.opacity = smooth(cue(2) + r.ri * 0.45, cue(2) + 0.6 + r.ri * 0.45, lt);
      for (let k = 0; k < 2; k++) { const i = r.ri * 2 + k, lost = r.lost.includes(k), uu = clamp(u * (1 - k * 0.07)), cut = 0.45 + r.ri * 0.07, vis = lt > split && done < 1;
        r.curve.getPointAt(lost ? Math.min(uu, cut) : uu, v); const fall = lost ? smooth(cut, cut + 0.25, uu) : 0;
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y - fall * 9 + (uu >= 0.999 && !lost ? 9 : 0); pos[i * 3 + 2] = v.z;
        const c = new T.Color(r.col), b = vis ? (lost ? 1 - fall * 0.92 : 1) : 0; setPoint(W.shards, i, lost && fall > 0.05 ? b : c.r * b, lost && fall > 0.05 ? 0.1 * b : c.g * b, lost && fall > 0.05 ? 0.14 * b : c.b * b); } });
    W.shards.geometry.attributes.position.needsUpdate = true;
    fly(W.camera, [{ p: [-120, 22, 84], l: [-50, 10, 0] }, { p: [-30, 46, 150], l: [0, 24, 0] }, { p: [70, 36, 128], l: [20, 18, 0] }, { p: [118, 20, 60], l: [60, 10, 0] }], lt / d);
  } };
}

// ───────────────────────── Órbita ─────────────────────────
function orbit() {
  const W = once('orbit', () => {
    const scene = new T.Scene(); scene.background = new T.Color(0x02040a);
    scene.add(new T.HemisphereLight(0x8fb8ff, 0x05070c, 0.5)); const sun = new T.DirectionalLight(0xffffff, 1.3); sun.position.set(-60, 30, 50); scene.add(sun);
    const RAD = 20, ll = (lat, lon, r = RAD) => { const a = lat * Math.PI / 180, b = -lon * Math.PI / 180; return new T.Vector3(r * Math.cos(a) * Math.cos(b), r * Math.sin(a), r * Math.cos(a) * Math.sin(b)); };
    const globe = new T.Group(); scene.add(globe);
    globe.add(new T.Mesh(new T.SphereGeometry(RAD - 0.08, 64, 48), new T.MeshStandardMaterial({ color: 0x061422, roughness: 0.75, metalness: 0.2 })));
    const rings = (window.LAND?.rings || []).map((r) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); } return { r, x0, x1, y0, y1 }; });
    const inside = (lon, lat) => { for (const { r, x0, x1, y0, y1 } of rings) { if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue; let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) if ((r[i + 1] > lat) !== (r[j + 1] > lat) && lon < ((r[j] - r[i]) * (lat - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) c = !c; if (c) return true; } return false; };
    const land = []; for (let lat = -84; lat <= 84; lat += 1.25) { const step = 1.25 / Math.max(0.2, Math.cos(lat * Math.PI / 180)); for (let lon = -180; lon < 180; lon += step) if (inside(lon, lat)) { const p = ll(lat, lon, RAD + 0.05); land.push(p.x, p.y, p.z); } }
    globe.add(points(land, 0x4fb3c9, 0.42));
    const atm = new T.Mesh(new T.SphereGeometry(RAD * 1.09, 48, 32), new T.MeshBasicMaterial({ color: 0x2f7fd0, transparent: true, opacity: 0.06, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })); scene.add(atm);
    const spain = ll(40.2, -3.7, RAD + 0.2); globe.add(points([spain.x, spain.y, spain.z], C.coral, 3.2));
    const pulse = new T.Mesh(new T.RingGeometry(0.9, 1, 48), new T.MeshBasicMaterial({ color: C.coral, transparent: true, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); pulse.position.copy(spain); pulse.lookAt(spain.clone().multiplyScalar(2)); globe.add(pulse);
    // Constelaciones (radios no a escala): LEO 6×11, MEO 3×8, GEO 1
    const shells = [{ r: 24.5, planes: 6, per: 11, inc: 86.4, col: C.ice, sp: 0.5, size: 1.5 }, { r: 34, planes: 3, per: 8, inc: 56, col: C.amber, sp: 0.16, size: 2.0 }];
    const sats = shells.map((s) => { const p = points(new Float32Array(s.planes * s.per * 3), s.col, s.size); scene.add(p);
      for (let k = 0; k < s.planes; k++) { const ring = new T.Mesh(new T.TorusGeometry(s.r, 0.03, 4, 160), new T.MeshBasicMaterial({ color: s.col, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false })); ring.rotation.set(Math.PI / 2 - s.inc * Math.PI / 180, 0, 0); const h = new T.Group(); h.rotation.y = (k / s.planes) * Math.PI * (s.planes === 6 ? 1 : 2); h.add(ring); scene.add(h); }
      return { ...s, p }; });
    const geo = points([0, 0, 0], C.coral, 3.4); globe.add(geo); const gp = ll(0, 25.9, 44); geo.position.copy(gp);
    const gring = new T.Mesh(new T.TorusGeometry(44, 0.03, 4, 200), new T.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false })); gring.rotation.x = Math.PI / 2; scene.add(gring);
    const link = new T.Line(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending })); link.frustumCulled = false; scene.add(link);
    const stars = points(Array.from({ length: 3600 }, (_, i) => (hash(i, 7) - 0.5) * 1400), 0xffffff, 1.6); scene.add(stars);
    globe.rotation.y = -1.52;
    return { scene, camera: cam(34), globe, sats, spain, pulse, link, RAD };
  });
  const v = new T.Vector3(), sp = new T.Vector3(), best = new T.Vector3();
  return { scene: W.scene, camera: W.camera, bloom: [0.95, 0.7, 0.5], update(lt, d) {
    W.globe.rotation.y = -1.52 + lt * 0.012; sp.copy(W.spain).applyEuler(W.globe.rotation); let bd = 1e9;
    W.sats.forEach((s) => { const a = s.p.geometry.attributes.position.array; for (let k = 0; k < s.planes; k++) for (let j = 0; j < s.per; j++) { const th = (j / s.per) * 6.283 + lt * s.sp + k * 0.5, inc = s.inc * Math.PI / 180, raan = (k / s.planes) * Math.PI * (s.planes === 6 ? 1 : 2);
      v.set(s.r * Math.cos(th), s.r * Math.sin(th) * Math.sin(inc), s.r * Math.sin(th) * Math.cos(inc)).applyAxisAngle(T.Object3D.DEFAULT_UP, raan); const o = (k * s.per + j) * 3; a[o] = v.x; a[o + 1] = v.y; a[o + 2] = v.z;
      if (s.r < 30) { const dd = v.distanceTo(sp); if (dd < bd) { bd = dd; best.copy(v); } } } s.p.geometry.attributes.position.needsUpdate = true; });
    const la = W.link.geometry.attributes.position.array; la[0] = sp.x; la[1] = sp.y; la[2] = sp.z; la[3] = best.x; la[4] = best.y; la[5] = best.z; W.link.geometry.attributes.position.needsUpdate = true;
    const ph = (lt * 0.7) % 1; W.pulse.scale.setScalar(0.5 + ph * 3.5); W.pulse.material.opacity = 1 - ph;
    const ang = mix(-0.5, 0.25, smooth(0, d, lt)), r = mix(92, 70, smooth(0, d, lt)); W.camera.position.set(Math.sin(ang) * r + 16, 12, Math.cos(ang) * r); W.camera.lookAt(-10, 3, 0);
  } };
}

// ───────────────────────── Carretera con niebla ─────────────────────────
function road() {
  const W = once('road', () => {
    const scene = new T.Scene(); const FOG = 0x2b353d; scene.background = new T.Color(FOG); scene.fog = new T.FogExp2(FOG, 0.0075);
    scene.add(new T.HemisphereLight(0xb8c6d2, 0x1a1d20, 1.5)); const sun = new T.DirectionalLight(0xdfe8ee, 0.8); sun.position.set(-30, 60, -40); scene.add(sun);
    const asph = new T.Mesh(new T.PlaneGeometry(16, 2400), new T.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.42, metalness: 0.35 })); asph.rotation.x = -Math.PI / 2; asph.position.z = 700; scene.add(asph);
    const verge = new T.Mesh(new T.PlaneGeometry(600, 2400), new T.MeshStandardMaterial({ color: 0x0c110e, roughness: 1 })); verge.rotation.x = -Math.PI / 2; verge.position.set(0, -0.05, 700); scene.add(verge);
    const m4 = new T.Matrix4(), dash = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.02, 4.5), new T.MeshBasicMaterial({ color: 0x7d858a }), 400);
    for (let i = 0; i < 200; i++) { m4.setPosition(-2.6, 0.02, -300 + i * 12); dash.setMatrixAt(i * 2, m4); m4.setPosition(2.6, 0.02, -300 + i * 12); dash.setMatrixAt(i * 2 + 1, m4); } scene.add(dash);
    for (const x of [-7.6, 7.6]) { const e = new T.Mesh(new T.BoxGeometry(0.2, 0.02, 2400), new T.MeshBasicMaterial({ color: 0x7d858a })); e.position.set(x, 0.02, 700); scene.add(e); const gr = new T.Mesh(new T.BoxGeometry(0.12, 0.34, 2400), new T.MeshStandardMaterial({ color: 0x77828b, metalness: 0.9, roughness: 0.35 })); gr.position.set(x * 1.14, 0.75, 700); scene.add(gr); }
    scene.add(points(Array.from({ length: 160 }, (_, i) => [i % 2 ? 8.9 : -8.9, 0.9, -300 + Math.floor(i / 2) * 30]).flat(), 0xff9a3c, 3.2, { fog: true }));
    // Modelo ilustrativo de frenada en cadena (dos pasadas: sin y con aviso simultáneo)
    const N = 9, v0 = 33.3, LEN = 4.6, gaps = [0, 13, 40, 40, 40, 40, 150, 78, 78], lanes = [0, 0, 0, 0, 0, 0, 0, 0, 0], x0 = []; let acc = 0; for (let i = 0; i < N; i++) { acc -= gaps[i] + (i ? LEN : 0); x0.push(acc); }
    const sim = (withSenda) => { const dt = 0.02, steps = 900, t0 = 1.6, hist = [], x = x0.slice(), v = Array(N).fill(v0), bt = Array(N).fill(1e9), hit = Array(N).fill(1e9), rear = new Set(); bt[0] = t0;
      for (let s = 0; s < steps; s++) { const t = s * dt; for (let i = 1; i < N; i++) if (bt[i] > 1e8) { if (withSenda) bt[i] = t0 + 0.3; else if (bt[i - 1] < 1e8 || hit[i - 1] < 1e8) bt[i] = Math.min(bt[i - 1], hit[i - 1]) + 1.2; }
        for (let i = 0; i < N; i++) { if (t >= bt[i]) v[i] = Math.max(0, v[i] - (i === 0 ? 8 : 7.2) * dt); if (hit[i] < 1e8) v[i] = Math.max(0, v[i] - 30 * dt); x[i] += v[i] * dt; }
        for (let i = 1; i < N; i++) if (x[i] + LEN > x[i - 1] && v[i] > v[i - 1] + 0.5) { rear.add(i); if (hit[i] > 1e8) hit[i] = t; if (hit[i - 1] > 1e8) hit[i - 1] = t; const vm = (v[i] + v[i - 1]) / 2; v[i] = vm; v[i - 1] = vm; x[i] = x[i - 1] - LEN; }
        hist.push({ x: x.slice(), v: v.slice() }); }
      return { hist, bt, hit, dt, crashed: rear.size }; };
    const runA = sim(false), runB = sim(true);
    const cars = Array.from({ length: N }, (_, i) => { const g = new T.Group(), col = [0xaab6c0, 0x4a6a8c, 0xd0d6da, 0x8a3a40, 0x6b7a84, 0xc4bfae, 0x5c7d6a, 0x8a909a, 0xb4c0c8][i];
      const body = new T.Mesh(new T.BoxGeometry(1.86, 0.72, LEN), new T.MeshStandardMaterial({ color: col, metalness: 0.75, roughness: 0.32 })); body.position.y = 0.66; g.add(body);
      const cab = new T.Mesh(new T.BoxGeometry(1.62, 0.6, 2.3), new T.MeshStandardMaterial({ color: 0x0a0f14, metalness: 0.9, roughness: 0.15 })); cab.position.set(0, 1.28, -0.25); g.add(cab);
      g.position.x = lanes[i]; scene.add(g); return g; });
    const tail = points(new Float32Array(N * 6), 0xff1a1a, 0.8, { fog: true }), head = points(new Float32Array(N * 6), 0xfff1d6, 0.9, { fog: true }), ring = points(new Float32Array(N * 3), C.ice, 3), bang = points(new Float32Array(N * 3), 0xffc27a, 7, { fog: true });
    scene.add(tail, head, ring, bang);
    return { scene, camera: cam(46), cars, tail, head, ring, bang, runA, runB, N, LEN };
  });
  if (!W.checked) { W.checked = true; console.log(`[road] sin aviso chocan ${W.runA.crashed}; con aviso ${W.runB.crashed}`); }
  return { scene: W.scene, camera: W.camera, bloom: [1.0, 0.75, 0.55], update(lt, d, cue) {
    const B = lt >= cue(3) - 0.25, run = B ? W.runB : W.runA, tau = B ? Math.max(0, lt - cue(3) + 0.25) * 0.9 : Math.max(0, lt - 1.2) * 0.72;
    const s = run.hist[Math.min(run.hist.length - 1, Math.floor(tau / run.dt))], tp = W.tail.geometry.attributes.position.array, hp = W.head.geometry.attributes.position.array, rp = W.ring.geometry.attributes.position.array, bp = W.bang.geometry.attributes.position.array;
    for (let i = 0; i < W.N; i++) { const z = s.x[i], g = W.cars[i], hit = tau >= run.hit[i], brk = tau >= run.bt[i] || hit, since = tau - run.hit[i];
      g.position.z = z; g.rotation.y = hit ? (hash(i, 3) - 0.5) * 0.5 * smooth(0, 0.5, since) : 0; g.position.x = hit ? (hash(i, 4) - 0.5) * 2.2 * smooth(0, 0.6, since) : 0;
      for (let k = 0; k < 2; k++) { const o = (i * 2 + k) * 3, sx = (k ? 0.7 : -0.7) + g.position.x; tp[o] = sx; tp[o + 1] = 0.82; tp[o + 2] = z - W.LEN / 2 - 0.05; hp[o] = sx; hp[o + 1] = 0.7; hp[o + 2] = z + W.LEN / 2 + 0.1;
        const hz = hit && Math.sin(lt * 9) > 0 ? 1 : 0, b = brk ? 1 : 0.28; setPoint(W.tail, i * 2 + k, b + hz * 0.6, hz * 0.45, 0.02); }
      rp[i * 3] = g.position.x; rp[i * 3 + 1] = 2.6; rp[i * 3 + 2] = z; const w = B && i > 0 ? clamp(1 - Math.abs(tau - run.bt[i] - 0.35) / 0.9) : 0; setPoint(W.ring, i, 0.57 * w, 0.84 * w, 0.91 * w);
      bp[i * 3] = g.position.x; bp[i * 3 + 1] = 1; bp[i * 3 + 2] = z + W.LEN / 2; const f = hit ? clamp(1 - since / 0.35) : 0; setPoint(W.bang, i, f, f * 0.76, f * 0.48); }
    for (const p of [W.tail, W.head, W.ring, W.bang]) p.geometry.attributes.position.needsUpdate = true;
    if (!W.sos) { W.sos = points([0, 0, 0], C.red, 5, { fog: true }); W.sosR = new T.Mesh(new T.RingGeometry(0.95, 1, 64), new T.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); W.sosR.rotation.x = -Math.PI / 2; W.scene.add(W.sos, W.sosR); }
    { const on = lt > cue(5), ph = (lt * 0.8) % 1; W.sos.visible = W.sosR.visible = on; W.sos.position.set(W.cars[1].position.x, 2.4, W.cars[1].position.z); W.sosR.position.set(W.cars[1].position.x, 0.3, W.cars[1].position.z); W.sosR.scale.setScalar(2 + ph * 40); W.sosR.material.opacity = on ? (1 - ph) * 0.8 : 0; tint(W.sos, Math.sin(lt * 6) > 0 ? 1 : 0.3); }
    const zc = s.x[3], k = B ? smooth(cue(3), d, lt) : smooth(0, cue(3), lt);
    if (!B) fly(W.camera, [{ p: [3.4, 1.7, zc - 13], l: [0, 1.0, zc + 25] }, { p: [5.6, 2.3, zc - 9], l: [0, 1, zc + 22] }, { p: [7.5, 3.0, zc - 5], l: [0, 0.9, zc + 18] }], k);
    else fly(W.camera, [{ p: [-6, 3.2, zc - 17], l: [0, 1, zc + 30] }, { p: [-5.6, 2.3, zc - 9], l: [0, 1, zc + 36] }, { p: [-5, 2.0, zc + 5], l: [0, 1, zc + 44] }], k);
  } };
}

// ───────────────────────── Incendio ─────────────────────────
function fire() {
  const W = once('fire', () => {
    const scene = new T.Scene(); night(scene, 0x0e0c0b, 0.0036).intensity = 1.4;
    const S = 240, SEG = 150, geo = new T.PlaneGeometry(S, S, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position, n = P.count, H = (x, z) => 9 * Math.sin(x * 0.035 + 1) * Math.cos(z * 0.03) + 5 * Math.sin(x * 0.09 + z * 0.07) + 2.2 * Math.sin(x * 0.21) * Math.sin(z * 0.19) + 0.05 * (x + z);
    const base = new Float32Array(n * 3), fcol = new Float32Array(n * 3), arr = new Float32Array(n), ign = [-78, -62], wind = [0.78, 0.62];
    for (let i = 0; i < n; i++) { const x = P.getX(i), z = P.getZ(i), h = H(x, z); P.setY(i, h);
      const dx = x - ign[0], dz = z - ign[1], dd = Math.hypot(dx, dz) || 1e-3, cs = (dx * wind[0] + dz * wind[1]) / dd, up = H(x + wind[0] * 3, z + wind[1] * 3) - h;
      arr[i] = dd * (1 - 0.52 * cs) * (1 - clamp(up * 0.12, -0.25, 0.3)) * (0.9 + 0.2 * hash(i, 5));
      const g = 0.5 + 0.5 * hash(i, 1), k = clamp((h + 10) / 26); base[i * 3] = mix(0.10, 0.26, k) * g; base[i * 3 + 1] = mix(0.20, 0.27, k) * g; base[i * 3 + 2] = mix(0.09, 0.13, k) * g; }
    geo.computeVertexNormals(); geo.setAttribute('color', new T.BufferAttribute(base.slice(), 3));
    const ter = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })); scene.add(ter);
    const fgeo = geo.clone(); fgeo.setAttribute('color', new T.BufferAttribute(fcol, 3));
    const glow = new T.Mesh(fgeo, new T.MeshBasicMaterial({ vertexColors: true, blending: T.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false })); glow.position.y = 0.12; scene.add(glow);
    const NE = 900, emb = points(new Float32Array(NE * 3), 0xffa040, 1.5), eidx = Array.from({ length: NE }, (_, i) => Math.floor(hash(i, 8) * n)); scene.add(emb);
    const at = (x, z) => { let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d2 = (P.getX(i) - x) ** 2 + (P.getZ(i) - z) ** 2; if (d2 < bd) { bd = d2; best = i; } } return best; };
    const mi = at(4, 6), ti = at(74, 58), mastY = H(4, 6), mast = new T.Mesh(new T.CylinderGeometry(0.3, 0.9, 26, 6), new T.MeshStandardMaterial({ color: 0x8794a0, metalness: 0.7, roughness: 0.4 })); mast.position.set(4, mastY + 13, 6); scene.add(mast);
    const beacon = points([4, mastY + 27, 6], C.red, 9); scene.add(beacon);
    const dome = new T.Mesh(new T.SphereGeometry(62, 32, 12, 0, 6.283, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: C.ice, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false, fog: false })); dome.position.set(4, mastY, 6); scene.add(dome);
    const R = rng(77), ty = H(74, 58); for (let i = 0; i < 16; i++) { const w = 3 + R() * 3, b = new T.Mesh(new T.BoxGeometry(w, 2.5 + R() * 2.5, 3 + R() * 3), new T.MeshStandardMaterial({ color: 0x2a2622, emissive: 0xffc27a, emissiveIntensity: 0.35 + R() * 0.5 })); b.position.set(74 + (R() - 0.5) * 30, ty + 1.5, 58 + (R() - 0.5) * 26); b.rotation.y = R(); scene.add(b); }
    const lm = label('MAST T2', '#f2f4f4', 44, 'burns at T+1h39'); lm.position.set(4, mastY + 38, 6); scene.add(lm);
    const lt2 = label('TOWN', '#fbbf24', 44, 'warning deadline T+3h26'); lt2.position.set(74, ty + 20, 58); scene.add(lt2);
    return { scene, camera: cam(40), geo, fgeo, base, fcol, arr, n, P, emb, eidx, NE, tMast: arr[mi], tTown: arr[ti], beacon, dome, lm, lt2, wind };
  });
  return { scene: W.scene, camera: W.camera, exposure: 1.2, bloom: [1.25, 0.8, 0.5], update(lt, d, cue) {
    // el frente alcanza la antena en T+1h39 (cuando se narra) y la escena acaba antes de llegar al pueblo
    const tm = cue(2) + 1.6, front = lt < tm ? W.tMast * Math.pow(clamp(lt / tm), 1.25) : mix(W.tMast, W.tTown * 0.9, smooth(tm, d + 3, lt));
    const col = W.geo.attributes.color.array;
    for (let i = 0; i < W.n; i++) { const a = front - W.arr[i], o = i * 3;
      if (a < 0) { col[o] = W.base[o]; col[o + 1] = W.base[o + 1]; col[o + 2] = W.base[o + 2]; W.fcol[o] = W.fcol[o + 1] = W.fcol[o + 2] = 0; }
      else { const burn = clamp(1 - a / 9), fl = 0.65 + 0.35 * Math.sin(lt * 13 + i * 1.3), ember = Math.max(0, 1 - a / 60) * 0.1 * (0.5 + 0.5 * hash(i, Math.floor(lt * 4)));
        const ch = 1 - smooth(0, 6, a) * 0.86; col[o] = W.base[o] * ch; col[o + 1] = W.base[o + 1] * ch; col[o + 2] = W.base[o + 2] * ch;
        W.fcol[o] = burn * fl * 2.6 + ember * 1.2; W.fcol[o + 1] = burn * burn * fl * 1.25 + ember * 0.25; W.fcol[o + 2] = burn * burn * burn * 0.35; } }
    W.geo.attributes.color.needsUpdate = true; W.fgeo.attributes.color.needsUpdate = true;
    const ep = W.emb.geometry.attributes.position.array;
    for (let k = 0; k < W.NE; k++) { const i = W.eidx[k], a = front - W.arr[i], ph = (lt * 0.5 + hash(k, 2)) % 1, on = a > 0 && a < 12; ep[k * 3] = W.P.getX(i) + W.wind[0] * ph * 16 + Math.sin(lt * 2 + k) * 1.2; ep[k * 3 + 1] = on ? W.P.getY(i) + ph * 26 : -99; ep[k * 3 + 2] = W.P.getZ(i) + W.wind[1] * ph * 16; }
    W.emb.geometry.attributes.position.needsUpdate = true;
    const alive = front < W.tMast; tint(W.beacon, alive ? (Math.sin(lt * 5) > 0 ? 1 : 0.2) : 0); W.dome.material.opacity = alive ? 0.035 + 0.012 * Math.sin(lt * 3) : 0.035 * clamp(1 - (lt - tm) / 0.6);
    W.lm.material.opacity = smooth(cue(1), cue(1) + 0.8, lt); W.lt2.material.opacity = smooth(cue(3), cue(3) + 0.8, lt);
    fly(W.camera, [{ p: [-150, 44, 30], l: [-60, 0, -50] }, { p: [-60, 60, 130], l: [0, 4, 0] }, { p: [60, 46, 160], l: [40, 6, 30] }, { p: [150, 34, 120], l: [50, 8, 40] }], lt / d);
  } };
}

// ───────────────────────── Edificio y dron ─────────────────────────
function building() {
  const W = once('building', () => {
    const scene = new T.Scene(); night(scene, 0x070d14, 0.0040).intensity = 1.6;
    const g = new T.Mesh(new T.PlaneGeometry(800, 800), new T.MeshStandardMaterial({ color: 0x070b0f, roughness: 0.5, metalness: 0.4 })); g.rotation.x = -Math.PI / 2; scene.add(g);
    const bg = makeCity({ seed: 31, half: 170, block: 30, hmin: 8, hmax: 40, districts: 2, density: 0.8 }); bg.dist.forEach((dd) => dd.power(0.05));
    bg.group.children.forEach((m) => { if (m.isInstancedMesh) { const m4 = new T.Matrix4(), p = new T.Vector3(); for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, m4); p.setFromMatrixPosition(m4); if (Math.hypot(p.x, p.z) < 50) { m4.makeScale(0, 0, 0); m.setMatrixAt(i, m4); } } } }); scene.add(bg.group);
    const F = 10, FH = 3.6, w = 22, dp = 13, R = rng(9), floors = [];
    const glass = new T.MeshStandardMaterial({ color: 0x1d3a4c, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.6, emissive: 0x0a2230, emissiveIntensity: 0.6 }), slab = new T.MeshStandardMaterial({ color: 0x8a98a4, roughness: 0.6 });
    const phPos = [], phFloor = [];
    for (let f = 0; f < F; f++) { const s = new T.Mesh(new T.BoxGeometry(w + 0.6, 0.35, dp + 0.6), slab); s.position.y = f * FH; scene.add(s);
      const shell = new T.Mesh(new T.BoxGeometry(w, FH - 0.35, dp), glass); shell.position.y = f * FH + FH / 2; scene.add(shell);
      const ed = new T.LineSegments(new T.EdgesGeometry(shell.geometry), new T.LineBasicMaterial({ color: C.ice, transparent: true, opacity: 0.3 })); ed.position.copy(shell.position); scene.add(ed);
      const cnt = f === 0 ? 2 : Math.floor(R() * 8); for (let k = 0; k < cnt; k++) { phPos.push((R() - 0.5) * (w - 3), f * FH + 1.2, (R() - 0.5) * (dp - 3)); phFloor.push(f); }
      const lb = label(`${cnt}`, cnt ? '#91d7e8' : '#8094a0', 24, cnt ? `phones · floor ${f}` : `none · floor ${f}`); lb.position.set(-w / 2 - 12, f * FH + FH / 2 - 0.6, dp / 2 + 2); lb.material.opacity = 0; scene.add(lb); floors.push({ ed, lb, cnt }); }
    const roof = new T.Mesh(new T.BoxGeometry(w + 0.6, 0.35, dp + 0.6), slab); roof.position.y = F * FH; scene.add(roof);
    const phones = points(phPos, C.ice, 2.8); scene.add(phones);
    const drone = new T.Group(); drone.add(new T.Mesh(new T.BoxGeometry(1.5, 0.45, 1.5), new T.MeshStandardMaterial({ color: 0x1c2630, emissive: 0x334455 })));
    const rot = []; for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { const arm = new T.Mesh(new T.BoxGeometry(0.12, 0.1, 1.9), new T.MeshStandardMaterial({ color: 0x33404a })); arm.position.set(x / 2, 0, z / 2); arm.rotation.y = Math.atan2(x, z); drone.add(arm); const r = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 0.05, 18), new T.MeshBasicMaterial({ color: 0xbfe8f4, transparent: true, opacity: 0.3 })); r.position.set(x, 0.3, z); drone.add(r); rot.push(r); }
    const nav = points([0, -0.4, 0], C.green, 5); drone.add(nav);
    const beam = new T.Mesh(new T.ConeGeometry(dp * 0.55, w + 6, 4, 1, true), new T.MeshBasicMaterial({ color: C.ice, transparent: true, opacity: 0.1, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); beam.rotation.z = -Math.PI / 2; beam.scale.y = 1; beam.position.x = -(w + 6) / 2 - 1; drone.add(beam);
    scene.add(drone);
    return { scene, camera: cam(40), floors, phones, phFloor, drone, F, FH, w, dp };
  });
  return { scene: W.scene, camera: W.camera, bloom: [1.0, 0.7, 0.55], update(lt, d, cue) {
    const u = smooth(1.0, cue(3) + 1.5, lt), y = mix(1.4, (W.F - 0.5) * W.FH, u), fNow = y / W.FH;
    W.drone.position.set(W.w / 2 + 7 + Math.sin(lt * 1.3) * 0.25, y + Math.sin(lt * 2.1) * 0.12, Math.sin(lt * 0.7) * 1.2); W.drone.rotation.z = Math.sin(lt * 1.3) * 0.04;
    const a = W.phones.geometry.attributes.color;
    for (let i = 0; i < W.phFloor.length; i++) { const seen = clamp((fNow - W.phFloor[i]) * 2), at = Math.abs(fNow - 0.5 - W.phFloor[i]) < 0.6 ? 1 : 0, k = 0.1 + 0.6 * seen + at * (0.5 + 0.5 * Math.sin(lt * 14 + i)); a.array[i * 3] = 0.57 * k; a.array[i * 3 + 1] = 0.84 * k; a.array[i * 3 + 2] = 0.91 * k; }
    a.needsUpdate = true;
    W.floors.forEach((f, i) => { const seen = clamp((fNow - i - 0.3) * 2.2); f.lb.material.opacity = seen; f.ed.material.opacity = 0.28 + 0.5 * (Math.abs(fNow - 0.5 - i) < 0.6 ? 1 : 0) + 0.15 * seen; });
    const ang = mix(0.95, 0.15, smooth(0, d, lt)), r = mix(66, 50, smooth(0, d, lt)); W.camera.position.set(Math.sin(ang) * r - 6, mix(9, 30, u), Math.cos(ang) * r); W.camera.lookAt(-5, mix(8, 22, u), 0);
  } };
}

// ───────────────────────── Fondos para ciencia · campos · pruebas ─────────────────────────
function waveWorld() {
  return once('wave', () => {
    const scene = new T.Scene(); scene.background = new T.Color(0x03070c); scene.fog = new T.FogExp2(0x03070c, 0.006);
    const NX = 150, NZ = 90, pos = new Float32Array(NX * NZ * 3); const p = points(pos, C.ice, 1.25); scene.add(p);
    const a = p.geometry.attributes.color; for (let i = 0; i < NX * NZ; i++) { const k = 0.25 + 0.75 * hash(i, 3); a.array[i * 3] = 0.3 * k; a.array[i * 3 + 1] = 0.72 * k; a.array[i * 3 + 2] = 0.9 * k; }
    // constelación de agentes
    const NA = 43, sph = [], seg = []; for (let i = 0; i < NA; i++) { const y = 1 - (i / (NA - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; sph.push([Math.cos(th) * r * 26, y * 26, Math.sin(th) * r * 26]); }
    sph.forEach((s, i) => sph.map((q, j) => [Math.hypot(s[0] - q[0], s[1] - q[1], s[2] - q[2]), j]).filter(([dd, j]) => j > i && dd < 15).forEach(([, j]) => seg.push(...s, ...sph[j])));
    const corps = new T.Group(); corps.add(points(sph.flat(), C.coral, 5.5));
    corps.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(seg, 3)), new T.LineBasicMaterial({ color: C.ice, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })));
    corps.position.set(120, 2, -20); corps.visible = false; scene.add(corps);
    return { scene, camera: cam(42), p, NX, NZ, corps };
  });
}
function waveUpdate(W, lt, amp, look) {
  const a = W.p.geometry.attributes.position.array; let o = 0;
  for (let x = 0; x < W.NX; x++) for (let z = 0; z < W.NZ; z++) { const px = (x - W.NX / 2) * 3.2, pz = (z - W.NZ / 2) * 3.2, r = Math.hypot(px - 40, pz + 30); a[o++] = px; a[o++] = amp * (Math.sin(r * 0.085 - lt * 1.5) * 5 / (1 + r * 0.012) + Math.sin(px * 0.05 + lt * 0.6) * 2.4 + Math.cos(pz * 0.07 - lt * 0.4) * 2); a[o++] = pz; }
  W.p.geometry.attributes.position.needsUpdate = true;
  W.camera.position.set(-30 + Math.sin(lt * 0.1) * 30, 34 + look * 8, 150 - lt * 0.9); W.camera.lookAt(20, 16 + look * 14, 0);
}
function science() { const W = waveWorld(); return { scene: W.scene, camera: W.camera, bloom: [0.8, 0.6, 0.5], update(lt) { W.corps.visible = false; waveUpdate(W, lt, 1.25, 0); } }; }
function fields() { const W = waveWorld(); return { scene: W.scene, camera: W.camera, bloom: [0.8, 0.6, 0.5], update(lt) { W.corps.visible = false; waveUpdate(W, lt + 40, 0.9, 0.3); } }; }
function proof() { const W = waveWorld(); return { scene: W.scene, camera: W.camera, bloom: [0.95, 0.6, 0.45], update(lt, d, cue) { waveUpdate(W, lt + 80, 0.6, 0.2); W.corps.visible = true; W.corps.rotation.set(0.3, lt * 0.22, 0); W.corps.scale.setScalar(0.55 + 0.6 * ease((lt - cue(3) + 1.5) / 1.6)); } }; }


// ───────────────────────── Tren a bordo: impacto, «¿estás bien?», fusión y CAP (v18)
function train() {
  const R0 = rail(); // asegura el mundo ferroviario
  const W = once('rail'), X = once('trainx', () => {
    const coaches = [[-2.9, -44, 1], [-2.9, -18, 1], [-1.6, 7.5, 1], [0.6, 31, 1], [2.9, 186, 2], [3.4, 161, 2], [5.6, 137, 2]];
    const ph = [], who = []; coaches.forEach(([x, z, t], c) => { for (let i = 0; i < 26; i++) { ph.push(x + (hash(i, c) - 0.5) * 2, 2.6 + hash(i, c + 9) * 1.2, z + (hash(i, c + 4) - 0.5) * 21); who.push(t); } });
    const phones = points(ph, C.ice, 3.2); W.scene.add(phones);
    const node = new T.Mesh(new T.IcosahedronGeometry(2.2, 1), new T.MeshStandardMaterial({ color: 0x10202a, emissive: C.amber, emissiveIntensity: 0.6, flatShading: true })); node.position.set(-30, 34, 80); W.scene.add(node);
    const nodeL = label('FUSION · 2 TRAINS · 7 COACHES', '#fbbf24', 40); nodeL.position.set(-30, 44, 80); W.scene.add(nodeL);
    const ups = [[-2.9, -30], [0, 20], [4, 160]].map(([x, z]) => { const c = new T.CatmullRomCurve3([new T.Vector3(x, 4, z), new T.Vector3((x - 30) / 2, 26, (z + 80) / 2), new T.Vector3(-30, 34, 80)]); const p = points(c.getSpacedPoints(160).flatMap((v) => [v.x, v.y, v.z]), C.amber, 1.4); p.geometry.setDrawRange(0, 0); W.scene.add(p); return p; });
    const cap = new T.CatmullRomCurve3([new T.Vector3(-30, 34, 80), new T.Vector3(-80, 60, 160), new T.Vector3(-140, 20, 260)]); const capT = points(cap.getSpacedPoints(200).flatMap((v) => [v.x, v.y, v.z]), C.green, 2); capT.geometry.setDrawRange(0, 0); W.scene.add(capT);
    const room = new T.Mesh(new T.BoxGeometry(16, 10, 12), new T.MeshStandardMaterial({ color: 0x1b2a38, emissive: C.green, emissiveIntensity: 0.25 })); room.position.set(-140, 5, 260); W.scene.add(room);
    const roomL = label('112 CONTROL ROOM · CAP', '#34d399', 46); roomL.position.set(-140, 22, 260); W.scene.add(roomL);
    return { phones, who, node, nodeL, ups, capT, room, roomL, n: who.length };
  });
  const objs = [X.phones, X.node, X.nodeL, X.capT, X.room, X.roomL, ...X.ups];
  return { scene: W.scene, camera: W.camera, bloom: [1.0, 0.65, 0.55], update(lt, d, cue) {
    R0.update(0, 1, () => 0); W.l1.material.opacity = 0; W.l2.material.opacity = 0; tint(W.mark, 0); objs.forEach((o) => { o.visible = true; });
    const imp = smooth(cue(1) - 0.2, cue(1) + 0.2, lt), ask = lt > cue(2) && lt < cue(4), fuse = smooth(cue(4), cue(4) + 2, lt), t2 = lt > cue(5);
    const a = X.phones.geometry.attributes.color;
    for (let i = 0; i < X.n; i++) { const quiet = hash(i, 3) < 0.25; let r = 0.57, g = 0.84, b = 0.91, k = 0.6;
      if (imp > 0) { r = 1; g = 0.25; b = 0.3; k = imp; }
      if (ask) { r = 0.98; g = 0.75; b = 0.14; k = 0.5 + 0.5 * Math.sin(lt * 6 + i); }
      if (lt >= cue(4)) { if (quiet) { r = 1; g = 0.36; b = 0.43; } else { r = 0.2; g = 0.83; b = 0.6; } k = 0.9; }
      if (t2 && X.who[i] === 2) k = 0.6 + 0.4 * Math.sin(lt * 8);
      a.array[i * 3] = r * k; a.array[i * 3 + 1] = g * k; a.array[i * 3 + 2] = b * k; }
    a.needsUpdate = true;
    X.ups.forEach((p, i) => p.geometry.setDrawRange(0, Math.floor(clamp(fuse * 1.3 - i * 0.15) * 161)));
    X.node.scale.setScalar(Math.max(0.001, fuse)); X.node.rotation.set(lt * 0.4, lt * 0.6, 0); X.nodeL.material.opacity = smooth(cue(5), cue(5) + 0.6, lt);
    W.l2.material.opacity = t2 ? 1 : 0; tint(W.mark, t2 ? 0.5 + 0.5 * Math.sin(lt * 4) : 0);
    X.capT.geometry.setDrawRange(0, Math.floor(smooth(cue(7), cue(7) + 1.8, lt) * 201)); X.roomL.material.opacity = smooth(cue(7) + 0.8, cue(7) + 1.6, lt);
    fly(W.camera, [{ p: [-14, 6, -60], l: [-2, 3, -10] }, { p: [-16, 5, 0], l: [0, 3, 30] }, { p: [-60, 40, 40], l: [-10, 10, 90] }, { p: [-110, 60, 150], l: [-40, 20, 140] }], lt / d);
  } };
}

export const BUILD = { blackout, flood, rail, train, gap, title, mesh, bearers, orbit, road, fire, building, science, fields, proof, cta };

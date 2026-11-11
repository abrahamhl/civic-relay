// Utilidades compartidas del motor cinema (three.js r158). Todo es determinista: ninguna función usa
// Math.random ni relojes; cada fotograma es función pura del tiempo t.
import * as T from 'three';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const mix = (a, b, u) => a + (b - a) * u;
export const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
export const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const hash = (i, k = 1) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

let GLOW;
export function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  GLOW = new T.CanvasTexture(c); GLOW.colorSpace = T.SRGBColorSpace; return GLOW;
}

// Nube de puntos luminosos. positions: array plano [x,y,z,...]; colores por vértice modificables.
export function points(positions, color = 0xffffff, size = 2, opts = {}) {
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  const n = positions.length / 3, col = new Float32Array(n * 3), c = new T.Color(color);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const m = new T.Points(geo, new T.PointsMaterial({ size, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, fog: opts.fog ?? false, toneMapped: false }));
  m.frustumCulled = false; m.userData.base = c; return m;
}
export function setPoint(p, i, r, g, b) { const a = p.geometry.attributes.color; a.array[i * 3] = r; a.array[i * 3 + 1] = g; a.array[i * 3 + 2] = b; a.needsUpdate = true; }
export function tint(p, k, color) { const a = p.geometry.attributes.color, c = color ?? p.userData.base; for (let i = 0; i < a.count; i++) { a.array[i * 3] = c.r * k; a.array[i * 3 + 1] = c.g * k; a.array[i * 3 + 2] = c.b * k; } a.needsUpdate = true; }

// Rótulo 3D (sprite) con texto.
export function label(text, color = '#f2f4f4', scale = 10, sub = '') {
  const c = document.createElement('canvas'); c.width = 768; c.height = 160;
  const g = c.getContext('2d');
  g.font = '700 58px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 14; g.fillStyle = color; g.fillText(text, 384, sub ? 58 : 80);
  if (sub) { g.font = '500 34px Inter, sans-serif'; g.fillStyle = '#a9bcc5'; g.fillText(sub, 384, 120); }
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
  s.scale.set(scale, scale * 160 / 768, 1); s.renderOrder = 10; return s;
}

function windowTex(R, warm) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 15; y++) for (let x = 0; x < 7; x++) {
    if (R() > 0.46) continue;
    const w = R() < warm, b = 0.35 + R() * 0.65;
    g.fillStyle = w ? `rgba(255,${200 + R() * 30 | 0},${140 + R() * 40 | 0},${b})` : `rgba(${170 + R() * 40 | 0},225,255,${b})`;
    g.fillRect(12 + x * 16, 12 + y * 16, 9, 10);
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function boxGeo() {
  const geo = new T.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const uv = geo.attributes.uv; for (let i = 8; i < 16; i++) uv.setXY(i, 0.01, 0.01); // tejado y base sin ventanas
  return geo;
}

// Ciudad nocturna por distritos (cada distrito tiene su propio suministro eléctrico).
export function makeCity({ seed = 7, half = 150, block = 24, street = 9, hmin = 5, hmax = 46, districts = 8, warm = 0.72, density = 0.92, ground = 0x05080b }) {
  const R = rng(seed), group = new T.Group(), geo = boxGeo();
  const per = Array.from({ length: districts }, () => []), lampPos = Array.from({ length: districts }, () => []);
  const lots = [], dOf = (x) => clamp(Math.floor(((x + half) / (2 * half)) * districts), 0, districts - 1);
  for (let x = -half + block / 2; x < half; x += block) for (let z = -half + block / 2; z < half; z += block) {
    if (R() > density) continue;
    const cen = 1 - Math.min(1, Math.hypot(x, z) / half), n = 1 + (R() * 3 | 0);
    for (let k = 0; k < n; k++) {
      const w = (block - street) * (n === 1 ? 0.9 : 0.42), d = (block - street) * (0.5 + R() * 0.4);
      const h = hmin + (hmax - hmin) * Math.pow(R(), 2.2 - cen * 1.6) * (0.35 + cen);
      const b = { x: x + (n === 1 ? 0 : (k - (n - 1) / 2) * (block - street) * 0.5), z: z + (R() - 0.5) * 3, w, d, h };
      lots.push(b); per[dOf(b.x)].push(b);
    }
  }
  for (let x = -half; x <= half; x += block) for (let z = -half; z <= half; z += block / 2) { lampPos[dOf(x)].push(x, 3.2, z); lampPos[dOf(z)].push(z, 3.2, x); }
  const dist = per.map((list, i) => {
    const mat = new T.MeshStandardMaterial({ color: 0x27313c, roughness: 0.7, metalness: 0.25, emissive: 0xffffff, emissiveMap: windowTex(R, warm), emissiveIntensity: 1.7 });
    const mesh = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4();
    list.forEach((b, j) => { m4.makeScale(b.w, b.h, b.d); m4.setPosition(b.x, 0, b.z); mesh.setMatrixAt(j, m4); });
    mesh.frustumCulled = false; group.add(mesh);
    const lamps = points(lampPos[i], 0xffc27a, 5.5, { fog: true }); group.add(lamps);
    return { mesh, mat, lamps, power(k) { mat.emissiveIntensity = 1.7 * k; tint(lamps, k); } };
  });
  const g = new T.Mesh(new T.PlaneGeometry(half * 2 + 600, half * 2 + 600), new T.MeshStandardMaterial({ color: ground, roughness: 0.55, metalness: 0.35 }));
  g.rotation.x = -Math.PI / 2; group.add(g);
  // puntos de calle (para teléfonos)
  const streets = [];
  for (let i = 0; i < 900; i++) { const a = -half + Math.floor(R() * (2 * half / block + 1)) * block, b = (R() * 2 - 1) * half; streets.push(R() < 0.5 ? [a + (R() - 0.5) * 3, b] : [b, a + (R() - 0.5) * 3]); }
  return { group, dist, lots, streets, half, R };
}

export function night(scene, fogColor = 0x04080d, density = 0.0042) {
  scene.background = new T.Color(fogColor); scene.fog = new T.FogExp2(fogColor, density);
  scene.add(new T.HemisphereLight(0x6f93bd, 0x10151c, 1.1));
  const moon = new T.DirectionalLight(0x9ec4ff, 0.55); moon.position.set(-80, 140, 60); scene.add(moon);
  return moon;
}
export function cam(fov = 38) { return new T.PerspectiveCamera(fov, 1280 / 536, 0.1, 3000); }
// Travelling: interpola posición y punto de mira entre claves [{p:[x,y,z], l:[x,y,z]}].
export function fly(camera, keys, u) {
  const f = clamp(u) * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(f)), k = smooth(0, 1, f - i), a = keys[i], b = keys[i + 1];
  camera.position.set(mix(a.p[0], b.p[0], k), mix(a.p[1], b.p[1], k), mix(a.p[2], b.p[2], k));
  camera.lookAt(mix(a.l[0], b.l[0], k), mix(a.l[1], b.l[1], k), mix(a.l[2], b.l[2], k));
}
export { T };

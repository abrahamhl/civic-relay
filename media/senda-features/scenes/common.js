export const TAU = Math.PI * 2;

export const PALETTE = {
  bg: 0x05090c,
  navy: 0x071018,
  panel: 0x0b141c,
  line: 0x203240,
  text: '#f4f7f8',
  muted: '#9fb2bc',
  coral: '#ff7756',
  ice: '#91d7e8',
  emerald: '#34d399',
  amber: '#fbbf24',
  violet: '#b79cff',
  red: '#ff5b6e',
};

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / Math.max(1e-9, b - a));
  return t * t * (3 - 2 * t);
};
export const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const bump = (x, center = 0.5, width = 0.5) => Math.max(0, 1 - Math.abs(x - center) / width);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

let GLOW = null;
export function glowTexture() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.18, 'rgba(255,255,255,0.8)');
  rg.addColorStop(0.48, 'rgba(255,255,255,0.24)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  GLOW = new THREE.CanvasTexture(c);
  GLOW.colorSpace = THREE.SRGBColorSpace;
  return GLOW;
}

export function textSprite(text, opts = {}) {
  const {
    size = 64,
    color = PALETTE.text,
    bg = 'rgba(7,16,24,0.82)',
    border = 'rgba(145,215,232,0.34)',
    width = 1024,
    height = 160,
    scale = 1,
    mono = false,
    pad = 28,
    align = 'center',
    depthTest = false,
    opacity = 1,
  } = opts;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.clearRect(0, 0, width, height);
  if (bg) {
    const r = Math.min(34, height / 3);
    g.beginPath();
    g.roundRect(3, 3, width - 6, height - 6, r);
    g.fillStyle = bg;
    g.fill();
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = 2;
      g.stroke();
    }
  }
  g.fillStyle = color;
  g.font = `${mono ? '700' : '700'} ${size}px ${mono ? 'ui-monospace, Consolas, monospace' : 'Segoe UI, Inter, system-ui, sans-serif'}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, align === 'center' ? width / 2 : pad, height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest,
    depthWrite: false,
    opacity,
    toneMapped: false,
  });
  const sp = new THREE.Sprite(mat);
  const s = scale / height;
  sp.scale.set(width * s, height * s, 1);
  sp.renderOrder = 50;
  return sp;
}

export function glowSprite(color, size = 2, opacity = 0.8, depthTest = true) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    depthTest,
    depthWrite: false,
    opacity,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(size);
  sp.renderOrder = 20;
  return sp;
}

export function addStars(scene, count = 850, radius = 260, seed = 1) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const colors = [0x9fc7d8, 0xd7e7ee, 0x8fb3c2, 0xffd6b0];
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const r = radius * (0.62 + rnd() * 0.55);
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(a) * s * r;
    pos[i * 3 + 1] = u * r * 0.55;
    pos[i * 3 + 2] = Math.sin(a) * s * r;
    const c = new THREE.Color(colors[Math.floor(rnd() * colors.length)]);
    const k = 0.45 + rnd() * 0.55;
    col[i * 3] = c.r * k;
    col[i * 3 + 1] = c.g * k;
    col[i * 3 + 2] = c.b * k;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.9,
    map: glowTexture(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = -10;
  scene.add(pts);
  return pts;
}

export function addGrid(scene, size = 220, div = 44, color1 = 0x1a3a48, color2 = 0x0c202b) {
  const g = new THREE.GridHelper(size, div, color1, color2);
  g.material.transparent = true;
  g.material.opacity = 0.45;
  g.position.y = 0.01;
  scene.add(g);
  return g;
}

export function cylinderBetween(a, b, radius, color, opacity = 0.8, emissive = true) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 8, 1, true);
  const mat = emissive
    ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    : new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.45, metalness: 0.4 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

export function curveLine(points, color, opacity = 0.6, dashed = false) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(180));
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.7, gapSize: 0.45, toneMapped: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false });
  const line = new THREE.Line(geo, mat);
  if (dashed) line.computeLineDistances();
  return { line, curve };
}

export function makeTerrain(width, depth, seg, heightAt, seed = 7, palette = null) {
  const geo = new THREE.PlaneGeometry(width, depth, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const rnd = mulberry32(seed);
  const low = new THREE.Color(palette?.[0] ?? 0x0b1c19);
  const mid = new THREE.Color(palette?.[1] ?? 0x193127);
  const high = new THREE.Color(palette?.[2] ?? 0x2b3b32);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const k = clamp((h + 1) / 15);
    tmp.copy(low).lerp(mid, smooth(0.05, 0.55, k)).lerp(high, smooth(0.55, 0.95, k));
    const j = 0.88 + rnd() * 0.24;
    col[i * 3] = tmp.r * j;
    col[i * 3 + 1] = tmp.g * j;
    col[i * 3 + 2] = tmp.b * j;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

export function makeWater(width, depth, seg = 120, colorDeep = 0x0a2a3d, colorShallow = 0x1f7a8c) {
  const geo = new THREE.PlaneGeometry(width, depth, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(colorDeep) },
      uShallow: { value: new THREE.Color(colorShallow) },
      uSun: { value: new THREE.Vector3(0.4, 0.8, 0.2).normalize() },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.22 + uTime * 1.6) * 0.22
                + sin(p.z * 0.31 - uTime * 1.2) * 0.16
                + sin((p.x + p.z) * 0.14 + uTime * 0.8) * 0.12;
        p.y += w;
        vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
        vNormal = normalize(vec3(
          -0.22 * cos(position.x * 0.22 + uTime * 1.6),
          1.0,
          -0.31 * cos(position.z * 0.31 - uTime * 1.2)
        ));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSun;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(V, normalize(vNormal)), 0.0), 2.2);
        float ripple = 0.5 + 0.5 * sin(vWorld.x * 0.8 + vWorld.z * 0.55 + uTime * 3.0);
        vec3 col = mix(uDeep, uShallow, fres * 0.75 + ripple * 0.16);
        float spec = pow(max(dot(reflect(-uSun, normalize(vNormal)), V), 0.0), 90.0);
        col += vec3(0.55, 0.75, 0.82) * spec * 0.7;
        float alpha = mix(0.64, 0.9, fres);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  return mesh;
}

export function makePhone(color = PALETTE.ice, screenColor = null) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.72, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.35, metalness: 0.7 })
  );
  g.add(body);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: 0x3b5b6b, transparent: true, opacity: 0.8 })
  );
  g.add(edge);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.27, 0.54),
    new THREE.MeshBasicMaterial({ color: screenColor ?? color, transparent: true, opacity: 0.88, toneMapped: false })
  );
  screen.position.z = 0.045;
  g.add(screen);
  const halo = glowSprite(color, 1.7, 0.5);
  halo.position.z = 0.1;
  g.add(halo);
  g.userData.screen = screen;
  g.userData.halo = halo;
  return g;
}

export function makeDrone(color = PALETTE.ice) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x182a34, roughness: 0.35, metalness: 0.65 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd7e7ee, roughness: 0.32, metalness: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 0.62), white);
  body.position.y = 0.18;
  g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.4), shell);
  top.position.y = 0.34;
  g.add(top);
  const rotors = [];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.09), shell);
    arm.position.set(x * 0.42, 0.18, z * 0.42);
    arm.rotation.y = x * z > 0 ? -Math.PI / 4 : Math.PI / 4;
    g.add(arm);
    const rg = new THREE.Group();
    rg.position.set(x * 0.78, 0.24, z * 0.78);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.015, 0.07), new THREE.MeshBasicMaterial({ color: 0x91d7e8, transparent: true, opacity: 0.75, toneMapped: false }));
    const blade2 = blade.clone();
    blade2.rotation.y = Math.PI / 2;
    rg.add(blade, blade2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.008, 5, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    rg.add(ring);
    g.add(rg);
    rotors.push(rg);
  }
  const cam = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), new THREE.MeshStandardMaterial({ color: 0x05090c, roughness: 0.2, metalness: 0.8 }));
  cam.position.set(0, 0.04, 0.38);
  g.add(cam);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  lens.position.set(0, 0.04, 0.525);
  g.add(lens);
  const led = glowSprite(PALETTE.coral, 0.55, 1);
  led.position.set(0, 0.02, -0.34);
  g.add(led);
  g.userData.rotors = rotors;
  g.userData.led = led;
  return g;
}

export function makeSatellite(color = PALETTE.amber) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.65), new THREE.MeshStandardMaterial({ color: 0xb9c8cf, roughness: 0.45, metalness: 0.65 }));
  g.add(body);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x173f66, roughness: 0.3, metalness: 0.55, emissive: 0x071a2c, emissiveIntensity: 0.5 });
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.7), panelMat);
    panel.position.set(s * 1.35, 0, 0);
    g.add(panel);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), new THREE.LineBasicMaterial({ color: 0x91d7e8, transparent: true, opacity: 0.5 }));
    edge.position.copy(panel.position);
    g.add(edge);
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 10, 0, TAU, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ color: 0xe8eef1, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide }));
  dish.position.set(0, 0.45, 0.1);
  dish.rotation.x = Math.PI;
  g.add(dish);
  const led = glowSprite(color, 0.55, 0.95);
  led.position.set(0, -0.38, 0.32);
  g.add(led);
  g.userData.led = led;
  return g;
}

export function makePacket(color = PALETTE.coral, size = 0.2) {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(size, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false })
  );
  m.add(glowSprite(color, size * 7, 0.55));
  return m;
}

export function makeTrail(color, count = 12, size = 0.06) {
  const pts = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color, size, map: glowTexture(), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false })
  );
  pts.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  pts.renderOrder = 18;
  return pts;
}

export function updateTrail(trail, points) {
  const arr = trail.geometry.attributes.position.array;
  const n = arr.length / 3;
  for (let i = 0; i < n; i++) {
    const p = points[Math.min(points.length - 1, i)];
    arr[i * 3] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  }
  trail.geometry.attributes.position.needsUpdate = true;
}

export function fitSprite(sprite, camera, ref = 20, min = 0.12, max = 2.4) {
  if (!sprite.userData.baseScale) sprite.userData.baseScale = sprite.scale.clone();
  const wp = sprite.userData._wp || (sprite.userData._wp = new THREE.Vector3());
  sprite.getWorldPosition(wp);
  const d = camera.position.distanceTo(wp);
  const k = clamp(d / ref, min, max);
  sprite.scale.set(sprite.userData.baseScale.x * k, sprite.userData.baseScale.y * k, 1);
}

export function cameraTo(camera, pos, look, fov = null) {
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(new THREE.Vector3(look[0], look[1], look[2]));
  if (fov !== null && camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

export function cameraKeys(camera, t, keys) {
  if (!keys.length) return;
  if (t <= keys[0].t) {
    cameraTo(camera, keys[0].pos, keys[0].look, keys[0].fov ?? null);
    return;
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = smooth(a.t, b.t, t);
      const p = [lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k)];
      const l = [lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k), lerp(a.look[2], b.look[2], k)];
      cameraTo(camera, p, l, a.fov !== undefined && b.fov !== undefined ? lerp(a.fov, b.fov, k) : null);
      return;
    }
  }
  const last = keys[keys.length - 1];
  cameraTo(camera, last.pos, last.look, last.fov ?? null);
}

export function addDust(scene, count = 400, area = 80, color = 0x91d7e8, seed = 4) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * area;
    pos[i * 3 + 1] = rnd() * area * 0.4;
    pos[i * 3 + 2] = (rnd() - 0.5) * area;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.08, map: glowTexture(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
  const p = new THREE.Points(geo, mat);
  scene.add(p);
  return p;
}

export function ringWave(color, radius = 1, opacity = 0.5) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.975, radius, 96),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map && m.map !== GLOW) m.map.dispose();
        m.dispose();
      }
    }
  });
}

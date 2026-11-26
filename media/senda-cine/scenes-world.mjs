// Escenas de datos: apertura y cierre (red), DANA 4D (relieve real + crecida simulada + mancha de Copernicus) y tren de Adamuz.
import { THREE, C, g, W, H, ease, clamp, lerp, seg, text, panel, project } from './kit.mjs';
import { techKinds } from './scenes-tech.mjs';
import { glowTex } from './scenes-road.mjs';

const BASE = '/investor-next/public/senda/data/';
function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function stage(bg = '#03070a') { const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); scene.fog = new THREE.FogExp2(bg, 0.0042); const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 2000); scene.add(new THREE.HemisphereLight('#6d8fa6', '#05080a', 0.8)); const d = new THREE.DirectionalLight('#ffffff', 1.1); d.position.set(-120, 160, 80); scene.add(d); return { scene, camera }; }

// ---------- Red de nodos (apertura y cierre)
function network({ sc }) {
  const { scene, camera } = stage('#02060a'); const N = 240, pts = [];
  for (let i = 0; i < N; i++) { const r = 150 * Math.sqrt(rnd(i)), a = rnd(i + 999) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, (rnd(i + 5) - 0.5) * 10, Math.sin(a) * r)); }
  const dots = new THREE.Group(); const mats = [C.sky, C.mint, C.ember, C.sun].map((c) => new THREE.SpriteMaterial({ color: c, map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.forEach((p, i) => { const s = new THREE.Sprite(mats[i % 9 === 0 ? 2 : i % 7 === 0 ? 1 : 0]); s.position.copy(p); s.scale.setScalar(2.6); dots.add(s); }); scene.add(dots);
  const pairs = []; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (pts[i].distanceTo(pts[j]) < 22) pairs.push([i, j, rnd(i * 31 + j)]);
  const pos = new Float32Array(pairs.length * 6); pairs.forEach(([i, j], k) => { pos.set([pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z], k * 6); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: C.sky, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending })); scene.add(lines);
  const end = sc.visual.kind === 'end';
  function update({ local, p }) {
    const k = ease(p), n = Math.floor(pairs.length * clamp(end ? 1 : p * 1.4)); geo.setDrawRange(0, n * 2);
    const a = 0.4 + local * 0.05; camera.position.set(Math.cos(a) * lerp(260, 180, k), lerp(150, 90, k), Math.sin(a) * lerp(260, 180, k)); camera.lookAt(0, 0, 0);
  }
  function overlay({ lineAt, local }) {
    const show = end ? ease(seg(local, 0.4, 1.6)) : ease(seg(lineAt(1), 0, 0.25));
    if (show > 0) { text('SENDA', W / 2, H / 2 - 10, { px: 170, w: 650, align: 'center', alpha: show }); text(end ? 'civic-relay-investor.vercel.app/senda' : 'Coordinar hasta que llega la ayuda', W / 2, H / 2 + 70, { px: 34, w: 550, color: C.gray, align: 'center', alpha: show }); }
  }
  return { scene, camera, update, overlay };
}

// ---------- DANA 4D
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unmerc = (y) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
function decodeRle(bytes, off, len, out) { let p = off, k = 0; const end = off + len; while (p < end) { const v = bytes[p++]; if (v === 255) { const r = bytes[p] | (bytes[p + 1] << 8); p += 2; out.fill(0, k, k + r); k += r; } else out[k++] = v; } return out; }
const waterCol = (v) => (v < 5 ? [155, 231, 255, 150] : v < 15 ? [58, 160, 255, 190] : v < 30 ? [22, 82, 216, 215] : [122, 43, 214, 230]);
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m) % 60).padStart(2, '0')}`;

function dana() {
  const { scene, camera } = stage('#02070b'); scene.fog = new THREE.FogExp2('#02070b', 0.0022); const st = {};
  const ready = (async () => {
    const [hidro, swe, geo, cauces] = await Promise.all(['hidro.json', 'swe.json', 'emsr773_inundacion.geojson', 'cauces.geojson'].map((f) => fetch(BASE + 'dana2024/' + f).then((r) => r.json())));
    const dem = new Int16Array(await (await fetch(BASE + 'dana2024/dem_d4.bin')).arrayBuffer());
    const V = swe.variantes.find((v) => v.n === swe.mejor.n && v.recesionH === swe.mejor.recesionH) ?? swe.variantes[0];
    const frames = new Uint8Array(await (await fetch(BASE + `dana2024/swe_${V.id}_frames.bin`)).arrayBuffer());
    const D = hidro.malla.esquinas, Dw = hidro.relieveD4.w, Dh = hidro.relieveD4.h, dLon0 = D[0][0], dLon1 = D[1][0], dyT = merc(D[0][1]), dyB = merc(D[2][1]);
    const S = swe.malla.esquinas, SW = swe.malla.w, SH = swe.malla.h, sLon0 = S[0][0], sLon1 = S[1][0], syT = merc(S[0][1]), syB = merc(S[2][1]);
    const demAt = (lon, lat) => { const x = ((lon - dLon0) / (dLon1 - dLon0)) * Dw - 0.5, y = ((dyT - merc(lat)) / (dyT - dyB)) * Dh - 0.5; const x0 = clamp(Math.floor(x), 0, Dw - 2), y0 = clamp(Math.floor(y), 0, Dh - 2), fx = clamp(x - x0), fy = clamp(y - y0);
      const v = (i, j) => { const h = dem[(y0 + j) * Dw + x0 + i]; return h === -32768 ? 0 : Math.max(0, h); }; return lerp(lerp(v(0, 0), v(1, 0), fx), lerp(v(0, 1), v(1, 1), fx), fy); };
    const lonOf = (u) => sLon0 + u * (sLon1 - sLon0), latOf = (v) => unmerc(syT + v * (syB - syT));
    // Malla del terreno: 1 unidad = 100 m; altura exagerada ×5
    const sizeX = (SW * swe.malla.celdaM) / 100, sizeZ = (SH * swe.malla.celdaM) / 100, sx = 210, sy = 170;
    const pg = new THREE.PlaneGeometry(sizeX, sizeZ, sx, sy); const pa = pg.attributes.position;
    for (let iy = 0; iy <= sy; iy++) for (let ix = 0; ix <= sx; ix++) pa.setZ(iy * (sx + 1) + ix, (demAt(lonOf(ix / sx), latOf(iy / sy)) / 100) * 5);
    pg.computeVertexNormals(); pg.rotateX(-Math.PI / 2);
    // Textura base: relieve sombreado + cauces
    const hg = new Float32Array(SW * SH); for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) hg[j * SW + i] = demAt(lonOf((i + 0.5) / SW), latOf((j + 0.5) / SH));
    const base = new ImageData(SW, SH);
    for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) { const k = j * SW + i, h = hg[k]; const dx = (hg[j * SW + Math.min(SW - 1, i + 1)] - hg[j * SW + Math.max(0, i - 1)]), dy = (hg[Math.min(SH - 1, j + 1) * SW + i] - hg[Math.max(0, j - 1) * SW + i]);
      const shade = clamp(0.62 - (dx * 0.9 - dy * 0.7) / 60, 0.15, 1.15), tint = clamp(h / 320); const sea = h <= 0.5;
      const r = sea ? 10 : (46 + 70 * tint) * shade, gg = sea ? 30 : (62 + 74 * tint) * shade, b = sea ? 48 : (60 + 50 * tint) * shade; base.data.set([r, gg, b, 255], k * 4); }
    const tex = document.createElement('canvas'); tex.width = SW * 2; tex.height = SH * 2; const tx = tex.getContext('2d'); const small = document.createElement('canvas'); small.width = SW; small.height = SH; const sx2 = small.getContext('2d');
    const toPx = (lon, lat) => [((lon - sLon0) / (sLon1 - sLon0)) * SW * 2, ((syT - merc(lat)) / (syT - syB)) * SH * 2];
    const strokeGeo = (gj, color, wdt) => { tx.save(); tx.strokeStyle = color; tx.lineWidth = wdt; for (const f of gj.features) { const gm = f.geometry; const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : gm.type === 'LineString' ? [[gm.coordinates]] : gm.type === 'MultiLineString' ? [gm.coordinates] : []; for (const poly of polys) for (const ring of poly) { tx.beginPath(); ring.forEach(([lo, la], q) => { const [x, y] = toPx(lo, la); q ? tx.lineTo(x, y) : tx.moveTo(x, y); }); tx.stroke(); } } tx.restore(); };
    const texture = new THREE.CanvasTexture(tex); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const mesh = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.85, roughness: 1, metalness: 0 })); scene.add(mesh); // el sombreado del relieve va horneado en la textura
    Object.assign(st, { V, frames, base, tx, sx2, small, texture, strokeGeo, geo, cauces, buf: new Uint8Array(SW * SH), SW, SH, sizeX, sizeZ, lastKey: '', mesh, scene });
  })();
  function paint(fi, obs) {
    const key = fi + '|' + obs; if (st.lastKey === key) return; st.lastKey = key;
    const img = new ImageData(new Uint8ClampedArray(st.base.data), st.SW, st.SH);
    if (fi >= 0) { const f = st.V.fotogramas[Math.min(fi, st.V.fotogramas.length - 1)]; decodeRle(st.frames, f.offset, f.bytes, st.buf);
      for (let k = 0; k < st.buf.length; k++) { const v = st.buf[k]; if (!v) continue; const [r, gg, b, a] = waterCol(v), al = a / 255; img.data[k * 4] = img.data[k * 4] * (1 - al) + r * al; img.data[k * 4 + 1] = img.data[k * 4 + 1] * (1 - al) + gg * al; img.data[k * 4 + 2] = img.data[k * 4 + 2] * (1 - al) + b * al; } }
    st.sx2.putImageData(img, 0, 0); st.tx.imageSmoothingEnabled = true; st.tx.drawImage(st.small, 0, 0, st.SW * 2, st.SH * 2);
    st.strokeGeo(st.cauces, 'rgba(145,215,232,.35)', 1.2);
    if (obs) st.strokeGeo(st.geo, 'rgba(255,91,110,.85)', 1.3);
    st.texture.needsUpdate = true;
  }
  let clock = '', phase = 0;
  function update({ t, p, sc }) {
    const L = sc.lines; const at = (i) => (L[i] ? L[i].start : sc.end);
    // Hora simulada: 16:55 → 18:55 (frase 1) → 20:11 (frase 2) → 01:25 (frase 3); en la frase 4, agua final + mancha de Copernicus.
    let mins; if (t < at(1)) mins = lerp(16 * 60 + 55, 18 * 60 + 55, ease(seg(t, sc.start + 0.5, at(1)))); else if (t < at(2)) mins = lerp(18 * 60 + 55, 20 * 60 + 11, ease(seg(t, at(1), at(2)))); else mins = lerp(20 * 60 + 11, 25 * 60 + 25, ease(seg(t, at(2), at(3))));
    const tSeg = (mins - (16 * 60 + 55)) * 60; const fi = st.V.fotogramas.findIndex((f) => f.tSeg >= tSeg); phase = t >= at(3) ? 3 : t >= at(2) ? 2 : t >= at(1) ? 1 : 0;
    paint(fi < 0 ? st.V.fotogramas.length - 1 : fi, t >= at(3) + 0.8); clock = hhmm(mins);
    const a = -1.05 + p * 0.7, R = lerp(165, 115, ease(p)); camera.position.set(Math.cos(a) * R + 60, lerp(110, 78, ease(p)), Math.sin(a) * R + 10); camera.lookAt(62, 0, 5);
  }
  function overlay({ lineAt, local }) {
    const a = ease(seg(local, 1, 2)); panel(W - 420, 140, 324, 120, 0.78 * a); text(clock, W - 258, 222, { px: 62, w: 600, align: 'center', mono: true, alpha: a }); text('29-10-2024 · hora local', W - 258, 250, { px: 18, w: 550, color: C.gray, align: 'center', alpha: a });
    const chip = (y, sq, s1, s2, k) => { if (k <= 0) return; panel(96, y, 640, 92, 0.8 * k); g.save(); g.globalAlpha = k; g.fillStyle = sq; g.fillRect(124, y + 30, 12, 12); g.restore(); text(s1, 150, y + 42, { px: 26, w: 600, alpha: k }); text(s2, 150, y + 74, { px: 19, w: 550, color: C.gray, alpha: k }); };
    chip(250, C.mint, 'Aforo del Poyo · 2.282 m³/s · 18:55', 'medido · último dato fiable antes de que el agua se lleve el medidor', ease(seg(lineAt(0), 0.3, 0.6)));
    chip(360, C.sun, 'Primer ES-Alert · 20:11', 'oficial · 76 minutos después de esa lectura', ease(seg(lineAt(1), 0.1, 0.4)));
    chip(470, C.sky, 'Aguas someras 2D sobre relieve real', 'shallow-water.mjs · masa conservada · calado en metros', ease(seg(lineAt(2), 0.1, 0.4)));
    chip(580, C.rose, 'Mancha observada · Copernicus EMSR773', 'la línea roja · comparación celda a celda', ease(seg(lineAt(3), 0.2, 0.5)));
  }
  return { scene, camera, update, overlay, ready };
}

// ---------- Tren: Adamuz, al segundo (cronología publicada)
function rail() {
  const { scene, camera } = stage('#03060a'); const st = {};
  const ready = fetch(BASE + 'adamuz2026/cronologia.json').then((r) => r.json()).then((c) => { st.ev = c.eventos; });
  const railM = new THREE.MeshStandardMaterial({ color: '#8b98a0', metalness: 0.8, roughness: 0.3 });
  for (const x of [-2.2, -0.8, 0.8, 2.2]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 900), railM); r.position.set(x, 0.1, 0); scene.add(r); }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 900), new THREE.MeshStandardMaterial({ color: '#0a0f12' })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const mkTrain = (color) => { const grp = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 }); for (let i = 0; i < 6; i++) { const car = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 17), m); car.position.set(0, 1.9, i * 17.6); grp.add(car); } scene.add(grp); return grp; };
  const iryo = mkTrain('#7b4fb8'), alvia = mkTrain('#d8dde0');
  const sec = (s) => { const [h, m, x] = s.split(':').map(Number); return h * 3600 + m * 60 + x; };
  function update({ lineAt, p, local }) {
    const k = lineAt(0), s0 = sec('19:43:29'); const tt = s0 + 13 * k;
    iryo.position.set(-1.5, 0, lerp(-260, 40, k)); alvia.position.set(1.5, 0, lerp(200, -40, k)); alvia.rotation.y = Math.PI;
    iryo.children.slice(3).forEach((c, i) => { const d = clamp((tt - sec('19:43:34')) / 6); c.rotation.z = d * (0.25 + i * 0.12); c.position.x = d * (1.5 + i * 0.6); });
    const a = 0.5 + local * 0.03; camera.position.set(Math.cos(a) * 60, 26, Math.sin(a) * 60 - 20); camera.lookAt(0, 2, -20);
  }
  function overlay({ lineAt, local }) {
    if (!st.ev) return; const a = ease(seg(local, 0.5, 1.5)); g.save(); g.fillStyle = `rgba(3,6,10,${0.6 * a})`; g.fillRect(0, 230, W, 620); g.restore();
    const axis = (y, t0, t1, evs, k, title, total) => {
      const x0 = 160, x1 = W - 160; text(title, x0, y - 70, { px: 26, w: 600, alpha: a }); text(total, x1, y - 70, { px: 40, w: 650, align: 'right', color: C.sun, alpha: a * clamp(k * 3) });
      g.save(); g.globalAlpha = a; g.strokeStyle = 'rgba(147,167,177,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      const cx = lerp(x0, x1, k); g.strokeStyle = C.sky; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y); g.lineTo(cx, y); g.stroke(); g.restore();
      evs.forEach((e, i) => { const f = (sec(e.t) - t0) / (t1 - t0); if (f > k + 0.001) return; const x = lerp(x0, x1, f), up = i % 2 === 0; g.save(); g.globalAlpha = a; g.fillStyle = e.c; g.fillRect(x - 6, y - 6, 12, 12); g.restore();
        text(e.t, x, y + (up ? -22 : 44), { px: 18, w: 500, color: C.gray, align: 'center', mono: true, alpha: a }); text(e.s, x, y + (up ? -44 : 70), { px: 20, w: 600, align: 'center', alpha: a }); });
    };
    axis(400, sec('19:43:29'), sec('19:43:42'), [{ t: '19:43:29', s: 'primera anomalía (Iryo)', c: C.sun }, { t: '19:43:34', s: 'descarrila · PK 318,681', c: C.rose }, { t: '19:43:37', s: 'se cierra la señal S613', c: C.sky }, { t: '19:43:38', s: 'freno de emergencia (Alvia)', c: C.sky }, { t: '19:43:42', s: 'choque', c: C.rose }], lineAt(0), 'De la primera anomalía al choque', '13 s');
    const k2 = clamp(lineAt(1) * 0.3 + lineAt(2) * 0.7);
    if (lineAt(1) > 0) axis(700, sec('19:43:42'), sec('20:16:29'), [{ t: '19:44:51', s: '1.ª llamada al 112 · +69 s', c: C.mint }, { t: '19:47:06', s: 'el aviso solo da la posición del Iryo', c: C.sun }, { t: '20:07:01', s: 'dudas sobre un segundo tren', c: C.sun }, { t: '20:16:29', s: 'confirmado: segundo tren descarrilado', c: C.rose }], k2, 'Del choque a confirmar el segundo tren', '32 min 47 s');
  }
  return { scene, camera, update, overlay, ready };
}

export const worldKinds = { title: network, end: network, dana, rail, ...techKinds };

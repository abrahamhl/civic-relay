// Caso del arcén: furgoneta parada, taxi detrás y un tercer coche que choca contra ambos. Reconstrucción ILUSTRATIVA.
// Movimiento tras el golpe con física simple y declarada: choques plásticos (conservación del momento) y rozamiento μ·g.
// Masas, velocidad y μ son SUPUESTOS ilustrativos (no medidos): se dicen en pantalla.
import { THREE, C, g, W, H, ease, clamp, lerp, seg, text, panel, project } from './kit.mjs';
import { makeRoad } from './scenes-road.mjs';
import { makeCar, makeVan, makeTaxi, lamp } from './models.mjs';
import { clusterCrashes, clusterIconSvg } from '/investor-next/public/senda/core/crash-cluster.mjs';

export const ASSUMED = Object.freeze({ mCar: 1400, mTaxi: 1500, mVan: 2500, vKmh: 120, mu: 0.7, gapM: 1.0, slowmo: 4 });
const G0 = 9.81, X_SH = 6.8, Z_VAN = -100, L_VAN = 5.2, L_CAR = 4.4;
const zTaxi0 = Z_VAN + L_VAN / 2 + ASSUMED.gapM + L_CAR / 2, zCarHit = zTaxi0 + L_CAR;
// Física: 1) coche + taxi con v1 = m3·v/(m2+m3); 2) tras recorrer el hueco, los tres con v2 = (m2+m3)·v(t1)/M; 3) rozamiento hasta parar.
const v0 = ASSUMED.vKmh / 3.6, a = ASSUMED.mu * G0, M = ASSUMED.mCar + ASSUMED.mTaxi + ASSUMED.mVan;
const v1 = (ASSUMED.mCar * v0) / (ASSUMED.mCar + ASSUMED.mTaxi);
const t1 = (v1 - Math.sqrt(v1 * v1 - 2 * a * ASSUMED.gapM)) / a, vAt1 = v1 - a * t1;
const v2 = ((ASSUMED.mCar + ASSUMED.mTaxi) * vAt1) / M, t2 = v2 / a, slide = (v2 * v2) / (2 * a);
export const PHYS = Object.freeze({ v1: +v1.toFixed(1), v2: +v2.toFixed(1), slideM: +slide.toFixed(1), totalS: +(t1 + t2).toFixed(2) });

function poses(ts) { // ts: segundos de simulación desde el golpe (negativo = antes)
  const car = { x: X_SH - 0.35, z: zCarHit, yaw: 0 }, taxi = { x: X_SH, z: zTaxi0, yaw: 0 }, van = { x: X_SH, z: Z_VAN, yaw: 0 };
  if (ts < 0) { car.z = zCarHit - v0 * ts; const drift = clamp(1 + ts / 2.2); car.x = lerp(3.5, X_SH - 0.35, ease(drift)); car.yaw = -0.05 * Math.sin(drift * Math.PI); return { car, taxi, van, stage: 0 }; }
  if (ts < t1) { const s = v1 * ts - (a * ts * ts) / 2; taxi.z -= s; car.z -= s; car.yaw = 0.12 * (ts / t1); return { car, taxi, van, stage: 1 }; }
  const tt = Math.min(ts - t1, t2), s = v2 * tt - (a * tt * tt) / 2, k = s / slide;
  taxi.z -= ASSUMED.gapM + s; car.z -= ASSUMED.gapM + s; van.z -= s; car.yaw = 0.12 + 0.16 * k; taxi.yaw = -0.08 * k; van.yaw = 0.05 * k; car.x -= 0.25 * k;
  return { car, taxi, van, stage: ts < t1 + t2 ? 2 : 3 };
}
function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const debrisGeo = new THREE.BoxGeometry(0.08, 0.04, 0.12);

function shoulder({ sc }) {
  const phase = sc.visual.phase;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0a1016'); scene.fog = new THREE.Fog('#0a1016', 40, phase === 'behind' ? 420 : 260);
  scene.add(new THREE.HemisphereLight('#8fa9bf', '#11161a', 0.7));
  const sun = new THREE.DirectionalLight('#ffb27a', 0.55); sun.position.set(60, 18, -120); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 800);
  makeRoad(scene);
  const van = makeVan('#c3c9cd'), taxi = makeTaxi(), car = makeCar('#5b6770'); scene.add(van, taxi, car);
  taxi.userData.beam.intensity = 10; car.userData.beam.intensity = 25; // a 5 m de distancia, el haz completo satura la trasera de la furgoneta
  const debris = new THREE.Group(); const dm = [new THREE.MeshStandardMaterial({ color: '#9aa4aa', metalness: 0.7, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: '#d33', emissive: '#400' }), new THREE.MeshStandardMaterial({ color: '#cfe3ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.7 })];
  for (let i = 0; i < 70; i++) debris.add(new THREE.Mesh(debrisGeo, dm[i % 3])); scene.add(debris);
  const flash = lamp('#ffffff', 0.1); scene.add(flash);
  const traffic = []; for (let i = 0; i < 6; i++) { const c = makeCar(['#c7ccd1', '#2d4a66', '#8a3b3b', '#d6d0c4', '#3d3d3d', '#6b5a3a'][i]); scene.add(c); traffic.push(c); }
  const rings = []; for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 96), new THREE.MeshBasicMaterial({ color: C.sky, transparent: true, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; scene.add(r); rings.push(r); }
  const place = (o, p) => { o.position.set(p.x, 0, p.z); o.rotation.y = p.yaw; };
  const fin = poses(99);
  const labels = []; let iconImg = null, cluster = null;
  // Tres móviles (uno por vehículo) con error de GPS ILUSTRATIVO; la fusión la hace el código real de SENDA.
  const toLL = (x, z) => ({ lat: 50.85 + (-z) / 111320, lon: 4.35 + x / (111320 * Math.cos(50.85 * Math.PI / 180)) });
  const phones = [{ id: 'furgoneta', o: fin.van, err: [1.5, -2.0], accM: 5, lane: 'SHOULDER' }, { id: 'taxi', o: fin.taxi, err: [-3.0, 4.0], accM: 8, lane: 'SHOULDER' }, { id: 'coche', o: fin.car, err: [4.0, 6.5], accM: 12, lane: 'RIGHT_LANE' }];
  const dets = phones.map((p, i) => ({ id: p.id, vehicle: p.id, tS: 100 + i * 0.4, accM: p.accM, lane: p.lane, state: 'LIKELY_CRASH', ...toLL(p.o.x + p.err[0], p.o.z + p.err[1]) }));
  cluster = clusterCrashes(dets, { windowS: 600, radiusM: 50 })[0];
  const fusedX = (cluster.lon - 4.35) * 111320 * Math.cos(50.85 * Math.PI / 180), fusedZ = -(cluster.lat - 50.85) * 111320;
  const ready = new Promise((ok) => { const im = new Image(); im.onload = () => { iconImg = im; ok(); }; im.onerror = () => ok(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clusterIconSvg(cluster, 120)); });

  function update({ local, p }) {
    labels.length = 0; debris.visible = false; flash.visible = false; traffic.forEach((c) => (c.visible = false)); rings.forEach((r) => (r.visible = false));
    const blinkOn = Math.floor(local * 2.4) % 2 === 0; van.userData.blink.forEach((b) => (b.visible = blinkOn));
    if (phase === 'intro') {
      // la furgoneta ya está en el arcén; el taxi llega y se detiene detrás
      const tt = clamp(local / 9), zt = lerp(zTaxi0 + 120, zTaxi0, 1 - (1 - tt) ** 2), xt = lerp(3.5, X_SH, ease(clamp((tt - 0.35) / 0.6)));
      place(van, fin.van); van.position.z = Z_VAN; van.rotation.y = 0; place(taxi, { x: xt, z: zt, yaw: -0.08 * Math.sin(ease(clamp((tt - 0.35) / 0.6)) * Math.PI) });
      taxi.userData.blink.forEach((b) => (b.visible = tt > 0.95 && blinkOn)); car.visible = false;
      traffic.slice(0, 4).forEach((c, i) => { c.visible = true; place(c, { x: [-3.5, 0, 3.5, 0][i], z: Z_VAN + 160 - ((local * (22 + i * 3) + i * 70) % 320), yaw: 0 }); });
      const k = ease(p); camera.position.set(lerp(16, 10, k), lerp(6, 3.2, k), Z_VAN + lerp(30, 20, k)); camera.lookAt(X_SH - 1, 1, Z_VAN + 2);
      if (p > 0.55) { labels.push({ v: van.position.clone().setY(3.2), s: 'furgoneta · arcén derecho', c: C.sun }); labels.push({ v: taxi.position.clone().setY(2.4), s: 'taxi · detrás, en el arcén', c: C.sun }); }
    } else if (phase === 'crash') {
      // 4 s a velocidad real hasta el golpe; después, cámara lenta ×slowmo
      const hit = 4.2, ts = local < hit ? local - hit : (local - hit) / ASSUMED.slowmo, P = poses(ts);
      place(car, P.car); place(taxi, P.taxi); place(van, P.van); car.visible = true;
      taxi.userData.blink.forEach((b) => (b.visible = blinkOn)); car.userData.blink.forEach((b) => (b.visible = P.stage === 3 && blinkOn));
      if (ts >= 0) {
        debris.visible = true; debris.children.forEach((m, i) => { const src = i < 40 ? 0 : t1, age = ts - src; if (age < 0) { m.visible = false; return; } m.visible = true;
          const vx = (rnd(i) - 0.5) * 9, vy = 2 + rnd(i + 3) * 5, vz = -(4 + rnd(i + 7) * 10), y = Math.max(0.03, 0.8 + vy * age - (G0 * age * age) / 2), tl = Math.min(age, (vy + Math.sqrt(vy * vy + 2 * G0 * 0.8)) / G0);
          m.position.set(X_SH + vx * tl * 0.6, y, (i < 40 ? zCarHit - L_CAR / 2 : zTaxi0 - L_CAR / 2 - ASSUMED.gapM) + vz * tl * 0.5); m.rotation.set(age * 9 * rnd(i), age * 7, 0); });
        const fl = Math.max(seg(ts, 0, 0.06) * (1 - seg(ts, 0.06, 0.25)), seg(ts, t1, t1 + 0.05) * (1 - seg(ts, t1 + 0.05, t1 + 0.25)));
        if (fl > 0) { flash.visible = true; flash.position.set(X_SH, 1, ts < t1 + 0.02 ? zCarHit - L_CAR / 2 : zTaxi0 - L_CAR / 2 - ASSUMED.gapM); flash.scale.setScalar(9 * fl); }
      }
      const cz = (car.position.z + van.position.z) / 2;
      if (local < hit) { camera.position.set(-1.5, 1.4, Z_VAN + 26 + (hit - local) * 2); camera.lookAt(X_SH - 0.5, 1, Z_VAN); }
      else { const k = ease(seg(local, hit, hit + 6)), ang = lerp(0.25, 1.15, k); camera.position.set(X_SH + Math.cos(ang) * 17, lerp(6.5, 9.5, k), cz + Math.sin(ang) * 17); camera.lookAt(X_SH, 0.8, cz); }
      if (P.stage === 3) { labels.push({ v: car.position.clone().setY(2.3), s: 'coche · invade el arcén', c: C.rose }); labels.push({ v: taxi.position.clone().setY(2.6), s: 'taxi · empujado', c: C.sun }); labels.push({ v: van.position.clone().setY(3.3), s: `furgoneta · arrastrada ${PHYS.slideM.toFixed(1).replace('.', ',')} m`, c: C.sun }); }
    } else {
      place(car, fin.car); place(taxi, fin.taxi); place(van, fin.van); car.visible = true;
      [taxi, car].forEach((o) => o.userData.blink.forEach((b) => (b.visible = blinkOn)));
      if (phase === 'phones') {
        phones.forEach((ph, i) => { const r = rings[i], a2 = (local * 0.7 + i / 3) % 1; r.visible = local < 9; r.material.color.set(C.rose); r.material.opacity = (1 - a2) * 0.7; r.scale.setScalar(1 + a2 * 5); r.position.set(ph.o.x + ph.err[0], 0.06, ph.o.z + ph.err[1]); });
        const k = ease(p); camera.position.set(X_SH + lerp(14, 4, k), lerp(14, 34, k), fin.taxi.z + lerp(18, 6, k)); camera.lookAt(X_SH, 0, fin.taxi.z);
      } else { // behind: los que vienen detrás reciben el aviso y se apartan del carril derecho
        rings.forEach((r, i) => { const a2 = (local * 0.35 + i / 6) % 1; r.visible = true; r.material.color.set(C.sky); r.material.opacity = (1 - a2) * 0.6; r.scale.setScalar(2 + a2 * 90); r.position.set(fusedX, 0.07, fusedZ); });
        traffic.forEach((c, i) => { c.visible = true; const zz = fin.car.z + 70 + i * 34 - ((local * 7) % 34), warned = zz - fin.car.z < 70 + ((local * 0.35) % 1) * 90 || local > 5;
          const lane = i % 3 === 0 ? 3.5 : i % 3 === 1 ? 0 : -3.5; place(c, { x: warned && lane === 3.5 ? lerp(3.5, 0, ease(clamp((70 + 90 - (zz - fin.car.z)) / 60))) : lane, z: zz, yaw: 0 });
          c.userData.paint.emissive = new THREE.Color(warned ? '#4a3000' : '#000000'); if (warned && i < 3) labels.push({ v: c.position.clone().setY(2.1), s: 'aviso recibido', c: C.sun }); });
        const k = ease(p); camera.position.set(-30, lerp(60, 48, k), fin.car.z + lerp(150, 120, k)); camera.lookAt(2, 0, fin.car.z + 40);
      }
    }
  }
  function overlay({ local, p, lineAt }) {
    for (const L of labels) { const q = project(L.v, camera); if (q.behind) continue; g.save(); g.fillStyle = L.c; g.fillRect(q.x - 6, q.y - 6, 12, 12); g.restore(); text(L.s, q.x + 16, q.y + 7, { px: 24, w: 600 }); }
    if (phase === 'crash') { const a2 = ease(seg(local, 4.6, 5.6)); if (a2 > 0) { panel(1300, 210, 524, 250, 0.8 * a2); text('Física del golpe · supuestos ilustrativos', 1326, 250, { px: 20, w: 600, color: C.sun, alpha: a2 });
      [`coche ${ASSUMED.mCar} kg a ${ASSUMED.vKmh} km/h · taxi ${ASSUMED.mTaxi} kg · furgoneta ${ASSUMED.mVan} kg`, `tras el primer golpe: ${PHYS.v1.toFixed(1).replace('.', ',')} m/s · tras el segundo: ${PHYS.v2.toFixed(1).replace('.', ',')} m/s`, `rozamiento μ = ${String(ASSUMED.mu).replace('.', ',')} → arrastre de ${PHYS.slideM.toFixed(1).replace('.', ',')} m en ${PHYS.totalS.toFixed(1).replace('.', ',')} s`, `cámara lenta ×${ASSUMED.slowmo}`].forEach((s, i) => text(s, 1326, 292 + i * 40, { px: 19, w: 500, alpha: a2 })); } }
    if (phase === 'phones') {
      const conv = ease(seg(lineAt(1), 0.1, 0.8));
      phones.forEach((ph, i) => { const q = project(new THREE.Vector3(ph.o.x + ph.err[0], 0.2, ph.o.z + ph.err[1]), camera), f = project(new THREE.Vector3(fusedX, 0.2, fusedZ), camera);
        const x = lerp(q.x, f.x, conv), y = lerp(q.y, f.y, conv); g.save(); g.globalAlpha = 1 - conv * 0.9; g.fillStyle = '#0c1318'; g.strokeStyle = C.rose; g.lineWidth = 3; g.beginPath(); g.roundRect(x - 16, y - 28, 32, 56, 7); g.fill(); g.stroke(); g.restore();
        if (conv < 0.3) text(`móvil ${i + 1} · GPS ± ${ph.accM} m`, x + 26, y + 6, { px: 21, w: 600, alpha: 1 - conv * 3 }); });
      if (conv > 0.6 && iconImg) { const f = project(new THREE.Vector3(fusedX, 0.2, fusedZ), camera), s = 120 * ease(seg(conv, 0.6, 1)); g.drawImage(iconImg, f.x - s / 2, f.y - s / 2, s, s); }
      const b = ease(seg(lineAt(2), 0, 0.3)); if (b > 0) { panel(96, 250, 640, 220, 0.85 * b); text('Calculado por el código real de SENDA', 122, 290, { px: 20, w: 600, color: C.sky, alpha: b });
        [`1 accidente · ×${cluster.devices} móviles · ${cluster.state === 'CORROBORATED' ? 'confirmado' : 'probable'}`, `posición combinada ± ${String(cluster.sigmaM).replace('.', ',')} m (pesos 1/σ²)`, `carril más peligroso declarado: ${cluster.lane === 'RIGHT_LANE' ? 'carril derecho' : 'arcén'}`, 'errores de GPS de este ejemplo: ilustrativos'].forEach((s, i) => text(s, 122, 336 + i * 36, { px: 22, w: 520, alpha: b, color: i === 3 ? C.gray : C.ink })); }
    }
    if (phase === 'behind') { const a2 = ease(seg(local, 1.2, 2.2)); panel(96, 230, 560, 200, 0.85 * a2); if (iconImg) g.drawImage(iconImg, 120, 254, 64, 64);
      text('Accidente · ×3', 200, 296, { px: 28, w: 650, alpha: a2 }); text('confirmado por 3 móviles SENDA distintos', 122, 350, { px: 20, w: 500, alpha: a2 }); text('vehículo en el carril derecho (declarado)', 122, 384, { px: 20, w: 500, alpha: a2 }); text('lo que ve en su mapa quien viene detrás', 122, 418, { px: 18, w: 500, alpha: a2, color: C.gray }); }
  }
  return { scene, camera, update, overlay, ready, envIntensity: 0.25 };
}
export const arcenKinds = { shoulder };

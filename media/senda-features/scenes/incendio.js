import {
  TAU, PALETTE, clamp, lerp, smooth, mulberry32, addStars, addDust,
  glowSprite, textSprite, curveLine, cameraKeys, fitSprite, ringWave, cylinderBetween,
} from './common.js';
import { syntheticLandscape, arrivalTimes, assessAssets } from '../../../investor-next/public/senda/core/wildfire.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HM = (min) => {
  if (!Number.isFinite(min)) return '—';
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};

export default {
  id: 'incendio',
  title: 'El fuego llega antes que la señal',
  duration: 13.2,
  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(20260723);
    scene.fog = new THREE.FogExp2(0x0b1518, 0.011);

    scene.add(new THREE.HemisphereLight(0xa6d9e5, 0x0a0d0b, 0.9));
    const sun = new THREE.DirectionalLight(0xffc98f, 2.2);
    sun.position.set(-34, 40, 22);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x3b9bb2, 1.2);
    rim.position.set(28, 18, -26);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x5a7c80, 0.38));

    addStars(scene, 420, 220, 9);
    addDust(scene, 180, 64, 0x9cb7ae, 21);

    const land = syntheticLandscape({ seed: 5 });
    const G = land.grid, W = G.w, H = G.h, S = 0.62;
    const T = arrivalTimes(G, [{ x: 30, y: 20 }], { windKmh: 30, windToDeg: 15 }, { maxMin: 720 });
    const assets = assessAssets(G, T, land.towns, land.towers);
    const townA = assets.find((a) => a.id === 'A');
    const townB = assets.find((a) => a.id === 'B');
    const townC = assets.find((a) => a.id === 'C');

    let eMin = Infinity, eMax = -Infinity;
    for (let i = 0; i < G.elev.length; i++) { eMin = Math.min(eMin, G.elev[i]); eMax = Math.max(eMax, G.elev[i]); }
    const heightOf = (i) => 0.3 + ((G.elev[i] - eMin) / (eMax - eMin)) * 6.4 + (G.fuel[i] === 0 ? -0.24 : 0);
    const gx = (x) => (x - W / 2) * S;
    const gz = (y) => (y - H / 2) * S;
    const at = (x, y) => {
      const xx = clamp(Math.round(x), 0, W - 1), yy = clamp(Math.round(y), 0, H - 1);
      return heightOf(yy * W + xx);
    };

    const fuelColor = { 0: 0x1f5a7a, 1: 0xa4945f, 2: 0x66713f, 3: 0x314d37, 4: 0x8d8a82, 5: 0xc3beb1 };
    const terrainPos = [], terrainCol = [], terrainUv = [], terrainIdx = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const h = heightOf(i);
        terrainPos.push(gx(x), h, gz(y));
        terrainUv.push(x / (W - 1), 1 - y / (H - 1));
        const base = new THREE.Color(fuelColor[G.fuel[i]]);
        const shade = 0.72 + 0.26 * ((G.elev[i] - eMin) / (eMax - eMin)) + (rnd() - 0.5) * 0.08;
        base.multiplyScalar(shade);
        terrainCol.push(base.r, base.g, base.b);
      }
    }
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const a = y * W + x, b = a + 1, c = a + W, d = c + 1;
        terrainIdx.push(a, c, b, b, c, d);
      }
    }
    const terrainGeo = new THREE.BufferGeometry();
    terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(terrainPos, 3));
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainCol, 3));
    terrainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(terrainUv, 2));
    terrainGeo.setIndex(terrainIdx);
    terrainGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04, flatShading: true }));
    scene.add(terrain);

    const burnCanvas = document.createElement('canvas');
    burnCanvas.width = W; burnCanvas.height = H;
    const bctx = burnCanvas.getContext('2d');
    const burnTex = new THREE.CanvasTexture(burnCanvas);
    burnTex.magFilter = THREE.NearestFilter;
    burnTex.minFilter = THREE.NearestFilter;
    burnTex.colorSpace = THREE.SRGBColorSpace;
    const burnPos = terrainPos.map((v, i) => (i % 3 === 1 ? v + 0.055 : v));
    const burnGeo = new THREE.BufferGeometry();
    burnGeo.setAttribute('position', new THREE.Float32BufferAttribute(burnPos, 3));
    burnGeo.setAttribute('uv', new THREE.Float32BufferAttribute(terrainUv, 2));
    burnGeo.setIndex(terrainIdx);
    const burnMesh = new THREE.Mesh(burnGeo, new THREE.MeshBasicMaterial({ map: burnTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false }));
    burnMesh.renderOrder = 4;
    scene.add(burnMesh);

    const riverPts = [];
    for (let x = 0; x < W; x += 2) {
      const y = 40 + 6 * Math.sin(x / 9);
      riverPts.push(V(gx(x), at(x, y) + 0.18, gz(y)));
    }
    const river = curveLine(riverPts, 0x4cb9d1, 0.62);
    scene.add(river.line);
    const riverGlow = curveLine(riverPts.map((p) => p.clone().setY(p.y + 0.08)), 0x91d7e8, 0.16);
    scene.add(riverGlow.line);

    const roadPts = [];
    for (let y = 0; y < 38; y += 2) roadPts.push(V(gx(55), at(55, y) + 0.2, gz(y)));
    const road = curveLine(roadPts, 0xf3c56c, 0.48, true);
    scene.add(road.line);

    const townGroups = [];
    for (const town of land.towns) {
      const g = new THREE.Group();
      const base = new THREE.Vector3(gx(town.x), at(town.x, town.y), gz(town.y));
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, r = (0.22 + rnd() * 0.8) * town.r * S * 1.5;
        const bw = 0.34 + rnd() * 0.42, bh = 0.24 + rnd() * 0.55, bd = 0.34 + rnd() * 0.4;
        const mat = new THREE.MeshStandardMaterial({ color: i % 4 === 0 ? 0x7a5a42 : i % 3 === 0 ? 0x465760 : 0x5b6770, roughness: 0.78, metalness: 0.12, emissive: 0x110b07, emissiveIntensity: 0.3 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
        b.position.set(base.x + Math.cos(a) * r, base.y + bh / 2 + 0.05, base.z + Math.sin(a) * r);
        b.rotation.y = rnd() * TAU;
        g.add(b);
        if (i % 3 === 0) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.28, bh * 0.16), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.7, toneMapped: false, side: THREE.DoubleSide }));
          win.position.set(b.position.x + Math.cos(a + Math.PI / 2) * (bw / 2 + 0.01), b.position.y + bh * 0.12, b.position.z + Math.sin(a + Math.PI / 2) * (bw / 2 + 0.01));
          win.rotation.y = -a + Math.PI / 2;
          g.add(win);
        }
      }
      const halo = glowSprite(town.id === 'A' ? PALETTE.coral : PALETTE.amber, 2.8, 0.3);
      halo.position.set(base.x, base.y + 0.8, base.z);
      g.add(halo);
      const ring = ringWave(town.id === 'A' ? PALETTE.coral : PALETTE.amber, 2.1, 0.34);
      ring.position.set(base.x, base.y + 0.12, base.z);
      g.add(ring);
      const name = textSprite(town.name.toUpperCase(), { size: 30, scale: 0.22, color: town.id === 'A' ? '#ffd0c4' : '#d9f7ff', border: 'rgba(145,215,232,0.28)', bg: 'rgba(4,14,18,0.72)', mono: true });
      name.position.set(base.x, base.y + 3.0, base.z);
      g.add(name);
      const pop = textSprite(`${town.population} HAB.`, { size: 24, scale: 0.18, color: '#9fb2bc', bg: 'rgba(4,14,18,0.66)', border: 'rgba(145,215,232,0.16)', mono: true });
      pop.position.set(base.x, base.y + 2.5, base.z);
      g.add(pop);
      scene.add(g);
      townGroups.push({ g, town, base, halo, ring, name, pop });
    }

    const towers = [];
    const towerLoss = land.towers.map((tw) => {
      let m = Infinity;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = tw.x + dx, y = tw.y + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) m = Math.min(m, T[y * W + x]);
      }
      return m - 10;
    });
    land.towers.forEach((tw, idx) => {
      const g = new THREE.Group();
      const base = new THREE.Vector3(gx(tw.x), at(tw.x, tw.y), gz(tw.y));
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x7d98a1, roughness: 0.36, metalness: 0.78 });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.11, 5.0, 8), mastMat);
      mast.position.set(base.x, base.y + 2.5, base.z);
      g.add(mast);
      for (let k = 1; k <= 3; k++) {
        const cross = new THREE.Mesh(new THREE.BoxGeometry(1.0 - k * 0.12, 0.035, 0.035), mastMat);
        cross.position.set(base.x, base.y + 1.4 + k * 1.05, base.z);
        g.add(cross);
      }
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: PALETTE.emerald, transparent: true, opacity: 0.95, toneMapped: false }));
      beacon.position.set(base.x, base.y + 5.1, base.z);
      g.add(beacon);
      const halo = glowSprite(PALETTE.emerald, 1.3, 0.55);
      halo.position.set(base.x, base.y + 5.1, base.z);
      g.add(halo);
      const label = textSprite(tw.id, { size: 26, scale: 0.19, color: '#baf5d9', border: 'rgba(52,211,153,0.3)', bg: 'rgba(4,14,18,0.7)', mono: true });
      label.position.set(base.x, base.y + 6.0, base.z);
      g.add(label);
      const danger = textSprite('CAÍDA', { size: 24, scale: 0.18, color: '#ffd0c4', border: 'rgba(255,91,110,0.4)', bg: 'rgba(28,8,12,0.82)', mono: true });
      danger.position.set(base.x, base.y + 5.5, base.z);
      danger.visible = false;
      g.add(danger);
      scene.add(g);
      towers.push({ g, tw, base, beacon, halo, label, danger, loss: towerLoss[idx] });
    });

    const critical = towers.find((t) => t.tw.id === 'T2');
    const ignition = new THREE.Group();
    const ix = gx(30), iz = gz(20), iy = at(30, 20);
    const igRing = ringWave(PALETTE.coral, 1.8, 0.7);
    igRing.position.set(ix, iy + 0.16, iz);
    ignition.add(igRing);
    const igGlow = glowSprite(PALETTE.amber, 3.0, 0.6);
    igGlow.position.set(ix, iy + 0.8, iz);
    ignition.add(igGlow);
    const igLabel = textSprite('IGNICIÓN · T+0', { size: 26, scale: 0.2, color: '#ffe0a8', border: 'rgba(251,191,36,0.35)', bg: 'rgba(28,18,4,0.78)', mono: true });
    igLabel.position.set(ix, iy + 2.0, iz);
    ignition.add(igLabel);
    scene.add(ignition);

    const frontGeo = new THREE.BufferGeometry();
    const frontCount = 220;
    const frontPos = new Float32Array(frontCount * 3);
    const frontCol = new Float32Array(frontCount * 3);
    frontGeo.setAttribute('position', new THREE.BufferAttribute(frontPos, 3));
    frontGeo.setAttribute('color', new THREE.BufferAttribute(frontCol, 3));
    const frontPts = new THREE.Points(frontGeo, new THREE.PointsMaterial({ size: 1.5, map: null, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false }));
    frontPts.frustumCulled = false;
    scene.add(frontPts);

    const smokeCount = 150;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePos = new Float32Array(smokeCount * 3);
    const smokeCol = new Float32Array(smokeCount * 3);
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    smokeGeo.setAttribute('color', new THREE.BufferAttribute(smokeCol, 3));
    const smokePts = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ size: 4.8, vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false, sizeAttenuation: true }));
    smokePts.frustumCulled = false;
    scene.add(smokePts);

    const evacPts = [];
    for (const [x, y] of [[70, 20], [77, 13], [86, 7], [95, 2]]) evacPts.push(V(gx(x), at(x, y) + 0.25, gz(y)));
    const evac = curveLine(evacPts, PALETTE.emerald, 0.78);
    evac.line.material.depthTest = false;
    evac.line.renderOrder = 12;
    scene.add(evac.line);
    const evacGlow = curveLine(evacPts.map((p) => p.clone().setY(p.y + 0.16)), 0xd5fff0, 0.2);
    evacGlow.line.material.depthTest = false;
    evacGlow.line.renderOrder = 11;
    scene.add(evacGlow.line);
    const evacLabel = textSprite('RUTA DE EVACUACIÓN', { size: 24, scale: 0.2, color: '#c6f7e6', border: 'rgba(52,211,153,0.35)', bg: 'rgba(4,18,12,0.76)', mono: true });
    evacLabel.position.set(gx(82), at(82, 10) + 2.2, gz(10));
    scene.add(evacLabel);

    const alertCard = new THREE.Group();
    const ax = gx(70), az = gz(20), ay = at(70, 20);
    const cardGlow = glowSprite(PALETTE.coral, 4.2, 0.32);
    cardGlow.position.set(ax, ay + 4.8, az);
    alertCard.add(cardGlow);
    const lines = [
      ['VALDEOLMOS', '#ffd0c4', 0.23, 6.9],
      [`AVISO ≤ T+${HM(townA.deadlineMin)}`, '#ffe0a8', 0.21, 6.1],
      [`ANTENA ${HM(townA.commsLossMin)}`, '#ffb6a7', 0.2, 5.4],
      [`${townA.population} HAB.`, '#baf5d9', 0.17, 4.8],
    ];
    for (const [text, color, scale, y] of lines) {
      const s = textSprite(text, { size: 28, scale, color, border: 'rgba(255,119,86,0.25)', bg: 'rgba(12,10,10,0.7)', mono: true });
      s.position.set(ax, ay + y, az);
      alertCard.add(s);
    }
    scene.add(alertCard);

    const windLabel = textSprite('VIENTO 30 KM/H · HACIA 15°', { size: 24, scale: 0.2, color: '#cfeef5', border: 'rgba(145,215,232,0.28)', bg: 'rgba(4,14,18,0.72)', mono: true });
    windLabel.position.set(gx(10), at(10, 12) + 4.2, gz(12));
    scene.add(windLabel);
    const windArrows = [];
    for (let i = 0; i < 3; i++) {
      const y = 10 + i * 9;
      const pts = [V(gx(2), at(2, y) + 2.2, gz(y)), V(gx(17), at(17, y + 2) + 2.2, gz(y + 2)), V(gx(27), at(27, y + 3) + 2.2, gz(y + 3))];
      const w = curveLine(pts, PALETTE.ice, 0.24);
      scene.add(w.line);
      windArrows.push(w.line);
    }

    const chapters = [
      {
        start: 0,
        end: 4.4,
        kicker: '01 · EL FUEGO LLEGA ANTES',
        title: 'El frente corre con viento y pendiente',
        subtitle: 'Tres poblaciones y cinco antenas. La alerta depende del fuego y de la cobertura, no solo del reloj.',
        metrics: [
          { value: '3', label: 'poblaciones', tone: 'ice' },
          { value: '5', label: 'antenas', tone: 'ice' },
          { value: '30', label: 'km/h de viento', tone: 'amber' },
        ],
      },
      {
        start: 4.4,
        end: 8.8,
        kicker: '02 · ANTENAS QUE CAEN',
        title: 'La cobertura se apaga antes que el pueblo',
        subtitle: `Valdeolmos: el fuego llega a T+${HM(townA.arrivalMin)}; el aviso debe salir antes de T+${HM(townA.deadlineMin)}; la antena T2 cae a T+${HM(townA.commsLossMin)}.`,
        metrics: [
          { value: HM(townA.commsLossMin), label: 'antena T2 cae', tone: 'coral' },
          { value: HM(townA.deadlineMin), label: 'límite de aviso', tone: 'amber' },
          { value: '107', label: 'min de margen perdido', tone: 'coral' },
        ],
      },
      {
        start: 8.8,
        end: 13.2,
        kicker: '03 · EVACUAR, NO DIRIGIR',
        title: 'Avisar por red o por portadores',
        subtitle: `Si la antena cae antes, el plan sin red reparte el aviso: ${townA.offlinePlan.k} de ${townA.offlinePlan.n} fragmentos, ${(townA.offlinePlan.pDelivery * 100).toFixed(1)}% de entrega.`,
        metrics: [
          { value: `${(townA.offlinePlan.pDelivery * 100).toFixed(1)}%`, label: 'entrega sin red', tone: 'emerald' },
          { value: `${townA.offlinePlan.k}/${townA.offlinePlan.n}`, label: 'fragmentos k-de-n', tone: 'violet' },
          { value: '0', label: 'extinción dirigida', tone: 'coral' },
        ],
      },
    ];

    const cameraPlan = [
      { t: 0, pos: [-24, 33, 31], look: [3, 0, 2], fov: 42 },
      { t: 3.4, pos: [-12, 18, 18], look: [9, 1, 1], fov: 43 },
      { t: 6.6, pos: [7, 13, 16], look: [16, 1, 5], fov: 42 },
      { t: 9.4, pos: [18, 14, 21], look: [19, 1, 8], fov: 43 },
      { t: 13.2, pos: [-8, 38, 27], look: [7, 0, 3], fov: 41 },
    ];

    let frontCells = [];
    let lastSim = -1;
    let lastFrontKey = '';
    const updateFront = (simMin) => {
      const active = [];
      for (let i = 0; i < T.length; i++) {
        const tt = T[i];
        if (tt <= simMin && tt > simMin - 55) active.push(i);
      }
      frontCells = active;
    };

    return {
      duration: 13.2,
      chapters,
      update(t) {
        cameraKeys(camera, t, cameraPlan);
        const u = smooth(0, 13.2, clamp(t, 0, 13.2));
        const simMin = 18 + 342 * u;

        if (Math.abs(simMin - lastSim) > 3 || frontCells.length === 0) {
          lastSim = simMin;
          updateFront(simMin);
          bctx.clearRect(0, 0, W, H);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const tt = T[y * W + x];
            if (!Number.isFinite(tt) || tt > simMin) continue;
            const age = simMin - tt;
            bctx.fillStyle = age < 28 ? 'rgba(255,112,34,0.92)' : age < 95 ? 'rgba(184,62,30,0.78)' : 'rgba(42,28,25,0.8)';
            bctx.fillRect(x, y, 1, 1);
          }
          burnTex.needsUpdate = true;
        }

        const key = frontCells.length + ':' + Math.floor(t * 8);
        if (key !== lastFrontKey) {
          lastFrontKey = key;
          const active = frontCells;
          for (let i = 0; i < frontCount; i++) {
            if (!active.length) {
              frontPos[i * 3 + 1] = -100;
              continue;
            }
            const cell = active[(i * 37 + Math.floor(t * 8) * 7) % active.length];
            const x = cell % W, y = (cell / W) | 0;
            const jitter = 0.18;
            frontPos[i * 3] = gx(x) + (rnd() - 0.5) * jitter;
            frontPos[i * 3 + 1] = heightOf(cell) + 0.4 + rnd() * 0.8;
            frontPos[i * 3 + 2] = gz(y) + (rnd() - 0.5) * jitter;
            const c = new THREE.Color().setHSL(0.015 + rnd() * 0.065, 1, 0.52 + rnd() * 0.18);
            frontCol[i * 3] = c.r; frontCol[i * 3 + 1] = c.g; frontCol[i * 3 + 2] = c.b;
          }
          frontGeo.attributes.position.needsUpdate = true;
          frontGeo.attributes.color.needsUpdate = true;
        }

        const windX = Math.cos((15 * Math.PI) / 180), windZ = Math.sin((15 * Math.PI) / 180);
        for (let i = 0; i < smokeCount; i++) {
          const age = (t * 0.18 + i * 0.037) % 1;
          const spread = 2.2 + age * 22;
          const sx = ix + windX * spread + Math.sin(i * 2.3 + t * 0.4) * age * 4;
          const sz = iz + windZ * spread + Math.cos(i * 1.7 + t * 0.3) * age * 4;
          const sy = iy + 0.8 + age * 14 + Math.sin(i + t) * 0.5;
          smokePos[i * 3] = sx; smokePos[i * 3 + 1] = sy; smokePos[i * 3 + 2] = sz;
          const v = 0.2 + age * 0.22;
          smokeCol[i * 3] = v; smokeCol[i * 3 + 1] = v * 0.96; smokeCol[i * 3 + 2] = v * 0.92;
        }
        smokeGeo.attributes.position.needsUpdate = true;
        smokeGeo.attributes.color.needsUpdate = true;
        smokePts.visible = frontCells.length > 0;

        for (const tg of townGroups) {
          tg.ring.rotation.z = t * 0.2;
          tg.halo.material.opacity = 0.24 + 0.13 * (0.5 + 0.5 * Math.sin(t * 2 + tg.town.x));
          fitSprite(tg.name, camera, 24, 0.07, 2.1);
          fitSprite(tg.pop, camera, 24, 0.06, 1.8);
        }
        for (const tw of towers) {
          const lost = Number.isFinite(tw.loss) && simMin >= tw.loss;
          tw.beacon.material.color.setHex(lost ? PALETTE.red : PALETTE.emerald);
          tw.halo.material.color.setHex(lost ? PALETTE.red : PALETTE.emerald);
          tw.halo.material.opacity = lost ? 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 7)) : 0.42 + 0.2 * (0.5 + 0.5 * Math.sin(t * 3 + tw.tw.x));
          tw.danger.visible = lost;
          tw.label.material.color.setHex(lost ? 0xffb6a7 : 0xbaf5d9);
          fitSprite(tw.label, camera, 24, 0.06, 1.9);
          if (tw.danger.visible) fitSprite(tw.danger, camera, 24, 0.06, 1.7);
        }
        if (critical) {
          const lost = Number.isFinite(critical.loss) && simMin >= critical.loss;
          const focus = lost ? 1 : 0;
          critical.g.scale.setScalar(1 + focus * 0.03 * (0.5 + 0.5 * Math.sin(t * 5)));
        }

        igRing.scale.setScalar(0.9 + 0.16 * Math.sin(t * 2.5));
        igRing.material.opacity = 0.32 + 0.26 * (0.5 + 0.5 * Math.sin(t * 3));
        igGlow.material.opacity = 0.28 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.2));
        fitSprite(igLabel, camera, 24, 0.06, 1.8);
        fitSprite(evacLabel, camera, 24, 0.06, 1.8);
        fitSprite(windLabel, camera, 28, 0.07, 2.0);
        for (const line of windArrows) line.material.opacity = 0.14 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.8));

        for (const s of alertCard.children) {
          if (s.isSprite) fitSprite(s, camera, 24, 0.06, 1.8);
        }
        cardGlow.material.opacity = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.1));

        burnMesh.material.opacity = 1;
        river.line.material.opacity = 0.5 + 0.08 * Math.sin(t * 0.9);
        riverGlow.line.material.opacity = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.2));
        road.line.material.opacity = 0.36 + 0.08 * Math.sin(t * 0.8);
      },
    };
  },
};

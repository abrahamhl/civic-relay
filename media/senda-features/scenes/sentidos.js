import {
  TAU, PALETTE, clamp, mulberry32, addStars, addDust,
  glowSprite, textSprite, makeTerrain, makePhone, curveLine, cameraKeys, fitSprite, ringWave, cylinderBetween,
} from './common.js';
import { chorusScenario, arvaGuide, kalman1d } from '../../../investor-next/public/senda/core/senses.mjs';
import { synthesizeCsi, analyzeCsi } from '../../../investor-next/public/senda/core/through-wall.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fmt1 = (x) => Number(x).toFixed(1).replace('.', ',');

function liveSprite(width, height, scale, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set((scale * width) / height, scale, 1);
  sp.renderOrder = 60;
  return { sp, canvas, tex, draw: () => { draw(g, width, height); tex.needsUpdate = true; } };
}

function makeRescuer() {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x20343c, roughness: 0.7, metalness: 0.2 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x2e4a50, roughness: 0.62, metalness: 0.18 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb88968, roughness: 0.8, metalness: 0.05 });
  const high = new THREE.MeshBasicMaterial({ color: PALETTE.coral, transparent: true, opacity: 0.9, toneMapped: false });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.62, 4, 10), suit);
  body.position.y = 1.22;
  g.add(body);
  const vestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.36), vest);
  vestMesh.position.y = 1.36;
  g.add(vestMesh);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.385), high);
  stripe.position.y = 1.38;
  g.add(stripe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 12), skin);
  head.position.y = 1.92;
  g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.225, 20, 12, 0, TAU, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: 0xd8b54a, roughness: 0.55, metalness: 0.2 }));
  helmet.position.y = 1.98;
  g.add(helmet);
  const lamp = glowSprite(0xffe8a9, 0.7, 0.85);
  lamp.position.set(0, 2.02, 0.2);
  g.add(lamp);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.13, 0.9, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.82, 8), suit);
    leg.position.y = -0.4;
    hip.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.26), new THREE.MeshStandardMaterial({ color: 0x11181b, roughness: 0.8 }));
    boot.position.set(0, -0.83, 0.05);
    hip.add(boot);
    g.add(hip);
    legs.push(hip);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.28, 1.55, 0);
    shoulder.rotation.z = s * 0.2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.62, 8), suit);
    arm.position.y = -0.3;
    shoulder.add(arm);
    g.add(shoulder);
    arms.push(shoulder);
  }
  const phone = makePhone(PALETTE.ice, 0x9be7f0);
  phone.scale.setScalar(0.5);
  phone.position.set(0.34, 1.16, 0.22);
  phone.rotation.set(-0.25, 0.3, 0.1);
  g.add(phone);
  g.userData.legs = legs;
  g.userData.arms = arms;
  g.userData.phone = phone;
  return g;
}

export default {
  id: 'sentidos',
  title: 'Ver lo invisible',
  duration: 13.8,
  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(20261107);
    scene.fog = new THREE.FogExp2(0x050b10, 0.0078);

    scene.add(new THREE.HemisphereLight(0x9cccda, 0x030706, 1.25));
    const key = new THREE.DirectionalLight(0xd8e9e7, 2.05);
    key.position.set(-24, 42, 30);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x3f8ca0, 1.55);
    rim.position.set(30, 16, -26);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x5b7b7d, 0.72));
    const lampA = new THREE.PointLight(0xffb089, 32, 42, 1.6);
    lampA.position.set(-22, 9, 5);
    scene.add(lampA);
    const lampB = new THREE.PointLight(0x91d7e8, 28, 34, 1.6);
    lampB.position.set(2, 7, 7);
    scene.add(lampB);
    const lampC = new THREE.PointLight(0x8fe3cf, 36, 34, 1.6);
    lampC.position.set(24, 7, 9);
    scene.add(lampC);

    addStars(scene, 500, 220, 19);
    addDust(scene, 240, 90, 0x91d7e8, 41);

    const groundAt = (x, z) => 0.11 * Math.sin(x * 0.17) + 0.08 * Math.cos(z * 0.23) + 0.05 * Math.sin((x + z) * 0.31);
    const terrain = makeTerrain(148, 86, 58, groundAt, 23, [0x0c1914, 0x162a22, 0x28382e]);
    scene.add(terrain);

    const chorus = chorusScenario();
    const errCm = Math.round(Math.hypot(chorus.fix.x - chorus.knock.x, chorus.fix.y - chorus.knock.y) * 100);
    const sigCm = Math.round(chorus.fix.sigmaM * 100);
    const obs = chorus.obs;
    const t0 = Math.min(...obs.map((o) => o.t));
    const rel = obs.map((o) => (o.t - t0) * 1000);

    const stationA = new THREE.Group();
    stationA.position.set(-22, groundAt(-22, 2), 2);
    scene.add(stationA);

    const mapA = (x, y) => ({ x: (x - 10) * 0.95, z: (y - 8) * 0.95 });
    const knockLocal = mapA(chorus.knock.x, chorus.knock.y);
    const fixLocal = mapA(chorus.fix.x, chorus.fix.y);
    const knockPos = V(knockLocal.x, 0.16, knockLocal.z);
    const fixPos = V(fixLocal.x, 0.22, fixLocal.z);

    const rubble = new THREE.Group();
    for (let i = 0; i < 86; i++) {
      const a = rnd() * TAU;
      const r = 1.2 + Math.pow(rnd(), 0.7) * 13.5;
      const x = knockLocal.x + Math.cos(a) * r;
      const z = knockLocal.z + Math.sin(a) * r;
      const w = 0.35 + rnd() * 1.4;
      const h = 0.22 + rnd() * 0.8;
      const d = 0.3 + rnd() * 1.2;
      const mat = new THREE.MeshStandardMaterial({ color: i % 4 === 0 ? 0x5b5147 : i % 4 === 1 ? 0x3b3732 : 0x2b2c29, roughness: 0.92, metalness: 0.04 });
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      chunk.position.set(x, h / 2 + 0.03, z);
      chunk.rotation.set(rnd() * 0.25, rnd() * TAU, rnd() * 0.25);
      rubble.add(chunk);
    }
    stationA.add(rubble);

    const phoneDefs = chorus.phones.map((p, i) => ({ ...mapA(p.x, p.y), i, rel: rel[i] }));
    const phoneNodes = [];
    for (const def of phoneDefs) {
      const node = new THREE.Group();
      node.position.set(def.x, 0.08, def.z);
      const phone = makePhone(PALETTE.ice, 0x8ee6f2);
      phone.position.y = 0.78;
      phone.rotation.set(-0.18, rnd() * 0.8 - 0.4, 0.14);
      phone.scale.setScalar(1.1);
      node.add(phone);
      const beacon = glowSprite(PALETTE.ice, 1.4, 0.55);
      beacon.position.y = 0.78;
      node.add(beacon);
      const label = textSprite(`M${def.i + 1} · +${fmt1(def.rel)} ms`, {
        size: 84, width: 1200, height: 140, scale: 0.5, color: '#e5f8ff', border: 'rgba(145,215,232,0.4)', bg: 'rgba(4,14,18,0.82)', mono: true,
      });
      label.position.set(def.x + (knockLocal.x - def.x) * 0.18, 1.85, def.z + (knockLocal.z - def.z) * 0.18);
      stationA.add(label);
      node.userData.label = label;
      node.userData.beacon = beacon;
      stationA.add(node);
      phoneNodes.push(node);

      const h = new THREE.BufferGeometry().setFromPoints([V(def.x, 0.24, def.z), fixPos]);
      const line = new THREE.Line(h, new THREE.LineDashedMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.16, dashSize: 0.28, gapSize: 0.22, toneMapped: false }));
      line.computeLineDistances();
      stationA.add(line);
    }

    const soundRings = [];
    for (let i = 0; i < 4; i++) {
      const ring = ringWave(PALETTE.coral, 1, 0);
      ring.position.set(knockPos.x, 0.18, knockPos.z);
      stationA.add(ring);
      soundRings.push({ ring, offset: i / 4 });
    }
    const syncRings = [];
    for (let i = 0; i < 3; i++) {
      const p = phoneDefs[4];
      const ring = ringWave(PALETTE.ice, 1, 0);
      ring.position.set(p.x, 0.14, p.z);
      stationA.add(ring);
      syncRings.push({ ring, offset: i / 3 });
    }

    const realMarker = ringWave(PALETTE.emerald, 0.34, 0.55);
    realMarker.position.set(knockPos.x, 0.2, knockPos.z);
    stationA.add(realMarker);
    const realLabel = textSprite('GOLPE REAL', { size: 84, width: 700, height: 140, scale: 0.5, color: '#baf5d9', border: 'rgba(52,211,153,0.36)', bg: 'rgba(4,18,12,0.78)', mono: true });
    realLabel.position.set(knockPos.x, 1.0, knockPos.z);
    stationA.add(realLabel);

    const fixMarker = new THREE.Group();
    fixMarker.position.set(fixPos.x, 0.22, fixPos.z);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 2.2, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: PALETTE.coral, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    beam.position.y = 1.1;
    fixMarker.add(beam);
    const crossMat = new THREE.MeshBasicMaterial({ color: PALETTE.coral, transparent: true, opacity: 0.95, toneMapped: false });
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.025), crossMat);
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.9), crossMat);
    fixMarker.add(crossA, crossB);
    const fixRing = ringWave(PALETTE.coral, 0.55, 0.4);
    fixRing.position.y = 0.02;
    fixMarker.add(fixRing);
    const fixGlow = glowSprite(PALETTE.coral, 1.1, 0.6);
    fixGlow.position.y = 2.2;
    fixMarker.add(fixGlow);
    stationA.add(fixMarker);
    const fixLabel = textSprite(`FIJACIÓN ${errCm} CM · ±${sigCm} CM`, {
      size: 84, width: 1500, height: 140, scale: 0.55, color: '#ffd0c4', border: 'rgba(255,119,86,0.4)', bg: 'rgba(22,10,8,0.84)', mono: true,
    });
    fixLabel.position.set(fixPos.x, 3.0, fixPos.z);
    stationA.add(fixLabel);
    const zoneLabel = textSprite('ZONA, NO PUNTO', { size: 84, width: 900, height: 140, scale: 0.5, color: '#b9c8cf', border: 'rgba(145,215,232,0.26)', bg: 'rgba(5,12,16,0.78)', mono: true });
    zoneLabel.position.set(fixPos.x + 1.2, 2.35, fixPos.z + 0.3);
    stationA.add(zoneLabel);

    const stationB = new THREE.Group();
    stationB.position.set(1, groundAt(1, 4), 4);
    scene.add(stationB);

    const pathPts = [V(-8, 0.08, 0.6), V(-3, 0.08, -1.0), V(2, 0.08, 1.2), V(5.8, 0.08, 0)];
    const pathCurve = new THREE.CatmullRomCurve3(pathPts);
    const pathLine = curveLine(pathPts, PALETTE.ice, 0.3, true);
    stationB.add(pathLine.line);
    const beaconPos = V(6, 0.28, 0);
    for (let i = 0; i < 38; i++) {
      const u = rnd();
      const p = pathCurve.getPointAt(u);
      const side = (rnd() - 0.5) * 3.6;
      const w = 0.22 + rnd() * 0.6;
      const h = 0.12 + rnd() * 0.4;
      const d = 0.2 + rnd() * 0.55;
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: i % 3 ? 0x34302b : 0x4a4137, roughness: 0.92 }));
      chunk.position.set(p.x + side, h / 2 + 0.02, p.z + (rnd() - 0.5) * 2.4);
      chunk.rotation.y = rnd() * TAU;
      stationB.add(chunk);
    }

    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 2.2), new THREE.MeshStandardMaterial({ color: 0x4d4a44, roughness: 0.9, metalness: 0.08 }));
    slab.position.set(6, 0.82, 0);
    slab.rotation.z = 0.08;
    stationB.add(slab);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), new THREE.MeshBasicMaterial({ color: PALETTE.coral, toneMapped: false }));
    beacon.position.copy(beaconPos);
    stationB.add(beacon);
    const beaconGlow = glowSprite(PALETTE.coral, 1.8, 0.8);
    beaconGlow.position.copy(beaconPos).add(V(0, 0.1, 0));
    stationB.add(beaconGlow);
    const beaconLabel = textSprite('BALIZA BLE', { size: 84, width: 800, height: 140, scale: 0.5, color: '#ffc4b7', border: 'rgba(255,119,86,0.36)', bg: 'rgba(22,10,8,0.8)', mono: true });
    beaconLabel.position.set(6, 1.55, 1.7);
    stationB.add(beaconLabel);

    const arvaRings = [];
    for (let i = 0; i < 4; i++) {
      const ring = ringWave(PALETTE.coral, 1, 0);
      ring.position.set(beaconPos.x, 0.18, beaconPos.z);
      stationB.add(ring);
      arvaRings.push({ ring, offset: i / 4 });
    }

    const rescuer = makeRescuer();
    rescuer.position.set(-8, 0, 0.6);
    stationB.add(rescuer);
    const rescuerLabel = textSprite('RESCATISTA', { size: 84, width: 900, height: 140, scale: 0.5, color: '#e5f8ff', border: 'rgba(145,215,232,0.3)', bg: 'rgba(4,14,18,0.78)', mono: true });
    rescuerLabel.position.set(-8, 2.65, 0.6);
    stationB.add(rescuerLabel);

    const arvaSamples = [];
    {
      const kal = kalman1d({ q: 0.6, r: 9 });
      let prev = null;
      const N = 180;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const p = pathCurve.getPointAt(u);
        const d = Math.max(0.6, p.distanceTo(beaconPos));
        const raw = -59 - 27 * Math.log10(d) + (i === N ? 0 : (rnd() - 0.5) * 4.2);
        const s = kal(raw);
        const guide = arvaGuide(s, prev);
        prev = s;
        arvaSamples.push({ p, d, raw, s, guide });
      }
    }
    const exactGuide = arvaGuide(-59 - 27 * Math.log10(1.2));
    const arvaCard = liveSprite(660, 360, 4.4, (g, w, h) => {
      const view = arvaCard.sp.userData.view || { guide: arvaSamples[0].guide, d: arvaSamples[0].d };
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(6,14,18,0.9)';
      g.strokeStyle = 'rgba(255,119,86,0.42)';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(5, 5, w - 10, h - 10, 26);
      g.fill();
      g.stroke();
      g.fillStyle = '#ff9f8a';
      g.font = '700 22px ui-monospace, Consolas, monospace';
      g.fillText('MODO ARVA · BLE', 30, 44);
      g.fillStyle = '#6f8792';
      g.font = '600 16px ui-monospace, Consolas, monospace';
      g.textAlign = 'right';
      g.fillText('SIMULACIÓN', w - 30, 44);
      g.textAlign = 'left';
      g.fillStyle = '#f4f7f8';
      g.font = '800 76px Segoe UI, Inter, system-ui';
      g.fillText(`${fmt1(view.guide.distM)} m`, 30, 140);
      g.fillStyle = '#9fb2bc';
      g.font = '600 22px ui-monospace, Consolas, monospace';
      g.fillText(`intervalo honesto ${fmt1(view.guide.loM)}–${fmt1(view.guide.hiM)} m`, 32, 182);
      g.strokeStyle = 'rgba(145,215,232,0.16)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(30, 208);
      g.lineTo(w - 30, 208);
      g.stroke();
      g.fillStyle = '#91d7e8';
      g.font = '700 26px Segoe UI, Inter, system-ui';
      g.fillText(`pitido cada ${view.guide.beepMs} ms`, 30, 252);
      g.fillStyle = '#9fb2bc';
      g.font = '600 19px ui-monospace, Consolas, monospace';
      g.fillText(`RSSI filtrado ${fmt1(view.s)} dBm · ${view.guide.trend}`, 30, 290);
      g.fillStyle = '#ff9f8a';
      g.font = '600 15px ui-monospace, Consolas, monospace';
      g.fillText('LOS MUROS Y LOS CUERPOS ATENÚAN: NO ES UNA DISTANCIA EXACTA', 30, 330);
    });
    arvaCard.sp.position.set(3.3, 3.55, 0.4);
    stationB.add(arvaCard.sp);

    const stationC = new THREE.Group();
    stationC.position.set(24, groundAt(24, 4), 4);
    scene.add(stationC);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x87684f, roughness: 0.86, metalness: 0.04, transparent: true, opacity: 0.56, emissive: 0x2b1a11, emissiveIntensity: 0.6 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10.4, 5.1, 0.42), wallMat);
    wall.position.set(0, 2.62, 0);
    stationC.add(wall);
    const brickLinePos = [];
    for (let row = 0; row <= 10; row++) {
      const y = 0.14 + row * 0.5;
      brickLinePos.push(-5.2, y, 0.22, 5.2, y, 0.22);
      if (row < 10) {
        for (let col = 0; col < 7; col++) {
          const x = -5.2 + col * 1.48 + (row % 2 ? 0.74 : 0);
          if (x > -5.15 && x < 5.15) brickLinePos.push(x, y, 0.22, x, y + 0.5, 0.22);
        }
      }
    }
    const brickLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(brickLinePos, 3)),
      new THREE.LineBasicMaterial({ color: 0x8a6e58, transparent: true, opacity: 0.25, toneMapped: false })
    );
    stationC.add(brickLines);

    const chest = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0x3f9c82, roughness: 0.55, metalness: 0.08, transparent: true, opacity: 0.82, emissive: 0x0f5a44, emissiveIntensity: 1.25 })
    );
    chest.scale.set(1, 0.88, 0.52);
    chest.position.set(0, 2.25, -1.9);
    stationC.add(chest);
    const chestGlow = glowSprite(PALETTE.emerald, 3.4, 0.28);
    chestGlow.position.set(0, 2.25, -1.85);
    stationC.add(chestGlow);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 18, 12),
      new THREE.MeshStandardMaterial({ color: 0x3f9c82, roughness: 0.6, transparent: true, opacity: 0.72, emissive: 0x0f5a44, emissiveIntensity: 0.95 })
    );
    head.position.set(0, 3.3, -1.9);
    stationC.add(head);
    const torsoLabel = textSprite('PECHO · 14 RPM', { size: 84, width: 1000, height: 140, scale: 0.55, color: '#baf5d9', border: 'rgba(52,211,153,0.36)', bg: 'rgba(4,18,12,0.8)', mono: true });
    torsoLabel.position.set(-1.5, 4.05, -1.7);
    stationC.add(torsoLabel);
    const wallLabel = textSprite('TABIQUE', { size: 84, width: 600, height: 140, scale: 0.5, color: '#e4cfb8', border: 'rgba(251,191,36,0.3)', bg: 'rgba(20,15,8,0.78)', mono: true });
    wallLabel.position.set(-5.6, 4.55, 0.7);
    stationC.add(wallLabel);

    const csiRings = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.012, 5, 64),
        new THREE.MeshBasicMaterial({ color: PALETTE.emerald, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      );
      ring.position.set(0, 2.25, -1.9);
      stationC.add(ring);
      csiRings.push(ring);
    }

    const boards = [];
    for (const [x, z, label, color] of [[-4.4, 2.1, 'ESP32 · TX', PALETTE.ice], [4.4, -2.1, 'ESP32 · RX', PALETTE.emerald]]) {
      const board = new THREE.Group();
      const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.62), new THREE.MeshStandardMaterial({ color: 0x164f3f, roughness: 0.6, metalness: 0.3 }));
      board.add(pcb);
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.24), new THREE.MeshStandardMaterial({ color: 0x1b2226, roughness: 0.4, metalness: 0.6 }));
      chip.position.y = 0.08;
      board.add(chip);
      const led = glowSprite(color, 0.5, 0.9);
      led.position.set(0.34, 0.14, 0.18);
      board.add(led);
      board.position.set(x, 1.15, z);
      board.rotation.y = z > 0 ? -0.35 : 0.35;
      stationC.add(board);
      const tag = textSprite(label, { size: 84, width: 700, height: 140, scale: 0.45, color: '#e5f8ff', border: 'rgba(145,215,232,0.32)', bg: 'rgba(4,14,18,0.78)', mono: true });
      tag.position.set(x, 2.05, z);
      stationC.add(tag);
      boards.push({ board, led, tag, color });
    }
    const radioLink = cylinderBetween(V(-4.4, 1.2, 2.1), V(4.4, 1.2, -2.1), 0.012, PALETTE.emerald, 0.22);
    stationC.add(radioLink);

    const csiFrames = synthesizeCsi({ seconds: 40, sr: 20, rpm: 14, person: true, seed: 5 });
    const csiResult = analyzeCsi(csiFrames, { sr: 20 });
    const csiRpm = csiResult.breathing?.rpm ?? 14.1;
    const nSub = csiFrames[0].length;
    const means = Array.from({ length: nSub }, (_, j) => csiFrames.reduce((s, r) => s + r[j], 0) / csiFrames.length);
    const sens = means.map((m, j) => {
      const vals = csiFrames.map((r) => r[j] / m);
      const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { j, v: vals.reduce((a, b) => a + (b - mu) ** 2, 0) };
    }).sort((a, b) => b.v - a.v).slice(0, 8).map((o) => o.j);
    const csiSig = csiFrames.map((r) => sens.reduce((a, j) => a + r[j] / means[j], 0) / sens.length);

    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = csiFrames.length;
    heatCanvas.height = nSub;
    {
      const hg = heatCanvas.getContext('2d');
      const im = hg.createImageData(csiFrames.length, nSub);
      csiFrames.forEach((row, x) => row.forEach((v, j) => {
        const z = clamp(0.5 + (v / means[j] - 1) * 12);
        const o = (j * csiFrames.length + x) * 4;
        im.data[o] = 30 + 225 * z;
        im.data[o + 1] = 60 + 120 * z * (1 - z) * 4;
        im.data[o + 2] = 120 + 100 * (1 - z);
        im.data[o + 3] = 255;
      }));
      hg.putImageData(im, 0, 0);
    }

    const csiCard = liveSprite(680, 420, 4.8, (g, w, h) => {
      const offset = Math.floor((csiCard.sp.userData.offset || 0) * 20) % (csiFrames.length - 320);
      const sig = csiSig.slice(offset, offset + 320);
      const mu = sig.reduce((a, b) => a + b, 0) / sig.length;
      const sm = sig.map((_, i) => {
        let s = 0, n = 0;
        for (let j = Math.max(0, i - 7); j <= Math.min(sig.length - 1, i + 7); j++) { s += sig[j]; n++; }
        return s / n - mu;
      });
      const amp = Math.max(1e-6, ...sm.map(Math.abs));
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(5,13,17,0.92)';
      g.strokeStyle = 'rgba(145,215,232,0.34)';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(5, 5, w - 10, h - 10, 26);
      g.fill();
      g.stroke();
      g.fillStyle = '#91d7e8';
      g.font = '700 21px ui-monospace, Consolas, monospace';
      g.fillText('CSI · WI-FI A TRAVÉS DEL TABIQUE', 28, 42);
      g.textAlign = 'right';
      g.fillStyle = '#6f8792';
      g.font = '600 16px ui-monospace, Consolas, monospace';
      g.fillText('52 SUBPORTADORAS', w - 28, 42);
      g.textAlign = 'left';
      g.imageSmoothingEnabled = false;
      g.drawImage(heatCanvas, offset, 0, 320, nSub, 28, 64, w - 56, 112);
      g.strokeStyle = 'rgba(145,215,232,0.2)';
      g.lineWidth = 1;
      g.strokeRect(28, 64, w - 56, 112);
      g.fillStyle = '#6f8792';
      g.font = '600 14px ui-monospace, Consolas, monospace';
      g.fillText('AMPLITUD CSI POR SUBPORTADORA · 16 S', 28, 196);
      g.strokeStyle = 'rgba(145,215,232,0.18)';
      g.beginPath();
      g.moveTo(28, 262);
      g.lineTo(w - 28, 262);
      g.stroke();
      g.strokeStyle = '#34d399';
      g.lineWidth = 2.5;
      g.beginPath();
      for (let i = 0; i < sm.length; i++) {
        const x = 28 + (i / (sm.length - 1)) * (w - 56);
        const y = 262 - (sm[i] / amp) * 40;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#6f8792';
      g.font = '600 14px ui-monospace, Consolas, monospace';
      g.fillText('SEÑAL EXTRAÍDA · BANDA 0,1–0,5 HZ', 28, 322);
      g.fillStyle = '#baf5d9';
      g.font = '800 38px Segoe UI, Inter, system-ui';
      g.fillText(`${fmt1(csiRpm)} rpm`, 28, 372);
      g.fillStyle = '#9fb2bc';
      g.font = '600 17px ui-monospace, Consolas, monospace';
      g.fillText('MOVIMIENTO: QUIETO · INDICIO, NO DESCARTE', 230, 370);
      g.fillStyle = '#ff9f8a';
      g.font = '600 15px ui-monospace, Consolas, monospace';
      g.fillText('SIN VALIDACIÓN INDEPENDIENTE TRAS MURO', 28, 402);
    });
    csiCard.sp.position.set(0, 6.55, 0);
    stationC.add(csiCard.sp);

    const chapter1End = 4.5;
    const chapter2End = 9.0;
    const chapters = [
      {
        start: 0,
        end: chapter1End,
        kicker: '01 · VER LOS SONIDOS',
        title: 'Cinco móviles oyen el mismo golpe',
        subtitle: `Los relojes van desfasados hasta 50 ms. Un pitido de sincronía y las diferencias de llegada sitúan el golpe en una zona: error ${errCm} cm, incertidumbre ${sigCm} cm.`,
        metrics: [
          { value: '5', label: 'móviles normales', tone: 'ice' },
          { value: `${errCm} cm`, label: 'error de posición', tone: 'emerald' },
          { value: `±${sigCm} cm`, label: 'incertidumbre 1σ', tone: 'amber' },
        ],
      },
      {
        start: chapter1End,
        end: chapter2End,
        kicker: '02 · OÍR LA RADIO',
        title: 'La intensidad se convierte en pitidos',
        subtitle: 'Como un detector de avalancha: el RSSI filtrado se traduce en distancia y un intervalo honesto. Al acercarse, los pitidos se aceleran.',
        metrics: [
          { value: '1,2 m', label: 'distancia estimada', tone: 'emerald' },
          { value: '1,1–1,3 m', label: 'intervalo honesto', tone: 'ice' },
          { value: '275 ms', label: 'entre pitidos', tone: 'coral' },
        ],
      },
      {
        start: chapter2End,
        end: 13.8,
        kicker: '03 · VER LA RESPIRACIÓN',
        title: 'El Wi-Fi nota el pecho al moverse',
        subtitle: 'Dos placas ESP32 leen 52 subportadoras. El pecho modula la señal entre 0,1 y 0,5 Hz. Tras un muro no hay validación independiente: es un indicio, nunca un descarte.',
        metrics: [
          { value: `${fmt1(csiRpm)} rpm`, label: 'respiración detectada', tone: 'emerald' },
          { value: '52', label: 'subportadoras CSI', tone: 'ice' },
          { value: '0', label: 'validación independiente tras muro', tone: 'coral' },
        ],
      },
    ];

    const cameraPlan = [
      { t: 0, pos: [-38, 23, 31], look: [-24, 3.4, 5.5], fov: 44 },
      { t: 4.4, pos: [-25, 10.5, 19], look: [-24, 1.1, 5.2], fov: 46 },
      { t: 4.5, pos: [5, 7.5, 20], look: [1.5, 1.2, 4.2], fov: 43 },
      { t: 8.9, pos: [-2, 3.4, 13], look: [5.6, 1.1, 4.0], fov: 43 },
      { t: 9.0, pos: [24, 6.3, 23], look: [24, 4.2, 2.8], fov: 43 },
      { t: 13.8, pos: [24, 4.9, 17], look: [24, 4.1, 2.8], fov: 43 },
    ];

    let lastArvaKey = '';
    let lastCsiDraw = -1;

    return {
      duration: 13.8,
      chapters,
      update(t) {
        cameraKeys(camera, t, cameraPlan);
        stationA.visible = t < chapter1End + 0.05;
        stationB.visible = t >= chapter1End - 0.05 && t < chapter2End + 0.05;
        stationC.visible = t >= chapter2End - 0.05;

        if (stationA.visible) {
          const pulse = (t - 0.9) / 1.9;
          for (const item of soundRings) {
            const p = ((pulse + item.offset) % 1 + 1) % 1;
            item.ring.scale.setScalar(0.25 + p * 9);
            item.ring.material.opacity = t < 0.9 ? 0 : 0.5 * (1 - p);
          }
          const sync = (t - 0.3) / 1.6;
          for (const item of syncRings) {
            const p = ((sync + item.offset) % 1 + 1) % 1;
            item.ring.scale.setScalar(0.15 + p * 3.4);
            item.ring.material.opacity = t < 0.3 || t > 2.4 ? 0 : 0.36 * (1 - p);
          }
          for (const node of phoneNodes) {
            node.userData.beacon.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4 + node.position.x));
            fitSprite(node.userData.label, camera, 26, 0.06, 1.8);
          }
          fixMarker.rotation.y = t * 0.25;
          fixRing.scale.setScalar(0.9 + 0.22 * Math.sin(t * 4.2));
          fixRing.material.opacity = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(t * 4.2));
          fixGlow.material.opacity = 0.5 + 0.25 * (0.5 + 0.5 * Math.sin(t * 5));
          realMarker.scale.setScalar(0.9 + 0.16 * Math.sin(t * 3 + 1));
          fitSprite(realLabel, camera, 26, 0.06, 1.8);
          fitSprite(fixLabel, camera, 26, 0.06, 1.8);
          fitSprite(zoneLabel, camera, 26, 0.06, 1.8);
        }

        if (stationB.visible) {
          const u = clamp((t - chapter1End) / (chapter2End - chapter1End));
          const idx = Math.min(arvaSamples.length - 1, Math.round(u * (arvaSamples.length - 1)));
          const sample = arvaSamples[idx];
          const atEnd = u > 0.985;
          const guide = atEnd ? exactGuide : sample.guide;
          const pos = atEnd ? pathPts[pathPts.length - 1] : sample.p;
          rescuer.position.set(pos.x, 0.02 + Math.abs(Math.sin(t * 7.2)) * 0.045, pos.z);
          rescuer.lookAt(V(beaconPos.x, 0.4, beaconPos.z));
          rescuer.userData.legs[0].rotation.x = Math.sin(t * 7.2) * 0.62;
          rescuer.userData.legs[1].rotation.x = -Math.sin(t * 7.2) * 0.62;
          rescuer.userData.arms[0].rotation.x = -Math.sin(t * 7.2) * 0.32;
          rescuer.userData.arms[1].rotation.x = Math.sin(t * 7.2) * 0.18;
          rescuer.userData.phone.userData.halo.material.opacity = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(t * 8));
          rescuerLabel.position.set(pos.x, 2.55, pos.z);
          fitSprite(rescuerLabel, camera, 22, 0.06, 1.7);

          const beepS = guide.beepMs / 1000;
          const bp = (t % beepS) / beepS;
          for (const item of arvaRings) {
            const p = ((bp + item.offset) % 1 + 1) % 1;
            item.ring.scale.setScalar(0.3 + p * 5.4);
            item.ring.material.opacity = 0.42 * (1 - p);
          }
          beaconGlow.material.opacity = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 7));
          beaconGlow.scale.setScalar(1.4 + 0.2 * Math.sin(t * 7));
          fitSprite(beaconLabel, camera, 22, 0.06, 1.7);

          arvaCard.sp.userData.view = { guide, d: atEnd ? 1.2 : sample.d, s: atEnd ? -61.1 : sample.s };
          const key = `${guide.distM}|${guide.beepMs}|${guide.loM}|${guide.hiM}|${guide.trend}`;
          if (key !== lastArvaKey) {
            lastArvaKey = key;
            arvaCard.draw();
          }
          arvaCard.sp.position.set(3.3, 3.5, 0.4);
          fitSprite(arvaCard.sp, camera, 20, 0.35, 1.45);
        }

        if (stationC.visible) {
          const br = Math.sin((t - chapter2End) * TAU * (csiRpm / 60));
          chest.scale.set(1 + 0.065 * br, 0.88 + 0.012 * br, 0.52 + 0.035 * br);
          chest.position.y = 2.25 + 0.018 * br;
          head.position.y = 3.3 + 0.01 * br;
          for (let i = 0; i < csiRings.length; i++) {
            const r = csiRings[i];
            const s = 1 + i * 0.22 + 0.06 * br;
            r.scale.setScalar(s);
            r.material.opacity = 0.16 + 0.1 * (1 - i / csiRings.length) + 0.05 * (0.5 + 0.5 * br);
          }
          for (let i = 0; i < boards.length; i++) {
            boards[i].led.material.opacity = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t * 7 + i * 2.1));
          }
          radioLink.material.opacity = 0.14 + 0.12 * (0.5 + 0.5 * Math.sin(t * 5));
          fitSprite(torsoLabel, camera, 24, 0.06, 1.8);
          fitSprite(wallLabel, camera, 24, 0.06, 1.8);
          for (const b of boards) fitSprite(b.tag, camera, 24, 0.06, 1.7);
          csiCard.sp.userData.offset = t;
          if (Math.floor(t * 15) !== lastCsiDraw) {
            lastCsiDraw = Math.floor(t * 15);
            csiCard.draw();
          }
          fitSprite(csiCard.sp, camera, 22, 0.3, 1.2);
        }
      },
    };
  },
};

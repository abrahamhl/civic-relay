import {
  TAU, PALETTE, clamp, smooth, mulberry32, addStars, addGrid, addDust,
  glowSprite, textSprite, makePhone, makeDrone, makeSatellite, makePacket,
  makeTrail, updateTrail, curveLine, cylinderBetween, cameraKeys, fitSprite, ringWave,
} from './common.js';
import { PLATFORMS } from '../../../investor-next/public/senda/core/platforms.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function withAlpha(hex, alpha) {
  return hex.length === 7 ? hex + alpha : hex;
}

function tag(text, color, opts = {}) {
  return textSprite(text, {
    size: opts.size ?? 60,
    width: opts.width ?? 800,
    height: opts.height ?? 140,
    scale: opts.scale ?? 0.62,
    color: opts.textColor ?? PALETTE.text,
    bg: opts.bg ?? 'rgba(6,14,20,0.84)',
    border: withAlpha(color, '88'),
    align: opts.align ?? 'center',
    depthTest: false,
  });
}

function makePcb(color = PALETTE.emerald) {
  const g = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.09, 0.82),
    new THREE.MeshStandardMaterial({ color: 0x0d3328, roughness: 0.5, metalness: 0.4 })
  );
  g.add(board);
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x151b1f, roughness: 0.4, metalness: 0.65 })
  );
  chip.position.y = 0.09;
  g.add(chip);
  for (let i = 0; i < 4; i++) {
    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xc9a24a, toneMapped: false })
    );
    pin.position.set(-0.12 + i * 0.08, 0.15, 0.24);
    g.add(pin);
  }
  const antenna = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.55, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xc9a24a, toneMapped: false })
  );
  antenna.position.set(0.42, 0.32, -0.2);
  g.add(antenna);
  const led = glowSprite(color, 0.45, 0.95, false);
  led.position.set(-0.4, 0.12, 0.24);
  g.add(led);
  return g;
}

function makeMic(color = PALETTE.ice) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 0.55, 10),
    new THREE.MeshStandardMaterial({ color: 0x24323a, roughness: 0.45, metalness: 0.6 })
  );
  stem.position.y = 0.28;
  g.add(stem);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x33454e, roughness: 0.4, metalness: 0.5 })
  );
  cap.position.y = 0.62;
  g.add(cap);
  const halo = glowSprite(color, 0.7, 0.55, false);
  halo.position.y = 0.62;
  g.add(halo);
  return g;
}

function makeAppPanel(color, w = 2.3, h = 1.3) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x0a151d, roughness: 0.42, metalness: 0.55 })
  );
  g.add(frame);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.86, h * 0.8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, toneMapped: false })
  );
  face.position.z = 0.055;
  g.add(face);
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(w * (0.58 - i * 0.1), 0.035),
      new THREE.MeshBasicMaterial({ color: 0xdff5fb, transparent: true, opacity: 0.6 - i * 0.12, toneMapped: false })
    );
    bar.position.set(-w * 0.08, h * 0.2 - i * h * 0.16, 0.065);
    g.add(bar);
  }
  const halo = glowSprite(color, w * 1.1, 0.22, false);
  halo.position.z = -0.05;
  g.add(halo);
  return g;
}

function makeBeacon(color, big = false) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.15, 1.25, 12),
    new THREE.MeshStandardMaterial({ color: 0x1a2b33, roughness: 0.4, metalness: 0.6 })
  );
  pillar.position.y = 0.62;
  g.add(pillar);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(big ? 0.26 : 0.19, 18, 12),
    new THREE.MeshBasicMaterial({ color, toneMapped: false })
  );
  head.position.y = 1.35;
  g.add(head);
  const halo = glowSprite(color, big ? 1.6 : 1.1, 0.8, false);
  halo.position.y = 1.35;
  g.add(halo);
  const ring = ringWave(color, big ? 0.95 : 0.7, 0.35);
  ring.position.y = 0.08;
  g.add(ring);
  return { group: g, ring, halo };
}

export default {
  id: 'arquitectura',
  title: 'Arquitectura de SENDA',
  duration: 15.6,

  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(20260607);

    scene.fog = new THREE.FogExp2(0x05090c, 0.0048);
    const hemi = new THREE.HemisphereLight(0xbfe9f4, 0x071018, 0.72);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.55);
    key.position.set(-22, 38, 24);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x91d7e8, 0.95);
    rim.position.set(30, 18, -26);
    scene.add(rim);
    const warm = new THREE.PointLight(0xffb077, 18, 46, 2);
    warm.position.set(-10, 9, 14);
    scene.add(warm);
    const cool = new THREE.PointLight(0x58a6ff, 14, 40, 2);
    cool.position.set(12, 7, -10);
    scene.add(cool);

    addStars(scene, 620, 235, 19);
    addGrid(scene, 200, 50, 0x143140, 0x081820);
    addDust(scene, 420, 90, 0x91d7e8, 21);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ color: 0x04090d, roughness: 0.94, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.06;
    scene.add(floor);

    const stationA = new THREE.Group();
    scene.add(stationA);
    const stationB = new THREE.Group();
    stationB.visible = false;
    scene.add(stationB);

    const fitsA = [];
    const fitsB = [];
    const addFit = (list, sp, ref = 30, min = 0.42, max = 1.65) => {
      list.push({ sp, ref, min, max });
      return sp;
    };

    const layerDefs = [
      { y: 0.5, color: PALETTE.ice, title: '1 · SENSORES Y RADIOS' },
      { y: 3.2, color: PALETTE.violet, title: '2 · PORTADORES' },
      { y: 6.1, color: PALETTE.emerald, title: '3 · NÚCLEO SENDA' },
      { y: 9.0, color: PALETTE.amber, title: '4 · APLICACIONES' },
      { y: 11.8, color: PALETTE.coral, title: '5 · DESTINOS' },
    ];

    const layerGroups = layerDefs.map(() => {
      const g = new THREE.Group();
      stationA.add(g);
      return g;
    });
    const layerTitles = [];

    for (let i = 0; i < layerDefs.length; i++) {
      const def = layerDefs[i];
      const group = layerGroups[i];
      const c = new THREE.Color(def.color);
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(20, 0.12, 12),
        new THREE.MeshStandardMaterial({
          color: c.clone().multiplyScalar(0.06),
          emissive: c.clone().multiplyScalar(0.14),
          emissiveIntensity: 0.85,
          transparent: true,
          opacity: 0.6,
          roughness: 0.35,
          metalness: 0.55,
          depthWrite: false,
        })
      );
      slab.position.y = def.y;
      group.add(slab);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(slab.geometry),
        new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.38, toneMapped: false })
      );
      edges.position.copy(slab.position);
      group.add(edges);
      const label = textSprite(def.title, {
        size: 80,
        color: def.color,
        width: 1500,
        height: 180,
        scale: 0.72,
        bg: 'rgba(6,14,20,0.62)',
        border: withAlpha(def.color, '77'),
        align: 'center',
        depthTest: false,
      });
      label.position.set(-15.3, def.y + 0.42, 0);
      group.add(label);
      layerTitles.push(label);
      addFit(fitsA, label, 34, 0.4, 1.5);
    }

    for (const [x, z] of [[-9.55, -5.55], [9.55, -5.55], [-9.55, 5.55], [9.55, 5.55]]) {
      const post = cylinderBetween(V(x, 0.5, z), V(x, 11.8, z), 0.022, 0x2d5262, 0.16);
      stationA.add(post);
    }

    const sensorTags = [];
    const phone = makePhone(PALETTE.ice);
    phone.position.set(-6.3, 1.35, 1.4);
    phone.scale.setScalar(1.35);
    layerGroups[0].add(phone);
    sensorTags.push({ text: 'SENSORES DEL MÓVIL', color: PALETTE.ice, x: -6.3, y: 2.7, z: 1.4, width: 880 });

    const pcb = makePcb(PALETTE.emerald);
    pcb.position.set(-1.6, 0.9, -2.2);
    pcb.rotation.y = 0.45;
    layerGroups[0].add(pcb);
    sensorTags.push({ text: 'ESP32 · CSI', color: PALETTE.emerald, x: -1.6, y: 2.0, z: -2.2, width: 720 });

    const drone = makeDrone(PALETTE.amber);
    drone.position.set(2.8, 2.15, 2.35);
    drone.scale.setScalar(1.25);
    layerGroups[0].add(drone);
    sensorTags.push({ text: 'DRON · CÁMARA', color: PALETTE.amber, x: 2.8, y: 3.55, z: 2.35, width: 780 });

    const sat = makeSatellite(PALETTE.violet);
    sat.position.set(6.8, 2.7, -1.2);
    sat.scale.setScalar(1.1);
    layerGroups[0].add(sat);

    const mic = makeMic(PALETTE.coral);
    mic.position.set(-4.2, 0.9, 3.1);
    layerGroups[0].add(mic);

    for (const d of sensorTags) {
      const sp = tag(d.text, d.color, { width: d.width, scale: 0.58, size: 58 });
      sp.position.set(d.x, d.y, d.z);
      layerGroups[0].add(sp);
      addFit(fitsA, sp, 30, 0.42, 1.6);
    }

    const bearerLanes = [
      { z: -3.6, color: PALETTE.ice, text: 'SONIDO', x: -6.9, y: 4.12, labelZ: -3.4 },
      { z: -1.2, color: PALETTE.emerald, text: 'WI-FI LOCAL', x: 6.9, y: 4.12, labelZ: -1.0 },
      { z: 1.2, color: PALETTE.amber, text: 'BLE · DIRECTO', x: 6.9, y: 4.62, labelZ: 1.4 },
      { z: 3.6, color: PALETTE.violet, text: 'LORA · SATÉLITE', x: -6.9, y: 4.62, labelZ: 3.8 },
    ];
    for (const lane of bearerLanes) {
      layerGroups[1].add(cylinderBetween(V(-8.6, 3.52, lane.z), V(8.6, 3.52, lane.z), 0.028, lane.color, 0.34));
      const sp = tag(lane.text, lane.color, { width: 780, scale: 0.55, size: 58 });
      sp.position.set(lane.x, lane.y, lane.labelZ);
      layerGroups[1].add(sp);
      addFit(fitsA, sp, 30, 0.4, 1.55);
    }

    const corePhone = makePhone(PALETTE.emerald);
    corePhone.position.set(0, 6.95, 0);
    corePhone.scale.setScalar(3.05);
    corePhone.rotation.y = -0.42;
    layerGroups[2].add(corePhone);
    const coreRingA = ringWave(PALETTE.emerald, 2.25, 0.28);
    coreRingA.position.y = 6.32;
    layerGroups[2].add(coreRingA);
    const coreRingB = ringWave(PALETTE.ice, 3.15, 0.16);
    coreRingB.position.y = 6.2;
    layerGroups[2].add(coreRingB);
    const coreHalo = glowSprite(PALETTE.emerald, 6.5, 0.28, false);
    coreHalo.position.set(0, 6.95, 0);
    layerGroups[2].add(coreHalo);

    const coreTags = [
      { text: 'SOBRE CIFRADO', color: PALETTE.emerald, x: -4.8, y: 7.55, z: 2.6, width: 820 },
      { text: 'ENRUTADOR · K-DE-N', color: PALETTE.ice, x: 4.35, y: 7.5, z: -1.3, width: 900 },
      { text: 'SEÑALIZACIÓN 80–110 B', color: PALETTE.amber, x: -4.5, y: 5.55, z: 3.15, width: 960 },
      { text: 'SIN SERVIDOR', color: PALETTE.coral, x: 3.45, y: 6.05, z: 3.45, width: 760 },
    ];
    for (const d of coreTags) {
      const sp = tag(d.text, d.color, { width: d.width, scale: 0.58, size: 58 });
      sp.position.set(d.x, d.y, d.z);
      layerGroups[2].add(sp);
      addFit(fitsA, sp, 28, 0.4, 1.6);
    }

    const appPanels = [
      { x: -4.8, color: PALETTE.ice, text: 'CAMPO · SOS' },
      { x: 0, color: PALETTE.emerald, text: 'LLAMADA · VOZ' },
      { x: 4.8, color: PALETTE.amber, text: 'TRIAJE · PARTE' },
    ];
    for (const app of appPanels) {
      const panel = makeAppPanel(app.color, 3.0, 1.65);
      panel.position.set(app.x, 9.82, 2.05);
      layerGroups[3].add(panel);
      const sp = tag(app.text, app.color, { width: 900, scale: 0.56, size: 58 });
      sp.position.set(app.x, 11.02, 2.05);
      layerGroups[3].add(sp);
      addFit(fitsA, sp, 30, 0.42, 1.6);
    }
    for (const x of [-2.4, 2.4]) {
      const ghost = makeAppPanel(PALETTE.violet, 2.2, 1.2);
      ghost.position.set(x, 9.55, 0.45);
      ghost.scale.setScalar(0.82);
      ghost.traverse((o) => {
        if (o.material && o.material.opacity !== undefined) o.material.opacity *= 0.4;
      });
      layerGroups[3].add(ghost);
    }

    const destinations = [
      { x: -6.8, color: PALETTE.coral, text: '112', big: true, width: 620, scale: 0.92 },
      { x: -2.3, color: PALETTE.emerald, text: 'SANITARIO', big: false, width: 760, scale: 0.6 },
      { x: 2.3, color: PALETTE.amber, text: 'BOMBEROS', big: false, width: 760, scale: 0.6 },
      { x: 6.8, color: PALETTE.ice, text: 'VECINOS', big: false, width: 700, scale: 0.6 },
    ];
    const destRings = [];
    for (const d of destinations) {
      const b = makeBeacon(d.color, d.big);
      b.group.position.set(d.x, 11.8, 0);
      layerGroups[4].add(b.group);
      destRings.push(b);
      const sp = tag(d.text, d.color, { width: d.width, scale: d.scale, size: d.big ? 70 : 58 });
      sp.position.set(d.x, d.big ? 14.0 : 13.75, 0);
      layerGroups[4].add(sp);
      addFit(fitsA, sp, 32, 0.42, 1.55);
    }

    const flowDefs = [
      {
        color: PALETTE.ice,
        drop: false,
        points: [V(-6.3, 1.85, 1.4), V(-6.2, 3.9, 1.0), V(-1.6, 6.95, 0.2), V(-4.8, 9.9, 1.7), V(-6.8, 12.55, 0)],
      },
      {
        color: PALETTE.emerald,
        drop: true,
        points: [V(-1.6, 1.25, -2.2), V(-1.8, 3.9, -1.8), V(-0.4, 6.95, 0), V(0, 9.9, 2.0), V(-2.3, 12.55, 0)],
      },
      {
        color: PALETTE.amber,
        drop: false,
        points: [V(2.8, 2.6, 2.35), V(2.2, 3.9, 1.6), V(0.8, 6.95, 0), V(4.8, 9.9, 1.7), V(2.3, 12.55, 0)],
      },
      {
        color: PALETTE.violet,
        drop: true,
        points: [V(6.8, 3.2, -1.2), V(5.6, 3.9, -1.0), V(2.0, 6.95, 0), V(4.8, 9.9, 1.9), V(6.8, 12.55, 0)],
      },
      {
        color: PALETTE.coral,
        drop: false,
        points: [V(-4.2, 1.55, 3.1), V(-4.8, 3.9, 3.2), V(-1.0, 6.95, 0.2), V(-4.8, 9.9, 1.5), V(-2.3, 12.55, 0)],
      },
    ];

    const fragments = [];
    const fadeLines = [];
    for (let i = 0; i < flowDefs.length; i++) {
      const def = flowDefs[i];
      const { line, curve } = curveLine(def.points, def.color, 0.11, true);
      stationA.add(line);
      fadeLines.push(line);
      const mesh = makePacket(def.color, 0.17);
      stationA.add(mesh);
      const trail = makeTrail(def.color, 9, 0.055);
      stationA.add(trail);
      fragments.push({
        mesh, trail, curve, color: def.color, drop: def.drop,
        offset: i * 0.173, phase: rnd() * TAU,
      });
    }

    const kTag = tag('3 DE 5 FRAGMENTOS BASTAN', PALETTE.emerald, { width: 1120, scale: 0.56, size: 58 });
    kTag.position.set(0, 5.0, 4.2);
    kTag.material.opacity = 0;
    stationA.add(kTag);
    addFit(fitsA, kTag, 28, 0.42, 1.5);

    const doneCount = PLATFORMS.filter((p) => p.status === 'HECHO').length;
    const partialCount = PLATFORMS.filter((p) => p.status === 'PARCIAL').length;

    const ringB = new THREE.Mesh(
      new THREE.RingGeometry(8.7, 9.0, 128),
      new THREE.MeshBasicMaterial({ color: PALETTE.emerald, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
    );
    ringB.rotation.x = -Math.PI / 2;
    ringB.position.y = 0.02;
    stationB.add(ringB);
    const ringB2 = ringWave(PALETTE.ice, 11.0, 0.18);
    ringB2.position.y = 0.03;
    stationB.add(ringB2);

    const pedestals = [
      { x: -6.2, z: 2.2, color: PALETTE.ice, title: 'WEB', status: 'SIN INSTALAR', device: 'phone' },
      { x: 6.2, z: 2.2, color: PALETTE.emerald, title: 'ANDROID', status: 'BALIZA · BARRIDO', device: 'phone' },
      { x: 0, z: -6.2, color: PALETTE.amber, title: 'ESP32', status: 'C++ · CSI · LORA', device: 'pcb' },
    ];
    const deviceHalos = [];
    const deviceLinks = [];
    for (const p of pedestals) {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.55, 1.75, 0.38, 32),
        new THREE.MeshStandardMaterial({ color: 0x0c1b23, roughness: 0.38, metalness: 0.62, emissive: 0x0a1a22, emissiveIntensity: 0.6 })
      );
      base.position.set(p.x, 0.19, p.z);
      stationB.add(base);
      const rim = ringWave(p.color, 1.5, 0.35);
      rim.position.set(p.x, 0.39, p.z);
      stationB.add(rim);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.5, 2.1, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
      );
      beam.position.set(p.x, 1.45, p.z);
      stationB.add(beam);

      let device;
      if (p.device === 'phone') {
        device = makePhone(p.color);
        device.scale.setScalar(2.35);
        device.position.set(p.x, 2.55, p.z);
        device.rotation.y = p.x < 0 ? 0.32 : -0.32;
      } else {
        device = makePcb(p.color);
        device.scale.setScalar(1.8);
        device.position.set(p.x, 2.55, p.z);
        device.rotation.y = 0;
      }
      stationB.add(device);
      const led = glowSprite(p.color, 0.75, 0.55, false);
      led.position.set(p.x, 3.32, p.z);
      stationB.add(led);
      deviceHalos.push(led);

      const title = tag(p.title, p.color, { width: 720, scale: 0.78, size: 68 });
      title.position.set(p.x, 4.45, p.z);
      stationB.add(title);
      addFit(fitsB, title, 26, 0.5, 1.4);
      const status = tag(p.status, p.color, { width: 900, scale: 0.42, size: 54 });
      status.position.set(p.x, 3.92, p.z);
      stationB.add(status);
      addFit(fitsB, status, 26, 0.46, 1.4);

      deviceLinks.push({ from: V(0, 5.2, 0), to: V(p.x, 3.35, p.z), color: p.color, mesh: null, offset: p.x * 0.03 });
    }

    const coreCube = new THREE.Group();
    const cubeMesh = makePacket(PALETTE.emerald, 0.55);
    coreCube.add(cubeMesh);
    const cubeRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.02, 8, 96),
      new THREE.MeshBasicMaterial({ color: PALETTE.emerald, transparent: true, opacity: 0.5, toneMapped: false })
    );
    cubeRing.rotation.x = Math.PI / 2;
    coreCube.add(cubeRing);
    coreCube.position.set(0, 5.2, 0);
    stationB.add(coreCube);
    const cubeLabel = tag('MISMA TRAMA', PALETTE.emerald, { width: 900, scale: 0.78, size: 66 });
    cubeLabel.position.set(0, 6.5, 0);
    stationB.add(cubeLabel);
    addFit(fitsB, cubeLabel, 26, 0.5, 1.4);

    for (const link of deviceLinks) {
      const beam = cylinderBetween(link.from, link.to, 0.03, link.color, 0.34);
      stationB.add(beam);
      const packet = makePacket(link.color, 0.11);
      stationB.add(packet);
      link.mesh = packet;
    }

    const droneB = makeDrone(PALETTE.amber);
    droneB.position.set(5.4, 5.8, -2.6);
    droneB.scale.setScalar(1.5);
    stationB.add(droneB);
    const droneTag = tag('DRON · CENSO 719/720', PALETTE.amber, { width: 1080, scale: 0.58, size: 58 });
    droneTag.position.set(5.4, 7.05, -2.6);
    stationB.add(droneTag);
    addFit(fitsB, droneTag, 26, 0.46, 1.45);

    const satB = makeSatellite(PALETTE.violet);
    satB.position.set(-6.6, 6.9, -3.4);
    satB.scale.setScalar(1.4);
    stationB.add(satB);
    const satTag = tag('SATÉLITE · SMS', PALETTE.violet, { width: 900, scale: 0.55, size: 56 });
    satTag.position.set(-6.6, 8.05, -3.4);
    stationB.add(satTag);
    addFit(fitsB, satTag, 26, 0.46, 1.45);

    const c1 = 5.2;
    const c2 = 10.6;

    const cameraPlan = [
      { t: 0, pos: [23, 18, 29], look: [0, 6.2, 0], fov: 42 },
      { t: 2.6, pos: [12, 20, 34], look: [0, 6.2, 0], fov: 42 },
      { t: 5.1, pos: [-14, 18, 31], look: [0, 6.0, 0], fov: 42 },
      { t: 5.2, pos: [10, 15, 21], look: [-1, 6.8, 0], fov: 42 },
      { t: 7.8, pos: [-8, 14, 20], look: [-1, 6.8, 0], fov: 42 },
      { t: 10.5, pos: [2, 15, 21], look: [-1, 6.8, 0], fov: 42 },
      { t: 10.6, pos: [16, 9, 21], look: [0, 4.0, 0], fov: 44 },
      { t: 13.0, pos: [-14, 8, 19], look: [0, 4.0, 0], fov: 44 },
      { t: 15.6, pos: [9, 8.5, 19], look: [0, 4.0, 0], fov: 44 },
    ];

    const chapters = [
      {
        start: 0,
        end: c1,
        kicker: '01 · CINCO CAPAS',
        title: 'Todo viaja por el mismo canal',
        subtitle: 'Sensores y radios, portadores, núcleo, aplicaciones y destinos. Una sola trama cifrada recorre lo que ya existe, sin servidor en la ruta.',
        metrics: [
          { value: '5', label: 'capas del sistema', tone: 'ice' },
          { value: '1', label: 'trama común', tone: 'emerald' },
          { value: '0', label: 'servidores en la ruta', tone: 'coral' },
        ],
      },
      {
        start: c1,
        end: c2,
        kicker: '02 · NÚCLEO EN EL TELÉFONO',
        title: 'La llamada arranca por sonido',
        subtitle: 'El núcleo cifra, enruta y reparte fragmentos k-de-n. La señalización de una llamada se comprime a 80–110 bytes: cabe en 8–10 segundos de sonido.',
        metrics: [
          { value: '80–110 B', label: 'señalización de llamada', tone: 'ice' },
          { value: '8–10 s', label: 'por sonido', tone: 'emerald' },
          { value: '0', label: 'peticiones de red', tone: 'coral' },
        ],
      },
      {
        start: c2,
        end: 15.6,
        kicker: '03 · MISMA TRAMA',
        title: 'Web, Android y ESP32 hablan igual',
        subtitle: `El mismo sobre corre en navegador, Android y ESP32. De ${PLATFORMS.length} plataformas documentadas, ${doneCount} están hechas y ${partialCount} parciales. El censo acierta 719 de 720 plantas.`,
        metrics: [
          { value: '719/720', label: 'plantas con censo exacto', tone: 'emerald' },
          { value: '95 %', label: 'intervalos que contienen la verdad', tone: 'amber' },
          { value: '3', label: 'entornos: web, Android, ESP32', tone: 'ice' },
        ],
      },
    ];

    return {
      duration: 15.6,
      chapters,

      update(t) {
        cameraKeys(camera, t, cameraPlan);
        stationA.visible = t < c2 - 0.04;
        stationB.visible = t >= c2 - 0.04;

        if (stationA.visible) {
          const inChapter2 = t > c1 && t < c2;
          layerGroups[0].visible = !inChapter2;
          layerGroups[4].visible = !inChapter2;
          const titleFade = inChapter2 ? 0 : 1 - smooth(4.2, 4.75, t);
          for (let i = 0; i < layerTitles.length; i++) {
            layerTitles[i].visible = titleFade > 0.02;
            layerTitles[i].material.opacity = titleFade;
          }

          for (const f of fitsA) fitSprite(f.sp, camera, f.ref, f.min, f.max);

          for (const item of fragments) {
            const u = ((t * 0.118 + item.offset) % 1 + 1) % 1;
            const dropped = inChapter2 && item.drop && u > 0.34;
            item.mesh.visible = !dropped;
            item.trail.visible = !dropped;
            if (!dropped) {
              const pos = item.curve.getPointAt(u);
              item.mesh.position.copy(pos);
              item.mesh.rotation.y += 0.035;
              item.mesh.rotation.x += 0.02;
              const s = 1 + 0.16 * Math.sin(t * 5.2 + item.phase);
              item.mesh.scale.setScalar(s);
              const trailPoints = [];
              for (let j = 0; j < 9; j++) trailPoints.push(item.curve.getPointAt(clamp(u - j * 0.014)));
              updateTrail(item.trail, trailPoints);
            }
          }

          const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
          coreRingA.scale.setScalar(1 + pulse * 0.07);
          coreRingA.material.opacity = 0.2 + pulse * 0.14;
          coreRingB.scale.setScalar(1 + (1 - pulse) * 0.05);
          coreRingB.material.opacity = 0.1 + (1 - pulse) * 0.1;
          coreHalo.material.opacity = 0.2 + pulse * 0.12;
          corePhone.rotation.y = -0.42 + Math.sin(t * 0.42) * 0.1;

          destRings.forEach((d, i) => {
            const p = ((t * 0.55 + i * 0.23) % 1 + 1) % 1;
            d.ring.scale.setScalar(0.35 + p * 2.1);
            d.ring.material.opacity = 0.32 * (1 - p);
            d.halo.material.opacity = 0.55 + 0.25 * Math.sin(t * 2.6 + i);
          });

          drone.userData.rotors.forEach((r, i) => {
            r.rotation.y += 0.24 + i * 0.005;
          });

          const kFade = smooth(0.15, 0.55, t - c1) * (1 - smooth(0.35, 0.75, t - (c2 - 0.9)));
          kTag.material.opacity = inChapter2 ? kFade : 0;
          kTag.visible = kTag.material.opacity > 0.02;
          for (const line of fadeLines) line.material.opacity = inChapter2 ? 0.24 : 0.11;
        }

        if (stationB.visible) {
          for (const f of fitsB) fitSprite(f.sp, camera, f.ref, f.min, f.max);

          coreCube.rotation.y = t * 0.55;
          cubeMesh.rotation.x = t * 0.8;
          cubeMesh.rotation.y = t * 0.6;
          cubeRing.rotation.z = t * 0.4;
          cubeRing.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05);
          cubeRing.material.opacity = 0.42 + 0.16 * Math.sin(t * 2.2);

          deviceLinks.forEach((link, i) => {
            const k = ((t * 0.38 + i * 0.33) % 1 + 1) % 1;
            link.mesh.position.lerpVectors(link.from, link.to, k);
            const s = 1 + 0.2 * Math.sin(t * 4.5 + i);
            link.mesh.scale.setScalar(s);
            link.mesh.visible = k > 0.04 && k < 0.96;
          });

          deviceHalos.forEach((h, i) => {
            h.material.opacity = 0.42 + 0.24 * Math.sin(t * 2.4 + i * 1.7);
          });

          droneB.userData.rotors.forEach((r, i) => {
            r.rotation.y += 0.3 + i * 0.004;
          });
          droneB.position.y = 5.8 + Math.sin(t * 1.3) * 0.18;
          satB.rotation.y = t * 0.12;
          ringB2.scale.setScalar(1 + ((t * 0.2) % 1) * 0.18);
          ringB2.material.opacity = 0.2 - ((t * 0.2) % 1) * 0.16;
        }
      },
    };
  },
};

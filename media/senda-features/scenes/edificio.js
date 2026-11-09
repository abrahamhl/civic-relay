import {
  TAU, PALETTE, clamp, lerp, smooth, mulberry32, addStars, addGrid, addDust,
  glowSprite, textSprite, makeDrone, curveLine, cameraKeys, fitSprite, ringWave,
} from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  id: 'edificio',
  title: 'Gemelo 3D del edificio',
  duration: 12.4,
  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(90210);
    scene.fog = new THREE.FogExp2(0x061018, 0.009);

    scene.add(new THREE.HemisphereLight(0xa8e2ee, 0x020406, 1.0));
    const key = new THREE.DirectionalLight(0xffd6b0, 2.0);
    key.position.set(22, 42, 30);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x62bcd8, 1.8);
    rim.position.set(-28, 20, -24);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x6f9fac, 0.45));

    addStars(scene, 460, 220, 9);
    addGrid(scene, 150, 50, 0x1a4454, 0x0a1c24);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 150),
      new THREE.MeshStandardMaterial({ color: 0x050d12, roughness: 0.9, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    scene.add(floor);
    addDust(scene, 220, 80, 0x7fb9c9, 31);

    const contextMat = new THREE.MeshStandardMaterial({ color: 0x0b1b23, roughness: 0.55, metalness: 0.35, emissive: 0x06131a, emissiveIntensity: 0.7 });
    for (let i = 0; i < 28; i++) {
      const w = 2 + rnd() * 4;
      const h = 3 + rnd() * 15;
      const d = 2 + rnd() * 4;
      const x = (rnd() - 0.5) * 80;
      const z = (rnd() - 0.5) * 70;
      if (Math.hypot(x, z) < 16) continue;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), contextMat);
      b.position.set(x, h / 2, z);
      scene.add(b);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), new THREE.LineBasicMaterial({ color: 0x2b5968, transparent: true, opacity: 0.35 }));
      e.position.copy(b.position);
      scene.add(e);
    }

    const building = new THREE.Group();
    building.position.y = 0;
    scene.add(building);

    const floors = [];
    const people = [];
    const counts = [3, 8, 5, 0, 6, 2];
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x12303a,
      transparent: true,
      opacity: 0.42,
      roughness: 0.34,
      metalness: 0.45,
      emissive: 0x0a2530,
      emissiveIntensity: 0.55,
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x8ed7e8, transparent: true, opacity: 0.7 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x5bbdd4, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false });

    for (let f = 0; f < 6; f++) {
      const g = new THREE.Group();
      g.position.y = f * 2.2;
      building.add(g);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.22, 8.2), slabMat);
      slab.position.y = 0;
      g.add(slab);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), edgeMat);
      g.add(edges);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(10.0, 2.0, 7.8), glassMat);
      glass.position.y = 1.0;
      g.add(glass);
      for (const [x, z] of [[-4.7, -3.65], [4.7, -3.65], [-4.7, 3.65], [4.7, 3.65]]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6), new THREE.MeshStandardMaterial({ color: 0x5f8e9b, roughness: 0.4, metalness: 0.7 }));
        col.position.set(x, 1.0, z);
        g.add(col);
      }
      const label = textSprite(`P${f + 1} · ${counts[f]}`, { size: 38, scale: 0.3, color: '#bfeaf4', border: 'rgba(145,215,232,0.32)', bg: 'rgba(4,14,18,0.7)', mono: true });
      label.position.set(-6.2, 0.8, 4.1);
      g.add(label);
      floors.push({ g, f, label });
    }

    const sideGrid = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(10.6, 13.0, 8.4)),
      new THREE.LineBasicMaterial({ color: 0x4c91a4, transparent: true, opacity: 0.16 })
    );
    sideGrid.position.y = 6.5;
    building.add(sideGrid);

    for (let f = 0; f < counts.length; f++) {
      for (let p = 0; p < counts[f]; p++) {
        const color = p % 5 === 0 ? PALETTE.violet : p % 7 === 0 ? PALETTE.coral : PALETTE.ice;
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false }));
        body.scale.y = 1.35;
        const halo = glowSprite(color, 0.95, 0.55);
        g.add(body, halo);
        g.position.set((rnd() - 0.5) * 8.2, 0.5, (rnd() - 0.5) * 6.2);
        floors[f].g.add(g);
        people.push({ g, f, color, trapped: f === 2 && p === 0, phase: rnd() * TAU });
      }
    }

    const trapped = people.find((p) => p.trapped);
    const trappedRing = ringWave(PALETTE.coral, 1.1, 0.8);
    trappedRing.position.y = 0.1;
    trapped.g.add(trappedRing);
    const trappedLabel = textSprite('P3 · 5 PERSONAS', { size: 38, scale: 0.3, color: '#ffd0c4', border: 'rgba(255,119,86,0.45)', bg: 'rgba(24,10,8,0.78)' });
    trappedLabel.position.set(0, 1.45, 0);
    trapped.g.add(trappedLabel);

    const drone = makeDrone(PALETTE.ice);
    drone.scale.setScalar(1.35);
    scene.add(drone);

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(5.4, 12, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    cone.position.y = -6;
    drone.add(cone);
    const scanRing = ringWave(PALETTE.ice, 4.6, 0.55);
    scanRing.position.y = -12.1;
    drone.add(scanRing);

    const scanLines = [];
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, -12, 0)]),
        new THREE.LineDashedMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.25, dashSize: 0.45, gapSize: 0.35 })
      );
      line.computeLineDistances();
      drone.add(line);
      scanLines.push(line);
    }

    const orbit = { r: 17, y: 17 };
    const groundRing = ringWave(PALETTE.ice, 8.5, 0.28);
    groundRing.position.y = 0.03;
    scene.add(groundRing);

    const dataDots = [];
    for (let i = 0; i < 18; i++) {
      const s = glowSprite(i % 3 === 0 ? PALETTE.amber : PALETTE.ice, 0.32, 0.55);
      s.userData.base = V((rnd() - 0.5) * 11, rnd() * 13, (rnd() - 0.5) * 9);
      s.userData.phase = rnd() * TAU;
      scene.add(s);
      dataDots.push(s);
    }

    const chapters = [
      {
        start: 0,
        end: 4.2,
        kicker: '01 · EL EDIFICIO NO SE ADIVINA',
        title: 'Un gemelo 3D hecho de datos',
        subtitle: 'Plantas, viviendas y accesos se convierten en una hipótesis que se puede comprobar.',
        metrics: [
          { value: '6', label: 'plantas del escenario', tone: 'ice' },
          { value: '24', label: 'personas de referencia', tone: 'emerald' },
          { value: '3D', label: 'gemelo navegable', tone: 'violet' },
        ],
      },
      {
        start: 4.2,
        end: 8.4,
        kicker: '02 · PASADA A PASADA',
        title: 'El dron escucha sin entrar',
        subtitle: 'Bluetooth, térmica y estructura. Solo recuentos: nunca contenido, nombres ni conversaciones.',
        metrics: [
          { value: '0', label: 'contenidos leídos', tone: 'coral' },
          { value: '3', label: 'pasadas de dron', tone: 'ice' },
          { value: '12', label: 'lecturas por planta', tone: 'amber' },
        ],
      },
      {
        start: 8.4,
        end: 12.4,
        kicker: '03 · PRIORIDAD, NO CERTEZA',
        title: 'Una lista para decidir, no un veredicto',
        subtitle: 'El sistema ordena por daño y personas probables. La decisión final sigue siendo humana.',
        metrics: [
          { value: '24', label: 'personas probables', tone: 'emerald' },
          { value: '6', label: 'plantas cubiertas', tone: 'ice' },
          { value: 'HUMANO', label: 'decisión final', tone: 'amber' },
        ],
      },
    ];

    const cameraPlan = [
      { t: 0, pos: [20, 10, 26], look: [0, 7.5, 0], fov: 40 },
      { t: 3.4, pos: [24, 14, 21], look: [0, 8.5, 0], fov: 40 },
      { t: 5.6, pos: [18, 18, 23], look: [0, 10, 0], fov: 42 },
      { t: 8.2, pos: [11, 22, 25], look: [0, 10, 0], fov: 42 },
      { t: 10.4, pos: [3, 24, 27], look: [0, 10, 0], fov: 42 },
      { t: 12.4, pos: [0, 18, 27], look: [0, 8, 0], fov: 40 },
    ];

    return {
      duration: 12.4,
      chapters,
      update(t) {
        cameraKeys(camera, t, cameraPlan);
        building.rotation.y = 0.16 + 0.08 * Math.sin(t * 0.22);
        const expl = smooth(3.5, 8.0, t);
        for (const { g, f, label } of floors) {
          g.position.y = f * 2.2 + f * 1.55 * expl;
          label.material.opacity = 0.55 + 0.45 * expl;
          fitSprite(label, camera, 16, 0.04, 2.2);
        }
        sideGrid.position.y = 6.5 + 2.5 * 1.55 * expl;
        sideGrid.material.opacity = 0.16 * (1 - expl * 0.7);

        const angle = t * 0.72 + 0.8;
        drone.position.set(Math.cos(angle) * orbit.r, orbit.y + 1.5 * Math.sin(t * 1.3), Math.sin(angle) * orbit.r);
        drone.lookAt(V(0, 6.8, 0));
        for (const r of drone.userData.rotors) r.rotation.y = t * 42;
        drone.userData.led.material.opacity = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * 8));
        cone.material.opacity = 0.035 + 0.035 * (0.5 + 0.5 * Math.sin(t * 2.2));
        scanRing.rotation.z = t * 0.6;
        scanRing.material.opacity = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2.2));
        for (let i = 0; i < scanLines.length; i++) {
          scanLines[i].rotation.y = (i / scanLines.length) * TAU + t * 0.4;
          scanLines[i].material.opacity = 0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3 + i));
        }
        groundRing.scale.setScalar(1 + 0.09 * Math.sin(t * 0.9));
        groundRing.material.opacity = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.2));

        for (const p of people) {
          const pulse = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.2 + p.phase));
          p.g.scale.setScalar(p.trapped ? 1.35 + 0.2 * Math.sin(t * 4) : pulse);
          if (p.color === PALETTE.coral) p.g.children[1].material.opacity = 0.4 + 0.4 * pulse;
        }
        trappedRing.scale.setScalar(0.7 + 0.8 * (0.5 + 0.5 * Math.sin(t * 3.4)));
        trappedRing.material.opacity = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3.4));
        trappedLabel.material.opacity = 0.8;

        for (const d of dataDots) {
          const k = 0.5 + 0.5 * Math.sin(t * 1.4 + d.userData.phase);
          d.position.set(
            d.userData.base.x,
            2 + ((d.userData.base.y + t * 1.6) % 12),
            d.userData.base.z
          );
          d.material.opacity = 0.15 + 0.45 * k;
          fitSprite(d, camera, 16, 0.1, 2);
        }
      },
    };
  },
};

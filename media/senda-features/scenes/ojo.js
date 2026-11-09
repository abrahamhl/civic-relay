import {
  TAU, PALETTE, clamp, lerp, smooth, mulberry32, addStars, addGrid, addDust,
  glowSprite, textSprite, makeWater, curveLine, cameraKeys, fitSprite, ringWave, cylinderBetween,
} from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function cameraPole(color, label) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 4.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d8792, roughness: 0.45, metalness: 0.65 })
  );
  pole.position.y = 2.2;
  g.add(pole);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.38, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x20343d, roughness: 0.4, metalness: 0.55 })
  );
  head.position.set(0, 4.45, 0.18);
  g.add(head);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.22, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, toneMapped: false })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 4.45, 0.55);
  g.add(lens);
  const halo = glowSprite(color, 1.5, 0.62);
  halo.position.set(0, 4.45, 0.62);
  g.add(halo);
  const tag = textSprite(label, { size: 28, scale: 0.2, color: '#d9f7ff', border: 'rgba(145,215,232,0.28)', bg: 'rgba(4,14,18,0.68)', mono: true });
  tag.position.set(0, 5.2, 0.2);
  g.add(tag);
  g.userData = { lens, halo, tag, color };
  return g;
}

function forbiddenNode(label) {
  const g = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 1.45, 1.45),
    new THREE.MeshStandardMaterial({ color: 0x2a1014, roughness: 0.4, metalness: 0.5, emissive: 0x2b080c, emissiveIntensity: 0.8 })
  );
  cube.position.y = 2.1;
  g.add(cube);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.85 }));
  edges.position.copy(cube.position);
  g.add(edges);
  const lock = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.07, 8, 28, Math.PI),
    new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.9, toneMapped: false })
  );
  lock.position.set(0, 2.0, 0.76);
  lock.rotation.z = Math.PI;
  g.add(lock);
  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 2.3),
    new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  );
  shield.position.set(0, 2.2, 0);
  g.add(shield);
  const halo = glowSprite(PALETTE.red, 2.4, 0.45);
  halo.position.set(0, 2.2, 0);
  g.add(halo);
  const tag = textSprite(label, { size: 28, scale: 0.22, color: '#ffd0c4', border: 'rgba(255,91,110,0.4)', bg: 'rgba(24,8,12,0.78)', mono: true });
  tag.position.set(0, 3.5, 0);
  g.add(tag);
  g.userData = { shield, halo, tag };
  return g;
}

export default {
  id: 'ojo',
  title: 'Ojo público',
  duration: 12.6,
  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(1984);
    scene.fog = new THREE.FogExp2(0x061018, 0.009);

    scene.add(new THREE.HemisphereLight(0xa8e2ee, 0x020406, 1.0));
    const key = new THREE.DirectionalLight(0xffd6b0, 2.0);
    key.position.set(25, 45, 30);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x5fbad4, 1.8);
    rim.position.set(-30, 22, -20);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x6f9fac, 0.45));

    addStars(scene, 480, 240, 8);
    addGrid(scene, 160, 52, 0x1a4454, 0x0a1c24);
    addDust(scene, 220, 80, 0x7fb9c9, 44);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 100),
      new THREE.MeshStandardMaterial({ color: 0x071013, roughness: 0.9, metalness: 0.18 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    scene.add(ground);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 96),
      new THREE.MeshStandardMaterial({ color: 0x1b252b, roughness: 0.82, metalness: 0.15 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, 0);
    scene.add(road);
    const center = [];
    for (let z = -48; z <= 48; z += 5) center.push(V(0, 0.045, z));
    const centerLine = curveLine(center, PALETTE.amber, 0.42, true);
    scene.add(centerLine.line);
    for (let z = -44; z <= 44; z += 22) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.4), new THREE.MeshBasicMaterial({ color: 0xd7e7ee, transparent: true, opacity: 0.55, toneMapped: false }));
      light.position.set(3.5, 0.08, z);
      scene.add(light);
    }

    const river = makeWater(14, 96, 36, 0x082535, 0x1d6d7c);
    river.position.set(25, 0.03, 0);
    scene.add(river);

    const hills = [
      { x: -27, z: -34, r: 18, h: 7 },
      { x: -38, z: 20, r: 22, h: 9 },
      { x: -24, z: 42, r: 14, h: 5 },
    ];
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x0b1d18, roughness: 0.95, metalness: 0.04, flatShading: true });
    for (const h of hills) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(h.r, h.h, 7, 1), hillMat);
      m.position.set(h.x, h.h / 2 - 0.2, h.z);
      scene.add(m);
    }

    const poles = [];
    const poleData = [
      [-7, -32, PALETTE.emerald, 'P1'],
      [-7, -18, PALETTE.emerald, 'P2'],
      [-7, 0, PALETTE.amber, 'C1'],
      [-7, 18, PALETTE.emerald, 'P3'],
      [-7, 32, PALETTE.emerald, 'P4'],
      [7, -26, PALETTE.emerald, 'P5'],
      [7, -8, PALETTE.amber, 'C2'],
      [7, 12, PALETTE.emerald, 'P6'],
      [7, 28, PALETTE.amber, 'C3'],
    ];
    for (const [x, z, color, label] of poleData) {
      const p = cameraPole(color, label);
      p.position.set(x, 0, z);
      p.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(p);
      poles.push({ g: p, x, z, color, label });
    }

    const forbidden = [];
    for (const [x, z, label] of [[-27, -18, 'ALPR'], [-27, 0, 'BIOMETRÍA'], [-27, 18, 'OJO DE DIOS']]) {
      const n = forbiddenNode(label);
      n.position.set(x, 0, z);
      n.rotation.y = Math.PI / 2;
      scene.add(n);
      forbidden.push({ g: n, phase: rnd() * TAU });
    }

    const eye = new THREE.Group();
    eye.position.set(0, 10.6, 0);
    scene.add(eye);
    const sclera = new THREE.Mesh(
      new THREE.CircleGeometry(2.75, 64),
      new THREE.MeshBasicMaterial({ color: 0xcfeef5, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    eye.add(sclera);
    const iris = new THREE.Mesh(
      new THREE.RingGeometry(1.08, 2.68, 64),
      new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    iris.position.z = 0.01;
    eye.add(iris);
    const pupil = new THREE.Mesh(
      new THREE.CircleGeometry(1.06, 48),
      new THREE.MeshBasicMaterial({ color: 0x020506, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    );
    pupil.position.z = 0.02;
    eye.add(pupil);
    const glint = glowSprite(0xffffff, 0.55, 0.75);
    glint.position.set(-0.45, 0.45, 0.06);
    eye.add(glint);

    const radial = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([V(Math.cos(a) * 1.08, Math.sin(a) * 1.08, 0.03), V(Math.cos(a) * 2.62, Math.sin(a) * 2.62, 0.03)]),
        new THREE.LineBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.24, toneMapped: false })
      );
      eye.add(line);
      radial.push(line);
    }

    const rings = [];
    for (const [r, color, label] of [[3.35, PALETTE.emerald, 'PASIVO'], [4.55, PALETTE.amber, 'CONVENIO'], [5.75, PALETTE.coral, 'NUNCA']]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.032, 8, 120),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
      );
      eye.add(ring);
      rings.push(ring);
      const lab = textSprite(label, { size: 28, scale: 0.24, color: label === 'NUNCA' ? '#ffc4b7' : label === 'CONVENIO' ? '#ffe8a9' : '#c6f7e6', border: 'rgba(145,215,232,0.25)', bg: 'rgba(4,14,18,0.72)', mono: true });
      lab.position.set(-r * 0.74, r * 0.72, 0.08);
      eye.add(lab);
      ring.userData.label = lab;
    }

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(7.2, 0.018, 6, 160),
      new THREE.MeshBasicMaterial({ color: 0x5bbdd4, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    orbit.rotation.x = 1.18;
    eye.add(orbit);

    const eyeBeam = new THREE.Mesh(
      new THREE.ConeGeometry(6.4, 10.6, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    eyeBeam.position.y = -5.4;
    eye.add(eyeBeam);

    const scan = ringWave(PALETTE.ice, 7.4, 0.25);
    scan.position.set(0, 0.05, 0);
    scene.add(scan);

    const beams = [];
    for (const p of poles) {
      const start = V(p.x, 4.45 * 0.9, p.z);
      const end = V(p.x < 0 ? -2.1 : 2.1, 0.2, p.z);
      const beam = cylinderBetween(start, end, 0.025, p.color, 0.26);
      scene.add(beam);
      beams.push({ mesh: beam, phase: rnd() * TAU });
    }

    const visibility = [];
    for (let i = 0; i < 38; i++) {
      const s = glowSprite(i % 6 === 0 ? PALETTE.amber : PALETTE.ice, 0.35, 0.35);
      s.userData.base = V((rnd() - 0.5) * 8, 0.4 + rnd() * 1.2, (rnd() - 0.5) * 90);
      s.userData.phase = rnd() * TAU;
      scene.add(s);
      visibility.push(s);
    }

    const chapters = [
      {
        start: 0,
        end: 4.2,
        kicker: '01 · OJO PÚBLICO',
        title: 'Mirar la carretera, no a las personas',
        subtitle: 'Solo cámaras y datos que su licencia permite reutilizar. La imagen se usa para ver niebla, humo y firme.',
        metrics: [
          { value: '3', label: 'modos de acceso', tone: 'ice' },
          { value: '0', label: 'cámaras privadas', tone: 'coral' },
          { value: 'NUNCA', label: 'a personas', tone: 'violet' },
        ],
      },
      {
        start: 4.2,
        end: 8.4,
        kicker: '02 · TRES PUERTAS',
        title: 'Pasivo, convenio o nunca',
        subtitle: 'Si la licencia no permite el uso, no se usa. No hay atajos ni cámaras ajenas sin permiso.',
        metrics: [
          { value: 'PASIVO', label: 'datos abiertos', tone: 'emerald' },
          { value: 'CONVENIO', label: 'acuerdo explícito', tone: 'amber' },
          { value: 'NUNCA', label: 'vigilancia', tone: 'coral' },
        ],
      },
      {
        start: 8.4,
        end: 12.6,
        kicker: '03 · CERO VIGILANCIA',
        title: 'Visibilidad, niebla y humo',
        subtitle: 'Lo que se mide es el paisaje. El sistema no identifica personas, matrículas ni conversaciones.',
        metrics: [
          { value: '0', label: 'caras reconocidas', tone: 'coral' },
          { value: '0', label: 'matrículas leídas', tone: 'coral' },
          { value: 'PAISAJE', label: 'único objetivo', tone: 'emerald' },
        ],
      },
    ];

    const cameraPlan = [
      { t: 0, pos: [0, 16, 38], look: [0, 6, 0], fov: 40 },
      { t: 3.6, pos: [-22, 13, 23], look: [0, 6, 0], fov: 41 },
      { t: 6.6, pos: [23, 12, 22], look: [0, 6.5, 0], fov: 41 },
      { t: 9.2, pos: [13, 15, 28], look: [0, 6, 0], fov: 42 },
      { t: 12.6, pos: [0, 24, 23], look: [0, 5, 0], fov: 40 },
    ];

    return {
      duration: 12.6,
      chapters,
      update(t) {
        cameraKeys(camera, t, cameraPlan);
        eye.lookAt(camera.position);
        eye.rotation.z = 0.05 * Math.sin(t * 0.35);
        iris.material.opacity = 0.55 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.7));
        pupil.scale.setScalar(0.92 + 0.05 * Math.sin(t * 2.1));
        glint.position.x = -0.45 + 0.08 * Math.sin(t * 1.2);
        glint.position.y = 0.45 + 0.06 * Math.cos(t * 1.1);
        for (let i = 0; i < radial.length; i++) radial[i].material.opacity = 0.13 + 0.14 * (0.5 + 0.5 * Math.sin(t * 2 + i * 0.25));
        for (let i = 0; i < rings.length; i++) {
          rings[i].rotation.z = (i % 2 ? -1 : 1) * t * (0.025 + i * 0.008);
          rings[i].material.opacity = 0.55 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.5 + i));
          const lab = rings[i].userData.label;
          if (lab) {
            fitSprite(lab, camera, 22, 0.08, 2.3);
            lab.material.opacity = 0.8;
          }
        }
        orbit.rotation.z = t * 0.06;
        eyeBeam.material.opacity = 0.02 + 0.026 * (0.5 + 0.5 * Math.sin(t * 1.8));
        scan.scale.setScalar(1 + 0.06 * Math.sin(t * 0.8));
        scan.material.opacity = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.4));

        for (const f of forbidden) {
          f.g.userData.shield.scale.setScalar(0.94 + 0.08 * Math.sin(t * 2.3 + f.phase));
          f.g.userData.shield.material.opacity = 0.035 + 0.035 * (0.5 + 0.5 * Math.sin(t * 2.1 + f.phase));
          f.g.userData.halo.material.opacity = 0.28 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.2 + f.phase));
          fitSprite(f.g.userData.tag, camera, 22, 0.07, 2);
        }
        for (const p of poles) {
          p.g.userData.halo.material.opacity = 0.38 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + p.z));
          fitSprite(p.g.userData.tag, camera, 24, 0.06, 1.8);
        }
        for (let i = 0; i < beams.length; i++) beams[i].mesh.material.opacity = 0.1 + 0.1 * (0.5 + 0.5 * Math.sin(t * 2 + beams[i].phase));
        for (const v of visibility) {
          v.position.set(v.userData.base.x, 0.4 + ((v.userData.base.y + t * 0.7) % 2.4), v.userData.base.z);
          v.material.opacity = 0.08 + 0.26 * (0.5 + 0.5 * Math.sin(t * 1.6 + v.userData.phase));
          fitSprite(v, camera, 24, 0.05, 1.6);
        }
        river.material.uniforms.uTime.value = t;
      },
    };
  },
};

import {
  TAU, PALETTE, clamp, smooth, mulberry32, addStars, addGrid, addDust,
  glowSprite, textSprite, makeDrone, curveLine, cameraKeys, fitSprite, ringWave,
} from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function thermalTexture(seed = 12) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)';
  g.fillRect(0, 0, 512, 512);
  const rnd = mulberry32(seed);
  for (let i = 0; i < 22; i++) {
    const x = 42 + rnd() * 428;
    const y = 52 + rnd() * 400;
    const r = 14 + rnd() * 48;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const hot = rnd() > 0.45;
    rg.addColorStop(0, hot ? 'rgba(255,176,90,0.95)' : 'rgba(90,220,255,0.75)');
    rg.addColorStop(0.32, hot ? 'rgba(255,92,50,0.52)' : 'rgba(30,120,210,0.35)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default {
  id: 'dron',
  title: 'Dron casa por casa',
  duration: 12.2,
  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(4481);
    scene.fog = new THREE.FogExp2(0x061018, 0.0085);

    scene.add(new THREE.HemisphereLight(0xa8e2ee, 0x020406, 1.0));
    const key = new THREE.DirectionalLight(0xffd6b0, 2.1);
    key.position.set(24, 45, 28);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x5fbad4, 1.7);
    rim.position.set(-28, 20, -20);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x6f9fac, 0.42));

    addStars(scene, 500, 230, 5);
    addGrid(scene, 150, 48, 0x1a4454, 0x0a1c24);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 150),
      new THREE.MeshStandardMaterial({ color: 0x050d12, roughness: 0.9, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    scene.add(floor);
    addDust(scene, 180, 80, 0x7fb9c9, 13);

    const facade = new THREE.Group();
    scene.add(facade);
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(17, 15, 6),
      new THREE.MeshStandardMaterial({ color: 0x0c2029, roughness: 0.5, metalness: 0.45, emissive: 0x081720, emissiveIntensity: 0.65 })
    );
    shell.position.y = 7.5;
    facade.add(shell);
    const shellEdges = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry), new THREE.LineBasicMaterial({ color: 0x4c91a4, transparent: true, opacity: 0.55 }));
    shellEdges.position.copy(shell.position);
    facade.add(shellEdges);

    const winPos = [];
    const winCol = [];
    const roomPts = [];
    for (let f = 0; f < 6; f++) {
      for (let c = 0; c < 9; c++) {
        const x = -7.2 + c * 1.8;
        const y = 1.2 + f * 2.15;
        winPos.push(x, y, 3.015);
        const warm = rnd() > 0.54;
        winCol.push(warm ? 1.0 : 0.45, warm ? 0.74 : 0.85, warm ? 0.44 : 1.0);
        if (rnd() > 0.58) {
          const p = glowSprite(rnd() > 0.7 ? PALETTE.amber : PALETTE.ice, 0.65, 0.55);
          p.position.set(x, y, 3.16);
          facade.add(p);
          roomPts.push(p);
        }
      }
    }
    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute('position', new THREE.Float32BufferAttribute(winPos, 3));
    winGeo.setAttribute('color', new THREE.Float32BufferAttribute(winCol, 3));
    const windows = new THREE.Points(winGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    facade.add(windows);

    const thermal = new THREE.Mesh(
      new THREE.PlaneGeometry(16.5, 14.5),
      new THREE.MeshBasicMaterial({ map: thermalTexture(21), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    thermal.position.set(0, 7.5, 3.12);
    facade.add(thermal);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(17.6, 0.35, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x26424c, roughness: 0.55, metalness: 0.4 })
    );
    roof.position.y = 15.15;
    facade.add(roof);
    for (let i = 0; i < 3; i++) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), new THREE.MeshBasicMaterial({ color: 0x7fa5b1, transparent: true, opacity: 0.65 }));
      mast.position.set(-4 + i * 4, 16.2, 0);
      facade.add(mast);
      const led = glowSprite(PALETTE.coral, 0.6, 0.8);
      led.position.set(-4 + i * 4, 17.3, 0);
      facade.add(led);
    }

    const routePts = [
      V(-16, 11, 13), V(-10, 13, 16), V(-2, 14, 17), V(8, 13.4, 16), V(16, 11, 13),
      V(18, 10, 3), V(12, 12, -2), V(0, 13, -4), V(-13, 12, -2), V(-18, 10, 4), V(-16, 11, 13),
    ];
    const route = new THREE.CatmullRomCurve3(routePts, true);
    const routeLine = curveLine(routePts, PALETTE.ice, 0.28, true);
    routeLine.line.material.depthTest = false;
    routeLine.line.renderOrder = 20;
    scene.add(routeLine.line);

    const drone = makeDrone(PALETTE.ice);
    drone.scale.setScalar(1.75);
    scene.add(drone);
    const droneLabel = textSprite('BARRIDO · 1/3', { size: 34, scale: 0.26, color: '#d7f8ff', border: 'rgba(145,215,232,0.35)', bg: 'rgba(4,14,18,0.76)', mono: true });
    scene.add(droneLabel);

    const scanGeo = new THREE.BufferGeometry();
    scanGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const scan = new THREE.Mesh(scanGeo, new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(scan);

    const target = V(0, 7.2, 3.2);
    const scanRing = ringWave(PALETTE.ice, 2.4, 0.6);
    scanRing.position.copy(target);
    scene.add(scanRing);

    const pointCloud = [];
    for (let i = 0; i < 60; i++) {
      const p = glowSprite(rnd() > 0.12 ? PALETTE.ice : PALETTE.amber, 0.22, 0.6);
      p.userData.p = V((rnd() - 0.5) * 17, rnd() * 15, 3.3 + rnd() * 1.2);
      p.userData.phase = rnd() * TAU;
      scene.add(p);
      pointCloud.push(p);
    }

    const chapters = [
      {
        start: 0,
        end: 4.1,
        kicker: '01 · UN DRON, MUCHAS CASAS',
        title: 'Volar lo mínimo, mirar lo justo',
        subtitle: 'La ruta se ordena por daño, batería y probabilidad. El dron no entra: rodea y escucha.',
        metrics: [
          { value: '1', label: 'dron en la escena', tone: 'ice' },
          { value: '6', label: 'plantas por fachada', tone: 'violet' },
          { value: '0', label: 'puertas forzadas', tone: 'coral' },
        ],
      },
      {
        start: 4.1,
        end: 8.2,
        kicker: '02 · FACHADA A FACHADA',
        title: 'Bluetooth, térmica y estructura',
        subtitle: 'Tres señales independientes. El resultado es un recuento con margen, no una identificación.',
        metrics: [
          { value: '3', label: 'pasadas por edificio', tone: 'ice' },
          { value: '12', label: 'lecturas por planta', tone: 'amber' },
          { value: '0', label: 'contenidos leídos', tone: 'coral' },
        ],
      },
      {
        start: 8.2,
        end: 12.2,
        kicker: '03 · TABLERO DE PRIORIDAD',
        title: 'Personas probables, decisiones humanas',
        subtitle: 'El tablero ordena edificios. Quien decide dónde entrar sigue siendo el equipo de rescate.',
        metrics: [
          { value: '24', label: 'personas probables', tone: 'emerald' },
          { value: '6', label: 'plantas cubiertas', tone: 'ice' },
          { value: 'HUMANO', label: 'cierre del caso', tone: 'amber' },
        ],
      },
    ];

    const cameraPlan = [
      { t: 0, pos: [7, 10, 19], look: [0, 9, 1], fov: 38 },
      { t: 3.2, pos: [16, 13, 18], look: [0, 8, 2], fov: 40 },
      { t: 5.8, pos: [8, 10, 18], look: [0, 7.5, 3], fov: 42 },
      { t: 8.4, pos: [0, 15, 23], look: [0, 8, 1], fov: 42 },
      { t: 10.6, pos: [-12, 17, 22], look: [0, 7, 0], fov: 41 },
      { t: 12.2, pos: [0, 19, 25], look: [0, 7, 0], fov: 40 },
    ];

    return {
      duration: 12.2,
      chapters,
      update(t) {
        cameraKeys(camera, t, cameraPlan);
        const u = (t * 0.055) % 1;
        const p = route.getPointAt(u);
        const ahead = route.getPointAt((u + 0.01) % 1);
        drone.position.copy(p);
        drone.position.y += 0.18 * Math.sin(t * 2.2);
        drone.lookAt(target);
        for (const r of drone.userData.rotors) r.rotation.y = t * 48;
        drone.userData.led.material.opacity = 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(t * 9));

        const dist = p.distanceTo(target);
        droneLabel.position.copy(p).add(V(0, 1.3, 0));
        fitSprite(droneLabel, camera, 18, 0.07, 2.2);
        droneLabel.material.opacity = smooth(0, 1.2, t) * (1 - smooth(10.8, 12.2, t));

        const left = V(target.x - 3.5, target.y - 2.4, target.z);
        const right = V(target.x + 3.5, target.y + 2.4, target.z);
        const arr = scanGeo.attributes.position.array;
        arr[0] = p.x; arr[1] = p.y; arr[2] = p.z;
        arr[3] = left.x; arr[4] = left.y; arr[5] = left.z;
        arr[6] = right.x; arr[7] = right.y; arr[8] = right.z;
        scanGeo.attributes.position.needsUpdate = true;
        scanGeo.computeVertexNormals();
        scan.material.opacity = 0.035 + 0.05 * (0.5 + 0.5 * Math.sin(t * 2.4));

        thermal.material.opacity = 0.12 + 0.28 * smooth(4.2, 6.2, t) * (1 - 0.45 * smooth(9.8, 11.4, t));
        scanRing.scale.setScalar(0.6 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2.3)));
        scanRing.material.opacity = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.3));

        for (let i = 0; i < pointCloud.length; i++) {
          const q = pointCloud[i];
          q.position.copy(q.userData.p);
          q.position.x += 0.12 * Math.sin(t * 1.7 + q.userData.phase);
          q.position.y += 0.12 * Math.cos(t * 1.3 + q.userData.phase);
          q.material.opacity = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.4 + i));
          fitSprite(q, camera, 16, 0.04, 1.4);
        }
        for (const p of roomPts) p.material.opacity = 0.28 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3 + p.position.x));
        windows.material.opacity = 0.75 + 0.25 * smooth(6, 8, t);
      },
    };
  },
};

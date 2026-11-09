import {
  TAU, PALETTE, clamp, lerp, smooth, easeInOut, mulberry32,
  addStars, addGrid, addDust, glowSprite, textSprite, makePhone, makePacket,
  makeTrail, updateTrail, curveLine, cylinderBetween, cameraKeys, ringWave, fitSprite,
} from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  id: 'mensaje',
  title: 'Mensaje sin red',
  duration: 14.2,
  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(357397);

    scene.fog = new THREE.FogExp2(0x07131b, 0.0068);

    scene.add(new THREE.HemisphereLight(0xa8e2ee, 0x020406, 1.15));
    const key = new THREE.DirectionalLight(0xffd6b0, 2.35);
    key.position.set(28, 54, 24);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6cc6e0, 1.9);
    rim.position.set(-40, 22, -30);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x2c6578, 1.1);
    fill.position.set(26, 12, 38);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0x6f9fac, 0.52));

    addStars(scene, 520, 240, 11);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 150),
      new THREE.MeshStandardMaterial({ color: 0x050d12, roughness: 0.82, metalness: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    scene.add(floor);
    addGrid(scene, 150, 50, 0x1b4454, 0x0a1c24);

    const A = V(-20, 2.4, 14);
    const P1 = V(-10, 3.8, 9);
    const P2 = V(-1, 5.1, 3);
    const P3 = V(9, 4.6, -2);
    const C = V(19, 2.8, -8);
    const routePts = [A, P1, P2, P3, C];

    const distToRoute = (x, z) => {
      let best = 1e9;
      for (let i = 0; i < routePts.length - 1; i++) {
        const a = routePts[i];
        const b = routePts[i + 1];
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const k = clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz));
        const dx = x - (a.x + abx * k);
        const dz = z - (a.z + abz * k);
        best = Math.min(best, Math.hypot(dx, dz));
      }
      return best;
    };

    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x10232c, roughness: 0.42, metalness: 0.42, emissive: 0x07151d, emissiveIntensity: 0.8 });
    const buildingMat2 = new THREE.MeshStandardMaterial({ color: 0x16303a, roughness: 0.5, metalness: 0.32, emissive: 0x08171f, emissiveIntensity: 0.7 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x4d8798, transparent: true, opacity: 0.5 });
    const winPositions = [];
    const winColors = [];
    const roofs = [];
    const buildings = [];

    const footprints = [];
    for (let i = 0; i < 46; i++) {
      let x = (rnd() - 0.5) * 92;
      let z = (rnd() - 0.5) * 78;
      if (Math.abs(x) < 7 && Math.abs(z) < 8) {
        x += x < 0 ? -13 : 13;
        z += z < 0 ? -11 : 11;
      }
      const w = 2.4 + rnd() * 4.4;
      const d = 2.4 + rnd() * 4.2;
      const h = 2.2 + Math.pow(rnd(), 1.7) * 17;
      if (distToRoute(x, z) < 7.2 + Math.max(w, d) * 0.5) continue;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rnd() > 0.55 ? buildingMat : buildingMat2);
      b.position.set(x, h / 2, z);
      scene.add(b);
      buildings.push(b);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), edgeMat);
      e.position.copy(b.position);
      scene.add(e);
      footprints.push({ x, z, w, d, h });
      if (h > 11 && rnd() > 0.45) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.4, 6), new THREE.MeshBasicMaterial({ color: 0x5e8592, transparent: true, opacity: 0.7 }));
        mast.position.set(x, h + 1.2, z);
        scene.add(mast);
        const beacon = glowSprite(PALETTE.coral, 0.7, 0.85);
        beacon.position.set(x, h + 2.4, z);
        scene.add(beacon);
        roofs.push(beacon);
      }
      const rows = Math.max(1, Math.floor(h / 1.7));
      const cols = Math.max(1, Math.floor(w / 1.3));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rnd() < 0.4) continue;
          const wx = x - w / 2 + 0.7 + c * 1.3;
          const wy = 0.9 + r * 1.7;
          winPositions.push(wx, wy, z + d / 2 + 0.012);
          const warm = rnd() > 0.58;
          winColors.push(warm ? 1.0 : 0.52, warm ? 0.72 : 0.88, warm ? 0.42 : 1.0);
          if (rnd() > 0.72) {
            winPositions.push(wx, wy, z - d / 2 - 0.012);
            winColors.push(warm ? 1.0 : 0.52, warm ? 0.72 : 0.88, warm ? 0.42 : 1.0);
          }
        }
      }
    }

    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute('position', new THREE.Float32BufferAttribute(winPositions, 3));
    winGeo.setAttribute('color', new THREE.Float32BufferAttribute(winColors, 3));
    const winMat = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const windows = new THREE.Points(winGeo, winMat);
    scene.add(windows);

    const towers = [];
    for (const [x, z, h] of [[-27, -24, 24], [4, -34, 29], [33, -25, 21]]) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.2, h, 8),
        new THREE.MeshStandardMaterial({ color: 0x17313d, roughness: 0.4, metalness: 0.7 })
      );
      body.position.y = h / 2;
      g.add(body);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.2 + i * 0.35, 0.022, 6, 46),
          new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = h - 2.2 + i * 0.8;
        ring.userData.phase = i * 0.7;
        g.add(ring);
        towers.push(ring);
      }
      const tip = glowSprite(PALETTE.red, 2.4, 0.9);
      tip.position.y = h + 0.1;
      g.add(tip);
      g.position.set(x, 0, z);
      scene.add(g);
    }

    for (let i = 0; i < 3; i++) {
      const a = V(-27, 22 - i * 0.4, -24);
      const b = V(4, 26 - i * 0.5, -34);
      const c = V(33, 19 - i * 0.3, -25);
      const l1 = curveLine([a, V(-12, 30 + i, -29), b], PALETTE.red, 0.42 - i * 0.08, true);
      const l2 = curveLine([b, V(19, 28 + i, -31), c], PALETTE.red, 0.36 - i * 0.07, true);
      scene.add(l1.line, l2.line);
    }

    const route = new THREE.CatmullRomCurve3(routePts);
    const routeLine = curveLine(routePts, PALETTE.ice, 0.44, true);
    routeLine.line.material.depthTest = false;
    routeLine.line.renderOrder = 30;
    scene.add(routeLine.line);

    const phoneA = makePhone(PALETTE.coral);
    phoneA.position.copy(A);
    phoneA.rotation.y = 0.55;
    scene.add(phoneA);
    const phoneC = makePhone(PALETTE.ice);
    phoneC.position.copy(C);
    phoneC.rotation.y = -0.5;
    scene.add(phoneC);

    const labelA = textSprite('A · ORIGEN', { size: 44, scale: 0.42, color: '#ffd2c6', border: 'rgba(255,119,86,0.5)', bg: 'rgba(24,10,8,0.78)' });
    labelA.position.copy(A).add(V(0, 1.35, 0));
    scene.add(labelA);
    const labelC = textSprite('C · DESTINO', { size: 44, scale: 0.42, color: '#d5f7ff', border: 'rgba(145,215,232,0.5)', bg: 'rgba(5,18,24,0.78)' });
    labelC.position.copy(C).add(V(0, 1.35, 0));
    scene.add(labelC);

    const humans = [];
    for (const [x, z, color] of [[-13, 17, PALETTE.ice], [3, 12, PALETTE.amber], [14, 7, PALETTE.ice], [-5, -5, PALETTE.violet], [24, 17, PALETTE.emerald]]) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.52, 6, 10), new THREE.MeshStandardMaterial({ color: 0x1b313b, roughness: 0.6, metalness: 0.2 }));
      body.position.y = 0.55;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xb7cbd2, roughness: 0.7 }));
      head.position.y = 1.05;
      g.add(body, head);
      const halo = glowSprite(color, 1.2, 0.45);
      halo.position.y = 0.75;
      g.add(halo);
      g.position.set(x, 0, z);
      scene.add(g);
      humans.push(g);
    }

    const mules = [];
    for (const [u, color] of [[0.36, PALETTE.amber], [0.64, PALETTE.violet], [0.84, PALETTE.emerald]]) {
      const p = route.getPointAt(u);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 6, 10), new THREE.MeshStandardMaterial({ color: 0x24424c, roughness: 0.45, metalness: 0.35 }));
      body.position.y = 0.6;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc7dbe1, roughness: 0.65 }));
      head.position.y = 1.12;
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.16), new THREE.MeshStandardMaterial({ color: 0x091116, roughness: 0.4, metalness: 0.6 }));
      pack.position.set(0, 0.72, -0.22);
      const halo = glowSprite(color, 1.3, 0.55);
      halo.position.y = 0.7;
      g.add(body, head, pack, halo);
      g.position.set(p.x, 0, p.z);
      g.userData.base = p;
      g.userData.color = color;
      scene.add(g);
      mules.push(g);
    }

    const muleLabel = textSprite('PORTADOR · SIN LECTURA', { size: 38, scale: 0.34, color: '#ffe6a6', border: 'rgba(251,191,36,0.42)', bg: 'rgba(20,16,4,0.72)' });
    muleLabel.position.copy(mules[0].position).add(V(0, 1.7, 0));
    scene.add(muleLabel);

    const fragments = [];
    const curves = [];
    for (let i = 0; i < 5; i++) {
      const jitter = (i - 2) * 0.55;
      const pts = [
        A,
        V(P1.x + jitter * 0.32, P1.y + Math.sin(i * 1.7) * 0.35, P1.z + jitter * 0.4),
        V(P2.x + jitter * 0.55, P2.y + Math.cos(i * 1.3) * 0.45, P2.z + jitter * 0.35),
        V(P3.x + jitter * 0.5, P3.y + Math.sin(i * 0.9) * 0.4, P3.z - jitter * 0.35),
        C,
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      curves.push(curve);
      const color = [PALETTE.coral, PALETTE.amber, PALETTE.ice, PALETTE.violet, PALETTE.emerald][i];
      const mesh = makePacket(color, 0.23 + (i % 2) * 0.04);
      scene.add(mesh);
      const trail = makeTrail(color, 14, 0.09);
      scene.add(trail);
      const label = textSprite(`F${i + 1}`, { size: 34, scale: 0.17, color: '#e9f7fb', border: 'rgba(145,215,232,0.3)', bg: 'rgba(4,12,16,0.6)', mono: true });
      scene.add(label);
      fragments.push({ mesh, trail, label, curve, color, drop: i === 1 || i === 3, start: 4.25 + i * 0.12 });
    }

    const receipt = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.055, 12, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.emerald, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    receipt.rotation.x = Math.PI / 2;
    receipt.position.copy(C).add(V(0, 1.1, 0));
    scene.add(receipt);
    const receiptGlow = glowSprite(PALETTE.emerald, 2.6, 0.5);
    receiptGlow.position.copy(receipt.position);
    scene.add(receiptGlow);
    const receiptLabel = textSprite('RECIBO', { size: 36, scale: 0.26, color: '#c9ffe8', border: 'rgba(52,211,153,0.45)', bg: 'rgba(4,20,14,0.72)', mono: true });
    receiptLabel.position.copy(receipt.position).add(V(0, 1.0, 0));
    scene.add(receiptLabel);

    const originPulse = ringWave(PALETTE.emerald, 1.2, 0.75);
    originPulse.position.copy(A).add(V(0, 0.18, 0));
    scene.add(originPulse);

    const destPulse = ringWave(PALETTE.ice, 2.2, 0.65);
    destPulse.position.copy(C).add(V(0, 0.18, 0));
    scene.add(destPulse);

    const dust = addDust(scene, 220, 90, 0x7fb9c9, 21);

    const chapters = [
      {
        start: 0,
        end: 4.1,
        kicker: '01 · RED CAÍDA',
        title: 'Cuando cae la red, el mensaje sigue',
        subtitle: 'Sin cobertura, sin servidor, sin nube. Los móviles se convierten en la red.',
        metrics: [
          { value: '0%', label: 'ACK de la torre', tone: 'coral' },
          { value: '5', label: 'fragmentos por mensaje', tone: 'ice' },
          { value: '3-de-5', label: 'quórum de reconstrucción', tone: 'emerald' },
        ],
      },
      {
        start: 4.1,
        end: 8.35,
        kicker: '02 · MENSAJE EN MOVIMIENTO',
        title: 'Cinco fragmentos, rutas distintas',
        subtitle: 'Cada portador lleva una parte. Ninguno puede leer el mensaje completo.',
        metrics: [
          { value: '30/30', label: 'entregas simuladas', tone: 'emerald' },
          { value: '347 B', label: 'sobre p50', tone: 'ice' },
          { value: '0', label: 'servidores implicados', tone: 'violet' },
        ],
      },
      {
        start: 8.35,
        end: 12.3,
        kicker: '03 · RECIBO VERIFICADO',
        title: 'La entrega se demuestra, no se supone',
        subtitle: 'El recibo vuelve por la malla, se verifica en el origen y se purga si no es válido.',
        metrics: [
          { value: '30/30', label: 'recibos verificados', tone: 'emerald' },
          { value: '0', label: 'recibos falsos aceptados', tone: 'coral' },
          { value: '1311 s', label: 'p95 de entrega', tone: 'amber' },
        ],
      },
      {
        start: 12.3,
        end: 14.2,
        kicker: 'SENDA · DTN',
        title: 'La red que no necesita red',
        subtitle: 'Malla oportunista, cuarentena de recibos y un núcleo que se puede auditar.',
        metrics: [
          { value: '248', label: 'pruebas del núcleo', tone: 'ice' },
          { value: '100%', label: 'caos simulado superado', tone: 'emerald' },
          { value: 'OFFLINE', label: 'por diseño', tone: 'violet' },
        ],
      },
    ];

    const cameraPlan = [
      { t: 0, pos: [0, 36, 68], look: [0, 7, -4], fov: 38 },
      { t: 2.4, pos: [-6, 28, 58], look: [-8, 6, -1], fov: 40 },
      { t: 4.3, pos: [-24, 20, 46], look: [-15, 4, 11], fov: 42 },
      { t: 6.6, pos: [0, 24, 50], look: [0, 4, 5], fov: 44 },
      { t: 8.6, pos: [12, 20, 42], look: [9, 4, 0], fov: 42 },
      { t: 10.8, pos: [12, 20, 40], look: [7, 4, 1], fov: 42 },
      { t: 12.4, pos: [4, 26, 46], look: [1, 3, 4], fov: 42 },
      { t: 14.2, pos: [0, 42, 34], look: [0, 0, 1], fov: 40 },
    ];

    return {
      duration: 14.2,
      chapters,
      update(t) {
        cameraKeys(camera, t, cameraPlan);
        fitSprite(labelA, camera, 18, 0.08, 2.5);
        fitSprite(labelC, camera, 18, 0.08, 2.5);
        labelA.visible = t < 4.15 || t > 12.7;
        labelC.visible = true;

        for (const g of humans) g.visible = t < 10.4 && camera.position.distanceTo(g.position) > 7;

        const collapse = smooth(0.0, 3.7, t);
        const meshOn = smooth(3.9, 5.2, t);
        winMat.opacity = 0.58 + 0.22 * Math.sin(t * 11) * (1 - smooth(3.5, 5, t)) + 0.15 * meshOn;

        for (const ring of towers) {
          const p = 0.5 + 0.5 * Math.sin(t * 5.4 + ring.userData.phase);
          ring.scale.setScalar(1 + p * 0.22);
          ring.material.opacity = (0.18 + p * 0.5) * (1 - smooth(4.2, 5.4, t));
        }
        for (const beacon of roofs) {
          beacon.material.opacity = (0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * 4.2 + beacon.position.x))) * (1 - 0.55 * collapse);
        }

        for (let i = 0; i < mules.length; i++) {
          const m = mules[i];
          const u = 0.30 + i * 0.2 + 0.035 * Math.sin(t * 0.7 + i * 2.2);
          const p = route.getPointAt(clamp(u));
          const next = route.getPointAt(clamp(u + 0.01));
          m.position.set(p.x, 0.02 * Math.sin(t * 3 + i), p.z);
          m.rotation.y = Math.atan2(next.x - p.x, next.z - p.z);
          m.visible = t < 11.4 && camera.position.distanceTo(m.position) > 4.2;
        }
        muleLabel.visible = t < 11.2 && mules[0].visible;
        muleLabel.position.copy(mules[0].position).add(V(0, 1.55, 0));
        fitSprite(muleLabel, camera, 18, 0.08, 2.5);

        for (let i = 0; i < fragments.length; i++) {
          const f = fragments[i];
          const local = t - f.start;
          const u = easeInOut(clamp(local / 5.7));
          const visible = t >= f.start && t < 11.2;
          const dropFade = f.drop ? 1 - smooth(0.56, 0.78, u) : 1;
          const endFade = 1 - smooth(10.2, 11.2, t);
          f.mesh.visible = visible && dropFade > 0.01 && endFade > 0.01;
          f.trail.visible = f.mesh.visible;
          f.label.visible = f.mesh.visible;
          if (!f.mesh.visible) continue;
          const p = f.curve.getPointAt(u);
          f.mesh.position.copy(p);
          f.mesh.position.y += 0.1 * Math.sin(t * 4 + i);
          f.mesh.rotation.x = t * 0.9 + i;
          f.mesh.rotation.y = t * 1.2 + i * 0.7;
          f.mesh.material.opacity = dropFade * endFade;
          f.mesh.children[0].material.opacity = 0.5 * dropFade * endFade;
          const trailPts = [];
          for (let j = 0; j < 14; j++) trailPts.push(f.curve.getPointAt(clamp(u - j * 0.008)));
          updateTrail(f.trail, trailPts);
          f.trail.material.opacity = 0.85 * dropFade * endFade;
          f.label.position.copy(p).add(V(0, 0.55, 0));
          f.label.material.opacity = 0.9 * dropFade * endFade;
          fitSprite(f.label, camera, 16, 0.05, 2.0);
        }

        const arrive = smooth(9.9, 10.6, t);
        receipt.visible = t > 3.4;
        receiptGlow.visible = receipt.visible;
        receiptLabel.visible = t > 3.4;
        if (t < 10.4) {
          receipt.position.copy(C).add(V(0, 1.1 + 0.06 * Math.sin(t * 3), 0));
          receipt.rotation.z = t * 0.7;
          receipt.scale.setScalar(0.8 + 0.22 * Math.sin(t * 2.4));
          receipt.material.opacity = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3.4));
          receiptGlow.material.opacity = 0.22 + 0.2 * (0.5 + 0.5 * Math.sin(t * 3.4));
          receiptLabel.material.opacity = 0.72;
        } else {
          const ru = 1 - smooth(10.4, 13.1, t);
          const rp = route.getPointAt(ru);
          receipt.position.copy(rp).add(V(0, 0.8, 0));
          receipt.rotation.z = t * 2.4;
          receipt.scale.setScalar(1.05 + 0.15 * Math.sin(t * 5));
          receipt.material.opacity = 0.95;
          receiptGlow.material.opacity = 0.5;
          receiptGlow.position.copy(receipt.position);
          receiptLabel.position.copy(receipt.position).add(V(0, 0.9, 0));
          receiptLabel.material.opacity = 0.9 * (1 - smooth(12.8, 13.3, t));
        }
        receiptGlow.position.copy(receipt.position);
        fitSprite(receiptLabel, camera, 16, 0.05, 2.0);

        originPulse.scale.setScalar(1 + 2.5 * smooth(12.9, 14.2, t));
        originPulse.material.opacity = 0.65 * (1 - smooth(12.9, 14.2, t));
        destPulse.scale.setScalar(0.5 + 2.0 * arrive);
        destPulse.material.opacity = 0.5 * arrive * (1 - 0.5 * smooth(10.8, 12, t));

        dust.rotation.y = t * 0.006;
      },
    };
  },
};

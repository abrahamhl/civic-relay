import {
  TAU, PALETTE, clamp, smooth, mulberry32, addStars, addDust,
  glowSprite, textSprite, makeTerrain, makePhone, makeSatellite, curveLine,
  cameraKeys, fitSprite, ringWave, cylinderBetween,
} from './common.js';
import { startTriage, routeFor, tally, compactReport, CATEGORIES } from '../../../investor-next/public/senda/core/triage.mjs';
import { airtimeSeconds } from '../../../investor-next/public/senda/core/acoustic-modem.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fmt1 = (x) => Number(x).toFixed(1).replace('.', ',');

const CASES = [
  { walks: true },
  { walks: false, breathes: true, rr: 36 },
  { walks: false, breathes: true, rr: 20, radialPulse: true, capRefillS: 1, obeys: true },
  { walks: false, breathes: false, breathesAfterAirway: true },
  { walks: false, breathes: true, rr: 22, radialPulse: false },
];
const RESULTS = CASES.map((o) => startTriage(o));
const TALLY = tally(RESULTS);
const NEEDS = ['atrapados 1'];
const SERVICES = routeFor({ medical: true, trapped: true });
const REPORT = compactReport({ counts: TALLY, lat: 39.4521, lon: -0.4302, accM: 8, floor: 3, needs: NEEDS, services: SERVICES, hhmm: '18:42' });
const REPORT_BYTES = new TextEncoder().encode(REPORT).length;
const AIR_S = airtimeSeconds(REPORT_BYTES);
const CAT_ORDER = ['ROJO', 'AMARILLO', 'VERDE'];

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

function makeVictim(color, upright = false) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x22333b, roughness: 0.86, metalness: 0.08 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xa98263, roughness: 0.9, metalness: 0.02 });
  if (upright) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.56, 4, 10), cloth);
    body.position.y = 0.95;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skin);
    head.position.y = 1.5;
    g.add(head);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.62, 8), cloth);
      leg.position.set(s * 0.1, 0.37, 0);
      g.add(leg);
    }
  } else {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.62, 4, 10), cloth);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.24;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), skin);
    head.position.set(0.56, 0.22, 0);
    g.add(head);
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), cloth);
    legs.rotation.z = Math.PI / 2;
    legs.position.set(-0.6, 0.17, 0.06);
    g.add(legs);
  }
  const pulse = glowSprite(color, 1.5, 0.4, false);
  pulse.position.y = upright ? 0.98 : 0.3;
  g.add(pulse);
  g.userData.pulse = pulse;
  return g;
}

function makeRescuer() {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x22343c, roughness: 0.75, metalness: 0.15 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x3d5a4b, roughness: 0.7, metalness: 0.1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb88968, roughness: 0.85 });
  const high = new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.92, toneMapped: false });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.58, 4, 10), suit);
  body.position.y = 1.1;
  g.add(body);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.34), vestMat);
  vest.position.y = 1.16;
  g.add(vest);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.36), high);
  stripe.position.y = 1.18;
  g.add(stripe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
  head.position.y = 1.7;
  g.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 18, 12, 0, TAU, 0, Math.PI * 0.6),
    new THREE.MeshStandardMaterial({ color: 0xe0c15a, roughness: 0.55, metalness: 0.2 })
  );
  helmet.position.y = 1.76;
  g.add(helmet);
  const lamp = glowSprite(0xffe8a9, 0.62, 0.85, false);
  lamp.position.set(0, 1.8, 0.2);
  g.add(lamp);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, 0.78, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.72, 8), suit);
    leg.position.y = -0.36;
    hip.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.24), new THREE.MeshStandardMaterial({ color: 0x11181b, roughness: 0.85 }));
    boot.position.set(0, -0.74, 0.05);
    hip.add(boot);
    g.add(hip);
    legs.push(hip);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.26, 1.4, 0);
    shoulder.rotation.z = s * 0.18;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.58, 8), suit);
    arm.position.y = -0.28;
    shoulder.add(arm);
    g.add(shoulder);
    arms.push(shoulder);
  }
  const phone = makePhone(PALETTE.ice);
  phone.scale.setScalar(0.52);
  phone.position.set(0.32, 1.05, 0.2);
  phone.rotation.set(-0.3, 0.35, 0.12);
  g.add(phone);
  g.userData.legs = legs;
  g.userData.arms = arms;
  g.userData.phone = phone;
  return g;
}

export default {
  id: 'triaje',
  title: 'Triaje para cualquiera',
  duration: 15.4,
  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(20261109);
    scene.fog = new THREE.FogExp2(0x050b10, 0.0082);

    scene.add(new THREE.HemisphereLight(0x9cccda, 0x030706, 1.15));
    const key = new THREE.DirectionalLight(0xd8e9e7, 2.1);
    key.position.set(-26, 44, 30);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x3f8ca0, 1.5);
    rim.position.set(32, 16, -28);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x5b7b7d, 0.7));
    const lampWarm = new THREE.PointLight(0xffb089, 26, 46, 1.7);
    lampWarm.position.set(-16, 9, 12);
    scene.add(lampWarm);
    const lampCool = new THREE.PointLight(0x91d7e8, 22, 40, 1.7);
    lampCool.position.set(8, 8, -10);
    scene.add(lampCool);
    const lampC = new THREE.PointLight(0x8fe3cf, 30, 44, 1.7);
    lampC.position.set(122, 8, 12);
    scene.add(lampC);
    const lampD = new THREE.PointLight(0x91d7e8, 20, 40, 1.7);
    lampD.position.set(60, 8, 10);
    scene.add(lampD);

    addStars(scene, 560, 235, 17);
    addDust(scene, 320, 110, 0x91d7e8, 29);

    const tag = (text, color, opts = {}) => textSprite(text, {
      size: 56,
      color,
      width: 820,
      height: 150,
      scale: 0.55,
      bg: 'rgba(6, 14, 20, 0.74)',
      border: `${color}66`,
      ...opts,
    });

    const c1 = 4.8;
    const c2 = 9.8;

    const stationA = new THREE.Group();
    scene.add(stationA);
    const stationB = new THREE.Group();
    stationB.position.set(60, 0, 0);
    scene.add(stationB);
    const stationC = new THREE.Group();
    stationC.position.set(120, 0, 0);
    scene.add(stationC);

    const groundAt = (x, z) => 0.07 * Math.sin(x * 0.16) + 0.05 * Math.cos(z * 0.22) + 0.03 * Math.sin((x + z) * 0.29);
    const terrain = makeTerrain(170, 130, 64, groundAt, 33, [0x0a1411, 0x14201c, 0x1f2c26]);
    terrain.position.y = -0.13;
    scene.add(terrain);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 76),
      new THREE.MeshStandardMaterial({ color: 0x080e12, roughness: 0.92, metalness: 0.08 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, 0);
    stationA.add(road);
    for (const x of [-4.85, 4.85]) {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.012, 76),
        new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.16, toneMapped: false })
      );
      edge.position.set(x, 0.035, 0);
      stationA.add(edge);
    }
    for (let z = -36; z <= 36; z += 3.4) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 1.5),
        new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.2, toneMapped: false })
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.035, z);
      stationA.add(dash);
    }

    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.95, metalness: 0.04 });
    const rubbleEdge = new THREE.LineBasicMaterial({ color: 0x3d5560, transparent: true, opacity: 0.24 });
    for (let i = 0; i < 16; i++) {
      const w = 0.8 + rnd() * 2.6;
      const h = 0.4 + rnd() * 1.4;
      const d = 0.7 + rnd() * 2.2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rubbleMat);
      b.position.set(7.6 + rnd() * 7, h / 2 - 0.06, -16 + rnd() * 28);
      b.rotation.set((rnd() - 0.5) * 0.5, rnd() * TAU, (rnd() - 0.5) * 0.5);
      stationA.add(b);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), rubbleEdge);
      e.position.copy(b.position);
      e.rotation.copy(b.rotation);
      stationA.add(e);
    }
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(9, 5.4, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x1c242a, roughness: 0.95, metalness: 0.04 })
    );
    wall.position.set(12.6, 2.1, 2.5);
    wall.rotation.set(0.06, -0.36, 0.23);
    stationA.add(wall);
    const wallEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(wall.geometry),
      new THREE.LineBasicMaterial({ color: 0x3d5560, transparent: true, opacity: 0.32 })
    );
    wallEdges.position.copy(wall.position);
    wallEdges.rotation.copy(wall.rotation);
    stationA.add(wallEdges);
    for (const [x, z, s] of [[9.5, 6.5, 3.2], [11.5, -3.5, 2.4], [8.5, -11, 1.8]]) {
      const dustGlow = glowSprite(0xffb168, s, 0.08, false);
      dustGlow.position.set(x, 0.6, z);
      stationA.add(dustGlow);
    }

    for (const [x, z] of [[-7.6, 9.5], [7.4, -6.5], [-7.2, -13]]) {
      const pole = cylinderBetween(V(x, 0.02, z), V(x, 4.3, z), 0.055, 0x2a3f4a, 0.65, false);
      stationA.add(pole);
      const head = glowSprite(0xffb168, 2.4, 0.42, false);
      head.position.set(x, 4.4, z);
      stationA.add(head);
    }

    const victimDefs = [
      { x: -2.6, z: 11.5, up: true },
      { x: 2.0, z: 5.5, up: false },
      { x: -2.2, z: 0.4, up: false },
      { x: 2.6, z: -5.2, up: false },
      { x: -1.8, z: -10.8, up: false },
    ];
    const victimsA = victimDefs.map((d, i) => {
      const fig = makeVictim(PALETTE.ice, d.up);
      fig.position.set(d.x, 0.03, d.z);
      fig.rotation.y = i % 2 ? 2.6 : 0.4;
      stationA.add(fig);
      const mark = tag(`V${i + 1}`, PALETTE.muted, { width: 300, scale: 0.42, size: 54 });
      mark.position.set(d.x, d.up ? 2.05 : 1.15, d.z);
      stationA.add(mark);
      return { fig, mark };
    });

    const rescuer = makeRescuer();
    stationA.add(rescuer);
    const rescuerTag = tag('VECINO · PRIMERO EN LLEGAR', PALETTE.amber, { width: 980, scale: 0.5 });
    stationA.add(rescuerTag);
    const rescuerPath = new THREE.CatmullRomCurve3([
      V(0.9, 0.03, 14.6), V(-1.4, 0.03, 11.5), V(1.0, 0.03, 5.5), V(-1.0, 0.03, 0.4), V(1.2, 0.03, -5.2), V(-0.7, 0.03, -11.5),
    ]);

    let checkState = 0;
    const checkRows = ['¿Camina?', '¿Respira?', '¿Circulación?', '¿Obedece?'];
    const checkCard = liveSprite(720, 420, 1.55, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.beginPath();
      g.roundRect(4, 4, w - 8, h - 8, 26);
      g.fillStyle = 'rgba(6, 14, 20, 0.87)';
      g.fill();
      g.strokeStyle = 'rgba(145, 215, 232, 0.34)';
      g.lineWidth = 2;
      g.stroke();
      g.textAlign = 'left';
      g.fillStyle = PALETTE.coral;
      g.font = '700 20px ui-monospace, Consolas, monospace';
      g.fillText('START · 4 PREGUNTAS', 36, 48);
      checkRows.forEach((label, i) => {
        const active = i === checkState;
        const done = i < checkState;
        const y = 112 + i * 72;
        if (active) {
          g.beginPath();
          g.roundRect(22, y - 34, w - 44, 58, 14);
          g.fillStyle = 'rgba(145, 215, 232, 0.13)';
          g.fill();
        }
        g.beginPath();
        g.arc(54, y, 17, 0, TAU);
        g.fillStyle = done ? '#34d399' : active ? '#91d7e8' : '#16232c';
        g.fill();
        g.textAlign = 'center';
        g.fillStyle = done || active ? '#05090c' : '#60757f';
        g.font = '800 19px Segoe UI, Inter, system-ui, sans-serif';
        g.fillText(String(i + 1), 54, y + 7);
        g.textAlign = 'left';
        g.fillStyle = active ? '#f4f7f8' : done ? '#9fb2bc' : '#60757f';
        g.font = '700 28px Segoe UI, Inter, system-ui, sans-serif';
        g.fillText(label, 86, y + 9);
        if (done) {
          g.textAlign = 'right';
          g.fillStyle = '#34d399';
          g.font = '800 20px Segoe UI, Inter, system-ui, sans-serif';
          g.fillText('OK', w - 42, y + 8);
        }
      });
      g.textAlign = 'left';
      g.fillStyle = '#60757f';
      g.font = '600 18px ui-monospace, Consolas, monospace';
      g.fillText('menos de 1 min por persona · sin red', 36, h - 30);
    });
    checkCard.draw();
    checkCard.sp.position.set(-8.4, 4.6, 8.6);
    stationA.add(checkCard.sp);

    const fitsA = [];
    for (const v of victimsA) fitsA.push({ sp: v.mark, ref: 26, min: 0.4, max: 1.5 });
    fitsA.push({ sp: rescuerTag, ref: 24, min: 0.4, max: 1.5 });
    fitsA.push({ sp: checkCard.sp, ref: 26, min: 0.35, max: 1.5 });

    const platB = new THREE.Mesh(
      new THREE.CircleGeometry(17, 64),
      new THREE.MeshStandardMaterial({ color: 0x071016, roughness: 0.9, metalness: 0.08 })
    );
    platB.rotation.x = -Math.PI / 2;
    platB.position.y = -0.03;
    stationB.add(platB);
    const ringB = ringWave(PALETTE.ice, 14.4, 0.06);
    ringB.position.y = 0.005;
    stationB.add(ringB);

    const pods = victimDefs.map((def, i) => {
      const res = RESULTS[i];
      const color = CATEGORIES[res.cat].color;
      const g = new THREE.Group();
      g.position.set(-8 + i * 4, 0, 0);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.28, 0.22, 28),
        new THREE.MeshStandardMaterial({ color: 0x0c1b23, roughness: 0.4, metalness: 0.62, emissive: 0x0a1a22, emissiveIntensity: 0.6 })
      );
      base.position.y = 0.11;
      g.add(base);
      const ring = ringWave(color, 1.15, 0.42);
      ring.position.y = 0.24;
      g.add(ring);
      const wave = ringWave(color, 1.15, 0.32);
      wave.position.y = 0.245;
      g.add(wave);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.12, 2.3, 26, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
      );
      beam.position.y = 1.35;
      g.add(beam);
      const fig = makeVictim(color, def.up);
      fig.position.y = 0.22;
      fig.scale.setScalar(1.35);
      fig.rotation.y = i % 2 ? 0.4 : -0.35;
      g.add(fig);
      const tagSp = tag(`V${i + 1} · ${res.cat}`, color, { width: 760, scale: 0.55 });
      tagSp.position.set(0, 2.95, 0.5);
      g.add(tagSp);
      stationB.add(g);
      return { g, color, ring, wave, fig, tagSp, start: c1 + 0.15 + i * 0.32, phase: i * 1.7 };
    });

    const tallyCard = liveSprite(900, 520, 2.55, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.beginPath();
      g.roundRect(4, 4, w - 8, h - 8, 26);
      g.fillStyle = 'rgba(6, 14, 20, 0.88)';
      g.fill();
      g.strokeStyle = 'rgba(145, 215, 232, 0.34)';
      g.lineWidth = 2;
      g.stroke();
      g.textAlign = 'left';
      g.fillStyle = PALETTE.coral;
      g.font = '700 21px ui-monospace, Consolas, monospace';
      g.fillText('RECUENTO START', 40, 58);
      CAT_ORDER.forEach((cat, i) => {
        const color = CATEGORIES[cat].color;
        const y = 150 + i * 112;
        g.beginPath();
        g.arc(70, y, 21, 0, TAU);
        g.fillStyle = color;
        g.fill();
        g.fillStyle = '#f4f7f8';
        g.font = '800 44px Segoe UI, Inter, system-ui, sans-serif';
        g.fillText(String(TALLY[cat]), 112, y + 16);
        g.fillStyle = '#9fb2bc';
        g.font = '700 25px Segoe UI, Inter, system-ui, sans-serif';
        g.fillText(cat, 170, y + 8);
        g.fillStyle = '#60757f';
        g.font = '600 19px Segoe UI, Inter, system-ui, sans-serif';
        g.fillText(CATEGORIES[cat].label, 170, y + 34);
      });
      g.strokeStyle = 'rgba(145, 215, 232, 0.16)';
      g.beginPath();
      g.moveTo(40, h - 74);
      g.lineTo(w - 40, h - 74);
      g.stroke();
      g.fillStyle = '#60757f';
      g.font = '600 18px ui-monospace, Consolas, monospace';
      g.fillText(`${RESULTS.length} víctimas · ${TALLY.SIN_RESPIRACION} sin respiración`, 40, h - 42);
      g.textAlign = 'right';
      g.fillStyle = PALETTE.coral;
      g.fillText('112 · SIEMPRE PRIMERO', w - 40, h - 42);
    });
    tallyCard.draw();
    tallyCard.sp.position.set(0, 4.95, -4.6);
    stationB.add(tallyCard.sp);

    const fitsB = [{ sp: tallyCard.sp, ref: 24, min: 0.4, max: 1.45 }];
    for (const p of pods) fitsB.push({ sp: p.tagSp, ref: 22, min: 0.42, max: 1.45 });

    const platC = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({ color: 0x071016, roughness: 0.9, metalness: 0.08 })
    );
    platC.rotation.x = -Math.PI / 2;
    platC.position.y = -0.03;
    stationC.add(platC);

    const phoneBig = makePhone(PALETTE.ice);
    phoneBig.position.set(0, 2.6, 0.4);
    phoneBig.scale.setScalar(4.6);
    stationC.add(phoneBig);

    const reportCard = liveSprite(1100, 520, 2.05, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.beginPath();
      g.roundRect(4, 4, w - 8, h - 8, 26);
      g.fillStyle = 'rgba(6, 14, 20, 0.91)';
      g.fill();
      g.strokeStyle = 'rgba(145, 215, 232, 0.4)';
      g.lineWidth = 2;
      g.stroke();
      g.textAlign = 'left';
      g.fillStyle = PALETTE.coral;
      g.font = '700 22px ui-monospace, Consolas, monospace';
      g.fillText('PARTE · SIN NOMBRES', 38, 54);
      g.textAlign = 'right';
      g.fillStyle = '#60757f';
      g.fillText('18:42', w - 38, 54);
      const segs = REPORT.split(' | ');
      const lines = [segs.slice(0, 2).join(' | '), segs.slice(2, 4).join(' | '), segs[4] || ''];
      g.textAlign = 'left';
      g.fillStyle = PALETTE.ice;
      g.font = '700 27px ui-monospace, Consolas, monospace';
      lines.forEach((line, i) => g.fillText(line, 38, 142 + i * 68));
      g.strokeStyle = 'rgba(145, 215, 232, 0.16)';
      g.beginPath();
      g.moveTo(38, 366);
      g.lineTo(w - 38, 366);
      g.stroke();
      g.fillStyle = '#9fb2bc';
      g.font = '600 19px ui-monospace, Consolas, monospace';
      g.fillText(`${REPORT.length}/160 caracteres · ${REPORT_BYTES} B por satélite · ${fmt1(AIR_S)} s por sonido`, 38, 408);
      g.fillStyle = PALETTE.coral;
      g.font = '700 19px ui-monospace, Consolas, monospace';
      g.fillText('112 · SIEMPRE PRIMERO · FUNCIONA SIN RED', 38, 452);
    });
    reportCard.draw();
    reportCard.sp.position.set(0, 6.05, 0.4);
    stationC.add(reportCard.sp);

    const satC = makeSatellite(PALETTE.ice);
    satC.position.set(-5.0, 2.5, 1.2);
    satC.scale.setScalar(1.45);
    stationC.add(satC);

    const channelTags = [
      { x: -3.6, y: 3.3, color: PALETTE.ice, text: `SATÉLITE · ${REPORT_BYTES} B` },
      { x: 0, y: 0.95, color: PALETTE.coral, text: `SMS · ${REPORT.length}/160` },
      { x: 5.0, y: 3.3, color: PALETTE.amber, text: `SONIDO · ${fmt1(AIR_S)} s` },
    ];
    const channelSprites = channelTags.map((ch) => {
      const sp = tag(ch.text, ch.color, { width: 900, scale: 0.55 });
      sp.position.set(ch.x, ch.y, 2.7);
      stationC.add(sp);
      return { sp, color: ch.color };
    });

    const soundRings = [];
    for (let i = 0; i < 3; i++) {
      const r = ringWave(PALETTE.amber, 1.0, 0);
      r.rotation.x = 0;
      r.position.set(5.0, 1.95, 1.6);
      stationC.add(r);
      soundRings.push({ ring: r, offset: i / 3 });
    }

    const broadcast = [];
    for (let i = 0; i < 3; i++) {
      const r = ringWave(PALETTE.ice, 2.2, 0);
      r.position.set(0, 0.045, 0.4);
      stationC.add(r);
      broadcast.push({ ring: r, offset: i / 3 });
    }

    const fitsC = [{ sp: reportCard.sp, ref: 22, min: 0.45, max: 1.35 }];
    for (const ch of channelSprites) fitsC.push({ sp: ch.sp, ref: 20, min: 0.45, max: 1.4 });

    const chapters = [
      {
        start: 0,
        end: c1,
        kicker: '01 · CUATRO PREGUNTAS',
        title: 'El primero en llegar es un vecino',
        subtitle: 'START, el método internacional para múltiples víctimas: camina, respira, circulación y responde. Un vecino puede hacerlo en menos de un minuto por persona, sin red y sin nombres.',
        metrics: [
          { value: '4', label: 'comprobaciones START', tone: 'ice' },
          { value: '< 1 min', label: 'por persona', tone: 'emerald' },
          { value: '112', label: 'siempre primero', tone: 'coral' },
        ],
      },
      {
        start: c1,
        end: c2,
        kicker: '02 · UN COLOR POR VÍCTIMA',
        title: 'Rojo, amarillo o verde',
        subtitle: `Las cinco personas ya tienen color: ${TALLY.ROJO} rojas, ${TALLY.AMARILLO} amarilla y ${TALLY.VERDE} verde. El color decide a quién atender primero mientras llega la ayuda.`,
        metrics: [
          { value: String(TALLY.ROJO), label: 'rojos · atención inmediata', tone: 'coral' },
          { value: String(TALLY.AMARILLO), label: 'amarillo · puede esperar poco', tone: 'amber' },
          { value: String(TALLY.VERDE), label: 'verde · leve, camina', tone: 'emerald' },
        ],
      },
      {
        start: c2,
        end: 15.4,
        kicker: '03 · UN PARTE EN UN SMS',
        title: `Un parte de ${REPORT.length} caracteres`,
        subtitle: `Colores, posición, planta, necesidades y servicios. Cabe en un SMS (${REPORT.length}/160), en ${REPORT_BYTES} bytes por satélite o en ${fmt1(AIR_S)} segundos de sonido entre móviles.`,
        metrics: [
          { value: `${REPORT.length}/160`, label: 'caracteres · cabe en un SMS', tone: 'emerald' },
          { value: `${REPORT_BYTES} B`, label: 'por satélite', tone: 'ice' },
          { value: `${fmt1(AIR_S)} s`, label: 'por sonido entre móviles', tone: 'amber' },
        ],
      },
    ];

    const cameraPlan = [
      { t: 0, pos: [31, 22, 41], look: [0, 1.6, 3], fov: 44 },
      { t: 2.2, pos: [24, 14.5, 29], look: [0, 1.3, 1.5], fov: 44 },
      { t: 4.7, pos: [15, 8, 20], look: [-0.5, 1.0, -2.5], fov: 44 },
      { t: c1, pos: [60, 7.6, 20], look: [60, 2.1, 0], fov: 44 },
      { t: 9.7, pos: [60, 5.4, 14.5], look: [60, 2.3, 0], fov: 44 },
      { t: c2, pos: [122, 4.9, 16.5], look: [120, 3.7, 0], fov: 42 },
      { t: 15.4, pos: [120.4, 4.4, 12.6], look: [120, 3.6, 0], fov: 42 },
    ];

    return {
      duration: 15.4,
      chapters,

      update(t) {
        cameraKeys(camera, t, cameraPlan);
        stationA.visible = t < c1 + 0.05;
        stationB.visible = t >= c1 - 0.05 && t < c2 + 0.05;
        stationC.visible = t >= c2 - 0.05;

        if (stationA.visible) {
          const u = clamp((t - 0.2) / 4.3);
          const pos = rescuerPath.getPointAt(u);
          const ahead = rescuerPath.getPointAt(Math.min(1, u + 0.02));
          rescuer.position.set(pos.x, 0.03 + Math.abs(Math.sin(t * 8)) * 0.05, pos.z);
          rescuer.lookAt(ahead.x, pos.y, ahead.z);
          rescuer.userData.legs[0].rotation.x = Math.sin(t * 8) * 0.55;
          rescuer.userData.legs[1].rotation.x = -Math.sin(t * 8) * 0.55;
          rescuer.userData.arms[0].rotation.x = -Math.sin(t * 8) * 0.3;
          rescuer.userData.arms[1].rotation.x = Math.sin(t * 8) * 0.18;
          rescuer.userData.phone.userData.halo.material.opacity = 0.4 + 0.3 * (0.5 + 0.5 * Math.sin(t * 8));
          rescuerTag.position.set(pos.x, 2.8, pos.z);

          for (let i = 0; i < victimsA.length; i++) {
            const v = victimsA[i];
            v.fig.userData.pulse.material.opacity = 0.28 + 0.16 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.3));
          }

          const step = t < 0.75 ? 0 : t < 1.75 ? 1 : t < 2.75 ? 2 : 3;
          if (step !== checkState) {
            checkState = step;
            checkCard.draw();
          }

          for (const f of fitsA) fitSprite(f.sp, camera, f.ref, f.min, f.max);
        }

        if (stationB.visible) {
          for (let i = 0; i < pods.length; i++) {
            const p = pods[i];
            const k = smooth(p.start, p.start + 0.55, t);
            p.g.visible = k > 0.002;
            p.g.position.y = (1 - k) * -1.1;
            p.g.scale.setScalar(0.65 + 0.35 * k);
            p.tagSp.material.opacity = k;
            p.ring.material.opacity = (0.3 + 0.1 * (0.5 + 0.5 * Math.sin(t * 2.4 + p.phase))) * k;
            const wp = ((t * 0.5 + i * 0.21) % 1 + 1) % 1;
            p.wave.scale.setScalar(1 + wp * 1.5);
            p.wave.material.opacity = 0.34 * (1 - wp) * k;
            p.fig.userData.pulse.material.opacity = (0.3 + 0.16 * (0.5 + 0.5 * Math.sin(t * 2.8 + p.phase))) * k;
          }
          for (const f of fitsB) fitSprite(f.sp, camera, f.ref, f.min, f.max);
        }

        if (stationC.visible) {
          phoneBig.position.y = 2.6 + Math.sin(t * 1.1) * 0.05;
          phoneBig.rotation.y = Math.sin(t * 0.5) * 0.08;
          phoneBig.userData.halo.material.opacity = 0.35 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.2));
          satC.rotation.y = t * 0.28;
          satC.userData.led.material.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4.2));

          soundRings.forEach((s, i) => {
            const p = ((t * 0.62 + s.offset) % 1 + 1) % 1;
            s.ring.scale.setScalar(0.55 + p * 1.9);
            s.ring.material.opacity = 0.34 * (1 - p);
          });
          broadcast.forEach((b, i) => {
            const p = ((t * 0.42 + b.offset) % 1 + 1) % 1;
            b.ring.scale.setScalar(0.45 + p * 2.4);
            b.ring.material.opacity = 0.22 * (1 - p);
          });

          for (const f of fitsC) fitSprite(f.sp, camera, f.ref, f.min, f.max);
        }
      },
    };
  },
};

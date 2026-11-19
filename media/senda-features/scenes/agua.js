import {
  TAU, PALETTE, clamp, lerp, smooth, mulberry32, addStars, addDust,
  glowSprite, textSprite, makeWater, curveLine, cameraKeys, fitSprite, ringWave, cylinderBetween,
} from './common.js';
import { floodScenario } from '../../../investor-next/public/senda/core/flood-watch.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HM = (min) => {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};

export default {
  id: 'agua',
  title: 'El agua viene de donde no estás',
  duration: 13.4,
  build(ctx) {
    const { scene, camera } = ctx;
    const rnd = mulberry32(20241029);
    scene.fog = new THREE.FogExp2(0x071014, 0.009);

    scene.add(new THREE.HemisphereLight(0x9ed4de, 0x030706, 0.9));
    const key = new THREE.DirectionalLight(0xd8e9e7, 1.55);
    key.position.set(-22, 36, 18);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x3c8fa6, 1.3);
    rim.position.set(28, 14, -20);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x5b7b7d, 0.4));

    addStars(scene, 360, 200, 13);
    addDust(scene, 160, 58, 0x9bd5df, 37);

    const flood = floodScenario();
    const A = flood.result.find((r) => r.id === 'A');
    const B = flood.result.find((r) => r.id === 'B');
    const damPeak = Math.round(Math.max(...flood.dam.outflow));
    const riseMin = flood.up.riseMin;
    const alarmMin = flood.up.thresholdMin;
    const aOver = A.overflowMin;
    const bOver = B.overflowMin;

    const riverX = (z) => 0.95 * z - 8.5;
    const heightAt = (x, z) => {
      const d = Math.abs(x - riverX(z));
      const valley = 0.5 + 0.16 * Math.pow(Math.max(0, d), 1.13);
      const hills = 1.5 * Math.sin(x * 0.16 + z * 0.07) + 0.9 * Math.cos(z * 0.19 - x * 0.05) + 1.0 * Math.sin((x + z) * 0.11);
      const bank = d < 2.2 ? 0.35 : 0;
      return Math.max(0.25, valley + hills * smooth(1, 9, d) + bank);
    };

    const W = 116, H = 94, SX = 0.86, SZ = 0.86;
    const pos = [], col = [], uv = [], idx = [];
    const cLow = new THREE.Color(0x1b3a2a), cMid = new THREE.Color(0x2b4b34), cHigh = new THREE.Color(0x4a4d42), cRock = new THREE.Color(0x68685b);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = (i - W / 2) * SX, z = (j - H / 2) * SZ;
        const h = heightAt(x, z);
        pos.push(x, h, z);
        uv.push(i / (W - 1), 1 - j / (H - 1));
        const d = Math.abs(x - riverX(z));
        let c;
        if (d < 2.0 && h < 1.15) c = new THREE.Color(0x123b4b);
        else if (h < 3.2) c = cLow.clone().lerp(cMid, smooth(0.5, 3.2, h));
        else if (h < 7) c = cMid.clone().lerp(cHigh, smooth(3.2, 7, h));
        else c = cHigh.clone().lerp(cRock, smooth(7, 12, h));
        c.multiplyScalar(0.82 + rnd() * 0.22);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.03, flatShading: true }));
    scene.add(terrain);

    const riverPts = [];
    for (let z = -43; z <= 44; z += 2) riverPts.push(V(riverX(z), heightAt(riverX(z), z) + 0.26, z));
    const riverCurve = new THREE.CatmullRomCurve3(riverPts);

    const waterTexCanvas = document.createElement('canvas');
    waterTexCanvas.width = 128; waterTexCanvas.height = 128;
    const wg = waterTexCanvas.getContext('2d');
    wg.fillStyle = '#0c3241'; wg.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 22; i++) {
      wg.strokeStyle = `rgba(145,215,232,${0.06 + rnd() * 0.1})`;
      wg.lineWidth = 0.8 + rnd() * 1.6;
      wg.beginPath();
      const y = rnd() * 128;
      wg.moveTo(0, y);
      wg.bezierCurveTo(32, y + 6, 64, y - 8, 96, y + 3);
      wg.bezierCurveTo(112, y + 8, 120, y + 2, 128, y + 4);
      wg.stroke();
    }
    const waterTex = new THREE.CanvasTexture(waterTexCanvas);
    waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    waterTex.repeat.set(3, 8);
    waterTex.colorSpace = THREE.SRGBColorSpace;

    const river = new THREE.Mesh(
      new THREE.TubeGeometry(riverCurve, 180, 0.68, 8, false),
      new THREE.MeshStandardMaterial({ map: waterTex, color: 0xb6e4ea, roughness: 0.27, metalness: 0.32, emissive: 0x082c36, emissiveIntensity: 0.9, transparent: true, opacity: 0.96 })
    );
    river.scale.y = 0.7;
    scene.add(river);
    const riverGlow = new THREE.Mesh(
      new THREE.TubeGeometry(riverCurve, 180, 0.9, 8, false),
      new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    riverGlow.scale.y = 0.7;
    scene.add(riverGlow);

    const sea = makeWater(80, 34, 28, 0x071b2b, 0x0f495c);
    sea.position.set(20, 0.12, 47);
    scene.add(sea);
    const seaLabel = textSprite('MAR', { size: 26, scale: 0.2, color: '#a8e2ee', border: 'rgba(145,215,232,0.24)', bg: 'rgba(4,14,18,0.66)', mono: true });
    seaLabel.position.set(30, 1.4, 44);
    scene.add(seaLabel);

    const tributaryPts = [];
    for (let k = 0; k <= 18; k++) {
      const u = k / 18;
      const x = -35 + u * 24, z = -22 + u * 17;
      tributaryPts.push(V(x, heightAt(x, z) + 0.2, z));
    }
    const tributary = curveLine(tributaryPts, 0x3e91aa, 0.45);
    scene.add(tributary.line);

    const storm = new THREE.Group();
    const sx = riverX(-29) - 2.5, sz = -29, sy = heightAt(sx, sz) + 12.5;
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0x111d25, roughness: 0.95, metalness: 0.05, emissive: 0x071016, emissiveIntensity: 0.7 });
    const cloudParts = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(3.2, 14, 10), cloudMat);
      m.scale.set(1.8 + rnd() * 0.8, 0.65 + rnd() * 0.25, 1.2 + rnd() * 0.6);
      m.position.set((rnd() - 0.5) * 13, rnd() * 2.4, (rnd() - 0.5) * 7);
      storm.add(m);
      cloudParts.push(m);
    }
    storm.position.set(sx, sy, sz);
    scene.add(storm);
    const rainN = 190;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainN * 6);
    const rainOff = new Float32Array(rainN * 2);
    for (let i = 0; i < rainN; i++) {
      rainOff[i * 2] = (rnd() - 0.5) * 14;
      rainOff[i * 2 + 1] = (rnd() - 0.5) * 8;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9bd5e1, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }));
    scene.add(rain);
    const stormLabel = textSprite('CABECERA · 200 MM / 5 H', { size: 26, scale: 0.23, color: '#cfeef5', border: 'rgba(145,215,232,0.3)', bg: 'rgba(4,14,18,0.74)', mono: true });
    stormLabel.position.set(sx, sy + 7.2, sz);
    scene.add(stormLabel);
    const rainLabel = textSprite('80 MM/H', { size: 24, scale: 0.18, color: '#a8e2ee', border: 'rgba(145,215,232,0.22)', bg: 'rgba(4,14,18,0.66)', mono: true });
    rainLabel.position.set(sx + 9, sy - 1.5, sz + 2);
    scene.add(rainLabel);
    const flashLight = new THREE.PointLight(0xbfe9ff, 0, 75);
    flashLight.position.set(sx, sy + 1, sz);
    scene.add(flashLight);

    const damX = -24, damZ = -7;
    const damBase = heightAt(damX, damZ);
    const dam = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.4, 1.1), new THREE.MeshStandardMaterial({ color: 0x777b78, roughness: 0.78, metalness: 0.15 }));
    wall.position.set(damX, damBase + 1.7, damZ);
    dam.add(wall);
    const damCrest = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.18, 1.35), new THREE.MeshStandardMaterial({ color: 0xb1b5ac, roughness: 0.55, metalness: 0.25 }));
    damCrest.position.set(damX, damBase + 3.46, damZ);
    dam.add(damCrest);
    const reservoir = makeWater(8.5, 7.5, 14, 0x0d3140, 0x1b6172);
    reservoir.position.set(damX - 4.6, damBase + 1.3, damZ + 0.2);
    dam.add(reservoir);
    const spill = new THREE.Group();
    const spillMat = new THREE.MeshBasicMaterial({ color: 0x9de4ed, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    for (let i = 0; i < 4; i++) {
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.32, 3.2, 8), spillMat);
      jet.position.set(damX + 1.3 + i * 0.45, damBase + 1.7, damZ + 0.4);
      jet.rotation.z = 0.36;
      spill.add(jet);
    }
    dam.add(spill);
    const damLabel = textSprite(`EMBALSE · VIERTE ${damPeak} M³/S`, { size: 24, scale: 0.2, color: '#ffe0a8', border: 'rgba(251,191,36,0.3)', bg: 'rgba(22,16,4,0.76)', mono: true });
    damLabel.position.set(damX - 1, damBase + 6.2, damZ);
    dam.add(damLabel);
    scene.add(dam);

    const gaugeZ = -19, gaugeX = riverX(gaugeZ);
    const gaugeBase = heightAt(gaugeX, gaugeZ);
    const gauge = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x90a8ac, roughness: 0.4, metalness: 0.7 }));
    pole.position.set(gaugeX, gaugeBase + 1.7, gaugeZ);
    gauge.add(pole);
    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x29444d, roughness: 0.4, metalness: 0.6 }));
    sensor.position.set(gaugeX, gaugeBase + 3.5, gaugeZ);
    gauge.add(sensor);
    const gaugeBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: PALETTE.emerald, toneMapped: false }));
    gaugeBeacon.position.set(gaugeX, gaugeBase + 3.9, gaugeZ);
    gauge.add(gaugeBeacon);
    const gaugeHalo = glowSprite(PALETTE.emerald, 1.6, 0.55);
    gaugeHalo.position.set(gaugeX, gaugeBase + 3.9, gaugeZ);
    gauge.add(gaugeHalo);
    const gaugeLabel = textSprite('AFORO DE CABECERA', { size: 24, scale: 0.19, color: '#c6f7e6', border: 'rgba(52,211,153,0.3)', bg: 'rgba(4,18,12,0.7)', mono: true });
    gaugeLabel.position.set(gaugeX, gaugeBase + 5.2, gaugeZ);
    gauge.add(gaugeLabel);
    const gaugeRing = ringWave(PALETTE.emerald, 1.5, 0.35);
    gaugeRing.position.set(gaugeX, gaugeBase + 0.1, gaugeZ);
    gauge.add(gaugeRing);
    scene.add(gauge);

    const towns = [];
    const townDefs = [
      { id: 'A', name: 'PUEBLO DEL CAUCE', z: 4, x: riverX(4) + 3.1, threshold: aOver, lead: A.leadMin, color: PALETTE.coral },
      { id: 'B', name: 'PUEBLO DE LA DESEMBOCADURA', z: 22, x: riverX(22) + 3.4, threshold: bOver, lead: B.leadMin, color: PALETTE.amber },
    ];
    for (const def of townDefs) {
      const g = new THREE.Group();
      const base = new THREE.Vector3(def.x, heightAt(def.x, def.z), def.z);
      for (let i = 0; i < 8; i++) {
        const a = rnd() * TAU, r = 0.55 + rnd() * 1.8;
        const bw = 0.5 + rnd() * 0.5, bh = 0.45 + rnd() * 0.9, bd = 0.5 + rnd() * 0.5;
        const mat = new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x7c5b42 : i % 3 === 1 ? 0x4d5d63 : 0x626d72, roughness: 0.8, metalness: 0.1, emissive: 0x120c08, emissiveIntensity: 0.3 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
        b.position.set(base.x + Math.cos(a) * r, base.y + bh / 2 + 0.05, base.z + Math.sin(a) * r);
        b.rotation.y = rnd() * TAU;
        g.add(b);
      }
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(4.6, 40),
        new THREE.MeshBasicMaterial({ color: 0x1c6b7a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(base.x, base.y + 0.12, base.z);
      g.add(pool);
      const poolRing = ringWave(0x65d4df, 4.1, 0);
      poolRing.position.set(base.x, base.y + 0.16, base.z);
      g.add(poolRing);
      const ring = ringWave(def.color, 3.0, 0.32);
      ring.position.set(base.x, base.y + 0.18, base.z);
      g.add(ring);
      const label = textSprite(def.name, { size: 24, scale: 0.2, color: def.id === 'A' ? '#ffd0c4' : '#ffe8a9', border: 'rgba(145,215,232,0.26)', bg: 'rgba(4,14,18,0.72)', mono: true });
      label.position.set(base.x, base.y + 2.6, base.z);
      g.add(label);
      const card = new THREE.Group();
      const cardLines = [
        [`AVISO ${HM(def.lead)} ANTES`, def.id === 'A' ? '#ffc4b7' : '#ffe8a9', 0.22, 5.5],
        [`DESBORDA ${HM(def.threshold)}`, '#cfeef5', 0.19, 4.9],
        ['3 MM LOCALES', '#9fb2bc', 0.16, 4.35],
      ];
      for (const [text, color, scale, y] of cardLines) {
        const s = textSprite(text, { size: 26, scale, color, border: 'rgba(145,215,232,0.22)', bg: 'rgba(6,13,16,0.74)', mono: true });
        s.position.set(0, y, 0);
        card.add(s);
      }
      card.position.set(base.x, base.y, base.z);
      g.add(card);
      const beacon = glowSprite(def.color, 2.2, 0.3);
      beacon.position.set(base.x, base.y + 1.0, base.z);
      g.add(beacon);
      scene.add(g);
      towns.push({ g, def, base, pool, poolRing, ring, label, card, beacon });
    }

    const waveGeo = new THREE.BoxGeometry(11, 3.6, 0.7);
    const wave = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: 0x74d7e2, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(wave);
    const waveFoam = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const s = glowSprite(0xd6fbff, 0.55, 0.0);
      s.userData.offset = (rnd() - 0.5) * 10;
      s.userData.y = rnd() * 1.8;
      waveFoam.add(s);
    }
    scene.add(waveFoam);

    const timeline = new THREE.Group();
    const tlX = 23, tlZ = -18;
    for (const [min, color, text] of [[riseMin, PALETTE.emerald, `ALARMA ${HM(riseMin)}`], [aOver, PALETTE.coral, `A DESBORDA ${HM(aOver)}`], [bOver, PALETTE.amber, `B DESBORDA ${HM(bOver)}`]]) {
      const h = 0.4 + ((min - 400) / 300) * 5;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, h, 0.13), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, toneMapped: false }));
      bar.position.set(tlX, heightAt(tlX, tlZ) + h / 2, tlZ + (min - 460) * 0.06);
      timeline.add(bar);
      const tag = textSprite(text, { size: 22, scale: 0.17, color: '#d9f7ff', border: 'rgba(145,215,232,0.24)', bg: 'rgba(4,14,18,0.68)', mono: true });
      tag.position.set(tlX + 1.2, heightAt(tlX, tlZ) + h + 0.35, tlZ + (min - 460) * 0.06);
      timeline.add(tag);
    }
    scene.add(timeline);

    const chapters = [
      {
        start: 0,
        end: 4.4,
        kicker: '01 · EL AGUA VIENE DE ARRIBA',
        title: 'La tormenta cae lejos del pueblo',
        subtitle: 'En la cabecera caen 200 mm en cinco horas. En los pueblos, apenas 3 mm: mirar solo su lluvia llega tarde.',
        metrics: [
          { value: '200 mm', label: 'en cabecera', tone: 'ice' },
          { value: '3 mm', label: 'en el pueblo', tone: 'emerald' },
          { value: '5 h', label: 'de tormenta', tone: 'amber' },
        ],
      },
      {
        start: 4.4,
        end: 8.8,
        kicker: '02 · LA SUBIDA AVISA ANTES',
        title: 'El aforo de cabecera dispara la alarma',
        subtitle: `La subida salta a las ${HM(riseMin)}; el pueblo A desborda a las ${HM(aOver)}. Hay ${HM(A.leadMin)} de margen, no cero.`,
        metrics: [
          { value: HM(riseMin), label: 'alarma por subida', tone: 'emerald' },
          { value: HM(aOver), label: 'desborde pueblo A', tone: 'coral' },
          { value: HM(A.leadMin), label: 'margen ganado', tone: 'amber' },
        ],
      },
      {
        start: 8.8,
        end: 13.4,
        kicker: '03 · DOS PUEBLOS, DOS MÁRGENES',
        title: 'El aviso llega antes que la onda',
        subtitle: `Pueblo A: ${HM(A.leadMin)} de margen. Pueblo B: ${HM(B.leadMin)}. El embalse ya vierte ${damPeak} m³/s por el aliviadero.`,
        metrics: [
          { value: HM(A.leadMin), label: 'margen pueblo A', tone: 'coral' },
          { value: HM(B.leadMin), label: 'margen pueblo B', tone: 'amber' },
          { value: `${damPeak}`, label: 'm³/s vertidos', tone: 'violet' },
        ],
      },
    ];

    const cameraPlan = [
      { t: 0, pos: [-42, 30, -17], look: [-8, 2, 8], fov: 42 },
      { t: 3.6, pos: [-30, 17, -6], look: [-8, 1, 8], fov: 43 },
      { t: 7.2, pos: [-8, 10, 16], look: [-2, 1, 11], fov: 42 },
      { t: 10.4, pos: [26, 12, 27], look: [9, 1, 17], fov: 43 },
      { t: 13.4, pos: [-10, 36, 15], look: [8, 0, 15], fov: 41 },
    ];

    const setSphere = () => {};
    const waveFrac = (sim) => {
      if (sim < aOver) return lerp(0.16, 0.55, clamp((sim - riseMin) / (aOver - riseMin), 0, 1));
      return lerp(0.55, 0.84, clamp((sim - aOver) / (bOver - aOver), 0, 1));
    };

    return {
      duration: 13.4,
      chapters,
      update(t) {
        cameraKeys(camera, t, cameraPlan);
        const u = smooth(0, 13.4, clamp(t, 0, 13.4));
        const sim = 300 + 480 * u;
        const alarm = sim >= riseMin;
        const floodA = sim >= aOver;
        const floodB = sim >= bOver;

        waterTex.offset.x = (t * 0.12) % 1;
        waterTex.offset.y = (t * 0.05) % 1;
        river.material.emissiveIntensity = 0.7 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2));
        riverGlow.material.opacity = 0.07 + 0.07 * (0.5 + 0.5 * Math.sin(t * 1.8));
        sea.material.uniforms.uTime.value = t;
        reservoir.material.uniforms.uTime.value = t + 3;
        seaLabel.material.opacity = 0.75;
        fitSprite(seaLabel, camera, 24, 0.06, 1.8);

        storm.position.y = sy + Math.sin(t * 0.7) * 0.25;
        for (let i = 0; i < cloudParts.length; i++) {
          const m = cloudParts[i];
          m.position.x += Math.sin(t * 0.4 + i) * 0.002;
          m.position.y += Math.cos(t * 0.5 + i * 1.7) * 0.002;
        }
        for (let i = 0; i < rainN; i++) {
          const ox = rainOff[i * 2], oz = rainOff[i * 2 + 1];
          const fall = ((t * 9 + i * 0.7) % 12);
          const bx = sx + ox, bz = sz + oz;
          const y = sy + 4 - fall;
          rainPos[i * 6] = bx; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = bz;
          rainPos[i * 6 + 3] = bx - 0.16; rainPos[i * 6 + 4] = y - 1.1; rainPos[i * 6 + 5] = bz - 0.1;
        }
        rainGeo.attributes.position.needsUpdate = true;
        rain.material.opacity = 0.2 + 0.12 * (0.5 + 0.5 * Math.sin(t * 10));
        const flash = Math.sin(t * 5.5) > 0.975;
        flashLight.intensity = flash ? 5.5 : 0;
        stormLabel.material.opacity = 0.9;
        fitSprite(stormLabel, camera, 24, 0.07, 2.0);
        fitSprite(rainLabel, camera, 24, 0.06, 1.8);

        spill.visible = true;
        for (const j of spill.children) {
          j.material.opacity = 0.4 + 0.25 * (0.5 + 0.5 * Math.sin(t * 5 + j.position.x));
          j.scale.y = 0.85 + 0.2 * Math.sin(t * 3 + j.position.x);
        }
        damLabel.material.opacity = 0.85;
        fitSprite(damLabel, camera, 26, 0.06, 1.9);

        gaugeBeacon.material.color.setHex(alarm ? PALETTE.amber : PALETTE.emerald);
        gaugeHalo.material.color.setHex(alarm ? PALETTE.amber : PALETTE.emerald);
        gaugeHalo.material.opacity = alarm ? 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(t * 7)) : 0.4;
        gaugeRing.material.opacity = alarm ? 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(t * 5)) : 0.25;
        gaugeRing.scale.setScalar(1 + (alarm ? 0.2 : 0) * (0.5 + 0.5 * Math.sin(t * 5)));
        gaugeLabel.material.color.setHex(alarm ? 0xffe8a9 : 0xc6f7e6);
        fitSprite(gaugeLabel, camera, 24, 0.06, 1.8);

        for (const tw of towns) {
          tw.ring.rotation.z = t * 0.22;
          tw.pool.material.opacity = tw.def.id === 'A' ? (floodA ? 0.34 + 0.1 * Math.sin(t * 2) : 0.0) : (floodB ? 0.34 + 0.1 * Math.sin(t * 2 + 1) : 0.0);
          tw.poolRing.material.opacity = tw.def.id === 'A' ? (floodA ? 0.35 : 0) : (floodB ? 0.35 : 0);
          tw.poolRing.scale.setScalar(0.96 + 0.06 * Math.sin(t * 2.5));
          tw.beacon.material.opacity = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(t * 2 + tw.def.z));
          fitSprite(tw.label, camera, 24, 0.06, 1.8);
          for (const s of tw.card.children) if (s.isSprite) fitSprite(s, camera, 24, 0.06, 1.7);
        }

        const f = waveFrac(sim);
        const p = riverCurve.getPointAt(f);
        const tan = riverCurve.getTangentAt(f);
        wave.position.set(p.x, p.y + 1.25, p.z);
        wave.rotation.y = Math.atan2(tan.x, tan.z);
        const showWave = sim >= riseMin;
        wave.material.opacity = showWave ? 0.34 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3)) : 0;
        wave.scale.x = showWave ? 1 : 0.1;
        for (let i = 0; i < waveFoam.children.length; i++) {
          const s = waveFoam.children[i];
          const o = s.userData.offset;
          s.position.set(p.x + Math.cos(wave.rotation.y + Math.PI / 2) * o, p.y + 0.25 + s.userData.y, p.z + Math.sin(wave.rotation.y + Math.PI / 2) * o);
          s.material.opacity = showWave ? 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(t * 4 + i)) : 0;
          fitSprite(s, camera, 24, 0.04, 1.4);
        }

        for (const bar of timeline.children) {
          if (bar.isSprite) fitSprite(bar, camera, 26, 0.06, 1.8);
        }

        fitSprite(rainLabel, camera, 24, 0.06, 1.8);
        fitSprite(seaLabel, camera, 24, 0.06, 1.8);
        setSphere();
      },
    };
  },
};

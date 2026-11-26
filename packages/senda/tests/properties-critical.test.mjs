/**
 * SENDA · F2 Pruebas de propiedades (generador determinista sin dependencias)
 * para los 5 módulos críticos de cálculo:
 *   1. erasure.mjs (Reed-Solomon MDS sobre GF(256))
 *   2. heading-fusion.mjs (ángulos circulares, W3C DeviceOrientation y fusión GPS+brújula)
 *   3. mmwave-radar.mjs (parser de flujo RD-03D/LD2450, filtro de ecos, Kalman, calibración)
 *   4. shallow-water.mjs (lago en reposo, conservación de masa, no negatividad, hidrogramas)
 *   5. rail-reconstruct.mjs (cinemática lineal a trozos, aditividad, monotonía de frenado)
 *
 * Semilla fija (0x5E4DA2026) → 100 % reproducible en cualquier máquina y en CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gfMul, gfInv, encodeShards, decodeShards, SHARD_HEADER, packShard, unpackShard, createReassembler,
} from '../src/erasure.mjs';
import {
  norm360, angDiff, deviceToEarth, compassHeading, createHeadingFusion,
} from '../src/heading-fusion.mjs';
import {
  CMD, SERIAL, decodeVal, encodeVal, decodePayload, encodeFrame, createFrameParser,
  cleanTargets, createTracker, radarToLonLat, calibrateMountYaw, trackBearingDeg, calibrateRange,
} from '../src/mmwave-radar.mjs';
import {
  createSim, storedVolume, step, runUntil, piecewise, hydrographVolume,
} from '../src/shallow-water.mjs';
import {
  hms, fmtHms, speedProfile, pkAt, meanDecel, stopping, closingKmh, brakingShortfall,
} from '../src/rail-reconstruct.mjs';

function makeRng(seed = 0x5E4DA202) {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); },
    float(min, max) { return min + this.next() * (max - min); },
    bytes(len) {
      const b = new Uint8Array(len);
      for (let i = 0; i < len; i++) b[i] = this.int(0, 255);
      return b;
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = this.int(0, i);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

/* ─────────────────────────── 1. erasure.mjs ─────────────────────────── */

test('Propiedad [erasure]: leyes algebraicas de GF(256) y rechazo de inverso de 0', () => {
  const rng = makeRng(101);
  assert.throws(() => gfInv(0), /inverso de 0/);
  assert.equal(gfMul(0, 123), 0);
  assert.equal(gfMul(123, 0), 0);

  for (let i = 0; i < 400; i++) {
    const a = rng.int(1, 255);
    const b = rng.int(1, 255);
    const c = rng.int(0, 255);
    assert.equal(gfMul(a, b), gfMul(b, a), 'conmutatividad');
    assert.equal(gfMul(a, gfInv(a)), 1, 'elemento inverso');
    assert.equal(gfMul(gfMul(a, b), c), gfMul(a, gfMul(b, c)), 'asociatividad');
    assert.equal(gfMul(a, b ^ c), gfMul(a, b) ^ gfMul(a, c), 'distributividad');
  }
});

test('Propiedad [erasure]: propiedad MDS (cualquier k de n fragmentos reconstruye) y fronteras', () => {
  const rng = makeRng(102);
  assert.throws(() => encodeShards(new Uint8Array([1]), 0, 2));
  assert.throws(() => encodeShards(new Uint8Array([1]), 4, 3));
  assert.throws(() => encodeShards(new Uint8Array([1]), 2, 256));

  for (let trial = 0; trial < 50; trial++) {
    const k = rng.int(1, 7);
    const n = rng.int(k, k + 6);
    const len = trial === 0 ? 0 : rng.int(1, 260);
    const data = rng.bytes(len);
    const enc = encodeShards(data, k, n);
    assert.equal(enc.k, k);
    assert.equal(enc.n, n);
    assert.equal(enc.len, len);
    assert.equal(enc.shards.length, n);
    assert.ok(enc.shardSize >= 1);

    const all = enc.shards.map((s, index) => ({ index, data: s }));
    const subset = rng.shuffle(all).slice(0, k);
    const withDup = subset.length > 0 ? [subset[0], ...subset, subset[0]] : subset;
    const dec = decodeShards(withDup, { k, len });
    assert.deepEqual(dec, data, `fallo de reconstrucción MDS trial=${trial} k=${k} n=${n} len=${len}`);

    if (k > 1) {
      assert.throws(() => decodeShards(subset.slice(0, k - 1), { k, len }), /faltan fragmentos/);
    }
  }
});

test('Propiedad [erasure]: packShard/unpackShard y createReassembler con desorden, basura y duplicados', () => {
  const rng = makeRng(103);
  assert.equal(SHARD_HEADER, 16);
  assert.equal(unpackShard(new Uint8Array(15)), null);
  assert.equal(unpackShard(new Uint8Array([0x00, 0x46, 1, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])), null);
  assert.equal(unpackShard(new Uint8Array([0x53, 0x00, 1, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])), null);
  assert.equal(unpackShard(new Uint8Array([0x53, 0x46, 2, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])), null);

  for (let trial = 0; trial < 20; trial++) {
    const k = rng.int(2, 5);
    const n = k + rng.int(1, 4);
    const data = rng.bytes(rng.int(5, 300));
    const idBytes = rng.bytes(8);
    const idHex = [...idBytes].map((x) => x.toString(16).padStart(2, '0')).join('');
    const enc = encodeShards(data, k, n);
    const packed = enc.shards.map((s, index) => packShard({ id: idBytes, k, n, len: data.length, index, data: s }));

    const first = unpackShard(packed[0]);
    assert.equal(first.id, idHex);
    assert.equal(first.k, k);
    assert.equal(first.n, n);
    assert.equal(first.index, 0);
    assert.equal(first.len, data.length);
    assert.deepEqual(first.data, enc.shards[0]);

    const re = createReassembler();
    assert.equal(re.add(new Uint8Array([1, 2, 3])), null);
    const order = rng.shuffle([...Array(n).keys()]);
    let delivered = null;
    for (let i = 0; i < order.length; i++) {
      const idx = order[i];
      const res = re.add(packed[idx], `bearer-${i % 3}`);
      if (i < k - 1) {
        assert.equal(res, null);
        assert.equal(re.pending().length, 1);
        assert.equal(re.pending()[0].have, i + 1);
        assert.equal(re.pending()[0].need, k);
      } else if (i === k - 1) {
        delivered = res;
        assert.ok(delivered);
        assert.equal(delivered.id, idHex);
        assert.deepEqual(delivered.data, data);
        assert.ok(delivered.via.length >= 1);
        assert.equal(re.pending().length, 0);
      } else {
        assert.equal(res, null, 'fragmento tras completar debe devolverse null');
      }
    }
  }
});

/* ─────────────────────────── 2. heading-fusion.mjs ─────────────────────────── */

test('Propiedad [heading-fusion]: aritmética circular norm360, angDiff y ortogonalidad de deviceToEarth', () => {
  const rng = makeRng(201);
  for (let i = 0; i < 400; i++) {
    const a = rng.float(-10000, 10000);
    const b = rng.float(-10000, 10000);
    const na = norm360(a);
    assert.ok(na >= 0 && na < 360, `norm360 fuera de rango: ${na}`);
    const k = rng.int(-20, 20);
    const shiftDiff = Math.abs(angDiff(norm360(a + 360 * k), na));
    assert.ok(shiftDiff < 1e-7, `periodicidad 360° rota: ${shiftDiff}`);

    const d = angDiff(a, b);
    assert.ok(d > -180 && d <= 180, `angDiff fuera de (-180,180]: ${d}`);
    const reconstructed = norm360(b + d);
    assert.ok(Math.abs(angDiff(reconstructed, na)) < 1e-7, 'b + angDiff(a,b) ≡ a (mod 360)');
  }
  assert.equal(angDiff(359, 1), -2);
  assert.equal(angDiff(1, 359), 2);
  assert.equal(angDiff(180, 0), 180);

  for (let i = 0; i < 200; i++) {
    const ev = { alpha: rng.float(0, 360), beta: rng.float(-180, 180), gamma: rng.float(-90, 90) };
    const v = [rng.float(-5, 5), rng.float(-5, 5), rng.float(-5, 5)];
    const w = deviceToEarth(ev, v);
    const normV = Math.hypot(...v);
    const normW = Math.hypot(...w);
    assert.ok(Math.abs(normV - normW) < 1e-11, `deviceToEarth debe preservar norma (${normV} vs ${normW})`);
  }
});

test('Propiedad [heading-fusion]: compassHeading (iOS, flat, upright, cielo/suelo) y fusión circular sin saltos', () => {
  const rng = makeRng(202);
  assert.equal(compassHeading(null), null);
  assert.equal(compassHeading({ absolute: false, alpha: 10, beta: 0, gamma: 0 }), null);
  assert.equal(compassHeading({ absolute: true, alpha: NaN, beta: 0, gamma: 0 }), null);
  assert.deepEqual(compassHeading({ webkitCompassHeading: 350 }, { screenAngle: 20 }), { headingDeg: 10, mode: 'ios', horizontalNorm: 1 });
  // Móvil plano mirando al norte (alpha=0, beta=0, gamma=0) → 0°
  const flatN = compassHeading({ absolute: true, alpha: 0, beta: 0, gamma: 0 });
  assert.equal(flatN.mode, 'flat');
  assert.ok(Math.abs(angDiff(flatN.headingDeg, 0)) < 1e-9);
  const flatRot = compassHeading({ absolute: true, alpha: 0, beta: 0, gamma: 0 }, { screenAngle: 90 });
  assert.ok(Math.abs(angDiff(flatRot.headingDeg, 90)) < 1e-9);
  // Móvil en soporte vertical (|beta| > 50, beta=90, alpha=0, gamma=0) → cámara trasera hacia norte (0°)
  const upN = compassHeading({ absolute: true, alpha: 0, beta: 90, gamma: 0 });
  assert.equal(upN.mode, 'upright');
  assert.ok(Math.abs(angDiff(upN.headingDeg, 0)) < 1e-9);
  // Móvil vertical mirando al suelo (beta=0 no es upright; beta=180 → v=[0,0,-1] apunta hacia arriba, h=0 → null)
  assert.equal(compassHeading({ absolute: true, alpha: 0, beta: 180, gamma: 0 }), null);

  for (const key of ['gpsMinSpeedMs', 'tauCompassS', 'tauGpsS', 'tauOffsetS']) {
    const bad = { gpsMinSpeedMs: 1.5, tauCompassS: 0.4, tauGpsS: 0.3, tauOffsetS: 5 };
    bad[key] = 0;
    assert.throws(() => createHeadingFusion(bad), new RegExp(key));
  }

  const f = createHeadingFusion({ gpsMinSpeedMs: 2, tauCompassS: 0.5, tauGpsS: 0.3, tauOffsetS: 4 });
  assert.deepEqual(f.state(), { headingDeg: null, source: null, confidence: 0, offsetDeg: null, offsetSamples: 0 });
  // Cruce 359° ↔ 1° en brújula debe quedar cerca de 0°, nunca en 180°
  f.compass(359, 0);
  const st1 = f.compass(1, 0.25);
  assert.equal(st1.source, 'brujula');
  assert.ok(Math.abs(angDiff(st1.headingDeg, 0)) < 5, `salto espurio en 0°/360°: ${st1.headingDeg}`);
  assert.ok(st1.confidence > 0.9 && st1.confidence <= 1);

  // GPS con velocidad baja se ignora; con velocidad alta manda y aprende el offset (+15°)
  const ignored = f.gps(120, 0.5, 0.5);
  assert.equal(ignored.source, 'brujula');
  for (let s = 1; s <= 20; s++) {
    f.compass(85, s);
    const gs = f.gps(100, 10, s + 0.2);
    assert.equal(gs.source, 'gps');
  }
  const stAfter = f.state();
  assert.ok(stAfter.offsetSamples >= 18);
  assert.ok(Math.abs(stAfter.offsetDeg - 15) < 3, `offset aprendido esperado ~15°, obtenido ${stAfter.offsetDeg}`);
  // Mientras GPS es fresco (<2 s), compass no sobreescribe source
  const stillGps = f.compass(85, 21.0);
  assert.equal(stillGps.source, 'gps');
  // Pasados >2 s sin GPS, vuelve a brújula calibrada aplicando offset (~100°)
  const backCompass = f.compass(85, 25.0);
  assert.equal(backCompass.source, 'brujula_calibrada');
  assert.ok(Math.abs(angDiff(backCompass.headingDeg, 100)) < 4, `esperado ~100°, obtenido ${backCompass.headingDeg}`);

  // Stress aleatorio: nunca NaN ni fuera de [0, 360)
  const f2 = createHeadingFusion({ gpsMinSpeedMs: 1.5, tauCompassS: 0.5, tauGpsS: 0.5, tauOffsetS: 5 });
  let t = 0;
  for (let i = 0; i < 200; i++) {
    t += rng.float(0.05, 1.5);
    const s = rng.next() < 0.6 ? f2.compass(rng.float(-720, 720), t) : f2.gps(rng.float(-720, 720), rng.float(0, 25), t);
    if (s.headingDeg !== null) {
      assert.ok(Number.isFinite(s.headingDeg) && s.headingDeg >= 0 && s.headingDeg < 360);
      assert.ok(Number.isFinite(s.confidence) && s.confidence >= 0 && s.confidence <= 1);
    }
  }
});

/* ─────────────────────────── 3. mmwave-radar.mjs ─────────────────────────── */

test('Propiedad [mmwave-radar]: biyección encodeVal/decodeVal y resiliencia de createFrameParser con ruido aleatorio', () => {
  const rng = makeRng(301);
  assert.equal(SERIAL.baudRate, 256000);
  assert.equal(CMD.ENABLE_CONFIG[0], 0xfd);
  assert.equal(CMD.MULTI_TARGET[6], 0x90);
  assert.equal(CMD.END_CONFIG[6], 0xfe);

  for (const v of [-32767, -1000, -1, 0, 1, 1000, 32767]) {
    const [lo, hi] = encodeVal(v);
    assert.equal(decodeVal(lo, hi), v);
  }
  for (let i = 0; i < 400; i++) {
    const v = rng.int(-32767, 32767);
    const [lo, hi] = encodeVal(v);
    assert.equal(decodeVal(lo, hi), v);
  }

  // Inyección de 40 tramas válidas mezcladas con bytes aleatorios, cabeceras falsas y tramas rotas
  const expected = [];
  const streamParts = [];
  let injectedBad = 0;

  for (let i = 0; i < 40; i++) {
    // Ruido aleatorio sin secuencia HDR exacta (filtramos 0xAA seguido de 0xFF)
    const noiseLen = rng.int(1, 25);
    const noise = rng.bytes(noiseLen);
    for (let j = 0; j < noise.length; j++) if (noise[j] === 0xaa) noise[j] = 0xab;
    streamParts.push(noise);
    // Cabecera falsa incompleta (AA FF 03 01) y repetición AA AA FF 03 00
    streamParts.push(Uint8Array.from([0xaa, 0xff, 0x03, 0x01, 0xaa]));

    const nTargets = rng.int(1, 3);
    const targets = [];
    for (let k = 0; k < nTargets; k++) {
      targets.push({
        slot: k,
        xMm: rng.int(-3000, 3000) || 10,
        yMm: rng.int(200, 6000),
        speedCms: rng.int(-200, 200),
        resMm: rng.int(100, 500),
      });
    }
    const frame = encodeFrame(targets);
    assert.equal(frame.length, 30);
    if (i % 5 === 0) {
      const corrupt = Uint8Array.from(frame);
      corrupt[29] = 0x00; // cola rota
      streamParts.push(corrupt);
      injectedBad++;
    } else {
      streamParts.push(frame);
      expected.push(targets);
    }
  }

  // Concatenar todo el flujo y trocear en chunks aleatorios de 1..13 bytes
  const totalLen = streamParts.reduce((s, p) => s + p.length, 0);
  const full = new Uint8Array(totalLen);
  let off = 0;
  for (const p of streamParts) { full.set(p, off); off += p.length; }

  const got = [];
  const parser = createFrameParser((targets) => got.push(targets));
  let pos = 0;
  while (pos < full.length) {
    const chunkLen = rng.int(1, 13);
    parser.push(full.subarray(pos, pos + chunkLen));
    pos += chunkLen;
  }

  assert.equal(parser.stats().ok, expected.length);
  assert.equal(parser.stats().bad, injectedBad);
  assert.deepEqual(got, expected);

  // DecodePayload directo con array normal (no TypedArray) y huecos a 0
  assert.deepEqual(decodePayload(new Array(24).fill(0)), []);
});

test('Propiedad [mmwave-radar]: cleanTargets, createTracker (cruce 2/3 objetivos, coasting, baja) y calibraciones', () => {
  assert.throws(() => cleanTargets([], { minMm: -1, maxMm: 5000, mergeMm: 300 }));
  const cleaned = cleanTargets([
    { xMm: 0, yMm: 50, speedCms: 0 },      // <= minMm (fuera)
    { xMm: 0, yMm: 7000, speedCms: 0 },    // > maxMm (fuera)
    { xMm: 1000, yMm: 2000, speedCms: 20 },
    { xMm: 1100, yMm: 2050, speedCms: -80 }, // se fusiona con el anterior, conserva -80
    { xMm: -1500, yMm: 3000, speedCms: 30 },
  ], { minMm: 100, maxMm: 6000, mergeMm: 350 });
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].xMm, 1050);
  assert.equal(cleaned[0].yMm, 2025);
  assert.equal(cleaned[0].speedCms, -80);

  for (const k of ['gateMm', 'qMmS2', 'rMm', 'maxMissS']) {
    const bad = { gateMm: 900, qMmS2: 400, rMm: 150, maxMissS: 1.0 };
    bad[k] = 0;
    assert.throws(() => createTracker(bad), new RegExp(k));
  }

  // Dos personas cruzándose en X mantienen IDs estables; luego una desaparece (coasting) y caduca
  const tr = createTracker({ gateMm: 900, qMmS2: 400, rMm: 120, maxMissS: 0.6 });
  let ids0 = null;
  for (let i = 0; i <= 10; i++) {
    const tS = i * 0.1;
    const dets = [
      { xMm: -1000 + i * 200, yMm: 2500, speedCms: 200 },
      { xMm: 1000 - i * 200, yMm: 2500, speedCms: -200 },
    ];
    const out = tr.step(dets, tS);
    assert.equal(out.length, 2);
    if (i === 0) ids0 = new Set(out.map((o) => o.id));
    else assert.deepEqual(new Set(out.map((o) => o.id)), ids0);
    for (const o of out) {
      assert.ok(Number.isFinite(o.sigmaMm) && o.sigmaMm >= 0);
      assert.equal(o.coasting, false);
    }
  }
  // Coasting (sin detecciones durante 0.3 s) y purga tras > 0.6 s
  const coast = tr.step([], 1.3);
  assert.equal(coast.length, 2);
  assert.ok(coast.every((o) => o.coasting === true));
  const purged = tr.step([], 2.0);
  assert.equal(purged.length, 0);

  // Proyección geográfica (hacia el Norte y hacia el Este)
  const [lonN, latN] = radarToLonLat({ xMm: 0, yMm: 110574 }, { lon: 0, lat: 0, headingDeg: 0 });
  assert.ok(Math.abs(lonN) < 1e-6 && Math.abs(latN - 0.001) < 1e-6);
  const [lonE, latE] = radarToLonLat({ xMm: 0, yMm: 111320 }, { lon: 0, lat: 0, headingDeg: 90 });
  assert.ok(Math.abs(lonE - 0.001) < 1e-6 && Math.abs(latE) < 1e-6);

  // Calibración de montaje (con cruce 0°/360°), rumbo de estela y cinta métrica
  assert.throws(() => calibrateMountYaw([]));
  const my = calibrateMountYaw([{ measuredDeg: 355, trueDeg: 5 }, { measuredDeg: 356, trueDeg: 6 }]);
  assert.ok(Math.abs(my.mountYawDeg - 10) < 0.05);
  assert.equal(my.n, 2);

  assert.throws(() => trackBearingDeg([[0, 0], [1, 1]]));
  const tbE = trackBearingDeg([[0, 1000], [500, 1000], [1000, 1000], [1500, 1000]]);
  assert.ok(Math.abs(tbE.bearingDeg - 90) < 1e-6);
  assert.ok(tbE.lateralRmsMm < 1e-6 && tbE.lengthMm > 1000);
  const tbW = trackBearingDeg([[1500, 1000], [1000, 1000], [500, 1000], [0, 1000]]);
  assert.ok(Math.abs(tbW.bearingDeg - 270) < 1e-6);

  assert.throws(() => calibrateRange([{ measuredMm: 1000, trueMm: 1000 }]));
  assert.throws(() => calibrateRange([{ measuredMm: 1000, trueMm: 1000 }, { measuredMm: 1000, trueMm: 1200 }]));
  const cr = calibrateRange([
    { measuredMm: 1000, trueMm: 1120 },
    { measuredMm: 2000, trueMm: 2170 },
    { measuredMm: 4000, trueMm: 4270 },
  ]);
  assert.ok(Math.abs(cr.scale - 1.05) < 1e-5);
  assert.ok(Math.abs(cr.biasMm - 70) < 0.2);
  assert.ok(cr.residualRmsMm < 0.1);
});

/* ─────────────────────────── 4. shallow-water.mjs ─────────────────────────── */

test('Propiedad [shallow-water]: lago en reposo exacto en 8 batimetrías aleatorias con islas', () => {
  const rng = makeRng(401);
  assert.throws(() => createSim({ w: 4, h: 4, z: new Float32Array(16), dx: 10, n: 0 }));

  for (let trial = 0; trial < 8; trial++) {
    const w = 7, h = 7, dx = rng.float(5, 50);
    const z = new Float32Array(w * h);
    const eta0 = 5.0;
    for (let k = 0; k < w * h; k++) z[k] = rng.float(0, 7.5); // mezcla celdas húmedas e islas secas (>5 m)
    const nField = trial % 2 === 0 ? rng.float(0.02, 0.12) : new Float32Array(w * h).fill(rng.float(0.03, 0.08));
    const S = createSim({ w, h, z, dx, n: nField });
    for (let k = 0; k < w * h; k++) {
      if (z[k] < eta0) {
        S.d[k] = eta0 - z[k];
      }
    }
    S.box = [0, w - 1, 0, h - 1];
    const v0 = storedVolume(S);
    for (let s = 0; s < 10; s++) step(S, 2.0);

    let maxQ = 0;
    for (const q of S.qx) maxQ = Math.max(maxQ, Math.abs(q));
    for (const q of S.qy) maxQ = Math.max(maxQ, Math.abs(q));
    assert.ok(maxQ < 1e-11, `lago en reposo perturbado trial=${trial}: maxQ=${maxQ}`);
    assert.ok(Math.abs(storedVolume(S) - v0) <= 1e-9 * Math.max(1, v0));
  }
});

test('Propiedad [shallow-water]: conservación de masa (<1e-9), no negatividad y hidrograma exacto', () => {
  const rng = makeRng(402);

  for (let trial = 0; trial < 8; trial++) {
    const w = 7, h = 7, dx = rng.float(10, 40);
    const z = new Float32Array(w * h);
    const sink = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        z[k] = 20 - 0.5 * i - 0.3 * j + rng.float(-0.4, 0.4);
        if (i === w - 1 && trial % 2 === 1) sink[k] = 1; // mitad con sumidero en borde, mitad cerrado
      }
    }
    if (trial === 0) z[0] = NaN; // celda NaN → sumidero automático
    const S = createSim({ w, h, z, dx, n: rng.float(0.025, 0.09), sink });
    const srcCell = 3 * w + 1;
    const pts = [[0, 0], [20, rng.float(20, 150)], [40, 0]];
    const frames = [];
    runUntil(S, 50, { inflow: piecewise(pts), cells: [srcCell], dtMax: 2.5, frameEvery: 20, onFrame: (t) => frames.push(t) });

    assert.ok(frames.length >= 2);
    for (let k = 0; k < w * h; k++) {
      assert.ok(S.d[k] >= 0 && Number.isFinite(S.d[k]), `calado inválido en k=${k}: ${S.d[k]}`);
      assert.ok(S.maxD[k] >= S.d[k] - 1e-5);
    }
    const accounted = storedVolume(S) + S.volOut;
    const relErr = Math.abs(accounted - S.volIn) / Math.max(1, S.volIn);
    assert.ok(relErr < 1e-9, `conservación de masa rota trial=${trial}: relErr=${relErr}`);

    // Verificar regla del trapecio exacta del hidrograma
    const expectedVol = 0.5 * pts[1][1] * 40;
    assert.ok(Math.abs(hydrographVolume(pts) - expectedVol) < 1e-9);
  }
  // Paso en seco sin caja activa avanza tiempo sin lanzar error
  const empty = createSim({ w: 3, h: 3, z: new Float32Array(9), dx: 10, n: 0.04 });
  assert.equal(step(empty, 5), 5);
  assert.equal(empty.t, 5);
  assert.equal(piecewise([[10, 5], [20, 15]])(10), 5);
  assert.equal(piecewise([[10, 5], [20, 15]])(5), 0);
  assert.equal(piecewise([[10, 5], [20, 15]])(25), 0);

  // Rampa rápida (10×3 celdas): fricción de Manning mayor → mayor retención aguas arriba, menos descarga y llegada más lenta
  const runRamp = (nVal) => {
    const w = 10, h = 3, dx = 20, z = new Float32Array(w * h), sink = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      z[j * w + i] = (w - 1 - i) * dx * 0.008;
      if (i === w - 1) sink[j * w + i] = 1;
    }
    const sim = createSim({ w, h, z, dx, n: nVal, sink, hArrive: 0.05 });
    runUntil(sim, 160, { inflow: () => 60, cells: [0, w, 2 * w], dtMax: 4 });
    return { inDepth: sim.d[w + 1], midArrive: sim.arrive[w + 4], volOut: sim.volOut };
  };
  const smooth = runRamp(0.025);
  const rough = runRamp(0.12);
  assert.ok(smooth.inDepth > 0.05 && rough.inDepth > smooth.inDepth, 'Manning más rugoso retiene mayor calado aguas arriba');
  assert.ok(rough.volOut < smooth.volOut, 'Manning más rugoso descarga menos volumen al sumidero en el mismo tiempo');
  assert.ok(Number.isFinite(smooth.midArrive) && Number.isFinite(rough.midArrive) && rough.midArrive > smooth.midArrive, 'Manning más rugoso retrasa la llegada');
});

test('Propiedad [shallow-water]: simetría 4 direcciones, paso CFL exacto, limitador y dimensiones', () => {
  assert.throws(() => createSim({ w: 3, h: 3, z: new Float32Array(9), dx: 10, n: 0 }), /Manning/);
  // Verificación de dimensiones, celda NaN → z=0 y sink=1, y dt exacto de Courant
  const z0 = new Float32Array(25);
  z0[0] = NaN;
  const s0 = createSim({ w: 5, h: 5, z: z0, dx: 10, n: 0.04, alpha: 0.7 });
  assert.equal(s0.qx.length, 20);
  assert.equal(s0.qy.length, 20);
  assert.equal(s0.z[0], 0);
  assert.equal(s0.sink[0], 1);
  // Poner agua en la esquina inferior derecha (4,4) y verificar cálculo exacto de dMax y dt CFL
  s0.d[24] = 4.0;
  s0.box = [4, 4, 4, 4];
  const dtCfl = step(s0, 100);
  const expectedDt = (0.7 * 10) / Math.sqrt(9.81 * 4.0);
  assert.ok(Math.abs(dtCfl - expectedDt) < 1e-6, `dt CFL esperado ${expectedDt}, obtenido ${dtCfl}`);
  assert.equal(s0.steps, 1);

  // Expansión simétrica desde el centro (2,2) en plano horizontal de 5×5 (ejercita ±x, ±y y growBox en las 4 fronteras)
  const sym = createSim({ w: 5, h: 5, z: new Float32Array(25), dx: 10, n: 0.03, hArrive: 0.02 });
  runUntil(sym, 12, { inflow: () => 50, cells: [12], dtMax: 2 });
  assert.deepEqual(sym.box, [0, 4, 0, 4], 'caja activa debe expandirse a las 4 fronteras');
  const dL = sym.d[11], dR = sym.d[13], dU = sym.d[7], dD = sym.d[17];
  assert.ok(dL > 0.05 && dR > 0.05 && dU > 0.05 && dD > 0.05);
  assert.ok(Math.abs(dL - dR) < 1e-9 && Math.abs(dU - dD) < 1e-9 && Math.abs(dL - dU) < 1e-9, 'simetría exacta en las 4 direcciones');
  assert.ok(sym.qx[2 * 4 + 2] > 0 && sym.qx[2 * 4 + 1] < 0, 'flujos +x y -x con signos opuestos');
  assert.ok(sym.qy[12] > 0 && sym.qy[7] < 0, 'flujos +y y -y con signos opuestos');
  assert.ok(Number.isFinite(sym.arrive[11]) && Number.isFinite(sym.arrive[17]));

  // Limitador de flujo en las 4 caras: columna muy delgada sobre meseta elevada con caída brusca en los 4 lados
  const zPeak = new Float32Array(9).fill(0);
  zPeak[4] = 5.0; // centro elevado 5 m sobre sus 4 vecinos
  const lim = createSim({ w: 3, h: 3, z: zPeak, dx: 2, n: 0.01, alpha: 0.99 });
  lim.d[4] = 0.05;
  lim.box = [1, 1, 1, 1];
  const vInit = storedVolume(lim);
  for (let i = 0; i < 6; i++) step(lim, 5.0);
  for (let k = 0; k < 9; k++) assert.ok(lim.d[k] >= 0, 'el limitador impide calados negativos');
  assert.ok(Math.abs(storedVolume(lim) - vInit) < 1e-9, 'el limitador conserva masa exacta');
  assert.ok(lim.d[1] > 0 && lim.d[3] > 0 && lim.d[5] > 0 && lim.d[7] > 0, 'los 4 vecinos reciben flujo simétrico');
});

/* ─────────────────────────── 5. rail-reconstruct.mjs ─────────────────────────── */

test('Propiedad [rail-reconstruct]: ida y vuelta hms/fmtHms, aditividad de distancia y monotonía física', () => {
  const rng = makeRng(501);
  assert.throws(() => speedProfile([]));
  assert.throws(() => stopping(120, 0));
  assert.throws(() => stopping(120, -1));

  for (let i = 0; i < 200; i++) {
    const sec = rng.int(0, 86399);
    const s = fmtHms(sec);
    assert.equal(hms(s), sec, `round-trip hms/fmtHms fallido para ${sec} (${s})`);
  }

  for (let trial = 0; trial < 100; trial++) {
    const m = rng.int(2, 6);
    const times = [];
    let cur = rng.int(0, 1000);
    for (let i = 0; i < m; i++) { cur += rng.int(5, 60); times.push(cur); }
    const pts = times.map((tSec) => ({ tSec, vKmh: rng.float(0, 300) }));
    const prof = speedProfile(rng.shuffle(pts)); // debe ordenar internamente

    // Clamping fuera del intervalo
    assert.ok(Math.abs(prof.v(times[0] - 50) - pts[0].vKmh / 3.6) < 1e-9);
    assert.ok(Math.abs(prof.v(times.at(-1) + 50) - pts.at(-1).vKmh / 3.6) < 1e-9);

    // Aditividad y antisimetría de dist(t1, t2)
    const tA = rng.float(times[0] - 20, times.at(-1) + 20);
    const tB = rng.float(times[0] - 20, times.at(-1) + 20);
    const tC = rng.float(times[0] - 20, times.at(-1) + 20);
    assert.ok(Math.abs(prof.dist(tA, tB) + prof.dist(tB, tA)) < 1e-6, 'antisimetría');
    assert.ok(Math.abs(prof.dist(tA, tC) - (prof.dist(tA, tB) + prof.dist(tB, tC))) < 1e-5, 'aditividad');

    // pkAt anclada
    const pk0 = rng.float(0, 500);
    assert.equal(pkAt(prof, { tAnchor: tA, pkAnchor: pk0, dir: 1 }, tA), pk0);
    const pkPos = pkAt(prof, { tAnchor: tA, pkAnchor: pk0, dir: 1 }, tA + 10);
    const pkNeg = pkAt(prof, { tAnchor: tA, pkAnchor: pk0, dir: -1 }, tA + 10);
    assert.ok(Math.abs((pkPos - pk0) + (pkNeg - pk0)) < 1e-9);

    // Monotonía física de stopping y brakingShortfall
    const v1 = rng.float(20, 140);
    const v2 = v1 + rng.float(1, 100);
    const a1 = rng.float(0.3, 1.0);
    const a2 = a1 + rng.float(0.1, 0.6);
    const s1 = stopping(v1, a1);
    const s2 = stopping(v2, a1);
    const s3 = stopping(v1, a2);
    assert.ok(s2.distM > s1.distM && s2.timeS > s1.timeS, 'más velocidad → mayor distancia y tiempo de parada');
    assert.ok(s3.distM < s1.distM && s3.timeS < s1.timeS, 'mayor deceleración → menor distancia y tiempo');

    const okStop = brakingShortfall(v1, a1, s1.distM + 50);
    assert.equal(okStop.shortfallM, 0);
    assert.equal(okStop.earlierS, 0);
    const lateStop = brakingShortfall(v1, a1, Math.max(0, s1.distM - 100));
    assert.ok(lateStop.shortfallM > 0 && lateStop.earlierS > 0);
  }

  assert.ok(Math.abs(meanDecel({ tSec: 0, vKmh: 180 }, { tSec: 50, vKmh: 0 }) - 1.0) < 1e-9);
  assert.equal(closingKmh(200, 180), 380);
});

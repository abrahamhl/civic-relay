import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeVal, encodeVal, encodeFrame, createFrameParser, cleanTargets, createTracker, radarToLonLat, calibrateMountYaw, CMD } from '../src/mmwave-radar.mjs';

test('convención de signo del RD-03D/LD2450 (bit 15 activo = positivo) y su inversa', () => {
  assert.equal(decodeVal(0x0e, 0x83), 0x030e); // 0x830E → +782 mm
  assert.equal(decodeVal(0x0e, 0x03), -0x030e); // 0x030E → −782 mm
  for (const v of [-8000, -1, 0, 1, 1234, 8000]) { const [lo, hi] = encodeVal(v); assert.equal(decodeVal(lo, hi), v === 0 ? 0 : v); }
  assert.equal(CMD.MULTI_TARGET[6], 0x90); assert.equal(CMD.ENABLE_CONFIG.length, 14);
});

test('lector de flujo: trozos arbitrarios, basura delante, trama corrupta descartada', () => {
  const frames = [];
  const p = createFrameParser((t) => frames.push(t));
  const good = encodeFrame([{ xMm: -500, yMm: 2000, speedCms: -30, resMm: 360 }, null, { xMm: 1200, yMm: 3500, speedCms: 15, resMm: 360 }]);
  const bad = encodeFrame([{ xMm: 1, yMm: 2, speedCms: 3 }]); bad[29] = 0x00; // cierre roto
  const stream = Uint8Array.from([0x13, 0xaa, 0x00, ...good, ...bad, ...good]);
  for (let i = 0; i < stream.length; i += 7) p.push(stream.subarray(i, i + 7));
  assert.equal(frames.length, 2); assert.deepEqual(p.stats(), { ok: 2, bad: 1 });
  assert.deepEqual(frames[0].map((t) => [t.slot, t.xMm, t.yMm, t.speedCms, t.resMm]), [[0, -500, 2000, -30, 360], [2, 1200, 3500, 15, 360]]);
});

test('limpieza: alcance y fusión de ecos a menos de la distancia dada (sin valores por defecto)', () => {
  assert.throws(() => cleanTargets([], {}), /sin valores por defecto/);
  const t = cleanTargets([{ xMm: 0, yMm: 50, speedCms: 0 }, { xMm: 0, yMm: 2000, speedCms: -10 }, { xMm: 400, yMm: 2200, speedCms: -40 }, { xMm: 0, yMm: 9000, speedCms: 0 }], { minMm: 100, maxMm: 8000, mergeMm: 1000 });
  assert.equal(t.length, 1); assert.equal(t[0].xMm, 200); assert.equal(t[0].yMm, 2100); assert.equal(t[0].speedCms, -40);
});

test('seguimiento: dos personas que se cruzan conservan su identidad (asignación óptima + Kalman)', () => {
  assert.throws(() => createTracker({}), /sin valor por defecto/);
  const tr = createTracker({ gateMm: 900, qMmS2: 1500, rMm: 120, maxMissS: 1.5 });
  let out;
  for (let k = 0; k <= 50; k++) { // 10 Hz, 5 s: A de izquierda a derecha, B de derecha a izquierda, a 3 m y 3,4 m
    const t = k * 0.1, ax = -2000 + 800 * t, bx = 2000 - 800 * t;
    out = tr.step([{ xMm: ax, yMm: 3000, speedCms: 0 }, { xMm: bx, yMm: 3400, speedCms: 0 }], t);
  }
  assert.equal(out.length, 2);
  const a = out.find((o) => o.id === 1), b = out.find((o) => o.id === 2);
  assert.ok(Math.abs(a.xMm - 2000) < 150 && Math.abs(a.yMm - 3000) < 150, `A ${a.xMm},${a.yMm}`);
  assert.ok(Math.abs(b.xMm + 2000) < 150 && Math.abs(b.yMm - 3400) < 150, `B ${b.xMm},${b.yMm}`);
  assert.ok(Math.abs(a.vxMms - 800) < 120 && Math.abs(b.vxMms + 800) < 120, `v ${a.vxMms} ${b.vxMms}`);
  out = tr.step([], 5.5); assert.equal(out.length, 2); assert.ok(out.every((o) => o.coasting)); // breve oclusión: siguen
  out = tr.step([], 7.5); assert.equal(out.length, 0); // más de maxMissS: baja
});

test('proyección al mapa y calibración del montaje', () => {
  const pose = { lon: 5.5586, lat: 52.0233, headingDeg: 90 }; // radar mirando al este
  const [lon, lat] = radarToLonLat({ xMm: 0, yMm: 10_000 }, pose); // 10 m delante → 10 m al este
  assert.ok(Math.abs((lon - pose.lon) * 111320 * Math.cos((pose.lat * Math.PI) / 180) - 10) < 1e-6); assert.ok(Math.abs(lat - pose.lat) < 1e-12);
  const cal = calibrateMountYaw([{ measuredDeg: 355, trueDeg: 2 }, { measuredDeg: 358, trueDeg: 5 }, { measuredDeg: 1, trueDeg: 8 }]);
  assert.ok(Math.abs(cal.mountYawDeg - 7) < 1e-9); assert.ok(cal.circularSpreadDeg < 1e-3);
});

test('rumbo de la marcha por componentes principales y calibración de distancia', async () => {
  const { trackBearingDeg, calibrateRange } = await import('../src/mmwave-radar.mjs');
  const trail = []; for (let i = 0; i < 20; i++) trail.push([i * 100 * Math.sin(Math.PI / 6) + (i % 2 ? 20 : -20), 2000 + i * 100 * Math.cos(Math.PI / 6)]);
  const b = trackBearingDeg(trail); assert.ok(Math.abs(b.bearingDeg - 30) < 1.5, `rumbo ${b.bearingDeg}`); assert.ok(b.lateralRmsMm < 25);
  assert.ok(Math.abs(trackBearingDeg(trail.slice().reverse()).bearingDeg - 210) < 1.5); // sentido contrario
  const cal = calibrateRange([{ measuredMm: 1050, trueMm: 1000 }, { measuredMm: 2080, trueMm: 2000 }, { measuredMm: 3110, trueMm: 3000 }, { measuredMm: 4140, trueMm: 4000 }]);
  assert.ok(Math.abs(cal.scale - 1000 / 1030) < 1e-4 && cal.residualRmsMm < 0.1, JSON.stringify(cal));
  assert.throws(() => calibrateRange([{ measuredMm: 1, trueMm: 1 }, { measuredMm: 1, trueMm: 2 }]), /iguales/);
});

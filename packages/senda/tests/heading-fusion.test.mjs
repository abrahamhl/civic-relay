import test from 'node:test';
import assert from 'node:assert/strict';
import { compassHeading, deviceToEarth, createHeadingFusion, angDiff, norm360 } from '../src/heading-fusion.mjs';

const near = (a, b, tol = 1e-6) => Math.abs(angDiff(a, b)) < tol;
const CFG = { gpsMinSpeedMs: 3, tauCompassS: 0.5, tauGpsS: 1, tauOffsetS: 5 };

test('matriz W3C: el borde superior de un móvil plano con alpha = 0 apunta al norte', () => {
  const v = deviceToEarth({ alpha: 0, beta: 0, gamma: 0 }, [0, 1, 0]);
  assert.ok(Math.abs(v[0]) < 1e-12 && Math.abs(v[1] - 1) < 1e-12 && Math.abs(v[2]) < 1e-12);
});

test('brújula plana: rumbo = 360 − alpha; con pantalla girada se suma el ángulo', () => {
  assert.ok(near(compassHeading({ absolute: true, alpha: 90, beta: 0, gamma: 0 }).headingDeg, 270));
  assert.ok(near(compassHeading({ absolute: true, alpha: 0, beta: 10, gamma: 0 }).headingDeg, 0));
  assert.ok(near(compassHeading({ absolute: true, alpha: 0, beta: 0, gamma: 0 }, { screenAngle: 90 }).headingDeg, 90));
  assert.equal(compassHeading({ absolute: false, alpha: 90, beta: 0, gamma: 0 }), null); // sin referencia al norte no se inventa
  assert.ok(near(compassHeading({ webkitCompassHeading: 123 }).headingDeg, 123));
});

test('móvil vertical (soporte): manda la cámara trasera; alpha = 0, beta = 90 → la cámara mira al norte', () => {
  const r = compassHeading({ absolute: true, alpha: 0, beta: 90, gamma: 0 });
  assert.equal(r.mode, 'upright'); assert.ok(near(r.headingDeg, 0, 1e-9));
  const e = compassHeading({ absolute: true, alpha: 90, beta: 90, gamma: 0 }); // girado 90° a la izquierda → mira al oeste
  assert.ok(near(e.headingDeg, 270, 1e-9));
});

test('fusión: sin parámetros no arranca; despacio manda la brújula, deprisa el GPS', () => {
  assert.throws(() => createHeadingFusion({}), /sin valor por defecto/);
  const f = createHeadingFusion(CFG);
  let s; for (let t = 0; t < 5; t += 0.1) s = f.compass(80, t);
  assert.ok(near(s.headingDeg, 80, 0.01)); assert.equal(s.source, 'brujula');
  for (let t = 5; t < 15; t += 1) s = f.gps(100, 15, t);
  assert.ok(near(s.headingDeg, 100, 0.5)); assert.equal(s.source, 'gps');
});

test('autocalibración: aprende que la brújula marca 12° menos que el GPS y lo corrige parado', () => {
  const f = createHeadingFusion(CFG);
  for (let t = 0; t < 120; t += 0.5) { f.compass(norm360(48), t); f.gps(60, 20, t + 0.1); } // brújula 48°, GPS 60°
  const st = f.state(); assert.ok(Math.abs(st.offsetDeg - 12) < 0.5, `offset ${st.offsetDeg}`); assert.ok(st.offsetSamples > 100);
  let s; for (let t = 200; t < 210; t += 0.1) s = f.compass(348, t); // parado, brújula 348°
  assert.equal(s.source, 'brujula_calibrada'); assert.ok(near(s.headingDeg, 0, 0.6), `rumbo ${s.headingDeg}`); // 348 + 12 = 0 (cruza el norte)
});

test('suavizado circular: lecturas alrededor del norte no promedian 180°', () => {
  const f = createHeadingFusion(CFG); let s;
  for (let t = 0; t < 10; t += 0.1) s = f.compass(t % 0.2 < 0.1 ? 359 : 1, t);
  assert.ok(near(s.headingDeg, 0, 1.5), `rumbo ${s.headingDeg}`); assert.ok(s.confidence > 0.9);
});

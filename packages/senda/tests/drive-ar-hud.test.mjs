import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CAM_GEOM,
  projectToGround3D,
  project3DToScreen,
  classifyTrafficLightPixels,
  detectBrakeLightsPixels,
  enrichTracksForHud,
  declaredGeom,
  renderArHud,
} from '../src/drive-ar-hud.mjs';
import { createTracker, topAlert, RULES } from '../src/drive-hazard.mjs';

test('AR-HUD 3D monocular: proyección plano-suelo ↔ pantalla exacta y cálculo de THW', () => {
  // Proyectar un punto 3D conocido (x = 0 m, z = 25 m) a pantalla y volver a 3D
  const W = 1280, H = 720;
  const pt = project3DToScreen(0, 25, W, H, DEFAULT_CAM_GEOM);
  assert.ok(pt && pt.u > 600 && pt.u < 680 && pt.v > H * DEFAULT_CAM_GEOM.horizonY);

  const box = { x: pt.u / W - 0.05, y: pt.v / H - 0.12, w: 0.10, h: 0.12 };
  const p3 = projectToGround3D(box, { speedMs: 25, geom: DEFAULT_CAM_GEOM });
  assert.ok(p3);
  assert.ok(Math.abs(p3.zM - 25) < 0.8, `zM esperado ~25 m, obtenido ${p3.zM}`);
  assert.ok(Math.abs(p3.xM) < 0.3);
  assert.ok(Math.abs(p3.thwS - 1.0) < 0.05);

  // Recuadro por encima del horizonte -> null (nunca inventa distancia)
  assert.equal(projectToGround3D({ x: 0.4, y: 0.1, w: 0.05, h: 0.1 }), null);
});

test('AR-HUD cromático real: clasifica semáforo ROJO/ÁMBAR/VERDE/UNKNOWN y detecta luces de freno simétricas', () => {
  const makeTl = (litBand, rgb) => {
    const w = 12, h = 36, rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const band = y < 12 ? 0 : y < 24 ? 1 : 2;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const c = band === litBand ? rgb : [25, 25, 25];
        rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
      }
    }
    return { rgba, w, h };
  };
  assert.equal(classifyTrafficLightPixels(...Object.values(makeTl(0, [245, 30, 30]))).state, 'ROJO');
  assert.equal(classifyTrafficLightPixels(...Object.values(makeTl(1, [245, 190, 20]))).state, 'AMBAR');
  assert.equal(classifyTrafficLightPixels(...Object.values(makeTl(2, [30, 235, 60]))).state, 'VERDE');
  assert.equal(classifyTrafficLightPixels(...Object.values(makeTl(-1, [40, 40, 40]))).state, 'UNKNOWN');

  // Coche frenando: píxeles rojos intensos en bandas izquierda y derecha traseras
  const w = 40, h = 30, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 12; y < 20; y++) {
    for (const x of [2, 3, 4, 5, 34, 35, 36, 37]) {
      const i = (y * w + x) * 4;
      rgba[i] = 240; rgba[i + 1] = 20; rgba[i + 2] = 20; rgba[i + 3] = 255;
    }
  }
  assert.equal(detectBrakeLightsPixels(rgba, w, h).braking, true);
  assert.equal(detectBrakeLightsPixels(new Uint8ClampedArray(w * h * 4), w, h).braking, false);
});

test('AR-HUD + drive-hazard: identifica semáforos/stop/tren sin falsas alarmas de colisión y renderiza todas las capas', () => {
  const tr = createTracker({ ...RULES, includeInfra: true });
  let objs = [];
  for (let i = 0; i < 5; i++) {
    objs = tr.update([
      { label: 'traffic light', score: 0.85, x: 0.45, y: 0.15, w: 0.04 + i * 0.01, h: 0.08 + i * 0.02 },
      { label: 'stop sign', score: 0.90, x: 0.72, y: 0.30, w: 0.05 + i * 0.01, h: 0.06 + i * 0.01 },
      { label: 'car', score: 0.88, x: 0.42, y: 0.46, w: 0.16, h: 0.14 },
      { label: 'person', score: 0.82, x: 0.22, y: 0.45, w: 0.05, h: 0.16 },
    ], i * 0.25);
  }
  assert.equal(objs.length, 4);
  assert.equal(objs.find((o) => o.label === 'traffic light').group, 'INFRA');
  assert.equal(objs.find((o) => o.label === 'stop sign').group, 'INFRA');
  assert.equal(topAlert(objs), null, 'semáforos y señales STOP no deben disparar TTC ROJO');

  // Sin geometría declarada no hay metros (CLAUDE.md: parámetro sin fuente → sin valor)
  assert.equal(enrichTracksForHud(objs, { speedMs: 22 }).find((o) => o.label === 'car').p3, null);
  assert.equal(declaredGeom({ camHeightM: 9, fovVDeg: 48 }), null, 'altura absurda rechazada');
  const enriched = enrichTracksForHud(objs, { speedMs: 22, geom: declaredGeom({ camHeightM: 1.3, fovVDeg: 50 }) });
  assert.ok(enriched.find((o) => o.label === 'car').p3.zM > 5);
  assert.match(enriched.find((o) => o.label === 'car').p3.basis, /DECLARADA_POR_EL_USUARIO/);

  // Verificar renderizado completo sin excepciones sobre contexto mock Canvas2D
  const calls = [];
  const mockCtx = new Proxy({}, {
    get(_, prop) {
      if (prop === 'measureText') return (t) => ({ width: String(t).length * 8 });
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args) => { calls.push(prop); };
    },
    set() { return true; },
  });
  renderArHud(mockCtx, 1280, 720, {
    tracks: enriched, speedMs: 22, ssdM: 120, rssM: 48, curvature: 0.002,
    imu: { ax: -0.5, ay: 0.4, az: 9.81, gamma: 2 }, region: 'NL',
    radarTop: { distM: 320, maxspeed: 80, overLimit: false },
    pos: [5.9111, 51.9851], aiHz: 4, bbActive: true,
  });
  assert.ok(calls.includes('fillText') && calls.includes('stroke') && calls.includes('fillRect'));
});

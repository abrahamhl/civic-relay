import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_SOURCES, camerasAlong, fogScene, estimateVisibilityMulti, visibilityKoschmieder, snowIndex } from '../src/cameras.mjs';
import { ROUTE_MAD_VLC } from '../src/road-guard.mjs';

test('fuentes de cámaras: lo prohibido queda en NUNCA y Rijkswaterstaat solo por convenio', () => {
  for (const id of ['abiertas-sin-permiso', 'ojo-de-dios', 'biometria']) assert.equal(CAMERA_SOURCES.find((c) => c.id === id).access, 'NUNCA');
  assert.equal(CAMERA_SOURCES.find((c) => c.id === 'rws').access, 'CONVENIO');
  for (const c of CAMERA_SOURCES.filter((c) => c.access === 'PASIVO' && c.id !== 'propias')) assert.ok(c.url && c.license, c.id);
});

test('Koschmieder: transmisión 2 % a la distancia de visibilidad', () => {
  assert.ok(Math.abs(visibilityKoschmieder(Math.exp(-3.912), 100).visM - 100) < 1e-6);
});

test('visibilidad estimada en una imagen con niebla: error < 15 % y siempre del lado prudente o casi', () => {
  for (const v of [40, 80, 150, 300, 600]) {
    const s = fogScene({ visM: v }), e = estimateVisibilityMulti(s.rgba, s.w, s.h, s.refs);
    assert.ok(Math.abs(e.visM - v) / v < 0.15, `${v} → ${e.visM}`); assert.ok(e.visM <= v * 1.05, `${v} → ${e.visM}`);
  }
});

test('nieve en el suelo y cámaras a lo largo de la ruta', () => {
  const sn = fogScene({ visM: 300, snow: true }), cl = fogScene({ visM: 300 });
  assert.ok(snowIndex(sn.rgba, sn.w, sn.h) > 0.4 && snowIndex(cl.rgba, cl.w, cl.h) < 0.05);
  const cams = [{ id: 'c1', lat: 40.305, lon: -3.44 }, { id: 'c2', lat: 39.91, lon: -2.56 }, { id: 'lejos', lat: 41.6, lon: -0.9 }];
  assert.deepEqual(camerasAlong(cams, ROUTE_MAD_VLC).map((c) => c.id), ['c1', 'c2']);
});

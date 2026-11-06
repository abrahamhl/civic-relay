import test from 'node:test';
import assert from 'node:assert/strict';
import * as FC from '../src/fire-cases.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Fotogramas sintéticos SOLO para probar la geometría: un frente que avanza 6 km/h hacia el este.
const origin = [40, -105];
const kmToLon = (km) => km / (111.32 * Math.cos((40 * Math.PI) / 180));
const frames = Array.from({ length: 13 }, (_, k) => ({ t: new Date(Date.UTC(2024, 0, 1, 12, k * 10)).toISOString(), det: [0, 1, 2].map((r) => [40 + (r - 1) * 0.02, -105 + kmToLon(Math.round((k * 1) / 2) * 2), 100]) }));
const hrrr = [0, 1, 2, 3].map((h) => ({ validUTC: `2024-01-01T${String(12 + h).padStart(2, '0')}:00Z`, u10: 10, v10: 0, gust: 15, t2: 10, rh2: 20 }));

test('base de referencia: cada hecho tiene fuente o queda pendiente de verificar; ids únicos', () => {
  const ids = FC.REFERENCE_FIRES.map((f) => f.id); assert.equal(new Set(ids).size, ids.length);
  for (const f of FC.REFERENCE_FIRES) for (const h of f.hechos) {
    if (h.verificado) assert.ok(h.src === null ? f.id === 'smv-2026' : FC.FIRE_SOURCES_REF[h.src]?.url.startsWith('https://'), `${f.id}: ${h.k}`);
    if (h.src) assert.ok(FC.FIRE_SOURCES_REF[h.src], `fuente desconocida ${h.src}`);
  }
  assert.ok(FC.REFERENCE_FIRES.some((f) => f.id === 'eaton-2025' && f.hechos.some((h) => /03:00/.test(h.v))));
});

test('progresión GOES: viento del oeste ⇒ dirección a sotavento ≈ 90°, frente monótono y ROS ≈ 6 km/h', () => {
  const P = FC.goesProgression(frames, { hrrr });
  assert.ok(P.ok && Math.abs(P.dirDeg - 90) < 1 && P.dirFuente === 'sotavento HRRR');
  for (let i = 1; i < P.rows.length; i++) assert.ok(P.rows[i].frontMaxKm >= P.rows[i - 1].frontMaxKm);
  const seg = FC.runSegments(P, hrrr, { maxSegs: 2, minSegMin: 60 });
  assert.ok(seg.length >= 1 && Math.abs(seg[0].rosKmh - 6) < 1.5 && Math.abs(seg[0].u10Kmh - 36) < 0.5, JSON.stringify(seg));
  const w = FC.hrrrAt(hrrr, '2024-01-01T12:30:00Z'); assert.ok(Math.abs(w.fromDeg - 270) < 1e-6, 'u > 0 ⇒ viene del oeste');
});

test('aproximación: distancia mínima del fuego a un punto y primer instante dentro de un radio', () => {
  const target = [40, -105 + kmToLon(10)], s = FC.approachSeries(frames, target);
  assert.ok(s[0].distKm > 9 && Math.min(...s.map((x) => x.distKm)) < 1); assert.equal(FC.firstWithin(s, 4.5), frames.find((f, i) => i >= 1 && s[i].distKm <= 4.5)?.t ?? FC.firstWithin(s, 4.5));
  assert.equal(FC.firstWithin(s, 0.0001) === null || typeof FC.firstWithin(s, 0.0001) === 'string', true);
});

test('modelos ROS: la regla del 10 %, el ajuste potencial recupera una ley conocida y la validación deja fuera incendios enteros', () => {
  assert.equal(FC.tenPercentRule(40), 4);
  const pts = []; for (const c of ['a', 'b', 'c', 'd']) for (const u of [20, 35, 50]) pts.push({ caso: c, u10Kmh: u, rosKmh: 0.05 * u ** 1.2 * (c === 'b' ? 1.1 : 0.95), rh: 20, combustible: 'matorral/bosque' });
  const m = FC.ROS_MODELS.potencia(pts); assert.ok(Math.abs(m.beta[1] - 1.2) < 0.05);
  const L = FC.leaveOneFireOut(pts, { models: ['potencia'] }); assert.equal(L.casos, 4); assert.equal(L.n, 12);
  assert.ok(L.scores.potencia.maeLog < L.scores.regla10.maeLog, 'una ley que sí existe en los datos gana a la regla genérica');
});

test('calibración de la regla del 10 %: sesgo y dispersión; intervalos de Student más anchos con pocos incendios', () => {
  const pts = [1.2, 0.8, 1.5, 2.0].map((f, i) => ({ caso: `c${i}`, u10Kmh: 40, rosKmh: 4 * f }));
  const c = FC.calibrateRule(pts); assert.ok(c.mu > 0 && c.sigma > 0 && c.sigmaPred > c.sigma);
  const I = c.interval(40, 0.8); assert.ok(I.lo < I.mediana && I.mediana < I.hi && I.q > 1.2816);
  assert.ok(FC.tQuantile(3, 0.8) > FC.tQuantile(30, 0.8) && Math.abs(FC.tQuantile(100, 0.9) - 1.6449) < 1e-9);
  const B = FC.bayesRatio([]); assert.ok(Math.abs(B.otros.k - 0.1) < 1e-12, 'sin datos, se queda en la regla publicada');
});

const D = resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public/senda/data/referencias');
test('datos reales: GOES + HRRR coherentes con los hechos documentados', { skip: !existsSync(resolve(D, 'referencias.json')) }, () => {
  const r = JSON.parse(readFileSync(resolve(D, 'referencias.json'), 'utf8'));
  assert.ok(Object.keys(r.progresion).length >= 5);
  // Camp: el satélite mide ≈ 8 km/h en la carrera inicial; NIST documenta ≈ 7,5 km/h (7 millas en 90 min).
  assert.ok(Math.abs(r.entrenamiento.nistCamp.medidoGoes - 7.5) < 2.5);
  // Pentz Rd: el fuego llega a ≤ 2–3 km entre las 08:15 y las 08:45 locales; NIST: 08:30.
  const pz = r.aproximacion.pentz, loc = (t) => (Date.parse(t) - 8 * 3.6e6) % 864e5 / 6e4;
  assert.ok(loc(pz.a3km) > 8 * 60 && loc(pz.a2km) < 8 * 60 + 50);
  // Eaton: el fuego estaba a ≤ 3 km de Altadena oeste horas antes de la orden (después de las 03:00).
  assert.ok(r.eatonDisparo.adelantoHoras3km > 3);
  // Las cámaras reales de Londres aportan conteos (de noche, pocos).
  assert.ok(r.camaras.total.cruces > 0 && r.camaras.ruido.length >= 10);
  assert.ok(r.entrenamiento.puntos.length >= 4 && r.entrenamiento.regla10Calibrada.sigma > 0.3);
});

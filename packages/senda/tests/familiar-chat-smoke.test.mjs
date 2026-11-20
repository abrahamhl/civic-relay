import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/familiar-chat.mjs';
import * as S from '../src/smoke-exposure.mjs';
import { generateIdentity, sealMessage, packEnvelope } from '../src/envelope.mjs';
import { BEARERS } from '../src/bearers.mjs';

// Imagen sintética determinista: degradado + rectángulos de colores + zonas negra y blanca.
function synth(w, h) {
  const a = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; let r = (x * 255) / w, g = (y * 255) / h, b = 128;
    if (x > w * 0.6 && y < h * 0.4) [r, g, b] = [220, 40, 40];
    if (x < w * 0.3 && y > h * 0.6) [r, g, b] = [0, 0, 0];
    if (x > w * 0.7 && y > h * 0.7) [r, g, b] = [255, 255, 255];
    a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
  }
  return a;
}

test('miniatura: tamaño exacto, ida y vuelta y el gris neutro no se tiñe', () => {
  const w = 320, h = 180, img = synth(w, h);
  for (const st of [{ tw: 16, th: 9, yBits: 4, cBits: 3 }, { tw: 48, th: 27, yBits: 6, cBits: 4 }]) {
    const t = C.encodeThumb(img, w, h, st);
    assert.equal(t.length, C.thumbBytes(st.tw, st.th, st.yBits, st.cBits));
    const d = C.decodeThumb(t); assert.equal(d.w, st.tw); assert.equal(d.h, st.th);
  }
  const gray = new Uint8Array(64 * 64 * 4).fill(128);
  for (const cBits of [2, 3, 4]) {
    const d = C.decodeThumb(C.encodeThumb(gray, 64, 64, { tw: 8, th: 8, yBits: 5, cBits }));
    const [r, g, b] = d.rgba; assert.ok(Math.abs(r - b) <= 2 && Math.abs(r - g) <= 2, `gris teñido con ${cBits} bits: ${r},${g},${b}`);
  }
});

test('escalera de fotos: con más bytes nunca se ve peor (PSNR a referencia común) y siempre cabe', () => {
  const w = 320, h = 180, img = synth(w, h); let prev = -Infinity;
  for (const budget of [60, 100, 150, 200, 400, 900, 2000, 4000]) {
    const t = C.bestThumbForBudget(img, w, h, budget);
    assert.ok(t.bytes <= budget); assert.ok(t.psnrDb >= prev - 1e-9, `${budget} B: ${t.psnrDb} < ${prev}`); prev = t.psnrDb;
  }
  assert.equal(C.bestThumbForBudget(img, w, h, 10), null);
});

test('una foto cabe por LoRa: sobre E2E real + miniatura en dos tramas Meshtastic de 200 B', async () => {
  const a = await generateIdentity(), b = await generateIdentity(), now = Date.UTC(2026, 10, 20);
  async function env0(body) { return packEnvelope(await sealMessage({ sender: a, recipient: b.publicIdentity, body, priority: 5, ttlS: 3600, now })); }
  const overhead = (await env0(new Uint8Array(10))).length - 10;
  assert.ok(overhead > 250 && overhead < 400, `sobrecarga medida ${overhead} B`); // ≈ 314 B: se mide, no se supone
  // con dos tramas Meshtastic (2 × 200 B) caben sobre + miniatura de ~86 B
  const budget = 2 * BEARERS.MESHTASTIC.mtu - overhead;
  const f = C.formFor({ type: 'PHOTO', rgba: synth(320, 180), w: 320, h: 180, fullBytes: 180_000 }, budget);
  assert.match(f.form, /^THUMB_/); assert.ok(f.bytes <= budget); assert.equal(f.pending, true, 'la foto completa queda en cola para una vía mejor');
});

test('notas de voz: tasas publicadas y recorte honesto si no cabe', () => {
  assert.equal(C.voiceBytes(700, 10), 875);
  assert.deepEqual(C.voiceNotePlan(10, 30_000), { codec: 'OPUS_16K', bps: 16000, bytes: 20_000, seconds: 10, truncated: false });
  assert.equal(C.voiceNotePlan(10, 1500).codec, 'CODEC2_1200');
  const t = C.voiceNotePlan(10, 200); assert.equal(t.truncated, true); assert.equal(t.seconds, 2);
});

test('tics: solo avanzan y cada uno dice qué lo prueba', () => {
  assert.equal(C.advanceTick('DELIVERED', 'IN_CUSTODY'), 'DELIVERED');
  assert.equal(C.advanceTick('QUEUED', 'IN_CUSTODY'), 'IN_CUSTODY');
  for (const t of C.TICKS) assert.ok(t.proof.length > 10);
  assert.throws(() => C.advanceTick('X', 'READ'));
});

test('ubicación en 8 B con error < 1 cm; grupos: clave de remitente frente a sobre por miembro', () => {
  const l = C.unpackLocation(C.packLocation(40.3621234, -4.3987654));
  assert.ok(Math.abs(l.lat - 40.3621234) < 1e-7 && Math.abs(l.lon + 4.3987654) < 1e-7);
  const g = C.groupCost({ members: 8, bodyBytes: 60, envelopeOverhead: 314, messagesInSession: 10 });
  assert.equal(g.pairwise, 7 * 374 * 10); assert.equal(g.senderKey, 7 * 346 + 374 * 10); assert.equal(g.best, 'SENDER_KEY');
  assert.equal(C.groupCost({ members: 2, bodyBytes: 60, envelopeOverhead: 314, messagesInSession: 10 }).best, 'PAIRWISE');
  assert.throws(() => C.groupCost({ members: 3 }), /declararse/);
});

test('cola con prioridad: la mochila 0/1 coincide con la fuerza bruta', () => {
  let seed = 5; const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let t = 0; t < 100; t++) {
    const items = Array.from({ length: 2 + Math.floor(r() * 7) }, (_, i) => ({ id: `m${i}`, bytes: 1 + Math.floor(r() * 120), value: Math.round(r() * 100) }));
    const B = 20 + Math.floor(r() * 300), dp = C.scheduleWindow(items, B);
    let best = 0; for (let m = 0; m < 1 << items.length; m++) { let b = 0, v = 0; items.forEach((it, i) => { if (m & (1 << i)) { b += it.bytes; v += it.value; } }); if (b <= B) best = Math.max(best, v); }
    assert.equal(dp.value, best); assert.ok(dp.bytes <= B);
  }
});

test('humo: la masa se conserva (∬u·C = Q) en todas las clases y distancias', () => {
  for (const cls of S.STABILITY_CLASSES) for (const x of [300, 2000, 8000]) {
    const ratio = S.massFluxThroughPlane({ Q: 250, u: 3, H: 600, cls }, x) / 250;
    assert.ok(Math.abs(ratio - 1) < 2e-3, `${cls} ${x} m: ${ratio}`);
  }
});

test('humo: tabla de Pasquill–Turner, simetría, reflexión y estabilidad', () => {
  assert.equal(S.pasquillClass({ windMs: 1, day: true, insolation: 'STRONG' }), 'A');
  assert.equal(S.pasquillClass({ windMs: 4, day: true, insolation: 'SLIGHT' }), 'C');
  assert.equal(S.pasquillClass({ windMs: 7, day: true, insolation: 'MODERATE' }), 'D');
  assert.equal(S.pasquillClass({ windMs: 2.5, day: false, nightCloud: 'CLEAR' }), 'F');
  assert.equal(S.pasquillIsAssumed({ windMs: 1, day: false }), true);
  const p = { Q: 100, u: 4, H: 500, cls: 'C' };
  assert.equal(S.plumeConcentration(p, 3000, 200), S.plumeConcentration(p, 3000, -200));
  assert.equal(S.plumeConcentration(p, -100, 0), 0, 'a barlovento no llega humo');
  // C(x,0,0) con reflexión = 2× la de un penacho sin suelo evaluado en z = 0
  const { sy, sz } = S.sigmas('C', 3000), free = (p.Q / (2 * Math.PI * p.u * sy * sz)) * Math.exp(-(p.H ** 2) / (2 * sz * sz));
  assert.ok(Math.abs(S.plumeConcentration(p, 3000, 0) / free - 2) < 1e-12);
  // en atmósfera estable el máximo en el suelo cae más lejos que en inestable
  assert.ok(S.groundMaximum({ ...p, cls: 'E' }).xM > S.groundMaximum({ ...p, cls: 'A' }).xM);
  assert.throws(() => S.emissionGs({ fuelConsumedKgS: 10 }), /declararse/);
  assert.equal(S.WHO_2021_PM25_24H.ugm3, 15);
});

test('humo: exposición de pueblos según dirección del viento; área por encima del umbral', () => {
  const src = { lat: 40.36, lon: -4.39, windToDeg: 90, Q: 2000, u: 3, H: 300, cls: 'D' };
  const [este, oeste] = S.exposureAtPoints(src, [{ name: 'E', lat: 40.36, lon: -4.33 }, { name: 'O', lat: 40.36, lon: -4.45 }]);
  assert.ok(este.ugm3 > 0 && este.alongM > 0); assert.equal(oeste.ugm3, 0);
  const a = S.areaOverThresholdHa({ Q: 2000, u: 3, H: 300, cls: 'D' });
  assert.ok(a.ha > 0); assert.match(a.basis, /ESTACIONARIO/);
  assert.equal(S.fuelConsumptionFromFront({ byramKWm: 18000, heatContentKJkg: 18000, frontLengthM: 500 }), 500);
});

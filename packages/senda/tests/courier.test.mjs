import test from 'node:test';
import assert from 'node:assert/strict';
import { loraAirtimeMs, COURIER_LEGS, planCourier, simulateCourier, carry, createPairingKeys, derivePairing, sealCompact, openCompact, legCapacityPerDay } from '../src/courier.mjs';
import { generateIdentity, sealMessage, packEnvelope, unpackEnvelope, openMessage } from '../src/envelope.mjs';

test('LoRa: tiempo en el aire según Semtech AN1200.13 (51 B de carga LoRaWAN = 64 B PHY)', () => {
  assert.equal(+loraAirtimeMs(64, 7).toFixed(1), 118.0);
  assert.equal(+loraAirtimeMs(64, 9).toFixed(1), 390.1);
  assert.equal(+loraAirtimeMs(64, 12).toFixed(1), 2793.5);
  // uso justo de 30 s/día: 10 tramas a SF12, 76 a SF9
  assert.equal(legCapacityPerDay('LORAWAN_PUBLIC', 'ES', 'FIRST'), 10);
  assert.equal(legCapacityPerDay('LORAWAN_PUBLIC', 'NL', 'FIRST'), 76);
});

test('nunca se usa una vía prohibida ni una que obliga a enviar en claro', () => {
  const p = planCourier({ envelopeBytes: 80, from: { country: 'ES', has: ['FIND_MY_ABUSE', 'APRS', 'LORAWAN_PUBLIC'] }, to: { country: 'NL', has: ['FIND_MY_ABUSE'] } });
  for (const id of [...p.first, ...p.last]) assert.ok(!['FIND_MY_ABUSE', 'APRS'].includes(id));
  assert.deepEqual(p.rejected.map((r) => r.id).sort(), ['APRS', 'FIND_MY_ABUSE', 'FIND_MY_ABUSE']);
  assert.equal(COURIER_LEGS.FIND_MY_ABUSE.status, 'PROHIBITED');
});

test('mensaje compacto de pareja: 25 B de sobrecarga, solo la pareja lo abre, sin alteraciones ni repeticiones', async () => {
  const A = await createPairingKeys(), B = await createPairingKeys(), X = await createPairingKeys();
  const ab = await derivePairing(A, B.publicJwk), ba = await derivePairing(B, A.publicJwk), xb = await derivePairing(X, B.publicJwk);
  const text = 'Estoy bien, sin red. Llamo cuando vuelva.';
  const m = await sealCompact(ab, text);
  assert.equal(m.length, new TextEncoder().encode(text).length + 25);
  assert.deepEqual(await openCompact(ba, m), { ok: true, seq: 1, text });
  assert.equal((await openCompact(ba, m)).reason, 'REPLAY');
  const t = Uint8Array.from(await sealCompact(ab, 'segundo')); t[12] ^= 1;
  assert.equal((await openCompact(ba, t)).reason, 'BAD_TAG');
  assert.equal((await openCompact(xb, await sealCompact(ab, 'x'))).reason, 'NOT_FOR_THIS_PAIR');
  // la respuesta del hermano también funciona (cada sentido con su propio nonce)
  assert.equal((await openCompact(ab, await sealCompact(ba, 'Recibido'))).text, 'Recibido');
});

test('extremo a extremo: el sobre firmado viaja troceado por LoRaWAN, satélite y la cola, con pérdidas, y se abre intacto', async () => {
  const a = await generateIdentity(), b = await generateIdentity(), now = 1_800_000_000_000;
  const env = packEnvelope(await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'Estoy bien. Abraham', priority: 0, kind: 'PERSONAL', ttlS: 259200, now }));
  const p = planCourier({ envelopeBytes: env.length, from: { country: 'ES', has: ['LORAWAN_PUBLIC', 'SAT_MESSENGER'] }, to: { country: 'NL', has: ['LORAWAN_PUBLIC'] } });
  assert.ok(p.shardBytes <= 51);
  const vias = ['LORAWAN_PUBLIC', 'SAT_MESSENGER', null, 'QUEUE_CELL'];
  const c = carry(env, p, (i) => vias[i % 4]);
  assert.deepEqual([...c.envelope], [...env], 'el sobre rehecho es idéntico byte a byte');
  assert.ok(c.log.some((l) => l.via === 'perdido'));
  const o = await openMessage({ recipient: b, envelope: unpackEnvelope(c.envelope), now, expectedSender: a });
  assert.equal(o.body, 'Estoy bien. Abraham');
});

test('simulación ES→NL (hipótesis declaradas, semilla fija): cada vía mejora frente a esperar a que vuelva la red', async () => {
  const A = await createPairingKeys(), B = await createPairingKeys(), pair = await derivePairing(A, B.publicJwk);
  const bytes = (await sealCompact(pair, 'Estoy bien, sin red. Llamo cuando vuelva. Abraham')).length;
  const run = (f, t) => simulateCourier(planCourier({ envelopeBytes: bytes, from: { country: 'ES', has: f }, to: { country: 'NL', has: t } }), { seed: 3 });
  const phone = run([], []), lora = run(['LORAWAN_PUBLIC'], ['LORAWAN_PUBLIC']), sat = run(['SAT_MESSENGER'], ['SAT_MESSENGER']);
  assert.equal(phone.medianH.senda, phone.medianH.waitForNetwork, 'solo con el móvil no hay magia: se espera a la red');
  assert.ok(lora.medianH.senda < lora.medianH.waitForNetwork / 2, `LoRaWAN ${lora.medianH.senda} h frente a ${lora.medianH.waitForNetwork} h`);
  assert.ok(sat.byHour[1].senda > 0.9 && sat.byHour[1].waitForNetwork < 0.01, 'satélite en ambos lados: llega en la primera hora');
  assert.deepEqual(run(['LORAWAN_PUBLIC'], ['LORAWAN_PUBLIC']), lora, 'reproducible');
});

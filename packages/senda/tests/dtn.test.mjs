import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity, sealMessage, openMessage } from '../src/envelope.mjs';
import { createBundleStore, syncPair, exportBundleFile, importBundleFile } from '../src/bundle.mjs';

const T0 = Date.UTC(2026, 10, 4, 10);

async function people(n) { return Promise.all(Array.from({ length: n }, () => generateIdentity())); }

test('archivo .senda: A → (mula) → B, sin red; B lo abre y el recibo purga la copia de la mula', async () => {
  const [a, mule, b] = await people(3);
  const sa = createBundleStore({ owner: a.publicIdentity.fingerprint });
  const sm = createBundleStore({ owner: mule.publicIdentity.fingerprint });
  const sb = createBundleStore({ owner: b.publicIdentity.fingerprint });
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'Estamos en el polideportivo', priority: 0, ttlS: 86400, now: T0 });
  sa.put(env, { now: T0 });
  await importBundleFile(sm, exportBundleFile(sa, { now: T0, peerSummary: sm.summary() }), { now: T0 + 1 });
  assert.equal(sm.has(env.header.id), true, 'la mula transporta el sobre cifrado');
  const got = await importBundleFile(sb, exportBundleFile(sm, { now: T0 + 2, peerSummary: sb.summary() }), { now: T0 + 2 });
  assert.equal(got.forMe.length, 1);
  const opened = await openMessage({ recipient: b, envelope: got.forMe[0], now: T0 + 3 });
  assert.equal(opened.body, 'Estamos en el polideportivo');
  // B difunde el recibo; la mula lo verifica y borra su copia
  await sb.acceptReceipt(opened.receipt);
  await syncPair(sb, sm, { now: T0 + 4 });
  assert.equal(sm.has(env.header.id), false);
});

test('un recibo falso no borra nada', async () => {
  const [a, b, m] = await people(3);
  const sm = createBundleStore({ owner: m.publicIdentity.fingerprint });
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 3600, now: T0 });
  sm.put(env, { now: T0 });
  assert.equal(await sm.acceptReceipt({ id: env.header.id, ackSecret: 'AAAAAAAAAAAAAAAAAAAAAA' }), false);
  assert.equal(sm.has(env.header.id), true);
});

test('spray-and-wait: las copias se reparten y con 1 copia solo se entrega al destinatario', async () => {
  const [a, b, c, d] = await people(4);
  const s = (p) => createBundleStore({ owner: p.publicIdentity.fingerprint, initialCopies: 4 });
  const sa = s(a), sc = s(c), sd = s(d);
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 3600, now: T0 });
  sa.put(env, { now: T0 });
  await syncPair(sa, sc, { now: T0 });
  assert.equal(sa.copiesOf(env.header.id), 2); assert.equal(sc.copiesOf(env.header.id), 2);
  await syncPair(sc, sd, { now: T0 });
  assert.equal(sd.copiesOf(env.header.id), 1);
  const se = s(await generateIdentity());
  await syncPair(sd, se, { now: T0 });
  assert.equal(se.has(env.header.id), false, 'con 1 copia no se reparte a terceros');
});

test('cuota llena: se descarta lo menos urgente, nunca lo dirigido a mí ni un SOS por una rutina', async () => {
  const [a, b, me] = await people(3);
  const routine = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'r'.repeat(600), priority: 4, ttlS: 3600, now: T0 });
  const st = createBundleStore({ owner: me.publicIdentity.fingerprint, quotaBytes: Math.round(JSON.stringify(routine).length * 1.5) });
  st.put(routine, { now: T0 });
  const sos = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 's'.repeat(600), priority: 0, ttlS: 3600, now: T0 });
  assert.equal(st.put(sos, { now: T0 }).stored, true);
  assert.equal(st.has(sos.header.id), true);
  assert.equal(st.has(routine.header.id), false);
});

test('caducados no se transportan; prioridad SOS sale primero con presupuesto escaso', async () => {
  const [a, b, c] = await people(3);
  const sa = createBundleStore({ owner: a.publicIdentity.fingerprint });
  const old = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'viejo', priority: 3, ttlS: 10, now: T0 });
  const sos = await sealMessage({ sender: a, recipient: c.publicIdentity, body: 'SOS', priority: 0, ttlS: 3600, now: T0 });
  const fam = await sealMessage({ sender: a, recipient: c.publicIdentity, body: 'familia', priority: 3, ttlS: 3600, now: T0 });
  [old, fam, sos].forEach((e) => sa.put(e, { now: T0 }));
  const out = sa.prepareFor({ owner: c.publicIdentity.fingerprint, ids: [], receipts: [] }, { now: T0 + 60_000, maxBytes: 2500 });
  assert.equal(out.envelopes[0].env.header.priority, 0);
  assert.ok(!out.envelopes.some((e) => e.env.header.id === old.header.id));
});

test('ciudad sin red: 40 teléfonos que se mueven entregan el mensaje solo por encuentros', async () => {
  const N = 40, ids = await people(N);
  const stores = ids.map((p) => createBundleStore({ owner: p.publicIdentity.fingerprint, initialCopies: 12 }));
  let s = 42; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pos = ids.map(() => ({ x: r() * 1500, y: r() * 1500 }));
  pos[0] = { x: 50, y: 50 }; pos[1] = { x: 1450, y: 1450 }; // emisor y destinatario en extremos opuestos
  const env = await sealMessage({ sender: ids[0], recipient: ids[1].publicIdentity, body: 'Estoy bien', priority: 3, ttlS: 86400, now: T0 });
  stores[0].put(env, { now: T0 });
  let deliveredAt = null, encounters = 0;
  for (let step = 1; step <= 600 && deliveredAt === null; step++) {
    for (const p of pos) { p.x = Math.min(1500, Math.max(0, p.x + (r() - 0.5) * 120)); p.y = Math.min(1500, Math.max(0, p.y + (r() - 0.5) * 120)); }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      if (Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y) > 60) continue;
      encounters++;
      const res = await syncPair(stores[i], stores[j], { now: T0 + step * 60_000 });
      if ([...res.aReceived, ...res.bReceived].some((e) => e.header.id === env.header.id)) deliveredAt = step;
    }
  }
  assert.ok(deliveredAt !== null, 'debe entregarse por encuentros sucesivos');
  const carriers = stores.filter((st) => st.has(env.header.id)).length;
  assert.ok(carriers <= 12, `spray-and-wait limita copias (${carriers})`);
});

test('persistencia: la instantánea sobrevive a un reinicio del teléfono', async () => {
  const [a, b, m] = await people(3);
  const st = createBundleStore({ owner: m.publicIdentity.fingerprint });
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 1, ttlS: 3600, now: T0 });
  st.put(env, { now: T0, copies: 5 });
  const back = createBundleStore({ owner: m.publicIdentity.fingerprint }).restore(JSON.parse(JSON.stringify(st.snapshot())), { now: T0 + 1 });
  assert.equal(back.has(env.header.id), true);
  assert.equal(back.copiesOf(env.header.id), 5);
  assert.equal(back.list()[0].priority, 1);
});

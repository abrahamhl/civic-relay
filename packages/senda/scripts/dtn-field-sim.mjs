#!/usr/bin/env node
/**
 * Simulación reproducible del ciclo DTN A → (mula) → C sin red:
 *   - fragmentación k=3/n=5, pérdida de 2 fragmentos;
 *   - recibo falsificado inyectado antes del sobre;
 *   - reinicio de la mula (snapshot/restore);
 *   - recibo auténtico, replay y purga;
 *   - sobre manipulado y sobre malformado.
 *
 * No es una prueba física: no hay radio, Android ni consumo eléctrico medido.
 * Genera evidencia JSON con estado SIMULATED_VALIDATED y PHYSICAL_TEST_PENDING.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateIdentity, sealMessage, openMessage, packEnvelope, unpackEnvelope } from '../src/envelope.mjs';
import { b64, unb64 } from '../src/b64.mjs';
import { encodeShards, packShard, createReassembler } from '../src/erasure.mjs';
import { createBundleStore, syncPair } from '../src/bundle.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const T0 = Date.UTC(2026, 10, 7, 9);
const args = process.argv.slice(2);
const trialCount = Number(args.find((a) => a.startsWith('--trials='))?.split('=')[1] ?? 30);
const seed = Number(args.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 357397);
const outPath = resolve(repo, args.find((a) => a.startsWith('--out='))?.split('=')[1] ?? 'evidence/senda/dtn-field-sim-2026-11-07.json');

const rnd = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const percentile = (values, q) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1));
  return s[i];
};
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const fakeSecret = (n) => b64(new Uint8Array(16).fill(n));

function git(args) {
  try { return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

function shuffledShardIndexes(r) {
  const idx = [0, 1, 2, 3, 4];
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

async function oneTrial(trial, a, b, c) {
  const r = rnd(seed + trial * 7919);
  const createdAt = T0 + trial * 600_000;
  const t1 = createdAt + 300 + Math.floor(r() * 60);
  const t2 = createdAt + 1200 + Math.floor(r() * 120);
  const t3 = t2 + 60;

  const env = await sealMessage({ sender: a, recipient: c.publicIdentity, body: `SOS simulado ${trial}: 3 personas, coordenadas ficticias`, priority: 0, ttlS: 86400, now: createdAt, kind: 'SOS' });
  const packed = packEnvelope(env);
  const enc = encodeShards(packed, 3, 5);
  const shardId = unb64(env.header.id).subarray(0, 8);
  const frames = enc.shards.map((data, index) => packShard({ id: shardId, k: 3, n: 5, len: packed.length, index, data }));
  const order = shuffledShardIndexes(r);
  const lost = order.slice(0, 2), carried = order.slice(2);
  const bearers = ['BLE', 'LoRa', 'SMS', 'SAT_D2D_SMS', 'ACOUSTIC'];
  const reassembler = createReassembler();
  let rebuilt = null;
  for (const index of carried) rebuilt = reassembler.add(frames[index], bearers[index]) ?? rebuilt;
  if (!rebuilt) throw new Error(`trial ${trial}: no se reconstruyó con 3/5 fragmentos`);
  const reconstructed = unpackEnvelope(rebuilt.data);

  const sb = createBundleStore({ owner: b.publicIdentity.fingerprint, initialCopies: 4 });
  const forgedPendingAtRelay = await sb.acceptReceiptDetailed({ id: env.header.id, ackSecret: fakeSecret(trial + 11) }, { now: t1 - 1 });
  const relayIngest = await sb.ingest({ envelopes: [{ env: reconstructed, copies: 4, hops: 1 }] }, { now: t1 });
  const forgedAtRelay = await sb.acceptReceiptDetailed({ id: env.header.id, ackSecret: fakeSecret(trial + 11) }, { now: t1 + 1 });
  const copiesBeforeRestart = sb.copiesOf(env.header.id);
  const b2 = createBundleStore({ owner: b.publicIdentity.fingerprint }).restore(JSON.parse(JSON.stringify(sb.snapshot())), { now: t1 + 60 });
  const restartPreserved = b2.has(env.header.id) && b2.copiesOf(env.header.id) === copiesBeforeRestart;

  const sc = createBundleStore({ owner: c.publicIdentity.fingerprint });
  const forgedPendingAtDestination = await sc.acceptReceiptDetailed({ id: env.header.id, ackSecret: fakeSecret(trial + 23) }, { now: t1 + 120 });
  const delivered = await syncPair(b2, sc, { now: t2 });
  const first = delivered.bReceived[0];
  const opened = first ? await openMessage({ recipient: c, envelope: first, now: t2 + 1 }) : null;
  const genuinePending = opened ? await sc.acceptReceiptDetailed(opened.receipt, { now: t2 + 2 }) : { state: 'MISSING' };

  const replay = await sc.ingest({ envelopes: [{ env, copies: 2, hops: 1 }] }, { now: t2 + 3 });
  const replaySuppressed = replay.forMe.length === 0 && sc.summary().receipts.includes(env.header.id);
  await syncPair(sc, b2, { now: t3 });
  const receiptPurged = !b2.has(env.header.id) && b2.summary().receipts.includes(env.header.id) && sc.summary().receipts.includes(env.header.id);

  const tampered = structuredClone(env); tampered.header.priority = 1;
  let tamperRejected = false;
  try { await openMessage({ recipient: c, envelope: tampered, now: t3 + 1 }); } catch { tamperRejected = true; }
  const malformed = await sc.ingest({ envelopes: [{ env: { header: { id: 'x' } } }] }, { now: t3 + 2 });

  return {
    trial,
    seed: seed + trial * 7919,
    delivered: Boolean(opened && opened.body.includes(`SOS simulado ${trial}`)),
    latencyS: t2 - createdAt,
    packedBytes: packed.length,
    shardBytesOnAir: carried.reduce((n, i) => n + frames[i].length, 0),
    lostShards: lost,
    reconstructed: Boolean(reconstructed?.header?.id === env.header.id),
    forgedReceiptBlocked: forgedPendingAtRelay.state === 'PENDING' && forgedPendingAtDestination.state === 'PENDING' && forgedAtRelay.state === 'HASH_MISMATCH' && Boolean(first),
    relayIngestStored: relayIngest.stored.includes(env.header.id),
    restartPreserved,
    genuineReceiptQuarantined: genuinePending.state === 'PENDING',
    replaySuppressed,
    receiptPurged,
    tamperRejected,
    malformedRejected: malformed.rejected === 1,
  };
}

const [a, b, c] = await Promise.all([generateIdentity(), generateIdentity(), generateIdentity()]);
const rows = [];
for (let i = 0; i < trialCount; i++) rows.push(await oneTrial(i, a, b, c));

const yes = (k) => rows.filter((r) => r[k]).length;
const latency = rows.map((r) => r.latencyS), sizes = rows.map((r) => r.packedBytes);
const results = {
  trials: trialCount,
  delivered: yes('delivered'),
  deliveryRate: yes('delivered') / trialCount,
  forgedReceiptBlocked: yes('forgedReceiptBlocked'),
  forgedReceiptBlockedRate: yes('forgedReceiptBlocked') / trialCount,
  fragmentReconstructionRate: yes('reconstructed') / trialCount,
  restartPreservationRate: yes('restartPreserved') / trialCount,
  replaySuppressionRate: yes('replaySuppressed') / trialCount,
  receiptPurgeRate: yes('receiptPurged') / trialCount,
  tamperRejectionRate: yes('tamperRejected') / trialCount,
  malformedRejectionRate: yes('malformedRejected') / trialCount,
  latencyS: { p50: percentile(latency, 0.5), p95: percentile(latency, 0.95), min: Math.min(...latency), max: Math.max(...latency), mean: mean(latency) },
  packedBytes: { p50: percentile(sizes, 0.5), p95: percentile(sizes, 0.95), min: Math.min(...sizes), max: Math.max(...sizes), mean: mean(sizes) },
  energy: { measured: false, status: 'ENERGY_NOT_MEASURED', reason: 'No hay hardware ni medidor; el script solo cuenta bytes simulados.' },
};

const allGreen = results.deliveryRate === 1 && results.forgedReceiptBlockedRate === 1 && results.fragmentReconstructionRate === 1
  && results.restartPreservationRate === 1 && results.replaySuppressionRate === 1 && results.receiptPurgeRate === 1
  && results.tamperRejectionRate === 1 && results.malformedRejectionRate === 1;

const evidence = {
  schema: 'senda-dtn-field-sim/1',
  status: allGreen ? 'SIMULATED_VALIDATED' : 'SIMULATED_PARTIAL',
  physicalValidation: 'PHYSICAL_TEST_PENDING',
  generatedAt: new Date().toISOString(),
  source: {
    script: 'packages/senda/scripts/dtn-field-sim.mjs',
    commitAtGeneration: git(['rev-parse', 'HEAD']),
    worktreeDirty: Boolean(git(['status', '--porcelain'])),
    note: 'La evidencia se genera antes de su propio commit; el SHA del commit de evidencia figura en el PR.',
  },
  scenario: {
    topology: 'A(fuente) -> B(mula) -> C(destino)',
    transport: 'SIMULATED_ONLY',
    fragmentation: { k: 3, n: 5, lostPerTrial: 2, bearers: ['BLE', 'LoRa', 'SMS', 'SAT_D2D_SMS', 'ACOUSTIC'] },
    messageKind: 'SOS',
    ttlS: 86400,
    trials: trialCount,
    seed,
  },
  results,
  acceptance: {
    status: allGreen ? 'SIMULATED_VALIDATED' : 'SIMULATED_PARTIAL',
    criteria: {
      deliveryRate: 1,
      forgedReceiptBlockedRate: 1,
      fragmentReconstructionRate: 1,
      restartPreservationRate: 1,
      replaySuppressionRate: 1,
      receiptPurgeRate: 1,
      tamperRejectionRate: 1,
      malformedRejectionRate: 1,
    },
  },
  perTrial: rows,
  limitations: [
    'No hay radio BLE/Wi-Fi Direct/Nearby/LoRa: los fragmentos se pasan en memoria.',
    'No hay teléfonos Android ni APK compilada; PHYSICAL_TEST_PENDING.',
    'Batería y energía no medidas; solo se cuentan bytes.',
    'Identidades A/B/C reutilizadas entre ensayos; los ids y sobres son únicos por ensayo.',
    'La mula no verifica la firma del emisor porque la clave pública viaja dentro del cifrado; el destinatario sí la verifica al abrir.',
    'Este resultado no certifica el sistema ni demuestra validez en campo.',
  ],
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ out: outPath, status: evidence.status, results }, null, 2));

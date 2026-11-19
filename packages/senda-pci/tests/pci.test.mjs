import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize } from '../src/canonical.mjs';
import { generateCustodian } from '../src/crypto.mjs';
import {
  createLedger,
  describeEvidence,
  exportLedger,
  importLedger,
  ledgerDigest,
  receiveCustody,
  sealLedger,
  transferCustody,
  verifyEvidence,
  verifyLedger,
  verifyReceipt,
} from '../src/ledger.mjs';
import { PciError } from '../src/errors.mjs';

const T0 = Date.UTC(2026, 10, 8, 12, 0, 0);
const NOW = T0 + 3_600_000;
const iso = (ms) => new Date(ms).toISOString();
const body = new TextEncoder().encode('{"mission":"senda","evidence":true}\n');

async function fixture() {
  const collector = await generateCustodian({ name: 'Ana', org: 'SENDA' });
  const courier = await generateCustodian({ name: 'Bruno', org: 'Protección Civil' });
  const lab = await generateCustodian({ name: 'Carla', org: 'Laboratorio' });
  const evidence = describeEvidence(body, { name: 'mission.json', mediaType: 'application/json' });
  let ledger = await createLedger({
    evidence,
    collector,
    custodians: [courier.custodian, lab.custodian],
    at: iso(T0),
    notes: 'registro inicial',
    now: NOW,
  });
  ledger = await transferCustody({ ledger, from: collector, to: courier.custodian, at: iso(T0 + 1000), now: NOW });
  ledger = await receiveCustody({ ledger, actor: courier, at: iso(T0 + 2000), now: NOW });
  ledger = await verifyEvidence({ ledger, actor: courier, evidenceBytes: body, at: iso(T0 + 3000), now: NOW });
  ledger = await transferCustody({ ledger, from: courier, to: lab.custodian, at: iso(T0 + 4000), now: NOW });
  ledger = await receiveCustody({ ledger, actor: lab, at: iso(T0 + 5000), now: NOW });
  ledger = await sealLedger({ ledger, actor: lab, at: iso(T0 + 6000), now: NOW });
  return { ledger, collector, courier, lab, evidence };
}

function trusted(...custodians) {
  return custodians.map((item) => item.custodian ?? item);
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof PciError, `se esperaba PciError, llegó ${error?.name}`);
    assert.equal(error.code, code, error.stack);
    return true;
  });
}

test('cadena completa: registro, transferencia, recibo, verificación, segundo custodio y sello', async () => {
  const { ledger, collector, courier, lab, evidence } = await fixture();
  const result = await verifyLedger({
    ledger,
    trustedKeys: trusted(collector, courier, lab),
    evidenceBytes: body,
    now: NOW + 1000,
    requireSealed: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.trust, 'ANCHORED');
  assert.equal(result.records, 7);
  assert.equal(result.sealed, true);
  assert.equal(result.sealedAt, iso(T0 + 6000));
  assert.deepEqual(result.finalCustodian, { kid: lab.custodian.kid, name: 'Carla', org: 'Laboratorio' });
  assert.deepEqual(result.evidence, evidence);
  assert.equal(result.lastHash, ledger.records.at(-1).hash);
});

test('el recibo de transferencia se puede verificar por separado', async () => {
  const { ledger, collector, courier, lab } = await fixture();
  const transfer = ledger.records.find((record) => record.action === 'TRANSFERRED');
  const receipt = await verifyReceipt({
    ledger,
    trustedKeys: trusted(collector, courier, lab),
    transferHash: transfer.hash,
    now: NOW + 1000,
  });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.transfer.hash, transfer.hash);
  assert.equal(receipt.receipt.action, 'RECEIVED');
});

test('alterar cualquier campo sin recomputar el hash falla de forma cerrada', async () => {
  const { ledger, collector, courier, lab } = await fixture();
  const tampered = structuredClone(ledger);
  tampered.records[2].notes = 'nota cambiada';
  await rejectsCode(verifyLedger({ ledger: tampered, trustedKeys: trusted(collector, courier, lab), now: NOW + 1000 }), 'HASH_MISMATCH');
});

test('alterar la firma sin tocar el hash falla por firma inválida', async () => {
  const { ledger, collector, courier, lab } = await fixture();
  const tampered = structuredClone(ledger);
  const sig = tampered.records[2].sig;
  tampered.records[2].sig = `${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`;
  await rejectsCode(verifyLedger({ ledger: tampered, trustedKeys: trusted(collector, courier, lab), now: NOW + 1000 }), 'BAD_SIGNATURE');
});

test('quitar, reordenar o duplicar registros rompe la cadena', async () => {
  const { ledger, collector, courier, lab } = await fixture();
  const missing = structuredClone(ledger);
  missing.records.splice(2, 1);
  await rejectsCode(verifyLedger({ ledger: missing, trustedKeys: trusted(collector, courier, lab), now: NOW + 1000 }), 'BAD_SEQUENCE');
  const reordered = structuredClone(ledger);
  [reordered.records[1], reordered.records[2]] = [reordered.records[2], reordered.records[1]];
  await rejectsCode(verifyLedger({ ledger: reordered, trustedKeys: trusted(collector, courier, lab), now: NOW + 1000 }), 'BAD_SEQUENCE');
  const duplicated = structuredClone(ledger);
  duplicated.records.push(structuredClone(duplicated.records[0]));
  await rejectsCode(verifyLedger({ ledger: duplicated, trustedKeys: trusted(collector, courier, lab), now: NOW + 1000 }), 'BAD_SEQUENCE');
});

test('los bytes de evidencia alterados no pasan la verificación', async () => {
  const { ledger, collector, courier, lab } = await fixture();
  const altered = new TextEncoder().encode('{"mission":"senda","evidence":false}\n');
  await rejectsCode(verifyLedger({ ledger, trustedKeys: trusted(collector, courier, lab), evidenceBytes: altered, now: NOW + 1000 }), 'EVIDENCE_HASH_MISMATCH');
});

test('una transferencia sin recibo queda bloqueada', async () => {
  const { ledger, collector, courier } = await fixture();
  const pending = structuredClone(ledger);
  pending.records = pending.records.slice(0, 2);
  await rejectsCode(verifyLedger({ ledger: pending, trustedKeys: trusted(collector, courier), now: NOW + 1000 }), 'PENDING_TRANSFER');
});

test('solo el custodio actual puede transferir y el destinatario debe estar registrado', async () => {
  const { ledger, collector, courier, lab } = await fixture();
  const fresh = structuredClone(ledger);
  fresh.records = fresh.records.slice(0, 1);
  await rejectsCode(
    transferCustody({ ledger: fresh, from: lab, to: collector.custodian, at: iso(T0 + 1000), now: NOW }),
    'NOT_CUSTODIAN',
  );
  const outsider = await generateCustodian({ name: 'Eva', org: 'Ajena' });
  await rejectsCode(
    transferCustody({ ledger: fresh, from: collector, to: outsider.custodian, at: iso(T0 + 1000), now: NOW }),
    'UNKNOWN_ACTOR',
  );
});

test('un registro no puede retroceder en el tiempo ni estar en el futuro', async () => {
  const { ledger, collector } = await fixture();
  const fresh = structuredClone(ledger);
  fresh.records = fresh.records.slice(0, 1);
  await rejectsCode(
    transferCustody({ ledger: fresh, from: collector, to: collector.custodian, at: iso(T0 - 1), now: NOW }),
    'TIME_REGRESSION',
  );
  await rejectsCode(
    transferCustody({ ledger: fresh, from: collector, to: collector.custodian, at: iso(NOW + 3_600_000), now: NOW }),
    'FUTURE_RECORD',
  );
});

test('verifyLedger exige anclas de confianza externas y rechaza custodios no anclados', async () => {
  const { ledger, collector, courier, lab } = await fixture();
  await rejectsCode(verifyLedger({ ledger, now: NOW + 1000 }), 'MISSING_TRUST_ANCHOR');
  const outsider = await generateCustodian({ name: 'Eva', org: 'Ajena' });
  await rejectsCode(
    verifyLedger({ ledger, trustedKeys: trusted(collector, courier, outsider), now: NOW + 1000 }),
    'UNTRUSTED_CUSTODIAN',
  );
  await rejectsCode(
    verifyLedger({ ledger, trustedKeys: trusted(collector, courier), now: NOW + 1000 }),
    'UNTRUSTED_ACTOR',
  );
  const rawJwks = Object.fromEntries(trusted(collector, courier, lab).map((c) => [c.kid, c.publicKey]));
  const anchored = await verifyLedger({ ledger, trustedKeys: rawJwks, now: NOW + 1000 });
  assert.equal(anchored.ok, true);
  assert.ok(lab.custodian.kid);
});

test('campos desconocidos, acciones inválidas y ledger sellado fallan', async () => {
  const { ledger, collector } = await fixture();
  const extra = structuredClone(ledger);
  extra.extra = true;
  await rejectsCode(verifyLedger({ ledger: extra, trustedKeys: trusted(collector), now: NOW + 1000 }), 'UNEXPECTED_FIELD');
  const sealed = structuredClone(ledger);
  const last = sealed.records.at(-1);
  assert.equal(last.action, 'SEALED');
  await rejectsCode(
    transferCustody({ ledger: sealed, from: collector, to: collector.custodian, at: iso(T0 + 7000), now: NOW }),
    'LEDGER_SEALED',
  );
});

test('exportar e importar conserva el hash canónico y permite verificar', async () => {
  const { ledger, collector, courier, lab } = await fixture();
  const text = exportLedger(ledger);
  const imported = importLedger(text);
  assert.equal(exportLedger(imported), text);
  assert.equal(ledgerDigest(imported), ledgerDigest(ledger));
  const result = await verifyLedger({ ledger: imported, trustedKeys: trusted(collector, courier, lab), evidenceBytes: body, now: NOW + 1000 });
  assert.equal(result.ok, true);
});

test('canonicalización determinista y rechazo de tipos ambiguos', () => {
  assert.equal(canonicalize({ b: 2, a: 1 }), canonicalize({ a: 1, b: 2 }));
  assert.throws(() => canonicalize([undefined]), /CANONICAL_TYPE/);
  assert.throws(() => canonicalize({ a: undefined }), /CANONICAL_TYPE/);
  assert.throws(() => canonicalize({ a: Number.NaN }), /CANONICAL_NUMBER/);
  assert.throws(() => canonicalize({ a: 1n }), /CANONICAL_TYPE/);
  assert.throws(() => canonicalize(new Date()), /CANONICAL_PROTOTYPE/);
});

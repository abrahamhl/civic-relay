import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize } from '../src/canonical.mjs';
import { generateCustodian, keyId, unb64url } from '../src/crypto.mjs';
import {
  createLedger,
  describeEvidence,
  exportLedger,
  importLedger,
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
  const evidence = describeEvidence(body, { name: 'mission.json', mediaType: 'application/json' });
  let ledger = await createLedger({
    evidence,
    collector,
    custodians: [courier.custodian],
    at: iso(T0),
    now: NOW,
  });
  ledger = await transferCustody({ ledger, from: collector, to: courier.custodian, at: iso(T0 + 1000), now: NOW });
  ledger = await receiveCustody({ ledger, actor: courier, at: iso(T0 + 2000), now: NOW });
  ledger = await verifyEvidence({ ledger, actor: courier, evidenceBytes: body, at: iso(T0 + 3000), now: NOW });
  ledger = await sealLedger({ ledger, actor: courier, at: iso(T0 + 4000), now: NOW });
  return { ledger, collector, courier, evidence };
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

test('canonicalización: rechaza valores ambiguos, ciclos, prototipos y profundidad excesiva', () => {
  assert.throws(() => canonicalize([, 1]), /CANONICAL_ARRAY_HOLE/);
  assert.throws(() => canonicalize({ a: undefined }), /CANONICAL_TYPE/);
  assert.throws(() => canonicalize({ a: Number.NEGATIVE_INFINITY }), /CANONICAL_NUMBER/);
  assert.throws(() => canonicalize({ a: 1n }), /CANONICAL_TYPE/);
  assert.throws(() => canonicalize(new Map()), /CANONICAL_PROTOTYPE/);
  assert.throws(() => canonicalize({ a: '\ud800' }), /CANONICAL_STRING/);
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => canonicalize(cycle), /CANONICAL_CYCLE/);
  let deep = {};
  for (let i = 0; i < 257; i++) deep = { next: deep };
  assert.throws(() => canonicalize(deep), /CANONICAL_DEPTH/);
  assert.equal(canonicalize({ n: -0 }), canonicalize({ n: 0 }));
});

test('base64url: rechaza alfabeto y longitudes no canónicas', () => {
  assert.throws(() => unb64url('abc='), /BAD_BASE64URL/);
  assert.throws(() => unb64url('a'), /BAD_BASE64URL/);
  assert.throws(() => unb64url('YQ', 32), /BAD_LENGTH/);
  assert.throws(() => unb64url(42), /BAD_BASE64URL/);
  assert.throws(() => keyId({ kty: 'EC', crv: 'P-256', x: 'AAAA', y: 'AAAA' }), /BAD_LENGTH|BAD_BASE64URL/);
});

test('custodio: un kid no puede apuntar a otra clave pública', async () => {
  const attacker = await generateCustodian({ name: 'Eva', org: 'Ajena' });
  assert.equal(typeof attacker.custodian.kid, 'string');
  const { ledger, collector } = await fixture();
  const tampered = structuredClone(ledger);
  tampered.custodians[0].publicKey = attacker.custodian.publicKey;
  await rejectsCode(verifyLedger({ ledger: tampered, trustedKeys: trusted(collector), now: NOW }), 'KID_MISMATCH');
});

test('ledger: una firma válida de otra clave no autentica al custodio registrado', async () => {
  const { ledger, collector, courier } = await fixture();
  const attacker = await generateCustodian({ name: 'Eva', org: 'Ajena' });
  const forged = structuredClone(ledger);
  const index = forged.records.findIndex((record) => record.actor.kid === courier.custodian.kid);
  assert.ok(index > 0);
  forged.records[index].actor = { kid: attacker.custodian.kid, name: 'Eva', org: 'Ajena' };
  await rejectsCode(verifyLedger({ ledger: forged, trustedKeys: trusted(collector, courier), now: NOW }), 'UNKNOWN_ACTOR');
});

test('ledger: alterar la evidencia o pedir un recibo inexistente falla', async () => {
  const { ledger, collector, courier } = await fixture();
  await rejectsCode(verifyLedger({
    ledger,
    trustedKeys: trusted(collector, courier),
    evidenceBytes: new TextEncoder().encode('{"mission":"senda","evidence":false}\n'),
    now: NOW,
  }), 'EVIDENCE_HASH_MISMATCH');
  await rejectsCode(verifyReceipt({
    ledger,
    trustedKeys: trusted(collector, courier),
    transferHash: '0'.repeat(64),
    now: NOW,
  }), 'RECEIPT_NOT_FOUND');
});

test('importación: no acepta campos extra ni JSON inválido', async () => {
  const { ledger } = await fixture();
  assert.throws(() => importLedger(exportLedger(ledger).replace('{', '{"extra":1,')), /UNEXPECTED_FIELD/);
  assert.throws(() => importLedger('{'), /BAD_JSON/);
  assert.throws(() => importLedger(JSON.stringify({ ...ledger, extra: true })), /UNEXPECTED_FIELD/);
});

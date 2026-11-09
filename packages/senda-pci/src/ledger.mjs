import { readFile } from 'node:fs/promises';
import { canonicalBytes, canonicalize } from './canonical.mjs';
import {
  assertKeyPair,
  bytesOf,
  keyId,
  publicJwk,
  sha256Hex,
  signCanonical,
  verifyCanonical,
} from './crypto.mjs';
import { fail, PciError } from './errors.mjs';

export const PROTOCOL = 'senda.pci/1';
export const ZERO_HASH = '0'.repeat(64);
export const ACTIONS = Object.freeze(['REGISTERED', 'TRANSFERRED', 'RECEIVED', 'VERIFIED', 'ACCESSED', 'SEALED']);

const TOP_FIELDS = ['v', 'protocol', 'evidence', 'custodians', 'records'];
const RECORD_FIELDS = ['v', 'seq', 'prev', 'at', 'action', 'evidence', 'actor', 'from', 'to', 'transferHash', 'evidenceCheck', 'notes', 'hash', 'sig'];
const EVIDENCE_FIELDS = ['name', 'mediaType', 'size', 'sha256'];
const CUSTODIAN_FIELDS = ['kid', 'name', 'org', 'publicKey'];
const REF_FIELDS = ['kid', 'name', 'org'];
const CHECK_FIELDS = ['sha256', 'size'];
const HASH_RE = /^[0-9a-f]{64}$/;
const KID_RE = /^pci1_[A-Za-z0-9_-]{22}$/;

function checkFields(value, fields, code, label = 'objeto') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, `${label} inválido`);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) fail(code, `${label} con clave símbolo`);
  keys.sort();
  const expected = [...fields].sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    fail('UNEXPECTED_FIELD', `${label} con campos no permitidos`, { expected, got: keys });
  }
}

function cleanText(value, field, { max = 200, allowEmpty = false } = {}) {
  if (typeof value !== 'string') fail('BAD_TEXT', `${field} debe ser texto`);
  const text = value.trim();
  if (!allowEmpty && text.length === 0) fail('BAD_TEXT', `${field} vacío`);
  if (text.length > max) fail('BAD_TEXT', `${field} demasiado largo`);
  if (/[\u0000-\u001f\u007f]/.test(text)) fail('BAD_TEXT', `${field} con caracteres de control`);
  return text;
}

function assertIso(value, field) {
  if (typeof value !== 'string') fail('BAD_TIME', `${field} debe ser ISO-8601`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail('BAD_TIME', `${field} no canónico`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) fail('BAD_TIME', `${field} inválido`);
  return ms;
}

function normalizeAt(value, fallback, field = 'at') {
  if (value === undefined) return new Date(fallback).toISOString();
  assertIso(value, field);
  return value;
}

function normalizeNow(now) {
  if (now instanceof Date) return now.getTime();
  if (typeof now === 'number' && Number.isFinite(now)) return now;
  return Date.now();
}

function assertHash(value, field) {
  if (typeof value !== 'string' || !HASH_RE.test(value)) fail('BAD_HASH', `${field} debe ser SHA-256 hexadecimal`);
  return value;
}

export function describeEvidence(value, { name = 'evidence.bin', mediaType = 'application/octet-stream' } = {}) {
  const bytes = bytesOf(value);
  return {
    name: cleanText(name, 'name', { max: 256 }),
    mediaType: cleanText(mediaType, 'mediaType', { max: 128 }),
    size: bytes.length,
    sha256: sha256Hex(bytes),
  };
}

export async function describeFile(path, options = {}) {
  const name = options.name ?? String(path).split(/[\\/]/).pop();
  const bytes = await readFile(path);
  return describeEvidence(bytes, { ...options, name });
}

function normalizeEvidence(value) {
  checkFields(value, EVIDENCE_FIELDS, 'BAD_EVIDENCE', 'evidence');
  const size = value.size;
  if (!Number.isSafeInteger(size) || size < 0) fail('BAD_EVIDENCE', 'size inválido');
  return {
    name: cleanText(value.name, 'name', { max: 256 }),
    mediaType: cleanText(value.mediaType, 'mediaType', { max: 128 }),
    size,
    sha256: assertHash(value.sha256, 'sha256'),
  };
}

function normalizeCustodian(value) {
  const candidate = value?.custodian ?? value;
  checkFields(candidate, CUSTODIAN_FIELDS, 'BAD_CUSTODIAN', 'custodian');
  const publicKey = publicJwk(candidate.publicKey);
  const expectedKid = keyId(publicKey);
  const kid = candidate.kid ?? expectedKid;
  if (typeof kid !== 'string' || !KID_RE.test(kid)) fail('BAD_KID', 'kid inválido');
  if (kid !== expectedKid) fail('KID_MISMATCH', 'kid no corresponde a la clave');
  return {
    kid,
    name: cleanText(candidate.name, 'name', { max: 120 }),
    org: cleanText(candidate.org ?? '', 'org', { max: 160, allowEmpty: true }),
    publicKey,
  };
}

function refOf(custodian) {
  return { kid: custodian.kid, name: custodian.name, org: custodian.org };
}

function normalizeRef(value, field = 'ref') {
  checkFields(value, REF_FIELDS, 'BAD_REF', field);
  const kid = value.kid;
  if (typeof kid !== 'string' || !KID_RE.test(kid)) fail('BAD_KID', `${field}.kid inválido`);
  return {
    kid,
    name: cleanText(value.name, `${field}.name`, { max: 120 }),
    org: cleanText(value.org ?? '', `${field}.org`, { max: 160, allowEmpty: true }),
  };
}

function sameRef(a, b) {
  return canonicalize(a) === canonicalize(b);
}

function normalizeActor(value) {
  if (!value || typeof value !== 'object') fail('BAD_ACTOR', 'actor ausente');
  const privateKey = value.privateKey ?? value.key ?? value;
  const custodian = normalizeCustodian(value.custodian ?? value.public ?? value);
  return { privateKey, custodian, ref: refOf(custodian) };
}

function normalizeRegistry(list) {
  if (!Array.isArray(list) || list.length === 0) fail('BAD_REGISTRY', 'se requiere al menos un custodio');
  const map = new Map();
  for (const item of list) {
    const c = normalizeCustodian(item);
    const existing = map.get(c.kid);
    if (existing && canonicalize(existing) !== canonicalize(c)) fail('DUPLICATE_CUSTODIAN', `kid duplicado: ${c.kid}`);
    map.set(c.kid, c);
  }
  return map;
}

function normalizeTrustedKeys(input) {
  const map = new Map();
  if (input instanceof Map) {
    for (const [kid, value] of input) {
      const c = normalizeCustodian(value);
      if (kid !== c.kid) fail('KID_MISMATCH', 'clave de confianza con kid distinto');
      map.set(c.kid, c);
    }
    return map;
  }
  if (Array.isArray(input)) return normalizeRegistry(input);
  if (input && typeof input === 'object') {
    for (const [kid, value] of Object.entries(input)) {
      const isCustodian = value !== null && typeof value === 'object' && Object.hasOwn(value, 'publicKey');
      const candidate = isCustodian
        ? { ...value, kid }
        : { kid, name: value?.name ?? kid, org: value?.org ?? '', publicKey: value };
      const c = normalizeCustodian(candidate);
      if (kid !== c.kid) fail('KID_MISMATCH', 'clave de confianza con kid distinto');
      map.set(c.kid, c);
    }
    return map;
  }
  fail('BAD_TRUST_ANCHOR', 'trustedKeys inválido');
}

function normalizeCheck(value) {
  checkFields(value, CHECK_FIELDS, 'BAD_EVIDENCE_CHECK', 'evidenceCheck');
  if (!Number.isSafeInteger(value.size) || value.size < 0) fail('BAD_EVIDENCE_CHECK', 'size inválido');
  return { sha256: assertHash(value.sha256, 'evidenceCheck.sha256'), size: value.size };
}

function unsignedOf(record) {
  const { hash, sig, ...unsigned } = record;
  return unsigned;
}

function recordHash(record) {
  return sha256Hex(canonicalBytes(unsignedOf(record)));
}

async function buildRecord({ privateKey, ...unsigned }) {
  const base = {
    v: 1,
    seq: unsigned.seq,
    prev: unsigned.prev,
    at: unsigned.at,
    action: unsigned.action,
    evidence: unsigned.evidence,
    actor: unsigned.actor,
    from: unsigned.from,
    to: unsigned.to,
    transferHash: unsigned.transferHash,
    evidenceCheck: unsigned.evidenceCheck,
    notes: unsigned.notes,
  };
  const hash = recordHash(base);
  const sig = await signCanonical(privateKey, base);
  return { ...base, hash, sig };
}

function assertTransition(state, record, index, evidence) {
  if (state.sealed) fail('LEDGER_SEALED', 'el ledger ya está sellado');
  if (index === 0) {
    if (record.action !== 'REGISTERED') fail('BAD_GENESIS', 'el primer registro debe ser REGISTERED');
    if (record.from !== null || !sameRef(record.to, record.actor)) fail('BAD_GENESIS', 'destino inicial inválido');
    if (record.transferHash !== null || record.evidenceCheck !== null) fail('BAD_GENESIS', 'campos de transferencia en génesis');
    state.current = record.actor;
    return;
  }
  if (record.action === 'REGISTERED') fail('BAD_TRANSITION', 'REGISTERED solo puede ser el primer registro');
  if (state.pending && record.action !== 'RECEIVED') fail('PENDING_TRANSFER', 'la transferencia anterior no tiene recibo');
  if (record.action === 'TRANSFERRED') {
    if (state.pending) fail('PENDING_TRANSFER', 'ya hay una transferencia pendiente');
    if (!sameRef(record.from, state.current)) fail('NOT_CUSTODIAN', 'solo el custodio actual puede transferir');
    if (record.to.kid === state.current.kid) fail('BAD_TRANSFER', 'destino igual al custodio actual');
    if (record.transferHash !== null || record.evidenceCheck !== null) fail('BAD_TRANSFER', 'campos incompatibles');
    state.pending = { record, from: record.from, to: record.to };
    return;
  }
  if (record.action === 'RECEIVED') {
    if (!state.pending) fail('NO_PENDING_TRANSFER', 'recibo sin transferencia');
    if (!sameRef(record.actor, state.pending.to)) fail('NOT_RECEIVER', 'solo el destinatario puede firmar el recibo');
    if (!sameRef(record.from, state.pending.from) || !sameRef(record.to, state.pending.to)) fail('BAD_RECEIPT', 'partes del recibo no coinciden');
    if (record.transferHash !== state.pending.record.hash) fail('BAD_RECEIPT', 'transferHash no coincide');
    if (record.evidenceCheck !== null) fail('BAD_RECEIPT', 'recibo con evidenceCheck');
    state.current = state.pending.to;
    state.pending = null;
    return;
  }
  if (state.pending) fail('PENDING_TRANSFER', 'la transferencia anterior no tiene recibo');
  if (!sameRef(record.actor, state.current)) fail('NOT_CUSTODIAN', 'solo el custodio actual puede operar');
  if (record.from !== null || record.to !== null || record.transferHash !== null) fail('BAD_TRANSITION', 'campos de transferencia inesperados');
  if (record.action === 'VERIFIED') {
    if (!record.evidenceCheck) fail('MISSING_EVIDENCE_CHECK', 'VERIFIED exige hash y tamaño');
    if (record.evidenceCheck.sha256 !== evidence.sha256 || record.evidenceCheck.size !== evidence.size) {
      fail('EVIDENCE_CHECK_MISMATCH', 'la verificación no coincide con la evidencia');
    }
    return;
  }
  if (record.evidenceCheck !== null) fail('BAD_TRANSITION', 'evidenceCheck solo válido en VERIFIED');
  if (record.action === 'SEALED') {
    state.sealed = true;
    state.sealedAt = record.at;
  }
}

async function inspectLedger(ledger, { trustedKeys = null, now = Date.now(), maxClockSkewMs = 300_000, evidenceBytes = null, requireSealed = false, allowPending = false } = {}) {
  checkFields(ledger, TOP_FIELDS, 'BAD_LEDGER', 'ledger');
  if (ledger.v !== 1 || ledger.protocol !== PROTOCOL) fail('UNSUPPORTED_PROTOCOL', 'versión o protocolo no soportado');
  const evidence = normalizeEvidence(ledger.evidence);
  const registry = normalizeRegistry(ledger.custodians);
  if (trustedKeys) {
    for (const [kid, trusted] of trustedKeys) {
      const declared = registry.get(kid);
      if (!declared) fail('UNTRUSTED_CUSTODIAN', `clave de confianza no registrada: ${kid}`);
      if (canonicalize(declared.publicKey) !== canonicalize(trusted.publicKey)) fail('TRUSTED_KEY_MISMATCH', `clave distinta para ${kid}`);
    }
  }
  if (!Array.isArray(ledger.records) || ledger.records.length === 0) fail('EMPTY_LEDGER', 'ledger sin registros');
  const nowMs = normalizeNow(now);
  const skew = Number.isFinite(maxClockSkewMs) && maxClockSkewMs >= 0 ? maxClockSkewMs : 300_000;
  const state = { current: null, pending: null, sealed: false, sealedAt: null };
  let previousHash = null;
  let previousAt = null;
  for (let i = 0; i < ledger.records.length; i++) {
    const record = ledger.records[i];
    checkFields(record, RECORD_FIELDS, 'BAD_RECORD', `registro ${i}`);
    if (record.v !== 1) fail('UNSUPPORTED_PROTOCOL', `registro ${i} con versión no soportada`);
    if (!Number.isSafeInteger(record.seq) || record.seq !== i) fail('BAD_SEQUENCE', `registro ${i} con seq inválido`);
    if (i === 0) {
      if (record.prev !== ZERO_HASH) fail('BAD_GENESIS', 'prev del génesis debe ser cero');
    } else if (record.prev !== previousHash) {
      fail('PREV_MISMATCH', `registro ${i} no enlaza con el anterior`);
    }
    const atMs = assertIso(record.at, `registro ${i}.at`);
    if (atMs > nowMs + skew) fail('FUTURE_RECORD', `registro ${i} en el futuro`);
    if (previousAt !== null && atMs < previousAt) fail('TIME_REGRESSION', `registro ${i} retrocede en el tiempo`);
    previousAt = atMs;
    if (!ACTIONS.includes(record.action)) fail('BAD_ACTION', `registro ${i} con acción desconocida`);
    if (canonicalize(normalizeEvidence(record.evidence)) !== canonicalize(evidence)) fail('EVIDENCE_MISMATCH', `registro ${i} con evidencia distinta`);
    const actor = normalizeRef(record.actor, `registro ${i}.actor`);
    const declared = registry.get(actor.kid);
    if (!declared) fail('UNKNOWN_ACTOR', `registro ${i} con actor no registrado`);
    if (!sameRef(actor, refOf(declared))) fail('ACTOR_MISMATCH', `registro ${i} con identidad distinta a la registrada`);
    if (trustedKeys && !trustedKeys.has(actor.kid)) fail('UNTRUSTED_ACTOR', `registro ${i} sin ancla para ${actor.kid}`);
    if (record.from !== null) {
      const from = normalizeRef(record.from, `registro ${i}.from`);
      const fromDeclared = registry.get(from.kid);
      if (!fromDeclared || !sameRef(from, refOf(fromDeclared))) fail('UNKNOWN_ACTOR', `registro ${i} con from no registrado`);
      if (trustedKeys && !trustedKeys.has(from.kid)) fail('UNTRUSTED_ACTOR', `registro ${i}.from sin ancla para ${from.kid}`);
    }
    if (record.to !== null) {
      const to = normalizeRef(record.to, `registro ${i}.to`);
      const toDeclared = registry.get(to.kid);
      if (!toDeclared || !sameRef(to, refOf(toDeclared))) fail('UNKNOWN_ACTOR', `registro ${i} con to no registrado`);
      if (trustedKeys && !trustedKeys.has(to.kid)) fail('UNTRUSTED_ACTOR', `registro ${i}.to sin ancla para ${to.kid}`);
    }
    if (record.transferHash !== null) assertHash(record.transferHash, `registro ${i}.transferHash`);
    if (record.evidenceCheck !== null) normalizeCheck(record.evidenceCheck);
    if (typeof record.notes !== 'string' || record.notes.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(record.notes)) {
      fail('BAD_NOTES', `registro ${i} con notas inválidas`);
    }
    assertHash(record.hash, `registro ${i}.hash`);
    if (recordHash(record) !== record.hash) fail('HASH_MISMATCH', `registro ${i} alterado`);
    if (!(await verifyCanonical(declared.publicKey, record.sig, unsignedOf(record)))) fail('BAD_SIGNATURE', `registro ${i} con firma inválida`);
    assertTransition(state, record, i, evidence);
    previousHash = record.hash;
  }
  if (state.pending && !allowPending) fail('PENDING_TRANSFER', 'el ledger termina con una transferencia sin recibo');
  if (requireSealed && !state.sealed) fail('NOT_SEALED', 'el ledger no está sellado');
  if (evidenceBytes !== null) {
    const actual = describeEvidence(evidenceBytes, { name: evidence.name, mediaType: evidence.mediaType });
    if (actual.sha256 !== evidence.sha256 || actual.size !== evidence.size) fail('EVIDENCE_HASH_MISMATCH', 'los bytes no coinciden con la evidencia');
  }
  return {
    evidence,
    registry,
    state,
    trust: trustedKeys ? 'ANCHORED' : 'SELF_DECLARED',
    recordCount: ledger.records.length,
    lastHash: previousHash,
  };
}

export async function createLedger({ evidence, collector, custodians = [], at, notes = '', now = Date.now() }) {
  const normalizedEvidence = normalizeEvidence(evidence);
  const actor = normalizeActor(collector);
  await assertKeyPair(actor.privateKey, actor.custodian.publicKey);
  const registry = normalizeRegistry([actor.custodian, ...custodians]);
  const atIso = normalizeAt(at, now);
  const atMs = assertIso(atIso, 'at');
  if (atMs > normalizeNow(now) + 300_000) fail('FUTURE_RECORD', 'el génesis está en el futuro');
  const record = await buildRecord({
    privateKey: actor.privateKey,
    seq: 0,
    prev: ZERO_HASH,
    at: atIso,
    action: 'REGISTERED',
    evidence: normalizedEvidence,
    actor: actor.ref,
    from: null,
    to: actor.ref,
    transferHash: null,
    evidenceCheck: null,
    notes: cleanText(notes, 'notes', { max: 2000, allowEmpty: true }),
  });
  return {
    v: 1,
    protocol: PROTOCOL,
    evidence: normalizedEvidence,
    custodians: [...registry.values()],
    records: [record],
  };
}

export async function appendEvent({ ledger, actor, action, to = null, at, notes = '', evidenceBytes = null, now = Date.now(), maxClockSkewMs = 300_000 }) {
  if (!ACTIONS.includes(action) || action === 'REGISTERED') fail('BAD_ACTION', `acción no válida: ${action}`);
  const inspected = await inspectLedger(ledger, { now, maxClockSkewMs, allowPending: true });
  if (inspected.state.sealed) fail('LEDGER_SEALED', 'el ledger ya está sellado');
  const actorInfo = normalizeActor(actor);
  await assertKeyPair(actorInfo.privateKey, actorInfo.custodian.publicKey);
  const registry = inspected.registry;
  const declared = registry.get(actorInfo.ref.kid);
  if (!declared) fail('UNKNOWN_ACTOR', 'actor no registrado');
  if (!sameRef(actorInfo.ref, refOf(declared))) fail('ACTOR_MISMATCH', 'actor no coincide con el registro');
  const last = ledger.records[ledger.records.length - 1];
  const atIso = normalizeAt(at, now);
  const atMs = assertIso(atIso, 'at');
  const lastMs = assertIso(last.at, 'last.at');
  if (atMs < lastMs) fail('TIME_REGRESSION', 'el nuevo registro retrocede en el tiempo');
  if (atMs > normalizeNow(now) + maxClockSkewMs) fail('FUTURE_RECORD', 'el nuevo registro está en el futuro');
  const base = {
    privateKey: actorInfo.privateKey,
    seq: last.seq + 1,
    prev: last.hash,
    at: atIso,
    action,
    evidence: inspected.evidence,
    actor: actorInfo.ref,
    from: null,
    to: null,
    transferHash: null,
    evidenceCheck: null,
    notes: cleanText(notes, 'notes', { max: 2000, allowEmpty: true }),
  };
  if (action === 'TRANSFERRED') {
    if (!to) fail('BAD_TRANSFER', 'falta el destinatario');
    const recipient = normalizeCustodian(to);
    const registered = registry.get(recipient.kid);
    if (!registered) fail('UNKNOWN_ACTOR', 'destinatario no registrado');
    if (!sameRef(refOf(recipient), refOf(registered))) fail('ACTOR_MISMATCH', 'destinatario no coincide con el registro');
    if (!sameRef(inspected.state.current, actorInfo.ref)) fail('NOT_CUSTODIAN', 'solo el custodio actual puede transferir');
    base.from = inspected.state.current;
    base.to = refOf(recipient);
  } else if (action === 'RECEIVED') {
    const pending = inspected.state.pending;
    if (!pending) fail('NO_PENDING_TRANSFER', 'no hay transferencia pendiente');
    if (!sameRef(actorInfo.ref, pending.to)) fail('NOT_RECEIVER', 'solo el destinatario puede recibir');
    base.from = pending.from;
    base.to = pending.to;
    base.transferHash = pending.record.hash;
  } else if (action === 'VERIFIED') {
    if (evidenceBytes === null) fail('MISSING_EVIDENCE_CHECK', 'VERIFIED exige los bytes o el descriptor de la evidencia');
    const check = describeEvidence(evidenceBytes, { name: inspected.evidence.name, mediaType: inspected.evidence.mediaType });
    if (check.sha256 !== inspected.evidence.sha256 || check.size !== inspected.evidence.size) fail('EVIDENCE_HASH_MISMATCH', 'los bytes no coinciden con la evidencia');
    if (!sameRef(inspected.state.current, actorInfo.ref)) fail('NOT_CUSTODIAN', 'solo el custodio actual puede verificar');
    base.evidenceCheck = { sha256: check.sha256, size: check.size };
  } else if (action === 'SEALED') {
    if (!sameRef(inspected.state.current, actorInfo.ref)) fail('NOT_CUSTODIAN', 'solo el custodio actual puede sellar');
  } else if (action === 'ACCESSED') {
    if (!sameRef(inspected.state.current, actorInfo.ref)) fail('NOT_CUSTODIAN', 'solo el custodio actual puede registrar acceso');
  }
  const record = await buildRecord(base);
  const next = structuredClone(ledger);
  next.records.push(record);
  return next;
}

export async function transferCustody({ ledger, from, to, at, notes = '', now = Date.now(), maxClockSkewMs = 300_000 }) {
  return appendEvent({ ledger, actor: from, action: 'TRANSFERRED', to, at, notes, now, maxClockSkewMs });
}

export async function receiveCustody({ ledger, actor, at, notes = '', now = Date.now(), maxClockSkewMs = 300_000 }) {
  return appendEvent({ ledger, actor, action: 'RECEIVED', at, notes, now, maxClockSkewMs });
}

export async function verifyEvidence({ ledger, actor, evidenceBytes, at, notes = '', now = Date.now(), maxClockSkewMs = 300_000 }) {
  return appendEvent({ ledger, actor, action: 'VERIFIED', evidenceBytes, at, notes, now, maxClockSkewMs });
}

export async function sealLedger({ ledger, actor, at, notes = '', now = Date.now(), maxClockSkewMs = 300_000 }) {
  return appendEvent({ ledger, actor, action: 'SEALED', at, notes, now, maxClockSkewMs });
}

export async function verifyLedger({ ledger, trustedKeys, evidenceBytes = null, now = Date.now(), maxClockSkewMs = 300_000, requireSealed = false }) {
  if (!trustedKeys) fail('MISSING_TRUST_ANCHOR', 'verifyLedger exige claves de confianza externas');
  const anchors = normalizeTrustedKeys(trustedKeys);
  const result = await inspectLedger(ledger, { trustedKeys: anchors, now, maxClockSkewMs, evidenceBytes, requireSealed });
  return {
    ok: true,
    protocol: PROTOCOL,
    trust: result.trust,
    evidence: result.evidence,
    records: result.recordCount,
    lastHash: result.lastHash,
    finalCustodian: result.state.current,
    sealed: result.state.sealed,
    sealedAt: result.state.sealedAt,
  };
}

export async function verifyReceipt({ ledger, trustedKeys, transferHash, now = Date.now(), maxClockSkewMs = 300_000 }) {
  const result = await verifyLedger({ ledger, trustedKeys, now, maxClockSkewMs });
  const index = ledger.records.findIndex((record) => record.hash === transferHash && record.action === 'TRANSFERRED');
  if (index < 0) fail('RECEIPT_NOT_FOUND', 'no existe esa transferencia');
  const transfer = ledger.records[index];
  const receipt = ledger.records[index + 1];
  if (!receipt || receipt.action !== 'RECEIVED' || receipt.transferHash !== transfer.hash) fail('NO_RECEIPT', 'la transferencia no tiene recibo');
  return { ok: true, transfer, receipt, finalCustodian: result.finalCustodian };
}

export function exportLedger(ledger) {
  return canonicalize(ledger);
}

export function importLedger(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail('BAD_JSON', error instanceof Error ? error.message : 'JSON inválido');
  }
  checkFields(value, TOP_FIELDS, 'BAD_LEDGER', 'ledger');
  return value;
}

export function ledgerDigest(ledger) {
  return sha256Hex(canonicalBytes(ledger));
}

export { PciError };

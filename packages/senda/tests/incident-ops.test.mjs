import test from 'node:test';
import assert from 'node:assert/strict';
import { setupAgency, simulatePopulation, issueZoneOrder, deliverOrder, collectResponses, situationReport, STATUS_MODEL } from '../src/incident-ops.mjs';
import { createOrganization, issueCredential } from '../src/roles.mjs';
import { signCommand, keyThumb } from '../src/remote-command.mjs';
import { verifyAuditLog } from '../src/interop.mjs';

const NOW = 1_800_000_000_000;
const TOWNS = [{ id: 'A', name: 'Valdeolmos' }, { id: 'B', name: 'Navalcerro' }, { id: 'C', name: 'Hoyarrubia' }];

test('operación completa: solo la zona actúa, el consentimiento manda y el CAP cuadra con el cuadro', async () => {
  const ops = await setupAgency({ now: NOW });
  const phones = simulatePopulation(TOWNS, { perTown: 40, seed: 3 });
  const cmd = await issueZoneOrder(ops, { zone: ['A'], message: 'Evacuad hacia el norte', now: NOW });
  const d = await deliverOrder(ops, cmd, phones, { now: NOW, pDeliver: () => 1 });
  const inA = phones.filter((p) => p.townId === 'A'), consented = inA.filter((p) => p.consent);
  assert.equal(d.reasons.ACCEPTED, consented.length, 'aceptan exactamente los teléfonos de la zona con consentimiento');
  // el teléfono comprueba el consentimiento antes que la zona: sin permiso del dueño no se evalúa nada más
  assert.equal(d.reasons.NO_OWNER_CONSENT, phones.filter((p) => !p.consent).length);
  assert.equal(d.reasons.NO_DECLARED_ZONE, phones.filter((p) => p.townId !== 'A' && p.consent).length, 'fuera de la zona nadie obedece');
  for (const r of d.results.filter((x) => x.accepted)) assert.equal(r.townId, 'A');
  const { board, responses } = await collectResponses(ops, cmd, phones, d, { now: NOW, pReturn: () => 1 });
  assert.equal(responses.length, consented.length);
  const sum = Object.values(board.totals).reduce((a, b) => a + b, 0);
  assert.equal(sum, responses.length, 'el cuadro cuenta cada respuesta una vez');
  assert.ok(!('VICTIM' in board.totals) && !('DEAD' in board.totals), 'nunca se declara víctima');
  const rep = await situationReport(ops, cmd, board, { now: NOW + 600_000, areaDesc: 'Valdeolmos' });
  assert.match(rep.cap, /<alert xmlns="urn:oasis:names:tc:emergency:cap:1\.2">/);
  assert.match(rep.cap, /<status>Exercise<\/status>/);
  assert.match(rep.cap, new RegExp(`<valueName>SAFE</valueName><value>${board.totals.CONFIRMED_SAFE ?? 0}</value>`));
  assert.equal(rep.auditCheck.ok, true);
  assert.deepEqual(rep.audit.map((e) => e.action), ['ANCHOR_AND_CREDENTIAL', 'ORDER_SIGNED', 'ORDER_DELIVERY', 'RESPONSES_AGGREGATED', 'CAP_SITUATION_REPORT']);
});

test('la misma orden reenviada se rechaza como repetición', async () => {
  const ops = await setupAgency({ now: NOW });
  const phones = simulatePopulation([TOWNS[0]], { perTown: 20, seed: 5, consentRate: 1 });
  const cmd = await issueZoneOrder(ops, { zone: ['A'], message: 'x', now: NOW });
  const first = await deliverOrder(ops, cmd, phones, { now: NOW, pDeliver: () => 1 });
  const again = await deliverOrder(ops, cmd, phones, { now: NOW + 1000, pDeliver: () => 1 });
  assert.equal(first.reasons.ACCEPTED, 20);
  assert.equal(again.reasons.REPLAY, 20);
  assert.equal(again.reasons.ACCEPTED ?? 0, 0);
});

test('orden caducada: nadie la ejecuta', async () => {
  const ops = await setupAgency({ now: NOW });
  const phones = simulatePopulation([TOWNS[0]], { perTown: 10, seed: 6, consentRate: 1 });
  const cmd = await issueZoneOrder(ops, { zone: ['A'], message: 'x', now: NOW, ttlS: 60 });
  const d = await deliverOrder(ops, cmd, phones, { now: NOW + 61_000, pDeliver: () => 1 });
  assert.equal(d.reasons.EXPIRED, 10);
});

test('orden falsificada por un organismo que el teléfono no conoce: rechazo total', async () => {
  const ops = await setupAgency({ now: NOW });
  const phones = simulatePopulation([TOWNS[0]], { perTown: 15, seed: 8, consentRate: 1 });
  const rogue = await createOrganization({ id: 'FALSO', name: 'Impostor', kind: 'CIVIL_PROTECTION' });
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const subject = await keyThumb(await crypto.subtle.exportKey('jwk', keys.publicKey));
  const cred = await issueCredential(rogue, { subject, role: 'COORDINADOR_INCIDENTE', unit: 'x', validFrom: NOW - 1, validUntil: NOW + 3600_000 });
  const forged = await signCommand({ issuerKeys: keys, credential: cred, target: { zone: ['A'] }, actions: ['SIREN'], message: 'Evacuad', now: NOW, kind: 'ALERT' });
  const d = await deliverOrder(ops, forged, phones, { now: NOW, pDeliver: () => 1 });
  assert.equal(d.reasons.CREDENTIAL_UNKNOWN_ORG, 15);
  assert.equal(d.reasons.ACCEPTED ?? 0, 0);
});

test('credencial auténtica usada con otra clave: rechazo (la clave está ligada a la credencial)', async () => {
  const ops = await setupAgency({ now: NOW });
  const phones = simulatePopulation([TOWNS[0]], { perTown: 5, seed: 9, consentRate: 1 });
  const thief = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const stolen = await signCommand({ issuerKeys: thief, credential: ops.credential, target: { zone: ['A'] }, actions: ['SIREN'], message: 'x', now: NOW, kind: 'ALERT' });
  const d = await deliverOrder(ops, stolen, phones, { now: NOW, pDeliver: () => 1 });
  assert.equal(d.reasons.KEY_NOT_BOUND_TO_CREDENTIAL, 5);
});

test('orden alterada en tránsito (cambia la zona): la firma no cuadra', async () => {
  const ops = await setupAgency({ now: NOW });
  const phones = simulatePopulation([TOWNS[1]], { perTown: 5, seed: 10, consentRate: 1 });
  const cmd = await issueZoneOrder(ops, { zone: ['A'], message: 'x', now: NOW });
  const tampered = { ...cmd, target: { zone: ['B'] } };
  const d = await deliverOrder(ops, tampered, phones, { now: NOW, pDeliver: () => 1 });
  assert.equal(d.reasons.BAD_SIGNATURE, 5);
});

test('canales caídos: menos entregas, pero el cuadro sigue siendo coherente; misma semilla, mismo resultado', async () => {
  const run = async () => {
    const ops = await setupAgency({ now: NOW });
    const phones = simulatePopulation(TOWNS, { perTown: 30, seed: 4 });
    const cmd = await issueZoneOrder(ops, { zone: ['A', 'B'], message: 'x', now: NOW });
    const p = (ph) => (ph.townId === 'A' ? 0.4 : 0.95); // en A ha caído la antena: solo malla y LoRa
    const d = await deliverOrder(ops, cmd, phones, { now: NOW, pDeliver: p, seed: 21 });
    const c = await collectResponses(ops, cmd, phones, d, { now: NOW, pReturn: p, seed: 22 });
    return { d, c };
  };
  const a = await run(), b = await run();
  const got = (town) => a.d.results.filter((r) => r.townId === town && r.delivered).length;
  assert.ok(got('A') < got('B'), `con la antena caída llegan menos (${got('A')} < ${got('B')})`);
  assert.deepEqual(a.d.reasons, b.d.reasons, 'reproducible con semilla');
  assert.deepEqual(a.c.board.totals, b.c.board.totals);
});

test('auditoría: alterar una entrada rompe la cadena', async () => {
  const ops = await setupAgency({ now: NOW });
  const phones = simulatePopulation([TOWNS[0]], { perTown: 5, seed: 12, consentRate: 1 });
  const cmd = await issueZoneOrder(ops, { zone: ['A'], message: 'x', now: NOW });
  const d = await deliverOrder(ops, cmd, phones, { now: NOW, pDeliver: () => 1 });
  const { board } = await collectResponses(ops, cmd, phones, d, { now: NOW, pReturn: () => 1 });
  const rep = await situationReport(ops, cmd, board, { now: NOW });
  const forged = rep.audit.map((e) => ({ ...e })); forged[2].data = { ...forged[2].data, ACCEPTED: 999 };
  const v = await verifyAuditLog(forged);
  assert.equal(v.ok, false); assert.equal(v.brokenAt, 2);
});

test('las hipótesis de respuesta suman 1', () => {
  assert.ok(Math.abs(Object.values(STATUS_MODEL).reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test('aprendizaje: una operación enseña la fiabilidad real por canal y pueblo; el plan siguiente la usa', async () => {
  const { ReliabilityStore, priorsFromCatalog } = await import('../src/reliability-store.mjs');
  const { BEARERS } = await import('../src/bearers.mjs');
  const { planAssuredDelivery } = await import('../src/delivery-assurance.mjs');
  const { learnFromDelivery } = await import('../src/incident-ops.mjs');
  // verdad oculta de la simulación: en A cayó la antena (SMS y datos = 0); en B todo funciona
  const TRUTH = { A: { SMS: 0, CELL_DATA: 0, PHONE_MESH: 0.6, MESHTASTIC: 0.75 }, B: { SMS: 0.55, CELL_DATA: 0.5, PHONE_MESH: 0.6, MESHTASTIC: 0.75 } };
  const ops = await setupAgency({ now: NOW });
  const phones = simulatePopulation(TOWNS.slice(0, 2), { perTown: 60, seed: 3 });
  const cmd = await issueZoneOrder(ops, { zone: ['A', 'B'], message: 'x', now: NOW });
  const d = await deliverOrder(ops, cmd, phones, { now: NOW, channelsOf: (ph) => Object.entries(TRUTH[ph.townId]).map(([id, p]) => ({ id, p })), seed: 5 });
  const store = new ReliabilityStore({ nodeId: 'centro', channelPriors: priorsFromCatalog(BEARERS) });
  const L = await learnFromDelivery(ops, store, cmd, d, { now: NOW });
  assert.equal(L.receipts, 120 * 4);
  const smsA = store.getReliability('SMS', 'A', 'WILDFIRE'), smsB = store.getReliability('SMS', 'B', 'WILDFIRE');
  assert.equal(smsA.sampleCount, 60);
  assert.ok(smsA.mean < 0.05 && smsB.mean > 0.4, `SMS en A ${smsA.mean} (sin antena) frente a B ${smsB.mean}`);
  const avail = Object.keys(TRUTH.A).map((id) => ({ id }));
  const plan = (z) => planAssuredDelivery(220, avail, { scenarios: { X: { prob: 1 } }, effort: 'fast', budgetEUR: 0, reliabilityStore: store, zoneH3: z, hazardState: 'WILDFIRE' });
  const pSms = (p) => p.messages.find((m) => m.id === 'SMS')?.pPlanned ?? 0;
  const A = plan('A'), B = plan('B');
  assert.ok(A.learned.SMS.mean < 0.1 && B.learned.SMS.mean > 0.4, 'el planificador ve lo aprendido en cada pueblo');
  assert.ok(pSms(A) < 0.02 && pSms(B) > 0.3, `el plan de A ya no cuenta con el SMS (${pSms(A)}); el de B sí (${pSms(B)})`);
  // reaprender la misma entrega (p. ej. los recibos llegan otra vez por otro canal) no cambia nada
  await learnFromDelivery(ops, store, cmd, d, { now: NOW });
  assert.equal(store.getReliability('SMS', 'A', 'WILDFIRE').sampleCount, 60);
  // dos puestos que vieron la mitad cada uno, fusionados sin servidor, saben lo mismo que uno que lo vio todo
  const half = (keep) => ({ results: d.results.filter((_, i) => i % 2 === keep) });
  const pri = priorsFromCatalog(BEARERS), p1 = new ReliabilityStore({ nodeId: 'puesto-1', channelPriors: pri }), p2 = new ReliabilityStore({ nodeId: 'puesto-2', channelPriors: pri });
  await learnFromDelivery(ops, p1, cmd, half(0), { now: NOW }); await learnFromDelivery(ops, p2, cmd, half(1), { now: NOW });
  const m = p1.merge(p2);
  for (const z of ['A', 'B']) for (const id of Object.keys(TRUTH.A)) assert.deepEqual(m.getReliability(id, z, 'WILDFIRE'), store.getReliability(id, z, 'WILDFIRE'));
  assert.equal((await verifyAuditLog(ops.audit.entries())).ok, true);
  assert.ok(ops.audit.entries().some((e) => e.action === 'RELIABILITY_LEARNED'));
});

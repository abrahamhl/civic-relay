import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity, sealMessage, openMessage, relayView, createInbox, fingerprint, packContact, unpackContact } from '../src/envelope.mjs';
import { createOrganization, issueCredential, verifyCredential, resolveActor, createFamilyRegistry } from '../src/roles.mjs';
import { locateBeacon, projectToCamera, rssiToDistanceM } from '../src/rubble.mjs';
import { analyzeCsi, synthesizeCsi, parseEsp32CsiLine, CAPABILITIES } from '../src/through-wall.mjs';
import { scenarioRubble, scenarioCoordination } from '../src/scenarios.mjs';

const now = Date.UTC(2026, 10, 4, 12);

test('E2E: el destinatario lee, un relé no; manipular el sobre se detecta', async () => {
  const abraham = await generateIdentity(), ismael = await generateIdentity(), relay = await generateIdentity();
  const env = await sealMessage({ sender: abraham, recipient: ismael.publicIdentity, body: 'Ismael, ¿qué tal estás?', priority: 3, ttlS: 3600, now });
  assert.ok(!JSON.stringify(relayView(env, now)).includes('Ismael'));
  const opened = await openMessage({ recipient: ismael, envelope: env, now });
  assert.equal(opened.body, 'Ismael, ¿qué tal estás?');
  await assert.rejects(openMessage({ recipient: relay, envelope: env, now }), /NOT_FOR_ME/);
  const tampered = { ...env, header: { ...env.header, priority: 0 } };
  await assert.rejects(openMessage({ recipient: ismael, envelope: tampered, now }));
  await assert.rejects(openMessage({ recipient: ismael, envelope: env, now: now + 7200_000 }), /EXPIRED/);
});

test('F-02: la firma y la huella de caja del emisor se ligan a la tarjeta de contacto', async () => {
  const sender = await generateIdentity(), recipient = await generateIdentity(), impostor = await generateIdentity();
  const card = await unpackContact(packContact(sender.publicIdentity, 'Ana'));
  const env = await sealMessage({ sender, recipient: recipient.publicIdentity, body: 'hola', priority: 3, ttlS: 3600, now });
  const opened = await openMessage({ recipient, envelope: env, now, expectedSender: card });
  assert.equal(opened.fromFingerprint, sender.publicIdentity.fingerprint);
  assert.equal(opened.fromSignFingerprint, await fingerprint(sender.publicIdentity.signPub));
  assert.equal(opened.senderBinding, 'SIGN_AND_BOX');
  const forged = await sealMessage({ sender: impostor, recipient: recipient.publicIdentity, body: 'hola', priority: 3, ttlS: 3600, now });
  await assert.rejects(openMessage({ recipient, envelope: forged, now, expectedSender: card }), /SENDER_NOT_PINNED/);
  const legacy = await sealMessage({ sender, recipient: recipient.publicIdentity, body: 'hola', priority: 3, ttlS: 3600, now, innerVersion: 2 });
  await assert.rejects(openMessage({ recipient, envelope: legacy, now, expectedSender: card }), /SENDER_BINDING_MISSING/);
  const legacyOpened = await openMessage({ recipient, envelope: legacy, now });
  assert.equal(legacyOpened.fromFingerprint, null);
  assert.equal(legacyOpened.fromSignFingerprint, await fingerprint(sender.publicIdentity.signPub));
  const signOnly = await openMessage({ recipient, envelope: env, now, expectedSender: { signPub: sender.publicIdentity.signPub } });
  assert.equal(signOnly.senderBinding, 'SIGN_ONLY');
});

test('F-05: la identidad se exporta cifrada y falla con frase incorrecta o blob alterado', async () => {
  const { exportIdentityEncrypted, importIdentityEncrypted, exportIdentity } = await import('../src/envelope.mjs');
  const identity = await generateIdentity();
  const passphrase = 'frase de paso larga';
  const blob = await exportIdentityEncrypted(identity, passphrase, { iterations: 100_000 });
  assert.equal(blob.kdf, 'PBKDF2-SHA-256');
  assert.equal(blob.iterations, 100_000);
  const restored = await importIdentityEncrypted(blob, passphrase);
  assert.equal(restored.publicIdentity.fingerprint, identity.publicIdentity.fingerprint);
  await assert.rejects(importIdentityEncrypted(blob, 'frase de paso incorrecta'), /BAD_PASSPHRASE/);
  const tampered = { ...blob, ct: `${blob.ct.slice(0, -1)}${blob.ct.endsWith('A') ? 'B' : 'A'}` };
  await assert.rejects(importIdentityEncrypted(tampered, passphrase), /BAD_PASSPHRASE/);
  await assert.rejects(exportIdentityEncrypted(identity, 'corta'), /al menos 12/);
  const plain = await exportIdentity(identity);
  assert.ok(plain.sign.d, 'la exportación en claro sigue disponible para migración');
});

test('la carrera multicanal entrega duplicados y el receptor se queda con uno', async () => {
  const a = await generateIdentity(), b = await generateIdentity();
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body: 'x', priority: 3, ttlS: 60, now });
  const inbox = createInbox();
  assert.equal(inbox.accept(env, 'BLE', now).fresh, true);
  assert.equal(inbox.accept(env, 'SAT_D2D_SMS', now + 1).fresh, false);
  assert.equal(inbox.stats(env.header.id).duplicates.length, 1);
});

test('credenciales institucionales: válida, caducada, de otra organización o falsificada', async () => {
  const police = await createOrganization({ id: 'pol', name: 'P', kind: 'POLICE' });
  const rogue = await createOrganization({ id: 'pol', name: 'Falsa', kind: 'POLICE' });
  const day = 86400_000;
  const cred = await issueCredential(police, { subject: 'u1', role: 'AGENTE', unit: 'X', validFrom: now - day, validUntil: now + day });
  assert.equal((await verifyCredential(cred, [police.anchor], now)).valid, true);
  assert.equal((await verifyCredential(cred, [police.anchor], now + 2 * day)).reason, 'NOT_VALID_NOW');
  const forged = await issueCredential(rogue, { subject: 'u1', role: 'JEFE', unit: 'X', validFrom: now - day, validUntil: now + day });
  assert.equal((await verifyCredential(forged, [police.anchor], now)).reason, 'BAD_SIGNATURE');
  assert.equal((await verifyCredential(cred, [police.anchor], now, new Set([cred.sig]))).reason, 'REVOKED');
});

test('coordinación: el familiar solo ve a su persona; el voluntario no cambia estados; canales internos aislados', async () => {
  const s = await scenarioCoordination({ now });
  assert.equal(s.familyView.status, 'LOCATED_SAFE');
  assert.equal(s.volunteerCannotSetVictimStatus, true);
  assert.deepEqual(s.channels.policeInternal, { agente: true, bombero: false });
  assert.deepEqual(s.channels.interagency, { jefeBomberos: true, voluntario: false });
  const reg = createFamilyRegistry();
  const vecino = await resolveActor({ userId: 'otro', anchors: [], now });
  const madre = await resolveActor({ userId: 'madre', anchors: [], now });
  const id = reg.registerSought(madre, { name: 'Lucía', contactFingerprint: 'fp' });
  assert.equal(reg.viewFor(vecino, id), null);
  assert.throws(() => reg.list(vecino), /FORBIDDEN/);
});

test('escombros: trilateración RSSI ubica a la víctima con error de metros y la proyecta en la cámara', () => {
  assert.ok(Math.abs(rssiToDistanceM(-59) - 1) < 1e-9);
  const s = scenarioRubble();
  assert.ok(s.horizontalErrorM < 2, `error ${s.horizontalErrorM}`);
  assert.ok(s.arOverlay.u > 0 && s.arOverlay.v > 0);
  assert.equal(s.bridge.id, 'bombero-7');
  assert.equal(s.messageToFamily.status, 'DELIVERABLE');
  const est = locateBeacon([{ x: 0, y: 0, rssi: -70 }, { x: 5, y: 0, rssi: -70 }]);
  assert.equal(est, null, 'con menos de 3 lecturas no se inventa una posición');
  assert.equal(projectToCamera({ x: -5, y: 0, z: 0 }, { pos: { x: 0, y: 0, z: 1 }, yaw: 0 }).visible, false);
});

test('CSI: detecta respiración (~14 rpm) con persona y nada en sala vacía; declara lo imposible', () => {
  const p = analyzeCsi(synthesizeCsi({ person: true, rpm: 14 }), { sr: 20 });
  assert.equal(p.breathing.detected, true);
  assert.ok(Math.abs(p.breathing.rpm - 14) < 1.5);
  assert.equal(analyzeCsi(synthesizeCsi({ person: false, seed: 9 }), { sr: 20 }).breathing.detected, false);
  assert.equal(analyzeCsi([[1]], { sr: 20 }).status, 'INSUFFICIENT_DATA');
  assert.deepEqual(parseEsp32CsiLine('CSI_DATA,...,"[3 4 0 5]"'), [5, 5]);
  assert.equal(CAPABILITIES.find((c) => c.id === 'CAMERA_ALONE_THROUGH_WALL').status, 'NOT_PHYSICALLY_POSSIBLE');
});

test('codificación binaria: ida y vuelta, tamaño compacto, identidad persistente y tarjeta de contacto', async () => {
  const { packEnvelope, unpackEnvelope, exportIdentity, importIdentity, packContact, unpackContact } = await import('../src/envelope.mjs');
  const a = await generateIdentity(), b = await generateIdentity();
  const body = 'SOS: 3 personas en el sótano de Calle Real 4';
  const env = await sealMessage({ sender: a, recipient: b.publicIdentity, body, priority: 0, ttlS: 86400, now, kind: 'SOS' });
  const bin = packEnvelope(env);
  assert.ok(bin.length < 320 + body.length, `binario ${bin.length} B`);
  const back = unpackEnvelope(bin);
  assert.deepEqual(back, env);
  const b2 = await importIdentity(await exportIdentity(b));
  assert.equal(b2.publicIdentity.fingerprint, b.publicIdentity.fingerprint);
  assert.equal((await openMessage({ recipient: b2, envelope: back, now })).body, body);
  const card = await unpackContact(packContact(a.publicIdentity, 'Abraham'));
  assert.equal(card.name, 'Abraham');
  assert.equal(card.fingerprint, a.publicIdentity.fingerprint);
  assert.throws(() => unpackEnvelope(bin.subarray(0, 50)), /truncado/);
});

test('extremo a extremo por SONIDO: tarjeta + sobre cifrado viajan por el módem acústico', async () => {
  const { packEnvelope, unpackEnvelope, packContact, unpackContact } = await import('../src/envelope.mjs');
  const { modulate, demodulate } = await import('../src/acoustic-modem.mjs');
  const a = await generateIdentity(), b = await generateIdentity();
  const card = demodulate(modulate(packContact(b.publicIdentity, 'Ismael')));
  const ismael = await unpackContact(card.payload);
  const env = await sealMessage({ sender: a, recipient: ismael, body: 'Ismael, ¿qué tal estás?', priority: 3, ttlS: 3600, now });
  const heard = demodulate(modulate(packEnvelope(env)));
  const opened = await openMessage({ recipient: b, envelope: unpackEnvelope(heard.payload), now });
  assert.equal(opened.body, 'Ismael, ¿qué tal estás?');
});

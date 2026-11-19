import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity, sealMessage, openMessage } from '../src/envelope.mjs';
import { createBundleStore, syncPair } from '../src/bundle.mjs';
import { createOrganization, issueCredential } from '../src/roles.mjs';
import { signCommand, evaluateCommand, keyThumb, buildResidentResponse, aggregateResponses, RESPONSE_PREFIX } from '../src/remote-command.mjs';

const now = Date.UTC(2026, 10, 4, 12);

test('flujo real: alerta firmada → mula → residente verifica → respuesta cifrada → cuadro del coordinador', async () => {
  // Organismo y coordinador (credencial ligada a su clave de firma)
  const fire = await createOrganization({ id: 'bomberos-cam', name: 'Bomberos', kind: 'FIRE' });
  const coord = await generateIdentity();
  const keys = coord.sign;
  const cred = await issueCredential(fire, { subject: await keyThumb(coord.publicIdentity.signPub), role: 'JEFE_INCIDENTE', unit: 'Parque 3', validFrom: now - 1e6, validUntil: now + 1e8 });
  const cmd = await signCommand({ issuerKeys: keys, credential: cred, kind: 'ALERT', target: { buildingId: 'B14', floors: [3] }, actions: ['SIREN', 'REPORT_STATUS'], message: 'Bomberos en la fachada este', now, reply: coord.publicIdentity });

  // Difusión por la red de teléfonos: coordinador → mula → residente
  const sc = createBundleStore({ owner: coord.publicIdentity.fingerprint });
  const mule = createBundleStore({ owner: 'mula' });
  const res = await generateIdentity();
  const sr = createBundleStore({ owner: res.publicIdentity.fingerprint });
  sc.putBroadcast(cmd, { now });
  await syncPair(sc, mule, { now });
  const toRes = mule.prepareFor(sr.summary(), { now });
  const got = await sr.ingest(toRes, { now });
  assert.equal(got.newBroadcasts.length, 1);

  // El teléfono del residente verifica y planifica
  const ev = await evaluateCommand(got.newBroadcasts[0], { anchors: [fire.anchor], consent: { remoteCommands: true }, inDeclaredZone: true, battery: 40, radios: {}, me: { buildingId: 'B14', floor: 3 }, seen: new Set(), now });
  assert.equal(ev.accepted, true);

  // Responde (o lo hace solo si nadie pulsa) cifrado al coordinador
  const r = buildResidentResponse({ cmdId: cmd.id, status: 'TRAPPED', profile: { buildingId: 'B14', floor: 3, unit: 'B' }, battery: 40, plan: ev.plan, at: now + 60_000 });
  const env = await sealMessage({ sender: res, recipient: got.newBroadcasts[0].reply, body: RESPONSE_PREFIX + JSON.stringify(r), priority: 0, ttlS: 86400, now, kind: 'COORDINATION' });
  sr.put(env, { now });
  await syncPair(sr, mule, { now }); await syncPair(mule, sc, { now });
  const forCoord = (await sc.ingest(mule.prepareFor(sc.summary(), { now }), { now })).forMe;
  const delivered = sc.get(env.header.id) ?? forCoord[0] ?? env;
  const opened = await openMessage({ recipient: coord, envelope: delivered, now });
  const resp = JSON.parse(opened.body.slice(RESPONSE_PREFIX.length));
  const board = aggregateResponses([{ ...resp, from: 'res1' }, { ...buildResidentResponse({ cmdId: cmd.id, status: 'NO_RESPONSE', profile: { buildingId: 'B14', floor: 3, unit: 'D' }, at: now + 90_000 }), from: 'res2' }], { alerts: [cmd], now: now + 100_000 });
  assert.equal(board.byBuilding.B14[3].TRAPPED_CONFIRMED, 1);
  assert.equal(board.byBuilding.B14[3].SIGNAL_NO_RESPONSE, 1);
  assert.deepEqual(resp.executed, ['SIREN', 'REPORT_STATUS']);
});

test('alerta con destinatario de respuesta manipulado → firma inválida (no se pueden desviar respuestas)', async () => {
  const fire = await createOrganization({ id: 'b', name: 'B', kind: 'FIRE' });
  const coord = await generateIdentity(), thief = await generateIdentity();
  const cred = await issueCredential(fire, { subject: await keyThumb(coord.publicIdentity.signPub), role: 'COORDINADOR', unit: 'x', validFrom: now - 1, validUntil: now + 1e8 });
  const cmd = await signCommand({ issuerKeys: coord.sign, credential: cred, target: {}, actions: [], message: 'x', now, reply: coord.publicIdentity });
  const hijacked = { ...cmd, reply: { fingerprint: thief.publicIdentity.fingerprint, boxPub: thief.publicIdentity.boxPub } };
  const ev = await evaluateCommand(hijacked, { anchors: [fire.anchor], consent: { remoteCommands: true }, inDeclaredZone: true, now, seen: new Set() });
  assert.equal(ev.reason, 'BAD_SIGNATURE');
});

test('padrón voluntario: quien no aparece tras 2 alertas y 10 min → DESAPARECIDO sin confirmar', () => {
  const alerts = [{ issuedAt: now }, { issuedAt: now + 300_000 }];
  const agg = aggregateResponses([], { alerts, registry: [{ id: 'p1', buildingId: 'B14', floor: 5, unit: 'A' }], now: now + 700_000 });
  assert.equal(agg.totals.MISSING_UNCONFIRMED, 1);
  assert.equal(aggregateResponses([], { alerts: alerts.slice(0, 1), registry: [{ id: 'p1', buildingId: 'B14', floor: 5 }], now: now + 700_000 }).totals.MISSING_UNCONFIRMED, undefined);
});

test('difusiones: caducadas no viajan, duplicados no se repiten y sobreviven a reinicio', () => {
  const s = createBundleStore({ owner: 'x' });
  assert.equal(s.putBroadcast({ id: 'a', expiresAt: now + 1000 }, { now }).stored, true);
  assert.equal(s.putBroadcast({ id: 'a', expiresAt: now + 1000 }, { now }).reason, 'DUPLICATE');
  assert.equal(s.putBroadcast({ id: 'b', expiresAt: now - 1 }, { now }).stored, false);
  assert.equal(s.prepareFor({ owner: 'y', ids: [], receipts: [], broadcasts: [] }, { now: now + 2000 }).broadcasts.length, 0);
  const r = createBundleStore({ owner: 'x' }).restore(JSON.parse(JSON.stringify(s.snapshot())), { now });
  assert.equal(r.listBroadcasts().length, 1);
});

test('organismo persistente y códigos portables (ancla, solicitud, credencial)', async () => {
  const { createOrganization, exportOrganization, importOrganization, issueCredential, verifyCredential, encodeCode, decodeCode, CODE } = await import('../src/roles.mjs');
  const org = await createOrganization({ id: 'pc-murcia', name: 'Protección Civil (piloto)', kind: 'CIVIL_PROTECTION' });
  const back = await importOrganization(JSON.parse(JSON.stringify(await exportOrganization(org))));
  const coord = await generateIdentity();
  const req = decodeCode(CODE.REQUEST, encodeCode(CODE.REQUEST, { name: 'Ana Ruiz', thumb: await keyThumb(coord.publicIdentity.signPub) }));
  const cred = await issueCredential(back, { subject: req.thumb, role: 'COORDINADOR', unit: 'CECOPAL', validFrom: now, validUntil: now + 86400_000 });
  const anchor = decodeCode(CODE.ANCHOR, encodeCode(CODE.ANCHOR, org.anchor));
  const c2 = decodeCode(CODE.CREDENTIAL, `texto previo ${encodeCode(CODE.CREDENTIAL, cred)} texto posterior`);
  assert.equal((await verifyCredential(c2, [anchor], now + 1000)).valid, true);
  assert.throws(() => decodeCode(CODE.ANCHOR, 'SENDA-CREDENCIAL:xx'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdmin, issueCredential, issueRevocation, acceptRevocation, resolveRole, can, ROLES, GRANTS, encodeQr, decodeQr, QR_PREFIX, sameAnchor } from '../src/app-roles.mjs';

const T0 = Date.UTC(2026, 10, 23, 12);
const DAY = 86_400_000;
const setup = async () => { const admin = await createAdmin(); return { admin, anchor: admin.anchor }; };

test('el dueño de la clave de administrador es ADMIN y puede todo', async () => {
  const { admin, anchor } = await setup();
  const r = await resolveRole({ adminKeys: admin.keys, anchor, now: T0 });
  assert.equal(r.role, ROLES.ADMIN);
  for (const a of ['config.edit', 'credential.issue', 'audit.view', 'view.all', 'vault.view']) assert.ok(can(r, a), a);
});

test('sin firma → CIUDADANO, y el ciudadano solo ve lo público', async () => {
  const { anchor } = await setup();
  const r = await resolveRole({ anchor, now: T0 });
  assert.equal(r.role, ROLES.CIUDADANO);
  assert.equal(r.reason, 'NONE');
  assert.ok(can(r, 'view.public'));
  for (const a of ['view.all', 'use.cameras.full', 'config.edit', 'vault.view']) assert.equal(can(r, a), false, a);
});

test('credencial válida → OBSERVADOR_TOTAL: usa todo, no edita la configuración ni emite', async () => {
  const { admin, anchor } = await setup();
  const cred = await issueCredential(admin, { subject: 'hermano', validFrom: T0 - DAY, validUntil: T0 + 30 * DAY });
  const r = await resolveRole({ credential: cred, anchor, now: T0 });
  assert.equal(r.role, ROLES.OBSERVADOR_TOTAL);
  for (const a of ['view.all', 'use.simulator', 'use.radar', 'use.cameras.full', 'use.fieldtrials']) assert.ok(can(r, a), a);
  for (const a of ['config.edit', 'credential.issue', 'credential.revoke', 'audit.view', 'export.all']) assert.equal(can(r, a), false, a);
});

test('credencial caducada o aún no vigente → CIUDADANO', async () => {
  const { admin, anchor } = await setup();
  const cred = await issueCredential(admin, { subject: 'h', validFrom: T0 - 10 * DAY, validUntil: T0 - DAY });
  assert.equal((await resolveRole({ credential: cred, anchor, now: T0 })).reason, 'EXPIRED');
  const futura = await issueCredential(admin, { subject: 'h', validFrom: T0 + DAY, validUntil: T0 + 2 * DAY });
  assert.equal((await resolveRole({ credential: futura, anchor, now: T0 })).role, ROLES.CIUDADANO);
});

test('manipular el rol o la caducidad invalida la firma', async () => {
  const { admin, anchor } = await setup();
  const cred = await issueCredential(admin, { subject: 'h', validFrom: T0 - DAY, validUntil: T0 + DAY });
  const alargada = { ...cred, validUntil: T0 + 999 * DAY };
  assert.equal((await resolveRole({ credential: alargada, anchor, now: T0 })).reason, 'BAD_SIGNATURE');
  const conBoveda = { ...cred, grants: [GRANTS.VAULT] };
  assert.equal((await resolveRole({ credential: conBoveda, anchor, now: T0 })).reason, 'BAD_SIGNATURE');
  const admin2 = { ...cred, role: ROLES.ADMIN };
  assert.equal((await resolveRole({ credential: admin2, anchor, now: T0 })).role, ROLES.CIUDADANO);
});

test('firmada por otra clave o sin ancla → CIUDADANO', async () => {
  const { admin, anchor } = await setup();
  const intruso = await createAdmin();
  const falsa = await issueCredential(intruso, { subject: 'x', validFrom: T0 - DAY, validUntil: T0 + DAY });
  assert.equal((await resolveRole({ credential: falsa, anchor, now: T0 })).reason, 'BAD_SIGNATURE');
  const buena = await issueCredential(admin, { subject: 'h', validFrom: T0 - DAY, validUntil: T0 + DAY });
  assert.equal((await resolveRole({ credential: buena, now: T0 })).reason, 'NO_ANCHOR');
  assert.equal(sameAnchor(anchor, intruso.anchor), false);
});

test('la bóveda de defensa solo con la concesión VAULT firmada', async () => {
  const { admin, anchor } = await setup();
  const sin = await issueCredential(admin, { subject: 'h', validFrom: T0 - DAY, validUntil: T0 + DAY });
  const con = await issueCredential(admin, { subject: 'h', grants: [GRANTS.VAULT], validFrom: T0 - DAY, validUntil: T0 + DAY });
  assert.equal(can(await resolveRole({ credential: sin, anchor, now: T0 }), 'vault.view'), false);
  assert.equal(can(await resolveRole({ credential: con, anchor, now: T0 }), 'vault.view'), true);
  await assert.rejects(() => issueCredential(admin, { subject: 'h', grants: ['TODO'], validFrom: 0, validUntil: 1 }));
});

test('revocación: surte efecto al llegar la lista; una lista más antigua se rechaza', async () => {
  const { admin, anchor } = await setup();
  const cred = await issueCredential(admin, { subject: 'h', validFrom: T0 - DAY, validUntil: T0 + 30 * DAY });
  const r1 = await issueRevocation(admin, { revokedIds: [cred.id], issuedAt: T0 });
  const ok = await acceptRevocation(null, r1, anchor);
  assert.ok(ok.ok);
  assert.equal((await resolveRole({ credential: cred, anchor, revocation: ok.revocation, now: T0 + 1 })).reason, 'REVOKED');
  const vieja = await issueRevocation(admin, { revokedIds: [], issuedAt: T0 - DAY });
  assert.equal((await acceptRevocation(ok.revocation, vieja, anchor)).reason, 'OLDER_THAN_STORED');
  const falsa = { ...r1, revokedIds: [] };
  assert.equal((await acceptRevocation(null, falsa, anchor)).reason, 'BAD_SIGNATURE');
});

test('retroceso del reloj no resucita una credencial caducada', async () => {
  const { admin, anchor } = await setup();
  const cred = await issueCredential(admin, { subject: 'h', validFrom: T0 - DAY, validUntil: T0 + DAY });
  const r = await resolveRole({ credential: cred, anchor, now: T0 - 7 * DAY, lastSeenMs: T0 + 3 * DAY });
  assert.equal(r.reason, 'CLOCK_ROLLBACK');
  assert.equal(r.role, ROLES.CIUDADANO);
});

test('solo el ADMIN emite y revoca; ida y vuelta por QR', async () => {
  const { admin, anchor } = await setup();
  await assert.rejects(() => issueCredential({ keys: {} }, { subject: 'x', validFrom: 0, validUntil: 1 }));
  await assert.rejects(() => issueRevocation(null, { revokedIds: [], issuedAt: 0 }));
  const cred = await issueCredential(admin, { subject: 'hermano', validFrom: T0 - DAY, validUntil: T0 + DAY });
  const qr = encodeQr(QR_PREFIX.CREDENTIAL, cred);
  assert.ok(qr.length < 600, `cabe en un QR normal (${qr.length} caracteres)`);
  const vuelta = decodeQr(QR_PREFIX.CREDENTIAL, qr);
  assert.equal((await resolveRole({ credential: vuelta, anchor: decodeQr(QR_PREFIX.ANCHOR, encodeQr(QR_PREFIX.ANCHOR, anchor)), now: T0 })).role, ROLES.OBSERVADOR_TOTAL);
  assert.throws(() => decodeQr(QR_PREFIX.CREDENTIAL, 'otra-cosa'));
});

test('basura no lanza: devuelve CIUDADANO', async () => {
  const { anchor } = await setup();
  const r = await resolveRole({ credential: { v: 1, role: 'OBSERVADOR_TOTAL', sig: '###', id: 1, grants: [] }, anchor, now: T0 });
  assert.equal(r.role, ROLES.CIUDADANO);
});

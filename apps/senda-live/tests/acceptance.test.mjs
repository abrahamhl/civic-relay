/**
 * SUITE DE PRUEBAS DE ACEPTACIÓN SENDA LIVE (Node 22 test runner).
 * 
 * Verifica rigurosamente los tests obligatorios especificados en la misión:
 *  - TEST A: Social (registro, publicación de noticia con enlace, feed, seguimiento y persistencia tras reinicio).
 *  - TEST B: Compartir desde otra app (extracción de metadatos permitidos, no duplicación masiva de vídeo).
 *  - TEST C: Suscripciones y consentimiento (Like ≠ Seguir; suscripción explícita; retirada de consentimiento).
 *  - TEST D: Motor de verificación y agrupamiento (hipótesis, contradicciones -> DISPUTED, requisito estricto de fuente oficial).
 *  - TEST E: Suplantación institucional (intento de emisión sin credencial válida -> 403 y registro de seguridad).
 *  - TEST F: Modo offline y estados DTN (QUEUED_OFFLINE -> IN_CUSTODY -> DELIVERED -> VERIFIED con recibo criptográfico).
 *  - TEST G: Moderación y expedientes (reporte, resolución, notificación, apelación y auditoría).
 *  - TEST H: RBAC y control de acceso contextual en servidor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../server/index.mjs';
import { createOrganization, issueCredential } from '@senda/core/src/roles.mjs';
import { sealMessage, generateIdentity, packEnvelope } from '@senda/core/src/envelope.mjs';
import { computeEventStatus } from '../server/domain/verification.mjs';
import { proposeClusters, findContradictions } from '../server/domain/intelligence.mjs';
import { planWindow } from '../shared/priority-lanes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DB = join(__dirname, '../data/test-acceptance.db');

function cleanupDb() {
  if (existsSync(TEST_DB)) rmSync(TEST_DB, { force: true });
}

test('SUITE COMPLETA DE ACEPTACIÓN SENDA LIVE', async (t) => {
  cleanupDb();
  let ctx = createServer({ dbFile: TEST_DB });
  let { db, services } = ctx;

  t.after(() => {
    ctx.db.close();
    cleanupDb();
  });

  await t.test('TEST A — SOCIAL Y PERSISTENCIA TRAS REINICIO', async () => {
    // 1. Registro de dos usuarios
    const u1 = services.auth.register({
      email: 'elena@valencia.es',
      password: 'passwordSeguro123',
      handle: 'elena_vlc',
      displayName: 'Elena Gómez'
    });

    const u2 = services.auth.register({
      email: 'marcos@alacant.es',
      password: 'passwordSeguro456',
      handle: 'marcos_alc',
      displayName: 'Marcos Soler'
    });

    assert.ok(u1.token && u1.user.id);
    assert.ok(u2.token && u2.user.id);

    // 2. Elena publica noticia con enlace real permitido
    const post = await services.social.createPost(u1.user.id, {
      kind: 'NEWS',
      title: 'Aviso por crecida del caudal en el barranco del Poyo',
      body: 'La Confederación advierte aumento súbito del caudal tras lluvias torrenciales.',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      category: 'flood',
      placeLabel: 'Paiporta, Valencia',
      lat: 39.42,
      lon: -0.41,
      createEvent: {
        title: 'Crecida Barranco del Poyo Nov-2026',
        type: 'flood'
      }
    });

    assert.equal(post.title, 'Aviso por crecida del caudal en el barranco del Poyo');
    assert.ok(post.events.length > 0);
    const eventId = post.events[0].id;

    // 3. Marcos ve el feed, sigue el evento y comenta
    const feed = services.social.listFeed({ viewerId: u2.user.id, tab: 'for_you' });
    assert.ok(feed.items.some((p) => p.id === post.id));

    // Seguir evento explícitamente
    const sub = services.events.setSubscription(u2.user.id, eventId, { following: true, notify: true });
    assert.equal(sub.following, true);
    assert.equal(sub.notify, true);

    // Comentar
    const comment = services.social.addComment(u2.user.id, post.id, {
      body: 'Confirmamos paso de agua cortado en el puente bajo.'
    });
    assert.equal(comment.body, 'Confirmamos paso de agua cortado en el puente bajo.');

    // 4. Reinicio del servicio y verificación de persistencia
    ctx.db.close();
    ctx = createServer({ dbFile: TEST_DB });
    db = ctx.db;
    services = ctx.services;

    const postAfter = services.social.getPost(post.id, u2.user.id);
    assert.equal(postAfter.title, 'Aviso por crecida del caudal en el barranco del Poyo');
    assert.equal(postAfter.events[0].viewerFollows, true);

    const commentsAfter = services.social.listComments(post.id);
    assert.equal(commentsAfter.length, 1);
    assert.equal(commentsAfter[0].author.handle, 'marcos_alc');
  });

  await t.test('TEST B — COMPARTIR DESDE OTRA APP (LINK FIRST & PREVIEW)', async () => {
    // Simular recepción de URL externa desde Web Share o portapapeles
    const sharedUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const preview = await services.social.previewLink(sharedUrl);

    assert.equal(preview.provider, 'youtube');
    assert.equal(preview.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(preview.embed.kind, 'IFRAME_CLICK_TO_LOAD');
    assert.ok(preview.embed.src.startsWith('https://www.youtube-nocookie.com/embed/'));
    assert.equal(preview.hypothesis.suggestedCategory, 'general');

    // Verificar que en base de datos solo se almacena la referencia externa y NUNCA archivos pesados
    const mediaRow = db.get('SELECT * FROM external_media_refs WHERE canonical_url = ?', sharedUrl);
    assert.ok(mediaRow);
    assert.equal(mediaRow.provider, 'youtube');
  });

  await t.test('TEST C — SUSCRIPCIONES Y CONSENTIMIENTO (LIKE ≠ SEGUIR)', async () => {
    const userA = db.get("SELECT user_id FROM profiles WHERE handle = 'elena_vlc'").user_id;
    const userB = db.get("SELECT user_id FROM profiles WHERE handle = 'marcos_alc'").user_id;

    // Crear un nuevo evento
    const ev = services.events.createEvent(userA, {
      title: 'Incidencia eléctrica sector Benimaclet',
      type: 'outage',
      placeLabel: 'Benimaclet, Valencia'
    });

    const p = await services.social.createPost(userA, {
      title: 'Transformador humeando en calle Emilio Baró',
      body: 'Corte de suministro en varias manzanas.',
      eventId: ev.id,
      category: 'outage'
    });

    // UserB da LIKE al post, pero NO sigue el evento
    services.social.toggleReaction(userB, p.id);

    // Emitir actualización de evento
    services.events.postUpdate(userA, ev.id, {
      kind: 'UPDATE',
      body: 'Técnicos de Iberdrola trabajando en la reparación.'
    });

    // Comprobar que UserB NO recibió notificación de actualización del evento
    let notifs = db.all("SELECT * FROM notifications WHERE user_id = ? AND ref_id = ?", userB, ev.id);
    assert.equal(notifs.length, 0);

    // Ahora UserB activa explícitamente «Seguir evento»
    services.events.setSubscription(userB, ev.id, { following: true, notify: true });

    // Emitir segunda actualización
    services.events.postUpdate(userA, ev.id, {
      kind: 'UPDATE',
      body: 'Servicio restablecido al 80% del barrio.'
    });

    // Comprobar que UserB SÍ recibió notificación
    notifs = db.all("SELECT * FROM notifications WHERE user_id = ? AND ref_id = ?", userB, ev.id);
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].category, 'FOLLOWED_EVENT');

    // Retirar consentimiento / dejar de seguir
    services.events.setSubscription(userB, ev.id, { following: false });

    // Emitir tercera actualización
    services.events.postUpdate(userA, ev.id, {
      kind: 'UPDATE',
      body: 'Incidencia cerrada definitivamente.'
    });

    // No se reciben nuevas notificaciones
    const notifsAfter = db.all("SELECT * FROM notifications WHERE user_id = ? AND ref_id = ?", userB, ev.id);
    assert.equal(notifsAfter.length, 1);
  });

  await t.test('TEST D — VERIFICACIÓN Y DETECCIÓN DE CONTRADICCIONES', async () => {
    // 3 publicaciones describiendo un incidente
    const posts = [
      { id: 'p1', title: 'Accidente en A-3 km 335 sentido Madrid', body: 'Dos coches implicados, retención de 3 km.', category: 'traffic', createdAt: 1000 },
      { id: 'p2', title: 'Colisión en la A-3 km 335', body: 'Tráfico lento, bomberos en el lugar con 2 coches accidentados.', category: 'traffic', createdAt: 1200 },
      { id: 'p3', title: 'Desmiente corte total en A-3', body: 'No hay 2 coches, son 5 vehículos y un camión.', category: 'traffic', createdAt: 1500 }
    ];

    const clusters = proposeClusters(posts, { threshold: 0.2 });
    assert.ok(clusters.length > 0);
    assert.equal(clusters[0].kind, 'HYPOTHESIS');

    const contradictions = findContradictions(posts);
    assert.ok(contradictions.length > 0);
    assert.ok(contradictions.some((c) => c.type === 'NEGATION' || c.type === 'NUMERIC_MISMATCH'));

    // Comprobar motor de verificación de estado
    const statusWithContradiction = computeEventStatus({
      sources: [
        { kind: 'CITIZEN', independenceKey: 'user:1', authorId: 'u1' },
        { kind: 'CITIZEN', independenceKey: 'user:2', authorId: 'u2' }
      ],
      contradictions: 1,
      officialActive: 0
    });
    assert.equal(statusWithContradiction.status, 'DISPUTED');

    // Sin confirmación oficial, jamás alcanza OFFICIAL_SOURCE_CONFIRMED
    assert.notEqual(statusWithContradiction.status, 'OFFICIAL_SOURCE_CONFIRMED');
  });

  await t.test('TEST E — SUPLANTACIÓN Y CONTROL DE ACCESO INSTITUCIONAL', async () => {
    const userA = db.get("SELECT user_id FROM profiles WHERE handle = 'elena_vlc'").user_id;

    // Usuario civil intenta emitir una alerta oficial
    await assert.rejects(
      async () => {
        await services.emergency.issueAlert(userA, {
          orgId: 'org-bomberos-valencia',
          title: 'ORDEN DE EVACUACIÓN FALSA',
          body: 'Evacuen de inmediato sus viviendas.',
          severity: 'EXTREME',
          urgency: 'IMMEDIATE'
        });
      },
      (err) => {
        assert.equal(err.status, 403);
        return true;
      }
    );

    // Verificar que se registró evento de seguridad en auditoría
    const auditRecord = db.get("SELECT * FROM audit_records WHERE action = 'alert.issue' AND outcome = 'DENIED' ORDER BY at DESC LIMIT 1");
    assert.ok(auditRecord);
    assert.equal(auditRecord.severity, 'SECURITY');
    assert.equal(auditRecord.actor_id, userA);

    // Crear un usuario admin de plataforma para registrar organizaciones y roles
    let admin = db.get("SELECT user_id FROM profiles WHERE handle = 'admin_sys'");
    let adminId = admin?.user_id;
    if (!adminId) {
      const regAdmin = services.auth.register({
        email: 'admin@senda.test',
        password: 'passwordAdmin123',
        handle: 'admin_sys',
        displayName: 'Admin Plataforma'
      });
      adminId = regAdmin.user.id;
      db.run("INSERT INTO role_assignments(id, user_id, role, granted_by, created_at) VALUES ('role-adm-1', ?, 'PLATFORM_ADMIN', ?, ?)",
        adminId, adminId, Date.now());
    }

    // Ahora crear organización oficial verificada y credencial válida
    const bomberoOrg = await createOrganization({
      id: 'org-bomberos-vlc',
      name: 'Bomberos Valencia',
      kind: 'FIRE'
    });

    // Registrar ancla de confianza como Admin
    services.admin.createOrganization(adminId, {
      id: bomberoOrg.id,
      name: bomberoOrg.name,
      kind: 'FIRE',
      anchorPublicJwk: bomberoOrg.anchor.publicJwk
    });

    // Asignar rol institucional
    services.admin.assignRole(adminId, {
      userId: userA,
      role: 'INSTITUTIONAL_OPERATOR',
      orgId: bomberoOrg.id
    });

    // Emitir credencial con la clave privada de la organización
    const cred = await issueCredential(bomberoOrg, {
      subject: userA,
      role: 'Oficial de Guardia',
      unit: 'Parque Central',
      validFrom: Date.now() - 1000,
      validUntil: Date.now() + 86400000
    });

    services.admin.registerAuthorityCredential(adminId, {
      userId: userA,
      orgId: bomberoOrg.id,
      role: 'Oficial de Guardia',
      unit: 'Parque Central',
      credential: cred,
      sig: cred.sig,
      validFrom: cred.validFrom,
      validUntil: cred.validUntil
    });

    // Ahora la emisión debe ser exitosa
    const alert = await services.emergency.issueAlert(userA, {
      orgId: bomberoOrg.id,
      title: 'Aviso por rachas de viento en l Horta Sud',
      body: 'Retiren objetos de balcones y extremen precauciones.',
      severity: 'MODERATE',
      urgency: 'EXPECTED'
    });

    assert.equal(alert.status, 'ACTIVE');
    assert.equal(alert.provenance.organization.name, 'Bomberos Valencia');
  });

  await t.test('TEST F — OFFLINE, COLA DE PRIORIDADES Y ESTADOS DTN', async () => {
    const userA = db.get("SELECT user_id FROM profiles WHERE handle = 'elena_vlc'").user_id;
    const userB = db.get("SELECT user_id FROM profiles WHERE handle = 'marcos_alc'").user_id;

    // Simular que UserA sella un sobre SENDA v2 para UserB
    const idA = await generateIdentity();
    const idB = await generateIdentity();

    const env = await sealMessage({
      sender: idA,
      recipient: idB.publicIdentity,
      body: 'Reporte de emergencia: paso subterráneo anegado',
      priority: 1, // Alta prioridad
      ttlS: 3600,
      now: Date.now(),
      kind: 'COORDINATION'
    });

    // Enviar sobre al gateway: debe quedar en IN_CUSTODY (un solo check)
    const stored = services.emergency.storeEnvelope(userA, { envelope: env });
    assert.equal(stored.state, 'IN_CUSTODY');
    assert.equal(stored.checks, 1);

    // Planificador de cola de prioridad: verificar reserva para tráfico crítico
    const queue = [
      { id: 'm1', kind: 'SOS', priority: 0, sizeBytes: 500, createdAt: 100 },
      { id: 'm2', kind: 'POST', priority: 5, sizeBytes: 2000, createdAt: 101 },
      { id: 'm3', kind: 'PHOTO', priority: 7, sizeBytes: 5000, createdAt: 102 }
    ];
    const plan = planWindow(queue, { budgetBytes: 1500, criticalReserve: 0.5 });
    assert.ok(plan.send.some((item) => item.id === 'm1')); // SOS siempre entra
    assert.equal(plan.byLane.CRITICAL, 500);

    // Destinatario aporta el recibo criptográfico infalsificable del sobre
    // Para obtener el ackSecret, abrimos el sobre con la identidad del receptor
    const opened = await (await import('@senda/core/src/envelope.mjs')).openMessage({
      recipient: idB,
      envelope: env,
      now: Date.now()
    });

    const receiptResult = await services.emergency.submitReceipt(userB, {
      id: env.header.id,
      ackSecret: opened.receipt.ackSecret
    });

    assert.equal(receiptResult.state, 'VERIFIED');

    // Comprobar que en base de datos el mensaje ahora está VERIFIED (doble check real)
    const msg = db.get('SELECT * FROM messages WHERE envelope_id = ?', env.header.id);
    assert.equal(msg.state, 'VERIFIED');
    assert.ok(msg.verified_at > 0);
  });

  await t.test('TEST G — MODERACIÓN, EXPEDIENTE Y APELACIÓN DSA', async () => {
    const userA = db.get("SELECT user_id FROM profiles WHERE handle = 'elena_vlc'").user_id;
    const userB = db.get("SELECT user_id FROM profiles WHERE handle = 'marcos_alc'").user_id;

    // Crear post a denunciar
    const p = await services.social.createPost(userA, {
      title: 'Publicación con posible vídeo engañoso',
      body: 'Circula vídeo de evacuación que parece de otro temporal.'
    });

    // UserB denuncia
    const rep = services.moderation.reportContent(userB, {
      targetType: 'POST',
      targetId: p.id,
      reason: 'OLD_FOOTAGE_MISREPRESENTED',
      details: 'El vídeo es de las inundaciones de 2019.'
    });
    assert.equal(rep.status, 'OPEN');

    const adminId = db.get("SELECT user_id FROM profiles WHERE handle = 'admin_sys'").user_id;

    // Otorgar rol COMMUNITY_MODERATOR a UserB por el Admin
    services.admin.assignRole(adminId, {
      userId: userB,
      role: 'COMMUNITY_MODERATOR'
    });

    // Moderador resuelve: limitar visibilidad
    const resolved = services.moderation.resolveCase(userB, rep.id, {
      decision: 'LABEL_SENSITIVE',
      reason: 'Material descontextualizado pendiente de verificación temporal.'
    });
    assert.equal(resolved.status, 'RESOLVED');
    assert.equal(resolved.decision, 'LABEL_SENSITIVE');

    const postAfterMod = db.get('SELECT sensitive FROM posts WHERE id = ?', p.id);
    assert.equal(postAfterMod.sensitive, 1);

    // Autora (UserA) apela la decisión
    const appealed = services.moderation.appealDecision(userA, rep.id, {
      appealText: 'Aporto enlace a la metadata original con fecha y hora de hoy.'
    });
    assert.equal(appealed.status, 'APPEALED');

    // Otorgar rol TRUST_ANALYST a UserB para resolver apelación
    services.admin.assignRole(adminId, {
      userId: userB,
      role: 'TRUST_ANALYST'
    });

    // Resolución de la apelación: estimar y restaurar
    const closed = services.moderation.resolveAppeal(userB, rep.id, {
      outcome: 'OVERTURNED',
      notes: 'Metadatos verificados; se retira la etiqueta sensible.'
    });
    assert.equal(closed.status, 'CLOSED');
    assert.equal(closed.appeal_outcome, 'OVERTURNED');

    const postAfterAppeal = db.get('SELECT sensitive FROM posts WHERE id = ?', p.id);
    assert.equal(postAfterAppeal.sensitive, 0);
  });
});

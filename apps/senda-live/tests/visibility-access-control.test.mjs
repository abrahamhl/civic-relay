/**
 * PRUEBAS ADVERSARIALES DE CONTROL DE ACCESO Y AISLAMIENTO DE VISIBILIDAD (P0-10)
 *
 * Verifica el cierre estricto de filtraciones de contenido PRIVATE y FOLLOWERS entre cuentas,
 * en eventos, historias, comentarios, reacciones, feeds de proximidad/seguimiento y candidatos de inteligencia.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../server/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DB = join(__dirname, '../data/test-visibility-p0-10.db');

function cleanupDb() {
  if (existsSync(TEST_DB)) rmSync(TEST_DB, { force: true });
}

test('AISLAMIENTO DE VISIBILIDAD Y CONTROL DE ACCESO (P0-10)', async (t) => {
  cleanupDb();
  const ctx = createServer({ dbFile: TEST_DB });
  const { db, services } = ctx;

  t.after(() => {
    ctx.db.close();
    cleanupDb();
  });

  // 1. Crear dos usuarios no relacionados
  const userA = services.auth.register({
    email: 'alice@senda.test',
    password: 'PasswordSeguro123!',
    handle: 'alice_recon',
    displayName: 'Alice Recon',
  }).user;

  const userB = services.auth.register({
    email: 'bob@senda.test',
    password: 'PasswordSeguro123!',
    handle: 'bob_citizen',
    displayName: 'Bob Citizen',
  }).user;

  let publicPost, followersPost, privatePost, storyFromPrivate, eventWithPrivate;

  await t.test('1. Creación de publicaciones con distintos niveles de visibilidad', async () => {
    publicPost = await services.social.createPost(userA.id, {
      title: 'Incidente público en corredor norte',
      body: 'Cierre preventivo de carretera por caída de ramas.',
      visibility: 'PUBLIC',
      category: 'traffic',
      lat: 39.4699,
      lon: -0.3763,
    });
    assert.equal(publicPost.visibility, 'PUBLIC');

    followersPost = await services.social.createPost(userA.id, {
      title: 'Nota solo para seguidores de Alice',
      body: 'Punto de reunión secundario acordado.',
      visibility: 'FOLLOWERS',
      category: 'community',
      lat: 39.4700,
      lon: -0.3765,
    });
    assert.equal(followersPost.visibility, 'FOLLOWERS');

    privatePost = await services.social.createPost(userA.id, {
      title: 'Diario privado de evacuación',
      body: 'Ruta privada confidencial de mi familia.',
      visibility: 'PRIVATE',
      category: 'community',
      lat: 39.4710,
      lon: -0.3770,
      alsoAsStory: true,
      storyMode: 'SOCIAL_STORY',
    });
    assert.equal(privatePost.visibility, 'PRIVATE');
  });

  await t.test('2. Usuario no seguidor (Bob) NO puede acceder a posts PRIVATE ni FOLLOWERS', async () => {
    // Lectura directa de post público: PERMITIDA
    const fetchedPublic = services.social.getPost(publicPost.id, userB.id);
    assert.equal(fetchedPublic.id, publicPost.id);

    // Lectura directa de post seguidores (sin seguir): DENEGADA (404)
    assert.throws(() => {
      services.social.getPost(followersPost.id, userB.id);
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');

    // Lectura directa de post privado: DENEGADA (404)
    assert.throws(() => {
      services.social.getPost(privatePost.id, userB.id);
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');

    // Visitante anónimo (viewerId = null): DENEGADO
    assert.throws(() => {
      services.social.getPost(privatePost.id, null);
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');
  });

  await t.test('3. Feeds de Bob y anónimos NO incluyen publicaciones privadas ni de seguidores ajenos', async () => {
    const feedBob = services.social.listFeed({ viewerId: userB.id, tab: 'for_you' });
    const postIdsBob = feedBob.items.map((p) => p.id);
    assert.ok(postIdsBob.includes(publicPost.id), 'Debe incluir post público');
    assert.ok(!postIdsBob.includes(followersPost.id), 'NO debe incluir post followers');
    assert.ok(!postIdsBob.includes(privatePost.id), 'NO debe incluir post privado');

    const feedAnon = services.social.listFeed({ viewerId: null, tab: 'for_you' });
    const postIdsAnon = feedAnon.items.map((p) => p.id);
    assert.ok(postIdsAnon.includes(publicPost.id));
    assert.ok(!postIdsAnon.includes(followersPost.id));
    assert.ok(!postIdsAnon.includes(privatePost.id));
  });

  await t.test('4. Historias vinculadas a posts privados NO se exponen a terceros', async () => {
    // Alice ve su propia historia
    const storiesAlice = services.social.listStories(Date.now(), userA.id);
    const aliceStoryIds = storiesAlice.map((s) => s.postId);
    assert.ok(aliceStoryIds.includes(privatePost.id), 'Alice debe ver su historia privada');

    // Bob NO ve la historia privada
    const storiesBob = services.social.listStories(Date.now(), userB.id);
    const bobStoryIds = storiesBob.map((s) => s.postId);
    assert.ok(!bobStoryIds.includes(privatePost.id), 'Bob NO debe ver historia privada de Alice');

    // Anónimo NO ve la historia privada
    const storiesAnon = services.social.listStories(Date.now(), null);
    const anonStoryIds = storiesAnon.map((s) => s.postId);
    assert.ok(!anonStoryIds.includes(privatePost.id), 'Anónimo NO debe ver historia privada');
  });

  await t.test('5. Reacciones, comentarios y guardados deniegan acceso a posts privados', async () => {
    // Bob intenta reaccionar a post privado
    assert.throws(() => {
      services.social.toggleReaction(userB.id, privatePost.id);
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');

    // Bob intenta guardar post privado
    assert.throws(() => {
      services.social.toggleSave(userB.id, privatePost.id);
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');

    // Bob intenta comentar post privado
    assert.throws(() => {
      services.social.addComment(userB.id, privatePost.id, { body: 'Intento de espionaje' });
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');

    // Bob intenta listar comentarios de post privado
    assert.throws(() => {
      services.social.listComments(privatePost.id, userB.id);
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');
  });

  await t.test('6. Enlace a eventos y aislamiento en Event Hub', async () => {
    // Bob NO puede enlazar un post privado de Alice a un evento
    const ev = services.events.createEvent(userB.id, {
      title: 'Acontecimiento abierto por Bob',
      type: 'traffic',
    });

    assert.throws(() => {
      services.events.linkPost(userB.id, ev.id, { postId: privatePost.id, relation: 'REPORTS' });
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');

    // Alice enlaza su propio post privado a su evento
    const aliceEvent = services.events.createEvent(userA.id, {
      title: 'Acontecimiento privado de Alice',
      type: 'community',
      postIds: [privatePost.id, publicPost.id],
    });

    // Alice consultando su evento ve ambos posts
    const evAlice = services.events.getEvent(aliceEvent.id, userA.id);
    assert.equal(evAlice.posts.length, 2);

    // Bob consultando el evento de Alice SOLO ve el post público; NO ve el privado ni su evidencia
    const evBob = services.events.getEvent(aliceEvent.id, userB.id);
    assert.equal(evBob.posts.length, 1);
    assert.equal(evBob.posts[0].id, publicPost.id);

    // Verificamos que las fuentes y evidencias de Bob no filtren el post privado
    const leakedSources = evBob.sources.filter((s) => s.post_id === privatePost.id);
    assert.equal(leakedSources.length, 0, 'No debe filtrar fuentes privadas a terceros');

    const leakedEvidence = evBob.evidence.filter((e) => e.post_id === privatePost.id);
    assert.equal(leakedEvidence.length, 0, 'No debe filtrar evidencias privadas a terceros');

    // Listado de eventos: postCount para Bob no incluye el post privado
    const listBob = services.events.listEvents({ viewerId: userB.id });
    const evSummaryBob = listBob.find((e) => e.id === aliceEvent.id);
    assert.equal(evSummaryBob.postCount, 1, 'postCount debe ser 1 (solo el post público)');
  });

  await t.test('7. Propuestas de inteligencia (candidates) NUNCA incluyen posts privados ni de seguidores', async () => {
    const candidates = services.events.intelligenceCandidates();
    assert.equal(candidates.kind, 'HYPOTHESIS');
    // Verificamos que ningún cluster incluya el post privado
    for (const cluster of candidates.clusters) {
      assert.ok(!cluster.postIds.includes(privatePost.id), 'Candidatos no deben incluir posts privados');
      assert.ok(!cluster.postIds.includes(followersPost.id), 'Candidatos no deben incluir posts de seguidores');
    }
  });

  await t.test('8. Seguir a Alice permite a Bob ver posts FOLLOWERS, pero NUNCA posts PRIVATE', async () => {
    services.social.toggleFollow(userB.id, { targetType: 'USER', targetId: userA.id, notify: true });

    // Bob ahora puede ver el post followers
    const fetchedFollowers = services.social.getPost(followersPost.id, userB.id);
    assert.equal(fetchedFollowers.id, followersPost.id);

    // Bob ve el post followers en su pestaña following
    const feedFollowing = services.social.listFeed({ viewerId: userB.id, tab: 'following' });
    const feedFollowingIds = feedFollowing.items.map((p) => p.id);
    assert.ok(feedFollowingIds.includes(followersPost.id));

    // Pero Bob NUNCA puede ver el post privado
    assert.throws(() => {
      services.social.getPost(privatePost.id, userB.id);
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');
  });

  await t.test('9. Bloqueo mutuo oculta todo el contenido entre ambas partes', async () => {
    // Alice bloquea a Bob
    services.social.toggleBlock(userA.id, userB.id);

    // Bob ahora no puede ver ni siquiera el post público de Alice
    assert.throws(() => {
      services.social.getPost(publicPost.id, userB.id);
    }, (err) => err.status === 404 && err.code === 'POST_NOT_FOUND');

    const feedBlocked = services.social.listFeed({ viewerId: userB.id, tab: 'for_you' });
    const blockedIds = feedBlocked.items.map((p) => p.id);
    assert.ok(!blockedIds.includes(publicPost.id), 'Feed no debe contener posts de usuarios bloqueados');
  });
});

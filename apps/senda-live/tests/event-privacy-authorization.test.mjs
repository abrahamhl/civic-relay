import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, migrate } from '../server/db.mjs';
import { createEventService } from '../server/services/events.mjs';
import { createSocialService } from '../server/services/social.mjs';
import { createRealtimeHub } from '../server/realtime.mjs';

function setupDb() {
  const db = openDatabase(':memory:');
  migrate(db);

  // Insert test users
  db.run("INSERT INTO users(id, email, password_hash, status, created_at) VALUES ('alice', 'alice@test.local', 'hash', 'ACTIVE', 1000)");
  db.run("INSERT INTO profiles(user_id, handle, display_name, updated_at) VALUES ('alice', 'alice', 'Alice Author', 1000)");

  db.run("INSERT INTO users(id, email, password_hash, status, created_at) VALUES ('bob', 'bob@test.local', 'hash', 'ACTIVE', 1000)");
  db.run("INSERT INTO profiles(user_id, handle, display_name, updated_at) VALUES ('bob', 'bob', 'Bob Follower', 1000)");

  db.run("INSERT INTO users(id, email, password_hash, status, created_at) VALUES ('eve', 'eve@test.local', 'hash', 'ACTIVE', 1000)");
  db.run("INSERT INTO profiles(user_id, handle, display_name, updated_at) VALUES ('eve', 'eve', 'Eve Stranger', 1000)");

  return db;
}

test('Event & Social Security: getEvent never leaks private or followers-only posts to unauthorized viewers', async () => {
  const db = setupDb();
  const rt = createRealtimeHub(db);
  const notifier = { notify: () => {} };
  const audit = () => {};
  const events = createEventService(db, { rt, notifier, audit });
  const social = createSocialService(db, { rt, notifier, events, audit });

  // 1. Create an emergency event
  const ev = events.createEvent('alice', {
    title: 'Incendio Forestal Sierra Calderona',
    type: 'WILDFIRE',
    lat: 39.70,
    lon: -0.45,
    placeLabel: 'Sierra Calderona'
  });

  // 2. Alice creates three posts: PUBLIC, FOLLOWERS-ONLY, and PRIVATE
  const pubPost = await social.createPost('alice', {
    title: 'Aviso público: columna de humo visible',
    text: 'Se divisa columna de humo al norte del sector.',
    category: 'fire',
    visibility: 'PUBLIC'
  });

  const followersPost = await social.createPost('alice', {
    title: 'Actualización para seguidores: evacuación preventiva',
    text: 'Estamos empaquetando equipo sensible.',
    category: 'fire',
    visibility: 'FOLLOWERS'
  });

  const privPost = await social.createPost('alice', {
    title: 'Reporte confidencial interno bomberos',
    text: 'Punto de bombeo B-3 sin presión de agua.',
    category: 'fire',
    visibility: 'PRIVATE'
  });

  // Link all three posts to the event
  events.linkPost('alice', ev.id, { postId: pubPost.id, relation: 'REPORTS' });
  events.linkPost('alice', ev.id, { postId: followersPost.id, relation: 'REPORTS' });
  events.linkPost('alice', ev.id, { postId: privPost.id, relation: 'REPORTS' });

  // Bob follows Alice
  social.toggleFollow('bob', { targetType: 'USER', targetId: 'alice' });

  // 3. Test Alice (Author) sees ALL three posts in getEvent
  const aliceView = events.getEvent(ev.id, 'alice');
  assert.equal(aliceView.posts.length, 3, 'Alice author must see all 3 posts');

  // 4. Test Bob (Follower) sees PUBLIC and FOLLOWERS, but NOT PRIVATE
  const bobView = events.getEvent(ev.id, 'bob');
  assert.equal(bobView.posts.length, 2, 'Bob follower must see public and followers posts only');
  assert.ok(bobView.posts.some(p => p.id === pubPost.id));
  assert.ok(bobView.posts.some(p => p.id === followersPost.id));
  assert.ok(!bobView.posts.some(p => p.id === privPost.id), 'Private post must NOT leak to Bob');

  // 5. Test Eve (Stranger/Anonymous) sees ONLY PUBLIC post
  const eveView = events.getEvent(ev.id, 'eve');
  assert.equal(eveView.posts.length, 1, 'Eve stranger must see ONLY public post');
  assert.equal(eveView.posts[0].id, pubPost.id);

  const anonView = events.getEvent(ev.id, null);
  assert.equal(anonView.posts.length, 1, 'Anonymous unauthenticated user must see ONLY public post');
  assert.equal(anonView.posts[0].id, pubPost.id);

  // 6. Test Direct getPost: Eve cannot access Followers post or Private post
  assert.throws(() => social.getPost(privPost.id, 'eve'), /POST_NOT_FOUND/);
  assert.throws(() => social.getPost(followersPost.id, 'eve'), /POST_NOT_FOUND/);
  assert.throws(() => social.getPost(followersPost.id, null), /POST_NOT_FOUND/);
  assert.ok(social.getPost(followersPost.id, 'bob'), 'Bob can access followers post directly');

  // 7. Test Blocks: If Alice blocks Bob, Bob can no longer see Alice posts
  social.toggleBlock('alice', 'bob');
  assert.throws(() => social.getPost(pubPost.id, 'bob'), /POST_NOT_FOUND/);
  const bobViewBlocked = events.getEvent(ev.id, 'bob');
  assert.equal(bobViewBlocked.posts.length, 0, 'Blocked user cannot see any posts from blocker');
});

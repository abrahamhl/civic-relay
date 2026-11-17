-- SENDA LIVE · migración 001 · esquema inicial
-- Dialecto: SQLite 3.45+ (node:sqlite). Ver docs/architecture/SENDA_SOCIAL_ARCHITECTURE.md
-- para la ruta de migración a PostgreSQL + PostGIS (tipos equivalentes anotados).
-- Tiempos: epoch en milisegundos (INTEGER) → TIMESTAMPTZ en PostgreSQL.

-- ───────────── DOMINIO A · SOCIAL / IDENTIDAD ─────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
  created_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);

CREATE TABLE profiles (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  bio          TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT,
  home_area    TEXT,
  updated_at   INTEGER NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE user_settings (
  user_id                 TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale                  TEXT NOT NULL DEFAULT 'es' CHECK (locale IN ('es','en','nl')),
  theme                   TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  share_location          INTEGER NOT NULL DEFAULT 0,   -- geolocalización desactivada por defecto
  notify_followed_events  INTEGER NOT NULL DEFAULT 1,
  notify_official_alerts  INTEGER NOT NULL DEFAULT 1,
  notify_social           INTEGER NOT NULL DEFAULT 1,
  dtn_relay_opt_in        INTEGER NOT NULL DEFAULT 0,   -- relé SENDA: opt-in explícito
  preferred_categories    TEXT NOT NULL DEFAULT '[]',
  updated_at              INTEGER NOT NULL
);

-- Consentimientos separados por finalidad (RGPD art. 7): append-only, el último manda.
CREATE TABLE consent_receipts (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose        TEXT NOT NULL,
  granted        INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  scope_ref      TEXT,
  created_at     INTEGER NOT NULL
);
CREATE INDEX consent_user_purpose ON consent_receipts(user_id, purpose, created_at DESC);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,           -- SHA-256 del token; el token nunca se guarda
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at   INTEGER
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE devices (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label            TEXT NOT NULL DEFAULT '',
  dtn_fingerprint  TEXT,                   -- huella de la caja ECDH del sobre SENDA v2
  dtn_public_json  TEXT,                   -- identidad pública (signPub, boxPub) para sellar
  created_at       INTEGER NOT NULL,
  UNIQUE (user_id, dtn_fingerprint)
);

CREATE TABLE organizations (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL,          -- POLICE, FIRE, CIVIL_PROTECTION, HEALTH, NGO, NEWS_ORGANIZATION…
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VERIFIED','SUSPENDED')),
  anchor_public_jwk TEXT,                   -- ancla de confianza (ECDSA P-256), la privada NUNCA llega al servidor
  verified_by       TEXT REFERENCES users(id),
  verified_at       INTEGER,
  created_at        INTEGER NOT NULL
);

CREATE TABLE memberships (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  granted_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id, role)
);

CREATE TABLE role_assignments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  org_id      TEXT REFERENCES organizations(id),
  scope_bbox  TEXT,                         -- ABAC: [minLon,minLat,maxLon,maxLat] JSON o NULL
  event_types TEXT,                         -- ABAC: JSON array o NULL
  granted_by  TEXT REFERENCES users(id),
  expires_at  INTEGER,
  revoked_at  INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX roles_user ON role_assignments(user_id);

CREATE TABLE authority_credentials (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  credential_json TEXT NOT NULL,            -- credencial firmada por la organización (roles.mjs)
  sig             TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL,
  unit            TEXT,
  valid_from      INTEGER NOT NULL,
  valid_until     INTEGER NOT NULL,
  revoked_at      INTEGER,
  revoked_reason  TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE external_media_refs (
  id             TEXT PRIMARY KEY,
  provider       TEXT NOT NULL,
  canonical_url  TEXT NOT NULL UNIQUE,
  external_id    TEXT,
  title          TEXT,
  author_name    TEXT,
  author_url     TEXT,
  site_name      TEXT,
  thumbnail_url  TEXT,                      -- solo URL de referencia; nunca se descarga ni re-aloja
  embed_kind     TEXT NOT NULL DEFAULT 'LINK_CARD',  -- LINK_CARD | IFRAME_CLICK_TO_LOAD
  embed_src      TEXT,                      -- construido a partir de un ID validado; nunca HTML de terceros
  adapter_status TEXT NOT NULL,             -- OK | METADATA_UNAVAILABLE | APPROVAL_REQUIRED | UNSUPPORTED
  acquired_at    INTEGER NOT NULL
);

CREATE TABLE posts (
  id              TEXT PRIMARY KEY,
  author_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('LINK','EXTERNAL_VIDEO','PHOTO','NEWS','STORY','OBSERVATION','INCIDENT_REPORT','HELP_REQUEST','EVENT_UPDATE')),
  title           TEXT NOT NULL DEFAULT '',
  body            TEXT NOT NULL DEFAULT '',
  url             TEXT,
  media_ref_id    TEXT REFERENCES external_media_refs(id),
  category        TEXT NOT NULL DEFAULT 'general',
  visibility      TEXT NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC','FOLLOWERS','PRIVATE')),
  lat_coarse      REAL,                     -- ~1 km: nunca coordenadas precisas en público
  lon_coarse      REAL,
  place_label     TEXT,
  occurred_at     INTEGER,                  -- hora del suceso (si se conoce) ≠ hora de publicación
  sensitive       INTEGER NOT NULL DEFAULT 0,
  moderation_state TEXT NOT NULL DEFAULT 'VISIBLE' CHECK (moderation_state IN ('VISIBLE','LIMITED','REMOVED')),
  content_hash    TEXT NOT NULL,            -- SHA-256 de los datos PROPIOS del reporte (no del material externo)
  idempotency_key TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER,
  version         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (author_id, idempotency_key)
);
CREATE INDEX posts_feed ON posts(created_at DESC, id DESC);
CREATE INDEX posts_author ON posts(author_id, created_at DESC);
CREATE INDEX posts_geo ON posts(lat_coarse, lon_coarse);

CREATE TABLE stories (
  id         TEXT PRIMARY KEY,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL CHECK (mode IN ('SOCIAL_STORY','NEWS_STORY','EVENT_UPDATE','OFFICIAL_COMMUNICATION','RESEARCH_SIMULATION')),
  post_id    TEXT REFERENCES posts(id) ON DELETE CASCADE,
  event_id   TEXT,
  text       TEXT NOT NULL DEFAULT '',
  url        TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX stories_live ON stories(expires_at);

CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX comments_post ON comments(post_id, created_at);

-- Una reacción NO es una suscripción ni un permiso de seguimiento.
CREATE TABLE reactions (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'LIKE',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE saves (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('USER','ORG')),
  target_id   TEXT NOT NULL,
  notify      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (follower_id, target_type, target_id)
);
CREATE INDEX follows_target ON follows(target_type, target_id);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ───────────── DOMINIO B · ACONTECIMIENTOS Y EVIDENCIAS ─────────────
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'UNVERIFIED_REPORT' CHECK (status IN ('UNVERIFIED_REPORT','SOURCE_IDENTIFIED','CORROBORATED','OFFICIAL_SOURCE_CONFIRMED','DISPUTED','RETRACTED','EXPIRED')),
  lat         REAL,                         -- centroide aproximado (geometry(Point,4326) en PostGIS)
  lon         REAL,
  bbox        TEXT,                         -- [minLon,minLat,maxLon,maxLat] (geometry(Polygon) en PostGIS)
  place_label TEXT,
  started_at  INTEGER,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  expires_at  INTEGER,
  version     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX events_geo ON events(lat, lon);
CREATE INDEX events_updated ON events(updated_at DESC);

CREATE TABLE event_posts (
  event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  post_id   TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  relation  TEXT NOT NULL DEFAULT 'REPORTS' CHECK (relation IN ('REPORTS','UPDATES','CONTRADICTS')),
  linked_by TEXT NOT NULL REFERENCES users(id),
  linked_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, post_id)
);
CREATE INDEX event_posts_post ON event_posts(post_id);

CREATE TABLE event_sources (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_kind     TEXT NOT NULL CHECK (source_kind IN ('CITIZEN','JOURNALIST','NEWS_ORG','EXTERNAL_PLATFORM','OFFICIAL')),
  independence_key TEXT NOT NULL,           -- dominio/organización/autor: base de la independencia
  post_id         TEXT REFERENCES posts(id) ON DELETE SET NULL,
  alert_id        TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX event_sources_event ON event_sources(event_id);

CREATE TABLE event_evidence (
  id           TEXT PRIMARY KEY,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  post_id      TEXT REFERENCES posts(id) ON DELETE SET NULL,
  original_url TEXT,
  external_id  TEXT,
  acquired_at  INTEGER NOT NULL,
  author_ref   TEXT,
  metadata     TEXT NOT NULL DEFAULT '{}',  -- solo metadatos autorizados
  report_hash  TEXT NOT NULL,               -- hash de los datos propios del reporte (PCI-like)
  prev_hash    TEXT,                        -- cadena de procedencia por acontecimiento
  created_at   INTEGER NOT NULL
);

CREATE TABLE event_observations (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  text        TEXT NOT NULL,
  lat_coarse  REAL,
  lon_coarse  REAL,
  observed_at INTEGER,
  report_hash TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Suscripción explícita (consentimiento). Una reacción jamás crea una fila aquí.
CREATE TABLE event_subscriptions (
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notify     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE event_updates (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL CHECK (kind IN ('UPDATE','CORRECTION','RETRACTION','STATUS_CHANGE','OFFICIAL_ALERT')),
  body        TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX event_updates_event ON event_updates(event_id, created_at);

CREATE TABLE verification_decisions (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  decided_by  TEXT REFERENCES users(id),     -- NULL = recomputación automática por reglas
  from_status TEXT NOT NULL,
  to_status   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  basis       TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL
);

-- ───────────── DOMINIO C · COORDINACIÓN DE EMERGENCIAS ─────────────
CREATE TABLE alerts (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL REFERENCES organizations(id),
  issuer_user_id    TEXT NOT NULL REFERENCES users(id),
  credential_id     TEXT NOT NULL REFERENCES authority_credentials(id),
  severity          TEXT NOT NULL CHECK (severity IN ('MINOR','MODERATE','SEVERE','EXTREME')),
  urgency           TEXT NOT NULL CHECK (urgency IN ('PAST','FUTURE','EXPECTED','IMMEDIATE')),
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  bbox              TEXT,
  event_id          TEXT REFERENCES events(id),
  status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CORRECTED','RETRACTED','EXPIRED')),
  issued_at         INTEGER NOT NULL,
  expires_at        INTEGER NOT NULL,
  retracted_at      INTEGER,
  retraction_reason TEXT,
  server_signature  TEXT NOT NULL            -- firma ECDSA del servidor sobre el contenido canónico
);
CREATE INDEX alerts_issued ON alerts(issued_at DESC);

CREATE TABLE zone_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  lat        REAL NOT NULL,                  -- elegida por el usuario, redondeada a ~1 km
  lon        REAL NOT NULL,
  radius_km  REAL NOT NULL CHECK (radius_km > 0 AND radius_km <= 100),
  notify     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  category   TEXT NOT NULL,                  -- OFFICIAL | FOLLOWED_EVENT | ZONE | SOCIAL | MODERATION | PLATFORM
  ref_type   TEXT,
  ref_id     TEXT,
  reason     TEXT NOT NULL,                  -- por qué lo recibe el usuario (transparencia)
  payload    TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at    INTEGER,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE channels (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('PUBLIC','PRIVATE','INSTITUTIONAL')),
  name       TEXT NOT NULL,
  topic      TEXT NOT NULL DEFAULT '',
  org_id     TEXT REFERENCES organizations(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE channel_members (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'MEMBER',
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE conversations (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('DIRECT','GROUP','CHANNEL')),
  title      TEXT NOT NULL DEFAULT '',
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  direct_key TEXT UNIQUE,                    -- par ordenado de usuarios para DIRECT (dedupe)
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       INTEGER NOT NULL,
  last_read_at    INTEGER,
  PRIMARY KEY (conversation_id, user_id)
);

-- Estados de entrega explícitos. IN_CUSTODY = guardado en el gateway (un solo check).
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id),
  body            TEXT,
  envelope        TEXT,                      -- sobre SENDA v2 sellado (lane crítica / DTN); el servidor no lo lee
  envelope_id     TEXT UNIQUE,
  ack_hash        TEXT,
  priority        INTEGER NOT NULL DEFAULT 5,
  state           TEXT NOT NULL CHECK (state IN ('LOCAL_DRAFT','QUEUED_OFFLINE','IN_CUSTODY','FORWARDED','DELIVERED','VERIFIED','EXPIRED','FAILED')),
  client_id       TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER,
  delivered_at    INTEGER,
  verified_at     INTEGER,
  UNIQUE (sender_id, client_id)
);
CREATE INDEX messages_conv ON messages(conversation_id, created_at);

-- ───────────── CONFIANZA, MODERACIÓN, AUDITORÍA ─────────────
CREATE TABLE moderation_cases (
  id          TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('POST','COMMENT','USER','EVENT')),
  target_id   TEXT NOT NULL,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  reason      TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','APPEALED','CLOSED')),
  decision    TEXT CHECK (decision IN ('NO_ACTION','LABEL_SENSITIVE','LIMIT','REMOVE')),
  decision_reason TEXT,
  decided_by  TEXT REFERENCES users(id),
  decided_at  INTEGER,
  appeal_text TEXT,
  appeal_at   INTEGER,
  appeal_decided_by TEXT REFERENCES users(id),
  appeal_outcome TEXT,
  created_at  INTEGER NOT NULL,
  UNIQUE (target_type, target_id, reporter_id)
);

CREATE TABLE source_adapters (
  provider      TEXT PRIMARY KEY,
  status        TEXT NOT NULL,
  capabilities  TEXT NOT NULL DEFAULT '{}',
  last_health_at INTEGER,
  notes         TEXT NOT NULL DEFAULT ''
);

CREATE TABLE feed_sources (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('RSS','ATOM')),
  url         TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  license     TEXT NOT NULL,
  org_id      TEXT REFERENCES organizations(id),
  last_fetched_at INTEGER,
  last_status TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL
);

-- Auditoría append-only: los triggers impiden modificar o borrar registros.
CREATE TABLE audit_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  outcome     TEXT NOT NULL CHECK (outcome IN ('ALLOWED','DENIED','ERROR')),
  severity    TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO','SECURITY')),
  reason      TEXT,
  ip_hash     TEXT,
  meta        TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_at ON audit_records(at DESC);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_records BEGIN SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_records BEGIN SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY'); END;

-- Registro de eventos de tiempo real (SSE con Last-Event-ID = seq → sincronización incremental).
CREATE TABLE realtime_events (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('PUBLIC','USER','EVENT_SUBSCRIBERS')),
  audience_id   TEXT,
  payload       TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX realtime_audience ON realtime_events(audience_type, audience_id, seq);

CREATE TABLE feature_flags (
  key        TEXT PRIMARY KEY,
  enabled    INTEGER NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at INTEGER NOT NULL
);
INSERT INTO feature_flags(key, enabled, updated_at) VALUES
  ('remote_metadata_fetch', 1, 0),
  ('third_party_embeds', 1, 0),
  ('dtn_lane', 1, 0),
  ('rss_ingest', 1, 0);

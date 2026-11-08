/**
 * Autenticación y sesiones reales.
 *  - Contraseñas con scrypt (node:crypto) + sal aleatoria de 16 B y comparación en tiempo constante.
 *  - Token de sesión de 32 B aleatorios; en la base de datos solo se guarda su SHA-256.
 *  - Cookie HttpOnly, SameSite=Lax; CSRF exigido en mutaciones por cabecera `X-Senda-Request: 1`.
 *  - Registro de recibos de consentimiento separados por finalidad, exportación y borrado RGPD.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError, bad, newId, sha256hex, str, oneOf } from '../http.mjs';
import { effectiveRoles } from '../rbac.mjs';

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_TTL_MS = 30 * 86_400_000;
export const COOKIE_NAME = 'senda_session';
export const CONSENT_PURPOSES = Object.freeze(['TERMS', 'FOLLOWED_EVENT_NOTIFICATIONS', 'OFFICIAL_ALERT_NOTIFICATIONS', 'SOCIAL_NOTIFICATIONS', 'COARSE_LOCATION', 'DTN_RELAY']);

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize('NFKC'), salt, 64, SCRYPT_OPTS);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, sB64, kB64] = stored.split('$');
  const salt = Buffer.from(sB64, 'base64url'), expected = Buffer.from(kB64, 'base64url');
  const actual = scryptSync(password.normalize('NFKC'), salt, expected.length, SCRYPT_OPTS);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const DUMMY_HASH = hashPassword('dummy-password-for-constant-time');

export function createAuthService(db, audit) {
  function userSummary(userId) {
    const u = db.get(`SELECT u.id, u.email, u.status, u.created_at, p.handle, p.display_name, p.bio, p.avatar_url, p.home_area, p.version AS profile_version
      FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`, userId);
    if (!u) return null;
    const settings = db.get('SELECT * FROM user_settings WHERE user_id = ?', userId);
    const orgs = db.all(`SELECT o.id, o.name, o.kind, o.status, m.role FROM memberships m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ? AND m.status = 'ACTIVE'`, userId);
    const creds = db.all(`SELECT id, org_id, role, unit, valid_from, valid_until, revoked_at FROM authority_credentials WHERE user_id = ?`, userId);
    return {
      id: u.id, email: u.email, status: u.status, createdAt: u.created_at,
      profile: { handle: u.handle, displayName: u.display_name, bio: u.bio, avatarUrl: u.avatar_url, homeArea: u.home_area, version: u.profile_version },
      settings: settings ? {
        locale: settings.locale, theme: settings.theme, shareLocation: Boolean(settings.share_location),
        notifyFollowedEvents: Boolean(settings.notify_followed_events), notifyOfficialAlerts: Boolean(settings.notify_official_alerts),
        notifySocial: Boolean(settings.notify_social), dtnRelayOptIn: Boolean(settings.dtn_relay_opt_in),
        preferredCategories: JSON.parse(settings.preferred_categories || '[]'),
      } : null,
      roles: effectiveRoles(db, userId),
      organizations: orgs,
      credentials: creds,
    };
  }

  function issueSession(userId, now = Date.now()) {
    const token = randomBytes(32).toString('base64url');
    db.run('INSERT INTO sessions(id, user_id, created_at, expires_at, last_seen_at) VALUES (?,?,?,?,?)', sha256hex(token), userId, now, now + SESSION_TTL_MS, now);
    return token;
  }

  function register({ email, password, handle, displayName, locale = 'es' }, { ip } = {}) {
    const cleanEmail = str(email, { field: 'email', min: 5, max: 254, required: true }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw bad('INVALID_EMAIL', 'Correo no válido');
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) throw bad('WEAK_PASSWORD', 'La contraseña debe tener al menos 8 caracteres');
    const cleanHandle = str(handle, { field: 'handle', min: 3, max: 30, required: true }).toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(cleanHandle)) throw bad('INVALID_HANDLE', 'El usuario solo admite letras, números y guion bajo (3-30)');
    const cleanName = str(displayName || cleanHandle, { field: 'displayName', min: 1, max: 80, required: true });
    const cleanLocale = oneOf(locale, ['es', 'en', 'nl'], 'locale', 'es');
    const now = Date.now();
    const userId = newId();
    const pwHash = hashPassword(password);
    try {
      db.tx(() => {
        db.run('INSERT INTO users(id, email, password_hash, status, created_at) VALUES (?,?,?,?,?)', userId, cleanEmail, pwHash, 'ACTIVE', now);
        db.run('INSERT INTO profiles(user_id, handle, display_name, bio, updated_at) VALUES (?,?,?,?,?)', userId, cleanHandle, cleanName, '', now);
        db.run('INSERT INTO user_settings(user_id, locale, updated_at) VALUES (?,?,?)', userId, cleanLocale, now);
        db.run('INSERT INTO consent_receipts(id, user_id, purpose, granted, policy_version, created_at) VALUES (?,?,?,?,?,?)', newId(), userId, 'TERMS', 1, 'v1', now);
      });
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) throw new HttpError(409, 'USER_EXISTS', 'Correo o nombre de usuario ya registrado');
      throw err;
    }
    const token = issueSession(userId, now);
    audit({ actorId: userId, action: 'auth.register', targetType: 'USER', targetId: userId, ip });
    return { token, user: userSummary(userId) };
  }

  function login({ email, password }, { ip } = {}) {
    const key = str(email, { field: 'email', min: 3, max: 254, required: true }).toLowerCase();
    const row = db.get(`SELECT u.id, u.password_hash, u.status FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.email = ? OR p.handle = ?`, key, key);
    const ok = verifyPassword(typeof password === 'string' ? password : '', row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) {
      audit({ actorId: row?.id ?? null, action: 'auth.login', outcome: 'DENIED', severity: 'SECURITY', reason: 'BAD_CREDENTIALS', ip });
      throw new HttpError(401, 'BAD_CREDENTIALS', 'Credenciales incorrectas');
    }
    if (row.status !== 'ACTIVE') {
      audit({ actorId: row.id, action: 'auth.login', outcome: 'DENIED', severity: 'SECURITY', reason: row.status, ip });
      throw new HttpError(403, 'ACCOUNT_NOT_ACTIVE', 'Cuenta no disponible');
    }
    const token = issueSession(row.id);
    audit({ actorId: row.id, action: 'auth.login', targetType: 'USER', targetId: row.id, ip });
    return { token, user: userSummary(row.id) };
  }

  function authenticate(token, now = Date.now()) {
    if (!token || typeof token !== 'string') return null;
    const row = db.get(`SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.status FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, sha256hex(token));
    if (!row || row.revoked_at || now > row.expires_at || row.status !== 'ACTIVE') return null;
    return { userId: row.user_id, sessionId: row.id };
  }

  function logout(token, { actorId, ip } = {}) {
    if (token) db.run('UPDATE sessions SET revoked_at = ? WHERE id = ?', Date.now(), sha256hex(token));
    if (actorId) audit({ actorId, action: 'auth.logout', ip });
  }

  function updateProfile(userId, body) {
    const cur = db.get('SELECT * FROM profiles WHERE user_id = ?', userId);
    if (!cur) throw new HttpError(404, 'NOT_FOUND');
    if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== cur.version) throw new HttpError(409, 'VERSION_CONFLICT');
    const displayName = body.displayName !== undefined ? str(body.displayName, { field: 'displayName', min: 1, max: 80, required: true }) : cur.display_name;
    const bio = body.bio !== undefined ? str(body.bio, { field: 'bio', max: 280 }) : cur.bio;
    const homeArea = body.homeArea !== undefined ? str(body.homeArea, { field: 'homeArea', max: 120 }) : cur.home_area;
    const avatarUrl = body.avatarUrl !== undefined ? (body.avatarUrl ? str(body.avatarUrl, { field: 'avatarUrl', max: 512 }) : null) : cur.avatar_url;
    db.run('UPDATE profiles SET display_name = ?, bio = ?, home_area = ?, avatar_url = ?, updated_at = ?, version = version + 1 WHERE user_id = ?',
      displayName, bio, homeArea, avatarUrl, Date.now(), userId);
    return userSummary(userId);
  }

  function updateSettings(userId, body) {
    const cur = db.get('SELECT * FROM user_settings WHERE user_id = ?', userId);
    const now = Date.now();
    const locale = body.locale !== undefined ? oneOf(body.locale, ['es', 'en', 'nl'], 'locale') : cur.locale;
    const theme = body.theme !== undefined ? oneOf(body.theme, ['system', 'light', 'dark'], 'theme') : cur.theme;
    const flag = (k, col, purpose) => {
      if (body[k] === undefined) return cur[col];
      const v = body[k] ? 1 : 0;
      if (purpose && v !== cur[col]) db.run('INSERT INTO consent_receipts(id, user_id, purpose, granted, policy_version, created_at) VALUES (?,?,?,?,?,?)', newId(), userId, purpose, v, 'v1', now);
      return v;
    };
    const shareLocation = flag('shareLocation', 'share_location', 'COARSE_LOCATION');
    const notifyFollowed = flag('notifyFollowedEvents', 'notify_followed_events', 'FOLLOWED_EVENT_NOTIFICATIONS');
    const notifyOfficial = flag('notifyOfficialAlerts', 'notify_official_alerts', 'OFFICIAL_ALERT_NOTIFICATIONS');
    const notifySocial = flag('notifySocial', 'notify_social', 'SOCIAL_NOTIFICATIONS');
    const dtnRelay = flag('dtnRelayOptIn', 'dtn_relay_opt_in', 'DTN_RELAY');
    const cats = Array.isArray(body.preferredCategories) ? JSON.stringify(body.preferredCategories.slice(0, 20).map((c) => str(c, { field: 'category', max: 30 }))) : cur.preferred_categories;
    db.run(`UPDATE user_settings SET locale=?, theme=?, share_location=?, notify_followed_events=?, notify_official_alerts=?, notify_social=?, dtn_relay_opt_in=?, preferred_categories=?, updated_at=? WHERE user_id=?`,
      locale, theme, shareLocation, notifyFollowed, notifyOfficial, notifySocial, dtnRelay, cats, now, userId);
    return userSummary(userId);
  }

  function recordConsent(userId, { purpose, granted, scopeRef = null }) {
    const p = oneOf(purpose, CONSENT_PURPOSES, 'purpose');
    const id = newId(), now = Date.now();
    db.run('INSERT INTO consent_receipts(id, user_id, purpose, granted, policy_version, scope_ref, created_at) VALUES (?,?,?,?,?,?,?)', id, userId, p, granted ? 1 : 0, 'v1', scopeRef, now);
    return { id, purpose: p, granted: Boolean(granted), createdAt: now };
  }

  function exportUserData(userId) {
    audit({ actorId: userId, action: 'privacy.export', targetType: 'USER', targetId: userId });
    return {
      exportedAt: Date.now(),
      user: userSummary(userId),
      consents: db.all('SELECT * FROM consent_receipts WHERE user_id = ? ORDER BY created_at DESC', userId),
      posts: db.all('SELECT * FROM posts WHERE author_id = ? AND deleted_at IS NULL', userId),
      comments: db.all('SELECT * FROM comments WHERE author_id = ? AND deleted_at IS NULL', userId),
      eventSubscriptions: db.all('SELECT * FROM event_subscriptions WHERE user_id = ?', userId),
      zoneSubscriptions: db.all('SELECT * FROM zone_subscriptions WHERE user_id = ?', userId),
      follows: db.all('SELECT * FROM follows WHERE follower_id = ?', userId),
    };
  }

  function deleteAccount(userId, { ip } = {}) {
    const now = Date.now();
    db.tx(() => {
      db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ?', now, userId);
      db.run('DELETE FROM event_subscriptions WHERE user_id = ?', userId);
      db.run('DELETE FROM zone_subscriptions WHERE user_id = ?', userId);
      db.run('DELETE FROM follows WHERE follower_id = ?', userId);
      db.run('UPDATE posts SET deleted_at = ?, body = "", title = "[eliminado]" WHERE author_id = ?', now, userId);
      db.run('UPDATE profiles SET display_name = "[cuenta eliminada]", bio = "", avatar_url = NULL, home_area = NULL, handle = ? WHERE user_id = ?', `deleted_${userId.slice(0, 8)}`, userId);
      db.run('UPDATE users SET status = "DELETED", email = ?, password_hash = "", deleted_at = ? WHERE id = ?', `deleted+${userId}@deleted.invalid`, now, userId);
    });
    audit({ actorId: userId, action: 'privacy.delete_account', targetType: 'USER', targetId: userId, ip });
  }

  return { register, login, logout, authenticate, userSummary, updateProfile, updateSettings, recordConsent, exportUserData, deleteAccount };
}

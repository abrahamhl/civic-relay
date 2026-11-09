/**
 * Auditoría append-only. Nunca registra secretos: las claves sensibles se eliminan y la IP
 * se guarda como HMAC truncado (permite correlación de abuso sin conservar la IP).
 */
import { createHmac } from 'node:crypto';

const SENSITIVE = /pass|token|secret|cookie|authorization|private|jwk|sig$|credential_json/i;

export function scrub(meta, depth = 0) {
  if (meta === null || typeof meta !== 'object' || depth > 3) return meta;
  if (Array.isArray(meta)) return meta.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(meta)) out[k] = SENSITIVE.test(k) ? '[REDACTED]' : scrub(typeof v === 'string' ? v.slice(0, 300) : v, depth + 1);
  return out;
}

export function createAuditor(db, { ipSalt }) {
  const ipHash = (ip) => (ip ? createHmac('sha256', ipSalt).update(ip).digest('hex').slice(0, 16) : null);
  return function audit({ actorId = null, action, targetType = null, targetId = null, outcome = 'ALLOWED', severity = 'INFO', reason = null, ip = null, meta = {} }) {
    db.run('INSERT INTO audit_records(at, actor_id, action, target_type, target_id, outcome, severity, reason, ip_hash, meta) VALUES (?,?,?,?,?,?,?,?,?,?)',
      Date.now(), actorId, action, targetType, targetId, outcome, severity, reason, ipHash(ip), JSON.stringify(scrub(meta)));
  };
}

/**
 * Capa HTTP mínima sobre node:http: enrutado, JSON con límites, cookies, cabeceras de
 * seguridad, CSRF por cabecera + Origin y limitación de tasa por cubo de tokens.
 */
import { randomUUID, createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, code, message = code, extra = {}) {
    super(message);
    this.status = status; this.code = code; this.extra = extra;
  }
}
export const bad = (code, msg) => new HttpError(400, code, msg);
export const forbidden = (code = 'FORBIDDEN', msg) => new HttpError(403, code, msg);
export const notFound = (code = 'NOT_FOUND') => new HttpError(404, code);

export function createRouter() {
  const routes = [];
  const add = (method) => (pattern, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ method, re, keys, handler, opts });
  };
  return {
    get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE'),
    match(method, path) {
      let pathMatched = false;
      for (const r of routes) {
        const m = r.re.exec(path);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== method) continue;
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { route: r, params };
      }
      return pathMatched ? { methodNotAllowed: true } : null;
    },
  };
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, secure, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) c += '; HttpOnly';
  if (secure) c += '; Secure';
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

export async function readJson(req, limitBytes = 64 * 1024) {
  const ct = req.headers['content-type'] || '';
  if (!ct.startsWith('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch { throw bad('INVALID_JSON'); }
}

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self'",
  "connect-src 'self'",
  // Solo reproductores oficiales, y únicamente tras clic del usuario (click-to-load).
  "frame-src https://www.youtube-nocookie.com https://www.tiktok.com https://embed.bsky.app",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

export function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), bluetooth=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
}

export function sendJson(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

/** Cubo de tokens en memoria (por proceso). En multi-nodo: Redis/PG; ver arquitectura. */
export function createRateLimiter() {
  const buckets = new Map();
  let lastSweep = Date.now();
  return {
    take(key, { capacity, refillPerSec }, now = Date.now()) {
      if (now - lastSweep > 60_000) {
        for (const [k, b] of buckets) if (now - b.t > 600_000) buckets.delete(k);
        lastSweep = now;
      }
      let b = buckets.get(key);
      if (!b) { b = { tokens: capacity, t: now }; buckets.set(key, b); }
      b.tokens = Math.min(capacity, b.tokens + ((now - b.t) / 1000) * refillPerSec);
      b.t = now;
      if (b.tokens < 1) return { ok: false, retryAfterS: Math.ceil((1 - b.tokens) / refillPerSec) };
      b.tokens -= 1;
      return { ok: true };
    },
    reset() { buckets.clear(); },
  };
}

export const newId = () => randomUUID();
export const sha256hex = (s) => createHash('sha256').update(s).digest('hex');

export function encodeCursor(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
export function decodeCursor(s) {
  if (!s) return null;
  try {
    const v = JSON.parse(Buffer.from(String(s), 'base64url').toString('utf8'));
    if (typeof v?.t !== 'number' || typeof v?.id !== 'string') throw new Error();
    return v;
  } catch { throw bad('BAD_CURSOR'); }
}

/* ---------- Validación ---------- */
export function str(v, { field, min = 0, max = 2000, required = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required || min > 0) throw bad('VALIDATION', `${field} es obligatorio`);
    return '';
  }
  if (typeof v !== 'string') throw bad('VALIDATION', `${field} debe ser texto`);
  const t = v.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (t.length < min || t.length > max) throw bad('VALIDATION', `${field}: longitud ${min}-${max}`);
  return t;
}
export function oneOf(v, allowed, field, dflt) {
  if (v === undefined || v === null || v === '') { if (dflt !== undefined) return dflt; throw bad('VALIDATION', `${field} es obligatorio`); }
  if (!allowed.includes(v)) throw bad('VALIDATION', `${field} no válido`);
  return v;
}
export function num(v, { field, min = -Infinity, max = Infinity, optional = false } = {}) {
  if (v === undefined || v === null || v === '') { if (optional) return null; throw bad('VALIDATION', `${field} es obligatorio`); }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad('VALIDATION', `${field} fuera de rango`);
  return n;
}

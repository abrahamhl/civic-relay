/**
 * Red saliente segura (anti-SSRF) para metadatos de enlaces.
 *  - Solo http/https, puertos 80/443, sin credenciales en la URL, longitud ≤ 2048.
 *  - Resolución DNS validada DENTRO de la conexión (lookup propio): la IP comprobada es la
 *    IP usada → sin ventana de DNS rebinding.
 *  - Bloquea loopback, privadas, link-local, CGNAT, multicast, documentación, ULA IPv6, etc.
 *  - Redirecciones manuales (≤3) revalidando cada salto; timeout; tamaño máximo; tipos MIME.
 */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';

const blocked = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4]]) blocked.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32], ['100::', 64], ['2002::', 16]]) blocked.addSubnet(a, p, 'ipv6');

export function isBlockedIp(ip) {
  const fam = net.isIP(ip);
  if (fam === 0) return true;
  if (fam === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return blocked.check(mapped[1], 'ipv4');
    return blocked.check(ip, 'ipv6');
  }
  return blocked.check(ip, 'ipv4');
}

export class UrlRejected extends Error { constructor(code) { super(code); this.code = code; } }

/** Normaliza y valida una URL pública. Lanza UrlRejected. */
export function validatePublicUrl(input) {
  if (typeof input !== 'string') throw new UrlRejected('URL_REQUIRED');
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 2048) throw new UrlRejected('URL_LENGTH');
  let u;
  try { u = new URL(raw); } catch { throw new UrlRejected('URL_MALFORMED'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new UrlRejected('URL_SCHEME');
  if (u.username || u.password) throw new UrlRejected('URL_CREDENTIALS');
  if (u.port && !['80', '443'].includes(u.port)) throw new UrlRejected('URL_PORT');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) throw new UrlRejected('URL_PRIVATE_HOST');
  if (net.isIP(host) && isBlockedIp(host)) throw new UrlRejected('URL_PRIVATE_IP');
  if (!net.isIP(host) && !host.includes('.')) throw new UrlRejected('URL_PRIVATE_HOST');
  u.hash = '';
  // Quitar parámetros de rastreo habituales (privacidad y deduplicación).
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|igshid$|igsh$|si$|mc_eid$|_hsenc$|ref_src$)/i.test(k)) u.searchParams.delete(k);
  return u;
}

function safeLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    const ok = addrs.filter((a) => !isBlockedIp(a.address));
    if (ok.length !== addrs.length || ok.length === 0) return cb(new UrlRejected('URL_RESOLVES_PRIVATE'));
    if (options?.all) return cb(null, ok);
    cb(null, ok[0].address, ok[0].family);
  });
}

/**
 * GET seguro. Devuelve { status, url, contentType, text }.
 * @param {string} url
 */
export async function safeFetch(url, { timeoutMs = 5000, maxBytes = 512 * 1024, accept = 'text/html,application/json;q=0.9', maxRedirects = 3, allowedTypes = /^(text\/html|application\/(json|xhtml\+xml|rss\+xml|atom\+xml|xml)|text\/xml)/i } = {}) {
  let current = validatePublicUrl(url);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requestOnce(current, { timeoutMs, maxBytes, accept });
    if ([301, 302, 303, 307, 308].includes(res.status) && res.location) {
      current = validatePublicUrl(new URL(res.location, current).toString());
      continue;
    }
    if (res.status >= 400) return { status: res.status, url: current.toString(), contentType: res.contentType, text: '' };
    if (!allowedTypes.test(res.contentType || '')) throw new UrlRejected('CONTENT_TYPE_NOT_ALLOWED');
    return { status: res.status, url: current.toString(), contentType: res.contentType, text: res.text };
  }
  throw new UrlRejected('TOO_MANY_REDIRECTS');
}

function requestOnce(u, { timeoutMs, maxBytes, accept }) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: 'GET', lookup: safeLookup, timeout: timeoutMs,
      headers: { 'User-Agent': 'SENDA-Live-LinkPreview/0.1 (+https://github.com/abrahamhl/civic-relay)', Accept: accept, 'Accept-Encoding': 'identity' },
    }, (res) => {
      const status = res.statusCode ?? 0;
      const contentType = String(res.headers['content-type'] || '');
      if (status >= 300 && status < 400) { res.resume(); return resolve({ status, location: res.headers.location, contentType }); }
      const declared = Number(res.headers['content-length'] || 0);
      if (declared > maxBytes) { res.destroy(); return reject(new UrlRejected('RESPONSE_TOO_LARGE')); }
      let size = 0; const chunks = [];
      res.on('data', (c) => { size += c.length; if (size > maxBytes) { res.destroy(); reject(new UrlRejected('RESPONSE_TOO_LARGE')); } else chunks.push(c); });
      res.on('end', () => resolve({ status, contentType, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(new UrlRejected('TIMEOUT')); });
    req.on('error', reject);
    req.end();
  });
}

/**
 * SENDA · Señalización WebRTC compacta para LLAMADAS SIN INTERNET NI SERVIDOR.
 *
 * Problema: WebRTC ya funciona en una red local sin Internet (dos móviles en el punto de
 * acceso de un tercero, o uno haciendo de punto de acceso), pero para arrancar la llamada
 * los dos teléfonos deben intercambiarse su SDP (2–5 KB) por algún canal: normalmente un
 * servidor de señalización en Internet, que en una emergencia no existe.
 *
 * Solución SENDA: los dos extremos usan la MISMA plantilla (audio Opus + canal de datos),
 * así que solo hay que transmitir lo que cambia en cada llamada:
 *   tipo (oferta/respuesta) · usuario y clave ICE · huella SHA-256 del certificado DTLS ·
 *   rol DTLS · candidatos locales (IPv4 o nombre mDNS .local, y puerto UDP).
 * Eso son ≈ 70–110 bytes: caben por SONIDO con el módem acústico (≈ 9 s), en un código
 * de texto corto para copiar o leer en voz alta, o por cualquier portador de SENDA.
 * La seguridad no se rebaja: la huella DTLS va en el código, así que la llamada queda
 * cifrada extremo a extremo (DTLS-SRTP) con el teléfono que emitió ese código.
 */

const enc = new TextEncoder(), dec = new TextDecoder();
export const CALL_VERSION = 1;
export const TEXT_PREFIX = 'SENDA-LLAMADA-1.';

/** Extrae de un SDP lo que cambia en cada llamada. */
export function parseSdp(sdp) {
  const get = (re) => sdp.match(re)?.[1];
  const ufrag = get(/a=ice-ufrag:(\S+)/), pwd = get(/a=ice-pwd:(\S+)/), fp = get(/a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/), setup = get(/a=setup:(\w+)/) || 'actpass';
  if (!ufrag || !pwd || !fp) throw new Error('SDP sin credenciales ICE o huella DTLS');
  const seen = new Set(), candidates = [];
  for (const m of sdp.matchAll(/a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host/gi)) {
    const key = `${m[1]}:${m[2]}`; if (seen.has(key)) continue; seen.add(key);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(m[1]) || /^[0-9a-f-]{36}\.local$/i.test(m[1])) candidates.push({ address: m[1], port: +m[2] });
  }
  return { ufrag, pwd, fingerprint: fp.split(':').map((h) => parseInt(h, 16)), setup, candidates: candidates.slice(0, 4) };
}

const SETUPS = ['actpass', 'active', 'passive'];
/** Empaqueta en binario: [ver|tipo][setup][ufrag][pwd][huella 32][n][candidatos]. */
export function packCall({ type, ufrag, pwd, fingerprint, setup, candidates }) {
  if (fingerprint.length !== 32) throw new Error('huella SHA-256 de 32 bytes');
  const out = [(CALL_VERSION << 1) | (type === 'answer' ? 1 : 0), SETUPS.indexOf(setup) & 3];
  for (const s of [ufrag, pwd]) { const b = enc.encode(s); if (b.length > 255) throw new Error('credencial demasiado larga'); out.push(b.length, ...b); }
  out.push(...fingerprint, candidates.length);
  for (const c of candidates) {
    if (/\.local$/i.test(c.address)) { out.push(1, ...c.address.slice(0, 36).replace(/-/g, '').match(/../g).map((h) => parseInt(h, 16))); }
    else { out.push(0, ...c.address.split('.').map(Number)); }
    out.push(c.port >> 8, c.port & 255);
  }
  return new Uint8Array(out);
}

export function unpackCall(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); let i = 0;
  const ver = b[i] >> 1, type = b[i++] & 1 ? 'answer' : 'offer';
  if (ver !== CALL_VERSION) throw new Error(`versión de llamada ${ver} no compatible`);
  const setup = SETUPS[b[i++]] ?? 'actpass';
  const str = () => { const n = b[i++], s = dec.decode(b.subarray(i, i + n)); i += n; return s; };
  const ufrag = str(), pwd = str(), fingerprint = [...b.subarray(i, i + 32)]; i += 32;
  const n = b[i++], candidates = [];
  for (let k = 0; k < n; k++) {
    const kind = b[i++]; let address;
    if (kind === 1) { const h = [...b.subarray(i, i + 16)].map((x) => x.toString(16).padStart(2, '0')).join(''); i += 16; address = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`; }
    else { address = [...b.subarray(i, i + 4)].join('.'); i += 4; }
    candidates.push({ address, port: (b[i] << 8) | b[i + 1] }); i += 2;
  }
  if (i !== b.length) throw new Error('código de llamada mal formado');
  return { type, setup, ufrag, pwd, fingerprint, candidates };
}

/**
 * Reconstruye un SDP completo y válido a partir del paquete compacto (plantilla común
 * SENDA: m=audio Opus/48000 + m=application webrtc-datachannel, BUNDLE, rtcp-mux).
 */
export function sdpFromCall(c, { sessionId = '4611731400430051336' } = {}) {
  const fp = c.fingerprint.map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const cands = c.candidates.map((x, k) => `a=candidate:${k + 1} 1 udp ${2122260223 - k} ${x.address} ${x.port} typ host generation 0`).join('\r\n');
  const common = [`a=ice-ufrag:${c.ufrag}`, `a=ice-pwd:${c.pwd}`, 'a=ice-options:trickle', `a=fingerprint:sha-256 ${fp}`, `a=setup:${c.setup}`].join('\r\n');
  return [
    'v=0', `o=- ${sessionId} 2 IN IP4 127.0.0.1`, 's=-', 't=0 0', 'a=group:BUNDLE 0 1', 'a=msid-semantic: WMS senda',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111', 'c=IN IP4 0.0.0.0', 'a=rtcp:9 IN IP4 0.0.0.0', cands, common, 'a=mid:0',
    'a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level', 'a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01', 'a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid',
    'a=sendrecv', 'a=msid:senda audio', 'a=rtcp-mux', 'a=rtpmap:111 opus/48000/2', 'a=rtcp-fb:111 transport-cc', 'a=fmtp:111 minptime=10;useinbandfec=1',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', cands, common, 'a=mid:1', 'a=sctp-port:5000', 'a=max-message-size:262144', '',
  ].filter((l) => l !== '').join('\r\n') + '\r\n';
}

/** SDP local completo → bytes compactos (para el módem acústico o cualquier portador). */
export const compactFromSdp = (sdp, type) => packCall({ type, ...parseSdp(sdp) });
/** Bytes → { type, sdp } listo para setRemoteDescription. */
export function sdpFromCompact(bytes) { const c = unpackCall(bytes); return { type: c.type, sdp: sdpFromCall(c) }; }

const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(t, (c) => c.charCodeAt(0)); };
/** Código de texto para copiar, compartir o dictar. */
export const callToText = (bytes) => TEXT_PREFIX + b64u(bytes);
export function callFromText(text) { const t = String(text).trim(); if (!t.startsWith(TEXT_PREFIX)) throw new Error('no es un código de llamada SENDA'); return unb64u(t.slice(TEXT_PREFIX.length)); }

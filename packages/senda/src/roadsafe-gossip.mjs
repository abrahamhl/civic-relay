/**
 * SENDA RoadSafe · Intercambio de avisos entre dispositivos que se cruzan en la carretera (gossip sin red).
 *
 * Cuando dos dispositivos SENDA se encuentran (BLE, Wi-Fi Direct, enlace del coche), el contacto dura pocos
 * segundos y el ancho de banda es escaso. Este módulo decide QUÉ pasar y EN QUÉ ORDEN:
 *
 *   1. HELLO compacto del par: carretera, sentido de la geometría, posición s, y un resumen de los avisos que
 *      ya conoce (prefijos cortos de id). Nada personal: sin identificador de dispositivo ni de persona.
 *   2. Para cada aviso activo que el par NO conoce, se asigna un PAPEL:
 *        · CONSUMIDOR — el aviso está por delante del par en su sentido: le afecta a él.
 *        · PORTADOR   — el aviso es del sentido CONTRARIO y queda por detrás del par: el par se aleja de la
 *                       escena justo hacia los vehículos que se acercan a ella. Es el portador natural
 *                       (ver bleRelayReach: con penetración baja la cadena del mismo sentido no llega).
 *        · nada       — detrás en su mismo sentido, otra carretera, caducado o sin posición en la vía.
 *   3. Orden: CONSUMIDOR antes que PORTADOR; dentro, techo WARNING antes que ADVISORY, gravedad del tipo,
 *      y cercanía. Se llena el presupuesto de bytes DECLARADO; lo que no cabe se informa, no se descarta en silencio.
 *
 * Blindaje: el par solo transporta como PORTADOR avisos con confianza ≥ carryMinTrust (declarada), y con
 * saltos < maxHops (declarado): así un aviso inventado sin firma no se puede inundar por la carretera.
 * Los prefijos cortos pueden colisionar (≈ n²/2³³ con 8 hex): una colisión hace que el par NO reciba un
 * aviso que creía tener; se declara como límite y el aviso vuelve a ofrecerse en el siguiente contacto.
 */
import { roadLocate } from './road-guard.mjs';
import { KIND_PRIORITY } from './roadsafe-attention.mjs';
import { TRUST_LEVELS } from './roadsafe-warning-bus.mjs';

const TRUST_RANK = Object.fromEntries(TRUST_LEVELS.map((t, i) => [t, i]));
export const SHORT_ID_HEX = 8;
const shortId = (id) => String(id).replace(/^W-/, '').slice(0, SHORT_ID_HEX);

/** HELLO del par. fix en la vía `road`; known: ids de avisos que ya tiene. */
export function helloOf(fix, road, known = []) {
  const me = roadLocate(fix, road);
  return { schema: 'senda-gossip-hello/1', roadId: road.id ?? null, dir: me.dir, s: me.s, crossM: me.crossM, digest: [...new Set(known.map(shortId))].sort() };
}

/** Tamaño de un aviso en el enlace: proyección compacta (sin texto libre ni linaje completo). */
export function wireOf(w, hops) {
  return { id: w.warningId, k: w.kind, la: +w.point.lat.toFixed(5), lo: +w.point.lon.toFixed(5), r: w.road.roadId, d: w.road.dir, x: w.extentM ?? 0, vf: w.validFrom, vu: w.validUntil, t: w.trust, h: hops, roots: [...new Set(w.lineage.map((l) => l.root))].slice(0, 4) };
}
const bytesOf = (o) => new TextEncoder().encode(JSON.stringify(o)).length;

/**
 * Selección para un par. warnings: avisos activos del bus (con warningId). hello: helloOf() del par.
 * opts (DECLARADOS): { now, road, maxBytes, maxHops, carryMinTrust, maxOffRoadM, hopsOf? }
 */
export function selectForPeer(warnings, hello, opts) {
  const { now, road, maxBytes, maxHops, carryMinTrust, maxOffRoadM, hopsOf = () => 0 } = opts ?? {};
  for (const [k, v] of Object.entries({ now, maxBytes, maxHops, maxOffRoadM })) if (!Number.isFinite(v)) throw new Error(`selectForPeer: «${k}» debe declararse`);
  if (!(carryMinTrust in TRUST_RANK)) throw new Error('selectForPeer: «carryMinTrust» debe declararse (nivel de confianza)');
  if (!road || hello?.schema !== 'senda-gossip-hello/1') throw new Error('selectForPeer: falta la vía o el HELLO del par');
  const known = new Set(hello.digest), cands = [], skipped = [];
  for (const w of warnings) {
    const id = w.warningId;
    if (!(w.validUntil > now)) { skipped.push({ id, why: 'caducado' }); continue; }
    if (known.has(shortId(id))) { skipped.push({ id, why: 'el par ya lo tiene' }); continue; }
    const hops = hopsOf(w);
    if (!(hops < maxHops)) { skipped.push({ id, why: 'tope de saltos' }); continue; }
    if (w.road.roadId && hello.roadId && w.road.roadId !== hello.roadId) { skipped.push({ id, why: 'otra carretera' }); continue; }
    const loc = roadLocate({ lat: w.point.lat, lon: w.point.lon }, road);
    if (loc.crossM > maxOffRoadM) { skipped.push({ id, why: 'fuera de la vía' }); continue; }
    const wDir = w.family === 'WEATHER' ? null : w.road.dir; // el tiempo afecta a ambos sentidos
    const aheadOfPeer = (loc.s - hello.s) * hello.dir;
    let role = null;
    if ((wDir == null || wDir === hello.dir) && aheadOfPeer >= -20) role = 'CONSUMER';
    else if (wDir != null && wDir !== hello.dir && aheadOfPeer < 0) role = 'CARRIER';
    if (!role) { skipped.push({ id, why: wDir === hello.dir ? 'detrás del par' : 'contrario y por delante: el par va hacia la escena, no hacia los afectados' }); continue; }
    if (role === 'CARRIER' && TRUST_RANK[w.trust] < TRUST_RANK[carryMinTrust]) { skipped.push({ id, why: 'confianza insuficiente para transportarlo' }); continue; }
    cands.push({ w, role, distM: Math.abs(aheadOfPeer), hops });
  }
  const rank = (c) => [c.role === 'CONSUMER' ? 1 : 0, c.w.ceiling === 'WARNING' ? 1 : 0, KIND_PRIORITY[c.w.kind] ?? 0, -c.distM];
  cands.sort((a, b) => { const A = rank(a), B = rank(b); for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return B[i] - A[i]; return 0; });
  const send = [], overflow = []; let used = 0;
  for (const c of cands) {
    const wire = wireOf(c.w, c.hops + 1), n = bytesOf(wire);
    if (used + n > maxBytes) { overflow.push({ id: c.w.warningId, role: c.role, bytes: n }); continue; }
    used += n; send.push({ role: c.role, distM: Math.round(c.distM), bytes: n, wire });
  }
  return { send, overflow, skipped, bytesUsed: used, maxBytes, note: overflow.length ? 'no cabe todo: se ofrecerá en el siguiente contacto' : null };
}

/**
 * Recepción: valida lo que llega por el enlace antes de pasarlo al bus. Nunca sube la confianza: lo que
 * llega de un par entra como máximo como SIGNED_PEER si su cápsula se verificó, y como UNVERIFIED_HINT si no.
 */
export function acceptFromPeer(wire, { now, maxHops, signatureVerified }) {
  for (const [k, v] of Object.entries({ now, maxHops })) if (!Number.isFinite(v)) throw new Error(`acceptFromPeer: «${k}» debe declararse`);
  if (typeof signatureVerified !== 'boolean') throw new Error('acceptFromPeer: «signatureVerified» debe declararse');
  const bad = (why) => ({ ok: false, why });
  if (!wire || typeof wire.id !== 'string' || !(wire.k in KIND_PRIORITY)) return bad('formato');
  if (![wire.la, wire.lo, wire.vf, wire.vu, wire.h].every(Number.isFinite) || Math.abs(wire.la) > 90 || Math.abs(wire.lo) > 180) return bad('campos numéricos');
  if (!(wire.vu > now) || wire.vf > now + 60) return bad('fuera de vigencia');
  if (wire.h > maxHops) return bad('demasiados saltos');
  const claimed = TRUST_RANK[wire.t] ?? 0, cap = TRUST_RANK[signatureVerified ? 'SIGNED_PEER' : 'UNVERIFIED_HINT'];
  const trust = TRUST_LEVELS[Math.min(claimed, cap)];
  return { ok: true, trustDowngraded: claimed > cap, warning: { kind: wire.k, lat: wire.la, lon: wire.lo, roadId: wire.r ?? null, dir: wire.d ?? null, extentM: wire.x ?? 0, validFrom: wire.vf, validUntil: wire.vu, trust, lineage: (wire.roots?.length ? wire.roots : [wire.id]).slice(0, 4).map((root) => ({ source: `peer:${wire.id}`, root, at: now })) }, hops: wire.h };
}

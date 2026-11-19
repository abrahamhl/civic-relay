/**
 * SENDA RoadSafe · Ocupantes y teléfonos: quién iba en el vehículo, quién ha respondido y qué móviles
 * pueden haberse perdido o separado de su dueño en el impacto.
 *
 * Problema real: tras un choque los móviles salen despedidos, quedan bajo asientos o fuera del vehículo,
 * se apagan o se rompen. Saber «cuántas personas iban» y «quién no ha respondido» ayuda al 112, pero
 * hay que separar SIEMPRE persona y dispositivo:
 *   - un móvil que responde no prueba que su dueño esté bien (otro puede contestar por él);
 *   - un móvil que NO responde no prueba que su dueño esté herido (puede estar perdido o roto).
 * Estados por persona: OK_SELF_REPORTED · NEEDS_HELP · REPORTED_BY_OTHER · UNACCOUNTED.
 * Estados por dispositivo: RESPONDING · SILENT · POSSIBLY_SEPARATED (lejos del grupo) · POSSIBLY_LOST.
 *
 * Privacidad: el manifiesto del viaje es voluntario, local, con alias (sin nombres obligatorios) y caduca
 * al terminar el viaje. Solo se comparte el RECUENTO con el 112, salvo consentimiento expreso.
 * Unirse al grupo exige un código del conductor (QR/enlace) — HMAC de grupo, sin servidor.
 */

import { constantTimeEqual } from './roadsafe-guard.mjs';
const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

async function hmac(keyBytes, msg) { const k = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(await subtle.sign('HMAC', k, enc.encode(msg))); }

/** Crea el viaje: el conductor obtiene un secreto de grupo para invitar (QR). */
export async function createTrip({ tripId, vehicleLabel = 'vehículo', now, ttlS = 12 * 3600 }) {
  const secret = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { tripId, vehicleLabel, createdAt: now, expiresAt: now + ttlS, secret, members: new Map(), devices: new Map(), events: [], checkIn: null };
}
/** Código de invitación (lo que va en el QR): HMAC del tripId con el secreto; no revela el secreto. */
export const inviteCode = (trip) => hmac(trip.secret, `invite:${trip.tripId}`);

/** Unirse: persona (alias) + dispositivo. El código debe coincidir. Un dispositivo, una persona. */
export async function joinTrip(trip, { code, alias, deviceId, role = 'PASSENGER', now }) {
  if (now > trip.expiresAt) return { ok: false, error: 'viaje caducado' };
  if (!constantTimeEqual(String(code ?? ''), await inviteCode(trip))) return { ok: false, error: 'código de invitación no válido' };
  if (!alias || !deviceId) return { ok: false, error: 'alias y dispositivo obligatorios' };
  const personId = `P${trip.members.size + 1}`;
  trip.members.set(personId, { personId, alias, role, deviceId, status: 'UNKNOWN', reportedBy: null });
  trip.devices.set(deviceId, { deviceId, personId, lastSeen: now, lastPos: null, battery: null, status: 'RESPONDING' });
  trip.events.push({ at: now, op: 'JOIN', personId });
  return { ok: true, personId };
}
/** Personas sin móvil (bebé, persona mayor): se añaden al manifiesto sin dispositivo. */
export function addPersonWithoutDevice(trip, { alias, now, role = 'PASSENGER' }) {
  const personId = `P${trip.members.size + 1}`; trip.members.set(personId, { personId, alias, role, deviceId: null, status: 'UNKNOWN', reportedBy: null }); trip.events.push({ at: now, op: 'ADD_NO_DEVICE', personId }); return personId;
}
/** Latido de un dispositivo (posición aproximada, batería). */
export function heartbeat(trip, { deviceId, now, pos = null, battery = null }) {
  const d = trip.devices.get(deviceId); if (!d) return { ok: false };
  d.lastSeen = now; if (pos) d.lastPos = pos; if (battery != null) d.battery = battery; return { ok: true };
}

/** Tras un choque detectado: se abre la comprobación «¿estás bien?» con plazo. */
export function startCheckIn(trip, { now, timeoutS = 90, crashPos = null }) {
  trip.checkIn = { startedAt: now, deadline: now + timeoutS, crashPos };
  for (const m of trip.members.values()) { m.status = 'UNACCOUNTED'; m.reportedBy = null; }
  trip.events.push({ at: now, op: 'CHECKIN_START', timeoutS });
  return trip.checkIn;
}
/** Respuesta propia desde el dispositivo de la persona. */
export function respond(trip, { deviceId, now, status }) {
  const d = trip.devices.get(deviceId); if (!d || !trip.checkIn) return { ok: false, error: 'sin comprobación activa o dispositivo desconocido' };
  if (!['OK', 'NEED_HELP'].includes(status)) return { ok: false, error: 'estado no válido' };
  d.lastSeen = now; const m = trip.members.get(d.personId);
  m.status = status === 'OK' ? 'OK_SELF_REPORTED' : 'NEEDS_HELP'; m.reportedBy = 'SELF_DEVICE';
  trip.events.push({ at: now, op: 'RESPOND', personId: m.personId, status });
  return { ok: true };
}
/** Otra persona informa por alguien (p. ej. el conductor ve que el bebé está bien o que alguien no responde). */
export function reportFor(trip, { byDeviceId, personId, now, status }) {
  const by = trip.devices.get(byDeviceId), m = trip.members.get(personId);
  if (!by || !m) return { ok: false };
  if (!['OK', 'NEED_HELP', 'NOT_RESPONDING'].includes(status)) return { ok: false, error: 'estado no válido' };
  m.status = status === 'OK' ? 'REPORTED_BY_OTHER' : 'NEEDS_HELP'; m.reportedBy = by.personId; m.reportNote = status;
  trip.events.push({ at: now, op: 'REPORT_FOR', personId, by: by.personId, status });
  return { ok: true };
}

/**
 * Situación: recuento de personas y diagnóstico de dispositivos.
 * Un dispositivo está POSSIBLY_SEPARATED si su última posición está a > `separationM` del punto del choque
 * mientras su dueño consta como OK por otra vía; POSSIBLY_LOST si calla tras el choque y su dueño respondió
 * por otro medio o fue informado por otro.
 */
export function situation(trip, { now, separationM = 30 } = {}) {
  const ci = trip.checkIn, people = [...trip.members.values()];
  for (const d of trip.devices.values()) {
    const owner = trip.members.get(d.personId), silent = ci ? d.lastSeen < ci.startedAt : false; // sin actividad desde el choque
    const far = ci?.crashPos && d.lastPos ? distM(ci.crashPos, d.lastPos) > separationM : false;
    d.status = !silent ? (far ? 'POSSIBLY_SEPARATED' : 'RESPONDING') : ['OK_SELF_REPORTED', 'REPORTED_BY_OTHER', 'NEEDS_HELP'].includes(owner.status) ? 'POSSIBLY_LOST' : 'SILENT';
  }
  const count = (s) => people.filter((p) => p.status === s).length;
  const expired = ci ? now > ci.deadline : false;
  return {
    tripId: trip.tripId, checkInOpen: !!ci && !expired, peopleOnBoard: people.length,
    ok: count('OK_SELF_REPORTED') + count('REPORTED_BY_OTHER'), needHelp: count('NEEDS_HELP'), unaccounted: count('UNACCOUNTED'),
    unaccountedAliases: people.filter((p) => p.status === 'UNACCOUNTED').map((p) => p.alias),
    devices: [...trip.devices.values()].map((d) => ({ deviceId: d.deviceId, owner: trip.members.get(d.personId).alias, status: d.status, battery: d.battery, lastSeenAgoS: Math.round(now - d.lastSeen) })),
    for112: { personasEnVehiculo: people.length, necesitanAyuda: count('NEEDS_HELP'), sinConfirmar: count('UNACCOUNTED') },
    caveats: ['Un móvil que responde no prueba que su dueño esté bien.', 'Un móvil callado no prueba que su dueño esté herido: puede estar perdido o roto.'],
  };
}

/**
 * Buscar un móvil perdido: orden local firmada por el grupo para que suene y anuncie una baliza BLE.
 * El receptor la verifica con el secreto del grupo; no hay servidor ni rastreo externo.
 */
export async function ringCommand(trip, { byDeviceId, targetDeviceId, now, ttlS = 300 }) {
  if (!trip.devices.has(byDeviceId) || !trip.devices.has(targetDeviceId)) return { ok: false, error: 'dispositivos fuera del grupo' };
  const body = `ring:${trip.tripId}:${targetDeviceId}:${now}:${now + ttlS}`;
  return { ok: true, cmd: { body, mac: await hmac(trip.secret, body) } };
}
export async function verifyRing(trip, cmd, { deviceId, now }) {
  const [kind, tripId, target, , exp] = cmd.body.split(':');
  if (kind !== 'ring' || tripId !== trip.tripId || target !== deviceId) return { ok: false, error: 'no es para este dispositivo' };
  if (now > +exp) return { ok: false, error: 'orden caducada' };
  if (!constantTimeEqual(String(cmd.mac ?? ''), await hmac(trip.secret, cmd.body))) return { ok: false, error: 'firma no válida' };
  return { ok: true, action: 'RING_AND_BEACON', note: 'Sonar al máximo, linterna intermitente y anuncio BLE para búsqueda por proximidad.' };
}
/** Distancia aproximada por RSSI BLE (modelo log-distancia; muy ruidoso: solo «más cerca / más lejos»). */
export function rssiDistanceM(rssi, { txPower, n } = {}) {
  if (!Number.isFinite(rssi)) return null;
  if (!Number.isFinite(txPower) || !Number.isFinite(n)) return { metres: null, quality: 'CALIBRACIÓN NO DECLARADA (txPower a 1 m y exponente n se miden por dispositivo)' };
  return { metres: +(10 ** ((txPower - rssi) / (10 * n))).toFixed(1), quality: 'ORIENTATIVA (±50 % o peor)' };
}

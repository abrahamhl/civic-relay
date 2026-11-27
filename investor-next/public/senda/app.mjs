/**
 * SENDA Campo — aplicación offline-first.
 * Toda la lógica crítica (cifrado, sobres, almacenamiento-transporte, módem acústico)
 * es el núcleo probado de packages/senda copiado sin cambios en ./core.
 */
import { b64, unb64 } from './core/b64.mjs';
import { generateIdentity, exportIdentity, importIdentity, sealMessage, openMessage, packEnvelope, unpackEnvelope, packContact, unpackContact } from './core/envelope.mjs';
import { packRich, unpackRich, isRich, MAX_TEXT_CHARS, MAX_IMAGE_BYTES } from './core/message-media.mjs';
import { createBundleStore, exportBundleFile, importBundleFile } from './core/bundle.mjs';
import { parseUsgs, SOURCES } from './core/feeds.mjs';
import { zoneFromQuake, relayActivation, createConsentProfile } from './core/zones.mjs';
import { detectCrash, crashResponsePolicy, buildIncidentReport, fuseIncidentReports, emergencyBrief, G } from './core/rail-incident.mjs';
import * as kv from './db.mjs';
import { emit, listen, decodeSamples } from './audio.mjs';
import { initCoordination } from './coord.mjs';
import { initNostr, PUBLIC_EXTRA_RELAYS, SENDA_SERVERS } from './nostr-link.mjs';
import { prewrap } from './core/nostr-mailbox.mjs';

const $ = (s) => document.querySelector(s);
const now = () => Date.now();
const S = { me: null, name: '', contacts: [], inbox: [], sent: [], chat: null, store: null, consent: null, zones: [], pos: null, listening: null };
window.SENDA_TEST = { lastEmission: null, state: S };

/* ---------------- utilidades de interfaz ---------------- */
function toast(t, ms = 2600) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms); }
function ask(text, value = '') { const d = $('#dlg'); $('#dlg-text').textContent = text; $('#dlg-input').value = value; d.showModal(); return new Promise((r) => d.addEventListener('close', () => r(d.returnValue === 'ok' ? $('#dlg-input').value.trim() : null), { once: true })); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nameOf = (fp) => S.contacts.find((c) => c.fingerprint === fp)?.name ?? (fp === S.me?.publicIdentity.fingerprint ? 'tú' : `${fp.slice(0, 6)}…`);
function show(tab) {
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== tab));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  render();
}

/* ---------------- persistencia ---------------- */
async function persist() {
  await kv.set('store', S.store.snapshot());
  await kv.set('contacts', S.contacts);
  await kv.set('inbox', S.inbox);
  await kv.set('sent', S.sent);
  await kv.set('consent', S.consent);
  await kv.set('msglog', S.log ?? []);
}

async function boot() {
  const saved = await kv.get('identity');
  if (!saved) { $('#onboard').hidden = false; return; }
  S.me = await importIdentity(saved.keys); S.name = saved.name;
  S.contacts = (await kv.get('contacts')) ?? [];
  S.inbox = (await kv.get('inbox')) ?? [];
  S.sent = (await kv.get('sent')) ?? [];
  S.log = (await kv.get('msglog')) ?? [];
  S.consent = (await kv.get('consent')) ?? null;
  S.zones = (await kv.get('zones')) ?? [];
  S.store = createBundleStore({ owner: S.me.publicIdentity.fingerprint });
  const snap = await kv.get('store'); if (snap) S.store.restore(snap, { now: now() });
  S.store.purgeExpired(now());
  await CO.load();
  for (const b of S.store.listBroadcasts()) await CO.handleBroadcast(b, 'almacenado');
  CO.startAutoRelay(); // si hay relés configurados, sube y baja solo cada vez que haya red
  S.net = (await kv.get('net')) ?? { servers: SENDA_SERVERS, publicExtra: true };
  NOSTR.start(); // red descentralizada: buzones cifrados y cegados en varios relés Nostr públicos
  if (await kv.get('easyOnly')) { document.body.classList.add('easy-only'); $('#easy-only').checked = true; }
  $('#tabs').hidden = false; show('home');
}

$('#ob-go').addEventListener('click', async () => {
  const name = $('#ob-name').value.trim() || 'Sin nombre';
  const id = await generateIdentity();
  S.consent = createConsentProfile({ termsVersion: 'senda-campo-1', relayInDeclaredZones: $('#ob-relay').checked, acceptedAt: new Date().toISOString() });
  await kv.set('identity', { name, keys: await exportIdentity(id) });
  await kv.set('consent', S.consent);
  $('#onboard').hidden = true; await boot(); toast('Identidad creada. Tus claves no salen de este teléfono.');
});

/* ---------------- recepción universal ---------------- */
/** Cualquier cosa recibida (sonido, texto, archivo) entra por aquí. */
async function receiveBytes(bytes, via) {
  if (bytes[0] === 0xc1) {
    const c = await unpackContact(bytes);
    if (c.fingerprint === S.me.publicIdentity.fingerprint) return toast('Es tu propia tarjeta');
    if (!S.contacts.some((x) => x.fingerprint === c.fingerprint)) { S.contacts.push({ ...c, addedVia: via, addedAt: now() }); NOSTR.contactsChanged(); }
    await persist(); render(); return toast(`Contacto añadido: ${c.name}`);
  }
  if (bytes[0] === 0xe2) return receiveEnvelope(unpackEnvelope(bytes), via);
  throw new Error('Formato no reconocido');
}

async function receiveEnvelope(env, via) {
  if (env.header.to === S.me.publicIdentity.fingerprint) {
    if (S.inbox.some((m) => m.id === env.header.id)) { logEv({ ev: 'DUPLICADO', id: env.header.id, via }); return toast('Ya lo tenías (duplicado descartado)'); }
    const m = await openMessage({ recipient: S.me, envelope: env, now: now() });
    let rich = null; if (m.body instanceof Uint8Array && isRich(m.body)) { rich = unpackRich(m.body); m.body = rich.text; }
    const sender = S.contacts.find((c) => c.signPub.x === m.from.x && c.signPub.y === m.from.y);
    let incident = null;
    if (typeof m.body === 'string' && m.body.startsWith(INCIDENT_PREFIX)) { try { incident = JSON.parse(m.body.slice(INCIDENT_PREFIX.length).split('\n')[0]); } catch { /* texto libre */ } }
    const coordText = typeof m.body === 'string' && m.body.startsWith(CO.RESPONSE_PREFIX) ? CO.onResponseMessage(m.body, m.from) : null;
    S.inbox.unshift({ id: env.header.id, fromFp: sender?.fingerprint ?? null, from: sender?.name ?? (coordText ? 'Residente (firma válida)' : 'Desconocido (firma válida)'), body: incident ? humanIncident(incident) : coordText ?? m.body, kind: env.header.kind, at: now(), via, incident, coordination: !!coordText, img: rich?.image ? await toDataUrl(rich.image) : null, createdAt: rich?.createdAt ?? null });
    logEv({ ev: 'RECIBIDO', id: env.header.id, via, bytes: packEnvelope(env).length, createdAt: rich?.createdAt ?? null, receivedAt: now(), latencyMs: rich?.createdAt ? now() - rich.createdAt : null, withImage: !!rich?.image, from: sender?.name ?? null });
    await S.store.acceptReceipt(m.receipt); // el recibo viajará y borrará copias en otros teléfonos
    NOSTR.sendReceipt(m.receipt, sender?.fingerprint); // y llega al remitente en segundos si hay Internet
    await persist(); render(); return toast(`Mensaje de ${sender?.name ?? 'desconocido'} vía ${via}`);
  }
  const act = relayActivation({ zones: S.zones, position: S.pos ?? { lat: 0, lon: 0 }, consent: S.consent, now: now() });
  if (!S.consent?.relayInDeclaredZones) return toast('No tienes activado el transporte para otros');
  const r = S.store.put(env, { now: now(), copies: 4 });
  await persist(); render();
  toast(r.stored ? `Transportando mensaje cifrado para ${env.header.to.slice(0, 6)}… (${act.mode})` : `No guardado: ${r.reason}`);
}

/* ---------------- acciones ---------------- */
// Bluetooth cercano (puente nativo de la app Android: BleMailbox). En la web no existe.
const hasBle = () => typeof window.SendaNative?.p2pSend === 'function';
// Contacto elegido en la agenda de Android (sin permiso de leer la agenda: solo el que el usuario toca).
window.sendaContact = (c) => {
  if (!c?.phone) return toast(c?.error ? 'No se pudo leer el contacto' : 'Cancelado');
  const card = 'SENDA:' + b64(packContact(S.me.publicIdentity, S.name));
  const text = `${S.name} te invita a SENDA (mensajes de emergencia que llegan sin red). Abre la app y pega este código en Contactos: ${card}`;
  location.href = `sms:${encodeURIComponent(c.phone)}?&body=${encodeURIComponent(text)}`;
};
window.sendaP2P = (ev) => {
  if (ev.event === 'status') { const el = $('#ble-status'); if (el) el.textContent = ev.text; return; }
  if (ev.event === 'received') {
    const bytes = unb64(ev.b64);
    if (bytes[0] === 0xa5) { // paquete de avisos de carretera (hazard-share): se guarda para Conducir y Ruta
      import('./core/hazard-share.mjs').then(({ unpackReports, mergeReports }) => {
        const key = 'senda.ruta.reports'; let cur = []; try { cur = JSON.parse(localStorage.getItem(key)) ?? []; } catch { /* */ }
        const { reports: got } = unpackReports(bytes); const m = mergeReports(cur, got);
        try { localStorage.setItem(key, JSON.stringify(m.reports)); } catch { /* */ }
        toast(`Avisos de carretera recibidos: ${m.added} nuevos (sin verificar). Míralos en Conducir.`);
      }).catch((err) => toast('Paquete de avisos no válido: ' + err.message));
      return;
    }
    const run = bytes[0] === 0x7b ? receiveText(new TextDecoder().decode(bytes), 'BLUETOOTH') : receiveBytes(bytes, 'BLUETOOTH'); // «{» = paquete .senda
    run.then(() => persist()).catch((err) => toast('Recibido por Bluetooth, pero no se pudo abrir: ' + err.message));
  }
};
document.addEventListener('click', (e) => { const li = e.target.closest('[data-chat]'); if (li) { S.chat = li.dataset.chat; render(); } });
const ACTIONS = {
  async 'chat-back'() { S.chat = null; render(); },
  async 'pick-contact'() {
    if (typeof window.SendaNative?.pickContact !== 'function') return toast('Elegir contactos del móvil solo funciona en la app de Android');
    window.SendaNative.pickContact();
  },
  async 'net-save'() { await NOSTR.configure({ servers: $('#net-servers').value.trim(), publicExtra: $('#net-public').checked }); },
  async 'ble-open'() { if (!hasBle()) return toast('El Bluetooth cercano solo funciona en la app de Android'); window.SendaNative.p2pStart(); },
  async 'ble-send'() {
    if (!hasBle()) return toast('El Bluetooth cercano solo funciona en la app de Android');
    const items = outgoing(), sum = S.store.summary();
    if (!items.length && !sum.receipts.length && !sum.pendingReceipts.length && !sum.broadcasts.length) return toast('Nada pendiente de enviar');
    // Un solo envío (mensajes + recibos de entrega + alertas) con el paquete completo (todos los sobres pendientes): menos conexiones, menos espera.
    const text = exportBundleFile(S.store, { now: now() });
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > 64 * 1024) return toast('Demasiado para Bluetooth de una vez: usa «Compartir paquete»');
    window.SendaNative.p2pSend(b64(bytes)); logEv({ ev: 'ENVIADO', via: 'BLUETOOTH', ids: items.map((i) => i.id), bytes: bytes.length });
  },
  async 'card-sound'() { toast('Emitiendo tu tarjeta…', 8000); await emit(packContact(S.me.publicIdentity, S.name), { canvas: $('#scope') }); toast('Tarjeta emitida'); },
  async 'card-copy'() { await copy('SENDA:' + b64(packContact(S.me.publicIdentity, S.name))); },
  async 'card-file'() { await shareFile(`${S.name}.sendacard`, 'SENDA:' + b64(packContact(S.me.publicIdentity, S.name)), 'text/plain'); },
  async paste() {
    const t = await ask('Pega el código SENDA (empieza por «SENDA:») o el contenido de un paquete .senda');
    if (t) await receiveText(t, 'texto');
  },
  async listen() {
    if (S.listening) { S.listening.stop(); return; }
    $('#audio-status').textContent = 'Escuchando… acerca el otro teléfono y pulsa «Emitir» allí.';
    try {
      S.listening = await listen({ maxS: 90, canvas: $('#scope'), onPayload: (b) => receiveBytes(b, 'sonido').catch((e) => toast(e.message)) });
      const n = await S.listening.done; S.listening = null;
      $('#audio-status').textContent = n ? `Recibido por sonido: ${n}` : 'No se detectó ninguna transmisión.';
    } catch (e) { S.listening = null; toast('Micrófono no disponible: ' + e.message); }
  },
  async emit() {
    const items = outgoing();
    if (!items.length) return toast('Nada pendiente de enviar');
    const env = S.store.get(items[0].id);
    $('#audio-status').textContent = `Emitiendo ${packEnvelope(env).length} bytes cifrados (prioridad ${env.header.priority})…`;
    const t0 = now(); await emit(packEnvelope(env), { canvas: $('#scope') }); logEv({ ev: 'ENVIADO', via: 'SONIDO', ids: [items[0].id], bytes: packEnvelope(env).length, durationMs: now() - t0 });
    $('#audio-status').textContent = 'Emitido. Si el otro teléfono lo recibió, verás su recibo en la próxima sincronización.';
  },
  async 'bundle-share'() {
    const text = exportBundleFile(S.store, { now: now() }); logEv({ ev: 'ENVIADO', via: 'PAQUETE_COMPARTIDO', ids: outgoing().map((i) => i.id), bytes: text.length });
    await persist(); await shareFile(`senda-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.senda`, text, 'application/json');
  },
  async sms() {
    const it = outgoing()[0]; if (!it) return toast('Nada pendiente');
    const sms = 'SENDA:' + b64(packEnvelope(S.store.get(it.id))); logEv({ ev: 'ENVIADO', via: 'SMS', ids: [it.id], chars: sms.length }); await persist();
    location.href = `sms:?&body=${encodeURIComponent(sms)}`;
  },
  async 'text-copy'() { const it = outgoing()[0]; if (!it) return toast('Nada pendiente'); const t = 'SENDA:' + b64(packEnvelope(S.store.get(it.id))); logEv({ ev: 'ENVIADO', via: 'TEXTO_COPIADO', ids: [it.id], chars: t.length }); await persist(); await copy(t); },
  async 'log-export'() {
    const doc = { format: 'senda-registro-mensajes/1', exportedAt: new Date().toISOString(), device: S.name, note: 'Latencias con los relojes de cada móvil: activad la hora automática en los dos. Sin contenido de los mensajes.', events: S.log ?? [] };
    await shareFile(`senda-registro-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`, JSON.stringify(doc, null, 1), 'application/json');
  },
  async attach() { $('#attach-file').click(); },
  async 'attach-clear'() { S.pendingImg = null; $('#attach-preview').hidden = true; },
  async feeds() {
    if (!navigator.onLine) return toast('Sin red: se usan las últimas fuentes guardadas');
    try {
      const r = await fetch(SOURCES.USGS_ALL_HOUR.replace('all_hour', '4.5_day'));
      S.zones = parseUsgs(await r.json()).map((e) => zoneFromQuake(e));
      await kv.set('zones', S.zones); await kv.set('feedsAt', now()); render(); toast(`Fuentes actualizadas: ${S.zones.length} zonas sísmicas`);
    } catch (e) { toast('No se pudo actualizar: ' + e.message); }
  },
};

function outgoing() { return S.store.list().filter((i) => i.to !== S.me.publicIdentity.fingerprint).sort((a, b) => a.priority - b.priority || a.expiresAt - b.expiresAt); }

async function receiveText(t, via) {
  t = t.trim();
  if (t.startsWith('{')) { const r = await importBundleFile(S.store, t, { now: now() }); for (const e of r.forMe) await receiveEnvelope(e, via); for (const b of r.newBroadcasts ?? []) await CO.handleBroadcast(b, via); await persist(); render(); if (r.stored.length) { CO.relayNow(); NOSTR.flush(); } return toast(`Paquete: ${r.forMe.length} para ti, ${r.stored.length} en tránsito${r.newBroadcasts?.length ? `, ${r.newBroadcasts.length} alerta(s)` : ''}`); }
  const m = t.match(/SENDA:([A-Za-z0-9_-]+)/); if (!m) return toast('No es un código SENDA');
  await receiveBytes(unb64(m[1]), via);
}

async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copiado'); } catch { await ask('Copia este código:', text); } }
async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'SENDA' }); return; } catch { /* cancelado */ } }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: name }); a.click(); toast('Archivo guardado');
}

async function sendMessage() {
  const to = S.contacts.find((c) => c.fingerprint === $('#to').value);
  const body = $('#body').value.trim(), img = S.pendingImg; if (!to || (!body && !img)) return toast('Elige contacto y escribe algo o adjunta una foto');
  if ([...body].length > MAX_TEXT_CHARS) return toast(`Máximo ${MAX_TEXT_CHARS} caracteres`);
  const prio = +$('#prio').value, createdAt = now();
  const rich = packRich({ text: body, createdAt, image: img ? { mime: img.mime, bytes: img.bytes } : null });
  const env = await sealMessage({ sender: S.me, recipient: to, body: rich, priority: prio, ttlS: 7 * 86400, now: createdAt, kind: prio === 0 ? 'SOS' : 'PERSONAL' });
  await putOwn(env, to, 8);
  S.sent.unshift({ id: env.header.id, toFp: to.fingerprint, body, kind: prio === 0 ? 'SOS' : 'PERSONAL', at: createdAt, img: img?.url ?? null });
  logEv({ ev: 'CIFRADO', id: env.header.id, to: to.name, createdAt, bytes: packEnvelope(env).length, textChars: [...body].length, imageBytes: img?.bytes.length ?? 0, cipher: 'ECDH P-256 efímero → HKDF-SHA-256 → AES-256-GCM · firma ECDSA P-256' });
  CO.relayNow(); // con red y relé configurado, sale ya hacia el otro país
  setTimeout(() => NOSTR.flush(), 0); // y por la red descentralizada, si hay Internet
  S.pendingImg = null; $('#attach-preview').hidden = true;
  await persist(); $('#body').value = ''; $('#body-count').textContent = `0/${MAX_TEXT_CHARS}`; render();
  toast(NOSTR.active() && navigator.onLine !== false ? 'Cifrado y enviado por Internet (red SENDA). Si no hay red, sale solo al volver o por Bluetooth, SMS o sonido.' : 'Cifrado y en camino. Sin Internet: envíalo por Bluetooth, SMS o sonido, o deja que otros lo lleven.');
}

/* Modo fácil: un toque = estado + posición cifrados a todos los contactos. */
const QUICK = { OK: 'ESTOY BIEN', NEED_HELP: 'NECESITO AYUDA', TRAPPED: 'ESTOY ATRAPADO' };
async function quickStatus(status) {
  if (!S.contacts.length) { toast('Añade primero un contacto (pestaña Contactos).', 5000); show('contacts'); return null; }
  const where = S.pos ? `${S.pos.lat.toFixed(5)},${S.pos.lon.toFixed(5)}` : 'posición desconocida';
  const urgent = status !== 'OK';
  const body = `${QUICK[status]} · ${S.name} · ${where} · ${new Date().toLocaleString()}`;
  for (const c of S.contacts) await putOwn(await sealMessage({ sender: S.me, recipient: c, body, priority: urgent ? 0 : 3, ttlS: 3 * 86400, now: now(), kind: urgent ? 'SOS' : 'HUMAN_STATUS' }), c, 16);
  S.lastQuick = { status, body, at: now() }; await persist(); render();
  toast(`«${QUICK[status]}» cifrado para ${S.contacts.length} contacto(s).${urgent ? ' Emítelo o compártelo ya.' : ''}`, 5000);
  if (urgent) show('transfer');
  return S.lastQuick;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-quick]'); if (b) quickStatus(b.dataset.quick).catch((err) => toast(err.message)); });
document.addEventListener('change', async (e) => { if (e.target.id === 'easy-only') { document.body.classList.toggle('easy-only', e.target.checked); await kv.set('easyOnly', e.target.checked); } });

async function sos() {
  if (!S.contacts.length) return toast('Añade al menos un contacto primero');
  let where = 'posición no disponible';
  try { const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }));
    S.pos = { lat: p.coords.latitude, lon: p.coords.longitude }; where = `${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)} ±${Math.round(p.coords.accuracy)} m`; } catch { /* GPS no disponible */ }
  for (const c of S.contacts) await putOwn(await sealMessage({ sender: S.me, recipient: c, body: `SOS · ${S.name} necesita ayuda · ${where} · ${new Date().toLocaleString()}`, priority: 0, ttlS: 3 * 86400, now: now(), kind: 'SOS' }), c, 16);
  await persist(); render(); toast(`SOS cifrado para ${S.contacts.length} contacto(s). Emítelo o compártelo ya.`, 5000); show('transfer');
}


/* ---------------- modo viaje: detección de accidente ---------------- */
const INCIDENT_PREFIX = 'SENDA-INCIDENTE ';
const STATUS_ES = { OK: 'está bien', HELPING_OTHERS: 'está bien y ayuda a otros', NEED_HELP: 'NECESITA AYUDA', INJURED_SERIOUS: 'HERIDO GRAVE', TRAPPED: 'ATRAPADO', NO_RESPONSE: 'SIN RESPUESTA tras el impacto' };
const humanIncident = (r) => `🚨 Accidente${r.train ? ' en ' + r.train : ''}${r.coach ? ', coche ' + r.coach : ''}: ${STATUS_ES[r.status]}${r.nearbyInjured ? ` · ${r.nearbyInjured} herido(s) cerca` : ''} · ${r.lat.toFixed(5)},${r.lon.toFixed(5)}`;
S.trip = { active: false, motion: [], gps: [], pending: false, watch: null };
const tnow = () => performance.now() / 1000;

function onMotion(e) {
  const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
  const s = { t: tnow(), ax: a.x, ay: a.y, az: a.z };
  S.trip.motion.push(s); const cut = s.t - 120; while (S.trip.motion.length && S.trip.motion[0].t < cut) S.trip.motion.shift();
  if (!S.trip.pending && Math.abs(Math.hypot(s.ax, s.ay, s.az) - G) / G >= 2.5) { S.trip.pending = true; setTimeout(evaluateCrash, 9000); }
}
function onGps(p) {
  const c = p.coords; S.pos = { lat: c.latitude, lon: c.longitude };
  S.trip.gps.push({ t: tnow(), speed: c.speed ?? 0, lat: c.latitude, lon: c.longitude, heading: c.heading, accuracy: c.accuracy });
  const cut = tnow() - 300; while (S.trip.gps.length && S.trip.gps[0].t < cut) S.trip.gps.shift();
}

async function toggleTrip() {
  if (S.trip.active) {
    removeEventListener('devicemotion', onMotion); if (S.trip.watch != null) navigator.geolocation.clearWatch(S.trip.watch);
    S.trip.active = false; $('#trip-toggle').textContent = 'Activar'; $('#trip-state').textContent = 'Modo viaje desactivado.'; return;
  }
  try { if (typeof DeviceMotionEvent?.requestPermission === 'function') await DeviceMotionEvent.requestPermission(); } catch { /* iOS rechazado */ }
  addEventListener('devicemotion', onMotion);
  if (navigator.geolocation) S.trip.watch = navigator.geolocation.watchPosition(onGps, () => {}, { enableHighAccuracy: true, maximumAge: 1000 });
  S.trip.train = $('#trip-train').value.trim() || null; S.trip.coach = $('#trip-coach').value.trim() || null;
  S.trip.active = true; $('#trip-toggle').textContent = 'Desactivar';
  $('#trip-state').textContent = `Vigilando${S.trip.train ? ' ' + S.trip.train : ''}${S.trip.coach ? ', coche ' + S.trip.coach : ''}. Funciona sin red; mantén la app abierta.`;
}

async function evaluateCrash() {
  const det = detectCrash({ motion: S.trip.motion, gps: S.trip.gps });
  const pol = crashResponsePolicy(det);
  if (!pol.prompt) { S.trip.pending = false; return det; }
  showCrashPrompt(det, pol); return det;
}

function showCrashPrompt(det, pol) {
  const box = $('#crash'); box.hidden = false;
  $('#crash-why').textContent = det.reasons.join(' · ');
  $('#crash-opts').innerHTML = pol.options.map(([k, label]) => `<button data-st="${k}">${label}</button>`).join('');
  let left = window.SENDA_TEST.countdownS ?? pol.countdownS; $('#crash-count').textContent = left;
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  const finish = (status) => { clearInterval(timer); box.hidden = true; S.trip.pending = false; sendIncident(det, status).catch((e) => toast(e.message)); };
  const timer = setInterval(() => { left--; $('#crash-count').textContent = left; if (left <= 0) finish(pol.onTimeout); }, 1000);
  $('#crash-opts').onclick = (e) => { const b = e.target.closest('[data-st]'); if (b) finish(b.dataset.st); };
}

async function sendIncident(det, status) {
  const last = S.trip.gps[S.trip.gps.length - 1] ?? {};
  const before = S.trip.gps.filter((f) => det.at == null || f.t <= det.at).pop() ?? last;
  const report = buildIncidentReport({ reporterId: S.me.publicIdentity.fingerprint, detection: det, status, at: now() / 1000,
    position: { lat: last.lat ?? S.pos?.lat ?? 0, lon: last.lon ?? S.pos?.lon ?? 0, accuracyM: last.accuracy, headingDeg: before.heading ?? null, speedBeforeMs: before.speed ?? null },
    trip: { train: S.trip.train, coach: S.trip.coach }, nearbyInjured: +$('#crash-near').value || 0 });
  const body = INCIDENT_PREFIX + JSON.stringify(report); // compacto: el receptor lo muestra legible
  const urgent = status !== 'OK' && status !== 'HELPING_OTHERS';
  for (const c of S.contacts) await putOwn(await sealMessage({ sender: S.me, recipient: c, body, priority: urgent ? 0 : 3, ttlS: 3 * 86400, now: now(), kind: urgent ? 'SOS' : 'HUMAN_STATUS' }), c, 16);
  S.lastIncident = report; await persist(); render();
  toast(urgent ? 'Aviso de accidente cifrado para tus contactos. Emítelo o compártelo; viaja también por otros teléfonos.' : 'Aviso «estoy bien» preparado para tu familia.', 6000);
  if (urgent) show('transfer');
  return report;
}

/* ---------------- render ---------------- */
function renderChats() {
  const conv = S.contacts.map((c) => {
    const msgs = [...S.inbox.filter((m) => m.fromFp ? m.fromFp === c.fingerprint : m.from === c.name).map((m) => ({ ...m, dir: 'in' })),
      ...S.sent.filter((m) => m.toFp === c.fingerprint).map((m) => ({ ...m, dir: 'out' }))].sort((a, b) => a.at - b.at);
    return { c, msgs, last: msgs.at(-1) };
  }).sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));
  const hhmm = (t) => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  $('#chats').innerHTML = conv.map(({ c, last }) => `<li data-chat="${esc(c.fingerprint)}"><span class="av">${esc((c.name || '?').slice(0, 1).toUpperCase())}</span><span class="t"><b>${esc(c.name)}</b><small>${last ? esc((last.dir === 'out' ? 'Tú: ' : '') + last.body) : 'Sin mensajes todavía'}</small></span>${last ? `<time>${hhmm(last.at)}</time>` : ''}</li>`).join('')
    || '<li class="fine">Aún no tienes contactos SENDA. Intercambiad tarjetas en «Contactos» o invita a alguien.</li>';
  const open = S.chat && conv.find((x) => x.c.fingerprint === S.chat);
  $('#chat-list').hidden = !!open; $('#chat-thread').hidden = !open;
  if (!open) return;
  $('#thread-name').textContent = open.c.name; $('#to').value = open.c.fingerprint;
  const carried = new Set(S.store.list().map((i) => i.id));
  const delivered = new Set(S.store.summary().receipts); // recibos verificados criptográficamente (el destinatario abrió el sobre)
  $('#bubbles').innerHTML = open.msgs.map((m) => `<li class="${m.dir}${m.kind === 'SOS' ? ' sos' : ''}">${m.img ? `<img class="bimg" src="${esc(m.img)}" alt="Foto adjunta">` : ''}${esc(m.body)}<span class="meta">${hhmm(m.at)}${m.dir === 'out' ? (delivered.has(m.id) ? ' · ✓✓ entregado' : carried.has(m.id) ? ' · ✓ en camino' : ' · salió de este móvil') : ` · vía ${esc(m.via ?? '')}`}</span></li>`).join('')
    || '<li class="in">Escribe el primer mensaje. Viaja cifrado: solo lo abre su destinatario.</li>';
}

function render() {
  if (!S.me) return;
  if ($('#net-servers') && document.activeElement?.id?.startsWith('net-') !== true) { $('#net-servers').value = S.net?.servers ?? ''; $('#net-public').checked = S.net?.publicExtra !== false; NOSTR.paint(); }
  renderChats();
  $('#me-name').textContent = S.name; $('#me-fp').textContent = S.me.publicIdentity.fingerprint;
  $('#st-inbox').textContent = S.inbox.length; $('#st-carry').textContent = S.store.count(); $('#st-contacts').textContent = S.contacts.length;
  $('#contact-list').innerHTML = S.contacts.map((c) => `<li><b>${esc(c.name)}</b><div class="meta">${c.fingerprint} · vía ${esc(c.addedVia ?? '')}</div></li>`).join('') || '<li class="fine">Sin contactos. Intercambiad tarjetas por sonido o código.</li>';
  $('#to').innerHTML = S.contacts.map((c) => `<option value="${c.fingerprint}">${esc(c.name)}</option>`).join('');
  $('#inbox').innerHTML = S.inbox.map((m) => `<li class="${m.kind === 'SOS' ? 'is-sos' : ''}"><b>${esc(m.from)}</b> <span class="meta">${m.kind} · vía ${esc(m.via)} · ${new Date(m.at).toLocaleString()}</span><div>${esc(m.body)}</div></li>`).join('') || '<li class="fine">Nada todavía.</li>';
  $('#carry').innerHTML = S.store.list().map((i) => `<li><span class="meta">para ${esc(nameOf(i.to))} · prioridad ${i.priority} · ${i.kind} · copias ${i.copies} · caduca ${new Date(i.expiresAt).toLocaleDateString()}</span></li>`).join('') || '<li class="fine">Nada en tránsito.</li>';
  const act = relayActivation({ zones: S.zones, position: S.pos ?? { lat: 0, lon: 0 }, consent: S.consent, now: now() });
  $('#relay-state').textContent = { OFF: 'Fuera de zona declarada', STANDBY: 'En espera', RELAY_ACTIVE: 'Relé ACTIVO' }[act.mode] + ' — ' + act.reason;
  $('#relay-consent').checked = !!S.consent?.relayInDeclaredZones;
  const incidents = S.inbox.filter((m) => m.incident).map((m) => m.incident);
  $('#incidents').textContent = incidents.length ? emergencyBrief(fuseIncidentReports(incidents)) || `${incidents.length} informe(s); hacen falta 2 por emplazamiento para fusionar.` : 'Sin informes.';
  CO.renderCoord();
  $('#zones').innerHTML = S.zones.slice(0, 20).map((z) => `<li><b>${esc(z.event)}</b><div class="meta">${z.provider} · radio ${z.circle.radiusKm} km (modelo) · hasta ${new Date(z.expiresAt).toLocaleString()}</div></li>`).join('') || '<li class="fine">Sin zonas guardadas.</li>';
}

function netBadge() {
  const on = navigator.onLine; const el = $('#net');
  el.textContent = on ? 'con red' : 'SIN RED'; el.className = 'pill ' + (on ? 'ok' : 'off');
}

/* ---------------- arranque ---------------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (b) { ACTIONS[b.dataset.act]?.().catch((err) => toast(err.message)); }
  const t = e.target.closest('[data-tab]'); if (t) show(t.dataset.tab);
});
$('#send').addEventListener('click', () => sendMessage().catch((e) => toast(e.message)));
$('#sos').addEventListener('click', () => sos().catch((e) => toast(e.message)));
$('#trip-toggle').addEventListener('click', () => toggleTrip().catch((e) => toast(e.message)));
$('#relay-consent').addEventListener('change', async (e) => { S.consent = createConsentProfile({ ...(S.consent ?? { termsVersion: 'senda-campo-1' }), acceptedAt: new Date().toISOString(), relayInDeclaredZones: e.target.checked }); await persist(); render(); });
for (const id of ['#card-file', '#bundle-file']) $(id).addEventListener('change', async (e) => { for (const f of e.target.files) await receiveText(await f.text(), 'archivo').catch((err) => toast(err.message)); e.target.value = ''; });
addEventListener('online', netBadge); addEventListener('offline', netBadge); netBadge();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/senda-sw.js', { scope: '/senda' }).then(() => navigator.serviceWorker.ready).then(() => { $('#sw').textContent = 'instalada offline'; $('#sw').className = 'pill ok'; })
    .catch(() => { $('#sw').textContent = 'sin modo offline'; $('#sw').className = 'pill off'; });
}

/* Coordinación (residente / coordinador / relé) */
const CO = initCoordination({ S, kv, $, toast, persist, render: () => render(), esc, ask, copy, receiveEnvelope: (e, v) => receiveEnvelope(e, v), log: (e) => logEv(e) });
const NOSTR = initNostr({ S, kv, $, toast, receiveEnvelope: (e, v) => receiveEnvelope(e, v), log: (e) => logEv(e), render: () => render() });

/* Ganchos para pruebas automáticas (sin efecto para el usuario). */
Object.assign(window.SENDA_TEST, {
  ready: boot(),
  receiveText: (t) => receiveText(t, 'prueba'),
  ingestSamples: async (arr, sr) => { const r = decodeSamples(Float32Array.from(arr), sr); if (!r) throw new Error('sin trama'); await receiveBytes(r.payload, 'sonido'); return r.payload.length; },
  myCard: () => 'SENDA:' + b64(packContact(S.me.publicIdentity, S.name)),
  exportBundle: () => exportBundleFile(S.store, { now: now() }),
  emitTop: () => ACTIONS.emit(),
  countdownS: null,
  tripFeed: async ({ motion, gps, train = null, coach = null }) => { S.trip = { ...S.trip, active: true, motion, gps, train, coach, pending: true }; return evaluateCrash(); },
  lastIncident: () => S.lastIncident ?? null,
  alertCountdownS: null,
  co: () => CO,
  lastResponse: () => S.lastResponse ?? null,
  quick: (st) => quickStatus(st),
  log: () => S.log ?? [],
  inbox: () => S.inbox,
});


/* ---------------- fotos y registro de pruebas ---------------- */
/** Guarda un sobre propio con su evento exterior ya preparado (sin red): quien llegue antes a Internet lo publica tal cual. */
async function putOwn(env, contact, copies) {
  let wrap = null; try { wrap = await prewrap({ identity: S.me, contact, envelope: env, nowMs: now() }); } catch { /* sin evento exterior: viaja igual por las demás vías */ }
  return S.store.put(env, { now: now(), copies, wrap });
}
function logEv(e) { (S.log ??= []).push({ t: now(), ...e }); if (S.log.length > 3000) S.log.shift(); }
async function toDataUrl(image) { const blob = new Blob([image.bytes], { type: image.mime }); return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); }); }
/** Foto → WebP (o JPEG si el móvil no sabe WebP) de ≤ 12 KB, bajando tamaño y calidad hasta que quepa. */
async function compressImage(file) {
  const bmp = await createImageBitmap(file), c = document.createElement('canvas');
  for (const [side, q] of [[480, 0.55], [400, 0.5], [320, 0.45], [256, 0.4], [200, 0.35], [160, 0.3]]) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height)); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    for (const mime of ['image/webp', 'image/jpeg']) {
      const blob = await new Promise((ok) => c.toBlob(ok, mime, q)); if (!blob || blob.type !== mime) continue;
      if (blob.size <= MAX_IMAGE_BYTES) return { mime, bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
      break;
    }
  }
  throw new Error('No se pudo dejar la foto en 12 KB');
}
$('#attach-file')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  try { const im = await compressImage(f); im.url = await toDataUrl(im); S.pendingImg = im; $('#attach-img').src = im.url; $('#attach-info').textContent = `${im.w}×${im.h} · ${(im.bytes.length / 1024).toFixed(1)} KB cifrados`; $('#attach-preview').hidden = false; }
  catch (err) { toast(err.message); }
});
$('#body')?.addEventListener('input', () => { const n = [...$('#body').value].length; $('#body-count').textContent = `${n}/${MAX_TEXT_CHARS}`; $('#body-count').classList.toggle('over', n > MAX_TEXT_CHARS); });

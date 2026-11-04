/**
 * SENDA Campo — aplicación offline-first.
 * Toda la lógica crítica (cifrado, sobres, almacenamiento-transporte, módem acústico)
 * es el núcleo probado de packages/senda copiado sin cambios en ./core.
 */
import { b64, unb64 } from './core/b64.mjs';
import { generateIdentity, exportIdentity, importIdentity, sealMessage, openMessage, packEnvelope, unpackEnvelope, packContact, unpackContact } from './core/envelope.mjs';
import { createBundleStore, exportBundleFile, importBundleFile } from './core/bundle.mjs';
import { parseUsgs, SOURCES } from './core/feeds.mjs';
import { zoneFromQuake, relayActivation, createConsentProfile } from './core/zones.mjs';
import * as kv from './db.mjs';
import { emit, listen, decodeSamples } from './audio.mjs';

const $ = (s) => document.querySelector(s);
const now = () => Date.now();
const S = { me: null, name: '', contacts: [], inbox: [], store: null, consent: null, zones: [], pos: null, listening: null };
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
  await kv.set('consent', S.consent);
}

async function boot() {
  const saved = await kv.get('identity');
  if (!saved) { $('#onboard').hidden = false; return; }
  S.me = await importIdentity(saved.keys); S.name = saved.name;
  S.contacts = (await kv.get('contacts')) ?? [];
  S.inbox = (await kv.get('inbox')) ?? [];
  S.consent = (await kv.get('consent')) ?? null;
  S.zones = (await kv.get('zones')) ?? [];
  S.store = createBundleStore({ owner: S.me.publicIdentity.fingerprint });
  const snap = await kv.get('store'); if (snap) S.store.restore(snap, { now: now() });
  S.store.purgeExpired(now());
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
    if (!S.contacts.some((x) => x.fingerprint === c.fingerprint)) S.contacts.push({ ...c, addedVia: via, addedAt: now() });
    await persist(); render(); return toast(`Contacto añadido: ${c.name}`);
  }
  if (bytes[0] === 0xe2) return receiveEnvelope(unpackEnvelope(bytes), via);
  throw new Error('Formato no reconocido');
}

async function receiveEnvelope(env, via) {
  if (env.header.to === S.me.publicIdentity.fingerprint) {
    if (S.inbox.some((m) => m.id === env.header.id)) return toast('Ya lo tenías (duplicado descartado)');
    const m = await openMessage({ recipient: S.me, envelope: env, now: now() });
    const sender = S.contacts.find((c) => c.signPub.x === m.from.x && c.signPub.y === m.from.y);
    S.inbox.unshift({ id: env.header.id, from: sender?.name ?? 'Desconocido (firma válida)', body: m.body, kind: env.header.kind, at: now(), via });
    await S.store.acceptReceipt(m.receipt); // el recibo viajará y borrará copias en otros teléfonos
    await persist(); render(); return toast(`Mensaje de ${sender?.name ?? 'desconocido'} vía ${via}`);
  }
  const act = relayActivation({ zones: S.zones, position: S.pos ?? { lat: 0, lon: 0 }, consent: S.consent, now: now() });
  if (!S.consent?.relayInDeclaredZones) return toast('No tienes activado el transporte para otros');
  const r = S.store.put(env, { now: now(), copies: 4 });
  await persist(); render();
  toast(r.stored ? `Transportando mensaje cifrado para ${env.header.to.slice(0, 6)}… (${act.mode})` : `No guardado: ${r.reason}`);
}

/* ---------------- acciones ---------------- */
const ACTIONS = {
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
    await emit(packEnvelope(env), { canvas: $('#scope') });
    $('#audio-status').textContent = 'Emitido. Si el otro teléfono lo recibió, verás su recibo en la próxima sincronización.';
  },
  async 'bundle-share'() {
    const text = exportBundleFile(S.store, { now: now() });
    await persist(); await shareFile(`senda-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.senda`, text, 'application/json');
  },
  async sms() {
    const it = outgoing()[0]; if (!it) return toast('Nada pendiente');
    location.href = `sms:?&body=${encodeURIComponent('SENDA:' + b64(packEnvelope(S.store.get(it.id))))}`;
  },
  async 'text-copy'() { const it = outgoing()[0]; if (!it) return toast('Nada pendiente'); await copy('SENDA:' + b64(packEnvelope(S.store.get(it.id)))); },
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
  if (t.startsWith('{')) { const r = await importBundleFile(S.store, t, { now: now() }); for (const e of r.forMe) await receiveEnvelope(e, via); await persist(); render(); return toast(`Paquete: ${r.forMe.length} para ti, ${r.stored.length} en tránsito`); }
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
  const body = $('#body').value.trim(); if (!to || !body) return toast('Elige contacto y escribe algo');
  const prio = +$('#prio').value;
  const env = await sealMessage({ sender: S.me, recipient: to, body, priority: prio, ttlS: 7 * 86400, now: now(), kind: prio === 0 ? 'SOS' : 'PERSONAL' });
  S.store.put(env, { now: now(), copies: 8 }); await persist(); $('#body').value = ''; render();
  toast('Cifrado y en camino: emítelo por sonido, comparte el paquete o deja que otros lo transporten');
}

async function sos() {
  if (!S.contacts.length) return toast('Añade al menos un contacto primero');
  let where = 'posición no disponible';
  try { const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }));
    S.pos = { lat: p.coords.latitude, lon: p.coords.longitude }; where = `${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)} ±${Math.round(p.coords.accuracy)} m`; } catch { /* GPS no disponible */ }
  for (const c of S.contacts) S.store.put(await sealMessage({ sender: S.me, recipient: c, body: `SOS · ${S.name} necesita ayuda · ${where} · ${new Date().toLocaleString()}`, priority: 0, ttlS: 3 * 86400, now: now(), kind: 'SOS' }), { now: now(), copies: 16 });
  await persist(); render(); toast(`SOS cifrado para ${S.contacts.length} contacto(s). Emítelo o compártelo ya.`, 5000); show('transfer');
}

/* ---------------- render ---------------- */
function render() {
  if (!S.me) return;
  $('#me-name').textContent = S.name; $('#me-fp').textContent = S.me.publicIdentity.fingerprint;
  $('#st-inbox').textContent = S.inbox.length; $('#st-carry').textContent = S.store.count(); $('#st-contacts').textContent = S.contacts.length;
  $('#contact-list').innerHTML = S.contacts.map((c) => `<li><b>${esc(c.name)}</b><div class="meta">${c.fingerprint} · vía ${esc(c.addedVia ?? '')}</div></li>`).join('') || '<li class="fine">Sin contactos. Intercambiad tarjetas por sonido o código.</li>';
  $('#to').innerHTML = S.contacts.map((c) => `<option value="${c.fingerprint}">${esc(c.name)}</option>`).join('');
  $('#inbox').innerHTML = S.inbox.map((m) => `<li class="${m.kind === 'SOS' ? 'is-sos' : ''}"><b>${esc(m.from)}</b> <span class="meta">${m.kind} · vía ${esc(m.via)} · ${new Date(m.at).toLocaleString()}</span><div>${esc(m.body)}</div></li>`).join('') || '<li class="fine">Nada todavía.</li>';
  $('#carry').innerHTML = S.store.list().map((i) => `<li><span class="meta">para ${esc(nameOf(i.to))} · prioridad ${i.priority} · ${i.kind} · copias ${i.copies} · caduca ${new Date(i.expiresAt).toLocaleDateString()}</span></li>`).join('') || '<li class="fine">Nada en tránsito.</li>';
  const act = relayActivation({ zones: S.zones, position: S.pos ?? { lat: 0, lon: 0 }, consent: S.consent, now: now() });
  $('#relay-state').textContent = { OFF: 'Fuera de zona declarada', STANDBY: 'En espera', RELAY_ACTIVE: 'Relé ACTIVO' }[act.mode] + ' — ' + act.reason;
  $('#relay-consent').checked = !!S.consent?.relayInDeclaredZones;
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
$('#relay-consent').addEventListener('change', async (e) => { S.consent = createConsentProfile({ ...(S.consent ?? { termsVersion: 'senda-campo-1' }), acceptedAt: new Date().toISOString(), relayInDeclaredZones: e.target.checked }); await persist(); render(); });
for (const id of ['#card-file', '#bundle-file']) $(id).addEventListener('change', async (e) => { for (const f of e.target.files) await receiveText(await f.text(), 'archivo').catch((err) => toast(err.message)); e.target.value = ''; });
addEventListener('online', netBadge); addEventListener('offline', netBadge); netBadge();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/senda-sw.js', { scope: '/senda' }).then(() => navigator.serviceWorker.ready).then(() => { $('#sw').textContent = 'instalada offline'; $('#sw').className = 'pill ok'; })
    .catch(() => { $('#sw').textContent = 'sin modo offline'; $('#sw').className = 'pill off'; });
}

/* Ganchos para pruebas automáticas (sin efecto para el usuario). */
Object.assign(window.SENDA_TEST, {
  ready: boot(),
  receiveText: (t) => receiveText(t, 'prueba'),
  ingestSamples: async (arr, sr) => { const r = decodeSamples(Float32Array.from(arr), sr); if (!r) throw new Error('sin trama'); await receiveBytes(r.payload, 'sonido'); return r.payload.length; },
  myCard: () => 'SENDA:' + b64(packContact(S.me.publicIdentity, S.name)),
  exportBundle: () => exportBundleFile(S.store, { now: now() }),
  emitTop: () => ACTIONS.emit(),
});

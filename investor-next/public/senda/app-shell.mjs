// Portada de la app SENDA: pestañas, catálogo de módulos por rol y gestión de accesos sin red.
import { createAdmin, issueCredential, issueRevocation, acceptRevocation, resolveRole, ROLES, GRANTS, encodeQr, decodeQr, QR_PREFIX, sameAnchor } from './core/app-roles.mjs';
import { MODULES, SECTIONS, allowed, search } from './core/app-catalog.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Iconos (trazos simples, estilo símbolo del sistema) ──
const P = {
  sos: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  flame: '<path d="M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3 0-5 0-7z"/>',
  wave: '<path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0"/><circle cx="12" cy="12" r="1"/><path d="M12 13v7"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2 2"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  down: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
const ico = (n, color = '#fff') => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n] || P.grid}</svg>`;
const paintIcons = () => document.querySelectorAll('[data-ico]').forEach((el) => { el.innerHTML = ico(el.dataset.ico); });

// ── Almacenamiento local (nunca sale del móvil) ──
const LS = {
  get(k, d = null) { try { const v = localStorage.getItem('senda.app.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('senda.app.' + k, JSON.stringify(v)); } catch { /* modo privado */ } },
};
const idb = () => new Promise((ok, ko) => { const r = indexedDB.open('senda-app', 1); r.onupgradeneeded = () => r.result.createObjectStore('keys'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
async function idbGet(k) { const db = await idb(); return new Promise((ok) => { const r = db.transaction('keys').objectStore('keys').get(k); r.onsuccess = () => ok(r.result ?? null); r.onerror = () => ok(null); }); }
async function idbPut(k, v) { const db = await idb(); return new Promise((ok, ko) => { const t = db.transaction('keys', 'readwrite'); t.objectStore('keys').put(v, k); t.oncomplete = ok; t.onerror = () => ko(t.error); }); }

// ── Rol actual ──
const REASON = {
  OWNS_ADMIN_KEY: 'Este móvil tiene la clave de administrador', VALID: 'Credencial válida', NONE: 'Sin credencial: acceso público',
  EXPIRED: 'Tu credencial caducó', NOT_YET_VALID: 'Tu credencial aún no está vigente', REVOKED: 'Tu credencial fue revocada',
  BAD_SIGNATURE: 'La credencial no está firmada por tu administrador', NO_ANCHOR: 'Falta la clave pública del administrador',
  CLOCK_ROLLBACK: 'La hora del móvil ha retrocedido: revisa fecha y hora', ROLE_NOT_ISSUABLE: 'Código no válido', MALFORMED: 'Código dañado',
};
const ROLE_NAME = { ADMIN: 'Administrador', OBSERVADOR_TOTAL: 'Observador total', CIUDADANO: 'Ciudadano' };
const ROLE_COLOR = { ADMIN: 'var(--acc)', OBSERVADOR_TOTAL: 'var(--menta)', CIUDADANO: 'var(--l2)' };
let me = { role: ROLES.CIUDADANO, grants: [], reason: 'NONE' };
let adminKeys = null;

async function refreshRole() {
  adminKeys = await idbGet('admin').catch(() => null);
  const now = Date.now();
  me = await resolveRole({ adminKeys: adminKeys?.privateKey ? adminKeys : null, anchor: LS.get('anchor'), credential: LS.get('credential'), revocation: LS.get('revocation'), now, lastSeenMs: LS.get('lastSeen', 0) });
  if (me.reason !== 'CLOCK_ROLLBACK') LS.set('lastSeen', Math.max(now, LS.get('lastSeen', 0)));
}

// ── Vistas ──
function card(m) {
  const sec = SECTIONS.find((s) => s.id === m.section);
  const ok = allowed(m, me.role);
  return `<a class="card${ok ? '' : ' lock'}" href="${ok ? m.href : '#ajustes'}" data-page="${m.page}" ${ok ? '' : 'aria-disabled="true"'}>
    ${ok ? '' : `<span class="lk" aria-label="Bloqueado">${ico('lock', 'currentColor').replace('<svg', '<svg width="16" height="16"')}</span>`}
    <div class="pv"><img src="/senda/previews/${esc(m.page)}.webp" alt="" loading="lazy" onerror="this.remove()"><div class="tile" style="background:${sec.color}">${ico(sec.icon)}</div></div><div class="tx"><b>${esc(m.title)}</b><small>${esc(m.sub)}</small></div></a>`;
}
function renderHero() {
  const open = MODULES.filter((m) => allowed(m, me.role)).length;
  const exp = me.expiresAt ? ` · caduca el ${new Date(me.expiresAt).toLocaleDateString('es-ES')}` : '';
  $('#hero').innerHTML = `<p><span class="dot" style="background:${ROLE_COLOR[me.role]}"></span>${ROLE_NAME[me.role]}${exp}</p>
    <div class="who">${open} de ${MODULES.length} módulos disponibles</div><p>${esc(REASON[me.reason] || '')}</p>`;
}
function renderCatalog() {
  const list = search($('#q').value);
  $('#catalog').innerHTML = SECTIONS.map((s) => {
    const mods = list.filter((m) => m.section === s.id);
    return mods.length ? `<h2>${esc(s.title)}</h2><div class="grid">${mods.map(card).join('')}</div>` : '';
  }).join('') || '<p class="foot">Sin resultados.</p>';
}
// Destacados (como las tarjetas grandes de las tiendas de apps): qué puedes hacer YA con tu acceso
const FEATURED = [
  ['conducir', 'Conduce, anda o pedalea', 'Mapa con capas y satélite oficial, avisos DGT/NDW, radares fijos y cámara con IA'],
  ['conducir', 'Radar de señales', 'Mira las redes Wi-Fi y Bluetooth a tu alrededor y otros móviles SENDA', '#senales', 'senales'],
  ['mensaje', 'Mensajes sin red', 'Cifrados, por Bluetooth, sonido o archivo'],
  ['avisos', 'Avisa de un peligro', 'Lo ven los móviles cercanos'],
  ['ruta', 'Ruta segura', 'Elige calles y evita zonas inundadas'],
  ['demo', 'Recorrido de 5 minutos', 'Qué es SENDA, paso a paso'],
];
function renderFeatured() {
  const el = $('#featured'); if (!el) return;
  el.innerHTML = FEATURED.map(([page, title, sub, hash, img]) => MODULES.find((m) => m.page === page && allowed(m, me.role)) ? `<a href="/senda/${page}${hash ?? ''}" data-page="${page}"><img src="/senda/previews/${img ?? page}.webp" alt="" loading="lazy"><div class="ft"><small>${esc(SECTIONS.find((s) => s.id === MODULES.find((m) => m.page === page).section)?.title ?? '')}</small><b>${esc(title)}</b><span>${esc(sub)}</span></div></a>` : '').join('');
}
function renderRecent() {
  const rec = LS.get('recent', []).map((p) => MODULES.find((m) => m.page === p)).filter(Boolean).slice(0, 4);
  $('#recent').innerHTML = rec.map(card).join('');
  $('#recent-empty').classList.toggle('hide', rec.length > 0);
}
function renderSettings() {
  $('#role-name').textContent = ROLE_NAME[me.role];
  $('#role-why').textContent = REASON[me.reason] || '';
  const isAdmin = me.role === ROLES.ADMIN;
  $('#admin-zone').classList.toggle('hide', !isAdmin);
  $('#setup-zone').classList.toggle('hide', isAdmin || !!LS.get('anchor'));
  const issued = LS.get('issued', []);
  $('#issued').innerHTML = issued.length ? issued.map((c) => `<div class="row"><div class="t"><b>${esc(c.subject)}</b><small>${c.revoked ? 'Revocado' : 'Hasta el ' + new Date(c.validUntil).toLocaleDateString('es-ES')}${c.vault ? ' · con bóveda' : ''}</small></div>${c.revoked ? '' : `<button class="row" style="width:auto;color:var(--rosa);min-height:0;padding:6px" data-revoke="${esc(c.id)}">Revocar</button>`}</div>`).join('')
    : '<div class="row"><div class="t"><small>Todavía no has dado acceso a nadie.</small></div></div>';
}
function renderAll() { renderHero(); renderCatalog(); renderFeatured(); renderRecent(); renderSettings(); paintIcons(); }

function show(tab) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'v-' + tab));
  document.querySelectorAll('nav.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  window.scrollTo(0, 0);
}
if (window.SendaNative) try { sessionStorage.setItem('senda.inApp', '1'); } catch { /* sin almacenamiento */ }
const route = () => show(['inicio', 'modulos', 'ajustes'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio');
addEventListener('hashchange', route);

document.addEventListener('click', (e) => {
  const c = e.target.closest('a.card[data-page]');
  const mod = c && MODULES.find((m) => m.page === c.dataset.page);
  if (mod?.native && !c.hasAttribute('aria-disabled')) {
    e.preventDefault();
    const fn = window.SendaNative?.[mod.native];
    if (typeof fn === 'function') fn.call(window.SendaNative); else alert('Esta función solo existe en la app de Android.');
  }
  if (c && !c.hasAttribute('aria-disabled')) LS.set('recent', [c.dataset.page, ...LS.get('recent', []).filter((p) => p !== c.dataset.page)].slice(0, 8));
});
$('#q').addEventListener('input', () => { renderCatalog(); paintIcons(); });

// ── QR (bibliotecas incluidas en /senda/vendor, licencias en LICENSES.md; se cargan solo al usarlas) ──
const scripts = {};
const loadScript = (src) => (scripts[src] ??= new Promise((ok, ko) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => ko(new Error('No se pudo cargar ' + src)); document.head.appendChild(el); }));
async function showQr(el, text) {
  await loadScript('/senda/vendor/qrcode-generator-1.4.4.js');
  const qr = window.qrcode(0, 'L'); qr.addData(text); qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); // SVG generado localmente, sin datos externos
}
let scanStream = null, scanOn = false;
function stopScan() { scanOn = false; scanStream?.getTracks().forEach((t) => t.stop()); scanStream = null; $('#scanner').hidden = true; }
$('#scan-close').addEventListener('click', stopScan);
$('#scan').addEventListener('click', async () => {
  try {
    await loadScript('/senda/vendor/jsqr-1.4.0.js');
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (err) { $('#in-msg').className = 'foot ko'; $('#in-msg').textContent = 'No se pudo abrir la cámara: ' + (err.message || err.name) + '. Puedes pegar el texto.'; return; }
  const v = $('#scan-video'); v.srcObject = scanStream; await v.play();
  $('#scanner').hidden = false; $('#scan-msg').textContent = 'Apunta al QR del otro móvil'; scanOn = true;
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  const tick = () => {
    if (!scanOn) return;
    if (v.videoWidth) {
      const w = Math.min(v.videoWidth, 720), h = Math.round(v.videoHeight * (w / v.videoWidth));
      cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
      const hit = window.jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (hit?.data) {
        if (hit.data.startsWith(QR_PREFIX.CREDENTIAL) || hit.data.startsWith(QR_PREFIX.REVOCATION)) { stopScan(); $('#in-code').value = hit.data; $('#in-apply').click(); return; }
        $('#scan-msg').textContent = 'Ese QR no es de SENDA.';
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// ── Acciones de administración ──
async function shareText(text, title) {
  try { if (navigator.share) { await navigator.share({ title, text }); return; } } catch { /* cancelado */ }
  try { await navigator.clipboard.writeText(text); alert('Copiado. Pégalo en el chat con la otra persona.'); } catch { alert('Mantén pulsado el código para copiarlo.'); }
}
$('#become-admin').addEventListener('click', async () => {
  if (!confirm('Este móvil será el administrador de SENDA. La clave no se puede copiar: si pierdes el móvil, habrá que empezar de cero. ¿Continuar?')) return;
  const admin = await createAdmin();
  await idbPut('admin', admin.keys);
  LS.set('anchor', admin.anchor);
  await refreshRole(); renderAll();
});
$('#g-issue').addEventListener('click', async () => {
  const subject = $('#g-name').value.trim();
  if (!subject) { $('#g-name').focus(); return; }
  const now = Date.now(), days = Number($('#g-days').value);
  const cred = await issueCredential({ keys: adminKeys }, { subject, grants: $('#g-vault').checked ? [GRANTS.VAULT] : [], validFrom: now - 60_000, validUntil: now + days * 86_400_000 });
  const code = encodeQr(QR_PREFIX.CREDENTIAL, { anchor: LS.get('anchor'), credential: cred });
  LS.set('issued', [{ id: cred.id, subject, validUntil: cred.validUntil, vault: cred.grants.includes(GRANTS.VAULT) }, ...LS.get('issued', [])]);
  $('#g-code').value = code; $('#g-out').classList.remove('hide'); renderSettings();
  await showQr($('#g-qr'), code);
});
$('#g-share').addEventListener('click', () => shareText($('#g-code').value, 'Acceso a SENDA'));
$('#issued').addEventListener('click', async (e) => {
  const id = e.target.closest('[data-revoke]')?.dataset.revoke;
  if (!id || !confirm('¿Revocar este acceso? Tendrás que enviarle el código de revocación.')) return;
  const issued = LS.get('issued', []).map((c) => (c.id === id ? { ...c, revoked: true } : c));
  LS.set('issued', issued);
  const rev = await issueRevocation({ keys: adminKeys }, { revokedIds: issued.filter((c) => c.revoked).map((c) => c.id), issuedAt: Date.now() });
  $('#r-code').value = encodeQr(QR_PREFIX.REVOCATION, rev); $('#r-out').classList.remove('hide'); renderSettings();
  await showQr($('#r-qr'), $('#r-code').value);
});
$('#r-share').addEventListener('click', () => shareText($('#r-code').value, 'Revocación de SENDA'));

// ── Pegar un código recibido ──
$('#in-apply').addEventListener('click', async () => {
  const text = $('#in-code').value.trim(), msg = $('#in-msg');
  try {
    if (text.startsWith(QR_PREFIX.CREDENTIAL)) {
      const { anchor, credential } = decodeQr(QR_PREFIX.CREDENTIAL, text);
      const pinned = LS.get('anchor');
      if (pinned && !sameAnchor(pinned, anchor)) throw new Error('Este código es de otro administrador. Por seguridad no se acepta.');
      const r = await resolveRole({ anchor, credential, revocation: LS.get('revocation'), now: Date.now(), lastSeenMs: LS.get('lastSeen', 0) });
      if (r.role !== ROLES.OBSERVADOR_TOTAL) throw new Error(REASON[r.reason] || 'Código no válido');
      LS.set('anchor', anchor); LS.set('credential', credential);
    } else if (text.startsWith(QR_PREFIX.REVOCATION)) {
      const anchor = LS.get('anchor');
      if (!anchor) throw new Error('Primero hace falta un código de acceso de tu administrador.');
      const res = await acceptRevocation(LS.get('revocation'), decodeQr(QR_PREFIX.REVOCATION, text), anchor);
      if (!res.ok) throw new Error(res.reason === 'OLDER_THAN_STORED' ? 'Esta revocación es más antigua que la guardada.' : 'Revocación no válida.');
      LS.set('revocation', res.revocation);
    } else throw new Error('No es un código de SENDA.');
    msg.className = 'foot ok'; msg.textContent = 'Código aplicado.'; $('#in-code').value = '';
  } catch (err) { msg.className = 'foot ko'; msg.textContent = err.message; }
  await refreshRole(); renderAll();
});

await refreshRole();
renderAll();
route();

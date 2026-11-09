/**
 * SENDA Campo · coordinación en edificios y zonas.
 *  - Residente: perfil (edificio/planta/vivienda), consentimiento de órdenes remotas, organismos
 *    de confianza (anclas). Recibe alertas/órdenes FIRMADAS, las verifica, ejecuta lo que el
 *    navegador permite y responde cifrado al coordinador (o responde solo si nadie pulsa).
 *  - Coordinador: solicitud de credencial, importación de credencial, alerta dirigida firmada,
 *    cuadro por edificio/planta con las respuestas, importación de barridos Wi-Fi (Android/ESP32/dron).
 *  - Relé: sincronización por Internet cuando lo hay (servidor packages/senda-relay).
 */
import { sealMessage } from './core/envelope.mjs';
import { verifyCredential, encodeCode, decodeCode, CODE } from './core/roles.mjs';
import { signCommand, evaluateCommand, keyThumb, buildResidentResponse, aggregateResponses, RESPONSE_PREFIX, ACTIONS as CMD_ACTIONS } from './core/remote-command.mjs';
import { prepareBuilding, locateAccessPoints, FLOOR_HEIGHT_M } from './core/building-twin.mjs';
import { relayActivation } from './core/zones.mjs';
import { packContact } from './core/envelope.mjs';
import { emit } from './audio.mjs';
import { beaconIdOf, nativeActionLink, parseSurvey } from './core/beacon.mjs';

const NATIVE_ONLY = new Set(['BLE_BEACON', 'WIFI_SCAN', 'LOW_POWER_BEACON']);
const STATUS_ES = { SAFE: 'Estoy bien', NEED_HELP: 'Necesito ayuda', TRAPPED: 'Estoy atrapado', AWAY: 'No estoy en el edificio' };

export function initCoordination(app) {
  const { S, kv, $, toast, persist, render, esc } = app;
  const now = () => Date.now();
  const save = async () => { await kv.set('profile', S.profile); await kv.set('anchors', S.anchors); await kv.set('coord', S.coord); await kv.set('responses', S.responses); await kv.set('cmdLog', S.cmdLog); await kv.set('relayUrl', S.relayUrl); await persist(); };

  async function load() {
    S.profile = (await kv.get('profile')) ?? { buildingId: '', floor: null, unit: '', consentRemote: false };
    S.anchors = (await kv.get('anchors')) ?? [];
    S.coord = (await kv.get('coord')) ?? { credential: null, alerts: [] };
    S.responses = (await kv.get('responses')) ?? [];
    S.cmdLog = (await kv.get('cmdLog')) ?? [];
    S.relayUrl = (await kv.get('relayUrl')) ?? '';
    S.seenCmds = new Set(S.cmdLog.map((c) => c.id));
  }

  /* ---------- residente: recibir una alerta/orden firmada ---------- */
  async function handleBroadcast(cmd, via) {
    if (S.seenCmds.has(cmd.id)) return;
    const battery = await navigator.getBattery?.().then((b) => Math.round(b.level * 100)).catch(() => null) ?? null;
    const zone = relayActivation({ zones: S.zones, position: S.pos ?? { lat: 0, lon: 0 }, consent: S.consent, now: now() });
    const targetsMyBuilding = !!cmd.target?.buildingId && cmd.target.buildingId === S.profile.buildingId;
    const ev = await evaluateCommand(cmd, { anchors: S.anchors, consent: { remoteCommands: S.profile.consentRemote }, inDeclaredZone: zone.relayActive || targetsMyBuilding,
      battery: battery ?? 100, radios: {}, me: { buildingId: S.profile.buildingId, floor: S.profile.floor }, seen: S.seenCmds, now: now() });
    S.cmdLog.unshift({ id: cmd.id, at: now(), via, accepted: ev.accepted, reason: ev.reason ?? null, message: cmd.message, issuer: ev.issuer ?? null });
    S.cmdLog = S.cmdLog.slice(0, 50); S.seenCmds.add(cmd.id); await save(); render();
    if (!ev.accepted) return;
    const plan = ev.plan.map((p) => (NATIVE_ONLY.has(p.action) ? { ...p, mode: 'NATIVE_APP' } : p));
    showAlert(cmd, ev.issuer, plan, battery);
  }

  function showAlert(cmd, issuer, plan, battery) {
    const box = $('#alert'); box.hidden = false;
    $('#alert-issuer').textContent = `${issuer.org} · ${issuer.role} · ${issuer.unit} (firma verificada)`;
    $('#alert-msg').textContent = cmd.message || 'Alerta de coordinación';
    $('#alert-plan').innerHTML = plan.map((p) => `<li>${esc(CMD_ACTIONS[p.action].label)} — ${p.mode === 'RUN' ? 'en marcha' : p.mode === 'NATIVE_APP' ? 'requiere SENDA Android' : 'pulsa para activar'}</li>`).join('');
    $('#alert-opts').innerHTML = Object.entries(STATUS_ES).map(([k, l]) => `<button data-rs="${k}">${l}</button>`).join('');
    const nat = plan.filter((p) => p.mode === 'NATIVE_APP').map((p) => p.action);
    $('#alert-native').hidden = !nat.length;
    if (nat.length) beaconIdOf(S.me.publicIdentity.fingerprint).then((id) => { $('#alert-native').href = nativeActionLink({ actions: nat, beaconId: id, profile: S.profile, battery, cmdId: cmd.id }); });
    runBrowserActions(plan);
    let left = window.SENDA_TEST?.alertCountdownS ?? 60; $('#alert-count').textContent = left;
    const finish = async (status) => { clearInterval(timer); box.hidden = true; stopEffects(); await respond(cmd, status, plan, battery).catch((e) => toast(e.message)); };
    const timer = setInterval(() => { left--; $('#alert-count').textContent = left; if (left <= 0) finish('NO_RESPONSE'); }, 1000);
    $('#alert-opts').onclick = (e) => { const b = e.target.closest('[data-rs]'); if (b) finish(b.dataset.rs); };
  }

  let effects = [];
  function runBrowserActions(plan) {
    for (const p of plan) {
      if (p.mode !== 'RUN') continue;
      if (p.action === 'SIREN') {
        try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.type = 'square'; g.gain.value = 0.9; o.connect(g); g.connect(a.destination);
          const t0 = a.currentTime; for (let i = 0; i < 20; i++) { o.frequency.setValueAtTime(700, t0 + i * 0.5); o.frequency.linearRampToValueAtTime(1500, t0 + i * 0.5 + 0.45); } o.start(); o.stop(t0 + 10); effects.push(() => { try { o.stop(); a.close(); } catch { /* ya parado */ } }); } catch { /* sin audio */ }
        navigator.vibrate?.([800, 300, 800, 300, 800, 300, 800]);
      }
      if (p.action === 'FLASH') { let on = false; const iv = setInterval(() => { on = !on; document.body.style.background = on ? '#fff' : ''; }, 250); effects.push(() => { clearInterval(iv); document.body.style.background = ''; }); setTimeout(() => effects.length && effects.forEach((f) => f()), 10000); }
      if (p.action === 'ACOUSTIC_PING') emit(packContact(S.me.publicIdentity, S.name)).catch(() => {});
    }
  }
  function stopEffects() { effects.forEach((f) => f()); effects = []; }

  async function respond(cmd, status, plan, battery) {
    let position = S.pos;
    if (plan.some((p) => p.action === 'REPORT_STATUS' && p.mode === 'RUN') && navigator.geolocation) {
      try { const g = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, maximumAge: 60000 })); position = { lat: g.coords.latitude, lon: g.coords.longitude }; } catch { /* sin GPS */ }
    }
    const r = buildResidentResponse({ cmdId: cmd.id, status, profile: S.profile, battery, position, plan, at: now() });
    if (cmd.reply) {
      const env = await sealMessage({ sender: S.me, recipient: cmd.reply, body: RESPONSE_PREFIX + JSON.stringify(r), priority: status === 'SAFE' || status === 'AWAY' ? 2 : 0, ttlS: 86400, now: now(), kind: 'COORDINATION' });
      S.store.put(env, { now: now(), copies: 16 });
    }
    S.lastResponse = r; await save(); render();
    toast(status === 'NO_RESPONSE' ? 'Sin respuesta: SENDA ha avisado al coordinador de que tu teléfono está activo.' : `Respuesta «${STATUS_ES[status]}» cifrada para el coordinador.`, 5000);
  }

  /* ---------- coordinador: recibir respuestas ---------- */
  function onResponseMessage(body, fromKey) {
    try { const r = JSON.parse(body.slice(RESPONSE_PREFIX.length)); S.responses.push({ ...r, from: `${fromKey.x.slice(0, 12)}` }); save(); return `📍 ${r.buildingId ?? '?'} · planta ${r.floor ?? '?'} ${r.unit ?? ''}: ${({ ...STATUS_ES, NO_RESPONSE: 'SIN RESPUESTA (teléfono activo)' })[r.status]}${r.battery != null ? ` · batería ${r.battery} %` : ''}`; }
    catch { return null; }
  }

  async function coordStatus() {
    if (!S.coord.credential) return { ok: false, text: 'Sin credencial. Genera tu solicitud y pide al organismo que la firme.' };
    const v = await verifyCredential(S.coord.credential, S.anchors, now());
    if (!v.valid) return { ok: false, text: `Credencial no válida aquí (${v.reason}). ¿Has importado el ancla del organismo?` };
    if (S.coord.credential.subject !== await keyThumb(S.me.publicIdentity.signPub)) return { ok: false, text: 'La credencial no corresponde a la clave de este teléfono.' };
    return { ok: true, text: `${v.orgKind} · ${v.role} · ${v.unit} — válida hasta ${new Date(S.coord.credential.validUntil).toLocaleDateString()}` };
  }

  const parseFloors = (t) => { const out = new Set(); for (const part of String(t).split(',').map((x) => x.trim()).filter(Boolean)) { const [a, b] = part.split('-').map(Number); if (Number.isFinite(a)) for (let f = a; f <= (Number.isFinite(b) ? b : a); f++) out.add(f); } return out.size ? [...out].sort((x, y) => x - y) : null; };

  async function sendAlert() {
    const st = await coordStatus(); if (!st.ok) return toast(st.text, 5000);
    const actions = [...document.querySelectorAll('#co-actions input:checked')].map((i) => i.value);
    const target = { buildingId: $('#co-building').value.trim() || null, floors: parseFloors($('#co-floors').value) };
    const cmd = await signCommand({ issuerKeys: S.me.sign, credential: S.coord.credential, kind: 'ALERT', target, actions, message: $('#co-msg').value.trim(), ttlS: 3600, now: now(), reply: S.me.publicIdentity });
    S.store.putBroadcast(cmd, { now: now() }); S.coord.alerts.push({ id: cmd.id, issuedAt: cmd.issuedAt, target }); S.seenCmds.add(cmd.id);
    await save(); render(); toast('Alerta firmada y en camino: compártela (paquete .senda, relé o de mano en mano).', 5000);
    return cmd;
  }

  /* ---------- barridos Wi-Fi (Android / ESP32 / dron) ---------- */
  function importSurvey(text) {
    const scans = parseSurvey(text); // mismo formato que SENDA Android y el accesorio ESP32 (core/beacon.mjs)
    const w = +$('#sv-w').value || 20, d = +$('#sv-d').value || 20, levels = +$('#sv-levels').value || 5;
    const origin = { lat: 0, lon: 0 }, m = (x, y) => ({ lat: y / 111320, lon: x / 111320 });
    const b = prepareBuilding({ id: $('#co-building').value.trim() || 'EDIFICIO', levels, unitsPerFloor: 4, footprint: [m(0, 0), m(w, 0), m(w, d), m(0, d), m(0, 0)] }, origin);
    const tmax = Math.max(...scans.map((s) => s.t));
    const aps = locateAccessPoints(scans, b, { now: tmax, staleS: 300, connected: scans.filter((s) => s.connected).map((s) => ({ bssid: s.bssid, internet: !!s.internet, t: s.t })) });
    S.survey = { at: now(), building: b.id, levels, aps }; kv.set('survey', S.survey); render();
    return aps;
  }

  /* ---------- relé por Internet ---------- */
  async function syncRelay() {
    const url = ($('#relay-url').value.trim() || S.relayUrl).replace(/\/$/, ''); if (!url) return toast('Indica la dirección del relé');
    S.relayUrl = url; await save();
    const p = S.store.prepareFor({ owner: 'senda-relay', ids: [], receipts: [], broadcasts: [] }, { now: now() });
    const r = await fetch(url + '/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ summary: S.store.summary(), ...p }) });
    if (!r.ok) throw new Error(`Relé respondió ${r.status}`);
    const got = await S.store.ingest(await r.json(), { now: now() });
    for (const e of got.forMe) await app.receiveEnvelope(e, 'relé');
    for (const b of got.newBroadcasts) await handleBroadcast(b, 'relé');
    await save(); render(); toast(`Relé: ${got.forMe.length} para ti, ${got.stored.length} en tránsito, ${got.newBroadcasts.length} alertas`);
    return got;
  }

  /* ---------- render de la parte de coordinación ---------- */
  async function renderCoord() {
    if (!$('#pf-building')) return;
    if (document.activeElement?.id?.startsWith('pf-') !== true) {
      $('#pf-building').value = S.profile.buildingId ?? ''; $('#pf-floor').value = S.profile.floor ?? ''; $('#pf-unit').value = S.profile.unit ?? ''; $('#pf-remote').checked = !!S.profile.consentRemote;
    }
    if ($('#pf-beacon') && S.me) beaconIdOf(S.me.publicIdentity.fingerprint).then((id) => { $('#pf-beacon').textContent = id; });
    $('#anchor-list').innerHTML = S.anchors.map((a) => `<li><b>${esc(a.name)}</b> <span class="meta">${esc(a.kind)} · ${esc(a.id)}</span></li>`).join('') || '<li class="fine">Ningún organismo. Importa el código de ancla que publica tu ayuntamiento o protección civil.</li>';
    $('#cmd-log').innerHTML = S.cmdLog.slice(0, 8).map((c) => `<li class="${c.accepted ? '' : 'muted'}"><span class="meta">${new Date(c.at).toLocaleString()} · vía ${esc(c.via)} · ${c.accepted ? 'EJECUTADA' : 'IGNORADA: ' + esc(c.reason)}</span><div>${esc(c.message ?? '')}</div></li>`).join('') || '<li class="fine">Sin alertas recibidas.</li>';
    const st = await coordStatus(); $('#co-status').textContent = st.text; $('#co-status').className = st.ok ? 'ok' : 'warn';
    const agg = aggregateResponses(S.responses, { alerts: S.coord.alerts, now: now() });
    const rows = []; for (const [b, floors] of Object.entries(agg.byBuilding)) for (const [f, c] of Object.entries(floors).sort((x, y) => +y[0] - +x[0])) rows.push(`<tr><td>${esc(b)}</td><td>${esc(f)}</td><td class="g">${c.CONFIRMED_SAFE}</td><td class="r">${c.TRAPPED_CONFIRMED + c.CONFIRMED_NEEDS_HELP}</td><td class="y">${c.SIGNAL_NO_RESPONSE}</td><td>${c.NOT_IN_BUILDING}</td></tr>`);
    $('#co-board').innerHTML = rows.length ? '<tr><th>Edificio</th><th>Planta</th><th>A salvo</th><th>Atrap./ayuda</th><th>Sin resp.</th><th>Fuera</th></tr>' + rows.join('') : '<tr><td class="fine">Sin respuestas todavía.</td></tr>';
    $('#co-sent').textContent = S.coord.alerts.length ? `${S.coord.alerts.length} alerta(s) enviada(s); ${S.responses.length} respuesta(s) recibida(s).` : '';
    const sv = S.survey; $('#sv-out').innerHTML = sv ? `<p class="fine">${sv.aps.length} routers · ${sv.aps.filter((a) => a.gateway).length} pasarelas · ${sv.aps.filter((a) => a.state === 'LOST').length} apagados</p><table><tr><th>Planta</th><th>Vivienda</th><th>Router</th><th>Estado</th></tr>${sv.aps.filter((a) => a.floor != null).map((a) => `<tr><td>${a.floor}</td><td>${a.unit}</td><td>${esc(a.ssid ?? a.bssid)}</td><td>${a.gateway ? 'PASARELA' : a.state}</td></tr>`).join('')}</table>` : '';
    $('#relay-url').value ||= S.relayUrl;
  }

  /* ---------- eventos ---------- */
  document.addEventListener('change', async (e) => {
    const id = e.target.id;
    if (['pf-building', 'pf-floor', 'pf-unit', 'pf-remote'].includes(id)) {
      S.profile = { buildingId: $('#pf-building').value.trim(), floor: $('#pf-floor').value === '' ? null : +$('#pf-floor').value, unit: $('#pf-unit').value.trim().toUpperCase(), consentRemote: $('#pf-remote').checked };
      await save(); toast('Perfil guardado en este teléfono');
    }
    if (id === 'sv-file') { for (const f of e.target.files) { try { const aps = importSurvey(await f.text()); toast(`Barrido importado: ${aps.length} routers`); } catch (err) { toast('Barrido no válido: ' + err.message); } } e.target.value = ''; }
  });
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-co]'); if (!a) return;
    try {
      if (a.dataset.co === 'anchor-add') { const t = await app.ask('Pega el código de ancla del organismo (SENDA-ANCLA:…)'); if (!t) return; const anc = decodeCode(CODE.ANCHOR, t); if (!anc.publicJwk || !anc.id) throw new Error('Ancla incompleta'); S.anchors = [...S.anchors.filter((x) => x.id !== anc.id), anc]; await save(); render(); toast(`Organismo de confianza añadido: ${anc.name}`); }
      if (a.dataset.co === 'request') { await app.copy(encodeCode(CODE.REQUEST, { name: S.name, thumb: await keyThumb(S.me.publicIdentity.signPub) })); }
      if (a.dataset.co === 'cred-import') { const t = await app.ask('Pega la credencial firmada por el organismo (SENDA-CREDENCIAL:…)'); if (!t) return; S.coord.credential = decodeCode(CODE.CREDENTIAL, t); await save(); render(); toast((await coordStatus()).text, 5000); }
      if (a.dataset.co === 'send-alert') await sendAlert();
      if (a.dataset.co === 'relay-sync') await syncRelay();
    } catch (err) { toast(err.message, 5000); }
  });

  // Ganchos de prueba equivalentes a los botones (pegar código / guardar perfil).
  const importAnchorCode = async (t) => { const anc = decodeCode(CODE.ANCHOR, t); S.anchors = [...S.anchors.filter((x) => x.id !== anc.id), anc]; await save(); render(); };
  const importCredentialCode = async (t) => { S.coord.credential = decodeCode(CODE.CREDENTIAL, t); await save(); render(); return coordStatus(); };
  const setProfile = async (p) => { S.profile = { ...S.profile, ...p }; await save(); render(); };
  const requestCode = async () => encodeCode(CODE.REQUEST, { name: S.name, thumb: await keyThumb(S.me.publicIdentity.signPub) });
  return { load, handleBroadcast, onResponseMessage, renderCoord, sendAlert, importSurvey, syncRelay, coordStatus, RESPONSE_PREFIX, importAnchorCode, importCredentialCode, setProfile, requestCode };
}

// SENDA · Radar de avisos. Globo 3D con avisos REALES: instantánea de fuentes públicas (data/alertas/instantanea.json)
// + petición EN VIVO desde el navegador a las fuentes que lo permiten (USGS, EMSC, GDACS, NASA EONET).
// Normalización, fases, cambios y plan de activación: núcleo real (alert-watch.mjs). Los dispositivos que aparecen al
// pulsar «Activar SENDA aquí» son una SIMULACIÓN con proporciones de ejemplo declaradas.
import * as THREE from '/senda/vendor/three.module.min.js';
import * as W from '/senda/core/alert-watch.mjs';

const $ = (s) => document.querySelector(s);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rad = Math.PI / 180;

/* ───────────── Familias, colores y textos ───────────── */
const FAMILY = { FIRE: 'fire', EARTHQUAKE: 'quake', TSUNAMI: 'quake', VOLCANO: 'quake', FLOOD: 'water', RAIN: 'water', COASTAL: 'water', WIND: 'wind', STORM: 'wind', SNOW_ICE: 'other', HEAT: 'fire', COLD: 'other', FOG: 'other', DROUGHT: 'other', AVALANCHE: 'other', ICE_SEA: 'other', OTHER: 'other' };
const FAM = [
  { id: 'official', label: 'Avisos oficiales', color: '#ffd166' },
  { id: 'fire', label: 'Fuego y calor', color: '#ff7756' },
  { id: 'quake', label: 'Sismos y volcanes', color: '#fbbf24' },
  { id: 'water', label: 'Agua y costa', color: '#4f9dff' },
  { id: 'wind', label: 'Viento y tormentas', color: '#b48cff' },
  { id: 'other', label: 'Otros', color: '#9aa4ae' },
];
const LEVEL = { Yellow: '#ffd166', Orange: '#ff9f43', Red: '#ff5b6e', Green: '#34d399' };
const famOf = (a) => (a.source === 'METEOALARM' || a.source === 'CAP' ? 'official' : FAMILY[a.kind] ?? 'other');
const colorOf = (a) => (famOf(a) === 'official' ? LEVEL[a.level] ?? '#ffd166' : a.source === 'GDACS' && a.level ? LEVEL[a.level] : FAM.find((f) => f.id === famOf(a)).color);
const NATURE = { OFFICIAL_WARNING: 'Aviso oficial', OBSERVATION: 'Observación medida', AUTOMATED_ALERT: 'Alerta automática de impacto', EVENT_CATALOG: 'Catálogo de eventos' };
const PHASE = { FORECAST: 'Previsto', ACTIVE: 'Vigente', OBSERVED: 'Observado', EXPIRED: 'Caducado', EXERCISE: 'Ejercicio', CANCELLED: 'Cancelado' };
const KIND_ES = { EARTHQUAKE: 'terremoto', TSUNAMI: 'maremoto', FLOOD: 'inundación', RAIN: 'lluvia', WIND: 'viento', STORM: 'tormenta', SNOW_ICE: 'nieve o hielo', HEAT: 'calor', COLD: 'frío', FOG: 'niebla', COASTAL: 'fenómenos costeros', FIRE: 'fuego', VOLCANO: 'volcán', DROUGHT: 'sequía', AVALANCHE: 'alud', ICE_SEA: 'hielo marino', OTHER: 'evento' };
const fmtT = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const ago = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 0 ? `en ${fmtDur(-m)}` : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
const fmtDur = (m) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);

/* ───────────── Estado ───────────── */
const S = { alerts: [], zones: {}, sources: [], liveAt: null, live: {}, filters: Object.fromEntries(FAM.map((f) => [f.id, true])), winH: 72, sel: null, act: null, newIds: new Set(), firstLiveDone: false };

/* ───────────── Globo (three.js) ───────────── */
const gl = $('#gl'), ov = $('#ov'), octx = ov.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene(); scene.background = new THREE.Color('#05070a');
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
const globe = new THREE.Group(); globe.rotation.order = 'XYZ'; scene.add(globe);
const ll2v = (lat, lon, r = 1) => { const p = (lon + 180) * rad, t = (90 - lat) * rad; return new THREE.Vector3(-r * Math.cos(p) * Math.sin(t), r * Math.cos(t), r * Math.sin(p) * Math.sin(t)); };
const tex = new THREE.TextureLoader().load('/senda/data/radar/tierra-dia-2048.jpg'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
const earthMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.82, 0.84, 0.88) });
globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat));
let hiRes = false; // textura de 4096 px solo cuando se acerca (ahorra datos en la vista global)
const wantHiRes = () => { if (hiRes) return; hiRes = true; new THREE.TextureLoader().load('/senda/data/radar/tierra-dia-4096.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; earthMat.map = t; earthMat.needsUpdate = true; }); };
// Atmósfera: brillo de borde (Fresnel) por la cara trasera, aditivo.
const atm = new THREE.Mesh(new THREE.SphereGeometry(1.09, 64, 48), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 2.6); gl_FragColor = vec4(1.0,0.42,0.28,1.0) * i * 1.35; }',
}));
scene.add(atm);
{ // estrellas (puntos aleatorios con semilla fija)
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const pos = [];
  for (let i = 0; i < 1800; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, R = 60; pos.push(R * Math.sqrt(1 - u * u) * Math.cos(th), R * u, R * Math.sqrt(1 - u * u) * Math.sin(th)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa8b8, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.7 })));
}
const zoneLines = new THREE.Group(); globe.add(zoneLines);

/* ───────────── Vista y controles ───────────── */
const PRESET = { world: { lat: 25, lon: -10, dist: 3.4 }, eu: { lat: 48, lon: 8, dist: 2.05 }, es: { lat: 40, lon: -3.7, dist: 1.5 }, nl: { lat: 52.2, lon: 5.3, dist: 1.4 } };
const view = { ...PRESET.world }, target = { ...PRESET.world };
let drag = null, autoSpin = !reduce;
gl.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, lat: target.lat, lon: target.lon, moved: false }; gl.setPointerCapture(e.pointerId); autoSpin = false; });
gl.addEventListener('pointermove', (e) => { if (!drag) return; const k = 0.25 * (view.dist - 1) / 1.4; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; target.lon = drag.lon - dx * k; target.lat = Math.max(-80, Math.min(80, drag.lat + dy * k)); });
gl.addEventListener('pointerup', (e) => { if (drag && !drag.moved) pick(e); drag = null; });
gl.addEventListener('wheel', (e) => { e.preventDefault(); target.dist = Math.max(1.06, Math.min(5, target.dist * (1 + Math.sign(e.deltaY) * 0.12))); autoSpin = false; }, { passive: false });
const flyTo = (lat, lon, dist) => { target.lat = lat; target.lon = lon; if (dist) target.dist = dist; autoSpin = false; };

function resize() {
  const w = gl.clientWidth, h = gl.clientHeight; renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  ov.width = w * devicePixelRatio; ov.height = h * devicePixelRatio; octx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', resize);

/* ───────────── Fronteras ───────────── */
fetch('/senda/data/radar/fronteras-110m.json').then((r) => r.json()).then((b) => {
  const pos = [];
  for (const line of b.lineas) for (let i = 0; i + 1 < line.length; i++) { const a = ll2v(line[i][1], line[i][0], 1.0015), c = ll2v(line[i + 1][1], line[i + 1][0], 1.0015); pos.push(a.x, a.y, a.z, c.x, c.y, c.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  globe.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd7dee6, transparent: true, opacity: 0.28 })));
});

/* ───────────── Datos ───────────── */
const visible = () => {
  const now = Date.now();
  return S.alerts.filter((a) => {
    if (!S.filters[famOf(a)]) return false;
    const ph = W.phaseOf(a, now); a._phase = ph;
    if (ph === 'EXPIRED' || ph === 'CANCELLED') return false;
    if (ph === 'OBSERVED' && S.winH && a.onset && now - Date.parse(a.onset) > S.winH * 3600_000) return false;
    return true;
  });
};
function zoneOf(a) { return a.geocode ? S.zones[a.geocode] : null; }
function rebuildZones(list) {
  zoneLines.clear();
  const byColor = new Map();
  for (const a of list) { const z = zoneOf(a); if (!z) continue; const c = colorOf(a); if (!byColor.has(c)) byColor.set(c, []); const arr = byColor.get(c);
    for (const ring of z.r) for (let i = 0; i + 1 < ring.length; i++) { const p = ll2v(ring[i][1], ring[i][0], 1.0022), q = ll2v(ring[i + 1][1], ring[i + 1][0], 1.0022); arr.push(p.x, p.y, p.z, q.x, q.y, q.z); } }
  for (const [c, arr] of byColor) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); zoneLines.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: 0.9 }))); }
}

const LIVE = [
  { source: 'USGS', url: W.ALERT_SOURCES.USGS.url, parse: W.fromUsgs },
  { source: 'EMSC', url: W.ALERT_SOURCES.EMSC.url, parse: W.fromEmsc },
  { source: 'GDACS', url: W.ALERT_SOURCES.GDACS.url, parse: W.fromGdacs },
  { source: 'EONET', url: W.ALERT_SOURCES.EONET.url, parse: W.fromEonet },
];
async function refreshLive() {
  const before = new Map(S.alerts.map((a) => [a.id, a]));
  let ok = 0;
  await Promise.all(LIVE.map(async (L) => {
    try {
      const r = await fetch(L.url, { cache: 'no-store' }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list = L.parse(await r.json()).filter((a) => a.point);
      S.alerts = [...S.alerts.filter((a) => a.source !== L.source), ...list];
      S.live[L.source] = { ok: true, at: new Date().toISOString(), count: list.length }; ok++;
    } catch (e) { S.live[L.source] = { ok: false, error: String(e.message ?? e) }; }
  }));
  if (S.firstLiveDone) { const d = W.diffSnapshots([...before.values()], S.alerts); for (const a of [...d.created, ...d.updated]) S.newIds.add(a.id); }
  S.firstLiveDone = true;
  if (ok) S.liveAt = new Date();
  render();
}

async function load() {
  const [zones, snap] = await Promise.all([fetch('/senda/data/alertas/zonas-emma-es-nl.json').then((r) => r.json()), fetch('/senda/data/alertas/instantanea.json').then((r) => r.json())]);
  S.zones = zones.zonas; S.sources = snap.sources; S.snapAt = snap.generatedAt;
  S.alerts = snap.alerts.filter((a) => a.point);
  render();
  await refreshLive();
  setInterval(refreshLive, 120_000);
}

/* ───────────── Panel, filtros, KPI y teletipo ───────────── */
function render() {
  const now = Date.now(), list = visible();
  const counts = Object.fromEntries(FAM.map((f) => [f.id, 0])); for (const a of S.alerts) { const ph = W.phaseOf(a, now); if (ph !== 'EXPIRED' && ph !== 'CANCELLED') counts[famOf(a)]++; }
  $('#filters').innerHTML = FAM.map((f) => `<label class="fl"><input type="checkbox" data-f="${f.id}" ${S.filters[f.id] ? 'checked' : ''}><i style="background:${f.color}"></i>${f.label}<em>${counts[f.id]}</em></label>`).join('');
  $('#k-act').textContent = list.filter((a) => a._phase === 'ACTIVE').length;
  $('#k-fc').textContent = list.filter((a) => a._phase === 'FORECAST').length;
  $('#k-obs').textContent = list.filter((a) => a._phase === 'OBSERVED').length;
  const snapOk = S.sources.filter((s) => s.ok && s.source === 'METEOALARM').length > 0 ? 1 : 0;
  const liveOk = Object.values(S.live).filter((x) => x.ok).length;
  $('#k-src').textContent = `${liveOk + snapOk}/5`;
  const isLive = S.liveAt && Date.now() - S.liveAt < 6 * 60_000;
  $('#dot').className = $('#dot2').className = `dot${isLive ? ' on' : ''}`;
  const t = (d) => new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  $('#livetxt').textContent = isLive ? `En vivo · ${t(S.liveAt)} · avisos oficiales de las ${t(S.snapAt)}` : S.snapAt ? `Instantánea de las ${t(S.snapAt)} · en vivo no disponible` : 'Cargando…';
  $('#tklabel').textContent = isLive ? 'En vivo' : 'Instantánea';
  const order = (a) => (S.newIds.has(a.id) ? 0 : a._phase === 'ACTIVE' ? 1 : a._phase === 'FORECAST' ? 2 : 3);
  const sorted = [...list].sort((a, b) => order(a) - order(b) || Date.parse(b.onset ?? b.sent ?? 0) - Date.parse(a.onset ?? a.sent ?? 0));
  $('#listh').textContent = `Avisos y eventos · ${list.length}`;
  $('#list').innerHTML = sorted.slice(0, 250).map((a) => `<div class="it${S.sel?.id === a.id ? ' sel' : ''}" data-id="${esc(a.id)}"><i style="background:${colorOf(a)}"></i><div><b>${esc(a.title)}</b><small>${S.newIds.has(a.id) ? '<span class="new">Nuevo · </span>' : ''}${esc(W.ALERT_SOURCES[a.source]?.label ?? a.source)} · ${PHASE[a._phase] ?? ''}</small></div><time>${esc(a._phase === 'FORECAST' ? ago(a.onset) : ago(a.onset ?? a.sent))}</time></div>`).join('');
  const recent = [...list].sort((a, b) => Date.parse(b.sent ?? b.onset ?? 0) - Date.parse(a.sent ?? a.onset ?? 0)).slice(0, 28);
  const html = recent.map((a) => `<span>${fmtT(a.sent ?? a.onset).slice(-5)} · ${esc(a.source)}</span> <b>${esc(a.title)}</b>`).join('<span>·</span>');
  $('#tk').innerHTML = html + '<span>·</span>' + html;
  rebuildZones(list);
  S.visible = list;
}
$('#filters').addEventListener('change', (e) => { const f = e.target.dataset.f; if (f) { S.filters[f] = e.target.checked; render(); } });
$('#region').addEventListener('click', (e) => { const r = e.target.dataset.r; if (!r) return; for (const b of $('#region').children) b.classList.toggle('on', b === e.target); flyTo(PRESET[r].lat, PRESET[r].lon, PRESET[r].dist); });
$('#win').addEventListener('click', (e) => { const h = e.target.dataset.h; if (h == null) return; for (const b of $('#win').children) b.classList.toggle('on', b === e.target); S.winH = +h; render(); });
$('#views').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; for (const b of $('#views').children) b.classList.toggle('on', b === e.target); document.body.classList.remove('v-nvg', 'v-flir', 'v-tac'); if (v) document.body.classList.add(v); });
$('#list').addEventListener('click', (e) => { const it = e.target.closest('.it'); if (!it) return; select(S.alerts.find((a) => a.id === it.dataset.id)); });

function select(a) {
  if (!a) return; S.sel = a; S.act = null; autoSpin = false;
  const z = zoneOf(a); flyTo(a.point.lat, a.point.lon, z ? 1.32 : 1.45);
  const n = W.ALERT_SOURCES[a.source];
  const rows = [['Naturaleza', NATURE[a.nature] ?? a.nature], ['Fuente', n?.label ?? a.source], ['Fase', PHASE[W.phaseOf(a, Date.now())]], a.area && ['Zona', a.area], a.level && ['Nivel', a.level],
    a.magnitude != null && ['Magnitud', `${a.magnitude}${a.depthKm != null ? ` · profundidad ${Math.round(a.depthKm)} km` : ''}`], ['Inicio', fmtT(a.onset)], a.expires && ['Fin', fmtT(a.expires)], ['Publicado', fmtT(a.sent)]].filter(Boolean);
  $('#det').innerHTML = `<h4>${esc(a.title)}</h4>${rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}
    ${/^https?:\/\//.test(a.url ?? '') ? `<p style="margin:8px 0 0;font-size:13.5px"><a href="${esc(a.url)}" target="_blank" rel="noopener">Ver en la fuente original →</a></p>` : ''}
    <button class="pri" id="actbtn">Activar SENDA aquí</button><div id="actout"></div>`;
  $('#det').classList.add('show');
  $('#actbtn').addEventListener('click', () => activate(a));
  render();
}

/* ───────────── Activación (núcleo real + dispositivos simulados) ───────────── */
const EXAMPLE_PEOPLE = { n: 90, pVerify: 0.4, pRelay: 0.25, pUplink: 0.6, pHelp: 0.2, pDriving: 0.3, basis: 'EJEMPLO_DECLARADO · sin fuente' };
function destination(p, km, brgDeg) { const d = km / 6371.0088, b = brgDeg * rad, la = p.lat * rad, lo = p.lon * rad; const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b)); return { lat: la2 / rad, lon: (lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2))) / rad }; }
function activate(a) {
  const z = zoneOf(a), alert = z ? { ...a, geometry: { type: 'POLYGONS', rings: z.r } } : a;
  const pol = W.EXAMPLE_ALERT_POLICY;
  const extentKm = z ? Math.max(...z.r.flat().map(([lo, la]) => Math.hypot((lo - a.point.lon) * 111.32 * Math.cos(a.point.lat * rad), (la - a.point.lat) * 110.57))) : 3;
  let s = [...a.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) || 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const devices = Array.from({ length: EXAMPLE_PEOPLE.n }, (_, i) => {
    const p = destination(a.point, Math.sqrt(r()) * (extentKm + pol.ringKm + 6), r() * 360), drv = r() < EXAMPLE_PEOPLE.pDriving;
    return { id: `d${i}`, ...p, consent: { verify: r() < EXAMPLE_PEOPLE.pVerify, relay: r() < EXAMPLE_PEOPLE.pRelay, help: r() < EXAMPLE_PEOPLE.pHelp }, uplink: r() < EXAMPLE_PEOPLE.pUplink, speedMs: drv ? 20 : 1.3 };
  });
  const plan = W.planActivation(alert, devices, pol, Date.now());
  S.act = { alert, devices, plan, extentKm, ringKm: pol.ringKm, byId: new Map(plan.roles.map((x) => [x.id, x.roles])) };
  { const th = (extentKm + pol.ringKm + 6) / 6371.0088; flyTo(a.point.lat, a.point.lon, Math.max(1.07, 1 + (2.4 * th) / Math.tan(17.5 * rad))); }
  const c = plan.counts ?? {}, kind = KIND_ES[a.kind] ?? 'el evento';
  $('#actout').innerHTML = !plan.wake
    ? `<p class="act">SENDA no despierta a nadie: ${plan.reason === 'EXERCISE_NOT_ENABLED' ? 'es un ejercicio.' : 'la severidad está por debajo de la política o el aviso no está vigente.'}</p>`
    : `<p class="tag sim" style="margin:10px 0 4px">Simulación: ${EXAMPLE_PEOPLE.n} móviles de ejemplo; proporciones de consentimiento declaradas sin fuente</p>
      <div class="row"><span>Dentro del área: guía y «estoy bien / necesito ayuda»</span><b>${c.IN_AREA ?? 0}</b></div>
      <div class="row"><span>Testigos a ≤ ${pol.ringKm} km: «¿ves ${esc(kind)} desde donde estás?»</span><b>${c.VERIFIER ?? 0}</b></div>
      <div class="row"><span>Pasarelas: llevan mensajes de vecinos sin datos</span><b>${c.RELAY ?? 0}</b></div>
      <div class="row"><span>Ayuda cercana (llegada ≤ ${Math.round(pol.helpEtaS / 60)} min)</span><b>${c.HELPER ?? 0}</b></div>
      ${plan.prepare.length ? `<p class="act"><b>Aviso previsto: SENDA se prepara antes</b></p><ul class="act">${plan.prepare.map((p) => `<li>${{ CACHE_MAPS_AND_ROUTES: 'Guarda mapas y rutas de la zona en los móviles', ENABLE_GATEWAYS_IF_CONSENTED: 'Enciende las pasarelas de quien lo aceptó, antes de que caiga la red', PRESYNC_CONTACTS: 'Sincroniza contactos y buzones cegados' }[p]}</li>`).join('')}</ul>` : ''}
      <p class="act" style="color:var(--m)">La alerta pública la emite el organismo competente; SENDA prepara, verifica y coordina a quien lo aceptó (<span class="mono">canPublicWarn: false</span>). Núcleo: <span class="mono">alert-watch.mjs → planActivation</span>.</p>`;
}

/* ───────────── Selección por clic ───────────── */
const proj = new THREE.Vector3(), camDir = new THREE.Vector3();
function toScreen(lat, lon, r = 1.003) {
  const v = ll2v(lat, lon, r).applyMatrix4(globe.matrixWorld); camDir.copy(camera.position).normalize();
  const facing = v.clone().normalize().dot(camDir);
  proj.copy(v).project(camera);
  return { x: (proj.x * 0.5 + 0.5) * gl.clientWidth, y: (-proj.y * 0.5 + 0.5) * gl.clientHeight, facing };
}
function pick(e) {
  const b = gl.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; let best = null, bd = 16;
  for (const a of S.visible ?? []) { const p = toScreen(a.point.lat, a.point.lon); if (p.facing < 0.1) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = a; } }
  if (best) select(best);
}

/* ───────────── Bucle ───────────── */
function size(a) { if (a.magnitude != null && Number.isFinite(a.magnitude)) return 2.5 + Math.max(0, a.magnitude - 2.5) * 2.2; return { EXTREME: 8, SEVERE: 6.5, MODERATE: 5, MINOR: 4 }[a.severity] ?? 4; }
function frame(now) {
  if (autoSpin) target.lon += 0.02;
  if (target.dist < 2.2) wantHiRes();
  earthMat.color.setScalar(S.act ? 0.55 : 0.84);
  view.lat += (target.lat - view.lat) * 0.08; view.lon += (target.lon - view.lon) * 0.08; view.dist += (target.dist - view.dist) * 0.08;
  globe.rotation.y = Math.PI / 2 - (view.lon + 180) * rad; globe.rotation.x = view.lat * rad;
  camera.position.set(0, 0, view.dist); camera.lookAt(0, 0, 0); globe.updateMatrixWorld();
  renderer.render(scene, camera);
  const W2 = gl.clientWidth, H2 = gl.clientHeight; octx.clearRect(0, 0, W2, H2);
  const t = now / 1000;
  for (const a of S.visible ?? []) {
    const p = toScreen(a.point.lat, a.point.lon); if (p.facing < 0.08) continue;
    const c = colorOf(a), r0 = size(a) * (view.dist < 2 ? 1.25 : 1);
    const recent = S.newIds.has(a.id) || a._phase === 'ACTIVE' || (a.onset && Date.now() - Date.parse(a.onset) < 3 * 3600_000 && a._phase === 'OBSERVED');
    if (recent && !reduce) { const ph = (((t * 0.6 + a.point.lon) % 1) + 1) % 1; octx.strokeStyle = c; octx.globalAlpha = 0.7 * (1 - ph); octx.lineWidth = 1.5; octx.beginPath(); octx.arc(p.x, p.y, r0 + ph * 18, 0, 7); octx.stroke(); }
    octx.globalAlpha = Math.min(1, 0.35 + p.facing); octx.fillStyle = c; octx.beginPath(); octx.arc(p.x, p.y, r0, 0, 7); octx.fill();
    octx.globalAlpha = 0.9; octx.strokeStyle = 'rgba(5,7,10,.85)'; octx.lineWidth = 1; octx.stroke();
  }
  octx.globalAlpha = 1;
  if (S.act) {
    const { alert, devices, byId, ringKm, extentKm } = S.act, center = alert.point;
    const ring = (km, col, dash) => { octx.strokeStyle = col; octx.setLineDash(dash); octx.lineWidth = 1.6; octx.beginPath(); for (let i = 0; i <= 72; i++) { const q = destination(center, km, i * 5), s2 = toScreen(q.lat, q.lon); if (i) octx.lineTo(s2.x, s2.y); else octx.moveTo(s2.x, s2.y); } octx.stroke(); octx.setLineDash([]); };
    if (!zoneOf(alert)) ring(extentKm, '#ff7756', []);
    ring(extentKm + ringKm, 'rgba(233,237,240,.75)', [6, 6]);
    const RC = { IN_AREA: '#ff5b6e', VERIFIER: '#34d399', RELAY: '#4f9dff', HELPER: '#fbbf24' };
    for (const d of devices) { const roles = byId.get(d.id), s2 = toScreen(d.lat, d.lon); if (s2.facing < 0.1) continue; octx.fillStyle = roles ? RC[roles[0]] : 'rgba(150,160,170,.45)'; octx.beginPath(); octx.arc(s2.x, s2.y, roles ? 4.2 : 2.6, 0, 7); octx.fill(); if (roles) { octx.strokeStyle = 'rgba(5,7,10,.9)'; octx.lineWidth = 1; octx.stroke(); } }
    let ly = 0; const lg = [['IN_AREA', 'Dentro'], ['VERIFIER', 'Testigo'], ['RELAY', 'Pasarela'], ['HELPER', 'Ayuda'], [null, 'Sin consentimiento']];
    const lx = W2 < 900 ? 12 : 270, ly0 = H2 - (W2 < 900 ? 100 : 240); octx.font = '500 13px Inter, sans-serif';
    octx.fillStyle = 'rgba(12,15,19,.86)'; octx.fillRect(lx - 8, ly0 - 18, 168, 96);
    for (const [k, l] of lg) { octx.fillStyle = k ? RC[k] : 'rgba(150,160,170,.7)'; octx.fillRect(lx, ly0 - 9 + ly, 9, 9); octx.fillStyle = '#e9edf0'; octx.fillText(l, lx + 16, ly0 + ly); ly += 16; }
  }
  if (S.sel) { const p = toScreen(S.sel.point.lat, S.sel.point.lon); if (p.facing > 0.08) { octx.strokeStyle = '#ffffff'; octx.lineWidth = 2; octx.beginPath(); octx.arc(p.x, p.y, size(S.sel) + 7, 0, 7); octx.stroke(); } }
  requestAnimationFrame(frame);
}
resize(); requestAnimationFrame(frame);
setTimeout(() => $('#hint')?.remove(), 9000);
load().catch((e) => { $('#livetxt').textContent = `Error al cargar: ${e.message}`; });
setInterval(render, 60_000); // las fases (previsto → vigente) cambian con el reloj
window.__radar = { S, get ready() { return !!S.visible; }, select: (id) => select(S.alerts.find((a) => a.id === id)), activate: () => S.sel && activate(S.sel) };

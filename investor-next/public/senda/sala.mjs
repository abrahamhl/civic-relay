// SENDA · Sala de decisión sobre la DANA de l'Horta Sud (29-10-2024).
// Datos reales: agua observada (Copernicus EMS EMSR773), red viaria y servicios (OpenStreetMap),
// estadísticas oficiales CEMS y el resultado de aislamiento calculado por SENDA (flood-isolation.mjs).
// En el navegador: máscara de agua, tramos y puentes con agua, servicios afectados, huellas SHA-256,
// plan de caminos (bearers + delivery-assurance), borrador CAP 1.2 (interop.mjs) firmado y encadenado.
import { planMultiBearer } from '/senda/core/bearers.mjs';
import { auditIndependentPlan, DEFAULT_HAZARDS } from '/senda/core/delivery-assurance.mjs';
import { toCap, createAuditLog, verifyAuditLog } from '/senda/core/interop.mjs';
import { clusterReports, assessIncident } from '/senda/core/hazard-reports.mjs';

const $ = (s) => document.querySelector(s);
const nf = (x, d = 0) => Number(x).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d });
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
setInterval(() => ($('#clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC'), 1000);

const FILES = [
  { url: '/senda/data/aislamiento/dana_horta_sud.json', name: 'Agua, red y servicios', src: 'Copernicus EMS EMSR773 + OpenStreetMap', lic: 'CEMS: libre citando · OSM: ODbL 1.0' },
  { url: '/senda/data/aislamiento/dana_horta_sud_resultado.json', name: 'Resultado de aislamiento', src: 'Cálculo SENDA sobre datos observados', lic: 'MIT (código del proyecto)' },
  { url: '/senda/data/dana2024/emsr773.json', name: 'Activación EMSR773', src: 'Copernicus Emergency Management Service', lic: 'CEMS: libre citando la fuente' },
];
const t0 = performance.now();
const loaded = await Promise.all(FILES.map(async (f) => { const buf = await (await fetch(f.url)).arrayBuffer(); const sha = hex(await crypto.subtle.digest('SHA-256', buf)); return { ...f, bytes: buf.byteLength, sha, json: JSON.parse(new TextDecoder().decode(buf)) }; }));
const [A, RES, EMS] = loaded.map((f) => f.json);
$('#prov').innerHTML = loaded.map((f) => `<li><b>${f.name}</b> · ${nf(f.bytes / 1024)} KB<br><span style="color:var(--m)">${f.src} · ${f.lic}</span><br><span class="hash">sha256 ${f.sha}</span></li>`).join('');

/* ---------------- geometría y máscara de agua ---------------- */
const [W0, S0, E0, N0] = A.bbox, KX = Math.cos(((S0 + N0) / 2) * Math.PI / 180);
const MW = 2400, MH = Math.round((MW * (N0 - S0)) / ((E0 - W0) * KX));
const mask = new OffscreenCanvas(MW, MH), mg = mask.getContext('2d');
const mx = (lon) => ((lon - W0) / (E0 - W0)) * MW, my = (lat) => ((N0 - lat) / (N0 - S0)) * MH;
mg.fillStyle = '#fff'; mg.beginPath();
for (const ring of A.agua.anillos) { ring.forEach(([lo, la], i) => (i ? mg.lineTo(mx(lo), my(la)) : mg.moveTo(mx(lo), my(la)))); mg.closePath(); }
mg.fill('evenodd');
const md = mg.getImageData(0, 0, MW, MH).data;
const wet = (lon, lat) => { const x = Math.floor(mx(lon)), y = Math.floor(my(lat)); return x >= 0 && y >= 0 && x < MW && y < MH && md[4 * (y * MW + x) + 3] > 0; };
const C = A.red.coords, ways = A.red.ways;
const nodeWet = new Uint8Array(C.length); for (let i = 0; i < C.length; i++) nodeWet[i] = wet(C[i][0], C[i][1]) ? 1 : 0;
let wetKm = 0, totKm = 0; const wetSeg = [], bridgeWet = [];
const segKm = (a, b) => Math.hypot((b[0] - a[0]) * KX, b[1] - a[1]) * 111.32;
for (const w of ways) { let bw = false; for (let i = 1; i < w.n.length; i++) { const a = C[w.n[i - 1]], b = C[w.n[i]], km = segKm(a, b); totKm += km; if (nodeWet[w.n[i - 1]] || nodeWet[w.n[i]]) { wetKm += km; wetSeg.push([w.n[i - 1], w.n[i]]); if (w.br) bw = true; } } if (bw) bridgeWet.push(w); }
const services = A.servicios.map((s) => ({ ...s, wet: wet(s.lon, s.lat) }));
const B = A.edificios.centroides; let bWet = 0; for (const [lo, la] of B) if (wet(lo, la)) bWet++;
const M = RES.escenarios.find((e) => e.id === 'toca').metricas;
const calcMs = performance.now() - t0;

/* ---------------- cifras de situación ---------------- */
const ST = EMS.estadisticasOficiales;
$('#k-pop').textContent = nf(ST['Population [No.]']);
$('#k-wet').textContent = nf(M.wetStreetKm, 1);
$('#k-pock').textContent = nf(M.isolatedPockets);
$('#k-serv').textContent = `${M.servicesInWater} de ${M.services}`;

/* ---------------- cronología real ---------------- */
const img = RES.entradas.imagenes ?? [];
const TL = [
  ['14:30', 'Lluvia extraordinaria; ríos y barrancos desbordados (inicio del evento según CEMS)'],
  ['16:40', 'Activación de Copernicus EMS (EMSR773)'],
  ['19:11', 'ES-Alert enviado (20:11 hora peninsular; fuente de prensa citada en el repositorio)'],
  ...img.map((s) => { const [sat, when] = s.split(' '); return [when?.slice(5, 16).replace('T', ' ') ?? '', `Imagen ${sat}: base de la extensión de agua observada`]; }),
  ['ahora', `SENDA recalcula agua, tramos, puentes, servicios e integridad en ${nf(calcMs)} ms en este navegador`],
];
$('#timeline').innerHTML = TL.map(([t, x]) => `<li><span class="t">${t}</span>${x}</li>`).join('');

/* ---------------- flujo de decisión ---------------- */
const step = (id, st, html, done = true) => { const el = $(id); el.classList.toggle('done', done); el.querySelector('.st').textContent = st; el.querySelector('.body').innerHTML = html; };
const rows = (r) => r.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
{ // 1 · verificación: fuente oficial + testigos (simulados, con el motor real)
  const c = [-0.4189, 39.4155], at = Date.UTC(2024, 9, 29, 17, 5);
  const reps = [0, 1, 2].map((i) => ({ kind: 'STREET_FLOODED', lat: c[1] + 0.001 * i, lon: c[0] - 0.001 * i, at: at + i * 120000, deviceId: `testigo-${i}` }));
  reps.push({ kind: 'RIVER_RISING', lat: c[1], lon: c[0], at: at + 400000, deviceId: 'medida-1', measurement: { rise: { cmPerMin: 2.1, stdErr: 0.4 } } });
  const a = assessIncident(clusterReports(reps)[0]);
  step('#s1', 'Confirmado', rows([['Cartografía oficial', `Copernicus EMS · ${A.agua.basis === 'OFFICIAL_MAPPING' ? 'oficial' : '—'}`], ['Imágenes', img.length ? img.map((s) => s.split(' ')[0]).join(' · ') : '—'], ['Testigos (simulados)', `${a.reporters} claves · ${nf(100 * a.pReal)} % · ${a.state === 'RECON' ? 'reconocimiento' : a.state === 'CORROBORATED' ? 'corroborado' : 'rumor'}`]]) + `<p class="note">Los testigos no emiten alertas: suman evidencia auditable (<span class="mono">hazard-reports.mjs</span>). La fuente oficial y la persona responsable deciden.</p>`);
}
{ // 2 · afectación
  step('#s2', 'Delimitado', rows([['Personas en la zona del evento', `${nf(ST['Population [No.]'])} (CEMS, toda la activación)`], ['Edificios con agua', `${nf(bWet)} calculados aquí · ${nf(M.proxy.wet)} en el cálculo de referencia`], ['Edificios aislados (sin agua)', nf(M.proxy.isolated)], ['Superficie del evento', `${nf(ST['Event Extent [ha]'], 1)} ha (CEMS)`]]) + `<p class="note">Edificios: indicador de dónde hay gente, no población. La diferencia entre ambos recuentos es la tolerancia del contorno (${A.agua.toleranciaGrados}°).</p>`);
}
{ // 3 · lo que sigue funcionando
  const hosp = services.filter((s) => s.kind === 'hospital'), wetS = services.filter((s) => s.wet);
  step('#s3', `${services.length - wetS.length} de ${services.length} servicios sin agua`, rows([['Calles con agua', `${nf(wetKm, 1)} km de ${nf(totKm, 1)} (aquí) · ${nf(M.wetStreetKm, 1)} km (referencia)`], ['Tramos de puente cortados', `${nf(M.cutBridgeSegments)} · ${bridgeWet.length} puentes con agua (aquí)`], ['Bolsas aisladas', `${M.isolatedPockets} · la mayor con ${nf(M.largestPocketNodes)} nodos`], ['Acceso al servicio más cercano', `${nf(M.meanDistBeforeM)} → ${nf(M.meanDistAfterM)} m de media · peor caso +${nf(M.maxIncreaseM)} m`], ['Hospitales (edificios en OSM)', `${hosp.length} · ${hosp.filter((h) => h.wet).length} con agua`], ['Centros de salud', `${services.filter((x) => x.kind === 'clinic').length} · ${services.filter((x) => x.kind === 'clinic' && x.wet).length} con agua`]]));
}
{ // 4 · caminos del aviso hacia las bolsas aisladas
  const plan = planMultiBearer(240, [{ id: 'PHONE_MESH' }, { id: 'SAT_D2C_SMS' }, { id: 'MESHTASTIC' }, { id: 'DRONE_MULE' }], { target: 0.99 });
  const au = auditIndependentPlan(plan, { STORM: { ...DEFAULT_HAZARDS.STORM, prob: 1 } });
  const per = {}; for (const m of plan.messages) per[m.id] = (per[m.id] ?? 0) + m.shards;
  const NAMES = { PHONE_MESH: 'Vecinos (Bluetooth/Wi-Fi)', SAT_D2C_SMS: 'Satélite al móvil', MESHTASTIC: 'LoRa', DRONE_MULE: 'Dron mula' };
  step('#s4', `${nf(100 * au.actual, 1)} % con tormenta`, rows([['Plan', `k = ${plan.k} de n = ${plan.n} fragmentos`], ...Object.entries(per).map(([k, v]) => [NAMES[k], `${v} fragm.`]), ['Si fallasen por separado', `${nf(100 * au.claimed, 2)} %`], ['Con lluvia de 50 mm/h (fallos comunes)', `${nf(100 * au.actual, 2)} %`]]) + `<div class="pbar"><i style="width:${100 * au.actual}%;background:var(--ok)"></i></div><p class="note">Para las bolsas aisladas, donde la antena no llega. Probabilidades de planificación hasta el ensayo de campo (<span class="mono">bearers.mjs</span>, <span class="mono">delivery-assurance.mjs</span>).</p>`);
}
{ // 5 · CAP 1.2: borrador, firma de una persona y cadena de auditoría
  const xs = A.agua.anillos.flat(), lo = xs.map((p) => p[0]), la = xs.map((p) => p[1]);
  const [w, e, s, n] = [Math.min(...lo), Math.max(...lo), Math.min(...la), Math.max(...la)].map((v) => +v.toFixed(4));
  const cap = toCap({ identifier: `SENDA-EJ-EMSR773-${Date.now()}`, sender: 'senda@organismo.example', sent: new Date(), status: 'Exercise', msgType: 'Alert', scope: 'Restricted', info: {
    category: 'Met', event: 'Inundación', urgency: 'Immediate', severity: 'Extreme', certainty: 'Observed', senderName: 'EJERCICIO · Sala SENDA',
    headline: 'Inundación grave en l\'Horta Sud', description: `Agua observada por Copernicus EMS (EMSR773). ${nf(M.wetStreetKm, 1)} km de calles afectadas; ${M.isolatedPockets} zonas aisladas.`,
    instruction: 'Suba a un piso alto. No use el coche. No baje a garajes ni sótanos. Responda a esta alerta con su estado.',
    area: { areaDesc: 'l\'Horta Sud (extensión de agua observada)', polygon: [[s, w], [s, e], [n, e], [n, w], [s, w]] } } });
  const log = createAuditLog();
  step('#s5', 'Listo para firmar', `<pre class="cap" aria-label="Borrador CAP 1.2">${cap.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="pri" id="sign">Firmar como responsable</button><button id="verify">Verificar cadena</button></div><div id="sig" class="note"></div>`, false);
  let keys = null;
  $('#sign').addEventListener('click', async () => {
    keys ??= await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(cap));
    const capHash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cap)));
    const e = await log.append({ at: new Date().toISOString(), actor: 'responsable-ejercicio', action: 'FIRMA_ALERTA_CAP', data: { capSha256: capHash, firma: hex(sig).slice(0, 32) + '…' } });
    step('#s5', 'Firmada (ejercicio)', $('#s5 .body').innerHTML, true);
    $('#sig').innerHTML = `Firma ECDSA P-256 (64 B) sobre el CAP. Entrada ${e.seq} de la cadena de auditoría:<br><span class="hash">${e.hash}</span><br>Sale por los caminos del paso 4. Estado «Exercise»: no es una alerta real.`;
    $('#sign').disabled = true; $('#verify').onclick = verify;
  });
  async function verify() { const r = await verifyAuditLog(log.entries()); $('#sig').insertAdjacentHTML('beforeend', `<br>Verificación de la cadena: <b style="color:${r.ok ? 'var(--ok)' : 'var(--red)'}">${r.ok ? 'íntegra' : 'rota en ' + r.brokenAt}</b>`); }
  $('#verify').addEventListener('click', verify);
}

/* ---------------- lentes por sector ---------------- */
const fire = services.filter((s) => s.kind === 'fire_station'), pol = services.filter((s) => s.kind === 'police'), health = services.filter((s) => s.kind === 'hospital' || s.kind === 'clinic');
const cnt = (arr) => `${arr.filter((s) => !s.wet).length} de ${arr.length} sin agua`;
const LENSES = [
  { id: 'pc', label: 'Protección civil · 112', layers: ['water', 'roads', 'serv'], focus: null, title: 'Decidir y avisar', lines: [`<b>5 pasos</b> previos a la alerta resueltos con datos oficiales y calculados, a la derecha.`, `Borrador <b>CAP 1.2</b> con polígono listo para firmar y cadena de auditoría SHA-256.`, `Probabilidad honesta de que el aviso llegue a las <b>${M.isolatedPockets} bolsas aisladas</b>.`] },
  { id: 'bom', label: 'Bomberos', layers: ['water', 'roads', 'bridges', 'serv'], focus: 'fire_station', title: 'Por dónde se puede entrar', lines: [`Parques de bomberos: <b>${cnt(fire)}</b>.`, `<b>${bridgeWet.length}</b> puentes con agua y <b>${nf(M.cutBridgeSegments)}</b> tramos de puente cortados.`, `<b>${M.isolatedPockets}</b> bolsas aisladas; la mayor, <b>${nf(M.largestPocketNodes)}</b> nodos de calle.`] },
  { id: 'gc', label: 'Guardia Civil · tráfico', layers: ['water', 'wetroads', 'bridges'], focus: null, title: 'Dónde cortar y desviar', lines: [`<b>${nf(wetKm, 1)} km</b> de vía con agua calculados aquí sobre ${nf(totKm, 1)} km.`, `<b>${nf(M.cutSegments)}</b> segmentos cortados en el cálculo de referencia.`, 'Desvíos con la red que sigue seca, por tipo de vía.'] },
  { id: 'pl', label: 'Policía local', layers: ['water', 'roads', 'serv'], focus: 'police', title: 'Separar el rumor de lo real', lines: [`Comisarías: <b>${cnt(pol)}</b>.`, 'Avisos vecinales agrupados y puntuados con reglas auditables (paso 1).', 'Lo que no se puede verificar queda marcado como tal.'] },
  { id: 'san', label: 'Sanitarios · SVA', layers: ['water', 'roads', 'serv'], focus: 'health', title: 'Qué centros siguen accesibles', lines: [`Hospitales y centros de salud: <b>${cnt(health)}</b>.`, `Distancia media al servicio: <b>${nf(M.meanDistBeforeM)} → ${nf(M.meanDistAfterM)} m</b>; peor caso <b>+${nf(M.maxIncreaseM)} m</b>.`, 'Sin datos de ocupación: no se muestran.'] },
  { id: 'ume', label: 'UME · militar', layers: ['water', 'build'], focus: null, title: 'Logística a las zonas aisladas', lines: [`<b>${M.isolatedPockets}</b> bolsas; <b>${nf(M.proxy.isolated)}</b> edificios aislados sin agua.`, 'Caminos sin infraestructura: dron mula, LoRa y satélite al móvil (paso 4).', 'Cada salida de dron, comprobada contra su autonomía (<span class="mono">drone.mjs</span>).'] },
  { id: 'vec', label: 'Vecino', layers: ['water', 'roads'], focus: null, title: 'La alerta que se responde', lines: ['Recibe la instrucción y responde: estoy bien, necesito ayuda, puedo ayudar, envío lo que veo.', 'Su respuesta firmada vuelve a esta sala por el camino que quede.', '<a href="/senda/explica#camino">Verlo en el teléfono</a>'] },
  { id: 'gob', label: 'Gobierno', layers: ['water', 'roads', 'serv'], focus: null, title: 'El valor para la ciudadanía', lines: [`Evento 14:30 UTC · Copernicus 16:40 · ES-Alert 19:11 UTC.`, `Con los datos disponibles, el trabajo previo a la alerta se recalcula en <b>${nf(calcMs)} ms</b>; la decisión sigue siendo humana.`, 'Capa abierta y soberana por encima de los sistemas que ya existen.'] },
  { id: 'cyb', label: 'Ciberseguridad · OSINT', layers: ['water', 'roads'], focus: null, title: 'Procedencia e integridad', lines: ['Cada capa con fuente, licencia y huella <b>SHA-256 calculada en este navegador</b> (abajo a la derecha).', 'Firma ECDSA P-256 y cadena de auditoría verificable.', 'Límites declarados: claves ≠ personas (Sybil); sensores sin autenticar no puntúan.'] },
  { id: 'dat', label: 'Integradores de datos', layers: ['water', 'roads', 'wetroads', 'serv'], focus: null, title: 'La capa que habla todos los idiomas', lines: ['Entra: Copernicus EMS, OpenStreetMap, DATEX II, CAP, GTFS, TLE, testigos.', 'Sale: CAP 1.2, mapeo EMSI (ISO/TR 22351), GeoJSON, auditoría.', 'Núcleo abierto de 159 módulos y 883 pruebas.'] },
];
let lens = LENSES[0], layers = new Set(lens.layers);
$('#lens').innerHTML = LENSES.map((l) => `<button data-id="${l.id}" aria-pressed="${l === lens}">${l.label}</button>`).join('');
const syncLayers = () => document.querySelectorAll('[data-l]').forEach((i) => (i.checked = layers.has(i.dataset.l)));
const showLens = () => { $('#lenscard').innerHTML = `<h3>${lens.label}: ${lens.title}</h3><ul>${lens.lines.map((x) => `<li>${x}</li>`).join('')}</ul>`; document.querySelectorAll('#lens button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === lens.id))); };
$('#lens').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; lens = LENSES.find((l) => l.id === b.dataset.id); layers = new Set(lens.layers); syncLayers(); showLens(); draw(); });
document.querySelectorAll('[data-l]').forEach((i) => i.addEventListener('change', () => { i.checked ? layers.add(i.dataset.l) : layers.delete(i.dataset.l); draw(); }));
syncLayers(); showLens();

/* ---------------- mapa ---------------- */
const cv = $('#map'), g = cv.getContext('2d'); let DPR = 1, view = null;
const HW = { motorway: 3, trunk: 2.6, primary: 2.2, secondary: 1.8, tertiary: 1.4, motorway_link: 1.4, trunk_link: 1.4, primary_link: 1.2 };
function fit() { const r = cv.getBoundingClientRect(); DPR = Math.min(2, devicePixelRatio || 1); cv.width = r.width * DPR; cv.height = r.height * DPR; const sx = cv.width / ((E0 - W0) * KX), sy = cv.height / (N0 - S0); view = { s: Math.min(sx, sy) * 0.98, cx: (W0 + E0) / 2, cy: (S0 + N0) / 2 }; draw(); }
const P = (lon, lat) => [cv.width / 2 + (lon - view.cx) * KX * view.s, cv.height / 2 - (lat - view.cy) * view.s];
function draw() {
  if (!view) return; g.fillStyle = '#0a0c0f'; g.fillRect(0, 0, cv.width, cv.height);
  if (layers.has('water')) { g.fillStyle = 'rgba(61,123,240,.42)'; g.strokeStyle = 'rgba(120,165,255,.75)'; g.lineWidth = DPR; g.beginPath(); for (const ring of A.agua.anillos) { ring.forEach(([lo, la], i) => { const [x, y] = P(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); } g.fill('evenodd'); g.stroke(); }
  if (layers.has('build')) { g.fillStyle = 'rgba(190,198,208,.28)'; for (let i = 0; i < B.length; i += 2) { const [x, y] = P(B[i][0], B[i][1]); g.fillRect(x, y, DPR, DPR); } }
  if (layers.has('roads')) for (const w of ways) { const wd = (HW[w.hw] ?? 0.7) * DPR * Math.max(0.6, Math.min(2.2, view.s / 9000)); g.strokeStyle = HW[w.hw] ? '#6b7480' : '#3a414b'; g.lineWidth = wd; g.beginPath(); w.n.forEach((k, i) => { const [x, y] = P(C[k][0], C[k][1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  if (layers.has('wetroads')) { g.strokeStyle = '#f0a73a'; g.lineWidth = 1.4 * DPR; g.beginPath(); for (const [a, b] of wetSeg) { const p = P(C[a][0], C[a][1]), q = P(C[b][0], C[b][1]); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); } g.stroke(); }
  if (layers.has('bridges')) { g.strokeStyle = '#e5484d'; g.lineWidth = 4 * DPR; for (const w of bridgeWet) { g.beginPath(); w.n.forEach((k, i) => { const [x, y] = P(C[k][0], C[k][1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); } }
  if (layers.has('serv')) for (const s of services) {
    const [x, y] = P(s.lon, s.lat), on = !lens.focus || s.kind === lens.focus || (lens.focus === 'health' && (s.kind === 'hospital' || s.kind === 'clinic')), r = (on ? 5.5 : 3.5) * DPR;
    g.globalAlpha = on ? 1 : 0.35; g.fillStyle = s.wet ? '#e5484d' : '#ffffff'; g.strokeStyle = '#0a0c0f'; g.lineWidth = 1.5 * DPR; g.beginPath();
    if (s.kind === 'hospital') g.rect(x - r, y - r, 2 * r, 2 * r); else if (s.kind === 'fire_station') { g.moveTo(x, y - r * 1.2); g.lineTo(x + r, y + r); g.lineTo(x - r, y + r); g.closePath(); } else if (s.kind === 'police') { g.moveTo(x, y - r * 1.2); g.lineTo(x + r * 1.2, y); g.lineTo(x, y + r * 1.2); g.lineTo(x - r * 1.2, y); g.closePath(); } else g.arc(x, y, r * 0.85, 0, 7);
    g.fill(); g.stroke(); g.globalAlpha = 1;
  }
  const px = (1 / 111.32) * view.s, x0 = 14 * DPR, y0 = 62 * DPR; g.fillStyle = '#c9ced4'; g.fillRect(x0, y0, px, 2 * DPR); g.fillRect(x0, y0 - 4 * DPR, DPR, 6 * DPR); g.fillRect(x0 + px - DPR, y0 - 4 * DPR, DPR, 6 * DPR); g.font = `${11 * DPR}px Inter,sans-serif`; g.fillText('1 km', x0 + px + 6 * DPR, y0 + 3 * DPR);
}
new ResizeObserver(fit).observe(cv);
let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
cv.addEventListener('pointermove', (e) => {
  if (drag) { view.cx = drag.cx - ((e.clientX - drag.x) * DPR) / (KX * view.s); view.cy = drag.cy + ((e.clientY - drag.y) * DPR) / view.s; draw(); return; }
  const r = cv.getBoundingClientRect(), mxp = (e.clientX - r.left) * DPR, myp = (e.clientY - r.top) * DPR; let best = null, bd = 12 * DPR;
  if (layers.has('serv')) for (const s of services) { const [x, y] = P(s.lon, s.lat), d = Math.hypot(x - mxp, y - myp); if (d < bd) { bd = d; best = s; } }
  const tip = $('#tip'); if (!best) { tip.style.display = 'none'; return; }
  tip.style.display = 'block'; tip.style.left = `${e.clientX - r.left + 14}px`; tip.style.top = `${e.clientY - r.top + 14}px`;
  tip.innerHTML = `<b>${best.name ?? 'Sin nombre en OSM'}</b><br>${A.tiposServicio[best.kind] ?? best.kind} · ${best.wet ? '<span style="color:var(--red)">dentro del agua observada</span>' : 'fuera del agua observada'}`;
});
addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
const zoom = (f) => { view.s = Math.max(2000, Math.min(400000, view.s * f)); draw(); };
$('#z-in').onclick = () => zoom(1.4); $('#z-out').onclick = () => zoom(1 / 1.4); $('#z-fit').onclick = fit;

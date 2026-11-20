// SENDA · El ciclo completo. Siete verbos con su demostración y la malla de verificadores.
// La malla ejecuta los módulos reales del núcleo: drive-autostart.mjs (arranque al conducir, con
// consentimiento) y hazard-reports.mjs (agrupar avisos y contrastarlos). Carreteras, coches y
// velocidades de la animación son una SIMULACIÓN con parámetros de ejemplo declarados.
import { createAutostart, EXAMPLE_AUTOSTART, AUTOSTART_STATES } from '/senda/core/drive-autostart.mjs';
import { clusterReports, assessIncident, HAZARD_KINDS } from '/senda/core/hazard-reports.mjs';

const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────────── 1. Los siete verbos ───────────── */
const VERBS = [
  { v: 'Ve', h: 'Junta lo que ya mira el territorio', p: 'Satélites, cámaras públicas de tráfico, sensores del móvil y avisos de la gente, en un mismo mapa y con su hora y su fuente.',
    li: ['Escenas Sentinel-2 reales del incendio de San Martín de Valdeiglesias (2026), con ángulo y fecha de captura.', '1.975 cámaras públicas de la DGT (licencia CC BY), con carretera, sentido y disponibilidad medida.', 'Cada dato lleva su procedencia: quién, cuándo y huella SHA-256.'],
    links: [['Simulador 3D', '/senda/simulador'], ['Cámaras', '/senda/camaras'], ['El ojo', '/senda/ojo']] },
  { v: 'Previene', h: 'Calcula lo que viene antes de que llegue', p: 'Con pocos datos (un punto de ignición y el viento) calcula hacia dónde puede ir el fuego sobre el relieve real; con un nivel de agua, qué queda debajo; con seis móviles, dónde fue un terremoto.',
    li: ['Avance del fuego con wildfire.mjs sobre el modelo digital del terreno real de 100 m.', 'Contraste honesto: el modelo calibrado coincide un 35,2 % (Jaccard) con la cicatriz vista por satélite.', 'Epicentro con seis teléfonos y segundos de margen antes de la onda S.'],
    links: [['Probar en el simulador', '/senda/simulador'], ['Sala de decisión', '/senda/sala']] },
  { v: 'Dirige', h: 'Elige el camino que sigue abierto', p: 'Rutas que esquivan calles inundadas y fuego, y para los mensajes, el canal que funciona: datos, SMS, LoRa, satélite, sonido o luz.',
    li: ['planMultiBearer reparte un mensaje en trozos por varios canales a la vez.', 'Si un canal cae, los trozos de los demás bastan para reconstruirlo (código de borrado).', 'Evacuación que cruza fuego, atascos aguas abajo y tramos sin cerrar; en la DANA, calles mojadas descartadas.'],
    links: [['Evacuación', '/senda/evacuacion'], ['El viaje del mensaje', '/senda/viaje'], ['Carretera', '/senda/carretera']] },
  { v: 'Organiza', h: 'Convierte cien avisos en tres incidentes', p: 'Agrupa los avisos que hablan de lo mismo, cerca y a la vez, y los pone en cola por gravedad y riesgo para la vida.',
    li: ['clusterReports agrupa por familia, distancia y ventana de tiempo.', 'triageQueue ordena por gravedad, personas atrapadas o heridas y riesgo para la vida.', 'Los avisos repetidos se cuentan una vez: el operador ve incidentes, no ruido.'],
    links: [['Triaje', '/senda/triaje'], ['Centro', '/senda/centro']] },
  { v: 'Alerta', h: 'Avisos que se pueden responder', p: 'Prepara la alerta en formato CAP firmado para que la autoridad la emita. En vez de un pitido, una alerta con mapa, ruta y botón de «estoy bien» o «necesito ayuda».',
    li: ['La alerta pública solo la emite una autoridad con credencial: en este laboratorio canPublicWarn es siempre falso.', 'CAP 1.2, el estándar abierto de OASIS para avisos de emergencia.', 'La respuesta vuelve aunque no haya datos, por cualquier canal disponible.'],
    links: [['Avisos', '/senda/avisos'], ['Sala de decisión', '/senda/sala']] },
  { v: 'Ayuda', h: 'La gente cercana, cuando hace falta', p: 'Quien está cerca y ha aceptado puede confirmar un accidente, llevar un mensaje de quien no tiene cobertura o acompañar a alguien hasta que llegan los equipos.',
    li: ['Arranque automático al conducir, solo con consentimiento (drive-autostart.mjs).', 'La autoridad pide; la persona decide si acepta.', 'Más abajo, en esta misma página, lo ves funcionar.'],
    links: [['Ver la malla', '#malla'], ['Enviar un mensaje', '/senda/mensaje']] },
  { v: 'Gestiona', h: 'Todo queda escrito y se puede auditar', p: 'Cada paso queda en un registro encadenado: quién vio qué, quién decidió y cuándo. Sirve para coordinar hoy y para rendir cuentas mañana.',
    li: ['createAuditLog y verifyAuditLog: un registro que delata cualquier cambio.', 'Exporta a los sistemas que ya existen (CAP, GeoJSON) sin sustituirlos.', 'Estado del sistema y de las pruebas, publicado.'],
    links: [['Estado y pruebas', '/senda/estado'], ['Plataforma', '/senda/plataforma']] },
];

const CX = 260, CY = 260, R = 190, CIRC = 2 * Math.PI * R;
const gVerbs = $('#verbs'), card = $('#vcard'), sweep = $('#sweep');
const NS = 'http://www.w3.org/2000/svg';
VERBS.forEach((it, i) => {
  const a = -Math.PI / 2 + (i / VERBS.length) * 2 * Math.PI, x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'verb'); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', it.v);
  const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 11); c.setAttribute('fill', '#121519'); c.setAttribute('stroke', '#4a525d'); c.setAttribute('stroke-width', 2);
  const t = document.createElementNS(NS, 'text'); const out = 34; const tx = CX + (R + out) * Math.cos(a), ty = CY + (R + out) * Math.sin(a) + 5;
  t.setAttribute('x', tx); t.setAttribute('y', ty); t.setAttribute('text-anchor', Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'); t.textContent = it.v;
  if (Math.abs(Math.cos(a)) >= 0.2) t.setAttribute('x', CX + (R + 20) * Math.cos(a));
  g.append(c, t); gVerbs.append(g);
  const go = () => { auto = false; show(i); };
  g.addEventListener('click', go); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
});
let cur = 0, auto = !reduce, t0 = performance.now();
function show(i) {
  cur = i; t0 = performance.now();
  [...gVerbs.children].forEach((g, k) => g.classList.toggle('on', k === i));
  const it = VERBS[i];
  card.innerHTML = `<p class="k">${i + 1} de 7 · ${it.v}</p><h3>${it.h}</h3><p>${it.p}</p><ul>${it.li.map((x) => `<li>${x}</li>`).join('')}</ul><div class="links">${it.links.map(([l, h]) => `<a href="${h}">${l}</a>`).join('')}</div>`;
  sweep.setAttribute('stroke-dasharray', `${((i + 1) / VERBS.length) * CIRC} ${CIRC}`);
}
show(0);
const DWELL = 7000;
function tickVerbs(now) { if (auto && now - t0 > DWELL) show((cur + 1) % VERBS.length); requestAnimationFrame(tickVerbs); }
requestAnimationFrame(tickVerbs);
document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('button,input')) return;
  if (e.key === 'ArrowRight') { auto = false; show((cur + 1) % 7); } if (e.key === 'ArrowLeft') { auto = false; show((cur + 6) % 7); }
});

/* ───────────── 2. La malla de verificadores ───────────── */
// Mapa simulado: 1 px = 6 m. Velocidad de ejemplo declarada: 25 m/s (90 km/h). Reloj ×10.
const M_PER_PX = 6, SPEED_MS = 25, TIME_SCALE = 10;
const BASE = { lat: 40.36, lon: -4.39 };
const toLL = (x, y) => ({ lat: BASE.lat - (y * M_PER_PX) / 111_320, lon: BASE.lon + (x * M_PER_PX) / (111_320 * Math.cos(BASE.lat * Math.PI / 180)) });
const ROADS = {
  A: { a: [0, 330], b: [1000, 330], name: 'Autovía (ejemplo)' },
  B: { a: [170, 0], b: [770, 560], name: 'Carretera secundaria (ejemplo)' },
};
for (const r of Object.values(ROADS)) { r.len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]); r.ux = (r.b[0] - r.a[0]) / r.len; r.uy = (r.b[1] - r.a[1]) / r.len; }
// Cruce de A (y = 330) con B.
const sB_I = (330 - ROADS.B.a[1]) / ROADS.B.uy; const I = [ROADS.B.a[0] + ROADS.B.ux * sB_I, 330]; const sA_I = I[0];
const pointOn = (road, s, lane = 0) => { const r = ROADS[road]; return [r.a[0] + r.ux * s - r.uy * lane, r.a[1] + r.uy * s + r.ux * lane]; };

const cv = $('#road'), ctx = cv.getContext('2d');
const logEl = $('#log'), stEl = $('#st');
let cars, crash, reqs, simT, phase, machine, reports, lastAssess, last;

function addLog(html) { const li = document.createElement('li'); li.innerHTML = `<span class="t">${clock(simT)}</span>${html}`; logEl.prepend(li); }
const km = (px, up = false) => ((up ? Math.ceil : Math.round)(px * M_PER_PX / 100) / 10).toLocaleString('es-ES', { minimumFractionDigits: 1 });
const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function renderStates() { stEl.innerHTML = AUTOSTART_STATES.map((s) => `<span class="${machine.state === s ? 'on' : ''}">${s}</span>`).join(''); }
function feed(ev, label) {
  const r = machine.handle({ ...ev, t: simT });
  renderStates();
  addLog(`<b>${label}</b> → estado <span class="mono">${r.state}</span>${r.actions.map((a) => ` · <span class="mono">${a.type}</span> (${a.reason})`).join('')}`);
  return r;
}

function reset() {
  simT = 0; phase = 'drive'; reqs = []; reports = []; crash = null; lastAssess = null; logEl.innerHTML = '';
  // dir: +1 avanza en s, −1 retrocede. senda: la persona aceptó la malla. me: la conductora protagonista.
  cars = [
    { id: 'tu', road: 'A', s: 380, dir: 1, senda: true, me: true },
    { id: 'c1', road: 'A', s: 210, dir: 1, senda: true },
    { id: 'c2', road: 'A', s: 880, dir: -1, senda: true },
    { id: 'c3', road: 'B', s: 690, dir: -1, senda: true },
    { id: 'c4', road: 'A', s: 60, dir: 1, senda: true },
    { id: 'g1', road: 'A', s: 300, dir: 1, senda: false },
    { id: 'g2', road: 'A', s: 700, dir: -1, senda: false },
    { id: 'g3', road: 'B', s: 330, dir: 1, senda: false },
    { id: 'v', road: 'A', s: 470, dir: 1, senda: true, victim: true },
  ].map((c) => ({ ...c, moving: true, state: 'drive' }));
  machine = createAutostart(EXAMPLE_AUTOSTART);
  feed({ type: 'CONSENT', autoStart: true }, 'Tu móvil: aceptaste el arranque automático');
  feed({ type: 'CAR_LINK_APPEARED' }, 'Tu móvil: detecta el Bluetooth de tu coche');
  $('#b-crash').disabled = false; $('#b-ask').disabled = true;
}

function assess(label) {
  const inc = clusterReports(reports, { radiusM: 400, windowMin: 60 });
  const a = assessIncident(inc[0]);
  lastAssess = a;
  addLog(`<b>${label}</b> · ${a.reporters} móvil(es) distinto(s) · probabilidad de que sea real <b>${Math.round(a.pReal * 100)} %</b> · estado <span class="mono">${a.state}</span>`);
  return a;
}
function report(car) {
  const [x, y] = pointOn(car.road, car.s);
  reports.push({ kind: 'ROAD_BLOCKED', deviceId: car.id, at: Date.UTC(2026, 10, 20, 9, 0, 0) + simT * 1000, ...toLL(x, y) });
}

function doCrash() {
  const v = cars.find((c) => c.victim); v.moving = false; v.state = 'crash';
  crash = { road: v.road, s: v.s, t: simT };
  report(v);
  addLog(`<b>Accidente</b>: el móvil del coche accidentado manda un aviso «${HAZARD_KINDS.ROAD_BLOCKED.label}». Viaja por el canal que haya: datos, SMS o de móvil a móvil.`);
  assess('SENDA contrasta');
  addLog('Con un solo aviso, SENDA no lo da por cierto: lo marca como <span class="mono">RUMOR</span> y avisa al 112.');
  $('#b-crash').disabled = true; $('#b-ask').disabled = false; phase = 'crash';
}

// Distancia por carretera hasta el accidente (en A), pasando por el cruce si hace falta.
function routeTo(car) {
  if (car.road === 'A') { const target = crash.s + (car.s > crash.s ? 18 : -18); return { d: Math.abs(target - car.s), path: [['A', target]] }; }
  const dB = Math.abs(sB_I - car.s), side = sA_I > crash.s ? 18 : -18, target = crash.s + side;
  return { d: dB + Math.abs(sA_I - target), path: [['B', sB_I], ['A', target]] };
}

function doAsk() {
  $('#b-ask').disabled = true; phase = 'ask';
  const cands = cars.filter((c) => c.senda && !c.victim).map((c) => ({ c, ...routeTo(c) })).sort((a, b) => a.d - b.d).slice(0, 3);
  addLog(`<b>El 112 pide ayuda cercana</b>. SENDA busca conductores con la malla activada y en ruta: encuentra ${cands.length} a menos de ${km(cands[cands.length - 1].d, true)} km por carretera.`);
  const decliner = cands.filter((k) => !k.c.me).at(-1); // EJEMPLO: uno de los avisados no puede parar
  cands.forEach((k, i) => {
    const eta = (k.d * M_PER_PX) / SPEED_MS;
    const accept = k !== decliner;
    reqs.push({ car: k.c, d: k.d, eta, accept, at: simT + 4 + i * 2, path: k.path });
  });
}

function step(dt) {
  simT += dt;
  for (const c of cars) {
    if (c.state === 'go') {
      const target = c.path[0][1];
      const ds = (SPEED_MS / M_PER_PX) * dt, rem = target - c.s;
      if (Math.abs(rem) <= ds) {
        c.s = target; c.path.shift();
        if (c.path.length && c.path[0][0] !== c.road) { c.road = c.path[0][0]; c.s = c.road === 'A' ? sA_I : sB_I; }
        if (!c.path.length) { c.state = 'there'; c.moving = false; arrive(c); }
      } else c.s += Math.sign(rem) * ds;
      continue;
    }
    if (!c.moving) continue;
    c.s += c.dir * (SPEED_MS / M_PER_PX) * dt;
    const L = ROADS[c.road].len; if (c.s > L + 20) c.s = -20; if (c.s < -20) c.s = L + 20;
    // los coches que van por el carril del accidente lo esquivan sin parar (simulación)
  }
  for (const r of reqs) {
    if (r.done || simT < r.at) continue; r.done = true;
    const who = r.car.me ? 'Tú' : `Conductor ${r.car.id.toUpperCase()}`;
    if (r.accept) {
      addLog(r.car.me ? `<b>Tú</b> recibes la petición a ${km(r.d)} km (llegada estimada ${Math.round(r.eta)} s) y <b>aceptas</b>. SENDA te indica dónde detenerte a distancia segura.` : `<b>${who}</b> recibe la petición a ${km(r.d)} km (llegada estimada ${Math.round(r.eta)} s) y <b>acepta</b>. Se le indica dónde detenerse a distancia segura.`);
      r.car.state = 'go'; r.car.path = r.path.map((p) => [...p]);
    } else addLog(`<b>${who}</b> ${r.car.me ? 'recibes la petición y <b>no puedes parar</b>' : 'recibe la petición y <b>no puede parar</b>'}. No pasa nada: nadie está obligado y ya hay otros en camino.`);
  }
}

function arrive(c) {
  report(c);
  const who = c.me ? 'Tú' : `Conductor ${c.id.toUpperCase()}`;
  const a = assess(c.me ? 'Llegas y lo confirmas desde el arcén' : `${who} llega y lo confirma desde el arcén`);
  if (a.state !== 'RUMOR' && phase !== 'confirmed') {
    phase = 'confirmed';
    addLog(`<b>Confirmado</b>: tres móviles distintos (el del coche accidentado y dos testigos) coinciden en el mismo punto. El 112 recibe el punto, el carril y los tres avisos. La alerta pública la decide el 112 (<span class="mono">canPublicWarn: ${a.canPublicWarn}</span>).`);
    setTimeout(() => {
      if (phase !== 'confirmed') return;
      addLog('Llegan los equipos. Los voluntarios siguen su camino.');
      for (const k of cars) if (k.state === 'there') { k.state = 'drive'; k.moving = true; k.dir = k.road === 'A' ? 1 : k.dir; }
      if (cars.find((k) => k.me)?.state === 'drive') { feed({ type: 'CAR_LINK_GONE' }, 'Más tarde aparcas: el coche se desconecta'); simT += EXAMPLE_AUTOSTART.endGraceS; feed({ type: 'TICK' }, `${EXAMPLE_AUTOSTART.endGraceS} s después`); }
      phase = 'done';
    }, reduce ? 0 : 4000);
  }
}

// Dibujo
function draw(now) {
  ctx.fillStyle = '#0a0c0f'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#151a20'; ctx.lineWidth = 1;
  for (let x = 0; x < 1000; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 560); ctx.stroke(); }
  for (let y = 0; y < 560; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke(); }
  for (const [k, r] of Object.entries(ROADS)) {
    ctx.strokeStyle = '#2a3038'; ctx.lineWidth = k === 'A' ? 30 : 22; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(...r.a); ctx.lineTo(...r.b); ctx.stroke();
    ctx.strokeStyle = '#4a525d'; ctx.lineWidth = 1.5; ctx.setLineDash([12, 12]);
    ctx.beginPath(); ctx.moveTo(...r.a); ctx.lineTo(...r.b); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.fillStyle = '#8c949e'; ctx.font = '500 18px Inter, sans-serif';
  ctx.fillText(ROADS.A.name, 16, 302); ctx.save(); ctx.translate(...pointOn('B', 90)); ctx.rotate(Math.atan2(ROADS.B.uy, ROADS.B.ux)); ctx.fillText(ROADS.B.name, 0, -18); ctx.restore();

  if (crash) {
    const [x, y] = pointOn(crash.road, crash.s, 7);
    const ph = (now / 900) % 1;
    for (const k of [0, 0.5]) { const p = (ph + k) % 1; ctx.strokeStyle = `rgba(229,72,77,${1 - p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12 + p * 60, 0, 7); ctx.stroke(); }
  }
  for (const r of reqs) {
    if (simT < r.at - 4) continue;
    const [cx, cy] = crash ? pointOn(crash.road, crash.s, 7) : [0, 0];
    const lane = r.car.road === 'A' ? (r.car.dir > 0 ? 7 : -7) : 0;
    const [x, y] = pointOn(r.car.road, r.car.s, lane);
    ctx.strokeStyle = r.accept ? (r.done ? 'rgba(79,140,255,.75)' : 'rgba(240,167,58,.8)') : (r.done ? 'rgba(140,148,158,.35)' : 'rgba(240,167,58,.8)');
    ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const c of cars) {
    const lane = c.road === 'A' ? (c.dir > 0 || c.state === 'go' ? 7 : -7) : (c.dir > 0 ? 6 : -6);
    const [x, y] = pointOn(c.road, c.s, lane); const r = ROADS[c.road];
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(r.uy, r.ux));
    if (c.senda && !c.victim) { ctx.fillStyle = 'rgba(79,140,255,.18)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill(); }
    ctx.fillStyle = c.victim && c.state === 'crash' ? '#e5484d' : c.senda ? '#4f8cff' : '#5b636d';
    ctx.fillRect(-9, -5, 18, 10);
    if (c.me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-10, -6, 20, 12); }
    ctx.restore();
    if (c.me) { ctx.fillStyle = '#e7e9ec'; ctx.font = '600 14px Inter, sans-serif'; ctx.fillText('Tú', x + 14, y - 12); }
  }
  // Leyenda y reloj
  ctx.fillStyle = 'rgba(11,13,16,.85)'; ctx.fillRect(12, 12, 360, 92);
  ctx.font = '500 17px Inter, sans-serif'; ctx.fillStyle = '#e7e9ec'; ctx.fillText(`Reloj simulado ${clock(simT)} · ×${TIME_SCALE}`, 24, 38);
  ctx.fillStyle = '#4f8cff'; ctx.fillRect(24, 50, 14, 8); ctx.fillStyle = '#c6ccd3'; ctx.fillText('Con la malla activada', 46, 58);
  ctx.fillStyle = '#5b636d'; ctx.fillRect(24, 70, 14, 8); ctx.fillStyle = '#c6ccd3'; ctx.fillText('Sin SENDA', 46, 78);
  ctx.fillStyle = '#e5484d'; ctx.fillRect(200, 70, 14, 8); ctx.fillStyle = '#c6ccd3'; ctx.fillText('Accidente', 222, 78);
  if (lastAssess) {
    ctx.font = '500 17px Inter, sans-serif'; const w = 260, p = lastAssess.pReal; ctx.fillStyle = 'rgba(11,13,16,.85)'; ctx.fillRect(1000 - w - 36, 12, w + 24, 58);
    ctx.fillStyle = '#c6ccd3'; ctx.fillText(`¿Es real? ${Math.round(p * 100)} % · ${lastAssess.state}`, 1000 - w - 24, 34);
    ctx.fillStyle = '#242a31'; ctx.fillRect(1000 - w - 24, 46, w, 10); ctx.fillStyle = p >= 0.8 ? '#3fb27f' : '#f0a73a'; ctx.fillRect(1000 - w - 24, 46, w * p, 10);
  }
}

function loop(now) {
  const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
  if (!document.hidden && inView) step(dt * TIME_SCALE);
  draw(now);
  requestAnimationFrame(loop);
}
$('#b-crash').addEventListener('click', doCrash);
$('#b-ask').addEventListener('click', doAsk);
$('#b-reset').addEventListener('click', reset);
// El reloj de la simulación arranca cuando la carretera entra en pantalla.
let inView = false;
new IntersectionObserver((es) => { for (const e of es) inView = e.isIntersecting; }, { threshold: 0.35 }).observe(cv);
reset();
requestAnimationFrame(loop);
window.__ciclo = { get cars() { return cars.map((c) => ({ id: c.id, road: c.road, s: Math.round(c.s), dir: c.dir })); }, get crash() { return crash; }, get phase() { return phase; }, get assess() { return lastAssess; }, get state() { return machine.state; }, get simT() { return simT; } };

/**
 * SENDA · Lógica de la vista de comité de emergencias (`comite.mjs`).
 * Cola de expedientes N0–N5, mapa táctico retina con codificación de confianza/borde y selección AOI
 * circular (patrón CalmPath), escáner del área visible, línea del tiempo, pruebas a favor/en contra,
 * petición de verificación a quien pasa (`hazard-verify.mjs`), CAP 1.2 y puerta criptográfica humana N5.
 */

import {
  CITIZEN_HAZARD_TYPES,
  createCitizenKeyPair,
  createCitizenReport,
  verifyCitizenReport,
} from '/senda/core/citizen-report.mjs';
import {
  PROTOCOL_LEVELS,
  PUBLISHED_RISK_THRESHOLDS,
  createAuthorityKeyPair,
  issueAuthorityGrant,
  evaluateReportProtocol,
  authorizePublicWarningN5,
} from '/senda/core/report-protocol.mjs';
import { createAuditLog } from '/senda/core/interop.mjs';
import { haversineKm } from '/senda/core/zones.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LEVEL_COLORS = {
  N0: '#8a929c',
  N1: '#60a5fa',
  N2: '#f0a73a',
  N3: '#3fb27f',
  N4: '#ff7756',
  N5: '#e5484d',
};

const state = {
  items: [], // [{ envelope, protocol, context, passerbyChecks }]
  selectedId: null,
  levelFilter: 'ALL',
  aoiMode: false,
  aoi: null, // { lat, lon, radiusKm }
  view: { lat: 39.435, lon: -0.435, scale: 9500 }, // px por grado aprox.
  authority: null, // { anchor, authKp, grant }
  auditLog: createAuditLog(),
  tleText: null,
  eventSource: null,
};

async function loadTleSnapshot() {
  try {
    const r = await fetch('/senda/data/tle/amsat-nasabare-2026-11-20.txt');
    if (r.ok) state.tleText = await r.text();
  } catch {
    state.tleText = null;
  }
}

function visibleItems() {
  return state.items.filter((it) => {
    if (state.levelFilter !== 'ALL' && it.protocol.level !== state.levelFilter) return false;
    if (state.aoi) {
      const dKm = haversineKm(it.envelope.payload.location, state.aoi);
      if (dKm > state.aoi.radiusKm) return false;
    }
    return true;
  });
}

function sortItems() {
  state.items.sort((a, b) => {
    const ra = PROTOCOL_LEVELS[a.protocol.level]?.rank ?? -1;
    const rb = PROTOCOL_LEVELS[b.protocol.level]?.rank ?? -1;
    return rb - ra || b.protocol.posterior.p - a.protocol.posterior.p;
  });
}

/* ───────────── 1. Mapa táctico <canvas> retina ───────────── */
const mapCv = $('#map');
const mctx = mapCv.getContext('2d');

function resizeMap() {
  const rect = mapCv.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  mapCv.width = Math.max(100, Math.floor(rect.width * dpr));
  mapCv.height = Math.max(100, Math.floor(rect.height * dpr));
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawMap();
}

function project(lat, lon) {
  const rect = mapCv.parentElement.getBoundingClientRect();
  const cosLat = Math.cos((state.view.lat * Math.PI) / 180);
  const x = rect.width / 2 + (lon - state.view.lon) * state.view.scale * cosLat;
  const y = rect.height / 2 - (lat - state.view.lat) * state.view.scale;
  return [x, y];
}

function unproject(x, y) {
  const rect = mapCv.parentElement.getBoundingClientRect();
  const cosLat = Math.cos((state.view.lat * Math.PI) / 180);
  const lon = state.view.lon + (x - rect.width / 2) / (state.view.scale * cosLat);
  const lat = state.view.lat - (y - rect.height / 2) / state.view.scale;
  return { lat, lon };
}

function drawMap() {
  const rect = mapCv.parentElement.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  mctx.fillStyle = '#090b0e';
  mctx.fillRect(0, 0, w, h);

  // Cuadrícula geográfica discreta
  mctx.strokeStyle = '#161b22';
  mctx.lineWidth = 1;
  const stepDeg = state.view.scale > 5000 ? 0.02 : 0.1;
  const lat0 = Math.floor((state.view.lat - 0.5) / stepDeg) * stepDeg;
  const lon0 = Math.floor((state.view.lon - 0.8) / stepDeg) * stepDeg;
  for (let la = lat0; la <= state.view.lat + 0.5; la += stepDeg) {
    const [, y] = project(la, state.view.lon);
    if (y >= 0 && y <= h) {
      mctx.beginPath(); mctx.moveTo(0, y); mctx.lineTo(w, y); mctx.stroke();
    }
  }
  for (let lo = lon0; lo <= state.view.lon + 0.8; lo += stepDeg) {
    const [x] = project(state.view.lat, lo);
    if (x >= 0 && x <= w) {
      mctx.beginPath(); mctx.moveTo(x, 0); mctx.lineTo(x, h); mctx.stroke();
    }
  }

  // Referencia geográfica l'Horta Sud / Poyo
  const towns = [
    ['Chiva', 39.473, -0.718],
    ['Torrent', 39.437, -0.465],
    ['Picanya', 39.435, -0.435],
    ['Paiporta', 39.427, -0.417],
    ['Catarroja', 39.403, -0.402],
  ];
  mctx.fillStyle = '#5f6975';
  mctx.font = '11px Inter, system-ui, sans-serif';
  for (const [name, la, lo] of towns) {
    const [x, y] = project(la, lo);
    if (x < -40 || x > w + 40 || y < -20 || y > h + 20) continue;
    mctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    mctx.fillText(name, x + 5, y + 3);
  }

  // Círculo AOI si existe (patrón CalmPath AreaSelector)
  if (state.aoi) {
    const [cx, cy] = project(state.aoi.lat, state.aoi.lon);
    const rPx = (state.aoi.radiusKm / 111.32) * state.view.scale;
    mctx.save();
    mctx.strokeStyle = '#4f8cff';
    mctx.fillStyle = 'rgba(79,140,255,0.08)';
    mctx.setLineDash([6, 4]);
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.arc(cx, cy, Math.max(8, rPx), 0, Math.PI * 2);
    mctx.fill();
    mctx.stroke();
    mctx.restore();
  }

  // Expedientes: opacidad = probabilidad bayesiana, borde sólido = verificado instrumento (N3/N5), discontinuo = ciudadano/modelo
  for (const it of visibleItems()) {
    const loc = it.envelope.payload.location;
    const [x, y] = project(loc.lat, loc.lon);
    const col = LEVEL_COLORS[it.protocol.level] ?? '#8a929c';
    const sel = it.envelope.reportId === state.selectedId;
    const verified = it.protocol.level === 'N3' || it.protocol.level === 'N5' || it.protocol.dossier?.pillars?.satellite?.instrumentVerified;
    const alpha = Math.max(0.3, Math.min(1, it.protocol.posterior.p));

    mctx.save();
    mctx.globalAlpha = alpha;
    mctx.fillStyle = col;
    mctx.beginPath();
    mctx.arc(x, y, sel ? 11 : 8, 0, Math.PI * 2);
    mctx.fill();

    mctx.globalAlpha = 1;
    mctx.strokeStyle = sel ? '#ffffff' : col;
    mctx.lineWidth = sel ? 2.5 : 1.5;
    if (!verified) mctx.setLineDash([3, 2]);
    mctx.beginPath();
    mctx.arc(x, y, sel ? 15 : 11, 0, Math.PI * 2);
    mctx.stroke();
    mctx.setLineDash([]);

    mctx.fillStyle = '#e6e8eb';
    mctx.font = '600 11px "IBM Plex Mono", monospace';
    mctx.fillText(it.protocol.level, x + 14, y + 4);
    mctx.restore();
  }
}

mapCv.addEventListener('click', (e) => {
  const rect = mapCv.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  if (state.aoiMode) {
    const pt = unproject(mx, my);
    state.aoi = { lat: pt.lat, lon: pt.lon, radiusKm: 3.5 };
    state.aoiMode = false;
    $('#btn-aoi').setAttribute('aria-pressed', 'false');
    renderAll();
    return;
  }
  let best = null, bestD = 24;
  for (const it of visibleItems()) {
    const [x, y] = project(it.envelope.payload.location.lat, it.envelope.payload.location.lon);
    const d = Math.hypot(mx - x, my - y);
    if (d < bestD) { bestD = d; best = it; }
  }
  if (best) {
    state.selectedId = best.envelope.reportId;
    renderAll();
  }
});

$('#z-in').onclick = () => { state.view.scale *= 1.35; drawMap(); };
$('#z-out').onclick = () => { state.view.scale /= 1.35; drawMap(); };
$('#z-fit').onclick = () => {
  const list = visibleItems();
  if (!list.length) return;
  state.view.lat = list.reduce((s, x) => s + x.envelope.payload.location.lat, 0) / list.length;
  state.view.lon = list.reduce((s, x) => s + x.envelope.payload.location.lon, 0) / list.length;
  state.view.scale = 9500;
  drawMap();
};
$('#btn-aoi').onclick = () => {
  state.aoiMode = !state.aoiMode;
  $('#btn-aoi').setAttribute('aria-pressed', String(state.aoiMode));
  $('#mapinfo').innerHTML = state.aoiMode
    ? '<strong>Modo AOI activo</strong><div style="color:var(--m);margin-top:4px">Haz clic en el mapa para fijar un círculo de 3,5 km de filtro espacial.</div>'
    : '<strong>SENDA · Peritaje</strong><div style="color:var(--m);margin-top:4px">Haz clic en cualquier marcador para inspeccionar su expediente.</div>';
};
$('#btn-clear-aoi').onclick = () => { state.aoi = null; renderAll(); };

/* ───────────── 2. Escáner de área visible (patrón CalmPath) ───────────── */
$('#btn-scan').onclick = () => {
  const rect = mapCv.parentElement.getBoundingClientRect();
  const inView = visibleItems().filter((it) => {
    const [x, y] = project(it.envelope.payload.location.lat, it.envelope.payload.location.lon);
    return x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
  });
  const trapped = inView.reduce((s, x) => s + (x.envelope.payload.people?.trapped ?? 0), 0);
  const high = inView.filter((x) => ['N3', 'N4', 'N5'].includes(x.protocol.level)).length;
  const out = $('#scan-out');
  out.hidden = false;
  out.innerHTML = `<strong>Escaneo del área visible:</strong> ${inView.length} expediente(s) · ${high} en N3–N5 · ${trapped} persona(s) atrapada(s) reportada(s).`;
};

/* ───────────── 3. Renderizado de cola, línea del tiempo e inspector ───────────── */
function renderQueue() {
  const list = visibleItems();
  $('#q-count').textContent = `${list.length}/${state.items.length}`;
  const ul = $('#q-list');
  if (!list.length) {
    ul.innerHTML = '<li class="qitem" style="cursor:default;color:var(--m)">Sin expedientes con este filtro.</li>';
    return;
  }
  ul.innerHTML = list
    .map((it) => {
      const p = it.protocol, e = it.envelope;
      const meta = CITIZEN_HAZARD_TYPES[e.payload.kind];
      return `<li class="qitem" data-id="${esc(e.reportId)}" aria-current="${e.reportId === state.selectedId}">
        <div class="top">
          <span class="lvl lvl-${esc(p.level)}">${esc(p.level)} · ${esc(p.levelInfo.name)}</span>
          <span class="mono" style="color:var(--m)">${Math.round(p.posterior.p * 100)} %</span>
        </div>
        <div style="font-weight:600;margin-top:3px">${esc(meta?.label ?? e.payload.kind)}</div>
        <div class="mono" style="color:var(--d);margin-top:2px">${esc(e.operationalStatus)} · ${esc(e.reportId.slice(0, 14))}…</div>
      </li>`;
    })
    .join('');

  for (const li of ul.querySelectorAll('[data-id]')) {
    li.onclick = () => {
      state.selectedId = li.dataset.id;
      renderAll();
    };
  }
}

function renderTimeline(selected) {
  const ul = $('#tl-list');
  if (!selected) {
    $('#tl-count').textContent = '0 eventos';
    ul.innerHTML = '<li style="color:var(--m)">Selecciona un expediente para ver su secuencia de transiciones.</li>';
    return;
  }
  const trs = selected.protocol.transitions ?? [];
  $('#tl-count').textContent = `${trs.length} transición(es)`;
  ul.innerHTML = trs
    .map(
      (t) => `<li>
        <span class="mono" style="color:var(--m);flex:none">${new Date(t.atMs).toISOString().slice(11, 19)}Z</span>
        <span class="mono" style="color:${t.passed ? (t.downgrade ? 'var(--acc)' : 'var(--ok)') : 'var(--d)'};flex:none">${esc(t.from ?? '—')}→${esc(t.to)}</span>
        <span>${esc(t.proof)} <span style="color:var(--d)">(${esc(t.actor)})</span></span>
      </li>`
    )
    .join('');
}

function renderInspector() {
  const selected = state.items.find((x) => x.envelope.reportId === state.selectedId) ?? null;
  renderTimeline(selected);
  for (const id of ['#detail-evidence', '#detail-sat', '#detail-verify', '#detail-n5']) $(id).hidden = !selected;
  if (!selected) {
    $('#d-id').textContent = '—';
    $('#d-summary').textContent = 'Selecciona un expediente de la cola.';
    return;
  }
  const { envelope: e, protocol: p } = selected;
  const d = p.dossier;
  $('#d-id').textContent = e.reportId;
  $('#d-summary').innerHTML = `
    <div class="row"><span>Nivel actual</span><b class="lvl-${esc(p.level)}">${esc(p.level)} · ${esc(p.levelInfo.name)}</b></div>
    <div class="row"><span>Estado operacional</span><b class="mono">${esc(e.operationalStatus)}</b></div>
    <div class="row"><span>Aviso público (canPublicWarn)</span><b class="mono" style="color:${p.canPublicWarn ? 'var(--red)' : 'var(--ok)'}">${String(p.canPublicWarn)}</b></div>
    <div class="row"><span>Ubicación</span><b class="mono">${e.payload.location.lat.toFixed(5)}, ${e.payload.location.lon.toFixed(5)} (±${e.payload.location.accuracyM} m)</b></div>
    <div class="row"><span>Atrapados / Heridos</span><b class="mono">${e.payload.people.trapped} / ${e.payload.people.injured}</b></div>
    <p style="margin:8px 0 0;font-size:12.5px;color:#d6dce3">${esc(p.reasonPlain)}</p>
  `;

  // Probabilidad y horquilla
  const pct = (p.posterior.p * 100).toFixed(1);
  const lo = (p.posterior.ci95[0] * 100).toFixed(1);
  const hi = (p.posterior.ci95[1] * 100).toFixed(1);
  $('#d-prob').innerHTML = `<div class="row"><span>Probabilidad bayesiana</span><b class="mono">${pct} % (IC95: ${lo}–${hi} %)</b></div>`;
  $('#d-ci').style.left = `${lo}%`;
  $('#d-ci').style.width = `${Math.max(1, Number(hi) - Number(lo))}%`;
  $('#d-pt').style.left = `${pct}%`;

  $('#d-pros-cons').innerHTML = `
    <div style="margin-top:8px"><strong style="color:var(--ok);font-size:12px">Pruebas a favor (${p.pros.length})</strong>
      <ul class="ev">${p.pros.length ? p.pros.map((x) => `<li>${esc(x)}</li>`).join('') : '<li style="color:var(--d)">Ninguna destacada</li>'}</ul>
    </div>
    <div style="margin-top:8px"><strong style="color:var(--acc);font-size:12px">Pruebas en contra / salvedades (${p.cons.length})</strong>
      <ul class="ev">${p.cons.length ? p.cons.map((x) => `<li>${esc(x)}</li>`).join('') : '<li style="color:var(--d)">Ninguna</li>'}</ul>
    </div>
  `;

  // Satélite y Dawid-Skene
  const sat = d?.pillars?.satellite;
  const rel = d?.pillars?.reliability;
  const nextPass = sat?.nextPasses?.[0];
  $('#d-sat-body').innerHTML = `
    <div class="row"><span>Sensor recomendado</span><b>${esc(sat?.observability?.recommendedSensor ?? '—')}</b></div>
    <div class="row"><span>Próximo paso TLE</span><b class="mono">${nextPass ? `${esc(nextPass.satellite)} en ${nextPass.minutesFromReport} min (elev. ${nextPass.maxElevationDeg.toFixed(0)}°)` : 'Sin TLE / fuera de horizonte'}</b></div>
    <div class="row"><span>Ciudadanos independientes</span><b class="mono">${d?.pillars?.crowd?.independentCitizens ?? 1} (excluidos ${d?.pillars?.crowd?.excludedPeers?.length ?? 0})</b></div>
    <div class="row"><span>Fiabilidad Dawid-Skene</span><b class="mono">${rel ? `sens=${rel.sensitivity} esp=${rel.specificity} (n=${rel.observations}, ${rel.calibrated ? 'calibrado' : 'no calibrado'})` : '—'}</b></div>
  `;

  // Puerta N5
  const gateBox = $('#gate-box');
  const unlocked = Boolean(state.authority) && e.operationalStatus === 'ACTUAL' && ['N2', 'N3', 'N4'].includes(p.level);
  gateBox.classList.toggle('unlocked', unlocked || p.canPublicWarn);
  $('#btn-emit-n5').disabled = !unlocked;
  $('#gate-status').innerHTML = p.canPublicWarn
    ? `<strong>Autorizado (N5):</strong> firmado por ${esc(p.humanAuthorization?.decision?.authorityName)} (${esc(p.humanAuthorization?.decision?.organization)}).`
    : e.operationalStatus !== 'ACTUAL'
      ? `<strong>Bloqueado permanentemente:</strong> el expediente es <span class="mono">${esc(e.operationalStatus)}</span> (una simulación o ejercicio jamás puede activar N5).`
      : state.authority
        ? `<strong>Credencial cargada:</strong> ${esc(state.authority.grant.authorityName)} (${esc(state.authority.grant.organization)}). Nivel actual ${esc(p.level)}.`
        : '<strong>Bloqueado:</strong> <span class="mono">canPublicWarn = false</span>. Carga una credencial de autoridad Ed25519 para habilitar N5.';

  const xml = p.capPublicXml || p.capDraftXml;
  $('#cap-wrap').hidden = !xml;
  if (xml) $('#cap-xml').textContent = xml;
}

function renderAll() {
  sortItems();
  const hasSim = state.items.some((x) => x.envelope.operationalStatus !== 'ACTUAL');
  $('#mode-truth').innerHTML = state.items.length
    ? `<i class="sq ${hasSim ? 'sim' : 'real'}"></i>${state.items.length} expediente(s) · ${hasSim ? 'incluye EJERCICIO/SIMULACIÓN' : 'solo ACTUAL'}`
    : '<i class="sq sim"></i>Sin expedientes cargados';
  renderQueue();
  renderInspector();
  drawMap();
}

/* ───────────── 4. Acciones del comité: verificación y puerta N5 ───────────── */
async function reevaluateSelected() {
  const it = state.items.find((x) => x.envelope.reportId === state.selectedId);
  if (!it) return;
  it.protocol = await evaluateReportProtocol(it.envelope, {
    ...it.context,
    previousLevel: it.protocol.level,
    crowdContext: {
      ...(it.context.crowdContext || {}),
      passerbyCameraChecks: it.passerbyChecks,
    },
    satelliteContext: {
      ...(it.context.satelliteContext || {}),
      tleText: state.tleText,
    },
  });
  renderAll();
}

$('#btn-ask-verify').onclick = () => {
  const it = state.items.find((x) => x.envelope.reportId === state.selectedId);
  if (!it) return;
  const msg = $('#verify-msg');
  msg.hidden = false;
  msg.textContent = `Solicitud de verificación creada para móviles cercanos a ${it.envelope.payload.location.lat.toFixed(4)}, ${it.envelope.payload.location.lon.toFixed(4)} (requiere permiso explícito; la foto nunca sale del dispositivo).`;
};

$('#btn-sim-cam-ok').onclick = async () => {
  const it = state.items.find((x) => x.envelope.reportId === state.selectedId);
  if (!it) return;
  it.passerbyChecks.push({
    verifierId: `paso-${it.passerbyChecks.length + 1}`,
    consent: true,
    roadKind: 'accidente',
    frames: [[{ label: 'car', score: 0.88 }], [{ label: 'car', score: 0.91 }]],
    minScore: 0.5,
    minFrames: 2,
  });
  await reevaluateSelected();
  $('#verify-msg').hidden = false;
  $('#verify-msg').textContent = 'Verificación de cámara local (COMPATIBLE, sin imagen) incorporada y expediente reevaluado.';
};

$('#btn-sim-cam-no').onclick = async () => {
  const it = state.items.find((x) => x.envelope.reportId === state.selectedId);
  if (!it) return;
  it.passerbyChecks.push({
    verifierId: `paso-${it.passerbyChecks.length + 1}`,
    consent: true,
    roadKind: 'accidente',
    frames: [[{ label: 'bicycle', score: 0.3 }]],
    minScore: 0.5,
    minFrames: 1,
  });
  await reevaluateSelected();
  $('#verify-msg').hidden = false;
  $('#verify-msg').textContent = 'Verificación de cámara local (NO_VISTO) incorporada; la probabilidad bayesiana desciende.';
};

$('#btn-load-auth').onclick = async () => {
  const anchor = await createAuthorityKeyPair();
  const authKp = await createAuthorityKeyPair();
  const now = Date.now();
  const grant = await issueAuthorityGrant(
    {
      grantId: 'GRANT-COMITE-DEMO-2026',
      authorityId: 'direccion.plan@proteccioncivil.example',
      authorityName: 'Dirección de Guardia (Demostración local)',
      role: 'Dirección del Comité de Emergencias',
      organization: 'Protección Civil (Laboratorio local)',
      authorityPublicKeyB64u: authKp.publicKeyB64u,
      allowedHazardKinds: Object.keys(CITIZEN_HAZARD_TYPES),
      scopeCircle: { lat: 39.435, lon: -0.435, radiusKm: 80 },
      grantedAtIso: new Date(now - 3600_000).toISOString(),
      expiresAtIso: new Date(now + 24 * 3600_000).toISOString(),
      documentHash: 'd'.repeat(64),
    },
    anchor
  );
  state.authority = { anchor, authKp, grant };
  $('#n5-msg').hidden = false;
  $('#n5-msg').textContent = `Credencial Ed25519 cargada: ${grant.authorityName}. Solo se habilitará sobre expedientes en modo ACTUAL y nivel N2–N4.`;
  renderInspector();
};

$('#btn-emit-n5').onclick = async () => {
  const it = state.items.find((x) => x.envelope.reportId === state.selectedId);
  if (!it || !state.authority) return;
  const msg = $('#n5-msg');
  msg.hidden = false;
  try {
    const nowMs = Date.now();
    it.protocol = await authorizePublicWarningN5(it.protocol, it.envelope, {
      grant: state.authority.grant,
      trustAnchorPublicRaw: state.authority.anchor.publicRaw,
      authorityKeyPair: state.authority.authKp,
      rationale: $('#n5-rationale').value,
      instruction: $('#n5-instruction').value,
      expiresAtMs: nowMs + 3 * 3600_000,
      nowMs,
      auditLog: state.auditLog,
    });
    msg.textContent = `Aviso N5 firmado por ${state.authority.grant.authorityName}. CAP 1.2 público generado y registrado en la cadena de auditoría SHA-256 (#${it.protocol.humanAuthorization.auditEntry.seq}).`;
    renderAll();
  } catch (err) {
    msg.textContent = `Bloqueado por la puerta de seguridad: ${err.message}`;
  }
};

$('#btn-dl-cap').onclick = () => {
  const xml = $('#cap-xml').textContent;
  if (!xml) return;
  const u = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
  const a = document.createElement('a');
  a.href = u;
  a.download = `senda-${state.selectedId || 'aviso'}.cap.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
};

/* ───────────── 5. Filtros, importación, servidor local y demo ejercicio ───────────── */
for (const b of $('#lvl-filters').querySelectorAll('button')) {
  b.onclick = () => {
    state.levelFilter = b.dataset.lvl;
    for (const x of $('#lvl-filters').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    renderAll();
  };
}

$('#import-json').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const env = JSON.parse(await f.text());
    const ver = await verifyCitizenReport(env);
    if (!ver.ok) throw new Error(ver.reason);
    const ctx = { receivedAtMs: Date.now(), priorProbability: 0.15, satelliteContext: { tleText: state.tleText } };
    const protocol = await evaluateReportProtocol(env, ctx);
    state.items.push({ envelope: env, protocol, context: ctx, passerbyChecks: [] });
    state.selectedId = env.reportId;
    renderAll();
  } catch (err) {
    $('#mapinfo').textContent = `Error al importar sobre: ${err.message}`;
  }
});

$('#btn-server').onclick = async () => {
  const base = ($('#srv-url').value || '').trim().replace(/\/$/, '');
  try {
    const resp = await fetch(`${base}/api/v1/dossiers`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    state.items = (data.dossiers ?? []).map((d) => ({
      envelope: d.envelope,
      protocol: d.protocol,
      context: { receivedAtMs: Date.now(), priorProbability: 0.15 },
      passerbyChecks: [],
    }));
    state.selectedId = state.items[0]?.envelope?.reportId ?? null;
    renderAll();
    $('#mapinfo').innerHTML = `<strong>Conectado a ${esc(base)}</strong><div style="color:var(--m);margin-top:4px">${state.items.length} expediente(s) sincronizados.</div>`;
  } catch (err) {
    $('#mapinfo').innerHTML = `<strong>Servidor local no disponible</strong><div style="color:var(--m);margin-top:4px">${esc(err.message)}. Inicia <span class="mono">node packages/senda/server/reference-server.mjs</span> o carga el ejercicio local.</div>`;
  }
};

$('#btn-demo').onclick = async () => {
  const [k1, k2, k3, k4] = await Promise.all(Array.from({ length: 4 }, () => createCitizenKeyPair()));
  const now = Date.now();
  const consent = { accepted: true, purpose: 'ejercicio_poyo', shareWithAuthorities: true, allowVerificationByPassersby: true, redactBeforeShare: true, consentVersion: 'v1', acceptedAtIso: new Date(now - 600_000).toISOString() };

  // 1. N4 Pre-alerta (ACTUAL para demostrar la puerta N5 con firma humana)
  const eN4 = await createCitizenReport({
    kind: 'nivel_agua', operationalStatus: 'ACTUAL', modalities: ['foto', 'ubicacion', 'texto'],
    capturedAtIso: new Date(now - 240_000).toISOString(),
    location: { lat: 39.4269, lon: -0.4174, accuracyM: 9 },
    text: 'Crecida muy rápida en el puente del barranco del Poyo (escenario de prueba local)',
    people: { trapped: 2, injured: 0 },
    measurement: { levelM: 3.1, rise: { cmPerMin: 3.2, stdErr: 0.2 } },
    consent,
  }, k1);
  const ePeer = await createCitizenReport({
    kind: 'inundacion', operationalStatus: 'ACTUAL', modalities: ['ubicacion', 'texto'],
    capturedAtIso: new Date(now - 180_000).toISOString(),
    location: { lat: 39.4281, lon: -0.4162, accuracyM: 12 },
    text: 'Agua saliendo por el paseo junto al cauce',
    consent,
  }, k2);

  // 2. N2 Corroborado (EJERCICIO — demostrará bloqueo permanente de N5)
  const eN2 = await createCitizenReport({
    kind: 'desprendimiento', operationalStatus: 'EXERCISE', modalities: ['foto', 'ubicacion', 'texto'],
    capturedAtIso: new Date(now - 420_000).toISOString(),
    location: { lat: 39.452, lon: -0.520, accuracyM: 15 },
    text: 'Rocas sobre la calzada tras lluvia intensa en talud',
    consent,
  }, k3);

  // 3. N0 Bloqueado por reloj manipulado (abuso)
  const eN0 = await createCitizenReport({
    kind: 'fuego', operationalStatus: 'EXERCISE', modalities: ['texto', 'ubicacion'],
    capturedAtIso: new Date(now + 2 * 3600_000).toISOString(),
    location: { lat: 39.410, lon: -0.455, accuracyM: 40 },
    text: 'Aviso con hora futura manipulada para prueba de peritaje',
    consent,
  }, k4);

  const ctxN4 = {
    receivedAtMs: now,
    priorProbability: 0.15,
    physicalContext: {
      rainfallMm: 120,
      rainfallDurationH: 1,
      handM: 2.0,
      gaugeReading: { stationId: 'SAIH-POYO', observationStatus: 'OBSERVED', flowM3s: 2282, warningThresholdM3s: 150, authenticated: true },
    },
    crowdContext: { peerEnvelopes: [ePeer] },
    satelliteContext: { tleText: state.tleText },
    riskThreshold: PUBLISHED_RISK_THRESHOLDS.CHJ_POYO_WARNING_FLOW,
    riskMeasurement: { metric: 'flowM3s', value: 2282, unit: 'm³/s', basis: 'MEASURED' },
  };
  const ctxN2 = {
    receivedAtMs: now,
    priorProbability: 0.15,
    physicalContext: { slopeDeg: 28, rainfallMm: 75, rainfallDurationH: 3 },
    crowdContext: {
      passerbyCameraChecks: [{ verifierId: 'cam-1', consent: true, roadKind: 'obstaculo', frames: [[{ label: 'chair', score: 0.85 }]], minScore: 0.5, minFrames: 1 }],
    },
    satelliteContext: { tleText: state.tleText },
  };
  const ctxN0 = { receivedAtMs: now, priorProbability: 0.15, satelliteContext: { tleText: state.tleText } };

  state.items = [
    { envelope: eN4, protocol: await evaluateReportProtocol(eN4, ctxN4), context: ctxN4, passerbyChecks: [] },
    { envelope: eN2, protocol: await evaluateReportProtocol(eN2, ctxN2), context: ctxN2, passerbyChecks: [] },
    { envelope: eN0, protocol: await evaluateReportProtocol(eN0, ctxN0), context: ctxN0, passerbyChecks: [] },
  ];
  state.selectedId = eN4.reportId;
  renderAll();
};

window.addEventListener('resize', resizeMap);
await loadTleSnapshot();
resizeMap();
renderAll();
window.SENDA_COMITE = state;

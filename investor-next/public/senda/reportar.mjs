/**
 * SENDA · Lógica de la interfaz web ciudadana sin instalación (`reportar.mjs`).
 * Ejecuta directamente el núcleo probado (`/senda/core/citizen-report.mjs`, `/senda/core/report-forensics.mjs`)
 * en el navegador: firma Ed25519, difuminado facial/matrículas en <canvas>, borrado EXIF JPEG,
 * huella perceptual dHash-64, cola sin conexión y exportación multicanal (HTTP, SND3, QR, geo:, JSON).
 */

import {
  CITIZEN_HAZARD_TYPES,
  createCitizenKeyPair,
  exportCitizenKeyPair,
  importCitizenKeyPair,
  stripJpegExif,
  redactRgbaRegions,
  createCitizenReport,
  reportToCompactSnd3,
  reportToQrChunks,
  reportToGeoUri,
  sha256HexBytes,
} from '/senda/core/citizen-report.mjs';
import { computeDHash64 } from '/senda/core/report-forensics.mjs';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const STORAGE_KEY_OUTBOX = 'senda-reportar-outbox-v1';
const STORAGE_KEY_PAIR = 'senda-reportar-ed25519-v1';

const state = {
  kind: null,
  keyPair: null,
  location: null,
  camera: null,
  mediaItem: null,
  photoImg: null,
  boxes: [],
  dragging: null,
  outbox: [],
};

function isoLocalWithOffset(date = new Date()) {
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offMin = -date.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const hh = pad(Math.floor(Math.abs(offMin) / 60));
  const mm = pad(Math.abs(offMin) % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`;
}

function loadOutbox() {
  try {
    state.outbox = JSON.parse(localStorage.getItem(STORAGE_KEY_OUTBOX) || '[]');
  } catch {
    state.outbox = [];
  }
}

function saveOutbox() {
  try {
    localStorage.setItem(STORAGE_KEY_OUTBOX, JSON.stringify(state.outbox));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

async function initKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAIR);
    if (raw) {
      state.keyPair = await importCitizenKeyPair(JSON.parse(raw));
      return;
    }
    state.keyPair = await createCitizenKeyPair();
    localStorage.setItem(STORAGE_KEY_PAIR, JSON.stringify(await exportCitizenKeyPair(state.keyPair)));
  } catch {
    state.keyPair = await createCitizenKeyPair();
  }
}

function updateNetStatus() {
  const el = $('#net-status');
  if (navigator.onLine) {
    el.innerHTML = '<i class="sq real"></i>Con red · cola automática';
  } else {
    el.innerHTML = '<i class="sq sim"></i>Sin red · cola local firmada';
  }
}

function updateSendEnabled() {
  const hasLoc = state.location || (Number.isFinite(Number($('#lat').value)) && Number.isFinite(Number($('#lon').value)) && $('#lat').value !== '' && $('#lon').value !== '');
  $('#btn-send').disabled = !(state.kind && hasLoc && $('#c-accept').checked);
}

/* ───────────── 1. Selector de peligro ───────────── */
function renderKinds() {
  const root = $('#kinds');
  root.innerHTML = Object.entries(CITIZEN_HAZARD_TYPES)
    .map(
      ([k, v]) =>
        `<button type="button" data-kind="${k}" aria-pressed="${state.kind === k}">${esc(v.label)}${v.lifeRisk ? '<div style="font-size:11.5px;color:#fca5a5;margin-top:2px">Riesgo vital · llamar al 112</div>' : ''}</button>`
    )
    .join('');
  for (const btn of root.querySelectorAll('button')) {
    btn.onclick = () => {
      state.kind = btn.dataset.kind;
      for (const b of root.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === btn));
      updateSendEnabled();
    };
  }
}

/* ───────────── 2. Foto, difuminado en canvas y EXIF ───────────── */
const cv = $('#redact-cv');
const ctx = cv.getContext('2d', { willReadFrequently: true });

function drawPhotoCanvas() {
  if (!state.photoImg) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(state.photoImg, 0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#f0a73a';
  ctx.lineWidth = 2;
  for (const b of state.boxes) {
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  if (state.dragging) {
    const { x0, y0, x1, y1 } = state.dragging;
    ctx.strokeStyle = '#4f8cff';
    ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
}

function pointerPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height };
}

cv.addEventListener('pointerdown', (e) => {
  if (!state.photoImg) return;
  const p = pointerPos(e);
  state.dragging = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  const p = pointerPos(e);
  state.dragging.x1 = p.x;
  state.dragging.y1 = p.y;
  drawPhotoCanvas();
});
cv.addEventListener('pointerup', () => {
  if (!state.dragging) return;
  const { x0, y0, x1, y1 } = state.dragging;
  state.dragging = null;
  if (Math.abs(x1 - x0) >= 8 && Math.abs(y1 - y0) >= 8) {
    state.boxes.push({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0), label: 'face_or_plate' });
  }
  drawPhotoCanvas();
});

$('#media-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const rawBytes = new Uint8Array(await file.arrayBuffer());
  let cleanBytes = rawBytes;
  let exifStripped = false;
  if (file.type === 'image/jpeg' || (rawBytes[0] === 0xff && rawBytes[1] === 0xd8)) {
    try {
      const stripped = await stripJpegExif(rawBytes);
      cleanBytes = stripped.bytes;
      exifStripped = true;
    } catch {
      exifStripped = false;
    }
  }
  const sha = await sha256HexBytes(cleanBytes);

  if (file.type.startsWith('image/')) {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([cleanBytes], { type: file.type }));
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 640;
      const scale = Math.min(1, maxW / img.width);
      cv.width = Math.max(16, Math.round(img.width * scale));
      cv.height = Math.max(16, Math.round(img.height * scale));
      state.photoImg = img;
      state.boxes = [];
      drawPhotoCanvas();
      const imgData = ctx.getImageData(0, 0, cv.width, cv.height);
      const dhash = computeDHash64(imgData.data, cv.width, cv.height, { channels: 4 });
      state.mediaItem = {
        modality: 'foto',
        mimeType: file.type,
        sha256: sha,
        byteLength: cleanBytes.length,
        width: cv.width,
        height: cv.height,
        redacted: false,
        exifStripped,
        redactionRegionsCount: 0,
        perceptualHashHex: dhash,
      };
      $('#photo-tools').hidden = false;
      $('#nonphoto-meta').textContent = '';
      $('#media-meta').textContent = `SHA-256 ${sha.slice(0, 12)}… · dHash ${dhash} · EXIF ${exifStripped ? 'eliminado' : 'n/a'}`;
    };
    img.src = url;
  } else {
    const modality = file.type.startsWith('video/') ? 'video' : 'audio';
    state.photoImg = null;
    $('#photo-tools').hidden = true;
    state.mediaItem = {
      modality,
      mimeType: file.type || 'application/octet-stream',
      sha256: sha,
      byteLength: cleanBytes.length,
      redacted: false,
      exifStripped: false,
    };
    $('#nonphoto-meta').textContent = `${modality.toUpperCase()} listo · ${cleanBytes.length} B · SHA-256 ${sha.slice(0, 16)}… (los bytes permanecen en tu dispositivo hasta sincronizar)`;
  }
});

$('#apply-blur').onclick = async () => {
  if (!state.photoImg || !state.mediaItem) return;
  ctx.drawImage(state.photoImg, 0, 0, cv.width, cv.height);
  const imgData = ctx.getImageData(0, 0, cv.width, cv.height);
  const res = await redactRgbaRegions(imgData.data, cv.width, cv.height, state.boxes, { blockSize: 12 });
  ctx.putImageData(new ImageData(res.rgba, cv.width, cv.height), 0, 0);
  const dhash = computeDHash64(res.rgba, cv.width, cv.height, { channels: 4 });
  state.mediaItem = {
    ...state.mediaItem,
    sha256: res.redactedSha256,
    redacted: res.redacted,
    redactionRegionsCount: res.regions.length,
    perceptualHashHex: dhash,
  };
  $('#media-meta').textContent = `Difuminado aplicado (${res.regions.length} caja/s) · SHA-256 ${res.redactedSha256.slice(0, 12)}… · dHash ${dhash}`;
};

$('#clear-boxes').onclick = () => {
  state.boxes = [];
  drawPhotoCanvas();
};

/* ───────────── 3. Ubicación y sensores ───────────── */
$('#btn-gps').onclick = () => {
  if (!navigator.geolocation) {
    $('#gps-readout').textContent = 'Geolocalización no disponible; usa coordenadas manuales.';
    return;
  }
  $('#gps-readout').textContent = 'Obteniendo GPS…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.location = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracyM: pos.coords.accuracy || 25,
        altitudeM: Number.isFinite(pos.coords.altitude) ? pos.coords.altitude : null,
        source: 'GPS_NAVEGADOR',
      };
      $('#lat').value = state.location.lat.toFixed(5);
      $('#lon').value = state.location.lon.toFixed(5);
      $('#acc').value = Math.round(state.location.accuracyM);
      $('#gps-readout').textContent = `${state.location.lat.toFixed(5)}, ${state.location.lon.toFixed(5)} (±${Math.round(state.location.accuracyM)} m)`;
      updateSendEnabled();
    },
    (err) => {
      $('#gps-readout').textContent = `Sin permiso GPS (${err.message}); puedes indicar coordenadas manuales.`;
    },
    { enableHighAccuracy: true, timeout: 12_000 }
  );
};

$('#btn-orient').onclick = () => {
  const handler = (ev) => {
    window.removeEventListener('deviceorientation', handler);
    const h = ev.webkitCompassHeading ?? (Number.isFinite(ev.alpha) ? (360 - ev.alpha) % 360 : null);
    if (Number.isFinite(h)) {
      $('#heading').value = Math.round(h);
      state.camera = { headingDeg: Math.round(h), pitchDeg: Number.isFinite(ev.beta) ? Math.max(-90, Math.min(90, Math.round(ev.beta))) : null };
      $('#gps-readout').textContent += ` · rumbo ${Math.round(h)}°`;
    }
  };
  window.addEventListener('deviceorientation', handler, { once: true });
};

for (const id of ['#lat', '#lon', '#c-accept']) {
  $(id).addEventListener('input', updateSendEnabled);
  $(id).addEventListener('change', updateSendEnabled);
}

/* ───────────── 4. Firma, envío y cola sin conexión ───────────── */
async function tryUpload(item) {
  const baseUrl = ($('#server-url').value || '').trim().replace(/\/$/, '');
  if (!baseUrl || !navigator.onLine) return { sent: false, reason: 'OFFLINE_OR_NO_SERVER' };
  try {
    const resp = await fetch(`${baseUrl}/api/v1/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envelope: item.envelope }),
    });
    if (!resp.ok) return { sent: false, reason: `HTTP_${resp.status}` };
    const data = await resp.json();
    return { sent: true, serverResponse: data };
  } catch (err) {
    return { sent: false, reason: err?.message || 'NETWORK_ERROR' };
  }
}

function renderOutbox() {
  const pending = state.outbox.filter((x) => !x.uploaded);
  $('#queue-count').textContent = `${pending.length} pendiente(s) · ${state.outbox.length} total`;
  const ul = $('#queue-list');
  if (!state.outbox.length) {
    ul.innerHTML = '<li style="color:var(--m)">Sin avisos en la cola local.</li>';
    return;
  }
  ul.innerHTML = state.outbox
    .slice()
    .reverse()
    .map(
      (x) =>
        `<li>
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <strong>${esc(CITIZEN_HAZARD_TYPES[x.envelope.payload.kind]?.label ?? x.envelope.payload.kind)}</strong>
            <span class="mono" style="color:${x.uploaded ? 'var(--ok)' : 'var(--acc)'}">${x.uploaded ? 'ENVIADO AL SERVIDOR' : 'EN COLA SIN RED'}</span>
          </div>
          <div class="mono" style="color:var(--m);margin-top:4px">${esc(x.envelope.reportId)} · ${esc(x.envelope.operationalStatus)} · ${esc(x.envelope.payload.capturedAtIso)}</div>
          <div class="row" style="margin-top:6px">
            <button type="button" data-dl="${esc(x.envelope.reportId)}" style="min-height:36px;padding:6px 10px;font-size:12.5px">Descargar JSON firmado</button>
            <button type="button" data-copy-snd3="${esc(x.envelope.reportId)}" style="min-height:36px;padding:6px 10px;font-size:12.5px">Copiar SND3 (SMS)</button>
            <button type="button" data-copy-geo="${esc(x.envelope.reportId)}" style="min-height:36px;padding:6px 10px;font-size:12.5px">Copiar geo:</button>
          </div>
        </li>`
    )
    .join('');

  for (const b of ul.querySelectorAll('[data-dl]')) {
    b.onclick = () => {
      const item = state.outbox.find((x) => x.envelope.reportId === b.dataset.dl);
      if (!item) return;
      const u = URL.createObjectURL(new Blob([JSON.stringify(item.envelope, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = u;
      a.download = `${item.envelope.reportId}.senda.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    };
  }
  for (const b of ul.querySelectorAll('[data-copy-snd3]')) {
    b.onclick = () => {
      const item = state.outbox.find((x) => x.envelope.reportId === b.dataset.copySnd3);
      if (item?.snd3) navigator.clipboard?.writeText(item.snd3);
    };
  }
  for (const b of ul.querySelectorAll('[data-copy-geo]')) {
    b.onclick = () => {
      const item = state.outbox.find((x) => x.envelope.reportId === b.dataset.copyGeo);
      if (item?.geoUri) navigator.clipboard?.writeText(item.geoUri);
    };
  }
}

async function flushOutbox() {
  for (const item of state.outbox) {
    if (item.uploaded) continue;
    const res = await tryUpload(item);
    if (res.sent) {
      item.uploaded = true;
      item.serverLevel = res.serverResponse?.protocol?.level ?? 'N0';
    }
  }
  saveOutbox();
  renderOutbox();
}

$('#btn-send').onclick = async () => {
  const lat = state.location?.lat ?? Number($('#lat').value);
  const lon = state.location?.lon ?? Number($('#lon').value);
  const accuracyM = state.location?.accuracyM ?? (Number($('#acc').value) || 25);
  const nowIso = isoLocalWithOffset();
  const modalities = ['ubicacion'];
  if ($('#text-note').value.trim()) modalities.push('texto');
  if (state.mediaItem) modalities.push(state.mediaItem.modality);
  if (state.kind === 'sos') modalities.push('sos');

  const baroVal = $('#baro').value ? Number($('#baro').value) : null;
  const headingVal = $('#heading').value ? Number($('#heading').value) : null;

  const envelope = await createCitizenReport(
    {
      kind: state.kind,
      operationalStatus: $('#op-status').value,
      modalities,
      capturedAtIso: nowIso,
      location: { lat, lon, accuracyM, altitudeM: state.location?.altitudeM ?? null },
      camera: headingVal != null ? { ...(state.camera || {}), headingDeg: headingVal } : state.camera,
      sensors: baroVal != null ? { barometerHpa: baroVal } : null,
      text: $('#text-note').value.trim(),
      people: { trapped: Math.max(0, Number($('#trapped').value) | 0), injured: Math.max(0, Number($('#injured').value) | 0) },
      media: state.mediaItem ? [state.mediaItem] : [],
      consent: {
        accepted: true,
        purpose: 'peritaje_civil_emergencia',
        shareWithAuthorities: true,
        allowVerificationByPassersby: $('#c-passerby').checked,
        redactBeforeShare: $('#c-redact').checked,
        consentVersion: 'senda-web-consent-v1',
        acceptedAtIso: nowIso,
      },
      channelOrigin: 'web-reportar',
    },
    state.keyPair
  );

  const snd3 = await reportToCompactSnd3(envelope, state.keyPair);
  const qrChunks = await reportToQrChunks(envelope);
  const geoUri = reportToGeoUri(envelope);

  const entry = { envelope, snd3, qrChunks, geoUri, uploaded: false, savedAtIso: nowIso };
  const up = await tryUpload(entry);
  if (up.sent) {
    entry.uploaded = true;
    entry.serverLevel = up.serverResponse?.protocol?.level ?? 'N0';
  }
  state.outbox.push(entry);
  saveOutbox();
  renderOutbox();

  const shareSummary = `⚠️ Aviso SENDA (${CITIZEN_HAZARD_TYPES[state.kind]?.label ?? state.kind}, ${envelope.operationalStatus}): ${envelope.payload.text || 'Peligro reportado en zona'} · Ubicación ${geoUri}. Si hay riesgo vital llama al 112.`;
  const out = $('#send-result');
  out.hidden = false;
  out.innerHTML = `
    <div><span class="truth"><i class="sq ${entry.uploaded ? 'real' : 'sim'}"></i>${entry.uploaded ? `Recibido por servidor local (nivel ${esc(entry.serverLevel)})` : 'Guardado y firmado en cola local sin red'}</span></div>
    <p class="explain">ID: <span class="mono">${esc(envelope.reportId)}</span> · Seudónimo: <span class="mono">${esc(envelope.signature.pseudonymId)}</span> · Modo: <span class="mono">${esc(envelope.operationalStatus)}</span> · <strong>canPublicWarn: false</strong></p>
    <div class="row" style="margin-top:8px">
      <button type="button" id="btn-share-nearby" style="flex:1;background:var(--blue);color:#fff;text-align:center">Compartir con vecinos / conductores (sin app)</button>
    </div>
    <p class="explain">Línea compacta SMS/satélite (160 car.) y URI <span class="mono">${esc(geoUri)}</span> (${qrChunks.length} código/s QR):</p>
    <pre>${esc(snd3)}</pre>
  `;
  $('#btn-share-nearby').onclick = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'Aviso SENDA', text: shareSummary }); return; } } catch { /* cancelado */ }
    try { await navigator.clipboard.writeText(shareSummary); $('#btn-share-nearby').textContent = '✓ Copiado para WhatsApp / SMS'; } catch { /* */ }
  };
};

$('#btn-flush').onclick = flushOutbox;
window.addEventListener('online', () => {
  updateNetStatus();
  flushOutbox();
});
window.addEventListener('offline', updateNetStatus);

await initKeys();
loadOutbox();
renderKinds();
renderOutbox();
updateNetStatus();
updateSendEnabled();
window.SENDA_REPORTAR = state;

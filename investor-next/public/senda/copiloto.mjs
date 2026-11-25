/**
 * SENDA Copiloto 5D · Controlador Apple HIG Mobile-First para APK Android, Android Auto y navegador.
 * Conecta física vehicular real (`drive-copilot-physics.mjs`), EKF-6 (`drive-kalman-fusion.mjs`),
 * onda LWR (`traffic-shockwave.mjs`), comunicación directa/indirecta y calibración comunitaria
 * (`drive-community-calibration.mjs`), y el puente nativo `SendaNative.publishDriveState`.
 */
import {
  PUBLISHED_SURFACE_PRESETS,
  PUBLISHED_VEHICLE_PROFILES,
  createDriveCopilotEngine,
} from './core/drive-copilot-physics.mjs';
import {
  QUICK_CAR_SIGNALS,
  translateCopilotForHumans,
  composeProximityMessage,
  voteCommunitySignal,
  createCalibrationJournal,
} from './core/drive-community-calibration.mjs';
import { createGnssImuEkf } from './core/drive-kalman-fusion.mjs';
import { EXAMPLE_LWR_HIGHWAY } from './core/traffic-shockwave.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SIGNAL_ICONS = {
  retencion: '🚗',
  agua: '💧',
  niebla: '🌫️',
  obstaculo: '⚠️',
  parado: '🛑',
  ayuda: '🆘',
};

function buildDemoCurveRoute() {
  const lat0 = 39.428, lon0 = -0.418;
  const mLat = 111_132.95;
  const mLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const toLL = (x, y) => [lon0 + x / mLon, lat0 + y / mLat];
  const coords = [];
  for (let y = 0; y <= 240; y += 20) coords.push(toLL(0, y));
  const R = 60;
  for (let deg = 170; deg >= 90; deg -= 10) {
    const th = (deg * Math.PI) / 180;
    coords.push(toLL(R + R * Math.cos(th), 240 + R * Math.sin(th)));
  }
  for (let x = R + 20; x <= R + 260; x += 20) coords.push(toLL(x, 240 + R));
  return coords;
}

const DEMO_ROUTE = buildDemoCurveRoute();

const state = {
  tab: 'copiloto',
  scenario: 'rain_curve',
  voiceOn: false,
  engine: createDriveCopilotEngine({ voiceCooldownMs: 12_000 }),
  calibration: createCalibrationJournal(),
  ekf: createGnssImuEkf(),
  tickPhase: 0,
  gTrail: [],
  aaPushCount: 0,
  lastRes: null,
  lastHuman: null,
  lastEkfView: null,
  lastDebriefJson: null,
  lastComposed: null,
  radioScan: null, // poblado por Android `window.sendaRadio` o simulación declarada
  communityFeed: [],
  real: {
    watchId: null,
    startedAtMs: Date.now(),
    pos: null,
    speedMs: 0,
    headingDeg: 0,
    accuracyM: null,
    axMs2: 0,
    ayMs2: 0,
    yawRateRadS: 0,
    latBuffer: [],
  },
};

let toastTimer = null;
function showToast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

function speak(text) {
  if (!text) return;
  try {
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 1.03;
    window.speechSynthesis?.speak(u);
  } catch { /* sin síntesis de voz */ }
}

function setTab(tabId) {
  if (!['copiloto', 'entorno', 'calibrar', 'fisica'].includes(tabId)) return;
  state.tab = tabId;
  document.querySelectorAll('.tab-view').forEach((v) => v.classList.toggle('on', v.id === `tab-${tabId}`));
  document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tabId));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function openSheet(on) {
  $('#sheetVeil').hidden = !on;
  $('#signalSheet').hidden = !on;
}

function getControls() {
  const surface = PUBLISHED_SURFACE_PRESETS[$('#surfaceSel').value] ?? PUBLISHED_SURFACE_PRESETS.heavy_rain;
  const veh = PUBLISHED_VEHICLE_PROFILES[$('#vehSel').value] ?? PUBLISHED_VEHICLE_PROFILES.sedan;
  const tirePressureBar = Number($('#pressRange').value);
  const gradePct = Number($('#gradeRange').value);
  const visibilityM = Number($('#visRange').value);
  $('#muVal').textContent = surface.muLong.toFixed(2).replace('.', ',');
  $('#ssfVal').textContent = veh.ssf.toFixed(2).replace('.', ',');
  $('#pressVal').textContent = `${tirePressureBar.toFixed(1).replace('.', ',')} bar`;
  $('#gradeVal').textContent = `${gradePct > 0 ? '+' : ''}${gradePct} %`;
  $('#visVal').textContent = `${visibilityM} m`;
  return { surface, veh, tirePressureBar, gradePct, visibilityM };
}

function seedDemoCommunityFeed(sc) {
  const now = Date.now();
  if (sc === 'real') return;
  const sample = sc === 'flood_gate'
    ? composeProximityMessage({ signalId: 'agua', pos: { lat: 39.428, lon: -0.418 }, recommendedMaxKmh: 0, roadHint: 'Paso inferior CV-400', nowMs: now - 180_000 })
    : sc === 'fog_lwr'
      ? composeProximityMessage({ signalId: 'niebla', pos: { lat: 40.4168, lon: -3.7038 }, recommendedMaxKmh: 60, roadHint: 'A-3 km 22', nowMs: now - 240_000 })
      : composeProximityMessage({ signalId: 'retencion', pos: { lat: 39.428, lon: -0.418 }, recommendedMaxKmh: 50, roadHint: 'Enlace circunvalación', nowMs: now - 120_000 });
  const confirmed = voteCommunitySignal(sample.communityEntry, 'conf', now - 60_000);
  state.communityFeed = [confirmed];
  renderCommunityFeed();
}

function applyScenarioDefaults(sc) {
  state.scenario = sc;
  state.tickPhase = 0;
  state.gTrail = [];
  state.ekf = createGnssImuEkf();
  document.querySelectorAll('.sc-btn').forEach((b) => b.classList.toggle('on', b.dataset.sc === sc));

  const pill = $('#modePill');
  const dot = $('#modeDot');
  if (sc === 'real') {
    pill.textContent = 'Sensores reales';
    dot.className = 'sub-dot real';
    startRealSensors();
  } else {
    pill.textContent = 'Simulación declarada';
    dot.className = 'sub-dot';
    stopRealSensors();
  }

  if (sc === 'rain_curve') {
    $('#surfaceSel').value = 'heavy_rain';
    $('#pressRange').value = '2.2';
    $('#gradeRange').value = '-4';
    $('#visRange').value = '110';
  } else if (sc === 'fog_lwr') {
    $('#surfaceSel').value = 'wet_asphalt';
    $('#pressRange').value = '2.3';
    $('#gradeRange').value = '0';
    $('#visRange').value = '55';
  } else if (sc === 'tunnel_ekf') {
    $('#surfaceSel').value = 'dry_asphalt';
    $('#pressRange').value = '2.4';
    $('#gradeRange').value = '-2';
    $('#visRange').value = '220';
  } else if (sc === 'flood_gate') {
    $('#surfaceSel').value = 'heavy_rain';
    $('#pressRange').value = '2.2';
    $('#gradeRange').value = '-5';
    $('#visRange').value = '80';
  } else if (sc === 'night_convoy') {
    $('#surfaceSel').value = 'dry_asphalt';
    $('#pressRange').value = '2.3';
    $('#gradeRange').value = '0';
    $('#visRange').value = '140';
  }
  getControls();
  seedDemoCommunityFeed(sc);
}

function onDeviceMotion(ev) {
  const a = ev.acceleration;
  if (a && Number.isFinite(a.x) && Number.isFinite(a.y)) {
    state.real.ayMs2 = a.x;
    state.real.axMs2 = a.y;
    state.real.latBuffer.push(a.x);
    if (state.real.latBuffer.length > 50) state.real.latBuffer.shift();
  }
  const r = ev.rotationRate;
  if (r && Number.isFinite(r.alpha)) state.real.yawRateRadS = (r.alpha * Math.PI) / 180;
}

function startRealSensors() {
  state.real.startedAtMs = Date.now();
  if (navigator.geolocation && state.real.watchId == null) {
    try {
      state.real.watchId = navigator.geolocation.watchPosition(
        (p) => {
          const c = p.coords;
          state.real.pos = { lat: c.latitude, lon: c.longitude };
          state.real.speedMs = Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : 0;
          state.real.headingDeg = Number.isFinite(c.heading) ? c.heading : state.real.headingDeg;
          state.real.accuracyM = Number.isFinite(c.accuracy) ? c.accuracy : null;
          state.ekf.updateGnss({
            tMs: p.timestamp || Date.now(),
            lon: c.longitude,
            lat: c.latitude,
            accuracyM: state.real.accuracyM ?? 12,
            speedMs: state.real.speedMs,
            headingDeg: state.real.headingDeg,
          });
        },
        () => { /* sin GPS */ },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 },
      );
    } catch { /* sin geolocalización */ }
  }
  try { window.addEventListener('devicemotion', onDeviceMotion, { passive: true }); } catch { /* sin IMU */ }
}

function stopRealSensors() {
  if (state.real.watchId != null && navigator.geolocation) {
    try { navigator.geolocation.clearWatch(state.real.watchId); } catch { /* */ }
    state.real.watchId = null;
  }
  try { window.removeEventListener('devicemotion', onDeviceMotion); } catch { /* */ }
}

// Callback nativo Android cuando `SendaNative.radioScan()` devuelve un barrido Wi-Fi/BLE anónimo
window.sendaRadio = (scan) => {
  const wifiList = Array.isArray(scan?.wifi) ? scan.wifi : [];
  const bleList = Array.isArray(scan?.ble) ? scan.ble : [];
  const sendaNear = bleList.filter((b) => b.senda).length;
  const bleBestDbm = bleList.length ? Math.max(...bleList.map((b) => b.rssi ?? -95)) : null;
  state.radioScan = { wifiN: wifiList.length, bleN: bleList.length, sendaNear, bleBestDbm };
  if (sendaNear > 0) {
    state.calibration.recordGroundTruth({ category: 'ble_encounter', value: 'ok', context: { rssiDbm: bleBestDbm } });
    renderCalibration();
  }
  tick();
  showToast(`Entorno actualizado · ${wifiList.length} Wi-Fi · ${bleList.length} BLE (0 PII)`);
};

function buildTickInputs(nowMs) {
  const { surface, veh, tirePressureBar, gradePct, visibilityM } = getControls();
  const phase = state.tickPhase;

  if (state.scenario === 'real') {
    state.ekf.predict({ tMs: nowMs, aLongMs2: state.real.axMs2, yawRateRadS: state.real.yawRateRadS });
    const ekfSt = state.ekf.initialized ? state.ekf.state(nowMs) : null;
    const driveMin = (nowMs - state.real.startedAtMs) / 60_000;
    return {
      ekfView: ekfSt
        ? { mode: ekfSt.mode, sigmaM: ekfSt.sigmaPosM ?? state.real.accuracyM }
        : { mode: state.real.pos ? 'GNSS_FUSED' : 'ESPERANDO_GPS', sigmaM: state.real.accuracyM },
      radioScan: state.radioScan,
      officialNearbyCount: 0,
      tickArg: {
        nowMs,
        gripInput: {
          speedMs: state.real.speedMs,
          axMs2: state.real.axMs2,
          ayMs2: state.real.ayMs2,
          surfaceMu: surface.muLong,
          tirePressureBar,
          standingWaterMm: surface.standingWaterMm,
          gradePct,
          reactionTimeS: 1.5,
          visibilityM,
        },
        fatigueInput: {
          continuousDriveMin: driveMin,
          localHour: new Date(nowMs).getHours(),
          lateralAccelSamplesMs2: state.real.latBuffer,
          sampleHz: 5,
        },
      },
    };
  }

  const osc = Math.sin(phase * 0.35);
  let speedKmh = 96;
  let axMs2 = -0.8 + 0.5 * osc;
  let ayMs2 = 1.6 * Math.cos(phase * 0.3);
  let curveInput = null;
  let crossingInput = null;
  let queueInput = null;
  let shadowConvoyInput = null;
  let fatigueInput = { continuousDriveMin: 42, localHour: 11, lateralAccelSamplesMs2: [0.05, 0.08, 0.04, 0.06, 0.05, 0.07], sampleHz: 5 };
  let ekfView = { mode: 'GNSS_FUSED', sigmaM: 3.4 };
  let radioScan = { wifiN: 16, bleN: 14, sendaNear: 2, bleBestDbm: -63 };
  let officialNearbyCount = 3;

  if (state.scenario === 'rain_curve') {
    speedKmh = 98 + 4 * osc;
    axMs2 = -1.4;
    ayMs2 = 1.8 * Math.sin(phase * 0.45);
    const egoAlong = (phase * 14) % 140;
    curveInput = {
      routeCoords: DEMO_ROUTE,
      egoAlongM: egoAlong,
      egoSpeedMs: speedKmh / 3.6,
      horizonM: 500,
      maxLateralMu: surface.muLatMax,
      superelevationE: veh.defaultSuperelevationE,
      vehicleSsf: veh.ssf,
      comfortBrakeMs2: 2.8,
      reactionTimeS: 1.5,
    };
  } else if (state.scenario === 'fog_lwr') {
    speedKmh = 88 + 3 * osc;
    axMs2 = -0.6;
    ayMs2 = 0.25 * osc;
    radioScan = { wifiN: 4, bleN: 9, sendaNear: 1, bleBestDbm: -71 };
    officialNearbyCount = 2;
    queueInput = {
      distToIncidentM: Math.max(250, 920 - ((phase * 25) % 600)),
      egoSpeedKmh: speedKmh,
      incidentAgeS: 90 + (phase % 30) * 3,
      lwrParams: EXAMPLE_LWR_HIGHWAY,
    };
  } else if (state.scenario === 'tunnel_ekf') {
    speedKmh = 72;
    axMs2 = 0.1 * osc;
    ayMs2 = 0.4 * Math.sin(phase * 0.25);
    radioScan = { wifiN: 1, bleN: 11, sendaNear: 1, bleBestDbm: -74 };
    officialNearbyCount = 1;
    if (!state.ekf.initialized) {
      state.ekf.updateGnss({ tMs: nowMs - 4000, lon: -3.7038, lat: 40.4168, accuracyM: 4, speedMs: 20, headingDeg: 90 });
    }
    state.ekf.predict({ tMs: nowMs, aLongMs2: axMs2, yawRateRadS: 0.02 * osc });
    const est = state.ekf.state(nowMs);
    ekfView = { mode: est ? `${est.mode} (${est.gnssAgeS ?? 0}s)` : 'DEAD_RECKONING_IMU', sigmaM: est?.sigmaPosM ?? null };
    shadowConvoyInput = {
      egoPos: { lat: 40.4168, lon: -3.7038 },
      egoSpeedMs: speedKmh / 3.6,
      nowMs,
      shadowZonesAhead: [{ id: 'm30-sur', name: 'Túnel M-30 Sur (sin GPS)', distAheadM: Math.max(0, 800 - (phase * 40) % 900), lengthM: 3400, kind: 'TUNNEL' }],
      convoyPeers: [{ id: 'c2', callsign: 'Vehículo apoyo', lat: 40.4152, lon: -3.7038, speedMs: 19.5, lastSeenMs: nowMs - 2000, rssiDbm: -74 }],
      maxConvoySpacingM: 600,
      lostContactS: 40,
      unexpectedStopS: 45,
    };
  } else if (state.scenario === 'flood_gate') {
    speedKmh = 54;
    axMs2 = -2.2;
    ayMs2 = 0.3 * osc;
    radioScan = { wifiN: 22, bleN: 15, sendaNear: 3, bleBestDbm: -58 };
    officialNearbyCount = 4;
    crossingInput = { vehicleClass: veh.floodClass, waterDepthM: 0.48, waterSpeedMs: 1.4 };
  } else if (state.scenario === 'night_convoy') {
    speedKmh = 104;
    axMs2 = -0.2;
    ayMs2 = 0.9 * Math.sin(phase * 1.1);
    radioScan = { wifiN: 0, bleN: 2, sendaNear: 1, bleBestDbm: -86 };
    officialNearbyCount = 0;
    fatigueInput = {
      continuousDriveMin: 158,
      localHour: 3,
      lateralAccelSamplesMs2: [0, 0.95, -0.85, 1.1, -0.95, 0.9, -0.9, 1.05, -0.88, 0.92],
      sampleHz: 5,
    };
    shadowConvoyInput = {
      egoPos: { lat: 39.428, lon: -0.418 },
      egoSpeedMs: speedKmh / 3.6,
      nowMs,
      shadowZonesAhead: [{ id: 'barranco-chiva', name: 'Barranco Chiva (sombra 4G)', distAheadM: 1200, lengthM: 2800, kind: 'VALLEY_DEADZONE' }],
      convoyPeers: [
        { id: 'fam-2', callsign: 'Coche familia #2', lat: 39.421, lon: -0.418, speedMs: 0.0, lastSeenMs: nowMs - 5000, stoppedSinceMs: nowMs - 70_000, rssiDbm: -91 },
      ],
      maxConvoySpacingM: 700,
      lostContactS: 45,
      unexpectedStopS: 45,
    };
  }

  return {
    ekfView,
    radioScan,
    officialNearbyCount,
    tickArg: {
      nowMs,
      gripInput: {
        speedMs: speedKmh / 3.6,
        axMs2,
        ayMs2,
        surfaceMu: surface.muLong,
        tirePressureBar,
        standingWaterMm: surface.standingWaterMm,
        gradePct,
        reactionTimeS: 1.5,
        visibilityM,
      },
      curveInput,
      crossingInput,
      queueInput,
      shadowConvoyInput,
      fatigueInput,
    },
  };
}

/* ───────────── Instrumentos limpios estilo Apple Fitness / CarPlay ───────────── */

function drawKammCanvas(res, ax, ay) {
  const cv = $('#kammCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W * 0.39, cy = H * 0.49;
  const maxR = Math.min(W * 0.30, H * 0.35);
  const pxPerG = maxR / 0.95;
  const rLimit = Math.max(12, Math.min(maxR, res.grip.effectiveMu * pxPerG));

  // Anillos de referencia discretos
  ctx.strokeStyle = 'rgba(235,235,245,0.10)';
  ctx.lineWidth = 1;
  for (const gRing of [0.3, 0.6, 0.9]) {
    ctx.beginPath();
    ctx.arc(cx, cy, gRing * pxPerG, 0, Math.PI * 2);
    ctx.stroke();
  }

  const col = res.grip.gripStatus === 'CRITICAL_SATURATION' ? '#ff453a' : res.grip.gripStatus === 'HIGH_DEMAND' ? '#ff9f0a' : '#30d158';
  ctx.fillStyle = res.grip.gripStatus === 'CRITICAL_SATURATION' ? 'rgba(255,69,58,0.16)' : res.grip.gripStatus === 'HIGH_DEMAND' ? 'rgba(255,159,10,0.14)' : 'rgba(48,209,88,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, rLimit, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.stroke();

  const gx = ay / 9.80665;
  const gy = -ax / 9.80665;
  state.gTrail.push([gx, gy]);
  if (state.gTrail.length > 18) state.gTrail.shift();
  for (let i = 0; i < state.gTrail.length; i++) {
    const [tx, ty] = state.gTrail[i];
    const alpha = (i + 1) / state.gTrail.length;
    ctx.fillStyle = `rgba(100,210,255,${(alpha * 0.42).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(cx + tx * pxPerG, cy - ty * pxPerG, 2.5 + alpha * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const px = cx + gx * pxPerG;
  const py = cy - gy * pxPerG;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = 'rgba(235,235,245,0.55)';
  ctx.font = '600 11px "Inter",-apple-system,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Frenada', cx, cy - maxR - 10);
  ctx.fillStyle = col;
  ctx.font = '700 12px "Inter",-apple-system,sans-serif';
  ctx.fillText(`Agarre libre: ${Math.round(res.grip.gripReservePct)} %`, cx, H - 10);

  // Barra minimalista de agua (límite NASA Vp)
  const bx = W * 0.78, bw = 24, by = 34, bh = H - 72;
  ctx.fillStyle = '#1c1c1e';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  const ratio = Math.min(1.2, res.grip.speedKmh / Math.max(40, res.grip.hydroplaningCriticalKmh));
  const fillH = Math.max(8, Math.min(bh, (ratio / 1.2) * bh));
  ctx.fillStyle = res.grip.hydroplaningRisk === 'CRITICAL_HYDROPLANING' ? '#ff453a' : res.grip.hydroplaningRisk !== 'NONE' ? '#ff9f0a' : '#0a84ff';
  ctx.beginPath();
  ctx.roundRect(bx + 2, by + bh - fillH, bw - 4, fillH, 6);
  ctx.fill();

  const critY = by + bh - (1.0 / 1.2) * bh;
  ctx.strokeStyle = '#ff453a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx - 6, critY); ctx.lineTo(bx + bw + 6, critY); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '600 11px "Inter",-apple-system,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Límite agua', bx + bw / 2, by - 11);
  ctx.fillStyle = 'rgba(235,235,245,0.75)';
  ctx.fillText(`${Math.round(res.grip.hydroplaningCriticalKmh)} km/h`, bx + bw / 2, by + bh + 18);
}

function drawHorizonCanvas(res) {
  const cv = $('#horizonCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 36, padR = 24, roadY = H * 0.45, maxDistM = 600;
  const xOf = (m) => padL + (Math.min(maxDistM, Math.max(0, m)) / maxDistM) * (W - padL - padR);

  // Calzada redondeada limpia
  ctx.fillStyle = '#1c1c1e';
  ctx.beginPath();
  ctx.roundRect(padL, roadY - 22, W - padL - padR, 44, 12);
  ctx.fill();

  ctx.font = '600 11px "Inter",-apple-system,sans-serif';
  ctx.fillStyle = 'rgba(235,235,245,0.45)';
  ctx.textAlign = 'center';
  for (let m = 0; m <= maxDistM; m += 150) {
    const x = xOf(m);
    ctx.fillText(`${m} m`, x, roadY + 38);
  }

  // Visibilidad
  if (res.grip.visibilityM != null) {
    const vx = xOf(res.grip.visibilityM);
    ctx.fillStyle = 'rgba(142,142,147,0.18)';
    ctx.fillRect(vx, roadY - 22, xOf(maxDistM) - vx, 44);
    ctx.strokeStyle = 'rgba(235,235,245,0.55)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(vx, roadY - 34); ctx.lineTo(vx, roadY + 26); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e5e5ea';
    ctx.fillText(`Ves ${Math.round(res.grip.visibilityM)} m`, Math.min(W - 45, Math.max(padL + 35, vx)), roadY - 40);
  }

  // Distancia de frenado
  const ssdX = xOf(res.grip.stoppingDistM);
  ctx.fillStyle = res.grip.overdrivingVisibility ? 'rgba(255,69,58,0.52)' : 'rgba(48,209,88,0.38)';
  ctx.beginPath();
  ctx.roundRect(padL + 2, roadY - 10, Math.max(10, ssdX - padL - 2), 20, 8);
  ctx.fill();

  if (res.curves?.topCurve) {
    const c = res.curves.topCurve;
    const cx = xOf(c.entryAheadM);
    ctx.fillStyle = c.cue === 'BRAKE_NOW' ? '#ff453a' : '#ff9f0a';
    ctx.beginPath(); ctx.arc(cx, roadY, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px "Inter",-apple-system,sans-serif';
    ctx.fillText(`Curva ${Math.round(c.safeSpeedKmh)} km/h`, Math.min(W - 75, Math.max(95, cx)), roadY - 38);
  }

  if (res.queue?.queueForming) {
    const qx = xOf(res.queue.interceptDistM);
    ctx.fillStyle = 'rgba(255,69,58,0.78)';
    ctx.beginPath();
    ctx.roundRect(qx, roadY - 18, Math.max(20, xOf(maxDistM) - qx), 36, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px "Inter",-apple-system,sans-serif';
    ctx.fillText(`◀ Cola en ${Math.round(res.queue.interceptDistM)} m`, Math.min(W - 90, Math.max(110, qx)), roadY - 34);
  }

  if (res.crossing?.doNotCross) {
    const fx = xOf(180);
    ctx.fillStyle = 'rgba(255,69,58,0.82)';
    ctx.beginPath(); ctx.roundRect(fx - 26, roadY - 20, 52, 40, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px "Inter",-apple-system,sans-serif';
    ctx.fillText('⛔ NO CRUZAR', fx, roadY - 30);
  }

  // Flecha ego
  ctx.fillStyle = '#0a84ff';
  ctx.beginPath();
  ctx.moveTo(padL + 12, roadY);
  ctx.lineTo(padL - 4, roadY - 8);
  ctx.lineTo(padL - 4, roadY + 8);
  ctx.closePath();
  ctx.fill();

  // Resumen inferior limpio
  ctx.fillStyle = res.grip.overdrivingVisibility ? '#ff6961' : '#30d158';
  ctx.font = '600 12px "Inter",-apple-system,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Parada total: ${Math.round(res.grip.stoppingDistM)} m (reacción ${Math.round(res.grip.reactionDistM)} m + frenado ${Math.round(res.grip.brakingDistM)} m)`, padL, H - 14);
}

/* ───────────── Renderizado de Entorno (Comunicación Directa + Indirecta) ───────────── */

function buildQuickGridHtml() {
  return Object.values(QUICK_CAR_SIGNALS).map((s) => `
    <button class="q-tile${s.urgency === 'ROJO' ? ' danger' : ''}" data-sig="${esc(s.id)}">
      <span class="q-emo">${SIGNAL_ICONS[s.id] ?? '⚠️'}</span>
      <div>
        <b>${esc(s.label)}</b>
        <small>${esc(s.shortAction)}</small>
      </div>
    </button>`).join('');
}

function renderCommunityFeed() {
  const box = $('#communityFeed');
  if (!box) return;
  if (!state.communityFeed.length) {
    box.innerHTML = '<div class="feed-item"><div class="feed-top"><b>Sin avisos activos cerca</b></div><div class="feed-sub">Pulsa cualquiera de los botones de arriba para emitir un aviso directo e indirecto.</div></div>';
    return;
  }
  box.innerHTML = state.communityFeed.map((item) => `
    <article class="feed-item" data-feed-id="${esc(item.id)}">
      <div class="feed-top">
        <b>${SIGNAL_ICONS[item.signalId] ?? '⚠️'} ${esc(item.text)}</b>
        <span class="soft-badge ${item.confidencePct >= 80 ? 'OK' : item.confidencePct >= 55 ? 'WARN' : ''}">${item.confidencePct} %</span>
      </div>
      <div class="feed-sub">${esc(item.trustLabel)} · ${item.directBytes ? `malla ${item.directBytes} B` : 'canal indirecto'}</div>
      <div class="vote-row">
        <button class="vote-btn yes" data-vote="conf" data-id="${esc(item.id)}">👍 Sigue ahí (${item.confirmations})</button>
        <button class="vote-btn no" data-vote="neg" data-id="${esc(item.id)}">✕ Ya despejado (${item.negations})</button>
      </div>
    </article>`).join('');
}

function sendQuickSignal(signalId) {
  const pos = state.scenario === 'real' ? state.real.pos : { lat: 39.428, lon: -0.418 };
  const composed = composeProximityMessage({
    signalId,
    pos,
    speedKmh: state.lastRes?.grip?.speedKmh ?? null,
    recommendedMaxKmh: state.lastRes?.recommendedMaxKmh ?? null,
    nowMs: Date.now(),
  });
  state.lastComposed = composed;

  // Canal DIRECTO: enviar paquete compacto 36 B por Bluetooth nativo si estamos en el APK
  let sentBle = false;
  if (composed.direct.ready && typeof window.SendaNative?.p2pSend === 'function') {
    try {
      window.SendaNative.p2pStart?.();
      window.SendaNative.p2pSend(composed.direct.base64);
      sentBle = true;
    } catch { /* sin Bluetooth nativo */ }
  }

  state.communityFeed.unshift(composed.communityEntry);
  if (state.communityFeed.length > 6) state.communityFeed.pop();
  renderCommunityFeed();

  $('#composeBox').hidden = false;
  $('#composeTitle').textContent = `Aviso: ${composed.spec.label}`;
  $('#composeBadge').textContent = sentBle ? 'Enviado BLE 36 B' : `${composed.direct.byteLength || 0} B listo`;
  $('#composeDirectHint').textContent = sentBle
    ? 'Difundido por Bluetooth cercano (36 B) a móviles SENDA sin usar Internet.'
    : composed.direct.humanHint;
  $('#composeIndirectText').textContent = composed.indirect.shareText;

  openSheet(false);
  setTab('entorno');
  if (state.voiceOn) speak(composed.indirect.voiceAnnouncement);
  showToast(sentBle ? `Enviado a móviles SENDA (${composed.direct.byteLength} B)` : `Aviso «${composed.spec.label}» listo para compartir`);
  return composed;
}

/* ───────────── Renderizado de Calibración en 1 toque ───────────── */

function renderCalibration() {
  const rep = state.calibration.getReadinessReport();
  $('#calOverallPct').textContent = `${rep.overallPct} %`;
  const stageMap = {
    SIN_CALIBRAR: ['Sin calibrar', ''],
    EN_CALIBRACION: ['En calibración', 'WARN'],
    CALIBRADO_LOCAL: ['Calibrado local', 'OK'],
  };
  const [stLbl, stCls] = stageMap[rep.stage] ?? ['En calibración', 'WARN'];
  $('#calStageBadge').textContent = stLbl;
  $('#calStageBadge').className = `soft-badge ${stCls}`;
  $('#calStageNote').textContent = rep.totalMarks > 0
    ? `${rep.totalMarks} validaciones recogidas en esta sesión · 0 PII · ayudan a ajustar SENDA en carretera real`
    : 'Sin marcas aún · cada toque ayuda a calibrar SENDA mientras crece la malla';
  $('#calPrecBadge').textContent = rep.precisionPct != null ? `${rep.precisionPct} % aciertos` : 'Sin datos';

  $('#calBars').innerHTML = rep.pillars.map((p) => `
    <div class="bar-item">
      <div class="bi-top"><b>${esc(p.label)}</b><span>${p.done}/${p.target} (${p.pct} %)</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${p.pct}%"></div></div>
      <div class="bar-note">${esc(p.humanNote)}</div>
    </div>`).join('');
}

function recordCalibration(category, value) {
  const ctx = {
    speedKmh: state.lastRes?.grip?.speedKmh ?? null,
    effectiveMu: state.lastRes?.grip?.effectiveMu ?? null,
    sigmaPosM: state.lastEkfView?.sigmaM ?? null,
    rssiDbm: state.radioScan?.bleBestDbm ?? null,
  };
  const rep = state.calibration.recordGroundTruth({ category, value, context: ctx });
  renderCalibration();
  showToast(`Calibración guardada (${rep.totalMarks} marcas · 0 PII)`);
  return rep;
}

async function exportCalibration() {
  const pack = await state.calibration.exportCalibrationPack();
  const el = $('#calOut');
  el.hidden = false;
  el.textContent = JSON.stringify(pack, null, 2);
  showToast('Paquete de calibración SHA-256 generado (0 PII)');
  return pack;
}

/* ───────────── Bucle principal (1 Hz) ───────────── */

function tick() {
  state.tickPhase++;
  const nowMs = Date.now();
  const { ekfView, radioScan, officialNearbyCount, tickArg } = buildTickInputs(nowMs);
  const res = state.engine.evaluateTick(tickArg);
  const human = translateCopilotForHumans({ copilotResult: res, ekfView, radioScan, officialNearbyCount });
  state.lastRes = res;
  state.lastHuman = human;
  state.lastEkfView = ekfView;

  // 1. Pestaña Copiloto (lenguaje humano cristalino)
  const banner = $('#alertBanner');
  banner.className = `hero-card ${res.status}`;
  $('#egoSpeed').textContent = human.speedKmh;
  $('#bannerTitle').textContent = human.headline;
  $('#bannerAction').textContent = human.action;
  $('#bannerDetail').textContent = human.explanation;

  const capBadge = $('#capBadge');
  $('#capSpeed').textContent = human.recommendedMaxKmh != null ? `${human.recommendedMaxKmh}` : '—';
  capBadge.classList.toggle('warn', human.recommendedMaxKmh != null && human.speedKmh > human.recommendedMaxKmh + 3);

  $('#mGrip').textContent = `${human.gripReservePct} %`;
  $('#mStop').textContent = `${human.stoppingDistM} m`;
  $('#mPeers').textContent = human.directChannel.activePeers > 0 ? `${human.directChannel.activePeers} cerca` : 'A la escucha';

  const gTag = $('#gripTag');
  gTag.textContent = res.grip.gripStatus === 'CRITICAL_SATURATION' ? 'Crítico' : res.grip.gripStatus === 'HIGH_DEMAND' ? 'Atención' : 'Óptimo';
  gTag.className = `soft-badge ${res.grip.gripStatus === 'CRITICAL_SATURATION' ? 'CRIT' : res.grip.gripStatus === 'HIGH_DEMAND' ? 'WARN' : 'OK'}`;

  // 2. Pestaña Entorno (Directo + Indirecto traducido)
  $('#dirPeersTitle').textContent = human.directChannel.statusLabel;
  $('#dirPeersDetail').textContent = human.directChannel.detail;
  const convoyCount = res.shadowConvoy?.convoyCount ?? 0;
  const convoyAlerts = res.shadowConvoy?.convoyAlerts ?? [];
  $('#dirConvoyTitle').textContent = convoyCount > 0 ? `${convoyCount} vehículo(s) en convoy` : 'Convoy cercano';
  $('#dirConvoyDetail').textContent = convoyAlerts.length
    ? convoyAlerts[0].message
    : convoyCount > 0
      ? 'Acompañamiento activo por Bluetooth cercano sin datos móviles.'
      : 'Sin convoy enlazado; se activa automáticamente al viajar con otros SENDA.';
  $('#dirConvoyVal').textContent = convoyAlerts.length ? 'Alerta' : convoyCount > 0 ? 'OK' : '—';

  $('#indDensityTitle').textContent = human.indirectChannel.densityLabel;
  $('#indDensityDetail').textContent = human.indirectChannel.densityDetail;
  $('#indMeshPot').textContent = human.indirectChannel.meshOpportunity;
  $('#indOfficialTitle').textContent = officialNearbyCount > 0 ? `${officialNearbyCount} avisos oficiales en tu zona` : 'Sin avisos oficiales próximos';
  $('#indOfficialCount').textContent = `${officialNearbyCount}`;

  // 3. Pestaña Calibrar (sensores traducidos a humano)
  $('#sGpsLbl').textContent = human.sensorSummary.gps.label;
  $('#sGpsDet').textContent = human.sensorSummary.gps.detail;
  $('#sGripLbl').textContent = human.sensorSummary.grip.label;
  $('#sGripDet').textContent = human.sensorSummary.grip.detail;
  $('#sVisLbl').textContent = human.sensorSummary.visibility.label;
  $('#sVisDet').textContent = human.sensorSummary.visibility.detail;

  // 4. Pestaña Física (datos completos de ingeniería + Android Auto)
  $('#kHydro').textContent = `${res.grip.hydroplaningCriticalKmh} km/h`;
  $('#kReserve').textContent = `${res.grip.gripReservePct} % (${res.grip.kammUtilizationPct} %)`;
  $('#kSsd').textContent = `${res.grip.stoppingDistM} m`;
  if (res.curves?.topCurve) {
    const c = res.curves.topCurve;
    $('#cNext').textContent = `${c.safeSpeedKmh} km/h (${c.entryAheadM} m)`;
    $('#cRad').textContent = `R=${c.minRadiusM} m · ${c.direction} · vuelco ${c.rolloverSpeedKmh} km/h`;
  } else {
    $('#cNext').textContent = 'Recta';
    $('#cRad').textContent = 'Sin curva cerrada en horizonte';
  }
  $('#eMode').textContent = ekfView.mode;
  $('#eShadow').textContent = res.shadowConvoy?.upcomingShadow
    ? `${res.shadowConvoy.upcomingShadow.name} (${res.shadowConvoy.upcomingShadow.distAheadM} m)`
    : `σ_pos ${ekfView.sigmaM != null ? Number(ekfView.sigmaM).toFixed(1) + ' m' : '—'}`;
  $('#fCross').textContent = res.crossing ? res.crossing.verdict : 'Despejado';
  $('#fTime').textContent = res.fatigue ? `${Math.round(res.fatigue.continuousDriveMin)} min · ${res.fatigue.circadianWindow}` : '—';
  $('#fLevel').textContent = res.fatigue ? res.fatigue.level : 'LOW';

  const listEl = $('#alertList');
  if (res.alerts.length === 0) {
    listEl.innerHTML = '<div class="row"><div class="row-body"><b>Tramo despejado por delante</b><small>Sin alertas activas en los 6 motores físicos.</small></div></div>';
  } else {
    listEl.innerHTML = res.alerts.map((a) => `<div class="row"><div class="row-ico ${a.severity === 'ROJO' ? 'red' : a.severity === 'AMBAR' ? 'amber' : 'blue'}">${a.severity === 'ROJO' ? '!' : '▲'}</div><div class="row-body"><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></div></div>`).join('');
  }

  // Puente nativo hacia Android Auto (`DriveCarScreen.java`) y notificación (`DriveSessionService.java`)
  const payloadStr = JSON.stringify(res.androidAutoPayload);
  if (typeof window.SendaNative?.publishDriveState === 'function') {
    try {
      if (window.SendaNative.publishDriveState(payloadStr)) state.aaPushCount++;
    } catch { /* puente no disponible */ }
    $('#aaPill').textContent = `Auto activo (${state.aaPushCount})`;
  } else {
    state.aaPushCount++;
    $('#aaPill').textContent = 'Espejo Auto web';
  }
  $('#aaPushCount').textContent = `${state.aaPushCount} paquetes`;
  $('#sampleCount').textContent = `${state.engine.getSampleCount()} muestras`;

  if (state.voiceOn && res.spokenNow) speak(res.spokenNow);

  drawKammCanvas(res, tickArg.gripInput.axMs2, tickArg.gripInput.ayMs2);
  drawHorizonCanvas(res);
}

async function sealDebrief() {
  const d = await state.engine.buildTripForensicDebrief();
  const pretty = JSON.stringify(d, null, 2);
  state.lastDebriefJson = pretty;
  $('#debriefOut').textContent = pretty;
  $('#copyDebriefBtn').disabled = false;
  showToast('Debriefing SHA-256 sellado (0 PII)');
  return d;
}

// Inicialización de cuadrículas rápidas y eventos
const gridHtml = buildQuickGridHtml();
$('#entornoQuickGrid').innerHTML = gridHtml;
$('#sheetQuickGrid').innerHTML = gridHtml;

document.querySelectorAll('nav.tabs button').forEach((b) => {
  b.addEventListener('click', () => setTab(b.dataset.tab));
});
document.querySelectorAll('.sc-btn').forEach((btn) => {
  btn.addEventListener('click', () => { applyScenarioDefaults(btn.dataset.sc); tick(); });
});
for (const id of ['#surfaceSel', '#vehSel', '#pressRange', '#gradeRange', '#visRange']) {
  $(id).addEventListener('input', () => { getControls(); tick(); });
}
$('#voiceToggle').addEventListener('click', () => {
  state.voiceOn = !state.voiceOn;
  const b = $('#voiceToggle');
  b.classList.toggle('on', state.voiceOn);
  b.setAttribute('aria-pressed', String(state.voiceOn));
  b.textContent = state.voiceOn ? 'Voz ON' : 'Voz';
  showToast(state.voiceOn ? 'Avisos por voz activados' : 'Voz silenciada');
});

$('#openQuickSheetBtn').addEventListener('click', () => openSheet(true));
$('#closeSheetBtn').addEventListener('click', () => openSheet(false));
$('#sheetVeil').addEventListener('click', () => openSheet(false));

document.addEventListener('click', (e) => {
  const sigBtn = e.target.closest('[data-sig]');
  if (sigBtn) { sendQuickSignal(sigBtn.dataset.sig); return; }

  const voteBtn = e.target.closest('[data-vote]');
  if (voteBtn) {
    const id = voteBtn.dataset.id;
    const idx = state.communityFeed.findIndex((x) => x.id === id);
    if (idx >= 0) {
      state.communityFeed[idx] = voteCommunitySignal(state.communityFeed[idx], voteBtn.dataset.vote);
      renderCommunityFeed();
      showToast(voteBtn.dataset.vote === 'conf' ? 'Confirmación registrada' : 'Anotado como despejado');
    }
    return;
  }

  const calBtn = e.target.closest('[data-cal]');
  if (calBtn) {
    const [cat, val] = calBtn.dataset.cal.split(':');
    recordCalibration(cat, val);
  }
});

$('#scanNearbyBtn').addEventListener('click', () => {
  if (typeof window.SendaNative?.radioScan === 'function') {
    window.SendaNative.radioScan();
    showToast('Escaneando entorno Wi-Fi y Bluetooth…');
  } else {
    showToast('En Android escanea radios reales; en web muestra el entorno actual.');
  }
});

$('#shareIndirectBtn').addEventListener('click', async () => {
  if (!state.lastComposed) return;
  const { title, shareText } = state.lastComposed.indirect;
  try {
    if (navigator.share) { await navigator.share({ title, text: shareText }); return; }
  } catch { /* cancelado */ }
  try {
    await navigator.clipboard.writeText(shareText);
    showToast('Aviso copiado para pegar en WhatsApp o SMS');
  } catch {
    showToast('Copia el recuadro de aviso para compartirlo');
  }
});
$('#copyIndirectBtn').addEventListener('click', async () => {
  if (!state.lastComposed) return;
  try {
    await navigator.clipboard.writeText(state.lastComposed.indirect.shareText);
    showToast('Texto copiado');
  } catch { /* */ }
});
$('#speakIndirectBtn').addEventListener('click', () => {
  if (state.lastComposed) speak(state.lastComposed.indirect.voiceAnnouncement);
});

$('#exportCalBtn').addEventListener('click', exportCalibration);
$('#sealDebriefBtn').addEventListener('click', sealDebrief);
$('#copyDebriefBtn').addEventListener('click', async () => {
  if (!state.lastDebriefJson) return;
  try { await navigator.clipboard.writeText(state.lastDebriefJson); showToast('Debriefing JSON copiado'); } catch { /* */ }
});

applyScenarioDefaults('rain_curve');
renderCalibration();
tick();
setInterval(tick, 1000);

globalThis.sendaCopilot = {
  state,
  tick,
  setTab,
  openSheet,
  applyScenarioDefaults,
  sendQuickSignal,
  recordCalibration,
  exportCalibration,
  sealDebrief,
};

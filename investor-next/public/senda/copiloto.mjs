/**
 * SENDA Copiloto 5D · Controlador interactivo del salpicadero offline para el APK Android y navegador.
 * Ejecuta en tiempo real `drive-copilot-physics.mjs` + `drive-kalman-fusion.mjs` + `traffic-shockwave.mjs`
 * y publica instantáneas compactas hacia Android Auto mediante `window.SendaNative?.publishDriveState(...)`.
 */
import {
  PUBLISHED_SURFACE_PRESETS,
  PUBLISHED_VEHICLE_PROFILES,
  createDriveCopilotEngine,
} from './core/drive-copilot-physics.mjs';
import { createGnssImuEkf } from './core/drive-kalman-fusion.mjs';
import { EXAMPLE_LWR_HIGHWAY } from './core/traffic-shockwave.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Polilínea realista con curva cerrada R=60 m a derechas a 240 m para demostración física
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
  scenario: 'rain_curve', // 'real' | 'rain_curve' | 'fog_lwr' | 'tunnel_ekf' | 'flood_gate' | 'night_convoy'
  voiceOn: false,
  engine: createDriveCopilotEngine({ voiceCooldownMs: 12_000 }),
  ekf: createGnssImuEkf(),
  tickPhase: 0,
  gTrail: [],
  aaPushCount: 0,
  lastDebriefJson: null,
  // Telemetría de sensores reales (solo poblada en modo 'real')
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

function speak(text) {
  if (!state.voiceOn || !text) return;
  try {
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 1.05;
    window.speechSynthesis?.speak(u);
  } catch { /* sin síntesis de voz */ }
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

function applyScenarioDefaults(sc) {
  state.scenario = sc;
  state.tickPhase = 0;
  state.gTrail = [];
  state.ekf = createGnssImuEkf();
  document.querySelectorAll('.sc-btn').forEach((b) => b.classList.toggle('on', b.dataset.sc === sc));

  const pill = $('#modePill');
  if (sc === 'real') {
    pill.textContent = 'SENSORES REALES (GPS + IMU)';
    pill.className = 'pill real';
    startRealSensors();
  } else {
    pill.textContent = 'SIMULACIÓN DECLARADA';
    pill.className = 'pill sim';
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
        () => { /* permiso denegado o sin GPS */ },
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

function buildTickInputs(nowMs) {
  const { surface, veh, tirePressureBar, gradePct, visibilityM } = getControls();
  const phase = state.tickPhase;

  if (state.scenario === 'real') {
    state.ekf.predict({ tMs: nowMs, aLongMs2: state.real.axMs2, yawRateRadS: state.real.yawRateRadS });
    const ekfSt = state.ekf.initialized ? state.ekf.state(nowMs) : null;
    const driveMin = (nowMs - state.real.startedAtMs) / 60_000;
    return {
      ekfView: ekfSt
        ? { mode: ekfSt.mode ?? 'GNSS_LOCK', sigmaM: ekfSt.sigmaPosM ?? state.real.accuracyM }
        : { mode: state.real.pos ? 'GNSS_LOCK' : 'ESPERANDO_GPS', sigmaM: state.real.accuracyM },
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

  // Escenarios demostrativos con física 100 % real sobre entradas sintéticas declaradas
  const osc = Math.sin(phase * 0.35);
  let speedKmh = 96;
  let axMs2 = -0.8 + 0.5 * osc;
  let ayMs2 = 1.6 * Math.cos(phase * 0.3);
  let curveInput = null;
  let crossingInput = null;
  let queueInput = null;
  let shadowConvoyInput = null;
  let fatigueInput = { continuousDriveMin: 42, localHour: 11, lateralAccelSamplesMs2: [0.05, 0.08, 0.04, 0.06, 0.05, 0.07], sampleHz: 5 };
  let ekfView = { mode: 'GNSS_LOCK', sigmaM: 3.4 };

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
    if (!state.ekf.initialized) {
      state.ekf.updateGnss({ tMs: nowMs - 4000, lon: -3.7038, lat: 40.4168, accuracyM: 4, speedMs: 20, headingDeg: 90 });
    }
    state.ekf.predict({ tMs: nowMs, aLongMs2: axMs2, yawRateRadS: 0.02 * osc });
    const est = state.ekf.state(nowMs);
    ekfView = { mode: est ? `${est.mode} (${est.gnssAgeS ?? 0}s sin GPS)` : 'DEAD_RECKONING_IMU', sigmaM: est?.sigmaPosM ?? null };
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
    crossingInput = { vehicleClass: veh.floodClass, waterDepthM: 0.48, waterSpeedMs: 1.4 };
  } else if (state.scenario === 'night_convoy') {
    speedKmh = 104;
    axMs2 = -0.2;
    ayMs2 = 0.9 * Math.sin(phase * 1.1);
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

/* ───────────── Renderizado Retina de los 2 instrumentos físicos (<canvas>) ───────────── */

function drawKammCanvas(res, ax, ay) {
  const cv = $('#kammCanvas');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W * 0.42, cy = H * 0.48;
  const maxR = Math.min(W * 0.33, H * 0.35);
  // Escala fija de referencia 1,0 g (= 9,81 m/s²) para que el círculo μg ENCOJA visualmente en lluvia/hielo
  const pxPerG = maxR / 0.95;
  const muG = res.grip.effectiveMu; // en unidades de g
  const rLimit = Math.max(14, Math.min(maxR, muG * pxPerG));

  // Rejilla polar de referencia (0.25g, 0.50g, 0.75g)
  ctx.strokeStyle = 'rgba(143,163,184,0.16)';
  ctx.lineWidth = 1;
  for (const gRing of [0.25, 0.50, 0.75]) {
    ctx.beginPath();
    ctx.arc(cx, cy, gRing * pxPerG, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
  ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
  ctx.stroke();

  // Círculo dinámico de fricción de Kamm (μ_eff · g)
  const col = res.grip.gripStatus === 'CRITICAL_SATURATION' ? '#ff3b30' : res.grip.gripStatus === 'HIGH_DEMAND' ? '#ffb800' : '#2ee6a6';
  ctx.fillStyle = res.grip.gripStatus === 'CRITICAL_SATURATION' ? 'rgba(255,59,48,0.14)' : 'rgba(46,230,166,0.09)';
  ctx.beginPath();
  ctx.arc(cx, cy, rLimit, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Estela del punto G (ay en X, -ax en Y: frenada hacia arriba)
  const gx = ay / 9.80665;
  const gy = -ax / 9.80665;
  state.gTrail.push([gx, gy]);
  if (state.gTrail.length > 24) state.gTrail.shift();
  for (let i = 0; i < state.gTrail.length; i++) {
    const [tx, ty] = state.gTrail[i];
    const alpha = (i + 1) / state.gTrail.length;
    ctx.fillStyle = `rgba(56,189,248,${(alpha * 0.5).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(cx + tx * pxPerG, cy - ty * pxPerG, 3 + alpha * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vector y bola G instantánea
  const px = cx + gx * pxPerG;
  const py = cy - gy * pxPerG;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy); ctx.lineTo(px, py);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Etiquetas cardinales con separación limpia
  ctx.fillStyle = '#8fa3b8';
  ctx.font = '600 11px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FRENADA', cx, cy - maxR - 10);
  ctx.fillText('ACEL', cx, cy + maxR + 16);
  ctx.textAlign = 'left';
  ctx.fillText(`μ=${res.grip.effectiveMu.toFixed(2)}`, cx + rLimit + 8, cy - 6);

  // Barra lateral derecha: Aquaplaning NASA (velocidad actual vs V_p crítica)
  const bx = W * 0.80, bw = 28, by = 36, bh = H - 82;
  ctx.fillStyle = '#151d28';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#2c3d52';
  ctx.strokeRect(bx, by, bw, bh);
  const ratio = Math.min(1.2, res.grip.speedKmh / Math.max(40, res.grip.hydroplaningCriticalKmh));
  const fillH = Math.min(bh, (ratio / 1.2) * bh);
  ctx.fillStyle = res.grip.hydroplaningRisk === 'CRITICAL_HYDROPLANING' ? '#ff3b30' : res.grip.hydroplaningRisk !== 'NONE' ? '#ffb800' : '#38bdf8';
  ctx.fillRect(bx + 2, by + bh - fillH, bw - 4, fillH);
  // Línea crítica NASA (ratio = 1.0)
  const critY = by + bh - (1.0 / 1.2) * bh;
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx - 6, critY); ctx.lineTo(bx + bw + 6, critY); ctx.stroke();
  ctx.fillStyle = '#e2eef8';
  ctx.font = '700 11px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NASA Vp', bx + bw / 2, by - 12);
  ctx.fillText(`${Math.round(res.grip.hydroplaningCriticalKmh)}`, bx + bw / 2, critY - 6);
  ctx.fillStyle = col;
  ctx.fillText(`Agarre libre: ${Math.round(res.grip.gripReservePct)} %`, cx, H - 10);
  ctx.fillStyle = '#8fa3b8';
  ctx.fillText('km/h', bx + bw / 2, by + bh + 16);
}

function drawHorizonCanvas(res) {
  const cv = $('#horizonCanvas');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 48, padR = 24, roadY = H * 0.44, maxDistM = 600;
  const xOf = (m) => padL + (Math.min(maxDistM, Math.max(0, m)) / maxDistM) * (W - padL - padR);

  // Calzada longitudinal (0 → 600 m)
  ctx.fillStyle = '#141d28';
  ctx.fillRect(padL, roadY - 26, W - padL - padR, 52);
  ctx.strokeStyle = '#2d4057';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padL, roadY - 26, W - padL - padR, 52);

  // Marcas de distancia cada 100 m
  ctx.font = '600 11px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#7b92aa';
  ctx.textAlign = 'center';
  for (let m = 0; m <= maxDistM; m += 100) {
    const x = xOf(m);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(x, roadY - 26); ctx.lineTo(x, roadY + 26); ctx.stroke();
    ctx.fillText(`${m}m`, x, roadY + 42);
  }

  // Barra de visibilidad (niebla/luces)
  if (res.grip.visibilityM != null) {
    const vx = xOf(res.grip.visibilityM);
    ctx.fillStyle = 'rgba(148,163,184,0.18)';
    ctx.fillRect(vx, roadY - 26, xOf(maxDistM) - vx, 52);
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(vx, roadY - 40); ctx.lineTo(vx, roadY + 32); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`Vis ${res.grip.visibilityM}m`, vx, roadY - 44);
  }

  // Barra de distancia de parada AASHTO (SSD)
  const ssdX = xOf(res.grip.stoppingDistM);
  ctx.fillStyle = res.grip.overdrivingVisibility ? 'rgba(255,59,48,0.45)' : 'rgba(46,230,166,0.32)';
  ctx.fillRect(padL, roadY - 12, Math.max(4, ssdX - padL), 24);
  ctx.fillStyle = res.grip.overdrivingVisibility ? '#ff867f' : '#2ee6a6';
  ctx.textAlign = 'left';
  ctx.fillText(`SSD ${res.grip.stoppingDistM} m`, Math.min(W - 115, ssdX + 6), roadY + 4);

  // Curva crítica por delante
  if (res.curves?.topCurve) {
    const c = res.curves.topCurve;
    const cx = xOf(c.entryAheadM);
    const col = c.cue === 'BRAKE_NOW' ? '#ff3b30' : c.cue === 'COAST_EARLY' ? '#ffb800' : '#38bdf8';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, roadY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.fillText(`${c.direction === 'DERECHA' ? '↱' : '↰'} R=${c.minRadiusM}m · ${c.safeSpeedKmh} km/h`, Math.min(W - 110, Math.max(120, cx)), roadY - 56);
  }

  // Cola móvil LWR por delante
  if (res.queue?.queueForming) {
    const qx = xOf(res.queue.interceptDistM);
    ctx.fillStyle = 'rgba(255,59,48,0.75)';
    ctx.fillRect(qx, roadY - 22, Math.max(18, xOf(maxDistM) - qx), 44);
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`◀ COLA LWR (${Math.abs(res.queue.shockwaveKmh)} km/h) en ${res.queue.interceptDistM} m`, Math.min(W - 140, Math.max(150, qx)), roadY - 34);
  }

  // Cruce inundado / fuego
  if (res.crossing?.doNotCross) {
    const fx = xOf(180);
    ctx.fillStyle = 'rgba(255,59,48,0.65)';
    ctx.fillRect(fx - 24, roadY - 26, 48, 52);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('⛔ NO CRUZAR', fx, roadY - 34);
  }

  // Vehículo propio en x = 0
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(padL + 12, roadY);
  ctx.lineTo(padL - 4, roadY - 9);
  ctx.lineTo(padL - 4, roadY + 9);
  ctx.closePath();
  ctx.fill();

  // Banda inferior comparativa: Parada vs Visibilidad
  const barY = H - 56, barW = W - padL - padR;
  ctx.fillStyle = '#0f1620';
  ctx.fillRect(padL, barY, barW, 20);
  ctx.fillStyle = res.grip.overdrivingVisibility ? '#ff3b30' : '#2ee6a6';
  ctx.fillRect(padL, barY, Math.min(barW, (res.grip.stoppingDistM / 300) * barW), 20);
  ctx.fillStyle = '#d7e5f2';
  ctx.font = '600 11px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Parada total: ${res.grip.stoppingDistM} m (reacción ${res.grip.reactionDistM} m + frenado ${res.grip.brakingDistM} m)`, padL, barY - 6);
}

/* ───────────── Bucle principal de actualización (1 Hz) ───────────── */

function tick() {
  state.tickPhase++;
  const nowMs = Date.now();
  const { ekfView, tickArg } = buildTickInputs(nowMs);
  const res = state.engine.evaluateTick(tickArg);

  // Banner principal
  const banner = $('#alertBanner');
  banner.className = `banner ${res.status}`;
  $('#egoSpeed').textContent = Math.round(res.grip.speedKmh);
  $('#bannerTitle').textContent = res.primaryAlert ? res.primaryAlert.title : 'Conducción dentro de envolvente física segura';
  $('#bannerDetail').textContent = res.primaryAlert
    ? res.primaryAlert.detail
    : `Reserva de adherencia ${res.grip.gripReservePct} % · Parada AASHTO ${res.grip.stoppingDistM} m · Sin peligros inmediatos.`;

  const capBadge = $('#capBadge');
  const capVal = res.recommendedMaxKmh;
  $('#capSpeed').textContent = capVal != null ? `${Math.round(capVal)}` : '—';
  capBadge.classList.toggle('warn', capVal != null && res.grip.speedKmh > capVal + 3);

  // Subsistema 1: Adherencia y Parada
  const gTag = $('#gripTag');
  gTag.textContent = res.grip.gripStatus;
  gTag.className = `tag ${res.grip.gripStatus === 'CRITICAL_SATURATION' ? 'CRIT' : res.grip.gripStatus === 'HIGH_DEMAND' ? 'WARN' : 'OK'}`;
  $('#kHydro').textContent = `${res.grip.hydroplaningCriticalKmh} km/h (${res.grip.hydroplaningRisk === 'NONE' ? 'sin balsa' : res.grip.hydroplaningRisk})`;
  $('#kReserve').textContent = `${res.grip.gripReservePct} % (Kamm ${res.grip.kammUtilizationPct} %)`;
  $('#kSsd').textContent = `${res.grip.stoppingDistM} m (a=${res.grip.aBrakeNetMs2} m/s²)`;
  $('#kVisMax').textContent = res.grip.maxSafeVisibilitySpeedKmh != null ? `${res.grip.maxSafeVisibilitySpeedKmh} km/h` : '—';

  // Subsistema 2: Curvas y SSF
  if (res.curves?.topCurve) {
    const c = res.curves.topCurve;
    $('#cNext').textContent = `${c.cue} (${c.entryAheadM} m)`;
    $('#cRad').textContent = `R=${c.minRadiusM} m · ${c.direction}`;
    $('#cSafe').textContent = `${c.safeSpeedKmh} km/h`;
    $('#cRoll').textContent = `${c.rolloverSpeedKmh} km/h`;
    $('#curveTag').className = `tag ${c.cue === 'BRAKE_NOW' ? 'CRIT' : c.cue === 'COAST_EARLY' ? 'WARN' : 'OK'}`;
    $('#curveTag').textContent = c.cue;
  } else {
    $('#cNext').textContent = 'Sin curva cerrada en horizonte';
    $('#cRad').textContent = '—';
    $('#cSafe').textContent = '—';
    $('#cRoll').textContent = '—';
    $('#curveTag').className = 'tag';
    $('#curveTag').textContent = 'RECTA';
  }

  // Subsistema 3: EKF túnel y Convoy BLE
  $('#eMode').textContent = ekfView.mode;
  $('#eSigma').textContent = ekfView.sigmaM != null ? `${Number(ekfView.sigmaM).toFixed(1)} m` : '—';
  $('#eShadow').textContent = res.shadowConvoy?.upcomingShadow
    ? `${res.shadowConvoy.upcomingShadow.name} (${res.shadowConvoy.upcomingShadow.distAheadM} m)`
    : 'Cobertura nominal';
  $('#eConvoy').textContent = res.shadowConvoy?.convoyCount
    ? `${res.shadowConvoy.convoyCount} vehículo(s) · ${res.shadowConvoy.convoyAlerts.length} alerta(s)`
    : 'Sin convoy activo';

  // Subsistema 4: Fatiga y Emergencia
  $('#fTime').textContent = res.fatigue ? `${Math.round(res.fatigue.continuousDriveMin)} min · ${res.fatigue.circadianWindow}` : '—';
  $('#fJerk').textContent = res.fatigue?.lateralJerkRmsMs3 != null ? `${res.fatigue.lateralJerkRmsMs3} m/s³` : '—';
  $('#fCross').textContent = res.crossing ? res.crossing.verdict : 'Despejado';
  $('#fLevel').textContent = res.fatigue ? res.fatigue.level : 'LOW';
  $('#fatTag').className = `tag ${res.crossing?.doNotCross || res.fatigue?.level === 'CRITICAL_STOP_NOW' ? 'CRIT' : res.fatigue?.level === 'HIGH_STOP_SOON' ? 'WARN' : 'OK'}`;

  // Lista de alertas priorizadas + espejo Android Auto
  const listEl = $('#alertList');
  if (res.alerts.length === 0) {
    listEl.innerHTML = '<li class="alert-item"><b>Tramo despejado por delante</b><small>Sin alertas activas en los 6 motores físicos.</small></li>';
  } else {
    listEl.innerHTML = res.alerts.map((a) => `<li class="alert-item ${esc(a.severity)}"><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></li>`).join('');
  }

  // Publicar hacia Android Auto / notificación nativa si corremos dentro del APK Android
  const payloadStr = JSON.stringify(res.androidAutoPayload);
  if (typeof window.SendaNative?.publishDriveState === 'function') {
    try {
      if (window.SendaNative.publishDriveState(payloadStr)) state.aaPushCount++;
    } catch { /* puente no disponible */ }
    $('#aaPill').textContent = `Android Auto: ACTIVO (${state.aaPushCount})`;
    $('#aaPill').className = 'pill real';
  } else {
    state.aaPushCount++;
    $('#aaPill').textContent = 'Android Auto: Espejo Web';
  }
  $('#aaPushCount').textContent = `${state.aaPushCount} paquetes`;
  $('#sampleCount').textContent = `${state.engine.getSampleCount()} muestras`;

  if (res.spokenNow) speak(res.spokenNow);

  drawKammCanvas(res, tickArg.gripInput.axMs2, tickArg.gripInput.ayMs2);
  drawHorizonCanvas(res);
}

async function sealDebrief() {
  const d = await state.engine.buildTripForensicDebrief();
  const pretty = JSON.stringify(d, null, 2);
  state.lastDebriefJson = pretty;
  $('#debriefOut').textContent = pretty;
  $('#copyDebriefBtn').disabled = false;
}

// Eventos UI
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
  b.textContent = state.voiceOn ? '🔊 Voz ON' : '🔇 Voz OFF';
});
$('#debriefBtn').addEventListener('click', sealDebrief);
$('#sealDebriefBtn').addEventListener('click', sealDebrief);
$('#copyDebriefBtn').addEventListener('click', async () => {
  if (!state.lastDebriefJson) return;
  try { await navigator.clipboard.writeText(state.lastDebriefJson); $('#copyDebriefBtn').textContent = '✓ Copiado'; } catch { /* */ }
});

applyScenarioDefaults('rain_curve');
tick();
setInterval(tick, 1000);

globalThis.sendaCopilot = { state, tick, applyScenarioDefaults, sealDebrief };

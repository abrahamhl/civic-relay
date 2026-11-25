import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COPILOT_G_MS2,
  PUBLISHED_SURFACE_PRESETS,
  PUBLISHED_VEHICLE_PROFILES,
  computeDynamicGripEnvelope,
  analyzeRouteCurvesAhead,
  evaluateRoadEmergencyCrossing,
  evaluateConvoyAndShadowHorizon,
  assessDriverFatigueRisk,
  createDriveCopilotEngine,
} from '../src/drive-copilot-physics.mjs';

test('Verificación analítica: aquaplaning NASA (Horne & Dreher 1963), Círculo de Kamm y SSD con pendiente/niebla', () => {
  // 2,2 bar = 220 kPa -> v_p = 6,3435 * sqrt(220) = 94,09 km/h exacto
  const rain = computeDynamicGripEnvelope({
    speedMs: 100 / 3.6,
    axMs2: -1.5,
    ayMs2: 1.5,
    surfaceMu: PUBLISHED_SURFACE_PRESETS.heavy_rain.muLong,
    tirePressureBar: 2.2,
    standingWaterMm: 3.5,
    gradePct: -6, // bajada del 6 % alarga la frenada
    reactionTimeS: 1.5,
    visibilityM: 60,
  });
  assert.ok(Math.abs(rain.hydroplaningCriticalKmh - 94.1) < 0.2, `v_p=${rain.hydroplaningCriticalKmh}`);
  assert.equal(rain.hydroplaningRisk, 'CRITICAL_HYDROPLANING');
  assert.equal(rain.overdrivingVisibility, true);
  assert.ok(rain.maxSafeVisibilitySpeedKmh < 65);

  // Verificación exacta de la ecuación de parada en niebla: con v = maxSafeVisibilitySpeedKmh, SSD ≈ visibilityM
  const checkVis = computeDynamicGripEnvelope({
    speedMs: rain.maxSafeVisibilitySpeedKmh / 3.6,
    axMs2: 0,
    ayMs2: 0,
    surfaceMu: PUBLISHED_SURFACE_PRESETS.dry_asphalt.muLong,
    tirePressureBar: 2.2,
    standingWaterMm: 0,
    gradePct: 0,
    reactionTimeS: 1.5,
    visibilityM: 50,
  });
  const vLim = checkVis.maxSafeVisibilitySpeedKmh / 3.6;
  const ssdAtLim = vLim * 1.5 + (vLim * vLim) / (2 * (0.80 * COPILOT_G_MS2));
  assert.ok(Math.abs(ssdAtLim - 50) < 0.2, `SSD en velocidad límite de visibilidad=${ssdAtLim} m vs 50 m`);

  // Círculo de Kamm en asfalto seco: ax=3 m/s², ay=4 m/s² -> a_comb=5 m/s², a_max = 0.8*9.80665 = 7.8453 m/s²
  const dry = computeDynamicGripEnvelope({
    speedMs: 20,
    axMs2: -3,
    ayMs2: 4,
    surfaceMu: 0.80,
    tirePressureBar: 2.4,
    standingWaterMm: 0,
    gradePct: 0,
    reactionTimeS: 1.5,
  });
  const expectedKamm = (5 / (0.80 * COPILOT_G_MS2)) * 100;
  assert.ok(Math.abs(dry.kammUtilizationPct - expectedKamm) < 0.2);
  assert.equal(dry.hydroplaningRisk, 'NONE');
});

test('Horizonte predictivo de curvas (curvatura de Menger exacta en arco R=60 m) y límite de vuelco SSF SUV vs berlina', () => {
  // Construir una polilínea exacta: recta de 250 m hacia el Norte + arco circular de radio R=60 m hacia la DERECHA (Este) + recta 150 m
  const lat0 = 39.428, lon0 = -0.418;
  const mLat = 111_132.95;
  const mLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const toLL = (x, y) => [lon0 + x / mLon, lat0 + y / mLat];

  const coords = [];
  for (let y = 0; y <= 240; y += 20) coords.push(toLL(0, y));
  const R = 60;
  // Centro del arco a la derecha en (R, 240), ángulo de π a π/2 (giro 90° a derechas)
  for (let deg = 170; deg >= 90; deg -= 10) {
    const th = (deg * Math.PI) / 180;
    coords.push(toLL(R + R * Math.cos(th), 240 + R * Math.sin(th)));
  }
  for (let x = R + 20; x <= R + 160; x += 20) coords.push(toLL(x, 240 + R));

  const sedanRes = analyzeRouteCurvesAhead({
    routeCoords: coords,
    egoAlongM: 0,
    egoSpeedMs: 110 / 3.6, // llegando muy pasado a curva R=60 m
    horizonM: 600,
    maxLateralMu: 0.25,
    superelevationE: 0.04,
    vehicleSsf: PUBLISHED_VEHICLE_PROFILES.sedan.ssf,
    comfortBrakeMs2: 3.0,
    reactionTimeS: 1.5,
  });
  const suvRes = analyzeRouteCurvesAhead({
    routeCoords: coords,
    egoAlongM: 0,
    egoSpeedMs: 110 / 3.6,
    horizonM: 600,
    maxLateralMu: 0.25,
    superelevationE: 0.04,
    vehicleSsf: PUBLISHED_VEHICLE_PROFILES.van_4x4.ssf,
    comfortBrakeMs2: 3.0,
    reactionTimeS: 1.5,
  });

  assert.ok(sedanRes.topCurve != null);
  assert.equal(sedanRes.topCurve.direction, 'DERECHA');
  // Radio recuperado por curvatura de Menger debe coincidir con R = 60 m (< 2 % error)
  assert.ok(Math.abs(sedanRes.topCurve.minRadiusM - R) < 1.5, `R medido=${sedanRes.topCurve.minRadiusM} m vs exacto 60 m`);
  assert.equal(sedanRes.topCurve.cue, 'COAST_EARLY');
  const closer = analyzeRouteCurvesAhead({
    routeCoords: coords,
    egoAlongM: 90,
    egoSpeedMs: 110 / 3.6,
    horizonM: 600,
    maxLateralMu: 0.25,
    superelevationE: 0.04,
    vehicleSsf: PUBLISHED_VEHICLE_PROFILES.sedan.ssf,
    comfortBrakeMs2: 3.0,
    reactionTimeS: 1.5,
  });
  assert.equal(closer.topCurve.cue, 'BRAKE_NOW');
  assert.ok(suvRes.topCurve.rolloverSpeedKmh < sedanRes.topCurve.rolloverSpeedKmh, 'un 4x4/furgoneta alta tiene techo de vuelco menor que una berlina');
});

test('Puerta de cruce en emergencia (riada Shand 2011 / fuego), zona de sombra y convoy BLE cooperativo', () => {
  const carFlood = evaluateRoadEmergencyCrossing({ vehicleClass: 'small_passenger', waterDepthM: 0.35, waterSpeedMs: 1.2 });
  const suvFlood = evaluateRoadEmergencyCrossing({ vehicleClass: 'large_4wd', waterDepthM: 0.35, waterSpeedMs: 0.4 });
  assert.equal(carFlood.doNotCross, true);
  assert.equal(suvFlood.doNotCross, false);

  const fire = evaluateRoadEmergencyCrossing({ vehicleClass: 'large_4wd', fireDistanceM: 180, smokePm25UgM3: 420 });
  assert.equal(fire.doNotCross, true);
  assert.equal(fire.smokeSevere, true);

  const now = 1_764_000_000_000;
  const sc = evaluateConvoyAndShadowHorizon({
    egoPos: { lat: 39.428, lon: -0.418 },
    egoSpeedMs: 25,
    nowMs: now,
    shadowZonesAhead: [{ id: 'tun-1', name: 'Túnel M-30 Sur', distAheadM: 950, lengthM: 3400, kind: 'TUNNEL' }],
    convoyPeers: [
      { id: 'c2', callsign: 'Coche familia', lat: 39.423, lon: -0.418, speedMs: 0.1, lastSeenMs: now - 4000, stoppedSinceMs: now - 65_000, rssiDbm: -88 },
    ],
    maxConvoySpacingM: 800,
    lostContactS: 45,
    unexpectedStopS: 45,
  });
  assert.ok(sc.upcomingShadow.actions.includes('ARM_EKF_IMU_DEAD_RECKONING'));
  assert.equal(sc.convoyAlerts.length, 1);
  assert.equal(sc.convoyAlerts[0].state, 'PEER_STOPPED_CHECK');
});

test('Fatiga sin cámara ni PII (WOCL + IMU lateral jerk), árbitro cognitivo ISO 15005, Android Auto y debriefing SHA-256', async () => {
  // Conducción fresca diurna suave
  const fresh = assessDriverFatigueRisk({
    continuousDriveMin: 35,
    localHour: 10,
    lateralAccelSamplesMs2: [0.05, 0.06, 0.04, 0.05, 0.07, 0.05, 0.04, 0.06],
    sampleHz: 5,
  });
  assert.equal(fresh.level, 'LOW');

  // 03:30 AM, 165 min sin descansar + micro-correcciones laterales bruscas en zig-zag
  const drowsy = assessDriverFatigueRisk({
    continuousDriveMin: 165,
    localHour: 3,
    lateralAccelSamplesMs2: [0, 0.9, -0.8, 1.1, -1.0, 0.95, -0.9, 1.0, -0.85, 0.9],
    sampleHz: 5,
  });
  assert.equal(drowsy.circadianWindow, 'WOCL_PRIMARY');
  assert.ok(['HIGH_STOP_SOON', 'CRITICAL_STOP_NOW'].includes(drowsy.level));
  assert.ok(drowsy.microCorrectionBursts >= 3);

  // Árbitro cognitivo + enfriamiento de voz + salida Android Auto + debriefing SHA-256
  const engine = createDriveCopilotEngine({ voiceCooldownMs: 15_000 });
  const baseInput = {
    gripInput: { speedMs: 105 / 3.6, axMs2: -1.0, ayMs2: 1.0, surfaceMu: 0.35, tirePressureBar: 2.2, standingWaterMm: 3.5, gradePct: -4, reactionTimeS: 1.5, visibilityM: 70 },
    crossingInput: { vehicleClass: 'small_passenger', waterDepthM: 0.45, waterSpeedMs: 1.5 },
    fatigueInput: { continuousDriveMin: 150, localHour: 3, lateralAccelSamplesMs2: [0, 0.9, -0.9, 1.0, -1.0, 0.9], sampleHz: 5 },
  };
  const tick1 = engine.evaluateTick({ nowMs: 1000, ...baseInput });
  const tick2 = engine.evaluateTick({ nowMs: 5000, ...baseInput }); // dentro del cooldown 15 s -> no repite voz
  const tick3 = engine.evaluateTick({ nowMs: 20_000, ...baseInput }); // pasado el cooldown -> vuelve a hablar

  assert.equal(tick1.status, 'ROJO');
  assert.equal(tick1.primaryAlert.id, 'EMERGENCY_CROSSING'); // máxima prioridad sobre fatiga y aquaplaning
  assert.ok(tick1.spokenNow != null);
  assert.equal(tick2.spokenNow, null, 'el enfriamiento ISO 15005 debe evitar spam de voz');
  assert.ok(tick3.spokenNow != null);
  assert.ok(tick1.androidAutoPayload.rows.length >= 2 && tick1.androidAutoPayload.rows.length <= 4);

  const debrief = await engine.buildTripForensicDebrief();
  assert.equal(debrief.samples, 3);
  assert.match(debrief.sha256, /^[0-9a-f]{64}$/);
  assert.equal(debrief.basis, 'MEASURED');
});

test('Regla de veracidad: exige todos los parámetros físicos sin valores ocultos', () => {
  assert.throws(() => computeDynamicGripEnvelope({ speedMs: 20 }), /surfaceMu/);
  assert.throws(() => computeDynamicGripEnvelope({ speedMs: 20, surfaceMu: 0.8, standingWaterMm: 0, gradePct: 0, reactionTimeS: 1.5 }), /tirePressureBar/);
  assert.throws(() => evaluateRoadEmergencyCrossing({ waterDepthM: 0.2 }), /vehicleClass/);
});

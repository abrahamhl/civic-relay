import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fresnelZone1RadiusM,
  analyzeUrbanCanyon,
  analyzeRfEnvironment,
  parseWifiSurveyJsonl,
  analyzeRoadSurfaceImu,
  createSurfaceMapper,
  runFieldLabBattery,
} from '../src/drive-field-lab.mjs';

test('Fresnel 1.ª zona exacto (2,44 / 5,90 GHz) y clasificación de cañón urbano (GNSS/EKF y edificios)', () => {
  // Punto medio de 100 m: r1 = 0.5 * sqrt(lambda * 100)
  const r244 = fresnelZone1RadiusM(2.44e9, 50, 50);
  const r590 = fresnelZone1RadiusM(5.90e9, 50, 50);
  assert.ok(Math.abs(r244 - 1.753) < 0.01, `esperado ~1.753 m, got ${r244}`);
  assert.ok(Math.abs(r590 - 1.127) < 0.01, `esperado ~1.127 m, got ${r590}`);

  const open = analyzeUrbanCanyon({
    gnssHistory: [{ accuracyM: 3.5, altM: 12.1, maha2: 1.2 }, { accuracyM: 4.0, altM: 12.3, maha2: 2.1 }],
  });
  assert.equal(open.canyonClass, 'OPEN_ROAD');
  assert.equal(open.basis, 'MEDIDO');

  const canyon = analyzeUrbanCanyon({
    gnssHistory: [{ accuracyM: 22, altM: 10, maha2: 19.5, rejected: true }, { accuracyM: 18, altM: 24, maha2: 12 }],
  });
  assert.equal(canyon.canyonClass, 'URBAN_CANYON_NLOS');
  assert.equal(canyon.rejectedJumps, 1);

  const bgt = analyzeUrbanCanyon({
    buildings: [{ heightM: 24, distM: 10 }, { heightM: 18, distM: 12 }],
  });
  assert.equal(bgt.canyonClass, 'URBAN_CANYON_NLOS');
  assert.equal(bgt.hwRatio, 1.2);
  assert.ok(bgt.skyViewFactor > 0.3 && bgt.skyViewFactor < 0.45);
});

test('Física RF pasiva: factor K de Rice, OLS log-distancia n̂, CRLB 2D, anomalía y 0 fuga de MAC/SSID', () => {
  // 1) Canal LOS casi constante → K de Rice alto (> 3 dB)
  const los = analyzeRfEnvironment([
    { bssid: 'AA:BB:CC:DD:EE:01', rssiDbm: -62.0 },
    { bssid: 'AA:BB:CC:DD:EE:01', rssiDbm: -62.4 },
    { bssid: 'AA:BB:CC:DD:EE:01', rssiDbm: -61.8 },
    { bssid: 'AA:BB:CC:DD:EE:01', rssiDbm: -62.2 },
    { bssid: 'AA:BB:CC:DD:EE:01', rssiDbm: -62.1 },
  ]);
  assert.equal(los.fadingRegime, 'LOS_DOMINANT');
  assert.ok(los.ricianKDb > 10);
  assert.equal(los.uniqueSaltedNodes, 1);
  // Privacidad estricta: la MAC jamás aparece en el resultado
  assert.ok(!JSON.stringify(los).includes('AA:BB:CC:DD:EE:01'));

  // 2) Regresión OLS log-distancia con n = 3.2 exacto + 4 anclas 2D para CRLB
  const nTrue = 3.2, p0 = -38;
  const anchors = [
    { bssid: '11:22:33:44:55:01', dxM: 12, dyM: 0 },
    { bssid: '11:22:33:44:55:02', dxM: 0, dyM: 25 },
    { bssid: '11:22:33:44:55:03', dxM: -40, dyM: 10 },
    { bssid: '11:22:33:44:55:04', dxM: 15, dyM: -60 },
  ].map((a) => {
    const distM = Math.hypot(a.dxM, a.dyM);
    return { ...a, distM, rssiDbm: +(p0 - 10 * nTrue * Math.log10(distM)).toFixed(2) };
  });
  const fit = analyzeRfEnvironment(anchors);
  assert.ok(Math.abs(fit.pathLossN - nTrue) < 0.05, `esperado n≈3.2, got ${fit.pathLossN}`);
  assert.ok(fit.crlbPosM != null && fit.crlbPosM > 0 && fit.crlbPosM < 30);
  assert.equal(fit.securityStatus, 'INTEGRITY_OK');

  // 3) Anomalía pasiva por saturación RSSI (> -15 dBm)
  const anom = analyzeRfEnvironment([
    { rssiDbm: -8 }, { rssiDbm: -75 }, { rssiDbm: -80 }, { rssiDbm: -82 },
  ]);
  assert.equal(anom.securityStatus, 'ANOMALY_FLAGGED');
  assert.ok(anom.anomalies.includes('SATURACION_RSSI_CERCANA_O_SPOOF'));
});

test('parseWifiSurveyJsonl anonimiza BSSID y descarta SSIDs + analizador IMU de firme y mapeador 25 m GeoJSON', () => {
  const jsonl = [
    JSON.stringify({ x: 10, y: 5, z: 0, bssid: 'DE:AD:BE:EF:00:01', ssid: 'CasaPrivada5G', rssi: -64, t: 1700000001 }),
    JSON.stringify({ x: -12, y: 18, z: 0, bssid: 'DE:AD:BE:EF:00:02', ssid: 'Movistar_1234', rssi: -78, t: 1700000002 }),
    'linea_corrupta_ignorada',
  ].join('\n');
  const parsed = parseWifiSurveyJsonl(jsonl);
  assert.equal(parsed.length, 2);
  const rawDump = JSON.stringify(parsed);
  assert.ok(!rawDump.includes('DE:AD:BE:EF'), 'MAC cruda no debe filtrarse');
  assert.ok(!rawDump.includes('CasaPrivada5G'), 'SSID privado no debe filtrarse');

  // Rugosidad IMU: autopista lisa vs calle bacheada
  const smooth = analyzeRoadSurfaceImu([9.81, 9.79, 9.83, 9.80, 9.82, 9.80].map((az) => ({ az, speedMs: 25 })));
  assert.equal(smooth.surfaceClass, 'LISO');
  const rough = analyzeRoadSurfaceImu([9.8, 12.6, 6.9, 13.1, 7.2, 12.4].map((az) => ({ az, speedMs: 12 })));
  assert.equal(rough.surfaceClass, 'BACHEADO');
  assert.equal(analyzeRoadSurfaceImu([]).surfaceClass, 'SIN_IMU');

  // Mapeador 25 m × 25 m → GeoJSON sin PII
  const mapper = createSurfaceMapper({ cellSizeM: 25 });
  mapper.ingest({ lon: 4.9041, lat: 52.3676, accuracyM: 4, ekfMaha2: 1.5, imuRmsZ: 0.3, rfCount: 6, rssiMedianDbm: -71, online: true, visionObjects: 2, region: 'NL' });
  mapper.ingest({ lon: 4.9048, lat: 52.3680, accuracyM: 21, ekfMaha2: 18.2, ekfRejected: true, imuRmsZ: 1.9, rfCount: 14, rssiMedianDbm: -84, online: false, visionObjects: 4, region: 'NL' });
  const sum = mapper.summary();
  assert.equal(sum.totalCells, 2);
  assert.equal(sum.canyonCells, 1);
  assert.equal(sum.deadZoneCells, 1);
  assert.equal(sum.roughCells, 1);
  const gj = mapper.toGeoJson();
  assert.equal(gj.type, 'FeatureCollection');
  assert.equal(gj.features.length, 2);
  assert.equal(gj.features[1].properties.canyonClass, 'URBAN_CANYON_NLOS');
  assert.equal(gj.features[1].properties.surfaceClass, 'BACHEADO');
});

test('runFieldLabBattery ejecuta los 8 motores en 1 toque (modo completo NL + modo honesto sin sensores)', () => {
  // 1) Sin sensores: nunca inventa datos
  const empty = runFieldLabBattery({});
  assert.equal(empty.tests.length, 8);
  assert.equal(empty.tests.find((t) => t.id === 'EKF_GNSS_MULTIPATH').status, 'NO_SENSOR');
  assert.equal(empty.tests.find((t) => t.id === 'SURFACE_IRI_IMU').status, 'NO_SENSOR');
  assert.equal(empty.tests.find((t) => t.id === 'CRYPTO_DENM_WIRE').status, 'OK'); // autoprueba CRC-16 siempre corre

  // 2) Con telemetría real en Países Bajos
  const full = runFieldLabBattery({
    pos: [4.9041, 52.3676],
    speedMs: 25,
    headingDeg: 90,
    altM: -2.1,
    region: 'NL',
    ekfState: { mode: 'GNSS_FUSED', sigmaPosM: 3.4, outliersRejected: 0 },
    horizonStatus: { calibrated: true, samples: 22, pitchDeg: 3.2, horizonY: 0.413 },
    gnssHistory: [{ accuracyM: 4.2, altM: -2.1, maha2: 1.4 }],
    imuHistory: [9.8, 9.7, 9.9, 9.8, 9.85].map((az) => ({ az, speedMs: 25 })),
    rfSamples: [{ rssiDbm: -68 }, { rssiDbm: -69 }, { rssiDbm: -67 }, { rssiDbm: -70 }],
    radarsCount: 1970,
    incidentsCount: 769,
    vision: { active: true, hz: 4, inferMs: 65, count: 3, level: 'VERDE' },
    radioCaps: { bt: true, btOn: true, leCodedPhy: true, model: 'Google Pixel 7' },
    bleStats: { tx: 2, rx: 1, rejected: 0 },
    probeStats: { medianRttMs: 42 },
    blackbox: { active: true, count: 15 },
    surfaceSummary: { totalCells: 12 },
    online: false,
  });
  assert.equal(full.tests.length, 8);
  assert.equal(full.summary.OK, 8);
  assert.equal(full.summary.overall, 'OK');
  assert.ok(full.tests.find((t) => t.id === 'EKF_GNSS_MULTIPATH').metrics.nap != null);
});

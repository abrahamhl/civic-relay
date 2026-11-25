import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVENANCE_LEVELS,
  EVACUATION_PROFILES,
  routeEvacuationGraph,
  computeFallbackEscapeBearing,
  rankEmergencySafeZones,
  filterItemsByAoi,
  clusterIncidentsByGrid,
  scanViewportSituation,
  createOfflineAreaPackage,
  verifyOfflineAreaPackage,
  createSourceHealthRegistry,
} from '../src/emergency-routing-zones.mjs';

const SAMPLE_GRAPH = {
  nodes: [
    { id: 'origen', lat: 39.428, lon: -0.418 },   // Paiporta centro
    { id: 'puente', lat: 39.431, lon: -0.415 },   // puente inundado
    { id: 'cuesta', lat: 39.434, lon: -0.422 },   // subida empinada no accesible (12 deg)
    { id: 'rampa', lat: 39.432, lon: -0.425 },    // desvío accesible suave (3 deg)
    { id: 'refugio', lat: 39.438, lon: -0.420 },  // zona alta segura
  ],
  edges: [
    // Camino directo por el puente: 0.65 m a 1.5 m/s -> inestable para peatón y turismo
    { from: 'origen', to: 'puente', lengthM: 420, waterDepthM: 0.65, waterSpeedMs: 1.5, accessible: true },
    { from: 'puente', to: 'refugio', lengthM: 500, accessible: true },
    // Camino intermedio por cuesta empinada (12°): apto para peatón estándar, bloqueado para movilidad reducida
    { from: 'origen', to: 'cuesta', lengthM: 750, slopeDeg: 12, accessible: false },
    { from: 'cuesta', to: 'refugio', lengthM: 520, slopeDeg: 4, accessible: true },
    // Camino accesible suave: desvío más largo pero seguro, sin agua y con pendiente accesible ≤ 6°
    { from: 'origen', to: 'rampa', lengthM: 1600, slopeDeg: 3, accessible: true },
    { from: 'rampa', to: 'refugio', lengthM: 1500, slopeDeg: 3, accessible: true },
  ],
};

test('Enrutador multivector A*: evita puente inundado (Cox/Shand) y adapta ruta a movilidad reducida', () => {
  // Peatón estándar evita el puente inundado y toma la cuesta más corta
  const ped = routeEvacuationGraph({
    ...SAMPLE_GRAPH,
    startId: 'origen',
    goalIds: ['refugio'],
    profile: 'pedestrian',
    debrisFactor: 0.5,
  });
  assert.equal(ped.found, true);
  assert.deepEqual(ped.path, ['origen', 'cuesta', 'refugio']);
  assert.ok(ped.avoidedBlockedEdgesCount >= 1);

  // Persona con movilidad reducida evita TANTO el puente inundado COMO la cuesta de 12° no accesible
  const acc = routeEvacuationGraph({
    ...SAMPLE_GRAPH,
    startId: 'origen',
    goalIds: ['refugio'],
    profile: 'low_mobility_accessible',
    debrisFactor: 0.5,
  });
  assert.equal(acc.found, true);
  assert.deepEqual(acc.path, ['origen', 'rampa', 'refugio']);

  // Turismo pequeño evita el puente inundado (0.65 m > 0.30 m límite Shand 2011)
  const car = routeEvacuationGraph({
    ...SAMPLE_GRAPH,
    startId: 'origen',
    goalIds: ['refugio'],
    profile: 'small_vehicle',
  });
  assert.equal(car.found, true);
  assert.ok(!car.path.includes('puente'));
  assert.ok(EVACUATION_PROFILES.emergency_4x4.vehicleClass === 'large_4wd');

  // Respaldo sin grafo vial: rumbo de escape se aleja de un incendio situado al Norte (39.45) hacia el Sur (~180°)
  const esc = computeFallbackEscapeBearing({
    origin: { lat: 39.43, lon: -0.42 },
    hazards: [{ lat: 39.45, lon: -0.42, severityWeight: 2 }],
    safeTargets: [{ lat: 39.40, lon: -0.42, attractionWeight: 1 }],
  });
  assert.ok(esc.bearingDeg > 165 && esc.bearingDeg < 195, `rumbo esperado ~180°, obtenido ${esc.bearingDeg}°`);
});

test('Motor multicriterio explicable de zonas seguras: descarta inundables/llenas y exige pesos declarados', () => {
  const weights = { floodMargin: 3, fireDistance: 2, airQuality: 1, accessibility: 2, capacity: 1.5, comms: 1, proximity: 1 };
  const ranked = rankEmergencySafeZones([
    { id: 'z_flooded', name: 'Polideportivo bajo', handMarginM: 0.2, fireDistanceKm: 12, pm25UgM3: 15, wheelchairAccessible: true, occupancyRatio: 0.2, radioMarginDb: 12, etaMinutes: 5, provenance: 'OBSERVED' },
    { id: 'z_best', name: 'Instituto cota alta', handMarginM: 9.5, fireDistanceKm: 10, pm25UgM3: 20, wheelchairAccessible: true, approachSlopeDeg: 2, occupancyRatio: 0.25, radioMarginDb: 14, etaMinutes: 12, provenance: 'OBSERVED' },
    { id: 'z_sim', name: 'Pabellón sin verificar', handMarginM: 8.0, fireDistanceKm: 9, pm25UgM3: 25, wheelchairAccessible: false, occupancyRatio: 0.3, radioMarginDb: 5, etaMinutes: 10, provenance: 'SIMULATED' },
    { id: 'z_full', name: 'Centro cívico lleno', handMarginM: 7.0, fireDistanceKm: 11, pm25UgM3: 10, wheelchairAccessible: true, occupancyRatio: 1.0, radioMarginDb: 10, etaMinutes: 8, provenance: 'OBSERVED' },
  ], { weights, topK: 3 });

  assert.equal(ranked.topRecommendations.length, 2);
  assert.equal(ranked.topRecommendations[0].id, 'z_best');
  assert.ok(ranked.topRecommendations[0].strengths.includes('accesible_movilidad_reducida'));
  assert.ok(ranked.topRecommendations[0].score100 > ranked.topRecommendations[1].score100);
  assert.equal(ranked.allEvaluated.find((z) => z.id === 'z_flooded').suitable, false);
  assert.equal(ranked.allEvaluated.find((z) => z.id === 'z_full').suitable, false);
  assert.throws(() => rankEmergencySafeZones([{ id: 'a' }], {}), /weights/);
  assert.equal(PROVENANCE_LEVELS.length, 7);
});

test('AOI (círculo, caja, polígono), clustering espacial por zoom y escáner en 1 clic', () => {
  const reports = [
    { id: 'r1', lat: 39.428, lon: -0.418, level: 'N4', hazardType: 'inundacion' },
    { id: 'r2', lat: 39.429, lon: -0.419, level: 'N2', hazardType: 'inundacion' },
    { id: 'r3', lat: 39.473, lon: -0.718, level: 'N3', hazardType: 'desprendimiento', hasContradiction: true }, // Chiva, lejos
  ];
  const inCircle = filterItemsByAoi(reports, { type: 'circle', lat: 39.428, lon: -0.418, radiusKm: 5 });
  assert.equal(inCircle.length, 2);
  const inBbox = filterItemsByAoi(reports, { type: 'bbox', bbox: [-0.45, 39.40, -0.38, 39.45] });
  assert.equal(inBbox.length, 2);
  const inPoly = filterItemsByAoi(reports, {
    type: 'polygon',
    coordinates: [[-0.45, 39.40], [-0.38, 39.40], [-0.38, 39.45], [-0.45, 39.45]],
  });
  assert.equal(inPoly.length, 2);

  // Clustering: a zoom bajo (z=8) agrupa r1+r2 preservando nivel máximo N4
  const clusters = clusterIncidentsByGrid(reports, { zoom: 8 });
  assert.ok(clusters.some((c) => c.count === 2 && c.maxLevel === 'N4'));

  // Escáner situacional 1-clic nunca activa aviso público
  const scan = scanViewportSituation({
    items: reports,
    shelters: [{ id: 's1', lat: 39.43, lon: -0.42 }],
    aoi: { type: 'bbox', bbox: [-0.8, 39.35, -0.35, 39.55] },
  });
  assert.equal(scan.totalReportsInView, 3);
  assert.equal(scan.activeContradictions, 1);
  assert.equal(scan.canPublicWarn, false);
  assert.equal(scan.topPriorityItems[0].id, 'r1');
});

test('Empaquetador de área sin red (SHA-256 + manipulación + frescura TTL) y registro de salud de fuentes', async () => {
  const pkg = await createOfflineAreaPackage({
    areaId: 'horta-sud-2026',
    bbox: [-0.62, 39.33, -0.33, 39.51],
    createdAtUtc: '2026-11-25T10:00:00Z',
    maxBytesBudget: 50000,
    layers: [
      { id: 'shelters', kind: 'poi', provenance: 'OBSERVED', capturedAtUtc: '2026-11-25T10:00:00Z', ttlSec: 3600, data: [{ id: 's1', lat: 39.43, lon: -0.42 }] },
      { id: 'radio_nodes', kind: 'mesh', provenance: 'CALCULATED', capturedAtUtc: '2026-11-25T10:00:00Z', ttlSec: 7200, data: [{ id: 'chiva-rep', freqMhz: 868.1 }] },
    ],
  });

  // Verificación fresca (30 min después)
  const fresh = await verifyOfflineAreaPackage(pkg, '2026-11-25T10:30:00Z');
  assert.equal(fresh.valid, true);
  assert.equal(fresh.anyStale, false);
  assert.equal(fresh.layerChecks[0].freshnessFactor, 1);

  // Verificación caducada (4 h después): sigue íntegro pero baja freshnessFactor y degrada OBSERVED → INFERRED
  const aged = await verifyOfflineAreaPackage(pkg, '2026-11-25T14:00:00Z');
  assert.equal(aged.valid, true);
  assert.equal(aged.anyStale, true);
  assert.ok(aged.layerChecks[0].freshnessFactor < 0.5);
  assert.equal(aged.layerChecks[0].effectiveProvenance, 'INFERRED');

  // Manipulación de una capa detectada por SHA-256
  const tampered = { ...pkg, payloads: { ...pkg.payloads, shelters: [{ id: 's1', lat: 0, lon: 0 }] } };
  const bad = await verifyOfflineAreaPackage(tampered, '2026-11-25T10:30:00Z');
  assert.equal(bad.valid, false);

  // Registro de salud de fuentes: degradación honesta al caducar o fallar
  const reg = createSourceHealthRegistry([
    { id: 'saih_chj', label: 'SAIH CHJ', ttlSec: 900 },
    { id: 'copernicus', label: 'Copernicus EMS', ttlSec: 3600 },
  ]);
  reg.recordSuccess('saih_chj', { atIso: '2026-11-25T10:00:00Z', provenance: 'OBSERVED' });
  assert.equal(reg.getStatus('saih_chj', '2026-11-25T10:05:00Z').health, 'HEALTHY');
  assert.equal(reg.getStatus('saih_chj', '2026-11-25T10:05:00Z').effectiveProvenance, 'OBSERVED');
  // 1 hora después (excede TTL 900 s) nunca miente como OBSERVED
  const staleSt = reg.getStatus('saih_chj', '2026-11-25T11:00:00Z');
  assert.equal(staleSt.health, 'STALE_DEGRADED');
  assert.equal(staleSt.effectiveProvenance, 'INFERRED');
  // 3 fallos consecutivos → ERROR
  reg.recordFailure('copernicus', { error: 'HTTP 503' });
  reg.recordFailure('copernicus', { error: 'timeout' });
  reg.recordFailure('copernicus', { error: 'timeout' });
  assert.equal(reg.getStatus('copernicus', '2026-11-25T10:10:00Z').health, 'ERROR');
});

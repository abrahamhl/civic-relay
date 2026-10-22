import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EVIDENCE_LABELS,
  CELESTIAL_BODIES,
  PILOT_SECTORS,
  CAMERA_SOURCES,
  validateCameraUpstreamUrl,
  checkSectorAccessPolicy,
  computeFovPolygon,
  createSectorCameraAdapter
} from '../lib/sector-camera-engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('PILOT_SECTORS includes El Tiemblo (Avila), Valencia, and Arnhem with GeoJSON polygons', () => {
  const ids = PILOT_SECTORS.map(s => s.id);
  assert.deepEqual(ids, ['SECTOR-AVILA-TIEMBLO', 'SECTOR-VLC-TURIA', 'SECTOR-NL-ARNHEM']);
  for (const sec of PILOT_SECTORS) {
    assert.equal(sec.geometry.type, 'Polygon');
    assert.ok(sec.geometry.coordinates[0].length >= 5);
    assert.ok(sec.subSectors.length >= 2);
    assert.ok(sec.description.es.length > 20);
    assert.ok(sec.description.en.length > 20);
    assert.ok(sec.description.nl.length > 20);
  }
});

test('validateCameraUpstreamUrl blocks SSRF, loopback, private IPs, HTTP, credentials and unapproved domains', () => {
  const blocked = [
    ['http://infocar.dgt.es/etraffic/', 'NON_HTTPS_PROTOCOL_BLOCKED'],
    ['https://127.0.0.1/stream.m3u8', 'SSRF_PRIVATE_OR_IP_LITERAL_BLOCKED'],
    ['https://localhost/cam', 'SSRF_PRIVATE_OR_IP_LITERAL_BLOCKED'],
    ['https://169.254.169.254/latest/meta-data/', 'SSRF_PRIVATE_OR_IP_LITERAL_BLOCKED'],
    ['https://192.168.1.50/axis-cgi/mjpg/video.cgi', 'SSRF_PRIVATE_OR_IP_LITERAL_BLOCKED'],
    ['https://10.0.0.12/live', 'SSRF_PRIVATE_OR_IP_LITERAL_BLOCKED'],
    ['https://172.20.0.4/live', 'SSRF_PRIVATE_OR_IP_LITERAL_BLOCKED'],
    ['https://admin:secret@infocar.dgt.es/etraffic/', 'EMBEDDED_CREDENTIALS_BLOCKED'],
    ['https://evil.example.com/camera.jpg', 'FAIL_CLOSED_DOMAIN_NOT_ALLOWLISTED']
  ];
  for (const [url, expectedReason] of blocked) {
    const res = validateCameraUpstreamUrl(url);
    assert.equal(res.allowed, false, `Expected ${url} to be blocked`);
    assert.equal(res.reason, expectedReason);
  }

  const allowed = validateCameraUpstreamUrl('https://infocar.dgt.es/etraffic/');
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reason, 'ALLOWLISTED_PUBLIC_HTTPS_SOURCE');
});

test('checkSectorAccessPolicy enforces RBAC for restricted cameras and prohibits biometric/LPR analytics', () => {
  const rbacCam = CAMERA_SOURCES.find(c => c.accessPolicy === 'INSTITUTIONAL_RBAC_REQUIRED');
  assert.ok(rbacCam, 'Expected an RBAC-restricted camera in catalog');

  const publicCheck = checkSectorAccessPolicy({ camera: rbacCam, role: 'PUBLIC_VISITOR', institutionAuthorized: false });
  assert.equal(publicCheck.permitted, false);
  assert.equal(publicCheck.status, 'RBAC_BLOCKED_PUBLIC_VIEW');
  assert.equal(publicCheck.evidenceLabel, EVIDENCE_LABELS.UNAVAILABLE_NO_PERMISSION);
  assert.equal(publicCheck.privacyGuard.facialRecognitionAllowed, false);
  assert.equal(publicCheck.privacyGuard.licensePlateOcrAllowed, false);
  assert.equal(publicCheck.privacyGuard.individualTrackingAllowed, false);
  assert.equal(publicCheck.privacyGuard.autoDispatchFromVideoAllowed, false);

  const authCheck = checkSectorAccessPolicy({ camera: rbacCam, role: 'INSTITUTIONAL_OPERATOR', institutionAuthorized: true });
  assert.equal(authCheck.permitted, true);
  assert.equal(authCheck.status, 'NO_SIGNAL');
});

test('computeFovPolygon generates closed uncalibrated GeoJSON cone polygons', () => {
  const cam = CAMERA_SOURCES[0];
  const feature = computeFovPolygon(cam.coordinates, cam.fovEstimate, 10);
  assert.equal(feature.type, 'Feature');
  assert.equal(feature.properties.calibrated, false);
  assert.equal(feature.properties.estimationType, 'METADATA_AZIMUTH_CONE_ESTIMATE');
  const ring = feature.geometry.coordinates[0];
  assert.equal(ring.length, 13);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
});

test('createSectorCameraAdapter explainSectorDecision couples deterministically with runScenario and separates video from SOS', () => {
  const adapter = createSectorCameraAdapter();
  const outageTrace = adapter.explainSectorDecision('SECTOR-AVILA-TIEMBLO', {
    damaged: 100,
    gateway: false,
    bluetooth: false,
    wifi: false
  });
  assert.equal(outageTrace.kind, 'OEP_SECTOR_CAUSAL_TRACE_V1');
  assert.equal(outageTrace.simulationSummary.syntheticAcks, 0);
  assert.ok(outageTrace.simulationSummary.queued > 0);
  assert.equal(outageTrace.observationalLayer.inferHumanPositionFromVideo, false);
  assert.equal(outageTrace.observationalLayer.autoDispatchFromVideo, false);
  assert.equal(outageTrace.causalChain.length, 5);

  const gatewayTrace = adapter.explainSectorDecision('SECTOR-AVILA-TIEMBLO', {
    damaged: 100,
    gateway: true,
    bluetooth: true,
    wifi: true
  });
  assert.ok(gatewayTrace.simulationSummary.simulatedLocalGatewayAcks > 0);
  assert.ok(gatewayTrace.simulationSummary.syntheticAcks > 0);
});

test('CELESTIAL_BODIES marks Moon and Mars as educational non-OEP visualizations', () => {
  assert.equal(CELESTIAL_BODIES.EARTH.oepActive, true);
  assert.equal(CELESTIAL_BODIES.MOON.oepActive, false);
  assert.equal(CELESTIAL_BODIES.MARS.oepActive, false);
  assert.match(CELESTIAL_BODIES.MOON.notice.es, /NO opera en la Luna/);
  assert.match(CELESTIAL_BODIES.MARS.notice.es, /NO opera en Marte/);
});

test('investor-page, mission-control, and sector-intelligence-console expose 30s thesis, 8 scenes, 3D globe, and CCTV matrix', () => {
  const page = readFileSync(resolve(root, 'investor-next/app/investor-page.tsx'), 'utf8');
  const mc = readFileSync(resolve(root, 'investor-next/app/mission-control.tsx'), 'utf8');
  const sec = readFileSync(resolve(root, 'investor-next/app/sector-intelligence-console.tsx'), 'utf8');

  assert.ok(page.includes('<SectorIntelligenceConsole locale={locale}/>'));
  assert.ok(page.includes('thirty-second-thesis-card'));
  assert.ok(page.includes('three-surfaces-switcher'));
  assert.ok(page.includes('eight-scene-journey-bar'));
  assert.ok(mc.includes('THREE.Raycaster'));
  assert.ok(mc.includes('non-earth-educational-banner'));
  assert.ok(sec.includes('sector-gis-map-svg'));
  assert.ok(sec.includes('unified-pipeline-explorer'));
});

test('all 6 mandatory docs/product specifications exist and are populated', () => {
  const requiredDocs = [
    'docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md',
    'docs/product/WEBSITE_INFORMATION_ARCHITECTURE.md',
    'docs/product/INTERACTION_SPEC_AND_STATE_MODEL.md',
    'docs/product/CAMERA_SECTOR_ARCHITECTURE.md',
    'docs/product/SCIENTIFIC_TRUTH_MATRIX.md',
    'docs/product/BEFORE_AFTER_UX_AUDIT.md'
  ];
  for (const rel of requiredDocs) {
    const full = resolve(root, rel);
    assert.equal(existsSync(full), true, `Missing required product doc: ${rel}`);
    const text = readFileSync(full, 'utf8');
    assert.ok(text.length > 1500, `Product doc ${rel} is unexpectedly short`);
  }
});

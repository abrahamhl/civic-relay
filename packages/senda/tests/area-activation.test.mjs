import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURFACE_SOURCES, FORBIDDEN_REQUESTS, scanSurface, authorizeSurfaceRequest, fuseHazardEvidence, evacuationDecision, EVIDENCE_LR,
} from '../src/area-activation.mjs';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const centre = { lat: 40.4168, lon: -3.7038 };

test('Registro: cada fuente declara vía legal, estado y módulo; nada intrusivo figura como fuente', () => {
  for (const s of SURFACE_SOURCES) {
    assert.ok(s.access && s.status && s.module && s.what, s.id);
    assert.notEqual(s.access, 'NOT_ALLOWED', `${s.id} no puede ser una fuente`);
  }
  for (const id of ['CONNECTED_CARS', 'WIND_FARM_SCADA', 'V16_BEACONS']) {
    assert.equal(SURFACE_SOURCES.find((s) => s.id === id).access, 'AGREEMENT', `${id}: solo por convenio`);
  }
});

test('Inventario del perímetro: distancias, frescura, k-anonimato de teléfonos y huecos declarados', () => {
  const inv = {
    PUBLIC_CAMERAS: [
      { id: 'cam-near', lat: 40.4180, lon: -3.7030, observedAt: '2026-11-10T11:59:30Z' },
      { id: 'cam-far', lat: 40.60, lon: -3.70, observedAt: '2026-11-10T11:59:30Z' },
    ],
    TRAFFIC_SENSORS: [{ id: 'pm-1', lat: 40.415, lon: -3.705, observedAt: '2026-11-10T09:00:00Z' }],
    SENDA_PHONE_CELLS: [
      { lat: 40.4168, lon: -3.7038, devices: 12 },
      { lat: 40.4175, lon: -3.7040, devices: 3 },
      { lat: 41.0, lon: -3.7, devices: 50 },
    ],
  };
  const s = scanSurface({ center: centre, radiusKm: 1, now: NOW, inventory: inv });
  const cams = s.sources.find((x) => x.id === 'PUBLIC_CAMERAS');
  assert.equal(cams.count, 1, 'la cámara lejana queda fuera');
  assert.equal(cams.nearest[0].id, 'cam-near');
  assert.ok(cams.nearest[0].distanceKm < 0.2);
  assert.equal(s.sources.find((x) => x.id === 'TRAFFIC_SENSORS').stale, 1, 'lectura de hace 3 h marcada como antigua');
  assert.deepEqual(s.sendaDevices, { count: 12, suppressedCells: 1, kAnon: 5 }, 'celdas con < 5 dispositivos suprimidas');
  assert.ok(s.gaps.some((g) => g.startsWith('FIRMS_HOTSPOTS: NEEDS_KEY')));
});

test('Autorización: lo intrusivo se rechaza con motivo; convenios y claves se piden; órdenes solo con credencial', () => {
  for (const kind of Object.keys(FORBIDDEN_REQUESTS)) {
    const r = authorizeSurfaceRequest({ kind }, { verifiedInstitution: true });
    assert.equal(r.decision, 'DENY', kind);
    assert.ok(r.reason.length > 20);
  }
  assert.equal(authorizeSurfaceRequest({ sourceId: 'CONNECTED_CARS' }, {}).decision, 'NEEDS_AGREEMENT');
  assert.equal(authorizeSurfaceRequest({ sourceId: 'CONNECTED_CARS' }, { agreements: ['CONNECTED_CARS'] }).decision, 'ALLOW');
  assert.equal(authorizeSurfaceRequest({ sourceId: 'FIRMS_HOTSPOTS' }, {}).decision, 'NEEDS_KEY');
  assert.equal(authorizeSurfaceRequest({ sourceId: 'PUBLIC_CAMERAS' }, {}).decision, 'ALLOW');
  assert.equal(authorizeSurfaceRequest({ kind: 'COMMAND_SENDA_PHONES' }, {}).decision, 'DENY');
  assert.equal(authorizeSurfaceRequest({ kind: 'COMMAND_SENDA_PHONES' }, { verifiedInstitution: true }).decision, 'ALLOW');
});

test('Fusión en log-odds: forma cerrada y las fuentes dependientes cuentan una sola vez', () => {
  const one = fuseHazardEvidence([{ type: 'CITIZEN_REPORT', present: true }], { prior: 0.02 });
  const odds = (0.02 / 0.98) * EVIDENCE_LR.CITIZEN_REPORT.present;
  assert.ok(Math.abs(one.posterior - odds / (1 + odds)) < 1e-12);
  // FIRMS y GDACS-WF vienen del mismo satélite (GWIS ≈ detecciones activas): no son dos confirmaciones.
  const dep = fuseHazardEvidence([
    { type: 'SATELLITE_HOTSPOT', present: true, lineage: 'satellite-active-fire' },
    { type: 'GDACS_WILDFIRE_EVENT', present: true, lineage: 'satellite-active-fire' },
  ]);
  const solo = fuseHazardEvidence([{ type: 'SATELLITE_HOTSPOT', present: true, lineage: 'satellite-active-fire' }]);
  assert.equal(dep.discardedAsDependent, 1);
  assert.ok(Math.abs(dep.posterior - solo.posterior) < 1e-12);
  // Denuncia con foto + cámara confirmada por operador + satélite: alta confianza.
  const strong = fuseHazardEvidence([
    { type: 'CITIZEN_REPORT_WITH_PHOTO', present: true },
    { type: 'CAMERA_OPERATOR_CONFIRMED', present: true },
    { type: 'SATELLITE_HOTSPOT', present: true, lineage: 'sat' },
  ]);
  assert.ok(strong.posterior > 0.99);
  // Una cámara que mira y NO ve fuego resta.
  const neg = fuseHazardEvidence([{ type: 'CITIZEN_REPORT', present: true }, { type: 'CAMERA_OPERATOR_CONFIRMED', present: false }]);
  assert.ok(neg.posterior < one.posterior);
  assert.throws(() => fuseHazardEvidence([{ type: 'RUMOUR', present: true }]), RangeError);
});

test('Evacuación: margen de tiempo frente a avance del peligro decide evacuar, confinar, verificar o vigilar', () => {
  const building = { lat: 40.4168, lon: -3.7038 };
  const fire = { lat: 40.4168 + 0.009, lon: -3.7038, spreadMps: 0.5 }; // ≈ 1 km, 0,5 m/s ⇒ ≈ 2000 s
  const ev = evacuationDecision({ building, hazard: fire, pHazard: 0.9, occupants: 200 });
  assert.equal(ev.decision, 'EVACUATE');
  assert.ok(Math.abs(ev.distanceM - 1001) < 5);
  assert.ok(Math.abs(ev.egressS - (30 + 120 + 200 / 2.6)) < 1e-9);
  assert.deepEqual(ev.command.actions, ['SIREN', 'REPORT_STATUS']);
  const close = evacuationDecision({ building, hazard: { ...fire, lat: 40.4168 + 0.0015, spreadMps: 1 }, pHazard: 0.9, occupants: 400 });
  assert.equal(close.decision, 'SHELTER_IN_PLACE_OR_EVACUATE_NOW_IF_ROUTE_SAFE');
  assert.equal(evacuationDecision({ building, hazard: fire, pHazard: 0.3, occupants: 50 }).decision, 'VERIFY_AND_PREPARE');
  assert.equal(evacuationDecision({ building, hazard: fire, pHazard: 0.05, occupants: 50 }).command, null);
});

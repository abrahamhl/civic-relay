import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCameraEvent, toRoadObservation, crossCheck, CAMERA_ACCESS, CAMERA_EVENT_SCHEMA } from '../src/vehicle-camera-link.mjs';
import { fuseRoadEvidence } from '../src/roadsafe-correlation.mjs';
import { HAZARD } from '../src/road-guard.mjs';

// Eventos SINTÉTICOS (forma del contrato; ninguno procede de un vídeo real).
const ev = (o = {}) => ({ schema: CAMERA_EVENT_SCHEMA, eventId: 'e1', source: 'TESLACAM_USB', deviceId: 'dev-A', at: 1000, lat: 50.6, lon: 5.57, anomaly: 'VEHICLE_ACROSS_LANE', laneHint: 'LEFT_LANE', detector: { model: 'yolox_s', version: '0.1.1rc0', score: 0.71 }, heuristic: { name: 'box-aspect-in-ego-lane', validated: false }, consent: { share: true }, ...o });

test('cámaras · acceso real declarado: la visión del fabricante NO está disponible; los vídeos del dueño sí', () => {
  assert.equal(CAMERA_ACCESS.find((s) => s.id === 'OEM_VISION_DETECTIONS').status, 'NOT_AVAILABLE');
  assert.equal(CAMERA_ACCESS.find((s) => s.id === 'TESLACAM_USB').status, 'OWNER_FILES');
  assert.match(validateCameraEvent(ev({ source: 'TESLA_FLEET_LIVE_CAMERA' })).errors.join(), /no integrada/);
  assert.match(validateCameraEvent(ev({ source: 'OEM_VISION_DETECTIONS' })).errors.join(), /no integrada/);
});

test('cámaras · privacidad por diseño: imagen, matrícula o cara ⇒ rechazo; sin consentimiento ⇒ rechazo', () => {
  for (const bad of [{ image: 'base64…' }, { detector: { model: 'x', version: '1', score: 0.5, plate: '1234ABC' } }, { faces: [] }]) {
    const r = validateCameraEvent(ev(bad)); assert.equal(r.ok, false); assert.equal(r.privacyReject, true);
  }
  assert.match(validateCameraEvent(ev({ consent: { share: false } })).errors.join(), /consentimiento/);
  assert.match(validateCameraEvent(ev({ heuristic: { name: 'h', validated: true } })).errors.join(), /validada/);
  assert.match(validateCameraEvent(ev({ detector: { model: 'x', version: '1', score: 1.7 } })).errors.join(), /score/);
});

test('cámaras · evento → observación vial con raíz por vehículo; score marcado como salida del detector', () => {
  const o = toRoadObservation(ev());
  assert.equal(o.source, 'VEHICLE_CAMERA_AI'); assert.equal(o.reporterId, 'dev-A'); assert.equal(o.hazard, HAZARD.CRASH); assert.equal(o.laneHint, 'LEFT_LANE');
  assert.equal(o.provenance.scoreMeaning, 'SALIDA_DEL_DETECTOR_NO_PROBABILIDAD');
  const pub = toRoadObservation(ev({ source: 'PUBLIC_CAMERA_DGT', deviceId: undefined, consent: undefined, cameraId: 'DGT-CAM-123', eventId: 'p1' }));
  assert.equal(pub.source, 'PUBLIC_CAMERA_AI'); assert.equal(pub.rootHint, 'DGT-CAM-123');
});

test('cámaras · fusión honesta: sin calibrar no suben la confianza ni corroboran por sí solas', () => {
  const obs = [toRoadObservation(ev()), toRoadObservation(ev({ eventId: 'e2', deviceId: 'dev-B' })), toRoadObservation(ev({ source: 'PUBLIC_CAMERA_DGT', deviceId: undefined, consent: undefined, cameraId: 'C1', eventId: 'p1' }))];
  const f = fuseRoadEvidence(obs, { now: 1001 });
  assert.equal(f.independentRoots, 3); assert.equal(f.uncalibratedRoots, 3);
  assert.notEqual(f.status, 'CORROBORATED', 'tres detecciones sin calibrar no son una corroboración');
  assert.ok(f.contributions.every((c) => c.dLogOdds === 0 && c.uncalibrated));
});

test('cámaras · cruce con otras fuentes: dos clips del mismo coche son un avistamiento; otro coche y una V16 suman', () => {
  const v16 = { obsId: 'v16', source: 'V16_BEACON', rootHint: 'B1', at: 1005, lat: 50.6001, lon: 5.5701, accuracyM: 8 };
  const r = crossCheck([ev(), ev({ eventId: 'e1b', at: 1010 }), ev({ eventId: 'e3', deviceId: 'dev-C', at: 1020 }), ev({ eventId: 'bad', image: 'x' })], [v16], { radiusM: 250, windowS: 900 });
  assert.equal(r.accepted, 3); assert.equal(r.rejected.length, 1); assert.equal(r.rejected[0].privacyReject, true);
  assert.equal(r.groups.length, 1); assert.equal(r.groups[0].independentSightings, 3, 'dev-A (2 clips) + dev-C + V16'); assert.equal(r.groups[0].cameraOnly, false);
  assert.throws(() => crossCheck([], [], { radiusM: 250 }), /«windowS» debe declararse/);
});

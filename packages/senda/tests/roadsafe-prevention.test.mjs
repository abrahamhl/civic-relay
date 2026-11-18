import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE, CASEBOOK, evidenceFor } from '../src/roadsafe-evidence.mjs';
import { assessIncidentRisk, sightMargin, durationReferenceCurve, recommendedActions } from '../src/roadsafe-risk-factors.mjs';
import { prioritizeIncidents } from '../src/roadsafe-priority.mjs';
import { planIncidentZone, queueProjection, zoneCifsPolyline, vmsText, EXAMPLE_QUEUE_PARAMS as QP } from '../src/roadsafe-zone.mjs';
import { demoRoad } from '../src/road-guard.mjs';
import { validateCifs } from '../src/roadsafe-interop.mjs';
import { circumstanceGrid, CIRCUMSTANCES, EXAMPLE_SCENARIO_CASE_STUDY as SC_EX } from '../src/roadsafe-accident-sim.mjs';

test('evidencia: cada caso de la casuística cita entradas existentes con grado y fuente', () => {
  const grades = new Set(['A', 'B', 'C', 'E', 'H']);
  for (const e of Object.values(EVIDENCE)) { assert.ok(grades.has(e.grade)); assert.ok(e.source && e.claim && e.transfer); }
  for (const c of CASEBOOK) { assert.ok(c.evidence.length && c.roadsafe.length); for (const id of c.evidence) assert.ok(EVIDENCE[id], `${c.id} cita ${id}`); }
  assert.equal(CASEBOOK.length, 8);
  assert.equal(EVIDENCE.ES_PEDESTRIANS_AFTER_EXIT.grade, 'E', 'la cifra DGT de 25/año es una estimación sin desglose');
  assert.equal(evidenceFor(['DURATION_PER_MIN'])[0].value, 0.012);
});

test('factores: la física integra noche, lluvia y niebla (margen de visibilidad) sin doble conteo', () => {
  const day = sightMargin({ v85Kmh: 100, sightM: 200 }), wetNight = sightMargin({ v85Kmh: 100, sightM: 200, wet: true, night: true });
  assert.ok(day.ratio > 1 && wetNight.ratio < day.ratio);
  const fog = assessIncidentRisk({ night: false, hour: 12, laneBlocked: 'SHOULDER', v85Kmh: 100, visibilityM: 40, durationMin: 5, flowVehH: 800, peopleOutside: false, waitingTow: false, queueForming: false, respondersExposed: false, heavyShare: 0.1 });
  assert.ok(fog.drivers.some((d) => d.factor === 'SIGHT_MARGIN' && d.mult === 3));
  assert.equal(fog.uncertain, false);
});

test('factores: riesgo vital siempre CRITICAL; datos desconocidos → rango y caso pesimista; nunca probabilidad', () => {
  const life = assessIncidentRisk({ trapped: true, laneBlocked: 'SHOULDER' });
  assert.equal(life.tier, 'CRITICAL'); assert.deepEqual(life.lifeRisk, ['personas atrapadas']);
  const unk = assessIncidentRisk({});
  assert.equal(unk.uncertain, true); assert.ok(unk.indexRange[0] < unk.indexRange[1]); assert.equal(unk.index, unk.indexRange[1]);
  const low = assessIncidentRisk({ laneBlocked: 'NONE', v85Kmh: 80, sightM: 400, durationMin: 0, flowVehH: 200, peopleOutside: false, waitingTow: false, queueForming: false, respondersExposed: false, heavyShare: 0 });
  const high = assessIncidentRisk({ laneBlocked: 'FULL', v85Kmh: 110, sightM: 90, night: true, wet: true, durationMin: 40, flowVehH: 2400, peopleOutside: true, waitingTow: true, queueForming: true, respondersExposed: true, heavyShare: 0.3 });
  assert.equal(low.tier, 'MONITOR'); assert.equal(high.tier, 'CRITICAL'); assert.ok(high.index > low.index);
  assert.match(high.note, /NO probabilidad/);
  assert.ok(recommendedActions(high).some((a) => a.who === 'CENTRO_DE_TRAFICO'));
  assert.ok(recommendedActions(life)[0].what.includes('112'));
  const curve = durationReferenceCurve(); assert.ok(curve.points.at(-1).p > curve.points[0].p); assert.equal(curve.grade, 'B');
});

test('prioridad: vida > escalada > nivel > índice > espera; baja confianza no rebaja un riesgo vital; reordenación auditada', () => {
  const now = 10_000;
  const items = [
    { id: 'monitor', state: 'UNVERIFIED', confidenceP: 0.95, detectedAt: now - 600, circumstances: { laneBlocked: 'NONE', v85Kmh: 80, sightM: 400, durationMin: 2, flowVehH: 200, peopleOutside: false, waitingTow: false, queueForming: false, respondersExposed: false, heavyShare: 0 } },
    { id: 'trapped-unverified', state: 'UNVERIFIED', confidenceP: 0.3, detectedAt: now - 60, circumstances: { trapped: true } },
    { id: 'secondary', state: 'SECONDARY_COLLISION_SUSPECTED', confidenceP: 0.9, detectedAt: now - 300, circumstances: { laneBlocked: 'SHOULDER' } },
    { id: 'lane-night', state: 'CORROBORATED', confidenceP: 0.97, detectedAt: now - 3000, assistance: { requestedAt: now - 3000 }, circumstances: { laneBlocked: 'FULL', night: true, v85Kmh: 110, sightM: 120, durationMin: 50, flowVehH: 1500, peopleOutside: true, waitingTow: true, queueForming: true, respondersExposed: false, heavyShare: 0.2 } },
  ];
  const p = prioritizeIncidents(items, { now });
  assert.deepEqual(p.order.map((o) => o.id), ['trapped-unverified', 'secondary', 'lane-night', 'monitor']);
  assert.ok(p.order[0].flags.includes('VERIFICAR'));
  assert.ok(p.order.find((o) => o.id === 'lane-night').flags.includes('SLA_SUPERADO'));
  const o = prioritizeIncidents(items, { now, overrides: [{ id: 'monitor', toTop: true, by: 'op-1', reason: 'llamada directa de la Guardia Civil', at: now }, { id: 'secondary', toTop: true }] });
  assert.equal(o.order[0].id, 'monitor'); assert.ok(o.order[0].flags.includes('REORDENADO_MANUALMENTE'));
  assert.equal(o.audit[1].applied, false, 'sin autor ni motivo no se aplica');
  assert.match(p.disclaimer, /no sustituye/);
});

test('zona: cola por onda de choque, áreas ordenadas aguas arriba, banda de aviso, paneles propuestos, CIFS válido', () => {
  assert.equal(queueProjection({ flowVehH: 2500, lanes: 2, lanesOpen: 1, freeKmh: 100 }).forms, null, 'sin parámetros declarados no se calcula');
  assert.equal(queueProjection({ flowVehH: 1000, lanes: 2, lanesOpen: 1, freeKmh: 100, params: QP }).forms, false);
  const q = queueProjection({ flowVehH: 2500, lanes: 2, lanesOpen: 1, freeKmh: 100, params: QP });
  assert.equal(q.forms, true); assert.ok(q.shockKmh < 0, 'la cola crece aguas arriba'); assert.ok(q.points[1].queueM > q.points[0].queueM);
  const { road } = demoRoad();
  const plan = planIncidentZone(road, { s: 12000, dir: 1, laneBlocked: 'PARTIAL', lanes: 2 }, { speedLimitKmh: 100, v85Kmh: 105, flowVehH: 2500, wet: true, night: true, minutesElapsed: 20, queueParams: QP }, { vms: [{ id: 'PMV-1', s: 8000, dir: 1 }, { id: 'PMV-otro-sentido', s: 8500, dir: -1 }, { id: 'PMV-pasado', s: 13000, dir: 1 }] });
  const ids = plan.areas.map((a) => a.id); assert.deepEqual(ids, ['ADVANCE_WARNING', 'TRANSITION', 'BUFFER', 'INCIDENT_SPACE', 'TERMINATION']);
  for (let i = 1; i < plan.areas.length; i++) assert.ok(plan.areas[i].from >= plan.areas[i - 1].from, 'áreas en sentido de circulación');
  assert.ok(plan.areas[0].lengthM >= plan.queue.nowM + plan.physics.dStopM, 'el aviso cubre la cola actual');
  assert.ok(plan.warnBand.fromUpM < plan.warnBand.toUpM);
  assert.deepEqual(plan.panels.map((p) => p.id), ['PMV-1']); assert.equal(plan.panels[0].status, 'PROPOSED_FOR_OPERATOR_APPROVAL');
  assert.ok(plan.panels[0].proposedText.every((l) => l.length <= 20));
  const poly = zoneCifsPolyline(plan); assert.ok(poly.length >= 2);
  const cifs = { id: 'senda-zone-1', type: 'HAZARD', subtype: 'HAZARD_ON_ROAD_CAR_STOPPED', polyline: poly.map((p) => `${p.lat.toFixed(6)} ${p.lon.toFixed(6)}`).join(' '), street: road.id, direction: 'ONE_DIRECTION' };
  assert.equal(validateCifs(cifs).valid, true);
  const back = planIncidentZone(road, { s: 12000, dir: -1, laneBlocked: 'SHOULDER' }, { speedLimitKmh: 90 });
  assert.ok(back.areas[0].from > back.areas.at(-1).from, 'en sentido decreciente el aviso queda a s mayores');
  assert.equal(back.areas.some((a) => a.id === 'TRANSITION'), false, 'sin ocupar carril no hay estrechamiento');
  assert.match(vmsText({ distKm: 0.6, laneBlocked: 'FULL', queue: true })[0], /^CARRIL CERRADO 600 M$/);
});

test('circunstancias: ranking reproducible; distancia 2 s es la más segura; mojado+distancia corta la peor', () => {
  const g = circumstanceGrid({ scenario: SC_EX, n: 600, seed: 4 });
  assert.deepEqual(g, circumstanceGrid({ scenario: SC_EX, n: 600, seed: 4 }));
  assert.equal(g.rows.at(-1).key, 'SAFE_GAP'); assert.ok(['WET_CLOSE', 'NIGHT_FOG_HEAVY', 'WET_NIGHT'].includes(g.rows[0].key));
  assert.ok(g.rows.every((r) => r.pD <= r.pA), 'el aviso no empeora ninguna circunstancia (política activa)');
  assert.ok(Object.keys(CIRCUMSTANCES).length >= 10);
});

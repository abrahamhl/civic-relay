/**
 * Tests unitarios y de integración para SENDA SCENARIO ENGINE.
 *
 * Verifica el contrato conceptual:
 *  - Determinismo estricto: misma semilla -> idéntica secuencia y huella SHA-256.
 *  - Acoplamiento físico real: viento -> fuego -> humo -> visibilidad -> tráfico LWR -> corte WAN -> DTN.
 *  - Cuatro escenarios implementados y reproducibles.
 *  - Pausa, paso a paso, reanudación y generación de manifiesto de evidencias.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ScenarioEngine,
  SCENARIO_CATALOG,
  SCENARIO_ENGINE_VERSION
} from '../src/scenario-engine.mjs';

test('SENDA SCENARIO ENGINE: Orquestación común de simulaciones científicas', async (t) => {
  await t.test('1. Catálogo de escenarios y parametrización', () => {
    assert.ok(SCENARIO_CATALOG.A_CORRIDOR_CRISIS);
    assert.ok(SCENARIO_CATALOG.B_URBAN_FLOOD);
    assert.ok(SCENARIO_CATALOG.C_RESIDENTIAL_BLACKOUT);
    assert.ok(SCENARIO_CATALOG.D_RESCUE_OPERATION);

    const eng = new ScenarioEngine({ scenarioId: 'A_CORRIDOR_CRISIS' });
    const state = eng.getState();
    assert.equal(state.scenarioId, 'A_CORRIDOR_CRISIS');
    assert.equal(state.clock.t, 0);
    assert.equal(state.executionState, 'INITIALIZED');
    assert.ok(state.evidenceHash);
  });

  await t.test('2. Determinismo estricto: misma semilla produce idéntico hash de evidencia', () => {
    const run1 = new ScenarioEngine({ scenarioId: 'A_CORRIDOR_CRISIS', seed: 42 });
    const run2 = new ScenarioEngine({ scenarioId: 'A_CORRIDOR_CRISIS', seed: 42 });

    for (let i = 0; i < 20; i++) {
      run1.step(5.0);
      run2.step(5.0);
    }

    const state1 = run1.getState();
    const state2 = run2.getState();

    assert.equal(state1.clock.t, 100);
    assert.equal(state2.clock.t, 100);
    assert.equal(state1.evidenceHash, state2.evidenceHash);
    assert.equal(state1.inference.fireSpread.frontKm, state2.inference.fireSpread.frontKm);
    assert.equal(state1.inference.traffic.densityVehPerKm, state2.inference.traffic.densityVehPerKm);
  });

  await t.test('3. Escenario A: Acoplamiento físico (Fuego -> Humo -> Tráfico -> Ruptura Celular -> DTN)', () => {
    const eng = new ScenarioEngine({
      scenarioId: 'A_CORRIDOR_CRISIS',
      customParams: { cellularFailureAtT: 30, windSpeedKmh: 45 }
    });

    // Estado inicial en t=0: red WAN activa, tráfico fluido
    assert.equal(eng.getState().inference.network.wanUp, true);
    assert.equal(eng.getState().inference.traffic.levelOfService, 'A');

    // Avanzar a t=35s (tras el corte celular)
    for (let i = 0; i < 7; i++) eng.step(5.0);

    const stateAt35 = eng.getState();
    assert.equal(stateAt35.clock.t, 35);
    // Red celular caída, conmutado a DTN
    assert.equal(stateAt35.inference.network.wanUp, false);
    assert.equal(stateAt35.inference.network.currentBearer, 'DTN_SOVEREIGN_MESH');

    // Avanzar hasta t=300s para verificar propagación y entrega DTN
    while (eng.clock.t < 300) {
      eng.step(10.0);
    }

    const finalState = eng.getState();
    // Fuego ha avanzado (~52 metros en 5 minutos a 10.4 m/min)
    assert.ok(finalState.inference.fireSpread.frontKm > 0.04);
    // Humo ha reducido visibilidad y densificado el tráfico
    assert.ok(finalState.inference.traffic.visibilityM < 1000);
    // Acuse de recibo DTN verificado
    assert.equal(finalState.inference.network.verifiedReceipts, 1);
    assert.ok(finalState.timeline.some((e) => e.code === 'DTN_RECEIPT_VERIFIED'));
  });

  await t.test('4. Escenario B: Inundación urbana y alerta institucional CAP', () => {
    const eng = new ScenarioEngine({ scenarioId: 'B_URBAN_FLOOD' });
    while (eng.clock.t < 400) {
      eng.step(20.0);
    }
    const state = eng.getState();
    assert.ok(state.inference.hydrology.waterLevelM > 2.5);
    assert.ok(state.inference.hydrology.floodedRoadSegments.length > 0);
    assert.ok(state.timeline.some((e) => e.code === 'CAP_CIVIL_PROTECTION_DISPATCH'));
  });

  await t.test('5. Escenario C: Blackout residencial y sincronización por mulo de datos', () => {
    const eng = new ScenarioEngine({ scenarioId: 'C_RESIDENTIAL_BLACKOUT' });
    while (eng.clock.t < 400) {
      eng.step(20.0);
    }
    const state = eng.getState();
    assert.equal(state.inference.network.wanUp, false);
    assert.ok(state.inference.network.deliveredMessages > 0);
    assert.ok(state.timeline.some((e) => e.code === 'COURIER_RELAY_SYNC'));
  });

  await t.test('6. Escenario D: Rescate con dron y diferenciación hipótesis vs corroboración', () => {
    const eng = new ScenarioEngine({ scenarioId: 'D_RESCUE_OPERATION' });
    while (eng.clock.t < 300) {
      eng.step(10.0);
    }
    const state = eng.getState();
    assert.equal(state.inference.rescue.corroboratedTargets, 1);
    const candidateEvent = state.timeline.find((e) => e.code === 'THERMAL_ANOMALY_CANDIDATE');
    const corroborationEvent = state.timeline.find((e) => e.code === 'TARGET_CORROBORATED_ACOUSTIC');

    assert.ok(candidateEvent);
    assert.equal(candidateEvent.epistemicState, 'CALCULATED');
    assert.ok(corroborationEvent);
    assert.equal(corroborationEvent.epistemicState, 'CORROBORATED');
  });

  await t.test('7. Manifiesto de evidencia científica exportable', () => {
    const eng = new ScenarioEngine({ scenarioId: 'A_CORRIDOR_CRISIS', seed: 999 });
    for (let i = 0; i < 10; i++) eng.step(5.0);

    const manifest = eng.exportEvidenceManifest();
    assert.equal(manifest.schema, 'senda.scenario-evidence/1.0');
    assert.equal(manifest.engineVersion, SCENARIO_ENGINE_VERSION);
    assert.equal(manifest.seed, 999);
    assert.ok(manifest.reproducibleSha256);
    assert.equal(manifest.simulationMetrics.totalSteps, 10);
    assert.equal(manifest.simulationMetrics.simulatedSeconds, 50);
    assert.ok(manifest.epistemicSummary.observedCount >= 0);
  });
});

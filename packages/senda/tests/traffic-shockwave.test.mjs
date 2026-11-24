import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMPLE_LWR_HIGHWAY,
  lwrShockwave,
  movingQueueIntercept,
  oppositeLaneRelayAdvance,
} from '../src/traffic-shockwave.mjs';

test('LWR PDE ondas de choque: Rankine–Hugoniot exacto, sin cola si capacidad basta, cola hacia atrás si hay bloqueo', () => {
  // 2 carriles, 1 bloqueado, demanda 2400 veh/h > capacidad restante 2000 veh/h -> onda hacia atrás
  const sw = lwrShockwave(EXAMPLE_LWR_HIGHWAY);
  assert.equal(sw.queueForming, true);
  assert.ok(sw.shockwaveKmh < -2 && sw.shockwaveKmh > -25, `shockwaveKmh=${sw.shockwaveKmh}`);
  assert.ok(sw.queueGrowthMPerS > 0);

  // Demanda baja (800 veh/h/carril → 1600 < 2000 capacidad 1 carril) -> no forma cola creciente
  const noQ = lwrShockwave({ ...EXAMPLE_LWR_HIGHWAY, demandVehPerHrLane: 800 });
  assert.equal(noQ.queueForming, false);
  assert.equal(noQ.shockwaveKmh, 0);

  // Rechaza parámetros ausentes (CLAUDE.md §1)
  assert.throws(() => lwrShockwave({ freeFlowKmh: 100 }), /debe declararse/);
});

test('LWR interceptación de cola móvil + ganancia de tiempo por relé BLE en calzada contraria', () => {
  // Incidente bloqueando ambos carriles (ej. puente levadizo o accidente total) a 2000 m, hace 120 s
  const fullBlock = { ...EXAMPLE_LWR_HIGHWAY, blockedLanes: 2 };
  const inter = movingQueueIntercept({ distToIncidentM: 2000, egoSpeedKmh: 100, incidentAgeS: 120, lwrParams: fullBlock });
  assert.ok(inter.currentQueueLengthM > 300, `cola esperada >300 m tras 2 min, obtenida ${inter.currentQueueLengthM}`);
  assert.ok(inter.interceptDistM < inter.distToTailNowM, 'el final móvil se acerca mientras avanzamos');

  // Relé BLE en sentido contrario a 100 km/h (intervalo medio 20 s entre coches SENDA) avisa MUCHO antes de llegar a la cola
  const relay = oppositeLaneRelayAdvance({ distToIncidentM: 2000, egoSpeedKmh: 100, oppSpeedKmh: 100, oppHeadwayS: 20, lwrParams: fullBlock });
  assert.equal(relay.deliveredBeforeTail, true);
  assert.ok(relay.warningLeadTimeS > 15, `antelación esperada >15 s, obtenida ${relay.warningLeadTimeS} s`);
});

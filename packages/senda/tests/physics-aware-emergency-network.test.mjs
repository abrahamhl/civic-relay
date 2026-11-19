import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIORITY_LEVELS,
  PROTOCOLS,
  distance2D,
  distToSegment,
  distanceToHazardFront,
  computeLinkMarginDb,
  PriorityEmergencyBuffer,
  computePaerUtility,
  DisasterDtnSimulator,
} from '../src/physics-aware-emergency-network.mjs';

test('Física RF: Presupuesto y margen de enlace discriminan enlaces viables frente a desvanecimiento', () => {
  // Enlace directo en campo cercano (200m LoRa 868 MHz)
  const near = computeLinkMarginDb({ distanceM: 200, carrierFreqHz: 868e6, txPowerDbm: 14.0 });
  assert.ok(near.isViable, 'Enlace a 200m sin obstáculos debe ser viable');
  assert.ok(near.marginDb > 20, `Margen confortable: ${near.marginDb} dB`);

  // Enlace NLOS de 8 km a través de montaña (35 dB difracción) y lluvia fuerte (10 dB)
  const obstructed = computeLinkMarginDb({
    distanceM: 8000,
    carrierFreqHz: 868e6,
    txPowerDbm: 14.0,
    diffractionLossDb: 35.0,
    rainAttenuationDb: 10.0,
  });
  assert.equal(obstructed.isViable, false, 'Enlace de 8 km con 45 dB de pérdidas adicionales debe ser inviable');
  assert.ok(obstructed.marginDb < 3.0, `Margen insuficiente: ${obstructed.marginDb} dB`);
});

test('Gestión de memoria de emergencia: El buffer expulsará telemetría antes de perder un SOS', () => {
  const buf = new PriorityEmergencyBuffer(3);

  // Llenar buffer con telemetría rutinaria
  buf.enqueue({ id: 'tel1', priority: PRIORITY_LEVELS.ROUTINE_TELEMETRY, ttlRemainingS: 300 });
  buf.enqueue({ id: 'tel2', priority: PRIORITY_LEVELS.ROUTINE_TELEMETRY, ttlRemainingS: 200 });
  buf.enqueue({ id: 'tel3', priority: PRIORITY_LEVELS.ROUTINE_TELEMETRY, ttlRemainingS: 500 });
  assert.equal(buf.bundles.length, 3);

  // Llega un paquete crítico de auxilio (DISTRESS_SOS)
  const accepted = buf.enqueue({ id: 'sos-01', priority: PRIORITY_LEVELS.DISTRESS_SOS, ttlRemainingS: 1800 });
  assert.ok(accepted, 'El SOS debe ser aceptado expulsando telemetría');
  assert.ok(buf.has('sos-01'), 'El SOS debe residir en el buffer');
  // Debe haber expulsado el de menor TTL ('tel2' con 200s)
  assert.equal(buf.has('tel2'), false, 'La telemetría tel2 debió ser desalojada');
  assert.equal(buf.droppedCount, 1);

  // Si intentamos meter otra telemetría rutinaria con buffer lleno de SOS y coordinación, se descarta
  const bufSos = new PriorityEmergencyBuffer(2);
  bufSos.enqueue({ id: 'sos-a', priority: PRIORITY_LEVELS.DISTRESS_SOS, ttlRemainingS: 1000 });
  bufSos.enqueue({ id: 'sos-b', priority: PRIORITY_LEVELS.DISTRESS_SOS, ttlRemainingS: 1000 });
  const rejected = bufSos.enqueue({ id: 'tel-fail', priority: PRIORITY_LEVELS.ROUTINE_TELEMETRY, ttlRemainingS: 100 });
  assert.equal(rejected, false, 'Telemetría no puede expulsar un SOS');
  assert.equal(bufSos.has('tel-fail'), false);
});

test('Utilidad PAER: Castigo severo a nodos en trayectoria de fuego o con batería crítica', () => {
  const dest = { x: 3000, y: 0 };
  const hazardFront = [
    { x: 500, y: -1000 },
    { x: 500, y: 1000 },
  ]; // Línea de fuego avanzando hacia el Este (X positivo) a 0.5 m/s

  const bundle = { ttlRemainingS: 600 };

  // Nodo A: Cerca del fuego (X=520, a 20m del frente), con 90% batería
  const nodeA = { x: 520, y: 0, batteryPct: 90, buffer: new PriorityEmergencyBuffer(20) };
  const utilA = computePaerUtility({ relayNode: nodeA, destNode: dest, bundle, hazardPolygon: hazardFront, hazardRosMs: 0.5 });
  assert.equal(utilA, 0, 'Nodo a 20m de frente de fuego activo debe tener utilidad 0');

  // Nodo B: Seguro (X=1800, a 1300m del frente), con 85% batería
  const nodeB = { x: 1800, y: 0, batteryPct: 85, buffer: new PriorityEmergencyBuffer(20) };
  const utilB = computePaerUtility({ relayNode: nodeB, destNode: dest, bundle, hazardPolygon: hazardFront, hazardRosMs: 0.5 });
  assert.ok(utilB > 0.5, `Nodo seguro debe tener alta utilidad: ${utilB}`);

  // Nodo C: Misma posición segura que B pero batería crítica (12%)
  const nodeC = { x: 1800, y: 0, batteryPct: 12, buffer: new PriorityEmergencyBuffer(20) };
  const utilC = computePaerUtility({ relayNode: nodeC, destNode: dest, bundle, hazardPolygon: hazardFront, hazardRosMs: 0.5 });
  assert.ok(utilC < utilB, 'Nodo con batería crítica debe tener utilidad menor que con batería sana');
});

test('BENCHMARK ADVERSARIAL RIGUROSO: PAER vs Epidemic vs Spray-and-Wait vs PRoPHET', () => {
  // Topología de desastre: 10 nodos en valle de montaña con incendio forestal avanzando
  const makeNodes = () => [
    { id: 'SRC', x: 100, y: 100, bufferCapacity: 15, batteryPct: 95 },
    { id: 'R_SOUTH_1', x: 600, y: -200, bufferCapacity: 15, batteryPct: 90 }, // En zona de riesgo de fuego
    { id: 'R_SOUTH_2', x: 1200, y: -250, bufferCapacity: 15, batteryPct: 88 }, // En zona de riesgo de fuego
    { id: 'R_NORTH_1', x: 700, y: 350, bufferCapacity: 15, batteryPct: 92 },  // Ruta segura por cresta norte
    { id: 'R_NORTH_2', x: 1400, y: 400, bufferCapacity: 15, batteryPct: 90 }, // Ruta segura por cresta norte
    { id: 'R_NORTH_3', x: 2100, y: 350, bufferCapacity: 15, batteryPct: 85 }, // Ruta segura por cresta norte
    { id: 'R_MID_1', x: 1500, y: 50, bufferCapacity: 15, batteryPct: 89 },
    { id: 'R_MID_2', x: 2200, y: 0, bufferCapacity: 15, batteryPct: 87 },
    { id: 'DST', x: 2800, y: 150, bufferCapacity: 15, batteryPct: 100 },
  ];

  // Frente de fuego en el flanco sur (y <= -100) que avanza hacia el este (ROS = 2.0 m/s = 7.2 km/h)
  const initialHazard = [
    { x: 300, y: -700 },
    { x: 400, y: -100 },
  ];
  const hazardVelocity = { vx: 2.0, vy: 0.0 }; // Avance hacia el este a 2.0 m/s

  // Contactos intermitentes a lo largo del tiempo
  const contactSchedule = [
    // T = 10s: Contactos iniciales
    { t: 10, contacts: [{ from: 'SRC', to: 'R_SOUTH_1' }, { from: 'SRC', to: 'R_NORTH_1' }] },
    // T = 35s: Propagación intermedia
    { t: 35, contacts: [{ from: 'R_SOUTH_1', to: 'R_SOUTH_2' }, { from: 'R_NORTH_1', to: 'R_NORTH_2' }] },
    // T = 75s: El fuego alcanza y destruye la ruta sur (x=600)
    { t: 75, contacts: [{ from: 'R_NORTH_2', to: 'R_NORTH_3' }, { from: 'R_NORTH_2', to: 'R_MID_1' }] },
    // T = 110s: Conexión segura por cresta norte con destino
    { t: 110, contacts: [{ from: 'R_NORTH_3', to: 'DST' }, { from: 'R_MID_2', to: 'DST' }] },
    // T = 130s: Última ventana
    { t: 130, contacts: [{ from: 'R_NORTH_3', to: 'DST' }] },
  ];

  const protocolsToTest = [
    PROTOCOLS.EPIDEMIC,
    PROTOCOLS.SPRAY_AND_WAIT,
    PROTOCOLS.PROPHET,
    PROTOCOLS.PAER,
  ];

  const results = {};

  for (const proto of protocolsToTest) {
    const sim = new DisasterDtnSimulator({
      nodes: makeNodes(),
      hazardPolygon: initialHazard,
      hazardVelocity,
      protocol: proto,
      sprayCopies: 4,
    });

    // Inyectar 6 mensajes de emergencia (SOS y Alertas)
    for (let i = 1; i <= 6; i++) {
      sim.sendBundle('SRC', 'DST', {
        id: `sos-${i}`,
        priority: PRIORITY_LEVELS.DISTRESS_SOS,
        sizeBytes: 256,
        ttlS: 120,
      });
    }

    // Ejecutar pasos de la simulación
    let currentT = 0;
    for (const step of contactSchedule) {
      const dt = step.t - currentT;
      sim.stepContacts(step.contacts, dt);
      currentT = step.t;
    }

    results[proto] = sim.getMetrics();
  }


  // Comprobaciones analíticas y empíricas
  const paer = results[PROTOCOLS.PAER];
  const epidemic = results[PROTOCOLS.EPIDEMIC];
  const spray = results[PROTOCOLS.SPRAY_AND_WAIT];
  const prophet = results[PROTOCOLS.PROPHET];

  // 1. PAER entrega con alta tasa
  assert.ok(paer.deliveredBundles > 0, 'PAER debe entregar paquetes de auxilio');
  assert.ok(paer.deliveryRatio >= 0.8, `PAER PDR debe ser >= 80%: ${paer.deliveryRatio}`);

  // 2. PAER tiene significativamente menor sobrecarga (overhead ratio) que Epidemic
  assert.ok(paer.overheadRatio < epidemic.overheadRatio, `Sobrecarga PAER (${paer.overheadRatio}) debe ser menor que Epidemic (${epidemic.overheadRatio})`);

  // 3. Epidemic sufre pérdidas en nodos arrasados por el frente de fuego (hazard engulfed bundles)
  assert.ok(epidemic.hazardEngulfedBundles > 0, 'Epidemic debió perder paquetes en los nodos calcinados');
  assert.equal(paer.hazardEngulfedBundles, 0, 'PAER no debió enviar paquetes a nodos condenados por el frente');

  // 4. PAER preserva mejor la batería media de la malla frente a la tormenta de retransmisión de Epidemic
  assert.ok(paer.meanBatteryRemainingPct >= epidemic.meanBatteryRemainingPct, 'PAER debe preservar mejor la energía de la red');
});

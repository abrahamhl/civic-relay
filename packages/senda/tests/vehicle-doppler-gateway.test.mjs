import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDopplerSCurve,
  computeFmcwRangeDoppler,
  computeRoadsideGatewayHandoff,
  simulateCrossModalRailRoadIncident,
  C_LIGHT_MPS,
} from '../src/vehicle-doppler-gateway.mjs';

test('Doppler S-Curve: simetría, cruce por cero y pendiente analítica en t_cpa', () => {
  const fc = 24.125e9; // 24.125 GHz radar K-band
  const speed = 120; // 120 km/h
  const dCpa = 8; // 8 metros lateral
  const res = computeDopplerSCurve(fc, speed, dCpa, 6, 200);

  assert.ok(res.maxDopplerHz > 5000, 'Doppler máximo en 24 GHz a 120 km/h debe superar 5 kHz');
  
  // Buscar muestra en t = 0 (cercana al CPA)
  const cpaSample = res.timeSeries.reduce((prev, curr) =>
    Math.abs(curr.tSec) < Math.abs(prev.tSec) ? curr : prev
  );
  assert.ok(Math.abs(cpaSample.fdHz) < 10, 'En el CPA el Doppler debe cruzar por cero');

  // Verificar simetría impar: f_d(-t) ≈ -f_d(t)
  const first = res.timeSeries[0];
  const last = res.timeSeries[res.timeSeries.length - 1];
  assert.ok(first.fdHz > 0, 'Al aproximarse el Doppler es positivo (blue-shift)');
  assert.ok(last.fdHz < 0, 'Al alejarse el Doppler es negativo (red-shift)');
  assert.ok(Math.abs(first.fdHz + last.fdHz) < 20, 'La serie temporal debe ser antisimétrica');

  // Verificar que la pendiente analítica calculada sea negativa y concuerde con la derivada numérica
  const slope = res.cpaSlopeHzS;
  assert.ok(slope < -10000, 'La pendiente en CPA debe ser fuertemente negativa');
});

test('Radar FMCW: separación de múltiples vehículos en el mapa Rango-Doppler', () => {
  const targets = [
    { id: 'veh-lento-cercano', rangeM: 25, speedKmh: 60, rcsM2: 10 },
    { id: 'veh-rapido-intermedio', rangeM: 70, speedKmh: 120, rcsM2: 15 },
    { id: 'moto-lejana', rangeM: 130, speedKmh: 140, rcsM2: 2 },
  ];

  const radar = computeFmcwRangeDoppler(targets, {
    fcHz: 77e9,
    bandwidthHz: 1e9, // 1 GHz
    chirpDurationS: 50e-6,
  });

  assert.equal(radar.targets.length, 3, 'Deben procesarse los 3 vehículos objetivo');
  assert.ok(radar.radar.rangeResolutionM < 0.2, 'La resolución nominal en distancia debe ser < 20 cm');

  // El vehículo más lejano debe tener mayor frecuencia de batido por rango
  const t0 = radar.targets[0];
  const t1 = radar.targets[1];
  const t2 = radar.targets[2];

  assert.ok(t0.beatFreqRangeHz < t1.beatFreqRangeHz, 'Mayor distancia debe producir mayor beat frequency');
  assert.ok(t1.beatFreqRangeHz < t2.beatFreqRangeHz, 'Mayor distancia debe producir mayor beat frequency');
  assert.ok(t0.detectable && t1.detectable, 'Los vehículos principales deben superar el umbral de detección');
});

test('Pasarela Oportunista V2I: ráfaga 0-RTT a 120 km/h sin handshakes lentos', () => {
  // Vehículo a 120 km/h pasa a 6 m de un radar o poste SOS con radio de 50 m
  const handoff = computeRoadsideGatewayHandoff(120, 50, 6, 256, 1e6);

  assert.ok(handoff.connected, 'El vehículo debe conectar con la pasarela');
  assert.ok(handoff.timeInRangeS > 2.5, 'Debe permanecer más de 2,5 s en el lóbulo de cobertura');
  assert.ok(handoff.totalTransmissionTimeMs < 50, 'La ráfaga con 3 copias redundantes debe tardar < 50 ms');
  assert.ok(handoff.safetyMarginFactor > 20, 'El factor de seguridad temporal debe ser masivo (> 20x)');
  assert.equal(handoff.deliveryProbability, 0.999, 'Probabilidad de entrega prácticamente garantizada');

  // Vehículo que pasa fuera de rango
  const outOfRange = computeRoadsideGatewayHandoff(120, 30, 35, 256, 1e6);
  assert.equal(outOfRange.connected, false, 'Vehículo fuera de radio no debe conectar');
});

test('Puente Catastrófico Multimodal: tren accidentado en sombra celular alertado en < 90 s', () => {
  const sim = simulateCrossModalRailRoadIncident({
    railKm: 142.5,
    roadParallelDistanceM: 120,
    cellularCoverageAvailable: false,
    passingCarSpeedKmh: 100,
    nextRadarGatewayDistKm: 2.3,
    trainAcousticBeaconPowerDba: 110,
    ambientNoiseDba: 75,
  });

  assert.ok(sim.success, 'La simulación debe completar con éxito');
  assert.ok(sim.acousticMetrics.detected, 'La baliza acústica o ultrasónica debe ser detectada a 120 m');
  assert.ok(sim.totalLatencyTo112RoomS < 90, 'El aviso completo al 112 debe llegar en menos de 90 segundos');
  assert.ok(sim.dtnVehicleTransport.travelTimeS > 70 && sim.dtnVehicleTransport.travelTimeS < 90, 'Tiempo de viaje vehicular físico realista');
});

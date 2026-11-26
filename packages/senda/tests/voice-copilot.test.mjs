import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUtterance, plateCandidates, createParkedCalibrator, summarizeSession } from '../src/voice-copilot.mjs';

test('órdenes habladas de calibración', () => {
  assert.equal(parseUtterance('Estoy parado').cmd, 'PARKED');
  assert.equal(parseUtterance('aparcado en la puerta').cmd, 'PARKED');
  assert.equal(parseUtterance('en marcha').cmd, 'MOVING');
  assert.deepEqual([parseUtterance('voy a 50').cmd, parseUtterance('voy a 50').kmh], ['SPEED', 50]);
  assert.equal(parseUtterance('el coche marca ochenta').kmh, 80);
  assert.equal(parseUtterance('voy a cien y veinte').kmh, 120);
  assert.equal(parseUtterance('marca').cmd, 'MARK');
  assert.equal(parseUtterance('falsa alarma, era una sombra').cmd, 'FALSE_ALERT');
  assert.equal(parseUtterance('').cmd, 'EMPTY');
});

test('notas: matrículas candidatas y etiquetas', () => {
  const n = parseUtterance('El 4521 BCD va a cambiar de carril sin intermitente, de noche y sin luces');
  assert.equal(n.cmd, 'NOTE'); assert.deepEqual(n.plates, ['4521 BCD']);
  for (const t of ['MATRICULA', 'INTENCION', 'NOCHE_VISIBILIDAD']) assert.ok(n.tags.includes(t), t);
  assert.deepEqual(plateCandidates('matrícula 1234 ABC'), []); // con vocal no es una matrícula española actual
  assert.ok(parseUtterance('un ciclista por el arcén').tags.includes('VULNERABLE'));
});

test('ruido de velocidad en parado: se aprende y luego marca 0; sin calibrar no filtra', () => {
  assert.throws(() => createParkedCalibrator({}), /sin valor por defecto/);
  const c = createParkedCalibrator({ minSamples: 10 });
  assert.equal(c.gate(0.6), 0.6); // sin calibrar
  for (const v of [0.1, 0.3, 0.2, 0.5, 0.7, 0.4, 0.2, 0.9, 0.3, 0.6]) c.add(v);
  assert.equal(c.threshold(), 0.9); assert.equal(c.gate(0.8), 0); assert.equal(c.gate(1.5), 1.5);
  const s = summarizeSession([{ cmd: 'SPEED', kmh: 50, gpsKmh: 47.5 }, { cmd: 'NOTE', tags: ['MATRICULA'], plates: ['4521 BCD'] }]);
  assert.deepEqual(s.speedPairs, [{ declared: 50, gps: 47.5, diff: 2.5 }]); assert.equal(s.containsPersonalData, true);
});

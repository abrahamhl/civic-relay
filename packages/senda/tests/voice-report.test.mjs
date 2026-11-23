import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretReport, interpretAlternatives, RULES } from '../src/voice-report.mjs';
import { REPORT_KINDS } from '../src/road-guard.mjs';

test('cada regla apunta a un tipo de aviso que existe', () => {
  for (const r of RULES) assert.ok(REPORT_KINDS[r.kind], r.kind);
});

const CASES = [
  ['Hay un coche parado en el carril derecho', 'parado'],
  ['coche averiado en el arcén', 'arcen'],
  ['Un camión parado en la cuneta', 'arcen'],
  ['accidente en el otro sentido', 'accidente'],
  ['han chocado dos coches', 'accidente'],
  ['hay un jabalí en la carretera', 'animal'],
  ['se ha caído una caja de un camión', 'obstaculo'],
  ['mancha de aceite en la rotonda', 'obstaculo'],
  ['mucha niebla, no se ve nada', 'niebla'],
  ['placa de hielo en el puente', 'hielo'],
  ['obras, cortado un carril', 'obras'],
  ['atasco enorme', 'retencion'],
  ['veo una V16 encendida', 'parado'],
];
test('frases habituales al volante → tipo de aviso', () => {
  for (const [frase, kind] of CASES) assert.equal(interpretReport(frase).kind, kind, frase);
});

test('acentos y mayúsculas no importan; se detecta el sentido', () => {
  const r = interpretReport('ACCIDENTE EN SENTIDO CONTRARIO');
  assert.equal(r.kind, 'accidente');
  assert.equal(r.side, 'CONTRARIO');
  assert.equal(interpretReport('accidente').side, 'SIN_INDICAR');
});

test('si no se entiende, no se inventa un tipo; siempre pide confirmación', () => {
  const r = interpretReport('pon música');
  assert.equal(r.kind, null);
  assert.equal(r.reason, 'NO_ENTENDIDO');
  assert.equal(interpretReport('').reason, 'VACIO');
  assert.ok(interpretReport('accidente').needsConfirmation);
});

test('elige la primera alternativa del reconocedor que se entiende', () => {
  const r = interpretAlternatives(['ha ya un co che', 'hay un coche parado']);
  assert.equal(r.kind, 'parado');
  assert.equal(r.from, 'hay un coche parado');
});

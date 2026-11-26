/**
 * SENDA · F3 Pruebas de contratos JSON Schema (Ajv).
 * Verifica:
 *  1) Los datasets reales del repo (DANA telemetria.json, Adamuz cronologia.json) pasan validación.
 *  2) Salidas reales de createCitizenReport, series de data-connectors y grabaciones mmWave pasan validación.
 *  3) Criterio de aceptación F3: cualquier dato SIN fuente o con HORA AMBIGUA (sin Z / ±HH:MM)
 *     es RECHAZADO de forma explícita en todos los esquemas aplicables.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateContract, CONTRACT_SCHEMAS } from '../schemas/validate.mjs';
import { createCitizenKeyPair, createCitizenReport } from '../src/citizen-report.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('F3 Ajv: los 5 esquemas contractuales están registrados', () => {
  assert.deepEqual([...CONTRACT_SCHEMAS].sort(), [
    'chronology',
    'citizenReport',
    'connectorSeries',
    'mmwaveExport',
    'telemetry',
  ]);
});

test('F3 Ajv [telemetry]: acepta telemetria.json real de DANA y rechaza dato sin fuente o con hora ambigua', () => {
  const realDana = JSON.parse(readFileSync(resolve(ROOT, 'investor-next/public/senda/data/dana2024/telemetria.json'), 'utf8'));
  const okRes = validateContract('telemetry', realDana);
  assert.equal(okRes.ok, true, `telemetria.json real debe ser válida: ${JSON.stringify(okRes.errors)}`);

  // 1) Sin fuente en un evento → rechazado
  const noSource = structuredClone(realDana);
  delete noSource.eventos[0].fuente;
  const rNoSource = validateContract('telemetry', noSource);
  assert.equal(rNoSource.ok, false, 'debe rechazar evento sin fuente');

  // 2) Fuente no declarada en el diccionario `fuentes` → rechazado
  const unknownSource = structuredClone(realDana);
  unknownSource.eventos[0].fuente = 'fuente_inventada';
  const rUnknown = validateContract('telemetry', unknownSource);
  assert.equal(rUnknown.ok, false, 'debe rechazar fuente inexistente');

  // 3) Hora ambigua (sin Z ni ±HH:MM) en compiladoUTC o utc → rechazado
  const ambigComp = structuredClone(realDana);
  ambigComp.compiladoUTC = '2026-11-25T16:28:29'; // falta Z / offset
  assert.equal(validateContract('telemetry', ambigComp).ok, false, 'debe rechazar compiladoUTC sin zona horaria');

  const ambigEv = structuredClone(realDana);
  ambigEv.eventos[6].utc = '2024-10-29T14:30:00'; // falta Z / offset
  assert.equal(validateContract('telemetry', ambigEv).ok, false, 'debe rechazar evento.utc ambiguo sin zona horaria');
});

test('F3 Ajv [connectorSeries]: acepta serie válida con TZ y rechaza sin fuente o con hora ambigua', () => {
  const valid = {
    kind: 'caudal',
    station: 'SAIH-POYO-A3',
    basis: 'MEASURED',
    source: { name: 'Confederación Hidrográfica del Júcar', license: 'oficial' },
    serie: [
      { hora: '2024-10-29T18:00:00+01:00', valor: 1200 },
      { hora: '2024-10-29T18:55:00+01:00', valor: 2282 },
    ],
  };
  assert.equal(validateContract('connectorSeries', valid).ok, true);

  // Sin fuente → rechazado
  const noSource = structuredClone(valid);
  delete noSource.source;
  assert.equal(validateContract('connectorSeries', noSource).ok, false, 'debe rechazar serie sin fuente');

  // Hora ambigua sin zona horaria → rechazado
  const ambigTime = structuredClone(valid);
  ambigTime.serie[0].hora = '2024-10-29T18:00:00';
  assert.equal(validateContract('connectorSeries', ambigTime).ok, false, 'debe rechazar hora sin zona horaria');
});

test('F3 Ajv [chronology]: acepta cronologia.json real de Adamuz y rechaza sin zonaHoraria o sin fuente', () => {
  const realAdamuz = JSON.parse(readFileSync(resolve(ROOT, 'investor-next/public/senda/data/adamuz2026/cronologia.json'), 'utf8'));
  const okRes = validateContract('chronology', realAdamuz);
  assert.equal(okRes.ok, true, `cronologia.json real debe ser válida: ${JSON.stringify(okRes.errors)}`);

  const noTz = structuredClone(realAdamuz);
  delete noTz.zonaHoraria;
  assert.equal(validateContract('chronology', noTz).ok, false, 'debe rechazar cronología sin zonaHoraria');

  const noSrc = structuredClone(realAdamuz);
  delete noSrc.eventos[0].fuente;
  assert.equal(validateContract('chronology', noSrc).ok, false, 'debe rechazar evento sin fuente');
});

test('F3 Ajv [citizenReport]: acepta sobre real Ed25519 y rechaza hora ambigua o intento canPublicWarn=true', async () => {
  const kp = await createCitizenKeyPair();
  const report = await createCitizenReport({
    operationalStatus: 'EXERCISE',
    kind: 'inundacion',
    modalities: ['texto', 'ubicacion'],
    capturedAtIso: '2026-11-25T18:55:00+01:00',
    location: { lat: 39.428, lon: -0.418, accuracyM: 12 },
    text: 'Ejercicio de verificación de esquema contractual',
    consent: {
      accepted: true,
      consentVersion: 'senda-citizen-v1',
      acceptedAtIso: '2026-11-25T18:55:00+01:00',
      allowVerificationByPassersby: true,
      redactBeforeShare: true,
    },
    channelOrigin: 'web',
  }, kp);

  const okRes = validateContract('citizenReport', report);
  assert.equal(okRes.ok, true, `reporte real debe ser válido: ${JSON.stringify(okRes.errors)}`);

  // Hora ambigua (sin offset) → rechazado
  const badTz = structuredClone(report);
  badTz.payload.capturedAtIso = '2026-11-25T18:55:00';
  assert.equal(validateContract('citizenReport', badTz).ok, false, 'debe rechazar capturedAtIso ambiguo');

  // Intento de aviso público automático (línea roja N5) → rechazado a nivel de esquema
  const badN5 = structuredClone(report);
  badN5.canPublicWarn = true;
  assert.equal(validateContract('citizenReport', badN5).ok, false, 'el esquema debe impedir canPublicWarn=true');
});

test('F3 Ajv [mmwaveExport]: acepta grabación válida con procedencia/TZ/SHA-256 y rechaza sin fuente u hora ambigua', () => {
  const validRec = {
    schema: 'senda.mmwave-recording/v1',
    basis: 'SIMULATION',
    source: { device: 'SIMULATED_LD2450', operatorNote: 'Escenario sintético de prueba', protocol: 'RD-03D/LD2450 256000 8N1' },
    recordedAtIso: '2026-11-25T23:30:00Z',
    sensorModel: 'SIMULATED_LD2450',
    sha256: 'a'.repeat(64),
    frames: [{ tMs: 0, b64: 'qv8DAA==' }],
  };
  assert.equal(validateContract('mmwaveExport', validRec).ok, true);

  const noSource = structuredClone(validRec);
  delete noSource.source;
  assert.equal(validateContract('mmwaveExport', noSource).ok, false, 'debe rechazar grabación mmWave sin fuente');

  const ambigTime = structuredClone(validRec);
  ambigTime.recordedAtIso = '2026-11-25T23:30:00';
  assert.equal(validateContract('mmwaveExport', ambigTime).ok, false, 'debe rechazar recordedAtIso sin zona horaria');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFrameParser, cleanTargets, createTracker } from '../src/mmwave-radar.mjs';
import { validateContract } from '../schemas/validate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MM_DIR = resolve(ROOT, 'packages/senda/data/mmwave');

test('F5 · Grabación sintética de referencia sellada con SHA-256 y reproducción completa en createFrameParser + tracker', () => {
  const jsonlPath = resolve(MM_DIR, 'synthetic-crossing-2p.jsonl');
  const metaPath = resolve(MM_DIR, 'synthetic-crossing-2p.meta.json');
  const rawContent = readFileSync(jsonlPath, 'utf8');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));

  // 1. Integridad criptográfica y etiquetado epistémico obligatorio
  const actualSha = createHash('sha256').update(rawContent).digest('hex');
  assert.equal(actualSha, meta.sha256, 'SHA-256 de synthetic-crossing-2p.jsonl debe coincidir con .meta.json');
  assert.equal(meta.basis, 'SIMULATION', 'La grabación de referencia sintética DEBE declarar basis=SIMULATION');

  // 2. Reproducción exacta por createFrameParser -> cleanTargets -> createTracker
  const lines = rawContent.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, meta.frames);

  const tracker = createTracker({ gateMm: 900, qMmS2: 1500, rMm: 120, maxMissS: 1.5 });
  const frames = [];
  const parser = createFrameParser((rawTargets) => frames.push(rawTargets));

  let lastTracks = [];
  for (const row of lines) {
    const before = frames.length;
    const bytes = Uint8Array.from(Buffer.from(row.b64, 'base64'));
    parser.push(bytes);
    assert.equal(frames.length, before + 1, `Trama en tMs=${row.tMs} debe decodificarse intacta`);
    const dets = cleanTargets(frames.at(-1), { minMm: 100, maxMm: 8000, mergeMm: 1000 });
    lastTracks = tracker.step(dets, row.tMs / 1000);
  }

  assert.deepEqual(parser.stats(), { ok: meta.frames, bad: 0 });
  assert.equal(lastTracks.length, 2, 'Dos personas que se cruzan deben mantener 2 pistas activas');

  const trA = lastTracks.find((t) => t.id === 1);
  const trB = lastTracks.find((t) => t.id === 2);
  assert.ok(trA && trB, 'Las identidades #1 y #2 deben conservarse tras el cruce');

  const { trackA, trackB, tolerances } = meta.groundTruth;
  assert.ok(Math.hypot(trA.xMm - trackA.endMm[0], trA.yMm - trackA.endMm[1]) < tolerances.maxFinalPosErrorMm);
  assert.ok(Math.hypot(trB.xMm - trackB.endMm[0], trB.yMm - trackB.endMm[1]) < tolerances.maxFinalPosErrorMm);
  assert.ok(Math.abs(trA.vxMms - trackA.vxMms) < tolerances.maxFinalVelErrorMms);
  assert.ok(Math.abs(trB.vxMms - trackB.vxMms) < tolerances.maxFinalVelErrorMms);

  // 3. Validar grabación sellada contra el contrato Ajv F3 mmwaveExport (incluye procedencia, TZ y SHA-256)
  const contractPayload = {
    schema: 'senda.mmwave-recording/v1',
    basis: meta.basis,
    source: {
      device: 'SENDA deterministic synthetic generator',
      operatorNote: meta.note,
      protocol: 'RD-03D/LD2450 256000 8N1',
    },
    recordedAtIso: '2026-11-26T01:11:37Z',
    sensorModel: 'SIMULATED_LD2450',
    sha256: meta.sha256,
    frames: lines,
  };
  const v = validateContract('mmwaveExport', contractPayload);
  assert.equal(v.ok, true, `Grabación mmWave debe cumplir contrato Ajv F3: ${JSON.stringify(v.errors)}`);
});

test('F5 · Documentación y puente Android USB-OTG declaran ausencia de grabación real (sin precisión inventada)', () => {
  const readme = readFileSync(resolve(MM_DIR, 'README.md'), 'utf8');
  const proto = readFileSync(resolve(MM_DIR, 'PROTOCOLO_MEDIDA.md'), 'utf8');
  const personasJs = readFileSync(resolve(ROOT, 'investor-next/public/senda/personas.mjs'), 'utf8');
  assert.ok(readme.includes('No existe todavía ninguna grabación de hardware real'), 'README debe declarar ausencia de grabación real');
  assert.ok(readme.includes('8a1da7a1765b02cdb9cfa8a70cee8d45a5bb6d4a2662caf11bf630c3dd82a8a3'), 'README debe incluir el SHA-256 de la grabación sintética');
  assert.ok(proto.includes('cinta métrica') || proto.includes('Cinta métrica'), 'Protocolo debe detallar cinta métrica');
  assert.ok(personasJs.includes('window.SendaNative.usbList') && personasJs.includes('window.sendaUsbSerial'), 'personas.mjs debe conectar el puente nativo Android USB-OTG');
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { verifyBomFile } from '../../../../hardware/modules/senda-radar/scripts/verify-bom.mjs';
import { createFrameParser } from '../../src/mmwave-radar.mjs';
import { buildFieldPackage, verifyFieldPackage, summarizeFieldPackage } from '../../src/mmwave-field.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const RADAR_DIR = path.join(REPO_ROOT, 'hardware/modules/senda-radar');

describe('Bloque H1 · Contrato íntegro de SENDA Radar v1 (hardware/modules/senda-radar)', () => {
  it('mantiene la estructura obligatoria {cad,stl,glb,renders,firmware,docs,BOM.csv,README.md}', () => {
    for (const sub of ['cad', 'stl', 'glb', 'renders', 'firmware', 'docs', 'BOM.csv', 'README.md']) {
      assert.ok(fs.existsSync(path.join(RADAR_DIR, sub)), `Falta ${sub} en hardware/modules/senda-radar`);
    }
    assert.ok(fs.existsSync(path.join(RADAR_DIR, 'docs/wiring-schematic.svg')));
    assert.ok(fs.existsSync(path.join(RADAR_DIR, 'docs/senda-radar.kicad_sch')));
    assert.ok(fs.existsSync(path.join(RADAR_DIR, 'docs/GUIA_MONTAJE_Y_FABRICACION.md')));
  });

  it('valida BOM.csv con enlaces HTTPS, fecha 2026-11-26, hojas de datos, licencias y sumas exactas', () => {
    const summary = verifyBomFile(path.join(RADAR_DIR, 'BOM.csv'));
    assert.deepEqual(summary.queryDates, ['2026-11-26']);
    assert.equal(summary.minimalUsbVariant.unitCostEurInclVat, 23.35);
    assert.equal(summary.minimalUsbVariant.unitCostEurExVat, 19.32);
    assert.equal(summary.completeAutonomousVariant.unitCostEurInclVat, 36.87);
    assert.equal(summary.completeAutonomousVariant.unitCostEurExVat, 30.50);
  });

  it('exporta STL binarios íntegros por pieza y un GLB ensamblado < 2 MB con los 11 nodos nombrados', () => {
    const metrics = JSON.parse(fs.readFileSync(path.join(RADAR_DIR, 'cad/cad-metrics.json'), 'utf8'));
    for (const partName of ['front_bezel', 'rear_body', 'belt_clip']) {
      const p = metrics.parts[partName];
      assert.ok(p, `Faltan métricas de ${partName}`);
      const stlBuf = fs.readFileSync(path.join(RADAR_DIR, p.file));
      const nTri = stlBuf.readUInt32LE(80);
      assert.equal(stlBuf.length, 84 + nTri * 50, `STL binario mal formado: ${p.file}`);
      assert.ok(nTri >= 100, `Malla demasiado pequeña en ${p.file}`);
      const sha = crypto.createHash('sha256').update(stlBuf).digest('hex');
      assert.equal(sha, p.sha256, `SHA-256 desincronizado en ${p.file}`);
    }

    const glbBuf = fs.readFileSync(path.join(RADAR_DIR, 'glb/senda-radar-v1.glb'));
    assert.equal(glbBuf.toString('ascii', 0, 4), 'glTF');
    assert.equal(glbBuf.readUInt32LE(4), 2);
    assert.equal(glbBuf.readUInt32LE(8), glbBuf.length);
    assert.ok(glbBuf.length < 2 * 1024 * 1024, `GLB supera 2 MB: ${glbBuf.length}`);

    const jsonChunkLen = glbBuf.readUInt32LE(12);
    const gltfJson = JSON.parse(glbBuf.toString('utf8', 20, 20 + jsonChunkLen));
    const nodeNames = new Set((gltfJson.nodes || []).map((n) => n.name));
    for (const expected of [
      'rear_body', 'front_bezel', 'belt_clip',
      'rd03d_radar_24ghz', 'oled_ssd1306', 'xiao_esp32s3',
      'lipo_1200mah', 'boost_5v', 'switch_ss22g08',
      'tripod_insert_1_4', 'm25_inserts_and_screws',
    ]) {
      assert.ok(nodeNames.has(expected), `Falta el nodo '${expected}' en senda-radar-v1.glb`);
    }
  });

  it('incluye los 3 renders 4D en MP4 y WebM y las capturas paso a paso para la guía', () => {
    for (const f of [
      'turntable-360.mp4', 'turntable-360.webm',
      'exploded-4d.mp4', 'exploded-4d.webm',
      'assembly-steps.mp4', 'assembly-steps.webm',
      'hero-preview.png', 'exploded-preview.png',
      'step-01-insertos.png', 'step-02-energia-y-xiao.png',
      'step-03-radar-y-oled.png', 'step-04-cierre-sin-metal.png',
      'step-05-clip-y-prueba-usb.png',
    ]) {
      const st = fs.statSync(path.join(RADAR_DIR, 'renders', f));
      assert.ok(st.size > 15_000, `Render vacío o truncado: renders/${f} (${st.size} B)`);
    }
  });

  it('verifica la paridad de protocolo entre el puente C++17 del firmware y mmwave-radar.mjs + mmwave-field.mjs', async () => {
    const binPath = path.join(os.tmpdir(), `senda_radar_contract_${process.pid}`);
    execFileSync('g++', [
      '-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror',
      path.join(RADAR_DIR, 'firmware/test/host_test.cpp'),
      '-o', binPath,
    ]);
    try {
      // 1. Suite nativa en host (mismas tramas que mmwave-radar.test.mjs)
      execFileSync(binPath, [], { stdio: 'pipe' });

      // 2. Flujo binario a través de TransparentBridge C++17 -> createFrameParser -> buildFieldPackage + verifyFieldPackage
      const lines = execFileSync(binPath, ['--smoke-stream'], { encoding: 'utf8' })
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      const rawChunks = [];
      const byteBuffers = [];
      for (const line of lines) {
        const [tStr, hex] = line.trim().split(/\s+/);
        const buf = Buffer.from(hex, 'hex');
        byteBuffers.push(buf);
        rawChunks.push({ tMs: Number(tStr), b64: buf.toString('base64') });
      }
      const wireBytes = Buffer.concat(byteBuffers);
      const frames = [];
      const parser = createFrameParser((frame) => frames.push(frame));
      parser.push(new Uint8Array(wireBytes));

      assert.equal(parser.stats().bad, 0);
      assert.equal(frames.length, 40);

      const pkg = await buildFieldPackage({
        session: {
          basis: 'RECORDING',
          startedAtUtc: '2026-11-26T14:00:00Z',
          endedAtUtc: '2026-11-26T14:00:04Z',
          timeZone: 'Europe/Madrid',
          scenario: 'contrato-puente-transparente-h1',
          notes: 'Flujo binario reenviado por TransparentBridge C++17',
          source: 'hardware/modules/senda-radar/firmware/radar_core.h',
          app: 'contract-test',
        },
        raw: rawChunks,
        tracks: [],
        marks: [{ tMs: 0, label: 'inicio' }],
        calibration: { rangePairs: [{ measuredM: 2.0, sensorM: 2.0 }, { measuredM: 4.0, sensorM: 4.0 }], yawPairs: [] },
        settings: {},
      });
      const check = await verifyFieldPackage(pkg);
      assert.equal(check.ok, true, check.errors.join('; '));
      const summary = summarizeFieldPackage(pkg);
      assert.equal(summary.frames, 40);
      assert.equal(summary.corruptFrames, 0);
    } finally {
      fs.rmSync(binPath, { force: true });
    }
  });

  it('respeta las líneas rojas documentales: 3 objetivos en movimiento, rotulado render, atribución MIT y marco CE/RoHS/RAEE', () => {
    const readme = fs.readFileSync(path.join(RADAR_DIR, 'README.md'), 'utf8');
    const guide = fs.readFileSync(path.join(RADAR_DIR, 'docs/GUIA_MONTAJE_Y_FABRICACION.md'), 'utf8');
    const notice = fs.readFileSync(path.join(REPO_ROOT, 'NOTICE'), 'utf8');

    assert.match(readme, /3 objetivos EN MOVIMIENTO/i);
    assert.match(readme, /2014\/53\/UE/);
    assert.match(readme, /RoHS/);
    assert.match(readme, /RAEE/);
    assert.match(readme, /render/);
    assert.match(guide, /ESCENARIO/);
    assert.match(notice, /Sudo_solder/);
    assert.match(notice, /SENDA Radar v1 Open Hardware/);
  });
});

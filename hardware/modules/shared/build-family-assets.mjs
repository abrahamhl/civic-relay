#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Calcula métricas exactas de malla (tetraedros firmados) de los STL de los 3 módulos adicionales de la
// familia SENDA (Bloque H2) y exporta sus conjuntos PBR multi-nodo en formato GLB (< 2 MB) para la web y
// para el generador reproducible de renders 4D.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() { this.result = null; this.onloadend = null; this.onerror = null; }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (typeof this.onloadend === 'function') this.onloadend();
      }, (err) => {
        if (typeof this.onerror === 'function') this.onerror(err);
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
        if (typeof this.onloadend === 'function') this.onloadend();
      });
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MODULES_DIR, '../..');
const THREE_DIR = path.join(REPO_ROOT, 'investor-next/node_modules/three');

const THREE = await import(pathToFileURL(path.join(THREE_DIR, 'build/three.module.js')).href);
const { STLLoader } = await import(pathToFileURL(path.join(THREE_DIR, 'examples/jsm/loaders/STLLoader.js')).href);
const { GLTFExporter } = await import(pathToFileURL(path.join(THREE_DIR, 'examples/jsm/exporters/GLTFExporter.js')).href);

const PETG_DENSITY_G_CM3 = 1.27;
const PETG_EUR_PER_G_INCL_VAT = 17.90 / 1000;
const SLICER_SCENARIO = {
  basis: 'ESCENARIO',
  note: 'Estimación geométrica reproducible de laminador FDM (boquilla 0,4 mm, capa 0,20 mm, 5 perímetros, relleno gyroid 25 %, 0 soportes, caudal efectivo medio 3,5 mm³/s)',
  effectiveFillFactor: 0.9464,
  effectiveFlowMm3PerSec: 3.5,
};

function computeStlMetrics(stlBuffer) {
  const triCount = stlBuffer.readUInt32LE(80);
  let signedVolMm3 = 0;
  let areaMm2 = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < triCount; i++) {
    const off = 84 + i * 50;
    const x1 = stlBuffer.readFloatLE(off + 12), y1 = stlBuffer.readFloatLE(off + 16), z1 = stlBuffer.readFloatLE(off + 20);
    const x2 = stlBuffer.readFloatLE(off + 24), y2 = stlBuffer.readFloatLE(off + 28), z2 = stlBuffer.readFloatLE(off + 32);
    const x3 = stlBuffer.readFloatLE(off + 36), y3 = stlBuffer.readFloatLE(off + 40), z3 = stlBuffer.readFloatLE(off + 44);
    minX = Math.min(minX, x1, x2, x3); minY = Math.min(minY, y1, y2, y3); minZ = Math.min(minZ, z1, z2, z3);
    maxX = Math.max(maxX, x1, x2, x3); maxY = Math.max(maxY, y1, y2, y3); maxZ = Math.max(maxZ, z1, z2, z3);

    signedVolMm3 += (x1 * (y2 * z3 - z2 * y3) - y1 * (x2 * z3 - z2 * x3) + z1 * (x2 * y3 - y2 * x3)) / 6.0;
    const ux = x2 - x1, uy = y2 - y1, uz = z2 - z1;
    const vx = x3 - x1, vy = y3 - y1, vz = z3 - z1;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    areaMm2 += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
  }
  const solidVolMm3 = Math.abs(signedVolMm3);
  const estExtrudedMm3 = solidVolMm3 * SLICER_SCENARIO.effectiveFillFactor;
  const estG = (estExtrudedMm3 / 1000) * PETG_DENSITY_G_CM3;
  return {
    triangles: triCount,
    bboxMm: { x: +(maxX - minX).toFixed(2), y: +(maxY - minY).toFixed(2), z: +(maxZ - minZ).toFixed(2) },
    solidVolumeCm3: +(solidVolMm3 / 1000).toFixed(3),
    surfaceAreaCm2: +(areaMm2 / 100).toFixed(2),
    slicerEstimate: {
      basis: 'ESCENARIO',
      filamentGramsPetg: +estG.toFixed(2),
      printTimeMinutes: Math.round((estExtrudedMm3 / SLICER_SCENARIO.effectiveFlowMm3PerSec) / 60),
      filamentCostEurInclVat: +(estG * PETG_EUR_PER_G_INCL_VAT).toFixed(2),
    },
  };
}

const loader = new STLLoader();
const exporter = new GLTFExporter();

function mats() {
  return {
    slate: new THREE.MeshStandardMaterial({ color: 0x17222d, roughness: 0.44, metalness: 0.06 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x1e3040, roughness: 0.38, metalness: 0.08 }),
    hiVis: new THREE.MeshStandardMaterial({ color: 0xd95f3b, roughness: 0.36, metalness: 0.05 }),
    pcbGreen: new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.38, metalness: 0.15 }),
    pcbBlue: new THREE.MeshStandardMaterial({ color: 0x0b4f6c, roughness: 0.36, metalness: 0.15 }),
    pcbBlack: new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.42, metalness: 0.20 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.25, metalness: 0.88 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd4a638, roughness: 0.28, metalness: 0.90 }),
    lipo: new THREE.MeshStandardMaterial({ color: 0xaeb6bf, roughness: 0.32, metalness: 0.78 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121518, roughness: 0.65, metalness: 0.05 }),
  };
}

const SPECS = [
  {
    slug: 'senda-nodo-lora',
    glbName: 'senda-nodo-lora.glb',
    zCenter: 12.0,
    parts: [
      { name: 'base', file: 'base.stl', pos: [0, 0, -12.0], rot: [0, 0, 0], mat: 'slate' },
      { name: 'lid', file: 'lid.stl', pos: [0, 0, 24.0 - 12.0], rot: [0, Math.PI, 0], mat: 'teal' },
    ],
    buildInternals(root, m) {
      // Heltec Wireless Stick Lite V3 (58x23 mm)
      const heltec = new THREE.Group();
      heltec.name = 'heltec_wsl_v3_sx1262';
      heltec.position.set(0, 0, 10.5 - 12.0);
      heltec.add(new THREE.Mesh(new THREE.BoxGeometry(23, 58, 1.5), m.pcbBlack));
      const rfShield = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 2.4), m.silver);
      rfShield.position.set(0, 10, 1.8);
      heltec.add(rfShield);
      root.add(heltec);

      // Li-Po 1200 mAh
      const lipo = new THREE.Mesh(new THREE.BoxGeometry(36, 64, 5.2), m.lipo);
      lipo.name = 'lipo_1200mah';
      lipo.position.set(0, -4, 5.5 - 12.0);
      root.add(lipo);

      // Conector SMA + antena látigo EU868 exterior superior
      const ant = new THREE.Group();
      ant.name = 'antenna_eu868_whip';
      ant.position.set(0, 44, 10.0 - 12.0);
      const sma = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 9.0, 20), m.brass);
      sma.position.set(0, 4.5, 0);
      ant.add(sma);
      const whip = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.6, 52.0, 20), m.rubber);
      whip.position.set(0, 34.0, 0);
      ant.add(whip);
      root.add(ant);

      // Interruptor SS22G08
      const sw = new THREE.Mesh(new THREE.BoxGeometry(4.5, 13.5, 4.0), m.silver);
      sw.name = 'switch_ss22g08';
      sw.position.set(-22.5, 13.5, 9.5 - 12.0);
      root.add(sw);
    },
  },
  {
    slug: 'senda-baliza-ble',
    glbName: 'senda-baliza-ble.glb',
    zCenter: 9.0,
    parts: [
      { name: 'bottom_shell', file: 'bottom_shell.stl', pos: [0, 0, -9.0], rot: [0, 0, 0], mat: 'slate' },
      { name: 'top_shell', file: 'top_shell.stl', pos: [0, 0, 18.0 - 9.0], rot: [0, Math.PI, 0], mat: 'hiVis' },
    ],
    buildInternals(root, m) {
      // Seeed XIAO BLE nRF52840 (21x17,8 mm)
      const xiao = new THREE.Group();
      xiao.name = 'xiao_ble_nrf52840';
      xiao.position.set(0, -13.0, 7.2 - 9.0);
      xiao.add(new THREE.Mesh(new THREE.BoxGeometry(17.8, 21.0, 1.4), m.pcbBlack));
      const shield = new THREE.Mesh(new THREE.BoxGeometry(11.5, 11.5, 2.0), m.silver);
      shield.position.set(0, 1.5, 1.5);
      xiao.add(shield);
      root.add(xiao);

      // Batería Li-Po 250 mAh protegida (33x20x8 mm)
      const bat = new THREE.Mesh(new THREE.BoxGeometry(20.0, 32.0, 6.2), m.lipo);
      bat.name = 'lipo_250mah_pcm';
      bat.position.set(0, 6.0, 6.0 - 9.0);
      root.add(bat);

      // Pulsador táctil SOS interno bajo membrana
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 3.5, 20), m.brass);
      btn.rotation.x = Math.PI / 2;
      btn.name = 'sos_tactile_switch';
      btn.position.set(0, 4.0, 12.5 - 9.0);
      root.add(btn);
    },
  },
  {
    slug: 'senda-estacion-ambiental',
    glbName: 'senda-estacion-ambiental.glb',
    zCenter: 21.0,
    parts: [
      { name: 'rear_housing', file: 'rear_housing.stl', pos: [0, 0, -21.0], rot: [0, 0, 0], mat: 'slate' },
      { name: 'front_louvers', file: 'front_louvers.stl', pos: [0, 0, 42.0 - 21.0], rot: [0, Math.PI, 0], mat: 'teal' },
    ],
    buildInternals(root, m) {
      // Sensirion SPS30 (41x41x12,2 mm)
      const sps = new THREE.Group();
      sps.name = 'sensirion_sps30_pm';
      sps.position.set(-14.0, -17.0, 10.0 - 21.0);
      sps.add(new THREE.Mesh(new THREE.BoxGeometry(40.6, 40.6, 12.0), m.silver));
      root.add(sps);

      // Bosch BME280 (15x12 mm)
      const bme = new THREE.Mesh(new THREE.BoxGeometry(15.0, 12.0, 1.6), m.pcbBlue);
      bme.name = 'bosch_bme280';
      bme.position.set(22.0, -20.0, 10.0 - 21.0);
      root.add(bme);

      // Seeed XIAO ESP32-S3 en cámara superior aislada térmicamente
      const xiao = new THREE.Mesh(new THREE.BoxGeometry(18.0, 21.0, 3.0), m.pcbBlack);
      xiao.name = 'xiao_esp32s3_logger';
      xiao.position.set(18.0, 25.0, 10.0 - 21.0);
      root.add(xiao);

      // Placa JSN-SR04T en cámara superior + sonda ultrasónica exterior inferior
      const jsnPcb = new THREE.Mesh(new THREE.BoxGeometry(41.0, 28.0, 2.0), m.pcbBlue);
      jsnPcb.name = 'jsn_sr04t_driver_pcb';
      jsnPcb.position.set(-14.0, 26.0, 9.0 - 21.0);
      root.add(jsnPcb);

      const probe = new THREE.Group();
      probe.name = 'jsn_sr04t_waterproof_probe';
      probe.position.set(-16.0, -58.0, 14.0 - 21.0);
      probe.add(new THREE.Mesh(new THREE.CylinderGeometry(9.0, 9.0, 16.0, 24), m.silver));
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 14.0, 12), m.rubber);
      cable.position.set(0, 11.0, 0);
      probe.add(cable);
      root.add(probe);
    },
  },
];

const summaryAll = {};
for (const sp of SPECS) {
  const modDir = path.join(MODULES_DIR, sp.slug);
  const m = mats();
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = sp.slug.replace(/-/g, '_');
  root.scale.setScalar(0.001);
  scene.add(root);

  const modMetrics = {
    module: sp.slug,
    generatedBy: 'hardware/modules/shared/build-family-assets.mjs',
    generatedAt: '2026-11-26T18:59:00Z',
    slicerScenario: SLICER_SCENARIO,
    parts: {},
  };

  for (const pf of sp.parts) {
    const stlPath = path.join(modDir, 'stl', pf.file);
    const buf = fs.readFileSync(stlPath);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const st = computeStlMetrics(buf);
    modMetrics.parts[pf.name] = { file: `stl/${pf.file}`, bytes: buf.length, sha256, ...st };

    const geom = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, m[pf.mat]);
    mesh.name = pf.name;
    mesh.position.set(...pf.pos);
    mesh.rotation.set(...pf.rot);
    root.add(mesh);
  }

  sp.buildInternals(root, m);
  scene.updateMatrixWorld(true);

  const glbBuf = Buffer.from(await exporter.parseAsync(scene, { binary: true }));
  const glbPath = path.join(modDir, 'glb', sp.glbName);
  fs.mkdirSync(path.dirname(glbPath), { recursive: true });
  fs.writeFileSync(glbPath, glbBuf);

  const totCm3 = Object.values(modMetrics.parts).reduce((s, x) => s + x.solidVolumeCm3, 0);
  const totG = Object.values(modMetrics.parts).reduce((s, x) => s + x.slicerEstimate.filamentGramsPetg, 0);
  const totMin = Object.values(modMetrics.parts).reduce((s, x) => s + x.slicerEstimate.printTimeMinutes, 0);
  const billedG = Math.ceil(totG);

  modMetrics.totals = {
    solidVolumeCm3: +totCm3.toFixed(3),
    slicerEstimate: {
      basis: 'ESCENARIO',
      totalFilamentGramsPetg: +totG.toFixed(2),
      billedFilamentGramsWithMargin: billedG,
      totalPrintTimeMinutes: totMin,
      totalPrintTimeFormatted: `${Math.floor(totMin / 60)} h ${totMin % 60} min`,
      totalFilamentCostEurInclVat: +(billedG * PETG_EUR_PER_G_INCL_VAT).toFixed(2),
      totalFilamentCostEurExVat: +(billedG * (14.79 / 1000)).toFixed(2),
    },
  };
  modMetrics.glb = {
    file: `glb/${sp.glbName}`,
    bytes: glbBuf.length,
    kilobytes: +(glbBuf.length / 1024).toFixed(2),
    under2MbLimit: glbBuf.length < 2 * 1024 * 1024,
    sha256: crypto.createHash('sha256').update(glbBuf).digest('hex'),
    namedNodes: root.children.map((c) => c.name),
  };

  if (!modMetrics.glb.under2MbLimit) throw new Error(`GLB > 2 MB en ${sp.slug}`);
  fs.writeFileSync(path.join(modDir, 'cad/cad-metrics.json'), JSON.stringify(modMetrics, null, 2) + '\n');
  summaryAll[sp.slug] = modMetrics;
}

console.log(JSON.stringify(summaryAll, null, 2));

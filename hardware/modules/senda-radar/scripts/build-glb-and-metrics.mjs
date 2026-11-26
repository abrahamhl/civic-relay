#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Calcula el volumen exacto de malla (tetraedros firmados), área superficial, cotas y estimación
// geométrica de laminado de cada STL de SENDA Radar v1, y exporta el conjunto ensamblado PBR
// `hardware/modules/senda-radar/glb/senda-radar-v1.glb` (< 2 MB) con nodos nombrados para la web
// y para el generador reproducible de renders 4D.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Polyfill mínimo de FileReader para GLTFExporter en Node 22+
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(
        (buf) => {
          this.result = buf;
          if (typeof this.onloadend === 'function') this.onloadend();
        },
        (err) => {
          if (typeof this.onerror === 'function') this.onerror(err);
        }
      );
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
        if (typeof this.onloadend === 'function') this.onloadend();
      });
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOD_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MOD_DIR, '../../..');
const THREE_DIR = path.join(REPO_ROOT, 'investor-next/node_modules/three');

const THREE = await import(pathToFileURL(path.join(THREE_DIR, 'build/three.module.js')).href);
const { STLLoader } = await import(pathToFileURL(path.join(THREE_DIR, 'examples/jsm/loaders/STLLoader.js')).href);
const { GLTFExporter } = await import(pathToFileURL(path.join(THREE_DIR, 'examples/jsm/exporters/GLTFExporter.js')).href);

const PETG_DENSITY_G_CM3 = 1.27; // Hoja técnica PETG estándar (1,27 g/cm³)
const PETG_EUR_PER_G_INCL_VAT = 17.90 / 1000; // AzureFilm PETG Hyper Speed 1 kg (TinyTronics €17,90 IVA incl., consultado 2026-11-26)
// ESCENARIO explícito del laminador FDM:
// En paredes delgadas de 2,2 mm con 4–5 perímetros de 0,42 mm, ~88 % del volumen CAD es perímetro macizo
// y el ~12 % interior lleva relleno gyroid al 25 % => factor efectivo de masa = 0,88 + 0,12 * 0,25 = 0,91,
// más 4 % de línea de purga/falda = 0,9464 del volumen sólido CAD.
// Caudal volumétrico medio efectivo (incluyendo viajes, retracciones y primera capa lenta) = 3,5 mm³/s.
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
    const x1 = stlBuffer.readFloatLE(off + 12);
    const y1 = stlBuffer.readFloatLE(off + 16);
    const z1 = stlBuffer.readFloatLE(off + 20);
    const x2 = stlBuffer.readFloatLE(off + 24);
    const y2 = stlBuffer.readFloatLE(off + 28);
    const z2 = stlBuffer.readFloatLE(off + 32);
    const x3 = stlBuffer.readFloatLE(off + 36);
    const y3 = stlBuffer.readFloatLE(off + 40);
    const z3 = stlBuffer.readFloatLE(off + 44);

    minX = Math.min(minX, x1, x2, x3);
    minY = Math.min(minY, y1, y2, y3);
    minZ = Math.min(minZ, z1, z2, z3);
    maxX = Math.max(maxX, x1, x2, x3);
    maxY = Math.max(maxY, y1, y2, y3);
    maxZ = Math.max(maxZ, z1, z2, z3);

    // Volumen firmado del tetraedro con el origen: (p1 · (p2 × p3)) / 6
    signedVolMm3 += (
      x1 * (y2 * z3 - z2 * y3) -
      y1 * (x2 * z3 - z2 * x3) +
      z1 * (x2 * y3 - y2 * x3)
    ) / 6.0;

    // Área del triángulo: 0.5 * |(p2 - p1) × (p3 - p1)|
    const ux = x2 - x1, uy = y2 - y1, uz = z2 - z1;
    const vx = x3 - x1, vy = y3 - y1, vz = z3 - z1;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    areaMm2 += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
  }

  const solidVolMm3 = Math.abs(signedVolMm3);
  const solidVolCm3 = solidVolMm3 / 1000.0;
  const estExtrudedMm3 = solidVolMm3 * SLICER_SCENARIO.effectiveFillFactor;
  const estFilamentG = (estExtrudedMm3 / 1000.0) * PETG_DENSITY_G_CM3;
  const estPrintMinutes = Math.round((estExtrudedMm3 / SLICER_SCENARIO.effectiveFlowMm3PerSec) / 60);

  return {
    triangles: triCount,
    bboxMm: {
      x: Number((maxX - minX).toFixed(2)),
      y: Number((maxY - minY).toFixed(2)),
      z: Number((maxZ - minZ).toFixed(2)),
    },
    solidVolumeCm3: Number(solidVolCm3.toFixed(3)),
    surfaceAreaCm2: Number((areaMm2 / 100.0).toFixed(2)),
    slicerEstimate: {
      basis: 'ESCENARIO',
      filamentGramsPetg: Number(estFilamentG.toFixed(2)),
      printTimeMinutes: estPrintMinutes,
      filamentCostEurInclVat: Number((estFilamentG * PETG_EUR_PER_G_INCL_VAT).toFixed(2)),
    },
  };
}

const loader = new STLLoader();
const stlDir = path.join(MOD_DIR, 'stl');
const partFiles = [
  { name: 'front_bezel', file: 'front_bezel.stl', orientation: 'Cara frontal plana sobre la cama (Z=0), 0 soportes' },
  { name: 'rear_body', file: 'rear_body.stl', orientation: 'Espalda exterior plana sobre la cama (Z=0), 0 soportes' },
  { name: 'belt_clip', file: 'belt_clip.stl', orientation: 'Apoyado sobre su canto lateral (rotado 90° en Y), 0 soportes' },
];

const metrics = {
  module: 'senda-radar-v1',
  generatedBy: 'hardware/modules/senda-radar/scripts/build-glb-and-metrics.mjs',
  generatedAt: '2026-11-26T13:38:00Z',
  petgDensityGCm3: PETG_DENSITY_G_CM3,
  petgEurPerKgInclVat: 17.90,
  petgPriceQueryDate: '2026-11-26',
  slicerScenario: SLICER_SCENARIO,
  parts: {},
};

const geometries = {};
for (const pf of partFiles) {
  const fullPath = path.join(stlDir, pf.file);
  const buf = fs.readFileSync(fullPath);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const m = computeStlMetrics(buf);
  metrics.parts[pf.name] = {
    file: `stl/${pf.file}`,
    bytes: buf.length,
    sha256,
    printOrientation: pf.orientation,
    ...m,
  };
  const geom = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  geom.computeVertexNormals();
  geometries[pf.name] = geom;
}

const totalSolidCm3 = Object.values(metrics.parts).reduce((s, p) => s + p.solidVolumeCm3, 0);
const totalGrams = Object.values(metrics.parts).reduce((s, p) => s + p.slicerEstimate.filamentGramsPetg, 0);
const totalMinutes = Object.values(metrics.parts).reduce((s, p) => s + p.slicerEstimate.printTimeMinutes, 0);
// Variante mínima usa front_bezel + rear_body (sin belt_clip opcional, o con él; incluimos las 3 piezas en ambas para máxima utilidad en campo)
metrics.totals = {
  solidVolumeCm3: Number(totalSolidCm3.toFixed(3)),
  slicerEstimate: {
    basis: 'ESCENARIO',
    totalFilamentGramsPetg: Number(totalGrams.toFixed(2)),
    billedFilamentGramsWithMargin: Math.ceil(totalGrams),
    totalPrintTimeMinutes: totalMinutes,
    totalPrintTimeFormatted: `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`,
    totalFilamentCostEurInclVat: Number((Math.ceil(totalGrams) * PETG_EUR_PER_G_INCL_VAT).toFixed(2)),
  },
};

// --- Construcción de la escena PBR en escala métrica glTF (1 unidad = 1 metro; centrado en origen) ---
const scene = new THREE.Scene();
scene.name = 'SendaRadarV1Scene';

const root = new THREE.Group();
root.name = 'senda_radar_v1';
// Convertimos mm -> m (0.001) y centramos Z del cuerpo principal (Z = 0..25 mm -> centro en Z = 12.5 mm)
root.scale.setScalar(0.001);
scene.add(root);

const matRearPetg = new THREE.MeshStandardMaterial({
  name: 'PETG_Slate_Rear',
  color: 0x16202a,
  roughness: 0.46,
  metalness: 0.06,
});
const matFrontPetg = new THREE.MeshStandardMaterial({
  name: 'PETG_DeepTeal_Front',
  color: 0x1d2b38,
  roughness: 0.40,
  metalness: 0.08,
});
const matClipPetg = new THREE.MeshStandardMaterial({
  name: 'PETG_Carbon_Clip',
  color: 0x263544,
  roughness: 0.48,
  metalness: 0.05,
});
const matPcbRadar = new THREE.MeshStandardMaterial({
  name: 'PCB_RD03D_Blue',
  color: 0x0b4f6c,
  roughness: 0.35,
  metalness: 0.15,
});
const matPatchGold = new THREE.MeshStandardMaterial({
  name: 'ENIG_Gold_24GHz_Patches',
  color: 0xe6b84c,
  roughness: 0.22,
  metalness: 0.92,
});
const matPcbDark = new THREE.MeshStandardMaterial({
  name: 'PCB_MatteBlack',
  color: 0x15191d,
  roughness: 0.42,
  metalness: 0.20,
});
const matMetalSilver = new THREE.MeshStandardMaterial({
  name: 'Shield_TinSteel',
  color: 0xc4ccd4,
  roughness: 0.25,
  metalness: 0.88,
});
const matBrass = new THREE.MeshStandardMaterial({
  name: 'Brass_Insert_CuZn',
  color: 0xd4a638,
  roughness: 0.28,
  metalness: 0.90,
});
const matOledGlass = new THREE.MeshStandardMaterial({
  name: 'OLED_SSD1306_Glass',
  color: 0x050c14,
  emissive: 0x072638,
  emissiveIntensity: 0.65,
  roughness: 0.12,
  metalness: 0.10,
});
const matOledTrace = new THREE.MeshStandardMaterial({
  name: 'OLED_Active_Cyan',
  color: 0x38bdf8,
  emissive: 0x38bdf8,
  emissiveIntensity: 0.9,
  roughness: 0.2,
  metalness: 0.0,
});
const matLipoPouch = new THREE.MeshStandardMaterial({
  name: 'LiPo_AluPouch_1200mAh',
  color: 0xaeb6bf,
  roughness: 0.32,
  metalness: 0.78,
});
const matKapton = new THREE.MeshStandardMaterial({
  name: 'Kapton_Amber_PCM',
  color: 0xd97706,
  roughness: 0.35,
  metalness: 0.10,
});
const matBlackOxide = new THREE.MeshStandardMaterial({
  name: 'Screw_M25_BlackOxide',
  color: 0x111315,
  roughness: 0.35,
  metalness: 0.75,
});

const Z_CENTER_MM = 12.5;

// 1. Cuerpo trasero (`rear_body`): Z local = 0..16 mm -> desplazado -12.5 mm
const rearMesh = new THREE.Mesh(geometries.rear_body, matRearPetg);
rearMesh.name = 'rear_body';
rearMesh.position.set(0, 0, -Z_CENTER_MM);
root.add(rearMesh);

// 2. Bisel frontal (`front_bezel`): rotado 180° en Y y trasladado a Z = +25.0 - 12.5 = +12.5 mm
const frontMesh = new THREE.Mesh(geometries.front_bezel, matFrontPetg);
frontMesh.name = 'front_bezel';
frontMesh.rotation.set(0, Math.PI, 0);
frontMesh.position.set(0, 0, 25.0 - Z_CENTER_MM);
root.add(frontMesh);

// 3. Clip trasero (`belt_clip`): en el STL está rotado +90° en Y para impresión; deshacemos con -90° en Y
const clipMesh = new THREE.Mesh(geometries.belt_clip, matClipPetg);
clipMesh.name = 'belt_clip';
clipMesh.rotation.set(0, -Math.PI / 2, 0);
clipMesh.position.set(0, -4.0, -2.6 - Z_CENTER_MM);
root.add(clipMesh);

// 4. Módulo radar Ai-Thinker Rd-03D (44,0 x 15,0 x 1,6 mm + antenas 1T2R de parches de 24 GHz mirando a +Z)
const radarGroup = new THREE.Group();
radarGroup.name = 'rd03d_radar_24ghz';
radarGroup.position.set(0, 18.0, 23.0 - Z_CENTER_MM);
const radarPcb = new THREE.Mesh(new THREE.BoxGeometry(44.0, 15.0, 1.6), matPcbRadar);
radarGroup.add(radarPcb);
// 3 columnas de micro-parches 24 GHz (1 TX + 2 RX) en la cara frontal (+Z)
for (const px of [-13.5, -4.5, 11.0]) {
  for (const py of [-3.6, 0, 3.6]) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 0.15), matPatchGold);
    patch.position.set(px, py, 0.88);
    radarGroup.add(patch);
  }
}
const radarIc = new THREE.Mesh(new THREE.BoxGeometry(6.0, 6.0, 0.9), matPcbDark);
radarIc.position.set(3.0, 0, -1.1);
radarGroup.add(radarIc);
root.add(radarGroup);

// 5. Pantalla OLED 0,96" I2C SSD1306 (28,0 x 28,0 mm, cristal activo mirando a +Z)
const oledGroup = new THREE.Group();
oledGroup.name = 'oled_ssd1306';
oledGroup.position.set(0, -11.0, 21.8 - Z_CENTER_MM);
const oledPcb = new THREE.Mesh(new THREE.BoxGeometry(28.0, 28.0, 1.4), matPcbRadar);
oledGroup.add(oledPcb);
const oledGlass = new THREE.Mesh(new THREE.BoxGeometry(25.0, 15.0, 1.2), matOledGlass);
oledGlass.position.set(0, -1.0, 1.2);
oledGroup.add(oledGlass);
// Anillos PPI estilizados visibles en el GLB estático para la web
for (const r of [4.2, 7.6, 10.8]) {
  const arc = new THREE.Mesh(new THREE.RingGeometry(r - 0.25, r, 28, 1, Math.PI * 0.18, Math.PI * 0.64), matOledTrace);
  arc.position.set(0, -6.8, 1.85);
  oledGroup.add(arc);
}
for (const [tx, ty] of [[-3.2, -0.5], [4.1, 2.1]]) {
  const blip = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), matOledTrace);
  blip.position.set(tx, ty, 1.88);
  oledGroup.add(blip);
}
root.add(oledGroup);

// 6. Seeed Studio XIAO ESP32-S3 (21,0 x 17,8 mm + blindaje RF + conector USB-C hacia +X)
const xiaoGroup = new THREE.Group();
xiaoGroup.name = 'xiao_esp32s3';
xiaoGroup.position.set(24.5, -6.0, 9.8 - Z_CENTER_MM);
const xiaoPcb = new THREE.Mesh(new THREE.BoxGeometry(21.0, 17.8, 1.4), matPcbDark);
xiaoGroup.add(xiaoPcb);
const xiaoShield = new THREE.Mesh(new THREE.BoxGeometry(12.5, 12.5, 2.2), matMetalSilver);
xiaoShield.position.set(-2.5, 0, 1.6);
xiaoGroup.add(xiaoShield);
const usbcShell = new THREE.Mesh(new THREE.BoxGeometry(7.4, 8.9, 3.2), matMetalSilver);
usbcShell.position.set(8.2, 0, 2.0);
xiaoGroup.add(usbcShell);
root.add(xiaoGroup);

// 7. Batería PKCELL LP503562 3,7 V 1200 mAh con PCM (64,0 x 35,0 x 5,2 mm)
const lipoGroup = new THREE.Group();
lipoGroup.name = 'lipo_1200mah';
lipoGroup.position.set(-2.5, 2.0, 6.8 - Z_CENTER_MM);
const lipoCell = new THREE.Mesh(new THREE.BoxGeometry(60.0, 35.0, 5.0), matLipoPouch);
lipoGroup.add(lipoCell);
const lipoPcm = new THREE.Mesh(new THREE.BoxGeometry(4.5, 34.5, 4.8), matKapton);
lipoPcm.position.set(31.8, 0, 0);
lipoGroup.add(lipoPcm);
root.add(lipoGroup);

// 8. Elevador DC-DC 5 V fijo + condensador 100 µF (11,0 x 10,5 x 5,0 mm)
const boostGroup = new THREE.Group();
boostGroup.name = 'boost_5v';
boostGroup.position.set(-26.5, 27.0, 6.5 - Z_CENTER_MM);
boostGroup.add(new THREE.Mesh(new THREE.BoxGeometry(11.0, 10.5, 1.4), matPcbRadar));
const capCyl = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 6.5, 20), matBlackOxide);
capCyl.rotation.set(Math.PI / 2, 0, 0);
capCyl.position.set(3.5, -2.0, 3.5);
boostGroup.add(capCyl);
root.add(boostGroup);

// 9. Interruptor deslizante SS22G08 en pared izquierda (-X)
const swGroup = new THREE.Group();
swGroup.name = 'switch_ss22g08';
swGroup.position.set(-35.2, 6.0, 8.5 - Z_CENTER_MM);
swGroup.add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 14.0, 4.2), matMetalSilver));
const swKnob = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.2, 2.8), matBlackOxide);
swKnob.position.set(-2.8, 1.5, 0);
swGroup.add(swKnob);
root.add(swGroup);

// 10. Inserto de trípode Ruthex RX-1/4"x6.4 UNC en base inferior (-Y)
const tripodInsert = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 6.4, 24), matBrass);
tripodInsert.name = 'tripod_insert_1_4';
tripodInsert.position.set(0, -31.6, 8.0 - Z_CENTER_MM);
root.add(tripodInsert);

// 11. 2 insertos inferiores M2.5 + 2 tornillos M2.5 x 6 mm
const fastenersGroup = new THREE.Group();
fastenersGroup.name = 'm25_inserts_and_screws';
for (const sx of [-1, 1]) {
  const bx = sx * (76.0 / 2 - 5.5);
  const by = -(70.0 / 2 - 5.5);
  const ins = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 5.0, 18), matBrass);
  ins.rotation.set(Math.PI / 2, 0, 0);
  ins.position.set(bx, by, 11.2 - Z_CENTER_MM);
  fastenersGroup.add(ins);

  const scr = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.8, 18), matBlackOxide);
  scr.rotation.set(Math.PI / 2, 0, 0);
  scr.position.set(bx, by, 24.2 - Z_CENTER_MM);
  fastenersGroup.add(scr);
}
root.add(fastenersGroup);

scene.updateMatrixWorld(true);

const exporter = new GLTFExporter();
const glbArrayBuffer = await exporter.parseAsync(scene, { binary: true });
const glbBuffer = Buffer.from(glbArrayBuffer);

const glbPath = path.join(MOD_DIR, 'glb/senda-radar-v1.glb');
fs.mkdirSync(path.dirname(glbPath), { recursive: true });
fs.writeFileSync(glbPath, glbBuffer);

const glbSha256 = crypto.createHash('sha256').update(glbBuffer).digest('hex');
metrics.glb = {
  file: 'glb/senda-radar-v1.glb',
  bytes: glbBuffer.length,
  kilobytes: Number((glbBuffer.length / 1024).toFixed(2)),
  under2MbLimit: glbBuffer.length < 2 * 1024 * 1024,
  sha256: glbSha256,
  namedNodes: root.children.map((c) => c.name),
};

const metricsPath = path.join(MOD_DIR, 'cad/cad-metrics.json');
fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2) + '\n');

console.log(JSON.stringify(metrics, null, 2));
if (!metrics.glb.under2MbLimit) {
  throw new Error(`GLB superó el límite de 2 MB: ${glbBuffer.length} bytes`);
}

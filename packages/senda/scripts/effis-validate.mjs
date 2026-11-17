#!/usr/bin/env node
/**
 * SENDA · Validación del incendio de San Martín de Valdeiglesias (julio de 2026) contra el perímetro OFICIAL de EFFIS.
 *
 * Entradas (todas en el repo): smv2026/effis_perimetros.json (EFFIS, descarga real), burn_100m.bin (cicatriz
 * Sentinel-2 procesada por SENDA), arrival_roi.bin (llegada del modelo calibrado) y fire3d.json (malla e ignición).
 * Calcula:
 *  1. Coherencia de datos: cicatriz Sentinel-2 de SENDA (08-08) frente al perímetro EFFIS que contiene la ignición.
 *  2. Modelo: huella del modelo calibrado (llegada < 48 h, dentro del recuadro simulado) frente a EFFIS.
 *  3. Referencia ingenua: círculo de la misma área que la huella del modelo, centrado en la ignición.
 * Escribe smv2026/validacion_effis.json. Es una validación FUERA DE MUESTRA EN EL TIEMPO (el modelo se calibró con la
 * cicatriz del 24-07; EFFIS es el perímetro final), pero del MISMO incendio: no sustituye a validar en incendios distintos.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rasterizePolygons, compareMasks, circleMask, skillVsReference, inGeometry } from '../src/burn-validation.mjs';

const D = resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public/senda/data/smv2026');
const meta = JSON.parse(readFileSync(resolve(D, 'fire3d.json'), 'utf8')), effis = JSON.parse(readFileSync(resolve(D, 'effis_perimetros.json'), 'utf8'));
const { w: W, h: H, dx: DX, x0: X0, y1: Y1 } = meta.malla, grid = { w: W, h: H, dx: DX, x0: X0, y1: Y1, zone: 30 }, cellHa = (DX * DX) / 10_000;
const ign = meta.ignicion, feats = Object.values(effis.capas).flatMap((c) => c.features);
const target = feats.find((f) => inGeometry(ign.lon, ign.lat, f.geometry));
if (!target) throw new Error('Ningún perímetro EFFIS contiene la ignición: no se valida nada');
const obs = rasterizePolygons([target], grid);

// 1. Cicatriz Sentinel-2 de SENDA (bit 2 = 08-08, gravedad moderada-baja o más)
const bits = new Uint8Array(readFileSync(resolve(D, 'burn_100m.bin'))), s2 = Uint8Array.from(bits, (b) => (b >> 2) & 1);
const datos = compareMasks(s2, obs, { cellHa });
// La cicatriz de Sentinel-2 cubre TODOS los incendios del recuadro: se compara también con la unión de los perímetros
// EFFIS de julio-agosto de 2026 que caen en la malla (comparación justa de los datos, no del modelo).
const verano = feats.filter((f) => /^2026-0[78]/.test(f.properties.FIREDATE ?? ''));
const obsVerano = rasterizePolygons(verano, grid), datosUnion = compareMasks(s2, obsVerano, { cellHa });

// 2. Modelo calibrado (sólo existe dentro del recuadro simulado ROI)
const roi = meta.conjunto.roi, arr = new Uint16Array(readFileSync(resolve(D, 'arrival_roi.bin')).buffer.slice(0));
const model = new Uint8Array(W * H), inRoi = new Uint8Array(W * H);
for (let j = 0; j < roi.h; j++) for (let i = 0; i < roi.w; i++) { const k = (j + roi.j0) * W + i + roi.i0; inRoi[k] = 1; if (arr[j * roi.w + i] !== 65535) model[k] = 1; }
const nModel = model.reduce((s, v) => s + v, 0);
const modelo = compareMasks(model, obs, { cellHa });
// 3. Círculo de la misma área centrado en la ignición
const circ = circleMask(W, H, ign.i, ign.j, nModel), referencia = compareMasks(circ, obs, { cellHa });
const obsEnRoi = obs.reduce((s, v, k) => s + (v && inRoi[k] ? 1 : 0), 0), obsTotal = obs.reduce((s, v) => s + v, 0);

const out = {
  generado: new Date().toISOString(), fuentes: { effis: effis.fuente, effisDescarga: effis.descargadoUTC, cicatriz: 'Sentinel-2 dNBR procesado por SENDA (burn_100m.bin, 08-08-2026)', modelo: 'arrival_roi.bin (fire-field calibrado con la cicatriz del 24-07)' },
  perimetroEFFIS: { id: target.properties.id, municipio: target.properties.COMMUNE, provincia: target.properties.PROVINCE, inicio: target.properties.FIREDATE, areaHaEFFIS: Number(target.properties.AREA_HA), areaHaRasterizada: obsTotal * cellHa, fraccionDentroDelRecuadroSimulado: obsTotal ? obsEnRoi / obsTotal : null },
  coherenciaDatosTodosLosIncendios: { ...datosUnion, perimetrosEFFIS: verano.map((f) => ({ id: f.properties.id, municipio: f.properties.COMMUNE, inicio: f.properties.FIREDATE, areaHa: Number(f.properties.AREA_HA) })), lectura: 'Cicatriz Sentinel-2 de SENDA frente a la unión de perímetros EFFIS de jul-ago 2026 en la malla: la comparación justa de los datos.' },
  coherenciaDatos: { ...datos, lectura: 'Cuánto coincide la cicatriz que SENDA calcula con Sentinel-2 con el perímetro oficial de EFFIS (mismo incendio, procesos independientes).' },
  modelo: { ...modelo, celdasHuella: nModel },
  circuloMismaArea: referencia,
  habilidadModeloVsCirculo: skillVsReference(modelo.jaccard, referencia.jaccard),
  limites: [
    'Mismo incendio con el que se calibró el modelo (en otra fecha): no es validación en incendios distintos.',
    'El modelo solo se simuló dentro de un recuadro y hasta 48 h; el perímetro EFFIS es el final, tras días de incendio y de extinción.',
    'EFFIS cartografía con MODIS/VIIRS (áreas ≥ ~30 ha); su borde tiene su propio error.',
  ],
};
writeFileSync(resolve(D, 'validacion_effis.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ perimetro: out.perimetroEFFIS, datosJ: datos.jaccard.toFixed(3), datosUnionJ: datosUnion.jaccard.toFixed(3), datosUnionAcierto: datosUnion.acierto?.toFixed(3), datosUnionFA: datosUnion.falsaAlarma?.toFixed(3), modeloJ: modelo.jaccard.toFixed(3), circuloJ: referencia.jaccard.toFixed(3), habilidad: out.habilidadModeloVsCirculo.toFixed(3), aciertoModelo: modelo.acierto?.toFixed(3), falsaAlarma: modelo.falsaAlarma?.toFixed(3) }, null, 1));

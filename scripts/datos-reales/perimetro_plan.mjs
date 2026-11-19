#!/usr/bin/env node
/**
 * Plan del cordón de cámaras para los accidentes ACTUALES de la DGT: para cada uno, las cámaras DGT con imagen
 * (inventario dgt_camaras.json) más cercanas por sector (camera-perimeter.mjs). Lo consume la medición en
 * packages/senda-vision/camaras_perimetro.py. Uso: node scripts/datos-reales/perimetro_plan.mjs [máx=12] [radioKm=15]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cameraRing } from '../../packages/senda/src/camera-perimeter.mjs';

const MAX = Number(process.argv[2] ?? 12), R = Number(process.argv[3] ?? 15);
const REF = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias');
const inc = JSON.parse(readFileSync(resolve(REF, 'dgt_incidencias.json'), 'utf8')), cams = JSON.parse(readFileSync(resolve(REF, 'dgt_camaras.json'), 'utf8'));
const live = cams.camaras.filter((c) => c.disponible);
const acc = inc.incidencias.filter((i) => i.cause === 'accident' && Number.isFinite(i.lat)).sort((a, b) => String(b.start ?? b.created).localeCompare(String(a.start ?? a.created))).slice(0, MAX);
const plan = { generado: new Date().toISOString(), incidenciasDGT: { publicacion: inc.publicacionDGT, sha256Xml: inc.sha256Xml }, camarasDGT: { publicacion: cams.publicacionDGT, sha256Xml: cams.sha256Xml }, radioKm: R,
  casos: acc.map((a) => { const ring = cameraRing({ lat: a.lat, lon: a.lon }, live, { radiusKm: R, perSector: 1 });
    return { id: a.id, carretera: a.road, inicio: a.start ?? a.created, lat: a.lat, lon: a.lon, cubiertos: ring.covered, ciegos: ring.blind,
      sectores: ring.sectors.map((s) => ({ nombre: s.name, total: s.total, camara: s.cams[0] ? { id: s.cams[0].id, url: s.cams[0].url, carretera: s.cams[0].carretera, destino: s.cams[0].destino, dKm: s.cams[0].dKm, rumbo: s.cams[0].bearing, lat: s.cams[0].lat, lon: s.cams[0].lon } : null })) }; }) };
const D = resolve(REF, '../perimetro'); mkdirSync(D, { recursive: true });
writeFileSync(resolve(D, 'plan.json'), JSON.stringify(plan, null, 1));
const nc = new Set(plan.casos.flatMap((c) => c.sectores.filter((s) => s.camara).map((s) => s.camara.id))).size;
console.log(`Plan: ${plan.casos.length} accidentes actuales · ${nc} cámaras distintas · cobertura media ${(plan.casos.reduce((a, c) => a + c.cubiertos, 0) / Math.max(1, plan.casos.length)).toFixed(1)} de 8 sectores`);

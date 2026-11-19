/**
 * SENDA · Calcula el aislamiento por inundación sobre los datos reales de aislamiento_dana.py y guarda el resumen.
 * Cada fila es un ESCENARIO DECLARADO (regla de corte), no una medida de qué calles estuvieron cortadas.
 * Uso: node scripts/datos-reales/aislamiento_calcular.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeIsolation } from '../../packages/senda/src/flood-isolation.mjs';
const dir = new URL('../../investor-next/public/senda/data/aislamiento/', import.meta.url);
const d = JSON.parse(readFileSync(new URL('dana_horta_sud.json', dir)));
const network = { coords: d.red.coords, ways: d.red.ways.map((w) => ({ nodes: w.n, highway: w.hw, bridge: !!w.br, id: w.id })) };
const escenarios = [
  { id: 'toca', etiqueta: 'Cortado si el tramo toca agua observada', wetThreshold: 0, excludeServicesInWater: true },
  { id: 'mitad', etiqueta: 'Cortado si más de la mitad del tramo está en agua observada', wetThreshold: 0.5, excludeServicesInWater: true },
];
const out = { caso: d.caso, bbox: d.bbox, basis: 'CALCULATED_FROM_OBSERVED_DATA', generadoUTC: new Date().toISOString().slice(0, 19) + 'Z', entradas: { agua: d.agua.producto, imagenes: d.agua.imagenes, red: d.red.fuente, notaRed: d.red.nota, servicios: d.servicios.length, edificios: d.edificios.centroides.length }, escenarios: [] };
for (const e of escenarios) {
  const t = Date.now(), r = analyzeIsolation({ network, waterRings: d.agua.anillos, services: d.servicios, options: { wetThreshold: e.wetThreshold, excludeServicesInWater: e.excludeServicesInWater }, proxyPoints: d.edificios.centroides });
  const porTipo = {}; for (const s of r.services) { const k = s.kind; porTipo[k] ??= { total: 0, enAgua: 0 }; porTipo[k].total++; if (s.inWater) porTipo[k].enAgua++; }
  out.escenarios.push({ ...e, metricas: r.metrics, serviciosPorTipo: porTipo, hipotesis: r.assumptions, ms: Date.now() - t });
  console.log(e.id, JSON.stringify(r.metrics), Date.now() - t, 'ms');
}
writeFileSync(new URL('dana_horta_sud_resultado.json', dir), JSON.stringify(out, null, 1));

#!/usr/bin/env node
/**
 * Descarga real del inventario de cámaras de la DGT (DATEX II v3.7, DevicePublication) del Punto de Acceso Nacional.
 * Guarda posición, carretera, sentido y URL de la imagen en directo de cada cámara (la imagen NO se descarga: la
 * sirve la DGT y se renueva cada pocos minutos). Escribe dgt_camaras.json con URL, hora de publicación y SHA-256.
 * Licencia: Creative Commons Attribution (ficha https://nap.dgt.es/dataset/camaras-dgt-datex2-v3-7, leída el 14-11-2026).
 * Cobertura: carreteras de la DGT (no Cataluña ni País Vasco, que gestionan su tráfico).
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_CAM = 'https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml';
const res = await fetch(URL_CAM); if (!res.ok) throw new Error(`DGT respondió ${res.status}`);
const xml = await res.text();
const pick = (s, tag) => (s.match(new RegExp(`<[a-zA-Z0-9]+:${tag}>([^<]*)</[a-zA-Z0-9]+:${tag}>`)) ?? [])[1] ?? null;
const camaras = [];
for (const blk of xml.split(/<ns2:device\s/).slice(1)) {
  const id = (blk.match(/id="([^"]+)"/) ?? [])[1], type = pick(blk, 'typeOfDevice'); if (type !== 'camera') continue;
  const lat = Number(pick(blk, 'latitude')), lon = Number(pick(blk, 'longitude')), url = pick(blk, 'deviceUrl');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !url) continue;
  camaras.push({ id, lat, lon, carretera: pick(blk, 'roadName'), destino: pick(blk, 'roadDestination'), sentido: pick(blk, 'tpegDirectionRoad'), url, actualizadaFicha: pick(blk, 'lastUpdateOfDeviceInformation') });
}
if (!camaras.length) throw new Error('Sin cámaras: no se escribe nada');
// Disponibilidad en el momento de la descarga: la DGT sirve un aviso «imagen no disponible» de tamaño fijo cuando la
// cámara no emite. Se mide con HEAD (tamaño) y se compara con el aviso de referencia (cámara 768, comprobado a mano).
const head = async (u) => { try { const r = await fetch(u, { method: 'HEAD' }); return r.ok ? Number(r.headers.get('content-length')) : null; } catch { return null; } };
const AVISO = await head('https://etraffic.dgt.es/camarasEtraffic/768.jpg');
for (let i = 0; i < camaras.length; i += 25) await Promise.all(camaras.slice(i, i + 25).map(async (c) => { const n = await head(c.url); c.bytes = n; c.disponible = n == null ? null : n !== AVISO; }));
const disp = camaras.filter((c) => c.disponible === true).length, nodisp = camaras.filter((c) => c.disponible === false).length;
const out = { fuente: 'DGT · Punto de Acceso Nacional (nap.dgt.es), cámaras DATEX II v3.7', licencia: 'Creative Commons Attribution (ficha camaras-dgt-datex2-v3-7 en nap.dgt.es)',
  url: URL_CAM, publicacionDGT: pick(xml, 'publicationTime'), descargadoUTC: new Date().toISOString(), sha256Xml: createHash('sha256').update(xml).digest('hex'), total: camaras.length, disponibilidad: { medidaUTC: new Date().toISOString(), conImagen: disp, conAvisoNoDisponible: nodisp, sinRespuesta: camaras.length - disp - nodisp, tamañoAviso: AVISO, metodo: 'HEAD de cada imagen; tamaño igual al aviso de la DGT = no disponible' },
  nota: 'Inventario real. La imagen de cada cámara es en directo (la sirve la DGT y se renueva cada pocos minutos); no es del momento de incidencias pasadas.', camaras };
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias/dgt_camaras.json');
await writeFile(dst, JSON.stringify(out) + '\n');
console.log(`DGT cámaras: ${camaras.length} · con imagen ${disp} · aviso no disponible ${nodisp} · sin respuesta ${camaras.length - disp - nodisp} → ${dst}`);

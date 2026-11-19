#!/usr/bin/env node
/**
 * Reproducible ingest of OBSERVED wildfire perimeter progressions.
 * Source: USGS GeoMAC historic perimeters 2018, served by NIFC Open Data (ArcGIS FeatureServer).
 * Output: one compact JSON snapshot per incident in ../data, with provenance and SHA-256.
 *
 * The snapshot is an OBSERVATION dataset. It contains no node, radio or delivery data.
 * Geometry is simplified server-side (maxAllowableOffset) — see `resolution` in each file.
 */
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LAYER = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Historic_Geomac_Perimeters_2018/FeatureServer/0';
const INCIDENTS = [
  { key: 'camp', where: "uniquefireidentifier='2018-CABTU-016737'" },
  { key: 'carr', where: "incidentname='CARR' AND state='CA'" },
  { key: 'woolsey', where: "incidentname='WOOLSEY' AND state='CA'" },
];
const OFFSET_DEG = 0.002; // ≈ 200 m simplification tolerance
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(a) / 2;
};

async function fetchIncident({ key, where }) {
  const params = new URLSearchParams({
    where, outFields: 'incidentname,uniquefireidentifier,perimeterdatetime,gisacres',
    returnGeometry: 'true', outSR: '4326', geometryPrecision: '4', maxAllowableOffset: String(OFFSET_DEG),
    orderByFields: 'perimeterdatetime', f: 'json',
  });
  const url = `${LAYER}/query?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.features) || !json.features.length) throw new Error(`${key}: no features`);
  const perimeters = json.features
    .filter((f) => Number.isFinite(f.attributes.perimeterdatetime) && f.geometry?.rings?.length)
    .map((f) => ({
      t: new Date(f.attributes.perimeterdatetime).toISOString(),
      acres: Math.round(f.attributes.gisacres),
      // keep rings above ~0.5 km² in degree² units; drops slivers and tiny spot polygons
      rings: f.geometry.rings.filter((r) => r.length >= 4 && ringArea(r) > 5e-5),
    }))
    .filter((p) => p.rings.length);
  const body = {
    schema: 'senda-arr/observed-perimeters/v1',
    dataClass: 'OBSERVED',
    incident: json.features[0].attributes.incidentname,
    uniqueFireIdentifier: json.features[0].attributes.uniquefireidentifier,
    provenance: {
      publisher: 'USGS GeoMAC (historic perimeters 2018), distributed by NIFC Open Data',
      layer: LAYER, query: where,
      licenceNote: 'U.S. Government work; layer metadata carries no copyright text. Re-verify NIFC Open Data terms before redistribution.',
      retrievedAt: new Date().toISOString(),
      crs: 'EPSG:4326 (lon, lat)',
      resolution: `server-side simplification maxAllowableOffset=${OFFSET_DEG}° (≈200 m); 4 decimals; rings < 5e-5 deg² dropped`,
      temporalResolution: 'irregular; one perimeter per mapping flight/update (hours to days apart)',
      caveats: [
        'perimeterdatetime is reported as published by the source; time-zone handling in the source is not independently verified',
        'successive perimeters are not guaranteed to be nested; consumers must take the cumulative union',
      ],
    },
    perimeters,
  };
  const text = JSON.stringify(body);
  const sha256 = createHash('sha256').update(JSON.stringify(perimeters)).digest('hex');
  await writeFile(path.join(outDir, `geomac-2018-${key}.json`), JSON.stringify({ ...body, perimetersSha256: sha256 }));
  return { key, n: perimeters.length, bytes: text.length, sha256 };
}

await mkdir(outDir, { recursive: true });
for (const inc of INCIDENTS) console.log(await fetchIncident(inc));

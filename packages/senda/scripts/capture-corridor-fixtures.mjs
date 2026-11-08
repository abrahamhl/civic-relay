#!/usr/bin/env node
/**
 * Captura reproducible de fixtures reales desde fuentes abiertas autorizadas:
 *   1. NDW Open Data (https://opendata.ndw.nu/actueel_beeld.xml.gz) — DATEX II v3 (incidencias A12 Arnhem–Ede)
 *   2. NDW Open Data (https://opendata.ndw.nu/trafficspeed.xml.gz) — DATEX II v2.3 MONIBAS (velocidades/flujos A12 hm 110–130)
 *   3. DGT NAP (https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml) — DATEX II v3.6 España
 *
 * Guarda los extractos auténticos sin inventar estaciones, coordenadas ni mediciones,
 * registrando fecha UTC, cabeceras HTTP y hashes SHA-256 del payload completo y del recorte.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../../../evidence/senda/corridor-fabric/fixtures');

function sha256(bufOrStr) {
  return createHash('sha256').update(bufOrStr).digest('hex');
}

async function fetchBufferWithMeta(url) {
  const startedAt = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SENDA-Corridor-Fabric/1.0 (civic-relay; research-open-data)' },
    signal: AbortSignal.timeout(25000),
  });
  const arrayBuffer = await res.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);
  const latencyMs = Date.now() - startedAt;
  return {
    url,
    status: res.status,
    contentType: res.headers.get('content-type'),
    lastModified: res.headers.get('last-modified'),
    latencyMs,
    rawBytes: rawBuffer.length,
    rawSha256: sha256(rawBuffer),
    rawBuffer,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const capturedAtUtc = new Date().toISOString();

  // 1. NDW actueel_beeld.xml.gz (DATEX II v3 situations)
  const ndwSituationsMeta = await fetchBufferWithMeta('https://opendata.ndw.nu/actueel_beeld.xml.gz');
  const ndwSituationsXml = gunzipSync(ndwSituationsMeta.rawBuffer).toString('utf8');
  const ndwSituationsUncompressedSha256 = sha256(ndwSituationsXml);

  const pubTimeMatch = ndwSituationsXml.match(/<com:publicationTime>([^<]+)<\/com:publicationTime>/);
  const ndwPubTime = pubTimeMatch ? pubTimeMatch[1] : capturedAtUtc;
  const allNdwSituations = [...ndwSituationsXml.matchAll(/<sit:situation\b[\s\S]*?<\/sit:situation>/g)].map((m) => m[0]);
  const a12Situations = allNdwSituations.filter((s) => {
    const lat = parseFloat((s.match(/<loc:latitude>([\d.-]+)<\/loc:latitude>/) || [])[1]);
    const lon = parseFloat((s.match(/<loc:longitude>([\d.-]+)<\/loc:longitude>/) || [])[1]);
    return (lat >= 51.94 && lat <= 52.08 && lon >= 5.55 && lon <= 6.08) || /<loc:roadName>A12<\/loc:roadName>/i.test(s);
  });

  const ndwSrtiSliceXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<mc:messageContainer xmlns:sit="http://datex2.eu/schema/3/situation" xmlns:mc="http://datex2.eu/schema/3/messageContainer" xmlns:nlxe="http://datex2.eu/schema/3/nlxExtensions" xmlns:inf="http://datex2.eu/schema/3/informationManagement" xmlns:nle="http://datex2.eu/schema/3/nlExtensions" xmlns:ex="http://datex2.eu/schema/3/exchangeInformation" xmlns:loc="http://datex2.eu/schema/3/locationReferencing" xmlns:com="http://datex2.eu/schema/3/common" xmlns:srx="http://datex2.eu/schema/3/situationRecordExtension" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" modelBaseVersion="3">',
    '  <mc:payload xsi:type="sit:SituationPublication" lang="nl" modelBaseVersion="3">',
    `    <com:publicationTime>${ndwPubTime}</com:publicationTime>`,
    '    <com:publicationCreator><com:country>nl</com:country><com:nationalIdentifier>NDWNL</com:nationalIdentifier></com:publicationCreator>',
    ...a12Situations.slice(0, 10).map((s) => `    ${s}`),
    '  </mc:payload>',
    '</mc:messageContainer>',
    '',
  ].join('\n');

  const ndwSrtiPath = resolve(OUT_DIR, 'ndw-a12-srti-v3.xml');
  writeFileSync(ndwSrtiPath, ndwSrtiSliceXml, 'utf8');

  // 2. NDW trafficspeed.xml.gz (DATEX II v2 MONIBAS A12 Arnhem-Ede hm 110.0 - 130.0)
  const ndwSpeedMeta = await fetchBufferWithMeta('https://opendata.ndw.nu/trafficspeed.xml.gz');
  const ndwSpeedXml = gunzipSync(ndwSpeedMeta.rawBuffer).toString('utf8');
  const ndwSpeedUncompressedSha256 = sha256(ndwSpeedXml);

  const speedPubMatch = ndwSpeedXml.match(/<publicationTime>([^<]+)<\/publicationTime>/);
  const speedPubTime = speedPubMatch ? speedPubMatch[1] : capturedAtUtc;
  const a12Measurements = [...ndwSpeedXml.matchAll(/<siteMeasurements\b[\s\S]*?<\/siteMeasurements>/g)]
    .map((m) => m[0])
    .filter((block) => {
      const idMatch = block.match(/id="(RWS01_MONIBAS_0121hr[rl](\d{4})[^"]*)"/i);
      if (!idMatch) return false;
      const hm = Number(idMatch[2]); // e.g., 1120 = hm 112.0 (Ede) to 1300 = hm 130.0 (Arnhem/Velperbroek)
      return hm >= 1100 && hm <= 1310;
    });

  const ndwMonibasSliceXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">',
    '  <SOAP:Body>',
    '    <d2LogicalModel xmlns="http://datex2.eu/schema/2/2_0" modelBaseVersion="2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '      <exchange><supplierIdentification><country>nl</country><nationalIdentifier>NLNDW</nationalIdentifier></supplierIdentification></exchange>',
    '      <payloadPublication xsi:type="MeasuredDataPublication" lang="nl">',
    `        <publicationTime>${speedPubTime}</publicationTime>`,
    '        <publicationCreator><country>nl</country><nationalIdentifier>NLNDW</nationalIdentifier></publicationCreator>',
    '        <measurementSiteTableReference targetClass="MeasurementSiteTable" id="NDW01_MT" version="1"/>',
    '        <headerInformation><confidentiality>noRestriction</confidentiality><informationStatus>real</informationStatus></headerInformation>',
    ...a12Measurements.slice(0, 14).map((m) => `        ${m}`),
    '      </payloadPublication>',
    '    </d2LogicalModel>',
    '  </SOAP:Body>',
    '</SOAP:Envelope>',
    '',
  ].join('\n');

  const ndwMonibasPath = resolve(OUT_DIR, 'ndw-a12-monibas-v2.xml');
  writeFileSync(ndwMonibasPath, ndwMonibasSliceXml, 'utf8');

  // 3. DGT NAP SituationPublication v3.6 (Spain)
  const dgtMeta = await fetchBufferWithMeta('https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml');
  const dgtXml = dgtMeta.rawBuffer.toString('utf8');
  const dgtPubMatch = dgtXml.match(/<(?:[\w]+:)?publicationTime>([^<]+)<\/(?:[\w]+:)?publicationTime>/);
  const dgtPubTime = dgtPubMatch ? dgtPubMatch[1] : capturedAtUtc;
  const allDgtSituations = [...dgtXml.matchAll(/<sit:situation\b[\s\S]*?<\/sit:situation>/g)].map((m) => m[0]);
  const selectedDgtSituations = allDgtSituations
    .filter((s) => /N-403|AV-|M-501|A-3|V-31|Ávila|Avila|Madrid|Valencia/i.test(s))
    .slice(0, 6);
  const fallbackDgtSituations = selectedDgtSituations.length > 0 ? selectedDgtSituations : allDgtSituations.slice(0, 6);

  const dgtHeaderEnd = dgtXml.indexOf('<sit:situation');
  const dgtHeader = dgtHeaderEnd > 0
    ? dgtXml.slice(0, dgtHeaderEnd).trim()
    : '<?xml version="1.0" encoding="UTF-8"?><d2:payload xmlns:d2="http://datex2.eu/schema/3/d2Payload" xmlns:sit="http://datex2.eu/schema/3/situation" xmlns:com="http://datex2.eu/schema/3/common" xmlns:loc="http://datex2.eu/schema/3/locationReferencing" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="sit:SituationPublication" lang="es" modelBaseVersion="3">';
  const dgtFooter = dgtXml.includes('</d2:payload>') ? '</d2:payload>' : '</mc:payload></mc:messageContainer>';

  const dgtSliceXml = [
    dgtHeader,
    ...fallbackDgtSituations.map((s) => `  ${s}`),
    dgtFooter,
    '',
  ].join('\n');

  const dgtSlicePath = resolve(OUT_DIR, 'dgt-nap-v36-slice.xml');
  writeFileSync(dgtSlicePath, dgtSliceXml, 'utf8');

  const provenance = {
    schema: 'senda.corridor-fixtures-provenance/1.0',
    capturedAtUtc,
    sources: {
      ndwSituationsV3: {
        upstreamUrl: ndwSituationsMeta.url,
        httpStatus: ndwSituationsMeta.status,
        contentType: ndwSituationsMeta.contentType,
        lastModified: ndwSituationsMeta.lastModified,
        latencyMs: ndwSituationsMeta.latencyMs,
        publicationTimeUtc: ndwPubTime,
        compressedBytes: ndwSituationsMeta.rawBytes,
        compressedSha256: ndwSituationsMeta.rawSha256,
        uncompressedBytes: Buffer.byteLength(ndwSituationsXml, 'utf8'),
        uncompressedSha256: ndwSituationsUncompressedSha256,
        totalSituationsInFeed: allNdwSituations.length,
        matchedA12ArnhemEdeSituations: a12Situations.length,
        fixtureFile: 'ndw-a12-srti-v3.xml',
        fixtureBytes: Buffer.byteLength(ndwSrtiSliceXml, 'utf8'),
        fixtureSha256: sha256(ndwSrtiSliceXml),
        license: 'CC0-1.0 / NDW Open Data Standard',
      },
      ndwMonibasSpeedV2: {
        upstreamUrl: ndwSpeedMeta.url,
        httpStatus: ndwSpeedMeta.status,
        contentType: ndwSpeedMeta.contentType,
        lastModified: ndwSpeedMeta.lastModified,
        latencyMs: ndwSpeedMeta.latencyMs,
        publicationTimeUtc: speedPubTime,
        compressedBytes: ndwSpeedMeta.rawBytes,
        compressedSha256: ndwSpeedMeta.rawSha256,
        uncompressedBytes: Buffer.byteLength(ndwSpeedXml, 'utf8'),
        uncompressedSha256: ndwSpeedUncompressedSha256,
        matchedA12Hm110To131Stations: a12Measurements.length,
        fixtureFile: 'ndw-a12-monibas-v2.xml',
        fixtureBytes: Buffer.byteLength(ndwMonibasSliceXml, 'utf8'),
        fixtureSha256: sha256(ndwMonibasSliceXml),
        datexMigrationNote: 'NDW maintains DATEX II v2.3 on trafficspeed.xml.gz and DATEX II v3 on snelheden_en_intensiteiten_meetgegevens.xml.gz ahead of the February 2027 v2 sunset.',
        license: 'CC0-1.0 / NDW Open Data Standard',
      },
      dgtNapSituationV36: {
        upstreamUrl: dgtMeta.url,
        httpStatus: dgtMeta.status,
        contentType: dgtMeta.contentType,
        lastModified: dgtMeta.lastModified,
        latencyMs: dgtMeta.latencyMs,
        publicationTimeUtc: dgtPubTime,
        rawBytes: dgtMeta.rawBytes,
        rawSha256: dgtMeta.rawSha256,
        totalSituationsInFeed: allDgtSituations.length,
        includedInFixture: fallbackDgtSituations.length,
        fixtureFile: 'dgt-nap-v36-slice.xml',
        fixtureBytes: Buffer.byteLength(dgtSliceXml, 'utf8'),
        fixtureSha256: sha256(dgtSliceXml),
        license: 'DGT NAP Reutilización Información Sector Público (Ley 37/2007)',
      },
    },
  };

  const provPath = resolve(OUT_DIR, 'fixtures-provenance.json');
  writeFileSync(provPath, JSON.stringify(provenance, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(provenance, null, 2));
}

main().catch((err) => {
  console.error('Error capturing corridor fixtures:', err);
  process.exit(1);
});

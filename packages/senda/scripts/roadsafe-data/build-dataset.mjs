#!/usr/bin/env node
/**
 * SENDA RoadSafe · Descarga y construcción reproducible del dataset armonizado de accidentes.
 *
 *   node packages/senda/scripts/roadsafe-data/build-dataset.mjs [--year 2024] [--cache DIR] [--no-fetch]
 *
 * - Descarga los ficheros OFICIALES a una caché local (por defecto .cache/roadsafe-data, ignorada por git).
 * - Registra URL, tamaño y SHA-256 de cada fichero bruto (procedencia verificable).
 * - Armoniza al esquema senda-road-accident/1 → caché/harmonized-YYYY.ndjson (no se versiona).
 * - Escribe al repositorio SOLO agregados y estadísticos: evidence/roadsafe/dataset/*.json y DATASET_REPORT.md.
 * Bélgica (Statbel) no se descarga: el portal exige captcha. Si se coloca a mano un fichero en
 * caché/be/*.csv, se intenta con el mapeo NO VERIFICADO y se informa del fallo si no coincide.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, fromDgt, fromUnfallatlas, fromBron, fromStatbel, fromBaac, fromStats19, validateRecord, SOURCES } from '../../src/roadsafe-dataset.mjs';
import { fitSeverityModel, leaveOneCountryOut } from '../../src/roadsafe-severity-model.mjs';
import { aadfLink, splitCsvLine, assignToLinks, rateEB, ratesByCategory } from '../../src/roadsafe-exposure.mjs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { roadsafeProfile, empiricalSeverityFactors, hotspotsEB, gridCell, roadKmCell, conditionalShare, injuryOnly, stoppedVehicleStudy } from '../../src/roadsafe-dataset-analysis.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../../..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const YEAR = +arg('year', 2024), YY = String(YEAR).slice(2), CACHE = resolve(root, arg('cache', '.cache/roadsafe-data')), FETCH = !process.argv.includes('--no-fetch');
const OUT = resolve(root, 'evidence/roadsafe/dataset');
mkdirSync(CACHE, { recursive: true }); mkdirSync(OUT, { recursive: true });

const RAW = {
  ES_DGT: { file: `es-${YEAR}.xlsx`, url: `https://www.dgt.es/export/sites/web-DGT/.galleries/downloads/dgt-en-cifras/publicaciones/Ficheros_microdatos_de_accidentalidad_con_victimas/TABLA_ACCIDENTES_${YY}.XLSX` },
  ES_DGT_DICT: { file: 'es-dictionary.xlsx', url: 'https://www.dgt.es/export/sites/web-DGT/.galleries/downloads/dgt-en-cifras/24h/Diccionario_Tabla_Accidentes.xlsx' },
  DE_UNFALLATLAS: { file: `de-${YEAR}.zip`, url: `https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/Unfallorte${YEAR}_EPSG25832_CSV.zip` },
  DE_DSB: { file: 'de-DSB_Unfallatlas.pdf', url: 'https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/DSB_Unfallatlas.pdf' },
  FR_CARACT: { file: `fr-caract-${YEAR}.csv`, url: null }, FR_LIEUX: { file: `fr-lieux-${YEAR}.csv`, url: null }, FR_VEHICULES: { file: `fr-vehicules-${YEAR}.csv`, url: null }, FR_USAGERS: { file: `fr-usagers-${YEAR}.csv`, url: null },
  FR_DICT: { file: 'fr-description-bases.pdf', url: 'https://www.onisr.securite-routiere.gouv.fr/sites/default/files/2024-10/Description%20des%20bases%20de%20donn%C3%A9es%20annuelles.pdf' },
  UK_COLLISION: { file: `uk-collision-${YEAR}.csv`, url: `https://data.dft.gov.uk/road-accidents-safety-data/dft-road-casualty-statistics-collision-${YEAR}.csv` },
  UK_VEHICLE: { file: `uk-vehicle-${YEAR}.csv`, url: `https://data.dft.gov.uk/road-accidents-safety-data/dft-road-casualty-statistics-vehicle-${YEAR}.csv` },
  UK_AADF: { file: 'uk-aadf.zip', url: 'https://storage.googleapis.com/dft-statistics/road-traffic/downloads/data-gov-uk/dft_traffic_counts_aadf.zip' },
  NL_BRON: { file: `nl-${YEAR}.csv`, url: `https://geo.rijkswaterstaat.nl/services/ogc/gdr/verkeersongevallen_nederland/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=ongevallen_${YEAR}&outputFormat=csv` },
};
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

async function download(url, dst) {
  const res = await fetch(url, { headers: { 'user-agent': 'senda-roadsafe-dataset/1 (open data research)' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (/<html|TSPD|captcha/i.test(buf.subarray(0, 600).toString('latin1'))) throw new Error(`${url} devolvió una página HTML/antibots, no datos`);
  writeFileSync(dst, buf); return buf.length;
}

// Las URL de BAAC cambian con cada publicación: se resuelven con la API de data.gouv.fr (conjunto 53698f4ca3a729239d2036df).
if (FETCH) {
  try {
    const d = await (await fetch('https://www.data.gouv.fr/api/1/datasets/53698f4ca3a729239d2036df/')).json();
    const find = (re) => d.resources.find((r) => re.test(r.title))?.url ?? null;
    RAW.FR_CARACT.url = find(new RegExp(`^Caract_${YEAR}\\.csv$`, 'i')) ?? find(new RegExp(`caract-${YEAR}`, 'i'));
    RAW.FR_LIEUX.url = find(new RegExp(`^Lieux_${YEAR}\\.csv$`, 'i')) ?? find(new RegExp(`lieux-${YEAR}`, 'i'));
    RAW.FR_VEHICULES.url = find(new RegExp(`^Vehicules_${YEAR}\\.csv$`, 'i')) ?? find(new RegExp(`^vehicules-${YEAR}`, 'i'));
    RAW.FR_USAGERS.url = find(new RegExp(`^Usagers_${YEAR}\\.csv$`, 'i')) ?? find(new RegExp(`usagers-${YEAR}`, 'i'));
  } catch (e) { console.warn('data.gouv.fr API:', e.message); }
}
const manifest = { schema: 'senda-roadsafe-dataset-manifest/1', year: YEAR, builtAt: new Date().toISOString(), sources: {}, blocked: { BE_STATBEL: SOURCES.BE_STATBEL.blocked } };
for (const [id, r] of Object.entries(RAW)) {
  const p = join(CACHE, r.file);
  try {
    if (!existsSync(p)) { if (!FETCH) throw new Error('no está en caché y --no-fetch'); if (!r.url) throw new Error('URL no resuelta'); console.log(`↓ ${id}`); await download(r.url, p); }
    manifest.sources[id] = { url: r.url, file: r.file, bytes: readFileSync(p).length, sha256: sha(p) };
  } catch (e) { manifest.sources[id] = { url: r.url, error: String(e.message) }; console.warn(`✗ ${id}: ${e.message}`); }
}

// --- lectura y armonización
const records = [], stats = {};
function ingest(id, rows, mapper) {
  let ok = 0, bad = 0; const errs = {};
  for (const row of rows) { let o; try { o = mapper(row); } catch (e) { bad++; errs[e.message] = (errs[e.message] ?? 0) + 1; continue; } const v = validateRecord(o); if (v.valid) { records.push(o); ok++; } else { bad++; for (const e of v.errors) errs[e] = (errs[e] ?? 0) + 1; } }
  stats[id] = { rows: rows.length, harmonized: ok, rejected: bad, rejectReasons: errs };
  console.log(`✓ ${id}: ${ok}/${rows.length}`);
}
// ES: XLSX → CSV con el conversor Python (openpyxl)
if (manifest.sources.ES_DGT?.sha256) {
  const csvPath = join(CACHE, `es-${YEAR}.csv`);
  try {
    if (!existsSync(csvPath)) execFileSync('python3', ['-I', resolve(here, 'dgt_xlsx_to_csv.py'), join(CACHE, RAW.ES_DGT.file), csvPath], { stdio: 'inherit' });
    ingest('ES_DGT', parseCsv(readFileSync(csvPath, 'utf8'), { sep: ';' }), fromDgt);
  } catch (e) { stats.ES_DGT = { error: `conversión XLSX: ${e.message} (requiere python3 + openpyxl)` }; }
}
if (manifest.sources.DE_UNFALLATLAS?.sha256) {
  const dir = join(CACHE, `de-${YEAR}`);
  if (!existsSync(dir)) execFileSync('python3', ['-I', '-c', 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', join(CACHE, RAW.DE_UNFALLATLAS.file), dir]);
  const find = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? find(join(d, e.name)) : e.name.toLowerCase().endsWith('.csv') ? [join(d, e.name)] : []));
  const f = find(dir)[0];
  ingest('DE_UNFALLATLAS', parseCsv(readFileSync(f, 'utf8'), { sep: ';' }), fromUnfallatlas);
}
if (manifest.sources.NL_BRON?.sha256) ingest('NL_BRON', parseCsv(readFileSync(join(CACHE, RAW.NL_BRON.file), 'utf8'), { sep: ',' }), fromBron);
// FR: unión por Num_Acc de los 4 ficheros
if (['FR_CARACT', 'FR_LIEUX', 'FR_VEHICULES', 'FR_USAGERS'].every((k) => manifest.sources[k]?.sha256)) {
  const rd = (k) => parseCsv(readFileSync(join(CACHE, RAW[k].file), 'utf8'), { sep: ';' });
  const group = (rows) => { const m = new Map(); for (const r of rows) { const a = m.get(r.Num_Acc) ?? []; a.push(r); m.set(r.Num_Acc, a); } return m; };
  const L = group(rd('FR_LIEUX')), V = group(rd('FR_VEHICULES')), U = group(rd('FR_USAGERS'));
  ingest('FR_BAAC', rd('FR_CARACT'), (c) => fromBaac(c, (L.get(c.Num_Acc) ?? [])[0], V.get(c.Num_Acc) ?? [], U.get(c.Num_Acc) ?? []));
}
// GB: colisión + vehículos por collision_index
if (manifest.sources.UK_COLLISION?.sha256 && manifest.sources.UK_VEHICLE?.sha256) {
  const V = new Map(); for (const v of parseCsv(readFileSync(join(CACHE, RAW.UK_VEHICLE.file), 'utf8'), { sep: ',' })) { const a = V.get(v.collision_index) ?? []; a.push(v); V.set(v.collision_index, a); }
  ingest('UK_STATS19', parseCsv(readFileSync(join(CACHE, RAW.UK_COLLISION.file), 'utf8'), { sep: ',' }), (c) => fromStats19(c, V.get(c.collision_index) ?? []));
}
const beDir = join(CACHE, 'be');
if (existsSync(beDir)) for (const f of readdirSync(beDir).filter((x) => x.endsWith('.csv') || x.endsWith('.txt'))) ingest(`BE_STATBEL:${f}`, parseCsv(readFileSync(join(beDir, f), 'utf8')), fromStatbel);
else stats.BE_STATBEL = { skipped: 'sin fichero manual (portal con captcha)' };

// --- salida armonizada (caché, no versionada)
const nd = createWriteStream(join(CACHE, `harmonized-${YEAR}.ndjson`));
for (const r of records) nd.write(JSON.stringify(r) + '\n');
nd.end();

// --- agregados al repositorio
const by = (c) => records.filter((r) => r.country === c);
const countries = [...new Set(records.map((r) => r.country))];
const perCountry = Object.fromEntries(countries.map((c) => {
  const R = by(c);
  return [c, {
    records: R.length, injury: R.filter(injuryOnly).length,
    profile: roadsafeProfile(R), severityFactors: empiricalSeverityFactors(R), stoppedStudy: stoppedVehicleStudy(R),
    lightByCollision: conditionalShare(R.filter(injuryOnly), (r) => `${r.collision}·${r.light}`, (r) => r.severity === 'FATAL', { minN: 200 }).slice(0, 25),
    hotspots: c === 'ES' ? hotspotsEB(R.filter((r) => r.area === 'RURAL'), roadKmCell(1), { top: 25 }) : hotspotsEB(R, gridCell(0.01), { top: 25 }),
    hotspotsRearStationary: c === 'ES' ? hotspotsEB(R.filter((r) => ['REAR_END', 'MULTI_VEHICLE_CHAIN'].includes(r.collision) && r.area === 'RURAL'), roadKmCell(2), { top: 15 }) : hotspotsEB(R.filter((r) => ['REAR_END', 'STATIONARY_VEHICLE'].includes(r.collision)), gridCell(0.02), { top: 15 }),
  }];
}));
writeFileSync(join(OUT, `manifest-${YEAR}.json`), JSON.stringify({ ...manifest, ingest: stats, totalHarmonized: records.length }, null, 2));
writeFileSync(join(OUT, `aggregates-${YEAR}.json`), JSON.stringify({ schema: 'senda-roadsafe-aggregates/1', year: YEAR, licenses: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, { license: v.license, publisher: v.publisher, url: v.url }])), perCountry }, null, 2));

// --- modelo de gravedad ajustado (regresión logística multivariante) + validación
const sev = fitSeverityModel(records, { l2: 1, seed: 2026 }), loco = leaveOneCountryOut(records, { l2: 1 });
writeFileSync(join(OUT, `severity-model-${YEAR}.json`), JSON.stringify({ ...sev, leaveOneCountryOut: loco }, null, 2));

// --- exposición GB: AADF por tramo (DfT, OGL v3) → tasas por 100 M veh-km
let exposure = null;
if (manifest.sources.UK_AADF?.sha256) {
  const dir = join(CACHE, 'uk-aadf');
  if (!existsSync(dir)) execFileSync('python3', ['-I', '-c', 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', join(CACHE, RAW.UK_AADF.file), dir]);
  const csv = join(dir, readdirSync(dir).find((f) => f.endsWith('.csv')));
  const links = []; let head = null;
  for await (const line of createInterface({ input: createReadStream(csv), crlfDelay: Infinity })) {
    if (!head) { head = splitCsvLine(line.replace(/^\uFEFF/, '')); continue; }
    const v = splitCsvLine(line); if (v[1] !== String(YEAR)) continue;
    const l = aadfLink(Object.fromEntries(head.map((h, i) => [h, v[i]]))); if (l) links.push(l);
  }
  const gb = records.filter((r) => r.country === 'GB');
  const asg = assignToLinks(gb, links, { slackKm: 1 });
  exposure = { schema: 'senda-roadsafe-exposure/1', basis: 'CALCULATED — AADF DfT (OGL v3) × STATS19; tramos «Major» con longitud', year: YEAR, linksWithCounts: links.length, gbRecords: gb.length, assigned: asg.assigned, unassigned: asg.unassigned, noRoad: asg.noRoad, slackKm: 1,
    byCategory: ratesByCategory(links, asg), ebInjury: rateEB(asg.perLink, { countKey: 'n', minExposure100M: 0.5 }), ebKsi: rateEB(asg.perLink, { countKey: 'ksi', minExposure100M: 0.5 }), ebHardShoulder: rateEB(asg.perLink.filter((a) => a.link.category === 'TM' || a.link.road.startsWith('M')), { countKey: 'hardShoulder', minExposure100M: 0.5 }) };
  writeFileSync(join(OUT, `exposure-gb-${YEAR}.json`), JSON.stringify(exposure, null, 2));
}

// --- resumen compacto para la consola web (sin microdatos)
const webDir = resolve(root, 'investor-next/public/senda/data'); mkdirSync(webDir, { recursive: true });
writeFileSync(join(webDir, `roadsafe-severity-model-${YEAR}.json`), JSON.stringify({ schema: sev.schema, basis: sev.basis, year: YEAR, model: sev.model, test: { auc: sev.test.auc, brier: sev.test.brier, baseRate: sev.test.baseRate }, coefficients: sev.coefficients, leaveOneCountryOut: loco.rows }));
if (exposure) writeFileSync(join(webDir, `roadsafe-exposure-gb-${YEAR}.json`), JSON.stringify({ schema: exposure.schema, basis: exposure.basis, year: YEAR, assigned: exposure.assigned, unassigned: exposure.unassigned, noRoad: exposure.noRoad, byCategory: exposure.byCategory, meanRate: exposure.ebInjury.meanRatePer100MvehKm, top: exposure.ebInjury.top.slice(0, 10) }));
writeFileSync(join(webDir, `roadsafe-dataset-summary-${YEAR}.json`), JSON.stringify({ schema: 'senda-roadsafe-dataset-summary/1', year: YEAR, total: records.length, perCountry: Object.fromEntries(Object.entries(perCountry).map(([c, v]) => [c, { records: v.records, injury: v.injury, profile: { rearEnd: v.profile.rearEnd, stationaryVehicle: v.profile.stationaryVehicle, chain: v.profile.chain, visibilityRestrictedByVehicle: v.profile.visibilityRestrictedByVehicle, secondaryOtherAccident: v.profile.secondaryOtherAccident }, stoppedStudy: Object.fromEntries(['stoppedVehicle', 'hardShoulder', 'rearImpact'].map((k) => [k, v.stoppedStudy[k].available ? { n: v.stoppedStudy[k].n, k: v.stoppedStudy[k].k, share: v.stoppedStudy[k].share, fatalShareWhenTrue: v.stoppedStudy[k].fatalShareWhenTrue, orFatalVsRest: { or: v.stoppedStudy[k].orFatalVsRest.or, ci: v.stoppedStudy[k].orFatalVsRest.ci, significant: v.stoppedStudy[k].orFatalVsRest.significant }, orFatalDarkWithinFlag: { or: v.stoppedStudy[k].orFatalDarkWithinFlag.or, ci: v.stoppedStudy[k].orFatalDarkWithinFlag.ci, n: v.stoppedStudy[k].orFatalDarkWithinFlag.n, significant: v.stoppedStudy[k].orFatalDarkWithinFlag.significant }, highSpeedShare: v.stoppedStudy[k].highSpeedShare } : { available: false }])), severityFactors: Object.fromEntries(Object.entries(v.severityFactors).filter(([, o]) => o && o.or).map(([k, o]) => [k, { or: o.or, ci: o.ci, n: o.n, significant: o.significant }])), hotspotsTop: v.hotspots.top.slice(0, 10), hotspotsRearTop: v.hotspotsRearStationary.top.slice(0, 10) }])), licenses: Object.fromEntries(Object.entries(SOURCES).map(([k, x]) => [k, x.license])) }));

// --- informe
const L = [`# Dataset armonizado de accidentes ${YEAR} · informe automático`, '', `Generado por \`packages/senda/scripts/roadsafe-data/build-dataset.mjs\`. Registros armonizados: **${records.length}**.`, '', '> Datos de accidentes ocurridos: las proporciones son **gravedad condicionada** (sin exposición), no riesgo de accidentarse. Definiciones de gravedad y cobertura difieren entre países.', '', '## Fuentes y procedencia', '', '| Fuente | Ficheros | SHA-256 (12) | Ingesta |', '|---|---|---|---|'];
for (const [id, s] of Object.entries(manifest.sources)) L.push(`| ${id} | ${s.file ?? '—'} (${s.bytes ?? 0} B) | ${s.sha256?.slice(0, 12) ?? s.error} | ${stats[id] ? `${stats[id].harmonized ?? 0}/${stats[id].rows ?? 0}${stats[id].error ? ' · ' + stats[id].error : ''}` : '—'} |`);
L.push(`| BE_STATBEL | — | — | ${stats.BE_STATBEL?.skipped ?? 'ver manifest'} |`, '');
L.push('## Perfil RoadSafe por país (accidentes con víctimas)', '', '| País | Con víctimas | Alcance | Vehículo detenido | Cadena | Visibilidad tapada por vehículo | «Otro accidente» (secundario declarado) |', '|---|---|---|---|---|---|---|');
for (const [c, v] of Object.entries(perCountry)) { const p = v.profile; const f = (x) => `${(x.p * 100).toFixed(1)} % (${x.k})`; L.push(`| ${c} | ${v.injury} | ${f(p.rearEnd)} | ${f(p.stationaryVehicle)} | ${f(p.chain)} | ${f(p.visibilityRestrictedByVehicle)} | ${p.secondaryOtherAccident.k} |`); }
L.push('', '## Factores de gravedad (OR de mortal entre accidentes con víctimas, IC 95 %)', '', '| País | Oscuridad vs día | Sin alumbrado vs alumbrado | Mojado vs seco | Niebla vs despejado | Alcance/detenido vs otros | Interurbano vs urbano | Curva vs recta |', '|---|---|---|---|---|---|---|---|');
const orf = (o) => (o.n ? `${o.or} [${o.ci.join('–')}]${o.significant ? ' *' : ''}` : '—');
for (const [c, v] of Object.entries(perCountry)) { const s = v.severityFactors; L.push(`| ${c} | ${orf(s.darkVsDay)} | ${orf(s.darkUnlitVsLit)} | ${orf(s.wetVsDry)} | ${orf(s.fogVsClear)} | ${orf(s.rearEndOrStationaryVsOther)} | ${orf(s.ruralVsUrban)} | ${orf(s.curveVsStraight)} |`); }
L.push('', '## Vehículo detenido y arcén (caso de investigación)', '', '| País | Bandera | n con dato | Con la condición | % mortal si la tiene | OR mortal vs resto | OR mortal oscuridad dentro | % en vía rápida |', '|---|---|---|---|---|---|---|---|');
for (const [c, v] of Object.entries(perCountry)) for (const k of ['stoppedVehicle', 'hardShoulder', 'rearImpact']) { const b = v.stoppedStudy[k]; if (!b.available) continue; L.push(`| ${c} | ${k} | ${b.n} | ${b.k} (${(b.share.p * 100).toFixed(2)} %) | ${b.fatalShareWhenTrue ? (b.fatalShareWhenTrue.p * 100).toFixed(2) + ' %' : '—'} | ${orf(b.orFatalVsRest)} | ${orf(b.orFatalDarkWithinFlag)} | ${b.highSpeedShare == null ? '—' : (b.highSpeedShare * 100).toFixed(0) + ' %'} |`); }
L.push('', '`*` = IC 95 % no incluye 1. OR > 1: mayor proporción de mortales entre los accidentes con víctimas en esa condición.', '');
if (exposure) {
  L.push('', '## Exposición GB: tasas por 100 M veh-km (AADF DfT × STATS19)', '', `Tramos aforados ${exposure.linksWithCounts} · accidentes GB ${exposure.gbRecords} · asignados ${exposure.assigned} · sin tramo ${exposure.unassigned} · sin vía ${exposure.noRoad}.`, '', '| Categoría | Exposición (100 M veh-km) | Con víctimas /100 M | Mortales /100 M | Arcén /100 M |', '|---|---|---|---|---|');
  for (const c of exposure.byCategory) L.push(`| ${c.category} | ${c.exposure100MvehKm} | ${c.injuryRate} | ${c.fatalRate} | ${c.hardShoulderRate} |`);
  L.push('', `Tasa media ${exposure.ebInjury.meanRatePer100MvehKm} /100 M veh-km · prior EB ${JSON.stringify(exposure.ebInjury.prior)}`, '', '| Tramo (vía) | AADF | Exposición | Accidentes | Tasa bruta | **Tasa EB** |', '|---|---|---|---|---|---|');
  for (const t of exposure.ebInjury.top.slice(0, 10)) L.push(`| ${t.id} (${t.road}) | ${t.aadf} | ${t.exposure100MvehKm} | ${t.count} | ${t.rawRate} | **${t.ebRate}** |`);
}
L.push('', '## Modelo multivariante de gravedad (OR AJUSTADOS, regresión logística)', '', `Entrenamiento ${sev.nTrain} · prueba ${sev.nTest} · mortales ${sev.events} · AUC prueba **${sev.test.auc}** · Brier ${sev.test.brier} · tasa base ${sev.test.baseRate}. Efectos fijos por país.`, '', '| Variable | OR ajustado [IC 95 %] |', '|---|---|');
for (const c of sev.coefficients.filter((c) => c.name !== 'intercept')) L.push(`| ${c.name} | ${c.or} [${c.ci.join('–')}]${c.significant ? ' *' : ''} |`);
L.push('', '**Calibración (deciles de la prueba):** ' + sev.test.calibration.map((b) => `${b.bin}: ${b.predicted}/${b.observed}`).join(' · '), '', '**Dejar un país fuera:**', '', '| País fuera | n | AUC | Predicho medio | Observado |', '|---|---|---|---|---|');
for (const r of loco.rows) L.push(`| ${r.heldOut} | ${r.n} | ${r.auc} | ${r.meanPredicted} | ${r.observed} |`);
L.push('');
for (const [c, v] of Object.entries(perCountry)) {
  L.push(`## Puntos negros con Bayes empírico · ${c}`, '', `Prior Poisson–Gamma: ${JSON.stringify(v.hotspots.prior)} · celdas: ${v.hotspots.cells}`, '', '| Celda | Conteo | Mortales | Esperado EB | Contracción |', '|---|---|---|---|---|');
  for (const h of v.hotspots.top.slice(0, 10)) L.push(`| ${h.cell} | ${h.count} | ${h.fatal} | ${h.ebExpected} | ${h.shrinkage} |`);
  L.push('');
}
writeFileSync(join(OUT, `DATASET_REPORT_${YEAR}.md`), L.join('\n') + '\n');
console.log(L.join('\n'));

#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Validador aritmético y documental sin dependencias externas para cualquier `BOM.csv` de `hardware/modules/*`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function verifyBomFile(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error(`BOM vacío en ${csvPath}`);

  const headers = parseCsvLine(lines[0]);
  const requiredCols = [
    'ref', 'component', 'variant_scope', 'qty',
    'unit_price_eur_incl_vat', 'unit_price_eur_ex_vat',
    'line_total_eur_incl_vat', 'line_total_eur_ex_vat',
    'pack_full_price_eur_incl_vat',
    'supplier', 'url', 'query_date', 'datasheet_url', 'license',
  ];
  for (const col of requiredCols) {
    if (!headers.includes(col)) throw new Error(`Falta columna '${col}' en ${csvPath}`);
  }

  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const vals = parseCsvLine(lines[r]);
    if (vals.length !== headers.length) {
      throw new Error(`Fila ${r + 1} en ${csvPath}: ${vals.length} != ${headers.length}`);
    }
    const obj = Object.fromEntries(headers.map((h, idx) => [h, vals[idx].trim()]));
    if (!obj.ref || !obj.component) throw new Error(`Fila ${r + 1}: ref/component vacío`);
    if (!['BOTH', 'COMPLETE_ONLY', 'STANDARD'].includes(obj.variant_scope)) {
      throw new Error(`Fila ${r + 1} (${obj.ref}): variant_scope inválido '${obj.variant_scope}'`);
    }
    if (!/^https:\/\/\S+$/.test(obj.url)) throw new Error(`Fila ${r + 1} (${obj.ref}): URL inválida`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(obj.query_date)) throw new Error(`Fila ${r + 1} (${obj.ref}): fecha inválida`);
    if (!/^https:\/\/\S+$/.test(obj.datasheet_url)) throw new Error(`Fila ${r + 1} (${obj.ref}): datasheet_url inválida`);
    if (!obj.license) throw new Error(`Fila ${r + 1} (${obj.ref}): licencia vacía`);

    const qty = Number(obj.qty);
    const unitIncl = Number(obj.unit_price_eur_incl_vat);
    const unitEx = Number(obj.unit_price_eur_ex_vat);
    const totalIncl = Number(obj.line_total_eur_incl_vat);
    const totalEx = Number(obj.line_total_eur_ex_vat);
    const packIncl = Number(obj.pack_full_price_eur_incl_vat);
    if (![qty, unitIncl, unitEx, totalIncl, totalEx, packIncl].every(Number.isFinite) || qty <= 0) {
      throw new Error(`Fila ${r + 1} (${obj.ref}): números inválidos`);
    }
    if (Math.abs(Number((qty * unitIncl).toFixed(2)) - totalIncl) > 0.011) {
      throw new Error(`Fila ${r + 1} (${obj.ref}): line_total_eur_incl_vat incoherente`);
    }
    if (Math.abs(Number((qty * unitEx).toFixed(2)) - totalEx) > 0.011) {
      throw new Error(`Fila ${r + 1} (${obj.ref}): line_total_eur_ex_vat incoherente`);
    }
    rows.push({ ...obj, qty, unitIncl, unitEx, totalIncl, totalEx, packIncl });
  }

  const sum = (list, key) => Number(list.reduce((acc, item) => acc + item[key], 0).toFixed(2));
  const minRows = rows.filter((x) => x.variant_scope === 'BOTH' || x.variant_scope === 'STANDARD');
  return {
    file: path.relative(process.cwd(), csvPath),
    rowCount: rows.length,
    queryDates: [...new Set(rows.map((x) => x.query_date))],
    standardOrMinimal: {
      itemCount: minRows.length,
      unitCostEurInclVat: sum(minRows, 'totalIncl'),
      unitCostEurExVat: sum(minRows, 'totalEx'),
      firstBuildFullPacksEurInclVat: sum(minRows, 'packIncl'),
    },
    completeVariant: {
      itemCount: rows.length,
      unitCostEurInclVat: sum(rows, 'totalIncl'),
      unitCostEurExVat: sum(rows, 'totalEx'),
      firstBuildFullPacksEurInclVat: sum(rows, 'packIncl'),
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.resolve(process.argv[2]);
  console.log(JSON.stringify(verifyBomFile(target), null, 2));
}

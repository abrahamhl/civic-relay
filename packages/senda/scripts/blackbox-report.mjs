#!/usr/bin/env node
// Resumen de una caja negra de SENDA Drive: node packages/senda/scripts/blackbox-report.mjs senda-cajanegra-….jsonl
// Solo lee el archivo; no envía nada. Todo lo que imprime está medido en ese archivo.
import { readFileSync } from 'node:fs';
import { parseJsonl, summarize } from '../src/blackbox.mjs';

const file = process.argv[2];
if (!file) { console.error('Uso: blackbox-report.mjs <archivo.jsonl>'); process.exit(2); }
const { rows, bad } = parseJsonl(readFileSync(file, 'utf8'));
const s = summarize(rows);
console.log(JSON.stringify({ file, head: rows[0], badLines: bad, ...s }, null, 2));

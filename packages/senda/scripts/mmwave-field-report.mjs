#!/usr/bin/env node
/** Analiza paquetes de práctica de campo del radar: comprueba huellas y reproduce los bytes. Uso: node mmwave-field-report.mjs archivo.json [...] */
import { readFileSync } from 'node:fs';
import { verifyFieldPackage, summarizeFieldPackage } from '../src/mmwave-field.mjs';
for (const f of process.argv.slice(2)) {
  const pkg = JSON.parse(readFileSync(f, 'utf8'));
  const v = await verifyFieldPackage(pkg);
  console.log(JSON.stringify({ file: f, integrity: v.ok ? 'OK' : v.errors, sha256: pkg.sha256, session: pkg.session, summary: summarizeFieldPackage(pkg) }, null, 2));
}

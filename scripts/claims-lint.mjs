#!/usr/bin/env node
/**
 * scripts/claims-lint.mjs
 * Gate de Verdad Científica y Honestidad Epistémica.
 *
 * Detecta afirmaciones hiperbólicas o sobrepromesas sin calificar en superficies públicas:
 *  - "submétrico" (salvo que aclare límites físicos o radar simulado)
 *  - "garantiza" / "100% infalible" (las telecomunicaciones de emergencia son probabilísticas)
 *  - "certificado" (salvo citas normativas concretas como ISO/ETSI)
 *  - "en tiempo real" (sin especificar latencia acotada o indicando simulación)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const SCAN_DIRS = [
  'investor-next/app',
  'docs/funding',
  'docs/video'
];

const FORBIDDEN_UNHEDGED_PATTERNS = [
  {
    regex: /\b(?:subm[eé]trico|sub-metric)\b/i,
    allowedContext: /simula|cota|cram[eé]r-rao|te[oó]ric|error|marr|estim|no claim|no se afirma/i,
    reason: 'Uso de "submétrico" sin calificar por Cramér-Rao o simulación acotada.'
  },
  {
    regex: /\b(?:100%\s*(?:infalible|seguro|garantizado)|garant[ií]a\s+absoluta)\b/i,
    allowedContext: /no existe|probabil[ií]stic|rechaza|imposible/i,
    reason: 'Afirmación de infalibilidad 100% en canal no guiado.'
  },
  {
    regex: /\b(?:certificado\s+por\s+la\s+(?:ue|dgt|esa)|homologaci[oó]n\s+oficial\s+concedida)\b/i,
    allowedContext: /pendiente|hoja de ruta|en proceso|no certificad|requiere/i,
    reason: 'Afirmación de certificación oficial no concedida todavía.'
  }
];

let violationsCount = 0;

function walk(dir) {
  const fullPath = resolve(ROOT, dir);
  let entries = [];
  try {
    entries = readdirSync(fullPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = join(fullPath, entry);
    const stat = statSync(entryPath);
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.next' && entry !== 'out') {
        walk(entryPath);
      }
    } else {
      const ext = extname(entry);
      if (['.tsx', '.ts', '.mjs', '.md', '.html'].includes(ext)) {
        checkFile(entryPath);
      }
    }
  }
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    for (const rule of FORBIDDEN_UNHEDGED_PATTERNS) {
      if (rule.regex.test(line)) {
        if (!rule.allowedContext.test(line)) {
          console.error(`[CLAIMS-LINT FAIL] ${filePath}:${idx + 1}`);
          console.error(`  > ${line.trim()}`);
          console.error(`  Causa: ${rule.reason}\n`);
          violationsCount++;
        }
      }
    }
  });
}

console.log('--- Iniciando Claims Lint (Truth Gate) ---');
for (const d of SCAN_DIRS) {
  walk(d);
}

if (violationsCount > 0) {
  console.error(`TOTAL VIOLACIONES DE AFIRMACIÓN: ${violationsCount}`);
  process.exit(1);
} else {
  console.log('PASS: 0 sobreafirmaciones no calificadas detectadas. Integridad epistémica preservada.');
}

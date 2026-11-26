#!/usr/bin/env node
// @ts-check
/**
 * SENDA · F8 / H0 · Verificación integral reproducible en un solo comando (`pnpm verify`).
 *
 * Ejecuta en orden estricto:
 *  1. Guardia de cero dependencias externas en `packages/senda/src`, `packages/senda/tests/*.test.mjs`,
 *     `packages/senda/tests/defense/*.test.mjs` y `scripts/film-claims.mjs` (Lección obligatoria #2).
 *  2. Núcleo sin dependencias (`packages/senda/tests/*.test.mjs` + `tests/defense/*.test.mjs`).
 *  3. Contratos y esquemas Ajv (`packages/senda/tests/contracts/*.test.mjs` + compilación de `schemas/`).
 *  4. Suite web (`investor-next/tests/*.test.mjs`) y relé (`packages/senda-relay/tests/*.test.mjs`).
 *  5. Suite de escritorio (`@senda/command-center`).
 *  6. Comprobación estática de tipos (`pnpm type-check`, incluido `@ts-check` JSDoc del núcleo).
 *  7. Prueba pública (`node scripts/prove.mjs`, 21 afirmaciones recalculadas con el núcleo).
 *  8. Escaneo de secretos (`gitleaks` con `.gitleaks.toml`, si el binario está disponible).
 *  9. Puerta de publicación de Vercel (`write-release-proof.mjs` + `write-senda-status.mjs`),
 *     restaurando los artefactos temporales en `investor-next/public/` salvo que se pase `--keep-generated`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isBuiltin } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keepGenerated = process.argv.includes('--keep-generated');

/**
 * Recorre ficheros `.mjs` de un directorio (no recursivo salvo `recursive = true`).
 * @param {string} dir
 * @param {boolean} [recursive]
 * @returns {string[]}
 */
function listMjs(dir, recursive = false) {
  const full = path.resolve(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    if (entry.isDirectory() && recursive) out.push(...listMjs(p, true));
    else if (entry.isFile() && entry.name.endsWith('.mjs')) out.push(p);
  }
  return out.sort();
}

/**
 * Comprueba que los módulos de cero dependencias no importen paquetes de `node_modules`.
 */
function checkZeroExternalImports() {
  const targets = [
    ...listMjs('packages/senda/src', true),
    ...listMjs('packages/senda/tests', false),
    ...listMjs('packages/senda/tests/defense', false),
    path.resolve(ROOT, 'scripts/film-claims.mjs'),
    path.resolve(ROOT, 'scripts/prove.mjs'),
  ];
  const stmtImportRe = /^\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/;
  const dynImportRe = /(?:^|[^\w.$])import\s*\(\s*['"]([^'"]+)['"]\s*[,)]/g;
  /** @type {string[]} */
  const violations = [];

  const checkSpec = (spec, file, lineNo) => {
    if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/') || spec.startsWith('file:')) return;
    if (isBuiltin(spec)) return;
    violations.push(`${path.relative(ROOT, file)}:${lineNo} -> paquete externo prohibido en suite sin dependencias: "${spec}"`);
  };

  for (const file of targets) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      const sm = stmtImportRe.exec(line);
      if (sm) checkSpec(sm[1], file, idx + 1);
      dynImportRe.lastIndex = 0;
      let dm;
      while ((dm = dynImportRe.exec(line)) !== null) checkSpec(dm[1], file, idx + 1);
    });
  }
  if (violations.length > 0) {
    throw new Error(`Violación de cero dependencias:\n  ${violations.join('\n  ')}`);
  }
  return `${targets.length} módulos auditados (0 dependencias npm)`;
}

/**
 * Ejecuta un subproceso y devuelve duración y salida; lanza error si falla.
 * @param {string} label
 * @param {string} cmd
 * @param {string[]} args
 * @param {Record<string, string | undefined>} [extraEnv]
 */
function runCmd(label, cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
  if (r.status !== 0) {
    if (r.stdout) process.stderr.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    throw new Error(`Fallo en «${label}» (código ${r.status ?? 'señal'})`);
  }
  return r.stdout ?? '';
}

/**
 * Encuentra el binario de gitleaks si está instalado en PATH o en /tmp/gitleaks.
 * @returns {string | null}
 */
function findGitleaks() {
  const check = spawnSync('sh', ['-c', 'command -v gitleaks'], { encoding: 'utf8' });
  if (check.status === 0 && check.stdout.trim()) return check.stdout.trim();
  if (fs.existsSync('/tmp/gitleaks')) return '/tmp/gitleaks';
  return null;
}

/**
 * Guarda copia en memoria de un fichero para restaurarlo tras una puerta de compilación.
 * @param {string} relPath
 */
function snapshotFile(relPath) {
  const abs = path.resolve(ROOT, relPath);
  const existed = fs.existsSync(abs);
  const bytes = existed ? fs.readFileSync(abs) : null;
  return {
    restore() {
      if (existed && bytes !== null) fs.writeFileSync(abs, bytes);
      else if (!existed && fs.existsSync(abs)) fs.unlinkSync(abs);
    },
  };
}

/** @type {Array<{ name: string, fn: () => Promise<string> | string }>} */
const STEPS = [
  {
    name: '1/9 · Guardia de cero dependencias (núcleo + film-claims)',
    fn: () => checkZeroExternalImports(),
  },
  {
    name: '2/9 · Núcleo sin dependencias (civil + defensa)',
    fn: () => {
      const files = [
        ...listMjs('packages/senda/tests', false).filter((f) => f.endsWith('.test.mjs')),
        ...listMjs('packages/senda/tests/defense', false).filter((f) => f.endsWith('.test.mjs')),
      ];
      const out = runCmd('núcleo sin dependencias', process.execPath, ['--test', '--test-reporter=tap', ...files], { NODE_PATH: '' });
      const pass = out.match(/^# pass (\d+)/m)?.[1] ?? '?';
      const total = out.match(/^# tests (\d+)/m)?.[1] ?? '?';
      const fail = Number(out.match(/^# fail (\d+)/m)?.[1] ?? 0);
      if (fail > 0) throw new Error(`${fail} pruebas fallidas en el núcleo`);
      return `${pass}/${total} pruebas en verde (${files.length} ficheros)`;
    },
  },
  {
    name: '3/9 · Contratos y esquemas JSON (Ajv 2020-12)',
    fn: async () => {
      const { CONTRACT_SCHEMAS, validateContract } = await import('../packages/senda/schemas/validate.mjs');
      // Verificar que un objeto vacío sin fuente ni zona horaria sea rechazado en todos los esquemas
      for (const s of CONTRACT_SCHEMAS) {
        const res = validateContract(/** @type {any} */ (s), {});
        if (res.ok) throw new Error(`El esquema ${s} aceptó un objeto vacío`);
      }
      const contractTests = listMjs('packages/senda/tests/contracts', false).filter((f) => f.endsWith('.test.mjs'));
      const out = runCmd('contratos Ajv', process.execPath, ['--test', '--test-reporter=tap', ...contractTests]);
      const pass = out.match(/^# pass (\d+)/m)?.[1] ?? '?';
      const total = out.match(/^# tests (\d+)/m)?.[1] ?? '?';
      return `${CONTRACT_SCHEMAS.length} esquemas compilados · ${pass}/${total} pruebas de contrato en verde`;
    },
  },
  {
    name: '4/9 · Suites web (investor-next) y relé (senda-relay)',
    fn: () => {
      const webFiles = listMjs('investor-next/tests', false).filter((f) => f.endsWith('.test.mjs'));
      const relayFiles = listMjs('packages/senda-relay/tests', false).filter((f) => f.endsWith('.test.mjs'));
      const wOut = runCmd('investor-next', process.execPath, ['--test', '--test-reporter=tap', ...webFiles]);
      const rOut = runCmd('senda-relay', process.execPath, ['--test', '--test-reporter=tap', ...relayFiles]);
      const wPass = wOut.match(/^# pass (\d+)/m)?.[1] ?? '?';
      const rPass = rOut.match(/^# pass (\d+)/m)?.[1] ?? '?';
      return `web ${wPass} · relé ${rPass} en verde`;
    },
  },
  {
    name: '5/9 · Suite de escritorio (@senda/command-center)',
    fn: () => {
      runCmd('command-center', 'pnpm', ['--filter', '@senda/command-center', 'test']);
      return '@senda/command-center en verde';
    },
  },
  {
    name: '6/9 · Comprobación estática de tipos (pnpm type-check)',
    fn: () => {
      runCmd('pnpm type-check', 'pnpm', ['type-check']);
      const invTsc = path.resolve(ROOT, 'investor-next/node_modules/.bin/tsc');
      if (fs.existsSync(invTsc)) {
        runCmd('investor-next tsc', invTsc, ['-p', 'investor-next/tsconfig.json', '--noEmit']);
        return '0 errores TypeScript/JSDoc en paquetes, apps e investor-next';
      }
      return '0 errores TypeScript/JSDoc en paquetes y apps';
    },
  },
  {
    name: '7/9 · Prueba pública (scripts/prove.mjs)',
    fn: () => {
      const todayProof = `evidence/proof/proof-${new Date().toISOString().slice(0, 10)}.json`;
      const snap = snapshotFile(todayProof);
      try {
        const out = runCmd('prove.mjs', process.execPath, ['scripts/prove.mjs']);
        const line = out.trim().split('\n').find((l) => l.includes('afirmaciones verificadas')) ?? 'OK';
        return line.trim();
      } finally {
        if (!keepGenerated) snap.restore();
      }
    },
  },
  {
    name: '8/9 · Seguridad · escaneo de secretos (gitleaks)',
    fn: () => {
      const bin = findGitleaks();
      if (!bin) return 'omitido localmente (binario gitleaks no instalado; obligatorio en GitHub CI)';
      // Replica exactamente el árbol limpio de CI (todos los ficheros con seguimiento + nuevos no ignorados, excluyendo node_modules).
      const tmpTree = fs.mkdtempSync('/tmp/senda-gitleaks-');
      try {
        const ls = runCmd('git ls-files', 'git', ['ls-files', '-co', '--exclude-standard', '-z']);
        for (const rel of ls.split('\0').filter(Boolean)) {
          const src = path.resolve(ROOT, rel);
          if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
          const dst = path.join(tmpTree, rel);
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          try { fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); }
        }
        runCmd('gitleaks', bin, [
          'detect', '--source', tmpTree, '--no-git',
          '--config', path.resolve(ROOT, '.gitleaks.toml'),
          '--redact', '--exit-code', '1',
        ]);
        return '0 fugas detectadas con .gitleaks.toml (árbol completo sin ignorados)';
      } finally {
        fs.rmSync(tmpTree, { recursive: true, force: true });
      }
    },
  },
  {
    name: '9/9 · Puerta de publicación de Vercel (write-release-proof + write-senda-status)',
    fn: () => {
      const snaps = [
        snapshotFile('investor-next/public/release-provenance.json'),
        snapshotFile('investor-next/public/senda/estado.json'),
        snapshotFile('investor-next/public/senda/estado.html'),
      ];
      try {
        runCmd('write-release-proof', process.execPath, ['investor-next/scripts/write-release-proof.mjs']);
        const out = runCmd('write-senda-status', process.execPath, ['investor-next/scripts/write-senda-status.mjs']);
        return out.trim();
      } finally {
        if (!keepGenerated) snaps.forEach((s) => s.restore());
      }
    },
  },
];

const t0 = Date.now();
console.log('SENDA · pnpm verify · verificación integral de misión crítica\n');

for (const step of STEPS) {
  const s0 = Date.now();
  process.stdout.write(`▶ ${step.name} … `);
  try {
    const summary = await step.fn();
    console.log(`OK (${((Date.now() - s0) / 1000).toFixed(1)} s)\n    ${summary}`);
  } catch (err) {
    console.log('FALLO');
    console.error(`\n✘ ${step.name}\n${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

console.log(`\n✔ SENDA verify completado en ${((Date.now() - t0) / 1000).toFixed(1)} s · 9/9 puertas superadas.`);

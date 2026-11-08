#!/usr/bin/env node
// SENDA · manifiesto de release reproducible.
//
// Motivo: un SHA de Git no identifica por sí solo el árbol que se desplegó.
// Este manifiesto hashea el contenido real de los ficheros rastreados, el
// lockfile y el artefacto de build. La verificación falla cerrada (exit 1)
// cuando el árbol o el artefacto no coinciden con lo declarado.
//
// Uso:
//   node scripts/release-manifest.mjs [--out evidence/senda/mission-95/release-manifest.json]
//   node scripts/release-manifest.mjs --artifact dist/app.zip --build-command "pnpm build"
//   node scripts/release-manifest.mjs --verify <manifest.json> [--production]
//
// Estados de claim (nunca se autodeclara producción verificada):
//   SOURCE_ONLY        árbol limpio, sin artefacto
//   ARTIFACT_HASHED    árbol limpio + artefacto hasheado
//   UNCOMMITTED_BUILD  árbol sucio (incluye cambios sin commit)
//   ARTIFACT_MISMATCH  el artefacto no coincide con el manifiesto

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, lstatSync, readlinkSync, existsSync } from 'node:fs';
import { resolve, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'senda.release-manifest/1';

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function hashFile(path) {
  if (lstatSync(path).isSymbolicLink()) return sha256(`symlink:${readlinkSync(path)}`);
  return sha256(readFileSync(path));
}

// Huella determinista de un conjunto de ficheros: modo + sha256 + ruta relativa.
// Dos árboles con el mismo commit declarado pero contenido distinto producen
// huellas distintas (ver scripts/release-manifest.test.mjs).
export function hashFiles(root, files) {
  const rows = files.map((f) => {
    const abs = resolve(root, f.path);
    if (!existsSync(abs)) throw new Error(`fichero rastreado ausente: ${f.path}`);
    return `${f.mode} ${hashFile(abs)} ${f.path.replaceAll(sep, '/')}`;
  }).sort();
  return { treeSha256: sha256(rows.join('\n') + '\n'), fileCount: rows.length, rows };
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function listTracked(root) {
  const staged = git(root, ['ls-files', '-s', '-z']).split('\0').filter(Boolean);
  return staged.map((line) => {
    const m = /^(\d{6}) [0-9a-f]+ \d+\t(.+)$/.exec(line);
    if (!m) throw new Error(`entrada inesperada de git ls-files: ${line}`);
    return { mode: m[1], path: m[2] };
  });
}

function lockfileHash(root) {
  const f = resolve(root, 'pnpm-lock.yaml');
  return existsSync(f) ? hashFile(f) : null;
}

export function buildManifest(root = process.cwd(), opts = {}) {
  const files = listTracked(root);
  const source = hashFiles(root, files);
  const commit = git(root, ['rev-parse', 'HEAD']).trim();
  const gitTree = git(root, ['rev-parse', 'HEAD^{tree}']).trim();
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const dirtyPaths = git(root, ['status', '--porcelain=v1', '-z']).split('\0').filter(Boolean).map((x) => x.slice(3));
  const dirty = dirtyPaths.length > 0;

  let artifact = null;
  if (opts.artifact) {
    const abs = resolve(root, opts.artifact);
    if (!existsSync(abs)) throw new Error(`artefacto inexistente: ${opts.artifact}`);
    artifact = { path: opts.artifact.replaceAll(sep, '/'), bytes: statSync(abs).size, sha256: hashFile(abs) };
  }

  const claim = dirty ? 'UNCOMMITTED_BUILD' : artifact ? 'ARTIFACT_HASHED' : 'SOURCE_ONLY';
  return {
    schema: SCHEMA,
    claim,
    generatedAt: new Date().toISOString(),
    git: { commit, tree: gitTree, branch, dirty, dirtyPaths: dirtyPaths.slice(0, 200) },
    source: {
      treeSha256: source.treeSha256,
      fileCount: source.fileCount,
      lockfileSha256: lockfileHash(root),
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      gitAutocrlf: (() => {
        try {
          return git(root, ['config', '--get', 'core.autocrlf']).trim() || null;
        } catch {
          return null;
        }
      })(),
      packageManager: (() => {
        try {
          return JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).packageManager ?? null;
        } catch {
          return null;
        }
      })(),
    },
    build: {
      command: opts.buildCommand ?? null,
      artifact,
    },
    exclusions: ['.git', 'node_modules', 'entorno no rastreado (cubierto por git.dirty)'],
  };
}

export function verifyManifest(root, manifest, opts = {}) {
  const current = buildManifest(root, { artifact: manifest?.build?.artifact?.path ?? undefined });
  const sourceMatches = Boolean(
    manifest &&
    manifest.schema === SCHEMA &&
    manifest.git?.commit === current.git.commit &&
    manifest.git?.tree === current.git.tree &&
    manifest.source?.treeSha256 === current.source.treeSha256 &&
    manifest.source?.fileCount === current.source.fileCount &&
    manifest.source?.lockfileSha256 === current.source.lockfileSha256,
  );
  const artifactMatches = manifest?.build?.artifact
    ? current.build.artifact?.sha256 === manifest.build.artifact.sha256
    : true;
  const clean = !current.git.dirty;
  const verified = sourceMatches && artifactMatches && (!opts.production || clean);
  return { verified, sourceMatches, artifactMatches, clean, claim: current.claim, current };
}

function parseArgs(argv) {
  const out = { out: null, artifact: null, buildCommand: null, verify: null, production: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') out.out = argv[++i];
    else if (a === '--artifact') out.artifact = argv[++i];
    else if (a === '--build-command') out.buildCommand = argv[++i];
    else if (a === '--verify') out.verify = argv[++i];
    else if (a === '--production') out.production = true;
    else if (a === '--help' || a === '-h') {
      console.log('uso: node scripts/release-manifest.mjs [--out f] [--artifact f] [--build-command c] | --verify f [--production]');
      process.exit(0);
    } else throw new Error(`argumento desconocido: ${a}`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const root = process.cwd();
    if (args.verify) {
      const manifest = JSON.parse(readFileSync(resolve(root, args.verify), 'utf8'));
      const result = verifyManifest(root, manifest, { production: args.production });
      const { current, ...report } = result;
      console.log(JSON.stringify(report, null, 2));
      process.exit(result.verified ? 0 : 1);
    }
    const manifest = buildManifest(root, { artifact: args.artifact, buildCommand: args.buildCommand });
    if (args.out) {
      const dest = resolve(root, args.out);
      writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n');
      console.error(`manifiesto escrito: ${relative(root, dest)} (${manifest.claim})`);
    } else {
      console.log(JSON.stringify(manifest, null, 2));
    }
  } catch (err) {
    console.error(`release-manifest: ${err.message}`);
    process.exit(2);
  }
}

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
import { readFileSync, writeFileSync, lstatSync, readlinkSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, sep, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'senda.release-manifest/1';

const DEPLOYMENT_FIELDS = ['provider', 'artifactMode', 'target', 'projectId', 'deploymentId', 'url', 'commitSha', 'artifactSha256', 'sourceTreeSha256', 'verifiedAt', 'verifiedBy', 'status'];

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function normalizeDeployment(value, { commit, sourceTreeSha256, artifact, dirty }) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('deployment debe ser un objeto');
  const keys = Object.keys(value).sort();
  if (keys.length !== DEPLOYMENT_FIELDS.length || keys.some((key, i) => key !== [...DEPLOYMENT_FIELDS].sort()[i])) {
    throw new Error('deployment con campos no permitidos');
  }
  if (!artifact) throw new Error('deployment exige un artefacto hasheado');
  if (value.provider !== 'vercel') throw new Error('deployment.provider no soportado');
  if (value.artifactMode !== 'prebuilt') throw new Error('deployment.artifactMode debe ser prebuilt');
  if (value.target !== 'production' && value.target !== 'preview') throw new Error('deployment.target inválido');
  if (value.target === 'production' && dirty) throw new Error('DEPLOYMENT_REQUIRES_CLEAN_TREE');
  if (value.status !== 'READY') throw new Error('deployment.status debe ser READY');
  for (const field of ['projectId', 'deploymentId', 'verifiedBy']) {
    if (typeof value[field] !== 'string' || value[field].trim() === '') throw new Error(`deployment.${field} inválido`);
  }
  if (typeof value.url !== 'string') throw new Error('deployment.url inválido');
  let url;
  try { url = new URL(value.url); } catch { throw new Error('deployment.url inválido'); }
  if (url.protocol !== 'https:') throw new Error('deployment.url debe usar https');
  if (typeof value.commitSha !== 'string' || !/^[0-9a-f]{40}$/.test(value.commitSha)) throw new Error('deployment.commitSha inválido');
  if (value.commitSha !== commit) throw new Error('deployment.commitSha no coincide con HEAD');
  if (typeof value.sourceTreeSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.sourceTreeSha256)) throw new Error('deployment.sourceTreeSha256 inválido');
  if (value.sourceTreeSha256 !== sourceTreeSha256) throw new Error('deployment.sourceTreeSha256 no coincide con el árbol');
  if (typeof value.artifactSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.artifactSha256)) throw new Error('deployment.artifactSha256 inválido');
  if (value.artifactSha256 !== artifact.sha256) throw new Error('deployment.artifactSha256 no coincide con el artefacto');
  if (typeof value.verifiedAt !== 'string' || !Number.isFinite(Date.parse(value.verifiedAt)) || new Date(value.verifiedAt).toISOString() !== value.verifiedAt) {
    throw new Error('deployment.verifiedAt inválido');
  }
  return { ...value };
}

function deploymentMatches(manifest, current) {
  const d = manifest?.deployment;
  if (!d) return true;
  return d.provider === 'vercel' &&
    d.artifactMode === 'prebuilt' &&
    (d.target === 'production' || d.target === 'preview') &&
    d.status === 'READY' &&
    typeof d.projectId === 'string' && d.projectId.length > 0 &&
    typeof d.deploymentId === 'string' && d.deploymentId.length > 0 &&
    typeof d.verifiedBy === 'string' && d.verifiedBy.length > 0 &&
    typeof d.url === 'string' && d.url.startsWith('https://') &&
    d.commitSha === current.git.commit &&
    d.sourceTreeSha256 === current.source.treeSha256 &&
    d.artifactSha256 === current.build.artifact?.sha256 &&
    (d.target !== 'production' || !current.git.dirty);
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

function artifactRows(dir, prefix = '') {
  const rows = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const st = lstatSync(abs);
    if (st.isDirectory()) rows.push(...artifactRows(abs, rel));
    else rows.push({ mode: st.isSymbolicLink() ? '120000' : st.mode & 0o111 ? '100755' : '100644', path: rel, bytes: st.size });
  }
  return rows;
}

export function describeArtifact(path) {
  const st = lstatSync(path);
  if (!st.isDirectory()) return { bytes: st.size, sha256: hashFile(path), fileCount: 1 };
  const rows = artifactRows(path);
  const { treeSha256, fileCount } = hashFiles(path, rows);
  return { bytes: rows.reduce((sum, row) => sum + row.bytes, 0), sha256: treeSha256, fileCount };
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
    artifact = { path: opts.artifact.replaceAll(sep, '/'), ...describeArtifact(abs) };
  }

  const deployment = normalizeDeployment(opts.deployment, { commit, sourceTreeSha256: source.treeSha256, artifact, dirty });
  const claim = dirty ? 'UNCOMMITTED_BUILD' : deployment ? 'DEPLOYMENT_LINKED' : artifact ? 'ARTIFACT_HASHED' : 'SOURCE_ONLY';
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
    deployment,
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
  const linkedDeployment = deploymentMatches(manifest, current);
  const productionTarget = opts.production ? !manifest?.deployment || manifest.deployment.target === 'production' : true;
  const clean = !current.git.dirty;
  const verified = sourceMatches && artifactMatches && linkedDeployment && productionTarget && (!opts.production || clean);
  return { verified, sourceMatches, artifactMatches, deploymentMatches: linkedDeployment, clean, claim: current.claim, current };
}

function parseArgs(argv) {
  const out = { out: null, artifact: null, buildCommand: null, deployment: null, verify: null, production: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') out.out = argv[++i];
    else if (a === '--artifact') out.artifact = argv[++i];
    else if (a === '--build-command') out.buildCommand = argv[++i];
    else if (a === '--deployment') out.deployment = argv[++i];
    else if (a === '--verify') out.verify = argv[++i];
    else if (a === '--production') out.production = true;
    else if (a === '--help' || a === '-h') {
      console.log('uso: node scripts/release-manifest.mjs [--out f] [--artifact f] [--build-command c] [--deployment f] | --verify f [--production]');
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
    const deployment = args.deployment ? JSON.parse(readFileSync(resolve(root, args.deployment), 'utf8')) : null;
    const manifest = buildManifest(root, { artifact: args.artifact, buildCommand: args.buildCommand, deployment });
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

#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './release-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = { deployment: null, artifact: 'investor-next/.vercel/output', buildCommand: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deployment') out.deployment = argv[++i];
    else if (a === '--artifact') out.artifact = argv[++i];
    else if (a === '--build-command') out.buildCommand = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('uso: node scripts/vercel-provenance.mjs --deployment <url|id> [--artifact investor-next/.vercel/output] [--build-command c] [--out f]');
      process.exit(0);
    } else throw new Error(`argumento desconocido: ${a}`);
  }
  if (!out.deployment) throw new Error('falta --deployment');
  return out;
}

function vercel(args, cwd) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return JSON.parse(execFileSync(command, ['--yes', 'vercel@latest', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120000,
    windowsHide: true,
  }));
}

function deploymentTarget(deployment, inspect) {
  return deployment.target || inspect.target || 'preview';
}

export function deploymentDescriptorFromEvidence({ inspect, list, project, manifest, now = new Date() }) {
  if (!inspect || typeof inspect !== 'object') throw new Error('inspect inválido');
  if (!list || !Array.isArray(list.deployments)) throw new Error('lista de deployments inválida');
  if (!project || typeof project.projectId !== 'string') throw new Error('projectId ausente');
  if (!manifest?.build?.artifact?.sha256) throw new Error('artefacto prebuilt ausente');
  if (!manifest?.source?.treeSha256) throw new Error('huella de fuente ausente');
  if (manifest.git?.dirty) throw new Error('el árbol de trabajo debe estar limpio');
  if (inspect.readyState !== 'READY') throw new Error('el deployment no está READY');
  const deployment = list.deployments.find((item) => item.url === inspect.url);
  if (!deployment) throw new Error('el deployment no aparece en la lista del proyecto');
  const meta = deployment.meta ?? {};
  if (meta.gitDirty === '1') throw new Error('el deployment se construyó desde un árbol sucio');
  if (typeof meta.githubCommitSha !== 'string' || !/^[0-9a-f]{40}$/i.test(meta.githubCommitSha)) {
    throw new Error('el deployment no declara un commit de Git verificable');
  }
  if (meta.githubCommitSha.toLowerCase() !== manifest.git.commit.toLowerCase()) {
    throw new Error('el commit del deployment no coincide con HEAD');
  }
  const target = deploymentTarget(deployment, inspect);
  if (target !== 'production' && target !== 'preview') throw new Error('target de deployment inválido');
  if (!/^dpl_[A-Za-z0-9]+$/.test(inspect.id ?? '')) throw new Error('deploymentId inválido');
  if (typeof inspect.url !== 'string' || !inspect.url.endsWith('.vercel.app')) throw new Error('url de deployment inválida');
  return {
    provider: 'vercel',
    artifactMode: 'prebuilt',
    target,
    projectId: project.projectId,
    deploymentId: inspect.id,
    url: `https://${inspect.url}`,
    commitSha: manifest.git.commit,
    artifactSha256: manifest.build.artifact.sha256,
    sourceTreeSha256: manifest.source.treeSha256,
    verifiedAt: now.toISOString(),
    verifiedBy: 'vercel-cli+release-manifest',
    status: 'READY',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const projectDir = resolve(ROOT, 'investor-next');
    const project = JSON.parse(readFileSync(resolve(projectDir, '.vercel', 'project.json'), 'utf8'));
    const manifest = buildManifest(ROOT, { artifact: args.artifact, buildCommand: args.buildCommand });
    if (manifest.git.dirty) throw new Error('el árbol debe estar limpio antes de generar procedencia');
    const inspect = vercel(['inspect', args.deployment, '--json'], projectDir);
    const list = vercel(['ls', '--json', '--limit', '100'], projectDir);
    const descriptor = deploymentDescriptorFromEvidence({ inspect, list, project, manifest });
    if (args.out) {
      const dest = resolve(ROOT, args.out);
      writeFileSync(dest, JSON.stringify(descriptor, null, 2) + '\n');
      console.error(`procedencia escrita: ${relative(ROOT, dest)} (${descriptor.target}, ${descriptor.deploymentId})`);
    } else {
      console.log(JSON.stringify(descriptor, null, 2));
    }
  } catch (err) {
    console.error(`vercel-provenance: ${err.message}`);
    process.exit(2);
  }
}

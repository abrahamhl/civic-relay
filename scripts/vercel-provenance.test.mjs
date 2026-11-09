import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentDescriptorFromEvidence } from './vercel-provenance.mjs';

const commit = 'a'.repeat(40);
const artifactSha256 = 'b'.repeat(64);
const sourceTreeSha256 = 'c'.repeat(64);
const inspect = {
  id: 'dpl_abc123',
  url: 'senda-example.vercel.app',
  target: 'production',
  readyState: 'READY',
};
const list = {
  deployments: [{
    url: 'senda-example.vercel.app',
    target: 'production',
    state: 'READY',
    meta: { githubCommitSha: commit, gitDirty: '0' },
  }],
};
const project = { projectId: 'prj_senda' };
const manifest = {
  git: { commit, dirty: false },
  source: { treeSha256: sourceTreeSha256 },
  build: { artifact: { sha256: artifactSha256 } },
};
const now = new Date('2026-11-08T12:00:00.000Z');

test('genera un descriptor de Vercel ligado a commit, fuente y artefacto', () => {
  const descriptor = deploymentDescriptorFromEvidence({ inspect, list, project, manifest, now });
  assert.deepEqual(descriptor, {
    provider: 'vercel',
    artifactMode: 'prebuilt',
    target: 'production',
    projectId: 'prj_senda',
    deploymentId: 'dpl_abc123',
    url: 'https://senda-example.vercel.app',
    commitSha: commit,
    artifactSha256,
    sourceTreeSha256,
    verifiedAt: '2026-11-08T12:00:00.000Z',
    verifiedBy: 'vercel-cli+release-manifest',
    status: 'READY',
  });
});

test('rechaza árbol sucio, commit distinto y deployment no listado', () => {
  assert.throws(() => deploymentDescriptorFromEvidence({
    inspect, list, project, manifest: { ...manifest, git: { ...manifest.git, dirty: true } }, now,
  }), /limpio/);
  assert.throws(() => deploymentDescriptorFromEvidence({
    inspect,
    list: { deployments: [{ ...list.deployments[0], meta: { ...list.deployments[0].meta, githubCommitSha: 'd'.repeat(40) } }] },
    project,
    manifest,
    now,
  }), /no coincide/);
  assert.throws(() => deploymentDescriptorFromEvidence({
    inspect, list: { deployments: [] }, project, manifest, now,
  }), /no aparece/);
});

test('rechaza un deployment que no está READY o sin evidencia de artefacto', () => {
  assert.throws(() => deploymentDescriptorFromEvidence({
    inspect: { ...inspect, readyState: 'ERROR' }, list, project, manifest, now,
  }), /READY/);
  assert.throws(() => deploymentDescriptorFromEvidence({
    inspect, list, project, manifest: { ...manifest, build: { artifact: null } }, now,
  }), /artefacto/);
});

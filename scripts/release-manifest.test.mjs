import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashFiles, buildManifest, verifyManifest, SCHEMA } from './release-manifest.mjs';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'senda-manifest-'));
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

test('dos árboles distintos con el mismo SHA declarado no comparten huella', () => {
  const a = tmp();
  const b = tmp();
  try {
    writeFileSync(join(a, 'app.js'), 'export const version = "a";\n');
    writeFileSync(join(b, 'app.js'), 'export const version = "b";\n');
    const files = [{ mode: '100644', path: 'app.js' }];
    const ha = hashFiles(a, files);
    const hb = hashFiles(b, files);
    assert.notEqual(ha.treeSha256, hb.treeSha256);
    assert.equal(ha.fileCount, 1);
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('la huella es determinista e independiente del orden de entrada', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'b.txt'), 'b');
    writeFileSync(join(d, 'a.txt'), 'a');
    const one = hashFiles(d, [{ mode: '100644', path: 'a.txt' }, { mode: '100644', path: 'b.txt' }]);
    const two = hashFiles(d, [{ mode: '100644', path: 'b.txt' }, { mode: '100644', path: 'a.txt' }]);
    assert.equal(one.treeSha256, two.treeSha256);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('un fichero rastreado ausente falla cerrado', () => {
  const d = tmp();
  try {
    assert.throws(() => hashFiles(d, [{ mode: '100644', path: 'no-existe.js' }]), /ausente/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('manifiesto limpio verifica; árbol sucio y artefacto alterado fallan', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'dist'));
    writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'x', packageManager: 'pnpm@1.0.0' }));
    writeFileSync(join(d, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
    writeFileSync(join(d, 'app.js'), 'export const x = 1;\n');
    writeFileSync(join(d, 'dist', 'app.bin'), 'artefacto-v1');
    git(d, 'init', '-q', '-b', 'main');
    git(d, 'config', 'user.email', 'test@example.invalid');
    git(d, 'config', 'user.name', 'test');
    git(d, 'add', '-A');
    git(d, 'commit', '-q', '-m', 'base');

    const m = buildManifest(d, { artifact: 'dist/app.bin' });
    assert.equal(m.schema, SCHEMA);
    assert.equal(m.claim, 'ARTIFACT_HASHED');
    assert.equal(m.git.dirty, false);
    assert.equal(m.source.fileCount, 4);
    assert.equal(verifyManifest(d, m).verified, true);
    assert.equal(verifyManifest(d, m, { production: true }).verified, true);

    writeFileSync(join(d, 'app.js'), 'export const x = 2;\n');
    const dirty = buildManifest(d, { artifact: 'dist/app.bin' });
    assert.equal(dirty.claim, 'UNCOMMITTED_BUILD');
    assert.equal(verifyManifest(d, dirty).sourceMatches, true);
    assert.equal(verifyManifest(d, dirty, { production: true }).verified, false);
    assert.equal(verifyManifest(d, m).sourceMatches, false);
    assert.equal(verifyManifest(d, m).verified, false);

    git(d, 'checkout', '--', 'app.js');
    writeFileSync(join(d, 'dist', 'app.bin'), 'artefacto-v2');
    assert.equal(verifyManifest(d, m).artifactMatches, false);
    assert.equal(verifyManifest(d, m).verified, false);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

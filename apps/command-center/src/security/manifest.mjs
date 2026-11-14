// Runtime verification of the evidence snapshot.
//
// The manifest records size and SHA-256 for every snapshot file. This module
// recomputes both from the exact bytes the UI will render. A mismatch is shown
// to the operator; it is not hidden behind a green badge.

import { sha256Hex } from './crypto.mjs';

const encoder = new TextEncoder();

export async function verifySnapshotManifest(manifest, readText) {
  if (!manifest || !Array.isArray(manifest.files)) {
    throw new TypeError('manifest.files is required');
  }

  const results = [];
  for (const file of manifest.files) {
    const text = await readText(file.snapshotPath);
    const bytes = encoder.encode(text);
    const actualSha256 = await sha256Hex(bytes);
    const sizeOk = bytes.length === file.bytes;
    const hashOk = actualSha256 === file.sha256;
    results.push({
      id: file.id,
      snapshotPath: file.snapshotPath,
      repositoryPath: file.repositoryPath,
      expectedSha256: file.sha256,
      actualSha256,
      expectedBytes: file.bytes,
      actualBytes: bytes.length,
      sizeOk,
      hashOk,
      ok: sizeOk && hashOk,
    });
  }

  return {
    schema: 'senda-snapshot-verification/v1',
    checkedAtUTC: new Date().toISOString(),
    fileCount: results.length,
    ok: results.every((entry) => entry.ok),
    results,
  };
}

export const SNAPSHOT_RAW_KEYS = Object.freeze({
  'source-registry': 'src/data/snapshot/source-registry.json',
  'tfl-cameras': 'src/data/snapshot/tfl-cameras.json',
  'caltrans-corridors': 'src/data/snapshot/caltrans-corridors.json',
  estado: 'src/data/snapshot/estado.json',
});

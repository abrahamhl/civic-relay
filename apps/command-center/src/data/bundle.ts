import registry from './snapshot/source-registry.json';
import tfl from './snapshot/tfl-cameras.json';
import caltrans from './snapshot/caltrans-corridors.json';
import estado from './snapshot/estado.json';
import manifest from './snapshot/manifest.json';
import sourceRegistryRaw from './snapshot/source-registry.json?raw';
import tflRaw from './snapshot/tfl-cameras.json?raw';
import caltransRaw from './snapshot/caltrans-corridors.json?raw';
import estadoRaw from './snapshot/estado.json?raw';
import { buildEvidenceBundle } from './adapter.mjs';

export const evidence = buildEvidenceBundle({
  registry,
  tfl,
  caltrans,
  estado,
  manifest,
});

export const snapshotManifest = manifest;

// Exact bytes that the renderer consumed. The integrity check hashes these
// strings, not a re-serialised object, so a mismatch is meaningful.
const RAW_BY_PATH: Record<string, string> = {
  'src/data/snapshot/source-registry.json': sourceRegistryRaw,
  'src/data/snapshot/tfl-cameras.json': tflRaw,
  'src/data/snapshot/caltrans-corridors.json': caltransRaw,
  'src/data/snapshot/estado.json': estadoRaw,
};

export function readSnapshotText(path: string): string {
  const text = RAW_BY_PATH[path];
  if (text === undefined) throw new Error(`unknown snapshot path: ${path}`);
  return text;
}

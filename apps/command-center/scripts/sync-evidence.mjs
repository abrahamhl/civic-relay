import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..', '..');

const inputs = [
  {
    id: 'source-registry',
    source: 'packages/senda/data/source-registry.v021.json',
    output: 'source-registry.json',
    role: 'Official provider documentation registry (v0.21)',
  },
  {
    id: 'tfl-cameras',
    source: 'investor-next/public/senda/data/referencias/tfl_camaras.json',
    output: 'tfl-cameras.json',
    role: 'TfL JamCams recorded-clip derived counts (YOLOX-s + ByteTrack)',
  },
  {
    id: 'caltrans-corridors',
    source: 'investor-next/public/senda/data/referencias/caltrans_corredores.json',
    output: 'caltrans-corridors.json',
    role: 'Caltrans CCTV recorded-clip derived counts and estimated speeds',
  },
  {
    id: 'estado',
    source: 'investor-next/public/senda/estado.json',
    output: 'estado.json',
    role: 'Last recorded local test status snapshot',
  },
];

const outDir = path.join(appRoot, 'src', 'data', 'snapshot');
await mkdir(outDir, { recursive: true });

const manifest = {
  schema: 'senda-command-center-evidence-snapshot/v1',
  generatedAtUTC: new Date().toISOString(),
  note: 'Byte-identical copies of repository evidence. SHA-256 binds the UI snapshot to the committed source. This is a snapshot, not a live feed.',
  files: [],
};

for (const input of inputs) {
  const absolute = path.join(repoRoot, input.source);
  const bytes = await readFile(absolute);
  await writeFile(path.join(outDir, input.output), bytes);
  manifest.files.push({
    id: input.id,
    role: input.role,
    repositoryPath: input.source,
    snapshotPath: `src/data/snapshot/${input.output}`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

await writeFile(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8',
);

console.log(`Evidence snapshot written to ${outDir}`);
for (const file of manifest.files) {
  console.log(`  ${file.sha256.slice(0, 16)}  ${file.bytes.toString().padStart(7)}  ${file.repositoryPath}`);
}

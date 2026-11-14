import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { canonicalPriors } from '../lib/precision-lab.mjs';

const target = fileURLToPath(new URL('../public/data/inference-priors.v1.json', import.meta.url));
const priors = JSON.parse(await readFile(target, 'utf8'));
const digest = createHash('sha256').update(canonicalPriors(priors), 'utf8').digest('hex');
const sealed = {
  ...priors,
  integrity: {
    algorithm: 'SHA-256',
    digest,
    canonical: 'sorted-keys/no-whitespace/excludes-integrity',
  },
};
await writeFile(target, `${JSON.stringify(sealed, null, 2)}\n`, 'utf8');
console.log(`sealed ${target}`);
console.log(`sha256 ${digest}`);

#!/usr/bin/env node
/** Copia el núcleo probado a la app web (investor-next/public/senda/core) sin transformarlo. */
import { cpSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../src'), dst = resolve(here, '../../../investor-next/public/senda/core');
mkdirSync(dst, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.mjs'));
for (const f of files) cpSync(resolve(src, f), resolve(dst, f));
// Bóveda de defensa: se publica aparte en core/defense/ y se retiran copias antiguas de la raíz.
const vaultSrc = resolve(src, 'defense'), vaultDst = resolve(dst, 'defense');
mkdirSync(vaultDst, { recursive: true });
const vault = readdirSync(vaultSrc).filter((f) => f.endsWith('.mjs'));
for (const f of vault) {
  cpSync(resolve(vaultSrc, f), resolve(vaultDst, f));
  if (f !== 'index.mjs' && existsSync(resolve(dst, f))) rmSync(resolve(dst, f));
}
// ARR experimental (H-ARR-1 / H2): copia exacta sin duplicación para el Visor Científico Temporal/4D offline.
const arrRoot = resolve(here, '../../../experimental/senda-arr');
const arrDst = resolve(here, '../../../investor-next/public/senda/arr');
if (existsSync(arrRoot)) {
  mkdirSync(resolve(arrDst, 'data'), { recursive: true });
  mkdirSync(resolve(arrDst, 'results'), { recursive: true });
  for (const f of ['arr-core.mjs', 'arr-sim.mjs', 'arr-forecast.mjs']) {
    if (existsSync(resolve(arrRoot, 'src', f))) cpSync(resolve(arrRoot, 'src', f), resolve(arrDst, f));
  }
  for (const f of ['geomac-2018-camp.json', 'geomac-2018-carr.json', 'geomac-2018-woolsey.json']) {
    if (existsSync(resolve(arrRoot, 'data', f))) cpSync(resolve(arrRoot, 'data', f), resolve(arrDst, 'data', f));
  }
  for (const f of ['results.json', 'forecast-results.json']) {
    if (existsSync(resolve(arrRoot, 'results', f))) cpSync(resolve(arrRoot, 'results', f), resolve(arrDst, 'results', f));
  }
}
console.log(`núcleo sincronizado: ${files.length} módulos civiles + ${vault.length} de la bóveda de defensa → ${dst}`);

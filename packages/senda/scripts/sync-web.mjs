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
console.log(`núcleo sincronizado: ${files.length} módulos civiles + ${vault.length} de la bóveda de defensa → ${dst}`);

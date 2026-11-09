#!/usr/bin/env node
/** Copia el núcleo probado a la app web (investor-next/public/senda/core) sin transformarlo. */
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../src'), dst = resolve(here, '../../../investor-next/public/senda/core');
mkdirSync(dst, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.mjs'));
for (const f of files) cpSync(resolve(src, f), resolve(dst, f));
console.log(`núcleo sincronizado: ${files.length} módulos → ${dst}`);

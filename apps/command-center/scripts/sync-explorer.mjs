#!/usr/bin/env node
// Copia el Explorador 3D y los simuladores 4D (Incendio, DANA) de la web al escritorio (public/senda) antes de compilar,
// para que web, app y escritorio usen EXACTAMENTE el mismo código. La copia no se versiona (ver .gitignore).
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), src = join(here, '..', '..', '..', 'investor-next', 'public', 'senda'), dst = join(here, '..', 'public', 'senda');
const FILES = ['explorador.html', 'explorador.mjs', 'incendio4d.html', 'incendio4d.mjs', 'dana4d.html', 'dana4d.mjs', 'app-chrome.mjs', 'save-file.mjs', 'icon.svg', 'core', 'data/smv2026', 'data/dana2024', 'data/radio/poyo.json', 'vendor/maplibre-gl-4.7.1', 'fonts'];
rmSync(dst, { recursive: true, force: true }); mkdirSync(dst, { recursive: true });
for (const f of FILES) { if (!existsSync(join(src, f))) throw new Error(`falta ${f}`); cpSync(join(src, f), join(dst, f), { recursive: true }); }
rmSync(join(dst, 'core', 'defense'), { recursive: true, force: true }); // la bóveda de defensa no viaja con las superficies civiles
mkdirSync(join(dst, 'previews'), { recursive: true });
for (const id of ['mapa', 'claro', 'noche', 'satelite', 'relieve', 'topo', 'dia', 'termico', 'nubes', 'luces', 'falso', 'fuego', 'vegetacion', 'nieve', 'aerosoles']) cpSync(join(src, 'previews', `map-${id}.webp`), join(dst, 'previews', `map-${id}.webp`));
console.log(`Explorador 3D y simuladores 4D copiados al escritorio: ${FILES.length} entradas + 15 vistas previas (sin la bóveda de defensa)`);

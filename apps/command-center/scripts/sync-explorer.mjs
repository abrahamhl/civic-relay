#!/usr/bin/env node
// Copia el Explorador 3D de la web (investor-next/public/senda) al escritorio (public/senda) antes de compilar,
// para que web, app y escritorio usen EXACTAMENTE el mismo código. La copia no se versiona (ver .gitignore).
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), src = join(here, '..', '..', '..', 'investor-next', 'public', 'senda'), dst = join(here, '..', 'public', 'senda');
const FILES = ['explorador.html', 'explorador.mjs', 'app-chrome.mjs', 'save-file.mjs', 'icon.svg', 'core/map-style.mjs', 'core/geo-survey.mjs', 'vendor/maplibre-gl-4.7.1', 'fonts'];
rmSync(dst, { recursive: true, force: true }); mkdirSync(dst, { recursive: true });
for (const f of FILES) { if (!existsSync(join(src, f))) throw new Error(`falta ${f}`); cpSync(join(src, f), join(dst, f), { recursive: true }); }
mkdirSync(join(dst, 'previews'), { recursive: true });
for (const id of ['mapa', 'claro', 'noche', 'satelite', 'relieve', 'topo', 'dia', 'termico', 'nubes', 'luces', 'falso', 'fuego', 'vegetacion', 'nieve', 'aerosoles']) cpSync(join(src, 'previews', `map-${id}.webp`), join(dst, 'previews', `map-${id}.webp`));
console.log(`Explorador 3D copiado al escritorio: ${FILES.length} entradas + 15 vistas previas`);

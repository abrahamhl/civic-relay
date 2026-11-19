// Genera los vectores de conformidad del arranque automático (Android y iOS deben reproducirlos).
// Uso: node packages/senda/scripts/build-autostart-vectors.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAutostartVectors, EXAMPLE_AUTOSTART } from '../src/drive-autostart.mjs';
const out = fileURLToPath(new URL('../conformance/drive-autostart.vectors.txt', import.meta.url));
writeFileSync(out, buildAutostartVectors(EXAMPLE_AUTOSTART));
console.log(`vectores escritos en ${out} (parámetros: EXAMPLE_AUTOSTART, ejemplo declarado)`);

#!/usr/bin/env node
/**
 * Valida un guion de vídeo antes de gastar CPU: node validate.mjs <nombre> [lang]
 * Comprueba ids únicos, tipos de escena conocidos, que cada escena «page» apunte a una página con ese
 * data-viz, que lo leído (<lang>) y lo pronunciado (<lang>_say) tengan las mismas frases, longitudes
 * razonables, títulos presentes y frases prohibidas (promesas falsas). Sale con código 1 si hay errores.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), name = process.argv[2] || 'script', lang = process.argv[3] || 'es';
const cfg = JSON.parse(readFileSync(resolve(here, `${name}.json`), 'utf8')), pub = resolve(here, '../../investor-next/public');
const KINDS = new Set(['hub', 'kpis', 'shots', 'stack', 'verify', 'page', 'call', 'howsim', 'cta', 'arch3d', 'drone3d']);
const BANNED = [/sustituye (al|el) 112/i, /reemplaza (al|el) 112/i, /garantiza(mos)? (que )?(salvar|sobrevivir)/i, /100 ?% (seguro|fiable)/i, /replaces? (the )?112/i];
// Un aviso negado («SENDA never replaces 112», «nunca sustituye al 112») es lo contrario de una promesa falsa.
const NEG = /\b(never|not|no|nunca|jamás|doesn't|does not|won't|cannot)\s+$/i;
const errs = [], warn = [], ids = new Set();
if (!cfg.voices?.[lang]) errs.push(`no hay voz para «${lang}» en voices`);
for (const s of cfg.scenes ?? []) {
  const at = `escena ${s.id}`;
  if (!s.id || ids.has(s.id)) errs.push(`${at}: id ausente o repetido`); ids.add(s.id);
  if (!KINDS.has(s.visual?.kind)) errs.push(`${at}: tipo de escena desconocido «${s.visual?.kind}»`);
  if (!s.title?.[lang]) errs.push(`${at}: falta title.${lang}`);
  const read = s[lang], say = s[`${lang}_say`] ?? read;
  if (!Array.isArray(read) || !read.length) errs.push(`${at}: falta el texto «${lang}»`);
  else if (say.length !== read.length) errs.push(`${at}: «${lang}» tiene ${read.length} frases y «${lang}_say» ${say.length}`);
  for (const t of [...(read ?? []), ...(say ?? [])]) { if (t.length > 260) warn.push(`${at}: frase de ${t.length} caracteres (más de 260 cansa)`); for (const b of BANNED) for (const m of t.matchAll(new RegExp(b.source, 'gi'))) if (!NEG.test(t.slice(0, m.index))) errs.push(`${at}: promesa prohibida «${m[0]}»`); }
  for (const t of say ?? []) if (/[→²³±≤≥%]|m\/s/.test(t)) warn.push(`${at}: «${lang}_say» lleva símbolos que la voz lee mal: escríbelos con palabras`);
  if (s.visual?.kind === 'page') {
    const m = (s.visual.src ?? '').match(/^\/senda\/([\w-]+)\?film=1&viz=([\w-]+)$/);
    if (!m) { errs.push(`${at}: src debe ser /senda/<pagina>?film=1&viz=<id>`); continue; }
    const file = resolve(pub, 'senda', `${m[1]}.html`);
    if (!existsSync(file)) errs.push(`${at}: no existe ${file}`);
    else if (!readFileSync(file, 'utf8').includes(`data-viz="${m[2]}"`)) errs.push(`${at}: la página ${m[1]} no tiene data-viz="${m[2]}"`);
  }
}
const words = (cfg.scenes ?? []).flatMap((s) => s[`${lang}_say`] ?? s[lang] ?? []).join(' ').split(/\s+/).length;
console.log(`${name}.json · ${cfg.scenes?.length ?? 0} escenas · ~${Math.round(words / 2.6)} s de voz estimados (${lang})`);
warn.forEach((w) => console.log('AVISO ·', w)); errs.forEach((e) => console.log('ERROR ·', e));
process.exit(errs.length ? 1 : 0);

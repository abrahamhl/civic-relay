#!/usr/bin/env node
// Valida un guion (script.json, ruta.json, m95-*.json, …) ANTES de sintetizar voz o grabar vídeo.
// Uso: node validate.mjs [nombre|ruta.json] [es|en]
// Falla cerrado (exit 1) si hay cualquier defecto.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawName = process.argv[2] || 'script';
const lang = process.argv[3] || 'es';

function resolveScriptPath(input) {
  if (fs.existsSync(input) && fs.statSync(input).isFile()) return path.resolve(input);
  const base = input.replace(/\.json$/i, '');
  const p = path.join(__dirname, `${base}.json`);
  if (fs.existsSync(p)) return p;
  throw new Error(`No existe guion: ${input}`);
}

const scriptPath = resolveScriptPath(rawName);
const name = path.basename(scriptPath, '.json');
const isM95 = name.startsWith('m95-');

const doc = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const errs = [];
const warns = [];

if (!doc.voices?.[lang]?.voice) errs.push(`voices.${lang}.voice ausente`);
if (!Array.isArray(doc.scenes) || doc.scenes.length < 1) errs.push(`pocas escenas (${doc.scenes?.length})`);

// Siglas técnicas que en español DEBEN ir en es_say deletreadas o adaptadas si aparecen en es[]
const ACRONYMS_ES = /\b(112|DATEX\s*II|QO-100|LoRa|GPS|SOS|V16|CSI|RTT|UWB|LWR|NTRIP|RTCM|AED|PAS|Bluetooth|Wi-Fi|Docker|Android|Reed-Solomon|Ed25519)\b/g;
// Símbolos que un TTS lee mal en cualquier idioma
const BAD_SYMBOLS_SAY = /[%→²≤≥≈]/;
// Tokens fonéticos exclusivos de *_say que NUNCA deben aparecer en subtítulos (es/en/nl)
const SAY_LEAK_RE = /\b(one one two|Q O one hundred|LOR-ah|E D twenty-five fifty-one nine|S O S|G P S|D G T|S M S|Blutuz|uifi|Dóquer|Rid Sólomon)\b/i;
// Afirmaciones prohibidas (SENDA nunca sustituye al 112 ni afirma estar certificado ni tener 9.5/10)
const FORBIDDEN_CLAIMS_RE = /(?<!never\s)(?<!not\s)\breplaces\s+112\b|(?<!nunca\s)(?<!no\s)\bsustituye\s+(?:al\s+|tu\s+atenci[oó]n\s+ni\s+el\s+)?112\b|\b9[.,]5\s*\/\s*10\b/i;

const ids = new Set();
let totalChars = 0;
let totalLines = 0;

for (const sc of doc.scenes || []) {
  const pfx = `[${sc.id || '?'}]`;
  if (!sc.id) errs.push(`${pfx} sin id`);
  if (ids.has(sc.id)) errs.push(`${pfx} id duplicado`);
  ids.add(sc.id);

  const reqLangs = isM95 ? ['es', 'en', 'nl'] : [lang];
  for (const rl of reqLangs) {
    const t = typeof sc.title === 'object' ? sc.title?.[rl] : sc.title;
    if (!t || typeof t !== 'string' || t.trim().length < 2) {
      if (rl === 'nl' && !isM95) continue;
      errs.push(`${pfx} title.${rl} vacío`);
    }
  }

  const sub = sc[lang];
  if (!Array.isArray(sub) || sub.length === 0) {
    errs.push(`${pfx} ${lang}[] vacío`);
    continue;
  }

  if (isM95) {
    for (const subLang of ['es', 'en', 'nl']) {
      if (!Array.isArray(sc[subLang]) || sc[subLang].length !== sub.length) {
        errs.push(`${pfx} ${subLang}[] (${sc[subLang]?.length}) != ${lang}[] (${sub.length})`);
      } else {
        sc[subLang].forEach((line, idx) => {
          if (typeof line !== 'string' || !line.trim()) {
            errs.push(`${pfx} ${subLang}[${idx}] vacío`);
          }
          if (SAY_LEAK_RE.test(line)) {
            errs.push(`${pfx} ${subLang}[${idx}] contiene texto fonético de _say: "${line}"`);
          }
          if (FORBIDDEN_CLAIMS_RE.test(line)) {
            errs.push(`${pfx} ${subLang}[${idx}] contiene afirmación prohibida: "${line}"`);
          }
        });
      }
    }
    if (!sc.claim || !['OBSERVED', 'CALCULATED', 'SIMULATED', 'INFERRED'].includes(sc.claim)) {
      errs.push(`${pfx} claim inválido o ausente (${sc.claim})`);
    }
    if (!Array.isArray(sc.source) || sc.source.length === 0) {
      errs.push(`${pfx} source[] ausente en guion m95`);
    }
  }

  const say = sc[`${lang}_say`] || sub;
  if (say.length !== sub.length) {
    errs.push(`${pfx} ${lang}_say (${say.length} frases) != ${lang} (${sub.length} frases)`);
  }

  sub.forEach((line, i) => {
    if (typeof line !== 'string' || !line.trim()) errs.push(`${pfx} ${lang}[${i}] vacío`);
    if (line.length > 260) warns.push(`${pfx} ${lang}[${i}] muy larga (${line.length} car.)`);
    if (SAY_LEAK_RE.test(line)) errs.push(`${pfx} ${lang}[${i}] contiene fonética _say`);
    totalChars += line.length;
    totalLines++;
  });

  say.forEach((line, i) => {
    if (typeof line !== 'string' || !line.trim()) errs.push(`${pfx} ${lang}_say[${i}] vacío`);
    if (BAD_SYMBOLS_SAY.test(line)) {
      errs.push(`${pfx} ${lang}_say[${i}] contiene símbolos no pronunciables (% → ² ≤): "${line}"`);
    }
  });

  if (lang === 'es' && !sc.es_say) {
    const joined = sub.join(' ');
    const m = joined.match(ACRONYMS_ES);
    if (m) warns.push(`${pfx} tiene siglas (${[...new Set(m)].join(', ')}) y no define es_say`);
  }

  const v = sc.visual;
  if (!v?.kind) errs.push(`${pfx} sin visual.kind`);
  if (v?.kind === 'page') {
    if (!v.src || !v.src.startsWith('/senda/')) errs.push(`${pfx} page.src inválido: ${v?.src}`);
    const pageName = v.src.split('?')[0].replace(/^\/senda\//, '');
    const htmlFile = path.resolve(__dirname, '../../investor-next/public/senda', `${pageName}.html`);
    if (!fs.existsSync(htmlFile)) errs.push(`${pfx} no existe ${htmlFile}`);
    const q = new URL('http://x' + v.src).searchParams;
    if (q.get('film') !== '1') errs.push(`${pfx} page.src debe llevar film=1 (${v.src})`);
    const viz = q.get('viz');
    if (viz && fs.existsSync(htmlFile)) {
      const html = fs.readFileSync(htmlFile, 'utf8');
      if (!html.includes(`data-viz="${viz}"`) && !html.includes(`VIZ === '${viz}'`)) {
        errs.push(`${pfx} viz="${viz}" no encontrado en ${pageName}.html`);
      }
    }
  }
}

// Estimación de duración (~14 car./s a 0.95x + pausas)
const estSec = Math.round(totalChars / 14 + totalLines * 0.35 + (doc.scenes?.length || 0) * 1.6);
console.log(
  `validate ${name} [${lang}] · ${doc.scenes?.length} escenas · ${totalLines} frases · ${totalChars} car. · ~${estSec}s (${(estSec / 60).toFixed(1)} min)`
);
for (const w of warns) console.warn('  WARN:', w);
for (const e of errs) console.error('  ERROR:', e);
if (errs.length) process.exit(1);

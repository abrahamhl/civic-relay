#!/usr/bin/env node
// Validador estricto de archivos WebVTT (.vtt) para SENDA Mission 9.5.
// Uso: node media/senda-film/check-vtt.mjs <archivo1.vtt> [archivo2.vtt ...]
import fs from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Uso: node check-vtt.mjs <archivo.vtt> [...]');
  process.exit(1);
}

const SAY_LEAK_RE = /\b(one one two|Q O one hundred|LOR-ah|E D twenty-five fifty-one nine|S O S|G P S|D G T|S M S|Blutuz|uifi|Dóquer|Rid Sólomon)\b/i;

function toSec(ts) {
  const [h, m, s] = ts.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s.replace(',', '.'));
}

let failed = false;
const cueCounts = new Map();

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (!raw.startsWith('WEBVTT\n')) {
    console.error(`[FAIL] ${file}: falta cabecera WEBVTT`);
    failed = true;
    continue;
  }
  const blocks = raw.trim().split(/\n\n+/).slice(1);
  if (blocks.length === 0) {
    console.error(`[FAIL] ${file}: 0 cues encontrados`);
    failed = true;
    continue;
  }
  let prevEnd = 0;
  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n');
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) {
      console.error(`[FAIL] ${file} cue ${i + 1}: sin marca de tiempo`);
      failed = true;
      continue;
    }
    const m = lines[timeLineIdx].match(/^(\d\d:\d\d:\d\d[.,]\d\d\d)\s+-->\s+(\d\d:\d\d:\d\d[.,]\d\d\d)/);
    if (!m) {
      console.error(`[FAIL] ${file} cue ${i + 1}: formato inválido "${lines[timeLineIdx]}"`);
      failed = true;
      continue;
    }
    const start = toSec(m[1]);
    const end = toSec(m[2]);
    const dur = end - start;
    if (!(end > start)) {
      console.error(`[FAIL] ${file} cue ${i + 1}: end <= start (${m[1]} --> ${m[2]})`);
      failed = true;
    }
    if (start < prevEnd - 0.01) {
      console.error(`[FAIL] ${file} cue ${i + 1}: solapamiento (${start} < ${prevEnd})`);
      failed = true;
    }
    if (dur < 0.4 || dur > 25.0) {
      console.error(`[FAIL] ${file} cue ${i + 1}: duración fuera de rango (${dur.toFixed(2)}s)`);
      failed = true;
    }
    prevEnd = end;
    const textLines = lines.slice(timeLineIdx + 1);
    const fullText = textLines.join(' ').trim();
    if (!fullText) {
      console.error(`[FAIL] ${file} cue ${i + 1}: texto vacío`);
      failed = true;
    }
    if (SAY_LEAK_RE.test(fullText)) {
      console.error(`[FAIL] ${file} cue ${i + 1}: texto fonético _say detectado en subtítulo: "${fullText}"`);
      failed = true;
    }
  }
  cueCounts.set(file, blocks.length);
  console.log(`[OK] ${file} (${blocks.length} cues, fin ${prevEnd.toFixed(2)}s)`);
}

if (failed) process.exit(1);

#!/usr/bin/env node
// Monta la PELÍCULA FINAL de SENDA (ES):
//   1. Avance: escenas a0–a1 de senda-final (radar real + «dos capítulos»).
//   2. Capítulo 1: la película del 10-11-2026 (m96, completa, tal cual se publicó).
//   3. Capítulo 2: escenas b0–b20 de senda-final (lo nuevo).
// Subtítulos ES unidos con sus desfases, capítulos navegables y codificación a dos pasadas con un tamaño
// objetivo ≤ 95 MB (límite de 100 MB por archivo en GitHub).
// Uso: node assemble-final.mjs   (antes: render.mjs senda-final es)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '../..'), B = path.join(here, 'build');
const media = path.join(repo, 'investor-next/public/media');
// La m96 se vuelve a renderizar con las cifras de hoy (build/); si no existe, se usa la publicada.
const NEW = path.join(B, 'senda-senda-final-es.mp4'), M96B = path.join(B, 'senda-m96-promo-es.mp4');
const M96 = fs.existsSync(M96B) ? M96B : path.join(media, 'm96/senda-m96-promo-es.mp4');
const M96VTT = fs.existsSync(path.join(B, 'subtitles-m96-promo-es.vtt')) && fs.existsSync(M96B) ? path.join(B, 'subtitles-m96-promo-es.vtt') : path.join(media, 'm96/senda-m96-promo-es.vtt');
const OUT = path.join(media, 'senda-pelicula-final-es.mp4'), OUTVTT = path.join(media, 'senda-pelicula-final-es.vtt');
const TARGET_MB = Number(process.env.TARGET_MB || 95);
const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const tl = JSON.parse(fs.readFileSync(path.join(B, 'timings-senda-final-es.json'), 'utf8'));
const script = JSON.parse(fs.readFileSync(path.join(here, 'senda-final.json'), 'utf8'));
const cut = tl.scenes.find((s) => s.id === 'b0').start, dNew = probe(NEW), dM96 = probe(M96);
const total = cut + dM96 + (dNew - cut);

// ─── subtítulos ───
const parse = (txt) => txt.split(/\n\n+/).map((b) => { const m = b.match(/(\d+):(\d+):([\d.]+) --> (\d+):(\d+):([\d.]+)\n([\s\S]+)/); if (!m) return null; const s = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]), e = (+m[4]) * 3600 + (+m[5]) * 60 + (+m[6]); return { s, e, t: m[7].trim() }; }).filter(Boolean);
const fmt = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t - h * 3600 - m * 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; };
const subNew = parse(fs.readFileSync(path.join(B, 'subtitles-senda-final-es.vtt'), 'utf8'));
const subM96 = parse(fs.readFileSync(M96VTT, 'utf8'));
console.log(`m96: ${path.relative(repo, M96)}`);
const cues = [...subNew.filter((c) => c.s < cut).map((c) => ({ ...c, e: Math.min(c.e, cut) })), ...subM96.map((c) => ({ s: c.s + cut, e: c.e + cut, t: c.t })), ...subNew.filter((c) => c.s >= cut).map((c) => ({ s: c.s + dM96, e: c.e + dM96, t: c.t }))];
fs.writeFileSync(OUTVTT, 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${fmt(c.s)} --> ${fmt(c.e)}\n${c.t}`).join('\n\n') + '\n');

// ─── capítulos ───
const title = (id) => script.scenes.find((s) => s.id === id).title.es;
const ch = [{ t: 0, n: 'Avance · ' + title('a0') }, { t: cut, n: 'Capítulo 1 · La película del 10 de noviembre de 2026' },
  ...tl.scenes.filter((s) => s.id.startsWith('b')).map((s) => ({ t: s.start + dM96, n: `Capítulo 2 · ${title(s.id)}` }))];
fs.writeFileSync(path.join(media, 'senda-pelicula-final-capitulos.vtt'), 'WEBVTT\n\n' + ch.map((c, i) => `${i + 1}\n${fmt(c.t)} --> ${fmt(ch[i + 1]?.t ?? total)}\n${c.n}`).join('\n\n') + '\n');
const meta = path.join(B, 'final-chapters.txt');
fs.writeFileSync(meta, ';FFMETADATA1\ntitle=SENDA · Película final (noviembre de 2026)\nartist=SENDA\n' + ch.map((c, i) => `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(c.t * 1000)}\nEND=${Math.round((ch[i + 1]?.t ?? total) * 1000)}\ntitle=${c.n.replace(/[=;#\\\n]/g, ' ')}`).join('\n') + '\n');

// ─── vídeo ───
const kbps = Math.floor((TARGET_MB * 8 * 1024) / total) - 112; // vídeo; 96 kbit/s de audio + margen del contenedor
// Concatenador por lista (streaming, sin cargar el vídeo en memoria): avance · m96 · capítulo 2.
const list = path.join(B, 'final-concat.txt');
fs.writeFileSync(list, `ffconcat version 1.0\nfile '${NEW}'\noutpoint ${cut}\nfile '${M96}'\nfile '${NEW}'\ninpoint ${cut}\n`);
const common = ['-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=25,scale=1920:1080,setsar=1', '-c:v', 'libx264', '-preset', 'medium', '-b:v', `${kbps}k`, '-pix_fmt', 'yuv420p'];
console.log(`montaje: avance ${cut.toFixed(1)} s + m96 ${dM96.toFixed(1)} s + nuevo ${(dNew - cut).toFixed(1)} s = ${(total / 60).toFixed(1)} min · vídeo ${kbps} kbit/s`);
const pass = path.join(B, 'final-pass');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...common, '-pass', '1', '-passlogfile', pass, '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
const tmp = path.join(B, 'final-av.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...common, '-pass', '2', '-passlogfile', pass, '-af', 'aresample=48000', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', tmp], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-i', OUTVTT, '-i', meta, '-map', '0', '-map', '1', '-map_metadata', '2', '-map_chapters', '2', '-c', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=spa', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
fs.rmSync(tmp, { force: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '12', '-i', OUT, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', path.join(media, 'senda-pelicula-final-poster.jpg')]);
const mb = fs.statSync(OUT).size / 1048576;
console.log(`=> ${OUT} · ${mb.toFixed(1)} MB · ${(probe(OUT) / 60).toFixed(2)} min · ${ch.length} capítulos · ${cues.length} subtítulos`);
if (mb >= 100) { console.error('supera 100 MB: GitHub no lo aceptará'); process.exitCode = 1; }

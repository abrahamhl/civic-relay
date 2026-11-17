#!/usr/bin/env node
/**
 * SENDA · Genera la carpeta de entrega autocontenida `entrega/`:
 *   - la web ESTÁTICA lista para subir a Hostinger (o cualquier Apache/LiteSpeed) con su `.htaccess`;
 *   - los zips del código, la documentación, las evidencias y la visión, con su huella SHA-256;
 *   - LEEME_PRIMERO (md y html) para quien no ha seguido la sesión.
 *
 * Uso:
 *   node scripts/entrega/generar-entrega.mjs                     # usa investor-next/out ya construido
 *   node scripts/entrega/generar-entrega.mjs --build             # construye antes (npm run build)
 *   SITE_URL=https://tudominio.es node scripts/entrega/generar-entrega.mjs --build   # con tu dominio
 *
 * Los zips son DETERMINISTAS: si nada cambia, los bytes son idénticos y git no crece al regenerar.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeZip } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'investor-next/out'), DEST = join(ROOT, 'entrega'), ZIPS = join(DEST, 'zips');
const SITE_URL = process.env.SITE_URL || 'https://civic-relay-investor.vercel.app';
const BIG = 20 * 1024 * 1024; // ficheros web mayores de 20 MB van en su propio zip (límite cómodo de GitHub: 50 MB)
const sh = (c, o = {}) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...o }).trim();
const mb = (b) => `${(b / 1048576).toFixed(1).replace('.', ',')} MB`;
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

if (process.argv.includes('--build')) {
  console.log(`· Construyendo la web con SITE_URL=${SITE_URL}…`);
  execSync('npm run build', { cwd: join(ROOT, 'investor-next'), stdio: 'inherit', env: { ...process.env, SITE_URL } });
}
if (!existsSync(join(OUT, 'senda/index.html'))) { console.error('Falta investor-next/out: ejecuta con --build o «cd investor-next && npm run build».'); process.exit(1); }

// ---------------------------------------------------------------- .htaccess para Apache/LiteSpeed (Hostinger)
export const HTACCESS = `# SENDA · configuración para Hostinger (LiteSpeed) o Apache. Va en public_html/ junto a index.html.
# Replica lo que hacía Vercel: URL limpias (/senda/fuego → fuego.html), tipos MIME de los módulos y caché.

Options -MultiViews -Indexes
DirectorySlash Off
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
RewriteEngine On

# 1) HTTPS obligatorio (el modo sin conexión necesita HTTPS). No se aplica en localhost para poder probar.
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !https
RewriteCond %{HTTP_HOST} !^(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# 2) Quitar la barra final si existe la página .html (/es/ → /es)
RewriteCond %{REQUEST_URI} ^(.+)/$
RewriteCond %{DOCUMENT_ROOT}%1.html -f
RewriteRule ^ %1 [L,R=301]

# 3) URL limpia → fichero .html (/senda/fuego → /senda/fuego.html)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{DOCUMENT_ROOT}%{REQUEST_URI}.html -f
RewriteRule ^ %{REQUEST_URI}.html [L]

# 4) Carpeta → su index.html SIN redirigir (/senda → /senda/index.html), como espera el service worker
RewriteCond %{REQUEST_FILENAME} -d
RewriteCond %{REQUEST_FILENAME}/index.html -f
RewriteRule ^(.*?)/?$ $1/index.html [L]

# 5) Copia descargable del documento maestro
RewriteRule ^vision-master\\.md$ vision-master.txt [L]
</IfModule>

# Tipos MIME: sin esto los módulos .mjs no cargan («Failed to load module script»)
AddType text/javascript .js .mjs
AddType application/json .json
AddType application/manifest+json .webmanifest
AddType text/vtt .vtt
AddType image/svg+xml .svg
AddType font/woff2 .woff2
AddType video/mp4 .mp4
AddType application/wasm .wasm
AddType text/markdown .md
AddDefaultCharset utf-8
AddCharset utf-8 .html .css .js .mjs .json .txt .md .vtt .webmanifest .svg

<IfModule mod_headers.c>
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Permissions-Policy "geolocation=(self), camera=(self), microphone=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)"
<FilesMatch "\\.(html|json|webmanifest)$">
Header set Cache-Control "no-cache"
</FilesMatch>
<Files "senda-sw.js">
Header set Cache-Control "no-cache, no-store, must-revalidate"
Header set Service-Worker-Allowed "/"
</Files>
<FilesMatch "\\.(mp4|jpg|jpeg|png|webp|svg|woff2|vtt)$">
Header set Cache-Control "public, max-age=2592000"
</FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css text/javascript application/json application/manifest+json image/svg+xml text/vtt text/markdown text/plain
</IfModule>
`;
const HTACCESS_NEXT_STATIC = `# Ficheros con huella en el nombre: se pueden guardar un año sin riesgo.
<IfModule mod_headers.c>
Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
`;

// ---------------------------------------------------------------- Recolectar ficheros
function walk(dir, base = dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p, base, acc); else if (e.isFile()) acc.push(relative(base, p).split('\\').join('/')); }
  return acc;
}
const commit = (() => { try { return sh('git rev-parse --short HEAD'); } catch { return 'sin-git'; } })();
const dirty = (() => { try { return sh("git status --porcelain -- . ':!entrega'").length > 0; } catch { return false; } })();
rmSync(ZIPS, { recursive: true, force: true }); mkdirSync(ZIPS, { recursive: true });

const web = walk(OUT).map((name) => ({ name, path: join(OUT, name) }));
const big = web.filter((f) => statSync(f.path).size > BIG), small = web.filter((f) => statSync(f.path).size <= BIG);
const read = (f) => ({ name: f.name, data: readFileSync(f.path) });
const zips = [];
function add(file, title, entries, note) {
  const r = writeZip(join(ZIPS, file), entries), h = sha(readFileSync(join(ZIPS, file)));
  zips.push({ file, title, note, files: r.files, bytes: r.bytes, sha256: h }); console.log(`· ${file}: ${r.files} ficheros, ${mb(r.bytes)}`);
}
add('1-web-hostinger.zip', 'Web completa para subir a public_html (sin las dos películas largas)',
  [...small.map(read), { name: '.htaccess', data: Buffer.from(HTACCESS) }, { name: '_next/static/.htaccess', data: Buffer.from(HTACCESS_NEXT_STATIC) }],
  'Descomprime en public_html. Contiene .htaccess (fichero oculto).');
big.forEach((f, i) => add(`${2 + i}-web-video-${f.name.split('/').pop().replace(/\.[^.]+$/, '')}.zip`, `Vídeo de la web: ${f.name}`, [read(f)], 'Descomprime también en public_html: se coloca solo en media/.'));
let n = 2 + big.length;

// Código fuente: lo que está en git, sin vídeos (ya van en la web), sin la propia entrega y sin evidencias
const tracked = sh('git ls-files -z', { maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
const isVideo = (p) => /\.(mp4|webm|mov)$/i.test(p);
const src = tracked.filter((p) => !p.startsWith('entrega/') && !p.startsWith('evidence/') && !isVideo(p) && existsSync(join(ROOT, p)));
add(`${n++}-codigo-fuente.zip`, 'Código fuente completo (núcleo, relé, web, visión, scripts, pruebas)', src.map((p) => ({ name: `senda/${p}`, data: readFileSync(join(ROOT, p)) })), 'Sin los vídeos (van en la web) ni las capturas de evidencias (van aparte).');
const docs = tracked.filter((p) => (p.startsWith('docs/') || /^[^/]+\.md$/.test(p) || p === 'LICENSE') && existsSync(join(ROOT, p)));
add(`${n++}-documentacion.zip`, 'Documentación: traspaso, arquitectura, financiación, investigación y registro de cambios', docs.map((p) => ({ name: `senda-docs/${p}`, data: readFileSync(join(ROOT, p)) })), 'Empieza por docs/handoff/HANDOFF_COMPLETO_2026-11-05.md.');
const ev = tracked.filter((p) => p.startsWith('evidence/') && existsSync(join(ROOT, p)));
add(`${n++}-evidencias.zip`, 'Evidencias: resultados de las pruebas de extremo a extremo y capturas', ev.map((p) => ({ name: `senda-evidencias/${p}`, data: readFileSync(join(ROOT, p)) })), 'offline-e2e.json resume las comprobaciones sin red.');
const vis = tracked.filter((p) => (p.startsWith('packages/senda-vision/') || p.startsWith('investor-next/public/media/vision/')) && existsSync(join(ROOT, p)));
add(`${n++}-vision-python.zip`, 'Visión de tráfico en Python (YOLOX + ByteTrack) con los vídeos anotados', vis.map((p) => ({ name: `senda-vision/${p}`, data: readFileSync(join(ROOT, p)) })), 'Modelos y vídeos de origen se descargan con las instrucciones del README (licencias Apache 2.0, MIT y CC BY 4.0).');

// ---------------------------------------------------------------- Manifiesto, huellas y LEEME
const manifest = { proyecto: 'SENDA', generado: new Date().toISOString().slice(0, 10), commit, cambiosSinCommit: dirty, siteUrl: SITE_URL, zips };
writeFileSync(join(DEST, 'MANIFIESTO.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(DEST, 'SHA256SUMS.txt'), zips.map((z) => `${z.sha256}  zips/${z.file}`).join('\n') + '\n');
writeFileSync(join(DEST, 'hostinger.htaccess'), HTACCESS);
const rows = zips.map((z) => `| \`zips/${z.file}\` | ${z.title} | ${mb(z.bytes)} | ${z.note} |`).join('\n');
const webZips = zips.filter((z) => z.file.includes('-web-')).map((z) => `\`${z.file}\``).join(', ');
const md = readFileSync(join(ROOT, 'scripts/entrega/LEEME_PRIMERO.plantilla.md'), 'utf8')
  .replaceAll('{{FECHA}}', manifest.generado).replaceAll('{{COMMIT}}', commit + (dirty ? ' (con cambios sin commit)' : '')).replaceAll('{{SITE_URL}}', SITE_URL)
  .replaceAll('{{TABLA_ZIPS}}', rows).replaceAll('{{WEB_ZIPS}}', webZips).replaceAll('{{TOTAL}}', mb(zips.reduce((s, z) => s + z.bytes, 0)));
writeFileSync(join(DEST, 'LEEME_PRIMERO.md'), md);
writeFileSync(join(DEST, 'LEEME_PRIMERO.html'), mdToHtml(md));
console.log(`\nEntrega lista en entrega/ (${mb(zips.reduce((s, z) => s + z.bytes, 0))}). Commit ${commit}${dirty ? ' + cambios sin commit' : ''}.`);

/** Conversor Markdown → HTML mínimo (títulos, listas, tablas, código, enlaces, negritas) para abrir el LEEME con doble clic. */
function mdToHtml(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inl = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  const out = []; const L = src.split('\n'); let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (l.startsWith('```')) { const b = []; i++; while (i < L.length && !L[i].startsWith('```')) b.push(esc(L[i++])); i++; out.push(`<pre><code>${b.join('\n')}</code></pre>`); continue; }
    if (/^#{1,4} /.test(l)) { const k = l.match(/^#+/)[0].length; out.push(`<h${k}>${inl(l.slice(k + 1))}</h${k}>`); i++; continue; }
    if (l.startsWith('|')) { const rows = []; while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]); const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim()); const [h, , ...b] = rows; out.push(`<table><thead><tr>${cells(h).map((c) => `<th>${inl(c)}</th>`).join('')}</tr></thead><tbody>${b.map((r) => `<tr>${cells(r).map((c) => `<td>${inl(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
    if (/^(\d+\.|-) /.test(l)) { const ord = /^\d+\./.test(l), items = []; while (i < L.length && /^(\s*)(\d+\.|-) /.test(L[i])) items.push(L[i++].replace(/^\s*(\d+\.|-) /, '')); out.push(`<${ord ? 'ol' : 'ul'}>${items.map((x) => `<li>${inl(x)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`); continue; }
    if (l.startsWith('> ')) { out.push(`<blockquote>${inl(l.slice(2))}</blockquote>`); i++; continue; }
    if (l.trim() === '---') { out.push('<hr>'); i++; continue; }
    if (l.trim()) out.push(`<p>${inl(l)}</p>`); i++;
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SENDA · Léeme primero</title>
<style>:root{--bg:#fff;--t:#111;--m:#555;--l:#ddd;--a:#0b5cad;--c:#f4f6f8}@media(prefers-color-scheme:dark){:root{--bg:#0b141c;--t:#eef2f4;--m:#9fb2bc;--l:#203240;--a:#91d7e8;--c:#071018}}
body{margin:0;background:var(--bg);color:var(--t);font:16px/1.6 system-ui,sans-serif}main{max-width:900px;margin:0 auto;padding:24px 16px 60px}a{color:var(--a)}
table{width:100%;border-collapse:collapse;font-size:14px;display:block;overflow-x:auto}th,td{border-bottom:1px solid var(--l);padding:6px;text-align:left;vertical-align:top}
code{background:var(--c);padding:1px 4px;border-radius:4px;font-size:13px}pre{background:var(--c);padding:12px;border-radius:8px;overflow-x:auto}blockquote{border-left:4px solid var(--a);margin:12px 0;padding:6px 12px;color:var(--m)}</style></head>
<body><main>${out.join('\n')}</main></body></html>\n`;
}

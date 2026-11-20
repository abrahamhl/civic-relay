#!/usr/bin/env node
/**
 * Builds Vercel Build Output API v3 (`investor-next/.vercel/output/`) from the
 * verified static export (`investor-next/out/`), excluding only unreferenced local
 * M95/M96 draft MP4 renders so every embedded video, subtitle, render, paper,
 * and trilingual page deploys cleanly via `vercel deploy --prebuilt --prod`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const OUTPUT = join(ROOT, '.vercel/output');
const STATIC = join(OUTPUT, 'static');

if (!existsSync(join(OUT, 'index.html'))) {
  console.error('Missing investor-next/out/index.html — run pnpm run build first.');
  process.exit(1);
}

const USED_M95_M96 = new Set([
  'media/m95/senda-m95-30s-en.mp4',
  'media/m95/senda-m95-60s-en.mp4',
  'media/m95/senda-m95-90s-en.mp4',
  'media/m95/senda-m95-vertical-45s-en.mp4',
  'media/m95/senda-m95-broadcast-special-en.mp4',
  'media/m95/senda-m95-broadcast-special-es.mp4',
  'media/m95/senda-m95-reel-blacksky-en.mp4',
  'media/m95/senda-m95-reel-blacksky-es.mp4',
  'media/m95/senda-m95-reel-math-en.mp4',
  'media/m95/senda-m95-reel-math-es.mp4',
  'media/m95/senda-m95-role-citizen-en.mp4',
  'media/m95/senda-m95-role-citizen-es.mp4',
  'media/m95/senda-m95-role-developer-en.mp4',
  'media/m95/senda-m95-role-developer-es.mp4',
  'media/m95/senda-m95-sim-braking-en.mp4',
  'media/m95/senda-m95-sim-proof-en.mp4',
  'media/m95/senda-m95-sim-queue-en.mp4',
  'media/m95/senda-m95-sim-sos-en.mp4',
  'media/m95/senda-m95-sim-visibility-en.mp4',
  'media/m95/senda-m95-sim-wrongway-en.mp4',
  'media/m96/senda-m96-promo-en.mp4',
  'media/m96/senda-m96-promo-es.mp4'
]);

const isOptionalLocalRender = (rel) =>
  (rel.startsWith('media/m95/') || rel.startsWith('media/m96/')) &&
  rel.endsWith('.mp4') &&
  !USED_M95_M96.has(rel);

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(STATIC, { recursive: true });

let count = 0;
let bytes = 0;

function copyTree(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const src = join(dir, entry.name);
    const rel = relative(OUT, src).split('\\').join('/');
    if (entry.isDirectory()) {
      copyTree(src);
    } else if (entry.isFile()) {
      if (isOptionalLocalRender(rel)) continue;
      const dst = join(STATIC, rel);
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(src, dst);
      count++;
      bytes += statSync(src).size;
    }
  }
}

copyTree(OUT);

const config = {
  version: 3,
  routes: [
    {
      src: '/(.*)',
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(self), camera=(self), microphone=(self), payment=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; child-src 'self' blob:; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.vercel.app https://api.civic-relay.com; media-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
      },
      continue: true
    },
    {
      src: '/media/(.*)',
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Accept-Ranges': 'bytes'
      },
      continue: true
    },
    {
      src: '/_next/static/(.*)',
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable'
      },
      continue: true
    },
    {
      src: '/senda-sw.js',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      continue: true
    },
    {
      src: '/senda/(.*)',
      headers: {
        'Cache-Control': 'no-cache'
      },
      continue: true
    },
    { src: '^/hyperframes/?$', dest: '/hyperframes/index.html' },
    { src: '^/senda/?$', dest: '/senda/index.html' },
    { src: '^/senda/papers/?$', dest: '/senda/papers/index.html' },
    { handle: 'filesystem' },
    { src: '^/(.+)/$', dest: '/$1.html', check: true },
    { src: '^/(.+)$', dest: '/$1.html', check: true },
    { src: '/(.*)', status: 404, dest: '/404.html' }
  ]
};

writeFileSync(join(OUTPUT, 'config.json'), JSON.stringify(config, null, 2) + '\n');
console.log(`Prepared Vercel Build Output API v3: ${count} files, ${(bytes / 1048576).toFixed(1)} MB -> ${OUTPUT}`);

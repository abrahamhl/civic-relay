#!/usr/bin/env node
/** Canonical public web entrypoint gate. History and browser artefacts are immutable. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CANONICAL = 'https://civic-relay-investor.vercel.app';
const roots = ['README.md', 'docs', 'investor-next', 'apps/web', '.github'];
const ignoredFolders = new Set(['node_modules','.next','out','dist','coverage','.git','.turbo','audit','personas']);
const allowedExtensions = new Set(['.md','.mdx','.html','.htm','.ts','.tsx','.js','.mjs','.cjs','.json','.yml','.yaml','.xml','.txt','.css']);
const violations = [];
const suspect = [
  /https?:\/\/civic-relay\.vercel\.app\b/ig,
  /https?:\/\/civic-relay-pi\.vercel\.app\b/ig,
  /https?:\/\/abrahamhl\.github\.io\/civic-relay(?:\/|\b)/ig,
  /https?:\/\/civic-relay-investor-(?!vercel)[\w-]+\.vercel\.app\b/ig
];

function inspect(full) {
  const rel = relative(root, full).replaceAll('\\', '/');
  // Historic audit files and recorded browser sessions document old releases as evidence.
  if (rel.startsWith('docs/audits/') || rel.startsWith('audit/personas/')) return;
  if (rel === 'investor-next/scripts/check-canonical-domain.mjs') return;
  if (!allowedExtensions.has(extname(rel))) return;
  const text = readFileSync(full, 'utf8');
  for (const pattern of suspect) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length) violations.push({file: rel, matched: matches.map(v=>v[0])});
  }
}
function walk(full) {
  if (!statSync(full).isDirectory()) return inspect(full);
  for (const entry of readdirSync(full,{withFileTypes:true})) {
    if (entry.isDirectory() && ignoredFolders.has(entry.name)) continue;
    const name = join(full,entry.name);
    if (entry.isDirectory()) walk(name);
    else if (entry.isFile()) inspect(name);
  }
}
for (const name of roots) walk(resolve(root,name));
const readme=readFileSync(resolve(root,'README.md'),'utf8');
const layout=readFileSync(resolve(root,'investor-next/app/(en)/layout.tsx'),'utf8');
const localizedLayout=readFileSync(resolve(root,'investor-next/app/(localized)/[locale]/layout.tsx'),'utf8');
assert.ok(readme.includes(CANONICAL),'README does not link canonical public domain');
assert.ok(layout.includes(CANONICAL),'English SEO metadataBase does not match public domain');
assert.ok(localizedLayout.includes(CANONICAL),'Localized SEO metadataBase does not match public domain');
if (violations.length) {
  console.error(JSON.stringify({ok:false,canonical:CANONICAL,violations},null,2));
  process.exitCode=1;
} else {
  console.log(JSON.stringify({ok:true,canonical:CANONICAL,scanned:roots,historicalFilesExcluded:true}));
}

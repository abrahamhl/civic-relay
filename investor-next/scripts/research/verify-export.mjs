#!/usr/bin/env node
/**
 * Zero-dependency verification of the exported trilingual research library.
 * Run after: npm run build
 *
 * Checks localized pages, links, artifact hashes, bundle digest, PDF markers
 * and the published report editions. It does not re-render the reports.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'out');
const manifestText = readFileSync(path.join(root, 'public/research/manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText);
const digest = manifest.bundleDigest;

const locales = [
  {
    locale: 'en',
    file: 'out/research.html',
    title: 'Technical reports, with receipts.',
    status: 'Technical report · not peer reviewed',
    publications: '01 / PUBLICATIONS',
    provenance: '02 / PROVENANCE',
    artifacts: '03 / ARTIFACT INDEX'
  },
  {
    locale: 'es',
    file: 'out/es/research.html',
    title: 'Informes técnicos, con recibos.',
    status: 'Informe técnico · sin revisión por pares',
    publications: '01 / PUBLICACIONES',
    provenance: '02 / PROCEDENCIA',
    artifacts: '03 / ÍNDICE DE ARTEFACTOS'
  },
  {
    locale: 'nl',
    file: 'out/nl/research.html',
    title: 'Technische rapporten, met bewijs.',
    status: 'Technisch rapport · niet peer-reviewed',
    publications: '01 / PUBLICATIES',
    provenance: '02 / HERKOMST',
    artifacts: '03 / ARTEFACTINDEX'
  }
];

function outputCandidates(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean.startsWith('/') || clean.startsWith('//')) return [];
  const relative = clean.replace(/^\//, '');
  const candidates = [];
  if (relative === '' || clean.endsWith('/')) {
    candidates.push(path.join(out, relative, 'index.html'));
    candidates.push(path.join(out, relative.replace(/\/$/, '') + '.html'));
  } else {
    candidates.push(path.join(out, relative));
    candidates.push(path.join(out, relative, 'index.html'));
    candidates.push(path.join(out, relative + '.html'));
  }
  return candidates;
}

function assertLinksResolve(html, label) {
  const links = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const href of links) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const candidates = outputCandidates(href);
    assert.ok(candidates.some(existsSync), `${label}: broken internal link ${href}`);
  }
}

function assertReportLinks(html, label) {
  for (const paper of manifest.papers) {
    for (const href of [paper.html, paper.pdf, paper.markdown, paper.bibtex]) {
      assert.ok(href && html.includes(href), `${label}: missing artifact link ${href}`);
    }
  }
  assert.ok(html.includes(manifest.bibtex), `${label}: missing aggregate BibTeX link`);
  assert.ok(html.includes('/research/manifest.json'), `${label}: missing manifest link`);
}

for (const entry of locales) {
  const file = path.join(root, entry.file);
  assert.ok(existsSync(file), `missing ${entry.file}`);
  const html = readFileSync(file, 'utf8');
  assert.match(html, new RegExp(`<html[^>]*lang="${entry.locale}"`, 'i'), `${entry.file}: wrong document language`);
  assert.ok(html.includes(entry.title), `${entry.file}: missing localized title`);
  assert.ok(html.includes(entry.status), `${entry.file}: missing localized report status`);
  assert.ok(html.includes(entry.publications), `${entry.file}: missing localized publications label`);
  assert.ok(html.includes(entry.provenance), `${entry.file}: missing localized provenance label`);
  assert.ok(html.includes(entry.artifacts), `${entry.file}: missing localized artifact label`);
  assert.ok(html.includes(digest), `${entry.file}: missing bundle digest`);
  assert.equal((html.match(/class="research-card"/g) || []).length, manifest.papers.length, `${entry.file}: wrong report card count`);
  for (const paper of manifest.papers) {
    assert.ok(html.includes(`id="${paper.slug}"`), `${entry.file}: missing ${paper.slug}`);
  }
  assert.ok(html.includes('hrefLang="en"') && html.includes('hrefLang="es"') && html.includes('hrefLang="nl"'), `${entry.file}: missing hreflang alternates`);
  assert.ok(html.includes('rel="canonical"'), `${entry.file}: missing canonical link`);
  assertReportLinks(html, entry.file);
  assertLinksResolve(html, entry.file);
}

assert.equal(manifest.schema, 'senda-research-manifest/1', 'manifest: wrong schema');
assert.equal(manifest.license, 'MIT', 'manifest: wrong license');
assert.ok(manifest.note.includes('not peer reviewed'), 'manifest: missing peer-review note');
assert.equal(manifest.papers.length, 3, 'manifest: expected three papers');
assert.equal(manifest.data.length, 2, 'manifest: expected two data files');

for (const paper of manifest.papers) {
  for (const file of paper.files) {
    const target = path.join(out, file.path);
    assert.ok(existsSync(target), `manifest: missing ${file.path}`);
    const bytes = readFileSync(target);
    assert.equal(bytes.length, file.bytes, `manifest: byte size mismatch ${file.path}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `manifest: hash mismatch ${file.path}`);
    if (file.path.endsWith('.pdf')) {
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', `manifest: invalid PDF ${file.path}`);
    }
  }
  assert.ok(existsSync(path.join(out, paper.html)), `manifest: missing HTML edition ${paper.html}`);
  assert.ok(existsSync(path.join(out, paper.pdf)), `manifest: missing PDF edition ${paper.pdf}`);
  assert.ok(existsSync(path.join(out, paper.markdown)), `manifest: missing Markdown source ${paper.markdown}`);
  assert.ok(existsSync(path.join(out, paper.bibtex)), `manifest: missing BibTeX ${paper.bibtex}`);
}

for (const file of manifest.data) {
  const target = path.join(out, file.path);
  assert.ok(existsSync(target), `manifest: missing data file ${file.path}`);
  const bytes = readFileSync(target);
  assert.equal(bytes.length, file.bytes, `manifest: data byte size mismatch ${file.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `manifest: data hash mismatch ${file.path}`);
}

const bundleInput = manifest.papers
  .map((paper) => ({
    slug: paper.slug,
    files: paper.files.map(({ path: filePath, sha256 }) => ({ path: filePath, sha256 }))
  }))
  .sort((left, right) => (left.slug < right.slug ? -1 : 1));
assert.equal(
  createHash('sha256').update(JSON.stringify(bundleInput)).digest('hex'),
  digest,
  'manifest: recomputed bundle digest mismatch'
);

const exportedManifest = path.join(out, 'research/manifest.json');
assert.ok(existsSync(exportedManifest), 'missing exported manifest');
assert.equal(readFileSync(exportedManifest, 'utf8'), manifestText, 'exported manifest differs from public manifest');

for (const paper of manifest.papers) {
  const report = path.join(out, paper.html);
  const html = readFileSync(report, 'utf8');
  assert.ok(html.includes('not peer reviewed'), `${paper.html}: missing peer-review status`);
  assert.ok(html.includes('/research/manifest.json'), `${paper.html}: missing manifest link`);
  assert.ok(html.includes('/research/katex/katex.min.css'), `${paper.html}: missing KaTeX CSS`);
  assert.ok(html.includes('rel="canonical"'), `${paper.html}: missing canonical link`);
  assertLinksResolve(html, paper.html);
}

console.log(JSON.stringify({
  ok: true,
  locales: locales.map(({ locale, file }) => ({ locale, file })),
  papers: manifest.papers.length,
  data: manifest.data.length,
  bundleDigest: digest,
  pdfs: manifest.papers.filter((paper) => paper.pdf).length
}, null, 2));

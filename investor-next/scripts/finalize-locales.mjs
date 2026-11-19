#!/usr/bin/env node
/**
 * Next.js static export shares layout scaffolding; ensure every localized HTML page
 * has an accurate per-document <html lang="es|nl"> attribute fail-closed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const SECTIONS = [
  '',
  'product',
  'platform',
  'evidence',
  'science',
  'investors',
  'security',
  'mission-control',
  'mando',
  'defense'
];

for (const locale of ['es', 'nl']) {
  for (const sec of SECTIONS) {
    const group = sec
      ? [`out/${locale}/${sec}.html`, `out/${locale}/${sec}/index.html`]
      : [`out/${locale}.html`, `out/${locale}/index.html`];
    const file = group.find(existsSync);
    assert.ok(file, `Missing static ${locale} page (${group.join(' or ')})`);
    let html = readFileSync(file, 'utf8');
    const root = /<html\b[^>]*>/i.exec(html);
    assert.ok(root, `Missing <html> element in ${file}`);
    assert.match(root[0], /\blang="(?:en|es|nl)"/i, `Missing root lang attribute in ${file}`);
    html = html.replace(root[0], root[0].replace(/\blang="(?:en|es|nl)"/i, `lang="${locale}"`));
    writeFileSync(file, html);
    assert.match(readFileSync(file, 'utf8'), new RegExp(`<html[^>]*\\blang="${locale}"`, 'i'));
    console.log(`PASS: ${file} has html lang=${locale}`);
  }
}

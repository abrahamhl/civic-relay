#!/usr/bin/env node
/**
 * Next.js static export has a shared root layout; localized HTML pages need
 * a correct per-document lang attribute for screen readers and crawlers.
 * Keep this post-build step fail-closed so future framework updates don't
 * silently reinstate lang="en" for Spanish/Dutch exports.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';

for(const locale of ['es','nl']){
  const candidates=[
    [`out/${locale}.html`,`out/${locale}/index.html`],
    [`out/${locale}/mission-control.html`,`out/${locale}/mission-control/index.html`],
    [`out/${locale}/science.html`,`out/${locale}/science/index.html`]
  ];
  for(const group of candidates){
    const file=group.find(existsSync);
    assert.ok(file,`Missing static ${locale} page (${group.join(' or ')})`);
    let html=readFileSync(file,'utf8');
    const root=/<html\b[^>]*>/i.exec(html);
    assert.ok(root,`Missing <html> element in ${file}`);
    assert.match(root[0],/\blang="(?:en|es|nl)"/i,`Missing root lang attribute in ${file}`);
    html=html.replace(root[0],root[0].replace(/\blang="(?:en|es|nl)"/i,`lang="${locale}"`));
    writeFileSync(file,html);
    assert.match(readFileSync(file,'utf8'),new RegExp(`<html[^>]*\\blang="${locale}"`,'i'));
    console.log(`PASS: ${file} has html lang=${locale}`);
  }
}

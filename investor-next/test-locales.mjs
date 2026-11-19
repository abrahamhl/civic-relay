// Zero-dependency smoke test for statically exported SENDA trilingual routes.
// Run after: pnpm run build
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const siteUrl = process.env.SITE_URL || 'https://civic-relay-investor.vercel.app';

const homeChecks = [
  {
    locale: 'en',
    paths: ['out/index.html'],
    words: ['SENDA', 'If a path to your people exists, SENDA finds it.', 'Open Control Center', '506 / 506', '0 / 30', 'Evidence']
  },
  {
    locale: 'es',
    paths: ['out/es.html', 'out/es/index.html'],
    words: ['SENDA', 'Si existe un camino hasta tu gente, SENDA lo encuentra.', 'Ver el centro de control', '506 / 506', '0 / 30', 'Evidencia']
  },
  {
    locale: 'nl',
    paths: ['out/nl.html', 'out/nl/index.html'],
    words: ['SENDA', 'Als er een route naar uw dierbaren bestaat, vindt SENDA die.', 'Open controlecentrum', '506 / 506', '0 / 30', 'Bewijs']
  }
];

for (const { locale, paths, words } of homeChecks) {
  const file = paths.find(existsSync);
  assert.ok(file, `Missing prerendered output for ${locale}: ${paths.join(', ')}`);
  const html = readFileSync(file, 'utf8');
  for (const word of words) {
    assert.ok(html.includes(word), `${locale}: missing translated content "${word}"`);
  }
  assert.ok(html.includes('/es/') && html.includes('/nl/'), `${locale}: missing language links`);
  assert.ok(/research|investigación|onderzoek/i.test(html), `${locale}: missing honest research disclosure`);
  assert.ok(!/Proyecto de comunicaciones por satélite para emergencias offline/i.test(html), `${locale}: legacy satellite SEO claim still present`);
  assert.ok(html.includes('rel="canonical"'), `${locale}: missing canonical link`);
  assert.match(html, new RegExp('<html[^>]*lang="' + locale + '"', 'i'), `${locale}: HTML language is incorrect`);
  assert.ok(html.includes(siteUrl), `${locale}: canonical domain missing`);
  assert.ok(html.includes('hrefLang="en"') && html.includes('hrefLang="es"') && html.includes('hrefLang="nl"'), `${locale}: missing hreflang alternates`);
  assert.ok(html.includes('application/ld+json'), `${locale}: missing JSON-LD structured data`);
  console.log(`PASS ${locale.toUpperCase()} home: static markup, EvidenceBadge, canonical, JSON-LD and i18n routes`);
}

// Verify all 6 redesigned core routes across EN / ES / NL
const redesignedSections = ['product', 'platform', 'evidence', 'science', 'investors', 'security'];
for (const locale of ['en', 'es', 'nl']) {
  for (const sec of redesignedSections) {
    const candidates =
      locale === 'en'
        ? [`out/${sec}.html`, `out/${sec}/index.html`]
        : [`out/${locale}/${sec}.html`, `out/${locale}/${sec}/index.html`];
    const file = candidates.find(existsSync);
    assert.ok(file, `Missing prerendered page for ${locale} /${sec}`);
    const html = readFileSync(file, 'utf8');
    assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`, 'i'), `${file}: wrong html lang`);
    assert.ok(html.includes('rel="canonical"'), `${file}: missing canonical`);
    assert.ok(html.includes('hrefLang="en"') && html.includes('hrefLang="es"') && html.includes('hrefLang="nl"'), `${file}: missing hreflang`);
  }
  console.log(`PASS ${locale.toUpperCase()}: all 6 redesigned sections prerendered with valid lang, canonical & hreflang`);
}

// Legacy /mando surface remains intact
const surfaceChecks = [
  { locale: 'en', paths: ['out/mando.html', 'out/mando/index.html'], words: ['SENDA COMMAND', 'MULTICHANNEL ACTIVATION PANEL'] },
  { locale: 'es', paths: ['out/es/mando.html', 'out/es/mando/index.html'], words: ['SENDA MANDO', 'PANEL MULTICANAL'] },
  { locale: 'nl', paths: ['out/nl/mando.html', 'out/nl/mando/index.html'], words: ['SENDA COMMANDO', 'MULTIKANAAL'] }
];
for (const { locale, paths, words } of surfaceChecks) {
  const file = paths.find(existsSync);
  assert.ok(file, `Missing prerendered output for ${locale} /mando`);
  const html = readFileSync(file, 'utf8');
  for (const word of words) assert.ok(html.includes(word), `${locale} /mando: missing ${word}`);
  assert.match(html, new RegExp('<html[^>]*lang="' + locale + '"', 'i'), `${locale} /mando: wrong html lang`);
  assert.ok(html.includes('mando-2.2.0'), `${locale} /mando: missing model version`);
  console.log(`PASS ${locale.toUpperCase()} /mando: preserved`);
}

// Defence vault remains isolated & noindex, and zero defence markers leak into civil pages
const vault = [
  { locale: 'en', paths: ['out/defense.html', 'out/defense/index.html'], words: ['DEFENCE VAULT', '2021/821'] },
  { locale: 'es', paths: ['out/es/defense.html', 'out/es/defense/index.html'], words: ['BÓVEDA DE DEFENSA', '2021/821'] },
  { locale: 'nl', paths: ['out/nl/defense.html', 'out/nl/defense/index.html'], words: ['DEFENSIEKLUIS', '2021/821'] }
];
for (const { locale, paths, words } of vault) {
  const file = paths.find(existsSync);
  assert.ok(file, `Missing prerendered output for ${locale} /defense`);
  const html = readFileSync(file, 'utf8');
  for (const word of words) assert.ok(html.includes(word), `${locale} /defense: missing ${word}`);
  assert.match(html, /<meta[^>]*name="robots"[^>]*noindex/i, `${locale} /defense: must be noindex`);
  assert.ok(html.includes('data-classification="DUAL_USE_DEFENSE"'), `${locale} /defense: missing vault classification`);
  assert.match(html, new RegExp('<html[^>]*lang="' + locale + '"', 'i'), `${locale} /defense: wrong html lang`);
  console.log(`PASS ${locale.toUpperCase()} /defense: vault isolated, noindex, i18n`);
}

const civil = [
  'out/index.html',
  'out/es.html',
  'out/es/index.html',
  'out/nl.html',
  'out/nl/index.html',
  'out/science.html',
  'out/science/index.html',
  'out/es/science.html',
  'out/es/science/index.html',
  'out/nl/science.html',
  'out/nl/science/index.html'
].filter(existsSync);

for (const file of civil) {
  const html = readFileSync(file, 'utf8');
  for (const marker of ['reel-defense', 'session-breakthrough', 'role-investor', 'reel-drones', 'reel-sentinel-survival', 'ASTM F3411 Ghost']) {
    assert.ok(!html.includes(marker), `${file}: defence content "${marker}" leaked outside the vault`);
  }
}
console.log(`PASS civil surfaces (${civil.length} files): no defence content outside the vault`);

// SEO files
for (const seoFile of ['out/robots.txt', 'out/sitemap.xml', 'out/.well-known/security.txt', 'out/og-senda.svg']) {
  assert.ok(existsSync(seoFile), `Missing exported SEO/security file: ${seoFile}`);
}
console.log('PASS SEO & security static assets exported');

// Zero-dependency smoke test for server-rendered, statically exported investor translations.
// Run after: npm run build
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const checks=[
  {locale:'en',paths:['out/index.html'],words:['WHEN THE','NETWORK','GOES DARK.','WHY BACK THIS RESEARCH?','BROWSER-SIMULATED','HORIZON-CL3-2026-01-SSRI-04']},
  {locale:'es',paths:['out/es.html','out/es/index.html'],words:['CUANDO LA','SE APAGA.','¿POR QUÉ APOYARNOS?','SIMULACIÓN INTERACTIVA','HORIZON-CL3-2026-01-SSRI-04']},
  {locale:'nl',paths:['out/nl.html','out/nl/index.html'],words:['ALS HET','UITVALT.','WAAROM DIT ONDERZOEK STEUNEN?','INTERACTIEF NOODSCENARIO','HORIZON-CL3-2026-01-SSRI-04']}
];
for(const {locale,paths,words} of checks){
  const file=paths.find(existsSync);
  assert.ok(file,`Missing prerendered output for ${locale}: ${paths.join(', ')}`);
  const html=readFileSync(file,'utf8');
  const htmlTag=html.match(/<html\b[^>]*>/i)?.[0] ?? '';
  assert.match(htmlTag,new RegExp(`\\blang=["']${locale}["']`),`${locale}: HTML document language does not match route`);
  for(const word of words){assert.ok(html.includes(word),`${locale}: missing translated content ${word}`);}
  assert.ok(html.includes('/es/')&&html.includes('/nl/'),`${locale}: missing language links`);
  assert.ok(html.includes('HORIZON-CL3-2026-01-SSRI-04'),`${locale}: missing official funding topic`);
  assert.ok(/SIMULAT|SIMULACI|SIMULATIE/i.test(html),`${locale}: missing simulation disclosure`);
  assert.ok(!/Proyecto de comunicaciones por satélite para emergencias offline/i.test(html),`${locale}: legacy satellite SEO claim still present`);
  assert.ok(html.includes('rel="canonical"'),`${locale}: missing canonical link`);
  assert.ok(html.includes('hrefLang="en"')&&html.includes('hrefLang="es"')&&html.includes('hrefLang="nl"'),`${locale}: missing hreflang alternates`);
  assert.ok(html.includes('EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE'),`${locale}: missing 8-stage architecture flow`);
  console.log(`PASS ${locale.toUpperCase()}: static markup, investor proposition, honest claims, EU link and i18n routes`);
}

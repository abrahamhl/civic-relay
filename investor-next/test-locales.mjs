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
  for(const word of words){assert.ok(html.includes(word),`${locale}: missing translated content ${word}`);}
  assert.ok(html.includes('/es/')&&html.includes('/nl/'),`${locale}: missing language links`);
  assert.ok(html.includes('HORIZON-CL3-2026-01-SSRI-04'),`${locale}: missing official funding topic`);
  assert.ok(/SIMULAT|SIMULACI|SIMULATIE/i.test(html),`${locale}: missing simulation disclosure`);
  console.log(`PASS ${locale.toUpperCase()}: static markup, investor proposition, honest claims, EU link and i18n routes`);
}

// Zero-dependency smoke test for server-rendered, statically exported investor translations.
// Run after: npm run build
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const checks=[
  {locale:'en',paths:['out/index.html'],words:['WHEN THE','NETWORK','GOES DARK.','WHY BACK THIS RESEARCH?','BROWSER-SIMULATED','HORIZON-CL3-2026-01-SSRI-04','/mando/']},
  {locale:'es',paths:['out/es.html','out/es/index.html'],words:['CUANDO LA','SE APAGA.','¿POR QUÉ APOYARNOS?','SIMULACIÓN INTERACTIVA','HORIZON-CL3-2026-01-SSRI-04','/es/mando/']},
  {locale:'nl',paths:['out/nl.html','out/nl/index.html'],words:['ALS HET','UITVALT.','WAAROM DIT ONDERZOEK STEUNEN?','INTERACTIEF NOODSCENARIO','HORIZON-CL3-2026-01-SSRI-04','/nl/mando/']}
];
for(const {locale,paths,words} of checks){
  const file=paths.find(existsSync);
  assert.ok(file,`Missing prerendered output for ${locale}: ${paths.join(', ')}`);
  const html=readFileSync(file,'utf8');
  for(const word of words){assert.ok(html.includes(word),`${locale}: missing translated content ${word}`);}
  assert.ok(html.includes('/es/')&&html.includes('/nl/'),`${locale}: missing language links`);
  assert.ok(html.includes('HORIZON-CL3-2026-01-SSRI-04'),`${locale}: missing official funding topic`);
  assert.ok(/SIMULAT|SIMULACI|SIMULATIE/i.test(html),`${locale}: missing simulation disclosure`);
  assert.ok(!/Proyecto de comunicaciones por satélite para emergencias offline/i.test(html),`${locale}: legacy satellite SEO claim still present`);
  assert.ok(html.includes('rel="canonical"'),`${locale}: missing canonical link`);
  assert.match(html, new RegExp('<html[^>]*lang="'+locale+'"','i'),`${locale}: HTML language is incorrect`);
  assert.ok(html.includes(process.env.SITE_URL||'https://civic-relay-investor.vercel.app'),`${locale}: canonical domain missing`);
  assert.ok(html.includes('hrefLang="en"')&&html.includes('hrefLang="es"')&&html.includes('hrefLang="nl"'),`${locale}: missing hreflang alternates`);
  assert.ok(html.includes('EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE'),`${locale}: missing 8-stage architecture flow`);
  console.log(`PASS ${locale.toUpperCase()}: static markup, investor proposition, honest claims, EU link and i18n routes`);
}

const surfaceChecks=[
  {locale:'en',paths:['out/mando.html','out/mando/index.html'],words:['SENDA COMMAND','MULTICHANNEL ACTIVATION PANEL']},
  {locale:'es',paths:['out/es/mando.html','out/es/mando/index.html'],words:['SENDA MANDO','PANEL MULTICANAL']},
  {locale:'nl',paths:['out/nl/mando.html','out/nl/mando/index.html'],words:['SENDA COMMANDO','MULTIKANAAL']}
];
for(const {locale,paths,words} of surfaceChecks){
  const file=paths.find(existsSync);
  assert.ok(file,`Missing prerendered output for ${locale} /mando: ${paths.join(', ')}`);
  const html=readFileSync(file,'utf8');
  for(const word of words){assert.ok(html.includes(word),`${locale} /mando: missing translated content ${word}`);}
  assert.ok(/SIMULATION|SIMULACIÓN|SIMULATIE/i.test(html),`${locale} /mando: missing simulation disclosure`);
  assert.ok(html.includes('/es/mando/')&&html.includes('/nl/mando/'),`${locale} /mando: missing language links`);
  assert.ok(html.includes('rel="canonical"'),`${locale} /mando: missing canonical link`);
  assert.match(html, new RegExp('<html[^>]*lang="'+locale+'"','i'),`${locale} /mando: HTML language is incorrect`);
  assert.ok(html.includes(process.env.SITE_URL||'https://civic-relay-investor.vercel.app'),`${locale} /mando: canonical domain missing`);
  assert.ok(html.includes('hrefLang="en"')&&html.includes('hrefLang="es"')&&html.includes('hrefLang="nl"'),`${locale} /mando: missing hreflang alternates`);
  assert.ok(html.includes('data-testid="cmd-environment"'),`${locale} /mando: missing environment calibration control`);
  assert.ok(html.includes('data-testid="cmd-kpi-routed"')&&html.includes('data-testid="cmd-kpi-delivery"'),`${locale} /mando: missing routed and delivery KPIs`);
  assert.ok(html.includes('mando-2.2.0'),`${locale} /mando: missing model version`);
  console.log(`PASS ${locale.toUpperCase()} /mando: command surface, calibrated model, KPIs, canonical and i18n routes`);
}

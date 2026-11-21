// Next.js static export inherits the root layout's lang="en" on /es and /nl.
// Correct the prerendered document language before publishing the export.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

for(const [locale,paths] of Object.entries({
  es:['out/es.html','out/es/index.html'],
  nl:['out/nl.html','out/nl/index.html']
})){
  let count=0;
  for(const path of paths){
    if(!existsSync(path)) continue;
    const html=readFileSync(path,'utf8');
    const tag=html.match(/<html\b[^>]*>/i)?.[0];
    if(!tag) throw new Error(`${path}: missing HTML root`);
    const existing=tag.match(/\blang=(['"])(.*?)\1/i)?.[2];
    if(existing!=='en'&&existing!==locale) throw new Error(`${path}: unexpected HTML language ${existing}`);
    const correctedTag=tag.replace(/\blang=(['"])(.*?)\1/i,`lang="${locale}"`);
    if(correctedTag!==tag) writeFileSync(path,html.replace(tag,correctedTag));
    count++;
  }
  if(count===0) throw new Error(`Missing exported ${locale} HTML`);
  console.log(`PASS ${locale}: ${count} HTML export(s) declare the document language`);
}

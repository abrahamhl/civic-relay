import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=(path)=>readFileSync(resolve(root,path),'utf8');

test('the existing Three.js five-act story is preserved',()=>{
 const page=read('investor-next/app/investor-page.tsx');
 for(const component of ['WhatItDoes','CrisisStory','ScrollExperience','SystemExplained','CoordinationLab','DeveloperBlueprint','EvidenceBoard'])
   assert.ok(page.includes('<'+component+' locale={locale}/>'),component+' missing from page');
 const index=(component)=>page.indexOf('<'+component+' locale={locale}/>');
 assert.ok(index('CrisisStory')<index('ScrollExperience'));
 assert.ok(index('ScrollExperience')<index('SystemExplained'));
 assert.ok(index('SystemExplained')<index('CoordinationLab'));
 assert.ok(index('CoordinationLab')<index('DeveloperBlueprint'));
 const scroll=read('investor-next/app/scroll-experience.tsx');
 assert.ok(scroll.includes("await import('three')"));
 assert.ok(scroll.includes('journey-viewport'));
 assert.ok(scroll.includes('journey-tech-note'));
});
test('six decision stages are available in all three site languages',()=>{
 const data=read('investor-next/app/system-story-data.ts');
 for(const id of ['zone','consent','human','store','route','ack'])
   assert.equal(data.split("id:'"+id+"'").length-1,3,'Missing locale for '+id);
 for(const token of ['es:{','en:{','nl:{','ACK_SYNTHETIC','QUEUED','UNKNOWN'])
   assert.ok(data.includes(token),token+' missing');
});
test('every actual subsystem code link points to an existing file',()=>{
 const data=read('investor-next/app/system-story-data.ts');
 const refs=[...data.matchAll(/(?:source|path):root\+'([^']+)'/g)].map(x=>x[1]);
 assert.equal(refs.length,36);
 for(const ref of new Set(refs))assert.equal(existsSync(resolve(root,ref)),true,'Broken source '+ref);
});
test('interactive explainer is keyboard usable, responsive and evidence truthful',()=>{
 const jsx=read('investor-next/app/system-explained.tsx');
 const css=read('investor-next/app/system-story.css');
 for(const name of ['WhatItDoes','SystemExplained','DeveloperBlueprint'])
   assert.ok(jsx.includes('export function '+name));
 for(const item of ['IntersectionObserver','scrollIntoView','aria-pressed','selected.source'])
   assert.ok(jsx.includes(item),'Interaction missing: '+item);
 for(const item of ['prefers-reduced-motion:reduce','max-width:560px','.journey-tech-note'])
   assert.ok(css.includes(item),'Style missing: '+item);
 const data=read('investor-next/app/system-story-data.ts').toLowerCase();
 for(const item of ['no es un servicio real','not a live emergency service','geen hulpdienst','sin ensayo físico','not physically','nog geen veldproef'])
   assert.ok(data.includes(item),'Caveat absent: '+item);
});

test('mobile/investor navigation exposes the whole end-to-end journey in EN ES NL',()=>{
 const page=read('investor-next/app/investor-page.tsx');
 const css=read('investor-next/app/system-story.css');
 const anchors=[
  '#what-oep-does','#architecture','#how-it-works','#routing-lab','#developer-stack','#evidence'
 ];
 for(const anchor of anchors){
  assert.equal(page.split("href:'"+anchor+"'").length-1,3,'missing locale navigation '+anchor);
 }
 for(const label of ['QUÉ HACE','HOW IT WORKS','WERKING','TECH STACK','TECNOLOGÍA','BEWIJS'])
  assert.ok(page.includes(label),'missing localized nav: '+label);
 for(const part of ['className="oep-chapter-nav"','aria-label=', 'overflow-x:auto','scroll-snap-type:x proximity',':focus-visible'])
  assert.ok((page+'\n'+css).includes(part),'missing keyboard/mobile nav: '+part);
 assert.ok(!page.includes("civic-relay-4zbvbbxxm"),'outdated unrelated preview destination');
});

test('copy accurately says Android is compiled but physical interoperability remains unverified',()=>{
 const c=read('investor-next/app/copy.ts');
 assert.match(c,/EXPERIMENTAL ANDROID APK \(BUILD-TESTED ONLY\)/);
 assert.match(c,/ANDROID EXPERIMENTAL COMPILADA/);
 assert.match(c,/EXPERIMENTELE ANDROID-APK \(ALLEEN BUILD-GETEST\)/);
 for(const erroneous of ['Real phone-to-phone transport is not yet implemented.',
 'La transmisión real entre móviles todavía no está implementada.',
 'NU: SIMULATIE IN DE BROWSER. LATER: FYSIEKE RADIO'])
  assert.ok(!c.includes(erroneous),'outdated claim: '+erroneous);
});

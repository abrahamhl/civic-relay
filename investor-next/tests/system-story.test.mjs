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

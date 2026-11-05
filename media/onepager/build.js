// Genera fichas A4 (ES / NL) con Chromium: node build.js
const { chromium } = require('playwright');
const path = require('path');
const T = {
  es: { lang:'es', file:'civic-relay-ficha-ES.pdf',
    tag:'Laboratorio de investigación abierto · Civic Relay / OEP',
    h:'Cuando la red falla, la coordinación no debería desaparecer.',
    sub:'Plataforma europea modular de continuidad de comunicaciones y coordinación en emergencias, con evidencia verificable de cada mensaje.',
    c1t:'Qué existe hoy', c1:['Simulador determinista (810 escenarios virtuales, 12.150 invariantes) y web trilingüe ES/EN/NL','Laboratorio Android de un salto con cola persistente y recibos firmados (código fuente, CI verde)','Matriz de verdad: cada afirmación con su nivel de evidencia','Código abierto (MIT); desarrollo asistido por IA declarado, con revisión humana'],
    c2t:'Qué NO existe todavía', c2:['Ningún ensayo físico móvil↔móvil (0 de 20 puntos de validación)','Sin integración con 112, satélites ni radar; sin auditoría externa','No es un servicio de emergencias. No usar en emergencias reales'],
    c3t:'Qué pedimos', c3:['Un piloto de 12 semanas con 3–5 móviles y ≥30 intentos, fallos incluidos, con informe firmado por un tercero','Un socio de ensayo (universidad o centro técnico) y un gestor de emergencias local para un simulacro con datos sintéticos','Coste estimado de la fase de validación: 15–40 k€ (estimación orientativa, sin presupuestos)'],
    state:'Estado: TRL ≈ 3 · puntuación interna provisional 54/100 (no es una calificación externa)',
    foot:'Web: civic-relay-investor.vercel.app · Código: github.com/abrahamhl/civic-relay · Contacto: [añadir] · 5-nov-2026' },
  nl: { lang:'nl', file:'civic-relay-factsheet-NL.pdf',
    tag:'Open onderzoekslab · Civic Relay / OEP',
    h:'Als het netwerk uitvalt, mag coördinatie niet verdwijnen.',
    sub:'Modulair Europees platform voor communicatiecontinuïteit en coördinatie bij noodsituaties, met verifieerbaar bewijs per bericht.',
    c1t:'Wat er nu is', c1:['Deterministische simulator (810 virtuele scenario’s, 12.150 invarianten) en drietalige website ES/EN/NL','Android-lab voor één hop met persistente wachtrij en ondertekende ontvangstbewijzen (broncode, groene CI)','Waarheidsmatrix: elke bewering met haar bewijsniveau','Open source (MIT); AI-ondersteunde ontwikkeling openlijk vermeld, met menselijke controle'],
    c2t:'Wat er nog NIET is', c2:['Geen fysieke test telefoon↔telefoon (0 van 20 validatiepunten)','Geen koppeling met 112, satellieten of radar; geen externe audit','Dit is geen hulpdienst. Niet gebruiken bij echte noodsituaties'],
    c3t:'Wat wij vragen', c3:['Een pilot van 12 weken met 3–5 telefoons en ≥30 pogingen, mislukkingen inbegrepen, met rapport van een onafhankelijke partij','Een testpartner (universiteit of kennisinstelling) en een lokale crisisorganisatie voor een oefening met synthetische data','Geschatte kosten van de validatiefase: €15–40 k (indicatieve schatting, zonder offertes)'],
    state:'Status: TRL ≈ 3 · voorlopige interne score 54/100 (geen externe beoordeling)',
    foot:'Web: civic-relay-investor.vercel.app · Code: github.com/abrahamhl/civic-relay · Contact: [toevoegen] · 5 nov 2026' } };
const html = t => `<!doctype html><html lang="${t.lang}"><meta charset="utf-8"><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font:11pt/1.45 Inter,Arial,sans-serif;color:#0d1419;width:210mm;height:297mm;padding:16mm 16mm 12mm;position:relative}
.tag{font:600 8.5pt/1 Inter,Arial;letter-spacing:.08em;text-transform:uppercase;color:#d4482a}
h1{font-size:25pt;line-height:1.1;margin:8pt 0 8pt}.sub{font-size:12pt;color:#34434d;margin:0 0 14pt}
h2{font-size:11pt;margin:14pt 0 5pt;padding-left:8pt;border-left:4pt solid #ff7756}ul{margin:0;padding-left:15pt}li{margin:0 0 3pt}
.warn h2{border-color:#555}.warn{background:#f3f4f5;padding:2pt 10pt 8pt;border-radius:4pt;margin-top:14pt}
.state{margin-top:12pt;font-weight:600;font-size:10pt;color:#34434d}
.foot{position:absolute;left:16mm;right:16mm;bottom:10mm;font-size:8.5pt;color:#556;border-top:1px solid #ccd;padding-top:6pt}
</style><body><div class="tag">${t.tag}</div><h1>${t.h}</h1><p class="sub">${t.sub}</p>
<h2>${t.c1t}</h2><ul>${t.c1.map(x=>`<li>${x}</li>`).join('')}</ul>
<div class="warn"><h2>${t.c2t}</h2><ul>${t.c2.map(x=>`<li>${x}</li>`).join('')}</ul></div>
<h2>${t.c3t}</h2><ul>${t.c3.map(x=>`<li>${x}</li>`).join('')}</ul>
<div class="state">${t.state}</div><div class="foot">${t.foot}</div></body></html>`;
(async()=>{const b=await chromium.launch();for(const t of Object.values(T)){const p=await b.newPage();await p.setContent(html(t));await p.pdf({path:path.join(__dirname,t.file),format:'A4',printBackground:true});await p.close();}await b.close();})();

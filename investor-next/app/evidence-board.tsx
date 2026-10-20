import type {Locale} from './copy';

const copy={
 en:{
  eyebrow:'INDEPENDENT DUE DILIGENCE / NO UNVERIFIED CLAIMS',
  title:'THE EVIDENCE BOARD.',
  lead:'Separate what runs today from what needs devices, institutions or independent testing. Numbers describe model scope, not rescue performance.',
  cards:[
   {number:'20–100',unit:'virtual nodes',title:'Reproducible topology',text:'Seeded experiments exercise explicit consent, radio availability, failure scenarios and synthetic routes.',status:'SIMULATED'},
   {number:'270',unit:'scenario assertions',title:'Automated invariants',text:'A fixed-scenario test matrix checks model safety properties; review the GitHub Actions run for the exact commit.',status:'AUTOMATED LAB'},
   {number:'0',unit:'proven real-world relays',title:'Physical interoperability',text:'The Android research source exists. A two-phone, measured, consented field test is still necessary.',status:'NOT PHYSICALLY TESTED'}
  ],
  action:'READ EVIDENCE & CERTIFICATION PLAN',disclaimer:'No official alerts, no rescue confirmation, no verified satellite transmission, no institutional endorsement.'},
 es:{
  eyebrow:'DILIGENCIA TÉCNICA / SIN AFIRMACIONES NO VERIFICADAS',
  title:'EVIDENCIA, NO PROMESAS.',
  lead:'Separamos el software que ya funciona de las pruebas que exigen dispositivos, instituciones o validación independiente. Ninguna cifra representa eficacia real en rescates.',
  cards:[
   {number:'20–100',unit:'nodos virtuales',title:'Topología reproducible',text:'Ensayos deterministas con consentimiento, disponibilidad de radios, escenarios de fallo y rutas ficticias.',status:'SIMULADO'},
   {number:'270',unit:'escenarios de validación',title:'Comprobaciones automatizadas',text:'Matriz de escenarios con invariantes; consulta GitHub Actions para comprobar el commit exacto.',status:'LABORATORIO'},
   {number:'0',unit:'retransmisiones reales verificadas',title:'Interoperabilidad física',text:'Existe código de investigación Android. Falta la prueba real entre dos teléfonos, consentida y medida.',status:'SIN PRUEBA FÍSICA'}
  ],
  action:'CONSULTAR PRUEBAS Y PLAN DE CERTIFICACIÓN',disclaimer:'Sin avisos oficiales, rescates confirmados, enlaces satelitales reales ni respaldo institucional.'},
 nl:{
  eyebrow:'TECHNISCHE CONTROLE / GEEN ONBEWEZEN CLAIMS',
  title:'BEWIJS, GEEN BELOFTEN.',
  lead:'We scheiden bewezen labfunctionaliteit van tests die echte apparaten, instanties en onafhankelijke validatie vereisen. Cijfers zijn geen echte reddingsresultaten.',
  cards:[
   {number:'20–100',unit:'virtuele nodes',title:'Reproduceerbare topologie',text:'Deterministische oefeningen met toestemming, radio-opties, netwerkstoringen en fictieve routes.',status:'GESIMULEERD'},
   {number:'270',unit:'scenariotests',title:'Geautomatiseerde checks',text:'Scenariomatrix met invarianten; raadpleeg GitHub Actions voor de precieze commit.',status:'LABTEST'},
   {number:'0',unit:'geverifieerde fysieke relays',title:'Fysieke interoperabiliteit',text:'Er is experimentele Android-broncode, maar nog geen gemeten proef op twee echte telefoons.',status:'NIET FYSIEK GETEST'}
  ],
  action:'BEKIJK BEWIJS EN VALIDATIEPLAN',disclaimer:'Geen officiële meldingen, geen reddingsbevestigingen, geen werkende satellietlink, geen institutionele goedkeuring.'}
} as const;
const evidence='https://github.com/abrahamhl/civic-relay/actions/workflows/emergency-lab-ci.yml';
const roadmap='https://github.com/abrahamhl/civic-relay/blob/feat/master-emergency-routing-v1-20261020/docs/OEP_VALIDATION_CERTIFICATION_AND_FUNDING_2026.md';
export default function EvidenceBoard({locale}:{locale:Locale}){
 const t=copy[locale];
 return <section className="oep-evidence" id="evidence" aria-labelledby="oep-evidence-title">
  <div className="container">
   <div className="oep-evidence-head"><p className="eyebrow">{t.eyebrow}</p>
    <h2 id="oep-evidence-title">{t.title}</h2><p>{t.lead}</p></div>
   <div className="oep-evidence-grid">{t.cards.map((c,i)=>
    <article className="oep-evidence-card" key={c.title}>
     <div className="oep-evidence-top"><span>0{i+1}</span><span>{c.status}</span></div>
     <div className="oep-evidence-number">{c.number}</div><p className="oep-evidence-unit">{c.unit}</p>
     <h3>{c.title}</h3><p className="oep-evidence-description">{c.text}</p>
    </article>)}</div>
   <div className="oep-evidence-foot"><p>{t.disclaimer}</p>
    <div><a className="button-outline" href={evidence} target="_blank" rel="noopener noreferrer">GITHUB ACTIONS ↗</a>
    <a className="text-cta" href={roadmap} target="_blank" rel="noopener noreferrer">{t.action} ↗</a></div>
   </div>
  </div>
 </section>;
}

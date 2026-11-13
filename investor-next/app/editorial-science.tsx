import type { Locale } from './copy';
import './editorial-science.css';

type CardCopy = { eyebrow: string; title: string; description: string; formula: string; limitation: string; action: string; href: string };
type EditorialCopy = { eyebrow: string; title: string; intro: string; note: string; cards: [CardCopy, CardCopy, CardCopy] };

const copy: Record<Locale, EditorialCopy> = {
  es: {
    eyebrow: 'SENDA / INGENIERÍA VISUAL',
    title: 'Menos promesas. Más claridad.',
    intro: 'Tres esquemas técnicos, dibujados a partir de las relaciones matemáticas que estudia el proyecto. No son fotografías de equipos ni pruebas de campo.',
    note: 'Ilustraciones conceptuales. Para resultados medidos, consultar evidencias y ensayos.',
    cards: [
      { eyebrow: '01 / RADIO Y RELIEVE', title: '¿Puede pasar una señal?', description: 'La zona de Fresnel permite estudiar cuánto obstaculiza el terreno un enlace hipotético entre dos nodos.', formula: 'r₁ = √(λ · d₁ · d₂ / (d₁ + d₂))', limitation: 'Geometría ≠ cobertura medida.', action: 'Explorar modelos de radio', href: '#telecom-rf-radar-suite' },
      { eyebrow: '02 / CONTINUIDAD', title: 'Guardar antes de reenviar.', description: 'Una ruta interrumpida no equivale a un mensaje entregado. El sistema conserva el estado y distingue custodia de confirmación final.', formula: 'EN COLA → SALTO → ACK DESTINO', limitation: 'Diagrama lógico, no envío entre móviles.', action: 'Abrir laboratorio de rutas', href: '#routing-lab' },
      { eyebrow: '03 / VENTANAS ORBITALES', title: 'Visibilidad no es conexión.', description: 'La elevación y la posición orbital ayudan a estimar ventanas; hacen falta terminal, capacidad de red y autorización.', formula: 'Elevación · horizonte · tiempo', limitation: 'Órbita ilustrativa, no satélite rastreado.', action: 'Ver modelo satelital', href: '#telecom-rf-radar-suite' }
    ]
  },
  en: {
    eyebrow: 'SENDA / VISUAL ENGINEERING',
    title: 'Fewer claims. Greater clarity.',
    intro: 'Three restrained engineering diagrams based on relationships studied in this project. They are not photographs of equipment or field-test results.',
    note: 'Conceptual illustrations. Consult the evidence and test records for measured results.',
    cards: [
      { eyebrow: '01 / RADIO & TERRAIN', title: 'Can the signal get through?', description: 'The Fresnel zone helps examine how terrain may obstruct a hypothetical radio link between two nodes.', formula: 'r₁ = √(λ · d₁ · d₂ / (d₁ + d₂))', limitation: 'Geometry ≠ measured coverage.', action: 'Explore radio models', href: '#telecom-rf-radar-suite' },
      { eyebrow: '02 / CONTINUITY', title: 'Store before forwarding.', description: 'A broken path is not a delivered message. The system tracks custody separately from destination acknowledgement.', formula: 'QUEUED → HOP → DESTINATION ACK', limitation: 'Logical diagram, not phone-to-phone delivery.', action: 'Open routing lab', href: '#routing-lab' },
      { eyebrow: '03 / ORBITAL WINDOWS', title: 'Visibility is not connectivity.', description: 'Elevation and orbital position help estimate windows; usable hardware, network support and authorization are still required.', formula: 'Elevation · horizon · time', limitation: 'Illustrative orbit, not a tracked satellite.', action: 'View satellite model', href: '#telecom-rf-radar-suite' }
    ]
  },
  nl: {
    eyebrow: 'SENDA / VISUELE TECHNIEK',
    title: 'Minder claims. Meer inzicht.',
    intro: 'Drie ingetogen technische schema’s gebaseerd op relaties die het project onderzoekt. Dit zijn geen foto’s van apparatuur of veldproeven.',
    note: 'Conceptuele illustraties. Raadpleeg bewijsmateriaal en testrapporten voor meetresultaten.',
    cards: [
      { eyebrow: '01 / RADIO EN TERREIN', title: 'Kan het signaal passeren?', description: 'De Fresnelzone laat zien hoe het terrein een hypothetische radioverbinding kan belemmeren.', formula: 'r₁ = √(λ · d₁ · d₂ / (d₁ + d₂))', limitation: 'Geometrie ≠ gemeten dekking.', action: 'Radiomodellen bekijken', href: '#telecom-rf-radar-suite' },
      { eyebrow: '02 / CONTINUÏTEIT', title: 'Opslaan vóór doorsturen.', description: 'Een onderbroken route is geen afgeleverd bericht. Bewaring en bevestiging door de ontvanger blijven gescheiden.', formula: 'WACHTRIJ → HOP → ONTVANGST ACK', limitation: 'Logisch schema, geen bericht tussen telefoons.', action: 'Routinglab openen', href: '#routing-lab' },
      { eyebrow: '03 / ORBITALE VENSTERS', title: 'Zichtbaar is niet verbonden.', description: 'Elevatie en baanpositie helpen vensters schatten; hardware, netwerkondersteuning en toestemming blijven nodig.', formula: 'Elevatie · horizon · tijd', limitation: 'Illustratieve baan, geen gevolgde satelliet.', action: 'Satellietmodel bekijken', href: '#telecom-rf-radar-suite' }
    ]
  }
};

function FresnelFigure() {
  return <svg className="ev-diagram" viewBox="0 0 360 205" role="img" aria-label="Geometric Fresnel ellipsoid above a terrain cross-section">
    <rect width="360" height="205" fill="#f5f6f5" />
    <path d="M16 170 L54 156 L92 172 L137 148 L177 163 L208 130 L244 145 L284 119 L344 143" fill="none" stroke="#aab1b4" strokeWidth="1.8"/>
    <path d="M36 95 Q180 18 324 95 Q180 171 36 95Z" fill="#dde9e7" stroke="#63867e" strokeWidth="1.25"/>
    <path d="M36 95 H324" stroke="#2f5350" strokeWidth="1.75" strokeDasharray="5 5"/>
    <path d="M36 96 V169 M324 95 V141" stroke="#39474a" strokeWidth="2"/>
    <circle cx="36" cy="95" r="4" fill="#253d3b"/><circle cx="324" cy="95" r="4" fill="#253d3b"/>
    <path d="M180 95 V55" stroke="#63867e" strokeWidth="1.4"/>
    <path d="M176 59 L180 55 L184 59 M176 91 L180 95 L184 91" fill="none" stroke="#63867e" strokeWidth="1.4"/>
    <g fill="#596569" fontSize="10" fontFamily="system-ui, sans-serif"><text x="25" y="82">A</text><text x="326" y="82">B</text><text x="189" y="73">r₁</text><text x="15" y="192">d₁</text><text x="320" y="192" textAnchor="end">d₂</text></g>
    <path d="M180 180 V192" stroke="#aab1b4"/><path d="M22 192 H338" stroke="#aab1b4" strokeDasharray="2 6"/>
  </svg>;
}

function QueueFigure() {
  return <svg className="ev-diagram" viewBox="0 0 360 205" role="img" aria-label="Three nodes and an explicitly queued message pending end-to-end acknowledgment">
    <rect width="360" height="205" fill="#f5f6f5"/>
    <g fill="none" stroke="#a5aeb0" strokeWidth="1.4"><path d="M74 94 H174" strokeDasharray="5 5"/><path d="M201 94 H293" strokeDasharray="5 5"/></g>
    <g fill="#fff" stroke="#394a4b" strokeWidth="1.6"><circle cx="60" cy="94" r="23"/><circle cx="187" cy="94" r="23"/><circle cx="309" cy="94" r="23"/></g>
    <g fill="#233d3b"><circle cx="60" cy="94" r="5"/><circle cx="187" cy="94" r="5"/><circle cx="309" cy="94" r="5"/></g>
    <g fill="#526165" fontSize="10" fontFamily="system-ui, sans-serif" textAnchor="middle"><text x="60" y="132">ORIGEN</text><text x="187" y="132">CUSTODIA</text><text x="309" y="132">DESTINO</text></g>
    <path d="M125 84 L137 104 M137 84 L125 104" stroke="#a76252" strokeWidth="2" strokeLinecap="round"/>
    <rect x="159" y="23" width="56" height="31" rx="5" fill="#e2e9e7" stroke="#8fa49d"/>
    <path d="M166 32 H208 M166 38 H202 M166 44 H195" stroke="#678179" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M187 54 V68" stroke="#678179" strokeDasharray="3 3"/>
    <rect x="225" y="146" width="110" height="25" rx="3" fill="none" stroke="#b4bdbe"/>
    <text x="280" y="162" fill="#586366" fontSize="9.5" textAnchor="middle" fontFamily="system-ui, sans-serif">ACK: PENDIENTE</text>
    <path d="M187 145 H267" stroke="#bcc3c4" strokeDasharray="3 4"/>
  </svg>;
}

function SatelliteFigure() {
  return <svg className="ev-diagram" viewBox="0 0 360 205" role="img" aria-label="Illustrative satellite orbital arc, ground horizon and elevation angle">
    <rect width="360" height="205" fill="#f5f6f5"/>
    <path d="M20 182 Q180 133 340 182" fill="none" stroke="#526d75" strokeWidth="2"/>
    <path d="M30 163 H330" stroke="#acb5b8" strokeDasharray="4 5"/>
    <path d="M70 66 Q180 1 292 66" fill="none" stroke="#8ea3a8" strokeWidth="1.5" strokeDasharray="5 5"/>
    <circle cx="216" cy="28" r="6" fill="#526e72"/>
    <path d="M205 21 L196 16 L191 26 L202 32 M227 24 L237 20 L241 30 L230 35" fill="#e1e7e7" stroke="#718a90" strokeWidth="1.5"/>
    <path d="M180 159 L216 28" stroke="#305c61" strokeWidth="1.75"/>
    <path d="M180 159 H300" stroke="#94a7ac" strokeWidth="1.2"/>
    <path d="M209 159 A29 29 0 0 0 187 131" fill="none" stroke="#a1765d" strokeWidth="2"/>
    <circle cx="180" cy="159" r="4" fill="#305c61"/>
    <g fontSize="10" fill="#536468" fontFamily="system-ui, sans-serif"><text x="200" y="143">α</text><text x="24" y="155">HORIZONTE</text><text x="235" y="18">ÓRBITA</text></g>
    <path d="M180 159 V181" stroke="#718a90" strokeWidth="1"/>
  </svg>;
}

const diagrams = [FresnelFigure, QueueFigure, SatelliteFigure] as const;

export default function EditorialScience({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return <section className="ev-section" id="visual-engineering" aria-labelledby="ev-section-title">
    <div className="container ev-container">
      <div className="ev-header">
        <p className="ev-eyebrow">{t.eyebrow}</p>
        <h2 id="ev-section-title">{t.title}</h2>
        <p>{t.intro}</p>
      </div>
      <div className="ev-grid">
        {t.cards.map((card,index)=>{
          const Figure = diagrams[index];
          return <article className="ev-card" key={card.eyebrow}>
            <div className="ev-figure"><Figure/></div>
            <div className="ev-card-body">
              <span className="ev-index">{card.eyebrow}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <code className="ev-formula">{card.formula}</code>
              <small className="ev-limitation">{card.limitation}</small>
              <a href={card.href} className="ev-action">{card.action}<span aria-hidden="true">↗</span></a>
            </div>
          </article>;
        })}
      </div>
      <p className="ev-footnote">{t.note}</p>
    </div>
  </section>;
}

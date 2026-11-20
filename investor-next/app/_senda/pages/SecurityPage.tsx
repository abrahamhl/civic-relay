'use client';

import { ShieldCheck, Lock, EyeOff, FileWarning, Cpu, ExternalLink } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import { REPO_URL, type Locale } from '../data/types';

export default function SecurityPage({ locale }: { locale: Locale }) {
  const copy = {
    en: {
      eyebrow: 'SECURITY, PRIVACY & GOVERNANCE',
      title: 'Lawful by design, encrypted end to end, and human-governed.',
      lead: 'SENDA builds privacy, cryptographic integrity, and regulatory clarity into its core architecture—combining blind E2EE relays, on-device vision analytics, and explicit legal boundaries for sensitive emergency services.',
      threatTitle: 'Cryptographic architecture & legal safeguards',
      threats: [
        {
          icon: Lock,
          title: 'Blind E2EE relays & signed receipts',
          body: 'Envelopes use ECDH P-256 + AES-GCM + ECDSA signatures so intermediate relays route packets solely by destination hash, priority, and TTL. Anti-replay tombstones enforce envelope integrity.',
          ev: 'EV-CORE-506'
        },
        {
          icon: EyeOff,
          title: 'Privacy-first vision & k-anonymity',
          body: 'Traffic analysis runs YOLOX-s + ByteTrack locally to count crossings without storing video frames, reading license plates, or running biometric identification. Telemetry enforces k-anonymity (k >= 5).',
          ev: 'EV-CONSOLE-16K'
        },
        {
          icon: ShieldCheck,
          title: 'Legal scope for sensitive emergency services',
          body: 'SENDA operates strictly as a complementary secondary channel alongside official 112, EU-Alert, and eCall services. Radio interception, unlicensed transmission, and private camera access are excluded by design; institutional agency integrations require formal agreements.',
          ev: 'EV-02-SWEEP'
        }
      ],
      dataTitle: 'Data minimization architecture',
      dataRows: [
        { item: 'Public website (investor-next)', processed: 'Local browser storage for theme and language preference only.', safeguards: 'Zero tracking cookies, zero third-party analytics, zero server-side PII collection.' },
        { item: 'Offline PWA (/senda/)', processed: 'On-device IndexedDB queue and E2EE binary envelopes.', safeguards: 'Blind relay transport; signed receiver ACK purges cached copies automatically.' },
        { item: 'Android Nearby Lab', processed: 'Session-pinned ephemeral P-256 keys and strict synthetic test tokens erased on STOP.', safeguards: 'Fail-closed erasure policy and strict payload validation.' }
      ],
      complianceTitle: 'Regulatory framework & legal disclosures',
      complianceRows: [
        { reg: 'Emergency Service Boundary', status: 'Complementary secondary communication channel; does not replace official 112, ES-Alert, NL-Alert, or eCall infrastructure.', ev: 'EV-02-SWEEP' },
        { reg: 'GDPR (EU 2016/679)', status: 'Privacy-by-design architecture with k-anonymity and data minimization; formal institutional DPIA scheduled in pilot phase.', ev: 'EV-CORE-506' },
        { reg: 'Spanish ENS (RD 311/2022)', status: 'Formal ENS conformity certification is scheduled ahead of Spanish public-sector production procurement (no current ENS certification).', ev: 'EV-10-INST' },
        { reg: 'EU AI Act & Dual-Use (2024/1689 · 2021/821)', status: 'Criticality ordering uses deterministic rules rather than autonomous ML; dual-use counter-UAS research stays strictly isolated in /defense/ (noindex).', ev: 'EV-CORE-506' }
      ],
      aiTitle: 'Human-led AI orchestration & vibe coding transparency',
      aiBody: 'SENDA is one of the largest real-world projects in AI delegation and orchestration ("vibe coding" at engineering scale). We leverage generative AI for rapid modeling, implementation, and bounded creative exploration while NEVER letting AI make autonomous decisions—every architectural direction, safety invariant, and deliverable remains under constant human supervision and automated verification by the founder. In full respect of NLnet Generative AI Policy v2.0, this work is disclosed transparently.',
      disclosureTitle: 'Coordinated vulnerability disclosure (SECURITY.txt)',
      disclosureBody: 'Report security vulnerabilities privately to security@civic-relay.example.com. Coordinated 90-day disclosure window with a 48-hour acknowledgement target.'
    },
    es: {
      eyebrow: 'SEGURIDAD, PRIVACIDAD Y GOBERNANZA',
      title: 'Legal por diseño, cifrado de extremo a extremo y gobernado por humanos.',
      lead: 'SENDA integra privacidad, integridad criptográfica y cumplimiento normativo desde el núcleo: relés ciegos E2E, visión artificial local sin matrículas y delimitación legal expresa para servicios sensibles de emergencia.',
      threatTitle: 'Arquitectura criptográfica y salvaguardas legales',
      threats: [
        {
          icon: Lock,
          title: 'Relés ciegos E2E y recibos firmados',
          body: 'Los sobres emplean ECDH P-256 + AES-GCM + firmas ECDSA para que los nodos intermedios enruten únicamente por cabecera, prioridad y TTL. Las lápidas anti-replay protegen la integridad del flujo.',
          ev: 'EV-CORE-506'
        },
        {
          icon: EyeOff,
          title: 'Visión con privacidad por diseño y k-anonimato',
          body: 'El conteo vial ejecuta YOLOX-s + ByteTrack en local sin almacenar imágenes, sin lectura de matrículas ni biometría. Las métricas agregadas aplican k-anonimato (k ≥ 5).',
          ev: 'EV-CONSOLE-16K'
        },
        {
          icon: ShieldCheck,
          title: 'Marco legal en servicios sensibles de emergencia',
          body: 'SENDA opera estrictamente como canal secundario complementario a los sistemas oficiales 112, ES-Alert y eCall. Por legalidad y diseño excluye cualquier emisión sin licencia, escucha de radios de emergencia o acceso a cámaras privadas; las integraciones con organismos se articulan siempre mediante convenio formal.',
          ev: 'EV-02-SWEEP'
        }
      ],
      dataTitle: 'Arquitectura de minimización de datos',
      dataRows: [
        { item: 'Web pública (investor-next)', processed: 'Almacenamiento local únicamente para preferencia de tema e idioma.', safeguards: 'Cero cookies de seguimiento, cero analítica de terceros y cero almacenamiento de PII en servidor.' },
        { item: 'PWA sin red (/senda/)', processed: 'Cola IndexedDB en el dispositivo y sobres binarios cifrados E2E.', safeguards: 'Transporte en relé ciego; el ACK firmado purga automáticamente copias en tránsito.' },
        { item: 'Laboratorio Android Nearby', processed: 'Claves efímeras P-256 fijadas por sesión y purga inmediata al pulsar STOP.', safeguards: 'Política de borrado fail-closed y validación estricta de carga.' }
      ],
      complianceTitle: 'Marco normativo y aclaraciones legales',
      complianceRows: [
        { reg: 'Delimitación frente al 112', status: 'Canal secundario complementario de comunicaciones; no sustituye a los servicios oficiales 112, ES-Alert ni eCall.', ev: 'EV-02-SWEEP' },
        { reg: 'RGPD (UE 2016/679)', status: 'Privacidad por diseño con k-anonimato y minimización de datos; DPIA formal planificada en fase piloto institucional.', ev: 'EV-CORE-506' },
        { reg: 'Esquema Nacional de Seguridad (ENS)', status: 'La certificación ENS (RD 311/2022) está planificada en la hoja de ruta previa a contratos con la Administración española (actualmente sin conformidad ENS).', ev: 'EV-10-INST' },
        { reg: 'Ley de IA y Doble Uso (2024/1689 · 2021/821)', status: 'La priorización de avisos usa reglas deterministas auditables (no ML autónomo); los módulos de doble uso permanecen aislados en /defense/ (noindex).', ev: 'EV-CORE-506' }
      ],
      aiTitle: 'Delegación, orquestación con IA y vibe coding bajo supervisión humana',
      aiBody: 'SENDA es uno de los mayores proyectos de delegación y orquestación en vibe coding: nos apoyamos en la IA generativa para acelerar ingeniería, modelado y documentación con libertad creativa acotada, pero controlando siempre la dirección y sin dejar nunca que la IA tome decisiones, bajo supervisión constante y verificación automatizada del fundador. En respeto a la política NLnet v2.0, esta metodología se declara con total transparencia.',
      disclosureTitle: 'Divulgación responsable de vulnerabilidades (SECURITY.txt)',
      disclosureBody: 'Notifica vulnerabilidades de forma privada a security@civic-relay.example.com. Ventana coordinada de 90 días con objetivo de respuesta inicial en 48 horas.'
    },
    nl: {
      eyebrow: 'BEVEILIGING, PRIVACY & GOVERNANCE',
      title: 'Rechtmatig door ontwerp, end-to-end versleuteld en menselijk bestuurd.',
      lead: 'SENDA verankert privacy, cryptografische integriteit en juridische helderheid in de kernarchitectuur—met blinde E2EE-relays, lokale verkeersanalyse en duidelijke wettelijke kaders voor gevoelige nooddiensten.',
      threatTitle: 'Cryptografische architectuur & wettelijke waarborgen',
      threats: [
        {
          icon: Lock,
          title: 'Blinde E2EE-relays & ondertekende ACK’s',
          body: 'Enveloppen gebruiken ECDH P-256 + AES-GCM + ECDSA zodat tussenstations uitsluitend routeren op basis van header, prioriteit en TTL.',
          ev: 'EV-CORE-506'
        },
        {
          icon: EyeOff,
          title: 'Privacy-first visie & k-anonimiteit',
          body: 'YOLOX-s + ByteTrack telt voertuigen lokaal zonder beelden op te slaan, kentekens te lezen of biometrie te gebruiken. Telemetrie handhaaft k-anonimiteit (k >= 5).',
          ev: 'EV-CONSOLE-16K'
        },
        {
          icon: ShieldCheck,
          title: 'Wettelijk kader voor gevoelige nooddiensten',
          body: 'SENDA werkt strikt als aanvullend secundair kanaal naast 112, NL-Alert en eCall. Zenden zonder vergunning, afluisteren van hulpdienstradio’s en toegang tot privékamera’s zijn uitgesloten; overheidskoppelingen verlopen via formele overeenkomsten.',
          ev: 'EV-02-SWEEP'
        }
      ],
      dataTitle: 'Architectuur voor dataminimalisatie',
      dataRows: [
        { item: 'Publieke website (investor-next)', processed: 'Alleen lokale opslag voor thema- en taalvoorkeur.', safeguards: 'Geen trackingcookies, geen derde-partij analytics en geen serveropslag van PII.' },
        { item: 'Offline PWA (/senda/)', processed: 'Lokale IndexedDB-wachtrij en versleutelde E2EE-enveloppen.', safeguards: 'Blinde relay-doorgifte; ondertekende ACK wist kopieën automatisch.' },
        { item: 'Android Nearby Lab', processed: 'Sessiegebonden P-256-sleutels met onmiddellijke wissing bij STOP.', safeguards: 'Fail-closed wisbeleid en strikte payloadvalidatie.' }
      ],
      complianceTitle: 'Regelgeving & wettelijke verantwoording',
      complianceRows: [
        { reg: 'Afbakening met 112', status: 'Secundair aanvullend communicatiekanaal; vervangt geen officiële 112-, NL-Alert- of eCall-diensten.', ev: 'EV-02-SWEEP' },
        { reg: 'AVG / GDPR (EU 2016/679)', status: 'Privacy-by-design met k-anonimiteit en dataminimalisatie; formele DPIA gepland voor institutionele pilots.', ev: 'EV-CORE-506' },
        { reg: 'ENS / ISO 27001-traject', status: 'Formele conformiteitscertificering (zoals Spaanse ENS) staat gepland vóór publieke aanbestedingen (momenteel geen ENS-certificering).', ev: 'EV-10-INST' },
        { reg: 'EU AI Act & Dual-Use (2024/1689 · 2021/821)', status: 'Prioritering werkt via deterministische regels (geen autonome ML); dual-use onderzoeksmodules blijven geïsoleerd in /defense/ (noindex).', ev: 'EV-CORE-506' }
      ],
      aiTitle: 'Menselijk geleide AI-orkestratie & vibe coding transparantie',
      aiBody: 'SENDA is een van de grootste praktijkprojecten in AI-delegatie en vibe coding: we zetten generatieve AI in voor hoge engineeringssnelheid en afgebakende creatieve ruimte, maar laten AI nooit zelfstandig beslissen—elke richting, veiligheidsgrens en oplevering staat onder constante menselijke supervisie van de oprichter. Conform het NLnet v2.0-beleid wordt deze werkwijze transparant vermeld.',
      disclosureTitle: 'Kwetsbaarheden melden (SECURITY.txt)',
      disclosureBody: 'Meld beveiligingsproblemen vertrouwelijk via security@civic-relay.example.com. Gecoördineerde publicatie na 90 dagen; streeftijd eerste reactie 48 uur.'
    }
  }[locale];

  return (
    <PageShell locale={locale} active="security">
      <section className="s-section-tight">
        <div className="s-container">
          <div className="s-read">
            <p className="s-eyebrow">{copy.eyebrow}</p>
            <h1 className="s-h1">{copy.title}</h1>
            <p className="s-lead">{copy.lead}</p>
          </div>
        </div>
      </section>

      {/* Threat Model */}
      <section className="s-section-tight s-sunk">
        <div className="s-container s-stack-lg">
          <h2 className="s-h2">{copy.threatTitle}</h2>
          <div className="s-grid s-grid-3">
            {copy.threats.map((t) => {
              const Icon = t.icon;
              return (
                <article key={t.title} className="s-card s-stack">
                  <div className="s-between">
                    <div className="s-card-icon" style={{ marginBottom: 0 }}>
                      <Icon aria-hidden="true" />
                    </div>
                    <EvidenceBadge locale={locale} evidenceId={t.ev} compact />
                  </div>
                  <h3 className="s-h3">{t.title}</h3>
                  <p>{t.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Data Inventory & Compliance */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <h2 className="s-h2">{copy.dataTitle}</h2>
          <div tabIndex={0} role="region" aria-label={copy.dataTitle} className="s-table-wrap">
            <table className="s-table s-table-responsive">
              <thead>
                <tr>
                  <th scope="col">{locale === 'es' ? 'Superficie' : locale === 'nl' ? 'Oppervlak' : 'Surface'}</th>
                  <th scope="col">{locale === 'es' ? 'Datos tratados' : locale === 'nl' ? 'Verwerkt' : 'Processed'}</th>
                  <th scope="col">{locale === 'es' ? 'Salvaguardas' : locale === 'nl' ? 'Waarborgen' : 'Safeguards'}</th>
                </tr>
              </thead>
              <tbody>
                {copy.dataRows.map((row) => (
                  <tr key={row.item}>
                    <th scope="row">{row.item}</th>
                    <td data-label={locale === 'es' ? 'Datos tratados' : locale === 'nl' ? 'Verwerkt' : 'Processed'}>{row.processed}</td>
                    <td data-label={locale === 'es' ? 'Salvaguardas' : locale === 'nl' ? 'Waarborgen' : 'Safeguards'}>{row.safeguards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="s-h2" style={{ marginTop: 24 }}>{copy.complianceTitle}</h2>
          <div className="s-grid s-grid-2">
            {copy.complianceRows.map((row) => (
              <article key={row.reg} className="s-card s-stack">
                <div className="s-between">
                  <h3 className="s-h3">{row.reg}</h3>
                  <EvidenceBadge locale={locale} evidenceId={row.ev} compact />
                </div>
                <p>{row.status}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* AI Orchestration & SECURITY.txt */}
      <section className="s-section s-sunk">
        <div className="s-container s-grid s-grid-2">
          <article className="s-card s-stack">
            <div className="s-row">
              <Cpu size={20} style={{ color: 'var(--s-accent)' }} aria-hidden="true" />
              <h2 className="s-h3">{copy.aiTitle}</h2>
            </div>
            <p>{copy.aiBody}</p>
            <div>
              <a
                href="https://nlnet.nl/foundation/policies/generativeAI/2.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="s-btn s-btn-secondary s-btn-sm"
              >
                <span>NLnet GenAI Policy v2.0</span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </article>

          <article className="s-card s-stack">
            <div className="s-row">
              <FileWarning size={20} style={{ color: 'var(--s-accent)' }} aria-hidden="true" />
              <h2 className="s-h3">{copy.disclosureTitle}</h2>
            </div>
            <p>{copy.disclosureBody}</p>
            <div className="s-row">
              <a href="/.well-known/security.txt" className="s-btn s-btn-secondary s-btn-sm">
                <span>/.well-known/security.txt</span>
              </a>
              <a
                href={`${REPO_URL}/blob/master/SECURITY.txt`}
                target="_blank"
                rel="noopener noreferrer"
                className="s-btn s-btn-ghost s-btn-sm"
              >
                <span>GitHub SECURITY.txt</span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  );
}

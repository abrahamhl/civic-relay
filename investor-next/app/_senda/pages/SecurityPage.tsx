'use client';

import { ShieldCheck, Lock, EyeOff, FileWarning, Cpu, ExternalLink } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import { REPO_URL, type Locale } from '../data/types';

export default function SecurityPage({ locale }: { locale: Locale }) {
  const copy = {
    en: {
      eyebrow: 'SECURITY, PRIVACY & GOVERNANCE',
      title: 'Lawful by design. Honest about every compliance gap.',
      lead: 'SENDA enforces strict technical boundaries: blind E2EE relays, opt-in consent, k-anonymity, zero radio interception, and explicit disclosure of uncertified compliance areas.',
      threatTitle: 'Summarized threat model & legal policy',
      threats: [
        {
          icon: Lock,
          title: 'Blind E2EE relays & replay protection',
          body: 'Envelopes use ECDH P-256 + AES-GCM + ECDSA signatures so intermediate handsets see only routing header, priority, and TTL. Anti-replay tombstones reject forged or expired packets. Independent crypto audit remains pending (Issue #4).',
          ev: 'EV-CORE-506'
        },
        {
          icon: EyeOff,
          title: 'Privacy by design (no surveillance)',
          body: 'Traffic cameras count vehicle crossings on-device via YOLOX-s + ByteTrack without storing raw video, reading license plates, or running facial recognition. Aggregated telemetry enforces k-anonymity (k >= 5).',
          ev: 'EV-CONSOLE-16K'
        },
        {
          icon: ShieldCheck,
          title: 'PASSIVE / AGREEMENT / NEVER boundary',
          body: 'NEVER intercepts or transmits on unlicensed frequencies, NEVER listens to TETRA/emergency radios, NEVER detects speed cameras, and NEVER accesses private cameras. Institutional features require signed agreements.',
          ev: 'EV-02-SWEEP'
        }
      ],
      dataTitle: 'What data is processed (and what is not)',
      dataRows: [
        { item: 'Public web site (investor-next)', processed: 'Theme preference & cookie notice dismissal in browser localStorage only.', notProcessed: 'No analytics cookies, no third-party ad trackers, no server-side PII storage.' },
        { item: 'Offline PWA (/senda/)', processed: 'Local encrypted envelopes & IndexedDB queue on user device; synthetic lab payloads.', notProcessed: 'No plaintext message reading on relays; no real 112 dispatch records.' },
        { item: 'Android Nearby Lab', processed: 'Fixed synthetic test token (SYNTHETIC_STATUS_CHECK_NOT_REAL_SOS) erased on STOP.', notProcessed: 'Rejects arbitrary PII; plaintext TSV is NOT approved for real personal data.' }
      ],
      complianceTitle: 'Regulatory compliance status',
      complianceRows: [
        { reg: 'GDPR (EU 2016/679)', status: 'Formal DPIA pending (M2 milestone). Privacy-by-design architecture implemented in code.', ev: 'EV-10-INST' },
        { reg: 'Spanish ENS (RD 311/2022)', status: 'NO ENS CONFORMITY TODAY. Required before supplying operational services to Spanish public administration.', ev: 'EV-10-INST' },
        { reg: 'EU AI Act (Reg. 2024/1689)', status: 'Emergency prioritization can fall under Annex III high-risk scope. SENDA criticality is deterministic rule-based (non-ML), but formal legal review is pending.', ev: 'EV-10-INST' },
        { reg: 'EU Dual-Use (Reg. 2021/821)', status: 'Counter-UAS research modules are strictly isolated in /defense/ (noindex) and excluded from civil scope.', ev: 'EV-CORE-506' }
      ],
      aiTitle: 'Generative AI transparency (NLnet v2.0 policy)',
      aiBody: 'SENDA includes software, documentation, and test suites developed with generative AI assistance under human review and automated testing. Green tests do not replace an independent human audit. Under NLnet Generative AI Policy v2.0 (20 Oct 2026), which bars GenAI-authored proposals and funded artifacts, this site and repository are NOT presented as an automated NLnet candidacy.',
      disclosureTitle: 'Vulnerability disclosure (SECURITY.txt)',
      disclosureBody: 'Report security vulnerabilities privately to security@civic-relay.example.com. Coordinated 90-day disclosure window; 48-hour initial acknowledgement target. No active bug bounty program.'
    },
    es: {
      eyebrow: 'SEGURIDAD, PRIVACIDAD Y GOBERNANZA',
      title: 'Legal por diseño. Transparente en cada cumplimiento pendiente.',
      lead: 'SENDA impone límites técnicos verificables: relés ciegos E2E, consentimiento explícito, k-anonimato, cero escuchas de radio y declaración honesta de las certificaciones que todavía no existen.',
      threatTitle: 'Modelo de amenazas resumido y política legal',
      threats: [
        {
          icon: Lock,
          title: 'Relés ciegos E2E y protección anti-repetición',
          body: 'Los sobres usan ECDH P-256 + AES-GCM + firmas ECDSA para que los móviles intermedios solo vean cabecera, prioridad y caducidad. Las lápidas anti-replay rechazan paquetes forjados o caducados. Falta auditoría criptográfica independiente (Issue #4).',
          ev: 'EV-CORE-506'
        },
        {
          icon: EyeOff,
          title: 'Privacidad por diseño (sin vigilancia)',
          body: 'La visión de tráfico cuenta cruces en local con YOLOX-s + ByteTrack sin guardar imágenes, sin leer matrículas y sin reconocimiento facial. Las métricas agregadas exigen k-anonimato (k ≥ 5).',
          ev: 'EV-CONSOLE-16K'
        },
        {
          icon: ShieldCheck,
          title: 'Política PASIVO / CONVENIO / NUNCA',
          body: 'NUNCA intercepta ni emite sin licencia, NUNCA escucha radios TETRA de emergencia, NUNCA detecta radares ni usa cámaras privadas. Toda integración institucional exige convenio firmado.',
          ev: 'EV-02-SWEEP'
        }
      ],
      dataTitle: 'Qué datos se tratan y cuáles no',
      dataRows: [
        { item: 'Web pública (investor-next)', processed: 'Preferencia de tema y cierre de aviso en localStorage del navegador.', notProcessed: 'Sin cookies de seguimiento, sin analítica de terceros ni almacenamiento de PII en servidor.' },
        { item: 'PWA sin red (/senda/)', processed: 'Sobres cifrados y cola local IndexedDB en el propio dispositivo.', notProcessed: 'Sin lectura en claro en relés; sin envío real a salas 112.' },
        { item: 'Laboratorio Android Nearby', processed: 'Carga sintética fija (SYNTHETIC_STATUS_CHECK_NOT_REAL_SOS) purgada al pulsar STOP.', notProcessed: 'Rechaza PII arbitraria; el archivo TSV sin cifrar NO es apto para datos personales reales.' }
      ],
      complianceTitle: 'Estado de cumplimiento normativo',
      complianceRows: [
        { reg: 'RGPD (UE 2016/679)', status: 'Evaluación de impacto (DPIA) formal pendiente (hito M2). Privacidad por diseño aplicada en el código.', ev: 'EV-10-INST' },
        { reg: 'Esquema Nacional de Seguridad (ENS)', status: 'NO HAY CONFORMIDAD ENS actualmente. Requisito obligatorio antes de prestar servicios a la Administración española.', ev: 'EV-10-INST' },
        { reg: 'Ley de IA (Reglamento UE 2024/1689)', status: 'La priorización en emergencias puede entrar en alto riesgo (anexo III). La criticidad de SENDA es por reglas deterministas (no ML), pero el análisis jurídico formal está pendiente.', ev: 'EV-10-INST' },
        { reg: 'Doble uso (Reglamento UE 2021/821)', status: 'Los módulos de investigación anti-UAS se mantienen aislados en /defense/ (noindex) y fuera del ámbito civil.', ev: 'EV-CORE-506' }
      ],
      aiTitle: 'Transparencia del uso de IA generativa (política NLnet v2.0)',
      aiBody: 'SENDA incluye desarrollo, documentación y pruebas asistidos por IA generativa bajo revisión humana y validación automatizada. Las pruebas en verde no sustituyen una auditoría independiente. Conforme a la política NLnet v2.0 (20-10-2026), que prohíbe redactar solicitudes o artefactos financiados con GenAI, esta web y repositorio NO se presentan como candidatura automatizada a NLnet.',
      disclosureTitle: 'Política de divulgación responsable (SECURITY.txt)',
      disclosureBody: 'Notifica vulnerabilidades de forma privada a security@civic-relay.example.com. Ventana coordinada de 90 días; objetivo de primera respuesta en 48 horas. Sin programa activo de recompensas.'
    },
    nl: {
      eyebrow: 'BEVEILIGING, PRIVACY & GOVERNANCE',
      title: 'Rechtmatig door ontwerp. Eerlijk over elke openstaande certificering.',
      lead: 'SENDA handhaaft strikte technische grenzen: blinde E2EE-relays, opt-in toestemming, k-anonimiteit, geen radio-afluistering en volledige openheid over compliance-status.',
      threatTitle: 'Samengevat dreigingsmodel & juridisch beleid',
      threats: [
        {
          icon: Lock,
          title: 'Blinde E2EE-relays & anti-replay',
          body: 'Enveloppen gebruiken ECDH P-256 + AES-GCM + ECDSA zodat tussenstations alleen header, prioriteit en TTL zien. Anti-replay weigert verlopen of vervalste pakketten. Externe crypto-audit nog nodig (Issue #4).',
          ev: 'EV-CORE-506'
        },
        {
          icon: EyeOff,
          title: 'Privacy by design (geen surveillance)',
          body: 'Verkeersanalyse telt voertuigen lokaal met YOLOX-s + ByteTrack zonder beelden op te slaan, kentekens te lezen of gezichten te herkennen. Aggregatie vereist k-anonimiteit (k >= 5).',
          ev: 'EV-CONSOLE-16K'
        },
        {
          icon: ShieldCheck,
          title: 'Beleid PASSIEF / OVEREENKOMST / NOOIT',
          body: 'NOOIT zenden zonder vergunning, NOOIT hulpdienstradio’s afluisteren, NOOIT flitscamera’s detecteren en NOOIT privékamera’s gebruiken. Overheidsfuncties vereisen getekende overeenkomsten.',
          ev: 'EV-02-SWEEP'
        }
      ],
      dataTitle: 'Welke gegevens worden verwerkt',
      dataRows: [
        { item: 'Publieke website (investor-next)', processed: 'Alleen themavoorkeur en cookiemelding in lokale browseropslag.', notProcessed: 'Geen trackingcookies, geen derde-partij analytics, geen serveropslag van persoonsgegevens.' },
        { item: 'Offline PWA (/senda/)', processed: 'Versleutelde lokale enveloppen en IndexedDB-wachtrij op het toestel.', notProcessed: 'Geen leesbare inhoud op relays; geen echte 112-meldingen.' },
        { item: 'Android Nearby Lab', processed: 'Vaste synthetische testwaarde (SYNTHETIC_STATUS_CHECK_NOT_REAL_SOS), gewist bij STOP.', notProcessed: 'Weigert willekeurige PII; onversleutelde TSV is NIET geschikt voor echte persoonsgegevens.' }
      ],
      complianceTitle: 'Status regelgeving & naleving',
      complianceRows: [
        { reg: 'AVG / GDPR (EU 2016/679)', status: 'Formele DPIA nog nodig (mijlpaal M2). Privacy-by-design geïmplementeerd in de broncode.', ev: 'EV-10-INST' },
        { reg: 'ENS (Spaanse overheidsnorm)', status: 'GEEN ENS-CONFORMITEIT op dit moment. Verplicht vóór levering aan Spaanse overheden.', ev: 'EV-10-INST' },
        { reg: 'EU AI Act (Verordening 2024/1689)', status: 'Noodprioritering kan onder Bijlage III vallen. SENDA gebruikt deterministische regels (geen ML), maar juridische toetsing is nog open.', ev: 'EV-10-INST' },
        { reg: 'Dual-Use (Verordening 2021/821)', status: 'Anti-UAS-onderzoeksmodules staan strikt geïsoleerd in /defense/ (noindex) buiten het civiele product.', ev: 'EV-CORE-506' }
      ],
      aiTitle: 'Transparantie over generatieve AI (NLnet v2.0)',
      aiBody: 'SENDA bevat code, documentatie en tests ondersteund door generatieve AI onder menselijke controle en geautomatiseerde verificatie. Groene tests vervangen geen onafhankelijke audit. Gezien het NLnet GenAI-beleid v2.0 (20 okt 2026) vormt deze website GEEN geautomatiseerde NLnet-aanvraag.',
      disclosureTitle: 'Kwetsbaarheden melden (SECURITY.txt)',
      disclosureBody: 'Meld beveiligingsproblemen vertrouwelijk via security@civic-relay.example.com. Gecoördineerde publicatie na 90 dagen; streeftijd eerste reactie 48 uur. Geen bugbountyprogramma.'
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
                  <th scope="col">{locale === 'es' ? 'Excluido / No recogido' : locale === 'nl' ? 'Uitgesloten / Niet verzameld' : 'Excluded / Not collected'}</th>
                </tr>
              </thead>
              <tbody>
                {copy.dataRows.map((row) => (
                  <tr key={row.item}>
                    <th scope="row">{row.item}</th>
                    <td data-label={locale === 'es' ? 'Datos tratados' : locale === 'nl' ? 'Verwerkt' : 'Processed'}>{row.processed}</td>
                    <td data-label={locale === 'es' ? 'Excluido' : locale === 'nl' ? 'Uitgesloten' : 'Excluded'}>{row.notProcessed}</td>
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

      {/* AI Transparency & SECURITY.txt */}
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

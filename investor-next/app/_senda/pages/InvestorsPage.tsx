'use client';

import { useState, type FormEvent } from 'react';
import { Download, ExternalLink, Send, CheckCircle2, Users, Handshake, Film } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import MediaVideo from '../components/MediaVideo';
import {
  FUNDING_ENVELOPES,
  INVESTOR_MILESTONES,
  INVESTOR_RISKS
} from '../data/investors';
import { REPO_URL, type Locale } from '../data/types';

export default function InvestorsPage({ locale }: { locale: Locale }) {
  const [selectedEnv, setSelectedEnv] = useState<'A' | 'B' | 'C'>('B');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const envelope = FUNDING_ENVELOPES.find((e) => e.id === selectedEnv) ?? FUNDING_ENVELOPES[1];

  const copy = {
    en: {
      eyebrow: 'INVESTORS & EUROPEAN PARTNERS',
      title: 'Milestone-gated research with verifiable evidence.',
      lead: 'Executive overview in one view: real software traction, honest gaps (zero fabricated clients or valuations), illustrative funding envelopes, and measurable acceptance gates.',
      execCards: [
        { k: 'Problem', v: 'Single-network outages isolate citizens and responders during floods, wildfires, and blackouts.', ev: 'EV-S01-ROUTE' },
        { k: 'Solution', v: 'Deterministic multi-channel emergency routing (BLE, Wi-Fi Direct, neighbor sat, SMS, acoustic) + situational correlation.', ev: 'EV-CORE-506' },
        { k: 'Market sizing', v: 'To be validated — B2G (municipalities, regions, CPI), B2B (fleets, concessionaires, insurers). No invented TAM.', ev: 'EV-10-INST' },
        { k: 'Real traction', v: '506/506 core tests, 49/49 offline Chromium E2E, compiled Android lab APK. 0 paying clients, 0 signed LOIs yet.', ev: 'EV-OFFLINE-49' },
        { k: 'Funding stage', v: 'Illustrative envelopes (€50k / €180k / €400k) for physical validation, security audit, and Horizon CL3 2027 consortium.', ev: 'EV-09-PHY' }
      ],
      fundsTitle: 'Use of funds (illustrative planning envelopes)',
      fundsNote: 'These figures are illustrative planning envelopes from docs/investor/FINANCIAL_SCENARIOS.md — NOT committed capital, quotations, or grant awards.',
      milestonesTitle: 'Milestones & measurable exit criteria',
      risksTitle: 'Risks & concrete mitigations',
      teamTitle: 'Team & governance transparency',
      teamLead: 'No inflated resumes or fictional advisory boards. Open gaps are stated explicitly.',
      partnerTitle: 'What we need from a partner',
      partnerAsks: [
        '2–3 Letters of Intent (municipal civil protection, volunteer corps, fleet or highway concessionaire).',
        'Consortium coordinator for Horizon Europe Cluster 3 (2027 DRS-01 / DRS-02 window) via CDTI (ES) or RVO (NL).',
        'Instrumented field-trial access (20 volunteers, 2 hours, controlled coverage cutoff) to close Issue #5.',
        'Co-founder or senior advisors with live 112, wildfire command, or public-procurement (CPI/ENS) experience.'
      ],
      docsTitle: 'Downloadable dossier & press kit',
      formTitle: 'Request investor dossier or propose a pilot',
      formLead: 'Zero tracking cookies. Submitting prepares a structured inquiry (copy or send via your mail client; this static build stores no personal data on any server).',
      fName: 'Full name',
      fOrg: 'Organization / Fund',
      fEmail: 'Work email',
      fMsg: 'Message (pilot, consortium, or diligence focus)',
      fConsent: 'I consent to use this message solely to respond to my SENDA dossier/pilot inquiry under GDPR. No newsletters or third-party sharing.',
      fSubmit: 'Prepare dossier request',
      fDone: 'Request prepared locally. Use the button below to open your email client or copy the message directly.',
      fOpenMail: 'Open in email client'
    },
    es: {
      eyebrow: 'INVERSORES Y SOCIOS EUROPEOS',
      title: 'Investigación financiable por hitos y con evidencia verificable.',
      lead: 'Resumen ejecutivo en una pantalla: tracción real en software, huecos honestos (cero clientes ni valoraciones inventadas), escenarios ilustrativos de ronda y criterios de éxito medibles.',
      execCards: [
        { k: 'Problema', v: 'La caída de la red celular deja incomunicadas a familias y equipos en riadas, incendios o apagones.', ev: 'EV-S01-ROUTE' },
        { k: 'Solución', v: 'Enrutamiento multicanal determinista (BLE, Wi-Fi Direct, satélite vecino, SMS, sonido) + correlación operativa.', ev: 'EV-CORE-506' },
        { k: 'Tamaño de mercado', v: 'Por validar — B2G (ayuntamientos, CCAA, CPI) y B2B (flotas, concesionarias, aseguradoras). Cero cifras inventadas.', ev: 'EV-10-INST' },
        { k: 'Tracción real', v: '506/506 tests de núcleo, 49/49 E2E offline en Chromium, APK Android compilada. 0 clientes de pago y 0 cartas de interés aún.', ev: 'EV-OFFLINE-49' },
        { k: 'Ronda / Instrumento', v: 'Escenarios ilustrativos (50 k€ / 180 k€ / 400 k€) para prueba física, auditoría y consorcio Horizon CL3 2027.', ev: 'EV-09-PHY' }
      ],
      fundsTitle: 'Uso de fondos (escenarios ilustrativos de planificación)',
      fundsNote: 'Importes ilustrativos procedentes de docs/investor/FINANCIAL_SCENARIOS.md — NO son capital comprometido, presupuestos cerrados ni subvenciones concedidas.',
      milestonesTitle: 'Hitos con fecha y criterio de éxito medible',
      risksTitle: 'Riesgos y mitigaciones',
      teamTitle: 'Equipo y gobernanza',
      teamLead: 'Sin currículums inflados ni consejos asesores ficticios. Los huecos abiertos se muestran como «Por validar».',
      partnerTitle: 'Qué necesitamos de un socio',
      partnerAsks: [
        '2–3 cartas de interés firmadas (Protección Civil municipal, agrupación de voluntarios, concesionaria o flota).',
        'Coordinador de consorcio para Horizon Europe Cluster 3 (ventana 2027 DRS-01 / DRS-02) vía CDTI o RVO.',
        'Acceso a una prueba de campo medida (20 voluntarios, 2 horas, cobertura apagada) para cerrar el hito P0 (Issue #5).',
        'Cofundador o 2–3 asesores con experiencia real en 112, bomberos forestales, DGT o compra pública (CPI/ENS).'
      ],
      docsTitle: 'Descargas del dossier y kit de prensa',
      formTitle: 'Solicitar dossier o proponer un piloto',
      formLead: 'Sin cookies de seguimiento. Al enviar se prepara tu consulta localmente (esta web estática no almacena datos personales en servidores propios).',
      fName: 'Nombre completo',
      fOrg: 'Organización / Fondo',
      fEmail: 'Correo profesional',
      fMsg: 'Mensaje (piloto técnico, consorcio europeo o diligencia)',
      fConsent: 'Consiento el uso de estos datos únicamente para responder a mi solicitud sobre SENDA conforme al RGPD. Sin boletines ni cesión a terceros.',
      fSubmit: 'Preparar solicitud de dossier',
      fDone: 'Solicitud preparada localmente. Abre tu cliente de correo o copia el resumen para enviarlo.',
      fOpenMail: 'Abrir en cliente de correo'
    },
    nl: {
      eyebrow: 'INVESTEERDERS & EUROPESE PARTNERS',
      title: 'Mijlpaalgestuurd onderzoek met controleerbaar bewijs.',
      lead: 'Managementsamenvatting in één oogopslag: echte softwaretractie, eerlijke hiaten (geen verzonnen klanten), illustratieve budgetscenario’s en meetbare acceptatiecriteria.',
      execCards: [
        { k: 'Probleem', v: 'Uitval van één mobiel netwerk isoleert burgers en hulpverleners bij overstromingen, branden en stroomstoringen.', ev: 'EV-S01-ROUTE' },
        { k: 'Oplossing', v: 'Deterministische multikanaal-noodroutering (BLE, Wi-Fi Direct, buursatelliet, sms, geluid) + situatiecorrelatie.', ev: 'EV-CORE-506' },
        { k: 'Marktomvang', v: 'Nog te valideren — B2G (gemeenten, veiligheidsregio’s) en B2B (vloten, wegbeheerders, verzekeraars).', ev: 'EV-10-INST' },
        { k: 'Echte tractie', v: '506/506 kerntests, 49/49 offline Chromium E2E, gecompileerde Android-APK. Nog 0 betalende klanten of getekende LOI’s.', ev: 'EV-OFFLINE-49' },
        { k: 'Financiering', v: 'Illustratieve scenario’s (€50k / €180k / €400k) voor fysieke validatie, audit en Horizon CL3 2027-consortium.', ev: 'EV-09-PHY' }
      ],
      fundsTitle: 'Besteding van middelen (illustratieve scenario’s)',
      fundsNote: 'Illustratieve planningsbedragen uit docs/investor/FINANCIAL_SCENARIOS.md — GEEN toegezegd kapitaal of toegekende subsidie.',
      milestonesTitle: 'Mijlpalen en meetbare succescriteria',
      risksTitle: 'Risico’s en concrete mitigaties',
      teamTitle: 'Team & governance-transparantie',
      teamLead: 'Geen opgeblazen profielen of fictieve adviesraden. Openstaande rollen staan expliciet als «Nog te valideren».',
      partnerTitle: 'Wat we van een partner nodig hebben',
      partnerAsks: [
        '2–3 ondertekende intentieverklaringen (gemeente, veiligheidsregio, vrijwilligerskorps of vlootbeheerder).',
        'Consortiumcoördinator voor Horizon Europe Cluster 3 (2027 DRS-01 / DRS-02) via RVO (NL) of CDTI (ES).',
        'Gecontroleerde veldproef (20 vrijwilligers, 2 uur, uitgeschakelde dekking) om Issue #5 te sluiten.',
        'Medeoprichter of adviseurs met praktijkervaring bij meldkamer/112, brandweer of publieke aanbestedingen.'
      ],
      docsTitle: 'Downloadbaar dossier & perskit',
      formTitle: 'Dossier aanvragen of pilot voorstellen',
      formLead: 'Geen trackingcookies. Verzenden bereidt uw bericht lokaal voor (deze statische site slaat geen persoonsgegevens op een server op).',
      fName: 'Volledige naam',
      fOrg: 'Organisatie / Fonds',
      fEmail: 'Zakelijk e-mailadres',
      fMsg: 'Bericht (pilot, consortium of technische due diligence)',
      fConsent: 'Ik geef toestemming om deze gegevens uitsluitend te gebruiken voor mijn SENDA-aanvraag conform de AVG.',
      fSubmit: 'Dossieraanvraag voorbereiden',
      fDone: 'Aanvraag lokaal voorbereid. Open uw e-mailclient via de knop hieronder.',
      fOpenMail: 'Open in e-mailclient'
    }
  }[locale];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (honeypot.trim() !== '') return; // Anti-spam honeypot
    if (!name.trim() || !email.trim() || !consent) return;
    setSubmitted(true);
  };

  const mailtoHref = `mailto:security@civic-relay.example.com?subject=${encodeURIComponent(
    `[SENDA Dossier] ${org || name}`
  )}&body=${encodeURIComponent(
    `Name: ${name}\nOrganization: ${org}\nEmail: ${email}\n\n${message}`
  )}`;

  return (
    <PageShell locale={locale} active="investors">
      {/* Executive Summary */}
      <section className="s-section-tight">
        <div className="s-container s-stack-lg">
          <div className="s-read">
            <p className="s-eyebrow">{copy.eyebrow}</p>
            <h1 className="s-h1">{copy.title}</h1>
            <p className="s-lead">{copy.lead}</p>
          </div>

          <div className="s-grid s-grid-3">
            {copy.execCards.map((item) => (
              <div key={item.k} className="s-card s-stack">
                <div className="s-between">
                  <strong style={{ fontSize: 14, color: 'var(--s-accent)' }}>{item.k}</strong>
                  <EvidenceBadge locale={locale} evidenceId={item.ev} compact />
                </div>
                <p>{item.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use of Funds */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <div className="s-between">
            <div className="s-read">
              <h2 className="s-h2">{copy.fundsTitle}</h2>
              <p className="s-small s-muted" style={{ marginTop: 10 }}>
                {copy.fundsNote}
              </p>
            </div>
            <EvidenceBadge locale={locale} evidenceId="EV-09-PHY" />
          </div>

          <div className="s-chipbar" role="group" aria-label="Funding scenarios">
            {FUNDING_ENVELOPES.map((env) => (
              <button
                key={env.id}
                type="button"
                className="s-chip"
                aria-pressed={selectedEnv === env.id}
                onClick={() => setSelectedEnv(env.id)}
              >
                <span>{env.id}: {env.amount}</span>
              </button>
            ))}
          </div>

          <div className="s-card s-stack-lg">
            <div className="s-between">
              <div>
                <h3 className="s-h3">{envelope.name[locale]}</h3>
                <p className="s-small s-muted" style={{ marginTop: 4 }}>
                  {envelope.source[locale]}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="s-kpi-value s-num" style={{ fontSize: 34 }}>{envelope.amount}</div>
                <div className="s-micro s-faint">{envelope.horizon[locale]} · {envelope.trlTarget}</div>
              </div>
            </div>

            <div className="s-bars">
              {envelope.breakdown.map((row) => (
                <div key={row.label.en} className="s-bar-row">
                  <span>{row.label[locale]}</span>
                  <div className="s-bar-track" aria-hidden="true">
                    <div className="s-bar-fill" style={{ width: `${row.pct}%` }} />
                  </div>
                  <b className="s-num">{row.pct}% ({row.amount})</b>
                </div>
              ))}
            </div>

            <p className="s-small s-muted" style={{ margin: 0, paddingTop: 12, borderTop: '1px solid var(--s-line)' }}>
              <strong style={{ color: 'var(--s-text)' }}>
                {locale === 'es' ? 'Entregable principal: ' : locale === 'nl' ? 'Kernoplevering: ' : 'Core deliverable: '}
              </strong>
              {envelope.deliverable[locale]}
            </p>
          </div>
        </div>
      </section>

      {/* Milestones & Risks */}
      <section className="s-section">
        <div className="s-container s-grid s-grid-2" style={{ gap: 40 }}>
          <div className="s-stack-lg">
            <h2 className="s-h2">{copy.milestonesTitle}</h2>
            <ol className="s-milestones">
              {INVESTOR_MILESTONES.map((ms) => (
                <li key={ms.id}>
                  <div className="s-between">
                    <time>{ms.id} · {ms.window[locale]}</time>
                    <EvidenceBadge locale={locale} evidenceId={ms.evidenceId} statusOverride={ms.status} compact />
                  </div>
                  <h3>{ms.title[locale]}</h3>
                  <p>{ms.criteria[locale]}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="s-stack-lg">
            <h2 className="s-h2">{copy.risksTitle}</h2>
            <div className="s-stack">
              {INVESTOR_RISKS.map((r) => (
                <article key={r.category.en} className="s-card s-stack" style={{ padding: 20 }}>
                  <div className="s-between">
                    <strong style={{ fontSize: 15 }}>{r.category[locale]}</strong>
                    <EvidenceBadge locale={locale} evidenceId={r.evidenceId} statusOverride={r.status} compact />
                  </div>
                  <p className="s-small">{r.risk[locale]}</p>
                  <p className="s-small" style={{ color: 'var(--s-text)' }}>
                    <strong>{locale === 'es' ? 'Mitigación: ' : locale === 'nl' ? 'Mitigatie: ' : 'Mitigation: '}</strong>
                    {r.mitigation[locale]}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team & Partner Asks */}
      <section className="s-section s-sunk">
        <div className="s-container s-grid s-grid-2">
          <div className="s-card s-stack">
            <div className="s-row">
              <Users size={20} style={{ color: 'var(--s-accent)' }} aria-hidden="true" />
              <h2 className="s-h3">{copy.teamTitle}</h2>
            </div>
            <p className="s-small s-muted">{copy.teamLead}</p>
            <dl className="s-dl">
              <dt>{locale === 'es' ? 'Fundador' : locale === 'nl' ? 'Oprichter' : 'Founder'}</dt>
              <dd>
                {locale === 'es'
                  ? 'Abraham Haddioui — Ingeniero de producto y arquitecto del protocolo (flujo asistido por IA declarado).'
                  : locale === 'nl'
                  ? 'Abraham Haddioui — Productingenieur en protocolarchitect (AI-ondersteunde workflow verklaard).'
                  : 'Abraham Haddioui — Product engineer & protocol architect (AI-assisted workflow disclosed).'}
              </dd>
              <dt>{locale === 'es' ? 'Sociedad' : locale === 'nl' ? 'Rechtspersoon' : 'Legal entity'}</dt>
              <dd>
                <span className="s-pill">{locale === 'es' ? 'Por validar' : locale === 'nl' ? 'Nog te valideren' : 'To be validated'}</span>{' '}
                {locale === 'es'
                  ? '(Necesaria para ENISA, EIC y Horizon)'
                  : locale === 'nl'
                  ? '(Vereist voor EIC, RVO en Horizon)'
                  : '(Required before ENISA / EIC / Horizon submission)'}
              </dd>
              <dt>{locale === 'es' ? 'Cofundador / Asesores' : locale === 'nl' ? 'Medeoprichter / Adviseurs' : 'Co-founder / Advisors'}</dt>
              <dd>
                <span className="s-pill">{locale === 'es' ? 'Por validar' : locale === 'nl' ? 'Nog te valideren' : 'To be validated'}</span>{' '}
                {locale === 'es'
                  ? '(Buscamos perfiles de 112, incendios o compra pública)'
                  : locale === 'nl'
                  ? '(Op zoek naar 112-, brandweer- en aanbestedingsadviseurs)'
                  : '(Seeking 112 / fire command / B2G advisors)'}
              </dd>
              <dt>{locale === 'es' ? 'PI y licencia' : locale === 'nl' ? 'IE & licentie' : 'IP & License'}</dt>
              <dd>
                {locale === 'es'
                  ? 'MIT Open Source (LICENSE); cesión formal de PI pendiente de constitución societaria.'
                  : locale === 'nl'
                  ? 'MIT Open Source (LICENSE); formele IE-overdracht wacht op oprichting rechtspersoon.'
                  : 'MIT Open Source (LICENSE); formal IP assignment pending incorporation.'}
              </dd>
            </dl>
          </div>

          <div className="s-card s-stack">
            <div className="s-row">
              <Handshake size={20} style={{ color: 'var(--s-accent)' }} aria-hidden="true" />
              <h2 className="s-h3">{copy.partnerTitle}</h2>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--s-text-2)', fontSize: 15 }}>
              {copy.partnerAsks.map((ask) => (
                <li key={ask}>{ask}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Downloads & Press Kit */}
      <section id="press" className="s-section">
        <div className="s-container s-stack-lg">
          <div className="s-between">
            <h2 className="s-h2">{copy.docsTitle}</h2>
            <span className="s-pill">
              <Film size={13} aria-hidden="true" />
              <span>Press &amp; Data Room</span>
            </span>
          </div>

          <div className="s-grid s-grid-3">
            {[
              { title: 'One-Page Pitch', desc: 'docs/investor/ONE_PAGE_PITCH.md', href: `${REPO_URL}/blob/master/docs/investor/ONE_PAGE_PITCH.md` },
              { title: 'Funding Preparation (2026-11-05)', desc: 'docs/financiacion/RONDA_FINANCIACION_2026-11-05.md', href: `${REPO_URL}/blob/master/docs/financiacion/RONDA_FINANCIACION_2026-11-05.md` },
              { title: 'Master Vision (Download)', desc: '/vision-master.md', href: '/vision-master.md' },
              { title: 'SENDA-3D Scientific Paper', desc: '/senda/paper.html (v0.20)', href: '/senda/paper.html' },
              { title: 'CTO Engineering Status', desc: 'docs/audits/LATEST_ENGINEERING_STATUS.md', href: `${REPO_URL}/blob/master/docs/audits/LATEST_ENGINEERING_STATUS.md` },
              { title: 'Technical Due Diligence', desc: 'docs/investor/TECHNICAL_DUE_DILIGENCE.md', href: `${REPO_URL}/blob/master/docs/investor/TECHNICAL_DUE_DILIGENCE.md` }
            ].map((doc) => (
              <a
                key={doc.title}
                href={doc.href}
                target={doc.href.startsWith('http') ? '_blank' : undefined}
                rel={doc.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="s-card s-card-lift"
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div className="s-between">
                  <strong style={{ fontSize: 15 }}>{doc.title}</strong>
                  {doc.href.startsWith('http') ? <ExternalLink size={15} aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
                </div>
                <code className="s-mono s-faint">{doc.desc}</code>
              </a>
            ))}
          </div>

          <MediaVideo
            locale={locale}
            src="/media/m95/senda-m95-90s-en.mp4"
            vttSrc={`/media/m95/senda-m95-90s-${locale}.vtt`}
            poster="/media/m95/senda-m95-broadcast-special-poster.jpg"
            caption={
              locale === 'es'
                ? 'Pieza de prensa / inversores (90 s) con subtítulos ES/EN/NL'
                : locale === 'nl'
                ? 'Pers- en investeerdersvideo (90 s) met ondertiteling'
                : 'Press & investor briefing clip (90 s) with multilingual captions'
            }
            evidenceId="EV-S01-ROUTE"
          />
        </div>
      </section>

      {/* Minimal GDPR Contact Form */}
      <section id="dossier" className="s-section s-sunk">
        <div className="s-container">
          <div className="s-card s-read" style={{ margin: '0 auto' }}>
            <h2 className="s-h2" style={{ fontSize: 'clamp(26px, 3vw, 36px)' }}>{copy.formTitle}</h2>
            <p className="s-small s-muted" style={{ margin: '10px 0 24px' }}>{copy.formLead}</p>

            {submitted ? (
              <div className="s-stack" role="status" aria-live="polite">
                <div className="s-notice">
                  <CheckCircle2 aria-hidden="true" style={{ color: 'var(--s-ok)' }} />
                  <div>
                    <strong>{copy.fDone}</strong>
                  </div>
                </div>
                <div className="s-row">
                  <a href={mailtoHref} className="s-btn s-btn-primary">
                    <Send size={15} aria-hidden="true" />
                    <span>{copy.fOpenMail}</span>
                  </a>
                  <button
                    type="button"
                    className="s-btn s-btn-secondary"
                    onClick={() => setSubmitted(false)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="s-stack">
                {/* Anti-spam honeypot hidden from humans */}
                <div className="s-sr" aria-hidden="true">
                  <label>
                    Website
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </label>
                </div>

                <div className="s-grid s-grid-2">
                  <label className="s-field">
                    <span>{copy.fName} *</span>
                    <input
                      type="text"
                      required
                      className="s-input"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="s-field">
                    <span>{copy.fOrg}</span>
                    <input
                      type="text"
                      className="s-input"
                      autoComplete="organization"
                      value={org}
                      onChange={(e) => setOrg(e.target.value)}
                    />
                  </label>
                </div>

                <label className="s-field">
                  <span>{copy.fEmail} *</span>
                  <input
                    type="email"
                    required
                    className="s-input"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>

                <label className="s-field">
                  <span>{copy.fMsg}</span>
                  <textarea
                    className="s-input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>

                <label className="s-check">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>{copy.fConsent}</span>
                </label>

                <div>
                  <button type="submit" className="s-btn s-btn-primary">
                    <Send size={15} aria-hidden="true" />
                    <span>{copy.fSubmit}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

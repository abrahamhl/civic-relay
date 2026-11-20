'use client';

import { useState, type FormEvent } from 'react';
import { Download, ExternalLink, Send, CheckCircle2, Users, Handshake, Film, Cpu } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import MediaVideo from '../components/MediaVideo';
import ActionMissionDock from '../components/ActionMissionDock';
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
      title: 'Deep-tech resilience built for measurable European scale.',
      lead: 'Executive overview in one view: verifiable software architecture, open scientific foundation, milestone-driven funding tracks, full bilingual films, and institutional partnership pathways.',
      execCards: [
        { k: 'Problem', v: 'Single-network outages isolate families, fleets, and civil responders during floods, wildfires, and blackouts.', ev: 'EV-S01-ROUTE' },
        { k: 'Solution', v: 'Deterministic multi-channel emergency routing (BLE, Wi-Fi Direct, neighbor sat, SMS, LoRa, acoustic) + 16,699-source situational correlation.', ev: 'EV-CORE-506' },
        { k: 'Target Markets', v: 'B2G (municipalities, regions, civil protection via CPI & Horizon Europe) and B2B (fleets, highway concessionaires, insurers).', ev: 'EV-CONSOLE-16K' },
        { k: 'Verified Assets', v: '506/506 core tests, 49/49 offline Chromium E2E, compiled Android Nearby APK, ESP32 firmware, 5 scientific papers, and 40+ live web modules.', ev: 'EV-OFFLINE-49' },
        { k: 'Funding Tracks', v: 'Structured milestone envelopes (€50k / €180k / €400k) across ESA BIC, ENISA/NEOTEC, RVO MIT/WBSO, EIC Accelerator, and Horizon CL3 2027.', ev: 'EV-ARR-V2' },
        { k: 'Engineering Leverage', v: 'One of the largest human-supervised vibe-coding & AI-orchestration projects—combining AI speed with strict founder architectural direction.', ev: 'EV-CORE-506' }
      ],
      fundsTitle: 'Resource allocation by funding track',
      fundsNote: 'Planning envelopes aligned with docs/investor/FINANCIAL_SCENARIOS.md and docs/financiacion/RONDA_FINANCIACION_2026-11-05.md.',
      milestonesTitle: 'Roadmap & measurable delivery gates',
      risksTitle: 'Execution priorities & mitigations',
      teamTitle: 'Leadership & AI-orchestrated engineering',
      teamLead: 'Direct founder execution amplified by multi-agent AI delegation under constant human architectural control.',
      partnerTitle: 'Strategic partner opportunities',
      partnerAsks: [
        'Institutional pilot partners (municipal civil protection, volunteer corps, highway concessionaires, or commercial fleets).',
        'Consortium coordinators for Horizon Europe Cluster 3 (2027 DRS-01 / DRS-02 window) via CDTI (ES) or RVO (NL).',
        'Controlled 20-volunteer field exercise hosts to benchmark multi-device delivery latency and battery performance.',
        'Senior domain advisors or co-founders with 112 command, forestry firefighting, or European public-procurement experience.'
      ],
      docsTitle: 'Downloadable dossier, films & press kit',
      formTitle: 'Request investor dossier or propose a pilot',
      formLead: 'Zero tracking cookies. Prepares a structured inquiry directly in your mail client without server-side tracking.',
      fName: 'Full name',
      fOrg: 'Organization / Fund',
      fEmail: 'Work email',
      fMsg: 'Message (pilot, consortium, or diligence focus)',
      fConsent: 'I consent to use this message solely to respond to my SENDA dossier/pilot inquiry under GDPR.',
      fSubmit: 'Prepare dossier request',
      fDone: 'Request prepared locally. Use the button below to open your email client.',
      fOpenMail: 'Open in email client'
    },
    es: {
      eyebrow: 'INVERSORES Y SOCIOS EUROPEOS',
      title: 'Tecnología profunda de resiliencia diseñada para escalar en Europa.',
      lead: 'Resumen ejecutivo en una pantalla: arquitectura verificada en software, base científica abierta, tramos de financiación por hitos, películas bilingües y vías de alianza institucional.',
      execCards: [
        { k: 'Problema', v: 'La caída de una sola red móvil incomunica a familias, flotas y equipos durante riadas, incendios o apagones.', ev: 'EV-S01-ROUTE' },
        { k: 'Solución', v: 'Enrutamiento multicanal determinista (BLE, Wi-Fi Direct, satélite vecino, SMS, LoRa, sonido) + correlación de 16.699 fuentes.', ev: 'EV-CORE-506' },
        { k: 'Mercados objetivo', v: 'B2G (ayuntamientos, CCAA y protección civil vía CPI y Horizon Europe) y B2B (flotas, concesionarias de autopistas y aseguradoras).', ev: 'EV-CONSOLE-16K' },
        { k: 'Activos verificados', v: '506/506 tests de núcleo, 49/49 E2E offline en Chromium, APK Android Nearby, firmware ESP32, 5 papers y más de 40 módulos web operativos.', ev: 'EV-OFFLINE-49' },
        { k: 'Tramos de financiación', v: 'Planes por hitos (50 k€ / 180 k€ / 400 k€) alineados con ESA BIC, ENISA/NEOTEC, RVO MIT/WBSO, EIC Accelerator y Horizon CL3 2027.', ev: 'EV-ARR-V2' },
        { k: 'Velocidad de ingeniería', v: 'Uno de los mayores proyectos de delegación y orquestación en vibe coding: apoyo constante en IA bajo dirección y supervisión humana continua.', ev: 'EV-CORE-506' }
      ],
      fundsTitle: 'Uso de fondos por tramo de ejecución',
      fundsNote: 'Escenarios de planificación alineados con docs/investor/FINANCIAL_SCENARIOS.md y docs/financiacion/RONDA_FINANCIACION_2026-11-05.md.',
      milestonesTitle: 'Hoja de ruta e hitos medibles',
      risksTitle: 'Prioridades de ejecución y mitigaciones',
      teamTitle: 'Dirección e ingeniería orquestada con IA',
      teamLead: 'Ejecución directa del fundador multiplicada mediante delegación multi-agente bajo control arquitectónico y supervisión humana permanente.',
      partnerTitle: 'Oportunidades de colaboración estratégica',
      partnerAsks: [
        'Socios para pilotos de campo (Protección Civil municipal, agrupaciones de voluntarios, concesionarias viales o flotas).',
        'Coordinadores de consorcio para Horizon Europe Cluster 3 (ventana 2027 DRS-01 / DRS-02) vía CDTI o RVO.',
        'Entornos controlados de simulacro (20 voluntarios, 2 horas) para medir telemetría multi-dispositivo en campo.',
        'Cofundador o asesores sénior con experiencia en centros 112, incendios forestales o Compra Pública de Innovación (CPI).'
      ],
      docsTitle: 'Descargas del dossier, vídeos y kit de prensa',
      formTitle: 'Solicitar dossier o proponer un piloto',
      formLead: 'Sin cookies de seguimiento. Prepara tu consulta estructurada directamente en tu cliente de correo.',
      fName: 'Nombre completo',
      fOrg: 'Organización / Fondo',
      fEmail: 'Correo profesional',
      fMsg: 'Mensaje (piloto técnico, consorcio europeo o diligencia)',
      fConsent: 'Consiento el uso de estos datos únicamente para responder a mi solicitud sobre SENDA conforme al RGPD.',
      fSubmit: 'Preparar solicitud de dossier',
      fDone: 'Solicitud preparada localmente. Abre tu cliente de correo para enviarla.',
      fOpenMail: 'Abrir en cliente de correo'
    },
    nl: {
      eyebrow: 'INVESTEERDERS & EUROPESE PARTNERS',
      title: 'Deep-tech weerbaarheid gebouwd voor Europese schaal.',
      lead: 'Managementsamenvatting in één oogopslag: geverifieerde softwarearchitectuur, open wetenschappelijke basis, mijlpaalgestuurde financiering, volledige films en partnerschappen.',
      execCards: [
        { k: 'Probleem', v: 'Uitval van één mobiel netwerk isoleert burgers, vloten en hulpverleners bij overstromingen, branden en stroomuitval.', ev: 'EV-S01-ROUTE' },
        { k: 'Oplossing', v: 'Deterministische multikanaal-noodroutering (BLE, Wi-Fi Direct, satelliet, sms, LoRa, geluid) + 16.699-bronnencorrelatie.', ev: 'EV-CORE-506' },
        { k: 'Doelmarkten', v: 'B2G (gemeenten, veiligheidsregio’s via innovatie-inkoop & Horizon Europe) en B2B (vloten, wegbeheerders, verzekeraars).', ev: 'EV-CONSOLE-16K' },
        { k: 'Geverifieerde activa', v: '506/506 kerntests, 49/49 offline Chromium E2E, Android Nearby-APK, ESP32-firmware, 5 papers en 40+ interactieve webmodules.', ev: 'EV-OFFLINE-49' },
        { k: 'Financieringstrajecten', v: 'Mijlpaalbudgetten (€50k / €180k / €400k) voor ESA BIC, RVO MIT/WBSO, EIC Accelerator en Horizon CL3 2027.', ev: 'EV-ARR-V2' },
        { k: 'Engineering-slagkracht', v: 'Een van de grootste praktijkprojecten in vibe coding en AI-orkestratie onder constante menselijke regie en supervisie.', ev: 'EV-CORE-506' }
      ],
      fundsTitle: 'Besteding van middelen per traject',
      fundsNote: 'Planningsscenario’s afgestemd op docs/investor/FINANCIAL_SCENARIOS.md en docs/financiacion/RONDA_FINANCIACION_2026-11-05.md.',
      milestonesTitle: 'Roadmap & meetbare mijlpalen',
      risksTitle: 'Uitvoeringsprioriteiten & mitigaties',
      teamTitle: 'Leiderschap & AI-georkestreerde engineering',
      teamLead: 'Directe uitvoering door de oprichter versterkt met multi-agent AI-delegatie onder constante menselijke controle.',
      partnerTitle: 'Strategische samenwerkingskansen',
      partnerAsks: [
        'Institutionele pilotpartners (veiligheidsregio’s, gemeenten, vrijwilligerskorpsen, wegbeheerders of vloten).',
        'Consortiumcoördinatoren voor Horizon Europe Cluster 3 (2027 DRS-01 / DRS-02) via RVO (NL) of CDTI (ES).',
        'Locaties voor een gecontroleerde veldoefening met 20 vrijwilligers om fysieke telemetrie te meten.',
        'Medeoprichter of adviseurs met ervaring bij 112-meldkamers, brandweer of publieke aanbestedingen.'
      ],
      docsTitle: 'Downloadbaar dossier, films & perskit',
      formTitle: 'Dossier aanvragen of pilot voorstellen',
      formLead: 'Geen trackingcookies. Bereidt uw aanvraag direct lokaal voor in uw e-mailclient.',
      fName: 'Volledige naam',
      fOrg: 'Organisatie / Fonds',
      fEmail: 'Zakelijk e-mailadres',
      fMsg: 'Bericht (pilot, consortium of due diligence)',
      fConsent: 'Ik geef toestemming om deze gegevens uitsluitend te gebruiken voor mijn SENDA-aanvraag conform de AVG.',
      fSubmit: 'Dossieraanvraag voorbereiden',
      fDone: 'Aanvraag lokaal voorbereid. Open uw e-mailclient via de knop hieronder.',
      fOpenMail: 'Open in e-mailclient'
    }
  }[locale];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (honeypot.trim() !== '') return;
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
            <EvidenceBadge locale={locale} evidenceId="EV-CORE-506" />
          </div>

          <div className="s-chipbar" role="group" aria-label="Funding tracks">
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
                    <strong>{locale === 'es' ? 'Estrategia: ' : locale === 'nl' ? 'Aanpak: ' : 'Strategy: '}</strong>
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
                  ? 'Abraham Haddioui — Ingeniero de producto, director de arquitectura y orquestación multi-agente.'
                  : locale === 'nl'
                  ? 'Abraham Haddioui — Productingenieur, architectuurregisseur en multi-agent orkestratie.'
                  : 'Abraham Haddioui — Product engineer, systems architect, and multi-agent orchestration lead.'}
              </dd>
              <dt>{locale === 'es' ? 'Metodología' : locale === 'nl' ? 'Methodiek' : 'Methodology'}</dt>
              <dd>
                <span className="s-row" style={{ gap: 6 }}>
                  <Cpu size={14} style={{ color: 'var(--s-accent)' }} aria-hidden="true" />
                  <span>
                    {locale === 'es'
                      ? 'Vibe coding y delegación con IA bajo supervisión humana constante y verificación automática.'
                      : locale === 'nl'
                      ? 'Vibe coding en AI-delegatie onder constante menselijke supervisie en geautomatiseerde verificatie.'
                      : 'Human-led vibe coding and AI delegation under constant supervision and automated verification.'}
                  </span>
                </span>
              </dd>
              <dt>{locale === 'es' ? 'Licencia' : locale === 'nl' ? 'Licentie' : 'License'}</dt>
              <dd>MIT Open Source (<code className="s-mono">LICENSE</code>)</dd>
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

      {/* Downloads & Full Press Kit Films */}
      <section id="press" className="s-section">
        <div className="s-container s-stack-lg">
          <div className="s-between">
            <h2 className="s-h2">{copy.docsTitle}</h2>
            <span className="s-pill">
              <Film size={13} aria-hidden="true" />
              <span>Data Room &amp; Press Kit</span>
            </span>
          </div>

          <div className="s-grid s-grid-3">
            {[
              { title: 'One-Page Pitch', desc: 'docs/investor/ONE_PAGE_PITCH.md', href: `${REPO_URL}/blob/master/docs/investor/ONE_PAGE_PITCH.md` },
              { title: 'Funding Roadmap (2026-11-05)', desc: 'docs/financiacion/RONDA_FINANCIACION_2026-11-05.md', href: `${REPO_URL}/blob/master/docs/financiacion/RONDA_FINANCIACION_2026-11-05.md` },
              { title: 'Master Vision (Download)', desc: '/vision-master.md', href: '/vision-master.md' },
              { title: 'SENDA-3D Scientific Paper', desc: '/senda/paper.html (v0.20)', href: '/senda/paper.html' },
              { title: 'All 5 Scientific Papers', desc: '/senda/papers/index.html', href: '/senda/papers/index.html' },
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

          <div className="s-grid s-grid-2">
            <MediaVideo
              locale={locale}
              src="/media/m96/senda-m96-promo-es.mp4"
              sources={{
                es: '/media/m96/senda-m96-promo-es.mp4',
                en: '/media/m96/senda-m96-promo-en.mp4'
              }}
              poster="/media/m96/senda-m96-promo-poster.jpg"
              subtitles={{
                es: '/media/m96/senda-m96-promo-es.vtt',
                en: '/media/m96/senda-m96-promo-en.vtt',
                nl: '/media/m96/senda-m96-promo-nl.vtt'
              }}
              title={
                locale === 'es'
                  ? 'Película Maestra SENDA (M96) · ES / EN con subtítulos ES/EN/NL'
                  : locale === 'nl'
                  ? 'SENDA Masterfilm (M96) · ES / EN met ES/EN/NL ondertitels'
                  : 'SENDA Master Film (M96) · ES / EN with ES/EN/NL subtitles'
              }
              caption={
                locale === 'es'
                  ? 'Selección automática por idioma del navegador + subtítulos trilingües.'
                  : locale === 'nl'
                  ? 'Automatische taalselectie + drietalige ondertiteling.'
                  : 'Browser-matched audio + trilingual WebVTT subtitles.'
              }
              evidenceId="EV-CONSOLE-16K"
            />
            <MediaVideo
              locale={locale}
              src="/media/senda-demo/SENDA-plataforma-promo.mp4"
              poster="/media/senda-capacidades-poster-es.jpg"
              title={
                locale === 'es'
                  ? 'Recorrido de plataforma · Consola y capacidades reales'
                  : locale === 'nl'
                  ? 'Platformoverzicht · Console en live functies'
                  : 'Platform walkthrough · Live console & capabilities'
              }
              caption={
                locale === 'es'
                  ? 'Captura directa de la plataforma operativa de SENDA.'
                  : locale === 'nl'
                  ? 'Directe opname van het operationele SENDA-platform.'
                  : 'Direct screen recording of the live SENDA platform.'
              }
              evidenceId="EV-OFFLINE-49"
            />
          </div>
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
                    {locale === 'es' ? 'Editar' : locale === 'nl' ? 'Bewerken' : 'Edit'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="s-stack">
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

      <ActionMissionDock locale={locale} compact />
    </PageShell>
  );
}

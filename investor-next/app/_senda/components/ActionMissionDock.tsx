'use client';

import {
  ArrowRight,
  Building2,
  Code2,
  Compass,
  ExternalLink,
  Radio,
  ShieldCheck,
  TrendingUp,
  Users
} from 'lucide-react';
import { localeHref, REPO_URL, type Locale, type LocalizedText } from '../data/types';

interface MissionPath {
  id: string;
  role: LocalizedText;
  title: LocalizedText;
  whatYouGet: LocalizedText;
  whyItMatters: LocalizedText;
  ctaLabel: LocalizedText;
  href: string;
  external?: boolean;
  secondaryHref?: string;
  secondaryLabel?: LocalizedText;
  accent: string;
  icon: typeof Users;
}

export default function ActionMissionDock({
  locale,
  compact = false
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const paths: MissionPath[] = [
    {
      id: 'citizen',
      role: { es: 'FAMILIAS Y CUALQUIER PERSONA', en: 'FAMILIES & EVERYDAY CITIZENS', nl: 'GEZINNEN & BURGERS' },
      title: {
        es: 'Prueba en 30 segundos cómo tu móvil pide ayuda en modo avión',
        en: 'Test in 30 seconds how your phone sends help in airplane mode',
        nl: 'Test in 30 seconden hoe uw telefoon hulp vraagt in vliegtuigmodus'
      },
      whatYouGet: {
        es: 'Al abrir SENDA Campo puedes activar el modo fácil de 3 botones ("Estoy bien", "Necesito ayuda", "Peligro"), enviar un sobre cifrado offline y probar el módem acústico por sonido.',
        en: 'Opening SENDA Field gives you the 3-button easy mode ("I am safe", "Need help", "Hazard"), offline E2EE queueing, and the audible MFSK-16 sound modem.',
        nl: 'In SENDA Veld probeert u direct de 3-knoppen noodmodus, offline E2EE-wachtrij en akoestische MFSK-16 modem.'
      },
      whyItMatters: {
        es: 'Sin cuenta, sin rastreo y complementario al 112 oficial cuando no queda una sola raya de cobertura.',
        en: 'No account, zero tracking, complementing official 112 whenever zero cellular bars remain.',
        nl: 'Geen account, geen tracking, aanvullend op officieel 112 wanneer elk bereik wegvalt.'
      },
      ctaLabel: { es: 'Probar SENDA Campo ahora', en: 'Launch SENDA Field now', nl: 'Start SENDA Veld nu' },
      href: '/senda/',
      secondaryHref: '/senda/mensaje.html',
      secondaryLabel: { es: 'Modo fácil (3 botones)', en: '3-button easy mode', nl: '3-knoppen modus' },
      accent: '#38bdf8',
      icon: Users
    },
    {
      id: 'operator',
      role: { es: 'CENTROS 112, MUNICIPIOS Y FLOTAS', en: '112 CENTERS, CITIES & FLEETS', nl: '112-MELDKAMERS & GEMEENTEN' },
      title: {
        es: 'Recorre la consola OSINT de 16.699 fuentes y el centro de mando',
        en: 'Walk through the 16,699-source OSINT console & command desk',
        nl: 'Verken de 16.699-bronnen OSINT-console & meldkamer'
      },
      whatYouGet: {
        es: 'Tour guiado interactivo de 6 pasos con mapa de correlación, cámaras DGT/NDW con conos FOV, acciones simuladas en 2 pasos con registro de auditoría y centro operativo completo.',
        en: 'Interactive 6-step guided tour with correlation map, DGT/NDW FOV cameras, two-step audited simulated actions, and full live operations center.',
        nl: 'Interactieve rondleiding in 6 stappen met correlatiekaart, FOV-camera’s en auditeerbare beslissingen.'
      },
      whyItMatters: {
        es: 'Aporta conciencia situacional verificada con k-anonimato (k >= 5) y sin lectura de matrículas ni biometría.',
        en: 'Delivers verified situational clarity with k-anonymity (k >= 5), zero license-plate logging, and zero biometrics.',
        nl: 'Biedt geverifieerd situatiebeeld met k-anonimiteit (k >= 5) zonder biometrie.'
      },
      ctaLabel: { es: 'Abrir Centro de Control (Tour 6 pasos)', en: 'Open Control Center (6-step tour)', nl: 'Open Controlecentrum (6 stappen)' },
      href: localeHref(locale, 'platform'),
      secondaryHref: '/senda/centro.html',
      secondaryLabel: { es: 'Consola 112 completa', en: 'Full 112 console', nl: 'Volledige 112-console' },
      accent: '#ff6b4a',
      icon: Building2
    },
    {
      id: 'investor',
      role: { es: 'INVERSORES Y CONSORCIOS EUROPEOS', en: 'INVESTORS & EUROPEAN PARTNERS', nl: 'INVESTEERDERS & EU-PARTNERS' },
      title: {
        es: 'Audita métricas verificadas, tramos 50 k€–400 k€ y hoja de ruta',
        en: 'Review verified benchmarks, €50k–€400k tracks & Horizon roadmap',
        nl: 'Bekijk geverifieerde benchmarks, €50k–€400k trajecten & roadmap'
      },
      whatYouGet: {
        es: 'Resumen ejecutivo con tabla de evidencias trazables a SHA, escenarios ESA BIC / ENISA / RVO / Horizon CL3 2027, películas completas bilingües y formulario sin rastreo para proponer piloto.',
        en: 'Executive deck with SHA-traced evidence ledger, ESA BIC / ENISA / RVO / Horizon CL3 2027 funding scenarios, full bilingual films, and zero-tracking pilot intake.',
        nl: 'Managementsamenvatting met SHA-bewijsregister, financieringstrajecten, films en pilot-aanvraag.'
      },
      whyItMatters: {
        es: 'Uno de los mayores proyectos de orquestación en vibe coding bajo dirección humana constante: máxima velocidad de entrega con rigor auditable.',
        en: 'One of the largest human-supervised vibe-coding engineering stacks—combining AI speed with strict founder governance.',
        nl: 'Een van de grootste menselijk bestuurde vibe-coding projecten met volledige traceerbaarheid.'
      },
      ctaLabel: { es: 'Ir a Inversores y Pilotos', en: 'Go to Investors & Pilots', nl: 'Naar Investeerders & Pilots' },
      href: localeHref(locale, 'investors'),
      secondaryHref: localeHref(locale, 'evidence'),
      secondaryLabel: { es: 'Registro de Evidencias', en: 'Evidence Ledger', nl: 'Bewijsregister' },
      accent: '#34d399',
      icon: TrendingUp
    },
    {
      id: 'engineer',
      role: { es: 'INGENIEROS, CIENTÍFICOS Y AUDITORES', en: 'ENGINEERS, SCIENTISTS & AUDITORS', nl: 'INGENIEURS & ONDERZOEKERS' },
      title: {
        es: 'Inspecciona los 5 papers científicos, 506 pruebas y el código MIT',
        en: 'Inspect all 5 scientific papers, 506 core tests & MIT source code',
        nl: 'Inspecteer de 5 papers, 506 kerntests en MIT-broncode'
      },
      whatYouGet: {
        es: 'Acceso directo a las derivaciones matemáticas (ITU-R P.838, ITU-R P.2040, Contact Graph Routing, Merkle RFC 6962), 7 renders SVG, visor 4D y repositorio GitHub público.',
        en: 'Direct access to analytical derivations (ITU-R P.838, ITU-R P.2040, CGR, Merkle RFC 6962), 7 vector SVG renders, 4D viewer, and open GitHub repository.',
        nl: 'Directe toegang tot wiskundige modellen, 7 SVG-renders, 4D-viewer en open GitHub-code.'
      },
      whyItMatters: {
        es: 'Cada afirmación del proyecto enlaza al archivo exacto, prueba reproducible y conjunto de datos abierto.',
        en: 'Every engineering claim links to the exact source file, deterministic test suite, and open dataset.',
        nl: 'Elke bewering verwijst direct naar code, deterministische tests en open datasets.'
      },
      ctaLabel: { es: 'Explorar Ciencia y Papers', en: 'Explore Science & Papers', nl: 'Ontdek Wetenschap & Papers' },
      href: localeHref(locale, 'science'),
      secondaryHref: REPO_URL,
      secondaryLabel: { es: 'Código abierto GitHub', en: 'Open GitHub Repo', nl: 'Open GitHub Repo' },
      external: true,
      accent: '#a78bfa',
      icon: Code2
    }
  ];

  const ui = {
    es: {
      eyebrow: 'SIGUIENTE PASO CLARO · ELIGE QUÉ QUIERES VER Y PROBAR EN SENDA',
      title: '¿Por dónde quieres entrar? Te explicamos exactamente qué verás al hacer clic.',
      lead: 'Nada de botones genéricos sin contexto: elige tu perfil para abrir la experiencia exacta que responde a lo que buscas en menos de un minuto.',
      whatLabel: 'QUÉ VERÁS AL ENTRAR'
    },
    en: {
      eyebrow: 'CLEAR NEXT STEP · CHOOSE YOUR ENTRY POINT INTO SENDA',
      title: 'Where do you want to start? Know exactly what opens before you click.',
      lead: 'No vague marketing buttons: pick your role to jump straight into the live simulator, operational desk, diligence ledger, or open source code.',
      whatLabel: 'WHAT OPENS WHEN YOU CLICK'
    },
    nl: {
      eyebrow: 'DUIDELIJKE VOLGENDE STAP · KIES UW INGANG IN SENDA',
      title: 'Waar wilt u beginnen? Zie exact wat er opent voordat u klikt.',
      lead: 'Geen vage knoppen: kies uw profiel en stap direct in de juiste live simulator, meldkamer, bewijsregister of broncode.',
      whatLabel: 'WAT U DIRECT ZIET'
    }
  }[locale];

  return (
    <section className={compact ? 's-section-tight' : 's-section'} data-testid="action-mission-dock">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">
            <Compass size={15} aria-hidden="true" />
            <span>{ui.eyebrow}</span>
          </p>
          <h2 className="s-h2">{ui.title}</h2>
          <p className="s-lead">{ui.lead}</p>
        </div>

        <div className="s-grid s-grid-2" style={{ gap: 18 }}>
          {paths.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.id}
                className="s-mission-card s-scroll-build"
                style={{ borderTopColor: p.accent }}
                data-testid={`mission-cta-${p.id}`}
              >
                <div className="s-between">
                  <span className="s-pill s-mono" style={{ color: p.accent, borderColor: `color-mix(in srgb, ${p.accent} 40%, var(--s-line))` }}>
                    <Icon size={13} aria-hidden="true" />
                    <span>{p.role[locale]}</span>
                  </span>
                  <ShieldCheck size={16} style={{ color: p.accent, opacity: 0.85 }} aria-hidden="true" />
                </div>

                <h3 className="s-h3" style={{ margin: '10px 0 6px' }}>{p.title[locale]}</h3>

                <div className="s-innov-block is-how" style={{ borderLeftColor: p.accent }}>
                  <div className="s-innov-label">
                    <Radio size={12} aria-hidden="true" />
                    <span>{ui.whatLabel}</span>
                  </div>
                  <p>{p.whatYouGet[locale]}</p>
                </div>

                <p className="s-small s-muted" style={{ margin: 0 }}>{p.whyItMatters[locale]}</p>

                <div className="s-row" style={{ marginTop: 'auto', paddingTop: 10, gap: 8 }}>
                  <a href={p.href} className="s-btn s-btn-primary s-btn-sm">
                    <span>{p.ctaLabel[locale]}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </a>
                  {p.secondaryHref && p.secondaryLabel && (
                    <a
                      href={p.secondaryHref}
                      target={p.external ? '_blank' : undefined}
                      rel={p.external ? 'noopener noreferrer' : undefined}
                      className="s-btn s-btn-secondary s-btn-sm"
                    >
                      <span>{p.secondaryLabel[locale]}</span>
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

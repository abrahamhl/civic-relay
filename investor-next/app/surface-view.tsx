import MissionControl from './mission-control';
import SectorIntelligenceConsole from './sector-intelligence-console';
import CoordinationLab from './coordination-lab';
import TelecomAndRfRadarSuite from './telecom-rf-radar-suite';
import LiveHardwareAndDealRoomConsole from './live-hardware-console';
import EvidenceBoard from './evidence-board';
import { HyperFramesCinemaDeck } from './hyperframes-cinema-deck';
import { SystemExplained, DeveloperBlueprint } from './system-explained';
import LanguageDocument from './language-document';
import { labels, locales, type Locale } from './copy';

export default function SurfaceView({
  locale,
  surface
}: {
  locale: Locale;
  surface: 'MISSION_CONTROL' | 'SCIENCE';
}) {
  const homeHref = locale === 'en' ? '/' : `/${locale}/`;
  const mcHref = locale === 'en' ? '/mission-control/' : `/${locale}/mission-control/`;
  const sciHref = locale === 'en' ? '/science/' : `/${locale}/science/`;

  const titles = {
    es: {
      back: '← Volver a Portada (Descubrir)',
      mcNav: 'B · Explorar / Mission Control',
      sciNav: 'C · Investigar / Science & Lab',
      mcTitle: 'SUPERFICIE B · MISSION CONTROL 3D Y SECTOR INTELLIGENCE CCTV',
      mcLead:
        'Demostración interactiva central de Civic Relay / OEP: globo 3D con selección raycast, sectores piloto (El Tiemblo, Valencia, Arnhem), cámaras viales autorizadas o sintéticas con control anti-SSRF y traza causal de decisiones.',
      sciTitle: 'SUPERFICIE C · LABORATORIO CIENTÍFICO, CRIPTOGRAFÍA Y EVIDENCIA',
      sciLead:
        'Entorno técnico reproducible para ingenieros, auditores e instituciones: cola Store-and-Forward determinista, firmas WebCrypto ECDSA P-256 reales, modelos RF/NTN acotados y matriz de verdad científica.'
    },
    en: {
      back: '← Back to Overview (Discover)',
      mcNav: 'B · Explore / Mission Control',
      sciNav: 'C · Investigate / Science & Lab',
      mcTitle: 'SURFACE B · 3D MISSION CONTROL & SECTOR INTELLIGENCE CCTV',
      mcLead:
        'Core interactive demonstration of Civic Relay / OEP: 3D globe with raycast object selection, pilot sectors (El Tiemblo, Valencia, Arnhem), authorized/synthetic camera sources with anti-SSRF guardrails, and causal decision trace.',
      sciTitle: 'SURFACE C · SCIENTIFIC LABORATORY, CRYPTOGRAPHY & EVIDENCE',
      sciLead:
        'Reproducible technical surface for engineers, auditors, and institutions: deterministic Store-and-Forward queue, real WebCrypto ECDSA P-256 signatures, bounded RF/NTN models, and scientific truth matrix.'
    },
    nl: {
      back: '← Terug naar Overzicht (Ontdekken)',
      mcNav: 'B · Verkennen / Mission Control',
      sciNav: 'C · Onderzoeken / Science & Lab',
      mcTitle: 'OPPERVLAK B · 3D MISSION CONTROL & SECTOR INTELLIGENCE CCTV',
      mcLead:
        'Centrale interactieve demonstratie van Civic Relay / OEP: 3D-globe met raycast-selectie, pilotsectoren (El Tiemblo, Valencia, Arnhem), geautoriseerde/synthetische camerabronnen en causale beslissingstracering.',
      sciTitle: 'OPPERVLAK C · WETENSCHAPPELIJK LAB, CRYPTOGRAFIE & BEWIJS',
      sciLead:
        'Reproduceerbare technische omgeving voor ingenieurs en instellingen: deterministische Store-and-Forward wachtrij, echte WebCrypto ECDSA P-256-handtekeningen en wetenschappelijke bewijsmatrix.'
    }
  }[locale];

  return (
    <main id="top" className="site-root" data-testid={`dedicated-surface-${surface.toLowerCase()}`}>
      <LanguageDocument locale={locale} />
      <header className="topbar container">
        <a className="wordmark" href={homeHref} aria-label="Civic Relay · OEP — Offline Emergency Protocol">
          <span className="mark-symbol">
            <span />
            <span />
            <span />
          </span>
          <span className="new-project-name">Civic Relay · OEP — Offline Emergency Protocol</span>
        </a>
        <nav aria-label="Surface navigation" style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
          <a href={homeHref}>{titles.back}</a>
          <a href={mcHref} aria-current={surface === 'MISSION_CONTROL' ? 'page' : undefined}>
            {titles.mcNav}
          </a>
          <a href={sciHref} aria-current={surface === 'SCIENCE' ? 'page' : undefined}>
            {titles.sciNav}
          </a>
        </nav>
        <div className="locale-links" role="group" aria-label="Language">
          {locales.map(l => {
            const target =
              surface === 'MISSION_CONTROL'
                ? l === 'en'
                  ? '/mission-control/'
                  : `/${l}/mission-control/`
                : l === 'en'
                ? '/science/'
                : `/${l}/science/`;
            return (
              <a
                key={l}
                href={target}
                hrefLang={l}
                lang={l}
                aria-label={labels[l]}
                aria-current={locale === l ? 'page' : undefined}
                className={locale === l ? 'active' : ''}
              >
                {l.toUpperCase()}
              </a>
            );
          })}
        </div>
      </header>

      <section className="container" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', marginBottom: '0.5rem' }}>
          {surface === 'MISSION_CONTROL' ? titles.mcTitle : titles.sciTitle}
        </h1>
        <p style={{ color: '#cbd5e1', maxWidth: '80ch', lineHeight: 1.6 }}>
          {surface === 'MISSION_CONTROL' ? titles.mcLead : titles.sciLead}
        </p>
      </section>

      {surface === 'MISSION_CONTROL' ? (
        <>
          <div className="container">
            <MissionControl locale={locale} />
            <HyperFramesCinemaDeck locale={locale} />
          </div>
          <SectorIntelligenceConsole locale={locale} />
          <CoordinationLab locale={locale} />
        </>
      ) : (
        <>
          <SystemExplained locale={locale} />
          <CoordinationLab locale={locale} />
          <TelecomAndRfRadarSuite locale={locale} />
          <LiveHardwareAndDealRoomConsole locale={locale} />
          <DeveloperBlueprint locale={locale} />
          <EvidenceBoard locale={locale} />
        </>
      )}
    </main>
  );
}

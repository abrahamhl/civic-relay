import MissionControl from './mission-control';
import SectorIntelligenceConsole from './sector-intelligence-console';
import CoordinationLab from './coordination-lab';
import TelecomAndRfRadarSuite from './telecom-rf-radar-suite';
import ScientificTheoremsLab from './scientific-theorems-lab';
import VehicularDopplerLab from './vehicular-doppler-lab';
import CivilianRadarDefenseLab from './defense-vault/civilian-radar-defense-lab';
import AcousticSentinelSurvivalLab from './defense-vault/acoustic-sentinel-survival-lab';
import DefenseVaultMedia from './defense-vault/defense-vault-media';
import LiveHardwareAndDealRoomConsole from './live-hardware-console';
import EvidenceBoard from './evidence-board';
import CommandSurface from './command-surface';
import RailSafetyLab from './rail-safety-lab';
import CalibrationPanel from './calibration-panel';
import { HyperFramesCinemaDeck } from './hyperframes-cinema-deck';
import { SystemExplained, DeveloperBlueprint } from './system-explained';
import LanguageDocument from './language-document';
import { labels, locales, type Locale } from './copy';

export default function SurfaceView({
  locale,
  surface
}: {
  locale: Locale;
  surface: 'MISSION_CONTROL' | 'SCIENCE' | 'MANDO' | 'DEFENSE';
}) {
  const homeHref = locale === 'en' ? '/' : `/${locale}/`;
  const mcHref = locale === 'en' ? '/mission-control/' : `/${locale}/mission-control/`;
  const sciHref = locale === 'en' ? '/science/' : `/${locale}/science/`;
  const mandoHref = locale === 'en' ? '/mando/' : `/${locale}/mando/`;
  const defenseHref = locale === 'en' ? '/defense/' : `/${locale}/defense/`;

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
        'Entorno técnico reproducible para ingenieros, auditores e instituciones: cinco teoremas de física matemática, cola Store-and-Forward determinista, firmas WebCrypto ECDSA P-256 reales, modelos RF/NTN acotados y matriz de verdad científica.',
      mandoNav: 'D · Mando / Panel Multicanal',
      defNav: 'E · Bóveda de defensa (doble uso)',
      defTitle: 'BÓVEDA DE DEFENSA · DOBLE USO Y CONTRAMEDIDAS UAV',
      defLead:
        'Área separada del producto civil. Reúne los módulos con aplicación militar o de contramedidas frente a drones (radar acústico TDoA, señuelos ASTM F3411, radar pasivo, margen anti-jamming, centinela COTS). Uso sujeto a control de exportación de doble uso (Reglamento (UE) 2021/821) y a la normativa de espectro y aviación no tripulada (Reglamentos (UE) 2019/945 y 2019/947); fuera del alcance de las convocatorias civiles. Simulaciones sin despliegue real.',
      mandoTitle: 'SUPERFICIE D · SENDA MANDO · PANEL MULTICANAL DE ACTIVACIONES',
      mandoLead:
        'Consola determinista para activaciones, taxonomía, seguimiento de superficie, rutas mesh y presupuestos de enlace. Ejercicio sintético: sin radios, cámaras ni dispatch 112 conectados; el conector de producción de la Consola Mando es privado.'
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
        'Reproducible technical surface for engineers, auditors, and institutions: five mathematical physics theorems, deterministic Store-and-Forward queue, real WebCrypto ECDSA P-256 signatures, bounded RF/NTN models, and scientific truth matrix.',
      mandoNav: 'D · Command / Multichannel Panel',
      defNav: 'E · Defence vault (dual use)',
      defTitle: 'DEFENCE VAULT · DUAL USE & COUNTER-UAS',
      defLead:
        'Kept apart from the civil product. Gathers the modules with military or counter-drone application (acoustic TDoA radar, ASTM F3411 decoys, passive radar, anti-jamming margin, COTS sentinel). Use is subject to EU dual-use export control (Regulation (EU) 2021/821) and to spectrum and unmanned-aviation rules (Regulations (EU) 2019/945 and 2019/947); outside the scope of civil funding calls. Simulations only, no real deployment.',
      mandoTitle: 'SURFACE D · SENDA COMMAND · MULTICHANNEL ACTIVATION PANEL',
      mandoLead:
        'Deterministic console for activations, taxonomy, surface tracking, mesh routes and link budgets. Synthetic exercise: no radios, cameras or 112 dispatch connected; the production SENDA Command console connector is private.'
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
        'Reproduceerbare technische omgeving voor ingenieurs en instellingen: vijf stellingen van mathematische fysica, deterministische Store-and-Forward wachtrij, echte WebCrypto ECDSA P-256-handtekeningen en wetenschappelijke bewijsmatrix.',
      mandoNav: 'D · Commando / Multikanaal Paneel',
      defNav: 'E · Defensiekluis (dubbel gebruik)',
      defTitle: 'DEFENSIEKLUIS · DUBBEL GEBRUIK & ANTI-UAS',
      defLead:
        'Gescheiden van het civiele product. Bevat de modules met militaire of anti-drone-toepassing (akoestische TDoA-radar, ASTM F3411-lokdoelen, passieve radar, anti-jammingmarge, COTS-sentinel). Gebruik valt onder EU-exportcontrole voor dubbel gebruik (Verordening (EU) 2021/821) en regels voor spectrum en onbemande luchtvaart (Verordeningen (EU) 2019/945 en 2019/947); buiten de reikwijdte van civiele financieringsoproepen. Alleen simulaties, geen echte inzet.',
      mandoTitle: 'OPPERVLAK D · SENDA COMMANDO · MULTIKANAAL ACTIVATIEPANEEL',
      mandoLead:
        'Deterministische console voor activaties, taxonomie, oppervlaktetracking, mesh-routes en linkbudgetten. Synthetische oefening: geen radio’s, camera’s of 112-dispatch verbonden; de productieconnector van de SENDA Commando-console is privé.'
    }
  }[locale];
  const surfaceTitle =
    surface === 'MISSION_CONTROL' ? titles.mcTitle : surface === 'SCIENCE' ? titles.sciTitle : surface === 'DEFENSE' ? titles.defTitle : titles.mandoTitle;
  const surfaceLead =
    surface === 'MISSION_CONTROL' ? titles.mcLead : surface === 'SCIENCE' ? titles.sciLead : surface === 'DEFENSE' ? titles.defLead : titles.mandoLead;

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
          <a href={mandoHref} aria-current={surface === 'MANDO' ? 'page' : undefined}>
            {titles.mandoNav}
          </a>
          <a href={defenseHref} aria-current={surface === 'DEFENSE' ? 'page' : undefined} data-testid="nav-defense-vault">
            {titles.defNav}
          </a>
        </nav>
        <div className="locale-links" role="group" aria-label="Language">
          {locales.map(l => {
            const prefix = l === 'en' ? '' : `/${l}`;
            const section = surface === 'MISSION_CONTROL' ? 'mission-control' : surface === 'SCIENCE' ? 'science' : surface === 'DEFENSE' ? 'defense' : 'mando';
            const target = `${prefix}/${section}/`;
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
          {surfaceTitle}
        </h1>
        <p style={{ color: '#cbd5e1', maxWidth: '80ch', lineHeight: 1.6 }}>
          {surfaceLead}
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
      ) : surface === 'SCIENCE' ? (
        <>
          <div className="container">
            <ScientificTheoremsLab locale={locale} />
            <CalibrationPanel locale={locale} />
            <VehicularDopplerLab locale={locale} />
            <RailSafetyLab locale={locale} />
          </div>
          <SystemExplained locale={locale} />
          <CoordinationLab locale={locale} />
          <TelecomAndRfRadarSuite locale={locale} />
          <LiveHardwareAndDealRoomConsole locale={locale} />
          <DeveloperBlueprint locale={locale} />
          <EvidenceBoard locale={locale} />
        </>
      ) : surface === 'DEFENSE' ? (
        <div data-testid="defense-vault" data-classification="DUAL_USE_DEFENSE">
          <div className="container">
            <CivilianRadarDefenseLab locale={locale} />
            <AcousticSentinelSurvivalLab locale={locale} />
          </div>
          <DefenseVaultMedia locale={locale} />
        </div>
      ) : (
        <CommandSurface locale={locale} />
      )}
    </main>
  );
}

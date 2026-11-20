import type { Locale } from './types';

export interface HomeCopy {
  eyebrow: string;
  headline: string;
  tagline: string;
  lead: string;
  ctaPrimary: string;
  ctaSecondary: string;
  previewLabel: string;
  previewCaption: string;
  pillarsTitle: string;
  pillarsLead: string;
  pillars: Array<{
    title: string;
    body: string;
    evidenceId: string;
  }>;
  metricsTitle: string;
  metricsLead: string;
  metrics: Array<{
    value: string;
    label: string;
    evidenceId: string;
  }>;
  flagshipFilmTitle: string;
  flagshipFilmLead: string;
  servicesTitle: string;
  servicesLead: string;
  vibeCoding: {
    eyebrow: string;
    title: string;
    lead: string;
    pillars: Array<{ title: string; body: string }>;
  };
  audiencesTitle: string;
  audiences: Array<{
    role: string;
    desc: string;
    hrefSlug: string;
    cta: string;
  }>;
}

export const HOME_COPY: Record<Locale, HomeCopy> = {
  en: {
    eyebrow: 'ALTERNATIVE-CHANNEL EMERGENCY ROUTING',
    headline: 'When the network goes down, the message still finds a way out.',
    tagline: 'If a path to your people exists, SENDA finds it.',
    lead: 'SENDA combines nearby devices, satellite links, SMS, gateways, acoustic fallback, and open environmental intelligence into one deterministic routing and operational correlation platform.',
    ctaPrimary: 'Open Control Center',
    ctaSecondary: 'Explore capabilities',
    previewLabel: 'SENDA Control Center · Operational intelligence workspace',
    previewCaption: 'Correlates 16,699 dated public elements (GDACS, DGT, NDW, USGS, GOES, Copernicus) with Contact Graph Routing and pre-authorized relay controls.',
    pillarsTitle: 'Three engines working as one resilient system.',
    pillarsLead: 'Every layer is engineered to keep families, responders, and infrastructure coordinated when conventional connectivity degrades.',
    pillars: [
      {
        title: 'Multi-channel emergency routing',
        body: 'Store-and-forward with Contact Graph Routing races Bluetooth, Wi-Fi Direct, neighbor satellite links, SMS, LoRa, gateways, and MFSK-16 audio — with E2EE envelopes, deduplication, and signed receipts.',
        evidenceId: 'EV-S01-ROUTE'
      },
      {
        title: 'Multi-source operational correlation',
        body: 'Fuses 16,699 dated public feeds (GDACS, DGT, NDW, USGS, GOES-16, TfL, Caltrans, Copernicus) into anchored situations with cross-source dependency filtering.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        title: 'Pre-authorized relay & institutional coordination',
        body: 'Activates pre-authorized relay zones under official alerts or corroborated seismic events, supporting isolated agency channels, building digital twins, and signed coordinator credentials.',
        evidenceId: 'EV-02-SWEEP'
      }
    ],
    metricsTitle: 'Engineered, measured, and reproducible.',
    metricsLead: 'Click any provenance badge to inspect the exact source file, method, date, and build SHA.',
    metrics: [
      { value: '506 / 506', label: 'Core protocol & relay unit tests verified green', evidenceId: 'EV-CORE-506' },
      { value: '49 / 49', label: 'Real Chromium offline E2E assertions with network disabled', evidenceId: 'EV-OFFLINE-49' },
      { value: '16,699', label: 'Dated public hazard & mobility elements fused in the console', evidenceId: 'EV-CONSOLE-16K' },
      { value: '94.2%', label: 'ARR_REPLAN_V2 delivery rate across 120 outage blocks (84% less energy)', evidenceId: 'EV-ARR-V2' }
    ],
    flagshipFilmTitle: 'Watch SENDA in action.',
    flagshipFilmLead: 'Videos automatically match your browser language when available, with one-click Spanish, English, and Dutch subtitles.',
    servicesTitle: 'Complete suite of interactive services & live modules.',
    servicesLead: 'Launch any working SENDA engine directly in your browser — from offline messaging and 3D wildfire physics to flood isolation and 4D visualization.',
    vibeCoding: {
      eyebrow: 'HUMAN-LED AI ORCHESTRATION · VIBE CODING AT SCALE',
      title: 'One of the largest real-world projects in AI delegation and orchestration.',
      lead: 'SENDA demonstrates how a founder can orchestrate multi-agent AI engineering across protocols, physics, mobile labs, computer vision, and operational UI — giving AI bounded creative freedom while never handing over decision-making.',
      pillars: [
        {
          title: 'Constant human direction',
          body: 'Every product goal, domain boundary, safety invariant, and architectural choice is directed and approved by the founder — AI executes and proposes, never decides.'
        },
        {
          title: 'Bounded creative velocity',
          body: 'Multi-agent delegation accelerates modeling, simulation, documentation, and multilingual UI across 40+ interactive modules while staying inside strict engineering contracts.'
        },
        {
          title: 'Reproducible verification',
          body: 'Every AI-assisted contribution passes deterministic unit tests (506+ core + 117 web), real Chromium offline E2E runs, and open-source provenance tracking.'
        }
      ]
    },
    audiencesTitle: 'Start where you need to go.',
    audiences: [
      { role: 'Investors & Funds', desc: 'Executive thesis, milestone roadmap, funding envelopes, full films, and downloadable dossier.', hrefSlug: 'investors', cta: 'View investor dossier' },
      { role: 'Public Institutions', desc: 'Agency coordination, pre-authorized relay governance, privacy by design, and compliance roadmap.', hrefSlug: 'security', cta: 'Security & governance' },
      { role: 'Scientists & Engineers', desc: 'Five working papers, 3D/4D viewers, architectural renders, and reproducible benchmarks.', hrefSlug: 'science', cta: 'Explore science' },
      { role: 'Operations & Press', desc: 'Full-screen Control Center with 8 guided scenarios, ⌘K commands, and multilingual films.', hrefSlug: 'platform', cta: 'Launch Control Center' }
    ]
  },
  es: {
    eyebrow: 'ENRUTAMIENTO DE EMERGENCIA POR CANALES ALTERNATIVOS',
    headline: 'Cuando la red cae, el mensaje sigue encontrando un camino.',
    tagline: 'Si existe un camino hasta tu gente, SENDA lo encuentra.',
    lead: 'SENDA combina móviles cercanos, enlaces satelitales, SMS, pasarelas, respaldo acústico e inteligencia ambiental abierta en una única plataforma determinista de enrutamiento y correlación operativa.',
    ctaPrimary: 'Ver el centro de control',
    ctaSecondary: 'Explorar capacidades',
    previewLabel: 'Centro de control SENDA · Plataforma de inteligencia operativa',
    previewCaption: 'Correlaciona 16.699 elementos públicos fechados (GDACS, DGT, NDW, USGS, GOES, Copernicus) con enrutamiento por grafo de contactos y controles de modo relé preautorizado.',
    pillarsTitle: 'Tres motores integrados en un sistema resiliente.',
    pillarsLead: 'Cada capa está diseñada para mantener coordinadas a familias, equipos de respuesta e infraestructuras cuando falla la conectividad convencional.',
    pillars: [
      {
        title: 'Enrutamiento multicanal de emergencia',
        body: 'Almacenar-y-reenviar con Contact Graph Routing compite en paralelo por Bluetooth, Wi-Fi Direct, satélite vecino, SMS, LoRa, pasarelas y sonido MFSK-16 — con cifrado E2E, deduplicación y recibo firmado.',
        evidenceId: 'EV-S01-ROUTE'
      },
      {
        title: 'Correlación operativa multifuente',
        body: 'Fusiona 16.699 elementos públicos fechados (GDACS, DGT, NDW, USGS, GOES-16, TfL, Caltrans y Copernicus) en situaciones trazables controlando dependencias entre fuentes.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        title: 'Modo relé preautorizado y coordinación',
        body: 'Activa zonas de relé preautorizado ante alertas oficiales o sismos corroborados, habilitando canales aislados por organismo, gemelos digitales 3D de edificios y credenciales firmadas.',
        evidenceId: 'EV-02-SWEEP'
      }
    ],
    metricsTitle: 'Ingeniería construida, medida y reproducible.',
    metricsLead: 'Pulsa cualquier etiqueta de procedencia para abrir su archivo fuente, método, fecha y SHA del build.',
    metrics: [
      { value: '506 / 506', label: 'Pruebas deterministas del núcleo y relé verificadas en verde', evidenceId: 'EV-CORE-506' },
      { value: '49 / 49', label: 'Comprobaciones E2E sin red en Chromium real con conectividad cortada', evidenceId: 'EV-OFFLINE-49' },
      { value: '16.699', label: 'Elementos públicos reales de riesgo y movilidad fusionados en consola', evidenceId: 'EV-CONSOLE-16K' },
      { value: '94,2 %', label: 'Entrega de ARR_REPLAN_V2 en 120 bloques de apagón (84 % menos energía)', evidenceId: 'EV-ARR-V2' }
    ],
    flagshipFilmTitle: 'SENDA en vídeo, en tu idioma.',
    flagshipFilmLead: 'El reproductor detecta automáticamente el idioma de tu navegador y permite activar subtítulos en español, inglés y neerlandés en un clic.',
    servicesTitle: 'Ecosistema completo de servicios, motores y módulos interactivos.',
    servicesLead: 'Accede directamente desde el navegador a todas las capacidades de SENDA: mensajería sin red, incendios 3D, aislamiento por riada, visión de tráfico y Visor 4D.',
    vibeCoding: {
      eyebrow: 'DELEGACIÓN Y ORQUESTACIÓN CON IA · VIBE CODING A ESCALA',
      title: 'Uno de los mayores proyectos de delegación y orquestación en vibe coding.',
      lead: 'SENDA demuestra hasta dónde llega la ingeniería dirigida por humanos apoyándose en múltiples agentes de IA: marcando siempre la dirección y otorgando libertad creativa acotada, sin dejar jamás que la IA tome decisiones, bajo supervisión constante del fundador.',
      pillars: [
        {
          title: 'Dirección humana constante',
          body: 'Cada objetivo de producto, límite de seguridad, arquitectura y decisión estratégica nace y se valida bajo supervisión continua del fundador; la IA propone y ejecuta, nunca decide.'
        },
        {
          title: 'Libertad creativa acotada',
          body: 'La delegación orquestada acelera protocolos, física 3D, laboratorios móviles, visión artificial y más de 40 pantallas interactivas dentro de contratos estrictos de ingeniería.'
        },
        {
          title: 'Verificación reproducible',
          body: 'Todo módulo generado pasa baterías automáticas (506+ pruebas de núcleo y 117 en web), ensayos sin red en Chromium real y trazabilidad pública por commit.'
        }
      ]
    },
    audiencesTitle: 'Acceso directo según tu perfil.',
    audiences: [
      { role: 'Inversores y fondos', desc: 'Resumen ejecutivo, hoja de hitos, escenarios de financiación, películas completas y dossier descargable.', hrefSlug: 'investors', cta: 'Ver dossier de inversión' },
      { role: 'Instituciones públicas', desc: 'Coordinación interagencia, modo relé preautorizado, privacidad por diseño y marco normativo.', hrefSlug: 'security', cta: 'Seguridad y gobernanza' },
      { role: 'Comunidad científica e ingeniería', desc: 'Cinco papers científicos, Visor 4D, renders vectoriales de arquitectura y benchmarks reproducibles.', hrefSlug: 'science', cta: 'Explorar ciencia' },
      { role: 'Operaciones y prensa', desc: 'Centro de Control a pantalla completa con 8 escenarios guiados, barra ⌘K y vídeos multilingües.', hrefSlug: 'platform', cta: 'Abrir centro de control' }
    ]
  },
  nl: {
    eyebrow: 'NOODROUTERING VIA ALTERNATIEVE KANALEN',
    headline: 'Als het netwerk uitvalt, vindt het bericht toch een uitweg.',
    tagline: 'Als er een route naar uw dierbaren bestaat, vindt SENDA die.',
    lead: 'SENDA combineert nabije telefoons, satellietverbindingen, sms, gateways, akoestische overdracht en open risicobronnen in één deterministisch routerings- en correlatieplatform.',
    ctaPrimary: 'Open controlecentrum',
    ctaSecondary: 'Ontdek functies',
    previewLabel: 'SENDA Controlecentrum · Operationele intelligentie',
    previewCaption: 'Correleert 16.699 gedateerde openbare elementen (GDACS, DGT, NDW, USGS, GOES, Copernicus) met Contact Graph Routing en vooraf geautoriseerde relay-regels.',
    pillarsTitle: 'Drie motoren verenigd in één weerbaar systeem.',
    pillarsLead: 'Elke laag houdt families, hulpverleners en infrastructuur gecoördineerd wanneer reguliere netwerken uitvallen.',
    pillars: [
      {
        title: 'Multikanaal-noodroutering',
        body: 'Store-and-forward met Contact Graph Routing benut parallel Bluetooth, Wi-Fi Direct, buursatelliet, sms, LoRa, gateways en MFSK-16 geluid — met E2EE, ontdubbeling en ondertekende ACK.',
        evidenceId: 'EV-S01-ROUTE'
      },
      {
        title: 'Multibron-situatiecorrelatie',
        body: 'Fuseert 16.699 gedateerde openbare databronnen (GDACS, DGT, NDW, USGS, GOES-16, TfL, Caltrans en Copernicus) met automatische brondubbelingscontrole.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        title: 'Vooraf geautoriseerde relay & coördinatie',
        body: 'Activeert vooraf geautoriseerde relayzones bij officiële alarmen of bevestigde bevingen, met gescheiden organisatiekanalen, 3D-gebouwtwins en ondertekende certificaten.',
        evidenceId: 'EV-02-SWEEP'
      }
    ],
    metricsTitle: 'Gebouwd, gemeten en reproduceerbaar.',
    metricsLead: 'Klik op een herkomstlabel om bronbestand, methode, datum en build-SHA te bekijken.',
    metrics: [
      { value: '506 / 506', label: 'Deterministische kernprotocol- en relaytests geslaagd', evidenceId: 'EV-CORE-506' },
      { value: '49 / 49', label: 'Offline Chromium E2E-controles zonder netwerkverbinding geslaagd', evidenceId: 'EV-OFFLINE-49' },
      { value: '16.699', label: 'Gedateerde openbare risico- en mobiliteitsitems gefuseerd in de console', evidenceId: 'EV-CONSOLE-16K' },
      { value: '94,2%', label: 'ARR_REPLAN_V2-bezorging over 120 uitvalblokken (84% minder energie)', evidenceId: 'EV-ARR-V2' }
    ],
    flagshipFilmTitle: 'SENDA in beeld, in uw taal.',
    flagshipFilmLead: 'De speler herkent automatisch uw browsertaal en biedt met één klik Spaanse, Engelse en Nederlandse ondertiteling.',
    servicesTitle: 'Volledige suite van interactieve diensten en modules.',
    servicesLead: 'Open elke werkende SENDA-module direct in uw browser — van offline berichten en 3D-brandfysica tot watergolfanalyse en 4D-visualisatie.',
    vibeCoding: {
      eyebrow: 'MENSELIJKE AI-ORKESTRATIE · VIBE CODING OP SCHAAL',
      title: 'Een van de grootste praktijkprojecten in AI-delegatie en vibe coding.',
      lead: 'SENDA laat zien hoe één oprichter multi-agent AI-engineering orkestreert over protocollen, fysica, mobiele labs en operationele UI — met begrensde creatieve ruimte voor AI, maar zonder ooit de besluitvorming uit handen te geven.',
      pillars: [
        {
          title: 'Constante menselijke regie',
          body: 'Elke productrichting, veiligheidsgrens en architectuurbeslissing blijft onder constante supervisie van de oprichter; AI versnelt en stelt voor, maar beslist nooit.'
        },
        {
          title: 'Afgebakende creatieve vrijheid',
          body: 'Georkestreerde delegatie versnelt modellering, simulatie, documentatie en 40+ interactieve schermen binnen strikte engineeringcontracten.'
        },
        {
          title: 'Reproduceerbare verificatie',
          body: 'Elke bijdrage doorloopt geautomatiseerde tests (506+ kerntests en 117 webtests), offline Chromium E2E-runs en volledige commit-traceerbaarheid.'
        }
      ]
    },
    audiencesTitle: 'Direct naar uw perspectief.',
    audiences: [
      { role: 'Investeerders & fondsen', desc: 'Samenvatting, mijlpalenroadmap, financieringsscenario’s, volledige films en downloadbaar dossier.', hrefSlug: 'investors', cta: 'Bekijk investeerdersdossier' },
      { role: 'Publieke instellingen', desc: 'Inter-agency coördinatie, vooraf geautoriseerde relay-governance, privacy by design en compliance.', hrefSlug: 'security', cta: 'Beveiliging & governance' },
      { role: 'Wetenschappers & ingenieurs', desc: 'Vijf wetenschappelijke papers, 3D/4D-viewers, vectorrenders en reproduceerbare benchmarks.', hrefSlug: 'science', cta: 'Ontdek wetenschap' },
      { role: 'Operaties & pers', desc: 'Volledig controlecentrum met 8 begeleide scenario’s, ⌘K-commando’s en meertalige video’s.', hrefSlug: 'platform', cta: 'Open controlecentrum' }
    ]
  }
};

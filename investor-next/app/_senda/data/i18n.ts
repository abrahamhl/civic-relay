import type { Locale, NavSection } from './types';

export interface NavItem {
  id: Exclude<NavSection, 'home' | 'design'>;
  slug: string;
  label: string;
}

export interface SiteStrings {
  brandTag: string;
  tagline: string;
  skipToContent: string;
  nav: NavItem[];
  ctaDossier: string;
  ctaPlatform: string;
  ctaProduct: string;
  ctaEvidence: string;
  themeToDark: string;
  themeToLight: string;
  menuOpen: string;
  menuClose: string;
  langLabel: string;
  heroPill: string;
  evidenceDialog: {
    source: string;
    date: string;
    method: string;
    commit: string;
    scope: string;
    openRegister: string;
    openSource: string;
    close: string;
    clickHint: string;
  };
  cookie: {
    title: string;
    body: string;
    acceptEssential: string;
    analyticsOff: string;
  };
  footer: {
    summary: string;
    colProduct: string;
    colEvidence: string;
    colDocs: string;
    colLegal: string;
    links: {
      visionMaster: string;
      evidenceRegister: string;
      engStatus: string;
      fundingDoc: string;
      fuegoPaper: string;
      pressKit: string;
      designSystem: string;
      legacyMando: string;
      securityPolicy: string;
      securityTxt: string;
      sourceCode: string;
      contact: string;
    };
    aiNotice: string;
    buildLabel: string;
    legalNotice: string;
  };
}

export const SITE_STRINGS: Record<Locale, SiteStrings> = {
  en: {
    brandTag: 'SENDA',
    tagline: 'If a path to your people exists, SENDA finds it.',
    skipToContent: 'Skip to main content',
    nav: [
      { id: 'product', slug: 'product', label: 'Product' },
      { id: 'platform', slug: 'platform', label: 'Platform' },
      { id: 'evidence', slug: 'evidence', label: 'Evidence' },
      { id: 'science', slug: 'science', label: 'Science' },
      { id: 'investors', slug: 'investors', label: 'Investors' },
      { id: 'security', slug: 'security', label: 'Security' }
    ],
    ctaDossier: 'Request dossier',
    ctaPlatform: 'Open Control Center',
    ctaProduct: 'Explore capabilities',
    ctaEvidence: 'Inspect evidence',
    themeToDark: 'Switch to dark appearance',
    themeToLight: 'Switch to light appearance',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    langLabel: 'Language',
    heroPill: 'Open-Source Emergency Routing & Operational Intelligence Platform',
    evidenceDialog: {
      source: 'Source',
      date: 'Date',
      method: 'Method',
      commit: 'Build / SHA',
      scope: 'Scope',
      openRegister: 'Evidence register',
      openSource: 'View source file',
      close: 'Close',
      clickHint: 'Inspect provenance'
    },
    cookie: {
      title: 'Technical storage only',
      body: 'This site stores only your theme and language preferences locally. Analytics and third-party tracking cookies remain disabled.',
      acceptEssential: 'Understood',
      analyticsOff: 'Analytics: Off'
    },
    footer: {
      summary:
        'SENDA (Sistema de Enrutamiento de Emergencia por canales alternativos) unifies offline-first multi-channel messaging, operational situational fusion, and open scientific modeling under the MIT license.',
      colProduct: 'Platform',
      colEvidence: 'Verification',
      colDocs: 'Downloads & Press',
      colLegal: 'Governance',
      links: {
        visionMaster: 'Master Vision (MD)',
        evidenceRegister: 'Evidence Register',
        engStatus: 'Engineering Status',
        fundingDoc: 'Funding Roadmap',
        fuegoPaper: 'SENDA-3D Paper',
        pressKit: 'Films & Press Kit',
        designSystem: 'Design System',
        legacyMando: 'SENDA Command Surface',
        securityPolicy: 'Security & Governance',
        securityTxt: 'SECURITY.txt',
        sourceCode: 'GitHub Repository',
        contact: 'Partner & Investor Contact'
      },
      aiNotice:
        'AI delegation & orchestration: SENDA is one of the largest real-world projects in vibe coding and AI-orchestrated engineering—leveraging AI for speed and bounded creative exploration while keeping every architectural direction, decision, and verification under constant human supervision.',
      buildLabel: 'Build provenance',
      legalNotice: 'MIT License · Secondary emergency communication channel complementing official 112 / EU-Alert services.'
    }
  },
  es: {
    brandTag: 'SENDA',
    tagline: 'Si existe un camino hasta tu gente, SENDA lo encuentra.',
    skipToContent: 'Ir al contenido principal',
    nav: [
      { id: 'product', slug: 'product', label: 'Producto' },
      { id: 'platform', slug: 'platform', label: 'Plataforma' },
      { id: 'evidence', slug: 'evidence', label: 'Evidencia' },
      { id: 'science', slug: 'science', label: 'Ciencia' },
      { id: 'investors', slug: 'investors', label: 'Inversores' },
      { id: 'security', slug: 'security', label: 'Seguridad' }
    ],
    ctaDossier: 'Solicitar dossier',
    ctaPlatform: 'Ver el centro de control',
    ctaProduct: 'Explorar capacidades',
    ctaEvidence: 'Ver evidencia',
    themeToDark: 'Cambiar a modo oscuro',
    themeToLight: 'Cambiar a modo claro',
    menuOpen: 'Abrir menú',
    menuClose: 'Cerrar menú',
    langLabel: 'Idioma',
    heroPill: 'Plataforma Abierta de Enrutamiento de Emergencia e Inteligencia Operativa',
    evidenceDialog: {
      source: 'Fuente',
      date: 'Fecha',
      method: 'Método',
      commit: 'SHA / Commit',
      scope: 'Alcance',
      openRegister: 'Registro de evidencias',
      openSource: 'Abrir fuente',
      close: 'Cerrar',
      clickHint: 'Ver procedencia'
    },
    cookie: {
      title: 'Solo almacenamiento técnico',
      body: 'Esta web guarda únicamente tu preferencia de tema y este aviso. La analítica opcional está desactivada por defecto y no hay cookies de seguimiento.',
      acceptEssential: 'Entendido',
      analyticsOff: 'Analítica: desactivada'
    },
    footer: {
      summary:
        'SENDA (Sistema de Enrutamiento de Emergencia por canales alternativos) reúne mensajería multicanal sin red, fusión operativa de fuentes abiertas y modelado científico reproducible bajo licencia MIT.',
      colProduct: 'Plataforma',
      colEvidence: 'Verificación',
      colDocs: 'Descargas y prensa',
      colLegal: 'Gobernanza',
      links: {
        visionMaster: 'Visión Maestra (MD)',
        evidenceRegister: 'Registro de evidencias',
        engStatus: 'Estado de ingeniería',
        fundingDoc: 'Hoja de financiación',
        fuegoPaper: 'Paper SENDA-3D',
        pressKit: 'Vídeos y kit de prensa',
        designSystem: 'Sistema de diseño',
        legacyMando: 'Panel SENDA Mando',
        securityPolicy: 'Seguridad y gobernanza',
        securityTxt: 'SECURITY.txt',
        sourceCode: 'Repositorio GitHub',
        contact: 'Contacto socios e inversores'
      },
      aiNotice:
        'Delegación y orquestación con IA: SENDA es uno de los mayores proyectos de ingeniería en vibe coding y orquestación asistida por IA, apoyándose en ella con libertad creativa acotada y siempre bajo dirección, criterio y supervisión humana constante.',
      buildLabel: 'Estado del build',
      legalNotice: 'Licencia MIT · Canal secundario complementario a los servicios oficiales 112, ES-Alert y eCall.'
    }
  },
  nl: {
    brandTag: 'SENDA',
    tagline: 'Als er een route naar uw dierbaren bestaat, vindt SENDA die.',
    skipToContent: 'Naar hoofdinhoud',
    nav: [
      { id: 'product', slug: 'product', label: 'Product' },
      { id: 'platform', slug: 'platform', label: 'Platform' },
      { id: 'evidence', slug: 'evidence', label: 'Bewijs' },
      { id: 'science', slug: 'science', label: 'Wetenschap' },
      { id: 'investors', slug: 'investors', label: 'Investeerders' },
      { id: 'security', slug: 'security', label: 'Beveiliging' }
    ],
    ctaDossier: 'Dossier aanvragen',
    ctaPlatform: 'Open controlecentrum',
    ctaProduct: 'Ontdek functies',
    ctaEvidence: 'Bekijk bewijs',
    themeToDark: 'Schakel naar donkere modus',
    themeToLight: 'Schakel naar lichte modus',
    menuOpen: 'Menu openen',
    menuClose: 'Menu sluiten',
    langLabel: 'Taal',
    heroPill: 'Open-Source Noodrouterings- & Operationeel Intelligentieplatform',
    evidenceDialog: {
      source: 'Bron',
      date: 'Datum',
      method: 'Methode',
      commit: 'Build / SHA',
      scope: 'Reikwijdte',
      openRegister: 'Bewijsregister',
      openSource: 'Bekijk bronbestand',
      close: 'Sluiten',
      clickHint: 'Herkomst bekijken'
    },
    cookie: {
      title: 'Alleen technische opslag',
      body: 'Deze website slaat alleen uw thema- en taalvoorkeur lokaal op. Analytics en trackingcookies blijven standaard uitgeschakeld.',
      acceptEssential: 'Begrepen',
      analyticsOff: 'Analytics: uit'
    },
    footer: {
      summary:
        'SENDA verenigt offline-first multikanaal-noodroutering, operationele brondatafusie en open wetenschappelijke modellering onder de MIT-licentie.',
      colProduct: 'Platform',
      colEvidence: 'Verificatie',
      colDocs: 'Downloads & Pers',
      colLegal: 'Governance',
      links: {
        visionMaster: 'Mastervisie (MD)',
        evidenceRegister: 'Bewijsregister',
        engStatus: 'Engineeringstatus',
        fundingDoc: 'Financieringsroadmap',
        fuegoPaper: 'SENDA-3D Paper',
        pressKit: 'Video’s & Perskit',
        designSystem: 'Ontwerpsysteem',
        legacyMando: 'SENDA Commando',
        securityPolicy: 'Beveiliging & Governance',
        securityTxt: 'SECURITY.txt',
        sourceCode: 'GitHub-repository',
        contact: 'Partner- en investeerderscontact'
      },
      aiNotice:
        'AI-delegatie & orkestratie: SENDA is een van de grootste projecten in vibe coding en AI-georkestreerde engineering—met afgebakende creatieve ruimte voor AI, maar altijd onder constante menselijke regie, besluitvorming en supervisie.',
      buildLabel: 'Buildherkomst',
      legalNotice: 'MIT-licentie · Secundair noodkanaal ter aanvulling op officiële 112-, NL-Alert- en eCall-diensten.'
    }
  }
};

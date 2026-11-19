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
  researchPill: string;
  notEmergencyShort: string;
  evidenceDialog: {
    source: string;
    date: string;
    method: string;
    commit: string;
    limits: string;
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
    noEmergency: string;
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
    ctaProduct: 'How it works',
    ctaEvidence: 'Inspect evidence',
    themeToDark: 'Switch to dark appearance',
    themeToLight: 'Switch to light appearance',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    langLabel: 'Language',
    researchPill: 'Open-source research lab (TRL ~3) · Not a live emergency service',
    notEmergencyShort: 'Research laboratory. Do not use in real emergencies.',
    evidenceDialog: {
      source: 'Source',
      date: 'Date',
      method: 'Method',
      commit: 'Build / SHA',
      limits: 'Limits',
      openRegister: 'Evidence register',
      openSource: 'View source file',
      close: 'Close',
      clickHint: 'Inspect provenance'
    },
    cookie: {
      title: 'Technical storage only',
      body: 'This site stores only your theme and consent preferences locally. Third-party analytics and tracking cookies are disabled by default.',
      acceptEssential: 'Understood',
      analyticsOff: 'Analytics: Off'
    },
    footer: {
      summary:
        'SENDA (formerly Civic Relay / OEP) researches alternative-channel emergency message routing and multi-source situational fusion. MIT open-source research lab.',
      colProduct: 'Platform',
      colEvidence: 'Verification',
      colDocs: 'Downloads & Press',
      colLegal: 'Governance',
      links: {
        visionMaster: 'Master Vision (MD)',
        evidenceRegister: 'Evidence Register',
        engStatus: 'Engineering Status',
        fundingDoc: 'Funding Preparation',
        fuegoPaper: 'SENDA-3D Paper',
        pressKit: 'Videos & Press Kit',
        designSystem: 'Design System',
        legacyMando: 'SENDA Command (Lab)',
        securityPolicy: 'Security & Privacy',
        securityTxt: 'SECURITY.txt',
        sourceCode: 'GitHub Repository',
        contact: 'Partner & Investor Contact'
      },
      aiNotice:
        'AI transparency: development, documentation and tests include generative AI assistance under human review and automated verification. Not an automated grant submission (see NLnet v2.0 policy).',
      buildLabel: 'Build provenance',
      noEmergency: 'MIT License · No 112, satellite carrier, or physical radio validation yet · Do not use in real emergencies.'
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
    ctaProduct: 'Cómo funciona',
    ctaEvidence: 'Ver evidencia',
    themeToDark: 'Cambiar a modo oscuro',
    themeToLight: 'Cambiar a modo claro',
    menuOpen: 'Abrir menú',
    menuClose: 'Cerrar menú',
    langLabel: 'Idioma',
    researchPill: 'Laboratorio de investigación abierto (TRL ~3) · No es un servicio de emergencias',
    notEmergencyShort: 'Laboratorio de investigación. No usar en emergencias reales.',
    evidenceDialog: {
      source: 'Fuente',
      date: 'Fecha',
      method: 'Método',
      commit: 'SHA / Commit',
      limits: 'Límites',
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
        'SENDA (antes Civic Relay / OEP) investiga el enrutamiento de mensajes de emergencia por canales alternativos y la fusión de situación con fuentes abiertas. Licencia MIT.',
      colProduct: 'Plataforma',
      colEvidence: 'Verificación',
      colDocs: 'Descargas y prensa',
      colLegal: 'Gobernanza',
      links: {
        visionMaster: 'Visión Maestra (MD)',
        evidenceRegister: 'Registro de evidencias',
        engStatus: 'Estado de ingeniería',
        fundingDoc: 'Preparación de ronda',
        fuegoPaper: 'Paper SENDA-3D',
        pressKit: 'Vídeos y kit de prensa',
        designSystem: 'Sistema de diseño',
        legacyMando: 'SENDA Mando (Lab)',
        securityPolicy: 'Seguridad y privacidad',
        securityTxt: 'SECURITY.txt',
        sourceCode: 'Repositorio GitHub',
        contact: 'Contacto socios e inversores'
      },
      aiNotice:
        'Transparencia de IA: el desarrollo, documentación y pruebas incluyen asistencia de IA generativa revisada por humanos y validada con pruebas automáticas. No constituye una candidatura automatizada (política NLnet v2.0).',
      buildLabel: 'Estado del build',
      noEmergency: 'Licencia MIT · Sin integración 112, satélite operativo ni validación física de radio aún · No usar en emergencias reales.'
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
    ctaProduct: 'Hoe het werkt',
    ctaEvidence: 'Bekijk bewijs',
    themeToDark: 'Schakel naar donkere modus',
    themeToLight: 'Schakel naar lichte modus',
    menuOpen: 'Menu openen',
    menuClose: 'Menu sluiten',
    langLabel: 'Taal',
    researchPill: 'Open-source onderzoekslab (TRL ~3) · Geen operationele hulpdienst',
    notEmergencyShort: 'Onderzoekslaboratorium. Niet gebruiken bij echte noodgevallen.',
    evidenceDialog: {
      source: 'Bron',
      date: 'Datum',
      method: 'Methode',
      commit: 'Build / SHA',
      limits: 'Grenzen',
      openRegister: 'Bewijsregister',
      openSource: 'Bekijk bronbestand',
      close: 'Sluiten',
      clickHint: 'Herkomst bekijken'
    },
    cookie: {
      title: 'Alleen technische opslag',
      body: 'Deze website slaat alleen uw thema- en meldingsvoorkeur lokaal op. Optionele analytics staan standaard uit; geen trackingcookies.',
      acceptEssential: 'Begrepen',
      analyticsOff: 'Analytics: uit'
    },
    footer: {
      summary:
        'SENDA (voorheen Civic Relay / OEP) onderzoekt noodberichtroutering via alternatieve kanalen en multibron-situatiefusie. MIT open-source onderzoekslab.',
      colProduct: 'Platform',
      colEvidence: 'Verificatie',
      colDocs: 'Downloads & Pers',
      colLegal: 'Governance',
      links: {
        visionMaster: 'Mastervisie (MD)',
        evidenceRegister: 'Bewijsregister',
        engStatus: 'Engineeringstatus',
        fundingDoc: 'Financieringsdossier',
        fuegoPaper: 'SENDA-3D Paper',
        pressKit: 'Video’s & Perskit',
        designSystem: 'Ontwerpsysteem',
        legacyMando: 'SENDA Commando (Lab)',
        securityPolicy: 'Beveiliging & Privacy',
        securityTxt: 'SECURITY.txt',
        sourceCode: 'GitHub-repository',
        contact: 'Partner- en investeerderscontact'
      },
      aiNotice:
        'AI-transparantie: ontwikkeling, documentatie en tests maken gebruik van generatieve AI onder menselijke controle en geautomatiseerde verificatie. Geen geautomatiseerde subsidieaanvraag (zie NLnet v2.0-beleid).',
      buildLabel: 'Buildherkomst',
      noEmergency: 'MIT-licentie · Nog geen 112-koppeling, operationele satelliet of fysieke radiovalidatie · Niet voor echte noodgevallen.'
    }
  }
};

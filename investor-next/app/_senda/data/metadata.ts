import type { Metadata } from 'next';
import { localeHref, SITE_URL, type Locale, type NavSection } from './types';

const META_COPY: Record<
  Exclude<NavSection, 'design'>,
  Record<Locale, { title: string; desc: string }>
> = {
  home: {
    en: {
      title: 'SENDA — Alternative-Channel Emergency Routing & Operational Intelligence',
      desc: 'If a path to your people exists, SENDA finds it. Open-source research laboratory for multi-channel emergency routing and situational correlation.'
    },
    es: {
      title: 'SENDA — Enrutamiento de Emergencia por Canales Alternativos',
      desc: 'Si existe un camino hasta tu gente, SENDA lo encuentra. Laboratorio de investigación abierto para comunicaciones de emergencia sin red y correlación operativa.'
    },
    nl: {
      title: 'SENDA — Noodroutering via Alternatieve Kanalen & Operationele Intelligentie',
      desc: 'Als er een route naar uw dierbaren bestaat, vindt SENDA die. Open-source onderzoekslab voor multikanaal-noodroutering en situatiecorrelatie.'
    }
  },
  product: {
    en: {
      title: 'Product — How SENDA Works | SENDA',
      desc: 'Five scenes from cellular blackout to verifiable receipt: MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK and pre-authorized relay governance.'
    },
    es: {
      title: 'Producto — Cómo funciona SENDA | SENDA',
      desc: 'Cinco escenas del apagón al recibo verificable: MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK y modo relé preautorizado.'
    },
    nl: {
      title: 'Product — Hoe SENDA werkt | SENDA',
      desc: 'Vijf scènes van uitval tot ontvangstbewijs: MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK en vooraf geautoriseerde relay.'
    }
  },
  platform: {
    en: {
      title: 'Platform — Interactive Control Center | SENDA',
      desc: 'Full-screen operational intelligence workspace: map layers, priority event queue, correlation graph, timeline scrubber, ⌘K command bar, and 8 guided scenarios.'
    },
    es: {
      title: 'Plataforma — Centro de Control Interactivo | SENDA',
      desc: 'Plataforma operativa interactiva: mapa multicapa, cola de eventos, grafo de correlación, línea de tiempo, barra ⌘K y 8 escenarios guiados.'
    },
    nl: {
      title: 'Platform — Interactief Controlecentrum | SENDA',
      desc: 'Operationeel controlecentrum: kaartlagen, gebeurtenissenwachtrij, correlatiegraaf, tijdlijn, ⌘K-commandobalk en 8 begeleide scenario’s.'
    }
  },
  evidence: {
    en: {
      title: 'Evidence Register & Benchmarks | SENDA',
      desc: 'Filterable claim-to-evidence ledger tying every metric and capability to source code, date, commit SHA, method, and explicit limitations.'
    },
    es: {
      title: 'Evidencia — Registro y Benchmarks | SENDA',
      desc: 'Registro filtrable que enlaza cada cifra y capacidad a su código fuente, fecha, SHA del commit, método y límites.'
    },
    nl: {
      title: 'Bewijsregister & Benchmarks | SENDA',
      desc: 'Filterbaar bewijsregister dat elk cijfer koppelt aan broncode, datum, commit-SHA, methode en expliciete beperkingen.'
    }
  },
  science: {
    en: {
      title: 'Science — Open Research Modules & Papers | SENDA',
      desc: 'Wildfire 3D physics, H-FIRE-B inconclusive evaluation, DTN routing, rail incident fusion, flood isolation, working papers, and 4D viewer.'
    },
    es: {
      title: 'Ciencia — Módulos de Investigación y Papers | SENDA',
      desc: 'Física de incendios 3D, evaluación inconclusa H-FIRE-B, enrutamiento DTN, incidente ferroviario, aislamiento por riada, papers y Visor 4D.'
    },
    nl: {
      title: 'Wetenschap — Onderzoeksmodules & Papers | SENDA',
      desc: 'Natuurbrandfysica 3D, onbesliste H-FIRE-B-evaluatie, DTN-routering, spoorfusie, overstromingsisolatie, papers en 4D-viewer.'
    }
  },
  investors: {
    en: {
      title: 'Investors — Executive Summary, Milestones & Dossier | SENDA',
      desc: 'Milestone-gated research roadmap, illustrative funding envelopes, risk mitigations, team transparency, downloads, and GDPR-safe contact.'
    },
    es: {
      title: 'Inversores — Resumen Ejecutivo, Hitos y Dossier | SENDA',
      desc: 'Hoja de ruta por hitos medibles, escenarios ilustrativos de financiación, riesgos y mitigaciones, descargas y contacto RGPD.'
    },
    nl: {
      title: 'Investeerders — Samenvatting, Mijlpalen & Dossier | SENDA',
      desc: 'Mijlpaalgestuurde roadmap, illustratieve financieringsscenario’s, risicomitigatie, downloads en AVG-vriendelijk contact.'
    }
  },
  security: {
    en: {
      title: 'Security, Privacy & Governance | SENDA',
      desc: 'Threat model, blind E2EE relays, privacy by design, GDPR/ENS honest compliance status, AI transparency (NLnet v2.0), and SECURITY.txt.'
    },
    es: {
      title: 'Seguridad, Privacidad y Gobernanza | SENDA',
      desc: 'Modelo de amenazas, relés ciegos E2E, privacidad por diseño, estado real RGPD/ENS, transparencia de IA (NLnet v2.0) y SECURITY.txt.'
    },
    nl: {
      title: 'Beveiliging, Privacy & Governance | SENDA',
      desc: 'Dreigingsmodel, blinde E2EE-relays, privacy by design, eerlijke AVG/ENS-status, AI-transparantie (NLnet v2.0) en SECURITY.txt.'
    }
  }
};

export function buildPageMetadata(
  locale: Locale,
  section: Exclude<NavSection, 'design'>
): Metadata {
  const entry = META_COPY[section][locale];
  const slug = section === 'home' ? '' : section;
  const canonical = localeHref(locale, slug);
  const ogLocale = locale === 'es' ? 'es_ES' : locale === 'nl' ? 'nl_NL' : 'en_US';

  return {
    metadataBase: new URL(process.env.SITE_URL || SITE_URL),
    title: entry.title,
    description: entry.desc,
    alternates: {
      canonical,
      languages: {
        en: localeHref('en', slug),
        es: localeHref('es', slug),
        nl: localeHref('nl', slug)
      }
    },
    openGraph: {
      title: entry.title,
      description: entry.desc,
      url: canonical,
      siteName: 'SENDA',
      locale: ogLocale,
      type: 'website',
      images: [
        {
          url: '/og-senda.svg',
          width: 1200,
          height: 630,
          alt: entry.title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: entry.title,
      description: entry.desc,
      images: ['/og-senda.svg']
    },
    robots: { index: true, follow: true }
  };
}

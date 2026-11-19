import type { Locale, LocalizedText } from './types';

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
  truthTitle: string;
  truthLead: string;
  provenTitle: string;
  provenItems: Array<{ text: string; evidenceId: string }>;
  pendingTitle: string;
  pendingItems: Array<{ text: string; evidenceId: string }>;
  videoTitle: string;
  videoLead: string;
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
    headline: 'When the network goes down, the message still needs a way out.',
    tagline: 'If a path to your people exists, SENDA finds it.',
    lead: 'SENDA combines nearby devices, satellite links, SMS, gateways, and open hazard feeds into one deterministic routing and situational correlation platform. Today it is an open-source research laboratory — every figure below carries its verification status.',
    ctaPrimary: 'Open Control Center',
    ctaSecondary: 'How it works',
    previewLabel: 'SENDA Control Center · Interactive operational intelligence',
    previewCaption: 'Correlates public hazard snapshots (GDACS, DGT, NDW, USGS, GOES) with simulated alternative-channel routing and pre-authorized relay controls.',
    pillarsTitle: 'Three layers built for degraded reality.',
    pillarsLead: 'No single network survives every outage. SENDA separates routing, correlation, and verifiable evidence.',
    pillars: [
      {
        title: 'Multi-channel routing',
        body: 'Store-and-forward with Contact Graph Routing races Bluetooth, Wi-Fi Direct, neighbor satellite links, SMS, and acoustic fallback — with deduplication and signed receipts.',
        evidenceId: 'EV-S01-ROUTE'
      },
      {
        title: 'Operational correlation',
        body: 'Fuses dated public snapshots (GDACS, DGT, NDW, USGS, Copernicus) into anchored situations while filtering upstream feed duplicates.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        title: 'Pre-authorized relay & governance',
        body: 'Relay mode activates only under a verified authority zone or corroborated seismic event, bounded by user installation consent, battery limits, and OS permissions.',
        evidenceId: 'EV-02-SWEEP'
      }
    ],
    metricsTitle: 'Measured in software. Transparent about the gap.',
    metricsLead: 'Click any status badge to inspect its exact source file, date, method, commit SHA, and limits.',
    metrics: [
      { value: '506 / 506', label: 'Core & relay deterministic unit tests passing', evidenceId: 'EV-CORE-506' },
      { value: '49 / 49', label: 'Real Chromium offline E2E assertions with network cut', evidenceId: 'EV-OFFLINE-49' },
      { value: '94.2%', label: 'ARR_REPLAN_V2 delivery across 120 simulated outage blocks', evidenceId: 'EV-ARR-V2' },
      { value: '0 / 30', label: 'Physical two-handset field trials completed (next P0 gate)', evidenceId: 'EV-09-PHY' }
    ],
    truthTitle: 'What is proven today — and what is not.',
    truthLead: 'Honesty is an engineering invariant. SENDA is a research laboratory (~TRL 3) and must not be used in real emergencies.',
    provenTitle: 'Demonstrated in software & real datasets',
    provenItems: [
      { text: 'Installable offline PWA (/senda/) verified in Chromium with network disabled (IndexedDB + Service Worker).', evidenceId: 'EV-OFFLINE-49' },
      { text: 'E2EE binary envelopes (ECDH P-256 + AES-GCM + ECDSA) with unforgeable receipts purging relay copies.', evidenceId: 'EV-CORE-506' },
      { text: '16,699 dated public elements fused (GDACS, DGT, NDW, GOES, TfL, Caltrans) with dependency auditing.', evidenceId: 'EV-CONSOLE-16K' },
      { text: 'Experimental Android Nearby APK compiles in CI with session-pinned P-256 ACK signer and synthetic-only queue.', evidenceId: 'EV-08-ANDROID' }
    ],
    pendingTitle: 'Pending physical & institutional validation',
    pendingItems: [
      { text: 'Physical Android-to-Android radio delivery, latency, range, and battery measurements (0/30 trials).', evidenceId: 'EV-09-PHY' },
      { text: 'Live 112/PSAP integration, official CAP PKI trust anchors, and licensed direct-to-cell satellite uplink.', evidenceId: 'EV-10-INST' },
      { text: 'Out-of-sample wildfire spread confirmation (H-FIRE-B over n=6 external incidents is currently inconclusive).', evidenceId: 'EV-FIRE-HFIREB' },
      { text: 'Independent security/cryptography audit, formal GDPR DPIA, and ENS compliance (no ENS certification exists).', evidenceId: 'EV-10-INST' }
    ],
    videoTitle: 'Recorded from the real application.',
    videoLead: 'No stock footage. Real captures of the SENDA situation console and offline messaging flow.',
    audiencesTitle: 'Start where you need to go.',
    audiences: [
      { role: 'Investors & Funds', desc: '3-minute thesis, illustrative funding envelopes, milestone gates, risks, and downloadable dossier.', hrefSlug: 'investors', cta: 'View investor dossier' },
      { role: 'Public Institutions', desc: 'Governance boundaries, pre-authorized relay rules, GDPR/ENS status, and threat model.', hrefSlug: 'security', cta: 'Security & governance' },
      { role: 'Technical & Scientific Reviewers', desc: 'Full filterable evidence register, reproducible methods, working papers, and inconclusive results.', hrefSlug: 'evidence', cta: 'Inspect evidence' },
      { role: 'Product & Press', desc: 'Interactive Control Center with 8 guided scenarios, real product captures, and press kit.', hrefSlug: 'platform', cta: 'Launch Control Center' }
    ]
  },
  es: {
    eyebrow: 'ENRUTAMIENTO DE EMERGENCIA POR CANALES ALTERNATIVOS',
    headline: 'Cuando la red cae, el mensaje sigue necesitando un camino.',
    tagline: 'Si existe un camino hasta tu gente, SENDA lo encuentra.',
    lead: 'SENDA combina móviles cercanos, enlaces satelitales, SMS, pasarelas y fuentes abiertas de riesgo en una plataforma determinista de enrutamiento y correlación operativa. Hoy es un laboratorio de investigación abierto: cada cifra lleva su etiqueta verificable de evidencia.',
    ctaPrimary: 'Ver el centro de control',
    ctaSecondary: 'Cómo funciona',
    previewLabel: 'Centro de control SENDA · Inteligencia operativa interactiva',
    previewCaption: 'Correlaciona capturas públicas reales (GDACS, DGT, NDW, USGS, GOES) con rutas alternativas simuladas y controles de modo relé preautorizado.',
    pillarsTitle: 'Tres capas diseñadas para operar sin red.',
    pillarsLead: 'Ninguna red resiste todos los apagones. SENDA separa el enrutamiento, la correlación de situación y la cadena de evidencia.',
    pillars: [
      {
        title: 'Enrutamiento multicanal',
        body: 'Almacenar-y-reenviar con Contact Graph Routing compite en paralelo por Bluetooth, Wi-Fi Direct, satélite vecino, SMS y sonido — con deduplicación y ACK firmado.',
        evidenceId: 'EV-S01-ROUTE'
      },
      {
        title: 'Correlación operativa',
        body: 'Cruza 16.699 elementos públicos fechados (GDACS, DGT, NDW, USGS, Copernicus) en situaciones trazables y evita inflar corroboraciones duplicadas.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        title: 'Modo relé preautorizado y gobernanza',
        body: 'Solo se activa ante zona declarada por una autoridad o sismo corroborado, sujeto a consentimiento al instalar, límites de batería y permisos del sistema operativo.',
        evidenceId: 'EV-02-SWEEP'
      }
    ],
    metricsTitle: 'Medido en software. Transparente en lo que falta.',
    metricsLead: 'Pulsa cualquier etiqueta de estado para abrir su fuente exacta, fecha, método, SHA del commit y límites.',
    metrics: [
      { value: '506 / 506', label: 'Pruebas unitarias deterministas del núcleo y relé en verde', evidenceId: 'EV-CORE-506' },
      { value: '49 / 49', label: 'Comprobaciones E2E sin red en Chromium real con red cortada', evidenceId: 'EV-OFFLINE-49' },
      { value: '94,2 %', label: 'Entrega de ARR_REPLAN_V2 en 120 bloques de apagón simulados', evidenceId: 'EV-ARR-V2' },
      { value: '0 / 30', label: 'Ensayos físicos entre dos móviles realizados (próximo hito P0)', evidenceId: 'EV-09-PHY' }
    ],
    truthTitle: 'Qué está probado hoy y qué todavía no.',
    truthLead: 'La honestidad técnica es un requisito de diseño. SENDA es un laboratorio de investigación (~TRL 3) y no debe usarse en emergencias reales.',
    provenTitle: 'Demostrado en software y datos reales',
    provenItems: [
      { text: 'PWA instalable sin red (/senda/) verificada en Chromium real con la conectividad cortada (IndexedDB + Service Worker).', evidenceId: 'EV-OFFLINE-49' },
      { text: 'Sobres binarios cifrados E2E (ECDH P-256 + AES-GCM + ECDSA) con recibos infalsificables que purgan copias en relés.', evidenceId: 'EV-CORE-506' },
      { text: '16.699 elementos públicos fechados fusionados (GDACS, DGT, NDW, GOES, TfL, Caltrans) con auditoría de dependencias.', evidenceId: 'EV-CONSOLE-16K' },
      { text: 'APK experimental Android Nearby compilada en CI con firmante P-256 por sesión y cola restringida a datos sintéticos.', evidenceId: 'EV-08-ANDROID' }
    ],
    pendingTitle: 'Pendiente de validación física e institucional',
    pendingItems: [
      { text: 'Medición física Android↔Android de entrega, latencia, alcance y consumo de batería (0/30 pruebas realizadas).', evidenceId: 'EV-09-PHY' },
      { text: 'Integración operativa con 112/PSAP, raíces de confianza CAP oficiales y enlace satelital comercial directo al móvil.', evidenceId: 'EV-10-INST' },
      { text: 'Confirmación fuera de muestra en propagación de incendios (H-FIRE-B en 6 incendios reales resulta inconcluso).', evidenceId: 'EV-FIRE-HFIREB' },
      { text: 'Auditoría independiente de seguridad/criptografía, DPIA formal RGPD y conformidad ENS (no existe certificación ENS).', evidenceId: 'EV-10-INST' }
    ],
    videoTitle: 'Grabado directamente de la aplicación real.',
    videoLead: 'Sin vídeo de archivo. Capturas reales de la consola de situación y del envío de mensajes sin conexión.',
    audiencesTitle: 'Acceso directo según tu perfil.',
    audiences: [
      { role: 'Inversores y fondos', desc: 'Resumen ejecutivo en 3 minutos, escenarios ilustrativos de ronda, hitos medibles, riesgos y dossier.', hrefSlug: 'investors', cta: 'Ver dossier de inversión' },
      { role: 'Instituciones públicas', desc: 'Encaje operativo, límites legales, gobernanza del modo relé, privacidad RGPD/ENS y modelo de amenazas.', hrefSlug: 'security', cta: 'Seguridad y gobernanza' },
      { role: 'Revisores técnicos y científicos', desc: 'Registro filtrable de evidencias, reproducibilidad, papers y resultados inconclusos declarados.', hrefSlug: 'evidence', cta: 'Explorar evidencia' },
      { role: 'Producto y prensa', desc: 'Centro de control interactivo con 8 escenarios guiados, capturas reales y kit de prensa.', hrefSlug: 'platform', cta: 'Abrir centro de control' }
    ]
  },
  nl: {
    eyebrow: 'NOODROUTERING VIA ALTERNATIEVE KANALEN',
    headline: 'Als het netwerk uitvalt, moet het bericht toch een uitweg vinden.',
    tagline: 'Als er een route naar uw dierbaren bestaat, vindt SENDA die.',
    lead: 'SENDA combineert nabije telefoons, satellietverbindingen, sms, gateways en open risicobronnen in één deterministisch routerings- en correlatieplatform. Vandaag is het een open-source onderzoekslab: elk cijfer toont zijn verifieerbare bewijsstatus.',
    ctaPrimary: 'Open controlecentrum',
    ctaSecondary: 'Hoe het werkt',
    previewLabel: 'SENDA Controlecentrum · Interactieve operationele intelligentie',
    previewCaption: 'Correleert gedateerde openbare snapshots (GDACS, DGT, NDW, USGS, GOES) met gesimuleerde noodroutes en vooraf geautoriseerde relay-regels.',
    pillarsTitle: 'Drie lagen gebouwd voor netwerkuitval.',
    pillarsLead: 'Geen enkel netwerk overleeft elke ramp. SENDA scheidt routering, situatiecorrelatie en verifieerbaar bewijs.',
    pillars: [
      {
        title: 'Multikanaal-routering',
        body: 'Store-and-forward met Contact Graph Routing combineert Bluetooth, Wi-Fi Direct, satelliet bij buren, sms en akoestische fallback — met deduplicatie en ondertekende ACK’s.',
        evidenceId: 'EV-S01-ROUTE'
      },
      {
        title: 'Operationele correlatie',
        body: 'Fuseert 16.699 gedateerde openbare meldingen (GDACS, DGT, NDW, USGS, Copernicus) en filtert dubbele bronafhankelijkheden.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        title: 'Vooraf geautoriseerde relay & governance',
        body: 'Relay-modus activeert uitsluitend bij een officiële noodzone of bevestigde beving, begrensd door gebruikerstoestemming, acculimieten en OS-rechten.',
        evidenceId: 'EV-02-SWEEP'
      }
    ],
    metricsTitle: 'Gemeten in software. Eerlijk over wat ontbreekt.',
    metricsLead: 'Klik op een statuslabel om bronbestand, datum, methode, commit-SHA en beperkingen te bekijken.',
    metrics: [
      { value: '506 / 506', label: 'Deterministische kern- en relay-unittests geslaagd', evidenceId: 'EV-CORE-506' },
      { value: '49 / 49', label: 'Offline Chromium E2E-controles zonder netwerk geslaagd', evidenceId: 'EV-OFFLINE-49' },
      { value: '94,2%', label: 'ARR_REPLAN_V2-bezorging over 120 gesimuleerde uitvalblokken', evidenceId: 'EV-ARR-V2' },
      { value: '0 / 30', label: 'Fysieke proeven tussen twee toestellen uitgevoerd (volgende P0-poort)', evidenceId: 'EV-09-PHY' }
    ],
    truthTitle: 'Wat vandaag bewezen is — en wat nog niet.',
    truthLead: 'Technische eerlijkheid is een ontwerpregel. SENDA is een onderzoekslab (~TRL 3) en mag niet in echte noodsituaties worden gebruikt.',
    provenTitle: 'Aangetoond in software en echte datasets',
    provenItems: [
      { text: 'Installeerbare offline PWA (/senda/) geverifieerd in echte Chromium zonder netwerk (IndexedDB + Service Worker).', evidenceId: 'EV-OFFLINE-49' },
      { text: 'E2EE-enveloppen (ECDH P-256 + AES-GCM + ECDSA) met onvervalsbaar ontvangstbewijs dat relay-kopieën wist.', evidenceId: 'EV-CORE-506' },
      { text: '16.699 gedateerde openbare bronitems gefuseerd (GDACS, DGT, NDW, GOES, TfL, Caltrans) met afhankelijkheidscontrole.', evidenceId: 'EV-CONSOLE-16K' },
      { text: 'Experimentele Android Nearby-APK compileert in CI met sessiegebonden P-256-ondertekenaar en synthetische wachtrij.', evidenceId: 'EV-08-ANDROID' }
    ],
    pendingTitle: 'Nog te valideren (fysiek & institutioneel)',
    pendingItems: [
      { text: 'Fysieke Android↔Android-meting van bezorging, latentie, bereik en batterijverbruik (0/30 proeven).', evidenceId: 'EV-09-PHY' },
      { text: 'Operationele 112/meldkamer-koppeling, officiële CAP PKI-vertrouwensankers en gelicentieerde satellietverbinding.', evidenceId: 'EV-10-INST' },
      { text: 'Out-of-sample bevestiging van brandvoorspelling (H-FIRE-B over n=6 externe branden is momenteel onbeslist).', evidenceId: 'EV-FIRE-HFIREB' },
      { text: 'Onafhankelijke beveiligingsaudit, formele AVG-DPIA en ENS/ISO-certificering (nog geen certificering).', evidenceId: 'EV-10-INST' }
    ],
    videoTitle: 'Opgenomen uit de echte applicatie.',
    videoLead: 'Geen stockfoto’s. Echte opnames van de situatieconsole en offline berichtverwerking.',
    audiencesTitle: 'Direct naar uw perspectief.',
    audiences: [
      { role: 'Investeerders & fondsen', desc: 'Samenvatting in 3 minuten, illustratieve financieringsscenario’s, mijlpalen, risico’s en dossier.', hrefSlug: 'investors', cta: 'Bekijk investeerdersdossier' },
      { role: 'Publieke instellingen', desc: 'Governancegrenzen, vooraf geautoriseerde relay-regels, AVG/ENS-status en dreigingsmodel.', hrefSlug: 'security', cta: 'Beveiliging & governance' },
      { role: 'Technische & wetenschappelijke reviewers', desc: 'Filterbaar bewijsregister, reproduceerbaarheid, papers en onbesliste resultaten.', hrefSlug: 'evidence', cta: 'Bekijk bewijsregister' },
      { role: 'Product & pers', desc: 'Interactief controlecentrum met 8 begeleide scenario’s, echte opnames en perskit.', hrefSlug: 'platform', cta: 'Open controlecentrum' }
    ]
  }
};

export interface ProductScene {
  num: string;
  eyebrow: LocalizedText;
  title: LocalizedText;
  body: LocalizedText;
  detail: LocalizedText;
  evidenceId: string;
}

export const PRODUCT_SCENES: ProductScene[] = [
  {
    num: '01',
    eyebrow: { en: '01 / THE PROBLEM', es: '01 / EL PROBLEMA', nl: '01 / HET PROBLEEM' },
    title: {
      en: 'When a tower loses power, conventional messaging stops.',
      es: 'Cuando la antena pierde energía, el mensaje no sale.',
      nl: 'Als een zendmast uitvalt, stopt reguliere communicatie.'
    },
    body: {
      en: 'During floods, wildfires, or regional blackouts, official alerts and messaging apps share one single point of failure: the cellular tower. When batteries drain, families cannot confirm safety and responders lose situational awareness.',
      es: 'En inundaciones, incendios o apagones, los avisos oficiales y la mensajería dependen de un mismo punto único de fallo: la antena móvil. Al agotarse sus baterías, las familias quedan incomunicadas y los equipos pierden visibilidad.',
      nl: 'Bij overstromingen, natuurbranden of stroomuitval delen officiële meldingen en chatapps één zwakke schakel: de zendmast. Zodra noodaccu’s leeg raken, verdwijnt het contact met familie en hulpdiensten.'
    },
    detail: {
      en: 'Baseline in Scenario S01 (Arnhem -> San Martín, 8 h outage): WhatsApp delivers only after 480 min when the local tower returns.',
      es: 'Línea base en el escenario S01 (Arnhem -> San Martín, apagón de 8 h): WhatsApp solo entrega a los 480 min cuando vuelve la antena.',
      nl: 'Baseline in scenario S01 (Arnhem -> San Martín, 8 uur uitval): WhatsApp bezorgt pas na 480 min bij herstel van de mast.'
    },
    evidenceId: 'EV-S01-ROUTE'
  },
  {
    num: '02',
    eyebrow: { en: '02 / THE IDEA', es: '02 / LA IDEA', nl: '02 / HET IDEE' },
    title: {
      en: 'Every phone, every surviving channel, one routing fabric.',
      es: 'Cada móvil, cada canal disponible, un camino.',
      nl: 'Elke telefoon, elk overlevend kanaal, één routeringslaag.'
    },
    body: {
      en: 'Instead of waiting for one network to recover, SENDA races every real path available at that moment: nearby phones over Bluetooth or Wi-Fi Direct, a neighbor with satellite Internet or another carrier, SMS, direct-to-cell passes, gateways, or acoustic audio.',
      es: 'En lugar de esperar a que vuelva una sola red, SENDA compite por cualquier camino real disponible en ese instante: vecinos con Bluetooth o Wi-Fi Direct, alguien con Internet satelital u otro operador, SMS, pasos de satélite directo, pasarelas o sonido.',
      nl: 'In plaats van te wachten op één netwerk, benut SENDA elk beschikbaar pad tegelijk: nabije toestellen via Bluetooth of Wi-Fi Direct, een buur met satellietinternet of andere provider, sms, satellietvensters, gateways of geluid.'
    },
    detail: {
      en: 'Simulated in S01: neighbor satellite + BLE hop delivers in ≈4 min; direct-to-cell pass in ≈91 min. Without neighbors or satellite, SENDA invents nothing and matches baseline.',
      es: 'Simulado en S01: vecina con satélite + salto BLE entrega en ≈4 min; satélite directo en ≈91 min. Sin vecinos ni satélite, SENDA no inventa rutas e iguala la base.',
      nl: 'Gesimuleerd in S01: buur met satelliet + BLE-hop bezorgt in ≈4 min; direct-to-cell in ≈91 min. Zonder buren of satelliet verzint SENDA geen pad.'
    },
    evidenceId: 'EV-S01-ROUTE'
  },
  {
    num: '03',
    eyebrow: { en: '03 / HOW IT WORKS', es: '03 / CÓMO FUNCIONA', nl: '03 / HOE HET WERKT' },
    title: {
      en: 'Six deterministic stages from intent to verifiable receipt.',
      es: 'Seis etapas deterministas del envío al recibo verificable.',
      nl: 'Zes deterministische stappen van bericht tot ontvangstbewijs.'
    },
    body: {
      en: 'Every envelope is end-to-end encrypted (ECDH P-256 + AES-GCM + ECDSA) so blind relays only inspect destination hash, priority, and TTL. Duplicate copies collapse into one logical message, and a signed ACK purges intermediate buffers.',
      es: 'Cada sobre se cifra de extremo a extremo (ECDH P-256 + AES-GCM + ECDSA) para que los relés ciegos solo vean cabecera, prioridad y caducidad. Las copias duplicadas se colapsan y un ACK firmado purga las colas intermedias.',
      nl: 'Elke envelop is end-to-end versleuteld (ECDH P-256 + AES-GCM + ECDSA) zodat blinde relays alleen header, prioriteit en TTL zien. Kopieën worden ontdubbeld en een ondertekende ACK wist tussenbuffers.'
    },
    detail: {
      en: 'MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK. Tested across 506/506 core unit tests and 49/49 offline Chromium E2E checks.',
      es: 'MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK. Verificado en 506/506 pruebas del núcleo y 49/49 comprobaciones E2E sin red.',
      nl: 'MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK. Geverifieerd met 506/506 kerntests en 49/49 offline E2E-controles.'
    },
    evidenceId: 'EV-CORE-506'
  },
  {
    num: '04',
    eyebrow: { en: '04 / GOVERNANCE & RELAY MODE', es: '04 / MODO RELÉ PREAUTORIZADO', nl: '04 / VOORAF GEAUTORISEERDE RELAY' },
    title: {
      en: 'Pre-authorized relay with hard consent, authority, and battery boundaries.',
      es: 'Modo relé preautorizado: quién autoriza, cuándo y con qué límites.',
      nl: 'Vooraf geautoriseerde relay met strikte toestemmings-, gezags- en accugrenzen.'
    },
    body: {
      en: 'Relay forwarding never activates silently on arbitrary triggers. It requires a verified official emergency zone (CAP / EU-Alert) or a multi-source corroborated seismic event, plus explicit opt-in consent granted at installation and strict battery/data quotas.',
      es: 'El modo relé nunca se activa de forma opaca. Exige una zona de emergencia declarada por una autoridad (CAP / EU-Alert) o un sismo corroborado por múltiples fuentes, consentimiento explícito al instalar y cuotas estrictas de batería y datos.',
      nl: 'Relay-doorgifte activeert nooit stilletjes. Vereist een officiële noodzone (CAP / NL-Alert) of meervoudig bevestigde beving, expliciete opt-in bij installatie en strikte batterij- en datalimieten.'
    },
    detail: {
      en: 'OS rules respected: Android 13+ and iOS require a user tap to turn on radios that are powered off (PROMPT_USER_ENABLE). Silence always stays UNKNOWN, never inferred as a casualty.',
      es: 'Respeta el SO: Android 13+ e iOS exigen un toque para encender radios apagadas (PROMPT_USER_ENABLE). El silencio siempre queda como UNKNOWN, nunca como víctima.',
      nl: 'OS-regels gerespecteerd: Android 13+ en iOS vereisen gebruikersactie om uitgeschakelde radio’s te starten. Stilte blijft altijd UNKNOWN.'
    },
    evidenceId: 'EV-02-SWEEP'
  },
  {
    num: '05',
    eyebrow: { en: '05 / VERIFIED VS. UNPROVEN', es: '05 / QUÉ ESTÁ PROBADO Y QUÉ NO', nl: '05 / BEWEZEN VS. ONBEWEZEN' },
    title: {
      en: 'Software verified in the lab. Physical radio trials are the next milestone.',
      es: 'Software verificado en laboratorio. La validación física es el siguiente hito.',
      nl: 'Software gevalideerd in het lab. Fysieke radioproeven zijn de volgende mijlpaal.'
    },
    body: {
      en: 'SENDA does not claim operational 112 dispatch, commercial satellite coverage, or field-validated Bluetooth/Wi-Fi Direct phone relays yet. Every capability is mapped to code, tests, and limits in the public Evidence Register.',
      es: 'SENDA no afirma tener conexión operativa con el 112, cobertura satelital comercial ni relés Bluetooth/Wi-Fi Direct validados físicamente entre teléfonos. Cada capacidad se enlaza a su código, pruebas y límites en Evidencia.',
      nl: 'SENDA claimt nog geen live 112-koppeling, commerciële satellietdekking of fysiek gevalideerde Bluetooth/Wi-Fi Direct-relays. Elke eigenschap is gekoppeld aan broncode en grenzen in het bewijsregister.'
    },
    detail: {
      en: 'Next P0 gate: 30 physical two-handset trials (Issue #5) + independent cryptography audit (Issue #4).',
      es: 'Próxima puerta P0: 30 ensayos físicos entre dos teléfonos (Issue #5) + auditoría externa de criptografía (Issue #4).',
      nl: 'Volgende P0-poort: 30 fysieke proeven met twee toestellen (Issue #5) + externe cryptografie-audit (Issue #4).'
    },
    evidenceId: 'EV-09-PHY'
  }
];

export const PIPELINE_STAGES: Array<{
  code: string;
  desc: LocalizedText;
}> = [
  {
    code: 'MESSAGE',
    desc: {
      en: 'Typed SAFE / SOS / alert payload (<=160 chars) with explicit consent & E2EE envelope.',
      es: 'Mensaje tipado SAFE / SOS / aviso (≤160 car.) con consentimiento explícito y cifrado E2E.',
      nl: 'Getypt SAFE / SOS-bericht (≤160 tekens) met expliciete toestemming en E2EE-envelop.'
    }
  },
  {
    code: 'STORE',
    desc: {
      en: 'Durable local queue (IndexedDB / Android disk) bounded by TTL, priority, and storage quota.',
      es: 'Cola local persistente (IndexedDB / disco Android) acotada por TTL, prioridad y cuota.',
      nl: 'Persistente lokale wachtrij (IndexedDB / Android) begrensd door TTL, prioriteit en quotum.'
    }
  },
  {
    code: 'ROUTE',
    desc: {
      en: 'Contact Graph Routing & attempt ladder pick the earliest feasible chain across channels.',
      es: 'Contact Graph Routing y escalera de canales eligen la llegada más temprana posible.',
      nl: 'Contact Graph Routing kiest de snelst haalbare keten over beschikbare kanalen.'
    }
  },
  {
    code: 'MULTIPATH',
    desc: {
      en: 'Races BLE, Wi-Fi Direct, satellite neighbor, SMS, gateway, or acoustic MFSK-16 in parallel.',
      es: 'Lanza en paralelo BLE, Wi-Fi Direct, vecino satelital, SMS, pasarela o módem acústico.',
      nl: 'Verzendt parallel via BLE, Wi-Fi Direct, satellietbuur, sms, gateway of akoestisch.'
    }
  },
  {
    code: 'DEDUP',
    desc: {
      en: 'Same envelope arriving over multiple paths collapses into one logical message retaining path metadata.',
      es: 'El mismo sobre por varias rutas se unifica en un único mensaje conservando trazabilidad.',
      nl: 'Dezelfde envelop via meerdere routes wordt één logisch bericht met routemetadata.'
    }
  },
  {
    code: 'ACK',
    desc: {
      en: 'Receiver-signed receipt confirms delivery and propagates purge tombstones across blind relays.',
      es: 'Recibo firmado por el receptor confirma la entrega y purga copias en los relés ciegos.',
      nl: 'Ondertekend ontvangstbewijs bevestigt bezorging en wist kopieën bij tussenliggende relays.'
    }
  }
];

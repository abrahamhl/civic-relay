import type { EvidenceStatus, LocalizedText } from './types';

export interface FundingEnvelope {
  id: 'A' | 'B' | 'C';
  name: LocalizedText;
  amount: string;
  horizon: LocalizedText;
  source: LocalizedText;
  trlTarget: string;
  deliverable: LocalizedText;
  breakdown: Array<{
    label: LocalizedText;
    pct: number;
    amount: string;
  }>;
}

export interface MilestoneItem {
  id: string;
  window: LocalizedText;
  title: LocalizedText;
  criteria: LocalizedText;
  status: EvidenceStatus;
  evidenceId: string;
}

export interface RiskItem {
  category: LocalizedText;
  risk: LocalizedText;
  mitigation: LocalizedText;
  status: EvidenceStatus;
  evidenceId: string;
}

export const FUNDING_ENVELOPES: FundingEnvelope[] = [
  {
    id: 'A',
    name: {
      en: 'Track A — Field Validation & Mobile Hardware',
      es: 'Tramo A — Validación de campo y hardware móvil',
      nl: 'Traject A — Veldvalidatie & mobiele hardware'
    },
    amount: '€50,000',
    horizon: { en: '6–9 months', es: '6–9 meses', nl: '6–9 maanden' },
    source: {
      en: 'ESA BIC Madrid / RVO MIT / Deep-tech seed grant',
      es: 'ESA BIC Madrid / RVO MIT / ayuda semilla deep-tech',
      nl: 'ESA BIC / RVO MIT / deep-tech validatiebeurs'
    },
    trlTarget: 'TRL 4 -> 5',
    deliverable: {
      en: 'Instrumented 30-trial physical handset campaign, AOSP BLE/Wi-Fi Aware transport adapter, Ed25519 receipts, and independent security review.',
      es: 'Campaña física instrumentada de 30 pruebas entre móviles, adaptador AOSP BLE/Wi-Fi Aware, recibos Ed25519 y auditoría externa de seguridad.',
      nl: 'Geïnstrumenteerde 30-proevencampagne met fysieke toestellen, AOSP BLE/Wi-Fi Aware-adapter, Ed25519-ontvangstbewijzen en externe audit.'
    },
    breakdown: [
      { label: { en: 'Core Protocol & Mobile Engineering', es: 'Protocolo núcleo e ingeniería móvil', nl: 'Kernprotocol & mobiele engineering' }, pct: 64, amount: '€32,000' },
      { label: { en: 'Field Trials & Civil-Protection Exercises', es: 'Ensayos de campo y simulacros', nl: 'Veldproeven & oefeningen' }, pct: 11, amount: '€5,500' },
      { label: { en: 'Independent Security, Crypto & GDPR Audit', es: 'Auditoría seguridad, criptografía y RGPD', nl: 'Externe beveiligings- & AVG-audit' }, pct: 10, amount: '€5,000' },
      { label: { en: 'Physical Hardware & RF Testbed', es: 'Hardware físico y banco de pruebas RF', nl: 'Fysieke hardware & RF-testbed' }, pct: 9, amount: '€4,500' },
      { label: { en: 'Compliance, Open Data & Documentation', es: 'Cumplimiento, datos abiertos y documentación', nl: 'Compliance & open documentatie' }, pct: 6, amount: '€3,000' }
    ]
  },
  {
    id: 'B',
    name: {
      en: 'Track B — Institutional Pilot & Production Hardening',
      es: 'Tramo B — Piloto institucional y endurecimiento',
      nl: 'Traject B — Institutionele pilot & hardening'
    },
    amount: '€180,000',
    horizon: { en: '12 months', es: '12 meses', nl: '12 maanden' },
    source: {
      en: 'Pre-Seed Impact / Deep-Tech Angel + ENISA / NEOTEC / RVO WBSO',
      es: 'Pre-Seed Deep-Tech / Impacto + ENISA / NEOTEC / RVO WBSO',
      nl: 'Pre-Seed Impact / Deep-Tech Angel + RVO WBSO/MIT'
    },
    trlTarget: 'TRL 5 -> 6',
    deliverable: {
      en: 'Multi-hop (3-5 nodes) native Android/iOS SDK, sandbox CAP 1.2 PKI verifier, 20-handset municipal drill, formal DPIA & external pentest.',
      es: 'SDK nativo multisalto (3-5 nodos) Android/iOS, verificador CAP 1.2 PKI en sandbox, ejercicio municipal con 20 móviles, DPIA y pentest externo.',
      nl: 'Multi-hop (3-5 nodes) native Android/iOS SDK, sandbox CAP 1.2 PKI, gemeentelijke oefening met 20 toestellen, DPIA & pentest.'
    },
    breakdown: [
      { label: { en: 'Core Protocol & Mobile Engineering', es: 'Protocolo núcleo e ingeniería móvil', nl: 'Kernprotocol & mobiele engineering' }, pct: 58, amount: '€105,000' },
      { label: { en: 'Field Trials & Civil-Protection Exercises', es: 'Ensayos de campo y simulacros', nl: 'Veldproeven & oefeningen' }, pct: 14, amount: '€25,000' },
      { label: { en: 'Independent Security, Crypto & GDPR Audit', es: 'Auditoría seguridad, criptografía y RGPD', nl: 'Externe beveiligings- & AVG-audit' }, pct: 11, amount: '€20,000' },
      { label: { en: 'Physical Hardware & RF Testbed', es: 'Hardware físico y banco de pruebas RF', nl: 'Fysieke hardware & RF-testbed' }, pct: 9, amount: '€15,000' },
      { label: { en: 'Compliance, Open Data & Documentation', es: 'Cumplimiento, datos abiertos y documentación', nl: 'Compliance & open documentatie' }, pct: 8, amount: '€15,000' }
    ]
  },
  {
    id: 'C',
    name: {
      en: 'Track C — European Consortium Work Package',
      es: 'Tramo C — Paquete de trabajo consorcio europeo',
      nl: 'Traject C — Europees consortium werkpakket'
    },
    amount: '€400,000',
    horizon: { en: '18–24 months', es: '18–24 meses', nl: '18–24 maanden' },
    source: {
      en: 'Horizon Europe Cluster 3 (2027 DRS-01 / DRS-02) + EIC Accelerator',
      es: 'Horizon Europe Cluster 3 (ventana 2027 DRS-01 / DRS-02) + EIC Accelerator',
      nl: 'Horizon Europe Cluster 3 (2027 DRS-01 / DRS-02) + EIC Accelerator'
    },
    trlTarget: 'TRL 6 -> 7',
    deliverable: {
      en: 'Cross-border EU civil-protection interoperability, edge gateways (LoRa/municipal Wi-Fi/NTN), ENS/ISO 27001 readiness, and open reference suite.',
      es: 'Interoperabilidad transfronteriza de protección civil UE, pasarelas de borde (LoRa/Wi-Fi municipal/NTN), preparación ENS/ISO 27001 y suite abierta.',
      nl: 'Grensoverschrijdende EU-interoperabiliteit, edge-gateways (LoRa/Wi-Fi/NTN), ISO 27001-gereedheid en open referentiesuite.'
    },
    breakdown: [
      { label: { en: 'Core Protocol & Mobile Engineering', es: 'Protocolo núcleo e ingeniería móvil', nl: 'Kernprotocol & mobiele engineering' }, pct: 55, amount: '€220,000' },
      { label: { en: 'Field Trials & Civil-Protection Exercises', es: 'Ensayos de campo y simulacros', nl: 'Veldproeven & oefeningen' }, pct: 16, amount: '€65,000' },
      { label: { en: 'Independent Security, Crypto & GDPR Audit', es: 'Auditoría seguridad, criptografía y RGPD', nl: 'Externe beveiligings- & AVG-audit' }, pct: 11, amount: '€45,000' },
      { label: { en: 'Physical Hardware & RF Testbed', es: 'Hardware físico y banco de pruebas RF', nl: 'Fysieke hardware & RF-testbed' }, pct: 9, amount: '€35,000' },
      { label: { en: 'Compliance, Open Data & Documentation', es: 'Cumplimiento, datos abiertos y documentación', nl: 'Compliance & open documentatie' }, pct: 9, amount: '€35,000' }
    ]
  }
];

export const INVESTOR_MILESTONES: MilestoneItem[] = [
  {
    id: 'M0',
    window: { en: 'Completed · Nov 2026', es: 'Completado · Nov 2026', nl: 'Voltooid · Nov 2026' },
    title: {
      en: 'Full open-source routing core, offline PWA, 16,699-source console & 5 papers',
      es: 'Núcleo abierto completo, PWA sin red, consola de 16.699 fuentes y 5 papers',
      nl: 'Volledige open-source kern, offline PWA, 16.699-bronnenconsole & 5 papers'
    },
    criteria: {
      en: '506/506 core tests, 49/49 offline Chromium E2E checks, 14 Android/ESP32 frame invariants, and trilingual operational platform live.',
      es: '506/506 pruebas de núcleo, 49/49 E2E sin red en Chromium, 14 invariantes Android/ESP32 y plataforma operativa trilingüe.',
      nl: '506/506 kerntests, 49/49 offline Chromium E2E, 14 Android/ESP32-invarianten en drietalig platform.'
    },
    status: 'confirmed',
    evidenceId: 'EV-CORE-506'
  },
  {
    id: 'M1',
    window: { en: 'Q1 2027', es: 'T1 2027', nl: 'Q1 2027' },
    title: {
      en: 'Instrumented two-handset field campaign & 20-volunteer exercise',
      es: 'Campaña física instrumentada entre móviles y simulacro con 20 voluntarios',
      nl: 'Geïnstrumenteerde veldproef met toestellen & oefening met 20 vrijwilligers'
    },
    criteria: {
      en: '30+ measured physical trials (latency, delivery rate, battery) validated via validate-field-trials.mjs with signed raw dataset.',
      es: '≥30 intentos físicos medidos (latencia, entrega, batería) validados con validate-field-trials.mjs e informe de campo firmado.',
      nl: '≥30 gemeten fysieke proeven gevalideerd met validate-field-trials.mjs en ondertekende dataset.'
    },
    status: 'predicted',
    evidenceId: 'EV-08-ANDROID'
  },
  {
    id: 'M2',
    window: { en: 'Q2 2027', es: 'T2 2027', nl: 'Q2 2027' },
    title: {
      en: 'Institutional Letters of Intent, independent crypto audit & formal GDPR DPIA',
      es: 'Cartas de interés institucionales, auditoría criptográfica externa y DPIA RGPD',
      nl: 'Institutionele intentieverklaringen, externe crypto-audit & AVG-DPIA'
    },
    criteria: {
      en: 'Signed pilot partnerships (civil protection, volunteer corps, fleet/concessionaire), external security review, and published DPIA.',
      es: 'Acuerdos piloto firmados (protección civil, voluntarios, flotas o concesionarias), revisión externa de seguridad y DPIA publicada.',
      nl: 'Getekende pilotpartnerschappen, externe beveiligingsreview en gepubliceerde DPIA.'
    },
    status: 'predicted',
    evidenceId: 'EV-CORE-506'
  },
  {
    id: 'M3',
    window: { en: 'Q3–Q4 2027', es: 'T3–T4 2027', nl: 'Q3–Q4 2027' },
    title: {
      en: 'Native multi-hop SDK, sandbox CAP 1.2 & Horizon CL3 2027 consortium',
      es: 'SDK nativo multisalto, sandbox CAP 1.2 y consorcio Horizon CL3 2027',
      nl: 'Native multi-hop SDK, sandbox CAP 1.2 & Horizon CL3 2027-consortium'
    },
    criteria: {
      en: '3-5 node authenticated multi-hop telemetry, institutional CAP testbed, and European consortium partner integration.',
      es: 'Telemetría multisalto autenticada (3-5 nodos), banco de pruebas CAP institucional e integración en consorcio europeo.',
      nl: 'Geauthenticeerde 3-5 node multi-hop telemetrie, CAP-testbed en Europees consortium.'
    },
    status: 'predicted',
    evidenceId: 'EV-S01-ROUTE'
  }
];

export const INVESTOR_RISKS: RiskItem[] = [
  {
    category: { en: 'Hardware & Field Scale-Up', es: 'Escalado en hardware y campo', nl: 'Hardware- & veldschaling' },
    risk: {
      en: 'Translating deterministic software routing and compiled Android Nearby labs into measured multi-device RF performance.',
      es: 'Trasladar el enrutamiento determinista y la APK Android Nearby a mediciones de radiofrecuencia multi-dispositivo en entorno real.',
      nl: 'Vertalen van deterministische software en Android Nearby-lab naar gemeten multi-device RF-prestaties.'
    },
    mitigation: {
      en: 'Milestone M1 executes a structured 30-trial protocol + 20-volunteer field drill with automated telemetry validation before commercial scale.',
      es: 'El hito M1 ejecuta un protocolo reproducible de 30 ensayos y un simulacro de 20 voluntarios con validación automática de telemetría.',
      nl: 'Mijlpaal M1 voert een gestructureerd 30-proevenprotocol en veldoefening met 20 vrijwilligers uit.'
    },
    status: 'confirmed',
    evidenceId: 'EV-08-ANDROID'
  },
  {
    category: { en: 'Regulatory & Public Procurement', es: 'Marco regulatorio y compra pública', nl: 'Regelgeving & aanbesteding' },
    risk: {
      en: 'Public administration deployment requires formal compliance milestones (ENS in Spain, GDPR DPIA, EU AI Act Annex III legal review).',
      es: 'El despliegue en Administraciones Públicas exige certificaciones formales (ENS, DPIA RGPD y revisión jurídica de la Ley de IA).',
      nl: 'Overheidsinzet vereist formele conformiteit (ENS/ISO 27001, AVG-DPIA en EU AI Act-toetsing).'
    },
    mitigation: {
      en: 'SENDA operates as a complementary secondary channel using deterministic rule-based criticality (non-ML) and runs B2B fleet/insurer tracks in parallel with CPI/Horizon.',
      es: 'SENDA actúa como canal secundario complementario con criticidad determinista por reglas (no ML) y combina compra pública (CPI/Horizon) con flotas y aseguradoras.',
      nl: 'SENDA fungeert als secundair kanaal met deterministische regels en combineert publieke pilots met snellere B2B-trajecten.'
    },
    status: 'confirmed',
    evidenceId: 'EV-02-SWEEP'
  },
  {
    category: { en: 'Open-Source Business Model', es: 'Sostenibilidad Open-Core (MIT)', nl: 'Open-Core verdienmodel (MIT)' },
    risk: {
      en: 'Balancing MIT open-source transparency for institutional trust with durable commercial defensibility.',
      es: 'Equilibrar la transparencia MIT para confianza institucional con una ventaja comercial defendible.',
      nl: 'Balans tussen MIT-transparantie voor publiek vertrouwen en duurzame commerciële verdedigbaarheid.'
    },
    mitigation: {
      en: 'Open protocol core paired with B2G/B2B SaaS operational suites, verified agency integrations, edge gateways, resilience auditing, and optional dual-licensing for enterprise modules.',
      es: 'Núcleo abierto acompañado de consola operativa B2G/B2B, integraciones institucionales certificadas, pasarelas de borde, auditorías de resiliencia y licencia dual opcional para módulos futuros.',
      nl: 'Open kern gecombineerd met B2G/B2B operationele suites, geverifieerde integraties, edge-gateways en optionele dubbele licentie.'
    },
    status: 'confirmed',
    evidenceId: 'EV-CORE-506'
  }
];

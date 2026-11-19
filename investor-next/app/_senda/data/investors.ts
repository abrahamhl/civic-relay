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
      en: 'Scenario A — Lean Open-Source Validation',
      es: 'Escenario A — Validación física inicial',
      nl: 'Scenario A — Eerste fysieke validatie'
    },
    amount: '€50,000',
    horizon: { en: '6–9 months (illustrative)', es: '6–9 meses (ilustrativo)', nl: '6–9 maanden (illustratief)' },
    source: {
      en: 'RVO MIT / partner-backed grant (eligibility unverified; NLnet v2 blocked under AI-assisted workflow)',
      es: 'Ayuda pública / socio técnico (elegibilidad por validar; NLnet v2 bloqueado por política GenAI)',
      nl: 'RVO MIT / onderzoeksbeurs met partner (geschiktheid nog te valideren; NLnet v2 geblokkeerd)'
    },
    trlTarget: 'TRL 3.5 -> 4.5',
    deliverable: {
      en: '30+ physical two-phone trials, AOSP BLE/Wi-Fi Aware adapter, Ed25519 receipts, independent security review.',
      es: '≥30 ensayos físicos entre 2 móviles, adaptador AOSP BLE/Wi-Fi Aware, recibos Ed25519 y auditoría externa.',
      nl: '≥30 fysieke 2-telefoonproeven, AOSP BLE/Wi-Fi Aware-adapter, Ed25519-ontvangstbewijzen en externe audit.'
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
      en: 'Scenario B — Institutional Pilot & Hardening',
      es: 'Escenario B — Piloto institucional y endurecimiento',
      nl: 'Scenario B — Institutionele pilot & hardening'
    },
    amount: '€180,000',
    horizon: { en: '12 months (illustrative)', es: '12 meses (ilustrativo)', nl: '12 maanden (illustratief)' },
    source: {
      en: 'Pre-Seed Impact / Deep-Tech Angel + ENISA / RVO WBSO (pending legal entity confirmation)',
      es: 'Pre-seed impacto / Deep-Tech + ENISA / ESA BIC (requiere sociedad constituida: por validar)',
      nl: 'Pre-seed impact / deep-tech angel + RVO WBSO/MIT (rechtspersoon nog te bevestigen)'
    },
    trlTarget: 'TRL 4 -> 6',
    deliverable: {
      en: 'Multi-hop (3-5 nodes) Android/iOS SDK, sandbox CAP 1.2 PKI verifier, 20-handset municipal drill, formal DPIA & pentest.',
      es: 'SDK multisalto (3-5 nodos), verificador CAP 1.2 PKI en sandbox, ejercicio con 20 móviles, DPIA formal y pentest.',
      nl: 'Multi-hop (3-5 nodes) Android/iOS SDK, sandbox CAP 1.2 PKI, oefening met 20 toestellen, DPIA & pentest.'
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
      en: 'Scenario C — European Consortium Work Package',
      es: 'Escenario C — Paquete de trabajo consorcio UE',
      nl: 'Scenario C — Europees consortium werkpakket'
    },
    amount: '€400,000',
    horizon: { en: '18–24 months (illustrative)', es: '18–24 meses (ilustrativo)', nl: '18–24 maanden (illustratief)' },
    source: {
      en: 'Horizon Europe Cluster 3 (2027 DRS-01 / DRS-02 window) as technical consortium partner',
      es: 'Horizon Europe Cluster 3 (ventana 2027 DRS-01 / DRS-02) como socio tecnológico de consorcio',
      nl: 'Horizon Europe Cluster 3 (2027 DRS-01 / DRS-02) als technische consortiumpartner'
    },
    trlTarget: 'TRL 4 -> 7',
    deliverable: {
      en: 'Cross-border civil-protection interoperability, edge gateways (LoRa/municipal Wi-Fi/NTN testbed), standardized open reference suite.',
      es: 'Interoperabilidad transfronteriza de protección civil, pasarelas (LoRa/Wi-Fi municipal/banco NTN) y suite de referencia.',
      nl: 'Grensoverschrijdende interoperabiliteit civiele bescherming, edge-gateways en open referentiesuite.'
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
    window: { en: 'Done · Nov 2026', es: 'Completado · Nov 2026', nl: 'Voltooid · Nov 2026' },
    title: {
      en: 'Reproducible open-source core, offline PWA & Android lab build',
      es: 'Núcleo abierto reproducible, PWA sin red y lab Android compilado',
      nl: 'Reproduceerbare open-source kern, offline PWA & Android-labbuild'
    },
    criteria: {
      en: '506/506 core tests, 49/49 offline Chromium E2E checks, 14 Android/ESP32 frame invariants, public evidence register.',
      es: '506/506 pruebas de núcleo, 49/49 E2E sin red en Chromium, 14 invariantes Android/ESP32 y registro público.',
      nl: '506/506 kerntests, 49/49 offline Chromium E2E-controles, 14 Android/ESP32-invarianten en openbaar register.'
    },
    status: 'confirmed',
    evidenceId: 'EV-CORE-506'
  },
  {
    id: 'M1',
    window: { en: 'Q1 2027 (Weeks 2–6)', es: 'T1 2027 (Semanas 2–6)', nl: 'Q1 2027 (Week 2–6)' },
    title: {
      en: 'Instrumented two-phone physical trial & 20-volunteer field exercise',
      es: 'Ensayo físico entre 2 móviles y ejercicio de campo con 20 voluntarios',
      nl: 'Geïnstrumenteerde 2-telefoonproef & veldoefening met 20 vrijwilligers'
    },
    criteria: {
      en: '≥30 recorded attempts (baseline, interruption, replay, TTL) validated by validate-field-trials.mjs + signed raw dataset.',
      es: '≥30 intentos medidos (base, corte, repetición, TTL) validados con validate-field-trials.mjs + informe firmado.',
      nl: '≥30 geregistreerde pogingen gevalideerd met validate-field-trials.mjs + ondertekende ruwe dataset.'
    },
    status: 'untested',
    evidenceId: 'EV-09-PHY'
  },
  {
    id: 'M2',
    window: { en: 'Q2 2027 (Months 2–4)', es: 'T2 2027 (Meses 2–4)', nl: 'Q2 2027 (Maand 2–4)' },
    title: {
      en: '2–3 Letters of Intent, independent security audit & formal GDPR DPIA',
      es: '2–3 cartas de interés, auditoría externa de seguridad y DPIA RGPD',
      nl: '2–3 intentieverklaringen, externe beveiligingsaudit & AVG-DPIA'
    },
    criteria: {
      en: 'Signed LOIs (municipal civil protection, volunteer corps, fleet/concessionaire), third-party crypto review & published DPIA.',
      es: 'Cartas firmadas (Protección Civil municipal, voluntarios o flota), revisión criptográfica externa y DPIA publicada.',
      nl: 'Ondertekende LOI’s, onafhankelijke cryptografiebeoordeling en gepubliceerde AVG-DPIA.'
    },
    status: 'untested',
    evidenceId: 'EV-10-INST'
  },
  {
    id: 'M3',
    window: { en: 'Q3–Q4 2027 (Months 4–12)', es: 'T3–T4 2027 (Meses 4–12)', nl: 'Q3–Q4 2027 (Maand 4–12)' },
    title: {
      en: '3-node authenticated multi-hop, sandbox CAP 1.2 & Horizon CL3 2027 consortium',
      es: 'Multisalto autenticado (3 nodos), sandbox CAP 1.2 y consorcio Horizon CL3 2027',
      nl: 'Geauthenticeerde 3-node multi-hop, sandbox CAP 1.2 & Horizon CL3 2027-consortium'
    },
    criteria: {
      en: 'Measured multi-hop delivery/latency/battery under failure injection + institutional CAP testbed + consortium accession.',
      es: 'Entrega/latencia/batería medidas bajo inyección de fallos + entorno pruebas CAP + adhesión a consorcio europeo.',
      nl: 'Gemeten multi-hop levering/latentie/batterij + CAP-testbed + toetreding tot Europees consortium.'
    },
    status: 'untested',
    evidenceId: 'EV-10-INST'
  }
];

export const INVESTOR_RISKS: RiskItem[] = [
  {
    category: { en: 'Physical validation', es: 'Validación física', nl: 'Fysieke validatie' },
    risk: {
      en: 'Zero physical two-handset deliveries measured to date; browser/JVM tests cannot prove real RF range or battery drain.',
      es: 'Cero entregas físicas medidas entre dos móviles; las pruebas en navegador/JVM no prueban alcance RF ni batería real.',
      nl: 'Nul fysieke leveringen tussen twee toestellen gemeten; browser/JVM-tests bewijzen geen echt RF-bereik of accuduur.'
    },
    mitigation: {
      en: 'Milestone-gated funding: M1 delivers a reproducible 30-trial protocol + 20-volunteer field report before scaling.',
      es: 'Financiación por hitos: el hito M1 entrega el protocolo de 30 intentos y un ejercicio de 20 voluntarios antes de escalar.',
      nl: 'Mijlpaalgestuurde financiering: M1 levert het 30-proevenprotocol en veldrapport met 20 vrijwilligers vóór opschaling.'
    },
    status: 'untested',
    evidenceId: 'EV-09-PHY'
  },
  {
    category: { en: 'Regulatory & liability', es: 'Regulación y responsabilidad', nl: 'Regelgeving & aansprakelijkheid' },
    risk: {
      en: 'Emergency prioritization may fall under EU AI Act Annex III high-risk scope; Spanish public sector requires ENS (RD 311/2022).',
      es: 'La priorización de emergencias puede entrar en alto riesgo de la Ley de IA (anexo III); la Administración española exige ENS.',
      nl: 'Noodprioritering kan onder EU AI Act Bijlage III vallen; publieke sector vereist formele conformiteit (ENS/ISO 27001).'
    },
    mitigation: {
      en: 'SENDA is strictly a secondary channel (never replaces 112/ES-Alert), uses deterministic rule-based criticality (non-ML), and schedules legal + ENS audit in M2-M3.',
      es: 'SENDA es estrictamente un canal secundario (nunca sustituye al 112/ES-Alert), usa reglas deterministas no aprendidas y planifica análisis jurídico y ENS en M2-M3.',
      nl: 'SENDA is strikt een secundair kanaal (vervangt nooit 112/NL-Alert), gebruikt deterministische regels en plant juridische & compliance-audit in M2-M3.'
    },
    status: 'untested',
    evidenceId: 'EV-10-INST'
  },
  {
    category: { en: 'B2G adoption & sales cycle', es: 'Adopción B2G y ciclo de venta', nl: 'B2G-adoptie & verkoopcyclus' },
    risk: {
      en: 'Public procurement cycles are slow (6-18 months unverified estimate) and no signed pilot agreements exist yet.',
      es: 'La contratación pública es lenta y todavía no existen convenios piloto ni clientes firmados.',
      nl: 'Aanbestedingen bij overheden zijn traag en er zijn nog geen getekende pilotovereenkomsten of klanten.'
    },
    mitigation: {
      en: 'Three parallel tracks: Public Procurement of Innovation (CPI), grant-backed consortium pilots (Horizon/UCPM), and faster private B2B (fleets, concessionaires, insurers).',
      es: 'Tres vías en paralelo: Compra Pública de Innovación (CPI), pilotos en consorcio (Horizon/UCPM) y clientes privados (flotas, concesionarias, aseguradoras).',
      nl: 'Drie sporen parallel: innovatiegericht inkopen, gesubsidieerde consortiumpilots (Horizon/UCPM) en snellere B2B-klanten (vloten, verzekeraars).'
    },
    status: 'untested',
    evidenceId: 'EV-10-INST'
  },
  {
    category: { en: 'Open-source IP (MIT)', es: 'Propiedad intelectual (MIT)', nl: 'Open-source IE (MIT)' },
    risk: {
      en: 'MIT license allows third parties to fork the core protocol; corporate entity & IP assignment status must be confirmed.',
      es: 'La licencia MIT permite copiar el núcleo; falta confirmar constitución societaria y cesión formal de PI.',
      nl: 'MIT-licentie staat vorken van de kern toe; rechtspersoon en IE-overdracht dienen formeel bevestigd te worden.'
    },
    mitigation: {
      en: 'Defensibility rests on institutional trust anchors, verified agreements, brand, and integration engineering; dual licensing for future commercial modules remains a founder option.',
      es: 'El foso reside en convenios institucionales, red desplegada, datos con permiso e ingeniería de integración; licencia dual para módulos futuros a decidir por el fundador.',
      nl: 'Onderscheidend vermogen ligt in institutionele overeenkomsten, integraties en merk; dubbele licentie voor toekomstige modules blijft optioneel.'
    },
    status: 'confirmed',
    evidenceId: 'EV-CORE-506'
  }
];

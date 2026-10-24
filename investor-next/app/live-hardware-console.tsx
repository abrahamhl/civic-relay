'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from './copy';
import {
  generateRealEcdsaKeyPair,
  signAndPackRealOepPacket,
  verifyRealOepPacket,
  computeLiveOrbitalEphemeris,
  type RealEcdsaKeyBundle,
  type SignedOepRealPacket
} from '../lib/live-protocol-node.mjs';
import { energyPolicy } from '../lib/emergency-policy.mjs';
import { sendWebRtcLoopbackPacket } from '../lib/webrtc-loopback.mjs';
import { createPacketInbox } from '../lib/packet-inbox.mjs';
import { assessPacketVerification } from '../lib/packet-verification-state.mjs';

interface FundingTarget {
  id: string;
  badge: string;
  name: string;
  amount: string;
  deadline: string;
  portalUrl: string;
  fitSummary: string;
  chatgptPrompt: string;
}

const STORAGE_KEY = 'oep_real_durable_queue_v1';
const CHANNEL_NAME = 'oep_live_p2p_bus_v1';

const fundingTargetsByLocale: Record<Locale, FundingTarget[]> = {
  es: [
    {
      id: 'F01-NLNET',
      badge: 'SUBVENCIÓN DIRECTA OPEN SOURCE · PRIORIDAD #1',
      name: 'NLnet Foundation — Open Internet Stack / NGI Zero',
      amount: '€5,000 – €50,000 (Solicitado: €42,000 · 100% No dilutivo)',
      deadline: '3 de noviembre de 2026 (12:00 CET)',
      portalUrl: 'https://nlnet.nl/propose/',
      fitSummary:
        'Financia protocolos abiertos, enrutamiento descentralizado resiliente y comunicaciones offline sin necesidad de consorcio ni empresa constituida.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F02-HORIZON-CL3',
      badge: 'CONSORCIO EUROPEO · PROTECCIÓN CIVIL',
      name: 'Horizon Europe Cluster 3 — HORIZON-CL3-2026-01-SSRI-04',
      amount: '€3,000,000 – €5,000,000 (Paquete técnico OEP: €250k – €450k)',
      deadline: '18 de noviembre de 2026',
      portalUrl:
        'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04',
      fitSummary:
        'Convocatoria oficial de la Comisión Europea para resiliencia ante desastres, comunicaciones de emergencia interoperables y búsqueda y rescate (USAR).',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F03-NATO-DIANA',
      badge: 'DUAL-USE & ELECTROMAGNETIC RESILIENCE',
      name: 'NATO DIANA — Contested Electromagnetic Environments & Resilient Comms',
      amount: '€100,000 (Fase 1) + hasta €300,000 (Fase 2 · No dilutivo)',
      deadline: 'Ventana anual de retos Dual-Use 2026',
      portalUrl: 'https://www.diana.nato.int/',
      fitSummary:
        'Aceleradora de innovación dual de la OTAN para comunicaciones resilientes cuando caen las redes terrestres, entornos electromagnéticos degradados y detección RF pasiva.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F04-EIC-ACCELERATOR',
      badge: 'DEEP-TECH EUROPEO · GRANT + EQUITY',
      name: 'EIC Accelerator (European Innovation Council) — Deep Tech Resilience',
      amount: 'Hasta €2.5M en Subvención + €0.5M – €10M en Capital (Equity)',
      deadline: 'Short Applications abiertas de forma continua (Cut-offs 2026)',
      portalUrl: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en',
      fitSummary:
        'Financia startups europeas deep-tech que resuelven brechas críticas de soberanía tecnológica europea (EU Critical Communication System y rescate trans-pared).',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F05-GSMA-HUMANITARIAN',
      badge: 'IMPACTO GLOBAL Y TELECOS · SUBVENCIÓN',
      name: 'GSMA Innovation Fund — Mobile for Humanitarian Innovation (EW4All)',
      amount: '£100,000 – £250,000 (Subvención a fondo perdido + Alianza con Operadoras)',
      deadline: 'Convocatorias humanitarias y resiliencia climática 2026',
      portalUrl: 'https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma-innovation-fund/',
      fitSummary:
        'Respaldado por la asociación mundial de operadoras móviles (GSMA) para sistemas de alerta temprana (EW4All) y coordinación móvil durante desastres naturales.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F06-CDTI-NEOTEC-SPAIN',
      badge: 'ESPAÑA · SUBVENCIÓN NACIONAL EBT',
      name: 'CDTI Neotec 2026 + INCIBE Emprende / ENISA Digital',
      amount: 'Hasta €250,000 – €325,000 (Subvención hasta el 70-85% del presupuesto)',
      deadline: 'Convocatoria CDTI Neotec / INCIBE 2026',
      portalUrl: 'https://www.cdti.es/ayudas/neotec',
      fitSummary:
        'Subvención a fondo perdido en España para Empresas de Base Tecnológica (EBT) con tecnología propia en telecomunicaciones críticas, ciberseguridad e IA/sensórica.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F07-RVO-NETHERLANDS',
      badge: 'PAÍSES BAJOS · CRÉDITO FISCAL + SUBVENCIÓN PYME',
      name: 'RVO Netherlands — WBSO (36% I+D) + MIT Haalbaarheid / R&D',
      amount: '€20,000 – €350,000 + 36% deducción salarial I+D (50% startups)',
      deadline: 'Ventanas continuas WBSO / MIT 2026',
      portalUrl: 'https://www.rvo.nl/subsidies-financiering/wbso',
      fitSummary:
        'Financiación directa e incentivo fiscal en Países Bajos (interfaz web ya traducida íntegramente al neerlandés en /nl/) para desarrollo de software técnico original.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F08-VC-DEEPTECH-SEED',
      badge: 'CAPITAL RIESGO (VC) & BUSINESS ANGELS · PRE-SEED / SEED',
      name: 'Fondos Europeos Deep-Tech, GovTech y Resiliencia (Kibo, Inveready, Jolt, Bullnet, Keen)',
      amount: 'Ronda Pre-Seed / Seed: €500,000 – €1,500,000',
      deadline: 'Abierto (Contacto directo con socios de inversión)',
      portalUrl: 'https://civic-relay-investor.vercel.app/es#investment',
      fitSummary:
        'Inversores institucionales de capital riesgo que buscan software de infraestructura de telecomunicaciones, SDKs licenciables a operadoras/OEMs y defensa civil.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    }
  ],
  en: [
    {
      id: 'F01-NLNET',
      badge: 'DIRECT OPEN-SOURCE GRANT · PRIORITY #1',
      name: 'NLnet Foundation — Open Internet Stack / NGI Zero',
      amount: '€5,000 – €50,000 (Requested: €42,000 · 100% Non-dilutive)',
      deadline: 'November 3, 2026 (12:00 CET)',
      portalUrl: 'https://nlnet.nl/propose/',
      fitSummary:
        'Funds open-source protocols, resilient decentralized routing, and offline emergency communications without requiring a multi-country consortium.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F02-HORIZON-CL3',
      badge: 'EU CONSORTIUM · CIVIL SECURITY & USAR',
      name: 'Horizon Europe Cluster 3 — HORIZON-CL3-2026-01-SSRI-04',
      amount: '€3,000,000 – €5,000,000 (OEP Technical WP: €250k – €450k)',
      deadline: 'November 18, 2026',
      portalUrl:
        'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04',
      fitSummary:
        'European Commission call for disaster-resilient societies, interoperable crisis communications, and urban search & rescue (USAR) technologies.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F03-NATO-DIANA',
      badge: 'DUAL-USE & ELECTROMAGNETIC RESILIENCE',
      name: 'NATO DIANA — Contested Electromagnetic Environments & Resilient Comms',
      amount: '€100,000 (Phase 1) + up to €300,000 (Phase 2 · Non-dilutive)',
      deadline: '2026 Dual-Use Challenge Windows',
      portalUrl: 'https://www.diana.nato.int/',
      fitSummary:
        'NATO dual-use accelerator backing resilient communications when terrestrial networks collapse, narrowband tactical framing, and through-wall RF sensing.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F04-EIC-ACCELERATOR',
      badge: 'EU DEEP-TECH · BLENDED GRANT + EQUITY',
      name: 'EIC Accelerator — European Sovereign Crisis Communications',
      amount: 'Up to €2.5M Grant + €0.5M – €10M Equity',
      deadline: 'Rolling Step 1 Short Applications (2026 Cut-offs)',
      portalUrl: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en',
      fitSummary:
        'Backs high-impact European deep-tech startups addressing strategic autonomy in emergency communications and satellite-terrestrial convergence.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F05-GSMA-HUMANITARIAN',
      badge: 'GLOBAL TELCO & HUMANITARIAN GRANT',
      name: 'GSMA Innovation Fund — Mobile for Humanitarian Innovation (EW4All)',
      amount: '£100,000 – £250,000 Non-Dilutive Grant + Telco Partnerships',
      deadline: '2026 Humanitarian & Climate Resilience Rounds',
      portalUrl: 'https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma-innovation-fund/',
      fitSummary:
        'Backed by the global mobile operator ecosystem (GSMA) to fund Early Warnings for All (EW4All) and disaster-resilient mobile coordination.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F06-CDTI-NEOTEC-SPAIN',
      badge: 'SPAIN NATIONAL DEEP-TECH GRANT',
      name: 'CDTI Neotec 2026 + INCIBE Emprende Spain',
      amount: 'Up to €250,000 – €325,000 Non-Dilutive Grant',
      deadline: '2026 CDTI Neotec / INCIBE Calls',
      portalUrl: 'https://www.cdti.es/ayudas/neotec',
      fitSummary:
        'Spanish national non-dilutive grant for technology-based startups developing proprietary telecom, cybersecurity, and RF sensing software.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F07-RVO-NETHERLANDS',
      badge: 'NETHERLANDS R&D TAX CREDIT & SME GRANT',
      name: 'RVO Netherlands — WBSO (36% R&D) + MIT Feasibility / R&D',
      amount: '€20,000 – €350,000 + 36%–50% R&D Wage Tax Credit',
      deadline: 'Rolling 2026 RVO Windows',
      portalUrl: 'https://www.rvo.nl/subsidies-financiering/wbso',
      fitSummary:
        'Dutch R&D tax credit and SME innovation grant (Dutch localized interface live at /nl/) for original software and protocol engineering.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F08-VC-DEEPTECH-SEED',
      badge: 'VENTURE CAPITAL & ANGEL SYNDICATES · PRE-SEED / SEED',
      name: 'European Deep-Tech, GovTech & Dual-Use VCs',
      amount: '€500,000 – €1,500,000 Pre-Seed / Seed Round',
      deadline: 'Open (Direct GP Outreach)',
      portalUrl: 'https://civic-relay-investor.vercel.app/#investment',
      fitSummary:
        'Private institutional investors backing licensable B2B/B2G telecom SDKs for Direct-to-Cell satellite operators, OEMs, insurers, and first responders.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    }
  ],
  nl: [
    {
      id: 'F01-NLNET',
      badge: 'DIRECTE OPEN-SOURCE SUBSIDIE · PRIORITEIT #1',
      name: 'NLnet Foundation — Open Internet Stack / NGI Zero (Nederland)',
      amount: '€5,000 – €50,000 (Aangevraagd: €42,000 · 100% Subsidie)',
      deadline: '3 november 2026 (12:00 CET)',
      portalUrl: 'https://nlnet.nl/propose/',
      fitSummary:
        'Nederlandse stichting die open-source protocollen, decentrale noodroutering en offline communicatie financiert zonder consortiumvereiste.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F02-HORIZON-CL3',
      badge: 'EU-CONSORTIUM · CIVIELE VEILIGHEID & USAR',
      name: 'Horizon Europe Cluster 3 — HORIZON-CL3-2026-01-SSRI-04',
      amount: '€3,000,000 – €5,000,000 (OEP Technisch WP: €250k – €450k)',
      deadline: '18 november 2026',
      portalUrl:
        'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04',
      fitSummary:
        'Oproep van de Europese Commissie voor rampbestendige samenlevingen, interoperabele noodcommunicatie en zoek- en reddingstechnologie (USAR).',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F03-NATO-DIANA',
      badge: 'DUAL-USE & ELEKTROMAGNETISCHE VEERKRACHT',
      name: 'NATO DIANA — Contested Electromagnetic Environments & Resilient Comms',
      amount: '€100,000 (Fase 1) + tot €300,000 (Fase 2 · Subsidie)',
      deadline: '2026 Dual-Use Challenge Windows',
      portalUrl: 'https://www.diana.nato.int/',
      fitSummary:
        'NAVO dual-use accelerator voor veerkrachtige communicatie bij netwerkuitval, 24-byte satelliet-framing en door-de-muur RF-detectie.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F04-EIC-ACCELERATOR',
      badge: 'EU DEEP-TECH · SUBSIDIE + EQUITY',
      name: 'EIC Accelerator — Europese Soevereine Noodcommunicatie',
      amount: 'Tot €2.5M Subsidie + €0.5M – €10M Kapitaal',
      deadline: 'Doorlopende Step 1 Short Applications (2026)',
      portalUrl: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en',
      fitSummary:
        'Ondersteunt Europese deep-tech startups die kritieke gaten in Europese technologische soevereiniteit en noodcommunicatie oplossen.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F05-GSMA-HUMANITARIAN',
      badge: 'WERELDWIJDE TELECOM & HUMANITAIRE SUBSIDIE',
      name: 'GSMA Innovation Fund — Mobile for Humanitarian Innovation',
      amount: '£100,000 – £250,000 Subsidie + Telecom-partnerschappen',
      deadline: '2026 Humanitarian Resilience Rondes',
      portalUrl: 'https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma-innovation-fund/',
      fitSummary:
        'Ondersteund door wereldwijde mobiele providers (GSMA) voor Early Warnings for All (EW4All) en mobiele coördinatie tijdens rampen.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F06-CDTI-NEOTEC-SPAIN',
      badge: 'SPANJE · NATIONALE DEEP-TECH SUBSIDIE',
      name: 'CDTI Neotec 2026 + INCIBE Emprende Spanje',
      amount: 'Tot €250,000 – €325,000 Subsidie',
      deadline: '2026 CDTI Neotec / INCIBE Oproepen',
      portalUrl: 'https://www.cdti.es/ayudas/neotec',
      fitSummary:
        'Spaanse nationale subsidie voor technologische startups met eigen telecom-, cybersecurity- en RF-detectiesoftware.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F07-RVO-NETHERLANDS',
      badge: 'NEDERLAND · RVO WBSO + MIT-REGELING',
      name: 'RVO Nederland — WBSO (36% R&D) + MIT Haalbaarheid / R&D',
      amount: '€20,000 – €350,000 + 36%–50% WBSO-voordeel',
      deadline: 'Doorlopende RVO-vensters 2026',
      portalUrl: 'https://www.rvo.nl/subsidies-financiering/wbso',
      fitSummary:
        'Directe Nederlandse R&D-regelingen voor eigen technische softwareontwikkeling (volledig Nederlandstalig prototype live op /nl/).',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    },
    {
      id: 'F08-VC-DEEPTECH-SEED',
      badge: 'VENTURE CAPITAL & ENGEL-INVESTEERDERS · PRE-SEED / SEED',
      name: 'Europese Deep-Tech, GovTech & Dual-Use VC-Fondsen',
      amount: '€500,000 – €1,500,000 Pre-Seed / Seed Ronde',
      deadline: 'Open (Directe benadering van partners)',
      portalUrl: 'https://civic-relay-investor.vercel.app/nl#investment',
      fitSummary:
        'Particuliere investeerders gericht op licentieerbare B2B/B2G telecom-SDK’s voor satelliet- en mobiele providers en hulpdiensten.',
      chatgptPrompt: 'Evidence-scoped draft; verify official portal first.'
    }
  ]
};

const consoleCopy = {
  es: {
    eyebrow: 'LABORATORIO LOCAL · CRIPTOGRAFÍA, SENSORES Y LÍMITES',
    title: 'Firmas reales y transportes locales experimentales',
    lead: 'WebCrypto ejecuta firmas reales sobre datos de laboratorio; WebRTC prueba un loopback local y BroadcastChannel conecta pestañas del mismo origen. La batería y red pueden no estar disponibles. Las órbitas son ilustrativas; las rutas de financiación requieren verificar condiciones actuales.',
    cryptoTitle: '1. WebCrypto real · laboratorio local',
    signSosBtn: 'FIRMAR SOS DE LABORATORIO · LOOPBACK LOCAL',
    signSafeBtn: 'FIRMAR SAFE DE LABORATORIO · LOOPBACK LOCAL',
    clearDiskBtn: 'VACIAR COLA EN DISCO',
    hwTitle: '2. Datos expuestos por el navegador · sin calibración física',
    micBtnStart: 'AUTORIZAR MICRÓFONO · ESPECTRO ACÚSTICO',
    micBtnStop: 'DETENER ESCÁNER ACÚSTICO FFT',
    orbTitle: '3. Órbitas ilustrativas · DEMO_ONLY',
    dealTitle: 'Rutas de financiación · pendientes de verificar',
    dealLead:
      'Fechas, importes y condiciones heredadas sin verificar en esta revisión. Los prompts solo preparan borradores sujetos a comprobación.',
    copyPromptBtn: 'COPIAR PROMPT MAESTRO + PROPUESTA PARA CHATGPT',
    copiedBadge: '¡PROMPT COPIADO AL PORTAPAPELES! PÉGALO EN CHATGPT',
    openPortalBtn: 'ABRIR PORTAL OFICIAL ↗'
  },
  en: {
    eyebrow: 'LOCAL LAB · CRYPTOGRAPHY, SENSORS AND LIMITS',
    title: 'Real signatures and experimental local transports',
    lead: 'WebCrypto executes real signatures on laboratory data; WebRTC tests a local loopback and BroadcastChannel connects same-origin tabs. Battery and network data may be unavailable. Orbits are illustrative; funding routes require current eligibility checks.',
    cryptoTitle: '1. Real WebCrypto · local laboratory',
    signSosBtn: 'SIGN LAB SOS · LOCAL LOOPBACK',
    signSafeBtn: 'SIGN LAB SAFE · LOCAL LOOPBACK',
    clearDiskBtn: 'CLEAR DISK QUEUE',
    hwTitle: '2. Browser-reported data · no physical calibration',
    micBtnStart: 'AUTHORIZE MICROPHONE · ACOUSTIC SPECTRUM',
    micBtnStop: 'STOP FFT ACOUSTIC SCANNER',
    orbTitle: '3. Illustrative orbital shells · DEMO_ONLY',
    dealTitle: 'Funding routes · verification required',
    dealLead:
      'Inherited dates, amounts and conditions are unverified in this review. Prompts only prepare drafts requiring verification.',
    copyPromptBtn: 'COPY MASTER PROMPT + PROPOSAL FOR CHATGPT',
    copiedBadge: 'PROMPT COPIED TO CLIPBOARD! PASTE INTO CHATGPT',
    openPortalBtn: 'OPEN OFFICIAL PORTAL ↗'
  },
  nl: {
    eyebrow: 'LOKAAL LAB · CRYPTOGRAFIE, SENSOREN EN GRENZEN',
    title: 'Echte handtekeningen en experimentele lokale verbindingen',
    lead: 'WebCrypto voert echte handtekeningen uit op labgegevens; WebRTC test een lokale loopback en BroadcastChannel verbindt tabbladen van dezelfde oorsprong. Accu- en netwerkgegevens kunnen ontbreken. Banen zijn illustratief; financieringsroutes vereisen actuele controle.',
    cryptoTitle: '1. Echte WebCrypto · lokaal laboratorium',
    signSosBtn: 'LAB-SOS ONDERTEKENEN · LOKALE LOOPBACK',
    signSafeBtn: 'LAB-SAFE ONDERTEKENEN · LOKALE LOOPBACK',
    clearDiskBtn: 'WIS SCHIJFWACHTRIJ',
    hwTitle: '2. Browsergegevens · zonder fysieke kalibratie',
    micBtnStart: 'MICROFOON TOESTAAN · AKOESTISCH SPECTRUM',
    micBtnStop: 'STOP FFT AKOESTISCHE SCANNER',
    orbTitle: '3. Illustratieve banen · DEMO_ONLY',
    dealTitle: 'Financieringsroutes · verificatie vereist',
    dealLead:
      'Overgenomen datums, bedragen en voorwaarden zijn niet geverifieerd. Prompts maken alleen concepten die controle vereisen.',
    copyPromptBtn: 'KOPIEER MASTER-PROMPT + VOORSTEL VOOR CHATGPT',
    copiedBadge: 'PROMPT GEKOPIEERD! PLAK IN CHATGPT',
    openPortalBtn: 'OPEN OFFICIEEL PORTAAL ↗'
  }
} as const;

export default function LiveHardwareAndDealRoomConsole({ locale }: { locale: Locale }) {
  const c = consoleCopy[locale];
  const targets = fundingTargetsByLocale[locale];

  // 1. Real WebCrypto ECDSA P-256 + WebRTC + BroadcastChannel + localStorage state
  const [keyInfo, setKeyInfo] = useState<RealEcdsaKeyBundle | null>(null);
  const [lastPacket, setLastPacket] = useState<SignedOepRealPacket | null>(null);
  const [verifyState, setVerifyState] = useState<{
    valid: boolean;
    trustStatus: 'SIGNATURE_INVALID' | 'SIGNATURE_VALID_UNTRUSTED';
    reason: string;
    verifyTimeMs: number;
    webrtcRttMs: number | null;
    webrtcResult: string;
    transportUsed: string;
  } | null>(null);
  const [durableQueue, setDurableQueue] = useState<SignedOepRealPacket[]>([]);
  const queueRef = useRef<SignedOepRealPacket[]>([]);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [operationStatus, setOperationStatus] = useState('NOT_TESTED');
  const loopbackAbortRef = useRef<AbortController|null>(null);
  const inboxRef = useRef(createPacketInbox());

  // 2. Real Device Hardware Telemetry state
  const [hwState, setHwState] = useState<{
    online: boolean | null;
    batteryPct: number | null;
    charging: boolean | null;
    netType: string;
    downlinkMbps: number | null;
    netRttMs: number | null;
    cores: number | null;
    bluetoothApiAvailable: boolean;
    webrtcApiAvailable: boolean;
    webcryptoAvailable: boolean;
  }>({
    online: null,
    batteryPct: null,
    charging: null,
    netType: 'DETECTING',
    downlinkMbps: null,
    netRttMs: null,
    cores: null,
    bluetoothApiAvailable: false,
    webrtcApiAvailable: false,
    webcryptoAvailable: false
  });

  // Live WebAudio FFT Acoustic Spectrum state
  const [fftBins, setFftBins] = useState<number[]>(Array.from({ length: 32 }, () => 0));
  const [micActive, setMicActive] = useState(false);
  const [fftProvenance,setFftProvenance]=useState<{sampleRateHz:number;timestamp:string}|null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const micRequestEpochRef = useRef(0);
  const micPendingRef = useRef(false);
  const queueEpochRef = useRef(0);

  // 3. Real-time UTC clock for Orbital Ephemerides
  const [utcNow, setUtcNow] = useState<number>(1792569600000);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // WebRTC is only a SAME-BROWSER loopback experiment, never a remote receipt.
  // Bootstrap real WebCrypto ECDSA P-256 keypair, durable localStorage queue, BroadcastChannel, and Hardware APIs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUtcNow(Date.now());
    const clockInterval = window.setInterval(() => {
      const at=Date.now();setUtcNow(at);
      const fresh=queueRef.current.filter(packet=>at<packet.timestampMs+60000);
      if(fresh.length!==queueRef.current.length){
        queueRef.current=fresh;setDurableQueue(fresh);
        try{if(fresh.length)window.localStorage.setItem(STORAGE_KEY,JSON.stringify(fresh));
          else window.localStorage.removeItem(STORAGE_KEY);}
        catch{setOperationStatus('RETENTION_CLEANUP_FAILED');}
      }
      setLastPacket(packet=>packet&&at>=packet.timestampMs+60000?null:packet);
    }, 1000);

    const bootstrapEpoch = queueEpochRef.current;
    // Restore only fresh, verified lab packets. Stored browser data is untrusted input.
    void (async()=>{
      try {
        const raw=window.localStorage.getItem(STORAGE_KEY);
        if(!raw)return;
        if(raw.length>65536)throw Error('OVERSIZED_STORAGE');
        const parsed=JSON.parse(raw);
        if(!Array.isArray(parsed))throw Error('INVALID_STORAGE');
        const restored:SignedOepRealPacket[]=[];
        const restoreInbox=createPacketInbox();
        for(const item of parsed.slice(0,8)){
          const result=await restoreInbox.receive(item);
          if(result.packet)restored.push(result.packet);
        }
        if (bootstrapEpoch !== queueEpochRef.current) return;
        queueRef.current=restored;setDurableQueue(restored);
        if(restored.length)window.localStorage.setItem(STORAGE_KEY,JSON.stringify(restored));
        else window.localStorage.removeItem(STORAGE_KEY);
      }catch{if(bootstrapEpoch===queueEpochRef.current)setOperationStatus('STORAGE_UNAVAILABLE_OR_INVALID');}
    })();
    // Key generation is local; an SOS is created only by a labelled lab button.
    generateRealEcdsaKeyPair().then(bundle=>{
      if (bootstrapEpoch !== queueEpochRef.current) return;
      setKeyInfo(bundle);
    }).catch(()=>{if(bootstrapEpoch===queueEpochRef.current)setOperationStatus('WEBCRYPTO_UNAVAILABLE');});

    // Listen on BroadcastChannel for real cross-tab P2P packets
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = async (ev) => {
        const receiveEpoch=queueEpochRef.current;
        const result=await inboxRef.current.receive(ev.data);
        if(receiveEpoch!==queueEpochRef.current)return;
        if(!result.packet||!result.verification){setOperationStatus(result.status);return;}
        const ver=result.verification;
        setLastPacket(result.packet);
        setVerifyState({valid:true,trustStatus:'SIGNATURE_VALID_UNTRUSTED',reason:ver.reason,
          verifyTimeMs:ver.verifyTimeMs,webrtcRttMs:null,webrtcResult:'NOT_TESTED',
          transportUsed:'BROADCAST_CHANNEL_SAME_ORIGIN_TAB'});
      };
    }

    // Read real hardware telemetry (Battery API + Network Information API + Navigator capabilities)
    const nav = window.navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
      connection?: { effectiveType?: string; downlink?: number; rtt?: number };
      bluetooth?: unknown;
    };

    const updateHw = async () => {
      let battPct: number | null = null;
      let battCharging: boolean | null = null;
      if (typeof nav.getBattery === 'function') {
        try {
          const b = await nav.getBattery();
          if(Number.isFinite(b.level)&&b.level>=0&&b.level<=1)battPct = Math.round(b.level * 100);
          if(typeof b.charging==='boolean')battCharging = b.charging;
        } catch {}
      }
      if(bootstrapEpoch!==queueEpochRef.current)return;
      setHwState({
        online: typeof nav.onLine==='boolean'?nav.onLine:null,
        batteryPct: battPct,
        charging: battCharging,
        netType: nav.connection?.effectiveType?.toUpperCase() || 'UNKNOWN',
        downlinkMbps: typeof nav.connection?.downlink === 'number' ? nav.connection.downlink : null,
        netRttMs: typeof nav.connection?.rtt === 'number' ? nav.connection.rtt : null,
        cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
        bluetoothApiAvailable: Boolean(nav.bluetooth),
        webrtcApiAvailable: typeof RTCPeerConnection !== 'undefined',
        webcryptoAvailable: Boolean(window.crypto?.subtle)
      });
    };
    updateHw();

    return () => {
      window.clearInterval(clockInterval);
      queueEpochRef.current += 1;
      inboxRef.current.clear();
      loopbackAbortRef.current?.abort();
      if (bc) bc.close();
      micRequestEpochRef.current += 1;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  const triggerRealSignedTransmission = async (statusType: 'SOS_EXPLICIT' | 'SAFE') => {
    if (!keyInfo || busyRef.current) return;
    busyRef.current=true;setBusy(true);
    const queueEpoch = queueEpochRef.current;
    loopbackAbortRef.current=new AbortController();
    setOperationStatus('SIGNING_LAB_PACKET');
    try {
      const pkt = await signAndPackRealOepPacket({
        privateKey:keyInfo.keyPair.privateKey,publicKeySpkiHex:keyInfo.publicKeySpkiHex,
        fingerprint:keyInfo.fingerprint,messageId:crypto.randomUUID(),status:statusType,
        zoneId:'LAB-SYNTHETIC',sectorIndex:0,batteryPct:hwState.batteryPct,timestampMs:Date.now()
      });
      if (queueEpoch !== queueEpochRef.current) return;
      const updatedQueue=[pkt,...queueRef.current.filter(p=>Date.now()<p.timestampMs+60000)].slice(0,8);
      queueRef.current=updatedQueue;setDurableQueue(updatedQueue);
      let storage='STORAGE_UNAVAILABLE';
      try {
        const serialized=JSON.stringify(updatedQueue);
        window.localStorage.setItem(STORAGE_KEY,serialized);
        if(window.localStorage.getItem(STORAGE_KEY)===serialized)storage='LOCAL_STORAGE_WRITTEN';
      }catch{/* Explicit status below; no durability claim when storage fails. */}
      let channel='BROADCAST_UNAVAILABLE';
      if(typeof BroadcastChannel!=='undefined'){
        try {const bc=new BroadcastChannel(CHANNEL_NAME);bc.postMessage(pkt);bc.close();channel='TAB_POSTED_UNCONFIRMED';}catch{}
      }
      const rtc=await sendWebRtcLoopbackPacket(pkt,{signal:loopbackAbortRef.current.signal});
      const ver=await verifyRealOepPacket(pkt);
      if (queueEpoch !== queueEpochRef.current) return;
      setLastPacket(assessPacketVerification(pkt,ver).packet);
      setVerifyState({valid:ver.valid,trustStatus:assessPacketVerification(pkt,ver).status,reason:ver.reason,
        verifyTimeMs:ver.verifyTimeMs,webrtcRttMs:rtc.delivered?rtc.rttMs:null,webrtcResult:rtc.reason,
        transportUsed:`WEBRTC_LOCAL_LOOPBACK_${rtc.reason} + ${channel} + ${storage}`});
      setOperationStatus(`${storage} · ${channel} · LAB_ONLY`);
    }catch{if(queueEpoch===queueEpochRef.current)setOperationStatus('SIGN_OR_TRANSPORT_FAILED');}
    finally{busyRef.current=false;setBusy(false);}
  };

  const clearDiskQueue = () => {
    queueEpochRef.current += 1; // Cancel pending signature/loopback UI writes.
    loopbackAbortRef.current?.abort();
    inboxRef.current.clear();
    queueRef.current=[];
    setDurableQueue([]);
    setLastPacket(null);
    setVerifyState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setOperationStatus(window.localStorage.getItem(STORAGE_KEY)===null?'LOCAL_PURGE_CONFIRMED':'PURGE_FAILED');
    } catch {setOperationStatus('PURGE_FAILED');}
  };

  const toggleLiveFftScanner = async () => {
    if (micActive) {
      micRequestEpochRef.current += 1;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      setMicActive(false);
      setFftProvenance(null);
      setFftBins(Array.from({ length: 32 }, () => 0));
      return;
    }
    if (micPendingRef.current) return;
    micPendingRef.current = true;
    const requestEpoch = ++micRequestEpochRef.current;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (requestEpoch !== micRequestEpochRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
      micStreamRef.current = stream;
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      setMicActive(true);
      let lastUpdate=0;
      const loop = () => {
        if (requestEpoch !== micRequestEpochRef.current) return;
        if(performance.now()-lastUpdate>=100){
          lastUpdate=performance.now();
          analyser.getByteFrequencyData(data);
          setFftBins(Array.from(data.slice(0, 32)).map((v) => Math.round((v / 255) * 100)));
          setFftProvenance({sampleRateHz:ctx!.sampleRate,timestamp:new Date().toISOString()});
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (ctx) void ctx.close().catch(() => {});
      if (requestEpoch === micRequestEpochRef.current) {
        micStreamRef.current = null;
        audioCtxRef.current = null;
        setMicActive(false);
        setFftBins(Array.from({ length: 32 }, () => 0));
      }
    } finally {
      micPendingRef.current = false;
    }
  };

  const liveOrbits = useMemo(() => computeLiveOrbitalEphemeris(utcNow), [utcNow]);
  const liveEnergyPolicy = useMemo(
    () => hwState.batteryPct === null ? null : energyPolicy(hwState.batteryPct, true),
    [hwState.batteryPct]
  );

  const copyPromptToClipboard = async (target: FundingTarget) => {
    const boundary=locale==='es'?'Redacta un borrador sujeto a verificación. OEP es un prototipo experimental: WebCrypto real, WebRTC solo loopback local, RF/CSI/satélites simulados o HARDWARE_REQUIRED; cero ensayos físicos verificados. No afirmes disponibilidad, elegibilidad, fechas, certificación, clientes ni financiación sin fuente actual. Verifica primero el portal oficial.':locale==='nl'?'Maak een te verifiëren concept. OEP is experimenteel: echte WebCrypto, WebRTC alleen lokale loopback, RF/CSI/satellieten gesimuleerd of HARDWARE_REQUIRED; nul geverifieerde fysieke proeven. Verifieer beschikbaarheid, voorwaarden, datums en financiering op het officiële portaal.':'Prepare a draft for verification. OEP is experimental: real WebCrypto, local WebRTC loopback only, RF/CSI/satellites simulated or HARDWARE_REQUIRED; zero verified physical trials. Verify availability, eligibility, dates, certification, customers and funding against current official sources.';
    try {
      if(!navigator.clipboard?.writeText)throw Error('CLIPBOARD_UNAVAILABLE');
      await navigator.clipboard.writeText(`${boundary}\n${target.name}\n${target.portalUrl}`);
    }catch{setOperationStatus('CLIPBOARD_UNAVAILABLE');return;}
    setCopiedId(target.id);
    window.setTimeout(() => setCopiedId((prev) => (prev === target.id ? null : prev)), 3500);
  };

  return (
    <section
      id="live-hardware-and-funding"
      className="oep-telecom-suite"
      data-testid="live-hardware-console"
      style={{ paddingTop: '2.5rem' }}
    >
      <div className="container">
        <div className="oep-ts-header">
          <p className="eyebrow">{c.eyebrow}</p>
          <h2>{c.title}</h2>
          <p>{c.lead}</p>
        </div>

        <div className="oep-ts-infra-layout" style={{ marginBottom: '2.5rem' }}>
          {/* PANEL 1: REAL WEBCRYPTO ECDSA-P256 + WEBRTC DATACHANNEL + LOCALSTORAGE */}
          <div className="oep-ts-panel">
            <h4>{c.cryptoTitle}</h4>
            <div className="oep-ts-kpi-grid">
              <div className="oep-ts-kpi">
                <span>WebCrypto Key</span>
                <strong style={{ color: '#6ee7b7' }}>
                  {keyInfo ? keyInfo.algorithm : 'GENERATING...'}
                </strong>
              </div>
              <div className="oep-ts-kpi">
                <span>Public Key SHA-256</span>
                <strong>{keyInfo ? keyInfo.fingerprint : '...'}</strong>
              </div>
              <div className="oep-ts-kpi">
                <span>WebRTC local loopback RTT</span>
                <strong style={{ color: '#38bdf8' }}>
                  {verifyState?.webrtcRttMs != null ? `${verifyState.webrtcRttMs} ms` : '—'}
                </strong>
              </div>
            </div>
            <p role="status" aria-live="polite" data-testid="webrtc-loopback-status">
              {locale === 'es'
                ? 'WebRTC: prueba local en este navegador, NO entrega a otro dispositivo.'
                : locale === 'nl'
                  ? 'WebRTC: lokale test in deze browser, GEEN aflevering op een ander apparaat.'
                  : 'WebRTC: local test inside this browser, NOT delivery to another device.'}
              {' '}{verifyState?.webrtcResult ?? 'NOT_TESTED'}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', marginBottom: '0.9rem' }}>
              <button
                type="button"
                data-testid="btn-live-ecdsa-sos"
                className="oep-ts-load-btn"
                style={{ marginTop: 0 }}
                disabled={busy || !keyInfo}
                onClick={() => triggerRealSignedTransmission('SOS_EXPLICIT')}
              >
                {c.signSosBtn}
              </button>
              <button
                type="button"
                data-testid="btn-live-ecdsa-safe"
                className="oep-ts-ar-btn"
                disabled={busy || !keyInfo}
                onClick={() => triggerRealSignedTransmission('SAFE')}
              >
                {c.signSafeBtn}
              </button>
              {(
                <button type="button" className="oep-ts-ar-btn is-live" onClick={clearDiskQueue}>
                  {c.clearDiskBtn} ({durableQueue.length})
                </button>
              )}
            </div>

            <p role="status" aria-live="polite">{operationStatus}</p>
            {verifyState && (
              <div className="oep-ts-hex-box" data-testid="live-ecdsa-packet-box">
                <div
                  role="status"
                  data-testid="live-ecdsa-verification-status"
                  style={{ color: verifyState.valid ? '#fbbf24' : '#fb7185', fontWeight: 700 }}
                >
                  STATUS: {verifyState.trustStatus} · {verifyState.reason} (Verify: {verifyState.verifyTimeMs}ms)
                </div>
                {lastPacket && (
                  <>
                    <div>
                      MSG: {lastPacket.messageId} ({lastPacket.status}) · TRANSPORT: {verifyState.transportUsed}
                    </div>
                    <div>24B OEP-NTN HEX: {lastPacket.binaryFrameHex} (CRC16: {lastPacket.crc16Hex})</div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                      REAL ECDSA-P256 SIGNATURE: {lastPacket.signatureHex.slice(0, 72)}...
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* PANEL 2: REAL DEVICE HARDWARE TELEMETRY + LIVE WEBAUDIO FFT */}
          <div className="oep-ts-panel">
            <h4>{c.hwTitle}</h4>
            <div className="oep-ts-kpi-grid">
              <div className="oep-ts-kpi">
                <span>Real Battery API</span>
                <strong>
                  {hwState.batteryPct !== null
                    ? `${hwState.batteryPct}% (${hwState.charging ? 'CHARGING' : 'BATTERY'})`
                    : 'OS PROTECTED (DEFAULT 75%)'}
                </strong>
              </div>
              <div className="oep-ts-kpi">
                <span>OEP Energy Profile</span>
                <strong style={{ color: '#6ee7b7' }}>{liveEnergyPolicy?.profile ?? 'UNKNOWN'}</strong>
              </div>
              <div className="oep-ts-kpi">
                <span>Real Network Interface</span>
                <strong>
                  {hwState.netType} {hwState.downlinkMbps ? `· ${hwState.downlinkMbps} Mbps` : ''}
                </strong>
              </div>
              <div className="oep-ts-kpi">
                <span>Measured Net RTT</span>
                <strong>{hwState.netRttMs !== null ? `${hwState.netRttMs} ms` : 'LOCAL'}</strong>
              </div>
              <div className="oep-ts-kpi">
                <span>CPU Cores / WebRTC</span>
                <strong>
                  {hwState.cores ?? '—'} Cores · {hwState.webrtcApiAvailable ? 'WebRTC OK' : 'No WebRTC'}
                </strong>
              </div>
              <div className="oep-ts-kpi">
                <span>WebBluetooth / Crypto</span>
                <strong>
                  {hwState.bluetoothApiAvailable ? 'BLE API OK' : 'BLE OS-Gated'} ·{' '}
                  {hwState.webcryptoAvailable ? 'HW Crypto OK' : '—'}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className={`oep-ts-ar-btn${micActive ? ' is-live' : ''}`}
              style={{ width: '100%', marginBottom: '0.75rem' }}
              onClick={toggleLiveFftScanner}
            >
              {micActive ? c.micBtnStop : c.micBtnStart}
            </button>

            <p role="status">{micActive?'LIVE_MEASUREMENT':'NO_SENSOR'} · WebAudio microphone analyser · relative byte amplitude % · confidence: UNCALIBRATED · {fftProvenance?`${fftProvenance.sampleRateHz} Hz sample rate / FFT 64 / ${fftProvenance.timestamp}`:'UNAVAILABLE'} · No RF, dBm or calibrated sound pressure.</p>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '3px',
                height: '64px',
                padding: '8px',
                background: '#05080d',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.25)'
              }}
            >
              {fftBins.map((val, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    height: `${Math.max(8, val)}%`,
                    background: idx > 22 ? '#34d399' : '#38bdf8',
                    borderRadius: '2px'
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* PANEL 3: REAL-TIME SATELLITE ORBITAL EPHEMERIDES */}
        <div className="oep-ts-block">
          <div className="oep-ts-block-head">
            <div>
              <h4>{c.orbTitle}</h4>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#7dd3fc' }}>
              UTC CLOCK: {new Date(utcNow).toISOString()}
            </span>
          </div>
          <p role="note">DEMO_ONLY · SIMULATED · {locale==='es'?'Sin elementos orbitales observados ni época de procedencia; incertidumbre desconocida. No predice pases ni conectividad.':locale==='nl'?'Geen waargenomen baanelementen of brondatum; onzekerheid onbekend. Geen voorspelling van passages of verbindingen.':'No observed orbital elements or source epoch; uncertainty unknown. Does not predict passes or connectivity.'}</p>
          <div className="oep-ts-fn-grid">
            {liveOrbits.map((orb) => (
              <div className="oep-ts-fn-card" key={orb.id}>
                <div className="oep-ts-fn-top">
                  <span>{orb.id}</span>
                  <span className="oep-ts-fn-status">EL {orb.elevationDeg.toFixed(1)}° · AZ {orb.azimuthDeg.toFixed(1)}°</span>
                </div>
                <strong style={{ fontSize: '0.92rem' }}>{orb.name}</strong>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#cbd5e1' }}>
                  <div>
                    DEMO Range: <strong>{orb.slantRangeKm.toFixed(1)} km</strong> · FSPL: <strong>{orb.fsplDb.toFixed(2)} dB</strong>
                  </div>
                  <div>
                    DEMO Doppler: <strong>{orb.dopplerShiftHz.toFixed(0)} Hz</strong> ·
                    DEMO Sub-Point: {orb.subLatDeg.toFixed(3)}°, {orb.subLonDeg.toFixed(3)}°
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL 4: REAL FUNDING OPPORTUNITIES & 1-CLICK CHATGPT PROPOSAL GENERATOR */}
        <div className="oep-ts-block" id="chatgpt-investor-deal-room">
          <div className="oep-ts-block-head">
            <div>
              <h3>{c.dealTitle}</h3>
              <p style={{ color: 'rgba(226, 236, 248, 0.85)', fontSize: '0.95rem', marginTop: '0.4rem' }}>
                {c.dealLead}
              </p>
            </div>
          </div>

          <div className="oep-ts-fn-grid">
            {targets.map((item) => (
              <article className="oep-ts-fn-card" key={item.id} data-testid={`funding-card-${item.id}`}>
                <div>
                  <div className="oep-ts-fn-top">
                    <span className="oep-ts-fn-status">UNVERIFIED · {item.badge}</span>
                  </div>
                  <h4>{item.name}</h4>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#6ee7b7', margin: '0.25rem 0' }}>
                    UNVERIFIED · {item.amount}
                  </p>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#fde68a', margin: '0.2rem 0 0.5rem' }}>
                    Deadline: UNVERIFIED · {item.deadline}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(226, 236, 248, 0.85)', lineHeight: 1.45 }}>
                    {item.fitSummary}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    data-testid={`copy-chatgpt-${item.id}`}
                    className="oep-ts-load-btn"
                    style={{ marginTop: 0 }}
                    onClick={() => copyPromptToClipboard(item)}
                  >
                    {copiedId === item.id ? c.copiedBadge : c.copyPromptBtn}
                  </button>
                  <a
                    href={item.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.76rem',
                      color: '#7dd3fc',
                      textDecoration: 'none'
                    }}
                  >
                    {c.openPortalBtn}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

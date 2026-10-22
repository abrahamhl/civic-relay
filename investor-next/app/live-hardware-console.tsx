'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from './copy';
import DeviceFieldDiagnostics from './device-field-diagnostics';
import {
  generateRealEcdsaKeyPair,
  signAndPackRealOepPacket,
  verifyRealOepPacket,
  computeLiveOrbitalEphemeris,
  type RealEcdsaKeyBundle,
  type SignedOepRealPacket
} from '../lib/live-protocol-node.mjs';
import { energyPolicy } from '../lib/emergency-policy.mjs';

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

// Public funding discovery, not a guarantee of eligibility, award, or acceptance.
// Only the dated NLnet and Horizon calls below have been checked against official sources.
// AI-generated NLnet submissions are prohibited under the 20 October 2026 policy.
const fundingCatalog = [
  { id: 'F01-NLNET', name: 'NLnet Restack — Open Internet Stack', amount: '€5,000–€50,000 (published programme range)', deadline: '3 November 2026, 12:00 CET', portalUrl: 'https://nlnet.nl/propose/', verified: true },
  { id: 'F02-HORIZON-CL3', name: 'Horizon Europe — HORIZON-CL3-2026-01-SSRI-04', amount: 'Project funding and eligible share: see official call', deadline: '5 November 2026 (official call)', portalUrl: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04', verified: true },
  { id: 'F03-NATO-DIANA', name: 'NATO DIANA — Accelerator', amount: 'Funding/eligibility: not independently verified for this cycle', deadline: 'Check current challenge / eligibility', portalUrl: 'https://www.diana.nato.int/', verified: false },
  { id: 'F04-EIC-ACCELERATOR', name: 'European Innovation Council — Accelerator', amount: 'Eligibility and TRL thresholds: check current programme', deadline: 'Check official cut-offs', portalUrl: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en', verified: false },
  { id: 'F05-GSMA-HUMANITARIAN', name: 'GSMA Innovation Fund', amount: 'No open call or grant amount verified here', deadline: 'Check official opening dates', portalUrl: 'https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma-innovation-fund/', verified: false },
  { id: 'F06-CDTI-NEOTEC-SPAIN', name: 'CDTI — NEOTEC (Spain)', amount: 'Spanish entity/eligibility and available funds: unverified', deadline: 'Check current official call', portalUrl: 'https://www.cdti.es/ayudas/neotec', verified: false },
  { id: 'F07-RVO-NETHERLANDS', name: 'RVO — WBSO / MIT (Netherlands)', amount: 'Conditional tax credit or SME support; not guaranteed cash', deadline: 'Check scheme-specific dates', portalUrl: 'https://www.rvo.nl/subsidies-financiering/wbso', verified: false },
  { id: 'F08-VC-DEEPTECH-SEED', name: 'European deep-tech / public-safety investors', amount: 'Exploratory outreach only; no investor interest confirmed', deadline: 'No public call verified', portalUrl: 'https://github.com/abrahamhl/civic-relay/issues/new?template=pilot-or-grant-partner.yml', verified: false }
] as const;
const fundingDescriptions: Record<Locale, string[]> = {
  es: [
    'Convocatoria abierta confirmada. NLnet v2.0 prohíbe usar IA generativa para redactar solicitudes y restringe su uso en el trabajo financiado. Revisar elegibilidad humana y técnica antes de solicitar.',
    'Plazo contrastado. La participación en consorcio, el encaje como socio y las condiciones de financiación requieren confirmación institucional.',
    'Exploración de programa dual-use; no existe verificación de una convocatoria adecuada abierta ni de un encaje aceptado.',
    'Posible vía futura de escalado; el prototipo no demuestra todavía la madurez comercial y técnica exigible.',
    'Programa potencialmente relacionado; financiación, fechas y criterios actuales aún sin confirmar.',
    'Potencialmente relevante solo con estructura jurídica y requisitos españoles adecuados; no se ha comprobado elegibilidad.',
    'WBSO es principalmente una ventaja fiscal para I+D elegible; MIT es un conjunto distinto de instrumentos con requisitos propios.',
    'Contactos y conversaciones con inversores no verificados. No se presentan compromisos, valoraciones ni rondas confirmadas.'
  ],
  en: [
    'Open deadline confirmed. NLnet policy v2.0 prohibits generative AI in writing applications and limits its use in funded work. Eligibility and human-authored submission must be checked.',
    'Deadline verified. Consortium participation, partner eligibility and funding terms require institutional confirmation.',
    'Potential dual-use programme only; an open suitable challenge and eligibility have not been verified.',
    'Possible later scaling route; this prototype has not demonstrated the required technical and commercial maturity.',
    'Potential thematic fit; current availability, budgets and eligibility remain unverified.',
    'Spanish legal entity and programme conditions may be required; project eligibility has not been established.',
    'WBSO is primarily conditional R&D tax relief; MIT is a separate set of support schemes with different criteria.',
    'Exploratory private outreach only. No investor commitments, valuations or funding rounds have been confirmed.'
  ],
  nl: [
    'Deadline bevestigd. NLnet-beleid v2.0 verbiedt generatieve AI bij het schrijven van aanvragen en beperkt AI-gebruik tijdens gefinancierd werk. Toelating en zelfstandig schrijven eerst verifiëren.',
    'Deadline bevestigd. Deelname aan een consortium, geschiktheid als partner en financieringsvoorwaarden moeten worden gecontroleerd.',
    'Mogelijk dual-use-programma; een passende open oproep en deelnamecriteria zijn niet bevestigd.',
    'Mogelijk later financieringspad; technische en commerciële rijpheid is nog niet aangetoond.',
    'Mogelijke thematische aansluiting; actuele financiering, deadlines en criteria zijn niet geverifieerd.',
    'Spaanse vestiging en regelingseisen kunnen nodig zijn; geschiktheid is nog niet vastgesteld.',
    'WBSO is vooral voorwaardelijke fiscale steun voor S&O; MIT kent andere instrumenten en eisen.',
    'Alleen verkennende benadering van investeerders. Geen toezeggingen, waarderingen of financieringsronde bevestigd.'
  ]
};
const diligencePrompt: Record<Locale, string> = {
  es: 'Prepara únicamente una lista de comprobación y un correo exploratorio, no una solicitud formal. Distingue código probado, simulación y ensayos físicos pendientes. No inventes certificaciones, alianzas, radio real, entregas entre teléfonos ni resultados de inversión. Exige contrastar los requisitos oficiales de ',
  en: 'Prepare a diligence checklist and exploratory outreach note only, not a completed application. Separate tested software, simulation and pending field trials. Never invent certifications, partnerships, actual radio delivery or funder approval. Verify official terms for ',
  nl: 'Maak alleen een due-diligence-checklist en verkennend bericht, geen definitieve aanvraag. Scheid geteste software, simulaties en nog te testen hardware. Verzín geen certificeringen, partners of fysieke radioresultaten. Controleer de officiële voorwaarden voor '
};
const fundingTargetsByLocale: Record<Locale, FundingTarget[]> = (['es','en','nl'] as const).reduce(
  (out, locale) => {
    out[locale] = fundingCatalog.map((target, index) => ({
      ...target,
      badge: target.verified ? (locale === 'es' ? 'PLAZO OFICIAL CONTRASTADO' : locale === 'nl' ? 'OFFICIËLE DEADLINE BEVESTIGD' : 'OFFICIAL DEADLINE VERIFIED') : (locale === 'es' ? 'OPCIÓN POR VALIDAR' : locale === 'nl' ? 'NOG TE CONTROLEREN' : 'ELIGIBILITY UNVERIFIED'),
      fitSummary: fundingDescriptions[locale][index],
      chatgptPrompt: target.id === 'F01-NLNET' ? '' : diligencePrompt[locale] + target.name + '. Source: ' + target.portalUrl + '. Civic Relay: https://github.com/abrahamhl/civic-relay (MIT, research prototype, no operational emergency system).'
    }));
    return out;
  }, {} as Record<Locale, FundingTarget[]>
);

const consoleCopy = {
  es: {
    eyebrow: '05 / CRIPTOGRAFÍA REAL EN NAVEGADOR Y ENSAYO WEBRTC LOCAL · INVESTIGACIÓN',
    title: 'NODO CRIPTOGRÁFICO WEBCRYPTO ECDSA P-256 REAL, CANAL P2P WEBRTC EN VIVO, HARDWARE DEL DISPOSITIVO Y CAMPAÑA DE FINANCIACIÓN',
    lead: 'Panel de laboratorio: firmas ECDSA P-256 en WebCrypto, demostración WebRTC dentro de la misma página y mensajes BroadcastChannel solo entre contextos del mismo origen. La persistencia localStorage no es una cola de emergencia ni garantiza protección o recuperación del contenido. No hay enlace entre móviles, satélites ni detección RF. Los modelos de órbitas son ilustrativos; los programas de financiación exigen comprobar bases y elegibilidad.',
    cryptoTitle: '1. Nodo Criptográfico ECDSA P-256 Real + Transporte P2P WebRTC / BroadcastChannel en Vivo',
    signSosBtn: 'FIRMAR TRAMA SOS (ECDSA P-256 REAL) Y ENVIAR POR WEBRTC + BUS P2P EN VIVO',
    signSafeBtn: 'FIRMAR TRAMA «ESTOY BIEN» (ECDSA P-256 REAL) Y PERSISTIR EN DISCO',
    clearDiskBtn: 'VACIAR COLA EN DISCO',
    hwTitle: '2. Telemetría Real del Hardware de Tu Dispositivo + Escáner Acústico/Ultrasónico FFT en Vivo',
    micBtnStart: 'ACTIVAR ESCÁNER ESPECTRAL ACÚSTICO / ULTRASÓNICO FFT EN VIVO (WEBAUDIO REAL)',
    micBtnStop: 'DETENER ESCÁNER ACÚSTICO FFT',
    orbTitle: '3. Efemérides Orbitales Satelitales en Tiempo Real (Sincronizadas con Reloj UTC Actual)',
    dealTitle: 'Oportunidades de financiación: estado y requisitos oficiales',
    dealLead: 'Se han contrastado las fechas de NLnet Restack y Horizon SSRI-04. Las otras seis opciones son líneas exploratorias, no financiación verificada. NLnet prohíbe la redacción de solicitudes mediante IA generativa; revisa su política antes de presentar.',
    copyPromptBtn: 'COPIAR CHECKLIST DE VERIFICACIÓN (NO SOLICITUD)',
    copiedBadge: '¡PROMPT COPIADO AL PORTAPAPELES! PÉGALO EN CHATGPT',
    openPortalBtn: 'ABRIR PORTAL OFICIAL ↗'
  },
  en: {
    eyebrow: '05 / REAL BROWSER CRYPTO AND LOCAL WEBRTC LOOPBACK · RESEARCH DEMO',
    title: 'REAL WEBCRYPTO ECDSA P-256 NODE, LIVE WEBRTC P2P DATA CHANNEL, REAL DEVICE HARDWARE TELEMETRY & FUNDING CAMPAIGN',
    lead: 'Research lab: WebCrypto ECDSA P-256 signing, same-page WebRTC loopback and BroadcastChannel between same-origin contexts only. localStorage is not a reliable or secure emergency message queue. No phone-to-phone delivery, satellite link or RF sensing is demonstrated. Orbital positions are illustrative models. Funding eligibility must be checked with official sources.',
    cryptoTitle: '1. Real WebCrypto ECDSA P-256 Node + Live WebRTC / BroadcastChannel P2P Transport',
    signSosBtn: 'SIGN SOS FRAME (REAL ECDSA P-256) & TRANSMIT OVER LIVE WEBRTC + P2P BUS',
    signSafeBtn: 'SIGN "SAFE" FRAME (REAL ECDSA P-256) & PERSIST TO DISK',
    clearDiskBtn: 'CLEAR DISK QUEUE',
    hwTitle: '2. Real Device Hardware Telemetry + Live WebAudio FFT Acoustic/Ultrasonic Scanner',
    micBtnStart: 'START LIVE FFT ACOUSTIC / ULTRASONIC SPECTRUM SCANNER (REAL WEBAUDIO)',
    micBtnStop: 'STOP FFT ACOUSTIC SCANNER',
    orbTitle: '3. Real-Time Satellite Orbital Ephemerides (Synchronized to Live UTC Clock)',
    dealTitle: 'Funding pathways: official calls and unverified leads',
    dealLead: 'The NLnet Restack and Horizon SSRI-04 deadlines have been cross-checked. Six other pathways are exploratory, not verified available funding. NLnet prohibits generative AI writing grant applications; review its current policy before applying.',
    copyPromptBtn: 'COPY DUE-DILIGENCE CHECKLIST (NOT AN APPLICATION)',
    copiedBadge: 'PROMPT COPIED TO CLIPBOARD! PASTE INTO CHATGPT',
    openPortalBtn: 'OPEN OFFICIAL PORTAL ↗'
  },
  nl: {
    eyebrow: '05 / ECHTE BROWSERCRYPTO EN LOKALE WEBRTC-LOOPBACK · ONDERZOEKSDEMO',
    title: 'ECHTE WEBCRYPTO ECDSA P-256 NODE, LIVE WEBRTC P2P-KANAAL, ECHTE APPARAATHARDWARE & FINANCIERINGSCAMPAGNE',
    lead: 'Onderzoekslab: WebCrypto ECDSA P-256-handtekeningen, lokale WebRTC-loopback op dezelfde pagina en BroadcastChannel tussen contexten van dezelfde oorsprong. localStorage is geen veilige of betrouwbare berichtenwachtrij voor noodsituaties. Geen bewezen verbinding tussen telefoons, satellietuplink of RF-detectie. Baanposities zijn illustratieve modellen. Controleer financieringsvoorwaarden bij de bron.',
    cryptoTitle: '1. Echte WebCrypto ECDSA P-256 Node + Live WebRTC / BroadcastChannel P2P-Transport',
    signSosBtn: 'ONDERTEKEN SOS-FRAME (ECHTE ECDSA P-256) & VERZEND VIA LIVE WEBRTC + P2P-BUS',
    signSafeBtn: 'ONDERTEKEN «VEILIG»-FRAME (ECHTE ECDSA P-256) & SLA OP SCHIJF OP',
    clearDiskBtn: 'WIS SCHIJFWACHTRIJ',
    hwTitle: '2. Echte Apparaathardware-Telemetrie + Live WebAudio FFT Akoestische Scanner',
    micBtnStart: 'START LIVE FFT AKOESTISCHE / ULTRASONE SPECTRUMSCANNER (ECHTE WEBAUDIO)',
    micBtnStop: 'STOP FFT AKOESTISCHE SCANNER',
    orbTitle: '3. Realtime Satelliet-Ephemeriden (Gesynchroniseerd met Live UTC-Klok)',
    dealTitle: 'Financieringsmogelijkheden: officiële oproepen en onbevestigde opties',
    dealLead: 'De deadlines voor NLnet Restack en Horizon SSRI-04 zijn gecontroleerd. Zes andere opties zijn verkennend en niet als open subsidie bevestigd. NLnet verbiedt generatieve AI bij het schrijven van aanvragen; lees hun actuele beleid.',
    copyPromptBtn: 'KOPIEER DUE-DILIGENCE-CHECKLIST (GEEN AANVRAAG)',
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
    reason: string;
    verifyTimeMs: number;
    webrtcRttMs: number | null;
    transportUsed: string;
  } | null>(null);
  const [durableQueue, setDurableQueue] = useState<SignedOepRealPacket[]>([]);
  const [msgCounter, setMsgCounter] = useState(1);

  // 2. Real Device Hardware Telemetry state
  const [hwState, setHwState] = useState<{
    online: boolean;
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
    online: true,
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
  const [micError, setMicError] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // 3. Real-time UTC clock for Orbital Ephemerides
  const [utcNow, setUtcNow] = useState<number>(1792569600000);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Transmit a packet over a real WebRTC RTCPeerConnection DataChannel loopback
  const sendOverRealWebRtcDataChannel = async (
    packet: SignedOepRealPacket
  ): Promise<{ rttMs: number; delivered: boolean }> => {
    if (typeof RTCPeerConnection === 'undefined') {
      return { rttMs: 0, delivered: false };
    }
    return new Promise((resolvePromise) => {
      const t0 = performance.now();
      const pc1 = new RTCPeerConnection();
      const pc2 = new RTCPeerConnection();
      let settled = false;
      const finish = (rtt: number, ok: boolean) => {
        if (settled) return;
        settled = true;
        try {
          pc1.close();
          pc2.close();
        } catch {}
        resolvePromise({ rttMs: Number(rtt.toFixed(2)), delivered: ok });
      };
      const timeout = window.setTimeout(() => finish(performance.now() - t0, false), 1200);

      pc1.onicecandidate = (e) => {
        if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {});
      };
      pc2.onicecandidate = (e) => {
        if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {});
      };
      pc2.ondatachannel = (ev) => {
        const rx = ev.channel;
        rx.onmessage = (msgEv) => {
          const parsed = JSON.parse(String(msgEv.data));
          if (parsed && parsed.messageId === packet.messageId) {
            window.clearTimeout(timeout);
            finish(performance.now() - t0, true);
          }
        };
      };

      const tx = pc1.createDataChannel('oep-emergency-d2d');
      tx.onopen = () => {
        tx.send(JSON.stringify(packet));
      };
      pc1
        .createOffer()
        .then((offer) => pc1.setLocalDescription(offer).then(() => pc2.setRemoteDescription(offer)))
        .then(() => pc2.createAnswer())
        .then((answer) => pc2.setLocalDescription(answer).then(() => pc1.setRemoteDescription(answer)))
        .catch(() => {
          window.clearTimeout(timeout);
          finish(performance.now() - t0, false);
        });
    });
  };

  // Bootstrap real WebCrypto ECDSA P-256 keypair, durable localStorage queue, BroadcastChannel, and Hardware APIs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUtcNow(Date.now());
    const clockInterval = window.setInterval(() => setUtcNow(Date.now()), 1000);

    // Load persisted queue from localStorage
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setDurableQueue(parsed);
      }
    } catch {}

    // Generate real ECDSA P-256 keypair and sign initial live packet
    generateRealEcdsaKeyPair()
      .then(async (bundle) => {
        setKeyInfo(bundle);
        const pkt = await signAndPackRealOepPacket({
          privateKey: bundle.keyPair.privateKey,
          publicKeySpkiHex: bundle.publicKeySpkiHex,
          fingerprint: bundle.fingerprint,
          messageId: 'MSG-LIVE-01',
          status: 'SOS_EXPLICIT',
          zoneId: 'ZONE-VLC-01',
          sectorIndex: 5,
          batteryPct: 82,
          timestampMs: Date.now()
        });
        setLastPacket(pkt);
        const ver = await verifyRealOepPacket(pkt);
        setVerifyState({
          valid: ver.valid,
          reason: ver.reason,
          verifyTimeMs: ver.verifyTimeMs,
          webrtcRttMs: null,
          transportUsed: 'WEBCRYPTO_ECDSA_P256 + LOCALSTORAGE_PERSISTED'
        });
      })
      .catch(() => {});

    // Listen on BroadcastChannel for real cross-tab P2P packets
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = async (ev) => {
        const incoming = ev.data as SignedOepRealPacket;
        if (incoming && incoming.protocol === 'OEP_REAL_EXECUTION_V1') {
          const ver = await verifyRealOepPacket(incoming);
          setLastPacket(incoming);
          setVerifyState({
            valid: ver.valid,
            reason: ver.reason,
            verifyTimeMs: ver.verifyTimeMs,
            webrtcRttMs: null,
            transportUsed: 'BROADCAST_CHANNEL_SAME_ORIGIN_CONTEXT_ONLY'
          });
        }
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
          battPct = Math.round(b.level * 100);
          battCharging = Boolean(b.charging);
        } catch {}
      }
      setHwState({
        online: Boolean(nav.onLine),
        batteryPct: battPct,
        charging: battCharging,
        netType: nav.connection?.effectiveType?.toUpperCase() || (nav.onLine ? 'CONNECTION_TYPE_UNKNOWN' : 'BROWSER_OFFLINE_FLAG'),
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
      if (bc) bc.close();
    };
  }, []);

  const triggerRealSignedTransmission = async (statusType: 'SOS_EXPLICIT' | 'SAFE') => {
    if (!keyInfo) return;
    const nextIdx = msgCounter + 1;
    setMsgCounter(nextIdx);
    const id = `MSG-LIVE-${String(nextIdx).padStart(2, '0')}`;
    const pkt = await signAndPackRealOepPacket({
      privateKey: keyInfo.keyPair.privateKey,
      publicKeySpkiHex: keyInfo.publicKeySpkiHex,
      fingerprint: keyInfo.fingerprint,
      messageId: id,
      status: statusType,
      zoneId: 'ZONE-VLC-01',
      sectorIndex: 5,
      batteryPct: hwState.batteryPct ?? 80,
      timestampMs: Date.now()
    });

    // 1. Persist to durable browser disk storage (localStorage)
    const updatedQueue = [pkt, ...durableQueue].slice(0, 8);
    setDurableQueue(updatedQueue);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
    } catch {}

    // 2. Broadcast over real BroadcastChannel to any open peer tabs
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(CHANNEL_NAME);
        bc.postMessage(pkt);
        bc.close();
      } catch {}
    }

    // 3. Transmit over real WebRTC RTCPeerConnection DataChannel & verify signature
    const rtc = await sendOverRealWebRtcDataChannel(pkt);
    const ver = await verifyRealOepPacket(pkt);
    setLastPacket(pkt);
    setVerifyState({
      valid: ver.valid,
      reason: ver.reason,
      verifyTimeMs: ver.verifyTimeMs,
      webrtcRttMs: rtc.rttMs,
      transportUsed: rtc.delivered ? 'WEBRTC_SAME_PAGE_LOOPBACK + BROADCAST_BUS + LOCALSTORAGE' : 'WEBRTC_LOOPBACK_NOT_CONFIRMED + BROADCAST_BUS + LOCALSTORAGE'
    });
  };

  const clearDiskQueue = () => {
    setDurableQueue([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const toggleLiveFftScanner = async () => {
    if (micActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((tr) => tr.stop());
        micStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setMicActive(false);
      return;
    }
    try {
      setMicError(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      setMicActive(true);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        setFftBins(Array.from(data.slice(0, 32)).map((v) => Math.max(4, Math.round((v / 255) * 100))));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // Fail closed: never show fabricated data as real microphone spectrum.
      setMicActive(false);
      setMicError(true);
      setFftBins(Array.from({ length: 32 }, () => 0));
    }
  };

  const liveOrbits = useMemo(() => computeLiveOrbitalEphemeris(utcNow), [utcNow]);
  const liveEnergyPolicy = useMemo(
    () => energyPolicy(hwState.batteryPct ?? 75, true),
    [hwState.batteryPct]
  );

  const copyPromptToClipboard = (target: FundingTarget) => {
    void navigator.clipboard?.writeText(target.chatgptPrompt);
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

        <DeviceFieldDiagnostics locale={locale} />

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
                <span>WebRTC same-page loopback RTT (lab only)</span>
                <strong style={{ color: '#38bdf8' }}>
                  {verifyState?.webrtcRttMs != null ? `${verifyState.webrtcRttMs} ms` : '—'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', marginBottom: '0.9rem' }}>
              <button
                type="button"
                data-testid="btn-live-ecdsa-sos"
                className="oep-ts-load-btn"
                style={{ marginTop: 0 }}
                onClick={() => triggerRealSignedTransmission('SOS_EXPLICIT')}
              >
                {c.signSosBtn}
              </button>
              <button
                type="button"
                data-testid="btn-live-ecdsa-safe"
                className="oep-ts-ar-btn"
                onClick={() => triggerRealSignedTransmission('SAFE')}
              >
                {c.signSafeBtn}
              </button>
              {durableQueue.length > 0 && (
                <button type="button" className="oep-ts-ar-btn is-live" onClick={clearDiskQueue}>
                  {c.clearDiskBtn} ({durableQueue.length})
                </button>
              )}
            </div>

            {lastPacket && (
              <div className="oep-ts-hex-box" data-testid="live-ecdsa-packet-box">
                <div style={{ color: '#6ee7b7', fontWeight: 700 }}>
                  STATUS: {verifyState?.reason} (Sign: {lastPacket.signTimeMs}ms · Verify:{' '}
                  {verifyState?.verifyTimeMs}ms)
                </div>
                <div>
                  MSG: {lastPacket.messageId} ({lastPacket.status}) · TRANSPORT: {verifyState?.transportUsed}
                </div>
                <div>24B OEP-NTN HEX: {lastPacket.binaryFrameHex} (CRC16: {lastPacket.crc16Hex})</div>
                <div style={{ color: '#cbd5e1', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                  REAL ECDSA-P256 SIGNATURE: {lastPacket.signatureHex.slice(0, 72)}...
                </div>
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
                    : 'N/A · BATTERY API UNAVAILABLE'}
                </strong>
              </div>
              <div className="oep-ts-kpi">
                <span>OEP Energy Profile</span>
                <strong style={{ color: '#6ee7b7' }}>{liveEnergyPolicy.profile}</strong>
              </div>
              <div className="oep-ts-kpi">
                <span>Real Network Interface</span>
                <strong>
                  {hwState.netType} {hwState.downlinkMbps ? `· ${hwState.downlinkMbps} Mbps` : ''}
                </strong>
              </div>
              <div className="oep-ts-kpi">
                <span>Network API estimated RTT (not ping)</span>
                <strong>{hwState.netRttMs !== null ? `${hwState.netRttMs} ms` : 'N/A'}</strong>
              </div>
              <div className="oep-ts-kpi">
                <span>CPU Cores / WebRTC</span>
                <strong>
                  {hwState.cores ?? '—'} Cores · {hwState.webrtcApiAvailable ? 'WebRTC OK' : 'No WebRTC'}
                </strong>
              </div>
              <div className="oep-ts-kpi">
                <span>Browser Bluetooth / WebCrypto APIs</span>
                <strong>
                  {hwState.bluetoothApiAvailable ? 'BLE API OK' : 'BLE OS-Gated'} ·{' '}
                  {hwState.webcryptoAvailable ? 'WebCrypto API OK' : '—'}
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

            {micError && <p role="alert" style={{ color: '#fde68a', marginBottom: '0.75rem' }}>{locale === 'es' ? 'Micrófono no disponible o permiso denegado. No se muestra ninguna lectura sintética.' : locale === 'nl' ? 'Microfoon niet beschikbaar of toestemming geweigerd. Geen synthetische meting getoond.' : 'Microphone unavailable or permission denied. No synthetic reading is displayed.'}</p>}
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
          <div className="oep-ts-fn-grid">
            {liveOrbits.map((orb) => (
              <div className="oep-ts-fn-card" key={orb.id}>
                <div className="oep-ts-fn-top">
                  <span>{orb.id}</span>
                  <span className="oep-ts-fn-status">EL {orb.elevationDeg}° · AZ {orb.azimuthDeg}°</span>
                </div>
                <strong style={{ fontSize: '0.92rem' }}>{orb.name}</strong>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#cbd5e1' }}>
                  <div>
                    Slant Range: <strong>{orb.slantRangeKm} km</strong> · FSPL: <strong>{orb.fsplDb} dB</strong>
                  </div>
                  <div>
                    Live Doppler: <strong>{orb.dopplerShiftHz >= 0 ? `+${orb.dopplerShiftHz}` : orb.dopplerShiftHz} Hz</strong> ·
                    Sub-Point: {orb.subLatDeg}°, {orb.subLonDeg}°
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
                    <span className="oep-ts-fn-status">{item.badge}</span>
                  </div>
                  <h4>{item.name}</h4>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#6ee7b7', margin: '0.25rem 0' }}>
                    {item.amount}
                  </p>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#fde68a', margin: '0.2rem 0 0.5rem' }}>
                    Deadline: {item.deadline}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(226, 236, 248, 0.85)', lineHeight: 1.45 }}>
                    {item.fitSummary}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.6rem' }}>
                  {item.id === 'F01-NLNET' ? (
                    <p role="note" style={{ fontSize: '0.79rem', color: '#fde68a', lineHeight: 1.5 }}>
                      NLnet (policy 20 October 2026): generative AI must not draft, translate, or edit the submitted proposal; AI-generated funded deliverables are not eligible. Verify eligibility and write independently. This is NOT an application submission.
                    </p>
                  ) : (
                  <button
                    type="button"
                    data-testid={`copy-chatgpt-${item.id}`}
                    className="oep-ts-load-btn"
                    style={{ marginTop: 0 }}
                    onClick={() => copyPromptToClipboard(item)}
                  >
                    {copiedId === item.id ? c.copiedBadge : c.copyPromptBtn}
                  </button>
                  )}
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

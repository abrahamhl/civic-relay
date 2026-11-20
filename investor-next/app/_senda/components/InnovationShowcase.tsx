'use client';

import { useState } from 'react';
import {
  Activity,
  Car,
  CheckCircle2,
  Compass,
  ExternalLink,
  Flame,
  Lightbulb,
  Radio,
  Satellite,
  ShieldAlert,
  TrainFront,
  Waves,
  Wrench
} from 'lucide-react';
import type { AudienceMode } from './AudienceLens';
import EvidenceBadge from './EvidenceBadge';
import MediaVideo, { type MediaVideoProps } from './MediaVideo';
import type { Locale, LocalizedText } from '../data/types';

type PillarId =
  | 'offline-mesh'
  | 'satellites-ntn'
  | 'osint-console'
  | 'rail-safety'
  | 'road-vision'
  | 'wildfire-3d'
  | 'floods-water'
  | 'seismic-rubble';

interface InnovationPillar {
  id: PillarId;
  num: string;
  title: LocalizedText;
  headline: LocalizedText;
  problem: LocalizedText;
  how: LocalizedText;
  innovation: LocalizedText;
  deterministicFact: LocalizedText;
  metrics: Array<{ val: string; lbl: LocalizedText }>;
  links: Array<{ href: string; label: LocalizedText }>;
  evidenceId: string;
  primaryVideo: Omit<MediaVideoProps, 'locale'>;
  extraVideos?: Array<Omit<MediaVideoProps, 'locale'>>;
}

const PILLARS: InnovationPillar[] = [
  {
    id: 'offline-mesh',
    num: '01',
    title: { es: 'Sin Red y Modo Avión', en: 'Offline Mesh & Airplane Mode', nl: 'Offline Mesh & Vliegtuigmodus' },
    headline: {
      es: 'Cuando las antenas caen, el mensaje sigue viajando de móvil a móvil y por sonido.',
      en: 'When cell towers fall, your sealed message hops across nearby phones and sound.',
      nl: 'Als zendmasten uitvallen, reist uw bericht door via telefoons en geluid.'
    },
    problem: {
      es: 'En el apagón ibérico del 28-04-2025 la conectividad estable cayó del 90 % al 40 % al agotarse las baterías de las torres. WhatsApp, Telegram y las llamadas mueren en el instante en que falla la red móvil.',
      en: 'During the April 2025 Iberian blackout, stable connectivity collapsed from 90% to 40% as tower batteries drained. Conventional messaging and calls die the second cellular coverage vanishes.',
      nl: 'Tijdens grote stroomuitval (zoals Spanje 2025: 90% → 40%) vallen WhatsApp, bellen en mobiele meldingen direct weg zodra zendmastaccu’s leegraken.'
    },
    how: {
      es: 'SENDA Campo abre en modo avión (PWA + IndexedDB), cifra el mensaje de extremo a extremo (ECDH P-256 + AES-GCM + firma ECDSA), lo divide en fragmentos k-de-n (Reed-Solomon) y compite en paralelo por Bluetooth LE, Wi-Fi Direct, LoRa, archivo .senda y módem acústico MFSK-16 por sonido.',
      en: 'SENDA Field opens in airplane mode (PWA + IndexedDB), seals messages with ECDH P-256 + AES-GCM + ECDSA, splits k-of-n Reed-Solomon shards, and races Bluetooth LE, Wi-Fi Direct, LoRa, .senda files, and MFSK-16 sound.',
      nl: 'SENDA Veld opent in vliegtuigmodus (PWA + IndexedDB), versleutelt met ECDH P-256 + AES-GCM, splitst k-van-n Reed-Solomon-fragmenten en verzendt parallel via BLE, Wi-Fi Direct, LoRa en MFSK-16 geluid.'
    },
    innovation: {
      es: 'Enrutamiento predictivo Contact Graph Routing (ARR_REPLAN_V2) que alcanza 94,2 % de entrega consumiendo un 84 % menos de batería que la difusión epidémica, más llamadas de voz sin Internet encadenadas entre móviles y recibos firmados que purgan automáticamente las copias en los relés ciegos.',
      en: 'Contact Graph Routing (ARR_REPLAN_V2) reaches 94.2% delivery while using 84% less battery than epidemic flooding, paired with chained zero-Internet voice calls and signed ACKs that purge blind relay queues.',
      nl: 'Contact Graph Routing (ARR_REPLAN_V2) haalt 94,2% bezorging met 84% lager accuverbruik, plus offline spraakketens en ondertekende ACK-purging.'
    },
    deterministicFact: {
      es: 'Verificado con 506/506 pruebas deterministas del núcleo y 49/49 comprobaciones reales en Chromium con conectividad totalmente cortada.',
      en: 'Verified across 506/506 deterministic core protocol tests and 49/49 real offline Chromium E2E assertions.',
      nl: 'Geverifieerd met 506/506 deterministische kerntests en 49/49 offline Chromium E2E-controles.'
    },
    metrics: [
      { val: '94,2 %', lbl: { es: 'Entrega ARR_REPLAN_V2', en: 'ARR_REPLAN_V2 delivery', nl: 'ARR_REPLAN_V2 bezorging' } },
      { val: '-84 % mJ', lbl: { es: 'Ahorro energético vs inundación', en: 'Energy saved vs flooding', nl: 'Energiebesparing' } },
      { val: '< 10 s', lbl: { es: 'Arranque llamada por sonido', en: 'Acoustic call setup', nl: 'Akoestische oproepopzet' } }
    ],
    links: [
      { href: '/senda/', label: { es: 'Abrir SENDA Campo (Modo Avión)', en: 'Open SENDA Field PWA', nl: 'Open SENDA Veld PWA' } },
      { href: '/senda/llamada.html', label: { es: 'Probar Módem Acústico y Voz', en: 'Try Acoustic & Voice Relay', nl: 'Probeer Akoestische Modem' } },
      { href: '/senda/reserva.html', label: { es: 'Batería de Internet Local', en: 'Local Internet Battery', nl: 'Lokale Internetbatterij' } }
    ],
    evidenceId: 'EV-OFFLINE-49',
    primaryVideo: {
      src: '/media/senda-demo/SENDA-demo-real-mensaje-sin-red.mp4',
      poster: '/media/senda-film-poster-es.jpg',
      title: 'Demo Real · Envío de mensaje cifrado en modo avión sin red',
      caption: 'Grabación directa de la app SENDA operando con conectividad cortada, cola local cifrada y salida alternativa.',
      evidenceId: 'EV-OFFLINE-49'
    },
    extraVideos: [
      {
        src: '/media/senda-capacidades-es.mp4',
        poster: '/media/m96/senda-m96-promo-poster.jpg',
        title: 'Demostración completa de capacidades SENDA (ES)',
        caption: 'Recorrido visual en tiempo real por los módulos sin red, fragmentos k-de-n, sonido y recibos firmados.',
        evidenceId: 'EV-CORE-506'
      }
    ]
  },
  {
    id: 'satellites-ntn',
    num: '02',
    title: { es: 'Satélites 3GPP NTN y Órbita', en: '3GPP NTN & Multi-Orbit Satellites', nl: '3GPP NTN & Satellieten' },
    headline: {
      es: 'Si no queda una sola torre en 100 km, SENDA comprime tu SOS en 24 bytes y lo sube a órbita.',
      en: 'When no cell tower survives within 100 km, SENDA packs your SOS into 24 bytes for orbital pickup.',
      nl: 'Zonder enige werkende zendmast comprimeert SENDA uw SOS in 24 bytes voor satellietoverdracht.'
    },
    problem: {
      es: 'En valles de montaña, zonas rurales o apagones regionales no existe ninguna antena terrestre viva durante horas. Además, los sistemas satelitales actuales son cerrados, caros o incompatibles entre operadores.',
      en: 'Rural valleys and regional blackouts leave zero terrestrial coverage for hours, while legacy satellite networks remain closed, expensive, and fragmented.',
      nl: 'In afgelegen valleien of bij grote uitval ontbreekt urenlang elk mobiel netwerk terwijl bestaande satellietdiensten gesloten zijn.'
    },
    how: {
      es: 'El motor orbital calcula en tiempo real la posición y elevación de 66 satélites Iridium LEO (780 km), 24 Galileo MEO (23.222 km) y QO-100 GEO (25,9° E), computa pérdidas FSPL y desplazamiento Doppler y empaqueta el estado crítico en una trama binaria OEP-NTN de 24 bytes con verificación CRC-16-CCITT.',
      en: 'Our orbital solver computes live elevation for 66 Iridium LEO (780 km), 24 Galileo MEO (23,222 km), and QO-100 GEO (25.9° E) satellites, compensates FSPL & Doppler shift, and packs alerts into a 24-byte OEP-NTN frame with CRC-16-CCITT.',
      nl: 'De orbitale engine berekent live 66 Iridium-, 24 Galileo- en QO-100-satellieten, compenseert FSPL en Doppler en verzendt 24-byte OEP-NTN frames met CRC-16-CCITT.'
    },
    innovation: {
      es: 'Arquitectura multi-órbita unificada (Direct-to-Cell 3GPP Rel-17/18 + Iridium RockBLOCK + Galileo SAR + QO-100) capaz de reducir tiempos de entrega en apagón de 480 min (8 h) a ~4 min multicanal.',
      en: 'Unified multi-orbit fabric (3GPP Rel-17/18 Direct-to-Cell + Iridium + Galileo SAR + QO-100) slashing outage delivery times from 480 min to ~4 min multipath.',
      nl: 'Geünificeerde multi-orbit laag die bezorgtijd bij 8 uur uitval terugbrengt van 480 min naar ~4 min.'
    },
    deterministicFact: {
      es: 'Balance de enlace 3GPP NTN y codificador binario de 24 bytes verificados por pruebas unitarias en lib/telecom-suite.mjs y visibles en vivo en Ojo de SENDA.',
      en: '3GPP NTN link budget and 24-byte binary encoder verified by automated tests in lib/telecom-suite.mjs and running live in SENDA Eye.',
      nl: '3GPP NTN-linkbudget en 24-byte frame-encoder volledig geverifieerd in lib/telecom-suite.mjs.'
    },
    metrics: [
      { val: '24 Bytes', lbl: { es: 'Trama binaria OEP-NTN', en: 'OEP-NTN binary frame', nl: 'OEP-NTN binair frame' } },
      { val: '91 Sats', lbl: { es: 'Iridium + Galileo + QO-100', en: 'Iridium + Galileo + QO-100', nl: 'Iridium + Galileo + QO-100' } },
      { val: '4 min', lbl: { es: 'Entrega vs 480 min celular', en: 'Delivery vs 480m baseline', nl: 'Bezorging vs 480m' } }
    ],
    links: [
      { href: '/senda/ojo.html', label: { es: 'Abrir Ojo de SENDA en Vivo', en: 'Launch Live SENDA Eye', nl: 'Open Oog van SENDA' } },
      { href: '/senda/red.html', label: { es: 'Red Satelital y Portadores', en: 'Satellite & Bearers Planner', nl: 'Satelliet- & Dragerplanner' } },
      { href: '#labs', label: { es: 'Simulador 3GPP NTN en Vivo', en: 'Live 3GPP NTN Simulator', nl: 'Live 3GPP NTN Simulator' } }
    ],
    evidenceId: 'EV-S01-ROUTE',
    primaryVideo: {
      src: '/media/senda-film-es.mp4',
      sources: { es: '/media/senda-film-es.mp4', en: '/media/senda-film-en.mp4' },
      posters: { es: '/media/senda-film-poster-es.jpg', en: '/media/senda-film-poster-en.jpg' },
      subtitles: { es: '/media/senda-film-es.vtt', en: '/media/senda-film-en.vtt', nl: '/media/senda-film-nl.vtt' },
      title: 'Documental Técnico SENDA · Satélites, Malla y Rescate Coordinado',
      caption: 'Audio automático según tu navegador (ES / EN) con subtítulos sincronizados ES / EN / NL.',
      evidenceId: 'EV-S01-ROUTE'
    },
    extraVideos: [
      {
        src: '/media/m95/senda-m95-90s-en.mp4',
        poster: '/media/m95/senda-m95-film-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-90s-es.vtt', en: '/media/m95/senda-m95-90s-en.vtt', nl: '/media/m95/senda-m95-90s-nl.vtt' },
        title: 'Resumen Ejecutivo 90 s (Subtítulos ES / EN / NL)',
        caption: 'Corte rápido de 90 segundos con las simulaciones orbitales y de enrutamiento del núcleo real.',
        evidenceId: 'EV-CORE-506'
      }
    ]
  },
  {
    id: 'osint-console',
    num: '03',
    title: { es: 'OSINT · 16.699 Fuentes · 112', en: 'OSINT · 16,699 Sources · 112', nl: 'OSINT · 16.699 Bronnen · 112' },
    headline: {
      es: 'Correlación OSINT en tiempo real con trazabilidad criptográfica lista para salas de coordinación.',
      en: 'Real-time OSINT correlation with cryptographic auditability engineered for coordination rooms.',
      nl: 'Realtime OSINT-correlatie met cryptografische traceerbaarheid voor meldkamers.'
    },
    problem: {
      es: 'En una gran catástrofe las salas de mando reciben alertas dispersas de tráfico, satélites, ríos, cámaras y redes sociales sin distinguir fuentes independientes de ecos repetidos ni mantener auditoría legal.',
      en: 'During major disasters, command rooms drown in fragmented road, satellite, river, and camera alerts without separating independent evidence from echoed reports.',
      nl: 'Tijdens rampen raken meldkamers overspoeld door losse bronnen zonder controle op brondubbeling of herleidbaarheid.'
    },
    how: {
      es: 'La Consola OSINT fusiona 16.699 elementos públicos fechados (GDACS, DGT, NDW, USGS, GOES-16, TfL, Caltrans y Copernicus) en 5 vistas (globo, nocturno, calor, columnas 3D y plano), añade matriz CCTV 1/4/9 con conos FOV haversianos, valida URLs contra SSRF y exporta avisos estándar CAP 1.2 con árbol de Merkle RFC 6962.',
      en: 'The OSINT Console fuses 16,699 dated public elements (GDACS, DGT, NDW, USGS, GOES-16, TfL, Caltrans, Copernicus) across 5 globe/heatmap views, adds a 1/4/9 CCTV FOV matrix with anti-SSRF guards, and exports CAP 1.2 with RFC 6962 Merkle audit trails.',
      nl: 'De OSINT Console fuseert 16.699 gedateerde openbare bronnen in 5 kaartweergaven, inclusief 1/4/9 CCTV FOV-matrix en CAP 1.2 export met Merkle-audit.'
    },
    innovation: {
      es: 'Regla científica innegociable: la capa observacional (cámaras/satélite) nunca se mezcla con el consentimiento humano, la ausencia de respuesta siempre es UNKNOWN (jamás víctima automática) y el grafo causal controla fuentes compartidas.',
      en: 'Strict epistemic separation: observational cameras/satellites never fabricate human SOS, silence always stays UNKNOWN, and causal DAG fusion filters shared-source echoes.',
      nl: 'Strikte scheiding tussen observatie en menselijke meldingen: stilte blijft altijd UNKNOWN en causale fusie filtert brondubbeling.'
    },
    deterministicFact: {
      es: '16.699 elementos públicos reales indexados en la consola, exportación CAP 1.2 + registro hash verificable en /senda/consola.html y /senda/organismo.html.',
      en: '16,699 dated public elements indexed in /senda/consola.html with hash-chained CAP 1.2 coordination in /senda/organismo.html.',
      nl: '16.699 openbare bronnen geïndexeerd in /senda/consola.html met CAP 1.2 coördinatie.'
    },
    metrics: [
      { val: '16.699', lbl: { es: 'Elementos públicos fusionados', en: 'Fused public elements', nl: 'Gefuseerde openbare bronnen' } },
      { val: 'CAP 1.2', lbl: { es: 'Estándar internacional 112', en: 'International 112 standard', nl: 'Internationale 112-standaard' } },
      { val: 'RFC 6962', lbl: { es: 'Auditoría Merkle inmutable', en: 'Immutable Merkle audit', nl: 'Onveranderlijke Merkle-audit' } }
    ],
    links: [
      { href: '/senda/consola.html', label: { es: 'Abrir Consola OSINT 16.699', en: 'Open 16,699 OSINT Console', nl: 'Open OSINT Console' } },
      { href: '/senda/organismo.html', label: { es: 'Coordinación con Firma 112', en: 'Signed Agency Coordination', nl: 'Ondertekende Coördinatie' } },
      { href: '#osint-cctv', label: { es: 'Ver Matriz CCTV y 8 Etapas', en: 'Jump to CCTV & 8-Stage OSINT', nl: 'Bekijk CCTV & 8-Staps OSINT' } }
    ],
    evidenceId: 'EV-CONSOLE-16K',
    primaryVideo: {
      src: '/media/senda-demo/SENDA-consola-promo.mp4',
      poster: '/media/m95/senda-m95-broadcast-special-poster.jpg',
      title: 'Demo Real · Consola OSINT SENDA de 16.699 fuentes en 5 vistas',
      caption: 'Visualización directa del globo operativo, mapas de calor, columnas 3D y correlación multifuente.',
      evidenceId: 'EV-CONSOLE-16K'
    },
    extraVideos: [
      {
        src: '/media/senda-demo/SENDA-plataforma-promo.mp4',
        poster: '/media/senda-film-poster-en.jpg',
        title: 'Promo Plataforma Operativa SENDA',
        caption: 'Integración de consola de situación, mensajería sin red y coordinación interagencia.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        src: '/media/senda-demo/SENDA-demo-real-avisos-centro.mp4',
        poster: '/media/m95/senda-m95-broadcast-special-poster.jpg',
        title: 'Demo Real · Centro de Coordinación y Avisos Firmados',
        caption: 'Flujo completo de emisión de alerta firmada, recepción y cuadro operativo por organismo.',
        evidenceId: 'EV-CORE-506'
      },
      {
        src: '/media/senda-demo/SENDA-demo-guiada.mp4',
        poster: '/media/m96/senda-m96-promo-poster.jpg',
        title: 'Demo Guiada Completa de la Interfaz',
        caption: 'Recorrido paso a paso por las pantallas reales de operación de SENDA.',
        evidenceId: 'EV-CORE-506'
      }
    ]
  },
  {
    id: 'rail-safety',
    num: '04',
    title: { es: 'Seguridad Ferroviaria España', en: 'Rail Safety Physics (Spain)', nl: 'Spoorveiligheid & Fysica' },
    headline: {
      es: 'Detección multi-tren en segundos, ondas ultrasónicas a 5.100 m/s y rescate en túnel sin cobertura.',
      en: 'Multi-train crash separation in seconds, 5,100 m/s guided rail waves & zero-coverage tunnel beacons.',
      nl: 'Meer-trein botsingsdetectie, 5.100 m/s ultrasone spoorgolven & tunnelbakens zonder dekking.'
    },
    problem: {
      es: 'Accidentes ferroviarios documentados en España y Europa (Angrois, Adamuz, Gelida, Tempi, Balasore) revelan fallos críticos: descarrilamientos sin cobertura en trincheras/túneles, roturas de carril, pandeo térmico por calor extremo y retraso en saber cuántos convoyes están implicados.',
      en: 'Documented European rail tragedies (Angrois, Adamuz, Gelida, Tempi) expose critical blind spots: zero coverage in tunnels/cuttings, rail cracks, thermal sun kinks, and delayed multi-train identification.',
      nl: 'Europese spoorongevallen tonen kritieke blinde vlekken: geen dekking in tunnels, railbreuken, thermische spoorvervorming en vertraagde alarmering.'
    },
    how: {
      es: 'Cinco motores físicos integrados: (1) fusión de acelerómetros de pasajeros para separar dos trenes en segundos, (2) pandeo térmico Kerr en carriles soldados, (3) ondas ultrasónicas guiadas a 5.100 m/s para roturas de carril, (4) aviso C-ITS T2V directo a coches en pasos a nivel y (5) baliza BLE + LoRa + acústica que puentea el SOS hasta coches en la carretera cercana.',
      en: 'Five integrated physics engines: (1) passenger IMU clustering separating multiple trains in seconds, (2) Kerr thermal buckling solver, (3) 5,100 m/s ultrasonic guided waves for rail breaks, (4) T2V level-crossing alerts, and (5) BLE + LoRa + acoustic tunnel beacon bridged by nearby cars.',
      nl: 'Vijf fysicamodules: passagiers-IMU-fusie, Kerr thermische knik, 5.100 m/s geleide ultrasone golven, T2V-overwegen en een multimodaal tunnelbaken.'
    },
    innovation: {
      es: 'Puente multimodal Tren → Coche → 112: cuando un tren queda aislado en una trinchera sin cobertura, los coches que circulan por la carretera paralela recogen la ráfaga cifrada y la entregan al 112 en menos de 90 segundos.',
      en: 'Cross-modal Train → Passing Car → 112 bridge: when a derailed train sits in a zero-coverage cutting, cars passing on nearby roads carry the sealed alert to 112 in under 90 seconds.',
      nl: 'Trein → Passerend Voertuig → 112 brug: voorbijrijdende auto’s brengen een afgesloten treinmelding binnen 90 seconden naar 112.'
    },
    deterministicFact: {
      es: 'Motor ferroviario completo ejecutable en vivo en RailSafetyLab (#labs), /senda/incidente.html y /senda/via.html con topología documentada en render-rail-safety-topology.svg.',
      en: 'Full five-module rail physics engine live in RailSafetyLab (#labs), /senda/incidente.html, and /senda/via.html.',
      nl: 'Volledige vijfdelige spoorveiligheidsengine live in RailSafetyLab (#labs) en /senda/incidente.html.'
    },
    metrics: [
      { val: '5.100 m/s', lbl: { es: 'Onda ultrasónica en acero', en: 'Ultrasonic rail wave speed', nl: 'Ultrasone golfsnelheid' } },
      { val: '< 90 s', lbl: { es: 'Rescate puente Tren-Coche-112', en: 'Train-Car-112 relay target', nl: 'Trein-Auto-112 doel' } },
      { val: '5 módulos', lbl: { es: 'Física ferroviaria interactiva', en: 'Interactive rail physics labs', nl: 'Interactieve spoormodules' } }
    ],
    links: [
      { href: '/senda/incidente.html', label: { es: 'Abrir Fusión Multi-Tren', en: 'Open Multi-Train Fusion', nl: 'Open Spoorincidentfusie' } },
      { href: '/senda/via.html', label: { es: 'Vigilancia de Vía y Muros', en: 'Track & Embankment Watch', nl: 'Spoor- & Dijkbewaking' } },
      { href: '#labs', label: { es: 'Probar Laboratorio Ferroviario', en: 'Launch Rail Safety Lab', nl: 'Start Spoorveiligheidslab' } }
    ],
    evidenceId: 'EV-RAIL-ADAMUZ',
    primaryVideo: {
      src: '/media/m95/senda-m95-sim-proof-en.mp4',
      poster: '/media/m95/senda-m95-ruta-poster.jpg',
      subtitles: { es: '/media/m95/senda-m95-sim-proof-es.vtt', en: '/media/m95/senda-m95-sim-proof-en.vtt', nl: '/media/m95/senda-m95-sim-proof-nl.vtt' },
      title: 'Simulación · Prueba Criptográfica PCI y Coordinación Verificable',
      caption: 'Cómo cada aviso de emergencia lleva prueba criptográfica verificable extremo a extremo.',
      evidenceId: 'EV-RAIL-ADAMUZ'
    }
  },
  {
    id: 'road-vision',
    num: '05',
    title: { es: 'Carretera, DGT/NDW y YOLOX', en: 'Roads, DGT/NDW & YOLOX Vision', nl: 'Wegen, DGT/NDW & YOLOX Visie' },
    headline: {
      es: 'Ruta protectora en carretera, radar Doppler V2I y visión artificial vial sin guardar jamás una matrícula.',
      en: 'Protective highway routing, 24/77 GHz V2I Doppler gateways & privacy-first YOLOX road vision.',
      nl: 'Beschermende snelwegroute, V2I Doppler-gateways & kentekenvrije YOLOX-verkeersvisie.'
    },
    problem: {
      es: 'Colisiones múltiples por niebla densa (como la A-12 en Países Bajos), vehículos en sentido contrario, accidentes en carreteras secundarias sin señal y atascos mortales durante evacuaciones.',
      en: 'Dense-fog pileups (such as the Dutch A-12), wrong-way drivers, rural crashes without mobile coverage, and fatal evacuation gridlocks.',
      nl: 'Kettingbotsingen bij dichte mist (zoals de A12), spookrijders, ongevallen zonder dekking en vastlopende evacuaties.'
    },
    how: {
      es: 'Combina frenada brusca cooperativa, SOS vehicular DTN llevado por coches que pasan, pórticos radar V2I 0-RTT (24/77 GHz), visibilidad Koschmieder medida en cámaras públicas, tráfico por celdas con filtro de Kalman LWR, balizas V16 bajo estándar europeo DATEX II y detección YOLOX-s + ByteTrack ejecutada en local.',
      en: 'Unifies cooperative hard-braking alerts, passing-car DTN SOS relays, 0-RTT 24/77 GHz V2I gantry gateways, Koschmieder fog measurement on public cameras, Kalman LWR queue forecasting, DATEX II V16 beacons, and edge YOLOX-s + ByteTrack vision.',
      nl: 'Verenigt noodremwaarschuwingen, voertuig-DTN, 0-RTT V2I-portalen, mistmeting op openbare camera’s, Kalman-filevoorspelling, DATEX II en lokale YOLOX-s verkeersvisie.'
    },
    innovation: {
      es: 'Privacidad matemática en vídeo real: YOLOX-s + ByteTrack cuenta flujos, distancias y tiempos de alcance en tiempo real y exporta únicamente números — nunca rostros, nunca matrículas ni vídeo a la nube.',
      en: 'Privacy-by-design road vision: YOLOX-s + ByteTrack extracts vehicle counts, spacing, and closing times on-device, outputting numbers only — zero faces, zero plates.',
      nl: 'Privacyvriendelijke wegvisie: YOLOX-s + ByteTrack levert uitsluitend verkeerscijfers zonder ooit kentekens of gezichten op te slaan.'
    },
    deterministicFact: {
      es: '6 simulaciones viales físicas + 2 vídeos reales anotados con YOLOX-s y ByteTrack + corredor piloto A12 Arnhem–Ede (Países Bajos) y red DGT 3.0 (España).',
      en: '6 physical road simulations + 2 real YOLOX-s/ByteTrack annotated videos + A12 Arnhem–Ede (NL) and DGT 3.0 (ES) corridor readiness.',
      nl: '6 fysieke wegsimulaties + 2 echte YOLOX-video’s + A12 Arnhem–Ede & DGT 3.0 integratie.'
    },
    metrics: [
      { val: '0-RTT', lbl: { es: 'Ráfaga V2I sin IP lenta', en: 'Zero-RTT V2I gantry burst', nl: '0-RTT V2I portaalpuls' } },
      { val: 'DATEX II', lbl: { es: 'Estándar común ES + NL', en: 'Shared EU ES + NL standard', nl: 'Europese ES + NL standaard' } },
      { val: '0 placas', lbl: { es: 'Visión YOLOX 100 % privada', en: '100% plate-free YOLOX', nl: '100% kentekenvrije YOLOX' } }
    ],
    links: [
      { href: '/senda/carretera.html', label: { es: 'Abrir Ruta Protectora', en: 'Open Protective Route', nl: 'Open Beschermende Route' } },
      { href: '/senda/trafico.html', label: { es: 'Visión YOLOX en Vídeo Real', en: 'YOLOX Traffic Vision', nl: 'YOLOX Verkeersvisie' } },
      { href: '/senda/paises.html', label: { es: 'Corredor España → Países Bajos', en: 'Spain -> Netherlands DATEX II', nl: 'Spanje -> Nederland DATEX II' } }
    ],
    evidenceId: 'EV-CONSOLE-16K',
    primaryVideo: {
      src: '/media/senda-ruta-es.mp4',
      sources: { es: '/media/senda-ruta-es.mp4', en: '/media/senda-ruta-en.mp4' },
      posters: { es: '/media/senda-ruta-poster-es.jpg', en: '/media/senda-ruta-poster-en.jpg' },
      subtitles: { es: '/media/senda-ruta-es.vtt', en: '/media/senda-ruta-en.vtt', nl: '/media/senda-ruta-nl.vtt' },
      title: 'En la Carretera · Ruta Protectora, Cámaras, DGT y Países Bajos',
      caption: 'Audio automático según tu navegador (ES / EN) con subtítulos ES / EN / NL.',
      evidenceId: 'EV-CONSOLE-16K'
    },
    extraVideos: [
      {
        src: '/media/vision/dashcam.mp4',
        poster: '/media/vision/dashcam-poster.jpg',
        title: 'Visión Real YOLOX-s + ByteTrack · Cámara en Movimiento (Dashcam)',
        caption: 'Detección, seguimiento y cálculo de distancias y cruces en tiempo real sin matrículas.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        src: '/media/vision/fixed.mp4',
        poster: '/media/vision/fixed-poster.jpg',
        title: 'Visión Real YOLOX-s + ByteTrack · Cámara Fija de Autovía',
        caption: 'Conteo direccional y velocidad de flujo en tiempo real sobre cámara vial fija.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        src: '/media/m95/senda-m95-sim-braking-en.mp4',
        poster: '/media/m95/senda-m95-ruta-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-sim-braking-es.vtt', en: '/media/m95/senda-m95-sim-braking-en.vtt', nl: '/media/m95/senda-m95-sim-braking-nl.vtt' },
        title: 'Simulación Vial 1 · Frenada Brusca sin Línea Visual',
        caption: 'Propaga la alerta de frenada a vehículos posteriores antes de que puedan ver el peligro.',
        evidenceId: 'EV-CORE-506'
      },
      {
        src: '/media/m95/senda-m95-sim-sos-en.mp4',
        poster: '/media/m95/senda-m95-ruta-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-sim-sos-es.vtt', en: '/media/m95/senda-m95-sim-sos-en.vtt', nl: '/media/m95/senda-m95-sim-sos-nl.vtt' },
        title: 'Simulación Vial 2 · SOS sin Cobertura Llevado por Coches (DTN)',
        caption: 'Un coche averiado en zona sin señal entrega su SOS al primer vehículo que pasa en sentido contrario.',
        evidenceId: 'EV-S01-ROUTE'
      },
      {
        src: '/media/m95/senda-m95-sim-wrongway-en.mp4',
        poster: '/media/m95/senda-m95-ruta-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-sim-wrongway-es.vtt', en: '/media/m95/senda-m95-sim-wrongway-en.vtt', nl: '/media/m95/senda-m95-sim-wrongway-nl.vtt' },
        title: 'Simulación Vial 3 · Vehículo en Sentido Contrario',
        caption: 'Detección y aviso anticipado a los conductores que se aproximan por el mismo corredor.',
        evidenceId: 'EV-CORE-506'
      },
      {
        src: '/media/m95/senda-m95-sim-queue-en.mp4',
        poster: '/media/m95/senda-m95-ruta-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-sim-queue-es.vtt', en: '/media/m95/senda-m95-sim-queue-en.vtt', nl: '/media/m95/senda-m95-sim-queue-nl.vtt' },
        title: 'Simulación Vial 4 · Cola de Evacuación (Kalman LWR)',
        caption: 'Predice atascos minutos antes en evacuaciones masivas para desviar el tráfico a tiempo.',
        evidenceId: 'EV-CONSOLE-16K'
      },
      {
        src: '/media/m95/senda-m95-sim-visibility-en.mp4',
        poster: '/media/m95/senda-m95-ruta-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-sim-visibility-es.vtt', en: '/media/m95/senda-m95-sim-visibility-en.vtt', nl: '/media/m95/senda-m95-sim-visibility-nl.vtt' },
        title: 'Simulación Vial 5 · Niebla y Visibilidad Koschmieder',
        caption: 'Mide distancia visual real en cámaras públicas y ajusta la velocidad de aviso al corredor.',
        evidenceId: 'EV-CONSOLE-16K'
      }
    ]
  },
  {
    id: 'wildfire-3d',
    num: '06',
    title: { es: 'Incendios 3D (SENDA-3D)', en: '3D Wildfire Physics (SENDA-3D)', nl: '3D Natuurbrandfysica' },
    headline: {
      es: 'Viento 3D sobre relieve real, pluma de humo Briggs y aviso antes de que el fuego queme la antena.',
      en: 'Mass-consistent 3D mountain wind, Briggs smoke plumes & evacuation warnings before masts burn.',
      nl: '3D-bergwind, Briggs-rookpluimen & waarschuwingen voordat vuur zendmasten uitschakelt.'
    },
    problem: {
      es: 'En incendios rápidos de sierra y Mediterráneo, el fuego y el humo cortan las torres de telefonía y ciegan las carreteras justo cuando los vecinos necesitan saber por qué lado evacuar.',
      en: 'Fast-moving mountain wildfires sever cell towers and blind evacuation roads right when rural towns need safe escape corridors.',
      nl: 'Snelle natuurbranden schakelen zendmasten uit en blokkeren vluchtwegen juist op het moment van evacuatie.'
    },
    how: {
      es: 'SENDA-3D combina relieve Copernicus DEM GLO-30, satélite Sentinel-2, meteorología sinóptica GFS, solver de viento 3D con conservación de masa, pluma convectiva Briggs, oclusión visual de cámaras y telemetría meteorológica recogida por coches en ruta.',
      en: 'SENDA-3D pairs Copernicus DEM GLO-30 topography, Sentinel-2 burn scars, GFS weather, a mass-consistent 3D wind solver, Briggs plume rise, camera line-of-sight occlusion, and fleet weather sensors.',
      nl: 'SENDA-3D combineert Copernicus DEM, Sentinel-2, GFS-weer, een massaconsistente 3D-windsolver, Briggs-pluim en vloot-meteorologie.'
    },
    innovation: {
      es: 'Cruza la propagación física del incendio con el mapa de torres móviles para calcular la hora exacta de caída celular de cada pueblo y activar antes el enrutamiento alternativo, documentado en paper científico formal y 14 incendios reales NOAA.',
      en: 'Crosses wildfire spread with cell-tower footprints to forecast exact blackout minutes per village and pre-trigger alternate routing — backed by a formal paper and 14 NOAA reference fires.',
      nl: 'Koppelt brandvoortgang aan zendmasten voor exacte uitvalprognoses per dorp — onderbouwd met 14 NOAA-referentiebranden.'
    },
    deterministicFact: {
      es: 'Paper formal SENDA-3D (/senda/paper.html), 14 incendios de referencia (/senda/referencias.html) y motor 3D interactivo (/senda/fuego3d.html).',
      en: 'Formal SENDA-3D paper (/senda/paper.html), 14 reference wildfires (/senda/referencias.html), and interactive 3D engine (/senda/fuego3d.html).',
      nl: 'Formeel SENDA-3D paper, 14 referentiebranden en interactieve 3D-engine (/senda/fuego3d.html).'
    },
    metrics: [
      { val: '14', lbl: { es: 'Incendios reales documentados', en: 'Documented reference fires', nl: 'Gedocumenteerde branden' } },
      { val: 'DEM 3D', lbl: { es: 'Viento con conservación de masa', en: 'Mass-consistent 3D wind', nl: 'Massaconsistente 3D-wind' } },
      { val: 'Sentinel-2', lbl: { es: 'Validación cicatriz dNBR', en: 'dNBR burn-scar validation', nl: 'dNBR brandvalidatie' } }
    ],
    links: [
      { href: '/senda/fuego3d.html', label: { es: 'Abrir Motor Incendios 3D', en: 'Launch SENDA-3D Wildfire', nl: 'Start SENDA-3D' } },
      { href: '/senda/incendio.html', label: { es: 'Incendio y Caída de Antenas', en: 'Fire vs Cell Masts', nl: 'Brand vs Zendmasten' } },
      { href: '/senda/paper.html', label: { es: 'Leer Paper Científico SENDA-3D', en: 'Read SENDA-3D Paper', nl: 'Lees SENDA-3D Paper' } }
    ],
    evidenceId: 'EV-FIRE-SMV',
    primaryVideo: {
      src: '/media/senda-demo/SENDA-demo-real-incendio-3d.mp4',
      poster: '/media/senda-film-poster-es.jpg',
      title: 'Demo Real · SENDA-3D Incendio San Martín de Valdeiglesias',
      caption: 'Simulación 3D sobre terreno real Copernicus DEM GLO-30 con pluma de humo, viento y cicatriz Sentinel-2.',
      evidenceId: 'EV-FIRE-SMV'
    },
    extraVideos: [
      {
        src: '/media/senda-demo/SENDA-demo-real-atlas.mp4',
        poster: '/media/senda-ruta-poster-es.jpg',
        title: 'Demo Real · Atlas de Riesgos y Cartografía Operativa',
        caption: 'Exploración cartográfica de peligros, perímetros y rutas seguras.',
        evidenceId: 'EV-FIRE-SMV'
      }
    ]
  },
  {
    id: 'floods-water',
    num: '07',
    title: { es: 'Riadas DANA, Nepal y Agua NL', en: 'Valencia Floods, Nepal & NL Water', nl: 'DANA, Nepal & Water NL' },
    headline: {
      es: 'Detectamos qué calles secas quedan atrapadas por agua y cuántas horas tarda la onda de crecida.',
      en: 'Maps every dry street trapped by floodwater and tracks river flood-wave arrival hours ahead.',
      nl: 'Brengt ingesloten droge straten in kaart en meet watergolf-reistijden uren vooruit.'
    },
    problem: {
      es: 'En la DANA de Valencia (29-10-2024, ES-Alert a las 20:11) y en las riadas y deslizamientos de Indonesia y Nepal, miles de personas quedaron en zonas secas rodeadas de agua o valles cortados sin saber por dónde salir ni cómo avisar.',
      en: 'During the Valencia DANA floods and monsoon landslides in Indonesia and Nepal, thousands were trapped in dry pockets surrounded by water or cut-off mountain valleys with zero road exit.',
      nl: 'Bij de overstromingen in Valencia, Indonesië en Nepal raakten duizenden mensen op droge eilandjes of in afgesloten valleien geïsoleerd.'
    },
    how: {
      es: 'Cruza OpenStreetMap con la huella real de agua Copernicus EMSR773 usando Dijkstra multi-origen (489,5 km anegados, 1.326 cruces secos aislados); en Nepal combina catálogo USGS M 5,2 + cambio NDVI Sentinel-2 + DEM GLO-30 en sobrevuelo 3D; en Países Bajos procesa 25 estaciones reales Rijkswaterstaat (marea M2 y onda Lobith → Nimega en 5 h, r = 0,94).',
      en: 'Crosses OpenStreetMap with Copernicus EMSR773 flood polygons via multi-origin Dijkstra (489.5 km flooded, 1,326 isolated junctions); in Nepal fuses USGS M 5.2 + Sentinel-2 NDVI + DEM GLO-30 3D flyover; in the Netherlands analyzes 25 real Rijkswaterstaat stations (Lobith → Nijmegen 5 h, r = 0.94).',
      nl: 'Combineert OSM met Copernicus EMSR773 via Dijkstra, bouwt 3D-satellietvluchten voor Nepal/Indonesië en analyseert 25 echte Rijkswaterstaat-stations in Nederland.'
    },
    innovation: {
      es: 'Pasa de «dónde hay agua» a «qué persona seca no puede llegar a ningún hospital o salida» — combinando hidrología aguas arriba, satélite y red de socorro sin cobertura.',
      en: 'Shifts from "where is water" to "which dry neighborhood has zero path to a hospital or shelter" — fusing upstream hydrology, satellites, and offline rescue links.',
      nl: 'Gaat verder dan waterkaarten door exact te tonen welke droge wijken geen enkele vluchtroute meer hebben.'
    },
    deterministicFact: {
      es: 'Motores reales verificados con datos oficiales Copernicus EMSR773, USGS, Sentinel-2 y 25 estaciones Rijkswaterstaat en /senda/aislamiento.html, /senda/vuelo.html y /senda/agua-nl.html.',
      en: 'Verified live engines built on real Copernicus EMSR773, USGS, Sentinel-2, and 25 Rijkswaterstaat stations.',
      nl: 'Live engines op basis van Copernicus EMSR773, USGS, Sentinel-2 en 25 RWS-stations.'
    },
    metrics: [
      { val: '1.326', lbl: { es: 'Cruces secos aislados (EMSR773)', en: 'Isolated dry junctions', nl: 'Afgesloten droge kruispunten' } },
      { val: '25 est.', lbl: { es: 'Rijkswaterstaat reales (NL)', en: 'Real RWS stations (NL)', nl: 'Echte RWS-stations (NL)' } },
      { val: 'r = 0,94', lbl: { es: 'Onda fluvial 5 h Lobith→Nimega', en: '5h wave Lobith→Nijmegen', nl: '5u watergolf Lobith→Nijmegen' } }
    ],
    links: [
      { href: '/senda/aislamiento.html', label: { es: 'Aislamiento DANA Valencia', en: 'Valencia DANA Isolation', nl: 'Valencia DANA Isolatie' } },
      { href: '/senda/agua-nl.html', label: { es: 'Agua Países Bajos (RWS)', en: 'Netherlands Water (RWS)', nl: 'Water Nederland (RWS)' } },
      { href: '/senda/vuelo.html', label: { es: 'Sobrevuelo 3D Langtang Nepal', en: 'Langtang 3D Flyover', nl: 'Langtang 3D Satellietvlucht' } }
    ],
    evidenceId: 'EV-FLOOD-DANA',
    primaryVideo: {
      src: '/media/senda-demo/SENDA-nepal-sobrevuelo.mp4',
      poster: '/media/senda-ruta-poster-en.jpg',
      title: 'Demo Real · Sobrevuelo 3D Satelital (Langtang, Nepal · USGS + Sentinel-2 + DEM)',
      caption: 'Reconstrucción 3D real del valle tras seísmo/deslizamiento con ruta óptima de 44,6 km.',
      evidenceId: 'EV-NEPAL-3D'
    },
    extraVideos: [
      {
        src: '/media/m95/senda-m95-broadcast-special-es.mp4',
        sources: { es: '/media/m95/senda-m95-broadcast-special-es.mp4', en: '/media/m95/senda-m95-broadcast-special-en.mp4' },
        poster: '/media/m95/senda-m95-broadcast-special-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-broadcast-special-es.vtt', en: '/media/m95/senda-m95-broadcast-special-en.vtt', nl: '/media/m95/senda-m95-broadcast-special-nl.vtt' },
        title: 'Especial Informativo 20:11 · DANA Valencia, Bejís y A-12',
        caption: 'Crónica bilingüe con subtítulos ES / EN / NL sobre por qué las alertas celulares necesitan respaldo.',
        evidenceId: 'EV-FLOOD-DANA'
      }
    ]
  },
  {
    id: 'seismic-rubble',
    num: '08',
    title: { es: 'Seísmo, Edificio 3D y Wi-Fi CSI', en: 'Seismic, 3D Building & Wi-Fi CSI', nl: 'Aardbeving, 3D Gebouw & Wi-Fi CSI' },
    headline: {
      es: 'Prevención sísmica por onda P, triaje 3D planta a planta y localización tras muros con Wi-Fi CSI.',
      en: 'P-wave earthquake early warning, floor-by-floor 3D triage & through-wall Wi-Fi CSI tomography.',
      nl: 'Vroege P-golf waarschuwing, 3D verdiepingstriage & Wi-Fi CSI door muren.'
    },
    problem: {
      es: 'En terremotos (como Venezuela o zonas sísmicas mediterráneas), los segundos previos a la sacudida fuerte salvan vidas, y tras un colapso los equipos de rescate necesitan saber qué viviendas tienen ocupantes bajo escombros.',
      en: 'In earthquakes (such as Venezuela and Mediterranean fault zones), seconds of early P-wave warning save lives — and after collapse, rescuers need floor-level awareness under rubble.',
      nl: 'Bij aardbevingen redden seconden waarschuwing levens, en na instorting moeten reddingsteams per verdieping weten waar mensen zich bevinden.'
    },
    how: {
      es: 'Corrobora la onda sísmica P entre acelerómetros cercanos para disparar alerta temprana y activar modo relé preautorizado; el barómetro estima la planta dentro del gemelo 3D EMS-98; el puente BLE + radar espectral Wi-Fi CSI de 64 subportadoras OFDM (ITU-R P.2040) + golpes acústicos localizados y censo radio por dron ayudan a priorizar cada vivienda.',
      en: 'Corroborates seismic P-waves across nearby accelerometers to trigger early warning & pre-authorized relay; barometers locate floor height in the EMS-98 3D twin; BLE surface bridges, 64-subcarrier OFDM Wi-Fi CSI (ITU-R P.2040), localized knocks, and drone BLE census guide rescue triage.',
      nl: 'Correleert P-golven op telefoons voor vroege waarschuwing, gebruikt barometers voor verdiepingshoogte en combineert BLE-puinbruggen met 64-subcarrier OFDM Wi-Fi CSI.'
    },
    innovation: {
      es: 'Sentidos ampliados sobre hardware cotidiano: convierte el móvil del ciudadano y placas Wi-Fi de pocos euros en sismógrafo cooperativo, detector de golpes y radar espectral bajo escombros con privacidad por diseño.',
      en: 'Extended senses on everyday hardware: turns ordinary smartphones and low-cost Wi-Fi boards into cooperative seismographs, knock localizers, and through-wall RF awareness.',
      nl: 'Verruimde zintuigen op alledaagse hardware: maakt van smartphones en goedkope Wi-Fi-borden een reddingsnetwerk.'
    },
    deterministicFact: {
      es: 'Modelado de atenuación ITU-R P.2040 y tomografía 64-OFDM verificados en tests unitarios, más gemelo 3D (/senda/edificios.html), sentidos ampliados (/senda/sentidos.html) y censo dron (/senda/dron.html).',
      en: 'ITU-R P.2040 attenuation & 64-subcarrier OFDM tomography unit-tested alongside /senda/edificios.html, /senda/sentidos.html, and /senda/dron.html.',
      nl: 'ITU-R P.2040 en 64-OFDM tomografie getest naast /senda/edificios.html en /senda/sentidos.html.'
    },
    metrics: [
      { val: 'Onda P', lbl: { es: 'Alerta sísmica colaborativa', en: 'Collaborative P-wave warning', nl: 'Collaboratieve P-golf' } },
      { val: '64-OFDM', lbl: { es: 'Radar Wi-Fi CSI (ITU-R P.2040)', en: 'Wi-Fi CSI radar (P.2040)', nl: 'Wi-Fi CSI radar (P.2040)' } },
      { val: 'EMS-98', lbl: { es: 'Gemelo 3D planta a planta', en: 'Floor-by-floor 3D twin', nl: '3D twin per verdieping' } }
    ],
    links: [
      { href: '/senda/edificios.html', label: { es: 'Gemelo 3D de Edificios', en: '3D Building Twin', nl: '3D Gebouw-twin' } },
      { href: '/senda/sentidos.html', label: { es: 'Sentidos Ampliados (Golpes/Wi-Fi)', en: 'Extended Senses', nl: 'Verruimde Zintuigen' } },
      { href: '/senda/dron.html', label: { es: 'Censo Radio por Dron', en: 'Drone Radio Census', nl: 'Drone Radio-telling' } }
    ],
    evidenceId: 'EV-02-SWEEP',
    primaryVideo: {
      src: '/media/m95/senda-m95-role-citizen-es.mp4',
      sources: { es: '/media/m95/senda-m95-role-citizen-es.mp4', en: '/media/m95/senda-m95-role-citizen-en.mp4' },
      poster: '/media/m95/senda-m95-role-citizen-poster.jpg',
      subtitles: { es: '/media/m95/senda-m95-role-citizen-es.vtt', en: '/media/m95/senda-m95-role-citizen-en.vtt', nl: '/media/m95/senda-m95-role-citizen-nl.vtt' },
      title: 'Modo Ciudadano y Evacuación (60 s · ES/EN + Subtítulos ES/EN/NL)',
      caption: 'Cómo cualquier persona o madre utiliza SENDA en 3 botones simples durante una emergencia.',
      evidenceId: 'EV-OFFLINE-49'
    },
    extraVideos: [
      {
        src: '/media/m95/senda-m95-role-developer-es.mp4',
        sources: { es: '/media/m95/senda-m95-role-developer-es.mp4', en: '/media/m95/senda-m95-role-developer-en.mp4' },
        poster: '/media/m95/senda-m95-role-developer-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-role-developer-es.vtt', en: '/media/m95/senda-m95-role-developer-en.vtt', nl: '/media/m95/senda-m95-role-developer-nl.vtt' },
        title: 'Modo Desarrollador e Ingeniería (60 s · ES/EN + Subtítulos ES/EN/NL)',
        caption: 'Física de propagación ITU-R, códigos Reed-Solomon, WebCrypto y código abierto MIT.',
        evidenceId: 'EV-CORE-506'
      },
      {
        src: '/media/m95/senda-m95-vertical-45s-en.mp4',
        aspect: '9/16',
        poster: '/media/m95/senda-m95-reel-math-poster.jpg',
        subtitles: { es: '/media/m95/senda-m95-vertical-45s-es.vtt', en: '/media/m95/senda-m95-vertical-45s-en.vtt', nl: '/media/m95/senda-m95-vertical-45s-nl.vtt' },
        title: 'Reel Móvil 9:16 (45 s) · Visión Completa SENDA',
        caption: 'Corte vertical 45 s adaptado para pantalla de móvil con subtítulos ES / EN / NL.',
        evidenceId: 'EV-CORE-506'
      }
    ]
  }
];

export default function InnovationShowcase({
  locale,
  audience
}: {
  locale: Locale;
  audience: AudienceMode;
}) {
  const [selected, setSelected] = useState<PillarId>('offline-mesh');
  const active = PILLARS.find((p) => p.id === selected) ?? PILLARS[0];

  const icons: Record<PillarId, typeof Radio> = {
    'offline-mesh': Radio,
    'satellites-ntn': Satellite,
    'osint-console': Compass,
    'rail-safety': TrainFront,
    'road-vision': Car,
    'wildfire-3d': Flame,
    'floods-water': Waves,
    'seismic-rubble': Activity
  };

  const labels = {
    es: {
      eyebrow: 'ARQUITECTURA DE INNOVACIÓN · QUÉ RESOLVEMOS · CÓMO LO HACEMOS · DEMO REAL EN VÍDEO',
      title: 'Cada innovación explicada con rigor determinante y demostrada en vídeo real.',
      lead: 'Selecciona cualquiera de los 8 bloques clave de SENDA para ver exactamente qué fallo del mundo real resolvemos, cómo funciona bajo el capó, por qué es único y sus vídeos reales.',
      problem: 'QUÉ PROBLEMA RESOLVEMOS',
      how: 'CÓMO LO HACEMOS (TECNOLOGÍA EXACTA)',
      innovation: 'POR QUÉ ES INNOVACIÓN DIFERENCIAL',
      proof: 'VERIFICACIÓN Y DEMOSTRACIÓN REAL',
      moreVideos: 'Más vídeos y simulaciones reales de este bloque'
    },
    en: {
      eyebrow: 'INNOVATION ARCHITECTURE · WHAT WE SOLVE · HOW WE DO IT · LIVE VIDEO PROOF',
      title: 'Every breakthrough explained clearly and demonstrated in real video.',
      lead: 'Select any of the 8 SENDA pillars to inspect the exact real-world gap solved, the engineering mechanism, why it breaks existing limits, and its real video demos.',
      problem: 'WHAT WE SOLVE',
      how: 'HOW WE DO IT (EXACT MECHANISM)',
      innovation: 'BREAKTHROUGH INNOVATION',
      proof: 'DETERMINISTIC VERIFICATION',
      moreVideos: 'Additional real demo & simulation videos for this pillar'
    },
    nl: {
      eyebrow: 'INNOVATIE-ARCHITECTUUR · WAT WE OPLOSSEN · HOE HET WERKT · ECHTE VIDEO’S',
      title: 'Elke innovatie glashelder uitgelegd en gedemonstreerd in echte video.',
      lead: 'Kies een van de 8 pijlers om exact te zien welk probleem we oplossen, hoe de techniek werkt, wat ons uniek maakt en de bijbehorende demovideo’s.',
      problem: 'WELK PROBLEEM WE OPLOSSEN',
      how: 'HOE WE HET DOEN (EXACTE TECHNIEK)',
      innovation: 'UNIEKE INNOVATIE',
      proof: 'VERIFICATIE & BEWIJS',
      moreVideos: 'Meer echte demo- en simulatievideo’s bij deze pijler'
    }
  }[locale];

  return (
    <section className="s-section s-sunk" data-testid="innovation-showcase" data-audience={audience}>
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">
            <Lightbulb size={15} aria-hidden="true" />
            <span>{labels.eyebrow}</span>
          </p>
          <h2 className="s-h2">{labels.title}</h2>
          <p className="s-lead">{labels.lead}</p>
        </div>

        {/* Visible 8-Pillar Bento Grid (4x2 Desktop, 2x4 Mobile — all 8 innovations visible at a glance) */}
        <div className="s-innov-tabs" role="tablist" aria-label={labels.title}>
          {PILLARS.map((p) => {
            const Icon = icons[p.id];
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active.id === p.id}
                className="s-innov-tab"
                onClick={() => setSelected(p.id)}
                data-testid={`innov-tab-${p.id}`}
              >
                <span className="s-innov-tab-top">
                  <Icon size={15} aria-hidden="true" />
                  <span className="s-mono">{p.num}</span>
                </span>
                <span className="s-innov-tab-title">{p.title[locale]}</span>
              </button>
            );
          })}
        </div>

        {/* Deep Deterministic Explainer Card + Matching Real Video */}
        <div className="s-innov-panel">
          <div className="s-innov-grid">
            <div className="s-stack" style={{ gap: 16 }}>
              <div className="s-between">
                <span className="s-pill s-mono" style={{ color: 'var(--s-accent)' }}>
                  PILAR {active.num} · {active.title[locale].toUpperCase()}
                </span>
                <EvidenceBadge locale={locale} evidenceId={active.evidenceId} compact />
              </div>

              <h3 className="s-h2" style={{ fontSize: 'clamp(1.35rem, 2.5vw, 2rem)', margin: 0 }}>
                {active.headline[locale]}
              </h3>

              <div className="s-innov-block is-problem">
                <div className="s-innov-label">
                  <ShieldAlert size={14} aria-hidden="true" />
                  <span>{labels.problem}</span>
                </div>
                <p>{active.problem[locale]}</p>
              </div>

              <div className="s-innov-block is-how">
                <div className="s-innov-label">
                  <Wrench size={14} aria-hidden="true" />
                  <span>{labels.how}</span>
                </div>
                <p>{active.how[locale]}</p>
              </div>

              <div className="s-innov-block is-innov">
                <div className="s-innov-label">
                  <Lightbulb size={14} aria-hidden="true" />
                  <span>{labels.innovation}</span>
                </div>
                <p>{active.innovation[locale]}</p>
              </div>

              <div className="s-innov-proof">
                <CheckCircle2 size={15} style={{ color: 'var(--s-ok)', flex: 'none', marginTop: 2 }} aria-hidden="true" />
                <span>
                  <strong style={{ color: 'var(--s-text)' }}>{labels.proof}: </strong>
                  {active.deterministicFact[locale]}
                </span>
              </div>

              <div className="s-crisis-kpis">
                {active.metrics.map((m) => (
                  <div key={m.val} className="s-crisis-kpi">
                    <strong className="s-num">{m.val}</strong>
                    <span className="s-micro s-faint">{m.lbl[locale]}</span>
                  </div>
                ))}
              </div>

              <div className="s-row" style={{ gap: 8 }}>
                {active.links.map((lk, idx) => (
                  <a
                    key={lk.href + lk.label.en}
                    href={lk.href}
                    className={idx === 0 ? 's-btn s-btn-primary s-btn-sm' : 's-btn s-btn-secondary s-btn-sm'}
                  >
                    <span>{lk.label[locale]}</span>
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            <div className="s-stack" style={{ gap: 16 }}>
              <MediaVideo locale={locale} {...active.primaryVideo} />
            </div>
          </div>

          {active.extraVideos && active.extraVideos.length > 0 && (
            <div className="s-stack" style={{ gap: 14, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--s-line)' }}>
              <strong className="s-small s-mono" style={{ color: 'var(--s-accent)' }}>
                {labels.moreVideos} ({active.extraVideos.length})
              </strong>
              <div className="s-grid s-grid-2">
                {active.extraVideos.map((vid) => (
                  <MediaVideo key={vid.src} locale={locale} {...vid} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

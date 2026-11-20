'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Radio, Satellite, Shield, WifiOff } from 'lucide-react';
import EvidenceBadge from './EvidenceBadge';
import type { AudienceMode } from './AudienceLens';
import { localeHref, REPO_URL, type Locale } from '../data/types';

interface GlobeAct {
  id: number;
  time: string;
  progress: number;
  orbitLabel: string;
  latency: string;
  frameHex: string;
  title: Record<Locale, string>;
  copy: Record<AudienceMode, Record<Locale, string>>;
  sourcePath: string;
  evidenceId: string;
}

const ACTS: GlobeAct[] = [
  {
    id: 0,
    time: 'T+00m 00s',
    progress: 0.08,
    orbitLabel: 'CELLULAR DOWN · LOCAL E2EE SEAL',
    latency: '480 min baseline',
    frameHex: '4F 45 50 01 9A 03 ...',
    title: {
      en: '01 · Tower loses power, message seals locally',
      es: '01 · Cae la antena y el móvil sella el mensaje sin red',
      nl: '01 · Zendmast valt uit, toestel verzegelt bericht offline'
    },
    copy: {
      citizen: {
        en: 'When floods or earthquakes knock out cell towers, you still tap "I am safe" or "Need help". Your phone keeps it safe offline and starts looking for any way out.',
        es: 'Cuando una riada o un terremoto tira las antenas, pulsas "Estoy bien" o "Necesito ayuda". Tu teléfono lo guarda cifrado sin cobertura y empieza a buscar salida solo.',
        nl: 'Wanneer een overstroming of beving zendmasten uitschakelt, tikt u toch op "Ik ben veilig" of "Hulp nodig". Uw toestel bewaart het offline en zoekt zelf een uitweg.'
      },
      investor: {
        en: 'Eliminates the single-point-of-failure cellular dependency across Europe with durable local queues verified across 49/49 real offline Chromium assertions.',
        es: 'Elimina el punto único de fallo de la telefonía móvil mediante colas locales duraderas verificadas en 49/49 pruebas reales sin red en Chromium.',
        nl: 'Neemt de afhankelijkheid van één mobiele zendmast weg met duurzame lokale wachtrijen, geverifieerd in 49/49 offline Chromium-tests.'
      },
      engineer: {
        en: 'Envelope sealed on-device with ECDH P-256 + AES-256-GCM + ECDSA signature and persisted in IndexedDB / Android disk store with deterministic TTL & priority.',
        es: 'Sobre sellado en el dispositivo con ECDH P-256 + AES-256-GCM + firma ECDSA y persistido en IndexedDB / Android con TTL determinista y prioridad.',
        nl: 'Envelop lokaal verzegeld met ECDH P-256 + AES-256-GCM + ECDSA-handtekening en opgeslagen in IndexedDB / Android met TTL en prioriteit.'
      }
    },
    sourcePath: 'packages/senda/src/envelope.mjs',
    evidenceId: 'EV-OFFLINE-49'
  },
  {
    id: 1,
    time: 'T+01m 10s',
    progress: 0.30,
    orbitLabel: 'BLE + WI-FI DIRECT · BLIND HOP RELAY',
    latency: '3-hop mesh active',
    frameHex: '4F 45 50 02 1B F4 ...',
    title: {
      en: '02 · Nearby phones form an encrypted relay chain',
      es: '02 · Los móviles cercanos forman una cadena cifrada',
      nl: '02 · Nabije telefoons vormen een versleutelde keten'
    },
    copy: {
      citizen: {
        en: 'Without needing Internet, nearby phones pass your sealed message silently from neighbor to neighbor. Nobody along the way can read it—only your family.',
        es: 'Sin necesitar Internet, los móviles cercanos pasan tu mensaje sellado de vecino en vecino en silencio. Nadie por el camino puede leerlo: solo tu familia.',
        nl: 'Zonder internet geven telefoons in de buurt uw verzegelde bericht ongemerkt door. Niemand onderweg kan het lezen — alleen uw familie.'
      },
      investor: {
        en: 'Pre-authorized relay mode activates automatically within battery/data budgets when authorities declare an emergency zone or seismic sensors corroborate.',
        es: 'El modo relé preautorizado se activa dentro de cuotas de batería y datos cuando la autoridad declara emergencia o varios sismógrafos lo corroboran.',
        nl: 'Vooraf geautoriseerde relay schakelt automatisch in binnen accugrenzen bij een noodzone of bevestigde aardbeving.'
      },
      engineer: {
        en: 'Blind relays inspect only routing header, priority, and TTL. Contact Graph Routing + ARR_REPLAN_V2 achieves 94.2% delivery at 84% lower energy than epidemic flooding.',
        es: 'Los relés ciegos solo inspeccionan cabecera, prioridad y TTL. Contact Graph Routing + ARR_REPLAN_V2 logra 94,2 % de entrega con 84 % menos energía que inundación.',
        nl: 'Blinde relays lezen alleen routemetadata. Contact Graph Routing + ARR_REPLAN_V2 haalt 94,2% bezorging met 84% minder energie.'
      }
    },
    sourcePath: 'packages/senda-relay/src/cgr.mjs',
    evidenceId: 'EV-ARR-V2'
  },
  {
    id: 2,
    time: 'T+02m 45s',
    progress: 0.54,
    orbitLabel: 'MULTIPATH RACE · WI-FI / LORA / ACOUSTIC',
    latency: '7 carriers racing',
    frameHex: '4F 45 50 03 C8 12 ...',
    title: {
      en: '03 · Every surviving carrier races in parallel',
      es: '03 · Todos los canales vivos compiten en paralelo',
      nl: '03 · Elk overlevend kanaal racet parallel mee'
    },
    copy: {
      citizen: {
        en: 'If a passing car, a neighbor with satellite Internet, a LoRa gateway, or even sound between two phones offers an exit, SENDA takes it automatically.',
        es: 'Si pasa un coche por la carretera, un vecino tiene satélite, hay una pasarela LoRa o solo queda transmitir por sonido entre móviles, SENDA aprovecha la salida al instante.',
        nl: 'Zodra een passerende auto, een buur met satellietinternet, een LoRa-gateway of zelfs geluid een uitweg biedt, gebruikt SENDA die direct.'
      },
      investor: {
        en: 'True carrier-agnostic resilience: combines consumer smartphones, road V2I portals, LoRa repeaters, and MFSK-16 acoustic fallback into one unified software fabric.',
        es: 'Resiliencia agnóstica de red: une smartphones cotidianos, pórticos V2I de carretera, repetidores LoRa y respaldo acústico MFSK-16 en una sola capa de software.',
        nl: 'Netwerkonafhankelijke weerbaarheid: verenigt smartphones, V2I-portalen, LoRa-repeaters en MFSK-16 geluid in één softwarelaag.'
      },
      engineer: {
        en: 'Attempt ladder dispatches BLE, Wi-Fi Direct, neighbor Starlink/carrier bridge, SMS, LoRa (ITU-R P.526 DEM planner), and MFSK-16 audio (Hamming 7,4 + CRC-32).',
        es: 'La escalera de canales despacha BLE, Wi-Fi Direct, puente vecino, SMS, LoRa (difracción ITU-R P.526 sobre DEM) y audio MFSK-16 (Hamming 7,4 + CRC-32).',
        nl: 'De kanaalladder stuurt parallel via BLE, Wi-Fi Direct, satellietbuur, sms, LoRa (ITU-R P.526) en MFSK-16 audio (Hamming 7,4 + CRC-32).'
      }
    },
    sourcePath: 'packages/senda/src/acoustic-modem.mjs',
    evidenceId: 'EV-ACOUSTIC'
  },
  {
    id: 3,
    time: 'T+03m 40s',
    progress: 0.76,
    orbitLabel: '3GPP NTN LEO · 550 KM · 24-BYTE BURST',
    latency: 'Doppler compensated',
    frameHex: '4F 45 50 04 7E A1 24B',
    title: {
      en: '04 · Overhead LEO satellite picks up the 24-byte burst',
      es: '04 · El satélite LEO recoge la ráfaga compacta de 24 bytes',
      nl: '04 · Overkomende LEO-satelliet pakt het 24-byte pakket op'
    },
    copy: {
      citizen: {
        en: 'Even in a completely isolated valley or mountain road, SENDA calculates the exact minute a satellite passes overhead and compresses your status into a tiny ultra-fast burst.',
        es: 'Incluso en un valle o carretera totalmente incomunicados, SENDA calcula el minuto exacto en que pasa un satélite y comprime tu aviso en una ráfaga ultracorta.',
        nl: 'Zelfs in een volledig afgesloten vallei berekent SENDA wanneer een satelliet overkomt en comprimeert uw noodstatus tot een razendsnelle puls.'
      },
      investor: {
        en: 'Direct-to-Cell 3GPP NTN native design: compresses emergency status into 24-byte binary frames with deterministic CRC-16-CCITT so bursts survive extreme path loss.',
        es: 'Diseño nativo 3GPP NTN Direct-to-Cell: comprime el estado crítico en tramas binarias de 24 bytes con CRC-16-CCITT para atravesar enlaces satelitales difíciles.',
        nl: 'Direct-to-Cell 3GPP NTN-ontwerp: comprimeert noodmeldingen tot 24-byte frames met CRC-16-CCITT voor extreme demping.'
      },
      engineer: {
        en: 'Computes real slant range, Free-Space Path Loss (FSPL), Doppler frequency shift, and encodes the 24-byte OEP-NTN compact binary burst frame in lib/telecom-suite.mjs.',
        es: 'Calcula distancia inclinada, pérdidas FSPL, desplazamiento Doppler y codifica la trama binaria OEP-NTN de 24 bytes con CRC-16-CCITT en lib/telecom-suite.mjs.',
        nl: 'Berekent slant range, FSPL-demping, Dopplerverschuiving en codeert het 24-byte OEP-NTN frame in lib/telecom-suite.mjs.'
      }
    },
    sourcePath: 'investor-next/lib/telecom-suite.mjs',
    evidenceId: 'EV-S01-ROUTE'
  },
  {
    id: 4,
    time: 'T+04m 18s',
    progress: 0.96,
    orbitLabel: 'DEDUP + SIGNED ECDSA ACK · QUEUE PURGED',
    latency: '4 min vs 480 min',
    frameHex: 'ACK ECDSA P-256 · VERIFIED',
    title: {
      en: '05 · Family receives it, signed receipt clears every relay',
      es: '05 · Llega a tu familia y el recibo firmado limpia la red',
      nl: '05 · Familie ontvangt bericht en ondertekende ACK wist relays'
    },
    copy: {
      citizen: {
        en: 'Your family sees your message in ~4 minutes instead of waiting 8 hours for mobile towers to return. Your phone receives proof of delivery so you can breathe again.',
        es: 'Tu familia lee tu mensaje en ~4 minutos en lugar de esperar 8 horas a que vuelva la cobertura. Tu móvil recibe confirmación real de entrega para que puedas respirar.',
        nl: 'Uw familie leest uw bericht binnen ~4 minuten in plaats van 8 uur te wachten. Uw toestel ontvangt een echt ontvangstbewijs.'
      },
      investor: {
        en: 'Automatic multi-path deduplication collapses duplicate arrivals into one logical event while signed ACK tombstones immediately free storage across volunteer phones.',
        es: 'La deduplicación unifica llegadas múltiples en un evento único y las lápidas ACK firmadas liberan automáticamente la memoria de los móviles voluntarios.',
        nl: 'Ontdubbeling voegt kopieën samen en ondertekende ACK-tombstones maken opslag op vrijwillige telefoons direct weer vrij.'
      },
      engineer: {
        en: 'Verified end-to-end across 506/506 core protocol tests: terminal ACK/EXPIRED tombstones reject replay and never resurrect purged envelopes.',
        es: 'Verificado extremo a extremo en 506/506 pruebas del núcleo: las lápidas terminales ACK/EXPIRED bloquean repeticiones y nunca resucitan mensajes purgados.',
        nl: 'End-to-end geverifieerd in 506/506 kerntests: terminale ACK/EXPIRED-tombstones voorkomen replay-aanvallen.'
      }
    },
    sourcePath: 'packages/senda-relay/src/relay-queue.mjs',
    evidenceId: 'EV-CORE-506'
  }
];

function ThreeOrbitalCanvas({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const mount = hostRef.current;
    if (!mount) return;
    let destroyed = false;
    let raf = 0;
    let cleanup: () => void = () => {};
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    async function boot() {
      const THREE = await import('three');
      if (destroyed || !mount) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'low-power' });
      } catch {
        setFallback(true);
        return;
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#050b13');
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
      camera.position.set(0, 0.25, 10.2);

      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.5 : 1.8));
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight('#b6dbf0', 1.45));
      const sun = new THREE.DirectionalLight('#e8f4ff', 2.2);
      sun.position.set(-4, 5, 8);
      scene.add(sun);
      const rim = new THREE.PointLight('#2997ff', 18, 22);
      rim.position.set(5, -2, 2);
      scene.add(rim);

      const sphereGroup = new THREE.Group();
      scene.add(sphereGroup);
      const earth = new THREE.Group();
      sphereGroup.add(earth);

      // Procedural high-contrast Earth texture (Europe, Americas, Africa, Asia, Indonesia/Nepal)
      const map = document.createElement('canvas');
      map.width = 1024;
      map.height = 512;
      const ctx = map.getContext('2d');
      if (ctx) {
        const sea = ctx.createLinearGradient(0, 0, 1024, 512);
        sea.addColorStop(0, '#0c2338');
        sea.addColorStop(0.5, '#091b2e');
        sea.addColorStop(1, '#05101d');
        ctx.fillStyle = sea;
        ctx.fillRect(0, 0, 1024, 512);

        ctx.strokeStyle = 'rgba(41,151,255,0.14)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 1024; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 512);
          ctx.stroke();
        }
        for (let y = 0; y < 512; y += 43) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1024, y);
          ctx.stroke();
        }
        const continents = [
          [[76, 79], [136, 57], [180, 78], [219, 103], [248, 145], [240, 173], [216, 190], [198, 218], [179, 232], [166, 210], [145, 202], [118, 178], [102, 146], [78, 130]],
          [[220, 226], [241, 237], [258, 280], [263, 313], [249, 358], [236, 395], [221, 444], [201, 422], [204, 389], [187, 353], [194, 307], [185, 274]],
          [[463, 109], [507, 79], [573, 70], [614, 96], [660, 88], [726, 96], [781, 128], [818, 156], [838, 190], [802, 209], [766, 195], [747, 231], [712, 225], [695, 259], [654, 244], [616, 200], [575, 216], [545, 188], [510, 194], [484, 167]],
          [[511, 213], [568, 220], [591, 265], [575, 314], [544, 369], [518, 369], [500, 326], [487, 295], [483, 255]],
          [[775, 340], [831, 328], [879, 364], [890, 394], [854, 419], [817, 399], [790, 371]]
        ];
        for (const poly of continents) {
          ctx.beginPath();
          poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = '#1b3f5a';
          ctx.fill();
          ctx.strokeStyle = 'rgba(125,211,252,0.72)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      const earthTexture = new THREE.CanvasTexture(map);
      earthTexture.colorSpace = THREE.SRGBColorSpace;
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(2.45, 72, 48),
        new THREE.MeshStandardMaterial({
          map: earthTexture,
          metalness: 0.25,
          roughness: 0.82,
          emissive: '#071b2d',
          emissiveIntensity: 0.28
        })
      );
      earth.add(globe);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(2.55, 56, 42),
        new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.14,
          depthWrite: false
        })
      );
      earth.add(atmosphere);

      // Crisis & corridor ground stations: Valencia, Arnhem NL, Venezuela, Nepal, Indonesia, Adamuz/Madrid
      const toSurface = (lat: number, lon: number, r = 2.5) => {
        const a = (lat * Math.PI) / 180;
        const b = (lon * Math.PI) / 180;
        return new THREE.Vector3(r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b));
      };
      const coords: Array<[number, number, string]> = [
        [39.47, -0.37, '#ff7b54'], // Valencia
        [51.98, 5.91, '#38bdf8'],  // Arnhem NL
        [38.03, -4.52, '#fbbf24'], // Adamuz Spain Rail
        [10.48, -66.9, '#fb7185'], // Venezuela Seismic
        [28.21, 85.56, '#34d399'], // Langtang Nepal
        [-6.2, 106.8, '#60a5fa']   // Indonesia Floods
      ];
      const stations = coords.map(([lat, lon, color], i) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(i === 0 ? 0.088 : 0.068, 14, 14),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
        );
        m.position.copy(toSurface(lat, lon));
        earth.add(m);
        return m;
      });

      const arcs: Array<{ mat: InstanceType<typeof THREE.LineBasicMaterial>; start: number; end: number }> = [];
      const addArc = (from: number, to: number, color: string, start: number, end: number) => {
        const a = stations[from].position.clone().normalize();
        const b = stations[to].position.clone().normalize();
        const pts = [];
        for (let i = 0; i <= 64; i++) {
          const t = i / 64;
          const v = a
            .clone()
            .lerp(b, t)
            .normalize()
            .multiplyScalar(2.53 + Math.sin(t * Math.PI) * (0.24 + Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 0.2));
          pts.push(v);
        }
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false });
        earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
        arcs.push({ mat, start, end });
      };
      addArc(0, 1, '#38bdf8', 0.15, 0.35);
      addArc(0, 2, '#fbbf24', 0.25, 0.45);
      addArc(1, 4, '#34d399', 0.42, 0.65);
      addArc(4, 5, '#60a5fa', 0.55, 0.78);
      addArc(0, 3, '#30d158', 0.68, 0.92);

      // 3 LEO Orbital Planes + 2 Satellites with Solar Arrays
      const orbitGroup = new THREE.Group();
      scene.add(orbitGroup);
      for (let i = 0; i < 3; i++) {
        const pts = [];
        for (let j = 0; j <= 180; j++) {
          const t = (j / 180) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(t) * 3.35, 0, Math.sin(t) * 3.35));
        }
        const ring = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: i === 1 ? '#30d158' : '#38bdf8', transparent: true, opacity: 0.26 })
        );
        ring.rotation.set(0.32 + i * 0.52, 0.2 + i * 0.65, 0.25 + i * 0.22);
        orbitGroup.add(ring);
      }

      const buildSat = (panelColor: string) => {
        const sat = new THREE.Group();
        sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: '#e8f4ff' })));
        [-0.3, 0.3].forEach((x) => {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.018, 0.14), new THREE.MeshBasicMaterial({ color: panelColor }));
          p.position.x = x;
          sat.add(p);
        });
        orbitGroup.add(sat);
        return sat;
      };
      const satA = buildSat('#38bdf8');
      const satB = buildSat('#30d158');

      // Starfield
      let seed = 42;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const starPos = new Float32Array(420 * 3);
      for (let i = 0; i < 420; i++) {
        const r = 18 + rand() * 30;
        const th = rand() * Math.PI * 2;
        const ph = Math.acos(2 * rand() - 1);
        starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        starPos[i * 3 + 1] = r * Math.cos(ph);
        starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      }
      const starsGeo = new THREE.BufferGeometry();
      starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#93c5fd', size: 0.05, transparent: true, opacity: 0.55 })));

      const measure = () => {
        if (!mount || destroyed) return;
        const box = mount.getBoundingClientRect();
        const w = Math.max(1, box.width);
        const h = Math.max(1, box.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      const ro = new ResizeObserver(measure);
      ro.observe(mount);
      measure();

      let running = true;
      let t = 0;
      let last = 0;
      let smoothP = progressRef.current;
      const clock = new THREE.Clock();

      const paint = (ts = 0) => {
        if (destroyed || !running) return;
        if (ts - last < 28 && !reduceMotion) {
          raf = requestAnimationFrame(paint);
          return;
        }
        last = ts;
        const targetP = Math.max(0, Math.min(1, progressRef.current));
        smoothP += (targetP - smoothP) * (reduceMotion ? 1 : 0.1);
        if (!reduceMotion) t += Math.min(clock.getDelta(), 0.05);
        else clock.getDelta();

        earth.rotation.y = 0.4 + smoothP * 3.4 + (reduceMotion ? 0 : t * 0.09);
        earth.rotation.x = 0.22 + Math.sin(smoothP * Math.PI) * 0.14;
        camera.position.z = 10.2 - 0.7 * Math.sin(smoothP * Math.PI);

        orbitGroup.rotation.y = smoothP * 1.4 + (reduceMotion ? 0 : t * 0.06);
        const angA = smoothP * 5.2 + (reduceMotion ? 0 : t * 0.42);
        satA.position.set(3.35 * Math.cos(angA), 0.35 * Math.sin(angA * 2), 3.35 * Math.sin(angA));
        satA.lookAt(0, 0, 0);

        const angB = -smoothP * 3.8 + (reduceMotion ? 0 : -t * 0.31) + 2.2;
        satB.position.set(3.15 * Math.cos(angB), 1.3 * Math.sin(angB), 3.15 * Math.sin(angB));
        satB.lookAt(0, 0, 0);

        stations.forEach((node, idx) => {
          const pulse = 1 + Math.sin(t * 3 + idx) * 0.18;
          node.scale.setScalar(reduceMotion ? 1.1 : pulse);
        });

        arcs.forEach((a) => {
          const k = (smoothP - a.start) / (a.end - a.start);
          a.mat.opacity = Math.max(0.18, Math.min(0.96, k));
        });

        renderer.render(scene, camera);
        if (!reduceMotion) raf = requestAnimationFrame(paint);
      };

      const startLoop = () => {
        if (destroyed) return;
        running = true;
        cancelAnimationFrame(raf);
        clock.getDelta();
        raf = requestAnimationFrame(paint);
      };
      const stopLoop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };

      // Pause/resume per modern-web-guidance (efficient-background-processing)
      const onContentVis = (ev: Event) => {
        const skipped = (ev as Event & { skipped?: boolean }).skipped;
        if (skipped) stopLoop();
        else startLoop();
      };
      mount.addEventListener('contentvisibilityautostatechange', onContentVis);

      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) startLoop();
          else stopLoop();
        },
        { rootMargin: '180px' }
      );
      io.observe(mount);

      startLoop();

      cleanup = () => {
        stopLoop();
        mount.removeEventListener('contentvisibilityautostatechange', onContentVis);
        io.disconnect();
        ro.disconnect();
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
            obj.geometry.dispose();
            const mat = obj.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat.dispose();
          }
        });
        earthTexture.dispose();
        renderer.dispose();
      };
    }

    boot();
    return () => {
      destroyed = true;
      cleanup();
    };
  }, [progressRef]);

  if (fallback) {
    return (
      <div className="s-globe-fallback">
        <Satellite size={40} aria-hidden="true" />
        <span>3GPP NTN LEO · 550 km · Multipath Mesh Active</span>
      </div>
    );
  }

  return <div ref={hostRef} className="s-globe-canvas" />;
}

export default function ScrollGlobeStage({
  locale,
  audience
}: {
  locale: Locale;
  audience: AudienceMode;
}) {
  const [activeAct, setActiveAct] = useState(0);
  const progressRef = useRef(0.08);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    progressRef.current = ACTS[activeAct].progress;
  }, [activeAct]);

  useEffect(() => {
    const els = stepRefs.current.filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.actIndex || 0);
            setActiveAct(idx);
          }
        }
      },
      { rootMargin: '-32% 0px -42% 0px', threshold: 0.1 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const current = ACTS[activeAct];
  const actIcons = [WifiOff, Radio, Shield, Satellite, CheckCircle2];
  const CurrentIcon = actIcons[activeAct];

  const copy = {
    en: {
      eyebrow: 'LIVE 3D ORBITAL & MULTIPATH SIMULATION · SCROLL TO BUILD THE ROUTE',
      title: 'Watch a message escape a blackout — hop by hop, up to orbit.',
      lead: 'Scroll down on mobile or desktop (or tap any act) to construct the live 3D multipath & 3GPP NTN satellite link in real time.',
      openLab: 'Open full 3GPP NTN Satellite & Wi-Fi CSI Simulator',
      inspectCode: 'Inspect module source'
    },
    es: {
      eyebrow: 'SIMULACIÓN 3D ORBITAL Y MULTICANAL EN VIVO · HAZ SCROLL PARA CONSTRUIR LA RUTA',
      title: 'Mira en vivo cómo un mensaje escapa de un apagón — salto a salto, hasta la órbita.',
      lead: 'Baja haciendo scroll en móvil o escritorio (o pulsa cualquier fase) para construir en tiempo real la malla sin red y el enlace satelital 3GPP NTN.',
      openLab: 'Abrir simulador completo de Satélites 3GPP NTN y Radar Wi-Fi CSI',
      inspectCode: 'Ver código fuente del módulo'
    },
    nl: {
      eyebrow: 'LIVE 3D SATELLIET- & MULTIPATH-SIMULATIE · SCROLL OM DE ROUTE TE BOUWEN',
      title: 'Zie live hoe een bericht een black-out ontvlucht — stap voor stap naar de satelliet.',
      lead: 'Scroll omlaag op mobiel of desktop (of tik op een fase) om de offline mesh en 3GPP NTN satellietverbinding live op te bouwen.',
      openLab: 'Open volledige 3GPP NTN Satelliet & Wi-Fi CSI Simulator',
      inspectCode: 'Bekijk broncode van module'
    }
  }[locale];

  return (
    <section className="s-section s-globe-band" data-testid="scroll-globe-stage">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">{copy.eyebrow}</p>
          <h2 className="s-h2">{copy.title}</h2>
          <p className="s-lead">{copy.lead}</p>
        </div>

        {/* Quick act selector pills (especially handy on mobile) */}
        <div className="s-tabs-scroller" role="tablist" aria-label={copy.title}>
          {ACTS.map((act, idx) => (
            <button
              key={act.id}
              type="button"
              role="tab"
              aria-selected={activeAct === idx}
              className="s-tab-btn"
              onClick={() => setActiveAct(idx)}
              data-testid={`globe-act-tab-${idx}`}
            >
              <span className="s-mono s-micro" style={{ opacity: 0.72 }}>{act.time}</span>
              <span>{act.title[locale].replace(/^0\d · /, '')}</span>
            </button>
          ))}
        </div>

        <div className="s-globe-layout">
          {/* Sticky 3D WebGL Earth + Live Telemetry HUD */}
          <div className="s-globe-sticky">
            <div className="s-globe-shell">
              <div className="s-globe-hud-top">
                <span className="s-globe-chip">
                  <CurrentIcon size={14} aria-hidden="true" />
                  <span>{current.orbitLabel}</span>
                </span>
                <span className="s-globe-chip s-mono">{current.time}</span>
              </div>

              <ThreeOrbitalCanvas progressRef={progressRef} />

              <div className="s-globe-hud-bottom">
                <div className="s-globe-telemetry">
                  <div>
                    <span className="s-globe-tlabel">LINK</span>
                    <strong className="s-mono">{current.latency}</strong>
                  </div>
                  <div>
                    <span className="s-globe-tlabel">FRAME</span>
                    <strong className="s-mono">{current.frameHex}</strong>
                  </div>
                  <div>
                    <span className="s-globe-tlabel">PROGRESS</span>
                    <strong className="s-mono">{Math.round(current.progress * 100)}%</strong>
                  </div>
                </div>
                <div className="s-globe-progress" aria-hidden="true">
                  <div className="s-globe-progress-fill" style={{ width: `${Math.round(current.progress * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Scrolling 5-Act Cards */}
          <div className="s-globe-steps">
            {ACTS.map((act, idx) => {
              const isActive = idx === activeAct;
              return (
                <article
                  key={act.id}
                  ref={(el) => {
                    stepRefs.current[idx] = el;
                  }}
                  data-act-index={idx}
                  className={`s-globe-step${isActive ? ' is-active' : ''}`}
                  onClick={() => setActiveAct(idx)}
                >
                  <div className="s-between">
                    <span className="s-mono s-micro" style={{ color: 'var(--s-accent)', fontWeight: 700 }}>
                      {act.time}
                    </span>
                    <EvidenceBadge locale={locale} evidenceId={act.evidenceId} compact />
                  </div>
                  <h3 className="s-h3">{act.title[locale]}</h3>
                  <p style={{ margin: 0 }}>{act.copy[audience][locale]}</p>
                  <div className="s-row" style={{ marginTop: 6 }}>
                    <a
                      href={`${REPO_URL}/blob/master/${act.sourcePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="s-link s-micro s-mono"
                    >
                      {copy.inspectCode}: {act.sourcePath}
                    </a>
                  </div>
                </article>
              );
            })}

            <div className="s-row" style={{ marginTop: 8 }}>
              <a href={`${localeHref(locale, 'product')}#labs`} className="s-btn s-btn-primary">
                <span>{copy.openLab}</span>
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

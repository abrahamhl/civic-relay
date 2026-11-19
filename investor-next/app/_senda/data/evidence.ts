import { REPO_URL, type EvidenceRecord, type EvidenceStatus, type Locale } from './types';

const blob = (p: string) => `${REPO_URL}/blob/master/${p}`;

export const STATUS_META: Record<
  EvidenceStatus,
  {
    label: Record<Locale, string>;
    short: Record<Locale, string>;
    desc: Record<Locale, string>;
  }
> = {
  confirmed: {
    label: { en: 'Confirmed', es: 'Confirmado', nl: 'Bevestigd' },
    short: { en: 'Confirmed', es: 'Confirmado', nl: 'Bevestigd' },
    desc: {
      en: 'Independently reproduced or cryptographically/mechanically verified against a declared contract.',
      es: 'Reproducido o verificado de forma mecánica/criptográfica frente a un contrato declarado.',
      nl: 'Mechanisch of cryptografisch geverifieerd tegen een vastgelegd contract.'
    }
  },
  observed: {
    label: { en: 'Observed', es: 'Observado', nl: 'Waargenomen' },
    short: { en: 'Observed', es: 'Observado', nl: 'Waargenomen' },
    desc: {
      en: 'Measured from real external datasets, real Chromium offline runs, or dated public snapshots.',
      es: 'Medido sobre datos externos reales, ejecuciones sin red en Chromium real o capturas públicas fechadas.',
      nl: 'Gemeten uit echte externe datasets, offline Chromium-runs of gedateerde openbare snapshots.'
    }
  },
  predicted: {
    label: { en: 'Predicted', es: 'Predicho', nl: 'Voorspeld' },
    short: { en: 'Predicted', es: 'Predicho', nl: 'Voorspeld' },
    desc: {
      en: 'Model forecast or physical inference with explicit uncertainty bounds; never an official order.',
      es: 'Previsión de modelo o inferencia física con incertidumbre explícita; nunca es una orden oficial.',
      nl: 'Modelvoorspelling of fysische inferentie met expliciete onzekerheidsmarges; nooit een officieel bevel.'
    }
  },
  simulated: {
    label: { en: 'Simulated', es: 'Simulado', nl: 'Gesimuleerd' },
    short: { en: 'Simulated', es: 'Simulado', nl: 'Gesimuleerd' },
    desc: {
      en: 'Deterministic software or Monte Carlo simulation over virtual devices; not a physical radio trial.',
      es: 'Simulación determinista o Monte Carlo sobre dispositivos virtuales; no es una prueba de radio física.',
      nl: 'Deterministische of Monte Carlo-simulatie met virtuele apparaten; geen fysieke radioproef.'
    }
  },
  untested: {
    label: { en: 'Untested', es: 'No probado', nl: 'Niet getest' },
    short: { en: 'Untested', es: 'No probado', nl: 'Niet getest' },
    desc: {
      en: 'Not yet physically validated in the field, or awaiting institutional agreement / third-party audit.',
      es: 'Sin validación física de campo todavía, o pendiente de convenio institucional / auditoría independiente.',
      nl: 'Nog niet fysiek in het veld gevalideerd, of wachtend op institutionele overeenkomst / externe audit.'
    }
  }
};

export const EVIDENCE_RECORDS: EvidenceRecord[] = [
  {
    id: 'EV-CORE-506',
    category: 'protocol',
    status: 'confirmed',
    date: '2026-11-14',
    sha: '89ee438',
    scenario: {
      en: 'Core protocol & relay unit suite',
      es: 'Batería del núcleo y relé',
      nl: 'Kernprotocol- en relay-testsuite'
    },
    hypothesis: {
      en: 'Deterministic store-and-forward, E2EE envelope, deduplication, and anti-replay invariants hold across all core modules.',
      es: 'Los invariantes de almacenar-y-reenviar, sobre E2EE, deduplicación y anti-repetición se cumplen en todos los módulos.',
      nl: 'Deterministische store-and-forward-, E2EE-envelop-, deduplicatie- en anti-replay-invarianten blijven geldig.'
    },
    result: {
      en: '506/506 core tests + 112/112 web-lab unit tests pass; 0 accounting or safety invariant violations.',
      es: '506/506 pruebas del núcleo + 112/112 pruebas unitarias de la web en verde; 0 violaciones de invariantes.',
      nl: '506/506 kerntests + 112/112 weblab-unittests geslaagd; 0 schendingen van veiligheidsinvarianten.'
    },
    method: {
      en: 'Automated Node.js native test runner (pnpm --filter @senda/core test & investor-next tests).',
      es: 'Ejecución automatizada con runner nativo de Node.js (pnpm --filter @senda/core test e investor-next).',
      nl: 'Geautomatiseerde Node.js-testrunner (pnpm --filter @senda/core test en investor-next).'
    },
    sourcePath: 'investor-next/public/senda/estado.json',
    sourceUrl: blob('docs/investor/EVIDENCE_REGISTER.md'),
    limits: {
      en: 'Software-level verification only. Green unit tests do not replace physical radio trials or independent security audits.',
      es: 'Solo verificación de software. Las pruebas en verde no sustituyen ensayos físicos de radio ni auditorías externas.',
      nl: 'Alleen softwareverificatie. Groene unittests vervangen geen fysieke radiotests of externe audits.'
    }
  },
  {
    id: 'EV-OFFLINE-49',
    category: 'web',
    status: 'observed',
    date: '2026-11-14',
    sha: '89ee438',
    scenario: {
      en: 'Offline PWA & browser E2E (3 virtual handsets)',
      es: 'PWA sin red y E2E en navegador (3 teléfonos)',
      nl: 'Offline PWA & browser-E2E (3 virtuele toestellen)'
    },
    hypothesis: {
      en: 'Installed /senda/ PWA opens, queues encrypted messages, and reconciles signed receipts with network disabled.',
      es: 'La PWA /senda/ instalada abre, encola mensajes cifrados y reconcilia recibos firmados con la red cortada.',
      nl: 'De geïnstalleerde /senda/ PWA opent, zet versleutelde berichten in de wachtrij en verwerkt ontvangstbewijzen zonder netwerk.'
    },
    result: {
      en: '49/49 offline E2E assertions passed in real headless Chromium with network cut off; IndexedDB + Service Worker verified.',
      es: '49/49 comprobaciones E2E sin red superadas en Chromium real con red cortada; IndexedDB + Service Worker verificados.',
      nl: '49/49 offline E2E-controles geslaagd in echte Chromium zonder netwerk; IndexedDB + Service Worker geverifieerd.'
    },
    method: {
      en: 'Playwright real Chromium execution (investor-next/scripts/senda-offline-e2e.mjs).',
      es: 'Ejecución en Chromium real con Playwright (investor-next/scripts/senda-offline-e2e.mjs).',
      nl: 'Playwright-uitvoering in echte Chromium (investor-next/scripts/senda-offline-e2e.mjs).'
    },
    sourcePath: 'evidence/senda/offline-e2e.json',
    sourceUrl: blob('evidence/senda/offline-e2e.json'),
    limits: {
      en: 'Same-host browser loopback and synthetic audio/mule transfers; not cross-device RF propagation.',
      es: 'Bucle en navegador y transferencias sintéticas; no equivale a propagación RF entre teléfonos físicos.',
      nl: 'Browser-loopback en synthetische overdrachten; geen fysieke RF-propagatie tussen toestellen.'
    }
  },
  {
    id: 'EV-S01-ROUTE',
    category: 'routing',
    status: 'simulated',
    date: '2026-11-04',
    sha: '5b97a0e',
    scenario: {
      en: 'S01: Arnhem -> San Martín (8 h cellular blackout)',
      es: 'S01: Arnhem -> San Martín (apagón móvil de 8 h)',
      nl: 'S01: Arnhem -> San Martín (8 uur mobiele uitval)'
    },
    hypothesis: {
      en: 'Contact Graph Routing racing multipath channels delivers an emergency message faster than waiting for cellular recovery.',
      es: 'El enrutamiento por grafo de contactos en carrera multicanal entrega antes que esperar la recuperación celular.',
      nl: 'Contact Graph Routing via meerdere kanalen bezorgt sneller dan wachten op mobiel herstel.'
    },
    result: {
      en: 'SENDA multipath ≈ 4 min (via neighbor satellite gateway + BLE hop); Direct-to-Cell pass ≈ 91 min; WhatsApp baseline 480 min.',
      es: 'SENDA multicanal ≈ 4 min (vecino con satélite + salto BLE); satélite directo ≈ 91 min; línea base WhatsApp 480 min.',
      nl: 'SENDA multipath ≈ 4 min (buur met satelliet + BLE-hop); direct-to-cell ≈ 91 min; WhatsApp-baseline 480 min.'
    },
    method: {
      en: 'Deterministic Contact Graph Routing engine (packages/senda/src/router.mjs, evidence/senda/scenarios.json).',
      es: 'Motor determinista Contact Graph Routing (packages/senda/src/router.mjs, evidence/senda/scenarios.json).',
      nl: 'Deterministische Contact Graph Routing-engine (packages/senda/src/router.mjs, evidence/senda/scenarios.json).'
    },
    sourcePath: 'evidence/senda/scenarios.json',
    sourceUrl: blob('evidence/senda/scenarios.json'),
    limits: {
      en: 'Fully simulated contacts and link windows. Without neighbors or compatible satellite service, SENDA matches baseline (480 min).',
      es: 'Contactos y ventanas completamente simulados. Sin vecinos ni satélite compatible, SENDA iguala la línea base (480 min).',
      nl: 'Volledig gesimuleerde contacten. Zonder buren of compatibele satelliet evenaart SENDA de baseline (480 min).'
    }
  },
  {
    id: 'EV-ARR-V2',
    category: 'routing',
    status: 'simulated',
    date: '2026-11-17',
    sha: '606f0bf',
    scenario: {
      en: 'H-ARR-R: Receding-horizon custodian planner (120 blocks)',
      es: 'H-ARR-R: Planificador de custodia con replanificación (120 bloques)',
      nl: 'H-ARR-R: Receding-horizon beheerplanner (120 blokken)'
    },
    hypothesis: {
      en: 'Adaptive replanning with ACK gossip maintains high delivery under strict airtime (95 s) and energy (2100 mJ) budgets.',
      es: 'La replanificación adaptativa con gossip de ACK mantiene alta entrega bajo presupuestos estrictos de aire (95 s) y energía (2100 mJ).',
      nl: 'Adaptieve herplanning met ACK-gossip behoudt hoge bezorging binnen strikte zendtijd- (95 s) en energiebudgetten (2100 mJ).'
    },
    result: {
      en: 'ARR_REPLAN_V2: 94.2% delivery, 694 mJ mean energy, 5.4 tx; vs CGR_EARLIEST 58.3% and EPIDEMIC_CEILING 96.7% at 4,420 mJ (0 security violations).',
      es: 'ARR_REPLAN_V2: 94,2 % entrega, 694 mJ energía media, 5,4 tx; frente a CGR_EARLIEST 58,3 % y EPIDEMIC 96,7 % a 4.420 mJ (0 violaciones).',
      nl: 'ARR_REPLAN_V2: 94,2% bezorging, 694 mJ energie, 5,4 tx; vs CGR_EARLIEST 58,3% en EPIDEMIC 96,7% bij 4.420 mJ (0 schendingen).'
    },
    method: {
      en: 'Confirmatory synthetic benchmark over 120 independent disruption blocks (replan-v2-confirmatory.json).',
      es: 'Benchmark sintético confirmatorio sobre 120 bloques independientes (replan-v2-confirmatory.json).',
      nl: 'Synthetische benchmark over 120 onafhankelijke blokken (replan-v2-confirmatory.json).'
    },
    sourcePath: 'investor-next/public/senda/arr/results/replan-v2-confirmatory.json',
    sourceUrl: blob('investor-next/public/senda/arr/results/replan-v2-confirmatory.json'),
    limits: {
      en: 'SIMULATED_ONLY. Energy and airtime figures come from modeled link budgets, not instrumented handset measurements.',
      es: 'SOLO SIMULADO. Las cifras de energía y tiempo de aire provienen de modelos de enlace, no de mediciones en teléfonos.',
      nl: 'ALLEEN GESIMULEERD. Energie- en zendtijdcijfers komen uit linkbudgetmodellen, niet uit fysieke toestelmetingen.'
    }
  },
  {
    id: 'EV-02-SWEEP',
    category: 'protocol',
    status: 'simulated',
    date: '2026-10-22',
    sha: '159796d',
    scenario: {
      en: 'EV-02 & EV-03: 810-scenario sweep & silence-is-UNKNOWN invariant',
      es: 'EV-02 y EV-03: Barrido de 810 escenarios e invariante UNKNOWN',
      nl: 'EV-02 & EV-03: 810-scenariosweep & stilte-is-UNKNOWN-invariant'
    },
    hypothesis: {
      en: 'Across 810 outage parameterizations, silence (no reply) is never reclassified as SOS or casualty.',
      es: 'En 810 parametrizaciones de apagón, el silencio (sin respuesta) nunca se reclasifica como SOS ni víctima.',
      nl: 'Over 810 uitvalscenario’s wordt stilte (geen reactie) nooit geherclassificeerd als SOS of slachtoffer.'
    },
    result: {
      en: '0 human-safety or accounting invariant violations across 810 deterministic synthetic runs.',
      es: '0 violaciones de invariantes de seguridad humana o conteo en 810 ejecuciones deterministas sintéticas.',
      nl: '0 schendingen van menselijke veiligheids- of telinvarianten in 810 deterministische runs.'
    },
    method: {
      en: 'Parameter sweep script (investor-next/scripts/oep-evidence-run.mjs).',
      es: 'Script de barrido de parámetros (investor-next/scripts/oep-evidence-run.mjs).',
      nl: 'Parametersweep-script (investor-next/scripts/oep-evidence-run.mjs).'
    },
    sourcePath: 'docs/investor/EVIDENCE_REGISTER.md',
    sourceUrl: blob('docs/investor/EVIDENCE_REGISTER.md'),
    limits: {
      en: 'Synthetic virtual devices (20-100 nodes). Human behavior in real crises requires responder-supervised evaluation.',
      es: 'Dispositivos virtuales sintéticos (20-100 nodos). El comportamiento humano real exige evaluación con profesionales.',
      nl: 'Synthetische virtuele apparaten (20-100 nodes). Menselijk gedrag vereist evaluatie met hulpverleners.'
    }
  },
  {
    id: 'EV-08-ANDROID',
    category: 'hardware',
    status: 'confirmed',
    date: '2026-11-17',
    sha: '743c4f5',
    scenario: {
      en: 'EV-08: Experimental Android Nearby lab build & JVM signer',
      es: 'EV-08: Laboratorio Android Nearby compilado y firmante JVM',
      nl: 'EV-08: Experimentele Android Nearby-labbuild & JVM-ondertekenaar'
    },
    hypothesis: {
      en: 'Android lab compiles cleanly, pins ephemeral per-session P-256 keys, enforces synthetic-only queue, and erases on STOP.',
      es: 'El lab Android compila limpio, fija claves efímeras P-256 por sesión, restringe la cola a datos sintéticos y purga en STOP.',
      nl: 'Android-lab compileert schoon, pint sessiegebonden P-256-sleutels, dwingt synthetische wachtrij af en wist bij STOP.'
    },
    result: {
      en: 'Debug APK builds in CI; 14 Android/ESP32 frame invariants + JVM ECDSA/queue tests pass; H-PHY-1 telemetry wired.',
      es: 'APK debug compilada en CI; 14 invariantes de trama Android/ESP32 + tests JVM ECDSA/cola en verde; telemetría H-PHY-1 cableada.',
      nl: 'Debug-APK gebouwd in CI; 14 frame-invarianten + JVM ECDSA/wachtrijtests geslaagd; H-PHY-1-telemetrie aangesloten.'
    },
    method: {
      en: 'Gradle assembleDebug + javac/java JVM test harness (.github/workflows/android-nearby-ci.yml).',
      es: 'Gradle assembleDebug + batería JVM (.github/workflows/android-nearby-ci.yml).',
      nl: 'Gradle assembleDebug + JVM-testharnas (.github/workflows/android-nearby-ci.yml).'
    },
    sourcePath: 'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/MainActivity.java',
    sourceUrl: blob('docs/audits/LATEST_ENGINEERING_STATUS.md'),
    limits: {
      en: 'Build & JVM verification ONLY. Zero physical two-handset deliveries measured; plaintext TSV restricted to synthetic payload.',
      es: 'SOLO compilación y JVM. Cero entregas físicas medidas entre dos móviles; el TSV no está cifrado y solo admite carga sintética.',
      nl: 'ALLEEN build & JVM. Nul fysieke leveringen tussen twee toestellen gemeten; TSV is niet versleuteld en alleen synthetisch.'
    }
  },
  {
    id: 'EV-09-PHY',
    category: 'hardware',
    status: 'untested',
    date: '2026-11-19',
    sha: '743c4f5',
    scenario: {
      en: 'EV-09: Physical 2-phone offline trials (30-trial protocol)',
      es: 'EV-09: Ensayo físico entre 2 teléfonos sin red (protocolo de 30 pruebas)',
      nl: 'EV-09: Fysieke 2-telefoon offline proeven (30-proevenprotocol)'
    },
    hypothesis: {
      en: 'Two physical Android phones complete offline signed delivery+ACK across baseline, permission, interruption, replay and TTL tests.',
      es: 'Dos teléfonos Android físicos completan entrega+ACK firmados sin red en 30 intentos con cortes, permisos y repetición.',
      nl: 'Twee fysieke Android-telefoons voltooien offline ondertekende levering+ACK over 30 proeven met onderbrekingen.'
    },
    result: {
      en: '0/30 physical trials recorded (Pending validation — awaiting two consented devices and instrumented field session).',
      es: '0/30 pruebas físicas registradas (Por validar — pendiente de dos dispositivos con consentimiento y sesión instrumentada).',
      nl: '0/30 fysieke proeven geregistreerd (Nog te valideren — wachtend op twee toestellen met toestemming).'
    },
    method: {
      en: 'Validator script ready (investor-next/scripts/validate-field-trials.mjs) + CSV template.',
      es: 'Script validador listo (investor-next/scripts/validate-field-trials.mjs) + plantilla CSV.',
      nl: 'Validatiescript gereed (investor-next/scripts/validate-field-trials.mjs) + CSV-sjabloon.'
    },
    sourcePath: 'experimental/android-nearby/field_trials_template.csv',
    sourceUrl: blob('docs/investor/EVIDENCE_REGISTER.md'),
    limits: {
      en: 'Blocking P0 gate (Issue #5). Overall global TRL remains ~3 until physical trials are executed and published.',
      es: 'Puerta P0 bloqueante (Issue #5). El TRL global permanece en ~3 hasta ejecutar y publicar los ensayos físicos.',
      nl: 'Blokkerende P0-poort (Issue #5). Globale TRL blijft ~3 tot fysieke proeven zijn uitgevoerd.'
    }
  },
  {
    id: 'EV-10-INST',
    category: 'hardware',
    status: 'untested',
    date: '2026-11-19',
    sha: '743c4f5',
    scenario: {
      en: 'EV-10: Live 112/PSAP, licensed satellite uplink & through-wall CSI',
      es: 'EV-10: Integración 112, satélite con operador y Wi-Fi CSI tras muros',
      nl: 'EV-10: Live 112/meldkamer, gelicentieerde satelliet & door-muur CSI'
    },
    hypothesis: {
      en: 'Operational CAP PKI authority verification, carrier satellite D2D relay, and calibrated ESP32 CSI victim detection.',
      es: 'Verificación PKI institucional CAP, relé satelital con operador y detección de víctimas por Wi-Fi CSI calibrada en edificio real.',
      nl: 'Institutionele CAP-PKI-verificatie, satelliet-D2D-relay via operator en gekalibreerde ESP32 CSI-detectie.'
    },
    result: {
      en: 'Not integrated / Not physically validated. Zero live 112 connection, zero licensed satellite link, zero real through-wall trials.',
      es: 'No integrado / Sin validación física. Sin conexión real al 112, sin enlace satelital operativo, sin pruebas reales tras muros.',
      nl: 'Niet geïntegreerd / Niet fysiek gevalideerd. Geen live 112-koppeling, geen satellietlink, geen door-muur veldproeven.'
    },
    method: {
      en: 'Requires formal institutional agreement, spectrum rights, independent security audit, and responder field testing.',
      es: 'Requiere convenio institucional, derechos de espectro, auditoría externa de seguridad y ensayos con rescatadores.',
      nl: 'Vereist formele overeenkomst, spectrumrechten, externe veiligheidsaudit en veldproeven met hulpverleners.'
    },
    sourcePath: 'docs/investor/PILOT_PROPOSAL.md',
    sourceUrl: blob('docs/investor/PILOT_PROPOSAL.md'),
    limits: {
      en: 'Do NOT use SENDA in real emergencies. Secondary research channel only.',
      es: 'NO usar SENDA en emergencias reales. Canal secundario de investigación únicamente.',
      nl: 'Gebruik SENDA NIET in echte noodsituaties. Uitsluitend secundair onderzoekskanaal.'
    }
  },
  {
    id: 'EV-FIRE-HFIREB',
    category: 'fire',
    status: 'predicted',
    date: '2026-11-17',
    sha: '743c4f5',
    scenario: {
      en: 'H-FIRE-B: Exploratory multi-incident GOES-R + HRRR evaluation (n=6)',
      es: 'H-FIRE-B: Evaluación exploratoria GOES-R + HRRR (6 incendios reales)',
      nl: 'H-FIRE-B: Verkennende GOES-R + HRRR-evaluatie (6 echte branden)'
    },
    hypothesis: {
      en: 'Monotone upwind level-set driven by causal HRRR wind outperforms same-area isotropic spread on external wildfires.',
      es: 'El level-set upwind con viento HRRR causal supera al crecimiento isotrópico de igual área en incendios externos.',
      nl: 'Upwind level-set met causale HRRR-wind presteert beter dan isotrope groei van gelijk oppervlak bij externe branden.'
    },
    result: {
      en: 'INCONCLUSIVE (INCONCLUSIVE_OR_NOT_SUPPORTED): Δ growth-CSI +0.0184 (95% CI [-0.0022, +0.0440], includes 0); beats isotropic in 5/6 fires but loses IoU to persistence (-0.1425).',
      es: 'INCONCLUSO (INCONCLUSIVE_OR_NOT_SUPPORTED): Δ growth-CSI +0,0184 (IC 95 % [-0,0022, +0,0440], incluye 0); supera al isotrópico en 5/6 pero pierde en IoU frente a persistencia (-0,1425).',
      nl: 'ONBESLIST (INCONCLUSIVE_OR_NOT_SUPPORTED): Δ growth-CSI +0,0184 (95% BI [-0,0022, +0,0440], bevat 0); wint 5/6 van isotroop maar verliest IoU van persistentie (-0,1425).'
    },
    method: {
      en: 'Causal 3 h horizon over 6 external US fires (palisades, eaton, marshall, smokehouse, troublesome, creek); 10,000-rep bootstrap.',
      es: 'Horizonte causal de 3 h sobre 6 incendios externos de EE. UU.; bootstrap de 10.000 réplicas (semilla 20261117).',
      nl: 'Causale 3-uurshorizon over 6 externe Amerikaanse branden; 10.000-bootstrap (seed 20261117).'
    },
    sourcePath: 'experimental/senda-fire-physics/results/FIRE_REAL_CASES_RESULTS.md',
    sourceUrl: blob('experimental/senda-fire-physics/results/FIRE_REAL_CASES_RESULTS.md'),
    limits: {
      en: 'n=6 < 10 pre-registered minimum; flat terrain, uniform fuel, uncalibrated ROS, point HRRR wind. canIssueEvacuationOrder=false.',
      es: 'n=6 < 10 mínimo prerregistrado; terreno plano, combustible uniforme, ROS sin calibrar. canIssueEvacuationOrder=false.',
      nl: 'n=6 < 10 vooraf geregistreerd minimum; vlak terrein, uniforme brandstof, ongekalibreerde ROS. canIssueEvacuationOrder=false.'
    }
  },
  {
    id: 'EV-FIRE-SMV',
    category: 'fire',
    status: 'observed',
    date: '2026-11-06',
    sha: '5b97a0e',
    scenario: {
      en: 'SENDA-3D: San Martín de Valdeiglesias real wildfire (23-07-2026)',
      es: 'SENDA-3D: Incendio real San Martín de Valdeiglesias (23-07-2026)',
      nl: 'SENDA-3D: Echte natuurbrand San Martín de Valdeiglesias (23-07-2026)'
    },
    hypothesis: {
      en: 'Offline 3D mass-consistent wind + Sentinel-2 burn scar assimilation improves perimeter skill over raw GFS.',
      es: 'El viento 3D con conservación de masa + asimilación de cicatriz Sentinel-2 mejora la habilidad frente a GFS sin asimilar.',
      nl: 'Offline 3D-wind + Sentinel-2-littekenassimilatie verbetert de nauwkeurigheid ten opzichte van ruwe GFS.'
    },
    result: {
      en: 'Observed scar 868 ha (dNBR >= 0.27). Raw model Jaccard 0.064 (worse than same-area circle 0.131); in-sample assimilated Jaccard 0.352.',
      es: 'Cicatriz observada 868 ha (dNBR >= 0,27). Modelo bruto Jaccard 0,064 (peor que círculo 0,131); asimilado dentro de muestra 0,352.',
      nl: 'Waargenomen litteken 868 ha (dNBR >= 0,27). Ruw model Jaccard 0,064 (slechter dan cirkel 0,131); in-sample geassimileerd 0,352.'
    },
    method: {
      en: 'Copernicus DEM GLO-30 + Sentinel-2 L2A + NOAA GFS 0.25° (packages/senda/scripts/fire3d-real.mjs).',
      es: 'Copernicus DEM GLO-30 + Sentinel-2 L2A + NOAA GFS 0,25° (packages/senda/scripts/fire3d-real.mjs).',
      nl: 'Copernicus DEM GLO-30 + Sentinel-2 L2A + NOAA GFS 0,25° (packages/senda/scripts/fire3d-real.mjs).'
    },
    sourcePath: 'docs/paper/SENDA_FUEGO3D_paper.md',
    sourceUrl: blob('docs/paper/SENDA_FUEGO3D_paper.md'),
    limits: {
      en: 'In-sample wind rotation fit (60°, 0.35x); NDVI proxy for fuel; single-case validation cannot generalize without out-of-sample scars.',
      es: 'Ajuste dentro de muestra (giro 60°, factor 0,35); combustible aproximado por NDVI; no generalizable sin casos fuera de muestra.',
      nl: 'In-sample fit (60° draaiing, 0,35x); NDVI-benadering voor brandstof; vereist out-of-sample validatie.'
    }
  },
  {
    id: 'EV-FLOOD-DANA',
    category: 'hazard',
    status: 'observed',
    date: '2026-11-17',
    sha: '606f0bf',
    scenario: {
      en: 'Flood isolation engine: l’Horta Sud (Copernicus EMSR773)',
      es: 'Motor de aislamiento por inundación: l’Horta Sud (EMSR773)',
      nl: 'Overstromingsisolatie-engine: l’Horta Sud (Copernicus EMSR773)'
    },
    hypothesis: {
      en: 'Graph reachability over OSM streets cut by satellite water polygons identifies dry nodes severed from hospitals and responders.',
      es: 'La alcanzabilidad sobre calles OSM cortadas por agua satelital identifica cruces secos sin acceso a hospitales ni bomberos.',
      nl: 'Bereikbaarheid op OSM-wegen gesneden door satellietwater identificeert droge knooppunten zonder route naar ziekenhuizen.'
    },
    result: {
      en: 'Runs deterministically in-browser over observed EMSR773 flood polygons (30-31 Oct 2024) + OSM road graph.',
      es: 'Cálculo determinista en el navegador sobre agua observada EMSR773 (30-31 oct 2024) + grafo vial OSM.',
      nl: 'Draait deterministisch in de browser op waargenomen EMSR773-waterpolygonen (30-31 okt 2024) + OSM-wegennet.'
    },
    method: {
      en: 'Client-side graph solver (packages/senda/src/flood-isolation.mjs, /senda/aislamiento).',
      es: 'Motor de grafos en cliente (packages/senda/src/flood-isolation.mjs, /senda/aislamiento).',
      nl: 'Client-side graafengine (packages/senda/src/flood-isolation.mjs, /senda/aislamiento).'
    },
    sourcePath: 'investor-next/public/senda/data/aislamiento/dana_horta_sud_resultado.json',
    sourceUrl: blob('README.md'),
    limits: {
      en: 'Satellite delineation misses water inside dense urban cores; cut rule is a declared scenario; no water-depth (calado) model.',
      es: 'El satélite no delimita agua en cascos urbanos densos; la regla de corte es un escenario declarado; sin modelo de calado.',
      nl: 'Satelliet mist water in dichte stadskernen; afsnijdingsregel is een verklaard scenario; geen waterdieptemodel.'
    }
  },
  {
    id: 'EV-WATER-NL',
    category: 'hazard',
    status: 'observed',
    date: '2026-11-17',
    sha: '606f0bf',
    scenario: {
      en: 'Netherlands water wave monitor (Rijkswaterstaat snapshot)',
      es: 'Monitor de ondas de crecida en Países Bajos (Rijkswaterstaat)',
      nl: 'Watergolfmonitor Nederland (Rijkswaterstaat-snapshot)'
    },
    hypothesis: {
      en: 'Multi-station water level series reveal upstream-to-downstream wave travel time across Dutch basins.',
      es: 'Las series multiestación permiten medir el tiempo de tránsito de onda entre estaciones en cuencas neerlandesas.',
      nl: 'Meerdere meetstations tonen de reistijd van een watergolf stroomafwaarts over Nederlandse stroomgebieden.'
    },
    result: {
      en: '25 Rijkswaterstaat stations ingested (28 days of observed levels + official forecast snapshot, 17-11-2026 00:50 UTC).',
      es: '25 estaciones de Rijkswaterstaat procesadas (28 días de medidas reales + foto de previsión oficial, 17-11-2026 00:50 UTC).',
      nl: '25 Rijkswaterstaat-stations verwerkt (28 dagen gemeten waterstanden + officiële prognosesnapshot, 17-11-2026 00:50 UTC).'
    },
    method: {
      en: 'Deterministic wave-lag calculator (packages/senda/src/water-nl.mjs, /senda/agua-nl).',
      es: 'Cálculo determinista de desfase de onda (packages/senda/src/water-nl.mjs, /senda/agua-nl).',
      nl: 'Deterministische golfvertraging-berekening (packages/senda/src/water-nl.mjs, /senda/agua-nl).'
    },
    sourcePath: 'packages/senda/src/water-nl.mjs',
    sourceUrl: blob('packages/senda/src/water-nl.mjs'),
    limits: {
      en: 'Static dated snapshot (not live telemetry); SENDA attention rules are NOT official Rijkswaterstaat alarms.',
      es: 'Foto fija fechada (no telemetría en vivo); las reglas de atención de SENDA NO son alarmas oficiales de Rijkswaterstaat.',
      nl: 'Gedateerde snapshot (geen live telemetrie); SENDA-aandachtsregels zijn GEEN officiële Rijkswaterstaat-alarmen.'
    }
  },
  {
    id: 'EV-CONSOLE-16K',
    category: 'hazard',
    status: 'observed',
    date: '2026-11-14',
    sha: '89ee438',
    scenario: {
      en: 'Multi-source situation fusion & cross-source dependence audit',
      es: 'Fusión multisource (16.699 elementos) y auditoría de dependencia',
      nl: 'Multibron-situatiefusie (16.699 items) & bronafhankelijkheidsaudit'
    },
    hypothesis: {
      en: 'Cross-source fusion deduplicates upstream dependencies (e.g., GDACS mirroring USGS) so mirrored feeds never inflate corroboration.',
      es: 'La fusión multisource detecta dependencias aguas arriba (p. ej. GDACS replicando USGS) para no inflar la corroboración.',
      nl: 'Multibronfusie detecteert bronafhankelijkheden (bv. GDACS spiegelt USGS) zodat bevestiging niet kunstmatig stijgt.'
    },
    result: {
      en: '16,699 dated public elements fused (GDACS, DGT, NDW, ADS-B, GOES-16, TfL, Caltrans). Measured: GDACS reproduces 537/555 USGS quakes (median 0 km, 0.5 s).',
      es: '16.699 elementos públicos fechados fusionados (GDACS, DGT, NDW, ADS-B, GOES-16, TfL, Caltrans). Medido: GDACS reproduce 537/555 sismos USGS.',
      nl: '16.699 gedateerde openbare items gefuseerd (GDACS, DGT, NDW, ADS-B, GOES-16, TfL, Caltrans). Gemeten: GDACS herhaalt 537/555 USGS-bevingen.'
    },
    method: {
      en: 'cross-source.mjs & fusion.mjs tested against real snapshots (538/538 core tests).',
      es: 'cross-source.mjs y fusion.mjs probados contra snapshots reales (538/538 pruebas del núcleo).',
      nl: 'cross-source.mjs en fusion.mjs getest op echte snapshots (538/538 kerntests).'
    },
    sourcePath: 'packages/senda/src/cross-source.mjs',
    sourceUrl: blob('packages/senda/src/cross-source.mjs'),
    limits: {
      en: 'Dated snapshots, not real-time streaming feeds. Camera counts use YOLOX-s + ByteTrack with ~±30% speed error; zero license plate reading.',
      es: 'Fotos de datos fechadas, no flujos en tiempo real. El conteo con cámaras tiene error ≈ ±30 % en velocidad; cero lectura de matrículas.',
      nl: 'Gedateerde snapshots, geen realtime feeds. Cameratellingen hebben ~±30% snelheidsfout; geen kentekenherkenning.'
    }
  },
  {
    id: 'EV-RAIL-ADAMUZ',
    category: 'hazard',
    status: 'simulated',
    date: '2026-11-04',
    sha: '5b97a0e',
    scenario: {
      en: 'Rail incident multi-train fusion (2-train scenario, 8 seeds)',
      es: 'Fusión de incidente ferroviario con dos trenes (8 semillas)',
      nl: 'Spoorincidentfusie met twee treinen (8 seeds)'
    },
    hypothesis: {
      en: 'Passenger handset crash detection + offline fusion identifies a second derailed train even at 5% app adoption.',
      es: 'La detección de impacto en móviles + fusión offline identifica un segundo tren descarrilado incluso con 5 % de adopción.',
      nl: 'Crashdetectie op passagierstelefoons + offline fusie identificeert een tweede ontspoorde trein zelfs bij 5% adoptie.'
    },
    result: {
      en: 'Second train identified in 30-41 s across 8 seeds (simulated), vs ~45 min reported in press chronologies of Adamuz (18-01-2026).',
      es: 'Segundo tren identificado en 30-41 s en 8 semillas (simulado), frente a ≈45 min citados en prensa para Adamuz (18-01-2026).',
      nl: 'Tweede trein geïdentificeerd in 30-41 s over 8 seeds (gesimuleerd), vs ~45 min gemeld voor Adamuz (18-01-2026).'
    },
    method: {
      en: 'rail-incident.mjs & rail-scenario.mjs unit + Chromium E2E tests.',
      es: 'Pruebas unitarias y E2E en Chromium de rail-incident.mjs y rail-scenario.mjs.',
      nl: 'Unit- en Chromium E2E-tests van rail-incident.mjs en rail-scenario.mjs.'
    },
    sourcePath: 'packages/senda/src/rail-scenario.mjs',
    sourceUrl: blob('docs/product/SENDA_VISION_2026-11-04.md'),
    limits: {
      en: 'Simulated accelerometer profiles and passenger distribution. Press figures for Adamuz must be contrasted with official investigation; no rail operator agreement exists.',
      es: 'Perfiles de acelerómetro y pasajeros simulados. Las cifras de prensa de Adamuz deben contrastarse con la investigación oficial; sin convenio ferroviario.',
      nl: 'Gesimuleerde versnellingsmeters. Perscijfers van Adamuz dienen met officieel onderzoek getoetst te worden; geen spoorwegovereenkomst.'
    }
  },
  {
    id: 'EV-ACOUSTIC',
    category: 'protocol',
    status: 'observed',
    date: '2026-11-04',
    sha: '5b97a0e',
    scenario: {
      en: 'Acoustic modem MFSK-16 (offline audio fallback)',
      es: 'Módem acústico MFSK-16 (respaldo por sonido sin red)',
      nl: 'Akoestische modem MFSK-16 (offline geluidsfallback)'
    },
    hypothesis: {
      en: 'Compact ~300 B encrypted envelope survives room echo, 10 dB noise, mains hum, and 48->44.1 kHz resampling with zero false payloads.',
      es: 'Un sobre cifrado de ~300 B sobrevive eco de sala, ruido 10 dB, zumbido de red y remuestreo 48->44,1 kHz sin entregar basura.',
      nl: 'Compacte versleutelde envelop (~300 B) doorstaat galm, 10 dB ruis, netbrom en 48->44,1 kHz resampling zonder foutieve data.'
    },
    result: {
      en: 'Round-trip verified in software DSP (~31 s audio per message) with Hamming(7,4) FEC + CRC-32; zero corrupted frames accepted.',
      es: 'Ida y vuelta verificada en DSP (~31 s de audio por mensaje) con Hamming(7,4) + CRC-32; cero tramas corruptas aceptadas.',
      nl: 'Round-trip geverifieerd in DSP (~31 s audio per bericht) met Hamming(7,4) + CRC-32; nul corrupte frames geaccepteerd.'
    },
    method: {
      en: 'acoustic-modem.mjs test suite + browser WebAudio round-trip.',
      es: 'Batería acoustic-modem.mjs + ida y vuelta WebAudio en navegador.',
      nl: 'acoustic-modem.mjs-testsuite + WebAudio round-trip in browser.'
    },
    sourcePath: 'packages/senda/src/acoustic-modem.mjs',
    sourceUrl: blob('packages/senda/src/acoustic-modem.mjs'),
    limits: {
      en: 'Modeled acoustic channel & lab browser tests; field acoustics under rubble/crowds remain unmeasured.',
      es: 'Canal acústico modelado y pruebas de laboratorio; la acústica real bajo escombros o ruido extremo está sin medir.',
      nl: 'Gemodelleerd akoestisch kanaal en labtests; echte akoestiek onder puin of menigten is niet gemeten.'
    }
  },
  {
    id: 'EV-NEPAL-3D',
    category: 'hazard',
    status: 'observed',
    date: '2026-11-14',
    sha: '89ee438',
    scenario: {
      en: 'Langtang, Nepal collapse 3D reconstruction (USGS + Sentinel-2)',
      es: 'Reconstrucción 3D colapso de Langtang, Nepal (USGS + Sentinel-2)',
      nl: 'Langtang, Nepal instorting 3D-reconstructie (USGS + Sentinel-2)'
    },
    hypothesis: {
      en: 'Open seismic catalog + pre/post Sentinel-2 NDVI change + Copernicus DEM GLO-30 enable offline 3D terrain briefing.',
      es: 'Catálogo sísmico abierto + cambio NDVI Sentinel-2 + DEM GLO-30 permiten un sobrevuelo 3D offline.',
      nl: 'Open seismische catalogus + Sentinel-2 NDVI-verandering + Copernicus DEM maken offline 3D-terreinanalyse mogelijk.'
    },
    result: {
      en: 'USGS us7000tbwb (M 5.2 landslide, 26-08-2026) fused with Sentinel-2 (12-08 & 26-10) and 44.6 km least-cost computed path.',
      es: 'USGS us7000tbwb (M 5,2 deslizamiento, 26-08-2026) fusionado con Sentinel-2 (12-08 y 26-10) y ruta calculada de 44,6 km.',
      nl: 'USGS us7000tbwb (M 5,2 aardverschuiving, 26-08-2026) gecombineerd met Sentinel-2 en berekende route van 44,6 km.'
    },
    method: {
      en: 'nepal_langtang_s2.py & nepal_langtang_3d.py; interactive viewer at /senda/vuelo.',
      es: 'nepal_langtang_s2.py y nepal_langtang_3d.py; visor interactivo en /senda/vuelo.',
      nl: 'nepal_langtang_s2.py en nepal_langtang_3d.py; interactieve viewer op /senda/vuelo.'
    },
    sourcePath: 'docs/research/NEPAL_LANGTANG_2026-08-26.md',
    sourceUrl: blob('docs/research/NEPAL_LANGTANG_2026-08-26.md'),
    limits: {
      en: 'Computed NDVI change is NOT an official damage map (false positives near snow/clouds). Casualty counts omitted due to conflicting sources.',
      es: 'El cambio NDVI NO es un mapa oficial de daños (falsos positivos junto a nieve). Se omiten cifras de víctimas por fuentes divergentes.',
      nl: 'NDVI-verandering is GEEN officiële schadekaart (foutpositieven bij sneeuw). Slachtofferaantallen weggelaten wegens tegenstrijdige bronnen.'
    }
  }
];

export function getEvidenceById(id: string): EvidenceRecord {
  const found = EVIDENCE_RECORDS.find((r) => r.id === id);
  if (!found) return EVIDENCE_RECORDS[0];
  return found;
}

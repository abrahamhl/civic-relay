import type { Locale } from './types';

/**
 * Contenido de la portada "pro" (2026-11-20).
 * Regla del proyecto (CLAUDE.md): ninguna cifra sin origen. Cada número lleva
 * su fecha, su comando o su registro de evidencia; toda simulación se rotula como tal.
 */

type L<T> = Record<Locale, T>;

/** Cifra medida directamente el 2026-11-20 con `node --test packages/senda/tests/*.test.mjs`. */
export const MEASURED_TESTS = {
  value: '705 / 705',
  date: '2026-11-20',
  command: 'node --test packages/senda/tests/*.test.mjs',
  commit: '7bf8b4b'
} as const;

export type Audience = 'citizen' | 'institution' | 'investor' | 'engineer';

export const AUDIENCES: Audience[] = ['citizen', 'institution', 'investor', 'engineer'];

export const PRO = {
  hero: {
    kicker: {
      es: 'SENDA · Enrutamiento de emergencia por canales alternativos',
      en: 'SENDA · Emergency routing over alternative channels',
      nl: 'SENDA · Noodroutering via alternatieve kanalen'
    } as L<string>,
    title: {
      es: 'Si existe un camino hasta tu gente, SENDA lo encuentra.',
      en: 'If a path to your people exists, SENDA finds it.',
      nl: 'Als er een weg naar uw mensen bestaat, vindt SENDA die.'
    } as L<string>,
    lens: {
      es: { citizen: 'Ciudadano', institution: 'Institución', investor: 'Inversor', engineer: 'Ingeniería' },
      en: { citizen: 'Citizen', institution: 'Institution', investor: 'Investor', engineer: 'Engineering' },
      nl: { citizen: 'Burger', institution: 'Instelling', investor: 'Investeerder', engineer: 'Techniek' }
    } as L<Record<Audience, string>>,
    lead: {
      es: {
        citizen:
          'Cuando una riada, un terremoto o un accidente corta la cobertura, tu móvil sigue intentando que tu aviso llegue: lo cifra, lo guarda y lo pasa de teléfono en teléfono, o por satélite, hasta alcanzar a tu familia. Tú solo pulsas «Estoy bien» o «Necesito ayuda».',
        institution:
          'SENDA da a protección civil, bomberos y policía un canal adicional cuando la red falla: relé preautorizado por una autoridad, coordinación de familias e instituciones, y un mapa operativo con cada dato rotulado como observado, predicho o simulado.',
        investor:
          'Un sistema de comunicación y coordinación para el momento en que las redes caen. Código abierto, núcleo verificable por pruebas automáticas, línea de investigación documentada y una hoja de ruta por hitos con criterio de salida medible.',
        engineer:
          'Mensajes con sobre cifrado, cola de almacenar-y-reenviar, selección de ruta multipath, deduplicación, anti-repetición y recibos firmados. Núcleo en JavaScript con pruebas deterministas; laboratorio Android; centro de control en Next.js con MapLibre y Three.js.'
      },
      en: {
        citizen:
          'When a flood, an earthquake or a crash takes the network down, your phone keeps trying to deliver your message: it encrypts it, stores it and hands it from phone to phone, or over satellite, until it reaches your family. You only press “I am safe” or “I need help”.',
        institution:
          'SENDA gives civil protection, fire and police services an extra channel when the network fails: relay mode pre-authorised by an authority, coordination of families and agencies, and an operational map where every datum is labelled observed, predicted or simulated.',
        investor:
          'A communication and coordination system for the moment networks go down. Open source, a core verifiable through automated tests, a documented research line, and a milestone roadmap with measurable exit criteria.',
        engineer:
          'Encrypted envelopes, a store-and-forward queue, multipath route selection, deduplication, anti-replay and signed receipts. JavaScript core with deterministic tests; Android lab; control centre in Next.js with MapLibre and Three.js.'
      },
      nl: {
        citizen:
          'Als een overstroming, aardbeving of ongeval het netwerk uitschakelt, blijft uw telefoon proberen uw bericht af te leveren: versleuteld, opgeslagen en doorgegeven van toestel naar toestel of via satelliet, tot het uw familie bereikt. U drukt alleen op “Ik ben veilig” of “Ik heb hulp nodig”.',
        institution:
          'SENDA geeft civiele bescherming, brandweer en politie een extra kanaal wanneer het netwerk uitvalt: relaymodus vooraf geautoriseerd door een autoriteit, coördinatie van gezinnen en diensten, en een operationele kaart waarop elk gegeven als waargenomen, voorspeld of gesimuleerd is gelabeld.',
        investor:
          'Een communicatie- en coördinatiesysteem voor het moment dat netwerken uitvallen. Open source, een kern die met automatische tests controleerbaar is, gedocumenteerd onderzoek en een mijlpalenplan met meetbare uitstapcriteria.',
        engineer:
          'Versleutelde enveloppen, store-and-forward-wachtrij, multipath-routekeuze, deduplicatie, anti-replay en ondertekende ontvangstbewijzen. JavaScript-kern met deterministische tests; Android-lab; controlecentrum in Next.js met MapLibre en Three.js.'
      }
    } as L<Record<Audience, string>>,
    ctaDemo: { es: 'Ver la demostración', en: 'See the demo', nl: 'Bekijk de demo' } as L<string>,
    ctaPlatform: { es: 'Abrir el centro de control', en: 'Open the control centre', nl: 'Open het controlecentrum' } as L<string>
  },

  figures: {
    kicker: { es: 'Cifras medidas', en: 'Measured figures', nl: 'Gemeten cijfers' } as L<string>,
    tests: {
      es: 'Pruebas automáticas del núcleo en verde',
      en: 'Core automated tests passing',
      nl: 'Automatische kerntests geslaagd'
    } as L<string>,
    testsSrc: {
      es: `Medido ${MEASURED_TESTS.date} · ${MEASURED_TESTS.command} · commit ${MEASURED_TESTS.commit}`,
      en: `Measured ${MEASURED_TESTS.date} · ${MEASURED_TESTS.command} · commit ${MEASURED_TESTS.commit}`,
      nl: `Gemeten ${MEASURED_TESTS.date} · ${MEASURED_TESTS.command} · commit ${MEASURED_TESTS.commit}`
    } as L<string>,
    offline: {
      value: '49 / 49',
      label: {
        es: 'Comprobaciones de extremo a extremo con la red cortada (3 teléfonos virtuales)',
        en: 'End-to-end checks with the network cut (3 virtual handsets)',
        nl: 'End-to-end-controles zonder netwerk (3 virtuele toestellen)'
      } as L<string>,
      evidenceId: 'EV-OFFLINE-49'
    },
    sweep: {
      value: '810',
      label: {
        es: 'Escenarios de enrutamiento con semilla, reproducibles',
        en: 'Seeded, reproducible routing scenarios',
        nl: 'Reproduceerbare routeringsscenario’s met seed'
      } as L<string>,
      evidenceId: 'EV-02-SWEEP'
    },
    fusion: {
      value: '16.699',
      label: {
        es: 'Elementos públicos de riesgo y movilidad fusionados en el centro de control',
        en: 'Public hazard and mobility items fused in the control centre',
        nl: 'Openbare risico- en mobiliteitsitems gefuseerd in het controlecentrum'
      } as L<string>,
      evidenceId: 'EV-CONSOLE-16K'
    }
  },

  how: {
    kicker: { es: 'Cómo funciona', en: 'How it works', nl: 'Hoe het werkt' } as L<string>,
    title: {
      es: 'Un mensaje, todos los caminos posibles, una sola copia.',
      en: 'One message, every possible path, a single copy.',
      nl: 'Eén bericht, elk mogelijk pad, één enkele kopie.'
    } as L<string>,
    lead: {
      es: 'Seis pasos, siempre en el mismo orden. Cada uno es una pieza del núcleo con sus propias pruebas.',
      en: 'Six steps, always in the same order. Each is a core component with its own tests.',
      nl: 'Zes stappen, altijd in dezelfde volgorde. Elke stap is een kernonderdeel met eigen tests.'
    } as L<string>,
    steps: {
      es: [
        ['Mensaje', 'Tu aviso se cifra en el propio teléfono con un sobre firmado. Nadie en el camino puede leerlo.'],
        ['Almacenar', 'Si no hay ruta, el mensaje espera en una cola acotada con caducidad. No se pierde ni se reenvía sin tu consentimiento.'],
        ['Elegir ruta', 'Bluetooth y Wi-Fi Direct con vecinos, SMS, satélite o una pasarela: se elige la más rápida disponible en ese momento.'],
        ['Varios caminos', 'Si hay más de una, el mensaje sale por todas a la vez. Cuantos más caminos, más probable que llegue.'],
        ['Una sola copia', 'Si llega dos veces, cuenta una. Las repeticiones y los mensajes antiguos reinyectados se descartan.'],
        ['Recibo firmado', 'Quien recibe devuelve un recibo firmado. Solo entonces el emisor sabe que su aviso llegó.']
      ],
      en: [
        ['Message', 'Your alert is encrypted on the phone itself in a signed envelope. Nobody along the way can read it.'],
        ['Store', 'With no route available the message waits in a bounded queue with an expiry. It is neither lost nor forwarded without your consent.'],
        ['Choose a route', 'Bluetooth and Wi-Fi Direct with neighbours, SMS, satellite or a gateway: the fastest one available at that moment is chosen.'],
        ['Several paths', 'If there is more than one, the message goes out on all of them at once. More paths, higher chance of delivery.'],
        ['One copy', 'If it arrives twice, it counts once. Repeats and old messages replayed by an attacker are discarded.'],
        ['Signed receipt', 'The receiver returns a signed receipt. Only then does the sender know the alert arrived.']
      ],
      nl: [
        ['Bericht', 'Uw melding wordt op de telefoon zelf versleuteld in een ondertekende envelop. Niemand onderweg kan het lezen.'],
        ['Opslaan', 'Zonder route wacht het bericht in een begrensde wachtrij met vervaldatum. Het gaat niet verloren en wordt niet zonder uw toestemming doorgestuurd.'],
        ['Route kiezen', 'Bluetooth en Wi-Fi Direct met buren, sms, satelliet of een gateway: de snelste beschikbare route wordt gekozen.'],
        ['Meerdere paden', 'Is er meer dan één pad, dan gaat het bericht tegelijk over alle paden. Meer paden, meer kans op aankomst.'],
        ['Eén kopie', 'Komt het twee keer aan, dan telt het één keer. Herhalingen en opnieuw afgespeelde oude berichten worden genegeerd.'],
        ['Ondertekend bewijs', 'De ontvanger stuurt een ondertekend ontvangstbewijs terug. Pas dan weet de afzender dat de melding aankwam.']
      ]
    } as L<string[][]>
  },

  demo: {
    kicker: { es: 'Demostración', en: 'Demonstration', nl: 'Demonstratie' } as L<string>,
    title: {
      es: 'Pruébalo: corta las torres y mira qué camino encuentra.',
      en: 'Try it: cut the towers and see which path it finds.',
      nl: 'Probeer het: schakel de masten uit en zie welk pad het vindt.'
    } as L<string>,
    simTag: { es: 'Simulación', en: 'Simulation', nl: 'Simulatie' } as L<string>,
    simNote: {
      es: 'Todo lo que se muestra aquí es una simulación en el navegador con parámetros declarados. No es una medición en campo.',
      en: 'Everything shown here is an in-browser simulation with declared parameters. It is not a field measurement.',
      nl: 'Alles wat hier wordt getoond is een simulatie in de browser met opgegeven parameters. Het is geen veldmeting.'
    } as L<string>,
    film: {
      es: 'Película de presentación (con subtítulos ES / EN / NL)',
      en: 'Presentation film (with ES / EN / NL subtitles)',
      nl: 'Presentatiefilm (met ondertitels ES / EN / NL)'
    } as L<string>
  },

  platform: {
    kicker: { es: 'Centro de control', en: 'Control centre', nl: 'Controlecentrum' } as L<string>,
    title: {
      es: 'Un mapa, un panel de detalle y una línea de tiempo.',
      en: 'One map, one detail panel and a timeline.',
      nl: 'Eén kaart, één detailpaneel en een tijdlijn.'
    } as L<string>,
    lead: {
      es: 'Lo que ya conoces de cualquier herramienta de mapas: capas a la izquierda, ficha del objeto a la derecha, tiempo abajo y una barra de comandos con ⌘K. Cada elemento enlaza con su evidencia.',
      en: 'What you already know from any mapping tool: layers on the left, object card on the right, time at the bottom and a ⌘K command bar. Every item links to its evidence.',
      nl: 'Wat u kent uit elk kaartprogramma: lagen links, objectkaart rechts, tijd onderaan en een ⌘K-opdrachtbalk. Elk item verwijst naar zijn bewijs.'
    } as L<string>,
    points: {
      es: [
        ['Correlación', 'Une incidente, sensor, ruta y decisión en un grafo y explica por qué se relacionan.'],
        ['Monitoreo', 'Fuentes públicas fechadas: incendios, riadas, nivel del agua, tráfico y ferrocarril.'],
        ['Control', 'Acciones de coordinación con confirmación en dos pasos y registro de auditoría. Siempre rotuladas como simulación.']
      ],
      en: [
        ['Correlation', 'Joins incident, sensor, route and decision in a graph and explains why they are related.'],
        ['Monitoring', 'Dated public sources: fires, floods, water level, road and rail traffic.'],
        ['Control', 'Coordination actions with two-step confirmation and an audit log. Always labelled as simulation.']
      ],
      nl: [
        ['Correlatie', 'Verbindt incident, sensor, route en beslissing in een graaf en legt uit waarom ze samenhangen.'],
        ['Monitoring', 'Gedateerde openbare bronnen: branden, overstromingen, waterstand, weg- en spoorverkeer.'],
        ['Besturing', 'Coördinatieacties met bevestiging in twee stappen en auditlog. Altijd als simulatie gelabeld.']
      ]
    } as L<string[][]>,
    cta: { es: 'Abrir el centro de control', en: 'Open the control centre', nl: 'Open het controlecentrum' } as L<string>
  },

  real: {
    kicker: { es: 'Datos reales', en: 'Real data', nl: 'Echte data' } as L<string>,
    title: {
      es: 'Trabajamos con datos de episodios reales y fuentes públicas.',
      en: 'We work with data from real events and public sources.',
      nl: 'We werken met data van echte gebeurtenissen en openbare bronnen.'
    } as L<string>,
    lead: {
      es: 'Cada tarjeta indica la fuente, la fecha y el estado de la evidencia. Pulsa la etiqueta para ver el método.',
      en: 'Each card names the source, the date and the evidence status. Press the label to see the method.',
      nl: 'Elke kaart noemt de bron, de datum en de status van het bewijs. Druk op het label voor de methode.'
    } as L<string>,
    items: [
      {
        id: 'EV-FIRE-SMV',
        title: { es: 'Incendio de San Martín de Valdeiglesias', en: 'San Martín de Valdeiglesias wildfire', nl: 'Bosbrand San Martín de Valdeiglesias' } as L<string>,
        body: { es: 'Reconstrucción 3D del incendio real del 23-07-2026.', en: 'Real wildfire of 23-07-2026 rebuilt in 3D.', nl: 'Echte brand van 23-07-2026 in 3D gereconstrueerd.' } as L<string>,
        src: 'NASA FIRMS · Copernicus'
      },
      {
        id: 'EV-FLOOD-DANA',
        title: { es: 'Aislamiento por inundación en l’Horta Sud', en: 'Flood isolation in l’Horta Sud', nl: 'Isolatie door overstroming in l’Horta Sud' } as L<string>,
        body: { es: 'Motor que detecta zonas aisladas a partir del mapa de emergencia de Copernicus.', en: 'Engine that detects isolated areas from the Copernicus emergency map.', nl: 'Engine die geïsoleerde gebieden detecteert op basis van de Copernicus-noodkaart.' } as L<string>,
        src: 'Copernicus EMSR773'
      },
      {
        id: 'EV-WATER-NL',
        title: { es: 'Ola de agua en los Países Bajos', en: 'Water wave in the Netherlands', nl: 'Watergolf in Nederland' } as L<string>,
        body: { es: 'Seguimiento del nivel del agua con datos de la administración neerlandesa.', en: 'Water-level tracking with Dutch government data.', nl: 'Waterstandsmonitoring met gegevens van de Nederlandse overheid.' } as L<string>,
        src: 'Rijkswaterstaat'
      },
      {
        id: 'EV-NEPAL-3D',
        title: { es: 'Derrumbe de Langtang, Nepal', en: 'Langtang collapse, Nepal', nl: 'Instorting Langtang, Nepal' } as L<string>,
        body: { es: 'Reconstrucción 3D a partir de sismología y satélite.', en: '3D reconstruction from seismology and satellite imagery.', nl: '3D-reconstructie uit seismologie en satellietbeelden.' } as L<string>,
        src: 'USGS · Sentinel-2'
      },
      {
        id: 'EV-CONSOLE-16K',
        title: { es: 'Fusión de fuentes sin inflar la confianza', en: 'Source fusion without inflating confidence', nl: 'Bronfusie zonder vertrouwen op te blazen' } as L<string>,
        body: { es: 'Detecta cuando una fuente copia a otra (por ejemplo GDACS y USGS) para no contar dos veces el mismo hecho.', en: 'Detects when one source mirrors another (for example GDACS and USGS) so the same fact is not counted twice.', nl: 'Detecteert wanneer een bron een andere spiegelt (bijv. GDACS en USGS) zodat hetzelfde feit niet dubbel telt.' } as L<string>,
        src: 'GDACS · USGS · DGT · NDW'
      },
      {
        id: 'EV-ACOUSTIC',
        title: { es: 'Módem acústico sin red', en: 'Acoustic modem without a network', nl: 'Akoestische modem zonder netwerk' } as L<string>,
        body: { es: 'Transmisión de datos por sonido entre teléfonos cuando no hay ningún otro canal.', en: 'Data transmission by sound between phones when no other channel exists.', nl: 'Gegevensoverdracht via geluid tussen telefoons als er geen ander kanaal is.' } as L<string>,
        src: 'MFSK-16'
      }
    ]
  },

  rnd: {
    kicker: { es: 'Investigación y desarrollo', en: 'Research and development', nl: 'Onderzoek en ontwikkeling' } as L<string>,
    title: {
      es: 'Cuatro líneas abiertas que hacen más fiable cada paso.',
      en: 'Four open lines that make each step more reliable.',
      nl: 'Vier open lijnen die elke stap betrouwbaarder maken.'
    } as L<string>,
    lead: {
      es: 'Cada línea parte de una hipótesis escrita, tiene un criterio de éxito y publica sus resultados, incluidos los no concluyentes.',
      en: 'Each line starts from a written hypothesis, has a success criterion and publishes its results, including inconclusive ones.',
      nl: 'Elke lijn start met een geschreven hypothese, heeft een succescriterium en publiceert resultaten, ook niet-conclusieve.'
    } as L<string>,
    items: [
      {
        id: 'EV-ARR-V2',
        title: { es: 'Custodia con replanificación', en: 'Custody with replanning', nl: 'Beheer met herplanning' } as L<string>,
        body: {
          es: 'Un planificador que decide qué teléfono guarda cada mensaje y vuelve a planear cuando cambia la red, dentro de un presupuesto de tiempo de aire (95 s) y de energía (2.100 mJ).',
          en: 'A planner that decides which phone holds each message and replans when the network changes, within an airtime budget (95 s) and an energy budget (2,100 mJ).',
          nl: 'Een planner die bepaalt welke telefoon elk bericht bewaart en herplant als het netwerk verandert, binnen een zendtijdbudget (95 s) en energiebudget (2.100 mJ).'
        } as L<string>
      },
      {
        id: 'EV-09-PHY',
        title: { es: 'Campaña física con dos teléfonos', en: 'Two-handset physical campaign', nl: 'Fysieke campagne met twee toestellen' } as L<string>,
        body: {
          es: 'Protocolo instrumentado de 30 pruebas entre dos móviles Android reales en modo avión, con registro bruto publicado y observador independiente.',
          en: 'Instrumented 30-trial protocol between two real Android phones in airplane mode, with raw log published and an independent observer.',
          nl: 'Geïnstrumenteerd protocol van 30 proeven tussen twee echte Android-telefoons in vliegtuigmodus, met gepubliceerd ruwlogboek en onafhankelijke waarnemer.'
        } as L<string>
      },
      {
        id: 'EV-FIRE-HFIREB',
        title: { es: 'Fuego con varios satélites y modelos', en: 'Fire with several satellites and models', nl: 'Brand met meerdere satellieten en modellen' } as L<string>,
        body: {
          es: 'Evaluación exploratoria que combina el satélite GOES-R con el modelo meteorológico HRRR sobre 6 incendios reales. Resultado actual: no concluyente; se amplía la muestra.',
          en: 'Exploratory evaluation combining the GOES-R satellite with the HRRR weather model over 6 real fires. Current result: inconclusive; the sample is being extended.',
          nl: 'Verkennende evaluatie die de GOES-R-satelliet combineert met het HRRR-weermodel op 6 echte branden. Huidig resultaat: niet-conclusief; de steekproef wordt uitgebreid.'
        } as L<string>
      },
      {
        id: 'EV-10-INST',
        title: { es: 'Autorización institucional', en: 'Institutional authorisation', nl: 'Institutionele autorisatie' } as L<string>,
        body: {
          es: 'Alertas oficiales en formato CAP 1.2 firmadas con infraestructura de clave pública, para que el modo relé solo se active por orden de una autoridad.',
          en: 'Official CAP 1.2 alerts signed with a public-key infrastructure, so relay mode only activates on an authority’s order.',
          nl: 'Officiële CAP 1.2-meldingen ondertekend met een public-key-infrastructuur, zodat de relaymodus alleen op bevel van een autoriteit start.'
        } as L<string>
      }
    ]
  },

  roadmap: {
    kicker: { es: 'Hoja de ruta', en: 'Roadmap', nl: 'Routekaart' } as L<string>,
    title: {
      es: 'Qué se activa con cada acuerdo.',
      en: 'What each agreement unlocks.',
      nl: 'Wat elke overeenkomst mogelijk maakt.'
    } as L<string>,
    lead: {
      es: 'Cinco hitos con entregable y criterio de salida medible. Los plazos cuentan desde el inicio de cada fase.',
      en: 'Five milestones, each with a deliverable and a measurable exit criterion. Timelines count from the start of each phase.',
      nl: 'Vijf mijlpalen, elk met een resultaat en een meetbaar uitstapcriterium. Termijnen tellen vanaf de start van elke fase.'
    } as L<string>,
    cols: {
      es: ['Hito', 'Plazo', 'Entregable', 'Criterio de salida', 'Lo que lo desbloquea'],
      en: ['Milestone', 'Timeline', 'Deliverable', 'Exit criterion', 'What unlocks it'],
      nl: ['Mijlpaal', 'Termijn', 'Resultaat', 'Uitstapcriterium', 'Wat het mogelijk maakt']
    } as L<string[]>,
    rows: {
      es: [
        ['M0 · Base reproducible', 'Completado (oct. 2026)', 'Simulador determinista de 20–100 nodos, motor de almacenar-y-reenviar, 810 escenarios en integración continua, web multilingüe.', 'Escenarios reproducibles y pruebas en verde sobre un commit exacto.', 'Hecho'],
        ['M1 · Laboratorio con dos teléfonos', 'Meses 1–2', 'Ejecución del protocolo de aceptación en dos móviles Android reales en modo avión.', '30 pruebas documentadas, 0 confirmaciones falsas, CSV bruto publicado.', 'Dos teléfonos y un observador independiente'],
        ['M2 · Cadena de varios saltos y recibos firmados', 'Meses 3–6', 'Cadena de 3 a 5 dispositivos con recibos firmados, persistencia en disco y verificador CAP en banco de pruebas.', 'Tasa de entrega, consumo de batería medidos; cero repeticiones o falsificaciones aceptadas en prueba de equipo rojo.', 'Equipo de seguridad independiente'],
        ['M3 · Ejercicio con protección civil', 'Meses 7–12', 'Ejercicio co-diseñado con una región de seguridad y un laboratorio académico (15–30 móviles voluntarios, simulacro).', 'Informe de observador independiente, evaluación de impacto en protección de datos y evaluación de uso con coordinadores.', 'Convenio con una protección civil municipal o regional y un laboratorio'],
        ['M4 · Pasarelas e interoperabilidad', 'Meses 13–18', 'Adaptadores para pasarelas externas (Wi-Fi municipal, LoRa, banco de pruebas satelital autorizado) y avisos públicos de prueba.', 'Demostración de extremo a extremo en un entorno de formación, sin tocar el tráfico real del 112.', 'Acuerdos con operador de pasarela y autoridad de alertas']
      ],
      en: [
        ['M0 · Reproducible baseline', 'Completed (Oct 2026)', 'Deterministic 20–100 node simulator, store-and-forward engine, 810 scenarios in continuous integration, multilingual web.', 'Reproducible scenarios and green tests on an exact commit.', 'Done'],
        ['M1 · Two-phone laboratory', 'Months 1–2', 'Run the acceptance protocol on two real Android phones in airplane mode.', '30 documented trials, 0 false acknowledgements, raw CSV published.', 'Two phones and an independent observer'],
        ['M2 · Multi-hop chain and signed receipts', 'Months 3–6', 'Chain of 3 to 5 devices with signed receipts, on-disk persistence and a CAP verifier in a sandbox.', 'Measured delivery rate and battery use; zero replays or forgeries accepted in a red-team test.', 'Independent security team'],
        ['M3 · Civil-protection exercise', 'Months 7–12', 'Exercise co-designed with a safety region and an academic lab (15–30 volunteer phones, drill).', 'Independent observer report, data-protection impact assessment and usability evaluation with coordinators.', 'Agreement with a municipal or regional civil protection body and a lab'],
        ['M4 · Gateways and interoperability', 'Months 13–18', 'Adapters for external gateways (municipal Wi-Fi, LoRa, authorised satellite testbed) and public warning test feeds.', 'End-to-end demonstration in a training environment, without touching live 112 traffic.', 'Agreements with a gateway operator and an alerting authority']
      ],
      nl: [
        ['M0 · Reproduceerbare basis', 'Voltooid (okt. 2026)', 'Deterministische simulator met 20–100 knooppunten, store-and-forward-engine, 810 scenario’s in continue integratie, meertalige website.', 'Reproduceerbare scenario’s en groene tests op een exacte commit.', 'Klaar'],
        ['M1 · Laboratorium met twee telefoons', 'Maand 1–2', 'Het acceptatieprotocol uitvoeren op twee echte Android-telefoons in vliegtuigmodus.', '30 gedocumenteerde proeven, 0 valse bevestigingen, ruwe CSV gepubliceerd.', 'Twee telefoons en een onafhankelijke waarnemer'],
        ['M2 · Keten met meerdere sprongen en ondertekende bewijzen', 'Maand 3–6', 'Keten van 3 tot 5 apparaten met ondertekende bewijzen, persistente opslag en een CAP-verifier in een testomgeving.', 'Gemeten aflevering en batterijverbruik; nul geaccepteerde replays of vervalsingen in een red-teamtest.', 'Onafhankelijk beveiligingsteam'],
        ['M3 · Oefening met civiele bescherming', 'Maand 7–12', 'Samen ontworpen oefening met een veiligheidsregio en een academisch lab (15–30 vrijwilligerstelefoons, oefening).', 'Onafhankelijk waarnemersrapport, gegevensbeschermingseffectbeoordeling en gebruiksevaluatie met coördinatoren.', 'Overeenkomst met een gemeentelijke of regionale civiele bescherming en een lab'],
        ['M4 · Gateways en interoperabiliteit', 'Maand 13–18', 'Adapters voor externe gateways (gemeentelijk wifi, LoRa, geautoriseerde satelliet-testbank) en openbare testwaarschuwingen.', 'End-to-end-demonstratie in een trainingsomgeving, zonder live 112-verkeer aan te raken.', 'Overeenkomsten met een gatewayoperator en een waarschuwingsautoriteit']
      ]
    } as L<string[][]>,
    fundingTitle: {
      es: 'Ventanas de financiación en las que encaja',
      en: 'Funding windows it fits',
      nl: 'Financieringsvensters waarin het past'
    } as L<string>,
    funding: {
      es: [
        ['12.º CASSINI Hackathon (UE, espacio y resiliencia)', '27–29-11-2026', 'Equipo; no exige empresa'],
        ['EIC Accelerator, propuesta corta', 'Continua', 'Pyme constituida'],
        ['ESA BIC Comunidad de Madrid', 'Abierta; corte pendiente de verificar', 'Empresa de menos de 5 años'],
        ['ENISA, préstamo participativo', 'Continua', 'Empresa constituida'],
        ['Horizon Europe Cluster 3 (2027)', 'Apertura prevista 05-05-2027; pendiente de verificar', 'Como socio tecnológico de un consorcio']
      ],
      en: [
        ['12th CASSINI Hackathon (EU, space and resilience)', '27–29 Nov 2026', 'Team; no company required'],
        ['EIC Accelerator, short proposal', 'Continuous', 'Incorporated SME'],
        ['ESA BIC Comunidad de Madrid', 'Open; cut-off to be verified', 'Company under 5 years old'],
        ['ENISA participating loan', 'Continuous', 'Incorporated company'],
        ['Horizon Europe Cluster 3 (2027)', 'Expected opening 5 May 2027; to be verified', 'As technology partner in a consortium']
      ],
      nl: [
        ['12e CASSINI Hackathon (EU, ruimte en veerkracht)', '27–29 nov 2026', 'Team; geen bedrijf nodig'],
        ['EIC Accelerator, korte aanvraag', 'Doorlopend', 'Ingeschreven mkb'],
        ['ESA BIC Comunidad de Madrid', 'Open; deadline nog te verifiëren', 'Bedrijf jonger dan 5 jaar'],
        ['ENISA participatielening', 'Doorlopend', 'Ingeschreven bedrijf'],
        ['Horizon Europe Cluster 3 (2027)', 'Verwachte opening 5 mei 2027; nog te verifiëren', 'Als technologiepartner in een consortium']
      ]
    } as L<string[][]>,
    fundingCols: {
      es: ['Convocatoria', 'Plazo', 'Requisito'],
      en: ['Call', 'Deadline', 'Requirement'],
      nl: ['Oproep', 'Deadline', 'Vereiste']
    } as L<string[]>,
    fundingNote: {
      es: 'Una convocatoria relevante no es una ayuda concedida. Fuentes y detalle en docs/financiacion/RONDA_FINANCIACION_2026-11-05.md.',
      en: 'A relevant call is not a grant awarded. Sources and detail in docs/financiacion/RONDA_FINANCIACION_2026-11-05.md.',
      nl: 'Een relevante oproep is geen toegekende subsidie. Bronnen en details in docs/financiacion/RONDA_FINANCIACION_2026-11-05.md.'
    } as L<string>
  },

  close: {
    title: {
      es: 'Hablemos del primer acuerdo.',
      en: 'Let’s talk about the first agreement.',
      nl: 'Laten we het hebben over de eerste overeenkomst.'
    } as L<string>,
    body: {
      es: 'El dossier para inversores reúne el registro de evidencias, el modelo de gobernanza y el plan de cada hito. El código es abierto y se puede auditar.',
      en: 'The investor dossier collects the evidence register, the governance model and the plan for each milestone. The code is open and can be audited.',
      nl: 'Het investeerdersdossier bundelt het bewijsregister, het governancemodel en het plan per mijlpaal. De code is open en controleerbaar.'
    } as L<string>,
    ctaInvestors: { es: 'Ir a inversores', en: 'Go to investors', nl: 'Naar investeerders' } as L<string>,
    ctaEvidence: { es: 'Ver el registro de evidencias', en: 'See the evidence register', nl: 'Bekijk het bewijsregister' } as L<string>,
    ctaCode: { es: 'Código en GitHub', en: 'Code on GitHub', nl: 'Code op GitHub' } as L<string>
  }
};

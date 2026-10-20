import type {Locale} from './copy';

export type SignalStep = {
  id:string; number:string; title:string; shorthand:string; intent:string;
  input:string; logic:string; result:string; value:string; engineering:string;
  status:string; source:string; sourceLabel:string;
};
export type StoryContent = {
  brief:{eyebrow:string;heading:string;summary:string;accent:string;features:{label:string;detail:string}[];note:string};
  walkthrough:{eyebrow:string;title:string;lead:string;example:string;stepLabel:string;input:string;logic:string;result:string;investor:string;developer:string;code:string;footnote:string};
  blueprint:{eyebrow:string;title:string;lead:string;source:string;layers:{number:string;tag:string;title:string;description:string;file:string;path:string;status:string}[];semantics:string;states:{label:string;definition:string}[];proofTitle:string;proof:{stage:string;proof:string;level:string}[];end:string;cta:string};
  steps:SignalStep[];
};
const root='https://github.com/abrahamhl/civic-relay/blob/feat/master-emergency-routing-v1-20261020/';
export const storyContent:Record<Locale,StoryContent>={
es:{
 brief:{
  eyebrow:'QUÉ HACE OEP / EN UNA FRASE',heading:'SI LA RED SE CAE, EL MENSAJE NO TIENE POR QUÉ DESAPARECER.',
  summary:'OEP investiga una capa que permite a dispositivos participantes <strong>confirmar voluntariamente su situación</strong>, conservar mensajes cuando no hay salida, buscar transportes autorizados y distinguir entre entrega confirmada y ausencia de contacto.',
  accent:'No crea satélites ni sustituye operadoras: coordina lo que ya existe y lo que cada dispositivo permite.',
  features:[{label:'01 / ALERTA',detail:'Zona y origen de emergencia, con verificación pendiente para emisores reales.'},{label:'02 / PERSONAS',detail:'Estoy bien, SOS voluntario o estado desconocido sin inferir víctimas.'},{label:'03 / MENSAJE',detail:'Cola, TTL, deduplicación, reintentos y restricciones energéticas.'},{label:'04 / RUTA',detail:'Selección de enlaces compatibles y ACK distinguido de un rescate.'}],
  note:'HOY: MODELO VIRTUAL + APK ANDROID EXPERIMENTAL COMPILADA. NO ES UN SERVICIO REAL.'
 },
 walkthrough:{
  eyebrow:'02 / EL SISTEMA EXPLICADO, DE EXTREMO A EXTREMO',
  title:'DEL TERREMOTO AL ACUSE DE RECEPCIÓN.',
  lead:'Seis decisiones conectadas. Selecciona una etapa para entender simultáneamente su valor operativo y el componente de ingeniería que la sostiene.',
  example:'EJERCICIO · EDIFICIO DERRUMBADO · DATOS SINTÉTICOS',stepLabel:'ETAPA',
  input:'ENTRADA',logic:'DECISIÓN DEL MOTOR',result:'RESPUESTA',investor:'POR QUÉ IMPORTA',developer:'CÓMO ESTÁ IMPLEMENTADO',code:'INSPECCIONAR CÓDIGO',
  footnote:'La escena representa decisiones modeladas. No hay envío a 112, emisor CAP oficial validado, satélite conectado ni transmisión física acreditada.'
 },
 blueprint:{
  eyebrow:'03 / ARQUITECTURA PARA QUIEN VA A CONSTRUIRLA',
  title:'CADA CAPA TIENE UN CÓDIGO. Y UN LÍMITE.',
  lead:'No hay una “IA que hace magia”. OEP divide presentación, simulación, políticas de confianza, mensajería y transportes. Esa separación permite ensayar hipótesis sin simular certificaciones inexistentes.',
  source:'VER ARCHIVO ↗',
  layers:[
   {number:'01',tag:'EXPERIENCIA',title:'Next.js + React + Three.js',description:'Globo narrativo con scroll, edificio 3D, controles para 20–100 nodos, resultados y exportación de evidencia JSON.',file:'investor-next/app/investor-page.tsx',path:root+'investor-next/app/investor-page.tsx',status:'WEB / SIMULACIÓN'},
   {number:'02',tag:'TOPOLOGÍA',title:'Motor de escenarios determinista',description:'Grafo virtual reproducible con participantes, permisos, radios modeladas, daños y comparación frente a una ruta solo celular.',file:'investor-next/lib/emergency-routing.mjs',path:root+'investor-next/lib/emergency-routing.mjs',status:'PROBADO EN CI'},
   {number:'03',tag:'SEGURIDAD',title:'Consentimiento y políticas',description:'Estados de capacidad, confirmaciones explícitas, caducidad, reglas energéticas y frontera de verificación CAP; no hay identidad institucional real.',file:'investor-next/lib/emergency-policy.mjs',path:root+'investor-next/lib/emergency-policy.mjs',status:'PROTOTIPO'},
   {number:'04',tag:'MENSAJERÍA',title:'Store-and-forward',description:'Mensajes ficticios limitados por TTL, cola acotada, duplicados, backoff, selección de adaptador y recibos sintéticos.',file:'investor-next/lib/store-forward.mjs',path:root+'investor-next/lib/store-forward.mjs',status:'PROBADO EN CI'},
   {number:'05',tag:'RADIO LOCAL',title:'Android + Nearby Connections',description:'App de laboratorio con consentimiento, emparejamiento manual, UUID y desafío de recibo, temporizador y registro CSV; aún sin ensayo físico.',file:'experimental/android-nearby/README.md',path:root+'experimental/android-nearby/README.md',status:'APK COMPILADA'},
   {number:'06',tag:'EVIDENCIA',title:'GitHub Actions + matriz de ensayos',description:'Pruebas automatizadas, simulaciones reproducibles, build Android y protocolo de 30 ensayos reales todavía no ejecutados.',file:'experimental/android-nearby/PILOT_ACCEPTANCE.md',path:root+'experimental/android-nearby/PILOT_ACCEPTANCE.md',status:'PILOTO PENDIENTE'}
  ],
  semantics:'NO CONFUNDIR UN ESTADO DE RED CON UN RESULTADO HUMANO',
  states:[
   {label:'QUEUED',definition:'Mensaje conservado: todavía no se acredita recepción.'},
   {label:'ACK SYNTHETIC',definition:'Confirmación dentro del modelo; no se transmitió físicamente.'},
   {label:'ANDROID RECEIVER ACK',definition:'Recibo previsto por una segunda app emparejada; sin pruebas físicas publicadas.'},
   {label:'UNKNOWN',definition:'No respondió: nunca equivale a herido, atrapado ni rescatado.'}
  ],
  proofTitle:'ESCALERA DE EVIDENCIA',
  proof:[{stage:'MODELO',proof:'20–100 nodos + matriz de 810 escenarios virtuales',level:'AUTOMATIZADO'},
         {stage:'PROTOTIPO',proof:'Android Nearby: código y APK de laboratorio',level:'BUILD CI'},
         {stage:'CAMPO',proof:'Dos teléfonos + 30 ensayos + informe independiente',level:'PENDIENTE'}],
  end:'La oportunidad comercial es una infraestructura interoperable de coordinación y herramientas de validación para socios; las integraciones con operadores, fabricantes y protección civil no existen todavía.',
  cta:'ABRIR EL PILOTO ANDROID ↗'
 },
 steps:[
  {id:'zone',number:'01',title:'Zona de emergencia',shorthand:'ZONA',intent:'Ejercicio de terremoto en un polígono.',
   input:'Tipo de incidente, límites geográficos, emisor y vencimiento.',logic:'Aceptar únicamente una zona de ejemplo. Un emisor institucional real requeriría autenticación externa y control de revocación.',
   result:'EXERCISE_ONLY: no se presenta como alerta oficial.',value:'Reduce el riesgo de que una señal inventada active una respuesta institucional.',
   engineering:'Objeto de zona y política de confianza CAP. El parser/contrato no equivale a una cadena criptográfica de confianza.',
   status:'SIMULADO',source:root+'investor-next/lib/emergency-policy.mjs',sourceLabel:'emergency-policy.mjs'},
  {id:'consent',number:'02',title:'Dispositivo autorizado',shorthand:'PERMISO',intent:'Solo cuentan los móviles que se apuntan.',
   input:'Participación, permiso del SO, radio disponible y batería.',logic:'Evaluar AVAILABLE, DISABLED, PERMISSION_REQUIRED, UNSUPPORTED o RESTRICTED. Nunca activar sensores clandestinamente.',
   result:'Participantes compatibles entran en el modelo; el resto queda excluido.',value:'Aprovecha dispositivos existentes sin exigir una red propia ni comprometer los permisos.',
   engineering:'Perfiles locales en el simulador y consentimiento explícito en Android antes de Nearby discovery.',
   status:'SIMULADO + CÓDIGO EXPERIMENTAL',source:root+'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/MainActivity.java',sourceLabel:'MainActivity.java'},
  {id:'human',number:'03',title:'Confirmación humana',shorthand:'ESTADO',intent:'Una persona pide ayuda, otra no contesta.',
   input:'ESTOY BIEN · SOS · OTRAS PERSONAS · NO SÉ.',logic:'Registrar el estado emitido por el usuario; ausencia de respuesta = UNKNOWN/NO_CONTACT, nunca lesión inferida.',
   result:'SOS explícito y estado desconocido siguen separados.',value:'Evita falsos positivos que desviarían recursos de emergencias.',
   engineering:'Interfaz opt-in de respuestas y reglas de seguridad con revocación y caducidad.',
   status:'INTERFAZ LOCAL / SIMULACIÓN',source:root+'investor-next/app/human-safety-panel.tsx',sourceLabel:'human-safety-panel.tsx'},
  {id:'store',number:'04',title:'Memoria ante apagón',shorthand:'COLA',intent:'No existe un enlace útil, pero el mensaje persiste en cola del ejercicio.',
   input:'Sobre de mensaje autorizado, ID, prioridad y TTL.',logic:'Limitar la cola, eliminar duplicados, caducar contenido, reintentar con backoff y proteger revocación.',
   result:'QUEUED, EXPIRED o REVOKED; jamás DELIVERED sin acuse válido.',value:'Evita perder silenciosamente la intención de pedir ayuda durante la interrupción.',
   engineering:'Motor store-forward ejecutable en memoria del navegador; no hay persistencia duradera de SOS en dos móviles.',
   status:'PROBADO EN LABORATORIO',source:root+'investor-next/lib/store-forward.mjs',sourceLabel:'store-forward.mjs'},
  {id:'route',number:'05',title:'Enrutamiento adaptativo',shorthand:'RUTA',intent:'Se abre una salida local cuando falla la red móvil.',
   input:'Transportes disponibles, latencia y fiabilidad estimadas, coste energético y permisos.',logic:'Seleccionar un adaptador compatible y seguro según una puntuación de hipótesis; reintentar si cae. Gateway solo virtual.',
   result:'Ruta sintética elegida o mensaje conservado sin salida.',value:'Permite comparar una política adaptativa frente a depender solo de cobertura celular.',
   engineering:'Grafo virtual y TransportAdapter simulado. Nearby Android es un experimento uno-a-uno separado, sin mesh real.',
   status:'SIMULADO / ANDROID EXPERIMENTAL',source:root+'investor-next/lib/emergency-routing.mjs',sourceLabel:'emergency-routing.mjs'},
  {id:'ack',number:'06',title:'Confirmar, no presumir',shorthand:'ACK',intent:'La señal llega al receptor ficticio o vence el plazo.',
   input:'Identificador, receptor permitido, desafío por mensaje y vencimiento.',logic:'Comprobar ACK del modelo. En la app Android, exigir que coincida el UUID, el desafío y el peer aprobado antes del TTL.',
   result:'ACK_SYNTHETIC o pendiente; no hay confirmación de rescate ni aviso a 112.',value:'Hace auditable el punto más peligroso: asumir que un mensaje enviado ha salvado a alguien.',
   engineering:'Pruebas Java de recibos, temporizador de doble reloj y documento de 30 ensayos de campo pendientes.',
   status:'CI VERIFICADA / NO PROBADO FÍSICAMENTE',source:root+'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/LabDeliveryGuard.java',sourceLabel:'LabDeliveryGuard.java'}
 ]
},
en:{
 brief:{
  eyebrow:'WHAT OEP ACTUALLY DOES / IN ONE SENTENCE',heading:'WHEN A NETWORK FAILS, THE MESSAGE SHOULD NOT SIMPLY VANISH.',
  summary:'OEP researches an opt-in coordination layer where people can <strong>explicitly report their status</strong>, messages can wait when connectivity is lost, compatible authorised paths can be evaluated, and receipt is never confused with rescue.',
  accent:'We are not building satellites or replacing operators: we coordinate existing capabilities, where users and platforms permit.',
  features:[{label:'01 / ALERT',detail:'Emergency zone, source and expiry; real issuer verification is a future integration.'},{label:'02 / PEOPLE',detail:'Explicit SAFE or SOS; silence remains unknown, never an inferred victim.'},{label:'03 / MESSAGE',detail:'Bounded queue, TTL, deduplication, retries and energy policies.'},{label:'04 / ROUTE',detail:'Compatible routes and receipt semantics separate from rescue outcomes.'}],
  note:'TODAY: VIRTUAL MODEL + COMPILED EXPERIMENTAL ANDROID APK. NOT A LIVE EMERGENCY SERVICE.'
 },
 walkthrough:{
  eyebrow:'02 / THE SYSTEM, END TO END',title:'FROM AN EARTHQUAKE TO A RECEIVER ACK.',
  lead:'Six connected decisions. Select a stage to see both its operational value and the engineering components behind it.',
  example:'EXERCISE · PARTIALLY COLLAPSED BUILDING · SYNTHETIC DATA',stepLabel:'STAGE',input:'INPUT',logic:'ENGINE DECISION',result:'OUTPUT',investor:'WHY IT MATTERS',developer:'HOW IT IS BUILT',code:'INSPECT SOURCE',
  footnote:'This is a modelled exercise. No 112 call, verified government CAP issuer, live satellite link or independently confirmed physical delivery.'
 },
 blueprint:{
  eyebrow:'03 / THE STACK FOR THE PEOPLE BUILDING IT',title:'EVERY LAYER HAS CODE. AND A BOUNDARY.',
  lead:'No black-box “AI magic”. OEP separates its visual experience, simulator, trust policies, messaging and radio experiments, so each claim can be checked without inventing deployment readiness.',
  source:'VIEW SOURCE ↗',
  layers:[
   {number:'01',tag:'EXPERIENCE',title:'Next.js + React + Three.js',description:'Scroll-driven globe, 3D collapse scene, controls for 20–100 virtual devices and reproducible JSON evidence export.',file:'investor-next/app/investor-page.tsx',path:root+'investor-next/app/investor-page.tsx',status:'WEB / SIMULATED'},
   {number:'02',tag:'TOPOLOGY',title:'Deterministic scenario engine',description:'Seeded virtual graph, consent rates, modelled radios, infrastructure damage and cellular-only comparison.',file:'investor-next/lib/emergency-routing.mjs',path:root+'investor-next/lib/emergency-routing.mjs',status:'CI TESTED'},
   {number:'03',tag:'SAFETY',title:'Permission & trust policies',description:'Capability states, explicit safety responses, TTL, energy rules and CAP verification boundary; not a real authority trust chain.',file:'investor-next/lib/emergency-policy.mjs',path:root+'investor-next/lib/emergency-policy.mjs',status:'RESEARCH CODE'},
   {number:'04',tag:'MESSAGING',title:'Store-and-forward',description:'Exercise messages with TTL, bounded memory, duplicate detection, retry backoff, adapter selection and synthetic receipts.',file:'investor-next/lib/store-forward.mjs',path:root+'investor-next/lib/store-forward.mjs',status:'CI TESTED'},
   {number:'05',tag:'LOCAL RADIO',title:'Android + Nearby Connections',description:'Consent, manual pairing verification, message ID and receipt challenge, TTL watchdog and local CSV; no published physical trial.',file:'experimental/android-nearby/README.md',path:root+'experimental/android-nearby/README.md',status:'APK BUILDS'},
   {number:'06',tag:'EVIDENCE',title:'GitHub Actions + field protocol',description:'Automated tests, reproducible simulations, Android build CI and a proposed 30-trial two-phone experiment.',file:'experimental/android-nearby/PILOT_ACCEPTANCE.md',path:root+'experimental/android-nearby/PILOT_ACCEPTANCE.md',status:'FIELD PILOT PENDING'}
  ],
  semantics:'DO NOT CONFUSE A NETWORK EVENT WITH A HUMAN OUTCOME',
  states:[{label:'QUEUED',definition:'Message is pending; no receiver acceptance has been demonstrated.'},
   {label:'ACK SYNTHETIC',definition:'A model-only receiver receipt; no real radio delivery.'},
   {label:'ANDROID RECEIVER ACK',definition:'Receipt designed for a paired Android app; physical validation is still missing.'},
   {label:'UNKNOWN',definition:'No response. Never interpreted as injured, trapped or rescued.'}],
  proofTitle:'THE EVIDENCE LADDER',
  proof:[{stage:'MODEL',proof:'20–100 virtual nodes; 810 synthetic scenario sweeps',level:'AUTOMATED'},
         {stage:'PROTOTYPE',proof:'Android Nearby source and research APK',level:'BUILD CI'},
         {stage:'FIELD',proof:'Two phones, 30 measured trials, independent report',level:'PENDING'}],
  end:'The business opportunity is interoperable coordination and validation tooling for partners. Operator, manufacturer and civil-protection integrations are not in place.',
  cta:'OPEN ANDROID PILOT SPEC ↗'
 },
 steps:[
  {id:'zone',number:'01',title:'Emergency zone',shorthand:'ZONE',intent:'A synthetic earthquake affects a polygon.',
   input:'Incident type, geographic footprint, issuer and expiry.',logic:'Only an exercise zone is accepted. A real public issuer requires an external trusted-identity verifier and revocation controls.',
   result:'EXERCISE_ONLY, not a government emergency alert.',value:'Reduces the risk that an untrusted warning could trigger institutional action.',
   engineering:'Zone model and CAP trust-adapter boundary. A well-formed CAP document is not proof of an authorised issuer.',
   status:'SIMULATED',source:root+'investor-next/lib/emergency-policy.mjs',sourceLabel:'emergency-policy.mjs'},
  {id:'consent',number:'02',title:'Opt-in device',shorthand:'PERMISSION',intent:'Only participating devices are counted.',
   input:'Voluntary participation, OS permission, supported radio and remaining battery.',logic:'Classify AVAILABLE, DISABLED, PERMISSION_REQUIRED, UNSUPPORTED or RESTRICTED; never silently toggle sensors.',
   result:'Compatible consenting devices are represented; others excluded.',value:'Uses existing capabilities without demanding a new telecom network or bypassing consent.',
   engineering:'Simulated device capability profiles; Android Nearby research app asks consent before discovery.',
   status:'SIMULATED + EXPERIMENTAL SOURCE',source:root+'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/MainActivity.java',sourceLabel:'MainActivity.java'},
  {id:'human',number:'03',title:'Human check-in',shorthand:'STATUS',intent:'One person requests help; another is silent.',
   input:'SAFE · SOS · OTHERS AFFECTED · CANNOT DETERMINE.',logic:'Record only volunteered responses. Non-response stays UNKNOWN/NO_CONTACT, never inferred injury.',
   result:'Explicit SOS and missing contact remain distinct signals.',value:'Prevents misleading casualty estimates and misallocation of response resources.',
   engineering:'Opt-in client-side interface, response states, expiry and revocation rules.',
   status:'LOCAL UI / SIMULATION',source:root+'investor-next/app/human-safety-panel.tsx',sourceLabel:'human-safety-panel.tsx'},
  {id:'store',number:'04',title:'Survive the blackout',shorthand:'QUEUE',intent:'No reachable route exists; a lab message waits.',
   input:'Consented envelope, message ID, priority and time-to-live.',logic:'Bounded queue, duplicate ID checks, expiry, retry backoff and cancellation safety.',
   result:'QUEUED, EXPIRED or REVOKED — no fabricated delivery.',value:'Makes lost connectivity a visible pending condition instead of silent message loss.',
   engineering:'Executable in-memory browser store-forward engine. Durable mobile SOS persistence is not implemented.',
   status:'CI TESTED LAB',source:root+'investor-next/lib/store-forward.mjs',sourceLabel:'store-forward.mjs'},
  {id:'route',number:'05',title:'Adaptive routing',shorthand:'ROUTE',intent:'A virtual local relay appears as cellular infrastructure fails.',
   input:'Transport availability, estimated reliability and latency, energy cost and permission state.',logic:'Score eligible adapters, attempt transport and retry on failure. The illustrated gateway is simulated.',
   result:'Synthetic route selection or a pending queue.',value:'Tests whether coordinating permitted transports might outperform a cellular-only scenario under defined assumptions.',
   engineering:'Virtual topology plus simulated TransportAdapter. Android Nearby is a separate one-hop research source, not mesh.',
   status:'SIMULATED / ANDROID EXPERIMENTAL',source:root+'investor-next/lib/emergency-routing.mjs',sourceLabel:'emergency-routing.mjs'},
  {id:'ack',number:'06',title:'Confirm, never assume',shorthand:'ACK',intent:'The simulated receiver acknowledges, or the message times out.',
   input:'Message UUID, permitted peer, message-specific challenge and TTL.',logic:'Verify model receipt; Android guard checks ID, challenge, approved peer and local expiry.',
   result:'ACK_SYNTHETIC or not confirmed, never rescue confirmation or 112.',value:'Makes the critical distinction between sending a byte and proving a useful outcome explicit.',
   engineering:'Java receipt guards, dual-clock TTL logic and a proposed 30-trial hardware evidence protocol.',
   status:'BUILD VERIFIED / NOT PHYSICALLY TESTED',source:root+'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/LabDeliveryGuard.java',sourceLabel:'LabDeliveryGuard.java'}
 ]
},
nl:{
 brief:{
  eyebrow:'WAT OEP ECHT DOET / IN ÉÉN ZIN',heading:'ALS EEN NETWERK UITVALT, HOEFT EEN BERICHT NIET TE VERDWIJNEN.',
  summary:'OEP onderzoekt een vrijwillige coördinatielaag: deelnemers kunnen <strong>zelf hun status melden</strong>, berichten kunnen wachten bij netwerkuitval, toegestane routes worden vergeleken en ontvangst is nooit hetzelfde als een redding.',
  accent:'Geen eigen satellieten en geen vervanging voor providers: alleen bestaande mogelijkheden die gebruikers en systemen toestaan.',
  features:[{label:'01 / MELDING',detail:'Incidentzone, bron en verloopdatum; verificatie van echte afzenders volgt later.'},{label:'02 / MENSEN',detail:'Vrijwillige VEILIG- of SOS-melding; stilte blijft onbekend.'},{label:'03 / BERICHT',detail:'Wachtrij, TTL, deduplicatie, herpogingen en energiebeleid.'},{label:'04 / ROUTE',detail:'Compatibele verbindingen met aantoonbaar onderscheiden ontvangststatus.'}],
  note:'NU: VIRTUEEL MODEL + GECOMPILEERDE EXPERIMENTELE ANDROID-APK. GEEN HULPDIENST.'
 },
 walkthrough:{
  eyebrow:'02 / HET SYSTEEM VAN BEGIN TOT EIND',title:'VAN AARDBEVING TOT ONTVANGSTBEVESTIGING.',
  lead:'Zes samenhangende beslissingen. Selecteer een stap voor zowel de operationele waarde als de technische implementatie.',
  example:'OEFENING · DEELS INGESTORT GEBOUW · FICTIEVE DATA',stepLabel:'STAP',input:'INPUT',logic:'BESLISSING',result:'UITKOMST',investor:'WAAROM BELANGRIJK',developer:'TECHNISCHE UITVOERING',code:'BEKIJK BRONCODE',
  footnote:'Dit is een gesimuleerde oefening. Geen 112-oproep, geverifieerde officiële CAP-afzender, satellietverbinding of fysiek bewezen aflevering.'
 },
 blueprint:{
  eyebrow:'03 / ARCHITECTUUR VOOR ONTWIKKELAARS',title:'IEDERE LAAG HEEFT CODE. EN GRENZEN.',
  lead:'Geen onverklaarbare AI. OEP scheidt de visuele ervaring, simulatie, vertrouwensregels, berichten en radio-experimenten, zodat claims controleerbaar zijn.',
  source:'BEKIJK BESTAND ↗',
  layers:[
   {number:'01',tag:'ERVARING',title:'Next.js + React + Three.js',description:'Scroll-globe, 3D ingestort gebouw, bediening voor 20–100 virtuele apparaten en reproduceerbare JSON-export.',file:'investor-next/app/investor-page.tsx',path:root+'investor-next/app/investor-page.tsx',status:'WEB / SIMULATIE'},
   {number:'02',tag:'TOPOLOGIE',title:'Deterministische scenario-engine',description:'Virtuele graaf met seed, deelnemers, radiomodellen, infrastructuurschade en mobielnetwerkvergelijking.',file:'investor-next/lib/emergency-routing.mjs',path:root+'investor-next/lib/emergency-routing.mjs',status:'CI-TEST'},
   {number:'03',tag:'VEILIGHEID',title:'Toestemming en vertrouwensregels',description:'Status van mogelijkheden, expliciete antwoorden, TTL, energiebeleid en CAP-verificatiegrens; geen echte trust chain.',file:'investor-next/lib/emergency-policy.mjs',path:root+'investor-next/lib/emergency-policy.mjs',status:'ONDERZOEKSCODE'},
   {number:'04',tag:'BERICHTEN',title:'Store-and-forward',description:'Fictieve berichten met TTL, begrensde wachtrij, duplicaatcontrole, retry-backoff, adapterkeuze en gesimuleerde ACK.',file:'investor-next/lib/store-forward.mjs',path:root+'investor-next/lib/store-forward.mjs',status:'CI-TEST'},
   {number:'05',tag:'LOKALE RADIO',title:'Android + Nearby Connections',description:'Toestemming, codevergelijking, bericht-ID, ontvangstchallenge, TTL en CSV-log; nog geen veldproef.',file:'experimental/android-nearby/README.md',path:root+'experimental/android-nearby/README.md',status:'APK GEBOUWD'},
   {number:'06',tag:'BEWIJS',title:'GitHub Actions + veldprotocol',description:'Geautomatiseerde tests, reproduceerbare simulaties, Android-build en een gepland tweetelefoononderzoek met 30 pogingen.',file:'experimental/android-nearby/PILOT_ACCEPTANCE.md',path:root+'experimental/android-nearby/PILOT_ACCEPTANCE.md',status:'VELDPROEF NODIG'}
  ],
  semantics:'EEN NETWERKSTATUS IS GEEN MENSELIJKE UITKOMST',
  states:[{label:'QUEUED',definition:'Bericht wacht nog; er is geen ontvangstbevestiging.'},
   {label:'ACK SYNTHETIC',definition:'Ontvangst alleen binnen het model; geen echte radio-aflevering.'},
   {label:'ANDROID RECEIVER ACK',definition:'Ontvangstbewijs ontworpen voor gekoppelde Android-app; fysieke validatie ontbreekt.'},
   {label:'UNKNOWN',definition:'Geen antwoord; geen bewijs van letsel, vermissing of redding.'}],
  proofTitle:'BEWIJSNIVEAUS',
  proof:[{stage:'MODEL',proof:'20–100 virtuele knopen; 810 gesimuleerde scenario’s',level:'GEAUTOMATISEERD'},
         {stage:'PROTOTYPE',proof:'Android Nearby-broncode en onderzoeks-APK',level:'BUILD CI'},
         {stage:'VELD',proof:'Twee telefoons, 30 gemeten proeven, onafhankelijke beoordeling',level:'NOG NIET'}],
  end:'De zakelijke kans ligt in interoperabele coördinatie en testinstrumenten. Integraties met operators, fabrikanten en hulpdiensten zijn nog niet gerealiseerd.',
  cta:'OPEN ANDROID-TESTPROTOCOL ↗'
 },
 steps:[
  {id:'zone',number:'01',title:'Incidentzone',shorthand:'ZONE',intent:'Een fictieve aardbeving raakt een gebied.',
   input:'Incidenttype, geografische grens, bron en verloopdatum.',logic:'Alleen een oefenzone is toegestaan. Een echte overheidsafzender vereist externe identiteitsverificatie.',
   result:'EXERCISE_ONLY — geen officieel alarm.',value:'Beperkt de kans dat een onbetrouwbare melding een officiële actie activeert.',
   engineering:'Zonemodel en CAP-vertrouwensadapter. Een geldig CAP-bestand is geen geverifieerde afzender.',
   status:'GESIMULEERD',source:root+'investor-next/lib/emergency-policy.mjs',sourceLabel:'emergency-policy.mjs'},
  {id:'consent',number:'02',title:'Vrijwillig apparaat',shorthand:'TOESTEMMING',intent:'Alleen deelnemende telefoons tellen mee.',
   input:'Deelname, OS-toestemming, beschikbare radio en batterij.',logic:'AVAILABLE, DISABLED, PERMISSION_REQUIRED, UNSUPPORTED of RESTRICTED; nooit heimelijk sensoren activeren.',
   result:'Toegestane apparaten tellen mee, de rest niet.',value:'Benut bestaande technologie zonder nieuw providernetwerk of omzeilen van toestemming.',
   engineering:'Virtuele apparaatprofielen en Android Nearby-toestemming vóór ontdekking.',
   status:'SIMULATIE + EXPERIMENT',source:root+'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/MainActivity.java',sourceLabel:'MainActivity.java'},
  {id:'human',number:'03',title:'Menselijke status',shorthand:'STATUS',intent:'Eén persoon vraagt hulp, een ander antwoordt niet.',
   input:'VEILIG · SOS · ANDEREN GETROFFEN · KAN NIET BEPALEN.',logic:'Alleen vrijwillige reacties registreren. Stilte blijft UNKNOWN/NO_CONTACT.',
   result:'SOS en onbekend zijn verschillende signalen.',value:'Voorkomt misleidende slachtofferschattingen en verkeerd gebruik van middelen.',
   engineering:'Opt-in interface, expiratie en intrekking van reacties.',
   status:'LOKALE UI / SIMULATIE',source:root+'investor-next/app/human-safety-panel.tsx',sourceLabel:'human-safety-panel.tsx'},
  {id:'store',number:'04',title:'Opslag tijdens uitval',shorthand:'WACHTRIJ',intent:'Geen route? Het proefbericht wacht.',
   input:'Berichtenvelop, ID, prioriteit en bewaartijd.',logic:'Begrens opslag, verwijder duplicaten, expireer berichten, herprobeer en bewaak intrekking.',
   result:'QUEUED, EXPIRED of REVOKED; nooit fictief afgeleverd.',value:'Maakt een onderbroken verbinding zichtbaar in plaats van stil berichtverlies.',
   engineering:'Werkende wachtrij in browsergeheugen, geen duurzame mobiele SOS-opslag.',
   status:'CI-TEST',source:root+'investor-next/lib/store-forward.mjs',sourceLabel:'store-forward.mjs'},
  {id:'route',number:'05',title:'Adaptieve route',shorthand:'ROUTE',intent:'Een virtuele lokale route verschijnt bij mobiele netwerkuitval.',
   input:'Transport, geschatte betrouwbaarheid en latency, energie en toestemming.',logic:'Kies een geschikte adapter en probeer opnieuw na falen. Gateway is virtueel.',
   result:'Gesimuleerde route of bericht blijft wachten.',value:'Onderzoekt of toegestane transportmiddelen onder bepaalde aannames beter zijn dan alleen mobiel.',
   engineering:'Virtueel netwerk en gesimuleerde TransportAdapter; Nearby op Android is apart één-op-één onderzoek.',
   status:'SIMULATIE / ANDROID EXPERIMENT',source:root+'investor-next/lib/emergency-routing.mjs',sourceLabel:'emergency-routing.mjs'},
  {id:'ack',number:'06',title:'Bevestigen, niet aannemen',shorthand:'ACK',intent:'De fictieve ontvanger bevestigt of het bericht verloopt.',
   input:'Bericht-UUID, toegestaan peer-ID, challenge en TTL.',logic:'Controleer een gesimuleerde ACK; Android vergelijkt UUID, challenge, peer en tijdslimiet.',
   result:'ACK_SYNTHETIC of niet bevestigd; geen reddingsmelding of 112.',value:'Voorkomt dat een verzonden byte wordt verward met een geslaagd reddingsresultaat.',
   engineering:'Java-ACK-bewaking, dubbele klokcontrole en een gepland 30-proevenprotocol.',
   status:'BUILD CI / GEEN FYSIEKE BEWIJZEN',source:root+'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/LabDeliveryGuard.java',sourceLabel:'LabDeliveryGuard.java'}
 ]
}
};

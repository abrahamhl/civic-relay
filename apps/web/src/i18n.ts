export type Locale = 'en' | 'es' | 'nl';
export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'nl'];

const dictionary: Record<Locale, Record<string, string>> = {
  en: {
    navStory:'THE CRISIS',navProduct:'THE PROTOTYPE',navFunding:'PARTNERS',openDemo:'OPEN SIMULATION',heroEyebrow:'OFFLINE-FIRST • RESEARCH PROTOTYPE',
    heroTitle:'When the network fails,',heroAccent:'every message matters.',heroBody:'Explore a transparent crisis-communication simulation: preserve a message locally, discover a simulated route and distinguish delivery from hope.',
    scroll:'Explore the story',notice:'Research demo only. Not connected to emergency services, satellite operators or official alert systems.',
    contextKicker:'01 / THE HUMAN PROBLEM',contextTitle:'A failure of coverage can become a failure of coordination.',
    contextBody:'Wildfires, floods and blackouts can disrupt communication infrastructure exactly when people need reliable information. An app alone cannot create radio coverage; it can prepare and retain a message while an authorized link is unavailable.',
    storyKicker:'INTERACTIVE SCENARIO · SIMULATED',storyTitle:'The day the network goes quiet',storyIntro:'Follow a fictional person through a service outage. Every communication path shown is illustrative, not a real transmission.',
    step1Title:'A normal day',step1Body:'A person in a rural area has mobile coverage and access to normal communications.',
    step2Title:'The incident',step2Body:'A nearby wildfire affects local infrastructure. Mobile connectivity becomes unavailable.',
    step3Title:'No route exists',step3Body:'A conventional send attempt fails. The message has not reached anyone.',
    step4Title:'The message survives',step4Body:'Civic Relay prepares and stores the message in a local queue. Its status remains not delivered.',
    step5Title:'A route appears',step5Body:'A hypothetical authorized relay path becomes available. The prototype illustrates retry and routing logic.',
    step6Title:'Receipt matters',step6Body:'A receiver acknowledgment is simulated. The UI must never treat a sent message as received without an acknowledgment.',
    step7Title:'From prototype to field trials',step7Body:'Real Bluetooth, mesh, satellite and responder integrations require devices, permissions, agreements and independent testing.',
    scene1:'MOBILE SERVICE AVAILABLE',scene2:'NETWORK OUTAGE',scene3:'SEND FAILED',scene4:'STORED LOCALLY · NOT DELIVERED',scene5:'HYPOTHETICAL ROUTE DISCOVERED',scene6:'SIMULATED RECEIVER ACK',scene7:'FIELD VALIDATION REQUIRED',
    next:'Next scene',previous:'Previous scene',replay:'Restart story',storyStatus:'Scenario step',productKicker:'02 / WHAT EXISTS',productTitle:'A reproducible core, not a promised rescue network.',
    productBody:'The repository contains a same-page routing simulator, a message store using IndexedDB in browsers, deduplication and acknowledgment logic. It does not prove real device-to-device transport or satellite access.',
    capability1:'Local queue',capability1Body:'Persist messages where browser storage is available. Test restarts and storage failures before relying on it.',
    capability2:'Simulated routes',capability2Body:'Model path loss, retries and duplicate deliveries within a controlled demo.',
    capability3:'Receipt semantics',capability3Body:'A simulated receiver ACK is distinct from an attempted transmission.',
    pendingTitle:'Not implemented or validated',pendingBody:'No live emergency dispatch, governmental authentication, guaranteed end-to-end encryption, satellite access or certified availability.',
    fundingKicker:'03 / PROPOSE A PILOT',fundingTitle:'Make resilient communication testable.',fundingBody:'Seeking research partners, pilot environments and funding opportunities to validate the design against real constraints and public-sector requirements.',
    fundingCTA:'EXPLORE THE DEMO',fundingGithub:'VIEW SOURCE CODE',
    demoBack:'Back to overview',demoCitizen:'Citizen (fictional)',demoCoordinator:'Coordinator (fictional)',switchRole:'Switch role',demoTitle:'Civic Relay · Lab',demoBanner:'SIMULATION ONLY — do not use for real emergencies or enter personal data.',demoSend:'Run test message',demoTransport:'Browser connection',demoActions:'Example reports',demoQueue:'Local message queue',demoMap:'Scenario map',demoInfoTitle:'Offline-first boundary',demoInfoBody:'Browser storage supports local persistence; this page does not communicate with real responders. Base map tiles may require internet access.',
    quickActions:'Example actions',safe:'I am safe',sos:'Need assistance',medical:'Medical',fire:'Fire',infrastructure:'Infrastructure',report:'General report',
    online:'Browser reports an internet connection',offline:'Browser reports offline — no external delivery is assumed',
    queueEmpty:'No test messages yet. Choose a simulated action to begin.',queueHistory:'Message history',queuePaths:'Simulated receiver acknowledgment(s)',queueQueued:'Queued · not delivered',queuePending:'Awaiting simulated acknowledgment',queueAttempts:'Routing attempts',
    unverified:'Unverified',corroborated:'Corroborated',official:'Official',disputed:'Disputed',
    scenarioTitle:'Scenario controls',scenarioExplanation:'All alerts below are fictional exercises. No government channel is connected.',scenarioAlert:'Simulate an incoming test alert',scenarioBroadcast:'Create an unverified test announcement',scenarioBidi:'Create a two-way test message',scenarioConfirm:'Confirm safety (test only)',scenarioCount:'Time remaining',scenarioAlertText:'EXERCISE — fictional request to confirm safety',scenarioSent:'A simulated message was added to the local queue.',scenarioNoAuto:'Countdown is visual only; no automatic emergency message is sent.',
    mapTitle:'Fictional incident map',mapTotal:'Incidents',mapConfidence:'Position confidence',priority:'Priority',verification:'Verification',time:'Time',footer:'CIVIC RELAY · OPEN RESEARCH PROTOTYPE · NOT AN EMERGENCY SERVICE'
  },
  es: {
    navStory:'LA CRISIS',navProduct:'EL PROTOTIPO',navFunding:'COLABORADORES',openDemo:'ABRIR SIMULACIÓN',heroEyebrow:'OFFLINE-FIRST • PROTOTIPO DE INVESTIGACIÓN',
    heroTitle:'Cuando falla la red,',heroAccent:'cada mensaje importa.',heroBody:'Explora una simulación transparente: conservar un mensaje localmente, encontrar una ruta simulada y distinguir entrega de esperanza.',
    scroll:'Descubrir la historia',notice:'Demostración de investigación. Sin conexión con emergencias, operadores satelitales ni sistemas de alertas oficiales.',
    contextKicker:'01 / EL PROBLEMA HUMANO',contextTitle:'La falta de cobertura puede impedir coordinar una emergencia.',
    contextBody:'Incendios, inundaciones y apagones pueden interrumpir las infraestructuras cuando más se necesitan. Una app no crea cobertura de radio por sí sola: puede preparar y conservar un mensaje mientras no haya un enlace autorizado.',
    storyKicker:'ESCENARIO INTERACTIVO · SIMULADO',storyTitle:'El día en que la red se apaga',storyIntro:'Acompaña a una persona ficticia durante una caída de comunicaciones. Todas las rutas mostradas son ilustrativas.',
    step1Title:'Un día normal',step1Body:'Una persona se encuentra en una zona rural con cobertura móvil.',
    step2Title:'El incidente',step2Body:'Un incendio cercano afecta a la infraestructura local. Desaparece la conectividad móvil.',
    step3Title:'No existe una ruta',step3Body:'El envío convencional falla. El mensaje todavía no ha llegado a nadie.',
    step4Title:'El mensaje se conserva',step4Body:'Civic Relay prepara y guarda el mensaje en una cola local. Sigue marcado como no entregado.',
    step5Title:'Aparece una ruta',step5Body:'Una hipotética conexión autorizada vuelve a estar disponible. El prototipo ilustra los reintentos y el enrutamiento.',
    step6Title:'Hace falta confirmación',step6Body:'Se simula un acuse de recibo del receptor. Enviar nunca equivale a entregar sin confirmación.',
    step7Title:'Del prototipo al piloto',step7Body:'Bluetooth, mesh, satélites e integración con emergencias requieren equipos, permisos, acuerdos y pruebas independientes.',
    scene1:'COBERTURA MÓVIL DISPONIBLE',scene2:'CAÍDA DE RED',scene3:'ENVÍO FALLIDO',scene4:'GUARDADO LOCALMENTE · SIN ENTREGAR',scene5:'RUTA HIPOTÉTICA DETECTADA',scene6:'ACUSE DE RECIBO SIMULADO',scene7:'PENDIENTE DE VALIDACIÓN EN CAMPO',
    next:'Siguiente escena',previous:'Escena anterior',replay:'Repetir historia',storyStatus:'Paso del escenario',productKicker:'02 / QUÉ EXISTE',productTitle:'Un núcleo reproducible, no una red de rescate prometida.',
    productBody:'El repositorio incluye un simulador de rutas en la misma página, persistencia IndexedDB en navegador, deduplicación y lógica de acuses de recibo. No demuestra enlaces físicos entre dispositivos ni acceso satelital.',
    capability1:'Cola local',capability1Body:'Guarda mensajes donde el navegador lo permita. Hay que probar reinicios y fallos de almacenamiento.',
    capability2:'Rutas simuladas',capability2Body:'Modela caídas, reintentos y entregas duplicadas en una demostración controlada.',
    capability3:'Confirmación de recepción',capability3Body:'El ACK simulado del receptor se distingue del intento de transmisión.',
    pendingTitle:'Aún no implementado ni validado',pendingBody:'Sin despachos reales, autenticación gubernamental, cifrado E2E garantizado, acceso satelital ni disponibilidad certificada.',
    fundingKicker:'03 / PROPONER UN PILOTO',fundingTitle:'Hagamos verificable la comunicación resiliente.',fundingBody:'Buscamos socios de investigación, entornos piloto y oportunidades de financiación para validar el diseño frente a requisitos reales de seguridad civil.',
    fundingCTA:'EXPLORAR LA DEMO',fundingGithub:'VER CÓDIGO FUENTE',
    demoBack:'Volver a la presentación',demoCitizen:'Ciudadano (ficticio)',demoCoordinator:'Coordinador (ficticio)',switchRole:'Cambiar rol',demoTitle:'Civic Relay · Laboratorio',demoBanner:'SOLO SIMULACIÓN — no usar en emergencias reales ni introducir datos personales.',demoSend:'Generar mensaje de prueba',demoTransport:'Conexión del navegador',demoActions:'Informes de ejemplo',demoQueue:'Cola local de mensajes',demoMap:'Mapa del escenario',demoInfoTitle:'Límites de offline-first',demoInfoBody:'El almacenamiento del navegador permite persistencia local; esta página no se comunica con servicios reales. El mapa base puede necesitar internet.',
    quickActions:'Acciones de ejemplo',safe:'Estoy a salvo',sos:'Necesito ayuda',medical:'Médica',fire:'Incendio',infrastructure:'Infraestructura',report:'Informe general',
    online:'El navegador indica conexión a internet',offline:'El navegador indica desconexión — no se presupone ninguna entrega externa',
    queueEmpty:'Aún no hay mensajes de prueba. Escoge una acción simulada.',queueHistory:'Historial de mensajes',queuePaths:'Confirmaciones simuladas del receptor',queueQueued:'En cola · sin entregar',queuePending:'Esperando confirmación simulada',queueAttempts:'Intentos de ruta',
    unverified:'Sin verificar',corroborated:'Corroborado',official:'Oficial',disputed:'Disputado',
    scenarioTitle:'Controles del escenario',scenarioExplanation:'Todas las alertas son ejercicios ficticios. No existe ningún canal gubernamental conectado.',scenarioAlert:'Simular alerta de prueba entrante',scenarioBroadcast:'Crear anuncio de prueba sin verificar',scenarioBidi:'Crear mensaje bidireccional de prueba',scenarioConfirm:'Confirmar seguridad (solo prueba)',scenarioCount:'Tiempo restante',scenarioAlertText:'SIMULACRO — petición ficticia de confirmación',scenarioSent:'Se añadió un mensaje simulado a la cola local.',scenarioNoAuto:'La cuenta atrás es visual; no se envía automáticamente ninguna emergencia.',
    mapTitle:'Mapa de incidentes ficticios',mapTotal:'Incidentes',mapConfidence:'Confianza de posición',priority:'Prioridad',verification:'Verificación',time:'Hora',footer:'CIVIC RELAY · PROTOTIPO DE INVESTIGACIÓN ABIERTO · NO ES UN SERVICIO DE EMERGENCIAS'
  },
  nl: {
    navStory:'DE CRISIS',navProduct:'HET PROTOTYPE',navFunding:'PARTNERS',openDemo:'OPEN SIMULATIE',heroEyebrow:'OFFLINE-FIRST • ONDERZOEKSPROTOTYPE',
    heroTitle:'Als het netwerk uitvalt,',heroAccent:'telt elk bericht.',heroBody:'Ontdek een transparante crisissimulatie: sla een bericht lokaal op, vind een gesimuleerde route en maak onderscheid tussen verzending en ontvangst.',
    scroll:'Bekijk het verhaal',notice:'Alleen een onderzoeksdemo. Geen koppeling met hulpdiensten, satellietproviders of officiële alarmeringssystemen.',
    contextKicker:'01 / HET MENSELIJKE PROBLEEM',contextTitle:'Wegvallend bereik maakt afstemming in crisissituaties moeilijk.',
    contextBody:'Branden, overstromingen en stroomuitval kunnen communicatienetwerken juist wanneer ze nodig zijn verstoren. Een app schept niet vanzelf radiodekking; zij kan wel berichten lokaal bewaren totdat een toegestane verbinding beschikbaar is.',
    storyKicker:'INTERACTIEF SCENARIO · GESIMULEERD',storyTitle:'De dag dat het netwerk stilvalt',storyIntro:'Volg een fictieve persoon tijdens een storing. Elke getoonde route is illustratief.',
    step1Title:'Een gewone dag',step1Body:'Iemand bevindt zich in een landelijk gebied met mobiel bereik.',
    step2Title:'Het incident',step2Body:'Een natuurbrand in de buurt verstoort de infrastructuur. Mobiele verbinding valt weg.',
    step3Title:'Geen route beschikbaar',step3Body:'Een normaal verzendverzoek mislukt. Niemand heeft het bericht ontvangen.',
    step4Title:'Het bericht blijft bewaard',step4Body:'Civic Relay slaat het bericht lokaal op in een wachtrij. Het staat nog steeds als niet afgeleverd.',
    step5Title:'Er verschijnt een route',step5Body:'Een hypothetische, toegestane verbinding wordt beschikbaar. Het prototype toont routering en herhaalpogingen.',
    step6Title:'Ontvangstbevestiging telt',step6Body:'Een bevestiging van de ontvanger wordt gesimuleerd. Verzenden betekent niet automatisch ontvangen.',
    step7Title:'Van prototype naar veldproef',step7Body:'Bluetooth-, mesh-, satelliet- en hulpdienstkoppelingen vereisen apparatuur, toestemming, contracten en onafhankelijke tests.',
    scene1:'MOBIEL NETWERK BESCHIKBAAR',scene2:'NETWERKSTORING',scene3:'VERZENDEN MISLUKT',scene4:'LOKAAL OPGESLAGEN · NIET AFGELEVERD',scene5:'HYPOTHETISCHE ROUTE GEVONDEN',scene6:'GESIMULEERDE ONTVANGSTBEVESTIGING',scene7:'VELDVALIDATIE NODIG',
    next:'Volgende scène',previous:'Vorige scène',replay:'Verhaal opnieuw starten',storyStatus:'Scenariostap',productKicker:'02 / WAT WERKT',productTitle:'Een reproduceerbare kern, geen gegarandeerd reddingsnetwerk.',
    productBody:'De repository bevat routeringssimulatie op één pagina, IndexedDB-opslag in de browser, deduplicatie en logica voor ontvangstbevestigingen. Geen fysieke verbinding tussen apparaten of satelliettoegang aangetoond.',
    capability1:'Lokale wachtrij',capability1Body:'Bewaar berichten als browseropslag beschikbaar is. Herstarts en opslagfouten moeten verder worden getest.',
    capability2:'Gesimuleerde routes',capability2Body:'Modelleer uitval, nieuwe pogingen en dubbele afleveringen in een gecontroleerde demonstratie.',
    capability3:'Ontvangstbewijzen',capability3Body:'Een gesimuleerde ACK van de ontvanger verschilt van een verzendpoging.',
    pendingTitle:'Nog niet gebouwd of gevalideerd',pendingBody:'Geen echte meldkamerkoppeling, overheidsauthenticatie, gegarandeerde end-to-end-versleuteling, satellietverbinding of gecertificeerde beschikbaarheid.',
    fundingKicker:'03 / PILOT AANVRAGEN',fundingTitle:'Maak veerkrachtige communicatie toetsbaar.',fundingBody:'We zoeken onderzoekspartners, pilotlocaties en financiering om het ontwerp te testen tegen echte vereisten uit de civiele veiligheid.',
    fundingCTA:'PROBEER DE DEMO',fundingGithub:'BEKIJK BRONCODE',
    demoBack:'Terug naar overzicht',demoCitizen:'Burger (fictief)',demoCoordinator:'Coördinator (fictief)',switchRole:'Wissel rol',demoTitle:'Civic Relay · Lab',demoBanner:'ALLEEN SIMULATIE — niet gebruiken voor echte noodsituaties of persoonsgegevens.',demoSend:'Testbericht maken',demoTransport:'Browserverbinding',demoActions:'Voorbeeldmeldingen',demoQueue:'Lokale berichtenwachtrij',demoMap:'Scenariokaart',demoInfoTitle:'Grenzen van offline-first',demoInfoBody:'Browseropslag ondersteunt lokaal bewaren; deze pagina communiceert niet met echte hulpdiensten. Kaarttegels kunnen internet vereisen.',
    quickActions:'Voorbeeldacties',safe:'Ik ben veilig',sos:'Hulp nodig',medical:'Medisch',fire:'Brand',infrastructure:'Infrastructuur',report:'Algemene melding',
    online:'Browser meldt internetverbinding',offline:'Browser meldt offline — externe aflevering wordt niet aangenomen',
    queueEmpty:'Nog geen testberichten. Kies een gesimuleerde actie.',queueHistory:'Berichtgeschiedenis',queuePaths:'Gesimuleerde ontvangstbevestigingen',queueQueued:'In wachtrij · niet afgeleverd',queuePending:'Wacht op gesimuleerde bevestiging',queueAttempts:'Routepogingen',
    unverified:'Niet geverifieerd',corroborated:'Bevestigd',official:'Officieel',disputed:'Betwist',
    scenarioTitle:'Scenariobediening',scenarioExplanation:'Alle meldingen zijn fictieve oefeningen. Er is geen overheidskanaal gekoppeld.',scenarioAlert:'Simuleer inkomende testmelding',scenarioBroadcast:'Maak ongeverifieerde testmelding',scenarioBidi:'Maak testbericht in twee richtingen',scenarioConfirm:'Bevestig veiligheid (alleen test)',scenarioCount:'Resterende tijd',scenarioAlertText:'OEFENING — fictieve vraag om veiligheidsbevestiging',scenarioSent:'Gesimuleerd bericht toegevoegd aan lokale wachtrij.',scenarioNoAuto:'De aftelling is alleen visueel; er wordt niet automatisch een noodmelding verzonden.',
    mapTitle:'Kaart met fictieve incidenten',mapTotal:'Incidenten',mapConfidence:'Locatienauwkeurigheid',priority:'Prioriteit',verification:'Verificatie',time:'Tijd',footer:'CIVIC RELAY · OPEN ONDERZOEKSPROTOTYPE · GEEN HULPDIENST'
  }
};
export function t(locale: Locale, key: string): string {
  return dictionary[locale][key] ?? dictionary.en[key] ?? key;
}
export function initialLocale(): Locale {
  const query = new URLSearchParams(window.location.search).get('lang');
  const saved = window.localStorage.getItem('civic-relay-language');
  const candidate = query ?? saved ?? navigator.language.slice(0, 2);
  return SUPPORTED_LOCALES.includes(candidate as Locale) ? candidate as Locale : 'en';
}

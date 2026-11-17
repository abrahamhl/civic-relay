# Mensaje corto España → Países Bajos sin red móvil ni Internet (estado a 2026-11-12)

**Caso:** un hombre en España quiere mandar un texto corto a su hermano en Países Bajos. Ninguno de los dos tiene red móvil ni Internet (modo avión, apagón regional). Entre ellos no hay teléfonos con nuestra app.
**Pregunta:** qué vías reales y verificables hay para llevar el mensaje hasta «cualquier punto con Internet», y cómo vuelve hasta el destinatario.

**Método y límites de esta investigación**
- Solo se usó búsqueda web (WebSearch). La descarga directa de páginas (WebFetch) estaba bloqueada por DNS en este entorno: `support.apple.com`, `support.google.com` y `www.thethingsnetwork.org` dieron `ENOTFOUND`. Por eso varias cifras proceden de resúmenes de búsqueda que citan la página oficial y no de la página leída entera. Se marcan con confianza **media**.
- Regla: no se inventan cifras. Donde no hay dato aparece «no encontrado».
- Nada de lo aquí descrito autoriza a abusar de redes de terceros (ver §5).

---

## 0. Conclusión rápida para el caso de los dos hermanos

El punto clave es este: **ambos extremos están sin red**. No basta con que el mensaje llegue a Internet: el hermano de NL también necesita una vía de bajada que no dependa de su móvil. En la práctica, eso exige que **los dos tengan el mismo tipo de equipo** (o que el de NL recupere red más tarde y lea el mensaje con retraso).

| # | Opción | ¿Sin red en el emisor? | Hardware extra | Coste | Latencia | Carga útil | Legal ES/NL | ¿Llega al hermano sin red? | Confianza |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Comunicador satelital Iridium de consumo** (Garmin inReach / ZOLEO), uno por hermano | Sí, con cielo despejado | Sí, un dispositivo por persona + suscripción | Dispositivo + plan mensual (ZOLEO lanzó en Europa con planes de 20–60 €/mes en 2022; Garmin: no encontrado precio actual en €) | Minutos (no encontrado dato oficial) | ~160 caracteres por mensaje (dato de Garmin para un mercado no europeo) | Legal (servicio comercial) | **Sí**, de dispositivo a dispositivo; también a SMS o e‑mail cuando el otro tenga red | Alta en lo funcional; media en precios |
| 2 | **RockBLOCK 9603 (Iridium SBD)**, uno por hermano, con entrega directa entre RockBLOCK | Sí, con cielo despejado | Sí, módulo + antena + integración (BLE/serie) | 1 crédito por cada 50 B; paquetes de £0,16 a £0,077 por crédito; cuota de línea £13/mes (página sin fecha) | Segundos a minutos (no encontrado dato oficial) | 340 B de subida / 270 B de bajada | Legal | **Sí**: prefijo `RB` + número de serie de destino, dentro del mismo *Delivery Group* | Alta |
| 3 | **Meshtastic / MeshCore + pasarela MQTT** | Sí, por radio LoRa | Sí, nodo LoRa (~ESP32/nRF52) para cada uno | Solo el nodo | Segundos a horas, depende de la malla | ≤ 233 B (Meshtastic) | Legal en ISM 868 (10 % de ciclo en 869,4–869,65 MHz) | Solo si **a ambos lados** hay un nodo con Internet y la bajada (*downlink*) está activada. En apagón regional suele fallar | Media |
| 4 | **LoRaWAN comunitario (TTN)**, dos dispositivos en la misma aplicación TTN | Sí, por radio LoRa | Sí, módulo LoRaWAN + BLE (p. ej. RAK4631) para cada uno | Gratis (TTN), dentro de la política de uso justo | Segundos (subida); bajada solo tras una subida del receptor (clase A) | 51 B a SF12 (DR0–2), 222 B en DR4–5 | Legal (ISM) | Solo si hay pasarelas TTN **con electricidad e Internet** a ambos lados; máximo 10 bajadas al día | Media‑alta |
| 5 | **SMS por satélite directo al móvil (D2C)** | Sí | Ninguno (móvil compatible + operador) | Orange Francia: gratis hasta junio de 2026, después ~5 €/mes (según prensa) | Minutos | SMS | Legal | **No hoy en ES/NL**: España solo tiene un piloto (MasOrange + Starlink); en NL no se encontró ningún anuncio | Alta |
| 6 | **SOS por satélite** (Apple, Pixel) | Sí | Ninguno (iPhone 14+ / Pixel compatibles) | Gratis en el periodo promocional (detalles en §3) | Minutos | Mensaje guiado de emergencia | Legal **solo para emergencias reales** | Indirectamente: Apple avisa a los contactos de emergencia (el hermano los recibe cuando tenga red) | Alta |
| 7 | **Radioafición** (Winlink HF, APRS / LoRa APRS) | Sí | Sí, equipo de radio + **licencia** para cada uno | Equipo | Minutos a horas | APRS: 67 caracteres; Winlink: e‑mail | **Cifrado prohibido** en ES y NL; requiere licencia | Winlink por HF puede llegar de ES a NL sin Internet (de estación a estación) | Media‑alta |
| 8 | **112** | Sí, a través de cualquier operador disponible | Ninguno | Gratis | Inmediata | Voz | Solo emergencias | No: no sirve para avisar al hermano | Alta |
| ✗ | Redes Find My de Apple/Google, Wi‑Fi ajenas, sondas Wi‑Fi | — | — | — | — | ~3 B/s (Send My) | Fuera de los términos del servicio y con riesgo penal; descartado | — | Alta |

**Recomendación práctica:** para dos hermanos que quieren certeza hoy, la opción 1 es la más sencilla: dos comunicadores Iridium de consumo. Para SENDA (integrable, más barato por mensaje y binario), la opción 2: RockBLOCK a RockBLOCK. Las opciones 3 y 4 son complementos baratos que funcionan en cortes locales, pero no en un apagón regional prolongado, porque las pasarelas pierden la electricidad o la conexión.

---

## 1. LoRaWAN comunitario

### 1.1 The Things Network (TTN)
- **Cómo usa un dispositivo ajeno las pasarelas:** cualquier dispositivo registrado (OTAA) en una aplicación de TTN puede subir datos a través de **cualquier pasarela comunitaria de TTN**. Es el funcionamiento normal, no un abuso. Packet Broker extiende esto a otras redes: admite «class A and C downlink as well as OTAA device activations» y enruta por DevAddr.
  Fuente: https://www.thethingsindustries.com/docs/concepts/packet-broker/
- **Política de uso justo (red pública):** **30 s de tiempo en el aire de subida por dispositivo y día** y **10 bajadas por dispositivo y día**. No se aplica a redes privadas, aunque siguen vigentes los límites legales de ciclo de trabajo. Hay dudas en el foro sobre si las bajadas de ADR cuentan para el límite.
  Fuentes: https://www.thethingsnetwork.org/forum/t/fair-use-policy-explained/1300 ; https://www.thethingsnetwork.org/docs/lorawan/duty-cycle/ ; https://www.thethingsnetwork.org/forum/t/v3-with-adr-violating-the-fair-use-policy/49365
- **Carga útil máxima de aplicación (EU868):** DR0–DR2 (SF12–SF10): **51 B**. DR3 (SF9): **115 B**. DR4–DR7: **222 B** (N = M − 8 sin FOpts).
  Fuentes: https://lora-developers.semtech.com/library/tech-papers-and-guides/the-book/packet-size-considerations ; https://www.thethingsnetwork.org/docs/lorawan/regional-parameters/eu868/ ; https://www.actility.com/lorawan-regional-parameters/
- **Bajada (clase A):** solo se puede enviar en las ventanas RX1/RX2, justo después de una subida del propio dispositivo. Por tanto, el hermano de NL recibe el mensaje solo cuando su dispositivo transmite algo. El servidor de red elige la pasarela.
  Fuentes: https://www.thethingsnetwork.org/forum/t/mobility-in-lorawan/19226 ; https://docs.aws.amazon.com/iot-wireless/latest/developerguide/lorawan-gateway-participate.html
- **Densidad NL frente a ES:** no se encontró un recuento nacional actual.
  - NL: la comunidad de Rotterdam muestra «691 gateways within ~29.5 km (Packet Broker), 134 online». Den Haag: «152 gateways within ~10 km, 30 online». Amsterdam: 31 pasarelas de la comunidad. NL tiene 63 comunidades TTN.
  - ES: la página de país muestra 58 comunidades y 1137 miembros, pero «0 gateways» (dato incoherente). Madrid: «47 online» en ~50 km. Córdoba: 25 pasarelas (2021). Figueres: 2.
  - Conclusión cualitativa: **NL es mucho más denso** que ES. Para un recuento real hay que consultar `https://www.thethingsnetwork.org/gateway-data/country/nl` (y `/es`), que no se pudo descargar.
  Fuentes: https://www.thethingsnetwork.org/community/rotterdam/ ; https://www.thethingsnetwork.org/community/denhaag/ ; https://www.thethingsnetwork.org/community/amsterdam/ ; https://thethingsnetwork.org/country/spain ; https://www.thethingsnetwork.org/community/madrid/
- **Apagón:** las pasarelas comunitarias son domésticas (router + electricidad). En el apagón ibérico del 28‑04‑2025, incluso las antenas de los operadores aguantaron solo 4–8 h con baterías (§6). No hay que contar con TTN en un apagón regional largo.

### 1.2 Helium IoT
- Recuento por país (ES/NL): **no encontrado**. Hay estimaciones globales de terceros (cripto) de ~350 000–400 000 *hotspots* activos, sin desglose por país y con fiabilidad baja. En NL hubo un acuerdo de *roaming* con Techtenna (2022).
  Fuentes: https://www.helium.com/snapshot ; https://rcrwireless.com/20220310/internet-of-things/helium-expands-european-roaming-with-dutch-lorawan-group-techtenna
- Funciona con dispositivos LoRaWAN estándar mediante un LNS compatible con Helium y pago por datos. Para este caso no aporta nada sobre TTN si no se conoce la cobertura local.

### 1.3 Módulos LoRaWAN baratos con Bluetooth hacia el móvil
- **RAK4631 (WisBlock, nRF52840 + SX1262):** tiene BLE y LoRaWAN en el mismo chip. Existen ejemplos de BLE‑UART y de LoRaWAN OTAA en EU868. El proyecto WisBlock‑API‑V2 combina «sending data over BLE UART» y «over LoRaWAN». **No se encontró ninguna app terminada** para enviar texto del móvil a TTN; hay que hacer la integración (la haría SENDA).
  Fuentes: https://www.github.com/beegee-tokyo/WisBlock-API-V2 ; https://www.hackster.io/user2702447/getting-started-with-wisblock-and-the-things-network-ttn-0a7b84
- **RAK4600:** admite comandos AT por BLE desde nRF Connect para unirse a The Things Stack.
  Fuente: https://docs.rakwireless.com/product-categories/wisduo/rak4600-breakout-board/quickstart/
- El mismo hardware (RAK4631, Heltec, T‑Beam) sirve también para Meshtastic y MeshCore cambiando el firmware.

---

## 2. Meshtastic y MeshCore

- **Radio en la UE (EU_868):** 869,4–869,65 MHz, **10 % de ciclo de trabajo por hora** (calculado minuto a minuto sobre una ventana móvil de 1 h; el nodo deja de transmitir al alcanzarlo). El preset LongFast usa por defecto 869,525 MHz. Corresponde a la sub‑banda «P» de ETSI EN 300 220 (10 %, 500 mW ERP).
  Fuentes: https://meshtastic.org/docs/configuration/radio/lora ; https://www.thethingsnetwork.org/docs/lorawan/regional-limitations-of-rf-use/
- **Pasarela a Internet (MQTT):**
  - En el servidor público `mqtt.meshtastic.org` rige una **política *zero‑hop***: lo que baja del servidor solo llega a los nodos conectados directamente y no se propaga por la malla.
  - Con la PSK por defecto solo se priorizan ciertos *portnums* (texto, posición, info de nodo, telemetría).
  - **La bajada (downlink) está desactivada por defecto** y se activa canal a canal.
  - El tráfico en el bróker público lo puede leer cualquiera que esté suscrito.
  - Desde el 21‑08‑2024 ya no se puede suscribir a «todos los temas» del servidor del proyecto.
  Fuentes: https://meshtastic.org/docs/software/integrations/mqtt/ ; https://meshtastic.org/docs/configuration/module/mqtt/
- **España:** la comunidad tiene su propio servidor `mqtt.meshtastic.es` («Iberia» con uplink y downlink activados), un mapa y Meshview. En la consulta, `malla.meshtastic.es` registraba **~3097 nodos totales y 1606 activos en 24 h** (instantánea, no oficial).
  Fuentes: https://mapa.meshtastic.es ; https://malla.meshtastic.es/ ; https://meshview.meshtastic.es/top
- **Países Bajos:** los nodos con Internet suelen conectarse a `mqtt.meshnet.nl` (según RevSpace). Recuento de nodos: **no encontrado**. Hay mucha actividad en **MeshCore** (encuentro en Amersfoort en mayo de 2026; «cientos» de repetidores según una fuente comercial, sin fecha; Xebia migró a MeshCore en enero de 2026). Waag (Ámsterdam) prueba NodeNet.
  Fuentes: https://www.revspace.nl/Meshtastic ; https://wiki.heltec.org/news/heltec-supports-meshcore-community-meetup-in-the-netherlands/heltec-supports-meshcore-community-meetup-in-the-netherlands ; https://xebia.com/blog/meshtastic-to-meshcore/ ; https://waag.org/en/article/nodenet-mesh-local-emergency-network/
- **ES→NL por Meshtastic:** la malla no cruza Francia por radio. El único camino es *nodo ES → MQTT → Internet → MQTT → nodo NL con downlink*. Además, los servidores son distintos (ES usa `mqtt.meshtastic.es`, NL usa `mqtt.meshnet.nl`, y el público aplica *zero‑hop*), así que hay que **acordar un canal y un bróker común**. Sin un puente así preparado, el mensaje no llega. MeshCore tiene un modelo de puente propio: no se verificó su soporte MQTT en esta investigación.
- **Cifrado:** está permitido en ISM. El mensaje privado debe ir cifrado de extremo a extremo (canal con PSK propia o mensaje directo con PKC), sobre todo si pasa por un bróker público.

---

## 3. Satélite para consumidores (situación en ES y NL)

### 3.1 Apple
- **Emergencia SOS vía satélite:** disponible en **Países Bajos (desde iOS 16.4, marzo de 2023)** y en **España (desde septiembre de 2023)**, entre otros. «Encontrar vía satélite» (compartir ubicación) llegó a esos mismos países al mismo tiempo. Si hay contactos de emergencia configurados en Salud, se les puede notificar. Para seguir recibiendo mensajes deben responder «YES» en 48 h.
  Fuentes: https://www.apple.com/pt/newsroom/2023/03/emergency-sos-now-in-austria-belgium-italy-luxembourg-netherlands-portugal/ ; https://www.macrumors.com/2023/09/13/emergency-sos-via-satellite-spain-switzerland/ ; https://support.apple.com/en-us/101573 (no descargable aquí) ; https://www.apple.com/legal/privacy/data/en/safety-features/
- **Mensajes vía satélite (iMessage/SMS no urgentes):** según resúmenes de septiembre de 2026, solo está disponible en **EE. UU., Canadá, México y Japón**. **No disponible en ES ni NL.**
  Fuentes: https://www.macrumors.com/2025/10/10/apple-satellite-features-which-countries/ ; https://applemagazine.com/iphone-satellite/
- **Uso para el caso:** solo vale en emergencias reales. No transporta datos arbitrarios. Hacer un «SOS» para mandar un recado sería un abuso del servicio de emergencias.

### 3.2 Google Pixel / Android
- **Satellite SOS de Pixel:** la página oficial de soporte incluye **España y Países Bajos** (según varias versiones en caché; no se pudo leer la página en vivo). También aparece en la del Pixel Watch. Requiere Google Mensajes como app por defecto.
  Fuentes: https://support.google.com/pixelphone/answer/15254448 ; https://support.google.com/googlepixelwatch/answer/16407554
- **SMS por satélite no urgente:** **Orange Francia** («Message Satellite», con Skylo) abrió el servicio a consumidores el **11‑12‑2025**. Funciona en Pixel 9 y Pixel 10 (no en el 9a) con planes 5G/5G+, y en Francia «y 36 países más» (lista no verificada). Fue gratis hasta junio de 2026; después ~5 €/mes según la prensa. **No hay servicio equivalente en España ni en NL.**
  Fuentes: https://www.orange.com/en/our-news/send-texts-remote-areas-through-satellites ; https://www.skylo.tech/newsroom/orange-becomes-the-first-european-operator-to-offer-satellite-sms-service-with-skylo ; https://www.androidcentral.com/phones/google-pixel/pixel-9-10-gain-brief-satellite-texting-exclusivity-via-european-carrier-orange
- **Samsung Galaxy S25:** el satélite depende del operador (EE. UU.: Verizon, Xfinity, Spectrum). En Europa (ES/NL) **no se encontró ningún operador** que lo active.
  Fuente: https://www.gsmarena.com/samsung_galaxy_s25_comes_with_satellite_messaging_but_not_everyone_can_use_it-news-66268.php
- **Deutsche Telekom + Skylo + Qualcomm:** demostración de SMS por satélite (prueba con Cosmote, Grecia) y objetivo comercial en 2026. No afecta a ES/NL.
  Fuente: https://skylo.tech/newsroom/deutsche-telekom-skylo-and-qualcomm-demonstrate-sms-over-satellite-directly-from-smartphones

### 3.3 Starlink Direct to Cell / «Starlink Mobile» en ES y NL
- **España:** el acuerdo **MasOrange–SpaceX** (febrero de 2026) prevé un **piloto en Valladolid**. La SETID autorizó el uso de espectro de MasOrange. Starlink dijo que España sería «the first country in the European Union to launch Starlink Direct to Cell this year». Según ADSLZone, el Galaxy S26 es el primer terminal compatible. **No se encontró fecha de lanzamiento comercial, precio ni resultados del piloto.** Una guía de octubre de 2026 lo confirma.
  Fuentes: https://www.satellitetoday.com/connectivity/2026/02/03/masorange-to-trial-starlink-direct-to-cell-in-spain/ ; https://x.com/Starlink/status/2018717668417605926 ; https://www.adslzone.net/noticias/operadores/primer-movil-compatible-starlink-espana/ ; https://redhuevo.com/blog/starlink-movil-espana
- **Países Bajos:** **no se encontró ningún acuerdo** de KPN, VodafoneZiggo u Odido con Starlink, Skylo o AST.
- **Deutsche Telekom:** usará Starlink Mobile V2 en **10 países europeos a partir de 2028**. Los que se nombran son Alemania, Austria, Polonia, Chequia y Hungría. Telekom ya no es dueña de T‑Mobile NL (hoy Odido), así que ese anuncio no cubre NL. Esto último es conocimiento previo, no una fuente consultada aquí.
  Fuente: https://www.satellitetoday.com/connectivity/2026/03/02/deutsche-telekom-to-launch-first-starlink-mss-d2d-service-in-europe
- Fuera de ES/NL hay servicio comercial en Reino Unido (VMO2) y Ucrania (Kyivstar), según `satellites.mjs`.

### 3.4 Comunicadores Iridium (dispositivo dedicado)
- **Garmin inReach:** envía mensajes a otro inReach, a SMS o a e‑mail por Iridium, con cobertura global, ES y NL incluidos. Precios: en un mercado no europeo (Malasia, en USD), planes desde 11,95 $/mes (anual) y **0,50 $ por mensaje de hasta 160 caracteres**. Un resumen de terceros de 2025 da Essential a 14,99 $/mes y Standard a 29,99 $/mes. **Precio actual en euros para ES/NL: no encontrado.**
  Fuentes: https://www.garmin.com.my/minisite/inreach/personal/ ; https://www.garmin.com/en-CA/blog/outdoor/overview-inreach-subscription-plans/
- **ZOLEO:** usa Iridium, con número SMS y e‑mail propios, y mensajes de app a app. Se lanzó en Europa en 2022 a 269 € el dispositivo y **20–60 €/mes**. La pausa del plan cuesta 4,50 €/mes (página DK).
  Fuentes: https://www.zoleo.com/en-nz/newsroom/zoleo-inc-announces-expansion-to-europe ; https://www.zoleo.com/en-dk/plans
- **Motorola Defy Satellite Link / Bullitt:** Bullitt Group entró en administración en febrero de 2024. Los fundadores compraron la propiedad intelectual por 210 000 £. Hay informaciones de que el servicio seguiría, pero **no se encontró confirmación oficial** de que hoy funcione. **No recomendable.**
  Fuentes: https://www.theregister.com/2024/03/12/bullitt_group_had_200_cash/ ; https://gpstraining.co.uk/blogs/news/bullitt-what-is-going-on-with-regard-to-the-motorola-defy-satellite-link
- **Para los dos hermanos:** es la solución «comprar y usar» más fiable, siempre que **cada uno tenga su propio dispositivo**. Un mensaje a SMS solo lo leerá el hermano cuando recupere la red.

### 3.5 Iridium SBD (RockBLOCK 9603)
- **Tamaño:** 340 B de subida (MO) y 270 B de bajada (MT).
  Fuente: https://docs.groundcontrol.com/iot/rockblock/user-manual/transmit-binary
- **Crédito:** **«1 credit is used per 50 bytes (or part thereof) of message sent or received»** (documentación de Ground Control). Los créditos se comparten entre los dispositivos de la cuenta y caducan solo tras 12 meses sin uso.
  Fuente: https://docs.groundcontrol.com/iot/rockblock/web-services/iridium-contract-costs
- **Precios (página de producto sin fecha):** cuota de línea **£13,00/mes**; créditos desde **£8 por 50 (£0,16/crédito)** hasta **£0,077/crédito** comprando 5000. Un mensaje de 340 B son 7 créditos, unos **£0,54–1,12**, más la cuota de línea.
  Fuente: https://store.groundcontrol.com/products/rockblock-9603
- **De RockBLOCK a RockBLOCK sin Internet en el destino:** si el mensaje lleva el prefijo **`RB` + número de serie (7 bytes)** del destino y ambos módulos están en el mismo *Delivery Group*, se entrega directamente al otro módulo. Así se resuelve la bajada hacia NL.
  Fuentes: https://docs.groundcontrol.com/iot/rockblock/web-services/rockblock-gateway-commands ; https://docs.rockblock.rock7.com/docs/messaging-between-rockblocks

### 3.6 IoT por satélite (no útil hoy para consumidores)
- **Sateliot (España, 5G NB‑IoT NTN Rel‑17):** 11 satélites tras lanzar 5 más en octubre de 2026. Tiene acuerdos con Telenor IoT (mayo de 2026) y Eseye. Un análisis de septiembre de 2026 dice que el IoT satelital «still far from… commercial maturity». **Servicio comercial general: no confirmado.** Además, no hay móviles de consumo que lo usen.
  Fuentes: https://satnews.com/2026/10/03/sateliot-launches-five-alen-space-built-cubesats-for-draconis-5g-ntn-iot-mission/ ; https://iot.telenor.com/press-release/telenor-iot-and-sateliot-announce-partnership-to-enable-seamless-terrestrial-satellite-iot-connectivity/ ; https://satellitemarkets.com/market-trends/satellite-iot-2026-two-track-market
- **Myriota:** activa. Lanzó 4 satélites en julio de 2026 y tiene HyperPulse 5G NTN. Está orientada a la industria. Fuentes: https://satnews.com/2026/07/01/myriota-unveils-hybrid-5g-satellite-and-cellular-iot-network-subscriptions/
- **Lacuna Space:** abrió «LoneWhisper» D2D a colaboradores en febrero de 2026; orientada a la industria. Fuente: https://wiot-group.com/think/en/news/lacuna-space-lonewhisper-d2d-satellite-iot-partners/
- **Astrocast:** pasó por una «very challenging period of restructuring». En junio de 2025 firmó un acuerdo con WISeSat. **Estado comercial actual: no encontrado.** Fuente: https://www.gurufocus.com/news/2944202/wisesat-signs-a-service-agreement-with-astrocast-to-allow-access-to-astrocasts-operational-satellite-constellation-wkey-stock-news
- **Amazon Sidewalk:** no está disponible en la UE (solo EE. UU., Canadá y México, según Semtech; el «plan 2026» no está confirmado por Amazon). Fuente: https://www.semtech.com/amazon-sidewalk-faqs

---

## 4. Radioafición

- **Prohibición de cifrar:**
  - **Países Bajos:** la *Regeling gebruik van frequentieruimte met meldingsplicht 2015*, art. 10, exige que la información no se transmita cifrada («niet versleuteld»). Hay una excepción en el art. 9 que no se verificó en el texto completo. Fuente: https://wetten.overheid.nl/BWBR0036375/2024-06-20/0
  - **España:** la Orden IET/1311/2013 regula el servicio de radioaficionados. Una guía divulgativa (no oficial) resume que «no pueden ocultarse mensajes mediante cifrado» salvo excepciones de satélite. El texto literal del BOE **no se verificó**. El reglamento de 1986 (derogado) exigía «lenguaje claro». Fuentes: https://www.fediea.org/legisla/o210386.php ; https://www.ure.es/licensing-and-basic-info-for-visitor-hams/
  - Se puede **firmar** (autenticar) sin ocultar el contenido. Así lo modela ya SENDA (`encryptionAllowed: false`).
- **Licencia:** obligatoria en ambos países para transmitir. Winlink «is open to properly licensed amateur radio operators». Sus términos dicen que el contenido «is not private».
  Fuentes: https://winlink.org/node/101 ; https://en.wikipedia.org/wiki/Winlink
- **Winlink:** e‑mail por radio. En HF puede ir de una estación en ES a una en NL sin Internet (modo P2P), o a una pasarela RMS con Internet. Recuento de RMS en ES/NL: **no encontrado**.
- **APRS:** hay muchos iGates en España, sobre todo **LoRa APRS** (ESP32) en Galicia, Asturias y Castilla y León. Recuento por país: **no encontrado** (aprs.fi solo muestra páginas por estación). Un mensaje APRS tiene un máximo de 67 caracteres.
  Fuente de ejemplo: https://eu.aprs.fi/info/EA1IQY-10
- **Para el caso:** solo es viable si **los dos hermanos tienen licencia** y equipo, y el mensaje privado no puede ir cifrado. Es poco práctico para un particular.

---

## 5. Usar dispositivos de terceros sin su app (por qué NO lo haremos)

### 5.1 Apple Find My: «Send My» (Positive Security, 12‑05‑2021)
- **Cómo funciona:** un ESP32 emite anuncios BLE de Find My cuyas claves públicas codifican bits del mensaje. Los iPhone cercanos, sin que su dueño lo sepa, cifran su ubicación con esas claves y la suben a Apple. Después, el receptor consulta desde un Mac qué claves tienen informes y reconstruye los bits.
- **Rendimiento:** ~**3 bytes/s** de media. No se encontró límite de tasa. El autor lo comparó con «crear Amazon Sidewalk con la infraestructura de Apple». Se basa en OpenHaystack (TU Darmstadt, SEEMOO).
- **Por qué es difícil de bloquear:** el diseño anónimo de la red hace que Apple «may find it impossible to block».
  Fuentes: https://positive.security/blog/send-my ; https://www.theregister.com/2021/05/12/apples_find_network/
- **nRootTag (George Mason, USENIX Security 2025):** convierte cualquier dispositivo Bluetooth (Linux, Android, Windows) en un «AirTag» sin necesidad de root, buscando claves con GPU. Éxito de más del 90 % en minutos. Se informó a Apple en julio de 2024; las fuentes discrepan sobre si está corregido.
  Fuentes: https://www.usenix.org/conference/usenixsecurity25/presentation/chen-junming ; https://people.cs.gmu.edu/~zeng/papers/2025-security-nrootgag.pdf
- **Google Find My Device / Find Hub:** la evaluación académica de PoPETs 2025 (SEEMOO) analiza su seguridad. Un resumen de agosto de 2025 menciona transmisión de datos arbitrarios por Find My y Find Hub, pero **no se localizó el artículo original**.
  Fuentes: https://petsymposium.org/popets/2025/popets-2025-0147.php ; https://security.googleblog.com/2024/04/find-my-device-network-security-privacy-protections.html
- **Estado legal y contractual:**
  - El acceso oficial a la red Find My es el **programa MFi «Find My network accessory»**, con licencia y especificación restringidas. Las apps y dispositivos no certificados están fuera de ese marco.
    Fuentes: https://mfi.apple.com/faqs ; https://www.apple.com/newsroom/2021/04/apples-find-my-network-now-offers-new-third-party-finding-experiences/
  - Usar los teléfonos y los datos móviles de terceros sin su consentimiento para transportar nuestros datos va contra los términos del servicio y es éticamente inaceptable. Además, recuperar el mensaje exige una cuenta de Apple y un Mac en el lado receptor, lo que **no sirve si el hermano tampoco tiene Internet**. **Decisión: no se implementa.**

### 5.2 ESP‑NOW, sondas Wi‑Fi y hotspots abiertos
- **ESP‑NOW:** protocolo de Espressif entre chips ESP. Ningún teléfono de terceros lo reenvía, así que solo sirve entre nuestros propios nodos. No resuelve el problema de «no hay nadie con la app».
- **Sondas Wi‑Fi:** los móviles no reenvían el contenido de sondas ajenas a Internet. No es un portador.
- **Wi‑Fi abierta de terceros:**
  - **NL:** acceder a una red **protegida** es *computervredebreuk* (art. 138ab Sr; Hof Den Haag 2013). Sobre redes abiertas, la jurisprudencia de 2011 no es concluyente.
    Fuentes: https://www.bijzonderstrafrecht.nl/home/onbevoegd-gebruik-maken-van-andermans-beveiligde-wifi-netwerk-valt-onder-computervredebreuk ; https://merlin.obs.coe.int/article/5746
  - **ES:** el art. 197 bis CP castiga el acceso «vulnerando las medidas de seguridad». Algunas fuentes apuntan al art. 255 (defraudación de telecomunicaciones) para el uso no autorizado de una red abierta ajena. La doctrina no es unánime.
    Fuentes: https://www.legalitas.com/actualidad/soy-responsable-de-los-delitos-cometidos-con-mi-wifi ; https://www.xatakamovil.com/conectividad/que-tu-vecino-tenga-wi-fi-abierta-tentacion-colarte-puede-salirte-caro
  - Solo es aceptable usar Wi‑Fi **ofrecida al público** (municipal o comercial). En un apagón suele estar caída igualmente.

---

## 6. Red parcial, difusión celular y 112

- **112 por cualquier operador:** el Gobierno de NL indica que se puede llamar al 112 sin saldo y sin SIM válida, y que si tu operador no tiene señal el móvil «will automatically search and connect to any other available network». Sin SIM, no se transmiten el número ni la ubicación al centro de emergencias, así que no te pueden devolver la llamada.
  Fuentes: https://www.government.nl/faq/emergency-number-112/what-happens-when-i-call-112-from-my-mobile ; https://www.government.nl/faq/emergency-number-112/what-can-i-do-if-i-can-t-reach-112
- **Base en la UE:** el art. 109 de la Directiva (UE) 2018/1972 (CECE) obliga al acceso gratuito al 112. Los Estados informan de que el 112 está disponible en *roaming*. Según EENA, BEREC confirmó en junio de 2026 que la continuidad del 112 debe mantenerse durante el apagado de 2G/3G (solo visto en un fragmento).
  Fuentes: https://digital-strategy.ec.europa.eu/en/library/2020-report-effectiveness-implementation-european-emergency-number-112 ; https://eena.org/news/are-europeans-safe-while-travelling-european-commission-recognises-upcoming-loss-of-access-to-112-while-roaming/
  - **Límite:** el 112 es solo para emergencias. No sirve para pasar un mensaje al hermano. **El SMS normal NO se encamina por otros operadores**: solo el 112 tiene ese trato. En España, la CNMC ha **propuesto** que las cuatro redes funcionen como una sola en situaciones excepcionales, pero es una propuesta, no una obligación vigente.
  Fuentes: https://bandaancha.eu/articulos/cnmc-pide-unir-cobertura-movil-movistar-11703 ; https://www.mobileworldlive.com/spanish/la-cnmc-propone-una-red-movil-unica-de-emergencia-para-proteger-las-comunicaciones-ante-futuros-apagones/
- **Difusión celular (ES‑Alert / NL‑Alert):** cumple el art. 110 del CECE. Va solo **de la autoridad al ciudadano** y no sirve para enviar mensajes. NL‑Alert existe desde 2012; ES‑Alert, desde 2022–2023.
  Fuentes: https://en.wikipedia.org/wiki/EU-Alert ; https://en.wikipedia.org/wiki/NL-Alert
- **Apagón ibérico (28‑04‑2025):**
  - Más del 50 % de los usuarios móviles quedaron sin servicio en amplias zonas, según una fuente. Vodafone habla de pérdidas de hasta el 90 % en algunas áreas.
  - Las baterías de los emplazamientos duraron unas **4–6 h** (hasta ~8 h).
  - La CNMC recomienda autonomía energética obligatoria, *roaming* entre operadores y alertas por DAB+.
  - Conclusión: con red parcial y señal débil, el SMS es lo que más probabilidades tiene de pasar, siempre que tu propio operador siga en pie.
  Fuentes: https://www.mobileworldlive.com/spanish/asi-afrontan-las-operadoras-espanolas-el-gran-apagon-electrico-iberico/ ; https://www.vodafone.es/c/empresas/grandes-clientes/es/nuestra-vision/apagon-abril-vodafone-red-mas-resilente/ ; https://www.datacenterdynamics.com/es/features/c%C3%B3mo-les-fue-a-los-operadores-de-la-pen%C3%ADnsula-ib%C3%A9rica-durante-el-gran-apag%C3%B3n/

---

## 7. Correcciones propuestas al catálogo SENDA

### `packages/senda/src/bearers.mjs`
1. **`SAT_D2C_SMS`**
   - Hoy **no existe en ES ni en NL**. España solo tiene el piloto MasOrange/Starlink sin fecha comercial; NL no tiene ningún anuncio. `p: 0.7` y `costEUR: 0` llevan a error.
   - Propuesta: añadir `regions: { ES: 'PILOT', NL: 'NONE', FR: 'COMMERCIAL_SKYLO' }` (o similar) y `p: 0` por defecto fuera de las regiones con servicio comercial.
   - Coste: Orange FR fue gratis hasta junio de 2026 y después ~5 €/mes (según prensa).
   - Cambiar `network: 'STARLINK_D2C'` por algo neutral. El único servicio comercial en la UE (Orange) usa **Skylo**, no Starlink.
2. **`IRIDIUM_SBD`**
   - Confirmado: 1 crédito por cada 50 B, según la documentación de Ground Control. Quitar la duda.
   - Añadir el **coste fijo de £13/mes de cuota de línea**, que hoy no aparece.
   - Con £0,077–0,16 por crédito, un mensaje de 340 B (7 créditos) cuesta unos £0,54–1,12. `costEUR: 1.0` es razonable como techo.
   - Añadir nota sobre **entrega directa entre RockBLOCK** (prefijo `RB` + número de serie de 7 bytes, mismo *Delivery Group*). Así se cubre la bajada al destinatario sin Internet. Ojo: el prefijo ocupa bytes de los 340, así que la MTU útil baja a ~335 B (cálculo propio: 2 B «RB» + 3 B de serie en binario; verificar).
3. **`MESHTASTIC`**
   - El 10 % de ciclo y la carga útil ≤ 233 B están confirmados.
   - Precisar que el 10 % aplica a la sub‑banda 869,4–869,65 MHz.
   - Añadir que salir a Internet requiere un nodo MQTT con *downlink* activado (por defecto está apagado), y que el servidor público aplica *zero‑hop*. Para ES→NL, `p` debe depender de que exista un puente MQTT común; si no, `p≈0`.
4. **Añadir `LORAWAN_TTN`** (no existe)
   - `mtu: 51` (SF12, DR0–2) y hasta 222 en DR4–5.
   - Uso justo: 30 s/día de aire y 10 bajadas/día. Bajada solo después de una subida (clase A).
   - `encryptionAllowed: true`, `costEUR: 0`, `hardware: 'Módulo LoRaWAN+BLE (p. ej. RAK4631)'`.
   - En apagón regional, `p` debe ser bajo (pasarelas domésticas sin electricidad).
5. **Añadir `IRIDIUM_MESSENGER`** (Garmin inReach / ZOLEO)
   - SMS/e‑mail/de dispositivo a dispositivo, ~160 caracteres (cifra de Garmin en mercado no UE), plan mensual.
   - Es la opción comercial más directa para particulares. Se integra por la app del fabricante o por e‑mail, no con fragmentos binarios.
6. **`APRS`**
   - La etiqueta «VHF/ISS» es incompleta. En España abunda **LoRa APRS** (433,775 MHz, ESP32).
   - Mantener `encryptionAllowed: false`, con fuentes: NL, *Regeling … met meldingsplicht 2015*, art. 10; ES, Orden IET/1311/2013 (pendiente de cita literal del BOE).
7. **Cabecera del archivo**
   - Añadir que el SOS por satélite de Apple/Pixel y el 112 **no son portadores de datos**: solo sirven para emergencias reales.
   - Añadir que las redes Find My, Sidewalk y Wi‑Fi ajenas quedan **excluidas** por términos de servicio y riesgo legal (§5).

### `packages/senda/src/satellites.mjs`
1. **`STARLINK_D2C.europe`**
   - Añadir España: piloto MasOrange en Valladolid (feb. 2026), autorizado por la SETID, sin fecha comercial a 2026‑11.
   - Añadir NL: sin acuerdo conocido.
   - Corregir «Deutsche Telekom anuncia Europa para 2028»: son **10 países**, nombrados DE, AT, PL, CZ y HU, con Starlink Mobile V2. NL no está incluido, porque Telekom ya no opera allí.
   - Anotar el cambio de nombre a «Starlink Mobile».
2. **`SKYLO_NTN.europe`**
   - Corregir «SMS de Orange para Pixel anunciado (empresas en 2026)»: el servicio a **consumidores está en marcha en Francia desde el 11‑12‑2025** (Pixel 9/10 salvo 9a, planes 5G; gratis hasta junio de 2026); el de **empresas llega en 2026**.
   - Añadir que el SOS de Pixel incluye ES y NL. En Samsung depende del operador, sin operador europeo encontrado.
3. **`IRIDIUM_SBD.cost`**
   - Sustituir el texto por: «1 crédito por cada 50 B o fracción (Ground Control). Paquetes de £0,077–0,16 por crédito. Cuota de línea £13/mes (página sin fecha).»
   - Añadir la entrega RockBLOCK→RockBLOCK con el prefijo `RB`.
4. **Añadir entradas**
   - `APPLE_SOS_SATELLITE` (`access: 'PUBLIC_PHONE'`, `status: 'OPERATIONAL'`, ES desde sept. 2023 y NL desde mar. 2023; solo emergencias y aviso a contactos; Mensajes vía satélite NO disponible en ES/NL).
   - `IRIDIUM_MESSENGER` (inReach/ZOLEO).
   - `SATELIOT` (`status: 'ROLLING_OUT'`, solo IoT, 11 satélites en oct. 2026, servicio general no confirmado).
5. **Estado a revisar:** Motorola Defy Satellite Link / Bullitt (administración en feb. 2024; servicio sin confirmar). Si se añade, que sea con `status` dudoso, o no añadirlo.

---

## 8. Pendiente de verificar (cuando el entorno permita descargar las páginas oficiales)
- Recuento exacto de pasarelas TTN en NL y ES (`thethingsnetwork.org/gateway-data/country/{nl,es}`).
- Lista viva de países del Satellite SOS de Pixel y de Mensajes vía satélite de Apple (`support.apple.com/105097`, `support.google.com/pixelphone/answer/15254448`).
- Texto literal de la Orden IET/1311/2013 (BOE) sobre el cifrado, y art. 9 de la regeling neerlandesa.
- Precios actuales en € de Garmin inReach y ZOLEO en ES/NL; precio en 2026 de los créditos RockBLOCK.
- Lista de los «36 países» de Orange Message Satellite (¿incluye ES/NL en itinerancia?).

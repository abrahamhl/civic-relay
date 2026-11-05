# SENDA · Sensores y canales del teléfono: qué usar, cómo y con qué estado

> **Entrada → Procesamiento → Validación → Salida**, listo para que cualquier agente lo retome.
> Fecha: 2026-11-04 · Rama `ccr-357397d4-i6q247` · Autor: Claude (Asistente de Orquestación), por encargo del fundador.

## 1. Entrada (la petición)

«Que la aplicación sea literalmente un canal de comunicación: que se pueda **llamar**, comunicar en general,
usar los sensores de Android (acelerómetro, GPS y cambios de velocidad, Bluetooth, radiofrecuencia,
infrarrojos, chips) y los de los **drones** para mapear la superficie y estimar por radiofrecuencia
**cuántas personas hay en un edificio**. Céntrate en la **arquitectura** del sistema, visual y funcional,
y crea tecnología nueva.»

## 2. Procesamiento: hallazgos con fuente

| Tema | Hallazgo | Fuente | Fiabilidad |
|---|---|---|---|
| Acelerómetros como red sísmica | Android Earthquake Alerts detectó de media 312 sismos al mes en 3 años y avisó en 98 países; alertas de pocos a 20 s antes del temblor fuerte; peor en zonas rurales con pocos teléfonos | Allen et al., *Science* (17-07-2025), [PDF](https://rallen.berkeley.edu/pub/2025AllenBarski/AllenEtAl-AndroidEarthquakeAlerts-Science-2025.pdf); [Google Research](https://research.google/blog/android-earthquake-alerts-a-global-system-for-early-warning/) | Alta (artículo revisado) |
| Muestreo de sensores | Desde Android 12, acelerómetro, giroscopio y magnetómetro limitados a 200 Hz salvo permiso `HIGH_SAMPLING_RATE_SENSORS` (nivel normal, se concede al instalar) | [AOSP](https://android.googlesource.com/platform/frameworks/native/+/af91a91c5c) | Alta (código fuente) |
| Teléfono a teléfono sin router | Wi-Fi Aware (NAN): Android 8.0+, descubrimiento y conexión directa sin punto de acceso; `NEARBY_WIFI_DEVICES` en Android 13+; depende del hardware (`isAvailable()`) | [Android Developers](https://developer.android.com/develop/connectivity/wifi/wifi-aware) | Alta |
| Llamadas en red local sin Internet | WebRTC conecta por candidatos «host» dentro de la LAN; el obstáculo es la señalización (intercambio de SDP) | Medición propia (abajo) | Alta (reproducible) |
| Leer códigos con la cámara | `BarcodeDetector` en Chrome Android (requiere Google Play Services); comprobar `getSupportedFormats()` | [Chrome Developers](https://developer.chrome.com/docs/capabilities/shape-detection) | Alta |
| Distancia Wi-Fi | Wi-Fi RTT (802.11mc/az): 2–8 m al percentil 90 según ancho de banda | [AOSP Wi-Fi RTT](https://source.android.com/docs/core/connect/wifi-rtt) | Alta |
| Contar personas con direcciones aleatorias | Campo activo de investigación | arXiv:2112.02161, arXiv:2507.03873 | Media (preprints; no revisados aquí en detalle) |
| Infrarrojos | Solo algunos modelos tienen emisor IR (`ConsumerIrManager`) y casi ninguno receptor: **no sirve como canal entre teléfonos** | API pública de Android | Alta; descartado |

## 3. Decisiones de arquitectura (y por qué)

1. **Llamadas**: WebRTC + **señalización compacta** (`packages/senda/src/sdp-compact.mjs`). Ambos extremos usan
   la misma plantilla (Opus + canal de datos); solo viaja lo variable: usuario/clave ICE, huella SHA-256 DTLS,
   rol y hasta 4 candidatos UDP host (IPv4 o mDNS). Resultado: 79–103 bytes de oferta, 72–84 de respuesta.
   El código se transmite por el **módem acústico** existente (8–10 s) o como texto.
2. **Censo radio por planta** (`packages/senda/src/rf-census.mjs`): concurrencia máxima de direcciones por
   familia de dispositivo (cota inferior exacta de teléfonos) + asignación de planta por RSSI mediano +
   **inferencia bayesiana exacta** personas|teléfonos (mezcla 0/1/2 teléfonos por persona; hipótesis 12 %/8 %,
   **pendiente de calibrar**). Solo salen recuentos.
3. **Arquitectura visible** (`/senda/arquitectura`): 5 capas, 35 piezas con estado honesto
   (navegador / simulación / app Android / app nativa / hoja de ruta) y 6 escenarios animados.

## 4. Validación (medida con el código real)

| Prueba | Resultado |
|---|---|
| Llamada entre dos contextos Chromium, oferta por onda acústica real | Conectada; oferta 79 B (IPv4) / 103 B (mDNS); 7,8–9,8 s de tonos decodificados sin error; voz Opus > 450 paquetes; chat en ambos sentidos; **0 peticiones de red** durante la llamada |
| Llamada de prueba en un solo dispositivo sin micrófono | Conectada en ~4 s (incluye modular/demodular ambos códigos), mensaje y audio recibidos |
| Censo: teléfonos exactos por planta | 719 de 720 plantas (rotación 5/10/15 min, 40 semillas) |
| Censo: intervalo del 90 % contiene la verdad | 95,3 % (686/720), calibración ligeramente conservadora |
| Planta sin teléfonos | Mediana 0, cota 1 (P(vacía) = 0,88): «0, quizá 1», nunca se descarta |
| Pruebas unitarias | `sdp-compact.test.mjs` (4) y `rf-census.test.mjs` (8) en verde |
| E2E Chromium | Nuevas comprobaciones de llamada, demo, dron y arquitectura en `senda-offline-e2e.mjs` |

**Límite honesto de la E2E**: la emulación «offline» de Chromium (`context.setOffline`) también bloquea WebRTC
local, así que la llamada se prueba con contextos sin ningún servidor (sin STUN/TURN ni señalización) y
verificando cero peticiones de red, que es la propiedad que importa. Falta prueba con dos teléfonos físicos.

## 5. Salida y siguientes pasos (para el fundador decidir)

| # | Paso | Coste | Decisión |
|---|---|---|---|
| 1 | Ensayo con dos teléfonos físicos en el punto de acceso de un tercero (y con aislamiento de clientes activado) | Bajo | Pendiente |
| 2 | Código de llamada también como **QR** (`BarcodeDetector`) para entornos ruidosos o personas sordas | Bajo | Propuesto |
| 3 | App Android: Wi-Fi Aware/Direct para llamar **sin ninguna red** | Medio | Propuesto |
| 4 | Ensayo de campo del censo con escáner real y ocupación conocida; calibrar la mezcla 0/1/2 teléfonos | Medio | Requiere socio (bomberos/universidad) |
| 5 | Búsqueda formal de anterioridad/patentes de las dos piezas nuevas | Medio | Decisión del fundador (estrategia de propiedad intelectual) |
| 6 | Validación jurídica del censo (RGPD, EIPD, base de interés vital) y de vuelos (AESA) | Medio | Imprescindible antes de piloto |

Nota de confianza: **85 %**. Las cifras de Android/Chrome/AOSP están verificadas en fuente primaria; las de SENDA
son medidas propias reproducibles; los dos preprints de conteo con direcciones aleatorias se citan por
identificador sin haber revisado su contenido completo.

## 6. v0.11 · Malla de voz y despliegue físico (añadido el mismo día)

**Entrada:** arquitectura nueva, real y llevable al plano físico.

**Procesamiento (`packages/senda/src/voice-mesh.mjs`):**
- Si dos personas no se alcanzan por la red local, los teléfonos intermedios **reenvían la voz y el chat**. WebRTC permite reenviar una pista recibida por otra conexión.
- Se elige un **árbol** que minimiza los saltos máximos. Quien tiene menos del 20 % de batería participa pero **nunca repite**.
- **Turno de palabra** (como el walkie-talkie profesional): con una sola persona hablando, cada enlace lleva **1 flujo** sea cual sea el tamaño de la sala. Sin turno, lleva tantos flujos como personas hablando a la vez.
- **Replanificación por batería:** si un repetidor se apaga, el plan dice quién queda aislado (para enviar una mula, un dron con punto de acceso o una pasarela LoRa).

**Validación:**
- 5 pruebas unitarias.
- Prueba real en Chromium: cadena A → B → C con cuatro conexiones WebRTC, señalización compacta y **C oyendo el tono de 440 Hz de A a 441 Hz medidos** a través de B, más el chat reenviado.
- Incluida en la E2E.

**Límite honesto:** DTLS-SRTP cifra **salto a salto**, así que quien repite oye la voz (como en una conferencia). El texto sí puede ir cifrado de extremo a extremo con el sobre SENDA. El alcance real de un punto de acceso por planta está **pendiente de medir** con teléfonos físicos.

**Despliegue físico:** la tabla «Del plano al mundo físico» de `/senda/arquitectura` resume, pieza a pieza, qué existe hoy y qué falta:
- **Ya existen:** la app web sin red, la app Android (baliza y barrido), el accesorio ESP32 (misma trama que la web y Android) y el relé en Docker.
- **Faltan:** el prototipo LoRa, la integración con el dron y los ensayos de campo.

## 7. v0.13 · «Batería de Internet»: qué hacer cuando no hay ninguna red (2026-11-05)

**Entrada del fundador:** que los móviles que ya tienen SENDA guarden algo como una batería, pero de Internet (~1 GB), y lo usen como si fuera la red; además, gateways y puntos de rebote.

**Verdad técnica:** no se puede «almacenar Internet» para navegar por contenido nuevo sin red. Sí se puede:
1. guardar la parte que se va a necesitar;
2. repartir entre vecinos lo que no cabe en un móvil;
3. encolar lo nuevo para la primera ventana;
4. saber adónde ir para que haya ventana.

Son cuatro piezas de ingeniería real:

| Pieza | Base matemática | Evidencia | Estado |
|---|---|---|---|
| **Reserva de red** (`net-reserve.mjs`) | Mochila 0/1 exacta por valor (utilidad × riesgo) y frescura con semivida 2^(−edad/semivida); recarga por densidad de valor en ventanas cortas; cola de intenciones por prioridad | 1 GB cubre el 95,7 % del valor en zona de riada; lo esencial cabe en 200 MB; en 30 s a 2 Mbit/s se refresca primero lo urgente | Algoritmo y página hechos; llenado real de la app en el almacenamiento del navegador |
| **Almacenamiento del dispositivo** | API StorageManager: `estimate()` y `persist()` | Chromium permite hasta ~60 % del disco por web; iOS 17+ ~20 % por web, ~60 % si está instalada en la pantalla de inicio (MDN) | Real en `/senda/reserva` |
| **Biblioteca de vecinos** (`swarm-cache.mjs`) | Reed-Solomon k-de-n; P = Σ C(n,i)pⁱ(1−p)ⁿ⁻ⁱ; filtro de Bloom m = −n ln p/(ln 2)²; piezas nombradas por SHA-256 | 6 GB entre 40 vecinos al alcance al 50 %: 462 MB por móvil con 99,2 % de recuperación; ida y vuelta real byte a byte | Algoritmo hecho; transporte local (Wi-Fi o Bluetooth) pendiente en la app nativa |
| **Puntos de rebote** (`coverage-memory.mjs`) | Huellas de cobertura agrupadas por antena, supervivencia de Weibull sin luz y función de senderismo de Tobler; E[T] = t_andar + (1−P)·t_alternativa | En el escenario: cerro con antena de grupo electrógeno al 98 %, 38 min frente a 63 min esperando al satélite | Algoritmo hecho; falta recoger huellas reales (app nativa, con consentimiento) |
| **Recarga por difusión** | Una vía; capacidad = kbit/s × tiempo | Toosheh reparte paquetes de hasta 8 GB al día por satélite de TV doméstico | Requiere convenio con un emisor |

**Fuentes:**
- [MDN, cuotas de almacenamiento](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [web.dev, caso Kiwix](https://web.dev/case-studies/kiwix)
- [Toosheh (Wikipedia)](https://www.wikipedia.org/wiki/Toosheh)
- [OpenCellID (Wikipedia)](https://www.wikipedia.org/wiki/OpenCellID), licencia CC BY-SA 4.0
- Tamaños de la Wikipedia en español sin conexión: ~37 GB con imágenes y ~9 GB sin ellas, según guías de terceros (pendiente de verificar en download.kiwix.org).

**Corrección registrada:** la primera versión sumaba como independientes las huellas de una misma antena y daba un 99,9 % irreal. Ahora se agrupan por antena: si muere, fallan todas.

## 8. v0.14 · Carretera: «ruta protectora» (2026-11-05)

**Pregunta del fundador:** que SENDA acompañe en los viajes. Que se integre con Waze y Google Maps, avise de frenadas del coche de delante, pida ayuda sin cobertura y deje coordinar un accidente con puntos cívicos.

**Qué es real hoy y qué no:**

| Idea | Realidad verificada | Qué hace SENDA |
|---|---|---|
| Sincronizar con Waze | Waze ofrece enlaces profundos (`waze.com/ul?ll=…&navigate=yes`) y un feed de **entrada** para socios (CIFS, XML o JSON). El programa Waze for Cities es para organismos públicos. No hay API pública para leer la ruta ni las alertas | Abre la ruta en Waze o Google Maps (PASIVO). Envía avisos confirmados por un socio público (CONVENIO). Leerlos queda en NUNCA |
| Mapas sin conexión | Waze no tiene mapas descargables. Google Maps descarga **rectángulos**; sin red no hay tráfico ni rutas alternativas, y caducan (fuentes secundarias: hasta 1 año) | Pasillo de la ruta. Madrid–Valencia con 2 km a cada lado: 62 MB frente a 951 MB del rectángulo |
| Avisos a todos los navegadores | Desde el 1-1-2026 la V16 conectada es obligatoria. **DGT 3.0 ya envía a los navegadores** la ubicación de los vehículos averiados | Convenio con DGT 3.0: un solo canal llega a todos los navegadores |
| Incidencias oficiales | NAP de la DGT: incidencias en DATEX II v3.6/v3.7 (la v1.0 queda obsoleta en 2026) | Se guardan en la reserva antes de salir (PASIVO) |
| Llamada automática | eCall es obligatorio en tipos homologados desde el 31-3-2018: llamada al 112 con un mensaje mínimo de 140 bytes. La edad media del parque es de 14,6 años (ANFAC 2025) | Complemento para coches sin eCall. Además hace lo que eCall no hace: avisar a los de detrás y coordinar la escena |
| Detección de choque en el móvil | Google Pixel lo hace con movimiento, ubicación y sonido; existe en España. Puede fallar y dar falsas alarmas | Mismo principio con umbrales abiertos y cuenta atrás. Umbrales pendientes de calibrar |
| Aviso de frenada | El estándar europeo C-ITS incluye la luz de freno electrónica de emergencia (EEBL, mensajes DENM), pero requiere equipos en el coche | Versión de bolsillo por Bluetooth LE con trama de 24 bytes. El valor está en los coches que no ves; mejor empezar por flotas |
| Coordinar el accidente | Conducta **PAS** de la DGT (Proteger, Avisar, Socorrer). El art. 195 del Código Penal castiga la omisión del deber de socorro | Coordinador ciudadano con PAS, traspaso a credencial verificada y puntos cívicos en un libro encadenado por huellas |

**Bases matemáticas:**
- Deceleración necesaria: a = v²/2(d − v·t_r − margen).
- Ganancia frente a la cadena de luces: N·t_r − (saltos·latencia + t_alerta).
- Contacto al cruzarse: P = 1 − (1 − p_rx)^(2R/v_rel/Δt).
- Entrega por coches que pasan, con llegadas de Poisson: E[T] = 60/(q·s·P) + t_viaje.
- Creencia en un aviso: log-odds con pesos de frescura.
- Huellas encadenadas con SHA-256.

**Fuentes:**
- [DGT, balance 2025 (1.119 fallecidos)](https://www.dgt.es/comunicacion/notas-de-prensa/20260108-2025-finaliza-1119-fallecidos-en-siniestros-de-trafico-en-vias-interurbanas)
- [DGT, cierre 2024 (1.154; 72 % en vías convencionales)](https://www.dgt.es/export/sites/web-DGT/.galleries/downloads/dgt-en-cifras/24h/Informe-Siniestralidad_Cierre-2024_v10_FINAL.pdf)
- [Interior: DGT 3.0 envía a los navegadores las V16](https://www.interior.gob.es/opencms/es/detalle/articulo/DGT-3.0-ya-envia-a-los-navegadores-la-ubicacion-de-los-vehiculos-averiados-en-carretera-que-utilizan-la-V-16-conectada/)
- [NAP DGT, DATEX II v3.7](https://nap.dgt.es/en/dataset/incidencias-dgt-datex2-v3-7)
- [Waze, enlaces profundos](https://developers.google.com/waze/api)
- [Waze, feed de socios (CIFS)](https://developers.google.com/waze/data-feed/overview)
- [Waze for Cities](https://support.google.com/waze/partners/answer/10618477)
- [eCall (km77)](https://www.km77.com/glosario/ecall) y Reglamento (UE) 2015/758
- [ANFAC, 14,6 años](https://www.autofacil.es/alerta-en-seguridad-y-emisiones-la-edad-media-del-coche-espanol-ya-roza-los-15-anos/)
- [Detección de choques de Pixel](https://9to5google.com/2023/10/31/google-pixel-car-crash-detection-new-countries/)
- [C-ITS en Europa (arXiv)](https://arxiv.org/pdf/1609.03876)
- [DGT, manual de primeros auxilios (PAS)](https://sede.dgt.gob.es/export/sites/dgt/.galleries/permisos-de-conducir/certificacion-aptitud-profesores-formacion-vial/2026/MANUAL-IX-Primeros-auxilios.pdf)
- [RACE, omisión del deber de socorro](https://www.race.es/no-ayudar-victimas-accidente-trafico-delito-multa)
- [Bluetooth LE, tamaño de anuncio](https://novelbits.io/maximum-data-bluetooth-advertising-packet-ble/)

**Pendiente de verificar:**
- Si el NAP publica también las V16.
- La cobertura de los PK de la red estatal en datos abiertos (IGN/CNIG).
- Los campos exactos de CIFS.
- Las categorías de apps permitidas en Android Auto y CarPlay.
- El alcance real de Bluetooth entre coches.

## 9. v0.15 · V16, situaciones al volante, cámaras y Países Bajos (2026-11-05)

| Tema | Verificado | Implicación para SENDA |
|---|---|---|
| V16 conectada | Envía a su fabricante: identificador, celda, cobertura, batería y posición. El fabricante pasa a DGT 3.0 un conjunto reducido («protocolo B»). La DGT lo pasa a los navegadores. Frecuencia de 100 s y SIM integrada según fabricantes | La V16 dice **dónde**; SENDA dice **qué pasa**. Fusión por posición y tiempo; nunca usar su SIM |
| Cámaras DGT | NAP: ubicaciones en DATEX II v3.6. El conjunto antiguo con imagen en tiempo real queda obsoleto el 12-01-2026 | Lista de cámaras de la ruta en la reserva; imágenes desde el relé |
| Cámaras en otras administraciones | Open Data Euskadi: URL de imagen y localización, CC BY 4.0 (catálogo). Generalitat: XML, reutilización citando fuente (por verificar). Madrid Informo: ~270 cámaras, licencia de imagen no confirmada | PASIVO donde hay licencia; convenio en el resto |
| Cámaras en Países Bajos | Rijkswaterstaat solo las ve en su central; no graba ni publica (RGPD) | Solo convenio para emergencias |
| NDW | Incidencias cada minuto (incidents.xml.gz), ~17.000 señales de carril, más de 300 puentes, obras (Melvin). Todo en DATEX II; abiertos «en principio» | Lector DATEX II común; condiciones exactas pendientes |
| Rood kruis | Carril cerrado; nunca está puesto «por nada»; multa de al menos 260 € | Aviso hablado en neerlandés |
| UE | Reglamento Delegado 2022/670: Punto de Acceso Nacional en cada Estado y DATEX II como referencia | Un lector para todos los países |
| Sentido contrario | ~130 accidentes al año (prensa, datos antiguos). El RACC ya tuvo una app que avisaba | Detección en el propio móvil; antecedente que valida la idea |
| Agua en la calzada | NWS: 15 cm, pérdida de control; 30 cm en movimiento, arrastra la mayoría de coches; 60 cm, todoterrenos | Aviso «da la vuelta» |
| «Ojo de Dios» | Nombre usado por agregadores de datos personales y localización de dispositivos | NUNCA |

**Fuentes:**
- [Banda Ancha: qué datos envía la V16](https://bandaancha.eu/articulos/que-datos-envian-dgt-nuevas-balizas-10464)
- [NAP DGT: cámaras](https://nap.dgt.es/en/dataset/camaras-dgt-datex2-v3-6-nuevo)
- [Open Data Euskadi](https://datos.gob.es/es/iniciativas/open-data-euskadi)
- [Madrid Informo](https://diario.madrid.es/blog/notas-de-prensa/arranca-la-renovada-web-de-informacion-del-trafico/)
- [Rijkswaterstaat: imágenes de cámaras](https://www.rijkswaterstaat.nl/wegen/wegbeheer/onderzoek/verkeersonderzoek/wat-doet-rijkswaterstaat-met-camerabeelden)
- [NDW: nuestros datos](https://english.ndw.nu/our-data)
- [NDW: incidencias](https://docs.ndw.nu/en/faq/incidenten/)
- [Rijkswaterstaat: nietvoorniX](https://www.rijkswaterstaat.nl/wegen/wegbeheer/nietvoornix)
- [Reglamento Delegado (UE) 2022/670](https://eur-lex.europa.eu/eli/reg_del/2022/670/oj/eng)
- [Pyronear](https://github.com/pyronear/PyroNear)
- [RACC Infotransit](https://www.motorpasion.com/seguridad/racc-infotransit-app-que-detecta-kamikazes-10-segundos-avisa-peligro-al-resto-conductores)
- [NWS: Turn Around, Don't Drown](https://weather.gov/shv/awarenessweek_flood_tadd)
- He, Sun y Tang (2009), *Dark Channel Prior*
- Ley de Koschmieder

**Bloqueo del entorno:** `nap.dgt.es`, `opendata.ndw.nu`, `docs.ndw.nu` y `english.ndw.nu` están denegados por la política de red de esta sesión. Para probar con datos reales hay que añadirlos a los dominios permitidos o ejecutar `scripts/datex-pack.mjs` en otra máquina.

## 10. v0.16 · ¿Son pasarelas los radares y los equipos de la DGT? (2026-11-05)

| Equipo | Qué emite o con quién habla | ¿Pasarela para SENDA? | Qué sí se suma |
|---|---|---|---|
| Radar fijo | Microondas o láser; envía las denuncias a la DGT por su canal | No | Ubicación publicada por la DGT (vía, PK, sentido) |
| Radar de tramo | Dos pórticos y velocidad media | No | Tramos publicados; media propia sin sugerir superar el límite |
| Radares móviles, Pegasus y drones | Sin ubicación publicada | No | Nada: SENDA no publica controles (decisión de diseño) |
| Paneles | Texto en la vía; estado en DATEX II v3.6 | No | Leer el texto y convertirlo en aviso; escribir en ellos solo con convenio |
| Aforos | Caudal y velocidad hacia el centro de gestión | No | Cola y onda de choque (España: disponibilidad pendiente; NDW sí publica) |
| V16 | Posición a DGT 3.0 por la red móvil | No | Fusión V16 + SENDA por convenio |
| Postes SOS | Línea propia | No | El más cercano, si existe un listado |
| DGT 3.0 | Plataforma de datos | **Sí, por convenio** | El canal oficial |

**Legalidad de los radares:**
- Detectores prohibidos desde 2014: multa (200 o 500 € según la fuente) y 3 puntos.
- Inhibidores: hasta 6.000 € y 6 puntos.
- Avisadores de ubicaciones publicadas: lícitos.

**Fuentes:**
- [Motorpasión: la DGT y los avisadores](https://www.motorpasion.com/seguridad/dgt-recuerda-que-puedes-usar-avisador-radares-cambio-detectores-e-inhibidores-conllevan-cuantiosa-multa)
- [Motor16: inhibidores](https://www.motor16.com/noticias/dgt-6-000-euros-6-puntos-multa/)
- [Motor16: ubicación de los radares fijos](https://www.motor16.com/noticias/donde-estan-radares-fijos-dgt/)
- [Highmotor: retirada de postes SOS](https://www.highmotor.com/dgt-retirara-gran-parte-postes-sos-carreteras-espanolas.html)
- [NAP DGT: paneles](https://nap.dgt.es/en/dataset/paneles-dgt-tiempo-real-datex2-v3-6)


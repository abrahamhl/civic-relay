# SENDA — Sistema de Enrutamiento de Emergencia por canales alternativos

**Identificador:** `SENDA-VM-2026-11-04` · **Sustituye el enfoque de** `CR-VM-2026-10-25` (Civic Relay / OEP) · **Promotor:** Abraham Haddioui
**Código:** [`packages/senda/`](../../packages/senda) · **Evidencia:** [`evidence/senda/scenarios.json`](../../evidence/senda/scenarios.json)

> *Si existe un camino hasta tu gente, SENDA lo encuentra.*

## 1. La idea del fundador (corrección del 04-11-2026)

1. **No es «otro WhatsApp con un gateway».** Si Abraham escribe desde Arnhem a su hermano en San Martín de Valdeiglesias y allí ha caído la antena, WhatsApp entregará cuando el teléfono del hermano recupere SU conexión. Un gateway que retiene el mensaje no aporta nada. SENDA debe **llegar antes que WhatsApp** usando **cualquier** camino real que exista en ese momento.
2. **Todos los canales a la vez:** teléfonos vecinos con la app (Bluetooth, Wi-Fi Direct/Aware), alguien con Internet por satélite o de otro operador, SMS que todavía entran, satélites directos al móvil cuando pasan sobre la zona, accesorios LoRa, gateways y estaciones terrestres.
3. **Zonas de emergencia:** cuando una autoridad emite una alerta (EU-Alert/ES-Alert/NL-Alert, CAP), o cuando sismógrafos públicos y los acelerómetros de los teléfonos detectan un evento, la zona se declara y los teléfonos con SENDA **pasan a modo relé automáticamente**, porque el usuario lo **preautorizó al instalar** y aceptar los términos.
4. **Alerta secundaria:** SENDA redistribuye y complementa el sistema de alertas europeo por la malla de teléfonos (sin suplantar al emisor oficial) y añade predicción propia por sensores.
5. **Enrutador que decide:** «¿hay Bluetooth? conecta y envía; ¿no? prueba otra cosa; ¿pasa un satélite que da más conectividad? úsalo».
6. **Escombros:** si alguien está atrapado sin cobertura y alguien encima sí tiene, el teléfono de arriba hace de **puente** (como un repetidor) por Bluetooth.
7. **Coordinación:** cualquiera puede ofrecerse como coordinador; familias registran a quién buscan; documentos por canal seguro; **canales internos** para policía, bomberos, protección civil y sanidad.
8. **Ver a través de muros para rescatar:** usar el teléfono (cámara incluida) y señales radio para localizar víctimas detrás de paredes o escombros.
9. **Aprovechar proyectos abiertos existentes** (satélites meteorológicos, seguimiento orbital, gateways, sismología) en vez de reinventarlos.

## 2. Cómo lo resuelve el código (implementado y probado)

| Idea | Módulo | Qué hace | Estado |
| --- | --- | --- | --- |
| Llegar antes que WhatsApp | `router.mjs` | **Contact Graph Routing** (técnica de redes tolerantes a retardos de NASA/CCSDS): calcula la llegada más temprana por cualquier cadena de contactos en el tiempo y lanza **varias rutas en paralelo** (carrera multicanal). Compara con la línea base WhatsApp. | Algoritmo implementado + tests |
| Todos los canales | `channels.mjs` | BLE, Wi-Fi Direct/Aware, hotspot, LoRa, datos, SMS, satélite directo al móvil, Internet satelital, troncal; con alcance, caudal, energía, tamaño máximo y si el SO exige un toque. | Implementado |
| Decidir qué probar | `ladder.mjs` | Escalera de intentos ordenada por llegada esperada: envía ya, escanea, espera ventana de satélite o pide un toque para encender una radio. Si falla, baja al siguiente escalón. | Implementado + tests |
| Zona y relé preautorizado | `zones.mjs` | Ingesta CAP con verificación de emisor, zonas por catálogo sísmico, perfil de consentimiento de instalación, activación OFF/STANDBY/RELAY_ACTIVE con límites de batería/datos. | Implementado + tests |
| Predicción sísmica | `seismic.mjs` | STA/LTA en cada teléfono, localización de epicentro por la red (≥4 teléfonos), segundos hasta la onda S en cada ciudad. Una sola fuente no oficial no activa: hace falta corroboración. | Implementado + tests (datos sintéticos) |
| Fuentes abiertas | `feeds.mjs` | USGS, EMSC, CAP/Meteoalarm, CelesTrak (TLE de satélites meteorológicos, Starlink, Iridium), SatNOGS (red abierta de estaciones terrestres). | Parsers + tests con formato real; conexión en vivo pendiente de despliegue |
| Satélites | `orbital.mjs` | Propagador Kepler + J2 sin dependencias, ventanas de paso, conversión a contactos del enrutador solo si el servicio es compatible. Enchufable a SGP4 (satellite.js). | Implementado + tests |
| Cifrado y relés ciegos | `envelope.mjs` | E2E con WebCrypto (ECDH P-256 + AES-GCM + firma ECDSA). Los relés solo ven la cabecera. Deduplicación en el receptor. | Implementado + tests |
| Coordinación e instituciones | `roles.mjs` | Credenciales firmadas por cada organismo (ancla de confianza), revocación, matriz de permisos, registro de familias con minimización, canales internos e interagencia. | Implementado + tests |
| Puente bajo escombros | `rubble.mjs` + `router.mjs` | Elige el mejor teléfono de superficie como puente y enruta el mensaje de la víctima. | Implementado + tests |
| «Ver» a la víctima | `rubble.mjs` | Trilateración BLE (RSSI) mientras el rescatador camina + **proyección en la cámara (realidad aumentada)** con su incertidumbre. | Implementado + tests (RSSI sintético) |
| A través de muros | `through-wall.mjs` | Análisis **Wi-Fi CSI**: movimiento y **respiración (rpm)** tras paredes con accesorio ESP32 (ESP32-CSI-Tool) o Nexmon CSI. | Implementado + tests (CSI sintético); requiere calibración de campo |

Resultado de los escenarios (`pnpm --filter @senda/core evidence`):
- **S01 Arnhem → San Martín** (antena caída 8 h, vecina con Internet satelital, vecino con Bluetooth): **SENDA ≈ 4 min**, satélite directo al móvil ≈ 91 min como ruta paralela, **WhatsApp 480 min**. Sin vecinos ni satélite compatible, SENDA no inventa: entrega a la vez que WhatsApp.
- **S04 sismo:** epicentro con error ≈ 0,5 km a partir de 14 teléfonos; el relé solo se activa al corroborarlo un catálogo público.
- **S05 escombros:** posición de la víctima con error horizontal < 1 m (RSSI sintético), puente elegido automáticamente, mensaje a la familia; CSI detecta 14 rpm con persona y nada en sala vacía.
- **S07 coordinación:** bombero verificado actualiza a «localizado a salvo»; la familia lo recibe; el voluntario no puede cambiar estados; canales internos aislados por organismo.


## 2 bis. Offline-first verificado (v0.2 · 04-11-2026)

| Capacidad | Módulo | Verificación |
| --- | --- | --- |
| **App instalable que abre sin red** (service worker + IndexedDB) | `investor-next/public/senda/` → `/senda/` | Chromium real, 3 teléfonos con la red cortada (`investor-next/scripts/senda-offline-e2e.mjs`) |
| **Datos por sonido** (MFSK-16, Hamming(7,4) + entrelazado, CRC-32, sincronización por preámbulo) | `acoustic-modem.mjs` | Ida y vuelta con eco de sala, ruido 10 dB, zumbido de red, 48→44,1 kHz; nunca entrega basura |
| **Almacenar-transportar-reenviar** (anti-entropía, spray-and-wait, cuotas por prioridad) | `bundle.mjs` | Ciudad de 40 teléfonos sin red que entregan solo por encuentros |
| **Recibos infalsificables** que purgan copias en toda la red | `envelope.mjs` + `bundle.mjs` | Recibo falso ignorado; recibo real borra la copia de la «mula» |
| **Sobre binario compacto** (~300 B + texto) para sonido / SMS / QR | `envelope.mjs` | Ida y vuelta exacta; un mensaje viaja en ~31 s de audio |
| **Paridad app ↔ núcleo probado** | `tests/web-parity.test.mjs` | La app usa byte a byte el núcleo probado y el SW precarga todo |

Panel público regenerado desde las pruebas: [`/senda/estado.html`](../../investor-next/public/senda/estado.html). CI dedicado: `.github/workflows/senda-ci.yml`.

## 4 bis. God's Eye View (bilawalsidhu/gods-eye-view, MIT)

Repositorio identificado: **`bilawalsidhu/gods-eye-view`** (Bilawal Sidhu, ex-Google), globo 3D de inteligencia espacial con fuentes públicas en tiempo real. Su **código es MIT** (reutilizable con atribución); **sus datos no**: el mapa de cables submarinos de TeleGeography (CC BY-NC-SA), las imágenes de Vantor (CC BY-NC) y las APIs de Google Maps y OpenSky restringen el uso comercial. Encaje con SENDA: God's Eye View aporta la **visión de situación** (aviones, barcos, satélites, sismos, incendios) para centros de coordinación; SENDA aporta la **última milla de comunicación sin red**. SENDA ya consume las mismas fuentes abiertas que esa herramienta (USGS, CelesTrak). La integración visual en la consola de coordinación es el siguiente paso, usando solo capas con licencia compatible.


## 2 ter. Módulo de incidente ferroviario (v0.3 · 04-11-2026)

**Por qué:** según la cronología publicada del accidente de **Adamuz (Córdoba, 18-01-2026)**, la primera llamada al 112 llegó en torno a 1 minuto después, pero los servicios de emergencia tardaron **≈45 minutos** en saber que había un **segundo tren** (Alvia) descarrilado, porque la información inicial solo llevaba las coordenadas del primero. La asociación de víctimas denunció después fallos de coordinación y comunicación entre servicios. (Fuente: artículo «Accidente ferroviario de Adamuz» y prensa; cifras a contrastar con la investigación oficial. El 28-10-2026 se produjo además el choque de Urda, Toledo.)

| Pieza | Módulo | Qué aporta | Verificación |
| --- | --- | --- | --- |
| Detección en cada teléfono | `rail-incident.mjs#detectCrash` | Velocidad previa + impacto + parada brusca y/o vuelco; descarta caída del móvil, frenada y baches | Tests de falsos positivos y E2E en Chromium |
| «¿Estás bien?» con cuenta atrás | `crashResponsePolicy` + app | 20–30 s; si no responde, informa «sin respuesta» (dato clave para rescate) | E2E: aviso automático sin red |
| Fusión de cientos de informes | `fuseIncidentReports` | Nº de trenes/emplazamientos, coches prioritarios, atrapados, sin respuesta; texto para el 112 | Tests + panel en vivo `/senda/incidente` |
| Escenario dos trenes | `rail-scenario.mjs` | Segundo tren identificado en **30–41 s** (8 semillas), también con 5 % de adopción | Tests + página de verificación |

SENDA **no sustituye al 112** ni a AML (que ya envía la posición de quien llama): aporta la **imagen agregada** de los teléfonos de los pasajeros, que hoy no existe.


## 2 quater. Gemelo digital de edificios afectados (v0.4 · 04-11-2026)

| Capacidad | Módulo | Verificación |
| --- | --- | --- |
| Recuento de la zona (vista dron) por grado de daño **EMS-98** con foto adjunta | `building-twin.mjs#damageSummary` | Tests |
| Huellas reales de **OpenStreetMap** (Overpass, `building:levels`/`height`) — Catastro INSPIRE como siguiente fuente | `buildingsFromOverpass`, `overpassQuery` | Tests + botón en `/senda/edificios` |
| Edificio en 3D rotable por plantas y viviendas | `/senda/edificios` (three.js) | E2E sin red |
| **Routers localizados por su señal** (barrido a pie o con dron por la fachada), apagados entre barridos y **pasarelas** solo con Internet confirmado por un teléfono SENDA conectado | `locateAccessPoints` | Escenario: 56/60 routers, ±1 planta 100 %, vivienda 100 % |
| Personas: **DESAPARECIDO sin confirmar** (nunca «víctima») tras ≥2 alertas; «señal sin respuesta» si su teléfono se localiza | `personState` | Tests |
| **Alertas dirigidas** por edificio/planta/vivienda | `targetAudience` | Tests + panel |
| **Órdenes remotas** (baliza BLE, sirena, barrido Wi-Fi, estado) firmadas por coordinador verificado; exigen consentimiento del dueño y zona declarada; plan según batería y límites del SO | `remote-command.mjs` | Tests de firma, robo de clave, repetición, caducidad, rol y destino |
| **Cámara con mapa de calor**: señales proyectadas sobre la imagen en color por intensidad | `edificios.html` + `rubble.projectToCamera` + `signalColor` | E2E con cámara simulada |

Límites: la lectura de redes Wi-Fi no existe en navegadores; la hace SENDA Android (`apps/senda-android`, WifiManager) o el accesorio ESP32 (`hardware/esp32-survey`), en mano, en mástil o en dron. La reconstrucción 3D por IA desde una foto es línea futura; hoy la foto se adjunta a la evaluación EMS-98.

## 2 quinquies. Infraestructura de coordinación lista en la app (v0.5 · 04-11-2026)

| Pieza | Dónde | Verificación |
| --- | --- | --- |
| **Herramienta de organismo**: crea su ancla de confianza y firma credenciales de coordinador (la clave privada no sale del equipo) | `/senda/organismo`, `roles.mjs` (códigos `SENDA-ANCLA/SOLICITUD/CREDENCIAL`) | E2E |
| **Pestaña Coordinar**: credencial, alerta dirigida por edificio/plantas, cuadro de respuestas por planta, importación de barridos | `/senda` › Coordinar, `coord.mjs` | E2E: organismo → credencial → alerta → mula → residente «atrapado» → cuadro (B14 · planta 3) |
| **Alertas firmadas difundidas** sin destinatario por la red DTN (dedupe, caducidad, persistencia) | `bundle.mjs#putBroadcast` | Tests + E2E (un teléfono sin consentimiento la ignora y la sigue transportando) |
| **Respuesta del residente** cifrada al coordinador; sin respuesta en 60 s → «teléfono activo, sin respuesta» | `remote-command.mjs#buildResidentResponse/aggregateResponses` | Tests + E2E |
| **Relé por Internet** ciego al contenido, autoalojable | `packages/senda-relay` (Docker) | Tests + E2E (el texto no aparece en su almacén) + imagen arrancada en CI |
| **SENDA Android**: baliza BLE, escucha de balizas, barrido Wi-Fi; se abre desde la alerta (`senda://accion`) con lista blanca y toque del usuario | `apps/senda-android` | 14 invariantes JVM + APK compilado en CI |
| **Accesorio ESP32** (mástil o dron): barrido Wi-Fi + balizas → JSONL | `hardware/esp32-survey` | Trama probada en g++ con los mismos vectores + firmware compilado en CI |

Arquitectura completa, modelo de confianza y despliegue: [`docs/architecture/SENDA_ARCHITECTURE.md`](../architecture/SENDA_ARCHITECTURE.md).

## 6. Lo que falta para que un Estado lo adopte (por orden de impacto)

1. **Pasarela con el 112 / NG112**: entregar la fusión de incidentes como datos estructurados al centro 112 de cada comunidad (piloto con una comunidad autónoma).
2. **Acuerdo con operadores ferroviarios** (Adif, Renfe, Iryo, Ouigo): modo viaje activado al validar el billete, número de tren y coche automáticos, y manifiesto de pasajeros para reunificación familiar.
3. **Ficha médica offline compartible** (alergias, medicación, contacto) que el sanitario recibe por sonido o Bluetooth sin desbloquear el teléfono.
4. **Primeros auxilios guiados sin red** para quien ayuda a otros (hemorragias, RCP), con el recuento de heridos de su coche.
5. **Reunificación familiar**: «estoy bien» automático a la familia y consulta segura por parte de los familiares, sin colapsar el 112.
6. **App nativa iOS y Android en segundo plano** (Bluetooth/Wi-Fi Aware): SENDA Android ya existe para baliza, escucha y barrido con el toque del usuario; falta el modo en segundo plano y la versión iOS.
7. **Auditoría de seguridad independiente y DPIA**: requisito para cualquier contratación pública.
8. **Piloto de campo** con protección civil: simulacro en un tren parado con 50–100 voluntarios y medición del tiempo hasta conocer cada coche.

## 3. Lo que la física y los sistemas operativos permiten (y cómo lo resolvemos)

| Deseo | Realidad | Solución en SENDA |
| --- | --- | --- |
| Activar Bluetooth/Wi-Fi solo | Android 13+ e iOS exigen un toque del usuario para encender radios | Permisos concedidos en la instalación + **un toque** preautorizado cuando la radio está apagada (`PROMPT_USER_ENABLE`); si ya está encendida, actúa sin preguntar |
| Usar el satélite SOS del móvil (Apple/Pixel) | Cerrado a terceros | Satélite **directo al móvil de operador** (SMS por ventanas) y terminales de Internet satelital de vecinos/servicios |
| Ser la alerta oficial | Solo las autoridades emiten EU-Alert | **Canal secundario**: reenvía alertas verificadas por la malla y añade predicción etiquetada como tal; convenio para integración oficial |
| Red sísmica de Google | Privada | Red propia de acelerómetros (tipo MyShake) + EMSC/USGS/IGN |
| Ver a través de la pared con la cámara | La cámara capta luz, no radio | La cámara es la **pantalla de realidad aumentada**; la «visión» la aporta la señal BLE del teléfono de la víctima o un accesorio **Wi-Fi CSI** |
| Relés que leen mensajes ajenos | Riesgo de privacidad | Cifrado de extremo a extremo; el relé solo ve destino cifrado, prioridad y caducidad |

## 4. Proyectos abiertos que se integran

| Proyecto | Uso en SENDA | Licencia |
| --- | --- | --- |
| CelesTrak GP / TLE | Órbitas de satélites meteorológicos, de comunicaciones y D2D | Datos públicos |
| SatNOGS Network | Estaciones terrestres abiertas como gateways y fuente de pasos | AGPL / datos abiertos |
| satellite.js | SGP4 de producción (enchufable en `orbital.mjs`) | MIT |
| USGS / EMSC / IGN | Catálogos sísmicos en tiempo real | Datos públicos |
| Meteoalarm / CAP 1.2 | Alertas meteorológicas europeas | Datos públicos |
| ESP32-CSI-Tool, Nexmon CSI | Captura CSI para detección tras muros | MIT / GPL |
| Meshtastic | Malla LoRa (ya existe adaptador en `packages/transports`) | GPL-3.0 |
| Google Nearby Connections | Bluetooth/Wi-Fi entre Android (laboratorio en `experimental/android-nearby`) | SDK de Google |

**«El ojo de Dios»:** pendiente de que el promotor indique el repositorio exacto para integrarlo.

## 5. Próximos pasos (en orden de evidencia)

1. **Android:** conectar `ladder.mjs` a Nearby/BLE GATT/Wi-Fi Aware/SmsManager en `experimental/android-nearby` y medir con dos y tres teléfonos (incluido el puente bajo un forjado).
2. **Fuentes en vivo:** servicio que ejecute `pullAll()` cada minuto y publique zonas firmadas a los teléfonos.
3. **Accesorio CSI:** prototipo ESP32 + app; calibración en edificio real con equipos de rescate.
4. **Convenios:** protección civil / bomberos para anclas de confianza, y un operador con satélite directo al móvil.
5. **Rebranding completo** de web, vídeo y documentos de inversión a SENDA.

*Todo resultado de este documento procede de simulación con los algoritmos reales; ninguno sustituye a un ensayo físico. No usar en emergencias reales hasta superar la validación de campo.*

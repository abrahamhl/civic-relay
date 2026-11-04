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

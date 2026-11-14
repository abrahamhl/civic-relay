# SENDA Vigía — sensores baratos en los que un organismo puede confiar

> Estado: **propuesta de producto + núcleo implementado y probado** (`packages/senda/src/vigia.mjs`, 12 pruebas).
> Hardware: **sin construir ni medir**. Precios: **sin cotizar** (ver §4). El nombre «Vigía» es provisional; decide el fundador.

## 1. 🎯 Qué es, en una frase

**Un estándar abierto y un firmware que convierten módulos de 5–30 € (térmica, micrófono, cámara, dashcam, LoRa) en una red de vigilancia de emergencias cuyas alarmas un organismo puede firmar ante un juez**, porque ninguna sale de un solo sensor: solo salen cuando varios nodos independientes coinciden con la física del suceso.

## 2. 💡 Por qué es nuevo (y por qué no es «otro pack»)

El repo ya tiene 12 packs de hardware descritos en `docs/hardware/`. Comprar módulos es fácil y se copia en una tarde. Lo que **no existe** y bloquea a los Estados es:

| Problema real de los sensores baratos | Lo que hace Vigía (en código, hoy) |
|---|---|
| Falsas alarmas (tubos de escape, reflejos, portazos) | **Consenso físico**: un fuego real da rumbos que se cortan; un estallido llega a cada micrófono con retrasos que cuadran con la velocidad del sonido *a esa temperatura*. Un solo nodo **nunca** dispara (0 de 500 en prueba). |
| Un nodo averiado o manipulado puede engañar | El nodo que no cuadra se marca **INCOHERENTE** y no mueve el punto (detectado 488/500 en Monte Carlo). |
| Privacidad: cámaras y micrófonos en la calle | Del nodo sale un **suceso**, nunca imagen ni audio. `buildEvent` rechaza esos campos por código. |
| Pruebas que valgan ante un juez o auditor | Cada suceso va **firmado (ECDSA P-256)**, y alterar una coordenada rompe la firma. Sale en **CAP 1.2** para la sala 112. |
| No hay red cuando más falta | Transporte por el planificador multicanal de SENDA (LoRa, malla, satélite), ya probado. |
| Cada nodo es distinto | La **confianza aprendida** (SENDA-CAL, ya conectado) baja el peso de los nodos con historial de falsas alarmas. |

**El foso no es el hardware, es el consenso + la confianza aprendida + la firma.** Cuanta más red se despliega, más datos de calibración tiene y más difícil es de copiar.

## 3. 📊 Resultados medidos (simulación, semilla fija, reproducible)

`node --test packages/senda/tests/vigia.test.mjs`

| Prueba | Resultado |
|---|---|
| 3 térmicas, ±1° de error de rumbo, 500 fuegos al azar + 1 nodo mentiroso | 498 confirmados · mentiroso detectado 488/500 · error mediano 8,9 m · p95 20,4 m |
| 1 solo nodo detecta algo | 0/500 alarmas |
| 3 nodos con rumbos al azar (ruido puro) | 4/2000 falsos consensos (0,2 %) |
| Térmica + 3 micrófonos a 35 °C, 1 reloj falseado 0,4 s | Confirmado con 2 modalidades, reloj falso excluido, error < 5 m |
| Estallido a 40 °C suponiendo 343 m/s | Desplaza el punto; con la temperatura corregida, error < 0,5 m |

**Límites honestos:** todo es simulación geométrica. Falta medir con hardware real el error de rumbo de una MLX90640 a 300–1000 m, el comportamiento con humo, viento y ecos, y la sincronización de relojes entre nodos.

## 4. 🧩 Nodos propuestos (módulos COTS reales, precios SIN cotizar)

> No he verificado precios ni disponibilidad en esta sesión. Antes de poner un solo euro en una presentación: 3 cotizaciones por pieza y una compra de prueba. Algunos precios de `docs/hardware/` (p. ej. radar UWB a 11,90 €, batería 18650 de 2600 mAh a 1,40 €) **parecen poco realistas** y no deben citarse sin comprobar.

| Nodo | Módulos | Detecta | Riesgo técnico principal |
|---|---|---|---|
| **V-T «Torre térmica»** (poste, balcón, repetidor) | ESP32-S3 + MLX90640 (32×24, 55° o 110°) + LoRa SX1262 + solar | Ignición y avance del fuego (rumbo) | Pocos píxeles: un fuego pequeño a > 500 m puede ocupar < 1 px |
| **V-A «Oído»** | ESP32-S3 + 2–4 micrófonos I2S (INMP441) o cardioides + GNSS con PPS | Estallido, derrumbe, golpes de personas atrapadas (instante de llegada) | Sincronía de relojes < 1 ms (sin PPS no hay localización) |
| **V-C «Ojo» (reutiliza lo instalado)** | Cámara IP o dashcam existente + puente ESP32 / mini-PC | Humo y llama por visión (rumbo) | Modelo de visión en el borde; acuerdos con quien opera la cámara |
| **V-M «Móvil»** (coche, autobús, camión) | Dashcam + móvil con SENDA | Rumbo de humo desde la carretera + mula de mensajes | Posición y orientación del vehículo en marcha |

Energía: `powerBudget()` hace la cuenta (consumo medio, balance solar, autonomía sin sol). **Las corrientes son datos de entrada que hay que medir con amperímetro**; el código no las inventa.

## 5. 💶 Modelo de negocio (open source + ingresos)

- **Abierto (Apache/EUPL):** núcleo, estándar de suceso, firmware de referencia. Genera confianza, auditoría y adopción.
- **De pago para Estados, ayuntamientos y operadores:**
  1. **Certificación de nodos** («Vigía Certified»): pruebas de laboratorio y de campo por modelo de hardware. Es lo que un organismo exige para comprar.
  2. **Consola de flota y SLA:** alta y baja de nodos, claves, confianza aprendida, mantenimiento, informes CAP.
  3. **Calibración por región:** la base de datos de confianza aprendida (anónima) es el activo que mejora con cada despliegue.
  4. **Kits llave en mano** a través de integradores locales (no fabricamos: margen de licencia y certificación).

**Sobre el «valor de varios millones»:** ninguna tecnología vale eso por sí sola. La valoración la sostienen **pruebas de campo con datos, cartas de intención de organismos y un primer contrato**. Lo que aporta este código es que la demo es real y reproducible, no una maqueta.

## 6. 🗺️ Camino a inversores (Spain → Países Bajos → Europa)

| Fase | Entregable verificable | Quién lo hace |
|---|---|---|
| **0 · Esta semana** | Demo en el Centro: consenso de 3 térmicas + nodo falso detectado + CAP (código listo; falta la pantalla) | Claude (código) |
| **1 · 2–4 semanas** | 3 nodos V-T + 3 V-A montados; vídeo de campo con un fuego controlado (barbacoa homologada, parcela privada, con permiso); error medido frente a GNSS | Fundador + técnico (hermano NL/ES) |
| **2 · 1–3 meses** | Piloto con un ayuntamiento o una agrupación de Protección Civil: 10–20 nodos, una temporada | Fundador |
| **3** | Carta de intención + informe de piloto → ronda pre-semilla | Fundador |
| **Financiación no dilutiva** | Ver `docs/FUNDING_LEADS_2026.md` (no repito cifras sin fuente) | — |

## 7. ⚖️ Riesgos que un inversor preguntará

- **Protección de datos (RGPD, AEPD):** micrófonos y cámaras en espacio público exigen evaluación de impacto (DPIA). El diseño solo-suceso ayuda, pero no exime. Hace falta revisión jurídica.
- **Radio:** LoRa a 868 MHz tiene límites de ciclo de trabajo en la UE. El planificador ya los respeta, pero falta validarlo en campo.
- **Uso civil:** el producto es para fuego, derrumbe y rescate. Las variantes de defensa quedan fuera de esta línea, como en el resto del repo.
- **Hardware no probado:** todo el rendimiento de §3 es simulado hasta la fase 1.

— Firma: Claude Code (sesión cloud), 12-11-2026.

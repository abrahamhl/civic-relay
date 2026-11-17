# SENDA — Hipótesis y límites físicos verificables, 17 noviembre 2026

> **Estado:** investigación guiada por fuentes públicas, NO descubrimiento científico validado, NO autorización de acceso a infraestructuras y NO evidencia de conexión satelital. Este documento evita duplicar los desarrollos matemáticos asignados a Claude; propone experimentos que deben contrastarse con su trabajo antes de fusionar. No avanzar el Agente 2 hasta cerrar la puerta del Agente 1.

## Qué existe ya y no debemos presentar como invención
- DTN/BPv7, BPSec, store-and-forward, contact graph routing y QoS llevan años investigándose. Estándares: https://www.rfc-editor.org/rfc/rfc9171.html ; https://datatracker.ietf.org/group/dtn/documents/ ; https://www.nasa.gov/reference/delay-disruption-tolerant-networking-overview/
- La fiabilidad en contactos inciertos y decisiones bajo fallos correlacionados sigue siendo un problema de investigación, **pero no es un campo vacío**. Ejemplos publicados: https://juanfraire.space/publications/2025-comparing-statistical-analytical-and-learning-based/ ; https://ieeexplore.ieee.org/abstract/document/11229839/ ; https://www.sciencedirect.com/science/article/pii/S1570870526001289
- ITU-R P.1812-8 aplica a propagación terrestre punto-área 30 MHz–6 GHz, **NO a enlaces satélite-Tierra**; P.618-14 es la familia aplicable a propagación Tierra-espacio: https://www.itu.int/rec/R-REC-P.1812-8-202509-I/en ; https://www.itu.int/rec/R-REC-P.618/en
- 3GPP Rel-19 incluye características de operación satelital store-and-forward, pero el soporte es opcional para UE/red y depende de dispositivo, operador, frecuencia y servicio: https://portal.3gpp.org/DesktopModules/CRs/CrDetails.aspx?CrId=570899 ; https://portal.3gpp.org/DesktopModules/CRs/CrDetails.aspx?CrId=570560

## Aportación implementada en sandbox (sin afirmación de novedad absoluta)
`experimental/senda-route-truth/research-contact-planner.mjs` es un enumerador de rutas temporales finitas, con:
- Ruta dirigida de contactos activos autorizados y consentimiento explícito.
- Contactos con intervalo [inicio, fin], tasa de bytes, handshake, tamaño de mensaje y plazo máximo.
- Presupuesto energético, límite de saltos y duty-cycle habilitado por el perfil de simulación.
- Una cota inferior de éxito independiente de asumir fallos independientes: si cada contacto tiene una cota inferior válida p_i, por Boole se sigue `P(todos) >= max(0,1 - sum(1-p_i))`. **No hay garantía si las p_i no son cotas estadísticamente calibradas**; la herramienta siempre marca `HYPOTHETICAL_CONTACT_MODEL_ONLY`.
- Rechazo de incertidumbres demasiado grandes según umbral elegido y ninguna inferencia de entrega física, compatibilidad NTN o acceso a red.

No modela aún distribución del inicio de contactos, capacidad compartida multiusuario, tramas radio reales, interferencias, multirruta, fallos de reloj, energía de espera, movilidad estocástica, cambios de duty cycle ni certificación regulatoria. El enumerador es exponencial y se limita a 10.000 candidatos (falla cerrado); no sustituye CGR ni algoritmos escalables.

### Escenario de falsación de laboratorio
Ruta A→C con cota sintética 0,55; ruta A→B→C con cotas sintéticas 0,95 y 0,95. Cota sin independencia de la segunda: 1−0,05−0,05=0,90. Si se requiere 0,85, el segundo plan es admisible en el modelo y el primero no. Esto **no constituye un 90% de éxito real**.

## Preguntas científicas candidatas a investigación (con criterio de falsación)

| ID | Cuestión abierta / combinación aplicada | Hipótesis concreta y experimento que puede refutarla | Prioridad |
|---|---|---|---|
| H1 | Contactos terrestres/satelitales inciertos y fallos de causa común (inundación, apagón, obstrucción) | Probar si una cota de riesgo dependiente de datos correlacionados evita **sobreestimar** la probabilidad en escenarios retenidos. Baselines: hops, CGR, RUCoP/GROGU. Rechazar si no mejora calibración/latencia/energía o si informa éxitos falsos. | P0, investigación |
| H2 | Interferencia, relieve DEM, edificios y cambios ambientales | Comparar predicciones ITU P.1812-8 con medidas LoRa EU868 legales y autorizadas en varias zonas; error absoluto, cobertura de intervalos y capacidad transferible a localizaciones no vistas. No extrapolar a NTN. | P1 |
| H3 | Satélites visibles frente a servicio verdaderamente disponible | Usar OMM/GP públicos + propagador SGP4, fecha de elementos y máscara de horizonte, **más** autorización, radio compatible y oferta del operador. Contrastar horarios con telemetría de un terminal autorizado. Si no hay convenio/terminal, solo «geometría probable», nunca uplink. | P0 veracidad |
| H4 | Pérdida de tiempo fiable, GNSS denegado y caducidad de mensajes | Ensayar reloj adelantado/atrasado, boot ID, reloj monotónico local, reinicios y deduplicación. No entregar mensaje expirado ni atribuir un ACK a un rescate. 3GPP Rel-20 incluye GNSS-resilient NR-NTN como línea en desarrollo. | P0 |
| H5 | Saturación, baterías, equidad de retransmisiones y SOS explícitos | Política que limite energía/aire sin deducir automáticamente víctimas ni SOS; medir tasa de entrega antes del deadline, energía/byte, fairness, falsos ACK y fallos de buffer frente a FIFO y prioridad estática. | P1 |
| H6 | RF reflectada, visibilidad sin línea de vista y superficies programables RIS | Solo una RIS **físicamente instalada y controlada** puede alterar canal; no genera paquetes arbitrarios ni convierte paredes/radares ajenos en relés. Medir ganancia respecto a pared pasiva; validar permisos, CSI y sincronización. | P2 |
| H7 | Datos abiertos + observaciones comunitarias con procedencia | Conservar fuente, fecha, incertidumbre, licencia y etiqueta; medir falsas coincidencias entre incendios/inundaciones, retraso de datos y falsos positivos con conjuntos retenidos. No afirmar acceso a sensores ajenos. | P1 |
| H8 | Interoperabilidad entre paquetes DTN y transportes heterogéneos | Probar adaptadores **opt-in** con dos radios LoRa físicos y Android voluntario, manteniendo clasificación de recibos: transporte aceptó != peer recibió != intervención institucional. | P1 hardware |

## Inventario de posibles «puentes» (no presume acceso)
| Medio | ¿Qué puede aportar SENDA? | ¿Qué no puede suponer? |
|---|---|---|
| Android Nearby / BLE / Wi-Fi | Mensaje a otro móvil cercano compatible, con consentimiento y radios activas | Mesh radio universal, reactivación remota de radios ni resultado físico sin dos equipos |
| Meshtastic EU_868 (LoRa con hardware) | Red experimental cooperativa de nodos transceptores autorizados | LoRa integrado en cualquier móvil, alcance garantizado, bypass legal de duty-cycle; https://meshtastic.org/docs/getting-started/ |
| Reticulum/LXMF | Protocolo/referencia para transportar mensajes DTN sobre hardware soportado | Compatibilidad por declaración sin adaptador, firmware y pruebas |
| GNSS (GPS/Galileo) | Tiempo/posición recibidos por terminal compatible | Canal de ida hacia satélites GNSS, permiso para emitir o SOS a través de GNSS |
| CelesTrak OMM/SupGP | Estimación geométrica orbital usando elementos de un satélite individual y SGP4 | Disponibilidad comercial, derecho de uso de un servicio ni conexión. Desde julio 2026 los números de catálogo de seis dígitos requieren formatos alternativos a TLE convencional. https://celestrak.org/NORAD/elements/supplemental/ |
| 3GPP NTN / D2D móvil-satélite | Arquitectura de evaluación de futuras ventanas y handover, si terminal y operador lo permiten | Acceso a Starlink/AST/Globalstar/Skylo/Iridium sin convenio, módem homologado, SIM/capacidad/servicio |
| SDR pasivo | Observación autorizada del espectro, pruebas RF de solo recepción | Emisión, retransmisión o interceptación de comunicaciones privadas |
| CCTV / sensores / meteorología de fuentes abiertas | Observaciones descargables, no canal de comunicaciones | Control de cámaras, cámaras como repetidores ni datos privados |
| RIS física (superficie electromagnética) | Experimentar propagación controlada con hardware y permisos | Crear datos nuevos por reflexión pasiva; https://www.nature.com/articles/s44459-026-00051-0 |
| SIRDEE/C2000/ASTRID/112 | Posible investigación en consorcio bajo acuerdo formal | Acceso o compatibilidad sin autorización institucional |

## Filtros de ciencia reproducible antes de nuevas afirmaciones
1. Congelar SHA, código, semillas, datasets y manifiestos de procedencia, con permisos/licencias verificadas.
2. Separar ventanas sintéticas, posiciones orbitales calculadas, niveles de señal medidos y entrega de aplicación reconocida con ACK.
3. Diseñar escenarios de fallos **correlacionados** (un mismo incendio destruye antenas y energía) y ensayos de peor caso, no solo Monte Carlo independiente.
4. Comparar con baselines reales (shortest-hop, FIFO, CGR, RUCoP/GROGU cuando su implementación y licencia lo permitan) y publicar casos donde SENDA empeora.
5. Medir Brier score/calibración, latencias p50/p95, energía, tasa de entrega antes de deadline e intervalos de confianza 95%; no extraer probabilidades físicas de simulaciones sin medición.
6. Envíos experimentales solo sobre hardware compatible y autorizado, y sin números oficiales de emergencia. Dos Android reales + dos LoRa EU868 + al menos 30 intentos fechados por escenario antes de discutir fiabilidad preliminar.
7. Invitar revisión científica externa y comprobación de **originalidad** bibliográfica antes de afirmar teoría nueva o solicitar financiación por I+D inédita.

## Material oficial para comenzar
- NASA DTN https://www.nasa.gov/reference/delay-disruption-tolerant-networking-overview/
- IETF BPv7 https://www.rfc-editor.org/rfc/rfc9171.html
- ITU P.1812 https://www.itu.int/rec/R-REC-P.1812-8-202509-I/en
- ITU P.618 https://www.itu.int/rec/R-REC-P.618/en
- 3GPP RAN 113 NR-NTN GNSS-resilient: https://www.3gpp.org/news-events/3gpp-news/ran113-reports
- CelesTrak SupGP: https://celestrak.org/NORAD/elements/supplemental/
- Meshtastic: https://meshtastic.org/docs/getting-started/
- CEMS datos https://emergency.copernicus.eu/data/

**Decisión:** mantener los resultados como `SIMULACIÓN CIENTÍFICA` y `HIPÓTESIS DE INVESTIGACIÓN`. Ningún puerto satelital, RF de terceros ni servicio de emergencias se ha accedido o probado. La puerta del Agente 1 continúa bloqueada para validación física y Android.

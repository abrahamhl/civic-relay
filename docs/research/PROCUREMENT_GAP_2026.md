# Qué compran los Estados, dónde está el hueco y cómo lo cubre SENDA

> Investigación del 04-11-2026. Entrada → Procesamiento → Validación → Salida. Toda afirmación
> lleva fuente; lo no confirmado se marca. Autor: asistente de orquestación (Claude) para el fundador.

## 1. Qué piden los pliegos y programas públicos (evidencia)

| Requisito recurrente | Dónde aparece | Fuente |
|---|---|---|
| **Interoperabilidad con estándares abiertos** (CAP para alertas, APIs abiertas para sensores/CAD) | Guías de compra de software de emergencias; EMSI (ISO/TR 22351) para intercambio entre organismos, complementario a CAP | [Adaptive Lighthouse 2026](https://adaptivelighthouse.com/resources/emergency-management-software-guide) · [ISO/TR 22351](https://www.iso.org/standard/57384.html) |
| **Cumplimiento ENS (RD 311/2022) y ENI (RD 4/2010)** en España | Pliegos de 2025 de la Región de Murcia | [Pliego SMS Murcia 2025](https://sms.carm.es/sms/licitacion/licitacion/documento?numExpediente=CSE%2F9900%2F1101169037%2F25%2FPA&idDoc=R0337119) |
| **Integración y mantenimiento de la plataforma 112** con otros sistemas | Contrato de explotación tecnológica del 112 de Murcia | [CARM 2023](https://transparencia.carm.es/wres/transparencia/doc/Consejo_Gobierno/2023-03-16/punto_22_contrato_gestion_emergencias.pdf) |
| **Certificación y pruebas exigidas por contrato** (MCX/3GPP) | Recomendación TCCA a compradores | [3GPP/TCCA](https://www.3gpp.org/news-events/partner-news/ppdr-tcca) |
| **Comunicaciones resilientes, conectividad satelital, roaming transfronterizo, NIS2** | Propuesta EUCCS (30-09-2026): ~10 Estados desde 2030, todos hacia 2036; acceso a conectividad satelital segura | [Comisión Europea](https://home-affairs.ec.europa.eu/news/enhancing-europes-capacity-react-preparing-european-critical-communication-system-2026-01-30_en) · [EENA](https://eena.org/news/the-commission-proposed-a-new-european-union-critical-communication-system-regulation/) |
| **Autosuficiencia de la población 72 h** y alerta temprana | Estrategia de la Unión de la Preparación (guías previstas en 2026) | [Comisión Europea](https://commission.europa.eu/topics/preparedness_uk) |
| **Gobernanza de IA y auditoría** apareciendo en licitaciones | Guía de compra 2026 (fuente secundaria, de proveedor) | [Adaptive Lighthouse 2026](https://adaptivelighthouse.com/resources/emergency-management-software-guide) |

## 2. Qué falló en la realidad (evidencia)

- **Apagón ibérico, 28-04-2025.** La red móvil cayó cuando se agotaron las baterías de las antenas («apenas unas horas»); los usuarios con conexión estable bajaron del 90 % al 40 % hacia las 15:00. [laecuaciondigital](https://www.laecuaciondigital.com/actualidad/el-apagon-electrico-colapsa-redes-moviles-en-espana-y-portugal-el-28-de-abril/) · [Infobae](https://www.infobae.com/tecno/2025/04/29/el-apagon-que-desconecto-a-espana-por-que-whatsapp-dejo-de-funcionar-aunque-el-movil-mostraba-cobertura/) · [Wikipedia](https://es.wikipedia.org/wiki/Apag%C3%B3n_en_la_pen%C3%ADnsula_ib%C3%A9rica_de_2025)
- **DANA de Valencia, 29-10-2024.** El ES-Alert se envió a las 20:11, con versiones contradictorias sobre la causa del retraso. [El Debate](https://www.eldebate.com/espana/comunidad-valenciana/20251204/principal-tecnico-emergencia-dana-sostiene-alert-retraso-diferenciar-valenciano-catalan_362211.html) · [Donporque](https://donporque.com/por-que-retraso-es-alert-dana/)
- **Países Bajos, 2026.** El Gobierno planteó apagar las sirenas en 2028 apoyándose en que NL-Alert llega al 92 % de la población por el móvil, y luego rectificó. NL-Alert depende de la red celular. [DutchNews](https://www.dutchnews.nl/2026/06/government-u-turns-on-decision-not-to-replace-air-raid-sirens/)
- **Galileo EWSS** (alertas por satélite sin red celular) sigue «en desarrollo» según EUSPA; no hay confirmación de servicio operativo. [EUSPA](https://www.euspa.europa.eu/galileo-ewss)

## 3. El hueco

1. **Toda la cadena oficial de alerta (ES-Alert, NL-Alert, EU-Alert) depende de la red celular**, justo la que cae a las pocas horas de un apagón. La vía satelital oficial (EWSS) aún no está operativa.
2. **Los sistemas de mando (TETRA, MCX, EUCCS desde 2030) conectan a los intervinientes entre sí, no a la ciudadanía.** No hay un canal bidireccional estructurado y verificable entre la persona atrapada y la sala cuando no hay red.
3. **Nadie le da a protección civil un mapa de cuándo y dónde se quedará la población sin cobertura** tras un corte de luz, ni dónde colocar pasarelas antes de que ocurra.
4. **Los dispositivos de consumo que sí funcionan sin red** (satélite directo al móvil, LoRa/Meshtastic, Iridium, radioaficionados, drones, Bluetooth/sonido) **no están coordinados**. Cada uno tiene su app, su formato y sus límites legales.
5. **Ventana temporal:** entre hoy y 2030–2036 (despliegue de EUCCS) los Estados necesitan algo que funcione ya, con lo que la gente tiene en el bolsillo.

## 4. Cómo lo cubre SENDA (implementado y verificado por máquina)

| Hueco | Respuesta SENDA | Módulo | Prueba |
|---|---|---|---|
| 1, 4 | Mensajes cifrados extremo a extremo que viajan por sonido, archivo, mula DTN, SMS, satélite directo al móvil, LoRa, Iridium, radioaficionados (solo estados públicos firmados) y drones | `envelope`, `bundle`, `acoustic-modem`, `bearers` | Núcleo + E2E sin red |
| 4 | **Reparto k-de-n (Reed-Solomon GF(256)) entre portadores**, con probabilidad de entrega exacta (Poisson-binomial agrupada) y plan de mínimo coste y latencia | `erasure`, `bearers` | 126 combinaciones de 5 de 9; 197/200 en prueba real de pérdida |
| 3 | **Previsión de apagón** (supervivencia Weibull por clase de respaldo, calibrada con el dato público del 28-04) y **colocación voraz de pasarelas** con garantía ≥ (1 − 1/e) | `blackout` | Monotonía, submodularidad, calibración |
| 2 | Alertas firmadas por coordinador con credencial del organismo → teléfono verifica, exige consentimiento y zona → respuesta cifrada → cuadro por planta | `roles`, `remote-command`, `coord.mjs` | E2E institucional completo |
| Interop. | **CAP 1.2** de incidentes y alertas + **auditoría encadenada SHA-256**; mapeo EMSI preparado (no se declara conformidad sin la norma) | `interop` | CAP leído por el propio lector CAP; alteración detectada |
| Ferroviario | Detección de impacto, fusión por tren, segundo tren en segundos (simulación) | `rail-incident` | 8 semillas |
| Edificios | Gemelo EMS-98, routers por planta, «desaparecido sin confirmar», misión de dron por fachada (QGroundControl) | `building-twin`, `drone` | Escenario + E2E |
| Accesibilidad | Modo fácil de 3 botones y auditoría automática de las 6 pantallas | `index.html`, E2E | E2E |

## 5. Red satelital por nivel de acceso

Ver `packages/senda/src/satellites.mjs` (cada entrada con fuentes): Starlink D2C (en despliegue por operador), Skylo NB-NTN (en despliegue), Iridium SBD (operativo; módulo RockBLOCK 9603, 340 B), QO-100 (operativo, radioaficionados, sin cifrado), Cospas-Sarsat/Galileo RLS (operativo), Galileo EWSS (en desarrollo), GOVSATCOM/IRIS² (previsto; vía EUCCS), SatNOGS (operativo, recepción).

## 6. Valor y retorno para cada parte (hipótesis a validar, no previsiones)

| Parte | Qué obtiene | Cómo se mide |
|---|---|---|
| Ciudadanía y víctimas | Un canal que sigue funcionando cuando cae la red; modo fácil; nadie es «víctima» sin confirmación | Tiempo hasta el primer «atrapado» localizado en simulacro |
| Coordinadores y cuerpos de seguridad | Imagen operativa por planta y por tren; alertas dirigidas firmadas; CAP hacia el 112 | Minutos ganados frente a la cronología oficial |
| Administraciones | Continuidad entre hoy y EUCCS (2030–2036); soberanía (relé propio, código abierto); cumplimiento ENS/ENI/accesibilidad como objetivo | Coste por habitante cubierto frente a sirenas o infraestructura nueva |
| Inversores | Núcleo abierto, difícil de replicar (cripto, DTN, módem acústico, k-de-n, previsión, gemelo); ingresos por licencias institucionales, integración, kits de hardware y certificación | Contratos piloto y convenios firmados |
| Desarrollador (fundador) | Propiedad intelectual sobre integración, servicios y marca; posición en el ecosistema EUCCS | Primer piloto pagado |

**Tamaño de mercado (cifras con alcances distintos, no comparables entre sí):** software de gestión de emergencias en sentido estricto, unos USD 365 M (2025); software de gestión de incidentes y emergencias, unos USD 20.200 M (2025, TCAC 11,6 %). [MarketsandMarkets](https://www.marketsandmarkets.com/Market-Reports/emergency-management-software-market-218079999.html) · [Growth Market Reports](https://growthmarketreports.com/report/incident-and-emergency-management-software-market-global-industry-analysis). Para EUCCS, la cobertura secundaria cita una necesidad de inversión de unos 3.571 M€ (cifra sin confirmar en el texto oficial).

**Modelo propuesto (ilustrativo):** núcleo y app ciudadana gratuitos y abiertos. Licencia institucional para la consola de coordinación, el relé gestionado y la integración CAP/112 (por habitante o por organismo). Kits de pasarela (Iridium + LoRa) y drones con mantenimiento. Servicios de piloto, formación, auditoría ENS y accesibilidad.

## 7. Límites declarados

- **Sin validación de campo** con teléfonos físicos ni equipos de rescate. Es la siguiente fase.
- **Sin auditoría de seguridad independiente ni certificación ENS.** Son requisitos de compra pública.
- **EMSI no validado** (norma de pago, CHF 227). **NG112 no integrado.**
- **Probabilidades de portador (p):** son valores previos de planificación; en campo se sustituyen por lo medido.
- **Modelo de apagón:** calibrado con un único dato público agregado y una ciudad sintética; necesita el inventario de respaldo energético de los operadores.
- **Company ID BLE 0xFFFF** es de pruebas.

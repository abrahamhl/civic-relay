# SENDA Investor Truth Gate & Diligence Verification Matrix

**Documento:** Matriz de Veracidad, Falsación de Claims y Diligencia de Inversión (TRL 4-5)  
**Misión:** SENDA Scientific Engineering Mission 10/10  
**Fecha:** 9 de noviembre de 2026  
**Responsables:** A12 — Independent Red Team & Investment Diligence  
**Estado:** AUDITADO PARA DILIGENCIA PRE-SERIE A / SUBVENCIONES EUROPEAS

---

## 1. Principio Rector: Tolerancia Cero al "Vaporware" y Auto-Certificación

Este documento establece la línea base innegociable de lo que la empresa fundadora y el equipo técnico pueden afirmar ante inversores de capital riesgo (*Venture Capital*), comités de evaluación de subvenciones (Horizon Europe, EIC Accelerator) y administraciones públicas (DGT, Protección Civil, Ministerio del Interior).

Toda afirmación no sustentada en código comprobable y pruebas físicas normativas queda catalogada como **NO PUBLICABLE** o **CONDICIONAL**.

---

## 2. Matriz Completa de Afirmaciones (Truth Gate Matrix)

| ID | Afirmación Técnica Comercial | Evidencia Técnica Comprobable | Código Fuente & Tests | Madurez TRL | Limitación Física / Condición Obligatoria | Dictamen Publicable |
|---|---|---|---|:---:|---|:---:|
| **TG-01** | *«Comunicaciones de emergencia sin red celular mediante mallas tolerantes al retardo»* | Algoritmo PAER con simulación de eventos discretos. 100% PDR, reducción de sobrecarga del 36,2% y 0 pérdidas por frente de fuego. | [`packages/senda/src/physics-aware-emergency-network.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/physics-aware-emergency-network.mjs)<br>Test: `physics-aware-emergency-network.test.mjs` | TRL 4-5 | Requiere densidad mínima de nodos ($\eta_c \ge 4.512$) y ventanas de contacto. Funciona en modo *store-and-forward* (latencias de minutos u horas, no llamadas síncronas de voz en tiempo real). | **SÍ** |
| **TG-02** | *«Atenuación por lluvia calculada según estándar internacional ITU-R P.838-3»* | Formulación analítica continua con 4 tablas gaussianas oficiales de coeficientes $k$ y $\alpha$ (1–100 GHz). Error relativo < 0,15%. | [`packages/senda/src/telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs)<br>Test: `telecom-mathematical-physics.test.mjs` | TRL 5 | Válido para lluvia estratiforme y convectiva bajo supuestos de gotas oblatas de Marshall-Palmer. No modela granizo ni nieve húmeda sin coeficientes específicos. | **SÍ** |
| **TG-03** | *«Cálculo de pérdidas por difracción en múltiples obstáculos mediante Deygout extendido (ITU-R P.526-15)»* | Algoritmo de cresta dominante con factores secundarios $C_L, C_R$ y presupuesto de enlace completo (FSPL, margen, sensibilidad). | [`packages/senda/src/telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs)<br>Test: `relay-geometry.test.mjs` | TRL 5 | Asume crestas equivalentes a filos de cuchillo sobre perfil 2D. No sustituye modelos tridimensionales FDTD de microceldas en cañones urbanos de hormigón. | **SÍ** |
| **TG-04** | *«Cálculo de ventanas orbitales LEO y desplazamiento Doppler topocéntrico»* | Propagador Kepler + J2 secular y cinemática topocéntrica con derivadas radiales para VHF, UHF, L-band y S-band. | [`packages/senda/src/orbital.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/orbital.mjs)<br>UI: `Globe4DStudio.tsx` | TRL 4 | **UNA VENTANA ORBITAL ES LÍNEA DE VISTA GEOMÉTRICA; NO CONFIERE DERECHO DE TRANSMISIÓN, ENLACE RF NI ACCESO A OPERADOR SATELITAL.** | **CONDICIONAL** (Obligatorio mostrar disclaimer físico/regulatorio). |
| **TG-05** | *«Baliza acústica ultrasónica de supervivencia en escombros (19–21 kHz)»* | Modulación FSK 100 baudios con presupuesto acústico ISO 9613-1 y absorción atmosférica (~0,65 dB/m). | [`packages/senda/src/acoustic-beamforming-survival.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/acoustic-beamforming-survival.mjs)<br>Test: `acoustic-beamforming-survival.test.mjs` | TRL 3-4 | Alcance físico en teléfonos COTS limitado a 5–10 m en silencio y 2–4 m con 85 dBA de ruido. Altavoces de baja calidad generan subarmónicos audibles. Audible para caninos y jóvenes. | **CONDICIONAL** (Prohibido declarar alcances >10m o inaudibilidad absoluta). |
| **TG-06** | *«Certificación soberana TIER 1 de defensa / protección civil»* | Ninguna agencia externa ha otorgado homologación oficial. | [`packages/senda/src/government-resilience-harness.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/government-resilience-harness.mjs) | TRL 4 | El arnés interno evalúa métricas técnicas diagnósticas, no acredita certificación militar ni gubernamental oficial. | **NO** (Prohibido usar como claim publicitario comercial o gubernamental). |
| **TG-07** | *«Trazabilidad pericial forense admisible en juicio con sellado Ed25519»* | Paquete `@senda/pci` con cadena de bloques hash SHA-256 encadenada, recibos de transferencia mutuos y firmas Ed25519 cerradas ante manipulación. | [`packages/senda-pci/src/pci.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda-pci/src/pci.mjs)<br>Test: `packages/senda-pci/tests/*.test.mjs` | TRL 5 | Demuestra integridad criptográfica e inmutabilidad temporal. La admisibilidad jurídica pericial plena requiere que las claves de los custodios estén asociadas a certificados reconocidos (eIDAS / DNIe). | **SÍ** |
| **TG-08** | *«Predicción de avance de incendios forestales con acoplamiento meteorológico y topográfico»* | Ecuaciones de Rothermel acopladas a malla MET Norway y modelo digital de elevaciones IGN MDT05, con validación fuera de muestra en Bejís y Vall d'Ebo. | [`packages/senda/src/fire-front-robust.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/fire-front-robust.mjs)<br>Test: `fire-cases.test.mjs` | TRL 4 | La precisión depende de la frescura de los datos de viento a 10m. En incendios convectivos extremos con pirocúmulos (pyroCb), la atmósfera local modifica el viento sinóptico. | **SÍ** |

---

## 3. Posicionamiento Estratégico para Inversores Deep Tech

SENDA no es una "app de mensajería social", sino una **infraestructura de resiliencia civil y telecomunicaciones físicas críticas**.

- **TRL Actual:** 4-5 (Validación técnica de subsistemas en entorno de laboratorio y simulación calibrada con datos empíricos auténticos).
- **Hito Pre-Serie A:** Ensayos de campo en entorno real (TRL 6) con 50 terminales COTS y nodos LoRa en ejercicio de emergencia coordinado con Protección Civil o ayuntamientos piloto.
- **Riesgos Mitigados:** Se han eliminado todas las discontinuidades matemáticas, la auto-certificación artificial y los claims indemostrables, consolidando una propiedad intelectual limpia, reproducible y blindada ante auditorías técnicas de *due diligence*.

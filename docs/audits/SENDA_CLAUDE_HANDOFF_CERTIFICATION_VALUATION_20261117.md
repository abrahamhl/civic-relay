# SENDA — Auditoría independiente de continuidad, seguridad y valor económico
Fecha: 17 noviembre 2026. Estado: **evaluación técnica parcial basada en código/CI; no auditoría de certificación ni tasación pericial**.

## 1. Procedencia y situación de ramas
- Producción / `master`: `b8360c9bdc30c0264bc4277d35f2c2ab5bce4e40` (despliegue Vercel observado). No confundir con módulos en PR.
- Claude PR #32, base `feat/senda-funding-mission-day1`: `632e9de69e330dbdd4a6b21f8146c5d54de9e41e` (17-11 00:59 UTC), 77 commits/290 archivos respecto a su base; **DRAFT, NO MERGE**. Commit funcional `b9d5ca9` añade `flood-isolation.mjs`, `radio-planner.mjs`, `water-nl.mjs` y fichas gubernamentales. GitHub Actions de este SHA: SENDA, Android APK, Chromium, CI, emergency-lab, todos SUCCESS. No equivalen a datos RF/hardware calibrados.
- Línea independiente del Agente 1: PR #34 (ruta sintética), PR #35 (dos procesos), PR #38 (journal experimental y riesgo de contactos), todos sin fusionar y dependientes unos de otros.
- Nuevo PR de seguridad (esta rama) se basa en **Claude PR #32**, no altera su HEAD; revisar/merge secuencial y con CI.
- No se recibió la respuesta textual de Claude en este mensaje; el historial GitHub y `docs/CUMPLIMIENTO.md` son la base verificable.

## 2. Matriz de capacidad real
| Capacidad | Código/ensayo | Clasificación hoy | Barrera |
|---|---|---|---|
| Envío offline entre móviles | `packages/senda/src/courier.mjs` + Chromium e2e; compartir línea/transferencia simulada | IMPLEMENTADA Y TESTEADA EN SOFTWARE | Sin enlace físico multiportadora transfronterizo medido |
| Reportes ciudadanos Ed25519 | `hazard-reports.mjs`, 160 caracteres firmados | IMPLEMENTADA Y TESTEADA EN SOFTWARE | Firma autocreada = integridad de mensaje, no identidad de usuario/autoridad ni antisybil fuerte |
| CAP restringido | `incidentToCap` | IMPLEMENTADA Y TESTEADA EN SOFTWARE; EJERCICIO | Nunca `Actual` sin emisor oficial autenticado |
| Centro de incidentes y geofusión | `incident-ops.mjs`, `atlas.mjs` | SIMULACIÓN CIENTÍFICA / software | Sin adopción de 112, clasificación AI/operativa por certificar |
| Aislamiento inundación | `flood-isolation.mjs`; OSM + EMSR773 | CÁLCULO CON DATOS EXTERNOS OBSERVADOS | OSM actual vs inundación histórica, agua urbana subdetectada, sin profundidad, puentes H3 |
| Planificador radio | `radio-planner.mjs`; ITU-R P.526 + DEM | SIMULACIÓN CIENTÍFICA | Sin medición RF, configuración antena y entorno urbano incompletos |
| Agua en NL | `water-nl.mjs`; 25 puntos RWS, correlación | CÁLCULO DE SNAPSHOT HISTÓRICO | Derechos/licencia y validez predictiva por revisar |
| Android de campo | `apps/senda-android/`; APK CI; además `experimental/android-nearby/` (prototipo diferente) | PROTOTIPO EXPERIMENTAL | Sin ensayo entre dos teléfonos físicos y sin integración radio interoperable |
| NTN, 112, redes críticas, RF terceros | Candidatos y simulación | BLOQUEADA POR PERMISOS O HARDWARE | Sin autorización, terminal compatible, contrato, validación de entrega |

## 3. Hallazgos P0/P1 y correcciones
- **P0-SEC-01 (corregido en rama de auditoría, pendiente de merge):** `hazard-reports.mjs` permitía firmar un reporte con coordenada 95°, fecha fuera del rango representable o conteo negativo; `DataView` puede truncar/envolver silenciosamente. Se añadieron validaciones fail-closed antes de firmar, validación tras verificar firma y casos adversariales.
- **P0-SEC-02 (corregido en rama de auditoría, pendiente de merge):** `incidentToCap(...,{exercise:false})` permitía `<status>Actual</status>` solo con parámetro del llamador, sin autoridad institucional. Ahora el exportador ciudadano **solo emite Exercise + Restricted**. Un verdadero `Actual` futuro requiere un adaptador de autoridad autenticada, PKI/roles, convenio y revisión.
- **P0-ARCH-01 (corregido en rama):** los módulos core y navegador están **copiados dos veces**. El test de paridad detectó divergencia al parchear solo el núcleo; se sincronizaron ambos archivos. Recomendación: generar la copia del navegador automáticamente desde un SHA fuente único y verificar hash en CI antes de exportar la web.
- **P0-TRUTH-01 abierto:** `assessIncident` acepta objetos `official` suministrados por el llamador y `canPublicWarn` puede ser true sin una cadena de validación criptográfica de la autoridad. **No usar canPublicWarn como permiso de publicación** hasta implementar la puerta de confianza; `CAP Actual` ya bloqueado en el exportador ciudadano.
- **P0-OP-01 abierto:** sin ensayos RF (2 teléfonos + 2 nodos EU868 autorizados) no existe prueba de red resiliente en desastres. No se recomienda operación ni certificación de seguridad pública.
- **P0-RELEASE-01 abierto:** proliferación de ramas y PR dependientes; `master` y producción están muy por detrás de Claude. Antes de lanzar un piloto, fijar integración canónica, revisión de licencias y manifiesto commit→build→datos→UI.
- **P1-DATA:** registro de procedencia, licencia, fecha de observación/ingesta, caducidad, hash, calidad e incertidumbre de cada capa. Un snapshot no es una fuente en vivo.
- **P1-DEFENSE:** mantener equipos/funciones de defensa de posible uso regulado separados de oferta civil; revisión jurídica antes de demos/pedidos.

## 4. Ruta de certificación: no hay una certificación única de SENDA
1. **Seguridad y privacidad:** análisis de amenazas, SBOM CycloneDX, dependencias, proceso de vulnerabilidades, política de actualizaciones, pentest externo, gestión de datos GPS/fotos y probable DPIA según uso. El CRA (UE 2024/2847) exige determinadas notificaciones desde 11-09-2026 a fabricantes en su ámbito y obligaciones generales desde 11-12-2027. La aplicabilidad comercial específica debe decidirse por producto, rol y distribución: https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
2. **Administraciones españolas:** ENS, RD 311/2022, aplica también a proveedores privados cuando sus sistemas prestan soluciones para funciones públicas bajo contrato; alcance, categoría y medidas deben ser definidos con la administración: https://www.boe.es/eli/es/rd/2022/05/03/311
3. **Equipo radio propio comercializado:** análisis CE/RED 2014/53/UE, bandas, compatibilidad EMC y documentación; el Reglamento Delegado 2022/30 tuvo aplicación desde agosto 2025 y el 2026/339 dispone su derogación desde el 11-12-2027 para evitar solapamiento con CRA: https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/radio-equipment-directive-red_en
4. **AI de clasificación de llamadas/respuesta de emergencias:** cuando se encuadre en el Anexo III 5(d) de AI Act, podría considerarse alto riesgo (evaluar funcionalidad real, rol y calendario, no asumir que todo algoritmo es AI): https://ai-act-service-desk.ec.europa.eu/en/essential-services
5. **Procedimientos voluntarios de gestión:** ISO/IEC 27001 (seguridad), ISO 22301 (continuidad), ISO 22320 (gestión de incidentes) como referencias posibles, sin afirmar certificación.
6. **Interoperabilidad:** CAP 1.2 y formatos sectoriales requieren perfiles/ensayos con el operador receptor; un XML sintácticamente correcto no equivale a interoperabilidad real con 112, ASTRID/C2000/SIRDEE ni a autoridad.
7. **Protección civil:** dossier de limitaciones, consentimiento, prueba de evacuación voluntaria, no daños a infraestructura, registro de fallos, DR tests, consentimiento de voluntarios, responsable de seguridad del ensayo e interlocutor institucional.

## 5. Propuesta de piloto I+D de 12 semanas (no compras operativas)
- S1–S2: congelar baseline, inventario SBOM/licencias/datasets, modelo de amenazas y simulador repetible, obtener responsables voluntarios y protocolos.
- S3–S5: dos teléfonos Android físicos y dos transceptores EU868 homologados, horarios/canales legales, banco de pruebas con degradación y relojes/energía/corrupción. Sin emergencias reales.
- S6–S8: >=30 intentos por escenario (idealmente >100 para estimación útil), recopilar intentos fallidos, latencia p50/p95, tasa de recepción, batería, RSSI y entorno; comparar con baseline FIFO y plataforma existente.
- S9–S10: auditoría de privacidad, revisión criptográfica de identidad y cancelación, riesgo de errores en mapas de inundación, test de corrupción y recuperación, pruebas UX con protección civil.
- S11–S12: demostración reproducible para organismo, métricas con intervalos, dossier CRA/ENS/RED según alcance, decisión GO/NO-GO y diseño de fase siguiente.
- Presupuesto de trabajo **orientativo a presupuestar**, no licitación: **90.000–180.000 €**, según dedicación de QA, telecom, geoespacial, seguridad, hardware y socio de campo. Oferta formal requiere desglosar jornadas, viajes, impuestos y responsabilidad.

## 6. Tasación: tres valores incompatibles que no deben mezclarse
**A. Valor de repositorio / activos vendibles hoy:** hipótesis negociable **15.000–100.000 €** por una cesión de código/documentación **si** los derechos, licencias y historial quedan saneados. Puede ser menor, incluso sin comprador, si nadie puede mantenerlo o explotar IP de terceros. No es una tasación de mercado respaldada por ofertas.
**B. Coste de reposición profesional de un prototipo semejante:** hipótesis **100.000–350.000 €** por reimplementar subconjuntos verificables, integrar GIS/Android, pruebas, documentación, derecho de uso de datasets y automatización. Es **coste**, no precio realizable; implica jornadas y tarifas comerciales, no equivale a volumen de commits.
**C. Valoración pre-money de una futura sociedad SENDA con fundadores/recursos, IP aclarada, 1–2 cartas de interés institucional, piloto contratado y diligencia técnica favorable:** escenario de negociación **0,8–2,5 M€**, **NO valor actual demostrado**. Sin tracción/estructura, no hay base suficiente para un número de equity fiable. En Q1 2026 PitchBook informó medianas pre-seed/seed europeas del orden de €6M para empresas financiadas; esa muestra selecciona startups que sí obtuvieron una ronda, y no es comparable con un repositorio experimental: https://pitchbook.com/news/articles/europes-vc-market-is-splitting-in-two-and-ai-is-driving-the-gap
- Sensibilidad: producto sin pruebas físicas ni acceso a canales críticos **fuerte descuento**; una única carta firmada de laboratorio/protección civil, y un protocolo medido repetible pueden mejorar negociabilidad más que miles de líneas nuevas.
- **Ningún valor cuenta subvenciones futuras como ventas presentes**.

## 7. Horizonte comercial verificado
- Horizon Europe Cluster 3 DRS-03 2027: 05-05-2027 a 04-11-2027, oportunidad de consorcio y decisión en crisis, no adjudicación automática: https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?frameworkProgramme=43108390&isExactMatch=true&order=DESC&pageNumber=1&pageSize=100
- CDTI NEOTEC 2026 cerrado 14-05-2026; requisitos de sociedad, edad y capital: https://www.cdti.es/ayudas/ayudas-neotec-2026
- EIC 2027 publica líneas para I+D e innovación; encaje real depende de personalidad jurídica, TRL, titularidad y evaluación: https://eic.ec.europa.eu/eic-funding-opportunities/eic-funding-opportunities-2027_en
- **Fe de erratas Claude:** `docs/financiacion/RUTAS_FINANCIACION_ES_NL_UE_2026-11.md` decía que no se verificó la convocatoria española 29-11-2026. Sí existe el **Real Decreto 806/2026 del BOE**, que establece explícitamente las elecciones el 29-11-2026: https://boe.es/buscar/doc.php?id=BOE-A-2026-20742 . El dossier comercial no debe extrapolar resultados ni atribuir colaboración institucional por el calendario político.

## 8. Valoración técnica provisional, hecha por criterio y sin falsa precisión
- Calidad del corpus/CI: **6,5/10** (muchos tests reales, pero ramas sin integrar ni revisión independiente).
- Veracidad de fuentes y geoespacial: **5,5/10** (datos reales y limitaciones, pero desfasajes/licencias/calibración pendientes).
- Fiabilidad RF y validación física: **1,5/10** (no hay medición sobre dos Android y radios; CI solo compilación).
- Seguridad, identidad y cumplimiento: **3,5/10** (criptografía real; límites de autoridad, riesgos de privacidad y pentest pendientes).
- Potencial funcional/diferenciación experimental: **7/10** (offline, acceso civil, inundaciones, radio, transporte, CI).
- Preparación comercial institucional actual: **3/10** (sin LOIs, contratos, certificación o adopción confirmados).
Las puntuaciones son una rúbrica cualitativa de auditoría técnica, no evaluación oficial ni pronóstico de ventas. **Estado global: prototipo de investigación presentable con divulgación de límites, NO producto apto para responder emergencias reales.**

## 9. Secuencia de PR y GO/NO-GO
1. Congelar y revisar Claude #32 (este paquete no debe sobrescribirlo).
2. Revisar PR aislado de seguridad + CI exacto; reemplazar duplicaciones del core/browser por build reproducible; no fusionar si test/paridad falla.
3. Plan de integración de #34→#35→#38 solo por cherry-picks auditados, evitando duplicar módulos ya escritos por Claude.
4. Verificación física Android/radio, sello de versiones y datos, convenio de pruebas, DPIA/threat model antes de piloto institucional.
5. Agente 2 de datos únicamente tras cierre formal de puertas P0 de Agente 1; usar fuentes públicas en el diseño hasta entonces.

**Condición de interpretación:** ninguna cifra de capitalización o euros de esta nota es oferta, tasación pericial, precio público cerrado ni retorno previsto. Solicitar revisión por experto independiente y comprador real para una valoración exigible.

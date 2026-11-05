# Civic Relay / OEP — Rutas de financiación, promoción y certificación

**Fecha:** 2026-11-05 · **Estado:** estrategia de trabajo (no es una solicitud enviada ni un compromiso de terceros) · **Nivel de evidencia del producto:** TRL ≈ 3, puntuación interna provisional 54/100 (`docs/audits/LATEST_ENGINEERING_STATUS.md`). Hoy no se ha enviado ningún correo, solicitud ni candidatura.

## 1. Diagnóstico en 30 segundos

| Fortaleza (ya construida) | Hueco que bloquea el dinero |
|---|---|
| Documentación y *truth gate* muy por encima de lo habitual en un prototipo; CI verde; SBOM; QA en Chromium | **0/20 en validación física**: ningún ensayo real móvil↔móvil (issues #4, #5) |
| Web trilingüe, Mission Control 3D, simulador (810 escenarios) | No hay entidad jurídica elegible ni consorcio ni cartas de intención |
| Postura honesta (no promete 112, satélite, radar) | Despliegue en producción desfasado del SHA de `master` (issue #6) |

**Idea fuerza:** quien financia I+D de seguridad no compra “más pantallas”, compra **reducción de riesgo técnico demostrada**. El siguiente euro de valor es una prueba física documentada, no más UI.

## 2. Rutas reales, ordenadas por ROI/viabilidad

| # | Ruta | Estado verificado (fuentes abajo) | Veredicto |
|---|---|---|---|
| 0 | **Prueba física con 2–3 móviles Android** (protocolo `docs/audits/HUMAN_ACTION_REQUIRED.md`, ≥30 intentos, fallos incluidos) | Depende solo de ti y de personas consentidoras | **Prioridad absoluta.** Coste estimado bajo (hardware de segunda mano); desbloquea todas las demás rutas y es el mejor material para vídeo |
| 1 | **Cartas de intención (LOI) de un ayuntamiento/Protección Civil y una universidad** para un piloto de 12 semanas (`docs/investor/PILOT_PROPOSAL.md`) | Sin contacto aún | Muy alto valor para cualquier convocatoria; coste: tu tiempo |
| 2 | **Horizon Europe CL3-2026-01 (SSRI-04 / DRS-03)** | Cierra **hoy 5-nov-2026 17:00 Bruselas** | **No realista en solitario.** Solo como socio de un consorcio existente; mirar siguiente ciclo |
| 3 | **Eurostars-3, call 12** | Abre 17-dic-2026, cierra 4-mar-2027 (según `docs/OEP_VALIDATION_…`; reconfirmar en RVO) | Buena ventana: da tiempo a la ruta 0 + 1 y a constituir una pyme |
| 4 | **Neotec (CDTI, España)** | Edición 2026 **cerrada** (14-abr a 14-may-2026); pyme ≤3 años, capital mínimo 20.000 €; la edición 2027 no está publicada | Preparar para la próxima edición; requiere entidad española |
| 5 | **ENISA (España), préstamo participativo Jóvenes Emprendedores** | Fuentes indican línea permanente (25–75 k€, sin avales, <41 años) pero **discrepan** y hay posible reorganización 2026 | Verificar en enisa.es antes de contar con ello |
| 6 | **EIC Accelerator** | Los cortes de 2026 han terminado (último 4-nov); *short application* continua; exige TRL 5–8 y pyme | Prematuro; objetivo para tras el piloto |
| 7 | **Países Bajos: WBSO / MIT / Innovatiekrediet / INNOWWIDE** | Ver `docs/investor/FUNDING_OPPORTUNITIES.md`; INNOWWIDE (hasta 1-dic) exige contraparte fuera de la UE | Solo si resides/estableces entidad NL |
| 8 | **NLnet / NGI** | Política GenAI v2.0 (desde 20-oct-2026) prohíbe redactar solicitudes con IA y artefactos financiados generados por IA | **Bloqueada** salvo candidatura 100 % humana y plan de trabajo compatible |
| 9 | **Ingresos no dilutivos tempranos:** GitHub Sponsors/Open Collective, contratos pequeños de consultoría de resiliencia, estudios de viabilidad pagados | Sin verificar | Complementario; no sustituye a las rutas anteriores |

**Contratación pública:** no es la vía hoy. Licitar exige entidad, referencias y normalmente certificaciones; el camino realista es *piloto → referencia → contrato*.
**Inversión privada:** un *pre-seed* tiene sentido **después** de la ruta 0 con vídeo y datos; antes, la valoración solo puede ser baja y el discurso “honesto” no encaja con el modelo de pitch estándar. Ángeles con perfil govtech/civil-tech/dual-use son el público correcto.

## 3. ¿Presentarlo al canal de Calero / CarWow o de forma institucional?

**Mi recomendación: institucional primero, divulgación después, y no “contra la V16”.**

- **Hecho verificado:** la baliza V16 conectada es obligatoria en España desde 1-ene-2026 y existe polémica pública (fraude de balizas no homologadas, privacidad, ser un caso único). Una fuente de Carwow cita a J. F. Calero entre las voces críticas, pero **no he podido verificar su postura concreta**, así que no la atribuyo.
- **Riesgo estratégico:** tus compradores y validadores (DGT, Protección Civil, ayuntamientos, universidades) son los mismos que respaldan la V16. Colgarte de una campaña contra ella te posiciona como adversario de quien debe firmar tus LOI. El producto tampoco es una V16: no hay vehículos ni balizas en el repositorio hoy (ver §6).
- **Lo que sí funciona con ese público:** un ángulo constructivo (“¿y si no hay cobertura? continuidad de comunicaciones”), un **vídeo de la prueba física real** y un contacto personal. Hasta tener esa prueba, un canal de 1 M de suscriptores solo amplificaría un prototipo simulado y pondría el truth gate a prueba en público.
- **Orden propuesto:** (1) prueba física → (2) 2 LOI → (3) reel v2 con metraje real → (4) divulgación (Calero, CarWow, prensa tech) con demo reproducible → (5) pre-seed/Eurostars.

## 4. Certificación: qué existe y qué no

No hay “certificado de tecnología” automático para un repo. Camino honesto (detalle en `docs/OEP_VALIDATION_CERTIFICATION_AND_FUNDING_2026.md`):

1. **Evidencia reproducible** (hoy): CI, SBOM, matriz de verdad → ya hecho.
2. **Pruebas físicas independientes** (ruta 0), con tercero que firme el informe.
3. **Pentest independiente + DPIA + revisión del modelo de amenazas** (issue #4).
4. **ETSI (CTI / Plugtests NG112)**: interoperabilidad, solo si hay interfaz relevante; no es un certificado.
5. **ISO/IEC 27001** (organización) y **EUCC/Common Criteria** (producto, con TOE definido): fase posterior, requieren entidad y presupuesto.
6. **Cyber Resilience Act**: consultar a un jurista si habrá versión comercial.
Cualquier material público debe evitar “certificado”, “homologado” o “validado” mientras no exista el informe externo.

## 5. Plan 30/60/90 días

- **0–30 d:** comprar/reunir 3 móviles Android; ejecutar y grabar el protocolo (≥30 intentos); decidir país/forma jurídica; cerrar el issue #6 (despliegue = `master`); enviar 10 mensajes de contacto a ayuntamientos/universidades (revisados por ti).
- **30–60 d:** 2 LOI; reel v2 con metraje del ensayo; pentest/DPIA presupuestados; constituir entidad.
- **60–90 d:** preparar Eurostars-3 (consorcio con 1–2 socios), Neotec/ENISA según país, y ronda ángel pequeña con datos reales.

## 6. Qué falta para que “los coches” entren en el relato

El repositorio (rama `master`, 4c310f7) **no contiene integración de vehículos**: los últimos commits son visión maestra, rutas `vision-master` y correcciones de Vercel; la única mención a “vehículo” es de privacidad de cámaras. Si ese trabajo está en otra rama, repo o conversación, hay que traerlo. Si se añade, hace falta además un análisis regulatorio específico (p. ej. homologación/ciberseguridad de vehículos UNECE R155/R156, eCall) que **no está verificado aquí**.

## 7. Reel de 60 s

- Archivo: `media/civic-relay-reel-60s.mp4` (1920×1080, 30 fps, 60 s, ~15 MB) · subtítulos/guion de locución: `media/civic-relay-reel-60s.srt` · reproducible con `scripts/reel/`.
- **“Real” significa:** capturas reales de la web ejecutándose (build local de `investor-next`), sin metraje de stock ni de terceros. **No incluye** fotos/vídeo de coches, emergencias ni logos de terceros, que no poseemos ni tenemos derecho a usar.
- Rótulo permanente: “Simulación · TRL ≈ 3 · No es un servicio de emergencias”.
- Banda sonora: un colchón sintético generado, sin derechos de autor; se puede sustituir por locución real (guion en el `.srt`).
- Limitación: la escena 11 usa una captura en inglés (evidencia P03).

## Fuentes consultadas (2026-11-05)
- Neotec 2026: https://www.ciencia.gob.es/Convocatorias/2026/NEOTEC2026.html y https://www.cdti.es/ayudas/ayudas-neotec-2026
- EIC Accelerator 2026 (cortes y short application): https://hub.causo.ai/guides/how-to-apply-to-eic-accelerator-2026 (fuente secundaria; confirmar en el portal EIC)
- V16 conectada: https://rtvc.es/la-baliza-v16-sera-obligatoria-desde-el-1-de-enero-de-2026-9-diciembre-2025/ y https://www.carwow.es/noticias/6529/baliza-v16-obligatoria-2026-polemica-dgt
- ENISA Jóvenes Emprendedores (fuentes secundarias, discrepantes): https://www.pertamapartners.com/funding/enisa-young-entrepreneurs-loan-spain-2026 → verificar en enisa.es
- Resto de convocatorias: documentos del repositorio ya citados, no reverificados hoy.

**Confianza: ~75 %** (alta en estado del repo y fechas citadas; media en ENISA/EIC por fuentes secundarias; las cifras de coste y el orden de rutas son criterio propio).

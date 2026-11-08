# SENDA · Preparación de la ronda de financiación (05-11-2026)

> **Firma:** Asistente de Orquestación Senior (Claude), sesión v0.18.
> **Flujo:** entrada → procesamiento → validación → salida, listo para que lo retome cualquier agente.
> **Estado de los datos:**
> - Cada fecha y cada importe llevan su fuente.
> - Lo que no pudimos confirmar en una fuente oficial va marcado **«pendiente de verificar»**.
> - Una convocatoria relevante no es una ayuda concedida; un interés de un socio no es un consorcio.
>
> Este documento **actualiza** y no sustituye a `docs/FUNDING_LEADS_2026.md` (20-10-2026), `docs/OEP_INVESTOR_DILIGENCE_AND_PITCH.md` y `docs/investor/`.
>
> **La última palabra sobre alcance, licencia, marca, precio y promesas públicas es del fundador.**

---

## 0. Resumen en seis líneas

1. **Hoy, 05-11-2026, cierran las convocatorias de Horizon Europe Cluster 3 de 2026** (sociedad resiliente ante desastres, DRS-01 a DRS-05). No es realista presentarse hoy: exigen consorcio con organismos de emergencia. El objetivo es **entrar en un consorcio para la convocatoria de 2027** (apertura prevista 05-05-2027, cierre 04-11-2027; pendiente de verificar).
2. **Abierto ahora mismo y alcanzable:**
   - el **12.º Hackathon CASSINI** «EU Space for Peace and Resilience» (27-29-11-2026; inscripción hasta el 20-26-11, según la fuente);
   - la **propuesta corta del EIC Accelerator** (continua);
   - **ESA BIC Comunidad de Madrid** (convocatoria abierta, corte pendiente de verificar);
   - **ENISA** (préstamo participativo, continuo).
3. **Todo lo anterior salvo el hackathon exige una empresa constituida.** Hay que confirmar si SENDA ya es una sociedad: es la primera pregunta para el fundador.
4. **El mayor hueco ante un inversor no es técnico, es de tracción:** no hay piloto de campo ni cartas de interés firmadas. Hay que conseguir **2-3 cartas de interés** (Protección Civil municipal, una agrupación de voluntarios, una concesionaria o una flota) y **una prueba de campo medida**.
5. **Lo técnico es un punto fuerte y verificable:**
   - 207 pruebas del núcleo y el relé;
   - 46 comprobaciones de extremo a extremo sin red en Chromium real;
   - 25 pantallas auditadas en accesibilidad;
   - vídeo real procesado;
   - todo con su fuente.
6. **Riesgos legales que un inversor preguntará:**
   - licencia MIT (cualquiera puede copiar el código);
   - Ley de IA (la priorización de emergencias puede ser de alto riesgo);
   - RGPD (evaluación de impacto);
   - Esquema Nacional de Seguridad para vender a la Administración.

   Cada uno tiene su respuesta en el apartado 4.

---

## 1. Convocatorias y campañas: qué está abierto, qué viene y qué ya pasó

### 1.1 Abiertas ahora (05-11-2026)

| Convocatoria | Qué es | Plazo | Encaje con SENDA | Requisito clave | Fuente |
|---|---|---|---|---|---|
| **12.º CASSINI Hackathon** «EU Space for Peace and Resilience» | Hackathon de la UE sobre espacio para seguridad y resiliencia: observación de la Tierra (Copernicus) y Galileo | Ideas: 2-13-11 · hackathon: **27-29-11-2026** · demo: 02-12. Inscripción hasta el 20-11 o el 26-11, según la fuente | **Muy alto.** El seguimiento de incendios con FIRMS/Copernicus, la triangulación con móviles y los avisos a coches son exactamente el tema | Equipo; no exige empresa | [Cassini](https://www.cassini.eu/hackathons/node/106) · [IEEC](https://www.ieec.cat/en/?p=43657) · [catálogo UE](https://digital-skills-jobs.europa.eu/en/learning-space/training-catalogue/12th-cassini-hackathon-eu-space-technology-peace-and-resilience) |
| **EIC Accelerator, propuesta corta** | Subvención y capital del Consejo Europeo de Innovación para pymes de tecnología profunda | **Continua.** Los cortes de 2026 para la propuesta completa terminaron el 04-11-2026; los de 2027, en el programa de trabajo de 2027 | Medio-alto, si se demuestra un diferencial científico y tracción | Pyme constituida; evaluación remota en 4-6 semanas | [FAQ oficial EIC](https://eic.ec.europa.eu/eic-frequently-asked-questions/faqs-eic-accelerator_en) · [Zabala](https://www.zabala.eu/news/eic-accelerator-2026-updates/) |
| **ESA BIC Comunidad de Madrid** | Incubación de la Agencia Espacial Europea con madri+d: ayuda y espacio | Abierta con fechas de corte. Una fuente da el 31-12 y otra el 26-01 (**pendiente de verificar** en madrimasd.org) | **Alto:** SENDA usa tecnología espacial (satélites de incendios, Galileo, Iridium) para una aplicación no espacial | Empresa de menos de 5 años. Importe de hasta 50.000 € según una fuente (**pendiente de verificar**) | [emprendedores.es](https://emprendedores.es/ayudas/esa-bic-comunidad-de-madrid/) · [ecosistemastartup](https://ecosistemastartup.com/convocatorias/esa-bic-madrid-region-2026) |
| **ENISA, préstamo participativo** | Préstamo sin avales ni garantías personales, a medio camino entre deuda y capital | Continua; resolución en 2-4 meses | Alto como primer dinero no dilutivo | Empresa constituida y fondos propios: el 50 % de lo solicitado en Jóvenes Emprendedores, el 100 % en general. Importe de 25.000 a 75.000 € en Jóvenes Emprendedores (las fuentes difieren: **pendiente de verificar** en enisa.es) | [infoautonomos](https://www.infoautonomos.com/ayudas-subvenciones-autonomos/enisa) · [ecosistemastartup](https://ecosistemastartup.com/prestamo-enisa-2026-hasta-15me-sin-ceder-equity/) |
| **Certificación de empresa emergente** (Ley 28/2022) | Sello de ENISA con ventajas fiscales: 15 % en el Impuesto sobre Sociedades, entre otras | Continua | Alto: abarata la ronda para los inversores | Requisitos de los arts. 3-6 de la ley; Orden PCM/825/2023 | [Pérez-Llorca](https://www.perezllorca.com/wp-content/uploads/2023/01/Nota-Juridica-Ley-de-Startups.pdf) · [Legálitas](https://www.legalitas.com/actualidad/certificado-enisa-para-startups) · [BOE-A-2022-21739](https://www.boe.es/buscar/act.php?id=BOE-A-2022-21739) |

### 1.2 Cierran hoy (sin opción realista)

- **HORIZON-CL3-2026-01-DRS-01 a DRS-05** (sociedad resiliente ante desastres). Presupuestos indicativos de 4,5 a 8 M€ por tema.
- **SSRI-01 y SSRI-04** (sistema europeo de comunicaciones críticas).
- **Cierre:** 05-11-2026; el punto de contacto austriaco da el 12-11, así que hay que confirmarlo en el portal.
- **Requisitos:**
  - en DRS-04, tres organismos de primera respuesta o de gestión de riesgos de **tres países** como beneficiarios;
  - en SSRI-04, tres organizaciones de primera respuesta.
- **Fuentes:** [REA](https://rea.ec.europa.eu/funding-and-grants/horizon-europe-cluster-3-civil-security-society/disaster-resilient-society-europe_en) · [FFG](https://www.ffg.at/en/europe/heu/cluster3/calls/2026/01) · [IUK](https://iuk-business-connect.org.uk/opportunities/horizon-europe-2026-27-civil-security-for-society-cluster-3/) · `docs/FUNDING_LEADS_2026.md`.

### 1.3 Próximas ventanas (preparar desde ya)

| Convocatoria | Ventana prevista | Por qué importa | Fuente |
|---|---|---|---|
| **Horizon Europe CL3 2027** (DRS-01: sistemas de apoyo a la decisión en crisis; DRS-02: resiliencia social, jóvenes e innovación digital) | Apertura 05-05-2027 y cierre 04-11-2027 según agregadores (**pendiente de verificar** en el portal) | DRS-01 y DRS-02 encajan con el mapa operativo y con la red ciudadana. Se entra **como socio tecnológico** de un consorcio | [euacc.ai](https://www.euacc.ai/calls/HORIZON-CL3-2027-01-DRS-02) · [Weizmann](https://www.weizmann.ac.il/RGP/content/eu-horizon-europe-civil-security-society) |
| **NEOTEC (CDTI)** | 2026: del 14-04 al 14-05. Se espera una ventana similar en 2027 (**pendiente**) | Hasta el 70 % y un máximo de 250.000 €; presupuesto financiable de 175.000 a 750.000 € | [Ministerio](https://www.ciencia.gob.es/Convocatorias/2026/NEOTEC2026.html) · [CDTI FAQ](https://www.cdti.es/sites/default/files/2026-04/faq_neotec_2026_v1.0.pdf) |
| **UCPM KAPP** (Mecanismo de Protección Civil de la UE: prevención y preparación) | 2026: del 18-02 al 19-05. La de 2027 aún no está publicada | Proyectos de prevención con autoridades de protección civil | [UCPKN](https://civil-protection-knowledge-network.europa.eu/2026-kapp-calls-proposals-open) |
| **NATO DIANA** (cohorte 2028) | La de 2027 cerró el 03-07-2026; la siguiente aún no tiene fecha | Programa de doble uso. **Decisión del fundador:** encaja con la resiliencia civil, pero tiene implicaciones de imagen | [Enspire Oxford](https://enspire.ox.ac.uk/event/nato-defence-innovation-accelerator-diana-2027-cohort) |
| **MIT (Países Bajos)**: viabilidad, I+D y bono | 2026 cerró en septiembre; 2027 por publicar (es regional) | Para la entrada en NL con un socio neerlandés | [RVO MIT](https://www.rvo.nl/subsidies-financiering/mit) · [Hezelburcht](https://www.hezelburcht.com/nieuws/mit-haalbaarheid-opent-naar-verwachting-op-7-april-2026/) |
| **Comunidad de Madrid** (startups de base científica y tecnológica, Cheque Innovación) | 2026 cerrada (abril); el Cheque Innovación figura como abierto en el portal, con fechas contradictorias | Apoyo regional | [comunidad.madrid/inversion/innova](https://www.comunidad.madrid/inversion/innova) |
| **Compra Pública de Innovación (CPI)** | Consultas preliminares del mercado (art. 115 de la LCSP) publicadas por cada organismo | La vía natural para vender a la Administración. Modelo de referencia: INCIBE. Hay que vigilar la Plataforma de Contratación y a ASEM 112, DGT y Protección Civil | [INCIBE CPI](https://www.incibe.es/industria-cpi) · [BOE 13-11-2025](https://boe.es/boe/dias/2025/11/13/pdfs/BOE-A-2025-23003.pdf) |

### 1.4 Inversores y fondos con tesis cercana (para la lista de contactos)

- **CDTI Innovación:** 1.817 M€ previstos para 2026 en ayudas, capital riesgo, compra pública y préstamos, con refuerzo explícito de **tecnologías profundas y de doble uso**. [capital-riesgo.es](https://capital-riesgo.es/en/articles/cdti-innovaci-n-will-allocate-up-to-1-817-billion-in-2026-in-grants-venture-capital-investment-public-procurement-and-soft-loans-for-business-r-d-i-technology-transfer-and-scaling/)
- **Nazca Aeroespacial y Defensa Innvierte I:** el CDTI comprometió hasta 294 M€ como inversor ancla; el fondo busca **doble uso**. Hay que confirmar si invierte en fase semilla (**pendiente**). [Nazca](https://www.nazca.es/en/noticias/nazca-secures-e294-million-from-cdti-for-its-fund-nazca-aeroespacial-y-defensa-innvierte-i/)
- **Pendiente de investigar, sin inventar nombres:**
  - fondos de impacto y *govtech* en España y Países Bajos;
  - aseguradoras con vehículo de inversión, porque el riesgo de incendio y de carretera es su negocio;
  - aceleradoras de movilidad.

  Cada contacto se valida con su web oficial antes de escribir.

---

## 2. Qué busca un inversor en semilla, aplicado a SENDA

Marco habitual de diligencia en semilla: **equipo, mercado, producto, números y aspectos legales** ([guía de diligencia semilla 2026](https://hub.causo.ai/guides/vc-due-diligence-checklist-seed-2026)).

En fase temprana basta un **data room ligero**: presentación, equipo, hoja de ruta y piloto ([lista de a16z según Papermark](https://www.papermark.com/blog/a16z-data-room-checklist.md)). Los retrasos suelen venir de la **propiedad intelectual mal asignada** y de un **cap table** desordenado ([Papermark](https://www.papermark.com/blog/startup-data-room-checklist)). Son fuentes de proveedores: tómalas como orientación.

| Carril | Qué preguntará | Dónde está SENDA hoy | Qué falta (acción) |
|---|---|---|---|
| **Equipo** | ¿Quién construye y vende? ¿Hay experiencia en emergencias? | Fundador con visión y producto muy avanzado en código | Cofundador técnico o comercial **o** 2-3 asesores con experiencia real: 112, bomberos forestales, DGT. Escrito y firmado |
| **Mercado** | ¿Quién paga? ¿Cuánto? ¿Ciclo de venta? | Clientes posibles: ayuntamientos y CCAA (B2G), concesionarias y flotas (B2B), fabricantes de coches por la Ley de Datos, aseguradoras | Tamaño de mercado **con fuente** (pendiente: no inventar cifras); precio por municipio y por flota; ciclo de venta B2G de 6-18 meses (pendiente de verificar con un caso) |
| **Producto** | ¿Funciona fuera del laboratorio? ¿Madurez (TRL)? | TRL 3-4 en la mayoría de módulos: simulación y laboratorio. App web sin red demostrada en Chromium real; vídeo real procesado | **Una prueba de campo medida** (ver el apartado 3) y el registro de evidencias actualizado (`docs/investor/EVIDENCE_REGISTER.md`) |
| **Números** | Uso de fondos, meses de vida (*runway*), hitos | Escenarios en `docs/investor/FINANCIAL_SCENARIOS.md` | Presupuesto de 18 meses por hitos: piloto, app nativa, ENS, primer contrato |
| **Legal** | Propiedad intelectual, licencia, datos personales, regulación | Licencia MIT; política PASIVO / CONVENIO / NUNCA documentada en el código | Cesión de propiedad intelectual a la sociedad; decisión de licencia; evaluación de impacto RGPD; análisis de la Ley de IA y del ENS (apartado 4) |

**Lo que diferencia a SENDA y conviene enseñar primero:**
- Funciona **sin red** de verdad: hay pruebas automáticas en el navegador con la red cortada.
- **No inventa:** cada dato real lleva fuente y cada simulación se marca como tal.
- **Respeta la ley por diseño:**
  - nunca intercepta ni emite sin licencia;
  - nunca detecta radares;
  - nunca escucha las radios de emergencia;
  - nunca usa cámaras privadas.
- **Encaja con la regulación europea:** la Ley de Datos (12-09-2025), DFRS, los Puntos de Acceso Nacionales y CAP.
- **Caso real con fuentes:** el incendio de San Martín de Valdeiglesias empezó con un coche en llamas en la M-501. Es el flujo de `/senda/fuego`.

---

## 3. Ajustes al software para conseguir financiación (priorizados)

### P0: 2 a 6 semanas, los que mueven la decisión

1. **Prueba de campo medida (el hito que más vale).**
   - **Formato:** 20 voluntarios, 2 horas, cobertura apagada o zona sin señal.
   - **Métricas:**
     - tiempo hasta el primer SOS localizado;
     - % de mensajes entregados por cada camino (sonido, malla, mula);
     - error de posición;
     - batería consumida.
   - **Base existente:** `investor-next/scripts/validate-field-trials.mjs` y `docs/PILOT_GUIDE.md`.
   - **Salida:** un informe firmado con los datos en bruto.
2. **Cartas de interés.**
   - Plantilla en `docs/OEP_PARTNER_OUTREACH_PACK_2026.md`.
   - Objetivo: 2-3 cartas. Por ejemplo: la Protección Civil de un municipio de la Sierra Oeste, una agrupación de voluntarios y una flota o concesionaria.
3. **Métricas de producto con consentimiento.**
   - Contadores anónimos (k ≥ 5) de instalaciones, uso sin red y entregas, siguiendo el `privacyGate` del núcleo.
   - Sin esto no hay gráfico de tracción.
4. **Datos en vivo en la demo.**
   - Conectar FIRMS (clave gratuita), AEMET OpenData (clave gratuita) y el NAP de la DGT en el relé, con caché.
   - Hoy la demo usa muestras etiquetadas porque el entorno de desarrollo bloquea esos dominios.
5. **Paquete de seguridad para la diligencia técnica.**
   - Lista de componentes (SBOM) y auditoría de dependencias.
   - Modelo de amenazas actualizado (`docs/THREAT_MODEL.md`) y escaneo de secretos.
   - Plan de pruebas de intrusión.

### P1: 2 a 4 meses, para B2G y B2B

6. **Panel para organismos con varios clientes (multi-tenant)**, con roles, auditoría encadenada y exportación CAP 1.2 validada contra un entorno de pruebas de un 112, por convenio.
7. **Integración por convenio** con un organismo: torres INFOMA, DGT 3.0 o un municipio. Una sola integración real vale más que diez simuladas.
8. **App nativa Android**: BLE entre coches, Wi-Fi Aware y servicio en segundo plano. La web no puede hacer BLE entre teléfonos.

### P2: 4 a 12 meses, para escalar

9. **Esquema Nacional de Seguridad** (RD 311/2022), obligatorio para prestar servicios a la Administración española, e ISO 27001 si hay clientes privados.
10. **Ley de IA** (Reglamento (UE) 2024/1689).
    - Los sistemas que evalúan o clasifican llamadas de emergencia o priorizan el envío de servicios de emergencia figuran entre los de **alto riesgo** (anexo III).
    - La criticidad de SENDA es un **criterio con reglas, no aprendido, y solo ordena avisos**.
    - Aun así, se necesita un **análisis jurídico** antes de venderlo a un 112 (**pendiente**).
11. **Licencia.**
    - Con MIT, cualquiera puede copiar el núcleo.
    - Opciones: mantener MIT y vender servicio, datos y convenios (núcleo abierto), o licencia dual para módulos nuevos.
    - **Decisión del fundador.** Ver `docs/IP_OPEN_SOURCE_2026.md`. La marca SENDA se puede registrar aparte.

---

## 4. Riesgos que preguntará un inversor y respuesta preparada

| Riesgo | Respuesta |
|---|---|
| «Es solo una demo» | Pruebas automáticas sin red, vídeo real procesado y casos reales con fuente. **Siguiente:** la prueba de campo del P0-1 |
| «La Administración tarda años en comprar» | Tres vías en paralelo: CPI, convenios piloto financiados con convocatorias (Horizon/UCPM con socios) y clientes privados (flotas, concesionarias, aseguradoras), que compran más rápido |
| «El código es MIT; os copiarán» | El valor está en los convenios, la red instalada, los datos con permiso, la marca y la velocidad de ejecución. La licencia de los módulos nuevos la decide el fundador |
| «Responsabilidad si falla un aviso» | SENDA es un **canal secundario**: no sustituye al 112, ES-Alert ni eCall. Lo dicen la interfaz, los contratos y los registros de auditoría |
| «Privacidad» | Privacidad por diseño: k-anonimato, sin imágenes fuera del teléfono, sin reidentificación de vehículos, sin escucha de radios. Falta la evaluación de impacto RGPD formal (P0-5) |

---

## 5. Índice del data room (carpetas y qué va en cada una)

Ya está montado en `entrega/` (ver `entrega/LEEME_PRIMERO.md`):

1. **01 · Presentación:** `docs/investor/ONE_PAGE_PITCH.md`, `docs/investor/EXECUTIVE_SUMMARY.md` y la película (`media/senda-film-*.mp4`).
2. **02 · Producto y evidencias:**
   - página de estado `/senda/estado` y `estado.json`;
   - informes E2E en `investor-next/test-results` (si existen);
   - `docs/investor/EVIDENCE_REGISTER.md`;
   - vídeos de visión real.
3. **03 · Tecnología:**
   - `docs/architecture/`;
   - `docs/handoff/HANDOFF_COMPLETO_2026-11-05.md`;
   - `docs/THREAT_MODEL.md`;
   - `docs/investor/TECHNICAL_DUE_DILIGENCE.md`.
4. **04 · Mercado y financiación:**
   - este documento;
   - `docs/FUNDING_LEADS_2026.md`;
   - `docs/investor/FUNDING_OPPORTUNITIES.md`;
   - `docs/investor/FINANCIAL_SCENARIOS.md`.
5. **05 · Legal:**
   - `LICENSE` (MIT);
   - `docs/IP_OPEN_SOURCE_2026.md`;
   - política PASIVO / CONVENIO / NUNCA (`packages/senda/src/platforms.mjs`);
   - **pendiente:** escrituras, cap table y cesión de propiedad intelectual (los aporta el fundador; no están en el repositorio).
6. **06 · Piloto:** `docs/PILOT_GUIDE.md`, `docs/investor/PILOT_PROPOSAL.md` y, cuando exista, el informe de la prueba de campo.

---

## 6. Plan de 90 días

| Semana | Acción | Responsable | Salida |
|---|---|---|---|
| 1 | Confirmar si la sociedad está constituida, con su cap table | Fundador | Sí/no y datos |
| 1-2 | Inscribirse en el **CASSINI Hackathon** (27-29-11) con el flujo de `/senda/fuego` | Fundador + equipo | Inscripción |
| 1-3 | Pedir la **certificación de empresa emergente** y preparar **ENISA** | Fundador + asesor | Solicitudes |
| 2-4 | Prueba de campo de 2 horas con 20 voluntarios | Fundador + agrupación de voluntarios | Informe con datos |
| 2-6 | 2-3 cartas de interés | Fundador | Cartas firmadas |
| 3-6 | **ESA BIC Madrid**: candidatura (con el corte confirmado) | Fundador | Candidatura |
| 4-8 | **EIC Accelerator**: propuesta corta, con prueba de campo y cartas | Fundador + consultor | Propuesta |
| 6-12 | Buscar coordinador de consorcio para **Horizon CL3 2027** (DRS-01/02) a través de los puntos de contacto nacionales (RVO en NL; CDTI en España) | Fundador | Carta de adhesión |

---

## 7. Nota de confianza

**Confianza: 78 %.**
- **Alta:** el estado técnico (lo verifican las pruebas del repositorio) y las convocatorias con página oficial (EIC, REA, UCPKN, Ministerio, CDTI).
- **Media:** las fechas que solo dan agregadores (CL3 2027, ESA BIC Madrid, inscripción de CASSINI) y los importes de ENISA, porque las fuentes difieren. Todas van marcadas como «pendiente de verificar».
- **Baja:** el tamaño de mercado y los nombres de fondos de impacto. No se incluyen a propósito para no inventar.

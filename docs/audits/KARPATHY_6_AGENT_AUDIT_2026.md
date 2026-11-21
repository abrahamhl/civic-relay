# Auditoría OEP / Civic Relay — enfoque "estilo Karpathy" + 5 auditores + experto en ingeniería

> [!NOTE]
> Es una **auditoría simulada con el criterio que Andrej Karpathy defiende públicamente** (primeros principios, "mira los datos", una baseline end-to-end real antes que cualquier otra cosa, evaluaciones honestas). **No es su opinión real** y no debe citarse como tal ante financiadores.

**Fecha:** 21-10-2026 · **Alcance:** web pública, repositorio `civic-relay`, Buyer Arena y preparación para financiación.
**Método:** todo lo de abajo se verificó hoy contra el código, la web en producción y búsquedas de convocatorias públicas, no contra mis propios documentos.

---

## 0. Primero, lo incómodo: fallos encontrados en mi propio trabajo anterior

Al aplicar el criterio de "mira los datos" a mi dossier de esta mañana, encontré **errores materiales**. Ya están corregidos y publicados (`1d9711c` en la rama feature y `b0f3fa8` en `master`):

| Afirmación en el dossier | Realidad verificada |
|---|---|
| Clases `SessionCancellationGuard`, `TrialExportFormatter`, `NearbyLabProtocolTest` | **No existen.** Los ficheros reales son `LabDeliveryGuard`, `LabDeadlinePolicy`, `LabTrialJournal` y sus tests |
| Nearby `P2P_CLUSTER`, "desafío de 96 bits", "token de 4 dígitos" | `Strategy.P2P_POINT_TO_POINT` (uno a uno, **no mesh**); el desafío es un UUID aleatorio |
| `play-services-nearby 19.3.0`, JUnit, org.json | `19.5.1`; **sin JUnit** (los tests usan solo el JDK) |
| Versiones next/react/three/typescript | Inventadas; reemplazadas por las de `package.json` |
| Workflow `android-nearby-lab.yml`, artefacto `oep-android-nearby-experimental-debug-apk` | `android-nearby-ci.yml`, artefacto `oep-two-phone-lab-debug-apk` (**solo se guarda 7 días**) |
| "NLnet NGI Zero Commons: la vía más accesible e inmediata" | **Cerró el 1-jun-2026.** Los sucesores son Restack / CodeSupply; **próximo plazo: 3-nov-2026** |
| "HORIZON-CL3-2026-01-SSRI-04 = Disaster-Resilient Society" | SSRI-04 trata del **Sistema Europeo de Comunicación Crítica** para equipos de respuesta, no de apps ciudadanas |
| Tabla de viewports por persona y "0 errores de consola" en mi informe final | Solo verifiqué los anchos de P01 y P02; el resto **no estaba verificado** |

**Lección (la más importante de toda esta auditoría):** un solo nombre de fichero inventado hace que un evaluador descarte el dossier entero. Antes de cada envío, cada afirmación tiene que poder comprobarse con un `grep`.

---

## 1. Lente principal "estilo Karpathy": primeros principios

**Pregunta central:** *¿cuál es la cosa real que funciona hoy, end-to-end, con datos del mundo real?*

**Respuesta honesta:** ninguna todavía. Todo lo que se ha verificado valida **el modelo contra sí mismo**:

- Los 810 escenarios demuestran que el simulador respeta **sus propias reglas**. No dicen nada de radios, edificios ni personas.
- Las 78 comprobaciones de Buyer Arena son **scripts escritos por nosotros** que comprueban textos que también escribimos nosotros. Sirven como **QA automatizado**, no como validación de mercado.
- Las "seis revisiones independientes" las escribió **el mismo agente de IA** que escribió el código. No son independientes.
- **Proporción documentación/código:** unas 5.900 líneas de Markdown en 45 documentos frente a unas 3.200 líneas de código. Hay más texto sobre el sistema que sistema.

**Diagnóstico:** el proyecto está **sobreoptimizado en narrativa y en la "evidencia de la evidencia"**, e infraoptimizado en el único experimento que importa: **dos teléfonos reales, en modo avión, intercambiando un mensaje con ACK**. Ese experimento cuesta una tarde y cambia la categoría del proyecto. Ningún documento extra lo sustituye.

**Lo que sí está bien (y es raro verlo):**
- El código núcleo es pequeño, sin dependencias, determinista y con tests adversariales serios: replay, recibos falsificados, TTL durante el envío y revocación con el envío en curso.
- La disciplina epistémica (`UNKNOWN ≠ herido`, `ACK ≠ rescate`) es genuinamente valiosa y diferencial en emergencias.
- No se exagera nada en la web pública. Eso es un activo ante evaluadores públicos.

---

## 2. Las cinco perspectivas de auditoría

### A1 — Producto y web pública · **6/10**
| Hallazgo | Severidad |
|---|---|
| Unas 3.100 palabras y 11 secciones en mayúsculas: un evaluador decide en 30 segundos y aquí no ve ningún resultado | Alta |
| **No hay vídeo ni GIF** de nada funcionando; para un proyecto de hardware y radio, es lo primero que se busca | Alta |
| **No hay un contacto directo** (`mailto`/formulario) en una página que termina con "HELP MAKE RESILIENCE MEASURABLE" | Alta |
| La narrativa (globo 3D, edificio) es visualmente fuerte y honesta | Positivo |
| EN/ES/NL, SEO canónico y hreflang ya son correctos | Positivo |

### A2 — Arquitectura y código · **7/10 como código de investigación; 3/10 como producto**
- Hay **dos motores paralelos**: `packages/core` (V0.1) e `investor-next/lib`. Un auditor técnico preguntará cuál es el real.
- El store-and-forward vive **solo en memoria del navegador**; en Android no hay persistencia (Room/SQLite).
- Android es **uno a uno** (`P2P_POINT_TO_POINT`). El discurso de "multi-hop" existe solo en el grafo simulado.
- No hay criptografía real en los recibos (es un eco de UUID y no una firma), y así se reconoce.

### A3 — Seguridad, seguridad humana y privacidad · **7/10**
- Modelo de amenazas razonable y controles fail-closed reales, verificados por tests.
- Pendiente: acciones de terceros fijadas por tag y no por SHA en civic-relay; `ci.yml` sin `permissions`; ni SBOM ni escáner de secretos en CI.
- Falta un borrador de DPIA, necesario en cuanto haya voluntarios reales.

### A4 — Evaluador de financiación pública (UE/NL) · **4,5/10 hoy**
| Instrumento | Encaje real | Estado |
|---|---|---|
| **NLnet (Restack / convocatoria general)**, €5k–50k, **3-nov-2026** | **Bueno** si se plantea como *librería abierta de store-and-forward + recibos verificables + transporte AOSP*, no como "app de emergencias" | **Viable en 13 días** |
| Horizon CL3-2026-01 (5-nov-2026) | Débil como coordinador: requiere consorcio y profesionales del sector | Solo como socio pequeño de un consorcio existente |
| UCPM KAPP | Cerrada (21-may-2026) | Preparar la de 2027 con un socio de protección civil |
| RVO WBSO / MIT | Depende de que residas o tengas empresa en NL | Verificar la elegibilidad personal |

> [!WARNING]
> **NLnet no acepta propuestas generadas íntegramente por IA** y exige transparencia sobre su uso. La propuesta **tienes que escribirla tú**. Yo puedo revisar los hechos y la estructura, pero no redactarla. Además, conviene declarar que el código está asistido por IA (el README ya dice "proyecto asistido por IA", bien).

### A5 — Inversor privado / impacto · **2/10**
- No hay usuarios, ni socio institucional, ni carta de intención, ni entidad legal, ni equipo más allá de una persona, ni datos de campo.
- Un VC no invierte hoy en TRL 3 sin tracción. **No conviene dirigirse a inversores privados todavía**: gastaría credibilidad.

---

## 3. Sexta perspectiva — Experto en ingeniería de software (lo que ejecuté hoy)

| Acción | Estado | Evidencia |
|---|---|---|
| Verificar el dossier contra el código y corregir 19 referencias falsas o incorrectas | ✅ Publicado | `1d9711c` (feature), `b0f3fa8` (`master`) |
| Reescribir la auditoría de dependencias con las versiones reales | ✅ | `docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md` |
| Corregir la sección de financiación (NLnet cerrado/sucesor, título real de SSRI-04, política de IA) | ✅ | `docs/investor/FUNDING_OPPORTUNITIES.md` |
| Volver a pasar la suite completa tras los cambios | ✅ 55/55 | `node --test investor-next/tests/*.test.mjs` |

---

## 4. Nota global

| Dimensión | Nota | ¿Lista para enviar? |
|---|---|---|
| Web pública | 6/10 | Casi; le falta vídeo, contacto y recortar |
| Código núcleo | 7/10 (investigación) | Sí, como prototipo de investigación |
| Evidencia real | **3/10** | **No**: cero datos físicos |
| Integridad documental | 6/10 tras las correcciones de hoy | Requiere consolidación |
| NLnet (3-nov) | 4,5 → **7,5/10** si se hace la prueba con 2 teléfonos y la propuesta la escribes tú | **Condicional** |
| Horizon Europe como coordinador | 2/10 | No |
| Inversión privada | 2/10 | No |

**Veredicto:** **4,5/10 en preparación global.** No está listo para inversores privados ni para liderar un Horizon. **Sí puede estar listo para NLnet el 3 de noviembre**, si en los próximos 10 días se convierte la simulación en **un dato real**.

---

## 5. Cómo subirlo al máximo nivel (por orden de impacto/coste)

### Sprint de 10 días (antes del 3-nov) — el que cambia la nota
1. **La prueba de los dos teléfonos (1 tarde).** Instala el APK en dos Android en modo avión y haz 30 intentos según `PILOT_ACCEPTANCE.md`, **incluidos los fallos**. Publica el CSV y **un vídeo de 60–90 s sin editar**. Pasa de `PHYSICAL_TEST_PENDING` a un dato real. *Es el 80 % del valor.*
   - Ojo: el artefacto APK de CI caduca a los 7 días; relanza el workflow `android-nearby-ci.yml` con `workflow_dispatch` justo antes.
2. **Web: menos y más real.** Un hero con el vídeo y **un único número real** ("23/30 entregas con ACK válido, p50 = X s, 2 dispositivos, 0 ACK falsos"), un **email de contacto** visible y recortar a un tercio. Lo demás puede ir a una página técnica secundaria.
3. **Propuesta NLnet escrita por ti**, enfocada como infraestructura abierta reutilizable: *"open, transport-agnostic store-and-forward with verifiable receipts + AOSP BLE/Wi-Fi Aware transport (sin Play Services)"*. Pide unos €30–45k con hitos concretos. Antes, pregunta en las **office hours de NLnet**.
4. **Consolidar la documentación:** de 45 documentos a README + 5 (Arquitectura, Evidencia, Amenazas, Roadmap, Pitch). Archiva el resto en `docs/archive/`. Reetiqueta las "revisiones independientes" como **"revisión interna asistida por IA"**.

### Mes 1–3 — de prototipo a TRL 4–5
5. **Un solo motor:** decidir entre `packages/core` e `investor-next/lib` y eliminar el duplicado.
6. Android: **cola persistente (Room)**, **recibos firmados (Ed25519)** y una prueba con **3 teléfonos** (A → relé B → C).
7. **5 personas reales** (no sintéticas) usando la app en un simulacro: notas, tiempos y confusiones.
8. **Una carta de interés** de un actor real: Veiligheidsregio, protección civil municipal, Cruz Roja o un laboratorio universitario (TU Delft, TNO, UPM). Una carta vale más que los 11 documentos.

### Mes 3–12 — escalar la financiación
9. WBSO/MIT (si encaja tu situación en NL), UCPM KAPP 2027 con un socio de protección civil y unirte a un consorcio para las convocatorias CL3 de 2027.
10. Solo entonces, inversión privada o de impacto, con datos de campo, una carta y una entidad legal.

---

## 6. Empezar a moverlo para conseguir financiación — esta semana

| Día | Acción | Resultado |
|---|---|---|
| Hoy | Confirmar en nlnet.nl/propose qué fondo encaja (Restack o general) y apuntarte a las office hours | Encaje validado |
| 1–3 | Prueba con 2 teléfonos + vídeo + CSV | Primer dato real |
| 3–4 | Yo actualizo la web (hero con vídeo, número real y contacto) y el registro de evidencias | Web lista para evaluadores |
| 4–8 | Escribes tú la propuesta NLnet; yo verifico hechos, enlaces y presupuesto | Borrador sólido |
| 5–10 | 10 emails cortos y personalizados a laboratorios y protección civil pidiendo **una llamada de 20 min** (no dinero) | Camino hacia la carta de interés |
| ≤ 3-nov 12:00 CET | **Enviar NLnet** | Primera solicitud real |

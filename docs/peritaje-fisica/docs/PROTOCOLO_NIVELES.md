# Protocolo de niveles N0–N5, pruebas de transición y puerta humana (`PROTOCOLO_NIVELES.md`)

Implementación verificada en `packages/senda/src/report-protocol.mjs` y `packages/senda/tests/report-protocol.test.mjs`.

## 1. Tabla de niveles y autoridad

| Nivel | Nombre | Criterio verificable de entrada | Quién decide | `canPublicWarn` | Salida estándar |
|---|---|---|---|---|---|
| **N0** | Recibido | Sobre `senda.citizen-report/v1` válido, firma Ed25519 verificada, zona horaria ISO explícita, consentimiento explícito y `operationalStatus` declarado. | Automático | **`false`** | Registro en cola con expediente inicial y cadena de evidencia SHA-256. |
| **N1** | Coherente | Supera coherencia del dispositivo (desfase horario, salto cinemático, barómetro ISA, no reutilización `dHash-64`) y plausibilidad física básica sin contradicción. | Automático | **`false`** | Probabilidad bayesiana con horquilla y pruebas a favor/en contra. |
| **N2** | Corroborado | Al menos 2 fuentes **independientes** (deduplicando seudónimo, `groupHint`, ráfaga colocalizada y foto compartida vía `cross-source.mjs`) o fiabilidad Dawid & Skene (1979) alta + corroboración de paso (`hazard-verify.mjs`). | Automático | **`false`** | Habilita asimilación en modelos 4D (`data-assimilation.mjs`, puerta N2+). |
| **N3** | Verificado por instrumento | Confirmación por aforo autenticado, estación oficial, satélite (Sentinel-2/1) o cámara institucional con estado `OBSERVED`. | Automático | **`false`** | Expediente verificado instrumentalmente. |
| **N4** | Pre-alerta al comité | Nivel N2 o N3 **y** lectura por encima de un umbral de riesgo **con fuente publicada citada obligatoria** (`createRiskThreshold` / `PUBLISHED_RISK_THRESHOLDS`). | Automático | **`false`** | Genera expediente completo + **borrador CAP 1.2** con `<status>Exercise</status>` y `<scope>Restricted</scope>` solo para revisión del comité. |
| **N5** | Aviso a la población | Decisión **exclusivamente humana** de una autoridad identificada con `AuthorityGrant` firmado Ed25519 por el ancla institucional, vigente (`grantedAt <= now <= expiresAt`, sin hueco `NaN`), dentro de geocerca y tipo de peligro autorizados, **únicamente en `operationalStatus === 'ACTUAL'`**, más firma Ed25519 de la decisión. | **Solo humano identificado** | **`true`** (único estado posible) | **CAP 1.2 público** (`<status>Actual</status>`, `<scope>Public</scope>`) + entrada inmutable en `AuditLog` SHA-256. |

## 2. Pruebas de cada transición y descensos automáticos

Cada evaluación devuelve un arreglo ordenado `transitions[]` con `{ from, to, atMs, actor, passed, proof }`, más la probabilidad bayesiana posterior con horquilla `[low, median, high]`, explicación en lenguaje claro en español y listas `evidenceFor[]` / `evidenceAgainst[]`.

- **Descenso por contradicción verificada:** si un instrumento autenticado o una autoridad registra estado `ABSENT` concluyente contradiciendo el fenómeno, el expediente desciende automáticamente (hasta `N0`) con prueba explícita de contradicción. Un `COLLECTION_ERROR` (timeout, HTTP 503, nube sobre satélite óptico) **nunca** cuenta como contradicción ni como `ABSENT`.
- **Descenso por decaimiento temporal:** si transcurre tiempo sin nueva corroboración, la probabilidad posterior decae exponencialmente hacia la previa y el nivel retrocede automáticamente.
- **Cancelación y precedencia CRDT en sincronización (`sync-protocol.mjs`):** una autoridad puede emitir `cancelPublicWarningN5` generando un mensaje CAP 1.2 `Cancel`. En la fusión multicanal CRDT rige siempre la precedencia estricta `N5_CANCELLED > N5_AUTHORIZED > AUTO_EVALUATED`, garantizando que un mensaje viejo de malla nunca reactive un aviso cancelado.

## 3. Reglas inviolables probadas en CI

1. Ninguna combinación de sensores, satélites, reportes ciudadanos (ni siquiera un ataque Sybil de 25 reportes simultáneos) o panel de especialistas puede poner `canPublicWarn = true`.
2. Un reporte con `operationalStatus: 'SIMULATION' | 'EXERCISE' | 'TEST'` es bloqueado físicamente en la puerta N5 aunque la autoridad presente una clave Ed25519 válida.
3. Un umbral de riesgo sin fuente citada lanza error (`createRiskThreshold`).

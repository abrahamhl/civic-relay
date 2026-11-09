# SENDA · Revisión de aseguramiento

Fecha: 2026-11-08  
Alcance: sobres cifrados, almacén DTN, recibos, credenciales, órdenes remotas, routing y fuego.  
Estado: revisión interna; **no es una auditoría externa ni una prueba formal**.

## 1. Activos y adversarios

Activos:

- Confidencialidad e integridad de mensajes personales y de emergencia.
- Autenticidad del emisor y del coordinador.
- Disponibilidad del almacén y de la red oportunista.
- Privacidad de metadatos (quién habla con quién).
- Integridad de la evidencia científica y de los documentos de misión.

Adversarios:

- Relé curioso u hostil que almacena y reenvía.
- Atacante que intenta inyectar sobres o recibos falsos.
- Atacante que intenta inundar el almacén o agotar batería.
- Suplantador de un contacto o de un coordinador.
- Observador de tráfico que analiza cabeceras.
- Usuario legítimo comprometido o clave robada.

## 2. Controles existentes

| Control | Implementación | Prueba |
|---|---|---|
| Cifrado E2E | ECDH P-256 efímero-estático + HKDF-SHA-256 + AES-256-GCM | `security-rescue.test.mjs` |
| Firma del emisor | ECDSA P-256/SHA-256 sobre cabecera + ciphertext | `security-rescue.test.mjs` |
| Cabecera como AAD | Une cabecera y ciphertext | `security-rescue.test.mjs` |
| Validación de forma | Tamaño, versión, tipos, TTL, base64 canónico | `dtn-hardening.test.mjs` |
| Recibo verificable | Compromiso `ackHash` del secreto; cuarentena si falta el sobre | `dtn-hardening.test.mjs` |
| Recibo falso no suprime | Cuarentena pendiente; no se marca verificado | `dtn-hardening.test.mjs` |
| Reserve/commit | No consume copias si el transporte falla | `dtn-hardening.test.mjs` |
| Fragmentación k-de-n | Reensamblado con 3 de 5 | `dtn-hardening.test.mjs` |
| Cuotas | Bytes, hops, copias, broadcasts, recibos pendientes | `dtn-hardening.test.mjs` |
| Credenciales | Firma de organización, caducidad, revocación, anclas | `security-rescue.test.mjs` |
| Órdenes remotas | Firma, credencial, rol, consentimiento, zona, replay | `coordination-flow.test.mjs` |
| Destinatario de respuesta | La firma cubre `reply`; desviarlo invalida la firma | `coordination-flow.test.mjs` |
| Deduplicación | Inbox y `seen` en órdenes | `security-rescue.test.mjs`, `coordination-flow.test.mjs` |
| Límite de formato binario | Rechaza ciphertext >65535 B en vez de truncar | `dtn-hardening.test.mjs` (nuevo) |
| Vinculación de emisor (F-02) | Versión interna 3 con huella de caja; `expectedSender` compara firma y huella | `security-rescue.test.mjs` (nuevo) |
| Export cifrado de identidad (F-05) | PBKDF2-SHA-256 210 000 + AES-256-GCM, AAD y mínimo de frase | `security-rescue.test.mjs` (nuevo) |
| Cadena de custodia PCI | `@senda/pci` v0.2.0: JSON canónico, hash/firma por registro, recibos y anclas externas | `packages/senda-pci/tests/pci.test.mjs` (nuevo) |

## 3. Hallazgos

### F-01 · PCI implementado, sin auditar (Alto, gobernanza)

No hay paquete PCI verificable en Git. Sin él no se puede demostrar cadena de custodia, canonicalización ni verificación fail-closed de evidencias. No es un fallo de confidencialidad, pero bloquea la afirmación de auditabilidad.

Estado: **IMPLEMENTADO LOCALMENTE, SIN AUDITORÍA NI DESPLIEGUE**. `packages/senda-pci/` v0.2.0, protocolo `senda.pci/1`, 13 pruebas adversariales. No es «recuperación» de la v0.1. Falta revisión externa y despliegue identificable por hash.

### F-02 · Vinculación de identidad del emisor (Medio-Alto)

`openMessage` verifica que el emisor posee la clave de firma incluida en el plaintext, pero no liga esa clave a una tarjeta de contacto ni a una identidad externa. `fromFingerprint` se devuelve como `null` en sobres v2. Un atacante puede generar una identidad nueva y presentarse con un nombre elegido si el usuario acepta su tarjeta.

Mitigaciones aplicadas:

- La versión interna 3 del sobre incluye la huella de la clave de caja del emisor dentro del plaintext firmado.
- `openMessage({ expectedSender })` compara la clave de firma y la huella de caja con la tarjeta; falla con `SENDER_NOT_PINNED` o `SENDER_BINDING_MISSING`.
- Los sobres v2 siguen abriéndose, pero sin vinculación (`fromFingerprint = null`).

Pendiente:

- La UI debe mostrar «contacto verificado» solo si `expectedSender` se aporta y la comprobación pasa.
- Añadir números de seguridad o QR presencial.

Estado: **MITIGADO EN CÓDIGO Y PROBADO**; falta integración de UI y revisión externa.

### F-03 · El relé no puede verificar la firma (Medio, por diseño)

Un relé ciego no puede verificar la firma porque la clave pública del emisor viaja cifrada. Puede almacenar sobres con firma inválida hasta que el destinatario los abra. Las cuotas y la validación de forma limitan el daño, pero no lo eliminan.

Mitigaciones:

- Firma exterior verificable por el relé (sacrifica privacidad).
- Prueba de trabajo o tasa limitada por vecino.
- Expulsión de vecinos que inyectan basura.
- No presentar el filtrado del relé como garantía de autenticidad.

Estado: **CONOCIDO**.

### F-04 · Metadatos en la cabecera (Medio)

La cabecera expone `id`, `to` (huella), `priority`, `kind` y `expiresAt`. Un observador puede inferir patrones de comunicación, prioridad y duración. No se oculta el destinatario.

Mitigaciones:

- Padding a cubos de tamaño.
- Rotación de identificadores.
- No usar `kind` sensible en claro.
- Analizar tráfico con un modelo de adversario explícito.

Estado: **ABIERTO**.

### F-05 · Gestión de claves (Alto)

`exportIdentity` devuelve claves privadas en claro; no hay almacenamiento en hardware, recuperación, rotación ni revocación de identidad. El compromiso del teléfono permite leer mensajes futuros y suplantar al usuario.

Mitigaciones aplicadas:

- `exportIdentityEncrypted` / `importIdentityEncrypted` con PBKDF2-SHA-256 (210 000 iteraciones) + AES-256-GCM, AAD `SENDA-identity-v1`, mínimo 12 caracteres y fallo cerrado con frase incorrecta o blob alterado.

Pendiente:

- Guardar claves en el keystore del sistema.
- Rotación y credenciales de revocación.
- Protocolo de recuperación con contactos de confianza.
- Eliminar la exportación en claro cuando la migración termine.

Estado: **MITIGADO PARCIALMENTE**.

### F-06 · Broadcast no verificado en el almacén (Medio)

`putBroadcast` solo valida forma, tamaño y caducidad. La verificación de firma y credencial ocurre en `evaluateCommand`. Si una UI muestra un broadcast sin evaluarlo, puede mostrar una orden falsa.

Mitigación: la UI debe llamar siempre a `evaluateCommand` antes de mostrar o ejecutar; añadir un estado `UNVERIFIED` explícito.

Estado: **MITIGADO PARCIALMENTE**.

### F-07 · Longitud binaria truncada (Medio, corregido)

`packEnvelope` escribía la longitud del ciphertext en 2 bytes; un sobre de más de 65535 B se truncaba y `unpackEnvelope` fallaba con «bytes sobrantes». Ahora `packEnvelope` lanza un error explícito. El formato JSON/base64 sigue soportando sobres mayores.

Prueba: `dtn-hardening.test.mjs`, «el formato binario rechaza ciphertext >65535 B».

Estado: **CORREGIDO**.

### F-08 · Sin prueba formal ni auditoría externa (Alto para afirmaciones)

Los tests cubren casos adversariales, pero no hay modelo formal, fuzzing continuo, análisis estático, revisión criptográfica independiente ni auditoría externa. No se puede afirmar «seguro» en sentido fuerte.

Estado: **BLOCKED**.

### F-09 · Evicción y denegación de servicio (Medio)

La política de cuotas expulsa mensajes de otros antes que los propios. Un atacante con muchos sobres puede desplazar mensajes legítimos de baja prioridad. No hay prueba de carga con miles de sobres ni de recuperación tras saturación.

Mitigaciones: reservar cuota para SOS, límites por vecino, backpressure, pruebas de carga.

Estado: **ABIERTO**.

### F-10 · Replay y caducidad (Bajo)

Los IDs y `seen` bloquean replay en órdenes; los sobres deduplican por id; los recibos son idempotentes. La caducidad se valida en forma y al abrir. No se encontró un bypass en las pruebas actuales.

Estado: **MITIGADO**.

## 4. Matriz de riesgo

| ID | Probabilidad | Impacto | Riesgo | Estado |
|---|---|---|---|---|
| F-01 | Media | Alto | Alto | Implementado; sin auditar |
| F-02 | Baja | Alto | Medio | Mitigado en código |
| F-03 | Alta | Medio | Medio | Conocido |
| F-04 | Alta | Medio | Medio | Abierto |
| F-05 | Media | Alto | Alto | Parcial |
| F-06 | Media | Medio | Medio | Parcial |
| F-07 | Media | Medio | Medio | Corregido |
| F-08 | Alta | Alto | Crítico | BLOCKED |
| F-09 | Media | Medio | Medio | Abierto |
| F-10 | Baja | Medio | Bajo | Mitigado |

## 5. Recomendaciones priorizadas

1. Auditar PCI v0.2 y desplegarlo con hash verificable.
2. Integrar F-02 en la UI: exigir `expectedSender` y mostrar «verificado» solo si pasa.
3. Cerrar F-05 residual: keystore, rotación, revocación y retirada de `exportIdentity` en claro.
4. Añadir fuzzing de `validateEnvelopeShape`, `unpackEnvelope`, `unpackContact`, `decodeCode` y del parser PCI.
5. Pruebas de carga y evicción con 10^4 sobres.
6. Revisión criptográfica externa.
7. Documentar el modelo de adversario y los límites de privacidad.

## 6. Evidencia reproducible

```powershell
cd packages/senda
node --test tests/security-rescue.test.mjs
node --test tests/dtn-hardening.test.mjs
node --test tests/coordination-flow.test.mjs

cd ../senda-pci
node --test tests/*.test.mjs
```

Resultado esperado: todas en verde. Verde no significa seguro; significa que estos casos pasan. PCI no está auditado externamente.

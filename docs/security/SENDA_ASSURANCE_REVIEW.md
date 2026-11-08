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

## 3. Hallazgos

### F-01 · PCI ausente (Alto, gobernanza)

No hay paquete PCI verificable en Git. Sin él no se puede demostrar cadena de custodia, canonicalización ni verificación fail-closed de evidencias. No es un fallo de confidencialidad, pero bloquea la afirmación de auditabilidad.

Estado: **BLOCKED**. Plan: `packages/senda-pci/` v0.2, no «recuperación» de la v0.1.

### F-02 · Vinculación de identidad del emisor (Medio-Alto)

`openMessage` verifica que el emisor posee la clave de firma incluida en el plaintext, pero no liga esa clave a una tarjeta de contacto ni a una identidad externa. `fromFingerprint` se devuelve como `null`. Un atacante puede generar una identidad nueva y presentarse con un nombre elegido si el usuario acepta su tarjeta.

Mitigaciones recomendadas:

- Incluir en el plaintext la huella de la clave de caja del emisor y compararla con la tarjeta de contacto.
- Mostrar «contacto verificado» solo si la huella coincide.
- Añadir números de seguridad o QR presencial.
- No confiar en el nombre que envía el emisor.

Estado: **ABIERTO**.

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

`exportIdentity` devuelve claves privadas; no hay almacenamiento en hardware, frase de paso, recuperación, rotación ni revocación de identidad. El compromiso del teléfono permite leer mensajes futuros y suplantar al usuario.

Mitigaciones:

- Guardar claves en el keystore del sistema.
- Frase de paso y bloqueo.
- Rotación y credenciales de revocación.
- Protocolo de recuperación con contactos de confianza.

Estado: **ABIERTO**.

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
| F-01 | Alta | Alto | Crítico | BLOCKED |
| F-02 | Media | Alto | Alto | Abierto |
| F-03 | Alta | Medio | Medio | Conocido |
| F-04 | Alta | Medio | Medio | Abierto |
| F-05 | Media | Alto | Alto | Abierto |
| F-06 | Media | Medio | Medio | Parcial |
| F-07 | Media | Medio | Medio | Corregido |
| F-08 | Alta | Alto | Crítico | BLOCKED |
| F-09 | Media | Medio | Medio | Abierto |
| F-10 | Baja | Medio | Bajo | Mitigado |

## 5. Recomendaciones priorizadas

1. Implementar PCI v0.2 y verificación fail-closed.
2. Cerrar F-02: vincular firma, caja y tarjeta de contacto; mostrar estado de verificación.
3. Cerrar F-05: keystore, frase de paso, rotación y revocación.
4. Añadir fuzzing de `validateEnvelopeShape`, `unpackEnvelope`, `unpackContact` y `decodeCode`.
5. Pruebas de carga y evicción con 10^4 sobres.
6. Revisión criptográfica externa.
7. Documentar el modelo de adversario y los límites de privacidad.

## 6. Evidencia reproducible

```powershell
cd packages/senda
node --test tests/security-rescue.test.mjs
node --test tests/dtn-hardening.test.mjs
node --test tests/coordination-flow.test.mjs
```

Resultado esperado: todas en verde. Verde no significa seguro; significa que estos casos pasan.

# INFORME DE PRUEBAS DE ACEPTACIÓN — SENDA LIVE

**Fecha de ejecución:** 8 de noviembre de 2026  
**Resultado Global:** 13/13 PASSED (100% de éxito reproducible)  
**Comando de reproducción:** `pnpm --filter @senda/live test`

---

## Detalle de Pruebas Obligatorias

### TEST A — SOCIAL & PERSISTENCIA
- **Descripción:** Registro de dos usuarios civiles, publicación de noticia con enlace a YouTube, visualización en el feed, seguimiento del suceso, comentario y persistencia tras reinicio completo del proceso y base de datos SQLite.
- **Resultado:** `PASS` (382 ms).

### TEST B — COMPARTIR DESDE OTRA APP (LINK FIRST)
- **Descripción:** Recepción y validación de URL externa, extracción de metadatos oEmbed autorizados, generación de preview legal y confirmación de que no se descargan archivos multimedia a disco.
- **Resultado:** `PASS` (44 ms).

### TEST C — SUSCRIPCIONES Y CONSENTIMIENTO (LIKE ≠ SEGUIR)
- **Descripción:** Un usuario da LIKE a una publicación pero NO recibe avisos de actualización del evento. Tras activar explícitamente el seguimiento, recibe las alertas correspondientes; al retirar el consentimiento, cesa la recepción.
- **Resultado:** `PASS` (10 ms).

### TEST D — VERIFICACIÓN Y DETECCIÓN DE CONTRADICCIONES
- **Descripción:** Agrupamiento automático determinista de publicaciones similares en hipótesis de acontecimiento. Detección de negaciones y discrepancias numéricas forzando el estado `DISPUTED`.
- **Resultado:** `PASS` (1.7 ms).

### TEST E — SUPLANTACIÓN Y CONTROL INSTITUCIONAL
- **Descripción:** Intento de emisión de alerta oficial por usuario no autorizado rechazado con código 403 y registro en auditoría con severidad `SECURITY`. Emisión exitosa únicamente tras firma criptográfica válida con ancla de confianza de Bomberos.
- **Resultado:** `PASS` (99 ms).

### TEST F — OFFLINE, COLA DE PRIORIDADES Y ESTADOS DTN
- **Descripción:** Sellado de sobre SENDA v2 con WebCrypto ECDH/AES-GCM. Almacenamiento en gateway en estado `IN_CUSTODY` (1 check). Reserva de carril para SOS en `planWindow`. Transición a `VERIFIED` (doble check) tras acuse de recibo del destinatario.
- **Resultado:** `PASS` (13 ms).

### TEST G — MODERACIÓN Y EXPEDIENTE DSA
- **Descripción:** Notificación de contenido, resolución por moderador con etiquetado sensible, notificación al autor, apelación motivada y revocación por analista de confianza.
- **Resultado:** `PASS` (5.3 ms).

### TESTS DE INTEGRACIÓN HTTP / SEGURIDAD
- Cabeceras de seguridad (CSP, nosniff, DENY): `PASS`
- Servir SPA y fallback index.html: `PASS`
- Prevención de ataques CSRF en mutaciones: `PASS`
- Endpoint de adaptadores e integraciones: `PASS`

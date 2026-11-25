# Privacidad por diseño, minimización de datos y notas jurídicas (`PRIVACIDAD.md`)

Implementación técnica verificada en `packages/senda/src/citizen-report.mjs`, `investor-next/public/senda/reportar.mjs` y `packages/senda/src/triage-governance.mjs`.

## 1. Principios técnicos implementados

1. **Consentimiento explícito y granular (`createConsentRecord`):** ningún sobre `senda.citizen-report/v1` puede construirse ni firmarse sin `accepted: true`, `consentVersion` y marca temporal ISO-8601 con zona horaria. Distingue expresamente `shareWithAuthorities`, `allowVerificationByPassersby` y `redactBeforeShare`.
2. **Seudonimización criptográfica (cero identidad personal obligatoria):** la ciudadanía firma con un par de claves Ed25519 generado localmente en el dispositivo (`createCitizenKeyPair`). El identificador del informante es un seudónimo derivado por SHA-256 de la clave pública (`pseudonymIdFromPublicRaw`), nunca un nombre, teléfono, correo o DNI. El modelo de fiabilidad de Dawid & Skene (1979) opera exclusivamente sobre dichos seudónimos.
3. **Borrado local de metadatos EXIF (`stripJpegExif`):** antes de compartir una fotografía JPEG se eliminan los segmentos `APP1` (EXIF/GPS/modelo de cámara/XMP), `APP13` (IPTC) y `COM` directamente en el cliente sin necesidad de servidor externo.
4. **Difuminado local de caras y matrículas (`redactRgbaRegions` + editor `<canvas>` en `reportar.html`):** pixelado determinista en bloque directamente sobre los píxeles RGBA en el dispositivo antes del envío. Si el ciudadano activa `redactBeforeShare` y adjunta imagen sin redactar, el sobre se marca explícitamente `pendingRedaction: true` para impedir difusión pública inadvertida.
5. **Difuminado opcional de coordenadas (`fuzzLocation`):** cuantización espacial configurable a rejilla de `gridMeters` antes de cualquier vista agregada.
6. **Cero datos personales en registros y pruebas:** `runEpistemicSecurityAudit` audita líneas de log contra patrones de correo electrónico, DNI/NIE y teléfonos españoles (`ZERO_PII_IN_LOGS`). Ningún fichero de prueba ni el servidor de referencia almacenan PII.
7. **Cifrado de extremo a extremo opcional (`reportToEncryptedAuthorityEnvelope`):** reutiliza `envelope.mjs` (X25519 + AES-GCM) para que el contenido multimedia solo sea legible por la clave pública de la autoridad destinataria.

## 2. Retención propuesta (configurable por el gestor institucional)

| Categoría de dato | Retención operativa sugerida | Tratamiento al expirar |
|---|---|---|
| Imágenes/audio crudos recibidos en sala de comité | Duración de la emergencia + ventana de verificación técnica (p. ej., 30 días, configurable) | Borrado irreversible salvo requerimiento judicial formal de conservación como prueba. |
| Expediente técnico anonimizado (niveles N0–N5, métricas físicas, hashes) | Archivo histórico y mejora científica (sin PII ni imágenes con personas) | Conservación agregada y seudonimizada. |
| Registro de auditoría N5 (`AuditLog` SHA-256 de autoridades públicas) | Según normativa administrativa de protección civil y archivos públicos | Conservación íntegra de la cadena de decisión institucional. |
| Cola offline local en navegador (`reportar.html`) | Hasta sincronización confirmada o borrado manual por el usuario | Control total por el ciudadano en su dispositivo. |

## 3. Base jurídica RGPD / LOPDGDD — **PENDIENTE DE REVISIÓN POR UN JURISTA**

> **AVISO EXPRESO:** las siguientes bases jurídicas son una propuesta técnica orientativa y **deben ser revisadas y validadas formalmente por un jurista especializado / Delegado de Protección de Datos (DPD)** antes de cualquier despliegue real con población:
> - **Art. 6.1.a RGPD (consentimiento explícito):** recogido de forma verificable en el propio sobre firmado antes del envío desde `reportar.html`.
> - **Art. 6.1.d RGPD (intereses vitales del interesado o de otra persona física):** aplicable en alertas SOS o peligro inminente para la vida cuando una persona no pueda prestar consentimiento previo.
> - **Art. 6.1.e RGPD (misión realizada en interés público o ejercicio de poderes públicos):** aplicable únicamente cuando el despliegue sea operado por o bajo convenio formal con una Administración competente en Protección Civil (Ley 17/2015 del Sistema Nacional de Protección Civil).
> - **Evaluación de Impacto (EIPD, art. 35 RGPD):** recomendable y probablemente preceptiva antes de producción debido al tratamiento de geolocalización e imágenes en emergencias.
> - **Menor edad y datos de terceros en imágenes:** el difuminado previo en cliente mitiga el riesgo, pero requiere texto legal revisado en la interfaz y política de moderación humana antes de cualquier publicación.

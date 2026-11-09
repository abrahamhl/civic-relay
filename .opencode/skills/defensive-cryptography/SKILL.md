---
name: defensive-cryptography
description: "BPSec, E2EE, OWASP ASVS/MASVS, sesiones seguras y firmas"
license: MIT
compatibility: OpenCode project skill
---

# BPSec, E2EE, OWASP ASVS/MASVS, sesiones seguras y firmas

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Corregir sesión en JSON, HttpOnly/Secure/SameSite, RBAC por recurso, eventos privados, almacenamiento clave, cifrado de datos.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Pruebas adversariales cross-account, XSS/CSRF/SSRF y no bypass de controles de producción.

## Referencias primarias para comprobar versiones

- https://owasp.org/www-project-application-security-verification-standard/
- https://mas.owasp.org/
- https://cheatsheetseries.owasp.org/

### Test de seguridad multilayer
- Modelar atacante anónimo, usuario A, usuario B, moderador y operador institucional; todos los endpoints de eventos, feeds, historias y chats deben aplicar la misma política ABAC.
- Corregir token en JSON y cookie sin Secure en modo producción; protección CSRF/Origin, sesión rotada y revocación.
- Firma/custodia: hash con byte canonicalization + firma + identidad validada + timestamp confiable y log append-only; no afirmar aptitud judicial automática.
- E2EE chat requiere gestión de identidad, intercambio de claves, multi-dispositivo, recuperación y revocación; NO equiparar un mensaje SQLite plaintext con E2EE.
- Herramientas: Semgrep, CodeQL, Trivy, OWASP ZAP pasivo y tests locales; sin pentest activo de infraestructura ajena.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.

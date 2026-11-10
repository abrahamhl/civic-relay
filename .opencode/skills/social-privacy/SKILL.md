---
name: social-privacy
description: "PWA, privacidad y usabilidad de emergencias"
license: MIT
compatibility: OpenCode project skill
---

# PWA, privacidad y usabilidad de emergencias

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Diseñar feed, publicación, seguimiento, aviso, SOS y estados de entrega; accesibilidad, offline queue y borrado coherente.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

A/B usuarios; PRIVATE/FOLLOWERS no se filtran por historias/eventos; likes no autorizan push.

## Referencias primarias para comprobar versiones

- https://web.dev/learn/pwa/
- https://www.w3.org/WAI/WCAG22/quickref/
- https://owasp.org/www-project-top-ten/

### UX basada en escenarios reales
- Probar desde Android low-end: nuevo usuario descubre incidente, publica enlace, elige visibilidad, sigue evento con consentimiento y recibe actualización.
- Revisar stories, eventos, perfiles, rutas directas, geocodificación opcional, accesibilidad teclado/lectores y errores de servicio.
- Persistir cola offline con estado y retry idempotente; cada publicación tiene origen, hash, hora y reintento, nunca marcar visible cuando no se publicó.
- Privacidad: la localización es aproximada por defecto, los mensajes e imágenes no se almacenan más de lo permitido, y reacción/like no constituye autorización de geolocalización o mensajes masivos.
- Playwright real 390px/768px/1440px con capturas y pruebas de aislamiento entre cuentas.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.

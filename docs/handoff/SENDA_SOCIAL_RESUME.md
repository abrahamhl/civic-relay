# RESUMEN EJECUTIVO Y TRANSFERENCIA (HANDOFF) — SENDA LIVE

**Fecha:** 8 de noviembre de 2026  
**Rama de trabajo:** `feat/senda-social-live-20261108` (en `.worktrees/senda-social`)  
**Commit base:** `mission/senda-95-20261108` (`b9b1590`)  

---

## 1. Alcance Entregado

1. **Backend Operativo Completo:**
   - Base de datos relacional SQLite 3.45 con migraciones automáticas versionadas (`001_init.sql`).
   - Autenticación real con contraseñas `scrypt`, sesiones SHA-256 en cookies `HttpOnly` y protección CSRF.
   - Motor de Event Hub con cálculo determinista de verificación (`verification.mjs`) e inteligencia de incidentes (`intelligence.mjs`).
   - Conectores externos "Link First" (YouTube, TikTok, Bluesky, X, Meta oEmbed, Web Safe-Fetch con bloqueo anti-SSRF).
   - Emisión y verificación de alertas institucionales con credenciales ECDSA P-256 ligadas a organizaciones verificadas.
   - Mensajería con estados explícitos del núcleo SENDA (`QUEUED_OFFLINE`, `IN_CUSTODY`, `DELIVERED`, `VERIFIED`).
   - Gestión de expedientes de moderación y apelaciones conformes con el Digital Services Act (DSA).
   - Sistema de auditoría append-only a prueba de manipulación mediante triggers SQL.

2. **Aplicación Web / PWA:**
   - SPA moderna en React 18 + Vite + TypeScript construida y verificada (`web/dist`).
   - Barra de navegación inferior móvil de 5 secciones y barra lateral de 3 columnas para escritorio.
   - Soporte para Web Share Target para recibir enlaces compartidos desde cualquier app externa.
   - Service Worker para funcionamiento y lectura de feed en modo fuera de línea.
   - Mapa interactivo Leaflet con capas por categorías y filtros de verificación.

3. **Batería de Pruebas de Aceptación:**
   - 13 pruebas unitarias y de integración pasando al 100% (`tests/acceptance.test.mjs` y `tests/http.test.mjs`).
   - Verificados todos los requisitos de los tests A, B, C, D, E, F y G.

---

## 2. Instrucciones de Ejecución

```bash
# Entrar al paquete senda-live
cd apps/senda-live

# Ejecutar las pruebas de aceptación completas
pnpm test

# Iniciar el servidor backend + API + estáticos SPA
pnpm start

# En desarrollo con hot-reload del cliente
pnpm dev:web
```
El servidor escuchará en `http://localhost:3000`.

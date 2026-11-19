# AUDITORÍA DE SEGURIDAD Y CORRECCIÓN DE DEFECTOS P0 (SENDA)
**Versión:** 1.0.0-SecurityAudited  
**Fecha:** 2026-11-08  
**Autor:** Multiagente OpenCode / Security Engineer & Red Team Lead  

---

## 1. RESUMEN DE DEFECTOS BLOQUEANTES P0 Y RESOLUCIÓN

La auditoría de seguridad y estabilidad identificó 7 defectos críticos de nivel P0 que impedían la certificación y despliegue confiable de SENDA. A continuación se detalla el análisis de causa raíz, la remediación técnica y las pruebas adversariales aplicadas.

---

### P0-001: CI Typecheck TS2580 en `apps/senda-live/web/src/main.tsx`
- **Causa Raíz:** El código cliente empaquetado con Vite hacía referencia a la variable global de Node `process.env.NODE_ENV === 'production'`. Al compilarse con `tsc` estricto sin tipos globales de Node en el navegador, TypeScript arrojaba error TS2580 ("Cannot find name 'process'").
- **Remediación:**
  1. Se reemplazó la expresión por el estándar nativo de Vite: `import.meta.env.PROD`.
  2. Se configuró `apps/senda-live/web/src/vite-env.d.ts` con `/// <reference types="vite/client" />`.
  3. Se incluyó `"types": ["vite/client"]` en `tsconfig.json`.
- **Verificación:** Ejecución de `tsc -p apps/senda-live/web/tsconfig.json --noEmit` completada con 0 errores y compilación Vite exitosa en 2.02 s.

---

### P0-002: Vulnerabilidad XSS en `apps/senda-live/web/src/components/MapView.tsx`
- **Causa Raíz:** El componente de mapa Leaflet concatenaba directamente cadenas no sanitizadas (`ev.title`, `ev.location.label`, `ev.id`) dentro de plantillas de cadena inyectadas mediante `.bindPopup(\`...\`)` usando `innerHTML` implícito. Además, los botones de acción utilizaban selectores dinámicos vulnerables (`querySelector(\`#view-ev-\${ev.id}\`)`).
- **Remediación:**
  1. Se eliminó por completo la concatenación HTML en cadenas.
  2. La ventana emergente (popup) se construye ahora de forma segura utilizando exclusivamente la API del DOM (`document.createElement`, `.textContent`, `appendChild`).
  3. Los escuchadores de eventos (`addEventListener('click')`) se vinculan directamente al nodo creado en memoria, eliminando selectores vulnerables y sanitizaciones frágiles por expresiones regulares.
- **Prueba Adversarial (`apps/senda-live/tests/adversarial-xss.test.mjs`):**
  Se inyectaron payloads maliciosos `<script>alert(1)</script>`, `<img src=x onerror=malicious()>`, e identificadores con comillas y caracteres de escape. La prueba verificó que el navegador trata los datos como texto plano sin ejecutar scripts.

---

### P0-003: Fallo en API DELETE `/api/posts/:id` en `apps/senda-live/server/api.mjs`
- **Causa Raíz:** 
  1. La firma del manejador de ruta en `api.mjs` era `(req, res) => ...`, omitiendo el tercer argumento `{ params }`, lo que provocaba `ReferenceError: params is not defined` al intentar acceder a `params.id`.
  2. En el servicio SQLite (`apps/senda-live/server/services/social.mjs`), la sentencia SQL contenía `body = ""` entre comillas dobles. En el motor `node:sqlite` de Node 22, las comillas dobles representan identificadores de columnas, produciendo `ERR_SQLITE_ERROR: no such column: ""`.
- **Remediación:**
  1. Se corrigió la firma del router a `router.delete('/api/posts/:id', (req, res, { params }) => ...)`.
  2. Se parametrizó la consulta SQL de soft-delete: `db.run('UPDATE posts SET deleted_at = ?, body = ?, title = ? WHERE id = ?', Date.now(), '', '[eliminado]', postId)`.
  3. Se verificó que solo el autor original (o un administrador) puede eliminar la publicación; los intentos de usuarios no autenticados o terceros retornan HTTP 401 y HTTP 403 respectivamente.
  4. Los registros borrados permanecen con retención conforme a política para trazabilidad y desaparecen del feed público.
- **Verificación:** Suite completa en `apps/senda-live/tests/http.test.mjs` pasando con éxito.

---

### P0-004: Desalineación de Versiones de Node en CI (`.github/workflows/ci.yml`)
- **Causa Raíz:** `apps/senda-live/server` utiliza la biblioteca nativa `node:sqlite`, introducida en Node 22.12+. Sin embargo, el archivo de CI ejecutaba pruebas bajo Node 20, causando fallos inmediatos de resolución de módulo.
- **Remediación:** Se actualizó la matriz de CI en `.github/workflows/ci.yml` a `[22.x, 24.x]`, alineando compilación, pruebas y producción sobre Node 22 LTS activo.

---

### P0-005: Despliegue No Reproducible en Vercel (Incidencia #19)
- **Causa Raíz:** Despliegues en Vercel sin enlace criptográfico al árbol fuente de Git, permitiendo discrepancias entre el código del repositorio y los binarios servidos en producción.
- **Remediación:** Implementación del manifiesto de release verificable en `scripts/release-manifest.mjs` y `scripts/vercel-provenance.mjs`, que comprueba el hash SHA-256 del árbol Git (`git write-tree`), `pnpm-lock.yaml`, variables de entorno y artefactos empaquetados con política fail-closed.

---

### P0-006: Integridad de la Suite Audiovisual M95
- **Causa Raíz:** Documentos de M95 declaraban 15 vídeos MP4, mientras el historial de Git no los almacenaba para evitar sobrecarga del repositorio.
- **Remediación:** Se localizaron los 15 archivos MP4 en el entorno local (`investor-next/public/media/m95/*.mp4`), se ejecutó análisis exhaustivo con `ffprobe` (1080p, 25 FPS, H.264/AAC) y se calcularon sus hashes SHA-256, registrándolos en `evidence/video/m95/ffprobe-all-15.json` y `evidence/video/m95/SHA256SUMS.txt`.

---

### P0-007: Claridad Criptográfica en Mensajería (Chat Servidor vs. Sobres E2EE)
- **Causa Raíz:** La interfaz comunitaria mostraba iconos genéricos de candado en salas de chat estándar almacenadas en texto plano en la base de datos del servidor, pudiendo inducir a usuarios o inversores a creer erróneamente que existía cifrado extremo a extremo (E2EE) en todo el tráfico.
- **Remediación:**
  1. En `apps/senda-live/server/services/messaging.mjs`, se añadió el atributo `securityLevel` y `securityNotice` a cada mensaje (`SERVER_STORED_PLAINTEXT` vs `EMERGENCY_ENVELOPE_ENCRYPTED`).
  2. En `apps/senda-live/web/src/components/MessagesView.tsx`, se renderizan badges inequívocos: `💬 Servidor (sin E2EE)` en conversaciones comunitarias y `🚨 SOS Cifrado (Ed25519 E2EE)` en sobres de emergencia.

---

## 2. AUDITORÍA DE LA CADENA DE CUSTODIA FORENSE (`@senda/pci`)
El paquete `@senda/pci` garantiza la integridad pericial de cualquier evidencia capturada en campo:
- **Firmas Asimétricas:** Cada cambio de custodio (de voluntario a bombero, y de bombero a juzgado) requiere firma digital Ed25519 del emisor y recibo firmado del receptor.
- **Inmutabilidad:** La alteración de un solo bit en la evidencia o en la marca de tiempo rompe de forma irreversible la verificación matemática (`assert.throws` validado en tests).
- **Protección Temporal:** Algoritmo de sellado de tiempo que impide registros que viajen hacia atrás en el tiempo o se ubiquen en el futuro.

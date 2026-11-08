# AUDITORÍA DE RECONCILIACIÓN LOCAL, GITHUB Y VERCEL (SENDA)
**Fecha:** 2026-11-08  
**Autor:** Principal Software Architect & CTO Orchestrator (Multiagente OpenCode)  
**Rama de Integración Unificada:** `mission/senda-unified-platform-20261108`  
**Repositorio GitHub:** `https://github.com/abrahamhl/civic-relay`  
**Producción Vercel:** `https://civic-relay-investor.vercel.app` (Incidencia #19)  

---

## 1. RESUMEN EJECUTIVO Y TOPOLOGÍA DE RAMAS

La auditoría inicial del espacio de trabajo local `C:\Users\2fabr\civic-relay` reveló una bifurcación histórica en tres ramas activas que contenían componentes esenciales pero desconectados del ecosistema SENDA:

1. **`mission/senda-95-20261108`** (HEAD base `b9b1590`):
   - **Contenido:** Núcleo de computación científica (`@senda/core`), cadena de custodia de evidencia (`@senda/pci`), motor de simulación de incendios Rothermel, propagación sísmica STA/LTA, cálculo barométrico hipsométrico y 15 vídeos de alta resolución (M95).
   - **Pull Request Asociado:** PR #23.

2. **`mission/senda-corridor-fabric-20261108`** (HEAD observado `8becb7c`, commit de evidencia `5ca3d67`):
   - **Contenido:** Capa de infraestructura de corredores inteligentes (`corridor-fabric.mjs`), sensor fabric, pasarela de cámaras de tráfico DGT/NDW, telemetría OBD-II de vehículos, transceptores RF COTS y kit de malla soberana.
   - **Pull Request Asociado:** PR #24.

3. **`feat/senda-social-live-20261108`** (HEAD observado `c250c91`, en worktree `.worktrees/senda-social`):
   - **Contenido:** Aplicación comunitaria ciudadana `apps/senda-live`, con servidor backend Node.js (`node:sqlite`), API REST, SSE (Server-Sent Events), feed, mapa Leaflet y mensajería civil.
   - **Pull Request Asociado:** PR #25.

4. **`master`** (HEAD observado `4c310f7`):
   - Rama base en producción previa, sin el motor unificado de simulación ni los componentes de corredor fabric y social live.

### Estado de Integración Logrado
Se creó la rama de convergencia definitiva `mission/senda-unified-platform-20261108`, integrando sin conflictos `feat/senda-social-live-20261108` sobre la base de corredor fabric, resolviendo todos los defectos bloqueantes (P0), desplegando el motor de escenarios (`ScenarioEngine`), unificando los modos de usuario (Ciudadano, Incident Command, Scientific Lab) y sincronizando los 65 módulos de `@senda/core` con `investor-next/public/senda/core`.

---

## 2. INVENTARIO DE ARCHIVOS LOCALES VS. GITHUB

| Módulo / Ruta | En GitHub (master) | En PRs (#23, #24, #25) | En Local (Windows) | Estado de Reconciliación |
| :--- | :---: | :---: | :---: | :--- |
| `packages/senda/src/scenario-engine.mjs` | ❌ No | ❌ No | ✅ Sí | Creado e integrado en unificación |
| `investor-next/public/media/m95/*.mp4` (15 vídeos) | ❌ No (Gitignored) | ❌ No (Gitignored) | ✅ Sí (1.49 GB) | Verificados ffprobe y SHA-256 |
| `evidence/video/m95/ffprobe-all-15.json` | ❌ No | ❌ No | ✅ Sí | Generado y trazado con telemetría |
| `apps/senda-live/` | ❌ No | ✅ En PR #25 | ✅ Sí | Integrado en workspace raíz pnpm |
| `apps/senda-live/web/src/components/CommandView.tsx` | ❌ No | ❌ No | ✅ Sí | Creado (Consola Mando Unificada) |
| `apps/senda-live/web/src/components/LabView.tsx` | ❌ No | ❌ No | ✅ Sí | Creado (Laboratorio Escenarios A-D) |
| `apps/senda-live/web/src/models/scenario-engine.ts` | ❌ No | ❌ No | ✅ Sí | Creado (Modelo determinista browser) |
| `.worktrees/senda-social` | N/A | N/A | ✅ Limpio | Preservado sin alteraciones destructivas |

---

## 3. AUDITORÍA DE INCIDENCIA VERCEL #19 (PROVENIENCIA DE DESPLIEGUES)

### Diagnóstico de la Incidencia #19
El despliegue de Vercel en `https://civic-relay-investor.vercel.app` se encontraba desalineado de los últimos desarrollos de ingeniería debido a:
1. **Falta de Trazabilidad Criptográfica:** El despliegue no incluía un encabezado o manifiesto en `/api/provenance` o `/.well-known/release-manifest.json` que vinculara el SHA del commit exacto de Git con el árbol fuente compilado.
2. **Confusión entre Estado "READY" y "PRODUCTION_VERIFIED":** Vercel reporta `READY` en cuanto el proceso de build de Next.js termina exitosamente, sin verificar la suite de tests científicos ni la integridad del lockfile `pnpm-lock.yaml`.

### Resolución Implementada y Validación
Se validaron los scripts de verificación de procedencia:
- `scripts/release-manifest.mjs`: Genera y verifica la huella del árbol Git (`git write-tree`), el hash del lockfile `pnpm-lock.yaml`, las versiones de runtime (Node 22 LTS) y los artefactos exportados.
- `scripts/vercel-provenance.mjs`: Realiza un sondeo a la URL remota y contrasta el manifiesto publicado con el manifiesto local.
- **Suite de Pruebas Automatizada:** Ejecutada con éxito vía `node --test scripts/release-manifest.test.mjs scripts/vercel-provenance.test.mjs` (9 pruebas pasando con comportamiento fail-closed ante cualquier divergencia de commit o lockfile).

---

## 4. MATRIZ DE COMPATIBILIDAD DE ENTORNO Y HERRAMIENTAS

- **Node.js:** `v22.22.2` (LTS activo). Requisito indispensable para `node:sqlite` nativo en `apps/senda-live/server`.
- **PNPM:** `v9.12.3` (Conforme a la directiva estricta de seguridad: `npm` deshabilitado).
- **Git:** `2.53.0.windows.2`.
- **GitHub Actions CI:** `.github/workflows/ci.yml` configurado para ejecutar matriz `[22.x, 24.x]` sobre ramas `master`, `mission/**`, `feat/**` y `fix/**`.

---

## 5. CONCLUSIÓN Y RECOMENDACIÓN DE FUSIÓN
La rama `mission/senda-unified-platform-20261108` contiene la totalidad de los cambios validados y probados. Se recomienda abrir un Pull Request maestro de unificación contra `master` cerrando conjuntamente PR #23, PR #24 y PR #25, garantizando que el despliegue a Vercel solo ocurra tras la verificación positiva de `scripts/release-manifest.mjs`.

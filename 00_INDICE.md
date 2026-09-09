# 📂 Índice de Archivos – Civic Relay V0.1

**Proyecto:** Civic Relay – Plataforma de comunicación de crisis offline-first  
**Ubicación base:** `C:\Users\2fabr\civic-relay\`  
**Fecha:** 2026-09-09

---

## 🏗️ Estructura del Proyecto

```
civic-relay/
├── packages/          # Paquetes compartidos (lógica de negocio)
├── apps/              # Aplicaciones (web, futuras apps móviles)
├── fixtures/          # Datos de demo y escenarios de prueba
├── docs/              # Documentación técnica
├── package.json       # Configuración raíz (pnpm workspace)
└── 00_*.md            # Archivos de índice/changelog (este documento)
```

---

## 📦 Paquetes (`packages/`)

### 1. Schemas (`packages/schemas/`)

**Qué es:** Definiciones de datos (Zod schemas) – mensaje envelope, incidentes, transports

**Archivos clave:**
- `src/message.ts` – MessageEnvelope, MessageType, VerificationState, Priority
- `src/incident.ts` – Incident, IncidentStatus
- `src/transport.ts` – TransportCapability, RoutingDecision
- `src/index.ts` – Punto de entrada (exporta todo)

**Ruta completa:** `C:\Users\2fabr\civic-relay\packages\schemas\`

**Cómo usar:**
```typescript
import { MessageEnvelope, MessageType } from '@civic-relay/schemas';
```

---

### 2. Transports (`packages/transports/`)

**Qué es:** Capa de abstracción de transportes (IP, mesh, cellular)

**Archivos clave:**
- `src/base.ts` – Interfaz `ITransport` (contrato base)
- `src/ip-transport.ts` – IPTransport (real, usa `navigator.onLine`)
- `src/local-mesh-transport.ts` – LocalMeshTransport (SIMULADO)
- `src/cellular-transport.ts` – CellularTransport (SIMULADO)
- `src/index.ts` – Exporta todos los transportes

**Ruta completa:** `C:\Users\2fabr\civic-relay\packages\transports\`

**Importante:**
- LocalMesh y Cellular son **simulados** (fixtures para demo)
- Controlables via `.setSimulatedState(available, strength)`

---

### 3. Core (`packages/core/`)

**Qué es:** Lógica de negocio principal (router, store, dispatcher, deduplicación)

**Archivos clave:**
- `src/router.ts` – Router con ranking explicable de transports
- `src/store.ts` – MessageStore (cola local, store-and-forward)
- `src/dispatcher.ts` – Dispatcher (coordina routing y entrega)
- `src/deduplication.ts` – Deduplicator (multipath → un solo mensaje)
- `src/index.ts` – Exporta toda la lógica

**Ruta completa:** `C:\Users\2fabr\civic-relay\packages\core\`

**Flujo:**
```
User crea mensaje
  ↓
Dispatcher.dispatch()
  ↓
Store.enqueue() (siempre guarda local primero)
  ↓
Router.route() (selecciona transportes)
  ↓
Envío paralelo via transportes seleccionados
  ↓
Store.recordDeliveryAttempt() (registra cada intento)
```

---

## 🌐 Aplicaciones (`apps/`)

### 1. Web (`apps/web/`)

**Qué es:** Aplicación React mobile-first (Vite + Leaflet)

**Archivos clave:**

#### Configuración
- `package.json` – Dependencias (React, Leaflet, workspaces)
- `vite.config.ts` – Configuración Vite
- `tsconfig.json` – TypeScript config
- `index.html` – Punto de entrada HTML

#### Código fuente (`src/`)
- `main.tsx` – Punto de entrada React
- `App.tsx` – Componente principal (routing, dispatcher setup)
- `App.css` – Estilos globales

#### Componentes (`src/components/`)
- `EmergencyButtons.tsx` – Botones "I'm Safe", "SOS", "Medical", "Fire", etc.
- `TransportStatus.tsx` – Indicador online/offline
- `MessageQueue.tsx` – Lista de mensajes con estado de entrega
- `IncidentMap.tsx` – Mapa Leaflet con marcadores de incidentes
- `*.css` – Estilos de cada componente

**Ruta completa:** `C:\Users\2fabr\civic-relay\apps\web\`

**Cómo ejecutar:**
```bash
cd C:\Users\2fabr\civic-relay
pnpm dev
```
Abre: http://localhost:3000

**Roles disponibles:**
- **Citizen** – Crear mensajes, ver cola
- **Coordinator** – Ver dashboard con mapa de incidentes

---

## 🧪 Fixtures (`fixtures/`)

**Qué es:** Datos de prueba y escenarios de demo

**Archivos clave:**

1. **`wildfire-scenario.ts`**
   - Escenario de aceptación completo (11 pasos)
   - Datos del incidente oficial (wildfire)
   - Mensaje SOS de ciudadano
   - Scripts de cada paso

2. **`demo-runner.html`**
   - Runner interactivo del escenario
   - Abre directamente en navegador
   - Ejecuta los 12 pasos con logs visuales

**Ruta completa:** `C:\Users\2fabr\civic-relay\fixtures\`

**Cómo usar:**
```
Abrir en navegador: C:\Users\2fabr\civic-relay\fixtures\demo-runner.html
```

---

## 📚 Documentación (`docs/`)

**Qué es:** Documentación técnica completa (7 archivos)

**Archivos:**

1. **`PRODUCT.md`**
   - Visión de producto
   - Problema, solución, usuarios objetivo
   - Flujos de usuario
   - Principios de producto

2. **`ARCHITECTURE.md`**
   - Arquitectura técnica
   - Abstracciones core (envelope, transport, router)
   - Flujo de datos
   - Decisiones de diseño

3. **`THREAT_MODEL.md`**
   - Modelo de amenazas de seguridad
   - Actores maliciosos (eavesdropper, spammer, etc.)
   - Escenarios de ataque
   - Hoja de ruta de seguridad

4. **`DATA_SOURCES.md`**
   - Fuentes de datos oficiales (NASA FIRMS, USGS, etc.)
   - Lógica de corroboración
   - Calidad de datos
   - Privacidad y cumplimiento legal

5. **`TRANSPORT_BOUNDARIES.md`**
   - Límites legales y de autorización
   - Qué V0.1 hace (y NO hace)
   - Cumplimiento FCC/RED
   - Transportes prohibidos

6. **`DEMO_SCENARIO.md`**
   - Escenario de prueba de aceptación completo
   - 12 pasos con wildfire
   - Cómo ejecutar
   - Criterios de validación

7. **`ROADMAP.md`**
   - Hoja de ruta V0.1 → V3.0
   - Features por versión
   - Métricas de éxito
   - Riesgos y mitigaciones

**Ruta completa:** `C:\Users\2fabr\civic-relay\docs\`

---

## 📄 Archivos Raíz

### Configuración

1. **`package.json`**
   - Workspace root
   - Scripts: `dev`, `build`, `test`
   - packageManager pinned (pnpm 9.12.3 via Corepack)

2. **`pnpm-workspace.yaml`**
   - Define workspace (packages/*, apps/*)

3. **`tsconfig.base.json`**
   - Config TypeScript base (extendida por todos los paquetes)

4. **`.gitignore`**
   - Excluye node_modules, dist, .env

**Ruta completa:** `C:\Users\2fabr\civic-relay\`

---

### Documentación Meta

1. **`README.md`**
   - Introducción al proyecto
   - Qué está implementado vs. simulado vs. planeado
   - Quick start
   - Tech stack
   - Workwize story

2. **`00_INDICE.md`** (este archivo)
   - Índice completo con rutas Windows
   - Qué hay en cada carpeta
   - Cómo abrir/ejecutar cada cosa

3. **`00_CHANGELOG.md`**
   - Registro de cambios
   - Qué se hizo en esta sesión
   - Qué se rompió (si algo) y cómo se arregló

---

## 🚀 Cómo Empezar

### Primera vez

```bash
# 1. Ir al proyecto
cd C:\Users\2fabr\civic-relay

# 2. Habilitar Corepack (si no está habilitado)
corepack enable

# 3. Instalar dependencias
pnpm install

# 4. Compilar todos los paquetes
pnpm build

# 5. Ejecutar dev server
pnpm dev
```

Abre: http://localhost:3000

---

### Demo interactivo

Abrir en navegador:
```
C:\Users\2fabr\civic-relay\fixtures\demo-runner.html
```

Click **"Start Demo"**, luego **"Next Step"** para cada paso.

---

## 🧪 Testing

### Tests unitarios

```bash
cd C:\Users\2fabr\civic-relay
pnpm test
```

**Archivos de test:**
- `packages/core/src/__tests__/deduplication.test.ts`
- `packages/core/src/__tests__/router.test.ts`

**Nota:** Jest no está configurado en V0.1 (tests escritos pero no ejecutables aún)

---

## 📁 Rutas Importantes (Windows)

| Qué | Ruta completa |
|-----|---------------|
| Proyecto base | `C:\Users\2fabr\civic-relay\` |
| Web app | `C:\Users\2fabr\civic-relay\apps\web\` |
| Schemas | `C:\Users\2fabr\civic-relay\packages\schemas\` |
| Core logic | `C:\Users\2fabr\civic-relay\packages\core\` |
| Demo runner | `C:\Users\2fabr\civic-relay\fixtures\demo-runner.html` |
| Docs | `C:\Users\2fabr\civic-relay\docs\` |
| README | `C:\Users\2fabr\civic-relay\README.md` |

---

## 🔧 Comandos Útiles

```bash
# Dev server (hot reload)
pnpm dev

# Build todos los paquetes
pnpm build

# Type-check sin compilar
pnpm type-check

# Linter (no configurado en V0.1)
pnpm lint

# Tests (no configurados en V0.1)
pnpm test

# Limpiar node_modules
pnpm clean # (no existe aún, hacer manualmente)
```

---

## 🎯 Próximos Pasos

Ver [`docs/ROADMAP.md`](C:\Users\2fabr\civic-relay\docs\ROADMAP.md)

**V0.2 (siguiente):**
- Integración NASA FIRMS
- Persistencia IndexedDB
- PWA manifest

---

**Última actualización:** 2026-09-09  
**Creado por:** Abraham Haddioui (con Claude Code)

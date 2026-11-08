# ARQUITECTURA TÉCNICA SENDA LIVE

**Plataforma:** Node.js 22 (node:sqlite WAL embebido) + React 18 + TypeScript + PWA  
**Núcleo Criptográfico:** WebCrypto P-256 + `@senda/core` (`envelope.mjs`, `bundle.mjs`, `roles.mjs`)  

---

## 1. Visión de Componentes y Datos

```
[ Cliente Web / PWA ] 
   │  ├── React 18 SPA (Vite)
   │  ├── IndexedDB (Cola Offline + Caché Feed)
   │  └── Service Worker (Cache First para assets estáticos)
   │
   ▼ HTTP / SSE (X-Senda-Request: 1)
[ Servidor Node 22 (server/index.mjs) ]
   ├── Enrutador HTTP + Rate Limiting + CSP Estricta
   ├── Hub SSE de Tiempo Real (reanudación por Last-Event-ID)
   ├── Servicios de Dominio:
   │    ├── auth.mjs (scrypt, sesiones SHA-256)
   │    ├── social.mjs (feed, posts, link-first adapters)
   │    ├── events.mjs (Event Hub, motor de verificación)
   │    ├── emergency.mjs (alertas firmadas, custodia DTN)
   │    ├── messaging.mjs (chats, canales, estados SENDA)
   │    ├── moderation.mjs (casos DSA, expedientes, apelaciones)
   │    └── admin.mjs (RBAC/ABAC, anclas de confianza, auditoría)
   └── Base de Datos SQLite 3.45 (WAL, Foreign Keys On)
```

---

## 2. Decisión de Persistencia y Migración a PostgreSQL

- **Fase Actual (MVP / Piloto / Un solo nodo):** SQLite WAL embebido sin dependencias externas (`node:sqlite`). Coste de infraestructura: 0 €. Backup directo mediante copia de archivo con checkpoint de WAL.
- **Ruta a Multi-Nodo (Escala):**
  - Los tipos de columna han sido diseñados con correspondencia 1:1 con PostgreSQL:
    - `id TEXT PRIMARY KEY` -> `UUID` / `TEXT`
    - Tiempos `INTEGER` (ms) -> `TIMESTAMPTZ`
    - Bounding boxes `TEXT` (JSON) -> `geometry(Polygon, 4326)` con PostGIS
    - Coordenadas aproximadas -> `geometry(Point, 4326)`
    - Auditoría inmutable con triggers nativos de exclusión de UPDATE/DELETE

---

## 3. Integración con el Núcleo SENDA

El almacén DTN del servidor reutiliza directamente `@senda/core`:
- `createBundleStore` gestiona las transferencias bilaterales anti-entropía.
- `validateEnvelopeShape` previene la entrada de paquetes corruptos o manipulados.
- `openMessage` / `sealMessage` garantizan cifrado ECDH P-256 + AES-GCM con PFS.
- `priority-lanes.mjs` reserva cuota mínima obligatoria para emergencias y SOS, impidiendo la saturación por tráfico social.

<p align="center">
  <strong>🌍 Civic Relay</strong><br>
  Offline-first crisis communication engine
</p>

<p align="center">
  <a href="#english">🇬🇧 English</a> ·
  <a href="#español">🇪🇸 Español</a> ·
  <a href="#nederlands">🇳🇱 Nederlands</a>
</p>

<p align="center">
  <a href="https://github.com/AbrahamHL/civic-relay/actions/workflows/ci.yml">
    <img src="https://github.com/AbrahamHL/civic-relay/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <img src="https://img.shields.io/badge/tests-25%2F25_passing-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D20-green" alt="Node">
  <img src="https://img.shields.io/badge/offline--first-yes-orange" alt="Offline First">
</p>

---

<h2 id="english">🇬🇧 English</h2>

### What this is

A TypeScript monorepo implementing the core engine for **offline-first, multi-transport crisis messaging**. Messages are dispatched through whatever channels remain available — local mesh, IP, cellular, satellite — with priority-based routing, store-and-forward queuing, cryptographic signing, and receiver-side deduplication.

> ⚠️ **Not an emergency service.** This is an engineering prototype. No institutional endorsement, no ENS compliance, no operational deployment. All transports are **simulated in-process**. The queue is **in-memory** (lost on reload). Do not enter real personal data or real emergencies.

### What the tests prove

```
pnpm test → 25/25 pass, 0 fail
```

| Capability | What the test verifies |
|---|---|
| **Store-and-forward** | Messages queue when all transports are unavailable; retry delivers when routes appear |
| **Multipath routing** | CRITICAL → 3 transports, HIGH → 2, scored by reliability/latency/energy/cost |
| **Deduplication** | Same message via 2 paths → 1 logical message retaining both observed routes |
| **Ed25519 signatures** | Envelope integrity across 13 field-tamper vectors; key-order normalization; malformed rejection |
| **X25519 sealed boxes** | Payload-only encryption; wrong-key rejection; tampered/truncated ciphertext rejection |
| **PBKDF2 + AES-256-GCM** | Key storage with fresh salt/IV per write; authenticated metadata; empty-passphrase rejection |
| **TTL expiry** | Expired messages rejected before routing; store evicts expired entries |
| **Verification gates** | Forged `OFFICIAL` status, malformed UUIDs, unknown payload types all rejected |
| **Fault isolation** | One failing transport does not block a healthy path from acknowledging |

### Architecture

```
packages/
  schemas/     → Zod schemas: MessageEnvelope, TransportCapability, RoutingDecision
  transports/  → ITransport interface + IP, LocalMesh, Cellular simulators
  core/        → Router, Dispatcher, MessageStore, Deduplicator, CryptoManager
  api/         → Express REST server (experimental, not connected to demo)
apps/
  web/         → React + Vite + Leaflet demo UI
```

### Run locally

```bash
pnpm install --frozen-lockfile
pnpm build        # Build all packages
pnpm test         # 25 tests, Node test runner
pnpm type-check   # Strict TypeScript, 0 errors
pnpm dev          # Dev server at http://localhost:3000
```

### Known limits

- Queue, history, and deduplication are **session-only** (in-memory).
- No end-to-end encryption in the demo dispatch path; crypto primitives exist but are experimental and not wired to dispatch.
- No service worker, no PWA, no persistence layer.
- No production backend, authentication, authorization, or emergency services integration.

### Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — message flow and routing logic
- [`docs/TRANSPORT_BOUNDARIES.md`](docs/TRANSPORT_BOUNDARIES.md) — what is simulated vs. real
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — threat model
- [`docs/CRYPTO_ARCHITECTURE.md`](docs/CRYPTO_ARCHITECTURE.md) — cryptographic design (experimental)
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — next steps

### How it was built

Architecture and scope decisions: human. Implementation assisted by AI (Claude, Codex, Gemini) and verified with tests that pass or fail. Errors found in prior versions are documented in [`docs/TRUTH_AUDIT.md`](docs/TRUTH_AUDIT.md).

---

<h2 id="español">🇪🇸 Español</h2>

### Qué es

Un monorepo TypeScript que implementa el motor central para **mensajería de crisis offline-first y multi-transporte**. Los mensajes se despachan por los canales que estén disponibles — mesh local, IP, celular, satélite — con enrutamiento por prioridad, cola store-and-forward, firma criptográfica y deduplicación en el receptor.

> ⚠️ **No es un servicio de emergencias.** Es un prototipo de ingeniería. Sin aval institucional, sin conformidad ENS, sin despliegue operativo. Todos los transportes son **simulados en proceso**. La cola es **en memoria** (se pierde al recargar). No introduzcas datos personales ni emergencias reales.

### Qué demuestran los tests

```
pnpm test → 25/25 pasan, 0 fallan
```

| Capacidad | Qué verifica el test |
|---|---|
| **Store-and-forward** | Los mensajes se encolan cuando no hay transporte; se entregan cuando aparecen rutas |
| **Enrutamiento multipath** | CRITICAL → 3 transportes, HIGH → 2, puntuados por fiabilidad/latencia/energía/coste |
| **Deduplicación** | Mismo mensaje por 2 rutas → 1 mensaje lógico reteniendo ambas rutas observadas |
| **Firmas Ed25519** | Integridad del sobre con 13 vectores de manipulación; normalización de orden de claves |
| **Sealed boxes X25519** | Cifrado solo del payload; rechazo con clave incorrecta; rechazo de ciphertext corrupto |
| **PBKDF2 + AES-256-GCM** | Almacenamiento de claves con salt/IV frescos; metadatos autenticados |
| **Expiración TTL** | Mensajes expirados rechazados antes de enrutar; el store elimina entradas expiradas |
| **Puertas de verificación** | Estado `OFFICIAL` forjado, UUIDs malformados, tipos de payload desconocidos → rechazados |
| **Aislamiento de fallos** | Un transporte que falla no bloquea a un transporte sano |

### Motivación

En catástrofes reales — el terremoto de Venezuela, los incendios forestales de España, las inundaciones de la DANA — la infraestructura de telecomunicaciones colapsa primero. Personas atrapadas no pueden llamar. Los servicios de emergencia (bomberos con SIRTAP/SITRE, policía, protección civil) pierden comunicación entre ellos. Los despliegues de Starlink tardan horas.

Este proyecto explora una pregunta de ingeniería: **¿puede un dispositivo con WiFi/Bluetooth crear una red de relevo que funcione sin infraestructura?** El motor resuelve el enrutamiento, la cola, la deduplicación y la criptografía. Los transportes reales (mesh BLE, gateway satelital, radio SDR) son el siguiente paso.

### Ejecutar en local

```bash
pnpm install --frozen-lockfile
pnpm build        # Compilar todos los paquetes
pnpm test         # 25 tests, runner nativo de Node
pnpm type-check   # TypeScript estricto, 0 errores
pnpm dev          # Servidor de desarrollo en http://localhost:3000
```

### Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — flujo de mensajes y lógica de enrutamiento
- [`docs/TRANSPORT_BOUNDARIES.md`](docs/TRANSPORT_BOUNDARIES.md) — qué es simulado vs. real
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — modelo de amenazas
- [`docs/CRYPTO_ARCHITECTURE.md`](docs/CRYPTO_ARCHITECTURE.md) — diseño criptográfico (experimental)
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — próximos pasos

---

<h2 id="nederlands">🇳🇱 Nederlands</h2>

### Wat is het

Een TypeScript-monorepo die de kernmotor implementeert voor **offline-first, multi-transport crisisberichtenverkeer**. Berichten worden verzonden via welke kanalen beschikbaar zijn — lokaal mesh, IP, mobiel, satelliet — met prioriteitsgebaseerde routering, store-and-forward wachtrij, cryptografische ondertekening en deduplicatie aan de ontvangerkant.

> ⚠️ **Dit is geen hulpdienst.** Dit is een technisch prototype. Geen institutionele goedkeuring, geen operationele inzet. Alle transporten zijn **gesimuleerd**. De wachtrij is **in-memory** (gaat verloren bij herladen). Voer geen echte persoonsgegevens of noodgevallen in.

### Wat de tests bewijzen

```
pnpm test → 25/25 geslaagd, 0 gefaald
```

| Functie | Wat de test verifieert |
|---|---|
| **Store-and-forward** | Berichten worden in de wachtrij geplaatst als transport niet beschikbaar is |
| **Multipath-routering** | CRITICAL → 3 transporten, HIGH → 2, gescoord op betrouwbaarheid/latentie/energie/kosten |
| **Deduplicatie** | Zelfde bericht via 2 paden → 1 logisch bericht met beide waargenomen routes |
| **Ed25519-handtekeningen** | Envelop-integriteit over 13 manipulatievectoren |
| **X25519 sealed boxes** | Payload-encryptie; afwijzing bij verkeerde sleutel of beschadigd ciphertekst |
| **PBKDF2 + AES-256-GCM** | Sleutelopslag met verse salt/IV; geauthenticeerde metadata |
| **TTL-vervaldatum** | Verlopen berichten afgewezen vóór routering |
| **Foutisolatie** | Eén falend transport blokkeert geen gezond pad |

### Lokaal uitvoeren

```bash
pnpm install --frozen-lockfile
pnpm build        # Bouw alle pakketten
pnpm test         # 25 tests, Node test runner
pnpm type-check   # Strikt TypeScript, 0 fouten
pnpm dev          # Ontwikkelingsserver op http://localhost:3000
```

---

## License

MIT © Abraham Haddioui

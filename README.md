# Civic Relay Demo (V0.1)

Demo ficticia de comunicación en crisis, offline-first y de transporte múltiple, diseñada como ejercicio de ingeniería para entornos de conectividad degradada.

> ⚠️ No es un servicio de emergencias. No hay aval institucional, conformidad ENS ni prestación operativa. Todo el transporte es **simulado en la misma página** y la cola es **en memoria** (se pierde al recargar). No introduzcas datos personales ni emergencias reales.

🌐 **Demo en vivo:** 
- **GitHub Pages:** https://abrahamhl.github.io/civic-relay/

## Qué demuestra

- **Transporte múltiple** – un mensaje puede propagarse por varias rutas simuladas.
- **Almacenar y reenviar** – si no hay rutas, el mensaje queda en cola (`QUEUED`) hasta que aparezcan.
- **Canalización** – `MESSAGE → STORE → ROUTE → MULTIPATH → DEDUP → ACK`.
- **Deduplicación real** – el mismo sobre entregado por dos rutas produce **un** mensaje lógico que retiene ambas rutas.
- **Límites honestos** – separa explícitamente lo simulado de lo no probado.

## Ejecutar

### Desarrollo local
```bash
pnpm install --frozen-lockfile
pnpm dev          # Desarrollo en http://localhost:3000
pnpm build        # Build producción
pnpm test         # Tests
pnpm lint         # Type-check
```

### Deploy a Vercel (Producción)
```bash
# Opción 1: CLI (rápido)
npm install -g vercel
vercel            # Deploy preview
vercel --prod     # Deploy producción

# Opción 2: Script automatizado (recomendado)
.\scripts\deploy.ps1           # Windows
./scripts/deploy.sh preview    # Linux/Mac
```

Ver [`DEPLOYMENT_VERCEL.md`](DEPLOYMENT_VERCEL.md) para guía completa de deployment.

Servir la demo estática desde `apps/web/dist`. La API y el servicio reales **no** se exponen en esta demo.

## Pruebas

`packages/core/tests/*.test.mjs` (runner nativo de Node) cubre:

- escenario dorado offline → mesh → later IP → receptor único → 2 rutas;
- recepción **sin** acknowledgment del receptor → nunca `DELIVERED`;
- TTL caducado rechazado antes de rutar;
- `verificationState=OFFICIAL` forjado, sobre malformado y colisión de ID rechazados;
- mismo mensaje por dos rutas → un mensaje con ambas rutas;
- una ruta que falla no bloquea una ruta sana.

## Límites conocidos

- La cola, el historial y la deduplicación son **de sesión** (memoria).
- No hay cifrado extremo a extremo en el flujo de la demo; las primitivas criptográficas existen pero son experimentales y no están conectadas al despacho.
- No se registra ningún service worker ni PWA; el manifiesto es mínimo.
- No hay backend productivo, autenticación, autorización ni sistema de emergencias.

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) – arquitectura y flujo de mensajes
- [`docs/TRANSPORT_BOUNDARIES.md`](docs/TRANSPORT_BOUNDARIES.md) – qué transporte es real y qué es simulado
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) – modelo de amenazas
- [`docs/CRYPTO_ARCHITECTURE.md`](docs/CRYPTO_ARCHITECTURE.md) – criptografía (experimental, no conectada al despacho)
- [`docs/RELEASE_TRUTH_V0_1.md`](docs/RELEASE_TRUTH_V0_1.md) – verificación ejecutada vs. afirmaciones
- [`docs/ROADMAP.md`](docs/ROADMAP.md) – siguientes pasos

## Cómo se construyó

Alcance y decisiones de arquitectura humanas; implementación asistida por IA (Claude, Codex) y verificada con tests que pasan o fallan. Los errores detectados en versiones previas están documentados en [`docs/TRUTH_AUDIT.md`](docs/TRUTH_AUDIT.md).

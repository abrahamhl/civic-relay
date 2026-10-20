# OEP — Offline Emergency Protocol
**Protocolo de Emergencias Offline · Distributed Emergency Coordination & Adaptive Multi-Network Routing**

OEP is a **research prototype**, not an official emergency protocol, emergency call provider, satellite network, regulatory certification or deployment-ready safety system. It studies how *consenting* existing devices might coordinate synthetic status checks, queue messages and select compatible paths during connectivity loss.

**Research:** [OEP funding + independent validation roadmap](docs/OEP_VALIDATION_CERTIFICATION_AND_FUNDING_2026.md) · [Investor diligence](docs/OEP_INVESTOR_DILIGENCE_AND_PITCH.md) · [Master architecture](docs/MASTER_EMERGENCY_ROUTING_2026.md).

**Evidence levels:** 20–100 virtual nodes with deterministic automated scenario tests; a Java Android two-phone research lab with APK build CI; **NO measured two-phone field trial**, no official CAP trust chain, no verified satellite route, no 112 integration. Consult the exact-commit GitHub Actions job before claiming an APK build.

**Repository identity:** `abrahamhl/civic-relay` remains unchanged to preserve history, deployments and existing issue/PR references. Civic Relay is the historical repo name.

---

## Historical Civic Relay V0.1 demo

Demo ficticia de comunicación en crisis, offline-first y de transporte múltiple, diseñada como ejercicio de ingeniería para entornos de conectividad degradada.

> ⚠️ No es un servicio de emergencias. No hay aval institucional, conformidad ENS ni prestación operativa. Todo el transporte es **simulado en la misma página** y la cola es **en memoria** (se pierde al recargar). No introduzcas datos personales ni emergencias reales.

🌐 **Demo en vivo:** 
- **Producción (Vercel):** https://civic-relay.vercel.app _(recomendado)_
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

### Técnica
- [`docs/AUDITORIAS_INVERSION_PUBLICA.md`](docs/AUDITORIAS_INVERSION_PUBLICA.md) – cinco auditorías técnicas y delegaciones de responsabilidad
- [`docs/RELEASE_TRUTH_V0_1.md`](docs/RELEASE_TRUTH_V0_1.md) – verificación ejecutada (instalación/build/test/lint) vs. afirmaciones
- [`docs/ASTRA_RED_TEAM.md`](docs/ASTRA_RED_TEAM.md) – revisión adversarial de liberación
- [`docs/CRYPTO_ARCHITECTURE.md`](docs/CRYPTO_ARCHITECTURE.md) – criptografía experimental
- [`docs/WORKWIZE_CASE_STUDY.md`](docs/WORKWIZE_CASE_STUDY.md) – caso para entrevista

## Autor

Abraham Haddioui · AI-native product engineer · proyecto asistido por IA.

## Licencia

MIT.

Este repositorio es una **demo ficticia** para evaluación y aprendizaje. No está pensado para uso en emergencias reales ni para su adquisición operativa en su estado actual.

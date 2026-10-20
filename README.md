# Civic Relay — offline-first crisis messaging research prototype

**Status:** browser-based research demonstration, **not an emergency service**. No live responder, governmental, satellite, Bluetooth mesh or carrier infrastructure is connected.

This repository explores how a message can be prepared, retained locally, routed through **simulated** links and marked as delivered **only after a simulated receiver acknowledgment**. It is not safe for real incidents or personal information.

## Demo & source
- [Production site (may run an older release)](https://civic-relay.vercel.app/)
- [Source repository](https://github.com/abrahamhl/civic-relay)
- [Human Story Mode and EN/ES/NL lab — change proposal](https://github.com/abrahamhl/civic-relay/pull/2)

## What this implementation includes
- Seven-step **Human Story Mode** describing network outage → local queue → hypothetical route → fictional receiver ACK → field-validation gap.
- Investor landing with traceable capability boundaries instead of fabricated satellite throughput, official dispatch or certification.
- Shared **EN / ES / NL** selector on landing and laboratory, persisted in browser storage and URL `?lang=en|es|nl`.
- Core in-page routing simulator with deterministic receiver acknowledgment and deduplication logic.
- IndexedDB-backed message store in supported browsers; **browser storage can be unavailable or deleted**.
- Vite/PWA configuration that can cache the application shell; embedded maps and remote resources are not guaranteed to work offline.

## Run locally
Requirements: Node.js supported by this workspace and Corepack.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm type-check
pnpm test
pnpm dev
```

The web app is at `apps/web` and runs on `http://localhost:3000`. Production build output is `apps/web/dist` (this is **not** a Next.js app).

## Limits and safety
- **Real transports:** unavailable. All IP, mesh and cellular paths in the lab are same-page mocks.
- **Satellite:** conceptual graphic only; no real uplink, relay gateway or satellite API.
- **Official messages:** no identity proof and no governmental agreement; all newly created lab reports are unverified.
- **Encryption:** do not claim deployed or audited E2E protection.
- **Reliability:** browser storage, background operations, route discovery, power loss, accessibility and field tests need independent validation.
- **Offline:** the interface may be cached after a successful online load, but browser storage and tile availability are not guaranteed.
- **License:** MIT. Forking and modification are permitted under its terms; a permissive OSS license is not anti-copy protection.

## Verification
CI runs `pnpm build`, `pnpm type-check` and `pnpm test`. This demonstrates basic build/integration health, **not** emergency-grade assurance, penetration testing, device-to-device links or compliance certification.

See [Story Mode delivery brief](docs/STORY_MODE_DELIVERY_2026-10-20.md) for manual acceptance checks, field-trial prerequisites and further engineering tasks.

## Copyright & contact
© 2026 Abraham Haddioui. Licensed under MIT. Do not represent the demo as an endorsed official public warning channel.

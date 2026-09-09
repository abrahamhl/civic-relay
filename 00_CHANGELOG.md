# Changelog

## V0.1 (demo ficticia, endurecida)

- Core: `Dispatcher`/`MessageStore` separan aceptación de entrega; `DELIVERED` solo con ACK del receptor.
- Core: `demo.ts` conecta el flujo real (router/store/dedup) al escenario dorado.
- Core: TTL comprobado antes de rutar; caducados y `OFFICIAL` forjado rechazados; colisiones de ID rechazadas.
- Crypto: claves Ed25519 (firma) y X25519/XSalsa20-Poly1305 (cifrado experimental) separadas; sin E2E en el flujo.
- Tests: 21 pruebas con `node:test` (`pnpm test`).
- Web: build con `base: /civic-relay/`, tipos restringidos a la demo, manifiesto mínimo, identidad/GPS ficticios.
- Verdad: retirado "ENS Alto Compliant / Ready for Pilot / 93%"; tenantes con dominios `*.example`; README y docs nuevos.
- Auditorías: `AUDITORIAS_INVERSION_PUBLICA.md`, `ASTRA_RED_TEAM.md`, `RELEASE_TRUTH_V0_1.md`, `WORKWIZE_CASE_STUDY.md`.

## Antes

- HEAD `3f1c398`: higiene básica restaurada (lockfile, CI `master`), pero core sin escenario dorado verificado, crypto incompatible y documentación con exceso de afirmaciones.

# Índice del proyecto

Demo en vivo: `https://abrahamhl.github.io/civic-relay/`

Rutas de Windows.

- `C:\Users\2fabr\civic-relay\README.md` — resumen y cómo ejecutar.
- `C:\Users\2fabr\civic-relay\docs\AUDITORIAS_INVERSION_PUBLICA.md` — cinco auditorías y responsabilidades.
- `C:\Users\2fabr\civic-relay\docs\RELEASE_TRUTH_V0_1.md` — verificación ejecutada.
- `C:\Users\2fabr\civic-relay\docs\ASTRA_RED_TEAM.md` — matriz adversarial de liberación.
- `C:\Users\2fabr\civic-relay\docs\CRYPTO_ARCHITECTURE.md` — primitivas criptográficas (experimental).
- `C:\Users\2fabr\civic-relay\docs\WORKWIZE_CASE_STUDY.md` — caso para entrevista.

## Código

- `C:\Users\2fabr\civic-relay\packages\schemas\src\` — esquemas Zod (mensajes, incidentes, transportes).
- `C:\Users\2fabr\civic-relay\packages\transports\src\` — capa de transporte simulada (IP, mesh, celular).
- `C:\Users\2fabr\civic-relay\packages\core\src\` — router, store, dispatcher, deduplicador, demo.
- `C:\Users\2fabr\civic-relay\packages\core\tests\` — 21 pruebas Node nativas.
- `C:\Users\2fabr\civic-relay\apps\web\src\` — React + Vite demo.
- `C:\Users\2fabr\civic-relay\config\tenants\` — tenants ficticios.

## Verificación

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

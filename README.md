# Civic Relay Demo (V0.1)

Demo ficticia de comunicación en crisis, offline-first y de transporte múltiple, diseñada como ejercicio de ingeniería para entornos de conectividad degradada.

> ⚠️ No es un servicio de emergencias. No hay aval institucional, conformidad ENS ni prestación operativa. Todo el transporte es **simulado en la misma página** y la cola es **en memoria** (se pierde al recargar). No introduzcas datos personales ni emergencias reales.

🌐 **Demo en vivo:** https://abrahamhl.github.io/civic-relay/

## Qué demuestra

- **Transporte múltiple** – un mensaje puede propagarse por varias rutas simuladas.
- **Almacenar y reenviar** – si no hay rutas, el mensaje queda en cola (`QUEUED`) hasta que aparezcan.
- **Canalización** – `MESSAGE → STORE → ROUTE → MULTIPATH → DEDUP → ACK`.
- **Deduplicación real** – el mismo sobre entregado por dos rutas produce **un** mensaje lógico que retiene ambas rutas.
- **Límites honestos** – separa explícitamente lo simulado de lo no probado.

## Ejecutar

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

Servir la demo estática desde `apps/web/dist` (base `/civic-relay/`). La API y el servicio reales **no** se exponen en esta demo.

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

- [`docs/AUDITORIAS_INVERSION_PUBLICA.md`](docs/AUDITORIAS_INVERSION_PUBLICA.md) – cinco auditorías técnicas y delegaciones de responsabilidad.
- [`docs/RELEASE_TRUTH_V0_1.md`](docs/RELEASE_TRUTH_V0_1.md) – verificación ejecutada (instalación/build/test/lint) vs. afirmaciones.
- [`docs/ASTRA_RED_TEAM.md`](docs/ASTRA_RED_TEAM.md) – revisión adversarial de liberación.
- [`docs/CRYPTO_ARCHITECTURE.md`](docs/CRYPTO_ARCHITECTURE.md) – criptografía experimental.
- [`docs/WORKWIZE_CASE_STUDY.md`](docs/WORKWIZE_CASE_STUDY.md) – caso para entrevista.

## Autor

Abraham Haddioui · AI-native product engineer · proyecto asistido por IA.

## Licencia

MIT.

Este repositorio es una **demo ficticia** para evaluación y aprendizaje. No está pensado para uso en emergencias reales ni para su adquisición operativa en su estado actual.

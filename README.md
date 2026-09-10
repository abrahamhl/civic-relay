# Civic Relay Demo (V0.1)

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

### Técnica
- [`docs/AUDITORIAS_INVERSION_PUBLICA.md`](docs/AUDITORIAS_INVERSION_PUBLICA.md) – cinco auditorías técnicas y delegaciones de responsabilidad
- [`docs/RELEASE_TRUTH_V0_1.md`](docs/RELEASE_TRUTH_V0_1.md) – verificación ejecutada (instalación/build/test/lint) vs. afirmaciones
- [`docs/ASTRA_RED_TEAM.md`](docs/ASTRA_RED_TEAM.md) – revisión adversarial de liberación
- [`docs/CRYPTO_ARCHITECTURE.md`](docs/CRYPTO_ARCHITECTURE.md) – criptografía experimental
- [`docs/WORKWIZE_CASE_STUDY.md`](docs/WORKWIZE_CASE_STUDY.md) – caso para entrevista

### Deployment & Seguridad
- [`DEPLOYMENT_VERCEL.md`](DEPLOYMENT_VERCEL.md) – guía completa deployment Vercel con seguridad ENS Alto
- [`INFORME_AUDITORIA_FINAL.md`](INFORME_AUDITORIA_FINAL.md) – auditoría de seguridad y diferenciación competitiva
- [`docs/RED_TEAM_COMPETITIVE_INTELLIGENCE.md`](docs/RED_TEAM_COMPETITIVE_INTELLIGENCE.md) – análisis competitivo Airbus/Motorola

### Financiación
- [`funding/PITCH_DECK_OUTLINE.md`](funding/PITCH_DECK_OUTLINE.md) – outline pitch deck 11 slides
- [`funding/ONE_PAGER_COMERCIAL.md`](funding/ONE_PAGER_COMERCIAL.md) – resumen ejecutivo 1 página
- [`funding/EMAIL_TEMPLATES.md`](funding/EMAIL_TEMPLATES.md) – templates para CDTI, VCs, municipios

## Autor

Abraham Haddioui · AI-native product engineer · proyecto asistido por IA.

## Licencia

MIT.

Este repositorio es una **demo ficticia** para evaluación y aprendizaje. No está pensado para uso en emergencias reales ni para su adquisición operativa en su estado actual.

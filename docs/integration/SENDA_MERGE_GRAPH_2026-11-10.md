# SENDA · Grafo de integración (verificado en vivo, 2026-11-10)

**Método:** `git merge-base --is-ancestor <head del PR> HEAD` sobre la rama `ccr-a6eeda4b-bprwzy` (PR #31) y `list_pull_requests` de GitHub. Ningún `git merge` a ciegas; ningún force-push.

## Resultado: la etapa 0 ya estaba consolidada

| PR | HEAD (sin cambios desde 2026-11-09) | Base | Contenido | ¿En PR #31? |
|---|---|---|---|---|
| #18 | `ece979b` | research/senda-v021… | 14 familias de motores, 17 fuentes, reglas de calibración | ✅ incluido |
| #24 | `8becb7c` | mission/senda-95… | Corridor Fabric | ✅ incluido |
| #25 | `c250c91` | master | SENDA LIVE social/DTN | ✅ incluido |
| #26 | `aed8928` | #25 | USGS + EONET + mapa | ✅ incluido |
| #27 | `7823a30` | #26 | Meteorología 4D MET Norway | ✅ incluido |
| #28 | `d303c41` | #27 | DEM 3D, caché de terreno | ✅ incluido |
| #29 | `bec9ef1` | #28 | GeoRelay RF (geometría, no radio medida) | ✅ incluido |
| rama GDACS | `94b343d` | — | adaptador GDACS + correlación | ✅ incluida, **auditada y corregida** (ver abajo) |
| **#30** | `62d2b74` | **master** | Integración maestra: contiene todo lo anterior | base del PR #31 |
| **#31** | `26ebae7` | #30 | Correcciones científicas, bóveda de defensa, película M96, motor de garantía de entrega, GDACS corregido | rama de trabajo |

**Orden de fusión propuesto (decisión del fundador):** revisar y fusionar #31 → #30, y después #30 → `master`. Los PR #18 y #24–#29 quedan cubiertos por #30 y pueden cerrarse como «incluidos en #30» una vez fusionado; **no se ha fusionado nada en `master`**.

## Puertas de calidad en el HEAD de PR #31

- CI de GitHub: build Node 22 y 24, simulador y prueba trilingüe en navegador, todo en verde en el último commit verificado.
- Local: `pnpm build`, `pnpm type-check` y `pnpm test` verdes; núcleo 382/382; SENDA LIVE 102/102.

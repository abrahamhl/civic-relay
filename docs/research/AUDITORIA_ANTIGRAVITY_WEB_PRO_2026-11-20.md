# Auditoría de la rama `feat/web-pro-20261120` (Antigravity) · 20-11-2026

> Comprobado en una copia aislada (`git worktree`) del commit `4a7ddc6`. Cada punto se reproduce con el comando indicado.

| # | Comprobación | Resultado | Gravedad |
|---|---|---|---|
| 1 | Producción (`civic-relay-investor.vercel.app`) | Desplegada con la CLI de Vercel (`source: cli`), no desde GitHub; `/platform` existe solo en esta rama | Alta: lo publicado no es trazable a un commit revisado |
| 2 | Base de la rama | Parte de `b8360c9` (master anterior a la consolidación de 62 ramas) | Alta: fusionarla sin cuidado deshace trabajo |
| 3 | `node --test packages/senda/tests/*.test.mjs` | 705/705 (master + PR #55: 883/883) | Faltan 178 pruebas y las correcciones de hoy (`planMultiBearer`, TLE) |
| 4 | `cd investor-next && npm ci` | **Falla**: `lucide-react` y `maplibre-gl` no están en `package-lock.json` | Alta: la integración continua y un despliegue desde git no pueden compilar |
| 5 | `npm run build` (tras `npm install`) | **Falla**: `SecurityFatalError`, Next.js 16.4.2 con vulnerabilidad conocida (PR #55 usa 16.4.6 y compila) | Crítica si producción corre con 16.4.2 |
| 6 | `npm test` (web) | 117/117 | Correcto |
| 7 | `node scripts/prove.mjs` | 19/19 | Correcto |
| 8 | Veracidad del texto | `InteractiveLabsHub.tsx`: «through-wall 64-subcarrier OFDM tomography live» sin rotular la simulación; `CrisisAtlas.tsx`: «through-wall RF localization in one unified stack» | Media: viola CLAUDE.md §1 (simulación no declarada) |
| 9 | `/mando` en producción | Cabecera `sticky` con fondo al 80 % de opacidad y sin desenfoque: el texto se transparenta (captura del fundador) | Media: legibilidad |
| 10 | Bug `planMultiBearer` | No corregido en la rama | Media |

## Recomendación
Usar `master` + PR #55 como base canónica y traer de la rama de Antigravity solo lo revisado
(p. ej. `/platform` y la suite de vídeos), tras arreglar 4, 5, 8 y 9. Desplegar siempre desde git,
nunca desde la CLI con una copia local.

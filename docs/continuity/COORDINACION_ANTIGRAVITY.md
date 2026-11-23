# Coordinación Claude ↔ Antigravity (actualizado 2026-11-23)

**Lo desplegado** en https://civic-relay-investor.vercel.app sale siempre de `master` (Vercel despliega solo desde master; comprobado el 23-11: los tres proyectos de Vercel apuntan a master `24eb88a`).

## Estado de las ramas de Antigravity
| Rama | Qué trae | Decisión |
|---|---|---|
| `feat/master-emergency-routing-v1-20261020` | 5 commits de documentación de financiación (19–23 nov): Innowwide, Eurostars-3, CORDIS/TOGETHER, contactos NCP | **Integrada** (merge limpio, un solo documento, con fuentes y «UNKNOWN» donde falta el dato) |
| `feat/web-pro-20261120` | Web alternativa completa (portada, producto, ciencia, seguridad, inversores, `/platform`) | **No integrada**: 406 commits por detrás de master y 76 conflictos (incluye `AndroidManifest.xml` y `AppActivity.java`: desharía Bluetooth, voz, cámara y QR); sustituiría la web desplegada; su texto público usa «Palantir-grade» (comparación con una empresa real sin prueba). Su Centro de Control duplica `/senda/sala`, `/senda/centro` y `/senda/consola` |

## Para trabajar sin pisarnos
1. Partir **siempre de `master` actual** (`git fetch && git checkout -b <rama> origin/master`) y fusionar por PR pequeñas.
2. No tocar `apps/senda-android/**` ni `investor-next/public/senda/app*.{html,mjs}` sin traer antes master: ahí está la app de los dos móviles (roles, chat, Bluetooth, voz, cámara, ruta).
3. Regla de veracidad de `CLAUDE.md`: nada de cifras sin fuente, simulaciones rotuladas, sin comparaciones con marcas reales.
4. Diseño: la dirección aprobada es `.claude/skills/senda-cinematic-web/SKILL.md` (web) y la portada estilo Apple `/senda/app` (app).
5. Registrar cada entrega en `docs/CUMPLIMIENTO.md` con hora y hash.

## Reparto propuesto
- **Antigravity**: financiación y convocatorias (sigue en su documento), mejoras visuales sobre las páginas existentes de master.
- **Claude**: app Android (roles, comunicación móvil a móvil, ruta, voz, cámara), núcleo y pruebas.

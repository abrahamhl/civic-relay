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

## Si Antigravity no puede hacer push (comprobado el 23-11 a las 19:2x: no ha llegado ninguna rama nueva)
Causas más probables, en orden:
1. **Archivos de más de 100 MB** (GitHub los rechaza con `GH001: Large files detected`; su rama anterior traía ZIPs de Hostinger y master ya tiene vídeos de 70–96 MB). Comprobar: `find . -size +95M -not -path './.git/*'` y sacarlos del commit (`git rm --cached <archivo>`, añadir a `.gitignore`, `git commit --amend` en SU rama).
2. **Rama muy atrasada / push a master** (`rejected … fetch first` o `non-fast-forward`). No empujar a master: crear rama nueva desde el master actual y llevar allí su trabajo:
   ```bash
   git fetch origin
   git checkout -b antigravity/fisica-matematica-20261123 origin/master
   git cherry-pick <commit1> <commit2> …   # o copiar los archivos nuevos
   git push -u origin antigravity/fisica-matematica-20261123
   ```
3. **Credencial sin permiso de escritura o caducada** (`403` / `Permission denied`): renovar el token o la conexión de GitHub de esa herramienta.

Pedir a Antigravity **el mensaje de error exacto** del push: con él se sabe cuál de las tres es.

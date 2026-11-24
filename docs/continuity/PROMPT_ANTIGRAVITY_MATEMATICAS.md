# Prompt para Antigravity: entregar la parte matemática / física de SENDA Drive

Estado a 2026-11-24 13:40Z: en GitHub (`abrahamhl/civic-relay`) no hay ninguna rama de Antigravity con
matemática o física de conducción. Lo único nuevo es `docs(OEP): add 2026-11-24 primary-source funding audit`
(ya integrado en la PR #80). Si ese trabajo existe, está solo en el equipo local de Antigravity.

---

Copia y pega esto en Antigravity:

> Necesito que entregues TODO tu trabajo de matemáticas y física de SENDA Drive (modelos de riesgo, tiempo
> hasta colisión, distancias de frenado, cinemática, calibraciones, scripts de Python, cuadernos, datos).
>
> 1. En la carpeta del repo, ejecuta `git status` y `git log --oneline -20` y pégame la salida.
> 2. Crea una rama NUEVA desde master actualizado: `git fetch origin && git switch -c antigravity/matematicas-drive-20261124 origin/master`.
> 3. Copia ahí tus ficheros en `research/antigravity/drive-math/` (código en `src/`, datos en `data/`, explicación en `README.md`).
> 4. En el README, por cada fórmula o constante: de dónde sale (artículo, norma, medida o «supuesto»). Nada sin fuente se presenta como dato; las simulaciones se dicen simulación.
> 5. Comprueba que NO hay secretos: `git diff --cached | grep -iE "key|token|secret|password"` debe salir vacío. Nada de `.env`, claves ni datos personales.
> 6. `git add research/antigravity && git commit -m "research(drive): matemáticas y física de Antigravity" && git push -u origin antigravity/matematicas-drive-20261124`.
> 7. Si el push falla, NO insistas: crea el paquete con
>    `git bundle create senda-drive-math.bundle origin/master..HEAD`
>    y además un zip: `zip -r senda-drive-math.zip research/antigravity/drive-math`.
>    Pásame los dos ficheros (y el texto exacto del error de push).
>
> No toques master ni otras ramas. No subas binarios de más de 20 MB.

Cuando llegue la rama o el bundle, Claude Code lo revisa (fuentes, pruebas, secretos), lo integra en el
núcleo (`packages/senda`) con pruebas y lo despliega por PR.

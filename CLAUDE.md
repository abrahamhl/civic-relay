# Reglas permanentes del proyecto SENDA / civic-relay

## 1. Veracidad (regla innegociable del fundador)

- **Jamás se inventa un dato.** Ninguna cifra, precio, disponibilidad, porcentaje, fuente, cliente o resultado se presenta si no está medido, calculado con código del repo o respaldado por una fuente citada.
- **Toda simulación se declara como simulación**, en el código (`basis: 'SIMULATION'` o equivalente), en la interfaz, en la documentación y en cualquier respuesta o material para inversores. Una simulación nunca se presenta como resultado real.
- **Un parámetro sin fuente no lleva valor por defecto.** Queda como `null` / «no medido» y el código exige que quien simula lo aporte explícitamente como escenario declarado.
- Si un dato no se puede verificar (red bloqueada, fuente no encontrada), se escribe **«no verificado»** o **«no encontrado»** y se dice qué falta.
- Las afirmaciones de la película y de las presentaciones se comprueban con `node scripts/prove.mjs` antes de publicarse. Si una afirmación depende de algo que no existe en el país del que se habla, se corrige.
- Antes de entregar cualquier trabajo: repasar cada cifra y preguntarse «¿de dónde sale?». Si la respuesta no es «medido», «calculado por este código» o «fuente X», se quita o se etiqueta.

## 2. Forma de trabajar

- Idioma con el fundador: español, directo, sin preguntas innecesarias cuando el objetivo está claro.
- Rama de trabajo: la que asigne cada sesión. No se fuerza el push salvo para reiniciar la rama desde master tras una fusión. Hoja de ruta de la app: `docs/ROADMAP_APP.md`; prompt de trabajo: `docs/prompts/SONNET_SENDA_APP_2026-11-23.md`.
- Pruebas: `node --test packages/senda/tests/*.test.mjs`; copia web con `node packages/senda/scripts/sync-web.mjs`.
- Seguimiento de compromisos: `docs/CUMPLIMIENTO.md` (se revisa cada hora mientras haya trabajo abierto). Cada entrada lleva la hora y el hash del commit que la respalda; nunca una hora estimada.
- La bóveda de defensa queda separada de las superficies civiles.
- Toda web, página, presentación, vídeo o explicador sigue la skill `.claude/skills/senda-cinematic-web/SKILL.md` (dirección aprobada por el fundador el 20-11-2026; referencia: `/senda/explica`).

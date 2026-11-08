# Prompts de vídeo para Antigravity

Usar en este orden:

1. `00_MASTER_PROMPT.md` — contexto, reglas y plan completo. Pegar primero.
2. `01_PELICULA_M95.md` — película principal, escena nueva de prueba y render 1080p.
3. `02_RUTA_Y_SIMULACIONES.md` — película de carretera, cortes y simulaciones.
4. `03_VOZ_Y_SUBTITULOS.md` — cambios de voz, VTT es/en/nl y revisión lingüística.
5. `04_WEB_DESPLIEGUE_PROTECCION.md` — integración web, cabeceras, Vercel y Hostinger.
6. `05_QA_ACEPTACION.md` — auditoría final y evidencia.

Cada prompt presupone que Antigravity ha leído:

- `docs/handoff/08_ANTIGRAVITY_VIDEO_HANDOFF.md`
- `docs/handoff/07_VIDEOS_3D_RUNBOOK.md`
- `docs/handoff/02_AGENTES_Y_PROMPTS.md` (bloque común)

Regla de uso: no ejecutar el prompt 04 (producción) hasta que el 05 tenga sus puertas de contenido, voz, subtítulos, imagen y seguridad en verde. Si falta la revisión nativa del neerlandés, el correo real de seguridad o las credenciales de Vercel, el estado correcto es `BLOCKED`, no «hecho».

# Prompt maestro para abrir la nueva conversación

> **Nota (08-11-2026):** documento histórico. Para la suite de vídeo usa **[08_ANTIGRAVITY_VIDEO_HANDOFF.md](08_ANTIGRAVITY_VIDEO_HANDOFF.md)** y `prompts/antigravity/`. La licencia actual es **MIT**; los objetivos de este prompt no autorizan relicenciar ni cambiar la marca sin decisión expresa del fundador.

Copia todo el bloque en el primer mensaje del proyecto nuevo. Después, lanza los agentes de
[02_AGENTES_Y_PROMPTS.md](02_AGENTES_Y_PROMPTS.md) uno a uno o en paralelo.

```text
Proyecto: SENDA — Sistema de Enrutamiento de Emergencia por canales alternativos. Lema: «Offline first, for sure».
Fundador y titular: Abraham Haddioui. Toda decisión de alcance, licencia, marca, precio o promesa pública es suya.

Contexto verificable (08-11-2026):
- Repositorio: https://github.com/abrahamhl/civic-relay (MIT). Rama mission/senda-95-20261108, HEAD b9b1590e776ccc8deb50c53072bf7cb2e99a5f17, PR #23 contra la rama de misión.
- Producción: https://civic-relay-investor.vercel.app (es /es, nl /nl). App: /senda. Pantallas: /senda/red, /senda/incidente, /senda/edificios, /senda/organismo, /senda/estado.
- Película publicada: /media/senda-film-es.mp4 y -en.mp4, subtítulos es/en/nl. La suite profesional M95 (inglés 1080p, VTT es/en/nl, cortes y simulaciones) está pendiente y especificada en docs/handoff/08_ANTIGRAVITY_VIDEO_HANDOFF.md.
- Estado: SENDA 266/266, PCI 13/13, manifiesto 4/4; benchmark DTN SOURCE_ONLY. Puntuación global 6,7/10, PCI 4,5 y seguridad 6,8.
- Para un 9,5 real faltan: piloto de campo, auditoría de seguridad + ENS + DPIA, auditoría de accesibilidad con usuarios y primer convenio.

Lee en este orden antes de hacer nada: docs/handoff/README.md → 01 (PI y licencia) → 02 (agentes) → 03 (Ojo de SENDA 3D) → 04 (desastres) → 05 (certificaciones) → 08 si el encargo es vídeo → docs/architecture/SENDA_ARCHITECTURE.md → docs/research/PROCUREMENT_GAP_2026.md.

Si el encargo es la suite de vídeo, no ejecutes la lista de objetivos siguiente: usa docs/handoff/08_ANTIGRAVITY_VIDEO_HANDOFF.md y los prompts de docs/handoff/prompts/antigravity/.

Objetivo de esta fase (por orden):
1. Repositorio limpio de SENDA: estructura, licencias por capa (núcleo MIT/Apache-2.0, servidores AGPL-3.0 + licencia comercial, consola propietaria), CLA, NOTICE, TRADEMARK.md, SBOM, CI. Sin perder la prueba de autoría (referencia al commit c933c9b).
2. Ojo de SENDA (/senda/ojo): imagen operativa 3D offline con capas de licencia verificada, según docs/handoff/03.
3. Adaptadores físicos de portadores (RockBLOCK, Meshtastic) con simuladores y pruebas.
4. App de campo trilingüe (es/en/nl) con accesibilidad WCAG 2.1 AA.
5. Paquete inversor y de financiación pública con cifras verificadas.
6. Verificar lo pendiente: web de cámaras y comunicaciones de El Tiemblo / San Martín de Valdeiglesias, qué es SITRE, documentación oficial del proxy de WhatsApp.

Reglas: las del bloque común de docs/handoff/02_AGENTES_Y_PROMPTS.md (offline first, verdad verificable, consentimiento y ley, SENDA es canal secundario, tests en verde antes de cada commit, la decisión final es del fundador, entrega Entrada→Procesamiento→Validación→Salida con nota de confianza).

Empieza como orquestador (agente A0): dame el plan de 4 semanas con dueño, dependencias y criterio de aceptación por tarea, y pregúntame lo que necesites antes de tocar licencia, marca o alcance.
```

# SENDA · cómo trabajar con Claude Code entre ordenador, nube y móvil

Fecha: 14-11-2026. Escrito por Claude Code (sesión en la nube). Las cifras de precios salen de la tabla de modelos de la guía oficial de la API (cacheada a 03-11-2026). Los límites de uso del plan de suscripción **no están verificados** desde aquí.

## 1. Por qué una sesión en la nube «no ve» algunas cosas

| Qué | Por qué | Cómo se arregla |
|---|---|---|
| Tu ordenador (carpetas, otros chats de la app de escritorio) | La sesión en la nube corre en un contenedor de Anthropic, no en tu PC. Solo puede usar carpetas que tú compartas con **Remote Control**, y ahora mismo no hay ninguna compartida | App de escritorio → Ajustes → Claude Code → Remote Control → añadir la carpeta del repo. También puedes trabajar directamente en una sesión local |
| Webs de datos (DGT, Madrid, AEMET…) | El entorno «Default» tenía la red **limitada** y sin dominios permitidos | **Hecho el 14-11:** esta sesión se ha pasado al entorno **civic-relay**, que permite 22 fuentes (DGT NAP, informo.madrid.es, NASA FIRMS, Copernicus, GDACS, NDW, INE, TfL, Caltrans…). Para añadir más: pídeselo a Claude en la sesión y te saldrá una tarjeta para aprobarlo |
| Otros chats (vídeos, revisiones científicas…) | Cada sesión tiene su propia memoria; no lee los chats de las demás | La **memoria compartida es el repo**: `CLAUDE.md` (reglas), `docs/CUMPLIMIENTO.md` (compromisos y revisiones), `00_CHANGELOG.md` (qué se hizo). Cualquier sesión nueva que abra el repo los lee |
| Claves y secretos | Nunca se escriben en el chat ni en el repo | Cuando una API necesite clave, Claude abre un formulario seguro («network secret»); la clave se guarda en el entorno, no en el chat |

## 2. Organización recomendada (un solo sitio de verdad)

- **GitHub `abrahamhl/civic-relay`** es la fuente de verdad del código, la web y los documentos. Todo lo demás son copias.
- **Google Drive → `Proyectos/SENDA`** (creada el 14-11) guarda lo que se descarga o se comparte:
  - `01 · Web (zip para Hostinger)`: zips listos para subir a `public_html`.
  - `02 · Comercial e inversores`: pitch, guion de demo, presentaciones.
  - `03 · Vídeos`: grabaciones de la app real.
  - `04 · Ciencia y papers`.
  - `05 · Privado (no compartir)`: sin permisos heredados.
  - `99 · Archivo (carpetas antiguas)`: aquí se moverán las más de 15 carpetas «senda» y «@civic-relay» dispersas en tu Drive, cuando confirmes cuáles.
- **Secretos:** van en un gestor de contraseñas (Bitwarden, 1Password…) o en los «network secrets» del entorno. **Nunca** en Drive ni en GitHub.

## 3. Sesiones por tema, misma memoria

Mantén pocos chats, uno por frente. Todos sobre el mismo repo y la misma rama de integración:

| Sesión | Qué hace | Modelo sugerido |
|---|---|---|
| Producto e integración | Código, pruebas y web | Sonnet 5.5 (Opus 5.5 para arquitectura) |
| Veracidad y ciencia | Auditorías, fuentes, papers | Opus 5.5 |
| Vídeos | Grabaciones y montaje | Sonnet 5.5 |
| Inversores | Material comercial | Sonnet 5.5, con revisión de Opus 5.5 antes de enviar |
| Revisión horaria (tarea programada) | Cumplimiento | Sonnet 5.5 |

Para empezar una sesión nueva, escribe primero: «Lee CLAUDE.md, docs/CUMPLIMIENTO.md y la última entrada de 00_CHANGELOG.md antes de nada».

## 4. Modelos: precio por millón de tokens (API, tabla oficial a 03-11-2026)

| Modelo | Entrada | Salida | Frente a Opus 5.5 |
|---|---|---|---|
| Fable 5.2 | 8 $ | 40 $ | el doble de caro |
| **Opus 5.5** (el actual) | 4 $ | 20 $ | — |
| **Sonnet 5.5** | 2 $ | 10 $ | **la mitad** |
| Haiku 5.5 | 0,10 $ | 0,50 $ | 40 veces más barato |

- **Sonnet 5.5 rinde el doble con el mismo dinero, no cuatro veces.** Es la mejor opción para el trabajo diario de código.
- **Haiku 5.5** sirve para tareas masivas y sencillas (clasificar, resumir, subagentes que leen mucho), no para decisiones de arquitectura ni para auditar veracidad.
- En Claude Code se cambia con `/model`. En una suscripción, el consumo se mide contra el límite del plan; la proporción exacta **no está verificada** desde aquí.

## 5. Subir la web a Hostinger

1. Descarga `senda-web-1-app.zip` desde Drive (`01 · Web`).
2. Hostinger → Administrador de archivos → `public_html` → Subir → Extraer.
3. Abre `https://TU-DOMINIO/senda` (demo: `/senda/demo`, mapa: `/senda/atlas`).

El zip incluye un `.htaccess` para que funcionen las URL limpias. **No está probado en un Apache real**; si alguna página da 404, avísame. Hace falta HTTPS para la cámara, el micrófono, la ubicación y el modo sin conexión.

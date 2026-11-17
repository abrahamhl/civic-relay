# MATRIZ DE INTEGRACIONES EXTERNAS (LINK FIRST)

**Estrategia:** SENDA LIVE no descarga ni aloja masivamente vídeos ni imágenes de terceros. Utiliza la estrategia **LINK FIRST**, resolviendo metadatos permitidos mediante oEmbed oficial o safe-fetch con protección anti-SSRF, y cargando reproductores oficiales autorizados bajo demanda del usuario (Click-to-Load).

---

## Matriz de Proveedores y Capacidades

| Proveedor | Modo de Extracción | Tipo de Visualización | Soporte OAuth Creador | Estado de Integración |
| :--- | :--- | :--- | :--- | :--- |
| **YouTube** | oEmbed público oficial | IFRAME Click-to-load (`youtube-nocookie.com`) | Requiere app verificada | `IMPLEMENTED` / `OEMBED_PUBLIC` |
| **TikTok** | oEmbed público oficial | IFRAME Click-to-load (`player/v1`) | Login Kit Display API | `IMPLEMENTED` / `OEMBED_PUBLIC` |
| **Bluesky** | oEmbed AT Protocol | IFRAME Click-to-load (`embed.bsky.app`) | DPoP + PAR especificado | `IMPLEMENTED` / `OEMBED_PUBLIC` |
| **X (Twitter)** | oEmbed público (`omit_script`) | Tarjeta de Enlace (sin widgets.js) | Requiere X Developer App | `IMPLEMENTED` / `LINK_CARD_ONLY` |
| **Instagram** | Detección de URL canónica | Tarjeta de Enlace | Requiere Meta App Review | `APPROVAL_REQUIRED` / `LINK_ONLY` |
| **Facebook** | Detección de URL canónica | Tarjeta de Enlace | Requiere Meta App Review | `APPROVAL_REQUIRED` / `LINK_ONLY` |
| **Web / Prensa** | OpenGraph seguro (Anti-SSRF) | Tarjeta de Enlace con titular y medio | N/A | `IMPLEMENTED` / `SAFE_FETCH` |

---

## Protección Anti-SSRF (Safe-Fetch)
- Bloqueo de rangos IPv4/IPv6 privados, loopback, link-local, multicast y CGNAT mediante `net.BlockList`.
- Resolución DNS segura dentro de la propia conexión de Node.js (prevención de Time-of-Check / Time-of-Use DNS Rebinding).
- Máximo 3 redirecciones con revalidación de destino en cada salto.
- Límite de descarga: 512 KB con descarte de Content-Length abusivo.

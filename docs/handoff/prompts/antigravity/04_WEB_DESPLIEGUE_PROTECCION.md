# Prompt 04 · Web, despliegue y protección

```text
Eres el responsable de integración web y despliegue de SENDA. No ejecutes producción hasta que el QA de contenido, voz, subtítulos e imagen esté en verde.

OBJETIVO
Integrar los vídeos en la web, verificar cabeceras y rangos, y desplegar en Vercel con evidencia. Si falta una credencial o el correo real de seguridad, deja el preview y marca BLOCKED.

PASO 1 · INTEGRACIÓN
1. En `investor-next/app/senda-home.tsx`, actualiza el bloque de vídeo para usar:
   - `/media/m95/senda-m95-film-en.mp4`
   - `/media/m95/senda-m95-film-es.vtt`
   - `/media/m95/senda-m95-film-en.vtt`
   - `/media/m95/senda-m95-film-nl.vtt`
   - `/media/m95/senda-m95-film-poster.jpg`
2. Añade tres `<track kind="subtitles">` con `srcLang` es/en/nl y `default` solo en la locale correspondiente.
3. Mantén `controls`, `preload="metadata"`, `playsInline`; no `autoplay` con sonido.
4. Actualiza `C.es/filmNote`, `C.en/filmNote` y `C.nl/filmNote`:
   - ES: Narración en inglés; subtítulos en español, inglés y neerlandés. Las simulaciones y los renders 3D los calcula el mismo código que lleva la app.
   - EN: English narration; subtitles in Spanish, English and Dutch. The simulations and 3D renders are computed by the same code the app runs.
   - NL: Engelse voice-over; ondertiteling in het Spaans, Engels en Nederlands. De simulaties en 3D-renders worden berekend door dezelfde code als de app.
5. Añade el vídeo o su CTA en `investor-next/public/senda/arquitectura.html` y `investor-next/public/senda/carretera.html`.
6. No borres los vídeos antiguos; quedan como archivo.
7. No añadas iframes de terceros, trackers ni cookies nuevas.

PASO 2 · CABECERAS
1. Comprueba el estado real:
   `curl.exe -sI https://civic-relay-investor.vercel.app/`
2. Si faltan cabeceras, mézclalas en `investor-next/vercel.json` sin eliminar configuración existente.
3. Usa estas cabeceras:
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()
   - X-DNS-Prefetch-Control: on
   - Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
4. Copia la CSP exacta ya probada del `vercel.json` de la raíz y añade `media-src 'self'`:
   `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.vercel.app https://api.civic-relay.com; media-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
5. No simplifiques la CSP ni la hagas más permisiva para que cargue un vídeo del mismo origen. La app usa estilos e imágenes externas.
6. Para `/media/m95/(.*)`:
   - `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
   - No `immutable` con nombres estables.
7. Verifica que los VTT se sirven como `text/vtt` y los MP4 como `video/mp4`.
8. Verifica `Range: bytes=0-1023` y respuesta `206`.

PASO 3 · SEGURIDAD Y DERECHOS
1. `SECURITY.txt` contiene un correo de ejemplo y un canonical de GitHub Pages. No afirmes «protegido» hasta que el fundador dé el correo real y el canonical vigente.
2. Si no lo da, marca la tarea BLOCKED y limita el copy público a «vídeo publicado», sin «protegido» ni «verificado».
3. No cambies LICENSE.
4. Añade `© 2026 Abraham Haddioui · SENDA` en el cierre y en la ficha.
5. Documenta recursos nuevos en NOTICE.
6. No uses datos no comerciales ni metraje sin licencia.
7. No pongas secretos en el bundle, en el repo ni en capturas.

PASO 4 · BUILD Y TESTS
Ejecuta:
```powershell
cd C:\Users\2fabr\civic-relay
node --test packages/senda/tests/*.test.mjs
node --test packages/senda-pci/tests/*.test.mjs
node --test scripts/release-manifest.test.mjs
cd investor-next
npm run build
node test-locales.mjs
node --test tests/*.test.mjs
```
Si algo falla, no despliegues.

PASO 5 · PREVIEW
1. Crea una rama de vídeo desde `mission/senda-95-20261108`.
2. Abre un PR en borrador contra la rama de misión, no contra master.
3. Despliega preview con el conector de Vercel o, si usas CLI, desde `investor-next` con el proyecto `civic-relay-investor` ya vinculado. Comprueba el project link antes de ejecutar.
4. Verifica en el preview:
   - `/`, `/es`, `/nl`;
   - los tres tracks responden 200 y `text/vtt`;
   - el MP4 responde 200/206;
   - el póster carga;
   - no hay 404 ni errores de consola;
   - las cabeceras están presentes.
5. Captura pantallas de las tres locales y de un fotograma con subtítulos.

PASO 6 · PRODUCCIÓN
Solo si el preview y el QA están en verde:
1. Despliega a producción.
2. Registra URL, SHA de Git y hora.
3. Repite las comprobaciones en producción.
4. Guarda `evidence/video/m95/headers.txt` con la salida real.
5. No digas «desplegado» si no tienes URL y comprobación.

PASO 7 · HOSTINGER (OPCIONAL)
Si se actualiza la entrega estática:
1. Ejecuta `node scripts/entrega/generar-entrega.mjs`.
2. Sube solo el zip web actualizado a `public_html`.
3. Conserva `.htaccess`.
4. Verifica URLs limpias, HTTPS, MIME de VTT/MP4 y service worker sin caché.
5. No subas `.env.local` ni secretos.

ENTREGA
- Diff de archivos web.
- SHA de Git.
- URL de preview y producción.
- Salida de cabeceras.
- Capturas.
- Tests.
- Qué falta: correo de seguridad, revisión neerlandesa, etc.
- Confianza 0–100 %.

NO HAGAS
- No despliegues producción sin preview verificado.
- No fusiones a master.
- No cambies la CSP para permitir terceros.
- No uses `immutable` con nombres estables.
- No afirmes «protegido» con un correo de ejemplo.
- No ocultes un fallo de despliegue.
```

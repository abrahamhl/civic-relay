# SENDA · Léeme primero

> **Generado el {{FECHA}}** desde el commit `{{COMMIT}}`. Dominio de las páginas de inversores: `{{SITE_URL}}`.
> Esta carpeta se entiende **sin haber seguido ninguna conversación**: aquí está todo lo necesario para publicar la web en otro alojamiento, revisar el código y enseñar el proyecto.

## 1. Qué es esta carpeta

SENDA es un sistema de avisos y comunicación para emergencias que **funciona sin Internet ni cobertura**. Usa los teléfonos, los coches y lo que ya existe: satélites, cámaras públicas y datos abiertos de tráfico y meteorología.

Esta carpeta lo empaqueta en zips. Tamaño total: **{{TOTAL}}**.

| Zip | Qué contiene | Tamaño | Nota |
|---|---|---|---|
{{TABLA_ZIPS}}

Además:
- `MANIFIESTO.json`: lista de zips con su tamaño y su huella.
- `SHA256SUMS.txt`: huellas para comprobar que nada se ha corrompido.
- `hostinger.htaccess`: copia legible de la configuración del servidor.

## 2. Subir la web a Hostinger

La web es **estática**: HTML, JavaScript, vídeos. No necesita base de datos, PHP ni Node en el servidor. Va en la **raíz** del dominio (`public_html`), **no en una subcarpeta**.

### Opción A (recomendada): Administrador de archivos de Hostinger

1. Entra en **hPanel → Sitios web → Administrar → Administrador de archivos** y abre la carpeta `public_html`.
2. Si hay un `default.php` o una web anterior, muévelos a una carpeta de copia.
3. Pulsa **Subir** y elige `1-web-hostinger.zip`. Cuando termine, pulsa con el botón derecho → **Extraer**, y extrae **en `public_html`**.
4. Haz lo mismo con los zips de vídeo ({{WEB_ZIPS}}). Cada uno se coloca solo en `media/`.
5. Activa **«Mostrar archivos ocultos»** y comprueba que existe `public_html/.htaccess`. Sin él, las páginas `/senda/...` dan error 404.
6. En **Seguridad → SSL**, activa el certificado y **«Forzar HTTPS»**. El modo sin conexión de SENDA **solo funciona con HTTPS**.
7. Borra los `.zip` del servidor: ya no hacen falta.

> Los nombres de los menús de hPanel pueden cambiar con las versiones del panel. Si no encuentras uno, busca «Administrador de archivos» o «SSL» en el buscador del panel.

### Opción B: por FTP (FileZilla)

1. En **hPanel → Archivos → Cuentas FTP** copia el servidor, el usuario y el puerto (normalmente 21). Si no recuerdas la contraseña, cámbiala allí.
2. En tu ordenador, crea una carpeta `web` y descomprime en ella **todos** los zips de la web, uno tras otro, en la misma carpeta.
3. En FileZilla, menú **Servidor → Forzar mostrar archivos ocultos**, para que se suba `.htaccess`.
4. Conéctate, entra en `public_html` (panel derecho) y arrastra **el contenido** de `web` (no la carpeta) al panel derecho.
5. Activa el SSL como en el paso 6 de la opción A.

### Comprobar que funciona (5 minutos)

1. `https://TU-DOMINIO/` abre la portada para inversores. Comprueba también `/es` y `/nl`.
2. `https://TU-DOMINIO/senda` abre **SENDA Campo**. A los pocos segundos debe decir «instalada offline».
3. `https://TU-DOMINIO/senda/fuego` muestra el mapa del incendio, y `/senda/trafico` reproduce los vídeos reales.
4. **Prueba sin red:** con `/senda` ya abierta una vez, pon el móvil en modo avión y recarga. Debe abrir igual.

| Si ves esto… | Causa probable | Solución |
|---|---|---|
| Error 404 en `/senda/fuego` (pero `/senda/fuego.html` sí abre) | Falta `.htaccess` | Súbelo con los ocultos visibles |
| Página en blanco; en la consola, «Failed to load module script» | El servidor no conoce los `.mjs` | Falta `.htaccess` (lleva los tipos MIME) |
| Los vídeos no se reproducen | Falta algún zip de vídeo | Extrae los zips de vídeo en `public_html` |
| No dice «instalada offline» | Sin HTTPS | Activa el SSL y «Forzar HTTPS» |
| La web sale en `tudominio.com/carpeta/` y falla | Las rutas son absolutas | Usa la raíz o un subdominio (`demo.tudominio.com`) con su propia carpeta |

### Cambiar de dominio

- Las páginas de SENDA (`/senda/...`) funcionan con cualquier dominio sin tocar nada.
- Las páginas de inversores llevan el dominio en sus metadatos (enlace canónico y redes sociales). Para poner el vuestro, vuelve a generar la carpeta así:

```
SITE_URL=https://vuestro-dominio.es node scripts/entrega/generar-entrega.mjs --build
```

- Mientras no cambiéis los DNS, la versión de Vercel sigue funcionando: podéis tener las dos a la vez.

## 3. Qué mirar según quién seas

- **Inversor o evaluador:**
  - `documentacion.zip` → `docs/financiacion/RONDA_FINANCIACION_2026-11-05.md`: convocatorias abiertas, qué falta y plan de 90 días;
  - `docs/investor/`;
  - en la web, la película (`/media/senda-film-es.mp4`) y `/senda/estado`, con los resultados de las pruebas.
- **Desarrollador u otra IA que continúe el trabajo:** `documentacion.zip` → `docs/handoff/HANDOFF_COMPLETO_2026-11-05.md`, y después `codigo-fuente.zip`.
- **Quien haga los vídeos:** `docs/handoff/07_VIDEOS_3D_RUNBOOK.md`.
- **Visión de tráfico en Python:** `vision-python.zip` y su `README.md`.

Para comprobar el código en tu ordenador hace falta Node 22. Desde la carpeta descomprimida de `codigo-fuente.zip`:

```
node packages/senda/scripts/sync-web.mjs
node --test packages/senda/tests/*.test.mjs packages/senda-relay/tests/*.test.mjs
cd investor-next && npm install && npm run build && node test-locales.mjs && node --test tests/*.test.mjs
node investor-next/scripts/senda-offline-e2e.mjs
```

La última línea es la prueba de extremo a extremo sin red y necesita Playwright con Chromium.

## 4. Comprobar que los zips están íntegros

- **Windows:** `certutil -hashfile zips\1-web-hostinger.zip SHA256` y compara con `SHA256SUMS.txt`.
- **macOS o Linux:** desde esta carpeta, `shasum -a 256 -c SHA256SUMS.txt`.

## 5. Notas honestas

- Las demostraciones marcan siempre qué es **real** (vídeos procesados, casos con fuente, normativa) y qué es **simulado o ilustrativo**. No hay pruebas de campo todavía: es el siguiente hito.
- SENDA es un **canal secundario**: nunca sustituye al 112, a ES-Alert ni al eCall.
- Los zips son deterministas: si nada cambia, al regenerarlos salen idénticos y el repositorio no crece.

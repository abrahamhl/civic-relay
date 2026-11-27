# Alrededor (`/senda/alrededor`): la cámara con datos reales y dispositivos seleccionables

Estado a 27-11-2026. Código: `packages/senda/src/ar-view.mjs` (probado), `investor-next/public/senda/alrededor.{html,mjs}`.
Se abre desde **Conducir → Alrededor**.

## Qué muestra encima de la cámara
Solo cosas con **posición y fuente**. No hay modelado 3D de los edificios, porque el móvil no puede medirlos.

| Capa | Fuente (en el repo) | Qué da la ficha |
|---|---|---|
| ⚠️ Incidencias oficiales | DGT (NAP) `dgt_incidencias.json`, NDW `nl_ndw_incidencias.json` | Tipo, carretera, desde cuándo, fuente y licencia. Es el dato de la descarga: puede haber cambiado |
| 📣 Avisos SENDA | Avisos que han llegado a este móvil (`senda.ruta.reports`) | Tipo y cuántos móviles lo confirman |
| 📷 Radares oficiales | `dgt_radares_oficiales.json`, `nl_radares_oficiales.json` | Tipo, carretera, límite, fuente y licencia |
| 🎥 Cámaras públicas | `camaras_publicas.json` (DGT, Madrid, Euskadi, RWS, Bruselas) | **Imagen en directo** cuando la fuente la publica, con fuente y licencia |

- **Orden:** por importancia y cercanía (`score = peso / (1 + d/500 m)`). Se pintan hasta 18 marcadores sin solaparse y
  la lista de abajo muestra 40. Lo que queda fuera del campo de visión aparece como flecha en el borde.
- **Precisión:** la del GPS (metros) y la de la brújula (grados). Se avisa en cada ficha. No es realidad aumentada
  métrica.

## Dispositivos (pestaña «Dispositivos», solo en el APK de Android)
- **Qué se ve:**
  - cada punto Wi-Fi, cada dispositivo Bluetooth y cada móvil SENDA detectado, con su intensidad (dBm) y su clase;
  - su tendencia (acercándose o alejándose) y cuándo se vio por primera y última vez;
  - en el Wi-Fi, si la red está **abierta**.
- **Qué no se ve:**
  - ni el nombre de la red (SSID) ni la dirección (MAC): el identificador es un número efímero de la sesión;
  - ni la dirección en la imagen: Android no la da, así que los dispositivos van en una lista, no pintados como si se
    supiera dónde están.
- **Redes abiertas:** las marca `WifiSecurity.java`, con su prueba JVM `WifiSecurityTest` (9/9).

## Pasarelas en una emergencia: dónde está la línea
- **Sí:**
  - redes Wi-Fi **abiertas** (sin contraseña), que se ofrecen a cualquiera;
  - **Puntos SENDA** que su dueño instala;
  - **móviles SENDA** con el permiso dado al instalar la app (malla de usuarios);
  - nuestros servidores.
  Así un mensaje cifrado puede «rebotar» hasta salir a Internet.
- **No:**
  - conectarse a una red **protegida** o usar la fibra de alguien sin su permiso, aunque sea una emergencia. Es acceso
    ilícito a un sistema de información: en España, art. 197 bis del Código Penal; en la UE, Directiva 2013/40/UE;
  - tampoco entrar en ningún dispositivo.
  Por eso la ficha de una red protegida dice «SENDA no la usa».
- **Llamar al 112** funciona desde cualquier red móvil disponible, incluso sin SIM; para eso la ley ya obliga a los
  operadores.

## Pruebas
- `packages/senda/tests/ar-view.test.mjs`, 5 pruebas con los datos reales del repositorio:
  - geodesia;
  - normalización con fuente;
  - importancia;
  - proyección y separación de etiquetas;
  - fichas sin MAC.
- Navegador (Pixel 7 emulado, Puerta del Sol, rumbo 75°): 6386 puntos cargados, 18 marcadores, ficha de cámara con la
  imagen en directo de Plaza Canalejas y ficha de red abierta.

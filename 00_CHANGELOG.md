# Changelog

## SENDA v0.17 · 05-11-2026 · Visión con vídeo real, coches conectados, fusión de posición y renders realistas

**Entrada (fundador):**
- Simuladores y renders menos infantiles.
- Proyectos de Python que siguen vehículos en cámaras: probar con imágenes reales cuánto tráfico hay por minuto, en qué tramo y cuándo se acerca.
- Integrar coches conectados y eléctricos (datos a los fabricantes, acuerdos con marcas, módulos de emergencia) con el resto de puntos (aerogeneradores, Wi-Fi, otros coches, Waze, Google Maps, radares, satélite).
- Diseñar el backend de conexión.

**Procesamiento:**
- **`packages/senda-vision/` (Python, nuevo):**
  - detector **YOLOX-s en ONNX (Apache 2.0)** sin PyTorch y seguimiento **ByteTrack** (supervision 0.26.1, MIT);
  - dibujo sobrio: esquinas, etiquetas, estelas y panel con la tipografía Inter;
  - `track_fixed.py`: conteo por sentido en una línea y ritmo por minuto;
  - `track_dashcam.py`, el coche como sensor:
    - tiempo hasta alcanzarlo sin calibrar, por la altura de la caja;
    - distancia estimada por la altura de un turismo;
    - vehículos de la calzada contraria contados como contactos del SOS;
    - filtros de artefactos (cajas en el borde, acercamientos de más de 25 m/s).
  - Ultralytics se descarta para el producto por su licencia AGPL-3.0.
- **Vídeos reales procesados y publicados** en `/media/vision/`:
  - cámara a bordo (Udacity, MIT): 12 vehículos seguidos en 36 s, 15 contactos por minuto de la calzada contraria y ningún falso «¡Frena!»;
  - cámara fija (Intel, CC BY 4.0): 1 vehículo en 30 s en un aparcamiento, presentado como dato real.
- **Núcleo `vehicle-link.mjs` (6 pruebas):**
  - fuentes con su base legal: Ley de Datos de la UE (art. 5), DFRS/SRTI, OBD-II, Android Automotive, cámaras, aforos, V16 y Waze; el eCall y la reidentificación son NUNCA;
  - 8 categorías SRTI y eventos del coche → avisos;
  - **k-anonimato** por celda de vía y franja de tiempo;
  - velocidad por tramo con **Kalman** y varianza que crece con la edad del dato;
  - **posición por mínimos cuadrados con GNSS, vía, rumbo a un aerogenerador, Wi-Fi con tiempo de vuelo y otro coche**: de ~10 m a **0,3–2,1 m** en 6 semillas;
  - puentes entre la visión y el núcleo.
- **Render:** el kit de lienzos dibuja coches y camiones con volumen (sombra, degradado, lunas, retrovisores, faros, pilotos de freno con brillo), asfalto con textura y marcas viales, choque vectorial y personas sin rasgos.
  - Aplicado a la cadena de frenadas, el sentido contrario, la escena PAS, la retención de la DGT y el rood kruis.
  - Fuera los emojis de las animaciones de carretera.
- **Web:** `/senda/trafico` (vídeos reales con sus métricas y cómo se conecta todo) y `/senda/vehiculos` (fuentes, fusión de posición paso a paso, velocidad por tramo, privacidad y arquitectura). Además, arquitectura (2 piezas y 2 aplicaciones), portada (es/en/nl), service worker v18 y E2E.
- **Documento:** `docs/architecture/BACKEND_VEHICULOS_Y_FUSION_2026-11-05.md`.

**Validación:** núcleo + relé 198/198 · E2E en Chromium 45/45, sin red (accesibilidad en 24 pantallas) · web: compilación, idiomas y 98/98.

**Límites:**
- No hay vídeo real de autovía con cámara fija y licencia libre accesible desde esta sesión: el conteo de alta densidad queda para las cámaras públicas reales.
- Distancias aproximadas (±30 %).
- Carril propio marcado a mano.
- Adaptadores reales de fabricantes, DFRS y Android Automotive pendientes de convenio y de verificar.
- La escena 3D de la frenada sigue pendiente.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.16.1 · 05-11-2026 · Vídeo «ruta» publicado en español e inglés

**Entrada (fundador):**
- Grabar y publicar el vídeo `ruta` en español, ya validado.
- Hacer la versión inglesa con las mismas cifras y la misma honestidad: «synthetic image», «invented road», «SENDA never replaces 112».
- Enlazarlos en la portada y en `/senda/arquitectura` sin quitar los vídeos existentes.

**Procesamiento:**
- Máquina: kokoro-onnx 0.6.1, modelos `kokoro-v1.0.onnx` y `voices-v1.0.bin` (lanzamiento `model-files-v1.0`) y ffmpeg.
- Español: `CORE=192 E2E=43 ./make.sh ruta es publicar` → `investor-next/public/media/senda-ruta-es.mp4` (3:29, 8,2 MB), `.vtt` y póster.
- Inglés: `title.en`, `en` y `en_say` en las 12 escenas de `ruta.json`, con el mismo número de frases que `es`. Voz `bf_emma` (en-gb), 3:38.
  - Los rótulos dibujados en los lienzos de la app siguen en español. Por eso la narración inglesa dice en voz alta lo que en español solo aparece en pantalla: «In this simulation» (SOS sin cobertura), «The road shown is invented» (PK) e «In this example» (aforos).
- Web:
  - **Portada (es/en/nl):** bloque nuevo `#ruta` bajo la película. Muestra el vídeo del idioma (en `nl`, el inglés con subtítulos neerlandeses por defecto) y el otro idioma desplegable, cada uno con sus propias pistas de subtítulos.
  - **`/senda/arquitectura`:** tarjeta nueva tras la del vídeo de capacidades, con el vídeo español y el inglés desplegable.
  - **`/senda/carretera`, visualización `sos`:** ciclo de 20 → 24 s. La escena inglesa dura 22,2 s y el contador volvía a «minuto 0,8» justo antes del corte; ahora mantiene el resultado final («SOS fuera de la zona sin red a los 7,4 min»). El vídeo español no cambia: todos sus fotogramas caen antes del segundo 20.
  - Service worker `senda-campo-v18`, para que quien ya tenga la app instalada reciba `arquitectura` y `carretera` nuevas.
- **Integración con el commit paralelo `692a3a8`**, que hizo la misma tarea mientras tanto:
  - se conservan sus subtítulos `nl`, alineados con este audio inglés solo donde el contenido cambia (simulación, carretera inventada, imagen sintética, «vervangt nooit 112», un carril por sentido, Guardia Civil y DGT), y su sección de vídeos en `/senda/carretera`;
  - el texto inglés y los MP4 son los de esta entrada: el inglés remoto no decía «synthetic image», «invented road» ni «SENDA never replaces 112», y su render no mostraba los emojis de los lienzos;
  - `senda-ruta-nl.vtt` se ha regenerado con los tiempos de esta voz inglesa (23 cues, mismos tiempos que `en`). El commit `692a3a8` sigue en el historial.
- Kit de vídeo:
  - `make.sh` publica también `senda-<guion>-nl.vtt` cuando `voice.py` lo acaba de generar.
  - `validate.mjs` ya no marca como promesa prohibida un aviso **negado** («SENDA never replaces 112», «nunca sustituye al 112»). La afirmación sigue bloqueada (probado con un guion de prueba).
  - `voice.py` solo genera subtítulos `nl` si todas las escenas los traen (antes fallaba con `ruta.json` en inglés).
  - Guía: `--stills` necesita `SCRIPT=<guion>`.

**Validación:**
- `validate.mjs ruta es|en` sin errores; `script` y `features` siguen validando.
- Subtítulos es/en: 23 cues cada uno, idénticos a las frases leídas y sin fonética (comprobación automática).
- Fotogramas sueltos de las 12 escenas (arranque, mitad y final en 3 de ellas): sin pantallas en blanco ni textos cortados; `verify` muestra 192/192 y 43/43.
- La voz publicada es idéntica bit a bit a la revisada; el MP4 publicado frente al revisado da un PSNR de 47 dB.
- Núcleo + relé 192/192 · E2E en Chromium 43/43, sin red (accesibilidad en 22 pantallas) · web: compilación, idiomas (es/en/nl) y 98/98.
- Portada (es/nl) y `/senda/arquitectura` compiladas: cada vídeo nuevo, su póster y su `.vtt` responden 200; capturas en escritorio y en móvil (390 px) sin solapes.

**Límites:**
- En el vídeo inglés, los rótulos de los lienzos de las páginas de la app están en español (los títulos, la escena 3D, `verify` y el cierre sí salen en inglés).
- En r5, r7, r8 y r9 la animación de la página vuelve a empezar dentro de la escena, en los dos idiomas: es el bucle normal de cada página. Ya estaba así en el español validado.
- Quedan pequeños solapes en los lienzos de la app: «tú» sobre «EST-1» (`dgt`), «Ana · coordina» pegado a «Luis» (`carretera`, escena) y la línea de la calzada sobre «en sentido contrario».
- La lista «lo que falta» de la escena `verify` es la genérica de `film.html` (pilotos, auditoría, certificación) y no la que se narra (ensayos en carretera, app nativa, convenios con la DGT).

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.16 · 05-11-2026 · Infraestructura de la DGT validada y traspaso completo con kit de vídeo

**Entrada (fundador):**
- Seguir con los últimos toques de la DGT.
- Comprobar si los puntos móviles y los radares de la DGT, como posibles pasarelas o emisores, pueden sumarse a SENDA.
- Redactar el traspaso completo para otras IA, con la capacidad de hacer los vídeos 3D con una IA más barata.

**Validación de la idea (con fuentes):**
- **Ningún equipo de la DGT en la vía es una pasarela utilizable** (radares, paneles, cámaras, aforos, postes SOS, balizas V16). Cada uno habla con la DGT por un canal propio y cerrado; usarlo para transmitir sería entrar en un sistema ajeno.
- La única vía oficial es **DGT 3.0 por convenio**.
- **Detectar radares está prohibido desde 2014** (multa y 3 puntos; la cuantía es de 200 o 500 € según la fuente, pendiente del BOE) e **inhibirlos se sanciona con hasta 6.000 € y 6 puntos**.
- **Avisar de la ubicación publicada de un radar fijo es lícito**, como hacen los navegadores.
- Los postes SOS: la DGT anunció en 2010 la retirada de la mayoría y dejar los de zonas sin cobertura; no hay listado actual.

**Procesamiento:**
- Núcleo `dgt-infra.mjs`:
  - catálogo de 10 equipos con lo que emiten, si son pasarela, lo que suman a SENDA, el permiso y la nota legal;
  - zona de control publicada con deceleración hasta el límite;
  - radar de tramo con la media y el aviso; nunca sugiere superar el límite;
  - aforos → final de la retención y su onda de choque;
  - texto de los paneles (es/nl) → aviso.
- `datex2.mjs`: medidas de estaciones de aforo (MeasuredDataPublication) y paneles, con ejemplos construidos según el esquema.
- `platforms.mjs`: integraciones de radares publicados y aforos o paneles (PASIVO) y detección de radares o controles móviles (NUNCA).
- 4 pruebas nuevas.
- Web `/senda/dgt`: equipo por equipo, aforos → cola (modo película), radares publicados con el límite y paneles. Además, arquitectura, portada (es/en/nl), service worker v17 y E2E.
- Vídeo:
  - `media/senda-film/validate.mjs` comprueba el guion antes de gastar CPU;
  - `make.sh` hace todo de un comando: validar, voz, imagen, mezcla y publicación;
  - nuevo guion `ruta.json` (12 escenas, 3:29), con la voz ya generada y fotogramas de muestra revisados.
- Traspaso:
  - `docs/handoff/HANDOFF_COMPLETO_2026-11-05.md`: estado, mapa, principios, procedimiento, despliegue, bloqueos, decisiones y mensaje de arranque;
  - `docs/handoff/07_VIDEOS_3D_RUNBOOK.md`: guía de vídeo para una IA más barata.

**Validación:** núcleo + relé 192/192 · E2E en Chromium 43/43, sin red (accesibilidad en 22 pantallas) · web: compilación, idiomas y 98/98 · guion `ruta.json` validado, voz generada y fotogramas correctos.

**Límites:**
- La red de esta sesión bloquea los portales de la DGT y de NDW: aforos y paneles, probados con ejemplos construidos según el esquema.
- Vídeos `senda-ruta-es.mp4` y `senda-ruta-en.mp4` (con subtítulos `es`, `en` y `nl`) grabados y publicados en `investor-next/public/media/`.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.15 · 05-11-2026 · Situaciones al volante, V16 + SENDA, cámaras públicas y exportación a Países Bajos

**Entrada (fundador):**
- La V16 conectada siempre está activa y con SIM: SENDA le da el sentido que le falta.
- Cubrir todas las situaciones al volante.
- Integrar los datos de la DGT y de Países Bajos (carriles cortados, desvíos, obras, Waze) como primera exportación.
- Un módulo de cámaras públicas (DGT y otras fuentes, repositorios abiertos).
- Mi opinión sobre el proyecto y cómo acotarlo.

**Procesamiento (núcleo: 3 módulos nuevos, 16 pruebas más):**
- `drive-cases.mjs`: catálogo de 20 situaciones, cada una con su señal, acción, fuente, estado y permiso.
  - **Sentido contrario:** lo detecta el propio móvil con tres posiciones contra la calzada, y calcula el tiempo hasta cruzarse.
  - **Final de retención:** onda de choque de Lighthill-Whitham-Richards (−14,3 km/h en el ejemplo) y punto de encuentro.
  - **Niebla y firme:** velocidad para parar dentro de lo que se ve (50 m: 64 km/h en seco, 53 en mojado) y distancias con el rozamiento.
  - **Curvas:** radio exacto desde la geometría y velocidad AASHTO; la horquilla de 40 m da 30 km/h.
  - Fatiga, caída de motorista y agua en la calzada (umbrales del servicio meteorológico de EE. UU.).
  - **V16 + SENDA (`v16Fusion`):** la baliza dice dónde y SENDA dice qué pasa. Un choque sin baliza pide encenderla.
- `datex2.mjs`:
  - lector DATEX II (v2 y v3, con o sin prefijos) para cualquier Punto de Acceso Nacional (Reglamento Delegado (UE) 2022/670);
  - conversión a avisos SENDA y pasillo de la ruta;
  - **señales de carril neerlandesas (rood kruis)** con aviso en neerlandés, español e inglés;
  - nuevo `scripts/datex-pack.mjs` para que el relé descargue DGT o NDW.
- `cameras.mjs`:
  - fuentes con licencia y permiso; las cámaras sin permiso, los agregadores tipo «Ojo de Dios» y la biometría quedan en NUNCA, y Rijkswaterstaat solo por convenio;
  - **visibilidad en metros** por canal oscuro y ley de Koschmieder, con un error menor del 15 % y del lado prudente;
  - índice de nieve.
- `road-guard.mjs`: tipos nuevos de peligro (carril cerrado, sentido contrario, puente abierto, inundación, incendio) y relevancia del sentido contrario.
- `platforms.mjs`:
  - **perfiles de país España y Países Bajos** y `countryPlan`;
  - integraciones: feed de Waze y NDW, cámaras abiertas, cámaras sin permiso (NUNCA) y SIM de la V16 (NUNCA).

**Web:**
- `/senda/camaras`: visibilidad medida en una cámara (modo película), prueba con la cámara del teléfono y fuentes con su permiso.
- `/senda/paises`: perfil por país, rood kruis hablado (modo película), lector DATEX II en el navegador y lista para el piloto neerlandés.
- `/senda/carretera`: V16 + SENDA, retención en un diagrama espacio-tiempo (modo película), sentido contrario (modo película), catálogo de situaciones y calculadoras.
- Arquitectura: 3 piezas, 2 aplicaciones y el escenario «Países Bajos».
- Portada (es/en/nl) y service worker v16.

**Validación:** núcleo + relé 188/188 · E2E en Chromium 42/42, sin red (accesibilidad en 21 pantallas) · web: compilación, idiomas y 98/98.

**Límites:**
- La red de este entorno bloquea `nap.dgt.es` y `*.ndw.nu`. El lector se ha probado con una publicación construida según el esquema, no con datos reales.
- El formato exacto del feed de señales de NDW está pendiente.
- Las imágenes de cámaras deben leerse desde el relé (el navegador no puede leer píxeles de otro dominio) y cada cámara necesita calibrar su referencia.
- Datos de la V16 (cada 100 s, conectividad) según fabricantes y prensa.

**Decisiones del fundador:** las del documento `docs/evaluacion/FOCO_Y_ACOTACION_2026-11-05.md`.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.14 · 05-11-2026 · Ruta protectora: carretera, frenadas, SOS sin cobertura y coordinador de escena

**Entrada (fundador):** el escenario de los accidentes de coche. SENDA como «senda protectora» que va contigo en el viaje, con permisos al instalar. Integración con Waze y Google Maps y mapas sin conexión. Posición con GPS, telemetría y aerogeneradores. Aviso automático de «frena» si el coche de delante frena de golpe. Avisos de carretera más fáciles. Coordinador ciudadano del accidente con puntos cívicos.

**Procesamiento (núcleo: `road-guard.mjs`, 14 pruebas, más 1 de plataformas):**
- **Frenada brusca** por la velocidad Doppler del GNSS, ajustada por mínimos cuadrados en una ventana de 1,5 s. No depende de cómo vaya colocado el móvil. Por encima de ~13 m/s² ya no es una frenada (un coche frena hasta ~1 g): se trata como golpe.
- **Choque de coche**: el detector de `rail-incident.mjs` con umbrales de coche y cuenta atrás humana.
- **Trama de aviso de 24 bytes**: con las cabeceras suma 31 bytes, un anuncio Bluetooth LE clásico. Lleva relés con tope de saltos.
- **Relevancia del aviso**: mismo sentido, delante y en el mismo carril. Con geometría de la vía se mide la distancia por carretera.
- **Consejo de frenada**: a = v²/2(d − v·t − margen). «¡Frena!» por encima de 3,4 m/s² (deceleración de diseño de AASHTO).
- **Columna de coches con cinemática exacta.** Con 1,2 s entre coches a 120 km/h y niebla:
  - sin SENDA, choque en cadena de 5 coches (hasta 90 km/h de impacto);
  - con SENDA, solo choca el de justo detrás;
  - con 2 s de separación no choca nadie.
- **SOS sin cobertura**: probabilidad de contacto al cruzarse y entrega por los coches que pasan (Poisson). Simulación determinista de una carretera de montaña de 24 km con 18 km sin red y un 10 % de coches con SENDA:
  - el SOS sale en 7,4 min;
  - los que se acercan con SENDA se enteran a una mediana de 6,5 km, gracias al tráfico contrario.
- **PK y sentido sin red**: encaje en la vía, interpolación entre hitos, referencia visible más cercana con su lado («300 m después del aerogenerador AE-12, a la derecha») y estima en túneles.
- **Pasillo de mapas de la ruta**: Madrid–Valencia ocupa 62 MB frente a 951 MB del rectángulo (6,5 %).
- **Avisos de un toque** con creencia bayesiana que se apaga sola, y exportación al formato CIFS de Waze (solo con convenio; campos por validar).
- **SMS de SOS** de 160 caracteres como máximo y guion para el 112.
- **Coordinador de escena PAS**:
  - nadie se confirma a sí mismo;
  - el traspaso solo va a una credencial institucional verificada;
  - los **puntos cívicos** quedan en un libro encadenado por SHA-256 que delata cualquier alteración.
- `platforms.mjs`:
  - plataforma «Coche particular»;
  - integraciones: enlaces a Waze y Google Maps y NAP DGT (PASIVO); DGT 3.0 y Waze CIFS (CONVENIO); leer navegadores (NUNCA);
  - plan «Accidente de carretera» con salvaguarda;
  - hecho «carreteras-2025».

**Web:**
- `/senda/carretera`, con cuatro simulaciones en modo película: cadena de frenadas, SOS que viaja, PK en el idioma del 112 y escena con puntos.
- Sensores reales del teléfono (GPS y acelerómetro) con el mismo detector y aviso por voz.
- Botones reales a Waze y Google Maps y tabla de accesos.
- Avisos de un toque con su trama y su CIFS.
- Arquitectura: pieza «Ruta protectora», aplicación «Carretera» y escenario «Accidente de carretera». El sensor GNSS deja de estar en la hoja de ruta.
- Portada (es/en/nl), SENDA Campo y service worker v15.

**Validación:** núcleo + relé 172/172 · E2E en Chromium 39/39, sin red (accesibilidad en 19 pantallas) · web: compilación, idiomas y 98/98.

**Límites:**
- No lee datos de Waze ni de Google Maps, porque no hay API pública para ello. Les hace llegar avisos por DGT 3.0 o por Waze for Cities, con convenio.
- La difusión Bluetooth entre coches necesita la app nativa: la web no puede anunciar.
- Umbrales y alcance de radio entre coches pendientes de medir en ensayo real.
- Carretera, hitos y aerogeneradores de la demostración son inventados.
- Nunca sustituye la atención del conductor, la distancia de seguridad, el eCall ni el 112.

**Decisión pendiente del fundador:** qué reconocen los puntos cívicos y si hay clasificación pública (por defecto, no).

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.13 · 05-11-2026 · Batería de Internet: reserva de red, biblioteca de vecinos y puntos de rebote

**Entrada (fundador):** que los móviles que ya tienen SENDA guarden una especie de batería, pero de Internet (~1 GB), y la usen como si fuera la red; además, gateways y puntos de rebote para cuando no hay cobertura.

**Procesamiento (núcleo, 3 módulos nuevos, 11 pruebas):**
- `net-reserve.mjs`: catálogo por zona y riesgo y mochila 0/1 exacta por valor y frescura. 1 GB cubre el 95,7 % del valor y lo esencial cabe en 200 MB. Incluye semivida de lo urgente, recarga por densidad en ventanas cortas, recarga por difusión y cola de intenciones.
- `swarm-cache.mjs`: paquete común repartido con Reed-Solomon k-de-n entre vecinos (6 GB entre 40 vecinos: 462 MB por móvil, 99,2 % de recuperación). Inventario con filtro de Bloom (2000 piezas en 2,4 KB) y piezas nombradas por SHA-256, con ida y vuelta real verificada.
- `coverage-memory.mjs`: huellas de cobertura agrupadas por antena, supervivencia sin luz, Tobler y tiempo esperado hasta enviar. Elige un cerro con antena de grupo electrógeno frente a la plaza (antenas agotadas) y frente a esperar al satélite.
- `platforms.mjs`: integraciones OpenCellID, Kiwix, huellas propias (PASIVO) y difusión (CONVENIO); plan «Días sin red».

**Web:**
- `/senda/reserva`: batería animada; **almacenamiento real del dispositivo** (`storage.estimate`, `storage.persist`, batería y tipo de conexión); botón que llena de verdad la reserva con la app; biblioteca de vecinos y puntos de rebote con modo película.
- Arquitectura: 3 piezas nuevas y el escenario «Tres días sin red».
- Portada (es/en/nl), SENDA Campo, service worker v14.

**Validación:** núcleo + relé 157/157 · E2E en Chromium 38/38 (accesibilidad en 18 pantallas) · web: compilación, idiomas y 98/98.

**Límites:**
- Sin red no se puede consultar contenido nuevo de Internet: se usa lo guardado y lo nuevo se encola.
- Mapas detallados, albergues y hospitales necesitan el servidor de contenidos de SENDA (pendiente).
- El transporte de fragmentos entre vecinos y la recogida de huellas reales requieren la app nativa.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.12 · 05-11-2026 · Arquitectura multiplataforma, sentidos ampliados, riadas, triaje, monte y dron casa por casa

**Entrada (fundador):**
- Auditoría desde 5 perspectivas.
- Preparar SENDA para varias plataformas (móvil, ordenador, dron, ferrocarril), también sin acceso a sistemas de terceros.
- Tener en cuenta las tragedias recientes de España y Europa.
- Más «sentidos» reales (dron casa por casa, respiración por Wi-Fi).
- Más escenarios: terremoto, maremoto, conflicto, evacuación de heridos, monte, riadas.
- Infraestructura e ideas de inversión.
- Arquitectura primero; después la web y los vídeos.

**Procesamiento (núcleo, 6 módulos nuevos, 21 pruebas):**
- `platforms.mjs`: plataformas donde corre SENDA, integraciones con modo de acceso (PASIVO = legal hoy · CONVENIO · NUNCA), planes por escenario (8) con planificador de cobertura y lecciones de catástrofes reales con fuente.
- `flood-watch.mjs`: hidrograma de Nash, embalse y alarma por subida aguas arriba. En el escenario sintético, 2 h 30 y 3 h 40 de margen en pueblos donde caen 3 mm. Maremoto con √(g·h) y evacuación vertical.
- `triage.mjs`: START para varias víctimas, RCP para una sola (Consejo Europeo de Resucitación 2021), qué hacer ya, servicios (112 primero) y parte ≤ 160 caracteres. Nunca declara fallecidos.
- `geo-offline.mjs`: resección con rumbos a marcas conocidas (aerogeneradores con luces de balizamiento, antenas, campanarios) con elipse de error, detección de pasos, estima por pasos y tamaño de mapas sin conexión.
- `senses.mjs`: escucha coral (golpes localizados con 5 móviles y relojes desfasados, < 0,5 m tras el pitido de sincronía) y modo detector de avalancha para la baliza Bluetooth.
- `house-sweep.mjs`: dron casa por casa, con orden de visita (vecino más cercano + 2-opt), salidas por batería con reserva y tablero de prioridad (personas probables × daño EMS-98).

**Web (5 pantallas nuevas, con «modo película» `?film=1&viz=` grabable desde la app real):**
- `/senda/sentidos`, `/senda/agua`, `/senda/triaje`, `/senda/monte`, `/senda/barrido`.
- `/senda/arquitectura`: 12 piezas nuevas, 3 escenarios nuevos (riada, monte, múltiples víctimas) y la sección «Plataformas, permisos y planes por escenario» con planificador interactivo.
- Portada (es/en/nl), SENDA Campo, service worker v13.

**Correcciones honestas registradas:**
- Los NOAA con imagen APT se dieron de baja en 2025.
- La respiración por Wi-Fi a través de muros no tiene validación independiente.
- Interrogar aerogeneradores u otra infraestructura ajena queda en NUNCA; usarlos como marcas visibles es PASIVO.

**Vídeo de capacidades (español, 4:13):** grabado fotograma a fotograma desde las propias páginas en modo película (`media/senda-film/features.json`); publicado en `/senda/arquitectura` con subtítulos.

**Auditoría:** `docs/evaluacion/AUDITORIA_5_PERSPECTIVAS_2026-11-05.md` (TRL por capacidad, 5 perspectivas simuladas, huecos, multiplataforma, infraestructura, modelo de negocio, 90 días).

**Validación:** núcleo + relé 146/146 · E2E en Chromium 37/37 (accesibilidad en 17 pantallas) · web: compilación, idiomas y 98/98.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.11 · 04-11-2026 · Malla de voz, despliegue físico y película v5 con simulaciones y 3D

**Entrada (fundador):**
- Seguir creando una arquitectura nueva, pero real, funcional y llevable al plano físico.
- Rehacer la película (inglés y español) incluyendo lo nuevo.
- Que la película se centre en cómo funcionan las simulaciones, los renders 3D, la arquitectura y la app, y en lo fácil que es usarla.

**Procesamiento:**
- `voice-mesh.mjs` (núcleo, nuevo): cadena y sala de voz entre teléfonos que no se alcanzan todos entre sí.
  - Árbol de repetidores con los saltos mínimos.
  - Quien tiene poca batería participa pero nunca repite.
  - Turno de palabra tipo walkie-talkie: 1 flujo por enlace sea cual sea el tamaño de la sala.
  - Replanificación por batería con aviso de quién queda aislado.
  - 5 pruebas.
- `/senda/llamada`: nueva sección «Cadena de voz».
  - Edificio con el árbol elegido y botón «Iker se queda sin batería».
  - Demo real A → B → C en una pestaña con cuatro conexiones WebRTC: C oye el tono de 440 Hz de A (441 Hz medidos) a través de B, y el chat llega reenviado.
- `/senda/arquitectura`: añadidos la pieza «Malla de voz», el escenario «Cadena de voz» y la tabla «Del plano al mundo físico», que dice para cada pieza qué existe hoy y qué falta.
- Película v5 (español 8:36, inglés 8:22; subtítulos es/en/nl): la v4 íntegra más 4 escenas calculadas con el núcleo real (`media/senda-film/sims.js`).
  1. Llamar sin Internet: el código de 91 bytes se convierte en su partitura real de tonos, la conexión es directa y sigue la cadena de voz.
  2. Censo con dron en 3D (three.js): edificio, dron, anuncios Bluetooth y panel con direcciones frente a teléfonos y personas.
  3. Arquitectura en 3D: las 5 capas con el estado real de cada pieza y paquetes recorriendo 4 escenarios.
  4. «Cada imagen es el código real»: código del núcleo ejecutándose, pruebas automáticas, render determinista y «un toque».
- Subtítulos sin fonética: el texto que se pronuncia (`<lang>_say`) va separado del que se lee. Por ejemplo, la voz dice «Rid Sólomon» y el subtítulo muestra «Reed-Solomon».

**Validación:** núcleo 123/123 + relé 2/2 · E2E en Chromium 32/32 (incluida la cadena de voz real) · web: compilación, idiomas y 98/98.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.10 · 04-11-2026 · SENDA como canal de comunicación: llamadas sin Internet, censo radio con dron y arquitectura visible

**Entrada (fundador):** que la app no sea solo sonido sino un canal de comunicación de verdad (llamar y comunicarse en general), que use los sensores del teléfono y de los drones (estimar por radio cuántas personas hay en un edificio), centrarse en la arquitectura del sistema de forma visual y funcional, e inventar tecnología nueva.

**Procesamiento:**
- `sdp-compact.mjs` (núcleo, nuevo): señalización WebRTC compacta. Plantilla común (Opus + canal de datos) y solo lo variable en binario: claves ICE, huella SHA-256 DTLS, rol y candidatos host (IPv4 o mDNS). Oferta 79–103 bytes (~20 veces menos que el SDP), transmitible por el módem acústico en 8–10 s o como código de texto. 4 pruebas.
- `/senda/llamada`: llamada de voz y chat cifrados (DTLS-SRTP) entre dos teléfonos de la misma red local o punto de acceso, sin Internet ni servidor: crear/responder, enviar y escuchar el código por sonido, copiar/compartir, pulsar para hablar, colgar, ida y vuelta, pérdidas, kbit/s y botón «Estoy atrapado». Incluye una **llamada de prueba en un solo dispositivo** (sin micrófono) con la «partitura» de tonos del código.
- `rf-census.mjs` (núcleo, nuevo): censo radio por planta. Planta por RSSI mediano; teléfonos = máximo de direcciones simultáneas por familia (inmune a la rotación de direcciones BLE); personas por **inferencia bayesiana exacta** (0/1/2 teléfonos por persona, hipótesis 12 %/8 % pendiente de calibrar) con mediana e intervalo del 90 %; «0 teléfonos» = «0, quizá 1». Solo recuentos. Escenario sintético realista (personas sin móvil o con dos; generador mulberry32). 8 pruebas.
- `/senda/dron`: fachada en vivo con el dron y los anuncios Bluetooth, tabla por planta (direcciones vs teléfonos vs personas vs verdad simulada), línea de tiempo «cada fila un dispositivo, cada segmento una dirección», distribución posterior, el dron como plataforma de sensores con estado honesto, y privacidad/ley.
- `/senda/arquitectura`: 5 capas (sensores y radios → portadores → núcleo → aplicaciones → destinos), 35 piezas con estado real (navegador / simulación / app Android / app nativa / hoja de ruta), 6 escenarios animados paso a paso (llamada, atrapada tras un sismo, dron, satélite, incendio, vía), ficha de cada pieza con código y enlace, matriz de sensores Android con interfaz y permiso, y fuentes.
- Investigación: `docs/research/SENSORES_Y_CANALES_ANDROID_2026-11-04.md` (Science 2025 sobre alertas sísmicas Android, Wi-Fi Aware, límite de 200 Hz de Android 12, BarcodeDetector, Wi-Fi RTT; infrarrojos descartado como canal).
- Integración: tarjetas nuevas en la portada (es/en/nl), accesos desde SENDA Campo, service worker v11 con las tres pantallas precargadas, E2E ampliada.

**Validación:** núcleo + relé 120/120 · E2E en Chromium 31/31 con las nuevas comprobaciones (llamada con oferta por onda acústica real, voz y chat, cero peticiones de red durante la llamada; demo en un dispositivo; dron; arquitectura; accesibilidad en 12 pantallas). Límite declarado: la emulación «offline» de Chromium también bloquea WebRTC local, así que la llamada se prueba sin ningún servidor y con cero peticiones; falta ensayo con dos teléfonos físicos.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.9 · 04-11-2026 · Corrección de rumbo: portada restaurada, Ojo de SENDA, incendio cartográfico y película v4

**Entrada (fundador):** la v0.8 bajó el nivel. Volver a la portada anterior con sus explicaciones largas; que «ver como» cambie la página de verdad; explicar el globo (satélites, casos y módulos); película con introducción, en inglés y español, al nivel de la v3.

**Procesamiento:**
- Portada restaurada tal como estaba (todas las secciones). Retirados la portada condensada, `/lab`, los cuadros de demos y la película/reels v0.8.
- `audience-filter.tsx`: «Ver la página como» Todo · Ciudadanía · Coordinación · Ingeniería · Inversión. Cada perfil ve su recorrido completo (9–13 secciones, con sus explicaciones) y «Todo» la página entera (20).
- `/senda/ojo` (spec 03): globo en tiempo real con Iridium (66, LEO), Galileo (24, MEO) y QO-100 (GEO), 7 casos reales con fuente y módulos, ruta del aviso caso → satélite → relé → 112 con elevación, distancia y latencia, plan k-de-n con los canales que quedan; terminador día/noche exacto. Incrustado en la portada con explicación en es/en/nl.
- `/senda/incendio`: relieve sombreado, curvas de nivel, vegetación continua, frente con resplandor y humo, isócronas por marching squares, antenas con cobertura, línea de tiempo y explicación larga con fuentes. Paisaje sintético con manchas de combustible continuas (antes, ruido por celda).
- Película v4 = v3 íntegra + 4 escenas (Ojo de SENDA, ver lo que no se ve, vías, incendio) con capturas reales y voz Kokoro de precisión completa (fp32) en es y en; subtítulos es/en/nl.

**Validación:** núcleo + relé 108/108 · E2E sin red 27/27 (Ojo e incendio incluidos, accesibilidad en 9 pantallas) · web: compilación, idiomas y 98/98.

**Lección registrada:** «acortar» no es «sustituir»; antes de retirar contenido, preguntar.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.8 · 04-11-2026 · Portada en vivo por niveles, incendio forestal, película y reels

**Entrada:** web más corta e inmersiva, con demostraciones en vivo de cada innovación; foco en incendios, vías, comunicación sin red, seguridad y satélite; material audiovisual para inversión.

**Procesamiento:**
- `wildfire.mjs` (núcleo): tiempo mínimo de llegada del fuego (Dijkstra, elipse de viento, pendiente con forma de Rothermel), FIRMS, y cruce con antenas: si la antena de un pueblo cae antes de su hora límite de aviso, la alerta sale antes o por portadores sin red (`planMultiBearer`). 7 pruebas. Corregido un fallo de precisión Float32 en el montículo que detenía la propagación sin viento.
- `investor-next/public/senda/home/demos.mjs`: 7 demos deterministas `render(t)` sobre el núcleo (malla, k-de-n, cifrado WebCrypto real, fusión, incendio, vía, órbitas con costas Natural Earth). Las mismas demos alimentan la web y los vídeos.
- Portada nueva `senda-experience.tsx` (es/en/nl): selector de nivel (ciudadanía, coordinación, ingeniería, inversión), 6 capítulos con demo en vivo, película y reels, algoritmo, inversión y verdad declarada. El laboratorio anterior completo pasa a `/lab` (en/es/nl) sin perder nada.
- `media/senda-promo`: guiones, voz Kokoro local, compositor `promo.html`, render por tramos, publicación. Película para inversores (16:9) y 3 reels (9:16) en es/en.

**Validación:** núcleo + relé 108/108; E2E sin red; web: compilación, idiomas y 98/98; capturas de control de escritorio, móvil y fotogramas de vídeo.

**Salida:** `/` `/es/` `/nl/` nuevas; `/lab/`; `public/media/promo/*`.

**Siguiente:** combustibles reales (SIOSE/CORINE) y AEMET para el incendio; TLE reales en la demo orbital; medición Lighthouse de la portada nueva.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.7 · 04-11-2026 · Motor de fusión de evidencias, visión por capas y vigilancia ferroviaria

**Entrada:** convertir «una cámara que vea a través de las paredes no existe» en algo construible y verificable; prevenir accidentes ferroviarios con datos que ya existen.

**Procesamiento:**
- `occupancy.mjs`: fusión bayesiana por persona + OR ruidoso por vivienda; intervalo por rango de parámetros; traza en decibanes; «≥98 %» solo con dos familias independientes; prioridad = probabilidad × riesgo EMS-98.
- `rescue-scenario.mjs`: verdad conocida para medir calibración (Brier, fiabilidad) y adaptador al edificio 14.
- `sensor-fabric.mjs`: catálogo de 17 dispositivos con permiso legal; barometría diferencial; planificador de la siguiente medida por bits/minuto.
- `vision-layers.mjs`: capas sobre la cámara (probabilidad, espectro, estructura, topografía, térmica real) y puntos calientes térmicos.
- `rail-watch.mjs` + `/senda/via`: escalones en circuitos de vía (patrón Adamuz), geometría con móviles de viajeros, transiciones de velocidad sin supervisión (Angrois), muros con lluvia (Gelida).
- `/senda/edificios`: pestaña «Visión por capas» con «dónde buscar primero» y «siguiente medida».

**Validación:** núcleo + relé 101/101 · E2E sin red 25/25 (2 comprobaciones nuevas y `/senda/via` en la auditoría de accesibilidad) · web: compilación, idiomas y 98/98. Calibración en 200 escenarios: Brier 0,107 frente a 0,124; insignia «≥98 %» acertada en 1.149/1.149 (619/619 con parámetros erróneos). Error de diseño detectado por la propia medición y corregido (doble conteo de detecciones compartidas).

**Salida:** `docs/architecture/MOTOR_FUSION_EVIDENCIAS.md`, `docs/research/ACCIDENTES_GRAVES_Y_PREVENCION_2026-11-04.md`, `evidence/senda/{fusion-calibration,rail-watch}.json`, capturas `e2e-14`, `e2e-15`.

**Siguiente:** piloto de calibración con bomberos/UME; convenio de datos de circuitos de vía con un gestor; Wi-Fi RTT y cámara térmica en la app Android.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## V0.1 (demo ficticia, endurecida, publicada)

- Publicada en GitHub Pages: `https://abrahamhl.github.io/civic-relay/` (repo `abrahamhl/civic-relay`).
- Reproducibilidad: se eliminan `*.tsbuildinfo` versionados; CI `install -> build -> type-check -> test`.
- Carga limpia verificada y CI verde (28 s).

- Core: `Dispatcher`/`MessageStore` separan aceptación de entrega; `DELIVERED` solo con ACK del receptor.
- Core: `demo.ts` conecta el flujo real (router/store/dedup) al escenario dorado.
- Core: TTL comprobado antes de rutar; caducados y `OFFICIAL` forjado rechazados; colisiones de ID rechazadas.
- Crypto: claves Ed25519 (firma) y X25519/XSalsa20-Poly1305 (cifrado experimental) separadas; sin E2E en el flujo.
- Tests: 21 pruebas con `node:test` (`pnpm test`).
- Web: build con `base: /civic-relay/`, tipos restringidos a la demo, manifiesto mínimo, identidad/GPS ficticios.
- Verdad: retirado "ENS Alto Compliant / Ready for Pilot / 93%"; tenantes con dominios `*.example`; README y docs nuevos.
- Auditorías: `AUDITORIAS_INVERSION_PUBLICA.md`, `ASTRA_RED_TEAM.md`, `RELEASE_TRUTH_V0_1.md`, `WORKWIZE_CASE_STUDY.md`.

## Antes

- HEAD `3f1c398`: higiene básica restaurada (lockfile, CI `master`), pero core sin escenario dorado verificado, crypto incompatible y documentación con exceso de afirmaciones.

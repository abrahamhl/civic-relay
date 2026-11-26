# Prompt para Antigravity · «El ojo de SENDA»: conducir de verdad, ver alrededor y prever · noche del 26 al 27-11-2026

**Configuración en Antigravity:**
- **Modelo:** el más capaz del selector en modo agente, planificador + ejecutor (Gemini 4 Carbon u Orchestrator, como en H0–H2).
- **Esfuerzo:** el **máximo**. Es una noche larga y la prioridad es la fiabilidad.
- **Repositorio y ramas:** repositorio `abrahamhl/civic-relay`, una rama nueva desde `master` por bloque y una PR en borrador por bloque.
- **Revisión:** Claude Code revisa, corrige y fusiona. **Antigravity no fusiona nada.**

**Coordinación:**
- **Mañana a las 08:00:** el fundador conduce al trabajo con la APK que haya en `master` al empezar la noche, no con lo de esta noche.
- **Al volver:** trae la caja negra y las notas de voz. El bloque A9 debe estar listo para analizarlas.

```
/goal Convertir SENDA en la app en la que se pueda confiar para conducir cada día (sustituir a Waze en el trayecto al trabajo) y en
«el ojo de SENDA»: ver alrededor del coche, prever lo que viene en la ruta y dejar cada sesión grabada y analizable. Sin inventar
ni un dato y sin romper nada de lo que ya funciona.

LEE PRIMERO
- Reglas: CLAUDE.md (veracidad: sin dato sin fuente, simulaciones rotuladas, sin valores por defecto inventados) y docs/CUMPLIMIENTO.md.
- Conducir: investor-next/public/senda/conducir.{html,mjs}. Leerlo entero antes de tocarlo: son unas 1700 líneas con caja negra,
  cámara IA, dashcam, radar 360, micrófono de apoyo, alarma de choque, carriles y modo conducción.
- Núcleo: packages/senda/src/ → nav-osrm, lane-guide, crash-cluster, roadsafe-crash-detect, surround-radar, camera-insights,
  voice-copilot, signal-radar, drive-hazard, drive-ar-hud, drive-blackbox, blackbox, heading-fusion, drive-kalman-fusion,
  flood-warning, fire-nowcast, fire-watch, roadsafe-risk-factors, mmwave-radar, hazard-share, report-style.
- APK: apps/senda-android (AppActivity.java: puente nativo; NetAllow.java: lista cerrada de hosts; ojo, cada host nuevo necesita
  justificación y su prueba en NetAllowTest).
- Pruebas: node --test packages/senda/tests/*.test.mjs · cd investor-next && npm test · node scripts/prove.mjs · type-check de
  packages/senda (tsc) · NetAllowTest en la JVM · node packages/senda/scripts/sync-web.mjs después de tocar el núcleo.

LÍNEAS ROJAS (si una tarea las choca, se para y se explica en la PR)
1. Veracidad: cada número en pantalla es MEDIDO, CALCULADO (con su fórmula y fuente) o ESCENARIO rotulado. Nada de posiciones,
   distancias ni puntos «de adorno». Si un sensor no da dirección, no se pinta una dirección.
2. Privacidad: nunca se guardan ni se muestran MAC, SSID, nombres de dispositivos ajenos ni matrículas en claro fuera del móvil.
   Los identificadores llevan un hash con sal efímera por sesión (como ya hace drive-field-lab). La cámara no reconoce caras.
3. Ley: nada para detectar o esquivar controles policiales o de fronteras (ya está prohibido en el proyecto). «Evitar autopistas»,
   «evitar peajes» o «evitar ferris» son preferencias de ruta normales y sí se permiten.
4. Dinero: ninguna API de pago ni cuenta nueva sin aprobación del fundador. Ninguna clave en el código ni en el repositorio: si hace
   falta, se diseña el hueco (configuración segura en el móvil) y se deja «pendiente de clave».
5. No romper: todas las pruebas en verde en cada PR; sin errores en consola; Conducir debe seguir funcionando sin red.

BLOQUE A0 · Fiabilidad de conducción (PRIMERO; sin esto no se sigue)
- Batería E2E con Playwright en tamaño de móvil (Pixel 7 vertical y tablet horizontal 1280×800) sobre /senda/conducir, con
  geolocalización simulada a partir de una traza GPX REAL (OSM o grabada) reproducida a velocidad real y ×4:
  buscar destino → calcular ruta → maniobras y carriles → salirse de la ruta y recalcular → túnel (GPS perdido 60 s) → llegada.
  Debe pasar a 30, 50, 90 y 120 km/h, sin red a mitad de ruta, con la pantalla girada y 2 h seguidas (vigilar fugas de memoria:
  heap estable ±10 %).
- Comprobar en concreto: la flecha va sobre la ruta y con el rumbo correcto; el mapa no da tirones (no más de un easeTo cada 800 ms);
  el texto de la maniobra coincide con OSRM; la voz no repite; la alarma de choque no salta con baches ni frenazos simulados
  (syntheticTrace de roadsafe-crash-detect).
- Informe evidence/drive-reliability/AAAA-MM-DD.json + docs/fiabilidad/CONDUCIR.md con cada caso: aprobado o fallido, y el arreglo.
- Arreglar todo lo que falle. Nada de «flaky»: causa raíz.

BLOQUE A1 · Biblioteca de sesiones (grabar el flujo y pasárselo a Claude)
- Una «sesión» une, con la misma marca de tiempo:
  - la caja negra sellada (SHA-256);
  - la grabación de pantalla nativa (ScreenRecordService, ya existe);
  - el vídeo de la dashcam;
  - las notas de voz (senda-voz/1);
  - el registro de la cámara IA, del radar 360 y del radar USB;
  - qué capas y sensores estaban activos y cuándo se encendió o apagó cada uno;
  - el origen y el destino.
- Pantalla «Mis sesiones»:
  - lista con fecha, lugar de inicio y fin, duración, kilómetros y lo que se grabó;
  - abrir una sesión y reproducirla en el mapa, sincronizada con el vídeo;
  - exportar un .zip con manifiesto y huellas;
  - borrar sesiones.
- Almacenamiento en IndexedDB y en archivos de Descargas/SENDA (save-file.mjs). Nada sale del móvil sin que la persona lo pida.

BLOQUE A2 · Estado de un vistazo en el mapa
- Fila de chips mínimos, siempre visibles y sin tapar la maniobra:
  - qué capas están activas: cámaras, radares fijos, incidencias, avisos SENDA, edificios 3D;
  - qué sensores están encendidos: cámara IA, dashcam, radar 360, SENDA Radar USB, micrófono, caja negra, buzón Bluetooth.
- Tocar un chip lo apaga o lo abre.
- Iconos en el mapa:
  - TODOS los puntos de cada capa activa en su sitio exacto (las cámaras DGT se ven desde zoom 10: decide si bajar a 9 sin saturar,
    con agrupación como el icono ×N);
  - leyenda breve.
- Las imágenes de las cámaras públicas de la DGT ya cargan en la APK (etraffic.dgt.es se añadió a NetAllow el 26-11). Verificarlo en
  el emulador o el navegador y añadir un visor con refresco cada 60 s.

BLOQUE A3 · Tour y llamadas a la acción
- Tour interactivo de 6–8 pasos en el primer uso y desde Ajustes, por rol (ciudadano, conductor, administrador). Cada paso
  señala un botón real («Pulsa aquí para ver los carriles»; «Activa el micrófono de apoyo y di “estoy parado”»).
- Sugerencias en contexto, con un límite (máx. 1 cada 10 min y nunca en movimiento a más de 30 km/h). Ejemplos:
  - «Llevas 20 min sin caja negra: ¿grabar?»;
  - «Has montado la cámara: declara la altura en Montaje para ver metros».

BLOQUE A4 · Vista «como Tesla» en 3D en tiempo real
- Panel 3D ligero (Three.js ya está en el repositorio, sin dependencias nuevas) con tu coche en el centro y trazos digitales tipo
  alambre. Los vehículos de alrededor salen de:
  - las pistas de la cámara (camera-insights: distancia y lateral, solo con el montaje declarado);
  - el SENDA Radar USB (surround-radar);
  - los móviles SENDA cooperativos cercanos.
- Carriles dibujados con lane-guide y laneWidthM.
- Zonas sin sensor en gris y dichas («detrás: sin sensor»).
- 30 fps en un móvil medio; si no se alcanza, bajar a 15 fps y medirlo.

BLOQUE A5 · Radar de dispositivos honesto («ver a través» con radio)
- HOY signal-radar pinta los ángulos a partir del campo `a` del barrido, que no es una dirección medida: por eso parece una animación.
  Reemplazar por:
  a) Distancia por RSSI con el modelo log-distancia. El exponente n y la potencia a 1 m se calibran en campo (sin valores
     inventados; mientras tanto, solo anillos de intensidad sin metros).
  b) Dirección SOLO cuando se pueda calcular: al moverse, trilateración de emisores FIJOS (puntos Wi-Fi) con las muestras de RSSI a
     lo largo de la traza GPS (localización por paso, mínimos cuadrados con elipse de error). Los emisores móviles quedan sin dirección.
  c) Ficha de cada señal: tipo (Wi-Fi 2,4/5/6 GHz, BLE, móvil SENDA), intensidad, distancia estimada ± error, primera y última vez
     vista, si se mueve. SIN MAC ni SSID en claro (hash efímero).
- Superposición en la cámara (misma interfaz que el SENDA Radar): un emisor localizado detrás de una pared se dibuja con su elipse
  de error y la etiqueta «radio, a través de obstáculos, ±X m».
- Pruebas con trazas sintéticas rotuladas y con un barrido real de WifiSurveyRecorder si existe.

BLOQUE A6 · La ciencia de previsión, visible en Conducir
- Panel «Lo que viene en tu ruta» (abre con un toque y no tapa la maniobra). Sobre la ruta activa:
  - meteorología por tramos con hora de paso (fuente abierta y con licencia comprobada; si necesita un host nuevo, NetAllow con
    justificación);
  - deslumbramiento solar (posición del Sol, NOAA/SPA, frente al rumbo del tramo y la hora de paso; CALCULADO);
  - noche y luz;
  - avisos de inundación (flood-warning), incendio (fire-nowcast), incidencias DGT y avisos SENDA por tramo;
  - riesgo de colisión por alcance (roadsafe-risk-factors), solo con lo que tenga fuente.
- Cada fila dice su fuente y si es dato o modelo. Voz: una frase al empezar la ruta y otra al acercarse a un tramo con aviso.

BLOQUE A7 · Copiloto con IA por voz (diseño seguro, sin gasto sin aprobación)
- Módulo ai-copilot con proveedor intercambiable. La clave nunca va en el repositorio: va en el almacén seguro del móvil y se
  configura en Ajustes. Mientras no haya proveedor aprobado, el modo es «planificador sin IA»: plantillas + herramientas.
- El modelo NO inventa lugares ni datos: solo planifica y resume lo que devuelven las HERRAMIENTAS, y cada lugar lleva su fuente:
  - geocodificar: Nominatim;
  - ruta con preferencias: OSRM; comprobar si el servidor admite `exclude=motorway|toll|ferry` y, si no, decirlo;
  - lugares a lo largo de la ruta: Overpass/OSM, por etiquetas;
  - descripción breve: Wikipedia o Wikidata, con enlace;
  - horarios: solo si la fuente los da.
- Caso de prueba: «Estoy en Arnhem, quiero ir a Alemania a un sitio alternativo tipo búnker rehabilitado con ambiente joven,
  evitando autopistas». Salida: dos o tres rutas sin autopista, cada una con sus paradas, tiempos, kilómetros, cronología y fuentes.
  Si no hay datos, lo dice.
- Rápido: primera respuesta hablada en menos de 3 s con lo que ya se sabe. La ruta completa, después.

BLOQUE A8 · Benchmark y caja negra para calibrar
- scripts/blackbox-report.mjs: lee la caja negra (drive-blackbox v2), las notas de voz (senda-voz/1) y la sesión (A1). Produce un
  informe HTML + JSON con:
  - ruido del GPS en parado y umbral aprendido;
  - error de la brújula y su corrección;
  - disparos del detector de choque y si fueron reales (cruzando con «falsa alarma»);
  - detecciones de la cámara frente a lo que el conductor dijo por voz (matrícula, intención, noche);
  - separación con el de delante;
  - consumo de batería por hora;
  - tiempos de inferencia;
  - zonas sin cobertura.
- Benchmark de rendimiento en el emulador o el navegador: FPS del mapa, ms por fotograma de la IA, memoria y batería estimada por
  módulo, en un único informe evidence/benchmark/AAAA-MM-DD.json.

FORMA DE TRABAJAR
- Orden: A0 → A1 → A2 → A8 → A4 → A5 → A6 → A3 → A7 (A7 al final: necesita decisión del fundador sobre el proveedor).
- Un PR por bloque, en borrador, con: qué se hizo, capturas, pruebas, lo que NO se pudo verificar y por qué.
- docs/CUMPLIMIENTO.md: una fila por bloque con hora UTC real y hash.
- Si algo necesita hardware (radar, tablet, coche): «bloqueado: necesita prueba física» y seguir con lo demás.

INFORME FINAL (español, corto)
- Bloques entregados con enlace a cada PR y su estado de CI.
- Resultado de A0: casos aprobados y fallidos.
- Qué conviene probar mañana en el coche y qué NO usar todavía.
- Riesgos y confianza (0–100 %).
```

## Lo que hace Claude Code mientras tanto
1. Revisa cada PR de Antigravity en cuanto llega:
   - veracidad, privacidad y ley;
   - pruebas y rendimiento;
   - corrige lo necesario y fusiona solo lo que esté en verde y probado.
2. A la vuelta del fundador, analiza la caja negra y las notas de voz con A8 (o, si no está listo, con las herramientas actuales) y
   ajusta los umbrales con datos medidos.
3. Mantiene la APK de producción estable: nada de esta noche entra en la APK del trayecto hasta que pase A0.

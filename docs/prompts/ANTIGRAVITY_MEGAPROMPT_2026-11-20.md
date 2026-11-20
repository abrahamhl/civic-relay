# Prompt maestro para Antigravity · SENDA / civic-relay

> Preparado el 20-11-2026 por el asistente de orquestación (Claude) para el fundador.
> Pégalo entero en Antigravity, con el repositorio `abrahamhl/civic-relay` abierto y la rama de trabajo creada desde `claude/pensive-wozniak-tf506e` (PR #55).
> Ejecútalo en **modo Planning**: primero un *Implementation Plan* que el fundador aprueba y después la ejecución por fases, cada una con su *Walkthrough* y su grabación del navegador.

---

## 0. Quién eres y cómo trabajas

Eres el equipo de ingeniería senior de SENDA: arquitectura de software, frontend de producto, ciencia de datos geoespaciales, radio y telecomunicaciones, ciberseguridad y diseño de interfaces para centros de emergencia. Trabajas como un solo equipo con un único criterio: **todo lo que se entrega funciona, está probado y es verdad**.

Reglas de método:
1. **Lee antes de escribir.** Antes de tocar nada, lee y resume con tus palabras:
   - `CLAUDE.md` (reglas permanentes)
   - `.claude/skills/senda-cinematic-web/SKILL.md` (dirección visual aprobada)
   - `docs/research/AUDITORIA_SECTORES_SALA_2026-11-20.md` (qué necesita cada sector)
   - `docs/research/PROCUREMENT_GAP_2026.md` (hueco de mercado y fuentes)
   - `docs/CUMPLIMIENTO.md` (registro de compromisos)
   - `investor-next/public/senda/explica.html` y `sala.html` con sus módulos `.mjs` (las dos piezas de referencia)
2. **Divide y verifica.** Cada fase de la sección 4 es una unidad que se cierra con sus pruebas en verde, capturas revisadas y un commit. No se empieza una fase con la anterior en rojo.
3. **No decidas por el fundador.** Si una decisión cambia el alcance, el coste, la licencia de un dato o lo que se afirma en público, para y pregunta con 2–4 opciones y tu recomendación.
4. **Registra todo.** Cada fase termina con una entrada en `docs/CUMPLIMIENTO.md` (hora UTC real + hash real del commit + avance + problemas), nunca con una hora estimada.

## 1. Reglas innegociables (mandan sobre cualquier otra instrucción)

1. **Jamás se inventa un dato.** Ninguna cifra, precio, porcentaje, fuente, cliente, convenio, certificación o resultado se presenta si no está medido, calculado por el código del repositorio o respaldado por una fuente citada con enlace.
2. **Toda simulación se declara como simulación**: en el código (`basis: 'SIMULATION'` o equivalente), en la interfaz (etiqueta «Simulación») y en la documentación.
3. **Un parámetro sin fuente no lleva valor por defecto.** Queda como `null` / «no medido» y el escenario lo declara de forma explícita.
4. **Lo que no se pueda verificar se escribe «no verificado» o «no encontrado»**, diciendo qué falta.
5. **Prohibido afirmar** sin prueba documental:
   - «ve a través de las paredes»;
   - «100 % de entrega»;
   - «predice terremotos»;
   - «compatible con los sistemas de [cuerpo]»;
   - «integrado con [empresa]»;
   - «usado por [organismo]»;
   - cualquier cifra de clientes o ingresos.

   La forma correcta está en las páginas de referencia: «calcula dónde está la señal», «probabilidad X % con estos supuestos», «detecta las primeras ondas», «preparado con estándares abiertos; sin convenio firmado».
6. **SENDA no emite alertas reales.** Todo CAP lleva `status="Exercise"` hasta que exista una credencial institucional real. La decisión siempre la firma una persona.
7. **La bóveda de defensa (`packages/senda/src/defense/`, `app/defense-vault/`) queda separada de las superficies civiles.** No la enlaces ni la mezcles con ellas.
8. **Antes de entregar, repasa cada cifra y pregúntate «¿de dónde sale?».** La respuesta tiene que ser «medido», «calculado por este código» o «fuente X». Si no lo es, se quita o se etiqueta.
9. **Datos de terceros:** licencia compatible y crédito visible. Las fotos van en `investor-next/public/senda/fotos/creditos.json` (autor, licencia, enlace y SHA-256 calculado *después* de recomprimir). Nada de imágenes generadas por IA salvo permiso explícito del fundador, y entonces rotuladas «ilustración generada».
10. **Privacidad:** ninguna cámara identifica personas ni matrículas; el micrófono, la cámara y la ubicación solo se usan con permiso explícito y en el dispositivo.

## 2. La tesis que todo debe demostrar

Las redes ya son rápidas y los sistemas de cada cuerpo, potentes. Falta **la capa de arriba**:
- la que junta lo que ven todos (satélite, cámaras públicas, sensores, testigos);
- la que **no toca ningún sistema**;
- la que prepara la decisión previa a una alerta: ¿es real?, ¿a quién afecta?, ¿qué sigue funcionando?, ¿por dónde llegará el aviso?, borrador CAP;
- la que lleva cada mensaje por **todas las redes vivas a la vez**: vecinos por Bluetooth o Wi-Fi Direct, sonido, SMS, satélite directo al móvil, LoRa, Iridium, dron, autobús o coche como mula.

Siempre: **coordinar hasta que llegan los servicios de emergencia y ayudarles a coordinar mejor**. Debe convencer a la vez a:
- los cuerpos de emergencia: bomberos, Guardia Civil, policía local, UME, protección civil y 112, sanitarios y hospitales;
- el vecino;
- los técnicos: desarrollador web, ciberseguridad y OSINT;
- quien decide y financia: Gobierno, integradores de datos y la financiación pública europea.

## 3. Estado actual (no lo rehagas: constrúyelo encima)

- **Núcleo:** `packages/senda/src`, 159 módulos ES sin dependencias. Pruebas: `node --test packages/senda/tests/*.test.mjs` (883/883). Se copia a la web con `node packages/senda/scripts/sync-web.mjs` → `investor-next/public/senda/core/`.
- **Web:** `investor-next` (Next.js 16 exportado en estático) + 44 páginas HTML en `investor-next/public/senda/`.
  - `npm test` (157/157)
  - `npx tsc --noEmit`
  - `npm run build`
  - `node scripts/prove.mjs` (19/19 afirmaciones públicas)
- **Piezas de referencia:**
  - `/senda/explica`: capítulos con piezas vivas, modo Guía/Ciencia, sinestesia y plataforma.
  - `/senda/sala`: pantalla de operador sobre la DANA real de l'Horta Sud, con agua de Copernicus EMSR773, red OSM, 57 servicios, 5 pasos hasta el CAP firmado y 10 lentes.
- **Datos reales disponibles:**
  - `data/dana2024/emsr773.json`, `data/aislamiento/*`
  - `data/smv2026/*` (Sentinel-2 del incendio)
  - `data/perimetro/cam_*.jpg` (cámaras DGT, CC BY)
  - `data/tle/amsat-nasabare-2026-11-20.*` (TLE reales)
  - `media/vision/dashcam.mp4` (YOLOX + ByteTrack)
  - `fotos/` (Wikimedia, con créditos)
  - `data/nepal2026/*`, `data/mulas/valencia.json` (GTFS)
- **Fallos ya corregidos (no los reintroduzcas):**
  - `planMultiBearer` rellenaba fragmentos inútiles;
  - `AUTHENTIC_DATED_TLES` eran inventados y ahora son `ILLUSTRATIVE_TLES`, con `TLE_CHECKSUM_VALID`.
- **Pendiente:** `apps/senda-live` conserva su copia de los TLE inventados (fase 9).
- **Seguridad del sitio:** la política de contenido solo permite `'self'`. No cargues scripts, estilos ni teselas de mapas de terceros: aloja todo dentro del sitio.

## 4. Lo que hay que construir (por fases, en este orden)

Cada fase incluye su **criterio de aceptación**. «Hecho» significa que se cumplen todos y que las pruebas de la sección 6 están en verde.

### Fase 1 · «Tu calle» en la Sala de decisión
- Al pulsar cualquier punto del mapa de `/senda/sala`:
  - se ajusta al nodo viario más cercano;
  - se ejecuta en el navegador el motor de aislamiento (`flood-isolation.mjs`, o una función nueva y probada en el núcleo si hace falta);
  - se muestra si ese punto queda **conectado, aislado o con agua**, la ruta seca hasta el servicio esencial más cercano de cada tipo, la distancia antes y después, y el tiempo de cálculo.
- **Aceptación:**
  - el número de bolsas aisladas calculado en el navegador coincide con `dana_horta_sud_resultado.json` (escenario «toca»), o cualquier diferencia se explica con un número;
  - la nueva función del núcleo tiene pruebas unitarias con casos a mano;
  - cálculo por clic < 500 ms en un portátil normal (medido y mostrado).

### Fase 2 · Repetición minuto a minuto
- Un control de tiempo en la Sala que recorre la cronología real: 14:30, 16:40 y 19:11 UTC del 29-10-2024, y las imágenes del 30 y 31-10.
- En cada momento solo se muestra lo que **existía entonces**: datos con su hora de publicación real o «no disponible».
- **Aceptación:** cada estado del control cita la hora de su fuente; ningún dato aparece antes de su hora; prueba automática que lo verifica.

### Fase 3 · La Sala para otros dos casos reales
- **Apagón ibérico del 28-04-2025**: con `blackout.mjs` y los datos citados en `PROCUREMENT_GAP_2026.md`. Si no hay geometría real de antenas, se dice y se usa la ciudad sintética rotulada.
- **Incendio de San Martín de Valdeiglesias (23-07-2026)**: con `data/smv2026/*`, `fire3d.json` y `incendio.html`.
- Un selector de incidente en la barra superior; la arquitectura de la Sala queda genérica (`sala-casos/*.mjs`).
- **Aceptación:** los 5 pasos funcionan en los 3 casos; cada cifra con su fuente; las lentes adaptan su texto a cada caso.

### Fase 4 · Realidad aumentada unificada en el móvil (`/senda/ar`)
- Una sola vista de cámara con brújula, giroscopio y GPS que superpone:
  - los satélites reales (TLE de AMSAT);
  - la baliza BLE estimada (`rubble.mjs`);
  - los compañeros y las unidades de un ejercicio;
  - el punto kilométrico y el sentido de la marcha (`road-guard.mjs` / `dgt-infra.mjs`, si existen datos; si no, «no disponible»).
- **Aceptación:**
  - funciona en Chrome Android y Safari iOS (con el permiso de orientación de iOS);
  - todo lo que se dibuja es posición calculada, rotulada con su fuente y su error;
  - sin permisos, se muestra un modo de demostración rotulado;
  - prueba en Playwright emulando un móvil.

### Fase 5 · Recepción acústica real
- En `/senda/explica#sinestesia`, el segundo móvil **decodifica** con su micrófono el SOS que emite el primero, usando `demodulate` en tiempo real (`AudioWorklet` o un búfer deslizante).
- **Aceptación:**
  - prueba automática que envía la señal modulada por un `AudioContext` en bucle y la decodifica idéntica;
  - con ruido por encima del umbral se descarta y se dice («nunca entrega basura»);
  - una medición real con dos teléfonos documentada en `docs/` con fecha, modelos, distancia y resultado (aunque falle: se registra igual).

### Fase 6 · Diseño profesional en todo el sitio
- Aplica la skill (sección «Nivel profesional») a las 44 páginas de `/senda/`, empezando por las más visitadas: `index`, `centro`, `consola`, `red`, `carretera`, `incendio`, `edificios`.
- Tipografías Inter e IBM Plex Mono alojadas en el sitio; sin antetítulos espaciados, sin pastillas, sin tarjetas con borde lateral y sin emojis como iconografía.
- **Aceptación:**
  - antes y después capturados a 1440 px y 390 px para cada página;
  - ninguna página desborda en el móvil (`scrollWidth` igual al ancho de la ventana);
  - sin errores de consola;
  - contraste AA en el texto principal.

### Fase 7 · Inglés y neerlandés
- Versiones EN y NL de `/senda/explica` y `/senda/sala` (`?lang=` o rutas propias), coherentes con el sistema de idiomas de `investor-next`.
- **Aceptación:** todo el texto visible traducido; las cifras y fuentes, idénticas; `npm run check:locales` sigue en verde; prueba en Playwright por idioma.

### Fase 8 · Fotografía real del apagón y de la DANA
- Desde la API de Wikimedia Commons: el cielo estrellado de Córdoba y una calle a oscuras durante el apagón; imágenes de satélite de la DANA de Sentinel-1/ESA y NASA Earth Observatory.
- Ritmo máximo de una petición cada 10 s y miniaturas en tamaños estándar; ante un error 429, para y reintenta más tarde. Créditos y huella según la regla 9.
- **Aceptación:** `creditos.json` completo y con huellas que coinciden con los archivos; crédito visible bajo cada foto.

### Fase 9 · Veracidad en `apps/senda-live`
- Renombra `AUTHENTIC_DATED_TLES` a `ILLUSTRATIVE_TLES` y rotula el modo de `Globe4DStudio.tsx`, o pásalo a los TLE reales de AMSAT con su fecha.
- **Aceptación:** prueba que comprueba la suma de control TLE; las pruebas de `apps/senda-live` en verde.

### Fase 10 · Pruebas de extremo a extremo en la integración continua
- Pruebas de Playwright para `/senda/explica` y `/senda/sala` (y las páginas nuevas): sin errores de página, sin desbordes en móvil, cifras clave presentes, firma CAP verificada, cadena de auditoría íntegra.
- Añádelas al flujo de integración continua de `investor-next` (`.github/workflows/investor-next-ci.yml`) sin desactivar ninguna prueba existente.
- **Aceptación:** la integración continua pasa en verde en el PR.

### Fase 11 · Vídeos
- Vuelve a grabar `media/senda-explica-es.mp4` y `media/senda-sala-es.mp4` y añade uno por cada caso nuevo y otro de la realidad aumentada, siguiendo la sección 7 de la skill.
- Pie fijo: «grabación de la página con simulaciones; no es un ensayo de campo».
- **Aceptación:** cada vídeo pesa menos de 10 MB, lleva póster y aparece en su página.

## 5. Diseño (resumen; la skill manda)

- Para profesionales: **pantalla de operador**. Rejilla densa, mapa con datos reales, flujo de decisión, procedencia e integridad visibles. Referencia: `/senda/sala`.
- Para el público: **narrativa cinematográfica**. Foto real a todo el ancho, titulares sobrios (Inter, pesos 550–650), una pieza viva por capítulo y modo Guía/Ciencia con las ecuaciones de cada módulo. Referencia: `/senda/explica`.
- Paleta y componentes: los de las páginas de referencia. Movimiento solo con sentido, y desactivado con `prefers-reduced-motion`.
- Accesibilidad: objetivos táctiles de al menos 44 px, etiquetas ARIA en los lienzos, contraste AA y uso completo con teclado.

## 6. Puertas de verificación (obligatorias en cada fase)

```bash
node --test packages/senda/tests/*.test.mjs
```
```bash
node packages/senda/scripts/sync-web.mjs
```
```bash
cd investor-next && npm test && npx tsc --noEmit && npm run build
```
```bash
node scripts/prove.mjs
```
Además:
1. Chromium sin `pageerror` ni `console.error` a 1440 px y a 390 px; `scrollWidth` igual al ancho de la ventana.
2. **Capturas revisadas de verdad**, una por sección: textos legibles, nada se pisa, los marcadores quedan dentro del cuadro.
3. Cada cifra nueva lleva junto a ella su origen (medido / calculado por `módulo.mjs` / fuente con enlace).
4. Unidades físicas plausibles; si una animación va acelerada, se dice y se convierte a tiempo real.
5. Si se tocó el núcleo: `sync-web.mjs`, subir la versión de `public/senda-sw.js` y añadir los archivos nuevos a su precaché.
6. Revisión de seguridad del cambio: sin secretos, sin URL de terceros en tiempo de ejecución que la política de contenido bloquee, y sin entrada de usuario insertada como HTML sin escapar.
7. Entrada en `docs/CUMPLIMIENTO.md` con la hora UTC y el hash reales.

**Si una puerta falla, la fase no está hecha.** Se arregla la causa raíz; nunca se desactiva, salta ni debilita una prueba para ponerla en verde.

## 7. Git

- Trabaja en la rama del PR #55 (`claude/pensive-wozniak-tf506e`) o en una rama nueva desde ella; no hagas push forzado.
- Un commit por fase, con un mensaje que diga qué y por qué y que liste las pruebas pasadas.
- No incluyas identificadores de modelos en los commits, el código o el PR.

## 8. Formato de tu informe al terminar cada fase

```
FASE N · nombre
Estado: HECHA | BLOQUEADA (motivo) | PARCIAL (qué falta)
Qué se ve ahora: (2-3 frases para el fundador, sin jerga)
Pruebas: núcleo x/x · web x/x · tsc OK · build OK · prove x/x · e2e x/x
Cifras nuevas y su origen: (lista)
Capturas/vídeo: (rutas)
Riesgos y límites declarados: (lista)
Commit: <hash> · Entrada en CUMPLIMIENTO: sí
Confianza: NN % — por qué no es 100 % (lo que falta medir en campo)
```

La confianza se justifica con evidencia: lo probado en código puede llegar a ~95 %; lo que depende de un ensayo de campo no supera lo que ese ensayo haya medido. **No declares 100 % de nada que no esté medido.**

## 9. Prohibido

- Inventar datos, fuentes, clientes, convenios, certificaciones o resultados de campo.
- Cargar recursos de terceros en tiempo de ejecución, o usar fuentes o fotos sin licencia.
- Mezclar la bóveda de defensa con las superficies civiles.
- Emitir o simular una alerta real sin el estado «Exercise».
- Volver al estilo «hecho con IA»: tarjetas grises con borde lateral, pastillas, mayúsculas espaciadas de adorno, emojis como iconos.
- Cambiar el alcance sin preguntar al fundador.

Empieza leyendo los archivos de la sección 0 y presenta el *Implementation Plan* de las fases 1 a 11, con estimación de esfuerzo, riesgos y lo que necesitas del fundador. No escribas código hasta que apruebe el plan.

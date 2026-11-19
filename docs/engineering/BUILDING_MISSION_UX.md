# Edificio OEP — usabilidad y recorrido interactivo

Fecha: 2026-10-24. Alcance: el apartado del edificio de la captura del usuario, en `/es/#routing-lab`, con equivalentes EN/NL. El hash `#rf-explorer` visible en la captura pertenece a otra sección.

## Resultado implementado

Una sola prueba conecta teléfono ficticio → respuesta explícita → cola local → ruta calculada → recibo simulado. El edificio ya permite seleccionar teléfonos, enfocar plantas, girar, acercar y seguir un paquete por la ruta del modelo. Los cambios de enlace afectan al controlador de la cola; la reproducción visual no puede confirmar una entrega por su cuenta.

Clasificación: **SOFTWARE_TESTED** para controles, estado local, cancelación, caducidad y exportación; **SIMULATED** para edificio, teléfonos, enlaces y recepción exterior. Cero pruebas físicas y cero transmisiones de emergencia.

## 1. Problemas principales encontrados

1. La imagen del edificio y las doce diapositivas no permitían entender una tarea ni completar una prueba.
2. La respuesta humana, la cola y el edificio mantenían estados independientes; no explicaban una cadena causal.
3. No se podía explorar el edificio, elegir un terminal o ver por dónde avanzaba su mensaje.
4. Los controles técnicos ocupaban el primer recorrido y competían con la explicación principal.
5. El resultado de recepción y sus límites necesitaban distinguirse con claridad de una respuesta de rescate.

## 2. Recomendaciones concretas aplicadas

- Una tarea principal y cuatro fases con nombre: corte, mensaje, saltos y recepción. Las fases explicativas no producen ACK.
- Botón de recorrido guiado; alternativa de elegir terminal y respuesta. El silencio permanece UNKNOWN y no crea mensajes.
- Cuatro condiciones reproducibles: apagón móvil, sin salida exterior, sin permiso de relevo y batería crítica.
- Cola y ruta vinculadas: desconectar durante un recorrido lo interrumpe; reconectar permite reintentar el mismo identificador. El recibo solo aparece después del último salto y de la validación del motor local.
- STOP cancela y purga; los callbacks tardíos no pueden restablecer el mensaje. Un intento tiene límite de 30 segundos; el contenido de prueba caduca a los 60 segundos. La caducidad se refleja mediante el reloj local, incluso mientras está en cola.
- Selección por clic o teclado, enfoque de planta, giro, zoom, reinicio de cámara y movimiento reducido. En móvil, enviar devuelve la vista al edificio, donde se mantiene visible el estado del mensaje.
- Alternativa 2D funcional tanto ante pérdida de contexto como al iniciar sin WebGL. El lienzo se oculta para evitar superponer las dos vistas.
- Los experimentos anteriores se conservan bajo un desplegable de parámetros avanzados, identificado como independiente y montado solo al abrirlo.
- Exportación JSON rotulada como simulada, sin ubicación, contactos ni contenido personal.

## 3. Versión mejorada y archivos

Interfaz: `investor-next/app/building-mission-lab.tsx`, textos ES/EN/NL en `building-mission-copy.ts`, escena en `emergency-building.tsx`, integración en `coordination-lab.tsx` y estilos en `coordination-lab.css`.

Comportamiento: `investor-next/lib/building-mission.mjs` utiliza el motor existente `store-forward.mjs`. El modelo de rutas admite respuestas explícitas de terminales participantes mediante `responsesByNode`; las ejecuciones sin ese parámetro conservan su comportamiento anterior. No se ha añadido ningún proveedor, dependencia, imagen remota ni driver.

La escena muestra unidades virtuales y enlaces lógicos. No calcula propagación RF entre plantas, no identifica personas y no mide latencia, energía ni cobertura. La animación expresa avance visual; no demuestra transporte entre dispositivos físicos.

## 4. Puntuación general de usabilidad

**8/10, evaluación heurística de este apartado.** La tarea, las consecuencias y el resultado pueden probarse de principio a fin. La valoración no es una medición con usuarios ni modifica la puntuación histórica del resto de la página. Quedan por validar comprensión con personas ajenas al proyecto, uso con lector de pantalla y comodidad del modelo 3D en dispositivos móviles físicos.

## 5. Validación y alineación

- 112/112 pruebas Node de la experiencia web; cinco regresiones nuevas cubren salto sin ACK, silencio, reintento del mismo ID, corte/STOP y caducidad.
- Compilación estática con TypeScript y exportación de idiomas correctas.
- 51 comprobaciones de navegador: 42 del recorrido, estados, doce combinaciones de idioma/anchura y seis revisiones axe; nueve adicionales de teclado, selección 3D, movimiento, zoom al 200 %, arranque sin WebGL y preservación de los experimentos avanzados.
- Revisiones de diseño sobre capturas reales a 375 y 1440 px. Comprobación adicional de ausencia de desbordamiento a 320 y 768 px, en los tres idiomas.
- Axe no detecta infracciones en el alcance auditado. Sus comprobaciones incompletas se conservan en los recibos; no equivalen a una certificación ni sustituyen la revisión manual de tecnologías de asistencia.
- Los contadores y recibos pertenecen al mismo mensaje del controlador. El recibo continúa identificado como simulado y nunca se interpreta como rescate.

Evidencias: [pruebas de navegador](evidence/2026-10-24-building/browser-qa.json), [interacciones](evidence/2026-10-24-building/interaction-qa.json), [112 pruebas](evidence/2026-10-24-building/node-tests.tap), [compilación](evidence/2026-10-24-building/build.log), [vista de escritorio](evidence/2026-10-24-building/desktop-route.png), [móvil recibido](evidence/2026-10-24-building/mobile-received.png), [alternativa 2D](evidence/2026-10-24-building/mobile-fallback.png).

## 6. Cómo seguir sin perder foco

Abre la demo y pulsa **Ver el recorrido guiado**. Después elige **Sin salida exterior**, envía una respuesta, recupera el receptor exterior y reintenta. La pregunta de validación con una persona nueva es: «¿Dónde queda el mensaje si se corta el enlace y qué demuestra el recibo?». Esa respuesta comprueba si la propuesta se entiende.

Mi aportación más útil aquí es mantener sincronizadas explicación, interacción y evidencia: cada botón debe producir una consecuencia visible y verificable. El siguiente paso de producto es una prueba breve de comprensión con tres personas; la validación del transporte físico sigue el plan de piloto existente.

## 7. Depuración, registro y trabajo local

Se reutiliza la documentación de este repositorio y su ASSET_MAP; crear otra bóveda AnomalyOS duplicaría el control del mismo proyecto. No se eliminan archivos del usuario ni se modifica el checkout original de `C:\dev\02_PROJECTS\civic-relay`.

Todos los cambios se realizan en `C:\dev\_WORKTREES\civic-relay-reality-20261024`, rama `feat/master-emergency-routing-v1-20261020`. La URL de push del clon continúa en `DISABLED_LOCAL_ONLY` y `push.default=nothing`. No se ha ejecutado push, merge ni despliegue. El servidor de demostración escucha únicamente en `127.0.0.1:8766`.

## Anotación final

El avance central es que el edificio deja de ser una ilustración separada: permite ensayar una decisión y observar su consecuencia. Conservamos una sola tarea principal; los detalles técnicos siguen disponibles cuando hacen falta.

Registro de limpieza: se descartó únicamente `evidence/2026-10-24-building/desktop-initial.png`, captura intermedia generada durante esta sesión, sustituida por las capturas finales enlazadas.

# SENDA · Radar de avisos y activación por radio de acción

**Fecha:** 20-11-2026 · **Módulo:** `packages/senda/src/alert-watch.mjs` · **Página:** `/senda/radar` · **Instantánea:** `packages/senda/scripts/fetch-alerts.mjs`

## Qué hace

1. **Rastrea las fuentes públicas** en cuanto publican:

| Fuente | Qué publica | Acceso desde el navegador |
|---|---|---|
| MeteoAlarm (AEMET, KNMI y el resto de servicios nacionales) | Avisos oficiales en Atom con campos CAP 1.2 | No (sin CORS): instantánea en cada compilación |
| CAP 1.2 genérico | Avisos con polígono, círculo o geocódigo | — |
| USGS y EMSC | Terremotos **observados**: medidas, no avisos | Sí, en vivo |
| GDACS | Alertas **automáticas** de impacto (verde, naranja, roja) | Sí, en vivo |
| NASA EONET | Catálogo de eventos abiertos (incendios, tormentas, hielo) | Sí, en vivo |

   *Comprobado el 20-11-2026* con las cabeceras `Access-Control-Allow-Origin` de cada servidor.
2. **Normaliza** todas las fuentes al mismo modelo: tipo, severidad, certeza, urgencia, inicio, fin, punto y área.
   - La zona EMMA_ID de MeteoAlarm se convierte en polígono con la tabla `data/alertas/zonas-emma-es-nl.json`: 233 zonas de España y 20 de Países Bajos.
   - Esas geometrías salen del paquete «meteoalarm» 0.2.0 (MIT) y se han simplificado con Douglas-Peucker a 0,01°.
3. **Detecta los cambios** entre lecturas: nuevos, actualizados (cambia el contenido o el `msgType`), cancelados y desaparecidos.
4. **Fusiona** el mismo terremoto publicado por varias fuentes, con tolerancias declaradas.
   - *Medido* el 20-11-2026 a las 18:14 UTC: 125 registros de USGS, EMSC y GDACS se quedan en 105 eventos, de los cuales 18 venían de más de una fuente.
5. **Clasifica la fase** de cada aviso: PREVISTO (aún no ha empezado), VIGENTE, OBSERVADO, CADUCADO, EJERCICIO o CANCELADO.
   - Un GDACS verde se muestra como observado, no como alerta vigente.
6. **Calcula el radio de acción** (`planActivation`). Sobre los dispositivos que han dado su consentimiento:

| Dónde está el dispositivo | Qué hace SENDA |
|---|---|
| Dentro del área | Le da la guía del aviso y dos botones: «estoy bien» y «necesito ayuda» |
| En el anillo exterior, con permiso de testigo | Le pide que confirme lo que ve |
| Con datos y permiso de pasarela | Enciende la pasarela para vecinos sin datos (`stranger-gateway.mjs`) |
| Con permiso de ayuda y llegada dentro del tiempo declarado | Lo deja disponible para que el 112 le pida ayuda |

   - Con un aviso **previsto**, SENDA se prepara antes: guarda mapas y rutas, enciende pasarelas y sincroniza los buzones.
   - Los ejercicios no despiertan a nadie, y los avisos por debajo de la severidad mínima de la política tampoco.
   - `canPublicWarn` es siempre falso: la alerta pública la emite el organismo competente.

## Reglas de veracidad

- La política está **declarada y sin valores por defecto**: severidad mínima, anchura del anillo y tiempo de llegada para ayudar. `EXAMPLE_ALERT_POLICY` y `EXAMPLE_ALERT_FUSION` se rotulan como EJEMPLO_DECLARADO.
- En el radar, los móviles que aparecen al pulsar «Activar SENDA aquí» son una **simulación**: 90 dispositivos con proporciones de consentimiento de ejemplo.
- El indicador «En vivo» solo aparece si la última petición en vivo ha salido bien en los últimos 6 minutos. Si no, se muestra «Instantánea de las hh:mm».
- Los títulos de MeteoAlarm salen en inglés porque así los publica su Atom. El texto en español está en el CAP de cada aviso, que el radar enlaza.
- **Textura de la Tierra:** «earth-blue-marble» del paquete three-globe 2.31.0 (MIT). El nombre indica Blue Marble de la NASA, pero esa procedencia no está verificada en el paquete.
- **Fronteras:** Natural Earth 1:110m (dominio público).

## Pruebas

`packages/senda/tests/alert-watch.test.mjs`, 7 pruebas con muestras **reales** recortadas en `tests/fixtures/alertas/` (descargadas el 20-11-2026):
- el CAP de AEMET (actualización con referencia, dos idiomas, zona ES215);
- el Atom de MeteoAlarm;
- USGS, EMSC, GDACS y EONET;
- la fusión del mismo terremoto de Vanuatu publicado por USGS y EMSC;
- la hora UTC de GDACS;
- las fases;
- los cambios entre lecturas;
- la geometría (polígono y círculo, avisos sintéticos rotulados);
- la activación por consentimiento.

## Pendiente

| Pendiente | Bloqueo |
|---|---|
| Avisos de ES-Alert (difusión celular) | No hay fuente pública legible (no encontrada) |
| Avisos CAP de AEMET con polígonos propios | La API de AEMET OpenData exige clave |
| Vigilancia continua desde un servidor (cada pocos minutos, con notificaciones) | La web es estática; necesita un relé o una tarea programada con la clave del organismo |

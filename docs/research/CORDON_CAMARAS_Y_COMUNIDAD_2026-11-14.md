# Cordón de cámaras y comunidad: validar por sectores una hipótesis de emergencia

Fecha: 14-11-2026. Autor: Claude Code. Regla de veracidad: `CLAUDE.md` §1.

## Qué es

Alrededor de cada suceso se reparte el terreno en **8 sectores** (N, NE, E, SE, S, SO, O, NO) y en cada uno se busca la cámara pública más cercana. Así se ve:

1. **Dónde se puede comprobar visualmente** el suceso ahora mismo y **dónde se está ciego**.
2. **Qué señales medidas** da cada cámara: antigüedad de la imagen, si la fuente muestra su aviso de «imagen no disponible», movimiento entre dos capturas y vehículos contados con YOLOX-s.
3. Una **lectura de la vía del suceso**: si las cámaras de esa misma carretera muestran tráfico o movimiento, es un **indicio** de que no está cortada en ese punto. **Nunca** se dice «confirmado».

Las cámaras son **contexto**, no fuente independiente:
- en la fusión no cuentan como corroboración;
- en SENDA LIVE entran en la cadena de evidencias (`report_hash` y `prev_hash`) pero no cambian el estado de verificación.

Lo que sí lo cambia son las **personas**: las observaciones, vídeos o fotos de vecinos independientes, o una alerta oficial autenticada.

## Piezas

| Pieza | Fichero |
|---|---|
| Núcleo: rumbos, sectores, lectura de cámaras y evaluación perimetral (reglas declaradas en `SIGNAL_RULES`) | `packages/senda/src/camera-perimeter.mjs` (pruebas en `tests/camera-perimeter.test.mjs`) |
| Plan: accidentes actuales de la DGT y cámaras con imagen por sector | `scripts/datos-reales/perimetro_plan.mjs` |
| Medición: dos capturas ≥ 130 s, aviso por SHA-256, movimiento (gris 160×120) y YOLOX-s | `packages/senda-vision/camaras_perimetro.py` |
| Consola: anillo por sectores, miniaturas medidas y frases calculadas; pestaña «Comunidad» | `investor-next/public/senda/consola.html` |
| SENDA LIVE: `POST /api/events/:id/camera-evidence` (roles TRUST_ANALYST, INSTITUTIONAL_OPERATOR o PLATFORM_ADMIN) y `GET /api/events/:id/camera-perimeter` | `apps/senda-live/server/services/events.mjs` y `api.mjs` |
| SENDA LIVE sirve la Consola en su mismo origen, con CSP por hashes de los scripts (sin `unsafe-inline`) | `apps/senda-live/server/index.mjs` |
| Importador del cordón medido a acontecimientos | `apps/senda-live/scripts/importar-cordon.mjs` |

## Medido el 14-11-2026 (14:05–14:08 UTC)

- **Muestra:** los 12 accidentes más recientes de la DGT (publicación de las 15:04 hora local), con 48 cámaras distintas en el cordón de 15 km y una cobertura media de 4,2 de 8 sectores.
- **Capturas:** las 48 cámaras respondieron en las dos capturas y ninguna mostraba el aviso de no disponible. En 31 YOLOX detectó al menos un vehículo.
- **Hallazgo:** la DGT declara `max-age=119`, pero sirve imágenes con **233 a 774 s de antigüedad (mediana de 472 s)**. 40 de las 48 cámaras no renovaron la imagen entre las dos capturas. En esas el movimiento queda **sin medir** (no se cuenta como «0»).
- **Inventario de disponibilidad** (medido a las 13:13 UTC): 1639 de 1975 cámaras daban imagen, 300 mostraban el aviso de no disponible y 36 no respondieron.

## SENDA LIVE (la red social integrada): flujo probado de punta a punta por HTTP

1. Se importan los 12 accidentes como acontecimientos, con 50 evidencias de cámara. Su estado queda en «Reporte sin verificar»: **las cámaras no lo suben**.
2. Dos cuentas de prueba, **marcadas como SIMULACIÓN**, publican observaciones y las vinculan. El estado pasa a **«Corroborado»** por fuentes independientes.
3. La Consola, servida desde SENDA LIVE, enseña en «Comunidad»:
   - el acontecimiento y su estado;
   - las cámaras aportadas;
   - las publicaciones cercanas;
   - el botón «Compartir un vídeo, foto u observación» (`/?action=share`).

En la web estática la pestaña Comunidad dice que SENDA LIVE no está conectado y **no muestra publicaciones de ejemplo**.

## Límites

- **Umbrales:** imagen viva si tiene ≤ 600 s; movimiento ≥ 2 %; tráfico con ≥ 3 vehículos. Son decisiones de SENDA, sin validar con datos de campo.
- **YOLOX** cuenta vehículos visibles. De noche o con mal tiempo puede contar de menos. Las cámaras de la DGT muestran autovías: «sin vehículos» también puede ser poco tráfico.
- **Una cámara en un sector** no ve el punto exacto del suceso: solo el entorno de ese sector.
- **Las capturas son una foto del momento.** Hacerlo de forma continua necesita un servidor (pendiente de la decisión del fundador sobre actualización automática).

# SENDA Drive · película «el motor que le faltaba a la V16» (19-11-2026)

**Duración:** 4:34 en español (voz `ef_dora`) y ≈ 4:25 en inglés (voz `bf_emma`), ambas con voz Kokoro.

**Formato:** 1920×1080, encuadre 2,39:1 con bandas. Subtítulos quemados en el idioma de la voz, más pistas `.vtt` en ES y EN.

**Decisión del fundador (19-11-2026):** fuera los «muñequitos» 3D procedurales. La película se construye con **material real con licencia verificada**, las **capturas exactas de la app** y grafismo de datos.

## Cómo se reproduce

```bash
cd media/senda-film
node capture-drive-screens.mjs          # capturas reales de la app (assets/drive-*.png)
python3 build-drive-plates.py           # ortofoto IGN, sprites, secuencias de vídeo → build/plates/
python3 detect-plate.py build/sources/udacity-vehicle-project.mp4 <yolox_s.onnx>   # detecciones reales
node build-drive-film.mjs               # guion; ejecuta el núcleo y falla si una frase no coincide
python3 voice.py drive-film es && python3 voice.py drive-film en
LANG_FILM=es SCRIPT=drive-film SUBS=es node render-cinema.mjs
LANG_FILM=en SCRIPT=drive-film SUBS=en node render-cinema.mjs
```

Antes, los vídeos de Udacity deben estar en `build/sources/` (ver «Material real»).

## Material real y licencias

| Material | Uso en la película | Licencia | Fuente |
|---|---|---|---|
| Ortofoto PNOA máxima actualidad, autovía A-2 (Madrid), 5 + 4 teselas cosidas y alineadas con la calzada | Escenas aéreas: V16, frenada en cadena, reconstrucción del caso y relevancia del aviso. **Fondo genérico**: el caso ocurrió en Bélgica y así se rotula | CC BY 4.0 · © Instituto Geográfico Nacional | WMS `https://www.ign.es/wms-inspire/pnoa-ma` |
| Vehículos (turismo y camión) | Recortados de la **propia ortofoto**, misma luz y escala (0,1186 m/px) | Ídem | Ídem |
| Vídeos de dashcam `project_video.mp4`, `challenge_video.mp4` y `harder_challenge_video.mp4` | Fondos de conducción, HUD del arranque y detecciones | MIT · © Udacity | `github.com/udacity/CarND-Vehicle-Detection` y `CarND-Advanced-Lane-Lines` |
| Detecciones de vehículos | **Reales**: YOLOX-s ejecutado fotograma a fotograma sobre el vídeo de Udacity (`assets/plates/udacity-vehicle-detections.json`) | Modelo Apache-2.0 | `packages/senda-vision/yolox_onnx.py` |
| Pantallas de la app | Capturas exactas de `investor-next/public/senda/*.html`, con los escenarios marcados «EJERCICIO» en la propia app | Repositorio (MIT) | `capture-drive-screens.mjs` |

**Encontrado en Wikimedia Commons pero no descargado** (upload.wikimedia.org bloqueó la descarga desde este entorno):
- foto de balizas V16 sobre un techo (CC BY-SA 4.0);
- vídeo de la autopista A40 desde un puente (CC BY 3.0);
- ensayo de choque de la NHTSA (dominio público);
- foto de un móvil en el soporte del coche (CC BY 2.0).

Se pueden añadir a mano si el fundador quiere, con su atribución.

## Procedencia de cada afirmación

`build-drive-film.mjs` comprueba cada afirmación ejecutando el núcleo antes de generar el guion. Si alguna no coincide, falla cerrado.

| Escena | Afirmación | Fuente o cálculo |
|---|---|---|
| d01 | V16 conectada obligatoria desde enero de 2026; envía la posición a DGT 3.0; Tráfico la reenvía a los navegadores | [DGT, comunicado V16 conectada](https://www.dgt.es/comunicacion/notas-de-prensa/comunicado-v16-conectada-dgt-3.0/) · [Ministerio del Interior](https://www.interior.gob.es/opencms/es/detalle/articulo/DGT-3.0-ya-envia-a-los-navegadores-la-ubicacion-de-los-vehiculos-averiados-en-carretera-que-utilizan-la-V-16-conectada/) |
| d03 | Estados OFF/IDLE/CANDIDATE/DRIVING/ENDING; sin consentimiento no arranca; 10 escenarios y 55 pasos comunes | `drive-autostart.mjs`; vectores `conformance/drive-autostart.vectors.txt` (contados al generar) |
| d04 | Niebla, 120 km/h, 1,2 s: chocan 5 y, con aviso, 1; SOS en ≈ 7 min con 1 de cada 10 coches (**simulación**) | `scripts/film-claims.mjs` (`brake-chain`, `sos-rides-cars`) |
| d05 | Caso real **declarado, anónimo y sin verificar**; reconstrucción **ilustrativa, sin medidas** | `docs/roadsafe/18_CASE_HGV_SIDESWIPE_SPIN.md` |
| d06 | Coche girado 0/90/180/270°: avisa y marca la calzada como incierta; con rumbo de marcha previo, la calzada contraria no recibe falsa alarma | `hazardRelevance`, `travelHeadingBefore` (ejecutados) |
| d07 | La llamada al 112 es del usuario (`call112.automatic === false`); el guion dice carril y orientación solo si se declaran | `decideStayOrExit`, `call112Script` (ejecutados) |
| d08 | Pesos de ejemplo; el del giro (`spinAfter`) es `null` hasta calibrarlo; el arnés separa entrenamiento y prueba. La curva es la traza **sintética** del núcleo | `EXAMPLE_DETECTION_CONFIG`, `syntheticTrace('CRASH_REAR_END')`, `scripts/crash-calibrate.mjs` |
| d09 | Un evento con imagen, matrícula o cara se rechaza; sin consentimiento, también; la visión del fabricante figura como NO disponible; las cámaras tienen `lrPresent: null` | `validateCameraEvent`, `CAMERA_ACCESS`, `ROAD_SOURCES` (ejecutados) |
| d11 | La versión base de Android no lleva Google ni Internet; la versión play lleva pantalla de Android Auto (categoría provisional); la app de iPhone se compila y prueba en la CI | `.github/workflows/senda-android-ci.yml`, `senda-ios-ci.yml`; `apps/senda-android/app/src/play/` |
| d12 | 881 pruebas del núcleo (ejecutadas al generar), 82 E2E de carretera en Chromium (`evidence/roadsafe/roadsafe-e2e.json`), 55 pasos de arranque | Medido |

## Límites (no ocultar)

- La ortofoto es de **día**; se ha graduado como noche. Los vehículos de la reconstrucción son recortes reales colocados en carriles medidos, pero **su movimiento es ilustrativo**.
- La forma del pulso del acelerómetro es **sintética** (y se rotula así). No hay datos reales de choques calibrados.
- La pantalla de Android Auto se muestra como **marca SENDA**, no como una interfaz: no hay captura real de Android Auto, porque requiere un emulador de unidad central.

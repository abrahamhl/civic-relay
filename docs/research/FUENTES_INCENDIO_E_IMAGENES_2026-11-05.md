# Fuentes públicas para incendios: datos, imágenes y modelos (05-11-2026)

> **Firma:** Asistente de Orquestación Senior (Claude), v0.18.
> **Objetivo:** saber qué datos e imágenes reales podemos usar para seguir un incendio y entrenar un detector de humo, con su licencia. Nada se integra sin licencia clara.
> **Código relacionado:** `packages/senda/src/fire-watch.mjs` (fuentes en `FIRE_SOURCES`) y `packages/senda-vision/`.

## 1. Datos operativos (para el mapa y la criticidad)

| Fuente | Qué da | Licencia o condiciones | Modo | Estado en SENDA |
|---|---|---|---|---|
| NASA FIRMS (VIIRS 375 m, MODIS 1 km) | Focos térmicos con FRP, varias pasadas al día | Datos abiertos de la NASA; citar FIRMS | PASIVO | Lector `parseFirmsCsv` (con instrumento y píxel) → `hotspotPerimeter` y `fireProgress` |
| Copernicus EFFIS | Peligro meteorológico (FWI) previsto y perímetros quemados (≳ 30 ha) | CC BY 4.0 según [effis-client](https://pypi.org/project/effis-client/); **pendiente de verificar** en la [página de descargas](https://forest-fire.emergency.copernicus.eu/downloads-instructions) | PASIVO | Por conectar en el relé |
| Copernicus Sentinel-2 | Imagen de 10-20 m: área quemada y gravedad (dNBR) | Licencia abierta de Copernicus | PASIVO | Por conectar |
| AEMET OpenData | Observación y predicción | Reutilización citando a AEMET; clave gratuita | PASIVO | Por conectar (clave) |
| ASEM 112 Comunidad de Madrid | Estado oficial del incendio, cortes y confinamientos. Ejemplo: [Almorox y Villa del Prado, julio de 2026](https://www.comunidad.madrid/seguridad-emergencias-asem-112/incendio-forestal-almorox-ifalmorox-villa-prado-julio-2026) | Información pública oficial | PASIVO | Enlazado en `/senda/fuego` |
| Torres y cámaras del plan INFOMA | Rumbo a la columna: entre 33 y 38 puestos según la fuente y el año, y 4 cámaras (2024) | No públicas: van a los operadores | CONVENIO | Formato de entrada listo (`bearingFix`) |

## 2. Imágenes reales para entrenar o validar un detector de humo

| Conjunto | Tamaño | Licencia | Uso posible | Fuente |
|---|---|---|---|---|
| **Pyro-SDIS** (Pyronear) | 33.636 imágenes de cámaras de vigilancia, versión preliminar | **Apache-2.0** según su ficha | **El mejor candidato para el producto:** entrenar YOLOX (Apache) → ONNX → relé y teléfono | [ficha](https://huggingface.co/datasets/pyronear/pyro-sdis/blob/main/README.md) |
| **OpenFire** (Pyronear) | 7.143 de entrenamiento y 792 de validación, enlazadas por URL | Apache-2.0 la ficha. **Cada imagen conserva los derechos de su autor**, porque son URL de la web | Solo investigación hasta revisar las imágenes una a una | [ficha](https://huggingface.co/datasets/pyronear/openfire/blob/main/README.md?code=true) |
| **FIgLib** (HPWREN) | 315 secuencias de 101 cámaras en 30 estaciones, de 2016 a 2021 | Pública, con **crédito obligatorio** a hpwren.ucsd.edu; licencia formal «no especificada» | Solo investigación hasta confirmar las condiciones para uso comercial | [HPWREN](https://www.hpwren.ucsd.edu/FIgLib/) · [catálogo WIFIRE](https://wifire-data.sdsc.edu/dataset/hpwren-fire-ignition-library) · [artículo](https://arxiv.org/pdf/2112.08598) |
| **D-Fire** (GAIA) | Más de 21.000 imágenes con cajas de fuego y humo en formato YOLO | **Ambigua:** «other» en el repositorio original y CC0 en un espejo de terceros | No usar hasta leer el `LICENSE` del repositorio original | [GitHub](https://gaiasd.github.io/DFireDataset) |

**Modelos ya entrenados:** muchos detectores de fuego y humo publicados derivan de Ultralytics YOLOv8 y heredan la **AGPL-3.0**, por ejemplo [fire-smoke-yolov8n](https://huggingface.co/rabahdev/fire-smoke-yolov8n). Se descartan para el producto, igual que en la visión de tráfico.

## 3. Bloqueos de esta sesión

La red del entorno deniega:
- `huggingface.co`, donde están Pyro-SDIS y OpenFire;
- `firms.modaps.eosdis.nasa.gov`, `wvs.earthdata.nasa.gov` y `gibs.earthdata.nasa.gov`;
- `api.open-meteo.com`, `opendata.aemet.es`, EFFIS y `comunidad.madrid`.

Por eso `/senda/fuego` usa una **reconstrucción ilustrativa** sobre la geografía real del caso de la M-501 y lo dice en la página.

**Para desbloquear:** añadir esos dominios a la red del entorno ([documentación](https://code.claude.com/docs/en/cloud-environments#network-access)), o descargar en una máquina sin bloqueo y guardar en `fixtures/` con su licencia.

## 4. Siguiente paso propuesto

1. Descargar Pyro-SDIS (Apache-2.0).
2. Entrenar YOLOX-nano para la clase «humo» y exportar a ONNX.
3. Medir la precisión y la tasa de falsas alarmas por cámara y hora: nubes, polvo y niebla son los falsos positivos típicos.
4. Ejecutarlo en el relé sobre cámaras PASIVO o CONVENIO. Solo salen el rumbo y la hora (`bearingFix`), nunca la imagen.

**Confianza: 80 %.** Las licencias de Pyro-SDIS y OpenFire salen de sus fichas, no de un fichero de licencia; las de FIgLib y D-Fire quedan sin confirmar.

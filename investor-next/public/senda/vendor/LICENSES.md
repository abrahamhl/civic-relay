# Bibliotecas de terceros incluidas (copias exactas de npm, sin modificar)

| Archivo | Paquete | Versión | Licencia | Uso |
|---|---|---|---|---|
| `qrcode-generator-1.4.4.js` | [qrcode-generator](https://www.npmjs.com/package/qrcode-generator) (Kazuhiko Arase) | 1.4.4 | MIT (cabecera del archivo) | Dibujar el QR del código de acceso |
| `jsqr-1.4.0.js` | [jsqr](https://www.npmjs.com/package/jsqr) (Cosmo Wolfe) | 1.4.0 | Apache-2.0 (`jsqr-1.4.0.LICENSE.txt`) | Leer el QR con la cámara |

Se cargan solo cuando se usa el QR en Ajustes. Comprobado el 2026-11-23 con `npm pack` (campo `license` de su package.json).
| `mediapipe-tasks-vision-1.2.3/` (`vision_bundle.mjs`, `wasm/vision_wasm_internal.*`) | [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) (Google) | 1.2.3 | Apache-2.0 (campo `license` de su package.json; el paquete no trae el texto: es el mismo de `jsqr-1.4.0.LICENSE.txt`) | Reconocer objetos con la cámara, en el móvil y sin red |
| `models/efficientdet_lite0_int8.tflite` + `efficientdet_lite0_labelmap.txt` | [litert-community/MediaPipe-ObjectDetector-EfficientDet-Lite0](https://huggingface.co/litert-community/MediaPipe-ObjectDetector-EfficientDet-Lite0) | descargado 2026-11-23, SHA-256 0720bf24…c723bb | Apache-2.0 (metadato de licencia del repositorio) | Modelo entrenado con COCO (80 clases: vehículos, personas, animales y objetos comunes). **No** reconoce piedras, neumáticos ni escombros |

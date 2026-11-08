# SENDA · visión (cámaras y coches como sensores)

Detecta y sigue **vehículos** en vídeo real y produce **solo métricas agregadas**: conteo por sentido, ritmo por minuto, distancia estimada y tiempo hasta alcanzar al de delante. Nunca identifica personas ni matrículas. En producción corre en el **relé del organismo**: la imagen no sale de allí y se descarta tras medir.

| Pieza | Licencia | Para qué |
|---|---|---|
| YOLOX-s en ONNX (Megvii) | Apache 2.0 | Detector de vehículos (coche, moto, autobús, camión) sin PyTorch |
| ONNX Runtime | MIT | Inferencia en CPU (~140–190 ms por fotograma en este contenedor) |
| supervision 0.26.1 (ByteTrack) | MIT | Seguimiento entre fotogramas |
| Vídeo de cámara fija: `car-detection.mp4` (Intel IoT DevKit sample-videos) | CC BY 4.0 | Prueba de conteo |
| Vídeo a bordo: `project_video.mp4` (Udacity CarND-Vehicle-Detection) | MIT | Prueba del coche como sensor |

> Se descarta Ultralytics YOLO para el producto por su licencia AGPL-3.0: obligaría a publicar todo el servicio. YOLOX, con licencia Apache, no tiene ese problema.

```bash
pip install -r requirements.txt
curl -LO https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx
curl -LO https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/car-detection.mp4
curl -L -o project_video.mp4 https://raw.githubusercontent.com/udacity/CarND-Vehicle-Detection/master/project_video.mp4
python3 track_fixed.py car-detection.mp4 yolox_s.onnx salida/
python3 track_dashcam.py project_video.mp4 yolox_s.onnx salida/ --seconds 36 --stride 2
```

**Qué se mide y cómo:**
- **Conteo por sentido:** un vehículo cuenta cuando su centro cruza la línea entre dos fotogramas.
- **Tiempo hasta alcanzarlo, sin calibrar:** TTC = h / (dh/dt). Se usa la **altura** de la caja (la anchura también crece al ver el lateral al adelantar). Se descartan las cajas cortadas por el borde y los acercamientos de más de 25 m/s, que son artefactos.
- **Distancia estimada:** Z = f · 1,45 m / h, con una focal supuesta de 65° de campo horizontal. Margen de ±30 %; un camión parece más cerca.
- **Calzada contraria:** los vehículos al otro lado de la mediana se cuentan como **contactos**, los que llevarían el SOS de SENDA, no como peligro.
- **Carril propio:** un trapecio fijado a mano para este vídeo. En el producto se detectarían las líneas del carril.

**Salidas:** `fixed.mp4`/`fixed.json` y `dashcam.mp4`/`dashcam.json`. La web las muestra en `/senda/trafico`; el núcleo las convierte en medidas (`MeasuredData` de DATEX II) y avisos.

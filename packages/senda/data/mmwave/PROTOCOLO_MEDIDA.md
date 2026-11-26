# Protocolo de medida en campo · Radar mmWave RD-03D / LD2450

Este protocolo define cómo tomar grabaciones reales reproducibles para validar SENDA `/senda/personas` y publicar métricas de precisión con trazabilidad completa.

## 1. Material mínimo
- Módulo radar 24 GHz Ai-Thinker **RD-03D** o Hi-Link **LD2450** (firmware de serie, 256000 baudios 8N1).
- Adaptador USB-serie a 3,3 V (CH340, CP210x, FTDI o XIAO ESP32-S3 CDC-ACM) + cable USB-OTG (si se usa la APK Android).
- Cinta métrica homologada (≥ 8 m), marcas en el suelo cada 1,0 m (1, 2, 3, 4, 5, 6 m) y brújula o línea de referencia topográfica (bordillo medido en mapa).
- Trípode o soporte rígido a 1,2 m de altura con el radar horizontal.

## 2. Secuencia de grabación (3 escenarios mínimos)
1. **Calibración de distancia (1 persona, marcas conocidas)**: la persona se sitúa sobre 1, 2, 3, 4 y 5 m balanceándose suavemente 5 s por marca (el radar solo ve objetivos en movimiento). Guardar `.jsonl` con «Guardar grabación».
2. **Rumbo de marcha (calibración de montaje)**: caminar recto a paso uniforme 6 m a lo largo de una línea de rumbo real conocido $\theta_{\text{real}}$ (medido en ortofoto/mapa). Repetir en sentido inverso ($\theta_{\text{real}} + 180^\circ$).
3. **Cruce de dos personas (verificación ciega, NO usada para ajustar)**: dos personas caminan en sentidos opuestos cruzándose a ~3 m y ~3,5 m.

## 3. Sellado y archivo en el repositorio
1. Calcular la huella SHA-256 del `.jsonl` crudo (`sha256sum <archivo>.jsonl`).
2. Crear `<archivo>.meta.json` con `basis: "MEASURED"`, fecha UTC ISO-8601 con zona (`Z`), modelo de sensor, adaptador USB, condiciones ambientales (interior/exterior, humo/obstáculo si aplica), medidas de cinta y huella `sha256`.
3. Añadir la entrada al manifiesto de `packages/senda/data/mmwave/README.md` y un caso en `packages/senda/tests/mmwave-regression.test.mjs` que mida el error RMS en los puntos de verificación ciega (separados de los puntos de calibración).
4. **Regla estricta:** ninguna cifra de precisión se añade al dossier ni a la web si no supera la prueba de regresión sobre la grabación sellada con SHA-256.

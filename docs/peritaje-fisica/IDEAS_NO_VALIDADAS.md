# Ideas no validadas o pendientes de validación en entorno real (`IDEAS_NO_VALIDADAS.md`)

En cumplimiento estricto de la regla §3.3 del encargo y §1 de `CLAUDE.md`, ninguna capacidad que no haya podido medirse o comprobarse en este entorno se entrega como validada. Se listan a continuación las brechas verificables y qué falta exactamente para cerrarlas:

1. **Ejecución real de los compute shaders WebGPU (`WGSL_SWE_FV_SHADER`) sobre GPU física:**
   - **Estado actual:** el código WGSL de dos pases (`flux_pass`, `update_pass`) está escrito y alineado algoritmo-a-algoritmo con el solver CPU `f32`, cuya paridad frente a CPU `f64` sí se ha medido (`maxAbsDiff = 1,14e-6 m < 1e-4 m`).
   - **Por qué no está validado en GPU:** esta VM (`Intel Xeon @ 2.30 GHz`, 2 núcleos) no dispone de adaptador GPU físico ni controlador WebGPU (`navigator.gpu` ausente).
   - **Qué falta:** ejecutar un banco de paridad real `GPU(WGSL) ↔ CPU(f64)` en Chromium/Chrome con WebGPU habilitado sobre portátil con GPU integrada/dedicada y registrar el factor de aceleración real y la tolerancia medida.

2. **Rendimiento medido en teléfono móvil de gama media (Android / iOS):**
   - **Estado actual:** solo se han medido tiempos en Node.js `v22.23.5` sobre Intel Xeon CPU @ 2.30 GHz y renderizado de `reportar.html` / `comite.html` en Chrome headless emulando viewport móvil `390×844`.
   - **Qué falta:** cronometrar en hardware real de gama media (ej. Snapdragon serie 6/7 o equivalente) la firma Ed25519, el borrado EXIF + pixelado de foto de 12 MP en `<canvas>`, la extracción de `dHash-64` y la cola offline IndexedDB/localStorage bajo batería y memoria restringidas.

3. **Tiempos de llegada de la crecida del Poyo con resolución LiDAR sub-decimétrica (MDT 2 m PNOA) y afluentes:**
   - **Estado actual:** en el MDE abierto offline de 118,1 m (`dem_d4.bin`), el solver FV 2D + apertura hidrológica (Lindsay & Dhun 2015) + porosidad urbana (Sanders 2008) mejora claramente la línea base (`CSI 0,2354 → 0,2516`, llegada a Picanya `393–480 → 215 min`, Paiporta `448–545 → 262 min`), pero las llegadas siguen siendo ~60–100 min más tardías que las referencias testimoniales de las 18:55–19:30 CET.
   - **Qué falta:** integrar el MDT02 LiDAR del IGN/PNOA (2 m, sin puentes ni edificios en el cauce), los afluentes laterales (barrancos de la Saleta, Horteta y Gallego) y un hidrograma observado completo por debajo de Chiva.

4. **Verificación criptográfica completa de cadena de confianza C2PA (X.509 / COSE / TSA):**
   - **Estado actual:** `inspectC2paBytes` en `report-forensics.mjs` detecta contenedores JUMBF/C2PA y los etiqueta explícitamente como inspección estructural no anclada (`verifiedChain: false`), sin otorgar peso de prueba instrumental.
   - **Qué falta:** incorporar un verificador COSE/X.509 completo y la lista oficial de Autoridades de Certificación de la Coalition for Content Provenance and Authenticity (C2PA Trust List) junto con sellado de tiempo RFC 3161.

5. **Integración en vivo con conectores institucionales y convenios (SAIH, AEMET, Copernicus CDSE, DGT 3.0, ES-Alert):**
   - **Estado actual:** todos los módulos aceptan lecturas estructuradas inyectables (`OBSERVED | ABSENT | COLLECTION_ERROR`) y están probados con ficheros abiertos locales; no existen llamadas en vivo con credenciales ni pasarela homologada a ES-Alert / Protección Civil.
   - **Qué falta:** convenios institucionales, gestión de cuotas/claves fuera del cliente y homologación operativa con el Sistema Nacional de Protección Civil.

6. **Difracción radio frente a campañas de medida RSSI/SNR en campo real:**
   - **Estado actual:** ITU-R P.526-15 Delta-Bullington y Longley-Rice/ITM están verificados analíticamente (Friis, filo de cuchillo $J(0)=6,03$ dB) y ejecutados sobre el MDE abierto real `radio/poyo.json`.
   - **Qué falta:** contrastar el margen predicho contra medidas reales de campo con transceptores LoRa 868 MHz / VHF en la cuenca del Poyo.

7. **Redacción automática de caras/matrículas en vídeo y revisión jurídica RGPD/LOPDGDD:**
   - **Estado actual:** el difuminado local en `<canvas>` (`redactRgbaRegions`) y el borrado de metadatos EXIF (`stripJpegExif`) operan sobre imágenes estáticas; la documentación de privacidad (`docs/PRIVACIDAD.md`) marca expresamente los puntos de base jurídica pendientes de dictamen letrado.
   - **Qué falta:** dictamen jurídico formal de delegado de protección de datos (RGPD art. 6.1.d / 6.1.e, LOPDGDD, plazos de conservación y responsabilidad patrimonial) y redacción asistida en flujo de vídeo sin enviar frames sin redactar.

8. **Física forestal de copas, pavesas a larga distancia y acoplamiento atmósfera-fuego 3D:**
   - **Estado actual:** `fire-rothermel.mjs` implementa Rothermel (1972) superficial, Scott & Burgan (2005) y Level-Set 2D de Huygens con conjunto LHS.
   - **Qué falta:** añadir transición a fuego de copas (Van Wagner 1977), modelo probabilista de focos secundarios por pavesas (Albini 1979) y validación contra múltiples incendios históricos ibéricos con reloj de ignición verificado.

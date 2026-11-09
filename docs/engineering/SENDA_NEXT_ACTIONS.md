# SENDA — Plan de Acción Inmediato y Hoja de Ruta Ejecutiva

**Fecha de Actualización:** 2026-11-09T01:42:00Z  
**Estado:** Bloque 1 (Auditoría e Integración Controlada) COMPLETADO. Procediendo con Bloque 2 y Bloque 3.

---

## 1. Tareas Inmediatas en Curso (Bloque 2: OSINT y Fuentes Avanzadas)

- [ ] **Conectores Oficiales de Emergencias Adicionales:**
  - Diseñar e implementar conectores normalizados para **Copernicus EMS / EFFIS** (perímetros activos y peligro de incendio europeo) con validación de procedencia y licencias abiertas de la Unión Europea.
  - Integrar feed normalizado de **AEMET / DGT** (avisos meteorológicos Meteoalarm / Avisos CAP e incidencias DATEX II de carreteras en España) bajo estrictas restricciones de no-invención.
  - Integrar feed **NDW / DATEX II** (tráfico y cierres de carreteras en Países Bajos).
- [ ] **Motor de Reconciliación Espaciotemporal y Deduplicación:**
  - Implementar deduplicación basada en hashing de coordenadas geohash / clusters espaciotemporales con ventana deslizante (conservando hashes SHA-256 de payload original).
  - Puntuaciones de fiabilidad (confidence scoring) basadas en calidad del proveedor, precisión de coordenadas reportada y presencia de DQF (Data Quality Flags).
  - Detección explícita de dependencias compartidas (ej. GDACS re-emitiendo sismos de USGS o GFZ Potsdam).

---

## 2. Tareas de GIS 3D/4D y Renderizado (Bloque 3)

- [ ] **Evolución del Visualizador GIS:**
  - Integrar visualizador GIS avanzado compatible con MapLibre / WebGL / PMTiles para capas vectoriales y ráster sin depender de conexiones externas continuas.
  - Extender `Atmosphere4DStudio` con renderizado de vectores de viento por partículas (Wind Particles GPU shader) y cortes verticales de relieve topográfico en GeoRelay.
  - Implementar visualización de perfiles Fresnel con escala de elevación ajustable y visualización 3D del elipsoide respecto al terreno DEM.

---

## 3. Motores Científicos y Calibración (Bloque 4)

- [ ] **Métricas Rigurosas de Calibración:**
  - Implementar cálculo out-of-sample de MAE, RMSE, IoU (Jaccard) para predicción de avance de incendios vs frentes observados en casos de referencia.
  - Documentar intervalos de confianza mediante Student-t / bootstrap sin asumir normalidad asintótica.
  - Añadir suite de tests automatizados de sensibilidad paramétrica para GeoRelay y frentes de fuego.

---

## 4. Offline y Privacidad (Bloque 5)

- [ ] **Almacenamiento Local Robusto:**
  - Empaquetar y versionar snapshots offline de DEM y cartografía en IndexedDB con cuotas controladas y purga LRU.
  - Asegurar que la telemetría de dispositivos (batería, orientación, acelerómetro) permanezca en modo opt-in estricto con interruptor visible y borrado total instantáneo.

---

## 5. Audiovisual y Despliegue (Bloques 6, 7 y 8)

- [ ] **Material de Inversores y Vídeos:**
  - Revisar y regenerar los assets de vídeo (`media/senda-film`) sincronizados con las capacidades de terreno 3D y GDACS consolidadas.
  - Comprobar subtítulos trilingües (ES/EN/NL).
- [ ] **Vercel Staging:**
  - Validar build prebuilt y generar manifiesto de procedencia criptográfica `release-manifest.json`.
  - Comprobar la URL de staging antes de cualquier promoción a producción.

# SENDA · Programa de calibración multifuente y auditoría independiente
**Fecha:** 2026-11-07 · **Estado:** protocolo de ejecución, NO calibración terminada · **Base:** SENDA PR #17 (`a622404c`)

## Resultado de esta intervención
- Registro `packages/senda/calibration/sources.v1.json` con **17 fuentes institucionales candidatas para 14 familias de motores**.
- Evaluador `packages/senda/src/calibration-gates.mjs`: no descarga ni modifica modelos; comprueba integridad declarada, derechos, independencia de verdad terreno, fecha de disponibilidad de cada predictor, partición por evento/sitio y métricas exclusivamente en casos TEST.
- Pruebas sintéticas explícitamente etiquetadas. Ninguna fila ficticia puede atribuirse a un sensor real.
- **NO-GO:** no hay nuevas calibraciones físicas, pruebas de radio, ensayos con personas ni permisos de streaming acreditados. `VERIFIED_OFFLINE` significará datos adquiridos y sellados; nunca permiso para emitir alertas.

## Protocolo común obligatorio (previo a cualquier ajuste)
1. **Snapshot**: adquirir bytes originales desde fuente autorizada; comprobar licencia, TOS, jurisdicción, consentimientos y prohibiciones de publicación. Guardar `sha256`, versión de producto, URL, UTC de captura, UTC de publicación, fecha de descarga y huella de transformación. Nunca incluir credenciales ni PII.
2. **Unidades y referencia**: especificar SI/UTC/CRS, georreferenciación, ventana temporal, calibración de sensores, quality flags, incertidumbre de referencia, máscara de nubes/no datos, cobertura y sesgos. Datos derivados de un mismo evento no son independientes.
3. **Tiempo de decisión**: ejecutar cada retrospectiva en `t0` usando únicamente entradas con `available_at_utc <= t0`. Si el reanálisis o perímetro final se publica después, solo puede servir como etiqueta retrospectiva, nunca como entrada.
4. **Separación**: dividir por incendio entero, carretera/cámara/sitio y periodo; congelar `TRAIN/VALIDATION/TEST` antes de ajustar parámetros. No reajustar ni seleccionar modelos usando TEST.
5. **Baselines**: declarar referencia ingenua/persistencia e institucional, comparación pareada por evento, bootstrap por grupo, IC95%, sensibilidad a datos ausentes, calidad y cambio de dominio. Documentar failure modes.
6. **Trazabilidad**: producir `source_id + original sha256 + fecha + licencia + versión del parser + modelo + split + métricas + commit`. El hash no prueba ejecución correcta; PCI es una evidencia verificable, no prueba de calibración.
7. **Gate**: revisar falsos positivos, confiabilidad temporal, permiso operacional y seguridad humana separadamente. Ninguna métrica automáticamente autoriza emergencias reales.

## Matriz por motor — nuevos datasets prioritarios, tests y barreras
| Motor | Datos candidatos / verdad independiente | Evaluación obligatoria | Bloqueo actual |
|---|---|---|---|
| GOES focos y fuego | GOES FHS con Mask y DQF + VIIRS science quality + NIST / EFFIS / MTBS | Precision/recall y latencia de detección por evento; intervalos de localización; falso positivo por día | Regenerar históricos v0.20 desde raw con Mask; no confundir centro de píxel con perímetro |
| Incendio 2D/3D | GOES/VIIRS como entradas según `t0`; NIST Camp para progresión; MTBS/EFFIS como perímetro final; ERA5 solo retrospectiva | IoU por lead time, error frente y Hausdorff, coverage 80/90 %, skill vs persistencia; leave-one-fire-out con n suficiente | Datos heterogéneos; no hay validación independiente suficiente ni truth temporal para todos |
| Viento/humo/atmósfera | ERA5 + estaciones viales Digitraffic + NOAA productos satélite | MAE/RMSE velocidad, error angular circular, skill por topografía, calibración de intervalo | Reanálisis ≠ disponibilidad en tiempo real; viento regional ≠ microclima |
| Visión y humo | ALERTCalifornia material autorizado anotado + cámaras Digitraffic con derechos comprobados + sensores externos | PR-AUC, recall, falso positivo/cámara-día y delay de inicio; negativos niebla/polvo/atardecer | Derechos de entrenamiento, calibración y anotación humana independientes |
| Velocidad, conteo y tráfico | Digitraffic TMS; Caltrans PeMS tras aprobación de cuenta; cámara georreferenciada | MAE/mediana velocidad vs detector, MAPE seguro, errores caudal/ocupación, estratificación por estación | Sin homografía ni vínculo sensor-cámara no hay km/h real |
| Evacuación / exposición | NIST timeline + PeMS + GHSL población agregada | Error del despeje, intervalos de llegadas, vehículos expuestos, lead time vs reglas base | GHSL no es número de personas presentes; falta validación de rutas |
| Riadas / hidrología | GloFAS histórico con versión + estaciones USGS Water Data | NSE, KGE, bias, error de pico y lead time por cuenca fuera de muestra | GloFAS es simulación; usar aforo observado independiente |
| Sismos | USGS ComCat como verdad de evento | tasa de detección, latencia, magnitud y error epicentral; ausencias y falsos alarmas | ComCat no calibra sensores MEMS del móvil; requiere ensayo físico |
| Ferrocarril | Network Rail tras registro autorizado | recall de incidencias, falsas alertas, latencia frente a bitácoras reales | Feed informativo no equivale a validación safety-critical |
| GNSS / órbitas | NOAA NGS CORS RINEX y productos de efemérides | error de posición p50/p95 por equipo y entorno; coherencia de tiempos | Un CORS no demuestra exactitud de móvil ni acceso a satélite |
| DTN / FEC / multiportador | Ensayo consentido en teléfonos/gateways y escenarios offline reales; modelos como benchmark | entrega antes de deadline, p50/p95 retraso, correlación de fallos, energía/bit, reconstrucción k/n | Sin mediciones físicas, probabilidad Poisson/independiente sigue siendo hipótesis |
| CSI / rescate / RF | Únicamente capturas de hardware CSI idóneo y prueba ciega consentida con habitación vacía/ocupada | sensitivity/specificity, FPR por hora, variación de pared/distancia/movimiento | No se puede afirmar visión tras muros ni localización de personas |
| Drones/telemetría | Logs de vuelos autorizados con ground truth independiente, GPS, espectro y consentimiento | disponibilidad enlace, footprint, energía, pérdida de paquetes y geofence | Sin vuelos autorizados / muestras radio: estudio teórico |
| Dispositivo/batería | Banco de teléfonos reales con opt-in y power monitor externo | consumo por mensaje, batería, background suspension, fallo en apagones | Browser API expone capacidades parciales, no certifica nodo |

## Reglas de puntuación e innovación
- Un modelo recibe `CALIBRATED_EXPERIMENTAL` solo cuando hay datos reales, parámetros ajustados con TRAIN, VALIDATION independiente, TEST congelado, hashes originales, evidencia verificable y criterios de aceptación pre-registrados.
- `HELD_OUT_RESEARCH_EVALUATION_ONLY` expresa una evaluación que pasa el *esquema de evidencia*, pero los booleanos declarados necesitan auditoría externa de las fuentes. No es prueba automática de que la muestra sea auténtica.
- Nunca aumentar TRL, vender un porcentaje de precisión, afirmar predicción anticipada de incendios, u ofrecer evacuación automática sobre estos tests sintéticos.
- Innovación con mayor prioridad: **fusión de riesgo local + transporte bajo degradación + recibo criptográfico de cada decisión**; demostrar ventaja frente a baselines por caso y con limitaciones claras.

## Acciones de adquisición — por urgencia
- **P0**: nueva descarga científica de GOES FHS con Mask/DQF y product granules; cruzar detecciones con NIST Camp, NASA FIRMS VIIRS *standard science quality* y MTBS sin acceso futuro.
- **P0**: adquirir series de TMS y estaciones meteorológicas Digitraffic con horas por sensor; realizar matched-camera benchmark solo donde exista permiso y homografía.
- **P1**: EFFIS en Europa + ERA5 para *retrospectiva* y estaciones independientes para verdad de viento; separar datos reanálisis de alertas disponibles en t0.
- **P1**: GloFAS histórico + USGS aforo; exigir dos cuencas/periodos no vistos y skill vs persistencia.
- **P1**: PeMS histórico previo registro y aprobación; ALERTCalifornia: confirmar uso para entrenamiento antes de copiar fotogramas.
- **P2**: banco de ensayos Android/ESP32/LoRa/Wi-Fi/BLE/SAT con autorizaciones y hardware disponible. No usar datasets sintéticos como calibración del canal.

## Referencias de primera fuente, verificadas 2026-11-07
1. NOAA GOES FHS validation: https://www.noaasis.noaa.gov/pdf/ps-pvr/goes18/ABI/Fires%20and%20Hot%20Spots%20Characterization/Full/GOES-18_ABI_L2_FireHotSpot_Full_ReadMe.pdf
2. NASA FIRMS archive: https://firms2.modaps.eosdis.nasa.gov/download/
3. NIST Camp Fire timeline: https://www.nist.gov/programs-projects/wildland-urban-interface-wui-fire-data-collection-parcel-vulnerabilities/nist/fire
4. USGS MTBS: https://burnseverity.cr.usgs.gov/direct-download
5. Copernicus EFFIS: https://forest-fire.emergency.copernicus.eu/applications/data-and-services
6. ERA5: https://climate.copernicus.eu/climate-reanalysis
7. Digitraffic road: https://www.digitraffic.fi/en/road-traffic/
8. Caltrans PeMS: https://dot.ca.gov/programs/traffic-operations/mpr/pems-source
9. ALERTCalifornia: https://alertcalifornia.org/images-and-video/
10. GloFAS historical: https://ewds.climate.copernicus.eu/datasets/cems-glofas-historical
11. USGS Water API: https://api.waterdata.usgs.gov/
12. USGS ComCat: https://earthquake.usgs.gov/fdsnws/event/1/
13. JRC GHSL: https://human-settlement.emergency.copernicus.eu/downloadWizard.php
14. Network Rail: https://www.networkrail.co.uk/who-we-are/transparency-and-ethics/transparency/open-data-feeds/
15. NOAA CORS (NODD): https://www.ngs.noaa.gov/CORS/data.shtml

## Entrega de siguiente iteración requerida
No cerrar esta tarea alegando calibración total. Publicar resultados por motor solo con: `dataset source + version + raw_sha256 + permitted use + frozen split + independent truth + metric uncertainty + baseline delta + commit + CI run URL`, y un enlace público a evidencias no sensibles. Mantener la rama protegida de fusiones automáticas a producción.

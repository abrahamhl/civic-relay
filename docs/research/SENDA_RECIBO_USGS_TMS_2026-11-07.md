# SENDA · Primer recibo reproducible de datos públicos (2026-11-07)

**Estado:** evidencia de adquisición real, no calibración de modelos ni ensayo de campo.
**Workflow:** [SENDA Public Research Snapshots #42384051353](https://github.com/abrahamhl/civic-relay/actions/runs/42384051353)
**Artefacto ZIP:** [senda-research-public-snapshots #13578433707](https://github.com/abrahamhl/civic-relay/actions/runs/42384051353/artifacts/13578433707) (expira 2026-12-07T14:58:18Z).
**Rama/commit:** audit/senda-calibration-quality-gates-20261107 / `5f7d0ced`.

| Fuente y límite | Resultado del API real | Momento UTC | SHA-256 de bytes originales | Qué demuestra |
|---|---|---|---|---|
| USGS ComCat FDSN; 2026-10-01 a 2026-11-01, M>=6 | 21 eventos recuperados | adquisición 2026-11-07T14:58:18Z | `75462bcf0e23f9d46e84560a152540fa04b05170efaad8a603308917ee606e43` | Acceso a etiquetas históricas de eventos, NO calibración de MEMS móviles |
| Fintraffic Digitraffic TMS 23001 | 30 valores numéricos de sensores físicos; `freshness=CURRENT` | sensor 2026-11-07T14:58:04Z, antigüedad 15 s | `e3f7de9818ca26ecfd4465a6e10c03d30ca8e7be5b87f0201982f3219d510085` | Lecturas actuales de estación física, NO velocidad de cámara/evacuación |

- El hash comprueba igualdad de bytes del archivo descargado; no valida matemáticamente el sensor ni la semántica de cada magnitud.
- En dos capturas del catálogo USGS separadas por aproximadamente dos minutos se obtuvieron 21 eventos en ambas, pero el SHA cambió: hay que preservar cada *snapshot*, versión y hora de extracción; no asumir catálogo inmutable.
- Los datos de Digitraffic son de **una sola estación**, sin ubicación/cámara emparejada y sin identificación de condiciones de incendio. No deben extrapolarse a otras zonas.
- Los eventos USGS se usarán como **etiquetas retrospectivas**. El campo `updated` no es prueba de la hora de disponibilidad original; no utilizar como predictor en backtests hechos antes de su publicación.
- No se han adquirido datos protegidos, vídeos de personas ni información privada. Scripts de descarga con límites de tamaño, ventana temporal y sin redirecciones.
- No se han ajustado parámetros de modelo ni comparado predicciones contra verdad terreno. Estado de motores: `NOT_CALIBRATED_BY_THIS_SNAPSHOT`; emisión de alertas: NO-GO.

## Próxima acción para convertir estas observaciones en calibración
1. Seleccionar una función de inferencia real y congelar commit, versión, parámetros, unidad, sitio y `t0`.
2. Capturar predicciones en TRAIN/VALIDATION/TEST sin utilizar variables publicadas después de `t0`.
3. Conseguir etiquetas independientes de ese modelo y aplicar controles de derechos, máscaras y referencias.
4. Ejecutar el evaluador `calibration-gates.mjs` con eventos/sitios fuera de muestra; comparar baselines, métricas e intervalos.
5. Publicar el informe de error y los datos permitidos, no solamente un resultado positivo.

**Fuentes:** https://earthquake.usgs.gov/fdsnws/event/1/ ; https://www.digitraffic.fi/en/road-traffic/

# SENDA · Bloqueos activos (2026-11-10)

| # | Bloqueo | Afecta a | Qué hace falta (sin copiar secretos) | Estado |
|---|---|---|---|---|
| B1 | NASA FIRMS exige `MAP_KEY` | Detecciones de fuego VIIRS/MODIS | El fundador solicita una clave gratuita en firms.modaps.eosdis.nasa.gov y la guarda como secreto del entorno | Host permitido; sin clave → adaptador NO creado para no fingir datos |
| B2 | Copernicus CDSE: el STAC es público, pero las descargas de escenas requieren cuenta | Imágenes Sentinel | Cuenta CDSE y credenciales como secreto | Host permitido; pendiente |
| B3 | Copernicus EMS Rapid Mapping | Perímetros de daño/inundación | Revisar el formato de recolección oficial | Host permitido; adaptador pendiente |
| B4 | `fetch` nativo de Node detrás de un proxy HTTPS | Capturas en vivo desde este contenedor | Ejecutar con `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21). En producción sin proxy no aplica | Resuelto para capturas manuales |
| B5 | Validación física RF / CSI / Android | Afirmaciones de cobertura medida | Radios autorizadas y teléfonos reales | Pendiente: todo lo RF es geometría o simulación |
| B6 | Decisión sobre el material de defensa que sigue en la portada (telediario general, modos desarrollador y ciudadano) | Superficies civiles | Decisión del fundador | Pendiente |
| B7 | Estudio de movilidad del Ministerio de Transportes (movilidad-opendata.mitma.es) responde HTTP 403 al acceso automatizado desde este entorno | Población dinámica (día/noche) por distrito y hora | Descarga manual por el fundador desde la web oficial, o API/convenio con el Ministerio. No se elude el bloqueo | Pendiente |

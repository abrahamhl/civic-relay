# SENDA Terrain Lab — Recibo científico de adquisición Mapzen/AWS

**Fecha UTC:** 2026-11-09 00:16:33.455. **Zona:** Valencia, España. **Estado:** `SOURCE_SNAPSHOT`.

## Procedencia y evidencia

- [Ejecución Github Actions #42539250733](https://github.com/abrahamhl/civic-relay/actions/runs/42539250733)
- [Artefacto de evidencia `senda-terrain-source-receipt` #13639749475](https://github.com/abrahamhl/civic-relay/actions/runs/42539250733/artifacts/13639749475). Artefacto temporal; este informe conserva un resumen permanente.
- Fuente: [Terrain Tiles — AWS Open Data](https://registry.opendata.aws/terrain-tiles/) gestionada por Mapzen/Tilezen.
- [Atribución y derechos de las fuentes originales](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). No se supone una licencia homogénea para todos los mosaicos.
- Método: codificación PNG Terrarium RGB; decodificación `R*256+G+B/256-32768` metros, validación de PNG/CRC-32, muestreo XYZ Web Mercator, reordenación WGS84 a malla 33x33.

## Resultados comprobados

| Variable | Valor |
| --- | --- |
| Mosaicos PNG descargados | 4 |
| Zoom XYZ | 10 |
| Samples DEM derivados | 1.089 (33 × 33) |
| Área aproximada | 30,90 km este-oeste × 26,69 km norte-sur |
| Latitud | 39.3499 a 39.5899 |
| Longitud | −0.5563 a −0.1963 |
| Mínimo registrado en raster | −50,73 m |
| Máximo registrado en raster | 222,91 m |
| CRS de salida | EPSG:4326 |
| Tile matrix origen | EPSG:3857 / XYZ |
| Datum vertical | MIXED_SOURCE_NOT_VALIDATED |
| Calibración independiente en terreno | No realizada |

### Huella SHA-256 de cada mosaico

```text
10/510/389  39b5ce7672943533b6574d7d2e51c0afa1a6fba5a4f7497b93c07d4052490529
10/511/389  051e83d0aa041b2d9de7cee7756b9d80a79e8eb1198ff205a48faf00c423269d
10/510/390  15ccc0dd590758906107d8b17697857cd316df120cbb9e401f91728cf0cadf40
10/511/390  af8d82d01ef7aacfd5d44eb9cbfeba0cfd51cdc8bb4297a82dfc6e50aa2c502b
```

Las huellas documentan qué bytes se adquirieron en aquella ejecución. Los datos pueden cambiar posteriormente y la integridad criptográfica no certifica exactitud altimétrica. El valor mínimo negativo podría reflejar terrenos bajo el nivel de referencia, batimetría, artefactos o convenciones de fuente; se debe contrastar con otra DEM antes de extraer conclusiones.

## QA separado del upstream

En el mismo workflow, 28/28 pruebas deterministas de adapters, 45/45 pruebas del paquete SENDA LIVE, TypeScript y build Vite aprobaron. Chromium en desktop 1440×900 y móvil 390×844: 2/2 PASS usando **fixtures sintéticos** para validar órbita 3D, recuadro geográfico, control vertical, línea temporal y recuperación de cache de DEM+meteorología después de reinicio offline.

**No demostrado:** topografía civil a escala de edificios, navegación offline por calles con PMTiles, calibración DEM contra levantamientos de campo, CFD meteorológica, modelos de incendio calibrados, vídeo óptico en el mismo motor, autorización RF de dispositivos, telemetría consentida real ni despliegue público por SHA.

## Continuidad

1. Revisar PR #25 → #26 → #27 → #28 y QA visual de capturas antes de fusionar.
2. Comparar alturas geográficas con IGN MDT y AHN/Copernicus en ubicaciones verificables fuera del entrenamiento; estimar RMSE y banda de confianza.
3. Implementar mosaicos vectoriales offline con licencia explícita, manifiesto de cobertura, cuotas y checksum.
4. Integrar datos temporales de sensores ambientales y vincular evidencias con incertidumbre.
5. Para uso comercial, revisar acreditaciones de fuentes DEM originales y conservar atribuciones en interfaz y exportaciones.
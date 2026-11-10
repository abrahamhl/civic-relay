---
name: road-safety-cits
description: "Tráfico, incidentes y seguridad vial mediante DATEX II, SUMO, C-ITS"
license: MIT
compatibility: OpenCode project skill
---

# Tráfico, incidentes y seguridad vial mediante DATEX II, SUMO, C-ITS

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Consumir fuente permitida, modelar velocidad/ocupación, validación real de corredor, SUMO+TraCI, CAM/DENM por convenio.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Distinguir reporte de cierre oficial; error del modelo medido frente a observaciones reales.

## Referencias primarias para comprobar versiones

- https://opendata.ndw.nu/
- https://docs.ndw.nu/
- https://sumo.dlr.de/docs/
- https://datex2.eu/

### Corredores y seguridad vial
- Ingestar NDW DATEX II georreferenciado con hora del suceso, publicación, frescura, magnitud y semántica vial; DGT NAP según permisos y versión de feed.
- Usar SUMO/TraCI para replay calibrado de velocidad, densidad, colas, cierres y evacuaciones; línea base LWR/CTM y split por corredor.
- Registrar si V16/C-ITS son datos oficiales, eventos de prueba o diseños de propuesta. No afirmar conexión a vehículos ajenos, operadoras ni C-V2X sin infraestructura e interfaces certificadas.
- Google Routes API sólo para uso permitido; Waze for Cities requiere socio y polígonos autorizados para su feed; OpenStreetMap/Valhalla pueden ser alternativa con licencias claras.
- Medir MAE de velocidad, error de ETA y tasa de alertas falsamente atribuidas.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.

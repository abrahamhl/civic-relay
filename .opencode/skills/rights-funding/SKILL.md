---
name: rights-funding
description: "Licenciamiento, claims científicos, IP, TRL, financiación europea"
license: MIT
compatibility: OpenCode project skill
---

# Licenciamiento, claims científicos, IP, TRL, financiación europea

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Vincular cada claim a un test, hardware, fecha y límite. Verificar derechos por dataset y licencias de dependencias.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Eliminar 100% offline, 14min ventaja y admisibilidad pericial no probadas; score TRL por módulo.

## Referencias primarias para comprobar versiones

- https://www.esa.int/
- https://commission.europa.eu/
- https://eic.ec.europa.eu/

### Defensa ante inversores
- Por afirmación: texto, fuente, test, hash, fecha, condición, usuario beneficiado, TRL y redacción permitida. Si falta prueba, degradar claim.
- Revisión de licencias por componente (GPL/EPL/MIT/Apache/comercial), mapas, vídeos y datos; el hecho de haber descargado no autoriza a redistribuir.
- Estudiar innovación en combinaciones de fuente→evidencia→DTN y comparación con soluciones existentes; no declarar patentable lo común.
- Separar presentación pública, demo interna y expediente de validación; nunca confundir simulación con operativo, ni prometer certificación jurídica o de emergencia sin organismo competente.
- ROI por coste de instalación, coste mensual, alertas útiles verificadas, integración y acceso por convenio; preparar pilotos antes de venta institucional.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.

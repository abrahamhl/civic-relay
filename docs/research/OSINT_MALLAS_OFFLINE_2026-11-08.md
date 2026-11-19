# OSINT para mallas offline: fuentes abiertas, canales y límites (08-11-2026)

> **Firma:** Asistente de Orquestación Senior, v0.21.
> **Estado:** revisión documental; no hay conectores en vivo en la superficie `/mando`.
> **Regla:** SENDA es un canal secundario. No sustituye al 112, no se hace pasar por una autoridad y no presenta datos sintéticos como si fueran telemetría operativa.

---

## 1. Qué significa OSINT aquí

OSINT, *Open Source Intelligence*, es el uso de información pública, legal y atribuible para entender el entorno. En este proyecto sirve para tres cosas:

1. Verificar qué canales existen y cuáles son públicos.
2. Documentar sus condiciones de acceso, licencia y frescura.
3. Diseñar un modelo que no dependa de datos que no podemos usar.

No significa acceder a cámaras privadas, saltarse credenciales, recolectar datos personales ni reconstruir identidades. Tampoco significa que una fuente sea fiable por ser pública.

**Marco mínimo:** RGPD y LOPDGDD en España; condiciones de servicio de cada fuente; minimización de datos; base jurídica para cualquier tratamiento; revisión legal antes de un piloto real.

---

## 2. Clases de fuentes

| Clase | Ejemplos | Uso en el proyecto | Frescura típica | Límite principal |
|---|---|---|---|---|
| Autoridades de emergencia | 112, Protección Civil, NL-Alert, regiones de seguridad | Entender canales, formatos y mensajes | Minutos | No siempre hay API pública; no se puede suplantar |
| Cámaras de tráfico | DGT, TfL, Caltrans, autoridades regionales | Contexto visual y de tráfico | Segundos–minutos | Términos de uso; no todas son públicas; privacidad |
| Satélite y meteorología | Copernicus, GOES, Sentinel, AEMET, KNMI | Terreno, humo, viento, cicatrices | 5 min–días | Resolución, nubes, latencia, licencias |
| Cartografía | IGN, CNIG, PDOK, Copernicus DEM | Relieve, vías, municipios, elevación | Estática | Distinto datum y escala; no es un mapa operativo |
| Estándares | ITU, ETSI, 3GPP, OASIS, IETF | Física de radio, CAP, DTN | Estable | Documentos de pago o ediciones cambiantes |
| Documentación de fabricantes | Semtech, LoRa Alliance, operadores satelitales | Airtime, sensibilidad, límites | Estable | Interés comercial; no sustituye una medición |
| Comunidad y redes sociales | Avisos vecinales, cuentas oficiales, foros | Corroboración | Segundos–horas | Ruido, duplicados, desinformación |
| Datos abiertos de movilidad | NAP, DATEX II, portales autonómicos | Estado de vías e incidencias | Minutos | Cobertura desigual; claves y cuotas |

**Criterio:** una fuente solo entra en una ficha si se puede nombrar, enlazar, fechar y citar. Si no, queda como «pendiente de verificar».

---

## 3. España

| Fuente | Qué aporta | Acceso | Estado |
|---|---|---|---|
| **112** | Canal de emergencia principal; voz y accesibilidad | Público | Verificado como canal; integración técnica no realizada |
| **ES-Alert** | Avisos de Protección Civil por difusión celular | Recepción pública | Verificado como canal; no se envía desde SENDA |
| **DGT** | Cámaras e incidencias de tráfico | Web pública y servicios de la DGT | Usado como referencia; revisar condiciones |
| **AEMET OpenData** | Observación y predicción meteorológica | API con clave gratuita | Verificado como fuente abierta |
| **INCIBE 017** | Ciberseguridad para ciudadanía y empresas | Público | Verificado como línea de ayuda |
| **Copernicus EMS** | Cartografía de emergencias | Activación y productos públicos | Verificado como fuente europea |
| **IGN / CNIG** | Cartografía, relieve y datos territoriales | Descarga pública | Verificado como fuente cartográfica |
| **MITECO** | Información ambiental y de incendios | Web pública | Pendiente de revisar API y licencia |
| **Servicios autonómicos** | 112 y protección civil regional | Portales públicos | Cobertura y formatos desiguales |

**Nota sobre cámaras:** una cámara pública de tráfico no es una cámara de emergencias. Su encuadre, su latencia y su disponibilidad no están diseñados para mando de incidentes. En el modelo, `DGT-CAM-04` y `DGT-CAM-11` son etiquetas de origen; no hay vídeo conectado.

---

## 4. Países Bajos

| Fuente | Qué aporta | Acceso | Estado |
|---|---|---|---|
| **112** | Emergencia principal | Público | Verificado como canal |
| **NL-Alert** | Avisos por difusión celular | Recepción pública | Verificado como canal |
| **Burgernet** | Colaboración ciudadana con la policía | Solo por convenio | No integrado; requiere acuerdo |
| **natuurbrandrisico.nl** | Fases de riesgo de incendio forestal | Público | Verificado como referencia |
| **KNMI Data Platform** | Observaciones de 10 minutos y modelos | API con clave gratuita | Verificado como fuente abierta |
| **Rijkswaterstaat** | Estado de carreteras y tráfico | Datasets y servicios públicos | Pendiente de revisar condiciones |
| **PDOK** | Cartografía y datos geográficos | Servicios públicos | Verificado como fuente cartográfica |
| **Regiones de seguridad** | Coordinación de emergencias | Portales públicos | Cobertura variable |

El país es un buen banco de pruebas por su densidad de flota, su orografía llana y sus datos abiertos. Eso no elimina la necesidad de validar cobertura, energía y comportamiento en el Veluwe o en brezales.

---

## 5. Unión Europea y estándares

- **EENA** documenta la organización de los servicios de emergencia europeos y la accesibilidad del 112.
- **Copernicus** ofrece productos de emergencia y observación de la Tierra.
- **Galileo / EGNOS** aportan posicionamiento; no sustituyen la localización indoor.
- **OASIS CAP v1.2** es el formato de alerta común que el modelo cita como destino.
- **IETF DTN (RFC 5050 / RFC 9171)** inspira el almacenamiento y reenvío, aunque la implementación de SENDA es propia.
- **ETSI EN 300 220** y **ERC Recommendation 70-03** enmarcan las bandas sub-GHz europeas.
- **3GPP** define límites de transmisión que deben respetarse en cualquier prueba con módems reales.

Las referencias se citan para orientar la validación, no para afirmar conformidad. Ninguna certificación está obtenida.

---

## 6. Protocolo de verificación

Cada dato debe responder a estas preguntas:

| Pregunta | Registro |
|---|---|
| ¿Quién lo publica? | Autoridad, organismo, empresa o persona identificable |
| ¿Cuándo? | Marca temporal con zona horaria |
| ¿Dónde? | Geometría o municipio; datum y precisión |
| ¿Con qué licencia? | Abierta, restringida o solo consulta |
| ¿Es primario? | Original o agregado por un tercero |
| ¿Se corrobora? | Segunda fuente independiente |
| ¿Contiene PII? | Minimizar, difuminar o descartar |
| ¿Sigue vigente? | Fecha de caducidad y reintento |

**Etiquetas de confianza:**

- **Verificado:** fuente primaria, fecha y geometría comprobables, licencia clara.
- **Corroborado:** dos fuentes independientes coinciden; puede faltar la primaria.
- **Pendiente:** no hay fuente suficiente o hay conflicto.
- **Descartado:** fuente caducada, no atribuible o fuera de licencia.

---

## 7. Qué hace y qué no hace la superficie `/mando`

**Hace:**

- muestra activaciones sintéticas con un campo `source` que parece un identificador realista;
- calcula rutas, coberturas, presupuestos de enlace y auditoría local;
- declara con claridad que no hay radios, cámaras, GPS ni dispatch conectados;
- permite exportar el estado del ejercicio para revisión.

**No hace:**

- no ingesta OSINT en vivo;
- no abre cámaras ni descarga vídeo;
- no envía mensajes a servicios de emergencia;
- no cruza datos personales;
- no se conecta al 112, a ES-Alert ni a NL-Alert;
- no usa el conector de producción de la Consola Mando, que es privado.

La etiqueta `DGT-CAM` del modelo es una referencia documental. El canal de `ACT-2416` es `CELL` porque una cámara DGT se enlaza por celular; no existe un canal llamado «cámara».

---

## 8. Huecos y tareas pendientes

- Confirmar términos, cuotas y claves de cada API antes de un piloto.
- Medir latencia real de ES-Alert y NL-Alert; el modelo no la conoce.
- Documentar cobertura de texto en tiempo real y lengua de signos por región.
- Revisar si las cámaras elegidas permiten uso derivado; no basta con que sean visibles.
- Diseñar un registro de procedencia para cualquier feed futuro.
- Validar el comportamiento con datos caducados y fuentes en conflicto.
- Revisar el impacto de género, discapacidad y brecha digital en la recepción.
- Obtener revisión legal antes de procesar cualquier dato personal.

**Nada de esta lista está resuelto por la simulación.**

---

## 9. Referencias

- 112 España: <https://www.112.es/>
- Protección Civil: <https://www.proteccioncivil.es/>
- DGT: <https://www.dgt.es/> · Incidencias: <https://infocar.dgt.es/etraffic/>
- AEMET OpenData: <https://opendata.aemet.es/>
- INCIBE 017: <https://www.incibe.es/>
- Copernicus EMS: <https://emergency.copernicus.eu/>
- IGN: <https://www.ign.es/> · CNIG: <https://www.cnig.es/>
- MITECO: <https://www.miteco.gob.es/>
- 112 Países Bajos: <https://www.112.nl/>
- NL-Alert: <https://www.nl-alert.nl/>
- Burgernet: <https://www.burgernet.nl/>
- natuurbrandrisico: <https://www.natuurbrandrisico.nl/>
- KNMI Data Platform: <https://dataplatform.knmi.nl/>
- Rijkswaterstaat: <https://www.rijkswaterstaat.nl/>
- PDOK: <https://www.pdok.nl/>
- EENA: <https://eena.org/>
- OASIS CAP: <https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html>
- IETF RFC 5050: <https://www.rfc-editor.org/rfc/rfc5050>
- IETF RFC 9171: <https://www.rfc-editor.org/rfc/rfc9171>
- ETSI EN 300 220: <https://www.etsi.org/standards-search>
- ERC Recommendation 70-03: <https://www.cept.org/ecc/tools-and-services>
- 3GPP: <https://www.3gpp.org/specifications>

Las URLs se incluyen para localizar la fuente; las condiciones de uso y la edición vigente deben comprobarse en cada caso.

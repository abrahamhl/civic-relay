# Cámaras públicas en SENDA (ES · NL · BE · DE) · revisión del 27-11-2026

SENDA une fuentes **oficiales** que publican cámaras para reutilizarlas. Cada cámara guarda su fuente y su licencia.
**No** se incluyen cámaras privadas, CCTV sin protección ni agregadores sin licencia.

- Archivo generado: `investor-next/public/senda/data/referencias/camaras_publicas.json`.
- Para regenerarlo: `node packages/senda/scripts/fetch-public-cameras.mjs`.
- Código: `packages/senda/src/public-cameras.mjs`, con pruebas en `packages/senda/tests/public-cameras.test.mjs`.

| País | Fuente | Licencia | Cámaras (27-11-2026) | Imagen |
|---|---|---|---:|---|
| ES | DGT (red estatal, salvo Cataluña y País Vasco) | DGT, reutilización con atribución (CC BY) | 1 975 | sí (`etraffic.dgt.es`) |
| ES | Ayuntamiento de Madrid ([datos.madrid.es](https://datos.madrid.es/egob/catalogo/202088-0-trafico-camaras)) | condiciones de datos.madrid.es (atribución) | 357 | sí, se renueva cada 5 min (`informo.madrid.es`) |
| ES | Gobierno Vasco · [API de tráfico](https://api.euskadi.eus/traffic/v1.0/cameras) (ficha en [datos.gob.es](https://datos.gob.es/en/catalogo/a16003011-camaras-de-trafico-de-euskadi1)) | CC BY 4.0 | 489 | no: solo la ubicación (coordenadas UTM 30 convertidas a WGS84) |
| NL | Rijkswaterstaat · [api.rwsverkeersinfo.nl/api/cameras](https://api.rwsverkeersinfo.nl/api/cameras) | **no verificada**: solo la ubicación y el enlace a la emisión oficial | 26 | no (emisión en directo en su web) |
| BE | Ville de Bruxelles · [webcams](https://opendata.bruxelles.be/explore/dataset/webcams/) | CC0 1.0 | 2 | no (página oficial) |
| DE | Autobahn GmbH · [API oficial](https://verkehr.autobahn.de/o/autobahn/) | API pública | **0** | la API responde, pero sin webcams en ninguna vía |

**Alemania.** El conjunto de datos «Webcam-Bilder Baden-Württemberg» de [MobiData BW](https://mobidata-bw.de/dataset/webcam-bilder-bw) indica que, por la situación de seguridad actual, las imágenes de las webcams no se publican libremente hasta nuevo aviso y solo se ceden a autoridades. Su licencia es DL-DE/BY-2.0. Coincide con que la API de Autobahn devuelva 0 webcams. SENDA podría pedir ese acceso como institución; hoy no lo tiene.

**Pendiente de añadir con verificación**, porque no se ha comprobado todavía su acceso ni su licencia:
- España: Vitoria-Gasteiz (API REST, CC BY 4.0), Málaga, Vigo y Cataluña (SCT).
- Bélgica: Valonia (Trafiroutes) y Flandes (Verkeerscentrum). Ninguna de las dos tiene API de imágenes con licencia abierta localizada.

En la app (Conducir → capa Cámaras):
- Se ven hasta 150 cámaras a la vez en pantalla, a partir del zoom 10.
- Si hay imagen, se muestra en vivo y se recarga cada minuto.
- Si la fuente solo publica la ubicación, se dice así y, en la web, se enlaza la emisión oficial.

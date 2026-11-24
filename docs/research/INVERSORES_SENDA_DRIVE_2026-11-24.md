# SENDA Drive · qué mira un inversor y qué podemos enseñar de verdad (2026-11-24)

Regla CLAUDE.md: solo cifras medidas o con fuente. Las fuentes de abajo son blogs de fondos y prensa: orientan, no son
una encuesta formal (no encontrada).

## 1. Qué piden (con fuente)
| Lo que miran | Fuente | Qué tiene SENDA hoy | Qué falta |
|---|---|---|---|
| **Tracción comercial** por encima de la demo técnica | Qubit Capital, «VC risk appetite» [1] | Nada comercial (prototipo) | Primer piloto (DGT 3.0, Waze for Cities como operador, ayuntamiento) |
| **Datos propios que crecen con cada uso** («data moat») | Netradyne en TechCrunch [2]; Redbud sobre Saferide [3] | Caja negra con sello SHA-256 y JSONL por viaje | Viajes reales acumulados (empieza esta noche Veenendaal → Arnhem) |
| **Camino de certificación y cumplimiento** | Qubit Capital [1] | Datos con licencia y fuente; sin PII; sin controles móviles | Evaluación RGPD formal; no es un ADAS certificado (decirlo siempre) |
| **Eficiencia de capital** | Qubit Capital [1] | Coste de servicios 0 € (todo en el móvil, datos abiertos) | Medir batería y temperatura reales |

## 2. Lo que más puede sorprender (y es demostrable)
1. **Vídeo de pantalla + caja negra del mismo viaje**: la interfaz con lo que vio la cámara, los avisos DGT/NDW y los
   radares oficiales, y el archivo sellado que permite reproducir cada decisión. Es evidencia, no un render.
2. **Funciona sin red**: radares ES+NL, incidencias y detector dentro de la APK; mensajes por Bluetooth.
3. **Transparencia**: cada número dice si es MEDIDO, MODELO o REGLA DE LA APP (nadie más lo enseña así).

## 3. Lo que NO se puede prometer
- **«Sincronizado 100 % con Waze y Google Maps»**: no existe API pública para recibir sus avisos. Waze for Cities
  comparte datos gratis con administraciones y operadores privados de carreteras que lo solicitan, y prohíbe hacerlos
  públicos [4][5]. SENDA abre la ruta en Waze/Maps con un toque; no copia sus avisos.
- Distancias en metros sin montaje medido; precisión «centimétrica» con GPS de móvil.

## 4. Siguiente paso con más retorno
Tres viajes con caja negra + vídeo → informe medido (fps reales, alertas por minuto, huecos GPS, batería) →
una página para inversores con esos números y el vídeo. Sin viajes reales, no hay cifras que enseñar.

## Fuentes
1. https://qubit.capital/blog/vc-risk-appetite-mobility-startups
2. https://techcrunch.com/2025/01/17/netradyne-snags-90m-at-1-25b-valuation-to-expand-smart-dashcams-for-commercial-fleets
3. https://redbud.vc/latest/why-we-invested-in-saferide
4. https://support.google.com/waze/partners/answer/10453062
5. https://support.google.com/waze/partners/answer/10618477

# Vigía de novedades

Filtro para implementar: **útil en emergencia · verificable · legal · barato**. Solo pasa lo que cumple los cuatro.

| Fecha | Fuente | Qué dice | Filtro | Decisión |
|---|---|---|---|---|
| 2026-11-23 | [La Moncloa, V16 conectada](https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/interior/paginas/2025/251125-obligacion-baliza-v16-carretera.aspx) (primaria) | GPS + SIM no extraíble; envía posición a DGT 3.0; 12 años de conectividad en el precio; sin cobertura convencional usa redes IoT, y si tampoco hay guarda y envía después; no envía datos personales; multa 80 € | Útil: sí (fuente de posición de vehículos parados). Verificable: parcial. Legal: sí si es dato público. Barato: sí | Modelada en `packages/senda/src/external-links.mjs` sin cifras inventadas. **No hay API para terceros documentada**: no se integra hasta comprobar si DGT la publica (NAP/DATEX II). Pendiente |
| 2026-11-23 | [TechRadar, RugOne Xlink 7](https://techradar.com/pro/phone-communications/rugone-xlink-7-rugged-walkie-talkie-review) (secundaria, 17-07-2026) | Walkie 4G: «dispositivo celular, no una radio; vive y muere con la cobertura 4G». SIM incluida 1 año, luego coste | Útil para emergencias sin red: **no** (cae con la torre) | Registrado: sirve de comparación, no de canal de apagón |
| 2026-11-23 | [Xiaomi, Comunicación Offline](https://www.mi.com/es/support/faq/details/KA-950967/) (primaria) | Llamadas por Bluetooth sin torres (1,3–1,9 km en abierto según modelo); requiere SIM, cuenta Xiaomi y modelos concretos; «no pensada para emergencias» | Útil: limitado. Verificable: solo cifras del fabricante, sin medida independiente | Registrado; no se implementa |
| 2026-11-23 | Poclink (tienda del fabricante, sin leer a fondo) | Modelo híbrido LTE + radio analógica | Fuente débil | **No verificado.** Si interesa, comprobar banda y licencia en España antes de nada |

## Sobre «el walkie 4G chino que funciona sin datos y sin nada»
No he encontrado ese producto. Lo que sí hay: (a) walkies 4G PoC que **necesitan SIM y cobertura** y se quedan inservibles sin ella (TechRadar); (b) híbridos con radio analógica de respaldo; (c) llamadas Bluetooth de Xiaomi. Si tienes el nombre o el enlace del que viste, mándalo y lo analizo; hasta entonces no se da por existente.

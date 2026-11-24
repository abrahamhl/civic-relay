# SENDA Drive · propuestas matemáticas de alto valor (2026-11-24)

Criterio: cada propuesta debe (1) mejorar algo que el conductor nota, (2) tener garantías matemáticas que se puedan
decir en voz alta a un inversor y (3) calibrarse con NUESTROS datos (caja negra), no con números inventados.

## ✅ Hecho hoy: «¿sigue ahí el aviso?» (`hazard-belief.mjs`)
- **Modelo**: cadena de Markov oculta de 2 estados con muerte absorbente (PRESENTE → DESPEJADO, semivida por tipo)
  y observaciones con sensibilidad s y especificidad c. Filtro de Bayes **exacto** (no aproximado).
- **Resultado cerrado**: sin noticias, la creencia cae a ½ en t½ = h·log₂(2p) → «probablemente despejado en ~X min».
- **Efecto real**: antes, el corredor mostraba avisos SENDA sin límite de antigüedad; ahora caducan solos, suben con
  confirmaciones de otros móviles (el deduplicado de Bluetooth cuenta como confirmación; el eco del propio aviso no)
  y bajan con «Ya no está».
- **Honestidad**: semivida = valores de ejemplo de road-guard; s y c = reglas de la app. `fitReliability()` los
  re-estima con resultados reales (Laplace) y solo dice «calibrado» con ≥10 casos positivos y ≥10 negativos.

## Siguientes (por orden de retorno)
| # | Propuesta | Matemática | Qué gana el usuario | Datos que hacen falta |
|---|---|---|---|---|
| 1 | **Autocalibración de s y c** | EM / Baum–Welch sobre el mismo HMM | La app aprende cuánto fiarse de cada fuente | Votos y verificaciones con cámara de los viajes |
| 2 | **Alertas con garantía de error** | Predicción conforme (Vovk; tutorial Angelopoulos & Bates 2021): P(fallo) ≤ α sin suponer distribución | Poder decir «como mucho 1 de cada 20 alertas rojas es falsa» con prueba | Fotogramas etiquetados de la caja negra + vídeo |
| 3 | **Confirmación óptima de alertas** | Test secuencial de Wald (SPRT, 1945): sustituye la regla fija de «2 fotogramas» con α y β explícitos y el mínimo número esperado de fotogramas | Alertas antes cuando son claras, menos falsas cuando son dudosas | Puntuaciones del detector en la caja negra |
| 4 | **IA que gasta batería solo cuando hace falta** | Valor de la información: cadencia ∝ tasa de riesgo (velocidad, objetos, corredor); problema de planificación tipo «restless bandit» | Menos batería y temperatura con la misma seguridad | Batería y ms por fotograma medidos (caja negra ya los guarda) |
| 5 | **¿Hasta dónde llega un aviso por Bluetooth?** | Percolación 1D en carretera + modelo epidémico con «ferry» en sentido contrario | Una cifra por densidad de tráfico: «a 30 veh/km, el aviso llega a X km en Y min» | Alcance BLE medido (prueba guiada) + densidad NDW/DGT |
| 6 | **Posición en ciudad (cañón urbano)** | Map-matching HMM (Newson & Krumm, 2009) sobre la red OSM, encima del EKF | Menos saltos de GPS entre edificios | Trazas GPS de la caja negra |

## Qué NO se promete
- Ninguna de las cifras de la tabla existe todavía: se obtienen con los viajes reales.
- No es un ADAS certificado; las garantías de (2) y (3) son estadísticas sobre los datos con los que se calibran.

# Mallas offline: física, matemática y límites del modelo de mando (08-11-2026)

> **Firma:** Asistente de Orquestación Senior, v0.22 · modelo `mando-2.2.0`.
> **Estado:** `SIMULATED_VALIDATED`; la validación física sigue `PHYSICAL_TEST_PENDING`.
> **Ámbito:** superficie `/mando` de `investor-next`, modelo `lib/command-surface.ts` y consola `app/command-surface.tsx`.
> **Regla:** las cifras de alcance, caudal, margen y probabilidad son presupuestos de planificación. No son mediciones de campo ni una garantía de servicio.

---

## 1. Qué representa el modelo

La superficie de mando no es un CAD de emergencias real. Es un ejercicio determinista con tres escenarios, ocho activos, treinta y cuatro activaciones y ocho canales. El reloj avanza de 0 a 900 s y las activaciones aparecen en los instantes definidos en el modelo.

| Escenario | Canales activos | Gateway | Daño | Nodos de malla | Semilla |
|---|---|---|---:|---:|---:|
| `blackout` | acústico, BLE, LoRa, satélite | fuera | 100 % | 17 | 11 |
| `degraded` | acústico, BLE, Wi-Fi, LoRa, SMS, satélite | degradado | 65 % | 31 | 29 |
| `recovery` | los anteriores + celular | online | 15 % | 46 | 47 |

La semilla y el número de nodos son parámetros narrativos del ejercicio. No se usan para generar tráfico ni para estimar capacidad real.

---

## 2. Taxonomía de canales

| Canal | Alcance nominal | Alcance en escombros | Tasa | Carga máxima | Latencia base | Energía | Global |
|---|---:|---:|---:|---:|---:|---:|---|
| Acústico | 30 m | 6 m | 160 bit/s | 4 KiB | 9,2 s | 1 | no |
| BLE | 40 m | 8 m | 100 kbit/s | 64 KiB | 0,4 s | 1 | no |
| Wi-Fi | 120 m | 15 m | 20 Mbit/s | 50 MiB | 1,5 s | 3 | no |
| LoRa | 3 km | 300 m | 1 kbit/s | 200 B | 3 s | 1 | no |
| SMS | 10 km | 10 km | 1,12 kbit/s | 840 B | 3 s | 1 | sí |
| Satélite | 10 km | 10 km | 300 bit/s | 160 B | 8 s | 2 | sí |
| Celular | 10 km | 10 km | 2 Mbit/s | sin límite práctico | 1 s | 0 | sí |
| Gateway | 10 km | 10 km | 1 Gbit/s | sin límite práctico | 0,2 s | 0 | sí |

Los canales globales se consideran alcanzables sin comprobar distancia, pero siguen exigiendo que el canal esté activo en el escenario y que exista un activo compatible. El canal lógico `GATEWAY` no se usa como enlace de malla: la puerta se elige como destino.

**Lectura correcta:** LoRa no es un canal de vídeo. Su carga máxima de 200 B y su tasa de 1 kbit/s lo hacen adecuado para telemetría y SOS comprimidos, no para imágenes. Wi-Fi y celular pueden transportar más, pero dependen de infraestructura que el escenario puede declarar caída.

---

## 3. Presupuesto de enlace

### 3.1 Pérdida media log-distancia

La referencia de espacio libre se evalúa a 1 km. Para distancia \(d\) en metros y frecuencia \(f\) en MHz:

\[
FSPL_{dB} = 32{,}44 + 20\log_{10}(d_{km}) + 20\log_{10}(f)
\]

\[
P_{L,media} = 32{,}44 - 60 + 20\log_{10}(f) + 10n\log_{10}(d_m) + L_{clutter}
\]

donde \(n\) es el exponente de pérdida del entorno y \(L_{clutter}\) la pérdida adicional por clutter. A 1 km y \(n=2\), la expresión coincide con FSPL.

La potencia recibida es:

\[
P_r = P_t + G_t + G_r - P_{L,media} - L_{muro}
\]

donde \(L_{muro}\) es la atenuación acumulada de los muros seleccionados.

### 3.2 Sombra, ruido, SNR y margen

La sombra log-normal se modela con desviación \(\sigma\) en dB. El margen medio y el margen al 90 % son:

\[
M_{dB} = P_r - S
\]

\[
M_{P90} = M_{dB} - 1{,}28155\sigma
\]

El enlace se declara viable si \(M_{dB} \ge 0\) y viable al 90 % si \(M_{P90} \ge 0\). La probabilidad de enlace es:

\[
P_{enlace} = \Phi\left(\frac{M_{dB}}{\sigma}\right)
\]

Con ancho de banda \(B\) en Hz y figura de ruido \(NF\) en dB:

\[
N_{dBm} = -174 + 10\log_{10}(B) + NF
\]

\[
SNR_{dB} = P_r - N_{dBm}
\]

donde \(S\) es la sensibilidad del receptor.

### 3.3 Capacidad de Shannon

Si el margen es positivo:

\[
C = B\log_2\left(1 + 10^{SNR_{dB}/10}\right)
\]

La capacidad es un techo teórico, no una tasa obtenida. No incluye colisiones, retransmisiones, cabeceras, ni compartición de medio.

### 3.4 Alcance máximo

Despejando la distancia del presupuesto:

\[
d_{max,m} = 10^{\left(P_t + G_t + G_r - L_{muro} - S - 32{,}44 + 60 - 20\log_{10}(f) - L_{clutter}\right)/(10n)}
\]

El resultado físico se limita al alcance de planificación del canal. Así se evita presentar un alcance de espacio libre muy superior al rango operativo declarado.

### 3.5 Entornos de propagación

| Entorno | \(n\) | \(\sigma\) (dB) | Clutter (dB) |
|---|---:|---:|---:|
| Abierto | 2,0 | 3 | 0 |
| Rural | 2,2 | 4 | 2 |
| Suburbano | 2,7 | 6 | 6 |
| Urbano | 3,2 | 8 | 12 |
| Escombros | 3,8 | 9 | 18 |

El entorno por defecto es `SUBURBAN`. Los valores son supuestos de planificación inspirados en curvas estándar, no una calibración medida en El Tiemblo. La consola permite sustituir \(\sigma\) por una sigma global de planificación; el valor inicial es el de la tabla.

### 3.6 Perfiles RF del modelo

| Canal | Frecuencia | Potencia TX | Sensibilidad | Ancho de banda |
|---|---:|---:|---:|---:|
| BLE | 2400 MHz | 10 dBm | −95 dBm | 2 MHz |
| Wi-Fi | 2400 MHz | 20 dBm | −85 dBm | 20 MHz |
| LoRa | 868 MHz | 14 dBm | −137 dBm | 125 kHz |
| SMS | 900 MHz | 23 dBm | −109 dBm | 200 kHz |
| Satélite | 1990 MHz | 23 dBm | −120 dBm | 3,6 kHz |
| Celular | 900 MHz | 23 dBm | −110 dBm | 10 MHz |

Para el margen nominal se usan 2 dBi de ganancia en cada extremo, 6 dB de figura de ruido, sin muros, y una distancia de referencia de la mitad del alcance nominal, con un mínimo de 30 m.

### 3.7 Atenuación por obstáculo

| Material | Sub-GHz | Wi-Fi 2,4 GHz | Wi-Fi 5 GHz |
|---|---:|---:|---:|
| Pladur | 1,5 dB | 3,2 dB | 4,8 dB |
| Ladrillo 25 cm | 4,5 dB | 8,4 dB | 14,2 dB |
| Hormigón 30 cm | 9,8 dB | 17,5 dB | 28,6 dB |
| Escombros colapsados | 12,4 dB | 23,8 dB | 36,5 dB |

**Límite importante:** el modelo es log-distancia más atenuación de muro y una sombra log-normal. No incluye difracción, multitrayecto correlacionado, desvanecimiento rápido, absorción por vegetación, pérdida por cuerpo, altura de antena, lluvia ni interferencia. En escombros reales, la variabilidad espacial puede dominar el resultado. Por eso las cifras son cotas de planificación y deben sustituirse por mediciones antes de cualquier afirmación operativa.

---

## 4. Tiempo de aire y coste de ruta

### 4.1 Acústico

\[
t_{acústico} = \left(8 + \left\lceil\frac{(2 + bytes + 4)\cdot 14}{4}\right\rceil\right)\cdot 0{,}025 + 0{,}1
\]

El modelo paga 25 ms por símbolo y añade 100 ms de establecimiento. Es una aproximación de ingeniería, no una modulación acústica certificada.

### 4.2 LoRa

Con factor de dispersión \(SF\), ancho de banda \(B\) y tasa de codificación \(CR\):

\[
T_s = \frac{2^{SF}}{B}
\]

\[
numerator = 8\cdot bytes - 4\cdot SF + 28 + 16
\]

\[
payloadSymbols = 8 + \max\left(\left\lceil\frac{numerator}{4(SF - 2\cdot LDR)}\right\rceil (CR + 4), 0\right)
\]

\[
t_{LoRa} = (preamble + 4{,}25 + payloadSymbols)\cdot T_s
\]

Por defecto: \(SF=12\), \(B=125\) kHz, \(CR=1\), preámbulo de 8 símbolos y \(LDR=1\) para \(SF \ge 11\). El resultado es conservador para el peor caso de largo alcance.

### 4.3 SMS y satélite

- SMS: \(\lceil bytes/116\rceil \cdot 3\) s.
- Satélite: \(8 + \lceil bytes/160\rceil \cdot 8\) s.

Ambos son modelos de cola, no medidas de un operador concreto.

### 4.4 Dijkstra con canales compartidos

La ruta se calcula sobre un grafo cuyos nodos son la activación y los activos no offline. Para cada arco:

\[
coste = latencia_{canal} + tiempoDeAire(bytes) + distancia_{km} + 24(1-p_{enlace}) + 1{,}2\cdot energia_{canal}
\]

Se aplica Dijkstra porque todos los costes son no negativos. Un arco solo existe si ambos extremos comparten un canal activo en el escenario. Si comparten varios, se prueban todos y se elige el de menor coste; el orden de preferencia solo rompe empates. Los canales globales no comprueban distancia; los demás usan el alcance nominal o el de escombros según el entorno.

La sigma global seleccionada entra en \(p_{enlace}\) de cada salto y en el calor de cobertura; el presupuesto RF usa la misma sigma. La probabilidad de ruta es el producto de las probabilidades por salto:

\[
P_{ruta} = \prod_{hop} p_{hop}
\]

La confianza de canal se conserva como producto de las confidencias nominales. La energía de ruta es la suma de la energía de sus canales. La ETA suma las latencias de salto y añade 8 s de cierre. La probabilidad de entrega con tres intentos es:

\[
P_{entrega} = 1 - (1 - P_{ruta})^3
\]

**Ruta de respaldo (v0.22):** se recalcula la ruta excluyendo el primer relay de la ruta primaria. Si no existe una alternativa, el panel lo declara en lugar de inventarla.

**Corrección v0.21 conservada:** el primer salto debe usar un canal que el candidato también soporte. `sharedChannels(from, to, scenario)` lo impide. También se exige que el canal esté activo en el escenario.

Probabilidades base de canales globales: gateway 0,985; celular 0,94; SMS 0,90; satélite 0,88. Son prioridades de escenario, no medidas de operador. Para los canales locales se combina la probabilidad física con un factor logístico de planificación que decae cerca del alcance declarado.

---

## 5. Cobertura y verificación

Una activación está cubierta si se cumplen todas estas condiciones:

1. Su canal está activo en el escenario.
2. Existe al menos un activo no offline.
3. El activo declara ese canal.
4. Si el activo es la gateway, la gateway está online.
5. Si el canal no es global, la distancia de mapa convertida a metros no supera la cobertura del activo.

La distancia se escala con 10 m por unidad de mapa. La cobertura es un disco, no un modelo de relieve. El KPI de cobertura es geométrico; el calor del mapa usa probabilidad de enlace y sí depende del entorno y de la sigma. El calor solo representa canales locales no globales; SMS, satélite y celular se tratan como priors de escenario.

**Corrección v0.21:** una activación de un canal caído ya no cuenta como cubierta aunque haya un activo compatible. El KPI de cobertura usa esta función, de modo que no puede subir por una activación imposible.

**Corrección de dato:** `ACT-2416` es una cámara de tráfico DGT con enlace celular. Su canal se cambió de `CAMERA` (que no existe en la taxonomía) a `CELL`. Esto evita que el tipo se use como si fuera un canal.

---

## 6. Trilateración ponderada sintética

La consola elige los tres activos no gateway más cercanos a la posición estimada, perturba sus distancias y asigna una sigma por tipo de activo. Las estaciones tienen menor sigma que una cámara o una turbina; un activo degradado multiplica su sigma por 1,6.

Cada ecuación de círculo se linealiza:

\[
2(x_i-x_0)x + 2(y_i-y_0)y = d_0^2-d_i^2+x_i^2+y_i^2-x_0^2-y_0^2
\]

y se resuelve por mínimos cuadrados ponderados con \(w_i = 1/\sigma_i^2\). La referencia es el ancla de menor sigma; las demás ecuaciones se ponderan respecto a ella. El modelo calcula además un residual ponderado medio multiplicado por 10 para convertirlo a metros. La consola muestra el error real entre la posición estimada y la posición simulada, que es la métrica honesta de esta demo; el residual queda como control interno.

La geometría se resume con:

\[
GDOP = \sqrt{\mathrm{traza}\left((H^T H)^{-1}\right)}
\]

donde \(H\) contiene las derivadas de las distancias respecto a \(x\) e \(y\). La covarianza aproximada usa la sigma media de las anclas y se representa como una elipse al 95 % nominal:

\[
r_{95} = 2{,}4477\sqrt{\lambda}
\]

donde \(\lambda\) son los autovalores de la covarianza. El eje mayor, el menor y el ángulo se dibujan en el mapa. Es una cota nominal, no un intervalo de confianza calibrado con datos reales.

Esto demuestra el flujo de datos y la aritmética. No demuestra precisión en interiores, plantas múltiples ni escombros. Para eso hacen falta anclas con geometría conocida, calibración de sesgos y medidas reales de tiempo de vuelo o potencia.

---

## 7. Validación ejecutada y pendiente

**Ejecutado el 08-11-2026:**

- `npm run type-check`: sin errores.
- `npm run test:command`: 9/9 pruebas del modelo.
- `npm run build`: 14 páginas estáticas, incluidas `/mando`, `/es/mando/` y `/nl/mando/`.
- `npm run check:locales`: 6/6 comprobaciones, incluidas las tres superficies de mando.

**Pendiente de validación física:**

- RSSI/RSRP y tasa de error por canal en un entorno real.
- Latencia de extremo a extremo con carga y reintentos.
- Consumo energético por intento y por hora.
- Comportamiento en escombros, sótanos, multitudes y vegetación.
- Interoperabilidad real con SMS, satélite D2D y pasarelas de emergencia.
- Revisión legal y de privacidad antes de cualquier piloto.

Hasta entonces, la etiqueta correcta es `SIMULATED_VALIDATED`, no “validado en campo”.

---

## 8. Referencias técnicas

- ITU-R P.525, *Calculation of free-space attenuation* (consultar edición vigente).
- 3GPP TR 38.901, *Study on channel model for frequencies from 0.5 to 100 GHz* (consultar edición vigente).
- Semtech, *AN1200.13: LoRa Modem Design Guide* (consultar revisión vigente).
- C. E. Shannon, “A Mathematical Theory of Communication”, *Bell System Technical Journal*, 1948.
- E. W. Dijkstra, “A note on two problems in connexion with graphs”, *Numerische Mathematik*, 1959.
- OASIS, *Common Alerting Protocol v1.2*.
- IETF RFC 5050 y RFC 9171, *Bundle Protocol*.
- ETSI EN 300 220 (bandas sub-GHz) y ERC Recommendation 70-03 (consultar edición vigente).
- 3GPP TS 38.101 y TS 36.101 para límites de transmisión de usuario, si se valida con módems reales.

Las fuentes anteriores alimentan supuestos de planificación. Ninguna se presenta como calibración medida en el escenario del ejercicio.

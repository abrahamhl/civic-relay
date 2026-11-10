# SENDA · Exposición de personas y avisos adaptados a la densidad (`exposure.mjs`)

**Fecha:** 2026-11-10 · **Módulo:** [`packages/senda/src/exposure.mjs`](../../packages/senda/src/exposure.mjs) · **Tests:** [`packages/senda/tests/exposure.test.mjs`](../../packages/senda/tests/exposure.test.mjs) (9) · **Evidencia en vivo:** [`evidence/senda/exposure/`](../../evidence/senda/exposure/) (`NODE_USE_ENV_PROXY=1 node packages/senda/scripts/exposure-live-receipt.mjs`)

## 1. Qué resuelve

Un aviso vale lo que vale la gente a la que llega a tiempo. Hasta ahora SENDA retransmitía un aviso de frenada con **3 saltos fijos** y lo consideraba relevante hasta **2 km fijos**, tanto con 5 coches como con 500, y a 50 o a 120 km/h. Tampoco sabía cuánta gente había en una zona para priorizar alertas.

## 2. Datos (todos públicos y AGREGADOS)

| Dato | Fuente | Estado | Qué significa (y qué no) |
|---|---|---|---|
| Población residente 1 km² (censo 2021) | Eurostat/GISCO `grid_1km.csv`, extracto de España en `packages/senda/data/population/` | **DATO_REAL_CAPTURADO**. España suma 47,21 M en 111.170 celdas; Madrid (ES300), 6,72 M | Dónde **duerme** la gente; no es población presente de día |
| Intensidad y velocidad por estación | Digitraffic TMS (Fintraffic, CC BY 4.0) | **En vivo** (988 estaciones y sentidos el 10-11-2026) | Medida por espira |
| Intensidad y ocupación por detector | Informo Madrid (datos abiertos del Ayuntamiento) | **En vivo** (3.152 detectores válidos) | La velocidad se **estima** como v = q/k; no se mide |
| Población dinámica con teléfonos | Estudio de movilidad del Ministerio de Transportes (MITMA) e INE | **BLOQUEADO**: el servidor del MITMA rechaza el acceso automatizado desde este entorno (HTTP 403). Descarga manual pendiente | Viajes por distrito y hora: sustituiría la hipótesis de presencia diurna |

**Privacidad:** a diferencia de Waze, que muestra a otros usuarios en el mapa, **SENDA nunca muestra personas ni trayectorias individuales**. Solo maneja recuentos por celda o tramo, con umbral k-anónimo (`vehicle-link.privacyGate`, k = 5). La densidad se infiere de fuentes públicas agregadas.

## 3. Método

| Pieza | Formulación | Verificación |
|---|---|---|
| Proyección EPSG:3035 | LAEA elipsoidal (EPSG Guidance Note 7-2) | Reproduce el ejemplo oficial (50° N, 5° E → 3.962.799,45 ; 2.999.718,85) y es reversible a 1e-7° |
| Residentes en un radio | Suma de celdas con fracción de área por muestreo regular | Celda completa = 100 %; círculo pequeño ≈ πr² |
| Exposición en un tramo | Vehículos = q·L/v (relación fundamental); personas = vehículos × ocupantes (hipótesis 1,4) | Test de la relación fundamental |
| Densidad urbana | k = ocupación / L_eff (hipótesis 6,5 m) | Test |
| **Zona de peligro** | Parada (reacción + v²/2a) + avance de la cola por **onda de choque LWR** w = q/(k_jam − k) durante el horizonte | Test contra la fórmula |
| **Alcance de la cadena de radio** | Equipados = Poisson(λ = p·k). Probabilidad de alcanzar a todos (ecuación de renovación) y **fracción esperada alcanzada** ∫λc(x)dx / λD | **Contrastado con Monte Carlo** (20.000 réplicas, 4 regímenes): diferencias < 1,2 puntos |
| Saltos y retardos | Avance por salto con reenvío por el vecino más lejano: E[X \| ≥1] = (r − (1 − e^{−λr})/λ)/(1 − e^{−λr}); temporizador por distancia | Contrastado con Monte Carlo |
| Priorización | Personas afectadas esperadas = P(peligro) × exposición, con intervalo | Test |

## 4. Resultados

**En vivo (Digitraffic, 10-11-2026, madrugada local, penetración SENDA supuesta del 10 %):**
- En **401 de 988** estaciones y sentidos (41 %), la política fija de 3 saltos no cubre toda la zona de peligro.
- En la más cargada (1.718 veh/h a 82 km/h) hacen falta **6 saltos**, y la política fija cubre el **58 %**.

**Escenarios de referencia (simulación con el núcleo):**

| Tráfico | Zona de peligro | Vehículos en riesgo | Saltos recomendados | Cobertura de la política fija |
|---|---|---|---|---|
| 300 veh/h, 90 km/h | 126 m | 0,4 | 4 | 95 % |
| 1.800 veh/h, 110 km/h | 270 m | 4,4 | 8 | 45 % |
| 3.600 veh/h, 100 km/h | 388 m | 14 | 12 | 31 % |

Con tráfico denso, la cadena de radio llega en **≈ 0,26 s**, frente a los **≈ 16 s** que tarda la cadena de luces de freno hasta el último vehículo en riesgo.

## 5. Lectura honesta

- **Con poca penetración, la radio entre coches por sí sola no basta.** Con un 10 % de vehículos equipados se alcanza el 17–30 % de los equipados en la zona de peligro, porque el hueco medio entre ellos supera el alcance de Bluetooth. Lo que de verdad reduce los tiempos con poca adopción son **más alcance o pasarelas fijas**: balizas V16 vía DGT 3.0, pasarelas en el arcén o difusión celular cuando haya red. El modelo dice cuánto aporta cada una.
- La ganancia segura y medible de este módulo es **dimensionar el aviso con el tráfico real**: distancia, saltos y prioridad.
- Ocupantes por vehículo, longitud efectiva, presencia diurna y tiempos de reacción son **hipótesis declaradas**. Faltan aforos de ocupación, datos de movilidad con teléfonos y una prueba de campo.

**Confianza: 85 %.** Las matemáticas están contrastadas con soluciones exactas y Monte Carlo, y los datos son reales. El efecto en carretera depende de la penetración y del alcance reales, que aún no se han medido.

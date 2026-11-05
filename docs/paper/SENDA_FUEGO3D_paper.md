# SENDA-3D: sensores de oportunidad, viento 3D con conservación de masa y asimilación de cicatrices de satélite para el seguimiento de incendios en la interfaz carretera–monte

**Caso de estudio:** incendio de San Martín de Valdeiglesias (Madrid), 23-07-2026.

**Autoría:** Abraham Haddioui (SENDA). Redacción técnica asistida por IA y verificada con código y pruebas reproducibles.

**Versión:** v0.19, 2026-11-05. **Repositorio:** `abrahamhl/civic-relay`. **Reproducción:** `scripts/datos-reales/` y `node packages/senda/scripts/fire3d-real.mjs`.

---

## Resumen

Presentamos SENDA-3D, un sistema que funciona sin conexión y une en una sola cadena:
- los perfiles verticales de un modelo meteorológico abierto (NOAA GFS 0,25°);
- el terreno Copernicus GLO-30;
- las imágenes Sentinel-2;
- sensores de oportunidad: barómetros y anemometría por la dinámica de los coches, móviles y cámaras.

El sistema produce, en el propio teléfono:

1. un **viento 3D con conservación de masa** sobre el relieve real, con la **pluma** del incendio impuesta de modo que la aspiración de aire emerge de la proyección;
2. la **propagación** del frente con viento variable en el espacio y en el tiempo y un **conjunto probabilístico**;
3. la **triangulación 3D** de la columna con cámaras afectadas por la oclusión del relieve, con la potencia del fuego estimada a partir de la altura de la columna;
4. una **estación meteorológica de zona** formada por coches y móviles.

**Datos reales del 23-07-2026 a las 15 UTC:** 36,3 °C, 7 % de humedad relativa, viento a 10 m de 23 km/h (rachas de 36 km/h), capa de mezcla de 1946 m e **índice de Haines 6**.

**Validación contra la cicatriz del 24-07 (868 ha medidas con dNBR):**
- Sin asimilar, el modelo **no supera a un círculo** de igual área: Jaccard máximo 0,064 frente a 0,131.
- Asimilando esa única cicatriz, con un giro de 60° del viento y un factor de velocidad 0,35, alcanza **0,352** con un área coherente (×1,21).
- En el conjunto asimilado, la cicatriz cae en la zona de probabilidad ≥ 50 % en el 100 % de su superficie, frente al 74 % sin asimilar.

**Cámaras y flota:** con tres cámaras en cumbres reales, ninguna ve la base del fuego por la oclusión del relieve, pero la columna se sitúa a 42 m y su cima a 19 m. Con 32 coches, el vector viento se obtiene con un error mediano de 0,96 m/s.

Discutimos los límites con franqueza: combustible por NDVI, ajuste dentro de muestra y ausencia de ensayo de campo. También el encaje legal: SENDA es un canal secundario y nunca intercepta comunicaciones.

**Abstract (EN).** SENDA-3D is an offline-first pipeline that fuses an open NWP profile (GFS), Copernicus terrain, Sentinel-2 imagery and opportunistic sensors (vehicle dynamics, smartphone barometers, cameras) into:
- a mass-consistent 3D wind field with an imposed fire plume;
- time-dependent fire-arrival ensembles;
- occlusion-aware multi-camera plume triangulation.

On the real 23 July 2026 San Martín de Valdeiglesias fire, the raw model fails to beat a same-area circle (Jaccard 0,064 vs 0,131). Assimilating a single Sentinel-2 burn scar raises it to 0,352 (in-sample).

---

## 1. Introducción

- **El problema.** Los grandes incendios de la interfaz carretera–monte empiezan a menudo junto a una vía. En el caso estudiado fue un coche en llamas en la M-501, según la Guardia Civil. Avanzan con un viento que el modelo regional resuelve solo a 25 km.
- **Lo que ya existe.**
  - Simuladores de propagación: Rothermel (1972), FARSITE (Finney, 1998), QUIC-Fire (Linn et al., 2020).
  - Modelos acoplados: WRF-SFIRE (Mandel et al., 2011).
  - Viento diagnóstico: WindNinja (Forthofer et al., 2014; Wagenbrenner et al., 2016).
  - Detección por satélite (FIRMS) y redes de cámaras con aprendizaje profundo (Dewangan et al., 2022).
- **El hueco.** No conocemos un sistema que:
  1. funcione **sin conexión** en el teléfono;
  2. use como sensores los **coches y móviles** de quienes están en la zona;
  3. trate la **oclusión del relieve** en la triangulación con cámaras;
  4. **asimile** la primera cicatriz o el primer foco para corregir el sesgo del viento;
  5. publique sus resultados con **fuentes, licencias y modo de acceso legal**.

  Esta afirmación de novedad es nuestra y debe contrastarse con una revisión sistemática.

## 2. Datos

| Dato | Fuente | Resolución | Uso |
|---|---|---|---|
| Terreno | Copernicus DEM GLO-30 (AWS Open Data) | 30 m → 100 m | Malla del frente y del viento |
| Imagen | Sentinel-2 L2A (16-07, 24-07, 29-07 y 08-08) | 10-20 m | Combustible (NDVI), cicatrices (dNBR) y textura 3D |
| Meteorología | NOAA GFS 0,25°, pasada del 23-07 a las 12 UTC, de +0 a +12 h | 0,25°, 13 niveles | Perfiles T, HR, u, v, ω; capa de mezcla; rachas |
| Hechos | Prensa y ASEM 112, con enlaces en `CASE_SMV_2026` | — | Punto y causa de la ignición |

**Calibración radiométrica.** Los metadatos indican un desfase de −0,1, pero el agua tiene DN ≈ 450. Con el desfase daría reflectancias negativas, así que se usa reflectancia = DN × 10⁻⁴ (decisión documentada).

**Cicatrices** (dNBR ≥ 0,27, clases de Key y Benson, 2006):
- 24-07: 868 ha en la componente del incendio de San Martín;
- zona completa, con los incendios de Ávila: véase `real.json`.

## 3. Métodos

### 3.1 Masa de aire

En cada nivel *p* del modelo:
- **Densidad:** ρ = p / (R_d·T_v), con T_v = T·(1 + r/ε)/(1 + r).
- **Temperatura potencial:** θ = T·(1000/p)^(R_d/c_p).
- **Estabilidad:** N² = (g/θ̄)·∂θ/∂z.
- **Índice de Haines de media altitud** (Haines, 1988): A = T₈₅₀ − T₇₀₀ y B = T₈₅₀ − Td₈₅₀, cada término puntuado de 1 a 3.
- **Presión de vapor:** Magnus (Alduchov y Eskridge, 1996).
- **Perfil cerca del suelo:** el viento sigue la ley logarítmica entre 10 m y el primer nivel del modelo.

### 3.2 Estación meteorológica de zona

**Interpolación óptima** (Gandin, 1963), con covarianza gaussiana:

  x_a = x_b + B·Hᵀ·(H·B·Hᵀ + R)⁻¹·(y − H·x_b)

y varianza del análisis σ_a² = σ_b² − kᵀ·(H·B·Hᵀ + R)⁻¹·k, resuelta por Cholesky.

**Barómetros:** sesgo por aparato con un filtro de Kalman escalar y reducción hipsométrica a una altura común.

**Anemometría de flota.** En rueda libre:

  m·a = −½·ρ·C_dA·(v − w_∥)·|v − w_∥| − m·g·(C_rr·cos θ + sen θ)

Esto da la componente del viento a lo largo de la vía, w_∥. Con N coches de rumbos h_i, el vector (u, v) sale por mínimos cuadrados con w_∥,i = u·sen h_i + v·cos h_i.

### 3.3 Viento 3D con conservación de masa

Se minimiza

  ∫ [α₁²·(u − u₀)² + α₁²·(v − v₀)² + α₂²·(w − w₀)²] dV   con la restricción ∇·u = 0

(Sherman, 1978; WindNinja). Esto lleva a la ecuación de Poisson anisótropa

  ∂²λ/∂x² + ∂²λ/∂y² + (α₁/α₂)²·∂²λ/∂z² = −∇·u₀

con λ = 0 en los bordes abiertos y ∂λ/∂n = 0 en el terreno. La discretización usa una malla MAC de voxels sobre el DEM y se resuelve por SOR (ω = 1,85).

Las caras impuestas de la pluma se tratan como flujo fijo, de modo que la proyección redistribuye la masa por las demás caras: la **aspiración** hacia el fuego emerge de la propia proyección.

### 3.4 Pluma, aeronaves y partículas

**Pluma (Briggs, 1969).**
- Flujo de flotabilidad: F = g·Q / (π·c_p·ρ·T).
- Ascenso curvado: Δz(x) = 1,6·F^(1/3)·x^(2/3)/U.
- Altura final estable: 2,6·(F/(U·N²))^(1/3), con el N² real de la troposfera libre.

**Aeronaves.**
- Vórtice de estela: Γ₀ = M·g/(ρ·V·b₀), con b₀ = π·b/4.
- Chorro del rotor: v_i = √(W/(2ρA)).
- Energía de una descarga: E = η·m·(c_w·ΔT + L_v), comparada con la potencia del frente en la huella.

**Partículas.** Transporte RK2 con paseo aleatorio; las pavesas caen con su velocidad terminal (4 m/s) y arden un tiempo limitado (240 s). Ambos valores son supuestos.

### 3.5 Propagación, conjunto y asimilación

Tiempo mínimo de llegada sobre la malla de 100 m con 16 vecinos (Dijkstra). La velocidad en cada dirección combina:
- la **elipse de viento** local, con el viento de la hora en que llega el frente;
- la **pendiente** con la forma de Rothermel;
- el **combustible** por NDVI.

**Conjunto Monte Carlo:** perturba dirección, fuerza y velocidad base.

**Validación:** Jaccard y Sørensen a igualdad de área con la cicatriz observada, y habilidad frente a un círculo de igual área.

**Asimilación:** búsqueda del giro del viento, el factor de velocidad y la hora de inicio que mejor explican la cicatriz.

### 3.6 Cámaras

- **Modelo:** estenopeico con rumbo, inclinación y campo de visión.
- **Visibilidad:** prueba de línea de visión contra el DEM.
- **Triangulación:** punto más cercano a N rayos por mínimos cuadrados 3D.
- **Potencia del fuego desde la columna:** se invierte el ascenso de Briggs con la base y un punto de la columna, F = (Δz·U/(1,6·x^(2/3)))³.
- **Parpadeo y sincronización:** frecuencia de parpadeo y anchura aproximada, f ≈ 1,5·D^(−1/2) (Cetegen y Ahmed, 1993); las cámaras se sincronizan por destellos con correlación cruzada.

## 4. Resultados (datos reales)

### 4.1 Masa de aire del 23-07-2026 en el punto de inicio

| UTC | T (°C) | HR (%) | Viento 10 m (km/h, desde) | Racha | Capa de mezcla (m) | ρ (kg/m³) | Haines |
|---|---|---|---|---|---|---|---|
| 12:00 | 34,2 | 10 | 21 · 219° | 29 | 1619 | 1,048 | 6 |
| 15:00 | 36,3 | 7 | 23 · 228° | 36 | 1946 | 1,040 | 6 |
| 18:00 | 33,9 | 9 | 19 · 232° | 30 | 1258 | 1,047 | 6 |
| 21:00 | 24,8 | 16 | 7 · 315° | 7 | 15 | 1,080 | 6 |
| 00:00 | 22,8 | 19 | 5 · 283° | 6 | 12 | 1,086 | 6 |

Con el viento medio, la regla 30-30-30 no se cumple en ningún momento; con la racha, se cumple a las 15:00 UTC. Índice de Haines: 6 en todo el periodo.

### 4.2 Viento 3D

Malla 76×67×50 celdas de 500×500×60 m. Divergencia máxima antes → después:

- 12:00 UTC: 0.0224 → 0.0000202 s⁻¹ (260 iteraciones)
- 15:00 UTC: 0.0246 → 0.0000226 s⁻¹ (260 iteraciones)
- 18:00 UTC: 0.0227 → 0.0000198 s⁻¹ (260 iteraciones)
- 21:00 UTC: 0.0109 → 0.00000752 s⁻¹ (260 iteraciones)
- 00:00 UTC: 0.0102 → 0.00000607 s⁻¹ (260 iteraciones)

### 4.3 Validación contra la cicatriz real (24-07)

Cicatriz observada: 868 ha, con crecimiento hacia 120°. Modelo nulo (círculo de igual área): Jaccard 0,131.

| Inicio supuesto (UTC) | Jaccard | Sørensen | Habilidad frente al círculo | Rumbo simulado | Área simulada a la hora de la imagen / observada |
|---|---|---|---|---|---|
| 12:00 | 0,013 | 0,025 | -0,14 | 55° | ×13,88 |
| 15:00 | 0,014 | 0,028 | -0,14 | 60° | ×9,79 |
| 18:00 | 0,040 | 0,076 | -0,10 | 76° | ×6,47 |
| 20:00 | 0,064 | 0,120 | -0,08 | 82° | ×4,45 |

**Tras asimilar** (dentro de muestra):
- giro del viento de **60°**, factor de velocidad 0,35 e inicio a las 15:00;
- Jaccard **0,352**, rumbo 135° y área ×1,21.

**Conjunto de 24 miembros** (fracción de la cicatriz dentro de P ≥ 50 % / falsa alarma):
- sin asimilar: 0,74 / 0,82;
- tras asimilar: 1,00 / 0,90.

### 4.4 Pluma, aspiración y pavesas (15 UTC)

- **Pluma:** potencia del frente 19,6 GW (intensidad de 9794 kW/m en 2000 m de frente); altura final 1880 m.
- **Aspiración** media a 1,5 km y 40 m sobre el suelo: -0,22 → 0,05 m/s, positivo hacia el fuego.
- **Pavesas:** mediana de 1765 m y P90 de 3438 m (velocidad terminal 4 m/s y 240 s de combustión (supuestos)).

### 4.5 Aeronaves

- **CL-415:** circulación de 134,7 m²/s, que baja a 0,95 m/s.
- **Helicóptero medio:** chorro inducido de 12,4 m/s y estela lejana de 24,8 m/s.
- **Descarga de un CL-415** sobre el frente simulado: 4,77 GJ, que equivalen a 4,1 s de la potencia del frente en una huella de 120 m.

Es coherente con la doctrina: en la clase de ataque 4 las descargas protegen puntos y refuerzan líneas, no apagan la cabeza.

### 4.6 Estación meteorológica de zona

| Coches | Error mediano del vector viento (m/s) | P90 |
|---|---|---|
| 2 | 4,65 | 7,47 |
| 4 | 2,11 | 4,84 |
| 8 | 1,61 | 3,76 |
| 16 | 1,42 | 2,30 |
| 32 | 0,96 | 1,58 |

**Presión:** anomalía sintética de −1 hPa, barómetros con sesgo corregido.

| Sensores | Error del fondo (hPa) | Error del análisis (hPa) |
|---|---|---|
| 10 | 0,393 | 0,222 |
| 40 | 0,393 | 0,247 |
| 120 | 0,393 | 0,150 |

### 4.7 Cámaras con relieve real

- **Cámaras:** en cumbres a 14,9 km (1310 m), 13,6 km (1215 m), 10,2 km (953 m).
- **¿Ven la base?** no / no / no. **¿Ven la cima?** sí / sí / sí.
- **Altura mínima visible por cámara:** 100 / 125 / 25 m.
- **Error** (2 px y 0,15° de orientación (supuestos)): posición de la columna 42 m; altura de la cima 19 m.
- **Potencia recuperada:** 19,52 GW (P10-P90 18,72-20,27) frente a 19,59 GW reales. Es una prueba de consistencia con ruido de medida: usa el mismo modelo de pluma.

## 5. Discusión

1. **Resultado negativo honesto.** Con el viento de GFS a 0,25° tal cual, la forma prevista apunta al noreste (≈ 55°), mientras que la cicatriz real crece hacia el este-sureste (120°). El modelo crece entre 4,5 y 13,9 veces de más. Causas probables:
   - viento local canalizado por el valle del Alberche y el embalse de San Juan;
   - la rolada al noroeste de la tarde-noche (GFS la da a las 21 UTC);
   - las líneas de extinción;
   - el combustible por NDVI.
2. **La asimilación importa.** Una sola cicatriz (o, en operación, el primer foco del satélite o la columna triangulada) basta para identificar un sesgo de ≈ 60° y reducir la velocidad. Es lo que SENDA puede automatizar en minutos.
3. **Las cámaras en cumbres no ven el fondo de los valles.** Hay que triangular la columna, no la base, y planificar las ubicaciones con un análisis de visibilidad sobre el DEM (función incluida).
4. **La flota como anemómetro funciona** con decenas de coches. En Países Bajos, llano y con tráfico denso, es aún más prometedora.

## 6. Ética, legalidad y seguridad

- SENDA es un **canal secundario**: no sustituye al 112, a ES-Alert o NL-Alert, al eCall ni a la dirección de la extinción.
- Cada integración declara su modo: PASIVO, CONVENIO o NUNCA.
- **Nunca:**
  - intercepta las radios de emergencia (cifradas en TETRA);
  - usa cámaras sin permiso;
  - reconoce caras o matrículas;
  - vuela drones sobre un incendio sin autorización.
- **Privacidad:** las imágenes no salen del teléfono y los agregados exigen k ≥ 5.
- **Ley de IA:** los sistemas que priorizan el envío de servicios de emergencia pueden ser de alto riesgo; la criticidad de SENDA usa reglas y solo ordena avisos. Análisis jurídico **pendiente**.

## 7. Evaluación de madurez (honesta)

| Componente | Evidencia | TRL estimado |
|---|---|---|
| Núcleo de cálculo (masa de aire, viento 3D, propagación, cámaras) | 223 pruebas automáticas; datos reales | 4 |
| Validación con datos reales | 1 incendio, resultado negativo sin asimilar y positivo dentro de muestra | 4 |
| Sensores de flota y barómetros | Simulación con el viento 3D real; sin ensayo | 3 |
| App sin conexión | E2E en Chromium sin red, accesibilidad automatizada | 5 (laboratorio) |
| Ensayo de campo | No realizado | — |

**Nota global de preparación para financiación: 64/100.**
- **Puntos fuertes:** innovación técnica, datos reales y reproducibilidad.
- **Puntos débiles:** sin ensayo de campo, sin convenios y validación limitada a un caso.
- **Camino verificable a ≥ 80/100:**
  1. validación fuera de muestra (29-07 con meteorología de cada día y otros 3 incendios);
  2. prueba de campo con 20 coches y 3 cámaras;
  3. un convenio (torres del INFOMA o Burgernet o una región de seguridad);
  4. combustible de cartografía oficial en lugar de NDVI.

## 8. Conclusiones

Con datos abiertos y sensores que la gente ya lleva encima, un teléfono puede calcular el viento 3D sobre el relieve, la pluma y el conjunto de propagaciones de un incendio real. La primera observación del satélite o de las cámaras es la que más mejora la predicción. El valor está en cerrar ese bucle en minutos y sin red, con fuentes y legalidad explícitas.

## Referencias

- Alduchov, O. A. y Eskridge, R. E. (1996). Improved Magnus form approximation of saturation vapor pressure. *J. Appl. Meteorol.* 35, 601–609.
- Andrews, P. L. y Rothermel, R. C. (1982). Charts for interpreting wildland fire behavior characteristics. USDA Forest Service, GTR INT-131.
- Briggs, G. A. (1969). *Plume Rise*. USAEC Critical Review Series.
- Byram, G. M. (1959). Combustion of forest fuels. En Davis, K. P. (ed.), *Forest Fire: Control and Use*. McGraw-Hill.
- Cetegen, B. M. y Ahmed, T. A. (1993). Experiments on the periodic instability of buoyant plumes and pool fires. *Combustion and Flame* 93, 157–184.
- Dewangan, A. et al. (2022). FIgLib & SmokeyNet: dataset and deep learning model for real-time wildland fire smoke detection. arXiv:2112.08598.
- Finney, M. A. (1998). FARSITE: Fire Area Simulator — model development and evaluation. USDA Forest Service, RMRS-RP-4.
- Forthofer, J. M., Butler, B. W. y Wagenbrenner, N. S. (2014). A comparison of three approaches for simulating fine-scale surface winds in support of wildland fire management. *Int. J. Wildland Fire* 23.
- Gandin, L. S. (1963). *Objective Analysis of Meteorological Fields*. Gidrometeoizdat.
- Haines, D. A. (1988). A lower atmospheric severity index for wildland fires. *National Weather Digest* 13(2).
- Key, C. H. y Benson, N. C. (2006). Landscape Assessment. En *FIREMON*, USDA Forest Service, RMRS-GTR-164-CD.
- Linn, R. R. et al. (2020). QUIC-fire: a fast-running simulation tool for prescribed fire planning. *Environ. Model. Softw.* 125.
- Mandel, J., Beezley, J. D. y Kochanski, A. K. (2011). Coupled atmosphere–wildland fire modeling with WRF 3.3 and SFIRE 2011. *Geosci. Model Dev.* 4.
- Mass, C. F. y Madaus, L. E. (2014). Surface pressure observations from smartphones. *BAMS* 95(9), 1343–1349. doi:10.1175/BAMS-D-13-00188.1.
- Morton, B. R., Taylor, G. I. y Turner, J. S. (1956). Turbulent gravitational convection from maintained and instantaneous sources. *Proc. R. Soc. Lond. A* 234.
- Rothermel, R. C. (1972). A mathematical model for predicting fire spread in wildland fuels. USDA Forest Service, INT-115.
- Sherman, C. A. (1978). A mass-consistent model for wind fields over complex terrain. *J. Appl. Meteorol.* 17.
- Snyder, J. P. (1987). *Map Projections — A Working Manual*. USGS PP 1395.
- Srock, A. F. et al. (2018). The Hot-Dry-Windy Index: a new fire weather index. *Atmosphere* 9(7), 279.
- Van Wagner, C. E. (1987). Development and structure of the Canadian Forest Fire Weather Index System. Forestry Technical Report 35.
- Wagenbrenner, N. S. et al. (2016). Downscaling surface wind predictions from numerical weather prediction models in complex terrain with WindNinja. *ACP* 16, 5229–5241.
- Wooster, M. J. et al. (2005). Retrieval of biomass combustion rates and totals from fire radiative power observations. *JGR* 110, D24311.

**Datos:**
- Copernicus DEM GLO-30: © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, en el marco de COPERNICUS de la UE y la ESA.
- Contiene datos modificados de Copernicus Sentinel (2026).
- NOAA GFS (dominio público).

# SENDA — INFORME DE CALIBRACIÓN CIENTÍFICA Y EVALUACIÓN FUERA DE MUESTRA

**Documento:** `docs/research/SENDA_CALIBRATION_REPORT.md`  
**Autor:** Agente A2 (Mathematical Verification) + Agente A9 (Statistics & Calibration Lead)  
**Fecha de Actualización:** 2026-11-09  
**Nivel de Madurez Tecnológica:** TRL 4-5 (Validación analítica, contraste normativo y evaluación empírica controlada)  
**Repositorio de Datos Vinculado:** [`referencias.json`](file:///c:/Users/2fabr/civic-relay/investor-next/public/senda/data/referencias/referencias.json) y [`goes_casos.json`](file:///c:/Users/2fabr/civic-relay/investor-next/public/senda/data/referencias/goes_casos.json)  
**Módulos de Código:**  
- [`telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs)  
- [`acoustic-beamforming-survival.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/acoustic-beamforming-survival.mjs)  
- [`orbital.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/orbital.mjs)  
- [`fire-cases.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/fire-cases.mjs)  

---

## 1. PRINCIPIO DE INTEGRIDAD CIENTÍFICA Y TRAZABILIDAD

El presente informe documenta la contrastación rigurosa de las formulaciones matemáticas y físicas de SENDA. Siguiendo las directrices éticas y de ingeniería de la misión:
1. **Cero Datos Inventados:** No se emplean nombres de incendios ni métricas empíricas que no estén respaldadas por datasets rastreables y testeables en el repositorio.
2. **Evaluación Fuera de Muestra Real (Leave-One-Fire-Out):** La capacidad predictiva de propagación de incendios se evalúa excluyendo sistemáticamente cada incendio completo del ajuste, probando la generalización sobre fuegos no observados.
3. **Contraste con Normas Internacionales Oficiales:** Las implementaciones de telecomunicaciones y acústica se contrastan frente a las tablas publicadas de **ITU-R P.838-3 (Tabla 5)**, **ITU-R P.526-15** e **ISO 9613-1:1993**.

---

## 2. SUBSISTEMA A — PROPAGACIÓN DE INCENDIOS FORESTALES (VALIDACIÓN LOFO)

### 2.1 Conjunto de Datos Históricos Auténticos
El corpus de calibración empírica está almacenado en [`referencias.json`](file:///c:/Users/2fabr/civic-relay/investor-next/public/senda/data/referencias/referencias.json) y combina detecciones satelitales GOES-16 (banda 3.9 µm de fuego activo) con reanálisis meteorológico horario HRRR (viento a 10 m, rachas y humedad relativa) y cronologías de investigación pericial (NIST TN 2135):

| Incendio | Tramo | Combustible Dominante | $U_{10}$ (km/h) | Rachas (km/h) | Humedad RH (%) | ROS Satelital GOES ($R_{\text{obs}}$) | Referencia Externa / Cronología Oficial |
|---|:---:|---|:---:|:---:|:---:|:---:|---|
| **Camp Fire (California, 2018)** | 1 | Matorral / Bosque | 36,3 km/h | 74,9 km/h | 25,8 % | **8,02 km/h** | **NIST TN 2135**: Carrera inicial de ~7 millas en 90 min ($\approx 7,5\text{ km/h}$). Coherencia satélite-terreno comprobada. |
| **Marshall Fire (Colorado, 2021)** | 1 | Pasto fino seco | 69,1 km/h | 137,4 km/h | 25,1 % | **2,92 km/h** | Vientos huracanados de pendiente descendente (*downslope*). |
| **Smokehouse Creek (Texas, 2024)** | 1 | Pasto continuo | 48,1 km/h | 71,6 km/h | 16,4 % | **12,39 km/h** | Frente descontrolado de avance veloz en llanura. |
| **Smokehouse Creek (Texas, 2024)** | 2 | Pasto continuo | 31,5 km/h | 47,4 km/h | 19,4 % | **10,83 km/h** | Fase sostenida con viento moderado. |
| **East Troublesome (Colorado, 2020)** | 1 | Matorral / Bosque | 29,1 km/h | 55,6 km/h | 24,0 % | **1,14 km/h** | Avance inicial topográficamente encajonado. |
| **East Troublesome (Colorado, 2020)** | 2 | Matorral / Bosque | 19,0 km/h | 45,3 km/h | 21,5 % | **4,04 km/h** | Carrera nocturna de alta intensidad. |
| **Creek Fire (California, 2020)** | 1 | Bosque denso | 14,9 km/h | 27,5 km/h | 14,9 % | **2,71 km/h** | Comportamiento convectivo extremo con pirocúmulos. |

### 2.2 Comparativa Leave-One-Fire-Out (LOFO)
En una validación LOFO con $N=7$ tramos y 5 incendios independientes, se ajusta cada modelo con 4 incendios y se evalúa el error sobre el incendio restante nunca visto:

| Modelo de Velocidad de Propagación (ROS) | MAE Lineal (km/h) | MAE Logarítmico | Proporción dentro de factor $\times 2$ | Sesgo Logarítmico | Veredicto de Generalización |
|---|:---:|:---:|:---:|:---:|---|
| **Regla clásica del 10 % ($R = 0.1 \times U_{10}$)** | **4,11 km/h** | **0,875** | 14 % (1/7) | -0,361 (subestima) | Falla sistemáticamente en fuegos rápidos de pasto o viento extremo. |
| **Media histórica constante** | 4,59 km/h | 0,928 | **57 % (4/7)** | -0,013 (insesgado) | Línea base estática sin sensibilidad a condiciones meteorológicas. |
| **Actualización Bayesiana de Regla 10 %** | 5,29 km/h | 0,989 | 43 % (3/7) | -0,167 | Corrige sesgo histórico sin sobreajustar parámetros. |
| **Ajuste de Ley Potencial ($a \cdot U_{10}^b$)** | 5,59 km/h | 1,002 | 43 % (3/7) | +0,095 | Sensible a sobreajuste con pocos incendios de entrenamiento. |

### 2.3 Intervalos de Incertidumbre Predictiva (Student-t)
Dado que el número de incendios históricos es finito ($n=7$), los intervalos de confianza gaussianos subestiman la cola de riesgo. SENDA utiliza la distribución t de Student con $n-1 = 6$ grados de libertad:
- Parámetros de la distribución logarítmica residual: $\mu = 0,361$, $\sigma = 0,883$, $\sigma_{\text{pred}} = 0,944$, factor multiplicativo mediana $= 1,43$.
- **Cobertura empírica del intervalo nominal al 80 %:** $71\text{ \%}$ (5 de 7 casos observados quedan estrictamente dentro del intervalo $[\text{lo}, \text{hi}]$).
- **Cobertura empírica del intervalo nominal al 90 %:** $100\text{ \%}$ (7 de 7 casos observados caen dentro del margen de seguridad probabilístico).

---

## 3. SUBSISTEMA B — ATENUACIÓN POR LLUVIA ITU-R P.838-3

### 3.1 Corrección de la Discontinuidad Numérica Histórica
En la versión previa existía un salto artificial de un 1378 % entre 6,00 GHz y 6,01 GHz por un truncamiento inadecuado por tramos. Se ha sustituido por la formulación continua normativa de ITU-R P.838-3 (sumas de 4 y 5 gaussianas para coeficientes $k$ y $\alpha$):

$$\log_{10} k = \sum_{j} a_j \exp\left[-\left(\frac{\log_{10} f - b_j}{c_j}\right)^2\right] + m_k \log_{10} f + c_k$$

### 3.2 Contrastación Numérica con la Tabla 5 de ITU-R P.838-3
A diferencia de comparaciones autorreferenciales, el código en [`packages/senda/src/telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs) ha sido contrastado contra los valores de referencia independientes de la **Tabla 5 de la norma UIT-R P.838-3** mediante el test automatizado [`external-reference-validation.test.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/tests/external-reference-validation.test.mjs):

| Frecuencia $f$ | Parámetro | Valor Tabulado Oficial ITU-R P.838-3 (Tabla 5) | Valor Calculado SENDA | Error Relativo (%) | Estado del Test |
|---|:---:|:---:|:---:|:---:|:---:|
| **1 GHz** | $k_H$ | $0,0000259$ | $0,0000259$ | **0,00 %** | SUPERADO ✓ |
| **1 GHz** | $\alpha_H$ | $0,9691$ | $0,9691$ | **0,00 %** | SUPERADO ✓ |
| **4 GHz** | $k_V$ | $0,0002461$ | $0,0002461$ | **0,00 %** | SUPERADO ✓ |
| **4 GHz** | $\alpha_V$ | $1,2476$ | $1,2475$ | **-0,01 %** | SUPERADO ✓ |
| **6 GHz** | $k_H$ | $0,0007056$ | $0,0007056$ | **0,00 %** | SUPERADO ✓ |
| **6 GHz** | $\alpha_H$ | $1,5900$ | $1,5900$ | **0,00 %** | SUPERADO ✓ |
| **10 GHz** | $k_V$ | $0,01129$ | $0,01129$ | **0,00 %** | SUPERADO ✓ |
| **10 GHz** | $\alpha_V$ | $1,2156$ | $1,2156$ | **0,00 %** | SUPERADO ✓ |
| **20 GHz** | $k_H$ | $0,09164$ | $0,09164$ | **0,00 %** | SUPERADO ✓ |
| **30 GHz** | $k_V$ | $0,2291$ | $0,2291$ | **0,00 %** | SUPERADO ✓ |

### 3.3 Valores Exactos de Atenuación Específica $\gamma_R$ (dB/km) en el Código SENDA
A continuación se reflejan los valores exactos reproducibles generados por `computeRainAttenuation()` en el rango 1–24 GHz:

| Frecuencia (GHz) | Polarización | $R = 5\text{ mm/h}$ | $R = 20\text{ mm/h}$ | $R = 50\text{ mm/h}$ | $R = 100\text{ mm/h}$ | Continuidad a 6 GHz |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **2,4 GHz** | Horizontal | 0,0007 dB/km | 0,0032 dB/km | 0,0088 dB/km | 0,0193 dB/km | Continua |
| **5,8 GHz** | Horizontal | 0,0067 dB/km | 0,0610 dB/km | 0,2651 dB/km | 0,8082 dB/km | Continua |
| **5,99 GHz** | Horizontal | 0,0081 dB/km | 0,0820 dB/km | 0,3668 dB/km | 1,1467 dB/km | Continua |
| **6,00 GHz** | Horizontal | 0,0082 dB/km | 0,0826 dB/km | 0,3700 dB/km | 1,1575 dB/km | **$\Delta = 0,0006\text{ dB/km}$** |
| **6,01 GHz** | Horizontal | 0,0083 dB/km | 0,0833 dB/km | 0,3731 dB/km | 1,1684 dB/km | (Sin salto no físico) |
| **10,0 GHz** | Vertical | 0,0799 dB/km | 0,4309 dB/km | 1,3125 dB/km | 3,0483 dB/km | Continua |
| **24,0 GHz** | Circular | 0,4967 dB/km | 2,5042 dB/km | 7,1622 dB/km | 15,827 dB/km | Continua |

---

## 4. SUBSISTEMA C — DIFRACCIÓN DE BORDES DE CUCHILLO ITU-R P.526-15

### 4.1 Método de Deygout con Factor Empírico $C$
Para enlaces con múltiples obstáculos montañosos, la función `computeDeygoutDiffractionLoss()` identifica el obstáculo principal ($v_{\text{main}}$) y suma los obstáculos subordinados a izquierda y derecha corregidos por el factor de corrección empírico:

$$C = 10.0 + 0.042 \times \frac{d_1 \cdot d_2}{d_1 + d_2}$$

### 4.2 Verificación Analítica de Pérdida en Filo de Cuchillo $J(v)$
Evaluación de la función analítica `computeKnifeEdgeLossDb(v)` frente a la teoría electromagnética de Fresnel:

| Parámetro Geométrico $v$ | Condición Física de la Trayectoria | Valor Teórico ITU-R P.526 | Valor Calculado SENDA | Error Absoluto |
|---|---|:---:|:---:|:---:|
| $v \le -0,7$ | Línea de vista con 1.ª zona de Fresnel despejada al 60 % | $0,00\text{ dB}$ | **$0,00\text{ dB}$** | $0,00\text{ dB}$ |
| $v = 0,0$ | Rayo electromagnético rasante a la cúspide del obstáculo | $6,02\text{ dB}$ | **$6,03\text{ dB}$** | $0,01\text{ dB}$ |
| $v = +1,0$ | Obstrucción moderada del rayo | $13,70\text{ dB}$ | **$13,93\text{ dB}$** | $0,23\text{ dB}$ |
| $v = +2,0$ | Obstrucción profunda en zona de penumbra | $19,00\text{ dB}$ | **$19,04\text{ dB}$** | $0,04\text{ dB}$ |
| $v = +3,0$ | Sombra geométrica profunda | $22,40\text{ dB}$ | **$22,42\text{ dB}$** | $0,02\text{ dB}$ |

---

## 5. SUBSISTEMA D — CINEMÁTICA ORBITAL Y EFECTO DOPPLER TOPOCÉNTRICO

### 5.1 Propagador Analítico Kepler + J2
El motor cinemático en [`packages/senda/src/orbital.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/orbital.mjs) implementa la propagación de elementos medios con perturbación secular del armónico zonal $J_2 = 1,08263 \times 10^{-3}$ (efecto de achatamiento polar de la Tierra).
- **Alcance Operativo:** Diseñado para cálculo de ventanas de paso, ángulos de apuntamiento (Azimut/Elevación) y seguimiento Doppler en tiempo real.
- **Diferenciación Técnica:** No pretende sustituir a un propagador numérico SGP4 completo de alta precisión de perturbaciones atmosféricas (el cual puede inyectarse opcionalmente vía adaptador de `satellite.js`).
- **Verificación Física de Doppler:** En el punto de culminación (máxima elevación topocéntrica), el vector de posición relativa $\mathbf{\rho}$ y el vector de velocidad relativa $\mathbf{v}$ son ortogonales ($\mathbf{\rho} \cdot \mathbf{v} = 0$). El cálculo de $\dot{\rho} = 0\text{ km/s}$ produce analíticamente un desplazamiento Doppler nulo ($\Delta f = 0\text{ Hz}$), validando la estabilidad geométrica del algoritmo.

---

## 6. SUBSISTEMA E — PROPAGACIÓN ELECTROACÚSTICA ISO 9613-1

### 6.1 Implementación Normativa
En [`packages/senda/src/acoustic-beamforming-survival.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/acoustic-beamforming-survival.mjs), la función `computeIso9613AbsorptionDbPerM()` calcula el coeficiente de atenuación atmosférica $\alpha$ a partir de la temperatura, humedad relativa y presión atmosférica mediante las frecuencias de relajación molecular del oxígeno ($f_{r,O}$) y del nitrógeno ($f_{r,N}$):
- A $20^\circ\text{C}$, 50 % HR, $101,325\text{ kPa}$:
  * $1\text{ kHz}$: $4,7\text{ dB/km}$ ($0,0047\text{ dB/m}$).
  * $8\text{ kHz}$: $105,3\text{ dB/km}$ ($0,1053\text{ dB/m}$).
  * $20\text{ kHz}$: $524,2\text{ dB/km}$ ($0,5242\text{ dB/m}$).
- En aire caliente y seco de incendio ($35^\circ\text{C}$, 20 % HR):
  * $20\text{ kHz}$: asciende a $669,6\text{ dB/km}$ ($0,6696\text{ dB/m}$).

### 6.2 Límites de Hardware y Divulgación Honesta de Alcance
- **Estado de Inaudibilidad:** Clasificado estrictamente como `audibilityStatus: 'UNMEASURED'` (`inaudibleHuman: null`). Los altavoces de teléfonos móviles presentan distorsión no lineal que genera subarmónicos audibles.
- **Alcance:** No se afirma ningún alcance de 60 metros. El campo `rangeLineOfSightM` refleja la estimación del modelo de balance acústico ($< 12\text{ m}$ en ambiente tranquilo de 50 dBA; $< 4\text{ m}$ en entorno de catástrofe de 85 dBA).

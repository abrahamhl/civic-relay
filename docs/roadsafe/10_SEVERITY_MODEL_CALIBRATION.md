# RoadSafe · Calibración: modelo multivariante de gravedad sobre datos oficiales de 5 países

**Calculado por este código:** `packages/senda/src/roadsafe-severity-model.mjs`, ejecutado en `scripts/roadsafe-data/build-dataset.mjs`.
**Resultado completo:** [`evidence/roadsafe/dataset/severity-model-2024.json`](../../evidence/roadsafe/dataset/severity-model-2024.json) · informe en `DATASET_REPORT_2024.md`.

## 1. Por qué un modelo multivariante

Los OR univariantes de la iteración anterior **mezclan factores**: la noche coincide con más vía interurbana, y el arcén coincide con autopista. La regresión logística estima el efecto de cada circunstancia **manteniendo constantes las demás**, con un efecto fijo por país porque las definiciones y coberturas nacionales difieren.

- **Muestra:** 551 260 accidentes con víctimas (ES, DE, NL, FR, GB; 2024). 80 % para entrenar (440 777) y 20 % para probar (110 483), con semilla fija. 9 383 mortales.
- **Método:** IRLS (Newton) con L2 = 1 declarada para estabilidad. IC 95 % de Wald a partir de la matriz de Fisher. Converge en 9 iteraciones y tarda unos 3,5 s.
- **Verificación numérica:** con datos sintéticos de coeficientes conocidos, el ajuste los recupera con error menor de 0,1 (`tests/roadsafe-severity-model.test.mjs`).

## 2. Resultados (gravedad condicionada a que haya un accidente con víctimas)

| Circunstancia | OR ajustado [IC 95 %] | Lectura |
|---|---|---|
| Vehículo pesado implicado | **4,02** [3,70–4,36] | El factor más fuerte |
| Interurbano | **3,49** [3,23–3,77] | |
| Colisión frontal | **2,98** [2,76–3,21] | |
| Peatón implicado | **2,56** [2,36–2,78] | |
| Salida de la vía | **2,03** [1,89–2,19] | |
| **En el arcén** | **1,55** [1,13–2,13] | **Sigue siendo significativo tras ajustar** (univariante ≈2) |
| Sin alumbrado (además de la oscuridad) | **1,54** [1,41–1,69] | |
| **Madrugada 0–6 h** | **1,49** [1,37–1,62] | Efecto **propio**, aparte de la oscuridad (fatiga y alcohol son hipótesis no medidas) |
| Doble calzada | 1,20 [1,04–1,38] | |
| Oscuridad | 1,17 [1,10–1,26] | Menor que el univariante (1,5–1,7): parte del efecto era vía interurbana y madrugada |
| Curva | 1,17 [1,09–1,26] | |
| Mojado | 0,87 [0,82–0,92] | Menos graves (hipótesis: menor velocidad) |
| Autopista (frente a otras vías, ya ajustado por interurbano) | 0,70 [0,64–0,78] | |
| Alcance / cadena | 0,56 [0,50–0,62] | Frecuentes pero menos graves |
| Vehículo detenido implicado | 0,58 [0,52–0,66] | Menos grave en promedio; **el arcén eleva la gravedad** |

## 3. Validación

- **Discriminación en prueba:** AUC **0,78**; Brier 0,0159 (tasa base 1,68 %).
- **Calibración por deciles (predicho/observado):** el decil superior queda en 7,5 % frente a 7,5 %. En los deciles bajos el modelo sobreestima ligeramente (0,34 % frente a 0,18 %).
- **Dejar un país fuera** (sin su efecto fijo):

  | País fuera | AUC | Predicho | Observado |
  |---|---|---|---|
  | ES | 0,76 | 4,3 % | 1,6 % |
  | DE | 0,70 | 1,7 % | 0,9 % |
  | NL | 0,67 | 2,2 % | 2,1 % |
  | FR | 0,73 | 2,6 % | 5,9 % |
  | GB | 0,61 | 0,7 % | 1,5 % |

  **Lectura:** la **ordenación** de riesgos se transfiere entre países (AUC 0,61–0,76), pero el **nivel absoluto** no: por eso el efecto fijo del país es imprescindible.

## 4. Dónde se usa

| Componente | Uso |
|---|---|
| `roadsafe-risk-factors` | Los factores de gravedad pasan a ser **OR ajustados**: oscuridad 1,17, sin alumbrado ×1,54, madrugada 1,49, arcén 1,55. Con el modelo cargado, `severityIfCrash` da la probabilidad de desenlace mortal si hay accidente. |
| Consola (Científico) | Calculadora interactiva y tabla de OR ajustados (`/senda/data/roadsafe-severity-model-2024.json`, ~4 KB) |
| Evidencia | `EMPIRICAL_ADJUSTED_SEVERITY_MODEL` (grado A) |

## 5. Límites

- **Sin exposición:** mide gravedad condicionada, no probabilidad de accidentarse. Para frecuencia hacen falta aforos (DATEX II/NAP); es el siguiente paso.
- **No es causalidad:** factores no observados (velocidad real, cinturón, alcohol, edad) pueden confundir.
- **Codificación desigual:** «arcén» solo existe en FR y GB; «vehículo detenido» en DE, FR y GB; la clase de vía falta en DE. Las variables ausentes en un país valen 0 allí, lo que puede diluir sus efectos.
- La comparación entre países depende de las definiciones de mortal y herido de cada fuente; el efecto fijo absorbe el nivel, no las diferencias de codificación.

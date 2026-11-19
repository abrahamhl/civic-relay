# SENDA · Plan de validación física

Fecha: 2026-11-08  
Estado: plan; **no ejecutado**.  
Regla: ninguna simulación se presentará como validación física.

## 1. Niveles de madurez

| Nivel | Nombre | Qué exige | SENDA hoy |
|---|---|---|---|
| 0 | Documentado | Fuente y diseño | Cumplido |
| 1 | Verificado en unidad | Tests, análisis, límites | Cumplido parcial |
| 2 | Simulado | Modelo reproducible, incertidumbre | Cumplido para fuego y DTN |
| 3 | Hardware-in-the-loop | Radio real, tráfico sintético | No |
| 4 | Campo controlado | Nodos reales, contactos medidos | No |
| 5 | Piloto operacional | Usuarios reales, protocolo aprobado | No |
| 6 | Certificado | Auditoría y autoridad | No |

Estado actual: fuego y DTN en **LEVEL-2**; PCI en **LEVEL-0/1**; seguridad en **LEVEL-1**.

## 2. Validación DTN

### 2.1 Objetivo

Medir entrega, latencia, overhead, energía y recuperación ante fallos con radios reales y contactos programados, no con contactos declarados.

### 2.2 Montaje mínimo

- 6–10 nodos: 2 fijos, 2 portadores (peatón/vehículo), 2 relés, 2 receptores.
- Radios: WiFi 2,4/5 GHz, BLE y LoRa (o LoRaWAN) en bandas ISM.
- Registro: timestamps, RSSI/SNR, duración, bytes, reintentos, consumo (medidor USB o pinza).
- Escenarios: línea, partición, multihop, contacto intermitente, fallo de radio, batería baja.
- Carga: mensajes de 512 B, 4 KB y 64 KB; texto, imagen y JSON firmado.
- Repeticiones: al menos 30 por celda; potencia calculada para detectar +10 pp de entrega con α=0,05 y potencia 0,8.
- Semilla de aleatorización registrada; no se reutilizan contactos.

### 2.3 Métricas

- Entrega única y por copia.
- Latencia hasta primera entrega y hasta entrega completa.
- Transmisiones por entrega y bytes por entrega.
- Energía por entrega (julios medidos, no proxy).
- Tasa de fallo de contacto y tiempo de recuperación.
- Integridad: hash, firma, cuarentena.

### 2.4 Criterios de aceptación

- Entrega ≥95 % en línea y ≥80 % en partición con 4 copias.
- Latencia P50 y P95 reportadas, no solo media.
- Energía medida con incertidumbre declarada.
- Ningún mensaje aceptado con hash/firma inválidos.
- Reproducibilidad: mismo guion, mismos resultados dentro de tolerancia.

### 2.5 Criterios de aborto

- Interferencia que afecte a servicios autorizados.
- Permisos de radio incompletos.
- Condiciones meteorológicas que invaliden el ensayo.
- Cualquier riesgo para personas o servicios de emergencia.

### 2.6 Legalidad de radio

- WiFi/BLE: bandas ISM; respetar potencia y límites locales.
- LoRa: en Europa, bandas armonizadas; respetar duty cycle y ERP.
- No usar bandas de radioaficionado para tráfico cifrado sin licencia y sin cumplir sus reglas.
- Solicitar permisos y coordinar con el organismo local; no transmitir en frecuencias de emergencia.
- Seguro de responsabilidad civil y evaluación de riesgos.

## 3. Validación de incendios

No se puede validar un modelo de propagación con un incendio provocado. Opciones:

1. **Retrospectiva**: dos o más incendios históricos con perímetro oficial, hora de ignición, combustible y meteorología.
2. **Prescrito**: parcela experimental con autoridades, sensores y extinción; solo si existe permiso y protocolo de seguridad.
3. **Cámaras**: escenas reales con humo y terreno conocido; medir error de triangulación y falsas alarmas.
4. **Laboratorio**: túnel de viento/placa caliente para validar submodelos, no el frente completo.

Criterios:

- Protocolo congelado antes de ver validación.
- Reportar todos los intentos.
- Jaccard, Sorensen, error de área, rumbo y habilidad frente al círculo nulo.
- Intervalos de confianza.
- Revisión externa.

Estado: **BLOCKED** por acceso a datos oficiales y ausencia de campaña de campo.

## 4. Validación de PCI

- Emisor y receptor reales; relés hostiles.
- Pruebas: manipulación, replay, sustitución, caducidad, clave comprometida.
- Verificación fail-closed en el receptor.
- Cadena de custodia con recibos firmados.
- Auditoría externa del código y del protocolo.

Estado: **BLOCKED** hasta implementar PCI v0.2.

## 5. Seguridad y ética

- No operar en una emergencia real sin autorización.
- No interferir con comunicaciones de emergencia.
- Minimizar datos personales; consentimiento y base legal.
- Registrar y proteger datos de campo.
- Evaluar riesgos antes de cada ensayo.
- Publicar resultados negativos.

## 6. Entregables

- `evidence/dtn-field/<fecha>/` con datos crudos, hashes y análisis.
- `evidence/fire-validation/<fecha>/` con perímetros, máscaras y métricas.
- Informe de desviaciones.
- Revisión independiente.
- Actualización de `docs/research/SENDA_MATHEMATICAL_VALIDATION.md` con lo observado.

## 7. Estimación

- DTN LEVEL-3: 2–3 semanas, 6–10 radios, 2 personas.
- DTN LEVEL-4: 6–10 semanas, permisos y logística.
- Fuego retrospectivo: 4–8 semanas, acceso a datos y revisión.
- Fuego prescrito: 3–6 meses, permisos y seguridad.
- PCI: 4–6 semanas tras implementación.

Sin presupuesto, permisos y personal, estas fechas son orientativas y no comprometen resultados.

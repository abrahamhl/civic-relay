# SENDA · Backend de vehículos conectados, cámaras y fusión (v0.17)

> **Para:** fundador e IA que continúen. **Estado:** diseño y núcleo hechos y probados (`vehicle-link.mjs`, `packages/senda-vision/`). **Pendiente:** adaptadores reales por fabricante y convenios.
> **Regla:** cada dato entra con su base legal y su permiso (PASIVO, CONVENIO o NUNCA) y nada identifica a personas ni vehículos concretos.

## 1. Marco real verificado

| Pieza | Qué permite | Fuente |
|---|---|---|
| Ley de Datos de la UE (Reglamento (UE) 2023/2854), aplicable desde el 12-09-2025 | El usuario del coche puede pedir sus datos (art. 4) y ordenar que se compartan con el tercero que elija (art. 5), con compensación razonable (art. 9). Los guardianes de acceso de la DMA no pueden ser ese tercero. Acceso directo por diseño para productos comercializados desde el 12-09-2026 | [StreamLex](https://streamlex.eu/news/data-act-vehicle-data-guidance-explained/), [Autovista](https://autovista24.autovistagroup.com/news/european-data-act-empowers-users-connected-vehicles/) |
| Data for Road Safety (DFRS) | Fabricantes, autoridades y proveedores comparten **gratis y en reciprocidad** los avisos de seguridad (SRTI), también los generados por los coches; se publican en los NAP | [ERTICO](https://ertico.com/what-we-do/innovation-platforms/dfrs), [DATEX II SRTI](https://datex2.eu/user-domains/srti/) |
| SRTI (Reglamento Delegado (UE) 886/2013) | 8 categorías: firme deslizante temporal; animales, personas u obstáculos; accidente sin proteger; obras de corta duración; visibilidad reducida; conductor en sentido contrario; bloqueo no gestionado; meteorología excepcional | ídem |
| eCall de nueva generación | Por 4G/5G en los tipos nuevos desde el 01-01-2026 (Reglamento Delegado 2024/1180); centros 112 adaptados (2024/1084) | [EUR-Lex](https://eur-lex.europa.eu/eli/reg_del/2024/1180/oj) |
| Android for Cars | Solo categorías de navegación, puntos de interés, IoT, VoIP y tiempo; el acceso a los datos del vehículo está pendiente de verificar | [Android Developers](https://developer.android.com/training/cars/apps) |

## 2. Capas

```
BORDE        teléfonos · lector OBD-II · app del coche (pendiente) · cámaras (en el relé) · V16 (DGT 3.0) · ESP32 · satélite
  │
INGESTA      adaptadores con base legal: DATEX II (DGT, NDW, DFRS) · Ley de Datos (fabricante o plataforma multimarca)
             · Waze for Cities y DGT 3.0 (convenio) · visión (YOLOX + ByteTrack, imagen descartada)
  │
PRIVACIDAD   pseudónimos rotativos · k-anonimato (celda de 500 m × 5 min, k ≥ 5) · sin imágenes ni trayectorias · auditoría
  │
FUSIÓN       por tramo: velocidad (Kalman) · cola y onda de choque (LWR) · creencia en avisos (bayesiana) · posición (mínimos cuadrados)
  │
SALIDA       tramas de 24 B (BLE) · relé · DATEX II al NAP o a DFRS · CAP 1.2 al 112 · CIFS a Waze (convenio)
```

- **Despliegue:** un relé soberano por organismo (Docker), sin estado de personas. Trabajadores de visión aparte, escalables por número de cámaras.
- **Protocolos:**
  - entrada por HTTPS y MQTT, con TLS mutuo con los fabricantes;
  - formatos DATEX II, CAP y SENDA;
  - tramas firmadas y cifradas de extremo a extremo (como en el resto de SENDA).

## 3. Números del núcleo (pruebas)

| Medida | Resultado |
|---|---|
| Posición: GNSS solo frente a la fusión (vía, aerogenerador, 2 Wi-Fi con tiempo de vuelo, coche de delante por banda ultraancha) | ~9–13 m → **0,3–2,1 m** en 6 semillas; error previsto 1σ de 1,18 m |
| Velocidad de un tramo (teléfono, cámara, aforo y Waze) | 57 km/h ± 2,6; Waze pesa un 7 % porque es el dato más ruidoso |
| Privacidad | Se publica la celda con 7 fuentes; se suprime la de 2 |
| Visión, cámara a bordo (vídeo real de Udacity, MIT) | 12 vehículos seguidos en 36 s; 15 contactos por minuto de la calzada contraria; ningún falso «¡Frena!» |
| Visión, cámara fija (vídeo real de Intel, CC BY 4.0) | 1 vehículo en 30 s (aparcamiento); ≈ 119 veh/h equivalentes |

## 4. Lo que NO se hace

- Interceptar el eCall.
- Reidentificar un vehículo entre cámaras o leer matrículas.
- Usar la SIM de la V16.
- Leer Waze o Google Maps fuera de sus programas oficiales.
- Ofrecer datos de coches sin la orden del titular.

## 5. Siguientes pasos

1. Adaptador DATEX II de DFRS en el relé: leer los avisos generados por coches que ya publican los NAP.
2. Piloto con una flota: lector OBD-II y app con cámara a bordo, conteo anónimo.
3. Convenio con un fabricante o con una plataforma multimarca para la Ley de Datos.
4. Detector en el navegador (ONNX Runtime Web) para la prueba con la cámara del propio teléfono.
5. Escena 3D de la frenada en cadena con niebla, para los vídeos.

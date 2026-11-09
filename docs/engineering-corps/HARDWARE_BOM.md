# Pilotaje COTS económico · presupuesto orientativo sin precios en vivo

Comprar sólo tras comprobar modelo, compatibilidad, licencia radio local y permisos. No existen precios verificados ni se afirma ya poseer hardware.

| Componente | Prioridad | Para qué | Prueba que permite |
|---|---|---|---|
| Dos Android con Nearby Connections compatible | P0 si disponibles | Enlace físico de laboratorio | Mensaje firmado + recibo en modo sin WAN |
| Gateway Raspberry Pi o portátil existente | P0 | Almacén y router local | Buffer persistente, reinicio, métricas |
| ESP32 dev board sin radio sub-GHz externo | P1 | Telemetría local BLE/Wi-Fi | Lectura y latencia, no alcance LoRa |
| Par módulos LoRa certificados para región | P1 | Multihop con radio COTS | RSSI/SNR, tasa paquete, distancia |
| Cámara IP ONVIF propia o dashcam autorizada | P1 | Visión con consentimiento | Vídeo real -> evento con error medido |
| SDR RTL-SDR en equipo propio, recepción legal | P2 | Educación DSP espectral | Captura autorizada, no radar operativo garantizado |
| Dron propio y piloto autorizado | P3 | Comparar plan con vuelo real | Datos posición/potencia, validación controlada |

Antes de seleccionar hardware: comprobar USB/BLE chipset, SO, antena, zona radio 868/433 MHz según normas aplicables, consumo, potencia radiada, certificación CE y disponibilidad de proveedores. Priorizar reutilización del portátil y teléfonos actuales.

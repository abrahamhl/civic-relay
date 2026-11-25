# Radar de personas mmWave (RD-03D / LD2450) para SENDA

Página: `/senda/personas` · núcleo: `packages/senda/src/mmwave-radar.mjs` (7 pruebas) · escritorio PRO: pestaña «Simuladores 4D (PRO)».

## Qué hace
Un módulo de radar de 24 GHz (Ai-Thinker RD-03D o Hi-Link LD2450, mismo protocolo) entrega hasta **3 objetivos en movimiento**
con posición (x, y en mm), velocidad radial (cm/s) y resolución. SENDA lee las tramas, las limpia, sigue a cada objetivo con un
filtro de Kalman, calibra el montaje y exporta las trazas con huella SHA-256.

## Montaje mínimo (sin soldar firmware)
1. Adaptador USB-serie a 3,3 V conectado al radar: **TX del radar → RX del adaptador**, **RX del radar → TX del adaptador**, GND común.
2. Alimentación del radar: según la hoja del fabricante (**no verificada aquí**). El proyecto de referencia lo alimenta desde una LiPo de una celda.
3. Chrome o Edge de escritorio → `/senda/personas` → «Conectar radar (USB)». SENDA abre el puerto a **256000 baudios 8N1** y envía la orden multiobjetivo.

## Montaje inalámbrico (referencia)
El proyecto abierto de Sudo_solder ([Arduino-ESP32-Radarproject](https://github.com/Stevee87/Arduino-ESP32-Radarproject), MIT)
usa una XIAO ESP32-S3: radar TX → D0 (GPIO1, UART1 RX), radar RX → D1 (GPIO2, UART1 TX), y reenvía por Wi-Fi/UDP.
Si se graba el flujo de bytes, la página lo reproduce («Abrir grabación»: `.jsonl` de SENDA con tiempos o `.bin` crudo con el intervalo declarado).

## Calibración en campo
- **Distancia**: cinta métrica y marcas (p. ej. 1, 2, 3, 4 m). La persona se balancea sobre cada marca (el radar solo ve lo que se mueve);
  «Anotar» en cada una y «Ajustar» → escala, sesgo y residuo por mínimos cuadrados.
- **Ángulo de montaje**: se camina recto por una línea de rumbo conocido (un bordillo medido en el mapa). La página calcula el rumbo de la marcha
  (componentes principales de la estela) y la corrección media circular con su dispersión.

## Límites (se dicen siempre)
- Solo objetivos **en movimiento**; una persona quieta puede perderse.
- Con x, y y velocidad **no se distingue** una persona de un perro.
- Ningún móvil lleva este radar. Web Serial no existe en Safari, Firefox ni en la WebView de Android.
- Las cifras de penetración (humo, plástico) son física general de 24 GHz: **no medidas** con este equipo.
- Ruidos del filtro y puerta de asociación: **elecciones de diseño**, no medidas; se muestran y se pueden cambiar.

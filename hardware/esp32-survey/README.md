# Accesorio de barrido ESP32

Un ESP32 de ~5 € conectado por USB a un portátil o a un teléfono (OTG), atado a un mástil o a un dron:
barre **routers Wi-Fi** y **balizas BLE SENDA** y escribe JSONL que la web importa en
**Coordinar › Barrido Wi-Fi** para situar routers y personas planta a planta.

```
T 1793000000        ← hora (el ESP32 no tiene reloj)
P 4.5 12 2          ← estoy en x=4,5 m, y=12 m, planta 2 (z = 2·3 + 1,2)
S                   ← barrido Wi-Fi aquí
B 5                 ← escucha balizas 5 s
A / X               ← modo automático cada 15 s (dron) / parar
```

Salida (una lectura por línea; los mensajes empiezan por `# `):

```json
{"x":4.50,"y":12.00,"z":7.20,"bssid":"aa:bb:cc:dd:ee:01","ssid":"Casa 3B","rssi":-61,"t":1793000000,"source":"esp32"}
{"x":4.50,"y":12.00,"z":7.20,"bssid":"ble:76f202336769f0e2","ssid":"TRAPPED P3B bat 37","rssi":-74,"t":1793000004,"source":"esp32-ble"}
```

## Trama compartida

`senda_frame.h` es C++ puro (sin Arduino) y se prueba en el PC con los **mismos vectores** que la web
(`packages/senda/tests/beacon-survey.test.mjs`) y Android (`SendaFormatsTest.java`):

```
534e010325034276f202336769f0e20102e1  → TRAPPED · batería 37 · planta 3 · puerta B · id 76f202336769f0e2 · seq 258
534e0100fffe0076f202336769f0e2000022  → UNKNOWN · batería ? · planta -2 · seq 0
CRC-8 (poli 0x07) de "123456789" = 0xF4
```

```bash
g++ -std=c++17 -Wall -Wextra -Werror -I . test/host_test.cpp && ./a.out
```

El firmware también ejecuta ese autotest al arrancar (`# SENDA barrido listo · autotest de trama OK`).
CI: `.github/workflows/senda-esp32-ci.yml` (g++ + compilación para `esp32:esp32@3.0.7`, partición `huge_app`
porque Wi-Fi + Bluetooth no caben en la partición por defecto).

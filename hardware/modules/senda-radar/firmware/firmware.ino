// SPDX-License-Identifier: MIT
// SENDA Radar v1 · Firmware para Seeed Studio XIAO ESP32-S3 (FQBN: esp32:esp32:XIAO_ESP32S3)
//
// Funciones:
//  1. Puente USB-CDC transparente bidireccional (`Serial` <-> `Serial1` a 256 000 bps 8N1):
//     - Reenvía las tramas `AA FF 03 00 ... 55 CC` (30 B) del RD-03D / HLK-LD2450 sin alterar un solo byte.
//     - Reenvía las órdenes `FD FC FB FA ... 04 03 02 01` desde `/senda/personas` (Web Serial o Android USB-OTG).
//     - Cero mensajes ASCII de depuración en `Serial` para preservar compatibilidad total con la app SENDA.
//  2. Pantalla OLED I2C 128x64 SSD1306 (opcional; si no está conectada en la variante mínima, sigue funcionando):
//     - Sector ±60°, anillos de alcance cada 1 m (1..6 m), hasta 3 objetivos en movimiento con distancia y
//       velocidad radial, porcentaje de batería Li-Po 1S (divisor 2x100 kΩ en A0/GPIO1) y estado del enlace USB.

#include <Arduino.h>
#include <Wire.h>
#include "radar_core.h"
#include "ssd1306_i2c.h"

namespace {

// Pines verificados con variants/XIAO_ESP32S3/pins_arduino.h (Arduino-ESP32 3.0.7):
constexpr int PIN_RADAR_TX_TO_MCU_RX = RX;  // D7 / GPIO44 <- Pin 3 (TX 3,3 V) del RD-03D/LD2450
constexpr int PIN_MCU_TX_TO_RADAR_RX = TX;  // D6 / GPIO43 -> Pin 4 (RX 3,3 V) del RD-03D/LD2450
constexpr int PIN_OLED_SDA           = SDA; // D4 / GPIO5
constexpr int PIN_OLED_SCL           = SCL; // D5 / GPIO6
constexpr int PIN_VBAT_ADC           = A0;  // D0 / GPIO1  <- divisor resistivo 100 kΩ / 100 kΩ desde VBAT_SW

senda_radar::TransparentBridge gBridge;
senda_radar::RadarFrame        gLastFrame{};
senda_radar::Ssd1306I2c        gOled(0x3C);
uint8_t                        gGddram[senda_radar::PpiRenderer::BUFFER_BYTES]{};

uint32_t gLastPageMs  = 0;
uint32_t gLastBatMs   = 0;
uint32_t gLastFrameMs = 0;
uint16_t gBatteryMv   = 0;
bool     gDirtyPpi    = true;

uint16_t readBatteryMilliVolts() {
  // Media de 4 lecturas calibradas de eFuse en ESP32-S3; factor x2 por divisor 100 kΩ / 100 kΩ.
  uint32_t acc = 0;
  for (int i = 0; i < 4; i++) {
    acc += analogReadMilliVolts(PIN_VBAT_ADC);
  }
  const uint32_t pinMv = acc / 4u;
  return (pinMv < 400u) ? 0u : static_cast<uint16_t>(pinMv * 2u);
}

void requestMultiTargetModeOnBoot() {
  Serial1.write(senda_radar::CMD_ENABLE_CONFIG, sizeof(senda_radar::CMD_ENABLE_CONFIG));
  Serial1.flush();
  delay(20);
  Serial1.write(senda_radar::CMD_MULTI_TARGET, sizeof(senda_radar::CMD_MULTI_TARGET));
  Serial1.flush();
  delay(20);
  Serial1.write(senda_radar::CMD_END_CONFIG, sizeof(senda_radar::CMD_END_CONFIG));
  Serial1.flush();
}

} // namespace

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); // LED naranja XIAO activo en nivel bajo -> apagado en reposo

  analogReadResolution(12);

  // Buffer de recepción ampliado antes de abrir UART1 a 256 000 bps.
  Serial1.setRxBufferSize(1024);
  Serial1.begin(senda_radar::SERIAL_BAUD, SERIAL_8N1, PIN_RADAR_TX_TO_MCU_RX, PIN_MCU_TX_TO_RADAR_RX);

  // USB-CDC nativo del ESP32-S3 (ignora baudrate lógico, transmite a velocidad USB Full-Speed).
  Serial.setTxTimeoutMs(0); // Nunca bloquear si ningún host tiene el puerto serie abierto (modo autónomo con batería).
  Serial.begin(senda_radar::SERIAL_BAUD);

  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL, 400000UL);
  gOled.begin(Wire);

  gBatteryMv = readBatteryMilliVolts();
  senda_radar::PpiRenderer::render(gGddram, gLastFrame, static_cast<bool>(Serial), gBatteryMv);

  // Dejar el sensor en modo multiobjetivo desde el encendido autónomo; si luego conecta la app web/APK y envía
  // la misma secuencia FD FC FB FA, el puente transparente la reenviará íntegra sin conflicto.
  delay(80);
  requestMultiTargetModeOnBoot();
}

void loop() {
  const uint32_t now = millis();

  // 1. Drenaje prioritario Radar -> USB-CDC + decodificación local sin copia ni bloqueo
  uint8_t txBatch[64];
  size_t txLen = 0;
  const bool usbReady = static_cast<bool>(Serial);
  while (Serial1.available() > 0) {
    const uint8_t b = static_cast<uint8_t>(Serial1.read());
    senda_radar::RadarFrame decoded{};
    const bool gotFrame = gBridge.onRadarByte(
      b,
      [&](uint8_t outByte) {
        if (usbReady) {
          txBatch[txLen++] = outByte;
          if (txLen == sizeof(txBatch)) {
            Serial.write(txBatch, txLen);
            txLen = 0;
          }
        }
      },
      decoded
    );
    if (gotFrame) {
      gLastFrame = decoded;
      gLastFrameMs = now;
      gDirtyPpi = true;
      digitalWrite(LED_BUILTIN, (decoded.activeCount > 0u) ? LOW : HIGH);
    }
  }
  if (txLen > 0u && usbReady) {
    Serial.write(txBatch, txLen);
  }

  // 2. Drenaje Host USB-CDC -> Radar (órdenes FD FC FB FA ... 04 03 02 01 tal cual)
  while (Serial.available() > 0) {
    const uint8_t b = static_cast<uint8_t>(Serial.read());
    gBridge.onUsbByte(b, [](uint8_t outByte) { Serial1.write(outByte); });
  }

  // Si pasan > 800 ms sin trama del sensor, limpiar objetivos en pantalla para no congelar ecos antiguos.
  if (gLastFrame.activeCount > 0u && (now - gLastFrameMs) > 800u) {
    gLastFrame = senda_radar::RadarFrame{};
    gDirtyPpi = true;
    digitalWrite(LED_BUILTIN, HIGH);
  }

  // 3. Lectura periódica de batería (1 Hz)
  if ((now - gLastBatMs) >= 1000u) {
    gLastBatMs = now;
    gBatteryMv = readBatteryMilliVolts();
    gDirtyPpi = true;
  }

  // 4. Actualización no bloqueante de pantalla OLED (1 página = 128 B cada 8 ms -> ~15,6 fotogramas/s)
  if (gOled.isPresent() && (now - gLastPageMs) >= 8u) {
    gLastPageMs = now;
    if (gDirtyPpi) {
      senda_radar::PpiRenderer::render(gGddram, gLastFrame, usbReady, gBatteryMv);
      gDirtyPpi = false;
    }
    gOled.flushNextPage(gGddram);
  }
}

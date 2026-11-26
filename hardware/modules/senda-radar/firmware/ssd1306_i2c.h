// SPDX-License-Identifier: MIT
// Controlador I2C mínimo sin dependencias externas para pantalla OLED SSD1306 128x64 (dirección 0x3C).
// Transfiere 1 página (128 bytes) por llamada a `flushNextPage()` (~3,1 ms a 400 kHz) para no bloquear nunca
// la recepción UART a 256 000 bps del radar RD-03D / HLK-LD2450.

#ifndef SENDA_SSD1306_I2C_H
#define SENDA_SSD1306_I2C_H

#include <Arduino.h>
#include <Wire.h>
#include <stdint.h>

namespace senda_radar {

class Ssd1306I2c {
public:
  explicit Ssd1306I2c(uint8_t addr = 0x3C) : addr_(addr) {}

  bool begin(TwoWire &wire = Wire) {
    wire_ = &wire;
    wire_->beginTransmission(addr_);
    if (wire_->endTransmission() != 0) {
      present_ = false;
      return false;
    }
    static const uint8_t INIT_SEQ[] = {
      0xAE,       // Display OFF
      0xD5, 0x80, // Clock divide
      0xA8, 0x3F, // Multiplex 1/64
      0xD3, 0x00, // Display offset 0
      0x40,       // Start line 0
      0x8D, 0x14, // Charge pump ON (3.3 V internal boost)
      0x20, 0x02, // Page addressing mode
      0xA1,       // Segment remap
      0xC8,       // COM scan dec
      0xDA, 0x12, // COM pins 128x64
      0x81, 0xCF, // Contrast
      0xD9, 0xF1, // Pre-charge
      0xDB, 0x40, // VCOMH
      0xA4,       // Resume to RAM content
      0xA6,       // Normal display
      0xAF        // Display ON
    };
    for (size_t i = 0; i < sizeof(INIT_SEQ); i++) {
      if (!sendCmd(INIT_SEQ[i])) {
        present_ = false;
        return false;
      }
    }
    present_ = true;
    nextPage_ = 0;
    return true;
  }

  bool isPresent() const { return present_; }

  /** Envía una única página de 128 bytes (8 páginas completan el fotograma 128x64). */
  void flushNextPage(const uint8_t gddram[1024]) {
    if (!present_ || wire_ == nullptr) return;
    const uint8_t page = nextPage_ & 0x07u;
    nextPage_ = static_cast<uint8_t>((page + 1u) & 0x07u);

    sendCmd(static_cast<uint8_t>(0xB0u | page));
    sendCmd(0x00u); // lower column = 0
    sendCmd(0x10u); // higher column = 0

    const uint8_t *src = gddram + static_cast<size_t>(page) * 128u;
    // Bloques de 16 bytes compatibles con el buffer I2C de Wire en Arduino-ESP32 (128 B máx).
    for (size_t offset = 0; offset < 128u; offset += 16u) {
      wire_->beginTransmission(addr_);
      wire_->write(0x40u); // Co=0, D/C#=1 (datos GDDRAM)
      wire_->write(src + offset, 16u);
      if (wire_->endTransmission() != 0) {
        present_ = false;
        return;
      }
    }
  }

private:
  bool sendCmd(uint8_t cmd) {
    wire_->beginTransmission(addr_);
    wire_->write(0x00u); // Co=0, D/C#=0 (comando)
    wire_->write(cmd);
    return wire_->endTransmission() == 0;
  }

  TwoWire *wire_ = nullptr;
  uint8_t addr_ = 0x3C;
  bool present_ = false;
  uint8_t nextPage_ = 0;
};

} // namespace senda_radar

#endif // SENDA_SSD1306_I2C_H

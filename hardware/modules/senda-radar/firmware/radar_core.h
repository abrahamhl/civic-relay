// SPDX-License-Identifier: MIT
// SENDA Radar v1 · Núcleo C++17 desacoplado del hardware (compila en ESP32-S3 y en host Linux/macOS con g++).
//
// Atribución del protocolo serie (mantenida en NOTICE):
//   Basado en la especificación abierta de tramas RD-03D / HLK-LD2450 documentada en
//   Stevee87/Arduino-ESP32-Radarproject v1.1 (© 2026 Sudo_solder, licencia MIT) y contrastada con
//   packages/senda/src/mmwave-radar.mjs:
//     - UART 256000 8N1
//     - Trama de datos radar -> host: AA FF 03 00 · 3 x 8 bytes · 55 CC (30 bytes)
//     - Órdenes host -> radar:        FD FC FB FA · len(2B LE) · payload · 04 03 02 01
//     - Signo-magnitud de 16 bits:    bit 15 = 1 -> positivo (raw - 0x8000), bit 15 = 0 -> negativo (-raw)
//
// Límites físicos: hasta 3 objetivos EN MOVIMIENTO (x, y, velocidad radial). No detecta de forma fiable
// personas inmóviles ni distingue persona de perro por sí solo.

#ifndef SENDA_RADAR_CORE_H
#define SENDA_RADAR_CORE_H

#include <stdint.h>
#include <stddef.h>
#include <math.h>
#include <string.h>

namespace senda_radar {

static constexpr uint32_t SERIAL_BAUD = 256000;
static constexpr size_t FRAME_BYTES = 30;
static constexpr size_t PAYLOAD_BYTES = 24;
static constexpr size_t MAX_TARGETS = 3;

static constexpr uint8_t DATA_HDR[4]  = {0xAA, 0xFF, 0x03, 0x00};
static constexpr uint8_t DATA_TAIL[2] = {0x55, 0xCC};
static constexpr uint8_t CMD_HDR[4]   = {0xFD, 0xFC, 0xFB, 0xFA};
static constexpr uint8_t CMD_TAIL[4]  = {0x04, 0x03, 0x02, 0x01};

// Secuencia estándar para activar el seguimiento multiobjetivo (3 objetivos en movimiento).
static constexpr uint8_t CMD_ENABLE_CONFIG[14] = {
  0xFD, 0xFC, 0xFB, 0xFA, 0x04, 0x00, 0xFF, 0x00, 0x01, 0x00, 0x04, 0x03, 0x02, 0x01
};
static constexpr uint8_t CMD_MULTI_TARGET[12] = {
  0xFD, 0xFC, 0xFB, 0xFA, 0x02, 0x00, 0x90, 0x00, 0x04, 0x03, 0x02, 0x01
};
static constexpr uint8_t CMD_END_CONFIG[12] = {
  0xFD, 0xFC, 0xFB, 0xFA, 0x02, 0x00, 0xFE, 0x00, 0x04, 0x03, 0x02, 0x01
};

struct RadarTarget {
  bool active = false;
  uint8_t slot = 0;
  int16_t xMm = 0;
  int16_t yMm = 0;
  int16_t speedCms = 0;
  uint16_t resMm = 0;
};

struct RadarFrame {
  RadarTarget targets[MAX_TARGETS];
  uint8_t activeCount = 0;
};

/** Convención signo-magnitud de 16 bits idéntica a `decodeVal` en `packages/senda/src/mmwave-radar.mjs`. */
inline int16_t decodeVal(uint8_t lo, uint8_t hi) {
  const uint16_t raw = static_cast<uint16_t>(lo) | (static_cast<uint16_t>(hi) << 8);
  return (raw >= 0x8000u)
    ? static_cast<int16_t>(raw - 0x8000u)
    : static_cast<int16_t>(-static_cast<int32_t>(raw));
}

/** Inversa exacta de `decodeVal` idéntica a `encodeVal` en `packages/senda/src/mmwave-radar.mjs`. */
inline void encodeVal(int16_t v, uint8_t &lo, uint8_t &hi) {
  const uint16_t raw = (v >= 0)
    ? static_cast<uint16_t>(static_cast<uint16_t>(v) + 0x8000u)
    : static_cast<uint16_t>(-static_cast<int32_t>(v));
  lo = static_cast<uint8_t>(raw & 0xFFu);
  hi = static_cast<uint8_t>((raw >> 8) & 0xFFu);
}

/** Decodifica los 24 bytes de carga útil de una trama válida. */
inline RadarFrame decodePayload(const uint8_t *p24) {
  RadarFrame out{};
  for (uint8_t i = 0; i < MAX_TARGETS; i++) {
    const uint8_t *b = p24 + (i * 8u);
    bool allZero = true;
    for (uint8_t k = 0; k < 8u; k++) {
      if (b[k] != 0u) { allZero = false; break; }
    }
    out.targets[i].slot = i;
    if (allZero) {
      out.targets[i].active = false;
      continue;
    }
    out.targets[i].active = true;
    out.targets[i].xMm = decodeVal(b[0], b[1]);
    out.targets[i].yMm = decodeVal(b[2], b[3]);
    out.targets[i].speedCms = decodeVal(b[4], b[5]);
    out.targets[i].resMm = static_cast<uint16_t>(b[6]) | (static_cast<uint16_t>(b[7]) << 8);
    out.activeCount++;
  }
  return out;
}

/** Codifica hasta 3 objetivos en una trama de 30 bytes (`AA FF 03 00 ... 55 CC`). */
inline void encodeFrame(const RadarTarget targets[MAX_TARGETS], uint8_t out30[FRAME_BYTES]) {
  memcpy(out30, DATA_HDR, 4);
  for (size_t i = 0; i < MAX_TARGETS; i++) {
    uint8_t *slot = out30 + 4 + i * 8;
    if (!targets[i].active) {
      memset(slot, 0, 8);
      continue;
    }
    encodeVal(targets[i].xMm, slot[0], slot[1]);
    encodeVal(targets[i].yMm, slot[2], slot[3]);
    encodeVal(targets[i].speedCms, slot[4], slot[5]);
    slot[6] = static_cast<uint8_t>(targets[i].resMm & 0xFFu);
    slot[7] = static_cast<uint8_t>((targets[i].resMm >> 8) & 0xFFu);
  }
  out30[28] = DATA_TAIL[0];
  out30[29] = DATA_TAIL[1];
}

/** Lector de flujo byte a byte idéntico en máquina de estados a `createFrameParser` de `mmwave-radar.mjs`. */
class FrameParser {
public:
  bool pushByte(uint8_t c, RadarFrame &decodedOut) {
    if (!inFrame_) {
      if (c == DATA_HDR[hdrIdx_]) {
        hdrIdx_++;
        if (hdrIdx_ == 4u) {
          hdrIdx_ = 0u;
          inFrame_ = true;
          plIdx_ = 0u;
        }
      } else {
        hdrIdx_ = (c == DATA_HDR[0]) ? 1u : 0u;
      }
      return false;
    }
    buf_[plIdx_++] = c;
    if (plIdx_ == 26u) {
      inFrame_ = false;
      if (buf_[24] == DATA_TAIL[0] && buf_[25] == DATA_TAIL[1]) {
        okFrames_++;
        lastFrame_ = decodePayload(buf_);
        decodedOut = lastFrame_;
        return true;
      }
      badFrames_++;
    }
    return false;
  }

  template <typename Callback>
  void push(const uint8_t *bytes, size_t len, Callback onFrame) {
    RadarFrame f{};
    for (size_t i = 0; i < len; i++) {
      if (pushByte(bytes[i], f)) onFrame(f);
    }
  }

  uint32_t okFrames() const { return okFrames_; }
  uint32_t badFrames() const { return badFrames_; }
  const RadarFrame &lastFrame() const { return lastFrame_; }

private:
  uint8_t hdrIdx_ = 0;
  bool inFrame_ = false;
  uint8_t buf_[26]{};
  uint8_t plIdx_ = 0;
  uint32_t okFrames_ = 0;
  uint32_t badFrames_ = 0;
  RadarFrame lastFrame_{};
};

/** Inspector no intrusivo de órdenes `FD FC FB FA ... 04 03 02 01` procedentes de la app (USB-CDC). */
class CommandTap {
public:
  bool pushByte(uint8_t c) {
    if (!inCmd_) {
      if (c == CMD_HDR[hdrIdx_]) {
        hdrIdx_++;
        if (hdrIdx_ == 4u) {
          hdrIdx_ = 0u;
          inCmd_ = true;
          idx_ = 0u;
          expectedRest_ = 0u;
        }
      } else {
        hdrIdx_ = (c == CMD_HDR[0]) ? 1u : 0u;
      }
      return false;
    }
    if (idx_ >= sizeof(buf_)) {
      inCmd_ = false;
      badCmds_++;
      return false;
    }
    buf_[idx_++] = c;
    if (idx_ == 2u) {
      const uint16_t payloadLen = static_cast<uint16_t>(buf_[0]) | (static_cast<uint16_t>(buf_[1]) << 8);
      if (payloadLen == 0u || payloadLen > 32u) {
        inCmd_ = false;
        badCmds_++;
        return false;
      }
      expectedRest_ = static_cast<uint8_t>(2u + payloadLen + 4u);
    } else if (idx_ > 2u && idx_ == expectedRest_) {
      inCmd_ = false;
      const uint8_t *tail = buf_ + expectedRest_ - 4u;
      if (memcmp(tail, CMD_TAIL, 4) == 0) {
        okCmds_++;
        lastCmdWord_ = static_cast<uint16_t>(buf_[2]) | (static_cast<uint16_t>(buf_[3]) << 8);
        return true;
      }
      badCmds_++;
    }
    return false;
  }

  uint32_t okCmds() const { return okCmds_; }
  uint32_t badCmds() const { return badCmds_; }
  uint16_t lastCmdWord() const { return lastCmdWord_; }

private:
  uint8_t hdrIdx_ = 0;
  bool inCmd_ = false;
  uint8_t buf_[44]{};
  uint8_t idx_ = 0;
  uint8_t expectedRest_ = 0;
  uint32_t okCmds_ = 0;
  uint32_t badCmds_ = 0;
  uint16_t lastCmdWord_ = 0;
};

/**
 * Puente USB-CDC <-> UART transparente:
 *   - Cada byte recibido del radar se reenvía ÍNTEGRO e INMEDIATAMENTE al host USB-CDC y alimenta `FrameParser`.
 *   - Cada byte recibido por USB-CDC se reenvía ÍNTEGRO e INMEDIATAMENTE al UART del radar y alimenta `CommandTap`.
 * Nunca inserta texto de depuración en el canal USB-CDC para no alterar el flujo binario esperado por `/senda/personas`.
 */
class TransparentBridge {
public:
  template <typename EmitFn>
  bool onRadarByte(uint8_t b, EmitFn emitToUsb, RadarFrame &frameOut) {
    emitToUsb(b);
    radarBytes_++;
    return parser_.pushByte(b, frameOut);
  }

  template <typename EmitFn>
  bool onUsbByte(uint8_t b, EmitFn emitToRadar) {
    emitToRadar(b);
    usbBytes_++;
    return cmdTap_.pushByte(b);
  }

  const FrameParser &parser() const { return parser_; }
  const CommandTap &cmdTap() const { return cmdTap_; }
  uint64_t radarBytes() const { return radarBytes_; }
  uint64_t usbBytes() const { return usbBytes_; }

private:
  FrameParser parser_{};
  CommandTap cmdTap_{};
  uint64_t radarBytes_ = 0;
  uint64_t usbBytes_ = 0;
};

/** Curva lineal por tramos para celda Li-Po 1S (3,00 V = 0 %, 3,70 V = 45 %, 4,20 V = 100 %). */
inline uint8_t batteryPercentFromMv(uint16_t mv) {
  if (mv <= 3000u) return 0u;
  if (mv >= 4200u) return 100u;
  if (mv < 3700u) {
    return static_cast<uint8_t>(((static_cast<uint32_t>(mv - 3000u)) * 45u) / 700u);
  }
  return static_cast<uint8_t>(45u + ((static_cast<uint32_t>(mv - 3700u)) * 55u) / 500u);
}

/**
 * Renderizador PPI monocromo 128x64 (GDDRAM SSD1306: 8 páginas x 128 columnas = 1024 bytes).
 *   - Zona izquierda (0..75, origen del sensor en (38, 62)): sector ±60°, anillos cada 1 m hasta 6 m,
 *     y hasta 3 objetivos en movimiento con cruz + trazo de velocidad radial.
 *   - Zona derecha (78..127): estado USB, batería (o alimentación USB) y lista `1..3` con distancia (m)
 *     y velocidad radial (dm/s con signo).
 */
class PpiRenderer {
public:
  static constexpr uint8_t WIDTH = 128;
  static constexpr uint8_t HEIGHT = 64;
  static constexpr size_t BUFFER_BYTES = (WIDTH * HEIGHT) / 8; // 1024 B
  static constexpr int ORIGIN_X = 38;
  static constexpr int ORIGIN_Y = 62;
  static constexpr int PIXELS_PER_METER = 9; // 6 m -> 54 px (cabe limpio en 64 px de alto y ±60° en 76 px de ancho)
  static constexpr int MAX_RING_METERS = 6;

  static void clear(uint8_t buf[BUFFER_BYTES]) {
    memset(buf, 0, BUFFER_BYTES);
  }

  static void setPixel(uint8_t buf[BUFFER_BYTES], int x, int y, bool on = true) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const size_t idx = static_cast<size_t>(y / 8) * WIDTH + static_cast<size_t>(x);
    const uint8_t mask = static_cast<uint8_t>(1u << (y & 7));
    if (on) buf[idx] |= mask;
    else buf[idx] &= static_cast<uint8_t>(~mask);
  }

  static bool getPixel(const uint8_t buf[BUFFER_BYTES], int x, int y) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return false;
    const size_t idx = static_cast<size_t>(y / 8) * WIDTH + static_cast<size_t>(x);
    return (buf[idx] & (1u << (y & 7))) != 0u;
  }

  static void drawLine(uint8_t buf[BUFFER_BYTES], int x0, int y0, int x1, int y1) {
    int dx = (x1 > x0) ? (x1 - x0) : (x0 - x1);
    int sx = (x0 < x1) ? 1 : -1;
    int dy = -((y1 > y0) ? (y1 - y0) : (y0 - y1));
    int sy = (y0 < y1) ? 1 : -1;
    int err = dx + dy;
    for (;;) {
      setPixel(buf, x0, y0, true);
      if (x0 == x1 && y0 == y1) break;
      const int e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Proyecta (xMm, yMm) del radar al lienzo PPI; devuelve false si cae fuera del panel PPI. */
  static bool projectMmToPpi(int16_t xMm, int16_t yMm, int &px, int &py) {
    if (yMm < 0) return false;
    const float xPx = static_cast<float>(ORIGIN_X) + (static_cast<float>(xMm) * static_cast<float>(PIXELS_PER_METER)) / 1000.0f;
    const float yPx = static_cast<float>(ORIGIN_Y) - (static_cast<float>(yMm) * static_cast<float>(PIXELS_PER_METER)) / 1000.0f;
    px = static_cast<int>(lroundf(xPx));
    py = static_cast<int>(lroundf(yPx));
    return (px >= 1 && px <= 75 && py >= 1 && py <= 62);
  }

  /** Fuente matricial mínima 3x5 (propia, dominio público / MIT) para dígitos y símbolos de telemetría. */
  static void drawGlyph3x5(uint8_t buf[BUFFER_BYTES], int x, int y, char c) {
    uint16_t bits = 0; // 15 bits: fila 0 en bits 14..12, fila 4 en bits 2..0
    switch (c) {
      case '0': bits = 0b111101101101111; break;
      case '1': bits = 0b010110010010111; break;
      case '2': bits = 0b111001111100111; break;
      case '3': bits = 0b111001111001111; break;
      case '4': bits = 0b101101111001001; break;
      case '5': bits = 0b111100111001111; break;
      case '6': bits = 0b111100111101111; break;
      case '7': bits = 0b111001001010010; break;
      case '8': bits = 0b111101111101111; break;
      case '9': bits = 0b111101111001111; break;
      case '.': bits = 0b000000000000010; break;
      case ':': bits = 0b000010000010000; break;
      case '-': bits = 0b000000111000000; break;
      case '+': bits = 0b000010111010000; break;
      case '%': bits = 0b101001010100101; break;
      case 'U': bits = 0b101101101101111; break;
      case 'S': bits = 0b111100111001111; break;
      case 'B': bits = 0b110101110101110; break;
      case 'M': bits = 0b101111101101101; break;
      case 'N': bits = 0b111101101101101; break;
      case 'O': bits = 0b111101101101111; break;
      case 'V': bits = 0b101101101101010; break;
      case 'K': bits = 0b101101110101101; break;
      default:  bits = 0; break;
    }
    for (int r = 0; r < 5; r++) {
      for (int col = 0; col < 3; col++) {
        const int shift = 14 - (r * 3 + col);
        if ((bits >> shift) & 1u) setPixel(buf, x + col, y + r, true);
      }
    }
  }

  static void drawText(uint8_t buf[BUFFER_BYTES], int x, int y, const char *s) {
    int cx = x;
    for (size_t i = 0; s[i] != '\0'; i++) {
      if (s[i] != ' ') drawGlyph3x5(buf, cx, y, s[i]);
      cx += 4;
    }
  }

  /** Dibuja el PPI completo en `buf`: sector ±60°, anillos de 1 m, hasta 3 objetivos, estado USB y batería. */
  static void render(
    uint8_t buf[BUFFER_BYTES],
    const RadarFrame &frame,
    bool usbConnected,
    uint16_t batteryMv
  ) {
    clear(buf);

    // 1. Anillos de alcance de 1 m a 6 m dentro del cono ±60° (cos 60° = 0.5, sin 60° ≈ 0.866)
    for (int m = 1; m <= MAX_RING_METERS; m++) {
      const int rPx = m * PIXELS_PER_METER;
      // Paso angular de 4° entre -60° y +60°; punteado cada 8° en anillos impares para lectura limpia
      for (int deg = -60; deg <= 60; deg += ((m % 2 == 0) ? 3 : 6)) {
        const float rad = static_cast<float>(deg) * 0.0174532925f;
        const int x = ORIGIN_X + static_cast<int>(lroundf(static_cast<float>(rPx) * sinf(rad)));
        const int y = ORIGIN_Y - static_cast<int>(lroundf(static_cast<float>(rPx) * cosf(rad)));
        if (x >= 0 && x <= 76) setPixel(buf, x, y, true);
      }
    }

    // 2. Bordes del sector ±60° y eje central 0°
    const int rMax = MAX_RING_METERS * PIXELS_PER_METER;
    const int dx60 = static_cast<int>(lroundf(static_cast<float>(rMax) * 0.8660254f));
    const int dy60 = static_cast<int>(lroundf(static_cast<float>(rMax) * 0.5f));
    drawLine(buf, ORIGIN_X, ORIGIN_Y, ORIGIN_X - dx60, ORIGIN_Y - dy60);
    drawLine(buf, ORIGIN_X, ORIGIN_Y, ORIGIN_X + dx60, ORIGIN_Y - dy60);
    for (int y = ORIGIN_Y; y >= ORIGIN_Y - rMax; y -= 3) setPixel(buf, ORIGIN_X, y, true);

    // Separador vertical entre PPI (0..76) y barra de datos (79..127)
    for (int y = 0; y < HEIGHT; y += 2) setPixel(buf, 77, y, true);

    // 3. Cabecera: USB y batería
    drawText(buf, 80, 1, usbConnected ? "USB:OK" : "USB:--");
    if (batteryMv >= 2500u) {
      const uint8_t pct = batteryPercentFromMv(batteryMv);
      char btxt[8]{};
      formatUint(pct, btxt, '%');
      drawText(buf, 80, 9, btxt);
    } else {
      drawText(buf, 80, 9, "5V:USB");
    }

    // 4. Objetivos en movimiento (hasta 3): cruz en el PPI + distancia (dm) y velocidad (dm/s) en barra derecha
    uint8_t row = 0;
    for (size_t i = 0; i < MAX_TARGETS; i++) {
      const RadarTarget &t = frame.targets[i];
      if (!t.active) continue;
      int px = 0, py = 0;
      if (projectMmToPpi(t.xMm, t.yMm, px, py)) {
        // Cruz 5x5 para objetivo activo
        for (int d = -2; d <= 2; d++) {
          setPixel(buf, px + d, py, true);
          setPixel(buf, px, py + d, true);
        }
        // Vector corto de velocidad radial (hacia el sensor si speedCms < 0, alejándose si > 0)
        if (t.speedCms != 0) {
          const int vy = (t.speedCms < 0) ? 3 : -3;
          drawLine(buf, px, py, px, py + vy);
        }
      }
      // Texto compacto: "<slot+1>:<d.d>M" y debajo "<±v.v>"
      const uint32_t distDm = static_cast<uint32_t>(lroundf(
        hypotf(static_cast<float>(t.xMm), static_cast<float>(t.yMm)) / 100.0f
      ));
      const int32_t spdDms = static_cast<int32_t>(lroundf(static_cast<float>(t.speedCms) / 10.0f));
      const int yTop = 19 + static_cast<int>(row) * 15;
      char line1[12]{};
      line1[0] = static_cast<char>('1' + i);
      line1[1] = ':';
      formatFixed1(static_cast<int32_t>(distDm), false, line1 + 2, 'M');
      drawText(buf, 80, yTop, line1);

      char line2[12]{};
      formatFixed1(spdDms, true, line2, '\0');
      drawText(buf, 84, yTop + 6, line2);
      row++;
    }

    if (row == 0u) {
      drawText(buf, 80, 30, "0 MOV");
    }
  }

private:
  static void formatUint(uint8_t v, char *out, char suffix) {
    size_t p = 0;
    if (v >= 100u) { out[p++] = '1'; out[p++] = '0'; out[p++] = '0'; }
    else if (v >= 10u) { out[p++] = static_cast<char>('0' + v / 10u); out[p++] = static_cast<char>('0' + v % 10u); }
    else { out[p++] = static_cast<char>('0' + v); }
    if (suffix != '\0') out[p++] = suffix;
    out[p] = '\0';
  }

  static void formatFixed1(int32_t tenths, bool signedPrefix, char *out, char suffix) {
    size_t p = 0;
    if (tenths < 0) {
      out[p++] = '-';
      tenths = -tenths;
    } else if (signedPrefix) {
      out[p++] = '+';
    }
    const int32_t whole = tenths / 10;
    const int32_t frac = tenths % 10;
    if (whole >= 10) out[p++] = static_cast<char>('0' + (whole / 10) % 10);
    out[p++] = static_cast<char>('0' + (whole % 10));
    out[p++] = '.';
    out[p++] = static_cast<char>('0' + frac);
    if (suffix != '\0') out[p++] = suffix;
    out[p] = '\0';
  }
};

} // namespace senda_radar

#endif // SENDA_RADAR_CORE_H

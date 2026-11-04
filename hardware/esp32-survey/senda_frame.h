// SENDA · trama de baliza BLE (C++ puro, sin dependencias de Arduino: se prueba con g++ en el PC).
// Idéntica a packages/senda/src/beacon.mjs y apps/senda-android (SendaFormats.java).
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>

static const uint16_t SENDA_COMPANY_ID = 0xFFFF; // identificador de PRUEBAS del Bluetooth SIG
[[maybe_unused]] static const char *const SENDA_STATUS[] = {"UNKNOWN", "SAFE", "NEED_HELP", "TRAPPED", "AWAY", "NO_RESPONSE"};

static inline uint8_t crc8(const uint8_t *b, size_t n) {
  uint8_t c = 0;
  for (size_t i = 0; i < n; i++) { c ^= b[i]; for (int k = 0; k < 8; k++) c = (c & 0x80) ? (uint8_t)((c << 1) ^ 0x07) : (uint8_t)(c << 1); }
  return c;
}

struct SendaFrame { int status; int battery; int floor; char unit; char id[17]; uint16_t seq; };

// f: 18 bytes tras el Company ID. Devuelve false si no es SENDA, la versión no coincide o el CRC falla.
static inline bool decodeFrame(const uint8_t *f, size_t n, SendaFrame &out) {
  if (n != 18 || f[0] != 0x53 || f[1] != 0x4E || f[2] != 1 || crc8(f, 17) != f[17]) return false;
  out.status = f[3] < 6 ? f[3] : 0;
  out.battery = f[4] == 255 ? -1 : f[4];
  out.floor = f[5] == 0x80 ? -999 : (int)(int8_t)f[5];
  out.unit = (char)f[6];
  for (int i = 0; i < 8; i++) snprintf(out.id + 2 * i, 3, "%02x", f[7 + i]);
  out.seq = (uint16_t)((f[15] << 8) | f[16]);
  return true;
}

// Vectores compartidos con beacon-survey.test.mjs y SendaFormatsTest.java.
static inline bool selfTest() {
  const uint8_t v[18] = {0x53,0x4e,0x01,0x03,0x25,0x03,0x42,0x76,0xf2,0x02,0x33,0x67,0x69,0xf0,0xe2,0x01,0x02,0xe1};
  const uint8_t w[18] = {0x53,0x4e,0x01,0x00,0xff,0xfe,0x00,0x76,0xf2,0x02,0x33,0x67,0x69,0xf0,0xe2,0x00,0x00,0x22};
  SendaFrame f, g;
  uint8_t bad[18]; memcpy(bad, v, 18); bad[4] = 99;
  return crc8((const uint8_t *)"123456789", 9) == 0xF4
      && decodeFrame(v, 18, f) && f.status == 3 && f.battery == 37 && f.floor == 3 && f.unit == 'B' && strcmp(f.id, "76f202336769f0e2") == 0 && f.seq == 258
      && decodeFrame(w, 18, g) && g.status == 0 && g.battery == -1 && g.floor == -2 && g.unit == 0 && g.seq == 0
      && !decodeFrame(bad, 18, f);
}

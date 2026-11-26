// SPDX-License-Identifier: MIT
// Prueba en host (g++ -std=c++17 -Wall -Wextra -Werror) de `radar_core.h` con las MISMAS tramas y casos
// de `packages/senda/tests/mmwave-radar.test.mjs`, más verificación del puente transparente y modo `--smoke-stream`
// para inyectar tramas reales emitidas por el puente C++ hacia la «Práctica de campo» de `/senda/personas`.

#include "../radar_core.h"
#include <stdio.h>
#include <string.h>
#include <vector>

using namespace senda_radar;

#define ASSERT_TRUE(cond, msg) \
  do { \
    if (!(cond)) { \
      fprintf(stderr, "FAIL [%s:%d]: %s\n", __FILE__, __LINE__, msg); \
      return 1; \
    } \
  } while (0)

static int runUnitTests() {
  // 1. Convención de signo idéntica a mmwave-radar.test.mjs líneas 5-10
  ASSERT_TRUE(decodeVal(0x0E, 0x83) == 0x030E, "0x830E -> +782 mm");
  ASSERT_TRUE(decodeVal(0x0E, 0x03) == -0x030E, "0x030E -> -782 mm");
  const int16_t samples[] = {-8000, -1, 0, 1, 1234, 8000};
  for (int16_t v : samples) {
    uint8_t lo = 0, hi = 0;
    encodeVal(v, lo, hi);
    ASSERT_TRUE(decodeVal(lo, hi) == v, "ida y vuelta encodeVal/decodeVal");
  }
  ASSERT_TRUE(CMD_MULTI_TARGET[6] == 0x90 && sizeof(CMD_ENABLE_CONFIG) == 14, "constantes CMD");

  // 2. Lector de flujo en trozos de 7 B con basura delante y trama corrupta descartada (mmwave-radar.test.mjs líneas 12-21)
  RadarTarget goodTargets[3]{};
  goodTargets[0] = {true, 0, -500, 2000, -30, 360};
  goodTargets[1] = {false, 1, 0, 0, 0, 0};
  goodTargets[2] = {true, 2, 1200, 3500, 15, 360};
  uint8_t good[FRAME_BYTES]{};
  encodeFrame(goodTargets, good);

  RadarTarget badTargets[3]{};
  badTargets[0] = {true, 0, 1, 2, 3, 0};
  uint8_t bad[FRAME_BYTES]{};
  encodeFrame(badTargets, bad);
  bad[29] = 0x00; // cierre roto

  std::vector<uint8_t> stream = {0x13, 0xAA, 0x00};
  stream.insert(stream.end(), good, good + FRAME_BYTES);
  stream.insert(stream.end(), bad, bad + FRAME_BYTES);
  stream.insert(stream.end(), good, good + FRAME_BYTES);

  FrameParser parser;
  std::vector<RadarFrame> parsed;
  for (size_t i = 0; i < stream.size(); i += 7) {
    const size_t chunk = (i + 7 <= stream.size()) ? 7 : (stream.size() - i);
    parser.push(stream.data() + i, chunk, [&](const RadarFrame &f) { parsed.push_back(f); });
  }
  ASSERT_TRUE(parsed.size() == 2, "2 tramas válidas reconstruidas");
  ASSERT_TRUE(parser.okFrames() == 2 && parser.badFrames() == 1, "estadísticas ok=2, bad=1");
  ASSERT_TRUE(parsed[0].activeCount == 2, "2 objetivos activos en la trama");
  ASSERT_TRUE(parsed[0].targets[0].active && parsed[0].targets[0].xMm == -500 && parsed[0].targets[0].yMm == 2000 &&
              parsed[0].targets[0].speedCms == -30 && parsed[0].targets[0].resMm == 360, "slot 0 idéntico a JS");
  ASSERT_TRUE(!parsed[0].targets[1].active, "slot 1 vacío");
  ASSERT_TRUE(parsed[0].targets[2].active && parsed[0].targets[2].xMm == 1200 && parsed[0].targets[2].yMm == 3500 &&
              parsed[0].targets[2].speedCms == 15 && parsed[0].targets[2].resMm == 360, "slot 2 idéntico a JS");

  // 3. Puente transparente bidireccional: 100 % identidad byte a byte Radar->USB y USB->Radar
  TransparentBridge bridge;
  std::vector<uint8_t> usbOut;
  int framesFromBridge = 0;
  for (uint8_t b : stream) {
    RadarFrame f{};
    if (bridge.onRadarByte(b, [&](uint8_t out) { usbOut.push_back(out); }, f)) {
      framesFromBridge++;
    }
  }
  ASSERT_TRUE(usbOut == stream, "puente Radar->USB preserva cada byte sin mutación");
  ASSERT_TRUE(framesFromBridge == 2, "puente decodifica en paralelo 2 tramas válidas");

  std::vector<uint8_t> hostCmds;
  hostCmds.insert(hostCmds.end(), CMD_ENABLE_CONFIG, CMD_ENABLE_CONFIG + sizeof(CMD_ENABLE_CONFIG));
  hostCmds.insert(hostCmds.end(), CMD_MULTI_TARGET, CMD_MULTI_TARGET + sizeof(CMD_MULTI_TARGET));
  hostCmds.insert(hostCmds.end(), CMD_END_CONFIG, CMD_END_CONFIG + sizeof(CMD_END_CONFIG));

  std::vector<uint8_t> radarUartOut;
  int validCmds = 0;
  for (uint8_t b : hostCmds) {
    if (bridge.onUsbByte(b, [&](uint8_t out) { radarUartOut.push_back(out); })) {
      validCmds++;
    }
  }
  ASSERT_TRUE(radarUartOut == hostCmds, "puente USB->Radar reenvía órdenes FD FC FB FA bit a bit");
  ASSERT_TRUE(validCmds == 3 && bridge.cmdTap().okCmds() == 3 && bridge.cmdTap().lastCmdWord() == 0x00FE,
              "3 órdenes del host reconocidas (ENABLE_CONFIG, MULTI_TARGET, END_CONFIG)");

  // 4. Pantalla PPI 128x64: anillos, objetivo proyectado, estado USB y curva de batería
  ASSERT_TRUE(batteryPercentFromMv(2950) == 0 && batteryPercentFromMv(3700) == 45 && batteryPercentFromMv(4200) == 100,
              "curva de batería Li-Po 1S");
  uint8_t gddram[PpiRenderer::BUFFER_BYTES]{};
  PpiRenderer::render(gddram, parsed[0], true, 3950);
  int px = 0, py = 0;
  ASSERT_TRUE(PpiRenderer::projectMmToPpi(-500, 2000, px, py), "proyección dentro del PPI");
  ASSERT_TRUE(PpiRenderer::getPixel(gddram, px, py), "cruz del objetivo 1 encendida en GDDRAM");
  ASSERT_TRUE(PpiRenderer::getPixel(gddram, PpiRenderer::ORIGIN_X, PpiRenderer::ORIGIN_Y - 2 * PpiRenderer::PIXELS_PER_METER),
              "anillo de 2 m encendido en el eje 0°");

  printf("PASS: SENDA Radar v1 C++17 core verificado (signo, flujo 7B, puente transparente bidireccional y PPI 128x64)\n");
  return 0;
}

/**
 * Emite por stdout una secuencia determinista de 40 tramas (4,0 s a 10 Hz) atravesando `TransparentBridge`,
 * tras procesar las 3 órdenes `FD FC FB FA` de la app. Sirve para demostrar de extremo a extremo el puente C++
 * con `/senda/personas` y `packages/senda/scripts/mmwave-field-report.mjs`.
 */
static int runSmokeStream() {
  TransparentBridge bridge;
  std::vector<uint8_t> uartSink;
  for (uint8_t b : CMD_ENABLE_CONFIG) bridge.onUsbByte(b, [&](uint8_t o) { uartSink.push_back(o); });
  for (uint8_t b : CMD_MULTI_TARGET)  bridge.onUsbByte(b, [&](uint8_t o) { uartSink.push_back(o); });
  for (uint8_t b : CMD_END_CONFIG)    bridge.onUsbByte(b, [&](uint8_t o) { uartSink.push_back(o); });
  if (bridge.cmdTap().okCmds() != 3) return 2;

  for (int k = 0; k < 40; k++) {
    // Dos objetivos en movimiento que se cruzan entre t = 0 s y t = 3,9 s (SIMULACIÓN sintética para prueba de humo)
    RadarTarget t[3]{};
    t[0] = {true, 0, static_cast<int16_t>(-1200 + k * 60), static_cast<int16_t>(2200 + k * 15), -65, 360};
    t[1] = {true, 1, static_cast<int16_t>(1200 - k * 60),  static_cast<int16_t>(2800 - k * 10),  55, 360};
    t[2] = {false, 2, 0, 0, 0, 0};
    uint8_t raw[FRAME_BYTES]{};
    encodeFrame(t, raw);

    std::vector<uint8_t> usbTx;
    RadarFrame decoded{};
    for (size_t i = 0; i < FRAME_BYTES; i++) {
      bridge.onRadarByte(raw[i], [&](uint8_t out) { usbTx.push_back(out); }, decoded);
    }
    // Emitir línea hexadecimal `<tMs> <hex>` para el arnés de humo
    printf("%d ", k * 100);
    for (uint8_t b : usbTx) printf("%02x", b);
    printf("\n");
  }
  return 0;
}

int main(int argc, char **argv) {
  if (argc > 1 && strcmp(argv[1], "--smoke-stream") == 0) {
    return runSmokeStream();
  }
  return runUnitTests();
}

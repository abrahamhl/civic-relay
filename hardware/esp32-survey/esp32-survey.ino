/*
 * SENDA · Accesorio de barrido ESP32 (rescatador, vecino o dron).
 * Barre routers Wi-Fi y balizas BLE SENDA y escribe por USB-serie líneas JSONL que la web
 * (Coordinar › Barrido Wi-Fi) importa y trilatera planta a planta.
 *
 * Órdenes por serie (115200 baudios, una por línea):
 *   T <epoch_s>         fija la hora (el ESP32 no tiene reloj): la da el teléfono/portátil
 *   P <x> <y> <planta>  posición actual en metros desde la esquina SO; z = planta*3 + 1,2
 *   S                   barrido Wi-Fi aquí
 *   B <segundos>        escucha balizas SENDA aquí (por defecto 5 s)
 *   A                   modo automático: S + B cada 15 s (para un dron o un mástil)
 *   X                   parar el modo automático
 * Las líneas que no son datos empiezan por «# ».
 *
 * Trama de baliza: idéntica a packages/senda/src/beacon.mjs y apps/senda-android (SendaFormats).
 * Company ID 0xFFFF = identificador de PRUEBAS del Bluetooth SIG (cambiar en despliegue real).
 */
#include <WiFi.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include "senda_frame.h"

static double px = 0, py = 0, pz = 1.2;
static uint32_t epochBase = 0, epochAtMillis = 0;
static bool autoMode = false;
static uint32_t lastAuto = 0;

static uint32_t nowS() { return epochBase + (millis() - epochAtMillis) / 1000; }

static void printJsonString(const String &s) {
  Serial.print('"');
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '"' || c == '\\') { Serial.print('\\'); Serial.print(c); }
    else if ((uint8_t)c < 0x20) Serial.printf("\\u%04x", (uint8_t)c);
    else Serial.print(c);
  }
  Serial.print('"');
}

static void printRow(const String &bssid, const String &ssid, int rssi, const char *source) {
  Serial.printf("{\"x\":%.2f,\"y\":%.2f,\"z\":%.2f,\"bssid\":", px, py, pz);
  printJsonString(bssid);
  Serial.print(",\"ssid\":");
  if (ssid.length()) printJsonString(ssid); else Serial.print("null");
  Serial.printf(",\"rssi\":%d,\"t\":%lu,\"source\":\"%s\"}\n", rssi, (unsigned long)nowS(), source);
}

static void wifiScan() {
  int n = WiFi.scanNetworks(false, true);
  for (int i = 0; i < n; i++) { String b = WiFi.BSSIDstr(i); b.toLowerCase(); printRow(b, WiFi.SSID(i), WiFi.RSSI(i), "esp32"); }
  Serial.printf("# %d routers en (%.2f, %.2f, z %.2f)\n", n < 0 ? 0 : n, px, py, pz);
  WiFi.scanDelete();
}

class SendaScan : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice d) override {
    if (!d.haveManufacturerData()) return;
    auto md = d.getManufacturerData();           // std::string (core 2.x) o String (core 3.x)
    const uint8_t *p = (const uint8_t *)md.c_str();
    size_t n = md.length();
    if (n != 20 || (uint16_t)(p[0] | (p[1] << 8)) != SENDA_COMPANY_ID) return; // Company ID en little-endian
    SendaFrame f;
    if (!decodeFrame(p + 2, n - 2, f)) return;
    String label = String(SENDA_STATUS[f.status]);
    if (f.floor != -999) label += " P" + String(f.floor);
    if (f.unit) label += String(f.unit);
    if (f.battery >= 0) label += " bat " + String(f.battery);
    printRow(String("ble:") + f.id, label, d.getRSSI(), "esp32-ble");
  }
};

static BLEScan *scanner = nullptr;
static void bleListen(uint32_t seconds) {
  scanner->start(seconds, false);
  scanner->clearResults();
  Serial.printf("# escucha BLE %lu s terminada\n", (unsigned long)seconds);
}


void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  BLEDevice::init("");
  scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(new SendaScan(), true);
  scanner->setActiveScan(false);
  scanner->setInterval(100);
  scanner->setWindow(99);
  Serial.println(selfTest() ? "# SENDA barrido listo · autotest de trama OK" : "# ERROR autotest de trama: no usar");
  Serial.println("# Ordenes: T <epoch> | P <x> <y> <planta> | S | B <s> | A | X");
}

void loop() {
  if (Serial.available()) {
    String l = Serial.readStringUntil('\n'); l.trim();
    if (l.startsWith("T ")) { epochBase = (uint32_t)strtoul(l.c_str() + 2, nullptr, 10); epochAtMillis = millis(); Serial.println("# hora fijada"); }
    else if (l.startsWith("P ")) { double x, y; int fl; if (sscanf(l.c_str() + 2, "%lf %lf %d", &x, &y, &fl) == 3) { px = x; py = y; pz = fl * 3.0 + 1.2; Serial.printf("# posicion (%.2f, %.2f) planta %d\n", px, py, fl); } else Serial.println("# uso: P <x> <y> <planta>"); }
    else if (l == "S") wifiScan();
    else if (l.startsWith("B")) { uint32_t s = l.length() > 2 ? strtoul(l.c_str() + 2, nullptr, 10) : 5; bleListen(s ? s : 5); }
    else if (l == "A") { autoMode = true; Serial.println("# modo automatico"); }
    else if (l == "X") { autoMode = false; Serial.println("# modo automatico parado"); }
  }
  if (autoMode && millis() - lastAuto > 15000) { lastAuto = millis(); wifiScan(); bleListen(5); }
}

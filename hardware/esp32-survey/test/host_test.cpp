// g++ -std=c++17 -I.. host_test.cpp && ./a.out  — prueba en el PC la misma lógica que corre en el ESP32.
#include "senda_frame.h"
int main() {
  if (!selfTest()) { puts("FAIL: trama SENDA (C++) no coincide con web/Android"); return 1; }
  puts("PASS: trama SENDA en C++ idéntica a web y Android (3 vectores + CRC)");
  return 0;
}

// SPDX-License-Identifier: MIT
// SENDA Nodo Malla EU868 · Carcasa paramétrica intemperie (OpenSCAD)
// Aloja: Heltec Wireless Stick Lite V3 (ESP32-S3 + SX1262 868 MHz, 58x23 mm) + Li-Po PKCELL 1200 mAh (65x36x5,3 mm)
// + interruptor SS22G08 + pasamuros superior para conector SMA/IPEX de antena 868 MHz + orejetas de mástil/mochila.

part = "assembly"; // "lid" | "base" | "assembly"
ext_w = 50.0;
ext_h = 88.0;
base_d = 16.5;
lid_d  = 7.5;
wall_mm = 2.4;
corner_r = 4.5;
fit_clr = 0.25;
$fn = 40;

module rrect(w, h, r) {
  offset(r = r) square([w - 2 * r, h - 2 * r], center = true);
}
module rbox(w, h, d, r) {
  linear_extrude(height = d) rrect(w, h, r);
}

module base() {
  iw = ext_w - 2 * wall_mm;
  ih = ext_h - 2 * wall_mm;
  difference() {
    union() {
      rbox(ext_w, ext_h, base_d, corner_r);
      // 2 orejetas superiores/inferiores con ranura para brida de mástil o cinta MOLLE (imprimibles planas en Z=0)
      for (sy = [-1, 1]) {
        translate([0, sy * (ext_h / 2 + 4.5), 0])
          linear_extrude(height = 4.2)
            rrect(28.0, 12.0, 3.0);
      }
    }
    // Ranuras pasantes en las orejetas de sujeción
    for (sy = [-1, 1]) {
      translate([0, sy * (ext_h / 2 + 5.2), -0.1])
        linear_extrude(height = 5.0)
          rrect(18.0, 4.2, 1.5);
    }
    // Vaciado interior
    translate([0, 0, wall_mm])
      rbox(iw, ih, base_d, corner_r - wall_mm);
    // Cajera perimetral superior para el labio de la tapa
    translate([0, 0, base_d - 2.2])
      rbox(iw + 0.2, ih + 0.2, 2.5, corner_r - wall_mm);
    // Taladro superior (pared +Y) Ø 6,6 mm para conector SMA/antena 868 MHz
    translate([0, ext_h / 2 + 1.0, base_d - 6.5])
      rotate([90, 0, 0])
        cylinder(d = 6.6, h = wall_mm + 3.0);
    // Ventana USB-C en pared derecha (+X) para Heltec WSL V3
    translate([ext_w / 2 - wall_mm - 0.8, -14.0, base_d - 5.8])
      rotate([0, 90, 0])
        hull() {
          translate([0, -2.9, 0]) cylinder(d = 3.8, h = wall_mm + 2.5);
          translate([0,  2.9, 0]) cylinder(d = 3.8, h = wall_mm + 2.5);
        }
    // Hueco interruptor SS22G08 en pared izquierda (-X)
    translate([-(ext_w / 2 + 0.5), 10.0, base_d - 7.8])
      cube([wall_mm + 2.0, 7.4, 3.8]);
  }
  // 4 columnas esquinadas para insertos M2.5 x 5,0 mm (D = 3,9 mm)
  for (sx = [-1, 1], sy = [-1, 1]) {
    bx = sx * (ext_w / 2 - 5.2);
    by = sy * (ext_h / 2 - 5.2);
    difference() {
      hull() {
        translate([bx, by, wall_mm - 0.3]) cylinder(d = 6.8, h = base_d - wall_mm - 1.9);
        translate([sx * (iw / 2 - 1.0), sy * (ih / 2 - 1.0), wall_mm - 0.3]) cylinder(d = 3.0, h = base_d - wall_mm - 1.9);
      }
      translate([bx, by, base_d - 2.2 - 5.4]) cylinder(d = 3.9, h = 6.0);
    }
  }
  // Cuna central para placa Heltec Wireless Stick Lite V3 (58,0 x 23,0 mm) sobre la batería
  for (sx = [-1, 1]) {
    translate([sx * 12.6 - 0.9, -29.0, wall_mm - 0.3])
      cube([1.8, 58.0, 6.6]);
  }
}

module lid() {
  iw = ext_w - 2 * wall_mm;
  ih = ext_h - 2 * wall_mm;
  difference() {
    union() {
      rbox(ext_w, ext_h, lid_d, corner_r);
      translate([0, 0, lid_d - 0.5])
        rbox(iw - 2 * fit_clr, ih - 2 * fit_clr, 2.4, corner_r - wall_mm);
    }
    translate([0, 0, wall_mm])
      rbox(iw - 2 * fit_clr - 2.4, ih - 2 * fit_clr - 2.4, lid_d + 3.0, max(1.0, corner_r - wall_mm - 1.2));
    // Ventana estrecha traslúcida/mirilla LED de estado TX/RX LoRa
    translate([-12.0, 22.0, -0.1])
      cylinder(d = 3.2, h = wall_mm + 0.5);
    // 4 taladros avellanados M2.5
    for (sx = [-1, 1], sy = [-1, 1]) {
      bx = sx * (ext_w / 2 - 5.2);
      by = sy * (ext_h / 2 - 5.2);
      translate([bx, by, -0.1]) cylinder(d = 5.2, h = 2.0);
      translate([bx, by, -0.1]) cylinder(d = 2.8, h = lid_d + 3.5);
    }
  }
}

if (part == "base") {
  base();
} else if (part == "lid") {
  lid();
} else {
  base();
  translate([0, 0, base_d + lid_d]) rotate([0, 180, 0]) lid();
}

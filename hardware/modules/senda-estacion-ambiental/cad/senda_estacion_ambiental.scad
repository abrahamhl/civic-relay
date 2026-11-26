// SPDX-License-Identifier: MIT
// SENDA Estación Hidrometeo y Humo · Garita ventilada de dos cámaras (OpenSCAD)
// Cámara inferior ventilada con lamas antilluvia a 45°: Sensirion SPS30 (41x41x12 mm) + Bosch BME280 (15x12 mm).
// Cámara superior estanca a salpicaduras: Seeed XIAO ESP32-S3 + placa JSN-SR04T + pasamuros inferior hacia sonda ultrasónica.

part = "assembly"; // "front_louvers" | "rear_housing" | "assembly"
ext_w = 84.0;
ext_h = 96.0;
rear_d = 28.0;
front_d = 14.0;
wall_mm = 2.4;
corner_r = 5.0;
fit_clr = 0.25;
$fn = 40;

module rrect(w, h, r) {
  offset(r = r) square([w - 2 * r, h - 2 * r], center = true);
}
module rbox(w, h, d, r) {
  linear_extrude(height = d) rrect(w, h, r);
}

module rear_housing() {
  iw = ext_w - 2 * wall_mm;
  ih = ext_h - 2 * wall_mm;
  difference() {
    union() {
      rbox(ext_w, ext_h, rear_d, corner_r);
      // 2 alas laterales traseras con taladros Ø 4,5 mm para anclaje a barandilla de puente o poste (coplanares Z=0)
      for (sx = [-1, 1]) {
        translate([sx * (ext_w / 2 + 5.0), 0, 0])
          linear_extrude(height = 4.5)
            rrect(14.0, 52.0, 3.0);
      }
    }
    for (sx = [-1, 1], sy = [-1, 1]) {
      translate([sx * (ext_w / 2 + 5.5), sy * 17.0, -0.1])
        cylinder(d = 4.5, h = 6.0);
    }
    translate([0, 0, wall_mm])
      rbox(iw, ih, rear_d, corner_r - wall_mm);
    translate([0, 0, rear_d - 2.4])
      rbox(iw + 0.2, ih + 0.2, 2.8, corner_r - wall_mm);
    // Pasamuros inferior (-Y) Ø 8,5 mm para cable coaxial estanco de la sonda ultrasónica JSN-SR04T
    translate([-16.0, -(ext_h / 2 + 1.0), rear_d / 2])
      rotate([-90, 0, 0])
        cylinder(d = 8.5, h = wall_mm + 3.0);
    // Ventana inferior protegida para USB-C de alimentación / lectura local
    translate([18.0, -(ext_h / 2 + 1.0), rear_d - 7.0])
      rotate([-90, 0, 0])
        hull() {
          translate([-2.9, 0, 0]) cylinder(d = 3.8, h = wall_mm + 3.0);
          translate([ 2.9, 0, 0]) cylinder(d = 3.8, h = wall_mm + 3.0);
        }
  }
  // Tabique horizontal interior (Y = +8 mm) que aísla el calor de la MCU superior respecto al BME280/SPS30 inferiores
  difference() {
    translate([-iw / 2, 8.0, wall_mm - 0.3])
      cube([iw, 2.4, rear_d - wall_mm - 2.4]);
    // Pasacables estrecho de interconexión I2C/UART
    translate([18.0, 7.5, rear_d - 9.0])
      cube([10.0, 4.0, 6.0]);
  }
  // Cuna inferior izquierda para el sensor láser de partículas Sensirion SPS30 (41,0 x 41,0 x 12,2 mm)
  difference() {
    translate([-35.5, -39.5, wall_mm - 0.3]) cube([44.6, 44.6, 8.0]);
    translate([-33.7, -37.7, wall_mm]) cube([41.4, 41.4, 9.0]);
    // Paso de aire lateral hacia las rejillas
    translate([-36.0, -30.0, wall_mm + 1.0]) cube([46.0, 26.0, 8.0]);
  }
  // 4 columnas esquinadas para insertos de latón M2.5
  for (sx = [-1, 1], sy = [-1, 1]) {
    bx = sx * (ext_w / 2 - 5.5);
    by = sy * (ext_h / 2 - 5.5);
    difference() {
      hull() {
        translate([bx, by, wall_mm - 0.3]) cylinder(d = 7.0, h = rear_d - wall_mm - 2.1);
        translate([sx * (iw / 2 - 1.0), sy * (ih / 2 - 1.0), wall_mm - 0.3]) cylinder(d = 3.0, h = rear_d - wall_mm - 2.1);
      }
      translate([bx, by, rear_d - 2.4 - 5.4]) cylinder(d = 3.9, h = 6.0);
    }
  }
}

module front_louvers() {
  iw = ext_w - 2 * wall_mm;
  ih = ext_h - 2 * wall_mm;
  difference() {
    union() {
      rbox(ext_w, ext_h, front_d, corner_r);
      translate([0, 0, front_d - 0.5])
        rbox(iw - 2 * fit_clr, ih - 2 * fit_clr, 2.6, corner_r - wall_mm);
    }
    translate([0, 0, wall_mm])
      rbox(iw - 2 * fit_clr - 2.4, ih - 2 * fit_clr - 2.4, front_d + 3.5, max(1.0, corner_r - wall_mm - 1.2));
    // 5 ranuras de aspiración inclinadas a 45° antilluvia en la mitad inferior (cámara de SPS30 y BME280)
    for (i = [0 : 4]) {
      ly = -32.0 + i * 7.5;
      hull() {
        translate([0, ly, -0.1]) cube([54.0, 2.6, 0.1], center = true);
        translate([0, ly + 2.4, wall_mm + 0.2]) cube([54.0, 2.6, 0.1], center = true);
      }
    }
    // 4 taladros avellanados M2.5
    for (sx = [-1, 1], sy = [-1, 1]) {
      bx = sx * (ext_w / 2 - 5.5);
      by = sy * (ext_h / 2 - 5.5);
      translate([bx, by, -0.1]) cylinder(d = 5.2, h = 2.0);
      translate([bx, by, -0.1]) cylinder(d = 2.8, h = front_d + 3.5);
    }
  }
}

if (part == "rear_housing") {
  rear_housing();
} else if (part == "front_louvers") {
  front_louvers();
} else {
  rear_housing();
  translate([0, 0, rear_d + front_d]) rotate([0, 180, 0]) front_louvers();
}

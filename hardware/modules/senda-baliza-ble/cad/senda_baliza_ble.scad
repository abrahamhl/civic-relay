// SPDX-License-Identifier: MIT
// SENDA Baliza Rescate BLE · Cápsula compacta de bolsillo / mosquetón (OpenSCAD)
// Aloja: Seeed Studio XIAO BLE nRF52840 (21x17,8 mm) + batería protegida 3,7 V 250 mAh (33x20x8 mm)
// + pulsador SOS hundido antidisparo accidental + interruptor lateral + anilla de mosquetón integrada.

part = "assembly"; // "top_shell" | "bottom_shell" | "assembly"
ext_w = 38.0;
ext_h = 56.0;
bot_d = 11.5;
top_d = 6.5;
wall_mm = 2.2;
corner_r = 6.0;
fit_clr = 0.25;
$fn = 40;

module rrect(w, h, r) {
  offset(r = r) square([w - 2 * r, h - 2 * r], center = true);
}
module rbox(w, h, d, r) {
  linear_extrude(height = d) rrect(w, h, r);
}

module bottom_shell() {
  iw = ext_w - 2 * wall_mm;
  ih = ext_h - 2 * wall_mm;
  difference() {
    union() {
      rbox(ext_w, ext_h, bot_d, corner_r);
      // Anilla superior maciza integrada para mosquetón o cordino de rescate (coplanar en Z=0)
      translate([0, ext_h / 2 + 4.5, 0])
        linear_extrude(height = 4.6)
          rrect(22.0, 12.0, 5.0);
    }
    translate([0, ext_h / 2 + 5.2, -0.1])
      cylinder(d = 7.2, h = 6.0);
    translate([0, 0, wall_mm])
      rbox(iw, ih, bot_d, corner_r - wall_mm);
    translate([0, 0, bot_d - 2.0])
      rbox(iw + 0.2, ih + 0.2, 2.4, corner_r - wall_mm);
    // Ventana inferior (-Y) para puerto USB-C de la XIAO nRF52840
    translate([0, -(ext_h / 2 + 0.8), bot_d - 4.5])
      rotate([-90, 0, 0])
        hull() {
          translate([-2.9, 0, 0]) cylinder(d = 3.8, h = wall_mm + 2.5);
          translate([ 2.9, 0, 0]) cylinder(d = 3.8, h = wall_mm + 2.5);
        }
    // Hueco lateral (-X) para microinterruptor deslizante
    translate([-(ext_w / 2 + 0.5), 4.0, bot_d - 6.0])
      cube([wall_mm + 2.0, 7.2, 3.6]);
  }
  // 2 columnas diagonales para insertos M2.5 (zona inferior/media, dejando despejada la antena cerámica superior)
  for (sx = [-1, 1]) {
    bx = sx * (ext_w / 2 - 4.8);
    by = -(ext_h / 2 - 5.2);
    difference() {
      hull() {
        translate([bx, by, wall_mm - 0.3]) cylinder(d = 6.2, h = bot_d - wall_mm - 1.7);
        translate([sx * (iw / 2 - 1.0), -(ih / 2 - 1.0), wall_mm - 0.3]) cylinder(d = 2.8, h = bot_d - wall_mm - 1.7);
      }
      translate([bx, by, bot_d - 2.0 - 5.0]) cylinder(d = 3.9, h = 5.5);
    }
  }
  // Cuna para XIAO BLE nRF52840 (21 x 18 mm)
  for (sx = [-1, 1]) {
    translate([sx * 9.8 - 0.8, -24.0, wall_mm - 0.3])
      cube([1.6, 21.5, 5.2]);
  }
}

module top_shell() {
  iw = ext_w - 2 * wall_mm;
  ih = ext_h - 2 * wall_mm;
  difference() {
    union() {
      rbox(ext_w, ext_h, top_d, corner_r);
      translate([0, 0, top_d - 0.5])
        rbox(iw - 2 * fit_clr, ih - 2 * fit_clr, 2.2, corner_r - wall_mm);
    }
    translate([0, 0, wall_mm])
      rbox(iw - 2 * fit_clr - 2.2, ih - 2 * fit_clr - 2.2, top_d + 3.0, max(1.0, corner_r - wall_mm - 1.1));
    // Guarda circular hundida (rebaje anti-pulsación accidental) + botón flexible central SOS
    translate([0, 4.0, -0.05])
      difference() {
        cylinder(d = 16.0, h = 1.1);
        cylinder(d = 11.0, h = 1.2);
      }
    // Ranura en C de 270° para que el disco central actúe como membrana flexible sobre el pulsador táctil
    translate([0, 4.0, -0.1])
      rotate_extrude(angle = 280)
        translate([6.2, 0, 0])
          square([1.1, wall_mm + 0.5]);
    // 2 taladros inferiores M2.5
    for (sx = [-1, 1]) {
      bx = sx * (ext_w / 2 - 4.8);
      by = -(ext_h / 2 - 5.2);
      translate([bx, by, -0.1]) cylinder(d = 5.0, h = 1.8);
      translate([bx, by, -0.1]) cylinder(d = 2.8, h = top_d + 3.0);
    }
  }
  // Uña snap-fit superior sin metal (despejada junto a la antena cerámica 2,4 GHz)
  translate([-5.0, ih / 2 - fit_clr - 1.6, top_d - 0.5])
    cube([10.0, 1.6, 4.2]);
}

if (part == "bottom_shell") {
  bottom_shell();
} else if (part == "top_shell") {
  top_shell();
} else {
  bottom_shell();
  translate([0, 0, bot_d + top_d]) rotate([0, 180, 0]) top_shell();
}

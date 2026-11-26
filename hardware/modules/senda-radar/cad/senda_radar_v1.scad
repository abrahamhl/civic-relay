// SPDX-License-Identifier: MIT
// SENDA Radar v1 · Carcasa paramétrica imprimible en 3D (OpenSCAD)
//
// Exportación reproducible por línea de comandos:
//   openscad -o stl/front_bezel.stl -D 'part="front_bezel"' cad/senda_radar_v1.scad
//   openscad -o stl/rear_body.stl   -D 'part="rear_body"'   cad/senda_radar_v1.scad
//   openscad -o stl/belt_clip.stl   -D 'part="belt_clip"'   cad/senda_radar_v1.scad
//
// Regla crítica RF (Ai-Thinker Rd-03D Spec V1.0.0 §7):
//   - Ventana frontal del radomo de plástico continuo de `radome_wall_mm = 1.0 mm` delante del conjunto de parches
//     1T2R de 24 GHz (sin rejillas que dejen entrar agua/polvo y con CERO piezas metálicas o insertos en la mitad
//     superior del chasis para no distorsionar el lóbulo ±60° azimut / ±30° elevación).

/* [Selección de pieza] */
// "front_bezel" | "rear_body" | "belt_clip" | "assembly"
part = "assembly";
explode_mm = 0;

/* [Dimensiones exteriores y espesores documentados (mm)] */
ext_w = 76.0;              // Ancho exterior X (aloja Li-Po PKCELL LP503562 de 65,0 mm + paredes + holgura)
ext_h = 70.0;              // Alto exterior Y (cámara superior radar 44x15 mm + cámara inferior OLED 28x28 mm + trípode)
front_d = 9.0;             // Profundidad Z del bisel frontal
rear_d  = 16.0;            // Profundidad Z del cuerpo trasero (total conjunto = 25,0 mm)
corner_r = 4.5;            // Radio exterior de esquina
wall_mm = 2.2;             // Grosor estructural de pared (5 perímetros con boquilla de 0,4 mm)
radome_wall_mm = 1.0;      // Grosor dieléctrico libre de metal delante de la antena de 24 GHz (5 capas a 0,20 mm)
fit_clearance_mm = 0.25;   // Holgura perimetral entre labio macho y hembra (validada para FDM PLA/PETG)
pcb_clearance_mm = 0.35;   // Holgura lateral de cuna para tolerancias de PCB (±0,2 mm en hoja de datos Rd-03D)

/* [Cotas verificadas de componentes electrónicos (mm)] */
// 1. Radar Ai-Thinker Rd-03D / Hi-Link HLK-LD2450 (hoja de datos V1.0.0: 44,0 x 15,0 ±0,2 mm, taladros Ø 2,2 mm)
radar_w = 44.0;
radar_h = 15.0;
radar_y_center = 18.0;     // Mitad superior despejada de metal

// 2. Pantalla OLED 0,96" I2C SSD1306 ZJY096I0400BG01 (TinyTronics SKU 001257: 28,0 x 28,0 mm, taladros Ø 2,0 mm)
oled_pcb_w = 28.0;
oled_pcb_h = 28.0;
oled_view_w = 24.4;
oled_view_h = 13.8;
oled_y_center = -11.0;     // Mitad inferior, fuera del cono ±30° del radar

// 3. Placa Seeed Studio XIAO ESP32-S3 (SKU 113991114: 21,0 x 17,8 mm, conector USB-C en pared derecha +X)
xiao_len = 21.0;
xiao_wid = 18.0;
usbc_y_center = -6.0;
usbc_slot_w = 9.6;
usbc_slot_h = 3.8;

// 4. Batería PKCELL LP503562 3,7 V 1200 mAh con PCM (SKU 005879: máx 65,0 x 36,0 x 5,3 mm)
bat_w = 66.0;
bat_h = 37.0;
bat_d = 6.2;

// 5. Interruptor deslizante ON-OFF SS22G08 en pared izquierda -X (taladros M2,5 a 19,0 mm)
sw_y_center = 6.0;
sw_slot_h = 7.4;
sw_slot_d = 3.8;
sw_hole_pitch = 19.0;

// 6. Inserto de latón para trípode Ruthex RX-1/4"x6.4 UNC en base -Y (taladro piloto Ø 8,0 mm x 6,8 mm)
tripod_bore_d = 8.0;
tripod_bore_depth = 7.0;

// 7. Insertos de latón M2.5 x 5.0 mm solo en las 2 esquinas INFERIORES (D2 = 3,9 mm; lejos de la antena de 24 GHz)
m25_insert_bore_d = 3.9;
m25_insert_depth = 5.6;
m25_screw_d = 2.8;
m25_head_d = 5.2;

$fn = 44;

// --- Primitivas geométricas ---
module rounded_rect_2d(w, h, r) {
  offset(r = r) square([w - 2 * r, h - 2 * r], center = true);
}

module rounded_box(w, h, d, r) {
  linear_extrude(height = d)
    rounded_rect_2d(w, h, r);
}

// --- PIEZA 1: BISEL FRONTAL CON RADOMO SIN METAL (`front_bezel.stl`) ---
// Sistema local: Z = 0 es la cara exterior frontal (apoyada plana en la cama de impresión, 0 soportes).
// Z crece hacia Z = front_d (interior del bisel).
module front_bezel() {
  lip_h = 2.2;
  inner_w = ext_w - 2 * wall_mm;
  inner_h = ext_h - 2 * wall_mm;

  difference() {
    union() {
      // Carcasa exterior con chaflán frontal suave de 0,8 mm
      hull() {
        translate([0, 0, 0])
          linear_extrude(height = 0.01)
            rounded_rect_2d(ext_w - 1.6, ext_h - 1.6, corner_r - 0.6);
        translate([0, 0, 0.8])
          rounded_box(ext_w, ext_h, front_d - 0.8, corner_r);
      }

      // Escalón interior de unión + labio perimetral macho para encaje alineado con rear_body
      difference() {
        union() {
          translate([0, 0, front_d - 1.6])
            rounded_box(inner_w + 1.2, inner_h + 1.2, 1.6, max(1.2, corner_r - wall_mm + 0.6));
          translate([0, 0, front_d - 0.6])
            rounded_box(inner_w - 2 * fit_clearance_mm, inner_h - 2 * fit_clearance_mm, lip_h + 0.6, max(1.2, corner_r - wall_mm));
        }
        translate([0, 0, front_d - 2.0])
          rounded_box(inner_w - 2 * fit_clearance_mm - 2.4, inner_h - 2 * fit_clearance_mm - 2.4, lip_h + 3.0, max(0.8, corner_r - wall_mm - 1.2));
      }
    }

    // Vaciado interior principal dejando pared frontal de `wall_mm = 2,2 mm` y boca abierta hacia rear_body
    translate([0, 0, wall_mm])
      rounded_box(inner_w, inner_h, front_d - wall_mm - 1.4, max(1.2, corner_r - wall_mm));
    translate([0, 0, wall_mm])
      rounded_box(inner_w - 2 * fit_clearance_mm - 2.4, inner_h - 2 * fit_clearance_mm - 2.4, front_d + lip_h + 1.0, max(0.8, corner_r - wall_mm - 1.2));

    // VENTANA DEL RADOMO 24 GHz: rebaje interior hasta `radome_wall_mm = 1,0 mm` continuo y estanco (CERO metal)
    translate([0, radar_y_center, radome_wall_mm])
      linear_extrude(height = front_d + 4.0)
        square([radar_w + 2 * pcb_clearance_mm, radar_h + 2 * pcb_clearance_mm], center = true);

    // Marco exterior sutil grabado (0,25 mm) que delimita la zona de antena "NO TAPAR CON METAL"
    translate([0, radar_y_center, -0.05])
      difference() {
        linear_extrude(height = 0.30)
          rounded_rect_2d(radar_w + 5.0, radar_h + 5.0, 2.0);
        linear_extrude(height = 0.35)
          rounded_rect_2d(radar_w + 3.2, radar_h + 3.2, 1.4);
      }

    // Ventana pasante para la pantalla OLED 0,96" con bisel a 45°
    hull() {
      translate([0, oled_y_center, -0.05])
        linear_extrude(height = 0.05)
          rounded_rect_2d(oled_view_w + 2.0, oled_view_h + 2.0, 1.2);
      translate([0, oled_y_center, 1.2])
        linear_extrude(height = wall_mm + 2.0)
          rounded_rect_2d(oled_view_w, oled_view_h, 0.8);
    }

    // 2 taladros pasantes avellanados M2.5 SOLO en las esquinas inferiores (fuera del hemisferio del radar)
    for (sx = [-1, 1]) {
      bx = sx * (ext_w / 2 - 5.5);
      by = -(ext_h / 2 - 5.5);
      translate([bx, by, -0.1]) cylinder(d = m25_head_d, h = 2.0);
      translate([bx, by, -0.1]) cylinder(d = m25_screw_d, h = front_d + 4.0);
    }
  }

  // Cuna interior exclusivamente plástica para el módulo RD-03D / HLK-LD2450 (solapada 0,4 mm con pared frontal)
  difference() {
    translate([0, radar_y_center, wall_mm - 0.4])
      linear_extrude(height = 4.6)
        square([radar_w + 2 * pcb_clearance_mm + 3.2, radar_h + 2 * pcb_clearance_mm + 3.2], center = true);
    translate([0, radar_y_center, radome_wall_mm])
      linear_extrude(height = 9.0)
        square([radar_w + 2 * pcb_clearance_mm, radar_h + 2 * pcb_clearance_mm], center = true);
    // Paso libre para el conector Picoblade 4P inferior del radar
    translate([0, radar_y_center - radar_h / 2 - 2.0, wall_mm + 1.2])
      cube([16.0, 6.0, 6.0], center = true);
  }

  // Cuna interior y 4 postes guía plásticos (Ø 1,8 mm) para el OLED 28 x 28 mm (solapados 0,4 mm con pared frontal)
  difference() {
    translate([0, oled_y_center, wall_mm - 0.4])
      linear_extrude(height = 3.8)
        square([oled_pcb_w + 2 * pcb_clearance_mm + 3.0, oled_pcb_h + 2 * pcb_clearance_mm + 3.0], center = true);
    translate([0, oled_y_center, wall_mm - 0.05])
      linear_extrude(height = 4.5)
        square([oled_pcb_w + 2 * pcb_clearance_mm, oled_pcb_h + 2 * pcb_clearance_mm], center = true);
    // Hueco superior para los 4 pines I2C (VCC, GND, SCL, SDA)
    translate([0, oled_y_center + oled_pcb_h / 2 + 1.0, wall_mm + 1.0])
      cube([14.0, 5.0, 4.0], center = true);
  }
  for (sx = [-1, 1], sy = [-1, 1]) {
    translate([sx * 11.5, oled_y_center + sy * 11.5, wall_mm - 0.4])
      cylinder(d = 1.8, h = 4.2);
  }

  // 2 pestañas elásticas superiores sin tornillos (snap-fit libre de metal en la zona del radar)
  for (sx = [-1, 1]) {
    arm_x = sx > 0 ? (inner_w / 2 - fit_clearance_mm - 1.6) : -(inner_w / 2 - fit_clearance_mm);
    ly = ext_h / 2 - 12.0;
    translate([arm_x, ly - 4.0, front_d - 1.2])
      cube([1.6, 8.0, 6.0]);
    // Uña cilíndrica de retención fundida en el extremo exterior de la pestaña
    barb_x = sx > 0 ? (arm_x + 1.6) : arm_x;
    translate([barb_x, ly, front_d + 4.0])
      rotate([90, 0, 0])
        cylinder(d = 1.4, h = 7.0, center = true);
  }

  // Torretas guía inferiores esquinadas para los 2 tornillos opcionales M2.5 (macizas hasta la esquina, 0 huecos atrapados)
  for (sx = [-1, 1]) {
    bx = sx * (ext_w / 2 - 5.5);
    by = -(ext_h / 2 - 5.5);
    difference() {
      hull() {
        translate([bx, by, wall_mm - 0.4]) cylinder(d = 6.8, h = front_d - wall_mm + 0.4);
        translate([sx * (inner_w / 2 - 1.2), -(inner_h / 2 - 1.2), wall_mm - 0.4]) cylinder(d = 3.2, h = front_d - wall_mm + 0.4);
      }
      translate([bx, by, -0.1]) cylinder(d = m25_screw_d, h = front_d + 2.0);
    }
  }
}

// --- PIEZA 2: CUERPO TRASERO CON TRÍPODE 1/4", USB-C, INTERRUPTOR Y CARRILES (`rear_body.stl`) ---
// Sistema local para impresión plana: Z = 0 es la espalda exterior del módulo (0 soportes necesarios).
// Z crece hacia Z = rear_d (boca abierta hacia front_bezel).
module rear_body() {
  inner_w = ext_w - 2 * wall_mm;
  inner_h = ext_h - 2 * wall_mm;

  difference() {
    union() {
      // Cuerpo principal con chaflán trasero de 0,8 mm
      hull() {
        linear_extrude(height = 0.01)
          rounded_rect_2d(ext_w - 1.6, ext_h - 1.6, corner_r - 0.6);
        translate([0, 0, 0.8])
          rounded_box(ext_w, ext_h, rear_d - 0.8, corner_r);
      }

      // Dos carriles exteriores de cola de milano en Z = 0..-2.2? No: para imprimir plano en Z=0 sin soportes,
      // integramos las 2 ranuras hembra de cola de milano DENTRO de costillas traseras coplanares con Z=0!
    }

    // Cavidad interior principal dejando pared trasera de `wall_mm + 1.4 = 3,6 mm` para alojar ranuras de clip
    translate([0, 0, 3.6])
      rounded_box(inner_w, inner_h, rear_d, max(1.2, corner_r - wall_mm));

    // Cajera perimetral de recibimiento para el labio de front_bezel
    translate([0, 0, rear_d - 2.5])
      rounded_box(inner_w + 0.1, inner_h + 0.1, 3.0, max(1.2, corner_r - wall_mm));

    // Muescas internas para las 2 uñas snap-fit superiores de front_bezel
    for (sx = [-1, 1]) {
      lx = sx * (inner_w / 2);
      ly = ext_h / 2 - 12.0;
      translate([lx, ly, rear_d - 4.1])
        rotate([90, 0, 0])
          cylinder(d = 1.8, h = 8.4, center = true);
    }

    // 1. Hueco USB-C en pared derecha (+X) alineado con XIAO ESP32-S3
    translate([ext_w / 2 - wall_mm - 1.0, usbc_y_center, rear_d - 6.2])
      rotate([0, 90, 0])
        hull() {
          for (sy = [-1, 1])
            translate([0, sy * (usbc_slot_w / 2 - usbc_slot_h / 2), 0])
              cylinder(d = usbc_slot_h, h = wall_mm + 3.0);
        }
    // Rebaje exterior para la funda del conector USB-C
    translate([ext_w / 2 - 0.9, usbc_y_center, rear_d - 6.2])
      rotate([0, 90, 0])
        hull() {
          for (sy = [-1, 1])
            translate([0, sy * 3.2, 0])
              cylinder(d = 6.8, h = 1.5);
        }

    // 2. Hueco para interruptor deslizante SS22G08 en pared izquierda (-X) + 2 taladros M2.5
    translate([-(ext_w / 2 + 0.5), sw_y_center - sw_slot_h / 2, rear_d - 7.5 - sw_slot_d / 2])
      cube([wall_mm + 2.0, sw_slot_h, sw_slot_d]);
    for (sy = [-1, 1]) {
      translate([-(ext_w / 2 + 0.5), sw_y_center + sy * (sw_hole_pitch / 2), rear_d - 7.5])
        rotate([0, 90, 0])
          cylinder(d = 2.3, h = wall_mm + 4.0);
    }

    // 3. Alojamiento inferior para inserto de trípode de cámara 1/4"-20 UNC (Ruthex RX-1/4"x6.4)
    translate([0, -(ext_h / 2 + 0.1), rear_d / 2])
      rotate([-90, 0, 0]) {
        cylinder(d = tripod_bore_d, h = tripod_bore_depth + 0.1);
        cylinder(d1 = tripod_bore_d + 1.0, d2 = tripod_bore_d, h = 1.2);
      }

    // 4. Dos ranuras traseras verticales en T/cola de milano (Z = 0..2,0 mm, ángulo 60° imprimible sin soportes)
    for (sx = [-1, 1]) {
      translate([sx * 18.0, -4.0, -0.05])
        hull() {
          translate([0, 0, 0]) cube([5.2, 42.0, 0.05], center = true);
          translate([0, 0, 1.9]) cube([7.2, 42.0, 0.05], center = true);
        }
      // Muesca central de retención para el clip
      translate([sx * 18.0, 0.0, 0.9])
        cube([8.4, 4.0, 1.8], center = true);
    }

    // 4 ranuras estrechas de ventilación pasiva en tercio inferior trasero
    for (i = [-1.5, -0.5, 0.5, 1.5]) {
      translate([i * 6.0, -22.0, -0.1])
        cube([2.2, 8.0, 4.0], center = true);
    }
  }

  // Macizo interior de refuerzo para el inserto de trípode 1/4"-20 UNC
  difference() {
    translate([-9.0, -(ext_h / 2 - wall_mm), 3.6])
      cube([18.0, 7.5, rear_d - 6.2]);
    translate([0, -(ext_h / 2 + 0.1), rear_d / 2])
      rotate([-90, 0, 0])
        cylinder(d = tripod_bore_d, h = tripod_bore_depth + 1.5);
  }

  // 2 columnas inferiores para insertos de latón M2.5 x 5,0 mm (D2 = 3,9 mm)
  for (sx = [-1, 1]) {
    bx = sx * (ext_w / 2 - 5.5);
    by = -(ext_h / 2 - 5.5);
    difference() {
      translate([bx, by, 3.6]) cylinder(d = 7.2, h = rear_d - 6.1);
      translate([bx, by, rear_d - 2.5 - m25_insert_depth]) cylinder(d = m25_insert_bore_d, h = m25_insert_depth + 0.5);
    }
  }

  // Cuna lateral derecha para Seeed XIAO ESP32-S3 (21,0 x 18,0 mm) frente al hueco USB-C
  xiao_x0 = ext_w / 2 - wall_mm - xiao_len - 0.6;
  for (sy = [-1, 1]) {
    translate([xiao_x0, usbc_y_center + sy * (xiao_wid / 2 + pcb_clearance_mm + 0.9) - 0.9, 3.6])
      cube([xiao_len, 1.8, 7.0]);
  }
  // Tope trasero que impide que la XIAO retroceda al enchufar el cable USB-C
  translate([xiao_x0 - 1.8, usbc_y_center - 6.0, 3.6])
    cube([1.8, 12.0, 7.6]);

  // Costillas bajas de retención para batería Li-Po 1200 mAh (65 x 36 x 5,3 mm) y elevador 5 V fijo (11 x 10,5 mm)
  translate([-bat_w / 2, -bat_h / 2 + 2.0, 3.6]) cube([bat_w, 1.6, 4.2]);
  translate([-bat_w / 2,  bat_h / 2 + 2.0, 3.6]) cube([bat_w, 1.6, 4.2]);
  // Cuna superior izquierda para el elevador DC-DC 5 V fijo ( fuera del cono frontal y detrás de la batería )
  difference() {
    translate([-(inner_w / 2 - 1.0), 21.5, 3.6]) cube([14.5, 13.5, 4.5]);
    translate([-(inner_w / 2 - 2.2), 22.7, 3.5]) cube([12.0, 11.2, 5.0]);
  }
}

// --- PIEZA 3: CLIP DESMONTABLE DE CINTURÓN / MOCHILA MOLLE (`belt_clip.stl`) ---
// Se imprime apoyado de canto (lateral X en la cama) para que las capas trabajen a tracción en el fleje elástico.
module belt_clip() {
  plate_w = 46.0;
  plate_h = 40.0;
  plate_t = 2.6;

  union() {
    // Placa base que apoya contra la espalda de `rear_body`
    translate([0, 0, plate_t / 2])
      cube([plate_w, plate_h, plate_t], center = true);

    // 2 patines macho de cola de milano (holgura 0,25 mm respecto a las ranuras de `rear_body`)
    for (sx = [-1, 1]) {
      translate([sx * 18.0, 0, plate_t])
        hull() {
          cube([4.6, plate_h - 4.0, 0.05], center = true);
          translate([0, 0, 1.65]) cube([6.5, plate_h - 4.0, 0.05], center = true);
        }
      // Tetón elástico central que encaja en la muesca de retención
      translate([sx * 18.0, 4.0, plate_t + 0.85])
        cube([7.4, 2.8, 1.4], center = true);
    }

    // Puente superior y brazo elástico para cinturón de hasta 45 mm x 5,5 mm
    translate([-13.0, plate_h / 2 - 5.0, -6.5])
      cube([26.0, 5.0, 6.5 + plate_t]);
    translate([-13.0, -plate_h / 2 + 2.0, -9.3])
      cube([26.0, plate_h - 2.0, 2.8]);
    // Uña inferior de retención del cinturón con rampa de entrada
    hull() {
      translate([-13.0, -plate_h / 2 + 2.0, -6.5]) cube([26.0, 3.2, 2.4]);
      translate([-13.0, -plate_h / 2 + 6.5, -6.5]) cube([26.0, 1.0, 0.4]);
    }
  }
}

// --- CONJUNTO ENSAMBLADO / EXPLOSIONADO ---
module assembly_view(d = 0) {
  // Cuerpo trasero mirando hacia +Z
  color([0.10, 0.14, 0.18])
    translate([0, 0, 0])
      rear_body();

  // Bisel frontal invertido (su cara exterior queda en Z = rear_d + front_d + d = 25,0 mm cerrada)
  color([0.16, 0.22, 0.27])
    translate([0, 0, rear_d + front_d + d])
      rotate([0, 180, 0])
        front_bezel();

  // Clip trasero desplazado en -Z
  color([0.22, 0.28, 0.33])
    translate([0, -4.0, -plate_offset(d)])
      belt_clip();
}

function plate_offset(d) = 2.6 + d * 0.8;

if (part == "front_bezel") {
  front_bezel();
} else if (part == "rear_body") {
  rear_body();
} else if (part == "belt_clip") {
  // Orientación de impresión sobre su canto lateral para máxima resistencia interlaminar del fleje
  rotate([0, 90, 0]) belt_clip();
} else {
  assembly_view(explode_mm);
}

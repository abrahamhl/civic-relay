// Modelos 3D detallados y procedurales (sin activos de terceros): turismo, camión articulado, dron y entorno de reflejos.
import { THREE } from './kit.mjs';
import { RoomEnvironment } from '/media/senda-film/cinema/vendor/addons/environments/RoomEnvironment.js';

let _env;
export function envMap(renderer) {
  if (_env) return _env; const pm = new THREE.PMREMGenerator(renderer); _env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); return _env;
}
let _glow;
export function glowTex() {
  if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); _glow = new THREE.CanvasTexture(c); return _glow;
}
export function lamp(color, scale) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(scale, scale, 1); return s; }

// Extruye un perfil lateral (puntos x = longitud hacia delante, y = altura) con biselado: carrocería con volumen real.
function profileBody(pts, width, bevel, mat) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 18 });
  geo.translate(0, 0, -(width - 2 * bevel) / 2); geo.rotateY(Math.PI / 2); // la longitud pasa al eje −z (delante)
  return new THREE.Mesh(geo, mat);
}
function wheel(r, w, rimColor = '#c8cdd0') {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28, 1), new THREE.MeshStandardMaterial({ color: '#0c0c0d', roughness: 0.85 }));
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 1.02, 20), new THREE.MeshStandardMaterial({ color: rimColor, metalness: 1, roughness: 0.25 }));
  for (let i = 0; i < 5; i++) { const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.12, w * 1.04, r * 1.1), rim.material); spoke.rotation.y = (i / 5) * Math.PI; g.add(spoke); }
  g.add(tyre, rim); g.rotation.z = Math.PI / 2; return g;
}

/** Turismo compacto (~4,4 m). Frontal hacia −z. */
export function makeCar(color = '#91d7e8') {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0a1218', metalness: 0.2, roughness: 0.05, transmission: 0, clearcoat: 1 });
  // Perfil lateral: de la trasera (x=−2.2) al morro (x=+2.2)
  const body = profileBody([[-2.2, 0.32], [2.2, 0.32], [2.25, 0.62], [2.05, 0.86], [0.95, 0.98], [-1.9, 1.02], [-2.22, 0.86]], 1.8, 0.09, paint);
  const cabin = profileBody([[-1.55, 0.98], [0.85, 0.98], [0.15, 1.46], [-1.1, 1.5], [-1.62, 1.12]], 1.58, 0.07, glass);
  car.add(body, cabin);
  const roof = profileBody([[-1.05, 1.46], [0.1, 1.46], [0.05, 1.52], [-1.0, 1.54]], 1.5, 0.04, paint); car.add(roof);
  for (const [x, z] of [[-0.82, -1.35], [0.82, -1.35], [-0.82, 1.4], [0.82, 1.4]]) { const w = wheel(0.33, 0.24); w.position.set(x, 0.33, z); car.add(w); }
  const mirrorM = paint; const mirrors = [];
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.12), mirrorM); m.position.set(s * 0.98, 1.02, -0.62); car.add(m); mirrors.push(m); }
  const head = []; for (const x of [-0.62, 0.62]) { const s = lamp('#fff3da', 1.3); s.position.set(x, 0.66, -2.27); car.add(s); head.push(s); }
  const tail = []; for (const x of [-0.66, 0.66]) { const s = lamp('#ff2a3a', 0.8); s.position.set(x, 0.78, 2.24); car.add(s); tail.push(s); }
  const blink = []; for (const [x, z] of [[-0.86, -2.15], [0.86, -2.15], [-0.86, 2.15], [0.86, 2.15]]) { const s = lamp('#ffb020', 1.0); s.position.set(x, 0.74, z); s.visible = false; car.add(s); blink.push(s); }
  const beam = new THREE.SpotLight('#fff1d6', 45, 70, 0.42, 0.65, 1.6); beam.position.set(0, 0.7, -2.1); beam.target.position.set(0, 0, -22); car.add(beam, beam.target);
  car.userData = { head, tail, blink, paint, mirrors, beam };
  return car;
}

/** Camión articulado: cabina con frontal redondeado, parabrisas, retrovisores, remolque nervado y 5 ejes. Frontal hacia −z. */
export function makeTruck() {
  const t = new THREE.Group();
  const cabM = new THREE.MeshPhysicalMaterial({ color: '#d9dee1', metalness: 0.35, roughness: 0.35, clearcoat: 0.8 });
  const darkM = new THREE.MeshStandardMaterial({ color: '#1a1d20', roughness: 0.7 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0a1218', roughness: 0.05, clearcoat: 1 });
  const boxM = new THREE.MeshStandardMaterial({ color: '#4d5a63', metalness: 0.25, roughness: 0.6 });
  const cab = profileBody([[-1.3, 0.9], [1.15, 0.9], [1.2, 1.6], [1.15, 3.5], [0.9, 3.85], [-1.3, 3.85]], 2.5, 0.14, cabM); cab.position.z = -6.4; t.add(cab);
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.15), glass); ws.position.set(0, 2.95, -7.62); ws.rotation.x = -0.06; ws.rotation.y = Math.PI; t.add(ws);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.05), darkM); grille.position.set(0, 1.55, -7.64); t.add(grille);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.45, 0.3), darkM); bumper.position.set(0, 0.85, -7.55); t.add(bumper);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), darkM); arm.position.set(s * 1.42, 3.0, -7.2); t.add(arm); const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.65, 0.3), darkM); m.position.set(s * 1.62, 2.85, -7.2); t.add(m); }
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 15), darkM); chassis.position.set(0, 0.75, -0.3); t.add(chassis);
  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.55, 3.2, 12.6), boxM); trailer.position.set(0, 2.55, 1.25); t.add(trailer);
  for (let z = -4.8; z <= 7.4; z += 0.9) for (const s of [-1, 1]) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.1, 0.08), boxM); rib.position.set(s * 1.3, 2.55, z); t.add(rib); }
  for (const z of [-6.1, -2.2, 4.6, 5.9, 7.2]) for (const s of [-1, 1]) { const w = wheel(0.52, 0.42, '#9aa3a8'); w.position.set(s * 1.05, 0.52, z); t.add(w); }
  for (const x of [-0.85, 0.85]) { const s = lamp('#fff3da', 1.7); s.position.set(x, 1.15, -7.75); t.add(s); }
  for (let z = -4.5; z < 7.5; z += 2.4) for (const s of [-1.32, 1.32]) { const l = lamp('#ffaa22', 0.45); l.position.set(s, 0.95, z); t.add(l); }
  for (const x of [-1.0, 1.0]) { const l = lamp('#ff2a3a', 0.9); l.position.set(x, 1.0, 7.6); t.add(l); }
  const beam = new THREE.SpotLight('#fff1d6', 60, 80, 0.48, 0.6, 1.6); beam.position.set(0, 1.3, -7.6); beam.target.position.set(0, 0, -30); t.add(beam, beam.target);
  return t;
}

/** Dron cuadrirrotor (~0,6 m de envergadura, escalado a la escena). */
export function makeDrone(scale = 1) {
  const d = new THREE.Group(); const body = new THREE.MeshPhysicalMaterial({ color: '#e7ecef', metalness: 0.2, roughness: 0.35, clearcoat: 0.6 }); const dark = new THREE.MeshStandardMaterial({ color: '#202428', roughness: 0.5 });
  const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 8, 16), body); core.rotation.x = Math.PI / 2; d.add(core);
  const props = [];
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), dark); arm.rotation.z = Math.PI / 2; arm.rotation.y = -a; arm.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25); d.add(arm);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12), dark); motor.position.set(Math.cos(a) * 0.5, 0.03, Math.sin(a) * 0.5); d.add(motor);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: '#cfd8dc', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); disk.rotation.x = -Math.PI / 2; disk.position.set(Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5); d.add(disk); props.push(disk); }
  const cam = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), dark); cam.position.set(0, -0.12, -0.2); d.add(cam);
  const nav = [lamp('#ff3344', 0.25), lamp('#34d399', 0.25)]; nav[0].position.set(-0.5, 0, 0.35); nav[1].position.set(0.5, 0, 0.35); d.add(...nav);
  d.scale.setScalar(scale); d.userData = { props }; return d;
}

/**
 * SENDA · BÓVEDA DE DEFENSA Y DOBLE USO (`@senda/core/defense`)
 *
 * Módulos con aplicación militar o de contramedidas frente a UAV, aislados del producto civil:
 *  - civilian-uav-mesh-radar     TDoA acústico, firma BPF, drones por fibra, señuelos ASTM F3411, estroboscopio
 *  - uav-tactical-science        A2G táctico, enjambres, trilateración GPS-denied, margen anti-jamming (EW)
 *  - cots-rf-tactical            Decodificador Remote ID, radar pasivo biestático, DoA, antenas COTS
 *  - acoustic-beamforming-survival  cámara acústica, centinela COTS, vector de evasión ante UAV hostil
 *
 * Reglas de aislamiento (verificadas por tests/defense/vault-isolation.test.mjs):
 *  1. El índice civil (`@senda/core`) NO reexporta nada de esta carpeta.
 *  2. Ningún módulo civil importa desde `./defense/`.
 *  3. Su uso puede estar sujeto a control de exportación de doble uso (Reglamento (UE) 2021/821),
 *     a la normativa de espectro y de aviación no tripulada (Reglamentos (UE) 2019/945 y 2019/947),
 *     y queda fuera del alcance de las convocatorias civiles. Revisión legal antes de cualquier despliegue.
 */
export * from './civilian-uav-mesh-radar.mjs';
export * from './uav-tactical-science.mjs';
export * from './cots-rf-tactical.mjs';
export * from './acoustic-beamforming-survival.mjs';

export const DEFENSE_VAULT = Object.freeze({
  id: 'senda-defense-vault',
  classification: 'DUAL_USE_DEFENSE',
  modules: Object.freeze(['civilian-uav-mesh-radar', 'uav-tactical-science', 'cots-rf-tactical', 'acoustic-beamforming-survival']),
  civilScope: false,
});

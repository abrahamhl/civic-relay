import crypto from 'node:crypto';
import {
  computeAirToGroundLoSProbability,
  computeAirToGroundPathLoss,
  calculateOptimalUavAltitude,
  computeSwarmAlgebraicConnectivity,
  computeAerialPhotogrammetryParams,
  computeAntiJammingMargin,
  A2G_ENVIRONMENTS,
} from '@senda/core/defense';
import { toUtm, fromUtm } from '../../../../packages/senda/src/utm.mjs';

/**
 * Tactical Camera / Sensor Presets used by civil protection, defense and SAR operations.
 */
export const UAV_CAMERA_PRESETS = Object.freeze({
  DJI_MAVIC_3_ENTERPRISE: Object.freeze({
    id: 'DJI_MAVIC_3_ENTERPRISE',
    name: 'DJI Mavic 3 Enterprise (4/3" CMOS)',
    focalLengthMm: 12.3,
    sensorWidthMm: 17.3,
    sensorHeightMm: 13.0,
    imageWidthPx: 5280,
    imageHeightPx: 3956,
  }),
  DJI_ZENMUSE_P1: Object.freeze({
    id: 'DJI_ZENMUSE_P1',
    name: 'DJI Zenmuse P1 Full-Frame (Matrice 300/350)',
    focalLengthMm: 35.0,
    sensorWidthMm: 35.9,
    sensorHeightMm: 24.0,
    imageWidthPx: 8192,
    imageHeightPx: 5460,
  }),
  PARROT_ANAFI_USA: Object.freeze({
    id: 'PARROT_ANAFI_USA',
    name: 'Parrot ANAFI USA (Tactical Encrypted)',
    focalLengthMm: 4.0,
    sensorWidthMm: 6.28,
    sensorHeightMm: 4.71,
    imageWidthPx: 4000,
    imageHeightPx: 3000,
  }),
  SONY_A7R_IV: Object.freeze({
    id: 'SONY_A7R_IV',
    name: 'Sony α7R IV Tactical Mapping Payload',
    focalLengthMm: 35.0,
    sensorWidthMm: 35.7,
    sensorHeightMm: 23.8,
    imageWidthPx: 9504,
    imageHeightPx: 6336,
  }),
});

function finite(val, min, max) {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

/**
 * Generates a tactical autonomous boustrophedon survey mission plan over a bounding box.
 *
 * @param {object} options Mission parameters.
 * @param {[number, number, number, number]} options.bbox [west, south, east, north] in WGS84 degrees.
 * @param {number} [options.targetGsdCm=3.0] Target ground sampling distance in cm/px.
 * @param {keyof typeof UAV_CAMERA_PRESETS|object} [options.camera='DJI_MAVIC_3_ENTERPRISE'] Camera preset or specs.
 * @param {number} [options.forwardOverlapPct=75] Forward overlap percentage along track.
 * @param {number} [options.sideOverlapPct=65] Side overlap percentage between flight lines.
 * @param {number} [options.cruiseSpeedMs=10.0] Drone cruise ground speed in m/s.
 * @param {number} [options.operationalCeilingM=300] Tactical operational altitude ceiling AGL.
 * @param {string} [options.emergencyScenario='SEARCH_AND_RESCUE'] Operational scenario tag.
 * @returns {object} Complete tactical mission plan with waypoints, photogrammetry metrics, and GeoJSON.
 */
export function generateTacticalFlightPlan({
  bbox,
  targetGsdCm = 3.0,
  camera = 'DJI_MAVIC_3_ENTERPRISE',
  forwardOverlapPct = 75,
  sideOverlapPct = 65,
  cruiseSpeedMs = 10.0,
  operationalCeilingM = 300,
  emergencyScenario = 'SEARCH_AND_RESCUE',
}) {
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    throw new TypeError('bbox must be [west, south, east, north]');
  }
  const [west, south, east, north] = bbox;
  if (!finite(west, -180, 180) || !finite(east, -180, 180) || west >= east) {
    throw new TypeError('Invalid longitude bounds');
  }
  if (!finite(south, -80, 80) || !finite(north, -80, 80) || south >= north) {
    throw new TypeError('Invalid latitude bounds');
  }

  const cam = typeof camera === 'string' ? UAV_CAMERA_PRESETS[camera] || UAV_CAMERA_PRESETS.DJI_MAVIC_3_ENTERPRISE : camera;
  if (!cam || !finite(cam.focalLengthMm, 1, 500) || !finite(cam.sensorWidthMm, 1, 100)) {
    throw new TypeError('Invalid camera specifications');
  }

  const gsd = finite(targetGsdCm, 0.5, 50) ? targetGsdCm : 3.0;
  const fwd = finite(forwardOverlapPct, 50, 95) ? forwardOverlapPct : 75;
  const side = finite(sideOverlapPct, 50, 90) ? sideOverlapPct : 65;
  const speed = finite(cruiseSpeedMs, 1, 35) ? cruiseSpeedMs : 10.0;
  const ceiling = finite(operationalCeilingM, 20, 5000) ? operationalCeilingM : 300;

  // Compute required flight altitude AGL for target GSD
  // GSD = (h * Sw) / (f * Iw) -> h = GSD * (f / pixelPitch)
  const pixelPitchMm = cam.sensorWidthMm / cam.imageWidthPx;
  let flightAltitudeM = (gsd / 100) * (cam.focalLengthMm / pixelPitchMm);
  let effectiveGsdCm = gsd;

  if (flightAltitudeM > ceiling) {
    flightAltitudeM = ceiling;
    effectiveGsdCm = Math.round(((ceiling * pixelPitchMm) / cam.focalLengthMm) * 100 * 100) / 100;
  }
  flightAltitudeM = Math.round(flightAltitudeM * 10) / 10;

  // Photogrammetry parameters
  const photoParams = computeAerialPhotogrammetryParams({
    flightAltitudeM,
    focalLengthMm: cam.focalLengthMm,
    sensorWidthMm: cam.sensorWidthMm,
    imageWidthPx: cam.imageWidthPx,
    forwardOverlapRatio: fwd / 100,
    sideOverlapRatio: side / 100,
    flightSpeedMs: speed,
  });

  // Convert bounding box to UTM metric projection
  const swUtm = toUtm(south, west);
  const neUtm = toUtm(north, east);
  const zone = swUtm.zone;

  const minX = Math.min(swUtm.x, neUtm.x);
  const maxX = Math.max(swUtm.x, neUtm.x);
  const minY = Math.min(swUtm.y, neUtm.y);
  const maxY = Math.max(swUtm.y, neUtm.y);

  const extentXM = maxX - minX;
  const extentYM = maxY - minY;
  const areaKm2 = Math.round(((extentXM * extentYM) / 1e6) * 1000) / 1000;

  const lineSpacing = Math.max(10, photoParams.flightLineSpacingM);
  const triggerDist = Math.max(5, photoParams.footprintWidthM * (1.0 - fwd / 100));

  const numLines = Math.max(2, Math.ceil(extentXM / lineSpacing) + 1);
  const waypoints = [];
  let totalFlightDistM = 0;
  let lastX = null;
  let lastY = null;

  for (let i = 0; i < numLines; i++) {
    const curX = minX + i * lineSpacing;
    if (curX > maxX + lineSpacing * 0.5) break;

    const goingNorth = i % 2 === 0;
    const startY = goingNorth ? minY : maxY;
    const endY = goingNorth ? maxY : minY;

    // Start of line
    const startWgs = fromUtm(curX, startY, zone);
    if (lastX !== null && lastY !== null) {
      totalFlightDistM += Math.hypot(curX - lastX, startY - lastY);
    }
    waypoints.push({
      sequence: waypoints.length + 1,
      lat: Math.round(startWgs.lat * 1e7) / 1e7,
      lon: Math.round(startWgs.lon * 1e7) / 1e7,
      altitudeAglM: flightAltitudeM,
      type: 'LINE_START',
      lineIndex: i,
    });

    // End of line
    const endWgs = fromUtm(curX, endY, zone);
    totalFlightDistM += Math.hypot(0, endY - startY);
    waypoints.push({
      sequence: waypoints.length + 1,
      lat: Math.round(endWgs.lat * 1e7) / 1e7,
      lon: Math.round(endWgs.lon * 1e7) / 1e7,
      altitudeAglM: flightAltitudeM,
      type: 'LINE_END',
      lineIndex: i,
    });

    lastX = curX;
    lastY = endY;
  }

  const estimatedFlightTimeSec = Math.round(totalFlightDistM / speed);
  const totalPhotos = Math.max(1, Math.round(totalFlightDistM / triggerDist));
  const batterySorties = Math.max(1, Math.ceil(estimatedFlightTimeSec / (22 * 60))); // 22 min safe endurance

  // Cryptographic seal of the tactical mission plan
  const planData = {
    bbox,
    targetGsdCm: effectiveGsdCm,
    flightAltitudeM,
    camId: cam.id,
    waypointsCount: waypoints.length,
    totalDistanceM: Math.round(totalFlightDistM),
  };
  const planHashSha256 = crypto.createHash('sha256').update(JSON.stringify(planData)).digest('hex');

  // GeoJSON Representation
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: `UAV Survey Path — ${emergencyScenario}`,
          altitudeAglM: flightAltitudeM,
          gsdCm: effectiveGsdCm,
          totalDistanceM: Math.round(totalFlightDistM),
          flightTimeSec: estimatedFlightTimeSec,
        },
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map((w) => [w.lon, w.lat, w.altitudeAglM]),
        },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Survey Bounding Footprint',
          areaKm2,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      },
    ],
  };

  // QGroundControl / PX4 standard mission plan format
  const qgcPlan = {
    fileType: 'Plan',
    version: 1,
    groundStation: 'SENDA Tactical Ground Station',
    mission: {
      cruiseSpeed: speed,
      hoverSpeed: 3,
      plannedHomePosition: [waypoints[0].lat, waypoints[0].lon, 0],
      vehicleType: 2, // Multi-Rotor
      items: waypoints.map((w, idx) => ({
        autoContinue: true,
        command: 16, // MAV_CMD_NAV_WAYPOINT
        doJumpId: idx + 1,
        frame: 3, // MAV_FRAME_GLOBAL_RELATIVE_ALT
        params: [0, 0, 0, null, w.lat, w.lon, w.altitudeAglM],
        type: 'SimpleItem',
      })),
    },
  };

  return {
    success: true,
    emergencyScenario,
    planHashSha256,
    generatedAtUtc: new Date().toISOString(),
    metrics: {
      targetGsdCm: effectiveGsdCm,
      flightAltitudeAglM: flightAltitudeM,
      cameraPreset: cam.name,
      extentWidthM: Math.round(extentXM),
      extentHeightM: Math.round(extentYM),
      coverageAreaKm2: areaKm2,
      totalFlightDistanceM: Math.round(totalFlightDistM),
      estimatedFlightDurationSec: estimatedFlightTimeSec,
      estimatedFlightDurationMin: Math.round((estimatedFlightTimeSec / 60) * 10) / 10,
      totalPhotoCount: totalPhotos,
      batterySortiesRecommended: batterySorties,
      photoTriggerDistanceM: Math.round(triggerDist * 10) / 10,
      photoTriggerTimeIntervalSec: photoParams.photoIntervalSeconds,
      flightLineSpacingM: photoParams.flightLineSpacingM,
      forwardOverlapPct: fwd,
      sideOverlapPct: side,
      isSfMReconstructionFeasible: photoParams.isSfmReconstructionFeasible,
    },
    waypoints,
    geojson,
    qgcPlan,
  };
}

/**
 * Evaluates the tactical RF mesh relay and anti-jamming resilience for a swarm of hovering UAVs.
 *
 * @param {object} payload
 * @param {Array<{ id: string, x: number, y: number, z: number, role?: string }>} payload.drones Swarm drone nodes.
 * @param {number} [payload.communicationRangeM=1200] Peer-to-peer RF mesh communication threshold in meters.
 * @param {number} [payload.frequencyHz=868e6] Radio frequency in Hz (868 MHz LoRa, 1.4 GHz, 2.4 GHz).
 * @param {keyof typeof A2G_ENVIRONMENTS} [payload.envType='URBAN'] Environment clutter type.
 * @param {number} [payload.groundResponderDistM=800] Distance to ground rescue units.
 * @param {object} [payload.ewThreat] Electronic Warfare threat parameters (jammer power, distance).
 * @returns {object} Swarm algebraic connectivity, A2G link budget, and anti-jamming evaluation.
 */
export function evaluateTacticalSwarmMission({
  drones,
  communicationRangeM = 1200,
  frequencyHz = 868e6,
  envType = 'URBAN',
  groundResponderDistM = 800,
  ewThreat = null,
}) {
  if (!Array.isArray(drones) || drones.length === 0) {
    throw new TypeError('drones array is required');
  }

  // 1. Swarm Algebraic Connectivity
  const swarmConnectivity = computeSwarmAlgebraicConnectivity(drones, communicationRangeM);

  // 2. Air-to-Ground Link Performance for each drone
  const a2gEvaluations = drones.map((d) => {
    const alt = d.z || 120;
    const los = computeAirToGroundLoSProbability(alt, groundResponderDistM, envType);
    const pl = computeAirToGroundPathLoss(alt, groundResponderDistM, frequencyHz, envType);
    return {
      droneId: d.id,
      altitudeAglM: alt,
      role: d.role || 'RELAY_NODE',
      elevationToResponderDeg: los.elevationDeg,
      pLos: los.pLos,
      totalPathLossDb: pl.totalPathLossDb,
      excessClutterLossDb: pl.excessLossDb,
    };
  });

  // 3. Optimal altitude recommendation for the environment
  const optimalAlt = calculateOptimalUavAltitude(115, frequencyHz, envType, 300);

  // 4. Electronic Warfare Anti-Jamming Margin
  let antiJamming = null;
  if (ewThreat) {
    antiJamming = computeAntiJammingMargin(
      ewThreat.rfBandwidthHz || 20e6,
      ewThreat.dataRateBps || 250e3,
      ewThreat.requiredEbN0Db || 6.0,
      ewThreat.systemLossesDb || 2.0
    );
  }

  return {
    success: true,
    evaluatedAtUtc: new Date().toISOString(),
    swarmSize: drones.length,
    communicationRangeM,
    frequencyHz,
    environment: envType,
    swarmConnectivity: {
      isSwarmConnected: swarmConnectivity.isSwarmConnected,
      algebraicConnectivityFiedler: swarmConnectivity.algebraicConnectivity,
      activeEdgesCount: swarmConnectivity.totalLinks,
      degreeMin: swarmConnectivity.degreeMin,
      degreeMean: swarmConnectivity.degreeMean,
      partitionRisk: swarmConnectivity.algebraicConnectivity < 0.2 ? 'HIGH_RISK_OF_PARTITION' : 'ROBUST_MESH',
    },
    optimalAltitudeBenchmark: optimalAlt,
    a2gEvaluations,
    antiJamming,
  };
}

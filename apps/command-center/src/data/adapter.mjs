/**
 * SENDA Command Center — pure data adapter.
 *
 * This module contains NO React, NO DOM and NO network code so it can be
 * executed by `node --test` and by the browser bundle alike. It converts the
 * committed evidence snapshot into a UI model while preserving the
 * epistemological separation the SENDA director requires:
 *
 *   REAL_MEASUREMENT          a physical instrument reading (or a recorded run outcome)
 *   MODEL_DERIVED_REAL_INPUT  a model applied to real captured material (e.g. YOLOX on a real clip)
 *   FORECAST                  a prediction
 *   HINDSIGHT_REPLAY          a historical event replayed for study, not a live scene
 *   SIMULATOR                 synthetic data produced by this software
 *   MISSING_DATA              required evidence absent; never filled with invented values
 */

export const PROVENANCE = Object.freeze({
  REAL_MEASUREMENT: 'REAL_MEASUREMENT',
  MODEL_DERIVED_REAL_INPUT: 'MODEL_DERIVED_REAL_INPUT',
  FORECAST: 'FORECAST',
  HINDSIGHT_REPLAY: 'HINDSIGHT_REPLAY',
  SIMULATOR: 'SIMULATOR',
  MISSING_DATA: 'MISSING_DATA',
});

export const PROVENANCE_LABEL = Object.freeze({
  REAL_MEASUREMENT: 'Medición real',
  MODEL_DERIVED_REAL_INPUT: 'Derivado de material real',
  FORECAST: 'Pronóstico',
  HINDSIGHT_REPLAY: 'Replay histórico',
  SIMULATOR: 'Simulador',
  MISSING_DATA: 'Dato ausente',
});

export const PROVENANCE_TONE = Object.freeze({
  REAL_MEASUREMENT: 'ok',
  MODEL_DERIVED_REAL_INPUT: 'info',
  FORECAST: 'warn',
  HINDSIGHT_REPLAY: 'muted',
  SIMULATOR: 'sim',
  MISSING_DATA: 'bad',
});

/** Human readable status for a registry source without inventing availability. */
export function classifySourceStatus(source) {
  const status = source.status ?? 'UNKNOWN';
  const access = source.access ?? 'UNKNOWN';
  const rights = source.rights ?? 'UNKNOWN';
  let availability = 'DOCUMENTED_NOT_VERIFIED';
  if (access.includes('KEY_REQUIRED')) availability = 'REQUIRE_AUTH';
  else if (access.includes('PAID') || access.includes('COMMERCIAL')) availability = 'REQUIRE_LICENSE';
  return {
    ...source,
    availability,
    documented: status === 'OFFICIAL_DOCUMENTATION_CHECKED',
    isMeasurement: false,
    rights,
    access,
    videoPermission: source.productionVideoPermission ?? null,
  };
}

export function adaptRegistry(registry) {
  const sources = (registry.sources ?? []).map(classifySourceStatus);
  return {
    schema: registry.schema ?? 'unknown',
    reviewedAtUTC: registry.reviewedAtUTC ?? null,
    reviewMethod: registry.reviewMethod ?? null,
    rule: registry.rule ?? null,
    sources,
    counts: {
      total: sources.length,
      documented: sources.filter((s) => s.documented).length,
      requireAuth: sources.filter((s) => s.availability === 'REQUIRE_AUTH').length,
      grantVideoPermission: sources.filter((s) => s.videoPermission === true).length,
    },
  };
}

function seconds(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function adaptTfl(tfl) {
  const observedAtUTC = tfl.capturaUTC ?? null;
  const cameras = (tfl.camaras ?? []).map((c) => {
    const noise = c.rateSdPerMin ?? c.sdInFrame ?? null;
    return {
      id: `tfl:${c.camara}`,
      dataset: 'tfl',
      provider: 'Transport for London (TfL JamCams)',
      operator: 'TfL Open Data',
      name: c.nombre ?? c.camara,
      lat: c.lat ?? null,
      lon: c.lon ?? null,
      observedAtUTC,
      timezoneNote: 'Hora de Londres (captura nocturna)',
      provenance: PROVENANCE.MODEL_DERIVED_REAL_INPUT,
      evidenceBasis: 'YOLOX-s + ByteTrack sobre clip real de ~10 s; no se guardan imágenes ni se identifica a personas',
      status: 'IN_SERVICE',
      license: 'TfL Open Data',
      liveImageUrl: null,
      calibration: {
        pose: 'NOT_AVAILABLE',
        homography: 'NOT_AVAILABLE',
        note: 'Sin pose ni homografía publicadas: no se calculan velocidades ni triangulación.',
      },
      videoPermission: 'NOT_GRANTED',
      metrics: [
        metric('cruces', 'Cruces en el clip', c.cruces, 'veh', noise ? `±${round(noise)}/min` : 'sin intervalo'),
        metric('mediaEnImagen', 'Media en imagen', round(c.mediaEnImagen), 'veh', c.sdInFrame ? `σ≈${round(c.sdInFrame)}` : null),
        metric('maxEnImagen', 'Máximo en imagen', c.maxEnImagen, 'veh', null),
      ],
      counts: {
        crosses: c.cruces ?? null,
        perDirection: c.porSentido ?? null,
        meanInFrame: round(c.mediaEnImagen),
        maxInFrame: c.maxInImagen ?? null,
        durationS: seconds(c.durS),
      },
      series: Array.isArray(c.por5s) ? c.por5s : null,
      fireHistory: [],
    };
  });
  return { dataset: 'tfl', sourceNote: tfl.fuente ?? null, observedAtUTC, cameras };
}

export function adaptCaltrans(cal) {
  const observedAtUTC = cal.capturaPST ? `${cal.capturaPST}-08:00` : null;
  const cameras = (cal.camaras ?? []).map((c) => {
    const video = c.video ?? null;
    const state = (c.estado ?? '').toLowerCase();
    const inService = state.startsWith('en servicio');
    const speed = video?.velMedianaMovKmh ?? null;
    return {
      id: `caltrans:${c.id}`,
      dataset: 'caltrans',
      provider: 'Caltrans CCTV',
      operator: 'Caltrans District 3/7',
      name: c.id,
      zone: c.zona ?? null,
      route: c.ruta ?? null,
      heading: c.sentido ?? null,
      lat: c.lat ?? null,
      lon: c.lon ?? null,
      observedAtUTC,
      timezoneNote: 'Hora del Pacífico (PST)',
      provenance: PROVENANCE.MODEL_DERIVED_REAL_INPUT,
      evidenceBasis: 'YOLOX-s + ByteTrack sobre clip real; velocidad estimada usando el tamaño del vehículo como escala',
      status: inService ? 'IN_SERVICE' : 'OUT_OF_SERVICE',
      statusNote: c.estado ?? null,
      license: 'Caltrans CCTV (catálogos D3/D7)',
      liveImageUrl: c.imagenEnDirecto ?? null,
      calibration: {
        pose: 'NOT_AVAILABLE',
        homography: 'NOT_AVAILABLE',
        note: 'Velocidad aproximada (±30 %) por escala del vehículo; sin calibración geométrica publicada.',
      },
      videoPermission: 'NOT_GRANTED',
      metrics: [
        metric('flujoVehH', 'Flujo', video?.flujoVehH ?? null, 'veh/h', null),
        metric('mediaEnImagen', 'Media en imagen', round(video?.mediaEnImagen), 'veh', null),
        metric('velMedianaMovKmh', 'Velocidad mediana', speed, 'km/h', speed == null ? null : '±30 %'),
        metric('fraccionParados', 'Fracción parados', round(video?.fraccionParados), '', null),
      ],
      counts: {
        crosses: video?.cruces ?? null,
        meanInFrame: round(video?.mediaInImagen) ?? null,
        maxInFrame: video?.maxInImagen ?? null,
        durationS: seconds(video?.durS),
      },
      series: Array.isArray(c.serie) && c.serie.some((v) => v != null) ? c.serie : null,
      fireHistory: fireHistory(c.fuegoHistorico, observedAtUTC),
    };
  });
  return { dataset: 'caltrans', sourceNote: cal.fuente ?? null, observedAtUTC, cameras };
}

function fireHistory(history, cameraObservedAt) {
  if (!history) return [];
  const items = [];
  if (history.a5km) {
    items.push({
      id: 'hs-5km',
      radiusKm: 5,
      eventAtUTC: history.a5km,
      provenance: PROVENANCE.HINDSIGHT_REPLAY,
      note: 'Incendio histórico dentro de 5 km. NO es la escena observada por la cámara.',
    });
  }
  if (history.a3km) {
    items.push({
      id: 'hs-3km',
      radiusKm: 3,
      eventAtUTC: history.a3km,
      provenance: PROVENANCE.HINDSIGHT_REPLAY,
      note: 'Incendio histórico dentro de 3 km. NO es la escena observada por la cámara.',
    });
  }
  return items.map((item) => ({
    ...item,
    cameraObservedAtUTC: cameraObservedAt,
    timeSeparation: 'La cámara y el incendio pertenecen a fechas distintas.',
  }));
}

function metric(key, label, value, unit, uncertainty) {
  const present = value !== null && value !== undefined && Number.isFinite(Number(value));
  return {
    key,
    label,
    value: present ? Number(value) : null,
    unit,
    uncertainty: uncertainty ?? null,
    provenance: present ? PROVENANCE.MODEL_DERIVED_REAL_INPUT : PROVENANCE.MISSING_DATA,
  };
}

export function buildTimeline(cameraGroups) {
  const events = [];
  for (const group of cameraGroups) {
    const zones = [...new Set(group.cameras.map((c) => c.zone).filter(Boolean))];
    events.push({
      id: `obs:${group.dataset}`,
      kind: 'observation',
      atUTC: group.observedAtUTC,
      title: `${group.dataset.toUpperCase()} — captura real de ${group.cameras.length} cámara(s)`,
      detail: zones.length ? `Zonas: ${zones.join(', ')}` : group.sourceNote,
      provenance: PROVENANCE.MODEL_DERIVED_REAL_INPUT,
      count: group.cameras.length,
    });
    for (const camera of group.cameras) {
      for (const history of camera.fireHistory) {
        events.push({
          id: `${camera.id}:${history.id}`,
          kind: 'history',
          atUTC: history.eventAtUTC,
          title: `Replay histórico: incendio a ${history.radiusKm} km de ${camera.name}`,
          detail: history.note,
          provenance: PROVENANCE.HINDSIGHT_REPLAY,
        });
      }
    }
  }
  return events.sort((a, b) => String(b.atUTC ?? '').localeCompare(String(a.atUTC ?? '')));
}

export function buildEvidenceBundle({ registry, tfl, caltrans, estado, manifest }) {
  const camTfl = adaptTfl(tfl);
  const camCal = adaptCaltrans(caltrans);
  const cameras = [...camTfl.cameras, ...camCal.cameras];
  return {
    registry: adaptRegistry(registry),
    cameraGroups: [camTfl, camCal],
    cameras,
    timeline: buildTimeline([camTfl, camCal]),
    status: {
      provenance: PROVENANCE.REAL_MEASUREMENT,
      coreTests: estado?.core ?? null,
      coreTestsTotal: estado?.coreTotal ?? null,
      e2eTests: estado?.e2e ?? null,
      e2eTestsTotal: estado?.e2eTotal ?? null,
      relayTests: estado?.relay ?? null,
      recordedSha: estado?.sha ?? null,
      generatedAtUTC: estado?.generatedAt ?? null,
    },
    manifest: manifest ?? null,
  };
}

/**
 * RF capabilities are reported from the physical reality, not from UI wishes.
 * Without an authorised instrument on site, every life-sign capability is
 * NOT_AVAILABLE_NO_HARDWARE. The architectural x-ray is a B3/BIM viewer only.
 */
export function getRfCapabilities() {
  return [
    {
      id: 'xray-architecture',
      name: 'X-Ray Architecture',
      kind: 'BIM/IFC 3D viewer',
      status: 'ARCHITECTURE_VIEWER_ONLY',
      statement:
        'Secciones 3D transparentes del modelo de edificio autorizado (IFC/BIM). NO detecta personas ni objetos tras paredes.',
      requiresHardware: false,
      requiresConsent: true,
    },
    {
      id: 'uwb-life-signs',
      name: 'RF Life-Signs (UWB)',
      kind: 'instrumental research',
      status: 'NOT_AVAILABLE_NO_HARDWARE',
      statement:
        'Requiere radar UWB/Zimmer de autoría, SDK con licencia y autorización del recinto. Sin instrumento y medición calibrada no se muestra nada.',
      requiresHardware: true,
      requiresConsent: true,
    },
    {
      id: 'mmwave-life-signs',
      name: 'RF Life-Signs (mmWave)',
      kind: 'instrumental research',
      status: 'NOT_AVAILABLE_NO_HARDWARE',
      statement: 'Requiere sensor mmWave con SDK y consentimiento explícito. No hay sensor en esta instalación.',
      requiresHardware: true,
      requiresConsent: true,
    },
    {
      id: 'sdr-passive',
      name: 'SDR passive survey',
      kind: 'instrumental research',
      status: 'NOT_AVAILABLE_NO_HARDWARE',
      statement: 'Requiere SDR conectado y permiso de espectro. Sin medición real no se generan lecturas.',
      requiresHardware: true,
      requiresConsent: true,
    },
  ];
}

/**
 * Simulation is quarantined: it never enters the observation table. The tag
 * SIMULATOR travels with every value so no consumer can mistake it for a real
 * measurement.
 */
export function buildSimulationScenario({ seconds = 60, intensity = 0.5, seed = 20261106 } = {}) {
  let x = seed >>> 0;
  const rand = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0xffffffff;
  };
  const points = [];
  for (let t = 0; t <= seconds; t += 5) {
    const wave = 0.5 + 0.5 * Math.sin((t / seconds) * Math.PI * 2);
    const value = Math.max(0, Math.round((wave * 40 + rand() * 20) * intensity));
    points.push({ t, value });
  }
  return {
    id: 'sim:traffic',
    name: 'Escenario de tráfico sintético',
    provenance: PROVENANCE.SIMULATOR,
    warning: 'DATOS SINTÉTICOS. Aislado de las observaciones reales. No usar para decidir.',
    unit: 'veh/min',
    points,
  };
}

export function assertProvenanceSeparation(bundle) {
  const realIds = new Set(bundle.cameras.map((c) => c.id));
  const sim = buildSimulationScenario({ seconds: 10 });
  return {
    ok: sim.provenance === PROVENANCE.SIMULATOR && !realIds.has(sim.id),
    realCameraCount: realIds.size,
    simulationProvenance: sim.provenance,
  };
}

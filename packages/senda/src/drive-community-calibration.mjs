/**
 * SENDA · Comunicación Directa/Indirecta de Entorno y Calibración Comunitaria (0 €, 0 PII, 100 % local).
 *
 * Resuelve dos problemas críticos de despliegue real mientras crece el mallado de usuarios:
 *  1. Traducción clara a lenguaje humano de señales físicas y de radio (RSSI, EKF, Kamm, NASA Vp,
 *     Shand, LWR) para que cualquier conductor o peatón entienda en < 2 s qué pasa y qué hacer.
 *  2. Comunicación híbrida:
 *     - DIRECTA (con móviles SENDA cercanos sin Internet): paquete compacto C-ITS DENM (36 B, CRC-16)
 *       listo para Bluetooth/malla y confirmación comunitaria bayesiana («Sigue ahí» / «Ya despejado»).
 *     - INDIRECTA (con personas que AÚN NO tienen SENDA): lectura pasiva anónima del entorno
 *       (0 MACs/SSIDs) + tarjetas claras compartibles por SMS/WhatsApp/AirDrop/voz con enlace web sin app.
 *  3. Bucle de calibración voluntaria en 1 toque: recoge verdad terreno (firme real, veracidad de
 *     avisos, sombra celular, modo coche/pie y encuentros BLE) y sella paquetes agregados SHA-256
 *     (0 PII, sin rutas personales) para calibrar umbrales en futuras versiones.
 */

import { sendaToDenm, encodeDenmCompact } from './cits-denm.mjs';
import { observe, hazardBelief } from './hazard-belief.mjs';

export const QUICK_CAR_SIGNALS = Object.freeze({
  retencion: Object.freeze({
    id: 'retencion',
    kind: 'retencion',
    label: 'Retención',
    shortAction: 'Avisa de atasco o frenazo',
    urgency: 'AMBAR',
    humanSummary: 'Retención o circulación detenida en la calzada',
  }),
  agua: Object.freeze({
    id: 'agua',
    kind: 'inundacion',
    label: 'Agua / Balsa',
    shortAction: 'Calzada inundada o balsa profunda',
    urgency: 'ROJO',
    humanSummary: 'Agua acumulada en la calzada con riesgo de deslizamiento o arrastre',
  }),
  niebla: Object.freeze({
    id: 'niebla',
    kind: 'niebla',
    label: 'Niebla densa',
    shortAction: 'Visibilidad muy reducida',
    urgency: 'AMBAR',
    humanSummary: 'Banco de niebla o humo denso con visibilidad muy reducida',
  }),
  obstaculo: Object.freeze({
    id: 'obstaculo',
    kind: 'obstaculo',
    label: 'Obstáculo',
    shortAction: 'Objeto, desprendimiento o animal',
    urgency: 'ROJO',
    humanSummary: 'Obstáculo inesperado en el carril',
  }),
  parado: Object.freeze({
    id: 'parado',
    kind: 'parado',
    label: 'Coche parado',
    shortAction: 'Vehículo inmovilizado en arcén o vía',
    urgency: 'AMBAR',
    humanSummary: 'Vehículo detenido o averiado junto a la calzada',
  }),
  ayuda: Object.freeze({
    id: 'ayuda',
    kind: 'accidente',
    label: 'Necesito ayuda',
    shortAction: 'Incidente o asistencia en ruta (llama 112 si es urgente)',
    urgency: 'ROJO',
    humanSummary: 'Persona o vehículo solicitando ayuda en carretera (si hay riesgo vital, llama al 112)',
  }),
});

/** Traduce un nivel RSSI (dBm) a distancia orientativa y claridad de enlace en lenguaje cotidiano. */
export function describeSignalProximity(rssiDbm) {
  if (rssiDbm == null || !Number.isFinite(rssiDbm)) {
    return Object.freeze({
      band: 'SIN_SENAL',
      label: 'Sin señal medida',
      approxRangeM: null,
      qualityPct: 0,
      basis: 'NO_DATA',
    });
  }
  if (rssiDbm >= -60) {
    return Object.freeze({
      band: 'MUY_CERCA',
      label: 'Muy cerca (~5–25 m · señal fuerte)',
      approxRangeM: '5–25 m',
      qualityPct: 95,
      basis: 'HEURISTIC_RSSI',
    });
  }
  if (rssiDbm >= -75) {
    return Object.freeze({
      band: 'CERCA',
      label: 'Cerca (~25–75 m · enlace estable)',
      approxRangeM: '25–75 m',
      qualityPct: 72,
      basis: 'HEURISTIC_RSSI',
    });
  }
  if (rssiDbm >= -88) {
    return Object.freeze({
      band: 'LIMITE',
      label: 'Al límite (~75–150 m · señal débil)',
      approxRangeM: '75–150 m',
      qualityPct: 38,
      basis: 'HEURISTIC_RSSI',
    });
  }
  return Object.freeze({
    band: 'MUY_LEJOS',
    label: 'Muy débil (> 150 m o con obstáculos)',
    approxRangeM: '> 150 m',
    qualityPct: 14,
    basis: 'HEURISTIC_RSSI',
  });
}

/**
 * Traduce el estado técnico del Copiloto 5D, EKF y entorno radio a mensajes claros y accionables
 * en español llano, aptos para móvil y salpicadero en < 2 segundos de lectura.
 */
export function translateCopilotForHumans({
  copilotResult,
  ekfView = null,
  radioScan = null,
  officialNearbyCount = 0,
}) {
  if (!copilotResult || !copilotResult.grip) {
    throw new TypeError('translateCopilotForHumans requiere copilotResult con bloque grip');
  }
  const { grip, curves, crossing, queue, shadowConvoy, fatigue, primaryAlert } = copilotResult;
  const speed = Math.round(grip.speedKmh);
  const recMax = copilotResult.recommendedMaxKmh != null ? Math.round(copilotResult.recommendedMaxKmh) : null;

  // 1. Traducción clara del aviso principal (qué pasa + qué hacer + por qué en 1 frase)
  let headline = 'Conducción dentro de margen seguro';
  let action = 'Mantén velocidad suave y distancia de seguridad';
  let explanation = `Tienes un ${Math.round(grip.gripReservePct)} % de agarre libre y frenarías en ${Math.round(grip.stoppingDistM)} m.`;
  let tone = 'VERDE';

  if (crossing?.doNotCross) {
    tone = 'ROJO';
    headline = 'No cruces: tramo peligroso por agua o fuego';
    action = 'Detente antes del paso y busca una ruta alternativa';
    explanation = crossing.reasons[0] || 'El calado o el humo superan el límite seguro de tu vehículo.';
  } else if (primaryAlert?.id === 'HYDROPLANING_OR_GRIP') {
    tone = 'ROJO';
    headline = 'Riesgo de deslizar sobre el agua';
    action = recMax != null ? `Levanta el pie sin frenazos hasta ${recMax} km/h` : 'Levanta el acelerador suavemente sin frenar brusco';
    explanation = `A ${speed} km/h puedes flotar sobre la balsa (límite ~${Math.round(grip.hydroplaningCriticalKmh)} km/h) y necesitarías ${Math.round(grip.stoppingDistM)} m para parar.`;
  } else if (primaryAlert?.id === 'QUEUE_TAIL_SHOCKWAVE' && queue?.queueForming) {
    tone = primaryAlert.severity === 'ROJO' ? 'ROJO' : 'AMBAR';
    headline = `Retención acercándose en ${Math.round(queue.interceptDistM)} m`;
    action = recMax != null ? `Reduce ya a ${recMax} km/h y enciende atención` : 'Reduce velocidad progresivamente antes de llegar a la cola';
    explanation = `La cola crece hacia ti a ${Math.abs(queue.shockwaveKmh).toFixed(0)} km/h; llegarás en ~${Math.round(queue.interceptTimeS)} s.`;
  } else if (primaryAlert?.id === 'CURVE_BRAKE_NOW' && curves?.topCurve) {
    tone = 'ROJO';
    headline = `Curva cerrada a la ${curves.topCurve.direction.toLowerCase()} en ${Math.round(curves.topCurve.entryAheadM)} m`;
    action = `Frena en recta hasta ${Math.round(curves.topCurve.safeSpeedKmh)} km/h`;
    explanation = `Radio estimado ${Math.round(curves.topCurve.minRadiusM)} m; frenar antes de girar conserva el agarre de las ruedas.`;
  } else if (primaryAlert?.id === 'FOG_OVERDRIVING') {
    tone = 'AMBAR';
    headline = 'Vas más rápido de lo que alcanzas a ver';
    action = recMax != null ? `Baja a ${recMax} km/h para poder frenar a tiempo` : 'Reduce velocidad hasta igualar tu visibilidad';
    explanation = `Ves a ${Math.round(grip.visibilityM)} m, pero a ${speed} km/h necesitas ${Math.round(grip.stoppingDistM)} m para detenerte.`;
  } else if (primaryAlert?.id === 'CONVOY_STOPPED') {
    tone = 'AMBAR';
    headline = primaryAlert.title;
    action = 'Comprueba el estado del vehículo acompañante cuando sea seguro';
    explanation = 'Detectado por enlace cercano Bluetooth sin necesidad de cobertura móvil.';
  } else if (primaryAlert?.id === 'CURVE_COAST_EARLY' && curves?.topCurve) {
    tone = 'AMBAR';
    headline = `Curva a la ${curves.topCurve.direction.toLowerCase()} en ${Math.round(curves.topCurve.entryAheadM)} m`;
    action = `Suelta el acelerador hacia ${Math.round(curves.topCurve.safeSpeedKmh)} km/h`;
    explanation = `Anticipar suavemente evita frenazos dentro de la curva (radio ${Math.round(curves.topCurve.minRadiusM)} m).`;
  } else if (primaryAlert?.id === 'SHADOW_ZONE_PREP' && shadowConvoy?.upcomingShadow) {
    tone = 'VERDE';
    headline = `Zona sin cobertura en ${Math.round(shadowConvoy.upcomingShadow.distAheadM)} m`;
    action = 'SENDA ya ha guardado avisos y activado guía por sensores';
    explanation = `${shadowConvoy.upcomingShadow.name}: seguirás asistido aunque desaparezca el GPS o el 4G.`;
  } else if (primaryAlert?.id === 'DRIVER_FATIGUE' && fatigue) {
    tone = fatigue.level === 'CRITICAL_STOP_NOW' ? 'ROJO' : 'AMBAR';
    headline = `Fatiga detectada (${Math.round(fatigue.continuousDriveMin)} min seguidos)`;
    action = 'Para 15 minutos en la próxima área de servicio';
    explanation = fatigue.circadianWindow !== 'NORMAL'
      ? 'Horario de mayor somnolencia natural y pequeñas correcciones en la trayectoria (sin cámara ni biometría).'
      : 'Superas el tiempo recomendado sin descanso (DGT / 2 h).';
  }

  // 2. Canal DIRECTO (móviles SENDA y convoy BLE cercano)
  const sendaPeers = Math.max(
    radioScan?.sendaNear ?? 0,
    shadowConvoy?.convoyCount ?? 0,
  );
  const bestSendaRssi = radioScan?.bleBestDbm ?? (shadowConvoy?.convoyCount > 0 ? -74 : null);
  const directProximity = describeSignalProximity(sendaPeers > 0 ? bestSendaRssi : null);
  const directChannel = Object.freeze({
    activePeers: sendaPeers,
    statusLabel: sendaPeers > 0
      ? `${sendaPeers} dispositivo${sendaPeers > 1 ? 's' : ''} SENDA cerca`
      : 'Sin otros móviles SENDA cerca ahora',
    detail: sendaPeers > 0
      ? `${directProximity.label} · avisos directos por Bluetooth sin consumir datos`
      : 'Tu buzón cercano queda a la escucha: en cuanto pase otro conductor con SENDA, intercambiaréis avisos automáticamente.',
    proximity: directProximity,
    convoyAlerts: shadowConvoy?.convoyAlerts ?? [],
  });

  // 3. Canal INDIRECTO (entorno pasivo sin exigir que otros tengan SENDA — 0 PII)
  const wifiN = Number.isFinite(radioScan?.wifiN) ? radioScan.wifiN : 0;
  const bleN = Number.isFinite(radioScan?.bleN) ? radioScan.bleN : 0;
  const totalPassive = wifiN + bleN;
  let densityLabel = 'Entorno sin barrido activo';
  let densityDetail = 'Activa el barrido en Android o usa los avisos compartibles para alertar a personas sin SENDA.';
  let meshOpportunity = 'MEDIA';
  if (radioScan) {
    if (totalPassive >= 25) {
      densityLabel = `Entorno muy concurrido (~${totalPassive} señales pasivas)`;
      densityDetail = `${wifiN} redes Wi-Fi y ${bleN} aparatos Bluetooth alrededor (0 identificadores guardados). Alto potencial de mallado en cuanto se sumen usuarios.`;
      meshOpportunity = 'ALTA';
    } else if (totalPassive >= 6) {
      densityLabel = `Tráfico o entorno moderado (~${totalPassive} señales pasivas)`;
      densityDetail = `${wifiN} Wi-Fi y ${bleN} Bluetooth cercanos (anónimo). Buen margen para enlaces de cruce entre coches.`;
      meshOpportunity = 'MEDIA';
    } else {
      densityLabel = `Carretera abierta o aislada (${totalPassive} señales pasivas)`;
      densityDetail = 'Poca densidad alrededor: SENDA prioriza modo autónomo, fuentes oficiales en caché y avisos compartibles por SMS/voz.';
      meshOpportunity = 'BAJA';
    }
  }

  const indirectChannel = Object.freeze({
    wifiPassiveCount: wifiN,
    blePassiveCount: bleN,
    officialNearbyCount,
    densityLabel,
    densityDetail,
    meshOpportunity,
    canShareWithoutApp: true,
    privacyGuarantee: '0 MACs, 0 nombres de red, 0 datos personales almacenados.',
  });

  // 4. Traducción llana de sensores (qué está midiendo el móvil ahora)
  const gpsHuman = !ekfView
    ? { label: 'Sin señal GPS', detail: 'Esperando satélite o en demostración' }
    : String(ekfView.mode || '').includes('DEAD_RECKONING')
      ? { label: 'Sin GPS · guiado por sensores', detail: `Margen estimado ±${Math.round(ekfView.sigmaM ?? 0)} m dentro de túnel/sombra` }
      : ekfView.sigmaM != null && ekfView.sigmaM <= 10
        ? { label: 'GPS muy fiable', detail: `Precisión ±${Number(ekfView.sigmaM).toFixed(1)} m en vía abierta` }
        : { label: 'GPS con reflejos', detail: `Precisión ±${Math.round(ekfView.sigmaM ?? 15)} m (posible cañón urbano)` };

  const gripHuman = grip.gripReservePct <= 15
    ? { label: 'Agarre crítico', detail: `Solo ${Math.round(grip.gripReservePct)} % libre · riesgo de patinar` }
    : grip.gripReservePct <= 50
      ? { label: 'Agarre reducido', detail: `${Math.round(grip.gripReservePct)} % libre · conduce con suavidad` }
      : { label: 'Buen agarre', detail: `${Math.round(grip.gripReservePct)} % libre · frenada en ${Math.round(grip.stoppingDistM)} m` };

  return Object.freeze({
    tone,
    headline,
    action,
    explanation,
    speedKmh: speed,
    recommendedMaxKmh: recMax,
    stoppingDistM: Math.round(grip.stoppingDistM),
    gripReservePct: Math.round(grip.gripReservePct),
    directChannel,
    indirectChannel,
    sensorSummary: Object.freeze({
      gps: gpsHuman,
      grip: gripHuman,
      visibility: grip.visibilityM != null
        ? { label: `Visibilidad ${Math.round(grip.visibilityM)} m`, detail: grip.overdrivingVisibility ? `Máx seguro ${Math.round(grip.maxSafeVisibilitySpeedKmh)} km/h` : 'Dentro del alcance visual' }
        : { label: 'Visibilidad no indicada', detail: 'Ajusta si hay niebla o lluvia' },
    }),
  });
}

/**
 * Compone simultáneamente:
 *  - Un paquete DIRECTO C-ITS DENM compacto (36 B con CRC-16) para malla BLE SENDA-a-SENDA.
 *  - Un mensaje INDIRECTO en lenguaje claro para personas sin SENDA (WhatsApp, SMS, AirDrop, voz).
 *  - Un registro comunitario con creencia bayesiana inicial (confirmable por otros conductores).
 */
export function composeProximityMessage({
  signalId,
  pos = null, // { lat, lon } opcional
  speedKmh = null,
  recommendedMaxKmh = null,
  roadHint = '',
  nowMs = Date.now(),
}) {
  const spec = QUICK_CAR_SIGNALS[signalId];
  if (!spec) throw new RangeError(`signalId desconocido: ${signalId}`);

  const hasCoords = pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon);
  let denmBytes = null;
  let denmBase64 = null;
  if (hasCoords) {
    const denm = sendaToDenm({
      kind: spec.kind,
      lon: pos.lon,
      lat: pos.lat,
      tMs: nowMs,
    });
    denmBytes = encodeDenmCompact(denm);
    let bin = '';
    for (let i = 0; i < denmBytes.length; i++) bin += String.fromCharCode(denmBytes[i]);
    denmBase64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(denmBytes).toString('base64');
  }

  const placeText = roadHint
    ? ` en ${roadHint}`
    : hasCoords
      ? ` cerca de ${pos.lat.toFixed(4)}, ${pos.lon.toFixed(4)}`
      : '';
  const speedAdvice = recommendedMaxKmh != null
    ? ` Velocidad segura orientativa: máx. ${Math.round(recommendedMaxKmh)} km/h.`
    : '';
  const sosNote = spec.id === 'ayuda' || spec.urgency === 'ROJO'
    ? ' Si hay riesgo vital llama al 112.'
    : '';

  const indirectShareText = `⚠️ Aviso vial SENDA (${spec.label}): ${spec.humanSummary}${placeText}.${speedAdvice}${sosNote} Ver o avisar sin instalar app: /senda/reportar`;
  const voiceAnnouncement = `Aviso enviado: ${spec.label}. ${spec.humanSummary}.`;

  // Registro inicial compatible con hazard-belief.mjs (confirmable por otros conductores)
  const baseEntry = {
    id: `sig_${nowMs}_${spec.id}`,
    signalId: spec.id,
    kind: spec.kind,
    label: spec.label,
    urgency: spec.urgency,
    t: nowMs,
    text: `${spec.label}${placeText}`,
    seen: [],
    gone: [],
    directBytes: denmBytes ? denmBytes.length : 0,
  };
  const b0 = hazardBelief(baseEntry, nowMs);
  const communityEntry = Object.freeze({
    ...baseEntry,
    confirmations: b0.confirmations,
    negations: b0.denials,
    confidencePct: Math.round(b0.p * 100),
    trustLabel: `Recién avisado (${Math.round(b0.p * 100)} % · espera confirmación)`,
  });

  return Object.freeze({
    spec,
    direct: Object.freeze({
      protocol: 'ETSI_CITS_DENM_COMPACT_36B',
      ready: denmBytes != null,
      byteLength: denmBytes ? denmBytes.length : 0,
      base64: denmBase64,
      humanHint: denmBytes
        ? `Paquete directo listo (${denmBytes.length} bytes con CRC-16 · se difunde por Bluetooth cercano sin red)`
        : 'Sin posición GPS: se comparte por canal indirecto (texto/voz) hasta fijar ubicación.',
    }),
    indirect: Object.freeze({
      title: `Aviso SENDA · ${spec.label}`,
      shareText: indirectShareText,
      voiceAnnouncement,
      requiresAppOnReceiver: false,
    }),
    communityEntry,
  });
}

/** Aplica un voto humano («Sigue ahí» / «Ya despejado») y traduce la probabilidad bayesiana a texto claro. */
export function voteCommunitySignal(entry, vote /* 'conf' | 'neg' */, nowMs = Date.now()) {
  if (!entry || !['conf', 'neg'].includes(vote)) {
    throw new RangeError('voteCommunitySignal requiere entry y vote ("conf"|"neg")');
  }
  const updated = observe(entry, vote, nowMs);
  const b = hazardBelief(updated, nowMs);
  const pct = Math.round(b.p * 100);
  const trustLabel = pct >= 80
    ? `Muy fiable (${pct} %)`
    : pct >= 55
      ? `Probable (${pct} %)`
      : `En duda / posiblemente despejado (${pct} %)`;
  return Object.freeze({
    ...updated,
    confirmations: b.confirmations,
    negations: b.denials,
    confidencePct: pct,
    trustLabel,
  });
}

/**
 * Colector de calibración en 1 toque (0 PII, sin rutas personales) para madurar SENDA
 * desde valores iniciales publicados hasta parámetros calibrados en carretera real.
 */
export function createCalibrationJournal({
  targets = { alertFeedback: 20, roadChecks: 15, coverageOrMode: 10, bleEncounters: 10 },
} = {}) {
  const entries = [];
  const counts = {
    alertAcierto: 0,
    alertTarde: 0,
    alertFalsaAlarma: 0,
    roadChecks: 0,
    coverageConRed: 0,
    coverageSinRed: 0,
    modeEnCoche: 0,
    modePieOParado: 0,
    bleEncounters: 0,
  };
  const roadByKind = {};
  const bleRttSamplesMs = [];

  function recordGroundTruth({ category, value, context = {}, nowMs = Date.now() }) {
    const allowed = {
      alert_feedback: ['acierto', 'tarde', 'falsa_alarma'],
      road_condition: ['seco', 'mojado', 'balsas', 'baches', 'nieve_hielo'],
      coverage_check: ['con_red', 'sin_red'],
      drive_mode_truth: ['en_coche', 'parado_o_pie'],
      ble_encounter: ['ok', 'perdido'],
    };
    if (!allowed[category] || !allowed[category].includes(value)) {
      throw new RangeError(`Etiqueta de calibración no válida: ${category}=${value}`);
    }

    // Solo guardamos magnitudes físicas agregables (0 PII, 0 coordenadas, 0 MACs)
    const cleanCtx = {
      speedKmh: Number.isFinite(context.speedKmh) ? +Number(context.speedKmh).toFixed(1) : null,
      effectiveMu: Number.isFinite(context.effectiveMu) ? +Number(context.effectiveMu).toFixed(2) : null,
      sigmaPosM: Number.isFinite(context.sigmaPosM) ? +Number(context.sigmaPosM).toFixed(1) : null,
      rssiDbm: Number.isFinite(context.rssiDbm) ? Math.round(context.rssiDbm) : null,
      rttMs: Number.isFinite(context.rttMs) ? Math.round(context.rttMs) : null,
    };

    entries.push({ t: nowMs, category, value, ctx: cleanCtx });
    if (entries.length > 500) entries.shift();

    if (category === 'alert_feedback') {
      if (value === 'acierto') counts.alertAcierto++;
      else if (value === 'tarde') counts.alertTarde++;
      else counts.alertFalsaAlarma++;
    } else if (category === 'road_condition') {
      counts.roadChecks++;
      roadByKind[value] = (roadByKind[value] ?? 0) + 1;
    } else if (category === 'coverage_check') {
      if (value === 'con_red') counts.coverageConRed++;
      else counts.coverageSinRed++;
    } else if (category === 'drive_mode_truth') {
      if (value === 'en_coche') counts.modeEnCoche++;
      else counts.modePieOParado++;
    } else if (category === 'ble_encounter') {
      counts.bleEncounters++;
      if (cleanCtx.rttMs != null && cleanCtx.rttMs >= 0) bleRttSamplesMs.push(cleanCtx.rttMs);
    }

    return getReadinessReport();
  }

  function getReadinessReport() {
    const totalAlerts = counts.alertAcierto + counts.alertTarde + counts.alertFalsaAlarma;
    const totalCovMode = counts.coverageConRed + counts.coverageSinRed + counts.modeEnCoche + counts.modePieOParado;
    const pct = (val, target) => Math.min(100, Math.round((val / Math.max(1, target)) * 100));

    const pillars = [
      {
        id: 'alerts',
        label: 'Precisión de avisos',
        done: totalAlerts,
        target: targets.alertFeedback,
        pct: pct(totalAlerts, targets.alertFeedback),
        humanNote: totalAlerts === 0
          ? 'Valida si cada aviso acierta o llega tarde'
          : `${Math.round((counts.alertAcierto / totalAlerts) * 100)} % aciertos (${counts.alertFalsaAlarma} falsas alarmas)`,
      },
      {
        id: 'road',
        label: 'Firme real e IMU',
        done: counts.roadChecks,
        target: targets.roadChecks,
        pct: pct(counts.roadChecks, targets.roadChecks),
        humanNote: counts.roadChecks === 0
          ? 'Marca seco, mojado o balsas para ajustar adherencia'
          : `${counts.roadChecks} tramos etiquetados`,
      },
      {
        id: 'coverage',
        label: 'Sombra celular y arranque',
        done: totalCovMode,
        target: targets.coverageOrMode,
        pct: pct(totalCovMode, targets.coverageOrMode),
        humanNote: totalCovMode === 0
          ? 'Confirma zonas sin red y si vas en coche'
          : `${counts.coverageSinRed} sin red · ${counts.modeEnCoche} en coche`,
      },
      {
        id: 'mesh',
        label: 'Alcance real malla BLE',
        done: counts.bleEncounters,
        target: targets.bleEncounters,
        pct: pct(counts.bleEncounters, targets.bleEncounters),
        humanNote: counts.bleEncounters === 0
          ? 'Crece automáticamente al cruzarte con otros SENDA'
          : `${counts.bleEncounters} encuentros registrados`,
      },
    ];

    const overallPct = Math.round(pillars.reduce((s, p) => s + p.pct, 0) / pillars.length);
    const stage = overallPct >= 80 ? 'CALIBRADO_LOCAL' : overallPct > 0 ? 'EN_CALIBRACION' : 'SIN_CALIBRAR';
    const precisionPct = totalAlerts > 0 ? +((counts.alertAcierto / totalAlerts) * 100).toFixed(1) : null;
    const falseAlarmPct = totalAlerts > 0 ? +((counts.alertFalsaAlarma / totalAlerts) * 100).toFixed(1) : null;

    return Object.freeze({
      stage,
      overallPct,
      totalMarks: entries.length,
      precisionPct,
      falseAlarmPct,
      pillars: Object.freeze(pillars),
      counts: Object.freeze({ ...counts }),
      roadByKind: Object.freeze({ ...roadByKind }),
    });
  }

  /** Exporta un paquete de calibración anónimo sellado SHA-256 (0 PII, 0 coordenadas, 0 MACs). */
  async function exportCalibrationPack() {
    const readiness = getReadinessReport();
    const sortedRtt = [...bleRttSamplesMs].sort((a, b) => a - b);
    const medianRttMs = sortedRtt.length ? sortedRtt[Math.floor(sortedRtt.length / 2)] : null;
    const core = {
      schema: 'senda.community-calibration-pack/v1',
      basis: entries.length > 0 ? 'MEASURED_USER_GROUND_TRUTH' : 'UNSET',
      privacy: '0 PII · sin coordenadas GPS, sin rutas personales, sin MACs/SSIDs ni audio/vídeo',
      totalMarks: readiness.totalMarks,
      stage: readiness.stage,
      overallPct: readiness.overallPct,
      precisionPct: readiness.precisionPct,
      falseAlarmPct: readiness.falseAlarmPct,
      counts: readiness.counts,
      roadByKind: readiness.roadByKind,
      bleMedianRttMs: medianRttMs,
    };
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(core)));
    const sha256 = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
    return Object.freeze({ ...core, sha256 });
  }

  return Object.freeze({
    recordGroundTruth,
    getReadinessReport,
    exportCalibrationPack,
    getEntries: () => entries.slice(),
  });
}

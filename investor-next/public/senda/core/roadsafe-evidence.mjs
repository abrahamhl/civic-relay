/**
 * SENDA RoadSafe · Registro de evidencia y casuística de accidentes secundarios.
 *
 * Cada afirmación cuantitativa que usa RoadSafe apunta a una entrada de `EVIDENCE` con su fuente,
 * su grado y su límite de transferencia. Grados:
 *   A  varios estudios cuantitativos coherentes (dirección y magnitud)
 *   B  un estudio cuantitativo (magnitud específica de un corredor/país; transferencia incierta)
 *   C  dirección consistente en varias fuentes, magnitud no transferible
 *   E  estimación oficial sin desglose metodológico publicado
 *   H  hipótesis de diseño (sin evidencia directa)
 * Fuentes consultadas el 2026-11-17 mediante búsqueda; en varias solo se leyó el resumen o un extracto
 * (campo `access`). Nada de esto es una medida del caso de investigación.
 */

export const EVIDENCE = Object.freeze({
  DURATION_PER_MIN: {
    claim: 'Cada minuto adicional de duración del incidente aumenta la probabilidad de un incidente secundario ≈1,2 puntos porcentuales (corredor de Virginia; otros factores constantes).',
    grade: 'B', value: 0.012, unit: 'Δp por minuto', access: 'resumen/extracto',
    source: 'Khattak, Wang, Zhang (2009/2010), «Are incident durations and secondary incidents interdependent?»', url: 'https://www.researchgate.net/publication/228380158_Are_Incident_Durations_and_Secondary_Incidents_Interdependent',
    transfer: 'Magnitud propia de autopistas urbanas de EE. UU.; en España solo dirección.',
  },
  DURATION_HIGH_VOLUME: {
    claim: 'Con volumen alto, ≈1 punto porcentual más de probabilidad por cada 2–3 minutos adicionales en escena.',
    grade: 'B', access: 'resumen/extracto', source: 'Khattak et al. (mismo estudio)', url: 'https://www.researchgate.net/publication/228380158_Are_Incident_Durations_and_Secondary_Incidents_Interdependent', transfer: 'Dirección.',
  },
  LANE_BLOCKAGE: {
    claim: 'El bloqueo de carriles y su duración se asocian a más incidentes secundarios.',
    grade: 'C', access: 'extracto', source: 'Revisión «Assessing the risk of secondary crashes on highways»; VTRC 11-R11 (Virginia)', url: 'https://vtrc.virginia.gov/media/vtrc/vtrc-pdf/vtrc-pdf/11-r11.pdf', transfer: 'Dirección.',
  },
  TRAFFIC_VOLUME: {
    claim: 'Mayor flujo de tráfico aumenta la probabilidad (odds) de secundario en todos los estados analizados.',
    grade: 'C', access: 'extracto', source: 'TETC (2026), «Investigation of Factors Contributing to Secondary Crashes»', url: 'https://tetcoalition.org/wp-content/uploads/2026/01/Secondary-Crash-Factors_Final.pdf', transfer: 'Dirección.',
  },
  TOWING_REQUIRED: {
    claim: 'Más del 90 % de las colisiones secundarias analizadas se vincularon a choques primarios que requirieron grúa (Tennessee 2017–2022, >4 400 choques).',
    grade: 'B', access: 'resumen', source: 'Safety 12(2):50 (2026), «The Impact of Towing Policies on Secondary Crashes…»', url: 'https://doi.org/10.3390/safety12020050', transfer: 'Dirección: un vehículo inmovilizado que espera grúa es el contexto de mayor riesgo — exactamente el caso de investigación.',
  },
  TIMING_WINDOW: {
    claim: 'La mayoría de secundarios ocurre en los primeros ~20 minutos; el 99,9 % dentro de 4 horas (Iowa).',
    grade: 'B', access: 'resumen', source: 'Safety 12(2):50; «Mining the Characteristics of Secondary Crashes on Highways» (Iowa)', url: 'https://www.researchgate.net/publication/276168207_Mining_the_Characteristics_of_Secondary_Crashes_on_Highways', transfer: 'Dirección: el aviso temprano importa más que el tardío.',
  },
  SECONDARY_SHARE_URBAN: {
    claim: '≈7,5 % de los eventos de choque implicaron colisiones secundarias en un estudio de Manhattan; hasta 9,3 % de ellas con heridos graves o mortales.',
    grade: 'B', access: 'extracto de búsqueda (método no verificado)', source: 'Estudio Manhattan (resultado de búsqueda; ver PMC7570167 / arXiv 2402.01792)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7570167', transfer: 'Entorno urbano denso; no extrapolable a interurbanas.',
  },
  FHWA_DEFINITION: {
    claim: 'Secundario = choque dentro de la escena del original o dentro de la cola en cualquier sentido.',
    grade: 'A', access: 'extracto', source: 'FHWA-HOP-23-043 (conjunto multiestatal, 15 448 secundarios verificados)', url: 'https://ops-dr.fhwa.dot.gov/publications/fhwahop23043/fhwahop23043.pdf', transfer: 'Definición operativa adoptada por RoadSafe.',
  },
  RESPONDER_STRUCK_BY_GAP: {
    claim: 'Los atropellos de intervinientes (struck-by) no se recogen bien en los sistemas tradicionales; 505 casos verificados 2011–2021 en un conjunto compuesto.',
    grade: 'B', access: 'extracto', source: 'FHWA-HOP-23-069 (2024)', url: 'https://highways.dot.gov/media/56731', transfer: 'Justifica registrar la exposición de grúas/taxis/intervinientes en el gemelo.',
  },
  QUEUE_WARNING_44: {
    claim: 'Aviso de final de cola (con bandas sonoras portátiles) en la I-35 de Texas: −44 % de choques respecto al contrafactual.',
    grade: 'B', access: 'resumen', source: 'Ullman, Iragavarapu, Brydia — Transportation Research Record; FHWA-HRT-25-049 (síntesis)', url: 'https://highways.dot.gov/sites/fhwa.dot.gov/files/FHWA-HRT-25-049.pdf', transfer: 'Zona de obras con avisos físicos en vía, no avisos en el móvil; techo de referencia, no expectativa para apps.',
  },
  LIVE_LANE_DETECTION: {
    claim: 'Sin detección automática, encontrar un vehículo parado en carril vivo tardaba de media ~17 min (Highways England, 2016); objetivo SVD <20 s y 3 min para cerrar carril (cruz roja).',
    grade: 'B', access: 'prensa especializada', source: 'AA / Highways Magazine sobre informe de Highways England; ORR', url: 'https://www.theaa.com/about-us/newsroom/news/17-minutes-to-spot-a-live-lane-breakdown-on-smart-motorways', transfer: 'Orden de magnitud del valor de una detección temprana (V16 conectada + declaración del afectado).',
  },
  ES_PEDESTRIANS_AFTER_EXIT: {
    claim: 'La DGT estima ≈25 peatones fallecidos al año tras bajar del vehículo en carretera (otro documento DGT: media 22/año 2019–2022) sin desglose metodológico publicado; no hay estudio riguroso del efecto de la V16.',
    grade: 'E', access: 'nota de prensa DGT + verificación periodística', source: 'DGT (nota 25-11-2025); Maldita.es (23-12-2025)', url: 'https://maldita.es/malditobulo/20251223/no-hay-estudios-que-confirmen-que-hay-25-muertos-al-ano-por-colocar-triangulos-en-carretera/', transfer: 'Prioriza la exposición de personas fuera del vehículo; no permite estimar eficacia.',
  },
  MUTCD_TTC_AREAS: {
    claim: 'Zona temporal: área de aviso anticipado, transición, actividad (resguardo + espacio del incidente) y terminación; en carreteras abiertas el aviso anticipado suele ser ≥450 m (1 500 ft).',
    grade: 'A', access: 'extractos MUTCD 2003/2009 (Cap. 6C y 6I)', source: 'FHWA MUTCD Part 6', url: 'https://mutcd.fhwa.dot.gov/htm/2009/part6/part6_toc.htm', transfer: 'Marco conceptual; en España rige la Instrucción 8.3-IC y la regulación de la DGT (valores NO incorporados).',
  },
  PRT_GREEN_2000: {
    claim: 'Tiempo de percepción-reacción: ≈0,7–0,75 s prevenido, ≈1,25 s inesperado, ≈1,5 s sorpresa.',
    grade: 'A', access: 'conocimiento previo (no releído hoy)', source: 'Green, M. (2000). Transportation Human Factors 2(3):195–216', url: null, transfer: 'Rangos usados en el simulador.',
  },
  EMPIRICAL_DARK_SEVERITY: {
    claim: 'Entre accidentes con víctimas de 2024, la oscuridad se asocia a ≈1,5–1,7 veces más odds de desenlace mortal, replicado en cinco países: ES 1,60 [1,44–1,78], DE 1,55 [1,42–1,70], NL 1,50 [1,24–1,82], FR 1,51 [1,40–1,63], GB 1,68 [1,51–1,86]. Sin alumbrado vs con alumbrado: ES 3,42, FR 4,27, GB 2,95.',
    grade: 'A', value: 1.55, unit: 'OR gravedad condicionada', access: 'microdatos oficiales procesados por SENDA (evidence/roadsafe/dataset/DATASET_REPORT_2024.md)',
    source: 'DGT microdatos 2024; Unfallatlas 2024 (dl-de/by-2-0); BRON 2024 (CC0); BAAC 2024 (Licence Ouverte); STATS19 2024 (OGL v3)', url: 'https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/',
    transfer: 'Gravedad condicionada (sin exposición): no dice que de noche haya más accidentes, sino que los que hay son más graves.',
  },
  EMPIRICAL_SHOULDER_SEVERITY: {
    claim: 'Accidentes en el arcén / banda de emergencia vs resto: OR de desenlace mortal 2,04 [1,42–2,94] en Francia (situ=2, 291 accidentes, 11,3 % mortales) y 2,44 [1,65–3,62] en Gran Bretaña (lay-by/hard shoulder, 738 accidentes).',
    grade: 'A', value: 2.0, unit: 'OR gravedad condicionada', access: 'microdatos oficiales procesados por SENDA', source: 'BAAC 2024 (ONISR); STATS19 2024 (DfT)', url: 'https://www.data.gouv.fr/datasets/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024',
    transfer: 'Respalda el caso de investigación: un accidente en el arcén es, en proporción, el doble de mortal.',
  },
  EMPIRICAL_ADJUSTED_SEVERITY_MODEL: {
    claim: 'Regresión logística multivariante sobre 551 260 accidentes con víctimas (ES/DE/NL/FR/GB 2024, efectos fijos por país): AUC de prueba 0,78. OR ajustados: oscuridad 1,17 [1,10–1,26], sin alumbrado ×1,54 [1,41–1,69], madrugada 0–6 h 1,49 [1,37–1,62], arcén 1,55 [1,13–2,13], interurbano 3,49, vehículo pesado 4,02, frontal 2,98, peatón 2,56, salida de vía 2,03; mojado 0,87 y alcance/cadena 0,56 (menos graves).',
    grade: 'A', value: null, unit: 'OR ajustados (gravedad condicionada)', access: 'calculado por este código: evidence/roadsafe/dataset/severity-model-2024.json', source: 'DGT, Unfallatlas, BRON, BAAC, STATS19 (2024)', url: null,
    transfer: 'Dejar un país fuera: AUC 0,61–0,76; los niveles absolutos difieren entre países (definiciones y coberturas) ⇒ usar con efecto fijo del país.',
  },
  EMPIRICAL_WET_SEVERITY: {
    claim: 'Calzada mojada vs seca: sin diferencia significativa en ES (0,88), DE (1,02), NL (0,95) y FR (0,99); en GB sí (1,22 [1,09–1,36]). Resultado mixto.',
    grade: 'A', value: 1, unit: 'OR gravedad condicionada', access: 'microdatos oficiales procesados por SENDA', source: 'DGT, Unfallatlas, BRON 2024', url: null,
    transfer: 'La lluvia actúa sobre la FRECUENCIA (adherencia, distancia de parada — física) más que sobre la gravedad.',
  },
  EMPIRICAL_RURAL_SEVERITY: {
    claim: 'Interurbano vs urbano: OR de mortal 4,61 [4,15–5,13] (ES) y 3,82 [3,21–4,55] (NL).',
    grade: 'A', value: 4.2, unit: 'OR gravedad condicionada', access: 'microdatos oficiales procesados por SENDA', source: 'DGT, BRON 2024', url: null, transfer: 'La velocidad de la vía domina la gravedad.',
  },
  NIGHT_PRT: {
    claim: 'La noche alarga la percepción de un vehículo detenido y reduce la distancia de detección.',
    grade: 'H', access: '—', source: 'Hipótesis de diseño (dirección plausible; magnitud no establecida en las fuentes consultadas)', url: null, transfer: 'Solo para barridos.',
  },
  HEAVY_VEHICLE_SEVERITY: {
    claim: 'La implicación de camiones en el choque secundario aumenta su gravedad.',
    grade: 'B', access: 'extracto', source: 'Estudio de series de choques consecutivos en autopistas (rosap.ntl.bts.gov dot_42625)', url: 'https://rosap.ntl.bts.gov/view/dot/42625/dot_42625_DS1.pdf', transfer: 'Severidad, no probabilidad.',
  },
});

/** Casuística: mecanismos de colisión secundaria y qué pieza de RoadSafe actúa sobre cada uno. */
export const CASEBOOK = Object.freeze([
  { id: 'C1_REAR_END_STOPPED_IN_LANE', title: 'Alcance a vehículo detenido en carril', mechanism: 'Velocidad alta, percepción tardía de que el vehículo está PARADO (no lento).', factors: ['carril bloqueado', 'noche', 'curva/cambio de rasante', 'velocidad', 'distracción'], evidence: ['LANE_BLOCKAGE', 'LIVE_LANE_DETECTION', 'PRT_GREEN_2000'], roadsafe: ['detección temprana (V16 + afectado)', 'zona de aviso anticipado', 'prioridad CRITICAL'], severity: 'muy alta' },
  { id: 'C2_SHOULDER_ENCROACHMENT', title: 'Invasión del arcén contra vehículo averiado', mechanism: 'Salida de trayectoria por fatiga, distracción o «atracción» de las luces.', factors: ['arcén estrecho', 'noche', 'fatiga', 'tráfico pesado'], evidence: ['TOWING_REQUIRED'], roadsafe: ['instrucciones de posición segura', 'aviso ADVISORY a conductores', 'retirada rápida (grúa)'], severity: 'alta' },
  { id: 'C3_PEDESTRIAN_AFTER_EXIT', title: 'Atropello de ocupantes fuera del vehículo', mechanism: 'Personas entre vehículos o en la calzada colocando señales o esperando.', factors: ['personas fuera', 'noche', 'sin chaleco', 'sin barrera'], evidence: ['ES_PEDESTRIANS_AFTER_EXIT'], roadsafe: ['instrucción PAS sin red', 'factor de exposición máximo en prioridad'], severity: 'muy alta' },
  { id: 'C4_ARRIVING_ASSISTANCE_BRAKING', title: 'Frenada del vehículo de asistencia que llega (caso de investigación)', mechanism: 'El taxi/grúa frena para detenerse tras el averiado; el que le sigue no lo anticipa.', factors: ['distancia de seguridad corta', 'velocidad', 'adherencia', 'llegada sin aviso'], evidence: ['TOWING_REQUIRED', 'TIMING_WINDOW'], roadsafe: ['aviso al proveedor (aproximación con intermitentes, parada aguas abajo)', 'aviso de «vehículos deteniéndose» en la zona', 'simulador A–E'], severity: 'alta' },
  { id: 'C5_PUSH_INTO_STOPPED', title: 'Empuje en cadena contra el vehículo detenido', mechanism: 'La energía del alcance desplaza al vehículo golpeado contra el averiado o las personas.', factors: ['hueco corto entre vehículos detenidos', 'masa del que impacta'], evidence: ['HEAVY_VEHICLE_SEVERITY'], roadsafe: ['recomendación de hueco/posición', 'personas fuera de la línea de empuje'], severity: 'alta' },
  { id: 'C6_QUEUE_TAIL', title: 'Alcance en el final de la cola', mechanism: 'La cola crece aguas arriba (onda de choque) hacia conductores a velocidad libre.', factors: ['volumen alto', 'duración', 'cola que crece', 'curva antes de la cola'], evidence: ['TRAFFIC_VOLUME', 'DURATION_PER_MIN', 'QUEUE_WARNING_44', 'FHWA_DEFINITION'], roadsafe: ['proyección de cola (LWR)', 'zona de aviso móvil', 'paneles PMV propuestos'], severity: 'alta' },
  { id: 'C7_RESPONDER_STRUCK', title: 'Atropello de intervinientes (grúa, taxi, patrulla)', mechanism: 'Trabajo en la escena con tráfico vivo al lado.', factors: ['sin vehículo de bloqueo', 'noche', 'duración'], evidence: ['RESPONDER_STRUCK_BY_GAP'], roadsafe: ['plan de zona con resguardo', 'registro de exposición en el gemelo'], severity: 'muy alta' },
  { id: 'C8_OPPOSITE_DIRECTION_DISTRACTION', title: 'Incidente en sentido contrario por distracción («mirones»)', mechanism: 'Atención desviada hacia la escena en la otra calzada.', factors: ['escena visible desde la otra calzada'], evidence: ['FHWA_DEFINITION'], roadsafe: ['NO avisar de la otra calzada como peligro propio (P0-2)', 'aviso informativo opcional'], severity: 'media' },
]);

export const evidenceFor = (ids) => ids.map((id) => ({ id, ...EVIDENCE[id] }));

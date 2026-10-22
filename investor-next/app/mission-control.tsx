'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getCopy, type Locale } from './copy';
import { runScenario } from '../lib/emergency-routing.mjs';
import { computeLiveOrbitalEphemeris } from '../lib/live-protocol-node.mjs';
import {
  CELESTIAL_BODIES,
  PILOT_SECTORS,
  CAMERA_SOURCES,
  EVIDENCE_LABELS,
  type CelestialBodyId
} from '../lib/sector-camera-engine.mjs';

type Scenario = 'outage' | 'intermittent' | 'restored';
const scenarioIds: Scenario[] = ['outage', 'intermittent', 'restored'];

type LayerKey = 'infrastructure' | 'incidents' | 'nodes' | 'routes' | 'cameras' | 'orbital';

export interface GlobeSelectableObject {
  id: string;
  kind: 'SECTOR' | 'GATEWAY' | 'SATELLITE' | 'CAMERA' | 'PLANET';
  title: string;
  subtitle: string;
  coordinates: [number, number];
  source: string;
  updatedAt: string;
  evidenceLabel: string;
  isSimulated: boolean;
  metrics: string;
  actionLabel: string;
  actionHref: string;
  sectorId?: string;
}

const SCENARIO_PARAMS: Record<Scenario, { damaged: number; gateway: boolean; bluetooth: boolean; wifi: boolean; battery: number }> = {
  outage: { damaged: 100, gateway: false, bluetooth: false, wifi: false, battery: 40 },
  intermittent: { damaged: 85, gateway: true, bluetooth: true, wifi: true, battery: 55 },
  restored: { damaged: 20, gateway: true, bluetooth: true, wifi: true, battery: 80 }
};

const TIMELINE_STEPS: Record<Locale, Array<{ code: string; label: string; desc: string }>> = {
  es: [
    { code: 'T+00m', label: '01 · Incidente y caída de antena', desc: 'Fallo de infraestructura en el sector seleccionado; pérdida de cobertura celular ordinaria.' },
    { code: 'T+02m', label: '02 · Consentimiento y estado humano', desc: 'Solo nodos con opt-in explícito emiten SAFE o SOS; silencio permanece como UNKNOWN.' },
    { code: 'T+04m', label: '03 · Cola local Store-and-Forward', desc: 'Con 0 rutas exteriores, los mensajes se conservan localmente con TTL=3600s y deduplicación.' },
    { code: 'T+07m', label: '04 · Selección de ruta compatible', desc: 'El «policía de tráfico» prioriza SOS_EXPLICIT y evita intermediarios con batería crítica.' },
    { code: 'T+10m', label: '05 · ACK sintético y auditoría', desc: 'Al alcanzar un gateway del modelo se registra ACK_SYNTHETIC (no equivale a despacho 112).' }
  ],
  en: [
    { code: 'T+00m', label: '01 · Incident & tower failure', desc: 'Infrastructure failure in the selected sector; loss of ordinary cellular coverage.' },
    { code: 'T+02m', label: '02 · Consent & human status', desc: 'Only explicit opt-in nodes emit SAFE or SOS; silence stays UNKNOWN.' },
    { code: 'T+04m', label: '03 · Local Store-and-Forward queue', desc: 'With 0 external routes, messages are preserved locally with TTL=3600s and deduplication.' },
    { code: 'T+07m', label: '04 · Compatible route selection', desc: 'The routing traffic-cop prioritizes SOS_EXPLICIT and skips critical-battery relays.' },
    { code: 'T+10m', label: '05 · Synthetic ACK & audit trail', desc: 'Reaching a modelled gateway produces ACK_SYNTHETIC (never a live 112 dispatch).' }
  ],
  nl: [
    { code: 'T+00m', label: '01 · Incident & mastuitval', desc: 'Infrastructuurstoring in de gekozen sector; verlies van regulier mobiel bereik.' },
    { code: 'T+02m', label: '02 · Toestemming & menselijke status', desc: 'Alleen expliciete opt-in nodes sturen SAFE of SOS; stilte blijft UNKNOWN.' },
    { code: 'T+04m', label: '03 · Lokale Store-and-Forward wachtrij', desc: 'Bij 0 externe routes blijven berichten lokaal bewaard met TTL=3600s en deduplicatie.' },
    { code: 'T+07m', label: '04 · Compatibele routekeuze', desc: 'De verkeersregelaar geeft voorrang aan SOS_EXPLICIT en spaart lege accu’s.' },
    { code: 'T+10m', label: '05 · Gesimuleerde ACK & auditlog', desc: 'Bereiken van een modelgateway geeft ACK_SYNTHETIC (geen echte 112-inzet).' }
  ]
};

const UI_TEXT: Record<Locale, {
  modeEmergency: string;
  modeSpace: string;
  view3d: string;
  view2d: string;
  flyToLabel: string;
  layersTitle: string;
  layerNames: Record<LayerKey, string>;
  controlsHint: string;
  resetCam: string;
  northUp: string;
  zoomIn: string;
  zoomOut: string;
  playTimeline: string;
  pauseTimeline: string;
  exportSeed: string;
  inspectorTitle: string;
  sourceLabel: string;
  updatedLabel: string;
  evidenceTag: string;
  openSectorCta: string;
  queuedLabel: string;
  ackLabel: string;
  sosLabel: string;
  unknownLabel: string;
  objectsBarLabel: string;
}> = {
  es: {
    modeEmergency: '🌍 Tierra · Emergencias OEP',
    modeSpace: '🪐 Space / Explore (Tierra · Luna · Marte)',
    view3d: 'Globo 3D WebGL',
    view2d: 'Mapa 2D / Ahorro',
    flyToLabel: 'Vuelo rápido (Continente → País → Sector):',
    layersTitle: 'Capas activables y evidencia:',
    layerNames: {
      infrastructure: 'Gateways / Torres (Simulado)',
      incidents: 'Sectores de Emergencia (Simulado)',
      nodes: 'Nodos SAFE/SOS/UNKNOWN (Código Real)',
      routes: 'Rutas y Cola OEP (Código Real)',
      cameras: 'Cámaras Públicas / Demo (DGT/RWS)',
      orbital: 'Órbitas Conceptuales (Investigación)'
    },
    controlsHint: 'Arrastra para girar · Rueda/Pinch para zoom · Pulsa cualquier nodo/sector/satélite en 3D o en la barra inferior',
    resetCam: 'Reiniciar vista',
    northUp: 'Norte ↑',
    zoomIn: 'Acercar +',
    zoomOut: 'Alejar −',
    playTimeline: '▶ Reproducir secuencia',
    pauseTimeline: '⏸ Pausar secuencia',
    exportSeed: '⬇ Exportar JSON semilla',
    inspectorTitle: 'FICHA DE OBJETO SELECCIONADO',
    sourceLabel: 'Fuente:',
    updatedLabel: 'Actualizado:',
    evidenceTag: 'Estado de evidencia:',
    openSectorCta: 'Abrir en Sector Intelligence / CCTV ↘',
    queuedLabel: 'En cola (QUEUED)',
    ackLabel: 'ACK sintéticos',
    sosLabel: 'SOS explícitos',
    unknownLabel: 'UNKNOWN (Sin respuesta)',
    objectsBarLabel: 'Objetos seleccionables en el globo (accesible por teclado y raycast 3D)'
  },
  en: {
    modeEmergency: '🌍 Earth · OEP Emergency Sim',
    modeSpace: '🪐 Space / Explore (Earth · Moon · Mars)',
    view3d: '3D WebGL Globe',
    view2d: '2D Map / Battery Saver',
    flyToLabel: 'Quick Fly-To (Continent → Country → Sector):',
    layersTitle: 'Toggleable layers & evidence:',
    layerNames: {
      infrastructure: 'Gateways / Towers (Simulated)',
      incidents: 'Emergency Sectors (Simulated)',
      nodes: 'SAFE/SOS/UNKNOWN Nodes (Real Code)',
      routes: 'OEP Routes & Queue (Real Code)',
      cameras: 'Public / Demo Cameras (DGT/RWS)',
      orbital: 'Conceptual Orbits (Research)'
    },
    controlsHint: 'Drag to rotate · Wheel/Pinch to zoom · Click any 3D marker or use the accessible selector bar below',
    resetCam: 'Reset view',
    northUp: 'North ↑',
    zoomIn: 'Zoom +',
    zoomOut: 'Zoom −',
    playTimeline: '▶ Play timeline',
    pauseTimeline: '⏸ Pause timeline',
    exportSeed: '⬇ Export seed JSON',
    inspectorTitle: 'SELECTED OBJECT INSPECTOR',
    sourceLabel: 'Source:',
    updatedLabel: 'Updated:',
    evidenceTag: 'Evidence state:',
    openSectorCta: 'Open in Sector Intelligence / CCTV ↘',
    queuedLabel: 'Queued (QUEUED)',
    ackLabel: 'Synthetic ACKs',
    sosLabel: 'Explicit SOS',
    unknownLabel: 'UNKNOWN (No response)',
    objectsBarLabel: 'Selectable globe objects (keyboard & 3D raycast accessible)'
  },
  nl: {
    modeEmergency: '🌍 Aarde · OEP Noodsimulatie',
    modeSpace: '🪐 Space / Explore (Aarde · Maan · Mars)',
    view3d: '3D WebGL-globe',
    view2d: '2D-kaart / Energiebesparing',
    flyToLabel: 'Snel vliegen (Continent → Land → Sector):',
    layersTitle: 'Schakelbare lagen & bewijs:',
    layerNames: {
      infrastructure: 'Gateways / Masten (Gesimuleerd)',
      incidents: 'Noodsectoren (Gesimuleerd)',
      nodes: 'SAFE/SOS/UNKNOWN Nodes (Echte code)',
      routes: 'OEP-routes & wachtrij (Echte code)',
      cameras: 'Openbare / Demo-camera’s (DGT/RWS)',
      orbital: 'Conceptuele banen (Onderzoek)'
    },
    controlsHint: 'Sleep om te draaien · Scroll/Pinch om te zoomen · Klik op een 3D-object of gebruik de keuzebalk hieronder',
    resetCam: 'Reset weergave',
    northUp: 'Noord ↑',
    zoomIn: 'Zoom +',
    zoomOut: 'Zoom −',
    playTimeline: '▶ Speel tijdlijn',
    pauseTimeline: '⏸ Pauzeer tijdlijn',
    exportSeed: '⬇ Exporteer seed JSON',
    inspectorTitle: 'GElecteerd OBJECTDETAILS',
    sourceLabel: 'Bron:',
    updatedLabel: 'Bijgewerkt:',
    evidenceTag: 'Bewijsstatus:',
    openSectorCta: 'Open in Sector Intelligence / CCTV ↘',
    queuedLabel: 'In wachtrij (QUEUED)',
    ackLabel: 'Gesimuleerde ACKs',
    sosLabel: 'Expliciete SOS',
    unknownLabel: 'UNKNOWN (Geen reactie)',
    objectsBarLabel: 'Selecteerbare globe-objecten (toetsenbord & 3D-raycast)'
  }
};

export default function MissionControl({ locale }: { locale: Locale }) {
  const t = getCopy(locale).mission;
  const ui = UI_TEXT[locale];
  const timeline = TIMELINE_STEPS[locale];

  const [scenario, setScenario] = useState<Scenario>('outage');
  const [packets, setPackets] = useState(0);
  const [activeSectorId, setActiveSectorId] = useState<string>('SECTOR-AVILA-TIEMBLO');
  const [exploreMode, setExploreMode] = useState<'EMERGENCY' | 'SPACE'>('EMERGENCY');
  const [celestialBody, setCelestialBody] = useState<CelestialBodyId>('EARTH');
  const [force2d, setForce2d] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [timelineStep, setTimelineStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rotationLon, setRotationLon] = useState(-4.5);
  const [rotationLat, setRotationLat] = useState(40.4);
  const [zoomDist, setZoomDist] = useState(8.8);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    infrastructure: true,
    incidents: true,
    nodes: true,
    routes: true,
    cameras: true,
    orbital: true
  });

  const activeSector = useMemo(
    () => PILOT_SECTORS.find(s => s.id === activeSectorId) || PILOT_SECTORS[0],
    [activeSectorId]
  );

  // Coupled deterministic simulation result
  const simResult = useMemo(() => {
    const preset = SCENARIO_PARAMS[scenario];
    return runScenario({
      ...activeSector.defaultScenarioParams,
      damaged: preset.damaged,
      gateway: preset.gateway,
      bluetooth: preset.bluetooth,
      wifi: preset.wifi,
      battery: preset.battery,
      helpRequests: Math.min(10, (activeSector.defaultScenarioParams.helpRequests || 3) + Math.min(packets, 4))
    });
  }, [activeSector, scenario, packets]);

  const ephemeris = useMemo(
    () => computeLiveOrbitalEphemeris(1792651200000, activeSector.center[0], activeSector.center[1]),
    [activeSector]
  );

  // Build selectable 3D objects catalog linked to current simulation state
  const selectableObjects = useMemo<GlobeSelectableObject[]>(() => {
    const sectorObjs: GlobeSelectableObject[] = PILOT_SECTORS.map(sec => ({
      id: sec.id,
      kind: 'SECTOR',
      title: `${sec.name} (${sec.code})`,
      subtitle: sec.description[locale],
      coordinates: sec.center,
      source: sec.source,
      updatedAt: sec.updatedAt,
      evidenceLabel: sec.evidenceLabel,
      isSimulated: true,
      metrics:
        sec.id === activeSector.id
          ? `Nodos: ${simResult.summary.participating}/${simResult.summary.totalDevices} · SAFE: ${simResult.summary.humanSafe} · SOS: ${simResult.summary.humanSOS} · UNKNOWN: ${simResult.summary.humanUnknown} · ACK: ${simResult.summary.syntheticAcks} · Cola: ${simResult.summary.queued}`
          : `Incidente sintético: ${sec.incidentType} · Centro: ${sec.center[0].toFixed(2)}°, ${sec.center[1].toFixed(2)}°`,
      actionLabel: ui.openSectorCta,
      actionHref: '#sector-intelligence',
      sectorId: sec.id
    }));

    const gatewayObjs: GlobeSelectableObject[] = [
      {
        id: 'GW-MADRID-CENEM',
        kind: 'GATEWAY',
        title: 'Gateway Regional Iberia · Madrid (Modelo)',
        subtitle:
          scenario === 'outage'
            ? 'Pasarela desconectada en este escenario (0 rutas disponibles → mensajes en QUEUED_LOCAL).'
            : `Pasarela activa en simulación: recibe ${simResult.summary.simulatedLocalGatewayAcks} reenvíos locales y emite ACK_SYNTHETIC.`,
        coordinates: [40.4168, -3.7038],
        source: 'Motor determinista investor-next/lib/emergency-routing.mjs',
        updatedAt: '2026-10-22T06:00:00Z',
        evidenceLabel: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
        isSimulated: true,
        metrics: `Estado: ${scenario === 'outage' ? 'OFFLINE (Sin ruta)' : 'ONLINE (Simulado)'} · ACKs vía Gateway: ${simResult.summary.simulatedLocalGatewayAcks}`,
        actionLabel: 'Probar cola en Laboratorio ↘',
        actionHref: '#routing-lab'
      },
      {
        id: 'GW-BRUSSELS-ERCC',
        kind: 'GATEWAY',
        title: 'Nodo Coordinador Europeo · Bruselas (Concepto)',
        subtitle: 'Nodo de referencia para interoperabilidad civil europea (HORIZON-CL3-2026-01-SSRI-04). Sin enlace operativo real.',
        coordinates: [50.8503, 4.3517],
        source: 'Arquitectura conceptual OEP / UE',
        updatedAt: '2026-10-22T06:00:00Z',
        evidenceLabel: EVIDENCE_LABELS.RESEARCH_CONCEPT,
        isSimulated: true,
        metrics: `Rol: Agregación sintética de recibos · 112 en vivo: NO`,
        actionLabel: 'Ver arquitectura del sistema ↘',
        actionHref: '#how-it-works'
      }
    ];

    const camObjs: GlobeSelectableObject[] = CAMERA_SOURCES.filter(c => c.state === 'PUBLIC_CATALOG_VERIFIED').map(cam => ({
      id: cam.id,
      kind: 'CAMERA',
      title: `📷 ${cam.title}`,
      subtitle: `${cam.attribution} (${cam.privacyNotice})`,
      coordinates: cam.coordinates,
      source: cam.provider,
      updatedAt: cam.lastFrameAt || '2026-10-22T05:55:00Z',
      evidenceLabel: EVIDENCE_LABELS.LIVE_THIRD_PARTY,
      isSimulated: false,
      metrics: `Cono FOV estimado: ${cam.fovEstimate.azimuthDeg}° (${cam.fovEstimate.coneAngleDeg}°, ${cam.fovEstimate.rangeMeters} m, no calibrado) · Estado: ${cam.state}`,
      actionLabel: ui.openSectorCta,
      actionHref: '#sector-intelligence',
      sectorId: cam.sectorId
    }));

    const satPass = ephemeris[0];
    const satObjs: GlobeSelectableObject[] = [
      {
        id: 'SAT-LEO-CONCEPT-01',
        kind: 'SATELLITE',
        title: `🛰️ ${satPass ? satPass.name : 'LEO 3GPP NTN Concept'} (Órbita Conceptual)`,
        subtitle:
          'Efemérides keplerianas calculadas matemáticamente. Ver una órbita NO implica conexión real con el teléfono ni uplink satelital activo.',
        coordinates: [activeSector.center[0] + 8, activeSector.center[1] + 12],
        source: 'investor-next/lib/live-protocol-node.mjs (computeLiveOrbitalEphemeris)',
        updatedAt: '2026-10-22T06:00:00Z',
        evidenceLabel: EVIDENCE_LABELS.RESEARCH_CONCEPT,
        isSimulated: true,
        metrics: satPass
          ? `Altitud: ${satPass.altitudeKm} km · Elevación: ${satPass.elevationDeg}° · FSPL: ${satPass.fsplDb} dB · Uplink físico: NO PROBADO`
          : 'Altitud: 550 km · Uplink físico: NO PROBADO',
        actionLabel: 'Ver calculadora de presupuesto de enlace ↘',
        actionHref: '#telecom-rf-radar-suite'
      }
    ];

    return [...sectorObjs, ...gatewayObjs, ...camObjs, ...satObjs];
  }, [activeSector, ephemeris, locale, scenario, simResult.summary, ui.openSectorCta]);

  const [selectedObjectId, setSelectedObjectId] = useState<string>('SECTOR-AVILA-TIEMBLO');
  const selectedObject = useMemo(
    () => selectableObjects.find(o => o.id === selectedObjectId) || selectableObjects[0],
    [selectableObjects, selectedObjectId]
  );

  // Restore state from URL query params on mount (no personal data)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const qScenario = params.get('scenario') as Scenario | null;
    const qSector = params.get('sector');
    const qBody = params.get('body') as CelestialBodyId | null;
    if (qScenario && scenarioIds.includes(qScenario)) setScenario(qScenario);
    if (qSector && PILOT_SECTORS.some(s => s.id === qSector)) {
      setActiveSectorId(qSector);
      setSelectedObjectId(qSector);
      const found = PILOT_SECTORS.find(s => s.id === qSector)!;
      setRotationLat(found.center[0]);
      setRotationLon(found.center[1]);
    }
    if (qBody && (qBody === 'EARTH' || qBody === 'MOON' || qBody === 'MARS')) {
      setCelestialBody(qBody);
      if (qBody !== 'EARTH') setExploreMode('SPACE');
    }
  }, []);

  // Persist non-personal scenario/sector/body state in URL query parameters when user interacts
  const syncUrlState = useCallback((nextScenario: Scenario, nextSectorId: string, nextBody: CelestialBodyId) => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('scenario', nextScenario);
      url.searchParams.set('sector', nextSectorId);
      url.searchParams.set('body', nextBody);
      window.history.replaceState({}, '', url.toString());
    } catch {
      /* Ignore URL update errors in constrained environments */
    }
  }, []);

  // Broadcast sector selection to SectorIntelligenceConsole via custom DOM event
  const selectObjectAndFly = useCallback(
    (obj: GlobeSelectableObject) => {
      setSelectedObjectId(obj.id);
      setRotationLat(obj.coordinates[0]);
      setRotationLon(obj.coordinates[1]);
      setZoomDist(obj.kind === 'CAMERA' ? 6.6 : obj.kind === 'SECTOR' ? 7.2 : 8.4);
      if (obj.sectorId) {
        setActiveSectorId(obj.sectorId);
        syncUrlState(scenario, obj.sectorId, celestialBody);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('oep:select-sector', { detail: { sectorId: obj.sectorId, cameraId: obj.kind === 'CAMERA' ? obj.id : undefined } }));
        }
      }
    },
    [celestialBody, scenario, syncUrlState]
  );

  // Timeline autoplay effect
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setTimelineStep(prev => {
        const next = (prev + 1) % 5;
        if (next === 0) setScenario('outage');
        else if (next === 3) setScenario('intermittent');
        else if (next === 4) setScenario('restored');
        return next;
      });
    }, 2400);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  // Export deterministic seed & globe snapshot JSON
  const exportGlobeSeedJson = () => {
    const payload = {
      kind: 'OEP_MISSION_CONTROL_SEED_EXPORT',
      warning: 'SIMULATION_ONLY_NOT_PHYSICALLY_TESTED_NOT_AN_EMERGENCY_SERVICE',
      exportedAt: '2026-10-22T06:00:00Z',
      scenario,
      sectorId: activeSector.id,
      celestialBody,
      timelineStep: timeline[timelineStep]?.code,
      simulation: simResult
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civic-relay-mission-seed-${simResult.seed}-${activeSector.code}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Three.js Interactive Globe with Raycasting, Drag/Zoom, Natural Earth Land Mask & Celestial Body Shader
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const targetRotRef = useRef({ lat: rotationLat, lon: rotationLon, zoom: zoomDist });
  useEffect(() => {
    targetRotRef.current = { lat: rotationLat, lon: rotationLon, zoom: zoomDist };
  }, [rotationLat, rotationLon, zoomDist]);

  const selectableRef = useRef(selectableObjects);
  useEffect(() => {
    selectableRef.current = selectableObjects;
  }, [selectableObjects]);

  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const scenarioRef = useRef(scenario);
  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  useEffect(() => {
    if (force2d) return;
    const mount = canvasMountRef.current;
    if (!mount) return;
    let destroyed = false;
    let animFrame = 0;
    let cleanup: () => void = () => {};

    async function initGlobe() {
      const THREE = await import('three');
      if (destroyed || !mount) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#040b12');
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 150);
      camera.position.set(0, 0, targetRotRef.current.zoom);

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'low-power' });
      } catch {
        setWebglSupported(false);
        return;
      }
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.4 : 1.8));
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;touch-action:none;';
      renderer.domElement.setAttribute('data-testid', 'interactive-3d-globe-canvas');

      const ambient = new THREE.AmbientLight('#b8dced', 1.45);
      scene.add(ambient);
      const sun = new THREE.DirectionalLight('#e6f2fa', 2.2);
      sun.position.set(-4, 5, 8);
      scene.add(sun);

      const worldGroup = new THREE.Group();
      scene.add(worldGroup);

      const bodySpec = CELESTIAL_BODIES[celestialBody];
      const texCanvas = document.createElement('canvas');
      texCanvas.width = 1024;
      texCanvas.height = 512;
      const ctx = texCanvas.getContext('2d');

      const paintBaseTexture = (rings?: number[][]) => {
        if (!ctx) return;
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, bodySpec.palette.primary);
        grad.addColorStop(0.5, '#091b29');
        grad.addColorStop(1, bodySpec.palette.primary);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        // Lat/Lon graticule
        ctx.strokeStyle = 'rgba(116, 208, 225, 0.16)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= 1024; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 512);
          ctx.stroke();
        }
        for (let y = 0; y <= 512; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1024, y);
          ctx.stroke();
        }

        if (celestialBody === 'EARTH' && rings && rings.length > 0) {
          ctx.fillStyle = bodySpec.palette.secondary;
          ctx.strokeStyle = 'rgba(139, 219, 232, 0.72)';
          ctx.lineWidth = 1.2;
          for (const ring of rings) {
            ctx.beginPath();
            for (let i = 0; i < ring.length; i += 2) {
              const lon = ring[i];
              const lat = ring[i + 1];
              const x = ((lon + 180) / 360) * 1024;
              const y = ((90 - lat) / 180) * 512;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else if (celestialBody !== 'EARTH') {
          // Educational craters / planetary topography features for Moon / Mars
          ctx.strokeStyle = bodySpec.palette.wire;
          ctx.fillStyle = bodySpec.palette.secondary;
          for (let i = 0; i < 42; i++) {
            const cx = ((i * 173) % 960) + 32;
            const cy = ((i * 97) % 420) + 46;
            const r = 8 + (i % 5) * 9;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      };

      paintBaseTexture();
      const planetTexture = new THREE.CanvasTexture(texCanvas);
      planetTexture.colorSpace = THREE.SRGBColorSpace;

      if (celestialBody === 'EARTH') {
        fetch('/geo/land-110m.json')
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (!destroyed && data && Array.isArray(data.rings)) {
              paintBaseTexture(data.rings);
              planetTexture.needsUpdate = true;
            }
          })
          .catch(() => {
            /* Fallback graticule already rendered */
          });
      }

      const globeRadius = 2.55;
      const globeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(globeRadius, 72, 54),
        new THREE.MeshStandardMaterial({
          map: planetTexture,
          roughness: 0.82,
          metalness: 0.22,
          emissive: bodySpec.palette.primary,
          emissiveIntensity: 0.25
        })
      );
      worldGroup.add(globeMesh);

      const atmoMesh = new THREE.Mesh(
        new THREE.SphereGeometry(globeRadius * 1.035, 56, 42),
        new THREE.MeshBasicMaterial({
          color: bodySpec.palette.atmosphere,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.14,
          depthWrite: false
        })
      );
      worldGroup.add(atmoMesh);

      const latLonToVec3 = (lat: number, lon: number, radius = globeRadius + 0.04) => {
        const phi = ((90 - lat) * Math.PI) / 180;
        const theta = ((lon + 180) * Math.PI) / 180;
        return new THREE.Vector3(
          -radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta)
        );
      };

      // Interactive markers group for Raycaster
      const markersGroup = new THREE.Group();
      worldGroup.add(markersGroup);
      const markerMeshes: Array<InstanceType<typeof THREE.Mesh>> = [];

      if (celestialBody === 'EARTH') {
        for (const item of selectableRef.current) {
          if (item.kind === 'SATELLITE') continue;
          const color =
            item.kind === 'SECTOR'
              ? '#ff7a59'
              : item.kind === 'CAMERA'
              ? '#38bdf8'
              : '#34d399';
          const geom =
            item.kind === 'SECTOR'
              ? new THREE.OctahedronGeometry(0.085, 1)
              : item.kind === 'CAMERA'
              ? new THREE.ConeGeometry(0.055, 0.12, 8)
              : new THREE.BoxGeometry(0.09, 0.09, 0.09);
          const mat = new THREE.MeshBasicMaterial({ color });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.copy(latLonToVec3(item.coordinates[0], item.coordinates[1], globeRadius + 0.055));
          mesh.lookAt(new THREE.Vector3(0, 0, 0));
          mesh.userData = { objectId: item.id, kind: item.kind };
          markersGroup.add(mesh);
          markerMeshes.push(mesh);
        }
      }

      // Routes / Arcs group between active sectors & gateways
      const routesGroup = new THREE.Group();
      worldGroup.add(routesGroup);
      const arcPairs: Array<[[number, number], [number, number]]> = [
        [[40.4167, -4.5], [40.4168, -3.7038]],
        [[39.42, -0.41], [40.4168, -3.7038]],
        [[40.4168, -3.7038], [50.8503, 4.3517]],
        [[51.9808, 5.9114], [50.8503, 4.3517]]
      ];
      const packetDots: Array<{ mesh: InstanceType<typeof THREE.Mesh>; curve: InstanceType<typeof THREE.QuadraticBezierCurve3>; offset: number }> = [];

      if (celestialBody === 'EARTH') {
        arcPairs.forEach(([from, to], idx) => {
          const startV = latLonToVec3(from[0], from[1], globeRadius + 0.04);
          const endV = latLonToVec3(to[0], to[1], globeRadius + 0.04);
          const midV = startV.clone().add(endV).multiplyScalar(0.5).normalize().multiplyScalar(globeRadius + 0.48);
          const curve = new THREE.QuadraticBezierCurve3(startV, midV, endV);
          const pts = curve.getPoints(44);
          const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
          const lineMat = new THREE.LineBasicMaterial({
            color: scenarioRef.current === 'outage' ? '#f59e0b' : '#34d399',
            transparent: true,
            opacity: scenarioRef.current === 'outage' ? 0.32 : 0.88
          });
          routesGroup.add(new THREE.Line(lineGeom, lineMat));

          const dotMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.042, 10, 10),
            new THREE.MeshBasicMaterial({ color: '#67e8f9' })
          );
          routesGroup.add(dotMesh);
          packetDots.push({ mesh: dotMesh, curve, offset: idx * 0.25 });
        });
      }

      // Orbital ring & selectable conceptual satellite
      const orbitGroup = new THREE.Group();
      scene.add(orbitGroup);
      const orbitPts = [];
      for (let i = 0; i <= 160; i++) {
        const a = (i / 160) * Math.PI * 2;
        orbitPts.push(new THREE.Vector3(Math.cos(a) * 3.35, Math.sin(a) * 0.85, Math.sin(a) * 3.35));
      }
      const orbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(orbitPts),
        new THREE.LineBasicMaterial({ color: '#61a9be', transparent: true, opacity: 0.28 })
      );
      orbitGroup.add(orbitLine);

      const satMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.18),
        new THREE.MeshBasicMaterial({ color: '#e0f2fe' })
      );
      satMesh.userData = { objectId: 'SAT-LEO-CONCEPT-01', kind: 'SATELLITE' };
      orbitGroup.add(satMesh);
      markerMeshes.push(satMesh);

      // Pointer drag, wheel zoom & Raycast click selection
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragging = false;
      let dragDistance = 0;
      let prevX = 0;
      let prevY = 0;

      const onPointerDown = (e: PointerEvent) => {
        dragging = true;
        dragDistance = 0;
        prevX = e.clientX;
        prevY = e.clientY;
        renderer.domElement.style.cursor = 'grabbing';
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        prevX = e.clientX;
        prevY = e.clientY;
        dragDistance += Math.hypot(dx, dy);
        setRotationLon(lon => ((lon - dx * 0.35 + 540) % 360) - 180);
        setRotationLat(lat => Math.max(-75, Math.min(75, lat + dy * 0.28)));
      };

      const onPointerUp = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        renderer.domElement.style.cursor = 'grab';
        if (dragDistance < 6) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObjects(markerMeshes, false);
          if (hits.length > 0) {
            const hitId = hits[0].object.userData?.objectId as string | undefined;
            const found = selectableRef.current.find(o => o.id === hitId);
            if (found) selectObjectAndFly(found);
          }
        }
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        setZoomDist(z => Math.max(5.6, Math.min(13.5, z + (e.deltaY > 0 ? 0.45 : -0.45))));
      };

      const onContextLost = (e: Event) => {
        e.preventDefault();
        cancelAnimationFrame(animFrame);
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);

      const measure = () => {
        if (destroyed || !mount) return;
        const rect = mount.getBoundingClientRect();
        const w = Math.max(240, rect.width);
        const h = Math.max(240, rect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      const ro = new ResizeObserver(measure);
      ro.observe(mount);
      measure();

      let curLat = targetRotRef.current.lat;
      let curLon = targetRotRef.current.lon;
      let curZoom = targetRotRef.current.zoom;
      let clockT = 0;

      const animate = () => {
        if (destroyed) return;
        clockT += 0.014;
        curLat += (targetRotRef.current.lat - curLat) * 0.12;
        curLon += (targetRotRef.current.lon - curLon) * 0.12;
        curZoom += (targetRotRef.current.zoom - curZoom) * 0.14;

        worldGroup.rotation.y = (-curLon * Math.PI) / 180 - Math.PI * 0.5;
        worldGroup.rotation.x = (curLat * Math.PI) / 180 * 0.55;
        camera.position.z = curZoom;

        const l = layersRef.current;
        routesGroup.visible = celestialBody === 'EARTH' && l.routes;
        orbitGroup.visible = l.orbital;

        for (const m of markerMeshes) {
          const kind = m.userData?.kind;
          if (kind === 'SECTOR') m.visible = celestialBody === 'EARTH' && l.incidents;
          else if (kind === 'GATEWAY') m.visible = celestialBody === 'EARTH' && l.infrastructure;
          else if (kind === 'CAMERA') m.visible = celestialBody === 'EARTH' && l.cameras;
        }

        const hasActiveRoute = scenarioRef.current !== 'outage';
        packetDots.forEach(p => {
          p.mesh.visible = hasActiveRoute && l.routes && celestialBody === 'EARTH';
          if (p.mesh.visible) {
            const u = (clockT * 0.45 + p.offset) % 1;
            p.mesh.position.copy(p.curve.getPoint(u));
          }
        });

        satMesh.position.set(
          Math.cos(clockT * 0.7) * 3.35,
          Math.sin(clockT * 0.7) * 0.85,
          Math.sin(clockT * 0.7) * 3.35
        );

        renderer.render(scene, camera);
        animFrame = requestAnimationFrame(animate);
      };
      animFrame = requestAnimationFrame(animate);

      cleanup = () => {
        cancelAnimationFrame(animFrame);
        ro.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        planetTexture.dispose();
        renderer.dispose();
      };
    }

    void initGlobe().catch(() => setWebglSupported(false));
    return () => {
      destroyed = true;
      cleanup();
    };
  }, [celestialBody, force2d, selectObjectAndFly]);

  const hasRoute = scenario !== 'outage';
  const result = packets === 0 && scenario === 'outage' ? t.queued : !hasRoute ? t.queued : t.ack;
  const activeBodySpec = CELESTIAL_BODIES[celestialBody];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setRotationLon(l => l - 8);
    else if (e.key === 'ArrowRight') setRotationLon(l => l + 8);
    else if (e.key === 'ArrowUp') setRotationLat(l => Math.min(75, l + 6));
    else if (e.key === 'ArrowDown') setRotationLat(l => Math.max(-75, l - 6));
    else if (e.key === '+' || e.key === '=') setZoomDist(z => Math.max(5.6, z - 0.6));
    else if (e.key === '-') setZoomDist(z => Math.min(13.5, z + 0.6));
    else if (e.key.toLowerCase() === 'r') {
      setRotationLat(activeSector.center[0]);
      setRotationLon(activeSector.center[1]);
      setZoomDist(8.8);
    }
  };

  return (
    <div
      className="mission-console"
      data-testid="mission-control-console"
      aria-label="Interactive conceptual crisis communication simulator"
      onKeyDown={handleKeyDown}
    >
      <div className="console-top">
        <span className="console-heading">
          <i className="indicator" /> {t.top} <b>/</b> {t.modelLabel}
        </span>
        <span className="console-tag">{activeBodySpec.evidenceLabel}</span>
      </div>

      {/* Mode & Body Switcher Bar */}
      <div
        className="mc-toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          padding: '0.55rem 0.85rem',
          borderBottom: '1px solid rgba(120, 190, 210, 0.16)',
          background: 'rgba(6, 17, 26, 0.88)',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div role="group" aria-label="Exploration mode" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="globe-mode-emergency"
            aria-pressed={exploreMode === 'EMERGENCY' && celestialBody === 'EARTH'}
            onClick={() => {
              setExploreMode('EMERGENCY');
              setCelestialBody('EARTH');
              syncUrlState(scenario, activeSector.id, 'EARTH');
            }}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.35rem',
              fontSize: '0.74rem',
              fontWeight: 600,
              border: '1px solid rgba(90, 175, 196, 0.4)',
              background: exploreMode === 'EMERGENCY' && celestialBody === 'EARTH' ? '#174962' : 'transparent',
              color: '#e2f1f8',
              cursor: 'pointer'
            }}
          >
            {ui.modeEmergency}
          </button>
          <button
            type="button"
            data-testid="globe-mode-space"
            aria-pressed={exploreMode === 'SPACE'}
            onClick={() => setExploreMode(m => (m === 'SPACE' ? 'EMERGENCY' : 'SPACE'))}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.35rem',
              fontSize: '0.74rem',
              fontWeight: 600,
              border: '1px solid rgba(245, 158, 11, 0.45)',
              background: exploreMode === 'SPACE' ? '#3b2813' : 'transparent',
              color: '#fde68a',
              cursor: 'pointer'
            }}
          >
            {ui.modeSpace}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {exploreMode === 'SPACE' &&
            (['EARTH', 'MOON', 'MARS'] as CelestialBodyId[]).map(bodyId => (
              <button
                key={bodyId}
                type="button"
                data-testid={`celestial-body-${bodyId.toLowerCase()}`}
                aria-pressed={celestialBody === bodyId}
                onClick={() => {
                  setCelestialBody(bodyId);
                  syncUrlState(scenario, activeSector.id, bodyId);
                }}
                style={{
                  padding: '0.26rem 0.55rem',
                  borderRadius: '0.3rem',
                  fontSize: '0.72rem',
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  background: celestialBody === bodyId ? '#334155' : 'transparent',
                  color: '#f8fafc',
                  cursor: 'pointer'
                }}
              >
                {bodyId}
              </button>
            ))}
          <button
            type="button"
            data-testid="globe-toggle-2d"
            aria-pressed={force2d}
            onClick={() => setForce2d(v => !v)}
            style={{
              padding: '0.28rem 0.55rem',
              borderRadius: '0.3rem',
              fontSize: '0.72rem',
              border: '1px solid rgba(120, 190, 210, 0.35)',
              background: force2d ? '#1e3a4c' : 'transparent',
              color: '#bae6fd',
              cursor: 'pointer'
            }}
          >
            {force2d ? ui.view3d : ui.view2d}
          </button>
        </div>
      </div>

      {/* Educational disclaimer banner when exploring Moon or Mars */}
      {celestialBody !== 'EARTH' && (
        <div
          role="status"
          data-testid="non-earth-educational-banner"
          style={{
            padding: '0.55rem 0.85rem',
            background: '#3b1d16',
            borderBottom: '1px solid #f97316',
            color: '#fed7aa',
            fontSize: '0.78rem',
            lineHeight: 1.45
          }}
        >
          <strong>{CELESTIAL_BODIES[celestialBody].name[locale]}:</strong> {CELESTIAL_BODIES[celestialBody].notice[locale]}
        </div>
      )}

      {/* Fly-To Geographic Breadcrumb Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          alignItems: 'center',
          padding: '0.45rem 0.85rem',
          background: 'rgba(8, 22, 34, 0.75)',
          borderBottom: '1px solid rgba(120, 190, 210, 0.14)',
          fontSize: '0.73rem'
        }}
      >
        <span style={{ color: '#94a3b8' }}>{ui.flyToLabel}</span>
        {PILOT_SECTORS.map(sec => (
          <button
            key={sec.id}
            type="button"
            data-testid={`globe-flyto-${sec.code}`}
            aria-pressed={activeSector.id === sec.id}
            onClick={() => {
              setCelestialBody('EARTH');
              const obj = selectableObjects.find(o => o.id === sec.id);
              if (obj) selectObjectAndFly(obj);
            }}
            style={{
              padding: '0.24rem 0.52rem',
              borderRadius: '0.3rem',
              fontSize: '0.72rem',
              border: activeSector.id === sec.id ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.28)',
              background: activeSector.id === sec.id ? 'rgba(14, 116, 144, 0.45)' : 'rgba(15, 23, 42, 0.6)',
              color: '#f0f9ff',
              cursor: 'pointer'
            }}
          >
            {sec.country} · {sec.name.split('·')[0].trim()}
          </button>
        ))}
      </div>

      <div className="globe-stage" style={{ position: 'relative', minHeight: '340px' }}>
        <div className="vertical-ruler" aria-hidden="true">
          90° N <span>45° N</span>
          <span>00°</span>
          <span>45° S</span> 90° S
        </div>

        {/* Interactive 3D WebGL Globe Mount (when enabled and supported) */}
        {!force2d && webglSupported && (
          <div
            ref={canvasMountRef}
            style={{ width: '100%', height: '340px', position: 'relative', zIndex: 1 }}
            aria-label={t.svgAlt}
          />
        )}

        {/* Accessible 2D / SVG Topology & Fallback (always rendered in 2D mode or when WebGL unavailable) */}
        {(force2d || !webglSupported) && (
          <svg className="planet-art" viewBox="0 0 730 480" role="img" aria-label={t.svgAlt} data-testid="globe-2d-fallback-svg">
            <defs>
              <radialGradient id="globeGradient" cx="27%" cy="29%" r="76%">
                <stop offset="0" stopColor="#1b3f59" />
                <stop offset=".38" stopColor="#0c2537" />
                <stop offset=".75" stopColor="#06131e" />
                <stop offset="1" stopColor="#02060c" />
              </radialGradient>
            </defs>
            <circle cx="362" cy="240" r="190" fill="url(#globeGradient)" stroke="#5aafc4" strokeOpacity=".45" strokeWidth="1.5" />
            <path
              className={'data-path ' + (hasRoute ? 'path-on' : 'path-off')}
              d="M252 320 Q338 190 458 190 Q520 155 577 95"
              fill="none"
              strokeWidth="2.5"
              strokeDasharray="7 8"
            />
            <circle cx="252" cy="320" r="9" fill="#f97316" />
            <circle cx="458" cy="190" r="7" fill="#34d399" />
            <text x="362" y="455" textAnchor="middle" fill="#94a3b8" fontSize="12">
              2D ACCESSIBLE TOPOLOGY FALLBACK · {activeSector.name} ({rotationLat.toFixed(1)}°N, {rotationLon.toFixed(1)}°E)
            </text>
          </svg>
        )}

        {/* Camera Navigation Controls Overlay */}
        <div
          role="group"
          aria-label="Globe camera controls"
          style={{
            position: 'absolute',
            top: '0.65rem',
            right: '0.75rem',
            zIndex: 3,
            display: 'flex',
            gap: '0.3rem',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            data-testid="globe-zoom-in"
            onClick={() => setZoomDist(z => Math.max(5.6, z - 0.8))}
            style={{ padding: '0.28rem 0.5rem', background: 'rgba(9,24,36,0.88)', color: '#e2f1f8', border: '1px solid rgba(125,211,252,0.35)', borderRadius: '0.3rem', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            {ui.zoomIn}
          </button>
          <button
            type="button"
            data-testid="globe-zoom-out"
            onClick={() => setZoomDist(z => Math.min(13.5, z + 0.8))}
            style={{ padding: '0.28rem 0.5rem', background: 'rgba(9,24,36,0.88)', color: '#e2f1f8', border: '1px solid rgba(125,211,252,0.35)', borderRadius: '0.3rem', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            {ui.zoomOut}
          </button>
          <button
            type="button"
            data-testid="globe-north-up"
            onClick={() => setRotationLat(40.4)}
            style={{ padding: '0.28rem 0.5rem', background: 'rgba(9,24,36,0.88)', color: '#e2f1f8', border: '1px solid rgba(125,211,252,0.35)', borderRadius: '0.3rem', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            {ui.northUp}
          </button>
          <button
            type="button"
            data-testid="globe-reset-camera"
            onClick={() => {
              setRotationLat(activeSector.center[0]);
              setRotationLon(activeSector.center[1]);
              setZoomDist(8.8);
            }}
            style={{ padding: '0.28rem 0.5rem', background: 'rgba(9,24,36,0.88)', color: '#e2f1f8', border: '1px solid rgba(125,211,252,0.35)', borderRadius: '0.3rem', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            {ui.resetCam}
          </button>
        </div>

        <div className="globe-floating left-floating" style={{ zIndex: 2 }}>
          <span>{t.threat}</span>
          <strong>{activeSector.incidentType} · {activeSector.code}</strong>
          <small>
            {ui.sosLabel}: {simResult.summary.humanSOS} · {ui.unknownLabel}: {simResult.summary.humanUnknown}
          </small>
        </div>
        <div className="globe-floating right-floating" style={{ zIndex: 2 }}>
          <span>{t.route}</span>
          <strong className={hasRoute ? 'online' : 'offline'}>{hasRoute ? t.routeOn : t.routeOff}</strong>
          <small data-testid="globe-route-counters">
            {ui.ackLabel}: {simResult.summary.syntheticAcks} · {ui.queuedLabel}: {simResult.summary.queued}
          </small>
        </div>
        <div className="stage-coordinate" style={{ zIndex: 2 }} data-testid="globe-coordinates-readout">
          {rotationLat.toFixed(2)}° N&nbsp; / &nbsp;{rotationLon.toFixed(2)}° E · Zoom {zoomDist.toFixed(1)}x{' '}
          <span>{ui.controlsHint}</span>
        </div>
      </div>

      {/* Accessible Object Selector Bar (Synced with 3D Raycast Selection) */}
      <div
        role="group"
        aria-label={ui.objectsBarLabel}
        style={{
          display: 'flex',
          gap: '0.35rem',
          flexWrap: 'wrap',
          padding: '0.5rem 0.85rem',
          background: 'rgba(7, 19, 30, 0.9)',
          borderTop: '1px solid rgba(120, 190, 210, 0.16)'
        }}
      >
        {selectableObjects.map(obj => (
          <button
            key={obj.id}
            type="button"
            data-testid={`globe-object-${obj.id}`}
            aria-pressed={selectedObject.id === obj.id}
            onClick={() => selectObjectAndFly(obj)}
            style={{
              padding: '0.26rem 0.55rem',
              borderRadius: '0.32rem',
              fontSize: '0.72rem',
              border: selectedObject.id === obj.id ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.26)',
              background: selectedObject.id === obj.id ? 'rgba(3, 105, 161, 0.45)' : 'rgba(15, 23, 42, 0.65)',
              color: '#e0f2fe',
              cursor: 'pointer'
            }}
          >
            {obj.kind === 'SECTOR' ? '📍' : obj.kind === 'GATEWAY' ? '📡' : obj.kind === 'CAMERA' ? '📷' : '🛰️'}{' '}
            {obj.id.replace('SECTOR-', '').replace('CAM-', '')}
          </button>
        ))}
      </div>

      {/* Selected Object Inspector Sheet */}
      <div
        data-testid="globe-selected-inspector"
        style={{
          margin: '0.55rem 0.85rem',
          padding: '0.7rem 0.85rem',
          borderRadius: '0.45rem',
          border: '1px solid rgba(56, 189, 248, 0.32)',
          background: 'rgba(11, 27, 41, 0.92)',
          fontSize: '0.78rem',
          lineHeight: 1.48
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <strong style={{ color: '#7dd3fc', letterSpacing: '0.04em' }}>
            {ui.inspectorTitle}: {selectedObject.title}
          </strong>
          <span
            data-testid="globe-selected-evidence-badge"
            style={{
              padding: '0.12rem 0.45rem',
              borderRadius: '0.25rem',
              background: selectedObject.isSimulated ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)',
              border: selectedObject.isSimulated ? '1px solid #f59e0b' : '1px solid #10b981',
              color: selectedObject.isSimulated ? '#fde68a' : '#a7f3d0',
              fontSize: '0.68rem',
              fontWeight: 700
            }}
          >
            {selectedObject.evidenceLabel}
          </span>
        </div>
        <p style={{ margin: '0.2rem 0', color: '#dbeafe' }}>{selectedObject.subtitle}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', color: '#94a3b8', fontSize: '0.73rem', marginTop: '0.35rem' }}>
          <span>
            <b>{ui.sourceLabel}</b> {selectedObject.source}
          </span>
          <span>
            <b>{ui.updatedLabel}</b> {selectedObject.updatedAt}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
          <code style={{ color: '#bae6fd', fontSize: '0.73rem' }}>{selectedObject.metrics}</code>
          <a
            href={selectedObject.actionHref}
            style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'underline', fontSize: '0.75rem' }}
          >
            {selectedObject.actionLabel}
          </a>
        </div>
      </div>

      {/* Layer Toggles & Timeline Replay Bar */}
      <div
        style={{
          padding: '0.5rem 0.85rem',
          borderTop: '1px solid rgba(120, 190, 210, 0.15)',
          display: 'grid',
          gap: '0.45rem',
          fontSize: '0.74rem'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{ui.layersTitle}</span>
          {(Object.keys(layers) as LayerKey[]).map(key => (
            <label
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.28rem',
                padding: '0.18rem 0.45rem',
                borderRadius: '0.28rem',
                background: layers[key] ? 'rgba(14, 116, 144, 0.28)' : 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(120, 190, 210, 0.24)',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                data-testid={`globe-layer-${key}`}
                checked={layers[key]}
                onChange={e => setLayers(prev => ({ ...prev, [key]: e.target.checked }))}
              />
              <span>{ui.layerNames[key]}</span>
            </label>
          ))}
        </div>

        {/* Reproducible Timeline & Seed Export */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="globe-timeline-play"
              onClick={() => setIsPlaying(p => !p)}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '0.3rem',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                background: isPlaying ? '#0369a1' : 'rgba(15, 23, 42, 0.8)',
                color: '#f0f9ff',
                fontSize: '0.72rem',
                cursor: 'pointer'
              }}
            >
              {isPlaying ? ui.pauseTimeline : ui.playTimeline}
            </button>
            {timeline.map((st, idx) => (
              <button
                key={st.code}
                type="button"
                data-testid={`globe-timeline-step-${idx}`}
                aria-pressed={timelineStep === idx}
                onClick={() => {
                  setTimelineStep(idx);
                  if (idx === 0 || idx === 2) setScenario('outage');
                  else if (idx === 3) setScenario('intermittent');
                  else if (idx === 4) setScenario('restored');
                }}
                style={{
                  padding: '0.22rem 0.45rem',
                  borderRadius: '0.25rem',
                  border: timelineStep === idx ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
                  background: timelineStep === idx ? 'rgba(2, 132, 199, 0.38)' : 'transparent',
                  color: '#e2e8f0',
                  fontSize: '0.7rem',
                  cursor: 'pointer'
                }}
                title={st.desc}
              >
                {st.code}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="globe-export-seed"
            onClick={exportGlobeSeedJson}
            style={{
              padding: '0.25rem 0.55rem',
              borderRadius: '0.3rem',
              border: '1px solid rgba(52, 211, 153, 0.45)',
              background: 'rgba(6, 78, 59, 0.45)',
              color: '#a7f3d0',
              fontSize: '0.72rem',
              cursor: 'pointer'
            }}
          >
            {ui.exportSeed}
          </button>
        </div>
        <div style={{ color: '#bae6fd', fontSize: '0.73rem' }} aria-live="polite">
          <strong>{timeline[timelineStep]?.label}:</strong> {timeline[timelineStep]?.desc}
        </div>
      </div>

      <div className="console-bottom">
        <div className="console-section-title">
          <span>01 / {t.conditions}</span>
          <span>{t.select} ↓</span>
        </div>
        <div className="scenario-switch" role="group" aria-label={t.select}>
          {scenarioIds.map((id, i) => (
            <button
              key={id}
              type="button"
              data-testid={`mission-scenario-${id}`}
              aria-pressed={scenario === id}
              className={scenario === id ? 'scenario-active' : ''}
              onClick={() => {
                setScenario(id);
                syncUrlState(id, activeSector.id, celestialBody);
              }}
            >
              <span className="scenario-name">{t.scenarios[i].name}</span>
              <small>{t.scenarios[i].subtitle}</small>
            </button>
          ))}
        </div>
        <div className="console-footer">
          <div className="telemetry">
            <span>02 / {t.packet}</span>
            <strong aria-live="polite" data-testid="mission-packet-result">
              {result}
            </strong>
          </div>
          <button
            type="button"
            data-testid="mission-inject-packet"
            className="inject-packet"
            onClick={() => setPackets(n => n + 1)}
          >
            {t.inject} <span>↗</span>
          </button>
        </div>
        <p className="console-disclaimer">{t.disclaimer}</p>
      </div>
    </div>
  );
}

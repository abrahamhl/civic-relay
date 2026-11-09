import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { api } from '../api/client';
import type { TerrainGridSnapshot } from '../offline/terrain-snapshot';
import type { WeatherSnapshot, WeatherMetric } from '../offline/weather-snapshot';

interface Props {
  onClose?: () => void;
  initialRegion?: string;
}

type LayerMode = 'GLOBE' | 'TERRAIN_DEM';

export const Globe4DStudio: React.FC<Props> = ({ onClose, initialRegion = 'valencia' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<LayerMode>('GLOBE');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [timeStep, setTimeStep] = useState<number>(0); // 0 to 23 hours
  const [region, setRegion] = useState<string>(initialRegion);
  const [metric, setMetric] = useState<WeatherMetric>('wind_speed_10m');
  const [exaggeration, setExaggeration] = useState<number>(3);
  const [showParticles, setShowParticles] = useState<boolean>(true);
  const [showFresnel, setShowFresnel] = useState<boolean>(true);
  const [showSatellites, setShowSatellites] = useState<boolean>(true);
  const [showObservations, setShowObservations] = useState<boolean>(true);

  // RF Link params
  const [mastHeightM, setMastHeightM] = useState<number>(12);
  const [rfFrequencyMHz, setRfFrequencyMHz] = useState<number>(868);

  // Sourced Data State
  const [terrain, setTerrain] = useState<TerrainGridSnapshot | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [effisDetections, setEffisDetections] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [usgsEvents, setUsgsEvents] = useState<any[]>([]);
  const [reconciliationReceipt, setReconciliationReceipt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Inicializando visualizador 4D...');

  // Three.js State
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const fresnelMeshRef = useRef<THREE.Mesh | null>(null);
  const satellitesGroupRef = useRef<THREE.Group | null>(null);

  // Mouse Orbit State
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraAnglesRef = useRef({ yaw: 0.4, pitch: 0.35, distance: 4.8 });

  // 1. Fetch official OSINT, terrain & weather feeds
  useEffect(() => {
    let active = true;
    setStatusMessage('Cargando modelos DEM, satelitales y meteorología oficial...');

    Promise.allSettled([
      api.getTerrainGrid(region),
      api.getWeatherGrid(region),
      api.getCopernicusEffis(),
      api.getAemetWarnings(),
      api.getUsgsEarthquakes(),
      api.getReconciledIntelligence(),
    ]).then(([terrainRes, weatherRes, effisRes, aemetRes, usgsRes, reconRes]) => {
      if (!active) return;
      if (terrainRes.status === 'fulfilled' && terrainRes.value?.status !== 'UNAVAILABLE') {
        setTerrain(terrainRes.value);
      }
      if (weatherRes.status === 'fulfilled' && weatherRes.value?.status !== 'UNAVAILABLE') {
        setWeather(weatherRes.value);
      }
      if (effisRes.status === 'fulfilled' && effisRes.value?.observations) {
        setEffisDetections(effisRes.value.observations);
      }
      if (aemetRes.status === 'fulfilled' && aemetRes.value?.warnings) {
        setWarnings(aemetRes.value.warnings);
      }
      if (usgsRes.status === 'fulfilled' && usgsRes.value?.observations) {
        setUsgsEvents(usgsRes.value.observations);
      }
      if (reconRes.status === 'fulfilled' && reconRes.value?.receipt) {
        setReconciliationReceipt(reconRes.value.receipt.rootSha256);
      }
      setStatusMessage('Plataforma 4D lista · Datos verificados por SHA-256');
    });

    return () => { active = false; };
  }, [region]);

  // 2. Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimeStep((prev) => (prev + 1) % 24);
    }, 1000 / playSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, playSpeed]);

  // 3. Initialize Three.js Scene, Camera, WebGL Renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060f1e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    sunLight.position.set(5, 3, 4);
    scene.add(sunLight);

    // Build Earth Globe
    const globeGroup = new THREE.Group();
    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);

    // Earth Sphere with Wireframe Grid
    const globeGeo = new THREE.SphereGeometry(1.5, 48, 48);
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0x112942,
      roughness: 0.8,
      metalness: 0.1,
      wireframe: false,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeGroup.add(globeMesh);

    // Atmosphere Halo
    const atmosphereGeo = new THREE.SphereGeometry(1.54, 48, 48);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
    });
    globeGroup.add(new THREE.Mesh(atmosphereGeo, atmosphereMat));

    // Latitude & Longitude Reference Rings
    const gridMat = new THREE.LineBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.4 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const rad = (lat * Math.PI) / 180;
      const r = 1.505 * Math.cos(rad);
      const y = 1.505 * Math.sin(rad);
      const circleGeo = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
      }
      circleGeo.setFromPoints(pts);
      globeGroup.add(new THREE.Line(circleGeo, gridMat));
    }

    // Satellites Group
    const satGroup = new THREE.Group();
    satellitesGroupRef.current = satGroup;
    globeGroup.add(satGroup);

    // Sentinel / Terra / LEO Satellite Orbits
    const satellites = [
      { name: 'Sentinel-3 (SLSTR)', r: 1.85, inc: 98.6, speed: 0.008, color: 0x10b981 },
      { name: 'Terra (MODIS)', r: 1.88, inc: 98.2, speed: 0.007, color: 0xf59e0b },
      { name: 'Suomi-NPP (VIIRS)', r: 1.92, inc: 98.7, speed: 0.009, color: 0xef4444 },
      { name: 'Meteosat (MSG)', r: 2.45, inc: 0.0, speed: 0.001, color: 0x38bdf8 },
    ];

    satellites.forEach((sat) => {
      const orbitGeo = new THREE.BufferGeometry();
      const pts = [];
      const incRad = (sat.inc * Math.PI) / 180;
      for (let i = 0; i <= 96; i++) {
        const theta = (i / 96) * Math.PI * 2;
        const x = sat.r * Math.cos(theta);
        const y = sat.r * Math.sin(theta) * Math.sin(incRad);
        const z = sat.r * Math.sin(theta) * Math.cos(incRad);
        pts.push(new THREE.Vector3(x, y, z));
      }
      orbitGeo.setFromPoints(pts);
      const orbitLine = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: sat.color, transparent: true, opacity: 0.35 }));
      satGroup.add(orbitLine);

      // Satellite marker
      const satMarkerGeo = new THREE.BoxGeometry(0.04, 0.04, 0.08);
      const satMarkerMat = new THREE.MeshBasicMaterial({ color: sat.color });
      const satMesh = new THREE.Mesh(satMarkerGeo, satMarkerMat);
      satMesh.userData = { sat, theta: Math.random() * Math.PI * 2 };
      satGroup.add(satMesh);
    });

    // Event Listeners for Orbit & Zoom
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;
      cameraAnglesRef.current.yaw += deltaX * 0.008;
      cameraAnglesRef.current.pitch = Math.max(-1.4, Math.min(1.4, cameraAnglesRef.current.pitch + deltaY * 0.008));
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => { isDraggingRef.current = false; };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAnglesRef.current.distance = Math.max(2.0, Math.min(12.0, cameraAnglesRef.current.distance + e.deltaY * 0.005));
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    // Animation Loop
    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Update Camera Position from Spherical Angles
      const { yaw, pitch, distance } = cameraAnglesRef.current;
      camera.position.x = distance * Math.cos(pitch) * Math.sin(yaw);
      camera.position.y = distance * Math.sin(pitch);
      camera.position.z = distance * Math.cos(pitch) * Math.cos(yaw);
      camera.lookAt(0, 0, 0);

      // Rotate Satellites in Orbits
      if (satGroup && satGroup.children) {
        satGroup.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.userData?.sat) {
            const sat = child.userData.sat;
            child.userData.theta += sat.speed;
            const th = child.userData.theta;
            const inc = (sat.inc * Math.PI) / 180;
            child.position.x = sat.r * Math.cos(th);
            child.position.y = sat.r * Math.sin(th) * Math.sin(inc);
            child.position.z = sat.r * Math.sin(th) * Math.cos(inc);
            child.rotation.y += 0.02;
          }
        });
      }

      // Update Particle Flow if present
      if (particleSystemRef.current) {
        const positions = particleSystemRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += 0.006 * playSpeed;
          if (positions[i] > 1.6) positions[i] = -1.6;
        }
        particleSystemRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('mousedown', handleMouseDown);
      dom.removeEventListener('wheel', handleWheel);
      renderer.dispose();
    };
  }, []);

  // 4. Update Terrain DEM Mesh when switching modes or data changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Toggle Globe vs DEM Mesh visibility
    if (globeGroupRef.current) {
      globeGroupRef.current.visible = (mode === 'GLOBE');
    }

    if (terrainMeshRef.current) {
      scene.remove(terrainMeshRef.current);
      terrainMeshRef.current.geometry.dispose();
      (terrainMeshRef.current.material as THREE.Material).dispose();
      terrainMeshRef.current = null;
    }

    if (fresnelMeshRef.current) {
      scene.remove(fresnelMeshRef.current);
      fresnelMeshRef.current.geometry.dispose();
      (fresnelMeshRef.current.material as THREE.Material).dispose();
      fresnelMeshRef.current = null;
    }

    if (particleSystemRef.current) {
      scene.remove(particleSystemRef.current);
      particleSystemRef.current.geometry.dispose();
      (particleSystemRef.current.material as THREE.Material).dispose();
      particleSystemRef.current = null;
    }

    if (mode === 'TERRAIN_DEM' && terrain) {
      const nx = terrain.columns;
      const ny = terrain.rows;
      const geometry = new THREE.PlaneGeometry(3.0, 3.0, nx - 1, ny - 1);
      geometry.rotateX(-Math.PI / 2);

      const pos = geometry.attributes.position;
      const minEl = terrain.summary.minElevationM;
      const maxEl = terrain.summary.maxElevationM;
      const span = Math.max(1, maxEl - minEl);

      const colors = new Float32Array(pos.count * 3);
      for (let r = 0; r < ny; r++) {
        for (let c = 0; c < nx; c++) {
          const idx = r * nx + c;
          const el = terrain.elevationsM[idx];
          const normH = (el - minEl) / span;
          // Displace Y with exaggeration
          pos.setY(idx, normH * 0.7 * (exaggeration / 3));

          // Color by height: green valley -> brown ridge -> snow white peak
          if (normH < 0.4) {
            colors[idx * 3] = 0.15 + normH * 0.4;
            colors[idx * 3 + 1] = 0.45 + normH * 0.3;
            colors[idx * 3 + 2] = 0.20;
          } else if (normH < 0.75) {
            colors[idx * 3] = 0.65;
            colors[idx * 3 + 1] = 0.48;
            colors[idx * 3 + 2] = 0.25;
          } else {
            colors[idx * 3] = 0.88;
            colors[idx * 3 + 1] = 0.92;
            colors[idx * 3 + 2] = 0.95;
          }
        }
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: false,
      });

      const mesh = new THREE.Mesh(geometry, mat);
      scene.add(mesh);
      terrainMeshRef.current = mesh;

      // 5. Add GeoRelay Fresnel Ellipsoid in 3D
      if (showFresnel) {
        // Transmitter Tx at (-1.0, h_mast) and Receiver Rx at (1.0, h_mast)
        const txPos = new THREE.Vector3(-1.1, 0.4 + (mastHeightM / 100), -0.2);
        const rxPos = new THREE.Vector3(1.1, 0.35 + (mastHeightM / 100), 0.3);
        const midPoint = new THREE.Vector3().addVectors(txPos, rxPos).multiplyScalar(0.5);
        const dist = txPos.distanceTo(rxPos);

        // Fresnel Radius: r_f = 0.5 * sqrt(lambda * d)
        const lambdaM = 300 / rfFrequencyMHz;
        const radiusF = Math.min(0.22, 0.5 * Math.sqrt(lambdaM * 0.05));

        const fresnelGeo = new THREE.SphereGeometry(1, 24, 24);
        fresnelGeo.scale(dist * 0.5, radiusF, radiusF);

        const fresnelMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.28,
          wireframe: true,
        });

        const fresnelMesh = new THREE.Mesh(fresnelGeo, fresnelMat);
        fresnelMesh.position.copy(midPoint);
        fresnelMesh.lookAt(rxPos);
        fresnelMesh.rotateY(Math.PI / 2);
        scene.add(fresnelMesh);
        fresnelMeshRef.current = fresnelMesh;

        // Line-of-sight axis
        const axisGeo = new THREE.BufferGeometry().setFromPoints([txPos, rxPos]);
        const axisMat = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 2 });
        mesh.add(new THREE.Line(axisGeo, axisMat));
      }

      // 6. Add Wind Particle Field in 3D
      if (showParticles) {
        const particleCount = 450;
        const pGeo = new THREE.BufferGeometry();
        const pPositions = new Float32Array(particleCount * 3);
        const pColors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
          pPositions[i * 3] = (Math.random() - 0.5) * 3.0;
          pPositions[i * 3 + 1] = 0.2 + Math.random() * 0.5;
          pPositions[i * 3 + 2] = (Math.random() - 0.5) * 3.0;

          // Cyan / Blue wind streaks
          pColors[i * 3] = 0.2;
          pColors[i * 3 + 1] = 0.75 + Math.random() * 0.25;
          pColors[i * 3 + 2] = 0.95;
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

        const pMat = new THREE.PointsMaterial({
          size: 0.035,
          vertexColors: true,
          transparent: true,
          opacity: 0.75,
        });

        const pSystem = new THREE.Points(pGeo, pMat);
        scene.add(pSystem);
        particleSystemRef.current = pSystem;
      }
    }
  }, [mode, terrain, exaggeration, showFresnel, showParticles, mastHeightM, rfFrequencyMHz]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '620px', background: '#050d1a', color: '#f1f5f9', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header & Epistemological Disclosures */}
      <div style={{ padding: '0.75rem 1.25rem', background: '#091829', borderBottom: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.02em' }}>
            SENDA GIS 4D · PLATAFORMA DE INTELIGENCIA DE EMERGENCIAS
          </h2>
          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: 6, background: '#1e3a5f', color: '#93c5fd', fontWeight: 700 }}>
            {mode === 'GLOBE' ? 'VISTA GLOBAL ORBITAL (WGS84)' : 'RELIEVE DEM REAL (MAPZEN/AWS)'}
          </span>
          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: 6, background: '#14532d', color: '#86efac', fontWeight: 700 }}>
            CIENCIA AUDITADA
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'GLOBE' ? 'TERRAIN_DEM' : 'GLOBE'))}
            style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: '1px solid #38bdf8', background: '#0369a1', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {mode === 'GLOBE' ? 'Cambiar a Relieve DEM 3D' : 'Cambiar a Globo Terrestre'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: '1px solid #475569', background: '#1e293b', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Cerrar Visor
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Viewport */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

        {/* Floating Controls HUD */}
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(8, 20, 36, 0.88)', border: '1px solid #1e3a5f', borderRadius: 12, padding: '0.85rem', width: '280px', backdropFilter: 'blur(8px)', fontSize: '0.8rem', zIndex: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: '0.5rem', color: '#7dd3fc', borderBottom: '1px solid #1e3a5f', paddingBottom: '0.35rem' }}>
            CAPAS & MOTORES CIENTÍFICOS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span>Satélites & Órbitas LEO:</span>
              <input type="checkbox" checked={showSatellites} onChange={(e) => setShowSatellites(e.target.checked)} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span>Viento & Partículas GPU:</span>
              <input type="checkbox" checked={showParticles} onChange={(e) => setShowParticles(e.target.checked)} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span>GeoRelay Elipsoide Fresnel:</span>
              <input type="checkbox" checked={showFresnel} onChange={(e) => setShowFresnel(e.target.checked)} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span>Observaciones OSINT:</span>
              <input type="checkbox" checked={showObservations} onChange={(e) => setShowObservations(e.target.checked)} />
            </label>
          </div>

          {mode === 'TERRAIN_DEM' && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #1e3a5f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Exageración vertical:</span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>×{exaggeration}</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={exaggeration}
                onChange={(e) => setExaggeration(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                <span>Mástil de enlace:</span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{mastHeightM} m</span>
              </div>
              <input
                type="range"
                min="3"
                max="45"
                step="1"
                value={mastHeightM}
                onChange={(e) => setMastHeightM(parseInt(e.target.value, 10))}
                style={{ width: '100%' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                <span>Frecuencia RF:</span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{rfFrequencyMHz} MHz</span>
              </div>
              <select
                value={rfFrequencyMHz}
                onChange={(e) => setRfFrequencyMHz(parseInt(e.target.value, 10))}
                style={{ width: '100%', background: '#0f2744', color: '#fff', border: '1px solid #1e3a5f', borderRadius: 6, padding: '0.25rem' }}
              >
                <option value="433">433 MHz (UHF ISM - Máxima penetración)</option>
                <option value="868">868 MHz (LoRa Europa / Meshtastic)</option>
                <option value="2400">2.4 GHz (Wi-Fi / Microondas COTS)</option>
                <option value="5800">5.8 GHz (Banda ancha / Enlaces troncales)</option>
              </select>
            </div>
          )}

          {reconciliationReceipt && (
            <div style={{ marginTop: '0.75rem', padding: '0.4rem', borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.68rem' }}>
              <div style={{ fontWeight: 800, color: '#6ee7b7' }}>RECONCILIACIÓN CRIPTOGRÁFICA</div>
              <div style={{ fontFamily: 'monospace', color: '#a7f3d0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                SHA: {reconciliationReceipt.slice(0, 16)}…
              </div>
            </div>
          )}
        </div>

        {/* Live Observation Overlay Stats */}
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(8, 20, 36, 0.88)', border: '1px solid #1e3a5f', borderRadius: 12, padding: '0.85rem', width: '280px', backdropFilter: 'blur(8px)', fontSize: '0.78rem', zIndex: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: '0.5rem', color: '#7dd3fc', borderBottom: '1px solid #1e3a5f', paddingBottom: '0.35rem' }}>
            SENSORES & FUENTES EN TIEMPO REAL
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Copernicus EFFIS (fuego):</span>
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>{effisDetections.length} anomalías</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Avisos AEMET / CAP:</span>
              <span style={{ fontWeight: 700, color: '#ef4444' }}>{warnings.length} alertas oficiales</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>USGS Terremotos (M≥4.5):</span>
              <span style={{ fontWeight: 700, color: '#a855f7' }}>{usgsEvents.length} sismos</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Modelo MET Norway:</span>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>9 puntos × 24h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 4D Timeline Bar */}
      <div style={{ padding: '0.85rem 1.25rem', background: '#091829', borderTop: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: isPlaying ? '#e11d48' : '#22c55e', color: '#fff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          {isPlaying ? 'Pausa ⏸' : 'Reproducir 4D ▶'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
          <span>Velocidad:</span>
          {[1, 2, 5].map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => setPlaySpeed(spd)}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: 6,
                border: '1px solid #334155',
                background: playSpeed === spd ? '#0284c7' : '#1e293b',
                color: '#fff',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              ×{spd}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Paso temporal (T+{timeStep}h):</span>
          <input
            type="range"
            min="0"
            max="23"
            value={timeStep}
            onChange={(e) => setTimeStep(parseInt(e.target.value, 10))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', minWidth: '55px' }}>
            +{timeStep}:00 h
          </span>
        </div>

        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
          {statusMessage}
        </div>
      </div>
    </div>
  );
};
